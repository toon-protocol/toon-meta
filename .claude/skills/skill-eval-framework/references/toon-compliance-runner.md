# TOON Compliance Runner

> **Why automated compliance checking exists:** Manual review of TOON compliance is slow and inconsistent. A reviewer might catch that a skill uses raw WebSocket patterns but miss that fee documentation is absent. Automated checks enforce the same 6 assertions every time, at the same strictness level, in seconds. This is the quality gate that prevents defective skills from reaching agents on the TOON network.

## The 6 TOON Compliance Assertions

These assertions are the automated counterpart to the 5 assertions defined in `nip-to-toon-skill/references/toon-compliance-assertions.md`, plus one new assertion (`eval-completeness`) added by this framework.

### Classification Detection

Before running assertions, classify the skill:

1. **Write-capable detection:** Search SKILL.md and all files in `references/` for `publishEvent` (case-sensitive). If found, the skill is write-capable.
2. **Read-capable detection:** Search SKILL.md and all files in `references/` for `TOON-format`, `TOON format`, or `toon-format` (case-insensitive). If found, the skill is read-capable.
3. **Both:** If both patterns are detected, classify as "both."
4. **Neither:** If neither pattern is detected, classify as "general" -- only universal assertions apply.

**Why classification matters:** Write-only skills do not need format checks. Read-only skills do not need fee checks. Applying irrelevant assertions produces false failures.

### Assertion 1: `toon-write-check` (write-capable only)

**What to check:** The skill teaches agents to use the `publishEvent()` API from `@toon-protocol/client`, and does NOT contain bare EVENT array patterns that would bypass ILP payment.

**How to check:**
1. Search all `.md` files in the skill directory for `publishEvent`. Must appear at least once.
2. Search all `.md` files for bare WebSocket EVENT array patterns (opening bracket + quote + EVENT keyword). Must NOT appear.

**Pass criteria:** `publishEvent` found AND no bare EVENT array pattern found.

**Fail criteria:** `publishEvent` missing OR bare EVENT array pattern found.

**Why this matters:** A skill that teaches raw WebSocket EVENT sending produces agents that cannot publish on TOON. Every write attempt without ILP payment is rejected by the relay. This is the single most critical compliance check.

### Assertion 2: `toon-fee-check` (write-capable only)

**What to check:** The skill includes fee awareness -- either explicit fee calculation details or a reference to fee documentation.

**How to check:**
1. Search all `.md` files for any of: `basePricePerByte`, `fee calculation`, `fee awareness`, `publishing fee`, `event fee`, `pay to write`, `ILP payment`, `cost per byte`, `pricing model`.
2. At least one fee-related term must appear.

**Pass criteria:** At least one fee-related term found.

**Fail criteria:** No fee-related terms found in any `.md` file.

**Why this matters:** Agents that publish without fee awareness will either overpay (wasting funds) or underpay (receiving F04 rejection errors). Fee awareness is not optional on a paid network.

### Assertion 3: `toon-format-check` (read-capable only)

**What to check:** The skill documents that TOON relays return TOON-format strings, not standard JSON objects.

**How to check:**
1. Search all `.md` files for any of: `TOON-format`, `TOON format`, `toon-format` (case-insensitive).
2. At least one TOON format reference must appear.

**Pass criteria:** At least one TOON format reference found.

**Fail criteria:** No TOON format reference found.

**Why this matters:** Agents expecting JSON event objects from TOON relays will fail to parse responses. This is a fundamental protocol difference that must be surfaced in every read-capable skill.

### Assertion 4: `social-context-check` (all skills)

**What to check:** The skill has a `## Social Context` section that is specific to the skill's domain.

**How to check:**
1. Search SKILL.md for a line starting with `## Social Context`.
2. Count the words in the Social Context section (from the heading to the next `##` heading or end of file).
3. The section must have at least 30 words to be considered non-trivial.

**Pass criteria:** `## Social Context` heading exists AND section has >= 30 words.

**Fail criteria:** Heading missing OR section has < 30 words (too generic/placeholder).

**Why this matters:** Social context bridges protocol mechanics and appropriate behavior. A generic "be respectful" section provides no actionable guidance. The 30-word minimum catches empty or placeholder sections.

### Assertion 5: `trigger-coverage` (all skills)

**What to check:** The skill's `description` field includes both protocol-technical triggers and social-situation triggers.

**How to check:**
1. Extract the `description` field from SKILL.md frontmatter.
2. Check for protocol-technical indicators: event kind numbers (e.g., `kind:1`, `kind:7`), NIP references (e.g., `NIP-25`), API names (e.g., `publishEvent`), or technical terms (e.g., `event`, `relay`, `subscribe`).
3. Check for social-situation indicators: question words or user-facing scenario phrases (e.g., `should I`, `when to`, `appropriate`, `how should`, `is it okay`, `how do I`, `how to`, `how much`, `what is`, `what are`).
4. Both categories must be present.

**Pass criteria:** At least one protocol-technical indicator AND at least one social-situation indicator found in the description.

**Fail criteria:** Only one category present, or neither.

**Why this matters:** Protocol-only triggers activate the skill for developers but not for agents in social scenarios. Social-only triggers miss developer use cases. Both are needed for a skill that serves the full agent population.

### Assertion 6: `eval-completeness` (all skills)

**What to check:** The skill has sufficient eval coverage.

**How to check:**
1. Load `evals/evals.json`.
2. Count `trigger_evals` array length. Must be >= 6.
3. Count entries with `should_trigger: true` and `should_trigger: false`. Both must be >= 1 (mix required).
4. Count `output_evals` array length. Must be >= 4.
5. For each output eval, verify `assertions` array exists and is non-empty.

**Pass criteria:** >= 6 trigger evals (with mix) AND >= 4 output evals (each with assertions).

**Fail criteria:** Insufficient trigger evals, no mix, insufficient output evals, or output evals missing assertions.

**Why this matters:** A skill without sufficient evals cannot be reliably benchmarked. The minimums (6 trigger, 4 output) ensure there is enough data to calculate meaningful pass rates and detect regressions.

## Running All 6 Assertions

Execute in order. Report per-assertion pass/fail with evidence. The overall compliance result is:
- **PASS:** All applicable assertions pass.
- **FAIL:** Any applicable assertion fails.

Do not short-circuit -- run all applicable assertions even if one fails, so the developer sees the complete picture.
