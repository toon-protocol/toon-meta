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

Each sandcastle role is pinned to a specific model. The judgment-heavy, single-pass roles run
on Opus; the one high-iteration mechanical role runs on Sonnet:

| Role                                | Model             | Why                                                       |
|-------------------------------------|-------------------|------------------------------------------------------------|
| `planner` (incl. `planner-dry-run`) | `claude-opus-5`   | Dependency-graph reasoning over the open backlog; once per cycle. |
| `merger`                            | `claude-opus-5`   | Conflict resolution across completed branches; once per cycle.    |
| `reviewer`                          | `claude-opus-5`   | Single pass, one iteration — the last judgement on the PR. Reviews against the target issue's acceptance criteria and must emit a structured `<review>` verdict (`clean`/`blocking`); a malformed verdict fails the run (#275). The verdict is then submitted formally as factory-ops: clean → `APPROVED`, blocking → `CHANGES_REQUESTED` + `needs:human` (#282 — see "What a factory-ops approval attests"). |
| `implementer`                       | `claude-sonnet-5` | Mechanical, high-iteration (up to 100 iterations) — the bulk of factory spend. |

Match by the role's `name` field in each `.sandcastle/*.ts` runner, not by line number or
file — the same role name gets the same model everywhere it appears. Note `reviewer` and
`implementer` previously shared `claude-sonnet-5`, so a blind find-and-replace on the model
string will move the implementer too; change the reviewer's line specifically.

**Push and PR-create take no model at all.** Earlier revisions of this table listed `open-pr`
and `push-review` roles on Sonnet. Both were deleted when those steps became deterministic
`execFileSync` calls in the runners — the fix for a silent-push failure where an agent reported
success without pushing and only 4 of 19 PRs landed. Pure plumbing with no judgement to make
does not get an agent.

This mirrors the org's general model-routing guidance for operator work:

- **Claude Opus 5** — diagnosis, architecture, review, and pilots (one-shot, judgment-heavy work).
- **Claude Sonnet 5** — mechanical implementation and reconnaissance (the bulk of iteration volume).
- **Claude Haiku 4.5** — trivial, high-fan-out work only.
- **Claude Fable 5** — reserved for the hardest, longest-horizon work only.

### Context budget (~200k cap)

Every sandcastle agent operates as if its context is capped at **~200k tokens**, regardless of
the model's actual window — the org-wide policy in [CLAUDE.md](CLAUDE.md) → *Context budget
policy*. ~200k is a hard ceiling, not a target.

The thresholds are stated in **absolute tokens, not as a percentage of the window**: a
percentage means different things on a 200k model and a 1M model, and the point of the policy is
that agents converge on the same working size whatever they run on.

| Threshold       | Value  | Meaning                                              |
|-----------------|--------|------------------------------------------------------|
| Ceiling         | ~200k  | Never run past this. Plan no task that assumes more. |
| Hand off by     | ~160k  | Terminal — the handoff must be written by here.      |
| Start preparing | ~120k  | Begin writing the handoff while there is still room. |

This is enforced two ways:

1. **Slice tickets small.** Issues fed to the `implementer` role must be scoped so a single
   run — including reading, tool output, and iteration, not just the final diff — stays
   comfortably under the ceiling. Oversized work is split into follow-up issues **before**
   dispatch, not discovered mid-run.
2. **Agents self-hand-off.** `implement-prompt.md` and `review-prompt.md` both instruct the
   agent to write a structured handoff note (goal + remaining work as a task list; what was
   done and where; key decisions and why; exact paths/line numbers) to
   `.sandcastle/logs/handoff-<task-id>.md`, **commit it on the branch**, and end the turn, so a
   fresh agent continues rather than degrading mid-task. Committing is load-bearing:
   `.sandcastle/.gitignore` ignores `logs/`, and the sandbox is destroyed when the run ends, so
   an uncommitted note is lost.

Handoffs are recursive: a successor agent that approaches its own ceiling follows the same rule.

---

## Label reconciliation (old loops → sandcastle)

