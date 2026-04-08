import { GoogleGenAI, Type } from '@google/genai';
import { AppMarketingVideoInput, ReelScene, ReelTransitionType } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL_REELS,
  'gemini-3.1-pro-preview',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
].filter(Boolean) as string[];

const REFERENCE_ANALYSIS_MODEL = 'gemini-2.5-flash';
const MAX_REFERENCE_IMAGES_FOR_ANALYSIS = 6;
const DEFAULT_DURATION_SECONDS = 30;
const MIN_DURATION_SECONDS = 20;
const MAX_DURATION_SECONDS = 45;
const SCENE_DURATION_SECONDS = 6;
const MIN_SCENE_COUNT = 4;
const MAX_SCENE_COUNT = 6;

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
  const value = Number.isFinite(seconds) ? Math.round(seconds) : DEFAULT_DURATION_SECONDS;
  return Math.min(MAX_DURATION_SECONDS, Math.max(MIN_DURATION_SECONDS, value));
}

function getSceneCount(targetDurationSeconds: number): number {
  const estimated = Math.round(targetDurationSeconds / SCENE_DURATION_SECONDS);
  return Math.min(MAX_SCENE_COUNT, Math.max(MIN_SCENE_COUNT, estimated));
}

function getNormalizedDuration(sceneCount: number): number {
  return sceneCount * SCENE_DURATION_SECONDS;
}

function normalizeHashtags(hashtags: unknown): string[] {
  if (!Array.isArray(hashtags)) return [];

  const normalized = hashtags
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag.replace(/\s+/g, '')}`));

  return Array.from(new Set(normalized)).slice(0, 14);
}

function toHashtag(value: string): string {
  return `#${value.replace(/[^a-zA-Z0-9]/g, '')}`;
}

function ensureCoreHashtags(tags: string[], appName: string): string[] {
  const appTag = toHashtag(appName);
  const required = [appTag, '#AppMarketing', '#MobileApp', '#ProductDemo'];
  const existing = new Set(tags.map((tag) => tag.toLowerCase()));
  const merged = [...tags];

  for (const tag of required) {
    if (!existing.has(tag.toLowerCase())) merged.push(tag);
  }

  return merged.slice(0, 14);
}

function summarizeRealStories(realUserStories?: string): string {
  const normalized = String(realUserStories || '').trim();
  if (!normalized) return 'No explicit real user stories provided.';
  if (normalized.length <= 900) return normalized;
  return `${normalized.slice(0, 900)}...`;
}

function normalizeTransition(value: unknown, index: number, total: number): ReelTransitionType {
  if (index >= total - 1) return 'none';

  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'zoomwipe' || raw === 'ripple' || raw === 'cosmicwipe' || raw === 'fade') {
    return raw;
  }

  if (index === 0) return 'zoomwipe';
  if (index === 1) return 'ripple';
  if (index === 2) return 'fade';
  return 'cosmicwipe';
}

function defaultOverlay(index: number, total: number, appName: string): string {
  if (index === 0) return 'Breathe better in minutes';
  if (index === total - 1) return `Download ${appName} today`;
  if (index === 1) return 'Tap • Start • Feel calm';
  if (index === 2) return 'Track your daily progress';
  return 'Guided calm, real results';
}

function defaultCamera(index: number, total: number): string {
  if (index === 0) return 'Hook shot: quick push-in from medium angle to close-up on a human using the app.';
  if (index === 1) return 'Over-the-shoulder angle with subtle parallax pan following finger taps.';
  if (index === 2) return 'Three-quarter angle orbit around phone and face, smooth and calm.';
  if (index === total - 1) return 'Soft zoom out from close-up to branded CTA lockup.';
  return 'Dynamic but smooth pan/tilt across app interactions and human expressions.';
}

function defaultNegativePrompt(): string {
  return [
    'cartoon',
    'anime',
    'illustration',
    '3d render',
    'cgi',
    'plastic skin',
    'waxy face',
    'uncanny facial features',
    'distorted hands',
    'extra fingers',
    'blurry phone screen',
    'gibberish ui text',
    'wrong app logo',
    'invented app interface',
    'fantasy environment',
  ].join(', ');
}

