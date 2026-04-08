import { GoogleGenAI, Type } from '@google/genai';
import brandGuideMarkdown from '../context/mantras/mantras-brand-guide.md?raw';
import promptTemplatesMarkdown from '../context/mantras/prompt-templates.md?raw';
import nanoBananaMarkdown from '../context/mantras/api/nano-banana.md?raw';
import mantrasContextRaw from '../context/mantras/deities-intents.json?raw';
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

type MantrasContextPayload = MantrasBrandContext;

const MANTRAS_CONTEXT = JSON.parse(mantrasContextRaw) as MantrasContextPayload;

export const MANTRAS_BRAND_CONTEXT: MantrasBrandContext = MANTRAS_CONTEXT;
export const MANTRAS_INTENTS: Intent[] = MANTRAS_CONTEXT.intents;
export const DEITIES: Deity[] = MANTRAS_CONTEXT.deities;

const ACTION_PROMISES: Record<IntentKey, string[]> = {
  abundance: ['REMOVE OBSTACLES', 'ACHIEVE YOUR GOALS', 'ATTRACT ABUNDANCE', 'OPEN SUCCESS'],
  protection: ['SHIELD YOURSELF', 'REMOVE NEGATIVE ENERGY', 'STAY PROTECTED', 'START FRESH'],
  healing: ['HEAL BODY & SOUL', 'PURIFY YOUR MIND', 'RESTORE YOUR ENERGY', 'RESET DEEPLY'],
  love: ['OPEN YOUR HEART', 'ATTRACT DIVINE LOVE', 'RETURN TO JOY', 'FEEL DEVOTION'],
  power: ['CLAIM YOUR POWER', 'ACTIVATE COURAGE', 'RISE FEARLESS', 'AWAKEN STRENGTH'],
  peace: ['CALM YOUR MIND', 'ENTER STILLNESS', 'REST IN PEACE', 'SOOTHE YOUR SOUL'],
  knowledge: ['GAIN CLARITY', 'UNLOCK WISDOM', 'SEE THE TRUTH', 'ACHIEVE FOCUS'],
  transformation: ['RELEASE KARMA', 'DESTROY OBSTACLES', 'TRANSFORM FAST', 'REBIRTH NOW'],
};

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

const LINE2_COLOR_BY_INTENT: Record<IntentKey, string> = {
  abundance: '#FF8C00',
  protection: '#0066FF',
  healing: '#FF2222',
  love: '#FFD700',
  power: '#FF6600',
  peace: '#F3F6FA',
  knowledge: '#FFD700',
  transformation: '#FF2222',
};

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
      return await ai.models.generateContent({
        ...params,
        model,
      });
    } catch (error) {
      lastError = error;
      if (!isModelNotFoundError(error)) throw error;
    }
  }

  throw lastError ?? new Error('No Gemini model candidates were configured');
}

const THUMBNAIL_SYSTEM_PROMPT = `You are the School of Mantras thumbnail strategist, copywriter, and image prompt engineer.

You create final YouTube thumbnails with the full text already rendered in the image.

Create a high-converting, viral YouTube thumbnail based on our project context.
Leverage our internal knowledge base to align with brand identity, audience psychology, and content strategy.

The thumbnail should:
- Capture attention instantly (bold visuals, high contrast, emotional trigger).
- Clearly communicate the video's core idea in less than 1 second.
- Be optimized for high CTR (click-through rate).
- Follow proven viral thumbnail patterns (strong face/hero presence, expression intensity when appropriate, curiosity gap, minimal text).
- Stay consistent with our brand colors, tone, and positioning.

Include:
- Main visual concept.
- Text overlay only if needed (keep minimal).
- Color and composition suggestions.
- Emotional trigger (curiosity, surprise, urgency, protection, transformation, devotion, or peace as appropriate).

${brandGuideMarkdown}

${promptTemplatesMarkdown}

${nanoBananaMarkdown}

Brand context JSON:
${JSON.stringify(MANTRAS_BRAND_CONTEXT)}

Non-negotiable rules:
- Generate exactly 2 self-contained image prompts for 2 final thumbnail variants.
- Each prompt must create a 1280x720 thumbnail with the deity on the LEFT 40-55% of frame.
- The RIGHT side must contain the main text block rendered directly in the image.
- Use the proven channel formulas from the guide, especially year hook + benefit + action promise when relevant.
- The line-2 color should follow the selected intent system from the guide.
- The aura must stay faithful to the chosen deity reference and can be supported by the selected intent mood.
- Return the text plan separately as line1 and line2 and also use it inside the variant prompts.
- Never center the deity.
- Never place the main deity on the right side.
- Text must be large, crisp, legible, and spelled exactly.
- Do NOT add any extra labels, logos, watermarks, channel tags, or badges.
- Do NOT add top-left "SCHOOL OF MANTRAS".
- Do NOT add bottom badges like "Ganesh Mantra · 108x" or similar.
- Keep typography premium and clean: strong hierarchy, precise spacing, high contrast, minimal clutter.

Return strict JSON only.`;

