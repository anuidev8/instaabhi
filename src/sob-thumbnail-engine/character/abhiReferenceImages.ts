const abhiReferenceImageModules = import.meta.glob(
  '../../../docs/resources/images/*.png',
  {
    eager: true,
    import: 'default',
  }
) as Record<string, string>;

export const ABHI_REFERENCE_IMAGE_URLS = Object.entries(abhiReferenceImageModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url);

export function getAbhiReferenceImageUrls(limit?: number): string[] {
  if (!limit || limit <= 0) return [...ABHI_REFERENCE_IMAGE_URLS];
  return ABHI_REFERENCE_IMAGE_URLS.slice(0, limit);
}
