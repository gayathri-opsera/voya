/**
 * Semantic token map — the only public API surface for token names.
 *
 * SemanticTokenMap defines ALL valid token keys. Build-time reference checking
 * is guaranteed: if a consuming component references a key that is not in this
 * type, TypeScript will surface it as a type error before CI runs.
 *
 * Keys use dot-notation categories: "color.text.primary", "space.4", etc.
 * CSS custom property names are derived by replacing "." with "-" and
 * prepending "--voya-": "color.text.primary" → "--voya-color-text-primary".
 */

// ---------------------------------------------------------------------------
// Semantic token key type
// ---------------------------------------------------------------------------

export type SemanticTokenKey =
  // -- Color: text --
  | 'color.text.primary'
  | 'color.text.secondary'
  | 'color.text.tertiary'
  | 'color.text.disabled'
  | 'color.text.inverse'
  | 'color.text.on-accent'
  | 'color.text.link'
  | 'color.text.link-hover'
  | 'color.text.danger'
  | 'color.text.success'
  | 'color.text.warning'

  // -- Color: surface --
  | 'color.surface.page'
  | 'color.surface.card'
  | 'color.surface.overlay'
  | 'color.surface.sunken'
  | 'color.surface.elevated'
  | 'color.surface.disabled'

  // -- Color: border --
  | 'color.border.default'
  | 'color.border.strong'
  | 'color.border.focus'
  | 'color.border.danger'
  | 'color.border.success'

  // -- Color: interactive --
  | 'color.interactive.accent'
  | 'color.interactive.accent-hover'
  | 'color.interactive.accent-active'
  | 'color.interactive.accent-subtle'
  | 'color.interactive.danger'
  | 'color.interactive.danger-hover'
  | 'color.interactive.success'

  // -- Color: focus ring --
  | 'color.focus.ring'
  | 'color.focus.ring-offset'

  // -- Color: disabled state --
  | 'color.disabled.surface'
  | 'color.disabled.text'
  | 'color.disabled.border'

  // -- Color: feedback states --
  | 'color.feedback.danger.surface'
  | 'color.feedback.danger.border'
  | 'color.feedback.danger.text'
  | 'color.feedback.success.surface'
  | 'color.feedback.success.border'
  | 'color.feedback.success.text'
  | 'color.feedback.warning.surface'
  | 'color.feedback.warning.border'
  | 'color.feedback.warning.text'

  // -- Typography --
  | 'typography.size.xs'
  | 'typography.size.sm'
  | 'typography.size.base'
  | 'typography.size.lg'
  | 'typography.size.xl'
  | 'typography.size.2xl'
  | 'typography.size.3xl'
  | 'typography.size.4xl'
  | 'typography.size.5xl'
  | 'typography.weight.normal'
  | 'typography.weight.medium'
  | 'typography.weight.semibold'
  | 'typography.weight.bold'
  | 'typography.leading.tight'
  | 'typography.leading.snug'
  | 'typography.leading.normal'
  | 'typography.leading.relaxed'
  | 'typography.tracking.normal'
  | 'typography.tracking.wide'
  | 'typography.tracking.wider'
  | 'typography.family.sans'
  | 'typography.family.mono'

  // -- Spacing --
  | 'space.0'
  | 'space.0.5'
  | 'space.1'
  | 'space.1.5'
  | 'space.2'
  | 'space.2.5'
  | 'space.3'
  | 'space.3.5'
  | 'space.4'
  | 'space.5'
  | 'space.6'
  | 'space.7'
  | 'space.8'
  | 'space.9'
  | 'space.10'
  | 'space.11'
  | 'space.12'
  | 'space.14'
  | 'space.16'
  | 'space.20'
  | 'space.24'
  | 'space.28'
  | 'space.32'
  | 'space.36'
  | 'space.40'
  | 'space.48'
  | 'space.56'
  | 'space.64'

  // -- Border radius --
  | 'radius.none'
  | 'radius.sm'
  | 'radius.base'
  | 'radius.md'
  | 'radius.lg'
  | 'radius.xl'
  | 'radius.2xl'
  | 'radius.3xl'
  | 'radius.full'
  | 'radius.card'
  | 'radius.button'
  | 'radius.input'
  | 'radius.badge'
  | 'radius.modal'

  // -- Elevation --
  | 'elevation.none'
  | 'elevation.sm'
  | 'elevation.base'
  | 'elevation.md'
  | 'elevation.lg'
  | 'elevation.xl'
  | 'elevation.2xl'
  | 'elevation.card'
  | 'elevation.modal'
  | 'elevation.dropdown'

  // -- Motion --
  | 'motion.duration.instant'
  | 'motion.duration.fast'
  | 'motion.duration.normal'
  | 'motion.duration.slow'
  | 'motion.duration.slower'
  | 'motion.easing.linear'
  | 'motion.easing.ease-in'
  | 'motion.easing.ease-out'
  | 'motion.easing.ease-in-out'
  | 'motion.easing.spring';

/**
 * A complete theme maps every SemanticTokenKey to a CSS value string.
 */
export type SemanticTokenMap = Record<SemanticTokenKey, string>;

/**
 * Converts a semantic token key to a CSS custom property name.
 * "color.text.primary" → "--voya-color-text-primary"
 */
export function tokenToCssVar(key: SemanticTokenKey): string {
  return `--voya-${key.replace(/\./g, '-')}`;
}

/**
 * Returns the CSS var() reference for a token key.
 * "color.text.primary" → "var(--voya-color-text-primary)"
 */
export function cssVar(key: SemanticTokenKey): string {
  return `var(${tokenToCssVar(key)})`;
}
