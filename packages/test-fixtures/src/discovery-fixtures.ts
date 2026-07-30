/**
 * @voya/test-fixtures — Discovery and Saved Home Fixtures
 *
 * Synthetic Marriott-inspired catalog data for unit and integration tests.
 * All identifiers, image refs, and source refs are placeholders — no real
 * traveller, Bonvoy, supplier, payment, or employee data.
 * No copyrighted images are stored; heroImageRef values are metadata references.
 */

import { COLLECTION_SLUGS, INTEREST_TAG_KEYS } from '@voya/domain-model';
import type { CuratedCollectionRow, DestinationRow, HomeInventoryReferenceRow, InterestTagRow } from '@voya/domain-repositories';
import type { SavedHomeRow } from '@voya/domain-repositories';

// ---------------------------------------------------------------------------
// Synthetic owner references (tokenized, no real PII)
// ---------------------------------------------------------------------------

export const SAVED_HOME_OWNER_GUEST   = 'owner_ref_guest_sg001';
export const SAVED_HOME_OWNER_BONVOY  = 'owner_ref_bonvoy_bm002';

// ---------------------------------------------------------------------------
// Synthetic destination rows
// ---------------------------------------------------------------------------

export const testMaldivesDestination: DestinationRow = {
  id:                 'dest-uuid-maldives-0001',
  slug:               'maldives',
  displayName:        'Maldives',
  regionName:         'South Asia',
  countryCode:        'MV',
  heroImageRef:       'img_ref_dest_maldives_hero_001',
  heroImageAltText:   'Overwater bungalows at sunset',
  isActive:           true,
  sortOrder:          10,
  contentVersion:     1,
  dataClassification: 'PUBLIC' as const,
  createdAt:          new Date('2025-01-01T00:00:00Z'),
  updatedAt:          new Date('2025-01-01T00:00:00Z'),
};

export const testAspenDestination: DestinationRow = {
  id:                 'dest-uuid-aspen-0002',
  slug:               'aspen',
  displayName:        'Aspen',
  regionName:         'Rocky Mountains',
  countryCode:        'US',
  heroImageRef:       'img_ref_dest_aspen_hero_001',
  heroImageAltText:   'Snow-covered mountain peaks above ski resort',
  isActive:           true,
  sortOrder:          20,
  contentVersion:     1,
  dataClassification: 'PUBLIC' as const,
  createdAt:          new Date('2025-01-01T00:00:00Z'),
  updatedAt:          new Date('2025-01-01T00:00:00Z'),
};

export const testNapaValleyDestination: DestinationRow = {
  id:                 'dest-uuid-napa-0003',
  slug:               'napa-valley',
  displayName:        'Napa Valley',
  regionName:         'California',
  countryCode:        'US',
  heroImageRef:       'img_ref_dest_napa_hero_001',
  heroImageAltText:   'Rolling vineyard hills at golden hour',
  isActive:           true,
  sortOrder:          30,
  contentVersion:     1,
  dataClassification: 'PUBLIC' as const,
  createdAt:          new Date('2025-01-01T00:00:00Z'),
  updatedAt:          new Date('2025-01-01T00:00:00Z'),
};

// ---------------------------------------------------------------------------
// Synthetic interest tag rows
// ---------------------------------------------------------------------------

export const testBeachfrontTag: InterestTagRow = {
  id:           'tag-uuid-beachfront-0001',
  tagKey:       INTEREST_TAG_KEYS.BEACHFRONT,
  displayLabel: 'Beachfront',
  sortOrder:    10,
  createdAt:    new Date('2025-01-01T00:00:00Z'),
  updatedAt:    new Date('2025-01-01T00:00:00Z'),
};

export const testSkiInSkiOutTag: InterestTagRow = {
  id:           'tag-uuid-ski-0002',
  tagKey:       INTEREST_TAG_KEYS.SKI_IN_SKI_OUT,
  displayLabel: 'Ski-In Ski-Out',
  sortOrder:    20,
  createdAt:    new Date('2025-01-01T00:00:00Z'),
  updatedAt:    new Date('2025-01-01T00:00:00Z'),
};

