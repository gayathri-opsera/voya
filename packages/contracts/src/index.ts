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
 * @voya/contracts — Public API surface
 *
 * All symbols exported from this file constitute the stable public contract
 * for the @voya/contracts package. Downstream services must import from
 * '@voya/contracts' rather than from internal subpaths.
 *
 * Adding symbols is a non-breaking (additive) change.
 * Removing or renaming exported symbols is a BREAKING change and requires a
 * semver major bump.
 *
 * Package version: see package.json (0.1.0)
 */

// ---------------------------------------------------------------------------
// Common: enums — Zod schemas (runtime validation)
// ---------------------------------------------------------------------------

export {
  PathModeEnum,
  InventoryDomainEnum,
  BookingSourceEnum,
  SourceClassificationEnum,
  DegradedReasonEnum,
  ReceiptOutcomeEnum,
  SupplierBookabilityEnum,
  DataClassificationTierEnum,
  AuditEventTypeEnum,
  RetentionTriggerEnum,
} from './common/enums.js';

// ---------------------------------------------------------------------------
// Common: enums — runtime value objects (e.g. PathMode.PATH_A)
// ---------------------------------------------------------------------------

export {
  PathMode,
  InventoryDomain,
  BookingSource,
  SourceClassification,
  DegradedReason,
  ReceiptOutcome,
  SupplierBookability,
  DataClassificationTier,
  AuditEventType,
  RetentionTrigger,
} from './common/enums.js';

// ---------------------------------------------------------------------------
// Common: enums — inferred TypeScript types
// ---------------------------------------------------------------------------

export type {
  PathMode as PathModeType,
  InventoryDomain as InventoryDomainType,
  BookingSource as BookingSourceType,
  SourceClassification as SourceClassificationType,
  DegradedReason as DegradedReasonType,
  ReceiptOutcome as ReceiptOutcomeType,
  SupplierBookability as SupplierBookabilityType,
  DataClassificationTier as DataClassificationTierType,
  AuditEventType as AuditEventTypeType,
  RetentionTrigger as RetentionTriggerType,
} from './common/enums.js';

// ---------------------------------------------------------------------------
// Common: API error envelope — schema, types, and helpers
// ---------------------------------------------------------------------------

export {
  ApiErrorDetailSchema,
  ApiErrorSchema,
  parseApiError,
} from './common/api-error.js';

export type {
  ApiErrorDetail,
  ApiError,
  ApiErrorParseResult,
} from './common/api-error.js';
