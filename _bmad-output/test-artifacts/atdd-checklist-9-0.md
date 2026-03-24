---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-24'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/9-0-social-intelligence-base-skill.md'
  - '.claude/skills/skill-creator/SKILL.md'
  - '.claude/skills/rfc-0001-interledger-architecture/SKILL.md'
  - 'vitest.config.ts'
---

# ATDD Checklist - Epic 9, Story 0: Social Intelligence Base Skill (`nostr-social-intelligence`)

**Date:** 2026-03-24
**Author:** Jonathan
**Primary Test Level:** Unit (Structural Validation)

---

## Story Summary

As a TOON agent, I want a cross-cutting social intelligence skill that teaches me when and why to use each interaction type, so that I behave as a thoughtful social participant rather than a protocol-executing bot.

**As a** TOON agent
**I want** a cross-cutting social intelligence skill that teaches me when and why to use each interaction type
**So that** I behave as a thoughtful social participant rather than a protocol-executing bot

**Nature of deliverable:** This story produces a **Claude Agent Skill** (structured markdown + reference files + eval JSON), NOT TypeScript code. The output is a `.claude/skills/nostr-social-intelligence/` directory following Anthropic's skill-creator format.

---

## Acceptance Criteria

1. **AC1 [9.0-STRUCT-001]** - SKILL.md core file: valid YAML frontmatter with `name` and `description`, body under 500 lines, imperative form, reference guidance section
2. **AC2 [9.0-TRIGGER-001]** - Description triggers on 5 social-situation categories: interaction choice, social judgment, community norms, conflict handling, TOON economics
3. **AC3 [9.0-STRUCT-002]** - `references/interaction-decisions.md`: conditional decision tree with amplification, comment, react, silence + context modifiers
4. **AC4 [9.0-STRUCT-003]** - `references/context-norms.md`: behavior matrix for public feed, small groups, large groups, DMs, long-form
5. **AC5 [9.0-STRUCT-004]** - `references/trust-signals.md`: follow count, relay membership, NIP-05, new accounts
6. **AC6 [9.0-STRUCT-005]** - `references/conflict-resolution.md`: escalation ladder (ignore -> mute/NIP-51 -> block -> report/NIP-56), NIP-29 group handling
7. **AC7 [9.0-STRUCT-006]** - `references/pseudonymous-culture.md`: identity, relay diversity, ILP quality floors, censorship resistance, interoperability
8. **AC8 [9.0-STRUCT-007]** - `references/economics-of-interaction.md`: reaction cost, long-form cost, chat cost, deletion cost, basePricePerByte
9. **AC9 [9.0-STRUCT-008]** - `references/anti-patterns.md`: 7 anti-patterns with descriptions and remedies
10. **AC10 [9.0-EVAL-001]** - `evals/evals.json`: 8-10 should-trigger, 8-10 should-not-trigger, 4-6 output evals with rubric grading

---

## Failing Tests Created (RED Phase)

### Unit Tests - Structural Validation (41 tests)

**File:** `packages/core/src/skills/nostr-social-intelligence.test.ts` (480 lines)

#### AC1: SKILL.md Core File [9.0-STRUCT-001] (6 tests)

- **Test:** [P0] SKILL.md exists at .claude/skills/nostr-social-intelligence/SKILL.md
  - **Status:** RED - skipped (skill directory not created yet)
  - **Verifies:** AC #1 file existence

- **Test:** [P0] SKILL.md has valid YAML frontmatter with name and description
  - **Status:** RED - skipped
  - **Verifies:** AC #1 frontmatter structure

- **Test:** [P0] SKILL.md frontmatter has ONLY name and description (no extraneous fields)
  - **Status:** RED - skipped
  - **Verifies:** AC #1 skill-creator compliance

- **Test:** [P1] SKILL.md body is under 500 lines
  - **Status:** RED - skipped
  - **Verifies:** AC #1 progressive disclosure

- **Test:** [P1] SKILL.md body contains "When to read each reference" guidance
  - **Status:** RED - skipped
  - **Verifies:** AC #1 reference guidance

