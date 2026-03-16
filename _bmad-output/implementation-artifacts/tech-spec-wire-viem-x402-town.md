---
title: 'Wire viem clients in startTown() for production x402'
slug: 'wire-viem-x402-town'
created: '2026-03-16'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['viem ^2.47.2', 'viem/accounts', 'typescript', '@crosstown/town', 'vitest']
files_to_modify: ['packages/town/src/town.ts', 'packages/town/src/town.test.ts', '_bmad-output/project-context.md']
code_patterns: ['conditional-wiring', 'identity-derivation', 'defineChain', 'privateKeyToAccount', 'static-analysis-tests', 'best-effort-key-zeroing']
test_patterns: ['vitest', 'static-source-analysis', 'ordering-validation', 'Given/When/Then']
---

# Tech-Spec: Wire viem clients in startTown() for production x402

**Created:** 2026-03-16

## Overview

### Problem Statement

When `x402Enabled: true`, `startTown()` creates the x402 handler without `walletClient` or `publicClient`. Pre-flight checks 2 (USDC balance) and 3 (nonce freshness) silently skip due to `if (config.publicClient)` guards in `x402-preflight.ts`. Settlement hits the `!config.walletClient` guard at `x402-publish-handler.ts:230` and returns HTTP 500. The x402 endpoint is structurally complete but functionally dead in production. This has been carried as retro action item A7 since Epic 3.

### Solution

When `x402Enabled` is true, derive the EVM private key hex from `identity.secretKey`, create a viem `publicClient` (for read-only RPC calls) and `walletClient` (for on-chain settlement tx submission) using `chainConfig.rpcUrl`, and pass both to `createX402Handler()`. Skip creation when x402 is disabled.

### Scope

**In Scope:**
- Derive EVM private key hex from `identity.secretKey` in `startTown()`
- Conditionally create `publicClient` and `walletClient` when `x402Enabled` is true
- Pass both clients to `createX402Handler()`
- Best-effort zeroing of intermediate key material (matches `fromMnemonic()` pattern)
- Error handling for key derivation failure
- Tests verifying clients are wired when x402 enabled, and not created when disabled
- Update `project-context.md` to remove stale "not wired" notes

**Out of Scope:**
- Separate `facilitatorPrivateKey` config option (use node identity)
- ETH balance monitoring for gas (retro A8)
- Docker entrypoint updates (retro A10)
- FiatTokenV2_2 deployment on Anvil with 6 decimals (retro A3)
- RPC reachability check at startup (deferred — viem transport errors surface on first x402 request)

## Context for Development

### Codebase Patterns

**Identity derivation:** `startTown()` derives identity at `town.ts:448`:
```typescript
const identity: NodeIdentity = hasMnemonic
  ? fromMnemonic(config.mnemonic as string)
  : fromSecretKey(config.secretKey as Uint8Array);
```
`identity.secretKey` is a 32-byte `Uint8Array`. `identity.evmAddress` is the EIP-55 checksummed address.

**Chain config resolution:** At `town.ts:478`:
```typescript
const chainConfig = resolveChainConfig(config.chain);
```
Returns `ChainPreset` with `{ name, chainId, rpcUrl, usdcAddress, tokenNetworkAddress }`.

**x402 handler creation:** At `town.ts:756`, the handler is created without `walletClient`/`publicClient`:
```typescript
const x402Handler = createX402Handler({
  x402Enabled, chainConfig, basePricePerByte, routingBufferPercent,
  facilitatorAddress: config.facilitatorAddress ?? identity.evmAddress,
  ownPubkey: identity.pubkey, devMode, eventStore, ilpClient,
  // MISSING: walletClient, publicClient
});
```

**Key material zeroing pattern** (from `sdk/src/identity.ts:107-114`):
```typescript
} finally {
  // Best-effort zeroing of the intermediate seed to reduce the window
  // during which sensitive material remains in memory.
  if (seed) {
    seed.fill(0);
  }
}
```
The same pattern must be applied to the intermediate `Buffer` used for hex conversion.

