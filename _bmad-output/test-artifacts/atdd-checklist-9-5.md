---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-25'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/9-5-long-form-content-skill.md'
  - '.claude/skills/social-identity/SKILL.md'
  - '.claude/skills/social-identity/evals/evals.json'
  - 'tests/skills/test-social-identity-skill.sh'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
---

# ATDD Checklist - Epic 9, Story 9.5: Long-form Content Skill

**Date:** 2026-03-25
**Author:** Jonathan
**Primary Test Level:** Structural + TOON Compliance (bash script tests)

---

## Preflight Summary

### Stack Detection
- **Detected stack:** fullstack (Node.js backend with vitest, frontend with Playwright)
- **Story nature:** Claude Agent Skill (markdown + reference files + eval JSON) -- NOT TypeScript. No pnpm build, no pnpm test, no TypeScript compilation. Validation is structural (validate-skill.sh) + TOON compliance (run-eval.sh).

### Prerequisites Verified
- Story approved with 11 clear acceptance criteria (AC1-AC11)
- Test framework: vitest (multiple packages), Playwright (packages/rig)
- Existing skill test pattern: `tests/skills/test-social-identity-skill.sh` (Story 9.4) -- 50 tests, bash-based structural validation
- Skill directory `.claude/skills/long-form-content/` does NOT exist yet (RED phase confirmed)

### Story Context
- **Story 9.5:** Long-form Content Skill (`long-form-content`)
- **As a** TOON agent, **I want** a skill teaching long-form content publishing, **So that** I can create and manage articles on TOON relays.
- **NIPs covered:** NIP-23 (kind:30023 long-form articles), NIP-14 (subject tags)
- **Classification:** Write + Read ("both")
- **Dependencies:** Stories 9.0-9.4 (all done)
- **Pattern reference:** Story 9.4 (`social-identity`) -- 50 tests in bash script

### Knowledge Fragments Loaded
- `data-factories.md` (core) -- factory patterns (adapted for test data generation)
- `test-quality.md` (core) -- deterministic, isolated, explicit test patterns
- `tea-index.csv` -- knowledge fragment index

### TEA Config Flags
- `tea_use_playwright_utils`: true
- `tea_use_pactjs_utils`: true
- `tea_pact_mcp`: mcp
- `tea_browser_automation`: auto
- `test_stack_type`: auto (detected: fullstack)

---

## Generation Mode

**Mode:** AI Generation
**Rationale:** Story 9.5 produces a Claude Agent Skill (markdown + reference files + eval JSON), not a UI feature. Acceptance criteria are clear (11 ACs with explicit test IDs). Tests are structural bash script validations following the established pattern from Story 9.4 (`test-social-identity-skill.sh`). No browser recording needed.

---

## Test Strategy

### AC-to-Test Mapping

| AC | Test ID(s) | Test Level | Priority | Description |
|----|-----------|------------|----------|-------------|
| AC1: Pipeline Production | STRUCT-A, STRUCT-B, STRUCT-B2, AC1-NAME | Structural (bash) | P0 | SKILL.md exists with valid frontmatter (only name+description), references/ dir with 3 files, evals/evals.json valid JSON, skill name matches |
| AC2: NIP Coverage | AC2-KIND30023, AC2-DTAG, AC2-MARKDOWN, AC2-TAGS, AC2-LIFECYCLE, AC2-NIP14, AC2-SUBJECT-VS-T | Structural (bash grep) | P0 | SKILL.md + references cover kind:30023, d tag, markdown content, title/summary/image/published_at tags, article lifecycle, NIP-14 subject tags, distinction between subject and t tags |
| AC3: TOON Write Model | TOON-A, TOON-B, AC3-CLIENT, AC3-FEEREF, AC3-REPLACEABLE | Structural (bash grep) | P0 | Uses publishEvent(), fee awareness for large content, references nostr-protocol-core, parameterized replaceable semantics |
| AC4: TOON Read Model | TOON-C, AC4-TOONFORMAT, AC4-FILTER | Structural (bash grep) | P0 | Documents TOON-format strings, references nostr-protocol-core, mentions kinds:[30023] filter and #d tag filter |
| AC5: Social Context | STRUCT-D, TOON-D, AC5-INVESTMENT, AC5-QUALITY, AC5-UPDATES, AC5-SUBJECT, AC5-SUMMARY, AC5-SUBST | Structural (bash grep) | P1 | Social Context section with content-publishing-specific guidance covering all 6 themes, passes substitution test |
| AC6: Eval Suite | EVAL-A, EVAL-B, EVAL-C, AC6-TRIGGER-COUNT, AC6-NOTTRIGGER-COUNT, AC6-OUTPUT-COUNT, AC6-RUBRIC, AC6-TOON-ASSERT | Structural (bash + jq/python) | P0 | evals.json has 8-10 should-trigger, 8-10 should-not-trigger, 4-6 output evals with id/prompt/rubric/assertions |
| AC7: TOON Compliance | TOON-ALL | Integration (script) | P0 | run-eval.sh passes all 6 TOON compliance assertions |
| AC8: Description Optimization | AC8-WORDCOUNT, AC8-TRIGPHRASES, AC8-SOCIAL-TRIGGERS | Structural (bash) | P1 | Description 80-120 words, includes trigger phrases for long-form/articles/kind:30023/NIP-23/NIP-14/subject tags, includes social-situation triggers |
| AC9: Token Budget | STRUCT-C, AC9-LINES, AC9-TOKEN-WORDS | Structural (bash) | P1 | SKILL.md body under 500 lines, approximately 5k tokens or fewer |
| AC10: Dependency References | DEP-A, DEP-B, AC10-NODUP | Structural (bash grep) | P1 | References nostr-protocol-core and nostr-social-intelligence, does NOT duplicate toon-protocol-context.md |
| AC11: With/Without Baseline | BASE-A | Manual/Pipeline | P2 | Agent with skill produces better responses than without (pipeline Step 8 output) |

