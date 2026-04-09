# School of Mantras Prompt Templates — Engine Reference
### v7 — Engine-Aligned (April 2026)

> Production prompts are built by `/thumbnail-engine/src/prompt-builder.ts`.
> This file is a **human reference** for the template patterns. Do NOT paste this into AI prompts.

---

## Prompt Builder Flow

1. User selects deity → loads allowed intents
2. User selects intent → loads intent color + hook pool
3. App picks hook pair (line1 + line2) from `/config/hooks.json`
4. App builds badge from deity channel name + suffix
5. App builds 2 variant prompts (emotional + intense)
6. Validator checks output

---

## Variant Rules

**Emotional:** softer expression, warm connection, subtle hand energy or third-eye glow, calmer halo
**Intense:** fiercer expression, higher contrast, stronger aura rings, heart glow or head pulse

---

## Hook Pattern Reference

| Intent | Example Split |
|--------|--------------|
| Abundance | ATTRACT YOUR / WEALTH |
| Protection | SHIELD YOURSELF / NOW |
| Healing | STOP THE / PAIN NOW |
| Love | OPEN YOUR / HEART |
| Power | RISE UP / NOW |
| Peace | FIND YOUR / PEACE |
| Knowledge | SEE MORE / CLEARLY |
| Transformation | BREAK FREE / TODAY |
