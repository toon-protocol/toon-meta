---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-25'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/9-2-nip-to-toon-skill-pipeline.md'
  - '_bmad-output/planning-artifacts/test-design-epic-9.md'
  - '.claude/skills/nostr-protocol-core/SKILL.md'
  - '.claude/skills/nostr-social-intelligence/SKILL.md'
  - '.claude/skills/nostr-protocol-core/references/toon-protocol-context.md'
  - 'packages/core/src/skills/nostr-protocol-core.test.ts'
  - 'packages/core/src/skills/nostr-social-intelligence.test.ts'
  - 'vitest.config.ts'
---

# ATDD Checklist - Epic 9, Story 9.2: NIP-to-TOON Skill Pipeline (nip-to-toon-skill)

**Date:** 2026-03-25
**Author:** Jonathan
**Primary Test Level:** Structural Validation (Vitest)

---

## Story Summary

Story 9.2 produces a **Claude Agent Skill** (structured markdown + reference files + eval JSON + bash validation script) that teaches an agent how to convert any Nostr NIP into a TOON-compliant skill. This is the **highest-risk story in Epic 9** (E9-R001, score 9/9) -- a defect in the pipeline propagates to ~30 downstream skills (Stories 9.4-9.33). The pipeline has 14 acceptance criteria, making it the most complex story in the epic.

**As a** skill author
**I want** a pipeline skill that converts any Nostr NIP into a TOON-aware Claude Agent Skill
**So that** future NIPs can be converted to TOON skills without re-scoping the epic.

---

## Acceptance Criteria

1. **AC1:** SKILL.md core file with 13-step pipeline procedure, valid frontmatter, body <500 lines
2. **AC2:** NIP Analysis step -- classify read-only / write-capable / both, identify event kinds and tags
3. **AC3:** TOON Context Injection step -- inject write/read model based on classification
4. **AC4:** Social Context Layer step -- generate `## Social Context` using template
5. **AC5:** Skill Authoring step -- generate SKILL.md with frontmatter, body, Level 3 references
6. **AC6:** Eval Generation step -- generate skill-creator-compatible evals.json
7. **AC7:** TOON Assertions step -- auto-inject 5 TOON compliance assertions
8. **AC8:** Description Optimization step -- run_loop with 20 trigger queries, max 5 iterations
9. **AC9:** With/Without Testing step -- parallel subagent runs
10. **AC10:** Grading + Benchmarking steps -- grading.json and benchmark.json
11. **AC11:** TOON Compliance Validation step -- red = skill not ready
12. **AC12:** Eval Viewer + Iteration steps -- HTML review, feedback.json, iterate
13. **AC13:** Protocol Context Reference -- toon-protocol-context.md consistent with Story 9.1
14. **AC14:** Validate Script -- validate-skill.sh catches 5+ planted defects

---

## Failing Tests Created (RED Phase)

### Structural Validation Tests (109 tests)

**File:** `packages/core/src/skills/nip-to-toon-skill.test.ts` (~1120 lines)

**Test Run Results:** 108 failed, 1 passed (the TOON bare EVENT check vacuously passes because no files exist yet)

