import { SobPromptContext, SobPromptInput, SobVariant } from './types';

interface SobRenderSlots {
  brand: string;
  topic: string;
  mode: SobPromptInput['mode'];
  topLine: string;
  mainHook: string;
  cta: string;
  supportVisual: string;
  characterSide: 'left' | 'right';
  textSide: 'left' | 'right';
  backgroundTheme: string;
  accentColor: string;
  visualBadgeType: string;
  arrowAllowed: boolean;
  characterPose: string;
}

function getBackgroundMatchRules(backgroundTheme: string): string[] {
  const theme = backgroundTheme.toLowerCase();

  if (theme.includes('forest')) {
    return [
      '- Match a lush forest-river scene: mossy rocks, flowing water, mist depth, rich greens.',
      '- Keep dramatic contrast and cinematic atmosphere, not a flat wallpaper look.',
    ];
  }

  if (theme.includes('cosmic')) {
    return [
      '- Match a deep cosmic scene: blue/purple star field, nebula glow, layered depth.',
      '- Keep the space atmosphere dramatic and textured, not a simple gradient fill.',
    ];
  }

  if (theme.includes('fire')) {
    return [
      '- Match a volcanic fire scene: flame walls, lava heat, dark rock contrast.',
      '- Keep orange/red heat intensity high and clearly visible behind the subject/visual zone.',
    ];
  }

  if (theme.includes('warm_studio')) {
    return [
      '- Match a warm studio atmosphere: golden light, subtle haze, cinematic depth.',
      '- Keep it textured and dramatic, not plain white or flat beige.',
    ];
  }

  if (theme.includes('cool_blue_sleep_field')) {
    return [
      '- Match a cool blue sleep field: moon-tone blue atmosphere, calm light bloom, depth layers.',
      '- Keep it immersive and cinematic, not minimal or empty.',
    ];
  }

  return [
    '- Keep a textured, cinematic, high-contrast environment that matches proven School of Breath style.',
    '- Avoid plain or empty backdrops.',
  ];
}

function toSlots(input: SobPromptInput, context: SobPromptContext): SobRenderSlots {
  return {
    brand: context.style.brand,
    topic: context.topic.label,
    mode: input.mode,
    topLine: context.topic.topLine,
    mainHook: input.hook,
    cta: context.topic.cta,
    supportVisual: context.topic.supportVisual,
    characterSide: context.topic.characterSide,
    textSide: context.topic.textSide,
    backgroundTheme: context.topic.backgroundTheme,
    accentColor: context.topic.accent,
    visualBadgeType: context.topic.visualBadgeType,
    arrowAllowed: context.topic.arrowAllowed,
    characterPose: context.topic.characterPose,
  };
}

