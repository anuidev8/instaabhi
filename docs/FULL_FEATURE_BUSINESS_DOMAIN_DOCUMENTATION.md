# Meditate with Abhi IG Creator - Full Feature, Business Logic, and Domain Logic Documentation

Last updated from codebase: April 8, 2026

## 1) Scope and objective

This document describes the implemented product logic in depth:

- all user-facing features
- business rules and constraints
- domain entities and state transitions
- AI-generation pipelines
- backend API contracts
- persistence model and cross-feature interactions

The source of truth is current code under `src/` and `server/`.

## 2) Product summary

The app is a local-first content operating system for `@meditate_with_abhi` / School of Breath.

Primary outcomes:

1. produce carousel drafts
2. generate or upload visuals
3. build ready-to-post captions and hashtags
4. produce reels and app marketing videos
5. manage a deterministic weekly content calendar
6. optionally push media to Instagram through a local Express + Graph API bridge

## 3) High-level architecture

### Frontend

- React 19 SPA (`src/App.tsx`)
- Five tabs:
  - `Carousel Drafts`
  - `Content Visuals`
  - `Video Reels Draft`
  - `App Marketing Video Generation`
  - `Content Calendar`
- IndexedDB persistence (`idb-keyval`)
- AI service layer:
  - `geminiService.ts` (carousel + caption logic)
  - `videoReelService.ts` (reel script/scenes planning)
  - `appMarketingVideoService.ts` (app campaign planning)
  - `falService.ts` (scene video generation + final assembly)

### Backend

- Express 5 server (`server/index.ts`)
- Responsibilities:
  - Meta OAuth or manual token connect
  - user connection management (in-memory)
  - Cloudinary image upload
  - Graph media container creation and publish confirmation
  - post listing and insights fetch

### Storage model

- Browser IndexedDB stores content artifacts (drafts, ready posts, reels, marketing videos, calendar)
- Backend does not store durable user records; runtime token state is in memory

## 4) Domain model and entities

### 4.1 Carousel domain

- `SlideRole`: `hook | second_hook | science | step | testimonial | recap`
- `Slide`:
  - semantic role + text structure (`headline`, `body`, `stepNumber`, `visualNotes`)
  - backward-compatible `text` always maintained
- `Draft`:
  - WIP carousel artifact
  - statuses: `draft` or `images_uploaded`
- `ReadyPost`:
  - finalized artifact for publishing/editing
  - contains slides, image array, caption blocks, flattened caption, hashtags
  - tracks Instagram draft/publish status fields

### 4.2 Caption domain

- `CaptionBlocks`:
  - `hook`
  - `points[]`
  - `microInstruction`
  - `cta`
- UI flattens/expands via `assembleCaptionFromBlocks()` and `parseCaption()` heuristics

### 4.3 Reel domain

- `VideoReelInput`:
  - modes:
    - `PROMPT_ONLY`
    - `FROM_REFERENCE_VIDEO`
    - `FROM_IMAGES`
  - supports source kinds:
    - `YOUTUBE`
    - `INSTAGRAM`
    - `LOCAL_MP4`
    - `DIRECT_URL`
- `ReelScene`:
  - strict timeline unit
  - includes narrative, visual prompt, optional source clip windows, transition, overlay text
- `VideoReelDraft`:
  - generated script + metadata + scenes
  - status lifecycle: `draft -> generating -> ready | error`

### 4.4 App marketing video domain

- `AppMarketingVideoInput`: app/campaign metadata + real stories + references
- `AppMarketingVideoDraft`:
  - generated plan + scene set + render metadata
  - status lifecycle: `draft -> generating -> ready | error`

### 4.5 Calendar domain

- `CalendarPost`: day, format, pillar, title, hook, technique, hashtag set, optional caption
- `CalendarStory`: story idea per day
- `WeekCalendar`: week offset + posts + stories

## 5) Global app shell logic (`App.tsx`)

### Shared state containers

- `drafts`
- `readyPosts`
- `reelDrafts`
- `marketingDrafts`

### Hydration and save strategy

- On boot, app blocks on `isLoaded` while reading IndexedDB keys
- After load, each collection auto-saves on change
- This avoids overwriting persisted data with empty initial arrays

### Cross-tab intent handoff

- Calendar can push intent into:
  - `pendingDraftTopic` -> opens Drafts modal prefilled
  - `pendingReelPrompt` -> opens Reels modal prefilled

