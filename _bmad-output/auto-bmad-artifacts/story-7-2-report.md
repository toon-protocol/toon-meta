# Story 7-2 Report

## Overview
- **Story file**: `_bmad-output/implementation-artifacts/7-2-btp-address-assignment-handshake.md`
- **Git start**: `78f119d1e9e0319fa072de1d92a22735187dee2a`
- **Duration**: ~90 minutes wall-clock
- **Pipeline result**: success
- **Migrations**: None

## What Was Built
BTP address assignment handshake for TOON nodes. Upstream peers communicate their ILP prefix during BTP handshake, and connecting nodes deterministically compute their own ILP address as `${upstreamPrefix}.${ownPubkey.slice(0, 8)}`. Replaces hardcoded `g.toon.local` default with pubkey-derived addressing. Includes fail-closed behavior on missing prefix, prefix spoofing detection, collision checking, and shared ILP address validation.

## Acceptance Criteria Coverage
- [x] AC1: Prefix communication in BTP handshake — covered by: `btp-prefix-exchange.test.ts`, `address-assignment.test.ts`, `create-node.test.ts`
- [x] AC2: kind:10032 uses derived address — covered by: `address-assignment.test.ts` (build+parse round-trip), `create-node.test.ts` (node.start success)
- [x] AC3: Backward compatibility and fail-closed behavior — covered by: `btp-prefix-exchange.test.ts` (6 fail-closed variants), `address-assignment.test.ts`, `create-node.test.ts` (3 priority tests)
- [x] AC4: Prefix spoofing detection — covered by: `btp-prefix-exchange.test.ts` (match, mismatch, deferred, empty)

## Files Changed

