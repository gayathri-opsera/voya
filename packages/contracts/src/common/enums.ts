/**
 * Canonical enums shared across all Voya product contracts.
 *
 * These enums are the single source of truth for domain categories,
 * source classifications, exemption types, receipt outcomes, and other
 * controlled vocabularies used by itinerary, sourcing, and verification contracts.
 *
 * Do NOT redefine these strings in other packages – import from here.
 */

/**
 * Top-level inventory domain for a line item in an assembled itinerary.
 */
export enum InventoryDomain {
  ACCOMMODATION = 'accommodation',
  DINING = 'dining',
  ACTIVITY = 'activity',
  FLIGHT = 'flight',
  TRANSPORT = 'transport',
  LANDMARK = 'landmark',
}

/**
 * Source classification for an itinerary line item.
 *
 * - MARRIOTT_OWNED: directly owned Marriott or HVMI property
 * - MARRIOTT_PARTNERED: Marriott brand affiliate or certificated partner
 * - AMADEUS_FLIGHT: flight sourced via Amadeus GDS (explicit approved exemption)
 * - PUBLIC_LANDMARK: public or municipal landmark (explicit approved exemption, non-bookable)
 */
export enum SourceClassification {
  MARRIOTT_OWNED = 'marriott-owned',
  MARRIOTT_PARTNERED = 'marriott-partnered',
  AMADEUS_FLIGHT = 'amadeus-flight',
  PUBLIC_LANDMARK = 'public-landmark',
}

/**
 * Explicit approved exemption types for non-Marriott inventory.
 * Exhaustive; do not extend without an architecture decision record.
 */
export enum ApprovedExemptionType {
  AMADEUS_FLIGHT = 'amadeus-flight',
  PUBLIC_LANDMARK = 'public-landmark',
  MUNICIPAL_LANDMARK = 'municipal-landmark',
}

/**
 * Outcome states for a Trip Confidence Receipt.
 *
 * - PASS: itinerary is feasible, exclusively sourced, and fresh — may be presented and checked out
 * - BLOCKED: hard constraint or provenance failure — presentation and checkout are blocked
 * - STALE: data freshness window exceeded — stale until re-verified
 */
export enum ReceiptOutcome {
  PASS = 'pass',
  BLOCKED = 'blocked',
  STALE = 'stale',
}

/**
 * Traveller budget band for trip constraints.
 */
export enum BudgetBand {
  ECONOMY = 'economy',
  MODERATE = 'moderate',
  PREMIUM = 'premium',
  LUXURY = 'luxury',
  ULTRA_LUXURY = 'ultra-luxury',
}

/**
 * Explicit accessibility needs a traveller may declare.
 */
export enum AccessibilityNeed {
  WHEELCHAIR_ACCESSIBLE = 'wheelchair-accessible',
  MOBILITY_AID = 'mobility-aid',
  HEARING_LOOP = 'hearing-loop',
  VISUAL_ASSISTANCE = 'visual-assistance',
  DIETARY_RESTRICTION = 'dietary-restriction',
}

/**
 * Pricing unit for a line item cost entry.
 */
export enum PricingUnit {
  PER_NIGHT = 'per-night',
  PER_PERSON = 'per-person',
  TOTAL = 'total',
  PER_ITEM = 'per-item',
}
 * @voya/contracts — Cross-domain enums
 *
 * These enums are the single source of truth for all cross-domain categorical
 * values used across Voya services. Do NOT redefine these values in downstream
 * packages; import from this module instead.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// PathMode
// Identifies which traveller entry path originated a request or event.
// ---------------------------------------------------------------------------

export const PathModeEnum = z.enum(['PATH_A', 'PATH_B']);
export type PathMode = z.infer<typeof PathModeEnum>;

/**
 * PATH_A — Full-parity self-service portal (faceted search, collections, saved
 *           homes, My Trips, rate transparency).
 * PATH_B — Conversational multi-agent assistant (intent parse, domain fan-out,
 *           deterministic itinerary verification).
 */
export const PathMode = PathModeEnum.enum;

// ---------------------------------------------------------------------------
// InventoryDomain
// Identifies the product domain a sourced line item belongs to.
// ---------------------------------------------------------------------------

export const InventoryDomainEnum = z.enum([
  'ACCOMMODATION',
  'ACTIVITIES',
  'DINING',
  'FLIGHTS',
  'TRANSPORT',
  'WEATHER_ADVISORY',
]);
export type InventoryDomain = z.infer<typeof InventoryDomainEnum>;
export const InventoryDomain = InventoryDomainEnum.enum;

// ---------------------------------------------------------------------------
// BookingSource
// Identifies which upstream connector or inventory source fulfilled a result.
// ---------------------------------------------------------------------------

export const BookingSourceEnum = z.enum([
  'HVMI',         // Homes and Villas by Marriott Bonvoy — queried first for every stay
  'MARRIOTT_BRAND',
  'BONVOY_TOURS_AND_ACTIVITIES',
  'AMADEUS_GDS',
  'MUNICIPAL_PUBLIC', // exempt from exclusivity filter (municipal/public landmarks)
]);
export type BookingSource = z.infer<typeof BookingSourceEnum>;
export const BookingSource = BookingSourceEnum.enum;

