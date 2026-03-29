---
stepsCompleted:
  [
    'step-01-detect-mode',
    'step-02-load-context',
    'step-03-risk-and-testability',
    'step-04-coverage-plan',
    'step-05-generate-output',
  ]
lastStep: 'step-05-generate-output'
lastSaved: '2026-03-24'
---

# Test Design: Epic 9 — NIP-to-TOON Skill Pipeline + Socialverse Skills

**Date:** 2026-03-24
**Author:** Jonathan
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic 9 — NIP-to-TOON Skill Pipeline + Socialverse Skills. 35 stories (9.0-9.34) across 12 phases producing ~30 Claude Agent Skills (markdown files with evals), not traditional code. Phase 0 (stories 9.0-9.3) builds the pipeline foundation. Phases 1-10 run NIPs through the pipeline. Phase 11 (story 9.34) is the publication gate.

**Nature of Testing:** This epic produces **skills** (structured markdown + eval JSON), not compiled code. Traditional unit/integration/E2E testing does not apply. Instead, testing focuses on: structural validation (skill format compliance), eval execution (skills perform as intended), TOON compliance (protocol-correct guidance), cross-skill consistency (shared references are coherent), and pipeline correctness (factory produces valid output).

**Risk Summary:**

- Total risks identified: 14
- High-priority risks (>=6): 4
- Critical categories: QUAL (4 risks), PIPE (3 risks), CONS (3 risks)

**Coverage Summary:**

- P0 scenarios (pipeline + framework): 18 (~15-25 hours)
- P1 scenarios (per-skill validation): 30 (~20-30 hours)
- P2 scenarios (cross-skill + publication): 12 (~8-12 hours)
- **Total effort**: ~43-67 hours (~2 weeks)

---

## What "Testing" Means for a Skill-Production Epic

Epic 9 is fundamentally different from Epics 1-8. The deliverables are markdown files, JSON eval definitions, and reference documents — not TypeScript code. The test strategy must adapt accordingly.

### Test Dimensions

| Dimension | What It Validates | Analogous To |
|-----------|-------------------|--------------|
| **Structural validation** | Skill files have required sections, valid frontmatter, correct directory layout | Lint / schema validation |
| **Eval execution** | Skill triggers correctly, output evals pass assertions | Unit tests |
| **TOON compliance** | Skills teach `publishEvent()` not bare `["EVENT", ...]`, include fee calculation, handle TOON format | Contract tests |
| **With/without baseline** | Skill adds measurable value over baseline Claude | Regression / delta testing |
| **Cross-skill consistency** | Shared references (`toon-protocol-context.md`) used consistently, no contradictions | Integration tests |
| **Pipeline correctness** | Pipeline skill produces valid skills for arbitrary NIPs | Factory / generative testing |
| **Publication gate** | All skills pass before packaging | Release gate |

### What Is NOT Tested

| Item | Reasoning |
|------|-----------|
| Runtime behavior of `@toon-protocol/client` | Already tested in Epics 3-7 |
| Nostr relay protocol correctness | Already tested in Epics 1-2 |
| LLM output determinism | Non-deterministic by design; evals use assertion-based grading, not exact match |
| Skill execution in production | Skills are consumed by Claude at inference time; no runtime to test |

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **E2E test debt (A1 from Epic 8 retro)** | Separate backlog item; not skill-related | Track independently; do not gate Epic 9 on it |
| **BootstrapService.republish() (A2 from Epic 8 retro)** | Infrastructure concern, not skill concern | Track independently |
| **LLM model version testing** | Skills are model-agnostic; benchmark.json captures baseline per model | Document model version in benchmark metadata |
| **Skill marketplace / distribution infrastructure** | Story 9.34 packages skills but distribution is out of scope | Manual install via `.claude/skills/` documented |
| **NIP spec correctness** | Skills teach NIPs as-written; NIP bugs are upstream | Reference canonical NIP URLs |

---

## 1. Risk Inventory

