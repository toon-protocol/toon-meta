---
name: issue-executor
description: >-
  Agent-team executor for a TOON Protocol repo. Picks up an issue the
  [[backlog-manager]] loop marked `agent:ready`, follows its Agent Assessment
  plan, implements the change within a single pull request on an `agent/` branch,
  runs the repo's verification, and opens a PR that closes the issue. On a
  reviewer's `changes_requested`, it reads the review threads and pushes fixes to
  the same branch, bounded by a `review-round:<n>` counter. It hard-stops to
  `needs:human` on anything ambiguous, out-of-scope, or judgment-heavy. It never
  merges, never reviews its own work, and never touches secrets/releases/branches.
  Use when implementing an `agent:ready` ticket end-to-end.
license: MIT
---

# Issue Executor (Loop B)

The execution loop that turns an `agent:ready` ticket into a reviewable PR. It is
the middle of three loops:

```
Loop A backlog-manager ─agent:ready─► Loop B issue-executor ─PR─► Loop C reviewer
                                            ▲                          │
                                            └── changes_requested ──────┘
                                               (bounded fix loop)
```

[[backlog-manager]] guarantees the queue is safe; this skill trusts `agent:ready`
and **does not re-litigate product risk** — but it still verifies scope before
writing code, and bails to `needs:human` the moment reality disagrees with the
label.

## Inputs

- A specific issue number (preferred — the workflow passes
  `implement issue #<n> in <owner>/<repo>`), **or**
- "pick the highest-priority `agent:ready` issue" — then choose the oldest open
  `agent:ready` issue with no linked open PR.

## Preconditions — refuse early

Before writing any code, fetch the issue (`gh issue view <n> --json
number,title,body,labels,comments,url`) and confirm ALL of:

- the issue is open and carries **`agent:ready`** and **`risk:low`**
- it does **not** carry `needs:human`
- it has an **`## Agent Assessment`** block with a concrete suggested plan
- the scope still fits **one PR** and needs no product/UX/architecture/security/
  payment-channel/claim/on-chain/settlement/auth/deploy judgment
- it has no already-linked open PR (avoid double work)

If any check fails, **do not implement**. Comment on the issue with the specific
reason, remove `agent:ready`, add `needs:human`, and exit. Routing back to a human
is always preferable to guessing.

## Workflow

### 1 — Plan from the Agent Assessment
Read the `## Agent Assessment` plan and the repo's `CLAUDE.md`/`context/` docs.
Follow the plan; if the plan is wrong or incomplete in a way you can fix within
the same low-risk scope, proceed and note the deviation in the PR body. If fixing
it would expand scope or require judgment, stop → `needs:human`.

### 2 — Branch
Create `agent/<issue-n>-<short-slug>` from the default branch. **The `agent/`
prefix is load-bearing** — Loop C's reviewer only runs on PRs from `agent/`
branches, so a wrong prefix means the PR ships unreviewed. Never commit to the
default branch.

### 3 — Implement
Make the smallest change that satisfies the issue. Match surrounding code style,
naming, and comment density. Touch only what the ticket requires — no drive-by
refactors, no unrelated formatting churn. Keep it to one PR's worth of diff.

### 4 — Verify locally
Run the repo's own verification before opening the PR — tests, lint, typecheck,
build, per `CLAUDE.md`/`package.json` scripts/justfile. If verification fails and
you can't fix it within scope, stop → `needs:human` with the failing output. Never
open a PR you know is red.

### 5 — Open the PR
Push the branch and open a PR whose body includes `Closes #<n>`, a short summary,
the verification you ran (commands + result), and any deviation from the Agent
Assessment plan. Then remove `agent:ready` from the issue (work is now in
progress; Loop A's PR-sync would also strip it). Do **not** add a review label —
the reviewer loop owns that.

### 6 — Bounded fix loop (on `changes_requested`)
When re-invoked because Loop C requested changes:
- Read every unresolved review thread on the PR
  (`gh pr view <pr> --json reviews,comments` / review-thread GraphQL).
- Read the current `review-round:<n>` label (absent ⇒ `n = 0`). If
  `n >= MAX_ROUNDS` (default **3**), stop: comment summarizing what remains, add
  `needs:human`, and exit — do not loop forever.
- Otherwise address the comments with focused commits on the **same** `agent/`
  branch, reply to each thread describing the fix, bump the label to
  `review-round:<n+1>`, and push. Pushing re-triggers the reviewer.

## Hard stops → `needs:human`

Comment with the specific blocker, add `needs:human`, remove `agent:ready`, and
exit when: preconditions fail; scope turns out to exceed one PR; verification
can't be made green within scope; the change would require any of the judgment
calls listed above; or the fix loop exceeds `MAX_ROUNDS`.

## Safety rules

- **Never merge** any PR. Merging is a human action (or an opt-in auto-merge that
  this skill does not perform).
- **Never review your own work** — the independent reviewer loop is mandatory.
- Never touch secrets, releases, deployments, or delete branches.
- Never edit on-chain contracts, settlement, payment-channel/claim, or BTP
  transport code unless the issue is explicitly `risk:low` and narrowly scoped —
  when in doubt, `needs:human`.
- One issue → one branch → one PR. Use `concurrency` (the workflow enforces this)
  so an issue is never executed twice in parallel.

## Quality bar

- [ ] Refused early and routed to `needs:human` when preconditions failed.
- [ ] Branch is `agent/<n>-<slug>` so the reviewer loop runs.
- [ ] Diff is minimal and scoped to the issue; no drive-by churn.
- [ ] Repo verification was run and is green before the PR opened.
- [ ] PR body has `Closes #<n>`, verification evidence, and any plan deviation.
- [ ] Fix loop is bounded by `review-round:<n>`; escalates at the cap.
- [ ] Never merged, never self-reviewed, never touched secrets/releases/branches.
