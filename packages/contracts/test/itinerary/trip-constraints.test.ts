/**
 * Unit tests for TripConstraintsSchema.
 *
 * AC1: validates destination, date window, party composition, budget band,
 * interest tags, accessibility needs, and tokenised traveller reference
 * without accepting name, email, Bonvoy number, passport data, or payment data.
 */

import { describe, expect, it } from 'vitest';
import {
  AccessibilityNeed,
  BudgetBand,
  TripConstraintsSchema,
} from '../../src/index.js';
import {
  invalidConstraintsMissingDates,
  invalidConstraintsWithPii,
  invalidConstraintsZeroAdults,
  validConstraintsEmptyTags,
  validTripConstraints,
} from '../fixtures/itineraries.js';

describe('TripConstraintsSchema', () => {
  // =========================================================================
  // Happy path
  // =========================================================================

  describe('valid payloads', () => {
    it('accepts a fully populated valid trip constraints object', () => {
      const result = TripConstraintsSchema.safeParse(validTripConstraints);
      expect(result.success).toBe(true);
    });

    it('accepts constraints with an empty interest tags array (decisive search)', () => {
      const result = TripConstraintsSchema.safeParse(validConstraintsEmptyTags);
      expect(result.success).toBe(true);
    });

    it('defaults interestTags to [] when omitted', () => {
      const payload = {
        travellerRef: 'tok_test_001',
        destination: { name: 'Bali, Indonesia', countryCode: 'ID' },
        dateWindow: {
          checkIn: '2025-10-01T00:00:00.000Z',
          checkOut: '2025-10-08T00:00:00.000Z',
        },
        partyComposition: { adults: 2, children: 0, infants: 0, pets: 0 },
        budgetBand: BudgetBand.PREMIUM,
      };
      const result = TripConstraintsSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.interestTags).toEqual([]);
      }
    });

    it('defaults children/infants/pets to 0 when omitted', () => {
      const payload = {
        travellerRef: 'tok_test_002',
        destination: { name: 'Santorini, Greece', countryCode: 'GR' },
        dateWindow: {
          checkIn: '2025-11-01T00:00:00.000Z',
          checkOut: '2025-11-07T00:00:00.000Z',
        },
        partyComposition: { adults: 2 },
        budgetBand: BudgetBand.LUXURY,
        interestTags: [],
      };
      const result = TripConstraintsSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.partyComposition.children).toBe(0);
        expect(result.data.partyComposition.infants).toBe(0);
        expect(result.data.partyComposition.pets).toBe(0);
      }
    });

    it('accepts all accessibility need enum values', () => {
      const payload = {
        ...validTripConstraints,
        accessibilityNeeds: Object.values(AccessibilityNeed),
      };
      const result = TripConstraintsSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('accepts destination with only a name (coordinates/codes are optional)', () => {
      const payload = {
        ...validTripConstraints,
        destination: { name: 'Anywhere' },
      };
      const result = TripConstraintsSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('accepts all BudgetBand enum values', () => {
      for (const band of Object.values(BudgetBand)) {
        const payload = { ...validTripConstraints, budgetBand: band };
        const result = TripConstraintsSchema.safeParse(payload);
        expect(result.success, `BudgetBand.${band} should be valid`).toBe(true);
      }
    });
  });

  // =========================================================================
  // Prohibited personal data fields (AC1 — strict mode enforcement)
  // =========================================================================

  describe('prohibited personal data fields', () => {
    it('rejects a payload containing a "name" field', () => {
      const result = TripConstraintsSchema.safeParse(invalidConstraintsWithPii);
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        // strict() reports unrecognised keys as an issue
        expect(paths.some((p) => p.includes('name') || p === '')).toBe(true);
      }
    });

    it('rejects an "email" field', () => {
      const payload = { ...validTripConstraints, email: 'alice@example.com' };
      const result = TripConstraintsSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects a "bonvoyNumber" field', () => {
      const payload = { ...validTripConstraints, bonvoyNumber: '87654321' };
      const result = TripConstraintsSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects a "passportNumber" field', () => {
      const payload = { ...validTripConstraints, passportNumber: 'P123456789' };
      const result = TripConstraintsSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects a "cardNumber" field', () => {
      const payload = { ...validTripConstraints, cardNumber: '4111111111111111' };
      const result = TripConstraintsSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects a "paymentToken" field', () => {
      const payload = {
        ...validTripConstraints,
        paymentToken: 'tok_stripe_xyz',
      };
      const result = TripConstraintsSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects arbitrary unknown fields (strict mode)', () => {
      const payload = {
        ...validTripConstraints,
        unusedField: 'should-not-be-here',
      };
      const result = TripConstraintsSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Required fields and date window validation
  // =========================================================================

  describe('required fields', () => {
    it('rejects when dateWindow is missing', () => {
      const result = TripConstraintsSchema.safeParse(
        invalidConstraintsMissingDates,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths.some((p) => p.includes('dateWindow'))).toBe(true);
      }
    });

    it('rejects when travellerRef is missing', () => {
      const { travellerRef: _, ...without } = validTripConstraints;
      const result = TripConstraintsSchema.safeParse(without);
      expect(result.success).toBe(false);
    });

    it('rejects when destination is missing', () => {
      const { destination: _, ...without } = validTripConstraints;
      const result = TripConstraintsSchema.safeParse(without);
      expect(result.success).toBe(false);
    });

    it('rejects when budgetBand is missing', () => {
      const { budgetBand: _, ...without } = validTripConstraints;
      const result = TripConstraintsSchema.safeParse(without);
      expect(result.success).toBe(false);
    });

    it('rejects an invalid budgetBand value', () => {
      const payload = { ...validTripConstraints, budgetBand: 'first-class' };
      const result = TripConstraintsSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Party composition validation
  // =========================================================================

  describe('partyComposition', () => {
    it('rejects when adults is 0 (at least one adult required)', () => {
      const result = TripConstraintsSchema.safeParse(
        invalidConstraintsZeroAdults,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths.some((p) => p.includes('adults'))).toBe(true);
      }
    });

    it('rejects when partyComposition is missing', () => {
      const { partyComposition: _, ...without } = validTripConstraints;
      const result = TripConstraintsSchema.safeParse(without);
      expect(result.success).toBe(false);
    });

    it('rejects non-integer adults', () => {
      const payload = {
        ...validTripConstraints,
        partyComposition: { ...validTripConstraints.partyComposition, adults: 1.5 },
      };
      const result = TripConstraintsSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Date window validation
  // =========================================================================

  describe('dateWindow', () => {
    it('rejects when checkOut is before checkIn', () => {
      const payload = {
        ...validTripConstraints,
        dateWindow: {
          checkIn: '2025-09-25T00:00:00.000Z',
          checkOut: '2025-09-20T00:00:00.000Z', // before checkIn
        },
      };
      const result = TripConstraintsSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msgs = result.error.issues.map((i) => i.message);
        expect(msgs.some((m) => m.includes('checkOut'))).toBe(true);
      }
    });

    it('rejects when checkOut equals checkIn', () => {
      const sameDate = '2025-09-20T00:00:00.000Z';
      const payload = {
        ...validTripConstraints,
        dateWindow: { checkIn: sameDate, checkOut: sameDate },
      };
      const result = TripConstraintsSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects non-ISO datetime strings', () => {
      const payload = {
        ...validTripConstraints,
        dateWindow: { checkIn: '2025-09-20', checkOut: '2025-09-25' },
      };
      const result = TripConstraintsSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
