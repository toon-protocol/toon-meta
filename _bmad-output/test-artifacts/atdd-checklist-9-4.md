---
stepsCompleted:
  ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-25'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/9-4-social-identity-skill.md'
  - '.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh'
  - '.claude/skills/skill-eval-framework/scripts/run-eval.sh'
  - '.claude/skills/nostr-protocol-core/SKILL.md'
  - '.claude/skills/nostr-social-intelligence/SKILL.md'
  - '.claude/skills/nostr-social-intelligence/evals/evals.json'
  - '.claude/skills/nostr-protocol-core/evals/evals.json'
  - '_bmad-output/planning-artifacts/test-design-epic-9.md'
---

# ATDD Checklist - Epic 9, Story 9.4: Social Identity Skill

**Date:** 2026-03-25
**Author:** Jonathan
**Primary Test Level:** Structural Validation + TOON Compliance Assertions (Shell Scripts)

---

## Story Summary

Produce the first pipeline-generated Claude Agent Skill (`social-identity`) covering identity management on Nostr/TOON: profiles (kind:0), follow lists (kind:3), NIP-05 DNS verification, NIP-24 extra metadata, and NIP-39 external identities. This is the first skill output from the NIP-to-TOON pipeline (Story 9.2) and serves as a pipeline regression test.

**As a** TOON agent
**I want** a skill teaching identity management on Nostr/TOON
**So that** I can create profiles, manage follow lists, verify identities via NIP-05, and link external identities

---

## Preflight Summary

**Detected Stack:** Skill-production (markdown + JSON); tests are shell scripts (`validate-skill.sh`, `run-eval.sh`), not TypeScript/Playwright/Jest.

**Test Framework:** TOON Skill Eval Framework (Story 9.3)
- Structural validation: `.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh` (8 checks)
- TOON compliance: `.claude/skills/skill-eval-framework/scripts/run-eval.sh` (6 assertions)
- Eval format: `evals/evals.json` (trigger_evals + output_evals)

**Prerequisites Verified:**
- Story has 11 clear acceptance criteria (AC1-AC11)
- validate-skill.sh exists and is executable
- run-eval.sh exists and is executable
- Existing skill patterns loaded (nostr-protocol-core, nostr-social-intelligence)
- Eval JSON format understood from existing examples

**TEA Config Flags:**
- `tea_use_playwright_utils`: true (not applicable -- no browser tests)
- `tea_use_pactjs_utils`: true (not applicable -- no contract tests)
- `test_stack_type`: auto (detected: skill-production)

**Knowledge Fragments Loaded:**
- test-quality.md (core) -- quality principles adapted for structural validation
- test-levels-framework.md (core) -- test level selection (structural + compliance = integration level)

---

## Acceptance Criteria

1. **AC1: Pipeline Production** -- Pipeline produces complete `social-identity` skill directory
2. **AC2: NIP Coverage** -- Skill covers kind:0, kind:3, NIP-05, NIP-24, NIP-39
3. **AC3: TOON Write Model** -- Uses `publishEvent()`, includes fee awareness
4. **AC4: TOON Read Model** -- Documents TOON-format strings
5. **AC5: Social Context** -- Identity-specific social guidance section
6. **AC6: Eval Suite** -- 8-10 trigger evals, 8-10 non-trigger, 4-6 output evals
7. **AC7: TOON Compliance Passing** -- All 6 TOON compliance assertions pass
8. **AC8: Description Optimization** -- 80-120 words with trigger phrases
9. **AC9: Token Budget** -- Under 500 lines / ~5k tokens
10. **AC10: Dependency References** -- References nostr-protocol-core and nostr-social-intelligence
11. **AC11: With/Without Baseline** -- Measurable improvement with skill loaded

---

## Test Strategy

### Test Levels for Skill Production

