/**
 * @voya/domain-model — Public API
 *
 * Schema-adjacent domain enums, type guards, validation helpers, and data
 * classification utilities for the Voya persistence layer.
 *
 * This package has no Zod or Express dependency. It is safe to import from
 * any service layer, migration script, or seed utility.
 */

// ---------------------------------------------------------------------------
// Domain enums and helpers
// ---------------------------------------------------------------------------

export {
  // Enums mirroring @voya/contracts (plain TS, no Zod)
  InventoryDomain,
  BookingSource,
  SourceClassification,
  SupplierBookability,
  PathMode,
  DataClassificationTier,
  CancellationSemantics,
  RefundSemantics,
  SupplierCertificationStatus,
  RetentionPurgeAction,
  RetentionApprovalStatus,
  AuditEventType,
  // Persistence-layer-only enums
  ItineraryStatus,
  TravellerIdentityType,
  ReceiptOutcomePersisted,
  // Itinerary status helpers
  isValidItineraryTransition,
  isTerminalItineraryStatus,
  // Receipt outcome helpers
  isTerminalReceiptOutcome,
  isBlockingReceiptOutcome,
  // Monetary and latency validation helpers
  validateMinorUnits,
  validateLatencySeconds,
  validatePointsAmount,
} from './domain-enums.js';

// ---------------------------------------------------------------------------
// Data classification helpers
// ---------------------------------------------------------------------------

export {
  getDataClassificationPolicy,
  requiresEncryptionAtRest,
  requiresLogMasking,
  requiresNonProdAnonymization,
  isPromptEligible,
  getMaxRetentionDays,
  calculatePurgeDate,
  isPastPurgeDate,
} from './data-classification.js';

export type { DataClassificationPolicy, RetentionCalculationResult } from './data-classification.js';

// ---------------------------------------------------------------------------
// Trip constraints and clarification types
// ---------------------------------------------------------------------------

export {
  ClarificationFieldKey,
} from './trip-constraints.js';

export type {
  ClarificationField,
  TripConstraints,
  SafeToolSummary,
} from './trip-constraints.js';

// ---------------------------------------------------------------------------
// Conversation checkpoint domain types
// ---------------------------------------------------------------------------

export {
  OrchestratorPhase,
  AgentStepStatus,
  CheckpointOutcome,
  validateCheckpointPayload,
  isValidOrchestratorTransition,
  isTerminalCheckpointOutcome,
  isDegradedAgentStep,
  isTerminalAgentStepStatus,
} from './conversation-checkpoint.js';

export type { DataMinimizationResult } from './conversation-checkpoint.js';
