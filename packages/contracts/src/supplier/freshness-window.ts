/**
 * @voya/contracts — Supplier freshness window helpers
 *
 * Deterministic helper functions that calculate availability and rate data
 * freshness from Supplier Capability Manifest declarations. The Trip Confidence
 * Receipt generator and the checkout re-evaluation gate consume these helpers
 * without requiring supplier-specific branching.
 *
 * Rules:
 *  - A cached availability result is stale when its age (seconds since source
 *    was queried) exceeds the manifest's availabilityRefreshLatencySeconds.
 *  - A cached rate is stale when its age exceeds the manifest's
 *    rateRefreshLatencySeconds. Non-priced suppliers have no rate staleness.
 *  - A priced supplier with an absent rateRefreshLatencySeconds cannot be
 *    evaluated for rate freshness; evaluateFreshness returns 'UNRATABLE'.
 */

import type { SupplierCapabilityManifest } from './capability-manifest.js';

// ---------------------------------------------------------------------------
// FreshnessGrade
// Result of evaluating whether a sourced line item's data is still fresh.
// ---------------------------------------------------------------------------

export type FreshnessGrade = 'FRESH' | 'STALE' | 'UNRATABLE';

// ---------------------------------------------------------------------------
// FreshnessWindowInput
// Inputs for the composite freshness evaluation.
// ---------------------------------------------------------------------------

export interface FreshnessWindowInput {
  /** The supplier's capability manifest providing refresh latency declarations. */
  readonly manifest: SupplierCapabilityManifest;
  /** Age of the cached availability result in seconds. */
  readonly availabilityDataAgeSeconds: number;
  /** Age of the cached rate data in seconds. Omit for non-priced suppliers. */
  readonly rateDataAgeSeconds?: number;
}

// ---------------------------------------------------------------------------
// getAvailabilityMaxAgeSeconds
// ---------------------------------------------------------------------------

/**
 * Returns the maximum permissible age (in seconds) for a cached availability
 * result from this supplier, as declared in the manifest.
 */
export function getAvailabilityMaxAgeSeconds(manifest: SupplierCapabilityManifest): number {
  return manifest.availabilityRefreshLatencySeconds;
}

// ---------------------------------------------------------------------------
// getRateMaxAgeSeconds
// ---------------------------------------------------------------------------

/**
 * Returns the maximum permissible age (in seconds) for a cached rate result
 * from this supplier, or null when the supplier does not provide priced
 * inventory.
 */
export function getRateMaxAgeSeconds(manifest: SupplierCapabilityManifest): number | null {
  return manifest.rateRefreshLatencySeconds ?? null;
}

// ---------------------------------------------------------------------------
// isAvailabilityStale
// ---------------------------------------------------------------------------

/**
 * Returns true when the cached availability data for this supplier line item
 * is older than the manifest's declared refresh latency.
 *
 * @param manifest  The supplier's capability manifest.
 * @param dataAgeSeconds  Elapsed seconds since the availability cache entry was written.
 */
export function isAvailabilityStale(
  manifest: SupplierCapabilityManifest,
  dataAgeSeconds: number,
): boolean {
  return dataAgeSeconds > manifest.availabilityRefreshLatencySeconds;
}

// ---------------------------------------------------------------------------
// isRateStale
// ---------------------------------------------------------------------------

/**
 * Returns true when the cached rate data for this supplier line item is older
 * than the manifest's declared rate refresh latency.
 *
 * Returns false for non-priced suppliers (rateRefreshLatencySeconds absent),
 * because rate freshness is not applicable to them.
 *
 * @param manifest  The supplier's capability manifest.
 * @param dataAgeSeconds  Elapsed seconds since the rate cache entry was written.
 */
export function isRateStale(
  manifest: SupplierCapabilityManifest,
  dataAgeSeconds: number,
): boolean {
  if (manifest.rateRefreshLatencySeconds === undefined) {
    return false;
  }
  return dataAgeSeconds > manifest.rateRefreshLatencySeconds;
}

// ---------------------------------------------------------------------------
// evaluateFreshness
// ---------------------------------------------------------------------------

/**
 * Evaluates the composite freshness of a sourced line item against the
 * supplier's declared refresh latencies.
 *
 * Returns:
 *  - 'FRESH'     — all supplied data ages are within the manifest's latency windows.
 *  - 'STALE'     — at least one data age exceeds its latency window.
 *  - 'UNRATABLE' — the supplier declares isPriced but no rateRefreshLatencySeconds,
 *                  making receipt freshness evaluation impossible.
 *
 * The Trip Confidence Receipt generator must treat 'UNRATABLE' as a blocking
 * condition equivalent to 'STALE'.
 */
export function evaluateFreshness(input: FreshnessWindowInput): FreshnessGrade {
  if (isAvailabilityStale(input.manifest, input.availabilityDataAgeSeconds)) {
    return 'STALE';
  }

  if (input.manifest.isPriced) {
    if (input.manifest.rateRefreshLatencySeconds === undefined) {
      return 'UNRATABLE';
    }
    if (input.rateDataAgeSeconds !== undefined) {
      if (isRateStale(input.manifest, input.rateDataAgeSeconds)) {
        return 'STALE';
      }
    }
  }

  return 'FRESH';
}