### High-Priority Risks (Score >= 6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| E9-R001 | PIPE | **Pipeline skill (9.2) is single point of failure** — 30 skills depend on 9.2 producing correct output. A defect in the pipeline propagates to every downstream skill. 14 ACs make this the most complex story in the epic. | 3 | 3 | 9 | Meta-eval: run pipeline on 3 test NIPs (read-only, write-capable, both) before producing any Phase 1-10 skill. Gate Phases 1-10 on pipeline validation passing. | Dev | Story 9.2 |
| E9-R002 | QUAL | **Eval quality determines all downstream quality** — If evals are too lenient, defective skills pass. If too strict, LLM non-determinism causes false failures. The eval framework (9.3) is the quality backbone. | 3 | 2 | 6 | Calibrate assertions on 9.0 and 9.1 before batch usage. Track false-positive/false-negative rates. Use assertion-based grading (not exact match). Require >=80% pass rate, not 100%. | Dev | Story 9.3 |
| E9-R003 | CONS | **Cross-skill consistency drift** — 30+ skills reference `toon-protocol-context.md` and shared concepts (TOON write model, fee calculation, social context patterns). Inconsistencies across skills confuse agents. | 2 | 3 | 6 | Single source of truth (`toon-protocol-context.md`) injected by pipeline. `validate-skill.sh` checks for banned patterns (bare `["EVENT", ...]`, wrong API references). Cross-skill grep for contradictions before publication. | Dev | Story 9.34 |
| E9-R004 | QUAL | **Social intelligence evals are subjective** — Story 9.0 (9 ACs) teaches social judgment ("should I react to this?"). Grading social appropriateness is inherently ambiguous. Over-rigid assertions kill nuance; under-rigid assertions pass bad behavior. | 2 | 3 | 6 | Use rubric-based grading (categories: appropriate/acceptable/inappropriate) not binary pass/fail. Multiple graders (parallel subagent runs). Calibrate with 5+ scenarios before batch. | Dev | Story 9.0 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| E9-R005 | PIPE | **Pipeline non-determinism** — LLM-generated skills vary across runs. Two pipeline runs on the same NIP may produce structurally different skills, making regression testing fragile. | 2 | 2 | 4 | Structural assertions (required sections exist) over content assertions (exact text match). Pin skill outputs after first successful eval pass. Re-run pipeline only when protocol changes. | Dev |
| E9-R006 | CONS | **NIP-34 Git skills (9.26-9.30) have tighter correctness requirements** — Git SHA-1 computation, object format, DAG traversal must be exact. Unlike social skills, git skills have objectively verifiable outputs. | 2 | 2 | 4 | Pre-computed fixtures: known git objects with known SHA-1 values. Evals verify exact SHA-1 match, not fuzzy assertions. Separate eval category from social skills. | Dev |
| E9-R007 | PIPE | **Description optimization loops may not converge** — `scripts.run_loop --max-iterations 5` may oscillate (description improves trigger A but breaks trigger B). | 2 | 2 | 4 | Cap at 5 iterations (already specified). Accept best-of-5 even if not perfect. Track trigger accuracy per iteration to detect oscillation. | Dev |
| E9-R008 | QUAL | **Write model correctness varies by NIP** — Some NIPs are read-only (NIP-50 Search), some write-only, some both. Pipeline must correctly classify and inject appropriate TOON model sections. | 2 | 2 | 4 | Pipeline Step 1 classification verified in meta-eval. TOON compliance assertions differentiated by skill type (write skills need `toon-write-check`, read skills need `toon-format-check`). | Dev |
| E9-R009 | CONS | **Dependency chain correctness (9.17->9.18, 9.26->9.30, 9.31->9.32)** — Skills in dependency chains must reference predecessors correctly. Pipeline-produced skills may miss cross-references. | 2 | 2 | 4 | Explicit dependency verification in eval: skill mentions predecessor by name. Publication gate checks all dependency chains are satisfied. | Dev |
| E9-R010 | QUAL | **Oversized story risk (9.0=9 ACs, 9.2=14 ACs)** — Stories 9.0 and 9.2 are 2-3x larger than typical stories. Higher defect density, harder to review, harder to validate comprehensively. | 2 | 2 | 4 | Break validation into per-AC checks. Track AC-level pass/fail, not just story-level. Review 9.0 and 9.2 with extra scrutiny. | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| E9-R011 | OPS | **skill-creator toolchain compatibility** — `eval-viewer/generate_review.py`, `scripts.run_loop`, etc. are external tools that may change | 1 | 2 | 2 | Pin skill-creator commit hash; vendor critical scripts |
| E9-R012 | OPS | **Publication packaging format** — `.skill` file format is new; install paths may vary across Claude Code versions | 1 | 2 | 2 | Test install on current Claude Code version; document manual fallback |
| E9-R013 | CONS | **Excluded NIP confusion** — Agents may encounter references to excluded NIPs (NIP-13, NIP-42, NIP-47, NIP-57, NIP-98) and not know they are handled by ILP | 1 | 2 | 2 | `nostr-protocol-core` skill explicitly documents excluded NIPs with ILP rationale |
| E9-R014 | QUAL | **Token budget overflow** — Level 2 body target is <5k tokens. Complex NIPs (NIP-34 with 12 event kinds) may exceed budget, degrading skill loading performance | 1 | 2 | 2 | `validate-skill.sh` checks token count; overflow moves content to Level 3 references |

