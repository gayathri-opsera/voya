/**
 * @voya/domain-model — Domain Enums and Helpers
 *
 * Plain TypeScript enums and helper functions for the Voya persistence layer.
 * These mirror the Prisma schema enums and provide domain validation helpers
 * for use in services that do not depend on Zod or the generated Prisma client.
 *
 * All enum values are kept in sync with prisma/schema.prisma. If the Prisma
 * schema enum is updated, this file must be updated to match.
 */

// ---------------------------------------------------------------------------
// Enums mirroring Prisma schema (subset shared with @voya/contracts)
// ---------------------------------------------------------------------------

export enum InventoryDomain {
  ACCOMMODATION = 'ACCOMMODATION',
  ACTIVITIES = 'ACTIVITIES',
  DINING = 'DINING',
  FLIGHTS = 'FLIGHTS',
  TRANSPORT = 'TRANSPORT',
  WEATHER_ADVISORY = 'WEATHER_ADVISORY',
}

export enum BookingSource {
  HVMI = 'HVMI',
  MARRIOTT_BRAND = 'MARRIOTT_BRAND',
  BONVOY_TOURS_AND_ACTIVITIES = 'BONVOY_TOURS_AND_ACTIVITIES',
  AMADEUS_GDS = 'AMADEUS_GDS',
  MUNICIPAL_PUBLIC = 'MUNICIPAL_PUBLIC',
}

export enum SourceClassification {
  MARRIOTT_OWNED = 'MARRIOTT_OWNED',
  MARRIOTT_PARTNERED = 'MARRIOTT_PARTNERED',
  EXEMPT_PUBLIC = 'EXEMPT_PUBLIC',
}

export enum SupplierBookability {
  FULLY_BOOKABLE = 'FULLY_BOOKABLE',
  DEEP_LINK_ONLY = 'DEEP_LINK_ONLY',
  UNAVAILABLE = 'UNAVAILABLE',
}

export enum PathMode {
  PATH_A = 'PATH_A',
  PATH_B = 'PATH_B',
}

export enum DataClassificationTier {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED',
}

export enum CancellationSemantics {
  FULL_REFUND_72H = 'FULL_REFUND_72H',
  FULL_REFUND_24H = 'FULL_REFUND_24H',
  PARTIAL_REFUND = 'PARTIAL_REFUND',
  NON_REFUNDABLE = 'NON_REFUNDABLE',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export enum RefundSemantics {
  AUTOMATIC_PLATFORM_REVERSAL = 'AUTOMATIC_PLATFORM_REVERSAL',
  SUPPLIER_INITIATED = 'SUPPLIER_INITIATED',
  MANUAL_RECONCILIATION = 'MANUAL_RECONCILIATION',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export enum SupplierCertificationStatus {
  CERTIFIED = 'CERTIFIED',
  UNCERTIFIED = 'UNCERTIFIED',
  PENDING = 'PENDING',
}

export enum RetentionPurgeAction {
  DELETE = 'DELETE',
  ANONYMIZE = 'ANONYMIZE',
  ARCHIVE = 'ARCHIVE',
}

export enum RetentionApprovalStatus {
  PROVISIONAL = 'PROVISIONAL',
  APPROVED = 'APPROVED',
}

// ---------------------------------------------------------------------------
// Enums new to the persistence layer (not in @voya/contracts)
// ---------------------------------------------------------------------------

export enum ItineraryStatus {
  DRAFT = 'DRAFT',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFIED = 'VERIFIED',
  PRESENTED = 'PRESENTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum TravellerIdentityType {
  BONVOY_AUTHENTICATED = 'BONVOY_AUTHENTICATED',
  GUEST_TOKEN = 'GUEST_TOKEN',
}

// Persistence-layer receipt outcomes include FAIL in addition to the
// API-contract outcomes (PASS/BLOCKED/STALE) in @voya/contracts.
export enum ReceiptOutcomePersisted {
  PASS = 'PASS',
  FAIL = 'FAIL',
  BLOCKED = 'BLOCKED',
  STALE = 'STALE',
}

export enum AuditEventType {
  SOURCING_ORDER = 'SOURCING_ORDER',
  BRAND_FALLBACK_DISCLOSURE = 'BRAND_FALLBACK_DISCLOSURE',
  SUPPLIER_EXCLUSION = 'SUPPLIER_EXCLUSION',
  SAFETY_GATE_DECISION = 'SAFETY_GATE_DECISION',
  RECEIPT_ISSUED = 'RECEIPT_ISSUED',
  RECEIPT_STALE_BLOCKED = 'RECEIPT_STALE_BLOCKED',
  LOYALTY_SIMULATED_DEBIT = 'LOYALTY_SIMULATED_DEBIT',
  CHECKOUT_AUTHORISATION_TAKEN = 'CHECKOUT_AUTHORISATION_TAKEN',
  CHECKOUT_COMPENSATED = 'CHECKOUT_COMPENSATED',
  ITINERARY_PRESENTED = 'ITINERARY_PRESENTED',
}

// ---------------------------------------------------------------------------
// Itinerary status transition helpers
// ---------------------------------------------------------------------------

const VALID_ITINERARY_TRANSITIONS: ReadonlyMap<ItineraryStatus, readonly ItineraryStatus[]> =
  new Map([
    [
      ItineraryStatus.DRAFT,
      [ItineraryStatus.PENDING_VERIFICATION, ItineraryStatus.CANCELLED],
    ],
    [
      ItineraryStatus.PENDING_VERIFICATION,
      [ItineraryStatus.VERIFIED, ItineraryStatus.DRAFT, ItineraryStatus.CANCELLED],
    ],
    [
      ItineraryStatus.VERIFIED,
      [ItineraryStatus.PRESENTED, ItineraryStatus.EXPIRED, ItineraryStatus.CANCELLED],
    ],
    [ItineraryStatus.PRESENTED, [ItineraryStatus.EXPIRED, ItineraryStatus.CANCELLED]],
    [ItineraryStatus.EXPIRED, []],
    [ItineraryStatus.CANCELLED, []],
  ]);

export function isValidItineraryTransition(
  from: ItineraryStatus,
  to: ItineraryStatus,
): boolean {
  return VALID_ITINERARY_TRANSITIONS.get(from)?.includes(to) ?? false;
}

export function isTerminalItineraryStatus(status: ItineraryStatus): boolean {
  return status === ItineraryStatus.EXPIRED || status === ItineraryStatus.CANCELLED;
}

// ---------------------------------------------------------------------------
// Receipt outcome helpers
// ---------------------------------------------------------------------------

export function isTerminalReceiptOutcome(outcome: ReceiptOutcomePersisted): boolean {
  return outcome === ReceiptOutcomePersisted.PASS || outcome === ReceiptOutcomePersisted.FAIL;
}

export function isBlockingReceiptOutcome(outcome: ReceiptOutcomePersisted): boolean {
  return (
    outcome === ReceiptOutcomePersisted.FAIL ||
    outcome === ReceiptOutcomePersisted.BLOCKED ||
    outcome === ReceiptOutcomePersisted.STALE
  );
}

// ---------------------------------------------------------------------------
// Monetary and points validation helpers
// ---------------------------------------------------------------------------

export function validateMinorUnits(amount: number): boolean {
  return Number.isInteger(amount) && amount >= 0;
}

export function validateLatencySeconds(seconds: number): boolean {
  return Number.isInteger(seconds) && seconds > 0;
}

export function validatePointsAmount(points: number): boolean {
  return Number.isInteger(points) && points >= 0;
}
