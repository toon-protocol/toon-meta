// Doc-factory JSON/template gate (`npm run validate:json`).
//
// Two layers of real validation, both deterministic and offline:
//   1. WELL-FORMEDNESS — every tracked *.json parses. Catches trailing commas,
//      truncated writes, and merge-conflict markers in config/template JSON
//      (plugin.json, marketplace.json, devbox.json, evals.json, ...).
//   2. SCHEMA — every skills/<skill>/evals/evals.json validates against
//      scripts/factory/schemas/evals.schema.json via ajv (the 34 eval suites
//      share one shape; the schema guards it against drift).
//
// Vendored trees (node_modules, the demo-dashboard sub-app's lockfiles) are
// excluded — they are not the docs repo's own authored JSON.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const ROOT = process.cwd();
const HERE = dirname(fileURLToPath(import.meta.url));

const IGNORE = ["node_modules/", "scripts/demo-dashboard/"];

const files = execFileSync("git", ["ls-files", "*.json", "**/*.json"], {
  cwd: ROOT,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)
  .filter((f) => !IGNORE.some((d) => f.startsWith(d) || f.includes("/" + d)));

const errors = [];

// --- Layer 1: well-formedness ------------------------------------------------
const parsed = new Map();
for (const f of files) {
  try {
    parsed.set(f, JSON.parse(readFileSync(resolve(ROOT, f), "utf8")));
  } catch (e) {
    errors.push(`malformed JSON: ${f} — ${e.message}`);
  }
}

// --- Layer 2: evals schema ---------------------------------------------------
const ajv = new Ajv({ allErrors: true, strict: false });
const evalsSchema = JSON.parse(
  readFileSync(join(HERE, "schemas", "evals.schema.json"), "utf8"),
);
const validateEvals = ajv.compile(evalsSchema);

const evalsFiles = files.filter((f) => /skills\/[^/]+\/evals\/evals\.json$/.test(f));
for (const f of evalsFiles) {
  const data = parsed.get(f);
  if (data === undefined) continue; // already reported as malformed
  if (!validateEvals(data)) {
    for (const err of validateEvals.errors ?? []) {
      errors.push(`schema: ${f} ${err.instancePath || "/"} ${err.message}`);
    }
  }
}

console.log(
  `Validated ${files.length} JSON file(s) (well-formed) + ${evalsFiles.length} evals suite(s) (schema).`,
);

if (errors.length === 0) {
  console.log("All JSON valid. Gate green.");
  process.exit(0);
}

console.error(`\n${errors.length} JSON problem(s):`);
for (const e of errors) console.error(`  ${e}`);
process.exit(1);
