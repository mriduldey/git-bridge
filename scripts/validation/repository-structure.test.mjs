import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const packagesRoot = join(repositoryRoot, "packages");

/** @type {Record<string, Set<string>>} */
const allowedWorkspaceDependencies = {
  sourceaxis: new Set([
    "@sourceaxis/auth",
    "@sourceaxis/contracts",
    "@sourceaxis/core",
    "@sourceaxis/errors"
  ]),
  "@sourceaxis/auth": new Set([
    "@sourceaxis/contracts",
    "@sourceaxis/errors",
    "@sourceaxis/shared"
  ]),
  "@sourceaxis/cache": new Set([
    "@sourceaxis/contracts",
    "@sourceaxis/errors",
    "@sourceaxis/shared"
  ]),
  "@sourceaxis/contracts": new Set([]),
  "@sourceaxis/core": new Set([
    "@sourceaxis/auth",
    "@sourceaxis/cache",
    "@sourceaxis/contracts",
    "@sourceaxis/errors",
    "@sourceaxis/observability",
    "@sourceaxis/shared",
    "@sourceaxis/transport"
  ]),
  "@sourceaxis/errors": new Set([]),
  "@sourceaxis/observability": new Set([
    "@sourceaxis/contracts",
    "@sourceaxis/errors",
    "@sourceaxis/shared"
  ]),
  "@sourceaxis/provider-github": new Set([
    "@sourceaxis/auth",
    "@sourceaxis/cache",
    "@sourceaxis/contracts",
    "@sourceaxis/core",
    "@sourceaxis/errors",
    "@sourceaxis/observability",
    "@sourceaxis/shared",
    "@sourceaxis/transport"
  ]),
  "@sourceaxis/shared": new Set([]),
  "@sourceaxis/testing": new Set([
    "@sourceaxis/contracts",
    "@sourceaxis/core",
    "@sourceaxis/errors",
    "@sourceaxis/shared"
  ]),
  "@sourceaxis/transport": new Set([
    "@sourceaxis/contracts",
    "@sourceaxis/errors",
    "@sourceaxis/shared"
  ])
};

const foundationalPackages = new Set(Object.keys(allowedWorkspaceDependencies));
const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

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
  "CHANGELOG.md",
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

