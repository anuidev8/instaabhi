import abhiReferenceIndex from '../character/abhi-reference-index.json';
import colorSystemData from '../data/color-system.json';
import layoutsData from '../data/layouts.json';
import variantEmotionalTemplate from '../prompts/variant-emotional.txt?raw';
import variantIntenseTemplate from '../prompts/variant-intense.txt?raw';
import withCharacterTemplate from '../prompts/with-character.txt?raw';
import withoutCharacterTemplate from '../prompts/without-character.txt?raw';
import { ValidatedSchoolOfBreathInput } from './validator';

export type SchoolOfBreathVariantTone = 'clean' | 'dynamic';

const colorSystem = colorSystemData as Record<
  string,
  { label: string; primary: string; secondary: string; accent: string; usage: string }
>;

const layouts = layoutsData as {
  with_character: {
    default: string;
    presets: Record<string, string>;
  };
  without_character: {
    default: string;
    presets: Record<string, string>;
  };
};

interface BuildPromptOptions {
  input: ValidatedSchoolOfBreathInput;
  variantTone: SchoolOfBreathVariantTone;
}

function fillTemplate(template: string, tokens: Record<string, string>): string {
  return template.replace(/\[([A-Z_]+)\]/g, (_match, key) => tokens[key] ?? '');
}

function buildColorDirection(colorKey: string): string {
  const palette = colorSystem[colorKey];
  if (!palette) {
    return 'high contrast with black, white, and yellow accents';
  }

  return `${palette.label}: primary ${palette.primary}, secondary ${palette.secondary}, accent ${palette.accent}. Usage: ${palette.usage}.`;
}

function buildLayout(mode: ValidatedSchoolOfBreathInput['mode']): string {
  const config = mode === 'with_character' ? layouts.with_character : layouts.without_character;
  return config.presets[config.default] || config.default;
}

function buildReferenceInstruction(mode: ValidatedSchoolOfBreathInput['mode']): string {
  if (mode !== 'with_character') return 'Do not include any person.';

  const refs = Object.entries(abhiReferenceIndex)
    .map(([id, meta]) => `${id} (${(meta as { sourcePath?: string }).sourcePath || 'source unknown'})`)
    .join(', ');

  return `Use only approved Abhi references: ${refs}.`;
}

export function buildSchoolOfBreathPrompt({ input, variantTone }: BuildPromptOptions): string {
  const template = input.mode === 'with_character' ? withCharacterTemplate : withoutCharacterTemplate;
  const toneTemplate = variantTone === 'dynamic' ? variantIntenseTemplate : variantEmotionalTemplate;

  const promptBody = fillTemplate(template, {
    TOPIC: input.category,
    MAIN_HOOK: input.mainHook,
    TOP_LINE: input.topLine,
    BOTTOM_STRIP: input.bottomStrip,
    SUPPORT_VISUAL: input.supportVisual,
    BACKGROUND_STYLE: input.backgroundStyle,
    SPECIAL_NOTE: input.specialNote || 'none',
    LAYOUT: buildLayout(input.mode),
    COLOR_DIRECTION: buildColorDirection(input.colorEmphasis),
  });

  const output = [
    promptBody,
    toneTemplate,
    buildReferenceInstruction(input.mode),
    'Critical render checks:',
    '- Keep exactly one dominant hook message.',
    '- Main hook must stay readable at tiny mobile size.',
    '- Keep composition clean and uncluttered.',
    '- Do not produce mystical/deity visual language.',
    '- Render only intended thumbnail text elements; no extra random text.',
  ].join('\n');

  return output.replace(/\n{3,}/g, '\n\n').trim();
}

export function buildSchoolOfBreathVariantPrompts(
  input: ValidatedSchoolOfBreathInput
): string[] {
  return [
    buildSchoolOfBreathPrompt({ input, variantTone: 'clean' }),
  ];
}
