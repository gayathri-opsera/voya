/**
 * TokenBudgetGuard — WO-059: Token budget guard and tool call cost caps.
 *
 * Enforces per-session token budgets and prevents runaway tool call chains.
 * Tracks:
 * - Total tokens consumed per session
 * - Number of tool calls per turn
 * - Cumulative cost estimate
 *
 * Throws BudgetExceededError when limits are hit.
 */

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface BudgetConfig {
  maxTokensPerSession: number;    // Hard limit for the full conversation
  maxTokensPerTurn: number;       // Hard limit per single exchange
  maxToolCallsPerTurn: number;    // Prevent tool call loops
  maxCostUsdPerSession: number;   // Cost cap in USD
  costPerThousandTokens: number;  // Model pricing
}

export const DEFAULT_BUDGET: BudgetConfig = {
  maxTokensPerSession: 100_000,
  maxTokensPerTurn: 8_000,
  maxToolCallsPerTurn: 5,
  maxCostUsdPerSession: 1.00,
  costPerThousandTokens: 0.003, // Claude Haiku approximate
};

export class BudgetExceededError extends Error {
  constructor(
    public readonly reason: "session_tokens" | "turn_tokens" | "tool_calls" | "session_cost",
    public readonly limit: number,
    public readonly current: number,
  ) {
    super(`Budget exceeded [${reason}]: limit=${limit}, current=${current}`);
    this.name = "BudgetExceededError";
  }
}

export class TokenBudgetGuard {
  private sessionTokens = 0;
  private turnToolCalls = 0;

  constructor(private readonly config: BudgetConfig = DEFAULT_BUDGET) {}

  get sessionCostUsd(): number {
    return (this.sessionTokens / 1000) * this.config.costPerThousandTokens;
  }

  recordTurnUsage(usage: TokenUsage): void {
    if (usage.total > this.config.maxTokensPerTurn) {
      throw new BudgetExceededError("turn_tokens", this.config.maxTokensPerTurn, usage.total);
    }
    this.sessionTokens += usage.total;

    if (this.sessionTokens > this.config.maxTokensPerSession) {
      throw new BudgetExceededError("session_tokens", this.config.maxTokensPerSession, this.sessionTokens);
    }
    const cost = this.sessionCostUsd;
    if (cost > this.config.maxCostUsdPerSession) {
      throw new BudgetExceededError("session_cost", this.config.maxCostUsdPerSession, cost);
    }
  }

  recordToolCall(): void {
    this.turnToolCalls++;
    if (this.turnToolCalls > this.config.maxToolCallsPerTurn) {
      throw new BudgetExceededError("tool_calls", this.config.maxToolCallsPerTurn, this.turnToolCalls);
    }
  }

  resetTurnCounters(): void {
    this.turnToolCalls = 0;
  }

  get stats() {
    return {
      sessionTokens: this.sessionTokens,
      turnToolCalls: this.turnToolCalls,
      sessionCostUsd: this.sessionCostUsd,
    };
  }
}
