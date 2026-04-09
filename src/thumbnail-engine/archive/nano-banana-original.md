# Nano Banana API Notes

- Client: `@google/genai`
- Text planning: `ai.models.generateContent({ model, contents, config })`
- Image generation: use Gemini image-capable model with `responseModalities: ['TEXT', 'IMAGE']`
- Expected image payload: inline image data in candidate parts
- API key resolution in this app:
  - primary: `process.env.GEMINI_API_KEY`
  - fallback: `import.meta.env.VITE_GEMINI_API_KEY`

## Prompt Discipline (v4)

- Generate a 1280x720 horizontal thumbnail with deity on LEFT 40-45% and text on RIGHT 55-60%.
- Deity: photorealistic cinematic devotional close-up (face + blessing hand). Ultra-realistic textures, 8K detail, Hollywood-grade lighting.
- Background: deep dark gradient (black to warm dark brown/amber), pure atmospheric void, no architecture, no scenery.
- Lighting: strong golden rim light from behind deity (#FFD700), smooth clean aura NOT noisy, high contrast.
- Atmosphere: subtle mist at base, golden particles ONLY around deity, soft bokeh minimal.
- Text: MAX 2-3 words ONLY, extremely large bold condensed, white or gold, strong dark drop shadow. One dominant phrase.
- Right side must feel EMPTY and intentional — no objects, no distractions behind text.
- Never add badges, logos, watermarks, or channel tags.
- Character fidelity: preserve canonical deity attributes, NO mixing iconography.
- Keep prompt self-contained so each variant can be generated independently.

## Validation Expectations

- Normalize export to `1280x720` PNG.
- Check that the frame stays dark overall.
- Check that the brightest signal (deity + aura) is on the LEFT half.
- Check that the RIGHT half is mostly clean/dark with text contrast.
- Treat validation as heuristic; it is brand QA, not semantic deity recognition.
