/**
 * TravellerProfileRepository — interface contract
 *
 * All reads are scoped to the ownerRef to prevent cross-traveller data access.
 * A missing resource and a resource owned by another traveller both return
 * NOT_FOUND so callers cannot infer resource existence from the result.
 */

import type { TravellerIdentityType, DataClassificationTier } from '@voya/domain-model';
import type { RepositoryResult } from '../result.js';

// ---------------------------------------------------------------------------
// Row shape (mirrors Prisma TravellerProfile model, no @prisma/client import)
// ---------------------------------------------------------------------------

export interface TravellerProfileRow {
  readonly id: string;
  readonly ownerRef: string;
  readonly identityType: TravellerIdentityType;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateTravellerProfileInput {
  readonly ownerRef: string;
  readonly identityType: TravellerIdentityType;
  readonly dataClassification?: DataClassificationTier;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface TravellerProfileRepository {
  /**
   * Looks up a traveller profile by its tokenized ownerRef.
   * Returns NOT_FOUND when no profile exists for the given ownerRef.
   */
  findByOwnerRef(ownerRef: string): Promise<RepositoryResult<TravellerProfileRow>>;

  /**
   * Looks up a traveller profile by its database id.
   * Returns NOT_FOUND when the id does not exist OR when ownerRef does not match.
   */
  findById(id: string, ownerRef: string): Promise<RepositoryResult<TravellerProfileRow>>;

  /**
   * Persists a new traveller profile.
   * Returns VALIDATION_FAILURE if ownerRef is empty or identityType is unknown.
   */
  create(input: CreateTravellerProfileInput): Promise<RepositoryResult<TravellerProfileRow>>;
}
