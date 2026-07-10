import type {
  CacheEntry,
  CacheKey,
  CacheNamespace,
  CachePolicy,
  CacheProvider
} from "@sourceaxis/contracts/cache";
import type { Metadata } from "@sourceaxis/contracts/metadata";
import type { DeepReadonly, JsonValue } from "@sourceaxis/contracts/types";
import {
  ConfigurationError,
  ConflictError,
  NotFoundError,
  UnexpectedError,
  ValidationError
} from "@sourceaxis/errors";
import { deepFreeze } from "@sourceaxis/shared";

export type {
  CacheEntry,
  CacheKey,
  CacheNamespace,
  CachePolicy,
  CacheProvider
} from "@sourceaxis/contracts/cache";

export type CachePolicyMode = "cache-aside" | "read-through" | "write-through" | "lazy-loading";

export type CacheOptions = Readonly<{
  metadata?: Metadata;
  now?: Date | string;
  policy?: Partial<CachePolicy>;
}>;

export type CacheContext = Readonly<{
  cacheName?: string;
  correlationId?: string;
  metadata?: Metadata;
  policy?: Partial<CachePolicy>;
}>;

export type CacheCapabilities = Readonly<{
  clearByNamespace: boolean;
  expiration: boolean;
  metadata: boolean;
  ttl: boolean;
}>;

export interface CacheAdapter<TValue = JsonValue> extends CacheProvider<TValue> {
  readonly capabilities: CacheCapabilities;
  dispose?(): Promise<void> | void;
}

export interface MemoryCacheAdapter<TValue = JsonValue> extends CacheAdapter<TValue> {
  entries(): readonly CacheEntry<TValue>[];
}

export interface Cache<TValue = JsonValue> {
  readonly name: string;
  readonly namespace: CacheNamespace;
  readonly policy: CachePolicy;
  clear(): Promise<void>;
  delete(key: CacheKey): Promise<void>;
  dispose(): Promise<void>;
  exists(key: CacheKey, context?: CacheContext): Promise<boolean>;
  get(key: CacheKey, context?: CacheContext): Promise<CacheEntry<TValue> | undefined>;
  getOrSet(
    key: CacheKey,
    load: () => Promise<TValue> | TValue,
    context?: CacheContext
  ): Promise<DeepReadonly<TValue>>;
  invalidate(predicate?: CacheInvalidationPredicate<TValue>): Promise<number>;
  set(
    key: CacheKey,
    value: TValue,
    options?: CacheOptions
  ): Promise<CacheEntry<TValue> | undefined>;
}

export interface CacheRegistry {
  clear(): Promise<void>;
  delete(name: string): Promise<boolean>;
  dispose(): Promise<void>;
  get<TValue = JsonValue>(name: string): Cache<TValue> | undefined;
  has(name: string): boolean;
  names(): readonly string[];
  register<TValue = JsonValue>(cache: Cache<TValue>): Cache<TValue>;
  require<TValue = JsonValue>(name: string): Cache<TValue>;
}

export type CacheInvalidationPredicate<TValue = JsonValue> = (
  entry: CacheEntry<TValue>
) => boolean | Promise<boolean>;

export type CacheKeyInput = Readonly<{
  capability?: string;
  operation?: string;
  owner?: string;
  parts?: readonly string[];
  provider?: string;
  reference?: string;
  repository?: string;
}>;

export type CachePolicyEvaluation = Readonly<{
  mode: CachePolicyMode;
  shouldRead: boolean;
  shouldStore: boolean;
  ttlMs?: number;
}>;

export type MemoryCacheAdapterOptions = Readonly<{
  maxEntries?: number;
}>;

export type NamedCacheOptions<TValue = JsonValue> = Readonly<{
  adapter: CacheAdapter<TValue>;
  name: string;
  namespace: CacheNamespace;
  policy?: Partial<CachePolicy>;
}>;

