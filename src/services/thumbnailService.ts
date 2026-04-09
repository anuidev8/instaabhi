import { GoogleGenAI, Type } from '@google/genai';
import systemPromptMarkdown from '../thumbnail-engine/templates/system-prompt.md?raw';
import {
  coreRules,
  deities as deityMap,
  intents as intentMap,
  hooks as hookMap,
  getDeity as engineGetDeity,
  getIntent as engineGetIntent,
  getHook,
  getHooks,
  buildBadge,
  buildPromptBrief as engineBuildBrief,
  getDeitiesForIntent,
} from '../thumbnail-engine';
import { validateImageData } from '../thumbnail-engine/src/validator';
import type {
  DeityConfig,
  IntentConfig,
  HookPair,
  IntentKey as EngineIntentKey,
} from '../thumbnail-engine/src/types';
import {
  Deity,
  Intent,
  IntentKey,
  MantrasBrandContext,
  ThumbnailCanvaSpec,
  ThumbnailDraft,
  ThumbnailPrompt,
} from '../types';

const GEMINI_API_KEY =
  (process.env.GEMINI_API_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const TEXT_MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL_POST,
  process.env.GEMINI_MODEL_DRAFT,
  'gemini-2.5-pro',
  'gemini-2.0-flash',
].filter(Boolean) as string[];

const IMAGE_MODEL =
  (process.env.GEMINI_IMAGE_MODEL as string | undefined)?.trim() ||
  'gemini-3.1-flash-image-preview';

type GenerateContentParams = Parameters<typeof ai.models.generateContent>[0];

interface RawThumbnailPlan {
  templateId: string;
  line1: string;
  line2: string;
  badge: string;
  schoolLabel?: string;
  seoTitle?: string;
  variantPrompts: string[];
  colors: {
    line1?: string;
    line2?: string;
    badge?: string;
    brand?: string;
    aura?: string;
  };
}

interface ThumbnailValidationResult {
  isValid: boolean;
  normalizedDataUrl: string;
  notes: string[];
}

export interface ThumbnailInputSuggestion {
  title: string;
}

// ---------------------------------------------------------------------------
// Bridge: Convert new engine configs → legacy exported types
// ---------------------------------------------------------------------------

function deityConfigToLegacy(name: string, config: DeityConfig): Deity {
  return {
    name,
    channelName: config.channelName,
    auraColor: config.auraColor,
    visualSignature: config.visualSignature.join(', '),
    intents: config.intents as IntentKey[],
  };
}

function intentConfigToLegacy(key: IntentKey, config: IntentConfig): Intent {
  const hookPool = getHooks(key as EngineIntentKey);
  return {
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    color: config.color,
    mood: config.mood,
    hookWords: hookPool.map((h) => `${h.line1} ${h.line2}`),
  };
}

export const DEITIES: Deity[] = Object.entries(deityMap).map(([name, config]) =>
  deityConfigToLegacy(name, config)
);

export const MANTRAS_INTENTS: Intent[] = (Object.keys(intentMap) as IntentKey[]).map(
  (key) => intentConfigToLegacy(key, intentMap[key as EngineIntentKey])
);

const hookWordsByIntent: Record<IntentKey, string[]> = {} as Record<IntentKey, string[]>;
for (const key of Object.keys(hookMap) as IntentKey[]) {
  hookWordsByIntent[key] = hookMap[key as EngineIntentKey].map((h) => `${h.line1} ${h.line2}`);
}

export const MANTRAS_BRAND_CONTEXT: MantrasBrandContext = {
  canvas: { width: 1280, height: 720, aspect: '16:9' },
  background: ['#000000', '#0A0600', '#1A0F00'],
  rules: {
    deityPlacement: coreRules.layout.deityZone,
    style: coreRules.character.style,
    aura: 'concentric sacred rings in deity aura color',
    noText: false,
    negativeSpaceLeft: false,
    textBakedIntoImage: true,
  },
  deities: DEITIES,
  intents: MANTRAS_INTENTS,
  hookWords: hookWordsByIntent,
};

// ---------------------------------------------------------------------------
// Intent / Deity lookups (use engine, return legacy types)
// ---------------------------------------------------------------------------

