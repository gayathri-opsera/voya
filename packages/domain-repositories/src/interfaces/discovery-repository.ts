/**
 * DiscoveryRepository — framework-independent interface
 *
 * Provides read-only access to curated collections, destinations, home
 * inventory references, and interest tags. All methods filter to active
 * records unless stated otherwise. No HTTP, Prisma, or LLM imports.
 */

import type { DataClassificationTier, BookingSource } from '@voya/domain-model';
import type { RepositoryResult } from '../result.js';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface DestinationRow {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly regionName: string | null;
  readonly countryCode: string | null;
  readonly heroImageRef: string | null;
  readonly heroImageAltText: string | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly contentVersion: number;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CuratedCollectionRow {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly editorialEyebrow: string | null;
  readonly description: string | null;
  readonly heroImageRef: string | null;
  readonly heroImageAltText: string | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly contentVersion: number;
  readonly destinationId: string | null;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface HomeInventoryReferenceRow {
  readonly id: string;
  readonly sourceRef: string;
  readonly supplierId: string;
  readonly bookingSource: BookingSource;
  readonly displayNameSnapshot: string;
  readonly destinationId: string | null;
  readonly destinationSlug: string | null;
  readonly heroImageRef: string | null;
  readonly heroImageAltText: string | null;
  readonly isActive: boolean;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface InterestTagRow {
  readonly id: string;
  readonly tagKey: string;
  readonly displayLabel: string;
  readonly sortOrder: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface DiscoveryRepository {
  /** List all active curated collections ordered by sortOrder ascending. */
  listActiveCollections(): Promise<RepositoryResult<CuratedCollectionRow[]>>;

  /**
   * Find a collection by slug. Returns NOT_FOUND for inactive or missing slugs.
   * VALIDATION_FAILURE for an invalid slug format.
   */
  findCollectionBySlug(slug: string): Promise<RepositoryResult<CuratedCollectionRow>>;

  /**
   * List active home references for a collection in sortOrder order.
   * Returns NOT_FOUND if the collection slug does not exist or is inactive.
   * Returns an empty array if the collection has no active homes.
   */
  listCollectionHomes(
    collectionSlug: string,
    limit?: number,
  ): Promise<RepositoryResult<HomeInventoryReferenceRow[]>>;

  /**
   * List all interest tags associated with a collection.
   * Returns an empty array if the collection has no tags.
   */
  listTagsForCollection(collectionSlug: string): Promise<RepositoryResult<InterestTagRow[]>>;

  /** Find a destination by slug. Returns NOT_FOUND for inactive or missing slugs. */
  findDestinationBySlug(slug: string): Promise<RepositoryResult<DestinationRow>>;

  /** List all active destinations ordered by sortOrder ascending. */
  listActiveDestinations(): Promise<RepositoryResult<DestinationRow[]>>;
}
