/**
 * Unit tests for SavedHomeRepository — in-memory fake implementation.
 *
 * No database required. Tests prove:
 *  - upsertSavedHome creates a new saved-home row
 *  - upsertSavedHome is idempotent — duplicate calls return original row with
 *    the same savedAt (no timestamp reset)
 *  - upsertSavedHome returns NOT_FOUND for unknown homeSourceRef
 *  - upsertSavedHome returns VALIDATION_FAILURE for empty ownerRef/homeSourceRef
 *  - removeSavedHome returns NOT_FOUND for cross-owner access (enumeration guard)
 *  - removeSavedHome returns NOT_FOUND for non-existent id
 *  - listSavedHomes returns rows in descending savedAt order
 *  - listSavedHomes returns empty array for owner with no saved homes
 *  - deriveInterestTags deduplicates and alphabetically sorts tag keys
 *  - validateSavedHomeNotes rejects notes > 500 characters
 *  - deduplicateTagKeys deduplicates and sorts
 *  - deriveInterestTagsFromSavedHomes flattens, deduplicates, and sorts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateSavedHomeNotes,
  deduplicateTagKeys,
  deriveInterestTagsFromSavedHomes,
  INTEREST_TAG_KEYS,
} from '@voya/domain-model';
import { ok, notFound, validationFailure, isOk, isNotFound, isValidationFailure } from '../src/result.js';
import type { RepositoryResult } from '../src/result.js';
import type {
  SavedHomeRepository,
  SavedHomeRow,
} from '../src/interfaces/saved-home-repository.js';
import type { HomeInventoryReferenceRow } from '../src/interfaces/discovery-repository.js';
import {
  SAVED_HOME_OWNER_GUEST,
  SAVED_HOME_OWNER_BONVOY,
  testBeachfrontHomeA,
  testBeachfrontHomeB,
  testSkiChaletHomeA,
  testVineyardHomeA,
  allHomeReferences,
} from '@voya/test-fixtures';

// ---------------------------------------------------------------------------
// In-memory fake SavedHomeRepository
// ---------------------------------------------------------------------------

let idSeq = 1;
function nextId(): string { return `saved_fake_${idSeq++}`; }

// Tag keys associated with each home for deriveInterestTags tests
const TAG_KEYS_BY_SOURCE_REF: Record<string, string[]> = {
  [testBeachfrontHomeA.sourceRef]:  [INTEREST_TAG_KEYS.BEACHFRONT, INTEREST_TAG_KEYS.OCEANVIEW],
  [testBeachfrontHomeB.sourceRef]:  [INTEREST_TAG_KEYS.BEACHFRONT],
  [testSkiChaletHomeA.sourceRef]:   [INTEREST_TAG_KEYS.SKI_IN_SKI_OUT, INTEREST_TAG_KEYS.MOUNTAIN_VIEW],
  [testVineyardHomeA.sourceRef]:    [INTEREST_TAG_KEYS.VINEYARD],
};

class FakeSavedHomeRepository implements SavedHomeRepository {
  private readonly rows = new Map<string, SavedHomeRow>();
  private readonly homes: HomeInventoryReferenceRow[];

  constructor() {
    this.homes = [...allHomeReferences];
    idSeq = 1;
  }

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
      const errors = validateSavedHomeNotes(notes);
      if (errors.length > 0) return validationFailure([...errors]);
    }

    const homeRef = this.homes.find(h => h.sourceRef === homeSourceRef && h.isActive);
    if (!homeRef) return notFound();

    // Idempotency: return existing row unchanged
    const existingKey = `${ownerRef}::${homeRef.id}`;
    const existing = [...this.rows.values()].find(r => r.ownerRef === ownerRef && r.homeRefId === homeRef.id);
    if (existing) return ok(existing);

    const row: SavedHomeRow = {
      id:                 nextId(),
      ownerRef,
      homeRefId:          homeRef.id,
      savedAt:            savedAt ?? new Date(),
      notes:              notes ?? null,
      dataClassification: 'INTERNAL' as const,
      createdAt:          new Date(),
      updatedAt:          new Date(),
      homeRef,
    };

    this.rows.set(row.id, row);
    return ok(row);
  }

  async removeSavedHome(id: string, ownerRef: string): Promise<RepositoryResult<SavedHomeRow>> {
    if (!id || id.trim() === '') return validationFailure(['id must not be empty']);
    if (!ownerRef || ownerRef.trim() === '') return validationFailure(['ownerRef must not be empty']);

    const row = this.rows.get(id);
    // Resource enumeration guard
    if (!row || row.ownerRef !== ownerRef) return notFound();

    this.rows.delete(id);
    return ok(row);
  }

  async listSavedHomes(ownerRef: string): Promise<RepositoryResult<SavedHomeRow[]>> {
    if (!ownerRef || ownerRef.trim() === '') {
      return validationFailure(['ownerRef must not be empty']);
    }

    const rows = [...this.rows.values()]
      .filter(r => r.ownerRef === ownerRef)
      .sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());

    return ok(rows);
  }

  async deriveInterestTags(ownerRef: string): Promise<RepositoryResult<string[]>> {
    if (!ownerRef || ownerRef.trim() === '') {
      return validationFailure(['ownerRef must not be empty']);
    }

    const savedRows = [...this.rows.values()].filter(r => r.ownerRef === ownerRef);
    if (savedRows.length === 0) return ok([]);

    const tagKeysBySavedHome = savedRows.map(r => {
      const homeRef = this.homes.find(h => h.id === r.homeRefId);
      if (!homeRef) return [];
      return TAG_KEYS_BY_SOURCE_REF[homeRef.sourceRef] ?? [];
    });

    const derived = deriveInterestTagsFromSavedHomes(tagKeysBySavedHome);
    return ok([...derived]);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('domain-model saved-home helpers', () => {
  describe('validateSavedHomeNotes', () => {
    it('accepts notes within 500 characters', () => {
      expect(validateSavedHomeNotes('Short note')).toHaveLength(0);
      expect(validateSavedHomeNotes('x'.repeat(500))).toHaveLength(0);
    });

    it('rejects notes exceeding 500 characters', () => {
      const errors = validateSavedHomeNotes('x'.repeat(501));
      expect(errors).not.toHaveLength(0);
    });
  });

  describe('deduplicateTagKeys', () => {
    it('removes duplicates and sorts alphabetically', () => {
      const result = deduplicateTagKeys(['BEACHFRONT', 'SKI_IN_SKI_OUT', 'BEACHFRONT']);
      expect(result).toEqual(['BEACHFRONT', 'SKI_IN_SKI_OUT']);
    });

    it('returns an empty array for no keys', () => {
      expect(deduplicateTagKeys([])).toHaveLength(0);
    });
  });

  describe('deriveInterestTagsFromSavedHomes', () => {
    it('flattens, deduplicates, and sorts from multiple homes', () => {
      const tagKeysBySavedHome = [
        [INTEREST_TAG_KEYS.BEACHFRONT, INTEREST_TAG_KEYS.OCEANVIEW],
        [INTEREST_TAG_KEYS.BEACHFRONT],
        [INTEREST_TAG_KEYS.SKI_IN_SKI_OUT],
      ];
      const result = deriveInterestTagsFromSavedHomes(tagKeysBySavedHome);
      expect(result).toEqual(['BEACHFRONT', 'OCEANVIEW', 'SKI_IN_SKI_OUT']);
    });

    it('returns empty array for empty input', () => {
      expect(deriveInterestTagsFromSavedHomes([])).toHaveLength(0);
    });

    it('returns empty array for homes with no tags', () => {
      expect(deriveInterestTagsFromSavedHomes([[], []])).toHaveLength(0);
    });
  });
});

describe('FakeSavedHomeRepository', () => {
  let repo: FakeSavedHomeRepository;

  beforeEach(() => {
    repo = new FakeSavedHomeRepository();
  });

  describe('upsertSavedHome', () => {
    it('creates a new saved-home row', async () => {
      const result = await repo.upsertSavedHome(
        SAVED_HOME_OWNER_GUEST,
        testBeachfrontHomeA.sourceRef,
      );
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.ownerRef).toBe(SAVED_HOME_OWNER_GUEST);
        expect(result.data.homeRefId).toBe(testBeachfrontHomeA.id);
        expect(result.data.homeRef?.sourceRef).toBe(testBeachfrontHomeA.sourceRef);
      }
    });

    it('is idempotent — returns original row with unchanged savedAt', async () => {
      const fixedTime = new Date('2025-06-01T10:00:00Z');
      const first = await repo.upsertSavedHome(
        SAVED_HOME_OWNER_GUEST,
        testBeachfrontHomeA.sourceRef,
        fixedTime,
      );
      expect(isOk(first)).toBe(true);

      const second = await repo.upsertSavedHome(
        SAVED_HOME_OWNER_GUEST,
        testBeachfrontHomeA.sourceRef,
        new Date('2025-07-01T10:00:00Z'), // later time — must be ignored
      );
      expect(isOk(second)).toBe(true);

      if (isOk(first) && isOk(second)) {
        expect(second.data.id).toBe(first.data.id);
        expect(second.data.savedAt.toISOString()).toBe(first.data.savedAt.toISOString());
      }
    });

    it('returns NOT_FOUND for an unknown homeSourceRef', async () => {
      const result = await repo.upsertSavedHome(SAVED_HOME_OWNER_GUEST, 'HVMI_UNKNOWN_REF');
      expect(isNotFound(result)).toBe(true);
    });

    it('returns VALIDATION_FAILURE for empty ownerRef', async () => {
      const result = await repo.upsertSavedHome('', testBeachfrontHomeA.sourceRef);
      expect(isValidationFailure(result)).toBe(true);
    });

    it('returns VALIDATION_FAILURE for homeSourceRef with whitespace', async () => {
      const result = await repo.upsertSavedHome(SAVED_HOME_OWNER_GUEST, 'HVMI REF WITH SPACE');
      expect(isValidationFailure(result)).toBe(true);
    });

    it('returns VALIDATION_FAILURE for notes exceeding 500 chars', async () => {
      const result = await repo.upsertSavedHome(
        SAVED_HOME_OWNER_GUEST,
        testBeachfrontHomeA.sourceRef,
        undefined,
        'x'.repeat(501),
      );
      expect(isValidationFailure(result)).toBe(true);
    });

    it('saves notes within limit', async () => {
      const result = await repo.upsertSavedHome(
        SAVED_HOME_OWNER_GUEST,
        testBeachfrontHomeA.sourceRef,
        undefined,
        'Nice ocean view',
      );
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.notes).toBe('Nice ocean view');
      }
    });
  });

  describe('removeSavedHome', () => {
    it('removes a saved home and returns the deleted row', async () => {
      const upsert = await repo.upsertSavedHome(SAVED_HOME_OWNER_GUEST, testBeachfrontHomeA.sourceRef);
      expect(isOk(upsert)).toBe(true);
      if (!isOk(upsert)) return;

      const remove = await repo.removeSavedHome(upsert.data.id, SAVED_HOME_OWNER_GUEST);
      expect(isOk(remove)).toBe(true);

      // Row should be gone
      const list = await repo.listSavedHomes(SAVED_HOME_OWNER_GUEST);
      expect(isOk(list)).toBe(true);
      if (isOk(list)) {
        expect(list.data.find(r => r.id === upsert.data.id)).toBeUndefined();
      }
    });

    it('returns NOT_FOUND for cross-owner access (enumeration guard)', async () => {
      const upsert = await repo.upsertSavedHome(SAVED_HOME_OWNER_GUEST, testBeachfrontHomeA.sourceRef);
      expect(isOk(upsert)).toBe(true);
      if (!isOk(upsert)) return;

      const remove = await repo.removeSavedHome(upsert.data.id, SAVED_HOME_OWNER_BONVOY);
      expect(isNotFound(remove)).toBe(true);
    });

    it('returns NOT_FOUND for a non-existent id', async () => {
      const remove = await repo.removeSavedHome('non-existent-id', SAVED_HOME_OWNER_GUEST);
      expect(isNotFound(remove)).toBe(true);
    });
  });

  describe('listSavedHomes', () => {
    it('returns saved homes in descending savedAt order', async () => {
      const earlier = new Date('2025-03-01T10:00:00Z');
      const later   = new Date('2025-04-01T10:00:00Z');

      await repo.upsertSavedHome(SAVED_HOME_OWNER_GUEST, testBeachfrontHomeA.sourceRef, earlier);
      await repo.upsertSavedHome(SAVED_HOME_OWNER_GUEST, testSkiChaletHomeA.sourceRef, later);

      const result = await repo.listSavedHomes(SAVED_HOME_OWNER_GUEST);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0]?.savedAt.getTime()).toBeGreaterThanOrEqual(result.data[1]?.savedAt.getTime() ?? 0);
      }
    });

    it('returns empty array for an owner with no saved homes', async () => {
      const result = await repo.listSavedHomes(SAVED_HOME_OWNER_BONVOY);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('scopes results to the requested owner', async () => {
      await repo.upsertSavedHome(SAVED_HOME_OWNER_GUEST, testBeachfrontHomeA.sourceRef);
      await repo.upsertSavedHome(SAVED_HOME_OWNER_BONVOY, testVineyardHomeA.sourceRef);

      const guestResult = await repo.listSavedHomes(SAVED_HOME_OWNER_GUEST);
      expect(isOk(guestResult)).toBe(true);
      if (isOk(guestResult)) {
        expect(guestResult.data.every(r => r.ownerRef === SAVED_HOME_OWNER_GUEST)).toBe(true);
      }
    });

    it('returns VALIDATION_FAILURE for empty ownerRef', async () => {
      const result = await repo.listSavedHomes('');
      expect(isValidationFailure(result)).toBe(true);
    });
  });

  describe('deriveInterestTags', () => {
    it('returns deduplicated sorted tag keys from all saved homes', async () => {
      await repo.upsertSavedHome(SAVED_HOME_OWNER_GUEST, testBeachfrontHomeA.sourceRef);
      await repo.upsertSavedHome(SAVED_HOME_OWNER_GUEST, testSkiChaletHomeA.sourceRef);

      const result = await repo.deriveInterestTags(SAVED_HOME_OWNER_GUEST);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // BEACHFRONT, MOUNTAIN_VIEW, OCEANVIEW, SKI_IN_SKI_OUT alphabetically
        const tags = result.data;
        expect(tags).toContain(INTEREST_TAG_KEYS.BEACHFRONT);
        expect(tags).toContain(INTEREST_TAG_KEYS.SKI_IN_SKI_OUT);
        // No duplicates
        expect(new Set(tags).size).toBe(tags.length);
        // Sorted alphabetically
        expect([...tags].sort()).toEqual(tags);
      }
    });

    it('returns empty array for an owner with no saved homes', async () => {
      const result = await repo.deriveInterestTags(SAVED_HOME_OWNER_BONVOY);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('returns VALIDATION_FAILURE for empty ownerRef', async () => {
      const result = await repo.deriveInterestTags('');
      expect(isValidationFailure(result)).toBe(true);
    });
  });
});
