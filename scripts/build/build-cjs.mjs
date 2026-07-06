import { createRequire } from "node:module";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { writePackageFormatMetadata } from "./package-format-metadata.mjs";

const require = createRequire(import.meta.url);
/** @type {typeof import("typescript")} */
const ts = require("typescript");

const packageDirectory = resolve(process.argv[2] ?? ".");
const sourceDirectory = join(packageDirectory, "src");
const outputDirectory = join(packageDirectory, "dist", "cjs");
const entryPoints = listTypeScriptFiles(sourceDirectory);

for (const entryPoint of entryPoints) {
  const source = readFileSync(entryPoint, "utf8");
  const relativePath = relative(sourceDirectory, entryPoint).replace(/\.ts$/u, ".js");
  const outputPath = join(outputDirectory, relativePath);
  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      isolatedModules: true,
      module: ts.ModuleKind.CommonJS,
      sourceMap: true,
      target: ts.ScriptTarget.ES2023
    },
    fileName: entryPoint
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, result.outputText);

  if (result.sourceMapText !== undefined) {
    writeFileSync(`${outputPath}.map`, result.sourceMapText);
  }
}

writePackageFormatMetadata(packageDirectory);

/**
 * @param {string} directory
 * @returns {string[]}
 */
function listTypeScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return listTypeScriptFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")
      ? [entryPath]
      : [];
  });
}
