# Meditate with Abhi - IG Creator

A React + Vite app that helps you create Instagram carousel posts for a meditation brand:

- generate a draft topic + 8 slide texts with Gemini
- generate a long image prompt for external image tools
- upload slide images
- generate title, caption, and hashtags with Gemini
- split/crop visuals and download all final slides

---

## What this app does

The app has two main tabs:

1. **Drafts**
   - Auto-generate carousel draft content (topic + 8 slides + image prompt).
   - Copy the image prompt into ChatGPT/Gemini/Midjourney to create images.
   - Upload generated images.
   - Build a final Instagram post (title, caption, hashtags).

2. **Content Visuals**
   - Preview ready-to-post content.
   - Adjust split/crop for uploaded visuals.
   - Copy caption and hashtags.
   - Download all slides as PNG files.

---

## Tech stack

- **Frontend**: React 19 + TypeScript
- **Build tool**: Vite
- **Styling**: Tailwind CSS v4
- **Animation**: Motion + Lucide icons
- **Local persistence**: IndexedDB via `idb-keyval`
- **AI provider**: Gemini (`@google/genai`)

---

## Project structure

```text
src/
  App.tsx                          # app shell, tabs, and persisted state
  main.tsx                         # React entry point
  index.css                        # Tailwind + custom scrollbar utility
  types.ts                         # Draft and ReadyPost interfaces
  services/
    geminiService.ts               # AI generation logic (draft + post copy)
  components/
    DraftsTab.tsx                  # draft generation/upload/build workflow
    ContentVisualsTab.tsx          # final visuals, crop/split, download
```

---

## Data model

### `Draft`

- `id`: unique draft id
- `topic`: carousel topic
- `slides`: array of slide text objects
- `imagePrompt`: long prompt to generate images externally
- `uploadedImages`: uploaded images as base64 data URLs
- `status`: `'draft' | 'images_uploaded'`

### `ReadyPost`

- `id`: carries over from draft
- `topic`, `slides`, `images`
- `title`: post title
- `caption`: full Instagram caption
- `hashtags`: hashtag list

---

## End-to-end logic flow

### 1) App boot and local data load

`App.tsx` loads state from IndexedDB on first render:

- key: `meditate-drafts`
- key: `meditate-ready-posts`

After loading, all updates to drafts/posts are saved automatically back to IndexedDB.

### 2) Draft generation (`DraftsTab` + `geminiService.generateDraft`)

- User opens topic modal and picks a suggested or custom topic.
- App calls Gemini with a strict JSON schema.
- Response is parsed and normalized to exactly 8 slides (truncate/pad).
- New draft is inserted at the top of the drafts list.

### 3) Image creation + upload

- User copies `imagePrompt`.
- User generates images in an external AI image tool.
- User uploads up to 8 images.
- Files are read using `FileReader` and stored as base64 data URLs in draft state.

### 4) Build final post (`geminiService.generatePostContent`)

- App sends draft topic + slide texts to Gemini.
- Gemini returns JSON: `title`, `caption`, and `hashtags`.
- Hashtags are normalized to exactly 18 entries (truncate/pad).
- Draft is removed, `ReadyPost` is created, and UI switches to **Content Visuals**.

### 5) Visual output adjustments (`ContentVisualsTab`)

The app computes downloadable slide images in two modes:

- **Single-image grid split mode** (`post.images.length === 1`)
  - splits one large image into a configurable rows x columns grid.
  - supports gap, padding, scale, global offset, and per-slide offset.
- **Multi-image crop mode** (`post.images.length > 1`)
  - square-crops each uploaded image with scale/offset controls.

Final images are generated on canvas and downloaded as PNG files.

---

## Environment variables

Use `.env` or `.env.local`:

```bash
GEMINI_API_KEY=your_key_here
APP_URL=http://localhost:3000
```

`APP_URL` is optional for local use in current logic.

---

## Run locally

### Prerequisites

- Node.js 18+ (recommended)
- npm

### Install and run

```bash
npm install
npm run dev
```

App runs at:

- `http://localhost:3000`

### Build and preview

```bash
npm run build
npm run preview
```

### Type-check

```bash
npm run lint
```

---

## Notes and limitations

- The app currently calls Gemini directly from the frontend. This is simple for prototyping but not ideal for production key security.
- Uploaded images are stored as base64 in IndexedDB; large image sets can consume browser storage quickly.
- Gemini responses are JSON-parsed. If a malformed response is returned, generation can fail and show an error alert.
- There is no user auth or backend database in the current implementation.

---

## Dependency notes

`express` is present in dependencies but not currently used by application code.

---

## Quick usage checklist

1. Open **Drafts**.
2. Click **Auto-Build Draft**.
3. Select a suggested/custom topic.
4. Copy image prompt and generate visuals externally.
5. Upload images for the draft.
6. Click **Build Instagram Post**.
7. Go to **Content Visuals** and adjust split/crop if needed.
8. Copy caption/hashtags and download all slides.
# instaabhi
