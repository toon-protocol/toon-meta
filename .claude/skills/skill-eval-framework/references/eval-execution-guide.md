# Eval Execution Guide

> **Why this procedure exists:** Evals are the quantitative backbone of skill quality. Without a consistent execution procedure, eval results vary based on who runs them and how. This guide ensures every skill is evaluated the same way, producing comparable results across the entire skill catalog.

## Loading evals.json

The eval file lives at `<skill-dir>/evals/evals.json`. Parse it to extract two arrays:

- `trigger_evals`: Array of `{ query: string, should_trigger: boolean }` objects. These test whether the skill activates for the right queries and stays silent for wrong ones.
- `output_evals`: Array of `{ id: string, prompt: string, expected_output?: string, rubric: { correct: string, acceptable: string, incorrect: string }, assertions: string[] }` objects. These test the quality of the skill's responses.

Validate the JSON before proceeding. If parsing fails, report the error and stop -- malformed evals cannot produce meaningful results.

## Executing Trigger Evals

For each trigger eval:

1. Present the `query` to the skill activation logic (check if the query matches the skill's `description` field triggers).
2. Record whether the skill would activate (true/false).
3. Compare against `should_trigger`.
4. Track: total trigger evals, correct activations, incorrect activations.
5. Calculate trigger accuracy: `correct / total`.

**Why trigger accuracy matters:** A skill that activates on wrong queries creates noise. A skill that fails to activate on correct queries is invisible. Both are defects.

## Executing Output Evals

For each output eval:

1. Load the skill into the agent context.
2. Present the `prompt` to the agent.
3. Capture the full response text.
4. Record timing: start timestamp, end timestamp, duration in seconds.
5. Record token usage if available: prompt tokens, completion tokens.
6. Save the response to `outputs/<eval-id>.txt`.

## Timing Measurement

Wrap each eval execution with timing:

```
start_time = current_timestamp()
response = execute_eval(prompt)
end_time = current_timestamp()
duration = end_time - start_time
```

Save timing data to `timing.json`:
```json
{
  "eval_id": "write-model-basic",
  "start": "2026-03-25T10:00:00Z",
  "end": "2026-03-25T10:00:03.5Z",
  "duration_seconds": 3.5
}
```

**Why timing matters:** Slow evals indicate the skill is triggering expensive reasoning chains or loading too many references. Timing regression between iterations signals a description or body change that increased token consumption.

## Token Counting

If the execution environment provides token usage:
- Record `prompt_tokens` (input to the model including skill content).
- Record `completion_tokens` (model's response).
- Large prompt token counts suggest the skill body or references are too verbose.
- Large completion token counts suggest the skill encourages overly detailed responses.

## Error Handling

- **Malformed evals.json:** Stop and report. Do not attempt partial execution.
- **Agent timeout:** Record as a failed eval with evidence "Agent timed out after N seconds."
- **Empty response:** Record as a failed eval with evidence "Agent produced empty response."
- **Missing skill directory:** Stop and report the path that was not found.
- **Missing assertions array:** Treat as 0 assertions passed. Report as a warning -- output evals should always have assertions.

## Grading After Execution

After all output evals are executed, pass each response through the grading procedure (see grading-format.md). The grading step is separate from execution because:

1. Execution captures raw responses. Grading interprets them.
2. Grading can be re-run on saved responses without re-executing (useful for calibration).
3. Different grading criteria can be applied to the same responses (useful for iteration).
