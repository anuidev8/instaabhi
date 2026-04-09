export interface AbhiReference {
  id: string;
  path: string;
  tags: string[];
}

const imageModules = import.meta.glob('../../../docs/resources/images/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const sortedEntries = Object.entries(imageModules).sort(([a], [b]) => a.localeCompare(b));

export const ABHI_REFERENCE_IMAGES: AbhiReference[] = sortedEntries.map(([key, path], index) => ({
  id: `abhi_${String(index + 1).padStart(2, '0')}`,
  path,
  tags: inferTagsFromPath(key),
}));

export function getAbhiReferenceImageUrls(limit?: number): string[] {
  if (!limit || limit <= 0) return ABHI_REFERENCE_IMAGES.map((item) => item.path);
  return ABHI_REFERENCE_IMAGES.slice(0, limit).map((item) => item.path);
}

export function filterAbhiReferencesByTags(tags: string[]): AbhiReference[] {
  if (!tags.length) return ABHI_REFERENCE_IMAGES;
  const normalized = tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  return ABHI_REFERENCE_IMAGES.filter((ref) =>
    normalized.every((tag) => ref.tags.some((refTag) => refTag.includes(tag)))
  );
}

function inferTagsFromPath(path: string): string[] {
  const lower = path.toLowerCase();
  const tags = ['abhi', 'approved'];

  if (lower.includes('45.20')) tags.push('front', 'calm', 'instruction');
  if (lower.includes('45.43')) tags.push('close', 'serious', 'energy');
  if (lower.includes('46.07')) tags.push('centered', 'teacher', 'routine');
  if (lower.includes('46.27')) tags.push('dynamic', 'heat', 'biohack');
  if (lower.includes('46.42')) tags.push('calm', 'focus', 'sleep');
  if (lower.includes('47.43')) tags.push('intense', 'performance');
  if (lower.includes('48.04')) tags.push('close', 'mudra');

  return tags;
}
