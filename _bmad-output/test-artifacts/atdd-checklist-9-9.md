---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
lastStep: 'step-04-generate-tests'
lastSaved: '2026-03-26'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/9-9-moderated-communities-skill.md'
  - '.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh'
  - '.claude/skills/skill-eval-framework/scripts/run-eval.sh'
  - 'tests/skills/test-relay-groups-skill.sh'
---

# ATDD Checklist - Epic 9, Story 9.9: Moderated Communities Skill

**Date:** 2026-03-26
**Author:** Jonathan
**Primary Test Level:** Shell script structural + content validation (no TypeScript, no Playwright)

---

## Story Summary

Story 9.9 produces a Claude Agent Skill for moderated community governance on TOON Protocol. The skill covers NIP-72 moderated communities -- community definitions (kind:34550), approval events (kind:4550), community posts (kind:1111), and cross-posting -- teaching agents the approval-based moderation model and its TOON economic dynamics.

**As a** TOON agent
**I want** a skill teaching moderated community governance
**So that** I can participate in and understand community structures on TOON

---

## Acceptance Criteria

1. **AC1: Pipeline Production** -- Produces complete `moderated-communities` skill directory with SKILL.md, references/, evals/
2. **AC2: NIP Coverage** -- Covers NIP-72 community definitions, approval events, community posts, cross-posting, backward compatibility
3. **AC3: TOON Write Model** -- publishEvent() for community posts/approvals/definitions, per-byte cost, double-friction model
4. **AC4: TOON Read Model** -- TOON-format strings, a tag filtering, replaceable events for community definitions
5. **AC5: Social Context** -- Community-specific social guidance: curation respect, double friction economics, cross-posting etiquette, NIP-29 distinction
6. **AC6: Eval Suite** -- 8-10 should-trigger, 8-10 should-not-trigger, 4-6 output evals with rubric and assertions
7. **AC7: TOON Compliance Passing** -- All 6 named TOON compliance assertions pass
8. **AC8: Description Optimization** -- 80-120 words, trigger phrases for NIP-72/community/approval/moderator terms
9. **AC9: Token Budget** -- Body under 500 lines and ~5k tokens
10. **AC10: Dependency References** -- References nostr-protocol-core, nostr-social-intelligence, social-interactions, content-references, relay-groups
11. **AC11: With/Without Baseline** -- Agent with skill produces better community responses than without

---

## AC-to-Test Mapping

