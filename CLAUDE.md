# CLAUDE.md

Guidance for Claude Code sessions in this repo.

## Context budget policy

Peak model performance degrades as the context window fills. Every session — the main session and every spawned agent — must operate as if its context is capped at **~200k tokens**, and should do its real work well below that cap.

Rules:

1. **Cap all sessions at ~200k tokens of context.** Never plan work that assumes a single session can hold more than that. Treat ~200k as a hard ceiling, not a target.

2. **Break work down into granular tasks.** When decomposing an epic, feature, or investigation, split it into tasks that can each be completed comfortably within a single ~200k-token context window — including the reading, tool output, and iteration the task will actually require, not just the final diff. If a task might not fit, split it further before dispatching it.

3. **Always spawn agents to handle work.** Delegate tasks to subagents (via the Agent tool) rather than accumulating everything in the main session's context. The main session orchestrates: it holds the task list, dispatches agents, and integrates their results. Agents do the heavy reading and editing.

4. **Hand off before hitting the cap.** If an agent (or the main session) is approaching the context cap but still has work remaining, it must stop, spawn a fresh agent, and pass it a handoff. A handoff must contain everything the fresh agent needs to continue without re-reading the whole history:
   - the goal and remaining work, as a concrete task list
   - what has been done so far, and where (files, branches, PRs, commits)
   - key decisions made and why, plus any constraints or gotchas discovered
   - exact pointers (paths, line numbers, ticket/PR numbers) instead of "see above"

   As a working threshold: start preparing the handoff by ~60% of the context window, and hand off no later than ~80% — never run a session to the ceiling.

5. **Handoffs are recursive.** A spawned agent that approaches its own cap follows the same rule: spawn a successor, write the handoff, and terminate cleanly. No session ever "pushes through" a full context window.
