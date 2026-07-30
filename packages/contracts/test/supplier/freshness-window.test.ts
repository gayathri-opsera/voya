/**
 * Unit and integration tests for @voya/contracts — Freshness window helpers
 *
 * Tests cover:
 *  - getAvailabilityMaxAgeSeconds: returns manifest availability latency
 *  - getRateMaxAgeSeconds: returns rate latency or null for non-priced
 *  - isAvailabilityStale: false when fresh, true when stale
 *  - isRateStale: false when fresh, true when stale, false for non-priced
 *  - evaluateFreshness: FRESH / STALE / UNRATABLE composite grades
 *  - Integration: itinerary line items validated against supplier manifests
 *  - Integration: uncertified suppliers excluded before receipt validation
 */

import { describe, it, expect } from 'vitest';
import {
  getAvailabilityMaxAgeSeconds,
  getRateMaxAgeSeconds,
  isAvailabilityStale,
  isRateStale,
  evaluateFreshness,
} from '../../src/supplier/freshness-window.js';
import { validateManifest } from '../../src/supplier/capability-manifest.js';
import {
  hvmiManifest,
  marriottBrandManifest,
  amadeusManifest,
  bonvoyToursManifest,
  publicLandmarkManifest,
  uncertifiedSupplierManifest,
  pricedWithoutRateLatencyManifest,
} from '../fixtures/supplier-manifests.js';
import {
  freshHvmiAccommodationLineItem,
  staleAvailabilityHvmiLineItem,
  staleRateHvmiLineItem,
  freshMarriottBrandLineItem,
  freshAmadeusFlightLineItem,
  staleAmadeusFlightLineItem,
  freshPublicLandmarkLineItem,
  stalePublicLandmarkLineItem,
  freshUncertifiedLineItem,
  freshBonvoyToursLineItem,
} from '../fixtures/supplier-line-items.js';

// ---------------------------------------------------------------------------
// getAvailabilityMaxAgeSeconds
// ---------------------------------------------------------------------------

describe('getAvailabilityMaxAgeSeconds', () => {
  it('returns the HVMI availability refresh latency (300s)', () => {
    expect(getAvailabilityMaxAgeSeconds(hvmiManifest)).toBe(300);
  });

  it('returns the Amadeus availability refresh latency (60s)', () => {
    expect(getAvailabilityMaxAgeSeconds(amadeusManifest)).toBe(60);
  });

  it('returns the Bonvoy Tours availability refresh latency (600s)', () => {
    expect(getAvailabilityMaxAgeSeconds(bonvoyToursManifest)).toBe(600);
  });

  it('returns the public landmark availability refresh latency (86400s)', () => {
    expect(getAvailabilityMaxAgeSeconds(publicLandmarkManifest)).toBe(86400);
  });

  it('always equals the manifest availabilityRefreshLatencySeconds property', () => {
    for (const manifest of [hvmiManifest, marriottBrandManifest, amadeusManifest, bonvoyToursManifest]) {
      expect(getAvailabilityMaxAgeSeconds(manifest)).toBe(manifest.availabilityRefreshLatencySeconds);
    }
  });
});

// ---------------------------------------------------------------------------
// getRateMaxAgeSeconds
// ---------------------------------------------------------------------------

