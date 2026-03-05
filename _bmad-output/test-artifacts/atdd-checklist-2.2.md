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
lastSaved: '2026-03-04'
workflowType: 'testarch-atdd'
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/test-artifacts/test-design-epic-2.md
  - packages/town/src/handlers/spsp-handshake-handler.test.ts
---

# ATDD Checklist - Epic 2, Story 2.2: SPSP Handshake Handler

**Date:** 2026-03-04
**Author:** Jonathan
**Primary Test Level:** Integration

---

## Story Summary

SPSP request handling (kind:23194) is reimplemented as an SDK handler, enabling settlement negotiation and peer registration through the SDK's kind-based routing.

**As a** relay operator
**I want** SPSP request handling reimplemented as an SDK handler
**So that** settlement negotiation and peer registration work through the SDK's kind-based routing

---

## Acceptance Criteria

1. **AC1**: Given a handler registered for kind 23194, when an SPSP request arrives, then the handler decodes the event, generates fresh SPSP parameters, negotiates settlement, opens channels, and returns encrypted response via ctx.accept()
2. **AC2**: Given settlement negotiation fails, then gracefully degrade to basic SPSP response (no settlement fields) with a warning log
3. **AC3**: Given a successful SPSP handshake, then register the peer with the connector via node.connector.registerPeer()

---

## Failing Tests Created (RED Phase)

### Integration Tests (7 tests)

**File:** `packages/town/src/handlers/spsp-handshake-handler.test.ts` (498 lines)

- **Test:** `should process kind:23194 SPSP request and return encrypted response`
  - **Status:** RED - `@crosstown/sdk` does not exist (import fails)
  - **Verifies:** AC1 — NIP-44 encrypted request → fresh SPSP params → encrypted kind:23195 response
  - **Priority:** P0 | **Risk:** E2-R003

- **Test:** `should generate unique SPSP parameters per request`
  - **Status:** RED - SDK handler does not exist
  - **Verifies:** AC1 — two requests → different destinationAccount + sharedSecret
  - **Priority:** P1

- **Test:** `should negotiate settlement chain when both parties have overlapping chains`
  - **Status:** RED - SDK settlement negotiation not implemented
  - **Verifies:** AC1 — matching chains → negotiatedChain, settlementAddress, tokenAddress, tokenNetworkAddress in response
  - **Priority:** P0 | **Risk:** E2-R004

- **Test:** `should open payment channel when chains intersect`
  - **Status:** RED - SDK handler channel opening not implemented
  - **Verifies:** AC1 — openChannel() called with correct peerId, chain, peerAddress, token, tokenNetwork; channelId in response
  - **Priority:** P0 | **Risk:** E2-R004

- **Test:** `should build NIP-44 encrypted response with SPSP fields`
  - **Status:** RED - SDK handler NIP-44 encryption not implemented
  - **Verifies:** AC1 — response tagged with requester pubkey, references request event, content encrypted, requester can decrypt
  - **Priority:** P1 | **Risk:** E2-R003

- **Test:** `should gracefully degrade to basic SPSP response on settlement failure`
  - **Status:** RED - SDK graceful degradation not implemented
  - **Verifies:** AC2 — channel open failure → still accept with basic SPSP fields, no settlement fields
  - **Priority:** P1 | **Risk:** E2-R007

- **Test:** `should register peer with connector after successful handshake`
  - **Status:** RED - SDK peer registration not implemented
  - **Verifies:** AC3 — addPeer() called with correct id, url, routes from kind:10032 lookup
  - **Priority:** P1 | **Risk:** E2-R008

---

## Data Factories Created

### Nostr Keypair and SPSP Request Factory

**File:** `packages/town/src/handlers/spsp-handshake-handler.test.ts` (inline)

**Exports (inline functions):**

- `createKeypair()` — Generate real nostr-tools keypair
- `createSpspRequest(senderSk, recipientPubkey, settlementInfo?)` — Build signed NIP-44 encrypted kind:23194 event using `buildSpspRequestEvent` from @crosstown/core
- `createMockChannelClient()` — Mock ConnectorChannelClient with openChannel/getChannelState
- `createMockAdminClient()` — Mock ConnectorAdminClient with addPeer/removePeer
- `createPacketRequest(event, amount?)` — Build HandlePacketRequest from signed event
- `decryptSpspResponse(responseEvent, recipientSk, senderPubkey)` — Decrypt NIP-44 SPSP response

---

## Mock Requirements

### ConnectorChannelClient (Mock)

**Justification:** Anvil blockchain not available in unit CI. Channel opening requires on-chain transactions.

**Methods mocked:**

- `openChannel(params)` — Returns `{ channelId, status: 'open' }`
- `getChannelState(channelId)` — Returns `{ channelId, status: 'open', chain }`

### ConnectorAdminClient (Mock)

**Justification:** Connector admin API not available in unit tests. Peer registration requires a running connector.

**Methods mocked:**

- `addPeer(config)` — Returns `undefined` (success)
- `removePeer(id)` — Returns `undefined` (success)

