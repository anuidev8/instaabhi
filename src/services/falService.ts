/// <reference types="vite/client" />

/**
 * falService.ts
 *
 * Runs the full AI video pipeline directly via @fal-ai/client:
 *   1. ElevenLabs TTS (direct API) + upload to fal storage  → fullAudioUrl
 *   2. Text-to-video per scene  → sceneVideoUrls[]
 *   3. Concat scene videos  → mergedVideoUrl  (skipped if only 1 scene)
 *   4. Merge audio + video  → finalVideoUrl  ← returned to the UI
 *
 * Test-mode note:
 *   This file currently supports frontend-side credentials (VITE_ env vars).
 *   Do not use this setup in production.
 *
 * Optional – swap model IDs here if you prefer different ones:
 *   VIDEO_MODEL     → fal-ai/minimax/video-01-live     (6-second text-to-video)
 *   CONCAT_MODEL    → fal-ai/ffmpeg-api/merge-videos   (concat scene clips)
 *   MERGE_AV_MODEL  → fal-ai/ffmpeg-api/merge-audio-video
 */

import { fal } from '@fal-ai/client';
import { GoogleGenAI } from '@google/genai';
import { BrandContext, ReelScene, VideoReelInput } from '../types';

// Local testing mode:
// - If VITE_FAL_KEY exists, call fal directly from frontend (insecure, test-only).
// - Otherwise fallback to the server-side proxy.
const frontendFalKey = import.meta.env.VITE_FAL_KEY as string | undefined;
if (frontendFalKey && frontendFalKey.trim()) {
  fal.config({ credentials: frontendFalKey.trim() });
} else {
  fal.config({ proxyUrl: '/api/fal/proxy' });
}
const geminiApiKey = process.env.GEMINI_API_KEY;
const gemini = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

// ── Model IDs (swap freely) ───────────────────────────────────────────────────
const VIDEO_MODEL      = 'fal-ai/minimax/video-01-live';   // 6-sec vertical video
const CONCAT_MODEL     = 'fal-ai/ffmpeg-api/merge-videos'; // concat ≥2 clips
const MERGE_AV_MODEL   = 'fal-ai/ffmpeg-api/merge-audio-video';
const DEFAULT_ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2';
const REFERENCE_ANALYSIS_MODEL = 'gemini-2.5-flash';
const MAX_REFERENCE_IMAGES_FOR_ANALYSIS = 3;

// ── Public types ──────────────────────────────────────────────────────────────

export interface FalJobPayload {
  jobId: string;
  draftId: string;
  script: string;
  scenes: ReelScene[];
  videoReelInput: VideoReelInput;
  brandContext: BrandContext;
}

