# Meditate with Abhi — Instagram Creator

A single-page web app for **“Meditate with Abhi” / School of Breath** that helps produce Instagram **carousel drafts**, **final post packages** (visuals + captions), and **AI-generated video reels**. Content generation is driven by **Google Gemini**; images can use **Gemini (Nano Banana)** or **OpenAI**; reels use **fal.ai** (video pipeline) and **ElevenLabs** (voice).

---

## What the app does (product flow)

1. **Drafts** — Pick a breathwork/meditation topic. Gemini generates a **narrative carousel** (default 6 slides, max 8): hook → technique → science → steps → recap/CTA, aligned with a fixed **brand visual system** (cosmic gold, sacred geometry, minimal on-slide text). You can **generate slide images with AI**, **upload your own**, then **build a ready post** (caption + hashtags + structured blocks).
2. **Content Visuals** — Review **ready posts** in a phone mockup, **edit captions** (block-based viral format), **crop/split** carousel images for export, optionally **send a draft container** to Instagram via the Meta Graph API (requires backend + Cloudinary for public URLs).
3. **Video Reels** — Gemini writes a **timed script + scenes**; **fal.ai** runs TTS, per-scene video, concat, and audio merge. Modes: **prompt only**, **reference video URL**, or **reference images** for character consistency.

---

## Tech stack

| Layer | Technology |
|--------|------------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, Motion, Lucide, idb-keyval |
| AI (text + carousel images) | `@google/genai` (Gemini), optional OpenAI for images |
| Reels video | `@fal-ai/client` (Minimax video, ffmpeg merge APIs) |
| Voice | ElevenLabs (via env / `BrandContext.voiceId`) |
| Persistence | **IndexedDB** (browser) — no server-side user DB |
| Instagram helper API | Express 5 on `server/index.ts` (OAuth/manual token, Graph calls, Cloudinary upload) |

---

## Repository layout

```
src/
  App.tsx                 # Tabs, global state, IndexedDB hydrate/save
  main.tsx, index.css
  types.ts                # Domain types (Draft, ReadyPost, reels, brand)
  components/
    DraftsTab.tsx         # Carousel draft lifecycle
    ContentVisualsTab.tsx # Mockup, caption editor, image tools, IG draft push
    CaptionEditor.tsx
    InstagramMobileMockup.tsx
    VideoReelsDraftTab.tsx
  services/
    geminiService.ts      # All Gemini prompts + JSON schemas + image APIs
    falService.ts         # Reel video pipeline (fal + TTS)
    instagramService.ts   # HTTP client → local Express IG server
server/
  index.ts                # Instagram + Cloudinary HTTP API
```

---

## Business logic (detailed)

### 1. Carousel drafts (`DraftsTab` + `generateDraft`)

- **Input**: Optional topic string, slide count `n` ∈ [1, 8] (UI default 6).
- **Model**: Gemini with fallback list (`GEMINI_MODEL_DRAFT` → `gemini-3.1-pro-preview` → `gemini-2.5-pro` → `gemini-2.0-flash`). Non–“not found” errors stop immediately; missing models are skipped.
- **System behavior** (“Carousel Catalyst”):
  - Enforces **School of Breath / @meditate_with_abhi** visual language: dark cosmic field, gold typography hierarchy, sacred geometry, **image-first** slides (short headline + optional one-line body; no paragraphs on slides).
  - Last slide is always the **marketing CTA** (app download framing).
- **Outputs**:
  - `topic`, `slides[]` with `role`, `headline`, `body`, optional `stepNumber` / `visualNotes`
  - `imagePrompt`: long copy-paste prompt for external tools
  - `slideImagePrompts`: `n` strings (≤450 chars) for **per-slide** API image generation
- **Normalization**: If Gemini returns fewer than `n` slides or prompts, the app **pads** with simple placeholders so downstream image steps always have `n` items.

### 2. Carousel images (`generateCarouselImagesWithProvider`)

- **Providers**: `google` (Gemini native image / “Nano Banana”) or `openai` (GPT Image — needs `OPENAI_API_KEY`).
- **Google**: Uses `process.env.GEMINI_IMAGE_MODEL` (Vite-injected), defaulting to `gemini-3.1-flash-image-preview` per code comments.
- **Draft state**: Successful generation sets `uploadedImages` to the image data URLs/URLs, `status: 'images_uploaded'`, and `imageModelUsed`. Users may instead **upload files** (read as base64 data URLs) with the same outcome.

### 3. Ready post / caption (`generatePostContent` + `CaptionEditor`)

- **Trigger**: “Build post” sends **topic + full slide text** to Gemini (`MODEL_CANDIDATES.post`).
- **Caption structure** (`CaptionBlocks`):
  - `hook` — 1–2 short lines
  - `points` — 3–5 benefit lines (no numerals in AI output; UI adds 1️⃣2️⃣… via `assembleCaptionFromBlocks`)
  - `microInstruction` — tiny “try this” line
  - `cta` — save + app / link in bio
- **Hashtags**: Target **exactly 18** tags (no `#` in stored array). Model output is trimmed or **padded** with brand fallbacks (`MeditateWithAbhi`, `SchoolOfBreath`, etc.).
- **Flat `caption`**: Assembled string for Instagram APIs / copy; blocks remain editable in the UI.
- **Additional helpers** in `geminiService`: `regenerateCaption`, `regenerateSingleSlideImage`, `generateSlidePromptSuggestion`, `buildLastSlideFromMockup` — for iterative refinement without redoing the whole draft.

