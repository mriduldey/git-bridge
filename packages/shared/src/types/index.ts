declare const brandSymbol: unique symbol;

/**
 * A value that may be returned directly or through a Promise.
 */
export type Awaitable<T> = T | Promise<T>;

/**
 * Creates a nominally distinct type from a structural TypeScript type.
 */
export type Brand<T, Name extends string> = T & {
  readonly [brandSymbol]: Name;
};

/**
 * Recursively makes every property optional.
 */
export type DeepPartial<T> = T extends Primitive | ((...args: never[]) => unknown)
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepPartial<Item>[]
    : { readonly [Key in keyof T]?: DeepPartial<T[Key]> };

/**
 * Recursively makes every property readonly.
 */
export type DeepReadonly<T> = T extends Primitive | ((...args: never[]) => unknown)
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : { readonly [Key in keyof T]: DeepReadonly<T[Key]> };

/**
 * A value that may be undefined.
 */
export type Maybe<T> = T | undefined;

/**
 * A value that may be returned directly or through a Promise-like value.
 */
export type MaybePromise<T> = T | PromiseLike<T>;

/**
 * A readonly array with at least one item.
 */
export type NonEmptyArray<T> = readonly [T, ...T[]];

/**
 * A value that may be null.
 */
export type Nullable<T> = T | null;

/**
 * Primitive JavaScript values.
 */
export type Primitive = string | number | boolean | bigint | symbol | null | undefined;

/**
 * Flattens an object type for easier editor display.
 */
export type Prettify<T> = {
  [Key in keyof T]: T[Key];
} & {};

/**
 * The union of an object's value types.
 */
export type ValueOf<T> = T[keyof T];
