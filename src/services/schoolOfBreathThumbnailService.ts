import { GoogleGenAI } from '@google/genai';
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

const MAX_ABHI_REFERENCE_IMAGES = 4;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

type InlineImagePart = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

let cachedAbhiReferenceParts: InlineImagePart[] | null = null;
let cachedAbhiReferencePromise: Promise<InlineImagePart[]> | null = null;

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

export async function suggestSchoolOfBreathInput(params: {
  topic: SobTopicKey;
  mode: SobMode;
  topicSeed?: string;
}): Promise<SchoolOfBreathThumbnailSuggestion> {
  const hooks = getSobHookOptions(params.topic);
  const title = buildSuggestedTitle({
    topic: params.topic,
    hook: hooks[0],
    mode: params.mode,
    seed: params.topicSeed,
  });

  return {
    title,
    hooks,
    topLine: getSobTopicConfig(params.topic).topLine,
  };
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
  let compositionRefPart: InlineImagePart | null = null;
  if (compositionRefUrl) {
    try {
      compositionRefPart = await imageUrlToInlinePart(compositionRefUrl);
    } catch {
      compositionRefPart = null;
    }
  }

  const rawImages = await Promise.all(
    prompts.map(async (prompt) => {
      const characterLockText =
        'Use only attached Abhi references. Do not invent another person. Preserve exact Abhi face identity and mature Indian male teacher appearance. Keep Abhi in seated or breath-teaching pose. Match real School of Breath thumbnail style, not portrait-photography ad style. No sticker/cutout look. No white frame or mockup border.';

      const compositionLockText =
        plan.prompt.schoolOfBreath?.mode === 'without_character'
          ? 'Attached image = LAYOUT/COMPOSITION REFERENCE (not face identity). Match tag colors and strip order. **Without character in this render:** keep **lower-center** mostly open cosmic space for a **future Abhi composite** — put the proof/support graphic **bottom-left**, modest size — not a huge centered circle. Red CTA mid-right. If the prompt says WITH CHARACTER, ignore this reserve and follow the prompt’s subject rules. All wording from the prompt below.'
          : 'Attached image = LAYOUT/COMPOSITION REFERENCE only (not face identity). Match: white-on-dark top strip, **black-on-yellow-gold gradient** main hook bar (thin black outline, premium gold — not flat neon) behind the subject’s shoulders, white-on-red CTA on the right torso, circular proof graphic bottom-left, curved arrow from the hook bar toward that circle, chakras top corners. Reproduce tag colors (white / gold hook / black text / red CTA). All wording must come from the prompt below — do not copy letters from the reference if they differ.';

      const parts: Array<{ text: string } | InlineImagePart> = [];
      if (referenceParts.length > 0) {
        parts.push({ text: characterLockText });
        parts.push(...referenceParts);
      }
      if (compositionRefPart) {
        parts.push({ text: compositionLockText });
        parts.push(compositionRefPart);
      }
      parts.push({ text: prompt });

      const contents = parts.length > 1 ? parts : prompt;

      const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: '16:9', imageSize: '1K' },
        },
      });

      const imageDataUrl = extractImageFromResponse(response);
      if (!imageDataUrl) {
        throw new Error('Image generation returned no inline image data.');
      }
      return imageDataUrl;
    })
  );

  const normalizedImages = await Promise.all(rawImages.map((image) => normalizeThumbnailToCanvas(image)));

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
      ...normalizedImages.map((_, index) => `Variant ${index + 1}: normalized to 1280x720.`),
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
