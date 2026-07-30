/**
 * TripIntentRepository — interface contract
 */

import type { PathMode, DataClassificationTier } from '@voya/domain-model';
import type { RepositoryResult } from '../result.js';

export interface TripIntentRow {
  readonly id: string;
  readonly travellerProfileId: string;
  readonly sessionId: string | null;
  readonly pathMode: PathMode;
  readonly rawConstraintsJson: Record<string, unknown>;
  readonly destinationToken: string;
  readonly checkInDate: Date;
  readonly checkOutDate: Date;
  readonly partySize: number;
  readonly budgetBandCode: string | null;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateTripIntentInput {
  readonly travellerProfileId: string;
  readonly ownerRef: string;
  readonly sessionId?: string;
  readonly pathMode: PathMode;
  readonly rawConstraintsJson: Record<string, unknown>;
  readonly destinationToken: string;
  readonly checkInDate: Date;
  readonly checkOutDate: Date;
  readonly partySize: number;
  readonly budgetBandCode?: string;
  readonly dataClassification?: DataClassificationTier;
}

export interface TripIntentRepository {
  /**
   * Looks up a trip intent by its id.
   * Returns NOT_FOUND when the id does not exist OR ownerRef does not match.
   */
  findById(id: string, ownerRef: string): Promise<RepositoryResult<TripIntentRow>>;

  /**
   * Returns all trip intents belonging to the given travellerProfileId.
   * Returns NOT_FOUND when the traveller profile does not exist or ownerRef mismatches.
   */
  findByTravellerId(
    travellerProfileId: string,
    ownerRef: string,
  ): Promise<RepositoryResult<TripIntentRow[]>>;

  /**
   * Persists a new trip intent.
   * Returns VALIDATION_FAILURE for invalid party size, date order, or empty destination.
   */
  create(input: CreateTripIntentInput): Promise<RepositoryResult<TripIntentRow>>;
}
