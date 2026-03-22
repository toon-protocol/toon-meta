# Story 7-4 Report

## Overview
- **Story file**: `_bmad-output/implementation-artifacts/7-4-fee-per-byte-advertisement-in-kind-10032.md`
- **Git start**: `e94a452`
- **Duration**: ~60 minutes pipeline wall-clock
- **Pipeline result**: success
- **Migrations**: None

## What Was Built
Added `feePerByte` field to the ILP peer info data model, enabling nodes to advertise their per-byte routing fee in kind:10032 Nostr events. The field flows through types (`IlpPeerInfo`), builders (with `INVALID_FEE` validation), parsers (with `'0'` default for backward compatibility), and SDK config (`NodeConfig.feePerByte` as `bigint`). This lays the groundwork for fee-aware route selection in Story 7.5.

## Acceptance Criteria Coverage
- [x] AC1: Node with `feePerByte: 2n` publishes kind:10032 with `feePerByte: '2'` — covered by: `builders.test.ts` (T-7.4-01, T-7.4-06), `create-node.test.ts` (T-7.4)
- [x] AC2: Node with no explicit fee publishes `feePerByte: '0'` (free routing) — covered by: `parsers.test.ts` (T-7.4-03, T-7.4-07), `create-node.test.ts` (T-7.4)
- [x] AC3: Pre-Epic-7 event (no feePerByte field) defaults to `'0'` — covered by: `parsers.test.ts` (T-7.4-07), `builders.test.ts` roundtrip
- [x] AC4: Invalid feePerByte throws `ToonError`/`INVALID_FEE` (builder) or `InvalidEventError` (parser) — covered by: `builders.test.ts` (5 tests), `parsers.test.ts` (7 tests)
- [x] AC5: Roundtrip integrity preserved — covered by: `builders.test.ts` (T-7.4-02, T-7.4-08)
- [x] AC6: Peer discovers feePerByte from kind:10032 — covered by: `builders.test.ts` (T-7.4-04)

