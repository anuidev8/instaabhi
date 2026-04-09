import { SobPromptContext, SobPromptInput, SobTopicKey } from './types';

export type SobRenderSpec = {
  layoutPreset: 'sob-channel-hard-stack';
  mode: 'with_character' | 'without_character';
  topic: SobTopicKey;
  topStripText: string;
  mainHookText: string;
  ctaText: string;
  textSide: 'left' | 'right';
  subjectSide: 'left' | 'right';
  supportVisual: string;
  visualBadgeType: string;
  arrowAllowed: boolean;
  backgroundTheme: string;
  accentColor: string;
  subjectType: 'abhi' | 'support_visual';
  characterPose?: string;
  title: string;
  isChannelProvenHook: boolean;
  specialNote?: string;
};

function normalizeOptionalText(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized.toUpperCase() : undefined;
}

export function buildSobRenderSpec(
  input: SobPromptInput,
  context: SobPromptContext,
  options?: { isChannelProvenHook?: boolean }
): SobRenderSpec {
  const topStripOverride = normalizeOptionalText(input.topStripOverride);
  const ctaOverride = normalizeOptionalText(input.ctaOverride);
  const mainHookText = input.hook.trim().toUpperCase();

  return {
    layoutPreset: 'sob-channel-hard-stack',
    mode: input.mode,
    topic: input.topic,
    topStripText: topStripOverride || context.topic.topLine,
    mainHookText,
    ctaText: ctaOverride || context.topic.cta,
    textSide: context.topic.textSide,
    subjectSide: context.topic.characterSide,
    supportVisual: context.topic.supportVisual,
    visualBadgeType: context.topic.visualBadgeType,
    arrowAllowed: context.topic.arrowAllowed,
    backgroundTheme: context.topic.backgroundTheme,
    accentColor: context.topic.accent,
    subjectType: input.mode === 'with_character' ? 'abhi' : 'support_visual',
    characterPose: input.mode === 'with_character' ? context.topic.characterPose : undefined,
    title: input.title.trim(),
    isChannelProvenHook: Boolean(options?.isChannelProvenHook),
    specialNote: input.specialNote?.trim() || undefined,
  };
}
