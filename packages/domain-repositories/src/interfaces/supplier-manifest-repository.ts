/**
 * SupplierManifestRepository — interface contract
 *
 * Manifest reads are not traveller-scoped (manifests are shared registry data).
 * findBySupplierId returns a result with certificationStatus UNCERTIFIED for
 * unknown supplier IDs rather than NOT_FOUND, to keep supplier lookup
 * semantics predictable for sourcing filters.
 */

import type {
  InventoryDomain,
  SourceClassification,
  SupplierBookability,
  CancellationSemantics,
  RefundSemantics,
  SupplierCertificationStatus,
  DataClassificationTier,
} from '@voya/domain-model';
import type { RepositoryResult } from '../result.js';

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

export interface SupplierManifestRow {
  readonly id: string;
  readonly supplierId: string;
  readonly displayName: string;
  readonly domain: InventoryDomain;
  readonly sourceClassification: SourceClassification;
  readonly bookabilityMode: SupplierBookability;
  readonly availabilityRefreshLatencySeconds: number;
  readonly rateRefreshLatencySeconds: number | null;
  readonly isPriced: boolean;
  readonly cancellationSemantics: CancellationSemantics;
  readonly refundSemantics: RefundSemantics;
  readonly certificationStatus: SupplierCertificationStatus;
  readonly fixtureEvidenceRef: string | null;
  readonly manifestVersion: string;
  readonly lastReviewedAt: Date;
  readonly reviewedBy: string;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Sentinel returned for unknown supplier IDs — never use as a real manifest */
export const UNCERTIFIED_SENTINEL: Pick<SupplierManifestRow, 'certificationStatus'> = {
  certificationStatus: 'UNCERTIFIED',
} as const;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface SupplierManifestRepository {
  /**
   * Looks up a supplier manifest by supplierId.
   * Returns NOT_FOUND for unknown suppliers. Callers should treat missing
   * manifests as UNCERTIFIED per the Voya sourcing rules.
   */
  findBySupplierId(supplierId: string): Promise<RepositoryResult<SupplierManifestRow>>;

  /**
   * Returns all certified manifests for an inventory domain.
   * Results are ordered by supplierId for deterministic sourcing order.
   */
  findCertifiedByDomain(
    domain: InventoryDomain,
  ): Promise<RepositoryResult<SupplierManifestRow[]>>;

  /**
   * Returns all manifests with bookabilityMode FULLY_BOOKABLE and certificationStatus CERTIFIED.
   */
  findFullyBookable(): Promise<RepositoryResult<SupplierManifestRow[]>>;

  /**
   * Returns all manifests where availabilityRefreshLatencySeconds or
   * rateRefreshLatencySeconds is below the given threshold (for freshness window queries).
   */
  findByFreshnessWindow(
    maxAvailabilityLatencySeconds: number,
  ): Promise<RepositoryResult<SupplierManifestRow[]>>;
}
