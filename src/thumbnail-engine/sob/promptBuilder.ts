import { buildSobRenderSpec } from './renderSpec';
import type { SobRenderSpec } from './renderSpec';
import { SobLayoutStyle, SobPromptContext, SobPromptInput, SobVariant } from './types';

function layoutFamilyLabel(style: SobLayoutStyle): string {
  if (style === 'giant_hook_left') return 'Giant Hook Left';
  if (style === 'centered_cosmic_hero') return 'Centered Cosmic Hero';
  return 'Balanced Subject Right';
}

function getBackgroundMatchRules(backgroundTheme: string): string[] {
  const theme = backgroundTheme.toLowerCase();

  if (theme.includes('forest')) {
    return [
      '- Forest-river atmosphere: mossy rocks, flowing water, mist — kept secondary behind text.',
      '- No dominant scenic focal point in the text zone.',
    ];
  }

  if (theme.includes('cosmic')) {
    return [
      '- Cosmic atmosphere: star field, nebula glow, layered depth — kept secondary.',
      '- Reduce brightness directly behind the hook block.',
    ];
  }

  if (theme.includes('fire')) {
    return [
      '- Fire atmosphere: flame walls, lava heat, dark rock — kept secondary behind blocks.',
      '- Flames must not compete with the hook text for visual dominance.',
    ];
  }

  if (theme.includes('warm_studio')) {
    return [
      '- Warm studio atmosphere: golden light, subtle haze — kept secondary.',
      '- No bright spot directly behind the text zone.',
    ];
  }

  if (theme.includes('cool_blue_sleep_field')) {
    return [
      '- Cool blue sleep atmosphere: moon-tone light, calm bloom — kept secondary.',
      '- No bright bloom behind hook block.',
    ];
  }

  return [
    '- Textured cinematic environment supporting the topic — never competing with text.',
  ];
}

function getLayoutGeometryRules(spec: SobRenderSpec): string[] {
  if (spec.layoutStyle === 'giant_hook_left') {
    return [
      'LAYOUT FAMILY: Giant Hook Left (channel reference B — split column).',
      '- Yellow hook block dominates the LEFT text column — oversized and aggressive.',
      '- Top dark strip: narrow (≤10% of frame height), compressed, minimal — a label only.',
      '- CTA block: compact strong red rectangle, full-width of the LEFT text column, anchored bottom-left of that stack.',
      '- Support icon/badge: lower-left, just inside the text/subject boundary.',
      '- Title dominance: MAX — hook text is the first and only thing the eye sees on that side.',
      '- No balanced poster spacing. No thin minimal hook box. The hook block IS the frame.',
    ];
  }
  if (spec.layoutStyle === 'centered_cosmic_hero' && spec.subjectType === 'abhi') {
    return [
      'LAYOUT FAMILY: Centered Cosmic Hero (channel reference A — with character).',
      '- Symmetrical poster: Abhi centered; depth order = cosmic background → wide yellow-gold hook ribbon **behind** shoulders & head → Abhi + halo in front → red CTA tag **on the right side of the torso** (chest/heart band), not orphaned under the yellow corner.',
      '- Top strip: **white on near-black** (#0a0a0a–#1a1a1a), bold condensed sans, full width — matches channel “LIVE BETTER / STRESS RELIEF” style.',
      '- Main hook bar: **black text** on **yellow→gold gradient ribbon** with thin black outline (premium, not flat neon); bar sits mid-frame and **intersects** the subject’s head — not a thin strip floating above a separate empty area.',
      '- Red CTA tag: **white text on #E60000–#FF2D20**, optional thin **white keyline**; position = **right-of-center on the body** (overlapping robe). WRONG: tiny tag only under the bottom-right corner of the yellow bar with no connection to the torso.',
      '- Circular proof inset (sprout/brain): **bottom-LEFT quadrant** (viewer left), gold rim — NOT solo bottom-center. Arrow from **left side of yellow bar** curves down toward that circle.',
      '- Corner symbols (required): top-left + top-right circular chakra/emblem badges. Colors/symbol style must follow the current topic + reference image (not fixed blue/green for all topics).',
    ];
  }
  if (spec.layoutStyle === 'centered_cosmic_hero') {
    return [
      'LAYOUT FAMILY: Centered Cosmic Hero (without character — **character-ready** for later composite).',
      '- Same text stack as channel: cosmic background → thin dark top strip → wide **yellow-gold** hook bar (black text, thin black keyline) → red CTA with white text + optional white keyline.',
      '- **Reserve lower-center “teacher zone”:** keep the **vertical center column** of the lower half (~35–45% frame width) as **mostly open cosmic background** (subtle vignette/glow OK) — this is where Abhi will be placed later. Do **not** cover this zone with a huge centered sprout/brain/moon graphic.',
      '- Support visual: one proof graphic **bottom-LEFT** or lower-left (smaller circular inset), gold rim — secondary, not the dominant lower focal point.',
      '- Red CTA: float **mid-right in the lower third** (where a torso would sit), **not** only tucked under the yellow bar’s corner.',
      '- Yellow-gold hook bar may hang low; leave vertical room beneath it so a seated figure could align under it later.',
      '- Corner symbols (required): top-left + top-right circular chakra/emblem badges, matching current topic/reference style and scale in the top corners.',
    ];
  }
  return [
    'LAYOUT FAMILY: Balanced Subject Right.',
    '- Text zone and subject zone share approximately equal visual weight.',
    '- Top strip: normal height, clearly readable.',
    '- Yellow hook block: prominent and large, but not overwhelming.',
    '- CTA block: third horizontal strip in the SAME text column as top+hook (full width of text zone), saturated red with white text — stacked below the yellow hook, not a separate floating pill beside the hook.',
    '- Support badge: bridges the text zone and subject zone boundary.',
    '- Title dominance: HIGH — strong but in dialogue with the subject.',
  ];
}

