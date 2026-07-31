/**
 * SearchDegradationHandler — WO-038: Harden search for Redis outage.
 *
 * Degrades gracefully when Redis is unavailable:
 * - Falls back to live supplier calls without caching
 * - Emits degradation alarm metrics
 * - Never returns stale data or errors when Redis is down
 */

export interface DegradationAlarmPort {
  emit(metricName: string, value: number): Promise<void>;
}

export class NoopAlarmPort implements DegradationAlarmPort {
  async emit() {}
}

export class SearchDegradationHandler {
  private isDegraded = false;

  constructor(private readonly alarms: DegradationAlarmPort = new NoopAlarmPort()) {}

  markDegraded(): void {
    this.isDegraded = true;
    this.alarms.emit("SearchCacheDegraded", 1).catch(() => {});
  }

  markRecovered(): void {
    this.isDegraded = false;
    this.alarms.emit("SearchCacheDegraded", 0).catch(() => {});
  }

  get degraded(): boolean { return this.isDegraded; }

  /** Wraps a cache operation with Redis outage fallback. */
  async withFallback<T>(cacheOp: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (this.isDegraded) {
      return fallback();
    }
    try {
      return await cacheOp();
    } catch (err) {
      this.markDegraded();
      return fallback();
    }
  }
}
