export type OpenAiThumbnailModel = 'gpt-image-2' | 'gpt-image-1.5' | 'gpt-image-1';

const OPENAI_API_KEY =
  (process.env.OPENAI_API_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim();

const OPENAI_IMAGE_MODEL = ((process.env.OPENAI_IMAGE_MODEL as string | undefined)?.trim() ||
  'gpt-image-2') as OpenAiThumbnailModel;
let modelAccessCheckPromise: Promise<void> | null = null;

export interface GenerateOpenAiThumbnailParams {
  prompt: string;
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
  referenceImages?: Blob[];
}

export function getOpenAiThumbnailModel(): string {
  return OPENAI_IMAGE_MODEL;
}

function buildAccessError(status: number, details: string): Error {
  if (status === 401) {
    return new Error('OpenAI API key is invalid. Check OPENAI_API_KEY.');
  }
  if (status === 403) {
    return new Error(
      'OpenAI access denied for image model. Verify organization/project permissions and required API organization verification.'
    );
  }
  if (status === 404) {
    return new Error(
      `OpenAI image model "${OPENAI_IMAGE_MODEL}" is not available for this account/project.`
    );
  }
  return new Error(`OpenAI model access check failed (${status}): ${details}`);
}

export async function ensureOpenAiImageAccess(): Promise<void> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Add OPENAI_API_KEY or VITE_OPENAI_API_KEY.');
  }
  if (modelAccessCheckPromise) return modelAccessCheckPromise;

  modelAccessCheckPromise = (async () => {
    const response = await fetch(`https://api.openai.com/v1/models/${OPENAI_IMAGE_MODEL}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    });

    if (!response.ok) {
      const details = await response.text();
      throw buildAccessError(response.status, details);
    }
  })().catch((error) => {
    modelAccessCheckPromise = null;
    throw error;
  });

  return modelAccessCheckPromise;
}

export async function generateThumbnailWithOpenAi(
  params: GenerateOpenAiThumbnailParams
): Promise<{ imageDataUrl: string; model: string }> {
  await ensureOpenAiImageAccess();

  const hasReferences = (params.referenceImages?.length ?? 0) > 0;
  const endpoint = hasReferences
    ? 'https://api.openai.com/v1/images/edits'
    : 'https://api.openai.com/v1/images/generations';

  const response = hasReferences
    ? await (async () => {
        const form = new FormData();
        form.append('model', OPENAI_IMAGE_MODEL);
        form.append('prompt', params.prompt.slice(0, 4000));
        form.append('size', params.size ?? '1536x1024');
        form.append('quality', params.quality ?? 'high');
        params.referenceImages?.forEach((blob, index) => {
          form.append('image[]', blob, `reference-${index + 1}.png`);
        });
        return fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: form,
        });
      })()
    : await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_IMAGE_MODEL,
          prompt: params.prompt.slice(0, 4000),
          size: params.size ?? '1536x1024',
          quality: params.quality ?? 'high',
        }),
      });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI thumbnail generation failed (${hasReferences ? 'edits with refs' : 'generations'}): ${details}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };
  const base64 = payload.data?.[0]?.b64_json;
  if (!base64) {
    throw new Error('OpenAI returned no image bytes (b64_json).');
  }

  return {
    imageDataUrl: `data:image/png;base64,${base64}`,
    model: OPENAI_IMAGE_MODEL,
  };
}
