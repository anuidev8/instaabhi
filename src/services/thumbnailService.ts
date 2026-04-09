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
  if (deity) return deity;

  const displayName = name.trim() || 'Divine Being';
  return {
    name: displayName,
    channelName: displayName,
    visualSignature: `${displayName} in traditional iconography, divine radiance, blessing hand, sacred ornaments`,
    intents: ['protection', 'healing', 'peace', 'abundance', 'power', 'love', 'knowledge', 'transformation'],
    auraColor: '#FFD700',
  };
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

  const userLine1 = (input.line1 || '').trim();
  const userLine2 = (input.line2 || '').trim();
  const userProvided = userLine1.length > 0;

  const effectiveLine1 = userProvided ? userLine1 : (parsedPlan.line1 || '').trim();
  const effectiveLine2 = userProvided ? userLine2 : (parsedPlan.line2 || '').trim();
  const combinedPhrase = effectiveLine2 ? `${effectiveLine1} ${effectiveLine2}` : effectiveLine1;
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
    `- line1 = command/action (WHITE, DOMINANT, 50-60% bigger than line2)`,
    `- line2 = emotion/promise (COLORED ${line2Color}, very large but smaller than line1)`,
    `- NEVER leave line2 empty, NEVER fewer than 3 words total`,
    `- Each word stacked vertically like a billboard — text fills 85-95% of right zone height`,
    `- FIRST WORD is the ABSOLUTE BIGGEST (20-30% bigger than second word), extends LEFT into deity zone — NO gap between deity and text`,
    `- Line-2 words are 40-50% smaller than the first word`,
    `- Font: ultra-heavy black condensed (weight 900+)`,
    `- 3D EXTRUDED text effect: thick black drop-shadow (8-12px) creating cinematic depth/pop-out look`,
    `- 3D parallax: deity overlaps ON TOP of first word's left letters; colored text overlaps ON TOP of deity lower body`,
    `- Background: dark atmospheric smoke/mist — NOT bright glowing circles`,
    `- Aura: subtle rim-light and atmospheric haze — NOT prominent concentric rings`,
    `- Generate exactly 1 image prompt combining emotional depth with cinematic intensity`,
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

  const allWords = words.map((w) => w.toUpperCase());
  const stackedWordList = allWords.join('", "');

  const textLayout =
    `RIGHT side text (baked into the image, stacked vertically like a billboard): ` +
    `Top: "${schoolLabel}" — tiny, thin, subtle white. ` +
    `MAIN HOOK — EACH WORD on its own line, stacked vertically, filling 85-95% of the right side HEIGHT — use the FULL vertical space: ` +
    `"${stackedWordList}" — the line-1 words ("${line1Words}") are WHITE (#FFFFFF), the line-2 words ("${line2Words}") are ${line2Color}. ` +
    `Font: ULTRA-HEAVY BLACK CONDENSED (weight 900+), wide compressed letterforms. ` +
    `SIZE HIERARCHY — the FIRST WORD ("${allWords[0]}") is the ABSOLUTE BIGGEST element in the entire image. It must be noticeably larger than every other word (20-30% bigger than the second word). ` +
    `The first word EXTENDS LEFT past the text zone boundary, overlapping INTO the deity area — its left edge starts behind/under the deity's body. There must be NO empty gap between the deity and the first word. ` +
    `Remaining line-1 words are large but slightly smaller than the first word. Line-2 words ("${line2Words}") are ${line2Color} and 40-50% smaller than the first word. ` +
    `3D EXTRUDED TEXT EFFECT: each letter has a thick black drop-shadow (8-12px offset below-right) creating a cinematic pop-out/depth look. ` +
    `Bottom: "${badgeText}" — small, understated white.`;

  const depthLayering =
    `3D PARALLAX DEPTH LAYERING (CRITICAL): The image must have interleaving z-layers creating real depth: ` +
    `(1) BACK LAYER: dark atmospheric background. ` +
    `(2) MID LAYER: the main hook text — the first word ("${allWords[0]}") extends LEFT into the deity zone with NO gap. ` +
    `(3) FRONT LAYER: parts of the deity (hand, snake, jewelry, accessories) overlap ON TOP of the first word's left portion, partially covering its first 1-2 letters. ` +
    `(4) ALSO: the line-2 / colored text ("${line2Words}") overlaps slightly ON TOP of the deity's lower body/torso area, sitting in front of the character. ` +
    `This interweaving — deity elements in front of some text, text in front of other deity parts — creates the cinematic parallax 3D effect. ` +
    `IMPORTANT: The text and deity SHARE the same horizontal space. Do NOT leave a clean gap between the deity and the text.`;

  const baseInstructions =
    `${textLayout} ` +
    `${depthLayering} ` +
    `YouTube thumbnail, 1280x720, 16:9. Style: photorealistic cinematic devotional. ` +
    `LEFT 35-45%: ${input.deity} EXTREME close-up, face + ONE blessing hand. Face fills 75-80%+ of left zone. Eyes BRIGHT at mobile size. ${deity.visualSignature}. ` +
    `Aura: subtle atmospheric haze and rim-light in ${auraColor} — NOT prominent glowing concentric rings or circles. ` +
    `BACKGROUND: dark atmospheric smoke/mist gradient in near-black tones with hints of ${auraColor}. No architecture. No bright glowing circles. ` +
    `The text area behind the words should be ULTRA-DARK. NO particles, NO glow, NO bloom behind text. ` +
    `No center composition. Do NOT render labels or descriptions — ONLY the exact words specified above. ` +
    `CRITICAL: The first word must be ENORMOUS and push LEFT into the deity zone. Every word stretches to the right edge. Think movie-poster / billboard scale, readable even as a tiny phone thumbnail.`;

  const styleDirective =
    `Emotional depth with cinematic intensity: warm devotional expression with strong contrast and dramatic rim-light in ${auraColor}. ` +
    `Subtle blessing-hand energy or third-eye glow. Atmospheric smoky haze. ULTRA-DARK behind text. ` +
    `Deity overlaps on top of first word's left edge. NO gap between deity and text.`;

  const textReminder =
    `TEXT FINAL CHECK — render ONLY these exact words: "${schoolLabel}" tiny top. ` +
    `"${allWords[0]}" = ABSOLUTE BIGGEST word, extends LEFT into deity zone, NO gap between deity and text. ` +
    `Hook words stacked: "${stackedWordList}". "${line1Words}" = WHITE, "${line2Words}" = ${line2Color}. ` +
    `Deity hand/accessories overlap ON TOP of "${allWords[0]}" left edge. Colored text overlaps ON TOP of deity lower body. ` +
    `3D extruded shadow on every letter. "${badgeText}" small bottom. NO other text. NO thin fonts. NO small text.`;

  const sanitize = (raw: string): string =>
    raw
      .replace(/\btext\s*[:=]\s*"[^"]*"/gi, '')
      .replace(/\bsingle[- ]line\b/gi, '2-line hierarchy')
      .replace(/CENTER\s*[-—]\s*MAIN\s+HOOK[^.]*/gi, '')
      .replace(/\(BIGGEST[^)]*\)/gi, '')
      .replace(/\(\d+\)\s*(TOP|CENTER|BOTTOM)\s*[:—-]/gi, '')
      .replace(/\bconcentric\s+rings?\b/gi, 'atmospheric haze')
      .replace(/\s+/g, ' ')
      .trim();

  const firstRaw = prompts[0] ?? '';
  const cleaned = sanitize(firstRaw);
  const finalPrompt = `${baseInstructions} ${styleDirective} ${cleaned} ${textReminder}`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3800);

  return [finalPrompt];
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
              'Exactly 1 image prompt referencing line1+line2 as 2-LINE hierarchy with 3D extruded billboard text.',
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
