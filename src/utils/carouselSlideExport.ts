/** Instagram carousel: strict 1:1 square export size (px). */
export const CAROUSEL_SLIDE_PX = 1080;

const DEFAULT_LETTERBOX_BG = '#080614';

/**
 * Draws the full source image into a square canvas using uniform scale (no aspect distortion).
 * Letterboxes when needed so the entire image stays visible for scale ≤ 1 relative to the fit baseline.
 */
export function imageToSquareCarouselDataUrl(
  img: HTMLImageElement,
  options?: {
    bg?: string;
    /** Zoom factor; values above 1 are capped at 1 so nothing is cropped. Below 1 adds margin (smaller image on canvas). */
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    slideOffsetX?: number;
    slideOffsetY?: number;
  },
): string {
  const SIZE = CAROUSEL_SLIDE_PX;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const bg = options?.bg ?? DEFAULT_LETTERBOX_BG;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  /** Cap at 1 so the whole image stays visible (Instagram 1:1 letterbox, no zoom-crop). */
  const rawScale = options?.scale ?? 1;
  const scaleUi = Math.min(Math.max(rawScale, 0.25), 1);
  const ox = (options?.offsetX ?? 0) + (options?.slideOffsetX ?? 0);
  const oy = (options?.offsetY ?? 0) + (options?.slideOffsetY ?? 0);

  const fit = Math.min(SIZE / img.width, SIZE / img.height);
  const drawW = img.width * fit * scaleUi;
  const drawH = img.height * fit * scaleUi;
  const dx = (SIZE - drawW) / 2 - ox;
  const dy = (SIZE - drawH) / 2 - oy;

  ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, drawW, drawH);
  return canvas.toDataURL('image/png');
}

/** Letterbox any bitmap into a 1:1 1080×1080 PNG data URL (no aspect distortion). */
export function bitmapToSquareCarouselDataUrl(
  source: HTMLCanvasElement | HTMLImageElement,
  bg = DEFAULT_LETTERBOX_BG,
): string {
  const SIZE = CAROUSEL_SLIDE_PX;
  const w = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth;
  const h = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight;
  if (!w || !h) return '';

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const fit = Math.min(SIZE / w, SIZE / h);
  const drawW = w * fit;
  const drawH = h * fit;
  const dx = (SIZE - drawW) / 2;
  const dy = (SIZE - drawH) / 2;
  ctx.drawImage(source, 0, 0, w, h, dx, dy, drawW, drawH);
  return canvas.toDataURL('image/png');
}
