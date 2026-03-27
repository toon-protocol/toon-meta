---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-27'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/9-14-media-and-files-skill.md'
  - '_bmad/tea/config.yaml'
  - '.claude/skills/social-interactions/SKILL.md'
  - '.claude/skills/social-interactions/evals/evals.json'
---

# ATDD Checklist - Epic 9, Story 9.14: Media and Files Skill

**Date:** 2026-03-27
**Author:** Jonathan
**Primary Test Level:** Component (structural validation of skill files)

---

## Story Summary

Story 9.14 produces a Claude Agent Skill teaching media attachment and file metadata handling on TOON. It covers NIP-92 (imeta tags for media attachments), NIP-94 (kind:1063 file metadata events), and NIP-73 (external content IDs including arweave:tx:). The skill is produced by the nip-to-toon-skill pipeline.

**As a** TOON agent
**I want** a skill teaching media attachment and file metadata handling
**So that** I can work with rich media content including Arweave references on TOON

---

## Acceptance Criteria

1. **AC1: Pipeline Production** -- Produces complete `media-and-files` skill directory with SKILL.md, references/, evals/
2. **AC2: NIP Coverage** -- Covers NIP-92 (imeta tags), NIP-94 (kind:1063), NIP-73 (external content IDs)
3. **AC3: TOON Write Model** -- Documents publishEvent(), per-byte cost, imeta overhead, arweave:tx: minimal overhead
4. **AC4: TOON Read Model** -- Documents TOON-format, querying kind:1063, parsing imeta, i tag filters
5. **AC5: Social Context** -- Media-specific social guidance (quality over quantity, alt text, no binary data, Arweave permanence)
6. **AC6: Eval Suite** -- 8-10 trigger evals, 8-10 not-trigger evals, 4-6 output evals
7. **AC7: TOON Compliance** -- All 6 TOON compliance assertions pass
8. **AC8: Description Optimization** -- 80-120 words with required trigger phrases
9. **AC9: Token Budget** -- Body under 500 lines / ~5k tokens
10. **AC10: Dependency References** -- References 5 upstream skills, no duplication
11. **AC11: With/Without Baseline** -- Measurable value-add (manual, skipped)
12. **AC12: Arweave Integration** -- arweave:tx: format, DVM relationship, permanent references

---

## Failing Tests Created (RED Phase)

### Vitest Tests (144 tests)

**File:** `packages/core/src/skills/media-and-files.test.ts` (1283 lines)

- **[STRUCT-A] AC1: Directory Layout** (6 tests) -- RED: ENOENT, skill directory does not exist
- **[STRUCT-B] AC1: Frontmatter Validity** (2 tests) -- RED: ENOENT, SKILL.md does not exist
- **[EVAL-A, EVAL-B] AC2: NIP-92 Coverage** (7 tests) -- RED: ENOENT
- **[EVAL-A, EVAL-B] AC2: NIP-94 Coverage** (7 tests) -- RED: ENOENT
- **[EVAL-A, EVAL-B] AC2: NIP-73 Coverage** (7 tests) -- RED: ENOENT
- **[EVAL-A, EVAL-B] AC2: Multi-NIP nip-spec.md** (2 tests) -- RED: ENOENT
- **[TOON-A, TOON-B] AC3: TOON Write Model** (14 tests) -- RED: ENOENT
- **[TOON-C] AC4: TOON Read Model** (9 tests) -- RED: ENOENT
- **[STRUCT-D, TOON-D] AC5: Social Context** (8 tests) -- RED: ENOENT
- **[EVAL-A] AC6: Trigger Evals** (10 tests) -- RED: ENOENT
- **[EVAL-B] AC6: Output Evals** (10 tests) -- RED: ENOENT
- **[TOON-A through TOON-D] AC7: TOON Compliance** (7 tests) -- RED: ENOENT
- **[STRUCT-B] AC8: Description Optimization** (14 tests) -- RED: ENOENT
- **[STRUCT-C] AC9: Token Budget** (3 tests) -- RED: ENOENT
- **[DEP-A] AC10: Dependency References** (7 tests) -- RED: ENOENT
- **[BASE-A] AC11: With/Without Baseline** (2 tests) -- RED: ENOENT
- **[ARWEAVE-A] AC12: Arweave Integration** (8 tests) -- RED: ENOENT
- **Writing Style Compliance** (3 tests) -- RED: ENOENT
- **imeta Tag Cross-File Consistency** (3 tests) -- RED: ENOENT
- **kind:1063 Cross-File Consistency** (4 tests) -- RED: ENOENT
- **Arweave Cross-File Consistency** (4 tests) -- RED: ENOENT
- **eval-completeness** (1 test) -- RED: ENOENT

### Shell Tests (72 tests)

**File:** `tests/skills/test-media-and-files-skill.sh` (656 lines)

- 71 tests FAILING (ENOENT -- skill files do not exist)
- 1 test SKIPPED (BASE-A -- requires manual pipeline Step 8)

---

## Data Factories Created

N/A -- This story produces markdown + JSON skill files, not TypeScript code. No data factories needed.

---

## Fixtures Created

N/A -- Tests use direct filesystem reads (readFileSync, existsSync) against skill output files. No Playwright or database fixtures needed.

---

## Mock Requirements

N/A -- Tests validate static file content. No external services to mock.

---

## Required data-testid Attributes

N/A -- No UI components in this story.

---

## Implementation Checklist

### Test Group: STRUCT-A, STRUCT-B, CLEAN-A (Directory Layout)

**File:** `packages/core/src/skills/media-and-files.test.ts`

**Tasks to make these tests pass:**

