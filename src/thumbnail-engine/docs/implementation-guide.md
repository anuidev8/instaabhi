# School of Mantras Thumbnail Engine — Implementation Guide

## Architecture

One single source of truth: `/config/core-rules.json`

All other files supply **structured data only** — no file redefines layout, text rules,
word count, aura behavior, or badge policy.

## Folder Map

| Path | Purpose |
|------|---------|
| `config/core-rules.json` | Master truth — layout, text, color, bans |
| `config/deities.json` | Deity data — channel name, aura, visual signature, allowed intents |
| `config/intents.json` | Intent rules — color, mood |
| `config/hooks.json` | Approved 2-line hook phrases per intent |
| `templates/system-prompt.md` | Short system instruction for Gemini |
| `templates/request-template.md` | Input format the app fills |
| `templates/variant-template.md` | Emotional vs Intense variant rules |
| `src/prompt-builder.ts` | Combines deity + intent + hook + variant into one clean prompt |
| `src/validator.ts` | Checks layout, contrast, text hierarchy |
| `src/types.ts` | TypeScript types for the engine |
| `archive/` | Original files preserved for reference, no longer used in production |

## Prompt Builder Flow

1. User selects deity
2. App loads allowed intents for that deity
3. User selects intent
4. App pulls matching intent color
5. App pulls approved hook options for that intent
6. App builds line1 and line2
7. App builds badge using deity channel name + suffix
8. App builds two variants (emotional + intense)
9. App sends final prompt to image generator
10. Validator checks layout and contrast

## Key Rules

- 3-5 words total, split across 2 lines
- Line 1 = command/action, WHITE, 30-40% bigger
- Line 2 = emotion/promise, COLORED from intent
- Deity aura = deity-specific, NOT always gold
- Right side = ultra-dark empty space
- ONE subtle visual trigger only
- Two meaningfully different variants per generation
