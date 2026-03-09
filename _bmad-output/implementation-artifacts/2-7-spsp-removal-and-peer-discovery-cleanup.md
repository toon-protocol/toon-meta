# Story 2.7: SPSP Removal and Peer Discovery Cleanup

Status: done

## Story

As a **protocol developer**,
I want the SPSP handshake removed from the protocol and the peer discovery flow simplified,
So that peers can transact immediately after discovery without a negotiation round-trip.

> **Moved from Epic 3 (was Story 3.7) on 2026-03-07.** The SPSP removal modifies the SDK's public surface and bootstrap flow -- it belongs in Epic 2 to ensure the SDK ships with a clean, stable protocol. The original dependency on Story 3.1 (USDC) was a sequencing artifact; SPSP removal is token-agnostic.

**FRs covered:** FR-PROD-7

**Dependencies:** Stories 2.1-2.6 (done). This story removes the SPSP handshake phase and simplifies peer discovery to: discovering -> registering -> announcing.

## Background

The SPSP handshake (kind:23194/23195) exists to negotiate settlement details between peers before they can exchange ILP packets. However, every piece of information SPSP negotiates is already published in kind:10032 (ILP Peer Info):

- `destinationAccount` (ILP address) -> kind:10032 `ilpAddress`
- `sharedSecret` -> Not needed (no STREAM protocol; TOON-over-ILP directly)
- `negotiatedChain` -> Deterministic from kind:10032 `supportedChains` intersection
- `settlementAddress` -> kind:10032 `settlementAddresses`
- `tokenAddress` -> kind:10032 `preferredTokens`
- `tokenNetworkAddress` -> kind:10032 `tokenNetworks`
- `channelId` -> Opened unilaterally by sender

Since Crosstown uses TOON-over-ILP (not STREAM), there is no shared secret to negotiate. The sender reads the peer's kind:10032 from the relay, selects the best matching chain locally, and opens a channel unilaterally.

## Acceptance Criteria

1. Given the peer discovery flow currently with phases: discovering -> registering -> handshaking -> announcing, when this story is completed, then the handshaking phase is removed, phases are: discovering -> registering -> announcing, channel opening happens during the registration phase using kind:10032 settlement data, and chain selection runs locally against the peer's kind:10032 `supportedChains` (set intersection + token preference).

2. Given `addPeerToConnector()` in `BootstrapService` currently passes only `id`, `url`, and `routes` to the connector, when this story is completed, then `addPeerToConnector()` populates the `settlement` field in `ConnectorAdminClient.addPeer()` with the chain-selected data from the peer's kind:10032: `chainId`, `tokenNetworkAddress`, `tokenAddress`, `evmAddress` (peer's settlement address), and `channelId` (from unilateral channel opening). This settlement info enables the connector to build self-describing BTP claims.

3. Given `node.peerWith(pubkey)` currently performs connector registration + SPSP handshake, when this story is completed, then `peerWith()` performs: read peer's kind:10032 from relay -> select chain locally -> register with connector (including settlement info) -> open channel unilaterally -> done. No kind:23194/23195 events are created or processed.

4. Given the SPSP code in `@crosstown/core` and `@crosstown/town`, when this story is completed, then:
   - `NostrSpspServer`, `NostrSpspClient`, `IlpSpspClient`, and SPSP event builders/parsers are removed from `@crosstown/core`
   - `createSpspHandshakeHandler()` is removed from `@crosstown/town`
   - Event kinds 23194 and 23195 are no longer used by the protocol
   - The SDK stub `spsp-handshake-handler.ts` is removed from `@crosstown/sdk`
   - `SPSP_REQUEST_KIND` and `SPSP_RESPONSE_KIND` constants are removed from `@crosstown/core`
   - `SpspError` and `SpspTimeoutError` error classes are removed from `@crosstown/core`

5. Given the `RelayMonitor` component in `@crosstown/core`, when this story is completed, then `RelayMonitor.peerWith()` no longer performs SPSP handshake -- it only does: register peer with connector (including settlement info from kind:10032) -> open channel unilaterally. The `IlpSpspClient` dependency is removed.

6. Given all existing tests, when run after SPSP removal, then all remaining tests pass with the simplified flow (no SPSP handshake), payment channel creation works via unilateral opening during registration, and the total test count reflects removal of SPSP-specific test files.

7. Given the `bootstrap:handshake-failed` event type in `BootstrapEvent`, when this story is completed, then the event is renamed to `bootstrap:settlement-failed` to reflect that settlement negotiation can still fail (no chain match, channel open failure) but this is now a non-fatal event during the registration phase, not a separate handshaking phase.

8. Given SPSP JSDoc comments and references in `@crosstown/core` infrastructure files (`compose.ts`, `direct-bls-client.ts`), `@crosstown/sdk` (`create-node.ts`), and test/documentation files, when this story is completed, then all SPSP-referencing comments, JSDoc, and assertions are updated to reflect the new settlement-during-registration flow.

## Tasks / Subtasks

### Task 1: Remove SPSP module from `@crosstown/core` (AC: #4)

- [x] Delete the entire `packages/core/src/spsp/` directory:
  - `IlpSpspClient.ts` + `IlpSpspClient.test.ts`
  - `NostrSpspClient.ts` + `NostrSpspClient.test.ts`
  - `NostrSpspServer.ts` + `NostrSpspServer.test.ts`
  - `negotiateAndOpenChannel.ts` + `negotiateAndOpenChannel.test.ts`
  - `ilp-spsp-roundtrip.test.ts`
  - `index.ts`
  - **KEEP** `settlement.ts` + `settlement.test.ts` -- move to `packages/core/src/settlement/` (or `packages/core/src/bootstrap/settlement.ts`) because `negotiateSettlementChain()` and `resolveTokenForChain()` are still needed for local chain selection during registration
- [x] Remove `SPSP_REQUEST_KIND` and `SPSP_RESPONSE_KIND` from `packages/core/src/constants.ts` (keep `ILP_PEER_INFO_KIND`)
- [x] Remove `SpspError` and `SpspTimeoutError` from `packages/core/src/errors.ts` (keep `CrosstownError`, `InvalidEventError`, `PeerDiscoveryError`)
- [x] Update `packages/core/src/errors.test.ts` to remove SPSP error tests
- [x] Remove SPSP-related types from `packages/core/src/types.ts`:
  - Remove `SpspInfo`, `SpspRequest`, `SpspResponse`
  - Remove `SettlementNegotiationConfig`, `SettlementNegotiationResult`
  - Keep `IlpPeerInfo`, `Subscription`, `OpenChannelParams`, `OpenChannelResult`, `ChannelState`, `ConnectorChannelClient`
