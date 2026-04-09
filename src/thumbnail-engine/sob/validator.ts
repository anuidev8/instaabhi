import { SobPromptContext, SobPromptInput, SobValidationResult } from './types';

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function validateSobInput(input: SobPromptInput, context: SobPromptContext): SobValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.title.trim()) {
    errors.push('Video title is required.');
  }

  const hookWords = words(input.hook);
  if (hookWords.length < 2 || hookWords.length > context.style.text.maxWords) {
    errors.push(`Hook must be between 2 and ${context.style.text.maxWords} words.`);
  }

  if (input.mode === 'without_character' && /\b(abhi|man|woman|person|face|portrait)\b/i.test(input.hook)) {
    warnings.push('Hook mentions a person while mode is without character.');
  }

  if (input.mode === 'without_character' && context.topic.characterSide !== 'left' && context.topic.characterSide !== 'right') {
    errors.push('Without-character mode requires a fixed empty character zone side.');
  }

  if (input.mode === 'with_character' && !context.style.characterRules.preserveIdentity) {
    errors.push('Character mode requires identity-preservation rules.');
  }

  if (!context.topic.topLine.trim()) {
    warnings.push('Topic top line is empty; readability may drop.');
  }

  if (!context.topic.cta.trim()) {
    warnings.push('Topic CTA strip is empty; style may not match channel thumbnails.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
