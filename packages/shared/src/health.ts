/**
 * Health check utilities — dependency-aware deep health and readiness endpoints.
 *
 * Two endpoints:
 *   GET /health  — liveness probe: is the process alive?
 *   GET /ready   — readiness probe: are all required dependencies reachable?
 *
 * Readiness checks run in parallel. A single critical dependency failing
 * causes 503. Non-critical dependencies contribute to the response body
 * but do not change the status code.
 */

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface DependencyCheck {
  name: string;
  critical: boolean;
  check(): Promise<{ healthy: boolean; latencyMs?: number; detail?: string }>;
}

export interface HealthReport {
  status: HealthStatus;
  version: string;
  uptime: number;
  timestamp: string;
  dependencies: Record<string, {
    status: HealthStatus;
    latencyMs?: number;
    detail?: string;
    critical: boolean;
  }>;
}

export function buildHealthRouter(
  version: string,
  startTime: Date,
  dependencies: DependencyCheck[],
) {
  async function getReadiness(): Promise<{ httpStatus: 200 | 503; report: HealthReport }> {
    const now = Date.now();
    const results = await Promise.allSettled(
      dependencies.map(async (dep) => {
        const start = Date.now();
        try {
          const result = await dep.check();
          return {
            name: dep.name,
            critical: dep.critical,
            healthy: result.healthy,
            latencyMs: result.latencyMs ?? (Date.now() - start),
            detail: result.detail,
          };
        } catch (err) {
          return {
            name: dep.name,
            critical: dep.critical,
            healthy: false,
            latencyMs: Date.now() - start,
            detail: err instanceof Error ? err.message : "check failed",
          };
        }
      }),
    );

    const depReport: HealthReport["dependencies"] = {};
    let hasCriticalFailure = false;
    let hasDegradation = false;

    for (const result of results) {
      if (result.status === "rejected") continue; // shouldn't happen but guard anyway
      const { name, critical, healthy, latencyMs, detail } = result.value;
      const status: HealthStatus = healthy ? "healthy" : critical ? "unhealthy" : "degraded";
      depReport[name] = { status, latencyMs, detail, critical };
      if (!healthy && critical) hasCriticalFailure = true;
      if (!healthy && !critical) hasDegradation = true;
    }

    const overallStatus: HealthStatus = hasCriticalFailure
      ? "unhealthy"
      : hasDegradation
        ? "degraded"
        : "healthy";

    return {
      httpStatus: hasCriticalFailure ? 503 : 200,
      report: {
        status: overallStatus,
        version,
        uptime: Math.floor((now - startTime.getTime()) / 1000),
        timestamp: new Date(now).toISOString(),
        dependencies: depReport,
      },
    };
  }

  return {
    /** Express-compatible handler for GET /health (liveness) */
    livenessHandler(_req: unknown, res: { status(c: number): { json(b: unknown): void } }): void {
      res.status(200).json({
        status: "healthy",
        version,
        uptime: Math.floor((Date.now() - startTime.getTime()) / 1000),
        timestamp: new Date().toISOString(),
      });
    },

    /** Express-compatible handler for GET /ready (readiness) */
    async readinessHandler(
      _req: unknown,
      res: { status(c: number): { json(b: unknown): void } },
    ): Promise<void> {
      const { httpStatus, report } = await getReadiness();
      res.status(httpStatus).json(report);
    },
  };
}

/** Standard DB ping check factory. */
export function makeDbCheck(pingFn: () => Promise<void>): DependencyCheck {
  return {
    name: "database",
    critical: true,
    async check() {
      await pingFn();
      return { healthy: true };
    },
  };
}

/** Standard Redis/cache ping check factory. */
export function makeCacheCheck(pingFn: () => Promise<void>): DependencyCheck {
  return {
    name: "cache",
    critical: false, // cache is typically non-critical for write paths
    async check() {
      await pingFn();
      return { healthy: true };
    },
  };
}

/** Standard queue ping check factory. */
export function makeQueueCheck(pingFn: () => Promise<void>): DependencyCheck {
  return {
    name: "queue",
    critical: false,
    async check() {
      await pingFn();
      return { healthy: true };
    },
  };
}