function uppercaseClean(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}

function titleCaseFromCaps(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function extractYear(text: string): string | null {
  const match = text.match(/\b(20\d{2})\b/);
  return match?.[1] ?? null;
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function includesNormalized(haystack: string, needle: string): boolean {
  return normalizeTitle(haystack).toLowerCase().includes(normalizeTitle(needle).toLowerCase());
}

function getIntent(intentKey: IntentKey): Intent {
  const intent = MANTRAS_INTENTS.find((item) => item.key === intentKey);
  if (!intent) throw new Error(`Unsupported thumbnail intent: ${intentKey}`);
  return intent;
}

function getDeity(name: string): Deity {
  const normalizedName = name.trim().toLowerCase();
  const deity = DEITIES.find((item) =>
    [item.name, ...(item.aliases ?? [])].some((candidate) => candidate.trim().toLowerCase() === normalizedName)
  );
  if (!deity) throw new Error(`Unsupported deity: ${name}`);
  return deity;
}

function getChannelDeityName(deity: Deity): string {
  return deity.channelName?.trim() || deity.name;
}

function resolveAuraColor(deity: Deity, intent: Intent): string {
  return deity.auraColor?.trim() || intent.color;
}

function resolveAuraPrompt(deity: Deity, intent: Intent, auraColor: string): string {
  const auraStyle = deity.auraStyle?.trim();
  const deityAura = deity.auraColor?.trim();

  if (auraStyle) {
    if (deityAura && deityAura.toLowerCase() !== intent.color.toLowerCase()) {
      return `${auraStyle}, supported by a restrained ${intent.color} intent accent where it strengthens the selected mood`;
    }
    return auraStyle;
  }

  if (deityAura && deityAura.toLowerCase() !== intent.color.toLowerCase()) {
    return `${deityAura} deity-faithful aura with a subtle ${intent.color} intent support glow`;
  }

  return `${auraColor} aura`;
}

function getDefaultTextColors(intent: Intent, deity: Deity): ThumbnailCanvaSpec['colors'] {
  return {
    hook: '#FFFFFF',
    secondary: LINE2_COLOR_BY_INTENT[intent.key],
    brand: '#FFD700',
    badge: 'rgba(255,255,255,0.88)',
    aura: resolveAuraColor(deity, intent),
  };
}

function buildDefaultSeoTitle(deity: Deity, intent: Intent): string {
  const deityName = getChannelDeityName(deity);

  switch (intent.key) {
    case 'abundance':
      return `${deityName} Mantra for 2026 Success | Remove All Obstacles & Achieve Your Goals`;
    case 'protection':
      return `${deityName} Mantra for Protection 2026 | Shield Yourself from Negative Energy & Start Fresh`;
    case 'healing':
      return `${deityName} Mantra — Healing Meditation for Body, Mind & Soul`;
    case 'love':
      return `${deityName} Mantra for Divine Love | Open Your Heart & Return to Joy`;
    case 'power':
      return `${deityName} Mantra for Strength & Fearlessness [Listen Daily for 40 Days]`;
    case 'peace':
      return `${deityName} Mantra for Deep Peace & Love 2026`;
    case 'knowledge':
      return `${deityName} Mantra for Divine Knowledge | Unlock Wisdom & Achieve Focus`;
    case 'transformation':
      return `${deityName} Mantra for 2026 Transformation | Release Karma & Rebirth Now`;
    default:
      return `${deityName} Mantra for 2026 ${intent.label.split('/')[0].trim()} | Divine Blessings`;
  }
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
  const benefit = titleCaseFromCaps(line1.replace(/\b20\d{2}\b/g, '').trim()) || titleCaseFromCaps(line1);
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

function buildDefaultSpec(input: ThumbnailPrompt, intent: Intent, deity: Deity): ThumbnailCanvaSpec {
  const hookWord = uppercaseClean(MANTRAS_BRAND_CONTEXT.hookWords[intent.key][0] ?? `${new Date().getFullYear()} ${intent.label}`);
  const secondary = uppercaseClean(ACTION_PROMISES[intent.key][0] ?? 'REMOVE OBSTACLES');

  return {
    hookWord,
    secondary,
    badge: '',
    schoolLabel: '',
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

  const hookWord = uppercaseClean(parsedPlan.line1 || fallback.hookWord);
  const secondary = uppercaseClean(parsedPlan.line2 || fallback.secondary);
  const parsedSeoTitle = (parsedPlan.seoTitle || '').trim();
  const alignedSeoTitle = buildAlignedSeoTitle(input, deity, intent, hookWord, secondary);
  const finalSeoTitle =
    parsedSeoTitle &&
    includesNormalized(parsedSeoTitle, getChannelDeityName(deity)) &&
    (includesNormalized(parsedSeoTitle, titleCaseFromCaps(secondary)) ||
      includesNormalized(parsedSeoTitle, titleCaseFromCaps(hookWord)))
      ? parsedSeoTitle
      : alignedSeoTitle;

  return {
    hookWord,
    secondary,
    badge: '',
    schoolLabel: '',
    seoTitle: finalSeoTitle || fallback.seoTitle || input.title,
    colors: {
      hook: parsedPlan.colors?.line1?.trim() || fallback.colors.hook,
      secondary: parsedPlan.colors?.line2?.trim() || fallback.colors.secondary,
      brand: parsedPlan.colors?.brand?.trim() || fallback.colors.brand,
      badge: parsedPlan.colors?.badge?.trim() || fallback.colors.badge,
      aura: parsedPlan.colors?.aura?.trim() || fallback.colors.aura,
    },
  };
}

function buildDefaultSuggestedTitle(deity: Deity, intent: Intent): string {
  return buildDefaultSeoTitle(deity, intent);
}

function buildDefaultSpecialInstruction(deity: Deity, intent: Intent): string {
  return [
    deity.auraStyle?.trim() || `${resolveAuraColor(deity, intent)} aura`,
    'dramatic rim light from above',
    'mist at base with soft bokeh particles',
    deity.visualSignature.split(',').slice(0, 2).join(', ').trim(),
    `${DEFAULT_BADGES[intent.key]} ritual intensity`,
  ].join(', ');
}

function buildPromptBrief(input: ThumbnailPrompt, intent: Intent, deity: Deity) {
  return [
    `Existing video title or working title: ${input.title.trim()}`,
    `Selected deity: ${input.deity.trim()}`,
    `Preferred channel naming: ${getChannelDeityName(deity)}`,
    `Selected intent: ${intent.key} (${intent.label})`,
    `Intent mood: ${intent.mood}`,
    `Deity signature: ${deity.visualSignature}`,
    `Deity aura reference: ${resolveAuraPrompt(deity, intent, resolveAuraColor(deity, intent))}`,
    input.special?.trim() ? `Special instruction or badge hint: ${input.special.trim()}` : null,
    `Allowed viral hook words: ${intent.hookWords.join(', ')}`,
    `Action promise options: ${ACTION_PROMISES[intent.key].join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

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

  const response = await generateContentWithModelFallback(TEXT_MODEL_CANDIDATES, {
    contents: [
      `Selected deity: ${deity.name}`,
      `Preferred channel naming: ${getChannelDeityName(deity)}`,
      `Selected intent: ${intent.key} (${intent.label})`,
      `Deity signature: ${deity.visualSignature}`,
      `Deity aura reference: ${resolveAuraPrompt(deity, intent, resolveAuraColor(deity, intent))}`,
      `Intent mood: ${intent.mood}`,
      `High-performing hook words: ${intent.hookWords.join(', ')}`,
      `Action phrases: ${ACTION_PROMISES[intent.key].join(', ')}`,
      params.topicSeed?.trim() ? `Seed topic or draft title: ${params.topicSeed.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    config: {
      systemInstruction: `You are the School of Mantras YouTube strategist.

Use the local channel knowledge and proven formulas from this guide:
${brandGuideMarkdown}

Return one recommended YouTube video title.

Rules:
- Title must be YouTube-ready and clickworthy.
- Prefer the proven structure: [Deity] + for 2026 + benefit + | + action promise + positive outcome.
- Keep it aligned with the selected deity and intent.
- If a seed topic is provided, refine it instead of ignoring it.
- Keep one clear promise chain only: avoid stacking unrelated claims.
- Ensure title wording can directly map to thumbnail text (line 1 = core benefit, line 2 = action phrase).
- Return strict JSON only.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
        },
        required: ['title'],
      },
    },
  });

  const text = response.text;
  if (!text) {
    return {
      title: buildDefaultSuggestedTitle(deity, intent),
    };
  }

  const parsed = JSON.parse(text) as Partial<ThumbnailInputSuggestion>;
  return {
    title: (parsed.title || buildDefaultSuggestedTitle(deity, intent)).trim(),
  };
}

function normalizeVariantPrompts(
  prompts: string[],
  input: ThumbnailPrompt,
  intent: Intent,
  deity: Deity,
  spec: ThumbnailCanvaSpec
): string[] {
  const auraColor = spec.colors.aura || resolveAuraColor(deity, intent);
  const auraPrompt = resolveAuraPrompt(deity, intent, auraColor);
  const baseInstructions =
    `Single final YouTube thumbnail, exactly 1280x720, 16:9 horizontal. ` +
    `Main deity ${input.deity} occupies the LEFT 40-55% of frame. ` +
    `Deity signature: ${deity.visualSignature}. ` +
    `Character fidelity: preserve canonical ${deity.name} attributes exactly and do not mix iconography from other deities. ` +
    `Style: photorealistic cinematic devotional, never cartoon. ` +
    `Background: very dark black or intent-matched dark gradient with cinematic depth, mist, particles, and bokeh. ` +
    `Lighting: dramatic rim lighting from above/behind deity, high contrast. ` +
    `Aura behind deity: ${auraPrompt}. ` +
    `Keep a subtle gold divine accent on ornaments, particles, or trim where appropriate. ` +
    `On the RIGHT side, render the text directly into the image with exact spelling and strong readability. ` +
    `RIGHT line 1 large bold condensed in ${spec.colors.hook}: "${spec.hookWord}". ` +
    `RIGHT line 2 bold in ${spec.colors.secondary}: "${spec.secondary}". ` +
    `No extra text beyond those 2 lines. ` +
    `Never add logos, watermarks, channel tags, top-left labels, or bottom badges. ` +
    `No center composition and no deity on the right.`;

  const variantDirectives = [
    'Variant 1: closest to the proven winner layout and safest CTR composition.',
    'Variant 2: stronger aura, stronger contrast, slightly more cinematic drama.',
  ];

  const normalized = prompts
    .slice(0, 2)
    .map((prompt, index) =>
      `${baseInstructions} ${variantDirectives[index] ?? ''} ${prompt}`.replace(/\s+/g, ' ').trim().slice(0, 1800)
    );

  while (normalized.length < 2) {
    normalized.push(
      `${baseInstructions} ${variantDirectives[normalized.length]} Use the proven channel formula and make the typography perfectly legible.`
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1800)
    );
  }

  return normalized;
}

function extractImageFromNanoBananaResponse(response: unknown): string | null {
  const record = response as Record<string, unknown>;
  if (typeof record.data === 'string') return `data:image/png;base64,${record.data}`;

  const candidates = record.candidates as Array<{
    content?: {
      parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
    };
  }> | undefined;

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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load generated image'));
    image.src = src;
  });
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }

    h /= 6;
  }

  return { h: h * 360, s, l };
}

function isHueNear(hue: number, target: number, tolerance: number): boolean {
  const diff = Math.abs(hue - target);
  return Math.min(diff, 360 - diff) <= tolerance;
}

function hueFromHex(hex: string | undefined): number | null {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex.trim())) return null;

  const normalized = hex.trim();
  return rgbToHsl(
    parseInt(normalized.slice(1, 3), 16),
    parseInt(normalized.slice(3, 5), 16),
    parseInt(normalized.slice(5, 7), 16)
  ).h;
}

async function validateAndNormalizeThumbnail(
  dataUrl: string,
  intent: Intent,
  deity: Deity
): Promise<ThumbnailValidationResult> {
  const image = await loadImage(dataUrl);
  const targetWidth = MANTRAS_BRAND_CONTEXT.canvas.width;
  const targetHeight = MANTRAS_BRAND_CONTEXT.canvas.height;
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas is not available in this browser');
  }

  const scale = Math.max(targetWidth / image.width, targetHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const dx = (targetWidth - drawWidth) / 2;
  const dy = (targetHeight - drawHeight) / 2;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);

  const { data, width, height } = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const targetHues = [hueFromHex(intent.color), hueFromHex(deity.auraColor)].filter(
    (value): value is number => value !== null
  );

  let totalLuminance = 0;
  let sampleCount = 0;

  let leftSignal = 0;
  let leftSamples = 0;
  let centerSignal = 0;
  let centerSamples = 0;
  let rightTextSignal = 0;
  let rightSamples = 0;

  for (let y = 0; y < height; y += 6) {
    for (let x = 0; x < width; x += 6) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const { h, s, l } = rgbToHsl(r, g, b);

      const isGold = isHueNear(h, 45, 20) && s >= 0.25 && l >= 0.35;
      const isIntentAccent = targetHues.some((targetHue) => isHueNear(h, targetHue, 24)) && s >= 0.25 && l >= 0.28;
      const isWhiteTextLike = s <= 0.16 && l >= 0.72;
      const brightSignal = luminance >= 170 ? 1 : 0;
      const accentSignal = isGold || isIntentAccent ? 1 : 0;
      const textSignal = (isWhiteTextLike ? 1 : 0) + accentSignal + brightSignal;

      totalLuminance += luminance;
      sampleCount += 1;

      if (x < width * 0.4) {
        leftSamples += 1;
        leftSignal += accentSignal + brightSignal * 0.45;
      } else if (x > width * 0.6) {
        rightSamples += 1;
        rightTextSignal += textSignal;
      } else {
        centerSamples += 1;
        centerSignal += accentSignal + brightSignal * 0.35;
      }
    }
  }

  const averageLuminance = totalLuminance / Math.max(sampleCount, 1);
  const leftHeroSignal = leftSignal / Math.max(leftSamples, 1);
  const rightTypographySignal = rightTextSignal / Math.max(rightSamples, 1);
  const centerBusySignal = centerSignal / Math.max(centerSamples, 1);

  const isDarkEnough = averageLuminance <= 135;
  const hasLeftHero = leftHeroSignal >= 0.08;
  const hasRightTextBlock = rightTypographySignal >= 0.12;
  const avoidsCenteredComposition = centerBusySignal <= leftHeroSignal * 1.15;

  const notes = [
    isDarkEnough
      ? 'Dark background heuristic passed.'
      : 'Background is brighter than the guide allows.',
    hasLeftHero
      ? 'Left-side deity/focal-energy heuristic passed.'
      : 'Left-side deity emphasis looks weaker than the guide target.',
    hasRightTextBlock
      ? 'Right-side baked-text heuristic passed.'
      : 'Right-side text block may be too weak, missing, or unreadable.',
    avoidsCenteredComposition
      ? 'Center-composition heuristic passed.'
      : 'Image may be drifting toward a centered composition.',
  ];

  return {
    isValid: isDarkEnough && hasLeftHero && hasRightTextBlock && avoidsCenteredComposition,
    normalizedDataUrl: canvas.toDataURL('image/png'),
    notes,
  };
}

export function getQuickPicks(intentKey: IntentKey): { deities: string[]; hooks: string[] } {
  return {
    deities: DEITIES.filter((deity) => deity.intents.includes(intentKey))
      .map((deity) => deity.name)
      .slice(0, 4),
    hooks: MANTRAS_BRAND_CONTEXT.hookWords[intentKey].slice(0, 5),
  };
}

export function getDefaultDeityForIntent(intentKey: IntentKey): string {
  return getQuickPicks(intentKey).deities[0] ?? DEITIES[0]?.name ?? '';
}

export async function generateThumbnailDraft(prompt: ThumbnailPrompt): Promise<ThumbnailDraft> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Add GEMINI_API_KEY or VITE_GEMINI_API_KEY.');
  }

  const normalizedPrompt: ThumbnailPrompt = {
    title: prompt.title.trim(),
    deity: prompt.deity.trim(),
    intent: prompt.intent,
    special: prompt.special?.trim() || undefined,
  };

  if (!normalizedPrompt.title) throw new Error('Video title is required.');
  if (!normalizedPrompt.deity) throw new Error('Deity is required.');

  const intent = getIntent(normalizedPrompt.intent);
  const deity = getDeity(normalizedPrompt.deity);

  const response = await generateContentWithModelFallback(TEXT_MODEL_CANDIDATES, {
    contents: buildPromptBrief(normalizedPrompt, intent, deity),
    config: {
      systemInstruction: THUMBNAIL_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          templateId: { type: Type.STRING },
          line1: { type: Type.STRING },
          line2: { type: Type.STRING },
          badge: { type: Type.STRING },
          schoolLabel: { type: Type.STRING },
          seoTitle: { type: Type.STRING },
          variantPrompts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
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

  const rawImages = await Promise.all(
    generationPrompts.map(async (variantPrompt) => {
      const imageResponse = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: variantPrompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      const imageDataUrl = extractImageFromNanoBananaResponse(imageResponse);
      if (!imageDataUrl) throw new Error('Gemini image generation returned no inline image data.');
      return imageDataUrl;
    })
  );

  const validations = await Promise.all(rawImages.map((image) => validateAndNormalizeThumbnail(image, intent, deity)));
  const validImages = validations.filter((result) => result.isValid).map((result) => result.normalizedDataUrl);
  const fallbackImages = validations.map((result) => result.normalizedDataUrl);
  const validationSummary = validations.flatMap((result, index) =>
    result.notes.map((note) => `Variant ${index + 1}: ${note}`)
  );

  return {
    id: crypto.randomUUID(),
    status: validImages.length > 0 ? 'ready' : 'error',
    prompt: normalizedPrompt,
    baseImages: validImages.length > 0 ? validImages : fallbackImages,
    canvaSpec: textSpec,
    createdAt: new Date(),
    generationPrompts,
    templateId: parsedPlan.templateId,
    errorMessage:
      validImages.length > 0
        ? undefined
        : 'Generated variants did not pass the guide-aligned layout heuristics. Review the previews or regenerate.',
    validationSummary,
  };
}
