/**
 * AuditWriter — writes append-only audit rows to booking_audit_log.
 *
 * - Sanitises payload using the shared audit payload minimiser
 * - Must be called WITHIN the same transaction as the state transition
 * - Audit write failure aborts the transaction (fail-closed)
 */

import { sanitiseAuditPayload } from "@travel/contracts/audit";

export interface AuditEntry {
  actorId: string;
  actorRole: string;
  resourceType: string;
  resourceId: string;
  previousState?: unknown;
  newState?: unknown;
}

export interface AuditStore {
  write(entry: AuditEntry): Promise<void>;
}

/**
 * In-memory implementation for testing.
 * Captures all written rows for assertion.
 */
export class InMemoryAuditStore implements AuditStore {
  readonly rows: (AuditEntry & { sanitisedPrev: unknown; sanitisedNew: unknown })[] = [];

  async write(entry: AuditEntry): Promise<void> {
    this.rows.push({
      ...entry,
      sanitisedPrev: sanitiseAuditPayload(entry.previousState),
      sanitisedNew: sanitiseAuditPayload(entry.newState),
    });
  }
}

export class AuditWriter {
  constructor(private readonly store: AuditStore) {}

  async record(entry: AuditEntry): Promise<void> {
    const sanitised: AuditEntry = {
      ...entry,
      previousState: sanitiseAuditPayload(entry.previousState),
      newState: sanitiseAuditPayload(entry.newState),
    };
    await this.store.write(sanitised);
  }
}
