---
name: bootstrap-factory
description: Bootstrap the current repo with the toon-protocol AFK factory (ready-for-agent issue → reviewed PR).
disable-model-invocation: true
argument-hint: "[--force]"
---

# Bootstrap the AFK factory

Installs the **AFK factory** in the current repo: an issue labelled `ready-for-agent` is
implemented and reviewed in a sandbox and comes back as a PR labelled `ready-for-human`.
The factory is copied from the **template**, `templates/factory/` in
`toon-protocol/toon-meta`. `bootstrap.sh` in this folder does everything mechanical; the
steps below are the parts that need a reading of this repo.

Everything stays uncommitted. The user commits.

## Steps

### 1. Agent docs first

The factory moves issues between the canonical triage labels, so the repo needs
`docs/agents/issue-tracker.md` (GitHub) and `docs/agents/triage-labels.md` with the five
labels under their default names. If either file is missing, run
`/mattpocock-skills:setup-matt-pocock-skills` and come back.

Done when both files exist and the right-hand column of the triage table equals the left.
If the repo renames a label, stop and tell the user: the runner and workflow hardcode the
default names.

### 2. Run the script

Run `bootstrap.sh` from this skill's base directory, with the repo as the working
directory. Add `--force` only when the user passed it to this command.

The script copies `.sandcastle/` and the two workflows, creates the missing labels, checks
the secrets and the GitHub App, runs the runner's own test and typecheck, and prints the
gate as the runner will read it. If it stops because factory files already exist, ask the
user before re-running with `--force`.

Done when it prints `bootstrap: done`. Every `WARN:` line is either fixed or carried into
the final report word for word.

### 3. Sharpen "This repository" in the implement prompt

`.sandcastle/implement-prompt.md` arrives with a `## This repository` section true of any
repo. Add this repo's facts to it, read from the tree: what the repo is, its stack and
package manager, further docs worth reading first, and what a sandbox must leave alone
(live boxes, funded keys, on-chain writes, anything the repo's own docs mark as guarded).
Keep the `wayfinder:*` bullet and the gate bullet as they are.

Leave the rest of the file and `review-prompt.md` as copied: every factory repo shares them.

Done when every sentence in the section is true of this repo and checkable in its tree. A
repo with nothing yet to say keeps the section as copied.

### 4. Describe the factory in CLAUDE.md

Add [`claude-md-section.md`](claude-md-section.md) to `CLAUDE.md` (or `AGENTS.md`, whichever
the repo has) after the `## Agent skills` block, replacing its `[GATE TODAY: …]` placeholder
with a sentence from the gate lines the script printed. If a `## The AFK factory` section
exists, update it in place.

Done when the section's gate sentence matches the script's gate output.

### 5. Report

Tell the user:

- what was added, and that it is uncommitted. The factory starts only once these files are
  on the default branch; the other repos landed it as a PR from `factory/afk-factory`.
- the gate: the steps it runs, or that it runs **nothing**. If a `ci.yml` exists but the
  gate is empty, name the job that should be called `gate` and offer to rename it. Ask
  first: a job's name is its check-run name, and branch protection may require the old one.
- every `WARN:` line still open.
- that no run has happened yet: the first `ready-for-agent` ticket is the end-to-end proof.

## Outside toon-protocol

The workflows assume three things the `toon-protocol` org provides: the secrets `APP_ID`,
`APP_PRIVATE_KEY` and `CLAUDE_CODE_OAUTH_TOKEN`, a GitHub App with contents, issues and
pull-requests write on the repo, and the public image
`ghcr.io/toon-protocol/sandcastle-agent`. In another org the script's warnings name what is
missing; the user provisions those before the first run.
