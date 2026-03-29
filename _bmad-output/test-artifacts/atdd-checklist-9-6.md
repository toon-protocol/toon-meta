---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-26'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/9-6-social-interactions-skill.md'
  - '.claude/skills/long-form-content/SKILL.md'
  - '.claude/skills/long-form-content/evals/evals.json'
  - 'tests/skills/test-long-form-content-skill.sh'
  - '.claude/skills/social-identity/SKILL.md'
  - '.claude/skills/social-identity/evals/evals.json'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
---

# ATDD Checklist - Epic 9, Story 9.6: Social Interactions Skill

**Date:** 2026-03-26
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
- Existing skill test patterns: `tests/skills/test-social-identity-skill.sh` (Story 9.4, 50 tests), `tests/skills/test-long-form-content-skill.sh` (Story 9.5, 63 tests) -- bash-based structural validation
- Skill directory `.claude/skills/social-interactions/` does NOT exist yet (RED phase confirmed)

### Story Context
- **Story 9.6:** Social Interactions Skill (`social-interactions`)
- **As a** TOON agent, **I want** a skill teaching social engagement patterns, **So that** I can react, comment, and repost appropriately.
- **NIPs covered:** NIP-25 (kind:7 reactions), NIP-18 (kind:6/kind:16 reposts), NIP-22 (kind:1111 comments)
- **Classification:** Write + Read ("both")
- **Dependencies:** Stories 9.0-9.5 (all done)
- **Pattern reference:** Stories 9.4 (`social-identity`) and 9.5 (`long-form-content`)
- **Identified as:** "highest-value social skill" per test-design-epic-9.md Phase 2 notes

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
**Rationale:** Story 9.6 produces a Claude Agent Skill (markdown + reference files + eval JSON), not a UI feature. Acceptance criteria are clear (11 ACs with explicit test IDs). Tests are structural bash script validations following the established pattern from Stories 9.4 and 9.5. No browser recording needed.

---

## Test Strategy

### AC-to-Test Mapping

| AC | Test ID(s) | Test Level | Priority | Description |
|----|-----------|------------|----------|-------------|
| AC1: Pipeline Production | STRUCT-A, STRUCT-B, STRUCT-B2, AC1-NAME | Structural (bash) | P0 | SKILL.md exists with valid frontmatter (only name+description), references/ dir with 3 files, evals/evals.json valid JSON, skill name matches |
| AC2: NIP Coverage | EVAL-A, EVAL-B, AC2-KIND7, AC2-KIND6, AC2-KIND16, AC2-KIND1111, AC2-REACT-TAGS, AC2-REPOST-TAGS, AC2-COMMENT-TAGS, AC2-REACT-CONTENT, AC2-COMMENT-THREADING, AC2-TOONEXT, AC2-SCENARIOS, AC2-EMOJI-REACTIONS, AC2-COMMENT-EXTERNAL | Structural (bash grep) | P0 | SKILL.md + references cover kind:7 reactions, kind:6/16 reposts, kind:1111 comments, tag formats, content fields, threading, emoji reactions, external content comments |
| AC3: TOON Write Model | TOON-A, TOON-B, AC3-CLIENT, AC3-FEEREF, AC3-REGULAR-EVENTS, AC3-WRITEMODEL, AC3-COST-COMPARE | Structural (bash grep) | P0 | Uses publishEvent(), fee awareness for interactions, references nostr-protocol-core, documents regular (non-replaceable) events, compares interaction cost ranges |
| AC4: TOON Read Model | TOON-C, AC4-DECODER, AC4-FILTER, AC4-REFREADS, AC4-READREF, AC4-READING-FREE | Structural (bash grep) | P0 | Documents TOON-format strings, references nostr-protocol-core, mentions kind filters and #e tag, reading is free |
| AC5: Social Context | STRUCT-D, TOON-D, AC5-REACT-ECON, AC5-DOWNVOTE, AC5-REACTSPAM, AC5-REPOST-ENDORSE, AC5-CONTEXT-COMMENT, AC5-DECISION-TREE, AC5-SUBST, AC5-NIP-SPECIFIC | Structural (bash grep) | P1 | Social Context section with interaction-specific guidance covering all 6 themes (reactions as economic signals, downvote gravity, react-spam, reposts as endorsement, context-aware commenting, interaction decision tree), passes substitution test |
| AC6: Eval Suite | EVAL-A2, EVAL-B2, EVAL-C, AC6-RUBRIC, AC6-TOON-ASSERT, AC6-TRIGGER-QUERIES, AC6-NOTTRIGGER-QUERIES | Structural (bash + node) | P0 | evals.json has 8-10 should-trigger, 8-10 should-not-trigger, 4-6 output evals with id/prompt/rubric/assertions, TOON compliance assertions |
| AC7: TOON Compliance | TOON-ALL-1, TOON-ALL-2 | Integration (script) | P0 | validate-skill.sh and run-eval.sh pass all checks |
| AC8: Description Optimization | TRIG-A, TRIG-B, AC8-TRIGPHRASES, AC8-STRICT-RANGE, AC8-SOCIAL-PHRASES | Structural (bash) | P1 | Description 80-120 words, includes trigger phrases for reactions/reposts/comments/kind:7/kind:6/kind:16/kind:1111/NIP-22/NIP-18/NIP-25, includes social-situation triggers |
| AC9: Token Budget | STRUCT-C, AC9-TOKENS, AC9-TOKEN-WORDS | Structural (bash) | P1 | SKILL.md body under 500 lines, approximately 5k tokens or fewer |
| AC10: Dependency References | DEP-A, DEP-B, AC10-NODUP, AC10-DEP-BOTH, PIPE-REGR | Structural (bash grep) | P1 | References nostr-protocol-core and nostr-social-intelligence, does NOT duplicate toon-protocol-context.md, D9-010 pointer pattern |
| AC11: With/Without Baseline | BASE-A | Manual/Pipeline | P2 | Agent with skill produces better responses than without (pipeline Step 8 output) |
| Cleanliness | CLEAN-A | Structural (bash) | P0 | No extraneous .md files in skill root |

