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
  - _bmad-output/implementation-artifacts/3-1-usdc-token-migration.md
  - _bmad-output/test-artifacts/test-design-epic-3.md
  - _bmad-output/test-artifacts/atdd-checklist-epic-3.md
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - _bmad/tea/config.yaml
---

# ATDD Checklist - Epic 3, Story 3.1: USDC Token Migration

**Date:** 2026-03-13
**Author:** Jonathan
**Primary Test Level:** Unit + Integration (backend stack, vitest)

---

## Story Summary

Migrate the TOON protocol from the AGENT development token to USDC (USD Coin) for all user-facing payments. Deploy a mock USDC contract on Anvil, update the TokenNetwork to use USDC, update the faucet, replace all AGENT token references, and verify pricing denomination semantics.

**As a** relay operator
**I want** payment channels and pricing denominated in USDC instead of the AGENT development token
**So that** the protocol uses a real, widely-held stablecoin for all user-facing payments

---

## Acceptance Criteria

1. **AC #1 (Contract + TokenNetwork):** Mock USDC ERC-20 contract deployed on Anvil at deterministic address, TokenNetwork configured for USDC, all payment channel operations use USDC denomination.
2. **AC #2 (Pricing):** Pricing remains `basePricePerByte * toonData.length`, denominated in USDC micro-units (6 decimals).
3. **AC #3 (Faucet):** Faucet distributes mock USDC instead of AGENT tokens; faucet is dev-only.
4. **AC #4 (Reference Cleanup):** All references to "AGENT" token replaced with "USDC" in config, types, and documentation; all existing tests pass.

---

## Failing Tests Created (RED Phase)

### Unit + Integration Tests (5 tests)

**File:** `packages/core/src/chain/usdc-migration.test.ts` (165 lines)

- **T-3.1-01** `[P0] mock USDC supports EIP-3009 transferWithAuthorization on Anvil`
  - **Status:** RED - `it.skip()` placeholder, implementation does not exist
  - **Verifies:** AC #1 - FiatTokenV2_2 deployed on Anvil supports EIP-3009 `transferWithAuthorization`
  - **Test Level:** Integration (requires Anvil)
  - **Risk:** E3-R005 (Mock USDC fidelity, score 6)

- **T-3.1-02** `[P0] TokenNetwork openChannel works with USDC token address`
  - **Status:** RED - `it.skip()` placeholder, implementation does not exist
  - **Verifies:** AC #1 - TokenNetwork can open channels using the USDC token address
  - **Test Level:** Integration (requires Anvil)
  - **Risk:** E3-R005 (Mock USDC fidelity, score 6)

- **T-3.1-03** `[P2] faucet config specifies USDC token instead of AGENT`
  - **Status:** RED - `it.skip()` placeholder, faucet still has AGENT defaults
  - **Verifies:** AC #3 - Faucet default tokenSymbol is 'USDC', tokenDecimals is 6
  - **Test Level:** Unit (source file analysis)

- **T-3.1-04** `[P2] no AGENT token references in config types`
  - **Status:** RED - `it.skip()` placeholder, static analysis not implemented
  - **Verifies:** AC #4 - Old AGENT address `0x5FbDB2315678afecb367f032d93F642f64180aa3` absent from `packages/{core,sdk,town}/src/` (excluding test files)
  - **Test Level:** Unit (static analysis, "verification by absence" pattern from Story 2-7)
  - **Risk:** E3-R002 (AGENT references survive, score 4)

- **T-3.1-05** `[P1] basePricePerByte pricing produces amounts in USDC micro-units`
  - **Status:** RED - `it.skip()` placeholder, denomination documentation test
  - **Verifies:** AC #2 - Pricing formula produces USDC micro-unit amounts (10n * 1024 bytes = 10,240 micro-USDC = $0.01)
  - **Test Level:** Unit (pricing validator)

---

## Data Factories Created

### Chain/USDC Factory (usdc-migration.test.ts, inline)

**Exports:**
- `_createUsdcConfig(overrides?)` - Create mock USDC contract configuration with defaults: name='USD Coin', symbol='USDC', decimals=6, initialSupply=1B USDC

