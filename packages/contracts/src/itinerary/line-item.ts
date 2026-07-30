/**
 * ItineraryLineItem — sourced, priced, and freshness-aware itinerary entry.
 *
 * SOURCING EXCLUSIVITY INVARIANT:
 *   Every traveller-visible line item must either:
 *   a) carry a Marriott-owned or Marriott-partnered source classification, OR
 *   b) declare an explicitly modelled approved exemption (Amadeus flight or
 *      public/municipal landmark).
 *
 *   There are no other exemptions. An open-ended optional provenance field
 *   would make the zero-hallucinated-inventory guarantee unenforceable.
 *
 * DOMAIN → CLASSIFICATION RULES (AC4):
 *   - accommodation, dining, activity → MUST be marriott-owned | marriott-partnered
 *   - flight                          → MUST be amadeus-flight
 *   - transport                       → MUST be marriott-owned | marriott-partnered
 *   - landmark                        → MUST be public-landmark
 *
 * FRESHNESS:
 *   When a line item carries pricing, priceFreshnessAt is REQUIRED inside the
 *   pricing block. availabilityCheckedAt is always required.
 */

import { z } from 'zod';
import {
  ApprovedExemptionType,
  InventoryDomain,
  PricingUnit,
  SourceClassification,
} from '../common/enums.js';

// ---------------------------------------------------------------------------
// Approved exemption sub-schemas — exhaustive union; no catch-all
// ---------------------------------------------------------------------------

/**
 * Exemption for flights sourced via Amadeus GDS.
 * amadeusFlightRef must contain the GDS PNR segment reference.
 */
export const AmadeusFlightExemptionSchema = z.object({
  type: z.literal(ApprovedExemptionType.AMADEUS_FLIGHT),
  amadeusFlightRef: z
    .string()
    .min(1, { message: 'amadeusFlightRef must not be empty' }),
});

export type AmadeusFlightExemption = z.infer<typeof AmadeusFlightExemptionSchema>;

/**
 * Exemption for publicly accessible, non-bookable landmark content.
 * The platform may display these but cannot transact them.
 */
export const PublicLandmarkExemptionSchema = z.object({
  type: z.literal(ApprovedExemptionType.PUBLIC_LANDMARK),
  landmarkName: z
    .string()
    .min(1, { message: 'landmarkName must not be empty' }),
  landmarkId: z.string().optional(),
});

export type PublicLandmarkExemption = z.infer<typeof PublicLandmarkExemptionSchema>;

/**
 * Exemption for municipal (government-operated) landmarks and public spaces.
 */
export const MunicipalLandmarkExemptionSchema = z.object({
  type: z.literal(ApprovedExemptionType.MUNICIPAL_LANDMARK),
  landmarkName: z
    .string()
    .min(1, { message: 'landmarkName must not be empty' }),
  landmarkId: z.string().optional(),
});

export type MunicipalLandmarkExemption = z.infer<typeof MunicipalLandmarkExemptionSchema>;

/**
 * Discriminated union of all approved exemptions.
 * Adding a new exemption requires an architecture decision record.
 */
export const ApprovedExemptionSchema = z.discriminatedUnion('type', [
  AmadeusFlightExemptionSchema,
  PublicLandmarkExemptionSchema,
  MunicipalLandmarkExemptionSchema,
]);

export type ApprovedExemption = z.infer<typeof ApprovedExemptionSchema>;

// ---------------------------------------------------------------------------
// Pricing metadata
// ---------------------------------------------------------------------------

/**
 * Pricing block for a priced line item.
 * priceFreshnessAt is REQUIRED when pricing is present (AC2).
 */
export const LineItemPricingSchema = z.object({
  amount: z
    .number()
    .nonnegative({ message: 'Pricing amount must be zero or positive' }),
  currency: z
    .string()
    .length(3, { message: 'currency must be an ISO 4217 three-letter code' })
    .toUpperCase(),
  unit: z.nativeEnum(PricingUnit, {
    errorMap: () => ({
      message: `unit must be one of: ${Object.values(PricingUnit).join(', ')}`,
    }),
  }),
  isEstimate: z.boolean().default(false),
  /**
   * Timestamp of the most recent price resolution for this item.
   * Required when the pricing block is present.
   */
  priceFreshnessAt: z.string().datetime({
    message:
      'priceFreshnessAt must be a valid ISO 8601 UTC datetime string',
  }),
});

export type LineItemPricing = z.infer<typeof LineItemPricingSchema>;