| Test Group | Test Count | Status | Verifies |
|------------|-----------|--------|----------|
| [9.2-STRUCT-001] AC1: SKILL.md Core File | 12 | RED - ENOENT | Core file, frontmatter, body limits, pipeline triggers, no extras |
| [9.2-STRUCT-001] AC1: 13-Step Pipeline | 2 | RED - ENOENT | All 13 steps documented, NIP classification |
| [9.2-STEP-001] AC2: NIP Analysis Step | 3 | RED - empty content | Event kinds, tag structures, classification |
| [9.2-STEP-002] AC3: TOON Context Injection | 5 | RED - empty content | Write model, read model, fees, relay discovery |
| [9.2-STEP-003] AC4: Social Context Layer | 4 | RED - ENOENT | Template existence, NIP-specific prompts, WHY reasoning |
| [9.2-STEP-004] AC5: Skill Authoring | 5 | RED - ENOENT | Template existence, frontmatter, Social Context, Level 3 refs |
| [9.2-STEP-005] AC6: Eval Generation | 6 | RED - ENOENT | Guide existence, trigger/output format, WHY reasoning |
| [9.2-STEP-006] AC7: TOON Assertions | 9 | RED - ENOENT | All 5 assertions documented, applicability, pass/fail criteria |
| [9.2-STEP-007] AC8: Description Optimization | 5 | RED - ENOENT | Guide existence, run_loop, iterations, best_description |
| [9.2-STEP-007b] AC9: With/Without Testing | 2 | RED - empty content | Parallel testing, output directories |
| [9.2-STEP-008] AC10: Grading + Benchmarking | 4 | RED - empty content | grading.json, benchmark.json, assertion fields |
| [9.2-STEP-009] AC11: TOON Compliance | 1 | RED - empty content | Gate documentation |
| [9.2-STEP-010] AC12: Eval Viewer + Iteration | 3 | RED - empty content | HTML review, feedback.json, iteration |
| [D9-010] AC13: Protocol Context | 8 | RED - ENOENT | All protocol sections, 9.1 consistency |
| [9.2-STRUCT-002] AC14: Validate Script Exist | 2 | RED - ENOENT | Script existence, executable permission |
| [9.2-STRUCT-003] AC14: Validate Script Correct | 12 | RED - ENOENT | All 8 lint checks, exit codes, pass on known-good skills |
| [9.2-EVAL] Eval Definitions | 12 | RED - ENOENT | JSON validity, trigger/output eval counts and fields |
| [9.2-TOON] TOON Compliance | 3 | 1 GREEN (vacuous), 2 RED | No bare EVENT, publishEvent, @toon-protocol/client |
| [9.2-QUALITY] Quality Validation | 6 | RED - ENOENT | All 6 refs, no extras, D9-008 WHY, Social Context |
| [9.2-META] Meta-Eval Readiness | 4 | RED - empty content | Read-only, write-capable, read+write, classification-driven |
| **TOTAL** | **109** | **108 RED, 1 GREEN** | |

---

## Data Factories Created

N/A -- This story produces markdown skill files, not TypeScript code. No data factories needed.

---

## Fixtures Created

N/A -- Tests use direct filesystem reads (readFileSync, existsSync, readdirSync) and execSync (for validate-skill.sh) against the skill directory. No Playwright fixtures needed.

---

## Mock Requirements

N/A -- Tests validate static files on disk and one bash script. No external services to mock.

---

## Required data-testid Attributes

N/A -- No UI components. This story produces markdown files, JSON, and one bash script.

---

## Implementation Checklist

### Test: All structural validation tests

**File:** `packages/core/src/skills/nip-to-toon-skill.test.ts`

**Tasks to make these tests pass:**

- [ ] Task 1: Create `.claude/skills/nip-to-toon-skill/` directory structure (AC1)
  - [ ] Create `SKILL.md` with YAML frontmatter (name: nip-to-toon-skill, description: ~80-120 words with pipeline triggers)
  - [ ] Create `references/` subdirectory
  - [ ] Create `evals/` subdirectory
  - [ ] Create `scripts/` subdirectory
- [ ] Task 2: Author SKILL.md frontmatter and body (AC1, AC2 through AC12)
  - [ ] Write description with NIP conversion, pipeline execution, and skill creation trigger phrases (~80-120 words)
  - [ ] Write body: 13-step pipeline procedure, NIP Classification section, "When to read each reference" section
  - [ ] Include Social Context section (pipeline-specific, not generic)
  - [ ] Keep body under 500 lines, use imperative form
- [ ] Task 3: Author reference files (AC3-AC8, AC13)
  - [ ] Write `references/toon-protocol-context.md` -- derive from Story 9.1 canonical version, must be consistent
  - [ ] Write `references/skill-structure-template.md` -- SKILL.md skeleton for generated skills
  - [ ] Write `references/social-context-template.md` -- template for NIP-specific Social Context generation
  - [ ] Write `references/eval-generation-guide.md` -- skill-creator eval format guide
  - [ ] Write `references/toon-compliance-assertions.md` -- 5 TOON assertion templates with pass/fail criteria
  - [ ] Write `references/description-optimization-guide.md` -- run_loop procedure
  - [ ] Ensure every reference explains WHY (D9-008)