describe('getRateMaxAgeSeconds', () => {
  it('returns the HVMI rate refresh latency (120s)', () => {
    expect(getRateMaxAgeSeconds(hvmiManifest)).toBe(120);
  });

  it('returns the Amadeus rate refresh latency (60s)', () => {
    expect(getRateMaxAgeSeconds(amadeusManifest)).toBe(60);
  });

  it('returns null for the non-priced public landmark supplier', () => {
    expect(getRateMaxAgeSeconds(publicLandmarkManifest)).toBeNull();
  });

  it('returns null when rateRefreshLatencySeconds is undefined', () => {
    const manifest = { ...hvmiManifest, rateRefreshLatencySeconds: undefined };
    expect(getRateMaxAgeSeconds(manifest)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isAvailabilityStale
// ---------------------------------------------------------------------------

describe('isAvailabilityStale', () => {
  it('returns false when data age is less than the availability latency', () => {
    expect(isAvailabilityStale(hvmiManifest, 120)).toBe(false); // 120 < 300
  });

  it('returns false when data age equals the availability latency', () => {
    expect(isAvailabilityStale(hvmiManifest, 300)).toBe(false); // 300 == 300, not > 300
  });

  it('returns true when data age exceeds the availability latency', () => {
    expect(isAvailabilityStale(hvmiManifest, 301)).toBe(true); // 301 > 300
  });

  it('returns false for fresh HVMI fixture line item (120s < 300s)', () => {
    expect(isAvailabilityStale(hvmiManifest, freshHvmiAccommodationLineItem.availabilityDataAgeSeconds)).toBe(false);
  });

  it('returns true for stale HVMI fixture line item (400s > 300s)', () => {
    expect(isAvailabilityStale(hvmiManifest, staleAvailabilityHvmiLineItem.availabilityDataAgeSeconds)).toBe(true);
  });

  it('uses the tight Amadeus latency (60s): returns false at 30s', () => {
    expect(isAvailabilityStale(amadeusManifest, 30)).toBe(false);
  });

  it('uses the tight Amadeus latency (60s): returns true at 90s', () => {
    expect(isAvailabilityStale(amadeusManifest, 90)).toBe(true);
  });

  it('accepts 12h old landmark data against 24h window (returns false)', () => {
    expect(isAvailabilityStale(publicLandmarkManifest, freshPublicLandmarkLineItem.availabilityDataAgeSeconds)).toBe(false);
  });

  it('rejects 25h old landmark data against 24h window (returns true)', () => {
    expect(isAvailabilityStale(publicLandmarkManifest, stalePublicLandmarkLineItem.availabilityDataAgeSeconds)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isRateStale
// ---------------------------------------------------------------------------

describe('isRateStale', () => {
  it('returns false when rate age is less than rate latency', () => {
    expect(isRateStale(hvmiManifest, 60)).toBe(false); // 60 < 120
  });

  it('returns false when rate age equals rate latency', () => {
    expect(isRateStale(hvmiManifest, 120)).toBe(false); // 120 == 120, not > 120
  });

  it('returns true when rate age exceeds rate latency', () => {
    expect(isRateStale(hvmiManifest, 121)).toBe(true); // 121 > 120
  });

  it('returns false for a fresh HVMI rate (60s < 120s)', () => {
    expect(isRateStale(hvmiManifest, freshHvmiAccommodationLineItem.rateDataAgeSeconds!)).toBe(false);
  });

  it('returns true for a stale HVMI rate (200s > 120s)', () => {
    expect(isRateStale(hvmiManifest, staleRateHvmiLineItem.rateDataAgeSeconds!)).toBe(true);
  });

  it('returns false for a non-priced supplier regardless of age', () => {
    expect(isRateStale(publicLandmarkManifest, 999999)).toBe(false);
  });

  it('returns false when rateRefreshLatencySeconds is undefined', () => {
    const manifest = { ...hvmiManifest, rateRefreshLatencySeconds: undefined };
    expect(isRateStale(manifest, 9999)).toBe(false);
  });

  it('uses the tight Amadeus rate latency (60s): returns true at 61s', () => {
    expect(isRateStale(amadeusManifest, 61)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateFreshness
// ---------------------------------------------------------------------------

describe('evaluateFreshness', () => {
  it('returns FRESH for a fresh HVMI line item', () => {
    const result = evaluateFreshness({
      manifest: hvmiManifest,
      availabilityDataAgeSeconds: freshHvmiAccommodationLineItem.availabilityDataAgeSeconds,
      rateDataAgeSeconds: freshHvmiAccommodationLineItem.rateDataAgeSeconds,
    });
    expect(result).toBe('FRESH');
  });

  it('returns STALE when availability age exceeds latency', () => {
    const result = evaluateFreshness({
      manifest: hvmiManifest,
      availabilityDataAgeSeconds: staleAvailabilityHvmiLineItem.availabilityDataAgeSeconds,
      rateDataAgeSeconds: staleAvailabilityHvmiLineItem.rateDataAgeSeconds,
    });
    expect(result).toBe('STALE');
  });

  it('returns STALE when rate age exceeds latency (availability fresh)', () => {
    const result = evaluateFreshness({
      manifest: hvmiManifest,
      availabilityDataAgeSeconds: staleRateHvmiLineItem.availabilityDataAgeSeconds,
      rateDataAgeSeconds: staleRateHvmiLineItem.rateDataAgeSeconds,
    });
    expect(result).toBe('STALE');
  });

  it('returns FRESH for a fresh Amadeus flight line item', () => {
    const result = evaluateFreshness({
      manifest: amadeusManifest,
      availabilityDataAgeSeconds: freshAmadeusFlightLineItem.availabilityDataAgeSeconds,
      rateDataAgeSeconds: freshAmadeusFlightLineItem.rateDataAgeSeconds,
    });
    expect(result).toBe('FRESH');
  });

  it('returns STALE for a stale Amadeus flight line item', () => {
    const result = evaluateFreshness({
      manifest: amadeusManifest,
      availabilityDataAgeSeconds: staleAmadeusFlightLineItem.availabilityDataAgeSeconds,
      rateDataAgeSeconds: staleAmadeusFlightLineItem.rateDataAgeSeconds,
    });
    expect(result).toBe('STALE');
  });

  it('returns FRESH for a fresh public landmark line item (no rate data)', () => {
    const result = evaluateFreshness({
      manifest: publicLandmarkManifest,
      availabilityDataAgeSeconds: freshPublicLandmarkLineItem.availabilityDataAgeSeconds,
      rateDataAgeSeconds: freshPublicLandmarkLineItem.rateDataAgeSeconds,
    });
    expect(result).toBe('FRESH');
  });

  it('returns STALE for a stale public landmark line item', () => {
    const result = evaluateFreshness({
      manifest: publicLandmarkManifest,
      availabilityDataAgeSeconds: stalePublicLandmarkLineItem.availabilityDataAgeSeconds,
    });
    expect(result).toBe('STALE');
  });

  it('returns UNRATABLE for a priced manifest missing rateRefreshLatencySeconds', () => {
    const result = evaluateFreshness({
      manifest: pricedWithoutRateLatencyManifest,
      availabilityDataAgeSeconds: 60, // availability is fresh
      rateDataAgeSeconds: 60,
    });
    expect(result).toBe('UNRATABLE');
  });

  it('returns FRESH for a priced manifest when no rate age is supplied', () => {
    // When the caller does not supply rateDataAgeSeconds, rate staleness is not checked
    const result = evaluateFreshness({
      manifest: hvmiManifest,
      availabilityDataAgeSeconds: 60,
      // rateDataAgeSeconds not provided
    });
    expect(result).toBe('FRESH');
  });

  it('returns FRESH for the Bonvoy Tours fresh line item', () => {
    const result = evaluateFreshness({
      manifest: bonvoyToursManifest,
      availabilityDataAgeSeconds: freshBonvoyToursLineItem.availabilityDataAgeSeconds,
      rateDataAgeSeconds: freshBonvoyToursLineItem.rateDataAgeSeconds,
    });
    expect(result).toBe('FRESH');
  });
});

// ---------------------------------------------------------------------------
// Integration: itinerary line items validated against supplier manifests
// ---------------------------------------------------------------------------

describe('Integration — itinerary line item against supplier manifest', () => {
  it('a fresh certified HVMI line item passes both certification and freshness checks', () => {
    // Step 1: manifest must pass certification validation
    const certErrors = validateManifest(hvmiManifest);
    expect(certErrors).toHaveLength(0);

    // Step 2: line item must be fresh
    const grade = evaluateFreshness({
      manifest: hvmiManifest,
      availabilityDataAgeSeconds: freshHvmiAccommodationLineItem.availabilityDataAgeSeconds,
      rateDataAgeSeconds: freshHvmiAccommodationLineItem.rateDataAgeSeconds,
    });
    expect(grade).toBe('FRESH');
  });

  it('a fresh certified Amadeus line item passes both certification and freshness checks', () => {
    expect(validateManifest(amadeusManifest)).toHaveLength(0);
    const grade = evaluateFreshness({
      manifest: amadeusManifest,
      availabilityDataAgeSeconds: freshAmadeusFlightLineItem.availabilityDataAgeSeconds,
      rateDataAgeSeconds: freshAmadeusFlightLineItem.rateDataAgeSeconds,
    });
    expect(grade).toBe('FRESH');
  });

  it('a stale HVMI line item fails freshness even though the manifest is certified', () => {
    // Manifest is certified
    expect(validateManifest(hvmiManifest)).toHaveLength(0);

    // But availability data is stale
    const grade = evaluateFreshness({
      manifest: hvmiManifest,
      availabilityDataAgeSeconds: staleAvailabilityHvmiLineItem.availabilityDataAgeSeconds,
      rateDataAgeSeconds: staleAvailabilityHvmiLineItem.rateDataAgeSeconds,
    });
    expect(grade).toBe('STALE');
  });

  it('an uncertified supplier is excluded by manifest validation before freshness is evaluated', () => {
    // Step 1: manifest validation must fail (prevents reaching freshness check)
    const certErrors = validateManifest(uncertifiedSupplierManifest);
    expect(certErrors.length).toBeGreaterThan(0);
    expect(certErrors.some((e) => e.violatedRule === 'bookable_requires_certified_status')).toBe(true);

    // Step 2: freshness of the line item is irrelevant — supplier was already excluded
    const grade = evaluateFreshness({
      manifest: uncertifiedSupplierManifest,
      availabilityDataAgeSeconds: freshUncertifiedLineItem.availabilityDataAgeSeconds,
      rateDataAgeSeconds: freshUncertifiedLineItem.rateDataAgeSeconds,
    });
    // Even if data is fresh, the supplier cannot contribute inventory
    expect(grade).toBe('FRESH'); // Fresh, but excluded due to certification
    expect(certErrors.length).toBeGreaterThan(0); // Certification is the blocking gate
  });

  it('a public landmark line item passes both the public-landmark exemption and freshness checks', () => {
    // Public landmark supplier passes manifest validation
    expect(validateManifest(publicLandmarkManifest)).toHaveLength(0);

    // And fresh line item passes freshness
    const grade = evaluateFreshness({
      manifest: publicLandmarkManifest,
      availabilityDataAgeSeconds: freshPublicLandmarkLineItem.availabilityDataAgeSeconds,
    });
    expect(grade).toBe('FRESH');
  });

  it('supplier manifest validation must pass before freshness is a meaningful gate', () => {
    // The contract expectation: certification is checked first (gate 1), freshness second (gate 2)
    const allCertifiedManifests = [
      hvmiManifest,
      marriottBrandManifest,
      amadeusManifest,
      bonvoyToursManifest,
      publicLandmarkManifest,
    ];
    for (const manifest of allCertifiedManifests) {
      const errors = validateManifest(manifest);
      expect(errors).toHaveLength(0);
    }
  });
});
