# TASK

Repair pull request #{{PR_NUMBER}} on branch `{{BRANCH}}` so its checks pass and it is
mergeable.

You were dispatched by the factory's PR repair pass (toon-meta#357): this PR's ONLY
blocker(s) are a merge conflict and/or failing checks — every other precondition
(approval, review state, `needs:human`) already holds. Make the smallest change that
gets it green; do not expand scope.

# DIAGNOSE

First, find out exactly why this PR is red:

    gh pr view {{PR_NUMBER}} --json mergeable,statusCheckRollup

- If `mergeable` is `CONFLICTING`, resolve the conflict against `main` (see CONFLICTS
  below).
- For every failing check, read its logs before touching anything:

      gh run view <run-id> --log-failed

  (`<run-id>` is the numeric id in the failing check's `detailsUrl`.)

# CONFLICTS

If the PR conflicts with `main`:

    git fetch origin main
    git merge origin/main

Resolve conflicts by reading BOTH sides and choosing the resolution that preserves both
changes' intent (the same convention `.sandcastle/merge-prompt.md` uses) — never blindly
take "ours" or "theirs". If a conflict needs a judgement call only a human should make,
say so plainly in your final output instead of guessing.

# FAILING CHECKS

This is **toon-meta** — a docs / tracker repo. The checks that can go red are:

- **Doc gate** (`npm run gate` — markdownlint, link check, JSON/template validation, gate
  regression), the required check, run on EVERY PR. Reproduce and fix locally with
  `npm run gate` (or the individual `npm run lint:md` / `check:links` / `validate:json` /
  `gate:regression` commands) before committing.
- **Factory unit tests** (`npm run test:factory`) — `node --test` over the pure evaluator
  modules. Reproduce with `npm run test:factory`.
- **Build sandcastle agent image** — a build-only check over `.sandcastle/Dockerfile`.

The last two live in `.github/workflows/agent-image.yml` and run only on PRs touching
`.sandcastle/**`, `scripts/factory/**`, `package.json`, `package-lock.json` or that
workflow itself.

Fix the ROOT CAUSE of the failure, not the symptom — e.g. a broken link means fix the
link, not delete the check that caught it. If a failing check looks like infrastructure
flakiness (a CDN, package registry, or setup-step timeout with no code-level cause), say
so plainly in your final output instead of inventing a change just to make the diff
"look different."

# EXECUTION

1. Diagnose the actual cause before editing anything.
2. Make the smallest change that fixes it.
3. Run the doc gate (`npm run gate`) — and `npm run test:factory` if you touched
   `.sandcastle/**`, `scripts/factory/**` or `package.json` — and confirm it passes
   before you consider the job done.
4. Commit on the current branch (`{{BRANCH}}`) — this is the PR's own branch; do not open
   a new PR.
5. Do not touch anything outside what's needed to turn this PR green.

Once you've made your fix commit(s) (or determined the failure is not fixable from this
branch — say so clearly in your final output), output <promise>COMPLETE</promise>.