### Risk Category Legend

- **PIPE**: Pipeline / Factory (pipeline defects propagate to all skills)
- **QUAL**: Quality / Eval (testing methodology risks)
- **CONS**: Consistency / Integration (cross-skill coherence)
- **OPS**: Operations / Toolchain (external tools, packaging)

---

## 2. Test Strategy Per Phase

### Phase 0 — Pipeline Foundation (Stories 9.0-9.3) — BLOCKING

Phase 0 is the quality backbone. Every subsequent phase depends on it. Phase 0 testing must be thorough before any Phase 1-10 work begins.

---

### Story 9.0: Social Intelligence Base Skill (`nostr-social-intelligence`)

**Structural Validation:**

| Test ID | Target | Description | Risk Link |
|---------|--------|-------------|-----------|
| 9.0-STRUCT-001 | Directory layout | `nostr-social-intelligence/SKILL.md` exists with valid YAML frontmatter (name, description) | -- |
| 9.0-STRUCT-002 | Required references | `references/interaction-decisions.md`, `context-norms.md`, `trust-signals.md`, `conflict-resolution.md`, `pseudonymous-culture.md`, `economics-of-interaction.md`, `anti-patterns.md` all exist | -- |
| 9.0-STRUCT-003 | Token budget | SKILL.md body <5k tokens | E9-R014 |
| 9.0-STRUCT-004 | Social Context section | `## Social Context` section present in SKILL.md | -- |

**Eval Execution:**

| Test ID | Target | Description | Risk Link |
|---------|--------|-------------|-----------|
| 9.0-EVAL-001 | Trigger evals | 8-10 should-trigger queries fire the skill (social decision scenarios) | E9-R004 |
| 9.0-EVAL-002 | Non-trigger evals | 8-10 should-not-trigger queries do NOT fire (pure protocol questions without social dimension) | E9-R004 |
| 9.0-EVAL-003 | Interaction decision tree | Given a social scenario, agent selects appropriate action (react/comment/repost/ignore) with reasoning | E9-R004 |
| 9.0-EVAL-004 | Context sensitivity | Agent adjusts behavior for small group vs public feed vs DM | E9-R004 |
| 9.0-EVAL-005 | Anti-pattern avoidance | Agent does NOT exhibit over-reactor, template responder, or context-blind engager patterns | E9-R004 |
| 9.0-EVAL-006 | Economics awareness | Agent references ILP payment cost in interaction decisions | -- |

**With/Without Baseline:**

