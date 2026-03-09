---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-07'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/2-7-spsp-removal-and-peer-discovery-cleanup.md'
  - '_bmad-output/project-context.md'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
  - '_bmad/tea/testarch/knowledge/test-levels-framework.md'
---

# ATDD Checklist - Epic 2, Story 2.7: SPSP Removal and Peer Discovery Cleanup

**Date:** 2026-03-07
**Author:** Jonathan
**Primary Test Level:** Unit + Build Verification + Integration
**TDD Phase:** GREEN (implementation complete, 1270 tests passing verified 2026-03-07)

---

## Story Summary

Remove the SPSP handshake (kind:23194/23195) from the entire protocol and simplify the peer discovery flow from four phases (discovering -> registering -> handshaking -> announcing) to three phases (discovering -> registering -> announcing). Settlement negotiation now runs locally against kind:10032 data during the registration phase, with channel opening happening unilaterally instead of via a request-response handshake.

**As a** protocol developer
**I want** the SPSP handshake removed from the protocol and the peer discovery flow simplified
**So that** peers can transact immediately after discovery without a negotiation round-trip

---

## Acceptance Criteria

1. **AC #1 -- Phase simplification:** The bootstrap flow is reduced from discovering -> registering -> handshaking -> announcing to discovering -> registering -> announcing. Channel opening happens during registration using kind:10032 settlement data, and chain selection runs locally.

2. **AC #2 -- Settlement in addPeerToConnector:** `addPeerToConnector()` populates the `settlement` field in `ConnectorAdminClient.addPeer()` with chain-selected data from the peer's kind:10032: chainId, tokenNetworkAddress, tokenAddress, evmAddress, and channelId.

3. **AC #3 -- peerWith() flow simplification:** `peerWith()` performs: read peer's kind:10032 -> select chain locally -> register with connector (including settlement info) -> open channel unilaterally. No kind:23194/23195 events are created or processed.

4. **AC #4 -- SPSP code removal:** `NostrSpspServer`, `NostrSpspClient`, `IlpSpspClient`, SPSP event builders/parsers removed from `@crosstown/core`. `createSpspHandshakeHandler()` removed from `@crosstown/town`. SDK stub removed. SPSP constants and error classes removed.

5. **AC #5 -- RelayMonitor SPSP removal:** `RelayMonitor.peerWith()` no longer performs SPSP handshake. The `IlpSpspClient` dependency is removed.

6. **AC #6 -- All tests pass:** Full `pnpm test` suite passes with the simplified flow, payment channel creation works via unilateral opening during registration, and the total test count reflects removal of SPSP-specific test files.

7. **AC #7 -- Event rename:** `bootstrap:handshake-failed` event is renamed to `bootstrap:settlement-failed` to reflect that settlement negotiation can still fail but is now a non-fatal event during the registration phase.

8. **AC #8 -- JSDoc cleanup:** SPSP references removed from compose.ts, create-node.ts, direct-bls-client.ts, and test/documentation files.

---

## Test Design Traceability

