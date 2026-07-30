import { describe, it, expect } from 'vitest';
import {
  parseHex,
  relativeLuminance,
  contrastRatio,
  contrastRatioFromLuminance,
  meetsWcagAA,
  auditContrast,
  WCAG_AA,
} from '../../src/index.js';
import {
  FAILING_NORMAL_TEXT_PAIRS,
  FAILING_LARGE_TEXT_PAIRS,
} from '../fixtures/failing-contrast.fixture.js';

describe('parseHex()', () => {
  it('parses a 6-digit hex with leading #', () => {
    expect(parseHex('#ffffff')).toEqual([255, 255, 255]);
  });

  it('parses a 6-digit hex without #', () => {
    expect(parseHex('000000')).toEqual([0, 0, 0]);
  });

  it('parses a mid-range color', () => {
    const [r, g, b] = parseHex('#09090b');
    expect(r).toBe(9);
    expect(g).toBe(9);
    expect(b).toBe(11);
  });

  it('throws on a 3-digit shorthand', () => {
    expect(() => parseHex('#fff')).toThrow();
  });

  it('throws on an invalid hex', () => {
    expect(() => parseHex('#zzzzzz')).toThrow();
  });
});

describe('relativeLuminance()', () => {
  it('black has luminance 0', () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
  });

  it('white has luminance 1', () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
  });

  it('luminance is between 0 and 1 for any colour', () => {
    const colors: Array<[number, number, number]> = [
      [180, 83, 9],    // #b45309 brand-700
      [245, 158, 11],  // #f59e0b brand-500
      [9, 9, 11],      // #09090b neutral-950
      [250, 250, 250], // #fafafa neutral-50
    ];
    for (const rgb of colors) {
      const L = relativeLuminance(rgb);
      expect(L).toBeGreaterThanOrEqual(0);
      expect(L).toBeLessThanOrEqual(1);
    }
  });
});

describe('contrastRatioFromLuminance()', () => {
  it('black-on-white is 21:1', () => {
    expect(contrastRatioFromLuminance(1, 0)).toBeCloseTo(21, 1);
  });

  it('same colour is 1:1', () => {
    expect(contrastRatioFromLuminance(0.5, 0.5)).toBeCloseTo(1, 5);
  });

  it('is symmetric (order of arguments does not matter)', () => {
    const r1 = contrastRatioFromLuminance(0.8, 0.2);
    const r2 = contrastRatioFromLuminance(0.2, 0.8);
    expect(r1).toBeCloseTo(r2, 10);
  });
});

describe('contrastRatio()', () => {
  it('white on black is 21:1', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('black on white is 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('brand-700 on white meets 4.5:1 threshold', () => {
    // #b45309 on #ffffff ≈ 4.98:1
    const ratio = contrastRatio('#b45309', '#ffffff');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('brand-500 on neutral-950 meets 4.5:1 threshold', () => {
    // #f59e0b on #09090b ≈ 9.67:1
    const ratio = contrastRatio('#f59e0b', '#09090b');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('primary text on page passes 4.5:1 in light theme', () => {
    // #09090b on #fafafa ≈ 19.7:1
    const ratio = contrastRatio('#09090b', '#fafafa');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('primary text on page passes 4.5:1 in dark theme', () => {
    // #fafafa on #09090b ≈ 19.7:1
    const ratio = contrastRatio('#fafafa', '#09090b');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe('meetsWcagAA()', () => {
  it('white-on-black passes AA_NORMAL', () => {
    expect(meetsWcagAA('#ffffff', '#000000', 'AA_NORMAL')).toBe(true);
  });

  it('white-on-black passes AA_LARGE', () => {
    expect(meetsWcagAA('#ffffff', '#000000', 'AA_LARGE')).toBe(true);
  });

  it('brand-700 on white passes AA_NORMAL', () => {
    expect(meetsWcagAA('#b45309', '#ffffff', 'AA_NORMAL')).toBe(true);
  });

  it('defaults to AA_NORMAL threshold', () => {
    expect(meetsWcagAA('#b45309', '#ffffff')).toBe(true);
  });
});

describe('auditContrast()', () => {
  it('returns all pass flags for high-contrast pair', () => {
    const result = auditContrast('#000000', '#ffffff');
    expect(result.passes.normalText).toBe(true);
    expect(result.passes.largeText).toBe(true);
    expect(result.passes.uiComponent).toBe(true);
    expect(result.ratio).toBeCloseTo(21, 1);
  });

  it('includes foreground and background in result', () => {
    const result = auditContrast('#09090b', '#fafafa');
    expect(result.foreground).toBe('#09090b');
    expect(result.background).toBe('#fafafa');
  });
});

describe('WCAG_AA thresholds', () => {
  it('NORMAL_TEXT is 4.5', () => {
    expect(WCAG_AA.NORMAL_TEXT).toBe(4.5);
  });

  it('LARGE_TEXT is 3.0', () => {
    expect(WCAG_AA.LARGE_TEXT).toBe(3.0);
  });

  it('UI_COMPONENT is 3.0', () => {
    expect(WCAG_AA.UI_COMPONENT).toBe(3.0);
  });
});

describe('failing contrast fixture — WCAG failures', () => {
  it('neutral-400 on neutral-300 fails AA_NORMAL (< 4.5:1)', () => {
    for (const pair of FAILING_NORMAL_TEXT_PAIRS) {
      expect(
        meetsWcagAA(pair.foreground, pair.background, 'AA_NORMAL'),
        pair.label,
      ).toBe(false);
    }
  });

  it('failing pairs also fail AA_LARGE (< 3:1)', () => {
    for (const pair of [...FAILING_NORMAL_TEXT_PAIRS, ...FAILING_LARGE_TEXT_PAIRS]) {
      expect(
        meetsWcagAA(pair.foreground, pair.background, 'AA_LARGE'),
        pair.label,
      ).toBe(false);
    }
  });

  it('auditContrast reports all-false passes for failing pair', () => {
    const [pair] = FAILING_NORMAL_TEXT_PAIRS;
    if (!pair) throw new Error('Fixture is empty');
    const result = auditContrast(pair.foreground, pair.background);
    expect(result.passes.normalText).toBe(false);
    expect(result.passes.largeText).toBe(false);
    expect(result.passes.uiComponent).toBe(false);
  });
});
