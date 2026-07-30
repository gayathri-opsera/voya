/**
 * @voya/contracts — Supplier line item test fixtures
 *
 * Represents sourced itinerary line items paired with supplier manifest
 * references for freshness validation integration tests.
 *
 * IMPORTANT: These fixtures must not contain real booking references,
 * traveller PII, pricing data, or production identifiers.
 * All values are synthetic, test-only data.
 */

import type { InventoryDomain } from '../../src/common/enums.js';

// ---------------------------------------------------------------------------
// SupplierLineItem
// A sourced itinerary line item referencing a supplier by supplierId.
// ---------------------------------------------------------------------------

export interface SupplierLineItem {
  /** Stable synthetic reference for this line item (not a real booking ID). */
  readonly lineItemId: string;
  /** Matches a manifest's supplierId in the test fixture set. */
  readonly supplierId: string;
  /** Inventory domain this line item belongs to. */
  readonly domain: InventoryDomain;
  /** Elapsed seconds since the availability cache entry was written. */
  readonly availabilityDataAgeSeconds: number;
  /**
   * Elapsed seconds since the rate cache entry was written.
   * Omit for non-priced line items (e.g. public landmark content).
   */
  readonly rateDataAgeSeconds?: number;
}

// ---------------------------------------------------------------------------
// HVMI accommodation line items
// ---------------------------------------------------------------------------

/**
 * Fresh HVMI line item — both availability and rate within the manifest windows.
 * Availability age: 120s (limit: 300s), rate age: 60s (limit: 120s).
 */
export const freshHvmiAccommodationLineItem: SupplierLineItem = {
  lineItemId: 'li_test_hvmi_accommodation_fresh_001',
  supplierId: 'sup_test_hvmi_accommodation_001',
  domain: 'ACCOMMODATION',
  availabilityDataAgeSeconds: 120, // 2 min < 5 min limit
  rateDataAgeSeconds: 60,           // 1 min < 2 min limit
};

/**
 * Stale availability HVMI line item — availability age exceeds manifest window.
 * Availability age: 400s (limit: 300s) → stale.
 */
export const staleAvailabilityHvmiLineItem: SupplierLineItem = {
  lineItemId: 'li_test_hvmi_accommodation_stale_avail_001',
  supplierId: 'sup_test_hvmi_accommodation_001',
  domain: 'ACCOMMODATION',
  availabilityDataAgeSeconds: 400, // 6.6 min > 5 min limit → STALE
  rateDataAgeSeconds: 60,
};

/**
 * Stale rate HVMI line item — availability fresh but rate age exceeds manifest window.
 * Rate age: 200s (limit: 120s) → stale.
 */
export const staleRateHvmiLineItem: SupplierLineItem = {
  lineItemId: 'li_test_hvmi_accommodation_stale_rate_001',
  supplierId: 'sup_test_hvmi_accommodation_001',
  domain: 'ACCOMMODATION',
  availabilityDataAgeSeconds: 60, // fresh
  rateDataAgeSeconds: 200,         // 3.3 min > 2 min limit → STALE
};

// ---------------------------------------------------------------------------
// Marriott brand accommodation line items
// ---------------------------------------------------------------------------

/**
 * Fresh Marriott brand line item — availability and rate within windows.
 */
export const freshMarriottBrandLineItem: SupplierLineItem = {
  lineItemId: 'li_test_brand_accommodation_fresh_001',
  supplierId: 'sup_test_marriott_brand_accommodation_001',
  domain: 'ACCOMMODATION',
  availabilityDataAgeSeconds: 150,
  rateDataAgeSeconds: 90,
};

// ---------------------------------------------------------------------------
// Amadeus flight line items
// ---------------------------------------------------------------------------

/**
 * Fresh Amadeus flight line item — both within the 60s window.
 */
export const freshAmadeusFlightLineItem: SupplierLineItem = {
  lineItemId: 'li_test_amadeus_flight_fresh_001',
  supplierId: 'sup_test_amadeus_gds_flights_001',
  domain: 'FLIGHTS',
  availabilityDataAgeSeconds: 30,
  rateDataAgeSeconds: 30,
};

/**
 * Stale Amadeus flight line item — age exceeds the tight 60s window.
 */
export const staleAmadeusFlightLineItem: SupplierLineItem = {
  lineItemId: 'li_test_amadeus_flight_stale_001',
  supplierId: 'sup_test_amadeus_gds_flights_001',
  domain: 'FLIGHTS',
  availabilityDataAgeSeconds: 90, // > 60s limit → STALE
  rateDataAgeSeconds: 30,
};

// ---------------------------------------------------------------------------
// Public landmark line items (non-priced)
// ---------------------------------------------------------------------------

/**
 * Fresh public landmark line item — non-priced, no rate data.
 * 12-hour old availability is still within the 24-hour window.
 */
export const freshPublicLandmarkLineItem: SupplierLineItem = {
  lineItemId: 'li_test_public_landmark_fresh_001',
  supplierId: 'sup_test_municipal_landmark_001',
  domain: 'ACTIVITIES',
  availabilityDataAgeSeconds: 43200, // 12h < 24h limit
  rateDataAgeSeconds: undefined,      // non-priced
};

/**
 * Stale public landmark line item — availability older than 24-hour window.
 */
export const stalePublicLandmarkLineItem: SupplierLineItem = {
  lineItemId: 'li_test_public_landmark_stale_001',
  supplierId: 'sup_test_municipal_landmark_001',
  domain: 'ACTIVITIES',
  availabilityDataAgeSeconds: 90000, // > 24h (86400s) → STALE
  rateDataAgeSeconds: undefined,
};

// ---------------------------------------------------------------------------
// Uncertified supplier line item (for integration rejection tests)
// ---------------------------------------------------------------------------

/**
 * Fresh line item from an uncertified supplier.
 * Freshness would pass but manifest validation rejects the supplier.
 */
export const freshUncertifiedLineItem: SupplierLineItem = {
  lineItemId: 'li_test_uncertified_fresh_001',
  supplierId: 'sup_test_uncertified_accommodation_001',
  domain: 'ACCOMMODATION',
  availabilityDataAgeSeconds: 60,
  rateDataAgeSeconds: 30,
};

// ---------------------------------------------------------------------------
// Bonvoy Tours and Activities line items
// ---------------------------------------------------------------------------

/**
 * Fresh Bonvoy Tours line item — within 10-minute availability / 5-minute rate windows.
 */
export const freshBonvoyToursLineItem: SupplierLineItem = {
  lineItemId: 'li_test_bonvoy_tours_fresh_001',
  supplierId: 'sup_test_bonvoy_tours_activities_001',
  domain: 'ACTIVITIES',
  availabilityDataAgeSeconds: 300, // 5 min < 10 min limit
  rateDataAgeSeconds: 150,          // 2.5 min < 5 min limit
};
