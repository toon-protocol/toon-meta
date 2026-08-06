# TASK

Review the documentation changes on branch `{{BRANCH}}` along two axes, then
deliver a structured verdict:

1. **Standards** — improve clarity, consistency, and correctness while
   preserving the intended meaning.
2. **Spec** — does the change actually satisfy the issue it targets and its
   acceptance criteria?

This is **toon-meta**, a docs / tracker repo — the diff is almost always prose,
JSON, templates, or eval suites, not application code.

# CONTEXT

## Target issue

Issue: #{{ISSUE_NUMBER}} — {{ISSUE_TITLE}}

If the issue number above is `none`, no target issue could be resolved for this
branch; skip the Spec axis and review the Standards axis only.

Otherwise, BEFORE reading the diff, run:

    gh issue view {{ISSUE_NUMBER}}

and read the issue body — especially its acceptance criteria. The Spec axis
reviews the diff AGAINST THOSE CRITERIA, not against the diff itself.

## Branch diff

!`git diff {{TARGET_BRANCH}}...{{BRANCH}}`

## Commits on this branch

!`git log {{TARGET_BRANCH}}..{{BRANCH}} --oneline`

# REVIEW PROCESS

1. **Understand the change**: Read the issue (above) and the diff and commits
   to understand the intent.

2. **Spec axis**: Check the diff against the target issue:
   - Does the change actually resolve what the issue asked for?
   - Is every acceptance criterion met by the diff (not merely claimed)?
   - Does anything in the diff contradict the issue?

3. **Analyze for improvements** (Standards axis): Look for opportunities to:
   - Fix inaccuracies, stale references, and broken cross-links
   - Improve readability and remove redundancy
   - Make terminology and formatting consistent with neighbouring docs
   - Ensure headings, lists, and code fences are well-formed
   - Keep any JSON / template / eval edits well-formed and matching their siblings

4. **Check correctness**:
   - Are internal links valid and do referenced files/anchors exist?
   - Are code samples, commands, and config snippets correct?

5. **Maintain balance**: Avoid over-editing that could:
   - Change the documented meaning or intent
   - Restructure files the issue did not ask to touch
   - Introduce churn in unrelated sections

6. **Apply project standards**: Follow the standards defined in @.sandcastle/CODING_STANDARDS.md

7. **Preserve meaning**: Never change what the docs assert — only how clearly they say it.

# WHAT YOU FIX vs WHAT IS BLOCKING

Fix yourself (Standards axis): presentation-level issues — wording, structure,
formatting, broken links, malformed JSON, inconsistent terminology.

BLOCKING (report in the verdict, do NOT rewrite): a defect that makes the
change wrong to merge —

- the diff fails or contradicts the target issue's acceptance criteria
- the diff asserts something factually wrong that you cannot verify a fix for
- the diff would break the gate or downstream consumers of these docs

Never rewrite the substance of the change to force a pass. Substance defects
are the author's to fix; your channel for them is the verdict below.

# EXECUTION

If you find Standards improvements to make:

1. Make the changes directly on this branch
2. Run the doc gate to ensure nothing is broken — `npm run lint:md`,
   `npm run check:links`, and `npm run validate:json` (or `npm run gate`)
3. Commit describing the refinements

If the docs are already clean and well-structured, make no commits.

# REQUIRED VERDICT (structured output)

You MUST end your final message with exactly one verdict block. The block is
machine-parsed; a missing or malformed block FAILS the run. Emit it even when
you made no changes.

Format — JSON only inside the tag, no comments, no trailing commas, no code
fences:

<review>
{"verdict":"clean","blockingFindings":[]}
</review>

Rules:

- `verdict` is `"clean"` or `"blocking"` — nothing else.
- `blockingFindings` MUST be empty for `clean` and non-empty for `blocking`.
- Each finding is
  `{"file":"<repo-relative path>","line":<1-based number or null>,"summary":"<one line>","why":"<why this blocks the merge>"}`
  — `line` is `null` for file-level findings.
- Standards fixes you already made are NOT findings; findings are only the
  blocking defects defined above.

Once complete, output the verdict block and then <promise>COMPLETE</promise>.

## Context budget

Operate as if your context is capped at **~200k tokens**, whatever your model's actual window
is (see `CLAUDE.md` → *Context budget policy*). Treat ~200k as a hard ceiling, not a target.

Start preparing a handoff at roughly **120k** tokens of context, and hand off no later than
roughly **160k** — never run to the ceiling. Handing off means: write a structured handoff note
(what you reviewed, what you changed, what is left to check, and exact file/line pointers) to
`.sandcastle/logs/handoff-<task-id>.md`, commit it on this branch so it survives the sandbox,
and end your turn so a fresh agent continues.