**Constants:**
- `ANVIL_DEPLOYER` - Deterministic Anvil deployer address (Account #0)
- `_ANVIL_CHAIN_ID` - Deterministic Anvil chain ID (31337)
- `_OLD_AGENT_TOKEN_ADDRESS` - Old AGENT token address for static analysis validation

**Example Usage:**

```typescript
const config = _createUsdcConfig({ decimals: 18 }); // Override for edge-case testing
const config = _createUsdcConfig(); // Default: 6 decimals, 'USDC', 1B supply
```

---

## Fixtures Created

No separate fixture files needed. All test data is created via inline factories (co-located pattern, per project conventions). The tests are unit/integration level and use vitest's built-in test isolation.

---

## Mock Requirements

### Anvil (Local EVM) -- T-3.1-01, T-3.1-02

**Required:** Anvil running at `http://localhost:8545`
**Contract:** Real FiatTokenV2_2 (Circle's USDC implementation) deployed on Anvil
**Purpose:** Full EIP-3009 `transferWithAuthorization` fidelity
**Note:** T-3.1-01 and T-3.1-02 should be gated behind a `servicesReady` guard or tagged as integration tests since they require live Anvil infrastructure.

### File System -- T-3.1-03, T-3.1-04

**Required:** Access to `packages/faucet/src/index.js` and `packages/{core,sdk,town}/src/`
**Purpose:** Source file analysis (faucet defaults, AGENT reference scan)
**Pattern:** `fs.readFileSync()` for source file content verification

### Pricing Validator -- T-3.1-05

**Required:** `createPricingValidator` from `@toon-protocol/sdk`
**Purpose:** Verify pricing formula produces correct USDC micro-unit amounts
**Pattern:** Direct import, no mocks needed (pure function)

---

## Required data-testid Attributes

Not applicable -- this story is backend-only (no UI components).

---

## Implementation Checklist

### Test: T-3.1-01 -- mock USDC supports EIP-3009 transferWithAuthorization

**File:** `packages/core/src/chain/usdc-migration.test.ts`

**Tasks to make this test pass:**

- [ ] Deploy mock USDC contract (FiatTokenV2_2 or simplified mock with EIP-3009 stub) on Anvil via docker-compose-genesis.yml
- [ ] Create `packages/core/src/chain/usdc.ts` with `MOCK_USDC_ADDRESS`, `USDC_DECIMALS`, `USDC_SYMBOL` constants
- [ ] Export `MockUsdcConfig` type from `packages/core/src/chain/usdc.ts`
- [ ] Uncomment imports in test file
- [ ] Remove `.skip` from test
- [ ] Implement actual EIP-3009 `transferWithAuthorization` call against Anvil
- [ ] Run test: `pnpm test packages/core/src/chain/usdc-migration.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 3-4 hours (contract deployment + test implementation)

---

### Test: T-3.1-02 -- TokenNetwork openChannel works with USDC

**File:** `packages/core/src/chain/usdc-migration.test.ts`

**Tasks to make this test pass:**

- [ ] Update `DeployLocal.s.sol` (or `cast` commands in docker-compose) to create TokenNetwork for USDC
- [ ] Record new deterministic TokenNetwork address
- [ ] Update `TOKEN_NETWORK_EVM_BASE_31337` in docker-compose-genesis.yml
- [ ] Uncomment imports in test file
- [ ] Remove `.skip` from test
- [ ] Implement `openChannel()` call with USDC TokenNetwork against Anvil
- [ ] Run test: `pnpm test packages/core/src/chain/usdc-migration.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 2-3 hours (TokenNetwork reconfiguration)

---

### Test: T-3.1-03 -- faucet config specifies USDC

**File:** `packages/core/src/chain/usdc-migration.test.ts`

**Tasks to make this test pass:**

- [ ] Update `packages/faucet/src/index.js`: change `tokenSymbol = 'AGENT'` to `tokenSymbol = 'USDC'`
- [ ] Update `packages/faucet/src/index.js`: change `tokenDecimals = 18` to `tokenDecimals = 6`
- [ ] Update `TOKEN_AMOUNT` comment from "10,000 AGENT tokens" to "10,000 USDC"
- [ ] Update faucet startup banner text to say USDC instead of AGENT
- [ ] Remove `.skip` from test
- [ ] Implement `fs.readFileSync` source analysis in test
- [ ] Run test: `pnpm test packages/core/src/chain/usdc-migration.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: T-3.1-04 -- no AGENT token references in config types

**File:** `packages/core/src/chain/usdc-migration.test.ts`

**Tasks to make this test pass:**

- [ ] Replace all occurrences of `0x5FbDB2315678afecb367f032d93F642f64180aa3` in source files:
  - `packages/bls/src/entrypoint.ts` (fallback token address)
  - `packages/core/src/events/builders.test.ts` (AGENT_TOKEN placeholder)
  - `packages/core/src/events/parsers.test.ts` (AGENT_TOKEN placeholder)
  - `docker/src/shared.test.ts` (AGENT_TOKEN placeholder)
  - All example files (8 files)
  - All E2E test files (8 files)
  - `.env`, `packages/sdk/.env`
  - `docker-compose-genesis.yml`, `docker-compose-sdk-e2e.yml`
  - `deploy-genesis-node.sh`, `deploy-peers.sh`, `fund-peer-wallet.sh`
  - `docs/settlement.md`
- [ ] Remove `.skip` from test
- [ ] Implement directory scanner using `fs.readdirSync` + `fs.readFileSync`
- [ ] Run test: `pnpm test packages/core/src/chain/usdc-migration.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 2-3 hours (many files to update)

---

### Test: T-3.1-05 -- USDC denomination pricing

**File:** `packages/core/src/chain/usdc-migration.test.ts`

**Tasks to make this test pass:**

- [ ] No code changes needed for the pricing formula (it is denomination-agnostic)
- [ ] Add documentation comment to `basePricePerByte` in SDK config noting USDC micro-units
- [ ] Remove `.skip` from test
- [ ] Import `createPricingValidator` from `@toon-protocol/sdk`
- [ ] Create mock `ToonRoutingMeta` with known byte length
- [ ] Assert pricing produces expected USDC micro-unit amounts
- [ ] Run test: `pnpm test packages/core/src/chain/usdc-migration.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours (documentation test)

---

## Running Tests

```bash
# Run all Story 3.1 ATDD tests (all skipped in red phase)
pnpm test packages/core/src/chain/usdc-migration.test.ts

# Run with vitest directly (non-watch mode)
npx vitest run packages/core/src/chain/usdc-migration.test.ts

# Run all project tests (verify no regressions)
npx vitest run

# Run with coverage
npx vitest run --coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 5 tests written with `it.skip()` (intentionally failing)
- Factories created inline (co-located pattern)
- Mock requirements documented
- data-testid requirements listed (N/A for backend)
- Implementation checklist created

**Verification:**

- All 5 tests run and are skipped as expected
- Full test suite passes: 1320 passed, 186 skipped, 0 failures
- Failure messages are clear and actionable (placeholder `expect(true).toBe(false)`)
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with T-3.1-05 as easiest, then T-3.1-03, then T-3.1-04, then T-3.1-01/T-3.1-02)
2. **Read the test** to understand expected behavior
3. **Implement minimal code** to make that specific test pass
4. **Run the test** to verify it now passes (green)
5. **Check off the task** in implementation checklist
6. **Move to next test** and repeat

**Recommended Implementation Order:**

1. **T-3.1-05** (pricing denomination) -- no code changes needed, just uncomment and connect
2. **T-3.1-03** (faucet config) -- simple text replacement in faucet source
3. **T-3.1-04** (AGENT reference removal) -- large scope but mechanical changes
4. **T-3.1-01** (mock USDC deployment) -- requires contract deployment on Anvil
5. **T-3.1-02** (TokenNetwork with USDC) -- depends on T-3.1-01 completion

**Key Principles:**

- One test at a time (do not try to fix all at once)
- Minimal implementation (do not over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability, performance)
3. **Run full suite:** `npx vitest run` -- all 1320+ tests pass
4. **Run lint:** `pnpm lint`
5. **Run format:** `pnpm format:check`
6. **Run build:** `pnpm build`
7. **Update sprint status:** `3-1-usdc-token-migration: done` in sprint-status.yaml

---

## Next Steps

1. **Review this checklist** -- verify test coverage against all 4 acceptance criteria
2. **Run failing tests** to confirm RED phase: `pnpm test packages/core/src/chain/usdc-migration.test.ts`
3. **Begin implementation** using implementation checklist as guide
4. **Work one test at a time** (red -> green for each)
5. **When all tests pass**, refactor code for quality
6. **When refactoring complete**, update sprint status to 'done' in sprint-status.yaml

---

## Test Traceability

| ATDD Test ID | Test Name | AC | Test-Design ID | Risk Link | Priority | Level |
|---|---|---|---|---|---|---|
| T-3.1-01 | mock USDC supports EIP-3009 transferWithAuthorization on Anvil | #1 | 3.1-INT-001 | E3-R005 | P0 | Integration |
| T-3.1-02 | TokenNetwork openChannel works with USDC token address | #1 | 3.1-INT-001 | E3-R005 | P0 | Integration |
| T-3.1-03 | faucet config specifies USDC token instead of AGENT | #3 | 3.1-UNIT-001 | -- | P2 | Unit |
| T-3.1-04 | no AGENT token references in config types | #4 | 3.1-UNIT-002 | E3-R002 | P2 | Unit (static) |
| T-3.1-05 | basePricePerByte pricing produces amounts in USDC micro-units | #2 | -- (from test-design) | -- | P1 | Unit |

---

## Knowledge Base References Applied

- **data-factories.md** -- Factory patterns with overrides (Partial<T>), inline co-located factories
- **test-quality.md** -- AAA pattern, deterministic tests, explicit assertions, <300 lines per test
- **test-levels-framework.md** -- Unit for pure logic (T-3.1-03, T-3.1-04, T-3.1-05), Integration for on-chain interactions (T-3.1-01, T-3.1-02)
- **test-healing-patterns.md** -- Pattern-based healing for selector/timing issues (not applicable for backend, noted for reference)

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/core/src/chain/usdc-migration.test.ts`

**Results:**

```
 DEV  v1.6.1 /Users/jonathangreen/Documents/toon

 ↓ packages/core/src/chain/usdc-migration.test.ts  (5 tests | 5 skipped)

 Test Files  1 skipped (1)
      Tests  5 skipped (5)
   Start at  07:49:22
   Duration  261ms
```

**Summary:**

- Total tests: 5
- Passing: 0 (expected)
- Skipped: 5 (expected -- all `it.skip()`)
- Failing: 0 (skipped tests do not count as failures)
- Status: RED phase verified

### Full Suite Regression Check

**Command:** `npx vitest run`

**Results:**

```
 Test Files  70 passed | 19 skipped (89)
      Tests  1320 passed | 186 skipped (1506)
   Duration  7.33s
```

- No regressions introduced by adding T-3.1-05 test.

---

## Notes

- **T-3.1-01 and T-3.1-02 require Anvil infrastructure.** These should be gated behind a `servicesReady` flag or tagged as integration tests. They cannot run in standard `pnpm test` without genesis node up.
- **T-3.1-04 follows the "verification by absence" pattern** established by Story 2-7's `spsp-removal-verification.test.ts`. The implementation uses `fs.readdirSync` + `fs.readFileSync` to scan source directories for the old AGENT token address.
- **T-3.1-05 is a documentation test** -- the pricing formula is unchanged. The test documents that `basePricePerByte = 10n` means 10 micro-USDC per byte ($0.00001/byte) with USDC's 6-decimal standard.
- **The old AGENT token address `0x5FbDB2315678afecb367f032d93F642f64180aa3` must not appear in any source file after this story** -- enforced by T-3.1-04.
- **Cross-repo dependency:** Contract deployment happens in `../connector/packages/contracts/`. The story recommends using `cast` commands in docker-compose for initial implementation (Option 3) to avoid cross-repo changes.

---

**Generated by:** BMad TEA Agent - ATDD Workflow
**Workflow:** `_bmad/tea/workflows/testarch/atdd`
**Version:** 5.0 (Step-File Architecture)
**Date:** 2026-03-13