| Test ID | Target | Description | Risk Link |
|---------|--------|-------------|-----------|
| 9.0-BASE-001 | Social judgment uplift | With-skill agent gives meaningfully better social interaction advice than baseline Claude | E9-R004 |
| 9.0-BASE-002 | TOON economics integration | Baseline Claude does NOT know ILP payment shapes social norms; with-skill agent does | -- |

**Pass Criteria:** >=80% eval pass rate, 18/20 trigger accuracy, with-skill measurably better than without on social scenarios.

---

### Story 9.1: TOON Protocol Core Skill (`nostr-protocol-core`)

**Structural Validation:**

| Test ID | Target | Description | Risk Link |
|---------|--------|-------------|-----------|
| 9.1-STRUCT-001 | Directory layout | `nostr-protocol-core/SKILL.md` + `references/toon-write-model.md`, `toon-read-model.md`, `fee-calculation.md` | -- |
| 9.1-STRUCT-002 | TOON write model | References `publishEvent()` API, NOT bare `["EVENT", ...]` | E9-R003 |
| 9.1-STRUCT-003 | Fee calculation | Includes `basePricePerByte * serialized event bytes` formula | E9-R008 |
| 9.1-STRUCT-004 | NIP-10/NIP-19 coverage | Threading (`e` tag markers) and bech32 encoding documented | -- |

**Eval Execution:**

| Test ID | Target | Description | Risk Link |
|---------|--------|-------------|-----------|
| 9.1-EVAL-001 | Write model correctness | Agent uses `client.publishEvent(event, { amount })`, not raw WebSocket | E9-R003 |
| 9.1-EVAL-002 | Fee calculation | Agent computes fee correctly given pricing and payload size | E9-R008 |
| 9.1-EVAL-003 | Read model TOON format | Agent handles TOON-format strings from relay, not JSON objects | E9-R003 |
| 9.1-EVAL-004 | NIP-10 threading | Agent constructs correct `e` tag hierarchy (root, reply, mention) | -- |
| 9.1-EVAL-005 | NIP-19 encoding | Agent uses correct bech32 encoding for entity references | -- |

**TOON Compliance:**

| Test ID | Target | Description | Risk Link |
|---------|--------|-------------|-----------|
| 9.1-TOON-001 | `toon-write-check` | No bare `["EVENT", ...]` patterns anywhere in skill files | E9-R003 |
| 9.1-TOON-002 | `toon-fee-check` | Fee calculation referenced in write model | E9-R008 |
| 9.1-TOON-003 | `toon-format-check` | TOON format handling documented in read model | E9-R003 |

**Pass Criteria:** >=80% eval pass rate, all TOON compliance assertions green.

---

### Story 9.2: NIP-to-TOON Skill Pipeline (`nip-to-toon-skill`)

**This is the highest-risk story in the epic.** 14 ACs, single point of failure for 30 downstream skills.

**Meta-Eval (Pipeline Validation):**

| Test ID | Target | Description | Risk Link |
|---------|--------|-------------|-----------|
| 9.2-META-001 | Read-only NIP conversion | Run pipeline on NIP-50 (Search). Verify: no write model injected, `toon-format-check` present, `toon-write-check` absent, eval format valid | E9-R001, E9-R008 |
| 9.2-META-002 | Write-capable NIP conversion | Run pipeline on NIP-25 (Reactions). Verify: write model injected, fee calculation present, `publishEvent()` referenced, social context generated | E9-R001, E9-R008 |
| 9.2-META-003 | Read+write NIP conversion | Run pipeline on NIP-23 (Long-form). Verify: both write and read models present, social context addresses cost of long-form content | E9-R001, E9-R008 |
| 9.2-META-004 | NIP classification accuracy | Pipeline correctly classifies test NIPs as read-only / write-capable / both | E9-R008 |

**Pipeline Step Validation:**

