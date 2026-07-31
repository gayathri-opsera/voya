/**
 * Unit tests for TripConfidenceReceiptSchema.
 *
 * AC3: schema represents pass, blocked, or stale outcomes with feasibility
 * summary, provenance summary, freshness summary, blocking reasons,
 * generated timestamp, and receipt validity deadline.
 *
 * Edge cases:
 *   - Receipt generated before latest line-item freshness timestamp → rejected
 *   - BLOCKED / STALE outcomes without blocking reasons → rejected
 *   - receiptValidityDeadline before generatedAt → rejected
 *   - PASS outcome with empty blocking reasons → accepted
 */

import { describe, expect, it } from 'vitest';
import {
  BlockingReasonSchema,
  FeasibilitySummarySchema,
  FreshnessSummarySchema,
  ProvenanceSummarySchema,
  ReceiptOutcome,
  TripConfidenceReceiptSchema,
} from '../../src/index.js';
import {
  blockedHallucinatedInventoryReceipt,
  invalidBlockedReceiptNoReasons,
  invalidReceiptGeneratedBeforeData,
  staleReceipt,
  validBrandFallbackPassReceipt,
  validPassReceipt,
} from '../fixtures/itineraries.js';

describe('TripConfidenceReceiptSchema', () => {
  // =========================================================================
  // Happy path
  // =========================================================================

  describe('valid receipts', () => {
    it('accepts a valid PASS receipt for an HVMI-first itinerary', () => {
      const result = TripConfidenceReceiptSchema.safeParse(validPassReceipt);
      expect(result.success).toBe(true);
    });

    it('accepts a valid PASS receipt with brand-fallback disclosure required', () => {
      const result = TripConfidenceReceiptSchema.safeParse(
        validBrandFallbackPassReceipt,
      );
      expect(result.success).toBe(true);
    });

    it('accepts a valid STALE receipt with required blocking reasons', () => {
      const result = TripConfidenceReceiptSchema.safeParse(staleReceipt);
      expect(result.success).toBe(true);
    });

    it('accepts a valid BLOCKED receipt with hallucinated inventory reasons', () => {
      const result = TripConfidenceReceiptSchema.safeParse(
        blockedHallucinatedInventoryReceipt,
      );
      expect(result.success).toBe(true);
    });

    it('accepts all three ReceiptOutcome enum values when properly structured', () => {
      // PASS
      expect(
        TripConfidenceReceiptSchema.safeParse(validPassReceipt).success,
      ).toBe(true);

      // STALE (with blocking reasons)
      expect(TripConfidenceReceiptSchema.safeParse(staleReceipt).success).toBe(
        true,
      );

      // BLOCKED (with blocking reasons)
      expect(
        TripConfidenceReceiptSchema.safeParse(
          blockedHallucinatedInventoryReceipt,
        ).success,
      ).toBe(true);
    });
  });

  // =========================================================================
  // Blocking reason requirement (AC3, Error Handling)
  // =========================================================================

  describe('blocking reason requirements', () => {
    it('rejects a BLOCKED receipt with an empty blockingReasons array', () => {
      const result = TripConfidenceReceiptSchema.safeParse(
        invalidBlockedReceiptNoReasons,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('blockingReasons');
      }
    });

    it('rejects a STALE receipt with an empty blockingReasons array', () => {
      const staleWithoutReasons = {
        ...staleReceipt,
        blockingReasons: [],
      };
      const result = TripConfidenceReceiptSchema.safeParse(staleWithoutReasons);
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('blockingReasons');
      }
    });

    it('accepts a PASS receipt with an empty blockingReasons array', () => {
      const result = TripConfidenceReceiptSchema.safeParse(validPassReceipt);
      expect(result.success).toBe(true);
    });

    it('validates blocking reason structure — rejects missing fieldPath', () => {
      const badReason = {
        code: 'PROVENANCE_MISSING',
        // fieldPath omitted
        rule: 'every-line-item-must-have-provenance',
      };
      const result = BlockingReasonSchema.safeParse(badReason);
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('fieldPath');
      }
    });

    it('validates blocking reason structure — rejects missing rule', () => {
      const badReason = {
        code: 'FRESHNESS_EXPIRED',
        fieldPath: 'lineItems[0].availabilityCheckedAt',
        // rule omitted
      };
      const result = BlockingReasonSchema.safeParse(badReason);
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('rule');
      }
    });
  });

  // =========================================================================
  // Timestamp validity invariants
  // =========================================================================

  describe('timestamp invariants', () => {
    it('rejects when generatedAt is before freshnessSummary.newestDataAt', () => {
      const result = TripConfidenceReceiptSchema.safeParse(
        invalidReceiptGeneratedBeforeData,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('generatedAt');
      }
    });

    it('rejects when receiptValidityDeadline is before generatedAt', () => {
      const payload = {
        ...validPassReceipt,
        receiptValidityDeadline: '2025-09-15T09:00:00.000Z', // before generatedAt
      };
      const result = TripConfidenceReceiptSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('receiptValidityDeadline');
      }
    });

    it('rejects when receiptValidityDeadline equals generatedAt', () => {
      const payload = {
        ...validPassReceipt,
        receiptValidityDeadline: validPassReceipt.generatedAt, // equal, not strictly after
      };
      const result = TripConfidenceReceiptSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects non-ISO datetime for generatedAt', () => {
      const payload = {
        ...validPassReceipt,
        generatedAt: '2025-09-15T10:00:00', // missing timezone
      };
      const result = TripConfidenceReceiptSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Sub-schema unit tests
  // =========================================================================

  describe('FeasibilitySummarySchema', () => {
    it('accepts a valid feasibility summary', () => {
      const result = FeasibilitySummarySchema.safeParse(
        validPassReceipt.feasibilitySummary,
      );
      expect(result.success).toBe(true);
    });

    it('rejects when isExecutable is missing', () => {
      const { isExecutable: _, ...without } =
        validPassReceipt.feasibilitySummary;
      const result = FeasibilitySummarySchema.safeParse(without);
      expect(result.success).toBe(false);
    });

    it('defaults hardConstraintViolations to [] when omitted', () => {
      const payload = {
        isExecutable: true,
        checkedAt: '2025-09-15T10:00:00.000Z',
        openingHoursVerified: true,
        travelTimeVerified: true,
        loadBalanceVerified: true,
        gapNightsResolved: true,
        availabilityConfirmed: true,
      };
      const result = FeasibilitySummarySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hardConstraintViolations).toEqual([]);
      }
    });
  });

  describe('ProvenanceSummarySchema', () => {
    it('accepts a valid provenance summary', () => {
      const result = ProvenanceSummarySchema.safeParse(
        validPassReceipt.provenanceSummary,
      );
      expect(result.success).toBe(true);
    });

    it('rejects negative totalLineItems', () => {
      const payload = {
        ...validPassReceipt.provenanceSummary,
        totalLineItems: -1,
      };
      const result = ProvenanceSummarySchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('FreshnessSummarySchema', () => {
    it('accepts a valid freshness summary', () => {
      const result = FreshnessSummarySchema.safeParse(
        validPassReceipt.freshnessSummary,
      );
      expect(result.success).toBe(true);
    });

    it('rejects when newestDataAt is before oldestDataAt', () => {
      const payload = {
        ...validPassReceipt.freshnessSummary,
        oldestDataAt: '2025-09-15T10:00:00.000Z',
        newestDataAt: '2025-09-15T09:00:00.000Z', // before oldestDataAt
      };
      const result = FreshnessSummarySchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('defaults staleDomains to [] when omitted', () => {
      const payload = {
        oldestDataAt: '2025-09-15T09:00:00.000Z',
        newestDataAt: '2025-09-15T09:30:00.000Z',
        allWithinFreshnessWindow: true,
      };
      const result = FreshnessSummarySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staleDomains).toEqual([]);
      }
    });
  });

  // =========================================================================
  // Required fields
  // =========================================================================

  describe('required fields', () => {
    const required = [
      'receiptId',
      'itineraryId',
      'outcome',
      'feasibilitySummary',
      'provenanceSummary',
      'freshnessSummary',
      'generatedAt',
      'receiptValidityDeadline',
    ] as const;

    for (const field of required) {
      it(`rejects when '${field}' is missing`, () => {
        const { [field]: _, ...without } = validPassReceipt as Record<
          string,
          unknown
        >;
        const result = TripConfidenceReceiptSchema.safeParse(without);
        expect(result.success, `'${field}' should be required`).toBe(false);
      });
    }

    it('rejects an invalid outcome value', () => {
      const payload = { ...validPassReceipt, outcome: 'pending' };
      const result = TripConfidenceReceiptSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects extra unknown fields (strict mode)', () => {
      const payload = {
        ...validPassReceipt,
        hallucinated: 'extra-field',
      };
      const result = TripConfidenceReceiptSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
