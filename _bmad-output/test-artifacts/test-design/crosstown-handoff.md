---
title: 'TEA Test Design -> BMAD Handoff Document'
version: '1.0'
workflowType: 'testarch-test-design-handoff'
inputDocuments:
  - _bmad-output/test-artifacts/test-design-architecture.md
  - _bmad-output/test-artifacts/test-design-qa.md
sourceWorkflow: 'testarch-test-design'
generatedBy: 'TEA Master Test Architect'
generatedAt: '2026-03-03'
projectName: 'crosstown'
---

# TEA -> BMAD Integration Handoff

## Purpose

This document bridges TEA's test design outputs with BMAD's epic/story decomposition workflow (`create-epics-and-stories`). It provides structured integration guidance so that quality requirements, risk assessments, and test strategies flow into implementation planning.

## TEA Artifacts Inventory

| Artifact                 | Path                                                      | BMAD Integration Point                               |
| ------------------------ | --------------------------------------------------------- | ---------------------------------------------------- |
| Architecture Test Design | `_bmad-output/test-artifacts/test-design-architecture.md` | Epic quality requirements, story acceptance criteria |
| QA Test Design           | `_bmad-output/test-artifacts/test-design-qa.md`           | Story test requirements, execution strategy          |
| Risk Assessment          | (embedded in architecture doc)                            | Epic risk classification, story priority             |
| Coverage Strategy        | (embedded in QA doc)                                      | Story test requirements (53 tests across P0-P3)      |

## Epic-Level Integration Guidance

### Risk References

The following P0/P1 risks should appear as epic-level quality gates:

**Epic 1 (SDK):**

- R-001 (TOON pipeline ordering, score 9) - Gate: Integration test proves stage ordering invariant
- R-002 (Schnorr bypass, score 6) - Gate: Unit test proves devMode=false enforcement
- R-003 (TOON codec extraction, score 6) - Gate: All existing tests pass after codec move
- R-005 (Payment channel state, score 6) - Gate: Channel lifecycle integration test passes

**Epic 2 (Town):**

- R-006 (SDK replacement regression, score 6) - Gate: `genesis-bootstrap-with-channels.test.ts` passes against SDK-built relay

**Epic 5 (The Rig):**

- R-004 (Git command injection, score 6) - Gate: No `child_process.exec` calls; input sanitization tests pass

### Quality Gates

| Epic   | Quality Gate                                      | Threshold                       |
| ------ | ------------------------------------------------- | ------------------------------- |
| Epic 1 | All P0 tests pass for SDK pipeline                | 100% P0, >=95% P1               |
| Epic 1 | >80% line coverage for SDK public APIs            | NFR-SDK-3                       |
| Epic 2 | E2E regression suite passes                       | genesis-bootstrap-with-channels |
| Epic 2 | SDK-based relay entrypoint <100 LOC handler logic | Validation benchmark            |
| Epic 5 | No exec() calls in packages/rig/                  | Security gate                   |
| Epic 5 | Git input sanitization tests pass                 | P0-007, P0-008                  |

## Story-Level Integration Guidance

### P0/P1 Test Scenarios -> Story Acceptance Criteria

| Story | Test Scenario (from QA doc)                               | Acceptance Criteria Addition                              |
| ----- | --------------------------------------------------------- | --------------------------------------------------------- |
| 1.0   | P0-005: TOON roundtrip, P0-006: BLS+relay imports         | AC: `pnpm -r test` passes after codec move                |
| 1.3   | P1-004: Raw TOON passthrough, P1-005: Lazy decode caching | AC: `ctx.toon` available without decode overhead          |
| 1.4   | P0-003: Invalid sig F06, P0-004: devMode enforcement      | AC: Invalid signature rejected in non-dev mode            |
| 1.5   | P1-008: Pricing F04, P1-010: Self-write bypass            | AC: Underpaid event rejected; own pubkey events free      |
| 1.6   | P1-011: Transit fire-and-forget, P1-012: Transit await    | AC: isTransit behavior matches Crosstown Service Protocol |
| 1.7   | P0-002: Full pipeline ordering                            | AC: Integration test validates stage sequence             |
| 2.3   | P0-011: E2E regression                                    | AC: All genesis-bootstrap tests pass                      |
| 5.1   | P1-024: Repo creation, P0-007: execFile                   | AC: git init via execFile only                            |
| 5.2   | P1-025: Patch handler, P0-008: Input sanitization         | AC: Malicious patch content rejected                      |

### Data-TestId Requirements

Not applicable for this project (backend SDK, no browser UI testing).

## Risk-to-Story Mapping

| Risk ID | Category | P x I | Recommended Story/Epic                 | Test Level         |
| ------- | -------- | ----- | -------------------------------------- | ------------------ |
| R-001   | TECH     | 2x3=9 | Story 1.6 (PaymentHandler bridge)      | Integration        |
| R-002   | SEC      | 2x3=6 | Story 1.4 (Schnorr verification)       | Unit               |
| R-003   | TECH     | 2x3=6 | Story 1.0 (TOON codec extraction)      | Unit + Integration |
| R-004   | SEC      | 2x3=6 | Story 5.1, 5.2 (git operations)        | Unit               |
| R-005   | DATA     | 2x3=6 | Story 1.7, 1.9 (lifecycle + bootstrap) | Integration        |
| R-006   | TECH     | 3x2=6 | Story 2.3 (E2E validation)             | E2E                |
| R-007   | TECH     | 2x2=4 | Story 1.8 (connector methods)          | Integration        |
| R-008   | TECH     | 1x3=3 | Story 1.6 (PaymentHandler bridge)      | Unit               |
| R-009   | OPS      | 2x2=4 | Story 5.11 (issues/PRs from relay)     | Integration        |
| R-010   | BUS      | 1x3=3 | Story 1.5 (pricing validation)         | Unit               |
| R-011   | TECH     | 1x3=3 | Story 1.1 (unified identity)           | Unit               |
| R-012   | BUS      | 1x2=2 | Stories 5.7-5.10 (web UI views)        | Integration        |
| R-013   | DATA     | 1x2=2 | Story 5.1 (repo metadata)              | Unit               |
| R-014   | OPS      | 1x1=1 | Stories 1.11, 2.5, 5.12 (publish)      | Unit               |

## Recommended BMAD -> TEA Workflow Sequence

1. **TEA Test Design** (`TD`) -> produces this handoff document (COMPLETE)
2. **BMAD Create Epics & Stories** -> consumes this handoff, embeds quality requirements
3. **TEA ATDD** (`AT`) -> generates failing acceptance tests per story (P0 scenarios first)
4. **BMAD Implementation** -> developers implement with test-first guidance
5. **TEA Automate** (`TA`) -> generates full test suite (P1-P3 scenarios)
6. **TEA Trace** (`TR`) -> validates coverage completeness

## Phase Transition Quality Gates

| From Phase          | To Phase            | Gate Criteria                                           |
| ------------------- | ------------------- | ------------------------------------------------------- |
| Test Design         | Epic/Story Creation | All 6 P0 risks have mitigation strategy (DONE)          |
| Epic/Story Creation | ATDD                | Stories have acceptance criteria from test design       |
| ATDD                | Implementation      | Failing acceptance tests exist for all P0 scenarios     |
| Implementation      | Test Automation     | All acceptance tests pass, >80% line coverage           |
| Test Automation     | Release             | Trace matrix shows >=80% coverage of P0/P1 requirements |
