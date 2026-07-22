# TASK

Review the documentation changes on branch `{{BRANCH}}` and improve clarity,
consistency, and correctness while preserving the intended meaning.

This is **toon-meta**, a docs / tracker repo — the diff is almost always prose,
JSON, templates, or eval suites, not application code.

# CONTEXT

## Branch diff

!`git diff {{TARGET_BRANCH}}...{{BRANCH}}`

## Commits on this branch

!`git log {{TARGET_BRANCH}}..{{BRANCH}} --oneline`

# REVIEW PROCESS

1. **Understand the change**: Read the diff and commits above to understand the intent.

2. **Analyze for improvements**: Look for opportunities to:
   - Fix inaccuracies, stale references, and broken cross-links
   - Improve readability and remove redundancy
   - Make terminology and formatting consistent with neighbouring docs
   - Ensure headings, lists, and code fences are well-formed
   - Keep any JSON / template / eval edits well-formed and matching their siblings

3. **Check correctness**:
   - Does the change actually resolve the issue it targets?
   - Are internal links valid and do referenced files/anchors exist?
   - Are code samples, commands, and config snippets correct?

4. **Maintain balance**: Avoid over-editing that could:
   - Change the documented meaning or intent
   - Restructure files the issue did not ask to touch
   - Introduce churn in unrelated sections

5. **Apply project standards**: Follow the standards defined in @.sandcastle/CODING_STANDARDS.md

6. **Preserve meaning**: Never change what the docs assert — only how clearly they say it.

# EXECUTION

If you find improvements to make:

1. Make the changes directly on this branch
2. Run the doc gate to ensure nothing is broken — `npm run lint:md`,
   `npm run check:links`, and `npm run validate:json` (or `npm run gate`)
3. Commit describing the refinements

If the docs are already clean and well-structured, do nothing.

Once complete, output <promise>COMPLETE</promise>.

## Context budget

If you approach ~60% of your context window, STOP: write a structured handoff note (current state + remaining steps) to `.sandcastle/logs/handoff-<task-id>.md` and end your turn so a fresh agent continues. Do not push past ~60% — small, resumable units beat one degraded run.
