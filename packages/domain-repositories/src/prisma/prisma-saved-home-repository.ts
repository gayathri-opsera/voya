/**
 * Prisma-backed SavedHomeRepository implementation.
 *
 * Idempotent upsert: a duplicate heart action on (ownerRef, homeRefId)
 * returns the original row unchanged, preserving the savedAt timestamp.
 * Resource enumeration guard: cross-owner reads return NOT_FOUND.
 */

import type { PrismaClient } from '@prisma/client';
import {
  DataClassificationTier,
  BookingSource,
  validateSavedHomeNotes,
  deriveInterestTagsFromSavedHomes,
} from '@voya/domain-model';
import { ok, notFound, validationFailure, repoError } from '../result.js';
import type { RepositoryResult } from '../result.js';
import type {
  SavedHomeRepository,
  SavedHomeRow,
} from '../interfaces/saved-home-repository.js';
import type { HomeInventoryReferenceRow } from '../interfaces/discovery-repository.js';

export class PrismaSavedHomeRepository implements SavedHomeRepository {
  constructor(private readonly db: PrismaClient) {}

  // -------------------------------------------------------------------------
  // upsertSavedHome
  // -------------------------------------------------------------------------

  async upsertSavedHome(
    ownerRef: string,
    homeSourceRef: string,
    savedAt?: Date,
    notes?: string,
  ): Promise<RepositoryResult<SavedHomeRow>> {
    if (!ownerRef || ownerRef.trim() === '') {
      return validationFailure(['ownerRef must not be empty']);
    }
    if (!homeSourceRef || homeSourceRef.trim() === '' || /\s/.test(homeSourceRef)) {
      return validationFailure(['homeSourceRef must be a non-empty string without whitespace']);
    }
    if (notes !== undefined) {
      const notesErrors = validateSavedHomeNotes(notes);
      if (notesErrors.length > 0) return validationFailure([...notesErrors]);
    }

    try {
      // Resolve the canonical home reference UUID by sourceRef
      const homeRef = await this.db.homeInventoryReference.findFirst({
        where: { sourceRef: homeSourceRef, isActive: true },
      });
      if (!homeRef) return notFound();

      // Idempotency: return existing row if already saved
      const existing = await this.db.savedHome.findFirst({
        where:   { ownerRef, homeRefId: homeRef.id },
        include: { homeRef: true },
      });
      if (existing) {
        return ok(toSavedHomeRow(existing as SavedHomePrismaRow));
      }

      const created = await this.db.savedHome.create({
        data: {
          ownerRef:           ownerRef,
          homeRefId:          homeRef.id,
          savedAt:            savedAt ?? new Date(),
          notes:              notes ?? null,
          dataClassification: DataClassificationTier.INTERNAL as never,
        },
        include: { homeRef: true },
      });

      return ok(toSavedHomeRow(created as SavedHomePrismaRow));
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // removeSavedHome
  // -------------------------------------------------------------------------

  async removeSavedHome(
    id: string,
    ownerRef: string,
  ): Promise<RepositoryResult<SavedHomeRow>> {
    if (!id || id.trim() === '') return validationFailure(['id must not be empty']);
    if (!ownerRef || ownerRef.trim() === '') return validationFailure(['ownerRef must not be empty']);

    try {
      const row = await this.db.savedHome.findUnique({
        where:   { id },
        include: { homeRef: true },
      });

      // Resource enumeration guard: cross-owner reads return NOT_FOUND
      if (!row || row.ownerRef !== ownerRef) return notFound();

      await this.db.savedHome.delete({ where: { id } });

      return ok(toSavedHomeRow(row as SavedHomePrismaRow));
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // listSavedHomes
  // -------------------------------------------------------------------------

  async listSavedHomes(ownerRef: string): Promise<RepositoryResult<SavedHomeRow[]>> {
    if (!ownerRef || ownerRef.trim() === '') {
      return validationFailure(['ownerRef must not be empty']);
    }

    try {
      const rows = await this.db.savedHome.findMany({
        where:   { ownerRef },
        orderBy: { savedAt: 'desc' },
        include: { homeRef: true },
      });

      return ok(rows.map(r => toSavedHomeRow(r as SavedHomePrismaRow)));
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  // -------------------------------------------------------------------------
  // deriveInterestTags
  // -------------------------------------------------------------------------

  async deriveInterestTags(ownerRef: string): Promise<RepositoryResult<string[]>> {
    if (!ownerRef || ownerRef.trim() === '') {
      return validationFailure(['ownerRef must not be empty']);
    }

    try {
      const savedHomes = await this.db.savedHome.findMany({
        where:  { ownerRef },
        select: { homeRefId: true },
      });

      if (savedHomes.length === 0) return ok([]);

      const homeRefIds = savedHomes.map(s => s.homeRefId);

      const tagLinks = await this.db.homeInterestTag.findMany({
        where:   { homeRefId: { in: homeRefIds } },
        include: { tag: true },
      });

      // Group tag keys by home reference for derivation
      const tagsByHome = new Map<string, string[]>();
      for (const link of tagLinks) {
        const key = link.homeRefId;
        const list = tagsByHome.get(key) ?? [];
        list.push((link.tag as { tagKey: string }).tagKey);
        tagsByHome.set(key, list);
      }

      const tagKeysBySavedHome = homeRefIds.map(id => tagsByHome.get(id) ?? []);
      const derived = deriveInterestTagsFromSavedHomes(tagKeysBySavedHome);

      return ok([...derived]);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

interface HomeRefPrismaRow {
  id: string; sourceRef: string; supplierId: string; bookingSource: unknown;
  displayNameSnapshot: string; destinationId: string | null; destinationSlug: string | null;
  heroImageRef: string | null; heroImageAltText: string | null; isActive: boolean;
  dataClassification: unknown; createdAt: Date; updatedAt: Date;
}

interface SavedHomePrismaRow {
  id: string; ownerRef: string; homeRefId: string; savedAt: Date;
  notes: string | null; dataClassification: unknown; createdAt: Date; updatedAt: Date;
  homeRef?: HomeRefPrismaRow;
}

function toSavedHomeRow(r: SavedHomePrismaRow): SavedHomeRow {
  return {
    id:                 r.id,
    ownerRef:           r.ownerRef,
    homeRefId:          r.homeRefId,
    savedAt:            r.savedAt,
    notes:              r.notes,
    dataClassification: r.dataClassification as DataClassificationTier,
    createdAt:          r.createdAt,
    updatedAt:          r.updatedAt,
    homeRef:            r.homeRef ? toHomeRefRow(r.homeRef) : undefined,
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

function safeMessage(err: unknown): string {
  if (err instanceof Error)
    return err.message.replace(/\bpassword\b|\bsecret\b|\btoken\b/gi, '[REDACTED]');
  return 'Unexpected repository error';
}
