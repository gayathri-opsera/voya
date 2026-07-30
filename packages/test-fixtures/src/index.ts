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
