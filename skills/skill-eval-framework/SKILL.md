---
name: skill-eval-framework
description: Evaluate, validate, and benchmark TOON Claude Agent Skills using the skill-creator methodology extended with TOON compliance checks. Use when asked to evaluate a TOON skill ("evaluate this TOON skill", "run evals on this skill", "validate this skill"), check TOON compliance ("check TOON compliance", "is this skill TOON-compliant?", "run compliance checks"), benchmark skill performance ("benchmark this skill", "what's the pass rate?", "run skill benchmarks"), run batch validation across all skills ("validate all skills", "run batch validation", "aggregate compliance report"), grade skill output ("grade this skill's output", "produce grading results"), check if a skill is ready for publication ("is this skill ready?", "publication readiness check"), or run with/without testing to measure skill value-add ("compare with and without skill", "measure skill effectiveness").
---

# Skill Eval Framework (TOON-Extended)

Evaluate, grade, and benchmark TOON Claude Agent Skills. This framework adopts the skill-creator methodology (evals.json, grading.json, benchmark.json, workspace structure) and extends it with 6 TOON compliance assertions. Every skill produced by the NIP-to-TOON pipeline must pass this framework before publication.

## Single Skill Evaluation

To evaluate one skill:

1. Run structural validation via `validate-skill.sh` (from the nip-to-toon-skill pipeline). Verify SKILL.md exists, frontmatter is valid, references/ exists, evals/evals.json is valid JSON, Social Context section present, no bare EVENT patterns, description length 50-200 words, body under 500 lines.
2. Run TOON compliance assertions (6 checks, see below).
3. Load `evals/evals.json` from the skill directory.
4. Execute trigger evals: for each query, determine if the skill would activate. Compare against `should_trigger` field. Track accuracy.
5. Execute output evals: for each prompt, generate a response with the skill loaded, then grade against the assertions array.
6. Produce `grading.json` with per-assertion results.
7. Produce `benchmark.json` with aggregate pass rate, timing, and token usage.

## TOON Compliance Assertions (6 Checks)

Classify the skill first:
- **Write-capable:** SKILL.md or references mention `publishEvent()` or writing/publishing event kinds.
- **Read-capable:** SKILL.md or references mention TOON-format strings or reading/subscribing to events.
- **Both:** mentions both publishing and reading patterns.

Then run applicable assertions:

1. **`toon-write-check`** (write-capable only): Skill references `publishEvent()` from `@toon-protocol/client`. No bare EVENT array patterns in any .md file.
2. **`toon-fee-check`** (write-capable only): Skill mentions `basePricePerByte`, fee calculation, or references fee documentation.
3. **`toon-format-check`** (read-capable only): Skill documents TOON-format strings in relay responses, not assumed JSON.
4. **`social-context-check`** (all): Has `## Social Context` section that is NIP-specific (passes substitution test).
5. **`trigger-coverage`** (all): Description includes both protocol-technical AND social-situation triggers.
6. **`eval-completeness`** (all): Has at least 6 trigger evals (mix of should/should-not) + 4 output evals with assertions.

## With/Without Testing

Measure the value-add of a skill by running parallel evaluations:

1. Create workspace directory: `workspace/iteration-N/eval-ID/`
2. **With-skill run:** Load the skill, prompt the agent with each output eval, save responses to `with_skill/outputs/`.
3. **Without-skill run:** Baseline Claude (no skill), same prompts, save to `without_skill/outputs/`.
4. Grade both runs against the same assertions.
5. Compare: the difference in pass rate is the skill's value-add.
6. Save `eval_metadata.json`, `timing.json`, and `grading.json` in each run directory.

## Batch Runner

Validate all skills in one pass:

1. Discover skills: find all directories under `.claude/skills/` that contain `evals/evals.json`.
2. Filter: skip `skill-creator`, `playwright-cli`, `rfc-*` (different format, no TOON evals).
3. For each discovered skill: run structural validation + TOON compliance assertions.
4. Collect per-skill results: `{ skill_name, structural_pass, toon_compliance: { assertion: pass/fail }, overall: pass/fail }`.
5. Produce aggregate compliance report: JSON to stdout, summary table to stderr.

## Aggregate Report Format

The aggregate report includes:
- Per-skill compliance matrix (6 assertions x N skills)
- Overall pass rate across all skills
- List of failing skills with specific failed assertions
- Timestamp and skill count metadata

## When to Read Each Reference

- **Executing evals from evals.json** -- Read [eval-execution-guide.md](references/eval-execution-guide.md) for the step-by-step eval execution procedure, timing measurement, and error handling.
- **Grading agent output against assertions** -- Read [grading-format.md](references/grading-format.md) for the grading.json schema, rubric-based grading logic, and pass/fail determination.
- **Aggregating benchmark results** -- Read [benchmark-format.md](references/benchmark-format.md) for the benchmark.json schema and aggregation formulas.
- **Running TOON compliance checks** -- Read [toon-compliance-runner.md](references/toon-compliance-runner.md) for detailed check procedures for all 6 assertions.
- **Running batch validation across skills** -- Read [batch-runner-guide.md](references/batch-runner-guide.md) for discovery, filtering, execution, and aggregate reporting.
- **Understanding workspace directory layout** -- Read [workspace-structure.md](references/workspace-structure.md) for iteration workspace conventions and file placement.

## Social Context

Evaluating skills is a quality gate activity that directly impacts agent behavior across the TOON network. Every skill that passes this framework will shape how agents interact on paid relay networks. Thoroughness matters because a false negative (letting a defective skill through) means agents will publish incorrectly, waste money on failed transactions, or violate social norms. False positives (rejecting a good skill) waste developer time and slow the pipeline. Calibrate assertions carefully: use the 80% threshold to account for LLM non-determinism, but never lower the bar on TOON protocol compliance (payment and format checks are binary, not subjective).

## Integration with Other Skills

- **`nip-to-toon-skill`** (Story 9.2): Produces the skills this framework evaluates. The pipeline generates evals.json; this framework consumes it.
- **`nostr-protocol-core`** (Story 9.1): Calibration target. Write-capable skill that should pass all TOON compliance assertions.
- **`nostr-social-intelligence`** (Story 9.0): Calibration target. Social judgment skill with rubric-based grading.
- **`skill-creator`**: Defines the eval format (evals.json, grading.json, benchmark.json) this framework uses.