| Test ID | Target | Description | Risk Link |
|---------|--------|-------------|-----------|
| 9.2-STEP-001 | Step 1 -- NIP Analysis | Output includes: event kinds, tag structures, content formats, read/write classification | E9-R001 |
| 9.2-STEP-002 | Step 2 -- TOON Context | Write skills get TOON write model section; read skills get TOON read model section | E9-R001 |
| 9.2-STEP-003 | Step 3 -- Social Context | `## Social Context` generated using template; appropriate for the NIP's interaction type | E9-R001 |
| 9.2-STEP-004 | Step 4 -- Skill Authoring | SKILL.md has: frontmatter, body <5k tokens, Level 3 references (nip-spec.md, toon-extensions.md, scenarios.md) | E9-R001 |
| 9.2-STEP-005 | Step 5 -- Eval Generation | `evals/evals.json` has: 8-10 trigger queries, 8-10 non-trigger queries, 4-6 output evals with assertions | E9-R001, E9-R002 |
| 9.2-STEP-006 | Step 6 -- TOON Assertions | Auto-injected: `toon-write-check` (write skills), `toon-fee-check` (write skills), `toon-format-check` (read skills), `social-context-check` (all), `trigger-coverage` (all) | E9-R001 |
| 9.2-STEP-007 | Step 7 -- Description Optimization | `scripts.run_loop` executes with 20 trigger queries, max 5 iterations | E9-R007 |
| 9.2-STEP-008 | Steps 9-10 -- Grading + Benchmark | `grading.json` and `benchmark.json` produced with correct schema | E9-R001 |
| 9.2-STEP-009 | Step 11 -- TOON Compliance | All TOON assertions pass; red = pipeline failure | E9-R001 |

**Structural Validation:**

| Test ID | Target | Description | Risk Link |
|---------|--------|-------------|-----------|
| 9.2-STRUCT-001 | Pipeline skill layout | `nip-to-toon-skill/SKILL.md` + `references/toon-protocol-context.md`, `skill-structure-template.md`, `social-context-template.md` | -- |
| 9.2-STRUCT-002 | Validate script | `scripts/validate-skill.sh` exists and is executable | -- |
| 9.2-STRUCT-003 | Validate script correctness | `validate-skill.sh` catches: missing sections, invalid frontmatter, missing references, invalid eval JSON, bare `["EVENT", ...]` | E9-R003 |

**Pass Criteria:** All 3 meta-evals produce valid skills. `validate-skill.sh` correctly identifies 5+ planted defects.

---

### Story 9.3: Skill Eval Framework (TOON-Extended Skill-Creator)

**Framework Validation:**

| Test ID | Target | Description | Risk Link |
|---------|--------|-------------|-----------|
| 9.3-FW-001 | Eval runner | Executes `evals/evals.json` for stories 9.0 and 9.1 successfully | E9-R002 |
| 9.3-FW-002 | Grading output | Produces `grading.json` with `text`, `passed`, `evidence` per assertion | E9-R002 |
| 9.3-FW-003 | Benchmark aggregation | Produces `benchmark.json` with pass rate, timing (mean +/- stddev), token usage | E9-R002 |
| 9.3-FW-004 | TOON compliance suite | Runs all 5 TOON assertion templates: `toon-write-check`, `toon-fee-check`, `toon-format-check`, `social-context-check`, `trigger-coverage` | E9-R002 |
| 9.3-FW-005 | Batch runner | Runs all skills in directory through eval + benchmark in one pass | -- |
| 9.3-FW-006 | Aggregate compliance report | Single report showing per-skill pass/fail with TOON compliance status | -- |
| 9.3-FW-007 | With/without execution | Spawns parallel with-skill and without-skill subagent runs; results saved to correct directories | E9-R002 |
| 9.3-FW-008 | Iteration workspace | Follows convention: `workspace/iteration-N/eval-NAME/{with_skill,without_skill}/outputs/` | -- |

**Calibration Tests:**

| Test ID | Target | Description | Risk Link |
|---------|--------|-------------|-----------|
| 9.3-CAL-001 | False positive rate | Inject a deliberately bad skill (teaches bare `["EVENT", ...]`); verify framework catches it | E9-R002 |
| 9.3-CAL-002 | False negative rate | Run framework on known-good skill (9.1); verify it passes | E9-R002 |
| 9.3-CAL-003 | Social eval calibration | Run social scenario evals from 9.0; verify rubric-based grading produces reasonable scores | E9-R004 |