### Test Counts by Priority

| Priority | Test Count | Description |
|----------|-----------|-------------|
| P0 | 38 | Structural integrity, NIP coverage, TOON compliance, eval quality, cleanliness |
| P1 | 26 | Social context themes, description triggers, token budget, dependencies |
| P2 | 1 | With/without baseline (manual, skipped) |
| **Total** | **64** | **63 automated + 1 skipped** |

### Risk Assessment

| Risk | Mitigation |
|------|-----------|
| E9-R001: Pipeline single point of failure | Mitigated -- Stories 9.4 and 9.5 validated the pipeline successfully |
| E9-R008: Write model correctness varies by NIP | This is a "both" skill (read + write): all three interaction types are write events. Tests AC3-* validate write model coverage |
| "Highest-value social skill" status | Extra tests for Social Context (AC5-*) ensure interaction decision tree alignment with 9.0 base skill |
| Multiple event kinds (4 kinds across 3 NIPs) | Individual test per kind (AC2-KIND7, AC2-KIND6, AC2-KIND16, AC2-KIND1111) plus tag coverage tests |

---

## Test Execution

### Run Command

```bash
./tests/skills/test-social-interactions-skill.sh
```

### Expected RED Phase Output

All 63 automated tests fail, 1 skipped (BASE-A). Exit code 1.

### Expected GREEN Phase Output

All 63 automated tests pass, 1 skipped (BASE-A). Exit code 0.

---

## Validation

### Coverage Matrix

Every AC (1-11) maps to at least one test ID. Total: 64 tests (63 unique test IDs + 1 skipped) covering 11 ACs + 1 cleanliness check.

### Test Quality Principles Applied

- **Deterministic:** All tests use grep/awk/node on static files -- no network, no timing, no randomness
- **Isolated:** Each test checks one specific assertion independently
- **Explicit:** Test IDs map directly to AC numbers and descriptions in the story
- **No false positives:** Tests check for specific content terms, not vague patterns
- **Substitution test:** AC5-SUBST and AC5-NIP-SPECIFIC verify Social Context is interaction-specific (would fail if NIP name were substituted)

### Cross-Reference to Previous Stories

- Test script structure follows `test-long-form-content-skill.sh` (Story 9.5) pattern exactly
- Test IDs reuse the same naming convention (STRUCT-*, TOON-*, EVAL-*, AC*-*, DEP-*, CLEAN-*, BASE-*)
- Gap-fill approach matches: core tests + gap-fill round 1 + gap-fill round 2
- Node-based eval JSON parsing identical to 9.5 approach
