/**
 * System integration contract tests — AC6.
 *
 * Validates a representative itinerary payload flowing from:
 *   TripConstraints → ItineraryLineItems → TripConfidenceReceipt
 *
 * Uses only shared contracts and fixtures; no live suppliers, databases,
 * LLMs, or search services are called.
 *
 * Scenarios:
 *   1. Valid HVMI-first itinerary end-to-end (pass receipt)
 *   2. Brand-fallback itinerary with disclosure (pass receipt, flag set)
 *   3. Stale receipt blocking a previously valid itinerary
 *   4. Hallucinated inventory attempt blocked at line-item and receipt level
 */

import { describe, expect, it } from 'vitest';
import {
  ItineraryLineItemSchema,
  ReceiptOutcome,
  TripConfidenceReceiptSchema,
  TripConstraintsSchema,
} from '../../src/index.js';
import {
  activityLineItem,
  amadeusFlightLineItem,
  blockedHallucinatedInventoryReceipt,
  brandFallbackAccommodationLineItem,
  diningLineItem,
  hvmiAccommodationLineItem,
  invalidHallucinatedInventory,
  publicLandmarkLineItem,
  staleReceipt,
  validBrandFallbackPassReceipt,
  validPassReceipt,
  validTripConstraints,
} from '../fixtures/itineraries.js';

// ---------------------------------------------------------------------------
// Helper — validate an array of line items and return parse results
// ---------------------------------------------------------------------------
function parseLineItems(items: unknown[]) {
  return items.map((item) => ItineraryLineItemSchema.safeParse(item));
}

// ---------------------------------------------------------------------------
// Scenario 1: Valid HVMI-first itinerary → PASS receipt
// ---------------------------------------------------------------------------