export const testVineyardTag: InterestTagRow = {
  id:           'tag-uuid-vineyard-0003',
  tagKey:       INTEREST_TAG_KEYS.VINEYARD,
  displayLabel: 'Vineyard & Winery',
  sortOrder:    30,
  createdAt:    new Date('2025-01-01T00:00:00Z'),
  updatedAt:    new Date('2025-01-01T00:00:00Z'),
};

export const testNationalParkTag: InterestTagRow = {
  id:           'tag-uuid-natpark-0004',
  tagKey:       INTEREST_TAG_KEYS.NATIONAL_PARK,
  displayLabel: 'National Park',
  sortOrder:    40,
  createdAt:    new Date('2025-01-01T00:00:00Z'),
  updatedAt:    new Date('2025-01-01T00:00:00Z'),
};

export const testMonthlyRentalTag: InterestTagRow = {
  id:           'tag-uuid-monthly-0005',
  tagKey:       INTEREST_TAG_KEYS.MONTHLY_RENTAL,
  displayLabel: 'Monthly Rental',
  sortOrder:    50,
  createdAt:    new Date('2025-01-01T00:00:00Z'),
  updatedAt:    new Date('2025-01-01T00:00:00Z'),
};

export const allInterestTags: InterestTagRow[] = [
  testBeachfrontTag,
  testSkiInSkiOutTag,
  testVineyardTag,
  testNationalParkTag,
  testMonthlyRentalTag,
];

// ---------------------------------------------------------------------------
// Synthetic curated collection rows (Marriott-inspired 5-collection catalog)
// ---------------------------------------------------------------------------

export const testBeachfrontCollection: CuratedCollectionRow = {
  id:                 'col-uuid-beachfront-0001',
  slug:               COLLECTION_SLUGS.BEACHFRONT_RENTALS,
  displayName:        'Beachfront Rentals',
  editorialEyebrow:   'Wake up to the waves',
  description:        'Hand-selected homes steps from the shore, from secluded coves to vibrant resort beaches.',
  heroImageRef:       'img_ref_col_beachfront_hero_001',
  heroImageAltText:   'Luxury beachfront villa with private pool',
  isActive:           true,
  sortOrder:          10,
  contentVersion:     1,
  destinationId:      null,
  dataClassification: 'PUBLIC' as const,
  createdAt:          new Date('2025-01-01T00:00:00Z'),
  updatedAt:          new Date('2025-01-01T00:00:00Z'),
};

export const testSkiInSkiOutCollection: CuratedCollectionRow = {
  id:                 'col-uuid-ski-0002',
  slug:               COLLECTION_SLUGS.SKI_IN_SKI_OUT,
  displayName:        'Ski-In Ski-Out Chalets',
  editorialEyebrow:   'Slope access, resort comfort',
  description:        'Premium chalets with direct piste access across the world\'s finest mountain resorts.',
  heroImageRef:       'img_ref_col_ski_hero_001',
  heroImageAltText:   'Alpine chalet with ski slope directly outside',
  isActive:           true,
  sortOrder:          20,
  contentVersion:     1,
  destinationId:      testAspenDestination.id,
  dataClassification: 'PUBLIC' as const,
  createdAt:          new Date('2025-01-01T00:00:00Z'),
  updatedAt:          new Date('2025-01-01T00:00:00Z'),
};

export const testVineyardWineryCollection: CuratedCollectionRow = {
  id:                 'col-uuid-vineyard-0003',
  slug:               COLLECTION_SLUGS.VINEYARD_WINERY_HOMES,
  displayName:        'Vineyards & Winery Homes',
  editorialEyebrow:   'Estate stays among the vines',
  description:        'Private estates and guesthouses set within working vineyards, from Napa to Tuscany.',
  heroImageRef:       'img_ref_col_vineyard_hero_001',
  heroImageAltText:   'Stone farmhouse surrounded by rows of grapevines',
  isActive:           true,
  sortOrder:          30,
  contentVersion:     1,
  destinationId:      testNapaValleyDestination.id,
  dataClassification: 'PUBLIC' as const,
  createdAt:          new Date('2025-01-01T00:00:00Z'),
  updatedAt:          new Date('2025-01-01T00:00:00Z'),
};

