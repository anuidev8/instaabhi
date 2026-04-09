import {
  getSchoolOfBreathColorSystem,
  getSchoolOfBreathDefaultCategory,
  getSchoolOfBreathQuickPicks,
  isValidSchoolOfBreathCategory,
  isValidSchoolOfBreathHookFamily,
  SchoolOfBreathCategory,
  SchoolOfBreathHookFamily,
  SchoolOfBreathMode,
} from './quick-picks';

export interface SchoolOfBreathPromptInput {
  title: string;
  category: SchoolOfBreathCategory;
  mode: SchoolOfBreathMode;
  hookFamily: SchoolOfBreathHookFamily;
  mainHook: string;
  topLine?: string;
  bottomStrip?: string;
  supportVisual?: string;
  colorEmphasis?: string;
  backgroundStyle?: string;
  specialNote?: string;
}

export interface ValidatedSchoolOfBreathInput extends SchoolOfBreathPromptInput {
  topLine: string;
  bottomStrip: string;
  supportVisual: string;
  colorEmphasis: string;
  backgroundStyle: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalized: ValidatedSchoolOfBreathInput;
}

function normalizeText(value: string | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function wordCount(value: string): number {
  return normalizeText(value).split(' ').filter(Boolean).length;
}

function removeDuplicatePunctuation(value: string): string {
  return value.replace(/[!?.,]{2,}/g, (m) => m.slice(0, 1));
}

export function validateSchoolOfBreathInput(input: SchoolOfBreathPromptInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const fallbackCategory = getSchoolOfBreathDefaultCategory();
  const category = isValidSchoolOfBreathCategory(input.category) ? input.category : fallbackCategory;
  const quickPicks = getSchoolOfBreathQuickPicks(category, input.hookFamily);

  const normalizedMainHook = removeDuplicatePunctuation(normalizeText(input.mainHook)).toUpperCase();
  const normalizedTopLine = removeDuplicatePunctuation(normalizeText(input.topLine)).toUpperCase();
  const normalizedBottomStrip = removeDuplicatePunctuation(normalizeText(input.bottomStrip)).toUpperCase();
  const normalizedTitle = normalizeText(input.title);

  const mode: SchoolOfBreathMode = input.mode === 'without_character' ? 'without_character' : 'with_character';
  const hookFamily = isValidSchoolOfBreathHookFamily(input.hookFamily)
    ? input.hookFamily
    : quickPicks.hookFamilies[0];

  const supportVisual = normalizeText(input.supportVisual) || quickPicks.supportVisuals[0] || 'lungs';
  const colorEmphasis = normalizeText(input.colorEmphasis) || quickPicks.colorEmphasis[0] || 'dark_yellow';
  const backgroundStyle = normalizeText(input.backgroundStyle) || quickPicks.backgroundStyles[0];

  const colors = getSchoolOfBreathColorSystem();

  if (!normalizedTitle) {
    errors.push('Video title is required.');
  }

  const mainHookWords = wordCount(normalizedMainHook);
  if (mainHookWords < 2 || mainHookWords > 5) {
    errors.push('Main hook must be between 2 and 5 words.');
  }

  if (normalizedTopLine && wordCount(normalizedTopLine) > 4) {
    errors.push('Top line should be 4 words or fewer.');
  }

  if (normalizedBottomStrip && wordCount(normalizedBottomStrip) > 5) {
    errors.push('Bottom strip should be 5 words or fewer.');
  }

  if (/[,&/]/.test(supportVisual)) {
    errors.push('Use exactly one support visual.');
  }

  if (mode === 'without_character') {
    const forbiddenPeopleTerms = /\b(abhi|person|portrait|face|teacher|man|woman)\b/i;
    if (forbiddenPeopleTerms.test(supportVisual) || forbiddenPeopleTerms.test(backgroundStyle)) {
      errors.push('Without-character mode cannot include person references.');
    }
  }

  if (!colors[colorEmphasis]) {
    errors.push(`Unknown color emphasis: ${colorEmphasis}`);
  }

  if (!normalizedTopLine) {
    warnings.push('Top line was empty; a default context line was applied.');
  }

  if (!normalizedBottomStrip) {
    warnings.push('Bottom strip was empty; a default urgency strip was applied.');
  }

  const normalized: ValidatedSchoolOfBreathInput = {
    title: normalizedTitle,
    category,
    mode,
    hookFamily,
    mainHook: normalizedMainHook,
    topLine: normalizedTopLine || quickPicks.topLines[0] || 'BREATH PROTOCOL',
    bottomStrip: normalizedBottomStrip || quickPicks.bottomStrips[0] || 'WATCH NOW',
    supportVisual,
    colorEmphasis,
    backgroundStyle,
    specialNote: normalizeText(input.specialNote),
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    normalized,
  };
}
