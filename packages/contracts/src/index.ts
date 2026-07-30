/**
 * @voya/contracts — Public API
 *
 * Exports all canonical enums, Zod schemas, and TypeScript types for the
 * Voya platform's shared product contracts.
 *
 * Import patterns:
 *   import { TripConstraintsSchema, InventoryDomain } from '@voya/contracts'
 *   import type { TripConstraints, ItineraryLineItem } from '@voya/contracts'
 */

// ---------------------------------------------------------------------------
// Common vocabulary
// ---------------------------------------------------------------------------

export {
  AccessibilityNeed,
  ApprovedExemptionType,
  BudgetBand,
  InventoryDomain,
  PricingUnit,
  ReceiptOutcome,
  SourceClassification,
} from './common/enums.js';

// ---------------------------------------------------------------------------
// Itinerary — TripConstraints
// ---------------------------------------------------------------------------

export {
  CoordinatesSchema,
  DateWindowSchema,
  DestinationSchema,
  PartyCompositionSchema,
  TripConstraintsSchema,
} from './itinerary/trip-constraints.js';

export type {
  Coordinates,
  DateWindow,
  Destination,
  PartyComposition,
  TripConstraints,
} from './itinerary/trip-constraints.js';

// ---------------------------------------------------------------------------
// Itinerary — ItineraryLineItem
// ---------------------------------------------------------------------------

export {
  AmadeusFlightExemptionSchema,
  ApprovedExemptionSchema,
  ItineraryLineItemSchema,
  LineItemPricingSchema,
  MunicipalLandmarkExemptionSchema,
  PublicLandmarkExemptionSchema,
} from './itinerary/line-item.js';

export type {
  AmadeusFlightExemption,
  ApprovedExemption,
  ItineraryLineItem,
  LineItemPricing,
  MunicipalLandmarkExemption,
  PublicLandmarkExemption,
} from './itinerary/line-item.js';

// ---------------------------------------------------------------------------
// Itinerary — TripConfidenceReceipt
// ---------------------------------------------------------------------------

export {
  BlockingReasonSchema,
  FeasibilitySummarySchema,
  FreshnessSummarySchema,
  ProvenanceSummarySchema,
  TripConfidenceReceiptSchema,
} from './itinerary/trip-confidence-receipt.js';

export type {
  BlockingReason,
  FeasibilitySummary,
  FreshnessSummary,
  ProvenanceSummary,
  TripConfidenceReceipt,
} from './itinerary/trip-confidence-receipt.js';
