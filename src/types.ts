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
export type SceneVideoProvider = 'gemini' | 'openai';

export type VideoReferenceKind =
  | 'YOUTUBE'
  | 'INSTAGRAM'
  | 'LOCAL_MP4'
  | 'DIRECT_URL';

export type ReelTransitionType =
  | 'zoomwipe'
  | 'ripple'
  | 'cosmicwipe'
  | 'fade'
  | 'none';

export interface ReelScene {
  index: number;
  start: number;
  end: number;
  duration: number;
  narrative: string;
  visualPrompt: string;
  /** Optional negative prompt terms for scene generation (comma-separated terms). */
  negativePrompt?: string;
  /** Source clip timestamps from the reference video (seconds) */
  sourceStart?: number;
  sourceEnd?: number;
  cameraMovement?: string;
  transitionToNext?: ReelTransitionType;
  overlayText?: string;
}

export interface VideoReelInput {
  prompt: string;
  mode: VideoReelMode;
  referenceVideoUrl?: string;
  referenceVideoKind?: VideoReferenceKind;
  referenceVideoTitle?: string;
  /** How uploaded reference images should be interpreted by the scene generator. */
  referenceImageIntent?:
    | 'general'
    | 'app_ui_exact'
    | 'character_face_exact'
    | 'app_ui_plus_character_face';
  referenceImages?: string[]; // base64 data URLs
  /** Optional explicit app UI reference set (screenshots) for multimodal analysis/prompting. */
  appUiReferenceImages?: string[];
  /** Optional explicit character identity reference set (same person across scenes). */
  characterReferenceImages?: string[];
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
  /** Explicit social metadata for dual-platform publishing */
  instagramCaption?: string;
  youtubeDescription?: string;
  targetPlatforms?: Array<'instagram_reels' | 'youtube_shorts'>;
  normalizedDurationSeconds?: number;
  sourceAnalysisSummary?: string;
  sceneVideoProvider?: SceneVideoProvider;
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
  visualDirection?: string;
  cameraDirection?: string;
  humanDirection?: string;
  microInteractionDirection?: string;
}

// ─── App Marketing Videos ──────────────────────────────────────────────────

export interface AppMarketingVideoInput {
  appName: string;
  campaignGoal: string;
  callToAction: string;
  realUserStories?: string;
  targetAudience?: string;
  appUrl?: string;
  targetDurationSeconds: number;
  language: string;
  referenceImages: string[]; // app UI screenshots (base64 data URLs)
  /** Optional face identity anchors for strict character continuity in generated scenes. */
  characterReferenceImages?: string[];
  referenceVideoUrl?: string;
  referenceVideoKind?: VideoReferenceKind;
}

export type AppMarketingVideoStatus = 'draft' | 'generating' | 'ready' | 'error';

export interface AppMarketingVideoDraft {
  id: string;
  appName: string;
  campaignGoal: string;
  callToAction: string;
  realUserStories?: string;
  targetAudience?: string;
  appUrl?: string;
  language: string;
  targetDurationSeconds: number;
  normalizedDurationSeconds: number;
  sceneVideoProvider: SceneVideoProvider;
  referenceImages: string[]; // app UI screenshots
  characterReferenceImages?: string[];
  referenceVideoUrl?: string;
  referenceVideoKind?: VideoReferenceKind;
  headline: string;
  voiceoverScript: string;
  caption: string;
  hashtags: string[];
  visualAnalysisSummary?: string;
  scenes: ReelScene[];
  status: AppMarketingVideoStatus;
  finalVideoUrl?: string;
  errorMessage?: string;
}

// ─── YouTube Thumbnails ──────────────────────────────────────────────────────

export type ThumbnailBrand = 'school_of_mantras' | 'school_of_breath';

export type SchoolOfBreathMode = 'with_character' | 'without_character';

export type SchoolOfBreathLayoutStyle =
  | 'giant_hook_left'
  | 'balanced_subject_right'
  | 'centered_cosmic_hero'
  | 'mega_word_micro_sub'
  | 'diagonal_slash_story'
  | 'vertical_text_tower'
  | 'number_badge_micro_hook'
  | 'photo_heavy_outline_text'
  | 'text_behind_subject'
  | 'dual_depth_dynamic_text'
  | 'color_word_stack'
  | 'subject_bleed_overlap';

