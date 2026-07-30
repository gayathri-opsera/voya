/**
 * CSS custom property generation.
 *
 * Converts a SemanticTokenMap to a CSS string suitable for embedding in
 * :root or a theme selector such as [data-theme="dark"].
 */

import type { SemanticTokenMap, SemanticTokenKey } from '../semantic/tokens.js';
import { tokenToCssVar } from '../semantic/tokens.js';

export interface CssVarBlock {
  /** The CSS selector wrapping the custom properties, e.g. ":root" */
  selector: string;
  /** The full CSS block as a string, ready to inject into a <style> tag */
  css: string;
  /** Individual declarations as { property, value } tuples */
  declarations: ReadonlyArray<{ property: string; value: string }>;
}

/**
 * Generates CSS custom property declarations from a theme token map.
 *
 * @param tokens - The complete SemanticTokenMap for a theme
 * @param selector - The CSS selector to scope the declarations under (default: ":root")
 * @returns A CssVarBlock containing the selector, full CSS string, and parsed declarations
 */
export function buildCssVars(
  tokens: SemanticTokenMap,
  selector = ':root',
): CssVarBlock {
  const entries = Object.entries(tokens) as Array<[SemanticTokenKey, string]>;
  const declarations = entries.map(([key, value]) => ({
    property: tokenToCssVar(key),
    value,
  }));

  const lines = declarations.map(
    ({ property, value }) => `  ${property}: ${value};`,
  );
  const css = `${selector} {\n${lines.join('\n')}\n}`;

  return { selector, css, declarations };
}

/**
 * Generates a complete CSS string for light (default) and dark themes.
 *
 * The light theme is applied under :root; the dark theme is applied under
 * [data-theme="dark"] so it can be toggled by setting a data attribute on
 * the <html> element.
 */
export function buildThemeCss(
  lightTokens: SemanticTokenMap,
  darkTokens: SemanticTokenMap,
): string {
  const { css: lightCss } = buildCssVars(lightTokens, ':root');
  const { css: darkCss } = buildCssVars(darkTokens, '[data-theme="dark"]');
  return `${lightCss}\n\n${darkCss}`;
}
