import { GoogleGenAI, Type } from '@google/genai';
import { BrandContext, VideoReelInput, ReelScene } from '../types';

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

export async function generateDraft(topic?: string) {
  const prompt = topic 
    ? `Generate an 8-slide Instagram carousel draft about "${topic}" for the brand "The School of Breath".`
    : `Generate an 8-slide Instagram carousel draft about a random meditation or mindfulness topic for the brand "The School of Breath".`;

  const response = await generateContentWithModelFallback(MODEL_CANDIDATES.draft, {
    contents: prompt,
    config: {
      systemInstruction: `You are the "Carousel Catalyst," an AI optimized to translate minimalist content scripts into highly detailed, context-aware image generation prompts. Your core objective is to create a prompt that instructs an AI image generator (like ChatGPT/DALL-E or Midjourney) to generate 8 INDIVIDUAL, high-resolution square images for an Instagram Carousel.

1. BRAND & VISUAL CONSISTENCY
- Visual Style: A sophisticated, high-end fusion of spirituality and science. Minimal, clean, and elegant.
- Background: A deep, rich, dark cosmic field (deep blues, purples, and black). It must contain swirling gold nebulae and sparkling gold dust particles.
- Aesthetic Overlays: Every image must include semi-transparent golden glowing sacred geometry overlays (e.g., Metatron’s Cube, intricate mandalas, connecting lines).
- Typography: Elegant, luxurious golden serif font for HEADERS. Clean, crisp, glowing white sans-serif font for BODY text.

2. SCRIPT INTERPRETATION & LAYOUT
- You must write a prompt that explicitly asks the AI to generate 8 SEPARATE images, not a grid.
- For each script point, invent a powerful visual metaphor using the brand's on-image aesthetic.

3. MANDATORY MARKETING RULE (THE FINAL SLIDE)
- Slide 8 MUST be the conversion and brand marketing slide.
- Visual: A stylized smartphone displaying the "School of Breath" app's central UI. Framed by the cosmic background and subtle glowing profiles of a man and woman.
- CTA Text: Header: "READY TO RESET?", Body: "Download The School of Breath App."
- Badges: White sans-serif text blocks: "Mental Clarity, Body: Tension Release." Below these, Apple App Store and Google Play logos with gold CTA button: "DOWNLOAD NOW."
- TYPOGRAPHY: All text must be spelled correctly with perfect orthography and no letter errors.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topic: {
            type: Type.STRING,
            description: "The main topic or title of the carousel.",
          },
          slides: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: {
                  type: Type.STRING,
                  description: "The text content for this specific slide.",
                }
              },
              required: ["text"]
            },
            description: "Exactly 8 slides for the carousel. Slide 8 MUST be the marketing CTA.",
          },
          imagePrompt: {
            type: Type.STRING,
            description: "The COMPLETE, comprehensive prompt to copy/paste into ChatGPT or another AI. Format EXACTLY like this:\n\n---[START PROMPT]---\nPlease generate 8 separate, individual high-resolution square images for an Instagram Carousel. DO NOT make a grid. Generate them one by one.\n\nThe overall background for all images is a deep, dark cosmic nebula with swirling gold particles. All images share a glowing gold sacred geometry (mandala) overlay effect. Text should be in a luxurious gold serif (HEADER) or clean white sans-serif (BODY).\n\n**Image 1 (Header/Title):** [METAPHOR] + TEXT: **[GOLD HEADER]** + [WHITE BODY]\n[... Images 2-7 ...]\n**Image 8 (The Marketing Close):** A smartphone displaying the full \"School of Breath\" app interface. Background features glowing profiles of a man and woman. Header (Gold Serif): **READY TO RESET?** Body (White Sans-Serif): **Download \"The School of Breath\" App.** Includes official Google Play and Apple App Store logos. Gold button text (White Sans-Serif): **DOWNLOAD NOW.**\n---[END PROMPT]---",
          },
          slideImagePrompts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Exactly 8 separate prompts (each under 400 chars), one per slide, for Imagen API. Each prompt must be self-contained: include background (cosmic nebula, gold particles, sacred geometry overlay), typography, and the specific content for that slide.",
          }
        },
        required: ["topic", "slides", "imagePrompt"]
      }
    },
  });

  const text = response.text;
  if (!text) throw new Error("Failed to generate draft");
  
  const data = JSON.parse(text);
  // Ensure exactly 8 slides, pad or truncate if necessary
  let slides = data.slides || [];
  if (slides.length > 8) slides = slides.slice(0, 8);
  while (slides.length < 8) {
    slides.push({ text: "Breathe in, breathe out." });
  }
  data.slides = slides;

  // Ensure exactly 8 slideImagePrompts for Imagen generation
  let slideImagePrompts = data.slideImagePrompts || [];
  if (slideImagePrompts.length > 8) slideImagePrompts = slideImagePrompts.slice(0, 8);
  while (slideImagePrompts.length < 8) {
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

const SHARED_IMAGE_CONTEXT =
  'Square high-resolution image for Instagram carousel. Deep dark cosmic nebula with swirling gold particles. Glowing gold sacred geometry mandala overlay. Luxurious gold serif for headers, clean white sans-serif for body text.';

const TYPOGRAPHY_GUIDANCE =
  ' Ensure all text in the image is spelled correctly with perfect typography and no orthographic or letter errors.';

/**
 * Parses the Step 1 imagePrompt (copy-paste prompt) into 8 per-slide prompts.
 * Expects format: **Image 1 (Header/Title):** ... **Image 2:** ... etc.
 */
function parseImagePromptToSlidePrompts(imagePrompt: string): string[] {
  const prompts: string[] = [];
  const pattern = /\*\*Image (\d+)(?:[^*]*)?:\*\*\s*([\s\S]*?)(?=\*\*Image \d+|---\[END|$)/gi;
  let match: RegExpExecArray | null;
  const byIndex: Record<number, string> = {};

  while ((match = pattern.exec(imagePrompt)) !== null) {
    const idx = parseInt(match[1], 10);
    const content = match[2].trim();
    if (idx >= 1 && idx <= 8 && content) {
      byIndex[idx] = `${SHARED_IMAGE_CONTEXT} ${content}`.slice(0, 480);
    }
  }

  for (let i = 1; i <= 8; i++) {
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
 * Generates 8 carousel slide images using Nano Banana (Gemini native image generation).
 * Uses draft.imagePrompt (Step 1 prompt) parsed into 8 per-slide prompts.
 * Falls back to slideImagePrompts or slides if parsing yields fewer than 8.
 */
export async function generateCarouselImages(draft: {
  imagePrompt: string;
  slides: { text: string }[];
  slideImagePrompts?: string[];
}): Promise<GenerateCarouselImagesResult> {
  let prompts = parseImagePromptToSlidePrompts(draft.imagePrompt);

  if (prompts.length < 8) {
    prompts =
      draft.slideImagePrompts && draft.slideImagePrompts.length >= 8
        ? draft.slideImagePrompts.slice(0, 8)
        : draft.slides.slice(0, 8).map(
            (s) =>
              `${SHARED_IMAGE_CONTEXT} Content: ${(s.text || '').slice(0, 200)}`.slice(0, 480)
          );
  }

  while (prompts.length < 8) {
    prompts.push(`${SHARED_IMAGE_CONTEXT} Meditation carousel slide.`);
  }

  const images: string[] = [];

  for (let i = 0; i < 8; i++) {
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

// ─── OpenAI (GPT Image 1.5) Image Generation ───────────────────────────────────
// GPT Image 1.5 is OpenAI's flagship image model (replaces DALL·E 3, deprecated May 2026).
// Better text rendering, prompt adherence, and design-system constraints for carousel slides.

const OPENAI_IMAGE_MODEL = 'gpt-image-1.5';

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
    slides: { text: string }[];
    slideImagePrompts?: string[];
  },
  provider: ImageProvider
): Promise<GenerateCarouselImagesResult> {
  if (provider === 'openai') {
    const apiKey = (process.env.OPENAI_API_KEY as string | undefined)?.trim();
    if (!apiKey) throw new Error('OpenAI API key not configured. Add OPENAI_API_KEY to .env');

    let prompts = parseImagePromptToSlidePrompts(draft.imagePrompt);
    if (prompts.length < 8) {
      prompts =
        draft.slideImagePrompts && draft.slideImagePrompts.length >= 8
          ? draft.slideImagePrompts.slice(0, 8)
          : draft.slides.slice(0, 8).map(
              (s) =>
                `${SHARED_IMAGE_CONTEXT} Content: ${(s.text || '').slice(0, 200)}`.slice(0, 480)
            );
    }
    while (prompts.length < 8) {
      prompts.push(`${SHARED_IMAGE_CONTEXT} Meditation carousel slide.`);
    }

    const images: string[] = [];
    for (let i = 0; i < 8; i++) {
      const base = prompts[i] || prompts[0] || 'Cosmic nebula meditation carousel slide';
      const prompt = (base + TYPOGRAPHY_GUIDANCE).slice(0, 4000);
      const dataUrl = await generateImageWithOpenAI(prompt, apiKey);
      images.push(dataUrl);
    }
    return { images, modelUsed: `OpenAI ${OPENAI_IMAGE_MODEL} (GPT Image 1.5)` };
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
    slides: { text: string }[];
  },
  slideIndex: number,
  provider: ImageProvider,
  changeInstruction?: string
): Promise<string> {
  let prompts = post.imagePrompt ? parseImagePromptToSlidePrompts(post.imagePrompt) : [];
  if (prompts.length < 8 && post.slideImagePrompts && post.slideImagePrompts.length >= 8) {
    prompts = post.slideImagePrompts.slice(0, 8);
  }
  if (prompts.length < 8) {
    prompts = post.slides.slice(0, 8).map(
      (s) =>
        `${SHARED_IMAGE_CONTEXT} Content: ${(s.text || '').slice(0, 200)}`.slice(0, 480)
    );
  }
  while (prompts.length < 8) {
    prompts.push(`${SHARED_IMAGE_CONTEXT} Meditation carousel slide.`);
  }

  let base = prompts[slideIndex] || prompts[0] || `${SHARED_IMAGE_CONTEXT} Meditation carousel slide.`;
  if (changeInstruction?.trim()) {
    base = `${base} IMPORTANT CHANGE: ${changeInstruction.trim()}`;
  }
  const prompt = (base + TYPOGRAPHY_GUIDANCE).slice(0, provider === 'openai' ? 4000 : 600);

  if (provider === 'openai') {
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

export async function generatePostContent(draftTopic: string, slidesText: string[]) {
  const prompt = `Generate an Instagram caption, 18 relevant hashtags, and a catchy title for a carousel post about "${draftTopic}". The slides contain the following text:\n${slidesText.map((s, i) => `Slide ${i+1}: ${s}`).join('\n')}`;

  const response = await generateContentWithModelFallback(MODEL_CANDIDATES.post, {
    contents: prompt,
    config: {
      systemInstruction: "You are an expert Instagram content creator for a meditation and mindfulness account named 'Meditate with Abhi'. Create engaging captions that encourage interaction and save-worthy content.",
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "A catchy, short title for the post.",
          },
          caption: {
            type: Type.STRING,
            description: "The main caption for the Instagram post. Include a hook, value, and call to action.",
          },
          hashtags: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description: "Exactly 18 relevant hashtags, without the # symbol.",
          }
        },
        required: ["title", "caption", "hashtags"]
      }
    },
  });

  const text = response.text;
  if (!text) throw new Error("Failed to generate post content");
  
  const data = JSON.parse(text);
  
  // Ensure exactly 18 hashtags
  let hashtags = data.hashtags || [];
  if (hashtags.length > 18) hashtags = hashtags.slice(0, 18);
  while (hashtags.length < 18) {
    hashtags.push("meditation");
  }
  data.hashtags = hashtags;

  return data;
}
