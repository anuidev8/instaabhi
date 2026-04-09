export type IntentKey =
  | 'abundance'
  | 'protection'
  | 'healing'
  | 'love'
  | 'power'
  | 'peace'
  | 'knowledge'
  | 'transformation';

export interface DeityConfig {
  channelName: string;
  auraColor: string;
  visualSignature: string[];
  intents: IntentKey[];
}

export interface IntentConfig {
  color: string;
  mood: string;
}

export interface HookPair {
  line1: string;
  line2: string;
}

export interface BuildInput {
  deity: string;
  intent: IntentKey;
  hookIndex?: number;
  suffix?: string;
  variant?: 'emotional' | 'intense';
  title?: string;
}

export interface ValidationResult {
  pass: boolean;
  errors: string[];
}

export interface ThumbnailMeta {
  width: number;
  height: number;
  brightestSide: 'left' | 'right';
  rightSideClean: boolean;
  mainTextLineCount: number;
  line1LargerThanLine2: boolean;
  line1IsWhite: boolean;
  line2MatchesIntentColor: boolean;
}

export type DeityMap = Record<string, DeityConfig>;
export type IntentMap = Record<IntentKey, IntentConfig>;
export type HookMap = Record<IntentKey, HookPair[]>;
