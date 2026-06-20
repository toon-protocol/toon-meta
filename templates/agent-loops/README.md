# Agent backlog loops — setup & rollout

A four-loop system that manages each `toon-protocol` repo's backlog and lets an
agent team address tickets, running on **GitHub Actions billed to your Claude Max
plan** (not the API).

```
Loop A backlog-manager  ─agent:ready─►  Loop B issue-executor  ─PR─►  Loop C reviewer
        (cron, dry-run)                      (on label)  │              (on agent/ PR)
        ▲                                        ▲       └─agent:split─┐     │
        │                                        │                     ▼     │
        │                          Loop D issue-decomposer ◄──agent:split────┤
        │                                  (on label)  └──child issues──┘     │
        │                                        └──── changes_requested ──────┘  (bounded fix loop)
        └──────────── PR-evidence sync ◄── merged PR ── human merge ◄── APPROVE + green checks
```

- **Loop A** (`backlog-manager.yml`) → skill `toon-skills:backlog-manager`. Triage,
  label `agent:ready`/`agent:split`/`needs:human`, sync issue/Project state from PRs
  (incl. closing a `tracking` parent once its children close). Dry-run by default.
- **Loop B** (`issue-executor.yml`) → skill `toon-skills:issue-executor`. Implements
  an `agent:ready` ticket in one PR on an `agent/` branch; bounded fix loop on review.
  Hands off to Loop D with `agent:split` if the work is too large to finish in budget.
- **Loop C** (`pr-reviewer.yml`) → Anthropic's `code-review` plugin. Independent
  review of executor PRs; `REQUEST_CHANGES`/`APPROVE`. **Humans still merge.**
- **Loop D** (`issue-decomposer.yml`) → skill `toon-skills:issue-decomposer`. On
  `agent:split`, slices an oversized-but-clear issue into executor-sized child issues
  and keeps the parent open as a `tracking` epic. Children re-enter at Loop A/B.

## Prerequisites (once, org-wide)

1. **Max-plan token for CI** — run `claude setup-token` locally (requires a Claude
   subscription), then add the result as an **org Actions secret**
   `CLAUDE_CODE_OAUTH_TOKEN`. This is what makes the loops bill to Max, not the API.
2. **Custom org GitHub App** (needed to write org-level Projects — the default
   `GITHUB_TOKEN` and the official Claude app cannot):
   - Create at <https://github.com/settings/apps/new>; permissions: Contents R/W,
     Issues R/W, Pull requests R/W, **Organization Projects R/W**.
   - Install on the 8 repos; add `APP_ID` and `APP_PRIVATE_KEY` as org secrets.
   - To skip Project writes, omit the app-token step and the boards stay
     report-only (issues/labels still work via the official Claude app).
3. **Local gh scope** (for validating Project field/status-option IDs):
   `gh auth refresh -s project,read:project`.
4. **Native Issue Types** — the backlog-manager classifies the *type* dimension
   using GitHub's native **org Issue Types** (not `type:*` labels). Define these six
   at the org (Settings → Planning → Issue types): **Bug, Feature, Docs, Test,
   Refactor, Chore**. The default `Task` is unused. The custom App needs the
   issue-types permission to set them; the skill never creates org types itself.

## Rollout

Copy the four YAMLs into each repo's `.github/workflows/`. Repo list is in
`context/repos.md`: `toon`, `relay`, `swap`, `store`, `hub`, `toon-client`,
`toon-meta`, `connector`.

Per repo, stagger the Loop A `cron` minute/hour so all 8 don't fire at once and
spike Max usage.

## Graduation (don't enable everything at once)

1. Land **only `backlog-manager.yml` in dry-run** on all 8; review reports for a
   few daily cycles. (Loop B/C are inert with no `agent:ready` issues / `agent/`
   branches, but hold them back until the queue looks right.)
2. Flip the lowest-risk repo (`toon-meta`) Loop A to `apply` via
   `workflow_dispatch`; confirm labels + Project sync are sane.
3. Add `issue-executor.yml` + `pr-reviewer.yml` to that repo; run one trivial
   `agent:ready` ticket end-to-end (issue → PR → review → human merge → auto-close).
4. Add `issue-decomposer.yml`; label one oversized-but-clear issue `agent:split`
   and confirm it produces sane executor-sized children + a `tracking` parent.
5. Template the proven set across the remaining 7.

## Rate-limit & safety notes

- 8 repos × 4 loops share **one** Max limit. Keep Loop A **daily** (not hourly),
  staggered; rely on per-job `timeout-minutes` backstops and per-issue
  `concurrency`. Loops B and D
  are event-driven (one run per `agent:ready`/`agent:split` label) and self-limited
  by the queue. If volume outgrows Max, swap `claude_code_oauth_token` for
  `anthropic_api_key` — no other change.
- Defaults are conservative: dry-run, never remove human-set labels, never
  auto-close without merged-PR evidence, never merge/release/delete-branches/spend.
- The reviewer is mandatory and independent; the executor never reviews or merges
  its own PR.

## Note on the reviewer verdict

The `code-review` plugin posts inline findings; the workflow prompt also asks it to
submit a formal `REQUEST_CHANGES`/`APPROVE` review so the `changes_requested` event
can drive Loop B's fix loop. If a plugin version doesn't submit a formal verdict,
switch Loop C to [GitHub Code Review](https://code.claude.com/docs/en/code-review),
which uses the same OAuth token.
