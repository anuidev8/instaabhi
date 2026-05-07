import JSZip from 'jszip';
import { ThumbnailDraft } from '../types';

/** Shown once per browser session when downloading ChatGPT thumbnail exports from SOB. */
export const CHATGPT_THUMB_EXPORT_ALERT_KEY = 'instaabhi_sob_chatgpt_thumbnail_export_v1';

export function alertChatGptThumbnailExportInstructionsOnce(): void {
  if (typeof window === 'undefined') return;
  try {
    if (sessionStorage.getItem(CHATGPT_THUMB_EXPORT_ALERT_KEY)) return;
    sessionStorage.setItem(CHATGPT_THUMB_EXPORT_ALERT_KEY, '1');
  } catch {
    // ignore (e.g. private mode)
  }

  window.alert(
    [
      'How to use these downloads in ChatGPT',
      '',
      '1. Download the PNG (your reference thumbnail) and the brief JSON file.',
      '2. Open ChatGPT in a chat that allows image upload.',
      '3. Attach the PNG first.',
      '4. Open the JSON file, find the "chatgptImagePrompt" field, and copy its entire value.',
      '5. Paste that text into ChatGPT and send.',
      '',
      'The prompt text is written to start with “Create image…” and to use the reference image you upload.',
      '',
      'Keep the PNG filename as downloaded so it matches the name referenced inside the brief.',
    ].join('\n')
  );
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 90_000);
}

export function getThumbnailPackSlug(draft: ThumbnailDraft): string {
  const isSchoolOfBreath = draft.prompt.brand === 'school_of_breath';
  const sob = draft.prompt.schoolOfBreath;
  return isSchoolOfBreath
    ? slugify(`${sob?.category ?? 'sob'}_${sob?.mode ?? 'mode'}_${draft.prompt.title}`)
    : slugify(`${draft.prompt.deity}_${draft.prompt.intent}_${draft.prompt.title}`);
}

export function buildThumbnailBriefJsonObject(
  draft: ThumbnailDraft,
  referenceImageFileName: string
): Record<string, unknown> {
  const isSchoolOfBreath = draft.prompt.brand === 'school_of_breath';
  const chatgptImagePrompt = isSchoolOfBreath
    ? buildSchoolOfBreathChatGptPrompt(draft, referenceImageFileName)
    : buildDefaultChatGptPrompt(draft, referenceImageFileName);

  return {
    referencePngFileName: referenceImageFileName,
    chatgptImagePrompt,
    prompt: draft.prompt,
    canvaSpec: draft.canvaSpec,
    templateId: draft.templateId,
    generationPrompts: draft.generationPrompts,
    validationSummary: draft.validationSummary,
  };
}

/** Single-image PNG download for ChatGPT reference (first base image). */
export async function downloadThumbnailImage(draft: ThumbnailDraft): Promise<void> {
  const slug = getThumbnailPackSlug(draft);
  const fileName = `${slug}_thumbnail.png`;
  const dataUrl = draft.baseImages[0];
  if (!dataUrl?.trim()) {
    throw new Error('No thumbnail image to download yet.');
  }
  const bytes = dataUrlToUint8Array(dataUrl);
  triggerBrowserDownload(new Blob([bytes], { type: 'image/png' }), fileName);
}

/** Brief JSON containing copy-paste `chatgptImagePrompt` for ChatGPT. */
export async function downloadThumbnailBriefJson(draft: ThumbnailDraft): Promise<void> {
  const slug = getThumbnailPackSlug(draft);
  const referenceImageFileName = `${slug}_thumbnail.png`;
  const fileName = `${slug}_brief.json`;
  const payload = buildThumbnailBriefJsonObject(draft, referenceImageFileName);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  triggerBrowserDownload(blob, fileName);
}

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

