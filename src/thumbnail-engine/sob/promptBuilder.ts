import { buildSobRenderSpec, isViralTypographicLayout } from './renderSpec';
import type { SobRenderSpec } from './renderSpec';
import { SobLayoutStyle, SobPromptContext, SobPromptInput, SobVariant } from './types';

function layoutFamilyLabel(style: SobLayoutStyle): string {
  if (style === 'giant_hook_left') return 'Giant Hook Left';
  if (style === 'centered_cosmic_hero') return 'Centered Cosmic Hero';
  if (style === 'mega_word_micro_sub') return 'Mega Word';
  if (style === 'diagonal_slash_story') return 'Diagonal Slash Story';
  if (style === 'vertical_text_tower') return 'Text Tower';
  if (style === 'number_badge_micro_hook') return 'Number Badge';
  if (style === 'photo_heavy_outline_text') return 'Photo + Outline Text';
  if (style === 'text_behind_subject') return 'Text Behind Subject';
  if (style === 'dual_depth_dynamic_text') return 'Dual Depth Dynamic Text';
  if (style === 'color_word_stack') return 'Color Word Stack';
  if (style === 'subject_bleed_overlap') return 'Subject Bleed Overlap';
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
  if (isViralTypographicLayout(spec.layoutStyle)) {
    const shared = [
      `LAYOUT FAMILY: ${layoutFamilyLabel(spec.layoutStyle)} (viral typographic board).`,
      '- Full-bleed 16:9 thumbnail with one dominant mobile-readable type system.',
      '- Keep critical text away from extreme edges and the bottom-right timestamp area.',
      '- Use strong subject/text overlap, depth, scale, or contrast instead of a rigid strip stack.',
    ];

    switch (spec.layoutStyle) {
      case 'mega_word_micro_sub':
        return [
          ...shared,
          '- One giant word or ultra-short phrase owns the center/left mass of the frame.',
          '- Micro subtitle or CTA stays secondary and clearly smaller.',
        ];
      case 'diagonal_slash_story':
        return [
          ...shared,
          '- Use a dramatic diagonal split with stressed state on one side and calm/payoff state on the other.',
          '- The diagonal line must be a visual divider, not a classic rectangular bar.',
        ];
      case 'vertical_text_tower':
        return [
          ...shared,
          '- Build a tall stacked headline column with three large words when possible.',
          '- Subject/support visual sits beside or partially behind the text tower.',
        ];
      case 'number_badge_micro_hook':
        return [
          ...shared,
          '- A giant circular number badge is the first read.',
          '- The hook and CTA orbit the badge without turning into a three-strip template.',
        ];
      case 'photo_heavy_outline_text':
        return [
          ...shared,
          '- Full-bleed cinematic photo carries the emotion.',
          '- Use only oversized outline text, 1-2 words if possible.',
        ];
      case 'text_behind_subject':
        return [
          ...shared,
          '- Oversized text sits behind Abhi or the support visual.',
          '- Subject overlaps and masks part of the letters for depth.',
        ];
      case 'dual_depth_dynamic_text':
        return [
          ...shared,
          '- Put one backdrop phrase behind the subject and one punch word in front.',
          '- Preserve clear z-depth separation between background, subject, and front text.',
        ];
      case 'color_word_stack':
        return [
          ...shared,
          '- Stack two or three words with white / red / gold hierarchy.',
          '- Color contrast replaces the classic yellow hook bar.',
        ];
      case 'subject_bleed_overlap':
        return [
          ...shared,
          '- Abhi bleeds from the right past center with energetic overlap.',
          '- Left-side hook text can overlap the subject edge but must stay readable.',
        ];
      default:
        return shared;
    }
  }

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
      '- Symmetrical poster: Abhi centered; depth order = cosmic background → **fixed-size** wide yellow-gold hook bar (~82–92% frame width, ~34–40% frame height) **behind** shoulders & head → Abhi + halo in front → red CTA tag **on the right side of the torso** (chest/heart band), not orphaned under the yellow corner.',
      '- Top strip: **white on near-black** (#0a0a0a–#1a1a1a), bold condensed sans, full width — matches channel “LIVE BETTER / STRESS RELIEF” style.',
      '- Main hook bar: **black text** on **yellow→gold gradient** with thin black outline (premium, not flat neon); **same bar dimensions for every hook** (see FIXED TEMPLATE rules). Bar sits mid-frame and **intersects** the subject’s head.',
      '- Red CTA tag: **white text on #E60000–#FF2D20**, optional thin **white keyline**; position = **right-of-center on the body** (overlapping robe). Target footprint for centered family: **~18–28% frame width** (~230–360px @1280w) and **~12–17% frame height** (~86–122px @720h) with bold condensed text. WRONG: tiny tag only under the bottom-right corner of the yellow bar with no connection to the torso.',
      '- Circular proof inset (sprout/brain): **bottom-LEFT quadrant** (viewer left), gold rim — NOT solo bottom-center. Arrow from **left side of yellow bar** curves down toward that circle.',
      '- Corner symbols (required): top-left + top-right circular chakra/emblem badges. Colors/symbol style must follow the current topic + reference image (not fixed blue/green for all topics).',
    ];
  }
  if (spec.layoutStyle === 'centered_cosmic_hero') {
    return [
      'LAYOUT FAMILY: Centered Cosmic Hero (without character — **character-ready** for later composite).',
      '- Same text stack as channel: cosmic background → thin dark top strip → **fixed-template** wide **yellow-gold** hook bar (~82–92% width, ~34–40% height; black text, thin black keyline) → red CTA with white text + optional white keyline.',
      '- **Reserve lower-center “teacher zone”:** keep the **vertical center column** of the lower half (~35–45% frame width) as **mostly open cosmic background** (subtle vignette/glow OK) — this is where Abhi will be placed later. Do **not** cover this zone with a huge centered sprout/brain/moon graphic.',
      '- Support visual: one proof graphic **bottom-LEFT** or lower-left (smaller circular inset), gold rim — secondary, not the dominant lower focal point.',
      '- Red CTA: float **mid-right in the lower third** (where a torso would sit), **not** only tucked under the yellow bar’s corner. Keep a strong centered-family CTA footprint (~18–28% frame width, ~12–17% frame height).',
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
    '- Shape lock: keep the same clean rectangular hook bar style across all topics/layouts (no banners, ribbons, fishtails, notched ends, angled flags, or ornamental tails).',
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
    const cornerRule =
      spec.subjectType === 'abhi'
        ? '- Chakra corner symbols are required in centered family with character: both top corners must include circular emblems; use topic/reference-appropriate colors and glyph style.'
        : '- Keep this character-ready centered frame clean: no corner symbols/emblems in without-character mode unless explicitly requested.';
    return [
      ...shared,
      'CENTERED COSMIC HERO — tag colors + corner symbols must match uploads (not generic UI):',
      '- Top tag: **white (#FFFFFF) text** on **dark charcoal/black** strip — never grey-on-grey.',
      '- Hook tag: **black text** on the **yellow-gold gradient bar** above (not yellow text on black).',
      '- CTA tag: **white text** on **saturated red**; optional white outline on the red box — never pink/orange substitute.',
      cornerRule,
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
  if (isViralTypographicLayout(spec.layoutStyle)) {
    return [
      'BACKGROUND ROLE: support_only.',
      '- Background must amplify the viral typography, not compete with it.',
      `- Background theme: ${spec.backgroundTheme}.`,
      '- Use contrast falloff, shadow, or depth behind every text slot so it reads at 120px width.',
      '- No scenic wallpaper focal point unless the selected viral style is Photo + Outline.',
      '- Visual hierarchy: viral headline system > Abhi/support visual > CTA/micro text > background.',
      ...getBackgroundMatchRules(spec.backgroundTheme),
    ];
  }

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
  if (isViralTypographicLayout(spec.layoutStyle)) {
    return [
      'LOCKED FRAME (VIRAL TYPOGRAPHIC):',
      '- Full-bleed 1280x720. No device mockup, no outer white frame.',
      '- Generate one single thumbnail, not a collage, grid, style board, or template sheet.',
      '- Do not use the classic dark-top / yellow-gold hook / red-CTA strip stack.',
      '- Keep one dominant typographic idea readable on mobile with thick stroke/shadow where needed.',
      '- Bottom-right stays free of critical text for the YouTube duration overlay.',
    ];
  }

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
      '- Top: dark strip + yellow-gold hook bar — bar ~82–92% frame width and ~34–40% frame height (fixed template); they sit in the upper-mid vertically.',
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
  if (spec.hookLineBreakMode !== 'two_line_split' || !spec.hookLine1 || !spec.hookLine2) {
    return null;
  }
  const lines = [
    `HOOK LINE BREAK: Render the hook as exactly two stacked lines inside the **one** gold bar —`,
    `  Line 1 (upper): "${spec.hookLine1}"`,
    `  Line 2 (lower): "${spec.hookLine2}"`,
    'Do not reflow into one line. Do not change or reorder words.',
  ];
  if (spec.layoutStyle === 'centered_cosmic_hero') {
    lines.push(
      'CENTERED STACK TYPOGRAPHY (critical):',
      '- **Both lines: identical font size, weight, and cap height** — Line 2 must NOT be smaller, thinner, or “subtitle” vs Line 1.',
      '- **Horizontally center-align both lines** in the gold bar (shared vertical center axis). FORBIDDEN: Line 2 hugging the right edge, ragged-right only on line 2, or asymmetric placement.',
      '- **Vertical balance:** split the bar interior ~50/50 between the two lines with **even** top/middle/bottom padding (like ZEN MODE / PRANAYAMA two-line references).',
      '- Each line should span **~92–98% of bar width** when short words; longer words still centered as a block.',
      '- **NO DUPLICATION:** each hook word appears **exactly once**. Line 2 must NOT be repeated (e.g. never “RESET RESET”), mirrored left/right of Abhi, or painted as floating text outside the gold bar.',
    );
  }
  return lines.join('\n');
}

function getTopicCharacterWardrobeRule(spec: SobRenderSpec): string {
  switch (spec.topic) {
    case 'sleep':
    case 'anxiety_relief':
    case 'humming':
    case 'nitric_oxide':
      return '- Wardrobe color by topic: use blue/cool robes (royal blue, indigo, or deep navy tones).';
    case 'digestion':
    case 'tummo':
    case 'energy':
    case 'immunity':
      return '- Wardrobe color by topic: use warm robes (orange, saffron, maroon, or heat-aligned tones).';
    case 'morning_routine':
    case 'beginner_breathing':
      return '- Wardrobe color by topic: use warm-light robes (white, cream, or light saffron).';
    case 'chakra_balance':
      return '- Wardrobe color by topic: use balanced spiritual tones (violet, indigo, or deep blue-violet).';
    case 'pranayama':
      return '- Wardrobe color by topic: use the proven channel look for this topic (green/teal or deep blue robe depending on the chosen top strip/hook style).';
    default:
      return '- Wardrobe color by topic: align robe color with topic energy and channel precedent.';
  }
}

function getCenteredTopStripBalanceRules(spec: SobRenderSpec): string[] {
  if (spec.layoutStyle !== 'centered_cosmic_hero') return [];
  const categoryMin =
    spec.hookLineBreakMode === 'two_line_split'
      ? '**minimum cap height ~46–62px at 720h** (slightly larger than single-line hooks so “LIVE BETTER” balances a two-line gold headline)'
      : '**minimum cap height ~40–54px at 720h** (~55–72% of one line of gold-hook cap height)';
  return [
    'TOP STRIP BALANCE LOCK (centered family — category line vs hook/CTA):',
    '- Dark category strip spans **nearly full frame width** (same band as the gold hook below), never a tiny short pill floating with microscopic type.',
    `- Category (“LIVE BETTER”, etc.) size is **independent** of red CTA length: bold condensed ALL CAPS with ${categoryMin}.`,
    '- Long red CTA copy must **not** shrink the top strip: widen/tall the red tag or use two compact lines **inside the red box**; do not reduce category text to “balance” a long CTA.',
    '- Tight vertical rhythm: small gap between top strip and gold bar — avoid a tall empty gutter that makes the category feel disconnected.',
  ];
}

function getCenteredHookNoDuplicationRules(spec: SobRenderSpec): string[] {
  if (spec.layoutStyle !== 'centered_cosmic_hero') return [];
  return [
    'HOOK TEXT — NO ECHO / NO SPLIT (centered family):',
    '- The **entire** main hook (one line or two stacked lines) renders **only** inside the **single** yellow-gold rectangle. **Every** hook word appears **once** in the whole image.',
    '- FORBIDDEN: duplicating the second line beside Abhi’s head (left and right), mirrored hook words, “stereo” text, or printing the full hook string **and** the split lines as separate copies.',
    '- LEFT zone = sprout/icon/arrow only — **no** hook headline letters there. RIGHT zone = red CTA **only** — **no** hook words except inside the gold bar above.',
  ];
}

function getCenteredGoldBarFixedTemplateRules(spec: SobRenderSpec): string[] {
  if (spec.layoutStyle !== 'centered_cosmic_hero') return [];
  return [
    'GOLD HOOK BAR — FIXED TEMPLATE (centered family; match ZEN MODE / single-word PRANAYAMA mass):',
    '- The gold rectangle is a **constant billboard** — **same width and height** whether the hook is 1 word, 2 words, or stacked lines. Longer copy = more lines **inside** the box, **not** a smaller box.',
    '- **Height lock: ~34–40% of frame** (~246–292px at 720h). Do not compress this band for long phrases.',
    '- **Width lock: ~82–92% of frame** (~1050–1180px at 1280w), centered. Gold bar must be **at least as wide as** the dark top strip above — **FORBIDDEN**: gold bar narrower than the “LIVE BETTER” band.',
    '- Multi-word / long hooks: **two stacked lines** in one bar when HOOK LINE BREAK says so — **equal cap height on both lines** (~46–50% of bar interior height **each**), **center-aligned**, **50/50 vertical split**; never a small second line shoved to the right.',
    '- Single-word hook: one line uses ~88–94% of the bar interior height.',
    '- FORBIDDEN: one shrunken horizontal line cramming all words; short/narrow gold “chip”; shorter bar for 2+ words vs 1 word.',
  ];
}

function getTopicIntentVisualRules(spec: SobRenderSpec): string[] {
  switch (spec.topic) {
    case 'sleep':
    case 'anxiety_relief':
      return [
        '- Topic intent = calm relief: cooler blue/cyan highlights, softer glow, cleaner background falloff.',
        '- Support icon style: calm-wave / moon / nervous-system motif with soft bloom (not aggressive fire glow).',
      ];
    case 'nitric_oxide':
    case 'humming':
      return [
        '- Topic intent = science/biohack: crisp technical icon treatment, higher edge contrast, cleaner lines.',
        '- Support icon style: resonance/wave/pulse motifs with precise glow and controlled neon accents.',
      ];
    case 'digestion':
    case 'tummo':
    case 'energy':
    case 'immunity':
      return [
        '- Topic intent = activation/power: warmer accents, stronger contrast, brighter energy flares.',
        '- Support icon style: heat/core/body-energy motifs with punchier glow and urgency.',
      ];
    case 'pranayama':
      return [
        '- Topic intent = transformational daily practice: cosmic depth + premium clarity with strong mobile readability.',
        '- Support icon style: growth/inner-energy cue (sprout/seedling or breath-energy emblem) with clean gold rim.',
      ];
    case 'chakra_balance':
      return [
        '- Topic intent = alignment/spiritual energy: balanced purple-indigo accents and symmetric energy cues.',
      ];
    default:
      return [
        '- Topic intent: adapt icon and glow style to the emotional promise while preserving brand clarity.',
      ];
  }
}

function getCenteredCtaWordCountRules(spec: SobRenderSpec): string[] {
  if (spec.layoutStyle !== 'centered_cosmic_hero') return [];

  const ctaWords = spec.ctaText.trim().split(/\s+/).filter(Boolean).length;

  if (ctaWords <= 1) {
    return [
      'CTA SCALE LOCK (centered family, ONE-WORD CTA):',
      '- One-word CTA must be an oversized red tag (not a tiny badge): target **~22–32% frame width** (~282–410px @1280w) and **~13–19% frame height** (~94–137px @720h).',
      '- Keep CTA on a **single line** with extra-bold condensed caps; cap-height intent ~68–100px at 720h.',
      '- Keep strong white keyline and tight inner padding; maintain hierarchy under the main hook.',
    ];
  }

  return [
    'CTA SCALE LOCK (centered family, MULTI-WORD CTA):',
    '- Multi-word CTA needs a wider/taller red tag for readability: target **~26–40% frame width** (~333–512px @1280w) and **~13–20% frame height** (~94–144px @720h).',
    '- For 2 words: keep one line when possible with large condensed caps (~56–86px at 720h).',
    '- For 3+ words: allow two compact lines inside the same red box with equal weight (not tiny second line).',
    '- Never shrink category or hook to fit CTA; grow CTA box first.',
  ];
}

function getCenteredHierarchyScaleRules(spec: SobRenderSpec): string[] {
  if (spec.layoutStyle !== 'centered_cosmic_hero') return [];
  return [
    'MOBILE HIERARCHY LOCK (centered family):',
    '- Main hook text must be the primary anchor at mobile size in BOTH modes (with-character and without-character).',
    '- Aggressive size lock: hook text visual weight ≈ 2.6x–3.2x top-strip text.',
    '- Hook text must occupy about 94–98% of the yellow bar width **per line** (with safe margins).',
    '- Single-line hook: ~190–240px cap-height intent at 720h. Two-line hook: **both lines same size** — ~108–132px caps **each** at 720h (within 5% of each other); **centered** in the bar; combined fill uses the **same fixed gold bar** as single-line.',
    '- Hook bar block should feel dominant and headline-led; reject under-sized headline treatment.',
    '- CTA tag must also scale up aggressively for mobile with stronger white keyline and heavier condensed caps.',
    '- Keep hierarchy order: HOOK largest, CTA second, top strip third.',
    '- Keep readability first: no over-stylized effects that reduce letter clarity.',
  ];
}

function getCenteredCompositionProportionRules(spec: SobRenderSpec): string[] {
  if (spec.layoutStyle !== 'centered_cosmic_hero') return [];
  return [
    'COMPOSITION PROPORTION LOCK (based on sob-centered-cosmic-hero reference):',
    '- Top strip occupies roughly 10–12% of frame height.',
    '- Main hook bar occupies roughly **34–40% of frame height** — **identical** template for all hooks (1 word, 2 words, stacked).',
    '- Lower composition zone occupies roughly 36–44% for subject or reserved character slot (gold bar steals height from lower zone, not the reverse).',
    '- CTA anchor sits in right-lower third (not detached corner micro-tag), with a noticeably larger red tag footprint driven by CTA word count rules.',
    '- Support inset stays in left-lower quadrant with clear relation to hook/arrow where allowed.',
  ];
}

function getCenteredMissingElementChecklist(spec: SobRenderSpec): string[] {
  if (spec.layoutStyle !== 'centered_cosmic_hero') return [];
  return [
    'REFERENCE CHECKLIST (must include where topic/mode allows):',
    '- Corner symbol treatment in top corners according to mode/topic rules.',
    '- Support inset and arrow relationship (only when arrows are allowed).',
    '- Subject or reserved center slot with clear depth separation from background.',
    '- Background depth layers (star field + nebula + falloff), not flat wallpaper.',
    '- Controlled aura/glow effects around key focal elements without text legibility loss.',
  ];
}

function getCenteredTextReplicationRules(spec: SobRenderSpec): string[] {
  if (spec.layoutStyle !== 'centered_cosmic_hero') return [];
  return [
    'TEXT REPLICATION LOCK (follow channel reference structure):',
    '- 3-zone **visual** flow (do **not** scatter hook letters across zones): LEFT = proof icon / sprout / arrow **only** → CENTER = Abhi → RIGHT = **red CTA tag only**. **All** hook words (line 1 + line 2) stay **only** inside the **one** gold bar — never floating next to cheeks/ears or duplicated on both sides of the face.',
    '- Top strip text (category label): **full-width** dark band, about 10-12% frame height (~72-86px on 720h), bold condensed ALL CAPS — readable at mobile size even when hook or CTA text is long (do not micro-size the category).',
    '- Main hook **gold bar**: upper-middle, **~82–92% of canvas width**, **~34–40% of frame height** — same footprint as high-CTR references (e.g. ZEN MODE).',
    '- Main hook typography: ultra-bold condensed ALL CAPS, black fill on gold, strong black edge (~5-8px perceived stroke) and subtle glow. One or two stacked lines **inside** this fixed rectangle only.',
    '- **Two-line hooks:** both lines **same type size**; **center each line** horizontally; **no** right-aligned or “tagalong” second line; **no** smaller subtitle on line 2.',
    '- Main hook must be the largest readable word cluster on screen (mobile-first).',
    '- CTA tag (red button style): right mid-level, rounded rectangle, red #FF3B30 with white extra-bold condensed text and tight padding. Size must follow CTA word-count lock.',
    '- CTA text options remain short urgency phrases (e.g., TRY NOW / DO THIS DAILY / WATCH NOW).',
    '- Text depth: allow slight overlap of headline layer into subject zone for depth, while preserving legibility.',
    '- Keep spacing tight and clean: no large dead zones between top strip, hook block, and CTA.',
  ];
}

function getViralMobileFeedReadabilityRules(): string[] {
  return [
    'MOBILE FEED READABILITY:',
    '- Design for the 120px-wide mobile test: one idea must read instantly.',
    '- Maximum 1-4 large words for the primary hook unless the selected style explicitly splits before/after text.',
    '- Use ultra-bold condensed type with thick shadow, stroke, or contrast edge.',
    '- Avoid small captions, thin fonts, and low-contrast text.',
  ];
}

function getViralForbiddenRules(_spec: SobRenderSpec): string[] {
  return [
    'VIRAL STYLE FORBIDDEN RULES:',
    '- Do not use the classic School of Breath three-strip layout.',
    '- Do not use the centered cosmic wide yellow-gold hook bar.',
    '- Do not add meta words like MAIN HOOK, CTA, TEXT SLOT, LAYOUT, or SUBJECT ZONE.',
    '- Do not create small unreadable captions.',
    '- Do not add extra text beyond the approved text slots.',
    '- Do not create a collage, 3x3 grid, poster board, UI mockup, or template sheet.',
    '- Do not copy text from the reference board unless it matches the user text.',
  ];
}

function getViralTextSlotRules(spec: SobRenderSpec): string[] {
  switch (spec.layoutStyle) {
    case 'mega_word_micro_sub':
      return [
        'TEXT SLOTS:',
        `- Giant word: "${spec.mainHookText}"`,
        `- Micro subtitle / CTA: "${spec.ctaText}"`,
        '- Do not render top-strip category text in this style.',
      ];

    case 'diagonal_slash_story':
      return [
        'TEXT SLOTS:',
        `- Before / left-side phrase: "${spec.hookLine1 || spec.mainHookText}"`,
        `- After / right-side phrase: "${spec.hookLine2 || spec.ctaText}"`,
        `- CTA tag: "${spec.ctaText}" only if it does not clutter.`,
      ];

    case 'vertical_text_tower':
      return [
        'TEXT SLOTS:',
        `- Stack words from: "${spec.mainHookText}"`,
        '- Render as exactly 3 stacked headline lines when possible.',
        `- CTA tag: "${spec.ctaText}" small but readable.`,
      ];

    case 'number_badge_micro_hook':
      return [
        'TEXT SLOTS:',
        '- Number badge: use the number provided in SPECIAL NOTE if present; otherwise use the strongest relevant number.',
        `- Micro hook: "${spec.mainHookText}"`,
        `- CTA tag: "${spec.ctaText}" only if it does not clutter.`,
      ];

    case 'photo_heavy_outline_text':
      return [
        'TEXT SLOTS:',
        `- Outline word only: "${spec.mainHookText}"`,
        '- No CTA unless explicitly requested.',
        '- No top strip unless explicitly requested.',
      ];

    case 'text_behind_subject':
      return [
        'TEXT SLOTS:',
        `- Oversized background text: "${spec.mainHookText}"`,
        `- CTA bottom-left: "${spec.ctaText}"`,
      ];

    case 'dual_depth_dynamic_text':
      return [
        'TEXT SLOTS:',
        `- Backdrop phrase: "${spec.mainHookText}"`,
        '- Foreground punch: use the short front word from SPECIAL NOTE if provided.',
        `- CTA bottom-left: "${spec.ctaText}"`,
      ];

    case 'color_word_stack':
      return [
        'TEXT SLOTS:',
        `- Three-color word stack from: "${spec.mainHookText}"`,
        '- Word 1 white, Word 2 red, Word 3 gold.',
        '- Do not use a yellow hook bar.',
      ];

    case 'subject_bleed_overlap':
      return [
        'TEXT SLOTS:',
        `- Left hook text: "${spec.mainHookText}"`,
        `- CTA bottom-left: "${spec.ctaText}"`,
      ];

    default:
      return [
        'TEXT SLOTS:',
        `- Main hook text: "${spec.mainHookText}"`,
        `- CTA text: "${spec.ctaText}"`,
        `- Top strip text: "${spec.topStripText}"`,
      ];
  }
}

function getViralPanelCompositionRules(spec: SobRenderSpec): string[] {
  switch (spec.layoutStyle) {
    case 'mega_word_micro_sub':
      return [
        'PANEL MATCH LOCK (MEGA WORD):',
        '- Main white headline dominates upper half and spans most of frame width.',
        '- Abhi sits in lower half, centered or slightly right of center.',
        '- Red CTA rectangle sits lower-left and stays secondary to the headline.',
        '- Dark cinematic cosmic/fire background with warm glow behind Abhi.',
      ];
    case 'diagonal_slash_story':
      return [
        'PANEL MATCH LOCK (DIAGONAL SLASH):',
        '- Hard diagonal split from top to bottom separating problem and solution states.',
        '- Left side = stressed/problem mood, right side = calm/solution mood.',
        '- Use a clear directional arrow between states.',
        '- Keep highest contrast text blocks in center-right area of the solution side.',
      ];
    case 'vertical_text_tower':
      return [
        'PANEL MATCH LOCK (TEXT TOWER):',
        '- Build a tall left text tower: line 1 white, line 2 yellow, line 3 white.',
        '- Subject occupies right half and should feel large and close.',
        '- CTA red tag anchors bottom-left.',
      ];
    case 'number_badge_micro_hook':
      return [
        'PANEL MATCH LOCK (NUMBER BADGE):',
        '- Giant gold circular number badge dominates the left side.',
        '- Hook text stack sits to the right of the badge.',
        '- CTA red tag anchors lower-left under the hook stack.',
      ];
    case 'photo_heavy_outline_text':
      return [
        'PANEL MATCH LOCK (PHOTO + OUTLINE):',
        '- Full-bleed cinematic photo with subject centered in lower-middle.',
        '- Main word appears as huge white outline text behind subject.',
        '- Keep text minimal and avoid extra boxes.',
      ];
    case 'text_behind_subject':
      return [
        'PANEL MATCH LOCK (TEXT BEHIND SUBJECT):',
        '- Massive background word layer sits behind Abhi.',
        '- Secondary yellow word block sits below/overlapping the white word layer.',
        '- CTA red tag anchors bottom-left.',
      ];
    case 'dual_depth_dynamic_text':
      return [
        'PANEL MATCH LOCK (DUAL DEPTH DYNAMIC):',
        '- Back text layer is dark/gray and oversized.',
        '- Front punch word layer is bright and high-contrast in the foreground.',
        '- Strong depth separation between back text, subject, and front text.',
      ];
    case 'color_word_stack':
      return [
        'PANEL MATCH LOCK (COLOR WORD STACK):',
        '- Left text stack uses color hierarchy: white first word, red second word, yellow CTA line.',
        '- Subject occupies right side with warm halo/rim light.',
        '- Keep background dark with ember/cosmic texture.',
      ];
    case 'subject_bleed_overlap':
      return [
        'PANEL MATCH LOCK (SUBJECT BLEED OVERLAP):',
        '- Subject is close-up on the right and bleeds across center.',
        '- Left stacked headline remains white + yellow with red CTA strip below.',
        '- Create energetic overlap and strong foreground depth.',
      ];
    default:
      return [];
  }
}

function getViralModeRules(spec: SobRenderSpec): string[] {
  if (spec.subjectType === 'abhi') {
    return [
      'MODE RULES:',
      '- WITH CHARACTER mode.',
      '- Use the attached viral character anchor as the exact single face/profile identity source.',
      '- Use the attached selected viral style panel only for layout, typography, pose energy, lighting, and composition.',
      '- Match the same face/profile, age, hairline, skin tone, expression style, and wardrobe from the character anchor as closely as possible.',
      `- Required pose guidance: ${spec.characterPose || 'seated breath teacher pose'}.`,
      '- Do not invent a different person.',
      '- Do not beautify, de-age, or change ethnicity.',
      '- Keep eyes clearly open with a calm, alert gaze.',
      '- Keep the character visually integrated with the chosen viral layout.',
      '- Do not replace the anchor character with the panel character, a generic guru, stock-photo model, or alternate Abhi anchor.',
    ];
  }

  return [
    'MODE RULES:',
    '- WITHOUT CHARACTER mode.',
    '- No human subject, no face, no silhouette, no body parts.',
    '- Use one strong support visual only.',
    `- Support visual: ${spec.supportVisual}`,
    '- Do not add text inside the support visual zone.',
  ];
}

function getViralStyleContractRules(spec: SobRenderSpec): string[] {
  switch (spec.layoutStyle) {
    case 'mega_word_micro_sub':
      return [
        'STYLE CONTRACT: MEGA WORD',
        '- One giant primary word dominates the frame.',
        '- Tiny subtitle below.',
        '- No gold bar. No classic strip stack.',
      ];

    case 'diagonal_slash_story':
      return [
        'STYLE CONTRACT: DIAGONAL SLASH',
        '- Clear diagonal split between stressed state and calm state.',
        '- Strong before to after emotional contrast.',
        '- Do not use flat single background.',
      ];

    case 'vertical_text_tower':
      return [
        'STYLE CONTRACT: TEXT TOWER',
        '- Three stacked headline words in a left column.',
        '- Each word must read clearly on mobile.',
        '- No horizontal gold bar.',
      ];

    case 'number_badge_micro_hook':
      return [
        'STYLE CONTRACT: NUMBER BADGE',
        '- Giant circular number badge is the hero.',
        '- Micro hook supports the number.',
        '- Number must dominate at mobile size.',
      ];

    case 'photo_heavy_outline_text':
      return [
        'STYLE CONTRACT: PHOTO + OUTLINE',
        '- Full-bleed cinematic photo is the main conversion element.',
        '- Only 1-2 outline words.',
        '- No CTA strip unless explicitly requested.',
      ];

    case 'text_behind_subject':
      return [
        'STYLE CONTRACT: TEXT BEHIND SUBJECT',
        '- Oversized text behind Abhi.',
        '- Abhi overlaps and covers part of the text.',
        '- Strong depth and readable stroke.',
      ];

    case 'dual_depth_dynamic_text':
      return [
        'STYLE CONTRACT: DUAL DEPTH DYNAMIC',
        '- Back phrase behind subject.',
        '- Front punch word in front of subject.',
        '- Clear z-depth separation.',
      ];

    case 'color_word_stack':
      return [
        'STYLE CONTRACT: COLOR WORD STACK',
        '- Three stacked words: white, red, gold.',
        '- Color hierarchy replaces the gold hook bar.',
        '- Text stack must be the hero.',
      ];

    case 'subject_bleed_overlap':
      return [
        'STYLE CONTRACT: SUBJECT BLEED OVERLAP',
        '- Abhi bleeds from right past the center.',
        '- Left text reads over subject edge.',
        '- Maximum energy and overlap.',
      ];

    default:
      return [];
  }
}

function buildViralTypographicPrompt(spec: SobRenderSpec): string {
  return [
    'Create a 1280x720 mobile-first viral thumbnail for The School of Breath.',
    `Layout preset: ${spec.layoutPreset} / Layout family: ${layoutFamilyLabel(spec.layoutStyle)}.`,
    '',
    ...getLockedFrameRules(spec),
    '',
    ...getLayoutGeometryRules(spec),
    '',
    ...getViralMobileFeedReadabilityRules(),
    '',
    ...getViralStyleContractRules(spec),
    '',
    ...getViralPanelCompositionRules(spec),
    '',
    ...getViralTextSlotRules(spec),
    '',
    ...getViralForbiddenRules(spec),
    '',
    ...getBackgroundSuppressionRules(spec),
    ...getTopicIntentVisualRules(spec),
    '',
    ...getViralModeRules(spec),
    '',
    'STYLE LOCK:',
    '- Follow the selected viral style only.',
    '- Use the attached selected viral style panel for style reference, typography, contrast, and composition.',
    '- Match the selected viral style composition language closely: same hierarchy, similar block placement, and similar depth rhythm.',
    '- In WITH CHARACTER mode, keep the character/profile from the viral character anchor, not from the layout panel.',
    '- Do not add extra labels, UI words, or placeholder text.',
    spec.specialNote ? `SPECIAL NOTE: ${spec.specialNote}` : null,
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n');
}

function buildSobRenderPrompt(spec: SobRenderSpec): string {
  if (isViralTypographicLayout(spec.layoutStyle)) {
    return buildViralTypographicPrompt(spec);
  }

  return buildClassicSobPrompt(spec);
}

function buildClassicSobPrompt(spec: SobRenderSpec): string {
  const layoutGeometryRules = getLayoutGeometryRules(spec);
  const backgroundSuppressionRules = getBackgroundSuppressionRules(spec);
  const hookLineBreakRule = getHookLineBreakRule(spec);
  const topicIntentRules = getTopicIntentVisualRules(spec);

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
            '- FACE ID LOCK: keep Abhi facial structure from references (hairline/temple shape, brow thickness, eye spacing/shape, straight nose bridge, jawline, skin tone).',
            getTopicCharacterWardrobeRule(spec),
            '- Expression lock: calm-alert teacher intensity, closed mouth, focused gaze. Avoid stock-photo smile or generic model expression.',
            '- Eyes must be clearly OPEN with a calm, alert gaze and visible catchlights. Never closed eyes.',
            '- Do not beautify/de-age, do not change ethnicity, and avoid plastic skin smoothing.',
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
            '- FACE ID LOCK: keep Abhi facial structure from references (hairline/temple shape, brow thickness, eye spacing/shape, straight nose bridge, jawline, skin tone).',
            getTopicCharacterWardrobeRule(spec),
            '- Expression lock: calm-alert teacher intensity, closed mouth, focused gaze. Avoid stock-photo smile or generic model expression.',
            '- Eyes must be clearly OPEN with a calm, alert gaze and visible catchlights. Never closed eyes.',
            '- Do not beautify/de-age, do not change ethnicity, and avoid plastic skin smoothing.',
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
    ...getCenteredTopStripBalanceRules(spec),
    ...getCenteredHookNoDuplicationRules(spec),
    ...getCenteredGoldBarFixedTemplateRules(spec),
    ...getCenteredHierarchyScaleRules(spec),
    ...getCenteredCtaWordCountRules(spec),
    ...getCenteredCompositionProportionRules(spec),
    ...getCenteredTextReplicationRules(spec),
    '',
    'TEXT SLOTS:',
    `- Top strip text: "${spec.topStripText}"`,
    spec.layoutStyle === 'centered_cosmic_hero' &&
      spec.hookLineBreakMode === 'two_line_split' &&
      spec.hookLine1 &&
      spec.hookLine2
      ? `- Main hook: **only** these two lines inside the **one** gold bar (each word once in the entire image): upper "${spec.hookLine1}" / lower "${spec.hookLine2}". Do NOT also spell the full "${spec.mainHookText}" as separate floating text.`
      : `- Main hook text: "${spec.mainHookText}"`,
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
    ...topicIntentRules,
    ...getCenteredMissingElementChecklist(spec),
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

  if (isViralTypographicLayout(spec.layoutStyle)) {
    const viralSingle: SobVariant = {
      id: 'A',
      label: 'Selected viral typographic style',
      prompt: [
        basePrompt,
        spec.subjectType === 'abhi'
          ? '- Use the viral character anchor for the single character identity.'
          : '- Keep this viral render without any human character.',
        '- Match the selected viral style panel for composition language only.',
        '- Keep the School of Breath topic and approved text slots from this prompt.',
        '- Do not fall back to the classic dark/yellow/red strip system.',
      ].join('\n'),
    };

    return [viralSingle];
  }

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
        ? '- Keep the **same fixed gold bar template** as Variant A (~34–40% height, ~82–92% width); add punch only via gradient/sheen, stroke, and glow — do not change bar footprint.'
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
      '- Make the red CTA box **25–40% larger/heavier** than A with bigger text; keep white border + white text on red; **stay on the right torso** — do NOT park the CTA to the left of the sprout or only under the yellow bar’s corner.',
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