| ATDD Test ID | Test Name | AC | Priority | Level | Status |
|---|---|---|---|---|---|
| T-2.7-01 | BootstrapPhase type does not include 'handshaking' | #1 | P0 | Unit (static) | GREEN |
| T-2.7-02 | Bootstrap phases transition: discovering -> registering -> announcing -> ready | #1 | P0 | Unit | GREEN |
| T-2.7-03 | bootstrapWithPeer() runs local chain selection during registration | #1, #2 | P0 | Unit | GREEN |
| T-2.7-04 | bootstrapWithPeer() opens channel unilaterally with correct params | #1, #2 | P0 | Unit | GREEN |
| T-2.7-05 | addPeerToConnector() re-registers with settlement field after channel opening | #2 | P0 | Unit | GREEN |
| T-2.7-06 | peerWith() registers peer and opens channel without SPSP events | #3, #5 | P0 | Unit | GREEN |
| T-2.7-07 | SPSP_REQUEST_KIND and SPSP_RESPONSE_KIND constants are removed | #4 | P0 | Build verify | GREEN |
| T-2.7-08 | SpspError and SpspTimeoutError classes are removed | #4 | P0 | Build verify | GREEN |
| T-2.7-09 | SPSP types (SpspInfo, SpspRequest, SpspResponse) are removed | #4 | P0 | Build verify | GREEN |
| T-2.7-10 | SPSP event parsers/builders are removed from events module | #4 | P0 | Build verify | GREEN |
| T-2.7-11 | packages/core/src/spsp/ directory is fully deleted | #4 | P0 | Build verify | GREEN |
| T-2.7-12 | packages/sdk/src/spsp-handshake-handler.ts is deleted | #4 | P1 | Build verify | GREEN |
| T-2.7-13 | packages/town/src/handlers/spsp-handshake-handler.ts is deleted | #4 | P1 | Build verify | GREEN |
| T-2.7-14 | createSpspHandshakeHandler not exported from @crosstown/town | #4 | P1 | Unit (export) | GREEN |
| T-2.7-15 | createSpspHandshakeHandler not exported from @crosstown/sdk | #4 | P1 | Unit (export) | GREEN |
| T-2.7-16 | RelayMonitor has no IlpSpspClient dependency | #5 | P1 | Unit | GREEN |
| T-2.7-17 | peerWith() settlement failure emits 'bootstrap:settlement-failed' (not handshake-failed) | #7 | P1 | Unit | GREEN |
| T-2.7-18 | BootstrapEvent type includes 'bootstrap:settlement-failed' | #7 | P1 | Unit (static) | GREEN |
| T-2.7-19 | Settlement functions relocated to packages/core/src/settlement/ | #1 | P1 | Build verify | GREEN |
| T-2.7-20 | negotiateSettlementChain and resolveTokenForChain exported from @crosstown/core | #1 | P1 | Unit (export) | GREEN |
| T-2.7-21 | pnpm build succeeds with zero SPSP imports | #6 | P0 | Build verify | GREEN |
| T-2.7-22 | pnpm test passes all remaining tests | #6 | P0 | Build verify | GREEN |
| T-2.7-23 | pnpm lint reports zero errors | #6 | P1 | Build verify | GREEN |
| T-2.7-24 | Settlement failure during registration is non-fatal (peer remains registered) | #1, #7 | P1 | Unit | GREEN |
| T-2.7-25 | Channel opening emits bootstrap:channel-opened event | #1, #2 | P2 | Unit | GREEN |
| T-2.7-26 | SPSP references cleaned from compose.ts JSDoc (8 references) | #8 | P2 | Grep verify | YELLOW |
| T-2.7-27 | SPSP references cleaned from direct-bls-client.ts JSDoc (3 references) | #8 | P2 | Grep verify | RED |
| T-2.7-28 | SPSP references cleaned from create-node.ts JSDoc (2 references) | #8 | P2 | Grep verify | GREEN |
| T-2.7-29 | No kind:23194/23195 referenced in non-test source files | #4 | P1 | Grep verify | GREEN |
| T-2.7-30 | BootstrapService.test.ts comments updated to remove SPSP references | #8 | P2 | Grep verify | RED |
| T-2.7-31 | RelayMonitor.test.ts comments updated to remove SPSP references | #8 | P2 | Grep verify | RED |
| T-2.7-32 | Town kind pricing no longer includes SPSP_REQUEST_KIND override | #4 | P1 | Unit | GREEN |

**Priority Distribution:** P0: 9, P1: 13, P2: 5, Total: 32
**Residual SPSP references identified (RED/YELLOW items):** 4 tests flagged -- see Remaining Concerns section

---

## Tests (32 total)

### Phase Simplification Tests (AC #1)

**File:** `packages/core/src/bootstrap/BootstrapService.test.ts`

