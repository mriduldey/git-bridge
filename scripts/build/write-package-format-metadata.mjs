import { writePackageFormatMetadata } from "./package-format-metadata.mjs";

const packageDirectories = process.argv.slice(2);
const targets = packageDirectories.length === 0 ? ["packages"] : packageDirectories;

for (const target of targets) {
  writePackageFormatMetadata(target);
}
