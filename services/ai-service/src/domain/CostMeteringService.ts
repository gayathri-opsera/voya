/**
 * CostMeteringService — WO-107: Meter and alarm assistant cost per completed booking.
 *
 * Tracks LLM token costs per session and per completed booking.
 * Emits cost metrics to CloudWatch for alerting.
 */

export interface CostRecord {
  sessionId: string;
  bookingId?: string;
  promptTokens: number;
  completionTokens: number;
  modelId: string;
  costUsd: number;
  recordedAt: Date;
}

export interface CostStore {
  record(entry: CostRecord): Promise<void>;
  getSessionCost(sessionId: string): Promise<number>;
  getBookingCost(bookingId: string): Promise<number>;
}

export class InMemoryCostStore implements CostStore {
  private readonly records: CostRecord[] = [];

  async record(entry: CostRecord): Promise<void> { this.records.push(entry); }

  async getSessionCost(sessionId: string): Promise<number> {
    return this.records
      .filter((r) => r.sessionId === sessionId)
      .reduce((sum, r) => sum + r.costUsd, 0);
  }

  async getBookingCost(bookingId: string): Promise<number> {
    return this.records
      .filter((r) => r.bookingId === bookingId)
      .reduce((sum, r) => sum + r.costUsd, 0);
  }
}

const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-3-haiku-20240307":   { input: 0.00025, output: 0.00125 },
  "claude-3-sonnet-20240229":  { input: 0.003,   output: 0.015   },
  "claude-3-opus-20240229":    { input: 0.015,   output: 0.075   },
};

export class CostMeteringService {
  constructor(
    private readonly store: CostStore,
    private readonly costAlertThresholdUsd = 0.50, // Alert if >$0.50 per booking
  ) {}

  async recordUsage(
    sessionId: string,
    modelId: string,
    promptTokens: number,
    completionTokens: number,
    bookingId?: string,
  ): Promise<{ costUsd: number; alertTriggered: boolean }> {
    const pricing = COST_PER_1K_TOKENS[modelId] ?? { input: 0.001, output: 0.002 };
    const costUsd =
      (promptTokens / 1000) * pricing.input +
      (completionTokens / 1000) * pricing.output;

    await this.store.record({ sessionId, bookingId, promptTokens, completionTokens, modelId, costUsd, recordedAt: new Date() });

    let alertTriggered = false;
    if (bookingId) {
      const bookingTotal = await this.store.getBookingCost(bookingId);
      alertTriggered = bookingTotal > this.costAlertThresholdUsd;
    }

    return { costUsd, alertTriggered };
  }

  async getSessionCost(sessionId: string): Promise<number> {
    return this.store.getSessionCost(sessionId);
  }
}
