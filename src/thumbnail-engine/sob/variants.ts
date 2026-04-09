import { SobPromptContext, SobPromptInput } from './types';
import { buildSobPromptVariants } from './promptBuilder';

export const DEFAULT_SOB_VARIANT_COUNT = 1;

export function getSobVariantPrompts(
  input: SobPromptInput,
  context: SobPromptContext,
  variantCount: number = DEFAULT_SOB_VARIANT_COUNT
): string[] {
  return buildSobPromptVariants(input, context, Math.max(1, Math.min(2, variantCount))).map(
    (variant) => variant.prompt
  );
}