**Pass Criteria:** Framework runs on 9.0 and 9.1 without errors. Catches planted defects. Aggregate report generated.

---

### Phases 1-10 -- Skill Production (Stories 9.4-9.33)

Phases 1-10 are **pipeline outputs**. Each story follows the same validation pattern. Rather than defining per-story test tables (which would be repetitive), the test strategy is a **standard validation template** applied to every skill.

#### Standard Skill Validation Template

Every skill produced in Phases 1-10 must pass ALL of the following:

| Check | Method | Risk Link | Priority |
|-------|--------|-----------|----------|
| **STRUCT-A: Directory layout** | `validate-skill.sh` -- SKILL.md + references/ exist | -- | P0 |
| **STRUCT-B: Frontmatter valid** | Name format, description present, description length | E9-R014 | P0 |
| **STRUCT-C: Token budget** | SKILL.md body <5k tokens | E9-R014 | P1 |
| **STRUCT-D: Required sections** | `## Social Context` present | E9-R003 | P0 |
| **EVAL-A: Trigger accuracy** | 8-10 should-trigger queries, 8-10 should-not-trigger | E9-R002 | P0 |
| **EVAL-B: Output evals** | 4-6 output evals with assertions pass at >=80% | E9-R002 | P0 |
| **TOON-A: Write check** | Write skills use `publishEvent()`, no bare `["EVENT", ...]` | E9-R003 | P0 |
| **TOON-B: Fee check** | Write skills include fee calculation or reference | E9-R008 | P0 |
| **TOON-C: Format check** | Read skills handle TOON format | E9-R003 | P1 |
| **TOON-D: Social context check** | Social context is NIP-appropriate, not generic | E9-R004 | P1 |
| **BASE-A: With/without** | Skill adds measurable value over baseline | -- | P1 |
| **DEP-A: Dependency refs** | Skills in dependency chains reference predecessors | E9-R009 | P1 |

#### Phase-Specific Test Notes

**Phase 1 -- Identity and Profiles (9.4):**
- First skill produced by pipeline. Use as pipeline regression test.
- Write-capable: profile updates cost money.

**Phase 2 -- Content and Publishing (9.5-9.7):**
- 9.6 (Social Interactions) is the highest-value social skill -- interaction decision tree must align with 9.0 base skill.
- Cross-reference check: 9.6 should reference 9.0's interaction decisions.

**Phase 3 -- Community and Groups (9.8-9.10):**
- 9.8 (Relay Groups / NIP-29) has TOON-specific considerations: ILP-gated group entry.
- Social context especially important for group dynamics.

**Phase 4 -- Curation and Discovery (9.11-9.13):**
- 9.13 (App Handlers / NIP-89) links to TOON's kind:10035 -- cross-reference with DVM skills (9.31).

**Phase 5 -- Rich Media (9.14-9.16):**
- 9.14 must include `arweave:tx:` external content IDs (critical TOON/Arweave integration).
- Cross-reference with Epic 8's Arweave DVM (kind:5094).

**Phase 6 -- Privacy and Content Control (9.17-9.20):**
- **Dependency chain: 9.17 (Encrypted Messaging) -> 9.18 (Private DMs).** Verify 9.18 references 9.17 for encryption details.
- 9.19 (Content Control): "even deletion costs money" is a key TOON social insight.

**Phase 7 -- Advanced Social Features (9.21-9.25):**
- 9.24 (Polls): "voting costs money -- prevents ballot stuffing" is a novel TOON social norm.
- Lower risk phase; standard template sufficient.

**Phase 8 -- NIP-34 Git Skills (9.26-9.30):**
- **Highest correctness requirements in the epic.** Git SHA-1, object formats, DAG traversal must be exact.
- Additional verification beyond standard template:

