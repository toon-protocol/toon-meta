---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-24'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/9-1-toon-protocol-core-skill.md'
  - '_bmad-output/planning-artifacts/test-design-epic-9.md'
  - '.claude/skills/nostr-social-intelligence/SKILL.md'
  - 'packages/core/src/skills/nostr-social-intelligence.test.ts'
  - 'vitest.config.ts'
---

# ATDD Checklist - Epic 9, Story 9.1: TOON Protocol Core Skill (nostr-protocol-core)

**Date:** 2026-03-24
**Author:** Jonathan
**Primary Test Level:** Structural Validation (Vitest)

---

## Story Summary

Story 9.1 produces a **Claude Agent Skill** (structured markdown + reference files + eval JSON) teaching the foundational TOON protocol mechanics -- ILP-gated writes via `publishEvent()`, TOON format reads, fee calculation, NIP-10 threading, and NIP-19 entity encoding.

**As a** TOON agent
**I want** a foundational skill teaching TOON's NIP-01 implementation (ILP-gated writes, TOON format reads)
**So that** every interaction I make respects the pay-to-write, free-to-read model.

---

## Acceptance Criteria

1. **AC1:** SKILL.md core file with valid frontmatter (name + description only)
2. **AC2:** Description triggers on 5 protocol-situation categories (~80-120 words)
3. **AC3:** TOON write model (publishEvent, fee calculation, pricing discovery, error handling)
4. **AC4:** TOON read model (NIP-01 subscriptions, TOON format strings)
5. **AC5:** Fee calculation reference (basePricePerByte formula, kind:10032, DVM override, bid cap)
6. **AC6:** NIP-10 threading (e tag markers, p tags, thread construction)
7. **AC7:** NIP-19 entity encoding (bech32 npub/nsec/note/nevent/nprofile/naddr)
8. **AC8:** Social Context section (pay-to-write quality floor, pointer to nostr-social-intelligence)
9. **AC9:** Excluded NIPs (NIP-13/42/47/57/98 with ILP rationale)
10. **AC10:** TOON Protocol Context reference (canonical single-source-of-truth for pipeline)
11. **AC11:** Eval definitions (trigger evals + output evals with rubric grading)

---

## Failing Tests Created (RED Phase)

### Structural Validation Tests (80 tests)

**File:** `packages/core/src/skills/nostr-protocol-core.test.ts` (1030 lines)

**Test Run Results:** 79 failed, 1 passed (the TOON-001 bare EVENT check vacuously passes because no files exist yet)

