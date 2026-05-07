import { GoogleGenAI, Type } from '@google/genai';
import { BrandContext, VideoReelInput, ReelScene } from '../types';
import { ensureOpenAiImageAccess } from './openaiThumbnailImageService';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Prefer the best-quality Gemini model, with fallbacks if a preview/alias is unavailable.
const MODEL_CANDIDATES = {
  draft: [
    process.env.GEMINI_MODEL_DRAFT,
    'gemini-3.1-pro-preview',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
  ].filter(Boolean) as string[],
  reels: [
    process.env.GEMINI_MODEL_REELS,
    'gemini-3.1-pro-preview',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
  ].filter(Boolean) as string[],
  post: [
    process.env.GEMINI_MODEL_POST,
    'gemini-3.1-pro-preview',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
  ].filter(Boolean) as string[],
};

type GenerateContentParams = Parameters<typeof ai.models.generateContent>[0];

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

const DEFAULT_SLIDE_COUNT = 6;
const MAX_SLIDE_COUNT = 8;

// ─── Brand Visual Style (locked — do not vary) ──────────────────────────────
const BRAND_VISUAL_STYLE = `
1. BRAND & VISUAL CONSISTENCY
- Brand: School of Breath / @meditate_with_abhi by Abhi Duggal.
- Visual Style: A sophisticated, high-end fusion of spirituality and science. Minimal, clean, elegant.
- Background: Deep dark cosmic field (deep blues #080614, purples, indigo #1A1040, black). Swirling gold nebulae and sparkling gold dust particles.
- Aesthetic Overlays: Semi-transparent golden glowing sacred geometry overlays (Metatron's Cube, mandalas, connecting lines).
- Typography: Elegant luxurious golden serif/geometric font for HEADERS (ALL CAPS). Clean, crisp glowing white sans-serif for BODY text.
- Hero elements per slide: ONE centered 3D/illustrated element:
    HOOK → Sacred geometry circle glowing behind text
    SECOND_HOOK → Gold numerals large and prominent, sacred geometry ring
    SCIENCE → Human body/nervous system silhouette, gold energy lines lungs to brain
    STEP slides → 3D golden glowing object (upward arrow=inhale, cube=hold, downward arrow=exhale, torus=pause)
    RECAP/CTA → Teal-dark gradient bg (#1B4D5A), iPhone mockup showing School of Breath app, golden light rays from upper-right
- Glow: All 3D elements have neon gold bloom glow (60-100px radius).
- Format: Square 1080x1080px.

2. TEXT ON SLIDES (CRITICAL — MINIMAL)
- Slides are IMAGE-FIRST. The visual hero element is the star.
- Header: 2-4 words MAX, bold ALL CAPS gold text.
- Body: 1 short subtitle (5-8 words max), white text. Can be empty.
- NEVER put paragraphs, bullet points, long explanations, or step-by-step instructions on slides.
- Think of each slide like a powerful poster: one striking image + one bold title + one soft line.

3. MANDATORY MARKETING RULE (LAST SLIDE)
- Last slide MUST be the brand marketing slide.
- Visual: Teal-dark gradient, smartphone showing "School of Breath" app UI, gold light rays.
- Header: "READY TO RESET?", Body: "Download The School of Breath App."
- Include @meditate_with_abhi handle.
`;