## 6) Feature logic in depth

## 6.1 Carousel Drafts tab (`DraftsTab`)

### Core user flow

1. User selects topic (suggested or custom) and slide count (`1..8`, default `6`)
2. `generateDraft()` returns topic + narrative slides + image prompt package
3. User acquires images:
   - AI generation (`google` or `openai`)
   - or manual upload
4. Build post:
   - `generatePostContent()` creates title + caption blocks + hashtags
   - draft is removed
   - ready post is added
   - app routes to Content Visuals

### Business rules

- Slide count hard bounded to max 8
- Build button enabled only when image count equals slide count
- Image upload truncates to slide count
- Draft creation normalizes every slide so `text` is always populated
- Wake lock active during draft/image generation

## 6.2 Content Visuals tab (`ContentVisualsTab`)

### Two visual modes

- `Phone Preview`: `InstagramMobileMockup`
- `Slides`: `SplitImagesDisplay`

### Split/export logic

- If post has a single image, it is treated as a grid source:
  - configurable rows/cols/padding/gap/global shift/per-slide shifts
- If post has multiple images:
  - each is letterboxed to strict `1080x1080` (no aspect distortion)
- Export:
  - Desktop: ZIP download
  - Mobile: Web Share file flow (fallback to ZIP)

### Caption editing integration

- Uses `CaptionEditor`
- updates `captionBlocks`, flattened `caption`, and hashtags in `readyPosts`

### Instagram publish integration

- Flow:
  1. upload to Cloudinary (`/uploads/cloudinary`)
  2. create draft container (`/instagram/publish/draft`)
  3. optional confirm publish (`/instagram/publish/confirm`)
- Internal status fields:
  - `instagramDraftStatus`: `idle | creating | created | error`
  - `instagramPublishStatus`: `idle | publishing | published | error`

Note: draft/publish controls are currently hidden in UI comments but logic is implemented.

## 6.3 Instagram Mobile Mockup (`InstagramMobileMockup`)

### Per-slide replacement domain logic

- Regeneration available only when source post has AI prompt context
- Prompt prefill priority:
  1. `slideImagePrompts[index]`
  2. role-aware generated prompt
  3. parsed legacy prompt
  4. fallback prompt
- AI Suggest appends a targeted improvement instruction based on role + brand rules

### Recap/CTA special handling

- Recap (last slide or role `recap`) uses real app screenshot compositing
- User can choose from `APP_MOCKUP_PATHS`
- `buildLastSlideFromMockup()` creates branded CTA visual on canvas

## 6.4 Caption Editor (`CaptionEditor`)

### Caption structure model

- canonical editable storage = structured blocks
- textarea view = flattened caption
- on blur: best-effort parse back to blocks

### Regeneration behavior

- `regenerateCaption()` can take optional instruction
- Keeps brand style constraints and output schema
- Maintains 5-step undo history for AI regenerations

### Hashtag domain logic

- hashtags are editable chip-by-chip
- save/delete/add operations sync back to parent post

## 6.5 Video Reels tab (`VideoReelsDraftTab`)

### Script planning phase

- Required: prompt
- Mode-specific requirements:
  - `FROM_REFERENCE_VIDEO`: requires source URL or uploaded local MP4
  - `FROM_IMAGES`: requires uploaded images
- Duration slider: `15..60` seconds target
- Scene provider selectable: `gemini` or `openai`
- Output persisted as `VideoReelDraft` with normalized scenes/metadata

### Render phase

- `generateReelVideo(payload)` handles scene videos + final assembly
- Draft status transitions:
  - `draft -> generating -> ready`
  - on failure: `error` + message
- User can retry from error by resetting status to `draft`

## 6.6 App Marketing Video tab (`AppMarketingVideoTab`)

### Plan generation requirements

Required fields:

- app name
- campaign goal
- real user stories/use cases
- at least one reference asset (screenshots or reference video)

Optional fields:

- CTA override
- target audience
- app URL
- source type override

### Planning domain rules

- Target duration slider: `20..45`
- Service normalizes to scene count `4..6`, each `6s`
- Output includes:
  - headline
  - voiceover script
  - caption + hashtags
  - visual analysis summary
  - scene plan with camera/transition/overlay/negative prompt

### Rendering behavior

- Uses `generateReelVideo()` with app-specific pipeline options:
  - strict assembly disabled for this flow
  - forces Gemini scene generation
  - voiceover merge required
  - optional normalization before concat
  - scene generation serial with delay for stability

