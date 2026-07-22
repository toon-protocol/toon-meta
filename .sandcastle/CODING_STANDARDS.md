# Documentation Standards

The reviewer agent loads this file during review via `@.sandcastle/CODING_STANDARDS.md`,
so these standards are enforced during review without costing tokens during
implementation. toon-meta is a docs / tracker repo — these are prose and data
standards, not source-code style rules.

## Prose

- Write for a technical reader already familiar with TOON, Nostr, and Interledger.
- Prefer precise, current statements over aspiration; mark anything speculative.
- Keep terminology consistent with the surrounding docs (e.g. `g.proxy`, `apex`,
  `relay`, `store`, `mill` — use the established names, do not invent synonyms).
- Match the structure, heading style, and tone of neighbouring files in the same
  directory.

## Markdown

- The gate is `npm run lint:md` (markdownlint-cli2, config in
  `.markdownlint-cli2.jsonc`). Do not disable additional rules to make a change
  pass — fix the markdown instead.
- Keep links valid: `npm run check:links` validates internal (relative) links.
  Every relative link and referenced file/anchor must exist.
- Do not restructure or reformat files the issue did not ask you to touch.

## JSON / templates / evals

- All JSON must be well-formed; `npm run validate:json` also schema-validates the
  `skills/*/evals/evals.json` suites (`scripts/factory/schemas/evals.schema.json`).
- When adding an eval or template, match the shape of its siblings exactly.

## Scope

- Make the smallest change that fully resolves the issue.
- Never mass-edit unrelated docs to satisfy a lint rule — keep the change scoped
  and note any pre-existing gate debt on the issue.
