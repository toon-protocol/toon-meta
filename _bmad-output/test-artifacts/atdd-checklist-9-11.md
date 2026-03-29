---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
lastStep: 'step-04-generate-tests'
lastSaved: '2026-03-27'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/9-11-lists-and-labels-skill.md'
  - '.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh'
  - '.claude/skills/skill-eval-framework/scripts/run-eval.sh'
  - 'tests/skills/test-moderated-communities-skill.sh'
---

# ATDD Checklist - Epic 9, Story 9.11: Lists and Labels Skill

**Date:** 2026-03-27
**Author:** Jonathan
**Primary Test Level:** Shell script structural + content validation (no TypeScript, no Playwright)

---

## Story Summary

Story 9.11 produces a Claude Agent Skill for content curation and labeling on TOON Protocol. The skill covers NIP-51 (Lists) -- mute lists (kind:10000), pin lists (kind:10001), follow sets (kind:30000), bookmark sets (kind:30001), plus 9 secondary list kinds -- and NIP-32 (Labeling) -- label events (kind:1985) with namespace and value tags. It teaches agents how to organize content, curate people and bookmarks, manage mute lists, and apply structured labels on the TOON network.

**As a** TOON agent developer
**I want** a lists-and-labels skill covering NIP-51 and NIP-32
**So that** agents can organize content, curate people and bookmarks, manage mute lists, and apply structured labels on the TOON network

---

## Acceptance Criteria

1. **AC1:** SKILL.md exists at `.claude/skills/lists-and-labels/SKILL.md` with valid YAML frontmatter (name, description only) and under 500 lines
2. **AC2:** SKILL.md covers primary NIP-51 list kinds (10000, 10001, 30000, 30001), secondary NIP-51 kinds (10003-10030, 30003), and references social-identity for kind:3
3. **AC3:** SKILL.md covers NIP-32 labeling: kind:1985, label namespaces, L/l tags
4. **AC4:** references/nip-spec.md contains consolidated NIP-51 + NIP-32 specification
5. **AC5:** references/toon-extensions.md documents TOON write/read model, fee calculation, ILP considerations
6. **AC6:** references/scenarios.md provides social context scenarios for curation and labeling
7. **AC7:** evals/evals.json contains trigger evals (8-10 each) and 4-6 output evals with rubrics
8. **AC8:** All resource files follow skill-creator anatomy pattern (imperative form, reference structure)
9. **AC9:** SKILL.md description is 80-120 words with social-situation triggers
10. **AC10:** SKILL.md includes "When to read each reference" section
11. **AC11:** SKILL.md includes Social Context section specific to curation and labeling on a paid network
12. **AC12:** All event kind structures documented with JSON structure, tags, content format, filter patterns, byte sizes, fee estimates

---

## AC-to-Test Mapping