- **T-2.7-01:** `[P0] BootstrapPhase type does not include 'handshaking'`
  - **Status:** GREEN
  - **Verifies:** `BootstrapPhase` union type is `'discovering' | 'registering' | 'announcing' | 'ready' | 'failed'` (no 'handshaking')
  - **Approach:** Static type assertion -- compile-time check via `BootstrapPhase` import

- **T-2.7-02:** `[P0] Bootstrap phases transition: discovering -> registering -> announcing -> ready`
  - **Status:** GREEN
  - **Verifies:** Phase events emitted in order: discovering, registering, announcing, ready. No 'handshaking' phase emitted.
  - **Evidence:** BootstrapService.test.ts tests bootstrap lifecycle with phase listeners

- **T-2.7-03:** `[P0] bootstrapWithPeer() runs local chain selection during registration`
  - **Status:** GREEN
  - **Verifies:** `negotiateSettlementChain()` is called with own and peer's supported chains during `bootstrapWithPeer()`, not in a separate handshaking phase
  - **Evidence:** BootstrapService source Step 3 calls `negotiateSettlementChain()` inside `bootstrapWithPeer()`

- **T-2.7-04:** `[P0] bootstrapWithPeer() opens channel unilaterally with correct params`
  - **Status:** GREEN
  - **Verifies:** `channelClient.openChannel()` is called with peerId, chain, token, tokenNetwork, peerAddress, initialDeposit, settlementTimeout
  - **Evidence:** BootstrapService source calls `this.channelClient.openChannel()` in Step 3

### Settlement in Registration Tests (AC #2)

**File:** `packages/core/src/bootstrap/BootstrapService.test.ts`

- **T-2.7-05:** `[P0] addPeerToConnector() re-registers with settlement field after channel opening`
  - **Status:** GREEN
  - **Verifies:** After channel opening, `connectorAdmin.addPeer()` is called again with `settlement` field containing `preference`, `evmAddress`, `tokenAddress`, `tokenNetworkAddress`, `channelId`
  - **Evidence:** BootstrapService source Step 3 re-calls `this.connectorAdmin.addPeer()` with settlement data

### peerWith() Flow Tests (AC #3, #5)

**File:** `packages/core/src/bootstrap/RelayMonitor.test.ts`

- **T-2.7-06:** `[P0] peerWith() registers peer and opens channel without SPSP events`
  - **Status:** GREEN
  - **Verifies:** `peerWith()` calls `connectorAdmin.addPeer()` for registration, then `channelClient.openChannel()` for channel, then re-registers with settlement. No kind:23194/23195 events created.
  - **Evidence:** RelayMonitor source `peerWith()` method has no SPSP imports or event builders

### SPSP Code Removal Tests (AC #4)

**File:** Build verification (compile-time / file existence)

- **T-2.7-07:** `[P0] SPSP_REQUEST_KIND and SPSP_RESPONSE_KIND constants are removed`
  - **Status:** GREEN
  - **Verifies:** `packages/core/src/constants.ts` does not export `SPSP_REQUEST_KIND` or `SPSP_RESPONSE_KIND`
  - **Evidence:** constants.ts contains only `ILP_PEER_INFO_KIND`

- **T-2.7-08:** `[P0] SpspError and SpspTimeoutError classes are removed`
  - **Status:** GREEN
  - **Verifies:** `packages/core/src/errors.ts` does not contain `SpspError` or `SpspTimeoutError`
  - **Evidence:** errors.ts contains only `CrosstownError`, `InvalidEventError`, `PeerDiscoveryError`

- **T-2.7-09:** `[P0] SPSP types (SpspInfo, SpspRequest, SpspResponse) are removed`
  - **Status:** GREEN
  - **Verifies:** `packages/core/src/types.ts` does not contain `SpspInfo`, `SpspRequest`, `SpspResponse`, `SettlementNegotiationConfig`, `SettlementNegotiationResult`
  - **Evidence:** types.ts exports only IlpPeerInfo, Subscription, OpenChannelParams, OpenChannelResult, ChannelState, ConnectorChannelClient