/** Premium hook bar — shared across layout families (harmonizes with warm cosmic / forest backgrounds) */
function getMainHookBarGoldRules(): string[] {
  return [
    'MAIN HOOK BAR (yellow-gold, premium — not flat poster yellow):',
    '- ONE contiguous horizontal bar; **black (#0f0f0f–#1a1a1a) ultra-bold uppercase** hook text inside.',
    '- Fill: **rich yellow→gold horizontal gradient** — bright lemon-gold on the left (#FFD84A–#FFCC33) shifting to warm amber/gold on the right (#F5B014–#D99A0B); optional subtle **top sheen/highlight** for a luxury foil feel.',
    '- Edge: **thin black keyline** (~1–2px, #0a0a0a) around the whole bar, like premium channel uploads — not a borderless neon slab.',
    '- FORBIDDEN: flat #FFFF00 neon, plastic highlighter yellow with no depth. The gold should **harmonize** with orange/gold glows in cosmic or warm backgrounds.',
    '- Hook may be one or two lines inside this single block — do NOT put each word in a separate box.',
  ];
}

/** Colors and strip roles must match real School of Breath uploads — prevents grey/soft A/B drift */
function getChannelStripColorLock(spec: SobRenderSpec): string[] {
  const shared = [
    'CHANNEL STRIP COLOR LOCK (non-negotiable for every variant):',
    '- Top strip: near-black or dark charcoal background (#0d0d0d–#1c1c1c), WHITE bold uppercase text. Never light grey box, never black text on white, never low-contrast “card UI”.',
    ...getMainHookBarGoldRules(),
    '- Both A and B use this identical palette; variants differ only in size, weight, and emphasis — not in substituting greys or “clean UI” styles.',
  ];

  if (spec.layoutStyle === 'centered_cosmic_hero') {
    const characterLayering =
      spec.subjectType === 'abhi'
        ? [
            '- Layering: dark strip → yellow-gold bar (behind subject) → person → red CTA on torso. Head/halo may cut **in front of** the yellow for depth.',
            '- Sprout/brain circle: **left side**, not centered over the horizon alone. FORBIDDEN: faceless black silhouette for Abhi when WITH CHARACTER.',
          ]
        : [
            '- Layering (no character in this render): dark strip → yellow-gold hook bar → **open center-lower background reserved** → red CTA mid-right; support inset **left** only.',
            '- This frame must stay **character-ready**: center-bottom stays clear for a future Abhi composite — no full-bleed centered icon blocking that slot.',
          ];
    return [
      ...shared,
      'CENTERED COSMIC HERO — tag colors + corner symbols must match uploads (not generic UI):',
      '- Top tag: **white (#FFFFFF) text** on **dark charcoal/black** strip — never grey-on-grey.',
      '- Hook tag: **black text** on the **yellow-gold gradient bar** above (not yellow text on black).',
      '- CTA tag: **white text** on **saturated red**; optional white outline on the red box — never pink/orange substitute.',
      '- Chakra corner symbols are mandatory in centered family: both top corners must include circular emblems; use topic/reference-appropriate colors and glyph style.',
      ...characterLayering,
    ];
  }

  return [
    ...shared,
    '- Stack is exactly THREE strips in the text zone, in order: (1) top context strip → (2) main hook block → (3) CTA strip. No fourth strip, no footer captions, no watermark text, no placeholder labels.',
    '- CTA strip: saturated RED background (#E60000–#FF3B30), WHITE bold uppercase CTA text. Never pale grey CTA, never black-on-grey “button”, never omit the red strip.',
  ];
}