| Test ID | AC | Priority | What It Validates |
|---------|-----|----------|-------------------|
| STRUCT-A | AC1 | P0 | SKILL.md exists with valid YAML frontmatter (name + description only) |
| STRUCT-B | AC1 | P0 | references/ directory with nip-spec.md, toon-extensions.md, scenarios.md |
| STRUCT-B2 | AC1 | P0 | evals/evals.json exists and is valid JSON |
| STRUCT-C | AC9 | P0 | Body under 500 lines |
| STRUCT-D | AC5 | P0 | Social Context section exists with >= 30 words |
| AC1-NAME | AC1 | P0 | Skill name in frontmatter is "moderated-communities" |
| EVAL-A | AC2 | P0 | SKILL.md covers NIP-72, community, approval, a tag |
| EVAL-B | AC2 | P0 | nip-spec.md covers NIP-72 and event kinds |
| AC2-NIP72 | AC2 | P0 | SKILL.md mentions NIP-72 |
| AC2-APPROVAL | AC2 | P0 | Approval-based moderation model covered |
| AC2-KINDS-COMMUNITY | AC2 | P0 | kind:34550 community definition covered |
| AC2-KINDS-APPROVAL | AC2 | P0 | kind:4550 approval event covered |
| AC2-KINDS-POST | AC2 | P0 | kind:1111 community post covered |
| AC2-ATAG | AC2 | P0 | a tag for community reference covered |
| AC2-UPPERCASE | AC2 | P0 | Uppercase A/P/K tags for community scope covered |
| AC2-TOONEXT | AC2 | P0 | toon-extensions.md covers ILP/per-byte costs |
| AC2-SCENARIOS | AC2 | P0 | scenarios.md covers step-by-step workflows |
| AC2-CROSSPOST | AC2 | P0 | Cross-posting (kind:6/kind:16) to communities covered |
| AC2-BACKWARD | AC2 | P0 | Backward compatibility (kind:1 queries) covered |
| TOON-A | AC3, AC7 | P0 | publishEvent referenced across skill files |
| TOON-B | AC3, AC7 | P0 | Fee/cost terms referenced across skill files |
| AC3-CLIENT | AC3 | P0 | References publishEvent() from @toon-protocol/client |
| AC3-FEEREF | AC3 | P0 | References fee/cost in SKILL.md |
| AC3-ATAG-REQ | AC3 | P0 | Explains a tag requirement for community-scoped events |
| AC3-APPROVAL-COST | AC3 | P0 | Explains approval events cost per-byte |
| AC3-DOUBLE-FRICTION | AC3 | P0 | Explains double-friction model (cost + approval) |
| AC3-COREREF | AC3 | P0 | References nostr-protocol-core for fee formula |
| TOON-C | AC4, AC7 | P0 | TOON-format referenced across skill files |
| AC4-FORMAT | AC4 | P0 | SKILL.md references TOON-format |
| AC4-ATAG-FILTER | AC4 | P0 | Explains a tag filtering for community subscriptions |
| AC4-REPLACEABLE | AC4 | P0 | Explains replaceable event model for community definitions |
| AC4-READREF | AC4 | P0 | References nostr-protocol-core for TOON format |
| TOON-D | AC5 | P1 | Social Context >= 100 words of community-specific content |
| AC5-CURATION | AC5 | P1 | Covers moderated curation / respect moderators |
| AC5-ECON | AC5 | P1 | Covers economic dynamics of double friction |
| AC5-MODERATOR-INVEST | AC5 | P1 | Covers moderator investment (pay to approve) |
| AC5-CROSSPOST-THOUGHT | AC5 | P1 | Covers cross-posting thoughtfulness |
| AC5-COMMUNITY-NORMS | AC5 | P1 | Covers community norms (read before participating) |
| AC5-DISTINGUISH-NIP29 | AC5 | P1 | Distinguishes NIP-72 from NIP-29 |
| AC5-SUBST | AC5 | P1 | Passes NIP-name substitution test (>= 5 community-specific terms) |
| EVAL-A2 | AC6 | P0 | >= 8 should-trigger queries |
| EVAL-B2 | AC6 | P0 | >= 8 should-not-trigger queries |
| EVAL-C | AC6 | P0 | >= 4 output evals |
| AC6-RUBRIC | AC6 | P0 | All output evals have rubric (correct/acceptable/incorrect) |
| AC6-TOON-ASSERT | AC6 | P0 | TOON compliance assertions in output evals |
| AC6-TRIGGER-QUERIES | AC6 | P0 | Should-trigger queries cover >= 5/9 community-relevant terms |
| AC6-NOTTRIGGER-QUERIES | AC6 | P0 | Should-not-trigger queries exclude >= 4/8 unrelated topics |
| AC6-EXPECTED-OPT | AC6 | P0 | All output evals have expected_output field |
| AC6-OUTPUT-ID | AC6 | P0 | All output evals have id and prompt fields |
| AC6-OUTPUT-ASSERT | AC6 | P0 | All output evals have assertions array |
| TOON-ALL-1 | AC7 | P0 | validate-skill.sh passes (structural) |
| TOON-ALL-2 | AC7 | P0 | run-eval.sh passes (TOON compliance) |
| AC8-STRICT-RANGE | AC8 | P1 | Description is 80-120 words |
| AC8-TRIGPHRASES | AC8 | P1 | Description includes >= 8/16 trigger phrases |
| AC8-SOCIAL-PHRASES | AC8 | P1 | Description includes social-situation triggers |
| AC8-COMMUNITY-PHRASES | AC8 | P1 | Description includes >= 2/5 community-specific phrases |
| TRIG-A | AC8 | P1 | Protocol-technical triggers in description |
| TRIG-B | AC8 | P1 | Social/user-facing triggers in description |
| AC9-TOKENS | AC9 | P1 | Body approximately 5k tokens or fewer (~3500 words max) |
| DEP-A | AC10 | P1 | References nostr-protocol-core |
| DEP-B | AC10 | P1 | References nostr-social-intelligence |
| DEP-C | AC10 | P1 | References social-interactions |
| DEP-D | AC10 | P1 | References content-references |
| DEP-E | AC10 | P1 | References relay-groups |
| AC10-NODUP | AC10 | P1 | No duplicate toon-protocol-context.md in references/ |
| AC10-DEP-ALL | AC10 | P1 | References all five upstream skills |
| CLEAN-A | AC1 | P0 | No extraneous .md files in skill root |
| AC7-NAMED-ASSERTIONS | AC7 | P0 | run-eval.sh covers all 6 named TOON assertions |
| BASE-A | AC11 | P2 | With/without baseline (manual, skipped) |

