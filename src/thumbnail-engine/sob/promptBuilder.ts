import { buildSobRenderSpec } from './renderSpec';
import type { SobRenderSpec } from './renderSpec';
import { SobPromptContext, SobPromptInput, SobVariant } from './types';

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
      '- Keep orange/red heat intensity high and clearly visible behind the subject/support zone.',
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

function buildSobRenderPrompt(spec: SobRenderSpec): string {
  const backgroundMatchRules = getBackgroundMatchRules(spec.backgroundTheme);

  const modeRules =
    spec.subjectType === 'abhi'
      ? [
          'MODE RULES:',
          '- WITH CHARACTER mode.',
          '- Use only attached Abhi reference images.',
          '- Do not invent another person.',
          '- Preserve exact Abhi face identity.',
          '- Preserve mature Indian male teacher appearance.',
          '- Keep Abhi in a seated or breath-teaching pose.',
          `- Required pose guidance: ${spec.characterPose || 'seated breath teacher pose'}.`,
          `- Place Abhi on the ${spec.subjectSide} 40-45% zone with natural body proportions.`,
          '- Not a fashion portrait, not a sticker cutout, not a generic guru.',
        ]
      : [
          'MODE RULES:',
          '- WITHOUT CHARACTER mode.',
          '- No human subject, no face, no silhouette, no body parts.',
          `- The ${spec.subjectSide} 40-45% zone is a SUPPORT VISUAL ZONE.`,
          '- Place exactly one strong support visual in that zone.',
          '- Integrate that support visual into the scene naturally.',
          '- Never leave the support visual zone as plain background-only space.',
          '- No text in the support visual zone.',
          '- No secondary icons beyond one support visual and one support badge.',
        ];

  return [
    `Create a 1280x720 YouTube thumbnail for The School of Breath.`,
    `Use this exact channel layout preset: ${spec.layoutPreset}.`,
    '',
    'LOCKED LAYOUT:',
    '- Full-bleed frame. No borders, no white frame, no mockup card.',
    `- ${spec.textSide} 55-60% = rigid stacked text rectangles.`,
    `- ${spec.subjectSide} 40-45% = subject zone.`,
    '- Top dark strip with white uppercase text.',
    '- Giant yellow hook block with very dark condensed uppercase text.',
    '- Red CTA block below.',
    '- One circular support badge near lower boundary of text stack and subject zone.',
    '- No floating text. No extra decorative text elements.',
    '',
    'TEXT SLOTS:',
    `- Top strip text: "${spec.topStripText}"`,
    `- Main hook text: "${spec.mainHookText}"`,
    `- CTA text: "${spec.ctaText}"`,
    '',
    'VISUAL SLOTS:',
    `- Support visual: ${spec.supportVisual}`,
    `- Visual badge type: ${spec.visualBadgeType}`,
    spec.arrowAllowed
      ? '- Arrow: allowed only if it increases support visual clarity.'
      : '- Arrow: not allowed.',
    '',
    'BACKGROUND RULES:',
    '- Background is mandatory and must fill the full frame.',
    '- No plain solid color and no generic empty gradient.',
    '- Keep background busy but controlled, dramatic depth, high contrast.',
    `- Background theme: ${spec.backgroundTheme}`,
    ...backgroundMatchRules,
    '',
    ...modeRules,
    '',
    'STYLE LOCK:',
    '- Aggressive YouTube thumbnail style.',
    '- Hard rectangular blocks.',
    '- Match School of Breath channel grammar, not minimalist design.',
    '- Keep one dominant promise, one support visual, one support badge.',
    spec.isChannelProvenHook
      ? '- Hook source: channel-proven phrase.'
      : '- Hook source: custom or non-proven phrase; keep strict style lock.',
    spec.specialNote ? `SPECIAL NOTE: ${spec.specialNote}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildSobBasePromptFromRenderSpec(spec: SobRenderSpec): string {
  return buildSobRenderPrompt(spec);
}

export function buildSobPromptVariantsFromRenderSpec(
  spec: SobRenderSpec,
  variantCount: number
): SobVariant[] {
  const basePrompt = buildSobBasePromptFromRenderSpec(spec);

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

export function buildSobBasePrompt(input: SobPromptInput, context: SobPromptContext): string {
  const normalizedHook = input.hook.trim().toUpperCase();
  const isTopicApprovedHook = (context.topic.hooks ?? []).some(
    (hook) => hook.trim().toUpperCase() === normalizedHook
  );
  const spec = buildSobRenderSpec(input, context, { isChannelProvenHook: isTopicApprovedHook });
  return buildSobBasePromptFromRenderSpec(spec);
}

export function buildSobPromptVariants(
  input: SobPromptInput,
  context: SobPromptContext,
  variantCount: number
): SobVariant[] {
  const normalizedHook = input.hook.trim().toUpperCase();
  const isTopicApprovedHook = (context.topic.hooks ?? []).some(
    (hook) => hook.trim().toUpperCase() === normalizedHook
  );
  const spec = buildSobRenderSpec(input, context, { isChannelProvenHook: isTopicApprovedHook });
  return buildSobPromptVariantsFromRenderSpec(spec, variantCount);
}
