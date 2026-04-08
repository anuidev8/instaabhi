# Meditate with Abhi — Instagram Creator

A single-page web app for **“Meditate with Abhi” / School of Breath** that helps produce Instagram **carousel drafts**, **final post packages** (visuals + captions), **AI-generated video reels**, **app marketing videos**, and a **weekly content calendar**. Content generation is driven by **Google Gemini**; carousel images can use **Gemini** or **OpenAI**; reels use Gemini analysis + provider-based scene generation (Gemini/OpenAI) with Fal for concat assembly.

---

## Full technical/business documentation

For a deep implementation-level reference (all features, business rules, domain logic, API contracts, and pipeline behavior), see:

- [`docs/FULL_FEATURE_BUSINESS_DOMAIN_DOCUMENTATION.md`](docs/FULL_FEATURE_BUSINESS_DOMAIN_DOCUMENTATION.md)

---

## What the app does (product flow)

1. **Drafts** — Pick a breathwork/meditation topic. Gemini generates a **narrative carousel** (default 6 slides, max 8): hook → technique → science → steps → recap/CTA, aligned with a fixed **brand visual system** (cosmic gold, sacred geometry, minimal on-slide text). You can **generate slide images with AI**, **upload your own**, then **build a ready post** (caption + hashtags + structured blocks).
2. **Content Visuals** — Review **ready posts** in a phone mockup, **edit captions** (block-based viral format), **crop/split** carousel images for export, optionally **send a draft container** to Instagram via the Meta Graph API (requires backend + Cloudinary for public URLs), or **confirm publish** when a creation id exists.
3. **Video Reels** — **`videoReelService`** uses Gemini + **`reelBrandContext`** to produce headline, full voiceover body, CTA, Instagram caption, YouTube Shorts description, hashtags, source analysis summary, and normalized **3-5 scenes (8s each)** with camera + transition cues. For local MP4, the file is uploaded to Fal storage first, then Gemini analyzes source context. In reference-video mode, the pipeline can split the source video directly (local MP4/direct video URL) using scene `sourceStart/sourceEnd` clip windows before final assembly. Otherwise scene videos are generated per-scene in parallel with user-selected provider (**Gemini latest** or **OpenAI latest**). **Fal is used for concat/final assembly only** with enforced `1080x1920` and `30fps` target output. Optional strict mode can add transition-aware timeline assembly plus optional audio/subtitle layering.
4. **App Marketing Video Generation** — Upload app screenshots and/or walkthrough videos. Gemini Vision analyzes references and generates a conversion-focused ~30s campaign plan (hook, voiceover, CTA, scene prompts). Rendering uses provider-based scenes plus Fal strict assembly with ElevenLabs voiceover/audio merge.
5. **Calendar** — A **weekly planner** with deterministic content pools (reels/carousels per weekday pattern). Persists to IndexedDB. Buttons can jump to **Drafts** or **Reels** with a pre-filled topic/prompt.

---

## Tech stack

| Layer | Technology |
|--------|------------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, Motion, Lucide, idb-keyval, JSZip |
| AI (carousel, captions, some image ops) | `@google/genai` in `geminiService.ts` |
| AI (reel script + scenes schema) | `@google/genai` in `videoReelService.ts` + `reelBrandContext.ts` |
| Carousel images | Gemini (`generateCarouselImages*`) or OpenAI (`OPENAI_API_KEY`) |
| Reels video | Gemini/OpenAI scene generation + `@fal-ai/client` concat (`fal-ai/ffmpeg-api/merge-videos`) |
| Voice | ElevenLabs voiceover support (used by App Marketing Video Generation and optional strict reels) |
| Persistence | **IndexedDB** (browser) — no server-side user DB |
| Instagram helper API | Express 5 on `server/index.ts` (OAuth/manual token, Graph calls, Cloudinary upload) |

---

## Repository layout

