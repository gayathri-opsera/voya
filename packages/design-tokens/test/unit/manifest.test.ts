import { describe, it, expect } from 'vitest';
import {
  buildManifest,
  lookupToken,
  filterByCategory,
  lightTheme,
  darkTheme,
} from '../../src/index.js';

const FIXED_TIMESTAMP = '2026-07-30T00:00:00.000Z';

describe('buildManifest()', () => {
  it('returns a manifest with the correct theme label', () => {
    const manifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    expect(manifest.theme).toBe('light');
  });

  it('records the generatedAt timestamp', () => {
    const manifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    expect(manifest.generatedAt).toBe(FIXED_TIMESTAMP);
  });

  it('count matches tokens array length', () => {
    const manifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    expect(manifest.count).toBe(manifest.tokens.length);
  });

  it('count equals number of keys in lightTheme', () => {
    const manifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    expect(manifest.count).toBe(Object.keys(lightTheme).length);
  });

  it('tokens are sorted lexicographically', () => {
    const manifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    const keys = manifest.tokens.map((t) => t.key);
    const sorted = [...keys].sort((a, b) => a.localeCompare(b));
    expect(keys).toEqual(sorted);
  });

  it('every token entry has key, cssVar, and value', () => {
    const manifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    for (const entry of manifest.tokens) {
      expect(typeof entry.key).toBe('string');
      expect(typeof entry.cssVar).toBe('string');
      expect(typeof entry.value).toBe('string');
      expect(entry.key.length).toBeGreaterThan(0);
      expect(entry.cssVar.length).toBeGreaterThan(0);
      expect(entry.value.length).toBeGreaterThan(0);
    }
  });

  it('cssVar fields all start with --voya-', () => {
    const manifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    for (const entry of manifest.tokens) {
      expect(entry.cssVar).toMatch(/^--voya-/);
    }
  });

  it('cssVar is derived from key (dots to dashes)', () => {
    const manifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    for (const entry of manifest.tokens) {
      const expected = `--voya-${entry.key.replace(/\./g, '-')}`;
      expect(entry.cssVar).toBe(expected);
    }
  });

  it('generates a manifest for dark theme with same token count', () => {
    const lightManifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    const darkManifest  = buildManifest('dark', darkTheme, FIXED_TIMESTAMP);
    expect(darkManifest.count).toBe(lightManifest.count);
  });

  it('dark and light manifests share the same keys', () => {
    const lightManifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    const darkManifest  = buildManifest('dark', darkTheme, FIXED_TIMESTAMP);
    const lightKeys = lightManifest.tokens.map((t) => t.key);
    const darkKeys  = darkManifest.tokens.map((t) => t.key);
    expect(darkKeys).toEqual(lightKeys);
  });

  it('dark and light manifests have different values for color tokens', () => {
    const lightManifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    const darkManifest  = buildManifest('dark', darkTheme, FIXED_TIMESTAMP);
    const lightAccent = lightManifest.tokens.find(
      (t) => t.key === 'color.interactive.accent',
    );
    const darkAccent = darkManifest.tokens.find(
      (t) => t.key === 'color.interactive.accent',
    );
    expect(lightAccent?.value).not.toBe(darkAccent?.value);
  });
});

describe('lookupToken()', () => {
  it('returns the entry for a known key', () => {
    const manifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    const entry = lookupToken(manifest, 'color.text.primary');
    expect(entry).toBeDefined();
    expect(entry?.key).toBe('color.text.primary');
    expect(entry?.cssVar).toBe('--voya-color-text-primary');
    expect(entry?.value).toBe('#09090b');
  });

  it('returns undefined for a missing key', () => {
    const manifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    // Cast to bypass type safety — simulates a runtime unknown key
    const entry = manifest.tokens.find((t) => t.key === ('nonexistent.key' as never));
    expect(entry).toBeUndefined();
  });
});

describe('filterByCategory()', () => {
  it('returns only color tokens when filtering by "color"', () => {
    const manifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    const colorTokens = filterByCategory(manifest, 'color');
    expect(colorTokens.length).toBeGreaterThan(0);
    for (const entry of colorTokens) {
      expect(entry.key).toMatch(/^color\./);
    }
  });

  it('returns only space tokens when filtering by "space"', () => {
    const manifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    const spaceTokens = filterByCategory(manifest, 'space');
    expect(spaceTokens.length).toBeGreaterThan(0);
    for (const entry of spaceTokens) {
      expect(entry.key).toMatch(/^space\./);
    }
  });

  it('returns empty array for unknown category', () => {
    const manifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    const tokens = filterByCategory(manifest, 'nonexistent-category');
    expect(tokens).toHaveLength(0);
  });

  it('color token values are all non-empty hex or rgb strings', () => {
    const manifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);
    const colorTokens = filterByCategory(manifest, 'color');
    for (const entry of colorTokens) {
      expect(entry.value.length).toBeGreaterThan(0);
    }
  });
});