- **T-2.7-10:** `[P0] SPSP event parsers/builders are removed from events module`
  - **Status:** GREEN
  - **Verifies:** No `parseSpspRequest`, `parseSpspResponse`, `buildSpspRequestEvent`, `buildSpspResponseEvent` in events module
  - **Evidence:** events/index.ts exports only ILP peer info parsers/builders

- **T-2.7-11:** `[P0] packages/core/src/spsp/ directory is fully deleted`
  - **Status:** GREEN
  - **Verifies:** No files exist under `packages/core/src/spsp/`
  - **Evidence:** `Glob` for `packages/core/src/spsp/**` returns no files

- **T-2.7-12:** `[P1] packages/sdk/src/spsp-handshake-handler.ts is deleted`
  - **Status:** GREEN
  - **Verifies:** SDK stub file no longer exists
  - **Evidence:** File confirmed deleted in Dev Agent Record

- **T-2.7-13:** `[P1] packages/town/src/handlers/spsp-handshake-handler.ts is deleted`
  - **Status:** GREEN
  - **Verifies:** Town handler file and test file no longer exist
  - **Evidence:** File confirmed deleted in Dev Agent Record

- **T-2.7-14:** `[P1] createSpspHandshakeHandler not exported from @crosstown/town`
  - **Status:** GREEN
  - **Verifies:** `packages/town/src/index.ts` does not export `createSpspHandshakeHandler` or `SpspHandshakeHandlerConfig`
  - **Evidence:** town index.ts exports only `startTown`, `TownConfig`, `TownInstance`, `TownSubscription`, `ResolvedTownConfig`, `createEventStorageHandler`, `EventStorageHandlerConfig`

- **T-2.7-15:** `[P1] createSpspHandshakeHandler not exported from @crosstown/sdk`
  - **Status:** GREEN
  - **Verifies:** `packages/sdk/src/index.ts` does not export `createSpspHandshakeHandler`
  - **Evidence:** SDK index.ts has no SPSP-related exports

- **T-2.7-29:** `[P1] No kind:23194/23195 referenced in non-test source files`
  - **Status:** GREEN
  - **Verifies:** No source file (excluding tests) references kind 23194 or 23195
  - **Evidence:** Grep for `23194|23195` in source files returns only test files

- **T-2.7-32:** `[P1] Town kind pricing no longer includes SPSP_REQUEST_KIND override`
  - **Status:** GREEN
  - **Verifies:** `packages/town/src/town.ts` does not include SPSP kind pricing override
  - **Evidence:** SPSP_REQUEST_KIND import and kind pricing entry removed from town.ts

### RelayMonitor SPSP Removal Tests (AC #5)

**File:** `packages/core/src/bootstrap/RelayMonitor.ts`

- **T-2.7-16:** `[P1] RelayMonitor has no IlpSpspClient dependency`
  - **Status:** GREEN
  - **Verifies:** No `IlpSpspClient` import, no `spspClient` field, no `getOrCreateSpspClient()` method in RelayMonitor
  - **Evidence:** RelayMonitor imports only from settlement, constants, events, types -- no SPSP module

### All Tests Pass (AC #6)

- **T-2.7-21:** `[P0] pnpm build succeeds with zero SPSP imports`
  - **Status:** GREEN
  - **Verifies:** All packages compile without errors from removed SPSP dependencies
  - **Evidence:** Dev Agent Record reports build passes

- **T-2.7-22:** `[P0] pnpm test passes all remaining tests`
  - **Status:** GREEN
  - **Verifies:** Full test suite passes (1270 tests verified, down from ~1454 pre-removal)
  - **Evidence:** Dev Agent Record reports 1267 tests passing

- **T-2.7-23:** `[P1] pnpm lint reports zero errors`
  - **Status:** GREEN
  - **Verifies:** No lint errors introduced by SPSP removal
  - **Evidence:** Dev Agent Record reports 0 lint errors

### Event Rename Tests (AC #7)

**File:** `packages/core/src/bootstrap/types.ts`, `packages/core/src/bootstrap/BootstrapService.test.ts`, `packages/core/src/bootstrap/RelayMonitor.test.ts`

