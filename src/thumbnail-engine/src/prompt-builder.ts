import coreRules from '../config/core-rules.json';
import deitiesConfig from '../config/deities.json';
import intentsConfig from '../config/intents.json';
import hooksConfig from '../config/hooks.json';
import type {
  BuildInput,
  DeityConfig,
  DeityMap,
  HookMap,
  HookPair,
  IntentConfig,
  IntentKey,
  IntentMap,
} from './types';

const deities = deitiesConfig as DeityMap;
const intents = intentsConfig as IntentMap;
const hooks = hooksConfig as HookMap;

export { coreRules, deities, intents, hooks };

export function getDeity(name: string): DeityConfig & { name: string } {
  const normalized = name.trim();
  const entry = deities[normalized];
  if (entry) return { ...entry, name: normalized };

  const lower = normalized.toLowerCase();
  for (const [key, config] of Object.entries(deities)) {
    if (
      key.toLowerCase() === lower ||
      config.channelName.toLowerCase() === lower
    ) {
      return { ...config, name: key };
    }
  }

  throw new Error(`Unsupported deity: ${name}`);
}

export function getIntent(key: IntentKey): IntentConfig {
  const intent = intents[key];
  if (!intent) throw new Error(`Unsupported intent: ${key}`);
  return intent;
}

export function getHooks(intentKey: IntentKey): HookPair[] {
  return hooks[intentKey] ?? [];
}

export function getHook(intentKey: IntentKey, index = 0): HookPair {
  const pool = getHooks(intentKey);
  return pool[index] ?? pool[0] ?? { line1: 'FEEL', line2: 'NOW' };
}

export function getAllowedIntents(deityName: string): IntentKey[] {
  const deity = getDeity(deityName);
  return deity.intents;
}

export function getDeitiesForIntent(intentKey: IntentKey): string[] {
  return Object.entries(deities)
    .filter(([, config]) => config.intents.includes(intentKey))
    .map(([name]) => name);
}

export function buildBadge(deity: DeityConfig, suffix = '108x'): string {
  return `${deity.channelName} Mantra · ${suffix}`;
}

export function buildThumbnailPrompt(input: BuildInput): string {
  const deity = getDeity(input.deity);
  const intent = getIntent(input.intent);
  const hook = getHook(input.intent, input.hookIndex);
  const suffix = input.suffix ?? '108x';
  const badge = buildBadge(deity, suffix);

  const allWords = `${hook.line1} ${hook.line2}`.split(/\s+/).map((w) => w.toUpperCase());
  const stackedWordList = allWords.join('", "');

  const variantDescription =
    input.variant === 'intense'
      ? 'fiercer expression, dramatic rim-light, higher contrast, one intense visual trigger'
      : 'softer devotional expression, warm emotional connection, one subtle visual trigger';

  return `Generate a School of Mantras viral YouTube thumbnail.

Canvas: ${coreRules.canvas.width}x${coreRules.canvas.height}, ${coreRules.canvas.aspect}

Layout:
- deity on ${coreRules.layout.deityZone}
- text on ${coreRules.layout.textZone}
- no center composition

Character:
- extreme close-up
- face fills ${coreRules.character.faceFill}
- face + one blessing hand only
- no lower body, no wide shot
- photorealistic cinematic devotional
- visual signature: ${deity.visualSignature.join(', ')}

Color:
- deity aura color: ${deity.auraColor}
- intent text color: ${intent.color}

Background:
- dark atmospheric smoke/mist gradient — NOT bright glowing circles or rings
- no scenery, no architecture
- subtle rim-light and atmospheric haze in ${deity.auraColor} — NOT prominent concentric rings
- ultra-dark pure black behind text area
- no particles, no glow, no bloom behind text

TEXT — MOST CRITICAL (billboard-scale, 3D extruded):
- top: "THE SCHOOL OF MANTRAS" — tiny, thin, subtle white
- MAIN HOOK — each word stacked vertically on its own line, filling 85-95% of right zone HEIGHT — use the FULL vertical space:
  "${stackedWordList}"
- SIZE HIERARCHY: FIRST WORD ("${allWords[0]}") is the ABSOLUTE BIGGEST element in the image — 20-30% bigger than the second word
- The first word EXTENDS LEFT past the text zone, overlapping INTO the deity area — NO empty gap between deity and text
- Remaining line-1 words ("${hook.line1}"): WHITE #FFFFFF, large but slightly smaller than first word
- line 2 words ("${hook.line2}"): colored ${intent.color}, 40-50% smaller than first word
- font: ultra-heavy black condensed (weight 900+), wide compressed letterforms
- 3D EXTRUDED text effect: thick black drop-shadow (8-12px offset) creating cinematic depth/pop-out look
- bottom: "${badge}" — small, understated white
- every word must be readable at phone thumbnail size (120x68px)

3D PARALLAX DEPTH LAYERING (CRITICAL):
- BACK layer: dark atmospheric background
- MID layer: the main hook text — first word extends LEFT into deity zone with NO gap
- FRONT layer: deity accessories (hand, snake, jewelry) overlap ON TOP of the first word's left portion, covering first 1-2 letters
- ALSO: the colored line-2 text ("${hook.line2}") overlaps ON TOP of the deity's lower body/torso
- IMPORTANT: text and deity SHARE the same horizontal space — do NOT leave a clean gap between them

Variant:
- ${variantDescription}

BANNED: cartoon, illustration, painting, center composition, clutter, generic text, both-lines-white, small text, thin fonts, bright concentric circles, text glow/bloom, flat 2D text without shadow depth.`;
}

/**
 * Builds a structured brief for Gemini text planning (the step that returns
 * line1/line2/badge/variantPrompts JSON). Intentionally short — no giant
 * documents, only the structured values the model needs.
 */
export function buildPromptBrief(input: BuildInput): string {
  const deity = getDeity(input.deity);
  const intent = getIntent(input.intent);
  const hookPool = getHooks(input.intent);
  const suffix = input.suffix ?? '108x';
  const badge = buildBadge(deity, suffix);

  const hookExamples = hookPool
    .map((h) => `line1="${h.line1}" + line2="${h.line2}"`)
    .join(' | ');

  return [
    `Deity: ${input.deity}`,
    `Channel name: ${deity.channelName}`,
    `Intent: ${input.intent}`,
    `Intent mood: ${intent.mood}`,
    `Visual signature: ${deity.visualSignature.join(', ')}`,
    `Deity aura color: ${deity.auraColor}`,
    `Intent text color (line 2): ${intent.color}`,
    input.title ? `YouTube title: ${input.title}` : null,
    ``,
    `Approved hook pairs: ${hookExamples}`,
    `Badge: "${badge}"`,
    `School label: "THE SCHOOL OF MANTRAS"`,
    ``,
    `RULES:`,
    `- 3-5 words total split across line1 + line2`,
    `- line1 = command/action (WHITE, DOMINANT, 50-60% bigger than line2)`,
    `- line2 = emotion/promise (COLORED ${intent.color}, very large but smaller)`,
    `- NEVER leave line2 empty`,
    `- NEVER fewer than 3 words total`,
    `- Each word stacked vertically like a billboard — fills 80-90% of right zone height`,
    `- Font: ultra-heavy black condensed (weight 900+)`,
    `- 3D extruded text: thick black drop-shadow creating cinematic depth/pop-out look`,
    `- Background: dark atmospheric smoke/mist — NOT bright glowing circles`,
    `- Generate exactly 1 image prompt combining emotional depth with cinematic intensity`,
  ]
    .filter(Boolean)
    .join('\n');
}