- [x] Update `packages/core/src/types.test.ts` to remove SPSP type tests
- [x] Remove SPSP event parsers and builders from `packages/core/src/events/`:
  - Remove `parseSpspRequest`, `parseSpspResponse` from `parsers.ts`
  - Remove `buildSpspRequestEvent`, `buildSpspResponseEvent` from `builders.ts`
  - Remove `SpspRequestEventResult`, `SpspRequestSettlementInfo` types from `builders.ts`
  - Remove SPSP-related imports from both files (`SPSP_REQUEST_KIND`, `SPSP_RESPONSE_KIND`, `nip44`, `SpspRequest`, `SpspResponse`)
  - Keep `parseIlpPeerInfo`, `buildIlpPeerInfoEvent`, `validateChainId`, `stringifyWithBigInt`
  - Update `packages/core/src/events/index.ts` to remove SPSP re-exports
  - Update `packages/core/src/events/parsers.test.ts` and `builders.test.ts` to remove SPSP tests
- [x] Remove SPSP constants test from `packages/core/src/constants.test.ts`
- [x] Update `packages/core/src/index.ts`:
  - Remove `SPSP_REQUEST_KIND`, `SPSP_RESPONSE_KIND` from constant exports
  - Remove `SpspInfo`, `SpspRequest`, `SpspResponse`, `SettlementNegotiationConfig`, `SettlementNegotiationResult` from type exports
  - Remove `SpspError`, `SpspTimeoutError` from error exports
  - Remove `parseSpspRequest`, `parseSpspResponse`, `buildSpspRequestEvent`, `buildSpspResponseEvent`, `SpspRequestEventResult`, `SpspRequestSettlementInfo` from event exports
  - Remove entire SPSP client/server export block (`NostrSpspClient`, `NostrSpspServer`, `IlpSpspClient`, `IlpSpspClientConfig`, `IlpSpspRequestOptions`, `negotiateAndOpenChannel`, `NegotiateAndOpenChannelParams`)
  - **Add** new exports for relocated settlement functions: `negotiateSettlementChain`, `resolveTokenForChain` (from new location)
  - Update module description comment to remove "and SPSP" reference
- [x] Update `packages/core/src/index.test.ts` to remove SPSP export tests

### Task 2: Relocate settlement utilities (AC: #1, #2)

- [x] Move `packages/core/src/spsp/settlement.ts` to `packages/core/src/settlement/settlement.ts`
- [x] Move `packages/core/src/spsp/settlement.test.ts` to `packages/core/src/settlement/settlement.test.ts`
- [x] Create `packages/core/src/settlement/index.ts` re-exporting `negotiateSettlementChain` and `resolveTokenForChain`
- [x] Update import paths in any files that import from the old location (BootstrapService, RelayMonitor, etc.)
- [x] Update `packages/core/src/index.ts` to import settlement functions from new location

### Task 3: Remove `handshaking` phase from BootstrapService (AC: #1, #2, #7)

- [x] In `packages/core/src/bootstrap/BootstrapService.ts`:
  - Remove the entire `performSpspHandshake()` private method (~100 lines)
  - Remove Phase 2 (handshaking) from `bootstrap()` method -- the code block that sets phase to 'handshaking' and calls `performSpspHandshake()` for each result
  - **Integrate settlement into `bootstrapWithPeer()`**: After `addPeerToConnector()`, if the peer's kind:10032 has `supportedChains` and `settlementAddresses`:
    1. Run `negotiateSettlementChain()` locally against own + peer's supported chains
    2. If chain match found, call `channelClient.openChannel()` with the peer's settlement data
    3. Update `addPeerToConnector()` to include `settlement` field with `chainId`, `tokenNetworkAddress`, `tokenAddress`, `evmAddress`, `channelId`
    4. Set `result.channelId`, `result.negotiatedChain`, `result.settlementAddress`
  - Remove `buildSpspRequestEvent` and `parseSpspResponse` imports
  - Remove SPSP-related fields that are no longer needed (e.g., `claimSigner` if only used for SPSP claims)
  - Keep `agentRuntimeClient` (needed for Phase 3 announce), `toonEncoder` (needed for announce), `toonDecoder` (may be needed for announce)
  - Update the three-phase comment at top of file to document two-phase flow
- [x] In `packages/core/src/bootstrap/types.ts`:
  - Remove `'handshaking'` from `BootstrapPhase` union type
  - Remove `SpspRequestSettlementInfo` import from types (if only used for SPSP)
  - Update `BootstrapServiceConfig` to remove SPSP-specific fields (evaluate: `agentRuntimeUrl` may still be needed for announce; `settlementInfo` type may need to change from `SpspRequestSettlementInfo` to a new type)
  - **Create new `SettlementConfig` type** to replace `SpspRequestSettlementInfo` for the settlement info fields that BootstrapService needs (own supported chains, own settlement addresses, own preferred tokens, own token networks)
  - Keep `BootstrapEvent` types including `bootstrap:handshake-failed` (rename to `bootstrap:settlement-failed` for clarity) and `bootstrap:channel-opened`
- [x] Update `packages/core/src/bootstrap/BootstrapService.test.ts` to:
  - Remove SPSP handshake tests
  - Add tests for local chain selection + unilateral channel opening during registration
  - Verify the phase sequence is discovering -> registering -> announcing (no handshaking)

### Task 4: Remove SPSP from RelayMonitor (AC: #3, #5)

- [x] In `packages/core/src/bootstrap/RelayMonitor.ts`:
  - Remove `IlpSpspClient` import and `spspClient` field
  - Remove `getOrCreateSpspClient()` private method
  - Remove `calculateSpspAmount()` private method
  - Remove `buildSpspRequestEvent` import from events
  - Modify `peerWith()` to NOT perform SPSP handshake:
    1. Register peer with connector (already done)
    2. **Add local chain selection**: Use `negotiateSettlementChain()` with peer's kind:10032 data
    3. **Add unilateral channel opening**: If chain match found and `channelClient` is available, open channel
    4. Update peer registration with settlement info (chainId, tokenNetworkAddress, tokenAddress, evmAddress, channelId)
  - Add `channelClient` field and `setChannelClient()` method (if not already present)
  - Import `negotiateSettlementChain`, `resolveTokenForChain` from new settlement location
  - Remove `settlementInfo` from `RelayMonitorConfig` (replace with own settlement config fields)
