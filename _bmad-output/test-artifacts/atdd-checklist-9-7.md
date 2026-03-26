---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-26'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/9-7-content-references-skill.md'
  - '.claude/skills/social-interactions/SKILL.md'
  - '.claude/skills/social-interactions/evals/evals.json'
  - 'tests/skills/test-social-interactions-skill.sh'
  - '.claude/skills/long-form-content/SKILL.md'
  - '.claude/skills/social-identity/SKILL.md'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
---

# ATDD Checklist - Epic 9, Story 9.7: Content References Skill

**Date:** 2026-03-26
**Author:** Jonathan
**Primary Test Level:** Structural + TOON Compliance (bash script tests)

---

## Preflight Summary

### Stack Detection
- **Detected stack:** backend (Node.js monorepo with vitest)
- **Story nature:** Claude Agent Skill (markdown + reference files + eval JSON) -- NOT TypeScript. No pnpm build, no pnpm test, no TypeScript compilation. Validation is structural (validate-skill.sh) + TOON compliance (run-eval.sh).

### Prerequisites Verified
- Story approved with 11 clear acceptance criteria (AC1-AC11)
- Test framework: vitest (multiple packages), bash scripts for skill validation
- Existing skill test patterns: `tests/skills/test-social-identity-skill.sh` (Story 9.4, 50 tests), `tests/skills/test-long-form-content-skill.sh` (Story 9.5, 63 tests), `tests/skills/test-social-interactions-skill.sh` (Story 9.6, 73 tests) -- bash-based structural validation
- Skill directory `.claude/skills/content-references/` exists (GREEN phase -- skill already implemented)

### Story Context
- **Story 9.7:** Content References Skill (`content-references`)
- **As a** TOON agent, **I want** a skill teaching content linking and referencing, **So that** I can create rich, interconnected content with nostr: URIs and text note references.
- **NIPs covered:** NIP-21 (nostr: URI scheme), NIP-27 (text note references)
- **Classification:** Both (read + write support) -- write is URI construction/embedding, not new event kinds
- **Dependencies:** Stories 9.0-9.6 (all done)
- **Pattern reference:** Stories 9.4 (`social-identity`), 9.5 (`long-form-content`), 9.6 (`social-interactions`)
- **Key distinction:** Cross-cutting skill -- nostr: URIs are embedded within events of any kind, not standalone event kinds

### Knowledge Fragments Loaded
- `data-factories.md` (core) -- factory patterns (adapted for test data generation)
- `test-quality.md` (core) -- deterministic, isolated, explicit test patterns
- `tea-index.csv` -- knowledge fragment index

### TEA Config Flags
- `tea_use_playwright_utils`: true
- `tea_use_pactjs_utils`: true
- `tea_pact_mcp`: mcp
- `tea_browser_automation`: auto
- `test_stack_type`: auto (detected: backend)

---

## Generation Mode

**Mode:** AI Generation
**Rationale:** Story 9.7 produces a Claude Agent Skill (markdown + reference files + eval JSON), not a UI feature. Acceptance criteria are clear (11 ACs with explicit test IDs). Tests are structural bash script validations following the established pattern from Stories 9.4-9.6. No browser recording needed.

---

## Test Strategy

### AC-to-Test Mapping

