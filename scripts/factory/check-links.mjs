// Doc-factory link gate (`npm run check:links`).
//
// Validates INTERNAL (relative on-disk) markdown links across the committed
// docs — the meaningful, deterministic half of link-checking. EXTERNAL URLs
// (http/https/mailto/tel) are intentionally NOT fetched: network checks are
// flaky and slow in CI, and the factory-engine playbook says the gate must not
// fail on pre-existing dead external links. External-URL sweeping is deferred
// to a scheduled follow-up (run `check:links` with EXTERNAL=1 to opt in).
//
// Uses markdown-link-check per file, with each file's own directory as the
// baseUrl so relative links resolve against the file, not the repo root.
//
// Any genuinely-broken INTERNAL link that predates this gate can be listed in
// scripts/factory/link-ignore.json (kept empty when HEAD is clean) so the gate
// stays green without editing unrelated docs.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const markdownLinkCheck = require("markdown-link-check");

const ROOT = process.cwd();
const CHECK_EXTERNAL = process.env.EXTERNAL === "1";

// Directories excluded from the gate — mirror .markdownlint-cli2.jsonc ignores.
// The `.sandcastle/**` prompt files are the doc-analogue of the eslint-ignore
// gotcha and must not be link-checked either.
const IGNORE_DIRS = [
  "node_modules/",
  ".sandcastle/",
  "scripts/demo-dashboard/",
];

// Optional allowlist of known-broken internal links (kept empty when clean).
let allow = [];
const allowPath = join(ROOT, "scripts/factory/link-ignore.json");
if (existsSync(allowPath)) {
  allow = JSON.parse(readFileSync(allowPath, "utf8")).ignore ?? [];
}
const isAllowed = (file, link) =>
  allow.some((a) => a.file === file && a.link === link);

const ignorePatterns = CHECK_EXTERNAL
  ? [{ pattern: "^#" }]
  : [
      { pattern: "^https?://" },
      { pattern: "^mailto:" },
      { pattern: "^tel:" },
      { pattern: "^#" },
    ];

// Tracked markdown files (git is the source of truth for "committed docs").
const files = execFileSync("git", ["ls-files", "*.md", "**/*.md"], {
  cwd: ROOT,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)
  .filter((f) => !IGNORE_DIRS.some((d) => f.startsWith(d) || f.includes("/" + d)));

const checkOne = (file) =>
  new Promise((res) => {
    const abs = resolve(ROOT, file);
    const markdown = readFileSync(abs, "utf8");
    markdownLinkCheck(
      markdown,
      { baseUrl: pathToFileURL(dirname(abs) + "/").href, ignorePatterns },
      (err, results) => {
        if (err) {
          res([{ file, link: "(checker error)", reason: String(err) }]);
          return;
        }
        const dead = (results ?? [])
          .filter((r) => r.status === "dead")
          .map((r) => ({ file, link: r.link }))
          .filter((d) => !isAllowed(d.file, d.link));
        res(dead);
      },
    );
  });

const batches = await Promise.all(files.map(checkOne));
const broken = batches.flat();

console.log(
  `Checked ${files.length} markdown file(s) for ${CHECK_EXTERNAL ? "ALL" : "internal-only"} links.`,
);

if (broken.length === 0) {
  console.log("No broken links. Gate green.");
  process.exit(0);
}

console.error(`\n${broken.length} broken link(s):`);
for (const b of broken) console.error(`  ${b.file} -> ${b.link}`);
process.exit(1);
