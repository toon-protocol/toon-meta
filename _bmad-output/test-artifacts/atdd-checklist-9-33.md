---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-generation', 'step-04-verification']
lastStep: 'step-04-verification'
lastSaved: '2026-03-27'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/9-33-relay-discovery-skill.md'
---

# ATDD Checklist - Epic 9, Story 9.33: Relay Discovery Skill

**Date:** 2026-03-27
**Author:** Jonathan
**Primary Test Level:** Component (structural validation of skill files)

---

## Story Summary

As a TOON agent, I want a relay-discovery skill covering NIP-11 (Relay Information Document), NIP-65 (Relay List Metadata), and NIP-66 (Relay Discovery and Liveness), so that I can find, evaluate, and navigate TOON relays on the network.

**As a** TOON agent
**I want** a relay-discovery skill covering NIP-11/65/66
**So that** I can find, evaluate, and navigate TOON relays

---

## Acceptance Criteria

1. SKILL.md exists at `.claude/skills/relay-discovery/SKILL.md` with valid YAML frontmatter (name, description only) and under 500 lines
2. SKILL.md covers NIP-11 with TOON-enriched extensions: pricing, ILP capabilities, chain config, x402, TEE attestation
3. SKILL.md covers NIP-65 kind:10002 relay list metadata with read/write designations
4. SKILL.md covers NIP-66: kind:10166, kind:30166, kind:10066
5. `references/nip-spec.md` covers consolidated NIP-11 + NIP-65 + NIP-66 specification
6. `references/toon-extensions.md` documents TOON-specific enrichments
7. `references/scenarios.md` provides social context scenarios for relay selection
8. `evals/evals.json` contains trigger evals (8-10 true, 8-10 false) and 4-6 output evals
9. All resource files use imperative form and follow skill-creator anatomy pattern
10. Description is 80-120 words with social-situation triggers
11. SKILL.md includes "When to read each reference" section
12. SKILL.md includes Social Context section specific to relay choice on paid network
13. All relay information structures documented with JSON/HTTP structure, tags, TOON extensions
14. Skill is read-focused: kind:10002 is the only writable event
15. No duplication with nostr-protocol-core, DVM skills, or social-identity skill

---

## Failing Tests Created (RED Phase)

### Vitest Tests (131 tests)

**File:** `packages/core/src/skills/relay-discovery.test.ts` (~1170 lines)

Test categories:
- **STRUCT-A** AC1: Directory Layout (6 tests) -- RED: ENOENT, skill directory does not exist
- **STRUCT-B** AC1: Frontmatter Validity (2 tests) -- RED: ENOENT
- **AC2** NIP-11 Coverage (11 tests) -- RED: ENOENT
- **AC3** NIP-65 Coverage (5 tests) -- RED: ENOENT
- **AC4** NIP-66 Coverage (10 tests) -- RED: ENOENT
- **AC5** nip-spec.md Consolidated (6 tests) -- RED: ENOENT
- **AC6** toon-extensions.md Coverage (12 tests) -- RED: ENOENT
- **AC7** scenarios.md Coverage (7 tests) -- RED: ENOENT
- **EVAL-A** Trigger Evals (7 tests) -- RED: ENOENT
- **EVAL-B** Output Evals (7 tests) -- RED: ENOENT
- **STRUCT-D** Writing Style (3 tests) -- RED: ENOENT
- **AC10** Description Optimization (10 tests) -- RED: ENOENT
- **AC11** When to Read Each Reference (4 tests) -- RED: ENOENT
- **TOON-D** Social Context (7 tests) -- RED: ENOENT
- **AC13** Relay Information Structures (4 tests) -- RED: ENOENT
- **TOON-A** Read-Focused Write Model (4 tests) -- RED: ENOENT
- **TOON-B** Fee Awareness (4 tests) -- RED: ENOENT
- **TOON-C** TOON Format (2 tests) -- RED: ENOENT
- **DEP-A** No Duplication (4 tests) -- RED: ENOENT
- **STRUCT-C** Token Budget (2 tests) -- RED: ENOENT
- **TOON compliance** trigger-coverage + eval-completeness (2 tests) -- RED: ENOENT
- **BASE-A** With/Without Baseline (2 tests) -- RED: ENOENT
- **Cross-cutting** r tag consistency (3 tests) -- RED: ENOENT
- **Cross-cutting** /health endpoint consistency (3 tests) -- RED: ENOENT
- **Cross-cutting** Seed relay discovery consistency (3 tests) -- RED: ENOENT

### Shell Tests (100 tests)

**File:** `tests/skills/test-relay-discovery-skill.sh` (~680 lines)

- 99 automated tests -- all FAIL (skill files do not exist)
- 1 skipped test (BASE-A: requires manual pipeline execution)

---

## Data Factories Created

None required -- this story validates static skill files (markdown + JSON), not runtime code.

---

## Fixtures Created

None required -- tests use `readFileSync` directly on skill file paths.

---

## Mock Requirements

None required -- tests validate file existence and content, no external services.