### `packages/core/src/address/` (new domain subdirectory files)
- `btp-prefix-exchange.ts` — **created**: BtpHandshakeExtension interface, extractPrefixFromHandshake, buildPrefixHandshakeData, validatePrefixConsistency, checkAddressCollision
- `address-assignment.ts` — **created**: assignAddressFromHandshake, isGenesisNode
- `ilp-address-validation.ts` — **created**: shared isValidIlpAddressStructure, validateIlpAddress (extracted from duplicated code in review #1)
- `btp-prefix-exchange.test.ts` — **created**: 25 tests
- `address-assignment.test.ts` — **created**: 10 tests
- `index.ts` — **modified**: barrel exports for all new symbols

### `packages/core/src/`
- `index.ts` — **modified**: re-exports shared validation functions

### `packages/core/src/address/`
- `derive-child-address.ts` — **modified**: uses shared validation instead of duplicated code

### `packages/sdk/src/`
- `create-node.ts` — **modified**: added `upstreamPrefix` to NodeConfig, 3-level address resolution priority, removed `g.toon.local` default
- `create-node.test.ts` — **modified**: 5 new Story 7.2 tests

### `docs/`
- `sdk-guide.md` — **modified**: updated ilpAddress default from `g.toon.local` to `derived from pubkey`

### `_bmad-output/`
- `implementation-artifacts/7-2-btp-address-assignment-handshake.md` — **created**: story file with full dev record and 3 code review entries
- `implementation-artifacts/sprint-status.yaml` — **modified**: 7-2 status → done
- `test-artifacts/nfr-assessment-7-2.md` — **created**: NFR assessment (22/29 ADR score)

## Pipeline Steps

### Step 1: Story Create
- **Status**: success
- **Duration**: ~8 min
- **What changed**: Story file created, sprint-status updated
- **Key decisions**: Prefix exchange uses structural typing (not BTP wire protocol modification)
- **Issues found & fixed**: 0

### Step 2: Story Validate
- **Status**: success
- **Duration**: ~5 min
- **What changed**: Story file refined
- **Key decisions**: Split overloaded AC#1 into 4 focused ACs
- **Issues found & fixed**: 7 (AC split, missing test coverage mapping, missing guardrail, deferred test tracking, corrective action, stale references, test count)

### Step 3: ATDD
- **Status**: success
- **Duration**: ~8 min
- **What changed**: 2 new test files + 2 new source files created, SDK modified
- **Key decisions**: Address resolution priority: upstreamPrefix > explicit ilpAddress > deriveChildAddress(ROOT, pubkey)
- **Issues found & fixed**: 2 (TypeScript strict index, unused imports)

### Step 4: Develop
- **Status**: success
- **Duration**: ~5 min
- **What changed**: Story file updated (all implementation was done in ATDD step)
- **Issues found & fixed**: 0

### Step 5: Post-Dev Artifact Verify
- **Status**: success
- **Duration**: ~30s
- **What changed**: Status corrected to "review" in story file and sprint-status
- **Issues found & fixed**: 2 (status values)

### Step 6: Frontend Polish
- **Status**: skipped
- **Reason**: No UI impact — backend/protocol-only story

### Step 7: Post-Dev Lint & Typecheck
- **Status**: success
- **Duration**: ~3 min
- **What changed**: Nothing — already clean
- **Issues found & fixed**: 0

### Step 8: Post-Dev Test
- **Status**: success
- **Duration**: ~2 min
- **What changed**: Nothing — all 2577 tests passing
- **Issues found & fixed**: 0

### Step 9: NFR
- **Status**: success
- **Duration**: ~4 min
- **What changed**: NFR assessment created
- **Key decisions**: Scored 22/29 ADR; noted minor code duplication acceptable
- **Issues found & fixed**: 0

### Step 10: Test Automate
- **Status**: success
- **Duration**: ~5 min
- **What changed**: +8 tests (edge cases, round-trip, kind:10032 integration)
- **Issues found & fixed**: 0 bugs; 8 coverage gaps filled

### Step 11: Test Review
- **Status**: success
- **Duration**: ~5 min
- **What changed**: +5 tests (export verification, edge cases, multi-peer collision)
- **Issues found & fixed**: 4 (missing export test, missing edge cases)

### Step 12: Code Review #1
- **Status**: success
- **Duration**: ~8 min
- **What changed**: Extracted shared ilp-address-validation.ts, added input validation to buildPrefixHandshakeData
- **Issues found & fixed**: 1 medium (duplicated validation), 3 low (misleading comment, missing input validation, exports)

### Step 13: Review #1 Artifact Verify
- **Status**: success
- **Duration**: ~1 min
- **What changed**: Review record formatting
- **Issues found & fixed**: 0

### Step 14: Code Review #2
- **Status**: success
- **Duration**: ~5 min
- **What changed**: Exported shared validation from main package index, updated docs
- **Issues found & fixed**: 1 medium (incomplete export chain), 2 low (stale docs, SDK test gap noted)

### Step 15: Review #2 Artifact Verify
- **Status**: success
- **Duration**: ~1 min
- **What changed**: Nothing — already correct
- **Issues found & fixed**: 0

### Step 16: Code Review #3
- **Status**: success
- **Duration**: ~8 min
- **What changed**: Added MAX_PREFIX_LENGTH/MAX_ILP_ADDRESS_LENGTH bounds, +2 tests
- **Issues found & fixed**: 1 medium (no input length bound), 2 low (noted, not fixed)

### Step 17: Review #3 Artifact Verify
- **Status**: success
- **Duration**: ~1 min
- **What changed**: Status set to "done" in story file and sprint-status
- **Issues found & fixed**: 2 (status values)

### Step 18: Security Scan (Semgrep)
- **Status**: success
- **Duration**: ~1 min
- **What changed**: Nothing — 0 findings across 383 rules
- **Issues found & fixed**: 0

### Step 19: Regression Lint & Typecheck
- **Status**: success
- **Duration**: ~3 min
- **What changed**: Nothing — clean
- **Issues found & fixed**: 0

### Step 20: Regression Test
- **Status**: success
- **Duration**: ~3 min
- **What changed**: Nothing — all tests passing
- **Issues found & fixed**: 0

### Step 21: E2E
- **Status**: skipped
- **Reason**: No UI impact — backend-only story

### Step 22: Trace
- **Status**: success
- **Duration**: ~3 min
- **What changed**: Nothing (read-only analysis)
- **Issues found & fixed**: 0 — all 4 ACs fully covered

## Test Coverage
- **Test files**: `btp-prefix-exchange.test.ts` (25 tests), `address-assignment.test.ts` (10 tests), `create-node.test.ts` (+5 Story 7.2 tests)
- **Total Story 7.2 tests**: ~40
- **All 4 acceptance criteria fully covered**
- **Deferred**: T-7.2-10 (requires Story 7.7), T-7.2-11 (E2E with Docker BTP peers)
- **Test count**: post-dev 2577 → regression 2593 (delta: +16)

## Code Review Findings

| Pass | Critical | High | Medium | Low | Total Found | Fixed | Remaining |
|------|----------|------|--------|-----|-------------|-------|-----------|
| #1   | 0        | 0    | 1      | 3   | 4           | 4     | 0         |
| #2   | 0        | 0    | 1      | 2   | 3           | 2     | 1 (noted) |
| #3   | 0        | 0    | 1      | 2   | 3           | 1     | 2 (noted) |

## Quality Gates
- **Frontend Polish**: skipped — backend-only story
- **NFR**: pass — 22/29 ADR score, all risks mitigated
- **Security Scan (semgrep)**: pass — 0 findings across 383 rules (OWASP, security-audit, secrets, command-injection, JS/TS/Node)
- **E2E**: skipped — backend-only story
- **Traceability**: pass — all 4 ACs fully covered, 0 gaps

## Known Risks & Gaps
- SDK `ToonNode` does not expose `ilpAddress` as a public property, limiting SDK-level test assertions to indirect verification (node.start() success). Core-level tests verify address correctness directly.
- `g.toon.local` remnants in `swarm-coordinator.ts` and `workflow-orchestrator.ts` are fallback routing destinations (not node addresses) — out of scope for this story.
- T-7.2-10 (upstream prefix change after vanity claim) deferred to Story 7.7.
- T-7.2-11 (E2E with two live BTP-peered Docker nodes) deferred to cumulative E2E debt.

---

## TL;DR
Story 7-2 implements the BTP address assignment handshake: upstream peers communicate their ILP prefix during BTP handshake, and connecting nodes derive their address as `${prefix}.${pubkey.slice(0,8)}`. The pipeline completed cleanly with all 22 steps passing (2 skipped as backend-only), 3 code reviews converging to 0 critical/high issues, semgrep clean, and all 4 acceptance criteria fully covered by ~40 tests. Test count increased from 2577 to 2593 with no regressions.
