/// <reference types="vite/client" />

/**
 * falService.ts
 *
 * Reels pipeline:
 *   1) Source upload (local MP4 via fal storage, URL sources supported)
 *   2) Gemini source analysis + scene guidance
 *   3) Per-scene video generation using selected provider (Gemini or OpenAI)
 *   4) Fal merge-videos only for concatenation (default path)
 *
 * Optional strict mode (VITE_REELS_STRICT_SPEC_MODE=true):
 *   - transition-aware assembly (trim + blend + concat)
 *   - optional ElevenLabs voiceover layering + ambient bed
 *   - optional styled subtitle overlay pass
 *
 * Test-mode note:
 *   This file currently supports frontend-side credentials (VITE_ env vars).
 *   Do not use this setup in production.
 *
 * Important:
 *   - ElevenLabs code is intentionally kept in file for compatibility, but not used in default flow.
 *   - Fal is used only for storage/upload and concat in the default flow.
 */

import { fal } from '@fal-ai/client';
import { GoogleGenAI } from '@google/genai';
import { BrandContext, ReelScene, SceneVideoProvider, VideoReelInput } from '../types';

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

// ── Model IDs / API endpoints ─────────────────────────────────────────────────
const CONCAT_MODEL = 'fal-ai/ffmpeg-api/merge-videos'; // concat only
const TRIM_VIDEO_MODEL = 'fal-ai/workflow-utilities/trim-video';
const BLEND_VIDEO_MODEL = 'fal-ai/workflow-utilities/blend-video';
const SCALE_VIDEO_MODEL = 'fal-ai/workflow-utilities/scale-video';
const COMPOSE_MODEL = 'fal-ai/ffmpeg-api/compose';
const MERGE_AUDIO_VIDEO_MODEL = 'fal-ai/ffmpeg-api/merge-audio-video';
const AUTO_SUBTITLE_MODEL = 'fal-ai/workflow-utilities/auto-subtitle';
const METADATA_MODEL = 'fal-ai/ffmpeg-api/metadata';
const GEMINI_VIDEO_MODEL =
  (process.env.GEMINI_VIDEO_MODEL as string | undefined)?.trim() ||
  'veo-3.1-generate-preview';
const OPENAI_VIDEO_MODEL =
  (process.env.OPENAI_VIDEO_MODEL as string | undefined)?.trim() ||
  'sora-1';
const OPENAI_VIDEO_ENDPOINT =
  (process.env.OPENAI_VIDEO_ENDPOINT as string | undefined)?.trim() ||
  'https://api.openai.com/v1/videos';
const GEMINI_VIDEO_API_BASE =
  (process.env.GEMINI_VIDEO_API_BASE as string | undefined)?.trim() ||
  'https://generativelanguage.googleapis.com/v1beta';

const DEFAULT_ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2';
const REFERENCE_ANALYSIS_MODEL = 'gemini-2.5-flash';
const MAX_REFERENCE_IMAGES_FOR_ANALYSIS = 3;
const MAX_APP_UI_REFERENCE_IMAGES_FOR_ANALYSIS = 4;
const MAX_CHARACTER_REFERENCE_IMAGES_FOR_ANALYSIS = 4;
const TARGET_VIDEO_FPS = 30;
const TARGET_VIDEO_WIDTH = 1080;
const TARGET_VIDEO_HEIGHT = 1920;
const MAX_REEL_DURATION_SECONDS = 60;
const TRANSITION_DURATION_SECONDS = 0.5;
const GEMINI_SUBMIT_MAX_RETRIES = 4;
const GEMINI_SUBMIT_BACKOFF_BASE_MS = 2500;

