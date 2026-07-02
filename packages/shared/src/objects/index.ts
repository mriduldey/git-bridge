import type { DeepReadonly } from "../types/index.js";

/**
 * Recursively freezes an object and its object-valued own properties.
 */
export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    return value as DeepReadonly<T>;
  }

  for (const key of Reflect.ownKeys(value)) {
    const child = (value as Record<PropertyKey, unknown>)[key];

    if (child !== null && (typeof child === "object" || typeof child === "function")) {
      deepFreeze(child);
    }
  }

  return Object.freeze(value) as DeepReadonly<T>;
}

/**
 * Returns true when an object owns a property directly.
 */
export function hasOwn<T extends object, K extends PropertyKey>(
  object: T,
  key: K
): object is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * Returns true when an object has no own string or symbol keys.
 */
export function isEmptyObject(object: object): boolean {
  return Reflect.ownKeys(object).length === 0;
}

/**
 * Returns a shallow merge where undefined source values are ignored.
 */
export function mergeDefined<T extends object>(
  target: T,
  ...sources: ReadonlyArray<{ [Key in keyof T]?: T[Key] | undefined }>
): T {
  const result: Partial<T> = { ...target };

  for (const source of sources) {
    for (const key of Reflect.ownKeys(source) as Array<keyof T>) {
      const value = source[key];

      if (value !== undefined) {
        result[key] = value;
      }
    }
  }

  return result as T;
}