export async function generateDraft(topic?: string, slideCount: number = DEFAULT_SLIDE_COUNT) {
  const n = Math.min(Math.max(1, Math.round(slideCount)), MAX_SLIDE_COUNT);
  const prompt = topic
    ? `Generate a ${n}-slide Instagram carousel draft about "${topic}" for the brand "School of Breath" / @meditate_with_abhi.`
    : `Generate a ${n}-slide Instagram carousel draft about a fresh breathwork or meditation topic for the brand "School of Breath" / @meditate_with_abhi.`;

  const response = await generateContentWithModelFallback(MODEL_CANDIDATES.draft, {
    contents: prompt,
    config: {
      systemInstruction: `You are the "Carousel Catalyst," an AI optimized to create highly detailed, context-aware image generation prompts for Instagram Carousels. Your core objective is to create a prompt that instructs an AI image generator (like ChatGPT/DALL-E or Midjourney) to generate ${n} INDIVIDUAL, high-resolution square images for an Instagram Carousel.

${BRAND_VISUAL_STYLE}

4. SCRIPT INTERPRETATION & LAYOUT
- Generate EXACTLY ${n} separate images, not a grid.
- For each slide, invent a powerful visual metaphor using the brand aesthetic.
- Slide ${n} MUST be the marketing/CTA slide.
- Each slide gets a short headline (2-4 words, gold) and optional body (1 line, white).
- The imagePrompt must be a COMPLETE copy-paste prompt for ChatGPT.

5. SLIDE IMAGE PROMPTS
- slideImagePrompts: ${n} self-contained per-slide prompts (max 450 chars each).
- Each must independently describe: background, hero element, typography, and exact text.
- CRITICAL: spell all text perfectly. No letter errors, no garbled words.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topic: {
            type: Type.STRING,
            description: 'The main topic or title of the carousel.',
          },
          slides: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: {
                  type: Type.STRING,
                  description: 'The text content for this slide. Header + body combined.',
                },
                role: {
                  type: Type.STRING,
                  description: 'Slide role: hook | second_hook | science | step | recap',
                },
                headline: {
                  type: Type.STRING,
                  description: 'Bold gold header, 2-4 words ALL CAPS. Example: "BHASTRIKA BREATH"',
                },
                body: {
                  type: Type.STRING,
                  description: 'Short white subtitle, 5-8 words max or empty. Example: "Ignite Your Inner Fire."',
                },
                stepNumber: {
                  type: Type.INTEGER,
                  description: 'Step number for step slides only.',
                },
                visualNotes: {
                  type: Type.STRING,
                  description: 'Visual direction: background, hero element, glow effects.',
                },
              },
              required: ['text', 'headline'],
            },
            description: `Exactly ${n} slides. Slide ${n} MUST be the marketing CTA.`,
          },
          imagePrompt: {
            type: Type.STRING,
            description: 'The COMPLETE prompt to copy-paste into ChatGPT. Format: ---[START PROMPT]--- Please generate N separate square 1080x1080px images... **Image 1 (HOOK):** ... **Image N (RECAP/CTA):** ... ---[END PROMPT]---',
          },
          slideImagePrompts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: `Exactly ${n} self-contained per-slide image prompts (max 450 chars each) for Gemini/OpenAI image API.`,
          },
        },
        required: ['topic', 'slides', 'imagePrompt', 'slideImagePrompts'],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Failed to generate draft");
  
  const data = JSON.parse(text);
  // Ensure exactly n slides, pad or truncate if necessary
  let slides = data.slides || [];
  if (slides.length > n) slides = slides.slice(0, n);
  while (slides.length < n) {
    slides.push({ text: "Breathe in, breathe out." });
  }
  data.slides = slides;

  // Ensure exactly n slideImagePrompts for Imagen generation
  let slideImagePrompts = data.slideImagePrompts || [];
  if (slideImagePrompts.length > n) slideImagePrompts = slideImagePrompts.slice(0, n);
  while (slideImagePrompts.length < n) {
    const idx = slideImagePrompts.length;
    const slideText = slides[idx]?.text || 'Breathe in, breathe out.';
    slideImagePrompts.push(
      `Square image for Instagram carousel. Deep cosmic nebula with swirling gold particles, sacred geometry overlay. Gold serif header, white sans-serif body. Content: ${slideText.slice(0, 200)}`
    );
  }
  data.slideImagePrompts = slideImagePrompts;

  return data;
}

// ─── Carousel Image Generation (Nano Banana via Gemini API) ────────────────────
// Nano Banana = Gemini native image generation (generateContent → inline image parts).
// Default: gemini-3.1-flash-image-preview (Nano Banana 2). Alternative: gemini-3-pro-image-preview (Nano Banana Pro).

const IMAGE_MODEL =
  (process.env.GEMINI_IMAGE_MODEL as string | undefined)?.trim() ||
  'gemini-3.1-flash-image-preview';

/**
 * Shared visual foundation injected into EVERY slide image prompt.
 * Encodes the cosmic_gold_breathwork style from the @meditate_with_abhi brand.
 */
const SHARED_IMAGE_CONTEXT =
  'Single square 1:1 Instagram carousel slide, exactly 1080x1080 pixels for @meditate_with_abhi / School of Breath. ' +
  'One image only: no collages, no split or multi-panel layouts, no extra outer frames beyond the artwork itself. ' +
  'Background: deep dark cosmic nebula, near-black (#080614) blending into deep indigo (#1A1040), ' +
  'warm amber nebula clouds mid-distance, scattered gold particle dust and sparkles throughout. ' +
  'Overlay: semi-transparent golden sacred geometry mandala in background. ' +
  'Typography: HEADLINE in gold bold geometric ALL-CAPS sans-serif (Montserrat ExtraBold style), ' +
  'BODY in clean white regular sans-serif. Centered composition with generous whitespace. ' +
  'Small translucent pill "NEXT ▶" badge on right edge.';

/**
 * Per-role visual hero element guide.
 * Returns the hero element description to insert into the slide image prompt.
 */
function getHeroElementForRole(role: string, stepNumber?: number): string {
  switch (role) {
    case 'hook':
      return 'Hero: large glowing golden sacred geometry circle ring centered behind the text, soft gold bloom glow radiating outward.';
    case 'second_hook':
      return 'Hero: large gold numerals (the technique count, e.g. 4-4-4-4) centered prominently, sacred geometry ring around them, gold glow bloom.';
    case 'science':
      return 'Hero: human body silhouette outline in white/gold, golden energy lines flowing from lungs up through the spine to the brain, faint chakra nodes.';
    case 'step':
      if (!stepNumber) return 'Hero: 3D golden glowing geometric shape centered, neon gold bloom glow.';
      if (stepNumber === 1) return 'Hero: tall 3D golden upward arrow, glowing neon gold bloom, pointing toward top of frame. Represents INHALE.';
      if (stepNumber === 2) return 'Hero: 3D golden glowing cube with inner radiant light, represents HOLD/BOX, neon gold bloom.';
      if (stepNumber === 3) return 'Hero: tall 3D golden downward arrow, glowing neon gold bloom, pointing toward bottom of frame. Represents EXHALE.';
      if (stepNumber === 4) return 'Hero: golden wireframe torus ring or geometric stillness shape, gentle glow, represents PAUSE/HOLD EMPTY.';
      return 'Hero: 3D golden glowing geometric shape, neon bloom, centered.';
    case 'recap':
      return 'BACKGROUND OVERRIDE: teal-to-dark gradient (#1B4D5A to #0E3040) instead of cosmic nebula. ' +
        'Hero: iPhone 15 mockup floating center-frame displaying the School of Breath app home screen. ' +
        'Golden light ray burst from upper-right corner. Subtle circular mandala ring behind phone. ' +
        'Remove the "NEXT ▶" badge on this slide.';
    case 'testimonial':
      return 'Hero: soft glowing quote mark in gold, warm light behind the text, subtle sacred geometry in background.';
    default:
      return 'Hero: glowing golden mandala ring centered, sacred geometry overlay, gold particle dust.';
  }
}

const TYPOGRAPHY_GUIDANCE =
  ' CRITICAL: spell every word perfectly. No letter errors, no scrambled text, no missing characters. ' +
  'Headline must be in gold. Body must be in white. Ensure full contrast and legibility on dark background.';

/**
 * Parses the Step 1 imagePrompt (copy-paste prompt) into per-slide prompts.
 * Expects format: **Image 1 (Header/Title):** ... **Image 2:** ... etc.
 * @param imagePrompt - The full image prompt string
 * @param maxSlides - Max slide index to parse (default 8)
 */
function parseImagePromptToSlidePrompts(imagePrompt: string, maxSlides: number = 8): string[] {
  const prompts: string[] = [];
  const pattern = /\*\*Image (\d+)(?:[^*]*)?:\*\*\s*([\s\S]*?)(?=\*\*Image \d+|---\[END|$)/gi;
  let match: RegExpExecArray | null;
  const byIndex: Record<number, string> = {};

  while ((match = pattern.exec(imagePrompt)) !== null) {
    const idx = parseInt(match[1], 10);
    const content = match[2].trim();
    if (idx >= 1 && idx <= maxSlides && content) {
      byIndex[idx] = `${SHARED_IMAGE_CONTEXT} ${content}`.slice(0, 480);
    }
  }

  for (let i = 1; i <= maxSlides; i++) {
    if (byIndex[i]) prompts.push(byIndex[i]);
  }
  return prompts;
}

function extractImageFromNanoBananaResponse(response: unknown): string | null {
  const r = response as Record<string, unknown>;
  if (typeof r?.data === 'string') return `data:image/png;base64,${r.data}`;
  const candidates = r?.candidates as Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }> | undefined;
  const parts = candidates?.[0]?.content?.parts;
  if (!parts) return null;
  for (const part of parts) {
    const data = part.inlineData?.data;
    if (data) {
      const mime = part.inlineData?.mimeType || 'image/png';
      return `data:${mime};base64,${data}`;
    }
  }
  return null;
}

export interface GenerateCarouselImagesResult {
  images: string[]; // base64 data URLs
  modelUsed: string;
}

/**
 * Builds a rich, brand-accurate image prompt for a single slide using its role + content.
 * Falls back gracefully if role/headline/body are not present (legacy slides).
 */
function buildSlidePrompt(
  slide: { text: string; role?: string; headline?: string; body?: string; stepNumber?: number; visualNotes?: string },
  index: number,
  total: number
): string {
  const role = slide.role || (index === 0 ? 'hook' : index === total - 1 ? 'recap' : 'step');
  const headline = slide.headline || slide.text.split('\n')[0] || slide.text.slice(0, 60);
  const body = slide.body || slide.text.split('\n').slice(1).join(' ') || '';
  const heroElement = getHeroElementForRole(role, slide.stepNumber);

  let prompt = `${SHARED_IMAGE_CONTEXT} `;
  prompt += `${heroElement} `;
  prompt += `Headline (gold ALL-CAPS): "${headline}". `;
  if (body) prompt += `Body (white): "${body}". `;
  if (slide.visualNotes) prompt += `Extra direction: ${slide.visualNotes}`;

  return prompt.slice(0, 480);
}

/**
 * Generates carousel slide images using Nano Banana (Gemini native image generation).
 * Uses role-aware per-slide prompts when available, with brand-accurate fallback.
 */
export async function generateCarouselImages(draft: {
  imagePrompt: string;
  slides: { text: string; role?: string; headline?: string; body?: string; stepNumber?: number; visualNotes?: string }[];
  slideImagePrompts?: string[];
}): Promise<GenerateCarouselImagesResult> {
  const slideCount = draft.slides.length;

  // Priority 1: use pre-generated slideImagePrompts from the draft (if valid)
  // Priority 2: build brand-accurate prompts from slide role/headline/body
  // Priority 3: parse the big imagePrompt block
  // Priority 4: bare-minimum fallback
  let prompts: string[] = [];

  if (draft.slideImagePrompts && draft.slideImagePrompts.length >= slideCount) {
    prompts = draft.slideImagePrompts.slice(0, slideCount);
  } else if (draft.slides.some(s => s.role || s.headline)) {
    // Use role-aware brand-accurate builder
    prompts = draft.slides.slice(0, slideCount).map((s, i) =>
      buildSlidePrompt(s, i, slideCount)
    );
  } else {
    // Legacy fallback: parse the big imagePrompt string
    prompts = parseImagePromptToSlidePrompts(draft.imagePrompt, slideCount);
  }

  if (prompts.length < slideCount) {
    const fallbacks = draft.slides.slice(0, slideCount).map((s, i) =>
      buildSlidePrompt(s, i, slideCount)
    );
    while (prompts.length < slideCount) {
      prompts.push(fallbacks[prompts.length] ?? `${SHARED_IMAGE_CONTEXT} Meditation carousel slide.`);
    }
  }

  while (prompts.length < slideCount) {
    prompts.push(`${SHARED_IMAGE_CONTEXT} Meditation carousel slide.`);
  }

  const images: string[] = [];

  for (let i = 0; i < slideCount; i++) {
    const slide = draft.slides[i];
    const isLastSlide = i === slideCount - 1;
    const isRecap = isLastSlide || slide?.role === 'recap';

    // ── Last slide: use real app mockup instead of AI-generated phone UI ──
    if (isRecap) {
      try {
        const mockupPath = APP_MOCKUP_PATHS[Math.floor(Math.random() * APP_MOCKUP_PATHS.length)];
        const headline = slide?.headline || 'READY TO RESET?';
        const body = slide?.body || 'Download The School of Breath App\nfor guided sessions.';
        const mockupImage = await buildLastSlideFromMockup(mockupPath, headline, body);
        images.push(mockupImage);
        continue; // skip AI generation for this slide
      } catch (e) {
        console.warn('App mockup compositor failed, falling back to AI generation:', e);
        // fall through to AI generation
      }
    }

    const base = prompts[i] || prompts[0] || 'Cosmic nebula meditation carousel slide';
    const prompt = (base + TYPOGRAPHY_GUIDANCE).slice(0, 600);
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const dataUrl = extractImageFromNanoBananaResponse(response);
    if (!dataUrl) throw new Error(`Nano Banana failed to generate image ${i + 1}`);
    images.push(dataUrl);
  }

  return { images, modelUsed: IMAGE_MODEL };
}

// ─── OpenAI (GPT Image 2) Image Generation ─────────────────────────────────────
// GPT Image 2 is OpenAI's latest flagship image model.
// Better text rendering, prompt adherence, and design-system constraints for carousel slides.

const OPENAI_IMAGE_MODEL =
  (process.env.OPENAI_IMAGE_MODEL as string | undefined)?.trim() || 'gpt-image-2';

async function generateImageWithOpenAI(
  prompt: string,
  apiKey: string
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: '1024x1024',
      quality: 'high',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI image generation failed: ${err}`);
  }

  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image data');
  return `data:image/png;base64,${b64}`;
}

export type ImageProvider = 'google' | 'openai';

export async function generateCarouselImagesWithProvider(
  draft: {
    imagePrompt: string;
    slides: { text: string; role?: string; headline?: string; body?: string; stepNumber?: number; visualNotes?: string }[];
    slideImagePrompts?: string[];
  },
  provider: ImageProvider
): Promise<GenerateCarouselImagesResult> {
  if (provider === 'openai') {
    await ensureOpenAiImageAccess();
    const apiKey = (process.env.OPENAI_API_KEY as string | undefined)?.trim();
    if (!apiKey) throw new Error('OpenAI API key not configured. Add OPENAI_API_KEY to .env');

    const slideCount = draft.slides.length;
    let prompts: string[] = [];

    // Same priority chain as the Google path — role-aware first
    if (draft.slideImagePrompts && draft.slideImagePrompts.length >= slideCount) {
      prompts = draft.slideImagePrompts.slice(0, slideCount);
    } else if (draft.slides.some(s => s.role || s.headline)) {
      prompts = draft.slides.slice(0, slideCount).map((s, i) =>
        buildSlidePrompt(s, i, slideCount)
      );
    } else {
      prompts = parseImagePromptToSlidePrompts(draft.imagePrompt, slideCount);
    }

    while (prompts.length < slideCount) {
      prompts.push(`${SHARED_IMAGE_CONTEXT} Meditation carousel slide.`);
    }

    const images: string[] = [];
    for (let i = 0; i < slideCount; i++) {
      const slide = draft.slides[i];
      const isLastSlide = i === slideCount - 1;
      const isRecap = isLastSlide || slide?.role === 'recap';

      // ── Last slide: real app mockup, same as Google path ──
      if (isRecap) {
        try {
          const mockupPath = APP_MOCKUP_PATHS[Math.floor(Math.random() * APP_MOCKUP_PATHS.length)];
          const headline = slide?.headline || 'READY TO RESET?';
          const body = slide?.body || 'Download The School of Breath App\nfor guided sessions.';
          const mockupImage = await buildLastSlideFromMockup(mockupPath, headline, body);
          images.push(mockupImage);
          continue;
        } catch (e) {
          console.warn('App mockup compositor failed, falling back to OpenAI generation:', e);
        }
      }

      const base = prompts[i] || prompts[0] || 'Cosmic nebula meditation carousel slide';
      const prompt = (base + TYPOGRAPHY_GUIDANCE).slice(0, 4000);
      const dataUrl = await generateImageWithOpenAI(prompt, apiKey);
      images.push(dataUrl);
    }
    return { images, modelUsed: `OpenAI ${OPENAI_IMAGE_MODEL} (GPT Image)` };
  }

  return generateCarouselImages(draft);
}

/**
 * Regenerates a single slide image. Used when user wants to replace/redo one slide.
 * Optional changeInstruction: e.g. "Make the text larger" or "Fix the typo in the headline"
 */
export async function regenerateSingleSlideImage(
  post: {
    imagePrompt?: string;
    slideImagePrompts?: string[];
    slides: { text: string; role?: string; headline?: string; body?: string; stepNumber?: number; visualNotes?: string }[];
  },
  slideIndex: number,
  provider: ImageProvider,
  changeInstruction?: string
): Promise<string> {
  const slideCount = post.slides.length;
  let prompts: string[] = [];

  if (post.slideImagePrompts && post.slideImagePrompts.length >= slideCount) {
    prompts = post.slideImagePrompts.slice(0, slideCount);
  } else if (post.slides.some(s => s.role || s.headline)) {
    prompts = post.slides.slice(0, slideCount).map((s, i) =>
      buildSlidePrompt(s, i, slideCount)
    );
  } else if (post.imagePrompt) {
    prompts = parseImagePromptToSlidePrompts(post.imagePrompt, slideCount);
  }

  while (prompts.length < slideCount) {
    prompts.push(buildSlidePrompt(post.slides[prompts.length] || { text: 'Meditation carousel slide.' }, prompts.length, slideCount));
  }

  let base = prompts[slideIndex] || prompts[0] || `${SHARED_IMAGE_CONTEXT} Meditation carousel slide.`;
  if (changeInstruction?.trim()) {
    base = `${base} IMPORTANT CHANGE: ${changeInstruction.trim()}`;
  }
  const prompt = (base + TYPOGRAPHY_GUIDANCE).slice(0, provider === 'openai' ? 4000 : 600);

  if (provider === 'openai') {
    await ensureOpenAiImageAccess();
    const apiKey = (process.env.OPENAI_API_KEY as string | undefined)?.trim();
    if (!apiKey) throw new Error('OpenAI API key not configured');
    return generateImageWithOpenAI(prompt, apiKey);
  }

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: prompt,
    config: { responseModalities: ['TEXT', 'IMAGE'] },
  });
  const dataUrl = extractImageFromNanoBananaResponse(response);
  if (!dataUrl) throw new Error('Failed to regenerate image');
  return dataUrl;
}