const defaultPolicy: CachePolicy = deepFreeze({
  enabled: true
});

const defaultCapabilities: CacheCapabilities = deepFreeze({
  clearByNamespace: true,
  expiration: true,
  metadata: true,
  ttl: true
});

export function createCacheKey(namespace: CacheNamespace, parts: readonly string[]): CacheKey {
  assertCacheNamespace(namespace);

  if (parts.length === 0) {
    throw new ValidationError("Cache key requires at least one part", {
      diagnostics: { operation: { operation: "cache.key.create" } }
    });
  }

  return deepFreeze({
    namespace,
    parts: parts.map(normalizeKeyPart)
  });
}

export function createCapabilityCacheKey(
  namespace: CacheNamespace,
  input: CacheKeyInput
): CacheKey {
  const parts = [
    input.provider,
    input.owner,
    input.repository,
    input.reference,
    input.capability,
    input.operation,
    ...(input.parts ?? [])
  ].filter((part): part is string => part !== undefined);

  return createCacheKey(namespace, parts);
}

export function serializeCacheKey(key: CacheKey): string {
  assertCacheKey(key);

  return `${key.namespace}:${key.parts.map(encodeKeyPart).join("/")}`;
}

export function createCacheEntry<TValue>(
  key: CacheKey,
  value: TValue,
  options: CacheOptions = {}
): CacheEntry<TValue> {
  const policy = resolveCachePolicy(options.policy);
  const createdAt = normalizeTimestamp(options.now);
  const entry: {
    key: CacheKey;
    value: TValue;
    createdAt: string;
    expiresAt?: string;
    metadata?: Metadata;
  } = {
    createdAt,
    key: deepFreeze(key) as CacheKey,
    value: deepFreeze(value) as TValue
  };

  if (policy.ttlMs !== undefined) {
    entry.expiresAt = new Date(Date.parse(createdAt) + policy.ttlMs).toISOString();
  }

  if (options.metadata !== undefined) {
    entry.metadata = deepFreeze(options.metadata) as Metadata;
  }

  return deepFreeze(entry) as CacheEntry<TValue>;
}

export function isCacheEntryExpired<TValue>(
  entry: CacheEntry<TValue>,
  now: Date | string = new Date()
): boolean {
  if (entry.expiresAt === undefined) {
    return false;
  }

  return Date.parse(entry.expiresAt) <= Date.parse(normalizeTimestamp(now));
}

export function resolveCachePolicy(policy: Partial<CachePolicy> = {}): CachePolicy {
  if (policy.ttlMs !== undefined && policy.ttlMs < 0) {
    throw new ValidationError("Cache TTL must be greater than or equal to zero", {
      diagnostics: { operation: { operation: "cache.policy.resolve" } }
    });
  }

  if (policy.staleWhileRevalidateMs !== undefined && policy.staleWhileRevalidateMs < 0) {
    throw new ValidationError(
      "Cache stale-while-revalidate duration must be greater than or equal to zero",
      {
        diagnostics: { operation: { operation: "cache.policy.resolve" } }
      }
    );
  }

  const resolved: {
    enabled: boolean;
    staleWhileRevalidateMs?: number;
    ttlMs?: number;
  } = {
    enabled: policy.enabled ?? defaultPolicy.enabled
  };

  if (policy.ttlMs !== undefined) {
    resolved.ttlMs = policy.ttlMs;
  }

  if (policy.staleWhileRevalidateMs !== undefined) {
    resolved.staleWhileRevalidateMs = policy.staleWhileRevalidateMs;
  }

  return deepFreeze(resolved);
}

export function evaluateCachePolicy(
  policy: Partial<CachePolicy> = {},
  mode: CachePolicyMode = "cache-aside"
): CachePolicyEvaluation {
  const resolved = resolveCachePolicy(policy);

  const evaluation: {
    mode: CachePolicyMode;
    shouldRead: boolean;
    shouldStore: boolean;
    ttlMs?: number;
  } = {
    mode,
    shouldRead: resolved.enabled,
    shouldStore: resolved.enabled
  };

  if (resolved.ttlMs !== undefined) {
    evaluation.ttlMs = resolved.ttlMs;
  }

  return deepFreeze(evaluation);
}