const requiredArchitectureDocuments = [
  "docs/architecture/ARCHITECTURE.md",
  "docs/architecture/INDEX.md",
  "docs/architecture/README.md",
  "docs/architecture/DOCUMENTATION_STYLE_GUIDE.md",
  "docs/architecture/glossary.md",
  "docs/architecture/diagrams/authentication.mmd",
  "docs/architecture/diagrams/cache.mmd",
  "docs/architecture/diagrams/errors.mmd",
  "docs/architecture/diagrams/high-level.mmd",
  "docs/architecture/diagrams/observability.mmd",
  "docs/architecture/diagrams/packages.mmd",
  "docs/architecture/diagrams/provider-flow.mmd",
  "docs/architecture/diagrams/request-lifecycle.mmd",
  "docs/architecture/diagrams/transport.mmd"
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

describe("architecture documentation", () => {
  it("keeps derived architecture documentation and diagrams populated", () => {
    const violations = [];

    for (const documentPath of requiredArchitectureDocuments) {
      const absolutePath = join(repositoryRoot, documentPath);

      if (!existsSync(absolutePath)) {
        violations.push(`${documentPath}: missing`);
        continue;
      }

      if (readFileSync(absolutePath, "utf8").trim().length === 0) {
        violations.push(`${documentPath}: empty`);
      }
    }

    expect(violations).toEqual([]);
  });
});

describe("package architecture boundaries", () => {
  it("keeps workspace dependencies in the approved foundation direction", () => {
    const packages = readPackages();
    const violations = [];

    for (const pkg of packages) {
      const allowed = allowedWorkspaceDependencies[pkg.name];

      if (allowed === undefined) {
        violations.push(`${pkg.name}: package is not approved for the current foundation graph`);
        continue;
      }

      for (const dependency of pkg.workspaceDependencies) {
        if (!allowed.has(dependency)) {
          violations.push(`${pkg.name} -> ${dependency}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("has no circular workspace package dependencies", () => {
    const packages = readPackages();
    const graph = new Map(
      packages.map((pkg) => [
        pkg.name,
        pkg.workspaceDependencies.filter((dependency) => foundationalPackages.has(dependency))
      ])
    );

    expect(findCycles(graph)).toEqual([]);
  });

  it("keeps provider dependencies and imports out of foundational packages", () => {
    const packages = readPackages();
    const violations = [];

    for (const pkg of packages) {
      if (!foundationalPackages.has(pkg.name)) {
        continue;
      }

      for (const dependency of pkg.workspaceDependencies) {
        if (isProviderSpecifier(dependency)) {
          violations.push(`${pkg.name} depends on ${dependency}`);
        }
      }

      for (const sourceFile of listSourceFiles(pkg.directory)) {
        for (const specifier of readImportSpecifiers(sourceFile)) {
          if (isProviderSpecifier(specifier)) {
            violations.push(`${toRepositoryPath(sourceFile)} imports ${specifier}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("allows package imports only through declared public exports", () => {
    const packages = readPackages();
    const packageByName = new Map(packages.map((pkg) => [pkg.name, pkg]));
    const violations = [];

    for (const pkg of packages) {
      for (const sourceFile of listSourceFiles(pkg.directory)) {
        for (const specifier of readImportSpecifiers(sourceFile)) {
          const packageImport = parseWorkspaceImport(specifier, packageByName);

          if (packageImport === undefined) {
            continue;
          }

          if (!packageImport.target.exportKeys.has(packageImport.exportKey)) {
            violations.push(
              `${toRepositoryPath(sourceFile)} imports ${specifier}, but ${packageImport.target.name} does not export ${packageImport.exportKey}`
            );
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("does not expose internal modules through package exports", () => {
    const violations = [];

    for (const pkg of readPackages()) {
      for (const [exportKey, exportTarget] of Object.entries(pkg.exports)) {
        const targets = normalizeExportTargets(exportTarget);

        if (exportKey.includes("internal") || exportKey.includes("private")) {
          violations.push(`${pkg.name} exports internal subpath ${exportKey}`);
        }

        for (const target of targets) {
          if (target.includes("/internal/") || target.includes("/private/")) {
            violations.push(`${pkg.name} export ${exportKey} targets ${target}`);
          }

          if (target.startsWith("./src/")) {
            violations.push(`${pkg.name} export ${exportKey} targets source file ${target}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps provider communication behind Transport and out of provider SDKs", () => {
    const violations = [];

    for (const pkg of readPackages().filter((candidate) =>
      candidate.name.startsWith("@sourceaxis/provider-")
    )) {
      const manifestDependencies = Object.keys(pkg.manifest.dependencies ?? {});

      for (const dependency of manifestDependencies) {
        if (!dependency.startsWith("@sourceaxis/")) {
          violations.push(
            `${pkg.name} declares provider/protocol runtime dependency ${dependency}`
          );
        }
      }

      for (const sourceFile of listSourceFiles(pkg.directory)) {
        const source = readFileSync(sourceFile, "utf8");

        for (const specifier of readImportSpecifiers(sourceFile)) {
          if (isProviderSdkSpecifier(specifier)) {
            violations.push(`${toRepositoryPath(sourceFile)} imports provider SDK ${specifier}`);
          }
        }

        if (/\b(fetch|XMLHttpRequest)\s*\(/u.test(source)) {
          violations.push(`${toRepositoryPath(sourceFile)} bypasses Transport with direct IO`);
        }

        if (/\bOctokit\b/u.test(source)) {
          violations.push(
            `${toRepositoryPath(sourceFile)} references Octokit implementation detail`
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("requires release-ready package manifests for publishable packages", () => {
    const violations = [];

    for (const pkg of readPackages()) {
      if (pkg.private === true) {
        continue;
      }

      const manifest = pkg.manifest;

      if (manifest.version !== "0.1.0") {
        violations.push(`${pkg.name}: expected v0.1.0`);
      }

      if (manifest.license !== "MIT") {
        violations.push(`${pkg.name}: missing MIT license metadata`);
      }

      if (manifest.sideEffects !== false) {
        violations.push(`${pkg.name}: sideEffects must be false`);
      }

      if (!Array.isArray(manifest.files) || !manifest.files.includes("dist")) {
        violations.push(`${pkg.name}: files must include dist`);
      }

      if (!Array.isArray(manifest.files) || !manifest.files.includes("README.md")) {
        violations.push(`${pkg.name}: files must include README.md`);
      }

      if (manifest.main !== "./dist/cjs/index.js") {
        violations.push(`${pkg.name}: main must target CommonJS output`);
      }

      if (manifest.module !== "./dist/esm/index.js") {
        violations.push(`${pkg.name}: module must target ESM output`);
      }

      if (manifest.types !== "./dist/esm/index.d.ts") {
        violations.push(`${pkg.name}: types must target generated declarations`);
      }

      if (manifest.engines?.node !== ">=20.19.0") {
        violations.push(`${pkg.name}: missing Node.js engine metadata`);
      }

      if (manifest.repository?.url !== "git+https://github.com/mriduldey/source-axis.git") {
        violations.push(`${pkg.name}: missing repository metadata`);
      }

      if (manifest.repository?.directory !== toRepositoryPath(pkg.directory)) {
        violations.push(`${pkg.name}: repository.directory must point at package directory`);
      }

      if (manifest.bugs?.url !== "https://github.com/mriduldey/source-axis/issues") {
        violations.push(`${pkg.name}: missing bugs URL`);
      }

      if (manifest.homepage !== "https://github.com/mriduldey/source-axis#readme") {
        violations.push(`${pkg.name}: missing homepage URL`);
      }

      if (!Array.isArray(manifest.keywords) || manifest.keywords.length === 0) {
        violations.push(`${pkg.name}: missing npm keywords`);
      }

      if (manifest.publishConfig?.access !== "public") {
        violations.push(`${pkg.name}: publishConfig.access must be public`);
      }

      if (manifest.publishConfig?.provenance !== true) {
        violations.push(`${pkg.name}: publishConfig.provenance must be true`);
      }

      for (const [exportKey, exportTarget] of Object.entries(pkg.exports)) {
        if (!isConditionalExport(exportTarget)) {
          violations.push(`${pkg.name}: export ${exportKey} must define types/import/require`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps testing infrastructure provider-neutral and on public package APIs", () => {
    const testingPackage = readPackages().find((pkg) => pkg.name === "@sourceaxis/testing");
    const violations = [];

    if (testingPackage === undefined) {
      violations.push("@sourceaxis/testing package is missing");
    } else {
      for (const sourceFile of listSourceFiles(testingPackage.directory)) {
        for (const specifier of readImportSpecifiers(sourceFile)) {
          if (isProviderSpecifier(specifier)) {
            violations.push(
              `${toRepositoryPath(sourceFile)} imports provider package ${specifier}`
            );
          }

          if (isPrivateOrSourceSpecifier(specifier)) {
            violations.push(`${toRepositoryPath(sourceFile)} imports non-public path ${specifier}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps provider SDK types out of provider public entrypoints where practical", () => {
    const violations = [];

    for (const pkg of readPackages().filter((candidate) =>
      candidate.name.startsWith("@sourceaxis/provider-")
    )) {
      const entrypoint = join(pkg.directory, "src", "index.ts");

      if (!existsSync(entrypoint)) {
        continue;
      }

      const source = readFileSync(entrypoint, "utf8");

      if (
        source.includes("@octokit/") ||
        /\bInternalOctokit\w*\b/u.test(source) ||
        /\bGitHubOctokit\w*\b/u.test(source) ||
        /\bOctokit\b/u.test(source)
      ) {
        violations.push(`${pkg.name} public entrypoint references provider SDK naming`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("requires provider packages to have reusable certification coverage", () => {
    const providerPackages = readPackages().filter((pkg) =>
      pkg.name.startsWith("@sourceaxis/provider-")
    );
    const certificationTests = listFiles(join(packagesRoot, "testing", "tests")).filter((file) =>
      file.endsWith(".test.ts")
    );
    const violations = [];

    for (const providerPackage of providerPackages) {
      const providerName = providerPackage.name.replace("@sourceaxis/provider-", "");
      const hasCertification = certificationTests.some((file) => {
        const source = readFileSync(file, "utf8");
        return source.includes(providerPackage.name) && source.includes("runProviderContractSuite");
      });

      if (!hasCertification) {
        violations.push(`${providerName}: missing reusable provider certification test`);
      }
    }

    expect(violations).toEqual([]);
  });
});

/**
 * @param {readonly string[]} paths
 * @returns {string[]}
 */
function pathsExist(paths) {
  return paths.filter((path) => !existsSync(join(repositoryRoot, path)));
}

/**
 * @returns {Array<{
 *   directory: string;
 *   exportKeys: Set<string>;
 *   exports: Record<string, unknown>;
 *   manifest: any;
 *   name: string;
 *   private: boolean;
 *   workspaceDependencies: string[];
 * }>}
 */
function readPackages() {
  return readdirSync(packagesRoot)
    .map((name) => join(packagesRoot, name))
    .filter((path) => statSync(path).isDirectory())
    .map((directory) => {
      const manifestPath = join(directory, "package.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const dependencies = {
        ...manifest.dependencies,
        ...manifest.peerDependencies,
        ...manifest.optionalDependencies
      };
      const workspaceDependencies = Object.entries(dependencies)
        .filter(([, version]) => typeof version === "string" && version.startsWith("workspace:"))
        .map(([name]) => name)
        .sort();

      return {
        directory,
        exportKeys: new Set(Object.keys(manifest.exports ?? {})),
        exports: manifest.exports ?? {},
        manifest,
        name: manifest.name,
        private: manifest.private === true,
        workspaceDependencies
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * @param {unknown} exportTarget
 * @returns {boolean}
 */
function isConditionalExport(exportTarget) {
  /** @type {{ types?: unknown; import?: unknown; require?: unknown } | null} */
  const conditionalExport =
    exportTarget !== null && typeof exportTarget === "object" ? exportTarget : null;

  return (
    conditionalExport !== null &&
    typeof conditionalExport.types === "string" &&
    conditionalExport.types.startsWith("./dist/esm/") &&
    typeof conditionalExport.import === "string" &&
    conditionalExport.import.startsWith("./dist/esm/") &&
    typeof conditionalExport.require === "string" &&
    conditionalExport.require.startsWith("./dist/cjs/")
  );
}

/**
 * @param {Map<string, string[]>} graph
 * @returns {string[]}
 */
function findCycles(graph) {
  /** @type {string[]} */
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();

  for (const packageName of graph.keys()) {
    visit(packageName, []);
  }

  return cycles;

  /**
   * @param {string} packageName
   * @param {string[]} path
   */
  function visit(packageName, path) {
    if (visiting.has(packageName)) {
      const start = path.indexOf(packageName);
      cycles.push([...path.slice(start), packageName].join(" -> "));
      return;
    }

    if (visited.has(packageName)) {
      return;
    }

    visiting.add(packageName);

    for (const dependency of graph.get(packageName) ?? []) {
      visit(dependency, [...path, packageName]);
    }

    visiting.delete(packageName);
    visited.add(packageName);
  }
}

/**
 * @param {string} directory
 * @returns {string[]}
 */
function listSourceFiles(directory) {
  const sourceDirectory = join(directory, "src");

  if (!existsSync(sourceDirectory)) {
    return [];
  }

  /** @type {string[]} */
  const files = [];
  collect(sourceDirectory);
  return files;

  /**
   * @param {string} currentDirectory
   */
  function collect(currentDirectory) {
    for (const entry of readdirSync(currentDirectory)) {
      const entryPath = join(currentDirectory, entry);

      if (statSync(entryPath).isDirectory()) {
        collect(entryPath);
        continue;
      }

      if (entryPath.endsWith(".ts") || entryPath.endsWith(".mts") || entryPath.endsWith(".mjs")) {
        files.push(entryPath);
      }
    }
  }
}

/**
 * @param {string} directory
 * @returns {string[]}
 */
function listFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  /** @type {string[]} */
  const files = [];
  collect(directory);
  return files;

  /**
   * @param {string} currentDirectory
   */
  function collect(currentDirectory) {
    for (const entry of readdirSync(currentDirectory)) {
      const entryPath = join(currentDirectory, entry);

      if (statSync(entryPath).isDirectory()) {
        collect(entryPath);
        continue;
      }

      files.push(entryPath);
    }
  }
}

/**
 * @param {string} sourceFile
 * @returns {string[]}
 */
function readImportSpecifiers(sourceFile) {
  const source = readFileSync(sourceFile, "utf8");
  /** @type {string[]} */
  const specifiers = [];

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];

    if (specifier !== undefined) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

/**
 * @param {string} specifier
 * @param {Map<string, ReturnType<typeof readPackages>[number]>} packageByName
 * @returns {{ exportKey: string; target: ReturnType<typeof readPackages>[number] } | undefined}
 */
function parseWorkspaceImport(specifier, packageByName) {
  const matchingPackage = [...packageByName.keys()]
    .filter((packageName) => specifier === packageName || specifier.startsWith(`${packageName}/`))
    .sort((left, right) => right.length - left.length)[0];

  if (matchingPackage === undefined) {
    return undefined;
  }

  const target = packageByName.get(matchingPackage);

  if (target === undefined) {
    return undefined;
  }

  const suffix = specifier.slice(matchingPackage.length);
  const exportKey = suffix.length === 0 ? "." : `.${suffix}`;

  return { exportKey, target };
}

/**
 * @param {unknown} exportTarget
 * @returns {string[]}
 */
function normalizeExportTargets(exportTarget) {
  if (typeof exportTarget === "string") {
    return [exportTarget];
  }

  if (exportTarget !== null && typeof exportTarget === "object") {
    return Object.values(exportTarget).flatMap((target) => normalizeExportTargets(target));
  }

  return [];
}

/**
 * @param {string} specifier
 * @returns {boolean}
 */
function isProviderSpecifier(specifier) {
  return specifier.startsWith("@sourceaxis/provider") || specifier.includes("provider-github");
}

/**
 * @param {string} specifier
 * @returns {boolean}
 */
function isProviderSdkSpecifier(specifier) {
  return specifier.startsWith("@octokit/") || specifier === "octokit";
}

/**
 * @param {string} specifier
 * @returns {boolean}
 */
function isPrivateOrSourceSpecifier(specifier) {
  return (
    specifier.includes("/internal/") ||
    specifier.includes("/private/") ||
    specifier.includes("/src/") ||
    specifier.endsWith("/src")
  );
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function toRepositoryPath(filePath) {
  return relative(repositoryRoot, filePath).split(sep).join("/");
}