---

## Failing Tests Created (RED Phase)

### Shell Script Tests (70 tests)

**File:** `tests/skills/test-moderated-communities-skill.sh` (~630 lines)

All 70 tests organized into 11 sections:

- **Structural Tests (P0):** STRUCT-A, STRUCT-B, STRUCT-B2, STRUCT-C, STRUCT-D, AC1-NAME
  - Status: RED -- skill directory does not exist yet
  - Verifies: directory structure, frontmatter, references, evals, body size, social context section

- **Content Tests -- NIP Coverage (P0):** EVAL-A, EVAL-B, AC2-NIP72, AC2-APPROVAL, AC2-KINDS-COMMUNITY, AC2-KINDS-APPROVAL, AC2-KINDS-POST, AC2-ATAG, AC2-UPPERCASE, AC2-TOONEXT, AC2-SCENARIOS, AC2-CROSSPOST, AC2-BACKWARD
  - Status: RED -- no skill files to search
  - Verifies: NIP-72 coverage, event kinds (34550/4550/1111), approval model, a tag, uppercase tags, cross-posting, backward compat

- **TOON Write Model Tests (P0):** TOON-A, TOON-B, AC3-CLIENT, AC3-FEEREF, AC3-ATAG-REQ, AC3-APPROVAL-COST, AC3-DOUBLE-FRICTION, AC3-COREREF
  - Status: RED -- no publishEvent, fee, or double-friction references
  - Verifies: TOON write model completeness, publishEvent() from @toon-protocol/client, fee awareness, double-friction model

- **TOON Read Model Tests (P0):** TOON-C, AC4-FORMAT, AC4-ATAG-FILTER, AC4-REPLACEABLE, AC4-READREF
  - Status: RED -- no TOON-format or a tag filter references
  - Verifies: TOON-format parsing, a tag filtering, replaceable event model, nostr-protocol-core reference

- **Social Context Tests (P1):** TOON-D, AC5-CURATION, AC5-ECON, AC5-MODERATOR-INVEST, AC5-CROSSPOST-THOUGHT, AC5-COMMUNITY-NORMS, AC5-DISTINGUISH-NIP29, AC5-SUBST
  - Status: RED -- no Social Context section
  - Verifies: community-specific social guidance covering curation, economics, moderator investment, cross-posting, norms, NIP-29 distinction

- **Eval Suite Tests (P0):** EVAL-A2, EVAL-B2, EVAL-C, AC6-RUBRIC, AC6-TOON-ASSERT, AC6-TRIGGER-QUERIES, AC6-NOTTRIGGER-QUERIES, AC6-EXPECTED-OPT, AC6-OUTPUT-ID, AC6-OUTPUT-ASSERT
  - Status: RED -- evals/evals.json does not exist
  - Verifies: trigger eval counts, output eval structure, rubric, TOON assertions, trigger term coverage

