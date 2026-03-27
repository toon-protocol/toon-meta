---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
lastStep: step-04-generate-tests
lastSaved: '2026-03-27'
workflowType: testarch-atdd
inputDocuments:
  - _bmad-output/implementation-artifacts/9-26-nip34-kind-resources-skill.md
  - packages/core/src/nip34/constants.ts
  - packages/core/src/nip34/types.ts
  - packages/core/src/nip34/NIP34Handler.ts
  - packages/core/src/events/arweave-storage.test.ts
---

# ATDD Checklist - Epic 9, Story 26: NIP-34 Kind Resources Skill -- Git Collaboration

**Date:** 2026-03-27
**Author:** Jonathan
**Primary Test Level:** Unit (file structure and content validation)

---

## Story Summary

Create a git-collaboration skill covering all NIP-34 event kinds (30617, 30618, 1617, 1618, 1619, 1621, 1622, 1630-1633) plus kind:5094 (Blob Storage DVM) with per-kind Level 3 resource files, so that AI agents can construct, publish, and query decentralized git events on the TOON network.

**As a** AI agent
**I want** a git-collaboration skill with per-kind resource files for all NIP-34 event kinds
**So that** I can construct, publish, and query decentralized git events on the TOON network with precise structural knowledge of each event kind

---

## Acceptance Criteria

1. SKILL.md exists at `.claude/skills/git-collaboration/SKILL.md` with valid YAML frontmatter (name, description only) and under 500 lines
2. SKILL.md covers all 11 NIP-34 event kinds plus kind:5094 (12 total)
3. Each event kind has its own Level 3 resource file in `references/` directory
4. `references/nip-spec.md` contains consolidated NIP-34 specification
5. `references/toon-extensions.md` documents TOON write/read model, fee calculation, ILP considerations
6. `references/scenarios.md` provides social context scenarios for git collaboration on paid network
7. `evals/evals.json` contains trigger evals (8-10 true, 8-10 false) and 6-12 output evals with rubrics
8. All resource files use imperative form and follow skill-creator anatomy pattern
9. SKILL.md description is 80-120 words with social-situation triggers
10. SKILL.md includes "When to read each reference" section mapping all 15 files
11. SKILL.md includes Social Context section specific to paid git collaboration
12. All event kind resource files document: event structure (JSON), required/optional tags, content format, filter patterns, typical byte sizes, and TOON fee estimates

---

## Failing Tests Created (RED Phase)

### Unit Tests (137 tests)

**File:** `packages/core/src/nip34/git-collaboration-skill.test.ts` (580 lines)

#### 9.26-UNIT-001: SKILL.md Existence and Frontmatter (AC #1) -- 6 tests

- **Test:** [P0] SKILL.md exists at .claude/skills/git-collaboration/SKILL.md
  - **Status:** RED - File does not exist
  - **Verifies:** AC #1 file existence

- **Test:** [P0] SKILL.md has valid YAML frontmatter with --- delimiters
  - **Status:** RED - File does not exist
  - **Verifies:** AC #1 frontmatter format

- **Test:** [P0] SKILL.md frontmatter contains name field set to "git-collaboration"
  - **Status:** RED - File does not exist
  - **Verifies:** AC #1 name field

- **Test:** [P0] SKILL.md frontmatter contains description field
  - **Status:** RED - File does not exist
  - **Verifies:** AC #1 description field

- **Test:** [P0] SKILL.md frontmatter has ONLY name and description fields
  - **Status:** RED - File does not exist
  - **Verifies:** AC #1 frontmatter-only fields

- **Test:** [P0] SKILL.md is under 500 lines
  - **Status:** RED - File does not exist (guard check)
  - **Verifies:** AC #1 line count limit

#### 9.26-UNIT-002: SKILL.md Covers All Event Kinds (AC #2) -- 13 tests

- **Test:** [P0] SKILL.md mentions kind:N (x12 parameterized)
  - **Status:** RED - Empty content does not contain kind numbers
  - **Verifies:** AC #2 each kind mentioned

- **Test:** [P0] SKILL.md mentions all 11 NIP-34 kinds plus kind:5094
  - **Status:** RED - No kinds found in empty content
  - **Verifies:** AC #2 complete coverage

#### 9.26-UNIT-003: Per-Kind Resource Files (AC #3) -- 12 tests

- **Test:** [P0] references/{file} exists for kind:N (x12 parameterized)
  - **Status:** RED - Reference files do not exist
  - **Verifies:** AC #3 file existence per kind

#### 9.26-UNIT-004: NIP Spec Reference (AC #4) -- 2 tests

