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
lastSaved: '2026-03-04'
mode: 'epic-level'
epic: 3
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/test-artifacts/test-design-architecture.md
  - packages/core/src/nip34/types.ts
  - packages/core/src/nip34/constants.ts
  - _bmad/tea/testarch/knowledge/risk-governance.md
  - _bmad/tea/testarch/knowledge/probability-impact.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
---

# Test Design Progress — Epic 3: The Rig

## Step 1: Mode Detection

**Mode:** Epic-Level (Phase 4)
**Date:** 2026-03-04

**Rationale:** User explicitly requested "epic 3". Epic-level test design produces a single test-design-epic-3.md document.

**Prerequisites Verified:**

- Requirements baseline: `_bmad-output/planning-artifacts/epics.md` (Epic 3: Stories 3.1-3.12, 6 FRs: FR-NIP34-1 through FR-NIP34-6)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (complete — Express ^5.2, Eta ^4.5, git child_process, SQLite repo metadata, relay queries)
- System-level test design: `_bmad-output/test-artifacts/test-design-architecture.md` (Phase 3 complete)

## Step 2: Context Loading

**Stack:** backend (TypeScript/Node.js protocol SDK monorepo, Vitest)
**Config:** tea_use_playwright_utils=true (API-only), tea_use_pactjs_utils=true, tea_pact_mcp=mcp

**Authoritative Documents (4):**

- `_bmad-output/planning-artifacts/epics.md` — Epic 3: 12 stories, 6 FRs
- `_bmad-output/planning-artifacts/architecture.md` — ADR: Rig decisions (Express 5.2, Eta 4.5, git child_process, SQLite, relay queries), Patterns 6-9
- `_bmad-output/test-artifacts/test-design-architecture.md` — System-level risk register (14 risks; R-004, R-009, R-012 Rig-scoped)
- `packages/core/src/nip34/` — NIP-34 types, constants, helpers (existing foundation)

**Existing Tests:** None — packages/rig/ is greenfield (does not exist yet)

**Existing NIP-34 Foundation:**

- types.ts: RepositoryAnnouncement, PatchEvent, IssueEvent, StatusEvent interfaces + parseRepositoryReference(), extractCommitMessage()
- constants.ts: Kind constants (30617, 1617, 1618, 1621, 1630-1633) + isNIP34Event()
- ForgejoClient.ts, NIP34Handler.ts: Legacy Forgejo integration (to be replaced by Rig)

**Knowledge Fragments (4 core):**

- risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md

## Step 3: Risk & Testability Assessment

**Risks Identified:** 13 total (epic-scoped)

- 5 high-priority (score >=6): E3-R001 through E3-R005
- 5 medium (score 3-4): E3-R006 through E3-R010
- 3 low (score 1-2): E3-R011, E3-R012, E3-R013

**Top Risks:** 4 SEC-category risks (git injection, auth bypass, path traversal, XSS) — all score 6
**Inherited from system-level:** R-004 → E3-R001, R-009 → E3-R006, R-012 → E3-R011

## Step 4: Coverage Plan & Execution Strategy

**Coverage Matrix (Epic 3):**

- P0: 11 tests (security mitigations, core write path handlers + integration)
- P1: 13 tests (core read path, handler happy paths, git HTTP backend, web UI routes)
- P2: 10 tests (blame, relay-sourced data, error states, profile enrichment)
- P3: 5 tests (package config, CLI, cosmetic)
- Total: 39 tests

**Execution Strategy:**

- Every PR: All 39 unit + integration tests (< 10 min, real git + SQLite :memory:)
- No nightly/weekly needed — all tests are fast and infrastructure-light

**Effort Estimate:** ~48-84 hours (~1.5-3 weeks, 1 engineer)

## Step 5: Generate Output

**Document Generated:**

- `_bmad-output/test-artifacts/test-design-epic-3.md` — Epic 3 test design (risk assessment, coverage matrix, execution strategy, resource estimates, quality gates)

**Validation:** Checklist reviewed, all epic-level criteria satisfied.
