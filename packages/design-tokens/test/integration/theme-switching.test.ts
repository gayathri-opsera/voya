import { describe, it, expect } from 'vitest';
import {
  buildCssVars,
  buildThemeCss,
  lightTheme,
  darkTheme,
  tokenToCssVar,
  buildManifest,
} from '../../src/index.js';
import type { SemanticTokenKey } from '../../src/index.js';
import {
  CRITICAL_TEXT_PAIRINGS,
  UI_COMPONENT_PAIRINGS,
  meetsWcagAA,
  contrastRatio,
} from '../../src/index.js';

const FIXED_TIMESTAMP = '2026-07-30T00:00:00.000Z';

// ---------------------------------------------------------------------------
// CSS custom property generation
// ---------------------------------------------------------------------------

describe('buildCssVars() — light theme', () => {
  it('emits :root as the default selector', () => {
    const { css } = buildCssVars(lightTheme);
    expect(css).toMatch(/^:root\s*\{/);
  });

  it('uses custom selector when provided', () => {
    const { css } = buildCssVars(lightTheme, '.voya-light');
    expect(css).toMatch(/^\.voya-light\s*\{/);
  });

  it('contains all expected CSS var declarations', () => {
    const { declarations } = buildCssVars(lightTheme);
    const propertyNames = new Set(declarations.map((d) => d.property));
    const sampleKeys: SemanticTokenKey[] = [
      'color.text.primary',
      'color.surface.page',
      'color.interactive.accent',
      'space.4',
      'radius.card',
      'elevation.modal',
      'motion.duration.normal',
      'typography.size.2xl',
    ];
    for (const key of sampleKeys) {
      const expectedProp = tokenToCssVar(key);
      expect(propertyNames.has(expectedProp), `Missing: ${expectedProp}`).toBe(true);
    }
  });

  it('all property names start with --voya-', () => {
    const { declarations } = buildCssVars(lightTheme);
    for (const { property } of declarations) {
      expect(property).toMatch(/^--voya-/);
    }
  });

  it('declaration count matches theme key count', () => {
    const { declarations } = buildCssVars(lightTheme);
    expect(declarations.length).toBe(Object.keys(lightTheme).length);
  });

  it('color.text.primary is #09090b in light theme', () => {
    const { declarations } = buildCssVars(lightTheme);
    const textPrimary = declarations.find(
      (d) => d.property === '--voya-color-text-primary',
    );
    expect(textPrimary?.value).toBe('#09090b');
  });
});

describe('buildCssVars() — dark theme', () => {
  it('emits custom selector for dark theme', () => {
    const { css } = buildCssVars(darkTheme, '[data-theme="dark"]');
    expect(css).toMatch(/^\[data-theme="dark"\]\s*\{/);
  });

  it('color.text.primary is #fafafa in dark theme', () => {
    const { declarations } = buildCssVars(darkTheme);
    const textPrimary = declarations.find(
      (d) => d.property === '--voya-color-text-primary',
    );
    expect(textPrimary?.value).toBe('#fafafa');
  });

  it('dark theme accent differs from light theme accent in CSS output', () => {
    const { declarations: lightDecls } = buildCssVars(lightTheme);
    const { declarations: darkDecls }  = buildCssVars(darkTheme);
    const lightAccent = lightDecls.find((d) => d.property === '--voya-color-interactive-accent');
    const darkAccent  = darkDecls.find((d) => d.property === '--voya-color-interactive-accent');
    expect(lightAccent?.value).not.toBe(darkAccent?.value);
  });
});

describe('buildThemeCss() — combined output', () => {
  it('produces a string containing both :root and [data-theme="dark"] blocks', () => {
    const combined = buildThemeCss(lightTheme, darkTheme);
    expect(combined).toContain(':root {');
    expect(combined).toContain('[data-theme="dark"] {');
  });

  it('contains --voya-color-text-primary in both blocks', () => {
    const combined = buildThemeCss(lightTheme, darkTheme);
    const matches = combined.match(/--voya-color-text-primary/g);
    expect(matches?.length).toBe(2);
  });

  it('the :root block appears before the dark-theme block', () => {
    const combined = buildThemeCss(lightTheme, darkTheme);
    const rootIdx = combined.indexOf(':root {');
    const darkIdx = combined.indexOf('[data-theme="dark"] {');
    expect(rootIdx).toBeLessThan(darkIdx);
  });
});

// ---------------------------------------------------------------------------
// Theme switching: same keys, different values
// ---------------------------------------------------------------------------

describe('theme switching semantics', () => {
  it('light and dark themes have identical key sets', () => {
    const lightKeys = Object.keys(lightTheme).sort();
    const darkKeys  = Object.keys(darkTheme).sort();
    expect(darkKeys).toEqual(lightKeys);
  });

  it('switching themes changes color token values', () => {
    const colorKeys = (Object.keys(lightTheme) as SemanticTokenKey[]).filter(
      (k) => k.startsWith('color.'),
    );
    let diffCount = 0;
    for (const key of colorKeys) {
      if (lightTheme[key] !== darkTheme[key]) diffCount++;
    }
    expect(diffCount).toBeGreaterThan(0);
  });

  it('non-color tokens (spacing, radius, typography) are identical across themes', () => {
    const nonColorKeys = (Object.keys(lightTheme) as SemanticTokenKey[]).filter(
      (k) => !k.startsWith('color.') && !k.startsWith('elevation.'),
    );
    for (const key of nonColorKeys) {
      expect(lightTheme[key], `key "${key}"`).toBe(darkTheme[key]);
    }
  });
});

// ---------------------------------------------------------------------------
// WCAG contrast validation via manifest
// ---------------------------------------------------------------------------

describe('WCAG contrast — critical pairings (light theme)', () => {
  it('all CRITICAL_TEXT_PAIRINGS pass in light theme', () => {
    for (const pairing of CRITICAL_TEXT_PAIRINGS) {
      const fg = lightTheme[pairing.foreground];
      const bg = lightTheme[pairing.background];
      const ratio = contrastRatio(fg, bg);
      expect(
        ratio,
        `"${pairing.label}" ratio ${ratio.toFixed(2)} < ${pairing.minimumRatio}`,
      ).toBeGreaterThanOrEqual(pairing.minimumRatio);
    }
  });

  it('all CRITICAL_TEXT_PAIRINGS pass in dark theme', () => {
    for (const pairing of CRITICAL_TEXT_PAIRINGS) {
      const fg = darkTheme[pairing.foreground];
      const bg = darkTheme[pairing.background];
      const ratio = contrastRatio(fg, bg);
      expect(
        ratio,
        `"${pairing.label}" ratio ${ratio.toFixed(2)} < ${pairing.minimumRatio}`,
      ).toBeGreaterThanOrEqual(pairing.minimumRatio);
    }
  });

  it('meetsWcagAA returns true for all text pairings in light theme', () => {
    for (const pairing of CRITICAL_TEXT_PAIRINGS) {
      const fg = lightTheme[pairing.foreground];
      const bg = lightTheme[pairing.background];
      expect(meetsWcagAA(fg, bg, 'AA_NORMAL'), pairing.label).toBe(true);
    }
  });
});

describe('WCAG contrast — UI component pairings (light theme)', () => {
  it('all UI_COMPONENT_PAIRINGS pass 3:1 in light theme', () => {
    for (const pairing of UI_COMPONENT_PAIRINGS) {
      const fg = lightTheme[pairing.foreground];
      const bg = lightTheme[pairing.background];
      const ratio = contrastRatio(fg, bg);
      expect(
        ratio,
        `"${pairing.label}" ratio ${ratio.toFixed(2)} < ${pairing.minimumRatio}`,
      ).toBeGreaterThanOrEqual(pairing.minimumRatio);
    }
  });
});

// ---------------------------------------------------------------------------
// Manifest coverage completeness
// ---------------------------------------------------------------------------

describe('manifest coverage — all semantic categories present', () => {
  const manifest = buildManifest('light', lightTheme, FIXED_TIMESTAMP);

  const requiredCategories = [
    'color',
    'typography',
    'space',
    'radius',
    'elevation',
    'motion',
  ];

  for (const category of requiredCategories) {
    it(`manifest includes tokens from category "${category}"`, () => {
      const tokens = manifest.tokens.filter((t) => t.key.startsWith(`${category}.`));
      expect(tokens.length, `No tokens for category "${category}"`).toBeGreaterThan(0);
    });
  }

  it('manifest covers color subcategories: text, surface, border, interactive, focus, disabled, feedback', () => {
    const colorKeys = manifest.tokens
      .filter((t) => t.key.startsWith('color.'))
      .map((t) => t.key);

    const subs = ['text', 'surface', 'border', 'interactive', 'focus', 'disabled', 'feedback'];
    for (const sub of subs) {
      const found = colorKeys.some((k) => k.startsWith(`color.${sub}.`));
      expect(found, `Missing color subcategory: ${sub}`).toBe(true);
    }
  });
});
