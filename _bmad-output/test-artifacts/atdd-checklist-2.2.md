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
lastSaved: '2026-03-06'
workflowType: 'testarch-atdd'
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/test-artifacts/test-design-epic-2.md
  - _bmad-output/implementation-artifacts/2-2-spsp-handshake-handler.md
  - packages/town/src/handlers/event-storage-handler.test.ts
  - packages/town/src/handlers/event-storage-handler.ts
  - packages/sdk/src/handler-context.ts
---

# ATDD Checklist - Epic 2, Story 2.2: SPSP Handshake Handler

**Date:** 2026-03-06
**Author:** Jonathan
**Primary Test Level:** Integration (unit-level handler tests using Approach A)

---

## Story Summary

SPSP request handling (kind:23194) is reimplemented as an SDK handler in `@toon-protocol/town`, enabling settlement negotiation and peer registration through the SDK's kind-based routing. The handler lives in Town (not SDK) following the architectural boundary established in Story 2.1.

**As a** relay operator
**I want** SPSP request handling reimplemented as an SDK handler
**So that** settlement negotiation and peer registration work through the SDK's kind-based routing

---

## Acceptance Criteria

1. **AC1**: Given a handler registered for kind 23194, when an SPSP request arrives as a paid ILP packet, then the handler calls `ctx.decode()` to get the Nostr event, parses the NIP-44 encrypted SPSP request, generates fresh SPSP parameters, negotiates settlement chains, opens payment channels, builds an encrypted SPSP response, and returns `{ accept: true, fulfillment: 'default-fulfillment', data: base64EncodedResponseToon }`.
2. **AC2**: Given settlement negotiation fails, then gracefully degrade to basic SPSP response (no settlement fields) with a warning log.
3. **AC3**: Given a successful SPSP handshake with the peer's kind:10032 event in EventStore, then register the peer with the connector via `adminClient.addPeer()`.

---

## Failing Tests Created (RED Phase)

### Integration Tests (7 tests)

**File:** `packages/town/src/handlers/spsp-handshake-handler.test.ts` (562 lines)

- **Test:** `should process kind:23194 SPSP request and return encrypted response`
  - **Status:** RED - `createSpspHandshakeHandler` module does not exist (import from `./spsp-handshake-handler.js` fails)
  - **Verifies:** AC1 -- NIP-44 encrypted request -> fresh SPSP params -> encrypted kind:23195 response
  - **Priority:** P0 | **Risk:** E2-R003

- **Test:** `should generate unique SPSP parameters per request`
  - **Status:** RED - handler module does not exist
  - **Verifies:** AC1 -- two requests -> different destinationAccount + sharedSecret
  - **Priority:** P1

- **Test:** `should negotiate settlement chain when both parties have overlapping chains`
  - **Status:** RED - handler settlement negotiation not implemented
  - **Verifies:** AC1 -- matching chains -> negotiatedChain, settlementAddress, tokenAddress, tokenNetworkAddress in response
  - **Priority:** P0 | **Risk:** E2-R004

- **Test:** `should open payment channel when chains intersect`
  - **Status:** RED - handler channel opening not implemented
  - **Verifies:** AC1 -- openChannel() called with correct peerId, chain, peerAddress, token, tokenNetwork; channelId in response
  - **Priority:** P0 | **Risk:** E2-R004

- **Test:** `should build NIP-44 encrypted response with SPSP fields`
  - **Status:** RED - handler NIP-44 encryption not implemented
  - **Verifies:** AC1 -- response tagged with requester pubkey, references request event, content encrypted, requester can decrypt
  - **Priority:** P1 | **Risk:** E2-R003

- **Test:** `should gracefully degrade to basic SPSP response on settlement failure`
  - **Status:** RED - handler graceful degradation not implemented
  - **Verifies:** AC2 -- channel open failure -> still accept with basic SPSP fields, no settlement fields
  - **Priority:** P1 | **Risk:** E2-R007

