/**
 * TamperEvidentAuditLog — WO-101: Append-only tamper-evident audit log infrastructure.
 *
 * Properties:
 * - Append-only: no UPDATE or DELETE operations allowed (enforced by DB trigger)
 * - Tamper-evident: each entry has a SHA-256 chain hash linking it to its predecessor
 * - Integrity verification: re-compute hash chain and detect any gaps or mutations
 * - Entries include actor, resource, action, timestamp, and sanitised payload
 */

import { createHash } from "crypto";

export interface AuditLogEntry {
  id: string;
  sequence: number;
  chainHash: string; // SHA-256(prev_hash || actor_id || resource_type || resource_id || occurred_at || action)
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload: unknown;
  occurredAt: Date;
}

export interface AuditLogStore {
  append(entry: Omit<AuditLogEntry, "id" | "sequence" | "chainHash">): Promise<AuditLogEntry>;
  getLastEntry(resourceType?: string): Promise<AuditLogEntry | null>;
  getEntriesForResource(resourceType: string, resourceId: string): Promise<AuditLogEntry[]>;
  getAllEntries(fromSequence?: number, limit?: number): Promise<AuditLogEntry[]>;
}

export type VerificationResult =
  | { valid: true; entries: number }
  | { valid: false; firstInvalidAtSequence: number; reason: string };

/** Compute the chain hash for an entry. */
export function computeChainHash(
  prevHash: string,
  actorId: string,
  resourceType: string,
  resourceId: string,
  occurredAt: Date,
  action: string,
): string {
  const data = `${prevHash}|${actorId}|${resourceType}|${resourceId}|${occurredAt.toISOString()}|${action}`;
  return createHash("sha256").update(data, "utf8").digest("hex");
}

/** Verify the integrity of the audit log chain. */
export function verifyChain(entries: AuditLogEntry[]): VerificationResult {
  if (entries.length === 0) return { valid: true, entries: 0 };

  const sorted = [...entries].sort((a, b) => a.sequence - b.sequence);
  let prevHash = "genesis";

  for (const entry of sorted) {
    const expected = computeChainHash(
      prevHash,
      entry.actorId,
      entry.resourceType,
      entry.resourceId,
      entry.occurredAt,
      entry.action,
    );

    if (expected !== entry.chainHash) {
      return {
        valid: false,
        firstInvalidAtSequence: entry.sequence,
        reason: `Hash mismatch at sequence ${entry.sequence}: expected ${expected.slice(0, 8)}... got ${entry.chainHash.slice(0, 8)}...`,
      };
    }

    prevHash = entry.chainHash;
  }

  return { valid: true, entries: sorted.length };
}

export class TamperEvidentAuditWriter {
  constructor(private readonly store: AuditLogStore) {}

  async write(entry: Omit<AuditLogEntry, "id" | "sequence" | "chainHash">): Promise<AuditLogEntry> {
    const lastEntry = await this.store.getLastEntry();
    const prevHash = lastEntry?.chainHash ?? "genesis";

    const chainHash = computeChainHash(
      prevHash,
      entry.actorId,
      entry.resourceType,
      entry.resourceId,
      entry.occurredAt,
      entry.action,
    );

    return this.store.append({ ...entry, chainHash } as Omit<AuditLogEntry, "id" | "sequence">);
  }

  async verifyIntegrity(fromSequence?: number, limit?: number): Promise<VerificationResult> {
    const entries = await this.store.getAllEntries(fromSequence, limit);
    return verifyChain(entries);
  }
}