export const testNationalParkCollection: CuratedCollectionRow = {
  id:                 'col-uuid-natpark-0004',
  slug:               COLLECTION_SLUGS.NATIONAL_PARK_HOMES,
  displayName:        'National Park Homes',
  editorialEyebrow:   'Nature at your doorstep',
  description:        'Cabins and lodges within or adjacent to national parks — built for outdoor adventure.',
  heroImageRef:       'img_ref_col_natpark_hero_001',
  heroImageAltText:   'Rustic log cabin with mountain forest backdrop',
  isActive:           true,
  sortOrder:          40,
  contentVersion:     1,
  destinationId:      null,
  dataClassification: 'PUBLIC' as const,
  createdAt:          new Date('2025-01-01T00:00:00Z'),
  updatedAt:          new Date('2025-01-01T00:00:00Z'),
};

export const testMonthlyRentalsCollection: CuratedCollectionRow = {
  id:                 'col-uuid-monthly-0005',
  slug:               COLLECTION_SLUGS.MONTHLY_RENTALS,
  displayName:        'Monthly Rentals',
  editorialEyebrow:   'Settle in, not just stay',
  description:        'Flexible extended-stay homes with monthly rates and the comforts of a second residence.',
  heroImageRef:       'img_ref_col_monthly_hero_001',
  heroImageAltText:   'Spacious modern apartment with city skyline view',
  isActive:           true,
  sortOrder:          50,
  contentVersion:     1,
  destinationId:      null,
  dataClassification: 'PUBLIC' as const,
  createdAt:          new Date('2025-01-01T00:00:00Z'),
  updatedAt:          new Date('2025-01-01T00:00:00Z'),
};

export const allCollections: CuratedCollectionRow[] = [
  testBeachfrontCollection,
  testSkiInSkiOutCollection,
  testVineyardWineryCollection,
  testNationalParkCollection,
  testMonthlyRentalsCollection,
];

// ---------------------------------------------------------------------------
// Synthetic home inventory references (HVMI-style synthetic source refs)
// ---------------------------------------------------------------------------

export const testBeachfrontHomeA: HomeInventoryReferenceRow = {
  id:                  'home-uuid-bf-a-0001',
  sourceRef:           'HVMI_SYNTH_BF_A001',
  supplierId:          'supp-synth-hvmi-001',
  bookingSource:       'HVMI' as const,
  displayNameSnapshot: 'Overwater Villa Maldives — Sunset Point',
  destinationId:       testMaldivesDestination.id,
  destinationSlug:     testMaldivesDestination.slug,
  heroImageRef:        'img_ref_home_bf_a001_hero',
  heroImageAltText:    'Overwater villa with glass floor panel above the lagoon',
  isActive:            true,
  dataClassification:  'INTERNAL' as const,
  createdAt:           new Date('2025-01-15T00:00:00Z'),
  updatedAt:           new Date('2025-01-15T00:00:00Z'),
};

export const testBeachfrontHomeB: HomeInventoryReferenceRow = {
  id:                  'home-uuid-bf-b-0002',
  sourceRef:           'HVMI_SYNTH_BF_B002',
  supplierId:          'supp-synth-hvmi-001',
  bookingSource:       'HVMI' as const,
  displayNameSnapshot: 'Beachfront Cottage Maldives — North Atoll',
  destinationId:       testMaldivesDestination.id,
  destinationSlug:     testMaldivesDestination.slug,
  heroImageRef:        'img_ref_home_bf_b002_hero',
  heroImageAltText:    'Thatched cottage on a private beach at high tide',
  isActive:            true,
  dataClassification:  'INTERNAL' as const,
  createdAt:           new Date('2025-01-15T00:00:00Z'),
  updatedAt:           new Date('2025-01-15T00:00:00Z'),
};

