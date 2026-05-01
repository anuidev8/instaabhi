import { SobLayoutStyle, SobPromptContext, SobPromptInput, SobTopicKey } from './types';

export type SobRenderSpec = {
  layoutPreset: 'sob-channel-hard-stack' | 'sob-viral-typographic';
  styleSystem: 'classic' | 'viral_typographic';
  layoutStyle: SobLayoutStyle;
  mode: 'with_character' | 'without_character';
  topic: SobTopicKey;
  topStripText: string;
  mainHookText: string;
  hookLineBreakMode: 'single_line' | 'two_line_split';
  hookLine1?: string;
  hookLine2?: string;
  ctaText: string;
  titleDominance: 'max' | 'high';
  backgroundRole: 'support_only';
  ctaPlacement: 'bottom_left' | 'mid_right';
  supportIconPlacement: 'bridge' | 'lower_left';
  textSide: 'left' | 'right';
  subjectSide: 'left' | 'right';
  supportVisual: string;
  visualBadgeType: string;
  arrowAllowed: boolean;
  backgroundTheme: string;
  accentColor: string;
  subjectType: 'abhi' | 'support_visual';
  characterPose?: string;
  title: string;
  isChannelProvenHook: boolean;
  specialNote?: string;
};

export const VIRAL_TYPO_LAYOUTS: SobLayoutStyle[] = [
  'mega_word_micro_sub',
  'diagonal_slash_story',
  'vertical_text_tower',
  'number_badge_micro_hook',
  'photo_heavy_outline_text',
  'text_behind_subject',
  'dual_depth_dynamic_text',
  'color_word_stack',
  'subject_bleed_overlap',
];

export function isViralTypographicLayout(layoutStyle: SobLayoutStyle): boolean {
  return VIRAL_TYPO_LAYOUTS.includes(layoutStyle);
}

function normalizeOptionalText(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized.toUpperCase() : undefined;
}

/**
 * Default layout per topic — matches on-channel archetypes:
 * - centered_cosmic_hero: Reference A (cosmic, subject bottom-center, wide centered strips, CTA lower-right).
 * - giant_hook_left: Reference B (split column, text left, hook dominates, CTA bottom-left of stack).
 * - balanced_subject_right: classic left-text / right-subject grid without max hook dominance.
 */
export function deriveDefaultLayoutStyle(topic: SobTopicKey): SobLayoutStyle {
  const centeredCosmic: SobTopicKey[] = ['pranayama'];
  const splitLeftEnergetic: SobTopicKey[] = [
    'tummo',
    'energy',
    'nitric_oxide',
    'immunity',
    'beginner_breathing',
    'digestion',
  ];
  if (centeredCosmic.includes(topic)) return 'centered_cosmic_hero';
  if (splitLeftEnergetic.includes(topic)) return 'giant_hook_left';
  return 'balanced_subject_right';
}

export function deriveHookLineBreak(
  hook: string,
  options?: { layoutStyle?: SobLayoutStyle }
): {
  hookLineBreakMode: 'single_line' | 'two_line_split';
  hookLine1?: string;
  hookLine2?: string;
} {
  const words = hook.trim().split(/\s+/).filter(Boolean);

  // Centered cosmic: two-word hooks must stack (line / line) so type stays huge like single-word PRANAYAMA.
  if (options?.layoutStyle === 'centered_cosmic_hero' && words.length === 2) {
    return {
      hookLineBreakMode: 'two_line_split',
      hookLine1: words[0],
      hookLine2: words[1],
    };
  }

  if (words.length <= 2) return { hookLineBreakMode: 'single_line' };

  // Split at 'OF' if present mid-phrase (e.g. BREATH OF FIRE → BREATH / OF FIRE)
  const ofIndex = words.indexOf('OF');
  if (ofIndex > 0 && ofIndex < words.length - 1) {
    return {
      hookLineBreakMode: 'two_line_split',
      hookLine1: words.slice(0, ofIndex).join(' '),
      hookLine2: words.slice(ofIndex).join(' '),
    };
  }

  // For 3+ words: first word alone / rest
  return {
    hookLineBreakMode: 'two_line_split',
    hookLine1: words[0],
    hookLine2: words.slice(1).join(' '),
  };
}