- **TOON Compliance Integration Tests (P0):** TOON-ALL-1, TOON-ALL-2
  - Status: RED -- validate-skill.sh and run-eval.sh fail
  - Verifies: end-to-end structural validation + TOON compliance assertion pass

- **Description Optimization Tests (P1):** AC8-STRICT-RANGE, AC8-TRIGPHRASES, AC8-SOCIAL-PHRASES, AC8-COMMUNITY-PHRASES, TRIG-A, TRIG-B
  - Status: RED -- no description to extract
  - Verifies: word count range (80-120), trigger phrase coverage, social-situation triggers, community-specific phrases

- **Token Budget Tests (P1):** AC9-TOKENS
  - Status: RED -- no body to measure
  - Verifies: body under ~5k tokens (~3500 words)

- **Dependency Reference Tests (P1):** DEP-A, DEP-B, DEP-C, DEP-D, DEP-E, AC10-NODUP, AC10-DEP-ALL
  - Status: RED (except AC10-NODUP vacuously passes) -- no SKILL.md
  - Verifies: five upstream skill references, no duplicate toon-protocol-context.md

- **Cleanliness Test (P0):** CLEAN-A
  - Status: RED -- skill directory not found
  - Verifies: no extraneous .md files in skill root

- **TOON Compliance Named Assertions (P0):** AC7-NAMED-ASSERTIONS
  - Status: RED -- run-eval.sh finds 0/6 assertions
  - Verifies: all 6 named TOON compliance assertions checked

- **With/Without Baseline (P2):** BASE-A
  - Status: SKIPPED -- requires manual pipeline Step 8
  - Verifies: skill adds measurable value over baseline agent

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

**File:** `tests/skills/test-moderated-communities-skill.sh`

**Tasks to make these tests pass:**

- [ ] Create `.claude/skills/moderated-communities/` directory
- [ ] Create `SKILL.md` with YAML frontmatter (`name: moderated-communities`, `description: ...`)
- [ ] Create `references/nip-spec.md`, `references/toon-extensions.md`, `references/scenarios.md`
- [ ] Create `evals/evals.json` as valid JSON
- [ ] Ensure SKILL.md body is under 500 lines
- [ ] Ensure `## Social Context` section exists with >= 30 words
- [ ] Run test: `bash tests/skills/test-moderated-communities-skill.sh`

---

### Test: EVAL-A through AC2-BACKWARD (NIP Coverage)

**File:** `tests/skills/test-moderated-communities-skill.sh`

**Tasks to make these tests pass:**

- [ ] Write SKILL.md body covering NIP-72, approval model, community definitions (kind:34550), approval events (kind:4550), community posts (kind:1111)
- [ ] Include a tag references and uppercase A/P/K tag coverage
- [ ] Write nip-spec.md covering NIP-72 spec details, event kinds, tag formats
- [ ] Write toon-extensions.md covering ILP/per-byte costs
- [ ] Write scenarios.md with step-by-step community participation workflows
- [ ] Cover cross-posting (kind:6/kind:16) and backward compatibility (kind:1)
- [ ] Run test: `bash tests/skills/test-moderated-communities-skill.sh`

---

### Test: TOON-A through AC3-COREREF (Write Model)

**File:** `tests/skills/test-moderated-communities-skill.sh`

**Tasks to make these tests pass:**

- [ ] Reference `publishEvent()` from `@toon-protocol/client` in SKILL.md
- [ ] Include fee/cost terms (per-byte, basePricePerByte)
- [ ] Explain a tag requirement for community-scoped events
- [ ] Explain approval events (kind:4550) cost per-byte
- [ ] Explain double-friction model (cost + moderator approval)
- [ ] Reference `nostr-protocol-core` for fee formula details
- [ ] Run test: `bash tests/skills/test-moderated-communities-skill.sh`

---

### Test: TOON-C through AC4-READREF (Read Model)

**File:** `tests/skills/test-moderated-communities-skill.sh`

**Tasks to make these tests pass:**