| Test ID | AC | Priority | What It Validates |
|---------|-----|----------|-------------------|
| STRUCT-A | AC1 | P0 | SKILL.md exists with valid YAML frontmatter (name + description only) |
| STRUCT-B | AC1 | P0 | references/ directory with nip-spec.md, toon-extensions.md, scenarios.md |
| STRUCT-B2 | AC1 | P0 | evals/evals.json exists and is valid JSON |
| STRUCT-C | AC1 | P0 | Body under 500 lines |
| STRUCT-D | AC11 | P0 | Social Context section exists with >= 30 words |
| AC1-NAME | AC1 | P0 | Skill name in frontmatter is "lists-and-labels" |
| AC2-NIP51 | AC2 | P0 | SKILL.md mentions NIP-51 |
| AC2-NIP32 | AC3 | P0 | SKILL.md mentions NIP-32 |
| AC2-KINDS-MUTE | AC2 | P0 | kind:10000 mute list covered |
| AC2-KINDS-PIN | AC2 | P0 | kind:10001 pin list covered |
| AC2-KINDS-PEOPLE | AC2 | P0 | kind:30000 categorized people / follow sets covered |
| AC2-KINDS-BOOKMARKS | AC2 | P0 | kind:30001 categorized bookmarks covered |
| AC2-KINDS-LABEL | AC3 | P0 | kind:1985 label event covered |
| AC2-SECONDARY | AC2 | P0 | >= 5/9 secondary NIP-51 kinds acknowledged |
| AC2-FOLLOW-REF | AC2 | P0 | References social-identity for kind:3 follow list |
| AC2-PTAGS | AC2 | P0 | p tags for people lists documented |
| AC2-ETAGS | AC2 | P0 | e tags for event references documented |
| AC2-DTAG | AC2 | P0 | d tag for parameterized replaceable lists documented |
| AC2-PRIVATE | AC2 | P0 | Encrypted/private list entries (NIP-44) documented |
| AC2-REPLSEM | AC2 | P0 | Replaceable vs parameterized replaceable semantics documented |
| AC2-DELETION | AC2 | P0 | List deletion via NIP-09 and empty republish documented |
| AC2-NAMESPACE | AC3 | P0 | L (namespace) tag documented |
| AC2-LTAG | AC3 | P0 | l (label value) tag documented |
| AC2-TARGET-TAGS | AC3 | P0 | Target reference tags (e, p, a, r) for labels documented |
| EVAL-A | AC2, AC3 | P0 | SKILL.md covers NIP-51, NIP-32, lists, labels |
| EVAL-B | AC4 | P0 | nip-spec.md covers NIP-51 + NIP-32 with event kinds |
| AC2-TOONEXT | AC5 | P0 | toon-extensions.md covers ILP/per-byte costs |
| AC2-SCENARIOS | AC6 | P0 | scenarios.md has >= 100 words |
| TOON-A | AC5 | P0 | publishEvent referenced across skill files |
| TOON-B | AC5 | P0 | Fee/cost terms referenced across skill files |
| AC3-CLIENT | AC5 | P0 | References publishEvent() from @toon-protocol/client |
| AC3-FEEREF | AC5 | P0 | References fee/cost in SKILL.md |
| AC3-COST-TRAP | AC12 | P0 | Replaceable list cost trap documented |
| AC3-BATCH | AC12 | P0 | Batching recommendation for list updates |
| AC3-COREREF | AC5 | P0 | References nostr-protocol-core for fee formula |
| TOON-C | AC5 | P0 | TOON-format referenced across skill files |
| AC4-FORMAT | AC5 | P0 | SKILL.md references TOON-format |
| AC4-FILTER-MUTE | AC12 | P0 | Filter pattern for mute list documented |
| AC4-FILTER-LABEL | AC12 | P0 | Filter pattern for labels documented |
| AC4-READREF | AC5 | P0 | References nostr-protocol-core for TOON format |
| TOON-D | AC11 | P1 | Social Context >= 100 words |
| AC5-MUTE-CONFLICT | AC11 | P1 | Mute lists as private conflict resolution |
| AC5-LABEL-HONEST | AC11 | P1 | Label honesty / integrity covered |
| AC5-COST-AWARE | AC11 | P1 | Curation cost consciousness covered |
| AC5-PUBPRIV | AC11 | P1 | Public vs private list considerations |
| AC5-SUBST | AC11 | P1 | Passes NIP-name substitution test (>= 5 list/label-specific terms) |
| EVAL-A2 | AC7 | P0 | >= 8 should-trigger queries |
| EVAL-B2 | AC7 | P0 | >= 8 should-not-trigger queries |
| EVAL-C | AC7 | P0 | >= 4 output evals |
| AC6-RUBRIC | AC7 | P0 | All output evals have rubric (correct/acceptable/incorrect) |
| AC6-TOON-ASSERT | AC7 | P0 | TOON compliance assertions in output evals |
| AC6-TRIGGER-QUERIES | AC7 | P0 | Should-trigger queries cover >= 5/9 list/label terms |
| AC6-NOTTRIGGER-QUERIES | AC7 | P0 | Should-not-trigger queries exclude >= 4/8 unrelated topics |
| AC6-EXPECTED-OPT | AC7 | P0 | All output evals have expected_output field |
| AC6-OUTPUT-ID | AC7 | P0 | All output evals have id and prompt fields |
| AC6-OUTPUT-ASSERT | AC7 | P0 | All output evals have assertions array |
| AC6-OUTPUT-RANGE | AC7 | P0 | Output eval count is 4-6 |
| TOON-ALL-1 | AC8 | P0 | validate-skill.sh passes (structural) |
| TOON-ALL-2 | AC8 | P0 | run-eval.sh passes (TOON compliance) |
| AC8-STRICT-RANGE | AC9 | P1 | Description is 80-120 words |
| AC8-TRIGPHRASES | AC9 | P1 | Description includes >= 8/16 trigger phrases |
| AC8-SOCIAL-PHRASES | AC9 | P1 | Description includes social-situation triggers |
| AC8-LIST-PHRASES | AC9 | P1 | Description includes >= 2/5 list/label-specific phrases |
| TRIG-A | AC9 | P1 | Protocol-technical triggers in description |
| TRIG-B | AC9 | P1 | Social/user-facing triggers in description |
| AC9-TOKENS | AC1 | P1 | Body approximately 5k tokens or fewer |
| DEP-A | AC8 | P1 | References nostr-protocol-core |
| DEP-B | AC8 | P1 | References nostr-social-intelligence |
| DEP-C | AC8 | P1 | References social-identity |
| DEP-D | AC8 | P1 | References public-chat |
| DEP-E | AC8 | P1 | References moderated-communities |
| AC10-NODUP | AC8 | P1 | No duplicate toon-protocol-context.md in references/ |
| AC10-DEP-ALL | AC8 | P1 | References all five upstream skills |
| CLEAN-A | AC1 | P0 | No extraneous .md files in skill root |
| AC7-NAMED-ASSERTIONS | AC8 | P0 | run-eval.sh covers all 6 named TOON assertions |
| AC7-EVAL-ASSERTIONS | AC8 | P0 | Write evals have 5 assertions, read evals have 3 |
| AC12-JSON-STRUCT | AC12 | P0 | nip-spec.md has JSON event structure examples |
| AC12-BYTE-SIZE | AC12 | P0 | Fee estimates with dollar amounts documented |
| AC12-WORD-TAG | AC12 | P0 | word tag for mute list keyword matching documented |
| AC12-SELF-LABEL | AC12 | P0 | Self-labeling pattern documented |
| AC10-REF-SECTION | AC10 | P0 | SKILL.md has "When to read each reference" section |
| AC12-CROSS-SKILL | AC2 | P1 | Cross-skill references for secondary NIP-51 kinds |
| BASE-A | -- | P2 | With/without baseline (manual, skipped) |

