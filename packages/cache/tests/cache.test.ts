import {
  ConfigurationError,
  ConflictError,
  NotFoundError,
  UnexpectedError,
  ValidationError
} from "@sourceaxis/errors";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  createCache,
  createCacheEntry,
  createCacheKey,
  createCacheRegistry,
  createCapabilityCacheKey,
  createMemoryCacheAdapter,
  evaluateCachePolicy,
  isCacheEntryExpired,
  resolveCachePolicy,
  serializeCacheKey,
  type Cache,
  type CacheAdapter,
  type CacheEntry,
  type CacheKey,
  type CachePolicy
} from "../src/index.js";

const treeKey = createCacheKey("tree", ["owner", "repo", "main"]);

describe("cache keys", () => {
  it("creates deterministic canonical cache keys", () => {
    const key = createCapabilityCacheKey("blob", {
      capability: "contents",
      operation: "read",
      owner: "owner",
      parts: ["README.md"],
      provider: "github",
      reference: "main",
      repository: "repo"
    });

    expect(key).toEqual({
      namespace: "blob",
      parts: ["github", "owner", "repo", "main", "contents", "read", "README.md"]
    });
    expect(serializeCacheKey(key)).toBe("blob:github/owner/repo/main/contents/read/README.md");
    expect(Object.isFrozen(key)).toBe(true);
    expect(Object.isFrozen(key.parts)).toBe(true);
  });

  it("rejects invalid key input through approved validation errors", () => {
    expect(() => createCacheKey("tree", [])).toThrow(ValidationError);
    expect(() => createCacheKey("tree", [" "])).toThrow(ValidationError);
  });
});

describe("cache policy", () => {
  it("resolves default cache-aside policy", () => {
    expect(resolveCachePolicy()).toEqual({ enabled: true });
    expect(evaluateCachePolicy({ ttlMs: 10 })).toEqual({
      mode: "cache-aside",
      shouldRead: true,
      shouldStore: true,
      ttlMs: 10
    });
  });

  it("disables reads and stores when policy is disabled", () => {
    expect(evaluateCachePolicy({ enabled: false })).toEqual({
      mode: "cache-aside",
      shouldRead: false,
      shouldStore: false
    });
  });

  it("rejects invalid TTL values", () => {
    expect(() => resolveCachePolicy({ ttlMs: -1 })).toThrow(ValidationError);
  });
});