function dataUrlToInlineDataPart(dataUrl: string): { inlineData: { mimeType: string; data: string } } {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match || !match[3]) throw new Error('Invalid image data URL');
  return {
    inlineData: {
      mimeType: match[1] || 'image/png',
      data: match[3],
    },
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function analyzeAppReferences(input: AppMarketingVideoInput): Promise<string> {
  try {
    const realStories = summarizeRealStories(input.realUserStories);
    const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      {
        text: `Analyze these app marketing references and return concise plain text:
- app value proposition in one sentence
- most compelling UI moments
- emotional tone and pacing suggestions for a viral ~30s short
- continuity constraints for consistent look
- strongest CTA angle
- factual story beats based on the real user stories below (problem -> app use -> outcome)

App name: ${input.appName}
Campaign goal: ${input.campaignGoal}
Target audience: ${input.targetAudience || 'general wellness users'}
App URL: ${input.appUrl || 'n/a'}
Real user stories:
${realStories}`,
      },
    ];

    if (input.referenceImages.length > 0) {
      const imageParts = input.referenceImages
        .slice(0, MAX_REFERENCE_IMAGES_FOR_ANALYSIS)
        .map(dataUrlToInlineDataPart);
      contents.push(...imageParts);
    }

    if (input.referenceVideoUrl) {
      contents.push({
        text: `Also analyze this reference video URL context: ${input.referenceVideoUrl}`,
      });

      try {
        const response = await fetch(input.referenceVideoUrl);
        if (response.ok) {
          const videoBlob = await response.blob();
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
        // Ignore CORS/network fetch errors and proceed with URL context only.
      }
    }

    const analysis = await ai.models.generateContent({
      model: REFERENCE_ANALYSIS_MODEL,
      contents,
    });

    return (analysis.text || '').trim();
  } catch {
    // Keep generation resilient if reference analysis fails.
    return '';
  }
}

function getSourceInstructions(input: AppMarketingVideoInput, analysisSummary: string): string {
  const realStories = summarizeRealStories(input.realUserStories);
  return `Use uploaded app assets as the source of truth.
- App screenshots/video must drive UI details in scene prompts.
- Use the app screenshots exactly as UI source material. Preserve original layout, icon shapes, button labels, and navigation structure.
- Never redesign, rebrand, or invent a different UI.
- Keep a consistent visual language across all scenes.
- Video must feel native for Instagram Reels + YouTube Shorts.
- Make transitions energetic but clean.
- Prioritize clear app benefit and conversion CTA.
- Use ONLY the provided real user stories as narrative anchors.
- Do not invent fictional names, fake testimonials, or unrealistic outcomes.
- Structure story as: real problem -> real app usage b-roll -> real relief/result -> CTA.
Real user stories (must be used):
${realStories}
${analysisSummary ? `\nReference analysis summary (must use):\n${analysisSummary}` : ''}`;
}

function normalizeScenes(
  rawScenes: unknown,
  sceneCount: number,
  appName: string,
  hasReferenceVideo: boolean
): ReelScene[] {
  const list = Array.isArray(rawScenes) ? rawScenes : [];
  const scenes: ReelScene[] = [];

  for (let index = 0; index < sceneCount; index += 1) {
    const raw = (list[index] || {}) as Partial<ReelScene>;
    const start = index * SCENE_DURATION_SECONDS;
    const end = start + SCENE_DURATION_SECONDS;

    const sourceStartValue = Number(raw.sourceStart);
    const sourceStart = Number.isFinite(sourceStartValue)
      ? Math.max(0, sourceStartValue)
      : start;

    scenes.push({
      index,
      start,
      end,
      duration: SCENE_DURATION_SECONDS,
      narrative: String(raw.narrative || `Scene ${index + 1}: show a real user moment and app value in action.`).trim(),
      visualPrompt: String(
        raw.visualPrompt ||
          `Vertical 9:16 documentary-style app marketing scene for ${appName}. Real human b-roll (hands/face/environment), real-world lighting, and natural motion blur. Show the actual app screenshots inside a real phone on camera; preserve UI layout and labels exactly.`
      ).trim(),
      negativePrompt: String(raw.negativePrompt || defaultNegativePrompt()).trim(),
      sourceStart: hasReferenceVideo ? sourceStart : undefined,
      sourceEnd: hasReferenceVideo ? sourceStart + SCENE_DURATION_SECONDS : undefined,
      cameraMovement: String(raw.cameraMovement || defaultCamera(index, sceneCount)).trim(),
      transitionToNext: normalizeTransition(raw.transitionToNext, index, sceneCount),
      overlayText: String(raw.overlayText || defaultOverlay(index, sceneCount, appName)).trim(),
    });
  }

  return scenes;
}

function buildDefaultVoiceover(appName: string, campaignGoal: string, cta: string, realUserStories?: string): string {
  const storyAnchor = summarizeRealStories(realUserStories).split('\n')[0];
  return [
    `Still doing this the hard way? Meet ${appName}.`,
    `Real story: ${storyAnchor}`,
    campaignGoal,
    `Open the app, follow the guided flow, and feel results in minutes.`,
    cta,
  ].join(' ');
}

function buildDefaultCaption(appName: string, campaignGoal: string, cta: string, realUserStories?: string): string {
  const storyAnchor = summarizeRealStories(realUserStories).split('\n')[0];
  return [
    `${appName} in 30 seconds.`,
    `Real use case: ${storyAnchor}`,
    campaignGoal,
    cta,
    'Save this and share it with someone who needs this app.',
  ].join('\n');
}

export interface AppMarketingVideoPlan {
  headline: string;
  voiceoverScript: string;
  caption: string;
  hashtags: string[];
  visualAnalysisSummary: string;
  scenes: ReelScene[];
  normalizedDurationSeconds: number;
}

type RawAppMarketingResponse = {
  headline?: string;
  voiceoverScript?: string;
  caption?: string;
  hashtags?: string[];
  visualAnalysisSummary?: string;
  scenes?: ReelScene[];
};

export async function generateAppMarketingVideoPlan(input: AppMarketingVideoInput): Promise<AppMarketingVideoPlan> {
  const boundedDuration = clampDuration(input.targetDurationSeconds);
  const sceneCount = getSceneCount(boundedDuration);
  const normalizedDurationSeconds = getNormalizedDuration(sceneCount);

  const analysisSummary = await analyzeAppReferences(input);
  const sourceInstructions = getSourceInstructions(input, analysisSummary);
  const realStories = summarizeRealStories(input.realUserStories);

  const prompt = `
You are a senior short-form app marketer and creative director.
Create a viral-style mobile app promo video plan around ${normalizedDurationSeconds} seconds.

APP CONTEXT
- App name: ${input.appName}
- Campaign goal: ${input.campaignGoal}
- CTA: ${input.callToAction}
- Target audience: ${input.targetAudience || 'general mobile users'}
- App URL: ${input.appUrl || 'n/a'}
- Language: ${input.language}
- Real user stories / use-cases:
${realStories}

CREATIVE REQUIREMENTS
- Platform: Instagram Reels + YouTube Shorts
- Duration: ${normalizedDurationSeconds}s (exactly ${sceneCount} scenes, ${SCENE_DURATION_SECONDS}s each)
- Tone: dynamic and high-retention but calm, soft, and trustworthy
- Must clearly show app UI moments and user outcomes
- Include one strong hook in first 2 seconds and one clear CTA in final scene
- Apply ethical marketing psychology: immediate benefit framing in the hook, progress cues in middle scenes, and social proof only from provided real cases
- Human-first promotional style: include real people/hands interacting with the app in almost every scene
- Camera choreography must vary by scene: push-in, over-shoulder, three-quarter angle, parallax pan, soft zoom out
- Use minimal animated infographic micro-interactions (breath ring pulse, progress bar fill, card reveal, gentle tap ripple)
- Keep text overlays short (2-6 words), elegant, and never cluttered
- Aesthetic inspiration can feel as polished as Calm/Headspace, but keep it original and aligned to this app/business
- Story must follow real-life arc from provided cases: struggle -> app usage b-roll -> practical benefit -> final CTA
- Never make up fictional characters, fake names, fake testimonials, or fabricated results/claims

${sourceInstructions}

Return valid JSON only:
{
  "headline": string,
  "voiceoverScript": string,
  "caption": string,
  "hashtags": string[],
  "visualAnalysisSummary": string,
  "scenes": [
    {
      "index": number,
      "narrative": string,
      "visualPrompt": string,
      "negativePrompt": string,
      "sourceStart": number,
      "cameraMovement": string,
      "transitionToNext": "zoomwipe" | "ripple" | "cosmicwipe" | "fade" | "none",
      "overlayText": string
    }
  ]
}
`;

  const response = await generateWithFallback(prompt, {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING },
      voiceoverScript: { type: Type.STRING },
      caption: { type: Type.STRING },
      hashtags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      visualAnalysisSummary: { type: Type.STRING },
      scenes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            index: { type: Type.INTEGER },
            narrative: { type: Type.STRING },
            visualPrompt: { type: Type.STRING },
            negativePrompt: { type: Type.STRING },
            sourceStart: { type: Type.NUMBER },
            cameraMovement: { type: Type.STRING },
            transitionToNext: { type: Type.STRING },
            overlayText: { type: Type.STRING },
          },
          required: ['index', 'narrative', 'visualPrompt', 'negativePrompt', 'cameraMovement', 'transitionToNext', 'overlayText'],
        },
      },
    },
    required: ['headline', 'voiceoverScript', 'caption', 'hashtags', 'scenes'],
  });

  const text = response.text;
  if (!text) {
    throw new Error('Failed to generate app marketing video plan');
  }

  const data = JSON.parse(text) as RawAppMarketingResponse;
  const headline = String(data.headline || '').trim() || `${input.appName} in ${normalizedDurationSeconds}s`;
  const voiceoverScript =
    String(data.voiceoverScript || '').trim() ||
    buildDefaultVoiceover(input.appName, input.campaignGoal, input.callToAction, input.realUserStories);

  const hashtags = ensureCoreHashtags(normalizeHashtags(data.hashtags), input.appName);
  const captionBase =
    String(data.caption || '').trim() ||
    buildDefaultCaption(input.appName, input.campaignGoal, input.callToAction, input.realUserStories);
  const caption = [captionBase, '', hashtags.join(' ')].filter(Boolean).join('\n');

  const scenes = normalizeScenes(
    data.scenes,
    sceneCount,
    input.appName,
    Boolean(input.referenceVideoUrl?.trim())
  );

  return {
    headline,
    voiceoverScript,
    caption,
    hashtags,
    visualAnalysisSummary: String(data.visualAnalysisSummary || analysisSummary || '').trim(),
    scenes,
    normalizedDurationSeconds,
  };
}
