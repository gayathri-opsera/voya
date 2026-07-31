/**
 * Unit tests for ItineraryLineItemSchema.
 *
 * AC2: schema requires inventory domain, supplier reference, source classification,
 * source record identifier or approved exemption, provenance label, availability
 * checked timestamp, price freshness timestamp when priced, and traveller-visible
 * source tag.
 *
 * AC4: accommodation, dining, and activity line items without a Marriott-owned
 * or Marriott-partnered source classification must be rejected; only explicitly
 * modelled exemptions for flights and public or municipal landmarks are allowed.
 */

import { describe, expect, it } from 'vitest';
import {
  ApprovedExemptionType,
  InventoryDomain,
  ItineraryLineItemSchema,
  PricingUnit,
  SourceClassification,
} from '../../src/index.js';
import {
  activityLineItem,
  amadeusFlightLineItem,
  brandFallbackAccommodationLineItem,
  diningLineItem,
  hvmiAccommodationLineItem,
  invalidAccommodationWrongSource,
  invalidHallucinatedInventory,
  publicLandmarkLineItem,
} from '../fixtures/itineraries.js';

describe('ItineraryLineItemSchema', () => {
  // =========================================================================
  // Happy path — valid line items per domain
  // =========================================================================

  describe('valid line items', () => {
    it('accepts a valid HVMI-first accommodation line item', () => {
      const result = ItineraryLineItemSchema.safeParse(hvmiAccommodationLineItem);
      expect(result.success).toBe(true);
    });

    it('accepts a valid brand-fallback accommodation (Marriott-partnered)', () => {
      const result = ItineraryLineItemSchema.safeParse(
        brandFallbackAccommodationLineItem,
      );
      expect(result.success).toBe(true);
    });

    it('accepts a valid dining line item (Marriott-partnered)', () => {
      const result = ItineraryLineItemSchema.safeParse(diningLineItem);
      expect(result.success).toBe(true);
    });

    it('accepts a valid activity line item (Marriott-owned)', () => {
      const result = ItineraryLineItemSchema.safeParse(activityLineItem);
      expect(result.success).toBe(true);
    });

    it('accepts a valid flight line item with Amadeus exemption', () => {
      const result = ItineraryLineItemSchema.safeParse(amadeusFlightLineItem);
      expect(result.success).toBe(true);
    });

    it('accepts a valid public landmark line item (no sourceRecordIdentifier)', () => {
      const result = ItineraryLineItemSchema.safeParse(publicLandmarkLineItem);
      expect(result.success).toBe(true);
    });

    it('accepts a landmark with a municipal landmark exemption', () => {
      const municipalItem = {
        ...publicLandmarkLineItem,
        id: 'item_municipal_lm_001',
        approvedExemption: {
          type: ApprovedExemptionType.MUNICIPAL_LANDMARK,
          landmarkName: 'Pioneer Square City Park',
          landmarkId: 'CITY-PARK-SEA-001',
        },
      };
      const result = ItineraryLineItemSchema.safeParse(municipalItem);
      expect(result.success).toBe(true);
    });

    it('accepts an accommodation item with no pricing (non-priced availability check)', () => {
      const { pricing: _, ...withoutPricing } = hvmiAccommodationLineItem;
      const result = ItineraryLineItemSchema.safeParse(withoutPricing);
      expect(result.success).toBe(true);
    });

    it('normalises currency to uppercase', () => {
      const item = {
        ...hvmiAccommodationLineItem,
        pricing: { ...hvmiAccommodationLineItem.pricing!, currency: 'usd' },
      };
      const result = ItineraryLineItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pricing?.currency).toBe('USD');
      }
    });
  });

  // =========================================================================
  // AC4 — Marriott-only domains: accommodation, dining, activity, transport
  // =========================================================================

  describe('AC4: Marriott-exclusive domain classification enforcement', () => {
    it('rejects accommodation with amadeus-flight source classification', () => {
      const result = ItineraryLineItemSchema.safeParse(
        invalidAccommodationWrongSource,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('sourceClassification');
      }
    });

    it('rejects accommodation with public-landmark source classification', () => {
      const payload = {
        ...hvmiAccommodationLineItem,
        sourceClassification: SourceClassification.PUBLIC_LANDMARK,
      };
      const result = ItineraryLineItemSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('sourceClassification');
      }
    });

    it('rejects dining with amadeus-flight source classification', () => {
      const payload = {
        ...diningLineItem,
        sourceClassification: SourceClassification.AMADEUS_FLIGHT,
      };
      const result = ItineraryLineItemSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects activity with public-landmark source classification', () => {
      const payload = {
        ...activityLineItem,
        sourceClassification: SourceClassification.PUBLIC_LANDMARK,
      };
      const result = ItineraryLineItemSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects transport with public-landmark source classification', () => {
      const transportItem = {
        id: 'item_transport_001',
        name: 'Airport Transfer',
        inventoryDomain: InventoryDomain.TRANSPORT,
        supplierReference: 'hvmi-transport-001',
        sourceClassification: SourceClassification.PUBLIC_LANDMARK, // ← INVALID
        sourceRecordIdentifier: 'HVMI-TRANSPORT-001',
        provenanceLabel: 'Marriott Transport',
        availabilityCheckedAt: '2025-09-15T09:50:00.000Z',
        travellerVisibleSourceTag: 'Marriott',
      };
      const result = ItineraryLineItemSchema.safeParse(transportItem);
      expect(result.success).toBe(false);
    });

    it('accepts transport with marriott-owned source classification', () => {
      const transportItem = {
        id: 'item_transport_002',
        name: 'Airport Transfer',
        inventoryDomain: InventoryDomain.TRANSPORT,
        supplierReference: 'hvmi-transport-002',
        sourceClassification: SourceClassification.MARRIOTT_OWNED,
        sourceRecordIdentifier: 'HVMI-TRANSPORT-002',
        provenanceLabel: 'Marriott Transport',
        availabilityCheckedAt: '2025-09-15T09:50:00.000Z',
        travellerVisibleSourceTag: 'Marriott',
      };
      const result = ItineraryLineItemSchema.safeParse(transportItem);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // Hallucinated inventory — must fail closed
  // =========================================================================

  describe('hallucinated inventory rejection', () => {
    it('rejects a line item with neither sourceRecordIdentifier nor approvedExemption', () => {
      const result = ItineraryLineItemSchema.safeParse(
        invalidHallucinatedInventory,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const msgs = result.error.issues.map((i) => i.message);
        expect(
          msgs.some((m) => m.includes('sourceRecordIdentifier') || m.includes('approvedExemption')),
        ).toBe(true);
      }
    });
  });

  // =========================================================================
  // Flight exemption rules
  // =========================================================================

  describe('flight domain rules', () => {
    it('rejects a flight with marriott-owned source classification', () => {
      const payload = {
        ...amadeusFlightLineItem,
        sourceClassification: SourceClassification.MARRIOTT_OWNED,
        approvedExemption: {
          type: ApprovedExemptionType.AMADEUS_FLIGHT,
          amadeusFlightRef: 'AA198-20250920-LAX-OGG',
        },
      };
      const result = ItineraryLineItemSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects a flight exemption on an accommodation domain', () => {
      const payload = {
        ...hvmiAccommodationLineItem,
        approvedExemption: {
          type: ApprovedExemptionType.AMADEUS_FLIGHT,
          amadeusFlightRef: 'AA100-LAX-HNL',
        },
      };
      const result = ItineraryLineItemSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects a flight with a public-landmark exemption type', () => {
      const payload = {
        ...amadeusFlightLineItem,
        approvedExemption: {
          type: ApprovedExemptionType.PUBLIC_LANDMARK,
          landmarkName: 'Some Landmark',
        },
      };
      const result = ItineraryLineItemSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Landmark exemption rules
  // =========================================================================

  describe('landmark domain rules', () => {
    it('rejects a landmark with marriott-owned source classification', () => {
      const payload = {
        ...publicLandmarkLineItem,
        sourceClassification: SourceClassification.MARRIOTT_OWNED,
      };
      const result = ItineraryLineItemSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects a landmark exemption on a dining domain', () => {
      const payload = {
        ...diningLineItem,
        approvedExemption: {
          type: ApprovedExemptionType.PUBLIC_LANDMARK,
          landmarkName: 'Public Square',
        },
      };
      const result = ItineraryLineItemSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects an amadeus-flight exemption on a landmark domain', () => {
      const payload = {
        ...publicLandmarkLineItem,
        sourceClassification: SourceClassification.AMADEUS_FLIGHT,
        approvedExemption: {
          type: ApprovedExemptionType.AMADEUS_FLIGHT,
          amadeusFlightRef: 'AA198',
        },
      };
      const result = ItineraryLineItemSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Pricing validation
  // =========================================================================

  describe('pricing', () => {
    it('requires priceFreshnessAt inside a pricing block', () => {
      const { priceFreshnessAt: _, ...pricingWithoutFreshness } = {
        ...hvmiAccommodationLineItem.pricing!,
      };
      const payload = {
        ...hvmiAccommodationLineItem,
        pricing: pricingWithoutFreshness,
      };
      const result = ItineraryLineItemSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects negative pricing amounts', () => {
      const payload = {
        ...hvmiAccommodationLineItem,
        pricing: { ...hvmiAccommodationLineItem.pricing!, amount: -50 },
      };
      const result = ItineraryLineItemSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects an invalid currency code (wrong length)', () => {
      const payload = {
        ...hvmiAccommodationLineItem,
        pricing: { ...hvmiAccommodationLineItem.pricing!, currency: 'US' },
      };
      const result = ItineraryLineItemSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects an invalid pricing unit', () => {
      const payload = {
        ...hvmiAccommodationLineItem,
        pricing: {
          ...hvmiAccommodationLineItem.pricing!,
          unit: 'per-week' as PricingUnit,
        },
      };
      const result = ItineraryLineItemSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Required fields
  // =========================================================================

  describe('required fields', () => {
    const required = [
      'id',
      'name',
      'inventoryDomain',
      'supplierReference',
      'sourceClassification',
      'provenanceLabel',
      'availabilityCheckedAt',
      'travellerVisibleSourceTag',
    ] as const;

    for (const field of required) {
      it(`rejects when '${field}' is missing`, () => {
        const { [field]: _, ...without } = hvmiAccommodationLineItem as Record<
          string,
          unknown
        >;
        const result = ItineraryLineItemSchema.safeParse(without);
        expect(result.success, `'${field}' should be required`).toBe(false);
      });
    }

    it('rejects extra unknown fields (strict mode)', () => {
      const payload = {
        ...hvmiAccommodationLineItem,
        hallucinatedField: 'should-fail',
      };
      const result = ItineraryLineItemSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