---

## Failing Tests Created (RED Phase)

### Shell Script Tests (83 tests)

**File:** `tests/skills/test-lists-and-labels-skill.sh` (~830 lines)

All 83 tests organized into 14 sections:

- **Structural Tests (P0):** STRUCT-A, STRUCT-B, STRUCT-B2, STRUCT-C, STRUCT-D, AC1-NAME
  - Status: RED -- skill directory does not exist yet
  - Verifies: directory structure, frontmatter, references, evals, body size, social context section

- **Content Tests -- NIP-51 Coverage (P0):** AC2-NIP51, AC2-KINDS-MUTE, AC2-KINDS-PIN, AC2-KINDS-PEOPLE, AC2-KINDS-BOOKMARKS, AC2-SECONDARY, AC2-FOLLOW-REF
  - Status: RED -- no skill files to search
  - Verifies: NIP-51 coverage, primary kinds (10000/10001/30000/30001), secondary kinds, social-identity cross-reference

- **Content Tests -- NIP-51 Tag Structure (P0):** AC2-PTAGS, AC2-ETAGS, AC2-DTAG, AC2-PRIVATE, AC2-REPLSEM, AC2-DELETION
  - Status: RED -- no skill files
  - Verifies: tag conventions (p/e/d), encrypted content, replaceable semantics, NIP-09 deletion

- **Content Tests -- NIP-32 Labeling (P0):** AC2-NIP32, AC2-KINDS-LABEL, AC2-NAMESPACE, AC2-LTAG, AC2-TARGET-TAGS
  - Status: RED -- no skill files
  - Verifies: NIP-32 coverage, kind:1985, L namespace tag, l value tag, target reference tags

- **Content Tests -- Reference Files (P0):** EVAL-A, EVAL-B, AC2-TOONEXT, AC2-SCENARIOS
  - Status: RED -- no reference files
  - Verifies: NIP coverage breadth, nip-spec completeness, toon-extensions ILP content, scenarios depth

