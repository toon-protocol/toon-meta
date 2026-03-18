---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-strategy',
    'step-04-generate-tests',
    'step-05-validate-and-complete',
  ]
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-13'
workflowType: 'testarch-atdd'
inputDocuments:
  - _bmad-output/implementation-artifacts/3-2-multi-environment-chain-configuration.md
  - _bmad-output/test-artifacts/test-design-epic-3.md
  - _bmad-output/test-artifacts/atdd-checklist-epic-3.md
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - _bmad/tea/config.yaml
  - packages/core/src/chain/chain-config.test.ts
  - packages/core/src/chain/usdc.ts
  - packages/core/src/errors.ts
  - packages/core/vitest.config.ts
---

# ATDD Checklist - Epic 3, Story 3.2: Multi-Environment Chain Configuration

**Date:** 2026-03-13
**Author:** Jonathan
**Primary Test Level:** Unit + Integration (backend stack, vitest)

---

## Story Summary

Create a multi-environment chain configuration system that allows relay operators to switch between development (Anvil), staging (Arbitrum Sepolia), and production (Arbitrum One) environments with a single config field. Provides chain presets with correct chain IDs, RPC URLs, USDC contract addresses, and TokenNetwork addresses for each environment.

**As a** relay operator
**I want** to configure my node for different deployment environments (dev, staging, production)
**So that** I can develop locally on Anvil, test on Arbitrum Sepolia, and deploy to Arbitrum One

---

## Acceptance Criteria

1. **AC #1 (Anvil preset):** Given `chain: 'anvil'` (or no chain config), the node connects to `http://localhost:8545`, uses mock USDC at `0x5FbDB2315678afecb367f032d93F642f64180aa3`, chainId `31337`, and TokenNetwork at `0xCafac3dD18aC6c6e92c921884f9E4176737C052c`.
2. **AC #2 (Arbitrum Sepolia preset):** Given `chain: 'arbitrum-sepolia'`, the node uses chainId `421614`, public RPC, and testnet USDC address.
3. **AC #3 (Arbitrum One preset):** Given `chain: 'arbitrum-one'`, the node uses chainId `42161`, public RPC, and production USDC at `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`.
4. **AC #4 (Env var overrides):** `TOON_CHAIN` overrides config, `TOON_RPC_URL` overrides RPC, `TOON_TOKEN_NETWORK` overrides TokenNetwork address.

---

## Preflight Summary

| Item | Status |
|------|--------|
| Story approved with clear ACs | YES (4 ACs) |
| Detected stack | backend (Node.js/TypeScript, vitest) |
| Test framework | vitest (packages/core/vitest.config.ts) |
| Existing test file | packages/core/src/chain/chain-config.test.ts (updated to 13 tests) |
| Existing source dependency | packages/core/src/chain/usdc.ts (MOCK_USDC_ADDRESS) |
| Error class available | ToonError in packages/core/src/errors.ts |
| Knowledge fragments loaded | data-factories, test-quality, test-levels-framework, test-healing-patterns |

---

## Generation Mode

**Mode:** AI Generation (backend stack, no browser recording needed)
**Rationale:** Backend-only project with clear acceptance criteria. All tests are unit and integration level (vitest). No UI interactions to record.

---

## Failing Tests Created (RED Phase)

### Unit Tests (11 tests)

**File:** `packages/core/src/chain/chain-config.test.ts` (236 lines)

- **Test:** `[P0] resolveChainConfig("anvil") returns local Anvil preset`
  - **Status:** RED - `it.skip()` + placeholder assertion
  - **Verifies:** AC #1 - Anvil chainId (31337), rpcUrl, usdcAddress, name

- **Test:** `[P0] resolveChainConfig("arbitrum-sepolia") returns testnet preset`
  - **Status:** RED - `it.skip()` + placeholder assertion
  - **Verifies:** AC #2 - Arbitrum Sepolia chainId (421614), rpcUrl, usdcAddress, name