export function deriveViralHookBreak(
  hook: string,
  layoutStyle: SobLayoutStyle
): {
  hookLineBreakMode: 'single_line' | 'two_line_split';
  hookLine1?: string;
  hookLine2?: string;
} {
  const normalized = hook.trim().toUpperCase();
  const words = normalized.split(/\s+/).filter(Boolean);

  if (layoutStyle === 'diagonal_slash_story' && normalized.includes('→')) {
    const [from, to] = normalized
      .split('→')
      .map((item) => item.trim())
      .filter(Boolean);
    return {
      hookLineBreakMode: 'two_line_split',
      hookLine1: from,
      hookLine2: to,
    };
  }

  if (layoutStyle === 'text_behind_subject' || layoutStyle === 'subject_bleed_overlap') {
    if (words.length <= 2) return { hookLineBreakMode: 'single_line' };
    return {
      hookLineBreakMode: 'two_line_split',
      hookLine1: words.slice(0, 2).join(' '),
      hookLine2: words.slice(2).join(' '),
    };
  }

  return { hookLineBreakMode: 'single_line' };
}

function deriveLayoutSides(layoutStyle: SobLayoutStyle): {
  textSide: 'left' | 'right';
  subjectSide: 'left' | 'right';
} {
  if (layoutStyle === 'balanced_subject_right') {
    return { textSide: 'right', subjectSide: 'left' };
  }

  return { textSide: 'left', subjectSide: 'right' };
}

export function buildSobRenderSpec(
  input: SobPromptInput,
  context: SobPromptContext,
  options?: { isChannelProvenHook?: boolean }
): SobRenderSpec {
  const topStripOverride = normalizeOptionalText(input.topStripOverride);
  const ctaOverride = normalizeOptionalText(input.ctaOverride);
  const mainHookText = input.hook.trim().toUpperCase();

  const layoutStyle = input.layoutStyle ?? deriveDefaultLayoutStyle(input.topic);
  const isViralTypo = isViralTypographicLayout(layoutStyle);
  const layoutPreset = isViralTypo ? 'sob-viral-typographic' : 'sob-channel-hard-stack';
  const styleSystem = isViralTypo ? 'viral_typographic' : 'classic';
  const hookBreak = isViralTypo
    ? deriveViralHookBreak(mainHookText, layoutStyle)
    : deriveHookLineBreak(mainHookText, { layoutStyle });

  const titleDominance: 'max' | 'high' =
    layoutStyle === 'giant_hook_left' || isViralTypo ? 'max' : 'high';

  const ctaPlacement: 'bottom_left' | 'mid_right' =
    layoutStyle === 'giant_hook_left' ? 'bottom_left' : 'mid_right';

  const supportIconPlacement: 'bridge' | 'lower_left' =
    layoutStyle === 'giant_hook_left' ? 'lower_left' : 'bridge';

  // Side placement must follow selected layout family (not topic defaults),
  // otherwise switching layout in the UI won't move the title/subject zones.
  const { textSide, subjectSide } = deriveLayoutSides(layoutStyle);

  return {
    layoutPreset,
    styleSystem,
    layoutStyle,
    mode: input.mode,
    topic: input.topic,
    topStripText: topStripOverride || context.topic.topLine,
    mainHookText,
    hookLineBreakMode: hookBreak.hookLineBreakMode,
    hookLine1: hookBreak.hookLine1,
    hookLine2: hookBreak.hookLine2,
    ctaText: ctaOverride || context.topic.cta,
    titleDominance,
    backgroundRole: 'support_only',
    ctaPlacement,
    supportIconPlacement,
    textSide,
    subjectSide,
    supportVisual: context.topic.supportVisual,
    visualBadgeType: context.topic.visualBadgeType,
    arrowAllowed: context.topic.arrowAllowed,
    backgroundTheme: context.topic.backgroundTheme,
    accentColor: context.topic.accent,
    subjectType: input.mode === 'with_character' ? 'abhi' : 'support_visual',
    characterPose: input.mode === 'with_character' ? context.topic.characterPose : undefined,
    title: input.title.trim(),
    isChannelProvenHook: Boolean(options?.isChannelProvenHook),
    specialNote: input.specialNote?.trim() || undefined,
  };
}