function readBooleanEnv(value: string | undefined, fallback = false): boolean {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

const STRICT_REELS_SPEC_MODE = readBooleanEnv(import.meta.env.VITE_REELS_STRICT_SPEC_MODE as string | undefined);
const STRICT_REELS_ENABLE_ELEVENLABS_AUDIO = readBooleanEnv(
  import.meta.env.VITE_REELS_STRICT_ENABLE_ELEVENLABS_AUDIO as string | undefined
);
const STRICT_REELS_ENABLE_AUTO_SUBTITLE = readBooleanEnv(
  import.meta.env.VITE_REELS_STRICT_ENABLE_AUTO_SUBTITLE as string | undefined
);
const STRICT_REELS_AMBIENT_AUDIO_URL =
  (import.meta.env.VITE_REEL_AMBIENT_AUDIO_URL as string | undefined)?.trim() || '';
const REFERENCE_CLIP_FIRST_MODE = readBooleanEnv(
  import.meta.env.VITE_REELS_REFERENCE_CLIP_MODE as string | undefined,
  true
);

// ── Public types ──────────────────────────────────────────────────────────────

export interface FalJobPayload {
  jobId: string;
  draftId: string;
  script: string;
  scenes: ReelScene[];
  sceneVideoProvider?: SceneVideoProvider;
  sourceAnalysisSummary?: string;
  videoReelInput: VideoReelInput;
  brandContext: BrandContext;
  pipelineOptions?: FalPipelineOptions;
}

export interface FalJobResult {
  jobId: string;
  draftId: string;
  finalVideoUrl: string;
}

export interface FalPipelineOptions {
  forceStrictAssembly?: boolean;
  disableStrictAssembly?: boolean;
  forceVoiceoverAudio?: boolean;
  forceAutoSubtitle?: boolean;
  ambientAudioUrl?: string;
  forceSceneVideoProvider?: SceneVideoProvider;
  disableReferenceClipSplit?: boolean;
  mergeVoiceoverAudio?: boolean;
  requireVoiceoverAudio?: boolean;
  sceneGenerationConcurrency?: number;
  sceneGenerationDelayMs?: number;
  normalizeSceneVideosBeforeConcat?: boolean;
}

/**
 * Uploads a local MP4 file to Fal storage so it can be used as a reference URL.
 * This keeps the reel input serializable and avoids storing huge base64 blobs.
 */
export async function uploadLocalReferenceVideo(file: File): Promise<string> {
  if (!file || !file.size) {
    throw new Error('Reference video file is empty');
  }
  if (!file.type.startsWith('video/')) {
    throw new Error('Reference file must be a video');
  }
  return await fal.storage.upload(file);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeDataUrlReferences(values?: string[]): string[] {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function getCharacterReferenceImages(videoReelInput?: VideoReelInput): string[] {
  if (!videoReelInput) return [];

  const explicitCharacterRefs = normalizeDataUrlReferences(videoReelInput.characterReferenceImages);
  if (explicitCharacterRefs.length > 0) return explicitCharacterRefs;

  if (
    videoReelInput.referenceImageIntent === 'character_face_exact' ||
    videoReelInput.referenceImageIntent === 'app_ui_plus_character_face'
  ) {
    return normalizeDataUrlReferences(videoReelInput.referenceImages);
  }

  return [];
}

function getAppUiReferenceImages(videoReelInput?: VideoReelInput): string[] {
  if (!videoReelInput) return [];

  const explicitAppUiRefs = normalizeDataUrlReferences(videoReelInput.appUiReferenceImages);
  if (explicitAppUiRefs.length > 0) return explicitAppUiRefs;

  if (videoReelInput.referenceImageIntent === 'app_ui_exact') {
    return normalizeDataUrlReferences(videoReelInput.referenceImages);
  }

  return [];
}

function pickSceneReferenceFrameDataUrl(videoReelInput: VideoReelInput, sceneIndex: number): string | undefined {
  if (videoReelInput.mode !== 'FROM_IMAGES') return undefined;

  const characterRefs = getCharacterReferenceImages(videoReelInput);
  if (characterRefs.length > 0) {
    // Use the first strict face anchor on every scene to reduce identity drift.
    return characterRefs[0];
  }

  const appUiRefs = getAppUiReferenceImages(videoReelInput);
  if (appUiRefs.length > 0 && videoReelInput.referenceImageIntent === 'app_ui_exact') {
    return appUiRefs[sceneIndex % appUiRefs.length];
  }

  const genericRefs = normalizeDataUrlReferences(videoReelInput.referenceImages);
  if (genericRefs.length > 0 && videoReelInput.referenceImageIntent === 'general') {
    return genericRefs[sceneIndex % genericRefs.length];
  }

  return undefined;
}

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

    const characterRefs = getCharacterReferenceImages(videoReelInput);
    const appUiRefs = getAppUiReferenceImages(videoReelInput);
    const genericRefs = normalizeDataUrlReferences(videoReelInput.referenceImages);

    if (videoReelInput.mode === 'FROM_IMAGES') {
      if (videoReelInput.referenceImageIntent === 'app_ui_exact') {
        const imageCount = appUiRefs.length || genericRefs.length;
        return `UI anchor: use uploaded app screenshot(s) as strict UI source (${imageCount} image(s)). Keep app structure exact: same information architecture, same button hierarchy, same label style, same layout logic. Place those real screens inside realistic phone interactions; do not redesign or invent a different app UI.`;
      }
      if (videoReelInput.referenceImageIntent === 'app_ui_plus_character_face') {
        return `Dual anchor mode:
- Character identity anchor: strict same-face lock from uploaded character reference image(s) (${characterRefs.length} image(s)). Keep identical facial structure, skin tone, hairline, and age band in every scene.
- App UI anchor: preserve uploaded app screenshot fidelity (${appUiRefs.length} image(s)); keep real layout and labels without redesign.
- Cinematic realism: natural skin texture, natural movement, and believable lighting only (no glamour filter look).`;
      }
      if (videoReelInput.referenceImageIntent === 'character_face_exact') {
        return `Character anchor: use uploaded reference image(s) as strict identity source (${characterRefs.length || genericRefs.length} image(s)). Keep the exact same face across every scene (no face swap, no identity drift), while maintaining natural documentary-style behavior.`;
      }
      return `Character anchor: use uploaded reference image(s) as guidance (${genericRefs.length} image(s)). Preserve one coherent protagonist identity across every scene.`;
    }

    if (videoReelInput.mode === 'FROM_REFERENCE_VIDEO') {
      const sourceKind = videoReelInput.referenceVideoKind || 'DIRECT_URL';
      const sourceTitle = videoReelInput.referenceVideoTitle || videoReelInput.prompt;
      const characterAnchorLine = characterRefs.length > 0
        ? `\nAdditional character anchors provided (${characterRefs.length} image(s)): lock face identity to those references as highest priority.`
        : '';
      const appUiAnchorLine = appUiRefs.length > 0
        ? `\nAdditional app UI anchors provided (${appUiRefs.length} image(s)): preserve app layout and labels from those screenshots.`
        : '';
      return `Character anchor: use the reference video style and subject identity as baseline. Keep the same protagonist look and energy while adapting to this new script.${characterAnchorLine}
${appUiAnchorLine}
Reference type: ${sourceKind}
Reference title/context: ${sourceTitle}
Reference video URL: ${videoReelInput.referenceVideoUrl || 'not provided'}.`;
    }

    return `Character anchor: infer a single protagonist from this prompt/topic: "${videoReelInput.prompt}". Keep that same character identity in every scene (no face swaps, no new main character).`;
  })();

  const transition = scene.transitionToNext && scene.transitionToNext !== 'none'
    ? scene.transitionToNext
    : 'hard-cut';
  const styleDirection =
    brandContext.visualDirection ||
    'Cosmic brand system: deep indigo background + sacred white highlights + gold accents (#FFD700).';
  const cameraDirection =
    brandContext.cameraDirection ||
    'Camera should feel cinematic and intentional: mix push-in, parallax pan, over-shoulder angle, and top/three-quarter angle shots.';
  const humanDirection =
    brandContext.humanDirection ||
    'Maintain one continuous main character identity across all scenes.';
  const microInteractionDirection =
    brandContext.microInteractionDirection ||
    'Keep overlays minimal and elegant (technique labels, breath timers, chakra cues).';

  return `Instagram Reels + YouTube Shorts style vertical 9:16 video, 1080x1920, 30fps.

Brand:
- ${brandContext.name} (${brandContext.handle})
- Voice: ${brandContext.voice}
- Niche: ${brandContext.niche}

Scene ${scene.index + 1} of ${totalScenes}.
Narrative (what is being said): "${scene.narrative}"
Visual direction: ${scene.visualPrompt}
Camera movement: ${scene.cameraMovement || 'smooth cinematic motion, no jitter'}
Suggested transition to next scene: ${transition}
Infographic overlay cue: ${scene.overlayText || 'minimal cosmic-gold breath counter'}
Negative visual constraints: ${scene.negativePrompt || 'cartoon, CGI look, uncanny faces, distorted hands, fake UI text'}
${referenceGuidance}
${referenceAnalysis ? `Reference analysis to follow strictly:\n${referenceAnalysis}` : ''}

Rules:
- Duration ≈ ${scene.duration} seconds.
- Dynamic but calm pacing: smooth motion, no extreme camera shake.
- Keep subject and style consistent across scenes.
- Keep realism high: documentary-style behavior and believable environments; avoid fantasy or made-up character styling.
- Natural cinematic realism only: realistic skin pores, natural facial proportions, natural fabric/lighting response, no beautification filter look.
- ${humanDirection}
- ${cameraDirection}
- ${styleDirection}
- ${microInteractionDirection}
- Use subtle UI/infographic micro-interactions (button ripple, progress pulse, card slide, breath ring pulse), never distracting.
- No dense text paragraphs burned into video.`;
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

function extractAnyUrl(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === 'string') {
    if (/^https?:\/\//i.test(data)) return data;
    return null;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = extractAnyUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (typeof record.url === 'string' && /^https?:\/\//i.test(record.url)) return record.url;
    for (const value of Object.values(record)) {
      const found = extractAnyUrl(value);
      if (found) return found;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(response: Response): number | null {
  const retryAfter = response.headers.get('retry-after');
  if (!retryAfter) return null;
  const asNumber = Number(retryAfter);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.round(asNumber * 1000);
  }
  const asDate = Date.parse(retryAfter);
  if (!Number.isNaN(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

function getBackoffMs(attemptIndex: number): number {
  const exponential = GEMINI_SUBMIT_BACKOFF_BASE_MS * (2 ** attemptIndex);
  const jitter = Math.floor(Math.random() * 400);
  return exponential + jitter;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const normalizedConcurrency = Math.max(1, Math.min(items.length, Math.floor(concurrency) || 1));
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: normalizedConcurrency }).map(() => runWorker())
  );
  return results;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function assertFinalVideoCompliance(data: unknown): void {
  const root = asRecord(data);
  if (!root) return;

  const metadata = asRecord(root.metadata);
  const metadataVideo = asRecord(metadata?.video);
  const media = asRecord(root.media);
  const mediaVideo = asRecord(media?.video);
  const videoMeta = metadataVideo || mediaVideo;
  if (!videoMeta) return;

  const resolution = asRecord(videoMeta.resolution);
  const format = asRecord(videoMeta.format);

  const duration = readNumber(videoMeta?.duration);
  const fps = readNumber(videoMeta?.fps);
  const width = readNumber(resolution?.width);
  const height = readNumber(resolution?.height);
  const container = (readString(videoMeta.container) || '').toLowerCase();
  const codec = (
    readString(videoMeta?.codec) ||
    readString(format?.video_codec) ||
    ''
  ).toLowerCase();

  if (duration !== null && duration > MAX_REEL_DURATION_SECONDS + 0.01) {
    throw new Error(`Final reel duration is ${duration.toFixed(2)}s, exceeds ${MAX_REEL_DURATION_SECONDS}s max`);
  }
  if (fps !== null && Math.round(fps) !== TARGET_VIDEO_FPS) {
    throw new Error(`Final reel fps is ${fps}, expected ${TARGET_VIDEO_FPS}`);
  }
  if (width !== null && height !== null && (Math.round(width) !== TARGET_VIDEO_WIDTH || Math.round(height) !== TARGET_VIDEO_HEIGHT)) {
    throw new Error(
      `Final reel resolution is ${Math.round(width)}x${Math.round(height)}, expected ${TARGET_VIDEO_WIDTH}x${TARGET_VIDEO_HEIGHT}`
    );
  }
  if (container && container !== 'mp4') {
    throw new Error(`Final reel container is "${container}", expected "mp4"`);
  }
  if (codec && !codec.includes('h264') && !codec.includes('avc')) {
    throw new Error(`Final reel codec is "${codec}", expected H.264/AVC`);
  }
}

function extractVideoUrlFromFalData(data: unknown): string {
  const root = asRecord(data);
  const nestedVideo = asRecord(root?.video);
  if (nestedVideo && typeof nestedVideo.url === 'string') {
    return nestedVideo.url;
  }
  if (root && typeof root.video_url === 'string') {
    return root.video_url;
  }
  if (root && typeof root.url === 'string') {
    return root.url;
  }
  const anyUrl = extractAnyUrl(data);
  if (anyUrl) return anyUrl;
  throw new Error(`Unable to extract video URL from Fal output: ${JSON.stringify(data)}`);
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isFalHostedUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.endsWith('.fal.ai') || host.endsWith('.fal.run') || host.endsWith('.fal.media');
  } catch {
    return false;
  }
}

function buildSourceFetchHeaders(videoUrl: string): Record<string, string> | undefined {
  try {
    const host = new URL(videoUrl).hostname.toLowerCase();
    const needsGeminiKey =
      host === 'generativelanguage.googleapis.com' ||
      host.endsWith('.generativelanguage.googleapis.com');
    if (!needsGeminiKey) return undefined;
    const apiKey = (process.env.GEMINI_API_KEY as string | undefined)?.trim();
    if (!apiKey) return undefined;
    return { 'x-goog-api-key': apiKey };
  } catch {
    return undefined;
  }
}

function formatFalValidationError(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const details = (error as { body?: { detail?: Array<{ loc?: Array<string | number>; msg?: string }> } }).body?.detail;
  if (!Array.isArray(details) || details.length === 0) return '';
  const compact = details
    .slice(0, 3)
    .map((entry) => {
      const path = Array.isArray(entry.loc) ? entry.loc.join('.') : 'input';
      const msg = typeof entry.msg === 'string' ? entry.msg : 'validation error';
      return `${path}: ${msg}`;
    })
    .join(' | ');
  return compact ? ` Validation details: ${compact}` : '';
}

async function mirrorVideoUrlToFalStorage(videoUrl: string, sceneIndex: number): Promise<string> {
  const headers = buildSourceFetchHeaders(videoUrl);
  const response = await fetch(videoUrl, headers ? { headers } : undefined);
  if (!response.ok) {
    const details = (await response.text()).slice(0, 300).trim();
    throw new Error(
      `Scene ${sceneIndex + 1} video fetch failed before Fal upload (${response.status})${details ? `: ${details}` : ''}`
    );
  }
  const videoBlob = await response.blob();
  if (!videoBlob.size) {
    throw new Error(`Scene ${sceneIndex + 1} video fetch returned empty payload`);
  }
  return await fal.storage.upload(videoBlob);
}

function extractGeminiVideoUrlFromOperationResponse(response: Record<string, unknown>): string | null {
  const collectCandidates = (input: Record<string, unknown>): string[] => {
    const candidates: string[] = [];
    const push = (value: unknown): void => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) candidates.push(trimmed);
      }
    };
    const readVideoLike = (value: unknown): void => {
      if (typeof value === 'string') {
        push(value);
        return;
      }
      const record = asRecord(value);
      if (!record) return;
      push(record.uri);
      push(record.url);
      push(record.downloadUri);
      push(record.download_uri);
      push(record.name);
    };

    const candidateCollections: unknown[] = [];
    const generateVideoResponse = asRecord(input.generateVideoResponse);
    if (generateVideoResponse) {
      candidateCollections.push(
        generateVideoResponse.generatedSamples,
        generateVideoResponse.generated_samples,
        generateVideoResponse.generatedVideos,
        generateVideoResponse.generated_videos
      );
    }
    candidateCollections.push(
      input.generatedSamples,
      input.generated_samples,
      input.generatedVideos,
      input.generated_videos
    );

    for (const collection of candidateCollections) {
      if (!Array.isArray(collection)) continue;
      for (const item of collection) {
        const sample = asRecord(item);
        if (!sample) continue;
        readVideoLike(sample.video);
      }
    }

    readVideoLike(input.video);
    return candidates;
  };

  const candidates = collectCandidates(response);
  for (const candidate of candidates) {
    if (isHttpUrl(candidate)) return candidate;
  }
  return null;
}

function extractGeminiVideoRefsFromOperationResponse(response: Record<string, unknown>): string[] {
  const refs: string[] = [];
  const push = (value: unknown): void => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!refs.includes(trimmed)) refs.push(trimmed);
  };
  const readVideoLike = (value: unknown): void => {
    if (typeof value === 'string') {
      push(value);
      return;
    }
    const record = asRecord(value);
    if (!record) return;
    push(record.uri);
    push(record.url);
    push(record.downloadUri);
    push(record.download_uri);
    push(record.name);
  };

  const candidateCollections: unknown[] = [];
  const generateVideoResponse = asRecord(response.generateVideoResponse);
  if (generateVideoResponse) {
    candidateCollections.push(
      generateVideoResponse.generatedSamples,
      generateVideoResponse.generated_samples,
      generateVideoResponse.generatedVideos,
      generateVideoResponse.generated_videos
    );
  }
  candidateCollections.push(
    response.generatedSamples,
    response.generated_samples,
    response.generatedVideos,
    response.generated_videos
  );

  for (const collection of candidateCollections) {
    if (!Array.isArray(collection)) continue;
    for (const item of collection) {
      const sample = asRecord(item);
      if (!sample) continue;
      readVideoLike(sample.video);
    }
  }

  readVideoLike(response.video);
  return refs;
}