- [x] Update `packages/core/src/bootstrap/RelayMonitor.test.ts` to:
  - Remove SPSP handshake tests
  - Add tests for local chain selection + unilateral channel opening in `peerWith()`
  - Verify no SPSP events are created

### Task 5: Remove SPSP from SDK (AC: #4, #8)

- [x] Delete `packages/sdk/src/spsp-handshake-handler.ts`
- [x] Remove `createSpspHandshakeHandler` export from `packages/sdk/src/index.ts` (line 59-60)
- [x] Update `packages/sdk/src/index.test.ts` to remove SPSP export test
- [x] In `packages/sdk/src/create-node.ts`:
  - Update JSDoc comment on `settlementInfo` config (remove "for SPSP handshakes" -> "for settlement during peer registration")
  - Update JSDoc comment on `peerWith()` (remove "register + SPSP handshake" -> "register + channel opening")
- [x] Update `packages/sdk/src/pricing-validator.test.ts` -- remove SPSP kind pricing tests (kind:23194 pricing override references)

### Task 6: Remove SPSP from Town (AC: #4, #8)

- [x] Delete `packages/town/src/handlers/spsp-handshake-handler.ts`
- [x] Delete `packages/town/src/handlers/spsp-handshake-handler.test.ts`
- [x] Remove `createSpspHandshakeHandler` and `SpspHandshakeHandlerConfig` exports from `packages/town/src/index.ts`
- [x] In `packages/town/src/town.ts`:
  - Remove `import { createSpspHandshakeHandler }` from handlers
  - Remove `import { SPSP_REQUEST_KIND }` from core
  - Remove SPSP kind pricing override from `kindPricing` map (`[SPSP_REQUEST_KIND]: basePricePerByte / 2n`)
  - Remove SPSP handler registration (`.on(SPSP_REQUEST_KIND, createSpspHandshakeHandler({...}))`)
  - Update any comments referencing SPSP
- [x] Update `packages/town/vitest.config.ts` to remove SPSP-related comment (line 14 references `spsp-handshake-handler.test.ts`)
- [x] Update `packages/town/src/cleanup.test.ts` -- remove SPSP reference in comment (line 136: "manually wiring BLS, SPSP server, and bootstrap logic")
- [x] Update `packages/town/src/doc-cleanup-and-reference.test.ts` -- **CRITICAL**: This test ASSERTS that SPSP handling is documented in the entrypoint (lines 256-261). After SPSP removal, these assertions will FAIL. Remove or update the SPSP-related assertions and update expected documentation patterns to reflect the new settlement-during-registration flow
- [x] Update `packages/town/src/handlers/event-storage-handler.ts` -- remove SPSP comment in JSDoc (line 6: "except those handled by kind-specific handlers (e.g., SPSP kind:23194)")

### Task 7: Update Docker entrypoints (AC: #4)

- [x] In `docker/src/entrypoint.ts`:
  - Remove all SPSP handling code (~200+ lines):
    - Remove `SPSP_REQUEST_KIND` import
    - Remove `generateSpspInfo()` function
    - Remove SPSP request handling block inside `/handle-packet` (kind:23194 check)
    - Remove `spspMinPrice` config and env var parsing
    - Remove SPSP pricing override in kind pricing map
    - Remove `NostrSpspServer` setup and subscription
  - Keep: ILP peer info event handling, event storage, channel/settlement setup
- [x] In `docker/src/entrypoint-town.ts`:
  - Remove `SPSP_REQUEST_KIND` import
  - Remove SPSP kind pricing override comment and code
  - Remove SPSP handler registration lines
  - Update comment blocks that reference SPSP
- [x] Update `docker/src/entrypoint.test.ts` to remove SPSP-related tests

### Task 8: Update remaining source files and references (AC: #6, #8)

**Core infrastructure files (SPSP JSDoc/comment cleanup):**
- [x] Update `packages/core/src/compose.ts` -- update 8 SPSP references in JSDoc and comments: module description (line 5), `HandlePacketAcceptResponse.data` comment (line 58), `handlePacket` JSDoc (lines 86-89), `CrosstownNodeConfig.handlePacket` JSDoc (line 156), `CrosstownNodeConfig.settlementInfo` comment (line 178), `CrosstownNodeConfig.claimSigner` comment (line 192), `CrosstownNode.peerWith` JSDoc (line 249)
- [x] Update `packages/core/src/bootstrap/direct-bls-client.ts` -- update 3 SPSP references in JSDoc (lines 2, 5, 24: "Direct BLS HTTP client for bootstrap SPSP handshakes" -> "Direct BLS HTTP client for bootstrap operations")

**BLS package cleanup:**
- [x] Update `packages/bls/src/bls/BusinessLogicServer.ts` and `.test.ts` -- remove SPSP references
- [x] Update `packages/bls/src/entrypoint.ts` and `entrypoint-bls-only.ts` -- remove SPSP references
- [x] Update `packages/bls/src/config.ts` -- remove `spspMinPrice` config field and `SPSP_MIN_PRICE` env var parsing
- [x] Update `packages/bls/src/config.test.ts` -- remove SPSP config tests
- [x] Update `packages/bls/src/server.ts` -- remove `spspMinPrice` config field and SPSP references
- [x] Update `packages/bls/src/pricing/PricingService.test.ts` -- remove SPSP kind pricing tests
- [x] Update `packages/bls/src/bls/types.ts` -- remove SPSP references
- [x] Update `packages/bls/examples/nip34-integration.ts` -- remove SPSP references

**Relay package cleanup:**
- [x] Update `packages/relay/src/bls/BusinessLogicServer.ts` and `.test.ts` -- remove SPSP references
- [x] Update `packages/relay/src/bls/types.ts` -- remove SPSP references
- [x] Update `packages/relay/src/pricing/PricingService.test.ts` -- remove SPSP pricing tests

**Client package cleanup:**
- [x] Update `packages/client/examples/with-payment-channels.ts` -- remove SPSP references
- [x] Update `packages/client/tests/e2e/genesis-bootstrap-with-channels.test.ts` -- update flow expectations (no SPSP handshake phase)
- [x] Update `packages/client/tests/e2e/sdk-relay-validation.test.ts` -- remove SPSP validation

