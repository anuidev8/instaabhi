/**
 * videoReelService.ts
 *
 * Reel/Short script + metadata generation for Meditate with Abhi.
 * Supports:
 * - Direct script generation (PROMPT_ONLY)
 * - Reference-source guided generation (YouTube / Instagram / MP4 URL / images)
 *
 * The service returns a normalized production plan:
 * - 3–5 scenes
 * - each scene exactly 8s
 * - scene-level camera movement + transition guidance
 * - Instagram caption + YouTube description metadata
 */

import { GoogleGenAI, Type } from '@google/genai';
import { ReelScene, ReelTransitionType, VideoReelInput } from '../types';
import { buildReelBrandPrompt } from '../lib/reelBrandContext';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL_REELS,
  'gemini-3.1-pro-preview',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
].filter(Boolean) as string[];
const REFERENCE_ANALYSIS_MODEL = 'gemini-2.5-flash';
const MAX_REFERENCE_IMAGES_FOR_ANALYSIS = 3;

const MIN_REEL_DURATION_SECONDS = 15;
const MAX_REEL_DURATION_SECONDS = 60;
const SCENE_DURATION_SECONDS = 8;
const MIN_SCENE_COUNT = 3;
const MAX_SCENE_COUNT = 5;

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

function clampDuration(seconds: number): number {
  const rounded = Math.round(seconds || 0);
  return Math.min(MAX_REEL_DURATION_SECONDS, Math.max(MIN_REEL_DURATION_SECONDS, rounded));
}

function getSceneCount(targetDurationSeconds: number): number {
  const estimated = Math.round(targetDurationSeconds / SCENE_DURATION_SECONDS);
  return Math.min(MAX_SCENE_COUNT, Math.max(MIN_SCENE_COUNT, estimated));
}

function getNormalizedDuration(sceneCount: number): number {
  return sceneCount * SCENE_DURATION_SECONDS;
}

function getBodyLengthRule(seconds: number): string {
  if (seconds <= 24) return '4-6 sentences';
  if (seconds <= 32) return '6-8 sentences';
  if (seconds <= 40) return '8-10 sentences';
  return '10-14 sentences';
}

function inferKindLabel(input: VideoReelInput): string {
  if (input.referenceVideoKind) return input.referenceVideoKind;
  if (input.mode === 'PROMPT_ONLY') return 'PROMPT_ONLY';
  if (input.mode === 'FROM_IMAGES') return 'IMAGE_REFERENCES';
  return 'DIRECT_URL';
}

function getSourceInstructions(input: VideoReelInput, analysisSummary?: string): string {
  if (input.mode === 'PROMPT_ONLY') {
    return `FLOW TYPE: Direct script generation.
- No reference media is provided.
- Generate a complete fresh concept from the topic only.`;
  }

  if (input.mode === 'FROM_IMAGES') {
    const imageCount = input.referenceImages?.length ?? 0;
    return `FLOW TYPE: Visual-reference generation.
- ${imageCount} reference image(s) are provided.
- Keep one consistent protagonist identity and visual style from those images.
- Build scenes around breathwork demonstration continuity.
${analysisSummary ? `- Gemini reference analysis summary (must use):\n${analysisSummary}` : ''}`;
  }

  const sourceKind = inferKindLabel(input);
  return `FLOW TYPE: Reference-video analysis.
- Source kind: ${sourceKind}
- Source URL: ${input.referenceVideoUrl || 'not provided'}
- Source title/context: ${input.referenceVideoTitle || input.prompt}
- Analyze the source for: dialogue intent, breathing demos, hand gestures, energy peaks, technique explanations.
- Then produce NEW short-form content with the same protagonist/style and a fresh hook for retention.
${analysisSummary ? `- Gemini reference analysis summary (must use):\n${analysisSummary}` : ''}`;
}

function dataUrlToInlineDataPart(dataUrl: string): { inlineData: { mimeType: string; data: string } } {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match || !match[3]) throw new Error('Invalid image data URL');
  const mimeType = match[1] || 'image/png';
  return { inlineData: { mimeType, data: match[3] } };
}

