/**
 * Integration tests for @voya/contracts — audit event -> ledger row shape
 *
 * Requirements validated:
 *  AC6 — representative audit event serialization for sourcing fallback,
 *        manifest exclusion, receipt block, and prompt-safety rejection
 *        using shared fixtures and the proposed AuditLedger row shape.
 *
 * These tests simulate what a future persistence-layer service will do:
 * validate an incoming AuditEvent, compute a hash from its canonicalHashInput,
 * and map it to the append-only AuditLedger row shape.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  AuditEventSchema,
  validateEventDetails,
  toAuditLedgerRow,
  type AuditEvent,
} from '../../src/index.js';
import {
  hvmiFallbackDisclosureEvent,
  manifestExclusionEvent,
  receiptBlockedEvent,
  promptSafetyRejectionEvent,
} from '../fixtures/audit-events.js';

const FIXED_CREATED_AT = '2026-07-30T00:00:00.000Z';

/** Simulates the persistence-layer hashing step (SHA-256 of the canonical input). */
function hashCanonicalInput(event: AuditEvent): string {
  return createHash('sha256').update(event.canonicalHashInput).digest('hex');
}

const REPRESENTATIVE_EVENTS: ReadonlyArray<{ label: string; event: AuditEvent }> = [
  { label: 'sourcing fallback disclosure', event: hvmiFallbackDisclosureEvent },
  { label: 'manifest exclusion', event: manifestExclusionEvent },
  { label: 'receipt blocked', event: receiptBlockedEvent },
  { label: 'prompt-safety rejection', event: promptSafetyRejectionEvent },
];

describe('Integration — audit event serialization into the AuditLedger row shape', () => {
  for (const { label, event } of REPRESENTATIVE_EVENTS) {
    describe(label, () => {
      it('passes AuditEventSchema validation', () => {
        const result = AuditEventSchema.safeParse(event);
        expect(result.success).toBe(true);
      });

      it('maps cleanly to the AuditLedger row shape with all fields populated', () => {
        const hash = hashCanonicalInput(event);
        const row = toAuditLedgerRow(event, hash, FIXED_CREATED_AT);

        expect(row.id).toBe(event.eventId);
        expect(row.eventType).toBe(event.eventType);
        expect(row.actorType).toBe(event.actor.actorType);
        expect(row.actorRef).toBe(event.actor.actorRef);
        expect(row.resourceType).toBe(event.resource.resourceType);
        expect(row.resourceRef).toBe(event.resource.resourceRef);
        expect(row.occurredAt).toBe(event.occurredAt);
        expect(row.correlationId).toBe(event.correlationId);
        expect(row.classificationTier).toBe(event.dataClassification);
        expect(row.redactedPayloadJson).toEqual(event.eventDetails);
        expect(row.canonicalHash).toBe(hash);
        expect(row.createdAt).toBe(FIXED_CREATED_AT);
      });

      it('survives a JSON serialization round-trip without losing fields', () => {
        const hash = hashCanonicalInput(event);
        const row = toAuditLedgerRow(event, hash, FIXED_CREATED_AT);
        const roundTripped = JSON.parse(JSON.stringify(row)) as typeof row;
        expect(roundTripped).toEqual(row);
      });

      it('redactedPayloadJson contains no restricted field names', () => {
        const hash = hashCanonicalInput(event);
        const row = toAuditLedgerRow(event, hash, FIXED_CREATED_AT);
        const violations = validateEventDetails(row.redactedPayloadJson);
        expect(violations).toHaveLength(0);
      });

      it('canonicalHash is a stable function of canonicalHashInput', () => {
        const hash1 = hashCanonicalInput(event);
        const hash2 = hashCanonicalInput(event);
        expect(hash1).toBe(hash2);
        expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      });
    });
  }

  it('two different representative events produce different ledger rows', () => {
    const rowA = toAuditLedgerRow(
      hvmiFallbackDisclosureEvent,
      hashCanonicalInput(hvmiFallbackDisclosureEvent),
      FIXED_CREATED_AT,
    );
    const rowB = toAuditLedgerRow(
      manifestExclusionEvent,
      hashCanonicalInput(manifestExclusionEvent),
      FIXED_CREATED_AT,
    );
    expect(rowA.id).not.toBe(rowB.id);
    expect(rowA.canonicalHash).not.toBe(rowB.canonicalHash);
  });

  it('the prompt-safety rejection row reflects its partial redaction metadata', () => {
    // promptSafetyRejectionEvent fixture is CONFIDENTIAL with isRedacted:true —
    // the ledger row must still validate cleanly even though upstream redaction occurred.
    expect(promptSafetyRejectionEvent.redactionMeta.isRedacted).toBe(true);
    expect(promptSafetyRejectionEvent.redactionMeta.redactedFields.length).toBeGreaterThan(0);
    const row = toAuditLedgerRow(
      promptSafetyRejectionEvent,
      hashCanonicalInput(promptSafetyRejectionEvent),
      FIXED_CREATED_AT,
    );
    expect(row.classificationTier).toBe('CONFIDENTIAL');
  });
});