- **Test:** [P0] references/nip-spec.md exists
  - **Status:** RED - File does not exist
  - **Verifies:** AC #4 file existence

- **Test:** [P1] nip-spec.md contains consolidated NIP-34 specification content
  - **Status:** RED - File does not exist
  - **Verifies:** AC #4 content quality

#### 9.26-UNIT-005: TOON Extensions Reference (AC #5) -- 4 tests

- **Test:** [P0] references/toon-extensions.md exists
  - **Status:** RED - File does not exist
  - **Verifies:** AC #5 file existence

- **Test:** [P1] toon-extensions.md documents TOON write model
  - **Status:** RED - File does not exist
  - **Verifies:** AC #5 write model coverage

- **Test:** [P1] toon-extensions.md documents TOON read model
  - **Status:** RED - File does not exist
  - **Verifies:** AC #5 read model coverage

- **Test:** [P1] toon-extensions.md documents ILP considerations
  - **Status:** RED - File does not exist
  - **Verifies:** AC #5 ILP documentation

#### 9.26-UNIT-006: Scenarios Reference (AC #6) -- 2 tests

- **Test:** [P0] references/scenarios.md exists
  - **Status:** RED - File does not exist
  - **Verifies:** AC #6 file existence

- **Test:** [P1] scenarios.md provides social context for git collaboration on paid network
  - **Status:** RED - File does not exist
  - **Verifies:** AC #6 content quality

#### 9.26-UNIT-007: Evals JSON (AC #7) -- 6 tests

- **Test:** [P0] evals/evals.json exists
  - **Status:** RED - File does not exist
  - **Verifies:** AC #7 file existence

- **Test:** [P0] evals/evals.json is valid JSON
  - **Status:** RED - File does not exist
  - **Verifies:** AC #7 valid format

- **Test:** [P0] evals.json has 8-10 should_trigger:true evals
  - **Status:** RED - File does not exist
  - **Verifies:** AC #7 trigger true count

- **Test:** [P0] evals.json has 8-10 should_trigger:false evals
  - **Status:** RED - File does not exist
  - **Verifies:** AC #7 trigger false count

- **Test:** [P0] evals.json has 6-12 output evals with rubrics
  - **Status:** RED - File does not exist
  - **Verifies:** AC #7 output eval count and rubrics

- **Test:** [P1] output evals cover all major kind categories
  - **Status:** RED - File does not exist
  - **Verifies:** AC #7 category coverage (repo, patch, pr, issue, reply, status, blob)

#### 9.26-UNIT-008: Imperative Form and Skill Anatomy (AC #8) -- 13 tests

- **Test:** [P1] SKILL.md body does not start with "This skill" or similar passive phrasing
  - **Status:** RED - File does not exist (guard check)
  - **Verifies:** AC #8 imperative form

- **Test:** [P2] references/{file} uses imperative form (x12 parameterized)
  - **Status:** RED - Files do not exist
  - **Verifies:** AC #8 imperative form in references

#### 9.26-UNIT-009: Description Word Count (AC #9) -- 2 tests

- **Test:** [P0] SKILL.md description is 80-120 words
  - **Status:** RED - File does not exist
  - **Verifies:** AC #9 word count range

- **Test:** [P1] SKILL.md description contains social-situation triggers
  - **Status:** RED - File does not exist
  - **Verifies:** AC #9 social triggers

#### 9.26-UNIT-010: When to Read Each Reference (AC #10) -- 3 tests

- **Test:** [P0] SKILL.md contains a "When to read each reference" section
  - **Status:** RED - File does not exist
  - **Verifies:** AC #10 section existence

- **Test:** [P0] "When to read" section maps all 12 kind resource files
  - **Status:** RED - File does not exist
  - **Verifies:** AC #10 kind file mapping

- **Test:** [P0] "When to read" section maps nip-spec.md, toon-extensions.md, and scenarios.md
  - **Status:** RED - File does not exist
  - **Verifies:** AC #10 supplementary file mapping

#### 9.26-UNIT-011: Social Context Section (AC #11) -- 2 tests

- **Test:** [P0] SKILL.md includes a Social Context section
  - **Status:** RED - File does not exist
  - **Verifies:** AC #11 section existence

- **Test:** [P1] Social Context section is specific to paid git collaboration
  - **Status:** RED - File does not exist
  - **Verifies:** AC #11 content specificity

#### 9.26-UNIT-012: Event Kind Resource File Structural Elements (AC #12) -- 72 tests

- **Test:** [P0] references/{file} documents event structure JSON (x12)
  - **Status:** RED - Files do not exist
  - **Verifies:** AC #12 JSON event structure