export function createMemoryCacheAdapter<TValue = JsonValue>(
  options: MemoryCacheAdapterOptions = {}
): MemoryCacheAdapter<TValue> {
  if (
    options.maxEntries !== undefined &&
    (!Number.isInteger(options.maxEntries) || options.maxEntries < 1)
  ) {
    throw new ValidationError("Memory cache maxEntries must be a positive integer", {
      diagnostics: { operation: { operation: "cache.memory.create" } }
    });
  }

  const entries = new Map<string, CacheEntry<TValue>>();

  const adapter: MemoryCacheAdapter<TValue> = {
    capabilities: defaultCapabilities,
    async clear(namespace?: CacheNamespace) {
      if (namespace === undefined) {
        entries.clear();
        return;
      }

      assertCacheNamespace(namespace);

      for (const [serialized, entry] of entries) {
        if (entry.key.namespace === namespace) {
          entries.delete(serialized);
        }
      }
    },
    async delete(key: CacheKey) {
      entries.delete(serializeCacheKey(key));
    },
    async dispose() {
      entries.clear();
    },
    entries() {
      return deepFreeze([...entries.values()]) as readonly CacheEntry<TValue>[];
    },
    async get(key: CacheKey) {
      const serialized = serializeCacheKey(key);
      const entry = entries.get(serialized);

      if (entry === undefined) {
        return undefined;
      }

      if (isCacheEntryExpired(entry)) {
        entries.delete(serialized);
        return undefined;
      }

      return entry;
    },
    async set(entry: CacheEntry<TValue>) {
      const serialized = serializeCacheKey(entry.key);

      if (
        options.maxEntries !== undefined &&
        !entries.has(serialized) &&
        entries.size >= options.maxEntries
      ) {
        const oldestKey = entries.keys().next().value;

        if (oldestKey !== undefined) {
          entries.delete(oldestKey);
        }
      }

      entries.set(serialized, deepFreeze(entry) as CacheEntry<TValue>);
    }
  };

  return deepFreeze(adapter) as MemoryCacheAdapter<TValue>;
}

