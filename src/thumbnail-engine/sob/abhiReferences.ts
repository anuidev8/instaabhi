export interface AbhiReference {
  id: string;
  path: string;
  tags: string[];
}

const imageModules = import.meta.glob(
  '../../../images-reference/abhi_references/*.{png,jpg,jpeg,webp}',
  {
  eager: true,
  import: 'default',
  }
) as Record<string, string>;

const sortedEntries = Object.entries(imageModules).sort(([a], [b]) => a.localeCompare(b));

export const ABHI_REFERENCE_IMAGES: AbhiReference[] = sortedEntries.map(([key, path], index) => ({
  id: `abhi_${String(index + 1).padStart(2, '0')}`,
  path,
  tags: inferTagsFromPath(key),
}));

const CURATED_ABHI_REFERENCE_PATH_HINTS: string[] = [
  '4.41.31',
  'image may 6',
];

function getCuratedAbhiReferences(): AbhiReference[] {
  const curated = CURATED_ABHI_REFERENCE_PATH_HINTS.map((hint) =>
    ABHI_REFERENCE_IMAGES.find((image) => image.path.toLowerCase().includes(hint))
  ).filter((value): value is AbhiReference => Boolean(value));

  return curated.length > 0 ? curated : ABHI_REFERENCE_IMAGES;
}

export function getAbhiReferenceImageUrls(limit?: number): string[] {
  const curated = getCuratedAbhiReferences();
  if (!limit || limit <= 0) return curated.map((item) => item.path);
  return curated.slice(0, limit).map((item) => item.path);
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
  const tags = ['abhi', 'approved', 'identity'];
  if (lower.includes('screenshot')) tags.push('screenshot');

  return tags;
}