| Test ID | Test Name | Status | Verifies |
|---------|-----------|--------|----------|
| 9.1-STRUCT-001 | SKILL.md exists | RED - ENOENT | AC1: Core file existence |
| 9.1-STRUCT-001 | Valid YAML frontmatter | RED - ENOENT | AC1: name + description fields |
| 9.1-STRUCT-001 | ONLY name and description | RED - ENOENT | AC1: No extraneous frontmatter |
| 9.1-STRUCT-001 | Body under 500 lines | RED - ENOENT | AC1: Progressive disclosure |
| 9.1-STRUCT-001 | "When to read each reference" | RED - ENOENT | AC1: Reference guidance |
| 9.1-STRUCT-001 | Imperative form (no "you should") | RED - ENOENT | AC1: Writing style |
| 9.1-STRUCT-001 | TOON-first with NIP-01 baseline | RED - ENOENT | AC1/AC3: D9-002 compliance |
| 9.1-STRUCT-001 | TOON read model overview | RED - ENOENT | AC1/AC4: Read model in body |
| 9.1-STRUCT-001 | Skill directory structure | RED - ENOENT | AC1: No extraneous files |
| 9.1-STRUCT-001 | references/ exists | RED - ENOENT | AC1: Directory layout |
| 9.1-STRUCT-001 | evals/ exists | RED - ENOENT | AC1: Directory layout |
| 9.1-STRUCT-001 | Description: publishing triggers | RED - ENOENT | AC2: Trigger category 1 |
| 9.1-STRUCT-001 | Description: fee triggers | RED - ENOENT | AC2: Trigger category 2 |
| 9.1-STRUCT-001 | Description: reading triggers | RED - ENOENT | AC2: Trigger category 3 |
| 9.1-STRUCT-001 | Description: threading triggers | RED - ENOENT | AC2: Trigger category 4 |
| 9.1-STRUCT-001 | Description: encoding triggers | RED - ENOENT | AC2: Trigger category 5 |
| 9.1-STRUCT-001 | Description 80-120 words | RED - ENOENT | AC2: Word count |
| 9.1-STRUCT-002 | toon-write-model.md exists | RED - ENOENT | AC3: Write model reference |
| 9.1-STRUCT-002 | publishEvent() API | RED - ENOENT | AC3: Correct API usage |
| 9.1-STRUCT-002 | @toon-protocol/client | RED - ENOENT | AC3: Correct transport |
| 9.1-STRUCT-002 | Pricing discovery | RED - ENOENT | AC3: kind:10032/NIP-11 |
| 9.1-STRUCT-002 | Fee calculation formula | RED - ENOENT | AC3: basePricePerByte |
| 9.1-STRUCT-002 | F04 error handling | RED - ENOENT | AC3: Error handling |
| 9.1-STRUCT-002 | No condition/fulfillment (D9-005) | RED - ENOENT | AC3: Simplified model |
| 9.1-STRUCT-002 | Code example | RED - ENOENT | AC3: publishEvent() example |
| 9.1-STRUCT-002 | Amount override + bid cap | RED - ENOENT | AC3: D7-007/D7-006 |
| 9.1-STRUCT-001 | toon-read-model.md exists | RED - ENOENT | AC4: Read model reference |
| 9.1-STRUCT-001 | NIP-01 REQ subscriptions | RED - ENOENT | AC4: Subscription docs |
| 9.1-TOON-003 | TOON format strings | RED - ENOENT | AC4: Not JSON objects |
| 9.1-STRUCT-001 | Subscription examples | RED - ENOENT | AC4: Filter/code examples |
| 9.1-STRUCT-003 | fee-calculation.md exists | RED - ENOENT | AC5: Fee calculation ref |
| 9.1-STRUCT-003 | basePricePerByte formula | RED - ENOENT | AC5: Core formula |
| 9.1-STRUCT-003 | Default 10n | RED - ENOENT | AC5: Default value |
| 9.1-STRUCT-003 | kind:10032 pricing | RED - ENOENT | AC5: Pricing discovery |
| 9.1-STRUCT-003 | DVM amount override | RED - ENOENT | AC5: D7-007 |
| 9.1-STRUCT-003 | kindPricing | RED - ENOENT | AC5: Kind-specific pricing |
| 9.1-STRUCT-003 | Bid safety cap | RED - ENOENT | AC5: D7-006 |
| 9.1-STRUCT-003 | Route-aware fees | RED - ENOENT | AC5: resolveRouteFees |
| 9.1-STRUCT-004 | nip10-threading.md exists | RED - ENOENT | AC6: Threading reference |
| 9.1-STRUCT-004 | e tag markers | RED - ENOENT | AC6: root/reply/mention |
| 9.1-STRUCT-004 | p tags | RED - ENOENT | AC6: Participant tracking |
| 9.1-STRUCT-004 | Thread construction | RED - ENOENT | AC6: Construction patterns |
| 9.1-STRUCT-004 | nip19-entities.md exists | RED - ENOENT | AC7: Entities reference |
| 9.1-STRUCT-004 | bech32 entity types | RED - ENOENT | AC7: All 6 types |
| 9.1-STRUCT-004 | bech32 encoding/decoding | RED - ENOENT | AC7: Encode/decode docs |
| 9.1-STRUCT-005 | Social Context section | RED - ENOENT | AC8: Section exists |
| 9.1-STRUCT-005 | Pay-to-write quality floor | RED - ENOENT | AC8: Required text |
| 9.1-STRUCT-005 | nostr-social-intelligence ref | RED - ENOENT | AC8: Sister skill pointer |
| 9.1-STRUCT-006 | excluded-nips.md exists | RED - ENOENT | AC9: Excluded NIPs ref |
| 9.1-STRUCT-006 | NIP-13 with ILP rationale | RED - ENOENT | AC9: PoW exclusion |
| 9.1-STRUCT-006 | NIP-42 with ILP rationale | RED - ENOENT | AC9: Relay Auth exclusion |
| 9.1-STRUCT-006 | NIP-47 with ILP rationale | RED - ENOENT | AC9: Wallet Connect exclusion |
| 9.1-STRUCT-006 | NIP-57 with ILP rationale | RED - ENOENT | AC9: Zaps exclusion |
| 9.1-STRUCT-006 | NIP-98 with ILP rationale | RED - ENOENT | AC9: HTTP Auth exclusion |
| 9.1-STRUCT-001 | toon-protocol-context.md exists | RED - ENOENT | AC10: Context reference |
| 9.1-STRUCT-001 | Write model summary | RED - ENOENT | AC10: Write model in context |
| 9.1-STRUCT-001 | Read model summary | RED - ENOENT | AC10: Read model in context |
| 9.1-STRUCT-001 | @toon-protocol/client transport | RED - ENOENT | AC10: Transport reference |
| 9.1-STRUCT-001 | Relay discovery | RED - ENOENT | AC10: NIP-11/kind:10032 |
| 9.1-STRUCT-001 | Social economics | RED - ENOENT | AC10: Economic context |
| 9.1-STRUCT-001 | No condition/fulfillment | RED - ENOENT | AC10: D9-005 |
| 9.1-STRUCT-001 | Self-contained for pipeline | RED - ENOENT | AC10: D9-010 |
| 9.1-EVAL-001 | evals.json exists | RED - ENOENT | AC11: Eval file existence |
| 9.1-EVAL-001 | Valid JSON | RED - ENOENT | AC11: JSON validity |
| 9.1-EVAL-001 | 8-10 trigger + 8-10 non-trigger | RED - ENOENT | AC11: Trigger eval counts |
| 9.1-EVAL-001 | 4-6 output evals | RED - ENOENT | AC11: Output eval counts |
| 9.1-EVAL-001 | Rubric-based grading | RED - ENOENT | AC11: correct/acceptable/incorrect |
| 9.1-EVAL-001 | trigger_eval fields | RED - ENOENT | AC11: query + should_trigger |
| 9.1-EVAL-001 | output_eval fields | RED - ENOENT | AC11: id + prompt + rubric + assertions |
| 9.1-EVAL-001 | Protocol-situation triggers | RED - ENOENT | AC11: Should-trigger content |
| 9.1-EVAL-001 | Social-judgment non-triggers | RED - ENOENT | AC11: Should-not-trigger content |
| 9.1-EVAL-001 | Substantive prompts | RED - ENOENT | AC11: Prompt quality |
| 9.1-EVAL-001 | Substantive rubrics | RED - ENOENT | AC11: Rubric quality |
| 9.1-TOON-001 | No bare ["EVENT", ...] | GREEN (vacuous) | TOON compliance: no files yet |
| 9.1-TOON-002 | Fee in write model | RED - ENOENT | TOON compliance: fee check |
| 9.1-TOON-003 | TOON format in read model | RED - ENOENT | TOON compliance: format check |
| 9.1-QUALITY | All 7 references exist | RED - ENOENT | Quality: file existence |
| 9.1-QUALITY | 7 reference files only | RED - ENOENT | Quality: no extras |
| 9.1-QUALITY | 1 eval file only | RED - ENOENT | Quality: no extras |
| 9.1-QUALITY | WHY reasoning (D9-008) | RED - ENOENT | Quality: reasoning check |