describe("cache entries and memory adapter", () => {
  it("stores immutable entries with TTL and metadata", async () => {
    const adapter = createMemoryCacheAdapter<{ readonly name: string }>();
    const entry = createCacheEntry(
      treeKey,
      { name: "repo" },
      {
        metadata: { etag: "abc" },
        now: "2099-07-04T00:00:00.000Z",
        policy: { ttlMs: 1000 }
      }
    );

    await adapter.set(entry);

    expect(await adapter.get(treeKey)).toEqual({
      createdAt: "2099-07-04T00:00:00.000Z",
      expiresAt: "2099-07-04T00:00:01.000Z",
      key: treeKey,
      metadata: { etag: "abc" },
      value: { name: "repo" }
    });
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.value)).toBe(true);
  });

  it("treats expired entries as misses and removes them", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T00:00:00.000Z"));

    try {
      const adapter = createMemoryCacheAdapter<string>();
      await adapter.set(createCacheEntry(treeKey, "value", { policy: { ttlMs: 5 } }));

      vi.setSystemTime(new Date("2026-07-04T00:00:00.006Z"));

      expect(await adapter.get(treeKey)).toBeUndefined();
      expect(adapter.entries()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("supports delete, namespace clear, full clear, and max-entry eviction", async () => {
    const adapter = createMemoryCacheAdapter<string>({ maxEntries: 2 });
    const first = createCacheKey("tree", ["one"]);
    const second = createCacheKey("blob", ["two"]);
    const third = createCacheKey("tree", ["three"]);

    await adapter.set(createCacheEntry(first, "1"));
    await adapter.set(createCacheEntry(second, "2"));
    await adapter.set(createCacheEntry(third, "3"));

    expect(await adapter.get(first)).toBeUndefined();
    expect(await adapter.get(second)).toBeDefined();
    await adapter.clear("tree");
    expect(await adapter.get(third)).toBeUndefined();
    expect(await adapter.get(second)).toBeDefined();
    await adapter.delete(second);
    expect(await adapter.get(second)).toBeUndefined();
  });
});

describe("named cache", () => {
  it("returns cache misses and cache hits", async () => {
    const cache = createCache<string>({
      adapter: createMemoryCacheAdapter(),
      name: "tree",
      namespace: "tree"
    });

    expect(await cache.get(treeKey)).toBeUndefined();
    await cache.set(treeKey, "tree-value");

    expect((await cache.get(treeKey))?.value).toBe("tree-value");
    expect(await cache.exists(treeKey)).toBe(true);
  });

  it("honors disabled cache policy", async () => {
    const cache = createCache<string>({
      adapter: createMemoryCacheAdapter(),
      name: "tree",
      namespace: "tree",
      policy: { enabled: false }
    });

    expect(await cache.set(treeKey, "value")).toBeUndefined();
    expect(await cache.get(treeKey)).toBeUndefined();
  });

  it("implements cache-aside getOrSet with single-flight loading", async () => {
    const cache = createCache<string>({
      adapter: createMemoryCacheAdapter(),
      name: "tree",
      namespace: "tree"
    });
    const load = vi.fn(async () => "loaded");

    await expect(
      Promise.all([cache.getOrSet(treeKey, load), cache.getOrSet(treeKey, load)])
    ).resolves.toEqual(["loaded", "loaded"]);

    expect(load).toHaveBeenCalledTimes(1);
    await expect(cache.getOrSet(treeKey, async () => "new")).resolves.toBe("loaded");
  });

  it("invalidates matching entries without understanding cache semantics", async () => {
    const cache = createCache<string>({
      adapter: createMemoryCacheAdapter(),
      name: "tree",
      namespace: "tree"
    });
    const one = createCacheKey("tree", ["one"]);
    const two = createCacheKey("tree", ["two"]);

    await cache.set(one, "keep");
    await cache.set(two, "remove");

    await expect(cache.invalidate((entry) => entry.value === "remove")).resolves.toBe(1);
    expect(await cache.exists(one)).toBe(true);
    expect(await cache.exists(two)).toBe(false);
  });

  it("maps adapter failures to approved errors while preserving causes", async () => {
    const cause = new Error("storage failed");
    const adapter: CacheAdapter<string> = {
      capabilities: {
        clearByNamespace: true,
        expiration: true,
        metadata: true,
        ttl: true
      },
      async clear() {
        return undefined;
      },
      async delete() {
        return undefined;
      },
      async get() {
        throw cause;
      },
      async set() {
        return undefined;
      }
    };
    const cache = createCache({ adapter, name: "tree", namespace: "tree" });

    await expect(cache.get(treeKey)).rejects.toMatchObject({
      cause,
      name: "UnexpectedError"
    });
  });

  it("rejects namespace mismatches and disposed cache usage", async () => {
    const cache = createCache<string>({
      adapter: createMemoryCacheAdapter(),
      name: "tree",
      namespace: "tree"
    });

    await expect(cache.get(createCacheKey("blob", ["one"]))).rejects.toBeInstanceOf(
      ValidationError
    );
    await cache.dispose();
    await expect(cache.get(treeKey)).rejects.toBeInstanceOf(ConfigurationError);
  });
});

describe("cache registry", () => {
  it("registers, discovers, requires, clears, deletes, and disposes named caches", async () => {
    const registry = createCacheRegistry();
    const cache = createCache<string>({
      adapter: createMemoryCacheAdapter(),
      name: "tree",
      namespace: "tree"
    });

    expect(registry.register(cache)).toBe(cache);
    expect(registry.names()).toEqual(["tree"]);
    expect(registry.has("tree")).toBe(true);
    expect(registry.get<string>("tree")).toBe(cache);
    expect(registry.require<string>("tree")).toBe(cache);

    await cache.set(treeKey, "value");
    await registry.clear();
    expect(await cache.exists(treeKey)).toBe(false);

    await expect(registry.delete("tree")).resolves.toBe(true);
    expect(registry.has("tree")).toBe(false);
    await expect(registry.delete("missing")).resolves.toBe(false);
    expect(() => registry.require("missing")).toThrow(NotFoundError);
  });

  it("rejects duplicate registration", () => {
    const registry = createCacheRegistry();
    const cache = createCache({
      adapter: createMemoryCacheAdapter(),
      name: "tree",
      namespace: "tree"
    });

    registry.register(cache);

    expect(() => registry.register(cache)).toThrow(ConflictError);
  });
});

describe("public exports", () => {
  it("exports stable public types", () => {
    expectTypeOf<Cache<string>>().toHaveProperty("getOrSet");
    expectTypeOf<CacheEntry<string>>().toMatchTypeOf<{
      readonly key: CacheKey;
      readonly value: string;
    }>();
    expectTypeOf<CachePolicy>().toMatchTypeOf<{ readonly enabled: boolean }>();
    expectTypeOf<UnexpectedError>().toBeObject();
  });

  it("evaluates explicit expiration checks", () => {
    const entry = createCacheEntry(treeKey, "value", {
      now: "2026-07-04T00:00:00.000Z",
      policy: { ttlMs: 1 }
    });

    expect(isCacheEntryExpired(entry, "2026-07-04T00:00:00.000Z")).toBe(false);
    expect(isCacheEntryExpired(entry, "2026-07-04T00:00:00.001Z")).toBe(true);
  });
});
