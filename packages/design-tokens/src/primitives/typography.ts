/**
 * Primitive typography ramps — INTERNAL to @voya/design-tokens.
 * PROVISIONAL: Replace scale values when Marriott brand type guidelines are provided.
 */

export const FONT_SIZE = {
  'xs':   '0.75rem',   // 12px
  'sm':   '0.875rem',  // 14px
  'base': '1rem',      // 16px
  'lg':   '1.125rem',  // 18px
  'xl':   '1.25rem',   // 20px
  '2xl':  '1.5rem',    // 24px
  '3xl':  '1.875rem',  // 30px
  '4xl':  '2.25rem',   // 36px
  '5xl':  '3rem',      // 48px
} as const;

export const FONT_WEIGHT = {
  'normal':    '400',
  'medium':    '500',
  'semibold':  '600',
  'bold':      '700',
} as const;

export const LINE_HEIGHT = {
  'tight':   '1.25',
  'snug':    '1.375',
  'normal':  '1.5',
  'relaxed': '1.625',
  'loose':   '2',
} as const;

export const LETTER_SPACING = {
  'tighter': '-0.05em',
  'tight':   '-0.025em',
  'normal':  '0em',
  'wide':    '0.025em',
  'wider':   '0.05em',
  'widest':  '0.1em',
} as const;

export const FONT_FAMILY = {
  'sans':  '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
  'serif': '"Georgia", "Times New Roman", serif',
  'mono':  '"JetBrains Mono", "Consolas", "Courier New", monospace',
} as const;

export type FontSizeKey = keyof typeof FONT_SIZE;
export type FontWeightKey = keyof typeof FONT_WEIGHT;
export type LineHeightKey = keyof typeof LINE_HEIGHT;