export const testSkiChaletHomeA: HomeInventoryReferenceRow = {
  id:                  'home-uuid-ski-a-0003',
  sourceRef:           'HVMI_SYNTH_SKI_A001',
  supplierId:          'supp-synth-hvmi-001',
  bookingSource:       'HVMI' as const,
  displayNameSnapshot: 'Aspen Ski-In Chalet — Mountain Village',
  destinationId:       testAspenDestination.id,
  destinationSlug:     testAspenDestination.slug,
  heroImageRef:        'img_ref_home_ski_a001_hero',
  heroImageAltText:    'Modern chalet with ski rack at piste-side entrance',
  isActive:            true,
  dataClassification:  'INTERNAL' as const,
  createdAt:           new Date('2025-01-15T00:00:00Z'),
  updatedAt:           new Date('2025-01-15T00:00:00Z'),
};

export const testVineyardHomeA: HomeInventoryReferenceRow = {
  id:                  'home-uuid-vin-a-0004',
  sourceRef:           'HVMI_SYNTH_VIN_A001',
  supplierId:          'supp-synth-hvmi-001',
  bookingSource:       'HVMI' as const,
  displayNameSnapshot: 'Napa Valley Estate Cottage — Harvest View',
  destinationId:       testNapaValleyDestination.id,
  destinationSlug:     testNapaValleyDestination.slug,
  heroImageRef:        'img_ref_home_vin_a001_hero',
  heroImageAltText:    'Converted winery cottage with barrel cellar entrance',
  isActive:            true,
  dataClassification:  'INTERNAL' as const,
  createdAt:           new Date('2025-01-15T00:00:00Z'),
  updatedAt:           new Date('2025-01-15T00:00:00Z'),
};

export const allHomeReferences: HomeInventoryReferenceRow[] = [
  testBeachfrontHomeA,
  testBeachfrontHomeB,
  testSkiChaletHomeA,
  testVineyardHomeA,
];

// ---------------------------------------------------------------------------
// Synthetic saved home rows
// ---------------------------------------------------------------------------

export const testGuestSavedBeachfrontA: SavedHomeRow = {
  id:                 'saved-uuid-guest-bf-a-0001',
  ownerRef:           SAVED_HOME_OWNER_GUEST,
  homeRefId:          testBeachfrontHomeA.id,
  savedAt:            new Date('2025-03-10T09:00:00Z'),
  notes:              'Perfect for the anniversary trip — check availability in April',
  dataClassification: 'INTERNAL' as const,
  createdAt:          new Date('2025-03-10T09:00:00Z'),
  updatedAt:          new Date('2025-03-10T09:00:00Z'),
  homeRef:            testBeachfrontHomeA,
};

export const testGuestSavedSkiChalet: SavedHomeRow = {
  id:                 'saved-uuid-guest-ski-0002',
  ownerRef:           SAVED_HOME_OWNER_GUEST,
  homeRefId:          testSkiChaletHomeA.id,
  savedAt:            new Date('2025-03-12T11:30:00Z'),
  notes:              null,
  dataClassification: 'INTERNAL' as const,
  createdAt:          new Date('2025-03-12T11:30:00Z'),
  updatedAt:          new Date('2025-03-12T11:30:00Z'),
  homeRef:            testSkiChaletHomeA,
};

export const testBonvoySavedVineyard: SavedHomeRow = {
  id:                 'saved-uuid-bonvoy-vin-0001',
  ownerRef:           SAVED_HOME_OWNER_BONVOY,
  homeRefId:          testVineyardHomeA.id,
  savedAt:            new Date('2025-04-01T14:00:00Z'),
  notes:              'Napa harvest season — September preferred',
  dataClassification: 'INTERNAL' as const,
  createdAt:          new Date('2025-04-01T14:00:00Z'),
  updatedAt:          new Date('2025-04-01T14:00:00Z'),
  homeRef:            testVineyardHomeA,
};

export type DiscoveryFixture = CuratedCollectionRow | DestinationRow | HomeInventoryReferenceRow | InterestTagRow;
export type SavedHomeFixture = SavedHomeRow;
