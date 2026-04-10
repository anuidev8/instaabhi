import { buildSobRenderSpec } from './renderSpec';
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

  if (input.topStripOverride?.trim()) {
    const topStripWords = words(input.topStripOverride);
    if (topStripWords.length > 5) {
      errors.push('Top strip override must be 5 words or fewer.');
    }
  }

  if (input.ctaOverride?.trim()) {
    const ctaWords = words(input.ctaOverride);
    if (ctaWords.length > 4) {
      errors.push('CTA override must be 4 words or fewer.');
    }
  }

  if (input.mode === 'without_character' && /\b(abhi|man|woman|person|face|portrait)\b/i.test(input.hook)) {
    warnings.push('Hook mentions a person while mode is without character.');
  }

  if (input.mode === 'without_character' && context.topic.characterSide !== 'left' && context.topic.characterSide !== 'right') {
    errors.push('Without-character mode requires a fixed support-visual zone side.');
  }

  if (input.mode === 'without_character' && !context.topic.supportVisual.trim()) {
    errors.push('Without-character mode requires one explicit support visual.');
  }

  if (input.mode === 'without_character' && !context.style.noCharacterRules.singleSupportVisual) {
    errors.push('Without-character mode must enforce a single support visual.');
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

  // Derive render spec to validate layout-layer fields
  const spec = buildSobRenderSpec(input, context, { isChannelProvenHook: false });

  if (!spec.layoutStyle) {
    errors.push('Layout style is required.');
  }

  if (!spec.hookLineBreakMode) {
    errors.push('Hook line break mode could not be determined.');
  }

  if (spec.backgroundRole !== 'support_only') {
    errors.push('Background role must be support_only.');
  }

  if (!spec.titleDominance) {
    errors.push('Title dominance setting is required.');
  }

  if (!spec.ctaPlacement) {
    errors.push('CTA placement setting is required.');
  }

  if (!spec.supportIconPlacement) {
    errors.push('Support icon placement setting is required.');
  }

  // Warn if hook is too long for giant_hook_left
  if (spec.layoutStyle === 'giant_hook_left' && hookWords.length > 4) {
    warnings.push('Hook has more than 4 words. Giant Hook Left layout works best with ≤4 words.');
  }

  // Warn if custom hook is not channel-proven
  if (input.hook.trim() && !context.topic.hooks?.some(
    (h) => h.trim().toUpperCase() === input.hook.trim().toUpperCase()
  )) {
    warnings.push('Hook is not from the approved hook list. Verify it fits the channel style.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