- **Test:** [P1] SKILL.md body uses imperative/infinitive form (no "you should")
  - **Status:** RED - skipped
  - **Verifies:** AC #1 writing style

#### AC2: Description Triggers [9.0-TRIGGER-001] (6 tests)

- **Test:** [P0] description includes interaction choice triggers
  - **Status:** RED - skipped
  - **Verifies:** AC #2 trigger category 1

- **Test:** [P0] description includes social judgment triggers
  - **Status:** RED - skipped
  - **Verifies:** AC #2 trigger category 2

- **Test:** [P0] description includes community norms triggers
  - **Status:** RED - skipped
  - **Verifies:** AC #2 trigger category 3

- **Test:** [P0] description includes conflict handling triggers
  - **Status:** RED - skipped
  - **Verifies:** AC #2 trigger category 4

- **Test:** [P0] description includes TOON economics triggers
  - **Status:** RED - skipped
  - **Verifies:** AC #2 trigger category 5

- **Test:** [P1] description is between 80-120 words
  - **Status:** RED - skipped
  - **Verifies:** AC #2 description length

#### AC3: Interaction Decisions [9.0-STRUCT-002] (3 tests)

- **Test:** [P0] references/interaction-decisions.md exists
  - **Status:** RED - skipped
  - **Verifies:** AC #3 file existence

- **Test:** [P0] interaction-decisions.md contains decision tree with amplification, comment, react, silence
  - **Status:** RED - skipped
  - **Verifies:** AC #3 decision tree content

- **Test:** [P1] interaction-decisions.md includes context modifiers (group size, feed vs DM, long-form)
  - **Status:** RED - skipped
  - **Verifies:** AC #3 context modifiers

#### AC4: Context Norms [9.0-STRUCT-003] (2 tests)

- **Test:** [P0] references/context-norms.md exists
  - **Status:** RED - skipped
  - **Verifies:** AC #4 file existence

- **Test:** [P0] context-norms.md covers all 5 context types
  - **Status:** RED - skipped
  - **Verifies:** AC #4 behavior matrix coverage

#### AC5: Trust Signals [9.0-STRUCT-004] (2 tests)

- **Test:** [P0] references/trust-signals.md exists
  - **Status:** RED - skipped
  - **Verifies:** AC #5 file existence

- **Test:** [P0] trust-signals.md covers follow count, relay membership, NIP-05, and new accounts
  - **Status:** RED - skipped
  - **Verifies:** AC #5 trust signal topics

#### AC6: Conflict Resolution [9.0-STRUCT-005] (3 tests)

- **Test:** [P0] references/conflict-resolution.md exists
  - **Status:** RED - skipped
  - **Verifies:** AC #6 file existence

- **Test:** [P0] conflict-resolution.md covers escalation ladder
  - **Status:** RED - skipped
  - **Verifies:** AC #6 escalation steps

- **Test:** [P1] conflict-resolution.md addresses NIP-29 group conflict
  - **Status:** RED - skipped
  - **Verifies:** AC #6 group handling

#### AC7: Pseudonymous Culture [9.0-STRUCT-006] (2 tests)

- **Test:** [P0] references/pseudonymous-culture.md exists
  - **Status:** RED - skipped
  - **Verifies:** AC #7 file existence

- **Test:** [P0] pseudonymous-culture.md covers identity, relay diversity, ILP quality, censorship resistance, interoperability
  - **Status:** RED - skipped
  - **Verifies:** AC #7 content coverage

#### AC8: Economics of Interaction [9.0-STRUCT-007] (3 tests)

- **Test:** [P0] references/economics-of-interaction.md exists
  - **Status:** RED - skipped
  - **Verifies:** AC #8 file existence

- **Test:** [P0] economics-of-interaction.md covers reactions cost, long-form cost, chat cost, deletion cost
  - **Status:** RED - skipped
  - **Verifies:** AC #8 cost topics

- **Test:** [P1] economics-of-interaction.md mentions basePricePerByte or per-byte pricing
  - **Status:** RED - skipped
  - **Verifies:** AC #8 TOON-specific pricing