// ---------------------------------------------------------------------------
// SourceClassification
// Declares ownership or partnership tier of an inventory source.
// ---------------------------------------------------------------------------

export const SourceClassificationEnum = z.enum([
  'MARRIOTT_OWNED',     // Direct Marriott-brand inventory
  'MARRIOTT_PARTNERED', // HVMI and other contracted partners
  'EXEMPT_PUBLIC',      // Municipal / public attractions exempt from exclusivity
]);
export type SourceClassification = z.infer<typeof SourceClassificationEnum>;
export const SourceClassification = SourceClassificationEnum.enum;

// ---------------------------------------------------------------------------
// DegradedReason
// Typed reason attached to a degraded agent result (Result<T, DegradedReason>).
// ---------------------------------------------------------------------------

export const DegradedReasonEnum = z.enum([
  'SOURCE_TIMEOUT',
  'SAFETY_GATE_BLOCKED',
  'STALE_DATA',
  'SUPPLIER_UNCERTIFIED',
  'EXCLUSIVITY_FILTER_REMOVED',
  'BUDGET_EXCEEDED',
  'AVAILABILITY_FAILED',
  'FRESHNESS_WINDOW_EXPIRED',
  'UNKNOWN',
]);
export type DegradedReason = z.infer<typeof DegradedReasonEnum>;
export const DegradedReason = DegradedReasonEnum.enum;

// ---------------------------------------------------------------------------
// ReceiptOutcome
// Result of a Trip Confidence Receipt evaluation.
// ---------------------------------------------------------------------------

export const ReceiptOutcomeEnum = z.enum([
  'PASS',
  'BLOCKED',
  'STALE',
]);
export type ReceiptOutcome = z.infer<typeof ReceiptOutcomeEnum>;
export const ReceiptOutcome = ReceiptOutcomeEnum.enum;

// ---------------------------------------------------------------------------
// SupplierBookability
// Declared capability of a registered supplier connector.
// ---------------------------------------------------------------------------

export const SupplierBookabilityEnum = z.enum([
  'FULLY_BOOKABLE',   // Can hold, commit and reverse via the platform
  'DEEP_LINK_ONLY',   // Redirects to supplier site; no platform-managed transaction
  'UNAVAILABLE',      // Connector is degraded or offline
]);
export type SupplierBookability = z.infer<typeof SupplierBookabilityEnum>;
export const SupplierBookability = SupplierBookabilityEnum.enum;

// ---------------------------------------------------------------------------
// DataClassificationTier
// Governs retention, access control, and logging policy for data assets.
// ---------------------------------------------------------------------------

export const DataClassificationTierEnum = z.enum([
  'PUBLIC',        // No restrictions; safe to log and display
  'INTERNAL',      // Internal use only; must not be served to unauthenticated clients
  'CONFIDENTIAL',  // PII-adjacent; encrypted at rest, masked in logs
  'RESTRICTED',    // PCI / passport / government ID scope; never logged
]);
export type DataClassificationTier = z.infer<typeof DataClassificationTierEnum>;
export const DataClassificationTier = DataClassificationTierEnum.enum;

// ---------------------------------------------------------------------------
// AuditEventType
// Typed event names written to the immutable audit ledger.
// ---------------------------------------------------------------------------

export const AuditEventTypeEnum = z.enum([
  'SOURCING_ORDER',                // HVMI queried first; order of connectors recorded
  'BRAND_FALLBACK_DISCLOSURE',     // Brand inventory used after HVMI had no eligible results
  'SUPPLIER_EXCLUSION',            // Uncertified supplier dropped from response path
  'SAFETY_GATE_DECISION',          // Destination cleared or blocked
  'RECEIPT_ISSUED',                // Trip Confidence Receipt produced and persisted
  'RECEIPT_STALE_BLOCKED',         // Receipt failed the freshness re-check at checkout
  'LOYALTY_SIMULATED_DEBIT',       // Pseudo-redemption recorded (no real balance changed)
  'CHECKOUT_AUTHORISATION_TAKEN',  // Payment Intent authorised
  'CHECKOUT_COMPENSATED',          // Saga compensation executed after partial failure
  'ITINERARY_PRESENTED',           // Itinerary surfaced to traveller
]);
export type AuditEventType = z.infer<typeof AuditEventTypeEnum>;
export const AuditEventType = AuditEventTypeEnum.enum;

// ---------------------------------------------------------------------------
// RetentionTrigger
// Events that start or reset a data retention clock.
// ---------------------------------------------------------------------------

export const RetentionTriggerEnum = z.enum([
  'BOOKING_CONFIRMED',
  'CHECKOUT_FAILED',
  'CHECKOUT_COMPENSATED',
  'SESSION_EXPIRED',
  'ACCOUNT_DELETED',
  'AUDIT_RETENTION_OVERRIDE',
]);
export type RetentionTrigger = z.infer<typeof RetentionTriggerEnum>;
export const RetentionTrigger = RetentionTriggerEnum.enum;