**Test ordering validation pattern** (from `town.test.ts:726-731`):
```typescript
const kind10032Idx = source.indexOf('kind === ILP_PEER_INFO_KIND');
const kind10035Idx = source.indexOf('buildServiceDiscoveryEvent');
expect(kind10032Idx).toBeGreaterThan(-1);
expect(kind10035Idx).toBeGreaterThan(-1);
expect(kind10032Idx).toBeLessThan(kind10035Idx);
```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/town/src/town.ts:22-82` | Imports — add viem imports here |
| `packages/town/src/town.ts:448-450` | Identity derivation — `identity.secretKey` available after this |
| `packages/town/src/town.ts:464` | `x402Enabled` resolved here |
| `packages/town/src/town.ts:478` | `chainConfig` resolved here |
| `packages/town/src/town.ts:745-766` | Insertion point — between ILP client creation and x402 handler creation |
| `packages/town/src/town.test.ts` | Test file — add static analysis tests |
| `packages/town/src/handlers/x402-publish-handler.ts:49-81` | `X402HandlerConfig` — accepts `walletClient?` and `publicClient?` |
| `packages/town/src/handlers/x402-publish-handler.ts:230` | Guard: `!config.settle && !config.walletClient` returns 500 |
| `packages/town/src/handlers/x402-preflight.ts:123,141` | Guards: `if (config.publicClient)` skips checks 2-3 |
| `_bmad-output/project-context.md:858,1096` | Stale "not wired" notes to update |

### Technical Decisions

- **Derive EVM key from existing identity:** `identity.secretKey` is the same secp256k1 key used for both Nostr and EVM. Convert to `0x`-prefixed hex for viem's `privateKeyToAccount()`.
- **Conditional creation:** Only create viem clients when `x402Enabled` is true. This avoids unnecessary RPC connections for nodes that don't use x402.
- **Use `chainConfig.rpcUrl` for transport:** Already resolved with env var overrides (`CROSSTOWN_RPC_URL`). Pass only to `http()` transport — do not duplicate in `defineChain()` `rpcUrls` field.
- **Chain definition:** Use viem's `defineChain()` with `chainConfig.chainId` and `chainConfig.rpcUrl`.
- **No new config fields:** The private key comes from the node identity, the RPC URL comes from the chain config. No new `TownConfig` fields needed.
- **Use explicit viem types:** Import `type { WalletClient, PublicClient }` from viem for variable declarations, matching the types used in `X402HandlerConfig`.
- **Best-effort key material zeroing:** Zero the intermediate `Buffer` in a `finally` block, consistent with `fromMnemonic()` pattern. JS strings (the hex string) are immutable and cannot be zeroed — document this as a known limitation.
- **Error handling:** Wrap `privateKeyToAccount()` in try/catch with a clear error message for startup failures.
- **Static analysis tests with ordering:** Use `indexOf()` ordering checks (not just `toContain()`) to verify the viem wiring appears at the correct location in the source.

## Implementation Plan

### Tasks

- [x] Task 1: Add viem imports to `town.ts`
  - File: `packages/town/src/town.ts` (imports section, lines 22-82)
  - Action: Add the following imports:
    ```typescript
    import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
    import type { WalletClient, PublicClient } from 'viem';
    import { privateKeyToAccount } from 'viem/accounts';
    ```
  - Notes: viem is already a dependency. Value imports for functions, type-only import for `WalletClient`/`PublicClient` per project convention (`@typescript-eslint/consistent-type-imports`).

- [x] Task 2: Create viem clients conditionally before x402 handler creation
  - File: `packages/town/src/town.ts` (insert between lines 753 and 755, after ILP client creation and before x402 handler creation)
  - Action: Add a conditional block that creates `walletClient` and `publicClient` only when `x402Enabled` is true, with key zeroing and error handling:
    ```typescript
    // --- 10c. viem clients for x402 settlement (conditional) ---
    let x402WalletClient: WalletClient | undefined;
    let x402PublicClient: PublicClient | undefined;

    if (x402Enabled) {
      // Derive EVM private key from node identity (same secp256k1 key)
      // Best-effort zeroing of intermediate Buffer; hex string is immutable
      // and cannot be zeroed (JS limitation, same as fromMnemonic pattern).
      let keyBuffer: Buffer | undefined;
      try {
        keyBuffer = Buffer.from(identity.secretKey);
        const privateKeyHex = `0x${keyBuffer.toString('hex')}` as `0x${string}`;
        const account = privateKeyToAccount(privateKeyHex);
        const viemChain = defineChain({
          id: chainConfig.chainId,
          name: chainConfig.name,
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: { default: { http: [chainConfig.rpcUrl] } },
        });

        x402PublicClient = createPublicClient({ chain: viemChain, transport: http(chainConfig.rpcUrl) });
        x402WalletClient = createWalletClient({ account, chain: viemChain, transport: http(chainConfig.rpcUrl) });
      } catch (error: unknown) {
        throw new Error(
          `x402 initialization failed: could not derive EVM account from identity key: ${error instanceof Error ? error.message : String(error)}`
        );
      } finally {
        if (keyBuffer) {
          keyBuffer.fill(0);
        }
      }
    }
    ```
  - Notes: `WalletClient`/`PublicClient` types match `X402HandlerConfig`. `keyBuffer.fill(0)` in `finally` block follows the `fromMnemonic()` zeroing pattern. The hex string cannot be zeroed (JS immutable strings) — documented in comment.

- [x] Task 3: Pass viem clients to `createX402Handler()`
  - File: `packages/town/src/town.ts` (the `createX402Handler()` call, currently at line 756)
  - Action: Add `walletClient` and `publicClient` to the config object:
    ```typescript
    const x402Handler = createX402Handler({
      x402Enabled,
      chainConfig,
      basePricePerByte,
      routingBufferPercent,
      facilitatorAddress: config.facilitatorAddress ?? identity.evmAddress,
      ownPubkey: identity.pubkey,
      devMode,
      eventStore,
      ilpClient,
      walletClient: x402WalletClient,
      publicClient: x402PublicClient,
    });
    ```
  - Notes: When `x402Enabled` is false, both are `undefined`, which is the existing behavior (no change). When true, both are live viem clients.

- [x] Task 4: Add static analysis tests
  - File: `packages/town/src/town.test.ts`
  - Action: Add a new `describe` block with static analysis tests that verify the viem wiring exists in `town.ts`, using ordering validation:
    ```typescript
    describe('startTown() x402 viem client wiring -- static analysis', () => {
      const sourcePath = resolve(__dirname, 'town.ts');
      const source = readFileSync(sourcePath, 'utf-8');

      it('imports createPublicClient and createWalletClient from viem', () => {
        expect(source).toContain('createPublicClient');
        expect(source).toContain('createWalletClient');
        expect(source).toMatch(/from 'viem'/);
      });

      it('imports privateKeyToAccount from viem/accounts', () => {
        expect(source).toContain('privateKeyToAccount');
        expect(source).toMatch(/from 'viem\/accounts'/);
      });

      it('imports WalletClient and PublicClient types from viem', () => {
        expect(source).toMatch(/import type\s*\{[^}]*WalletClient[^}]*\}\s*from 'viem'/);
        expect(source).toMatch(/import type\s*\{[^}]*PublicClient[^}]*\}\s*from 'viem'/);
      });

      it('creates viem clients inside x402Enabled conditional, after ILP client and before handler', () => {
        const ilpClientIdx = source.indexOf('createHttpIlpClient');
        const viemBlockIdx = source.indexOf('privateKeyToAccount');
        const handlerIdx = source.indexOf('createX402Handler');
        expect(ilpClientIdx).toBeGreaterThan(-1);
        expect(viemBlockIdx).toBeGreaterThan(-1);
        expect(handlerIdx).toBeGreaterThan(-1);
        // Ordering: ILP client < viem block < x402 handler
        expect(viemBlockIdx).toBeGreaterThan(ilpClientIdx);
        expect(handlerIdx).toBeGreaterThan(viemBlockIdx);
      });

      it('passes x402WalletClient and x402PublicClient to createX402Handler', () => {
        expect(source).toMatch(/walletClient:\s*x402WalletClient/);
        expect(source).toMatch(/publicClient:\s*x402PublicClient/);
      });

      it('zeroes key material buffer in finally block', () => {
        expect(source).toContain('keyBuffer.fill(0)');
        expect(source).toContain('finally');
      });

      it('wraps privateKeyToAccount in try/catch with descriptive error', () => {
        expect(source).toContain('x402 initialization failed');
      });

      it('viem client creation is inside x402Enabled guard, not top-level', () => {
        // Find the x402Enabled conditional that contains viem wiring
        const x402CondIdx = source.indexOf('if (x402Enabled) {', source.indexOf('10c'));
        const createPublicIdx = source.indexOf('createPublicClient({', x402CondIdx);
        const createWalletIdx = source.indexOf('createWalletClient({', x402CondIdx);
        expect(x402CondIdx).toBeGreaterThan(-1);
        expect(createPublicIdx).toBeGreaterThan(x402CondIdx);
        expect(createWalletIdx).toBeGreaterThan(x402CondIdx);
      });
    });
    ```
  - Notes: Uses ordering validation (F7 fix) and verifies disabled-case structure (F8 fix). Tests key zeroing and error handling patterns.

- [x] Task 5: Update `project-context.md` to remove stale notes
  - File: `_bmad-output/project-context.md`
  - Action: Update the following entries:
    - Line ~858: Change "Not wired in startTown()" to "Wired in startTown() when x402Enabled is true (Quick-Spec wire-viem-x402-town)"
    - Line ~1096: Change "x402 viem clients not wired in startTown()" to "x402 viem clients wired in startTown() conditionally when x402Enabled (Quick-Spec wire-viem-x402-town)"
    - Line ~1176 (A7 action item): Mark as RESOLVED
  - Notes: Prevents stale documentation from misleading future developers.

- [x] Task 6: Verify build and tests pass
  - Action: Run `pnpm build` and `pnpm test` in `packages/town` to confirm no regressions.

### Acceptance Criteria

- [x] AC 1: Given `x402Enabled: true` in `TownConfig`, when `startTown()` executes, then a `publicClient` is created with `chainConfig.rpcUrl` as transport and passed to `createX402Handler()`.
- [x] AC 2: Given `x402Enabled: true` in `TownConfig`, when `startTown()` executes, then a `walletClient` is created with the node's EVM private key (derived from `identity.secretKey`) and passed to `createX402Handler()`.
- [x] AC 3: Given `x402Enabled: false` (or omitted, default) in `TownConfig`, when `startTown()` executes, then no viem clients are created and `walletClient`/`publicClient` are `undefined` in the handler config.
- [x] AC 4: Given the viem clients are wired, when the x402 handler receives a request with `X-PAYMENT` header, then pre-flight checks 2 (USDC balance) and 3 (nonce freshness) execute instead of being skipped.
- [x] AC 5: Given the viem clients are wired, when the x402 handler reaches settlement, then `walletClient.writeContract()` is called instead of hitting the 500 guard.
- [x] AC 6: Given the implementation, when `pnpm build && pnpm test` runs in `packages/town`, then all existing tests pass with zero regressions and new static analysis tests pass.
- [x] AC 7: Given the implementation, when a developer reads `project-context.md`, then the x402 wiring status reflects the current state (no stale "not wired" notes).

## Additional Context

### Dependencies

- `viem` ^2.47.2 (already in `@crosstown/town` dependencies)
- `viem/accounts` for `privateKeyToAccount()` (part of viem package)
- No new npm dependencies required

### Testing Strategy

**Static analysis tests (new):** 8 tests verifying source-level patterns in `town.ts` — imports (including type imports), ordering validation (ILP client < viem block < x402 handler), conditional guard structure, handler wiring, key zeroing, and error handling. This follows the established pattern from Story 3.5 tests, enhanced with `indexOf()` ordering checks.

**Existing test coverage (unchanged):**
- `x402-publish-handler.test.ts` — 40+ tests covering the handler with injected mock clients (pricing, preflight, settlement, error cases)
- `x402-preflight.test.ts` — Pre-flight check tests with mock `publicClient`
- `x402-settlement.test.ts` — Settlement tests with mock `walletClient`
- `town.test.ts` — Config validation and static analysis for other features

**E2E validation (manual, optional):** After implementation, the x402 demo example (separate work) will serve as the E2E validation — publishing an event via HTTP 402 with actual on-chain USDC settlement on Anvil.

### Notes

- Retro action item A7 (Epic 3, carried through Epic 4) — resolved by this spec
- Risk register R10 (Medium severity) — closed by this spec
- This is a prerequisite for the x402 demo example planned in the examples directory
- AC 4 and AC 5 are implicitly validated by composition: with real clients wired, the existing `if (config.publicClient)` and `!config.walletClient` guards in the handler naturally activate. No handler code changes needed. Full E2E coverage deferred to the demo example.
- **Known limitation (F1/security):** The hex string produced by `Buffer.toString('hex')` is a JS immutable string and cannot be zeroed. The intermediate `Buffer` IS zeroed in a `finally` block. This matches the project's "best-effort, JS has no secure-erase" pattern from `fromMnemonic()`.
- **Known limitation (F4/RPC):** No RPC reachability check at startup. If `chainConfig.rpcUrl` is unreachable, pre-flight checks 2-3 will fail with viem transport errors on first x402 request. This is acceptable for now — a startup health check for the RPC is a separate concern (out of scope).

### Adversarial Review Findings Addressed (Spec Phase)

| ID | Severity | Fix Applied |
|----|----------|-------------|
| F1 | Critical | Added `keyBuffer.fill(0)` in `finally` block + documented hex string limitation |
| F3 | High | Changed to `import type { WalletClient, PublicClient }` from viem |
| F5 | High | Added Task 5 to update `project-context.md` + AC 7 |
| F7 | Medium | Replaced string-presence tests with `indexOf()` ordering validation |
| F8 | Medium | Added test verifying `createPublicClient`/`createWalletClient` inside `x402Enabled` guard |
| F11 | Medium | Added try/catch with descriptive error message |
| F12 | Low | Dropped Task 4 (comment renumbering) entirely |

### Implementation Review Notes

- Adversarial code review completed (12 findings)
- Findings: 12 total, 4 fixed, 8 skipped (noise/architecture/established patterns)
- Resolution approach: walk-through

| ID | Severity | Resolution |
|----|----------|-----------|
| F4 | Low | Fixed — clarifying comment that Buffer.from(TypedArray) copies, not aliases |
| F6 | Low | Fixed — removed redundant RPC URL from defineChain |
| F8 | High | Fixed — replaced brittle `'10c'` anchor with unique section comment |
| F11 | Low | Fixed — verify `fill(0)` appears after `finally` keyword positionally |