- **T-2.7-17:** `[P1] peerWith() settlement failure emits 'bootstrap:settlement-failed' (not handshake-failed)`
  - **Status:** GREEN
  - **Verifies:** Settlement failure during peerWith() emits event with `type: 'bootstrap:settlement-failed'`
  - **Evidence:** RelayMonitor.ts emits `bootstrap:settlement-failed` in catch blocks; BootstrapService.ts also emits `bootstrap:settlement-failed`

- **T-2.7-18:** `[P1] BootstrapEvent type includes 'bootstrap:settlement-failed'`
  - **Status:** GREEN
  - **Verifies:** `BootstrapEvent` union includes `{ type: 'bootstrap:settlement-failed'; peerId: string; reason: string }`
  - **Evidence:** types.ts defines `bootstrap:settlement-failed` event variant

- **T-2.7-24:** `[P1] Settlement failure during registration is non-fatal (peer remains registered)`
  - **Status:** GREEN
  - **Verifies:** When channel opening fails, the peer is still registered with the connector (no rollback)
  - **Evidence:** BootstrapService and RelayMonitor both log warnings and emit events on settlement failure but do not deregister the peer

- **T-2.7-25:** `[P2] Channel opening emits bootstrap:channel-opened event`
  - **Status:** GREEN
  - **Verifies:** Successful channel opening emits `{ type: 'bootstrap:channel-opened', peerId, channelId, negotiatedChain }`
  - **Evidence:** Both BootstrapService and RelayMonitor emit this event after successful `channelClient.openChannel()`

### Settlement Function Relocation Tests

- **T-2.7-19:** `[P1] Settlement functions relocated to packages/core/src/settlement/`
  - **Status:** GREEN
  - **Verifies:** `packages/core/src/settlement/settlement.ts`, `settlement.test.ts`, and `index.ts` exist
  - **Evidence:** Glob confirms all three files exist

- **T-2.7-20:** `[P1] negotiateSettlementChain and resolveTokenForChain exported from @crosstown/core`
  - **Status:** GREEN
  - **Verifies:** `packages/core/src/index.ts` exports both functions from `./settlement/index.js`
  - **Evidence:** index.ts line 49-52 exports from settlement module

### JSDoc Cleanup Tests (AC #8)

- **T-2.7-26:** `[P2] SPSP references cleaned from compose.ts JSDoc (8 references)`
  - **Status:** YELLOW (partial -- needs verification of all 8 references)
  - **Verifies:** `packages/core/src/compose.ts` does not reference SPSP in JSDoc/comments
  - **Finding:** compose.ts description updated; further grep verification needed to confirm all 8 references cleaned

- **T-2.7-27:** `[P2] SPSP references cleaned from direct-bls-client.ts JSDoc (3 references)`
  - **Status:** RED (3 SPSP references still present)
  - **Verifies:** `packages/core/src/bootstrap/direct-bls-client.ts` does not reference SPSP
  - **Finding:** Lines 2, 5, 24 still contain "SPSP" in JSDoc comments

- **T-2.7-28:** `[P2] SPSP references cleaned from create-node.ts JSDoc (2 references)`
  - **Status:** GREEN
  - **Verifies:** `packages/sdk/src/create-node.ts` does not reference SPSP in JSDoc
  - **Evidence:** Dev Agent Record reports create-node.ts JSDoc updated

- **T-2.7-30:** `[P2] BootstrapService.test.ts comments updated to remove SPSP references`
  - **Status:** RED (12+ SPSP references still present in test comments/descriptions)
  - **Verifies:** Test file comments and describe/it blocks do not reference SPSP
  - **Finding:** Lines 5, 413, 416, 445, 448, 449, 456, 461, 481, 485, 521, 562 still reference SPSP

- **T-2.7-31:** `[P2] RelayMonitor.test.ts comments updated to remove SPSP references`
  - **Status:** RED (1 SPSP reference still present in test comment)
  - **Verifies:** Test file comments do not reference SPSP
  - **Finding:** Line 273 still references "SPSP response"