function extractGeminiRaiReasons(response: Record<string, unknown>): string[] {
  const sources = [response, asRecord(response.generateVideoResponse)].filter(Boolean) as Record<string, unknown>[];
  const reasons = new Set<string>();
  let filteredCount = 0;

  for (const source of sources) {
    const count = readNumber(source.raiMediaFilteredCount) ?? readNumber(source.rai_media_filtered_count);
    if (count !== null && count > 0) {
      filteredCount = Math.max(filteredCount, Math.round(count));
    }
    const arr = source.raiMediaFilteredReasons ?? source.rai_media_filtered_reasons;
    if (Array.isArray(arr)) {
      for (const item of arr) {
        const reason = typeof item === 'string' ? item.trim() : '';
        if (reason) reasons.add(reason);
      }
    }
  }

  if (filteredCount > 0 && reasons.size === 0) {
    reasons.add(`rai_media_filtered_count=${filteredCount}`);
  }
  return Array.from(reasons);
}

async function resolveGeminiVideoRefToUrl(videoRef: string, apiKey: string): Promise<string | null> {
  const ref = videoRef.trim();
  if (!ref) return null;
  if (isHttpUrl(ref)) return ref;

  let fileName = '';
  if (ref.startsWith('files/')) {
    fileName = ref;
  } else {
    const pathMatch = ref.match(/(?:^|\/)(files\/[A-Za-z0-9._-]+)/);
    if (pathMatch?.[1]) fileName = pathMatch[1];
  }

  if (!fileName) return null;

  const metadataRes = await fetch(`${GEMINI_VIDEO_API_BASE}/${fileName}`, {
    headers: { 'x-goog-api-key': apiKey },
  });
  if (!metadataRes.ok) return null;

  const metadata = (await metadataRes.json()) as Record<string, unknown>;
  const downloadUri = readString(metadata.downloadUri) || readString(metadata.download_uri);
  if (downloadUri && isHttpUrl(downloadUri)) return downloadUri;

  const uri = readString(metadata.uri);
  if (uri && isHttpUrl(uri)) return uri;
  return null;
}