// ─── Slide Prompt exposed for UI pre-fill ────────────────────────────────────

/**
 * Returns the generated image prompt for a specific slide index.
 * Used to pre-fill the Replace modal so the user sees what the AI already has.
 */
export function getSlidePromptForIndex(
  post: {
    imagePrompt?: string;
    slideImagePrompts?: string[];
    slides: { text: string; role?: string; headline?: string; body?: string; stepNumber?: number; visualNotes?: string }[];
  },
  slideIndex: number
): string {
  const slideCount = post.slides.length;

  // Priority 1: pre-generated slideImagePrompts
  if (post.slideImagePrompts && post.slideImagePrompts.length > slideIndex) {
    return post.slideImagePrompts[slideIndex];
  }

  // Priority 2: role-aware builder from slide data
  if (post.slides[slideIndex] && (post.slides[slideIndex].role || post.slides[slideIndex].headline)) {
    return buildSlidePrompt(post.slides[slideIndex], slideIndex, slideCount);
  }

  // Priority 3: parse the big imagePrompt block
  if (post.imagePrompt) {
    const parsed = parseImagePromptToSlidePrompts(post.imagePrompt, slideCount);
    if (parsed[slideIndex]) return parsed[slideIndex];
  }

  // Fallback
  return buildSlidePrompt(
    post.slides[slideIndex] || { text: 'Meditation carousel slide.' },
    slideIndex,
    slideCount
  );
}

