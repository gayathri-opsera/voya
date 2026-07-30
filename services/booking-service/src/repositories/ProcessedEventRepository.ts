/**
 * ProcessedEventRepository — idempotency authority for inbound events.
 *
 * The unique constraint on (provider, event_id) is the durable exactly-once
 * authority. Duplicate inserts are caught and returned as a no-op.
 */

export interface ProcessedEvent {
  id: string;
  provider: string;
  eventId: string;
  eventType: string;
  payloadDigest: string | null;
  receivedAt: Date;
  processedAt: Date | null;
}

export type IdempotencyResult =
  | { duplicate: false; event: ProcessedEvent }
  | { duplicate: true; existingId: string };

export interface ProcessedEventStore {
  insert(input: {
    provider: string;
    eventId: string;
    eventType: string;
    payloadDigest?: string;
  }): Promise<IdempotencyResult>;
}

/**
 * In-memory implementation for testing.
 */
export class InMemoryProcessedEventStore implements ProcessedEventStore {
  private readonly store = new Map<string, ProcessedEvent>();

  async insert(input: {
    provider: string;
    eventId: string;
    eventType: string;
    payloadDigest?: string;
  }): Promise<IdempotencyResult> {
    const key = `${input.provider}:${input.eventId}`;
    const existing = this.store.get(key);
    if (existing) {
      return { duplicate: true, existingId: existing.id };
    }

    const event: ProcessedEvent = {
      id: Math.random().toString(36).slice(2),
      provider: input.provider,
      eventId: input.eventId,
      eventType: input.eventType,
      payloadDigest: input.payloadDigest ?? null,
      receivedAt: new Date(),
      processedAt: null,
    };
    this.store.set(key, event);
    return { duplicate: false, event };
  }

  clear(): void {
    this.store.clear();
  }
}
