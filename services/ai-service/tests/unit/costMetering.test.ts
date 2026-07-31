import { describe, it, expect } from "vitest";
import { CostMeteringService, InMemoryCostStore } from "../../src/domain/CostMeteringService.ts";

describe("CostMeteringService", () => {
  it("records usage and returns cost for known model", async () => {
    const store = new InMemoryCostStore();
    const svc = new CostMeteringService(store);
    const result = await svc.recordUsage("s1", "claude-3-haiku-20240307", 1000, 500);
    expect(result.costUsd).toBeCloseTo(0.00025 + 0.000625, 8);
  });

  it("accumulates session cost correctly", async () => {
    const store = new InMemoryCostStore();
    const svc = new CostMeteringService(store);
    await svc.recordUsage("s1", "claude-3-haiku-20240307", 1000, 500);
    await svc.recordUsage("s1", "claude-3-haiku-20240307", 2000, 800);
    const total = await svc.getSessionCost("s1");
    expect(total).toBeGreaterThan(0);
  });

  it("triggers alert when booking cost exceeds threshold", async () => {
    const store = new InMemoryCostStore();
    const svc = new CostMeteringService(store, 0.01); // Low threshold
    const result = await svc.recordUsage("s1", "claude-3-opus-20240229", 5000, 2000, "booking_1");
    expect(result.alertTriggered).toBe(true);
  });

  it("does not alert when below threshold", async () => {
    const store = new InMemoryCostStore();
    const svc = new CostMeteringService(store, 1.0); // High threshold
    const result = await svc.recordUsage("s1", "claude-3-haiku-20240307", 100, 50, "booking_2");
    expect(result.alertTriggered).toBe(false);
  });
});
