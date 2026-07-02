/**
 * Uppercases the first character of a string.
 */
export function capitalize(value: string): string {
  if (value.length === 0) {
    return value;
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

/**
 * Returns true when a string contains only whitespace.
 */
export function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

/**
 * Removes leading forward slashes.
 */
export function trimStartSlash(value: string): string {
  return value.replace(/^\/+/, "");
}

/**
 * Removes trailing forward slashes.
 */
export function trimEndSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Converts CRLF and CR line endings to LF.
 */
export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}
