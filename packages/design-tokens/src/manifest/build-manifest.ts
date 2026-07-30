/**
 * Machine-readable token manifest generator.
 *
 * The manifest records every resolved token as { key, cssVar, value }
 * so tooling (Storybook, design handoff, CI diff checks) can consume
 * the full token set without parsing TypeScript source.
 */

import type { SemanticTokenMap, SemanticTokenKey } from '../semantic/tokens.js';
import { tokenToCssVar } from '../semantic/tokens.js';

export interface TokenManifestEntry {
  /** Dot-notation semantic token key, e.g. "color.text.primary" */
  key: SemanticTokenKey;
  /** CSS custom property name, e.g. "--voya-color-text-primary" */
  cssVar: string;
  /** Resolved CSS value for this theme, e.g. "#09090b" */
  value: string;
}

export interface TokenManifest {
  /** Theme identifier */
  theme: string;
  /** ISO 8601 generation timestamp (set by caller) */
  generatedAt: string;
  /** Total number of tokens */
  count: number;
  /** All token entries, sorted lexicographically by key */
  tokens: ReadonlyArray<TokenManifestEntry>;
}

/**
 * Builds a machine-readable manifest from a resolved SemanticTokenMap.
 *
 * @param theme - Theme identifier string, e.g. "light" or "dark"
 * @param tokens - The complete SemanticTokenMap for this theme
 * @param generatedAt - ISO 8601 timestamp string (caller-supplied to keep this pure)
 */
export function buildManifest(
  theme: string,
  tokens: SemanticTokenMap,
  generatedAt: string,
): TokenManifest {
  const entries = Object.entries(tokens) as Array<[SemanticTokenKey, string]>;

  const sorted = [...entries].sort(([a], [b]) => a.localeCompare(b));

  const tokenEntries: TokenManifestEntry[] = sorted.map(([key, value]) => ({
    key,
    cssVar: tokenToCssVar(key),
    value,
  }));

  return {
    theme,
    generatedAt,
    count: tokenEntries.length,
    tokens: tokenEntries,
  };
}

/**
 * Looks up a single token entry from a manifest by key.
 * Returns undefined if the key is not present (should not occur for
 * complete manifests, but allows safe access without non-null assertions).
 */
export function lookupToken(
  manifest: TokenManifest,
  key: SemanticTokenKey,
): TokenManifestEntry | undefined {
  return manifest.tokens.find((entry) => entry.key === key);
}

/**
 * Filters manifest entries by key prefix (category).
 * e.g. filterByCategory(manifest, "color") returns all color tokens.
 */
export function filterByCategory(
  manifest: TokenManifest,
  category: string,
): ReadonlyArray<TokenManifestEntry> {
  return manifest.tokens.filter((entry) => entry.key.startsWith(`${category}.`));
}
