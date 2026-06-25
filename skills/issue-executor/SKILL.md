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
the middle of the backlog pipeline (with [[issue-decomposer]] as a side-loop for
oversized work):

```
Loop A backlog-manager ─agent:ready─► Loop B issue-executor ─PR─► Loop C reviewer
                                            ▲   │                      │
                                            │   └─agent:split─► Loop D │
                                            └── changes_requested ─────┘
                                               (bounded fix loop)
```

If, while executing, the work turns out to be **too large to implement and verify
within one run**, this loop does not force a half-done PR and does not
dead-end on a human: it hands the issue to the [[issue-decomposer]] (Loop D) with
`agent:split`, which slices it into executor-sized children that flow back here.

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
  payment-channel/claim/on-chain/settlement/auth/deploy judgment — **unless** the
  testnet/devnet carve-out applies (see below)
- it has no already-linked open PR (avoid double work)

If any check fails, **do not implement**. Comment with the specific reason, remove
`agent:ready`, and route: if the **only** problem is that the scope is too large
for one PR (everything else is clear and low-risk), add **`agent:split`** to hand
it to the [[issue-decomposer]]; otherwise add **`needs:human`**. Then exit.
Routing — to the decomposer or to a human — is always preferable to guessing or to
shipping a partial change.

### Testnet/devnet carve-out

On-chain, settlement, payment-channel/claim, and deploy work is **not** auto-refused
when **both** of the following signals appear in the issue body:

```
**Network:** testnet / devnet
**Funds:** treasury wallet, ≤ $X (bounded)
```

When both signals are present (they appear in every WS2/WS3 Agent Assessment), the
executor treats the issue as in-scope provided all other `agent:ready` conditions
hold. The signals confirm: (a) no mainnet exposure, (b) no real user funds at risk,
(c) amounts are explicitly bounded.

**Always → `needs:human`** regardless of signals: any mainnet contact, real or
unbounded user funds, key custody changes, fee/settlement-parameter decisions, or
BTP transport mutations.

## Workflow

