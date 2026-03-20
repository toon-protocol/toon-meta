# Story 3.3: x402 /publish Endpoint

Status: done

## Story

As an **HTTP client or AI agent**,
I want to publish Nostr events to any relay in the network via a simple HTTP endpoint with USDC payment,
So that I can interact with TOON without understanding ILP or running an ILP client.

**FRs covered:** FR-PROD-3 (x402 HTTP payment on-ramp: 402 negotiation, EIP-3009 gasless USDC authorization, ILP PREPARE construction, multi-hop routing)

**Dependencies:** Story 3.1 (USDC denomination -- provides `MOCK_USDC_ADDRESS`, `USDC_DECIMALS`, mock USDC on Anvil), Story 3.2 (Arbitrum chain config -- provides `resolveChainConfig()`, `ChainPreset`, `buildEip712Domain()`)

**Decision source:** Party Mode Decision 8 -- "x402 Integration Architecture (FINAL)" (see `_bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md`). Decision 2 -- "Dual Payment Rail -- ILP Primary, x402 Optional". Decision 13 -- "Component Boundary Clarification" (x402 `/publish` is a TOON node responsibility, not BLS).

## Acceptance Criteria

1. Given a TOON node with x402 enabled (`TOON_X402_ENABLED=true` or `x402Enabled: true` in TownConfig), when an HTTP client sends `GET /publish` with a Nostr event payload but without an `X-PAYMENT` header, then the node returns HTTP 402 with pricing information (amount in USDC, facilitator EVM address, payment network `eip-3009`, chainId from resolved chain config).

2. Given the 402 response, when the client signs an EIP-3009 gasless USDC `transferWithAuthorization` and retries with the `X-PAYMENT` header containing the signed authorization, then the node:
   - Runs 6 pre-flight validation checks (all free, no on-chain tx): (1) EIP-3009 signature verification off-chain, (2) USDC balance check, (3) nonce freshness check, (4) TOON shallow parse, (5) Schnorr signature verification, (6) destination reachability check
   - Settles the USDC transfer on-chain via `transferWithAuthorization`
   - Constructs an ILP PREPARE packet with the TOON-encoded event as data
   - Routes the PREPARE through the connector to the destination relay

3. Given the destination relay's BLS receives the ILP PREPARE, when `/handle-packet` processes it, then the packet is indistinguishable from one sent via the ILP rail (packet equivalence via shared `buildIlpPrepare()` function), and the event is stored and a FULFILL is returned.

4. Given the FULFILL propagates back, when the node receives it, then the node returns HTTP 200 with the event ID and settlement transaction hash.

5. Given the destination relay is multiple hops away, when the node needs to price the request, then the node reads the destination's kind:10032 event for ILP address and pricing info, adds a configurable routing buffer (default 10%) for multi-hop overhead, and returns the all-in USDC price in the 402 response.

6. Given x402 is disabled (default), when an HTTP client sends `GET /publish`, then the endpoint returns 404.

7. Given a settlement tx that reverts (e.g., insufficient USDC balance), when the on-chain transfer fails, then no ILP PREPARE is sent and the response indicates payment failure.

8. Given a settlement that succeeds but the ILP PREPARE is rejected by the destination, when the FULFILL is not returned, then the node returns HTTP 200 with the settlement transaction hash and a `deliveryStatus: 'rejected'` field. **No refund is initiated** -- payment is for the routing attempt, not delivery guarantee. This mirrors ILP semantics.

## Tasks / Subtasks

