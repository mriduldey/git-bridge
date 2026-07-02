/**
 * Returns true when a value is neither null nor undefined.
 */
export function isDefined<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

/**
 * Returns true when a value is a string.
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Returns true when a value is a finite number.
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Returns true when a value is a boolean.
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * Returns true when a value is a non-null object.
 */
export function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * Returns true when a value is an object literal or a null-prototype object.
 */
export function isPlainObject(value: unknown): value is Record<PropertyKey, unknown> {
  if (!isObject(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Returns true when a value can be treated as an object record.
 */
export function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return isObject(value) && !Array.isArray(value);
}

/**
 * Returns true when a value is an Error instance.
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}