export function createCache<TValue = JsonValue>(options: NamedCacheOptions<TValue>): Cache<TValue> {
  assertCacheName(options.name);
  assertCacheNamespace(options.namespace);

  const policy = resolveCachePolicy(options.policy);
  const inFlight = new Map<string, Promise<DeepReadonly<TValue>>>();
  let disposed = false;

  const cache: Cache<TValue> = {
    name: options.name,
    namespace: options.namespace,
    policy,
    async clear() {
      ensureActive(disposed, options.name);
      await runCacheOperation(options.name, "clear", () =>
        options.adapter.clear(options.namespace)
      );
    },
    async delete(key: CacheKey) {
      ensureActive(disposed, options.name);
      assertKeyNamespace(key, options.namespace);
      await runCacheOperation(options.name, "delete", () => options.adapter.delete(key));
    },
    async dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      inFlight.clear();
      await runCacheOperation(options.name, "dispose", () => options.adapter.dispose?.());
    },
    async exists(key: CacheKey, context?: CacheContext) {
      ensureActive(disposed, options.name);
      return (await cache.get(key, context)) !== undefined;
    },
    async get(key: CacheKey, context?: CacheContext) {
      ensureActive(disposed, options.name);
      assertKeyNamespace(key, options.namespace);

      const evaluation = evaluateCachePolicy({ ...policy, ...context?.policy });

      if (!evaluation.shouldRead) {
        return undefined;
      }

      return runCacheOperation(options.name, "get", () => options.adapter.get(key));
    },
    async getOrSet(key: CacheKey, load: () => Promise<TValue> | TValue, context?: CacheContext) {
      ensureActive(disposed, options.name);
      assertKeyNamespace(key, options.namespace);

      const existing = await cache.get(key, context);

      if (existing !== undefined) {
        return existing.value;
      }

      const serialized = serializeCacheKey(key);
      const existingLoad = inFlight.get(serialized);

      if (existingLoad !== undefined) {
        return existingLoad;
      }

      const loadPromise = Promise.resolve()
        .then(load)
        .then(async (value) => {
          const setOptions: {
            metadata?: Metadata;
            policy?: Partial<CachePolicy>;
          } = {};

          if (context?.metadata !== undefined) {
            setOptions.metadata = context.metadata;
          }

          if (context?.policy !== undefined) {
            setOptions.policy = context.policy;
          }

          const entry = await cache.set(key, value, setOptions);
          return entry?.value ?? (deepFreeze(value) as DeepReadonly<TValue>);
        })
        .finally(() => {
          inFlight.delete(serialized);
        });

      inFlight.set(serialized, loadPromise);
      return loadPromise;
    },
    async invalidate(predicate?: CacheInvalidationPredicate<TValue>) {
      ensureActive(disposed, options.name);

      if (predicate === undefined) {
        await cache.clear();
        return 0;
      }

      const memoryEntries = getMemoryEntries(options.adapter);

      if (memoryEntries === undefined) {
        throw new ConfigurationError("Cache adapter does not support predicate invalidation", {
          diagnostics: { operation: { operation: "cache.invalidate" } }
        });
      }

      let removed = 0;

      for (const entry of memoryEntries) {
        if (entry.key.namespace === options.namespace && (await predicate(entry))) {
          await options.adapter.delete(entry.key);
          removed += 1;
        }
      }

      return removed;
    },
    async set(key: CacheKey, value: TValue, setOptions: CacheOptions = {}) {
      ensureActive(disposed, options.name);
      assertKeyNamespace(key, options.namespace);

      const evaluation = evaluateCachePolicy({ ...policy, ...setOptions.policy });

      if (!evaluation.shouldStore) {
        return undefined;
      }

      const entry = createCacheEntry(key, value, {
        ...setOptions,
        policy: { ...policy, ...setOptions.policy }
      });

      await runCacheOperation(options.name, "set", () => options.adapter.set(entry));
      return entry;
    }
  };

  return deepFreeze(cache) as Cache<TValue>;
}

export function createCacheRegistry(): CacheRegistry {
  const caches = new Map<string, Cache<unknown>>();

  const registry: CacheRegistry = {
    async clear() {
      await Promise.all([...caches.values()].map((cache) => cache.clear()));
    },
    async delete(name: string) {
      assertCacheName(name);
      const cache = caches.get(name);

      if (cache === undefined) {
        return false;
      }

      caches.delete(name);
      await cache.dispose();
      return true;
    },
    async dispose() {
      await Promise.all([...caches.values()].map((cache) => cache.dispose()));
      caches.clear();
    },
    get<TValue = JsonValue>(name: string) {
      assertCacheName(name);
      return caches.get(name) as Cache<TValue> | undefined;
    },
    has(name: string) {
      assertCacheName(name);
      return caches.has(name);
    },
    names() {
      return deepFreeze([...caches.keys()].sort());
    },
    register<TValue = JsonValue>(cache: Cache<TValue>) {
      assertCacheName(cache.name);

      if (caches.has(cache.name)) {
        throw new ConflictError("Cache is already registered", {
          diagnostics: {
            operation: { operation: "cache.registry.register" },
            extra: { cacheName: cache.name }
          }
        });
      }

      caches.set(cache.name, cache as Cache<unknown>);
      return cache;
    },
    require<TValue = JsonValue>(name: string) {
      const cache = registry.get<TValue>(name);

      if (cache === undefined) {
        throw new NotFoundError("Cache is not registered", {
          diagnostics: {
            operation: { operation: "cache.registry.require" },
            extra: { cacheName: name }
          }
        });
      }

      return cache;
    }
  };

  return deepFreeze(registry) as CacheRegistry;
}