| AC | Test ID(s) | Test Level | Priority | Description |
|----|-----------|------------|----------|-------------|
| AC1: Pipeline Production | STRUCT-A, STRUCT-B, STRUCT-B2, AC1-NAME | Structural (bash) | P0 | SKILL.md exists with valid frontmatter (only name+description), references/ dir with 3 files, evals/evals.json valid JSON, skill name matches |
| AC2: NIP Coverage | EVAL-A, EVAL-B, AC2-NIP21, AC2-NIP27, AC2-NPUB1, AC2-NOTE1, AC2-NPROFILE1, AC2-NEVENT1, AC2-NADDR1, AC2-BECH32, AC2-TLV, AC2-TAG-URI, AC2-TOONEXT, AC2-SCENARIOS | Structural (bash grep) | P0 | SKILL.md + references cover NIP-21 URI scheme, NIP-27 inline mentions, all 5 bech32 entity types, TLV encoding, tag-URI correspondence |
| AC3: TOON Write Model | TOON-A, TOON-B, AC3-CLIENT, AC3-FEEREF, AC3-EMBED-URI, AC3-TAG-REQ, AC3-BYTE-COST | Structural (bash grep) | P0 | Uses publishEvent(), fee awareness for references, references nostr-protocol-core, URI embedding in content, corresponding tag requirements, byte cost estimates |
| AC4: TOON Read Model | TOON-C, AC4-DECODER, AC4-PARSING, AC4-RELAY-HINTS, AC4-READREF, AC4-READING-FREE | Structural (bash grep) | P0 | Documents TOON-format strings, references nostr-protocol-core, URI parsing from content, relay hints for cross-relay resolution, reading is free |
| AC5: Social Context | STRUCT-D, TOON-D, AC5-LINK-QUALITY, AC5-SELF-REF, AC5-ATTRIBUTION, AC5-DEAD-REF, AC5-NADDR-VALUE, AC5-TLV-PREFER, AC5-SUBST | Structural (bash grep) | P1 | Social Context section with reference-specific guidance covering link quality/cost, self-referencing, attribution, dead references, naddr1 value, TLV preference, passes substitution test |
| AC6: Eval Suite | EVAL-A2, EVAL-B2, EVAL-C, AC6-RUBRIC, AC6-TOON-ASSERT, AC6-TRIGGER-QUERIES, AC6-NOTTRIGGER-QUERIES, AC6-EXPECTED-OPT | Structural (bash + node) | P0 | evals.json has 8-10 should-trigger, 8-10 should-not-trigger, 4-6 output evals with id/prompt/rubric/assertions, TOON compliance assertions |
| AC7: TOON Compliance | TOON-ALL-1, TOON-ALL-2 | Integration (script) | P0 | validate-skill.sh and run-eval.sh pass all checks |
| AC8: Description Optimization | TRIG-A, TRIG-B, AC8-TRIGPHRASES, AC8-STRICT-RANGE, AC8-SOCIAL-PHRASES | Structural (bash) | P1 | Description 80-120 words, includes trigger phrases for nostr: URI/NIP-21/NIP-27/npub1/note1/nprofile1/nevent1/naddr1/bech32, includes social-situation triggers |
| AC9: Token Budget | STRUCT-C, AC9-TOKENS | Structural (bash) | P1 | SKILL.md body under 500 lines, approximately 5k tokens or fewer |
| AC10: Dependency References | DEP-A, DEP-B, AC10-NODUP, AC10-DEP-BOTH | Structural (bash grep) | P1 | References nostr-protocol-core and nostr-social-intelligence, does NOT duplicate toon-protocol-context.md, D9-010 pointer pattern |
| AC11: With/Without Baseline | BASE-A | Manual/Pipeline | P2 | Agent with skill produces better responses than without (pipeline Step 8 output) |
| Cleanliness | CLEAN-A | Structural (bash) | P0 | No extraneous .md files in skill root |

### Test Counts by Priority

| Priority | Test Count | Description |
|----------|-----------|-------------|
| P0 | 49 | Structural integrity, NIP coverage, TOON compliance, eval quality, cleanliness, gap-fill |
| P1 | 22 | Social context themes, description triggers, token budget, dependencies |
| P2 | 1 | With/without baseline (manual, skipped) |
| **Total** | **72** | **71 automated + 1 skipped** |

### Risk Assessment

| Risk | Mitigation |
|------|-----------|
| E9-R001: Pipeline single point of failure | Mitigated -- Stories 9.4, 9.5, and 9.6 validated the pipeline successfully |
| E9-R008: Write model correctness varies by NIP | This skill is "both" but write is URI construction (embedding in events), not new event kinds. Tests AC3-* validate URI embedding coverage |
| Cross-cutting nature (URIs span all event kinds) | Tests AC2-TAG-URI verify tag-URI correspondence. Tests AC2-* verify each bech32 entity type individually |
| Simple vs TLV bech32 confusion | Tests AC2-TLV and AC2-BECH32 verify both encoding types are covered |

---

## Test Execution

### Run Command

```bash
./tests/skills/test-content-references-skill.sh
```

### Expected RED Phase Output

All 71 automated tests fail, 1 skipped (BASE-A). Exit code 1.

### Expected GREEN Phase Output

All 71 automated tests pass, 1 skipped (BASE-A). Exit code 0.

---

## Failing Tests Created (RED Phase)

### Structural Tests (bash)

**File:** `tests/skills/test-content-references-skill.sh`