### 4. Content visuals (`ContentVisualsTab`)

- **Preview**: Renders carousels in `InstagramMobileMockup`.
- **Image tooling**:
  - Multiple images → **square crop** per slide (canvas) with offset/scale.
  - Single “grid” image → **split into a rows×cols grid** of slides for download.
- **Instagram “draft container”**:
  - Images must be **public HTTPS URLs** for Meta. Local/base64 images go through **`POST /uploads/cloudinary`** on the Express server; returned URLs are sent to **`POST /instagram/publish/draft`**.
  - **Single image** → one media container; **multiple** → child items + `CAROUSEL` container with caption on the parent.
  - UI state: `instagramDraftStatus` (`idle` | `creating` | `created` | `error`) and Meta’s `creationId`. The app notes that **Graph API containers are not guaranteed to appear as in-app Instagram drafts** — that behavior is platform-dependent.

### 5. Video reels (`VideoReelsDraftTab` + `generateVideoReelScript` + `falService.generateReelVideo`)

- **Brand context**: Hard-coded defaults in `VideoReelsDraftTab.tsx` (`BRAND_CONTEXT`) — name, handle, niche, voice, pillars; `voiceId` from `VITE_ELEVENLABS_VOICE_ID` or a default ID.
- **Script step**: `generateVideoReelScript` uses reel model candidates (`GEMINI_MODEL_REELS` + fallbacks). Returns continuous **`script`** and **`scenes`** (2–4 segments) with `start`/`end`/`duration`, `narrative` (voiceover slice), and `visualPrompt`.
- **Modes**:
  - `PROMPT_ONLY` — character identity inferred from topic.
  - `FROM_REFERENCE_VIDEO` — style/pacing reference from URL (prompt text guides rewrite).
  - `FROM_IMAGES` — reference faces/visual identity from uploaded images (Gemini may analyze up to N images for consistency text fed into video prompts).
- **Video step**: `falService` builds **per-scene 9:16 prompts** (`buildSceneVideoPrompt`) including brand + consistency rules, then:
  1. ElevenLabs TTS → audio URL on fal storage  
  2. `fal-ai/minimax/video-01-live` per scene  
  3. Concat if >1 scene (`merge-videos`)  
  4. Merge audio + video (`merge-audio-video`)  
- **Credentials**: If `VITE_FAL_KEY` is set, fal runs **from the browser** (documented as dev-only/insecure). Otherwise fal client uses `proxyUrl: '/api/fal/proxy'` — you must provide a matching backend proxy in production (this repo’s Express server does **not** implement that proxy).

### 6. Local Instagram + Cloudinary server (`server/index.ts`)

- **In-memory** `Map` of user → `{ user_access_token, page_id, ig_user_id }` (resets on process restart).
- **User id**: `Authorization: Bearer …`, or `?userId=`, or `DEV_USER_ID` env, default `dev-user`.
- **Connection paths**:
  - Startup: `INSTAGRAM_USER_ACCESS_TOKEN` → resolve Page + Instagram Business user id, store connection.
  - `POST /auth/instagram/manual-connect` — paste token; optional long-lived exchange if app id/secret exist.
  - `GET /auth/instagram/login` + `GET /auth/instagram/callback` — full OAuth when `META_*` is configured.
- **Cloudinary**: `POST /uploads/cloudinary` accepts up to 10 strings — either `data:image/...` or existing `http(s)` URLs — returns `urls[]`.
- **Graph**:
  - `GET /instagram/posts` — list media
  - `POST /instagram/insights` — batch metrics (impressions, reach, engagement, saved, video_views)
  - `POST /instagram/publish/create` + `confirm` — single-image publish flow
  - `POST /instagram/publish/draft` — carousel/single container creation (used by the web app)

---

## Client-side persistence (IndexedDB via `idb-keyval`)

| Key | Content |
|-----|---------|
| `meditate-drafts` | `Draft[]` |
| `meditate-ready-posts` | `ReadyPost[]` |
| `meditate-reel-drafts` | `VideoReelDraft[]` |

Data loads on app mount; each collection saves when its React state changes (after initial load completes).

---

## Environment variables

Copy `.env.example` to `.env` and fill values. Important groups:

- **Gemini**: `GEMINI_API_KEY` (required for text + Google images). Optional: `GEMINI_MODEL_DRAFT`, `GEMINI_MODEL_REELS`, `GEMINI_MODEL_POST`, `GEMINI_IMAGE_MODEL`.
- **OpenAI** (optional): `OPENAI_API_KEY` if using OpenAI for carousel images.
- **Vite-injected** in `vite.config.ts`: `GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL`, `OPENAI_API_KEY` are exposed to the client as `process.env.*` for the bundle.
- **Reels / fal**: `VITE_FAL_KEY` (dev-only direct client), or implement `/api/fal/proxy`. ElevenLabs: `VITE_ELEVENLABS_*` or server-side equivalents as you harden the app.
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

The **business logic** centers on a **repeatable Instagram growth template** for a meditation/breathwork brand: Gemini structures **educational carousels** and **viral captions**, optional image providers illustrate slides in a **fixed luxury-spiritual art direction**, and a second pipeline produces **short-form reels** from scripted scenes + TTS + generative video. The Express side bridges **Cloudinary** and **Meta** so multi-image posts can be submitted as API containers. All creator state is **local-first** in the browser unless you extend the backend.
