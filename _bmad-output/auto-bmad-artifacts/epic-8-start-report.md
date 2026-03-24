# Epic 8 Start Report

## Overview
- **Epic**: 8 — The Rig: Arweave DVM + Forge-UI
- **Git start**: `abb22938a82d8572bcce1556333024b5ae064f3f`
- **Duration**: ~35 minutes pipeline wall-clock
- **Pipeline result**: success
- **Previous epic retro**: reviewed (Epic 7 retro at `_bmad-output/auto-bmad-artifacts/epic-7-retro-report.md`)
- **Baseline test count**: 2741 (2,662 passed, 79 skipped)

## Previous Epic Action Items

| # | Action Item | Priority | Resolution |
|---|------------|----------|------------|
| A1 | E2E test debt (~31 claimed, triaged to 6 real + 92 ATDD stubs) | Critical | Triaged — documented in `e2e-test-debt-triage.md`. Real debt is 6 tests, not 31. |
| A2 | `BootstrapService.republish()` for kind:10032 re-advertisement | Critical | **Fixed** — implemented `republish()` method, wired into `addUpstreamPeer`/`removeUpstreamPeer` in create-node.ts. +3 tests. |
| A3 | Standardize injectable time pattern | Recommended | Investigated — no divergence found. SwarmCoordinator and WorkflowOrchestrator already consistent. Closed. |
| A4 | Load testing infrastructure | Recommended | Deferred — not relevant to Epic 8 scope. |
| A5 | Facilitator ETH monitoring | Recommended | Deferred — no facilitator in current architecture. |
| A6 | Commit flake.lock | Recommended | Investigated — file does not exist on disk. Closed. |
| A7 | `resolveRouteFees()` caching | Recommended | Deferred — O(n) per call acceptable for v1. Revisit if profiling shows bottleneck. |
| A8 | Formal DVM SLOs | Recommended | Deferred — post-launch operational maturity. |
| A9 | Runtime re-publication of kind:10035 | Nice-to-have | Deferred. |
| A10 | Weighted WoT reputation model | Nice-to-have | Deferred. |
| A11 | Publish @toon-protocol/town to npm | Nice-to-have | Deferred. |
| A12 | NIP-33/NIP-16 doc discrepancy | Nice-to-have | Deferred. |
| A13 | Protocol-level reputation verification | Nice-to-have | Deferred. |
| A14 | Docker E2E for workflow/swarm coordination | Nice-to-have | Deferred. |

## Baseline Status
- **Lint**: pass — 0 errors, 1039 warnings (pre-existing `no-non-null-assertion`/`no-explicit-any`, non-blocking)
- **Tests**: 2,662/2,662 passing (79 skipped), 0 failures
- **Build**: all 12 workspace packages compile successfully

## Epic Analysis
- **Stories**: 7 stories
  - 8.0: Arweave Storage DVM Provider (kind:5094)
  - 8.1: Forge-UI — Layout and Repository List
  - 8.2: Forge-UI — File Tree and Blob View
  - 8.3: Forge-UI — Commit Log and Diff View
  - 8.4: Forge-UI — Blame View
  - 8.5: Forge-UI — Issues and PRs from Relay
  - 8.6: Deploy Forge-UI to Arweave
- **Oversized stories**: Story 8.0 is at exactly 8 ACs and very dense. Recommend splitting into 8.0a (core single-packet) and 8.0b (chunked upload).
- **Dependencies**: All hard dependencies met (Epics 1-7 complete). Soft dependency on Epic 9 Stories 9.26-9.30 (NIP-34 skills) — non-blocking since NIP-34 event structures come from the NIP spec directly.
- **Design patterns needed**:
  1. Arweave adapter interface (isolates `@ardrive/turbo-sdk` and its 31 vulnerabilities)
  2. Stateful chunk accumulation pattern (provider-side upload reassembly)
  3. Static web app build tooling (first browser-targeted code in monorepo)
  4. Git object parsing utilities (tree, commit, blob, diff, blame)
  5. Arweave GraphQL query pattern (`Git-SHA → Arweave tx ID` resolution)
