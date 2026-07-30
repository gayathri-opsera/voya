/**
 * @voya/domain-repositories — Public API
 *
 * Exports framework-independent repository interfaces and Prisma-backed
 * implementations separately so downstream services can depend on the
 * interface types without importing the Prisma adapter.
 *
 * Import pattern:
 *   import type { ItineraryRepository } from '@voya/domain-repositories';
 *   import { PrismaItineraryRepository } from '@voya/domain-repositories';
 */

// ---------------------------------------------------------------------------
// Typed result union
// ---------------------------------------------------------------------------

export type { RepositoryResult } from './result.js';
export {
  ok,
  notFound,
  expired,
  validationFailure,
  versionConflict,
  repoError,
  isOk,
  isNotFound,
  isExpired,
  isValidationFailure,
  isVersionConflict,
} from './result.js';

// ---------------------------------------------------------------------------
// Repository interfaces — framework-independent
// ---------------------------------------------------------------------------

export type {
  TravellerProfileRow,
  CreateTravellerProfileInput,
  TravellerProfileRepository,
} from './interfaces/traveller-profile-repository.js';

export type {
  TripIntentRow,
  CreateTripIntentInput,
  TripIntentRepository,
} from './interfaces/trip-intent-repository.js';

export type {
  SourceProvenanceRow,
  ItineraryLineItemRow,
  ItineraryDayRow,
  ItineraryRow,
  CreateSourceProvenanceInput,
  CreateLineItemInput,
  CreateItineraryDayInput,
  CreateItineraryInput,
  ItineraryRepository,
} from './interfaces/itinerary-repository.js';

export type {
  PersistedReceiptOutcome,
  ReceiptRow,
  ReceiptLineItemInput,
  AppendReceiptInput,
  TripConfidenceReceiptRepository,
} from './interfaces/trip-confidence-receipt-repository.js';

export type {
  SupplierManifestRow,
  SupplierManifestRepository,
} from './interfaces/supplier-manifest-repository.js';
export { UNCERTIFIED_SENTINEL } from './interfaces/supplier-manifest-repository.js';

export type {
  AuditRecordRow,
  AuditLedgerRow,
  AppendAuditRecordInput,
  AppendLedgerEntryInput,
  AuditRecordRepository,
} from './interfaces/audit-record-repository.js';

export type {
  ConversationCheckpointRow,
  AgentStepRow,
  CreateCheckpointInput,
  AppendStepResultInput,
  UpdateCheckpointInput,
  ConversationCheckpointRepository,
} from './interfaces/conversation-checkpoint-repository.js';

// ---------------------------------------------------------------------------
// Prisma-backed implementations
// ---------------------------------------------------------------------------

export { PrismaTravellerProfileRepository } from './prisma/prisma-traveller-profile-repository.js';
export { PrismaTripIntentRepository } from './prisma/prisma-trip-intent-repository.js';
export { PrismaItineraryRepository } from './prisma/prisma-itinerary-repository.js';
export { PrismaTripConfidenceReceiptRepository } from './prisma/prisma-trip-confidence-receipt-repository.js';
export { PrismaSupplierManifestRepository } from './prisma/prisma-supplier-manifest-repository.js';
export { PrismaAuditRecordRepository } from './prisma/prisma-audit-record-repository.js';
export { PrismaConversationCheckpointRepository } from './prisma/prisma-conversation-checkpoint-repository.js';
