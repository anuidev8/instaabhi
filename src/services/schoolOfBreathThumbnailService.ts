import { GoogleGenAI, Type } from '@google/genai';
import {
  DEFAULT_SOB_VARIANT_COUNT,
  buildSobPromptVariantsFromRenderSpec,
  buildSobRenderSpec,
  getAbhiReferenceImageUrls,
  getLayoutCompositionReferenceUrl,
  getSobDefaultMode,
  getSobDefaultLayoutStyle,
  getSobDefaultTopic,
  getSobHookOptions,
  isSobHookChannelProven,
  getSobPromptContext,
  getSobTopics,
  getSobTopicConfig,
  SobLayoutStyle,
  SobMode,
  SobTopicKey,
  validateSobInput,
} from '../thumbnail-engine/sob';
import type { SobRenderSpec } from '../thumbnail-engine/sob';
import { IntentKey, ThumbnailCanvaSpec, ThumbnailDraft, ThumbnailPrompt } from '../types';

const GEMINI_API_KEY =
  (process.env.GEMINI_API_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();

const IMAGE_MODEL =
  (process.env.GEMINI_IMAGE_MODEL as string | undefined)?.trim() ||
  'gemini-3.1-flash-image-preview';

const IMAGE_MODEL_CANDIDATES = Array.from(
  new Set([IMAGE_MODEL, 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'])
);
const TEXT_MODEL_CANDIDATES = [
  (process.env.GEMINI_MODEL_POST as string | undefined)?.trim(),
  (process.env.GEMINI_MODEL_DRAFT as string | undefined)?.trim(),
  'gemini-2.5-pro',
  'gemini-2.0-flash',
].filter(Boolean) as string[];
const IMAGE_GENERATION_MAX_ATTEMPTS = 2;
const MAX_ABHI_REFERENCE_IMAGES = 4;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
type GenerateContentParams = Parameters<typeof ai.models.generateContent>[0];

type InlineImagePart = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

let cachedAbhiReferenceParts: InlineImagePart[] | null = null;
let cachedAbhiReferencePromise: Promise<InlineImagePart[]> | null = null;
const cachedCompositionReferenceParts = new Map<string, InlineImagePart>();
const cachedCompositionReferencePromises = new Map<string, Promise<InlineImagePart | null>>();

export interface SchoolOfBreathThumbnailInput {
  title: string;
  topic: SobTopicKey;
  mode: SobMode;
  hook: string;
  layoutStyle?: SobLayoutStyle;
  topStripOverride?: string;
  ctaOverride?: string;
  specialNote?: string;
}

export interface SchoolOfBreathThumbnailSuggestion {
  title: string;
  hooks: [string, string, string];
  topLine: string;
  hookOverride?: string;
  topStripOverride?: string;
  ctaOverride?: string;
}

export const SOB_THUMBNAIL_TOPICS = getSobTopics();
export const SOB_THUMBNAIL_CATEGORIES = SOB_THUMBNAIL_TOPICS;

const TOPIC_TO_INTENT: Record<SobTopicKey, IntentKey> = {
  pranayama: 'knowledge',
  tummo: 'power',
  humming: 'healing',
  morning_routine: 'peace',
  sleep: 'peace',
  nitric_oxide: 'knowledge',
  digestion: 'healing',
  anxiety_relief: 'peace',
  energy: 'power',
  immunity: 'protection',
  chakra_balance: 'transformation',
  beginner_breathing: 'love',
};

function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function isSchoolOfBreathTopic(value: string): value is SobTopicKey {
  return SOB_THUMBNAIL_TOPICS.some((topic) => topic.key === value);
}

export function getSchoolOfBreathHookOptions(topic: SobTopicKey): [string, string, string] {
  return getSobHookOptions(topic);
}

export function isSchoolOfBreathHookChannelProven(hook: string): boolean {
  return isSobHookChannelProven(hook);
}

export function getSchoolOfBreathTopicMeta(topic: SobTopicKey) {
  const config = getSobTopicConfig(topic);
  return {
    key: topic,
    label: config.label,
    topLine: config.topLine,
    cta: config.cta,
    supportVisual: config.supportVisual,
    backgroundTheme: config.backgroundTheme,
    visualBadgeType: config.visualBadgeType,
    arrowAllowed: config.arrowAllowed,
    characterPose: config.characterPose,
    accent: config.accent,
    textSide: config.textSide,
    characterSide: config.characterSide,
    hooks: getSobHookOptions(topic),
  };
}

export function getSchoolOfBreathDefaultInput(): SchoolOfBreathThumbnailInput {
  const topic = getSobDefaultTopic();
  const hooks = getSobHookOptions(topic);
  return {
    title: '',
    topic,
    mode: getSobDefaultMode(topic),
    hook: hooks[0],
    layoutStyle: getSobDefaultLayoutStyle(topic),
    topStripOverride: '',
    ctaOverride: '',
    specialNote: '',
  };
}

export function getSchoolOfBreathDefaultLayoutStyle(topic: SobTopicKey): SobLayoutStyle {
  return getSobDefaultLayoutStyle(topic);
}

export function getSchoolOfBreathQuickPickSet(topic: SobTopicKey) {
  const meta = getSchoolOfBreathTopicMeta(topic);
  return {
    hooks: meta.hooks,
    topLine: meta.topLine,
    cta: meta.cta,
    supportVisual: meta.supportVisual,
    backgroundTheme: meta.backgroundTheme,
    visualBadgeType: meta.visualBadgeType,
    arrowAllowed: meta.arrowAllowed,
    characterPose: meta.characterPose,
    accent: meta.accent,
    textSide: meta.textSide,
    characterSide: meta.characterSide,
    recommendedMode: getSobDefaultMode(topic),
  };
}

function buildHookFamily(hook: string, topic: SobTopicKey): 'safe' | 'aggressive' | 'curiosity' {
  const options = getSobHookOptions(topic);
  const normalized = hook.trim().toUpperCase();
  if (normalized === options[1].trim().toUpperCase()) return 'aggressive';
  if (normalized === options[2].trim().toUpperCase()) return 'curiosity';
  return 'safe';
}

function buildSuggestedTitle(input: {
  topic: SobTopicKey;
  hook: string;
  mode: SobMode;
  seed?: string;
}): string {
  if (input.seed?.trim()) {
    return `${input.seed.trim()} | ${toTitleCase(input.hook)} Breath Method`;
  }
  const topicLabel = getSobTopicConfig(input.topic).label;
  const modeSuffix = input.mode === 'with_character' ? 'Guided by Abhi' : 'Text-Led Method';
  return `${toTitleCase(input.hook)} | ${topicLabel} Breathwork | ${modeSuffix}`;
}

function isModelNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('not found') || message.includes('NOT_FOUND');
}

async function generateTextWithModelFallback(
  params: Omit<GenerateContentParams, 'model'>
) {
  let lastError: unknown;
  for (const model of TEXT_MODEL_CANDIDATES) {
    try {
      return await ai.models.generateContent({ ...params, model });
    } catch (error) {
      lastError = error;
      if (!isModelNotFoundError(error)) throw error;
    }
  }
  throw lastError ?? new Error('No Gemini text model candidates were configured');
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sanitizeUppercaseWords(value: string | undefined, maxWords: number): string {
  if (!value) return '';

  const cleaned = value
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^A-Za-z0-9/&'\- ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  if (!cleaned) return '';
  return cleaned.split(' ').filter(Boolean).slice(0, maxWords).join(' ');
}

export async function suggestSchoolOfBreathInput(params: {
  topic: SobTopicKey;
  mode: SobMode;
  topicSeed?: string;
  generateIdeas?: boolean;
}): Promise<SchoolOfBreathThumbnailSuggestion> {
  const topicConfig = getSobTopicConfig(params.topic);
  const hooks = getSobHookOptions(params.topic);
  const fallbackTitle = buildSuggestedTitle({
    topic: params.topic,
    hook: hooks[0],
    mode: params.mode,
    seed: params.topicSeed,
  });
  const maxHookWords = Math.max(1, getSobPromptContext(params.topic).style.text.maxWords || 6);

  if (!params.generateIdeas || !GEMINI_API_KEY) {
    return {
      title: fallbackTitle,
      hooks,
      topLine: topicConfig.topLine,
    };
  }

  try {
    const response = await generateTextWithModelFallback({
      contents: [
        `Topic key: ${params.topic}`,
        `Topic label: ${topicConfig.label}`,
        `Mode: ${params.mode}`,
        `Default top strip: ${topicConfig.topLine}`,
        `Default CTA: ${topicConfig.cta}`,
        `Approved hooks: ${hooks.join(' | ')}`,
        params.topicSeed?.trim() ? `Topic seed: ${params.topicSeed.trim()}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      config: {
        systemInstruction: `You are the School of Breath thumbnail idea strategist.

Return strict JSON only.

Rules:
- Keep ideas aligned to breathwork/meditation and the selected topic.
- hook: UPPERCASE, 1-${maxHookWords} words, punchy and mobile-readable.
- topStrip: UPPERCASE, 2-5 words.
- cta: UPPERCASE, 1-4 words.
- title: YouTube-ready, clickworthy, no emojis.
- Prefer fresh wording instead of simply repeating approved hooks.
- Avoid medical guarantees or extreme claims.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            hook: { type: Type.STRING },
            topStrip: { type: Type.STRING },
            cta: { type: Type.STRING },
          },
          required: ['title', 'hook', 'topStrip', 'cta'],
        },
      },
    });

    const parsed = response.text ? (JSON.parse(response.text) as Partial<Record<string, string>>) : {};
    const hookOverride = sanitizeUppercaseWords(parsed.hook, maxHookWords);
    const topStripOverride = sanitizeUppercaseWords(parsed.topStrip, 5);
    const ctaOverride = sanitizeUppercaseWords(parsed.cta, 4);
    const title = normalizeTitle(
      parsed.title ||
        buildSuggestedTitle({
          topic: params.topic,
          hook: hookOverride || hooks[0],
          mode: params.mode,
          seed: params.topicSeed,
        })
    );

    return {
      title: title || fallbackTitle,
      hooks,
      topLine: topicConfig.topLine,
      hookOverride: hookOverride || undefined,
      topStripOverride: topStripOverride || undefined,
      ctaOverride: ctaOverride || undefined,
    };
  } catch {
    return {
      title: fallbackTitle,
      hooks,
      topLine: topicConfig.topLine,
    };
  }
}

function buildRenderSpec(
  input: SchoolOfBreathThumbnailInput,
  context = getSobPromptContext(input.topic)
): SobRenderSpec {
  return buildSobRenderSpec(
    {
      title: input.title,
      topic: input.topic,
      mode: input.mode,
      hook: input.hook,
      layoutStyle: input.layoutStyle,
      topStripOverride: input.topStripOverride,
      ctaOverride: input.ctaOverride,
      specialNote: input.specialNote,
    },
    context,
    {
      isChannelProvenHook: isSobHookChannelProven(input.hook),
    }
  );
}

function buildCanvaSpec(
  input: SchoolOfBreathThumbnailInput,
  renderSpec: SobRenderSpec
): ThumbnailCanvaSpec {
  const topic = getSobTopicConfig(input.topic);

  return {
    hookWord: renderSpec.mainHookText,
    secondary: renderSpec.ctaText,
    badge: renderSpec.visualBadgeType,
    schoolLabel: 'THE SCHOOL OF BREATH',
    seoTitle: buildSuggestedTitle({
      topic: input.topic,
      hook: input.hook,
      mode: input.mode,
      seed: input.title,
    }),
    colors: {
      hook: '#111111',
      secondary: '#FFFFFF',
      brand: '#FFD400',
      badge: '#FFFFFF',
      aura: topic.accent,
    },
    topStripText: renderSpec.topStripText,
    ctaText: renderSpec.ctaText,
    supportVisual: renderSpec.supportVisual,
    backgroundTheme: renderSpec.backgroundTheme,
    visualBadgeType: renderSpec.visualBadgeType,
    characterPose: renderSpec.characterPose,
    subjectType: renderSpec.subjectType,
    layoutStyle: renderSpec.layoutStyle,
    hookLine1: renderSpec.hookLine1,
    hookLine2: renderSpec.hookLine2,
  };
}

function buildThumbnailPrompt(input: SchoolOfBreathThumbnailInput, renderSpec: SobRenderSpec): ThumbnailPrompt {
  return {
    title: input.title.trim(),
    deity: renderSpec.subjectType === 'abhi' ? 'Abhi' : 'No Character',
    intent: TOPIC_TO_INTENT[input.topic],
    brand: 'school_of_breath',
    line1: renderSpec.mainHookText,
    line2: renderSpec.ctaText,
    badge: renderSpec.visualBadgeType,
    special: input.specialNote?.trim() || undefined,
    schoolOfBreath: {
      mode: renderSpec.mode,
      category: input.topic,
      hookFamily: buildHookFamily(input.hook, input.topic),
      layoutPreset: renderSpec.layoutPreset,
      subjectType: renderSpec.subjectType,
      textSide: renderSpec.textSide,
      subjectSide: renderSpec.subjectSide,
      topLine: renderSpec.topStripText,
      bottomStrip: renderSpec.ctaText,
      supportVisual: renderSpec.supportVisual,
      colorEmphasis: renderSpec.accentColor,
      backgroundStyle: renderSpec.backgroundTheme,
      visualBadgeType: renderSpec.visualBadgeType,
      arrowAllowed: renderSpec.arrowAllowed,
      characterPose: renderSpec.characterPose,
      isChannelProvenHook: renderSpec.isChannelProvenHook,
      layoutStyle: renderSpec.layoutStyle,
    },
  };
}

export async function generateSchoolOfBreathThumbnailPlan(
  input: SchoolOfBreathThumbnailInput
): Promise<ThumbnailDraft> {
  const normalizedInput: SchoolOfBreathThumbnailInput = {
    title: input.title.trim(),
    topic: input.topic,
    mode: input.mode,
    hook: input.hook.trim().toUpperCase(),
    layoutStyle: input.layoutStyle,
    topStripOverride: input.topStripOverride?.trim() || undefined,
    ctaOverride: input.ctaOverride?.trim() || undefined,
    specialNote: input.specialNote?.trim() || undefined,
  };

  const context = getSobPromptContext(normalizedInput.topic);
  const validation = validateSobInput(
    {
      title: normalizedInput.title,
      topic: normalizedInput.topic,
      mode: normalizedInput.mode,
      hook: normalizedInput.hook,
      topStripOverride: normalizedInput.topStripOverride,
      ctaOverride: normalizedInput.ctaOverride,
      specialNote: normalizedInput.specialNote,
    },
    context
  );

  if (!validation.isValid) {
    throw new Error(validation.errors.join('\n'));
  }

  const renderSpec = buildRenderSpec(normalizedInput, context);
  const generationPrompts = buildSobPromptVariantsFromRenderSpec(
    renderSpec,
    DEFAULT_SOB_VARIANT_COUNT
  ).map((variant) => variant.prompt);

  return {
    id: crypto.randomUUID(),
    status: 'draft',
    prompt: buildThumbnailPrompt(normalizedInput, renderSpec),
    baseImages: [],
    canvaSpec: buildCanvaSpec(normalizedInput, renderSpec),
    createdAt: new Date(),
    generationPrompts,
    templateId: `sob-lightweight-${normalizedInput.mode}-v1`,
    validationSummary: [
      ...validation.warnings,
      `Flow: topic=${normalizedInput.topic} mode=${normalizedInput.mode} hook=${normalizedInput.hook}`,
      `Layout family: ${renderSpec.layoutStyle} / Title dominance: ${renderSpec.titleDominance}`,
      `Hook break: ${renderSpec.hookLineBreakMode}${renderSpec.hookLine1 ? ` ("${renderSpec.hookLine1}" / "${renderSpec.hookLine2}")` : ''}`,
      `Render spec: preset=${renderSpec.layoutPreset} subjectType=${renderSpec.subjectType}`,
      `Top strip: ${renderSpec.topStripText}`,
      `CTA: ${renderSpec.ctaText}`,
      `Background theme: ${renderSpec.backgroundTheme}`,
      `Support visual: ${renderSpec.supportVisual}`,
      `Character pose: ${renderSpec.characterPose || 'n/a (support visual mode)'}`,
      `Visual badge: ${renderSpec.visualBadgeType}`,
      `Channel-proven hook: ${renderSpec.isChannelProvenHook ? 'yes' : 'no'}`,
    ],
  };
}

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

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load generated image'));
    image.src = src;
  });
}

