---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-03-06'
mode: 'epic-level'
epic: 3
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md
  - _bmad-output/test-artifacts/test-design-architecture.md
  - _bmad/tea/testarch/knowledge/risk-governance.md
  - _bmad/tea/testarch/knowledge/probability-impact.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
---

# Test Design Progress — Epic 3: Production Protocol Economics

## Step 1: Mode Detection

**Mode:** Epic-Level (Phase 4)
**Date:** 2026-03-06

**Rationale:** User explicitly requested "for epic 3". Epic-level test design produces a single test-design-epic-3.md document.

**Prerequisites Verified:**

- Requirements baseline: `_bmad-output/planning-artifacts/epics.md` (Epic 3: Stories 3.1–3.6, 6 FRs: FR-PROD-1 through FR-PROD-6)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (Decisions 7–10, Patterns 10–13)
- Decision source: `_bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md` (Decisions 1, 2, 6, 7, 8, 12, 13)

## Step 2: Context Loading

**Stack:** backend (TypeScript/Node.js protocol SDK monorepo, Vitest)
**Config:** tea_use_playwright_utils=true (API-only), tea_use_pactjs_utils=true, tea_pact_mcp=mcp

**Authoritative Documents (4):**

- `_bmad-output/planning-artifacts/epics.md` — Epic 3: 6 stories, 6 FRs
- `_bmad-output/planning-artifacts/architecture.md` — Decisions 7–10, Patterns 10–13
- `_bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md` — Party Mode decisions (1, 2, 6, 7, 8, 12, 13)
- `_bmad-output/test-artifacts/test-design-architecture.md` — System-level risk register (14 risks; R-001 and R-005 inherited)

**Existing Tests:** None — Epic 3 code is greenfield

**Inherited System-Level Risks:**

- R-001 (TECH, score 9): TOON pipeline ordering — x402 PREPARE packets flow through same ILP pipeline
- R-005 (DATA, score 6): Payment channel state integrity — USDC channels must survive settlement failures

**Knowledge Fragments (4 core):**

- risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md

## Step 3: Risk & Testability Assessment

**Risks Identified:** 11 epic-specific + 2 inherited = 13 total

- 5 high-priority (score >=6): E3-R001, E3-R002, E3-R003, E3-R004, E3-R005
- 4 medium (score 3-5): E3-R006, E3-R007, E3-R008, E3-R009, E3-R013
- 3 low (score 1-2): E3-R010, E3-R011, E3-R012

**Party Mode Refinements:**

- Gas griefing vector identified → layered pre-flight validation (E3-R013, score 3 with mitigations)
- No-refund on x402 REJECT → mirrors ILP semantics, eliminates reject-based griefing
- Packet equivalence conditional escalation (E3-R003: score 6 IF shared buildIlpPrepare(), else 9)
- E3-R004/R005 coupled through EIP-712 domain separator chain-awareness
- E3-R002 split into two sub-scenarios (settlement revert vs PREPARE reject)

## Step 4: Coverage Plan

**Total Tests:** 34 (9 P0, 12 P1, 10 P2, 3 P3)
**Execution:** PR (unit + integration <10min with Anvil), Nightly (full suite + E2E <15min with genesis node)
**Resource Estimate:** ~38-67 hours (~1-2 weeks for 1 engineer)
**Quality Gates:** P0=100%, P1>=95%, pre-flight firewall 100% branch coverage, packet equivalence verified, no-refund enforced, EIP-712 chain-aware

## Step 5: Generate Output

**Output:** `_bmad-output/test-artifacts/test-design-epic-3.md`
**Validation:** Checklist validated — all epic-level criteria met
**Status:** Complete