## Files Changed
**packages/core/src/**
- `types.ts` (modified) — added `feePerByte?: string` to `IlpPeerInfo`
- `events/builders.ts` (modified) — added feePerByte validation + `@throws` JSDoc
- `events/parsers.ts` (modified) — added feePerByte extraction with `'0'` default
- `events/builders.test.ts` (modified) — added 11 feePerByte tests
- `events/parsers.test.ts` (modified) — added 10 feePerByte tests
- `discovery/NostrPeerDiscovery.test.ts` (modified) — updated expected output for `feePerByte: '0'`

**packages/sdk/src/**
- `create-node.ts` (modified) — added `feePerByte?: bigint` to `NodeConfig`
- `create-node.test.ts` (modified) — added 2 SDK config tests

**_bmad-output/**
- `implementation-artifacts/7-4-fee-per-byte-advertisement-in-kind-10032.md` (created) — story file
- `implementation-artifacts/sprint-status.yaml` (modified) — status updated to done
- `test-artifacts/nfr-assessment-7-4.md` (created) — NFR assessment

## Pipeline Steps

### Step 1: Story Create
- **Status**: success
- **Duration**: ~3 min
- **What changed**: Story file created
- **Key decisions**: `feePerByte` as `string` on `IlpPeerInfo` (BigInt-safe JSON), `bigint` on `NodeConfig`
- **Issues found & fixed**: 0

### Step 2: Story Validate
- **Status**: success
- **Duration**: ~5 min
- **What changed**: Story file updated (AC4 expanded, Testing Approach added)
- **Issues found & fixed**: 5 (AC4 incomplete, missing AC mappings on Tasks 3/6, Task 2.2 no-op, missing Testing Approach)

### Step 3: ATDD
- **Status**: success
- **Duration**: ~8 min
- **What changed**: Implementation + tests written (all 8 files)
- **Key decisions**: Parser always returns `feePerByte` (never undefined), defaults to `'0'`
- **Issues found & fixed**: 2 (pre-existing tests needed `feePerByte: '0'` in expected output)

### Step 4: Develop
- **Status**: success
- **Duration**: ~3 min
- **What changed**: Story file updated (status, Dev Agent Record)
- **Key decisions**: All code already implemented by ATDD step; verified correctness

### Step 5: Post-Dev Artifact Verify
- **Status**: success
- **Duration**: ~30s
- **Issues found & fixed**: 2 (status corrections: complete->review, backlog->review)

### Step 6: Frontend Polish
- **Status**: skipped
- **Reason**: Backend-only story, no UI changes

### Step 7: Post-Dev Lint & Typecheck
- **Status**: success
- **Duration**: ~3 min
- **Issues found & fixed**: 0 (0 errors, 1042 pre-existing warnings)

### Step 8: Post-Dev Test Verification
- **Status**: success
- **Duration**: ~3 min
- **Issues found & fixed**: 0 (2565 tests passed)

### Step 9: NFR
- **Status**: success
- **Duration**: ~3 min
- **What changed**: NFR assessment created
- **Key decisions**: Scored 22/29 (consistent with 7.1-7.3)

### Step 10: Test Automate
- **Status**: success
- **Duration**: ~5 min
- **What changed**: 6 new edge-case tests added (parsers + builders)
- **Issues found & fixed**: 1 gap (AC4 parser-level edge cases)

### Step 11: Test Review
- **Status**: success
- **Duration**: ~4 min
- **What changed**: Error message assertions added to 7 parser tests
- **Issues found & fixed**: 1 (inconsistent assertion style)

### Step 12: Code Review #1
- **Status**: success
- **Duration**: ~5 min
- **What changed**: Added `@throws` JSDoc for `INVALID_FEE`
- **Issues found & fixed**: 0 critical, 0 high, 0 medium, 1 low

### Step 13: Review #1 Artifact Verify
- **Status**: success
- **What changed**: Code Review Record added to story file

### Step 14: Code Review #2
- **Status**: success
- **Duration**: ~5 min
- **Issues found & fixed**: 0 critical, 0 high, 0 medium, 0 low

### Step 15: Review #2 Artifact Verify
- **Status**: success
- **What changed**: Review Pass #2 added to Code Review Record

### Step 16: Code Review #3
- **Status**: success
- **Duration**: ~3 min
- **Key decisions**: OWASP security review performed (injection, deserialization, prototype pollution, ReDoS)
- **Issues found & fixed**: 0 critical, 0 high, 0 medium, 0 low

### Step 17: Review #3 Artifact Verify
- **Status**: success
- **What changed**: Review Pass #3 added; status set to done

### Step 18: Security Scan (semgrep)
- **Status**: success
- **Duration**: ~3 min
- **Issues found & fixed**: 0 findings across 4 rulesets (auto, language-specific, audit, OWASP)

### Step 19: Regression Lint & Typecheck
- **Status**: success
- **Duration**: ~1 min
- **Issues found & fixed**: 0

### Step 20: Regression Test
- **Status**: success
- **Duration**: ~1 min
- **Issues found & fixed**: 0 (2571 tests passed)

### Step 21: E2E
- **Status**: skipped
- **Reason**: Backend-only story, no UI changes

### Step 22: Trace
- **Status**: success
- **Duration**: ~3 min
- **Uncovered ACs**: None — all 6 ACs fully covered

## Test Coverage
- **Test files**: `builders.test.ts`, `parsers.test.ts`, `create-node.test.ts`, `NostrPeerDiscovery.test.ts`
- **Story-specific tests**: 23 (exceeding estimate of ~15)
- **Coverage**: All 6 acceptance criteria covered, all 8 T-7.4-xx test plan IDs mapped
- **Test count**: post-dev 2565 -> regression 2571 (delta: +6)

## Code Review Findings

| Pass | Critical | High | Medium | Low | Total Found | Fixed | Remaining |
|------|----------|------|--------|-----|-------------|-------|-----------|
| #1   | 0        | 0    | 0      | 1   | 1           | 1     | 0         |
| #2   | 0        | 0    | 0      | 0   | 0           | 0     | 0         |
| #3   | 0        | 0    | 0      | 0   | 0           | 0     | 0         |

## Quality Gates
- **Frontend Polish**: skipped — backend-only story
- **NFR**: pass — scored 22/29, consistent with prior stories
- **Security Scan (semgrep)**: pass — 0 findings across 4 rulesets
- **E2E**: skipped — backend-only story
- **Traceability**: pass — all 6 ACs covered by 23 tests

## Known Risks & Gaps
- E7-R008 (fee advertisement vs actual fee consistency) — the advertised `feePerByte` must match the fee actually deducted by intermediary nodes. Enforcement validation is deferred to Story 7.5.
- SDK `createNode` tests verify config acceptance but do not directly assert `ilpInfo.feePerByte` value (indirectly validated by builder/parser roundtrip tests).

---

## TL;DR
Story 7.4 adds `feePerByte` advertisement to kind:10032 events, enabling nodes to declare their per-byte routing fee. The pipeline completed cleanly with all 22 steps passing (2 skipped as backend-only). 23 tests cover all 6 acceptance criteria. Three code review passes found only 1 low-severity JSDoc issue (fixed). Semgrep security scan clean. Test count increased from 2565 to 2571.