async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function analyzeReferenceForPlanning(input: VideoReelInput): Promise<string> {
  try {
    if (input.mode === 'FROM_IMAGES' && (input.referenceImages?.length ?? 0) > 0) {
      const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        {
          text: `Analyze these visual references for short-form continuity planning.
Return concise plain text:
- character identity cues
- environment/style cues
- continuity constraints across 3-5 scenes
- direction for topic: "${input.prompt}"`,
        },
        ...input.referenceImages!
          .slice(0, MAX_REFERENCE_IMAGES_FOR_ANALYSIS)
          .map(dataUrlToInlineDataPart),
      ];
      const response = await ai.models.generateContent({
        model: REFERENCE_ANALYSIS_MODEL,
        contents,
      });
      return (response.text || '').trim();
    }

    if (input.mode === 'FROM_REFERENCE_VIDEO' && input.referenceVideoUrl) {
      const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        {
          text: `Analyze this source video for reel planning.
Return concise plain text with:
- speech/transcript summary
- top visual moments (breath demos, hand gestures, closeups)
- top audio moments (voice intensity, breath sounds, technique emphasis)
- 3-5 best 8s clip window suggestions
Topic: "${input.prompt}"
Source title/context: ${input.referenceVideoTitle || input.prompt}
Source URL: ${input.referenceVideoUrl}`,
        },
      ];

      try {
        const videoRes = await fetch(input.referenceVideoUrl);
        if (videoRes.ok) {
          const videoBlob = await videoRes.blob();
          if (videoBlob.size > 0) {
            const base64 = await blobToBase64(videoBlob);
            contents.push({
              inlineData: {
                mimeType: videoBlob.type || 'video/mp4',
                data: base64,
              },
            });
          }
        }
      } catch {
        // Fallback: URL-only context still useful.
      }

      const response = await ai.models.generateContent({
        model: REFERENCE_ANALYSIS_MODEL,
        contents,
      });
      return (response.text || '').trim();
    }
  } catch {
    // Keep planning resilient when analysis fails.
  }
  return '';
}

function getOutputSchemaInstructions(
  targetDurationSeconds: number,
  sceneCount: number,
  normalizedDurationSeconds: number,
  mode: VideoReelInput['mode']
): string {
  const bodyLength = getBodyLengthRule(targetDurationSeconds);
  const isReferenceVideo = mode === 'FROM_REFERENCE_VIDEO';
  return `Respond with valid JSON only (no markdown). JSON shape:
{
  "headline": string,
  "body": string,
  "cta": string,
  "instagramCaption": string,
  "youtubeDescription": string,
  "hashtags": string[],
  "brandScore": number,
  "sourceAnalysisSummary": string,
  "scenes": [
    {
      "index": number,
      "start": number,
      "end": number,
      "duration": number,
      "narrative": string,
      "visualPrompt": string,
      "sourceStart": number,
      "sourceEnd": number,
      "cameraMovement": string,
      "transitionToNext": "zoomwipe" | "ripple" | "cosmicwipe" | "fade" | "none",
      "overlayText": string
    }
  ]
}

SCRIPT rules:
- headline: one punchy opening line for first 3 seconds.
- body: full speakable voiceover. Include physiological mechanism + practical breath counts + felt benefits. ${bodyLength} for a ${normalizedDurationSeconds}s reel.
- cta: one soft action line ("Save and try now", etc).

SCENE rules (critical):
- Exactly ${sceneCount} scenes.
- Each scene duration must be exactly ${SCENE_DURATION_SECONDS}s.
- start/end must be continuous and sum to ${normalizedDurationSeconds}s.
- Scene 1 cameraMovement should be slow zoom in (hook).
- Scene 2-3 cameraMovement should be dynamic pan with hand-following.
- Scene 4 cameraMovement should be subtle shake + zoom out (science emphasis) if it exists.
- Final scene cameraMovement should be quick zoom in with cosmic particle energy.
- transitionToNext should be set for each scene except last (last can be "none").
- overlayText should be minimal, brand aligned (breath counters, chakra cue, timer cue, or technique name).
${isReferenceVideo ? '- Because this is REFERENCE_VIDEO mode, each scene MUST include sourceStart/sourceEnd from the original source video and each source clip must be exactly 8s.\n- sourceStart/sourceEnd should point to the most engaging moments (breath demos, gesture peaks, vocal emphasis).' : ''}

METADATA rules:
- instagramCaption: viral style, 4-7 short lines. Include a save CTA. No markdown.
- youtubeDescription: concise shorts description with title-like first line, value summary, CTA links placeholders.
- hashtags: 8-12 tags, include #MeditateWithAbhi and #TheSchoolOfBreath.

QUALITY rules:
- Keep tone science-meets-spirit, calm and empowering.
- Stay inside 15-60s standards by using ${sceneCount} x ${SCENE_DURATION_SECONDS}s scenes.
- Return JSON only.`;
}

