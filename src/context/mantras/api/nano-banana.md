# Nano Banana API Notes

- Client: `@google/genai`
- Text planning: `ai.models.generateContent({ model, contents, config })`
- Image generation: use Gemini image-capable model with `responseModalities: ['TEXT', 'IMAGE']`
- Expected image payload: inline image data in candidate parts
- API key resolution in this app:
  - primary: `process.env.GEMINI_API_KEY`
  - fallback: `import.meta.env.VITE_GEMINI_API_KEY`

## Prompt Discipline

- Ask Gemini for base image only.
- Explicitly say `no text`, `no watermark`, `16:9`, and `negative space on the left`.
- Keep prompt self-contained so each variant can be generated independently.

## Validation Expectations

- Normalize export to `1280x720` PNG.
- Check that the frame stays dark overall.
- Check that the brightest gold emphasis sits on the right half.
- Treat validation as heuristic; it is brand QA, not semantic deity recognition.