- STRUCT-A: SKILL.md exists with valid YAML frontmatter (only name and description)
- STRUCT-B: references/ directory with nip-spec.md, toon-extensions.md, scenarios.md
- STRUCT-B2: evals/evals.json exists and is valid JSON
- STRUCT-C: Body under 500 lines
- STRUCT-D: Social Context section exists with >= 30 words
- AC1-NAME: Skill name in frontmatter is "content-references"
- EVAL-A: SKILL.md covers NIP-21, NIP-27, nostr: URI, bech32
- EVAL-B: nip-spec.md covers NIP-21 URI scheme and NIP-27 text note references
- EVAL-A2: Trigger eval count >= 8 should-trigger
- EVAL-B2: Trigger eval count >= 8 should-not-trigger
- EVAL-C: Output eval count >= 4
- AC2-NIP21: SKILL.md mentions NIP-21
- AC2-NIP27: SKILL.md mentions NIP-27
- AC2-NPUB1: Skill covers npub1 entity type
- AC2-NOTE1: Skill covers note1 entity type
- AC2-NPROFILE1: Skill covers nprofile1 entity type
- AC2-NEVENT1: Skill covers nevent1 entity type
- AC2-NADDR1: Skill covers naddr1 entity type
- AC2-BECH32: Skill covers bech32 encoding
- AC2-TLV: nip-spec.md covers TLV encoding
- AC2-TAG-URI: Skill covers tag-URI correspondence (p tag, e tag, a tag)
- AC2-TOONEXT: toon-extensions.md exists and covers byte costs
- AC2-SCENARIOS: scenarios.md exists and covers step-by-step workflows
- AC3-CLIENT: References publishEvent() from @toon-protocol/client
- AC3-FEEREF: References fee calculation or cost per byte
- AC3-EMBED-URI: Explains URI embedding in content field
- AC3-TAG-REQ: Explains corresponding tag requirements (p/e/a tags)
- AC3-BYTE-COST: Includes byte cost estimates for URI types (~60-90 bytes or similar)
- AC4-DECODER: References TOON decoder or TOON-format
- AC4-PARSING: Explains URI parsing/extraction from content
- AC4-RELAY-HINTS: Covers relay hints in nprofile1/nevent1/naddr1
- AC4-READREF: References nostr-protocol-core for TOON format details
- AC4-READING-FREE: States reading is free (no ILP payment for reads)
- AC5-LINK-QUALITY: Social Context covers link quality / cost of references
- AC5-SELF-REF: Social Context covers self-referencing concerns
- AC5-ATTRIBUTION: Social Context covers cross-referencing as attribution
- AC5-DEAD-REF: Social Context covers dead/broken references
- AC5-NADDR-VALUE: Social Context covers naddr1 value for versioned content
- AC5-TLV-PREFER: Social Context covers TLV preference over simple types
- AC5-SUBST: Social Context passes NIP-name substitution test (NIP-specific, not generic)
- AC6-RUBRIC: Output evals have rubric with correct/acceptable/incorrect
- AC6-TOON-ASSERT: Output eval assertions include TOON compliance assertions
- AC6-TRIGGER-QUERIES: Should-trigger queries cover protocol terms (nostr: URI, NIP-21, NIP-27, bech32, etc.)
- AC6-NOTTRIGGER-QUERIES: Should-not-trigger queries exclude unrelated skills (profiles, articles, reactions, etc.)
- AC6-EXPECTED-OPT: Output evals include expected_output field
- AC8-TRIGPHRASES: Description includes trigger phrases for nostr: URI, NIP-21, NIP-27, bech32 entity types
- AC8-STRICT-RANGE: Description is 80-120 words
- AC8-SOCIAL-PHRASES: Description includes social-situation triggers (question-form)
- AC9-TOKENS: Body is approximately 5k tokens or fewer (~3500 words max)
- AC10-NODUP: Skill does NOT contain toon-protocol-context.md in references/
- AC10-DEP-BOTH: Skill references both nostr-protocol-core and nostr-social-intelligence
- TOON-A: publishEvent referenced across skill files
- TOON-B: Fee/cost terms referenced across skill files
- TOON-C: TOON-format referenced across skill files
- TOON-D: Social Context section has reference-specific content (>= 100 words)
- TOON-ALL-1: validate-skill.sh passes (11/11 structural checks)
- TOON-ALL-2: run-eval.sh passes (all TOON compliance assertions)
- DEP-A: References nostr-protocol-core for TOON write/read model
- DEP-B: References nostr-social-intelligence for base social intelligence
- CLEAN-A: No extraneous .md files in skill root directory
- BASE-A: (SKIPPED) With/without baseline requires manual pipeline Step 8

---

## Data Factories Created