- **Test:** `[P0] resolveChainConfig("arbitrum-one") returns production preset`
  - **Status:** RED - `it.skip()` + placeholder assertion
  - **Verifies:** AC #3 - Arbitrum One chainId (42161), rpcUrl, production USDC address

- **Test:** `[P1] resolveChainConfig() defaults to anvil when no argument provided`
  - **Status:** RED - `it.skip()` + placeholder assertion
  - **Verifies:** AC #1 - Default behavior (no chain config = anvil)

- **Test:** `[P1] TOON_CHAIN env var overrides config file chain selection`
  - **Status:** RED - `it.skip()` + placeholder assertion
  - **Verifies:** AC #4 - Env var TOON_CHAIN takes precedence over config

- **Test:** `[P1] TOON_RPC_URL env var overrides preset RPC endpoint`
  - **Status:** RED - `it.skip()` + placeholder assertion
  - **Verifies:** AC #4 - Env var TOON_RPC_URL overrides preset rpcUrl

- **Test:** `[P1] TOON_TOKEN_NETWORK env var overrides preset tokenNetworkAddress`
  - **Status:** RED - `it.skip()` + placeholder assertion
  - **Verifies:** AC #4 - Env var TOON_TOKEN_NETWORK overrides preset tokenNetworkAddress

- **Test:** `[P1] unknown chain name throws clear error message`
  - **Status:** RED - `it.skip()` + placeholder assertion
  - **Verifies:** AC #1,#2,#3 - Error handling for invalid chain names

- **Test:** `[P2] ChainPreset has all required fields`
  - **Status:** RED - `it.skip()` + placeholder assertion
  - **Verifies:** AC #1,#2,#3 - Type completeness (all 5 fields present with correct types)

- **Test:** `[P2] resolveChainConfig() returns defensive copy, not shared reference`
  - **Status:** RED - `it.skip()` + placeholder assertion
  - **Verifies:** AC #1,#2,#3 - Immutability / defensive copy pattern

- **Test:** `[P2] no ethers imports in Epic 3 code`
  - **Status:** RED - `it.skip()` + placeholder assertion
  - **Verifies:** Risk E3-R009 - viem-only enforcement (Decision 7)

### Integration Tests (2 tests)

**File:** `packages/core/src/chain/chain-config.test.ts` (same file, separate describe block)

- **Test:** `[P0] EIP-712 domain separator uses resolved chainId, not hardcoded`
  - **Status:** RED - `it.skip()` + placeholder assertion
  - **Verifies:** AC #1 / Risk E3-R004 - buildEip712Domain() uses correct chainId, name, version, verifyingContract

- **Test:** `[P0] EIP-3009 signature signed on wrong chain fails verification`
  - **Status:** RED - `it.skip()` + placeholder assertion
  - **Verifies:** AC #1 / Risk E3-R004,R005 - Cross-chain signature rejection

---

## Test Traceability Matrix

| Test ID | Test Name | AC | Design ID | Risk | Priority | Level |
|---|---|---|---|---|---|---|
| T-3.2-01 | `resolveChainConfig("anvil") returns local Anvil preset` | #1 | 3.2-UNIT-001 | E3-R004 | P0 | Unit |
| T-3.2-02 | `resolveChainConfig("arbitrum-sepolia") returns testnet preset` | #2 | 3.2-UNIT-001 | E3-R004 | P0 | Unit |
| T-3.2-03 | `resolveChainConfig("arbitrum-one") returns production preset` | #3 | 3.2-UNIT-001 | E3-R004 | P0 | Unit |
| T-3.2-04 | `TOON_CHAIN env var overrides config file chain selection` | #4 | 3.2-UNIT-002 | -- | P1 | Unit |
| T-3.2-05 | `TOON_RPC_URL env var overrides preset RPC endpoint` | #4 | 3.2-UNIT-002 | -- | P1 | Unit |
| T-3.2-06 | `unknown chain name throws clear error message` | #1,#2,#3 | 3.2-UNIT-003 | -- | P1 | Unit |
| T-3.2-07 | `ChainPreset has all required fields` | #1,#2,#3 | 3.2-UNIT-004 | -- | P2 | Unit |
| T-3.2-08 | `no ethers imports in Epic 3 code` | -- | 3.9-UNIT-001 | E3-R009 | P2 | Unit (static) |
| T-3.2-09a | `EIP-712 domain separator uses resolved chainId` | #1 | 3.2-INT-001 | E3-R004,R005 | P0 | Integration |
| T-3.2-09b | `EIP-3009 signature signed on wrong chain fails verification` | #1 | 3.2-INT-001 | E3-R004,R005 | P0 | Integration |
| T-3.2-10 | `TOON_TOKEN_NETWORK env var overrides preset tokenNetworkAddress` | #4 | 3.2-UNIT-002 | -- | P1 | Unit |
| T-3.2-11 | `resolveChainConfig() defaults to anvil when no argument provided` | #1 | 3.2-UNIT-001 | -- | P1 | Unit |
| T-3.2-12 | `resolveChainConfig() returns defensive copy (not shared reference)` | #1,#2,#3 | 3.2-UNIT-004 | -- | P2 | Unit |

