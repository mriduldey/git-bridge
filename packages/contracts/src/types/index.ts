/**
 * A value that may be undefined.
 */
export type Maybe<T> = T | undefined;

/**
 * A readonly array with at least one item.
 */
export type NonEmptyArray<T> = readonly [T, ...T[]];

/**
 * Recursively makes every property optional.
 */
export type DeepPartial<T> = T extends JsonPrimitive | Uint8Array | ((...args: never[]) => unknown)
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepPartial<Item>[]
    : { readonly [Key in keyof T]?: DeepPartial<T[Key]> };

/**
 * Recursively makes every property readonly.
 */
export type DeepReadonly<T> = T extends JsonPrimitive | Uint8Array | ((...args: never[]) => unknown)
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : { readonly [Key in keyof T]: DeepReadonly<T[Key]> };

/**
 * Provider-neutral JSON primitives accepted by public serialized models.
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Provider-neutral JSON value accepted by metadata and serialized models.
 */
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/**
 * Domain result wrapper for capability internals and future extension contracts.
 */
export type CapabilityResult<TValue, TMetadata extends object = EmptyMetadata> = DeepReadonly<{
  value: TValue;
  metadata?: TMetadata;
}>;

/**
 * Immutable record with string keys.
 */
export type ImmutableRecord<TValue> = Readonly<Record<string, TValue>>;

/**
 * Empty immutable metadata marker.
 */
export type EmptyMetadata = Readonly<Record<string, never>>;

/**
 * Common operation options accepted by long-running public operations.
 */
export type OperationOptions = DeepReadonly<{
  signal?: AbortSignal;
  timeoutMs?: number;
  correlationId?: string;
}>;

/**
 * Additional operation options that may carry provider-neutral metadata.
 */
export type MetadataOptions<TMetadata extends object = EmptyMetadata> = OperationOptions &
  DeepReadonly<{
    metadata?: TMetadata;
  }>;

/**
 * Provider-neutral sort direction.
 */
export type SortDirection = "asc" | "desc";