- **TOON Write Model Tests (P0):** TOON-A, TOON-B, AC3-CLIENT, AC3-FEEREF, AC3-COST-TRAP, AC3-BATCH, AC3-COREREF
  - Status: RED -- no publishEvent, fee, or cost-trap references
  - Verifies: write model completeness, publishEvent from @toon-protocol/client, fee awareness, replaceable list cost trap, batching recommendation

- **TOON Read Model Tests (P0):** TOON-C, AC4-FORMAT, AC4-FILTER-MUTE, AC4-FILTER-LABEL, AC4-READREF
  - Status: RED -- no TOON-format or filter references
  - Verifies: TOON-format parsing, mute list filter pattern, label filter pattern, nostr-protocol-core reference

- **Social Context Tests (P1):** TOON-D, AC5-MUTE-CONFLICT, AC5-LABEL-HONEST, AC5-COST-AWARE, AC5-PUBPRIV, AC5-SUBST
  - Status: RED -- no Social Context section
  - Verifies: list/label-specific social guidance covering mute as conflict resolution, label honesty, cost consciousness, public/private considerations

- **Eval Suite Tests (P0):** EVAL-A2, EVAL-B2, EVAL-C, AC6-RUBRIC, AC6-TOON-ASSERT, AC6-TRIGGER-QUERIES, AC6-NOTTRIGGER-QUERIES, AC6-EXPECTED-OPT, AC6-OUTPUT-ID, AC6-OUTPUT-ASSERT, AC6-OUTPUT-RANGE
  - Status: RED -- evals/evals.json does not exist
  - Verifies: trigger eval counts, output eval structure, rubric, TOON assertions, trigger term coverage

- **TOON Compliance Integration Tests (P0):** TOON-ALL-1, TOON-ALL-2
  - Status: RED -- validate-skill.sh and run-eval.sh not available in worktree
  - Verifies: end-to-end structural validation + TOON compliance assertion pass

- **Description Optimization Tests (P1):** AC8-STRICT-RANGE, AC8-TRIGPHRASES, AC8-SOCIAL-PHRASES, AC8-LIST-PHRASES, TRIG-A, TRIG-B
  - Status: RED -- no description to extract
  - Verifies: word count range (80-120), trigger phrase coverage, social-situation triggers, list/label-specific phrases

- **Token Budget Tests (P1):** AC9-TOKENS
  - Status: RED -- no body to measure
  - Verifies: body under ~5k tokens (~3500 words)

- **Dependency Reference Tests (P1):** DEP-A, DEP-B, DEP-C, DEP-D, DEP-E, AC10-NODUP, AC10-DEP-ALL
  - Status: RED (except AC10-NODUP vacuously passes)
  - Verifies: five upstream skill references (nostr-protocol-core, nostr-social-intelligence, social-identity, public-chat, moderated-communities), no duplicate toon-protocol-context.md

- **Gap-Fill Tests (P0/P1):** AC12-JSON-STRUCT, AC12-BYTE-SIZE, AC12-WORD-TAG, AC12-SELF-LABEL, AC10-REF-SECTION, AC12-CROSS-SKILL
  - Status: RED -- no skill files
  - Verifies: JSON event structure examples, fee estimates with dollar amounts, word tag, self-labeling, reference guide section, cross-skill references

- **With/Without Baseline (P2):** BASE-A
  - Status: SKIPPED -- requires manual pipeline Step 8
  - Verifies: skill adds measurable value over baseline agent

- **TOON Compliance Named Assertions (P0):** AC7-NAMED-ASSERTIONS, AC7-EVAL-ASSERTIONS
  - Status: RED -- run-eval.sh not available / evals.json missing
  - Verifies: all 6 named TOON compliance assertions checked

- **Cleanliness Test (P0):** CLEAN-A
  - Status: RED -- skill directory not found
  - Verifies: no extraneous .md files in skill root

---

## Data Factories Created

Not applicable -- this story produces a Claude Agent Skill (markdown + JSON), not TypeScript code. No data factories needed.

---

## Fixtures Created

Not applicable -- shell script tests operate on filesystem checks (file existence, grep, awk, node JSON parsing). No fixtures needed.

---

## Mock Requirements

