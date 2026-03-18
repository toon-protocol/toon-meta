# Story 3.2: Multi-Environment Chain Configuration

Status: done

## Story

As a **relay operator**,
I want to configure my node for different deployment environments (dev, staging, production),
So that I can develop locally on Anvil, test on Arbitrum Sepolia, and deploy to Arbitrum One.

**FRs covered:** FR-PROD-2 (Multi-environment chain configuration: Anvil, Arbitrum Sepolia, Arbitrum One)

**Dependencies:** Story 3.1 (USDC migration must be complete — provides `MOCK_USDC_ADDRESS`, `USDC_DECIMALS`, `MockUsdcConfig` from `packages/core/src/chain/usdc.ts`)

**Decision source:** Party Mode Decision 6 — "Arbitrum One as Production Chain" (see `_bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md`). Decision 7 — "viem for new code, ethers.js untouched in connector" (architectural debt boundary).

## Acceptance Criteria

1. Given the node configuration, when I specify `chain: 'anvil'` (or no chain config), then the node connects to the local Anvil instance at `http://localhost:8545` and uses the deterministic mock USDC contract address (`0x5FbDB2315678afecb367f032d93F642f64180aa3`), chainId `31337`, and the existing TokenNetwork address (`0xCafac3dD18aC6c6e92c921884f9E4176737C052c`).

2. Given the node configuration, when I specify `chain: 'arbitrum-sepolia'`, then the node uses Arbitrum Sepolia chainId `421614`, a public RPC endpoint, and the testnet USDC contract address.

3. Given the node configuration, when I specify `chain: 'arbitrum-one'`, then the node uses Arbitrum One chainId `42161`, a public RPC endpoint, and the production USDC contract address (`0xaf88d065e77c8cC2239327C5EDb3A432268e5831`).

4. Given environment variables, when `TOON_CHAIN` is set, then it overrides the config file chain selection, `TOON_RPC_URL` allows custom RPC endpoint override, and `TOON_TOKEN_NETWORK` allows custom TokenNetwork address override.

## Tasks / Subtasks

