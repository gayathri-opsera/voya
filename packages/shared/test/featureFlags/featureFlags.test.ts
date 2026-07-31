import { describe, it, expect } from "vitest";
import {
  FeatureFlagService,
  InMemoryFlagAuditStore,
  DEFAULT_FLAGS,
} from "../../src/featureFlags.ts";
import type { FlagKey } from "../../src/featureFlags.ts";

describe("FeatureFlagService", () => {
  it("returns default value for flags", async () => {
    const audit = new InMemoryFlagAuditStore();
    const svc = new FeatureFlagService(audit);
    const enabled = await svc.isEnabled("STREAMING_CHAT", { environment: "test" });
    expect(enabled).toBe(DEFAULT_FLAGS["STREAMING_CHAT"].defaultValue);
  });

  it("respects env overrides", async () => {
    const audit = new InMemoryFlagAuditStore();
    const svc = new FeatureFlagService(audit, DEFAULT_FLAGS, { ILLUSTRATIVE_RESULTS: true });
    const enabled = await svc.isEnabled("ILLUSTRATIVE_RESULTS", { environment: "test" });
    expect(enabled).toBe(true);
  });

  it("records every evaluation in the audit store", async () => {
    const audit = new InMemoryFlagAuditStore();
    const svc = new FeatureFlagService(audit);
    await svc.isEnabled("STREAMING_CHAT", { environment: "prod" });
    await svc.isEnabled("ILLUSTRATIVE_RESULTS", { environment: "prod" });
    expect(audit.records).toHaveLength(2);
    expect(audit.records[0].flagKey).toBe("STREAMING_CHAT");
  });

  it("evaluates rollout deterministically per user", async () => {
    const audit = new InMemoryFlagAuditStore();
    const svc = new FeatureFlagService(audit);

    // Run 100 times with same userId — should give same result
    const results = new Set<boolean>();
    for (let i = 0; i < 5; i++) {
      const r = await svc.isEnabled("EXPERIMENTAL_RANKING", { environment: "prod", userId: "stable_user" });
      results.add(r);
    }
    expect(results.size).toBe(1); // Always the same value
  });
});