---

## Data Factories Created

N/A -- No data factories needed. Tests use known constants (chain IDs, contract addresses) from the story specification. Env var stubs use `vi.stubEnv()` with deterministic values.

---

## Fixtures Created

N/A -- No fixtures needed. Unit tests are pure function invocations. Integration tests for EIP-712 use `buildEip712Domain()` directly. `afterEach(() => vi.unstubAllEnvs())` handles env var cleanup.

---

## Mock Requirements

N/A -- No external service mocking needed. `resolveChainConfig()` reads `process.env` directly (stubbed via `vi.stubEnv()`). No HTTP calls, no database, no file I/O.

---

## Required data-testid Attributes

N/A -- Backend-only story. No UI components.

---

## Implementation Checklist

### Test: T-3.2-01 through T-3.2-03 — Chain Preset Correctness

**File:** `packages/core/src/chain/chain-config.test.ts`

**Tasks to make these tests pass:**

- [ ] Create `packages/core/src/chain/chain-config.ts`
- [ ] Define `ChainPreset` interface with fields: `name`, `chainId`, `rpcUrl`, `usdcAddress`, `tokenNetworkAddress`
- [ ] Define `ChainName` type: `'anvil' | 'arbitrum-sepolia' | 'arbitrum-one'`
- [ ] Create `CHAIN_PRESETS` map with 3 entries (anvil, arbitrum-sepolia, arbitrum-one)
- [ ] Import `MOCK_USDC_ADDRESS` from `./usdc.js` for anvil preset
- [ ] Uncomment imports and assertions in test, remove `it.skip()` and placeholder
- [ ] Run test: `npx vitest run packages/core/src/chain/chain-config.test.ts`

**Estimated Effort:** 0.5 hours

---

### Test: T-3.2-11 — Default to Anvil

**File:** `packages/core/src/chain/chain-config.test.ts`

**Tasks to make this test pass:**

- [ ] Implement `resolveChainConfig(chain?)` to default to `'anvil'` when no argument provided
- [ ] Uncomment assertions and remove `it.skip()`
- [ ] Run test: `npx vitest run packages/core/src/chain/chain-config.test.ts`

**Estimated Effort:** 0.25 hours

---

### Test: T-3.2-04, T-3.2-05, T-3.2-10 — Environment Variable Overrides

**File:** `packages/core/src/chain/chain-config.test.ts`

**Tasks to make these tests pass:**

- [ ] In `resolveChainConfig()`, check `process.env.TOON_CHAIN` and override chain parameter
- [ ] Check `process.env.TOON_RPC_URL` and override preset rpcUrl
- [ ] Check `process.env.TOON_TOKEN_NETWORK` and override preset tokenNetworkAddress
- [ ] Uncomment assertions and remove `it.skip()`
- [ ] Run test: `npx vitest run packages/core/src/chain/chain-config.test.ts`

**Estimated Effort:** 0.5 hours

---

### Test: T-3.2-06 — Invalid Chain Name Error

**File:** `packages/core/src/chain/chain-config.test.ts`