function getDefaultCameraMovement(index: number, total: number): string {
  if (index === 0) return 'Slow zoom in on face/chest during hook breath.';
  if (index === total - 1) return 'Quick zoom in on face with subtle cosmic particles.';
  if (index === 3) return 'Subtle camera shake + slight zoom out for physiology reveal.';
  return 'Dynamic left-right pan following hands and breath rhythm.';
}

function getDefaultTransition(index: number, total: number): ReelTransitionType {
  if (index >= total - 1) return 'none';
  if (index === 0) return 'zoomwipe';
  if (index === 1) return 'ripple';
  if (index === 2) return 'cosmicwipe';
  return 'fade';
}

function getDefaultOverlay(index: number, total: number): string {
  if (index === 0) return 'Inhale 4s • Hold 4s • Exhale 6s';
  if (index === 1) return 'KAPALABHATI';
  if (index === 2) return 'Timer: Round 2';
  if (index === total - 1) return 'Save + Try Tonight';
  return 'Third Eye focus • steady rhythm';
}

function normalizeSceneNarrative(narrative: string, fallback: string): string {
  const clean = (narrative || '').trim();
  return clean || fallback;
}

function normalizeHashtags(hashtags: unknown): string[] {
  if (!Array.isArray(hashtags)) return [];
  const normalized = hashtags
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag.replace(/\s+/g, '')}`));

  const unique = Array.from(new Set(normalized));
  return unique.slice(0, 12);
}

function ensureBrandHashtags(tags: string[]): string[] {
  const required = ['#MeditateWithAbhi', '#TheSchoolOfBreath'];
  const existing = new Set(tags.map((t) => t.toLowerCase()));
  const merged = [...tags];
  for (const requiredTag of required) {
    if (!existing.has(requiredTag.toLowerCase())) merged.push(requiredTag);
  }
  return merged.slice(0, 12);
}

function normalizeScenes(
  rawScenes: unknown,
  sceneCount: number,
  fallbackText: string,
  options: { isReferenceVideo: boolean }
): ReelScene[] {
  const list = Array.isArray(rawScenes) ? rawScenes : [];

  const scenes: ReelScene[] = [];
  for (let i = 0; i < sceneCount; i += 1) {
    const raw = (list[i] ?? {}) as Partial<ReelScene>;
    const start = i * SCENE_DURATION_SECONDS;
    const end = start + SCENE_DURATION_SECONDS;
    const rawStart = Number(raw.start);
    const rawEnd = Number(raw.end);
    const rawSourceStart = Number(raw.sourceStart);
    const rawSourceEnd = Number(raw.sourceEnd);

    let sourceStart: number | undefined;
    let sourceEnd: number | undefined;

    if (options.isReferenceVideo) {
      const hasExplicitSourceRange =
        Number.isFinite(rawSourceStart) &&
        Number.isFinite(rawSourceEnd) &&
        rawSourceEnd > rawSourceStart;
      const hasLegacySourceRange =
        Number.isFinite(rawStart) &&
        Number.isFinite(rawEnd) &&
        rawEnd > rawStart;

      sourceStart = hasExplicitSourceRange
        ? Math.max(0, rawSourceStart)
        : (hasLegacySourceRange ? Math.max(0, rawStart) : start);
      sourceEnd = sourceStart + SCENE_DURATION_SECONDS;
    }

    scenes.push({
      index: i,
      start,
      end,
      duration: SCENE_DURATION_SECONDS,
      narrative: normalizeSceneNarrative(
        String(raw.narrative || ''),
        fallbackText || `Breathwork scene ${i + 1}`
      ),
      visualPrompt: String(raw.visualPrompt || `Breathwork instruction scene ${i + 1}, cosmic gold accents.`),
      sourceStart,
      sourceEnd,
      cameraMovement: String(raw.cameraMovement || getDefaultCameraMovement(i, sceneCount)),
      transitionToNext: (raw.transitionToNext || getDefaultTransition(i, sceneCount)) as ReelTransitionType,
      overlayText: String(raw.overlayText || getDefaultOverlay(i, sceneCount)),
    });
  }

  return scenes;
}

function buildDefaultInstagramCaption(headline: string, cta: string): string {
  return [
    headline || '1 MINUTE BREATHWORK RESET',
    'Reset your nervous system in one round.',
    'Use this before work or before sleep.',
    cta || 'Save + try now.',
  ].join('\n');
}

function buildDefaultYouTubeDescription(headline: string, tags: string[]): string {
  return [
    `⚡ ${headline || 'Breathwork Reset'} (Shorts)`,
    '',
    'Simple guided breathwork to boost calm, clarity, and energy.',
    '👇 FREE BREATHWORK APP: [link]',
    '🎯 JOIN 21-DAY CHALLENGE: [link]',
    '',
    tags.slice(0, 4).join(' '),
  ].join('\n');
}

export interface VideoReelContent {
  headline: string;
  body: string;
  cta: string;
  hashtags: string[];
  brandScore: number;
  script: string;
  caption: string;
  instagramCaption: string;
  youtubeDescription: string;
  sourceAnalysisSummary: string;
  scenes: ReelScene[];
  normalizedDurationSeconds: number;
}

type RawReelResponse = {
  headline?: string;
  body?: string;
  cta?: string;
  caption?: string;
  instagramCaption?: string;
  youtubeDescription?: string;
  hashtags?: string[];
  brandScore?: number;
  sourceAnalysisSummary?: string;
  scenes?: ReelScene[];
};

export async function generateVideoReelContent(
  input: VideoReelInput
): Promise<VideoReelContent> {
  const boundedTargetDuration = clampDuration(input.targetDurationSeconds);
  const sceneCount = getSceneCount(boundedTargetDuration);
  const normalizedDurationSeconds = getNormalizedDuration(sceneCount);

  const planningAnalysisSummary = await analyzeReferenceForPlanning(input);
  const sourceInstructions = getSourceInstructions(input, planningAnalysisSummary);
  const schemaInstructions = getOutputSchemaInstructions(
    boundedTargetDuration,
    sceneCount,
    normalizedDurationSeconds,
    input.mode
  );
  const topicLine = `Topic: "${input.prompt}"${input.language !== 'en' ? `\nLanguage: ${input.language}` : ''}`;

  const fullPrompt = buildReelBrandPrompt(
    [topicLine, sourceInstructions, schemaInstructions].join('\n\n')
  );

  const response = await generateWithFallback(fullPrompt, {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: 'Hook line for first 3 seconds.' },
      body: { type: Type.STRING, description: 'Full voiceover body.' },
      cta: { type: Type.STRING, description: 'Soft CTA line.' },
      caption: { type: Type.STRING, description: 'Backward-compatible Instagram caption field.' },
      instagramCaption: { type: Type.STRING, description: 'Instagram caption body without hashtags.' },
      youtubeDescription: { type: Type.STRING, description: 'YouTube Shorts description.' },
      hashtags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      brandScore: { type: Type.NUMBER, description: 'Brand alignment score (0-100).' },
      sourceAnalysisSummary: { type: Type.STRING, description: 'Short analysis summary of source/ref intent.' },
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
            sourceStart: { type: Type.NUMBER },
            sourceEnd: { type: Type.NUMBER },
            cameraMovement: { type: Type.STRING },
            transitionToNext: { type: Type.STRING },
            overlayText: { type: Type.STRING },
          },
          required: ['index', 'start', 'end', 'duration', 'narrative', 'visualPrompt'],
        },
      },
    },
    required: ['headline', 'body', 'cta', 'hashtags', 'brandScore', 'scenes'],
  });

  const text = response.text;
  if (!text) throw new Error('Failed to generate video reel content');

  const data = JSON.parse(text) as RawReelResponse;
  if (!data.headline || !data.body || !data.cta) {
    throw new Error('Invalid response from AI — missing headline/body/cta');
  }

  const hashtags = ensureBrandHashtags(normalizeHashtags(data.hashtags));
  const instagramCaptionBase = (data.instagramCaption || data.caption || '').trim();
  const instagramCaption = instagramCaptionBase || buildDefaultInstagramCaption(data.headline, data.cta);
  const caption = [instagramCaption, '', hashtags.join(' ')].filter(Boolean).join('\n');
  const youtubeDescription =
    (data.youtubeDescription || '').trim() || buildDefaultYouTubeDescription(data.headline, hashtags);

  const script = [data.headline, data.body, data.cta].filter(Boolean).join('\n\n');
  const scenes = normalizeScenes(data.scenes, sceneCount, data.body, {
    isReferenceVideo: input.mode === 'FROM_REFERENCE_VIDEO',
  });

  return {
    headline: data.headline,
    body: data.body,
    cta: data.cta,
    hashtags,
    brandScore: Number.isFinite(data.brandScore) ? Number(data.brandScore) : 0,
    script,
    caption,
    instagramCaption,
    youtubeDescription,
    sourceAnalysisSummary: (data.sourceAnalysisSummary || planningAnalysisSummary || '').trim(),
    scenes,
    normalizedDurationSeconds,
  };
}
