/**
 * Fixture: sample component style object using only CSS var() references.
 *
 * Demonstrates the correct usage pattern: components reference semantic tokens
 * via var(--voya-...) only — no primitive hex values or spacing literals.
 */

import { cssVar } from '../../src/index.js';

/**
 * A synthetic "AccommodationCard" component style object.
 * In real usage this would be a CSS-in-JS object or a Tailwind-like utility map.
 * Here it validates that cssVar() produces the expected var() strings.
 */
export const SAMPLE_ACCOMMODATION_CARD_STYLES = {
  container: {
    backgroundColor: cssVar('color.surface.card'),
    borderRadius:    cssVar('radius.card'),
    boxShadow:       cssVar('elevation.card'),
    padding:         cssVar('space.6'),
  },
  title: {
    color:      cssVar('color.text.primary'),
    fontSize:   cssVar('typography.size.xl'),
    fontWeight: cssVar('typography.weight.semibold'),
    lineHeight: cssVar('typography.leading.tight'),
  },
  priceTag: {
    color:      cssVar('color.interactive.accent'),
    fontSize:   cssVar('typography.size.2xl'),
    fontWeight: cssVar('typography.weight.bold'),
  },
  ctaButton: {
    backgroundColor: cssVar('color.interactive.accent'),
    color:           cssVar('color.text.on-accent'),
    borderRadius:    cssVar('radius.button'),
    padding:         `${cssVar('space.3')} ${cssVar('space.6')}`,
    fontSize:        cssVar('typography.size.base'),
    fontWeight:      cssVar('typography.weight.medium'),
    transition:      `background-color ${cssVar('motion.duration.normal')} ${cssVar('motion.easing.ease-in-out')}`,
  },
  ctaButtonHover: {
    backgroundColor: cssVar('color.interactive.accent-hover'),
  },
  ctaButtonFocus: {
    outline:       `2px solid ${cssVar('color.focus.ring')}`,
    outlineOffset: '2px',
  },
  disabledState: {
    backgroundColor: cssVar('color.disabled.surface'),
    color:           cssVar('color.disabled.text'),
    borderColor:     cssVar('color.disabled.border'),
  },
} as const;

/** Expected CSS var reference patterns used in assertions */
export const EXPECTED_CSS_VAR_PREFIXES = ['var(--voya-'] as const;