- **Test:** [P1] references/{file} documents required and optional tags (x12)
  - **Status:** RED - Files do not exist
  - **Verifies:** AC #12 tag documentation

- **Test:** [P1] references/{file} documents content format (x12)
  - **Status:** RED - Files do not exist
  - **Verifies:** AC #12 content format

- **Test:** [P1] references/{file} documents filter patterns (x12)
  - **Status:** RED - Files do not exist
  - **Verifies:** AC #12 filter patterns

- **Test:** [P1] references/{file} documents typical byte size (x12)
  - **Status:** RED - Files do not exist
  - **Verifies:** AC #12 byte size estimates

- **Test:** [P1] references/{file} documents TOON fee estimates (x12)
  - **Status:** RED - Files do not exist
  - **Verifies:** AC #12 fee estimates

---

## Data Factories Created

None required. This story validates static file structure and content, not runtime data.

---

## Fixtures Created

None required. Tests use filesystem reads against the project directory.

---

## Mock Requirements

None. Tests read files directly from the filesystem.

---

## Required data-testid Attributes

Not applicable -- this is a backend/file-structure test suite with no UI.

---

## Implementation Checklist

### Test Group: 9.26-UNIT-001 (SKILL.md existence and frontmatter)

**File:** `packages/core/src/nip34/git-collaboration-skill.test.ts`

**Tasks to make these tests pass:**

- [ ] Create `.claude/skills/git-collaboration/SKILL.md`
- [ ] Add YAML frontmatter with `name: git-collaboration` and `description:` (80-120 words)
- [ ] Ensure frontmatter contains ONLY name and description fields
- [ ] Ensure total line count is under 500
- [ ] Run test: `npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts -t "9.26-UNIT-001"`

### Test Group: 9.26-UNIT-002 (event kind coverage)

**Tasks to make these tests pass:**

- [ ] Mention all 12 kinds in SKILL.md body: 30617, 30618, 1617, 1618, 1619, 1621, 1622, 1630, 1631, 1632, 1633, 5094
- [ ] Run test: `npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts -t "9.26-UNIT-002"`

### Test Group: 9.26-UNIT-003 (per-kind resource files)

**Tasks to make these tests pass:**

- [ ] Create `references/kind-30617-repository-announcement.md`
- [ ] Create `references/kind-30618-repository-state.md`
- [ ] Create `references/kind-1617-patch.md`
- [ ] Create `references/kind-1618-pull-request.md`
- [ ] Create `references/kind-1619-pr-status-update.md`
- [ ] Create `references/kind-1621-issue.md`
- [ ] Create `references/kind-1622-reply.md`
- [ ] Create `references/kind-1630-status-open.md`
- [ ] Create `references/kind-1631-status-applied.md`
- [ ] Create `references/kind-1632-status-closed.md`
- [ ] Create `references/kind-1633-status-draft.md`
- [ ] Create `references/kind-5094-blob-storage.md`
- [ ] Run test: `npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts -t "9.26-UNIT-003"`

### Test Group: 9.26-UNIT-004 (nip-spec.md)

**Tasks to make these tests pass:**

- [ ] Create `references/nip-spec.md` with consolidated NIP-34 spec
- [ ] Ensure it mentions "NIP-34", kind 30617, kind 1617
- [ ] Run test: `npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts -t "9.26-UNIT-004"`

### Test Group: 9.26-UNIT-005 (toon-extensions.md)

**Tasks to make these tests pass:**

- [ ] Create `references/toon-extensions.md`
- [ ] Document TOON write model (publishEvent, fee calculation)
- [ ] Document TOON read model (TOON-format, decoder)
- [ ] Document ILP considerations
- [ ] Run test: `npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts -t "9.26-UNIT-005"`

### Test Group: 9.26-UNIT-006 (scenarios.md)

**Tasks to make these tests pass:**

- [ ] Create `references/scenarios.md`
- [ ] Include social context for git collaboration on paid network
- [ ] Run test: `npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts -t "9.26-UNIT-006"`

### Test Group: 9.26-UNIT-007 (evals.json)

**Tasks to make these tests pass:**

- [ ] Create `evals/evals.json`
- [ ] Add 8-10 should_trigger:true trigger evals
- [ ] Add 8-10 should_trigger:false trigger evals
- [ ] Add 6-12 output evals with rubrics (cover: repo, patch, pr, issue, reply, status, blob)
- [ ] Run test: `npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts -t "9.26-UNIT-007"`

### Test Group: 9.26-UNIT-008 (imperative form)