export interface FalJobResult {
  jobId: string;
  draftId: string;
  finalVideoUrl: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds the per-scene video prompt used for text-to-video generation.
 * Exported so it can be reused / displayed in the UI.
 */
export function buildSceneVideoPrompt(
  scene: ReelScene,
  totalScenes: number,
  brandContext: BrandContext,
  videoReelInput?: VideoReelInput,
  referenceAnalysis?: string
): string {
  const referenceGuidance = (() => {
    if (!videoReelInput) {
      return 'Character anchor: derive identity from the topic and narrative only; keep one consistent main character across all scenes.';
    }

    if (videoReelInput.mode === 'FROM_IMAGES') {
      const imageCount = videoReelInput.referenceImages?.length ?? 0;
      return `Character anchor: use the uploaded reference image(s) as the primary identity source (${imageCount} image(s)). Preserve the same face, age range, skin tone, hair, body shape, and styling across every scene.`;
    }

    if (videoReelInput.mode === 'FROM_REFERENCE_VIDEO') {
      return `Character anchor: use the reference video style and subject identity as baseline. Keep the same protagonist look and energy while adapting to this new script. Reference video URL: ${videoReelInput.referenceVideoUrl || 'not provided'}.`;
    }

    return `Character anchor: infer a single protagonist from this prompt/topic: "${videoReelInput.prompt}". Keep that same character identity in every scene (no face swaps, no new main character).`;
  })();

  return `Instagram Reels style vertical 9:16 video, 1080x1920.

Brand:
- ${brandContext.name} (${brandContext.handle})
- Voice: ${brandContext.voice}
- Niche: ${brandContext.niche}

Scene ${scene.index + 1} of ${totalScenes}.
Narrative (what is being said): "${scene.narrative}"

Visual direction: ${scene.visualPrompt}
${referenceGuidance}
${referenceAnalysis ? `Reference analysis to follow strictly:\n${referenceAnalysis}` : ''}

Rules:
- Duration ≈ ${scene.duration} seconds.
- Smooth motion, no extreme camera shake.
- Keep subject and style consistent across scenes.
- Maintain one continuous main character identity across all scenes.
- No on-screen captions burned into the video (text is added in post).`;
}

/** Safely pulls a URL string from a fal model output. */
function extractUrl(data: unknown, ...keys: string[]): string {
  let current: unknown = data;
  for (const key of keys) {
    if (current === null || typeof current !== 'object') {
      throw new Error(`Unexpected fal output shape — missing key "${key}"`);
    }
    current = (current as Record<string, unknown>)[key];
  }
  if (typeof current !== 'string') {
    throw new Error(`Unexpected fal output: expected string URL, got ${JSON.stringify(current)}`);
  }
  return current;
}

async function synthesizeElevenLabsAndUploadToFal(script: string, brandContext: BrandContext): Promise<string> {
  const apiKey = (import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined)?.trim();
  if (!apiKey) {
    throw new Error('Missing VITE_ELEVENLABS_API_KEY for direct ElevenLabs TTS');
  }

  const voiceId = brandContext.voiceId?.trim();
  if (!voiceId) {
    throw new Error('Missing ElevenLabs voice ID in brand context');
  }

  const modelId =
    (import.meta.env.VITE_ELEVENLABS_MODEL_ID as string | undefined)?.trim() ??
    DEFAULT_ELEVENLABS_MODEL_ID;

  const outputFormat = 'mp3_44100_128';
  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${outputFormat}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: script,
      model_id: modelId,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${details}`);
  }

  const audioBlob = await response.blob();
  if (!audioBlob.size) {
    throw new Error('ElevenLabs returned empty audio payload');
  }

  return await fal.storage.upload(audioBlob);
}

function dataUrlToInlineDataPart(dataUrl: string): { inlineData: { mimeType: string; data: string } } {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match || !match[3]) throw new Error('Invalid image data URL');
  const mimeType = match[1] || 'image/png';
  const data = match[3];
  return { inlineData: { mimeType, data } };
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

async function analyzeReferenceContext(videoReelInput: VideoReelInput): Promise<string> {
  if (!gemini) return '';

  try {
    if (videoReelInput.mode === 'FROM_IMAGES' && (videoReelInput.referenceImages?.length ?? 0) > 0) {
      const imageParts = videoReelInput.referenceImages!
        .slice(0, MAX_REFERENCE_IMAGES_FOR_ANALYSIS)
        .map(dataUrlToInlineDataPart);

      const response = await gemini.models.generateContent({
        model: REFERENCE_ANALYSIS_MODEL,
        contents: [
          {
            text: `Analyze these reference images for video continuity.
Return concise plain text with:
- Main character profile (face, age, hair, skin tone, body type, clothing)
- Visual style and mood
- Environment/props
- Continuity rules across scenes
- Storyline direction for this prompt: "${videoReelInput.prompt}"`,
          },
          ...imageParts,
        ],
      });

      return (response.text || '').trim();
    }

    if (videoReelInput.mode === 'FROM_REFERENCE_VIDEO' && videoReelInput.referenceVideoUrl) {
      const videoUrl = videoReelInput.referenceVideoUrl;
      const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        {
          text: `Analyze this reference video and propose a NEW continuation storyline for short-form content.
Return concise plain text with:
- What happens in the reference video
- Main character identity and behavior
- Camera/editing style
- New storyline continuation plan (new content, same character/style)
- Strict continuity constraints
Prompt: "${videoReelInput.prompt}"
Reference URL: ${videoUrl}`,
        },
      ];

      try {
        const videoRes = await fetch(videoUrl);
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
        // Fallback to URL/text-only analysis when fetch or CORS fails.
      }

      const response = await gemini.models.generateContent({
        model: REFERENCE_ANALYSIS_MODEL,
        contents,
      });

      return (response.text || '').trim();
    }
  } catch {
    // Keep pipeline resilient even if analysis fails.
  }

  return '';
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

/**
 * Runs the full reel pipeline:
 *   TTS → per-scene video → concat → merge audio/video → finalVideoUrl
 *
 * Each step calls fal.subscribe() which blocks until the model finishes
 * and automatically handles fal's queue / polling internally.
 */
export async function generateReelVideo(payload: FalJobPayload): Promise<FalJobResult> {
  const { jobId, draftId, script, scenes, brandContext, videoReelInput } = payload;

  // ── Step 1: ElevenLabs direct TTS, then upload audio to fal storage ───────
  const fullAudioUrl = await synthesizeElevenLabsAndUploadToFal(script, brandContext);
  const referenceAnalysis = await analyzeReferenceContext(videoReelInput);

  // ── Step 2: Text-to-video per scene (sequential) ───────────────────────────
  // Model:  fal-ai/minimax/video-01-live
  // Input:  { prompt }
  // Output: { video: { url } }
  //
  // Sequential (not parallel) to avoid rate-limit issues on fal's queue.
  const sceneVideoUrls: string[] = [];
  for (const scene of scenes) {
    const videoResult = await fal.subscribe(VIDEO_MODEL, {
      input: {
        prompt: buildSceneVideoPrompt(
          scene,
          scenes.length,
          brandContext,
          videoReelInput,
          referenceAnalysis
        ),
      },
    });

    sceneVideoUrls.push(extractUrl(videoResult.data, 'video', 'url'));
  }

  // ── Step 3: Concatenate scene clips (skip if only one scene) ──────────────
  // Model:  fal-ai/ffmpeg-api/merge-videos
  // Input:  { video_urls: string[] }
  // Output: { video: { url } }
  let mergedVideoUrl: string;
  if (sceneVideoUrls.length === 1) {
    mergedVideoUrl = sceneVideoUrls[0];
  } else {
    const concatResult = await fal.subscribe(CONCAT_MODEL, {
      input: { video_urls: sceneVideoUrls },
    });
    mergedVideoUrl = extractUrl(concatResult.data, 'video', 'url');
  }

  // ── Step 4: Merge audio onto the concatenated video ───────────────────────
  // Model:  fal-ai/ffmpeg-api/merge-audio-video
  // Input:  { video_url, audio_url }
  // Output: { video: { url } }
  const mergeResult = await fal.subscribe(MERGE_AV_MODEL, {
    input: {
      video_url: mergedVideoUrl,
      audio_url: fullAudioUrl,
    },
  });
  const finalVideoUrl = extractUrl(mergeResult.data, 'video', 'url');

  return { jobId, draftId, finalVideoUrl };
}