- [ ] Task 4: Create validate-skill.sh script (AC14)
  - [ ] Write `scripts/validate-skill.sh` with all 8 checks
  - [ ] Make executable: `chmod +x`
  - [ ] Test against `nostr-protocol-core` (should pass)
  - [ ] Test against `nostr-social-intelligence` (should pass)
- [ ] Task 5: Create evals (AC1, AC6, AC7)
  - [ ] Write `evals/evals.json` with trigger_evals (8-10 should-trigger + 8-10 should-not-trigger) and output_evals (4-6 with TOON compliance assertions)
- [ ] Task 6: Quality validation
  - [ ] Run `scripts/validate-skill.sh` on the generated skill (self-validation)
  - [ ] Verify no bare `["EVENT", ...]` patterns
  - [ ] Verify no extraneous files
  - [ ] Run tests: `npx vitest run packages/core/src/skills/nip-to-toon-skill.test.ts`
  - [ ] All 109 tests pass (green phase)

**Estimated Effort:** 4-6 hours

---

## Running Tests

```bash
# Run all failing tests for this story
npx vitest run packages/core/src/skills/nip-to-toon-skill.test.ts

# Run with verbose output
npx vitest run packages/core/src/skills/nip-to-toon-skill.test.ts --reporter=verbose

# Run specific test group by name pattern
npx vitest run packages/core/src/skills/nip-to-toon-skill.test.ts -t "TOON Assertions"

# Run all skill tests (9.0 + 9.1 + 9.2) to check for regression
npx vitest run packages/core/src/skills/

# Run the full project test suite
pnpm test

# Watch mode during development
npx vitest packages/core/src/skills/nip-to-toon-skill.test.ts
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 109 tests written and failing (108 RED, 1 vacuous GREEN)
- Tests validate: structural correctness (directory layout, frontmatter, body limits), pipeline step documentation (all 13 steps), TOON compliance (no bare EVENT, publishEvent usage, @toon-protocol/client), eval format (trigger counts, output eval fields, TOON assertions), reference file completeness (6 refs with WHY reasoning), validate-skill.sh correctness (8 checks, exit codes, pass on known-good skills), meta-eval readiness (classification-driven assertion injection), and cross-story consistency (protocol context matches 9.1)
- No fixtures, factories, or mocks needed (filesystem + bash validation)
- Implementation checklist created mapping all 14 ACs to 6 tasks

**Verification:**

- All tests run and fail as expected (ENOENT for missing files, empty content for readAllSkillContent)
- Failure messages are clear and actionable
- Tests fail due to missing skill files, not test bugs
- Existing tests (9.0: 55/55, 9.1: 91/91) remain green -- no regression

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. Create skill directory structure
2. Author SKILL.md with frontmatter (name + description only) and 13-step pipeline body
3. Author all 6 reference files (each with WHY reasoning per D9-008)
4. Create scripts/validate-skill.sh (executable, 8 checks, exit codes)
5. Create evals/evals.json (trigger + output evals with TOON compliance assertions)
6. Run tests after each file group: `npx vitest run packages/core/src/skills/nip-to-toon-skill.test.ts`
7. Self-validate: `bash .claude/skills/nip-to-toon-skill/scripts/validate-skill.sh .claude/skills/nip-to-toon-skill/`
8. Iterate until all 109 tests pass

**Key Principles:**

- Write files following the exact patterns from Stories 9.0 and 9.1
- Use imperative form, not "you should" style
- Every reference file must explain WHY (D9-008)
- No bare `["EVENT", ...]` patterns -- always reference `publishEvent()`
- Description must include pipeline/NIP conversion trigger phrases
- `toon-protocol-context.md` must be consistent with Story 9.1's canonical version
- `validate-skill.sh` must pass on existing known-good skills (nostr-protocol-core, nostr-social-intelligence)

---

### REFACTOR Phase (After All Tests Pass)

1. Verify all 109 tests pass (green phase complete)
2. Review content accuracy against `_bmad-output/project-context.md`
3. Verify `toon-protocol-context.md` consistency with Story 9.1 canonical
4. Run `validate-skill.sh` self-validation
5. Mentally trace pipeline on 3 test NIPs: NIP-50 (read-only), NIP-25 (write-capable), NIP-23 (both) -- verify classification drives correct context injection
6. Run full suite: `pnpm test`
7. Verify no regression on 9.0 (55 tests) and 9.1 (91 tests)

---

## Next Steps

1. **Run failing tests** to confirm RED phase: `npx vitest run packages/core/src/skills/nip-to-toon-skill.test.ts --reporter=verbose`
2. **Begin implementation** using implementation checklist as guide
3. **Work one task at a time** (create directory, then SKILL.md, then references, then script, then evals)
4. **When all tests pass**, verify with `pnpm test` (full suite)
5. **Commit:** `feat(9-2): NIP-to-TOON Skill Pipeline -- SKILL.md, 6 references, evals, validate-skill.sh`

---

## Knowledge Base References Applied

- **test-design-epic-9.md** - Test IDs (9.2-STRUCT-001 through 9.2-STRUCT-003, 9.2-STEP-001 through 9.2-STEP-010, 9.2-META-001 through 9.2-META-004, D9-010), risk E9-R001 (score 9/9)
- **nostr-protocol-core.test.ts** - Sister skill test pattern (structural validation with Vitest, parseFrontmatter helper, readAllSkillContent helper, filesystem assertions)
- **nostr-social-intelligence.test.ts** - Story 9.0 test pattern reference
- **nostr-protocol-core/references/toon-protocol-context.md** - Canonical protocol context for consistency checking
- **9-2-nip-to-toon-skill-pipeline.md** - Story acceptance criteria, task breakdown, pipeline architecture, anti-patterns

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/core/src/skills/nip-to-toon-skill.test.ts --reporter=verbose`

