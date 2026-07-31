import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchCache, InMemoryCacheStore } from "../../src/cache/SearchCache.ts";

describe("SearchCache", () => {
  let store: InMemoryCacheStore;
  let cache: SearchCache<string[]>;

  beforeEach(() => {
    store = new InMemoryCacheStore();
    cache = new SearchCache<string[]>(store, 5_000, 30_000);
  });

  it("returns fresh data from cache on second call", async () => {
    const fetcher = vi.fn().mockResolvedValue(["offer1", "offer2"]);
    const r1 = await cache.get("key1", fetcher);
    const r2 = await cache.get("key1", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(["offer1", "offer2"]);
    expect(r2).toEqual(r1);
  });

  it("calls fetcher on cache miss", async () => {
    const fetcher = vi.fn().mockResolvedValue(["offer1"]);
    const result = await cache.get("newKey", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual(["offer1"]);
  });

  it("deduplicates concurrent requests (single-flight)", async () => {
    let callCount = 0;
    const fetcher = vi.fn().mockImplementation(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 50));
      return ["data"];
    });

    const [r1, r2, r3] = await Promise.all([
      cache.get("dup", fetcher),
      cache.get("dup", fetcher),
      cache.get("dup", fetcher),
    ]);

    expect(callCount).toBe(1);
    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
  });

  it("invalidate removes the key", async () => {
    const fetcher = vi.fn().mockResolvedValue(["old"]);
    await cache.get("inv", fetcher);
    await cache.invalidate("inv");
    await cache.get("inv", vi.fn().mockResolvedValue(["new"]));
    // Second fetcher should be called since key was invalidated
    const entry = await store.get("inv");
    expect((entry?.data as string[])[0]).toBe("new");
  });
});
