/**
 * SearchCache — WO-033: Redis search cache with staleness and single-flight deduplication.
 *
 * Strategy:
 * - Results are cached with configurable TTL.
 * - Stale-while-revalidate: serve stale data immediately, refresh in background.
 * - Single-flight: only one inflight request per cache key (prevents thundering herd).
 */

export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

export interface CacheStore {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
  del(key: string): Promise<void>;
}

/** In-memory cache store for tests. */
export class InMemoryCacheStore implements CacheStore {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    return (this.store.get(key) as CacheEntry<T> | undefined) ?? null;
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    this.store.set(key, entry as CacheEntry<unknown>);
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export class SearchCache<T> {
  private readonly inflight = new Map<string, Promise<T>>();

  constructor(
    private readonly store: CacheStore,
    private readonly ttlMs: number = 60_000,
    private readonly staleWhileRevalidateMs: number = 300_000,
  ) {}

  async get(
    key: string,
    fetcher: () => Promise<T>,
    revalidateInBackground = true,
  ): Promise<T> {
    const entry = await this.store.get<T>(key);
    const now = Date.now();

    if (entry) {
      const age = now - entry.cachedAt;
      if (age < entry.ttlMs) {
        // Fresh — serve directly
        return entry.data;
      }
      if (age < this.staleWhileRevalidateMs) {
        // Stale but within revalidation window — serve stale and refresh in bg
        if (revalidateInBackground) {
          this.refreshInBackground(key, fetcher).catch(() => {});
        }
        return entry.data;
      }
    }

    // Cache miss or expired — single-flight
    return this.fetch(key, fetcher);
  }

  private async fetch(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing;

    const promise = fetcher().then(async (data) => {
      await this.store.set(key, { data, cachedAt: Date.now(), ttlMs: this.ttlMs });
      this.inflight.delete(key);
      return data;
    }).catch((err) => {
      this.inflight.delete(key);
      throw err;
    });

    this.inflight.set(key, promise);
    return promise;
  }

  private async refreshInBackground(key: string, fetcher: () => Promise<T>): Promise<void> {
    const data = await fetcher();
    await this.store.set(key, { data, cachedAt: Date.now(), ttlMs: this.ttlMs });
  }

  async invalidate(key: string): Promise<void> {
    await this.store.del(key);
  }
}
