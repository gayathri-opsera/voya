/**
 * AuditRecordRepository — interface contract
 *
 * Audit records are append-only. This interface exposes NO update or delete
 * methods. The repository layer enforces this invariant so even if a caller
 * obtains a Prisma client directly, they cannot bypass the append-only
 * contract through this interface.
 *
 * Both AuditRecord (legacy, linked to TravellerProfile/Itinerary) and
 * AuditLedger (WO-486, fully structured with actor/resource model) are
 * represented here. New code should prefer appendLedgerEntry.
 */

import type { AuditEventType, DataClassificationTier, PathMode } from '@voya/domain-model';
import type { RepositoryResult } from '../result.js';

// ---------------------------------------------------------------------------
// AuditRecord row (legacy model, linked to domain aggregates)
// ---------------------------------------------------------------------------

export interface AuditRecordRow {
  readonly id: string;
  readonly eventType: AuditEventType;
  readonly travellerProfileId: string | null;
  readonly itineraryId: string | null;
  readonly sessionRef: string | null;
  readonly supplierId: string | null;
  readonly payloadJson: Record<string, unknown>;
  readonly pathMode: PathMode | null;
  readonly dataClassification: DataClassificationTier;
  readonly createdAt: Date;
}

export interface AppendAuditRecordInput {
  readonly eventType: AuditEventType;
  readonly travellerProfileId?: string;
  readonly itineraryId?: string;
  readonly sessionRef?: string;
  readonly supplierId?: string;
  /** Structured, redacted payload — must not contain raw PII */
  readonly payloadJson: Record<string, unknown>;
  readonly pathMode?: PathMode;
  readonly dataClassification?: DataClassificationTier;
}

// ---------------------------------------------------------------------------
// AuditLedger row (structured model from WO-486)
// ---------------------------------------------------------------------------

export interface AuditLedgerRow {
  readonly id: string;
  readonly eventType: string;
  readonly actorType: string;
  readonly actorRef: string;
  readonly resourceType: string;
  readonly resourceRef: string;
  readonly occurredAt: Date;
  readonly correlationId: string;
  readonly classificationTier: DataClassificationTier;
  readonly redactedPayloadJson: Record<string, unknown>;
  readonly canonicalHash: string;
  readonly createdAt: Date;
}

export interface AppendLedgerEntryInput {
  readonly eventType: string;
  readonly actorType: string;
  /** Tokenized reference — never raw PII */
  readonly actorRef: string;
  readonly resourceType: string;
  readonly resourceRef: string;
  readonly occurredAt: Date;
  readonly correlationId: string;
  readonly classificationTier?: DataClassificationTier;
  readonly redactedPayloadJson: Record<string, unknown>;
  readonly canonicalHash: string;
}

// ---------------------------------------------------------------------------
// Interface — NO update or delete methods
// ---------------------------------------------------------------------------

export interface AuditRecordRepository {
  /**
   * Appends a new AuditRecord (legacy model).
   * Returns VALIDATION_FAILURE for empty payloadJson or unknown eventType.
   */
  append(input: AppendAuditRecordInput): Promise<RepositoryResult<AuditRecordRow>>;

  /**
   * Appends a new AuditLedger entry (structured WO-486 model).
   * Returns VALIDATION_FAILURE for empty actorRef, resourceRef, or correlationId.
   */
  appendLedgerEntry(input: AppendLedgerEntryInput): Promise<RepositoryResult<AuditLedgerRow>>;

  /**
   * Returns all audit records for a correlation ID, ordered by createdAt ASC.
   */
  findByCorrelationId(correlationId: string): Promise<RepositoryResult<AuditLedgerRow[]>>;

  /**
   * Returns audit records for a resource reference, ordered by occurredAt ASC.
   */
  findByResourceRef(
    resourceType: string,
    resourceRef: string,
    limit?: number,
  ): Promise<RepositoryResult<AuditLedgerRow[]>>;

  /**
   * Counts legacy audit records by event type (used for audit completeness checks).
   */
  countByEventType(eventType: AuditEventType): Promise<RepositoryResult<number>>;
}