- [x] Task 1: Create `buildIlpPrepare()` shared function in `@toon-protocol/core` (AC: #3)
  - [x] Create `packages/core/src/x402/build-ilp-prepare.ts`:
    ```typescript
    interface BuildIlpPrepareParams {
      destination: string;
      amount: bigint;
      data: Uint8Array; // TOON-encoded event bytes
      expiresAt?: Date; // default: 30 seconds from now
    }

    function buildIlpPrepare(params: BuildIlpPrepareParams): {
      destination: string;
      amount: string;
      data: string; // base64
    }
    ```
  - [x] This function is the **single point of truth** for constructing ILP PREPARE packet parameters. Both the x402 `/publish` handler and the existing `publishEvent()` in the SDK must use it (or produce equivalent output).
  - [x] Implementation: Convert `amount` to string, encode `data` to base64, pass through `destination`. This is deliberately simple -- the value is in having ONE function both paths call, not in complex logic.
  - [x] Export from `packages/core/src/index.ts`.
  - [x] Create `packages/core/src/x402/index.ts` barrel export.
  - [x] **IMPORTANT:** The existing `publishEvent()` in `packages/sdk/src/create-node.ts` (line 752-768) currently constructs the ILP packet inline: `{ destination, amount: String(amount), data: base64Data }`. After this task, both paths should use `buildIlpPrepare()` or produce identical output. Refactoring `publishEvent()` to call `buildIlpPrepare()` is recommended but can be done in a follow-up if it introduces risk.

- [x] Task 2: Create x402 pricing calculator (AC: #1, #5)
  - [x] Create `packages/town/src/handlers/x402-pricing.ts`:
    ```typescript
    interface X402PricingConfig {
      basePricePerByte: bigint;
      routingBufferPercent: number; // default: 10 (meaning 10%)
    }

    function calculateX402Price(config: X402PricingConfig, toonLength: number): bigint
    ```
  - [x] Formula: `price = basePricePerByte * BigInt(toonLength) + (basePricePerByte * BigInt(toonLength) * BigInt(routingBufferPercent) / 100n)`
  - [x] The routing buffer covers multi-hop overhead -- intermediate relays charge their own per-byte fees. 10% default is a conservative estimate per Party Mode Decision 8.
  - [x] Export from `packages/town/src/index.ts` (public API for relay operators who want to customize pricing).

- [x] Task 3: Create pre-flight validation pipeline (AC: #2, #8)
  - [x] Create `packages/town/src/handlers/x402-preflight.ts`:
    ```typescript
    interface PreflightResult {
      passed: boolean;
      failedCheck?: string; // which check failed
      checksPerformed: string[];
    }

    interface PreflightConfig {
      chainConfig: ChainPreset;
      basePricePerByte: bigint;
      ownPubkey: string;
      devMode: boolean;
    }

    async function runPreflight(
      authorization: Eip3009Authorization,
      toonData: string, // base64-encoded TOON
      destination: string,
      config: PreflightConfig
    ): Promise<PreflightResult>
    ```
  - [x] Implement 6 checks in order (all free -- no on-chain transactions):
    1. **EIP-3009 signature verification (off-chain):** Recover signer from the EIP-712 typed data signature. Verify recovered address matches `authorization.from`. Uses viem's `verifyTypedData()` or equivalent.
    2. **USDC balance check:** Read `balanceOf(from)` on the USDC contract. Verify balance >= authorization value. This is a read-only call (no gas).
    3. **Nonce freshness check:** Read `authorizationState(from, nonce)` on the USDC contract. Verify the nonce has not been used. Read-only call.
    4. **TOON shallow parse:** Decode base64, call `shallowParseToon()` from `@toon-protocol/core/toon`. Verify the TOON data is valid format.
    5. **Schnorr signature verification:** Verify the Nostr event signature via the SDK verification pipeline (`createVerificationPipeline`). In devMode, this is skipped.
    6. **Destination reachability check:** Verify the destination ILP address is known (has a kind:10032 peer info event in the relay's EventStore or a route via the connector). This prevents gas spending on packets that will F02 (no route).
  - [x] If any check fails, return immediately with `{ passed: false, failedCheck: '<check name>' }`. No on-chain transaction is executed.
  - [x] **Gas griefing mitigation (E3-R008):** All 6 checks are free. Bad actors cannot drain the facilitator's ETH by submitting deliberately-failing authorizations, because the failure is caught before any on-chain tx.
  - [x] **NOTE on viem dependency:** This is the first module in `@toon-protocol/town` to use viem for on-chain reads. Add `viem` as a dependency to `packages/town/package.json`. The core package remains viem-free per Decision 7.

- [x] Task 4: Create EIP-3009 settlement module (AC: #2, #4, #7)
  - [x] Create `packages/town/src/handlers/x402-settlement.ts`:
    ```typescript
    interface SettlementResult {
      success: boolean;
      txHash?: string;
      error?: string;
    }

    interface SettlementConfig {
      chainConfig: ChainPreset;
      walletClient: WalletClient; // viem wallet client for the facilitator
    }

    async function settleEip3009(
      authorization: Eip3009Authorization,
      config: SettlementConfig
    ): Promise<SettlementResult>
    ```
  - [x] Implementation: Call `transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)` on the USDC contract via the wallet client.
  - [x] The `to` address is the facilitator's EVM address (the node operator). The facilitator collects USDC for routing the ILP packet.
  - [x] On revert (insufficient balance, used nonce, expired auth): return `{ success: false, error: '<revert reason>' }`.
  - [x] On success: return `{ success: true, txHash: '0x...' }`.
  - [x] **Settlement atomicity (E3-R006):** If `settleEip3009()` fails, no ILP PREPARE is constructed. If it succeeds but the ILP PREPARE is rejected, no refund -- the facilitator keeps the USDC.

- [x] Task 5: Create x402 handler and wire to Hono routes (AC: #1, #2, #3, #4, #5, #6, #7, #8)
  - [x] Create `packages/town/src/handlers/x402-publish-handler.ts`:
    ```typescript
    interface X402HandlerConfig {
      x402Enabled: boolean;
      chainConfig: ChainPreset;
      basePricePerByte: bigint;
      routingBufferPercent: number;
      facilitatorAddress: string; // node operator's EVM address
      ownPubkey: string;
      devMode: boolean;
      ilpClient: IlpClient;
      eventStore: EventStore; // for destination reachability check
      buildPrepare: typeof buildIlpPrepare;
      toonEncoder: (event: NostrEvent) => Uint8Array;
    }

    function createX402Handler(config: X402HandlerConfig): {
      handlePublish: (c: Context) => Promise<Response>;
    }
    ```
  - [x] **Route: GET /publish** (on the BLS HTTP server, same Hono app as `/health` and `/handle-packet`):
    - If `x402Enabled` is false: return 404.
    - If no `X-PAYMENT` header: compute price from request body's TOON payload, return 402 with:
      ```json
      {
        "amount": "<price in USDC micro-units>",
        "facilitatorAddress": "<node's EVM address>",
        "paymentNetwork": "eip-3009",
        "chainId": <from resolved chain config>,
        "usdcAddress": "<USDC contract address>"
      }
      ```
    - If `X-PAYMENT` header present: parse the EIP-3009 authorization from the header, run pre-flight checks, settle on-chain, build ILP PREPARE, send via connector, return result.
  - [x] **HTTP response codes:**
    - 402: Pricing response (no payment provided)
    - 200: Success (settlement + ILP FULFILL, OR settlement + ILP REJECT with `deliveryStatus: 'rejected'`)
    - 400: Invalid request (bad TOON, bad EIP-3009 auth, pre-flight failure)
    - 404: x402 disabled
    - 500: Internal error (generic message, CWE-209)
  - [x] **Request format:** The Nostr event is sent as the request body (JSON with `event` field containing the unsigned/signed Nostr event, and `destination` field for the target ILP address). The handler TOON-encodes the event before routing.
    ```typescript
    interface X402PublishRequest {
      event: NostrEvent; // signed Nostr event
      destination: string; // target ILP address
    }
    ```
  - [x] **Response format (200 success):**
    ```json
    {
      "eventId": "<64-char hex>",
      "settlementTxHash": "0x...",
      "deliveryStatus": "fulfilled" | "rejected",
      "refundInitiated": false
    }
    ```

- [x] Task 6: Integrate x402 handler with `startTown()` (AC: #1, #6)
  - [x] In `packages/town/src/town.ts`:
    - Add `x402Enabled?: boolean` field to `TownConfig` (default: `false`).
    - Add `routingBufferPercent?: number` field to `TownConfig` (default: `10`).
    - When `x402Enabled` is true:
      1. Create a viem `WalletClient` using the node's secret key and the resolved chain config's RPC URL.
      2. Create the x402 handler via `createX402Handler(config)`.
      3. Register `GET /publish` and `POST /publish` routes on the BLS Hono app.
    - When `x402Enabled` is false (default):
      1. Register `GET /publish` route that returns 404.
      2. No viem client created (no unnecessary dependency overhead).
  - [x] **IMPORTANT: Component boundary.** The `/publish` endpoint is on the TOON node (BLS Hono app, same server as `/health` and `/handle-packet`), NOT a separate HTTP server. Per Decision 13, the node owns all public-facing endpoints.
  - [x] **IMPORTANT: Hono concurrent HTTP + WS.** The BLS Hono server and the WebSocket relay run on different ports (default BLS: 3100, relay: 7100). The x402 handler is on the BLS port. If a future story merges them, the 3.7-INT-001 test (concurrent HTTP + WS on same port) validates that scenario. For now, they are separate ports.
  - [x] Update `TownInstance` to expose x402 status.

- [x] Task 7: Add `TOON_X402_ENABLED` env var support (AC: #6)
  - [x] In `packages/town/src/cli.ts`, add CLI flag `--x402-enabled` and env var `TOON_X402_ENABLED`.
  - [x] In `docker/src/shared.ts`, add `x402Enabled` to `parseConfig()` output.
  - [x] Propagate through to `TownConfig.x402Enabled`.

- [x] Task 8: Create EIP-3009 types and constants (AC: #2)
  - [x] Create `packages/town/src/handlers/x402-types.ts`:
    ```typescript
    interface Eip3009Authorization {
      from: string; // '0x...' EVM address
      to: string;   // '0x...' facilitator address
      value: bigint; // USDC amount in micro-units
      validAfter: number; // unix timestamp
      validBefore: number; // unix timestamp
      nonce: string; // '0x...' 32-byte nonce
      v: number;
      r: string; // '0x...' 32 bytes
      s: string; // '0x...' 32 bytes
    }

    // EIP-712 typed data for transferWithAuthorization
    const EIP_3009_TYPES = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    } as const;
    ```
  - [x] Export from `packages/town/src/index.ts`.

- [x] Task 9: Enable ATDD tests and make them pass (AC: all)
  - [x] In `packages/town/src/handlers/x402-publish-handler.test.ts`:
    - Uncomment and update imports to reference the new modules
    - Remove `.skip` from all 12 existing tests
    - Add T-3.3-13 test: `buildIlpPrepare()` sets `amount` field to match `basePricePerByte * toonData.length` so SDK pricing validator passes (P0, risk E3-R007)
    - Replace placeholder `expect(true).toBe(false)` assertions with real assertions
    - Wire mock connector, mock USDC contract reads, and mock viem wallet client
  - [x] **Test infrastructure:**
    - **Unit tests (pricing, preflight checks, buildIlpPrepare amount):** Mock viem contract reads, mock connector, mock EventStore. No Anvil needed.
    - **Integration tests (happy path, settlement):** Require either Anvil or comprehensive mocks. For CI without Anvil, use mocked viem clients that simulate contract behavior.
    - **Packet equivalence test (3.3-INT-003):** Call `buildIlpPrepare()` directly -- no mocks needed. This is a pure function test.
    - **Amount validation test (T-3.3-13):** Call `buildIlpPrepare()` with known inputs and verify `amount` field matches `basePricePerByte * toonData.length`. Pure function test.
  - [x] **E2E test (T-3.3-14, P3 -- deferred to nightly):** Full x402 E2E with genesis node (Anvil + Faucet + Connector + Relay). Not part of CI; requires running genesis infrastructure. Create stub in `packages/client/tests/e2e/` or `packages/town/tests/e2e/`.
  - [x] Run `pnpm test packages/town/src/handlers/x402-publish-handler.test.ts` -- all 13 unit/integration tests pass
  - [x] Run `pnpm test` -- full suite passes with no regressions

- [x] Task 10: Verify build, lint, format, and update sprint status (AC: all)
  - [x] Update `_bmad-output/implementation-artifacts/sprint-status.yaml`:
    - Change `3-3-x402-publish-endpoint: ready-for-dev` to `3-3-x402-publish-endpoint: done`
  - [x] Verify build: `pnpm build`
  - [x] Verify lint: `pnpm lint`
  - [x] Verify format: `pnpm format:check`
  - [x] Verify tests: `pnpm test` -- all tests pass, 0 regressions

## Dev Notes

### What This Story Does

This story adds an HTTP-native payment on-ramp to TOON via the x402 protocol pattern. x402 allows any HTTP client (AI agents, browsers, CLI tools) to publish Nostr events to the network by paying USDC, without understanding ILP or running an ILP client.

The x402 flow:
```
Client ──GET /publish + event──→ TOON Node
       ←── 402 { price, facilitator, network } ←─
Client ──GET /publish + X-PAYMENT + event──→ TOON Node
                                              ├── pre-flight (6 free checks)
                                              ├── settle USDC on-chain (EIP-3009)
                                              ├── buildIlpPrepare() → ILP PREPARE
                                              └──→ Connector ──→ ... ──→ Destination Relay
       ←── 200 { eventId, txHash } ←───────────────── FULFILL
```

The key architectural insight is that the x402 handler is a **bridge** between HTTP and ILP. Once the USDC payment is settled on-chain, the handler constructs the same ILP PREPARE packet that an ILP-native client would send. The destination relay cannot distinguish x402 packets from ILP packets -- they are byte-identical thanks to the shared `buildIlpPrepare()` function.

### What Changes

```
Before:
- Only ILP-native clients can publish events (require ILP client + payment channel)
- No HTTP API for event publication
- ILP PREPARE packets constructed inline in publishEvent()
- No gasless USDC payment support

After:
- HTTP clients can publish via GET /publish with x402 negotiation
- EIP-3009 gasless USDC authorization (no ETH needed by the client)
- Shared buildIlpPrepare() ensures packet equivalence across both rails
- 6-layer pre-flight validation prevents gas griefing
- No-refund-on-REJECT design simplifies implementation and prevents abuse
- x402 is opt-in per node (default: disabled)
```

### Scope Boundaries

**In scope:**
- `buildIlpPrepare()` shared function in `@toon-protocol/core`
- x402 pricing calculator with routing buffer
- Pre-flight validation pipeline (6 checks)
- EIP-3009 settlement module (on-chain USDC transfer)
- x402 publish handler with Hono route
- `TownConfig.x402Enabled` and `TownConfig.routingBufferPercent`
- `TOON_X402_ENABLED` env var
- EIP-3009 types and constants
- ATDD test enablement (13 unit/integration tests + 1 deferred E2E)

**Out of scope (handled by later stories or already done):**
- Mock USDC deployment on Anvil (Story 3.1 -- done)
- Chain configuration / RPC URLs (Story 3.2 -- done)
- kind:10035 service discovery (Story 3.5 -- advertises x402 endpoint)
- Enriched /health with x402 status (Story 3.6)
- Dual-protocol server on single port (3.7-INT-001 test is included but the current architecture uses separate ports; merging is a future optimization)
- Production FiatTokenV2_2 deployment (the mock USDC on Anvil has `transferWithAuthorization` if using the real Circle bytecode; otherwise a simplified ERC-20 stub suffices for the pre-flight and settlement patterns)

### x402 Protocol Flow (Detailed)

**Step 1: Price Discovery (402 Response)**

```
GET /publish HTTP/1.1
Content-Type: application/json

{ "event": { ... NostrEvent }, "destination": "g.toon.target-relay" }

→ HTTP 402 Payment Required
{
  "amount": "5500",            // USDC micro-units (basePricePerByte * toonLength * 1.10)
  "facilitatorAddress": "0x...", // node operator's EVM address
  "paymentNetwork": "eip-3009",
  "chainId": 42161,            // from resolveChainConfig()
  "usdcAddress": "0xaf88d..."  // USDC contract on this chain
}
```

**Step 2: Payment (X-PAYMENT Header)**

```
GET /publish HTTP/1.1
Content-Type: application/json
X-PAYMENT: {"from":"0x...","to":"0x...","value":"5500","validAfter":0,"validBefore":1710000000,"nonce":"0x...","v":27,"r":"0x...","s":"0x..."}

{ "event": { ... NostrEvent }, "destination": "g.toon.target-relay" }

→ HTTP 200 OK
{
  "eventId": "abc123...",
  "settlementTxHash": "0xdef456...",
  "deliveryStatus": "fulfilled",
  "refundInitiated": false
}
```

### Pre-flight Validation Order

The 6 pre-flight checks run in order of cheapest-to-most-expensive. All are free (no gas cost):

1. **EIP-3009 signature verify** -- Pure cryptography. Recover signer from EIP-712 typed data. If signer != `from`, reject immediately. Cost: ~1ms CPU.
2. **USDC balance check** -- `eth_call` to `balanceOf(from)`. Read-only, no gas. Cost: ~50ms RPC round-trip.
3. **Nonce freshness** -- `eth_call` to `authorizationState(from, nonce)`. Read-only, no gas. Cost: ~50ms RPC round-trip.
4. **TOON shallow parse** -- Decode base64, parse TOON header. Pure computation. Cost: ~0.1ms.
5. **Schnorr verify** -- Verify Nostr event signature. Pure cryptography. Cost: ~2ms CPU.
6. **Destination reachability** -- Check if destination ILP address is routable (known peer with kind:10032, or connector has a route). Local lookup. Cost: ~0.1ms.

**Ordering rationale:** Crypto checks first (fastest rejection for forged signatures), then balance/nonce (moderate cost, catches economically invalid requests), then TOON/Schnorr (validates the event itself), then reachability (prevents wasting gas on undeliverable packets).

### No-Refund Design Decision

**Decision:** If the USDC settlement succeeds on-chain but the ILP PREPARE is rejected by the destination relay, the facilitator (node operator) keeps the USDC. No refund is initiated.

**Rationale:**
1. **Mirrors ILP semantics.** In ILP, a PREPARE rejection doesn't unwind payment channels. The sender pays for the routing attempt.
2. **Prevents refund-based gas griefing.** An attacker could repeatedly trigger settlement + rejection to force the facilitator to spend gas on refund transactions.
3. **Simplifies implementation.** No refund queue, retry logic, or refund tracking.
4. **Clear contract.** The x402 client pays for routing the packet. Delivery is best-effort.

**Client-side mitigation:** The pre-flight destination reachability check (check #6) reduces the probability of paying for undeliverable packets.

### EIP-3009: Gasless USDC Authorization

EIP-3009 (`transferWithAuthorization`) allows a user to authorize a USDC transfer via an off-chain signature. The facilitator (node operator) submits the signed authorization on-chain, paying gas. The user (x402 client) pays no gas -- only the USDC transfer amount.

**EIP-712 domain for USDC's `transferWithAuthorization`:**
```typescript
{
  name: 'USD Coin',  // USDC contract name
  version: '2',      // FiatTokenV2_2
  chainId: <from resolveChainConfig()>,
  verifyingContract: <USDC contract address>
}
```

**NOTE:** The EIP-712 domain for USDC's `transferWithAuthorization` is **different** from the EIP-712 domain for TokenNetwork's balance proofs (which uses `{ name: 'TokenNetwork', version: '1', ... }`). The x402 handler must use the USDC contract's domain, not the TokenNetwork domain.

### Packet Equivalence Architecture

The shared `buildIlpPrepare()` function ensures both payment rails produce identical ILP packets:

```
x402 path:  /publish → x402 handler → buildIlpPrepare() → connector.sendPacket()
ILP path:   publishEvent() → TOON encode → buildIlpPrepare() → ilpClient.sendIlpPacket()
```

Both paths:
1. TOON-encode the Nostr event
2. Compute amount = `basePricePerByte * toonData.length` (x402 adds routing buffer for multi-hop)
3. Convert TOON bytes to base64
4. Call `buildIlpPrepare({ destination, amount, data })`

The destination relay's `/handle-packet` receives identical packets regardless of which rail sent them.

### viem Integration Notes

This story introduces viem as a dependency of `@toon-protocol/town` (not `@toon-protocol/core`). The core package remains viem-free per Decision 7.

**viem usage in this story:**
- `createPublicClient()` -- for read-only contract calls (balance check, nonce check)
- `createWalletClient()` -- for the facilitator to submit `transferWithAuthorization` on-chain
- `verifyTypedData()` -- for off-chain EIP-3009 signature verification
- `getContract()` -- for USDC contract interaction

**NOTE:** The connector package continues to use ethers.js internally. The two libraries coexist without conflict (separate process boundaries in standalone mode; separate imports in embedded mode). Static analysis test 3.9-UNIT-001 (from Story 3.2) enforces no ethers imports in new code.

### Files Changed (Anticipated)

**New files:**
- `packages/core/src/x402/build-ilp-prepare.ts` -- Shared ILP PREPARE construction
- `packages/core/src/x402/index.ts` -- Barrel export
- `packages/town/src/handlers/x402-publish-handler.ts` -- Main x402 handler
- `packages/town/src/handlers/x402-pricing.ts` -- Price calculator with routing buffer
- `packages/town/src/handlers/x402-preflight.ts` -- Pre-flight validation pipeline
- `packages/town/src/handlers/x402-settlement.ts` -- EIP-3009 on-chain settlement
- `packages/town/src/handlers/x402-types.ts` -- EIP-3009 types and constants

**Modified files (source):**
- `packages/core/src/index.ts` -- Add `buildIlpPrepare` export
- `packages/town/src/town.ts` -- Add `x402Enabled`, `routingBufferPercent` to TownConfig; wire x402 routes
- `packages/town/src/index.ts` -- Export x402 handler and types
- `packages/town/src/cli.ts` -- Add `--x402-enabled` flag
- `packages/town/package.json` -- Add `viem` dependency

**Modified files (docker):**
- `docker/src/shared.ts` -- Support `TOON_X402_ENABLED` env var

**Modified files (tests):**
- `packages/town/src/handlers/x402-publish-handler.test.ts` -- Enable 12 existing + add 1 new ATDD test (T-3.3-13)

**Modified files (config):**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Story status: `done`

### Risk Mitigations

- **E3-R005 (EIP-3009 signature verification bypass, score 6):** Pre-flight check #1 verifies the EIP-3009 signature off-chain before any gas is spent. Tests 3.3-INT-001 and 3.3-INT-006 validate forged signatures are rejected at pre-flight. If using real FiatTokenV2_2 on Anvil (from Story 3.1), the on-chain `transferWithAuthorization` also rejects forged sigs (defense in depth).

- **E3-R006 (Settlement atomicity, score 6):** Two sub-scenarios tested:
  - (a) Settlement reverts -> no ILP PREPARE sent (3.3-INT-004)
  - (b) Settlement succeeds, ILP PREPARE rejected -> no refund (3.3-INT-005)
  No partial-state possible: settlement is fully committed or fully reverted before ILP PREPARE construction.

- **E3-R007 (Packet equivalence, score 6):** Shared `buildIlpPrepare()` function ensures both x402 and ILP paths produce identical packets. Test 3.3-INT-003 compares output from both paths byte-for-byte. Test T-3.3-13 validates that `buildIlpPrepare()` sets the `amount` field correctly for the SDK pricing validator.

- **E3-R008 (Gas griefing via x402, score 3):** Layered pre-flight validation: 6 free checks before any on-chain transaction. Tests 3.3-INT-001, 3.3-INT-010, and 3.3-INT-011 validate pre-flight rejection for forged signatures, insufficient balance, and unreachable destination.

- **E3-R009 (Dual-protocol server conflicts, score 4):** Current architecture uses separate ports (BLS: 3100 for HTTP including /publish, relay: 7100 for WebSocket). Test 3.7-INT-001 validates concurrent HTTP + WS access if ports are merged in the future.

- **E3-R010 (Multi-hop pricing opacity, score 3):** Routing buffer (configurable, default 10%) absorbs multi-hop overhead. Test 3.3-INT-008 validates the pricing formula.

### Test Design Traceability

| ATDD Test ID | Test Name | AC | Test-Design ID | Risk Link | Priority | Level |
|---|---|---|---|---|---|---|
| T-3.3-01 | `6 free checks execute before any on-chain transaction` | #2 | 3.3-INT-001 | E3-R005, E3-R008 | P0 | I |
| T-3.3-02 | `full 402 negotiation -> EIP-3009 -> settlement -> ILP PREPARE -> FULFILL -> 200` | #1, #2, #4 | 3.3-INT-002 | E3-R005, E3-R006 | P0 | I |
| T-3.3-03 | `x402 and ILP paths produce identical ILP PREPARE packets via shared buildIlpPrepare()` | #3 | 3.3-INT-003 | E3-R007 | P0 | I |
| T-3.3-04 | `settlement tx reverts (insufficient balance) -> no ILP PREPARE sent` | #7 | 3.3-INT-004 | E3-R006 | P0 | I |
| T-3.3-05 | `settlement succeeds but ILP PREPARE rejected -> HTTP 200, no refund` | #8 | 3.3-INT-005 | E3-R006, E3-R008 | P0 | I |
| T-3.3-06 | `invalid EIP-3009 signature rejected at pre-flight (no gas spent)` | #2 | 3.3-INT-006 | E3-R005 | P0 | I |
| T-3.3-07 | `TOON_X402_ENABLED=false -> GET /publish returns 404` | #6 | 3.3-INT-007 | -- | P1 | I |
| T-3.3-08 | `price = destination basePricePerByte * toonLength + configurable routing buffer` | #5 | 3.3-INT-008 | E3-R010 | P1 | U |
| T-3.3-09 | `HTTP 402 body contains required fields: amount, facilitatorAddress, paymentNetwork, chainId` | #1 | 3.3-INT-009 | -- | P1 | I |
| T-3.3-10 | `concurrent HTTP GET /health + WS connection on port 7100` | -- | 3.7-INT-001 | E3-R009 | P1 | I |
| T-3.3-11 | `balance check fails -> reject before settlement tx` | #2 | 3.3-INT-010 | E3-R008 | P2 | I |
| T-3.3-12 | `destination connectivity check fails -> reject before settlement tx` | #2 | 3.3-INT-011 | E3-R008 | P2 | I |
| T-3.3-13 | `buildIlpPrepare() sets amount field to match basePricePerByte * toonData.length` | #3 | -- | E3-R007 | P0 | U |
| T-3.3-14 | `x402 full E2E: Anvil + Faucet + Connector + Relay -> full 402 -> payment -> store` | #1-#8 | 3.3-E2E-001 | E3-R005, E3-R006 | P3 | E2E |

### Import Patterns

```typescript
// New x402 modules (created in this story)
import { buildIlpPrepare, type BuildIlpPrepareParams } from '@toon-protocol/core';
import { createX402Handler, type X402HandlerConfig } from './handlers/x402-publish-handler.js';
import { calculateX402Price, type X402PricingConfig } from './handlers/x402-pricing.js';
import { runPreflight, type PreflightResult, type PreflightConfig } from './handlers/x402-preflight.js';
import { settleEip3009, type SettlementResult, type SettlementConfig } from './handlers/x402-settlement.js';
import type { Eip3009Authorization, X402PublishRequest } from './handlers/x402-types.js';

// Existing chain config (from Story 3.2)
import { resolveChainConfig, type ChainPreset } from '@toon-protocol/core';

// TOON codec (from core)
import { shallowParseToon, encodeEventToToon } from '@toon-protocol/core/toon';

// SDK pipeline (for verification in pre-flight)
import { createVerificationPipeline } from '@toon-protocol/sdk';

// viem (new dependency for Town)
import { createPublicClient, createWalletClient, http, type WalletClient, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum, arbitrumSepolia } from 'viem/chains';

// Hono (existing)
import type { Context } from 'hono';

// Core types (existing)
import type { IlpClient } from '@toon-protocol/core';
import type { EventStore } from '@toon-protocol/relay';
```

### Critical Rules

- **Shared `buildIlpPrepare()` is mandatory** -- Both x402 and ILP paths MUST use the same function (or produce byte-identical output). E3-R007 escalates to score 9 if this is not enforced.
- **No refund on REJECT** -- Do not implement refund logic. Do not create a refund queue. Payment is for routing attempt.
- **Pre-flight before settlement** -- All 6 checks MUST pass before `transferWithAuthorization` is called on-chain. No exceptions.
- **CWE-209** -- HTTP 500 responses MUST return generic "Internal server error", not internal error details.
- **x402 disabled by default** -- The `/publish` endpoint returns 404 unless explicitly enabled. This prevents accidental exposure on nodes that are not configured as x402 facilitators.
- **Never use `any` type** -- use `unknown` with type guards.
- **Always use `.js` extensions in imports** -- ESM requires explicit extensions.
- **Use consistent type imports** -- `import type { X } from '...'` for type-only imports.
- **EIP-712 domain for USDC != TokenNetwork** -- The EIP-712 domain for `transferWithAuthorization` uses the USDC contract's name/version, not the TokenNetwork's. Do not confuse the two.
- **viem in Town only** -- Do not add viem to `@toon-protocol/core`. Core remains viem-free per Decision 7.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3 -- FR-PROD-3 definition]
- [Source: _bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md#Decision 2 -- Dual Payment Rail]
- [Source: _bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md#Decision 8 -- x402 Integration Architecture (FINAL)]
- [Source: _bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md#Decision 13 -- Component Boundary Clarification]
- [Source: _bmad-output/planning-artifacts/test-design-epic-3.md -- Epic 3 test design with risk assessment]
- [Source: _bmad-output/test-artifacts/atdd-checklist-epic-3.md -- ATDD Red Phase checklist (12 tests in stub, +1 T-3.3-13 to add, +1 T-3.3-14 E2E deferred)]
- [Source: packages/town/src/handlers/x402-publish-handler.test.ts -- ATDD Red Phase tests (12 tests in stub, all skipped)]
- [Source: packages/town/src/town.ts -- startTown() with BLS Hono app, /health, /handle-packet routes]
- [Source: packages/sdk/src/create-node.ts -- publishEvent() with inline ILP packet construction (lines 734-790)]
- [Source: packages/core/src/chain/chain-config.ts -- resolveChainConfig(), buildEip712Domain(), ChainPreset]
- [Source: packages/core/src/chain/usdc.ts -- MOCK_USDC_ADDRESS, USDC_DECIMALS]
- [Source: packages/core/src/toon/ -- TOON codec (encoder, decoder, shallow parser)]
- [Source: packages/sdk/src/verification-pipeline.ts -- createVerificationPipeline() for Schnorr verify]
- [Source: packages/core/src/bootstrap/index.ts -- IlpClient, sendIlpPacket interface]
- [Source: docker/src/shared.ts -- parseConfig() with env var support]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Build type error: `EventStore.query()` takes `Filter[]` not single object -- fixed EventStoreLike interface
- Build type error: `@noble/curves/secp256k1` not found in Town package -- replaced with `SchnorrVerifyFn` callback injection
- Test failure: `JSON.stringify` cannot serialize BigInt -- added `serializeAuth()` helper
- Test failure: EIP-3009 signature verification fails for mock data -- added `runPreflightFn` override and `createPassingPreflight()` mock for post-preflight tests
- Lint errors: 3 unused imports/variables in test file -- removed unused types, prefixed unused mock with `_`

### Completion Notes List

- **Task 1**: Created `buildIlpPrepare()` in `packages/core/src/x402/build-ilp-prepare.ts` with `BuildIlpPrepareParams` and `IlpPreparePacket` types. Barrel export at `x402/index.ts`. Exported from core `index.ts`.
- **Task 2**: Created `calculateX402Price()` in `packages/town/src/handlers/x402-pricing.ts` with routing buffer formula: `basePrice + (basePrice * routingBufferPercent / 100)`.
- **Task 3**: Created 6-check preflight pipeline in `packages/town/src/handlers/x402-preflight.ts`. Uses viem `verifyTypedData` for EIP-3009 sig check, `PublicClient` for balance/nonce checks, `shallowParseToon` for TOON validation, injected `SchnorrVerifyFn` callback for Schnorr verification, and `EventStoreLike` for destination reachability.
- **Task 4**: Created `settleEip3009()` in `packages/town/src/handlers/x402-settlement.ts` using viem `WalletClient.writeContract` for `transferWithAuthorization`.
- **Task 5**: Created `createX402Handler()` in `packages/town/src/handlers/x402-publish-handler.ts` orchestrating the full x402 flow: 402 pricing, X-PAYMENT parsing, preflight, settlement, ILP PREPARE via `buildIlpPrepare()`, and response construction.
- **Task 6**: Added `x402Enabled`, `routingBufferPercent`, `facilitatorAddress` to `TownConfig`. Wired x402 handler into BLS Hono app with GET/POST `/publish` routes. Updated `ResolvedTownConfig` with x402 fields.
- **Task 7**: Added `--x402-enabled` CLI flag and `TOON_X402_ENABLED` env var to `cli.ts`. Added `x402Enabled` to `docker/src/shared.ts` `parseConfig()`.
- **Task 8**: Created `Eip3009Authorization`, `EIP_3009_TYPES`, `USDC_EIP712_DOMAIN`, `USDC_ABI`, `X402PublishRequest`, `X402PublishResponse`, `X402PricingResponse` types in `packages/town/src/handlers/x402-types.ts`.
- **Task 9**: Rewrote ATDD test file with 14 real tests (1 E2E skipped). All tests use actual module imports. Used `createPassingPreflight()` mock for post-preflight integration tests. All 14 active tests pass.
- **Task 10**: Build passes (0 errors). Lint passes (0 errors, 349 pre-existing warnings). Format check passes. Full test suite: 1379 passed, 160 skipped, 0 failed. Sprint status updated.

### File List

**New files:**
- `packages/core/src/x402/build-ilp-prepare.ts` -- Shared ILP PREPARE construction
- `packages/core/src/x402/index.ts` -- Barrel export
- `packages/town/src/handlers/x402-publish-handler.ts` -- Main x402 handler
- `packages/town/src/handlers/x402-pricing.ts` -- Price calculator with routing buffer
- `packages/town/src/handlers/x402-preflight.ts` -- Pre-flight validation pipeline (6 checks)
- `packages/town/src/handlers/x402-settlement.ts` -- EIP-3009 on-chain settlement
- `packages/town/src/handlers/x402-types.ts` -- EIP-3009 types and constants

**Modified files (source):**
- `packages/core/src/index.ts` -- Added `buildIlpPrepare` export
- `packages/town/src/town.ts` -- Added `x402Enabled`, `routingBufferPercent`, `facilitatorAddress` to TownConfig; wired x402 routes
- `packages/town/src/index.ts` -- Exported x402 handler, pricing, preflight, settlement, and types
- `packages/town/src/cli.ts` -- Added `--x402-enabled` flag and `TOON_X402_ENABLED` env var
- `packages/town/package.json` -- Added `viem` dependency

**Modified files (docker):**
- `docker/src/shared.ts` -- Added `x402Enabled` to Config interface and `parseConfig()`

**Modified files (tests):**
- `packages/town/src/handlers/x402-publish-handler.test.ts` -- Rewrote 12 skipped stubs + added T-3.3-13 = 14 active tests, all passing

**Modified files (config):**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Story status: `done`
- `_bmad-output/implementation-artifacts/3-3-x402-publish-endpoint.md` -- Dev Agent Record filled

### Change Log

| Date | Summary |
|------|---------|
| 2026-03-13 | Initial story draft via BMAD create-story. 10 tasks covering buildIlpPrepare shared function, x402 pricing, pre-flight validation, EIP-3009 settlement, x402 handler, TownConfig integration, env var support, EIP-3009 types, ATDD test enablement (13+1 E2E), and build verification. |
| 2026-03-13 | Adversarial review: 9 issues found and fixed. Risk IDs aligned with test-design-epic-3.md (E3-R013->E3-R008 for gas griefing, E3-R001->E3-R005, E3-R002->E3-R006, E3-R003->E3-R007). Added missing T-3.3-13 and T-3.3-14 tests from test design. Fixed sprint status transition. Added Dev Agent Record, Change Log, and Code Review Record sections. |
| 2026-03-13 | Implementation complete (Claude Opus 4.6). All 10 tasks done. 7 new files, 7 modified source files. 14 tests passing (1 E2E skipped). Build, lint, format all green. 5 debug issues found and fixed during development. viem added as Town dependency. |
| 2026-03-13 | Code review #1 complete (Claude Opus 4.6, YOLO mode). 7 issues found and fixed: 3 high (ilpClient not wired, walletClient null guard, tautological reachability check), 3 medium (duplicate TOON parse, CWE-209 settlement error leak, duplicated EventStoreLike), 1 low (test assertion update). All checks green: build, lint, format, 1402 tests passing. |
| 2026-03-13 | Code review #2 complete (Claude Opus 4.6, YOLO mode). 3 issues found and fixed: 1 medium (SettlementConfig/SettlementResult naming collision with @toon-protocol/core), 2 low (missing validAfter/validBefore NaN validation, test type name updates). All checks green: build, lint, format, 1402 tests passing. |
| 2026-03-13 | Code review #3 complete (Claude Opus 4.6, YOLO mode + OWASP security audit). 6 issues found and fixed: 1 high (EVM address format validation in parseAuthorization), 2 medium (negative value acceptance, routingBufferPercent range), 3 low (ILP address format validation, facilitatorAddress validation, deprecated export syntax). 9 new tests added. All checks green: build, lint, format, 1411 tests passing. |

## Code Review Record

### Review Pass #1

| Field | Value |
|-------|-------|
| **Date** | 2026-03-13 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Mode** | YOLO (auto-fix all severity levels) |
| **Outcome** | PASS -- all issues fixed during review |
| **Issues Found** | 7 total |
| **Critical/High** | 3 |
| **Medium** | 3 |
| **Low** | 1 |

**Issues Detail:**

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| 1 | HIGH | `town.ts` | `ilpClient` created AFTER x402 handler -- handler never receives it, so ILP routing is non-functional when x402 is enabled | Moved `ilpClient` creation before x402 handler creation; wired `ilpClient` into `createX402Handler()` config |
| 2 | HIGH | `x402-publish-handler.ts` | `walletClient` cast to `WalletClient` without null guard -- undefined walletClient causes opaque crash during settlement | Added explicit guard: if `!config.settle && !config.walletClient`, return 500 before attempting settlement |
| 3 | HIGH | `x402-preflight.ts` | Destination reachability check tautological: `events.length > 0 \|\| destination.startsWith('g.toon.')` always passes for `g.toon.*` destinations regardless of actual route availability | Simplified to `events.length === 0` check -- rejects if no kind:10032 peer info events exist |
| 4 | MEDIUM | `x402-preflight.ts` | TOON data decoded and shallow-parsed twice (check 4 and check 5) -- wasteful and divergence risk | Parse once in check 4, reuse `toonMeta` in check 5 |
| 5 | MEDIUM | `x402-publish-handler.ts` | Settlement error message leaked on-chain revert reason in HTTP 400 response (`Settlement failed: ERC20: transfer amount exceeds balance`) -- CWE-209 violation | Changed to generic `Settlement failed` message; log full error server-side only |
| 6 | MEDIUM | `x402-preflight.ts`, `x402-publish-handler.ts` | `EventStoreLike` interface duplicated in two files | Moved to `x402-types.ts` as single source of truth; both files import from there |
| 7 | LOW | `x402-publish-handler.test.ts` | Test assertion for settlement revert checked for leaked error details; updated to verify CWE-209 compliance | Changed to `expect(body['error']).toBe('Settlement failed')` and added negative assertion for revert text |

**Verification:**

- Build: PASS (`pnpm build` -- 0 errors)
- Lint: PASS (`pnpm lint` -- 0 errors, 349 pre-existing warnings)
- Format: PASS (`pnpm format:check` -- all files formatted)
- Tests: PASS (`pnpm vitest run` -- 1402 passed, 160 skipped, 0 failed)
- x402 tests: PASS (37 passed, 1 skipped E2E)

**Review Follow-ups (AI):** None -- all issues were fixed during the review pass. No outstanding action items.

### Review Pass #2

| Field | Value |
|-------|-------|
| **Date** | 2026-03-13 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Mode** | YOLO (auto-fix all severity levels) |
| **Outcome** | PASS -- all issues fixed during review |
| **Issues Found** | 3 total |
| **Critical** | 0 |
| **High** | 0 |
| **Medium** | 1 |
| **Low** | 2 |

**Issues Detail:**

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| 1 | MEDIUM | `x402-settlement.ts`, `index.ts` | `SettlementConfig` and `SettlementResult` naming collision with `@toon-protocol/core` bootstrap types -- consumers importing from both packages get ambiguous type names | Renamed to `X402SettlementConfig` and `X402SettlementResult`; added deprecated type aliases for backward compatibility; updated all internal references |
| 2 | LOW | `x402-publish-handler.ts` | `parseAuthorization` missing `validAfter`/`validBefore` type validation -- `Number(undefined)` produces `NaN` that silently propagates and fails cryptically downstream during EIP-3009 verification or on-chain settlement | Added explicit `Number.isNaN()` checks after conversion, throwing clear validation error |
| 3 | LOW | `x402-publish-handler.test.ts` | Test imports used deprecated `SettlementResult` type name | Updated to `X402SettlementResult` |

**Verification:**

- Build: PASS (`pnpm build` -- 0 errors)
- Lint: PASS (`pnpm lint` -- 0 errors, 349 pre-existing warnings)
- Format: PASS (`pnpm format:check` -- all files formatted)
- Tests: PASS (`pnpm vitest run` -- 1402 passed, 160 skipped, 0 failed)
- x402 tests: PASS (37 passed, 1 skipped E2E)

**Review Follow-ups (AI):** None -- all issues fixed during this review pass.

### Review Pass #3

| Field | Value |
|-------|-------|
| **Date** | 2026-03-13 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Mode** | YOLO (auto-fix all severity levels) + security audit (OWASP top 10, auth/authz, injection) |
| **Outcome** | PASS -- all issues fixed during review |
| **Issues Found** | 6 total |
| **Critical** | 0 |
| **High** | 1 |
| **Medium** | 2 |
| **Low** | 3 |

**Issues Detail:**

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| 1 | HIGH | `x402-publish-handler.ts` | `parseAuthorization()` only checks `0x` prefix on EVM addresses/hex fields without length or hex-character validation. A `from` of `0x1` or `0x` + non-hex chars passes validation, enabling malformed data to reach EIP-3009 signature verification and potentially on-chain calls (OWASP A03:2021 Injection, A04:2021 Insecure Design) | Added `isValidHex()` helper: EVM addresses must be 42 chars, bytes32 fields (nonce, r, s) must be 66 chars, all must contain only valid hex characters. Added `v` must be 27 or 28. Added 4 new tests. |
| 2 | MEDIUM | `x402-publish-handler.ts` | `parseAuthorization()` accepts negative `value` -- `BigInt("-1")` succeeds silently. Negative USDC transfer value could cause unexpected on-chain behavior (OWASP A04:2021 Insecure Design) | Added explicit non-negative check on parsed BigInt value. Added test for negative value rejection. |
| 3 | MEDIUM | `x402-pricing.ts` | `routingBufferPercent` not validated for sane range -- negative values produce undercharging, extremely large values produce unreasonable prices. No guard in calculator or config. | Added clamping to [0, 200] range in `calculateX402Price()`. Added 2 tests for negative and excessive buffer values. |
| 4 | LOW | `x402-publish-handler.ts` | `destination` ILP address not validated for format. Non-ILP addresses (e.g., `x.foo`) would pass through to settlement, wasting gas on guaranteed-unroutable packets. | Added `g.` prefix validation before TOON encoding. Updated test fixtures from `x.nonexistent.*` to `g.nonexistent.*`. Added test for invalid destination rejection. |
| 5 | LOW | `x402-publish-handler.ts` | `facilitatorAddress` not validated as proper EVM address at handler construction time. Misconfigured address would be returned to clients in 402 response, causing downstream client-side failures. | Added EVM address regex validation (`/^0x[0-9a-fA-F]{40}$/`) at `createX402Handler()` construction time when x402 is enabled. Added 2 tests (enabled + disabled). |
| 6 | LOW | `index.ts` | Deprecated type aliases `SettlementResult`/`SettlementConfig` exported with JSDoc `@deprecated` comments inside type export block -- syntactically unusual and some tools may not process correctly. | Separated deprecated aliases into their own export block with standard comment. |

**Security Audit Summary (OWASP Top 10 + Auth/Authz + Injection):**

| OWASP Category | Status | Notes |
|---|---|---|
| A01:2021 Broken Access Control | PASS | x402 disabled by default (404); no auth bypass paths |
| A02:2021 Cryptographic Failures | PASS | EIP-3009 sig verification uses viem's verifyTypedData; EIP-712 domain correctly uses USDC contract, not TokenNetwork |
| A03:2021 Injection | FIXED | `parseAuthorization` now validates hex format and length for all fields (issue #1) |
| A04:2021 Insecure Design | FIXED | Negative value (issue #2), routing buffer range (issue #3), destination validation (issue #4) |
| A05:2021 Security Misconfiguration | FIXED | facilitatorAddress now validated at construction (issue #5) |
| A06:2021 Vulnerable Components | PASS | viem ^2.47 is current; no known CVEs |
| A07:2021 Auth Failures | PASS | EIP-3009 authorization is cryptographically verified before any gas spending |
| A08:2021 Data Integrity | PASS | Pre-flight checks 1-6 enforce data integrity before settlement |
| A09:2021 Logging Failures | PASS | Server-side errors logged; CWE-209 compliant (generic client errors) |
| A10:2021 SSRF | PASS | No user-controlled URLs used for server-side requests |

**Verification:**

- Build: PASS (`pnpm build` -- 0 errors)
- Lint: PASS (`pnpm lint` -- 0 errors, 349 pre-existing warnings)
- Format: PASS (`pnpm format:check` -- all files formatted)
- Tests: PASS (`pnpm vitest run` -- 1411 passed, 160 skipped, 0 failed)
- x402 tests: PASS (46 passed, 1 skipped E2E)

**Review Follow-ups (AI):** None -- all issues fixed during this review pass.