async function normalizeSceneVideosForConcat(sceneVideoUrls: string[]): Promise<string[]> {
  const normalizedUrls: string[] = [];
  for (let index = 0; index < sceneVideoUrls.length; index += 1) {
    const rawUrl = sceneVideoUrls[index];
    const sourceUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!sourceUrl || !isHttpUrl(sourceUrl)) {
      throw new Error(`Scene ${index + 1} returned an invalid video URL: "${rawUrl}"`);
    }

    try {
      const normalized = await normalizeAndValidateFinalVideo(sourceUrl);
      normalizedUrls.push(normalized);
      continue;
    } catch (firstError) {
      if (isFalHostedUrl(sourceUrl)) {
        throw new Error(
          `Scene ${index + 1} video normalization failed before merge: ${
            firstError instanceof Error ? firstError.message : String(firstError)
          }${formatFalValidationError(firstError)}`
        );
      }
    }

    let mirroredUrl = '';
    try {
      mirroredUrl = await mirrorVideoUrlToFalStorage(sourceUrl, index);
    } catch (uploadError) {
      throw new Error(
        `Scene ${index + 1} video could not be mirrored to Fal storage: ${
          uploadError instanceof Error ? uploadError.message : String(uploadError)
        }`
      );
    }

    try {
      const normalizedMirrored = await normalizeAndValidateFinalVideo(mirroredUrl);
      normalizedUrls.push(normalizedMirrored);
    } catch (secondError) {
      throw new Error(
        `Scene ${index + 1} video normalization failed after Fal storage mirror: ${
          secondError instanceof Error ? secondError.message : String(secondError)
        }${formatFalValidationError(secondError)}`
      );
    }
  }
  return normalizedUrls;
}

function getSceneDurationSeconds(scene: ReelScene): number {
  return Math.max(1, Number(scene.duration) || 8);
}

function getExpectedFinalDurationSeconds(scenes: ReelScene[]): number {
  const total = scenes.reduce((sum, scene) => sum + getSceneDurationSeconds(scene), 0);
  return Math.min(MAX_REEL_DURATION_SECONDS, Math.max(1, total));
}

function getTransitionBlendMode(scene: ReelScene): string {
  switch (scene.transitionToNext) {
    case 'zoomwipe':
      return 'screen';
    case 'ripple':
      return 'overlay';
    case 'cosmicwipe':
      return 'lighten';
    case 'fade':
      return 'normal';
    default:
      return 'normal';
  }
}

function toMs(seconds: number): number {
  return Math.max(0, Math.round(seconds * 1000));
}

async function trimVideoSegment(videoUrl: string, startSeconds: number, durationSeconds: number): Promise<string> {
  const result = await fal.subscribe(TRIM_VIDEO_MODEL, {
    input: {
      video_url: videoUrl,
      start_time: Math.max(0, startSeconds),
      duration: Math.max(0.1, durationSeconds),
    },
  });
  return extractVideoUrlFromFalData(result.data);
}

function canUseReferenceClipSplit(videoReelInput: VideoReelInput): boolean {
  if (videoReelInput.mode !== 'FROM_REFERENCE_VIDEO') return false;
  if (!videoReelInput.referenceVideoUrl?.trim()) return false;
  const kind = videoReelInput.referenceVideoKind || 'DIRECT_URL';
  return kind === 'LOCAL_MP4' || kind === 'DIRECT_URL';
}