```
src/
  App.tsx                    # Root: tabs, global collections, IndexedDB hydrate/save, calendar → tab handoff
  main.tsx, index.css
  types.ts                   # SlideRole, Draft, ReadyPost, CaptionBlocks, VideoReel*, BrandContext, etc.
  components/
    DraftsTab.tsx            # Carousel lifecycle: topic modal, AI draft, images, build ready post
    ContentVisualsTab.tsx    # List of ready posts; SplitImagesDisplay; IG draft + publish; CaptionEditor + mockup
    CaptionEditor.tsx        # Block + flat caption editing, hashtag chips, AI regenerate
    InstagramMobileMockup.tsx# Phone preview, slide nav, per-slide regen, last-slide app mockup flow
    VideoReelsDraftTab.tsx   # Reel modal: script via videoReelService; video via falService
    AppMarketingVideoTab.tsx # App marketing video flow: Gemini Vision plan + Fal render
    ContentCalendarTab.tsx   # Weekly calendar UI + pools; saves meditate-calendar
  services/
    geminiService.ts         # Drafts, post captions, carousel images, slide helpers, assembleCaptionFromBlocks
    videoReelService.ts      # generateVideoReelContent (script, caption, scenes) — reel-specific Gemini
    appMarketingVideoService.ts # generateAppMarketingVideoPlan (Gemini Vision campaign planning)
    falService.ts            # buildSceneVideoPrompt, generateReelVideo
    instagramService.ts      # HTTP client → local Express (upload, draft container, confirm publish)
  utils/
    carouselSlideExport.ts   # 1080×1080 letterbox export helpers
    carouselZipDownload.ts   # ZIP download / mobile Web Share for PNGs
  lib/
    useWakeLock.ts           # Screen wake lock during long AI/video jobs
    reelBrandContext.ts      # REEL_BRAND_CONTEXT, buildReelBrandPrompt
server/
  index.ts                   # Instagram + Cloudinary HTTP API
```

---

## Application shell (`App.tsx`)

| Concern | Details |
|--------|---------|
| **Tabs** | `'drafts' \| 'visuals' \| 'reels' \| 'app-marketing' \| 'calendar'` — header nav with Motion `AnimatePresence` between panes. |
| **Shared state** | `drafts`, `readyPosts`, `reelDrafts`, `marketingDrafts` — each is a React array lifted here so any tab can be extended later; children receive setters. |
| **Load gate** | `isLoaded` starts false; until IndexedDB hydrate finishes, a full-screen spinner renders (avoids saving empty state over stored data). |
| **Cross-tab routing** | `pendingDraftTopic` / `pendingReelPrompt`: **Content Calendar** calls `onCreateCarouselDraft(title)` or `onGenerateVideoScript(title)`, which sets the pending value and switches tab; the target tab consumes it in `useEffect` (opens modal pre-filled). |
| **Persistence** | After `isLoaded`, any change to `drafts`, `readyPosts`, `reelDrafts`, or `marketingDrafts` writes to idb-keyval (see table below). |

---

## UI components (logic overview)

### `DraftsTab`

- **State**: generating flags (draft / images / build post), `imageProvider` (`google` \| `openai`), topic modal (`customTopic`, `slideCount` 1–8), `activeDraftId` for file upload target.
- **`useWakeLock`**: While draft or image generation runs.
- **Handlers**: `handleAutoBuildDraft` → `generateDraft` → normalizes slides so `text` is always set; `handleGenerateWithAI` → `generateCarouselImagesWithProvider`; `handleFileChange` → FileReader data URLs; `handleBuildPost` → `generatePostContent`, moves row from `drafts` to `readyPosts`, calls `onPostReady` (switch to Visuals).
- **Child UI**: Suggested topics, draft cards with copy prompt, AI/upload images, delete, build post.

### `ContentVisualsTab`

- **`SplitImagesDisplay`** (inner): If `post.images.length === 1`, treats image as a **grid** to slice (rows×cols, padding, gap, scale, per-cell offsets via canvas). If multiple images, **per-slide square letterbox** via `imageToSquareCarouselDataUrl`. **Download ZIP** → `downloadCarouselSlidesAsZip`.
- **IG flow**: `uploadImagesForInstagramDraft` (Cloudinary on server) → `sendDraftContainerToInstagram` → tracks `instagramDraftStatus` / `instagramDraftCreationId`. Optional **`confirmInstagramPublish(creationId)`** for live publish path.
- Embeds **`InstagramMobileMockup`** and **`CaptionEditor`** per post; updates `readyPosts` when captions/images change.

### `CaptionEditor`

