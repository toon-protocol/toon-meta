---
name: backlog-manager
description: >-
  Engineering backlog manager for the TOON Protocol polyrepo. Triages GitHub
  Issues (and the repo's GitHub Project), classifies each issue by risk (label)
  and type (native org Issue Type via GraphQL), marks safe single-PR work
  `agent:ready` so the issue-executor loop can pick it
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
It is the first loop of the backlog pipeline:

```
Loop A backlog-manager ─agent:ready─► Loop B issue-executor ─PR─► Loop C reviewer
        ▲   │                                                           │
        │   └─agent:split─► Loop D issue-decomposer ─child issues─┐     │
        │                                                         │     │
        └──────────── PR-evidence sync (Step 5) ◄── merged PR ────┴─────┘
```

This skill **does not implement code**. Its only output is a clean, labeled
backlog: an `agent:ready` queue that [[issue-executor]] consumes, and — for work
that is clear and safe but **too large for one PR** — an `agent:split` queue that
[[issue-decomposer]] slices into executor-sized children.

**Default mode is `dry-run`.** Only mutate GitHub when the user explicitly passes
`apply`. When running unattended (cron / non-interactive), never prompt — record
blockers in the final report and exit.

## TOON polyrepo context

The source of truth is GitHub Issues for one `toon-protocol` repo, plus that
repo's GitHub Project board when accessible. The org repos and their owners are in
`context/repos.md` (`toon`, `relay`, `swap`, `store`, `toon-client`,
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

## Classification surfaces

Two dimensions live in **labels**, one lives in the **native org Issue Type**
field. Leave unrelated tracker labels (`enhancement`, `good first issue`, etc.)
untouched unless the user asks to normalize them.

**Risk (label)** — `risk:low` (safe for agent execution when also `agent:ready`),
`risk:medium` (maybe agent-suitable later; not unattended by default),
`risk:high` (human-led).

**Routing (labels)** — `agent:ready` (permission for the executor loop to pick it
up), `agent:split` (clear, safe work that is too large for one PR — hand to the
[[issue-decomposer]] loop), `needs:human` (a decision/clarification/judgment is
required).

**Loop bookkeeping (label)** — `review-round:<n>` is owned by the executor/reviewer
loops; never set it here, but preserve it.

Recommended GitHub label colors: `risk:low` `0E8A16`, `risk:medium` `FBCA04`,
`risk:high` `B60205`, `agent:*` `1D76DB`, `needs:human` `D93F0B`, `tracking`
`5319E7` (set on a parent that the decomposer split into children).

### Type is a native Issue Type, not a label

The **Type** dimension uses GitHub's **native organization Issue Types** (a
first-class single-select field), not `type:*` labels. The org taxonomy is the six
types **`Bug`, `Feature`, `Docs`, `Test`, `Refactor`, `Chore`** (the default
`Task` may exist; this skill does not use it). Each issue gets **exactly one**.

`gh` (≤2.45) cannot read or write Issue Types, so use GraphQL (see GitHub
adapter). Resolve the org type name→ID map once per run before classifying. If a
required org type is missing, **report it** — do **not** create org-level Issue
Types from this skill unless the user explicitly asks (it's an org-config change).

If an older repo still carries legacy `type:*` labels, treat them as context only;
do not manage them. The native Issue Type is authoritative.

### Managed labels are additive

Trackers don't record who set a label, so treat every existing managed label and
every existing Issue Type as **deliberately human-set**. Never remove or change an
existing `risk:*`, `agent:ready`, or `needs:human` label, or an existing Issue
Type, during classification — only fill gaps. If your classification disagrees
with an existing value, **keep it and raise the disagreement in the report**. The
only exception is Step 5 (PR-evidence sync), which may remove `agent:ready` once
work is demonstrably in progress or done.

## Risk & routing rules

The executor loop must be able to query `agent:ready` and trust it without
re-litigating product risk.

### Add `agent:ready` only when ALL hold

- `risk:low`
- scope is clear and fits in **one pull request**
- expected output is clear
- likely verification is known (a test, a command, a visible behavior)
- no product, UX, architecture, security, auth, or deployment judgment is required;
  payment-channel/claim, on-chain, settlement, and deploy work qualifies **only**
  under the testnet/devnet carve-out (see below)
- not already linked to active work

Good `agent:ready` examples: doc updates, broken links, stale README/`CLAUDE.md`
instructions, simple test additions, lint/format fixes, small chores, patch
dependency bumps with passing tests, simple CI config drift, adopting the devbox
dev-environment standard (a `devbox.json` + non-gating `devbox-validate` CI job +
README section from the toon-meta `templates/devbox/` — `risk:low` `Chore`, no
on-chain/funds exposure).

### Add `agent:split` when the ONLY blocker is size

When an issue is otherwise clear and safe — low/medium risk, well-understood
scope, known verification, no product/UX/architecture/security/payments/auth/deploy
judgment required (payment-channel/claim, on-chain, settlement, and deploy work
allowed under the testnet/devnet carve-out) — but the work is **too large for one PR /
one executor run**, route it to the [[issue-decomposer]] loop with
`agent:split` instead of parking it on a human. The decomposer slices it into
executor-sized children and keeps this issue open as a `tracking` parent.

Use `agent:split` only when size is the *sole* obstacle. If slicing the work would
itself require a judgment call (which approach, what the phases are), that is a
`needs:human` decision, not a split — the decomposer will bounce it back anyway.
Do not also add `agent:ready` to a `agent:split` issue; the parent is never
executed directly. (A `risk:medium` issue may be `agent:split` even though it is
not `agent:ready` — its individual slices get re-classified on their own merits.)

### Add `needs:human` when ANY holds

- requirements/expected behavior are ambiguous
- a real bug lacks a reproduction
- too large for one PR **and** slicing it needs a judgment call (otherwise prefer
  `agent:split` — clean size-only oversize goes to the decomposer, not a human)
- needs product/UX/architecture/security/payments/on-chain/settlement/auth/deploy
  judgment (much of TOON's protocol surface — claims, BTP, settlement, fees —
  lands here by default) **except** when the testnet/devnet carve-out applies (see
  below)
- you cannot classify with confidence
- a previous agent attempt failed and the next step is unclear

Do not mark `risk:medium`/`risk:high` issues `agent:ready` unless the user
explicitly opts in for this run.

### Testnet/devnet carve-out

On-chain, settlement, payment-channel/claim, and deploy work is **not** auto-routed
to `needs:human` when **both** of the following signals appear in the issue body:

```
**Network:** testnet / devnet
**Funds:** treasury wallet, ≤ $X (bounded)
```

When both signals are present (they appear in every WS2/WS3 issue body), classify
such work as `risk:low` + `agent:ready` provided all other conditions hold. The
signals confirm: (a) no mainnet exposure, (b) no real user funds at risk, (c)
amounts are explicitly bounded.

**Always `needs:human`** regardless of signals: any mainnet contact, real or
unbounded user funds, key custody changes, fee/settlement-parameter decisions, or
BTP transport mutations.

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

### Step 3 — Ensure labels and Issue Types exist
`dry-run`: report missing managed labels and any missing org Issue Types.
`apply`: create missing managed labels with the colors above. Resolve the org
Issue Type name→ID map (GraphQL). Do **not** create missing org-level Issue Types
from this skill — report them as a setup blocker unless the user explicitly asks.

### Step 4 — Classify open issues
Fetch open issues with node id, title, body, labels, current Issue Type, comments,
Project fields, and linked PRs. For each: add exactly one `risk:*` label if
missing; set the native Issue Type (GraphQL `updateIssueIssueType`) if unset;
then decide `agent:ready` / `needs:human` / neither. **Never override an existing
managed label or an already-set Issue Type** — fill gaps only, report
disagreements. Add/update the Agent Assessment only if it changed. When confidence
is low, prefer `needs:human` with a specific question over a speculative
`agent:ready`.

### Step 5 — Sync issue state with PRs
Check **live** PR state (draft flag, mergeability, checks, reviews, unresolved
threads) — never infer completion from a branch name or PR title.
- **Linked PR open:** move the Project item to the review state if available;
  remove `agent:ready` (work is in progress); comment only if it adds state.
- **Linked PR merged:** remove `agent:ready`; close the issue when the PR clearly
  resolves it; move the Project item to Done; preserve the `risk:*` label and the
  Issue Type for audit.
- **Linked PR closed unmerged:** remove `agent:ready`; add `needs:human` if the
  next step is unclear; comment the known reason.
Never close an issue without clear merged-PR evidence. Never mark done while
checks are failing/pending or actionable review threads remain.

**Tracking parents (split by [[issue-decomposer]]):** an issue with the `tracking`
label and a `## Decomposition` task list is closed indirectly — through its
children, not a PR of its own. Read its child issues (from the task list); when
**every** child is closed, check off the list, close the parent (comment linking
the merged children), and move its Project item to Done. While any child is open,
keep the parent open and tick off the children that have closed. Never mark a
child `agent:ready` on the parent, and never re-split a `tracking` parent.

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
Confirm: every open issue has one `risk:*` label **and** a native Issue Type; any
`agent:ready` without `risk:low` or alongside `needs:human`/`agent:split` is
**flagged, not auto-fixed** (a human may have set it); every `risk:high` has
`needs:human` unless
clearly human-owned; every classified issue has an Agent Assessment; issues with
open PRs are in review state, merged-PR issues in Done; no issue is both closed and
left active. Verify labels with `gh issue list --json number,title,labels,body`
and Issue Types with the GraphQL read query — not the web UI.

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

## GitHub adapter

Labels, comments, and closes use `gh`. **Issue Types use GraphQL** (`gh` ≤2.45
has no `--type` support and `--json issueType` is rejected).

```bash
# Labels / comments / close (gh is fine)
gh repo view --json nameWithOwner,url
gh label list --limit 200
gh label create "risk:low" --color "0E8A16" --description "Low-risk; agent-executable when agent:ready"
gh issue list --state open --limit 100 --json number,title,body,labels,url,createdAt,updatedAt,comments
gh issue edit <n> --add-label "risk:low,agent:ready"   # routing/risk only — NOT type
gh issue comment <n> --body-file <file>
gh issue close <n> --comment "Closed because linked PR <url> merged."

# Project board (org Projects need an App token with Org Projects R/W)
gh project field-list <num> --owner toon-protocol --format json
gh project item-list <num> --owner toon-protocol --limit 200 --format json
gh project item-edit --id <item-id> --project-id <pid> --field-id <status-field-id> --single-select-option-id <option-id>
```

Issue Types (GraphQL):

```bash
# 1. Resolve the org type name->ID map once per run
gh api graphql -f query='query { organization(login:"toon-protocol"){
  issueTypes(first:20){ nodes { id name } } } }'

# 2. Read an issue's node id + current type
gh api graphql -f query='query { repository(owner:"OWNER", name:"REPO"){
  issue(number:N){ id issueType { id name } } } }'

# 3. Set the type (issueTypeId from step 1; pass null to clear)
gh api graphql -f query='mutation($issue:ID!,$type:ID){
  updateIssueIssueType(input:{issueId:$issue, issueTypeId:$type}){
    issue { number issueType { name } } } }' -F issue=<issue-node-id> -F type=<type-id>
```

For linked PRs use `gh pr view`/GraphQL — exact linked-PR data, never branch-name
guessing. Project writes can be flaky: on a timeout, query the item before
retrying so you don't duplicate comments/items; retry serially and verify final
status.

## Safety rules

- Default to `dry-run`; mutate only on explicit `apply`.
- Never remove/downgrade existing managed labels or an already-set Issue Type
  during classification (Step 5 is the only step allowed to remove `agent:ready`).
- Never create or delete org-level Issue Types from this skill; report missing
  ones as a setup blocker.
- Never add `agent:ready` to `risk:medium`/`risk:high` issues by default.
- Never auto-close without clear merged-PR evidence; never mark done with failing
  checks or unresolved actionable review threads.
- Never implement code, merge PRs, or delete branches from this skill.
- When unsure, classify conservatively and route through `needs:human`.

## Quality bar

- [ ] Uses only the fixed managed label set (risk + routing); Type is the native
      Issue Type, never a `type:*` label.
- [ ] Existing managed labels and Issue Types respected; classification only
      filled gaps.
- [ ] Each classified issue has one `risk:*` label and one native Issue Type.
- [ ] `agent:ready` only on low-risk, clear, verifiable, single-PR work.
- [ ] Human decisions routed via `needs:human`, not extra labels.
- [ ] Reasoning lives in the Agent Assessment, not label sprawl.
- [ ] Closes only on clear merged-PR evidence; branch cleanup is report-only.
- [ ] Final report is concise and actionable.
