---
name: issue-decomposer
description: >-
  Splitter for a TOON Protocol repo. Picks up an issue labeled `agent:split`
  (because the [[backlog-manager]] judged it too large for one PR, or the
  [[issue-executor]] hit the wall mid-run), and breaks it into the smallest set
  of independently-shippable child issues that each fit ONE PR and the executor's
  bounded turn budget. It keeps the parent open as a tracking/epic issue with a
  task list, classifies and writes an Agent Assessment for every child, and marks
  a child `agent:ready` only when that child independently clears the same
  low-risk single-PR bar the backlog-manager uses — otherwise it routes the child
  to `needs:human`. It never writes code, never opens PRs, and never merges. Use
  when an `agent:split` issue needs to be decomposed into executor-sized work.
license: MIT
---

# Issue Decomposer (Loop D)

The sizing loop. When work is correctly scoped but **too big for one PR / one
executor run**, this loop slices it into executor-sized children instead of
parking it on a human. It sits between triage and execution:

```
Loop A backlog-manager ─agent:ready──────────────► Loop B issue-executor ─PR─► Loop C reviewer
        │                                                 │  ▲                        │
        └─agent:split─┐                  ┌─agent:split────┘  └── changes_requested ────┘
                      ▼                  ▼                       (bounded fix loop)
                 Loop D issue-decomposer ──child issues──► (re-enter Loop A / executor)
```

The executor runs with a hard `--max-turns` cap (currently **40**). An issue that
can't be implemented *and verified* within that budget will never complete — it
just burns a run and stalls. This loop turns one oversized ticket into several
that each finish comfortably inside the cap.

This skill **does not implement code**. Like [[backlog-manager]], its only output
is GitHub Issue state: new child issues and an updated tracking parent.

## Inputs

- A specific issue number (the workflow passes `decompose issue #<n> in
  <owner>/<repo>`), **or**
- "pick the oldest open `agent:split` issue" — choose the oldest open issue
  carrying `agent:split` that is not already decomposed.

## Preconditions — refuse early

Fetch the issue (`gh issue view <n> --json
number,title,body,labels,comments,url`) and confirm:

- the issue is **open** and carries **`agent:split`**
- it is **not already decomposed** — no existing `## Decomposition` task list and
  no open children pointing back to it (idempotency; see Step 4)

Then sanity-check that splitting is actually the right move:

- **If on inspection the issue already fits one PR** (the `agent:split` label was
  applied too eagerly): do not create children. Remove `agent:split`, comment why,
  and route it onward — add `agent:ready` if it independently clears the bar in
  "Marking a child ready" below, else leave it for the backlog-manager. Exit.
- **If the issue can't be sliced without product/UX/architecture/security/
  payment-channel/claim/on-chain/settlement/auth/deploy judgment** — i.e. the
  *decomposition itself* requires a decision (which approach, which scope, what
  the phases even are): do not guess. Remove `agent:split`, add `needs:human` with
  the specific decision needed, and exit. Splitting blindly produces children that
  are individually wrong.

## What "fits one PR and the turn budget" means

The executor gets ~40 turns and must spend them on: reading context (~5), making
the change, running verification (~5), opening the PR + label bookkeeping (~3),
and leaving headroom for the bounded fix loop. So size each child as work the
executor could **implement *and* verify well inside 40 turns** — concretely:

- **one concern**, one coherent change — not "and also";
- a **bounded, nameable** set of files/areas (rule of thumb: a handful, not a
  sweep across the repo);
- a **known verification** — a test, a command, or a visible behavior;
- **clear acceptance criteria** a reviewer can check.

This is exactly the backlog-manager's bar for a clean single-PR `agent:ready`
item. **When unsure whether a slice fits, split it smaller.** An over-small child
is cheap; an over-large one wastes a whole executor run.

## Workflow

### 1 — Understand the whole scope
Read the parent issue, its Agent Assessment, and comments. Read the repo's
`CLAUDE.md`/`context/` docs and the toon-meta `context/` docs so the slices match
how the repo is actually structured. For a phased rollout (e.g. "adopt X in
phases"), the phases are usually the natural slice boundaries.

### 2 — Plan the decomposition
Produce the **smallest set** of children that fully covers the parent, where each
child satisfies "fits one PR and the turn budget" above. For each child capture:

- a focused title: `<parent area>: <this slice>`;
- scope + explicit **acceptance criteria**;
- a small suggested plan (the executor reads this);
- its **verification** (test/command/visible behavior);
- **dependencies** — if child B needs child A first, record it (`Blocked by #A`)
  so the executor and reviewers see the order. Prefer slices that are as
  independent as possible; serialize only where a real dependency exists.

**Bound the fan-out.** If a faithful split needs more than ~8 children, the parent
is an epic that needs human planning, not mechanical slicing: do not create a
sprawl. Comment with the proposed outline, add `needs:human`, remove `agent:split`,
and exit. If any single slice still can't be made to fit one PR, that slice's work
needs human design — route the **parent** to `needs:human` and say which slice.

### 3 — Classify each child
Apply the [[backlog-manager]] rules to every child independently: exactly one
`risk:*` label and (via GraphQL) one native Issue Type. A `risk:medium` parent
often decomposes into several genuinely `risk:low` mechanical slices plus one or
two that still need judgment — classify each on its own merits, don't inherit the
parent's risk wholesale.

### 4 — Create the child issues (idempotent)
Before creating anything, re-list the parent's existing children (parse the
`## Decomposition` list and `gh issue list --search` for back-references) so a
re-run **reconciles** rather than duplicates. Create only missing children.

