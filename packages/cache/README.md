# @gitbridge/cache

Cache primitives for GitBridge.

## Responsibilities

- Create namespaced cache keys and capability cache keys.
- Resolve and evaluate cache policies.
- Create immutable cache entries with optional expiration.
- Provide a memory cache adapter, named cache wrapper, and cache registry.

## Install

```sh
pnpm add @gitbridge/cache
```

## Usage

```ts
import { createCache, createCacheKey, createMemoryCacheAdapter } from "@gitbridge/cache";

const cache = createCache({
  adapter: createMemoryCacheAdapter(),
  name: "repository-cache",
  namespace: "repository",
  policy: { ttlMs: 60_000 }
});

const key = createCacheKey("repository", ["github", "octokit", "rest.js"]);
await cache.set(key, { fullName: "octokit/rest.js" });
```

Core creates a default cache registry when none is supplied. Provider-specific caching must remain
configuration-driven.