## 6.7 Content Calendar tab (`ContentCalendarTab`)

### Weekly generation model

- Deterministic pools by day and format
- Week defined by `weekOffset` from current Monday
- Content set includes:
  - feed posts (reels/carousels/static by weekday pattern)
  - two story ideas per day

### Determinism and refresh

- `generateWeekContent(weekOffset, refreshSeed)`
- same week + same seed = same schedule
- refresh increments seed to reshuffle deterministically

### Persistence and integrations

- Stored as `meditate-calendar`
- Buttons route to:
  - Reel creation flow (prefilled prompt)
  - Carousel draft flow (prefilled topic)

## 7) AI generation contracts and fallback behavior

## 7.1 Gemini model fallback strategy

Most Gemini text generation in services uses candidate list fallback:

1. env override model
2. `gemini-3.1-pro-preview`
3. `gemini-2.5-pro`
4. `gemini-2.0-flash`

Only `model not found` errors trigger next candidate; other errors fail fast.

## 7.2 Carousel generation (`geminiService`)

- Draft generation enforces JSON schema
- Slide and prompt arrays are padded/truncated to requested count
- Last slide has mandatory marketing CTA semantics

## 7.3 Caption generation

- Structured schema output (title, hook, points, microInstruction, cta, hashtags)
- Hashtags normalized to exactly 18
- Brand fallback tags appended if model returns fewer

## 7.4 Reel content planning (`videoReelService`)

Normalized rules:

- target duration clamped to `15..60`
- scene count normalized to `3..5`
- each scene forced to exactly `8s`
- timeline continuity rebuilt from scratch
- brand hashtags enforced:
  - `#MeditateWithAbhi`
  - `#TheSchoolOfBreath`

Source-aware behavior:

- optional pre-analysis for images/video references via Gemini Flash
- in reference-video mode, scenes include normalized `sourceStart/sourceEnd`

## 7.5 App marketing planning (`appMarketingVideoService`)

Normalized rules:

- target duration clamped to `20..45`
- scene count normalized to `4..6`
- each scene fixed to `6s`
- hashtags capped to 14 and enforced with core app-growth tags
- real user stories are mandatory in UI and explicitly propagated to prompt

## 8) Video assembly pipeline (`falService`) domain logic

## 8.1 Default reel pipeline

1. Determine scene provider (`gemini` or `openai`)
2. Optional reference analysis
3. Scene source strategy:
   - Prefer reference clip split for `FROM_REFERENCE_VIDEO` with `LOCAL_MP4` or `DIRECT_URL` when enabled
   - Else generate scene videos per scene via provider
4. Concat via Fal `merge-videos`
5. Validate/normalize final video to spec

## 8.2 Final output compliance targets

- resolution: `1080x1920`
- fps: `30`
- format: `mp4`
- codec: H.264/AVC expected
- max duration: `<= 60s`

## 8.3 Strict mode branch (optional)

Enabled by env or pipeline options:

- transition-aware timeline:
  - trim
  - blend
  - concat
- optional ElevenLabs voiceover + ambient layering
- optional auto-subtitle pass
- post-normalization and metadata validation

## 8.4 Reliability patterns

- Gemini submit retry with exponential backoff for 429/503
- reference-source fallback from clip split to generated scenes
- optional per-scene normalization before concat
- detailed Fal validation error formatting for debug

## 9) Backend API contracts (`server/index.ts`)

All protected routes identify user by:

- `Authorization: Bearer <userId>` OR
- `?userId=` OR
- `DEV_USER_ID` fallback OR `dev-user`

Connections are in-memory map by `userId`.

## 9.1 Health

- `GET /health` -> `{ ok: true }`

## 9.2 Cloudinary upload

- `POST /uploads/cloudinary`
- Input:
  - `images: string[]` (public URLs or `data:image/*`)
  - optional `folder`
- Rules:
  - non-empty
  - max 10 per batch
  - sanitized folder pattern
- Output:
  - `{ ok: true, urls: string[] }`

## 9.3 Instagram auth/connect

- `POST /auth/instagram/manual-connect`
  - accepts `user_access_token`, optional `page_id`, `ig_user_id`
  - tries long-lived exchange; falls back to provided token if exchange fails
- `GET /auth/instagram/login`
  - starts OAuth with generated state