Each child body includes: `Part of #<parent>`, scope, acceptance criteria, the
suggested plan, the verification, any `Blocked by #<sibling>`, and a full
`## Agent Assessment` block (see [[backlog-manager]] for the format). Open child
issues with the org App actor (the workflow's App token) — opening them via the
default token would not trigger the downstream loops.

### 5 — Mark children ready (same gate as Loop A)
For each child, decide routing exactly as the backlog-manager would:

- Add **`agent:ready`** (with `risk:low`) **only when ALL hold**: `risk:low`,
  scope clearly fits one PR, expected output is clear, verification is known, and
  **no** product/UX/architecture/security/payment-channel/claim/on-chain/
  settlement/auth/deploy judgment is required.
- Otherwise add **`needs:human`** with the specific decision, or leave it
  classified-but-unready for the backlog-manager to revisit. When in doubt,
  `needs:human` beats a speculative `agent:ready`.

Adding `agent:ready` to a child via the App actor triggers Loop B directly — that
is the intended handoff. The child PR is still independently reviewed by Loop C,
so this does not bypass review; it only front-loads the classification the
backlog-manager would otherwise do on its next run.

### 6 — Convert the parent into a tracking issue
Keep the parent **open**. Edit its body to append (or update) a `## Decomposition`
section with a task list of children:

```markdown
## Decomposition

Split by issue-decomposer because the original scope exceeds one executor-sized
PR. Tracking the children below; this issue closes when they all close.

- [ ] #<child-1> — <slice title>
- [ ] #<child-2> — <slice title> (blocked by #<child-1>)
```

Add the **`tracking`** label, remove **`agent:split`** and any **`agent:ready`**
from the parent (an epic is never directly executed), preserve its `risk:*` label
and Issue Type, and comment a one-line summary linking the children. Do **not**
close the parent — the [[backlog-manager]]'s PR-evidence sync closes it once every
child is closed.

### 7 — Report
Compact summary: parent issue, why it was split, the children created (number,
title, risk, type, agent-ready vs needs:human), dependencies, the parent's new
tracking state, and any blocker that sent the parent/a slice to `needs:human`.

## Hard stops → `needs:human`

Comment with the specific blocker, add `needs:human`, remove `agent:split`, leave
the parent open, and exit when: the decomposition itself needs a judgment call; a
faithful split would exceed ~8 children; or any single slice still can't be made
to fit one PR. Routing to a human beats emitting children that are individually
wrong.

## Safety rules

- **Never implement code, open PRs, merge, or delete branches** — this skill only
  reads the repo and mutates GitHub Issues (create/edit/label/comment).
- **Idempotent** — re-running on an already-split parent reconciles the child set;
  it never duplicates children or re-spams the tracking comment.
- **Never invent scope.** Children must collectively equal the parent — no new
  features, no dropped requirements.
- Apply the backlog-manager's `agent:ready` gate **conservatively** to children;
  never mark a `risk:medium`/`risk:high` slice `agent:ready`.
- Preserve the parent's existing managed labels and native Issue Type; only add
  `tracking` and remove `agent:split`/`agent:ready`.
- Open children and apply their labels with the **App actor** so the downstream
  loops trigger; never use the default token for these writes.

## Quality bar

- [ ] Refused early / routed to `needs:human` when splitting needed judgment or
      would sprawl past the child cap.
- [ ] Each child is one concern, bounded files, with verification and acceptance
      criteria — plausibly implementable *and* verified within the 40-turn cap.
- [ ] Children collectively cover the parent; dependencies recorded as
      `Blocked by #<sibling>`.
- [ ] Each child has one `risk:*` label, one native Issue Type, and an Agent
      Assessment; `agent:ready` applied only on the full low-risk single-PR bar.
- [ ] Parent kept open as a `tracking` issue with a `## Decomposition` task list;
      `agent:split`/`agent:ready` removed; `risk:*` + Issue Type preserved.
- [ ] Idempotent on re-run; no duplicate children, no comment spam.
- [ ] Never implemented code, opened a PR, merged, or deleted a branch.
