/**
 * Primitive color ramps — INTERNAL to @voya/design-tokens.
 *
 * These are the raw hex values that semantic tokens resolve to.
 * Consuming components MUST NOT import from this file directly;
 * use semantic token CSS custom properties instead.
 *
 * All values are PROVISIONAL. The Marriott brand re-skin is applied by
 * changing these primitive values only — no component source changes required.
 */

// ---------------------------------------------------------------------------
// Neutral scale (warm gray)
// ---------------------------------------------------------------------------

export const NEUTRAL = {
  '50':  '#fafafa',
  '100': '#f4f4f5',
  '200': '#e4e4e7',
  '300': '#d1d1d6',
  '400': '#a0a0ab',
  '500': '#70707b',
  '600': '#52525c',
  '700': '#3f3f46',
  '800': '#27272a',
  '900': '#18181b',
  '950': '#09090b',
  'white': '#ffffff',
} as const;

// ---------------------------------------------------------------------------
// Brand scale — provisional warm amber (Marriott-esque gold)
// PROVISIONAL: Replace these values when Marriott brand guidelines are provided.
// ---------------------------------------------------------------------------

export const BRAND = {
  '50':  '#fffbf0',
  '100': '#fef3c7',
  '200': '#fde68a',
  '300': '#fcd34d',
  '400': '#fbbf24',
  '500': '#f59e0b',
  '600': '#d97706',
  '700': '#b45309',
  '800': '#92400e',
  '900': '#78350f',
  '950': '#451a03',
} as const;

// ---------------------------------------------------------------------------
// Action blue (links, focus, interactive affordances)
// ---------------------------------------------------------------------------

export const ACTION = {
  '50':  '#eff6ff',
  '100': '#dbeafe',
  '200': '#bfdbfe',
  '300': '#93c5fd',
  '400': '#60a5fa',
  '500': '#3b82f6',
  '600': '#2563eb',
  '700': '#1d4ed8',
  '800': '#1e40af',
  '900': '#1e3a8a',
} as const;

// ---------------------------------------------------------------------------
// Semantic state scales
// ---------------------------------------------------------------------------

export const DANGER = {
  '50':  '#fef2f2',
  '100': '#fee2e2',
  '400': '#f87171',
  '500': '#ef4444',
  '600': '#dc2626',
  '700': '#b91c1c',
  '800': '#991b1b',
} as const;

export const SUCCESS = {
  '50':  '#f0fdf4',
  '100': '#dcfce7',
  '400': '#4ade80',
  '500': '#22c55e',
  '600': '#16a34a',
  '700': '#15803d',
  '800': '#166534',
} as const;

export const WARNING = {
  '50':  '#fffbeb',
  '100': '#fef3c7',
  '400': '#fbbf24',
  '500': '#f59e0b',
  '600': '#d97706',
  '700': '#b45309',
  '800': '#92400e',
} as const;

export type NeutralShade = keyof typeof NEUTRAL;
export type BrandShade = keyof typeof BRAND;
export type ActionShade = keyof typeof ACTION;