| Level | Tool | What It Validates | Analogous To |
|-------|------|-------------------|--------------|
| **Structural** | `validate-skill.sh` | File existence, frontmatter, line/word counts, no banned patterns | Lint / schema validation |
| **Compliance** | `run-eval.sh` | TOON write/read/fee/social/trigger/eval assertions | Contract / integration tests |
| **Content** | Custom bash assertions | Specific NIP coverage, dependency references, identity-specific content | Unit tests |
| **Eval Quality** | JSON validation + counts | evals.json structure, trigger/output eval counts and format | Unit tests |

### AC-to-Test Mapping

| AC | Test ID | Level | Priority | Scenario | Red Phase Failure |
|----|---------|-------|----------|----------|-------------------|
| AC1 | STRUCT-A | Structural | P0 | SKILL.md exists with valid YAML frontmatter (name + description only) | File not found / frontmatter invalid |
| AC1 | STRUCT-B | Structural | P0 | references/ dir exists with nip-spec.md, toon-extensions.md, scenarios.md | Directory or files missing |
| AC1 | STRUCT-B2 | Structural | P0 | evals/evals.json exists and is valid JSON | File missing or invalid JSON |
| AC2 | EVAL-A | Content | P0 | SKILL.md body mentions kind:0, kind:3, NIP-05, NIP-24, NIP-39 | grep finds missing NIP coverage |
| AC2 | EVAL-B | Content | P1 | references/nip-spec.md covers profile fields, follow list structure, DNS verification, external identities | Missing NIP detail sections |
| AC3 | TOON-A | Compliance | P0 | publishEvent() referenced in skill files; no bare EVENT patterns | run-eval.sh toon-write-check fails |
| AC3 | TOON-B | Compliance | P0 | Fee awareness terms present (basePricePerByte, fee calculation, etc.) | run-eval.sh toon-fee-check fails |
| AC4 | TOON-C | Compliance | P0 | TOON-format string documentation present | run-eval.sh toon-format-check fails |
| AC5 | STRUCT-D | Compliance | P0 | ## Social Context section exists with >= 30 words | run-eval.sh social-context-check fails |
| AC5 | TOON-D | Content | P1 | Social Context is identity-specific (profile investment, follow lists as signals, NIP-05 vs identity) | Generic social context detected |
| AC6 | EVAL-A2 | Eval Quality | P0 | 8-10 should-trigger queries in evals.json | Trigger count < 8 |
| AC6 | EVAL-B2 | Eval Quality | P0 | 8-10 should-not-trigger queries in evals.json | Non-trigger count < 8 |
| AC6 | EVAL-C | Eval Quality | P0 | 4-6 output evals with id, prompt, rubric, assertions | Output eval count < 4 |
| AC7 | TOON-ALL | Compliance | P0 | run-eval.sh passes all 6 assertions | Any assertion fails |
| AC8 | STRUCT-E | Structural | P1 | Description word count 80-120 | Word count outside range |
| AC8 | TRIG-A | Content | P1 | Description contains protocol triggers (kind:0, kind:3, NIP-05, NIP-39) | Missing protocol triggers |
| AC8 | TRIG-B | Content | P1 | Description contains social-situation triggers ("should I update my profile?") | Missing social triggers |
| AC9 | STRUCT-C | Structural | P0 | Body under 500 lines | Line count >= 500 |
| AC10 | DEP-A | Content | P1 | SKILL.md references nostr-protocol-core for TOON write/read model | Missing upstream reference |
| AC10 | DEP-B | Content | P1 | SKILL.md references nostr-social-intelligence for base social context | Missing upstream reference |
| AC11 | BASE-A | Manual | P2 | With/without baseline comparison shows measurable improvement | Cannot automate -- manual eval |

### Priority Summary

- **P0 (must pass):** 13 tests -- structural integrity, TOON compliance, eval suite completeness
- **P1 (should pass):** 7 tests -- content quality, trigger optimization, dependency references
- **P2 (nice to have):** 1 test -- with/without baseline (manual evaluation)

