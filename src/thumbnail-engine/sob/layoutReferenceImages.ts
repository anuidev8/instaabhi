import type { SobLayoutStyle } from './types';

/**
 * Bundled composition reference for Centered Cosmic Hero (Vite resolves at build time).
 * Canonical file: `docs/resources/images/sob-centered-cosmic-hero.png`
 */
const centeredCosmicModules = import.meta.glob<string>('../../../docs/resources/images/sob-centered-cosmic-hero.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const viralPanelModules = import.meta.glob<string>(
  '../../../images-reference/viralThumbnails/panels/*.png',
  {
    eager: true,
    import: 'default',
  }
) as Record<string, string>;

const viralCharacterAnchorModules = import.meta.glob<string>(
  '../../../images-reference/viralThumbnails/viral_character_anchor.png',
  {
    eager: true,
    import: 'default',
  }
) as Record<string, string>;

const viralBoardModules = import.meta.glob<string>(
  '../../../images-reference/viralThumbnails/image_virals.png',
  {
    eager: true,
    import: 'default',
  }
) as Record<string, string>;

/** Resolved asset URL for the centered cosmic layout reference, or undefined if file is absent. */
export function getCenteredCosmicCompositionReferenceUrl(): string | undefined {
  const url = Object.values(centeredCosmicModules)[0];
  return typeof url === 'string' ? url : undefined;
}

export function getViralCharacterAnchorReferenceUrl(): string | undefined {
  const url = Object.values(viralCharacterAnchorModules)[0];
  return typeof url === 'string' ? url : undefined;
}

const VIRAL_PANEL_FILE_BY_STYLE: Partial<Record<SobLayoutStyle, string>> = {
  mega_word_micro_sub: 'mega_word_micro_sub.png',
  diagonal_slash_story: 'diagonal_slash_story.png',
  vertical_text_tower: 'vertical_text_tower.png',
  number_badge_micro_hook: 'number_badge_micro_hook.png',
  photo_heavy_outline_text: 'photo_heavy_outline_text.png',
  text_behind_subject: 'text_behind_subject.png',
  dual_depth_dynamic_text: 'dual_depth_dynamic_text.png',
  color_word_stack: 'color_word_stack.png',
  subject_bleed_overlap: 'subject_bleed_overlap.png',
};

function findViralPanelUrlByFileName(fileName: string): string | undefined {
  return Object.entries(viralPanelModules).find(([path]) => path.endsWith(`/${fileName}`))?.[1];
}

export function getViralExternalReferenceUrls(): string[] {
  const panelUrls = Object.values(viralPanelModules).filter(
    (url): url is string => typeof url === 'string'
  );
  if (panelUrls.length > 0) return panelUrls;

  return Object.values(viralBoardModules).filter((url): url is string => typeof url === 'string');
}

export function getViralReferenceInstruction(style: SobLayoutStyle): string {
  const map: Partial<Record<SobLayoutStyle, string>> = {
    mega_word_micro_sub: 'Use the MEGA WORD viral style language only.',
    diagonal_slash_story: 'Use the DIAGONAL SLASH viral style language only.',
    vertical_text_tower: 'Use the TEXT TOWER viral style language only.',
    number_badge_micro_hook: 'Use the NUMBER BADGE viral style language only.',
    photo_heavy_outline_text: 'Use the PHOTO + OUTLINE viral style language only.',
    text_behind_subject: 'Use the TEXT BEHIND SUBJECT viral style language only.',
    dual_depth_dynamic_text: 'Use the DUAL DEPTH DYNAMIC viral style language only.',
    color_word_stack: 'Use the COLOR WORD STACK viral style language only.',
    subject_bleed_overlap: 'Use the SUBJECT BLEED OVERLAP viral style language only.',
  };

  return map[style] ?? 'Use the matching viral style language from attached references.';
}

export function getViralExternalReferenceUrlsForLayout(style: SobLayoutStyle): string[] {
  const panelFile = VIRAL_PANEL_FILE_BY_STYLE[style];
  if (panelFile) {
    const panelUrl = findViralPanelUrlByFileName(panelFile);
    if (panelUrl) return [panelUrl];
  }

  return getViralExternalReferenceUrls().slice(0, 1);
}

export function getLayoutCompositionReferenceUrl(style: SobLayoutStyle): string | undefined {
  if (style === 'centered_cosmic_hero') return getCenteredCosmicCompositionReferenceUrl();
  return undefined;
}