- **Test:** `should register peer with connector after successful handshake`
  - **Status:** RED - handler peer registration not implemented
  - **Verifies:** AC3 -- addPeer() called with correct id, url, routes from kind:10032 lookup
  - **Priority:** P1 | **Risk:** E2-R008

---

## Data Factories Created

### Nostr Keypair and SPSP Request Factory

**File:** `packages/town/src/handlers/spsp-handshake-handler.test.ts` (inline)

**Exports (inline functions):**

- `createKeypair()` -- Generate real nostr-tools keypair
- `createSpspRequest(senderSk, recipientPubkey, settlementInfo?)` -- Build signed NIP-44 encrypted kind:23194 event using `buildSpspRequestEvent` from @toon-protocol/core
- `createMockChannelClient()` -- Mock ConnectorChannelClient with openChannel/getChannelState
- `createMockAdminClient()` -- Mock ConnectorAdminClient with addPeer/removePeer
- `createPacketRequest(event, amount?)` -- Build HandlePacketRequest from signed event
- `decryptSpspResponse(responseEvent, recipientSk, senderPubkey)` -- Decrypt NIP-44 SPSP response
- `createTestContext(request)` -- Build HandlerContext from raw packet request (Approach A pattern from Story 2.1)

---

## Mock Requirements

### ConnectorChannelClient (Mock)

**Justification:** Anvil blockchain not available in unit CI. Channel opening requires on-chain transactions.

**Methods mocked:**

- `openChannel(params)` -- Returns `{ channelId, status: 'open' }`
- `getChannelState(channelId)` -- Returns `{ channelId, status: 'open', chain }`

### ConnectorAdminClient (Mock)

**Justification:** Connector admin API not available in unit tests. Peer registration requires a running connector.

**Methods mocked:**

- `addPeer(config)` -- Returns `undefined` (success)
- `removePeer(id)` -- Returns `undefined` (success)

**All other infrastructure is REAL:** NIP-44 encryption, nostr-tools keys, TOON codec (`@toon-protocol/core/toon`), SQLite :memory: (`@toon-protocol/relay`).

---

## Required data-testid Attributes

N/A -- Backend integration tests. No UI elements.

---

## Implementation Checklist

### Test: `should process kind:23194 SPSP request and return encrypted response`

**File:** `packages/town/src/handlers/spsp-handshake-handler.test.ts`

**Tasks to make this test pass:**