// ─── AI Slide Prompt Suggestion ──────────────────────────────────────────────

/**
 * Asks Gemini to suggest a specific, brand-accurate improvement instruction
 * for a given slide image. Used in the Replace modal "✨ AI Suggest" button.
 */
export async function generateSlidePromptSuggestion(
  slide: {
    text: string;
    role?: string;
    headline?: string;
    body?: string;
    stepNumber?: number;
    visualNotes?: string;
  },
  slideIndex: number,
  totalSlides: number,
  currentPrompt: string
): Promise<string> {
  const slideLabel = slide.role
    ? `${slide.role.replace('_', ' ')} slide (slide ${slideIndex + 1} of ${totalSlides})`
    : `slide ${slideIndex + 1} of ${totalSlides}`;

  const headlineInfo = slide.headline ? `Headline: "${slide.headline}"` : '';
  const bodyInfo = slide.body ? `Body: "${slide.body}"` : '';

  const userMessage = `You are reviewing an Instagram carousel slide for @meditate_with_abhi (School of Breath brand).

Slide info:
- Role: ${slideLabel}
${headlineInfo}
${bodyInfo}
- Current image prompt: "${currentPrompt}"

Brand visual rules (DO NOT deviate):
- Background: deep dark cosmic nebula (#080614 → #1A1040), gold particle dust, sacred geometry overlay
- Typography: GOLD bold ALL-CAPS geometric sans for headline, WHITE regular sans for body
- Hero element per role:
  hook → glowing sacred geometry circle behind text
  second_hook → large gold numerals prominent center
  science → human body/nervous system silhouette with gold energy lines
  step → 3D golden glowing object (↑ arrow=inhale, cube=hold, ↓ arrow=exhale)
  recap → teal-dark gradient, iPhone mockup with School of Breath app, gold light rays

Based on the current prompt and slide content, suggest ONE specific, actionable improvement instruction (max 2 sentences).
Focus on: visual impact, text legibility, brand accuracy, or missing brand elements.
Return ONLY the improvement instruction text — no preamble, no explanation. Keep it short and directive.
Example: "Add a stronger golden neon bloom glow to the upward arrow. Make the headline text 30% larger and more centered with better contrast against the dark background."`;

  const response = await generateContentWithModelFallback(MODEL_CANDIDATES.draft, {
    contents: userMessage,
    config: {
      systemInstruction: 'You are a brand design director for @meditate_with_abhi. Return only the improvement instruction, nothing else.',
    },
  });

  const suggestion = response.text?.trim();
  if (!suggestion) throw new Error('No suggestion generated');
  return suggestion;
}