### Red Phase Design

All automated tests will fail before the skill directory is created because:
1. `.claude/skills/social-identity/` does not yet exist
2. `SKILL.md` does not exist (all structural checks fail)
3. `evals/evals.json` does not exist (all eval quality checks fail)
4. No content to grep for NIP coverage, TOON compliance, or dependency references

---

## Failing Tests Created (RED Phase)

### Structural + Content + Compliance Tests (24 tests)

**File:** `tests/skills/test-social-identity-skill.sh` (280 lines)

- **Test:** STRUCT-A -- SKILL.md exists with valid frontmatter
  - **Status:** RED - SKILL.md not found
  - **Verifies:** AC1 -- Pipeline produces skill directory with valid YAML frontmatter (name + description only)

- **Test:** STRUCT-B -- references/ directory with required files
  - **Status:** RED - Missing reference files (nip-spec.md, toon-extensions.md, scenarios.md)
  - **Verifies:** AC1 -- Pipeline produces complete reference directory

- **Test:** STRUCT-B2 -- evals/evals.json exists and is valid JSON
  - **Status:** RED - evals/evals.json not found
  - **Verifies:** AC1 -- Pipeline produces eval definitions

- **Test:** STRUCT-C -- Body under 500 lines
  - **Status:** RED - SKILL.md not found
  - **Verifies:** AC9 -- Token budget compliance

- **Test:** STRUCT-D -- Social Context section >= 30 words
  - **Status:** RED - SKILL.md not found
  - **Verifies:** AC5 -- Identity-specific social guidance

- **Test:** STRUCT-E -- Description word count 80-120
  - **Status:** RED - SKILL.md not found
  - **Verifies:** AC8 -- Description optimization

- **Test:** EVAL-A -- NIP coverage in SKILL.md (kind:0, kind:3, NIP-05, NIP-24, NIP-39)
  - **Status:** RED - SKILL.md not found
  - **Verifies:** AC2 -- NIP coverage completeness

- **Test:** EVAL-B -- NIP spec reference file coverage
  - **Status:** RED - nip-spec.md not found
  - **Verifies:** AC2 -- Reference file depth

- **Test:** TOON-D -- Social Context is identity-specific
  - **Status:** RED - SKILL.md not found
  - **Verifies:** AC5 -- Identity-specific social guidance (not generic)

- **Test:** TRIG-A -- Description contains protocol triggers
  - **Status:** RED - SKILL.md not found
  - **Verifies:** AC8 -- Protocol trigger phrases in description

- **Test:** TRIG-B -- Description contains social-situation triggers
  - **Status:** RED - SKILL.md not found
  - **Verifies:** AC8 -- Social-situation trigger phrases in description

- **Test:** DEP-A -- References nostr-protocol-core
  - **Status:** RED - SKILL.md not found
  - **Verifies:** AC10 -- Upstream dependency reference

- **Test:** DEP-B -- References nostr-social-intelligence
  - **Status:** RED - SKILL.md not found
  - **Verifies:** AC10 -- Upstream dependency reference

- **Test:** TOON-A -- toon-write-check (publishEvent, no bare EVENT)
  - **Status:** RED - Skill directory not found
  - **Verifies:** AC3 -- TOON write model compliance

- **Test:** TOON-B -- toon-fee-check (fee awareness terms)
  - **Status:** RED - Skill directory not found
  - **Verifies:** AC3 -- Fee awareness in skill files

- **Test:** TOON-C -- toon-format-check (TOON format documented)
  - **Status:** RED - Skill directory not found
  - **Verifies:** AC4 -- TOON read model compliance

- **Test:** EVAL-A2 -- Should-trigger query count (8-10)
  - **Status:** RED - evals.json not found
  - **Verifies:** AC6 -- Trigger eval coverage

