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

These two labels drive the sandcastle runners and must be created identically in every factory
repo. The label→runner is a GitHub Action (`.github/workflows/agent-*.yml`), **not** part of
`.sandcastle/`, and its guards refuse sub-issues and PRD-shaped parents.

| Label             | Color     | Meaning                                                                                              |
|-------------------|-----------|------------------------------------------------------------------------------------------------------|
| `agent:implement` | `#1D76DB` | An agent should build this. Fires the sandcastle **implement** runner (`agent-implement.yml`).        |
| `agent:review`    | `#B392F0` | One labeled review action over a PR — the single-pass replacement for the old 4-round `review-round:*` loop. Fires the **review** runner (`agent-review.yml`). |

Color rationale: `agent:implement` reuses the blue (`#1D76DB`) of the label it replaces
(`agent:ready`), keeping the "agent trigger" identity. `agent:review` takes a distinct light
purple (`#B392F0`) so the two triggers are visually separable at a glance. *(No longer
proposals — verified identical in every factory repo; see the note at the bottom.)*

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

| Repo | Mechanism | Required checks | Strict | Reviews (pre-existing, untouched) |
|------|-----------|-----------------|--------|-----------------------------------|
| relay | classic branch protection | `build` | yes | PR required, 0 approvals |
| toon-client | classic branch protection | `build` | yes | PR required, 0 approvals |
| rig | classic branch protection (new) | `build` | yes | none |
| store | classic branch protection | `build` | yes | PR required, 0 approvals |
| toon | classic branch protection | `build` | yes | PR required, 0 approvals |
| swap | classic branch protection | `build` | yes | PR required, 0 approvals |
| connector | classic branch protection (new) | `CI Status Summary` | yes | none |
| Forge | **ruleset** `Gate` (id 19595889, `active`) | `gate` | yes (strict policy) | none |
| fractal | classic branch protection (new) | `gate` | yes | none |
| buzz | classic branch protection (new) | `Detect Changed Paths`, `Dead Token Reference Guard` | yes | none |
| toon-meta | classic branch protection | `Doc gate` | yes | PR required, 0 approvals |

Deviations from the #272 ticket text, and open follow-ups:

- **connector**: the ticket named the summary job by its job id `ci-status`; the check-run
  context that actually reports on PRs is its display name **`CI Status Summary`**
  (`if: always()` summary job in `ci.yml`) — that is what is required.
- **buzz**: interim configuration. The two required checks are the only jobs in buzz's
  `ci.yml` that run unconditionally on every PR (the other ~20 jobs are paths-filtered via
  `Detect Changed Paths` outputs and report `skipped`, which satisfies branch protection).
  When [#279](https://github.com/toon-protocol/toon-meta/issues/279) lands buzz's aggregate
  required check, the required contexts here MUST be repointed at that aggregate.
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