function getReferenceClipStart(scene: ReelScene): number {
  if (Number.isFinite(scene.sourceStart)) {
    return Math.max(0, Number(scene.sourceStart));
  }
  return Math.max(0, Number(scene.start) || 0);
}

async function buildSceneVideosFromReferenceSource(
  sourceVideoUrl: string,
  scenes: ReelScene[]
): Promise<string[]> {
  return await Promise.all(
    scenes.map(async (scene) => {
      const startSeconds = getReferenceClipStart(scene);
      const durationSeconds = getSceneDurationSeconds(scene);
      return await trimVideoSegment(sourceVideoUrl, startSeconds, durationSeconds);
    })
  );
}

async function createTransitionClip(currentSceneUrl: string, nextSceneUrl: string, scene: ReelScene): Promise<string> {
  const currentDuration = getSceneDurationSeconds(scene);
  const tailStart = Math.max(0, currentDuration - TRANSITION_DURATION_SECONDS);

  const [tailClipUrl, headClipUrl] = await Promise.all([
    trimVideoSegment(currentSceneUrl, tailStart, TRANSITION_DURATION_SECONDS),
    trimVideoSegment(nextSceneUrl, 0, TRANSITION_DURATION_SECONDS),
  ]);

  const blendResult = await fal.subscribe(BLEND_VIDEO_MODEL, {
    input: {
      bottom_video_url: tailClipUrl,
      top_video_url: headClipUrl,
      blend_mode: getTransitionBlendMode(scene),
      opacity: 1,
      shortest: true,
    },
  });
  return extractVideoUrlFromFalData(blendResult.data);
}

async function buildTransitionAwareTimeline(sceneVideoUrls: string[], scenes: ReelScene[]): Promise<string[]> {
  const timelineUrls: string[] = [];
  for (let i = 0; i < sceneVideoUrls.length; i += 1) {
    const sceneUrl = sceneVideoUrls[i];
    const scene = scenes[i];
    const isLast = i === sceneVideoUrls.length - 1;
    const sceneDuration = getSceneDurationSeconds(scene);

    if (isLast || sceneDuration <= TRANSITION_DURATION_SECONDS) {
      timelineUrls.push(sceneUrl);
      continue;
    }

    const bodyDuration = sceneDuration - TRANSITION_DURATION_SECONDS;
    const bodyUrl = await trimVideoSegment(sceneUrl, 0, bodyDuration);
    timelineUrls.push(bodyUrl);

    const transitionUrl = await createTransitionClip(sceneUrl, sceneVideoUrls[i + 1], scene);
    timelineUrls.push(transitionUrl);
  }
  return timelineUrls;
}

type ComposeTrack = {
  id: string;
  type: 'video' | 'audio';
  keyframes: Array<{ timestamp: number; duration: number; url: string }>;
};

async function maybeApplyStrictAudioAndOverlays(
  videoUrl: string,
  payload: FalJobPayload,
  expectedDurationSeconds: number
): Promise<string> {
  let workingVideoUrl = videoUrl;
  const timelineDurationMs = toMs(expectedDurationSeconds);
  const audioTrackUrls: string[] = [];
  const enableVoiceoverAudio =
    payload.pipelineOptions?.forceVoiceoverAudio ?? STRICT_REELS_ENABLE_ELEVENLABS_AUDIO;
  const requireVoiceoverAudio = payload.pipelineOptions?.forceVoiceoverAudio === true;
  const enableAutoSubtitle =
    payload.pipelineOptions?.forceAutoSubtitle ?? STRICT_REELS_ENABLE_AUTO_SUBTITLE;
  const ambientAudioUrl =
    payload.pipelineOptions?.ambientAudioUrl?.trim() || STRICT_REELS_AMBIENT_AUDIO_URL;

  if (enableVoiceoverAudio) {
    try {
      const voiceoverUrl = await synthesizeElevenLabsAndUploadToFal(payload.script, payload.brandContext);
      audioTrackUrls.push(voiceoverUrl);
    } catch (error) {
      if (requireVoiceoverAudio) {
        throw error instanceof Error
          ? error
          : new Error('Failed to generate required ElevenLabs voiceover audio');
      }
      console.warn('[reels][strict] ElevenLabs audio unavailable, continuing without voiceover', error);
    }
  }

  if (ambientAudioUrl) {
    audioTrackUrls.push(ambientAudioUrl);
  }

  if (audioTrackUrls.length > 0) {
    const tracks: ComposeTrack[] = [
      {
        id: 'video-main',
        type: 'video',
        keyframes: [{ timestamp: 0, duration: timelineDurationMs, url: workingVideoUrl }],
      },
      ...audioTrackUrls.map((audioUrl, index) => ({
        id: `audio-${index + 1}`,
        type: 'audio' as const,
        keyframes: [{ timestamp: 0, duration: timelineDurationMs, url: audioUrl }],
      })),
    ];

    try {
      const composeResult = await fal.subscribe(COMPOSE_MODEL, {
        input: { tracks },
      });
      workingVideoUrl = extractVideoUrlFromFalData(composeResult.data);
    } catch (error) {
      // Fallback to single-audio replacement only when at least one audio track exists.
      const fallbackAudioUrl = audioTrackUrls[0];
      const mergeResult = await fal.subscribe(MERGE_AUDIO_VIDEO_MODEL, {
        input: {
          video_url: workingVideoUrl,
          audio_url: fallbackAudioUrl,
        },
      });
      workingVideoUrl = extractVideoUrlFromFalData(mergeResult.data);
      console.warn('[reels][strict] Compose audio mix failed, applied single-track audio merge fallback', error);
    }
  }

  if (enableAutoSubtitle) {
    const subtitleResult = await fal.subscribe(AUTO_SUBTITLE_MODEL, {
      input: {
        video_url: workingVideoUrl,
        language: payload.videoReelInput.language || 'en',
        font_name: 'Montserrat',
        font_size: 66,
        font_weight: 'bold',
        font_color: 'yellow',
        highlight_color: 'yellow',
        stroke_width: 3,
        stroke_color: 'black',
        background_color: 'none',
        position: 'bottom',
        y_offset: 90,
        words_per_subtitle: 3,
        enable_animation: false,
      },
    });
    workingVideoUrl = extractVideoUrlFromFalData(subtitleResult.data);
  }

  return workingVideoUrl;
}