| Test ID | Target | Description | Risk Link |
|---------|--------|-------------|-----------|
| 9.26-GIT-001 | Per-kind resource completeness | All 12 NIP-34 event kinds have dedicated Level 3 resources | E9-R006 |
| 9.26-GIT-002 | Tag structure accuracy | Required/optional tags per kind match NIP-34 spec | E9-R006 |
| 9.27-GIT-003 | SHA-1 computation | Evals verify SHA-1 matches pre-computed values for known git objects | E9-R006 |
| 9.27-GIT-004 | Object format accuracy | Blob, tree, commit format descriptions match git internals | E9-R006 |
| 9.28-GIT-005 | Arweave mapping | kind:5094 upload flow with Irys tags documented correctly | E9-R006 |
| 9.28-GIT-006 | DAG navigation | kind:30618 -> commit -> tree -> blob chain documented with examples | E9-R006 |
| 9.29-GIT-007 | Workflow completeness | Each workflow (create-repo, submit-patch, merge-patch, fetch-file) is end-to-end | E9-R006 |
| 9.30-GIT-008 | Eval pass rate | Target: >80% eval pass rate, 18/20 trigger accuracy | E9-R006 |

**Phase 9 -- DVM and Marketplace Skills (9.31-9.32):**
- **Dependency chain: 9.31 (DVM Protocol) -> 9.32 (Marketplace).**
- 9.31 must accurately teach prepaid model (D7-001), `kindPricing` from SkillDescriptor.
- Cross-reference with kind:10035 service discovery from Epics 6-7.

**Phase 10 -- Relay Discovery (9.33):**
- Must teach TOON-enriched NIP-11 (pricing, ILP capabilities, chain config, x402 status, TEE attestation).
- Read-focused; `toon-write-check` should NOT be required.

---

### Phase 11 -- Publication Gate (Story 9.34)

**Publication Gate Checks:**

| Test ID | Target | Description | Risk Link | Priority |
|---------|--------|-------------|-----------|----------|
| 9.34-GATE-001 | All skills present | 30+ skill directories exist with SKILL.md and evals/ | -- | P0 |
| 9.34-GATE-002 | Batch eval pass | All skills pass eval framework at >=80% | E9-R002 | P0 |
| 9.34-GATE-003 | TOON compliance sweep | All skills pass TOON compliance assertions (no red) | E9-R003 | P0 |
| 9.34-GATE-004 | Cross-skill consistency | Grep across all skills for contradictions in: write model API, fee formula, read model format | E9-R003 | P0 |
| 9.34-GATE-005 | Dependency chain satisfaction | All chains complete: 9.17->9.18, 9.26->9.27->9.28->9.29->9.30, 9.31->9.32 | E9-R009 | P0 |
| 9.34-GATE-006 | Packaging | Each skill produces a `.skill` file via `scripts.package_skill` | E9-R012 | P0 |
| 9.34-GATE-007 | Install verification | At least 3 skills install and trigger correctly in Claude Code | E9-R012 | P1 |
| 9.34-GATE-008 | Aggregate benchmark | Overall pass rate, timing, token metrics reported and baselined | -- | P1 |
| 9.34-GATE-009 | Pipeline documentation | `nip-to-toon-skill` includes: overview, step-by-step guide, TOON compliance requirements, contribution guidelines | -- | P1 |
| 9.34-GATE-010 | Excluded NIP documentation | `nostr-protocol-core` explicitly documents NIP-13, NIP-42, NIP-47, NIP-57, NIP-98 with ILP rationale | E9-R013 | P2 |

**Cross-Skill Consistency Checks (Detail):**

| Check | What to Verify | Method |
|-------|----------------|--------|
| Write model API | All write skills reference `client.publishEvent(event, { amount })` | Grep all SKILL.md + references for `publishEvent` |
| Fee formula | All write skills reference `basePricePerByte * serialized event bytes` | Grep for fee calculation pattern |
| Read model format | All read skills mention TOON-format strings (not JSON objects) | Grep for TOON format handling |
| Banned patterns | No skill teaches bare `["EVENT", ...]` or `["REQ", ...]` for writes | Grep for `["EVENT"` in code examples |
| Social context | No skill has a generic/placeholder `## Social Context` | Manual review of 5 random skills |
| `toon-protocol-context.md` | Shared reference file is consistent with `nostr-protocol-core` skill | Diff check |