- **Test:** EVAL-B2 -- Should-not-trigger query count (8-10)
  - **Status:** RED - evals.json not found
  - **Verifies:** AC6 -- Non-trigger eval coverage

- **Test:** EVAL-C -- Output eval count and structure (4-6)
  - **Status:** RED - evals.json not found
  - **Verifies:** AC6 -- Output eval completeness

- **Test:** TOON-ALL-1 -- validate-skill.sh passes
  - **Status:** RED - Skill directory not found
  - **Verifies:** AC7 -- Structural validation framework integration

- **Test:** TOON-ALL-2 -- run-eval.sh passes
  - **Status:** RED - Skill directory not found
  - **Verifies:** AC7 -- TOON compliance framework integration

- **Test:** CLEAN-A -- No extraneous files
  - **Status:** RED - Skill directory not found
  - **Verifies:** AC1 -- No README.md, CHANGELOG.md, or other forbidden files

---

## Data Factories Created

N/A -- This is a skill-production story (markdown + JSON). No data factories are needed. Test data is the skill directory itself, created by running the NIP-to-TOON pipeline.

---

## Fixtures Created

N/A -- Tests are self-contained bash assertions. The "fixture" is the skill directory at `.claude/skills/social-identity/`, created by the dev agent during implementation.

---

## Mock Requirements

N/A -- No external services to mock. Tests operate on local filesystem only.

---

## Required data-testid Attributes

N/A -- No UI components in this story.

---

## Implementation Checklist

### Task Group 1: Create Skill Directory Structure (AC1)

**Tests covered:** STRUCT-A, STRUCT-B, STRUCT-B2, CLEAN-A

**Tasks to make these tests pass:**

- [ ] Create `.claude/skills/social-identity/` directory
- [ ] Create `SKILL.md` with YAML frontmatter (`name: social-identity`, `description: ...`)
- [ ] Create `references/` subdirectory
- [ ] Create `references/nip-spec.md` (NIP-02 + NIP-05 + NIP-24 + NIP-39 specs)
- [ ] Create `references/toon-extensions.md` (TOON-specific identity extensions)
- [ ] Create `references/scenarios.md` (identity management scenarios)
- [ ] Create `evals/` subdirectory
- [ ] Create `evals/evals.json` (valid JSON, skill-creator format)
- [ ] Verify no extraneous files (no README.md, CHANGELOG.md)
- [ ] Run test: `bash tests/skills/test-social-identity-skill.sh`
- [ ] Tests STRUCT-A, STRUCT-B, STRUCT-B2, CLEAN-A pass (green)

**Estimated Effort:** 0.5 hours

---

### Task Group 2: Author SKILL.md Body (AC2, AC3, AC4, AC5, AC8, AC9, AC10)

**Tests covered:** EVAL-A, STRUCT-C, STRUCT-D, STRUCT-E, TOON-D, TRIG-A, TRIG-B, DEP-A, DEP-B

**Tasks to make these tests pass:**

- [ ] Write description (~80-120 words) with protocol triggers (kind:0, kind:3, NIP-05, NIP-39) and social-situation triggers ("should I update my profile?", "how do I follow someone?")
- [ ] Write body covering: kind:0 profile management, kind:3 follow lists, NIP-05 verification, NIP-24 extra metadata, NIP-39 external identities
- [ ] Include TOON Write Model section referencing `publishEvent()` and fee awareness
- [ ] Include TOON Read Model section referencing TOON-format strings
- [ ] Write `## Social Context` section with identity-specific guidance (>= 30 words): profile as investment, follow lists as signals, NIP-05 as domain verification, economics of updates
- [ ] Add references to `nostr-protocol-core` for TOON write/read model
- [ ] Add references to `nostr-social-intelligence` for base social context
- [ ] Keep body under 500 lines
- [ ] Run test: `bash tests/skills/test-social-identity-skill.sh`
- [ ] Tests EVAL-A, STRUCT-C, STRUCT-D, STRUCT-E, TOON-D, TRIG-A, TRIG-B, DEP-A, DEP-B pass (green)