// ─── Last Slide App Mockup Compositor (Canvas) ───────────────────────────────

/** Paths to the real School of Breath app mockup images (served from /public/) */
export const APP_MOCKUP_PATHS = [
  '/mobile_app_references/app-mockup-1.png',
  '/mobile_app_references/app-mockup-2.png',
  '/mobile_app_references/app-mockup-3.png',
  '/mobile_app_references/app-mockup-4.png',
  '/mobile_app_references/app-mockup-5.png',
  '/mobile_app_references/app-mockup-6.png',
  '/mobile_app_references/app-mockup-7.png',
];

/**
 * Composites a real app mockup image with the CTA text overlay on a canvas.
 * Returns a base64 data URL. Used for the last (recap/CTA) slide.
 *
 * @param mockupPath - path to the app mockup image (from APP_MOCKUP_PATHS)
 * @param headline   - gold headline text (e.g. "READY TO RESET?")
 * @param body       - white body text (e.g. "Download The School of Breath App")
 */
export async function buildLastSlideFromMockup(
  mockupPath: string,
  headline: string,
  body: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      // Create a square 1080×1080 canvas
      const SIZE = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      // 1. Draw the source image centered + cropped to square
      const srcAspect = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (srcAspect > 1) {
        // wider than tall → crop sides
        sw = img.height;
        sx = (img.width - sw) / 2;
      } else {
        // taller than wide → crop top/bottom proportionally, favour center
        sh = img.width;
        sy = (img.height - sh) / 4; // slightly favour top-center
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SIZE, SIZE);

      // 2. Dark gradient overlay at bottom for text legibility
      const grad = ctx.createLinearGradient(0, SIZE * 0.55, 0, SIZE);
      grad.addColorStop(0, 'rgba(8,6,20,0)');
      grad.addColorStop(0.45, 'rgba(8,6,20,0.82)');
      grad.addColorStop(1, 'rgba(8,6,20,0.97)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // 3. Headline (gold, bold, centered)
      const headlineFontSize = 68;
      ctx.font = `900 ${headlineFontSize}px "Montserrat", "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Gold glow
      ctx.shadowColor = '#D4A820';
      ctx.shadowBlur = 28;
      ctx.fillStyle = '#F5C842';
      const headlineY = SIZE * 0.72;
      ctx.fillText(headline.toUpperCase(), SIZE / 2, headlineY);

      // 4. Body text (white, regular, centered)
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.font = `400 ${32}px "Montserrat", Arial, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      const bodyLines = body.split('\n');
      bodyLines.forEach((line, idx) => {
        ctx.fillText(line, SIZE / 2, headlineY + 80 + idx * 44);
      });

      // 5. Handle tag (small, white, bottom)
      ctx.shadowBlur = 0;
      ctx.font = `600 ${22}px "Montserrat", Arial, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText('@meditate_with_abhi  ·  School of Breath', SIZE / 2, SIZE - 36);

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error(`Failed to load app mockup: ${mockupPath}`));
    img.src = mockupPath;
  });
}

// ─── Video Reel Script Generator ────────────────────────────────────────────

const VIDEO_REEL_SYSTEM_PROMPT = `You are a senior short-form video creative + director.
You design viral Instagram Reels using a SCENE-BY-SCENE structure:
- One continuous voiceover script.
- 2–4 scenes, each with a clear duration and visual description.
- Vertical 9:16 format, 1080x1920, Instagram Reels style.

Rules:
- Hook in first 3 seconds, clear benefit, specific CTA at the end.
- No hard sell or fear-based language.
- Script must be speakable, natural, and timed realistically.
- Total duration ≈ targetDurationSeconds (tolerance ±2s).

You must output:
1) A single full voiceover script (just text to read).
2) A structured SCENE LIST with: index (0-based), start (seconds), end (seconds), duration (end - start), narrative (part of the script for this scene), visualPrompt (what the video should show).