The new sandcastle triggers **replace** the old backlog-loop triggers; the triage vocabulary is
kept. Because the old and new triggers were **disjoint labels**, a given issue fired exactly one
engine — so old and new coexisted safely during the per-repo rollout with no double-execution.
That rollout is now complete (see [Old-loop retirement status](#old-loop-retirement-status)) —
the disjoint-label design is recorded here as the historical reason coexistence was safe, not as
a description of current state.

| Old (retire *with* the loops)      | New (sandcastle)      | Notes                                                                                   |
|------------------------------------|-----------------------|-----------------------------------------------------------------------------------------|
| `agent:ready` → issue-executor     | **`agent:implement`** | Same meaning ("an agent should build this"); collapse — one label means cleared *and* go. |
| `review-round:1–4` → pr-reviewer   | **`agent:review`**    | Review is one labeled action, not a 4-round loop.                                        |
| `agent:split` → issue-decomposer   | *(no label)*          | Decomposition moves to the smart zone (`/to-tickets`, human-in-loop).                    |

**Kept unchanged** (triage state, orthogonal to which engine runs):
`risk:*`, `needs:human`, `epic`, `factory`, `tracking`.

---

## Trigger-label spec (every repo copies these)

These labels drive the sandcastle runners and must be created identically in every factory
repo (`agent:fix` excepted for now — see the color-rationale note below). The label→runner is a GitHub Action (`.github/workflows/agent-*.yml`), **not** part of
`.sandcastle/`, and its guards refuse sub-issues and PRD-shaped parents.

| Label             | Color     | Meaning                                                                                              |
|-------------------|-----------|------------------------------------------------------------------------------------------------------|
| `agent:implement` | `#1D76DB` | An agent should build this. Fires the sandcastle **implement** runner (`agent-implement.yml`).        |
| `agent:review`    | `#B392F0` | One labeled review action over a PR — the single-pass replacement for the old 4-round `review-round:*` loop. Fires the **review** runner (`agent-review.yml`); removed once the verdict is submitted (see [What a factory-ops approval attests](#what-a-factory-ops-approval-attests)) — a PR carrying it means a review is genuinely pending or in flight. |
| `agent:fix`       | `#1D76DB` | A red PR whose only blocker(s) are failing checks and/or a merge conflict should be repaired ([#357](https://github.com/toon-protocol/toon-meta/issues/357)). Decided by `automerge-evaluator.mjs`'s `repair` verdict, applied by `auto-merge.mjs` under `REPAIR_APPLY`. Fires the **fix** runner (`agent-fix.yml`); removed unconditionally when the run finishes (see [PR repair pass (#357)](#pr-repair-pass-357)) — a PR carrying it means a repair is genuinely in flight. |

Color rationale: `agent:implement` reuses the blue (`#1D76DB`) of the label it replaces
(`agent:ready`), keeping the "agent trigger" identity; `agent:fix` shares the same blue — it is
the same "an agent should push commits here" trigger shape as `agent:implement`, just scoped to an
existing PR instead of a fresh issue. `agent:review` takes a distinct light purple (`#B392F0`) so
the review trigger is visually separable from the two dispatch-shaped triggers. *(No longer
proposals — verified identical in every factory repo; see the note at the bottom. `agent:fix` is
new in toon-meta only as of [#357](https://github.com/toon-protocol/toon-meta/issues/357) — not
yet fanned out to the other ten repos, see that section's "Not yet done".)*

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

The **10 going-forward repos** — the org's live, actively-worked set, including `fractal`
(bootstrapped 2026-07-24 from founding spec
[toon-meta#245](https://github.com/toon-protocol/toon-meta/issues/245)) and `buzz`
(registered 2026-08-01 per [toon-meta#257](https://github.com/toon-protocol/toon-meta/issues/257),
part of the migration epic [toon-meta#256](https://github.com/toon-protocol/toon-meta/issues/256);
the org's fork of `block/buzz`) — **plus Forge**
(the factory manager, itself a factory consumer; see its note below). A row qualifies as
**live** once its image builds, its dry-run `plan` resolves, and — for the repos named as
variant proofs below — a real `agent:implement` PR has merged. The plain pnpm repetitions
(rig/toon/swap/toon-client) qualify on image-build + plan alone; they don't each need a
separate merged-PR proof once the pnpm recipe is proven once (relay). `buzz` is a **new
variant** (first polyglot cargo + pnpm gate), so — like the other variant rows — it needs its
own merged `agent:implement` PR before it counts as live. Forge's
**stage-0** factory (raw `@ai-hero/sandcastle`) is now proven — two `agent:implement`
issues built agent PRs that merged ([Forge#20](https://github.com/toon-protocol/Forge/pull/20),
[Forge#21](https://github.com/toon-protocol/Forge/pull/21)). It is **not yet self-hosted**:
the self-host checkpoint ([Forge#15](https://github.com/toon-protocol/Forge/issues/15)) swaps
the engine to `forge-core` and requires ≥1 `agent:implement` PR to merge *under the forge-core
factory* — that swap is still pending, so steady-state Forge does not yet run its own engine.

| Repo        | Pkg mgr | Template | Gate (lint/typecheck/test/build) | Status | Merged-PR proof | Notes |
|-------------|---------|----------|----------------------------------|--------|-----------------|-------|
| relay       | pnpm | `parallel-planner-with-review` | eslint / typecheck / vitest / build | Live — scaffolded, image builds, dry-run plan proven, **merged agent PR** | [relay#70](https://github.com/toon-protocol/relay/pull/70) (merged) | Pilot / gold reference for the whole pnpm recipe; hard checkpoint — no other repo started until this went green. Old 4 loops now **RETIRED** ([relay#71](https://github.com/toon-protocol/relay/pull/71), closes toon-meta#185). |
| toon-client | pnpm | `parallel-planner-with-review` | eslint / typecheck / vitest / build | Live — scaffolded, image builds, dry-run plan proven (pnpm repetition; no merged-PR proof required) | — | Largest repo (6 packages); proves the pattern scales. `pnpm-lock.yaml` is `lockfileVersion 9` but `packageManager` pins `pnpm@8.15.9` (frozen install impossible) — tracked in [toon-client#425](https://github.com/toon-protocol/toon-client/issues/425); runners use `--no-frozen-lockfile` (matches existing `ci.yml`). Lint/typecheck debt is no longer soft-gated: since [toon-client#433](https://github.com/toon-protocol/toon-client/issues/433), ci.yml runs eslint (JSON report) + recursive typecheck and `.sandcastle/gate-guard.ts` fails the job on any NEW violation beyond the frozen `.sandcastle/gate-baseline.json` (16 eslint errors / 718 warnings; 75 typecheck errors with per-package caps — 74 in `rig-web`, 1 in `rig`; debt tracked in [toon-client#423](https://github.com/toon-protocol/toon-client/issues/423)). |
| rig         | pnpm | `parallel-planner-with-review` | eslint / typecheck / vitest / build | Live — scaffolded, image builds, dry-run plan proven (pnpm repetition; no merged-PR proof required) | — | Standalone repo since the 2026-07-21 extraction from toon-client; **never had the old 4-loop backlog system** (no `backlog-manager.yml` in its history) — nothing to retire here. |
| store       | pnpm | `parallel-planner-with-review` | eslint (frozen `eslint-suppressions.json` allowlist) / typecheck / vitest / esbuild | Live — scaffolded, image builds, dry-run plan proven, **merged agent PR** | [store#52](https://github.com/toon-protocol/store/pull/52) (merged) | Formerly the lint-less pnpm + esbuild variant; [store#62](https://github.com/toon-protocol/store/pull/62) added `eslint.config.js` (org shared flat config) with the pre-existing violations frozen in `eslint-suppressions.json` via ESLint native bulk-suppressions, and ci.yml's `build` job now runs `pnpm lint` in its parallel gate — any NEW violation fails. Build is `node esbuild.config.mjs`, not `pnpm -r run build`. 0 pre-existing typecheck debt. |
| connector   | npm workspaces | `parallel-planner-with-review` | `npm run lint/typecheck/test --workspaces --if-present` + hand-ordered `build` (`shared` → `mina-zkapp` → `--workspaces --if-present`) | Live — scaffolded, image builds, dry-run plan proven, **merged agent PR** | [connector#394](https://github.com/toon-protocol/connector/pull/394) (merged) | npm-workspaces + mina-zkapp variant, done last (most exotic). Sole repo with no root `"type": "module"` → tsx transpiles `.sandcastle/*.ts` to CJS, which broke on top-level `await` (fixed connector#392, `main()` wrapper) and then on `require()`-ing the ESM-only engine (fixed connector#393, nested `.sandcastle/package.json` = `{"type":"module"}` scopes just the runner dir). `npm ci` (no corepack); native deps (o1js/libsql/bigint-buffer) build clean in `node:22-bookworm` with zero apt additions. 0 typecheck debt. |
| toon        | pnpm | `parallel-planner-with-review` | eslint / typecheck / vitest / build | Live — scaffolded, image builds, dry-run plan proven (pnpm repetition; no merged-PR proof required) | — | Lint budget tightened as part of scaffolding: gate line is `eslint . --max-warnings 940` (down from the pre-existing 941-warning baseline), so the gate isn't a rubber stamp. Typecheck debt is PAID: toon#126–#142 ratcheted 246 → 0 and [toon#144](https://github.com/toon-protocol/toon/pull/144) made typecheck a blocking zero-error step in ci.yml (build before typecheck — cross-package imports resolve through built `dist/`). Gate-speed baseline recaptured queue-immune in [toon#152](https://github.com/toon-protocol/toon/pull/152) — see *Gate baselines* below. |
| swap        | pnpm | `parallel-planner-with-review` | eslint / typecheck / vitest / build | Live — scaffolded, image builds, dry-run plan proven (pnpm repetition; no merged-PR proof required) | — | Applied the proven pnpm recipe verbatim; no repo-specific deviations surfaced. |
| toon-meta   | npm (docs) | `parallel-planner-with-review` | markdownlint / link-check / JSON-validate (`npm run gate`) | Live — scaffolded, gate proven, **merged agent PR** | [toon-meta#201](https://github.com/toon-protocol/toon-meta/pull/201) (merged) | Docs factory, sequenced last; no `package.json` before scaffolding. Markdownlint baseline is real-but-lenient (`.markdownlint-cli2.jsonc`) — ~40 structural rules enforced, noisy stylistic rules disabled by policy pending a cleanup slice. |
| Forge       | pnpm | `parallel-planner-with-review` | eslint / typecheck / vitest / build | Live (stage-0) — image builds, dry-run plan proven, **2 merged agent PRs** on raw `@ai-hero/sandcastle`; self-host swap to `forge-core` still pending ([Forge#15](https://github.com/toon-protocol/Forge/issues/15)) | [Forge#20](https://github.com/toon-protocol/Forge/pull/20), [Forge#21](https://github.com/toon-protocol/Forge/pull/21) (merged) — under stage-0 raw sandcastle; the forge-core parity proof is [Forge#15](https://github.com/toon-protocol/Forge/issues/15) | **9th row, hand-added at bootstrap** per [#198](https://github.com/toon-protocol/toon-meta/issues/198). The factory *manager* is itself a factory *consumer*. The **only `forge-core`-driven row** at steady state (raw `@ai-hero/sandcastle` at stage-0, swaps to forge-core at self-host). Holds **zero org state** — a stateless client of this repo. Scaffold [Forge#1](https://github.com/toon-protocol/Forge/pull/1); `FACTORY_SPEC.md` [Forge#2](https://github.com/toon-protocol/Forge/pull/2); stage-0 [Forge#3](https://github.com/toon-protocol/Forge/pull/3). |
| fractal     | pnpm | `parallel-planner-with-review` | eslint / typecheck / vitest / build (+ `format:check`) | Live — scaffolded, image builds, dry-run plan proven (pnpm repetition; no merged-PR proof required) | — | **10th row, hand-added at bootstrap** from founding spec [toon-meta#245](https://github.com/toon-protocol/toon-meta/issues/245) (Fractal — agent-grown dimensions on TOON; seed → spec → ditto loop → NIP gate → relay → portal). `.sandcastle/` is the proven relay/Forge stage-0 recipe (deterministic push+PR, fail-loud verification, sandbox-secrets passthrough) — near-verbatim: `.sandcastle/.gitignore` and `.env.example` are still missing vs the originals ([fractal#15](https://github.com/toon-protocol/fractal/issues/15)), and the bootstrap copy dropped `agent-review.yml`'s whole job body to an over-greedy comment strip (startup_failure, fixed in `f041aec`). Domain glossary lives in-repo (`CONTEXT.md`, migrated from toon-meta `docs/fractal/`). The factory **builds** fractal; it never **runs** dimensions — fractal's own ditto loop closes through the NIP gate, not a CI provider. |
| buzz        | cargo + pnpm (Justfile-driven) | `parallel-planner-with-review` | `just fmt-check` / `just desktop-tauri-fmt-check` / `just clippy` (`-D warnings`) / `just test-unit` (infra-free nextest) / `just desktop-check\|test\|build` / `just web-check\|build` | Live — scaffolded, image builds (local + Actions), in-image gate proven (zero pre-existing debt, no soft-gates), dry-run plan proven, **merged agent PR** (the new-variant proof) | [buzz#65](https://github.com/toon-protocol/buzz/pull/65) (merged 2026-08-03, closes buzz#56 — thread-focus-mode anchor deflake). Scaffold PR [buzz#24](https://github.com/toon-protocol/buzz/pull/24) (merged `52629ee`) was scaffold + stage-A capture-baseline only, not the proof | **11th row** ([#257](https://github.com/toon-protocol/toon-meta/issues/257), epic [#256](https://github.com/toon-protocol/toon-meta/issues/256)); the **only fork row** (fork of `block/buzz`) and first polyglot/Rust variant. 26-member cargo workspace (rust 1.95.0 via `rust-toolchain.toml`; `desktop/src-tauri` excluded from the workspace) + pnpm@11.4.0 workspace (desktop/web/admin-web, node 24.15.0) + Flutter 3.41.7 mobile; toolchains Hermit-pinned (`bin/`); the Justfile is the single gate driver (upstream `ci.yml` = 1085 lines / 20 paths-filtered jobs calling `just` targets). Stage-A capture-baseline **done**: `.sandcastle/gate-baseline.json` (relay#77/store#59 shape) at main@`4d47aa8`; CI-side numbers sampled from upstream `block/buzz` (fork had zero Actions history) and labeled as such; known upstream gap: no admin-web CI job. Documented exclusions (still run in upstream `ci.yml`; KEEP rule — no upstream workflow touched): Flutter/mobile, src-tauri compile-level checks (GTK/WebKit + sidecar stubs), Playwright e2e, Postgres/Redis integration, cargo-deny, cross-compile, signing/canary/release. Engine `@ai-hero/sandcastle@0.12.0` exact pin; nested `.sandcastle/package.json` `{"type":"module"}` (root has no `type` field — connector#392/#393 gotcha preempted); `.sandcastle/.gitignore` + `.env.example` included (fractal#15 gotcha avoided); labels `agent:implement`/`agent:review` created. Dry-run plan proven 2026-08-02 (local run, empty-backlog valid pass; token via the gitignored `.sandcastle/.env`). First live `agent:implement` run (buzz#56) exposed a **scaffold drift**: buzz's `onSandboxReady` hook had `gh auth setup-git` but was missing the org-wide `git config --unset-all 'http.https://github.com/.extraheader'` that every other factory repo pairs with it — actions/checkout persists a read-only-token `AUTHORIZATION` extraheader in the repo-local git config, the engine bind-mounts `.git` into the sandbox, and an explicit header beats the credential helper, so the in-sandbox `git push` was rejected (while in-sandbox `gh` API calls, which read `GH_TOKEN` directly, worked — the fail-loud open-pr verification caught it). Fixed in [buzz#61](https://github.com/toon-protocol/buzz/pull/61), which also ported connector's redact-then-upload agent-log artifact steps (buzz previously uploaded no agent logs, making the first failure undiagnosable; redaction gained an `nsec1…` Nostr-key pattern). Retry then produced the merged proof PR buzz#65. Fork noise: `docker.yml` jobs fail on the fork with ghcr `permission_denied` (App installation exists only on `block/buzz`) — pre-existing, may warrant gating off later. |

**Forge (9th — [#198](https://github.com/toon-protocol/toon-meta/issues/198)):** the
factory *manager* is itself a factory *consumer* — it runs its own `.sandcastle/` like every
other repo. Its row is **hand-added to this table at bootstrap** (when its stage-0 factory is
scaffolded), not withheld for self-registration — a running-but-unregistered factory would make
this registry lie by omission. Forge is unique in two ways: it is the **only `forge-core`-driven
row** (all others run raw `@ai-hero/sandcastle`), and its factory ships as **two stories at
opposite ends of #198** — an early hand-rolled stage-0 gate (raw sandcastle, relay recipe) that
*blocks* forge-core, and a late `forge new` self-stamp that swaps the engine to forge-core and
reaches **green (behavioral, not byte) parity** — the self-host checkpoint, distinct from and
additional to the external relay re-stamp. See `context/decisions.md` → *Software factory
(Forge)*.

**Out of scope — being archived:** `swarm` and `capability-market`. Both are active on GitHub
but ~18 days cold and not part of the going-forward set; they are being archived (`gh repo
archive`) rather than given a factory. Already-archived repos (`hub`, `town`, `Town-Frontend`)
are ignored.

### Gate baselines

Per [ADR-0001](docs/adr/0001-gate-priority-and-baseline-freeze.md), each repo's
`.sandcastle/gate-baseline.json` is the per-repo source of truth for its frozen gate numbers;
this registry carries only a read-only account of them.

**Lesson — binding on every future baseline capture: a gate-speed metric must measure work,
not elapsed wall-clock.** toon's original gated speed figure,
`averageTotalRunDurationSeconds` (112), measured the run's wall-clock *span* (max job
`completed_at` − min job `started_at`) and so absorbed runner queue depth: under a saturated
runner pool it false-FAILed the guard — [toon#150](https://github.com/toon-protocol/toon/issues/150)
measured a 402.0s span for 147.0s of actual compute — failing on CI queue depth rather than on
the change, a false FAIL by CONTEXT.md's own gate-correctness definition.
[toon#152](https://github.com/toon-protocol/toon/pull/152) (fixing
[toon#151](https://github.com/toon-protocol/toon/issues/151)) reshaped toon's baseline:

- The gated metric is now `averageLongestJobDurationSeconds` (106.6): the gated jobs run in
  parallel, so on a free runner pool the longest job IS the run's wall-clock — and unlike the
  raw span it cannot be inflated by queueing.
- `sampleRuns` entries renamed: `totalRunDurationSeconds` → `longestJobSeconds` +
  `sumRunnerSeconds`, plus informational, ungated `totalRunSpanSeconds` and `queueSeconds`.

**toon-meta's own baseline** gates `docGateJobWallClockSeconds` (13). Decision (2026-08-05,
[#273](https://github.com/toon-protocol/toon-meta/issues/273)): it stays as-is. It measures a
single job's execution window — queue time sits before a job's `started_at`, so a job
wall-clock does not absorb queue depth the way toon's run *span* did — and with exactly one
gated job, "longest job" and "job wall-clock" are the same number, so the toon#152 rename
would change nothing today. It is still elapsed time rather than pure work (it inherits
in-job variance: checkout, setup-node, `npm ci`), so if the doc gate ever splits into
parallel jobs or starts false-FAILing under runner contention, recapture it the toon#152 way
(gate on the longest job's measured work) rather than widening the guard's tolerance.

---

## Archetype catalog

Landed by [#207](https://github.com/toon-protocol/toon-meta/issues/207) (epic
[#198](https://github.com/toon-protocol/toon-meta/issues/198)). This section is not decoration —
`forge new` and `forge validate` **parse it**:
[`packages/forge-cli/src/new.ts`](https://github.com/toon-protocol/Forge/blob/main/packages/forge-cli/src/new.ts)
→ `parseArchetypeCatalog()` reads the first markdown pipe table in this file whose header row
has one cell reading exactly *archetype* and another reading exactly *status* (compared
lower-cased, after trimming), and treats cells 1/2/3 as `name` / `environment` / `status`. A
status of exactly `minted` (case-insensitive) marks the row minted; anything else is unminted,
and naming an unminted archetype in a `factory.toml` fails validation
([FACTORY_SPEC.md §2.1](https://github.com/toon-protocol/Forge/blob/main/FACTORY_SPEC.md#21-archetype-provenance),
§8 rule 4). Getting the table shape wrong silently breaks `forge new` — so keep those two header
cells verbatim (renaming one to, say, *Archetype name* stops the table being found at all), and
keep this the **only** table anywhere in this document whose header carries both.

Per [ADR-0002](docs/adr/0002-registry-is-sole-mint-authority.md), **this registry is the sole
authority on whether an archetype exists.** Archetype bundles under
[Forge's `templates/archetypes/`](https://github.com/toon-protocol/Forge/tree/main/templates/archetypes)
describe the *opinion* (environment × doctrine × oracle-skeleton); they never record mint status
— `status`/`minted`/`proving_repo` were dropped from `archetype.toml` by ADR-0002 specifically so
this table is the only place existence is decided.

Cells below are the literal strings `parseArchetypeCatalog()` reads — plain, no backticks or
other markup, so `forge new <archetype>` matches its argument against the name cell exactly, and
a future promotion is read as the exact status `minted`:

| Archetype | Environment    | Status           | Minted by | Notes |
|-----------|----------------|------------------|-----------|-------|
| game      | bevy-spacetime | mint-after-pilot | —         | No game repo exists — nothing has run the bundle's `factory.toml.example`, so there is no pilot to point at. |
| service   | node-pnpm      | mint-after-pilot | —         | relay's merged agent PRs (relay#70/#77/#81) predate the bundle and ran a hand-rolled `.sandcastle/` — they justify the pin, they are not the pilot. |
| spa       | node-pnpm      | mint-after-pilot | —         | No bundle exists yet, and the proving repo is undecided between toon-client and rig — see below. |

**The mint-after-pilot law.** An archetype exists only after **≥1 merged `agent:implement` PR
has run its own `factory.toml.example` end to end**
([FACTORY_SPEC.md §2.1](https://github.com/toon-protocol/Forge/blob/main/FACTORY_SPEC.md#21-archetype-provenance)).
No row above is minted: Forge itself is not yet self-hosted
([Forge#15](https://github.com/toon-protocol/Forge/issues/15)), so no repo anywhere has been
stamped by `forge new`, and relay's pre-bundle PRs prove the `service` pin, not a `service`
pilot. Promoting a row to `minted` is a later **one-cell edit**, gated on that pilot merging — not
part of this section landing.

**Bundle before mint.** Per ADR-0002, a stampable bundle under `templates/archetypes/<name>/`
lands in Forge *before* its row here flips to `minted` — the registry must never claim an
archetype exists that `forge new` cannot actually stamp.

**Alternate opinions are new archetypes, not flags.** There is no `[factory.options]` table for
swapping a pinned choice inside an archetype; a divergent opinion mints as a **different**
archetype (e.g. a proven Rapier-both-sides game variant becomes `game-dynamics`, never a
`--rapier` flag on `game`).

### `game` — `bevy-spacetime`

Bevy client + SpacetimeDB module on the pinned game stack (Bevy 0.19.x, `bevy_stdb`, Avian hybrid
physics with the ball-rule escalation path). Doctrine and oracle ladder are pinned in
[Forge's `game` bundle](https://github.com/toon-protocol/Forge/tree/main/templates/archetypes/game)
(`DOCTRINE.md`, `factory.toml.example`): reducer/replay determinism, GPU-tolerance-not-hash for
rendering, ECS architecture guidance. Oracle ladder: `t0-fmt-lint` / `t1-build` /
`t2-unit-test` / `t3-sim-replay-golden` / `t4-visual-parity`. No game repo exists yet, so `game`
has no pilot.

### `service` — `node-pnpm`

Payment-fronted node service on the pinned `node-pnpm` stack, pinned by
[Forge's `service` bundle](https://github.com/toon-protocol/Forge/tree/main/templates/archetypes/service)
from **relay's real tree** — not from this ticket's original aspiration. Doctrine covers
devbox-as-load-bearing and deterministic, post-merge image publish. Oracle ladder: `t0-lint` /
`t1-typecheck` / `t2-test` / `t3-build` / `t4-devbox-validate`. relay carries **no** `e2e.yml`,
**no** `journey.yml` and **no** `deploy-*.yml` — what relay *does* carry beyond the base ladder
(changesets `release.yml`, GHCR image-publish workflows, a `deploy/` bundle) is pinned as
doctrine, not stamped as workflow files. relay is the repo the opinion was pinned **from**; no
repo has yet been stamped **from** the bundle, so `service` has no pilot either.

### `spa` — `node-pnpm`

Browser build published to GitHub Pages: the base `node-pnpm` oracle ladder plus a Pages-deploy
oracle and a visual/e2e gate on top. **No bundle has been authored for `spa`**; this row records
the definition only, not a stampable opinion.

`spa`'s pilot repo is genuinely unsettled. The Pages/e2e oracle that motivates `spa` lives in
**toon-client** (`.github/workflows/deploy-rig-web.yml`, plus `e2e.yml` / `journey.yml`), but
`rig-web` was extracted to the **rig** repo (`packages/rig-web`) on 2026-07-21, and rig's
`ci.yml` has neither a Pages deploy nor a Playwright/visual job. The shape is real; which repo
proves it is not yet decided. Authoring the `spa` bundle is separate follow-up work, gated on
that decision.

### The library / one-off path (`--blank`)

Pure libraries and one-offs — `toon` (core + sdk), Forge itself — use `forge new --blank` with
the `node-pnpm` environment and mint **no** archetype. `--blank` is the escape hatch: no
archetype opinions apply, and `factory.archetype = "blank"` is always valid regardless of what is
or isn't minted above.

**Why no `node-lib` archetype.** A bare-library archetype would be the `node-pnpm` environment
plus nothing — no doctrine beyond "it's a library" and no oracle ladder beyond
eslint/typecheck/vitest/build/changesets, which every plain node repo already runs without an
archetype's help. There is no opinion left to pin once the environment is named, so minting one
would add a registry row with no content. `--blank` + `node-pnpm` is the accurate, permanent
description of this shape, not a placeholder for a future archetype.

**`connector` stays `--blank` for a different reason: it is `npm-workspaces`, not `node-pnpm`.**
That is an alternate environment, not a missing flag — per the rule above, a divergent opinion
mints as a **different** archetype, never a `[factory.options]` toggle on `service`. No such
archetype has been proposed or pinned, so connector runs `--blank` today.

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
`pr-reviewer.yml` / `issue-decomposer.yml`) were gated on that repo first landing a **merged**
`agent:implement` PR — the same hard-checkpoint rule relay's retirement (relay#71) followed.
Verified directly against each repo's `.github/workflows/` on its default branch —
**all 8 repos are now retired**:

| Repo        | Old loops                       | Retirement PR |
|-------------|----------------------------------|----------------|
| relay       | **RETIRED**                      | [relay#71](https://github.com/toon-protocol/relay/pull/71) (merged), closes toon-meta#185 |
| toon-client | **RETIRED**                      | [toon-client#430](https://github.com/toon-protocol/toon-client/pull/430) (merged) |
| rig         | **N/A** — never had the old loops (standalone repo since the 2026-07-21 toon-client extraction; no `backlog-manager.yml` in its commit history) | None needed |
| store       | **RETIRED**                      | [store#55](https://github.com/toon-protocol/store/pull/55) (merged), closes toon-meta#190 |
| connector   | **RETIRED**                      | [connector#396](https://github.com/toon-protocol/connector/pull/396) (merged), closes toon-meta#191 |
| toon        | **RETIRED**                      | [toon#114](https://github.com/toon-protocol/toon/pull/114) (merged) |
| swap        | **RETIRED**                      | [swap#73](https://github.com/toon-protocol/swap/pull/73) (merged) |
| toon-meta   | **RETIRED**                      | [toon-meta#206](https://github.com/toon-protocol/toon-meta/pull/206) (merged), closes toon-meta#192 |

Old and new triggers stayed on disjoint labels (see [Label reconciliation](#label-reconciliation-old-loops--sandcastle)
above) for exactly this reason: coexistence during rollout was safe, so retirement could be
sequenced per-repo without risking double-execution in the interim. That rollout is now
complete — the coexistence window is historical, not current state.

**KEEP list** (per the epic, unaffected by any per-repo retirement): `ci.yml`, `release.yml`,
`e2e.yml`, `journey.yml`, `deploy-*.yml`, image-publish workflows, and the `agent-image.yml` /
`agent-implement.yml` / `agent-review.yml` sandcastle runners. Only the four named old-loop
files are ever removed by a retirement PR.

---

## Straggler-sweep checklist

Epic #178's end-of-epic audit (toon-meta#193). Recorded here so the final closeout has a fixed
checklist instead of re-deriving scope from scratch. Status as of the toon-meta#193
straggler-sweep PR:

- [x] **Old-loop files gone from all 8 repos.** Confirmed directly against each repo's
  `.github/workflows/` on its default branch (via `gh api .../contents/.github/workflows`):
  relay, toon-client, store, connector, toon, swap, and toon-meta are all **RETIRED**; rig
  never had them (N/A). See the retirement-status table above for the merged PR per repo.
- [x] **toon-meta's shared old-loop assets removed.** With every consuming repo retired,
  toon-meta's own hosted definitions (`skills/backlog-manager/`, `skills/issue-executor/`,
  `skills/issue-decomposer/`, `templates/agent-loops/*`) had no remaining consumer and were
  deleted in the toon-meta#193 straggler-sweep PR. `.claude-plugin/plugin.json`'s description
  and keyword list were updated to drop the retired skills; `.claude-plugin/marketplace.json`
  needed no change (it doesn't enumerate individual skills).
- [x] **Stale coexistence comments.** The old/new disjoint-label coexistence language in this
  doc's [Label reconciliation](#label-reconciliation-old-loops--sandcastle) section,
  `docs/factory-engine-notes.md`, and the `agent-implement.yml` / `agent-review.yml` header
  comments have been updated to past tense / "rollout complete" framing in the toon-meta#193
  straggler-sweep PR, following the same wording pattern already used in the other 7 repos'
  retirement PRs (e.g. swap#73, connector#396).
- [ ] **Unused `REVIEWER_TOKEN`-style secrets.** *(Remaining — human/admin action.)* The old
  loops used their own review-bot token(s) distinct from `CLAUDE_CODE_OAUTH_TOKEN`. Every
  repo's retirement PR flagged this secret as now-orphaned but could not delete it (it's an
  org/repo secret, not a file in the diff). A human with org/repo secret admin access must
  check each of the 6 repos that had `pr-reviewer.yml` (relay, toon-client, store, connector,
  toon, swap — toon-meta itself never configured `REVIEWER_TOKEN`) and revoke/remove any
  orphaned token.
- [ ] **`swarm` / `capability-market` archival.** *(Remaining — human/admin action, tracked in
  [#194](https://github.com/toon-protocol/toon-meta/issues/194).)* `gh repo archive` has not yet
  been run for either repo; both are out-of-scope-not-factored and tracked separately from the
  8-repo set above.

---

> **Trigger-label hexes are locked in, not proposals:** verified 2026-08-05 against the GitHub
> API — `agent:implement` = `#1D76DB` and `agent:review` = `#B392F0` are identical in all 11
> factory repos (relay, toon-client, rig, store, connector, toon, swap, toon-meta, Forge,
> fractal, buzz).

---

## Branch protection & required checks (enforcement)

Configured 2026-08-05 by [#272](https://github.com/toon-protocol/toon-meta/issues/272)
(epic [#270](https://github.com/toon-protocol/toon-meta/issues/270)). Every factory repo's
`main` now has a required status check wired to the repo's real CI gate, with
**strict mode on** (the PR branch must be up to date with `main` before merging).
Auto-merge (#285) and any "is it green?" automation read these required checks — this
section is the drift detector: if a gate job is renamed, the matching required-check
context below MUST be updated in the same change, or merges brick.

Required-check contexts are **check-run names as they appear on PRs** (a GitHub Actions
job's `name:`, or the job id when no `name:` is set) — not workflow file names, and not
job ids when a `name:` overrides them. A required context that never reports blocks every
merge, so never require a check without first verifying it runs on all PRs.

Verified against live protection on 2026-08-06 (after the
[#279](https://github.com/toon-protocol/toon-meta/issues/279) repoints):

| Repo | Mechanism | Required checks | Strict | Reviews (pre-existing, untouched) |
|------|-----------|-----------------|--------|-----------------------------------|
| relay | classic branch protection | `CI OK` | yes | PR required, 0 approvals |
| toon-client | classic branch protection | `CI OK` | yes | PR required, 0 approvals |
| rig | classic branch protection (new) | `CI OK` | yes | none |
| store | classic branch protection | `CI OK` | yes | PR required, 0 approvals |
| toon | classic branch protection | `CI OK` | yes | PR required, 0 approvals |
| swap | classic branch protection | `CI OK` | yes | PR required, 0 approvals |
| connector | classic branch protection (new) | `CI Status Summary` | yes | none |
| Forge | **ruleset** `Gate` (id 19595889, `active`) | `gate` | yes (strict policy) | none |
| fractal | classic branch protection (new) | `gate` | yes | none |
| buzz | classic branch protection (new) | `Detect Changed Paths`, `Dead Token Reference Guard` — **repoint to `CI OK` pending**, see below | yes | none |
| toon-meta | classic branch protection | `Doc gate` | yes | PR required, 0 approvals |

Deviations from the #272 ticket text, and open follow-ups:

- **connector**: the ticket named the summary job by its job id `ci-status`; the check-run
  context that actually reports on PRs is its display name **`CI Status Summary`**
  (`if: always()` summary job in `ci.yml`) — that is what is required.
- **buzz**: still on the #272 interim pair (`Detect Changed Paths` +
  `Dead Token Reference Guard`). buzz's `CI OK` aggregate is merged
  ([buzz#154](https://github.com/toon-protocol/buzz/pull/154)) and both interim contexts
  are now *inside* it as its must-run jobs, so the repoint to `CI OK` is a one-line
  protection change — but it is deliberately **not applied yet**; see the outstanding item
  in [Aggregate required checks](#aggregate-required-checks-279) below.
- **toon-meta**: `Doc gate` originally lived in `agent-image.yml` behind a paths filter
  (factory-config paths only) — docs-only PRs produced **zero** check runs, so requiring it
  as-was would have blocked every docs PR. The gate job now lives in
  `.github/workflows/docs-gate.yml` with an unfiltered `pull_request` trigger, so `Doc gate`
  reports on every PR. Any toon-meta PR opened before that workflow landed must be updated
  against `main` (strict mode forces this anyway) for the check to report.
- **Forge**: enforcement is the pre-existing `Gate` **ruleset**, flipped from
  `enforcement: disabled` to `active`; its `ref_name.include` was `[]` (matched no branches)
  and is now `~DEFAULT_BRANCH`, and `strict_required_status_checks_policy` is now `true`.
  No duplicate classic protection was added.
- Review requirements were deliberately not changed anywhere ([#282](https://github.com/toon-protocol/toon-meta/issues/282)
  supplies the approver); `enforce_admins` remains off everywhere.

### Aggregate required checks (#279)

A required status check only means something if the job actually ran. GitHub treats a
skipped check as satisfying branch protection, so on a paths-filtered CI a PR that nothing
verified could merge green — buzz was the extreme case, with ~20 filtered jobs and PRs
carrying an effectively empty check set.
[#279](https://github.com/toon-protocol/toon-meta/issues/279) gave every repo **one**
aggregate `if: always()` job as its single required check. The rule the aggregate enforces:

- any gating dependency that finished as anything other than `success` fails it —
  `failure`, `cancelled`, **and `skipped`** alike; and
- where jobs are paths-filtered, the aggregate re-evaluates each job's own trigger
  condition and distinguishes *legitimately skipped by design* from *expected but silently
  did not run*.

Every aggregate lives in an **unfiltered** `pull_request` workflow, so no PR can end with
an empty check set, and matrix jobs are gated through their collapsed
`needs.<job>.result` — never as individual `${{ matrix.* }}` contexts. That last point is
not theoretical: on buzz's docs-only proof PR the skipped matrix legs reported under the
literal, unexpanded names `Desktop Smoke E2E (${{ matrix.shard }})` and
`Desktop E2E Integration (${{ matrix.shard }}/2)`, so requiring a matrix leg by name would
require a context that never reports on the runs that matter. Each context in the table
above was seen reporting on a live PR before it was required.

Per-repo aggregates and skippable-by-design jobs:

- **relay** (`CI OK`, job `ci-ok` in `ci.yml`, needs `build` + `devbox-validate`): nothing
  in `ci.yml` is skippable — both jobs must succeed. `agent-image.yml` is PR-triggered but
  paths-filtered to `.sandcastle/**` (factory-config validation) — skippable by design,
  outside the gate. Publish/release workflows are not PR-triggered.
  ([relay#101](https://github.com/toon-protocol/relay/pull/101))
- **toon-client** (`CI OK`, needs `changeset` + `build` + `devbox-validate`): `changeset`
  is skipped by design on `push` events only; on PRs all three must succeed. Caveat:
  toon-client's `devbox-validate` carries job-level `continue-on-error: true`, so its
  result reads `success` even when its steps fail — it is effectively advisory until that
  flag is removed (pre-existing, deliberately left untouched by #279). Skippable/outside
  the gate: `wire-vectors-drift.yml` (PR-triggered but paths-filtered to
  `packages/client/src/wire/**` — a separate workflow cannot feed a `needs:` aggregate;
  residual gap, does not gate), `e2e.yml` / `journey.yml` (`workflow_dispatch` only),
  `agent-image.yml` (`.sandcastle/**`), release/deploy (not PR-triggered).
  ([toon-client#519](https://github.com/toon-protocol/toon-client/pull/519))
- **rig** (`CI OK`, needs `changeset` + `build`): `changeset` skipped by design on `push`
  only. `agent-image.yml` (`.sandcastle/**`) skippable by design;
  `deploy-rig-web.yml` / `release.yml` / `smoke-published.yml` are not PR CI.
  ([rig#65](https://github.com/toon-protocol/rig/pull/65))
- **store** (`CI OK`, needs `build` + `devbox-validate`): nothing in `ci.yml` skippable.
  `agent-image.yml` (`.sandcastle/**`) skippable by design; publish workflows not
  PR-triggered. ([store#78](https://github.com/toon-protocol/store/pull/78))
- **toon** (`CI OK`, needs `build` + `devbox-validate` + `gate-regression-guard`): all
  three must succeed — `gate-regression-guard` only skips when a dependency failed, which
  fails the aggregate anyway. `agent-image.yml` skippable by design; `release.yml` not
  PR-triggered. ([toon#160](https://github.com/toon-protocol/toon/pull/160))
- **swap** (`CI OK`, needs `build` + `devbox-validate`): nothing in `ci.yml` skippable.
  `agent-image.yml` skippable by design; `release.yml` not PR-triggered.
  ([swap#87](https://github.com/toon-protocol/swap/pull/87))
- **connector** (`CI Status Summary`, job `ci-status` — pre-existing, hardened by #279;
  context name deliberately unchanged, so no repoint was needed): now needs
  `lint-and-format` + `rust-gate` + `solana-program` + `devbox-validate`, each of which
  must be exactly `success`. Previously only `failure` failed it, so a skipped or cancelled
  gating job read as a pass, and `devbox-validate` was not gated at all. `security`
  (Security Audit) stays deliberately advisory — its npm-audit/Snyk steps run with
  `continue-on-error` over known transitive vulnerabilities and must not brick agent PRs.
  `contracts.yml` is PR-triggered but paths-filtered to `packages/contracts/**` (separate
  workflow; residual gap, does not gate). Deploy/publish/treasury workflows are not PR CI.
  ([connector#802](https://github.com/toon-protocol/connector/pull/802))
- **Forge** (`gate` — unchanged, no new job): `ci.yml` is a single unconditional job with
  no paths filters, so it already *is* the aggregate; adding a second job would be pure
  ceremony. `agent-image.yml` (`.sandcastle/**`) skippable by design.
- **fractal** (`gate` — unchanged, no new job): identical shape to Forge — single
  unconditional job, already the aggregate. `agent-image.yml` skippable by design.
- **buzz** (`CI OK`, job `ci-ok` in `ci.yml` — the fleet's reference skip-detection
  implementation): needs all 18 ci.yml jobs and computes a three-way verdict per job —
  `must-run` (anything but success fails), *expected* (its mirrored trigger condition is
  true: success required, `skipped` = "expected but did not run" = FAIL), or
  *skip-legitimate* (condition false: `skipped` passes). The mirrored conditions reproduce
  each job's own `if:` over the same `Detect Changed Paths` outputs the jobs themselves
  consume.
  - Must-run: `changes` (Detect Changed Paths), `dead-token-guard` (Dead Token Reference
    Guard) — the two #272 interim contexts, now enforced inside the aggregate.
  - Conditionally expected, skippable **only** when their paths were untouched:
    `rust-lint` / `windows-rust` (rust ∨ desktop-rust); `unit-tests` /
    `backend-integration` / `relay-e2e` / `security` / `server-cross-compile` (rust); the
    desktop family `desktop-core` / `desktop-smoke-e2e` / `desktop` / `desktop-e2e-relay` /
    `desktop-e2e-integration-shard` / `desktop-e2e-integration` / `desktop-build-macos`
    (desktop ∨ desktop-rust ∨ rust); `web` (web); `mobile` (mobile). On `push` events every
    job is expected.
  - Outside `ci.yml`, skippable by design (PR-triggered but paths-filtered, do not gate):
    `docker.yml`, `helm-chart.yml`, `push-gateway-helm-chart.yml`, `benchmark-harbor.yml`,
    `agent-image.yml`.
  - Not PR CI at all — the canary, signing and release pipelines that genuinely must not
    gate an agent PR: `linux-canary.yml`, `windows-canary.yml`, `signed-macos-canary.yml`,
    `mobile-release-candidate.yml`, `prepare-desktop-release.yml` (all `workflow_dispatch`
    only), `release.yml` (desktop tags), `sprig.yml` (push/tags/dispatch),
    `auto-tag-on-release-pr-merge.yml` (post-merge housekeeping).

  Aggregate merged in [buzz#154](https://github.com/toon-protocol/buzz/pull/154), where
  `CI OK` reported green on a full-matrix run; the required-check repoint is the one
  outstanding item below.
- **toon-meta** (`Doc gate` — unchanged, no new job): `docs-gate.yml` is a single
  unconditional, unfiltered job; it already *is* the aggregate. `agent-image.yml`
  (paths-filtered to factory config: `.sandcastle/**`, `scripts/factory/**`,
  `package*.json`, itself) is skippable by design; `factory-ops-credential.yml` and
  `triage-sweep.yml` are cron, not PR CI.

**Proof (acceptance case).** [buzz#164](https://github.com/toon-protocol/buzz/pull/164) is
a docs-only PR — it touches `CONTRIBUTING.md`, which matches none of the five detect
filters — exactly the change that used to sail through unverified. Its runs so far show
the aggregate's **fail-closed** direction working: all 16 filtered jobs reported `skipped`
and were tolerated as legitimate (`expected-to-run=false`), while the two must-run jobs
ended `cancelled` and `CI OK` failed with
`Unconditional job 'changes' did not run — the required baseline is missing`
([run 31118643026](https://github.com/toon-protocol/buzz/actions/runs/31118643026)). That
is the exact hole #279 closes — under the old rule those same 16 skips plus no failures
would have read as a pass. The cancellations were platform-side: GitHub Actions was in a
major outage from 2026-08-06 15:22 UTC (queued jobs timing out; `changes` has
`timeout-minutes: 2` yet sat ~19 minutes without starting a step), so the clean
all-green PASS run on this PR is still **outstanding**.

**Outstanding (buzz tail).** Two steps remain, both blocked only on Actions recovering:

1. Re-run buzz#164 and confirm `CI OK` reports a definitive **pass** with the 16 filtered
   jobs skipped and both must-run jobs green.
2. Only then repoint buzz's protection off the interim pair:

   ```bash
   gh api -X PATCH repos/toon-protocol/buzz/branches/main/protection/required_status_checks \
     -F strict=true -f 'checks[][context]=CI OK'
   ```

Repointing before a live green `CI OK` is seen would block every buzz merge, which is the
one failure mode this whole section exists to prevent.

### What a factory-ops approval attests

Landed by [#282](https://github.com/toon-protocol/toon-meta/issues/282) (epic
[#270](https://github.com/toon-protocol/toon-meta/issues/270)). On every agent PR, the review
runner submits the reviewer's structured verdict (#275) as a **formal GitHub review** under the
`factory-ops` identity (`FACTORY_OPS_TOKEN`, provisioned + monitored under
[#271](https://github.com/toon-protocol/toon-meta/issues/271)):

- **clean** → a real `APPROVED` review — this is what satisfies the repos whose branch
  protection requires an approving review, since the factory App (which opens agent PRs)
  cannot approve its own PR.
- **blocking** → a `CHANGES_REQUESTED` review carrying the findings, plus `needs:human`.

**Either way, the verdict submitter clears `agent:review` if the PR carries it — so after any
verdict, the label means only "a review is pending or in flight"**
([#355](https://github.com/toon-protocol/toon-meta/issues/355)). Before this, nothing ever
cleared it: `connector#923` and `connector#935` both sat labelled long after their reviews
finished and returned `APPROVED`, making a done review indistinguishable from a pending one;
and because `agent-review.yml` fires on the `labeled` event, re-review needed an undocumented
remove-then-re-add of the label instead of a plain re-apply. Unlike the `needs:human` clear
described below, this one carries **no ownership check** — `agent:review` is unambiguously a
machine trigger, never a human control point, so whoever applied it, a submitted verdict means
the review it asked for is done. It also does not gate merge (`auto-merge.yml` does not check
it): this is an observability fix, not a wedge.

The label is only actually present on the review runner's path (`agent-review.yml`, which the
label itself triggered); the implement runner submits its verdict on a PR that was never
labelled, so there the clear is a tolerated no-op — GitHub's 404 for removing an absent label is
expected and never fails the run, while any other removal failure still does. A run that never
reaches a verdict still leaves the label on — it died, or its clean verdict was withheld because
the review-push verification failed. That errs the safe way (an unfinished review is not a
finished one), but nothing reaps such a label the way the
[dead-label reaper](#dead-label-reaper-330) reaps a dead `agent:implement`.

**A later clean verdict clears the `needs:human` it applied — and only that one**
([#352](https://github.com/toon-protocol/toon-meta/issues/352)). The blocking branch applies
the label as a side effect; nothing used to remove it, so a PR that went blocking → fixed →
clean ended `APPROVED` *and* labelled, which `auto-merge.yml` refuses on. Once blocked, gated
forever — on 2026-08-12 that held three approved PRs at once, one of them the fix for the
sibling dead-`agent:implement` wedge ([#330](https://github.com/toon-protocol/toon-meta/issues/330)).

The clear is **ownership-gated, not presence-gated**: it happens only when the timeline shows
the most recent application was by the approver identity itself. `needs:human` is a human
control point, so a label a person applied — including one re-applied after a clean verdict —
is never touched by the machine. The rule is pure and unit-tested in
`.sandcastle/needs-human-evaluator.mjs` (moved there by
[#354](https://github.com/toon-protocol/toon-meta/pull/354) so it propagates with the runner);
it fails closed, because a label that should have been cleared costs a manual edit while one
cleared wrongly overrules a person.

**A factory-ops `APPROVED` state is a machine verdict, not human judgement.** It attests
exactly this: *the gate passed and the sandcastle reviewer found nothing blocking* (reviewed
against the target issue's acceptance criteria where one was resolved). Nobody has read the
diff. Do not read a green factory-ops tick as a person having vouched for the change — the
human control points are `needs:human`, the risk labels, and anyone choosing to review before
or after merge.

Failure semantics (the anti-rot rule): the approver must never be the PR author, and the
runner verifies both the identity (before the reviewer runs and again at submission) and the
state of the review GitHub actually created. A missing/expired/wrong-identity
`FACTORY_OPS_TOKEN` — or a review that comes back `COMMENTED` instead of
`APPROVED`/`CHANGES_REQUESTED` — **fails the job loudly**. The retired loops' reviewer rotted
precisely because an expired `REVIEWER_TOKEN` silently degraded reviews to `COMMENTED`;
that degradation path deliberately does not exist here. The token is host-only and is never
forwarded into the sandbox: the agent must not hold the credential that approves its own
output (`.sandcastle/sandbox-secrets.ts`).

---

## Dependency-driven dispatch (unblock dispatcher)

Landed by [#280](https://github.com/toon-protocol/toon-meta/issues/280) (epic
[#270](https://github.com/toon-protocol/toon-meta/issues/270)). When a ticket closes anywhere in
the fleet, the dispatcher works out what it unblocked and applies `agent:implement` to exactly
the released work — one ticket at a time per epic. Logic:
`scripts/factory/unblock-dispatcher.mjs` (I/O shell) over the pure, unit-tested
`scripts/factory/dispatch-evaluator.mjs` (membership + serialization) and
`scripts/factory/unblock-evaluator.mjs` (#274 readiness — the single authority on
`## Blocked by`). Workflow: `.github/workflows/unblock-dispatcher.yml`, invoked by each repo's
`unblock-dispatcher-shim.yml` (canonical copy: `scripts/factory/unblock-dispatcher-shim.yml`,
same shim → `workflow_call` convention as pr-housekeeping) plus a 6-hourly safety cron that
recovers dropped events by re-running the identical full-fleet pass.

**Epic membership — the mechanical rule.** An *epic* is any open issue labeled `epic`. A ticket
is a *child* of an epic iff its body contains a line **starting** with `Part of <issue-ref>`
(bare `#N` / `repo#N` resolve against the ticket's own repo; trailing prose after the ref is
ignored; several `Part of` lines mean membership of all of them, and dispatch then requires ALL
of those epics to be idle). GitHub-native sub-issues are not consulted — these epics have none.

**Serialization.** Epics run in parallel; within an epic at most ONE agent PR
(`sandcastle/*`/`agent/*`) is in flight. An epic is busy when an open agent PR maps to one of
its children (close-keyword refs or the `sandcastle/issue-<n>` branch name) or a child already
carries `agent:implement`. Ready children of a busy epic queue for the next pass. Among several
ready children, the deterministic pick is the lowest canonical id — racing passes converge, and
re-adding a present label fires no `issues.labeled` event, so a race cannot double-run.

**Never dispatched:** anything labeled `epic`/`tracking`/`needs:human`, anything already in
flight, dependency-cycle members, tickets outside the 11-repo fleet, and every #274
"needs-human" verdict (unresolvable/prose blockers, blockers closed as *not planned*,
unverifiable states) — those get a comment naming the offending bullet plus `needs:human`,
idempotent via a hidden marker.

**Ticket-authoring consequences** (what makes a ticket mechanically dispatchable):

- Give every leaf ticket a `## Blocked by` section that is either `None` or clean single-ref
  bullets — prose conditions route to a human by design.
- Put the `Part of #N` trailer **after** a heading-closed section (e.g. after
  `## Acceptance criteria`). A `Part of` line sitting inside the `## Blocked by` section reads
  as a prose condition and fails closed.

**Rollout knob.** Writes happen only when the org Actions variable `DISPATCH_APPLY` is `'true'`
(or a manual run passes `apply=true`) — same pattern as `HOUSEKEEPING_APPLY`/`HYGIENE_APPLY`.
The write identity must be `FACTORY_OPS_TOKEN` (#271): agent-implement.yml's Guard 1 refuses
labelers without write access (#281 lets factory-ops through), so a dispatch under another bot
identity is silently ignored. The dispatcher only ever labels EXISTING issues — the only form
that fires `issues.labeled` and hence the runner (labels attached at creation emit only
`opened`).

**Write failure isolation (#320).** The first live run
([run 31271865392](https://github.com/toon-protocol/toon-meta/actions/runs/31271865392),
2026-08-08) aborted the entire fleet pass on ONE failed `gh issue edit` — buzz had no
`needs:human` label yet at the time, `gh` exited 1, and the uncaught exception killed the process
before any other repo's actions ran. Every write in both the dispatch pass and the completion
pass now goes through `scripts/factory/write-report.mjs`'s `runWrite`, which catches the error,
records it in a run-scoped report, and lets the loop continue to the next action — one bad write
degrades to "this one thing didn't happen" rather than "nothing after this happened". A preflight
up front (`planLabelPreflight`) checks that both trigger labels (`agent:implement`,
`needs:human`) exist in every fleet repo and reports the gap explicitly, since a missing label is
config drift, not a per-issue error. The run then prints a `Failed writes` section — each failed
write's type, target and error text — and exits non-zero at the end iff at least one write
failed, so failures stay visible without being fatal to the rest of the fleet.

## Auto-merge (#285)

Landed by [#285](https://github.com/toon-protocol/toon-meta/issues/285) (epic
[#270](https://github.com/toon-protocol/toon-meta/issues/270)). A green, approved,
conflict-free agent PR merges itself — which closes its linked issue, which fires the
unblock dispatcher (#280), which starts the next ticket. That is the loop closed:

```text
dispatch → PR → gate green → factory-ops approves (#282) → MERGE → issue closes → dispatch
```

Logic: `scripts/factory/auto-merge.mjs` (thin I/O shell) over the pure, unit-tested
`scripts/factory/automerge-evaluator.mjs` (eligibility) and `scripts/factory/pr-signals.mjs`
(the four-valued check verdict + mergeability settling, now **shared verbatim** with
`pr-housekeeping.mjs` so the remediation pass and the merge pass can never disagree about
whether the same PR is green). Workflow: `.github/workflows/auto-merge.yml`, which carries
toon-meta's own check-suite/review/merged-PR/labeled/unlabeled/synchronize triggers directly (so
toon-meta needs no shim). Every other factory repo is meant to reach it on those same events
through its own `.github/workflows/auto-merge-shim.yml`, fanned out verbatim from the canonical
copy at `scripts/factory/auto-merge-shim.yml` — but the deployed copies are stale (see below). A
6-hourly safety cron backs the whole fleet.

**Per-repo shim install status ([#322](https://github.com/toon-protocol/toon-meta/issues/322),
[#358](https://github.com/toon-protocol/toon-meta/issues/358)).** The canonical copy shipped with
this pass (#305) but was never fanned out — verified live 2026-08-09, none of the ten
non-toon-meta factory repos carried `.github/workflows/auto-merge-shim.yml`. It has now been
**fanned out by hand** (toon-meta#322): each repo received a byte-for-byte copy of
`scripts/factory/auto-merge-shim.yml`, diffed against the canonical file before its PR was opened.
toon-meta itself needs no shim — its `auto-merge.yml` carries the same triggers directly.

Since that fan-out, the canonical shim has gained `labeled`, `unlabeled` and `synchronize`
triggers — all three added to the shim here, in the canonical copy only (`labeled`/`synchronize`
reached `auto-merge.yml` earlier, with #357; #358 adds `unlabeled` and brings the shim up to the
same trigger set). The ten deployed copies still carry just
`check_suite`/`pull_request_review`/`pull_request:closed`, so until each is re-diffed against the
canonical file and re-installed, those repos still wait up to 6h for a label change to re-evaluate
a PR (this ticket's own connector#923/#935 scenario), exactly as toon-meta itself did before this
ticket. Verify per repo before assuming it landed — the #329 lesson.

Installing it per-repo is cross-repo work a toon-meta agent run cannot do (each repo dispatches in
its own repo), which is why it was ten hand-opened PRs rather than ten sandcastle runs — the same
way the `pr-housekeeping` and `unblock-dispatcher` shims were installed (relay#100, relay#103,
buzz#153). For a short verbatim copy with nothing to decide, a full implement → gate → review →
approve → merge cycle buys nothing.

Until a repo has the shim, the 6-hourly cron is not that repo's safety net but its *only* trigger:
every PR there waits up to 6h after going green, and one that is `BEHIND` gets its `update-branch`
on one pass and can only be merged on the next — another ≥6h.

**The shim-forwarded `if:` guard was verified, not assumed.** The job-level `if:` in
`auto-merge.yml` filters the three forwarded events (`check_suite`, `pull_request_review`,
`pull_request`) by reading `github.event.*` fields, which only works if a workflow invoked via
`workflow_call` from a repo's shim sees that shim's own triggering payload rather than a synthetic
`workflow_call` event. GitHub's docs say so outright, so this no longer rests on the workflow's
own comment: "When a reusable workflow is triggered by a caller workflow, the `github` context is
always associated with the caller workflow"
([Reusing workflow configurations → `github` context](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations#github-context)).
`github.event.check_suite.head_branch` and friends therefore resolve identically whether the
workflow runs from toon-meta's own trigger or a shim's `uses:` forward.

**Why not just `gh pr merge --auto` and let GitHub decide.** Native auto-merge merges as soon
as *branch protection* is satisfied, and protection cannot express three of the five
preconditions: it counts a `skipped` required check as a pass (the buzz#141 empty-check-set
gotcha), it has no notion of `needs:human`, and it cannot require that the approval came from
*factory-ops* rather than from anyone — six of the eleven repos require **zero** approvals, so
protection alone would merge an unreviewed agent PR. The seam is therefore: **this pass is the
stricter gate, GitHub is the final authoritative one.** We decide eligibility with the extra
preconditions and then hand the merge to GitHub, which re-enforces protection at the moment of
merging. Neither side can merge what the other rejects.

**The five preconditions** (all must hold; the report names every one that failed):

| Precondition | How it is decided |
|--------------|-------------------|
| The required check **ran** and passed | Required contexts are read LIVE from GitHub (classic protection, the branches endpoint, and rulesets — Forge's gate exists only as a ruleset), never from the table above, which has drifted. Every required context must be present in the PR's rollup **and** `SUCCESS`. Missing, `SKIPPED` or `NEUTRAL` blocks the merge even though protection would accept it. The whole rollup must also be `passed` (never "nothing failed"). |
| `mergeable == MERGEABLE` | Read only after it settles out of `UNKNOWN` (GitHub computes it asynchronously; polling is both the read and the nudge). A PR that never settles is never judged. |
| Reviewer verdict clean + factory-ops approved | One observable: the latest opinionated review from the factory-ops identity is `APPROVED`. #282 makes clean → `APPROVED` and blocking → `CHANGES_REQUESTED`, so a clean verdict *is* the approval. Any outstanding `CHANGES_REQUESTED`, a `REVIEW_REQUIRED` decision, or an approval left on an older commit blocks. |
| No `needs:human` | On the PR **or** on any linked issue (`Closes #N` refs and the `sandcastle/issue-<n>` branch name, via `prIssueIds`). |
| Branch up to date with base | Strict protection (#272). A PR that satisfies everything else and is only `BEHIND` gets `update-branch` — not a merge: CI re-runs on the new head and the next pass decides again. Nothing else in the factory updates branches, so without this, strict protection is a permanent stall. |

**Who counts as the approver** is not hardcoded: the pass runs as `FACTORY_OPS_TOKEN` — the same
credential that submits the #282 review — and resolves the login from `gh api user`. A rotation
cannot desynchronize approver and merger. Without the secret the run falls back to the ambient
App identity, which never approves, so every PR reports `approval-missing` and nothing merges.

**Rollout knob.** Writes happen only when the org Actions variable `AUTOMERGE_APPLY` is `'true'`
(or a manual run passes `apply=true`) — same pattern as `HOUSEKEEPING_APPLY` / `HYGIENE_APPLY` /
`DISPATCH_APPLY`. `AUTOMERGE_LIMIT` (default 5) caps merges per run.

**Rollout prerequisites**, as of 2026-08-06:

- **`allow_auto_merge` is `false` on all 11 repos**, so `gh pr merge --auto` would be refused
  today. The pass falls back to a direct `gh pr merge` for a PR that is verified green and
  `CLEAN` *right now* — GitHub's merge endpoint still enforces branch protection, so the
  fallback loses the *waiting*, not the *enforcing*. Turning the repo setting on (Settings →
  Pull Requests → Allow auto-merge) upgrades every repo to the native path automatically.
- **buzz is excluded** (`DEFAULT_EXCLUDED_REPOS`): its required contexts are still #272's interim
  pair, which only proves the workflow started. Remove the exclusion when
  [#279](https://github.com/toon-protocol/toon-meta/issues/279) repoints buzz at a real aggregate.
- A repo whose protection **cannot be read** is reported `policy-unreadable` and merges nothing —
  an unreadable policy is never treated as an absent one.

**This is not `SANDCASTLE_AUTO_MERGE`.** That variable is the *other* mechanism: the agent
merging its own branch from inside the sandbox, before CI and before review. It stays **off**
— verified 2026-08-06 across all 11 repos (no `agent-implement.yml` sets it; the line is
commented out in every copy, and no repo defines it as an Actions variable, which would have no
effect anyway since no workflow references `vars.SANDCASTLE_AUTO_MERGE`). This pass merges
through GitHub, after the gate, under an identity that is not the PR author.

## PR repair pass (#357)

The factory covers **issue → agent → PR → review → merge**. Nothing covered **PR went red →
fix it** until [#357](https://github.com/toon-protocol/toon-meta/issues/357): every red PR on
2026-08-12 was repaired because a human noticed and dispatched an agent by hand. This is not a
rare edge — a red PR holds its epic's dispatch slot (`agent:implement` stays on the ticket until
the PR merges), so one stuck PR costs a lane indefinitely, and the dead-label reaper (below)
explicitly does not help: its condition is "the run finished AND no open PR exists", and once a
PR exists, red or not, the reaper leaves it alone.

**Not a new loop — the auto-merge pass gains three more verdicts.** A PR whose auto-merge
evaluation blocks on nothing but red checks and/or a merge conflict — every other precondition
(approval, `needs:human`, review state, branch eligibility) already holds — is not simply
`blocked`; alongside `merge` / `update-branch` / `blocked`, `planAutoMerge`
(`scripts/factory/automerge-evaluator.mjs`) now also produces:

| Verdict | Meaning | Action |
|---|---|---|
| `retry` | The failing check(s) look transient (infrastructure) | Re-run the failed jobs — no agent, free |
| `repair` | A genuine defect, or a merge conflict | Apply `agent:fix` to the PR |
| `escalate` | Also red on `main`, or a budget is spent | Apply `needs:human` |

A PR with ANY other blocker — `needs:human`, an outstanding `CHANGES_REQUESTED`, an unreadable
policy, a draft, `approver-unknown`, ... — never reaches this decision at all and stays simply
`blocked`. That is how "do not race the reviewer" is enforced: **by construction**, not a special
case — the repair-candidacy gate in `planAutoMerge` requires every present blocker to be one that
red-checks-or-conflict would itself produce.

**The four rules**, decided by the pure, unit-tested `scripts/factory/repair-evaluator.mjs`
(`planRepair`, consumed by `automerge-evaluator.mjs` — no GitHub reads/writes in either):

1. **Classify before dispatching — most red is infrastructure.** `classifyCheckFailure` requires
   TWO signals before calling a failure transient: a download/setup/toolchain-shaped step NAME
   (`setup`, `install`, `toolchain`, `cache`, `download`, `provision`, `fetch`) AND a
   transport-shaped error TEXT (a curl exit code, an HTTP 5xx/429, a known-flaky host such as
   `hermit`/`artifacts.nixos.org`/`release.anza.xyz`/`get.nexte.st` — the exact hosts #357's own
   2026-08-12 incident named). A failing check with **no captured error text is always
   "genuine"**, even with an infra-shaped name — a step name is not evidence of what failed
   inside it, and a naive loop guessing from names alone would have burned ~8 agent runs on CDN
   weather that day.
2. **Red on `main` too ⇒ escalate, never dispatch.** `redOnMain` compares each failing check
   against main's own latest check rollup by name; a match means a repo-level defect no feature
   branch can fix, so `planRepair` escalates directly regardless of classification.
3. **A budget, then stop.** Repair attempts (`agent:fix` dispatches) and free retries are capped
   **separately** — `DEFAULT_REPAIR_BUDGET = 2`, `DEFAULT_RETRY_BUDGET = 2`. A transient-looking
   failure gets its own free-retry budget before it is treated as no-longer-transient and
   escalated, so a permanently-broken external host cannot loop forever without ever touching the
   costlier repair budget.
4. **Merge conflicts are the easy case.** `mergeable: CONFLICTING` is never transient and never
   repo-level, so it dispatches immediately with no classification (still subject to the repair
   budget, so an agent that cannot actually resolve the conflict does not loop forever).

**Rollout knob.** Repair writes (re-run / `agent:fix` / `needs:human`) happen only when the org
Actions variable `REPAIR_APPLY` is `'true'` (or a manual run passes `repairApply=true`) — a
**separate** knob from `AUTOMERGE_APPLY`, so the merge pass can run live while repair stays
dry-run, or vice versa. Every run prints the same decision report either way — the verdict line
and the action's reason (which names the attempt count and the budget whenever a budget is what
decided it), plus `d.signals.repair`, which carries the full `planRepair` output for every PR that
reached the repair decision and `null` for every PR that never became a candidate.

**Triggers.** `.github/workflows/auto-merge.yml`'s `pull_request` trigger (previously `closed`
only) gained `labeled` and `synchronize` here, plus `unlabeled`
([#358](https://github.com/toon-protocol/toon-meta/issues/358)): a label change is the one state
change that can make a PR mergeable or repair-eligible with no other event, and `synchronize`
re-evaluates a repair attempt's own push as soon as it lands rather than up to 6h later.
`connector#923`/`#935` sat mergeable for 5.5h after `needs:human` was *cleared* — an `unlabeled`
event — because nothing else fired before the next cron; this pass's own `labeled` trigger, added
first, could not have caught that exact case, which is why #358 added `unlabeled` alongside it.

**What the shell adds** (`scripts/factory/auto-merge.mjs`), over and above the merge pass's
existing reads: `readMainRollup` (main's own check rollup, once per repo, via
`/commits/{branch}/check-runs`), `countRepairAttempts` (prior `agent:fix` timeline events —
counted the same way `.sandcastle/needs-human-evaluator.mjs` reads ownership: the label list says only THAT a
label is present, never how many times it cycled), `countRetryAttempts` (a hidden marker comment
this pass posts on every `retry`, since a retry never applies a label to count from — the same
marker-comment convention as the dead-label reaper below), and `fetchFailingCheckErrorText`
(best-effort: extracts a run id from the failing check's live `detailsUrl` and pulls a `gh run
view --log-failed` excerpt, capped at `REPAIR_LOG_FETCH_LIMIT` checks per PR so a wide failing
matrix does not turn one pass into dozens of log fetches — checks left unfetched simply have no
`errorText` and fail closed to "genuine").

**Live-verified, dry-run, 2026-08-14** (`toon-backlog-bot[bot]` installation token, all 11 repos,
7 open agent PRs): `readMainRollup`, `countRepairAttempts`, `countRetryAttempts`, and
`fetchFailingCheckErrorText` all ran clean end-to-end with no crashes — including a real run-id
extraction and log fetch against `connector#960`'s one failing check (a genuine `forge test`
assertion failure, correctly classified as carrying no transient-error text). **Not yet exercised
live:** none of the 7 PRs that day happened to be a pure repair candidate (each also carried
`needs:human`, an outstanding `CHANGES_REQUESTED`, or nothing but `approver-unknown`), so the
retry/repair/escalate verdict itself has not fired against a real PR, and the WRITE paths
(`apply-label`, `gh run rerun`, the marker/escalation comments) have not run at all — this session
never set `REPAIR_APPLY=true`. Re-dry-run once a genuinely repair-eligible PR exists, and watch a
real `APPLY` run before trusting this beyond dry-run — the same rollout discipline as every other
`*_APPLY` knob in this file.

**The PR-scoped repair runner that consumes `agent:fix`.** `.sandcastle/agent-fix-pr.ts` +
`.github/workflows/agent-fix.yml`, `pull_request:[labeled]` on `agent:fix`, mirroring
`agent-review.yml`'s single-PR pattern: checks out `main`, materialises the PR head as a local
branch (same worktree-conflict workaround as the review runner), runs a bounded fixer pass
(sonnet, up to 60 iterations) against `.sandcastle/fix-prompt.md` — diagnose the failing check(s)
or conflict from `gh pr view`/`gh run view --log-failed`, make the smallest fix, confirm with
`npm run gate` (and `npm run test:factory` if `.sandcastle/**`/`scripts/factory/**` changed) —
and pushes any commits straight back onto the SAME PR (never a new one, never a merge, never a
review verdict). **The load-bearing part: it removes its own `agent:fix` label when it finishes,
whatever the outcome** (fix pushed, no changes made, or the run itself threw — the removal lives
in the runner's outermost `finally`), so it does not become a fourth label an automated step
applies and nothing automated clears, after `agent:implement` (#330), `needs:human` (#352) and
`agent:review` (#355). Removing it unconditionally also re-arms `repair-evaluator.mjs`'s
`hasAgentFixInFlight` gate, so the next auto-merge pass evaluates the PR fresh against the repair
budget rather than treating a finished run as still "in flight" forever. `AGENT_FIX_LABEL` is
**not** imported from `scripts/factory/repair-evaluator.mjs` — that directory is toon-meta-only
tooling (the #354 lesson), while `.sandcastle/` is what gets copied into every fleet repo, so the
runner defines the label string locally, the same way `review-verdict.ts` defines
`AGENT_REVIEW_LABEL` locally rather than importing it.

**Not yet done**, matching this fleet's established rollout order (build in toon-meta, prove it,
then fan out — see the dead-label reaper's and auto-merge's own shim histories below): a real
`REPAIR_APPLY=true` dry-run→apply cycle and a live `agent:fix` run have not happened yet (no PR in
the fleet has been a pure repair candidate so far — see the live-verified paragraph above); fanning
the three new `auto-merge.yml` triggers (`labeled`, `synchronize`, and `unlabeled` — #358) out to
the other ten repos' `auto-merge-shim.yml` copies (see "Per-repo shim install status" above);
propagating this whole pass to the other ten repos' own copies of `automerge-evaluator.mjs` /
`repair-evaluator.mjs` / `auto-merge.mjs` (each repo's factory scripts are self-contained copies,
same as every other pass in this file); and propagating `.sandcastle/agent-fix-pr.ts`,
`.sandcastle/fix-prompt.md` and `.github/workflows/agent-fix.yml` themselves to the other ten
repos' own `.sandcastle/`/`.github/workflows/` copies, the same way `agent-review-pr.ts` and
`agent-review.yml` already had to be.

**Rollout order matters here, and the runner fan-out comes first.** The auto-merge pass is
central — one run evaluates the whole fleet — while `REPAIR_APPLY` is an *org* variable, so
setting it to `'true'` turns repair writes on for all eleven repos at once. Only toon-meta carries
`agent-fix.yml` today, so a `repair` verdict on another repo's PR would apply `agent:fix` there
with nothing to consume it and nothing to clear it — and because `hasAgentFixInFlight` treats the
label as "a repair run is in flight", that PR would then be skipped by every later pass: exactly
the stuck-label failure mode #357 exists to avoid. Fan `agent-fix.yml` (plus `agent-fix-pr.ts` and
`fix-prompt.md`) out to a repo before enabling repair writes for it, and keep the first live runs
scoped to toon-meta by dispatching `auto-merge.yml` manually with `repos: toon-protocol/toon-meta`
and `repairApply: true` (a manual run obeys its own inputs, never the org variable).

## Daily digest (#286)

Landed by [#286](https://github.com/toon-protocol/toon-meta/issues/286) (epic
[#270](https://github.com/toon-protocol/toon-meta/issues/270)). One comment a day covering the
last 24h across all 11 repos: **Dispatched** (and the closing ticket that unblocked each),
**Merged** (plus the issues that closed as a result), **Filed** (#276 fix tickets, #277 hygiene
actions), **Escalated** (everything routed to `needs:human`, with the reason — the human's
queue), **Stalled** (epics with no in-flight agent PR and no ready child) and **Spend**
(agent-implement / agent-review runs started, per repo). Logic:
`scripts/factory/daily-digest.mjs` (I/O shell) over the pure, unit-tested
`scripts/factory/digest-evaluator.mjs`. Workflow: `.github/workflows/daily-digest.yml`
(daily cron 07:11 UTC + `workflow_dispatch`).

**Events, not state.** Every section reports transitions inside the window, never current
state. A state-based digest re-lists the same `needs:human` item every morning until a human
clears it — which is how a digest stops being read. The corollary: an unresolved escalation is
*not* re-listed; the digest is a change log, and `needs:human` remains the queryable queue.

**Where it posts: a standing tracking issue, one comment per UTC day** — not a fresh dated
issue. The fleet's issue list is the work queue (365 digest issues a year would pollute
hygiene's redundancy clustering and every epic/child scan); one URL is subscribable and
scrollable on a phone; and dedupe needs memory, which previous comments on a known issue
provide for the price of one read. The standing issue must carry `tracking` so the dispatcher
and hygiene never touch it. Its ref is configuration, not code: org variable
`DIGEST_ISSUE = owner/repo#N`. **Unset ⇒ report-only**, whatever `APPLY` says — the digest never
creates its own tracking issue.

**Escalations appear exactly once** (the #286 acceptance criterion) via three layers: (1) within
a run, repeat `labeled needs:human` events for one item collapse to the latest; (2) across runs,
each escalation has a stable key `repo#number@<label-event ISO>` and every posted digest embeds
its key list in a hidden marker line — the next run reads the last 7 digests back and suppresses
anything already reported, so overlapping windows cannot double-report while a genuine
re-escalation (new timestamp → new key) is reported again; (3) same-day re-runs upsert on the
hidden `factory-digest:<UTC day>` marker instead of posting a twin.

**Stalled is not re-derived**: `planDispatch` (#280) already computes `epics[].stalled` (nothing
in flight, nothing dispatched, no ready child) and the digest only adds the per-child verdict
breakdown that says *why* — under per-epic serialization one wedged ticket halts a whole epic,
so the wedged child is the diagnosis. Epics stalled with **zero** open children are collapsed to
one line: that is the completion pass's job (#284), not a wedge.

**Rollout knob.** Posting happens only when the org Actions variable `DIGEST_APPLY` is `'true'`
(or a manual run passes `apply=true`) — same pattern as
`HOUSEKEEPING_APPLY`/`HYGIENE_APPLY`/`DISPATCH_APPLY`. The single write is one comment on the
standing issue; the digest never labels, closes or comments on the work it reports.

## Dead-label reaper (#330)

Landed by [#330](https://github.com/toon-protocol/toon-meta/issues/330). Nothing else in the
factory notices when an `agent:implement` run dies without opening a PR — the label stays on the
ticket forever, and the dispatcher's own serialization rule ("a child already carries
`agent:implement`" counts an epic as busy, see above) wedges the epic's slot behind a runner that
is no longer running. Logic: `scripts/factory/reap-dead-labels.mjs` (I/O shell) over the pure,
unit-tested `scripts/factory/reap-evaluator.mjs` (run correlation, outcome classification, the
grace period, comment text). Workflow: `.github/workflows/reap-dead-labels.yml`, invoked by each
repo's `reap-dead-labels-shim.yml` (canonical copy: `scripts/factory/reap-dead-labels-shim.yml`,
same shim → `workflow_call` convention as the dispatcher) plus an hourly safety cron. The shim is
**not yet fanned out** — only the canonical copy exists today, so until it lands in each repo the
event path covers toon-meta alone (its own `workflow_run` trigger) and the cron is what reaches
the other ten. Verify per repo that it landed rather than assuming it did — the #329 lesson.

**The condition is "no open PR", not "the run failed".** A successful run can legitimately open
no PR — it verified the underlying bug no longer reproduces and made no changes. A reaper that
only watched `conclusion == failure` would leave that ticket wedged forever, so the rule is
mechanical: the run that owns this labeling has finished (or is provably dead) **and** no open PR
exists for `sandcastle/issue-<n>` / `agent/issue-<n>`.

**Correlating a label to its run.** GitHub's workflow-run list carries no issue-number field for
an `issues.labeled`-triggered run unless the workflow sets `run-name:`. The evaluator matches in
two tiers: (1) EXACT, a run whose `displayTitle` names the issue — toon-meta's own
`agent-implement.yml` now sets `run-name: "agent:implement — issue #${{ github.event.issue.number }}"`
for this; (2) TIME-WINDOW fallback, the run created nearest-after the ticket's `labeled` timeline
event (within 10 minutes of it), for the other ten fleet repos, which do not carry the `run-name:`
line yet (flagged here rather than assumed installed — the #329 lesson again).
When no run correlates at all — the label was applied but the `issues.labeled` webhook never
reached the runner — the ticket is left alone until the label is older than
`NO_RUN_GRACE_MINUTES` (75m, deliberately past the runner's own 60m job timeout), at which point
no genuinely in-progress run could still exist and it is safe to reap as `no-run-found`. This is
also why the reaper needs an **hourly** cron rather than the dispatcher's 6-hourly one: a run that
never happened produces no `workflow_run` event for anything to wake up on, so the cron is the
only path for that shape, and the grace period is short enough that a 6-hourly cadence would leave
it wedged for hours after it was already safe to reap.

**Decoy runs never decide anything.** `agent-implement.yml` fires on *every* `issues.labeled`
event, and its `guard` job carries `if: github.event.label.name == 'agent:implement'`. Labeling a
ticket anything else therefore mints a whole run in which *nothing ran*, so the run concludes
`skipped` — and, where `run-name:` is installed, it carries the same title as the real one (74 of
toon-meta's last 100 `issues`-triggered runs are these decoys). A run-level `skipped` conclusion
means the guard job itself never ran, i.e. some other label minted it; it is **always** a decoy and
never evidence about an `agent:implement` labeling.

Do not confuse this with a guard **refusal**, which is a different shape: the guard runs, decides
against the target, and the run concludes `success` with the `implement` *job* skipped (verified:
buzz run `31330244708`, the buzz#6 refusal — `guard=success`, `implement=skipped`). That is the
`guard-skipped` outcome below, read from the job conclusions, never from the run conclusion.

Both tiers therefore reduce candidates in strict precedence: any candidate that has not finished
wins outright, so nothing is reaped while a run is live; and decoys are then *dropped*, not used as
a last resort. When a ticket's only visible run is a decoy — its real run aged out of the fetched
history, or never fired while an unrelated label minted a decoy in the window — the correlation is
`null` and the ticket takes the grace-gated `no-run-found` path. The earlier "a lone `skipped` run
is still consulted" rule was wrong on the facts and produced a comment naming a run that did no
work while asserting `failed`; it is gone. The EXACT tier is also authoritative once it matches
anything at all, decoys included: it never falls through to the coarser time-window tier — otherwise
a different ticket labeled in the same minute could decide this one's fate. Runs are fetched in
100-run pages (`REAP_RUN_LIMIT`, 300 by default) precisely because decoys crowd real runs out of a
single page.

**Outcomes** (named in the comment; the follow-up guidance differs per outcome): a `success`
conclusion with no PR is `succeeded-with-no-changes`; a `success` conclusion whose `implement` job
was itself `skipped` is `guard-skipped` (one of `agent-implement.yml`'s guard checks refused the
target before any work began — the buzz#6 shape, a PRD-shaped parent carrying sub-issues); a run
whose duration reaches the runner's 50m step timeout is `timed-out` (a step-level timeout can
surface as a plain `failure` conclusion, so duration is the tell, not just the conclusion field);
a failed/timed-out run whose own issue comments claim a branch that does not actually exist on the
repo is `pushed-nothing` (the lost-push shape, root-caused by #331); anything else is `failed` or
`cancelled`.

**Never reaps bare.** An earlier version of this pass removed `agent:implement` and stopped there,
on the theory that this "frees the epic's serialization slot". Disproven live on buzz#90
(2026-08-09 18:29Z, [#330 comment](https://github.com/toon-protocol/toon-meta/issues/330#issuecomment-5233187221)):
the unblock dispatcher's very next pass saw the now-unlabeled, still-otherwise-ready ticket and
re-labeled it 26 **seconds** later — nothing about the ticket itself had changed. That is
reap → dispatch → die → reap, a full burned agent run every cycle, strictly worse than the stall
it replaces (a stall is at least free). Every reap now pairs the removal with something
`dispatch-evaluator.mjs`'s own readiness rule declines, chosen by outcome
(`reap-evaluator.mjs`'s `choosePairing`):

| Outcome | Pairing | Why |
|---|---|---|
| `guard-skipped` | `tracking` | A structurally undispatchable target (a parent with sub-issues) will be refused every time — decompose it, don't queue a human for it. |
| `pushed-nothing` | a new `## Blocked by` bullet naming `toon-protocol/toon-meta#331` | The known, always-applicable root cause. `unblock-evaluator.mjs`'s readiness check then declines the ticket while #331 is open, **and** dispatch resumes automatically the moment #331 closes — no human step needed. Mirrors the by-hand fix applied to buzz#43 that was confirmed to hold. |
| everything else | `needs:human` | No known ticket to point at; genuinely a human judgement call (retry budget, split, or drop). |

A ticket reaped twice within 6h (`REPEAT_WINDOW_HOURS`) is a repeat-death pattern, not a one-off —
`evaluateTicket` escalates it straight to `needs:human` regardless of what the table above would
otherwise pick, and says so in the comment. The pairing write happens **before** the label removal
in the shell's write closure, specifically so a failed pairing write leaves `agent:implement`
untouched (safe, retried next pass) rather than removed-and-unpaired.

**Idempotency.** Reaping removes the label, which is self-idempotent — an already-reaped ticket no
longer matches the `agent:implement` scan on the next pass. The hidden marker is keyed on the
*current labeling cycle* (`reapMarker(repo, number, labeledAt)`), not just the issue number — a
marker keyed only on the issue number would make every future death of the same ticket look
"already reaped" forever, since the first reap's comment never goes away, silently disabling the
reaper for any ticket that had ever been reaped once. `reapMarkerPrefix` (no cycle key) matches
every reap comment ever posted for a ticket across all cycles, which is how the repeat-detector
above finds prior reaps.

**Rollout knob.** Writes happen only when the org Actions variable `REAP_APPLY` is `'true'` (or a
manual run passes `apply=true`) — same pattern as `DISPATCH_APPLY`/`HOUSEKEEPING_APPLY`. Removing a
label, adding a pairing label, editing a body, and commenting need only write access, not the
write-access-gated add-label path (agent-implement.yml's Guard 1 — that guard runs only when the
added label is `agent:implement` itself), so `FACTORY_OPS_TOKEN` (#271) is not *identity*-load-bearing
here the way it is for dispatch — no reap is ever silently ignored for coming from the wrong
identity. It is still the write credential an APPLY run needs: the ambient `github.token` reaches
only the calling repo and this workflow grants it `contents: read`, so without the secret the pass
stays read/dry-run safe and any attempted write fails loudly in the run's `Failed writes` section.

**Does `planDispatch` also need a prior-run guard?** Considered per the #330 follow-up comment and
decided no, for now: the spin loop was caused by a bare reap leaving the ticket looking fully
ready, and every reap now mandatorily pairs the removal with `needs:human` / `tracking` / an open
`## Blocked by` bullet — all three are things `EXCLUDED_LABELS` / `isReady` already make
`planDispatch` decline on its own, with no new guard required. Revisit only if a reap path is ever
found that removes the label without a pairing landing first.

## triage-sweep retirement (#283)

`triage-sweep.yml` + `scripts/factory/triage-sweep.mjs` (the hourly cron janitor) were deleted
by [#283](https://github.com/toon-protocol/toon-meta/issues/283) (epic #270). It had run
exactly once (a dry-run dispatch, 2026-07-24) and was `disabled_manually` since. **Do not
resurrect it** — every job it bundled has a live, event-driven replacement:

| Old job | Replacement |
|---------|-------------|
| Part A — silence-driven issue dispatch (`agent:implement` after a 60-min quiet window) | **Retired outright**, superseded by dependency-driven dispatch: `.github/workflows/unblock-dispatcher.yml` + `scripts/factory/unblock-dispatcher.mjs` ([#280](https://github.com/toon-protocol/toon-meta/issues/280)). Part A never parsed `## Blocked by`, so it would have dispatched dependency chains out of order; the dispatcher makes readiness, not silence, the trigger. |
| Part B — stuck-PR remediation (conflict / failing checks / stale) | `.github/workflows/pr-housekeeping.yml` + `scripts/factory/pr-housekeeping.mjs` ([#276](https://github.com/toon-protocol/toon-meta/issues/276)), with the `agent/`-vs-`sandcastle/` prefix no-op fixed. Legacy `triage-sweep-stuck:*` markers still count toward the retry cap (`legacyMarker`, pr-housekeeping.mjs). |
| Backlog pruning (never existed in triage-sweep — it only ever created) | `.github/workflows/ticket-hygiene.yml` + `scripts/factory/ticket-hygiene.mjs` ([#277](https://github.com/toon-protocol/toon-meta/issues/277)). |

Credentials: the old `TRIAGE_APPLY` variable / `TRIAGE_PAT` secret were never provisioned at
the repo level (verified empty via the Actions API at retirement); the replacements run on
`FACTORY_OPS_TOKEN` + the `HOUSEKEEPING_APPLY` / `HYGIENE_APPLY` / `DISPATCH_APPLY` knobs. If
an org-level `TRIAGE_PAT` or `TRIAGE_APPLY` exists, it is orphaned and should be revoked by an
org admin (same loose end the old `REVIEWER_TOKEN` left).