---

## 3. Test Execution Plan

### Phase 0 Execution (Sequential -- Blocks Everything)

```
9.0 (Social Intelligence) ---+
                              +--- 9.2 (Pipeline) --- 9.3 (Eval Framework)
9.1 (Protocol Core) ---------+
```

1. **Stories 9.0 + 9.1** (parallel): Author skills, run structural validation, run evals, calibrate eval framework.
2. **Story 9.2** (depends on 9.0 + 9.1): Build pipeline, run meta-eval on 3 test NIPs. Gate on all 3 producing valid skills.
3. **Story 9.3** (depends on 9.0 + 9.1, parallel with 9.2): Build eval framework, calibrate on 9.0 + 9.1, run false-positive/false-negative tests.
4. **Phase 0 gate**: Pipeline + framework validated. Phases 1-10 can begin.

### Phases 1-10 Execution (Mostly Parallel)

Within each phase, skills can be produced in parallel. Dependency chains must be respected:
- Phase 6: 9.17 before 9.18
- Phase 8: 9.26 -> 9.27 -> 9.28 -> 9.29 -> 9.30 (sequential)
- Phase 9: 9.31 before 9.32

Each skill follows the standard validation template. Batch eval runner (9.3-FW-005) can validate multiple skills per run.

### Phase 11 Execution (Terminal Gate)

1. Run batch eval across all skills.
2. Run cross-skill consistency checks.
3. Run TOON compliance sweep.
4. Package all skills.
5. Verify install on 3 representative skills.
6. Generate aggregate benchmark baseline.

---

## 4. Automation Opportunities

| Tool | Purpose | Stories |
|------|---------|--------|
| `scripts/validate-skill.sh` | Structural validation (lint) | All |
| Eval framework batch runner | Eval execution across all skills | 9.3, 9.34 |
| TOON compliance assertion suite | Protocol correctness | All |
| Cross-skill grep script | Consistency checks (banned patterns, API references) | 9.34 |
| `scripts.package_skill` | Publication packaging | 9.34 |

**Recommended new automation:**
- **`scripts/validate-all-skills.sh`**: Wrapper that runs `validate-skill.sh` on every skill directory + cross-skill consistency checks + aggregates results.
- **`scripts/cross-skill-consistency.sh`**: Greps across all skills for contradictions (write model API, fee formula, banned patterns).

---

## 5. Priority Matrix

| Priority | Count | Description |
|----------|-------|-------------|
| P0 | 18 | Pipeline meta-evals, eval framework calibration, structural validation, TOON compliance assertions |
| P1 | 30 | Per-skill eval execution, with/without baseline, dependency chain verification |
| P2 | 12 | Cross-skill consistency deep checks, install verification, aggregate benchmark, documentation completeness |

**P0 effort**: ~15-25 hours (focused on Phase 0 stories)
**P1 effort**: ~20-30 hours (standard template applied to 30 skills, batch-automated)
**P2 effort**: ~8-12 hours (publication gate checks, manual review)

---

## 6. Open Questions

1. **Eval cost budget**: Running 30+ skills through with/without baseline testing requires significant LLM API calls. What is the budget constraint? Can we batch with/without testing or must each skill be tested individually?
2. **Model version pinning**: Should benchmark.json capture the model version? Skills may behave differently across Claude model updates.
3. **Regression strategy**: After Epic 9 ships, how are skills re-validated when the protocol changes (e.g., fee model update)? The pipeline's D9-010 decision ("update `toon-protocol-context.md`, re-run affected skills") needs a concrete re-validation workflow.
4. **Community contribution testing**: Story 9.34 publishes the pipeline for community use. Should we define a contribution acceptance test suite (beyond what `validate-skill.sh` checks)?