const DEFAULT_BADGES: Record<IntentKey, string> = {
  abundance: '108x',
  protection: '108x',
  healing: 'Body, Mind & Soul',
  love: 'Daily Practice',
  power: '40 Days',
  peace: 'Daily Practice',
  knowledge: '108x',
  transformation: '40 Days',
};

function getIntent(intentKey: IntentKey): Intent {
  const intent = MANTRAS_INTENTS.find((i) => i.key === intentKey);
  if (!intent) throw new Error(`Unsupported thumbnail intent: ${intentKey}`);
  return intent;
}

function getDeity(name: string): Deity {
  const normalizedName = name.trim().toLowerCase();
  const deity = DEITIES.find((item) =>
    [item.name, ...(item.aliases ?? [])].some(
      (c) => c.trim().toLowerCase() === normalizedName
    )
  );
  if (!deity) throw new Error(`Unsupported deity: ${name}`);
  return deity;
}

function getChannelDeityName(deity: Deity): string {
  return deity.channelName?.trim() || deity.name;
}

function resolveAuraColor(deity: Deity): string {
  return deity.auraColor?.trim() || '#FFD700';
}

function getLine2Color(intentKey: IntentKey): string {
  return intentMap[intentKey as EngineIntentKey]?.color ?? '#FF3B3B';
}

// ---------------------------------------------------------------------------
// Gemini helpers
// ---------------------------------------------------------------------------

function isModelNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('not found') || message.includes('NOT_FOUND');
}

async function generateContentWithModelFallback(
  modelCandidates: string[],
  params: Omit<GenerateContentParams, 'model'>
) {
  let lastError: unknown;
  for (const model of modelCandidates) {
    try {
      return await ai.models.generateContent({ ...params, model });
    } catch (error) {
      lastError = error;
      if (!isModelNotFoundError(error)) throw error;
    }
  }
  throw lastError ?? new Error('No Gemini model candidates were configured');
}

// ---------------------------------------------------------------------------
// System prompt — short, structured, no giant docs
// ---------------------------------------------------------------------------

const THUMBNAIL_SYSTEM_PROMPT = `${systemPromptMarkdown}

Return strict JSON only.`;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function uppercaseClean(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}

