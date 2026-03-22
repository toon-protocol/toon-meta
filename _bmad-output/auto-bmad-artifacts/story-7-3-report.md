# Story 7-3 Report

## Overview
- **Story file**: `_bmad-output/implementation-artifacts/7-3-multi-address-support-for-multi-peered-nodes.md`
- **Git start**: `35c1328da11f00c4b41b5de36e1b09f86ff3a238`
- **Duration**: ~90 minutes wall-clock
- **Pipeline result**: success
- **Migrations**: None

## What Was Built
Multi-address support for multi-peered nodes. Extended `IlpPeerInfo` with an `ilpAddresses` array (backward-compatible with singular `ilpAddress`), updated kind:10032 builder/parser to serialize and validate the array, created an `AddressRegistry` class for address lifecycle tracking, and added `addUpstreamPeer`/`removeUpstreamPeer` methods to `ServiceNode` for dynamic address management with collision detection.

## Acceptance Criteria Coverage
- [x] AC1: Multi-address kind:10032 event — covered by: `builders.test.ts`, `parsers.test.ts` (T-7.3-01, Tasks 7.1-7.8)
- [x] AC2: Client route selection — covered by: `parsers.test.ts` (T-7.3-03, T-7.3-05, Tasks 10.1-10.2)
- [x] AC3: Build/parse roundtrip integrity — covered by: `builders.test.ts`, `parsers.test.ts` (T-7.3-01, T-7.3-04, T-7.3-06, T-7.3-07, Tasks 7.3-7.10)
- [x] AC4: Address lifecycle on peer connect/disconnect — covered by: `address-registry.test.ts` (Tasks 9.1-9.6), `create-node.test.ts` (Task 6.3, 8.1-8.4). **Partial**: kind:10032 republication deferred until `BootstrapService.republish()` exists; self-route removal not isolation-tested.

## Files Changed

### `packages/core/src/`
- `types.ts` — modified (added `ilpAddresses?: string[]` to `IlpPeerInfo`)
- `events/builders.ts` — modified (empty array, invalid address validation; `ilpAddress` normalization)
- `events/parsers.ts` — modified (extract `ilpAddresses` with backward-compatible default)
- `address/address-registry.ts` — created (new `AddressRegistry` class with `hasPrefix`, `size` accessors)
- `address/index.ts` — modified (export `AddressRegistry`)
- `index.ts` — modified (export `AddressRegistry` from package root)

### `packages/sdk/src/`
- `create-node.ts` — modified (multi-address derivation, collision detection, self-route registration for all addresses, `addUpstreamPeer`/`removeUpstreamPeer` with last-address guard)

### `packages/core/src/` (tests)
- `events/builders.test.ts` — modified (8 new multi-address tests)
- `events/parsers.test.ts` — modified (7 new multi-address tests)
- `address/address-registry.test.ts` — created (8 tests)
- `discovery/NostrPeerDiscovery.test.ts` — modified (updated to expect `ilpAddresses`)

### `packages/sdk/src/` (tests)
- `create-node.test.ts` — modified (12 new tests: 4 config, 8 lifecycle)

### `_bmad-output/`
- `implementation-artifacts/7-3-multi-address-support-for-multi-peered-nodes.md` — created + modified
- `implementation-artifacts/sprint-status.yaml` — modified (7-3 → done)
- `test-artifacts/nfr-assessment-7-3.md` — created

## Pipeline Steps

### Step 1: Story Create
- **Status**: success
- **Duration**: ~3 min
- **What changed**: Story file created, sprint-status updated
- **Issues found & fixed**: 0

### Step 2: Story Validate
- **Status**: success
- **Duration**: ~5 min
- **What changed**: Story file rewritten with 11 issues fixed
- **Key decisions**: Introduced `AddressRegistry` as separate module; corrected error types (ToonError vs InvalidEventError)
- **Issues found & fixed**: 11 (incorrect terminology, missing tasks, underspecified validation, collision detection gap, route cleanup omission, numbering conflicts)

### Step 3: ATDD
- **Status**: success
- **Duration**: ~8 min
- **What changed**: 12 files (+660 lines), 24 failing tests written then implementation added to make them pass
- **Issues found & fixed**: 2 (existing tests needed `ilpAddresses` field in expected output)

### Step 4: Develop
- **Status**: success
- **Duration**: ~10 min
- **What changed**: `create-node.ts` (collision detection, AddressRegistry init, multi-address routes, addUpstreamPeer/removeUpstreamPeer)
- **Issues found & fixed**: 1 (BootstrapService lacks `republish()` — deferred with comment)

### Step 5: Post-Dev Artifact Verify
- **Status**: success
- **Duration**: ~1 min
- **Issues found & fixed**: 3 (status fields corrected to "review")

### Step 6: Frontend Polish
- **Status**: skipped (backend-only story)

### Step 7: Post-Dev Lint & Typecheck
- **Status**: success
- **Duration**: ~2 min
- **Issues found & fixed**: 0

### Step 8: Post-Dev Test Verification
- **Status**: success
- **Duration**: ~3 min
- **Issues found & fixed**: 0 (2,537 tests passing)

