/**
 * WCAG 2.1 contrast utilities.
 *
 * Implements relative luminance and contrast ratio per the W3C spec:
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

/**
 * Parses a 6-digit hex colour string to an [r, g, b] tuple in 0-255 range.
 * Accepts strings with or without a leading "#".
 */
export function parseHex(hex: string): [number, number, number] {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  if (clean.length !== 6) {
    throw new Error(`parseHex: expected 6-digit hex, got "${hex}"`);
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    throw new Error(`parseHex: invalid hex value "${hex}"`);
  }
  return [r, g, b];
}

/**
 * Linearizes a single 8-bit sRGB channel value to linear light.
 * Applies the IEC 61966-2-1 inverse companding function.
 */
function linearizeChannel(channel8bit: number): number {
  const sRGB = channel8bit / 255;
  return sRGB <= 0.04045
    ? sRGB / 12.92
    : Math.pow((sRGB + 0.055) / 1.055, 2.4);
}

/**
 * Calculates the relative luminance of an sRGB colour.
 * Input: [r, g, b] in 0–255 range.
 * Output: luminance in 0–1 range.
 */
export function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb;
  const R = linearizeChannel(r);
  const G = linearizeChannel(g);
  const B = linearizeChannel(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calculates the WCAG contrast ratio between two relative luminance values.
 * The lighter colour (higher luminance) is always placed in the numerator.
 */
export function contrastRatioFromLuminance(L1: number, L2: number): number {
  const lighter = Math.max(L1, L2);
  const darker  = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Calculates the WCAG contrast ratio between two 6-digit hex colours.
 * Returns a ratio value such as 4.5 (meaning 4.5:1).
 */
export function contrastRatio(foreground: string, background: string): number {
  const lFg = relativeLuminance(parseHex(foreground));
  const lBg = relativeLuminance(parseHex(background));
  return contrastRatioFromLuminance(lFg, lBg);
}

/**
 * WCAG 2.1 AA thresholds.
 */
export const WCAG_AA = {
  /** Minimum contrast ratio for normal text (< 18pt or < 14pt bold) */
  NORMAL_TEXT: 4.5,
  /** Minimum contrast ratio for large text (≥ 18pt or ≥ 14pt bold) */
  LARGE_TEXT: 3.0,
  /** Minimum contrast ratio for UI components and graphical objects */
  UI_COMPONENT: 3.0,
} as const;

export type WcagLevel = 'AA_NORMAL' | 'AA_LARGE' | 'AA_UI';

/**
 * Checks whether a foreground/background pair meets a WCAG AA threshold.
 */
export function meetsWcagAA(
  foreground: string,
  background: string,
  level: WcagLevel = 'AA_NORMAL',
): boolean {
  const ratio = contrastRatio(foreground, background);
  switch (level) {
    case 'AA_NORMAL': return ratio >= WCAG_AA.NORMAL_TEXT;
    case 'AA_LARGE':  return ratio >= WCAG_AA.LARGE_TEXT;
    case 'AA_UI':     return ratio >= WCAG_AA.UI_COMPONENT;
  }
}

export interface ContrastResult {
  foreground: string;
  background: string;
  ratio: number;
  passes: { normalText: boolean; largeText: boolean; uiComponent: boolean };
}

/**
 * Returns a full contrast audit result for a colour pair.
 */
export function auditContrast(foreground: string, background: string): ContrastResult {
  const ratio = contrastRatio(foreground, background);
  return {
    foreground,
    background,
    ratio,
    passes: {
      normalText:  ratio >= WCAG_AA.NORMAL_TEXT,
      largeText:   ratio >= WCAG_AA.LARGE_TEXT,
      uiComponent: ratio >= WCAG_AA.UI_COMPONENT,
    },
  };
}