function buildSchoolOfBreathChatGptPrompt(draft: ThumbnailDraft, imageFileName: string): string {
  const sob = draft.prompt.schoolOfBreath;
  const mode = sob?.mode ?? '';
  const layoutStyle = sob?.layoutStyle ?? draft.canvaSpec.layoutStyle ?? '';
  const topLine = sob?.topLine ?? draft.canvaSpec.topStripText ?? '';
  const mainHook = draft.canvaSpec.hookWord ?? '';
  const cta = sob?.bottomStrip ?? draft.canvaSpec.ctaText ?? '';
  const supportVisual = sob?.supportVisual ?? draft.canvaSpec.supportVisual ?? '';
  const background = sob?.backgroundStyle ?? draft.canvaSpec.backgroundTheme ?? '';
  const pose = sob?.characterPose ?? draft.canvaSpec.characterPose ?? '';

  return [
    'Create image: a 1280×720 (16:9) YouTube thumbnail for The School of Breath that is sharp, cinematic, high-contrast, and instantly readable on a phone.',
    '',
    `Use the reference image I upload in this chat (file: "${imageFileName}"). Treat that upload as the primary visual anchor for composition, lighting, color story, typographic hierarchy, and Abhi's likeness when the character appears. Refine for stronger CTR while staying faithful to the reference — do not invent a totally unrelated scene.`,
    '',
    'SYSTEM / ROLE:',
    'You are an elite YouTube thumbnail art director for The School of Breath.',
    'Use the attached reference image to keep style/composition continuity while improving CTR and readability.',
    '',
    'INPUT IMAGE:',
    `- Reference image filename: ${imageFileName}`,
    '- I attached this image in ChatGPT before sending this prompt.',
    '- Treat the attached image as the primary visual reference for composition, lighting, and hierarchy.',
    '',
    'NON-NEGOTIABLE BRAND RULES:',
    '- Output must be 1280x720, cinematic, high-contrast, mobile-first readability.',
    '- Keep one dominant hook message with clear visual hierarchy.',
    '- Do not add random extra text not listed in TEXT LOCK below.',
    '- Avoid generic stock look or flat UI card style.',
    '',
    'TEXT LOCK (use exactly):',
    `- TOP STRIP: "${topLine}"`,
    `- MAIN HOOK: "${mainHook}"`,
    `- CTA: "${cta}"`,
    '',
    'CREATIVE LOCK:',
    `- Brand: THE SCHOOL OF BREATH`,
    `- Mode: ${mode}`,
    `- Layout style: ${layoutStyle}`,
    `- Support visual intent: ${supportVisual}`,
    `- Background theme: ${background}`,
    pose ? `- Character pose intent: ${pose}` : '- Character pose intent: n/a',
    '',
    'TASK:',
    '- Create 3 stronger thumbnail variation prompts based on the attached image.',
    '- Each variation should preserve brand language but push click-through with better contrast, scale, and clarity.',
    '- Keep Abhi identity consistent if character mode is used.',
    '',
    'OUTPUT FORMAT:',
    '- Return exactly 3 sections:',
    '  1) Variation Name',
    '  2) Final Image Prompt (copy-paste ready)',
    '  3) Why this should improve CTR (1 sentence)',
  ].join('\n');
}

function buildDefaultChatGptPrompt(draft: ThumbnailDraft, imageFileName: string): string {
  return [
    'Create image: a 1280×720 (16:9) YouTube thumbnail that is sharp, cinematic, and mobile-readable.',
    '',
    `Use the reference image I upload in this chat (file: "${imageFileName}"). Match its style, composition, and hierarchy while improving click-through clarity.`,
    '',
    'SYSTEM / ROLE:',
    'You are an expert YouTube thumbnail strategist and prompt writer.',
    '',
    'INPUT IMAGE:',
    `- Reference image filename: ${imageFileName}`,
    '- I attached this image in ChatGPT before sending this prompt.',
    '- Use it as visual reference for style and composition.',
    '',
    'TASK:',
    '- Create 3 improved thumbnail prompts that keep the same concept but increase click-through-rate.',
    '- Keep text concise, high-contrast, and mobile-readable.',
    '- Preserve the original visual identity and mood from the attached image.',
    '',
    'OUTPUT FORMAT:',
    '- Variation Name',
    '- Prompt',
    '- 1-line reason',
  ].join('\n');
}

export async function downloadThumbnailDraftAsZip(draft: ThumbnailDraft): Promise<void> {
  const zip = new JSZip();
  const isSchoolOfBreath = draft.prompt.brand === 'school_of_breath';
  const sob = draft.prompt.schoolOfBreath;
  const slug = getThumbnailPackSlug(draft);

  draft.baseImages.forEach((dataUrl, index) => {
    zip.file(`${slug}_base_${String(index + 1).padStart(2, '0')}.png`, dataUrlToUint8Array(dataUrl));
  });
  const firstImageFileName = `${slug}_thumbnail.png`;
  if (draft.baseImages[0]) {
    zip.file(firstImageFileName, dataUrlToUint8Array(draft.baseImages[0]));
  }

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
          '- Text stack is left 55-60% with hard stacked rectangles.',
          '- With character mode: Abhi on right 40-45% in seated/breath-teaching pose.',
          '- Without character mode: right zone is support visual zone, never empty.',
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
    JSON.stringify(buildThumbnailBriefJsonObject(draft, firstImageFileName), null, 2)
  );

  zip.file(
    `${slug}_chatgpt_reference_prompt.txt`,
    isSchoolOfBreath
      ? buildSchoolOfBreathChatGptPrompt(draft, firstImageFileName)
      : buildDefaultChatGptPrompt(draft, firstImageFileName)
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
