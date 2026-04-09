import { SobPromptContext, SobPromptInput, SobVariant } from './types';

export function buildSobBasePrompt(input: SobPromptInput, context: SobPromptContext): string {
  const cinematicCharacterBlock =
    input.mode === 'with_character'
      ? [
          `Character must occupy the ${context.topic.characterSide} side only, around 35-45% width.`,
          'Character rendering must be realistic and cinematic, fully integrated with the background (not sticker/cutout).',
          'Use only approved Abhi references; preserve face identity, hairline, skin tone, and recognizable teacher presence.',
          'Framing: seated or medium-close hero framing with natural body proportions and clear silhouette.',
          'Lighting: strong key light + rim light + atmospheric depth; high local contrast on face and torso.',
          'No pasted-face look, no rough cutout edges, no cloned faces, no mismatched neck/skin tones.',
          `Character styling and pose should fit this tone: ${context.topic.cinematicTone}.`,
        ]
      : [
          `The ${context.topic.characterSide} side must stay EMPTY as reserved character zone (background only).`,
          'Do NOT place any person, face, silhouette, body part, or character illustration in frame.',
          `Keep cinematic background mood only: ${context.topic.cinematicTone}.`,
        ];

  const modeBlock =
    input.mode === 'with_character'
      ? [
          'Mode: WITH CHARACTER.',
          `Split layout: ${context.style.layout.withCharacter}.`,
          `Text blocks must be on the ${context.topic.textSide} side only.`,
        ]
      : [
          'Mode: WITHOUT CHARACTER.',
          `Split layout: ${context.style.layout.withoutCharacter}.`,
          `Text blocks must be on the ${context.topic.textSide} side only.`,
          `The ${context.topic.characterSide} 40-45% zone must stay EMPTY (no text, no icons).`,
        ];

  const architectureRules = [
    'Use full-bleed 1280x720 frame (no white margins, no app card frame, no mockup border).',
    'Visual architecture is mandatory and should match classic high-CTR School of Breath style:',
    `1) TOP BAR: ${context.style.template.topBar}.`,
    `2) MAIN BLOCK: ${context.style.template.mainBlock}.`,
    `3) BOTTOM BAR: ${context.style.template.bottomBar}.`,
    `4) ICON: ${context.style.template.icon}.`,
    'Top bar should be near top edge and visually connected to the main yellow hook block.',
    'Main yellow hook block should be dominant and consume roughly 45-60% of full canvas area.',
    'Bottom red CTA strip should be clearly visible and separated from yellow block by hard edges.',
    'Circular icon should be small and secondary; never larger than hook text height.',
  ];

  const textRules = [
    `Top context text (small): "${context.topic.topLine}".`,
    `Main hook text (largest): "${input.hook}".`,
    `Bottom CTA strip text: "${context.topic.cta}".`,
    'Typography must be ultra-bold condensed uppercase (Impact/Anton style feel).',
    'Main hook must be readable at mobile size and dominate all other text.',
    'Never use thin fonts, script fonts, serif fonts, or decorative calligraphy.',
  ];

  const antiDriftRules = [
    'Do not output minimalist/editorial poster style.',
    'Do not output soft pastel wellness aesthetic.',
    'Do not output fantasy religious art, temple scenes, deity halos, or devotional imagery.',
    'Do not add extra random words, subtitles, or paragraph text.',
    'No clutter: one dominant promise, one support visual, one character zone.',
  ];

  return [
    `Create a YouTube thumbnail for ${context.style.brand}, 1280x720, 16:9.`,
    ...modeBlock,
    'Target style: EXACTLY match aggressive high-CTR School of Breath thumbnails.',
    ...architectureRules,
    ...textRules,
    `Support visual: ${context.topic.supportVisual}.`,
    `Background scene direction: ${context.topic.backgroundScene}.`,
    'Background should feel cinematic and textured, with dramatic depth and saturated contrast.',
    'Keep subject/background separation strong so text stays legible.',
    ...cinematicCharacterBlock,
    `Color system: Yellow (#FFD400) + Black + White, with accent ${context.topic.accent}.`,
    ...antiDriftRules,
    input.specialNote?.trim() ? `Special note: ${input.specialNote.trim()}.` : null,
    'Final check: thumbnail must look like a real YouTube CTR thumbnail, not a clean design mockup.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildSobPromptVariants(
  input: SobPromptInput,
  context: SobPromptContext,
  variantCount: number
): SobVariant[] {
  const basePrompt = buildSobBasePrompt(input, context);

  const balanced: SobVariant = {
    id: 'A',
    label: 'Balanced',
    prompt: [
      basePrompt,
      'Variant profile: reference-match and mobile-legible.',
      'Prioritize exact block geometry, high contrast, and aggressive readability at small size.',
    ].join('\n'),
  };

  const aggressive: SobVariant = {
    id: 'B',
    label: 'Aggressive',
    prompt: [
      basePrompt,
      'Variant profile: stronger contrast, bigger hook, higher urgency.',
      'Still keep readability and avoid clutter.',
    ].join('\n'),
  };

  return variantCount <= 1 ? [balanced] : [balanced, aggressive];
}
