import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

const packagesRoot = fileURLToPath(new URL("../../packages/", import.meta.url));
const packageDirectories = readdirSync(packagesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(packagesRoot, entry.name))
  .sort();

for (const directory of packageDirectories) {
  const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));

  if (manifest.private === true) {
    continue;
  }

  const result = spawnSync("npm", ["pack", "--dry-run"], {
    cwd: directory,
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`npm pack --dry-run failed for ${manifest.name}`);
  }

  process.stdout.write(`Packed ${manifest.name} ${manifest.version} (dry run)\n`);
}
