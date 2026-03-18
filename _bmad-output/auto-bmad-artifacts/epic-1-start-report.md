# Epic 1 Start Report

## Overview

- **Epic**: 1 — ILP-Gated Service Node SDK
- **Git start**: `0e1aae0fa839d418b85a0469261c27d062decdd8`
- **Duration**: ~15 minutes
- **Pipeline result**: success
- **Previous epic retro**: N/A (first epic)
- **Baseline test count**: 0

## Previous Epic Action Items

N/A — Epic 1 is the first epic. No previous retrospective to review.

## Baseline Status

- **Lint**: N/A (first epic, no code to lint)
- **Tests**: N/A (first epic, no tests to run)
- **Migrations**: N/A

## Epic Analysis

- **Stories**: 12 stories

| Story ID | Title                                                      |
| -------- | ---------------------------------------------------------- |
| 1.0      | Extract TOON Codec to @toon-protocol/core                      |
| 1.1      | Unified Identity from Seed Phrase                          |
| 1.2      | Handler Registry with Kind-Based Routing                   |
| 1.3      | HandlerContext with TOON Passthrough and Lazy Decode       |
| 1.4      | Schnorr Signature Verification Pipeline                    |
| 1.5      | Pricing Validation with Self-Write Bypass                  |
| 1.6      | PaymentHandler Bridge with Transit Semantics               |
| 1.7      | createNode() Composition with Embedded Connector Lifecycle |
| 1.8      | Connector Direct Methods API                               |
| 1.9      | Network Discovery and Bootstrap Integration                |
| 1.10     | Dev Mode                                                   |
| 1.11     | Package Setup and npm Publish                              |

- **Oversized stories** (>8 ACs): None — all stories have 3-5 ACs
- **Dependencies**:
  - **Inter-story**: 1.0 blocks 1.3/1.4/1.5; 1.2 blocks 1.6; 1.4+1.5 block 1.10; 1.7 depends on 1.1/1.2/1.3/1.4/1.5/1.6/1.8/1.9; 1.11 depends on all
  - **Cross-epic**: None — Epic 1 is the foundational epic
- **Design patterns to establish early**:
  1. TOON pipeline ordering (raw -> shallow parse -> verify -> route -> lazy decode) — correctness-critical
  2. Structural typing for ConnectorNode (`ConnectorNodeLike`) — SDK must not import @toon-protocol/connector
  3. Handler context pattern (void return + ctx.accept()/ctx.reject())
  4. Error hierarchy (ToonError -> NodeError, HandlerError, VerificationError, PricingError)
  5. `node.on(number)` vs `node.on(string)` disambiguation
- **Recommended story order**:
  - **Phase 1 (parallel)**: 1.0, 1.1, 1.2, 1.8, 1.9 — all zero-dependency stories
  - **Phase 2 (parallel, after 1.0)**: 1.3, 1.4, 1.5 — depend only on 1.0
  - **Phase 3 (after phases 1+2)**: 1.6 (needs 1.2), 1.10 (needs 1.4+1.5)
  - **Phase 4 (after all above)**: 1.7 — composition, needs everything
  - **Phase 5 (after 1.7)**: 1.11 — packaging and publish
  - **Critical path**: 1.0 -> 1.4 -> 1.10 -> 1.7 -> 1.11 (5 stories, strictly sequential)

## Test Design

- **Epic test plan**: `_bmad-output/planning-artifacts/test-design-epic-1.md`
- **Key risks identified**:
  - E1-R11: Pipeline ordering violation (score 9, highest risk)
  - E1-R02: Shallow parse byte offset bugs
  - E1-R07: Verify after full decode (correctness violation)
  - 71 tests planned: 38 P0, 22 P1, 10 P2, 1 P3

## Pipeline Steps

### Step 1: Previous Retro Check

- **Status**: skipped
- **Reason**: First epic — no previous retro to check

### Step 2: Tech Debt Cleanup

- **Status**: skipped
- **Reason**: No action items to resolve

### Step 3: Lint Baseline

- **Status**: skipped
- **Reason**: First epic — no code to lint

### Step 4: Test Baseline

- **Status**: skipped
- **Reason**: First epic — no tests to run

### Step 5: Epic Overview Review

- **Status**: success
- **Duration**: ~4 minutes
- **What changed**: No files modified (analysis only)
- **Key decisions**: Identified 5 parallelizable stories in Wave 0; prioritized Story 1.0 as unambiguously first on critical path
- **Issues found & fixed**: 0
- **Remaining concerns**: Story 1.9 has "None" for dependencies but functionally needs ConnectorNodeLike type and handler registry for integration testing

### Step 6: Sprint Status Update

- **Status**: success
- **Duration**: ~15 seconds
- **What changed**: Modified `_bmad-output/implementation-artifacts/sprint-status.yaml` — epic-1 status changed from `backlog` to `in-progress`
- **Key decisions**: Targeted string replacement to preserve all existing content
- **Issues found & fixed**: 0
- **Remaining concerns**: None

### Step 7: Epic Test Design

- **Status**: success
- **Duration**: ~8 minutes
- **What changed**: Created `_bmad-output/planning-artifacts/test-design-epic-1.md` (573 lines)
- **Key decisions**: Consolidated 87 tests down to 71 by removing redundant tests; pipeline ordering gets 5 dedicated integration tests; all crypto tests use real libraries (no mocks)
- **Issues found & fixed**: 0
- **Remaining concerns**: ToonRoutingMeta interface should be finalized in Story 1.0 before Story 1.4 begins; shallow parser implementation strategy (string scanning vs partial TOON decode) needs decision

## Ready to Develop

- [x] All critical retro actions resolved (N/A — first epic)
- [x] Lint and tests green (N/A — first epic, baseline is 0)
- [x] Sprint status updated (epic-1: in-progress)
- [x] Story order established (5-phase plan with parallelization opportunities)

## Next Steps

First story to implement: **Story 1.0 — Extract TOON Codec to @toon-protocol/core**. This is the highest-priority story on the critical path. It introduces `ToonRoutingMeta` and the shallow parser, which 3 downstream stories (1.3, 1.4, 1.5) depend on. Stories 1.1, 1.2, 1.8, and 1.9 can be started in parallel if capacity allows.

**Preparation notes**: Existing TOON encoder/decoder in `@toon-protocol/bls` should be extracted (not duplicated). The test skeleton files in `packages/sdk/src/` should be validated against acceptance criteria when implementation begins.

---

## TL;DR

Epic 1 (ILP-Gated Service Node SDK) is ready to start. As the first epic, no previous retro cleanup was needed and the baseline is clean. The epic contains 12 well-sized stories (3-5 ACs each) with a clear 5-phase implementation plan. Story 1.0 (Extract TOON Codec) is the recommended first story, sitting on the critical path and blocking 3 downstream stories. A risk-based test plan with 71 tests has been created, with pipeline ordering identified as the highest-risk area (score 9).
