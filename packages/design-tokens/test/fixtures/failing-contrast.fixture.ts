/**
 * Fixture: colour pairs that FAIL WCAG 2.1 AA contrast requirements.
 *
 * Used to verify that auditContrast() and meetsWcagAA() correctly identify
 * non-compliant pairings. These are NOT design system tokens — they are
 * synthetic negative-test values only.
 */

export interface FailingContrastPair {
  label: string;
  foreground: string;
  background: string;
  /** Approximate contrast ratio (rounded to 2dp) for documentation purposes */
  approximateRatio: number;
}

/**
 * Pairs that fail WCAG AA normal-text threshold (4.5:1).
 * Pair: neutral-400 (#a0a0ab) on neutral-300 (#d1d1d6) ≈ 1.71:1
 */
export const FAILING_NORMAL_TEXT_PAIRS: ReadonlyArray<FailingContrastPair> = [
  {
    label: 'neutral-400 on neutral-300 (insufficient contrast)',
    foreground: '#a0a0ab',  // NEUTRAL['400']
    background: '#d1d1d6',  // NEUTRAL['300']
    approximateRatio: 1.71,
  },
  {
    label: 'neutral-500 on neutral-400 (insufficient contrast)',
    foreground: '#70707b',  // NEUTRAL['500']
    background: '#a0a0ab',  // NEUTRAL['400']
    approximateRatio: 1.75,
  },
] as const;

/**
 * Pairs that fail WCAG AA large-text threshold (3:1) as well.
 */
export const FAILING_LARGE_TEXT_PAIRS: ReadonlyArray<FailingContrastPair> = [
  {
    label: 'neutral-300 on neutral-200 (fails even 3:1)',
    foreground: '#d1d1d6',  // NEUTRAL['300']
    background: '#e4e4e7',  // NEUTRAL['200']
    approximateRatio: 1.21,
  },
] as const;