**Estimated Effort:** 2 hours

---

### Task Group 3: Author Reference Files (AC2, AC3, AC4)

**Tests covered:** EVAL-B, TOON-A, TOON-B, TOON-C

**Tasks to make these tests pass:**

- [ ] Write `references/nip-spec.md` covering profile metadata fields, follow list structure, DNS verification flow, external identity `i` tag format
- [ ] Write `references/toon-extensions.md` with `publishEvent()` references, fee awareness (basePricePerByte), TOON-format string handling
- [ ] Write `references/scenarios.md` with step-by-step TOON flows for creating profile, updating profile, managing follow list, adding NIP-05, linking external identities
- [ ] Verify no bare EVENT array patterns in any reference file
- [ ] Run test: `bash tests/skills/test-social-identity-skill.sh`
- [ ] Tests EVAL-B, TOON-A, TOON-B, TOON-C pass (green)

**Estimated Effort:** 2 hours

---

### Task Group 4: Create Eval Suite (AC6)

**Tests covered:** EVAL-A2, EVAL-B2, EVAL-C

**Tasks to make these tests pass:**

- [ ] Create `evals/evals.json` with 8-10 should-trigger queries (profile creation, profile updates, follow list management, NIP-05 verification, NIP-39, social-situation questions)
- [ ] Add 8-10 should-not-trigger queries (reactions, long-form content, group chat, encryption, DMs, community moderation)
- [ ] Add 4-6 output evals with `id`, `prompt`, `rubric` (correct/acceptable/incorrect), and `assertions` array
- [ ] Include TOON compliance assertions in output eval assertions (toon-write-check, toon-fee-check, toon-format-check, social-context-check)
- [ ] Run test: `bash tests/skills/test-social-identity-skill.sh`
- [ ] Tests EVAL-A2, EVAL-B2, EVAL-C pass (green)

**Estimated Effort:** 1.5 hours

---

### Task Group 5: Integration Validation (AC7)

**Tests covered:** TOON-ALL-1, TOON-ALL-2

**Tasks to make these tests pass:**

- [ ] Run `validate-skill.sh .claude/skills/social-identity/` -- must pass all 8 structural checks
- [ ] Run `run-eval.sh .claude/skills/social-identity/` -- must pass all 6 TOON compliance assertions
- [ ] Fix any remaining issues until both scripts exit 0
- [ ] Run test: `bash tests/skills/test-social-identity-skill.sh`
- [ ] Tests TOON-ALL-1, TOON-ALL-2 pass (green)

**Estimated Effort:** 0.5 hours

---

### Task Group 6: With/Without Baseline (AC11)

**Tests covered:** BASE-A (manual)

**Tasks:**

- [ ] Run pipeline Step 8 (with/without testing): spawn parallel runs with and without skill loaded
- [ ] Compare identity management responses for measurable improvement
- [ ] Document results in pipeline output

**Estimated Effort:** 1 hour (manual evaluation)

---

## Running Tests

