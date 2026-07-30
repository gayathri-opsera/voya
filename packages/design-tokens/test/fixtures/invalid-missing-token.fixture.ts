/**
 * Fixture: a partial token map that is MISSING required token keys.
 *
 * Used to test that missing-token detection surfaces the right errors.
 * This is deliberately NOT typed as SemanticTokenMap so it can be incomplete.
 */

export const MISSING_TOKEN_MAP: Record<string, string> = {
  'color.text.primary':  '#09090b',
  'color.surface.page':  '#fafafa',
  // intentionally omitting: 'color.interactive.accent', 'color.text.on-accent', ...
};

/** Keys that are present in the fixture */
export const PRESENT_KEYS = ['color.text.primary', 'color.surface.page'] as const;

/** Keys that are absent (representative subset) */
export const ABSENT_KEYS = [
  'color.interactive.accent',
  'color.text.on-accent',
  'color.focus.ring',
  'radius.card',
  'elevation.modal',
] as const;
