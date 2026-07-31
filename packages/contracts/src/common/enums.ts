/**
 * Canonical enums shared across all Voya product contracts.
 *
 * These enums are the single source of truth for domain categories,
 * source classifications, exemption types, receipt outcomes, and other
 * controlled vocabularies used by itinerary, sourcing, and verification contracts.
 *
 * Do NOT redefine these strings in other packages – import from here.
 *
 * NOTE ON DUAL REPRESENTATIONS:
 * `InventoryDomain`, `SourceClassification`, and `ReceiptOutcome` are exposed
 * as plain TypeScript enums (this is the representation the itinerary
 * contracts — TripConstraints, ItineraryLineItem, TripConfidenceReceipt — are
 * built against via `z.nativeEnum(...)`). The Zod-schema counterparts used by
 * cross-domain infrastructure (audit, governance, supplier capability
 * manifest) are exported separately with an `Enum` suffix
 * (`InventoryDomainEnum`, `SourceClassificationEnum`, `ReceiptOutcomeEnum`)
 * and use the persistence-layer (Prisma-aligned) uppercase vocabulary from
 * `@voya/domain-model`. Reconciling these two vocabularies into one is
 * tracked separately and is out of scope for this change.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// InventoryDomain
// Top-level inventory domain for a line item in an assembled itinerary.
// ---------------------------------------------------------------------------
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
// InventoryDomainEnum
// Zod-schema counterpart of InventoryDomain using the persistence-layer
// (Prisma-aligned) uppercase vocabulary. Used by cross-domain infrastructure
// (supplier capability manifest, audit) rather than the itinerary schemas.
// ---------------------------------------------------------------------------

export const InventoryDomainEnum = z.enum([
  'ACCOMMODATION',
  'ACTIVITIES',
  'DINING',
  'FLIGHTS',
  'TRANSPORT',
  'WEATHER_ADVISORY',
]);
export type InventoryDomainType = z.infer<typeof InventoryDomainEnum>;

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
// SourceClassificationEnum
// Zod-schema counterpart of SourceClassification using the persistence-layer
// uppercase vocabulary. Used by the supplier capability manifest.
// ---------------------------------------------------------------------------

export const SourceClassificationEnum = z.enum([
  'MARRIOTT_OWNED',     // Direct Marriott-brand inventory
  'MARRIOTT_PARTNERED', // HVMI and other contracted partners
  'EXEMPT_PUBLIC',      // Municipal / public attractions exempt from exclusivity
]);
export type SourceClassificationType = z.infer<typeof SourceClassificationEnum>;

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
// ReceiptOutcomeEnum
// Zod-schema counterpart of ReceiptOutcome using the persistence-layer
// uppercase vocabulary.
// ---------------------------------------------------------------------------

export const ReceiptOutcomeEnum = z.enum([
  'PASS',
  'BLOCKED',
  'STALE',
]);
export type ReceiptOutcomeType = z.infer<typeof ReceiptOutcomeEnum>;

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
  'MANIFEST_EXCLUSION',            // Supplier excluded via capability manifest policy
  'SAFETY_GATE_DECISION',          // Destination cleared or blocked
  'PROMPT_SAFETY_REJECTION',       // Prompt blocked by safety gate (detailed rejection record)
  'RECEIPT_ISSUED',                // Trip Confidence Receipt produced and persisted
  'RECEIPT_STALE_BLOCKED',         // Receipt failed the freshness re-check at checkout
  'RECEIPT_BLOCKED',               // Receipt blocked for non-freshness policy reason
  'LOYALTY_SIMULATED_DEBIT',       // Pseudo-redemption recorded (no real balance changed)
  'LOYALTY_SIMULATED_QUOTE',       // Simulated points quote produced (no real balance read)
  'LOYALTY_SIMULATED_HOLD',        // Simulated points hold placed (no real balance frozen)
  'LOYALTY_SIMULATED_COMMIT',      // Simulated points commit recorded (no real debit)
  'LOYALTY_SIMULATED_REVERSAL',    // Simulated points reversal recorded (no real credit)
  'CHECKOUT_AUTHORISATION_TAKEN',  // Payment Intent authorised
  'CHECKOUT_COMPENSATED',          // Saga compensation executed after partial failure
  'CHECKOUT_STATE_TRANSITION',     // Checkout state machine transitioned
  'ITINERARY_PRESENTED',           // Itinerary surfaced to traveller
  'AUTHENTICATION_EVENT',          // Traveller authenticated or de-authenticated
  'RETENTION_DECISION',            // Data retention policy decision recorded
  'ADMIN_APPROVAL_EVIDENCE',       // Administrative approval evidence captured
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