### Test Levels Selected

- **Primary:** Structural bash script tests (grep, file existence, JSON validation)
- **Secondary:** Integration with existing scripts (validate-skill.sh, run-eval.sh)
- **No E2E/UI tests** -- skill is markdown + JSON, not a web application
- **No unit tests** -- no TypeScript source code to test

### Priority Distribution

- **P0 (Critical):** 7 ACs -- structural integrity, NIP coverage, TOON write/read model, eval suite, TOON compliance
- **P1 (Important):** 4 ACs -- social context, description optimization, token budget, dependency references
- **P2 (Nice-to-have):** 1 AC -- with/without baseline (manual pipeline verification)

### Red Phase Requirements

All tests will FAIL until the skill is implemented because:
- `.claude/skills/long-form-content/` directory does not exist
- No SKILL.md, no references/, no evals/ directory
- validate-skill.sh and run-eval.sh will exit non-zero
- All grep-based content checks will fail (files don't exist)

---

## Story Summary

**As a** TOON agent
**I want** a skill teaching long-form content publishing
**So that** I can create and manage articles on TOON relays

---

## Acceptance Criteria

1. **AC1:** Pipeline Production -- skill directory at `.claude/skills/long-form-content/` with SKILL.md, references/, evals/
2. **AC2:** NIP Coverage -- kind:30023, d tag, markdown content, title/summary/image/published_at, NIP-14 subject, lifecycle
3. **AC3:** TOON Write Model -- publishEvent(), fee awareness for large content, nostr-protocol-core reference
4. **AC4:** TOON Read Model -- TOON-format strings, kinds:[30023] filter, #d tag filter
5. **AC5:** Social Context -- content-publishing-specific guidance (6 themes), substitution test
6. **AC6:** Eval Suite -- 8-10 should-trigger, 8-10 should-not-trigger, 4-6 output evals
7. **AC7:** TOON Compliance -- validate-skill.sh + run-eval.sh pass
8. **AC8:** Description Optimization -- 80-120 words, protocol + social triggers
9. **AC9:** Token Budget -- body under 500 lines, ~5k tokens
10. **AC10:** Dependency References -- nostr-protocol-core + nostr-social-intelligence, no duplication
11. **AC11:** With/Without Baseline -- measurably better responses with skill loaded

---

## Failing Tests Created (RED Phase)

### Structural Tests (63 tests: 62 automated + 1 skipped)

**File:** `tests/skills/test-long-form-content-skill.sh`

- **Test:** STRUCT-A
  - **Status:** RED - SKILL.md not found
  - **Verifies:** SKILL.md exists with valid YAML frontmatter (only name and description)

- **Test:** STRUCT-B
  - **Status:** RED - reference files not found
  - **Verifies:** references/ directory with nip-spec.md, toon-extensions.md, scenarios.md

- **Test:** STRUCT-B2
  - **Status:** RED - evals/evals.json not found
  - **Verifies:** evals/evals.json exists and is valid JSON

- **Test:** STRUCT-C
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Body under 500 lines (AC9)

- **Test:** STRUCT-D
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Social Context section exists with >= 30 words

- **Test:** STRUCT-E
  - **Status:** REMOVED - duplicate of AC8-STRICT-RANGE (both checked description word count 80-120)

- **Test:** EVAL-A
  - **Status:** RED - SKILL.md not found
  - **Verifies:** SKILL.md covers kind:30023, NIP-23, NIP-14

- **Test:** EVAL-B
  - **Status:** RED - nip-spec.md not found
  - **Verifies:** nip-spec.md covers kind:30023, d tag, article tags, NIP-14

- **Test:** TOON-D
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Social Context is content-publishing-specific

- **Test:** TRIG-A
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Description contains protocol trigger phrases

- **Test:** TRIG-B
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Description contains social-situation trigger phrases

- **Test:** DEP-A
  - **Status:** RED - SKILL.md not found
  - **Verifies:** SKILL.md references nostr-protocol-core

- **Test:** DEP-B
  - **Status:** RED - SKILL.md not found
  - **Verifies:** SKILL.md references nostr-social-intelligence

- **Test:** TOON-A
  - **Status:** RED - skill directory not found
  - **Verifies:** publishEvent referenced, no bare EVENT patterns

- **Test:** TOON-B
  - **Status:** RED - skill directory not found
  - **Verifies:** Fee-related terms present

- **Test:** TOON-C
  - **Status:** RED - skill directory not found
  - **Verifies:** TOON format reference present

- **Test:** EVAL-A2
  - **Status:** RED - evals.json not found
  - **Verifies:** 8-10 should-trigger queries

- **Test:** EVAL-B2
  - **Status:** RED - evals.json not found
  - **Verifies:** 8-10 should-not-trigger queries

- **Test:** EVAL-C
  - **Status:** RED - evals.json not found
  - **Verifies:** 4-6 output evals with id, prompt, rubric, assertions

- **Test:** TOON-ALL-1
  - **Status:** RED - skill directory not found
  - **Verifies:** validate-skill.sh passes

- **Test:** TOON-ALL-2
  - **Status:** RED - skill directory not found
  - **Verifies:** run-eval.sh passes (all 6 TOON compliance assertions)

- **Test:** CLEAN-A
  - **Status:** RED - skill directory not found
  - **Verifies:** No extraneous files in skill root

- **Test:** AC1-NAME
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Frontmatter name field is exactly "long-form-content"

- **Test:** AC2-KIND30023
  - **Status:** RED - SKILL.md not found
  - **Verifies:** kind:30023 documented as parameterized replaceable

- **Test:** AC2-DTAG
  - **Status:** RED - files not found
  - **Verifies:** d tag documented as article identifier

- **Test:** AC2-MARKDOWN
  - **Status:** RED - files not found
  - **Verifies:** Markdown content format documented

- **Test:** AC2-TAGS
  - **Status:** RED - files not found
  - **Verifies:** Article tags documented (title, summary, image, published_at)

- **Test:** AC2-LIFECYCLE
  - **Status:** RED - files not found
  - **Verifies:** Article lifecycle documented (create, update, draft)

- **Test:** AC2-NIP14
  - **Status:** RED - files not found
  - **Verifies:** NIP-14 subject tag format documented

- **Test:** AC2-SUBJECT-VS-T
  - **Status:** RED - files not found
  - **Verifies:** Distinction between subject tag and t tag

- **Test:** AC2-TOONEXT
  - **Status:** RED - toon-extensions.md not found
  - **Verifies:** toon-extensions.md covers long-form content fees

- **Test:** AC2-SCENARIOS
  - **Status:** RED - scenarios.md not found
  - **Verifies:** scenarios.md covers long-form content workflows

- **Test:** AC3-CLIENT
  - **Status:** RED - @toon-protocol/client not referenced
  - **Verifies:** publishEvent from @toon-protocol/client specifically

- **Test:** AC3-FEEREF
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Fee calculation references nostr-protocol-core

- **Test:** AC3-REPLACEABLE
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Parameterized replaceable semantics with cost noted

- **Test:** AC3-WRITEMODEL
  - **Status:** RED - SKILL.md not found
  - **Verifies:** TOON Write Model section exists

- **Test:** AC4-DECODER
  - **Status:** RED - SKILL.md not found
  - **Verifies:** TOON Read Model section exists

- **Test:** AC4-FILTER
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Read model mentions kinds:[30023] and #d tag filter

- **Test:** AC4-REFREADS
  - **Status:** RED - SKILL.md not found
  - **Verifies:** "When to Read Each Reference" section exists

- **Test:** AC5-INVESTMENT
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Content-as-investment theme in Social Context

- **Test:** AC5-QUALITY
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Quality-over-quantity theme

- **Test:** AC5-UPDATES
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Update cost / batch edits theme

- **Test:** AC5-SUBJECT
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Subject tags as curation signals theme

- **Test:** AC5-SUMMARY
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Summaries as first impressions theme

- **Test:** AC5-SUBST
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Social Context passes substitution test (content-specific)

- **Test:** AC5-NIP-SPECIFIC
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Social Context has content-publishing compound terms

- **Test:** AC6-RUBRIC
  - **Status:** RED - evals.json not found
  - **Verifies:** Output eval rubrics use correct/acceptable/incorrect grading

- **Test:** AC6-TOON-ASSERT
  - **Status:** RED - evals.json not found
  - **Verifies:** Output evals include TOON compliance assertions

- **Test:** AC8-TRIGPHRASES
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Description includes required trigger phrases

- **Test:** AC8-STRICT-RANGE
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Description 80-120 words (stricter than validate-skill.sh)

- **Test:** AC9-TOKENS
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Token budget via char count heuristic

- **Test:** AC9-TOKEN-WORDS
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Token budget via word count heuristic

- **Test:** AC10-NODUP
  - **Status:** RED - references/ not found
  - **Verifies:** No toon-protocol-context.md duplication (D9-010)

- **Test:** AC10-DEP-BOTH
  - **Status:** RED - SKILL.md not found
  - **Verifies:** Both dependency skills referenced as paths

- **Test:** PIPE-REGR
  - **Status:** RED - SKILL.md not found
  - **Verifies:** D9-010 pointer pattern to canonical toon-protocol-context.md

- **Test:** BASE-A
  - **Status:** SKIP - requires manual pipeline Step 8 execution
  - **Verifies:** With/without baseline (AC11) -- agent with skill produces better responses than without

---

## Data Factories Created

N/A -- This story produces a Claude Agent Skill (markdown + eval JSON), not TypeScript. No data factories are needed. Test data is structural (file existence, content grep, JSON validation).

---

## Fixtures Created

N/A -- Tests are self-contained bash script checks. No Playwright fixtures or test infrastructure needed.

---

## Mock Requirements

N/A -- No external services to mock. Tests validate static file content and structure.

---

## Required data-testid Attributes

N/A -- No UI components. This is a markdown skill, not a web application.

---

## Implementation Checklist

### Test: STRUCT-A (SKILL.md exists with valid frontmatter)

**File:** `tests/skills/test-long-form-content-skill.sh`

**Tasks to make this test pass:**

- [ ] Create `.claude/skills/long-form-content/` directory
- [ ] Create `SKILL.md` with YAML frontmatter containing ONLY `name` and `description` fields
- [ ] Set `name: long-form-content`
- [ ] Write description (~80-120 words) with protocol + social-situation triggers
- [ ] Run test: `bash tests/skills/test-long-form-content-skill.sh`

**Estimated Effort:** 0.5 hours

---

### Test: STRUCT-B (reference files exist)

**File:** `tests/skills/test-long-form-content-skill.sh`

**Tasks to make this test pass:**

- [ ] Create `references/nip-spec.md` with NIP-23 + NIP-14 spec details
- [ ] Create `references/toon-extensions.md` with TOON-specific long-form extensions
- [ ] Create `references/scenarios.md` with long-form content scenario workflows
- [ ] Run test: `bash tests/skills/test-long-form-content-skill.sh`

**Estimated Effort:** 2 hours

---

### Test: STRUCT-B2 (evals/evals.json valid)

**File:** `tests/skills/test-long-form-content-skill.sh`

**Tasks to make this test pass:**

- [ ] Create `evals/evals.json` in skill-creator format
- [ ] Include 8-10 should-trigger queries (AC6)
- [ ] Include 8-10 should-not-trigger queries (AC6)
- [ ] Include 4-6 output evals with id, prompt, rubric, assertions (AC6)
- [ ] Run test: `bash tests/skills/test-long-form-content-skill.sh`

**Estimated Effort:** 1 hour

---

### Test: SKILL.md Body Content (EVAL-A, AC2-*, AC3-*, AC4-*, AC5-*)

**File:** `tests/skills/test-long-form-content-skill.sh`

**Tasks to make this test pass:**

- [ ] Write SKILL.md body covering kind:30023, d tag, markdown content, article tags, NIP-14 subject
- [ ] Include `## TOON Write Model` section with publishEvent() and fee awareness
- [ ] Include `## TOON Read Model` section with TOON-format strings and kinds:[30023] filter
- [ ] Include `## Social Context` section with all 6 content-publishing themes
- [ ] Include "When to Read Each Reference" section
- [ ] Reference nostr-protocol-core and nostr-social-intelligence (D9-010)
- [ ] Keep body under 500 lines / ~5k tokens
- [ ] Run test: `bash tests/skills/test-long-form-content-skill.sh`

**Estimated Effort:** 2 hours

---

### Test: TOON-ALL (validate-skill.sh + run-eval.sh pass)

**File:** `tests/skills/test-long-form-content-skill.sh`

**Tasks to make this test pass:**

- [ ] Ensure all 11 structural checks in validate-skill.sh pass
- [ ] Ensure all 6 TOON compliance assertions in run-eval.sh pass
- [ ] Run test: `bash tests/skills/test-long-form-content-skill.sh`

**Estimated Effort:** 0.5 hours (fix-up after writing content)

---

## Running Tests

```bash
# Run all failing tests for this story
bash tests/skills/test-long-form-content-skill.sh

# Run with verbose output
bash -x tests/skills/test-long-form-content-skill.sh

# Run validate-skill.sh directly
bash .claude/skills/nip-to-toon-skill/scripts/validate-skill.sh .claude/skills/long-form-content/

# Run run-eval.sh directly
bash .claude/skills/skill-eval-framework/scripts/run-eval.sh .claude/skills/long-form-content/
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 63 tests written and failing
- Test script created at `tests/skills/test-long-form-content-skill.sh`
- Implementation checklist created
- No fixtures or factories needed (structural tests)

**Verification:**

- All 63 tests run and fail as expected
- Failure messages are clear and actionable
- Tests fail due to missing skill implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Run the `nip-to-toon-skill` pipeline** with NIP-23 and NIP-14 as input (D9-001)
2. **Create skill directory** `.claude/skills/long-form-content/`
3. **Author SKILL.md** with frontmatter, body, and all required sections
4. **Create reference files** (nip-spec.md, toon-extensions.md, scenarios.md)
5. **Create evals/evals.json** with trigger + output evals
6. **Run tests** to verify each section passes
7. **Run validate-skill.sh and run-eval.sh** for integration validation

**Key Principles:**

- Use the `nip-to-toon-skill` pipeline (D9-001) -- do NOT hand-author from scratch
- Follow the social-identity skill pattern (Story 9.4) for format reference
- Run tests frequently for immediate feedback

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all 63 tests pass** (green phase complete)
2. **Review SKILL.md for quality** -- concise, procedural, imperative form
3. **Verify description optimization** -- 80-120 words, good trigger coverage
4. **Verify Social Context specificity** -- passes substitution test
5. **Run validate-skill.sh and run-eval.sh** one final time

---

## Next Steps

1. **Run the `nip-to-toon-skill` pipeline** to produce the skill (D9-001)
2. **Run failing tests** to confirm RED phase: `bash tests/skills/test-long-form-content-skill.sh`
3. **Begin implementation** using the pipeline output as starting point
4. **Work iteratively** -- run tests after each file creation
5. **When all 63 tests pass**, review for quality and commit
6. **Expected commit:** `feat(9-5): Long-form Content Skill -- NIP-23/14, kind:30023, articles, evals, TOON compliance`

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **data-factories.md** -- Factory patterns (adapted for understanding test data strategy; not directly applicable since tests are bash-based)
- **test-quality.md** -- Test design principles (determinism, isolation, explicit assertions; applied to bash test structure)
- **test-social-identity-skill.sh** -- Story 9.4 pattern reference (50 tests, bash structural validation; primary template for this test script)

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `bash tests/skills/test-long-form-content-skill.sh`

**Results (RED phase, pre-implementation):**

```
Total: 63 | Passed: 0 | Failed: 62 | Skipped: 1
Status: RED (TDD red phase -- 62 failing tests, 1 skipped)
```

**Results (GREEN phase, post-implementation + review fixes):**

```
Total: 63 | Passed: 62 | Failed: 0 | Skipped: 1
Status: GREEN (all tests pass)
```

**Summary:**

- Total tests: 63 (62 automated + 1 skipped)
- Passing: 62
- Skipped: 1 (BASE-A -- AC11 with/without baseline, manual pipeline step)
- Failing: 0
- Status: GREEN phase verified

---

## Notes

- Story 9.5 produces a Claude Agent Skill (markdown + eval JSON), not TypeScript code. Tests are bash-based structural checks, not vitest/Playwright tests.
- The test script follows the established pattern from Story 9.4 (`test-social-identity-skill.sh`) with 50 tests expanded to 63 tests for comprehensive AC coverage.
- AC11 (with/without baseline) is not included in the test script -- it requires manual pipeline execution (Step 8 of the nip-to-toon-skill pipeline).
- All tests are deterministic, isolated, and fast (bash grep + file checks complete in < 1 second).

---

**Generated by BMad TEA Agent** - 2026-03-25