#### AC9: Anti-Patterns [9.0-STRUCT-008] (3 tests)

- **Test:** [P0] references/anti-patterns.md exists
  - **Status:** RED - skipped
  - **Verifies:** AC #9 file existence

- **Test:** [P0] anti-patterns.md documents all 7 anti-patterns
  - **Status:** RED - skipped
  - **Verifies:** AC #9 anti-pattern catalog

- **Test:** [P1] anti-patterns.md includes remedies for each anti-pattern
  - **Status:** RED - skipped
  - **Verifies:** AC #9 remedies

#### AC10: Eval Definitions [9.0-EVAL-001] (7 tests)

- **Test:** [P0] evals/evals.json exists
  - **Status:** RED - skipped
  - **Verifies:** AC #10 file existence

- **Test:** [P0] evals.json is valid JSON
  - **Status:** RED - skipped
  - **Verifies:** AC #10 JSON validity

- **Test:** [P0] evals.json has trigger_evals array with >= 8 should-trigger and >= 8 should-not-trigger
  - **Status:** RED - skipped
  - **Verifies:** AC #10 trigger eval counts

- **Test:** [P0] evals.json has output_evals array with 4-6 entries
  - **Status:** RED - skipped
  - **Verifies:** AC #10 output eval count

- **Test:** [P0] output_evals use rubric-based grading (appropriate/acceptable/inappropriate)
  - **Status:** RED - skipped
  - **Verifies:** AC #10 rubric grading (E9-R004)

- **Test:** [P1] each trigger_eval has query and should_trigger fields
  - **Status:** RED - skipped
  - **Verifies:** AC #10 trigger eval structure

- **Test:** [P1] each output_eval has id, prompt, expected_output, and assertions
  - **Status:** RED - skipped
  - **Verifies:** AC #10 output eval structure

#### Structural Quality Validation [9.0-QUALITY] (4 tests)

- **Test:** [P0] skill directory contains exactly the expected files (no extraneous files)
  - **Status:** RED - skipped
  - **Verifies:** Skill-creator compliance (no README, CHANGELOG, etc.)

- **Test:** [P0] all 7 reference files exist and are non-empty
  - **Status:** RED - skipped
  - **Verifies:** All ACs file existence

- **Test:** [P0] references directory contains exactly 7 files (no extras)
  - **Status:** RED - skipped
  - **Verifies:** No extraneous reference files

- **Test:** [P1] every reference file explains WHY (reasoning), not just rules (D9-008)
  - **Status:** RED - skipped
  - **Verifies:** D9-008 compliance across all references

---

## Data Factories Created

N/A — This story produces markdown and JSON files, not TypeScript code. No data factories are needed.

---

## Fixtures Created

N/A — Structural validation tests use `fs.readFileSync` and `fs.existsSync` directly. No test fixtures are needed.

---

## Mock Requirements

N/A — Tests validate static file content on disk. No external services or mocks required.

---

## Required data-testid Attributes

N/A — This story produces no UI components.

---

## Implementation Checklist

### Task 1: Create skill directory structure (AC #1)

**Tests that will pass:** 9.0-STRUCT-001 (file existence test)

**Tasks to make tests pass:**

- [ ] Create `.claude/skills/nostr-social-intelligence/` directory
- [ ] Create `references/` subdirectory
- [ ] Create `evals/` subdirectory
- [ ] Run test: `npx vitest run packages/core/src/skills/nostr-social-intelligence.test.ts`

**Estimated Effort:** 0.25 hours

---

### Task 2: Author SKILL.md (AC #1, #2)

**Tests that will pass:** 9.0-STRUCT-001 (all 6 tests), 9.0-TRIGGER-001 (all 6 tests)

**Tasks to make tests pass:**

- [ ] Write SKILL.md with YAML frontmatter: `name: nostr-social-intelligence`, `description: ...`
- [ ] Description must include all 5 trigger categories (interaction choice, social judgment, community norms, conflict handling, TOON economics)
- [ ] Description must be 80-120 words
- [ ] Write body with core decision framework, progressive disclosure, "When to read each reference" section
- [ ] Body under 500 lines, imperative form (no "you should")
- [ ] Frontmatter has ONLY `name` and `description` fields
- [ ] Run test: `npx vitest run packages/core/src/skills/nostr-social-intelligence.test.ts`

