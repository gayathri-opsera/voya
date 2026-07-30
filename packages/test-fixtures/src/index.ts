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