Not applicable -- tests validate static file content, not external service interactions.

---

## Required data-testid Attributes

Not applicable -- no UI components in this story.

---

## Implementation Checklist

### Test: STRUCT-A through AC1-NAME (Structural)

**File:** `tests/skills/test-lists-and-labels-skill.sh`

**Tasks to make these tests pass:**

- [ ] Create `.claude/skills/lists-and-labels/` directory
- [ ] Create `SKILL.md` with YAML frontmatter (`name: lists-and-labels`, `description: ...`)
- [ ] Create `references/nip-spec.md`, `references/toon-extensions.md`, `references/scenarios.md`
- [ ] Create `evals/evals.json` as valid JSON
- [ ] Ensure SKILL.md body is under 500 lines
- [ ] Ensure `## Social Context` section exists with >= 30 words
- [ ] Run test: `bash tests/skills/test-lists-and-labels-skill.sh`

---

### Test: AC2-NIP51 through AC2-FOLLOW-REF (NIP-51 Coverage)

**File:** `tests/skills/test-lists-and-labels-skill.sh`

**Tasks to make these tests pass:**

- [ ] Write SKILL.md body covering NIP-51, primary list kinds (10000, 10001, 30000, 30001)
- [ ] Include secondary NIP-51 kinds (10003-10030, 30003) with brief summaries
- [ ] Cross-reference social-identity skill for kind:3 follow list (do NOT duplicate)
- [ ] Run test: `bash tests/skills/test-lists-and-labels-skill.sh`

---

### Test: AC2-PTAGS through AC2-DELETION (NIP-51 Tag Structure)

**File:** `tests/skills/test-lists-and-labels-skill.sh`

**Tasks to make these tests pass:**

- [ ] Document p tags for people lists, e tags for event references, d tag for parameterized replaceable
- [ ] Document encrypted/private list entries (NIP-44 encryption in .content field)
- [ ] Document replaceable vs parameterized replaceable semantics
- [ ] Document list deletion via NIP-09 (kind:5) and empty republish
- [ ] Run test: `bash tests/skills/test-lists-and-labels-skill.sh`

---

### Test: AC2-NIP32 through AC2-TARGET-TAGS (NIP-32 Labeling)

**File:** `tests/skills/test-lists-and-labels-skill.sh`

**Tasks to make these tests pass:**

- [ ] Write SKILL.md body covering NIP-32, kind:1985 label events
- [ ] Document L (namespace) tag and l (label value) tag
- [ ] Document target reference tags (e, p, a, r) for what is being labeled
- [ ] Write nip-spec.md section on NIP-32 label event structure
- [ ] Run test: `bash tests/skills/test-lists-and-labels-skill.sh`

---

### Test: TOON-A through AC3-COREREF (Write Model)

**File:** `tests/skills/test-lists-and-labels-skill.sh`

**Tasks to make these tests pass:**

- [ ] Reference `publishEvent()` from `@toon-protocol/client` in SKILL.md
- [ ] Include fee/cost terms (per-byte, basePricePerByte)
- [ ] Document the replaceable list cost trap (entire list republished on every update)
- [ ] Recommend batching changes to minimize update costs
- [ ] Reference `nostr-protocol-core` for fee formula details
- [ ] Run test: `bash tests/skills/test-lists-and-labels-skill.sh`

---

### Test: TOON-C through AC4-READREF (Read Model)

**File:** `tests/skills/test-lists-and-labels-skill.sh`

**Tasks to make these tests pass:**

