import { GoogleGenAI } from '@google/genai';
import {
  buildSchoolOfBreathVariantPrompts,
  getSchoolOfBreathCategories,
  getSchoolOfBreathColorSystem,
  getSchoolOfBreathDefaultCategory,
  getSchoolOfBreathQuickPicks,
  SchoolOfBreathCategory,
  SchoolOfBreathHookFamily,
  SchoolOfBreathMode,
  validateSchoolOfBreathInput,
} from '../sob-thumbnail-engine';
import { IntentKey, ThumbnailCanvaSpec, ThumbnailDraft, ThumbnailPrompt } from '../types';

const GEMINI_API_KEY =
  (process.env.GEMINI_API_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();

const IMAGE_MODEL =
  (process.env.GEMINI_IMAGE_MODEL as string | undefined)?.trim() ||
  'gemini-3.1-flash-image-preview';

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export interface SchoolOfBreathThumbnailInput {
  title: string;
  category: SchoolOfBreathCategory;
  mode: SchoolOfBreathMode;
  hookFamily: SchoolOfBreathHookFamily;
  mainHook: string;
  topLine?: string;
  bottomStrip?: string;
  supportVisual?: string;
  colorEmphasis?: string;
  backgroundStyle?: string;
  specialNote?: string;
}

export interface SchoolOfBreathThumbnailSuggestion {
  title: string;
  mainHook: string;
  topLine: string;
  bottomStrip: string;
}

const CATEGORY_TO_INTENT: Record<SchoolOfBreathCategory, IntentKey> = {
  technique: 'knowledge',
  routine: 'peace',
  healing: 'healing',
  energy: 'power',
  biohack: 'knowledge',
  gut: 'healing',
  sleep: 'peace',
  focus: 'knowledge',
  immunity: 'protection',
  beginner: 'transformation',
  advanced: 'power',
  mudra: 'love',
};

function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildSeoTitle(input: {
  hook: string;
  category: SchoolOfBreathCategory;
  mode: SchoolOfBreathMode;
}): string {
  const topic = input.category.replace(/_/g, ' ');
  const modeSuffix = input.mode === 'with_character' ? 'Guided by Abhi' : 'No-Fluff Method';
  return `${toTitleCase(input.hook)} Breath Method | ${toTitleCase(topic)} | ${modeSuffix}`;
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

function buildCanvaSpec(
  normalized: ReturnType<typeof validateSchoolOfBreathInput>['normalized']
): ThumbnailCanvaSpec {
  const colors = getSchoolOfBreathColorSystem();
  const palette = colors[normalized.colorEmphasis] || {
    primary: '#111111',
    secondary: '#FFD400',
    accent: '#FFFFFF',
  };

  return {
    hookWord: normalized.mainHook,
    secondary: normalized.bottomStrip,
    badge: normalized.bottomStrip,
    schoolLabel: 'THE SCHOOL OF BREATH',
    seoTitle: buildSeoTitle({
      hook: normalized.mainHook,
      category: normalized.category,
      mode: normalized.mode,
    }),
    colors: {
      hook: palette.secondary,
      secondary: palette.accent,
      brand: palette.secondary,
      badge: palette.accent,
      aura: palette.primary,
    },
  };
}

function buildDraftPrompt(
  normalized: ReturnType<typeof validateSchoolOfBreathInput>['normalized']
): ThumbnailPrompt {
  return {
    title: normalized.title,
    deity: normalized.mode === 'with_character' ? 'Abhi' : 'No Character',
    intent: CATEGORY_TO_INTENT[normalized.category],
    brand: 'school_of_breath',
    line1: normalized.mainHook,
    line2: normalized.bottomStrip,
    badge: normalized.bottomStrip,
    special: normalized.specialNote,
    schoolOfBreath: {
      mode: normalized.mode,
      category: normalized.category,
      hookFamily: normalized.hookFamily,
      topLine: normalized.topLine,
      bottomStrip: normalized.bottomStrip,
      supportVisual: normalized.supportVisual,
      colorEmphasis: normalized.colorEmphasis,
      backgroundStyle: normalized.backgroundStyle,
    },
  };
}

export const SOB_THUMBNAIL_CATEGORIES = getSchoolOfBreathCategories();

export function getSchoolOfBreathDefaultInput(): SchoolOfBreathThumbnailInput {
  const category = getSchoolOfBreathDefaultCategory();
  const quick = getSchoolOfBreathQuickPicks(category);

  return {
    title: '',
    category,
    mode: quick.recommendedMode,
    hookFamily: quick.hookFamilies[0],
    mainHook: quick.hooks[0] || 'DO IT THIS WAY',
    topLine: quick.topLines[0],
    bottomStrip: quick.bottomStrips[0],
    supportVisual: quick.supportVisuals[0],
    colorEmphasis: quick.colorEmphasis[0],
    backgroundStyle: quick.backgroundStyles[0],
    specialNote: '',
  };
}

export function getSchoolOfBreathQuickPickSet(
  category: SchoolOfBreathCategory,
  hookFamily?: SchoolOfBreathHookFamily
) {
  return getSchoolOfBreathQuickPicks(category, hookFamily);
}

export async function suggestSchoolOfBreathInput(params: {
  category: SchoolOfBreathCategory;
  mode: SchoolOfBreathMode;
  hookFamily: SchoolOfBreathHookFamily;
  topicSeed?: string;
}): Promise<SchoolOfBreathThumbnailSuggestion> {
  const quick = getSchoolOfBreathQuickPicks(params.category, params.hookFamily);
  const mainHook = quick.hooks[0] || 'DO IT THIS WAY';
  const topLine = quick.topLines[0] || 'BREATH PROTOCOL';
  const bottomStrip = quick.bottomStrips[0] || 'WATCH NOW';

  const title = params.topicSeed?.trim()
    ? `${params.topicSeed.trim()} | ${toTitleCase(mainHook)} Breath Method`
    : buildSeoTitle({
        hook: mainHook,
        category: params.category,
        mode: params.mode,
      });

  return {
    title,
    mainHook,
    topLine,
    bottomStrip,
  };
}

export async function generateSchoolOfBreathThumbnailPlan(
  input: SchoolOfBreathThumbnailInput
): Promise<ThumbnailDraft> {
  const validation = validateSchoolOfBreathInput(input);

  if (!validation.isValid) {
    throw new Error(validation.errors.join('\n'));
  }

  const normalized = validation.normalized;

  return {
    id: crypto.randomUUID(),
    status: 'draft',
    prompt: buildDraftPrompt(normalized),
    baseImages: [],
    canvaSpec: buildCanvaSpec(normalized),
    createdAt: new Date(),
    generationPrompts: buildSchoolOfBreathVariantPrompts(normalized),
    templateId: `sob-${normalized.mode}-v1`,
    validationSummary: validation.warnings,
  };
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

  const normalized = await Promise.all(rawImages.map((img) => normalizeThumbnailToCanvas(img)));

  return {
    ...plan,
    status: 'ready',
    baseImages: normalized,
    validationSummary: [
      ...(plan.validationSummary ?? []),
      ...normalized.map((_, index) => `Variant ${index + 1}: normalized to 1280x720.`),
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
