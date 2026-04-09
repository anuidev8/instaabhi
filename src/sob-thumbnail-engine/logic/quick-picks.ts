import categoriesData from '../data/categories.json';
import colorSystemData from '../data/color-system.json';
import hookPatternsData from '../data/hook-patterns.json';
import supportVisualsData from '../data/support-visuals.json';
import { SchoolOfBreathCategory, SchoolOfBreathHookFamily, SchoolOfBreathMode } from '../../types';

export type { SchoolOfBreathCategory, SchoolOfBreathHookFamily, SchoolOfBreathMode };

interface CategoryConfig {
  label: string;
  defaultMode: SchoolOfBreathMode;
  hookFamilies: SchoolOfBreathHookFamily[];
  supportVisuals: string[];
  colorEmphasis: string[];
  topLines: string[];
  bottomStrips: string[];
}

type CategoryMap = Record<SchoolOfBreathCategory, CategoryConfig>;
type HookMap = Record<SchoolOfBreathHookFamily, string[]>;

const categories = categoriesData as CategoryMap;
const hookPatterns = hookPatternsData as HookMap;
const colorSystem = colorSystemData as Record<
  string,
  { label: string; primary: string; secondary: string; accent: string; usage: string }
>;
const supportVisuals = supportVisualsData as string[];

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

export interface SchoolOfBreathQuickPicks {
  category: SchoolOfBreathCategory;
  categoryLabel: string;
  recommendedMode: SchoolOfBreathMode;
  hookFamilies: SchoolOfBreathHookFamily[];
  hooks: string[];
  topLines: string[];
  bottomStrips: string[];
  supportVisuals: string[];
  colorEmphasis: string[];
  backgroundStyles: string[];
}

export function getSchoolOfBreathCategories(): Array<{
  key: SchoolOfBreathCategory;
  label: string;
  defaultMode: SchoolOfBreathMode;
}> {
  return (Object.keys(categories) as SchoolOfBreathCategory[]).map((key) => ({
    key,
    label: categories[key].label,
    defaultMode: categories[key].defaultMode,
  }));
}

export function getSchoolOfBreathDefaultCategory(): SchoolOfBreathCategory {
  return (Object.keys(categories)[0] as SchoolOfBreathCategory) || 'technique';
}

export function getSchoolOfBreathQuickPicks(
  categoryKey: SchoolOfBreathCategory,
  hookFamily?: SchoolOfBreathHookFamily
): SchoolOfBreathQuickPicks {
  const category = categories[categoryKey] ?? categories[getSchoolOfBreathDefaultCategory()];
  const family = hookFamily && category.hookFamilies.includes(hookFamily)
    ? hookFamily
    : category.hookFamilies[0];

  const hooks = hookPatterns[family] ?? [];
  const categorySupportVisuals = dedupe([...category.supportVisuals, ...supportVisuals]);
  const validColorKeys = category.colorEmphasis.filter((key) => Boolean(colorSystem[key]));

  return {
    category: categoryKey,
    categoryLabel: category.label,
    recommendedMode: category.defaultMode,
    hookFamilies: category.hookFamilies,
    hooks,
    topLines: category.topLines,
    bottomStrips: category.bottomStrips,
    supportVisuals: categorySupportVisuals.slice(0, 8),
    colorEmphasis: validColorKeys,
    backgroundStyles: [
      'ultra-dark gradient',
      'yellow-black bold panel',
      'science blue panel',
      'fire heat texture',
      'clean contrast studio',
    ],
  };
}

export function isValidSchoolOfBreathCategory(value: string): value is SchoolOfBreathCategory {
  return Object.prototype.hasOwnProperty.call(categories, value);
}

export function isValidSchoolOfBreathHookFamily(value: string): value is SchoolOfBreathHookFamily {
  return Object.prototype.hasOwnProperty.call(hookPatterns, value);
}

export function getSchoolOfBreathHookPatterns(): HookMap {
  return hookPatterns;
}

export function getSchoolOfBreathColorSystem(): typeof colorSystem {
  return colorSystem;
}