- [ ] Create `.claude/skills/media-and-files/` directory
- [ ] Create `SKILL.md` with YAML frontmatter (`name: media-and-files`, `description`)
- [ ] Create `references/` directory with `nip-spec.md`, `toon-extensions.md`, `scenarios.md`
- [ ] Create `evals/` directory with `evals.json`
- [ ] Ensure no extraneous files in skill directory
- [ ] Run test: `npx vitest run packages/core/src/skills/media-and-files.test.ts`

### Test Group: AC2 (NIP Coverage)

**Tasks to make these tests pass:**

- [ ] Write NIP-92 coverage in SKILL.md (imeta tag structure, fields, multiple per event, augments existing events)
- [ ] Write NIP-94 coverage in SKILL.md (kind:1063, required tags url/m/x, optional tags, content as description)
- [ ] Write NIP-73 coverage in SKILL.md (i tag format, arweave:tx:, isbn:, doi:, url:)
- [ ] Write nip-spec.md with distinct sections for NIP-92, NIP-94, NIP-73
- [ ] Run test: `npx vitest run packages/core/src/skills/media-and-files.test.ts`

### Test Group: AC3 (TOON Write Model)

**Tasks to make these tests pass:**

- [ ] Reference publishEvent() and @toon-protocol/client in SKILL.md
- [ ] Explain imeta tags increase event byte size and cost
- [ ] Explain arweave:tx: adds minimal byte overhead
- [ ] Reference nostr-protocol-core for fee formula
- [ ] Provide concrete fee estimates ($0.xxx)
- [ ] Cover publishEvent flow in toon-extensions.md
- [ ] Cover byte cost tables in toon-extensions.md
- [ ] Cover media scenarios with publishEvent in scenarios.md

### Test Group: AC4 (TOON Read Model)

**Tasks to make these tests pass:**

- [ ] Document TOON-format strings (not JSON) in SKILL.md
- [ ] Explain querying kind:1063, parsing imeta tags, i tag filters
- [ ] Reference nostr-protocol-core for format parsing

### Test Group: AC5 (Social Context)

**Tasks to make these tests pass:**

- [ ] Add `## Social Context` section to SKILL.md (100+ words)
- [ ] Cover: quality over quantity, metadata vs file storage, Arweave permanence, alt text, no binary data, cross-platform discovery

### Test Group: AC6 (Eval Suite)

**Tasks to make these tests pass:**

- [ ] Create evals.json with 8-10 should-trigger queries
- [ ] Add 8-10 should-not-trigger queries (exclude NIP-96, NIP-68/71)
- [ ] Add 4-6 output evals with id, prompt, expected_output, rubric, assertions
- [ ] Include TOON compliance assertions in output evals

### Test Group: AC8 (Description Optimization)

**Tasks to make these tests pass:**

- [ ] Write description (80-120 words)
- [ ] Include trigger phrases: NIP-92, NIP-94, NIP-73, imeta, kind:1063, arweave:tx:, alt text, MIME, SHA-256
- [ ] Include social-situation phrases: "how do I attach media?", "how do I describe a file?"

### Test Group: AC12 (Arweave Integration)

**Tasks to make these tests pass:**

- [ ] Document arweave:tx:<txid> format in i tags
- [ ] Document kind:1063 referencing Arweave-hosted files via URL
- [ ] Document relationship between Arweave DVM (kind:5094) and NIP-73/NIP-94
- [ ] Document arweave:tx: permanent/immutable content references

---

## Running Tests

```bash
# Run all vitest tests for this story
npx vitest run packages/core/src/skills/media-and-files.test.ts

# Run vitest in verbose mode
npx vitest run packages/core/src/skills/media-and-files.test.ts --reporter=verbose

# Run shell acceptance tests
./tests/skills/test-media-and-files-skill.sh

# Run vitest with coverage
npx vitest run packages/core/src/skills/media-and-files.test.ts --coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 144 vitest tests written and failing (ENOENT)
- All 71 shell tests written and failing (ENOENT)
- 1 shell test skipped (BASE-A -- manual pipeline step)
- Implementation checklist created
- No fixtures/factories/mocks needed (static file validation)

**Verification:**

- All tests fail due to missing skill files, not test bugs
- Failure messages are clear: ENOENT for missing files

---

### GREEN Phase (DEV Team - Next Steps)

1. Run the nip-to-toon-skill pipeline with NIP-92, NIP-94, NIP-73
2. Create `.claude/skills/media-and-files/` directory structure
3. Author SKILL.md, reference files, and evals.json
4. Run tests incrementally as each file is created

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Vitest:**

```
Test Files  1 failed (1)
     Tests  144 failed (144)
  Duration  287ms
```

**Shell Tests:**

```
Total:   72
Passed:  0
Failed:  71
Skipped: 1
RED PHASE: 71 tests failing as expected (TDD red phase)
```

**Summary:**

- Total tests: 216 (144 vitest + 72 shell)
- Passing: 0 (expected)
- Failing: 215 (expected)
- Skipped: 1 (BASE-A manual)
- Status: RED phase verified

---

## Notes

- This skill covers THREE NIPs (NIP-92, NIP-94, NIP-73) in a single skill. The nip-spec.md reference file must have distinct sections for each NIP.
- The `arweave:tx:` external content ID is critical for TOON/Arweave integration per test-design-epic-9.md Phase 5 notes.
- Story 9.15 (Visual Media) and 9.16 (File Storage) are peer skills that do NOT depend on 9.14.
- Shell tests use python3 for JSON parsing in eval validation tests.

---

**Generated by BMad TEA Agent** - 2026-03-27
