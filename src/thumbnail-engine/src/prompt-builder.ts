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

  const variantDescription =
    input.variant === 'intense'
      ? 'fiercer expression, stronger aura rings, more dramatic lighting, one intense visual trigger'
      : 'softer expression, warm emotional connection, one subtle visual trigger';

  return `Generate a School of Mantras viral thumbnail.

Canvas: ${coreRules.canvas.width}x${coreRules.canvas.height}, ${coreRules.canvas.aspect}

Layout:
- deity on ${coreRules.layout.deityZone}
- text on ${coreRules.layout.textZone}
- deity faces toward text
- no center composition

Character:
- extreme close-up
- face fills ${coreRules.character.faceFill}
- face + one blessing hand only
- no lower body
- no wide shot
- photorealistic cinematic devotional
- use these visual signature elements: ${deity.visualSignature.join(', ')}

Color:
- deity aura color: ${deity.auraColor}
- intent text color: ${intent.color}

Background:
- deep dark gradient
- no scenery
- no architecture
- ultra-dark empty text area
- no particles or glow behind text

Text baked into image:
- top tiny label: THE SCHOOL OF MANTRAS
- line 1: ${hook.line1}
- line 2: ${hook.line2}
- bottom badge: ${badge}
- line 1 white and dominant
- line 2 colored ${intent.color}
- strong drop shadow

Variant:
- ${variantDescription}

Do not use cartoon, illustration, painting, center composition, clutter, generic text, or both-lines-white.`;
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
    `- line1 = command/action (WHITE, DOMINANT)`,
    `- line2 = emotion/promise (COLORED ${intent.color}, smaller)`,
    `- NEVER leave line2 empty`,
    `- NEVER fewer than 3 words total`,
    `- STRONG drop shadow on both lines`,
    `- Generate 2 meaningfully different variant prompts`,
  ]
    .filter(Boolean)
    .join('\n');
}
