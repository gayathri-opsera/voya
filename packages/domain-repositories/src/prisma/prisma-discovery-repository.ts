/**
 * Prisma-backed DiscoveryRepository implementation.
 *
 * All read methods filter to active records unless noted. Cross-owner reads
 * return NOT_FOUND (resource enumeration guard). No image bytes are stored;
 * heroImageRef is a metadata reference only.
 */

import type { PrismaClient } from '@prisma/client';
import { DataClassificationTier, BookingSource, validateSlug } from '@voya/domain-model';
import { ok, notFound, validationFailure, repoError } from '../result.js';
import type { RepositoryResult } from '../result.js';
import type {
  DiscoveryRepository,
  DestinationRow,
  CuratedCollectionRow,
  HomeInventoryReferenceRow,
  InterestTagRow,
} from '../interfaces/discovery-repository.js';

export class PrismaDiscoveryRepository implements DiscoveryRepository {
  constructor(private readonly db: PrismaClient) {}

  // -------------------------------------------------------------------------
  // listActiveCollections
  // -------------------------------------------------------------------------

  async listActiveCollections(): Promise<RepositoryResult<CuratedCollectionRow[]>> {
    try {
      const rows = await this.db.curatedCollection.findMany({
        where:   { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      return ok(rows.map(toCollectionRow));
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // findCollectionBySlug
  // -------------------------------------------------------------------------

  async findCollectionBySlug(slug: string): Promise<RepositoryResult<CuratedCollectionRow>> {
    const errors = validateSlug(slug);
    if (errors.length > 0) return validationFailure([...errors]);

    try {
      const row = await this.db.curatedCollection.findFirst({
        where: { slug, isActive: true },
      });
      if (!row) return notFound();
      return ok(toCollectionRow(row));
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // listCollectionHomes
  // -------------------------------------------------------------------------

  async listCollectionHomes(
    collectionSlug: string,
    limit?: number,
  ): Promise<RepositoryResult<HomeInventoryReferenceRow[]>> {
    const errors = validateSlug(collectionSlug);
    if (errors.length > 0) return validationFailure([...errors]);

    try {
      const collection = await this.db.curatedCollection.findFirst({
        where: { slug: collectionSlug, isActive: true },
      });
      if (!collection) return notFound();

      const memberships = await this.db.collectionHome.findMany({
        where: {
          collectionId: collection.id,
          isActive:     true,
          homeRef:      { isActive: true },
        },
        orderBy: { sortOrder: 'asc' },
        take:    limit ?? undefined,
        include: { homeRef: true },
      });

      const homes = memberships.map(m => toHomeRefRow(m.homeRef as HomeRefPrismaRow));
      return ok(homes);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // listTagsForCollection
  // -------------------------------------------------------------------------

  async listTagsForCollection(
    collectionSlug: string,
  ): Promise<RepositoryResult<InterestTagRow[]>> {
    const errors = validateSlug(collectionSlug);
    if (errors.length > 0) return validationFailure([...errors]);

    try {
      const collection = await this.db.curatedCollection.findFirst({
        where: { slug: collectionSlug, isActive: true },
      });
      if (!collection) return notFound();

      const links = await this.db.collectionInterestTag.findMany({
        where:   { collectionId: collection.id },
        include: { tag: true },
        orderBy: { tag: { sortOrder: 'asc' } },
      });

      return ok(links.map(l => toTagRow(l.tag as TagPrismaRow)));
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // findDestinationBySlug
  // -------------------------------------------------------------------------

  async findDestinationBySlug(slug: string): Promise<RepositoryResult<DestinationRow>> {
    const errors = validateSlug(slug);
    if (errors.length > 0) return validationFailure([...errors]);

    try {
      const row = await this.db.destination.findFirst({
        where: { slug, isActive: true },
      });
      if (!row) return notFound();
      return ok(toDestinationRow(row));
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // listActiveDestinations
  // -------------------------------------------------------------------------

  async listActiveDestinations(): Promise<RepositoryResult<DestinationRow[]>> {
    try {
      const rows = await this.db.destination.findMany({
        where:   { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      return ok(rows.map(toDestinationRow));
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

interface DestinationPrismaRow {
  id: string; slug: string; displayName: string; regionName: string | null;
  countryCode: string | null; heroImageRef: string | null; heroImageAltText: string | null;
  isActive: boolean; sortOrder: number; contentVersion: number;
  dataClassification: unknown; createdAt: Date; updatedAt: Date;
}

interface CollectionPrismaRow {
  id: string; slug: string; displayName: string; editorialEyebrow: string | null;
  description: string | null; heroImageRef: string | null; heroImageAltText: string | null;
  isActive: boolean; sortOrder: number; contentVersion: number; destinationId: string | null;
  dataClassification: unknown; createdAt: Date; updatedAt: Date;
}

interface HomeRefPrismaRow {
  id: string; sourceRef: string; supplierId: string; bookingSource: unknown;
  displayNameSnapshot: string; destinationId: string | null; destinationSlug: string | null;
  heroImageRef: string | null; heroImageAltText: string | null; isActive: boolean;
  dataClassification: unknown; createdAt: Date; updatedAt: Date;
}

interface TagPrismaRow {
  id: string; tagKey: string; displayLabel: string; sortOrder: number;
  createdAt: Date; updatedAt: Date;
}

function toDestinationRow(r: DestinationPrismaRow): DestinationRow {
  return {
    id:                 r.id,
    slug:               r.slug,
    displayName:        r.displayName,
    regionName:         r.regionName,
    countryCode:        r.countryCode,
    heroImageRef:       r.heroImageRef,
    heroImageAltText:   r.heroImageAltText,
    isActive:           r.isActive,
    sortOrder:          r.sortOrder,
    contentVersion:     r.contentVersion,
    dataClassification: r.dataClassification as DataClassificationTier,
    createdAt:          r.createdAt,
    updatedAt:          r.updatedAt,
  };
}

function toCollectionRow(r: CollectionPrismaRow): CuratedCollectionRow {
  return {
    id:                 r.id,
    slug:               r.slug,
    displayName:        r.displayName,
    editorialEyebrow:   r.editorialEyebrow,
    description:        r.description,
    heroImageRef:       r.heroImageRef,
    heroImageAltText:   r.heroImageAltText,
    isActive:           r.isActive,
    sortOrder:          r.sortOrder,
    contentVersion:     r.contentVersion,
    destinationId:      r.destinationId,
    dataClassification: r.dataClassification as DataClassificationTier,
    createdAt:          r.createdAt,
    updatedAt:          r.updatedAt,
  };
}

function toHomeRefRow(r: HomeRefPrismaRow): HomeInventoryReferenceRow {
  return {
    id:                  r.id,
    sourceRef:           r.sourceRef,
    supplierId:          r.supplierId,
    bookingSource:       r.bookingSource as BookingSource,
    displayNameSnapshot: r.displayNameSnapshot,
    destinationId:       r.destinationId,
    destinationSlug:     r.destinationSlug,
    heroImageRef:        r.heroImageRef,
    heroImageAltText:    r.heroImageAltText,
    isActive:            r.isActive,
    dataClassification:  r.dataClassification as DataClassificationTier,
    createdAt:           r.createdAt,
    updatedAt:           r.updatedAt,
  };
}

function toTagRow(r: TagPrismaRow): InterestTagRow {
  return {
    id:           r.id,
    tagKey:       r.tagKey,
    displayLabel: r.displayLabel,
    sortOrder:    r.sortOrder,
    createdAt:    r.createdAt,
    updatedAt:    r.updatedAt,
  };
}

function safeMessage(err: unknown): string {
  if (err instanceof Error)
    return err.message.replace(/\bpassword\b|\bsecret\b|\btoken\b/gi, '[REDACTED]');
  return 'Unexpected repository error';
}