**Tasks to make this test pass:**

- [ ] In `resolveChainConfig()`, throw `ToonError` with message `Unknown chain "${name}". Valid chains: anvil, arbitrum-sepolia, arbitrum-one`
- [ ] Import `ToonError` from `../errors.js`
- [ ] Uncomment assertions and remove `it.skip()`
- [ ] Run test: `npx vitest run packages/core/src/chain/chain-config.test.ts`

**Estimated Effort:** 0.25 hours

---

### Test: T-3.2-07 — Type Completeness

**File:** `packages/core/src/chain/chain-config.test.ts`

**Tasks to make this test pass:**

- [ ] Verify ChainPreset interface has all 5 fields with correct types
- [ ] Uncomment assertions and remove `it.skip()`
- [ ] Run test: `npx vitest run packages/core/src/chain/chain-config.test.ts`

**Estimated Effort:** 0.1 hours (covered by Task 1)

---

### Test: T-3.2-12 — Defensive Copy

**File:** `packages/core/src/chain/chain-config.test.ts`

**Tasks to make this test pass:**

- [ ] In `resolveChainConfig()`, return `{ ...preset }` (spread operator for defensive copy)
- [ ] Uncomment assertions and remove `it.skip()`
- [ ] Run test: `npx vitest run packages/core/src/chain/chain-config.test.ts`

**Estimated Effort:** 0.1 hours

---

### Test: T-3.2-08 — viem-only Enforcement (Static Analysis)

**File:** `packages/core/src/chain/chain-config.test.ts`

**Tasks to make this test pass:**

- [ ] Implement file scanning using `fs.readFileSync` and `readdirSync` (following usdc-migration.test.ts pattern)
- [ ] Scan `packages/core/src/`, `packages/sdk/src/`, `packages/town/src/` for `from 'ethers'` or `from "ethers"` imports
- [ ] Exclude test files (`*.test.ts`, `*.spec.ts`)
- [ ] Assert no ethers imports found
- [ ] Uncomment assertions and remove `it.skip()`
- [ ] Run test: `npx vitest run packages/core/src/chain/chain-config.test.ts`

**Estimated Effort:** 0.5 hours

---

### Test: T-3.2-09a — EIP-712 Domain Separator Chain-Awareness

**File:** `packages/core/src/chain/chain-config.test.ts`

**Tasks to make this test pass:**

- [ ] Implement `buildEip712Domain(config: ChainPreset)` function
- [ ] Return `{ name: 'TokenNetwork', version: '1', chainId: config.chainId, verifyingContract: config.tokenNetworkAddress }`
- [ ] Export `buildEip712Domain` from `chain-config.ts`
- [ ] Uncomment assertions and remove `it.skip()`
- [ ] Run test: `npx vitest run packages/core/src/chain/chain-config.test.ts`

**Estimated Effort:** 0.25 hours

---

### Test: T-3.2-09b — Cross-Chain Signature Rejection

**File:** `packages/core/src/chain/chain-config.test.ts`

**Tasks to make this test pass:**

- [ ] This test verifies that signatures created with one chain's domain separator fail verification against another chain
- [ ] Requires EIP-3009 signing infrastructure (depends on Story 3.3 for full implementation)
- [ ] For RED phase: test documents the expected behavior
- [ ] Implementation may be deferred or simplified to domain separator comparison
- [ ] Uncomment assertions and remove `it.skip()`
- [ ] Run test: `npx vitest run packages/core/src/chain/chain-config.test.ts`

**Estimated Effort:** 0.5 hours

---

## Running Tests

