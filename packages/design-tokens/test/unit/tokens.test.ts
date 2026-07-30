import { describe, it, expect } from 'vitest';
import {
  tokenToCssVar,
  cssVar,
  lightTheme,
  darkTheme,
} from '../../src/index.js';
import type { SemanticTokenKey } from '../../src/index.js';
import {
  MISSING_TOKEN_MAP,
  PRESENT_KEYS,
  ABSENT_KEYS,
} from '../fixtures/invalid-missing-token.fixture.js';
import {
  SAMPLE_ACCOMMODATION_CARD_STYLES,
  EXPECTED_CSS_VAR_PREFIXES,
} from '../fixtures/sample-component.fixture.js';

describe('tokenToCssVar()', () => {
  it('converts dot-notation key to CSS custom property', () => {
    expect(tokenToCssVar('color.text.primary')).toBe('--voya-color-text-primary');
  });

  it('converts multi-level key correctly', () => {
    expect(tokenToCssVar('color.interactive.accent-hover')).toBe(
      '--voya-color-interactive-accent-hover',
    );
  });

  it('converts spacing key', () => {
    expect(tokenToCssVar('space.4')).toBe('--voya-space-4');
  });

  it('converts radius key', () => {
    expect(tokenToCssVar('radius.card')).toBe('--voya-radius-card');
  });

  it('converts motion key', () => {
    expect(tokenToCssVar('motion.duration.fast')).toBe('--voya-motion-duration-fast');
  });

  it('always prefixes with --voya-', () => {
    const keys: SemanticTokenKey[] = [
      'color.text.primary',
      'space.8',
      'radius.modal',
      'elevation.lg',
      'motion.easing.spring',
      'typography.size.2xl',
    ];
    for (const key of keys) {
      expect(tokenToCssVar(key)).toMatch(/^--voya-/);
    }
  });
});

describe('cssVar()', () => {
  it('wraps the CSS custom property in var()', () => {
    expect(cssVar('color.text.primary')).toBe('var(--voya-color-text-primary)');
  });

  it('wraps a spacing token', () => {
    expect(cssVar('space.4')).toBe('var(--voya-space-4)');
  });
});

describe('lightTheme', () => {
  it('contains a value for every semantic token key', () => {
    const keys = Object.keys(lightTheme);
    expect(keys.length).toBeGreaterThan(0);
  });

  it('text.primary is a dark hex value (light theme)', () => {
    expect(lightTheme['color.text.primary']).toBe('#09090b');
  });

  it('surface.page is a light hex value (light theme)', () => {
    expect(lightTheme['color.surface.page']).toBe('#fafafa');
  });

  it('interactive.accent is set (light theme)', () => {
    expect(lightTheme['color.interactive.accent']).toBeTruthy();
  });

  it('all values are non-empty strings', () => {
    for (const [key, value] of Object.entries(lightTheme)) {
      expect(typeof value, `key "${key}"`).toBe('string');
      expect(value.length, `key "${key}"`).toBeGreaterThan(0);
    }
  });
});

describe('darkTheme', () => {
  it('has the same set of keys as lightTheme', () => {
    const lightKeys = Object.keys(lightTheme).sort();
    const darkKeys  = Object.keys(darkTheme).sort();
    expect(darkKeys).toEqual(lightKeys);
  });

  it('text.primary is a light hex value (dark theme)', () => {
    expect(darkTheme['color.text.primary']).toBe('#fafafa');
  });

  it('surface.page is a dark hex value (dark theme)', () => {
    expect(darkTheme['color.surface.page']).toBe('#09090b');
  });

  it('accent differs from light theme', () => {
    expect(darkTheme['color.interactive.accent']).not.toBe(
      lightTheme['color.interactive.accent'],
    );
  });
});

describe('semantic-to-primitive resolution', () => {
  it('light accent resolves to brand-700 hex', () => {
    expect(lightTheme['color.interactive.accent']).toBe('#b45309');
  });

  it('dark accent resolves to brand-500 hex', () => {
    expect(darkTheme['color.interactive.accent']).toBe('#f59e0b');
  });

  it('space.4 resolves to 16px', () => {
    expect(lightTheme['space.4']).toBe('16px');
  });

  it('radius.card resolves to same value as radius.xl', () => {
    expect(lightTheme['radius.card']).toBe(lightTheme['radius.xl']);
  });
});

describe('missing-token detection', () => {
  it('present keys exist in the fixture', () => {
    for (const key of PRESENT_KEYS) {
      expect(MISSING_TOKEN_MAP[key]).toBeDefined();
    }
  });

  it('absent keys are not in the partial fixture', () => {
    for (const key of ABSENT_KEYS) {
      expect(MISSING_TOKEN_MAP[key]).toBeUndefined();
    }
  });

  it('missing keys ARE defined in the full lightTheme', () => {
    for (const key of ABSENT_KEYS) {
      expect(lightTheme[key as SemanticTokenKey]).toBeTruthy();
    }
  });
});

describe('sample-component fixture (CSS var references)', () => {
  it('all style values reference var(--voya-...) only', () => {
    const allValues = Object.values(SAMPLE_ACCOMMODATION_CARD_STYLES).flatMap(
      (group) => Object.values(group as Record<string, string>),
    );
    for (const value of allValues) {
      expect(value).toContain(EXPECTED_CSS_VAR_PREFIXES[0]);
    }
  });

  it('ctaButton uses accent background', () => {
    expect(SAMPLE_ACCOMMODATION_CARD_STYLES.ctaButton.backgroundColor).toBe(
      'var(--voya-color-interactive-accent)',
    );
  });

  it('ctaButton uses on-accent text color', () => {
    expect(SAMPLE_ACCOMMODATION_CARD_STYLES.ctaButton.color).toBe(
      'var(--voya-color-text-on-accent)',
    );
  });
});
