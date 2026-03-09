---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-06'
workflowType: 'testarch-atdd'
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/test-artifacts/test-design-epic-4.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
---

# ATDD Checklist - Epic 4: Marlin TEE Deployment

**Date:** 2026-03-06
**Author:** Jonathan
**Primary Test Level:** Unit (with Integration and Build tests)

---

## Epic Summary

From repository to one-command service deployment on Marlin Oyster — starting with the relay as reference implementation. Packages the Crosstown Docker image for Oyster CVM, adds TEE attestation (kind:10033), implements attestation-aware peering, integrates Nautilus KMS for persistent enclave-bound identity, and establishes Nix reproducible builds for deterministic PCR values.

**Stories:** 4.1-4.6 (6 stories, 34 test cases from test design)
**Risk Profile:** 4 high-priority risks (Score >=6), all SEC/TECH category

---

## Test Strategy

### Stack & Mode

- **Detected Stack:** Backend (TypeScript/Node.js monorepo, Vitest)
- **Generation Mode:** AI Generation (no browser recording needed)

### Test Level Distribution

| Level | Count | Scope |
|-------|-------|-------|
| **Unit** | 25 | Pure functions, business logic, adversarial inputs, config validation |
| **Integration** | 4 | Bootstrap flow, peer ordering, startup ordering, channel + attestation |
| **Build** | 3 | Nix reproducibility (image hash, PCR values, CI verification) |
| **E2E** | 1 | Full CVM deployment (all processes healthy) |
| **Static Analysis** | 1 | Dockerfile.nix determinism check |
| **Total** | **34** | |

### Priority Distribution

| Priority | Count | Criteria |
|----------|-------|----------|
| **P0** | 14 | Blocks core trust model, high risk (>=6), no workaround |
| **P1** | 16 | Critical paths, medium risk, common workflows |
| **P2** | 4 | Edge cases, low risk |

### All Test Files (RED Phase Complete)

| File | Test IDs | Vitest Skipped | Status |
|------|----------|---------------|--------|
| `packages/core/src/events/attestation.test.ts` | T-4.2-01 to T-4.2-07 | 8 | RED |
| `packages/core/src/bootstrap/AttestationVerifier.test.ts` | T-4.3-01 to T-4.3-07, T-RISK-01 | 11 | RED |
| `packages/core/src/bootstrap/attestation-bootstrap.test.ts` | T-4.6-01 to T-4.6-05, T-4.1-01 to T-4.1-04, T-RISK-02 | 10 | RED |
| `packages/core/src/identity/kms-identity.test.ts` | T-4.4-01 to T-4.4-05 | 5 | RED |
| `packages/core/src/build/nix-reproducibility.test.ts` | T-4.5-01 to T-4.5-04 | 19 | RED |
| **Primary Total** | **34 test design IDs** | **53** | **All RED** |
| `packages/core/src/build/reproducibility.test.ts` *(alt)* | T-4.5-01 to T-4.5-04 | 22 | RED |
| **Grand Total** | **34 unique IDs** | **75** | **All RED** |

> **Note on duplicate Story 4.5 files:** `nix-reproducibility.test.ts` (class-based API: `NixBuilder`, `verifyPcrReproducibility`) and `reproducibility.test.ts` (function-based API: `computePcr`, `comparePcrs`, `validateDockerfileDeterminism`) were created in separate sessions with different API designs. The dev team should choose one approach during green phase and delete the other. `nix-reproducibility.test.ts` is the primary/canonical file from this ATDD run.

---

## Acceptance Criteria Coverage

### Story 4.1: Oyster CVM Packaging (FR-TEE-1)

| AC | Test ID | Level | Priority |
|----|---------|-------|----------|
| docker-compose-oyster.yml correct services/ports/images | T-4.1-01 | Unit | P1 |
| supervisord.conf correct priorities (relay=10, connector=20, attestation=30) | T-4.1-02 | Unit | P1 |
| Relay ready before attestation publishes | T-4.1-03 | Integration | P2 |
| All 3 processes running and healthy | T-4.1-04 | E2E | P1 |

### Story 4.2: TEE Attestation Events (FR-TEE-2)

| AC | Test ID | Level | Priority |
|----|---------|-------|----------|
| kind:10033 event correct JSON structure (Pattern 14) | T-4.2-01 | Unit | P0 |
| Required tags: relay, chain, expiry | T-4.2-02 | Unit | P0 |
| Content is JSON.stringify(), not plain string | T-4.2-03 | Unit | P0 |
| Publishes kind:10033 on startup | T-4.2-04 | Unit | P1 |
| Refreshes kind:10033 on interval | T-4.2-05 | Unit | P1 |
| /health tee field only when in TEE | T-4.2-06 | Unit | P1 |
| Forged attestation document rejected | T-4.2-07 | Unit | P0 |