function titleCaseFromCaps(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function extractYear(text: string): string | null {
  return text.match(/\b(20\d{2})\b/)?.[1] ?? null;
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function includesNormalized(haystack: string, needle: string): boolean {
  return normalizeTitle(haystack).toLowerCase().includes(normalizeTitle(needle).toLowerCase());
}

// ---------------------------------------------------------------------------
// Default spec builders
// ---------------------------------------------------------------------------

function getDefaultTextColors(intent: Intent, deity: Deity): ThumbnailCanvaSpec['colors'] {
  return {
    hook: '#FFFFFF',
    secondary: getLine2Color(intent.key),
    brand: '#FFD700',
    badge: 'rgba(255,255,255,0.88)',
    aura: resolveAuraColor(deity),
  };
}

function buildDefaultSeoTitle(deity: Deity, intent: Intent): string {
  const deityName = getChannelDeityName(deity);
  const titleMap: Partial<Record<IntentKey, string>> = {
    abundance: `${deityName} Mantra for 2026 Success | Remove All Obstacles & Achieve Your Goals`,
    protection: `${deityName} Mantra for Protection 2026 | Shield Yourself from Negative Energy & Start Fresh`,
    healing: `${deityName} Mantra — Healing Meditation for Body, Mind & Soul`,
    love: `${deityName} Mantra for Divine Love | Open Your Heart & Return to Joy`,
    power: `${deityName} Mantra for Strength & Fearlessness [Listen Daily for 40 Days]`,
    peace: `${deityName} Mantra for Deep Peace & Love 2026`,
    knowledge: `${deityName} Mantra for Divine Knowledge | Unlock Wisdom & Achieve Focus`,
    transformation: `${deityName} Mantra for 2026 Transformation | Release Karma & Rebirth Now`,
  };
  return titleMap[intent.key] ?? `${deityName} Mantra for 2026 | Divine Blessings`;
}

function buildAlignedSeoTitle(
  input: ThumbnailPrompt,
  deity: Deity,
  intent: Intent,
  line1: string,
  line2: string
): string {
  const deityName = getChannelDeityName(deity);
  const year = extractYear(line1);
  const benefit =
    titleCaseFromCaps(line1.replace(/\b20\d{2}\b/g, '').trim()) || titleCaseFromCaps(line1);
  const action = titleCaseFromCaps(line2);

  const leading = year
    ? `${deityName} Mantra for ${year} ${benefit}`.replace(/\s+/g, ' ').trim()
    : `${deityName} Mantra for ${benefit}`.replace(/\s+/g, ' ').trim();

  const intentOutcome: Record<IntentKey, string> = {
    abundance: 'Achieve Your Goals',
    protection: 'Start Fresh',
    healing: 'Restore Body, Mind & Soul',
    love: 'Open Your Heart',
    power: 'Build Fearlessness',
    peace: 'Calm Your Mind',
    knowledge: 'Unlock Wisdom',
    transformation: 'Rebirth Now',
  };

  const base = `${leading} | ${action}`;
  const withOutcome = `${base} & ${intentOutcome[intent.key]}`;

  const requestedTitle = normalizeTitle(input.title);
  if (
    requestedTitle &&
    includesNormalized(requestedTitle, deityName) &&
    (includesNormalized(requestedTitle, action) || includesNormalized(requestedTitle, benefit))
  ) {
    return requestedTitle;
  }

  return normalizeTitle(withOutcome);
}

function buildDefaultBadge(deity: Deity, intent: Intent): string {
  const deityName = getChannelDeityName(deity);
  const suffix = DEFAULT_BADGES[intent.key] || '108x';
  return `${deityName} Mantra · ${suffix}`;
}

function buildDefaultSpec(
  input: ThumbnailPrompt,
  intent: Intent,
  deity: Deity
): ThumbnailCanvaSpec {
  const firstHook = getHook(intent.key as EngineIntentKey, 0);
  const hookWord = uppercaseClean(`${firstHook.line1} ${firstHook.line2}`);

  return {
    hookWord,
    secondary: '',
    badge: buildDefaultBadge(deity, intent),
    schoolLabel: coreRules.text.topLabelText,
    seoTitle: buildDefaultSeoTitle(deity, intent),
    colors: getDefaultTextColors(intent, deity),
  };
}

function normalizeSpec(
  input: ThumbnailPrompt,
  intent: Intent,
  deity: Deity,
  parsedPlan: Partial<RawThumbnailPlan>
): ThumbnailCanvaSpec {
  const fallback = buildDefaultSpec(input, intent, deity);

  const rawLine1 = (parsedPlan.line1 || '').trim();
  const rawLine2 = (parsedPlan.line2 || '').trim();
  const combinedPhrase = rawLine2 ? `${rawLine1} ${rawLine2}` : rawLine1;
  const rawPhrase = combinedPhrase || fallback.hookWord;
  let hookWord = uppercaseClean(rawPhrase).split(/\s+/).slice(0, 5).join(' ');

  if (hookWord.split(/\s+/).length < 2) {
    hookWord = fallback.hookWord;
  }

  const parsedSeoTitle = (parsedPlan.seoTitle || '').trim();
  const alignedSeoTitle = buildAlignedSeoTitle(input, deity, intent, hookWord, '');
  const finalSeoTitle =
    parsedSeoTitle &&
    includesNormalized(parsedSeoTitle, getChannelDeityName(deity)) &&
    includesNormalized(parsedSeoTitle, titleCaseFromCaps(hookWord))
      ? parsedSeoTitle
      : alignedSeoTitle;

  const badgeText = (parsedPlan.badge || '').trim() || fallback.badge;
  const schoolLabel = (parsedPlan.schoolLabel || '').trim() || fallback.schoolLabel;

  return {
    hookWord,
    secondary: '',
    badge: badgeText,
    schoolLabel,
    seoTitle: finalSeoTitle || fallback.seoTitle || input.title,
    colors: {
      hook: parsedPlan.colors?.line1?.trim() || fallback.colors.hook,
      secondary: fallback.colors.secondary,
      brand: parsedPlan.colors?.brand?.trim() || fallback.colors.brand,
      badge: fallback.colors.badge,
      aura: parsedPlan.colors?.aura?.trim() || fallback.colors.aura,
    },
  };
}

// ---------------------------------------------------------------------------
// Prompt brief builder — structured values only, no giant docs
// ---------------------------------------------------------------------------

function buildPromptBrief(input: ThumbnailPrompt, intent: Intent, deity: Deity): string {
  const line2Color = getLine2Color(intent.key);
  const hookPool = getHooks(intent.key as EngineIntentKey);
  const hookSplits = hookPool
    .map((h) => `line1="${h.line1}" + line2="${h.line2}"`)
    .join(' | ');

  return [
    `Existing video title or working title: ${input.title.trim()}`,
    `Selected deity: ${input.deity.trim()}`,
    `Preferred channel naming: ${getChannelDeityName(deity)}`,
    `Selected intent: ${intent.key}`,
    `Intent mood: ${intent.mood}`,
    `Deity visual signature: ${deity.visualSignature}`,
    `Deity aura color: ${resolveAuraColor(deity)}`,
    input.special?.trim() ? `Special instruction: ${input.special.trim()}` : null,
    ``,
    `Approved hook pairs (3-5 words, 2-line split): ${hookSplits}`,
    `LINE 2 COLOR for this intent: ${line2Color}`,
    ``,
    `Badge: "${buildDefaultBadge(deity, intent)}"`,
    `School label: "${coreRules.text.topLabelText}"`,
    ``,
    `RULES:`,
    `- 3-5 words total split across line1 + line2`,
    `- line1 = command/action (WHITE, DOMINANT, 30-40% bigger)`,
    `- line2 = emotion/promise (COLORED ${line2Color}, smaller)`,
    `- NEVER leave line2 empty, NEVER fewer than 3 words total`,
    `- STRONG drop shadow on both lines`,
    `- Generate 2 meaningfully different variant prompts (emotional + intense)`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Variant prompt normalization
// ---------------------------------------------------------------------------

function normalizeVariantPrompts(
  prompts: string[],
  input: ThumbnailPrompt,
  intent: Intent,
  deity: Deity,
  spec: ThumbnailCanvaSpec
): string[] {
  const auraColor = spec.colors.aura || resolveAuraColor(deity);
  const mainPhrase = spec.hookWord;

  let finalPhrase = mainPhrase;
  if (mainPhrase.split(/\s+/).length < 2) {
    const firstHook = getHook(intent.key as EngineIntentKey, 0);
    finalPhrase = `${firstHook.line1} ${firstHook.line2}`;
  }

  const words = finalPhrase.split(/\s+/);
  const splitAt = Math.ceil(words.length / 2);
  const line1Words = words.slice(0, splitAt).join(' ');
  const line2Words = words.slice(splitAt).join(' ');
  const line2Color = getLine2Color(intent.key);

  const badgeText = spec.badge || buildDefaultBadge(deity, intent);
  const schoolLabel = spec.schoolLabel || coreRules.text.topLabelText;

  const textLayout =
    `RIGHT side text elements (baked into image): ` +
    `"${schoolLabel}" tiny white at top. ` +
    `MAIN HOOK: "${line1Words}" MASSIVE ULTRA-BOLD WHITE (#FFFFFF) — fills 70-80% right side, STRONG drop shadow. ` +
    `Below: "${line2Words}" VERY LARGE BOLD ${line2Color} — slightly smaller. STRONG drop shadow. ` +
    `"${line1Words}" 30-40% BIGGER than "${line2Words}". ` +
    `Bottom: "${badgeText}" small white.`;

  const baseInstructions =
    `${textLayout} ` +
    `YouTube thumbnail, 1280x720, 16:9. Style: photorealistic cinematic devotional. ` +
    `LEFT 40-45%: ${input.deity} EXTREME close-up, face + ONE blessing hand. Face fills 75-80%+ of left zone. Eyes BRIGHT at mobile size. ${deity.visualSignature}. ` +
    `Aura: concentric rings in ${auraColor}. Rim light in ${auraColor}. ` +
    `BACKGROUND: deep dark gradient, energy effects in ${auraColor}. No architecture. ` +
    `RIGHT 55-60%: ULTRA-DARK behind text. NO particles, NO glow behind text. ` +
    `No center composition. Do NOT render labels or descriptions — ONLY the exact words.`;

  const variantDirectives = [
    `Variant 1 — EMOTIONAL: ${textLayout} Softer expression, warm face-to-viewer connection. Subtle blessing-hand energy OR faint third-eye glow. Calmer halo. ULTRA-DARK text area.`,
    `Variant 2 — INTENSE: ${textLayout} Fiercer expression, higher contrast, stronger aura rings. Heart glow OR head pulse. More dramatic energy. ULTRA-DARK text area.`,
  ];

  const textReminder = `RENDER ONLY: "${schoolLabel}" tiny top, "${line1Words}" MASSIVE WHITE + "${line2Words}" LARGE ${line2Color} as dominant hook, "${badgeText}" small bottom. No other text.`;

  const sanitize = (raw: string): string =>
    raw
      .replace(/\btext\s*[:=]\s*"[^"]*"/gi, '')
      .replace(/\bsingle[- ]line\b/gi, '2-line hierarchy')
      .replace(/CENTER\s*[-—]\s*MAIN\s+HOOK[^.]*/gi, '')
      .replace(/\(BIGGEST[^)]*\)/gi, '')
      .replace(/\(\d+\)\s*(TOP|CENTER|BOTTOM)\s*[:—-]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

  const normalized = prompts.slice(0, 2).map((prompt, index) => {
    const cleaned = sanitize(prompt);
    return `${baseInstructions} ${variantDirectives[index] ?? ''} ${cleaned} ${textReminder}`
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3200);
  });

  while (normalized.length < 2) {
    normalized.push(
      `${baseInstructions} ${variantDirectives[normalized.length]} ${textReminder}`
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3200)
    );
  }

  return normalized;
}

// ---------------------------------------------------------------------------
// Image extraction
// ---------------------------------------------------------------------------

function extractImageFromResponse(response: unknown): string | null {
  const record = response as Record<string, unknown>;
  if (typeof record.data === 'string') return `data:image/png;base64,${record.data}`;

  const candidates = record.candidates as
    | Array<{
        content?: {
          parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
        };
      }>
    | undefined;

  const parts = candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const data = part.inlineData?.data;
    if (data) {
      const mime = part.inlineData?.mimeType || 'image/png';
      return `data:${mime};base64,${data}`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Canvas validation
// ---------------------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load generated image'));
    image.src = src;
  });
}

async function validateAndNormalizeThumbnail(
  dataUrl: string,
  _intent: Intent,
  _deity: Deity
): Promise<ThumbnailValidationResult> {
  const image = await loadImage(dataUrl);
  const targetWidth = coreRules.canvas.width;
  const targetHeight = coreRules.canvas.height;
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available in this browser');

  const scale = Math.max(targetWidth / image.width, targetHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const dx = (targetWidth - drawWidth) / 2;
  const dy = (targetHeight - drawHeight) / 2;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const validation = validateImageData(imageData, targetWidth, targetHeight);

  return {
    isValid: validation.isValid,
    normalizedDataUrl: canvas.toDataURL('image/png'),
    notes: validation.notes,
  };
}

// ---------------------------------------------------------------------------
// Public API — Quick picks
// ---------------------------------------------------------------------------

export interface HookPairUI {
  line1: string;
  line2: string;
}

export interface QuickPicksResult {
  deities: string[];
  hooks: string[];
  hookPairs: HookPairUI[];
  badgeOptions: string[];
  defaultAura: string;
}

const BADGE_OPTIONS = ['108x', '40 Days', 'Body, Mind & Soul', 'Daily Practice'];

export function getQuickPicks(intentKey: IntentKey): QuickPicksResult {
  const pairs = getHooks(intentKey as EngineIntentKey);
  return {
    deities: getDeitiesForIntent(intentKey as EngineIntentKey).slice(0, 4),
    hooks: hookWordsByIntent[intentKey]?.slice(0, 5) ?? [],
    hookPairs: pairs.slice(0, 5).map((h) => ({ line1: h.line1, line2: h.line2 })),
    badgeOptions: BADGE_OPTIONS,
    defaultAura: (() => {
      const bestDeity = getDeitiesForIntent(intentKey as EngineIntentKey)[0];
      if (!bestDeity) return '#FFD700';
      try {
        return resolveAuraColor(getDeity(bestDeity));
      } catch {
        return '#FFD700';
      }
    })(),
  };
}

export function getDeityAuraColor(deityName: string): string {
  try {
    return resolveAuraColor(getDeity(deityName));
  } catch {
    return '#FFD700';
  }
}

export function getDefaultDeityForIntent(intentKey: IntentKey): string {
  return getQuickPicks(intentKey).deities[0] ?? DEITIES[0]?.name ?? '';
}

// ---------------------------------------------------------------------------
// Public API — Suggest title
// ---------------------------------------------------------------------------

export async function suggestThumbnailInput(params: {
  deity: string;
  intent: IntentKey;
  topicSeed?: string;
}): Promise<ThumbnailInputSuggestion> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Add GEMINI_API_KEY or VITE_GEMINI_API_KEY.');
  }

  const intent = getIntent(params.intent);
  const deity = getDeity(params.deity);
  const hookPool = getHooks(params.intent as EngineIntentKey);

  const response = await generateContentWithModelFallback(TEXT_MODEL_CANDIDATES, {
    contents: [
      `Selected deity: ${deity.name}`,
      `Channel name: ${getChannelDeityName(deity)}`,
      `Intent: ${intent.key}`,
      `Deity aura: ${resolveAuraColor(deity)}`,
      `Intent mood: ${intent.mood}`,
      `Hook phrases: ${hookPool.map((h) => `${h.line1} ${h.line2}`).join(', ')}`,
      params.topicSeed?.trim() ? `Seed topic: ${params.topicSeed.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    config: {
      systemInstruction: `You are the School of Mantras YouTube strategist.

Return one recommended YouTube video title.

Rules:
- Title must be YouTube-ready and clickworthy.
- Prefer: [Deity] + for 2026 + benefit + | + action promise + positive outcome.
- Keep aligned with the selected deity and intent.
- If a seed topic is provided, refine it.
- Return strict JSON only.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: { title: { type: Type.STRING } },
        required: ['title'],
      },
    },
  });

  const text = response.text;
  if (!text) {
    return { title: buildDefaultSeoTitle(deity, intent) };
  }

  const parsed = JSON.parse(text) as Partial<ThumbnailInputSuggestion>;
  return {
    title: (parsed.title || buildDefaultSeoTitle(deity, intent)).trim(),
  };
}