// ---------------------------------------------------------------------------
// Domains that require Marriott-owned or Marriott-partnered classification
// ---------------------------------------------------------------------------

const MARRIOTT_EXCLUSIVE_DOMAINS: ReadonlySet<InventoryDomain> = new Set([
  InventoryDomain.ACCOMMODATION,
  InventoryDomain.DINING,
  InventoryDomain.ACTIVITY,
  InventoryDomain.TRANSPORT,
]);

const MARRIOTT_CLASSIFICATIONS: ReadonlySet<SourceClassification> = new Set([
  SourceClassification.MARRIOTT_OWNED,
  SourceClassification.MARRIOTT_PARTNERED,
]);

// ---------------------------------------------------------------------------
// ItineraryLineItemSchema
// ---------------------------------------------------------------------------

/**
 * Canonical schema for a single line item in an assembled itinerary.
 *
 * AC2 requirements:
 *   - inventoryDomain        (InventoryDomain enum)
 *   - supplierReference      (non-empty string)
 *   - sourceClassification   (SourceClassification enum)
 *   - sourceRecordIdentifier OR approvedExemption
 *   - provenanceLabel
 *   - availabilityCheckedAt  (ISO datetime)
 *   - pricing.priceFreshnessAt when pricing is present
 *   - travellerVisibleSourceTag
 *
 * AC4 classification constraints:
 *   - accommodation / dining / activity / transport → Marriott-owned or Marriott-partnered
 *   - flight → amadeus-flight
 *   - landmark → public-landmark
 */