async function maybeMergeVoiceoverAudio(videoUrl: string, payload: FalJobPayload): Promise<string> {
  const shouldMergeVoiceover = payload.pipelineOptions?.mergeVoiceoverAudio === true;
  if (!shouldMergeVoiceover) return videoUrl;

  const requireVoiceoverAudio = payload.pipelineOptions?.requireVoiceoverAudio === true;
  let voiceoverUrl = '';

  try {
    voiceoverUrl = await synthesizeElevenLabsAndUploadToFal(payload.script, payload.brandContext);
  } catch (error) {
    if (requireVoiceoverAudio) {
      throw error instanceof Error
        ? error
        : new Error('Failed to generate required ElevenLabs voiceover audio');
    }
    console.warn('[reels] Voiceover merge requested, but ElevenLabs audio generation failed', error);
    return videoUrl;
  }

  const mergeResult = await fal.subscribe(MERGE_AUDIO_VIDEO_MODEL, {
    input: {
      video_url: videoUrl,
      audio_url: voiceoverUrl,
    },
  });
  return extractVideoUrlFromFalData(mergeResult.data);
}

async function normalizeAndValidateFinalVideo(videoUrl: string): Promise<string> {
  // Try normalize via concat model (works for strict target fps/resolution constraints).
  try {
    const normalizeResult = await fal.subscribe(CONCAT_MODEL, {
      input: {
        video_urls: [videoUrl],
        target_fps: TARGET_VIDEO_FPS,
        resolution: { width: TARGET_VIDEO_WIDTH, height: TARGET_VIDEO_HEIGHT },
      },
    });
    assertFinalVideoCompliance(normalizeResult.data);
    return extractVideoUrlFromFalData(normalizeResult.data);
  } catch {
    // Fallback: scale-only normalization.
  }

  const scaleResult = await fal.subscribe(SCALE_VIDEO_MODEL, {
    input: {
      video_url: videoUrl,
      width: TARGET_VIDEO_WIDTH,
      height: TARGET_VIDEO_HEIGHT,
      mode: 'pad',
    },
  });
  const scaledUrl = extractVideoUrlFromFalData(scaleResult.data);

  // Best-effort metadata validation pass.
  try {
    const metadataResult = await fal.subscribe(METADATA_MODEL, {
      input: { media_url: scaledUrl },
    });
    assertFinalVideoCompliance(metadataResult.data);
  } catch (error) {
    console.warn('[reels][strict] Metadata validation unavailable after fallback normalization', error);
  }

  return scaledUrl;
}

async function assembleStrictSpecVideo(sceneVideoUrls: string[], scenes: ReelScene[], payload: FalJobPayload): Promise<string> {
  const timelineUrls = await buildTransitionAwareTimeline(sceneVideoUrls, scenes);
  const concatResult = await fal.subscribe(CONCAT_MODEL, {
    input: {
      video_urls: timelineUrls,
      target_fps: TARGET_VIDEO_FPS,
      resolution: { width: TARGET_VIDEO_WIDTH, height: TARGET_VIDEO_HEIGHT },
    },
  });

  let finalVideoUrl = extractVideoUrlFromFalData(concatResult.data);
  const expectedDurationSeconds = getExpectedFinalDurationSeconds(scenes);

  finalVideoUrl = await maybeApplyStrictAudioAndOverlays(finalVideoUrl, payload, expectedDurationSeconds);
  finalVideoUrl = await normalizeAndValidateFinalVideo(finalVideoUrl);
  return finalVideoUrl;
}

interface SceneVideoGenerationOptions {
  negativePrompt?: string;
  referenceFrameDataUrl?: string;
}