**Summary:**

- Total tests: 109
- Passing: 1 (vacuous TOON-001 check -- no files = no violations)
- Failing: 108 (ENOENT / empty content -- skill files do not exist yet)
- Status: RED phase verified

**Expected Failure Pattern:** All failures are either `ENOENT: no such file or directory` (file existence checks) or empty string assertions (readAllSkillContent returns empty when no files exist). This is correct TDD RED phase behavior -- the skill directory `.claude/skills/nip-to-toon-skill/` does not exist yet.

### Regression Check

**Command:** `npx vitest run packages/core/src/skills/nostr-protocol-core.test.ts packages/core/src/skills/nostr-social-intelligence.test.ts`

**Result:** 146 passed (91 for 9.1, 55 for 9.0) -- no regression.

---

## Notes

- This story produces markdown + JSON + one bash script, NOT TypeScript code. The test approach is structural validation.
- Test pattern matches Stories 9.0 and 9.1 for consistency (Vitest, parseFrontmatter, readAllSkillContent, filesystem assertions).
- Test file location: `packages/core/src/skills/` (same as 9.0 and 9.1, included in vitest.config.ts include pattern).
- The TOON compliance bare `["EVENT", ...]` check vacuously passes because readAllSkillContent() returns empty when files do not exist. This is acceptable -- it provides real validation once files are created.
- The validate-skill.sh tests (9.2-STRUCT-003) include execSync calls that run the bash script against known-good skills. These tests will fail until validate-skill.sh is created AND the script correctly handles existing skills.
- The protocol context consistency test reads both the pipeline's copy and Story 9.1's canonical copy, comparing key terms. This catches drift between the two.
- Total test count (109) is higher than 9.0 (55) and 9.1 (91) because this is the highest-risk story with 14 ACs.
- Eval rubric uses assertion-based grading, matching the skill-creator eval format.
- Existing 9.0 tests (55/55) and 9.1 tests (91/91) remain green -- no regression from adding 9.2 tests.

---

**Generated by BMad TEA Agent** - 2026-03-25
