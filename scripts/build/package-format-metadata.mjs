import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * @param {string} packageDirectory
 * @returns {void}
 */
export function writePackageFormatMetadata(packageDirectory) {
  const cjsDirectory = join(resolve(packageDirectory), "dist", "cjs");

  mkdirSync(cjsDirectory, { recursive: true });
  writeFileSync(join(cjsDirectory, "package.json"), `${JSON.stringify({ type: "commonjs" })}\n`);
}