```bash
# Run all ATDD acceptance tests for Story 9.4
bash tests/skills/test-social-identity-skill.sh

# Run just the structural validation (validate-skill.sh)
bash .claude/skills/nip-to-toon-skill/scripts/validate-skill.sh .claude/skills/social-identity/

# Run TOON compliance assertions (run-eval.sh)
bash .claude/skills/skill-eval-framework/scripts/run-eval.sh .claude/skills/social-identity/

# Verify evals.json is valid JSON
node -e "JSON.parse(require('fs').readFileSync('.claude/skills/social-identity/evals/evals.json', 'utf8')); console.log('Valid JSON')"
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 24 tests written and failing
- Test script created at `tests/skills/test-social-identity-skill.sh`
- Implementation checklist created with 6 task groups
- No fixtures/factories/mocks needed (skill-production story)

**Verification:**

- All tests run and fail as expected (24/24 RED)
- Failure messages are clear: "SKILL.md not found", "Skill directory not found"
- Tests fail due to missing skill directory, not test bugs

---

### GREEN Phase (DEV Team -- Next Steps)

**DEV Agent Responsibilities:**

1. **Run the NIP-to-TOON pipeline** (Story 9.2) with NIP-02, NIP-05, NIP-24, NIP-39 as input
2. **Create the skill directory** following Task Groups 1-4
3. **Run the test script** after each task group to verify progress
4. **Fix any failing tests** by adjusting skill content
5. **Run integration validation** (Task Group 5) as final check

**Key Principles:**

- Pipeline produces the skill (D9-001) -- do not hand-author from scratch
- One task group at a time
- Run tests after each group for immediate feedback
- Use existing skills (nostr-protocol-core, nostr-social-intelligence) as format examples

**Progress Tracking:**

- Check off tasks in implementation checklist as completed
- Target: 24/24 tests GREEN

---

### REFACTOR Phase (DEV Team -- After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all 24 tests pass (green phase complete)
2. Run `validate-skill.sh` and `run-eval.sh` one final time
3. Review SKILL.md for clarity and conciseness
4. Ensure description is optimized (run description optimization loop from pipeline Step 7)
5. Verify skill adds value over baseline (with/without test from pipeline Step 8)

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `bash tests/skills/test-social-identity-skill.sh`

**Results:**

```
Total: 24 | Passed: 0 | Failed: 24 | Skipped: 0
Status: RED (TDD red phase -- 24 failing tests)
```

**Summary:**

- Total tests: 24
- Passing: 0 (expected)
- Failing: 24 (expected)
- Status: RED phase verified

---

## Next Steps

1. **Run the NIP-to-TOON pipeline** with NIP-02, NIP-05, NIP-24, NIP-39 as input
2. **Create the skill directory** following the implementation checklist (Task Groups 1-5)
3. **Run failing tests** after each task group: `bash tests/skills/test-social-identity-skill.sh`
4. **Work one task group at a time** (RED to GREEN for each group)
5. **When all 24 tests pass**, run refactor phase (description optimization, with/without baseline)
6. **When refactoring complete**, commit with message: `feat(9-4): Social Identity Skill -- profile, follow lists, NIP-05, NIP-39, evals, TOON compliance`

---

## Knowledge Base References Applied

This ATDD workflow consulted the following:

- **test-quality.md** -- Quality principles (determinism, isolation, explicit assertions) adapted for structural validation
- **test-levels-framework.md** -- Test level selection adapted for skill-production (Structural/Compliance/Content/Eval Quality)
- **validate-skill.sh** -- Existing structural validation script (8 checks) from Story 9.2
- **run-eval.sh** -- Existing TOON compliance script (6 assertions) from Story 9.3
- **nostr-protocol-core evals/evals.json** -- Eval format pattern (trigger_evals + output_evals)
- **nostr-social-intelligence evals/evals.json** -- Eval format pattern (rubric-based grading)
- **toon-compliance-assertions.md** -- 5 TOON assertion definitions for write/read/fee/social/trigger checks
- **social-context-template.md** -- Template for generating NIP-specific Social Context sections
- **test-design-epic-9.md** -- Phase 1 identity test notes, Standard Skill Validation Template

---

## Notes

- This is the first pipeline-produced skill (Story 9.4). It serves as a pipeline regression test for all 30 downstream Phase 1-10 skills.
- AC11 (with/without baseline) cannot be automated in the test script -- it requires LLM inference comparison.
- The test script replicates and extends the checks in validate-skill.sh and run-eval.sh with story-specific content assertions.
- No TypeScript, no pnpm build, no package.json changes -- this story is pure markdown + JSON.

---

**Generated by BMad TEA Agent** -- 2026-03-25