Return JSON ONLY.`;

export async function generateVideoReelScript(
  videoReelInput: VideoReelInput,
  brandContext: BrandContext
): Promise<{ script: string; scenes: ReelScene[] }> {
  const systemPrompt = VIDEO_REEL_SYSTEM_PROMPT
    .replace('targetDurationSeconds', String(videoReelInput.targetDurationSeconds));

  let userPrompt = '';

  if (videoReelInput.mode === 'PROMPT_ONLY') {
    userPrompt = `User prompt / topic: "${videoReelInput.prompt}"

Content is for the brand:
  brand: ${brandContext.name}
  handle: ${brandContext.handle}
  niche: ${brandContext.niche}
  voice: ${brandContext.voice}
  pillars: ${brandContext.pillars}

Target duration: ${videoReelInput.targetDurationSeconds} seconds (±2s)
Language: ${videoReelInput.language}

Create:
- A full voiceover script.
- A 2–4 scene plan: hook → explanation/demo → benefit → CTA.

Return JSON ONLY in this exact shape:
{
  "script": "full voiceover...",
  "scenes": [
    {
      "index": 0,
      "start": 0,
      "end": 6,
      "duration": 6,
      "narrative": "...",
      "visualPrompt": "..."
    }
  ]
}`;
  } else if (videoReelInput.mode === 'FROM_REFERENCE_VIDEO') {
    userPrompt = `Topic / intent: "${videoReelInput.prompt}"