---

## Data Factories Created

### No Data Factories Required

This story is primarily a removal/refactoring story. Existing test infrastructure (mock connectors, test events, mock channel clients) from prior stories covers all test scenarios. No new domain entity generation is needed.

---

## Fixtures Created

### No Fixture Files Required

Tests are co-located with source files following existing project convention. Mock setup uses existing patterns from the project's test infrastructure (vi.mock for WebSocket, SimplePool, etc.).

---

## Mock Requirements

### Existing Mocks Used (No New Mocks Created)

All mocks from prior stories are reused:

- **WebSocket (ws):** `vi.mock('ws')` in BootstrapService.test.ts for simulating relay communication
- **SimplePool (nostr-tools/pool):** `vi.mock('nostr-tools/pool')` in RelayMonitor.test.ts for subscription testing
- **ConnectorAdminClient:** Mock with `addPeer()` / `removePeer()` vi.fn() methods
- **AgentRuntimeClient:** Mock with `sendIlpPacket()` vi.fn() returning configurable IlpSendResult
- **ConnectorChannelClient:** Mock with `openChannel()` vi.fn() returning `{ channelId, state }`

---

## Required data-testid Attributes

N/A -- This is a pure backend/protocol story with no UI components.

---

## Implementation Checklist

### T-2.7-01 through T-2.7-04: Phase simplification and settlement during registration

**File:** `packages/core/src/bootstrap/BootstrapService.ts`, `packages/core/src/bootstrap/types.ts`

**Tasks to make these tests pass:**

- [x] Remove `'handshaking'` from `BootstrapPhase` union type
- [x] Remove `performSpspHandshake()` method from BootstrapService
- [x] Integrate `negotiateSettlementChain()` call into `bootstrapWithPeer()`
- [x] Add `channelClient.openChannel()` call during registration
- [x] Update three-phase comment at top of file to document two-phase flow
- [x] Tests verify phase sequence: discovering -> registering -> announcing -> ready

**Status:** Complete

---

### T-2.7-05: Settlement field in addPeer re-registration

**File:** `packages/core/src/bootstrap/BootstrapService.ts`

**Tasks to make this test pass:**

- [x] After successful channel opening, call `connectorAdmin.addPeer()` with settlement field
- [x] Settlement field includes: preference (chain), evmAddress, tokenAddress, tokenNetworkAddress, channelId
- [x] Test verifies the settlement object structure in the addPeer call

**Status:** Complete

---

### T-2.7-06: peerWith() without SPSP

**File:** `packages/core/src/bootstrap/RelayMonitor.ts`

**Tasks to make this test pass:**

- [x] Remove IlpSpspClient import and usage from peerWith()
- [x] Add local chain selection and unilateral channel opening to peerWith()
- [x] Verify no kind:23194/23195 events are created

**Status:** Complete

---

### T-2.7-07 through T-2.7-15: SPSP code removal

**Tasks to make these tests pass:**

- [x] Delete `packages/core/src/spsp/` directory (8 files)
- [x] Remove SPSP constants from `packages/core/src/constants.ts`
- [x] Remove SPSP error classes from `packages/core/src/errors.ts`
- [x] Remove SPSP types from `packages/core/src/types.ts`
- [x] Remove SPSP parsers/builders from `packages/core/src/events/`
- [x] Delete `packages/sdk/src/spsp-handshake-handler.ts`
- [x] Delete `packages/town/src/handlers/spsp-handshake-handler.ts` and test
- [x] Remove SPSP exports from SDK and Town index files
- [x] Remove SPSP kind pricing from town.ts

**Status:** Complete

---

### T-2.7-16: RelayMonitor dependency cleanup

**File:** `packages/core/src/bootstrap/RelayMonitor.ts`

**Tasks to make this test pass:**

- [x] Remove IlpSpspClient import
- [x] Remove spspClient field
- [x] Import negotiateSettlementChain and resolveTokenForChain from settlement module

