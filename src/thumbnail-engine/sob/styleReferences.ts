import type { SobLayoutStyle } from './types';

export interface SobStyleReferenceEntry {
  layoutStyle: SobLayoutStyle;
  /** Asset path or URL — replace placeholder with a real channel thumbnail when available */
  imagePath: string;
  description: string;
  /** Tags describing what this reference proves — used for multimodal prompt context */
  matchTags: string[];
}

/**
 * Style reference thumbnails per layout family.
 *
 * When real reference images are available, replace `imagePath` values with the actual
 * asset paths or CDN URLs. These references can then be attached to the multimodal
 * generation call alongside the prompt text to anchor Gemini to the channel's exact
 * composition language (block proportions, CTA placement, title dominance, etc.).
 *
 * Prompt prefix to use when attaching references:
 *   "Follow the composition language of the attached School of Breath reference thumbnails.
 *    Match block proportions, CTA placement, title dominance, and support icon behavior.
 *    Do not copy text content — only composition language."
 */
const VIRAL_BOARD = '/assets/sob/references/viral-style-board.jpg';

export const SOB_STYLE_REFERENCES: SobStyleReferenceEntry[] = [
  {
    layoutStyle: 'giant_hook_left',
    imagePath: '/assets/sob/references/giant_hook_left_ref_01.jpg',
    description:
      'Giant yellow hook block dominates left zone. Narrow top strip. CTA anchored bottom-left. Fire background secondary.',
    matchTags: ['giant_hook', 'max_dominance', 'narrow_top_strip', 'bottom_left_cta', 'aggressive'],
  },
  {
    layoutStyle: 'giant_hook_left',
    imagePath: '/assets/sob/references/giant_hook_left_ref_02.jpg',
    description:
      'Hook split across two lines. Subject on right. Background suppressed behind text zone.',
    matchTags: ['giant_hook', 'two_line_split', 'fire', 'energy'],
  },
  {
    layoutStyle: 'balanced_subject_right',
    imagePath: '/assets/sob/references/balanced_subject_right_ref_01.jpg',
    description:
      'Hook and subject share equal visual weight. Classic School of Breath grid. Support badge bridges zones.',
    matchTags: ['balanced', 'subject_right', 'standard_top_strip', 'classic_sob'],
  },
  {
    layoutStyle: 'balanced_subject_right',
    imagePath: '/assets/sob/references/balanced_subject_right_ref_02.jpg',
    description:
      'Healing/daily topic. Softer energy but still hard blocks. CTA mid-right placement.',
    matchTags: ['balanced', 'healing', 'mid_right_cta', 'daily'],
  },
  {
    layoutStyle: 'centered_cosmic_hero',
    imagePath: '/assets/sob/references/centered_cosmic_hero_ref_01.jpg',
    description:
      'Centered cosmic poster: wide centered yellow hook, subject bottom-center, red CTA lower-right of stack, sprout inset + optional chakra corners.',
    matchTags: ['centered', 'cosmic', 'pranayama', 'channel_reference_a'],
  },
  {
    layoutStyle: 'mega_word_micro_sub',
    imagePath: VIRAL_BOARD,
    description: 'Use panel 1 only: Mega Word. Ignore other panels.',
    matchTags: ['viral_board', 'panel_1', 'mega_word'],
  },
  {
    layoutStyle: 'diagonal_slash_story',
    imagePath: VIRAL_BOARD,
    description: 'Use panel 2 only: Diagonal Slash. Ignore other panels.',
    matchTags: ['viral_board', 'panel_2', 'diagonal_slash'],
  },
  {
    layoutStyle: 'vertical_text_tower',
    imagePath: VIRAL_BOARD,
    description: 'Use panel 3 only: Text Tower. Ignore other panels.',
    matchTags: ['viral_board', 'panel_3', 'text_tower'],
  },
  {
    layoutStyle: 'number_badge_micro_hook',
    imagePath: VIRAL_BOARD,
    description: 'Use panel 4 only: Number Badge. Ignore other panels.',
    matchTags: ['viral_board', 'panel_4', 'number_badge'],
  },
  {
    layoutStyle: 'photo_heavy_outline_text',
    imagePath: VIRAL_BOARD,
    description: 'Use panel 5 only: Photo + Outline. Ignore other panels.',
    matchTags: ['viral_board', 'panel_5', 'photo_outline'],
  },
  {
    layoutStyle: 'text_behind_subject',
    imagePath: VIRAL_BOARD,
    description: 'Use panel 6 only: Text Behind Subject. Ignore other panels.',
    matchTags: ['viral_board', 'panel_6', 'text_behind_subject'],
  },
  {
    layoutStyle: 'dual_depth_dynamic_text',
    imagePath: VIRAL_BOARD,
    description: 'Use panel 7 only: Dual Depth Dynamic. Ignore other panels.',
    matchTags: ['viral_board', 'panel_7', 'dual_depth'],
  },
  {
    layoutStyle: 'color_word_stack',
    imagePath: VIRAL_BOARD,
    description: 'Use panel 8 only: Color Word Stack. Ignore other panels.',
    matchTags: ['viral_board', 'panel_8', 'color_word_stack'],
  },
  {
    layoutStyle: 'subject_bleed_overlap',
    imagePath: VIRAL_BOARD,
    description: 'Use panel 9 only: Subject Bleed Overlap. Ignore other panels.',
    matchTags: ['viral_board', 'panel_9', 'subject_bleed'],
  },
];

/** Returns all reference entries for a given layout style */
export function getSobStyleReferences(layoutStyle: SobLayoutStyle): SobStyleReferenceEntry[] {
  return SOB_STYLE_REFERENCES.filter((r) => r.layoutStyle === layoutStyle);
}

/** Returns image paths for a layout style — ready for multimodal attachment */
export function getSobReferenceImagePaths(layoutStyle: SobLayoutStyle): string[] {
  return getSobStyleReferences(layoutStyle).map((r) => r.imagePath);
}
