import coreRules from '../config/core-rules.json';
import type { ValidationResult, ThumbnailMeta } from './types';

export function validateThumbnailMeta(meta: ThumbnailMeta): ValidationResult {
  const errors: string[] = [];

  if (meta.width !== coreRules.canvas.width || meta.height !== coreRules.canvas.height) {
    errors.push(`Canvas must be ${coreRules.canvas.width}x${coreRules.canvas.height}`);
  }

  if (meta.brightestSide !== 'left') {
    errors.push('Brightest visual signal must be on the left side');
  }

  if (!meta.rightSideClean) {
    errors.push('Right text side must stay dark and uncluttered');
  }

  if (meta.mainTextLineCount !== coreRules.text.lineCount) {
    errors.push(`Main hook must have exactly ${coreRules.text.lineCount} lines`);
  }

  if (!meta.line1LargerThanLine2) {
    errors.push('Line 1 must be larger than line 2');
  }

  if (!meta.line1IsWhite) {
    errors.push(`Line 1 must be white (${coreRules.text.line1.color})`);
  }

  if (!meta.line2MatchesIntentColor) {
    errors.push('Line 2 color must match intent accent color');
  }

  return {
    pass: errors.length === 0,
    errors,
  };
}

/**
 * Pixel-level heuristic validation run against a canvas ImageData.
 * Returns a normalized 1280x720 data URL plus pass/fail with notes.
 */
export function validateImageData(
  imageData: ImageData,
  targetWidth: number,
  targetHeight: number
): {
  isValid: boolean;
  notes: string[];
  leftHeroSignal: number;
  rightTextSignal: number;
  averageLuminance: number;
} {
  const { data, width, height } = imageData;

  let totalLuminance = 0;
  let sampleCount = 0;
  let leftSignal = 0;
  let leftSamples = 0;
  let centerSignal = 0;
  let centerSamples = 0;
  let rightTextSignal = 0;
  let rightSamples = 0;

  for (let y = 0; y < height; y += 6) {
    for (let x = 0; x < width; x += 6) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      const { h, s, l } = rgbToHsl(r, g, b);
      const brightSignal = luminance >= 170 ? 1 : 0;
      const isAccent = s >= 0.25 && l >= 0.28 ? 1 : 0;
      const isWhiteText = s <= 0.16 && l >= 0.72 ? 1 : 0;
      const textSignal = isWhiteText + isAccent + brightSignal;

      totalLuminance += luminance;
      sampleCount += 1;

      if (x < width * 0.4) {
        leftSamples += 1;
        leftSignal += isAccent + brightSignal * 0.45;
      } else if (x > width * 0.6) {
        rightSamples += 1;
        rightTextSignal += textSignal;
      } else {
        centerSamples += 1;
        centerSignal += isAccent + brightSignal * 0.35;
      }
    }
  }

  const averageLuminance = totalLuminance / Math.max(sampleCount, 1);
  const leftHero = leftSignal / Math.max(leftSamples, 1);
  const rightText = rightTextSignal / Math.max(rightSamples, 1);
  const centerBusy = centerSignal / Math.max(centerSamples, 1);

  const isDarkEnough = averageLuminance <= 135;
  const hasLeftHero = leftHero >= 0.08;
  const hasRightText = rightText >= 0.03;
  const rightIsClean = rightText <= 0.85;
  const notCentered = centerBusy <= leftHero * 1.15;

  const notes: string[] = [
    isDarkEnough ? 'Dark background passed.' : 'Background brighter than guide allows.',
    hasLeftHero ? 'Left-side deity signal passed.' : 'Left-side deity emphasis weak.',
    hasRightText ? 'Right-side text detected.' : 'Right-side text may be missing.',
    rightIsClean ? 'Right-side composition clean.' : 'Right side has strong visual signal.',
    notCentered ? 'No center composition detected.' : 'Image may drift toward centered layout.',
  ];

  return {
    isValid: isDarkEnough && hasLeftHero && hasRightText && notCentered,
    notes,
    leftHeroSignal: leftHero,
    rightTextSignal: rightText,
    averageLuminance,
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s, l };
}
