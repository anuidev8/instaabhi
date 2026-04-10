import type { SobLayoutStyle } from './types';

/**
 * Bundled composition reference for Centered Cosmic Hero (Vite resolves at build time).
 * Canonical file: `docs/resources/images/sob-centered-cosmic-hero.png`
 */
const centeredCosmicModules = import.meta.glob<string>('../../../docs/resources/images/sob-centered-cosmic-hero.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

/** Resolved asset URL for the centered cosmic layout reference, or undefined if file is absent. */
export function getCenteredCosmicCompositionReferenceUrl(): string | undefined {
  const url = Object.values(centeredCosmicModules)[0];
  return typeof url === 'string' ? url : undefined;
}

export function getLayoutCompositionReferenceUrl(style: SobLayoutStyle): string | undefined {
  if (style === 'centered_cosmic_hero') return getCenteredCosmicCompositionReferenceUrl();
  return undefined;
}
