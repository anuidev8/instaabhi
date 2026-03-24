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

function slugBaseName(topic: string): string {
  const s = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase().replace(/_+/g, '_').replace(/^_|_$/g, '');
  return (s || 'carousel').slice(0, 80);
}

/**
 * Builds a ZIP of PNG slides in the browser. Uses `navigator.share` with files on
 * mobile when supported; otherwise triggers download via object URL (desktop + most mobile).
 */
export async function downloadCarouselSlidesAsZip(images: string[], topic: string): Promise<void> {
  if (images.length === 0) return;

  const slug = slugBaseName(topic);
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
  const file = new File([blob], filename, { type: 'application/zip' });

  if (typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    try {
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: 'Carousel slides',
          text: `${images.length} slides · ${CAROUSEL_SLIDE_PX}×${CAROUSEL_SLIDE_PX} PNG`,
        });
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
    }
  }

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