### Story 4.3: Attestation-Aware Peering (FR-TEE-3)

| AC | Test ID | Level | Priority |
|----|---------|-------|----------|
| Parse kind:10033 — extract PCR values and attestation doc | T-4.3-01 | Unit | P0 |
| PCR values match known-good registry — accepted | T-4.3-02 | Unit | P0 |
| Mismatched PCR values — rejected | T-4.3-03 | Unit | P0 |
| Prefer TEE-attested relays over non-attested | T-4.3-04 | Unit | P1 |
| State transitions: valid -> stale -> unattested | T-4.3-05 | Unit | P1 |
| 30s grace window boundary values | T-4.3-06 | Unit | P2 |
| Mixed attested/non-attested peers — attested first | T-4.3-07 | Integration | P1 |

### Story 4.4: Nautilus KMS Identity (FR-TEE-4)

| AC | Test ID | Level | Priority |
|----|---------|-------|----------|
| KMS keypair valid Schnorr signatures (nostr-tools) | T-4.4-01 | Unit | P0 |
| NIP-06 derivation path (m/44'/1237'/0'/0/0) | T-4.4-02 | Unit | P0 |
| Same seed = same pubkey across invocations | T-4.4-03 | Unit | P1 |
| KMS identity signs kind:10033 self-attestation | T-4.4-04 | Unit | P1 |
| KMS unavailable — clear error, no random key fallback | T-4.4-05 | Unit | P2 |

### Story 4.5: Nix Reproducible Builds (FR-TEE-5)

| AC | Test ID | Level | Priority |
|----|---------|-------|----------|
| Identical Docker image hash across builds | T-4.5-01 | Build | P0 |
| Identical PCR values across builds | T-4.5-02 | Build | P0 |
| Dockerfile.nix no non-deterministic steps | T-4.5-03 | Unit | P1 |
| CI pipeline verifies PCR reproducibility | T-4.5-04 | Build | P1 |

### Story 4.6: Attestation-First Seed Relay Bootstrap (FR-TEE-6)

| AC | Test ID | Level | Priority |
|----|---------|-------|----------|
| Verify kind:10033 before trusting peer list | T-4.6-01 | Unit | P0 |
| Invalid attestation — fallback to next seed | T-4.6-02 | Unit | P0 |
| Valid attestation — proceed to kind:10032 | T-4.6-03 | Unit | P1 |
| All unattested — degraded mode, no crash | T-4.6-04 | Unit | P1 |
| Full bootstrap flow (10036 -> connect -> 10033 -> 10032) | T-4.6-05 | Integration | P1 |

### Cross-Cutting Risk Tests

| AC | Test ID | Level | Priority |
|----|---------|-------|----------|
| Dual-channel consistency (kind:10033 = /health tee) | T-RISK-01 | Unit | P0 |
| Payment channels survive attestation degradation | T-RISK-02 | Integration | P2 |

---

## Failing Tests Created (RED Phase)

### Unit Tests (34 tests across 4 files)

**File:** `packages/core/src/events/attestation.test.ts` (219 lines)

- `it.skip` **T-4.2-01:** kind:10033 event builder correct JSON structure
  - **Status:** RED — `buildAttestationEvent` module does not exist
  - **Verifies:** Pattern 14 compliance (enclave, pcr0-2, attestationDoc, version)

- `it.skip` **T-4.2-02:** Required tags (relay, chain, expiry)
  - **Status:** RED — `buildAttestationEvent` module does not exist
  - **Verifies:** Tag structure per Pattern 14

- `it.skip` **T-4.2-03:** Content is valid JSON (not plain string)
  - **Status:** RED — `buildAttestationEvent` module does not exist
  - **Verifies:** Architecture rule 11 enforcement

- `it.skip` **T-4.2-04:** Publishes kind:10033 on startup
  - **Status:** RED — AttestationServer module does not exist
  - **Verifies:** Attestation lifecycle (Decision 12)

- `it.skip` **T-4.2-05:** Refreshes kind:10033 on interval
  - **Status:** RED — AttestationServer module does not exist
  - **Verifies:** Attestation refresh cycle

- `it.skip` **T-4.2-06:** /health tee field conditional on TEE (2 cases)
  - **Status:** RED — health endpoint logic does not exist
  - **Verifies:** Enforcement guideline 12

- `it.skip` **T-4.2-07:** Forged attestation document rejected
  - **Status:** RED — `parseAttestation` module does not exist
  - **Verifies:** Adversarial input handling (R-E4-001)

**File:** `packages/core/src/bootstrap/AttestationVerifier.test.ts` (430 lines)

- `it.skip` **T-4.3-01:** Parse kind:10033 — extract PCR values
  - **Status:** RED — `AttestationVerifier` class does not exist
  - **Verifies:** Event parsing correctness

- `it.skip` **T-4.3-02:** PCR match known-good registry — accepted
  - **Status:** RED — `AttestationVerifier` class does not exist
  - **Verifies:** Happy path verification (R-E4-001)

- `it.skip` **T-4.3-03:** PCR mismatch — rejected
  - **Status:** RED — `AttestationVerifier` class does not exist
  - **Verifies:** Adversarial: tampered PCR (R-E4-001)

- `it.skip` **T-4.3-04:** Attested peers ranked higher
  - **Status:** RED — `rankPeers` method does not exist
  - **Verifies:** Peer selection priority

- `it.skip` **T-4.3-05:** State transitions (valid -> stale -> unattested, 3 sub-tests)
  - **Status:** RED — `AttestationState` enum does not exist
  - **Verifies:** State machine correctness (R-E4-005)

- `it.skip` **T-4.3-06:** 30s grace boundary values (2 sub-tests)
  - **Status:** RED — `AttestationState` enum does not exist
  - **Verifies:** Boundary condition testing

- `it.skip` **T-4.3-07:** Mixed peer ordering (attested first)
  - **Status:** RED — `rankPeers` method does not exist
  - **Verifies:** Bootstrap peer selection with mixed attestation

- `it.skip` **T-RISK-01:** Dual-channel consistency
  - **Status:** RED — `AttestationVerifier` does not exist
  - **Verifies:** Single source of truth for attestation state

**File:** `packages/core/src/identity/kms-identity.test.ts` (154 lines)

- `it.skip` **T-4.4-01:** KMS keypair valid Schnorr signatures
  - **Status:** RED — `deriveFromKmsSeed` module does not exist
  - **Verifies:** Cross-library compatibility (R-E4-003)

- `it.skip` **T-4.4-02:** NIP-06 derivation path
  - **Status:** RED — `deriveFromKmsSeed` module does not exist
  - **Verifies:** BIP-39/BIP-32/NIP-06 compatibility

- `it.skip` **T-4.4-03:** Same seed = same pubkey
  - **Status:** RED — `deriveFromKmsSeed` module does not exist
  - **Verifies:** Key persistence across invocations

- `it.skip` **T-4.4-04:** KMS identity signs kind:10033
  - **Status:** RED — Both `deriveFromKmsSeed` and `buildAttestationEvent` do not exist
  - **Verifies:** Identity-attestation binding

- `it.skip` **T-4.4-05:** KMS unavailable — clear error
  - **Status:** RED — `KmsIdentityError` does not exist
  - **Verifies:** No silent fallback to random key

### Build/CI Tests (19 tests in 1 file)

**File:** `packages/core/src/build/nix-reproducibility.test.ts`

- `it.skip` **T-4.5-01:** Identical image hash (3 sub-tests: hash comparison, store path, result structure)
  - **Status:** RED — `NixBuilder` class does not exist
  - **Verifies:** Nix determinism (R-E4-002)

- `it.skip` **T-4.5-02:** Identical PCR values (3 sub-tests: pcr0 match, all-3 match, source change diverges)
  - **Status:** RED — `NixBuilder` class does not exist
  - **Verifies:** PCR reproducibility (R-E4-002)

- `it.skip` **T-4.5-03:** No non-deterministic Dockerfile steps (8 sub-tests: exists, anti-patterns, validation)
  - **Status:** RED — `analyzeDockerfileForNonDeterminism` does not exist
  - **Verifies:** Dockerfile.nix correctness

- `it.skip` **T-4.5-04:** CI PCR reproducibility (5 sub-tests: success, failure, error type, summary, e2e)
  - **Status:** RED — `verifyPcrReproducibility` does not exist
  - **Verifies:** CI integration (R-E4-006)

### Integration/E2E Tests (10 tests in 1 file)

**File:** `packages/core/src/bootstrap/attestation-bootstrap.test.ts` (600 lines)

- `it.skip` **T-4.6-01:** Verify kind:10033 before trusting peer list
  - **Status:** RED — `AttestationBootstrap` class does not exist
  - **Verifies:** Attestation-first gate (R-E4-004)

- `it.skip` **T-4.6-02:** Invalid attestation — fallback to next seed
  - **Status:** RED — `AttestationBootstrap` class does not exist
  - **Verifies:** Graceful degradation (R-E4-004)

- `it.skip` **T-4.6-03:** Valid attestation — proceed to kind:10032
  - **Status:** RED — `AttestationBootstrap` class does not exist
  - **Verifies:** Happy path bootstrap

- `it.skip` **T-4.6-04:** All unattested — degraded mode
  - **Status:** RED — `AttestationBootstrap` class does not exist
  - **Verifies:** Graceful degradation

- `it.skip` **T-4.6-05:** Full bootstrap flow
  - **Status:** RED — `AttestationBootstrap` class does not exist
  - **Verifies:** End-to-end bootstrap (R-E4-004)

- `it.skip` **T-4.1-01 to T-4.1-04, T-RISK-02:** CVM packaging and cross-cutting
  - **Status:** RED — Config files and modules do not exist
  - **Verifies:** Deployment config, startup ordering, channel resilience

---

## Data Factories Created

### TeeAttestation Factory

**File:** `packages/core/src/events/attestation.test.ts` (inline)

**Exports:**

- `createTestAttestation()` — Creates a test TeeAttestation with valid PCR values

### AttestationVerifier Factories

**File:** `packages/core/src/bootstrap/AttestationVerifier.test.ts` (inline)

**Exports:**

- `createKnownGoodRegistry()` — Creates a Map of known-good PCR hashes
- `createTestAttestation(overrides?)` — Creates test attestation with optional overrides
- `createAttestationEvent(pubkey, attestation?, createdAt?)` — Creates mock kind:10033 event
- `createPeerDescriptor(pubkey, attested, timestamp?)` — Creates peer for ranking tests

### AttestationBootstrap Factories

**File:** `packages/core/src/bootstrap/attestation-bootstrap.test.ts` (inline)

**Exports:**

- `createSeedRelayList()` — Creates seed relay WebSocket URLs
- `createValidAttestationEvent()` — Creates valid kind:10033 event
- `createExpiredAttestationEvent()` — Creates expired attestation
- `createPeerInfoEvent(pubkey)` — Creates kind:10032 peer info event
- `createMockVerifier(state)` — Creates mock AttestationVerifier

### NixBuilder Factories

**File:** `packages/core/src/build/nix-reproducibility.test.ts` (inline)

**Exports:**

- `createNixBuildResult(overrides?)` — Creates test NixBuildResult
- `createBuildPair()` — Creates two identical build results for comparison

### Reproducibility Factories (alt)

**File:** `packages/core/src/build/reproducibility.test.ts` (inline)

**Exports:**

- `createDeterministicDockerfile()` — Creates clean Dockerfile with no anti-patterns
- `createNonDeterministicDockerfile()` — Creates Dockerfile with anti-patterns
- `createPcrResult(pcr0)` — Creates PCR result object for comparison tests

---

## Mock Requirements

### AttestationVerifier Mock

- `verify(event)` — Returns boolean (valid/invalid attestation)
- `getState()` — Returns 'valid' | 'invalid' | 'missing' | 'expired'

### Relay Query Mock

- `queryAttestation(relayUrl)` — Returns kind:10033 event or null
- `subscribePeers(relayUrl)` — Returns kind:10032 events array

### Channel Client Mock

- `getChannelState(channelId)` — Returns channel status object
- `openChannel()` — Mock for channel operations

---

## Implementation Checklist

### Story 4.2: TEE Attestation Events

**Modules to create:**

- [ ] `packages/core/src/events/attestation.ts` — `buildAttestationEvent()`, `parseAttestation()`
- [ ] `packages/core/src/constants.ts` — Add `TEE_ATTESTATION_KIND = 10033`
- [ ] `packages/core/src/types.ts` — Add `TeeAttestation` interface
- [ ] Run: `cd packages/core && pnpm test -- src/events/attestation.test.ts`
- [ ] Remove `it.skip()`, uncomment imports, and verify GREEN

### Story 4.3: Attestation-Aware Peering

**Modules to create:**

- [ ] `packages/core/src/bootstrap/AttestationVerifier.ts` — `AttestationVerifier` class, `AttestationState` enum
- [ ] Wire `parseAttestation` from Story 4.2
- [ ] Add `rankPeers()` method to `AttestationVerifier`
- [ ] Add `getAttestationState()` with validity + grace period logic
- [ ] Run: `cd packages/core && pnpm test -- src/bootstrap/AttestationVerifier.test.ts`
- [ ] Remove `it.skip()`, uncomment imports, and verify GREEN

### Story 4.4: Nautilus KMS Identity

**Modules to create:**

- [ ] `packages/core/src/identity/kms-identity.ts` — `deriveFromKmsSeed()`, `KmsIdentityError`
- [ ] Implement NIP-06 derivation path (m/44'/1237'/0'/0/0)
- [ ] Dependencies: `@scure/bip39`, `@scure/bip32`
- [ ] Run: `cd packages/core && pnpm test -- src/identity/kms-identity.test.ts`
- [ ] Remove `it.skip()`, uncomment imports, and verify GREEN

### Story 4.5: Nix Reproducible Builds

**Decision required:** Choose between class-based API (`nix-reproducibility.test.ts`) or function-based API (`reproducibility.test.ts`). Delete the unchosen file.

**Modules to create (class-based, primary):**

- [ ] `packages/core/src/build/nix-builder.ts` — `NixBuilder` class, `NixBuildResult` type
- [ ] `packages/core/src/build/pcr-validator.ts` — `verifyPcrReproducibility()`, `analyzeDockerfileForNonDeterminism()`
- [ ] `docker/Dockerfile.nix` — Nix-based reproducible Docker build
- [ ] Run: `cd packages/core && pnpm test -- src/build/nix-reproducibility.test.ts`
- [ ] Remove `it.skip()`, uncomment imports, and verify GREEN
- [ ] Delete `reproducibility.test.ts` if class-based API chosen

**Modules to create (function-based, alternative):**

- [ ] `packages/core/src/build/reproducibility.ts` — `computePcr()`, `comparePcrs()`, `PcrMismatchError`
- [ ] `packages/core/src/build/dockerfile-validator.ts` — `validateDockerfileDeterminism()`
- [ ] Run: `cd packages/core && pnpm test -- src/build/reproducibility.test.ts`
- [ ] Remove `it.skip()`, uncomment imports, and verify GREEN
- [ ] Delete `nix-reproducibility.test.ts` if function-based API chosen

### Story 4.6: Attestation-First Bootstrap

**Modules to create:**

- [ ] `packages/core/src/bootstrap/AttestationBootstrap.ts` — `AttestationBootstrap` class
- [ ] Wire `AttestationVerifier` from Story 4.3
- [ ] Implement seed relay fallback logic
- [ ] Implement degraded mode for all-unattested scenario
- [ ] Run: `cd packages/core && pnpm test -- src/bootstrap/attestation-bootstrap.test.ts`
- [ ] Remove `it.skip()`, uncomment imports, and verify GREEN

### Story 4.1: Oyster CVM Packaging

**Config files to create:**

- [ ] `docker/docker-compose-oyster.yml` — Oyster CVM deployment manifest
- [ ] `docker/supervisord.conf` — Multi-process orchestrator (relay=10, connector=20, attestation=30)
- [ ] Run: `cd packages/core && pnpm test -- src/bootstrap/attestation-bootstrap.test.ts`
- [ ] Remove `it.skip()`, uncomment imports, and verify GREEN

---

## Running Tests

```bash
# Run all failing tests for this epic (all 6 files)
cd packages/core && pnpm test -- src/events/attestation.test.ts src/bootstrap/AttestationVerifier.test.ts src/bootstrap/attestation-bootstrap.test.ts src/identity/kms-identity.test.ts src/build/nix-reproducibility.test.ts src/build/reproducibility.test.ts

# Run specific test file
cd packages/core && pnpm test -- src/events/attestation.test.ts
cd packages/core && pnpm test -- src/bootstrap/AttestationVerifier.test.ts
cd packages/core && pnpm test -- src/bootstrap/attestation-bootstrap.test.ts
cd packages/core && pnpm test -- src/identity/kms-identity.test.ts
cd packages/core && pnpm test -- src/build/nix-reproducibility.test.ts
cd packages/core && pnpm test -- src/build/reproducibility.test.ts   # alt Story 4.5

# Run tests matching a specific test ID
cd packages/core && pnpm test -- -t "T-4.2-01"

# Run full project suite (verifies no regressions)
cd packages/core && pnpm test
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- 53 `it.skip()` tests written across 5 primary files (75 including alt file)
- All 34 test design IDs covered
- Factories created with sensible defaults
- Mock requirements documented
- Implementation checklist created

**Verification (actual test run):**

- All tests use `it.skip()` — no non-skipped tests
- All 6 test files load successfully (imports commented out for non-existent modules)
- Vitest reports: 6 files skipped, 75 tests skipped, 0 failed
- Full project suite: 24 passed, 10 skipped, 536 passing tests — no regressions
- 2 placeholder assertions in T-4.2-06 (acceptable — in skipped tests, need replacement in green phase)

---

### GREEN Phase (DEV Team - Next Steps)

**Implementation Order (recommended):**

1. **Story 4.2** first — creates the `buildAttestationEvent` and `parseAttestation` that Stories 4.3, 4.4, 4.6 depend on
2. **Story 4.3** second — creates `AttestationVerifier` used by Story 4.6
3. **Story 4.4** third — creates KMS identity (independent of 4.3 but uses 4.2)
4. **Story 4.1** fourth — config files (independent)
5. **Story 4.5** fifth — Nix builds (independent, requires Nix tooling)
6. **Story 4.6** last — integrates 4.2, 4.3, and 4.4

---

## Next Steps

1. **Review this checklist** with team
2. **Run all test files** to confirm RED phase: `cd packages/core && pnpm test`
3. **Begin implementation** following the implementation checklist order
4. **Work one test at a time** (red -> green for each)
5. **When all tests pass**, refactor code for quality

---

## Knowledge Base References Applied

- **data-factories.md** — Factory patterns for test data generation
- **test-quality.md** — Test design principles (Given-When-Then, AAA, determinism)
- **test-healing-patterns.md** — Test stability and resilience patterns
- **test-levels-framework.md** — Test level selection (Unit/Integration/Build/E2E)
- **test-priorities-matrix.md** — P0-P3 prioritization criteria

---

## Test Execution Evidence

### RED Phase Verification (Actual Run — 2026-03-06)

**Command:** `npx vitest run src/events/attestation.test.ts src/bootstrap/AttestationVerifier.test.ts src/bootstrap/attestation-bootstrap.test.ts src/identity/kms-identity.test.ts src/build/nix-reproducibility.test.ts src/build/reproducibility.test.ts`

**Results:**

```
Test Files  6 skipped (6)
     Tests  75 skipped (75)
  Duration  290ms
```

**Per-file breakdown:**

| File | Skipped |
|------|---------|
| `attestation.test.ts` | 8 |
| `AttestationVerifier.test.ts` | 11 |
| `attestation-bootstrap.test.ts` | 10 |
| `kms-identity.test.ts` | 5 |
| `nix-reproducibility.test.ts` | 19 |
| `reproducibility.test.ts` | 22 |

**Full suite regression check:**

```
Test Files  24 passed | 10 skipped (34)
     Tests  536 passed | 97 skipped (633)
  Duration  3.76s
```

Status: RED phase verified — all Epic 4 tests skip, no regressions

---

## Validation Fixes (Step 5)

During validation, the following issues were found and fixed:

1. **Non-loadable test files:** 5 of 6 test files had uncommented imports from non-existent modules, causing Vitest suite-level failures. Fixed by commenting out all non-existent module imports with `// Uncomment when implementing the green phase:` markers. Now all 6 files load and skip cleanly.

2. **Duplicate Story 4.5 files:** Discovered `reproducibility.test.ts` (pre-existing, function-based API) alongside `nix-reproducibility.test.ts` (ATDD-generated, class-based API). Both fixed to load. Dev team must choose one during green phase.

3. **Test count correction:** Original checklist claimed 56 `it.skip()` calls. Actual Vitest-recognized test count is 53 (primary files) / 75 (including alt). The discrepancy of 3 was from grep matching `it.skip()` in TDD RED PHASE comment headers, not actual test definitions.

---

## Notes

- T-4.2-06 has 2 placeholder `expect(true).toBe(false)` lines that need replacing with real health response assertions when the health module is implemented
- T-4.5 tests (Nix builds) require Nix package manager installed — may need to be deferred to CI
- T-4.1-04 (CVM E2E) requires Oyster testnet access — deferred to integration phase
- Some test design IDs expand into multiple `it.skip()` sub-tests for thorough scenario coverage
- All imports from non-existent modules are commented out; uncomment them as each module is implemented

---

**Generated by BMad TEA Agent** - 2026-03-06
