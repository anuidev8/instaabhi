import JSZip from 'jszip';
import { ThumbnailDraft } from '../types';

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) {
    throw new Error('Thumbnail images must be base64 data URLs before export.');
  }

  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function slugify(value: string): string {
  return (value || 'thumbnail')
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

export async function downloadThumbnailDraftAsZip(draft: ThumbnailDraft): Promise<void> {
  const zip = new JSZip();
  const isSchoolOfBreath = draft.prompt.brand === 'school_of_breath';
  const sob = draft.prompt.schoolOfBreath;
  const slug = isSchoolOfBreath
    ? slugify(`${sob?.category ?? 'sob'}_${sob?.mode ?? 'mode'}_${draft.prompt.title}`)
    : slugify(`${draft.prompt.deity}_${draft.prompt.intent}_${draft.prompt.title}`);

  draft.baseImages.forEach((dataUrl, index) => {
    zip.file(`${slug}_base_${String(index + 1).padStart(2, '0')}.png`, dataUrlToUint8Array(dataUrl));
  });

  zip.file(
    `${slug}_thumbnail_text_spec.txt`,
    (isSchoolOfBreath
      ? [
          `BRAND: THE SCHOOL OF BREATH`,
          `TITLE: ${draft.prompt.title}`,
          `CATEGORY: ${sob?.category ?? ''}`,
          `MODE: ${sob?.mode ?? ''}`,
          `HOOK FAMILY: ${sob?.hookFamily ?? ''}`,
          `TOP LINE: ${sob?.topLine ?? ''}`,
          `MAIN HOOK: ${draft.canvaSpec.hookWord}`,
          `BOTTOM STRIP: ${sob?.bottomStrip ?? draft.canvaSpec.badge ?? ''}`,
          `SUPPORT VISUAL: ${sob?.supportVisual ?? ''}`,
          `COLOR EMPHASIS: ${sob?.colorEmphasis ?? ''}`,
          `BACKGROUND STYLE: ${sob?.backgroundStyle ?? ''}`,
          `SEO TITLE: ${draft.canvaSpec.seoTitle ?? ''}`,
          `HOOK COLOR: ${draft.canvaSpec.colors.hook}`,
          `SECONDARY COLOR: ${draft.canvaSpec.colors.secondary}`,
          `BRAND COLOR: ${draft.canvaSpec.colors.brand}`,
          '',
          'LAYOUT NOTES:',
          '- Keep one dominant message readable at mobile size.',
          '- With character mode: Abhi left 40-50%, text right 50-60%.',
          '- Without character mode: text-first + one support visual only.',
          '- Keep high contrast and avoid mystical/deity styling.',
        ]
      : [
          `TITLE: ${draft.prompt.title}`,
          `DEITY: ${draft.prompt.deity}`,
          `INTENT: ${draft.prompt.intent}`,
          `SCHOOL LABEL: ${draft.canvaSpec.schoolLabel ?? 'SCHOOL OF MANTRAS'}`,
          `LINE 1: ${draft.canvaSpec.hookWord}`,
          `LINE 2: ${draft.canvaSpec.secondary}`,
          `BADGE: ${draft.canvaSpec.badge ?? ''}`,
          `SEO TITLE: ${draft.canvaSpec.seoTitle ?? ''}`,
          `LINE 1 COLOR: ${draft.canvaSpec.colors.hook}`,
          `LINE 2 COLOR: ${draft.canvaSpec.colors.secondary}`,
          `BADGE COLOR: ${draft.canvaSpec.colors.badge ?? '#FFFFFF'}`,
          `AURA COLOR: ${draft.canvaSpec.colors.aura ?? draft.canvaSpec.colors.brand}`,
          `BRAND COLOR: ${draft.canvaSpec.colors.brand}`,
          '',
          'LAYOUT NOTES:',
          '- Deity should sit on the left 40-55% of the frame.',
          '- The generated thumbnail should already include the right-side text block.',
          '- Use 3 lines max on the right: line 1, line 2, and badge.',
          '- Keep the final frame dark, high-contrast, and devotional.',
        ]
    ).join('\n')
  );

  zip.file(
    `${slug}_brief.json`,
    JSON.stringify(
      {
        prompt: draft.prompt,
        canvaSpec: draft.canvaSpec,
        templateId: draft.templateId,
        generationPrompts: draft.generationPrompts,
        validationSummary: draft.validationSummary,
      },
      null,
      2
    )
  );

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug}_thumbnail_pack.zip`;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 90_000);
}