- [ ] Create `packages/town/src/handlers/spsp-handshake-handler.ts`
- [ ] Define `SpspHandshakeHandlerConfig` interface (secretKey, ilpAddress, eventStore, settlementConfig?, channelClient?, adminClient?)
- [ ] Export `createSpspHandshakeHandler(config): Handler` that returns `async (ctx: HandlerContext) => Promise<HandlerResponse>`
- [ ] Implement: `ctx.decode()` -> `parseSpspRequest()` -> generate fresh destination + shared secret -> `buildSpspResponseEvent()` -> `encodeEventToToon()` -> base64 encode -> return `{ accept: true, fulfillment: 'default-fulfillment', data }`
- [ ] Use `crypto.randomUUID()` for destination account uniqueness
- [ ] Use `crypto.getRandomValues(new Uint8Array(32))` for 32-byte shared secret
- [ ] Export `createSpspHandshakeHandler` and `SpspHandshakeHandlerConfig` from `packages/town/src/index.ts`
- [ ] Run test: `cd packages/town && pnpm vitest run src/handlers/spsp-handshake-handler.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 4-6 hours

---

### Test: `should generate unique SPSP parameters per request`

**Tasks to make this test pass:**

- [ ] Ensure destination + shared secret use `crypto.randomUUID()` / `crypto.getRandomValues()`
- [ ] No caching of SPSP parameters between requests
- [ ] Run test and verify both responses have different values
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours (covered by first implementation)

---

### Test: `should negotiate settlement chain when both parties have overlapping chains`

**Tasks to make this test pass:**

- [ ] If `settlementConfig` + `channelClient` + `request.supportedChains`: call `negotiateAndOpenChannel()` from `@toon-protocol/core`
- [ ] On success, merge settlement fields into response
- [ ] Run test and verify settlement fields in decrypted response
- [ ] Test passes (green phase)

**Estimated Effort:** 2-3 hours

---

### Test: `should open payment channel when chains intersect`

**Tasks to make this test pass:**

- [ ] `negotiateAndOpenChannel()` calls `channelClient.openChannel()` internally
- [ ] Verify peerId format: `nostr-{pubkey_prefix}`
- [ ] Include channelId from openChannel result in SPSP response
- [ ] Run test and verify mock was called with expected arguments
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours

---

### Test: `should build NIP-44 encrypted response with SPSP fields`

**Tasks to make this test pass:**

- [ ] `buildSpspResponseEvent()` from `@toon-protocol/core` handles NIP-44 encryption, `p` tag, `e` tag
- [ ] Response event is kind:23195, signed by node secret key
- [ ] TOON encode with `encodeEventToToon()` from `@toon-protocol/core/toon`
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours (mostly covered by first test)

---

### Test: `should gracefully degrade to basic SPSP response on settlement failure`

**Tasks to make this test pass:**

- [ ] Wrap `negotiateAndOpenChannel()` in try/catch
- [ ] On failure: log warning, continue with basic SPSP response (no settlement fields)
- [ ] Ensure destinationAccount and sharedSecret are still present
- [ ] Ensure negotiatedChain, channelId, settlementAddress are undefined
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours

---

### Test: `should register peer with connector after successful handshake`

**Tasks to make this test pass:**

- [ ] After building response but BEFORE return: look up requester's kind:10032 event from EventStore
- [ ] Extract BTP endpoint and ILP address from kind:10032 content
- [ ] Call `adminClient.addPeer()` with `{ id: 'nostr-{pubkey_prefix}', url, authToken: '', routes: [{ prefix: ilpAddress }] }`
- [ ] Wrap in try/catch (peer registration is non-fatal)
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours

---

## Running Tests

```bash
# Run all failing tests for this story
cd packages/town && pnpm vitest run src/handlers/spsp-handshake-handler.test.ts

# Run with verbose output
cd packages/town && pnpm vitest run src/handlers/spsp-handshake-handler.test.ts --reporter=verbose

# Run in watch mode during development
cd packages/town && pnpm vitest src/handlers/spsp-handshake-handler.test.ts
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 7 tests written and updated to match Story 2.2 architecture
- Handler import corrected: `./spsp-handshake-handler.js` (Town, not SDK)
- TOON codec import corrected: `@toon-protocol/core/toon` (not `@toon-protocol/relay`)
- `toonEncoder`/`toonDecoder` removed from handler config (not in SpspHandshakeHandlerConfig)
- `createTestContext()` helper added (same pattern as Story 2.1)
- All `handler(request)` calls updated to `handler(createTestContext(request))`
- `describe.skip` removed -- tests are active (will fail at import resolution until handler exists)
- Handler type corrected to `Handler` from `@toon-protocol/sdk`
- `ConnectorAdminClient` type import added from `@toon-protocol/core`
- Real NIP-44 encryption with real keypairs
- Real TOON codec, real SQLite :memory:
- Mock channel client and admin client (justified: Anvil unavailable in CI)
- Implementation checklist created with corrected file paths

**Verification:**

- All tests will fail at module resolution (handler file does not exist yet)
- Failure is due to missing implementation, not test bugs
- Tests are formatted (Prettier) and lint-clean (0 errors, warnings only for non-null assertions in test assertions)

---

### GREEN Phase (DEV Team)

**Implementation Order:**

1. Create `createSpspHandshakeHandler` with basic request/response flow -> passes first 2 tests
2. Add settlement negotiation via `negotiateAndOpenChannel()` from `@toon-protocol/core` -> passes chain intersection + channel tests
3. Add graceful degradation (try/catch around settlement) -> passes degradation test
4. Add peer registration (before return, non-fatal try/catch) -> passes peer test
5. NIP-44 encryption is handled by `buildSpspResponseEvent()` from `@toon-protocol/core` -> passes encryption test