export const ItineraryLineItemSchema = z
  .object({
    /** Stable identifier for this line item within the itinerary. */
    id: z.string().min(1, { message: 'id must not be empty' }),

    /** Human-readable display name for this line item. */
    name: z.string().min(1, { message: 'name must not be empty' }),

    /** Optional extended description shown on the review canvas. */
    description: z.string().optional(),

    /** Top-level category of inventory. */
    inventoryDomain: z.nativeEnum(InventoryDomain, {
      errorMap: () => ({
        message: `inventoryDomain must be one of: ${Object.values(InventoryDomain).join(', ')}`,
      }),
    }),

    /**
     * Supplier's own identifier for this property/service/flight.
     * Must match a manifest-certified connector reference.
     */
    supplierReference: z
      .string()
      .min(1, { message: 'supplierReference must not be empty' }),

    /**
     * Source classification driving the exclusivity policy check.
     * Validated against inventoryDomain in superRefine below.
     */
    sourceClassification: z.nativeEnum(SourceClassification, {
      errorMap: () => ({
        message: `sourceClassification must be one of: ${Object.values(SourceClassification).join(', ')}`,
      }),
    }),

    /**
     * The supplier's canonical record identifier (e.g. HVMI property ID,
     * Marriott brand property code). Required unless approvedExemption is present.
     */
    sourceRecordIdentifier: z.string().min(1).optional(),

    /**
     * Explicit approved exemption for non-Marriott inventory.
     * Required when sourceRecordIdentifier is absent.
     * Must match the inventoryDomain (flights→amadeus, landmarks→public/municipal).
     */
    approvedExemption: ApprovedExemptionSchema.optional(),

    /**
     * Human-readable provenance label shown to the traveller if they request
     * source transparency (e.g. "Marriott Homes & Villas", "Amadeus GDS").
     */
    provenanceLabel: z
      .string()
      .min(1, { message: 'provenanceLabel must not be empty' }),

    /**
     * Timestamp of the most recent live availability check for this item.
     * Required for all line items regardless of domain.
     */
    availabilityCheckedAt: z.string().datetime({
      message:
        'availabilityCheckedAt must be a valid ISO 8601 UTC datetime string',
    }),

    /**
     * Pricing metadata including the freshness timestamp.
     * Optional for non-bookable items (public landmarks, informational transport).
     */
    pricing: LineItemPricingSchema.optional(),

    /**
     * Short source attribution string rendered in the traveller-facing UI
     * (e.g. "Homes & Villas by Marriott Bonvoy", "Amadeus").
     */
    travellerVisibleSourceTag: z
      .string()
      .min(1, { message: 'travellerVisibleSourceTag must not be empty' }),

    /** Optional ISO 8601 start time for time-bound items (activities, flights, dining). */
    startAt: z.string().datetime().optional(),

    /** Optional ISO 8601 end time. */
    endAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine((item, ctx) => {
    // -------------------------------------------------------------------
    // Rule 1: Every item must carry a source record OR an approved exemption.
    //         Both absent → fail closed.
    // -------------------------------------------------------------------
    const hasRecord = item.sourceRecordIdentifier !== undefined;
    const hasExemption = item.approvedExemption !== undefined;

    if (!hasRecord && !hasExemption) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Either sourceRecordIdentifier or approvedExemption must be provided — ' +
          'the model must never be treated as a source of inventory truth',
        path: ['sourceRecordIdentifier'],
      });
    }

    // -------------------------------------------------------------------
    // Rule 2: Accommodation, dining, activity, and transport must use a
    //         Marriott-owned or Marriott-partnered source classification.
    // -------------------------------------------------------------------
    if (MARRIOTT_EXCLUSIVE_DOMAINS.has(item.inventoryDomain)) {
      if (!MARRIOTT_CLASSIFICATIONS.has(item.sourceClassification)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `${item.inventoryDomain} items must have sourceClassification of ` +
            `'${SourceClassification.MARRIOTT_OWNED}' or '${SourceClassification.MARRIOTT_PARTNERED}', ` +
            `got '${item.sourceClassification}'`,
          path: ['sourceClassification'],
        });
      }
    }

    // -------------------------------------------------------------------
    // Rule 3: Flights must use amadeus-flight classification.
    //         A non-Amadeus flight classification fails closed.
    // -------------------------------------------------------------------
    if (item.inventoryDomain === InventoryDomain.FLIGHT) {
      if (item.sourceClassification !== SourceClassification.AMADEUS_FLIGHT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `Flight line items must have sourceClassification '${SourceClassification.AMADEUS_FLIGHT}', ` +
            `got '${item.sourceClassification}'`,
          path: ['sourceClassification'],
        });
      }
      // Flight exemptions must be of the amadeus-flight type
      if (
        hasExemption &&
        item.approvedExemption!.type !== ApprovedExemptionType.AMADEUS_FLIGHT
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `Flight line items must use an '${ApprovedExemptionType.AMADEUS_FLIGHT}' exemption, ` +
            `got '${item.approvedExemption!.type}'`,
          path: ['approvedExemption', 'type'],
        });
      }
    }

    // -------------------------------------------------------------------
    // Rule 4: Landmark items must use public-landmark classification.
    //         Landmarks may omit sourceRecordIdentifier only when an explicit
    //         public or municipal landmark exemption is present.
    // -------------------------------------------------------------------
    if (item.inventoryDomain === InventoryDomain.LANDMARK) {
      if (item.sourceClassification !== SourceClassification.PUBLIC_LANDMARK) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `Landmark line items must have sourceClassification '${SourceClassification.PUBLIC_LANDMARK}', ` +
            `got '${item.sourceClassification}'`,
          path: ['sourceClassification'],
        });
      }
      // Landmark exemptions must be of public or municipal type
      if (
        hasExemption &&
        item.approvedExemption!.type !== ApprovedExemptionType.PUBLIC_LANDMARK &&
        item.approvedExemption!.type !== ApprovedExemptionType.MUNICIPAL_LANDMARK
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `Landmark line items must use a '${ApprovedExemptionType.PUBLIC_LANDMARK}' or ` +
            `'${ApprovedExemptionType.MUNICIPAL_LANDMARK}' exemption, ` +
            `got '${item.approvedExemption!.type}'`,
          path: ['approvedExemption', 'type'],
        });
      }
    }

    // -------------------------------------------------------------------
    // Rule 5: Cross-domain exemption type mismatch must fail closed.
    //         (e.g. amadeus-flight exemption on an accommodation item)
    // -------------------------------------------------------------------
    if (hasExemption) {
      const exemptionType = item.approvedExemption!.type;

      const isFlightExemption =
        exemptionType === ApprovedExemptionType.AMADEUS_FLIGHT;
      const isLandmarkExemption =
        exemptionType === ApprovedExemptionType.PUBLIC_LANDMARK ||
        exemptionType === ApprovedExemptionType.MUNICIPAL_LANDMARK;

      if (
        isFlightExemption &&
        item.inventoryDomain !== InventoryDomain.FLIGHT
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `'${ApprovedExemptionType.AMADEUS_FLIGHT}' exemption is only valid for flight inventory domains`,
          path: ['approvedExemption', 'type'],
        });
      }

      if (
        isLandmarkExemption &&
        item.inventoryDomain !== InventoryDomain.LANDMARK
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `'${exemptionType}' exemption is only valid for landmark inventory domains`,
          path: ['approvedExemption', 'type'],
        });
      }
    }
  });

export type ItineraryLineItem = z.infer<typeof ItineraryLineItemSchema>;
