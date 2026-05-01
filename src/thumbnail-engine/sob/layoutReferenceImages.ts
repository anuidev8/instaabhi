import type { SobLayoutStyle } from './types';

/**
 * Bundled composition reference for Centered Cosmic Hero (Vite resolves at build time).
 * Canonical file: `docs/resources/images/sob-centered-cosmic-hero.png`
 */
const centeredCosmicModules = import.meta.glob<string>('../../../docs/resources/images/sob-centered-cosmic-hero.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const viralBoardModules = import.meta.glob<string>('../../../images-reference/viralThumbnails/image_virals.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

/** Resolved asset URL for the centered cosmic layout reference, or undefined if file is absent. */
export function getCenteredCosmicCompositionReferenceUrl(): string | undefined {
  const url = Object.values(centeredCosmicModules)[0];
  return typeof url === 'string' ? url : undefined;
}

export function getViralExternalReferenceUrls(): string[] {
  return Object.values(viralBoardModules).filter((url): url is string => typeof url === 'string');
}

export function getViralReferenceInstruction(style: SobLayoutStyle): string {
  const map: Partial<Record<SobLayoutStyle, string>> = {
    mega_word_micro_sub:
      'Use panel 1 only: MEGA WORD. Ignore the other 8 panels.',
    diagonal_slash_story:
      'Use panel 2 only: DIAGONAL SLASH. Ignore the other 8 panels.',
    vertical_text_tower:
      'Use panel 3 only: TEXT TOWER. Ignore the other 8 panels.',
    number_badge_micro_hook:
      'Use panel 4 only: NUMBER BADGE. Ignore the other 8 panels.',
    photo_heavy_outline_text:
      'Use panel 5 only: PHOTO + OUTLINE. Ignore the other 8 panels.',
    text_behind_subject:
      'Use panel 6 only: TEXT BEHIND SUBJECT. Ignore the other 8 panels.',
    dual_depth_dynamic_text:
      'Use panel 7 only: DUAL DEPTH DYNAMIC. Ignore the other 8 panels.',
    color_word_stack:
      'Use panel 8 only: COLOR WORD STACK. Ignore the other 8 panels.',
    subject_bleed_overlap:
      'Use panel 9 only: SUBJECT BLEED OVERLAP. Ignore the other 8 panels.',
  };

  return map[style] ?? 'Use the matching panel from the viral style board.';
}

export function getViralExternalReferenceUrlsForLayout(_style: SobLayoutStyle): string[] {
  return getViralExternalReferenceUrls().slice(0, 1);
}

export function getLayoutCompositionReferenceUrl(style: SobLayoutStyle): string | undefined {
  if (style === 'centered_cosmic_hero') return getCenteredCosmicCompositionReferenceUrl();
  return undefined;
}
