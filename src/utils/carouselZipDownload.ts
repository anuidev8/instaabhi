import JSZip from 'jszip';
import { CAROUSEL_SLIDE_PX } from './carouselSlideExport';

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) {
    throw new Error('Each slide must be a base64 data URL (generate slides in the app first).');
  }
  const binary = atob(m[2]);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const bytes = dataUrlToUint8Array(dataUrl);
  return new Blob([bytes], { type: 'image/png' });
}

function slugBaseName(topic: string): string {
  const s = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase().replace(/_+/g, '_').replace(/^_|_$/g, '');
  return (s || 'carousel').slice(0, 80);
}

function isMobile(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/**
 * On mobile: shares individual PNG files via Web Share API so iOS saves them
 * directly to Photos (no ZIP extraction needed).
 * On desktop: builds a ZIP and triggers a download via <a>.
 *
 * iOS Safari does NOT support the `download` attribute on blob/object URLs —
 * it opens the file in the browser instead of saving it, so the ZIP fallback
 * is intentionally skipped on mobile.
 */
export async function downloadCarouselSlidesAsZip(images: string[], topic: string): Promise<void> {
  if (images.length === 0) return;

  const slug = slugBaseName(topic);

  // ── Mobile: share individual PNGs so they land in Photos on iOS ──────────
  if (isMobile() && typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
    const pngFiles = images.map((dataUrl, i) =>
      new File(
        [dataUrlToBlob(dataUrl)],
        `${slug}_slide_${String(i + 1).padStart(2, '0')}.png`,
        { type: 'image/png' }
      )
    );

    try {
      if (navigator.canShare({ files: pngFiles })) {
        await navigator.share({
          files: pngFiles,
          title: 'Carousel slides',
          text: `${images.length} slides · ${CAROUSEL_SLIDE_PX}×${CAROUSEL_SLIDE_PX} PNG`,
        });
        return;
      }
    } catch (err) {
      // User cancelled — treat as success
      if (err instanceof Error && err.name === 'AbortError') return;
      // Otherwise fall through to ZIP
    }
  }

  // ── Desktop (and mobile fallback): ZIP download via <a> ──────────────────
  const zip = new JSZip();
  images.forEach((dataUrl, i) => {
    const bytes = dataUrlToUint8Array(dataUrl);
    zip.file(`${slug}_slide_${String(i + 1).padStart(2, '0')}.png`, bytes);
  });

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const filename = `${slug}_carousel_slides.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 90_000);
}