**Key Implementation Notes:**

- Handler MUST return `{ accept: true, fulfillment: 'default-fulfillment', data }` directly (NOT `ctx.accept()`)
- `data` must be the base64-encoded TOON of the response event (top-level field)
- Peer registration happens BEFORE the return statement (not after)
- Handler does NOT verify signatures or validate pricing (SDK pipeline handles those)
- No `@toon-protocol/core/spsp` sub-path -- use `@toon-protocol/core` main export for SPSP functions

### REFACTOR Phase

- Review handler for clarity and code quality
- Ensure all tests still pass after each refactor
- Update SDK stub JSDoc (Task 3 from story)
- Remove SPSP test exclusion from vitest.config.ts (Task 4 from story)

---

## Changes from Previous ATDD Checklist (2026-03-04)

The following discrepancies were identified and corrected in this update:

1. **Handler location**: Was `@toon-protocol/sdk` -> now `@toon-protocol/town` (`./spsp-handshake-handler.js`)
2. **TOON codec import**: Was `@toon-protocol/relay` -> now `@toon-protocol/core/toon` (per Story 1.0 extraction)
3. **SqliteEventStore import**: Now separate from TOON codec: `import { SqliteEventStore } from '@toon-protocol/relay'`
4. **Config fields**: Removed `toonEncoder` and `toonDecoder` from handler config (not in SpspHandshakeHandlerConfig)
5. **Handler type**: Was `ReturnType<typeof createSpspHandshakeHandler>` -> now `Handler` from `@toon-protocol/sdk`
6. **Test invocation**: Was `handler(request)` -> now `handler(createTestContext(request))` (SDK handlers receive HandlerContext)
7. **describe.skip removed**: Tests are active (fail at module resolution, not skipped)
8. **Added createTestContext helper**: Same pattern as Story 2.1 event-storage-handler tests
9. **Added ConnectorAdminClient type import**: From `@toon-protocol/core`
10. **Implementation Checklist paths corrected**: Files are in `packages/town/`, not `packages/sdk/`

---

## Notes

- Uses `buildSpspRequestEvent` from `@toon-protocol/core` for realistic SPSP requests
- Mock channel client is justified -- Anvil on-chain operations tested in E2E (Story 2.3)
- The `ownTokenNetworks` config field maps chains to TokenNetwork contract addresses (not registry)
- Channel creation must happen BEFORE SPSP handshake completes (known issue fixed 2026-02-26)
- Handler bypasses `ctx.accept()` and returns raw `HandlePacketAcceptResponse` directly
- Peer registration happens before `return` statement (not after, which would be unreachable)
- No `@toon-protocol/core/spsp` sub-path export -- use `@toon-protocol/core` main export
- Total estimated effort: ~11-18 hours for all 7 tests to pass

---

## Knowledge Base References Applied

- **data-factories.md** -- Factory functions with overrides for test data generation
- **test-quality.md** -- Deterministic tests, isolation, explicit assertions
- **test-levels-framework.md** -- Integration test level selection (handler logic + real crypto + real TOON)
- **test-priorities-matrix.md** -- P0/P1 priority assignment based on risk scores
- **test-healing-patterns.md** -- Pattern-based approach to test maintenance

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `cd packages/town && pnpm vitest run src/handlers/spsp-handshake-handler.test.ts`

**Expected Results:**

- Total tests: 7
- Passing: 0 (expected)
- Failing: 7 (expected -- module `./spsp-handshake-handler.js` does not exist)
- Status: RED phase verified

**Expected Failure Message:**

```
Error: Failed to resolve import "./spsp-handshake-handler.js" from "src/handlers/spsp-handshake-handler.test.ts". Does the file exist?
```

---

**Generated by BMad TEA Agent** - 2026-03-06
