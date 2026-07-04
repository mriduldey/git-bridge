import type { Metadata } from "../metadata/index.js";
import type { DeepReadonly, JsonValue } from "../types/index.js";

export type CacheNamespace =
  | "repository"
  | "reference"
  | "tree"
  | "blob"
  | "commit"
  | "search"
  | "release"
  | "issue"
  | "pull-request";

export type CacheKey = DeepReadonly<{
  namespace: CacheNamespace;
  parts: readonly string[];
}>;

export type CacheEntry<TValue = JsonValue> = DeepReadonly<{
  key: CacheKey;
  value: TValue;
  createdAt: string;
  expiresAt?: string;
  metadata?: Metadata;
}>;

export type CachePolicy = DeepReadonly<{
  enabled: boolean;
  ttlMs?: number;
  staleWhileRevalidateMs?: number;
}>;

export interface CacheProvider<TValue = JsonValue> {
  get(key: CacheKey): Promise<CacheEntry<TValue> | undefined>;
  set(entry: CacheEntry<TValue>): Promise<void>;
  delete(key: CacheKey): Promise<void>;
  clear(namespace?: CacheNamespace): Promise<void>;
}
