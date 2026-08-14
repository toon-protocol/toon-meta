# Factory engine notes — `@ai-hero/sandcastle` mechanics, the per-repo recipe, and known gotchas

Playbook for wiring the sandcastle engine into each execution repo under epic
[#178](https://github.com/toon-protocol/toon-meta/issues/178). Everything here is
**proven end-to-end on the relay pilot** (PRs relay#65 scaffold, #66 lint gate,
#67 workflows, #69 auth fix, #70 first merged agent PR, #71 loops retired). Org-wide
decisions that apply to every repo live in [FACTORY.md](../FACTORY.md); this doc is
the how-to that repos follow when they build their `.sandcastle/`.

---

## 1. What the engine is

- **`@ai-hero/sandcastle@0.12.0`** — exact org-wide pin (published 2026-06-29;
  pre-1.0, single-maintainer `mattpocock`, MIT). Never float `@latest`; upgrades are
  a coordinated cross-repo task. Repo: <https://github.com/mattpocock/sandcastle>.
- **Template: `parallel-planner-with-review`** — the org default. Outer loop
  (`MAX_ITERATIONS = 10`): Phase 1 plan (one opus run reads the filtered open-issue
  list, emits a `<plan>` JSON block validated with zod, one deterministic branch
  `sandcastle/issue-{id}` per unblocked issue) → Phase 2 implement + per-branch
  review in a shared sandbox (`Promise.allSettled`) → Phase 3 merge each branch that
  produced commits and close its issue.
- **Docker sandbox.** The engine bind-mounts the git worktree into a container and
  execs the agent inside it. Requires a Docker daemon on the host running the loop;
  present on GitHub-hosted runners out of the box.
- **Auth: `CLAUDE_CODE_OAUTH_TOKEN`** (from `claude setup-token`) — uses the Max-plan
  subscription, not metered API billing. `ANTHROPIC_API_KEY` is the fallback. Plus
  `GH_TOKEN` for the in-sandbox `gh` (issue list/view/close, `git push`, `gh pr create`).

**CLI surface — three command groups only:**

```
sandcastle init
sandcastle docker  build-image | remove-image
sandcastle podman  build-image | remove-image
```

Load-bearing facts about the engine confirmed on the pilot:

- **`init` produces `main.ts`** (the orchestration entry point), not `main.mts`. Wire
  `package.json` scripts and any dry-run harness to `main.ts`. Run it with
  `npx tsx .sandcastle/main.ts`; `init` does not touch your `package.json`, so add
  `"sandcastle": "npx tsx .sandcastle/main.ts"` yourself.
- **There is no `sandcastle plan` and no `--dry-run` command.** A "dry-run plan" is a
  *convention*: Phase 1 of a planner template in isolation — a read-only,
  `maxIterations: 1` opus pass that emits `<plan>` JSON and writes no code. Do not
  scaffold expecting a `plan` subcommand.
- **The task query lives in `plan-prompt.md`, not `main.ts`.** With
  `--create-label false` the stock query lists ALL open issues with **no label
  filter** — so epic-label wiring is an *add* of `--label agent:implement` to the
  planner query, not a swap of a hardcoded label.
- **Pass `--create-label false`** to `init` so the engine's own `Sandcastle` label is
  never created — we trigger on `agent:implement` / `agent:review`, and the
  `Sandcastle` label would just be pollution.
- **All agent roles default to one model** in the generated `main.ts` (0.12.0's
  claude-code default). Per the org-wide model-tiering policy (see
  [FACTORY.md](../FACTORY.md) → Factory runtime policy), every repo's runners
  split this: `planner` (and `planner-dry-run`), `merger`, and `reviewer` run on
  `claude-opus-5`; only `implementer` is pinned down to `claude-sonnet-5`. This
  is a deliberate per-repo edit to `.sandcastle/*.ts`, matched by role `name`,
  not by line number or file. **Gotcha:** `reviewer` and `implementer` used to
  share `claude-sonnet-5`, so a find-and-replace on the model string moves both —
  change the reviewer's line specifically. The `open-pr` and `push-review` roles
  named in earlier revisions no longer exist; push and PR-create are
  deterministic `execFileSync` calls with no agent.
- **Issues must be sliced to fit the ~200k context cap.** Before dispatching an
  `agent:implement` issue, size it so a single `implementer` run stays
  comfortably under ~200k tokens — the org-wide ceiling from `CLAUDE.md`, applied
  regardless of the model's actual window (see [FACTORY.md](../FACTORY.md) →
  *Context budget*). Split oversized work into follow-up issues before dispatch
  rather than letting an agent discover the overrun mid-run.
  `implement-prompt.md` and `review-prompt.md` both carry the matching
  instruction: start preparing a handoff at ~120k and hand off by ~160k, writing
  the note to `.sandcastle/logs/handoff-<task-id>.md` **and committing it on the
  branch** (the path is gitignored and the sandbox is destroyed at run end, so an
  uncommitted note does not survive).
- The generated `Dockerfile` is `node:22-bookworm` + `git`/`curl`/`jq`/`gh` + the
  native Claude Code CLI (`curl -fsSL https://claude.ai/install.sh | bash`), running
  as a non-root `agent` user with UID/GID aligned to the host. Claude Code refuses to
  run as root. Sandcastle ships **zero** GitHub Actions workflows — the label runners
  are our own convention.

---

## 2. The reusable per-repo recipe (pnpm)

Ordered checklist, proven on relay. Do it in this order:

1. **Exact-pin the engine as a devDep** — `@ai-hero/sandcastle@0.12.0` (no caret).
2. **Scaffold:**
   `npx @ai-hero/sandcastle@0.12.0 init --template parallel-planner-with-review --create-label false`.
3. **pnpm in the Dockerfile:** add a corepack line **as root, before the `USER`
   switch** (corepack writes shims into a root-owned prefix), pinned to the repo's
   `packageManager` field:

   ```dockerfile
   # Enable pnpm via corepack (root, before the USER switch)
   RUN corepack enable && corepack prepare pnpm@<packageManager pin> --activate
   ```

4. **Fix the install hook:** drop `copyToWorktree` (pnpm's `node_modules` is a
   symlink farm into a content-addressed store and breaks when copied across the
   worktree bind-mount) and use `pnpm install --frozen-lockfile` in `onSandboxReady`.
5. **Add the epic label filter:** append `--label agent:implement` to the issue query
   in `plan-prompt.md`.
6. **Point the gate at the repo's real scripts:** rewrite the `npm run typecheck` /
   `npm run test` lines in `implement-prompt.md`, `review-prompt.md`, and
   `merge-prompt.md` to the repo's actual lint/typecheck/test/build commands. The gate
   is prompt-driven — there is no engine config field and no enforcement, so name the
   real commands.
7. **Ignore the runner scripts from typed lint:** add `.sandcastle/**` to the eslint
   ignores (see gotcha (a)).
8. **Forward secrets to the sandbox:** `docker({ env: sandboxSecrets() })` in **all**
   runner entrypoints (see gotcha (b)).
9. **Minimal image-build workflow** — build/publish the `.sandcastle` container image.
10. **Label runners** — `.github/workflows/agent-implement.yml` and
    `agent-review.yml`, guarded (refuse sub-issues and PRD-shaped parents),
    authenticating with a GitHub App token. **Auto-merge is off** structurally: the
    `agent-implement-issue.ts` entrypoint runs in PR mode (opens a PR rather than
    merging). Re-enable with `SANDCASTLE_AUTO_MERGE=true`.

---

## 3. The gotchas

### (a) Typed-lint goes red from `.sandcastle/*.ts`

- **Symptom:** the repo goes eslint-red (parse errors) the moment `.sandcastle/`
  lands.
- **Cause:** the scaffolded `.sandcastle/*.ts` runner scripts are not in any tsconfig,
  so a repo using typed ESLint (`projectService: true`) can't type-check them.
- **Fix:** add `.sandcastle/**` to the eslint ignores (same pattern as a `.claude/**`
  tooling-dir ignore) — those scripts run via `tsx`, not the workspace program. Do it
  in the scaffold slice or the green-baseline slice, before wiring the label runner.
  (Relay proof: PR relay#66.)

### (b) CI secrets don't reach the sandbox

- **Symptom:** works locally, but in CI the agent dies with
  `claude-code exited with code 1: Not logged in` (and `GH_TOKEN` would fail next at
  the in-sandbox `git push` / `gh pr create`).
- **Cause:** the engine's `resolveEnv` forwards only env keys that appear in
  `.sandcastle/.env` (falling back to `process.env` per-key). `.sandcastle/.env` is
  gitignored, so in CI it's absent → the parsed env is `{}` → the `docker run` sandbox
  starts with no credentials. Dev has the file, so it passes locally.
- **Fix (every repo needs it):** forward secrets via the sandbox provider's
  first-class env option — `docker({ env: sandboxSecrets() })`, where the helper
  returns only the host-set keys (`CLAUDE_CODE_OAUTH_TOKEN`, `GH_TOKEN`) from
  `process.env`. Wire it into **all** runner entrypoints (implement, review, main,
  dry-run — the same latent bug is in each). No workflow change needed if the step
  already exports the tokens. (Relay proof: PR relay#69.)

### (c) pnpm: corepack + `copyToWorktree`

- **Symptom:** the sandbox can't resolve dependencies — no `pnpm` on PATH, or a broken
  `node_modules` after the worktree copy.
- **Cause:** the generated Dockerfile ships no package manager beyond npm, and the
  templates hardcode `npm install` in `onSandboxReady` plus `copyToWorktree:
  ["node_modules"]`, which assumes npm's flat tree. pnpm's symlinked store breaks when
  copied host→worktree.
- **Fix:** enable pnpm via corepack as root before the `USER` switch (recipe step 3),
  drop `copyToWorktree`, and run `pnpm install --frozen-lockfile` in `onSandboxReady`
  (recipe step 4).

### CI gotcha (from store #190 live run): in-sandbox git push isn't authenticated

- **Symptom:** the implementer commits, but the branch is never pushed and no PR
  appears — while the runner logs success (green job, silent no-op). First caught on
  store's first live `agent:implement` run (store#190).
- **Cause:** `@ai-hero/sandcastle@0.12.0` configures only git `safe.directory` +
  `user.name`/`user.email` in the sandbox — it wires **no git credential helper**.
  `gh` is authenticated from `GH_TOKEN`, but a bare `git push` over HTTPS uses git's
  own credential system, which is unwired — so the push has no deterministic auth. It
  succeeds only by luck (relay's early runs) and otherwise fails silently.
- **Fix (two parts):**
  1. Add a guarded `gh auth setup-git` as the FIRST `onSandboxReady` hook in every
     runner — `if [ -n "$GH_TOKEN" ]; then gh auth setup-git; fi`, ahead of the
     install step. It installs `gh` as git's credential helper (reads `GH_TOKEN` at
     push time, stores no token in any file); the guard makes token-less local dev a
     no-op rather than a fatal setup abort.
  2. After the open-pr phase, VERIFY from the authenticated host that an open PR
     actually exists (`gh pr list --head <branch> --state open`) and **exit non-zero**
     with a push/PR state dump if it does not — never log false success. The review
     runner does the analogous check on its push (branch head advanced to the review
     commits).
- **Propagated org-wide:** store#51, then the relay / rig / toon / swap / toon-client /
  connector / toon-meta sweep. Validated by store#52.

### CI gotcha (from #369): `check_suite` never fires for `GITHUB_TOKEN`-created runs — use `workflow_run`

- **Symptom:** a workflow wired to wake up on "CI just finished" (`check_suite:
  completed`) never fires — not flaky, never, in any repo.
- **Cause:** check suites for GitHub Actions workflow runs are created with
  `GITHUB_TOKEN`, and GitHub never delivers workflow-triggering events for
  `GITHUB_TOKEN`-created activity — confirmed live 2026-08-14: zero
  `check_suite`-triggered runs across all eleven factory repos, ever.
- **Fix:** trigger on `workflow_run: completed` instead — it **is** delivered for
  `GITHUB_TOKEN`-created runs (proven live by toon-meta's own reap-dead-labels pass,
  which fires via `workflow_run`). Name the repo's PR-triggered CI workflows explicitly
  and add a job-level guard on `workflow_run.head_branch` so the job only proceeds for
  a factory branch.
- **Rollout status:** `auto-merge.yml`, `pr-housekeeping.yml`, and both canonical shims
  switched from the dead `check_suite` trigger to `workflow_run`
  ([toon-meta#369](https://github.com/toon-protocol/toon-meta/issues/369)). The deployed
  per-repo shim copies are re-installed by hand, so a repo keeps the dead trigger until
  its copy is refreshed — see [FACTORY.md](../FACTORY.md) for the per-repo shim install
  status.

### CI gotcha (from connector#961): a floating `nightly` toolchain turns a CI gate red fleet-wide with zero code cause

- **Symptom:** a contracts CI gate goes red on a PR with no product cause —
  `testFork_Cutover_GaslessChannelLifecycleOnRealForkedUsdc` failed 3/3 with a bare
  `EvmError: Revert` (gas 9163906), blocking connector#960 even though its verdict was
  already APPROVED. The failure message does not name the toolchain, so nothing in the
  failure output hints that the runner had just picked up a new nightly build.
- **Cause:** `contracts.yml`'s `foundry-toolchain` install floated `nightly`, and on
  2026-08-14 that channel served forge `1.8.0-nightly`, which regressed the ERC-2771
  fork test — reproduced identically in `ghcr.io/foundry-rs/foundry:nightly` — while
  stable **v1.7.1** passed on the identical branch against the identical public RPC
  (`https://sepolia.base.org`), with the live distributor still holding ~100M USDC.
  No chain-state or PR cause; the
  toolchain channel itself was the regression. `ci.yml`'s own anvil gate had already
  been pinned to v1.7.1 with the same exposure flagged as "separate change" for
  `contracts.yml` — that flagged exposure is what fired here.
- **Fix:** pin every `foundry-toolchain` install in the workflow to a specific stable
  version (not `nightly`, not `latest`), with a dated comment recording the regression
  that motivated the pin. The general lesson: any CI gate that exists to prove
  chain/deploy code works must pin its toolchain to a stable version — the alternative
  is a red gate with no code change to bisect and no hint in the error.
- **Rollout status:** fixed in `contracts.yml` by
  [connector#961](https://github.com/toon-protocol/connector/pull/961); `ci.yml`'s
  anvil gate was already pinned. Other factory repos running a foundry-based CI gate
  should confirm their `foundry-toolchain` installs are pinned to a stable version, not
  `nightly`.

---

## 4. First-run safety & coexistence

- **CI runs on the agent's PR.** The label runners authenticate with a GitHub App
  token so `ci.yml` fires on the agent-opened PR (a default `GITHUB_TOKEN` would not
  trigger downstream workflows).
- **Auto-merge is disabled structurally**, not by policy — the
  `agent-implement-issue.ts` PR-mode entrypoint opens a PR for human review instead of
  merging. Re-enable only via `SANDCASTLE_AUTO_MERGE=true`.
- **Old and new loops coexisted on disjoint labels during the rollout.** The old
  backlog loops fired on `agent:ready` / `review-round:*` / `agent:split`; the new
  runners fire on `agent:implement` / `agent:review`. A given issue therefore fired
  exactly one engine — no double-execution — and the old loops reported
  `completed skipped` on the new labels while both were present. **Rollout complete:**
  the old 4-loop backlog automation is now retired in all 8 repos (see
  [FACTORY.md's Old-loop retirement status](../FACTORY.md#old-loop-retirement-status));
  the coexistence window described above is historical.

---

## 5. Per-repo calibration note

Typecheck debt is sized **per repo** and re-measured each time — the relay pilot's
debt was **2 trivial, mechanical errors** (a test-only strict-cast tightening, and a
`nostr-tools` two-version skew fixed by a `pnpm.overrides` dedup). That is a
~5-minute fix, not a slog; if relay is representative the "never ran `tsc`" cost per
repo is small — test-file cast tightening and dependency dedup, not architectural. But
re-measure each repo: the `nostr-tools` skew was relay-specific.

Why the debt was invisible: `tsup` builds emit fine (`skipLibCheck` never runs a
strict cross-package program), so `build` passing never implied `tsc --noEmit`
passing.

**Toolchain variants that still need their own ≥1-merged-agent-PR proof** (the recipe
above is proven on pnpm-with-lint; these differ):

- ~~npm-workspaces / docs / lint-less pnpm~~ — all three proven since (see
  FACTORY.md's registry table for the merged-PR citations).

## The pass must not see itself: plumbing check runs are not CI (2026-08-14)

Every `pull_request`-event workflow attaches its own job to the PR's check
rollup. When the fleet auto-merge pass gained `pull_request` triggers, each
evaluation saw its own in-progress `automerge` job, classified the PR
`checks-pending`, and — because the pass's workflow is deliberately absent
from every `workflow_run` trigger list — nothing re-fired on its completion.
A self-inflicted deadlock on exactly the events that were added to kill
deadlocks. Fixed by `PLUMBING_CHECKS` in `scripts/factory/pr-signals.mjs`
(toon-meta#373): factory plumbing jobs are invisible to the verdict in both
directions — their pending never blocks, and their SUCCESS never counts as
"a check actually ran and passed".