Brand:
  name: ${brandContext.name}, handle: ${brandContext.handle}
  niche: ${brandContext.niche}, voice: ${brandContext.voice}

We have a reference video: ${videoReelInput.referenceVideoUrl || ''}
Mimic its pacing and style (cuts, energy), but rewrite the script to match the brand and topic.

Target duration: ${videoReelInput.targetDurationSeconds}s (±2s), Language: ${videoReelInput.language}.

Return JSON ONLY with "script" and "scenes" as described.`;
  } else {
    // FROM_IMAGES
    const imageCount = videoReelInput.referenceImages?.length ?? 0;
    userPrompt = `Topic / intent: "${videoReelInput.prompt}"

Brand:
  name: ${brandContext.name}, handle: ${brandContext.handle}
  niche: ${brandContext.niche}, voice: ${brandContext.voice}

We have ${imageCount} reference image(s) uploaded to use as the main visual reference for scenes.

Target duration: ${videoReelInput.targetDurationSeconds}s (±2s), Language: ${videoReelInput.language}.

Return JSON ONLY with "script" and "scenes" as described.`;
  }

  const response = await generateContentWithModelFallback(MODEL_CANDIDATES.reels, {
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          script: {
            type: Type.STRING,
            description: 'The full continuous voiceover script.',
          },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                index: { type: Type.INTEGER },
                start: { type: Type.NUMBER },
                end: { type: Type.NUMBER },
                duration: { type: Type.NUMBER },
                narrative: { type: Type.STRING },
                visualPrompt: { type: Type.STRING },
              },
              required: ['index', 'start', 'end', 'duration', 'narrative', 'visualPrompt'],
            },
            description: '2–4 scenes with timing and visual direction.',
          },
        },
        required: ['script', 'scenes'],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Failed to generate video reel script');

  const data = JSON.parse(text);
  if (!data.script || !Array.isArray(data.scenes) || data.scenes.length === 0) {
    throw new Error('Invalid script/scenes response from AI');
  }

  return { script: data.script, scenes: data.scenes as ReelScene[] };
}

// ─── Post Content ────────────────────────────────────────────────────────────

/**
 * Assembles the final caption string from structured blocks.
 * Uses emoji numerals (1️⃣ 2️⃣ …) for the numbered points — the viral Instagram format.
 */
export function assembleCaptionFromBlocks(blocks: {
  hook: string;
  points: string[];
  microInstruction: string;
  cta: string;
}): string {
  const EMOJI_NUMS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
  const numberedPoints = blocks.points
    .map((pt, i) => `${EMOJI_NUMS[i] ?? `${i + 1}.`} ${pt}`)
    .join('\n');
  return [blocks.hook, numberedPoints, blocks.microInstruction, blocks.cta]
    .filter(Boolean)
    .join('\n\n');
}

// Shared caption schema properties used in both generate and regenerate
const CAPTION_SCHEMA_PROPERTIES = {
  title: {
    type: Type.STRING,
    description: 'Short post title, 3–5 words. e.g. "Bhastrika Breath", "Box Breathing Reset"',
  },
  hook: {
    type: Type.STRING,
    description:
      '1–2 short sentences max. Warm, direct opening. ' +
      'Example: "Your nervous system has a reset button." NEVER long paragraphs.',
  },
  points: {
    type: Type.ARRAY,
    items: { type: Type.STRING },
    description:
      'Array of 3–5 SHORT benefit/insight lines (do NOT include the numeral — added by UI). ' +
      'Each point: max 8 words. Focus on benefits and feelings, NOT step-by-step instructions. ' +
      'Example: "Calms your mind in seconds", "Activates your vagus nerve".',
  },
  microInstruction: {
    type: Type.STRING,
    description:
      'One ultra-short try-it line. Example: "Try tonight: 4 in · 4 hold · 4 out · repeat." Max 1–2 lines.',
  },
  cta: {
    type: Type.STRING,
    description:
      'Minimal CTA — 1–2 short lines. "💾 Save this." + "📲 School of Breath App → link in bio". Keep it clean.',
  },
  hashtags: {
    type: Type.ARRAY,
    items: { type: Type.STRING },
    description:
      'Exactly 18 hashtags WITHOUT the # symbol. Mix: technique-specific, audience, brand, wellness. ' +
      'Always include: MeditateWithAbhi, SchoolOfBreath, Breathwork.',
  },
};

const CAPTION_SYSTEM_PROMPT = `You are the caption writer for @meditate_with_abhi / School of Breath.

INSTAGRAM CAPTION STYLE (simple, direct, clean):
=================================================
Write like a real Instagram creator — short, warm, direct. NOT a blog post.
The caption should feel like a friend sharing something powerful in a few lines.

BLOCK 1 — HOOK (1–2 short lines):
One compassionate opening line. Direct and warm.
Example: "Your nervous system has a reset button."
→ NEVER fear-based, never shaming, never long.

