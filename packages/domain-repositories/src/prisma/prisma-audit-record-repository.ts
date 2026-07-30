/**
 * Prisma-backed AuditRecordRepository implementation.
 *
 * This implementation exposes ONLY append and read methods. There are no
 * update or delete methods, enforcing the append-only audit ledger invariant
 * at the repository layer. Any attempt to access Prisma's update/delete APIs
 * for audit tables through this repository will fail at compile time.
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import { AuditEventType, DataClassificationTier } from '@voya/domain-model';
import { ok, validationFailure, repoError } from '../result.js';
import type { RepositoryResult } from '../result.js';
import type {
  AuditRecordRow,
  AuditLedgerRow,
  AppendAuditRecordInput,
  AppendLedgerEntryInput,
  AuditRecordRepository,
} from '../interfaces/audit-record-repository.js';

export class PrismaAuditRecordRepository implements AuditRecordRepository {
  constructor(private readonly db: PrismaClient) {}

  async append(input: AppendAuditRecordInput): Promise<RepositoryResult<AuditRecordRow>> {
    const errors = validateAppendAuditRecord(input);
    if (errors.length > 0) return validationFailure(errors);
    try {
      const row = await this.db.auditRecord.create({
        data: {
          eventType:          input.eventType as Prisma.AuditEventType,
          travellerProfileId: input.travellerProfileId ?? null,
          itineraryId:        input.itineraryId ?? null,
          sessionRef:         input.sessionRef ?? null,
          supplierId:         input.supplierId ?? null,
          payloadJson:        input.payloadJson,
          pathMode:           (input.pathMode ?? null) as Prisma.PathMode | null,
          dataClassification: (input.dataClassification ?? DataClassificationTier.INTERNAL) as Prisma.DataClassificationTier,
        },
      });
      return ok(row as unknown as AuditRecordRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async appendLedgerEntry(
    input: AppendLedgerEntryInput,
  ): Promise<RepositoryResult<AuditLedgerRow>> {
    const errors = validateAppendLedgerEntry(input);
    if (errors.length > 0) return validationFailure(errors);
    try {
      const row = await this.db.auditLedger.create({
        data: {
          eventType:           input.eventType as Prisma.AuditEventType,
          actorType:           input.actorType as Prisma.AuditActorType,
          actorRef:            input.actorRef,
          resourceType:        input.resourceType,
          resourceRef:         input.resourceRef,
          occurredAt:          input.occurredAt,
          correlationId:       input.correlationId,
          classificationTier:  (input.classificationTier ?? DataClassificationTier.INTERNAL) as Prisma.DataClassificationTier,
          redactedPayloadJson: input.redactedPayloadJson,
          canonicalHash:       input.canonicalHash,
        },
      });
      return ok(row as unknown as AuditLedgerRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async findByCorrelationId(
    correlationId: string,
  ): Promise<RepositoryResult<AuditLedgerRow[]>> {
    if (!correlationId) return validationFailure(['correlationId must not be empty']);
    try {
      const rows = await this.db.auditLedger.findMany({
        where:   { correlationId },
        orderBy: { occurredAt: 'asc' },
      });
      return ok(rows as unknown as AuditLedgerRow[]);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async findByResourceRef(
    resourceType: string,
    resourceRef: string,
    limit = 100,
  ): Promise<RepositoryResult<AuditLedgerRow[]>> {
    if (!resourceType) return validationFailure(['resourceType must not be empty']);
    if (!resourceRef) return validationFailure(['resourceRef must not be empty']);
    try {
      const rows = await this.db.auditLedger.findMany({
        where:   { resourceType, resourceRef },
        orderBy: { occurredAt: 'asc' },
        take:    Math.min(limit, 1000),
      });
      return ok(rows as unknown as AuditLedgerRow[]);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async countByEventType(eventType: AuditEventType): Promise<RepositoryResult<number>> {
    if (!Object.values(AuditEventType).includes(eventType)) {
      return validationFailure([`"${eventType}" is not a valid AuditEventType`]);
    }
    try {
      const count = await this.db.auditRecord.count({
        where: { eventType: eventType as Prisma.AuditEventType },
      });
      return ok(count);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateAppendAuditRecord(input: AppendAuditRecordInput): string[] {
  const errors: string[] = [];
  if (!Object.values(AuditEventType).includes(input.eventType)) {
    errors.push(`"${input.eventType}" is not a valid AuditEventType`);
  }
  if (!input.payloadJson || Object.keys(input.payloadJson).length === 0) {
    errors.push('payloadJson must not be empty');
  }
  return errors;
}

function validateAppendLedgerEntry(input: AppendLedgerEntryInput): string[] {
  const errors: string[] = [];
  if (!input.actorRef || input.actorRef.trim() === '') errors.push('actorRef must not be empty');
  if (!input.resourceRef || input.resourceRef.trim() === '') errors.push('resourceRef must not be empty');
  if (!input.correlationId || input.correlationId.trim() === '') errors.push('correlationId must not be empty');
  if (!input.canonicalHash || input.canonicalHash.trim() === '') errors.push('canonicalHash must not be empty');
  return errors;
}

function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message.replace(/\bpassword\b|\bsecret\b|\btoken\b/gi, '[REDACTED]');
  return 'Unexpected repository error';
}