async function generateSceneVideoWithGemini(
  prompt: string,
  durationSeconds: number,
  options?: SceneVideoGenerationOptions
): Promise<string> {
  const apiKey = (process.env.GEMINI_API_KEY as string | undefined)?.trim();
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY for Gemini scene video generation');
  }

  let submitRes: Response | null = null;
  let lastSubmitErrorMessage = '';

  for (let attempt = 0; attempt < GEMINI_SUBMIT_MAX_RETRIES; attempt += 1) {
    try {
      const instancePayload: Record<string, unknown> = { prompt };
      if (options?.referenceFrameDataUrl) {
        instancePayload.image = dataUrlToInlineDataPart(options.referenceFrameDataUrl);
      }

      const parametersPayload: Record<string, unknown> = {
        aspectRatio: '9:16',
        durationSeconds,
        personGeneration: options?.referenceFrameDataUrl ? 'allow_adult' : 'allow_all',
      };
      if (options?.negativePrompt?.trim()) {
        parametersPayload.negativePrompt = options.negativePrompt.trim();
      }

      submitRes = await fetch(
        `${GEMINI_VIDEO_API_BASE}/models/${encodeURIComponent(GEMINI_VIDEO_MODEL)}:predictLongRunning`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            instances: [instancePayload],
            parameters: parametersPayload,
          }),
        }
      );
    } catch (error) {
      throw new Error(
        `Gemini scene generation failed in browser (likely CORS/network). In reference-video mode use source clip split, or switch provider to OpenAI. Original error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (submitRes.ok) {
      break;
    }

    const status = submitRes.status;
    const details = (await submitRes.text()).trim();
    lastSubmitErrorMessage = details;
    const isRetriable = status === 429 || status === 503;
    if (!isRetriable) {
      throw new Error(`Gemini video generation submit failed (${status})${details ? `: ${details}` : ''}`);
    }

    const retryAfterMs = parseRetryAfterMs(submitRes);
    const backoffMs = retryAfterMs ?? getBackoffMs(attempt);
    await sleep(backoffMs);
  }

  if (!submitRes || !submitRes.ok) {
    throw new Error(
      `Gemini video generation submit failed (429) after ${GEMINI_SUBMIT_MAX_RETRIES} retries. ${
        lastSubmitErrorMessage ? `Details: ${lastSubmitErrorMessage}` : 'Rate limit exceeded.'
      }`
    );
  }

  const submitJson = (await submitRes.json()) as Record<string, unknown>;

  const submitError = asRecord(submitJson.error);
  if (submitError) {
    const submitErrorMessage =
      typeof submitError.message === 'string'
        ? submitError.message
        : JSON.stringify(submitError);
    throw new Error(`Gemini video generation submit returned error: ${submitErrorMessage}`);
  }

  // Fast-path direct response (rare)
  const directUrl = extractGeminiVideoUrlFromOperationResponse(submitJson);
  if (directUrl) return directUrl;

  const operationName = typeof submitJson.name === 'string' ? submitJson.name : '';
  if (!operationName) {
    throw new Error('Gemini video generation returned no operation name or video URL');
  }

  for (let attempt = 0; attempt < 45; attempt += 1) {
    await sleep(4000);
    const statusRes = await fetch(
      `${GEMINI_VIDEO_API_BASE}/${operationName}`,
      {
        headers: { 'x-goog-api-key': apiKey },
      }
    );
    if (!statusRes.ok) {
      const status = statusRes.status;
      if (status === 429 || status === 503) continue;
      const details = (await statusRes.text()).trim();
      throw new Error(`Gemini video generation status failed (${status})${details ? `: ${details}` : ''}`);
    }
    const statusJson = (await statusRes.json()) as Record<string, unknown>;
    if (statusJson.done === true) {
      const err = asRecord(statusJson.error);
      if (err) {
        const errorMessage =
          typeof err.message === 'string' ? err.message : JSON.stringify(err);
        throw new Error(`Gemini video operation failed: ${errorMessage}`);
      }

      const response = asRecord(statusJson.response);
      if (!response) {
        throw new Error('Gemini video operation completed without response payload');
      }

      const videoUrl = extractGeminiVideoUrlFromOperationResponse(response);
      if (videoUrl) return videoUrl;

      const refs = extractGeminiVideoRefsFromOperationResponse(response);
      for (const ref of refs) {
        try {
          const resolvedUrl = await resolveGeminiVideoRefToUrl(ref, apiKey);
          if (resolvedUrl) return resolvedUrl;
        } catch {
          // Keep trying other refs.
        }
      }

      if (options?.referenceFrameDataUrl) {
        // Fallback: some image-guided runs complete without emitted media URL.
        return await generateSceneVideoWithGemini(prompt, durationSeconds, {
          ...options,
          referenceFrameDataUrl: undefined,
        });
      }

      const raiReasons = extractGeminiRaiReasons(response);
      const raiSuffix = raiReasons.length > 0
        ? ` RAI filtered reasons: ${raiReasons.join(', ')}.`
        : '';
      const refSuffix = refs.length > 0
        ? ` Returned refs: ${refs.slice(0, 3).join(', ')}.`
        : '';
      const responseKeys = Object.keys(response).slice(0, 12).join(', ');
      throw new Error(
        `Gemini video operation completed without generated video URL.${raiSuffix}${refSuffix} Response keys: [${responseKeys}]`
      );
    }
  }

  throw new Error('Gemini video generation timed out while waiting for operation completion');
}

async function generateSceneVideoWithOpenAI(
  prompt: string,
  durationSeconds: number,
  _options?: SceneVideoGenerationOptions
): Promise<string> {
  const apiKey = (process.env.OPENAI_API_KEY as string | undefined)?.trim();
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY for OpenAI scene video generation');
  }

  let submitRes: Response;
  try {
    submitRes = await fetch(OPENAI_VIDEO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_VIDEO_MODEL,
        prompt,
        duration: durationSeconds,
        size: '1080x1920',
        fps: 30,
      }),
    });
  } catch (error) {
    throw new Error(
      `OpenAI scene generation failed in browser (likely CORS/network). In reference-video mode use source clip split. Original error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!submitRes.ok) {
    const details = await submitRes.text();
    throw new Error(`OpenAI video generation submit failed (${submitRes.status}): ${details}`);
  }

  const submitJson = (await submitRes.json()) as Record<string, unknown>;
  const directUrl = extractAnyUrl(submitJson);
  if (directUrl) return directUrl;

  const requestId = typeof submitJson.id === 'string' ? submitJson.id : '';
  if (!requestId) {
    throw new Error('OpenAI video generation returned no URL and no request id');
  }

  for (let attempt = 0; attempt < 45; attempt += 1) {
    await sleep(4000);
    const statusRes = await fetch(`${OPENAI_VIDEO_ENDPOINT}/${encodeURIComponent(requestId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!statusRes.ok) continue;
    const statusJson = (await statusRes.json()) as Record<string, unknown>;
    const videoUrl = extractAnyUrl(statusJson);
    if (videoUrl) return videoUrl;

    const status = typeof statusJson.status === 'string' ? statusJson.status : '';
    if (status && ['failed', 'cancelled', 'canceled', 'error'].includes(status.toLowerCase())) {
      throw new Error(`OpenAI video generation failed with status: ${status}`);
    }
  }

  throw new Error('OpenAI video generation timed out while waiting for completion');
}

async function generateSceneVideoWithProvider(
  provider: SceneVideoProvider,
  scenePrompt: string,
  sceneDuration: number,
  options?: SceneVideoGenerationOptions
): Promise<string> {
  if (provider === 'openai') {
    return generateSceneVideoWithOpenAI(scenePrompt, sceneDuration, options);
  }
  return generateSceneVideoWithGemini(scenePrompt, sceneDuration, options);
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
    if (videoReelInput.mode === 'FROM_IMAGES') {
      const characterRefs = getCharacterReferenceImages(videoReelInput);
      const appUiRefs = getAppUiReferenceImages(videoReelInput);
      const genericRefs = normalizeDataUrlReferences(videoReelInput.referenceImages);
      const hasExplicitReferenceGroups = characterRefs.length > 0 || appUiRefs.length > 0;
      const fallbackGenericRefs = hasExplicitReferenceGroups ? [] : genericRefs;

      if (characterRefs.length > 0 || appUiRefs.length > 0 || fallbackGenericRefs.length > 0) {
        const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
          {
            text: `Analyze these reference images for video continuity.
Return concise plain text with:
- Main character profile (face geometry, skin tone, age band, hairline, expression baseline)
- Face continuity lock rules to preserve the same person in all scenes
- App UI continuity rules (if app screenshots are provided)
- Visual style and mood
- Environment/props
- Continuity rules across scenes
- Storyline direction for this prompt: "${videoReelInput.prompt}"`,
          },
        ];

        if (characterRefs.length > 0) {
          contents.push({
            text: `Character anchor set (${characterRefs.length} image(s)): treat these as strict identity references for same-face continuity.`,
          });
          contents.push(
            ...characterRefs
              .slice(0, MAX_CHARACTER_REFERENCE_IMAGES_FOR_ANALYSIS)
              .map(dataUrlToInlineDataPart)
          );
        }

        if (appUiRefs.length > 0) {
          contents.push({
            text: `App UI anchor set (${appUiRefs.length} image(s)): preserve UI layout, labels, and interaction logic exactly.`,
          });
          contents.push(
            ...appUiRefs
              .slice(0, MAX_APP_UI_REFERENCE_IMAGES_FOR_ANALYSIS)
              .map(dataUrlToInlineDataPart)
          );
        }

        if (fallbackGenericRefs.length > 0) {
          contents.push({
            text: `General visual references (${fallbackGenericRefs.length} image(s)).`,
          });
          contents.push(
            ...fallbackGenericRefs
              .slice(0, MAX_REFERENCE_IMAGES_FOR_ANALYSIS)
              .map(dataUrlToInlineDataPart)
          );
        }

        const response = await gemini.models.generateContent({
          model: REFERENCE_ANALYSIS_MODEL,
          contents,
        });

        return (response.text || '').trim();
      }
    }

    if (videoReelInput.mode === 'FROM_REFERENCE_VIDEO' && videoReelInput.referenceVideoUrl) {
      const videoUrl = videoReelInput.referenceVideoUrl;
      const sourceKind = videoReelInput.referenceVideoKind || 'DIRECT_URL';
      const sourceTitle = videoReelInput.referenceVideoTitle || videoReelInput.prompt;
      const characterRefs = getCharacterReferenceImages(videoReelInput);
      const appUiRefs = getAppUiReferenceImages(videoReelInput);
      const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        {
          text: `Analyze this reference video and propose a NEW continuation storyline for short-form content.
Return concise plain text with:
- What happens in the reference video
- Speech-to-text summary of key spoken moments
- Main character identity and behavior
- Camera/editing style
- Visual peaks (breathing demos, hand gestures, close-ups)
- Audio peaks (voice intensity spikes, breath sounds, technique emphasis)
- New storyline continuation plan (new content, same character/style)
- Strict continuity constraints
Source type: ${sourceKind}
Source title/context: ${sourceTitle}
Prompt: "${videoReelInput.prompt}"
Reference URL: ${videoUrl}`,
        },
      ];

      if (characterRefs.length > 0) {
        contents.push({
          text: `Additional character anchors (${characterRefs.length} image(s)): preserve this exact face identity across all generated scenes.`,
        });
        contents.push(
          ...characterRefs
            .slice(0, MAX_CHARACTER_REFERENCE_IMAGES_FOR_ANALYSIS)
            .map(dataUrlToInlineDataPart)
        );
      }

      if (appUiRefs.length > 0) {
        contents.push({
          text: `Additional app UI anchors (${appUiRefs.length} image(s)): preserve real app layout and labels.`,
        });
        contents.push(
          ...appUiRefs
            .slice(0, MAX_APP_UI_REFERENCE_IMAGES_FOR_ANALYSIS)
            .map(dataUrlToInlineDataPart)
        );
      }

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
 * Runs the reel pipeline:
 *   1) Optional Gemini analysis of reference source
 *   2) Per-scene video generation with selected provider (Gemini/OpenAI)
 *   3) Fal concat for final assembly
 *
 * Each step calls fal.subscribe() which blocks until the model finishes
 * and automatically handles fal's queue / polling internally.
 */
export async function generateReelVideo(payload: FalJobPayload): Promise<FalJobResult> {
  const { jobId, draftId, scenes, brandContext, videoReelInput, sceneVideoProvider, sourceAnalysisSummary } = payload;
  const provider: SceneVideoProvider =
    payload.pipelineOptions?.forceSceneVideoProvider || sceneVideoProvider || 'gemini';
  const strictRequested =
    STRICT_REELS_SPEC_MODE ||
    Boolean(
      payload.pipelineOptions?.forceStrictAssembly ||
      payload.pipelineOptions?.forceVoiceoverAudio ||
      payload.pipelineOptions?.forceAutoSubtitle ||
      payload.pipelineOptions?.ambientAudioUrl
    );
  const useStrictSpecMode =
    !payload.pipelineOptions?.disableStrictAssembly &&
    strictRequested;

  const referenceAnalysis =
    sourceAnalysisSummary?.trim() || (await analyzeReferenceContext(videoReelInput));

  let sceneVideoUrls: string[] = [];
  const allowReferenceClipSplit =
    REFERENCE_CLIP_FIRST_MODE &&
    canUseReferenceClipSplit(videoReelInput) &&
    !payload.pipelineOptions?.disableReferenceClipSplit;
  const requestedConcurrency = payload.pipelineOptions?.sceneGenerationConcurrency;
  const sceneGenerationConcurrency = Math.max(
    1,
    Math.floor(requestedConcurrency ?? scenes.length)
  );
  const sceneGenerationDelayMs = Math.max(
    0,
    Math.floor(payload.pipelineOptions?.sceneGenerationDelayMs ?? 0)
  );

  // Reference-video mode: prefer splitting the original source video into best 8s clips.
  if (allowReferenceClipSplit) {
    try {
      sceneVideoUrls = await buildSceneVideosFromReferenceSource(
        videoReelInput.referenceVideoUrl!.trim(),
        scenes
      );
    } catch (error) {
      console.warn('[reels] Reference clip split failed; falling back to provider scene generation', error);
    }
  }

  // Fallback / prompt-only path: generate each scene via selected provider in parallel.
  if (sceneVideoUrls.length === 0) {
    sceneVideoUrls = await mapWithConcurrency(
      scenes,
      sceneGenerationConcurrency,
      async (scene, index) => {
        if (sceneGenerationDelayMs > 0 && index > 0) {
          await sleep(sceneGenerationDelayMs);
        }
        const scenePrompt = buildSceneVideoPrompt(
          scene,
          scenes.length,
          brandContext,
          videoReelInput,
          referenceAnalysis
        );
        const referenceFrameDataUrl = pickSceneReferenceFrameDataUrl(videoReelInput, index);
        return await generateSceneVideoWithProvider(
          provider,
          scenePrompt,
          Math.max(1, Math.round(scene.duration || 8)),
          {
            negativePrompt: scene.negativePrompt,
            referenceFrameDataUrl,
          }
        );
      }
    );
  }

  if (sceneVideoUrls.length === 0) {
    throw new Error('No scene videos were generated');
  }

  if (payload.pipelineOptions?.normalizeSceneVideosBeforeConcat) {
    sceneVideoUrls = await normalizeSceneVideosForConcat(sceneVideoUrls);
  }

  if (useStrictSpecMode) {
    const strictFinalVideoUrl = await assembleStrictSpecVideo(sceneVideoUrls, scenes, payload);
    return { jobId, draftId, finalVideoUrl: strictFinalVideoUrl };
  }

  let concatResult: Awaited<ReturnType<typeof fal.subscribe>>;
  try {
    concatResult = await fal.subscribe(CONCAT_MODEL, {
      input: {
        video_urls: sceneVideoUrls,
        target_fps: TARGET_VIDEO_FPS,
        resolution: { width: TARGET_VIDEO_WIDTH, height: TARGET_VIDEO_HEIGHT },
      },
    });
  } catch (error) {
    const videoHostSummary = sceneVideoUrls
      .map((url) => {
        try {
          return new URL(url).hostname;
        } catch {
          return 'invalid-url';
        }
      })
      .join(', ');
    throw new Error(
      `Fal merge-videos failed for ${sceneVideoUrls.length} scene(s). Hosts: [${videoHostSummary}]. ${
        error instanceof Error ? error.message : String(error)
      }${formatFalValidationError(error)}`
    );
  }
  assertFinalVideoCompliance(concatResult.data);
  let finalVideoUrl = extractUrl(concatResult.data, 'video', 'url');
  finalVideoUrl = await maybeMergeVoiceoverAudio(finalVideoUrl, payload);
  finalVideoUrl = await normalizeAndValidateFinalVideo(finalVideoUrl);
  return { jobId, draftId, finalVideoUrl };
}