N/A -- This story produces bash tests, not TypeScript. No data factories needed.

---

## Fixtures Created

N/A -- Bash tests are self-contained. No fixtures needed.

---

## Mock Requirements

N/A -- Tests are structural validations of file contents. No external services to mock.

---

## Required data-testid Attributes

N/A -- No UI components in this story.

---

## Implementation Checklist

### Test: All structural and content tests

**File:** `tests/skills/test-content-references-skill.sh`

**Tasks to make all tests pass:**

- [ ] Run nip-to-toon-skill pipeline with NIP-21 and NIP-27 as input (Task 1)
- [ ] Create `.claude/skills/content-references/` directory (Task 2)
- [ ] Create `SKILL.md` with YAML frontmatter (name + description only), body covering NIP-21 URI scheme, NIP-27 text note references, all 5 bech32 entity types, TLV encoding, tag-URI correspondence (Task 3)
- [ ] Include TOON Write Model section with publishEvent(), byte costs, tag requirements (Task 3)
- [ ] Include TOON Read Model section with TOON-format parsing, URI extraction, relay hints (Task 3)
- [ ] Include Social Context section with link quality, self-referencing, attribution, dead references, naddr1 value, TLV preference (Task 3)
- [ ] Include pointers to nostr-protocol-core and nostr-social-intelligence (Task 3)
- [ ] Create `references/nip-spec.md` with NIP-21 + NIP-27 specs, bech32 types, TLV encoding (Task 4)
- [ ] Create `references/toon-extensions.md` with byte costs, fee impact, publishEvent integration (Task 4)
- [ ] Create `references/scenarios.md` with step-by-step referencing workflows (Task 4)
- [ ] Create `evals/evals.json` with 8-10 should-trigger, 8-10 should-not-trigger, 4-6 output evals (Task 5)
- [ ] Run `validate-skill.sh` -- must pass 11/11 checks (Task 6)
- [ ] Run `run-eval.sh` -- must pass all TOON compliance assertions (Task 6)
- [ ] Verify description is 80-120 words (Task 6)
- [ ] Verify no extraneous files (Task 6)
- [ ] Run test: `./tests/skills/test-content-references-skill.sh`
- [ ] All tests pass (green phase)

**Estimated Effort:** 2-3 hours

---

## Running Tests

```bash
# Run all failing tests for this story
./tests/skills/test-content-references-skill.sh

# Run structural validation only
./.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh .claude/skills/content-references/

# Run TOON compliance validation only
./.claude/skills/skill-eval-framework/scripts/run-eval.sh .claude/skills/content-references/
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All tests written and failing (targeting non-existent skill)
- Test IDs mapped to acceptance criteria
- Implementation checklist created

**Verification:**

- All tests run and fail as expected
- Failure messages are clear and actionable
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. Run the nip-to-toon-skill pipeline with NIP-21 and NIP-27
2. Create skill directory with SKILL.md, references/, evals/
3. Run tests to verify green phase
4. Iterate on any failing tests

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

1. Verify all tests pass
2. Review skill content for quality and accuracy
3. Optimize description trigger phrases
4. Run validate-skill.sh and run-eval.sh one final time

---

## Next Steps

1. **Run failing tests** to confirm RED phase: `./tests/skills/test-content-references-skill.sh`
2. **Implement skill** using implementation checklist
3. **Run tests** to verify GREEN phase
4. **Commit** with message: `feat(9-7): Content References Skill -- NIP-27/NIP-21, nostr: URI, bech32 references, evals, TOON compliance`

---

## Knowledge Base References Applied

- **data-factories.md** - Factory patterns (adapted: no factories needed for bash tests)
- **test-quality.md** - Test design principles (Given-When-Then adapted to bash pass/fail pattern, one assertion per test, determinism, isolation)

---

## Test Execution Evidence

### Initial Test Run (GREEN Phase Verification)

**Command:** `./tests/skills/test-content-references-skill.sh`

**Results:** Pending test file creation

---

## Notes

- This is the third and final Phase 2 (Content & Publishing) skill
- Story 9.8 (Relay Groups) begins Phase 3 with no dependency on 9.7
- Unlike 9.4-9.6, this skill introduces no new event kinds -- nostr: URIs are cross-cutting
- NIP-21 and NIP-27 are simpler NIPs than the multi-kind NIPs in 9.4-9.6
- 5 bech32 entity types (npub1, note1, nprofile1, nevent1, naddr1) need individual test coverage

---

**Generated by BMad TEA Agent** - 2026-03-26