- **Props**: `postId`, `topic`, `slidesText`, `captionBlocks`, `hashtags`, `onCaptionChange`, `onHashtagsChange`.
- **Flat text**: `assembleCaptionFromBlocks` for display; on blur, **`parseCaption`** (best-effort) maps flat text back into `CaptionBlocks` (emoji numbering / paragraph heuristic).
- **AI**: `regenerateCaption` with optional user instruction; optional undo history for blocks/hashtags.
- **`useWakeLock`**: During regeneration.

### `InstagramMobileMockup`

- Carousel index state, **replace/regenerate** modal per slide: `getSlidePromptForIndex`, `regenerateSingleSlideImage`, `generateSlidePromptSuggestion`, and for recap slides **`buildLastSlideFromMockup`** + **`APP_MOCKUP_PATHS`** (app screenshot compositing).
- Provider toggle wired to parent for OpenAI vs Google image regen.

### `VideoReelsDraftTab`

- **`BRAND_CONTEXT`**: Used by **fal** pipeline (voice id, brand strings in video prompts). Script text uses **`generateVideoReelContent`** internally (see `videoReelService` + `reelBrandContext`).
- **Modal**: `VideoReelInput` supports `PROMPT_ONLY`, `FROM_REFERENCE_VIDEO`, `FROM_IMAGES`, with source kind (`YOUTUBE`, `INSTAGRAM`, `LOCAL_MP4`, `DIRECT_URL`), URL/title, local MP4 upload, duration, and language.
- **Script step**: `generateVideoReelContent` → builds `VideoReelDraft` (`draft` status) including dual-platform metadata and normalized scene plan.
- **Video step**: `generateReelVideo` → `generating` → `ready` / `error`; draft cards can now trigger video generation directly.
- **`useWakeLock`**: Script and video generation.
- **Helper UI**: `StatusBadge`, `SceneCard` (scene breakdown for debugging/reference).

### `AppMarketingVideoTab`

- **Flow**: Upload app screenshots/walkthrough video → Gemini Vision campaign plan → final render with ElevenLabs voiceover + Fal merge.
- **Plan step**: `generateAppMarketingVideoPlan` returns headline, voiceover script, caption, hashtags, and normalized scenes (~30s).
- **Render step**: Calls `generateReelVideo` with strict per-job pipeline options (`forceStrictAssembly`, `forceVoiceoverAudio`, `forceAutoSubtitle`) so current reels defaults remain unchanged.
- **Persistence**: Saves `AppMarketingVideoDraft[]` in IndexedDB via root `App.tsx`.

### `ContentCalendarTab`

- **Local types**: `CalendarPost`, `CalendarStory`, `WeekCalendar` — posts have `format`, `pillar`, `title`, `hook`, `technique`, hashtag set, optional caption; stories have `StoryType`.
- **Content**: Large constant pools (e.g. `MONDAY_REELS`, `MONDAY_CAROUSELS`, …) drive deterministic weekly layout; user can refresh / copy / navigate weeks.
- **Persistence**: `meditate-calendar` in IndexedDB (`weekOffset`, `posts`, `stories`).
- **Handoff**: `onGenerateVideoScript` / `onCreateCarouselDraft` passed from `App`.

---

## Services & main functions

### `src/services/geminiService.ts`

| Export | Role |
|--------|------|
| `generateDraft(topic?, slideCount)` | Gemini JSON carousel: topic, slides, `imagePrompt`, `slideImagePrompts`; model fallback chain for drafts. |
| `generateCarouselImages(draft)` | Lower-level Google image batch (used internally / legacy path). |
| `generateCarouselImagesWithProvider(draft, provider)` | Public API: `google` or `openai`; returns `{ images, modelUsed }`. |
| `regenerateSingleSlideImage(...)` | One slide image from prompt + provider. |
| `getSlidePromptForIndex(post, index)` | Resolves slide prompt from `slideImagePrompts` / `imagePrompt`. |
| `generateSlidePromptSuggestion(...)` | Gemini suggestion appended in mockup “improve prompt” flow. |
| `APP_MOCKUP_PATHS` | URLs/paths for last-slide app mockup compositing. |
| `buildLastSlideFromMockup(mockupPath, headline, body)` | Composites CTA slide image via Gemini/image pipeline. |
| `generateVideoReelScript(...)` | **Exported but unused by current UI**; reel tab uses `videoReelService` instead. |
| `assembleCaptionFromBlocks(blocks)` | Builds flat caption string with 1️⃣2️⃣… numbering for points. |
| `generatePostContent(topic, slidesText)` | Ready post: `caption`, `captionBlocks`, `hashtags`, `title`. |
| `regenerateCaption(...)` | Rewrites caption blocks (+ hashtags) with optional instruction. |
| `ImageProvider` | Type: `'google' \| 'openai'`. |