**Integration test cleanup:**
- [x] Update `packages/core/src/__integration__/five-peer-bootstrap.test.ts` -- remove SPSP phase tests
- [x] Update `packages/core/src/toon/toon.test.ts` -- remove SPSP event TOON encoding tests if any
- [x] Update `packages/sdk/src/__integration__/network-discovery.test.ts` -- remove SPSP handshake expectations

**Town test cleanup (moved from Task 6 note):**
- [x] Update `packages/town/src/handlers/x402-publish-handler.test.ts` -- update "x402 vs SPSP" references to "x402 vs ILP" (lines 10, 150, 154, 168-169)

**Out-of-scope (documentation files):** The following files have SPSP references but are documentation/legacy files outside the source tree: `docs/component-library-documentation.md`, `ELIZAOS-INTEGRATION-HANDOFF.md`, `docs/stories/*.story.md`, `packages/core/README.md`, `packages/client/README.md`, `packages/core/src/nip34/README.md`, `packages/core/src/integration/README.md`, `docs/qa/gates/*.yml`. These are NOT updated in this story -- they are tracked as cleanup debt for a future documentation sweep (consistent with Epic 2 retro A4).

### Task 9: Update bootstrap/index.ts exports (AC: #4)

- [x] In `packages/core/src/bootstrap/index.ts`:
  - Remove any re-exports related to `IlpSpspClient` or SPSP types
  - Verify all remaining exports are clean

### Task 10: Build, test, and verify (AC: all)

- [x] Run `pnpm build` -- all packages build without SPSP imports
- [x] Run `pnpm test` -- all remaining tests pass
- [x] Run `pnpm lint` -- 0 errors
- [x] Run `pnpm format:check` -- all files pass
- [x] Verify test count: expected decrease from ~1,454 passing tests due to removed SPSP test files. Document exact count.

## Dev Notes

### What This Story Does

Removes the SPSP handshake (kind:23194/23195) from the entire protocol. This is the largest code removal in the project's history, touching every package. The SPSP handshake was a request-response negotiation for settlement parameters between peers. Since all settlement information is already published in kind:10032, the handshake is unnecessary -- peers can select chains and open channels unilaterally.

### Removal Inventory

**Files to DELETE:**
- `packages/core/src/spsp/IlpSpspClient.ts` + test
- `packages/core/src/spsp/NostrSpspClient.ts` + test
- `packages/core/src/spsp/NostrSpspServer.ts` + test
- `packages/core/src/spsp/negotiateAndOpenChannel.ts` + test
- `packages/core/src/spsp/ilp-spsp-roundtrip.test.ts`
- `packages/core/src/spsp/index.ts`
- `packages/sdk/src/spsp-handshake-handler.ts`
- `packages/town/src/handlers/spsp-handshake-handler.ts` + test

**Files to RELOCATE:**
- `packages/core/src/spsp/settlement.ts` -> `packages/core/src/settlement/settlement.ts`
- `packages/core/src/spsp/settlement.test.ts` -> `packages/core/src/settlement/settlement.test.ts`

**Constants to REMOVE:**
- `SPSP_REQUEST_KIND` (23194)
- `SPSP_RESPONSE_KIND` (23195)

**Error classes to REMOVE:**
- `SpspError`
- `SpspTimeoutError`

**Types to REMOVE:**
- `SpspInfo`, `SpspRequest`, `SpspResponse`
- `SettlementNegotiationConfig`, `SettlementNegotiationResult`
- `SpspRequestEventResult`, `SpspRequestSettlementInfo`
- `IlpSpspClientConfig`, `IlpSpspRequestOptions`
- `NegotiateAndOpenChannelParams`
- `SpspHandshakeHandlerConfig`

**Bootstrap phase to REMOVE:**
- `'handshaking'` from `BootstrapPhase` union type

**Bootstrap event to RENAME:**
- `bootstrap:handshake-failed` -> `bootstrap:settlement-failed`

**JSDoc/Comment cleanup (NOT deletions, just text updates):**
- `packages/core/src/compose.ts` (8 references)
- `packages/core/src/bootstrap/direct-bls-client.ts` (3 references)
- `packages/sdk/src/create-node.ts` (2 references)
- `packages/town/src/handlers/event-storage-handler.ts` (1 reference)
- `packages/town/src/cleanup.test.ts` (1 reference)
- `packages/town/src/doc-cleanup-and-reference.test.ts` (5 references -- tests that ASSERT SPSP docs, will FAIL if not updated)
- `packages/town/vitest.config.ts` (1 comment reference)
- `packages/town/src/handlers/x402-publish-handler.test.ts` (6 references in test names/comments)

### New Settlement Flow (replaces SPSP handshake)

The settlement flow during peer registration is now:

```
1. Query peer's kind:10032 from relay (existing step)
2. Extract peer's supportedChains, settlementAddresses, preferredTokens, tokenNetworks
3. Run negotiateSettlementChain() locally (own chains vs peer chains)
4. If chain match found:
   a. Resolve token via resolveTokenForChain()
   b. Open channel unilaterally via channelClient.openChannel()
   c. Include settlement data in addPeer() registration
5. Register peer with connector (settlement data included)
```

This replaces the old flow:
```
1. Query peer's kind:10032 from relay
2. Register peer with connector (no settlement)
3. Build kind:23194 SPSP request event with own settlement info
4. TOON-encode and send via ILP
5. Wait for kind:23195 SPSP response
6. Parse response for negotiated chain, settlement address, etc.
7. Open channel based on negotiated parameters
8. Re-register peer with settlement info
```

### Key Design Decisions

1. **Settlement functions relocate to `packages/core/src/settlement/`** -- `negotiateSettlementChain()` and `resolveTokenForChain()` are pure functions useful beyond SPSP. They move to a dedicated settlement module.

2. **Channel opening moves to registration phase** -- Instead of a separate handshake phase, channel opening happens during `bootstrapWithPeer()` right after `addPeerToConnector()`. This eliminates a full round-trip.

3. **`handshaking` phase removed from BootstrapPhase** -- The type union changes from 5 normal states to 4: `discovering | registering | announcing | ready | failed`.

4. **`bootstrap:handshake-failed` event kept but repurposed** -- Rename to `bootstrap:settlement-failed` to reflect that settlement negotiation can still fail (e.g., no chain match, channel open failure) but this is now a non-fatal event during registration, not a separate phase.

5. **Docker entrypoint.ts gets major SPSP removal** -- The original entrypoint has ~200+ lines of SPSP handling code that gets deleted. This is expected and correct -- entrypoint-town.ts (the SDK-based one) will be even simpler.