- [x] Task 1: Create `packages/core/src/chain/chain-config.ts` with `resolveChainConfig()` (AC: #1, #2, #3, #4)
  - [x] Define the `ChainPreset` interface with fields:
    - `name: string` — preset identifier ('anvil' | 'arbitrum-sepolia' | 'arbitrum-one')
    - `chainId: number` — EVM chain ID
    - `rpcUrl: string` — default RPC endpoint
    - `usdcAddress: string` — USDC token contract address on this chain
    - `tokenNetworkAddress: string` — TokenNetwork contract address for USDC on this chain
  - [x] Define the `ChainName` type: `'anvil' | 'arbitrum-sepolia' | 'arbitrum-one'`
  - [x] Create `CHAIN_PRESETS` constant map with three entries:

    **anvil (local dev):**
    - `chainId: 31337`
    - `rpcUrl: 'http://localhost:8545'`
    - `usdcAddress: MOCK_USDC_ADDRESS` (from `./usdc.js` — `0x5FbDB2315678afecb367f032d93F642f64180aa3`)
    - `tokenNetworkAddress: '0xCafac3dD18aC6c6e92c921884f9E4176737C052c'` (deterministic Anvil address)

    **arbitrum-sepolia (staging):**
    - `chainId: 421614`
    - `rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc'` (Arbitrum Sepolia public RPC)
    - `usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'` (Circle testnet USDC on Arbitrum Sepolia)
    - `tokenNetworkAddress: ''` (empty — TokenNetwork not yet deployed on Sepolia; to be set via env var or config)

    **arbitrum-one (production):**
    - `chainId: 42161`
    - `rpcUrl: 'https://arb1.arbitrum.io/rpc'` (Arbitrum One public RPC)
    - `usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'` (native USDC on Arbitrum One — per project-context.md)
    - `tokenNetworkAddress: ''` (empty — TokenNetwork not yet deployed on Arbitrum One; to be set via env var or config)

  - [x] Implement `resolveChainConfig(chain?: ChainName | string): ChainPreset`:
    1. Check `process.env.TOON_CHAIN` — if set, it overrides the `chain` parameter
    2. Default to `'anvil'` if neither env var nor parameter is provided
    3. Look up the chain name in `CHAIN_PRESETS`
    4. If not found, throw `ToonError` with message `Unknown chain "${name}". Valid chains: anvil, arbitrum-sepolia, arbitrum-one`
    5. Check `process.env.TOON_RPC_URL` — if set, override the preset's `rpcUrl`
    6. Check `process.env.TOON_TOKEN_NETWORK` — if set, override the preset's `tokenNetworkAddress`
    7. Return the resolved `ChainPreset`
  - [x] **IMPORTANT:** The function returns a new object (defensive copy), not a reference to the shared preset, to prevent mutation.
  - [x] **IMPORTANT:** Import `MOCK_USDC_ADDRESS` from `./usdc.js` to avoid hardcoding the address in two places.

- [x] Task 2: Create `buildEip712Domain()` helper for chain-aware EIP-712 domain separators (AC: #1)
  - [x] In `packages/core/src/chain/chain-config.ts`, add:
    ```typescript
    function buildEip712Domain(config: ChainPreset): {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: string;
    }
    ```
  - [x] Implementation: Returns `{ name: 'TokenNetwork', version: '1', chainId: config.chainId, verifyingContract: config.tokenNetworkAddress }`
  - [x] **IMPORTANT:** Must match the existing EIP-712 domain structure in `packages/client/src/signing/evm-signer.ts` (`getBalanceProofDomain()`). The domain name is `'TokenNetwork'`, version is `'1'`, and `verifyingContract` is the TokenNetwork address.
  - [x] **NOTE:** This function is a convenience wrapper. The existing `EvmSigner.signBalanceProof()` already accepts `chainId` and `tokenNetworkAddress` as parameters. This function makes it easy to get the correct domain from a resolved chain config without manually extracting fields.
  - [x] **NOTE:** The existing `getBalanceProofDomain()` in `evm-signer.ts` casts `verifyingContract` to viem's `Hex` type. Since `buildEip712Domain()` lives in `@toon-protocol/core` (which does not depend on viem), it returns plain `string`. Consumers in the client package can cast to `Hex` if needed. This keeps the core package viem-free per Decision 7.

- [x] Task 3: Export chain config from `@toon-protocol/core` (AC: #1, #2, #3)
  - [x] Add exports to `packages/core/src/index.ts`:
    ```typescript
    export {
      resolveChainConfig,
      buildEip712Domain,
      CHAIN_PRESETS,
      type ChainPreset,
      type ChainName,
    } from './chain/chain-config.js';
    ```
  - [x] Verify the exports don't conflict with existing `chain/usdc.js` exports already in index.ts.

- [x] Task 4: Integrate chain config with `TownConfig` (AC: #1, #2, #3, #4)
  - [x] In `packages/town/src/town.ts`, add optional `chain` field to `TownConfig`:
    ```typescript
    /** Chain preset name (default: 'anvil'). See resolveChainConfig(). */
    chain?: string;
    ```
  - [x] In `startTown()`, resolve chain config early (before settlement config):
    ```typescript
    const chainConfig = resolveChainConfig(config.chain);
    ```
  - [x] When `config.chainRpcUrls`, `config.tokenNetworks`, and `config.preferredTokens` are not provided, auto-populate them from the resolved chain config:
    - `chainRpcUrls` defaults to `{ ['evm:base:' + chainConfig.chainId]: chainConfig.rpcUrl }`
    - `tokenNetworks` defaults to `{ ['evm:base:' + chainConfig.chainId]: chainConfig.tokenNetworkAddress }` (if tokenNetworkAddress is non-empty)
    - `preferredTokens` defaults to `{ ['evm:base:' + chainConfig.chainId]: chainConfig.usdcAddress }`
  - [x] **IMPORTANT:** Explicit `chainRpcUrls`/`tokenNetworks`/`preferredTokens` in config always win over chain preset defaults. The preset is a convenience for the common case.
  - [x] **NOTE:** The `evm:base:` prefix matches the existing chain identifier format used in `docker/src/shared.ts` and `docker-compose-genesis.yml` (e.g., `evm:base:31337`).

- [x] Task 5: Integrate chain config with `NodeConfig` in SDK (AC: #1, #2, #3, #4)
  - [x] In `packages/sdk/src/create-node.ts`, add optional `chain` field to `NodeConfig`:
    ```typescript
    /** Chain preset name (default: 'anvil'). See resolveChainConfig(). */
    chain?: string;
    ```
  - [x] In `createNode()`, resolve chain config and pass to the underlying `createToonNode()` if settlement info is needed.
  - [x] **NOTE:** The SDK currently receives settlement config via `NodeConfig` fields. Adding `chain` as a convenience shorthand that auto-populates settlement fields if not explicitly set.

- [x] Task 6: Update `docker/src/shared.ts` to support `TOON_CHAIN` env var (AC: #4)
  - [x] The existing `parseConfig()` in `docker/src/shared.ts` reads chain config from individual env vars (`SUPPORTED_CHAINS`, `SETTLEMENT_ADDRESS_*`, `TOKEN_NETWORK_*`, `PREFERRED_TOKEN_*`).
  - [x] Add support for `TOON_CHAIN` as a simplified alternative:
    - If `TOON_CHAIN` is set and `SUPPORTED_CHAINS` is NOT set, use `resolveChainConfig()` to derive the settlement config automatically: construct `supportedChains`, `settlementAddresses`, `preferredTokens`, `tokenNetworks`, and the chain RPC URL from the resolved preset.
    - If both are set, `SUPPORTED_CHAINS` (explicit) wins over `TOON_CHAIN` (convenience).
  - [x] **NOTE:** This is an additive change. The existing env var pattern continues to work unchanged.
  - [x] **NOTE:** The existing `parseConfig()` does not have a per-chain RPC URL env var pattern (it only reads `SUPPORTED_CHAINS`, `SETTLEMENT_ADDRESS_*`, `TOKEN_NETWORK_*`, `PREFERRED_TOKEN_*`). The `TOON_CHAIN` convenience also sets the RPC URL from the preset, filling a gap in the existing env var pattern. `TOON_RPC_URL` overrides the preset RPC if needed.

- [x] Task 7: Enable ATDD tests and make them pass (AC: #1, #2, #3, #4)
  - [x] In `packages/core/src/chain/chain-config.test.ts`:
    - Uncomment imports for `resolveChainConfig`, `ChainPreset`, `CHAIN_PRESETS` and add `buildEip712Domain` to the import block (not present in the RED phase import comment — must be added)
    - Remove `.skip` from all tests
    - Update test implementations:
      - **3.2-UNIT-001 (3 tests):** Call `resolveChainConfig()` with each chain name and assert chainId, rpcUrl, usdcAddress, name
      - **3.2-UNIT-002 (2 tests):** Use `vi.stubEnv()` to set `TOON_CHAIN` and `TOON_RPC_URL`, verify overrides work
      - **3.2-UNIT-003 (1 test):** Call `resolveChainConfig('invalid-chain')` and verify it throws with clear error
      - **3.2-UNIT-004 (1 test):** Verify all fields exist and have correct types
      - **3.9-UNIT-001 (1 test):** Static analysis scan for ethers imports in packages/{core,sdk,town}/src/ (verification by absence pattern from Story 2-7)
      - **3.2-INT-001 (2 tests):** Verify `buildEip712Domain()` uses resolved chainId; verify cross-chain rejection
    - Remove placeholder `expect(true).toBe(false)` assertions
  - [x] Run `pnpm test packages/core/src/chain/chain-config.test.ts` — all tests pass
  - [x] Run `pnpm test` — full suite passes with no regressions

- [x] Task 8: Update sprint status and verify build (AC: all)
  - [x] Update `_bmad-output/implementation-artifacts/sprint-status.yaml`:
    - Change `3-2-multi-environment-chain-configuration: ready-for-dev` to `3-2-multi-environment-chain-configuration: done` (story is already at `ready-for-dev` — the dev agent should set `in-progress` when starting work, then `done` on completion)
  - [x] Verify build: `pnpm build`
  - [x] Verify lint: `pnpm lint`
  - [x] Verify format: `pnpm format:check`
  - [x] Verify tests: `pnpm test` — all tests pass, 0 regressions

## Dev Notes

### What This Story Does

This story creates a multi-environment chain configuration system that allows relay operators to switch between development (Anvil), staging (Arbitrum Sepolia), and production (Arbitrum One) environments with a single config field. It provides chain presets with the correct chain IDs, RPC URLs, USDC contract addresses, and TokenNetwork addresses for each environment.

This is a foundational story for Epic 3 — Story 3.3 (x402 /publish) depends on `resolveChainConfig()` to determine which chain to settle USDC on, and Story 3.5 (service discovery) needs chain information for kind:10035 events.

### What Changes

```
Before:
- Settlement config requires manual env vars: SUPPORTED_CHAINS, TOKEN_NETWORK_*, PREFERRED_TOKEN_*
- No concept of "chain preset" — operators must know all addresses
- EIP-712 domain separator hardcodes chainId at the call site
- Only Anvil (31337) is used in practice

After:
- `chain: 'anvil'` or `chain: 'arbitrum-one'` configures everything
- resolveChainConfig() provides chainId, rpcUrl, usdcAddress, tokenNetworkAddress
- TOON_CHAIN, TOON_RPC_URL, and TOON_TOKEN_NETWORK env vars for deployment flexibility
- EIP-712 domain separator constructed from resolved chain config
- Three presets: anvil (31337), arbitrum-sepolia (421614), arbitrum-one (42161)
```

### Scope Boundaries

**In scope:**
- `resolveChainConfig()` function in `@toon-protocol/core`
- Chain presets for Anvil, Arbitrum Sepolia, Arbitrum One
- `buildEip712Domain()` helper
- Environment variable overrides (`TOON_CHAIN`, `TOON_RPC_URL`, `TOON_TOKEN_NETWORK`)
- Integration with `TownConfig.chain` and `NodeConfig.chain`
- ATDD test enablement (9 tests in `chain-config.test.ts`)

**Out of scope (handled by later stories):**
- Actual connection to Arbitrum Sepolia/One RPC endpoints (Story 3.3 will use the resolved rpcUrl)
- TokenNetwork deployment on Arbitrum Sepolia/One (deferred to when those environments are needed)
- FiatTokenV2_2 deployment on Anvil (Story 3.1 already uses the deterministic mock ERC-20)
- x402 /publish endpoint (Story 3.3)
- EIP-3009 gasless USDC authorization (Story 3.3)

### Chain Preset Details

| Chain | chainId | USDC Address | TokenNetwork | RPC |
|-------|---------|-------------|--------------|-----|
| anvil | 31337 | `0x5FbDB2315678afecb367f032d93F642f64180aa3` (mock) | `0xCafac3dD18aC6c6e92c921884f9E4176737C052c` | `http://localhost:8545` |
| arbitrum-sepolia | 421614 | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` (Circle testnet) | _(not yet deployed)_ | `https://sepolia-rollup.arbitrum.io/rpc` |
| arbitrum-one | 42161 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` (native USDC) | _(not yet deployed)_ | `https://arb1.arbitrum.io/rpc` |

### Environment Variable Override Precedence

```
1. TOON_CHAIN overrides config.chain parameter
2. TOON_RPC_URL overrides the preset's rpcUrl
3. TOON_TOKEN_NETWORK overrides the preset's tokenNetworkAddress
4. Explicit chainRpcUrls/tokenNetworks/preferredTokens in TownConfig override chain preset defaults
```

### EIP-712 Domain Separator

The `buildEip712Domain()` function constructs the EIP-712 domain separator used for balance proof signing. It must produce the same structure as the existing `getBalanceProofDomain()` in `packages/client/src/signing/evm-signer.ts`:

```typescript
{
  name: 'TokenNetwork',
  version: '1',
  chainId: <from resolved chain config>,
  verifyingContract: <tokenNetworkAddress from resolved chain config>,
}
```

**Risk E3-R004 (Chain Config Injection, score 6):** If the chainId in the EIP-712 domain separator doesn't match the actual chain, valid signatures will fail verification (false rejections) or forged signatures may pass (false acceptance). The `resolveChainConfig()` function ensures the chainId always comes from the preset, never hardcoded.

### Compatibility with Existing Settlement Config

The existing settlement config in `docker/src/shared.ts` uses a chain identifier format `evm:base:<chainId>` (e.g., `evm:base:31337`). The chain preset integration in `startTown()` constructs these identifiers from the resolved `chainConfig.chainId`, maintaining backward compatibility with existing Docker deployments.

Existing env vars (`SUPPORTED_CHAINS`, `TOKEN_NETWORK_EVM_BASE_31337`, etc.) continue to work. The new `TOON_CHAIN` env var is a convenience shorthand for the common case of using a standard chain preset.

### Files Changed (Anticipated)

**New files:**
- `packages/core/src/chain/chain-config.ts` — Chain presets, `resolveChainConfig()`, `buildEip712Domain()`

**Modified files (source):**
- `packages/core/src/index.ts` — Add chain-config exports
- `packages/town/src/town.ts` — Add `chain` field to `TownConfig`, auto-populate settlement from chain preset
- `packages/sdk/src/create-node.ts` — Add `chain` field to `NodeConfig`

**Modified files (docker):**
- `docker/src/shared.ts` — Support `TOON_CHAIN` env var as convenience shorthand

**Modified files (tests):**
- `packages/core/src/chain/chain-config.test.ts` — Enable all 9 ATDD tests, implement assertions

**Modified files (config):**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Update story status

### Risk Mitigations

- **E3-R004 (Chain Config Injection, score 6):** The `resolveChainConfig()` function ensures chainId comes from validated presets, not user input. The `buildEip712Domain()` helper uses the resolved chainId. Test 3.2-INT-001 verifies cross-chain signature rejection.
- **E3-R009 (viem/ethers coexistence, score 3):** Static analysis test 3.9-UNIT-001 enforces no ethers imports in Epic 3 code. The connector's ethers.js usage is intentionally excluded from the check (architectural debt per Decision 7).

### Test Design Traceability

| ATDD Test ID | Test Name | AC | Test-Design ID | Risk Link | Priority | Level |
|---|---|---|---|---|---|---|
| T-3.2-01 | `resolveChainConfig("anvil") returns local Anvil preset` | #1 | 3.2-UNIT-001 | E3-R004 | P0 | U |
| T-3.2-02 | `resolveChainConfig("arbitrum-sepolia") returns testnet preset` | #2 | 3.2-UNIT-001 | E3-R004 | P0 | U |
| T-3.2-03 | `resolveChainConfig("arbitrum-one") returns production preset` | #3 | 3.2-UNIT-001 | E3-R004 | P0 | U |
| T-3.2-04 | `TOON_CHAIN env var overrides config file chain selection` | #4 | 3.2-UNIT-002 | — | P1 | U |
| T-3.2-05 | `TOON_RPC_URL env var overrides preset RPC endpoint` | #4 | 3.2-UNIT-002 | — | P1 | U |
| T-3.2-06 | `unknown chain name throws clear error message` | #1, #2, #3 | 3.2-UNIT-003 | — | P1 | U |
| T-3.2-07 | `ChainPreset has all required fields` | #1, #2, #3 | 3.2-UNIT-004 | — | P2 | U |
| T-3.2-08 | `no ethers imports in Epic 3 code` | — | 3.9-UNIT-001 | E3-R009 | P2 | U (static) |
| T-3.2-09a | `EIP-712 domain separator uses resolved chainId` | #1 | 3.2-INT-001 | E3-R004, E3-R005 | P0 | I |
| T-3.2-09b | `EIP-3009 signature signed on wrong chain fails verification` | #1 | 3.2-INT-001 | E3-R004, E3-R005 | P0 | I |

### Import Patterns

```typescript
// New chain config module (created in Task 1)
import {
  resolveChainConfig,
  buildEip712Domain,
  CHAIN_PRESETS,
  type ChainPreset,
  type ChainName,
} from '@toon-protocol/core';

// Existing USDC constants (from Story 3.1)
import { MOCK_USDC_ADDRESS, USDC_DECIMALS } from '@toon-protocol/core';

// Existing EVM signer (uses chainId for EIP-712 domain)
import { EvmSigner } from '@toon-protocol/client';
```

### Critical Rules

- **Never hardcode chainId in EIP-712 domain separators** — always use `resolveChainConfig().chainId` (E3-R004 mitigation).
- **TOON_CHAIN env var overrides config parameter** — env vars are the deployment-time override mechanism.
- **Empty `tokenNetworkAddress` for staging/production** — TokenNetwork contracts are not yet deployed on Arbitrum Sepolia/One. The field exists but is empty until Epic 3 progresses to on-chain deployment.
- **`evm:base:` prefix for chain identifiers** — must match the existing format used by `docker/src/shared.ts` and the connector's settlement infrastructure.
- **viem-only for new code** — Decision 7 mandates viem for all new chain interaction code. The connector's ethers.js is architectural debt, not to be touched.
- **Never use `any` type** — use `unknown` with type guards.
- **Always use `.js` extensions in imports** — ESM requires explicit extensions.
- **Use consistent type imports** — `import type { X } from '...'` for type-only imports.
- **Return defensive copies** — `resolveChainConfig()` must return a new object to prevent shared-state mutation.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2 — FR-PROD-2 definition]
- [Source: _bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md#Decision 6 — Arbitrum One as Production Chain]
- [Source: _bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md#Decision 7 — viem for new code]
- [Source: _bmad-output/planning-artifacts/test-design-epic-3.md — Epic 3 test design with risk assessment]
- [Source: _bmad-output/test-artifacts/atdd-checklist-epic-3.md — ATDD Red Phase checklist (9 tests)]
- [Source: packages/core/src/chain/chain-config.test.ts — ATDD Red Phase tests (9 tests, all skipped)]
- [Source: packages/core/src/chain/usdc.ts — MOCK_USDC_ADDRESS constant]
- [Source: packages/client/src/signing/evm-signer.ts — EIP-712 domain separator pattern (getBalanceProofDomain)]
- [Source: docker/src/shared.ts — parseConfig() with SUPPORTED_CHAINS, TOKEN_NETWORK_*, PREFERRED_TOKEN_*]
- [Source: docker-compose-genesis.yml — Settlement env vars (evm:base:31337)]
- [Source: packages/town/src/town.ts — TownConfig with chainRpcUrls, tokenNetworks, preferredTokens]
- [Source: _bmad-output/project-context.md — Production Contracts (Arbitrum One)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- **ToonError constructor mismatch:** The `ToonError` class requires a `code` argument as the second parameter (`constructor(message: string, code: string, cause?: Error)`). Initial implementation called it with only one argument, causing a DTS build error. Fixed by adding `'INVALID_CHAIN'` error code.
- **Prettier formatting:** `town.ts` had a formatting issue after edits (long ternary expressions). Fixed with `prettier --write`.

### Completion Notes List

- **Task 1 (chain-config.ts):** Created `packages/core/src/chain/chain-config.ts` with `ChainPreset` interface, `ChainName` type, `CHAIN_PRESETS` map (anvil, arbitrum-sepolia, arbitrum-one), and `resolveChainConfig()` function. Imports `MOCK_USDC_ADDRESS` from `./usdc.js` to avoid hardcoding. Returns defensive copies. Supports `TOON_CHAIN`, `TOON_RPC_URL`, and `TOON_TOKEN_NETWORK` env var overrides.
- **Task 2 (buildEip712Domain):** Added `buildEip712Domain()` to `chain-config.ts`. Returns `{ name: 'TokenNetwork', version: '1', chainId, verifyingContract }` matching the existing `getBalanceProofDomain()` pattern in `evm-signer.ts`. Uses plain `string` for `verifyingContract` (not viem `Hex`) to keep core viem-free per Decision 7.
- **Task 3 (core exports):** Added exports for `resolveChainConfig`, `buildEip712Domain`, `CHAIN_PRESETS`, `ChainPreset`, `ChainName` to `packages/core/src/index.ts`.
- **Task 4 (TownConfig integration):** Added optional `chain?: string` field to `TownConfig`. In `startTown()`, calls `resolveChainConfig(config.chain)` and auto-populates `chainRpcUrls`, `preferredTokens`, and `tokenNetworks` from the resolved chain preset when not explicitly set. Uses `evm:base:<chainId>` key format to match existing convention.
- **Task 5 (NodeConfig integration):** Added optional `chain?: string` field to `NodeConfig`. In `createNode()`, calls `resolveChainConfig(config.chain)` and auto-populates `settlementInfo` from the resolved chain preset when not explicitly provided. Uses `effectiveSettlementInfo` local variable to avoid mutating the config parameter.
- **Task 6 (docker/shared.ts):** Added `TOON_CHAIN` support as a fallback when `SUPPORTED_CHAINS` is not set. If `TOON_CHAIN` is set, `resolveChainConfig()` derives the settlement config automatically. `SUPPORTED_CHAINS` (explicit) always wins over `TOON_CHAIN` (convenience).
- **Task 7 (ATDD tests):** Enabled all 14 tests in `chain-config.test.ts` (13 from spec + 1 additional CHAIN_PRESETS completeness test). Removed `.skip`, uncommented imports, implemented all assertions, removed placeholder `expect(true).toBe(false)`. Static analysis test scans `packages/{core,sdk,town}/src/` for ethers imports.
- **Task 8 (sprint status):** Updated `sprint-status.yaml` from `ready-for-dev` to `done`. Verified: `pnpm build` (success), `pnpm lint` (0 errors, 349 pre-existing warnings), `pnpm format:check` (pass), `pnpm test` (1358 passing, 0 regressions).

### File List

**New files:**
- `packages/core/src/chain/chain-config.ts` -- Chain presets, `resolveChainConfig()`, `buildEip712Domain()`

**Modified files (source):**
- `packages/core/src/index.ts` -- Added chain-config exports
- `packages/town/src/town.ts` -- Added `chain` field to `TownConfig`, auto-populate settlement from chain preset
- `packages/sdk/src/create-node.ts` -- Added `chain` field to `NodeConfig`, auto-populate settlementInfo

**Modified files (docker):**
- `docker/src/shared.ts` -- Support `TOON_CHAIN` env var as convenience shorthand

**Modified files (tests):**
- `packages/core/src/chain/chain-config.test.ts` -- Enabled all 14 ATDD tests, implemented assertions

**Modified files (config):**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Story status: `done`
- `_bmad-output/implementation-artifacts/3-2-multi-environment-chain-configuration.md` -- Dev Agent Record

### Change Log

| Date | Summary |
|------|---------|
| 2026-03-13 | Story 3.2 implementation complete. Created multi-environment chain configuration system with 3 presets (anvil, arbitrum-sepolia, arbitrum-one), `resolveChainConfig()` with env var overrides, `buildEip712Domain()` helper, and integration with TownConfig, NodeConfig, and Docker shared config. 14 ATDD tests passing, 0 regressions across full suite (1358 tests). |
| 2026-03-13 | Code review passed (Claude Opus 4.6). 2 issues found and fixed: (1) Medium: `!request.amount` truthiness bug in SDK standalone mode HTTP handler (create-node.ts line 562) — same bug as Epic 2 retro A1, fixed with `=== undefined \|\| === null` pattern matching town.ts; (2) Low: sprint-status.yaml updated from `review` to `done`. 0 critical, 0 high, 1 medium, 1 low. Full suite green: 1365 tests passing, 0 regressions. |
| 2026-03-13 | Code review pass #2 completed (Claude Opus 4.6). 0 issues found — implementation is clean. 0 critical, 0 high, 0 medium, 0 low. |
| 2026-03-13 | Code review pass #3 (final) completed (Claude Opus 4.6). Clean pass with OWASP security review. 0 issues found. 0 critical, 0 high, 0 medium, 0 low. |

## Code Review Record

### Review Pass #1

| Field | Value |
|-------|-------|
| **Date** | 2026-03-13 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Outcome** | PASS — all issues fixed during review |
| **Issues Found** | 2 total |
| **Critical** | 0 |
| **High** | 0 |
| **Medium** | 1 |
| **Low** | 1 |

**Issues Detail:**

1. **Medium — `!request.amount` truthiness bug (create-node.ts):** The SDK standalone mode HTTP handler used `!request.amount` to check for missing amount, which would incorrectly evaluate to `true` when `amount` is `0` (a valid falsy value). Fixed by replacing with `=== undefined || === null` pattern, matching the existing fix in `town.ts`. Same class of bug as Epic 2 retro action item A1.

2. **Low — Sprint status not updated (sprint-status.yaml):** Sprint status for story 3-2 was still set to `review` instead of `done` after dev completion. Updated to `done`.

**Review Follow-ups (AI):** None — all issues were fixed during the review pass. No outstanding action items.

### Review Pass #2

| Field | Value |
|-------|-------|
| **Date** | 2026-03-13 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Outcome** | PASS — no issues found |
| **Issues Found** | 0 total |
| **Critical** | 0 |
| **High** | 0 |
| **Medium** | 0 |
| **Low** | 0 |

**Issues Detail:** None. The implementation is clean. No issues were found in this review pass.

**Review Follow-ups (AI):** None — clean pass, no action items.

### Review Pass #3

| Field | Value |
|-------|-------|
| **Date** | 2026-03-13 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Outcome** | PASS — no issues found, clean pass with OWASP security review |
| **Issues Found** | 0 total |
| **Critical** | 0 |
| **High** | 0 |
| **Medium** | 0 |
| **Low** | 0 |

**Issues Detail:** None. Clean pass with OWASP security review. No issues found.

**Review Follow-ups (AI):** None — clean pass, no action items.