- [ ] Reference TOON-format strings in SKILL.md
- [ ] Explain a tag filtering for community subscriptions
- [ ] Explain replaceable event model for community definitions (kind:34550)
- [ ] Reference `nostr-protocol-core`/`toon-protocol-context` for TOON format details
- [ ] Run test: `bash tests/skills/test-moderated-communities-skill.sh`

---

### Test: TOON-D through AC5-SUBST (Social Context)

**File:** `tests/skills/test-moderated-communities-skill.sh`

**Tasks to make these tests pass:**

- [ ] Write `## Social Context` section with >= 100 words
- [ ] Cover moderated curation, respect for moderator decisions
- [ ] Cover economic dynamics of double friction (per-byte + approval)
- [ ] Cover moderator investment (pay to approve content)
- [ ] Cover cross-posting thoughtfulness (each costs per-byte independently)
- [ ] Cover community norms (read description/rules before participating)
- [ ] Distinguish NIP-72 approval-based from NIP-29 relay-enforced
- [ ] Include >= 5 community-specific terms (passes substitution test)
- [ ] Run test: `bash tests/skills/test-moderated-communities-skill.sh`

---

### Test: EVAL-A2 through AC6-OUTPUT-ASSERT (Eval Suite)

**File:** `tests/skills/test-moderated-communities-skill.sh`

**Tasks to make these tests pass:**

- [ ] Create `evals/evals.json` with >= 8 should-trigger queries covering community terms
- [ ] Include >= 8 should-not-trigger queries excluding unrelated topics
- [ ] Include >= 4 output evals with id, prompt, expected_output, rubric, assertions
- [ ] Rubric must have correct/acceptable/incorrect for each output eval
- [ ] Include TOON compliance assertions in output eval assertions
- [ ] Run test: `bash tests/skills/test-moderated-communities-skill.sh`

---

### Test: TOON-ALL-1, TOON-ALL-2, AC7-NAMED-ASSERTIONS (Compliance)

**File:** `tests/skills/test-moderated-communities-skill.sh`

**Tasks to make these tests pass:**

- [ ] Ensure validate-skill.sh passes all 11 structural checks
- [ ] Ensure run-eval.sh passes all 6 TOON compliance assertions
- [ ] Run test: `bash tests/skills/test-moderated-communities-skill.sh`

---

### Test: AC8-* and TRIG-* (Description Optimization)

**File:** `tests/skills/test-moderated-communities-skill.sh`

**Tasks to make these tests pass:**

- [ ] Write description with 80-120 words
- [ ] Include >= 8/16 trigger phrases (NIP-72, moderated communities, kind:34550, approval, kind:4550, moderator, kind:1111, cross-posting, etc.)
- [ ] Include social-situation triggers ("how do I...", "how does...")
- [ ] Include >= 2/5 community-specific phrases (approval-based, moderation, curated, moderator, community participation)
- [ ] Run test: `bash tests/skills/test-moderated-communities-skill.sh`

---

### Test: DEP-A through AC10-DEP-ALL (Dependency References)

**File:** `tests/skills/test-moderated-communities-skill.sh`

**Tasks to make these tests pass:**

- [ ] Reference `nostr-protocol-core` in SKILL.md
- [ ] Reference `nostr-social-intelligence` in SKILL.md
- [ ] Reference `social-interactions` in SKILL.md
- [ ] Reference `content-references` in SKILL.md
- [ ] Reference `relay-groups` in SKILL.md
- [ ] Do NOT create `references/toon-protocol-context.md` (no duplication)
- [ ] Run test: `bash tests/skills/test-moderated-communities-skill.sh`

---

### Test: CLEAN-A (Cleanliness)

**File:** `tests/skills/test-moderated-communities-skill.sh`

**Tasks to make this test pass:**

- [ ] Ensure no extraneous .md files in `.claude/skills/moderated-communities/` root (only SKILL.md)
- [ ] Run test: `bash tests/skills/test-moderated-communities-skill.sh`

---

## Running Tests