- [ ] Reference TOON-format strings in SKILL.md
- [ ] Document filter patterns for mute lists (kinds: [10000], authors: [pubkey])
- [ ] Document filter patterns for labels (kinds: [1985], #e/#L/#l)
- [ ] Reference `nostr-protocol-core`/`toon-protocol-context` for TOON format details
- [ ] Run test: `bash tests/skills/test-lists-and-labels-skill.sh`

---

### Test: TOON-D through AC5-SUBST (Social Context)

**File:** `tests/skills/test-lists-and-labels-skill.sh`

**Tasks to make these tests pass:**

- [ ] Write `## Social Context` section with >= 100 words
- [ ] Cover mute lists as private conflict resolution
- [ ] Cover label honesty and responsible labeling
- [ ] Cover curation cost consciousness (list updates grow in cost)
- [ ] Cover public vs private list considerations (encrypted entries)
- [ ] Include >= 5 list/label-specific terms (passes substitution test)
- [ ] Run test: `bash tests/skills/test-lists-and-labels-skill.sh`

---

### Test: EVAL-A2 through AC6-OUTPUT-RANGE (Eval Suite)

**File:** `tests/skills/test-lists-and-labels-skill.sh`

**Tasks to make these tests pass:**

- [ ] Create `evals/evals.json` with >= 8 should-trigger queries covering list/label terms
- [ ] Include >= 8 should-not-trigger queries excluding unrelated topics
- [ ] Include 4-6 output evals with id, prompt, expected_output, rubric, assertions
- [ ] Rubric must have correct/acceptable/incorrect for each output eval
- [ ] Include TOON compliance assertions in output eval assertions
- [ ] Run test: `bash tests/skills/test-lists-and-labels-skill.sh`

---

### Test: TOON-ALL-1, TOON-ALL-2, AC7-NAMED-ASSERTIONS, AC7-EVAL-ASSERTIONS (Compliance)

**File:** `tests/skills/test-lists-and-labels-skill.sh`

**Tasks to make these tests pass:**

- [ ] Ensure validate-skill.sh passes all 11 structural checks
- [ ] Ensure run-eval.sh passes all 6 TOON compliance assertions
- [ ] Run test: `bash tests/skills/test-lists-and-labels-skill.sh`

---

### Test: AC8-* and TRIG-* (Description Optimization)

**File:** `tests/skills/test-lists-and-labels-skill.sh`

**Tasks to make these tests pass:**

- [ ] Write description with 80-120 words
- [ ] Include >= 8/16 trigger phrases (NIP-51, NIP-32, mute, bookmark, label, kind:10000, kind:30000, kind:1985, follow set, pin, categorize, organize, curate, namespace, list, block)
- [ ] Include social-situation triggers ("how do I...", "how does...")
- [ ] Include >= 2/5 list/label-specific phrases (organize, mute, bookmark, label, curate)
- [ ] Run test: `bash tests/skills/test-lists-and-labels-skill.sh`

---

### Test: DEP-A through AC10-DEP-ALL (Dependency References)

**File:** `tests/skills/test-lists-and-labels-skill.sh`

**Tasks to make these tests pass:**

- [ ] Reference `nostr-protocol-core` in SKILL.md
- [ ] Reference `nostr-social-intelligence` in SKILL.md
- [ ] Reference `social-identity` in SKILL.md
- [ ] Reference `public-chat` in SKILL.md
- [ ] Reference `moderated-communities` in SKILL.md
- [ ] Do NOT create `references/toon-protocol-context.md` (no duplication)
- [ ] Run test: `bash tests/skills/test-lists-and-labels-skill.sh`

---

### Test: Gap-Fill Tests (AC12 detail)

**File:** `tests/skills/test-lists-and-labels-skill.sh`

**Tasks to make these tests pass:**

- [ ] Include JSON event structure examples in nip-spec.md for primary kinds
- [ ] Include fee estimates with dollar amounts
- [ ] Document word tag for mute list keyword matching
- [ ] Document self-labeling pattern (events labeling own content)
- [ ] Add "When to read each reference" section to SKILL.md
- [ ] Include cross-skill references for secondary kinds (moderated-communities, public-chat, relay-groups)
- [ ] Run test: `bash tests/skills/test-lists-and-labels-skill.sh`

---

### Test: CLEAN-A (Cleanliness)

**File:** `tests/skills/test-lists-and-labels-skill.sh`

**Tasks to make this test pass:**

- [ ] Ensure no extraneous .md files in `.claude/skills/lists-and-labels/` root (only SKILL.md)
- [ ] Run test: `bash tests/skills/test-lists-and-labels-skill.sh`

---

## Running Tests

```bash
# Run all failing tests for this story
bash tests/skills/test-lists-and-labels-skill.sh

# Run with verbose output (default -- all output shown)
bash tests/skills/test-lists-and-labels-skill.sh 2>&1 | tee /tmp/test-9-11-output.txt

# Run structural validation only (upstream script)
bash .claude/skills/nip-to-toon-skill/scripts/validate-skill.sh .claude/skills/lists-and-labels

# Run TOON compliance validation only (upstream script)
bash .claude/skills/skill-eval-framework/scripts/run-eval.sh .claude/skills/lists-and-labels
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 83 tests written (82 automated + 1 skipped)
- Test file created at `tests/skills/test-lists-and-labels-skill.sh`
- All 81 automated tests verified failing (1 pass vacuously: AC10-NODUP)
- Implementation checklist created mapping tests to tasks

**Verification:**

- All tests run and fail as expected
- Failure messages are clear and actionable
- Tests fail due to missing skill implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. Run the `nip-to-toon-skill` pipeline with NIP-51 + NIP-32 as input
2. Create the skill directory structure
3. Author SKILL.md with frontmatter, body, and Social Context section
4. Author reference files (nip-spec.md, toon-extensions.md, scenarios.md)
5. Create evals/evals.json
6. Run `bash tests/skills/test-lists-and-labels-skill.sh` after each major change
7. Iterate until all tests pass

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

1. Verify all tests pass
2. Run description optimization pass (ensure trigger coverage)
3. Verify token budget compliance
4. Run validate-skill.sh and run-eval.sh independently
5. Verify no content duplication with upstream skills
6. Verify cross-skill references are accurate (social-identity for kind:3, public-chat for kind:10005, etc.)

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow
2. **Run failing tests** to confirm RED phase: `bash tests/skills/test-lists-and-labels-skill.sh`
3. **Begin implementation** using the `nip-to-toon-skill` pipeline
4. **Work section by section** (structural first, then content, then evals)
5. **When all tests pass**, verify with upstream validation scripts
6. **When complete**, commit with: `feat(9-11): Lists and Labels Skill -- NIP-51/NIP-32, kind:10000/10001/30000/30001/1985, 83 tests`

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **test-moderated-communities-skill.sh** -- Pattern reference for shell-based skill validation (Story 9.9, 82 tests)
- **validate-skill.sh** -- Upstream structural validation (11 checks)
- **run-eval.sh** -- Upstream TOON compliance validation (6 assertions)
- **9-11-lists-and-labels-skill.md** -- Story spec with 12 acceptance criteria, 6 tasks, detailed dev notes

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `bash tests/skills/test-lists-and-labels-skill.sh`

**Results:**

```
=== ATDD Test Results ===
Total: 83 | Passed: 1 | Failed: 81 | Skipped: 1
Status: RED (TDD red phase -- 81 failing tests)
```

**Summary:**

- Total tests: 83 (82 automated + 1 skipped)
- Passing: 1 (AC10-NODUP vacuously true -- directory doesn't exist)
- Failing: 81 (expected -- skill not yet implemented)
- Skipped: 1 (BASE-A -- manual pipeline step)
- Status: RED phase verified

---

## Notes

- This story produces a Claude Agent Skill (markdown + JSON), not TypeScript. All tests are shell-based file/content validation.
- Test count is 83 (vs 82 in Story 9.9) due to NIP-51/NIP-32 dual-NIP coverage requiring additional kind-specific, tag-structure, and cross-skill tests.
- AC10-NODUP passes vacuously in RED phase because the skill directory doesn't exist yet. It will remain passing after implementation if no toon-protocol-context.md is duplicated.
- BASE-A (with/without baseline) is skipped because it requires manual execution of pipeline Step 8 (parallel subagent comparison).
- Key distinction from prior skills: NIP-51 lists are replaceable events that republish entirely on every update, creating a cost trap that agents must understand. The AC3-COST-TRAP and AC3-BATCH tests specifically validate this guidance.
- Cross-skill overlap is extensive: kind:3 (social-identity), kind:10004 (moderated-communities), kind:10005 (public-chat), kind:10009 (relay-groups). Tests DEP-C/DEP-D/DEP-E and AC12-CROSS-SKILL validate these references exist without duplication.
- The dependency reference tests target social-identity, public-chat, and moderated-communities (instead of social-interactions, content-references, relay-groups used in Story 9.9) because NIP-51 secondary kinds directly reference those skills' domains.

---

**Generated by BMad TEA Agent** - 2026-03-27
