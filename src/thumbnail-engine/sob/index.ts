import hooksData from './hooks.json';
import styleData from './style.json';
import topicsData from './topics.json';
import { getAbhiReferenceImageUrls, ABHI_REFERENCE_IMAGES, filterAbhiReferencesByTags } from './abhiReferences';
import { buildSobBasePrompt, buildSobPromptVariants } from './promptBuilder';
import { DEFAULT_SOB_VARIANT_COUNT, getSobVariantPrompts } from './variants';
import { validateSobInput } from './validator';
import {
  SobMode,
  SobPromptContext,
  SobPromptInput,
  SobStyleConfig,
  SobTopicConfig,
  SobTopicKey,
  SobVariant,
} from './types';

const style = styleData as SobStyleConfig;
const topics = topicsData as Record<SobTopicKey, SobTopicConfig>;
const hooks = hooksData as {
  families: {
    safe: string[];
    aggressive: string[];
    curiosity: string[];
  };
};

export type { SobMode, SobPromptContext, SobPromptInput, SobTopicConfig, SobTopicKey, SobVariant };

export function getSobStyle(): SobStyleConfig {
  return style;
}

export function getSobTopics(): Array<{ key: SobTopicKey; label: string }> {
  return (Object.keys(topics) as SobTopicKey[]).map((key) => ({ key, label: topics[key].label }));
}

export function getSobDefaultTopic(): SobTopicKey {
  return (Object.keys(topics)[0] as SobTopicKey) || 'pranayama';
}

export function getSobTopicConfig(topic: SobTopicKey): SobTopicConfig {
  return topics[topic] ?? topics[getSobDefaultTopic()];
}

export function getSobHookOptions(topic: SobTopicKey): [string, string, string] {
  const config = getSobTopicConfig(topic);
  const topicHooks = (config.hooks ?? []).slice(0, 3);
  const fallback = [hooks.families.safe[0], hooks.families.aggressive[0], hooks.families.curiosity[0]];

  const result = [
    topicHooks[0] || fallback[0] || 'BOOST YOUR ENERGY',
    topicHooks[1] || fallback[1] || 'NEVER GET SICK AGAIN',
    topicHooks[2] || fallback[2] || 'NO ONE TALKS ABOUT THIS',
  ] as [string, string, string];

  return result;
}

export function getSobDefaultMode(topic: SobTopicKey): SobMode {
  const key = topic.toLowerCase();
  if (key.includes('nitric') || key.includes('energy')) return 'without_character';
  return 'with_character';
}

export function getSobPromptContext(topic: SobTopicKey): SobPromptContext {
  return {
    style,
    topic: getSobTopicConfig(topic),
  };
}

export {
  ABHI_REFERENCE_IMAGES,
  getAbhiReferenceImageUrls,
  filterAbhiReferencesByTags,
  buildSobBasePrompt,
  buildSobPromptVariants,
  getSobVariantPrompts,
  validateSobInput,
  DEFAULT_SOB_VARIANT_COUNT,
};