```bash
# Run all failing tests for this story
bash tests/skills/test-moderated-communities-skill.sh

# Run with verbose output (default -- all output shown)
bash tests/skills/test-moderated-communities-skill.sh 2>&1 | tee /tmp/test-9-9-output.txt

# Run structural validation only (upstream script)
bash .claude/skills/nip-to-toon-skill/scripts/validate-skill.sh .claude/skills/moderated-communities

# Run TOON compliance validation only (upstream script)
bash .claude/skills/skill-eval-framework/scripts/run-eval.sh .claude/skills/moderated-communities
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 70 tests written (69 automated + 1 skipped)
- Test file created at `tests/skills/test-moderated-communities-skill.sh`
- All 67 automated tests verified failing (2 pass vacuously: AC10-NODUP)
- Implementation checklist created mapping tests to tasks

**Verification:**

- All tests run and fail as expected
- Failure messages are clear and actionable
- Tests fail due to missing skill implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. Run the `nip-to-toon-skill` pipeline with NIP-72 as input
2. Create the skill directory structure
3. Author SKILL.md with frontmatter, body, and Social Context section
4. Author reference files (nip-spec.md, toon-extensions.md, scenarios.md)
5. Create evals/evals.json
6. Run `bash tests/skills/test-moderated-communities-skill.sh` after each major change
7. Iterate until all tests pass

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

1. Verify all tests pass
2. Run description optimization pass (ensure trigger coverage)
3. Verify token budget compliance
4. Run validate-skill.sh and run-eval.sh independently
5. Verify no content duplication with upstream skills

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow
2. **Run failing tests** to confirm RED phase: `bash tests/skills/test-moderated-communities-skill.sh`
3. **Begin implementation** using the `nip-to-toon-skill` pipeline
4. **Work section by section** (structural first, then content, then evals)
5. **When all tests pass**, verify with upstream validation scripts
6. **When complete**, commit with: `feat(9-9): Moderated Communities Skill -- NIP-72, kind:34550/4550/1111, approval-based moderation, 70 tests`

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **test-relay-groups-skill.sh** -- Pattern reference for shell-based skill validation (Story 9.8, 67 tests)
- **validate-skill.sh** -- Upstream structural validation (11 checks)
- **run-eval.sh** -- Upstream TOON compliance validation (6 assertions)
- **9-9-moderated-communities-skill.md** -- Story spec with 11 acceptance criteria, 6 tasks, detailed dev notes

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `bash tests/skills/test-moderated-communities-skill.sh`

**Results:**

```
=== ATDD Test Results ===
Total: 69 | Passed: 1 | Failed: 67 | Skipped: 1
Status: RED (TDD red phase -- 67 failing tests)
```

**Summary:**

- Total tests: 70 (69 automated + 1 skipped)
- Passing: 1 (AC10-NODUP vacuously true -- directory doesn't exist)
- Failing: 67 (expected -- skill not yet implemented)
- Skipped: 1 (BASE-A -- manual pipeline step)
- Status: RED phase verified

---

## Notes

- This story produces a Claude Agent Skill (markdown + JSON), not TypeScript. All tests are shell-based file/content validation.
- Test count increased from 67 (Story 9.8) to 70 due to additional NIP-72-specific checks: AC2-UPPERCASE (A/P/K tags), AC3-DOUBLE-FRICTION (double-friction model), AC2-CROSSPOST, AC2-BACKWARD, AC5-MODERATOR-INVEST, AC5-CROSSPOST-THOUGHT, AC5-COMMUNITY-NORMS, AC5-DISTINGUISH-NIP29, DEP-E (relay-groups reference).
- AC10-NODUP passes vacuously in RED phase because the skill directory doesn't exist yet. It will remain passing after implementation if no toon-protocol-context.md is duplicated.
- BASE-A (with/without baseline) is skipped because it requires manual execution of pipeline Step 8 (parallel subagent comparison).
- The key conceptual distinction from Story 9.8 (relay-groups) is approval-based moderation (NIP-72) vs relay-enforced membership (NIP-29). Tests AC5-DISTINGUISH-NIP29 and DEP-E specifically validate this distinction is documented.

---

**Generated by BMad TEA Agent** - 2026-03-26