**Estimated Effort:** 1.5 hours

---

### Task 3: Author 7 reference files (AC #3-#9)

**Tests that will pass:** 9.0-STRUCT-002 through 9.0-STRUCT-008, 9.0-QUALITY

**Tasks to make tests pass:**

- [ ] Write `references/interaction-decisions.md` — decision tree: amplify -> comment -> react -> silence + context modifiers (group size, feed vs DM, long-form)
- [ ] Write `references/context-norms.md` — behavior matrix: public feed, small NIP-29 groups, large groups, DMs, long-form
- [ ] Write `references/trust-signals.md` — follow count, relay membership (ILP-gated), NIP-05, new accounts
- [ ] Write `references/conflict-resolution.md` — escalation ladder: ignore -> mute (NIP-51) -> block -> report (NIP-56), NIP-29 group handling (defer to admins)
- [ ] Write `references/pseudonymous-culture.md` — identity/keys, relay diversity, ILP quality floors, censorship resistance, interoperability
- [ ] Write `references/economics-of-interaction.md` — reaction cost, long-form cost, chat cost, deletion cost, basePricePerByte/per-byte pricing
- [ ] Write `references/anti-patterns.md` — 7 anti-patterns (Over-Reactor, Template Responder, Context-Blind Engager, Engagement Maximizer, Sycophant, Over-Explainer, Instant Responder) with remedies
- [ ] Every reference file must explain WHY (reasoning), not just rules (D9-008 compliance)
- [ ] No extraneous files in references/ (exactly 7 files)
- [ ] Run test: `npx vitest run packages/core/src/skills/nostr-social-intelligence.test.ts`

**Estimated Effort:** 3 hours

---

### Task 4: Create evals (AC #10)

**Tests that will pass:** 9.0-EVAL-001 (all 7 tests)

**Tasks to make tests pass:**

- [ ] Create `evals/evals.json` with `trigger_evals` array (>= 8 should-trigger + >= 8 should-not-trigger)
- [ ] Should-trigger queries: social-situation scenarios (not protocol questions)
- [ ] Should-not-trigger queries: protocol-only questions (distinguish from `nostr-protocol-core`)
- [ ] Create `output_evals` array with 4-6 entries
- [ ] Each output_eval has `id`, `prompt`, `expected_output`, `assertions`
- [ ] Use rubric-based grading: appropriate / acceptable / inappropriate (not binary pass/fail)
- [ ] Valid JSON (verify with `node -e "JSON.parse(require('fs').readFileSync('evals/evals.json','utf8'))"`)
- [ ] Run test: `npx vitest run packages/core/src/skills/nostr-social-intelligence.test.ts`

**Estimated Effort:** 1.5 hours

---

### Task 5: Quality validation (all ACs)

**Tests that will pass:** 9.0-QUALITY (all 4 tests)

**Tasks to make tests pass:**

- [ ] Verify skill directory has exactly: SKILL.md, references/, evals/ (no README.md, CHANGELOG.md, etc.)
- [ ] Verify all 7 reference files non-empty
- [ ] Verify references/ has exactly 7 files
- [ ] Verify every reference file contains reasoning language (because/reason/why/since)
- [ ] Run full test suite: `npx vitest run packages/core/src/skills/nostr-social-intelligence.test.ts`
- [ ] All 41 tests pass (green phase)

**Estimated Effort:** 0.5 hours

---

## Running Tests