function assertCacheName(name: string): void {
  if (name.trim() === "") {
    throw new ValidationError("Cache name must be a non-empty string", {
      diagnostics: { operation: { operation: "cache.validate" } }
    });
  }
}

function assertCacheKey(key: CacheKey): void {
  assertCacheNamespace(key.namespace);

  if (key.parts.length === 0) {
    throw new ValidationError("Cache key requires at least one part", {
      diagnostics: { operation: { operation: "cache.key.validate" } }
    });
  }

  for (const part of key.parts) {
    normalizeKeyPart(part);
  }
}

function assertCacheNamespace(namespace: CacheNamespace): void {
  const namespaces: readonly CacheNamespace[] = [
    "blob",
    "commit",
    "issue",
    "pull-request",
    "reference",
    "release",
    "repository",
    "search",
    "tree"
  ];

  if (!namespaces.includes(namespace)) {
    throw new ValidationError("Cache namespace is not supported", {
      diagnostics: {
        operation: { operation: "cache.namespace.validate" },
        extra: { namespace }
      }
    });
  }
}

function assertKeyNamespace(key: CacheKey, namespace: CacheNamespace): void {
  assertCacheKey(key);

  if (key.namespace !== namespace) {
    throw new ValidationError("Cache key namespace does not match cache namespace", {
      diagnostics: {
        operation: { operation: "cache.key.validate" },
        extra: { actual: key.namespace, expected: namespace }
      }
    });
  }
}

function encodeKeyPart(part: string): string {
  return encodeURIComponent(part);
}

function ensureActive(disposed: boolean, name: string): void {
  if (disposed) {
    throw new ConfigurationError("Cache has been disposed", {
      diagnostics: {
        operation: { operation: "cache.lifecycle" },
        extra: { cacheName: name }
      }
    });
  }
}

function getMemoryEntries<TValue>(
  adapter: CacheAdapter<TValue>
): readonly CacheEntry<TValue>[] | undefined {
  if (isMemoryCacheAdapter(adapter)) {
    return adapter.entries();
  }

  return undefined;
}

function isMemoryCacheAdapter<TValue>(
  adapter: CacheAdapter<TValue>
): adapter is MemoryCacheAdapter<TValue> {
  return "entries" in adapter && typeof adapter.entries === "function";
}

function normalizeKeyPart(part: string): string {
  const normalized = part.trim();

  if (normalized === "") {
    throw new ValidationError("Cache key parts must be non-empty strings", {
      diagnostics: { operation: { operation: "cache.key.normalize" } }
    });
  }

  return normalized;
}

function normalizeTimestamp(timestamp: Date | string | undefined): string {
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  if (timestamp !== undefined) {
    const parsed = Date.parse(timestamp);

    if (Number.isNaN(parsed)) {
      throw new ValidationError("Cache timestamp must be a valid ISO-8601 value", {
        diagnostics: { operation: { operation: "cache.timestamp.normalize" } }
      });
    }

    return new Date(parsed).toISOString();
  }

  return new Date().toISOString();
}

async function runCacheOperation<T>(
  cacheName: string,
  operation: string,
  execute: () => Promise<T> | T
): Promise<T> {
  try {
    return await execute();
  } catch (error: unknown) {
    if (
      error instanceof ValidationError ||
      error instanceof ConfigurationError ||
      error instanceof ConflictError
    ) {
      throw error;
    }

    if (error instanceof NotFoundError || error instanceof UnexpectedError) {
      throw error;
    }

    throw new UnexpectedError("Cache operation failed", {
      cause: error,
      diagnostics: {
        operation: { operation: `cache.${operation}` },
        extra: { cacheName }
      }
    });
  }
}
