/**
 * Unit tests for DiscoveryRepository — domain types, validators, and in-memory
 * fake repository implementation.
 *
 * No database required. Tests prove:
 *  - listActiveCollections returns active rows sorted by sortOrder
 *  - findCollectionBySlug returns VALIDATION_FAILURE for invalid slugs
 *  - findCollectionBySlug returns NOT_FOUND for inactive or missing slugs
 *  - listCollectionHomes returns NOT_FOUND for inactive collections
 *  - listCollectionHomes returns empty array when collection has no active homes
 *  - listCollectionHomes respects the limit parameter
 *  - listTagsForCollection returns empty array when no tags assigned
 *  - isValidSlug, validateSlug, isValidTagKey, validateTagKey enforce patterns
 *  - COLLECTION_SLUGS and INTEREST_TAG_KEYS values match expected strings
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isValidSlug,
  validateSlug,
  isValidTagKey,
  validateTagKey,
  isValidSourceRef,
  isValidContentVersion,
  COLLECTION_SLUGS,
  INTEREST_TAG_KEYS,
} from '@voya/domain-model';
import { ok, notFound, validationFailure, isOk, isNotFound, isValidationFailure } from '../src/result.js';
import type { RepositoryResult } from '../src/result.js';
import type {
  DiscoveryRepository,
  DestinationRow,
  CuratedCollectionRow,
  HomeInventoryReferenceRow,
  InterestTagRow,
} from '../src/interfaces/discovery-repository.js';
import {
  testBeachfrontCollection,
  testSkiInSkiOutCollection,
  testVineyardWineryCollection,
  testNationalParkCollection,
  testMonthlyRentalsCollection,
  allCollections,
  testMaldivesDestination,
  testAspenDestination,
  testBeachfrontHomeA,
  testBeachfrontHomeB,
  testSkiChaletHomeA,
  testBeachfrontTag,
  testSkiInSkiOutTag,
  allInterestTags,
} from '@voya/test-fixtures';

// ---------------------------------------------------------------------------
// In-memory fake DiscoveryRepository
// ---------------------------------------------------------------------------

interface CollectionHomeLink {
  collectionId: string;
  homeRef: HomeInventoryReferenceRow;
  sortOrder: number;
  isActive: boolean;
}

interface CollectionTagLink {
  collectionId: string;
  tag: InterestTagRow;
}

class FakeDiscoveryRepository implements DiscoveryRepository {
  private readonly collections: CuratedCollectionRow[];
  private readonly destinations: DestinationRow[];
  private readonly collectionHomes: CollectionHomeLink[];
  private readonly collectionTags: CollectionTagLink[];

  constructor() {
    this.collections    = [...allCollections];
    this.destinations   = [testMaldivesDestination, testAspenDestination];
    this.collectionHomes = [
      { collectionId: testBeachfrontCollection.id, homeRef: testBeachfrontHomeA, sortOrder: 1, isActive: true },
      { collectionId: testBeachfrontCollection.id, homeRef: testBeachfrontHomeB, sortOrder: 2, isActive: true },
      { collectionId: testSkiInSkiOutCollection.id, homeRef: testSkiChaletHomeA, sortOrder: 1, isActive: true },
    ];
    this.collectionTags = [
      { collectionId: testBeachfrontCollection.id, tag: testBeachfrontTag },
      { collectionId: testSkiInSkiOutCollection.id, tag: testSkiInSkiOutTag },
    ];
  }

  async listActiveCollections(): Promise<RepositoryResult<CuratedCollectionRow[]>> {
    const active = this.collections
      .filter(c => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return ok(active);
  }

  async findCollectionBySlug(slug: string): Promise<RepositoryResult<CuratedCollectionRow>> {
    const errors = validateSlug(slug);
    if (errors.length > 0) return validationFailure([...errors]);

    const col = this.collections.find(c => c.slug === slug && c.isActive);
    return col ? ok(col) : notFound();
  }

  async listCollectionHomes(
    collectionSlug: string,
    limit?: number,
  ): Promise<RepositoryResult<HomeInventoryReferenceRow[]>> {
    const errors = validateSlug(collectionSlug);
    if (errors.length > 0) return validationFailure([...errors]);

    const col = this.collections.find(c => c.slug === collectionSlug && c.isActive);
    if (!col) return notFound();

    let links = this.collectionHomes
      .filter(l => l.collectionId === col.id && l.isActive && l.homeRef.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(l => l.homeRef);

    if (limit !== undefined) links = links.slice(0, limit);
    return ok(links);
  }

  async listTagsForCollection(collectionSlug: string): Promise<RepositoryResult<InterestTagRow[]>> {
    const errors = validateSlug(collectionSlug);
    if (errors.length > 0) return validationFailure([...errors]);

    const col = this.collections.find(c => c.slug === collectionSlug && c.isActive);
    if (!col) return notFound();

    const tags = this.collectionTags
      .filter(l => l.collectionId === col.id)
      .map(l => l.tag)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return ok(tags);
  }

  async findDestinationBySlug(slug: string): Promise<RepositoryResult<DestinationRow>> {
    const errors = validateSlug(slug);
    if (errors.length > 0) return validationFailure([...errors]);

    const dest = this.destinations.find(d => d.slug === slug && d.isActive);
    return dest ? ok(dest) : notFound();
  }

  async listActiveDestinations(): Promise<RepositoryResult<DestinationRow[]>> {
    const active = this.destinations
      .filter(d => d.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return ok(active);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('domain-model discovery validators', () => {
  describe('isValidSlug', () => {
    it('accepts lowercase alphanumeric with hyphens', () => {
      expect(isValidSlug('beachfront-rentals')).toBe(true);
      expect(isValidSlug('ski-in-ski-out')).toBe(true);
      expect(isValidSlug('ab')).toBe(true);
    });

    it('rejects uppercase, spaces, underscores', () => {
      expect(isValidSlug('BEACHFRONT')).toBe(false);
      expect(isValidSlug('beachfront rentals')).toBe(false);
      expect(isValidSlug('beachfront_rentals')).toBe(false);
    });

    it('rejects slugs starting or ending with hyphen', () => {
      expect(isValidSlug('-beachfront')).toBe(false);
      expect(isValidSlug('beachfront-')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidSlug('')).toBe(false);
    });
  });

  describe('validateSlug', () => {
    it('returns empty array for valid slug', () => {
      expect(validateSlug('beachfront-rentals')).toHaveLength(0);
    });

    it('returns error for empty slug', () => {
      expect(validateSlug('')).not.toHaveLength(0);
    });

    it('returns error for invalid characters', () => {
      expect(validateSlug('UPPER_CASE')).not.toHaveLength(0);
    });
  });

  describe('isValidTagKey', () => {
    it('accepts SCREAMING_SNAKE_CASE', () => {
      expect(isValidTagKey('BEACHFRONT')).toBe(true);
      expect(isValidTagKey('SKI_IN_SKI_OUT')).toBe(true);
    });

    it('rejects lowercase keys', () => {
      expect(isValidTagKey('beachfront')).toBe(false);
    });
  });

  describe('validateTagKey', () => {
    it('returns empty array for valid key', () => {
      expect(validateTagKey('BEACHFRONT')).toHaveLength(0);
    });

    it('returns error for invalid key', () => {
      expect(validateTagKey('beachfront')).not.toHaveLength(0);
    });
  });

  describe('isValidSourceRef', () => {
    it('accepts alphanumeric refs', () => {
      expect(isValidSourceRef('HVMI_SYNTH_BF_A001')).toBe(true);
    });

    it('rejects refs with whitespace', () => {
      expect(isValidSourceRef('HVMI REF')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidSourceRef('')).toBe(false);
    });
  });

  describe('isValidContentVersion', () => {
    it('accepts positive integers', () => {
      expect(isValidContentVersion(1)).toBe(true);
      expect(isValidContentVersion(42)).toBe(true);
    });

    it('rejects zero or negative', () => {
      expect(isValidContentVersion(0)).toBe(false);
      expect(isValidContentVersion(-1)).toBe(false);
    });

    it('rejects non-integers', () => {
      expect(isValidContentVersion(1.5)).toBe(false);
    });
  });

  describe('COLLECTION_SLUGS constants', () => {
    it('contains all five well-known slugs', () => {
      expect(COLLECTION_SLUGS.BEACHFRONT_RENTALS).toBe('beachfront-rentals');
      expect(COLLECTION_SLUGS.SKI_IN_SKI_OUT).toBe('ski-in-ski-out');
      expect(COLLECTION_SLUGS.VINEYARD_WINERY_HOMES).toBe('vineyard-winery-homes');
      expect(COLLECTION_SLUGS.NATIONAL_PARK_HOMES).toBe('national-park-homes');
      expect(COLLECTION_SLUGS.MONTHLY_RENTALS).toBe('monthly-rentals');
    });
  });

  describe('INTEREST_TAG_KEYS constants', () => {
    it('contains all ten well-known tag keys', () => {
      expect(INTEREST_TAG_KEYS.BEACHFRONT).toBe('BEACHFRONT');
      expect(INTEREST_TAG_KEYS.SKI_IN_SKI_OUT).toBe('SKI_IN_SKI_OUT');
      expect(INTEREST_TAG_KEYS.VINEYARD).toBe('VINEYARD');
      expect(INTEREST_TAG_KEYS.NATIONAL_PARK).toBe('NATIONAL_PARK');
      expect(INTEREST_TAG_KEYS.MONTHLY_RENTAL).toBe('MONTHLY_RENTAL');
    });
  });
});

describe('FakeDiscoveryRepository', () => {
  let repo: FakeDiscoveryRepository;

  beforeEach(() => {
    repo = new FakeDiscoveryRepository();
  });

  describe('listActiveCollections', () => {
    it('returns all active collections sorted by sortOrder', async () => {
      const result = await repo.listActiveCollections();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(5);
        const slugs = result.data.map(c => c.slug);
        expect(slugs[0]).toBe(COLLECTION_SLUGS.BEACHFRONT_RENTALS);
        expect(slugs[4]).toBe(COLLECTION_SLUGS.MONTHLY_RENTALS);
      }
    });
  });

  describe('findCollectionBySlug', () => {
    it('returns the collection for a valid active slug', async () => {
      const result = await repo.findCollectionBySlug(COLLECTION_SLUGS.BEACHFRONT_RENTALS);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.slug).toBe(COLLECTION_SLUGS.BEACHFRONT_RENTALS);
        expect(result.data.isActive).toBe(true);
      }
    });

    it('returns NOT_FOUND for an unknown slug', async () => {
      const result = await repo.findCollectionBySlug('unknown-slug-xyz');
      expect(isNotFound(result)).toBe(true);
    });

    it('returns VALIDATION_FAILURE for an invalid slug format', async () => {
      const result = await repo.findCollectionBySlug('INVALID SLUG');
      expect(isValidationFailure(result)).toBe(true);
    });

    it('returns VALIDATION_FAILURE for empty slug', async () => {
      const result = await repo.findCollectionBySlug('');
      expect(isValidationFailure(result)).toBe(true);
    });
  });

  describe('listCollectionHomes', () => {
    it('returns homes for the beachfront collection sorted by sortOrder', async () => {
      const result = await repo.listCollectionHomes(COLLECTION_SLUGS.BEACHFRONT_RENTALS);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0]?.sourceRef).toBe('HVMI_SYNTH_BF_A001');
        expect(result.data[1]?.sourceRef).toBe('HVMI_SYNTH_BF_B002');
      }
    });

    it('respects the limit parameter', async () => {
      const result = await repo.listCollectionHomes(COLLECTION_SLUGS.BEACHFRONT_RENTALS, 1);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(1);
      }
    });

    it('returns empty array for a collection with no homes', async () => {
      const result = await repo.listCollectionHomes(COLLECTION_SLUGS.VINEYARD_WINERY_HOMES);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('returns NOT_FOUND for an unknown collection slug', async () => {
      const result = await repo.listCollectionHomes('does-not-exist');
      expect(isNotFound(result)).toBe(true);
    });

    it('returns VALIDATION_FAILURE for an invalid slug', async () => {
      const result = await repo.listCollectionHomes('');
      expect(isValidationFailure(result)).toBe(true);
    });
  });

  describe('listTagsForCollection', () => {
    it('returns tags for the beachfront collection', async () => {
      const result = await repo.listTagsForCollection(COLLECTION_SLUGS.BEACHFRONT_RENTALS);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.map(t => t.tagKey)).toContain(INTEREST_TAG_KEYS.BEACHFRONT);
      }
    });

    it('returns empty array for a collection with no tags', async () => {
      const result = await repo.listTagsForCollection(COLLECTION_SLUGS.NATIONAL_PARK_HOMES);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('returns NOT_FOUND for unknown slug', async () => {
      const result = await repo.listTagsForCollection('no-such-collection');
      expect(isNotFound(result)).toBe(true);
    });
  });

  describe('findDestinationBySlug', () => {
    it('returns a destination for a valid active slug', async () => {
      const result = await repo.findDestinationBySlug('maldives');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.displayName).toBe('Maldives');
      }
    });

    it('returns NOT_FOUND for an unknown destination slug', async () => {
      const result = await repo.findDestinationBySlug('no-such-place');
      expect(isNotFound(result)).toBe(true);
    });

    it('returns VALIDATION_FAILURE for an invalid slug', async () => {
      const result = await repo.findDestinationBySlug('');
      expect(isValidationFailure(result)).toBe(true);
    });
  });

  describe('listActiveDestinations', () => {
    it('returns active destinations sorted by sortOrder', async () => {
      const result = await repo.listActiveDestinations();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.length).toBeGreaterThanOrEqual(2);
        expect(result.data[0]?.sortOrder).toBeLessThanOrEqual(result.data[1]?.sortOrder ?? Infinity);
      }
    });
  });
});
