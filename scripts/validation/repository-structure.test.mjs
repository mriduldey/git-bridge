import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

const requiredPaths = [
  ".changeset",
  ".github",
  ".husky",
  "docs",
  "examples",
  "packages",
  "test",
  "scripts",
  "tooling",
  ".editorconfig",
  ".gitignore",
  ".npmrc",
  "package.json",
  "pnpm-workspace.yaml",
  "turbo.json",
  "tsconfig.base.json",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md"
];

const scriptDirectories = [
  "scripts/build",
  "scripts/release",
  "scripts/validation",
  "scripts/documentation",
  "scripts/development",
  "scripts/utilities"
];

const toolingDirectories = [
  "tooling/eslint",
  "tooling/prettier",
  "tooling/typescript",
  "tooling/vitest",
  "tooling/changesets",
  "tooling/github",
  "tooling/shared"
];

describe("repository bootstrap structure", () => {
  it("contains the canonical top-level project structure", () => {
    expect(pathsExist(requiredPaths)).toEqual([]);
  });

  it("contains the canonical scripts structure", () => {
    expect(pathsExist(scriptDirectories)).toEqual([]);
  });

  it("contains the canonical tooling structure", () => {
    expect(pathsExist(toolingDirectories)).toEqual([]);
  });
});

/**
 * @param {readonly string[]} paths
 * @returns {string[]}
 */
function pathsExist(paths) {
  return paths.filter((path) => !existsSync(join(repositoryRoot, path)));
}