### 1 — Plan from the Agent Assessment
Read the `## Agent Assessment` plan and the repo's `CLAUDE.md`/`context/` docs.
Follow the plan; if the plan is wrong or incomplete in a way you can fix within
the same low-risk scope, proceed and note the deviation in the PR body. If fixing
it would require judgment, stop → `needs:human`. If it would simply expand the
work beyond one executor-sized PR, stop → `agent:split` (don't start a branch you
can't finish; let the decomposer slice it first).

### 2 — Branch
Create `agent/<issue-n>-<short-slug>` from the default branch. **The `agent/`
prefix is load-bearing** — Loop C's reviewer only runs on PRs from `agent/`
branches, so a wrong prefix means the PR ships unreviewed. Never commit to the
default branch.

### 3 — Implement
Make the smallest change that satisfies the issue. Match surrounding code style,
naming, and comment density. Touch only what the ticket requires — no drive-by
refactors, no unrelated formatting churn. Keep it to one PR's worth of diff.

### 4 — Add a changeset (if the repo uses Changesets)
Many TOON repos (e.g. `toon-client`, `toon`) gate every PR on a **required
"Changeset check"** status that fails on any PR lacking a changeset — bot PRs
that skip this are red on arrival. Before opening the PR, detect Changesets by
the presence of a **`.changeset/config.json`** at the repo root. If it is
absent, skip this step. If it is present, add a changeset file under
`.changeset/` on the same `agent/` branch (it ships in this PR's diff):

- **Code change to a published package** (a fix or feature): write a normal
  changeset. Find the exact package name(s) from the `name` field of the
  changed package's `package.json`, and confirm the package is versioned via
  `.changeset/config.json`. Use bump **`patch`** for a fix, **`minor`** for a
  feature. Example for a `views` feature:

  ```
  ---
  "@toon-protocol/views": minor
  ---

  Add <one-line summary of the change>.
  ```

- **Docs-only / non-package change** (or any change that should bump no
  version): write an **empty** changeset — exactly an empty frontmatter
  followed by a one-line summary:

  ```
  ---
  ---

  <one-line summary of the change>.
  ```

Name the file descriptively (e.g. `.changeset/issue-<n>-<slug>.md`). The
changeset is committed as part of this same PR branch — never a separate PR.

### 5 — Verify locally
Run the repo's own verification before opening the PR — tests, lint, typecheck,
build, per `CLAUDE.md`/`package.json` scripts/justfile. **If the repo has a
`devbox.json`, run that verification inside the pinned shell** (`devbox run build`,
`devbox run test`, … or `devbox run -- <cmd>`) so you build against the same
toolchain CI's `devbox-validate` job uses (the toon-meta `context/dev-environment.md`
standard). Repos without
a `devbox.json` use their documented commands directly. If verification fails and
you can't fix it within scope, stop → `needs:human` with the failing output. Never
open a PR you know is red.

### 6 — Open the PR
Push the branch (including the changeset, if any) and open a PR whose body
includes `Closes #<n>`, a short summary, the verification you ran (commands +
result), and any deviation from the Agent
Assessment plan. Then remove `agent:ready` from the issue (work is now in
progress; Loop A's PR-sync would also strip it). Do **not** add a review label —
the reviewer loop owns that.

### 7 — Bounded fix loop (on `changes_requested`)
When re-invoked because Loop C requested changes:
- Read every unresolved review thread on the PR
  (`gh pr view <pr> --json reviews,comments` / review-thread GraphQL).
- Read the current `review-round:<n>` label (absent ⇒ `n = 0`). If
  `n >= MAX_ROUNDS` (default **6**), stop: comment summarizing what remains, add
  `needs:human`, and exit — do not loop forever.
- Otherwise address the comments with focused commits on the **same** `agent/`
  branch, reply to each thread describing the fix, bump the label to
  `review-round:<n+1>`, and push. Pushing re-triggers the reviewer.

## Hard stops

Always comment with the specific blocker, remove `agent:ready`, and exit. Choose
the route by **why** you stopped:

- **→ `agent:split`** when the *only* blocker is size: the work won't fit one
  executor-sized PR but is otherwise clear and low-risk. Discard any branch you
  started; the [[issue-decomposer]] will slice it. Never open a partial PR.
- **→ `needs:human`** for everything else: preconditions fail; verification can't
  be made green within scope; the change would require any of the judgment calls
  listed above; slicing the work would itself need a decision; or the fix loop
  exceeds `MAX_ROUNDS`.

## Safety rules

- **Never merge** any PR. Merging is a human action (or an opt-in auto-merge that
  this skill does not perform).
- **Never review your own work** — the independent reviewer loop is mandatory.
- Never touch secrets, releases, or delete branches.
- Never edit on-chain contracts, settlement, payment-channel/claim, deploy, or BTP
  transport code **on mainnet or with real/unbounded funds** — add `needs:human`.
  Testnet/devnet work using a treasury wallet with bounded amounts is permitted when
  the issue body carries both carve-out signals (see Preconditions); when in doubt,
  `needs:human`.
- One issue → one branch → one PR. Use `concurrency` (the workflow enforces this)
  so an issue is never executed twice in parallel.

## Quality bar

- [ ] Refused early and routed to `needs:human` when preconditions failed.
- [ ] Branch is `agent/<n>-<slug>` so the reviewer loop runs.
- [ ] Diff is minimal and scoped to the issue; no drive-by churn.
- [ ] Repo verification was run and is green before the PR opened.
- [ ] Changeset present when the repo uses Changesets (normal for package
      changes, empty for docs-only / non-package changes).
- [ ] PR body has `Closes #<n>`, verification evidence, and any plan deviation.
- [ ] Fix loop is bounded by `review-round:<n>`; escalates at the cap.
- [ ] Never merged, never self-reviewed, never touched secrets/releases/branches.