### Step 9: NFR
- **Status**: success
- **Duration**: ~5 min
- **What changed**: `nfr-assessment-7-3.md` created
- **Key decisions**: 6 PASS, 2 CONCERNS (structural — DR/QoE not applicable)

### Step 10: Test Automate
- **Status**: success
- **Duration**: ~5 min
- **What changed**: 6 new tests for `addUpstreamPeer`/`removeUpstreamPeer` in `create-node.test.ts`
- **Issues found & fixed**: 1 gap (AC #4 lifecycle methods had no coverage)

### Step 11: Test Review
- **Status**: success
- **Duration**: ~8 min
- **What changed**: 4 test files improved (fragile assertions fixed, boundary tests added, SDK tests strengthened)
- **Issues found & fixed**: 4 (fragile try/catch, weak assertions, missing boundary tests)

### Step 12: Code Review #1
- **Status**: success
- **Duration**: ~8 min
- **Issues found & fixed**: Critical: 0, High: 0, Medium: 0, Low: 0

### Step 13: Review #1 Artifact Verify
- **Status**: success
- **Issues found & fixed**: 1 (missing Code Review Record section added)

### Step 14: Code Review #2
- **Status**: success
- **Duration**: ~3 min
- **Issues found & fixed**: Critical: 0, High: 0, Medium: 0, Low: 0

### Step 15: Review #2 Artifact Verify
- **Status**: success
- **Issues found & fixed**: 0 (already correct)

### Step 16: Code Review #3
- **Status**: success
- **Duration**: ~8 min
- **Issues found & fixed**: Critical: 0, High: 0, Medium: 1 (last-address removal guard), Low: 1 (AddressRegistry accessors)

### Step 17: Review #3 Artifact Verify
- **Status**: success
- **Issues found & fixed**: 3 (status fields set to "done")

### Step 18: Security Scan (semgrep)
- **Status**: success
- **Duration**: ~3 min
- **Issues found & fixed**: 0 (219 rules, 0 findings)

### Step 19: Regression Lint & Typecheck
- **Status**: success
- **Duration**: ~2 min
- **Issues found & fixed**: 0

### Step 20: Regression Test
- **Status**: success
- **Duration**: ~1 min
- **Issues found & fixed**: 0 (2,548 tests passing)

### Step 21: E2E
- **Status**: skipped (backend-only story)

### Step 22: Trace
- **Status**: success
- **Duration**: ~3 min
- **Key decisions**: Partial gaps in AC #4 are acknowledged deferrals, not actionable gaps

## Test Coverage
- **Tests generated**: 35 new tests across 5 files (builders.test.ts, parsers.test.ts, address-registry.test.ts, create-node.test.ts, NostrPeerDiscovery.test.ts)
- **Coverage**: AC #1 fully covered, AC #2 fully covered, AC #3 fully covered, AC #4 covered at unit/interface level (republication and self-route removal deferred)
- **Gaps**: T-7.3-08 (live BTP disconnect), T-7.3-09 (multi-peered E2E) — deferred to cumulative E2E debt
- **Test count**: post-dev 2537 → regression 2548 (delta: +11)

## Code Review Findings

| Pass | Critical | High | Medium | Low | Total Found | Fixed | Remaining |
|------|----------|------|--------|-----|-------------|-------|-----------|
| #1   | 0        | 0    | 0      | 0   | 0           | 0     | 0         |
| #2   | 0        | 0    | 0      | 0   | 0           | 0     | 0         |
| #3   | 0        | 0    | 1      | 1   | 2           | 2     | 0         |

## Quality Gates
- **Frontend Polish**: skipped — backend-only story
- **NFR**: pass — 6 PASS, 2 CONCERNS (structural, not applicable)
- **Security Scan (semgrep)**: pass — 0 findings across 219 rules on 7 files
- **E2E**: skipped — backend-only story
- **Traceability**: pass — all ACs covered; AC #4 partial gaps are explicit deferrals

## Known Risks & Gaps
1. **kind:10032 republication deferred**: `addUpstreamPeer`/`removeUpstreamPeer` update in-memory state but do not trigger kind:10032 republication. Requires `BootstrapService.republish()` method (not yet implemented). Stories 7.5/7.7 may need this resolved.
2. **Self-route removal not isolation-tested**: `removeUpstreamPeer` calls `autoCreatedConnector.removeRoute` conditionally, but no test isolates this behavior.
3. **T-7.3-08 / T-7.3-09 deferred**: Live BTP peer disconnect lifecycle and multi-peered node E2E require Docker infrastructure.

---

## TL;DR
Story 7-3 implements multi-address support for multi-peered nodes: `IlpPeerInfo.ilpAddresses` array with backward-compatible builder/parser, `AddressRegistry` for lifecycle tracking, and `addUpstreamPeer`/`removeUpstreamPeer` on `ServiceNode` with collision detection and last-address guard. Pipeline passed cleanly with 35 new tests (+11 net), 3 code reviews (2 issues found and fixed in pass #3), zero security findings. Known deferrals: kind:10032 republication on lifecycle changes (awaits `BootstrapService.republish()`), 2 integration/E2E tests (require live BTP infrastructure).
