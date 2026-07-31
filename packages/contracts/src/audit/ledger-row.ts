/**
 * @voya/contracts — Audit ledger row mapping
 *
 * Maps a validated AuditEvent DTO to the plain-object shape of the
 * append-only AuditLedger persistence row (see the AuditLedger model in
 * prisma/schema.prisma). This module has no @prisma/client dependency — it
 * only defines the shared shape so that future persistence-layer code has
 * one field mapping to follow rather than re-deriving it per service.
 *
 * The ledger is append-only by contract: this module exposes no update or
 * delete helpers.
 */

import type { AuditEvent } from './audit-event.js';

// ---------------------------------------------------------------------------
// AuditLedgerRow
// Mirrors the AuditLedger Prisma model field-for-field.
// ---------------------------------------------------------------------------

export interface AuditLedgerRow {
  id: string;
  eventType: string;
  actorType: string;
  actorRef: string;
  resourceType: string;
  resourceRef: string;
  occurredAt: string;
  correlationId: string;
  classificationTier: string;
  redactedPayloadJson: Record<string, unknown>;
  canonicalHash: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// toAuditLedgerRow
// ---------------------------------------------------------------------------

/**
 * Maps a validated AuditEvent to the AuditLedger persistence row shape.
 *
 * @param event - A validated AuditEvent (see AuditEventSchema). Callers should
 *   parse untrusted input through AuditEventSchema before calling this.
 * @param canonicalHash - The hash digest computed from
 *   `event.canonicalHashInput` by the persistence layer. Choice of hashing
 *   algorithm is a persistence-layer concern and is not modelled here.
 * @param createdAt - ISO 8601 UTC timestamp for the ledger row's createdAt
 *   column. Distinct from `occurredAt`, which is the business event time.
 */
export function toAuditLedgerRow(
  event: AuditEvent,
  canonicalHash: string,
  createdAt: string,
): AuditLedgerRow {
  return {
    id: event.eventId,
    eventType: event.eventType,
    actorType: event.actor.actorType,
    actorRef: event.actor.actorRef,
    resourceType: event.resource.resourceType,
    resourceRef: event.resource.resourceRef,
    occurredAt: event.occurredAt,
    correlationId: event.correlationId,
    classificationTier: event.dataClassification,
    redactedPayloadJson: event.eventDetails,
    canonicalHash,
    createdAt,
  };
}
