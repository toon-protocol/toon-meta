# FACTORY.md

Org-wide single source of truth for the **sandcastle software factory**.

Every execution repo in the `toon-protocol` org runs the same two-zone pipeline, with the
GitHub tracker as the seam:

- **Smart zone (`skills`)** — grill → spec → tickets. The human-in-the-loop half, installed
  as the `mattpocock-skills` Claude Code plugin.
- **Dumb zone (`sandcastle`)** — plan → parallel sandboxed agents → lint/typecheck/test gate
  → PR. Driven by the `@ai-hero/sandcastle` library committed as `.sandcastle/` in each repo.

This document records the values that are **decided once and apply to every repo**: the
pinned engine version, the shared conventions, the label reconciliation, the trigger-label
spec repos copy, and the per-repo factory table (filled in as each repo's factory proves out).

Tracked by epic [#178](https://github.com/toon-protocol/toon-meta/issues/178).

---

## Pinned engine version

**`@ai-hero/sandcastle` = `0.12.0`** — this is THE org-wide pinned version.

- **Exact-pin, org-wide.** Every repo's `.sandcastle/` pins the **same exact** version
  (`0.12.0` today). The pinned version is recorded here, once, and nowhere else is canonical.
- **Upgrades are a deliberate, cross-repo task — never automatic.** `@ai-hero/sandcastle` is
  pre-1.0 (single-maintainer). A `0.x` minor can break `init`/templates under us across all
  repos at the same time, so bumping the pin is a coordinated change across every repo, not a
  per-repo Dependabot bump.

---

## Shared conventions (decided once; apply to every repo)

| Convention            | Value                                                        |
|-----------------------|-------------------------------------------------------------|
| Engine pin            | `@ai-hero/sandcastle@0.12.0` (exact, org-wide — see above)  |
| Orchestration template| `parallel-planner-with-review` (plan → implement → review)  |
| Sandbox provider      | Docker                                                       |
| Auth secret           | `CLAUDE_CODE_OAUTH_TOKEN`                                    |
| Trigger labels        | `agent:implement` (+ `agent:review`) — see reconciliation   |

**Orchestration template** — `parallel-planner-with-review` is the default for every repo (the
plan → implement → review shape we want) unless a repo demonstrably needs otherwise. It is one of
the templates `npx @ai-hero/sandcastle init` offers (`blank` / `parallel-planner` /
`parallel-planner-with-review` / `sequential-reviewer` / `simple-loop`).

**Sandbox provider** — Docker. It is present on GitHub-hosted runners out of the box; if a repo
runs on self-hosted Actions, that runner must provide a Docker/Podman daemon.

**Auth secret** — `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`):

- Stored as an **org-level** GitHub Actions secret — this keeps the current **Max-plan** billing
  that the existing loops already use, and gives a single rotation point for all repos.
- Also stored locally in a **gitignored** `.sandcastle/.env` for local runs.
- **Explicitly NOT `ANTHROPIC_API_KEY`** — using an API key would flip every repo onto **metered
  API billing** instead of the Max-plan subscription.

---

## Factory runtime policy

Two org-wide runtime rules apply to every repo's `.sandcastle/` runners: which model each
role runs on, and how much of an agent's context window it may use before handing off.

### Model tiering

Each sandcastle role is pinned to a specific model. Planning and merging are single-shot,
judgment-heavy passes over the whole backlog/branch set and stay on Opus; the
high-iteration, mechanical roles run on Sonnet:

| Role                                    | Model             | Why                                                       |
|------------------------------------------|-------------------|------------------------------------------------------------|
| `planner` (incl. `planner-dry-run`)      | `claude-opus-4-8` | Dependency-graph reasoning over the open backlog; once per cycle. |
| `merger`                                 | `claude-opus-4-8` | Conflict resolution across completed branches; once per cycle.    |
| `implementer`                            | `claude-sonnet-5` | Mechanical, high-iteration (up to 100 iterations) — the bulk of factory spend. |
| `reviewer`                                | `claude-sonnet-5` | Single-pass review against a fixed standards file.                 |
| `open-pr`                                | `claude-sonnet-5` | Mechanical: push the branch, open the PR.                          |
| `push-review` (the review runner's push agent) | `claude-sonnet-5` | Mechanical: push the reviewer's refinement commits back to the PR. |

Match by the role's `name` field in each `.sandcastle/*.ts` runner, not by line number or
file — the same role name gets the same model everywhere it appears.

This mirrors the org's general model-routing guidance for operator work:

- **Claude Opus 4.8** — diagnosis, architecture, and pilots (one-shot, judgment-heavy work).
- **Claude Sonnet 5** — mechanical implementation and reconnaissance (the bulk of iteration volume).
- **Claude Haiku 4.5** — trivial, high-fan-out work only.
- **Claude Fable 5** — reserved for the hardest, longest-horizon work only.

### Context ceiling (~60%)

No sandcastle agent should run its context window past ~60% before handing off to a fresh
agent. This is enforced two ways:

1. **Slice tickets small.** Issues fed to the `implementer` role must be scoped so a single
   run stays comfortably under the ceiling. Oversized work is split into follow-up issues
   **before** dispatch — not discovered mid-run.
2. **Agents self-hand-off.** `implement-prompt.md` and `review-prompt.md` both instruct the
   agent: on approaching ~60% context, write a structured handoff note (current state +
   remaining steps) to `.sandcastle/logs/handoff-<task-id>.md` and end the turn, so a fresh
   agent continues rather than degrading mid-task.

---

## Label reconciliation (old loops → sandcastle)

The new sandcastle triggers **replace** the old backlog-loop triggers; the triage vocabulary is
kept. Because the old and new triggers are **disjoint labels**, a given issue fires exactly one
engine — so old and new can coexist safely during the per-repo rollout with no double-execution.

| Old (retire *with* the loops)      | New (sandcastle)      | Notes                                                                                   |
|------------------------------------|-----------------------|-----------------------------------------------------------------------------------------|
| `agent:ready` → issue-executor     | **`agent:implement`** | Same meaning ("an agent should build this"); collapse — one label means cleared *and* go. |
| `review-round:1–4` → pr-reviewer   | **`agent:review`**    | Review is one labeled action, not a 4-round loop.                                        |
| `agent:split` → issue-decomposer   | *(no label)*          | Decomposition moves to the smart zone (`/to-tickets`, human-in-loop).                    |

**Kept unchanged** (triage state, orthogonal to which engine runs):
`risk:*`, `needs:human`, `epic`, `factory`, `tracking`.

---

## Trigger-label spec (every repo copies these)

These two labels drive the sandcastle runners and must be created identically in every factory
repo. The label→runner is a GitHub Action (`.github/workflows/agent-*.yml`), **not** part of
`.sandcastle/`, and its guards refuse sub-issues and PRD-shaped parents.

| Label             | Color     | Meaning                                                                                              |
|-------------------|-----------|------------------------------------------------------------------------------------------------------|
| `agent:implement` | `#1D76DB` | An agent should build this. Fires the sandcastle **implement** runner (`agent-implement.yml`).        |
| `agent:review`    | `#B392F0` | One labeled review action over a PR — the single-pass replacement for the old 4-round `review-round:*` loop. Fires the **review** runner (`agent-review.yml`). |

Color rationale: `agent:implement` reuses the blue (`#1D76DB`) of the label it replaces
(`agent:ready`), keeping the "agent trigger" identity. `agent:review` takes a distinct light
purple (`#B392F0`) so the two triggers are visually separable at a glance. *(Both hexes are
proposals for the first repo to lock in — see the note at the bottom.)*

---

## Canonical upstreams

Track upstream. The `ALLiDoizCode/*` forks are **break-glass mirrors only** — publish from them
if upstream vanishes; **no local patches** live there, so there is no drift to reconcile.

- **Engine (dumb zone):** [`@ai-hero/sandcastle`](https://www.npmjs.com/package/@ai-hero/sandcastle)
  · repo [github.com/mattpocock/sandcastle](https://github.com/mattpocock/sandcastle) —
  currently **v0.12.0 (pre-1.0, single-maintainer)**.
- **Skills (smart zone):** [`mattpocock/skills`](https://github.com/mattpocock/skills) —
  installed as a Claude Code plugin
  (`/plugin marketplace add mattpocock/skills` → `/plugin install mattpocock-skills@mattpocock`),
  or via skills.sh copy-in (`npx skills@latest add mattpocock/skills`).

Engine mechanics, the per-repo recipe, and known gotchas: [docs/factory-engine-notes.md](docs/factory-engine-notes.md).

---

## Per-repo factory table

The **8 going-forward repos** — the org's live, actively-worked set. A row qualifies as
**live** once its image builds, its dry-run `plan` resolves, and — for the repos named as
variant proofs below — a real `agent:implement` PR has merged. The plain pnpm repetitions
(rig/toon/swap/toon-client) qualify on image-build + plan alone; they don't each need a
separate merged-PR proof once the pnpm recipe is proven once (relay).

| Repo        | Pkg mgr | Template | Gate (lint/typecheck/test/build) | Status | Merged-PR proof | Notes |
|-------------|---------|----------|----------------------------------|--------|-----------------|-------|
| relay       | pnpm | `parallel-planner-with-review` | eslint / typecheck / vitest / build | Live — scaffolded, image builds, dry-run plan proven, **merged agent PR** | [relay#70](https://github.com/toon-protocol/relay/pull/70) (merged) | Pilot / gold reference for the whole pnpm recipe; hard checkpoint — no other repo started until this went green. Old 4 loops now **RETIRED** ([relay#71](https://github.com/toon-protocol/relay/pull/71), closes toon-meta#185). |
| toon-client | pnpm | `parallel-planner-with-review` | eslint / typecheck / vitest / build | Live — scaffolded, image builds, dry-run plan proven (pnpm repetition; no merged-PR proof required) | — | Largest repo (6 packages); proves the pattern scales. `pnpm-lock.yaml` is `lockfileVersion 9` but `packageManager` pins `pnpm@8.15.9` (frozen install impossible) — tracked in [toon-client#425](https://github.com/toon-protocol/toon-client/issues/425); runners use `--no-frozen-lockfile` (matches existing `ci.yml`). Typecheck debt 82 errors (76 in `rig-web`, excluded from root `tsconfig.json`) is soft-gated pending follow-up. |
| rig         | pnpm | `parallel-planner-with-review` | eslint / typecheck / vitest / build | Live — scaffolded, image builds, dry-run plan proven (pnpm repetition; no merged-PR proof required) | — | Standalone repo since the 2026-07-21 extraction from toon-client; **never had the old 4-loop backlog system** (no `backlog-manager.yml` in its history) — nothing to retire here. |
| store       | pnpm | `parallel-planner-with-review` | typecheck / vitest / esbuild (**no lint** — no eslint config) | Live — scaffolded, image builds, dry-run plan proven, **merged agent PR** | [store#52](https://github.com/toon-protocol/store/pull/52) (merged) | Lint-less pnpm + esbuild variant — first "exotic" gate shape. Build is `node esbuild.config.mjs`, not `pnpm -r run build`. 0 pre-existing typecheck debt. |
| connector   | npm workspaces | `parallel-planner-with-review` | `npm run lint/typecheck/test --workspaces --if-present` + hand-ordered `build` (`shared` → `mina-zkapp` → `--workspaces --if-present`) | Live — scaffolded, image builds, dry-run plan proven, **merged agent PR** | [connector#394](https://github.com/toon-protocol/connector/pull/394) (merged) | npm-workspaces + mina-zkapp variant, done last (most exotic). Sole repo with no root `"type": "module"` → tsx transpiles `.sandcastle/*.ts` to CJS, which broke on top-level `await` (fixed connector#392, `main()` wrapper) and then on `require()`-ing the ESM-only engine (fixed connector#393, nested `.sandcastle/package.json` = `{"type":"module"}` scopes just the runner dir). `npm ci` (no corepack); native deps (o1js/libsql/bigint-buffer) build clean in `node:22-bookworm` with zero apt additions. 0 typecheck debt. |
| toon        | pnpm | `parallel-planner-with-review` | eslint / typecheck / vitest / build | Live — scaffolded, image builds, dry-run plan proven (pnpm repetition; no merged-PR proof required) | — | Lint budget tightened as part of scaffolding: gate line is `eslint . --max-warnings 940` (down from the pre-existing 941-warning baseline), so the gate isn't a rubber stamp. Pre-existing typecheck debt carries an explicit caveat in the implement/review/merge prompts. |
| swap        | pnpm | `parallel-planner-with-review` | eslint / typecheck / vitest / build | Live — scaffolded, image builds, dry-run plan proven (pnpm repetition; no merged-PR proof required) | — | Applied the proven pnpm recipe verbatim; no repo-specific deviations surfaced. |
| toon-meta   | npm (docs) | `parallel-planner-with-review` | markdownlint / link-check / JSON-validate (`npm run gate`) | Live — scaffolded, gate proven, **merged agent PR** | [toon-meta#201](https://github.com/toon-protocol/toon-meta/pull/201) (merged) | Docs factory, sequenced last; no `package.json` before scaffolding. Markdownlint baseline is real-but-lenient (`.markdownlint-cli2.jsonc`) — ~40 structural rules enforced, noisy stylistic rules disabled by policy pending a cleanup slice. |

**Out of scope — being archived:** `swarm` and `capability-market`. Both are active on GitHub
but ~18 days cold and not part of the going-forward set; they are being archived (`gh repo
archive`) rather than given a factory. Already-archived repos (`hub`, `town`, `Town-Frontend`)
are ignored.

---

## Kept workflows (not retired)

As each repo's old 4-loop backlog system (`backlog-manager.yml`, `issue-executor.yml`,
`pr-reviewer.yml`, `issue-decomposer.yml`) is retired, the following are **kept** and remain in
force: `ci.yml`, `release.yml`, `e2e.yml`, `journey.yml`, `deploy-*.yml`, and image-publish
workflows — plus the new `agent-image.yml` / `agent-implement.yml` / `agent-review.yml`
sandcastle runners themselves. Anything intentionally kept beyond this list should be noted in
the relevant repo row above with the reason.

---

## Old-loop retirement status

Per-repo retirement PRs (deleting `backlog-manager.yml` / `issue-executor.yml` /
`pr-reviewer.yml` / `issue-decomposer.yml`) are gated on that repo first landing a **merged**
`agent:implement` PR — the same hard-checkpoint rule relay's retirement (relay#71) followed.
Verified directly against each repo's `.github/workflows/` on its default branch:

| Repo        | Old loops                       | Retirement PR |
|-------------|----------------------------------|----------------|
| relay       | **RETIRED**                      | [relay#71](https://github.com/toon-protocol/relay/pull/71) (merged), closes toon-meta#185 |
| toon-client | Still present                    | Queued — pending this repo's retirement PR |
| rig         | **N/A** — never had the old loops (standalone repo since the 2026-07-21 toon-client extraction; no `backlog-manager.yml` in its commit history) | None needed |
| store       | Still present                    | Queued — pending this repo's retirement PR |
| connector   | Still present                    | Queued — pending this repo's retirement PR |
| toon        | Still present                    | Queued — pending this repo's retirement PR |
| swap        | Still present                    | Queued — pending this repo's retirement PR |
| toon-meta   | Still present                    | Queued — pending this repo's retirement PR |

Old and new triggers stay on disjoint labels (see [Label reconciliation](#label-reconciliation-old-loops--sandcastle)
above) for exactly this reason: coexistence during rollout is safe, so retirement can be
sequenced per-repo without risking double-execution in the interim.

**KEEP list** (per the epic, unaffected by any per-repo retirement): `ci.yml`, `release.yml`,
`e2e.yml`, `journey.yml`, `deploy-*.yml`, image-publish workflows, and the `agent-image.yml` /
`agent-implement.yml` / `agent-review.yml` sandcastle runners. Only the four named old-loop
files are ever removed by a retirement PR.

---

## Straggler-sweep checklist

Epic #178's end-of-epic audit (toon-meta#193). **Not run yet** — per-repo retirement PRs are
still queued for 6 of the 8 repos (see the table above), and #193 stays open until this sweep
actually happens. Recorded here so the final closeout has a fixed checklist instead of
re-deriving scope from scratch:

- [ ] **Old-loop files gone from all 8 repos.** For the 6 repos still "Still present" above,
  confirm their retirement PR merged and `backlog-manager.yml` / `issue-executor.yml` /
  `pr-reviewer.yml` / `issue-decomposer.yml` are actually gone from `.github/workflows/` on the
  default branch (not just closed-PR intent) — rig needs no check (never had them); relay is
  already confirmed retired.
- [ ] **Unused `REVIEWER_TOKEN`-style secrets.** The old loops used their own review-bot
  token(s) distinct from `CLAUDE_CODE_OAUTH_TOKEN`; once a repo's old loops are gone, check
  org- and repo-level secrets for any now-orphaned token and revoke/remove it.
- [ ] **Stale coexistence comments.** The old/new disjoint-label coexistence note (this doc's
  [Label reconciliation](#label-reconciliation-old-loops--sandcastle) section, plus any
  per-repo README/runbook callouts) is only true *during* rollout — once a repo retires its old
  loops, sweep for and remove that repo's now-stale "old and new coexist" language.
- [ ] **`swarm` / `capability-market` archival** actually completed (`gh repo archive`), not
  just intended — these are out-of-scope-not-factored, tracked separately from the 8-repo set
  above.

---

> **Proposed values pending first-repo lock-in:** the two trigger-label hex colors
> (`agent:implement` = `#1D76DB`, `agent:review` = `#B392F0`) are proposals. The relay pilot is
> the place to confirm them before they're copied across all 8 repos.
