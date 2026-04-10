import { SobPromptContext, SobPromptInput } from './types';
import { buildSobPromptVariants } from './promptBuilder';

/** Single prompt: Channel Match (A) only — no Hook Push B variant. */
export const DEFAULT_SOB_VARIANT_COUNT = 1;

export function getSobVariantPrompts(
  input: SobPromptInput,
  context: SobPromptContext,
  _variantCount: number = DEFAULT_SOB_VARIANT_COUNT
): string[] {
  return buildSobPromptVariants(input, context, 1).map((variant) => variant.prompt);
}
