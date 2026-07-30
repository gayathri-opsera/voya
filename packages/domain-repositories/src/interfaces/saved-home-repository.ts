/**
 * SavedHomeRepository — framework-independent interface
 *
 * Owner-scoped save/remove/list/derive operations for home references.
 * Idempotent upsert preserves the original savedAt timestamp on duplicate
 * heart actions. No HTTP, Prisma, or LLM imports.
 */

import type { DataClassificationTier } from '@voya/domain-model';
import type { RepositoryResult } from '../result.js';
import type { HomeInventoryReferenceRow } from './discovery-repository.js';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface SavedHomeRow {
  readonly id: string;
  readonly ownerRef: string;
  readonly homeRefId: string;
  readonly savedAt: Date;
  readonly notes: string | null;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Eagerly loaded home reference, when available. */
  readonly homeRef?: HomeInventoryReferenceRow;
}

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface SavedHomeRepository {
  /**
   * Idempotent upsert. Creates a SavedHome for (ownerRef, homeSourceRef) if
   * none exists; if one already exists, the original row is returned unchanged
   * (savedAt is preserved).
   *
   * Returns VALIDATION_FAILURE if ownerRef or homeSourceRef are invalid.
   * Returns NOT_FOUND if the homeSourceRef does not match any active reference.
   */
  upsertSavedHome(
    ownerRef: string,
    homeSourceRef: string,
    savedAt?: Date,
    notes?: string,
  ): Promise<RepositoryResult<SavedHomeRow>>;

  /**
   * Remove a saved home by id, scoped to ownerRef.
   * Returns NOT_FOUND if the row does not exist or belongs to a different owner.
   */
  removeSavedHome(
    id: string,
    ownerRef: string,
  ): Promise<RepositoryResult<SavedHomeRow>>;

  /**
   * List all saved homes for ownerRef in descending savedAt order.
   * Returns an empty array if the owner has no saved homes.
   */
  listSavedHomes(ownerRef: string): Promise<RepositoryResult<SavedHomeRow[]>>;

  /**
   * Derive deduplicated, alphabetically sorted interest tag keys from all homes
   * saved by ownerRef. Returns an empty array if no tagged homes are saved.
   */
  deriveInterestTags(ownerRef: string): Promise<RepositoryResult<string[]>>;
}
