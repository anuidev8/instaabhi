import { ThumbnailBrand, ThumbnailDraft, ThumbnailPrompt } from '../types';

export function getThumbnailBrandFromPrompt(prompt: ThumbnailPrompt): ThumbnailBrand {
  return prompt.brand === 'school_of_breath' ? 'school_of_breath' : 'school_of_mantras';
}

export function getThumbnailBrandFromDraft(draft: ThumbnailDraft): ThumbnailBrand {
  return getThumbnailBrandFromPrompt(draft.prompt);
}

export function withThumbnailBrand(
  draft: ThumbnailDraft,
  brand: ThumbnailBrand
): ThumbnailDraft {
  return {
    ...draft,
    prompt: {
      ...draft.prompt,
      brand,
    },
  };
}