// ---------------------------------------------------------------------------
// Public API — Generate thumbnail plan
// ---------------------------------------------------------------------------

export async function generateThumbnailPlan(prompt: ThumbnailPrompt): Promise<ThumbnailDraft> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Add GEMINI_API_KEY or VITE_GEMINI_API_KEY.');
  }

  const normalizedPrompt: ThumbnailPrompt = {
    title: prompt.title.trim(),
    deity: prompt.deity.trim(),
    intent: prompt.intent,
    line1: prompt.line1?.trim() || undefined,
    line2: prompt.line2?.trim() || undefined,
    badge: prompt.badge?.trim() || undefined,
    special: prompt.special?.trim() || undefined,
  };

  if (!normalizedPrompt.title) throw new Error('Video title is required.');
  if (!normalizedPrompt.deity) throw new Error('Deity is required.');

  const intent = getIntent(normalizedPrompt.intent);
  const deity = getDeity(normalizedPrompt.deity);

  const userHookHint = normalizedPrompt.line1
    ? `\n\nUser-specified hook: line1="${normalizedPrompt.line1}"${normalizedPrompt.line2 ? ` line2="${normalizedPrompt.line2}"` : ''}. Use this hook as the primary choice.`
    : '';
  const userBadgeHint = normalizedPrompt.badge
    ? `\nUser-specified badge: "${normalizedPrompt.badge}".`
    : '';

  const response = await generateContentWithModelFallback(TEXT_MODEL_CANDIDATES, {
    contents: buildPromptBrief(normalizedPrompt, intent, deity) + userHookHint + userBadgeHint,
    config: {
      systemInstruction: THUMBNAIL_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          templateId: { type: Type.STRING },
          line1: {
            type: Type.STRING,
            description:
              'COMMAND/ACTION part (first half of 3-5 word hook). Examples: "STOP THE", "OPEN YOUR". LINE 1 = BIG, WHITE, DOMINANT.',
          },
          line2: {
            type: Type.STRING,
            description:
              'EMOTION/PROMISE part (second half). Examples: "PAIN NOW", "HEART". MUST NOT be empty. LINE 2 = smaller, COLORED.',
          },
          badge: { type: Type.STRING },
          schoolLabel: { type: Type.STRING },
          seoTitle: { type: Type.STRING },
          variantPrompts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              'Exactly 2 image prompts. Each references line1+line2 as 2-LINE hierarchy.',
          },
          colors: {
            type: Type.OBJECT,
            properties: {
              line1: { type: Type.STRING },
              line2: { type: Type.STRING },
              badge: { type: Type.STRING },
              brand: { type: Type.STRING },
              aura: { type: Type.STRING },
            },
          },
        },
        required: ['templateId', 'line1', 'line2', 'badge', 'variantPrompts', 'colors'],
      },
    },
  });

  const planText = response.text;
  if (!planText) throw new Error('Gemini returned an empty thumbnail plan.');

  const parsedPlan = JSON.parse(planText) as RawThumbnailPlan;
  const textSpec = normalizeSpec(normalizedPrompt, intent, deity, parsedPlan);
  const generationPrompts = normalizeVariantPrompts(
    parsedPlan.variantPrompts ?? [],
    normalizedPrompt,
    intent,
    deity,
    textSpec
  );

  return {
    id: crypto.randomUUID(),
    status: 'draft',
    prompt: normalizedPrompt,
    baseImages: [],
    canvaSpec: textSpec,
    createdAt: new Date(),
    generationPrompts,
    templateId: parsedPlan.templateId,
  };
}