BLOCK 2 — KEY POINTS (3–5 items):
Short, punchy benefit or insight lines. NOT step-by-step instructions.
Each point: max 8 words. Focus on BENEFITS and FEELINGS, not how-to steps.
Example points: "Calms your mind in seconds", "Activates your vagus nerve", "Used by Navy SEALs worldwide"
Do NOT include the numeral — the UI adds emoji numerals automatically.

BLOCK 3 — MICRO-INSTRUCTION (1–2 lines):
One simple try-it line. Keep it ultra short.
Example: "Try tonight: 4 in · 4 hold · 4 out · repeat."

BLOCK 4 — CTA (1–2 lines):
"💾 Save this." + "📲 School of Breath App → link in bio"
Keep it minimal. One or two short lines max.

OVERALL RULES:
- Total caption should be SHORT — under 150 words.
- Max 3–4 emojis total. Use sparingly: 🌬️ ✨ 💾 📲
- Tone: calm, warm, poetic. Like a meditation teacher's Instagram.
- NEVER write long paragraphs or detailed explanations.
- HASHTAGS: Exactly 18 tags (no # prefix). Always include: MeditateWithAbhi, SchoolOfBreath, Breathwork.
- TITLE: 3–5 words, post title.`;

/**
 * Generates structured Instagram post content: title, captionBlocks, assembled caption, 18 hashtags.
 */
export async function generatePostContent(draftTopic: string, slidesText: string[]) {
  const slidesSummary = slidesText.map((s, i) => `Slide ${i + 1}: ${s}`).join('\n');
  const prompt =
    `Create a viral Instagram caption for @meditate_with_abhi for a carousel about "${draftTopic}".\n\n` +
    `Slide content:\n${slidesSummary}`;

  const response = await generateContentWithModelFallback(MODEL_CANDIDATES.post, {
    contents: prompt,
    config: {
      systemInstruction: CAPTION_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: CAPTION_SCHEMA_PROPERTIES,
        required: ['title', 'hook', 'points', 'microInstruction', 'cta', 'hashtags'],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Failed to generate post content');

  const data = JSON.parse(text);

  // Normalise hashtags to exactly 18
  let hashtags: string[] = data.hashtags || [];
  if (hashtags.length > 18) hashtags = hashtags.slice(0, 18);
  const brandFallbacks = ['MeditateWithAbhi', 'SchoolOfBreath', 'Breathwork', 'Meditation', 'NervousSystemReset', 'VagusNerve'];
  while (hashtags.length < 18) hashtags.push(brandFallbacks[hashtags.length % brandFallbacks.length]);
  data.hashtags = hashtags;

  // Build structured blocks
  const captionBlocks = {
    hook: data.hook || '',
    points: Array.isArray(data.points) ? data.points : [],
    microInstruction: data.microInstruction || '',
    cta: data.cta || '',
  };
  data.captionBlocks = captionBlocks;

  // Assemble flat caption for backward-compat
  data.caption = assembleCaptionFromBlocks(captionBlocks);

  return data;
}

// ─── Regenerate Caption ──────────────────────────────────────────────────────

/**
 * Regenerates caption blocks with an optional specific instruction.
 * Keeps all brand voice and viral format rules.
 */
export async function regenerateCaption(
  topic: string,
  slidesText: string[],
  currentBlocks: { hook: string; points: string[]; microInstruction: string; cta: string },
  instruction?: string
): Promise<{ captionBlocks: typeof currentBlocks; caption: string; hashtags: string[] }> {
  const slidesSummary = slidesText.map((s, i) => `Slide ${i + 1}: ${s}`).join('\n');

  const instructionSection = instruction?.trim()
    ? `\n\nSPECIFIC CHANGE REQUESTED: ${instruction.trim()}\nApply this change while keeping all brand voice and format rules.`
    : '';

  const currentCaption = assembleCaptionFromBlocks(currentBlocks);

  const prompt =
    `Rewrite the Instagram caption for @meditate_with_abhi about "${topic}".\n\n` +
    `Slide content:\n${slidesSummary}\n\n` +
    `Current caption:\n${currentCaption}` +
    instructionSection;

  const response = await generateContentWithModelFallback(MODEL_CANDIDATES.post, {
    contents: prompt,
    config: {
      systemInstruction:
        CAPTION_SYSTEM_PROMPT +
        '\n\nIMPORTANT: If a specific change is requested, apply it precisely while keeping all other brand rules intact.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: CAPTION_SCHEMA_PROPERTIES,
        required: ['title', 'hook', 'points', 'microInstruction', 'cta', 'hashtags'],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Failed to regenerate caption');

  const data = JSON.parse(text);

  let hashtags: string[] = data.hashtags || [];
  if (hashtags.length > 18) hashtags = hashtags.slice(0, 18);
  const brandFallbacks = ['MeditateWithAbhi', 'SchoolOfBreath', 'Breathwork', 'Meditation', 'NervousSystemReset', 'VagusNerve'];
  while (hashtags.length < 18) hashtags.push(brandFallbacks[hashtags.length % brandFallbacks.length]);

  const captionBlocks = {
    hook: data.hook || currentBlocks.hook,
    points: Array.isArray(data.points) && data.points.length > 0 ? data.points : currentBlocks.points,
    microInstruction: data.microInstruction || currentBlocks.microInstruction,
    cta: data.cta || currentBlocks.cta,
  };

  return {
    captionBlocks,
    caption: assembleCaptionFromBlocks(captionBlocks),
    hashtags,
  };
}