async function normalizeThumbnailToCanvas(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const targetWidth = 1280;
  const targetHeight = 720;
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser');

  const scale = Math.max(targetWidth / image.width, targetHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const dx = (targetWidth - drawWidth) / 2;
  const dy = (targetHeight - drawHeight) / 2;

  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
  return canvas.toDataURL('image/png');
}

async function resizeReferenceImageForModel(blob: Blob): Promise<InlineImagePart> {
  const blobUrl = URL.createObjectURL(blob);
  try {
    const image = await loadImage(blobUrl);
    const maxEdge = 768;
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser');

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data) throw new Error('Failed to encode Abhi reference image.');

    return {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data,
      },
    };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

async function imageUrlToInlinePart(url: string): Promise<InlineImagePart> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load Abhi reference image: ${url}`);
  return resizeReferenceImageForModel(await response.blob());
}

async function getAbhiReferenceInlineParts(): Promise<InlineImagePart[]> {
  if (cachedAbhiReferenceParts) return cachedAbhiReferenceParts;
  if (cachedAbhiReferencePromise) return cachedAbhiReferencePromise;

  cachedAbhiReferencePromise = Promise.all(
    getAbhiReferenceImageUrls(MAX_ABHI_REFERENCE_IMAGES).map((url) => imageUrlToInlinePart(url))
  )
    .then((parts) => {
      cachedAbhiReferenceParts = parts;
      return parts;
    })
    .finally(() => {
      cachedAbhiReferencePromise = null;
    });

  return cachedAbhiReferencePromise;
}

async function getCompositionReferenceInlinePart(url?: string): Promise<InlineImagePart | null> {
  if (!url) return null;
  const cached = cachedCompositionReferenceParts.get(url);
  if (cached) return cached;

  const pending = cachedCompositionReferencePromises.get(url);
  if (pending) return pending;

  const promise = imageUrlToInlinePart(url)
    .then((part) => {
      cachedCompositionReferenceParts.set(url, part);
      return part;
    })
    .catch(() => null)
    .finally(() => {
      cachedCompositionReferencePromises.delete(url);
    });

  cachedCompositionReferencePromises.set(url, promise);
  return promise;
}

async function generateImageDataUrlWithFallback(
  contents: string | Array<{ text: string } | InlineImagePart>
): Promise<{ imageDataUrl: string; model: string }> {
  const failures: string[] = [];

  for (const model of IMAGE_MODEL_CANDIDATES) {
    for (let attempt = 1; attempt <= IMAGE_GENERATION_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio: '16:9', imageSize: '1K' },
          },
        });

        const imageDataUrl = extractImageFromResponse(response);
        if (!imageDataUrl) {
          throw new Error('Image generation returned no inline image data.');
        }

        return { imageDataUrl, model };
      } catch (error) {
        failures.push(`[${model} attempt ${attempt}] ${errorMessage(error)}`);
      }
    }
  }

  throw new Error(`Image generation failed across all model candidates.\n${failures.join('\n')}`);
}

export async function generateSchoolOfBreathThumbnailImages(
  plan: ThumbnailDraft
): Promise<ThumbnailDraft> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Add GEMINI_API_KEY or VITE_GEMINI_API_KEY.');
  }

  const prompts = plan.generationPrompts ?? [];
  if (prompts.length === 0) {
    throw new Error('No generation prompts in the plan.');
  }

  const shouldUseCharacterReferences = plan.prompt.schoolOfBreath?.mode === 'with_character';
  const referenceParts = shouldUseCharacterReferences ? await getAbhiReferenceInlineParts() : [];

  const layoutStyle = plan.prompt.schoolOfBreath?.layoutStyle;
  const compositionRefUrl = layoutStyle ? getLayoutCompositionReferenceUrl(layoutStyle) : undefined;
  const compositionRefPart = await getCompositionReferenceInlinePart(compositionRefUrl);

  const twoStackedHookLock =
    plan.canvaSpec?.hookLine1 && plan.canvaSpec.hookLine2
      ? 'STACKED HOOK IN ONE GOLD BAR ONLY: Line 1 + Line 2 **identical size/weight**, **center-aligned**, **50/50 vertical split** inside the **same** yellow rectangle — **FORBIDDEN:** repeating line 2 twice (e.g. RESET left and right of face), floating hook words outside the bar, or spelling the hook again elsewhere. '
      : '';

  const ctaTextForSizing = (
    plan.prompt.schoolOfBreath?.bottomStrip ||
    plan.canvaSpec?.ctaText ||
    ''
  ).trim();
  const ctaWordCount = ctaTextForSizing.split(/\s+/).filter(Boolean).length;
  const centeredCtaSizingLockText =
    ctaWordCount <= 1
      ? 'CTA size lock (one-word): use an oversized red tag at right-mid (~22–32% frame width, ~13–19% frame height) with very large condensed white caps (~68–100px intent @720h), single line.'
      : 'CTA size lock (multi-word): widen/tall the red tag at right-mid (~26–40% frame width, ~13–20% frame height). For 2 words keep one line when possible (~56–86px intent); for 3+ words allow two compact lines with equal weight.';

  const generationResults = await Promise.allSettled(
    prompts.map(async (prompt) => {
      const characterLockText =
        'Use only attached Abhi references. Do not invent another person. Preserve exact Abhi face identity and mature Indian male teacher appearance. Keep core facial structure consistent with references: hairline/temple shape, eyebrow thickness, eye spacing and eye shape, straight nose bridge, jawline, and skin tone. Keep Abhi in seated or breath-teaching pose. Expression lock: calm-alert teacher intensity, closed mouth, focused gaze (no stock-photo smile). Eyes must be clearly open with visible catchlights (never closed). Do not beautify/de-age or change ethnicity. Match real School of Breath thumbnail style, not portrait-photography ad style. No sticker/cutout look. No white frame or mockup border.';

      const compositionLockText =
        plan.prompt.schoolOfBreath?.mode === 'without_character'
          ? `Attached image = LAYOUT/COMPOSITION REFERENCE (not face identity). Match tag colors and strip order exactly. 3-zone composition lock: LEFT visual hook 30-35%, CENTER anchor slot 25-30%, RIGHT text mass 35-45%. **Top category strip:** nearly **full frame width** (not a short mini-pill), bold white caps with **minimum ~40–54px cap height at 720h** — do NOT shrink it when the main hook or red CTA is long; if CTA is long, grow the red box (or two lines inside red) instead. **Gold hook bar = FIXED TEMPLATE (same footprint as ZEN MODE):** **~34–40% frame height** (~246–292px at 720h) AND **~82–92% frame width** (~1050–1180px at 1280w), centered — **identical for every hook**; gold bar must NOT be narrower than the dark top strip. Longer hook = stacked lines **inside this same box** (HOOK LINE BREAK); **FORBIDDEN:** shorter/narrower bar for longer text. 1280x720 intent: single-line caps ~190–240px; **each** stacked line ~105–135px. ${centeredCtaSizingLockText} Hook ~94–98% of bar width **per line**. Strong size lock for BOTH modes. Without character: open lower-center cosmic for future Abhi; support graphic bottom-left. No corner symbols unless requested. No center placeholder box. All wording from the prompt below.`
          : `Attached image = LAYOUT/COMPOSITION REFERENCE only (not face identity). Match: **full-width** white-on-dark top strip (category text **never micro-sized** because hook/CTA is long — min ~40–54px caps at 720h), **black-on-yellow-gold main hook bar** (thin black outline, premium gold) behind shoulders — **FIXED TEMPLATE:** **~34–40% frame height** (~246–292px at 720h), **~82–92% width** (~1050–1180px at 1280w), **same for every hook**; bar **≥ width of** full top strip; never a narrow gold chip. Longer phrases → two stacked lines in one bar (HOOK LINE BREAK), not a smaller bar. White-on-red CTA on torso; long CTA → bigger red or 2 lines inside red. Proof bottom-left, arrow, corner symbols per topic. 1280x720 intent: stacked lines ~105–135px each, single line ~190–240px. ${centeredCtaSizingLockText} Hook ~94–98% bar width per line. Reproduce colors (white / gold hook / black / red CTA). All wording from the prompt below — do not copy letters from the reference if they differ.`;

      const parts: Array<{ text: string } | InlineImagePart> = [];
      if (referenceParts.length > 0) {
        parts.push({ text: characterLockText });
        const identityAnchorParts = referenceParts.slice(0, 2);
        const secondaryReferenceParts = referenceParts.slice(2);
        parts.push({
          text: 'Identity anchor priority: the first two attached photos are strict face anchors. Match the same person exactly.',
        });
        parts.push(...identityAnchorParts);
        if (secondaryReferenceParts.length > 0) {
          parts.push({
            text: 'Secondary references are for pose/wardrobe support only. Never override face identity anchors.',
          });
          parts.push(...secondaryReferenceParts);
        }
      }
      if (compositionRefPart) {
        parts.push({ text: twoStackedHookLock + compositionLockText });
        parts.push(compositionRefPart);
      }
      parts.push({ text: prompt });

      const contents = parts.length > 1 ? parts : prompt;
      return generateImageDataUrlWithFallback(contents);
    })
  );

  const successfulVariants: Array<{ variant: number; model: string; imageDataUrl: string }> = [];
  const failedVariants: Array<{ variant: number; reason: string }> = [];

  generationResults.forEach((result, index) => {
    const variant = index + 1;
    if (result.status === 'fulfilled') {
      successfulVariants.push({
        variant,
        model: result.value.model,
        imageDataUrl: result.value.imageDataUrl,
      });
      return;
    }
    failedVariants.push({
      variant,
      reason: errorMessage(result.reason),
    });
  });

  if (successfulVariants.length === 0) {
    throw new Error(
      [
        'All thumbnail variants failed.',
        ...failedVariants.map(
          (failure) => `Variant ${failure.variant} failed: ${failure.reason}`
        ),
      ].join('\n')
    );
  }

  const normalizedVariantResults = await Promise.all(
    successfulVariants.map(async (variant) => ({
      ...variant,
      normalizedImage: await normalizeThumbnailToCanvas(variant.imageDataUrl),
    }))
  );
  const normalizedImages = normalizedVariantResults.map((item) => item.normalizedImage);
  const usedModels = Array.from(new Set(normalizedVariantResults.map((item) => item.model)));

  return {
    ...plan,
    status: 'ready',
    baseImages: normalizedImages,
    validationSummary: [
      ...(plan.validationSummary ?? []),
      ...(referenceParts.length > 0
        ? [`Character lock: used ${referenceParts.length} approved Abhi references.`]
        : ['No-character mode: confirmed no reference person images used.']),
      ...(compositionRefPart
        ? [`Layout composition reference: centered cosmic hero (bundled PNG) attached for Gemini.`]
        : []),
      `Gemini image models used: ${usedModels.join(', ')}.`,
      ...normalizedVariantResults.map(
        (variant) =>
          `Variant ${variant.variant}: generated with ${variant.model} and normalized to 1280x720.`
      ),
      ...failedVariants.map(
        (failure) => `Variant ${failure.variant}: generation failed (${failure.reason}).`
      ),
    ],
    errorMessage: undefined,
  };
}

export async function generateSchoolOfBreathThumbnailDraft(
  input: SchoolOfBreathThumbnailInput
): Promise<ThumbnailDraft> {
  const plan = await generateSchoolOfBreathThumbnailPlan(input);
  return generateSchoolOfBreathThumbnailImages(plan);
}