// ---------------------------------------------------------------------------
// Public API — Generate thumbnail images
// ---------------------------------------------------------------------------

export async function generateThumbnailImages(plan: ThumbnailDraft): Promise<ThumbnailDraft> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Add GEMINI_API_KEY or VITE_GEMINI_API_KEY.');
  }

  const prompts = plan.generationPrompts ?? [];
  if (prompts.length === 0) throw new Error('No generation prompts in the plan.');

  const intent = getIntent(plan.prompt.intent);
  const deity = getDeity(plan.prompt.deity);

  const rawImages = await Promise.all(
    prompts.map(async (variantPrompt) => {
      const imageResponse = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: variantPrompt,
        config: { responseModalities: ['TEXT', 'IMAGE'] },
      });

      const imageDataUrl = extractImageFromResponse(imageResponse);
      if (!imageDataUrl) throw new Error('Image generation returned no inline image data.');
      return imageDataUrl;
    })
  );

  const validations = await Promise.all(
    rawImages.map((img) => validateAndNormalizeThumbnail(img, intent, deity))
  );

  const validImages = validations.filter((r) => r.isValid).map((r) => r.normalizedDataUrl);
  const fallbackImages = validations.map((r) => r.normalizedDataUrl);
  const validationSummary = validations.flatMap((r, i) =>
    r.notes.map((note) => `Variant ${i + 1}: ${note}`)
  );

  return {
    ...plan,
    status: validImages.length > 0 ? 'ready' : 'error',
    baseImages: validImages.length > 0 ? validImages : fallbackImages,
    validationSummary,
    errorMessage:
      validImages.length > 0
        ? undefined
        : 'Variants did not pass layout heuristics. Review previews or regenerate.',
  };
}

// ---------------------------------------------------------------------------
// Public API — Combined plan + generate
// ---------------------------------------------------------------------------

export async function generateThumbnailDraft(prompt: ThumbnailPrompt): Promise<ThumbnailDraft> {
  const plan = await generateThumbnailPlan(prompt);
  return generateThumbnailImages(plan);
}
