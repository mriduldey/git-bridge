/**
 * Asserts that a condition is truthy.
 *
 * @throws Error when the condition is false.
 */
export function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Asserts that a value is neither null nor undefined.
 *
 * @throws Error when the value is null or undefined.
 */
export function assertDefined<T>(
  value: T,
  message = "Expected value to be defined"
): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

/**
 * Exhaustiveness helper for discriminated unions.
 *
 * @throws Error when reached at runtime.
 */
export function assertNever(value: never, message = "Unexpected value"): never {
  throw new Error(`${message}: ${String(value)}`);
}

/**
 * Marks code paths that should be unreachable.
 *
 * @throws Error whenever called.
 */
export function unreachable(message = "Unreachable code reached"): never {
  throw new Error(message);
}
