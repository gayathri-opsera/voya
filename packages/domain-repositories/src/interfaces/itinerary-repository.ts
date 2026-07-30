/**
 * ItineraryRepository — interface contract
 *
 * Itinerary writes that span multiple tables (days, line items, provenance)
 * must be executed in a single transaction. The interface communicates this
 * contract through the CreateItineraryInput shape — callers supply all
 * dependent rows in one call rather than making sequential writes.
 */

import type {
  ItineraryStatus,
  PathMode,
  DataClassificationTier,
  InventoryDomain,
  BookingSource,
  SourceClassification,
} from '@voya/domain-model';
import type { RepositoryResult } from '../result.js';

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export interface SourceProvenanceRow {
  readonly id: string;
  readonly supplierId: string;
  readonly sourceRef: string;
  readonly bookingSource: BookingSource;
  readonly sourceClassification: SourceClassification;
  readonly fetchedAt: Date;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
}

export interface ItineraryLineItemRow {
  readonly id: string;
  readonly itineraryId: string;
  readonly itineraryDayId: string | null;
  readonly sourceProvenanceId: string;
  readonly domain: InventoryDomain;
  readonly supplierRef: string;
  readonly displayNameSnapshot: string;
  readonly priceAmountMinorUnits: number | null;
  readonly priceCurrencyCode: string | null;
  readonly pointsAmount: number | null;
  readonly availabilityDataAgeSeconds: number | null;
  readonly rateDataAgeSeconds: number | null;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ItineraryDayRow {
  readonly id: string;
  readonly itineraryId: string;
  readonly dayIndex: number;
  readonly date: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ItineraryRow {
  readonly id: string;
  readonly travellerProfileId: string;
  readonly tripIntentId: string;
  readonly version: number;
  readonly status: ItineraryStatus;
  readonly pathMode: PathMode;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateSourceProvenanceInput {
  readonly supplierId: string;
  readonly sourceRef: string;
  readonly bookingSource: BookingSource;
  readonly sourceClassification: SourceClassification;
  readonly fetchedAt: Date;
  readonly dataClassification?: DataClassificationTier;
}

export interface CreateLineItemInput {
  readonly sourceProvenance: CreateSourceProvenanceInput;
  readonly domain: InventoryDomain;
  readonly supplierRef: string;
  readonly displayNameSnapshot: string;
  readonly priceAmountMinorUnits?: number;
  readonly priceCurrencyCode?: string;
  readonly pointsAmount?: number;
  readonly availabilityDataAgeSeconds?: number;
  readonly rateDataAgeSeconds?: number;
  readonly dataClassification?: DataClassificationTier;
}

export interface CreateItineraryDayInput {
  readonly dayIndex: number;
  readonly date: Date;
  readonly lineItems: readonly CreateLineItemInput[];
}

export interface CreateItineraryInput {
  readonly travellerProfileId: string;
  readonly ownerRef: string;
  readonly tripIntentId: string;
  readonly pathMode: PathMode;
  readonly days: readonly CreateItineraryDayInput[];
  readonly dataClassification?: DataClassificationTier;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ItineraryRepository {
  /**
   * Looks up an itinerary by id.
   * Returns NOT_FOUND when the id does not exist OR ownerRef mismatches.
   */
  findById(id: string, ownerRef: string): Promise<RepositoryResult<ItineraryRow>>;

  /**
   * Returns all itineraries belonging to the traveller profile.
   * Returns NOT_FOUND when the profile does not exist or ownerRef mismatches.
   */
  findByTravellerId(
    travellerProfileId: string,
    ownerRef: string,
  ): Promise<RepositoryResult<ItineraryRow[]>>;

  /**
   * Creates an itinerary with all its days, line items, and provenance rows
   * in a single atomic transaction. A failure in any nested insert rolls back
   * the entire itinerary.
   *
   * Returns VALIDATION_FAILURE for invalid line items (negative prices, missing
   * provenance, invalid domain values). Provenance is mandatory — a line item
   * without source provenance is rejected before any DB write.
   */
  createWithLineItems(input: CreateItineraryInput): Promise<RepositoryResult<ItineraryRow>>;

  /**
   * Transitions an itinerary's status.
   * Validates the transition using domain-model's isValidItineraryTransition().
   * Returns VERSION_CONFLICT when the stored status no longer matches `from`,
   * indicating a concurrent update.
   * Returns NOT_FOUND when the id does not exist or ownerRef mismatches.
   */
  updateStatus(
    id: string,
    ownerRef: string,
    from: ItineraryStatus,
    to: ItineraryStatus,
  ): Promise<RepositoryResult<ItineraryRow>>;
}