function getBackgroundSuppressionRules(spec: SobRenderSpec): string[] {
  const layering =
    spec.layoutStyle === 'centered_cosmic_hero'
      ? [
          spec.subjectType === 'abhi'
            ? 'LAYERING (centered cosmic): cosmic/nebula fills the full frame behind text and subject. Stars or a soft galaxy band in the lower half behind Abhi is OK if it stays darker than the yellow-gold hook bar.'
            : 'LAYERING (centered cosmic, no character): cosmic fills the frame; keep lower-center atmospheric so a teacher plate can be added later — support graphic stays left, not centered. Do not add any center placeholder box/panel/column.',
        ]
      : [];
  return [
    'BACKGROUND ROLE: support_only.',
    '- Background must NOT compete with hook text, CTA, or subject for visual attention.',
    `- Background theme: ${spec.backgroundTheme}.`,
    '- Reduce contrast and brightness behind the text block area.',
    '- Full-bleed background required — but it supports, it never dominates.',
    ...(spec.layoutStyle === 'centered_cosmic_hero'
      ? []
      : ['- No beautiful wallpaper composition. No scenic focal point behind the hook.']),
    '- Visual hierarchy: hook block > subject/support visual > CTA > background.',
    ...layering,
    ...getBackgroundMatchRules(spec.backgroundTheme),
  ];
}