---

## Data Factories Created

N/A -- This story produces markdown skill files, not TypeScript code. No data factories needed.

---

## Fixtures Created

N/A -- Tests use direct filesystem reads (readFileSync, existsSync, readdirSync) against the skill directory. No Playwright fixtures needed.

---

## Mock Requirements

N/A -- Tests validate static files on disk. No external services to mock.

---

## Required data-testid Attributes

N/A -- No UI components. This story produces markdown files.

---

## Implementation Checklist

### Test: All structural validation tests

**File:** `packages/core/src/skills/nostr-protocol-core.test.ts`

**Tasks to make these tests pass:**

- [ ] Task 1: Create `.claude/skills/nostr-protocol-core/` directory structure (AC1)
  - [ ] Create `SKILL.md` with YAML frontmatter (name + description)
  - [ ] Create `references/` subdirectory
  - [ ] Create `evals/` subdirectory
- [ ] Task 2: Author SKILL.md frontmatter and body (AC1, AC2, AC3, AC4, AC8)
  - [ ] Write description with all 5 trigger categories (~80-120 words)
  - [ ] Write body: TOON write model overview, read model overview, fee summary, NIP-10/NIP-19 summary
  - [ ] Include "When to read each reference" section
  - [ ] Include Social Context section with required text and nostr-social-intelligence pointer
  - [ ] Keep body under 500 lines, use imperative form
- [ ] Task 3: Author reference files (AC3, AC4, AC5, AC6, AC7, AC9, AC10)
  - [ ] Write `references/toon-write-model.md` (publishEvent, pricing, fees, F04, D9-005, code examples)
  - [ ] Write `references/toon-read-model.md` (NIP-01 REQ, TOON format strings, filter examples)
  - [ ] Write `references/fee-calculation.md` (basePricePerByte, 10n default, kind:10032, DVM override, bid cap, route fees)
  - [ ] Write `references/nip10-threading.md` (e tags: root/reply/mention, p tags, thread construction)
  - [ ] Write `references/nip19-entities.md` (bech32 npub/nsec/note/nevent/nprofile/naddr)
  - [ ] Write `references/excluded-nips.md` (NIP-13/42/47/57/98 with ILP rationale)
  - [ ] Write `references/toon-protocol-context.md` (canonical single-source-of-truth: write model, read model, transport, discovery, economics, no condition/fulfillment)
  - [ ] Ensure every reference explains WHY (D9-008)
