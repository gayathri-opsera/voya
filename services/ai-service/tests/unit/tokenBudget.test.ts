import { describe, it, expect } from "vitest";
import { TokenBudgetGuard, BudgetExceededError } from "../../src/tools/TokenBudgetGuard.ts";

describe("TokenBudgetGuard", () => {
  it("tracks token usage without error under limits", () => {
    const guard = new TokenBudgetGuard({ maxTokensPerSession: 10_000, maxTokensPerTurn: 2_000, maxToolCallsPerTurn: 5, maxCostUsdPerSession: 1.0, costPerThousandTokens: 0.003 });
    guard.recordTurnUsage({ prompt: 100, completion: 200, total: 300 });
    expect(guard.stats.sessionTokens).toBe(300);
  });

  it("throws when turn tokens exceed limit", () => {
    const guard = new TokenBudgetGuard({ maxTokensPerSession: 100_000, maxTokensPerTurn: 500, maxToolCallsPerTurn: 5, maxCostUsdPerSession: 10, costPerThousandTokens: 0.003 });
    expect(() => guard.recordTurnUsage({ prompt: 300, completion: 300, total: 600 })).toThrow(BudgetExceededError);
  });

  it("throws when session tokens exceed limit", () => {
    // maxTokensPerTurn=900 so individual turns pass, but session cap is 1000
    const guard = new TokenBudgetGuard({ maxTokensPerSession: 1_000, maxTokensPerTurn: 900, maxToolCallsPerTurn: 5, maxCostUsdPerSession: 10, costPerThousandTokens: 0.003 });
    guard.recordTurnUsage({ prompt: 400, completion: 400, total: 800 });
    expect(() => guard.recordTurnUsage({ prompt: 200, completion: 200, total: 400 })).toThrow(BudgetExceededError);
  });

  it("throws when tool calls exceed per-turn limit", () => {
    const guard = new TokenBudgetGuard({ maxTokensPerSession: 100_000, maxTokensPerTurn: 8_000, maxToolCallsPerTurn: 2, maxCostUsdPerSession: 10, costPerThousandTokens: 0.003 });
    guard.recordToolCall();
    guard.recordToolCall();
    expect(() => guard.recordToolCall()).toThrow(BudgetExceededError);
  });

  it("resetTurnCounters resets tool call count", () => {
    const guard = new TokenBudgetGuard({ maxTokensPerSession: 100_000, maxTokensPerTurn: 8_000, maxToolCallsPerTurn: 2, maxCostUsdPerSession: 10, costPerThousandTokens: 0.003 });
    guard.recordToolCall();
    guard.recordToolCall();
    guard.resetTurnCounters();
    expect(() => guard.recordToolCall()).not.toThrow();
  });
});
