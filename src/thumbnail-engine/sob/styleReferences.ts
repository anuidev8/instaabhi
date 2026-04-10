export type SobLayoutFamily = 'giant_hook_left' | 'balanced_subject_right' | 'centered_cosmic_hero';

export interface SobStyleReferenceEntry {
  layoutFamily: SobLayoutFamily;
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
export const SOB_STYLE_REFERENCES: SobStyleReferenceEntry[] = [
  {
    layoutFamily: 'giant_hook_left',
    imagePath: '/assets/sob/references/giant_hook_left_ref_01.jpg',
    description:
      'Giant yellow hook block dominates left zone. Narrow top strip. CTA anchored bottom-left. Fire background secondary.',
    matchTags: ['giant_hook', 'max_dominance', 'narrow_top_strip', 'bottom_left_cta', 'aggressive'],
  },
  {
    layoutFamily: 'giant_hook_left',
    imagePath: '/assets/sob/references/giant_hook_left_ref_02.jpg',
    description:
      'Hook split across two lines. Subject on right. Background suppressed behind text zone.',
    matchTags: ['giant_hook', 'two_line_split', 'fire', 'energy'],
  },
  {
    layoutFamily: 'balanced_subject_right',
    imagePath: '/assets/sob/references/balanced_subject_right_ref_01.jpg',
    description:
      'Hook and subject share equal visual weight. Classic School of Breath grid. Support badge bridges zones.',
    matchTags: ['balanced', 'subject_right', 'standard_top_strip', 'classic_sob'],
  },
  {
    layoutFamily: 'balanced_subject_right',
    imagePath: '/assets/sob/references/balanced_subject_right_ref_02.jpg',
    description:
      'Healing/daily topic. Softer energy but still hard blocks. CTA mid-right placement.',
    matchTags: ['balanced', 'healing', 'mid_right_cta', 'daily'],
  },
  {
    layoutFamily: 'centered_cosmic_hero',
    imagePath: '/assets/sob/references/centered_cosmic_hero_ref_01.jpg',
    description:
      'Centered cosmic poster: wide centered yellow hook, subject bottom-center, red CTA lower-right of stack, sprout inset + optional chakra corners.',
    matchTags: ['centered', 'cosmic', 'pranayama', 'channel_reference_a'],
  },
];

/** Returns all reference entries for a given layout family */
export function getSobStyleReferences(layoutFamily: SobLayoutFamily): SobStyleReferenceEntry[] {
  return SOB_STYLE_REFERENCES.filter((r) => r.layoutFamily === layoutFamily);
}

/** Returns image paths for a layout family — ready for multimodal attachment */
export function getSobReferenceImagePaths(layoutFamily: SobLayoutFamily): string[] {
  return getSobStyleReferences(layoutFamily).map((r) => r.imagePath);
}
