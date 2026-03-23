export interface Slide {
  text: string;
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

export interface ReadyPost {
  id: string;
  topic: string;
  slides: Slide[];
  images: string[];
  caption: string;
  hashtags: string[];
  title: string;
  /** For per-slide regeneration */
  imagePrompt?: string;
  slideImagePrompts?: string[];
  imageProvider?: 'google' | 'openai';
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
  script: string;
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