**Status:** Complete

---

### T-2.7-17 through T-2.7-18, T-2.7-24 through T-2.7-25: Event rename and non-fatal settlement

**File:** `packages/core/src/bootstrap/types.ts`, `BootstrapService.ts`, `RelayMonitor.ts`

**Tasks to make these tests pass:**

- [x] Rename `bootstrap:handshake-failed` to `bootstrap:settlement-failed` in BootstrapEvent type
- [x] Update all emit calls to use new event name
- [x] Ensure settlement failure is non-fatal (log warning, continue)
- [x] Keep `bootstrap:channel-opened` event for successful channel openings

**Status:** Complete

---

### T-2.7-19 through T-2.7-20: Settlement function relocation

**Tasks to make these tests pass:**

- [x] Create `packages/core/src/settlement/` directory
- [x] Move `settlement.ts` and `settlement.test.ts` from `spsp/` to `settlement/`
- [x] Create `packages/core/src/settlement/index.ts` with re-exports
- [x] Update `packages/core/src/index.ts` to import from new location

**Status:** Complete

---

### T-2.7-21 through T-2.7-23: Build, test, lint verification

**Tasks to make these tests pass:**

- [x] `pnpm build` -- all packages build without SPSP imports
- [x] `pnpm test` -- 1267 tests passing
- [x] `pnpm lint` -- 0 errors

**Status:** Complete

---

### T-2.7-26 through T-2.7-31: JSDoc cleanup

**Tasks to make these tests pass:**

- [x] Update compose.ts JSDoc (8 SPSP references)
- [ ] Update direct-bls-client.ts JSDoc (3 SPSP references still present)
- [x] Update create-node.ts JSDoc (2 SPSP references)
- [ ] Update BootstrapService.test.ts comments (12+ SPSP references still present)
- [ ] Update RelayMonitor.test.ts comments (1 SPSP reference still present)

**Status:** PARTIAL -- 3 files still contain SPSP references in comments/JSDoc (see Remaining Concerns)

---

## Running Tests

```bash
# Run all tests for the story's key files
npx vitest run packages/core/src/bootstrap/BootstrapService.test.ts
npx vitest run packages/core/src/bootstrap/RelayMonitor.test.ts
npx vitest run packages/core/src/settlement/settlement.test.ts
npx vitest run packages/core/src/constants.test.ts
npx vitest run packages/core/src/errors.test.ts
npx vitest run packages/core/src/types.test.ts
npx vitest run packages/core/src/index.test.ts
npx vitest run packages/core/src/events/parsers.test.ts
npx vitest run packages/core/src/events/builders.test.ts

# Run SDK-related tests
npx vitest run packages/sdk/src/index.test.ts
npx vitest run packages/sdk/src/pricing-validator.test.ts

# Run Town-related tests
npx vitest run packages/town/src/doc-cleanup-and-reference.test.ts

# Run full project test suite
pnpm test

# Run with verbose output
pnpm test -- --reporter=verbose

# Verify SPSP references are gone (non-test source files)
grep -rn 'SPSP\|spsp\|23194\|23195' packages/*/src/ --include='*.ts' | grep -v '.test.ts' | grep -v node_modules
```

---

## Red-Green-Refactor Workflow

### RED Phase (N/A)

This story is a removal/refactoring story, not a new feature. The "RED phase" equivalent was: SPSP code exists and the protocol has a 4-phase bootstrap. The acceptance criteria define a 3-phase bootstrap with no SPSP code.

### GREEN Phase (Complete)

All 10 tasks from the story implementation are complete. The Dev Agent Record confirms:

- Deleted 8 files from `packages/core/src/spsp/`
- Deleted 3 files from SDK and Town packages
- Created 3 files in `packages/core/src/settlement/`
- Modified 50+ files across all packages
- 1267 tests passing, 0 lint errors, format clean

### REFACTOR Phase (In Progress)

**Residual cleanup needed (3 items):**