- `GET /auth/instagram/callback`
  - exchanges code, resolves page and IG business user, stores connection

## 9.4 Instagram content and analytics

- `GET /instagram/posts`
  - optional `limit`, `since`, `until`
- `POST /instagram/insights`
  - input `mediaIds: string[]`
  - fetches metrics:
    - impressions
    - reach
    - engagement
    - saved
    - video_views

## 9.5 Instagram publish endpoints

- `POST /instagram/publish/create`
  - single image container
- `POST /instagram/publish/confirm`
  - calls `media_publish` with `creationId`
- `POST /instagram/publish/draft`
  - one image -> single container
  - many images -> child carousel items + parent carousel container
  - returns note: container creation does not guarantee visible in-app draft

## 10) Persistence model (IndexedDB keys)

- `meditate-drafts` -> `Draft[]`
- `meditate-ready-posts` -> `ReadyPost[]`
- `meditate-reel-drafts` -> `VideoReelDraft[]`
- `meditate-app-marketing-videos` -> `AppMarketingVideoDraft[]`
- `meditate-calendar` -> `WeekCalendar`

## 11) Environment variable domains

### AI and generation

- `GEMINI_API_KEY`
- `GEMINI_MODEL_*`
- `GEMINI_IMAGE_MODEL`
- `GEMINI_VIDEO_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_VIDEO_MODEL`
- `OPENAI_VIDEO_ENDPOINT`

### Fal / voice / strict pipeline

- `VITE_FAL_KEY`
- `VITE_ELEVENLABS_API_KEY`
- `VITE_ELEVENLABS_VOICE_ID`
- `VITE_ELEVENLABS_MODEL_ID`
- `VITE_REELS_STRICT_SPEC_MODE`
- `VITE_REELS_STRICT_ENABLE_ELEVENLABS_AUDIO`
- `VITE_REELS_STRICT_ENABLE_AUTO_SUBTITLE`
- `VITE_REEL_AMBIENT_AUDIO_URL`
- `VITE_REELS_REFERENCE_CLIP_MODE`

### Instagram + backend + Cloudinary

- `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`
- `META_GRAPH_VERSION`, `META_SCOPE`
- `IG_SERVER_PORT`, `IG_CONNECTED_REDIRECT`
- `INSTAGRAM_USER_ACCESS_TOKEN`, `DEV_USER_ID`
- `VITE_IG_API_BASE_URL`, `VITE_DEV_USER_ID`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

## 12) Security and operational constraints

Current implementation is optimized for local/dev workflows:

- browser-exposed `VITE_*` credentials are insecure for production
- backend user connections/tokens are in-memory only
- CORS is open by default
- no auth hardening or multi-tenant data model
- no persistent audit/event log

For production hardening, move credentials to secure backend boundaries, add authN/authZ, persistent storage, token encryption/rotation, and strict CORS/origin controls.

## 13) Notable implementation nuances

- `ContentVisualsTab` view mode (`mockup`/`grid`) is global within tab, not per-post.
- Calendar includes caption-generation helper code, but current post cards expose direct actions for reel/carousel creation rather than caption modal entry.
- Reels pipeline can generate from scene prompts or directly split source clips depending on mode/config.
- Last carousel slide has dedicated app-mockup compositor path and is not only model-generated.

## 14) File-level responsibility map

- `src/App.tsx`: app shell, tab routing, persistence orchestration
- `src/components/DraftsTab.tsx`: carousel draft and post-building workflow
- `src/components/ContentVisualsTab.tsx`: post preview, export, and publish bridge
- `src/components/InstagramMobileMockup.tsx`: slide replacement and recap mockup flow
- `src/components/CaptionEditor.tsx`: structured caption + hashtag editing/regeneration
- `src/components/VideoReelsDraftTab.tsx`: reel plan creation and render lifecycle
- `src/components/AppMarketingVideoTab.tsx`: app campaign plan + render lifecycle
- `src/components/ContentCalendarTab.tsx`: deterministic weekly content planner
- `src/services/geminiService.ts`: carousel/caption generation and image utilities
- `src/services/videoReelService.ts`: reel script + scene planning
- `src/services/appMarketingVideoService.ts`: app promo plan generation
- `src/services/falService.ts`: video scene generation and assembly pipeline
- `src/services/instagramService.ts`: frontend bridge for backend API calls
- `server/index.ts`: auth/upload/publish/insights backend bridge