export type SchoolOfBreathCategory =
  | 'pranayama'
  | 'tummo'
  | 'humming'
  | 'morning_routine'
  | 'nitric_oxide'
  | 'digestion'
  | 'anxiety_relief'
  | 'chakra_balance'
  | 'beginner_breathing'
  | 'technique'
  | 'routine'
  | 'healing'
  | 'energy'
  | 'biohack'
  | 'gut'
  | 'sleep'
  | 'focus'
  | 'immunity'
  | 'beginner'
  | 'advanced'
  | 'mudra';

export type SchoolOfBreathHookFamily =
  | 'safe'
  | 'aggressive'
  | 'curiosity'
  | 'big_promise'
  | 'instruction'
  | 'biohack'
  | 'healing';

export interface SchoolOfBreathSettings {
  mode: SchoolOfBreathMode;
  category: SchoolOfBreathCategory;
  hookFamily: SchoolOfBreathHookFamily;
  layoutPreset?: 'sob-channel-hard-stack' | 'sob-viral-typographic';
  styleSystem?: 'classic' | 'viral_typographic';
  layoutStyle?: SchoolOfBreathLayoutStyle;
  subjectType?: 'abhi' | 'support_visual';
  textSide?: 'left' | 'right';
  subjectSide?: 'left' | 'right';
  topLine?: string;
  bottomStrip?: string;
  supportVisual?: string;
  colorEmphasis?: string;
  backgroundStyle?: string;
  visualBadgeType?: string;
  arrowAllowed?: boolean;
  characterPose?: string;
  isChannelProvenHook?: boolean;
}

export type IntentKey =
  | 'abundance'
  | 'protection'
  | 'healing'
  | 'love'
  | 'power'
  | 'peace'
  | 'knowledge'
  | 'transformation';

export interface Intent {
  key: IntentKey;
  label: string;
  color: string;
  mood: string;
  hookWords: string[];
}

export interface Deity {
  name: string;
  visualSignature: string;
  intents: IntentKey[];
  aliases?: string[];
  auraColor?: string;
  auraStyle?: string;
  channelName?: string;
}

export interface ThumbnailPrompt {
  title: string;
  deity: string;
  intent: IntentKey;
  brand?: ThumbnailBrand;
  line1?: string;
  line2?: string;
  badge?: string;
  special?: string;
  schoolOfBreath?: SchoolOfBreathSettings;
}

export interface ThumbnailCanvaSpec {
  hookWord: string;
  secondary: string;
  badge?: string;
  schoolLabel?: string;
  seoTitle?: string;
  colors: {
    hook: string;
    secondary: string;
    brand: string;
    badge?: string;
    aura?: string;
  };
  topStripText?: string;
  ctaText?: string;
  supportVisual?: string;
  backgroundTheme?: string;
  visualBadgeType?: string;
  characterPose?: string;
  subjectType?: 'abhi' | 'support_visual';
  layoutStyle?: SchoolOfBreathLayoutStyle;
  hookLine1?: string;
  hookLine2?: string;
}

export type ThumbnailDraftStatus = 'draft' | 'generating' | 'ready' | 'error';

export interface ThumbnailDraft {
  id: string;
  status: ThumbnailDraftStatus;
  prompt: ThumbnailPrompt;
  baseImages: string[];
  canvaSpec: ThumbnailCanvaSpec;
  createdAt: Date;
  generationPrompts?: string[];
  templateId?: string;
  errorMessage?: string;
  validationSummary?: string[];
}

export interface MantrasBrandContext {
  canvas: {
    width: 1280;
    height: 720;
    aspect: '16:9';
  };
  background: string[];
  rules: {
    deityPlacement: string;
    textPlacement?: string;
    style: string;
    aura: string;
    noText: boolean;
    negativeSpaceLeft: boolean;
    textBakedIntoImage?: boolean;
  };
  deities: Deity[];
  intents: Intent[];
  hookWords: Record<IntentKey, string[]>;
}
