/**
 * Reference contrast pairings for the Voya design system.
 *
 * Each pairing documents a semantic token pair that MUST pass WCAG 2.1 AA.
 * The integration test suite validates all pairings defined here against
 * both the light and dark themes.
 */

import type { SemanticTokenKey } from '../semantic/tokens.js';

export interface ContrastPairing {
  label: string;
  foreground: SemanticTokenKey;
  background: SemanticTokenKey;
  /** Minimum required contrast ratio */
  minimumRatio: number;
}

/**
 * Critical text/background pairings that must pass WCAG AA for normal text (4.5:1).
 */
export const CRITICAL_TEXT_PAIRINGS: ReadonlyArray<ContrastPairing> = [
  {
    label: 'Primary text on page',
    foreground: 'color.text.primary',
    background: 'color.surface.page',
    minimumRatio: 4.5,
  },
  {
    label: 'Secondary text on page',
    foreground: 'color.text.secondary',
    background: 'color.surface.page',
    minimumRatio: 4.5,
  },
  {
    label: 'Primary text on card',
    foreground: 'color.text.primary',
    background: 'color.surface.card',
    minimumRatio: 4.5,
  },
  {
    label: 'Inverse text on accent',
    foreground: 'color.text.on-accent',
    background: 'color.interactive.accent',
    minimumRatio: 4.5,
  },
  {
    label: 'Danger text on page',
    foreground: 'color.text.danger',
    background: 'color.surface.page',
    minimumRatio: 4.5,
  },
  {
    label: 'Success text on page',
    foreground: 'color.text.success',
    background: 'color.surface.page',
    minimumRatio: 4.5,
  },
] as const;

/**
 * UI component pairings that must pass WCAG AA for UI components (3:1).
 */
export const UI_COMPONENT_PAIRINGS: ReadonlyArray<ContrastPairing> = [
  {
    label: 'Focus ring on page surface',
    foreground: 'color.focus.ring',
    background: 'color.surface.page',
    minimumRatio: 3.0,
  },
  {
    label: 'Default border on page surface',
    foreground: 'color.border.default',
    background: 'color.surface.page',
    minimumRatio: 3.0,
  },
] as const;
