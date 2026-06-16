# Benchmark Format

> **Why benchmarking exists:** Individual eval results tell you if a skill works. Benchmarks tell you if it works consistently and efficiently. A skill that passes 5/5 assertions once but averages 60% over 10 runs has a reliability problem. A skill that passes consistently but takes 30 seconds per eval has a performance problem. Benchmarking surfaces both issues.

## benchmark.json Schema

```json
{
  "pass_rate": 85.0,
  "timing": {
    "mean": 4.2,
    "stddev": 1.1
  },
  "token_usage": {
    "prompt": 3200,
    "completion": 850
  },
  "metadata": {
    "skill_name": "nostr-protocol-core",
    "eval_count": 5,
    "assertion_count": 20,
    "passed_assertions": 17,
    "timestamp": "2026-03-25T10:30:00Z"
  }
}
```

### Field Definitions

- **`pass_rate`** (number): Percentage of assertions that passed across all output evals. Formula: `(passed_assertions / total_assertions) * 100`. Range: 0.0 to 100.0.
- **`timing.mean`** (number): Mean eval execution time in seconds across all output evals.
- **`timing.stddev`** (number): Standard deviation of eval execution times in seconds. High stddev indicates inconsistent performance.
- **`token_usage.prompt`** (number): Mean prompt tokens per eval. Includes system prompt + skill content + user prompt.
- **`token_usage.completion`** (number): Mean completion tokens per eval. The model's response length.
- **`metadata.skill_name`** (string): Name from the skill's frontmatter.
- **`metadata.eval_count`** (number): Total number of output evals executed.
- **`metadata.assertion_count`** (number): Total assertions across all output evals.
- **`metadata.passed_assertions`** (number): Total assertions that passed.
- **`metadata.timestamp`** (string): ISO 8601 timestamp of the benchmark run.

## Aggregation Formulas

### Pass Rate

```
pass_rate = (sum of passed assertions across all evals) / (sum of total assertions across all evals) * 100
```

This is a flat assertion-level aggregation, not an eval-level aggregation. A skill with 5 evals where one has 10 assertions and four have 2 assertions each weights the large eval proportionally.

**Why flat aggregation:** Eval-level aggregation (pass/fail per eval, then percentage of passed evals) hides assertion-level failures inside passing evals. If an eval has 10 assertions and 8 pass, eval-level says "pass" while flat says 80%. Flat is more honest.

### Timing Statistics

```
mean = sum(durations) / count(durations)
stddev = sqrt(sum((d - mean)^2 for d in durations) / count(durations))
```

Use population standard deviation (divide by N, not N-1) because we are measuring the full set of evals, not sampling from a larger population.

**Why timing matters:** A mean > 10 seconds per eval suggests the skill body or references are too large, causing excessive token processing. A high stddev suggests some evals trigger complex reasoning paths while others are simple -- this may indicate the description is too broad.

### Token Usage

```
prompt_mean = sum(prompt_tokens) / count(evals)
completion_mean = sum(completion_tokens) / count(evals)
```

**Why token usage matters:** High prompt tokens indicate the skill loads too many references per eval. High completion tokens indicate the skill encourages verbose responses. Both are cost and latency concerns.

## Interpreting Benchmarks

| Metric | Good | Warning | Bad |
|--------|------|---------|-----|
| pass_rate | >= 80% | 60-79% | < 60% |
| timing.mean | < 5s | 5-15s | > 15s |
| timing.stddev | < 2s | 2-5s | > 5s |
| token_usage.prompt | < 5000 | 5000-10000 | > 10000 |
| token_usage.completion | < 2000 | 2000-5000 | > 5000 |

These thresholds are guidelines, not hard gates. The 80% pass rate is the publication gate threshold (from D9-007). Timing and token thresholds are calibrated against Stories 9.0 and 9.1 baseline performance.

## Benchmark Comparison

When comparing benchmarks across iterations:
- Pass rate should increase or stay stable. A drop > 5% between iterations signals a regression.
- Timing should stay stable or decrease. An increase > 50% signals a body/reference size problem.
- Token usage should stay stable. A prompt token increase signals reference loading changes.

Store benchmarks per iteration in the workspace: `workspace/iteration-N/benchmark.json`. This enables trend analysis across the optimization loop.