6. **E2E tests may need adjustment** -- The `genesis-bootstrap-with-channels.test.ts` currently expects SPSP handshake flow. This must be updated to expect the simplified discover -> register (+ channel) -> announce flow.

### What NOT to Change

- Do not remove `IlpPeerInfo` or kind:10032 -- these are the foundation of the new flow
- Do not remove `ConnectorChannelClient` -- channels are still opened, just unilaterally
- Do not remove `BootstrapService` or `RelayMonitor` -- they are updated, not removed
- Do not remove `negotiateSettlementChain()` or `resolveTokenForChain()` -- they are relocated
- Do not modify the TOON codec -- unrelated
- Do not modify the SDK pipeline (verify -> price -> dispatch) -- unrelated
- Do not modify EventStore or event storage handler -- unrelated

### Risk Areas

1. **Many files touched** -- 60+ files reference SPSP. Most are simple import/reference removals, but missed references will cause build failures.
2. **BootstrapService refactoring** -- The settlement integration into `bootstrapWithPeer()` is the most complex change. Must handle channel opening failures gracefully (non-fatal).
3. **E2E tests** -- The genesis bootstrap E2E test relies on the current flow. May need the genesis node redeployed with updated code before E2E tests pass.
4. **BLS and relay packages** -- These older packages have their own SPSP references that must be cleaned up even though they are not the primary packages.

### Critical Rules

- **Never use `any` type** -- use `unknown` with type guards (enforced by ESLint)
- **Always use `.js` extensions in imports** -- ESM requires `import { foo } from './bar.js'`
- **Use consistent type imports** -- `import type { X } from '...'` for type-only imports
- **Settlement functions stay pure** -- No I/O in `negotiateSettlementChain()` / `resolveTokenForChain()`
- **Channel opening is non-fatal** -- Failed channel opening during registration should log a warning, not fail the bootstrap
- **Keep `bootstrap:channel-opened` event** -- Settlement events are still emitted during registration
- **Do not break remaining exports** -- Only SPSP-related exports are removed

### Test Design Traceability

This story is primarily a removal/refactoring story. The tests that matter are:

| Test Category | Test Focus | AC | Priority | Approach |
|---|---|---|---|---|
| Phase sequence | Bootstrap phases are discovering -> registering -> announcing (no handshaking) | #1 | P0 | BootstrapService.test.ts |
| Settlement integration | Local chain selection + unilateral channel opening during registration | #1, #2 | P0 | BootstrapService.test.ts |
| Settlement in addPeer | `addPeerToConnector()` includes settlement field with chainId, tokenNetworkAddress, etc. | #2 | P0 | BootstrapService.test.ts |
| peerWith flow | `peerWith()` performs read -> select -> register -> open channel (no SPSP) | #3, #5 | P0 | RelayMonitor.test.ts |
| No SPSP events | No kind:23194/23195 events created or processed anywhere | #3, #4 | P0 | Integration |
| SPSP code removed | SPSP module, constants, types, errors deleted from core | #4 | P0 | Build verification |
| SDK stub removed | `spsp-handshake-handler.ts` deleted from SDK | #4 | P1 | Build verification |
| Town handler removed | `createSpspHandshakeHandler()` deleted from Town | #4 | P1 | Build verification |
| All tests pass | Full `pnpm test` suite passes with no SPSP-related failures | #6 | P0 | Build/test |
| Event rename | `bootstrap:handshake-failed` renamed to `bootstrap:settlement-failed` | #7 | P1 | BootstrapService.test.ts |
| JSDoc cleanup | SPSP references removed from compose.ts, create-node.ts, direct-bls-client.ts | #8 | P2 | Build/grep verification |

### Risk Mitigations

1. **Build breakage from missed SPSP references (risk: high, impact: high):** The story touches 60+ files. Mitigation: Task 8 enumerates every file with SPSP references found via `grep -r`. Task 10 runs full `pnpm build` to catch missed imports. The Removal Inventory provides a complete checklist.

