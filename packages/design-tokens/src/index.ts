/**
 * @voya/design-tokens — public API
 *
 * Primitive ramps are NOT exported. Consuming code must reference tokens
 * via CSS custom properties (var(--voya-...)) or the typed SemanticTokenKey
 * union. This prevents page-local color/spacing literals from leaking into
 * component source.
 */

// Semantic token types and CSS var helpers
export type { SemanticTokenKey, SemanticTokenMap } from './semantic/tokens.js';
export { tokenToCssVar, cssVar } from './semantic/tokens.js';

// Themes
export { lightTheme } from './themes/light.js';
export { darkTheme } from './themes/dark.js';

// CSS custom property generation
export type { CssVarBlock } from './css/build-css-vars.js';
export { buildCssVars, buildThemeCss } from './css/build-css-vars.js';

// WCAG contrast utilities
export type { ContrastResult, WcagLevel } from './contrast/wcag.js';
export {
  parseHex,
  relativeLuminance,
  contrastRatio,
  contrastRatioFromLuminance,
  meetsWcagAA,
  auditContrast,
  WCAG_AA,
} from './contrast/wcag.js';

// Contrast pairings reference list
export type { ContrastPairing } from './contrast/contrast-pairings.js';
export {
  CRITICAL_TEXT_PAIRINGS,
  UI_COMPONENT_PAIRINGS,
} from './contrast/contrast-pairings.js';

// Token manifest
export type { TokenManifestEntry, TokenManifest } from './manifest/build-manifest.js';
export { buildManifest, lookupToken, filterByCategory } from './manifest/build-manifest.js';
