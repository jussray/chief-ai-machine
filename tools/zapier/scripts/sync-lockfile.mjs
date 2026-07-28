import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CANONICAL_LOCK_URL =
  "https://raw.githubusercontent.com/jussray/founder-control-room/b9890e3732fbffe21e9e1fed6e51140d9097aaa4/tools/zapier/package-lock.json";
const EXPECTED_SHA256 =
  "86212fc8d1397d03556ce3fab04b4bdf97da9054198a42b7a0d3262d53bfb1b0";

const toolRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = resolve(toolRoot, "package.json");
const lockPath = resolve(toolRoot, "package-lock.json");

const response = await fetch(CANONICAL_LOCK_URL, { redirect: "follow" });
if (!response.ok) {
  throw new Error(
    `Unable to download canonical Zapier lockfile: ${response.status} ${response.statusText}`,
  );
}

const bytes = Buffer.from(await response.arrayBuffer());
const digest = createHash("sha256").update(bytes).digest("hex");
if (digest !== EXPECTED_SHA256) {
  throw new Error(
    `Canonical Zapier lockfile checksum mismatch: expected ${EXPECTED_SHA256}, received ${digest}`,
  );
}

const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const lockfile = JSON.parse(bytes.toString("utf8"));
const rootPackage = lockfile.packages?.[""];
if (!rootPackage) {
  throw new Error("Canonical Zapier lockfile is missing its root package metadata.");
}

lockfile.name = packageJson.name;
lockfile.version = packageJson.version;
rootPackage.name = packageJson.name;
rootPackage.version = packageJson.version;
rootPackage.engines = packageJson.engines;

await writeFile(lockPath, `${JSON.stringify(lockfile, null, 2)}\n`, "utf8");
console.log(`Verified canonical Zapier lockfile ${digest}`);