---

## Required data-testid Attributes

Not applicable -- this is a skill-only story with no UI components.

---

## Implementation Checklist

### Test: STRUCT-A -- Directory Layout

**File:** `packages/core/src/skills/relay-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] Create directory `.claude/skills/relay-discovery/`
- [ ] Create directory `.claude/skills/relay-discovery/references/`
- [ ] Create directory `.claude/skills/relay-discovery/evals/`
- [ ] Create `SKILL.md` with YAML frontmatter
- [ ] Create `references/nip-spec.md`
- [ ] Create `references/toon-extensions.md`
- [ ] Create `references/scenarios.md`
- [ ] Create `evals/evals.json`
- [ ] Run test: `npx vitest run packages/core/src/skills/relay-discovery.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: AC2 -- NIP-11 Coverage

**Tasks to make this test pass:**

- [ ] SKILL.md body covers NIP-11, relay information document, TOON-enriched extensions
- [ ] Cover basePricePerByte, ILP capabilities, chain config, x402, TEE attestation, payment_required
- [ ] nip-spec.md covers HTTP GET with Accept: application/nostr+json header
- [ ] nip-spec.md covers standard fields, limitation object, retention, relay_countries

**Estimated Effort:** 1 hour

---

### Test: AC3 -- NIP-65 Coverage

**Tasks to make this test pass:**

- [ ] SKILL.md body covers NIP-65 kind:10002, relay list metadata, read/write designations
- [ ] nip-spec.md covers r tags, read/write markers, no content field, replaceable event

**Estimated Effort:** 0.5 hours

---

### Test: AC4 -- NIP-66 Coverage

**Tasks to make this test pass:**

- [ ] SKILL.md body covers NIP-66 kind:10166, kind:30166, kind:10066
- [ ] nip-spec.md covers d tag = relay URL, rtt tags, t tags, parameterized replaceable

**Estimated Effort:** 0.5 hours

---

### Test: AC6 -- toon-extensions.md

**Tasks to make this test pass:**

- [ ] Cover enriched /health endpoint with all TOON fields
- [ ] Cover seed relay discovery (kind:10036) and ILP peer info (kind:10032)
- [ ] Document read-focused nature, fee estimates, relay evaluation criteria

**Estimated Effort:** 1 hour

---

### Test: AC8 -- Eval Suite

**Tasks to make this test pass:**

- [ ] Write 8-10 should_trigger:true queries
- [ ] Write 8-10 should_trigger:false queries
- [ ] Write 4-6 output evals with rubric and assertions
- [ ] All evals have required fields

**Estimated Effort:** 1 hour

---

### Test: AC12 -- Social Context

**Tasks to make this test pass:**

- [ ] Add Social Context section covering ILP-gated quality signal, cost impact, visibility, diversity

**Estimated Effort:** 0.5 hours

---

## Running Tests

```bash
# Run all vitest tests for this story
npx vitest run packages/core/src/skills/relay-discovery.test.ts

# Run shell tests
./tests/skills/test-relay-discovery-skill.sh

# Run vitest with verbose output
npx vitest run packages/core/src/skills/relay-discovery.test.ts --reporter=verbose

# Run specific vitest describe block
npx vitest run packages/core/src/skills/relay-discovery.test.ts -t "AC2"
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 131 vitest tests written and failing (ENOENT)
- All 99 shell tests written and failing (files do not exist)
- 1 shell test skipped (BASE-A: manual pipeline step)
- Implementation checklist created
- No fixtures, factories, or mocks required (file validation tests)

**Verification:**

- All tests fail due to missing skill files, not test bugs
- Failure messages are clear: ENOENT for vitest, FAIL for shell

---

### GREEN Phase (DEV Team - Next Steps)

1. Run the NIP-to-TOON pipeline (story 9-2) to generate skill files
2. Create `.claude/skills/relay-discovery/` directory structure
3. Generate SKILL.md, references/, and evals/ following AC requirements
4. Run tests incrementally as files are created
5. Check off implementation tasks as tests pass

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Vitest:**
```
Test Files  1 failed (1)
     Tests  131 failed (131)
  Duration  278ms
```

**Shell:**
```
Total: 100 | Passed: 0 | Failed: 99 | Skipped: 1
Status: RED (TDD red phase -- 99 failing tests)
```

**Summary:**

- Vitest: 131 failing, 0 passing
- Shell: 99 failing, 0 passing, 1 skipped
- Total: 230 failing tests + 1 skipped
- Status: RED phase verified

---

## Notes

- This is a read-focused skill story: NIP-11 is HTTP-fetched, NIP-66 is monitor-published, only NIP-65 kind:10002 is agent-writable
- Tests validate static file content (markdown + JSON), not runtime behavior
- Shell tests use python3 for JSON parsing of evals.json
- Vitest tests use the `yaml` package for frontmatter parsing
- The skill directory `.claude/skills/relay-discovery/` does not exist yet

---

**Generated by BMad TEA Agent** - 2026-03-27