### `src/services/videoReelService.ts`

| Export | Role |
|--------|------|
| `generateVideoReelContent(input: VideoReelInput)` | Gemini generation with brand + source-aware instructions. Normalizes output to 3–5 scenes (8s each), scene camera/transition cues, `instagramCaption`, `youtubeDescription`, hashtags, source analysis summary, and assembled `script` for TTS. |
| `VideoReelContent` | Type for the above return shape. |

### `src/services/appMarketingVideoService.ts`

| Export | Role |
|--------|------|
| `generateAppMarketingVideoPlan(input: AppMarketingVideoInput)` | Gemini Vision campaign planning from screenshots/walkthrough references. Returns headline, voiceover script, caption, hashtags, analysis summary, and normalized short-form scene plan. |
| `AppMarketingVideoPlan` | Type for the plan return shape. |

### `src/lib/reelBrandContext.ts`

| Export | Role |
|--------|------|
| `REEL_BRAND_CONTEXT` | Constant brand/niche/voice/pillars/hashtag clusters for reel copy. |
| `buildReelBrandPrompt(extra?)` | System-style preamble + “JSON only” rule for reel Gemini calls. |

### `src/services/falService.ts`

| Export | Role |
|--------|------|
| `buildSceneVideoPrompt(...)` | Scene prompt builder used by provider-based video generation. |
| `uploadLocalReferenceVideo(file)` | Uploads local MP4/video to Fal storage and returns a reusable URL for source-driven reel generation. |
| `generateReelVideo(payload: FalJobPayload)` | Generate each scene video in parallel via selected provider (`gemini` or `openai`), then concat with Fal (`1080x1920`, `30fps`) and validate output metadata constraints. Optional strict mode performs trim+blend transitions, optional ElevenLabs/ambient layering, and optional subtitle pass before final normalization. |
| `FalJobPayload`, `FalJobResult`, `FalPipelineOptions` | Types for inputs/outputs and per-job strict pipeline overrides. |

### `src/services/instagramService.ts`

| Export | Role |
|-------------|-------------|
| `uploadImagesForInstagramDraft(images, userId?)` | `POST /uploads/cloudinary` → public URLs. |
| `sendDraftContainerToInstagram(...)` | `POST /instagram/publish/draft` (carousel or single). |
| `confirmInstagramPublish(creationId)` | Confirm step after container creation for publish flow. |

### `src/utils/carouselSlideExport.ts`

| Export | Role |
|--------|------|
| `CAROUSEL_SLIDE_PX` | `1080` — Instagram 1:1 export size. |
| `imageToSquareCarouselDataUrl(img, options?)` | Letterboxed square PNG data URL with scale/offsets. |
| `bitmapToSquareCarouselDataUrl(source, bg?)` | Same for canvas/image bitmaps (grid cells). |

### `src/utils/carouselZipDownload.ts`

| Export | Role |
|--------|------|
| `downloadCarouselSlidesAsZip(images, topic)` | Desktop: ZIP of PNGs; mobile: Web Share of files when supported. |

### `src/lib/useWakeLock.ts`

| Export | Role |
|--------|------|
| `useWakeLock(active)` | Requests `navigator.wakeLock` while `active`; re-acquires on tab visible. |

---

## Domain types (`src/types.ts`) — quick reference

- **`SlideRole`**: Narrative role per slide (`hook`, `second_hook`, `science`, `step`, `testimonial`, `recap`).
- **`Slide`**: `text` (legacy/compat), optional `headline`, `body`, `role`, `stepNumber`, `visualNotes`, `saveWorthy`.
- **`Draft`**: Carousel work-in-progress; `status` `'draft' \| 'images_uploaded'`; `uploadedImages`, prompts.
- **`CaptionBlocks`**: `hook`, `points[]`, `microInstruction`, `cta`.
- **`ReadyPost`**: Final package + optional IG fields (`instagramDraft*`, `instagramPublish*`).
- **`VideoReelMode` / `VideoReelStatus` / `ReelScene` / `VideoReelInput` / `VideoReelDraft`**: Reel pipeline model.
- **`AppMarketingVideoInput` / `AppMarketingVideoDraft`**: App marketing video planning/render model.
- **`BrandContext`**: Name, handle, niche, voice, pillars, `voiceId` (ElevenLabs).

