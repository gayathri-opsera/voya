/**
 * Primitive border-radius ramp — INTERNAL to @voya/design-tokens.
 * PROVISIONAL.
 */

export const RADII = {
  'none':  '0px',
  'sm':    '2px',
  'base':  '4px',
  'md':    '6px',
  'lg':    '8px',
  'xl':    '12px',
  '2xl':   '16px',
  '3xl':   '24px',
  'full':  '9999px',
} as const;

export type RadiiKey = keyof typeof RADII;