- [ ] Task 4: Create evals (AC11)
  - [ ] Write `evals/evals.json` with trigger_evals (8-10 should-trigger + 8-10 should-not-trigger) and output_evals (4-6 with rubric: correct/acceptable/incorrect)
- [ ] Task 5: Verify no bare `["EVENT", ...]` patterns in any file (9.1-TOON-001)
- [ ] Run tests: `npx vitest run packages/core/src/skills/nostr-protocol-core.test.ts`
- [ ] All 80 tests pass (green phase)

**Estimated Effort:** 3-5 hours

---

## Running Tests

```bash
# Run all failing tests for this story
npx vitest run packages/core/src/skills/nostr-protocol-core.test.ts

# Run with verbose output
npx vitest run packages/core/src/skills/nostr-protocol-core.test.ts --reporter=verbose

# Run specific test by name pattern
npx vitest run packages/core/src/skills/nostr-protocol-core.test.ts -t "TOON Write"

# Run the full test suite (includes 9.0 + 9.1)
pnpm test

# Watch mode during development
npx vitest packages/core/src/skills/nostr-protocol-core.test.ts
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 80 tests written and failing (79 RED, 1 vacuous GREEN)
- Tests validate structural correctness, content coverage, TOON compliance, and eval format
- No fixtures, factories, or mocks needed (file-system validation)
- Implementation checklist created mapping all ACs to tasks

**Verification:**

- All tests run and fail as expected (ENOENT -- files don't exist yet)
- Failure messages are clear: ENOENT for missing files
- Tests fail due to missing skill files, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. Create skill directory structure
2. Author SKILL.md with frontmatter and body
3. Author all 7 reference files
4. Create evals/evals.json
5. Run tests after each file: `npx vitest run packages/core/src/skills/nostr-protocol-core.test.ts`
6. Iterate until all 80 tests pass

**Key Principles:**

- Write files following the exact patterns from Story 9.0 (nostr-social-intelligence)
- Use imperative form, not "you should" style
- Every reference file must explain WHY (D9-008)
- No bare `["EVENT", ...]` patterns anywhere
- Description must cover all 5 trigger categories

---

### REFACTOR Phase (After All Tests Pass)

1. Verify all tests pass (green phase complete)
2. Review content for accuracy against project-context.md
3. Verify toon-protocol-context.md is self-contained for pipeline injection
4. Verify evals distinguish clearly from nostr-social-intelligence
5. Run full suite: `pnpm test`

---

## Next Steps

1. **Run failing tests** to confirm RED phase: `npx vitest run packages/core/src/skills/nostr-protocol-core.test.ts`
2. **Begin implementation** using implementation checklist as guide
3. **Work one task at a time** (create directory, then SKILL.md, then references, then evals)
4. **When all tests pass**, verify with `pnpm test` (full suite)
5. **Commit:** `feat(9-1): TOON Protocol Core Skill (nostr-protocol-core)`

---

## Knowledge Base References Applied

- **test-design-epic-9.md** - Test IDs (9.1-STRUCT-001 through 9.1-STRUCT-006, 9.1-EVAL-001 through 9.1-EVAL-005, 9.1-TOON-001 through 9.1-TOON-003)
- **nostr-social-intelligence.test.ts** - Sister skill test pattern (structural validation with Vitest, parseFrontmatter helper, filesystem assertions)
- **vitest.config.ts** - Test framework configuration and path resolution
- **9-1-toon-protocol-core-skill.md** - Story acceptance criteria and task breakdown

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/core/src/skills/nostr-protocol-core.test.ts --reporter=verbose`

**Summary:**

- Total tests: 80
- Passing: 1 (vacuous TOON-001 check -- no files = no violations)
- Failing: 79 (all ENOENT -- skill files do not exist yet)
- Status: RED phase verified

**Expected Failure Pattern:** All failures are `ENOENT: no such file or directory` because the skill directory `.claude/skills/nostr-protocol-core/` does not exist yet. This is correct TDD RED phase behavior.

---

## Notes

- This story produces markdown + JSON files, NOT TypeScript code. The test approach is structural validation.
- Test pattern matches Story 9.0 (nostr-social-intelligence.test.ts) for consistency.
- Test file location: `packages/core/src/skills/` (same as 9.0, included in vitest.config.ts include pattern).
- The TOON-001 test (no bare `["EVENT", ...]`) vacuously passes because readAllSkillContent() returns empty string when files don't exist. This is acceptable -- it will provide real validation once files are created.
- Eval rubric uses `correct/acceptable/incorrect` categories (not `appropriate/acceptable/inappropriate` as in 9.0) because this skill tests protocol correctness, not social appropriateness.
- Existing 9.0 tests (55/55) remain green -- no regression.

---

**Generated by BMad TEA Agent** - 2026-03-24
