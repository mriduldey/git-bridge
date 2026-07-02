/**
 * Shared immutable empty array sentinel.
 */
export const EMPTY_ARRAY: readonly never[] = Object.freeze([]);

/**
 * Shared immutable empty object sentinel.
 */
export const EMPTY_OBJECT: Readonly<Record<PropertyKey, never>> = Object.freeze({});
