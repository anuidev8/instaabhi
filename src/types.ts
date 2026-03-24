/**
 * Role of each carousel slide in the narrative arc.
 * hook → second_hook → science → step(s) → recap
 */
export type SlideRole =
  | 'hook'          // Felt problem + bold promise (slide 1)
  | 'second_hook'   // Technique name + legitimacy (slide 2)
  | 'science'       // The physiology "why" (slide 3)
  | 'step'          // One breath step per slide (slides 4-N-1)
  | 'testimonial'   // Social proof / quote (optional)
  | 'recap';        // Save prompt + app CTA (last slide always)

export interface Slide {
  /** Full display text (legacy — kept for backward compat) */
  text: string;
  /** Semantic role in the carousel narrative arc */
  role?: SlideRole;
  /** Big bold headline (gold color in visuals) */
  headline?: string;
  /** Supporting body copy (white in visuals) */
  body?: string;
  /** Step number for 'step' role slides (1-based) */
  stepNumber?: number;
  /** Whether this slide is especially save-worthy (used for analytics / highlight) */
  saveWorthy?: boolean;
  /** Visual direction note for the image generator */
  visualNotes?: string;
}

export interface Draft {
  id: string;
  topic: string;
  slides: Slide[];
  imagePrompt: string;
  /** 8 per-slide prompts for Imagen (Gemini) generation */
  slideImagePrompts?: string[];
  uploadedImages: string[];
  status: 'draft' | 'images_uploaded';
  /** Model used when images were AI-generated (e.g. gemini-2.5-flash-image) */
  imageModelUsed?: string;
}

/**
 * Structured caption blocks for the viral Instagram format.
 * Each block maps to a distinct visual/editable section in the UI.
 */
export interface CaptionBlocks {
  /** 1–2 punchy hook lines. Felt pain + bold promise. */
  hook: string;
  /** Numbered points (displayed as 1️⃣ 2️⃣ 3️⃣ …). Technique, science, steps. */
  points: string[];
  /** "Try this tonight" micro-instruction. 1–2 lines. */
  microInstruction: string;
  /** Soft CTA block. Save + app + handle. */
  cta: string;
}

export interface ReadyPost {
  id: string;
  topic: string;
  slides: Slide[];
  images: string[];
  caption: string;
  hashtags: string[];
  title: string;
  /** Structured editable caption blocks (viral format) */
  captionBlocks?: CaptionBlocks;
  /** For per-slide regeneration */
  imagePrompt?: string;
  slideImagePrompts?: string[];
  imageProvider?: 'google' | 'openai';
  instagramDraftCreationId?: string;
  instagramDraftStatus?: "idle" | "creating" | "created" | "error";
  instagramDraftError?: string;
  /** After successful media_publish — live IG media id */
  instagramPublishedMediaId?: string;
  instagramPublishStatus?: "idle" | "publishing" | "published" | "error";
  instagramPublishError?: string;
}

// ─── Video Reels ────────────────────────────────────────────────────────────

export type VideoReelMode =
  | 'PROMPT_ONLY'
  | 'FROM_REFERENCE_VIDEO'
  | 'FROM_IMAGES';

export type VideoReelStatus = 'draft' | 'generating' | 'ready' | 'error';

export interface ReelScene {
  index: number;
  start: number;
  end: number;
  duration: number;
  narrative: string;
  visualPrompt: string;
}

export interface VideoReelInput {
  prompt: string;
  mode: VideoReelMode;
  referenceVideoUrl?: string;
  referenceImages?: string[]; // base64 data URLs
  targetDurationSeconds: number;
  language: string;
}

export interface VideoReelDraft {
  id: string;
  topic: string;
  /** Structured script fields — matches reference project schema */
  headline: string;   // Hook (first 3–5 seconds)
  body: string;       // Main value / steps
  cta: string;        // Call-to-action
  hashtags: string[];
  brandScore: number;
  /** Assembled from headline + body + cta — used for Fal TTS */
  script: string;
  /** Full Instagram caption with hashtags — ready to post */
  caption: string;
  scenes: ReelScene[];
  videoReelInput: VideoReelInput;
  status: VideoReelStatus;
  finalVideoUrl?: string;
  errorMessage?: string;
}

export interface BrandContext {
  name: string;
  handle: string;
  niche: string;
  voice: string;
  pillars: string;
  voiceId: string;
}
