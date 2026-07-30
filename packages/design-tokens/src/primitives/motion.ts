/**
 * Primitive motion / animation ramp — INTERNAL to @voya/design-tokens.
 * PROVISIONAL.
 */

export const DURATION = {
  'instant':  '0ms',
  'fast':     '100ms',
  'normal':   '200ms',
  'slow':     '300ms',
  'slower':   '400ms',
  'slowest':  '500ms',
} as const;

export const EASING = {
  'linear':      'linear',
  'ease-in':     'cubic-bezier(0.4, 0, 1, 1)',
  'ease-out':    'cubic-bezier(0, 0, 0.2, 1)',
  'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
  'spring':      'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export type DurationKey = keyof typeof DURATION;
export type EasingKey = keyof typeof EASING;
