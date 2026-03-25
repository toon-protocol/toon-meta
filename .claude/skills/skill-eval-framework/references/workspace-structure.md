# Workspace Structure

> **Why a consistent workspace layout exists:** Eval results accumulate across iterations. Without a standard directory structure, results from different runs get mixed, overwritten, or lost. The workspace convention ensures every eval run has its own isolated directory, enabling comparison across iterations and reproducible benchmarking.

## Directory Layout

```
workspace/
  iteration-1/
    eval-write-model-basic/
      with_skill/
        outputs/
          response.txt          # Agent response text
        eval_metadata.json      # Eval context (skill name, eval id, timestamp)
        timing.json             # Execution timing (start, end, duration)
        grading.json            # Per-assertion results
      without_skill/
        outputs/
          response.txt
        eval_metadata.json
        timing.json
        grading.json
    eval-read-model-toon-format/
      with_skill/
        ...
      without_skill/
        ...
    benchmark.json              # Aggregate benchmark for this iteration
  iteration-2/
    ...
```

## File Specifications

### eval_metadata.json

Records the context of the eval run:

```json
{
  "skill_name": "nostr-protocol-core",
  "eval_id": "write-model-basic",
  "prompt": "I want to publish a short text note...",
  "timestamp": "2026-03-25T10:00:00Z",
  "iteration": 1,
  "mode": "with_skill"
}
```

**Why metadata exists:** When reviewing grading results days later, the metadata answers "what skill was this? what prompt was used? when did this run?" Without it, grading.json is context-free data.

### timing.json

Records execution performance:

```json
{
  "eval_id": "write-model-basic",
  "start": "2026-03-25T10:00:00Z",
  "end": "2026-03-25T10:00:03.5Z",
  "duration_seconds": 3.5
}
```

**Why timing is separate from grading:** Timing measures infrastructure performance (model latency, context loading). Grading measures skill quality. They are independent dimensions. A slow but correct response is a different problem than a fast but wrong one.

### grading.json

Per-assertion results (see grading-format.md for full schema):

```json
[
  {
    "text": "toon-write-check: Response uses publishEvent() API",
    "passed": true,
    "evidence": "Response contains 'client.publishEvent()' on line 3."
  }
]
```

### outputs/response.txt

The raw agent response text. Preserved for:
1. Re-grading with different assertion criteria.
2. Manual review of borderline cases.
3. Debugging false positives/negatives in grading.

### benchmark.json

Iteration-level aggregate (see benchmark-format.md for full schema). One benchmark.json per iteration, aggregating all eval results within that iteration.

## Creating Workspaces

When starting an eval run:

1. Determine the current iteration number. If `workspace/` does not exist, start at `iteration-1`. Otherwise, find the highest existing iteration number and increment.
2. Create `workspace/iteration-N/`.
3. For each output eval, create `workspace/iteration-N/eval-{eval_id}/`.
4. Create `with_skill/` and `without_skill/` subdirectories.
5. Create `outputs/` subdirectory in each.

## Navigating Workspaces

To find the latest results: list `workspace/iteration-*/` and sort numerically. The highest number is the latest iteration.

To compare iterations: load `benchmark.json` from each iteration and compare pass rates, timing, and token usage. A pass rate drop between iterations signals a regression.

## Cleanup

Workspaces can grow large (one directory per eval per iteration). Clean up old iterations when no longer needed:

- Keep the latest 3 iterations for trend analysis.
- Archive older iterations if needed for audit trails.
- Never delete `iteration-1` -- it is the baseline.

**Why keep the baseline:** The first iteration establishes the skill's initial quality. All improvements are measured against it. Without the baseline, there is no way to quantify total improvement across the optimization loop.
