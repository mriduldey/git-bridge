/**
 * Returns the final segment of a slash-delimited path.
 */
export function basename(path: string): string {
  const parts = splitPath(path);
  return parts.at(-1) ?? "";
}

/**
 * Returns every segment before the final segment of a slash-delimited path.
 */
export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const absolute = normalized.startsWith("/");
  const parts = splitPath(normalized);

  if (parts.length <= 1) {
    return absolute ? "/" : "";
  }

  const directory = parts.slice(0, -1).join("/");
  return absolute ? `/${directory}` : directory;
}

/**
 * Joins path segments using forward slashes and normalizes the result.
 */
export function joinPath(...segments: readonly string[]): string {
  return normalizePath(segments.filter((segment) => segment.length > 0).join("/"));
}

/**
 * Normalizes a path to forward slashes, removes duplicate separators, and resolves dot segments.
 */
export function normalizePath(path: string): string {
  const slashPath = path.replace(/\\/g, "/");
  const absolute = slashPath.startsWith("/");
  const output: string[] = [];

  for (const segment of slashPath.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (output.length > 0 && output.at(-1) !== "..") {
        output.pop();
      } else if (!absolute) {
        output.push(segment);
      }

      continue;
    }

    output.push(segment);
  }

  const normalized = output.join("/");

  if (absolute) {
    return normalized.length > 0 ? `/${normalized}` : "/";
  }

  return normalized;
}

/**
 * Splits a normalized path into non-empty segments.
 */
export function splitPath(path: string): string[] {
  const normalized = normalizePath(path);
  return normalized.split("/").filter((segment) => segment.length > 0);
}