---

## Business logic (product-level)

### 1. Carousel drafts (`DraftsTab` + `generateDraft`)

- **Input**: Optional topic string, slide count `n` ∈ [1, 8] (UI default 6).
- **Model**: Gemini with fallback list (`GEMINI_MODEL_DRAFT` → `gemini-3.1-pro-preview` → …). Non–“not found” errors stop immediately; missing models are skipped.
- **System behavior** (“Carousel Catalyst”): School of Breath visual language; last slide is **marketing CTA**.
- **Outputs**: `topic`, `slides[]`, `imagePrompt`, `slideImagePrompts` (≤450 chars per slide where enforced).
- **Normalization**: Fewer slides/prompts from the model are **padded** in `generateDraft` so downstream steps always have `n` items.

### 2. Carousel images (`generateCarouselImagesWithProvider`)

- **Providers**: `google` (Gemini image) or `openai` (GPT Image — needs `OPENAI_API_KEY`).
- **Draft state**: Success sets `uploadedImages`, `status: 'images_uploaded'`, `imageModelUsed`. Manual upload is equivalent for status.

### 3. Ready post / caption (`generatePostContent` + `CaptionEditor`)

- **Trigger**: “Build post” sends topic + slide texts to Gemini (`MODEL_CANDIDATES.post`).
- **Caption structure**: Viral blocks → `assembleCaptionFromBlocks` for flat `caption`.
- **Hashtags**: Target **exactly 18** tags; trimmed/padded with brand fallbacks in service layer.

### 4. Content visuals (`ContentVisualsTab`)

- **Preview**: `InstagramMobileMockup`.
- **Export**: Square letterbox PNGs + ZIP; grid split for single uploaded composites.
- **Instagram**: Public URLs via Cloudinary; draft container vs confirm publish documented in UI comments.

### 5. Video reels (`VideoReelsDraftTab` + `generateVideoReelContent` + `falService.generateReelVideo`)

- **Script + metadata**: `videoReelService` applies brand + source-aware rules; returns headline/body/CTA, Instagram caption, YouTube description, hashtags, source-summary, and scene plan.
- **Scene normalization**: always 3–5 scenes, each 8 seconds, with camera movement + transition + overlay hints; reference-video scenes include source clip timestamp guidance.
- **Modes**: `PROMPT_ONLY`, `FROM_REFERENCE_VIDEO`, `FROM_IMAGES`; reference video mode accepts YouTube, Instagram, direct URL, and local MP4 (uploaded to Fal storage).
- **Video generation**: scene-by-scene generation via selected provider (`Gemini` or `OpenAI`), then Fal concat.
- **Credentials**: `VITE_FAL_KEY` in browser vs `/api/fal/proxy` — same caveats as before.

### 6. App marketing videos (`AppMarketingVideoTab` + `generateAppMarketingVideoPlan` + `falService.generateReelVideo`)

- **Inputs**: app name + campaign angle + screenshots/video reference.
- **Vision planning**: Gemini analyzes references and returns headline, voiceover script, caption, hashtags, summary, and scene breakdown.
- **Video generation**: scene generation with selected provider, then strict Fal assembly with per-job options forcing ElevenLabs voiceover + subtitle + merged output.

### 7. Local Instagram + Cloudinary server (`server/index.ts`)

- In-memory token map, OAuth/manual connect, Cloudinary upload, Graph list/insights/publish/draft endpoints — unchanged in behavior from prior README (see **Environment variables** below).

---

## Client-side persistence (IndexedDB via `idb-keyval`)

| Key | Content |
|-----|---------|
| `meditate-drafts` | `Draft[]` |
| `meditate-ready-posts` | `ReadyPost[]` |
| `meditate-reel-drafts` | `VideoReelDraft[]` |
| `meditate-app-marketing-videos` | `AppMarketingVideoDraft[]` |
| `meditate-calendar` | `WeekCalendar` (from **Content Calendar** tab only) |