function getLockedFrameRules(spec: SobRenderSpec): string[] {
  if (spec.layoutStyle === 'centered_cosmic_hero') {
    const lowerZone =
      spec.subjectType === 'abhi'
        ? '- Abhi centered horizontally; seated; waist-up; head and halo may overlap the yellow-gold bar (not “all text above, all person below” as separate slices).'
        : '- Lower half: character-ready — reserve center-bottom (~center 35–45% width) for a future seated Abhi composite using natural cosmic background only (soft glow OK). Place the support visual bottom-left, modest size — not a giant hero circle dead center. No box/panel/column placeholders.';
    const hookBarLine =
      spec.subjectType === 'abhi'
        ? '- Yellow-gold hook bar may extend low enough to intersect Abhi’s head — correct channel look.'
        : '- Yellow-gold hook bar sits above the reserved lower-center zone; leave vertical gap so a figure can sit under the bar later.';
    return [
      'LOCKED FRAME (CENTERED COSMIC HERO):',
      '- Full-bleed 1280x720. No device mockup, no outer white frame.',
      '- Background: cosmic/nebula/starfield across entire canvas — never a blank white or flat grey left column.',
      '- Top: dark strip + wide yellow-gold hook bar span most of the frame width; they sit in the upper-mid vertically.',
      hookBarLine,
      lowerZone,
      '- Do NOT use a 55/45 left-right column split; that is a different layout family.',
    ];
  }
  return [
    'LOCKED FRAME:',
    '- Full-bleed frame. No borders, no white frame, no mockup card.',
    `- ${spec.textSide} 55-60% = rigid stacked text rectangles (top strip + hook block + CTA block).`,
    `- ${spec.subjectSide} 40-45% = subject zone.`,
    '- No floating text anywhere. No extra decorative text elements.',
  ];
}

function getVariantAExactPositioning(spec: SobRenderSpec): string[] {
  if (spec.layoutStyle === 'centered_cosmic_hero' && spec.subjectType === 'abhi') {
    return [
      'VARIANT A — POSITION EXACT (match published cosmic thumbnails):',
      '- Same layering as reference: head/halo intersect yellow-gold bar; red CTA box on torso with white keyline; sprout circle on the LEFT.',
      '- Real face visible — not a silhouette.',
      '- Corner chakras + sprout + arrow per VISUAL SLOTS only.',
    ];
  }
  if (spec.layoutStyle === 'centered_cosmic_hero') {
    return [
      'VARIANT A — POSITION EXACT (no character, character-ready):',
      '- Match channel text stack; support visual **bottom-left**; **clear center-lower** for future Abhi with no placeholder shape.',
      '- Red CTA mid-right lower third; corner chakras + arrow per VISUAL SLOTS only.',
    ];
  }
  if (spec.layoutStyle === 'giant_hook_left') {
    return [
      'VARIANT A — POSITION EXACT (match published split-column / fire thumbnails):',
      '- Text column locked LEFT (~55–60%): stacked strips only; subject on RIGHT with fire/cosmic behind him.',
      '- Yellow hook: left column, dominant height; CTA red at bottom of that same column (bottom-left of stack).',
      '- Anatomical or energy overlay on torso if topic implies it — stays on subject, not on text.',
    ];
  }
  return [
    'VARIANT A — POSITION EXACT (balanced grid):',
    '- Left column: full three-strip stack; right column: subject + bridge badge; CTA red as third strip in column.',
  ];
}

function getHookLineBreakRule(spec: SobRenderSpec): string | null {
  if (spec.hookLineBreakMode === 'two_line_split' && spec.hookLine1 && spec.hookLine2) {
    return `HOOK LINE BREAK: Render hook as exactly two stacked lines — Line 1: "${spec.hookLine1}" / Line 2: "${spec.hookLine2}". Do not reflow into one line. Do not reinterpret wrapping.`;
  }
  return null;
}

