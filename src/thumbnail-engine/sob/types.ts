export type SobClassicLayoutStyle =
  | 'giant_hook_left'
  | 'balanced_subject_right'
  | 'centered_cosmic_hero';

export type SobViralLayoutStyle =
  | 'mega_word_micro_sub'
  | 'diagonal_slash_story'
  | 'vertical_text_tower'
  | 'number_badge_micro_hook'
  | 'photo_heavy_outline_text'
  | 'text_behind_subject'
  | 'dual_depth_dynamic_text'
  | 'color_word_stack'
  | 'subject_bleed_overlap';

export type SobLayoutStyle = SobClassicLayoutStyle | SobViralLayoutStyle;

export type SobMode = 'with_character' | 'without_character';

export type SobTopicKey =
  | 'pranayama'
  | 'tummo'
  | 'humming'
  | 'morning_routine'
  | 'sleep'
  | 'nitric_oxide'
  | 'digestion'
  | 'anxiety_relief'
  | 'energy'
  | 'immunity'
  | 'chakra_balance'
  | 'beginner_breathing';

export interface SobTopicConfig {
  label: string;
  topLine: string;
  cta: string;
  supportVisual: string;
  backgroundTheme: string;
  visualBadgeType: string;
  arrowAllowed: boolean;
  characterPose: string;
  accent: string;
  textSide: 'left' | 'right';
  characterSide: 'left' | 'right';
  hooks: [string, string, string] | string[];
}

export interface SobStyleConfig {
  brand: string;
  layout: {
    textZoneWidth: string;
    characterZoneWidth: string;
    textSide: 'left' | 'right';
    characterSide: 'left' | 'right';
    textStack: string;
    noFloatingText: boolean;
  };
  template: {
    topStrip: string;
    mainBlock: string;
    ctaBlock: string;
    supportBadge: string;
  };
  text: {
    maxWords: number;
    fontStyle: string;
    mobilePriority: boolean;
    mainIdeaOnly: boolean;
  };
  colors: {
    core: string[];
    accents: Record<string, string>;
  };
  characterRules: {
    mode: string;
    preserveIdentity: boolean;
    forbidGenericPeople: boolean;
  };
  noCharacterRules: {
    forbidPeople: boolean;
    singleSupportVisual: boolean;
    forbidExtraTextInVisualZone: boolean;
  };
  variantSystem: {
    A: string;
    B?: string;
  };
}

export interface SobPromptInput {
  title: string;
  topic: SobTopicKey;
  mode: SobMode;
  hook: string;
  topStripOverride?: string;
  ctaOverride?: string;
  specialNote?: string;
  layoutStyle?: SobLayoutStyle;
}

export interface SobPromptContext {
  topic: SobTopicConfig;
  style: SobStyleConfig;
}

export interface SobVariant {
  id: 'A' | 'B';
  label: string;
  prompt: string;
}

export interface SobValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
