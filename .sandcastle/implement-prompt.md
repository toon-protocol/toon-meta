# TASK

Resolve issue {{TASK_ID}}: {{ISSUE_TITLE}}

Pull in the issue using `gh issue view <ID>`. If it has a parent PRD/epic, pull that in too.

Only work on the issue specified.

Work on branch {{BRANCH}}. Make commits.

This is **toon-meta** — a docs / tracker repo (skills, NIP/RFC references, protocol
docs, templates, and eval suites). Most issues here are documentation changes:
new or updated `.md`, JSON/template edits, or eval-suite tweaks. There is **no
application source and no build/test suite** — do not invent one.

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with relevant information that will
allow you to complete the task. For docs work, read the neighbouring files in the
same directory and match their structure, tone, and formatting conventions.

# EXECUTION

1. Make the smallest change that fully resolves the issue.
2. Keep prose accurate and consistent with existing docs; do not restructure
   files that the issue did not ask you to touch.
3. If you add or change any JSON / template / eval file, keep it well-formed and
   matching the shape of its siblings.

# FEEDBACK LOOPS — the DOC GATE

This repo's gate is documentation-oriented (there is no lint/typecheck/test/build).
Before committing, run the doc gate and make sure every command passes:

- markdown lint: `npm run lint:md`
- link check:    `npm run check:links`
- JSON/template validation: `npm run validate:json`

(You can run all three at once with `npm run gate`.)

Do not commit until `lint:md`, `check:links`, and `validate:json` all pass. If a
pre-existing violation outside your change blocks the gate, do NOT mass-edit
unrelated files — note it on the issue and keep your change scoped.

# COMMIT

Make a git commit. The commit message must:

1. Start with `RALPH:` prefix
2. Include task completed + issue/PRD reference
3. Key decisions made
4. Files changed
5. Blockers or notes for next iteration

Keep it concise.

# THE ISSUE

If the task is not complete, leave a comment on the issue with what was done.

Do not close the issue - this will be done later.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.

## Context budget

If you approach ~60% of your context window, STOP: write a structured handoff note (current state + remaining steps) to `.sandcastle/logs/handoff-<task-id>.md` and end your turn so a fresh agent continues. Do not push past ~60% — small, resumable units beat one degraded run.
