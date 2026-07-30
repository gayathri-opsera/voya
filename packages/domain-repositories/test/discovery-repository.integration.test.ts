/**
 * Integration tests for PrismaDiscoveryRepository and PrismaSavedHomeRepository.
 *
 * These tests require a real database and are skipped when DATABASE_URL is
 * not set. They validate migration 000004, round-trip collection/destination
 * queries, listCollectionHomes pagination, and saved-home idempotent upsert.
 *
 * Run locally with:
 *   DATABASE_URL=postgresql://... npx vitest run test/discovery-repository.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  PrismaDiscoveryRepository,
  PrismaSavedHomeRepository,
  isOk,
  isNotFound,
  isValidationFailure,
} from '../src/index.js';
import { COLLECTION_SLUGS, INTEREST_TAG_KEYS } from '@voya/domain-model';

const HAS_DB = Boolean(process.env['DATABASE_URL']);

let prisma: PrismaClient;

// Synthetic seed IDs — use unique prefixes to avoid collisions with parallel test runs
const TEST_RUN = `it_${Date.now()}`;

const DEST_SLUG        = `maldives-${TEST_RUN}`;
const COLL_SLUG        = `beachfront-test-${TEST_RUN}`;
const HOME_SOURCE_REF  = `HVMI_IT_BF_${TEST_RUN}`;
const OWNER_REF        = `owner_it_${TEST_RUN}`;

describe.skipIf(!HAS_DB)('PrismaDiscoveryRepository Integration Tests', () => {
  let destId:   string;
  let collId:   string;
  let homeId:   string;
  let tagId:    string;

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Seed destination
    const dest = await prisma.destination.create({
      data: {
        slug:        DEST_SLUG,
        displayName: `Integration Maldives ${TEST_RUN}`,
        isActive:    true,
        sortOrder:   1,
      },
    });
    destId = dest.id;

    // Seed collection
    const coll = await prisma.curatedCollection.create({
      data: {
        slug:          COLL_SLUG,
        displayName:   `Integration Beachfront ${TEST_RUN}`,
        isActive:      true,
        sortOrder:     1,
        destinationId: destId,
      },
    });
    collId = coll.id;

    // Seed interest tag
    const tag = await prisma.interestTag.create({
      data: {
        tagKey:       `BEACHFRONT_IT_${TEST_RUN}`,
        displayLabel: 'Beachfront IT',
        sortOrder:    1,
      },
    });
    tagId = tag.id;

    // Link tag to collection
    await prisma.collectionInterestTag.create({
      data: { collectionId: collId, tagId },
    });

    // Seed home reference
    const home = await prisma.homeInventoryReference.create({
      data: {
        sourceRef:           HOME_SOURCE_REF,
        supplierId:          'supp-it-001',
        bookingSource:       'HVMI' as never,
        displayNameSnapshot: `Integration Beachfront Home ${TEST_RUN}`,
        destinationId:       destId,
        destinationSlug:     DEST_SLUG,
        isActive:            true,
      },
    });
    homeId = home.id;

    // Link home to collection
    await prisma.collectionHome.create({
      data: { collectionId: collId, homeRefId: homeId, sortOrder: 1, isActive: true },
    });
  });

  afterAll(async () => {
    // Clean up in FK-safe reverse order
    await prisma.savedHome.deleteMany({ where: { ownerRef: OWNER_REF } });
    await prisma.collectionHome.deleteMany({ where: { collectionId: collId } });
    await prisma.homeInterestTag.deleteMany({ where: { homeRefId: homeId } });
    await prisma.homeInventoryReference.deleteMany({ where: { sourceRef: HOME_SOURCE_REF } });
    await prisma.collectionInterestTag.deleteMany({ where: { collectionId: collId } });
    await prisma.curatedCollection.deleteMany({ where: { id: collId } });
    await prisma.interestTag.deleteMany({ where: { id: tagId } });
    await prisma.destination.deleteMany({ where: { id: destId } });
    await prisma.$disconnect();
  });

  describe('findCollectionBySlug', () => {
    it('returns the collection for a valid active slug', async () => {
      const repo   = new PrismaDiscoveryRepository(prisma);
      const result = await repo.findCollectionBySlug(COLL_SLUG);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.slug).toBe(COLL_SLUG);
        expect(result.data.destinationId).toBe(destId);
      }
    });

    it('returns NOT_FOUND for an unknown slug', async () => {
      const repo   = new PrismaDiscoveryRepository(prisma);
      const result = await repo.findCollectionBySlug(`no-such-collection-${TEST_RUN}`);
      expect(isNotFound(result)).toBe(true);
    });

    it('returns VALIDATION_FAILURE for an invalid slug format', async () => {
      const repo   = new PrismaDiscoveryRepository(prisma);
      const result = await repo.findCollectionBySlug('');
      expect(isValidationFailure(result)).toBe(true);
    });
  });

  describe('listActiveCollections', () => {
    it('returns at least the seeded collection', async () => {
      const repo   = new PrismaDiscoveryRepository(prisma);
      const result = await repo.listActiveCollections();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const slugs = result.data.map(c => c.slug);
        expect(slugs).toContain(COLL_SLUG);
      }
    });
  });

  describe('listCollectionHomes', () => {
    it('returns active homes for the seeded collection', async () => {
      const repo   = new PrismaDiscoveryRepository(prisma);
      const result = await repo.listCollectionHomes(COLL_SLUG);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.length).toBeGreaterThanOrEqual(1);
        expect(result.data.map(h => h.sourceRef)).toContain(HOME_SOURCE_REF);
      }
    });

    it('respects the limit parameter', async () => {
      const repo   = new PrismaDiscoveryRepository(prisma);
      const result = await repo.listCollectionHomes(COLL_SLUG, 1);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.length).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('listTagsForCollection', () => {
    it('returns the seeded tag for the collection', async () => {
      const repo   = new PrismaDiscoveryRepository(prisma);
      const result = await repo.listTagsForCollection(COLL_SLUG);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.map(t => t.tagKey)).toContain(`BEACHFRONT_IT_${TEST_RUN}`);
      }
    });
  });

  describe('findDestinationBySlug', () => {
    it('returns the seeded destination', async () => {
      const repo   = new PrismaDiscoveryRepository(prisma);
      const result = await repo.findDestinationBySlug(DEST_SLUG);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.slug).toBe(DEST_SLUG);
      }
    });
  });
});

describe.skipIf(!HAS_DB)('PrismaSavedHomeRepository Integration Tests', () => {
  let destId:  string;
  let homeId:  string;

  beforeAll(async () => {
    prisma = new PrismaClient();

    const dest = await prisma.destination.create({
      data: { slug: `${DEST_SLUG}-saved`, displayName: `Integration Dest Saved ${TEST_RUN}`, isActive: true, sortOrder: 99 },
    });
    destId = dest.id;

    const home = await prisma.homeInventoryReference.create({
      data: {
        sourceRef:           `${HOME_SOURCE_REF}_SAVED`,
        supplierId:          'supp-it-001',
        bookingSource:       'HVMI' as never,
        displayNameSnapshot: `Integration Home Saved ${TEST_RUN}`,
        destinationId:       destId,
        isActive:            true,
      },
    });
    homeId = home.id;
  });

  afterAll(async () => {
    await prisma.savedHome.deleteMany({ where: { ownerRef: OWNER_REF } });
    await prisma.homeInventoryReference.deleteMany({ where: { id: homeId } });
    await prisma.destination.deleteMany({ where: { id: destId } });
    await prisma.$disconnect();
  });

  describe('upsertSavedHome', () => {
    it('creates a new row on first call', async () => {
      const repo   = new PrismaSavedHomeRepository(prisma);
      const result = await repo.upsertSavedHome(OWNER_REF, `${HOME_SOURCE_REF}_SAVED`);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.ownerRef).toBe(OWNER_REF);
        expect(result.data.homeRefId).toBe(homeId);
      }
    });

    it('is idempotent — returns original row with same id on duplicate call', async () => {
      const repo   = new PrismaSavedHomeRepository(prisma);
      const first  = await repo.upsertSavedHome(OWNER_REF, `${HOME_SOURCE_REF}_SAVED`);
      const second = await repo.upsertSavedHome(OWNER_REF, `${HOME_SOURCE_REF}_SAVED`);

      expect(isOk(first)).toBe(true);
      expect(isOk(second)).toBe(true);
      if (isOk(first) && isOk(second)) {
        expect(second.data.id).toBe(first.data.id);
        expect(second.data.savedAt.toISOString()).toBe(first.data.savedAt.toISOString());
      }
    });

    it('returns NOT_FOUND for an unknown homeSourceRef', async () => {
      const repo   = new PrismaSavedHomeRepository(prisma);
      const result = await repo.upsertSavedHome(OWNER_REF, 'HVMI_UNKNOWN_XYZ');
      expect(isNotFound(result)).toBe(true);
    });
  });

  describe('removeSavedHome', () => {
    it('removes a saved home and returns NOT_FOUND on subsequent cross-owner remove', async () => {
      const repo   = new PrismaSavedHomeRepository(prisma);

      // Ensure we have a saved home to remove
      const upsert = await repo.upsertSavedHome(`${OWNER_REF}_rm`, `${HOME_SOURCE_REF}_SAVED`);
      expect(isOk(upsert)).toBe(true);
      if (!isOk(upsert)) return;

      // Cross-owner attempt returns NOT_FOUND
      const crossRemove = await repo.removeSavedHome(upsert.data.id, `${OWNER_REF}_other`);
      expect(isNotFound(crossRemove)).toBe(true);

      // Owner can remove their own row
      const remove = await repo.removeSavedHome(upsert.data.id, `${OWNER_REF}_rm`);
      expect(isOk(remove)).toBe(true);
    });
  });

  describe('listSavedHomes', () => {
    it('returns saved homes for the owner', async () => {
      const repo   = new PrismaSavedHomeRepository(prisma);
      const result = await repo.listSavedHomes(OWNER_REF);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.every(r => r.ownerRef === OWNER_REF)).toBe(true);
      }
    });

    it('returns VALIDATION_FAILURE for empty ownerRef', async () => {
      const repo   = new PrismaSavedHomeRepository(prisma);
      const result = await repo.listSavedHomes('');
      expect(isValidationFailure(result)).toBe(true);
    });
  });

  describe('deriveInterestTags', () => {
    it('returns empty array for an owner with no saved homes', async () => {
      const repo   = new PrismaSavedHomeRepository(prisma);
      const result = await repo.deriveInterestTags(`${OWNER_REF}_empty`);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(0);
      }
    });
  });
});