- **Recommended story order**:
  1. 8.0 (foundation — Arweave DVM, kind:5094)
  2. 8.1 (Forge-UI scaffold — layout, relay queries, build tooling)
  3. 8.2 (file tree + blob — establishes git object parsing)
  4. 8.3 (commit log + diff — builds on 8.2 patterns)
  5. 8.5 (issues + PRs — relay-only, can parallel with 8.2-8.4)
  6. 8.4 (blame — most complex, lowest priority)
  7. 8.6 (deploy — capstone, dogfoods kind:5094)

## Test Design
- **Epic test plan**: `_bmad-output/planning-artifacts/test-design-epic-8.md`
- **Key risks identified**:
  - Arweave upload reliability and chunked upload state management
  - `@ardrive/turbo-sdk` supply chain risk (31 vulnerabilities) — mitigated by adapter interface
  - First client-side web app — no existing browser test tooling
  - Git object parsing correctness (binary tree format, diff computation, blame algorithm)
  - NIP-34 event TOON encoding/decoding
  - Prepaid DVM payment flow validation

## Pipeline Steps

### Step 1: Previous Retro Check
- **Status**: success
- **Duration**: ~1 min
- **What changed**: none (analysis only)
- **Key decisions**: Categorized 14 action items by priority
- **Issues found & fixed**: 0
- **Remaining concerns**: Retro action item resolution regressed in Epic 7 (0% vs 100% in Epics 5-6)

### Step 2: Tech Debt Cleanup
- **Status**: success
- **Duration**: ~10 min
- **What changed**: `BootstrapService.ts` (+republish method), `BootstrapService.test.ts` (+3 tests), `create-node.ts` (wired republish), `e2e-test-debt-triage.md` (new)
- **Key decisions**: republish() is stateless (takes results as param); fire-and-forget in topology change handlers
- **Issues found & fixed**: 1 (unused variable in test)
- **Remaining concerns**: none

### Step 3: Lint Baseline
- **Status**: success
- **Duration**: ~2 min
- **What changed**: none (already clean)
- **Key decisions**: none
- **Issues found & fixed**: 0
- **Remaining concerns**: 1039 warnings (pre-existing, non-blocking)

### Step 4: Test Baseline
- **Status**: success
- **Duration**: ~3 min
- **What changed**: none (all tests passing)
- **Key decisions**: none
- **Issues found & fixed**: 0
- **Remaining concerns**: none

### Step 5: Epic Overview Review
- **Status**: success
- **Duration**: ~4 min
- **What changed**: none (analysis only)
- **Key decisions**: Classified Epic 9 NIP-34 dependency as soft; recommended splitting Story 8.0
- **Issues found & fixed**: 0
- **Remaining concerns**: Git object parsing library choice needed before Story 8.2

### Step 6: Sprint Status Update
- **Status**: success
- **Duration**: ~15 sec
- **What changed**: `sprint-status.yaml` (epic-8: backlog → in-progress)
- **Key decisions**: none
- **Issues found & fixed**: 0
- **Remaining concerns**: none

### Step 7: Test Design
- **Status**: success
- **Duration**: ~3 min
- **What changed**: created `test-design-epic-8.md` (609 lines)
- **Key decisions**: Real Arweave integration tests (free tier), jsdom for browser tests, adapter interface for turbo-sdk isolation
- **Issues found & fixed**: 0
- **Remaining concerns**: ArDrive free tier rate limits undocumented; blame depth limit decision needed

## Ready to Develop
- [x] All critical retro actions resolved (A1 triaged, A2 implemented)
- [x] Lint and tests green (zero failures)
- [x] Sprint status updated (epic-8: in-progress)
- [x] Story order established (8.0 → 8.1 → {8.2→8.3→8.4 ∥ 8.5} → 8.6)

## Next Steps
Start with **Story 8.0: Arweave Storage DVM Provider**. Consider splitting into 8.0a (core) and 8.0b (chunked upload) during story creation. Key preparation: evaluate `@ardrive/turbo-sdk` bundle size impact and design the adapter interface before implementation.

---

## TL;DR
Epic 8 (The Rig: Arweave DVM + Forge-UI) is ready to start. Baseline is green with 2,662 passing tests and zero lint errors. The critical retro action item (BootstrapService.republish) was implemented with 3 new tests, and E2E test debt was triaged down from 31 claimed items to 6 real items. A risk-based test design covers all 7 stories with emphasis on Arweave integration reliability and the project's first browser-targeted deliverable.