**All other infrastructure is REAL:** NIP-44 encryption, nostr-tools keys, TOON codec, SQLite :memory:.

---

## Required data-testid Attributes

N/A — Backend integration tests. No UI elements.

---

## Implementation Checklist

### Test: `should process kind:23194 SPSP request and return encrypted response`

**File:** `packages/town/src/handlers/spsp-handshake-handler.test.ts`

**Tasks to make this test pass:**

- [ ] Create `packages/sdk/src/handlers/spsp-handshake-handler.ts`
- [ ] Export `createSpspHandshakeHandler(config: SpspHandshakeHandlerConfig)` from `@crosstown/sdk`
- [ ] Implement: decode TOON → extract NIP-44 content → decrypt SPSP request → generate fresh destination + shared secret → build kind:23195 response → NIP-44 encrypt → TOON encode → return via accept
- [ ] Use real `nip44.encrypt`/`nip44.decrypt` from nostr-tools
- [ ] Generate 32-byte random shared secret per request
- [ ] Generate unique destination account: `{ilpAddress}.spsp.{uuid}`
- [ ] Run test: `cd packages/town && pnpm vitest run src/handlers/spsp-handshake-handler.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 4-6 hours

---

### Test: `should generate unique SPSP parameters per request`

**Tasks to make this test pass:**

- [ ] Ensure destination + shared secret use crypto.randomUUID() / crypto.getRandomValues()
- [ ] No caching of SPSP parameters between requests
- [ ] Run test and verify both responses have different values
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours (covered by first implementation)

---

### Test: `should negotiate settlement chain when both parties have overlapping chains`

**Tasks to make this test pass:**

- [ ] Parse settlement info from decrypted SPSP request
- [ ] Compute chain intersection: `requesterChains ∩ ownSupportedChains`
- [ ] Select first matching chain
- [ ] Populate response: negotiatedChain, settlementAddress, tokenAddress, tokenNetworkAddress
- [ ] Run test and verify settlement fields in decrypted response
- [ ] Test passes (green phase)

**Estimated Effort:** 2-3 hours

---

### Test: `should open payment channel when chains intersect`

**Tasks to make this test pass:**

- [ ] After settlement negotiation succeeds, call `channelClient.openChannel()` with correct params
- [ ] Include channelId from openChannel result in SPSP response
- [ ] Params: peerId (nostr-prefixed), chain, peerAddress, token, tokenNetwork
- [ ] Run test and verify mock was called with expected arguments
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours

---

### Test: `should build NIP-44 encrypted response with SPSP fields`

**Tasks to make this test pass:**

- [ ] Build kind:23195 response event with `p` tag (requester pubkey) and `e` tag (request event id)
- [ ] NIP-44 encrypt content for requester
- [ ] Sign with node secret key via finalizeEvent
- [ ] TOON encode the response event
- [ ] Verify requester can decrypt with their secret key
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours (mostly covered by first test)

---

### Test: `should gracefully degrade to basic SPSP response on settlement failure`

**Tasks to make this test pass:**

- [ ] Wrap channel opening in try/catch
- [ ] On failure: log warning, continue with basic SPSP response (no settlement fields)
- [ ] Ensure destinationAccount and sharedSecret are still present
- [ ] Ensure negotiatedChain, channelId, settlementAddress are undefined
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours

---

### Test: `should register peer with connector after successful handshake`

**Tasks to make this test pass:**

- [ ] After successful SPSP handshake, look up requester's kind:10032 event from EventStore
- [ ] Extract BTP endpoint and ILP address from kind:10032 content
- [ ] Call `adminClient.addPeer()` with peerId, url, routes
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

- All 7 tests written and failing (describe.skip)
- Real NIP-44 encryption with real keypairs
- Real TOON codec, real SQLite :memory:
- Mock channel client and admin client (justified: Anvil unavailable in CI)
- Implementation checklist created

### GREEN Phase (DEV Team)

**Implementation Order:**

1. Create `createSpspHandshakeHandler` with basic request/response flow → passes first 2 tests
2. Add settlement negotiation → passes chain intersection test
3. Add channel opening → passes channel test
4. Add NIP-44 encryption details → passes encryption test
5. Add graceful degradation → passes degradation test
6. Add peer registration → passes peer test

### REFACTOR Phase

- Extract settlement negotiation to shared utility (reusable across handlers)
- Extract NIP-44 response builder to helper function
- Verify all tests still pass

---

## Notes

- Uses `buildSpspRequestEvent` from `@crosstown/core` for realistic SPSP requests
- Mock channel client is justified — Anvil on-chain operations tested in E2E (Story 2.3)
- The `ownTokenNetworks` config field maps chains to TokenNetwork contract addresses (not registry)
- Channel creation must happen BEFORE SPSP handshake completes (known issue fixed 2026-02-26)
- Total estimated effort: ~11-18 hours for all 7 tests to pass

---

**Generated by BMad TEA Agent** - 2026-03-04