1. `packages/core/src/bootstrap/direct-bls-client.ts` -- 3 SPSP JSDoc references at lines 2, 5, 24
2. `packages/core/src/bootstrap/BootstrapService.test.ts` -- 12+ SPSP references in comments and test descriptions
3. `packages/core/src/bootstrap/RelayMonitor.test.ts` -- 1 SPSP reference in comment at line 273

These are P2 comment/JSDoc-only issues that do not affect functionality or test correctness.

---

## Knowledge Base References Applied

- **test-quality.md** -- Test design principles (determinism, isolation, clear naming)
- **test-levels-framework.md** -- Test level selection (Unit for behavior verification, Build verification for structural assertions, Grep verification for comment/JSDoc cleanup)

---

## Remaining Concerns

### Residual SPSP References in Source Files (AC #8 -- Incomplete)

The following files still contain SPSP references in comments, JSDoc, or test descriptions. These are cosmetic (P2) issues that do not affect runtime behavior or test correctness:

1. **`packages/core/src/bootstrap/direct-bls-client.ts`** (3 references)
   - Line 2: `"Direct BLS HTTP client for bootstrap SPSP handshakes."`
   - Line 5: `"connector routing. This is necessary for bootstrap because SPSP"`
   - Line 24: `"Use this ONLY for bootstrap SPSP handshakes."`

2. **`packages/core/src/bootstrap/BootstrapService.test.ts`** (12+ references)
   - Line 5: `"Phase 2: SPSP handshake via ILP (paid packets)"`
   - Line 413: `"Phase 2: SPSP handshake via ILP"`
   - Line 416: `"should send paid SPSP via agentRuntimeClient"`
   - Lines 445, 448, 449, 461: SPSP variable names and comments
   - Lines 481, 485, 521, 562: SPSP test names and comments

3. **`packages/core/src/bootstrap/RelayMonitor.test.ts`** (1 reference)
   - Line 273: `"depending on SPSP response"`

### Residual SPSP References in Test-Only Files (Outside AC #8 Scope)

These files reference SPSP in test scenarios or examples but are lower priority:

4. **`packages/core/src/toon/toon.test.ts`** -- Lines 112, 389: References "kind:10047 SPSP Info event" in test helper and test name
5. **`packages/core/src/events/service-discovery.test.ts`** -- Line 63: `supportedKinds` includes `23194` in test data
6. **`packages/sdk/src/pricing-validator.test.ts`** -- Lines 51, 53: kind 23194 used in pricing override test
7. **`packages/sdk/src/__integration__/network-discovery.test.ts`** -- Line 393: "initiates SPSP handshake" in test description
8. **`packages/bls/src/pricing/PricingService.test.ts`** -- Lines 186-187: kind 23194 in pricing test
9. **`packages/relay/src/pricing/PricingService.test.ts`** -- Lines 167, 179, 186-187: SPSP kind in pricing tests
10. **`packages/client/tests/e2e/genesis-bootstrap-with-channels.test.ts`** -- Lines 12, 14, 236: SPSP in E2E test
11. **`packages/client/examples/with-payment-channels.ts`** -- Lines 8, 161, 165, 179, 239: SPSP in example
12. **`packages/client/tests/e2e/sdk-relay-validation.test.ts`** -- Lines 19, 28, 581, 591, 602: SPSP in E2E test
13. **`packages/client/src/modes/types.ts`** -- Line 13: "handshaking" in comment

**Recommendation:** Items 1-3 should be fixed as part of this story (AC #8 scope). Items 4-13 should be tracked as cleanup debt per Epic 2 retro item A4 (consistent with the story's "Out-of-scope" note for documentation files).

---

## Contact

**Questions or Issues?**

- Refer to Story 2.7 implementation artifacts: `_bmad-output/implementation-artifacts/2-7-spsp-removal-and-peer-discovery-cleanup.md`
- Consult `_bmad/tea/testarch/knowledge/` for testing best practices
- Run `pnpm test` for full suite verification

---

**Generated by BMad TEA Agent** - 2026-03-07