```bash
# Run all failing tests for this story
npx vitest run packages/core/src/chain/chain-config.test.ts

# Run specific test by name
npx vitest run packages/core/src/chain/chain-config.test.ts -t "resolveChainConfig"

# Run tests in watch mode
npx vitest packages/core/src/chain/chain-config.test.ts

# Run full suite (verify no regressions)
pnpm test

# Run with coverage
npx vitest run packages/core/src/chain/chain-config.test.ts --coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 13 tests written and using `it.skip()` with placeholder assertions
- Tests structured with commented-out real assertions ready for implementation
- `afterEach(() => vi.unstubAllEnvs())` handles env var cleanup
- Implementation checklist created mapping tests to code tasks
- Test file verified: all 13 tests skipped, 0 failures, full suite passes (71 files, 1344 tests)

**Verification:**

- All tests skip as expected (RED phase confirmed)
- Full suite: 71 passed, 18 skipped, 0 failures
- No regressions from adding 3 new tests

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. Create `packages/core/src/chain/chain-config.ts` with `resolveChainConfig()` and `buildEip712Domain()`
2. Export from `packages/core/src/index.ts`
3. Uncomment imports in test file
4. Pick one failing test, remove `it.skip()` and placeholder, uncomment assertions
5. Implement minimal code to make that test pass
6. Repeat for each test
7. Integrate with `TownConfig` and `NodeConfig` (Tasks 4-5)
8. Update `docker/src/shared.ts` (Task 6)

**Key Principles:**

- One test at a time (start with P0 chain preset tests)
- Minimal implementation (no over-engineering)
- Run tests frequently
- Use implementation checklist as roadmap

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all 13 tests pass (green phase complete)
2. Review for code quality
3. Ensure `resolveChainConfig()` returns defensive copies
4. Verify `buildEip712Domain()` matches `getBalanceProofDomain()` in evm-signer.ts
5. Run full suite: `pnpm test`
6. Run lint: `pnpm lint`
7. Run build: `pnpm build`

---

## Next Steps

1. **Begin implementation** using implementation checklist (start with Task 1: chain-config.ts)
2. **Uncomment imports** in test file when module exists
3. **Remove `it.skip()` one test at a time** and implement to pass
4. **Run tests after each change**: `npx vitest run packages/core/src/chain/chain-config.test.ts`
5. **When all 13 tests pass**, integrate with TownConfig, NodeConfig, and docker/shared.ts
6. **Run full suite**: `pnpm test` — verify 0 regressions
7. **Update sprint status** when complete

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **data-factories.md** - Confirmed no factories needed (pure function testing with known constants)
- **test-quality.md** - Applied: one assertion per test, deterministic tests, isolation via `vi.unstubAllEnvs()`
- **test-levels-framework.md** - Applied: unit tests for pure functions, integration tests for cross-module interaction (EIP-712)
- **test-healing-patterns.md** - Applied: env var cleanup pattern, defensive copy verification

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/core/src/chain/chain-config.test.ts`

**Results:**

```
 RUN  v1.6.1 /Users/jonathangreen/Documents/toon

 ↓ packages/core/src/chain/chain-config.test.ts  (13 tests | 13 skipped)

 Test Files  1 skipped (1)
      Tests  13 skipped (13)
   Start at  10:21:35
   Duration  255ms
```

**Full Suite Verification:**

```
 Test Files  71 passed | 18 skipped (89)
      Tests  1344 passed | 184 skipped (1528)
   Duration  5.80s
```

**Summary:**

- Total tests: 13
- Passing: 0 (expected)
- Skipped: 13 (expected - RED phase)
- Failing: 0 (tests use it.skip(), not failing)
- Status: RED phase verified
- Regressions: 0

---

## Notes

- The existing test file had 10 tests from the epic-level ATDD. This ATDD run added 3 new tests: T-3.2-10 (TOON_TOKEN_NETWORK env var), T-3.2-11 (default-to-anvil), T-3.2-12 (defensive copy). These were identified by gap analysis against AC #4 and the story's defensive copy requirement.
- The `buildEip712Domain` import was added to the commented-out import block (was missing from the original test file).
- The `_ANVIL_TOKEN_NETWORK` constant was added for the EIP-712 integration test assertions.
- Test T-3.2-09b (cross-chain signature rejection) may need EIP-3009 signing infrastructure from Story 3.3. The test documents the expected behavior; the dev agent may simplify to domain separator comparison if full signing is not yet available.

---

**Generated by BMad TEA Agent** - 2026-03-13
