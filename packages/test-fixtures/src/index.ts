/**
 * @voya/test-fixtures — Public API
 *
 * Synthetic test fixtures for the Voya domain model.
 * Import from this package in unit and integration tests only.
 */

export {
  // Type shapes
  type TravellerProfileFixture,
  type TravellerSessionFixture,
  type TripIntentFixture,
  type ItineraryFixture,
  type SourceProvenanceFixture,
  type ItineraryLineItemFixture,
  type TripConfidenceReceiptFixture,
  type SupplierCapabilityManifestFixture,
  type RetentionPolicyMetadataFixture,
  // Traveller profiles
  testGuestTravellerProfile,
  testBonvoyTravellerProfile,
  // Sessions
  testTravellerSession,
  // Trip intents
  testTripIntent,
  // Itineraries
  testItinerary,
  // Source provenance
  testHvmiSourceProvenance,
  testAmadeusSourceProvenance,
  // Line items
  testAccommodationLineItem,
  testFlightLineItem,
  // Receipts
  testPassingReceipt,
  testFailingReceipt,
  testBlockedReceipt,
  // Supplier manifests
  testHvmiManifestRow,
  testBrandManifestRow,
  // Retention policies
  testSessionRetentionPolicy,
  testAuditRetentionPolicy,
} from './core-domain-fixtures.js';

export {
  // Owner and session references
  CHECKPOINT_OWNER_A,
  CHECKPOINT_OWNER_B,
  SESSION_REF_PARIS,
  SESSION_REF_TOKYO,
  // Normalized trip constraints
  parisConstraints,
  partialTokyoConstraints,
  // Clarification fields
  pendingClarificationFields,
  resolvedClarificationFields,
  // Safe tool summaries
  accommodationSearchSummary,
  diningSearchSummary,
  // Create checkpoint inputs
  pendingClarificationCheckpointInput,
  intentCompleteCheckpointInput,
  expiredCheckpointInput,
  // Version conflict helper
  makeStaleVersionUpdateInput,
  // Degraded agent step scenario
  degradedDiningStep,
  // Sensitive payload fixtures for data-minimization tests
  sensitivePayloadFixture,
  nestedSensitivePayloadFixture,
  cleanConstraintsPayload,
} from './conversation-checkpoint-fixtures.js';

export {
  // Owner references
  SAVED_HOME_OWNER_GUEST,
  SAVED_HOME_OWNER_BONVOY,
  // Destinations
  testMaldivesDestination,
  testAspenDestination,
  testNapaValleyDestination,
  // Interest tags
  testBeachfrontTag,
  testSkiInSkiOutTag,
  testVineyardTag,
  testNationalParkTag,
  testMonthlyRentalTag,
  allInterestTags,
  // Collections
  testBeachfrontCollection,
  testSkiInSkiOutCollection,
  testVineyardWineryCollection,
  testNationalParkCollection,
  testMonthlyRentalsCollection,
  allCollections,
  // Home inventory references
  testBeachfrontHomeA,
  testBeachfrontHomeB,
  testSkiChaletHomeA,
  testVineyardHomeA,
  allHomeReferences,
  // Saved homes
  testGuestSavedBeachfrontA,
  testGuestSavedSkiChalet,
  testBonvoySavedVineyard,
  // Types
  type DiscoveryFixture,
  type SavedHomeFixture,
} from './discovery-fixtures.js';