describe('Integration: HVMI-first itinerary → PASS receipt', () => {
  const itineraryLineItems = [
    hvmiAccommodationLineItem,
    diningLineItem,
    activityLineItem,
    publicLandmarkLineItem,
    amadeusFlightLineItem,
  ];

  it('parses valid trip constraints', () => {
    const result = TripConstraintsSchema.safeParse(validTripConstraints);
    expect(result.success).toBe(true);
  });

  it('validates all line items successfully', () => {
    const results = parseLineItems(itineraryLineItems);
    for (const result of results) {
      expect(result.success).toBe(true);
    }
  });

  it('validates a PASS receipt for the assembled itinerary', () => {
    const result = TripConfidenceReceiptSchema.safeParse(validPassReceipt);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outcome).toBe(ReceiptOutcome.PASS);
      expect(result.data.blockingReasons).toHaveLength(0);
      expect(result.data.provenanceSummary.allSourcesResolved).toBe(true);
      expect(result.data.provenanceSummary.hvmiFirstSatisfied).toBe(true);
      expect(result.data.freshnessSummary.allWithinFreshnessWindow).toBe(true);
    }
  });

  it('confirms the receipt certifies data it evaluated (generatedAt >= newestDataAt)', () => {
    const receipt = TripConfidenceReceiptSchema.parse(validPassReceipt);
    expect(
      new Date(receipt.generatedAt) >=
        new Date(receipt.freshnessSummary.newestDataAt),
    ).toBe(true);
  });

  it('confirms the receipt validity deadline is after generatedAt', () => {
    const receipt = TripConfidenceReceiptSchema.parse(validPassReceipt);
    expect(
      new Date(receipt.receiptValidityDeadline) > new Date(receipt.generatedAt),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Brand-fallback itinerary → PASS receipt with disclosure flag
// ---------------------------------------------------------------------------

describe('Integration: Brand-fallback itinerary → PASS receipt + disclosure', () => {
  it('validates the brand-fallback accommodation line item', () => {
    const result = ItineraryLineItemSchema.safeParse(
      brandFallbackAccommodationLineItem,
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceClassification).toBe('marriott-partnered');
    }
  });

  it('validates the brand-fallback PASS receipt', () => {
    const result = TripConfidenceReceiptSchema.safeParse(
      validBrandFallbackPassReceipt,
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outcome).toBe(ReceiptOutcome.PASS);
    }
  });

  it('confirms hvmiFirstSatisfied is false and fallbackDisclosureRequired is true', () => {
    const receipt = TripConfidenceReceiptSchema.parse(validBrandFallbackPassReceipt);
    expect(receipt.provenanceSummary.hvmiFirstSatisfied).toBe(false);
    expect(receipt.provenanceSummary.fallbackDisclosureRequired).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Stale receipt blocks a previously valid itinerary
// ---------------------------------------------------------------------------

describe('Integration: Stale receipt blocks presentation', () => {
  it('validates the STALE receipt structure', () => {
    const result = TripConfidenceReceiptSchema.safeParse(staleReceipt);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outcome).toBe(ReceiptOutcome.STALE);
    }
  });

  it('confirms a stale receipt carries at least one machine-readable blocking reason', () => {
    const receipt = TripConfidenceReceiptSchema.parse(staleReceipt);
    expect(receipt.blockingReasons.length).toBeGreaterThan(0);
    const reason = receipt.blockingReasons[0]!;
    expect(reason.code).toBeTruthy();
    expect(reason.fieldPath).toBeTruthy();
    expect(reason.rule).toBeTruthy();
  });

  it('confirms the stale receipt has at least one stale domain', () => {
    const receipt = TripConfidenceReceiptSchema.parse(staleReceipt);
    expect(receipt.freshnessSummary.staleDomains.length).toBeGreaterThan(0);
    expect(receipt.freshnessSummary.allWithinFreshnessWindow).toBe(false);
  });

  it('rejects a stale receipt that omits blocking reasons (fail closed)', () => {
    const staleWithoutReasons = { ...staleReceipt, blockingReasons: [] };
    const result = TripConfidenceReceiptSchema.safeParse(staleWithoutReasons);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Hallucinated inventory → fails at line-item and receipt level
// ---------------------------------------------------------------------------

describe('Integration: Hallucinated inventory fails closed', () => {
  it('rejects a hallucinated line item at the line-item schema level', () => {
    const result = ItineraryLineItemSchema.safeParse(invalidHallucinatedInventory);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Should identify the missing provenance field
      const msgs = result.error.issues.map((i) => i.message);
      expect(
        msgs.some(
          (m) =>
            m.includes('sourceRecordIdentifier') ||
            m.includes('approvedExemption') ||
            m.includes('inventory truth'),
        ),
      ).toBe(true);
    }
  });

  it('validates the BLOCKED receipt produced for a hallucinated inventory attempt', () => {
    const result = TripConfidenceReceiptSchema.safeParse(
      blockedHallucinatedInventoryReceipt,
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outcome).toBe(ReceiptOutcome.BLOCKED);
    }
  });

  it('confirms the BLOCKED receipt carries a PROVENANCE_MISSING reason', () => {
    const receipt = TripConfidenceReceiptSchema.parse(
      blockedHallucinatedInventoryReceipt,
    );
    expect(receipt.blockingReasons.length).toBeGreaterThan(0);
    const provenanceReason = receipt.blockingReasons.find(
      (r) => r.code === 'PROVENANCE_MISSING',
    );
    expect(provenanceReason).toBeDefined();
    expect(provenanceReason?.fieldPath).toBeTruthy();
    expect(provenanceReason?.rule).toBeTruthy();
  });

  it('confirms allSourcesResolved is false in the BLOCKED receipt', () => {
    const receipt = TripConfidenceReceiptSchema.parse(
      blockedHallucinatedInventoryReceipt,
    );
    expect(receipt.provenanceSummary.allSourcesResolved).toBe(false);
  });

  it('rejects a BLOCKED receipt without machine-readable reasons (fail closed)', () => {
    const withoutReasons = {
      ...blockedHallucinatedInventoryReceipt,
      blockingReasons: [],
    };
    const result = TripConfidenceReceiptSchema.safeParse(withoutReasons);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: unsafe payloads must fail closed (not be coerced)
// ---------------------------------------------------------------------------

describe('Unsafe payloads fail closed — not coerced into partial valid objects', () => {
  it('does not coerce accommodation with public-landmark source into a valid item', () => {
    const unsafe = {
      ...hvmiAccommodationLineItem,
      sourceClassification: 'public-landmark',
    };
    const result = ItineraryLineItemSchema.safeParse(unsafe);
    expect(result.success).toBe(false);
  });

  it('does not coerce a receipt with no blocking reasons into a valid BLOCKED receipt', () => {
    const unsafe = {
      ...blockedHallucinatedInventoryReceipt,
      blockingReasons: [],
    };
    const result = TripConfidenceReceiptSchema.safeParse(unsafe);
    expect(result.success).toBe(false);
  });

  it('does not coerce trip constraints with PII into a valid constraints object', () => {
    const unsafe = {
      ...validTripConstraints,
      email: 'traveller@example.com',
    };
    const result = TripConstraintsSchema.safeParse(unsafe);
    expect(result.success).toBe(false);
  });
});
