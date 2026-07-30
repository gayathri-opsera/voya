import { describe, it, expect } from "vitest";
import { buildHealthRouter, type DependencyCheck } from "../../src/health.ts";

function makeRes() {
  let capturedStatus = 0;
  let capturedBody: unknown;
  const res = {
    status(code: number) {
      capturedStatus = code;
      return {
        json(body: unknown) { capturedBody = body; },
      };
    },
    get statusCode() { return capturedStatus; },
    get body() { return capturedBody; },
  };
  return res;
}

describe("buildHealthRouter — liveness", () => {
  it("returns 200 with status=healthy", () => {
    const { livenessHandler } = buildHealthRouter("1.0.0", new Date(), []);
    const res = makeRes();
    livenessHandler({}, res);
    expect(res.statusCode).toBe(200);
    expect((res.body as Record<string, unknown>).status).toBe("healthy");
  });
});

describe("buildHealthRouter — readiness", () => {
  it("returns 200 when all checks pass", async () => {
    const checks: DependencyCheck[] = [
      { name: "db", critical: true, check: async () => ({ healthy: true }) },
      { name: "cache", critical: false, check: async () => ({ healthy: true }) },
    ];
    const { readinessHandler } = buildHealthRouter("1.0.0", new Date(), checks);
    const res = makeRes();
    await readinessHandler({}, res);
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.status).toBe("healthy");
  });

  it("returns 503 when critical dependency fails", async () => {
    const checks: DependencyCheck[] = [
      { name: "db", critical: true, check: async () => ({ healthy: false, detail: "connection refused" }) },
    ];
    const { readinessHandler } = buildHealthRouter("1.0.0", new Date(), checks);
    const res = makeRes();
    await readinessHandler({}, res);
    expect(res.statusCode).toBe(503);
    const body = res.body as Record<string, unknown>;
    expect(body.status).toBe("unhealthy");
  });

  it("returns 200 with degraded when non-critical fails", async () => {
    const checks: DependencyCheck[] = [
      { name: "db", critical: true, check: async () => ({ healthy: true }) },
      { name: "cache", critical: false, check: async () => ({ healthy: false }) },
    ];
    const { readinessHandler } = buildHealthRouter("1.0.0", new Date(), checks);
    const res = makeRes();
    await readinessHandler({}, res);
    expect(res.statusCode).toBe(200); // non-critical failure → 200
    expect((res.body as Record<string, unknown>).status).toBe("degraded");
  });

  it("includes latencyMs per dependency", async () => {
    const checks: DependencyCheck[] = [
      { name: "db", critical: true, check: async () => ({ healthy: true, latencyMs: 5 }) },
    ];
    const { readinessHandler } = buildHealthRouter("1.0.0", new Date(), checks);
    const res = makeRes();
    await readinessHandler({}, res);
    const body = res.body as Record<string, Record<string, unknown>>;
    expect(body.dependencies!.db!.latencyMs).toBe(5);
  });

  it("handles check throwing an exception", async () => {
    const checks: DependencyCheck[] = [
      { name: "db", critical: true, check: async () => { throw new Error("timeout"); } },
    ];
    const { readinessHandler } = buildHealthRouter("1.0.0", new Date(), checks);
    const res = makeRes();
    await readinessHandler({}, res);
    expect(res.statusCode).toBe(503);
  });
});
