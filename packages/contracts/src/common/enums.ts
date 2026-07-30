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
