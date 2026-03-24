/**
 * videoReelService.ts
 *
 * Video Reel script + caption generation.
 * Prompt logic mirrors MeditatewithAbhiInstagramauto/src/lib/aiService.ts exactly:
 *   - Same brand context (buildReelBrandPrompt → School of Breath)
 *   - Same format instructions: Hook(5s) / Value(20s) / CTA(5s) for 30s, Hook/Story/Value/CTA for 60s
 *   - Same output schema: { headline, body, cta, hashtags, brandScore }
 *
 * Additionally generates scenes for the Fal video pipeline (kept separate from UI).
 * Kept separate from geminiService.ts (carousel / post logic).
 */

import { GoogleGenAI, Type } from '@google/genai';
import { VideoReelInput, ReelScene } from '../types';
import { buildReelBrandPrompt } from '../lib/reelBrandContext';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL_REELS,
  'gemini-3.1-pro-preview',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
].filter(Boolean) as string[];

function isModelNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('not found') || message.includes('NOT_FOUND');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateWithFallback(prompt: string, schema: any) {
  let lastError: unknown;
  for (const model of MODEL_CANDIDATES) {
    try {
      return await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });
    } catch (error) {
      lastError = error;
      if (!isModelNotFoundError(error)) throw error;
    }
  }
  throw lastError ?? new Error('No Gemini model candidates were configured');
}

/**
 * Dynamic format instruction based on actual target duration.
 * Mirrors the reference project pattern but handles all durations.
 */
function getFormatInstructions(s: number): string {
  if (s <= 20) {
    return `Write a ${s}-second reel script with Hook (3s), Value (${s - 6}s), CTA (3s)`;
  }
  if (s <= 30) {
    return `Write a ${s}-second reel script with Hook (5s), Value (${s - 10}s), CTA (5s)`;
  }
  if (s <= 45) {
    return `Write a ${s}-second reel script with Hook (5s), Story (10s), Value (${s - 20}s), CTA (5s)`;
  }
  return `Write a ${s}-second reel script with Hook (5s), Story (15s), Value (${s - 25}s), CTA (5s)`;
}

/** Body sentence count tied to duration so the script is proportionally long */
function getBodyLengthRule(s: number): string {
  if (s <= 20) return '2-3 sentences';
  if (s <= 30) return '4-6 sentences';
  if (s <= 45) return '6-9 sentences';
  return '9-14 sentences';
}

function getOutputSchemaInstructions(targetDurationSeconds: number): string {
  const bodyLength = getBodyLengthRule(targetDurationSeconds);
  return `Respond with valid JSON only (no markdown). JSON shape:
{
  "headline": string,
  "body": string,
  "caption": string,
  "cta": string,
  "hashtags": string[],
  "brandScore": number,
  "scenes": [
    { "index": number, "start": number, "end": number, "duration": number, "narrative": string, "visualPrompt": string }
  ]
}

SCRIPT rules (headline + body + cta):
- headline: one punchy sentence that stops the scroll in the first 3 seconds.
- body: the FULL voiceover narrative. Flowing, speakable prose. Blend science + spiritual wisdom. Include: the relatable problem, the physiological explanation (vagus nerve, nervous system, breath mechanics), the practical technique with exact breath counts, and the felt benefit. Write EVERY word the viewer hears aloud. ${bodyLength} for a ${targetDurationSeconds}s reel.
- cta: soft call-to-action, 1 line (e.g. "Save this and try it tonight").

CAPTION rules (separate from the script — this is what appears as the Instagram post text):
- caption: a viral Instagram caption. Exactly 4 lines, no more. Total length 130–180 characters (not counting hashtags).
  Line 1 (hook): 1 punchy sentence, max 60–80 characters. Must fit before feed truncation. No emoji.
  Lines 2–3 (micro story): 1 short idea per line, 5–8 words each. Benefit, mechanism, or felt result. Calm and grounded tone.
  Line 4 (CTA): 1 line, max 8 words. Soft action (save, try tonight, share, comment).
  Rules: no bullet points, no dashes, no emojis, no hashtags inside this field. Plain readable lines only.

OTHER rules:
- brandScore: self-score for brand alignment (0-100).
- hashtags: 7-10 relevant hashtag strings (e.g. "#breathwork").
- scenes: 2-4 scene breakdown with start/end seconds summing to ${targetDurationSeconds}s.`;
}

export interface VideoReelContent {
  headline: string;
  body: string;
  cta: string;
  hashtags: string[];
  brandScore: number;
  /** headline + body + cta assembled — used for Fal TTS */
  script: string;
  /** Full Instagram caption with hashtags */
  caption: string;
  scenes: ReelScene[];
}

export async function generateVideoReelContent(
  input: VideoReelInput
): Promise<VideoReelContent> {
  const formatInstructions = getFormatInstructions(input.targetDurationSeconds);
  const schemaInstructions = getOutputSchemaInstructions(input.targetDurationSeconds);

  const topicLine = `Topic: "${input.prompt}"${input.language !== 'en' ? `\nLanguage: ${input.language}` : ''}`;

  const fullPrompt = buildReelBrandPrompt(
    [formatInstructions, topicLine, schemaInstructions].join('\n\n')
  );

  const response = await generateWithFallback(fullPrompt, {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: 'Hook — grabs attention in first 3 seconds.' },
      body: { type: Type.STRING, description: 'Full voiceover body — flowing, speakable prose.' },
      caption: { type: Type.STRING, description: 'Short viral Instagram caption (3-4 lines, no hashtags).' },
      cta: { type: Type.STRING, description: 'Soft call-to-action at the end.' },
      hashtags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Array of hashtag strings.',
      },
      brandScore: { type: Type.NUMBER, description: 'Self-score for brand alignment (0-100).' },
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
        description: '2–4 scenes with timing and visual direction for the Fal pipeline.',
      },
    },
    required: ['headline', 'body', 'caption', 'cta', 'hashtags', 'brandScore', 'scenes'],
  });

  const text = response.text;
  if (!text) throw new Error('Failed to generate video reel content');

  const data = JSON.parse(text) as {
    headline: string;
    body: string;
    caption: string;
    cta: string;
    hashtags: string[];
    brandScore: number;
    scenes: ReelScene[];
  };

  if (!data.headline || !data.body || !data.cta) {
    throw new Error('Invalid response from AI — missing headline/body/cta');
  }

  // Full voiceover script: headline + body + cta joined (for Fal TTS)
  const script = [data.headline, data.body, data.cta].filter(Boolean).join('\n\n');

  // Caption: AI-generated short viral caption + hashtags appended
  const caption = [
    data.caption || data.headline,
    '',
    (data.hashtags ?? []).join(' '),
  ].filter(Boolean).join('\n');

  return {
    headline: data.headline,
    body: data.body,
    cta: data.cta,
    hashtags: data.hashtags ?? [],
    brandScore: data.brandScore ?? 0,
    script,
    caption,
    scenes: data.scenes ?? [],
  };
}