function buildSobRenderPrompt(spec: SobRenderSpec): string {
  const layoutGeometryRules = getLayoutGeometryRules(spec);
  const backgroundSuppressionRules = getBackgroundSuppressionRules(spec);
  const hookLineBreakRule = getHookLineBreakRule(spec);

  const modeRules =
    spec.subjectType === 'abhi'
      ? spec.layoutStyle === 'centered_cosmic_hero'
        ? [
            'MODE RULES:',
            '- WITH CHARACTER mode.',
            '- Use only attached Abhi reference images.',
            '- Do not invent another person.',
            '- Preserve exact Abhi face identity.',
            '- Preserve mature Indian male teacher appearance.',
            '- Keep Abhi in a seated or breath-teaching pose.',
            `- Required pose guidance: ${spec.characterPose || 'seated breath teacher pose'}.`,
            '- Place Abhi CENTERED in the lower half of the frame (horizontal center), not in a side column.',
            '- Lower-edge anchor: subject sits just above bottom safe margin; torso large enough for mobile.',
            '- Show a clear, lit face (no anonymous silhouette).',
            '- Not a fashion portrait, not a sticker cutout, not a generic guru.',
          ]
        : [
            'MODE RULES:',
            '- WITH CHARACTER mode.',
            '- Use only attached Abhi reference images.',
            '- Do not invent another person.',
            '- Preserve exact Abhi face identity.',
            '- Preserve mature Indian male teacher appearance.',
            '- Keep Abhi in a seated or breath-teaching pose.',
            `- Required pose guidance: ${spec.characterPose || 'seated breath teacher pose'}.`,
            `- Place Abhi on the ${spec.subjectSide} 40-45% zone with natural body proportions.`,
            '- Not a fashion portrait, not a sticker cutout, not a generic guru.',
          ]
      : spec.layoutStyle === 'centered_cosmic_hero'
        ? [
            'MODE RULES:',
            '- WITHOUT CHARACTER mode (this image has no person).',
            '- No human subject, no face, no silhouette, no body parts.',
            '- Layout must stay character-ready: reserve lower-center for a future Abhi composite — keep that band open natural background.',
            '- Forbidden in reserved center area: placeholder box, panel, rectangular gradient column, mask, or framed cutout.',
            '- Place **one** support visual (from VISUAL SLOTS) **bottom-left** or lower-left, **smaller inset** scale — not a massive centered graphic.',
            '- Integrate support visual into the cosmic scene; red CTA floats **mid-right** where a torso would be.',
            '- No text in the support visual zone.',
            '- No secondary icons beyond one support visual and one support badge.',
          ]
        : [
            'MODE RULES:',
            '- WITHOUT CHARACTER mode.',
            '- No human subject, no face, no silhouette, no body parts.',
            `- The ${spec.subjectSide} 40-45% zone is a SUPPORT VISUAL ZONE.`,
            '- Place exactly one strong support visual in that zone.',
            '- Integrate that support visual into the scene naturally.',
            '- Never leave the support visual zone as plain background-only space.',
            '- No text in the support visual zone.',
            '- No secondary icons beyond one support visual and one support badge.',
          ];

  return [
    `Create a 1280x720 YouTube thumbnail for The School of Breath.`,
    `Layout preset: ${spec.layoutPreset} / Layout family: ${layoutFamilyLabel(spec.layoutStyle)}.`,
    '',
    ...getLockedFrameRules(spec),
    '',
    ...layoutGeometryRules,
    '',
    ...getChannelStripColorLock(spec),
    '',
    'TEXT SLOTS:',
    `- Top strip text: "${spec.topStripText}"`,
    `- Main hook text: "${spec.mainHookText}"`,
    hookLineBreakRule,
    `- CTA text: "${spec.ctaText}"`,
    `- CTA placement: ${spec.ctaPlacement.replace('_', '-')}.`,
    '',
    'VISUAL SLOTS:',
    `- Support visual: ${spec.supportVisual}`,
    `- Support icon placement: ${spec.supportIconPlacement} — explanatory, not decorative.`,
    `- Visual badge type: ${spec.visualBadgeType}`,
    spec.arrowAllowed
      ? '- Arrow: allowed only if it increases support visual clarity.'
      : '- Arrow: not allowed.',
    '',
    ...backgroundSuppressionRules,
    '',
    ...modeRules,
    '',
    'STYLE LOCK:',
    '- Aggressive YouTube thumbnail style.',
    '- Hard rectangular blocks. No soft rounded cards.',
    '- Match real published School of Breath thumbnails: dark top / **yellow-gold hook bar with black border** / red+white CTA grammar (centered layout may use overlapping CTA box on torso, not generic UI).',
    '- One dominant hook, one support visual, one support badge.',
    spec.isChannelProvenHook
      ? '- Hook source: channel-proven phrase — match channel energy closely.'
      : '- Hook source: custom phrase — maintain strict block style lock.',
    spec.specialNote ? `SPECIAL NOTE: ${spec.specialNote}` : null,
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n');
}

export function buildSobBasePromptFromRenderSpec(spec: SobRenderSpec): string {
  return buildSobRenderPrompt(spec);
}

export function buildSobPromptVariantsFromRenderSpec(
  spec: SobRenderSpec,
  variantCount: number
): SobVariant[] {
  const basePrompt = buildSobBasePromptFromRenderSpec(spec);

  const channelMatch: SobVariant = {
    id: 'A',
    label: 'Exact Channel Match',
    prompt: [
      basePrompt,
      'VARIANT A: Exact Channel Match (on-channel reference fidelity).',
      '- Match proportions and energy of real School of Breath uploads: strip heights, mobile readability, subject + badge placement.',
      '- Keep the locked strip colors exactly: dark top + yellow hook + red CTA — this is the channel look.',
      '- One support visual in the subject zone, one circular support badge as specified — no extra text boxes.',
      ...getVariantAExactPositioning(spec),
    ].join('\n'),
  };

  const hookPushExtra =
    spec.layoutStyle === 'giant_hook_left'
      ? '- Push hook block to near-maximum height — almost the full text-column height.'
      : spec.layoutStyle === 'centered_cosmic_hero'
        ? '- Make the centered yellow hook bar slightly taller and wider than Variant A (still one block).'
        : '- Make main hook block slightly larger than Variant A.';

  const hookPush: SobVariant = {
    id: 'B',
    label: 'Hook Push',
    prompt: [
      basePrompt,
      'VARIANT B: Hook Push (same channel grammar, stronger emphasis — not a different design system).',
      hookPushExtra,
      '- Keep top strip even tighter/thinner than Variant A.',
      '- Keep the SAME strip colors as Variant A: dark charcoal top, yellow hook, red CTA box — do not swap to grey or “minimal” UI.',
      ...(spec.subjectType === 'abhi'
        ? [
            '- WITH CHARACTER: Keep Abhi fully present and centered in both variants — same person, same face identity. Do NOT remove Abhi, do NOT replace with silhouette-only, do NOT make the sprout the only focal subject.',
          ]
        : []),
      '- Make the red CTA box slightly larger or heavier than A; keep white border + white text on red; **stay on the right torso** — do NOT park the CTA to the left of the sprout or only under the yellow bar’s corner.',
      '- Make sprout inset and corner chakras slightly more prominent (glow, scale) — sprout stays **bottom-left**, not centered alone.',
      '- Push overall contrast while keeping hook text legible.',
    ].join('\n'),
  };

  return variantCount <= 1 ? [channelMatch] : [channelMatch, hookPush];
}

export function buildSobBasePrompt(input: SobPromptInput, context: SobPromptContext): string {
  const normalizedHook = input.hook.trim().toUpperCase();
  const isTopicApprovedHook = (context.topic.hooks ?? []).some(
    (hook) => hook.trim().toUpperCase() === normalizedHook
  );
  const spec = buildSobRenderSpec(input, context, { isChannelProvenHook: isTopicApprovedHook });
  return buildSobBasePromptFromRenderSpec(spec);
}

export function buildSobPromptVariants(
  input: SobPromptInput,
  context: SobPromptContext,
  variantCount: number
): SobVariant[] {
  const normalizedHook = input.hook.trim().toUpperCase();
  const isTopicApprovedHook = (context.topic.hooks ?? []).some(
    (hook) => hook.trim().toUpperCase() === normalizedHook
  );
  const spec = buildSobRenderSpec(input, context, { isChannelProvenHook: isTopicApprovedHook });
  return buildSobPromptVariantsFromRenderSpec(spec, variantCount);
}
