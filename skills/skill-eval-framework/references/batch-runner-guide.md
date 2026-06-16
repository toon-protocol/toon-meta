# Batch Runner Guide

> **Why batch validation exists:** The TOON skill catalog will contain 30+ skills (Stories 9.4-9.33). Validating each one manually is not scalable. The batch runner ensures every skill in the catalog meets the same structural and TOON compliance standards, producing a single aggregate report that shows the health of the entire catalog at a glance.

## Skill Discovery

The batch runner discovers skills by searching for directories that contain eval files:

1. Start from the skills root directory (default: `.claude/skills/`).
2. Find all subdirectories that contain `evals/evals.json`.
3. This automatically includes pipeline-generated skills (Stories 9.0, 9.1, and future 9.4-9.33) and excludes skills without evals.

## Filtering Rules

Not all skills in `.claude/skills/` are TOON NIP skills. Filter out:

- **`skill-creator`**: The meta-skill defining skill anatomy. Uses a different eval format.
- **`playwright-cli`**: Browser automation skill. Not a TOON/Nostr skill.
- **`rfc-*`**: ILP RFC reference skills. No evals.json, different purpose.
- **`skill-eval-framework`**: This framework itself. Self-evaluation is handled separately during calibration, not in batch runs.

**Why filtering matters:** Running TOON compliance checks on non-TOON skills produces false failures (e.g., `playwright-cli` will never mention `publishEvent()`). Filtering prevents noise in the aggregate report.

## Execution Flow

For each discovered skill:

1. **Structural validation:** Run `validate-skill.sh` from the nip-to-toon-skill pipeline. This checks: SKILL.md exists, frontmatter valid, references/ exists, evals/evals.json valid JSON, Social Context section present, no bare EVENT patterns, description length, body length.
2. **TOON compliance:** Run the 6 TOON compliance assertions (see toon-compliance-runner.md). Classification is auto-detected per skill.
3. **Collect results:** Record structural pass/fail, per-assertion pass/fail, and overall pass/fail.

## Aggregate Report Format

The batch runner produces a JSON report to stdout:

```json
{
  "timestamp": "2026-03-25T10:30:00Z",
  "skills_discovered": 5,
  "skills_passed": 4,
  "skills_failed": 1,
  "results": [
    {
      "skill_name": "nostr-protocol-core",
      "structural_pass": true,
      "classification": "both",
      "toon_compliance": {
        "toon-write-check": "PASS",
        "toon-fee-check": "PASS",
        "toon-format-check": "PASS",
        "social-context-check": "PASS",
        "trigger-coverage": "PASS",
        "eval-completeness": "PASS"
      },
      "overall": "PASS"
    },
    {
      "skill_name": "deliberately-broken-skill",
      "structural_pass": false,
      "classification": "write-capable",
      "toon_compliance": {
        "toon-write-check": "FAIL",
        "toon-fee-check": "FAIL",
        "social-context-check": "FAIL",
        "trigger-coverage": "FAIL",
        "eval-completeness": "FAIL"
      },
      "overall": "FAIL"
    }
  ]
}
```

## Summary Table

In addition to the JSON report (stdout), the batch runner produces a human-readable summary table to stderr:

```
TOON Skill Batch Validation Report
===================================
Date: 2026-03-25T10:30:00Z
Skills root: .claude/skills/

  SKIP: skill-creator (filtered)
  SKIP: skill-eval-framework (filtered)

  Skill                        Struct Write  Fee    Format Social Trigger Evals  Overall
  ---------------------------- ------ ------ ------ ------ ------ ------ ------ ------
  nip-to-toon-skill            PASS   PASS   PASS   PASS   PASS   PASS   PASS   PASS
  nostr-protocol-core          PASS   PASS   PASS   PASS   PASS   PASS   PASS   PASS
  nostr-social-intelligence    PASS   PASS   PASS   N/A    PASS   PASS   PASS   PASS

Skills: 3 discovered, 3 passed, 0 failed
```

N/A indicates the assertion was not applicable due to classification (e.g., read-only skills skip write checks).

## Exit Codes

- **0**: All discovered skills pass structural validation and TOON compliance.
- **1**: At least one skill fails.

**Why strict exit codes:** The batch runner is designed for CI/CD integration (Story 9.34 publication gate). A non-zero exit code blocks publication of the entire catalog, ensuring no defective skill is published.

## Incremental Validation

For development workflows, the batch runner can be run on a single skill by passing its directory path directly to `run-eval.sh`. The batch runner is for catalog-wide validation; single-skill validation uses `run-eval.sh` directly.

## Integration with Story 9.34 (Publication Gate)

The publication gate (Story 9.34) uses the batch runner's aggregate report to make a go/no-go decision:
- All skills must pass structural + TOON compliance.
- The aggregate report is archived as a release artifact.
- Failed skills are listed with specific failure reasons for developer follow-up.