**Tasks to make these tests pass:**

- [ ] Ensure SKILL.md body does not start with "This skill..."
- [ ] Ensure all 12 reference files do not start with "This file..."
- [ ] Use imperative voice throughout
- [ ] Run test: `npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts -t "9.26-UNIT-008"`

### Test Group: 9.26-UNIT-009 (description word count)

**Tasks to make these tests pass:**

- [ ] Verify SKILL.md description is 80-120 words
- [ ] Include social-situation triggers ("how do I...", "should I...", "what is the cost of...")
- [ ] Run test: `npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts -t "9.26-UNIT-009"`

### Test Group: 9.26-UNIT-010 (when to read each reference)

**Tasks to make these tests pass:**

- [ ] Add "When to read each reference" section to SKILL.md
- [ ] Map all 12 kind resource file names in that section
- [ ] Map nip-spec.md, toon-extensions.md, and scenarios.md
- [ ] Run test: `npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts -t "9.26-UNIT-010"`

### Test Group: 9.26-UNIT-011 (social context section)

**Tasks to make these tests pass:**

- [ ] Add "Social Context" section to SKILL.md
- [ ] Reference git-specific concepts AND paid network concepts
- [ ] Run test: `npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts -t "9.26-UNIT-011"`

### Test Group: 9.26-UNIT-012 (resource file structural elements)

**Tasks to make these tests pass:**

- [ ] Each resource file must include a JSON code block with `"kind"` field
- [ ] Each resource file must document required and optional tags
- [ ] Each resource file must document content format
- [ ] Each resource file must document filter patterns
- [ ] Each resource file must document typical byte sizes
- [ ] Each resource file must document TOON fee estimates ($ amounts or basePricePerByte)
- [ ] Run test: `npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts -t "9.26-UNIT-012"`

---

## Running Tests

```bash
# Run all failing tests for this story
npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts

# Run specific test group
npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts -t "9.26-UNIT-001"

# Run tests with verbose output
npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts --reporter=verbose

# Run tests in watch mode
npx vitest packages/core/src/nip34/git-collaboration-skill.test.ts

# Run with coverage
npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts --coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 137 tests written and failing
- No fixtures or factories needed (filesystem validation)
- Implementation checklist created
- Test file organized by AC with clear test IDs

**Verification:**

- All 137 tests run and fail as expected
- Failure messages are clear: files do not exist or content is empty
- Tests fail due to missing skill files, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. Create `.claude/skills/git-collaboration/` directory structure
2. Start with SKILL.md (passes 9.26-UNIT-001, 002, 008, 009, 010, 011)
3. Create each reference file (passes 9.26-UNIT-003, 004, 005, 006, 012)
4. Create evals.json (passes 9.26-UNIT-007)
5. Run full suite after each batch of files

---

### REFACTOR Phase (After All Tests Pass)

1. Verify all 137 tests pass
2. Cross-reference resource file event structures against TypeScript interfaces in `packages/core/src/nip34/types.ts`
3. Verify resource file alignment with parsers in `packages/rig/src/web/nip34-parsers.ts`
4. Review skill against existing skills for consistency

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/core/src/nip34/git-collaboration-skill.test.ts`

**Results:**

```
Test Files  1 failed (1)
     Tests  137 failed (137)
  Duration  275ms
```

**Summary:**

- Total tests: 137
- Passing: 0 (expected)
- Failing: 137 (expected)
- Status: RED phase verified

**Expected Failure Messages:**

- "expected false to be true" (file existence checks)
- "expected '' not to be ''" (content guard checks)
- "expected null not to be null" (frontmatter extraction)
- "expected 0 to be greater than or equal to 8" (eval count checks)

---

## Notes

- kind:30618 (Repository State) and kind:1622 (Reply) are NOT in core constants yet -- the skill resource files should note this gap
- kind:5094 is NOT a NIP-34 kind; it is a NIP-90 DVM request. Included as cross-NIP reference
- Tests use `it.each` for parameterized validation across all 12 kinds, keeping the test file DRY
- The test resolves PROJECT_ROOT via `resolve(__dirname, '../../../../')` from `packages/core/src/nip34/`

---

## Knowledge Base References Applied

- **test-quality.md** - Given-When-Then format, deterministic tests, one assertion per test
- **data-factories.md** - Not applicable (no runtime data)
- **component-tdd.md** - Not applicable (no UI components)
- **Existing pattern: arweave-storage.test.ts** - ATDD test structure, vitest conventions, P0/P1/P2 priority labels

---

**Generated by BMad TEA Agent** - 2026-03-27