function buildSobRenderPrompt(slots: SobRenderSlots): string {
  const backgroundMatchRules = getBackgroundMatchRules(slots.backgroundTheme);
  const modeRules =
    slots.mode === 'with_character'
      ? [
          'MODE RULES:',
          '- WITH CHARACTER mode.',
          '- Use only attached Abhi reference images.',
          '- Do not invent another person.',
          '- Preserve exact Abhi face identity.',
          '- Preserve mature Indian male teacher appearance.',
          '- Keep Abhi in a seated or breath-teaching pose.',
          `- Required pose guidance: ${slots.characterPose}.`,
          `- Place Abhi on the ${slots.characterSide} 40-45% zone with natural body proportions.`,
          '- No fashion portrait look, no generic guru look, no ad-poster portrait style.',
        ]
      : [
          'MODE RULES:',
          '- WITHOUT CHARACTER mode.',
          '- No human subject, no face, no silhouette, no body parts.',
          `- The ${slots.characterSide} 40-45% zone is a SUPPORT VISUAL ZONE (not empty).`,
          '- Place exactly one strong support visual in that zone.',
          '- Integrate that support visual into the scene background naturally.',
          '- Never leave the support visual zone as plain background-only space.',
          '- No extra text in the support visual zone.',
          '- No secondary icons beyond the one support visual and one badge.',
        ];

  return [
    'Create a 1280x720 School of Breath YouTube thumbnail.',
    'This is an assembly instruction, not a creative brief.',
    '',
    'REQUIRED SLOTS:',
    `- brand: ${slots.brand}`,
    `- topic: ${slots.topic}`,
    `- mode: ${slots.mode}`,
    `- topLine: ${slots.topLine}`,
    `- mainHook: ${slots.mainHook}`,
    `- cta: ${slots.cta}`,
    `- supportVisual: ${slots.supportVisual}`,
    `- characterSide: ${slots.characterSide}`,
    `- textSide: ${slots.textSide}`,
    `- backgroundTheme: ${slots.backgroundTheme}`,
    `- accentColor: ${slots.accentColor}`,
    '',
    'LOCKED LAYOUT:',
    '- Full-bleed frame. No borders, no white frame, no mockup card.',
    `- Text stack occupies ${slots.textSide} 55-60% in rigid stacked rectangles.`,
    `- Character/support-visual zone occupies ${slots.characterSide} 40-45%.`,
    '- No floating text.',
    '- Top strip is full width across text zone, dark charcoal/black, white uppercase compact text.',
    '- Main block is huge yellow rectangle with ultra-bold condensed uppercase dark text.',
    '- CTA block is red rectangle directly below main block with white uppercase text.',
    '- One circular support badge only near lower boundary between text stack and right zone.',
    `- Support badge style: ${slots.visualBadgeType}.`,
    slots.arrowAllowed ? '- One directional arrow is allowed only if it improves support visual clarity.' : '- No arrows.',
    '',
    'TEXT RULES:',
    '- Use only three text elements: topLine, mainHook, cta.',
    '- Main hook is the largest text and dominates left stack.',
    '- Typography is ultra-bold condensed uppercase.',
    '- Mobile readability is mandatory.',
    '',
    'BACKGROUND RULES:',
    '- Background is mandatory and must fill the full frame.',
    '- No plain solid-color background and no generic empty gradient.',
    '- Keep background busy but controlled, dramatic depth, high contrast.',
    '- Match proven School of Breath channel atmosphere for this theme.',
    `- Background theme: ${slots.backgroundTheme}.`,
    ...backgroundMatchRules,
    '',
    ...modeRules,
    '',
    'ANTI-DRIFT RULES:',
    '- Do not output minimalist flat design.',
    '- Do not output soft pastel wellness style.',
    '- Do not add random extra words, subtitles, or paragraph text.',
    '- Keep one dominant promise, one support visual, one badge.',
    '- Final result must feel native to aggressive School of Breath channel thumbnails.',
  ].join('\n');
}

export function buildSobBasePrompt(input: SobPromptInput, context: SobPromptContext): string {
  const slots = toSlots(input, context);
  const basePrompt = buildSobRenderPrompt(slots);
  const specialNote = input.specialNote?.trim();

  return [basePrompt, specialNote ? `SPECIAL NOTE: ${specialNote}` : null].filter(Boolean).join('\n');
}

export function buildSobPromptVariants(
  input: SobPromptInput,
  context: SobPromptContext,
  variantCount: number
): SobVariant[] {
  const basePrompt = buildSobBasePrompt(input, context);

  const channelMatch: SobVariant = {
    id: 'A',
    label: 'Exact Channel Match',
    prompt: [
      basePrompt,
      'VARIANT A: Exact Channel Match.',
      '- Keep standard proven channel composition.',
      '- Keep hard text stack geometry exact.',
      '- Keep one clear support visual and one support badge.',
      '- Prioritize resemblance to proven School of Breath thumbnails.',
    ].join('\n'),
  };

  const hookPush: SobVariant = {
    id: 'B',
    label: 'Hook Push',
    prompt: [
      basePrompt,
      'VARIANT B: Hook Push.',
      '- Make main hook block slightly larger than Variant A.',
      '- Keep top strip slightly tighter.',
      '- Make CTA block more dominant and urgent.',
      '- Make support badge and support visual more obvious.',
      '- Push contrast harder while preserving legibility.',
    ].join('\n'),
  };

  return variantCount <= 1 ? [channelMatch] : [channelMatch, hookPush];
}