2. **BootstrapService settlement integration regression (risk: medium, impact: high):** Integrating channel opening into `bootstrapWithPeer()` is the most complex change. Mitigation: Channel opening is non-fatal (log warning, don't fail bootstrap). Existing bootstrap tests are updated to verify the new two-phase flow.

3. **E2E test failure (risk: medium, impact: medium):** The `genesis-bootstrap-with-channels.test.ts` expects the current SPSP flow. Mitigation: Task 8 explicitly lists this file for update. May require genesis node redeployment with updated code.

4. **doc-cleanup-and-reference.test.ts assertion failure (risk: high, impact: low):** This test ASSERTS that SPSP handling is documented in the entrypoint. After SPSP removal, these assertions will fail. Mitigation: Task 6 explicitly calls out this file as CRITICAL.

### Previous Story Intelligence (Story 2.2)

Story 2.2 implemented the SPSP handshake handler being removed. Key patterns from that story:
- **NIP-44 encrypted event handling** -- The SPSP handler used `nip44.encrypt()`/`nip44.decrypt()`. After removal, no handler uses NIP-44 (keep the import available in `nostr-tools` but no active use in codebase).
- **Handler data bypass pattern** -- The SPSP handler returned `{ accept: true, fulfillment: 'default-fulfillment', data }` directly to put response in the ILP FULFILL. This pattern survives (documented in SDK rules) but no handler currently uses it after SPSP removal.
- **Settlement negotiation in handler** -- The SPSP handler called `negotiateSettlementChain()` and `openChannel()`. These calls move from the handler to `bootstrapWithPeer()` in this story. Same functions, different call site.
- **Kind pricing override** -- SPSP had `[SPSP_REQUEST_KIND]: basePricePerByte / 2n`. This is simply removed (no replacement needed).
- **Test count impact** -- Story 2.2 added ~33K of test code in `spsp-handshake-handler.test.ts`. These tests are deleted, reducing the total test count.

### References

- [Source: packages/core/src/spsp/ -- entire module to delete]
- [Source: packages/core/src/constants.ts -- SPSP_REQUEST_KIND, SPSP_RESPONSE_KIND]
- [Source: packages/core/src/errors.ts -- SpspError, SpspTimeoutError]
- [Source: packages/core/src/types.ts -- SpspInfo, SpspRequest, SpspResponse, SettlementNegotiationConfig, SettlementNegotiationResult]
- [Source: packages/core/src/events/builders.ts -- buildSpspRequestEvent, buildSpspResponseEvent]
- [Source: packages/core/src/events/parsers.ts -- parseSpspRequest, parseSpspResponse]
- [Source: packages/core/src/bootstrap/BootstrapService.ts -- performSpspHandshake(), handshaking phase]
- [Source: packages/core/src/bootstrap/RelayMonitor.ts -- peerWith() with SPSP, IlpSpspClient usage]
- [Source: packages/core/src/bootstrap/types.ts -- BootstrapPhase with 'handshaking', BootstrapServiceConfig with settlementInfo]
- [Source: packages/sdk/src/spsp-handshake-handler.ts -- stub to delete]
- [Source: packages/sdk/src/index.ts -- createSpspHandshakeHandler export to remove]
- [Source: packages/town/src/handlers/spsp-handshake-handler.ts -- real handler to delete]
- [Source: packages/town/src/town.ts -- SPSP handler registration, kind pricing]
- [Source: packages/town/src/index.ts -- createSpspHandshakeHandler export]
- [Source: docker/src/entrypoint.ts -- 200+ lines of SPSP handling]
- [Source: docker/src/entrypoint-town.ts -- SPSP handler references]
- [Source: packages/core/src/spsp/settlement.ts -- pure functions to KEEP and relocate]
- [Source: packages/core/src/compose.ts -- 8 SPSP JSDoc/comment references to update]
- [Source: packages/core/src/bootstrap/direct-bls-client.ts -- 3 SPSP JSDoc references to update]
- [Source: packages/sdk/src/create-node.ts -- 2 SPSP JSDoc references to update]
- [Source: packages/town/src/doc-cleanup-and-reference.test.ts -- SPSP documentation assertions that will FAIL]
- [Source: packages/town/src/cleanup.test.ts -- 1 SPSP comment reference]
- [Source: packages/town/src/handlers/x402-publish-handler.test.ts -- SPSP references in test names/comments]
- [Source: packages/bls/src/config.ts -- spspMinPrice config field and SPSP_MIN_PRICE env var]
- [Source: packages/bls/src/server.ts -- spspMinPrice config field]
- [Source: packages/bls/examples/nip34-integration.ts -- SPSP references]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- Task 1: Deleted entire `packages/core/src/spsp/` directory (8 files). Removed SPSP constants, error classes, types, event parsers/builders from core. Relocated `settlement.ts` and `settlement.test.ts` to `packages/core/src/settlement/`.
- Task 2: Created `packages/core/src/settlement/` directory with relocated `settlement.ts`, `settlement.test.ts`, and new `index.ts`. Updated all import paths.
- Task 3: Removed `handshaking` phase from BootstrapService. Renamed `bootstrap:handshake-failed` to `bootstrap:settlement-failed`. Updated BootstrapPhase type.
- Task 4: Removed SPSP from RelayMonitor -- removed IlpSpspClient dependency, SPSP handshake in peerWith(), simplified to register + channel opening.
- Task 5: Deleted `packages/sdk/src/spsp-handshake-handler.ts`. Removed SPSP exports from SDK index. Updated JSDoc in create-node.ts.
- Task 6: Deleted `packages/town/src/handlers/spsp-handshake-handler.ts` and test. Removed SPSP handler registration, kind pricing, and imports from town.ts. Updated related tests.
- Task 7: Updated Docker entrypoints -- removed SPSP handling code from `docker/src/entrypoint.ts` and `docker/src/entrypoint-town.ts`. Removed SPSP_MIN_PRICE env vars.
- Task 8: Updated 20+ files across BLS, relay, client, SDK, town, and deployment packages. Removed all SPSP references from source code, tests, configs, and deployment scripts. Second pass (review cleanup): updated 15 additional files with remaining SPSP references in comments, test names, JSDoc, and env files (direct-bls-client.ts, BootstrapService.test.ts, RelayMonitor.test.ts, toon.test.ts, relay PricingService.test.ts, client examples, e2e tests, SDK integration tests, pricing-validator.test.ts, doc-cleanup-and-reference.test.ts, vitest.config.ts, .env.example, .env.peer2, package.json).
- Task 9: Verified bootstrap/index.ts exports are clean.
- Task 10: Build, lint, format, and all 1274 tests pass. 0 lint errors. All formatters pass.
- NFR Review: Found and fixed 10 additional issues. Replaced kind 23194 references in pricing tests (relay, bls, sdk) with kind 30023. Fixed SPSP in core/package.json description and keywords, client/package.json keywords, client/src/modes/types.ts "handshaking" comment, service-discovery.test.ts supportedKinds array, BootstrapService.test.ts "three-phase" comment, bls/Dockerfile.bootstrap SPSP reference. All 1274 tests pass. 0 lint errors.
- Test-Arch Review: Created 25 automated tests covering all 8 ACs: AC#1 (phase flow no handshaking, 2 tests), AC#2 (settlement field in addPeer, 2 tests), AC#3/#5 (peerWith flow without SPSP, 1 test), AC#4 (SPSP code removal static verification, 8 tests), AC#7 (bootstrap:settlement-failed event, 2 tests), AC#8 (SPSP references cleaned from source files, 5 tests), AC#1/#2 combined (settlement during registration, 3 tests). All 1299 tests pass. 0 lint errors.

### File List

**Deleted:**
- packages/core/src/spsp/ (entire directory: IlpSpspClient.ts, NostrSpspClient.ts, NostrSpspServer.ts, negotiateAndOpenChannel.ts, index.ts, and all test files)
- packages/sdk/src/spsp-handshake-handler.ts
- packages/town/src/handlers/spsp-handshake-handler.ts
- packages/town/src/handlers/spsp-handshake-handler.test.ts

**Created:**
- packages/core/src/settlement/settlement.ts (relocated from spsp/)
- packages/core/src/settlement/settlement.test.ts (relocated from spsp/)
- packages/core/src/settlement/index.ts
- packages/core/src/bootstrap/spsp-removal-verification.test.ts (test-arch: 25 tests covering all 8 ACs)

**Modified:**
- packages/core/src/constants.ts
- packages/core/src/errors.ts
- packages/core/src/errors.test.ts
- packages/core/src/types.ts
- packages/core/src/types.test.ts
- packages/core/src/index.ts
- packages/core/src/index.test.ts
- packages/core/src/constants.test.ts
- packages/core/src/events/parsers.ts
- packages/core/src/events/parsers.test.ts
- packages/core/src/events/builders.ts
- packages/core/src/events/builders.test.ts
- packages/core/src/events/index.ts
- packages/core/src/bootstrap/BootstrapService.ts
- packages/core/src/bootstrap/BootstrapService.test.ts
- packages/core/src/bootstrap/RelayMonitor.ts
- packages/core/src/bootstrap/RelayMonitor.test.ts
- packages/core/src/bootstrap/types.ts
- packages/core/src/bootstrap/index.ts
- packages/core/src/compose.ts
- packages/core/src/bootstrap/direct-bls-client.ts
- packages/core/src/__integration__/five-peer-bootstrap.test.ts
- packages/sdk/src/index.ts
- packages/sdk/src/index.test.ts
- packages/sdk/src/create-node.ts
- packages/sdk/src/publish-event.test.ts
- packages/sdk/src/pricing-validator.test.ts
- packages/town/src/town.ts
- packages/town/src/index.ts
- packages/town/src/subscribe.test.ts
- packages/town/src/cleanup.test.ts
- packages/town/src/doc-cleanup-and-reference.test.ts
- packages/town/src/handlers/event-storage-handler.ts
- packages/town/src/handlers/x402-publish-handler.test.ts
- packages/town/vitest.config.ts
- packages/bls/src/bls/BusinessLogicServer.ts
- packages/bls/src/bls/BusinessLogicServer.test.ts
- packages/bls/src/bls/types.ts
- packages/bls/src/config.ts
- packages/bls/src/config.test.ts
- packages/bls/src/entrypoint.ts
- packages/bls/src/entrypoint-bls-only.ts
- packages/bls/src/server.ts
- packages/bls/src/pricing/PricingService.test.ts
- packages/bls/examples/nip34-integration.ts
- packages/relay/src/bls/BusinessLogicServer.ts
- packages/relay/src/bls/BusinessLogicServer.test.ts
- packages/relay/src/bls/types.ts
- docker/src/entrypoint.ts
- docker/src/entrypoint.test.ts
- docker/src/entrypoint-town.ts
- packages/relay/src/pricing/PricingService.test.ts
- packages/client/examples/with-payment-channels.ts
- packages/client/tests/e2e/genesis-bootstrap-with-channels.test.ts
- packages/client/tests/e2e/sdk-relay-validation.test.ts
- packages/sdk/src/__integration__/network-discovery.test.ts
- packages/core/src/toon/toon.test.ts
- docker-compose-genesis.yml
- deploy-genesis-node.sh
- deploy-peers.sh
- .env
- .env.example
- .env.peer2
- package.json

**Modified (NFR review pass):**
- packages/core/package.json (description and keywords)
- packages/client/package.json (keywords)
- packages/client/src/modes/types.ts (comment update)
- packages/core/src/events/service-discovery.test.ts (removed kind 23194 from supportedKinds)
- packages/core/src/bootstrap/BootstrapService.test.ts (three-phase -> two-phase comment)
- packages/relay/src/pricing/PricingService.test.ts (kind 23194 -> 30023)
- packages/bls/src/pricing/PricingService.test.ts (kind 23194 -> 30023)
- packages/sdk/src/pricing-validator.test.ts (kind 23194 -> 30023)
- packages/bls/Dockerfile.bootstrap (removed SPSP from comment)

## Code Review Record

### Review Pass #1

- **Date:** 2026-03-07
- **Reviewer model:** Claude Opus 4.6 (claude-opus-4-6)
- **Issue counts by severity:**
  - Critical: 0
  - High: 0
  - Medium: 0
  - Low: 15
- **Issues summary:** All 15 low issues were stale SPSP references in `_bmad-output/project-context.md` and `MEMORY.md` (project management / documentation files). These references used outdated terminology or failed to note the SPSP removal completed in this story.
- **Outcome:** All 15 issues found and fixed in the same review pass. No outstanding action items.
- **Follow-up tasks:** None. All issues were resolved during the review. No new Tasks/Subtasks entries required -- the fixes were documentation-only changes to project management files already covered by the out-of-scope note in Task 8 (cleanup debt tracked per Epic 2 retro A4).

### Review Pass #2

- **Date:** 2026-03-07
- **Reviewer model:** Claude Opus 4.6 (claude-opus-4-6)
- **Issue counts by severity:**
  - Critical: 0
  - High: 0
  - Medium: 1
  - Low: 0
- **Issues summary:** 1 medium issue found: `packages/bls/src/entrypoint.ts` line 174 passed `ilpAddress` into a `SettlementConfig` object literal, but `SettlementConfig` does not include an `ilpAddress` field (it was introduced when `SpspRequestSettlementInfo` was replaced with `SettlementConfig` in Story 2.7). This caused a TypeScript error (`TS2353: Object literal may only specify known properties`). The `ilpAddress` is not a settlement concern and was removed from the object literal.
- **Outcome:** 1 issue found and fixed. Build, lint (0 errors), and all 1299 tests pass after fix.
- **Follow-up tasks:** None.

### Review Pass #3

- **Date:** 2026-03-07
- **Reviewer model:** Claude Opus 4.6 (claude-opus-4-6)
- **Review scope:** Full code review + OWASP top 10, authentication/authorization, injection risk analysis
- **Issue counts by severity:**
  - Critical: 0
  - High: 0
  - Medium: 2
  - Low: 2
- **Issues found and fixed:**
  1. **Medium -- CWE-209: Information Exposure (docker/src/entrypoint.ts:468):** The `/handle-packet` 500 error handler leaked `error.message` to the HTTP client. Per project rules (CWE-209 prevention), replaced with generic "Internal server error" and added server-side logging. The `entrypoint-town.ts` already had the correct pattern.
  2. **Medium -- Uncaught JSON.parse DoS (packages/core/src/bootstrap/BootstrapService.ts:569):** `JSON.parse(data.toString())` in the WebSocket message handler had no try-catch. A malformed relay message would throw and crash the bootstrap WebSocket handler, causing a denial-of-service during peer discovery. Wrapped in try-catch with graceful recovery. Also improved type safety from implicit `any` to properly typed `unknown[]` with narrowing for `event.id` access.
  3. **Low -- `!body.amount` truthiness bug (docker/src/entrypoint.ts:373):** Known Epic 2 retro item A1. `!body.amount` evaluates to `true` when `amount` is "0" (a valid payment amount), causing legitimate zero-amount requests to be rejected. Fixed to use `body.amount === undefined || body.amount === null`.
  4. **Low -- `!body.amount` truthiness bug (docker/src/entrypoint-town.ts:283):** Same truthiness bug in the SDK reference entrypoint. Applied identical fix.
- **Security analysis (OWASP top 10):**
  - **A01:2021 Broken Access Control:** No issues. BLS `/handle-packet` validates Schnorr signatures and pricing. Connector admin API is internal-only.
  - **A02:2021 Cryptographic Failures:** No issues. Uses @noble/curves for Schnorr, @noble/hashes for SHA-256. No hardcoded secrets in source code.
  - **A03:2021 Injection:** No issues. No SQL injection (better-sqlite3 uses parameterized queries). No command injection (no exec/execFile calls). Log injection mitigated via sanitize regex.
  - **A04:2021 Insecure Design:** No issues. Settlement negotiation is deterministic from kind:10032 data. Channel opening is non-fatal.
  - **A05:2021 Security Misconfiguration:** No issues found in this story's scope. CORS is enabled by design for BLS.
  - **A06:2021 Vulnerable Components:** Out of scope (tracked as retro A5).
  - **A07:2021 Authentication Failures:** No issues. Nostr event signatures verified before processing.
  - **A08:2021 Software/Data Integrity Failures:** No issues. TOON codec integrity maintained.
  - **A09:2021 Security Logging Failures:** (Fixed) CWE-209 issue #1 above was logging internal errors to client.
  - **A10:2021 Server-Side Request Forgery:** No issues. Relay URLs are from configuration, not user input.
- **Outcome:** All 4 issues found and fixed. Build passes, lint 0 errors, all 1299 tests pass.
- **Follow-up tasks:** None.

## Change Log

- 2026-03-07: Code review #3 record added. Security-focused review found 0 critical, 0 high, 2 medium, 2 low issues. Fixed CWE-209 info leak in entrypoint.ts, uncaught JSON.parse in BootstrapService.ts, and !body.amount truthiness bugs in both Docker entrypoints. OWASP top 10 analysis performed -- no additional findings. All 1299 tests pass, 0 lint errors.
- 2026-03-07: Code review #2 record added. Review found 0 critical, 0 high, 1 medium, 0 low issues. Fixed `ilpAddress` property in `SettlementConfig` object in `packages/bls/src/entrypoint.ts` (TS2353 type error). All 1299 tests pass, 0 lint errors.
- 2026-03-07: Code review #1 record added. Review found 0 critical, 0 high, 0 medium, 15 low issues (all stale SPSP references in project-context.md and MEMORY.md). All 15 fixed. No follow-up tasks created.
- 2026-03-07: Test-arch review (yolo, second pass). Found and fixed 5 issues: (1) `packages/core/src/bootstrap/index.ts` module description said "ILP-first handshake" -- updated to "settlement negotiation". (2) `packages/client/src/CrosstownClient.ts` had 3 "handshake" references in JSDoc/comments -- updated to settlement/registration terminology. (3) AC#8 source-scan test now includes `client/src` and `docker/src` directories (were missing). (4) AC#8 source-scan test skip logic refined -- "removed/deprecated/eliminated" exception now only applies to comment lines, not code lines. (5) `BootstrapService.test.ts` "Phase 3" section comment updated to "Phase 2" for consistency with two-phase description. All 1299 tests pass, 0 lint errors.
- 2026-03-07: Test-arch review pass. Created `packages/core/src/bootstrap/spsp-removal-verification.test.ts` with 25 new tests covering all 8 ACs. Tests verify: no handshaking phase (AC#1), settlement field in addPeer (AC#2), peerWith flow without SPSP (AC#3/#5), SPSP file deletion and export removal (AC#4), bootstrap:settlement-failed event (AC#7), SPSP reference cleanup in source files (AC#8). Total: 1299 tests pass, 0 lint errors, format passes.
- 2026-03-07: NFR review pass (test-arch). Found and fixed 10 remaining SPSP references in package.json metadata, pricing tests (kind 23194 -> 30023), BootstrapService.test.ts phase comment, service-discovery.test.ts supportedKinds, client types comment, and Dockerfile. Build + lint + 1274 tests all pass.
- 2026-03-07: Review cleanup pass. Found and fixed 30+ remaining SPSP references in comments, test names, JSDoc, env files, and package.json across 15 files. Renamed `createSpspInfo` test helper to `createKind10047Event` in toon.test.ts. Updated root package.json description and keywords. Removed SPSP_MIN_PRICE from .env.example and .env.peer2. Build passes, lint 0 errors, 1274 tests pass. Status: review.
- 2026-03-07: Development complete. All 10 tasks implemented. Removed SPSP module (8 files), relocated settlement utilities, simplified bootstrap phases (4 phases to 3), cleaned 50+ files. Build passes, lint 0 errors, 1267 tests pass. Status: review.
- 2026-03-07: Story created. Status: ready-for-dev.
- 2026-03-07: Adversarial review (yolo mode). 14 issues found, all fixed: (1) Added AC #7 for `bootstrap:handshake-failed` -> `bootstrap:settlement-failed` event rename (was only in tasks/dev notes, not in ACs). (2) Added AC #8 for SPSP JSDoc/comment cleanup in infrastructure files (compose.ts, create-node.ts, direct-bls-client.ts were not covered by any AC). (3) Removed false positive from Task 8: `packages/core/src/events/service-discovery.test.ts` has NO SPSP references (verified via grep). (4) Added 6 missing files to Task 8: `compose.ts` (8 refs), `direct-bls-client.ts` (3 refs), `bls/examples/nip34-integration.ts`, `bls/src/bls/types.ts`, organized Task 8 by package category. (5) Added `packages/town/src/doc-cleanup-and-reference.test.ts` as CRITICAL in Task 6 -- this test ASSERTS SPSP documentation and will FAIL if not updated. (6) Added `packages/town/src/handlers/event-storage-handler.ts` to Task 6 for SPSP JSDoc comment removal. (7) Moved `pricing-validator.test.ts` from Task 8 to Task 5 (belongs with SDK cleanup). (8) Added Test Design Traceability table mapping test categories to ACs and priorities. (9) Added Risk Mitigations section with 4 identified risks. (10) Added Previous Story Intelligence section referencing Story 2.2 patterns. (11) Added `bootstrap:handshake-failed` -> `bootstrap:settlement-failed` rename to Removal Inventory. (12) Added JSDoc/Comment cleanup section to Removal Inventory with file-level reference counts. (13) Added out-of-scope note for documentation files with SPSP references (tracked as cleanup debt per Epic 2 retro A4). (14) Added Dev Agent Record boilerplate section. | Review (Claude Opus 4.6)
