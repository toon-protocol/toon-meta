---
name: backlog-manager
description: >-
  Engineering backlog manager for the TOON Protocol polyrepo. Triages GitHub
  Issues (and the repo's GitHub Project), classifies each issue by risk and type,
  marks safe single-PR work `agent:ready` so the issue-executor loop can pick it
  up, routes judgment calls to `needs:human`, writes an Agent Assessment plan into
  each issue, and syncs issue/Project state from linked-PR evidence. Defaults to
  dry-run. Use when GitHub Issues for a `toon-protocol` repo are the source of
  truth, or on a schedule for unattended backlog hygiene. This skill does NOT
  write code — it produces the safe queue that [[issue-executor]] consumes.
license: MIT
---

# Backlog Manager (Loop A)

A lightweight product manager for a TOON Protocol repo's backlog. It keeps work
**transparent, classified, and safe to route** to either a human or an AI agent.
It is the first of three loops:

```
Loop A backlog-manager ─agent:ready─► Loop B issue-executor ─PR─► Loop C reviewer
        ▲                                                               │
        └──────────── PR-evidence sync (Step 5) ◄── merged PR ──────────┘
```

This skill **does not implement code**. Its only output is a clean, labeled
backlog and an `agent:ready` queue that [[issue-executor]] consumes.

**Default mode is `dry-run`.** Only mutate GitHub when the user explicitly passes
`apply`. When running unattended (cron / non-interactive), never prompt — record
blockers in the final report and exit.

## TOON polyrepo context

The source of truth is GitHub Issues for one `toon-protocol` repo, plus that
repo's GitHub Project board when accessible. The org repos and their owners are in
`context/repos.md` (`toon`, `relay`, `swap`, `store`, `hub`, `toon-client`,
`toon-meta`, `connector`). Run this skill **per repo** — never merge backlogs
across repos. Read the repo's `CLAUDE.md` and the toon-meta `context/` docs for
risk classification, but treat them as context, not as a competing backlog.

## Backlog source contract

Use exactly one source of truth per run:

- **Default:** GitHub Issues for the current repo, when `gh` is installed,
  authenticated, and the repo has a `toon-protocol` remote.
- **GitHub Project:** load the named/linked Project's fields and **record the
  status option IDs before mutating anything**. Default GitHub `GITHUB_TOKEN`
  **cannot write org-level Projects** — if the run lacks a PAT / App token with
  `project` scope, treat the board as **report-only** and say so in the report.
- If `gh` is unavailable/unauthenticated, **stop and report the prerequisite** —
  do not fall back to local planning files.

Local roadmap/`docs/` files are context only. When they diverge from the tracker,
report that as quality drift; do not reconcile them as a second backlog.

## Labels (fixed set — do not invent others)

This skill manages only the labels below. Leave existing tracker labels (`bug`,
`enhancement`, `good first issue`, etc.) untouched unless the user asks to
normalize them.

**Risk** — `risk:low` (safe for agent execution when also `agent:ready`),
`risk:medium` (maybe agent-suitable later; not unattended by default),
`risk:high` (human-led).

**Type** — `type:bug`, `type:feature`, `type:docs`, `type:test`,
`type:refactor`, `type:chore`.

**Routing** — `agent:ready` (permission for the executor loop to pick it up),
`needs:human` (a decision/clarification/judgment is required).

**Loop bookkeeping** — `review-round:<n>` is owned by the executor/reviewer
loops; never set it here, but preserve it.

Recommended GitHub colors: `risk:low` `0E8A16`, `risk:medium` `FBCA04`,
`risk:high` `B60205`, `type:*` `5319E7`, `agent:*` `1D76DB`, `needs:human`
`D93F0B`.

### Managed labels are additive

Trackers don't record who set a label, so treat every existing managed label as
**deliberately human-set**. Never remove or change an existing `risk:*`,
`type:*`, `agent:ready`, or `needs:human` label during classification — only fill
gaps. If your classification disagrees with an existing label, **keep the label
and raise the disagreement in the report**. The only exception is Step 5
(PR-evidence sync), which may remove `agent:ready` once work is demonstrably in
progress or done.

## Risk & routing rules

The executor loop must be able to query `agent:ready` and trust it without
re-litigating product risk.

### Add `agent:ready` only when ALL hold

- `risk:low`
- scope is clear and fits in **one pull request**
- expected output is clear
- likely verification is known (a test, a command, a visible behavior)
- no product, UX, architecture, security, payment-channel/claim, on-chain,
  settlement, auth, or deployment judgment is required
- not already linked to active work

Good `agent:ready` examples: doc updates, broken links, stale README/`CLAUDE.md`
instructions, simple test additions, lint/format fixes, small chores, patch
dependency bumps with passing tests, simple CI config drift.

### Add `needs:human` when ANY holds

- requirements/expected behavior are ambiguous
- a real bug lacks a reproduction
- too large for one PR
- needs product/UX/architecture/security/payments/on-chain/settlement/auth/deploy
  judgment (much of TOON's protocol surface — claims, BTP, settlement, fees —
  lands here by default)
- you cannot classify with confidence
- a previous agent attempt failed and the next step is unclear

Do not mark `risk:medium`/`risk:high` issues `agent:ready` unless the user
explicitly opts in for this run.

## Agent Assessment

Put reasoning in the issue body (or a comment), not in extra labels. Only write or
rewrite it when the classification/plan actually changed — rewriting an identical
block every run spams notifications. Block format:

```markdown
## Agent Assessment

Risk: low | medium | high
Type: bug | feature | docs | test | refactor | chore
Agent-ready: yes | no

Reason:
<1-3 sentences.>

Suggested plan:
1. <small first step>
2. <small second step>
3. <verification step>

Human needed:   <!-- include only when routing to needs:human -->
<the specific question/decision blocking an agent.>
```

## Workflow

Run the whole loop each time against the selected repo.

### Step 1 — Load context
Read `AGENTS.md`/`CLAUDE.md`, README, contribution docs, issue templates, and the
toon-meta `context/` docs. Use them to classify risk; do not invent project
policy. Tracker beats local roadmap files on conflict (report the drift).

### Step 2 — Resolve backlog source
Use the repo the user names, else the current `toon-protocol` repo via `gh`. Load
the GitHub Project and record its field/status-option IDs before any mutation. If
no source resolves, stop and ask for the repo/Project.

### Step 3 — Ensure labels exist
`dry-run`: report missing labels. `apply`: create missing managed labels with the
colors above.

### Step 4 — Classify open issues
Fetch open issues with title, body, labels, comments, Project fields, and linked
PRs. For each: add exactly one `risk:*` if missing, one `type:*` if missing, then
decide `agent:ready` / `needs:human` / neither. **Never override existing managed
labels** — fill gaps only, report disagreements. Add/update the Agent Assessment
only if it changed. When confidence is low, prefer `needs:human` with a specific
question over a speculative `agent:ready`.

### Step 5 — Sync issue state with PRs
Check **live** PR state (draft flag, mergeability, checks, reviews, unresolved
threads) — never infer completion from a branch name or PR title.
- **Linked PR open:** move the Project item to the review state if available;
  remove `agent:ready` (work is in progress); comment only if it adds state.
- **Linked PR merged:** remove `agent:ready`; close the issue when the PR clearly
  resolves it; move the Project item to Done; preserve `risk:*`/`type:*` for
  audit.
- **Linked PR closed unmerged:** remove `agent:ready`; add `needs:human` if the
  next step is unclear; comment the known reason.
Never close an issue without clear merged-PR evidence. Never mark done while
checks are failing/pending or actionable review threads remain.

### Step 6 — Sweep for quality drift (evidence-driven, bounded)
Look for concrete, fixable problems — not speculative refactors: stale docs that
misstate issue/code state, local roadmap contradicting the tracker, broken
local Markdown links, README/setup steps absent from `package.json`/justfile/CLI
help, accidentally skipped tests/disabled checks, recent default-branch CI
failures, bounded TODO/FIXME work, simple config/lint drift. Skip anything needing
product/UX/security/payments/on-chain/settlement/auth/deploy judgment. **Dedupe
against existing open and recently closed issues** before proposing anything.

### Step 7 — Candidate issues
`dry-run`: output candidates only (no creation), each with: title, evidence
(file/command/PR/code ref), why it matters, a small suggested fix, risk, type,
agent-ready, confidence, create-issue yes/no. `apply`: create an issue only with
concrete evidence **and** high confidence; otherwise mention it in the report.
Every created issue includes evidence, why it matters, a small suggested fix, and
an Agent Assessment.

### Step 8 — Report unneeded branches (report-only)
List cleanup-prospect branches (merged into default, tied to closed/merged PRs,
stale automation branches) with evidence. **Never delete branches here.**

### Step 9 — Verify (apply runs)
Confirm: every open issue has one `risk:*` + one `type:*`; any `agent:ready`
without `risk:low` or alongside `needs:human` is **flagged, not auto-fixed**
(a human may have set it); every `risk:high` has `needs:human` unless clearly
human-owned; every classified issue has an Agent Assessment; issues with open
PRs are in review state, merged-PR issues in Done; no issue is both closed and
left active. Use `gh issue list --json number,title,labels,body` to verify, not
the web UI.

### Step 10 — Report
Compact summary: repo + Project used, mode, steps run, issues inspected, labels
created/missing, issues changed, counts marked `agent:ready` / `needs:human` /
closed-or-synced, sweep candidates found-or-created, branch cleanup prospects,
verification result, and **blockers + recommended next action**.

## Scheduled / cron runs

For scheduled hygiene, run the full loop each time. Cron prompts must be
self-contained: name the repo, the source-of-truth rule, the allowed mutation
policy, whether to create issues or only propose candidates, verification
requirements, and the delivery target. Default scheduled behavior must **not**
merge PRs, publish releases, change secrets, spend money, delete branches, or make
high-risk changes. A cron may run in `dry-run`, or in conservative `apply` once
the user has approved exactly which mutations are allowed for that repo.

## GitHub adapter (gh)

```bash
gh repo view --json nameWithOwner,url
gh label list --limit 200
gh label create "risk:low" --color "0E8A16" --description "Low-risk; agent-executable when agent:ready"
gh issue list --state open --limit 100 --json number,title,body,labels,url,createdAt,updatedAt,comments
gh issue edit <n> --add-label "risk:low,type:docs,agent:ready"
gh issue comment <n> --body-file <file>
gh issue close <n> --comment "Closed because linked PR <url> merged."
gh project field-list <num> --owner toon-protocol --format json
gh project item-list <num> --owner toon-protocol --limit 200 --format json
gh project item-edit --id <item-id> --project-id <pid> --field-id <status-field-id> --single-select-option-id <option-id>
```

For linked PRs use `gh pr view`/GraphQL — exact linked-PR data, never branch-name
guessing. Project writes can be flaky: on a timeout, query the item before
retrying so you don't duplicate comments/items; retry serially and verify final
status.

## Safety rules

- Default to `dry-run`; mutate only on explicit `apply`.
- Never remove/downgrade existing managed labels during classification (Step 5 is
  the only step allowed to remove `agent:ready`).
- Never add `agent:ready` to `risk:medium`/`risk:high` issues by default.
- Never auto-close without clear merged-PR evidence; never mark done with failing
  checks or unresolved actionable review threads.
- Never implement code, merge PRs, or delete branches from this skill.
- When unsure, classify conservatively and route through `needs:human`.

## Quality bar

- [ ] Uses only the fixed managed label set.
- [ ] Existing managed labels respected; classification only filled gaps.
- [ ] Each classified issue has one risk + one type label.
- [ ] `agent:ready` only on low-risk, clear, verifiable, single-PR work.
- [ ] Human decisions routed via `needs:human`, not extra labels.
- [ ] Reasoning lives in the Agent Assessment, not label sprawl.
- [ ] Closes only on clear merged-PR evidence; branch cleanup is report-only.
- [ ] Final report is concise and actionable.