```bash
# Run all failing tests for this story
npx vitest run packages/core/src/skills/nostr-social-intelligence.test.ts

# Run specific test group (e.g., SKILL.md structure)
npx vitest run packages/core/src/skills/nostr-social-intelligence.test.ts -t "STRUCT-001"

# Run with verbose output
npx vitest run packages/core/src/skills/nostr-social-intelligence.test.ts --reporter=verbose

# Run in watch mode during development
npx vitest packages/core/src/skills/nostr-social-intelligence.test.ts

# Run all project tests (should still pass — these are skipped)
pnpm test
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 41 tests written and skipped (RED phase)
- Tests validate structural requirements of a Claude Agent Skill
- Implementation checklist maps each AC to concrete file creation tasks
- No fixtures, factories, or mocks needed (file system validation)

**Verification:**

```
 Test Files  1 skipped (1)
      Tests  41 skipped (41)
```

- All tests are skipped (RED phase confirmed)
- Tests will fail until skill files are created at `.claude/skills/nostr-social-intelligence/`
- Failure is due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Create directory structure** (Task 1) — 4 tests will un-skip on file existence
2. **Author SKILL.md** (Task 2) — 12 tests cover frontmatter and description triggers
3. **Author reference files** (Task 3) — 18 tests cover content requirements
4. **Create evals.json** (Task 4) — 7 tests cover eval structure and rubric
5. **Quality validation** (Task 5) — remove `test.skip()` and verify all 41 pass

**Key Principles:**

- This is a content creation story, not code — "implementation" means writing markdown and JSON
- Each reference file must explain WHY (reasoning) not just WHAT (rules) — per D9-008
- Description is the trigger mechanism — all social-situation trigger phrases go there, not in body
- Progressive disclosure: body < 500 lines, references hold the depth

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

1. Review SKILL.md for token efficiency (is every line worth the context cost?)
2. Ensure reference files don't duplicate SKILL.md body content
3. Verify evals distinguish this skill from `nostr-protocol-core` (Story 9.1)
4. Confirm all 41 tests pass after any content edits

---

## Next Steps

1. **Review this checklist** in standup or planning
2. **Run failing tests** to confirm RED phase: `npx vitest run packages/core/src/skills/nostr-social-intelligence.test.ts`
3. **Begin implementation** using implementation checklist as guide
4. **Work one task at a time** (create files, remove test.skip(), verify green)
5. **When all 41 tests pass**, story is structurally complete
6. **Expected commit:** `feat(9-0): Social Intelligence Base Skill (nostr-social-intelligence)`

---

## Knowledge Base References Applied

This ATDD workflow consulted the following sources:

- **skill-creator/SKILL.md** — Canonical skill anatomy, progressive disclosure, writing guidelines, eval format
- **rfc-0001-interledger-architecture/SKILL.md** — Example frontmatter pattern (name + description only)
- **Story 9.0 implementation artifact** — Acceptance criteria, dev notes, anti-patterns, TOON-specific context
- **vitest.config.ts** — Test include patterns (`packages/*/src/**/*.test.ts`), environment (node)
- **test-quality.md** principles — Given-When-Then structure, one assertion per test, determinism

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/core/src/skills/nostr-social-intelligence.test.ts`

**Results:**

```
 RUN  v1.6.1 /Users/jonathangreen/Documents/crosstown

 ↓ packages/core/src/skills/nostr-social-intelligence.test.ts  (41 tests | 41 skipped)

 Test Files  1 skipped (1)
      Tests  41 skipped (41)
   Start at  15:44:24
   Duration  388ms (transform 43ms, setup 0ms, collect 65ms, tests 0ms, environment 0ms, prepare 87ms)
```

**Summary:**

- Total tests: 41
- Passing: 0 (expected)
- Skipped: 41 (expected — RED phase)
- Status: RED phase verified

---

## Notes

- This story produces a Claude Agent Skill (markdown + JSON), NOT TypeScript code — no `pnpm build` impact
- Tests use `import.meta.dirname` to resolve project root — requires Node 20+ (already a project prerequisite)
- The `yaml` package is used for frontmatter parsing (already a project dependency)
- Tests are co-located in `packages/core/src/skills/` to match vitest include patterns
- When DEV removes `test.skip()`, tests will fail until corresponding skill files exist — this is intentional TDD
- Story 9.3 (eval framework) will provide automated eval execution; these tests only validate eval structure

---

**Generated by BMad TEA Agent** - 2026-03-24