`App.tsx` loads/saves the first four on mount and on change. `ContentCalendarTab` loads/saves `meditate-calendar` independently when its local calendar state updates.

---

## Environment variables

Copy `.env.example` to `.env` and fill values. Important groups:

- **Gemini**: `GEMINI_API_KEY` (required for text + Google images). Optional: `GEMINI_MODEL_DRAFT`, `GEMINI_MODEL_REELS`, `GEMINI_MODEL_POST`, `GEMINI_IMAGE_MODEL`, `GEMINI_VIDEO_MODEL`, `GEMINI_VIDEO_API_BASE`.
- **OpenAI** (optional): `OPENAI_API_KEY` (carousel image + scene video generation), optional `OPENAI_VIDEO_MODEL`, `OPENAI_VIDEO_ENDPOINT`.
- **ElevenLabs**: `VITE_ELEVENLABS_API_KEY` + `VITE_ELEVENLABS_VOICE_ID` for app marketing voiceover synthesis.
- **Vite-injected** in `vite.config.ts`: `GEMINI_API_KEY`, `GEMINI_MODEL_DRAFT`, `GEMINI_MODEL_REELS`, `GEMINI_MODEL_POST`, `GEMINI_IMAGE_MODEL`, `GEMINI_VIDEO_MODEL`, `GEMINI_VIDEO_API_BASE`, `OPENAI_API_KEY`, `OPENAI_VIDEO_MODEL`, `OPENAI_VIDEO_ENDPOINT` are exposed to the client as `process.env.*` for the bundle.
- **Optional strict reels mode (`import.meta.env`)**: `VITE_REELS_STRICT_SPEC_MODE`, `VITE_REELS_STRICT_ENABLE_ELEVENLABS_AUDIO`, `VITE_REELS_STRICT_ENABLE_AUTO_SUBTITLE`, `VITE_REEL_AMBIENT_AUDIO_URL`.
- **Frontend reference clip mode (`import.meta.env`)**: `VITE_REELS_REFERENCE_CLIP_MODE` (`true` by default) uses source clip timestamps to split local/direct reference videos directly.
- **Reels / fal**: `VITE_FAL_KEY` (dev-only direct client), or implement `/api/fal/proxy`. Fal is used for file storage + concat assembly in reels flow.
- **Instagram server**: `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_GRAPH_VERSION`, `META_SCOPE`, `IG_SERVER_PORT`, `IG_CONNECTED_REDIRECT`, `DEV_USER_ID`, `INSTAGRAM_USER_ACCESS_TOKEN` (optional pre-connect), `CLOUDINARY_*`.
- **Frontend → server**: `VITE_IG_API_BASE_URL`, `VITE_DEV_USER_ID`.

See `.env.example` for comments on each variable.

---

## Scripts

```bash
npm run dev      # Vite dev server (default port 3000, host 0.0.0.0)
npm run server   # Express Instagram helper (default 8787)
npm run all      # Both via concurrently
npm run build    # Production build to dist/
npm run preview  # Preview production build
npm run lint     # Typecheck (tsc --noEmit)
```

**Typical local setup**: run `npm run all` (or `dev` + `server`), configure Gemini + Cloudinary + Instagram token/OAuth so “Send to Instagram draft” can obtain public image URLs and a connected Graph user.

---

## Security & production notes

- **`VITE_*` secrets** (Fal, ElevenLabs) are visible in the browser bundle — treat as **development convenience** only.
- **Instagram user tokens** on the sample server live in **memory**; use proper auth, encryption, and a real user model for production.
- **CORS** is open on the Express app — restrict origins if you deploy it.
- **fal proxy**: If you omit `VITE_FAL_KEY`, ensure a **`/api/fal/proxy`** implementation exists on whatever host serves the SPA, or reels will fail at runtime.

---

## Summary

The **codebase** is organized as: **tabs in `App`**, **five feature components**, **four AI/publish service layers** (`geminiService`, `videoReelService`, `appMarketingVideoService`, `falService`), **Instagram HTTP glue**, and **pure utilities** for 1080×1080 export and ZIP/share. The **product narrative** is a repeatable Instagram growth template: structured carousels and captions, optional illustration providers, reel scripts with scenes + generative video, app-marketing short-form campaigns with voiceover merge, and a local-first calendar — with an Express bridge to Cloudinary and Meta for containers and publish.
