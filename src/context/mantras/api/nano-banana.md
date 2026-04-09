# Nano Banana API Notes

- Client: `@google/genai`
- Text planning: `ai.models.generateContent({ model, contents, config })`
- Image generation: use Gemini image-capable model with `responseModalities: ['TEXT', 'IMAGE']`
- Expected image payload: inline image data in candidate parts
- API key resolution in this app:
  - primary: `process.env.GEMINI_API_KEY`
  - fallback: `import.meta.env.VITE_GEMINI_API_KEY`

## Prompt Discipline (v5 — Engine-Aligned)

All layout, text, and color rules now come from `/thumbnail-engine/config/core-rules.json`.
This file only documents API integration notes. Do NOT define visual rules here.

- Canvas: 1280x720, 16:9 (from core-rules.json)
- Layout: deity LEFT 40-45%, text RIGHT 55-60% (from core-rules.json)
- Text: 3-5 words, 2-line hierarchy (from core-rules.json)
- Deity aura: deity-specific color, NOT always gold (from deities.json)
- Hooks: approved pairs only (from hooks.json)
- Badges and school label: included per core-rules.json

## Validation Expectations

- Normalize export to `1280x720` PNG
- Check brightest signal is on LEFT half
- Check RIGHT half is dark/clean behind text
- Check 2-line text hierarchy: line 1 larger, line 2 colored
- Validation is brand QA heuristic, not semantic recognition
