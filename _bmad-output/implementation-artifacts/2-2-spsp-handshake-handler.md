# Story 2.2: SPSP Handshake Handler

Status: done

## Story

As a **relay operator**,
I want SPSP request handling (kind:23194) reimplemented as an SDK handler,
So that settlement negotiation and peer registration work through the SDK's kind-based routing.

**FRs covered:** FR-SDK-14 (BLS reimplemented using SDK handler registry)

**Dependencies:** Epic 1 (SDK must be complete -- all Stories 1.0-1.11), Story 2.1 (Town package infrastructure, EventStore handler pattern). Specifically requires: `createNode()` (1.7), `HandlerContext` with `ctx.decode()`/`ctx.accept()`/`ctx.reject()` (1.3), `Handler` type (1.2), `createHandlerContext` (1.3), TOON codec in `@crosstown/core` (1.0), `buildSpspResponseEvent` and `parseSpspRequest` from `@crosstown/core`, `negotiateAndOpenChannel` from `@crosstown/core` (main export, NOT `@crosstown/core/spsp` -- there is no sub-path export for spsp), `ConnectorChannelClient` and `ConnectorAdminClient` from `@crosstown/core`.

## Acceptance Criteria

1. Given a handler registered for kind `23194` (SPSP Request), when an SPSP request arrives as a paid ILP packet, then the handler calls `ctx.decode()` to get the Nostr event, parses the NIP-44 encrypted SPSP request, generates fresh SPSP parameters (destination account, shared secret), negotiates settlement chains if both parties have settlement config, opens payment channels via the connector's channel client when chains intersect, builds an NIP-44 encrypted SPSP response event, and returns `{ accept: true, fulfillment: 'default-fulfillment', data: base64EncodedResponseToon }` with the TOON-encoded response as fulfillment data.
2. Given settlement negotiation fails, when the SPSP handler catches the error, then it gracefully degrades to a basic SPSP response (no settlement fields) and logs a warning.
3. Given a successful SPSP handshake, when the handler has the peer's ILP address and BTP endpoint (from kind:10032 EventStore lookup), then the peer is registered with the connector via `adminClient.addPeer()`.

## Tasks / Subtasks

- [x] Task 1: Implement `createSpspHandshakeHandler` in Town package (AC: #1, #2, #3)
  - [x]Create `packages/town/src/handlers/spsp-handshake-handler.ts`
  - [x]Define and export `SpspHandshakeHandlerConfig` interface:
    ```typescript
    interface SpspHandshakeHandlerConfig {
      secretKey: Uint8Array;          // Node's secret key for NIP-44 decryption/signing
      ilpAddress: string;             // Node's ILP address (base for SPSP destination accounts)
      eventStore: EventStore;         // For looking up peer's kind:10032 ILP info
      settlementConfig?: SettlementNegotiationConfig;  // Optional: chains/addresses/tokens
      channelClient?: ConnectorChannelClient;           // Optional: for opening payment channels
      adminClient?: ConnectorAdminClient;               // Optional: for peer registration
    }
    ```
    **Design rationale:** Unlike Story 2.1's event storage handler (which only needed `eventStore`), the SPSP handler needs access to the node's secret key (for NIP-44 decrypt/encrypt), the ILP address (for generating destination accounts), settlement config (for chain negotiation), channel client (for opening channels), admin client (for peer registration), and event store (for looking up kind:10032 peer info). The TOON encoder/decoder are NOT in the config -- the handler uses `ctx.decode()` for the incoming event and uses `encodeEventToToon` directly from `@crosstown/core/toon` for the response event (since it's constructing a new event, not just passing through the existing one).
  - [x]Implement `createSpspHandshakeHandler(config): Handler`:
    - The returned function signature matches `Handler` from `@crosstown/sdk`: `(ctx: HandlerContext) => Promise<HandlerResponse>`
    - Call `ctx.decode()` to get the structured NostrEvent (kind:23194 SPSP request)
    - Decrypt the SPSP request using `parseSpspRequest()` from `@crosstown/core` (uses NIP-44 with `config.secretKey` and `event.pubkey`)
    - Generate fresh SPSP parameters: unique `destinationAccount` (`{ilpAddress}.spsp.{uuid}`) and 32-byte random `sharedSecret` (base64-encoded)
    - Build base SPSP response with `requestId`, `destinationAccount`, `sharedSecret`
    - If settlement config + channel client are provided AND request has `supportedChains`:
      - Call `negotiateAndOpenChannel()` from `@crosstown/core` (main export) with the SPSP request, config, channel client, and sender pubkey
      - If successful, merge settlement fields (`negotiatedChain`, `settlementAddress`, `tokenAddress`, `tokenNetworkAddress`, `channelId`, `settlementTimeout`) into response
      - If negotiation throws (channel open failure, timeout), catch the error, log a warning, and continue with basic SPSP response (graceful degradation, AC #2)
    - Build kind:23195 response event using `buildSpspResponseEvent()` from `@crosstown/core` with:
      - The SPSP response payload
      - The requester's pubkey (from `event.pubkey`)
      - The node's secret key (for NIP-44 encryption and signing)
      - The original request event ID (for `e` tag correlation)
    - Encode the response event to TOON using `encodeEventToToon()` from `@crosstown/core/toon`
    - Base64 encode the TOON bytes for the fulfillment data field
    - Attempt peer registration BEFORE returning (AC #3):
      - Look up the requester's kind:10032 event from EventStore
      - If found, extract BTP endpoint and ILP address from kind:10032 content
      - Call `adminClient.addPeer()` with `{ id: 'nostr-{pubkey_prefix}', url: btpEndpoint, authToken: '', routes: [{ prefix: ilpAddress }] }`
      - Peer registration is non-fatal: catch and log any errors
    - Return `{ accept: true, fulfillment: 'default-fulfillment', data: base64ResponseToon }` -- the handler constructs the response object directly (does NOT use `ctx.accept()`) because the SPSP response data needs to be in the top-level `data` field, not nested in `metadata`.
  - [x]**IMPORTANT -- Response pattern:** The handler bypasses `ctx.accept()` and returns a raw `HandlePacketAcceptResponse` directly. This is because `ctx.accept()` puts extra data into the `metadata` field, but the SPSP handler needs the TOON-encoded response in the top-level `data` field so the connector can relay it back to the requester in the ILP FULFILL packet. The existing `docker/entrypoint.ts` uses this exact pattern (line ~659: `data: Buffer.from(responseToonBytes).toString('base64')`). The correct return is: `return { accept: true, fulfillment: 'default-fulfillment', data: base64ResponseToon }`.
  - [x]**IMPORTANT -- Peer registration timing:** Peer registration (AC #3) must happen BEFORE the return statement. Since the handler returns a response object, any code after `return` would be unreachable. The peer registration is wrapped in try/catch so failures are non-fatal and do not prevent the SPSP response from being returned.
  - [x]**IMPORTANT**: The handler does NOT implement pricing validation or signature verification. The SDK pipeline handles those stages BEFORE the handler is invoked.

- [x] Task 2: Adapt existing RED-phase test file (AC: #1, #2, #3)
  - [x]In `packages/town/src/handlers/spsp-handshake-handler.test.ts`:
    - Change `import { createSpspHandshakeHandler } from '@crosstown/sdk'` to `import { createSpspHandshakeHandler } from './spsp-handshake-handler.js'` (the handler lives in Town, not SDK)
    - Change `import { encodeEventToToon, decodeEventFromToon, SqliteEventStore } from '@crosstown/relay'` to split into two imports: TOON codec from `@crosstown/core/toon` and `SqliteEventStore` from `@crosstown/relay` (per Story 1.0, TOON codec was extracted to `@crosstown/core/toon`)
    - Change `describe.skip(...)` to `describe(...)` to enable all 7 tests
    - Update the handler creation in `beforeEach` (line 183-192) to match the new `SpspHandshakeHandlerConfig` interface: remove `toonEncoder` and `toonDecoder` fields from the config object. The remaining fields (`secretKey`, `ilpAddress`, `eventStore`, `settlementConfig`, `channelClient`, `adminClient`) match the new interface.
    - **ALSO update the `failingHandler` creation** in the graceful degradation test (line 420-429) -- remove `toonEncoder` and `toonDecoder` from that config object too. This is a second handler instantiation in the test file that also needs updating.
    - Update test expectations to match the actual handler behavior:
      - The handler returns `HandlePacketAcceptResponse` with a `data` field (not just `metadata`)
      - Tests that access `result.data` should still work since the existing tests already expect `result.data`
    - Create test helper `createTestContext(request)` (same pattern as Story 2.1) for building `HandlerContext` from raw packet request objects. The existing tests call `handler(request)` where `request` is `{ amount, destination, data }` but SDK handlers receive `HandlerContext`.
    - Update all `handler(request)` calls to `handler(createTestContext(request))` and `failingHandler(request)` to `failingHandler(createTestContext(request))`
  - [x]Verify all 7 existing tests are adapted and pass:
    - T-2.2-01: `should process kind:23194 SPSP request and return encrypted response` (AC #1)
    - T-2.2-02: `should generate unique SPSP parameters per request` (AC #1)
    - T-2.2-03: `should negotiate settlement chain when both parties have overlapping chains` (AC #1)
    - T-2.2-04: `should open payment channel when chains intersect` (AC #1)
    - T-2.2-05: `should build NIP-44 encrypted response with SPSP fields` (AC #1)
    - T-2.2-06: `should gracefully degrade to basic SPSP response on settlement failure` (AC #2)
    - T-2.2-07: `should register peer with connector after successful handshake` (AC #3)

- [x] Task 3: Update SDK stub with JSDoc pointing to Town (AC: all)
  - [x]Update `packages/sdk/src/spsp-handshake-handler.ts` JSDoc to say "See @crosstown/town for the relay implementation." (same pattern as Story 2.1)

- [x] Task 4: Wire exports and update vitest config (AC: all)
  - [x]Export `createSpspHandshakeHandler` and `SpspHandshakeHandlerConfig` from `packages/town/src/index.ts`
  - [x]Update `packages/town/vitest.config.ts` to remove the exclusion of `spsp-handshake-handler.test.ts` (it was excluded because it was `describe.skip` for Story 2.2)
  - [x]Run `pnpm build` to verify the town package builds successfully
  - [x]Run `cd packages/town && pnpm test` -- all tests pass (11 event-storage-handler + 7 spsp-handshake-handler + 4 cleanup = 22 total)
  - [x]Run `pnpm -r test` from project root -- no regressions in any package

## Dev Notes

### What This Story Does

This story implements the second of two SDK-based handlers that replace the monolithic `docker/src/entrypoint.ts` relay logic. The SPSP Handshake Handler intercepts kind:23194 events (SPSP requests) from incoming ILP packets, performs the full SPSP handshake flow including settlement negotiation and payment channel opening, and returns an NIP-44 encrypted kind:23195 SPSP response.

The key insight is that while the handler is more complex than the Event Storage Handler (Story 2.1), the SDK pipeline still handles the heavy lifting of signature verification, pricing, and dispatch. The handler's domain logic is:

```
SDK Pipeline (already implemented in Epic 1):
  ILP Packet -> shallow TOON parse -> Schnorr verify -> pricing validate -> dispatch to kind:23194

Town Handler (this story):
  ctx.decode() -> parseSpspRequest() -> generateSpspParams() -> negotiateAndOpenChannel() -> buildSpspResponseEvent() -> encodeToToon() -> peerRegistration() -> return { accept, data }
```

### Where the Handler Lives

The handler lives in `packages/town/`, NOT in `packages/sdk/`. The SDK is the framework; Town is the relay implementation. This follows the architectural boundary established in Story 2.1:

```
@crosstown/sdk   (framework -- provides createNode, pipeline, HandlerContext)
    ^
@crosstown/town  (application -- provides EventStorageHandler, SpspHandshakeHandler)
```

### Handler Signature

The handler registered via `node.on(SPSP_REQUEST_KIND, handler)` has this signature (from `packages/sdk/src/handler-registry.ts`):

```typescript
type HandlerResponse = HandlePacketAcceptResponse | HandlePacketRejectResponse;
type Handler = (ctx: HandlerContext) => Promise<HandlerResponse>;
```

### SPSP Flow in the Handler

```
1. ctx.decode() -> NostrEvent (kind:23194, NIP-44 encrypted content)
2. parseSpspRequest(event, secretKey, event.pubkey) -> SpspRequest
3. Generate fresh params:
   - destinationAccount: `{ilpAddress}.spsp.{crypto.randomUUID()}`
   - sharedSecret: base64(crypto.getRandomValues(new Uint8Array(32)))
4. Build SpspResponse: { requestId, destinationAccount, sharedSecret }
5. If settlementConfig + channelClient + request.supportedChains:
   a. negotiateAndOpenChannel({ request, config, channelClient, senderPubkey })
   b. On success: merge { negotiatedChain, settlementAddress, tokenAddress, tokenNetworkAddress, channelId, settlementTimeout } into response
   c. On failure: log warning, continue with basic response (graceful degradation)
6. buildSpspResponseEvent(response, event.pubkey, secretKey, event.id) -> NostrEvent (kind:23195)
7. encodeEventToToon(responseEvent) -> Uint8Array
8. Buffer.from(toonBytes).toString('base64') -> data string
9. Attempt peer registration (non-fatal, try/catch):
   a. Query eventStore for requester's kind:10032 event
   b. If found: adminClient.addPeer({ id: 'nostr-{pubkey_prefix}', url, authToken: '', routes: [{ prefix: ilpAddress }] })
10. return { accept: true, fulfillment: 'default-fulfillment', data }
```

**NOTE on step ordering:** Peer registration (step 9) happens BEFORE the return (step 10). Since the handler returns a response object directly, any code after `return` would be unreachable. Peer registration is wrapped in try/catch so failures do not prevent the SPSP response from being returned.

### Behavioral Differences from Old BLS

| Behavior | Old BLS (`entrypoint.ts`) | SDK-based Town Handler |
|----------|--------------------------|------------------------|
| Signature verification | None for SPSP | SDK verifies Schnorr (new security improvement) |
| SPSP pricing | Custom `spspMinPrice` | SDK per-kind pricing override for kind:23194 |
| NIP-44 decrypt | Inline in handle-packet | Uses `parseSpspRequest()` from core |
| NIP-44 encrypt | Inline `buildSpspResponseEvent` | Uses `buildSpspResponseEvent()` from core |
| Settlement negotiation | Inline with try/catch | Delegates to `negotiateAndOpenChannel()` from core |
| Channel opening | Via `negotiateAndOpenChannel` | Same (reused from core) |
| Peer registration | Inline with EventStore lookup | Same pattern, cleaner separation |
| Response encoding | `encodeEventToToon` + base64 | Same (using core TOON codec) |
| Graceful degradation | Settlement catch -> continue | Same pattern |
| Peer BTP lookup | Inline EventStore query | Same pattern, in handler |
| Response return pattern | Direct `{ accept, data }` | Direct `{ accept, data }` (bypasses ctx.accept) |

### HandlePacketAcceptResponse Type

From `packages/core/src/compose.ts`:

```typescript
export interface HandlePacketAcceptResponse {
  accept: true;
  fulfillment: string;
  data?: string;      // Base64-encoded response data (TOON-encoded SPSP response)
  metadata?: Record<string, unknown>;
}
```

The `data` field is the correct place for the TOON-encoded SPSP response. The connector relays this data back to the sender in the ILP FULFILL packet. The existing `docker/entrypoint.ts` uses this exact pattern (line ~659: `data: Buffer.from(responseToonBytes).toString('base64')`).

**NOTE:** `ctx.accept()` in the SDK returns `{ accept: true, fulfillment: 'default-fulfillment', ...metadata }`. For the SPSP handler, we need to return `data` as a top-level field, not nested in metadata. The handler should construct the response directly: `return { accept: true, fulfillment: 'default-fulfillment', data: base64Toon }`.

### Test Design Traceability

| ATDD Test ID | Test Name | AC | Test-Design ID | Risk Link | Priority | Approach |
|---|---|---|---|---|---|---|
| T-2.2-01 | `should process kind:23194 SPSP request and return encrypted response` | #1 | 2.2-INT-001 | E2-R003 | P0 | A (unit) |
| T-2.2-02 | `should generate unique SPSP parameters per request` | #1 | 2.2-INT-005 | -- | P1 | A (unit) |
| T-2.2-03 | `should negotiate settlement chain when both parties have overlapping chains` | #1 | 2.2-INT-007 | E2-R004 | P0 | A (unit) |
| T-2.2-04 | `should open payment channel when chains intersect` | #1 | 2.2-INT-002 | E2-R004 | P0 | A (unit) |
| T-2.2-05 | `should build NIP-44 encrypted response with SPSP fields` | #1 | 2.2-INT-006 | E2-R003 | P1 | A (unit) |
| T-2.2-06 | `should gracefully degrade to basic SPSP response on settlement failure` | #2 | 2.2-INT-003 | E2-R007 | P1 | A (unit) |
| T-2.2-07 | `should register peer with connector after successful handshake` | #3 | 2.2-INT-004 | E2-R008 | P1 | A (unit) |

**Approach Legend:**
- **A (unit):** Test helper builds a `HandlerContext` and calls the handler directly. Fast, isolated. Tests handler logic only. All 7 existing tests use this approach because the SPSP handler is complex enough to test in isolation -- pipeline integration (pricing, signature) is tested in Story 2.1 and Story 2.3.

### Test Infrastructure

The existing RED-phase tests call `handler(request)` where `request` is `{ amount, destination, data }` (a raw packet). SDK handlers receive `HandlerContext`. A test helper is needed:

```typescript
import { createHandlerContext } from '@crosstown/sdk';
import { shallowParseToon, decodeEventFromToon } from '@crosstown/core/toon';

function createTestContext(request: { amount: string; destination: string; data: string }) {
  const toonBytes = Buffer.from(request.data, 'base64');
  const meta = shallowParseToon(toonBytes);
  return createHandlerContext({
    toon: request.data,
    meta,
    amount: BigInt(request.amount),
    destination: request.destination,
    toonDecoder: (toon: string) => {
      const bytes = Buffer.from(toon, 'base64');
      return decodeEventFromToon(bytes);
    },
  });
}
```

Tests then change from `handler(request)` to `handler(createTestContext(request))`.

### Existing Files

**Test files (already exist, RED phase):**
- `packages/town/src/handlers/spsp-handshake-handler.test.ts` -- 7 tests, `describe.skip`

**Handler implementation (to be created):**
- `packages/town/src/handlers/spsp-handshake-handler.ts` -- new file

**SDK stub (to be updated with JSDoc only):**
- `packages/sdk/src/spsp-handshake-handler.ts` -- stub that throws, update JSDoc

**Config files to update:**
- `packages/town/vitest.config.ts` -- remove SPSP test exclusion
- `packages/town/src/index.ts` -- add SPSP handler exports

**Known test file discrepancies (to be fixed during Task 2):**
- **Stale TOON codec import:** Test file (line 26) imports `encodeEventToToon` and `decodeEventFromToon` from `@crosstown/relay`. Per Story 1.0, these must be imported from `@crosstown/core/toon`. `SqliteEventStore` still comes from `@crosstown/relay`.
- **Stale handler import:** Test file (line 38) imports `createSpspHandshakeHandler` from `@crosstown/sdk`. Must be changed to import from `./spsp-handshake-handler.js` (handler lives in Town, not SDK).
- **Stale config fields:** Test file (lines 187-188) passes `toonEncoder` and `toonDecoder` to handler config. These are not in the `SpspHandshakeHandlerConfig` interface and must be removed. Same applies to the `failingHandler` config on lines 424-425.
- **Raw request calls:** Test file calls `handler(request)` where `request` is `{ amount, destination, data }`. Must be changed to `handler(createTestContext(request))` since SDK handlers receive `HandlerContext`.

**Known ATDD checklist discrepancy:** The `atdd-checklist-2.2.md` Implementation Checklist sections (line 143-144) reference creating files in `packages/sdk/src/handlers/` and exporting from `@crosstown/sdk`. This is stale -- the handler lives in `@crosstown/town`, not `@crosstown/sdk`. This story file is the authoritative source for implementation location.

### Import Patterns

Always use `.js` extensions in ESM imports:

```typescript
// Town internal imports
import { createSpspHandshakeHandler } from './handlers/spsp-handshake-handler.js';
import type { SpspHandshakeHandlerConfig } from './handlers/spsp-handshake-handler.js';

// SDK imports (framework types)
import type { Handler, HandlerContext, HandlerResponse } from '@crosstown/sdk';
import { createHandlerContext } from '@crosstown/sdk';

// Core imports (TOON codec -- from core, NOT relay)
import { encodeEventToToon, decodeEventFromToon, shallowParseToon } from '@crosstown/core/toon';

// Core imports (SPSP builders/parsers, types, negotiation -- from main export, NOT @crosstown/core/spsp)
import {
  parseSpspRequest,
  buildSpspResponseEvent,
  negotiateAndOpenChannel,
  SPSP_REQUEST_KIND,
  SPSP_RESPONSE_KIND,
} from '@crosstown/core';
import type {
  SpspResponse,
  SettlementNegotiationConfig,
  ConnectorChannelClient,
  ConnectorAdminClient,
} from '@crosstown/core';

// Relay imports (EventStore -- still in relay)
import { SqliteEventStore } from '@crosstown/relay';
import type { EventStore } from '@crosstown/relay';
```

**IMPORTANT:** There is no `@crosstown/core/spsp` sub-path export. The core package only has sub-path exports for `@crosstown/core/toon` and `@crosstown/core/nip34`. All SPSP-related exports (`negotiateAndOpenChannel`, `parseSpspRequest`, `buildSpspResponseEvent`, etc.) are available from the main `@crosstown/core` export.

**IMPORTANT:** The existing test file imports `encodeEventToToon` and `decodeEventFromToon` from `@crosstown/relay`. This must be updated to import from `@crosstown/core/toon` per Story 1.0 (TOON codec extraction). `SqliteEventStore` still comes from `@crosstown/relay`.

### Critical Rules

- **Never use `any` type** -- use `unknown` with type guards (enforced by ESLint)
- **Always use `.js` extensions in imports** -- ESM requires `import { foo } from './bar.js'`
- **Use consistent type imports** -- `import type { X } from '...'` for type-only imports
- **Handler does NOT verify signatures or validate pricing** -- the SDK pipeline handles these
- **Handler does NOT use `ctx.accept()`** -- it returns `{ accept: true, fulfillment: 'default-fulfillment', data }` directly because `data` must be a top-level field
- **Settlement negotiation is wrapped in try/catch** -- channel open failures degrade gracefully (AC #2)
- **Peer registration is non-fatal AND happens before return** -- catch and log errors, don't reject the SPSP response, but do it before the return statement (not after)
- **Use `crypto.randomUUID()` for destination account uniqueness** -- same pattern as docker/entrypoint.ts
- **Use `crypto.getRandomValues(new Uint8Array(32))` for shared secret** -- 32 bytes, base64-encoded
- **Tests use real NIP-44 encryption** -- no mocked encryption (real nostr-tools `nip44`)
- **Tests use real TOON codec** -- no mocked TOON encoder/decoder
- **Tests use real nostr-tools signatures** -- no mocked Schnorr signing
- **Tests mock ConnectorChannelClient** -- Anvil blockchain not available in unit CI (justified)
- **Tests mock ConnectorAdminClient** -- Connector admin API not available in unit tests (justified)
- **Use bracket notation for index signatures** -- `obj['key']` not `obj.key` for `Record<string, T>` types (tsconfig `noPropertyAccessFromIndexSignature`)
- **No `@crosstown/core/spsp` sub-path** -- use `@crosstown/core` main export for all SPSP functions

### Risk Mitigations

- **E2-R003 (NIP-44 encryption interop, score 6):** Tests use real NIP-44 encryption with real keypairs. T-2.2-01 and T-2.2-05 verify the full encrypt-then-decrypt flow with cross-party verification (requester can decrypt response encrypted by handler).
- **E2-R004 (Payment channel ordering, score 6):** T-2.2-04 verifies `openChannel()` is called with correct params. The handler delegates to `negotiateAndOpenChannel()` from core which handles the channel-before-SPSP ordering requirement. E2E validation of on-chain channel state is deferred to Story 2.3.
- **E2-R007 (SPSP graceful degradation, score 4):** T-2.2-06 simulates channel open failure (mock rejects) and verifies the handler still returns a basic SPSP response with destination + sharedSecret but no settlement fields.
- **E2-R008 (Peer registration correctness, score 4):** T-2.2-07 stores a kind:10032 event for the requester, sends an SPSP request, and verifies `addPeer()` is called with the correct `id`, `url`, and `routes` extracted from the kind:10032 event.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2 -- AC definition]
- [Source: _bmad-output/planning-artifacts/epics.md#FR Coverage Map -- FR-SDK-14 -> Epic 2]
- [Source: _bmad-output/test-artifacts/test-design-epic-2.md -- Epic 2 test design with risk assessment]
- [Source: _bmad-output/test-artifacts/atdd-checklist-2.2.md -- ATDD Red Phase checklist (7 tests)]
- [Source: docker/src/entrypoint.ts lines 454-670 -- old BLS SPSP handling being replaced]
- [Source: packages/core/src/events/builders.ts -- buildSpspResponseEvent, buildSpspRequestEvent]
- [Source: packages/core/src/events/parsers.ts -- parseSpspRequest, parseSpspResponse]
- [Source: packages/core/src/spsp/negotiateAndOpenChannel.ts -- shared settlement negotiation logic]
- [Source: packages/core/src/types.ts -- SpspResponse, SettlementNegotiationConfig, ConnectorChannelClient, ConnectorAdminClient]
- [Source: packages/sdk/src/handler-context.ts -- HandlerContext interface and createHandlerContext factory]
- [Source: packages/sdk/src/handler-registry.ts -- Handler and HandlerResponse types]
- [Source: packages/sdk/src/spsp-handshake-handler.ts -- SDK stub (throws, to be updated with JSDoc)]
- [Source: packages/town/src/handlers/event-storage-handler.ts -- Story 2.1 handler pattern to follow]
- [Source: packages/town/src/handlers/spsp-handshake-handler.test.ts -- ATDD Red Phase tests (7 tests)]
- [Source: packages/core/src/compose.ts -- HandlePacketAcceptResponse type with `data` field]
- [Source: packages/core/package.json -- exports map (confirms no @crosstown/core/spsp sub-path)]
- [Source: _bmad-output/implementation-artifacts/2-1-relay-event-storage-handler.md -- Story 2.1 pattern reference]

## Dev Agent Record

**Agent Model Used:** Claude Opus 4.6 (claude-opus-4-6)

**Completion Notes List:**

1. **Task 1 -- Implement `createSpspHandshakeHandler`:** Created `packages/town/src/handlers/spsp-handshake-handler.ts` with full SPSP handshake handler. Implements: NIP-44 decryption via `parseSpspRequest()`, unique SPSP parameter generation (UUID destination account + 32-byte random shared secret), settlement negotiation via `negotiateAndOpenChannel()` with try/catch for graceful degradation, NIP-44 encrypted kind:23195 response via `buildSpspResponseEvent()`, TOON encoding via `encodeEventToToon()`, peer registration via `adminClient.addPeer()` (non-fatal, before return), and direct `{ accept, fulfillment, data }` response return pattern (bypasses `ctx.accept()`).

2. **Task 2 -- Adapt RED-phase test file:** The test file (`spsp-handshake-handler.test.ts`) was already updated to GREEN-phase format during the ATDD checklist phase -- all imports were correct (`@crosstown/core/toon`, `./spsp-handshake-handler.js`, `createHandlerContext`), `createTestContext` helper was present, no `describe.skip`, no stale `toonEncoder`/`toonDecoder` config fields. All 7 tests pass without modification.

3. **Task 3 -- Update SDK stub JSDoc:** Updated `packages/sdk/src/spsp-handshake-handler.ts` JSDoc to match the Story 2.1 pattern: "See @crosstown/town for the relay implementation."

4. **Task 4 -- Wire exports and update vitest config:** Added `createSpspHandshakeHandler` and `SpspHandshakeHandlerConfig` exports to `packages/town/src/index.ts`. Removed `spsp-handshake-handler.test.ts` exclusion from `packages/town/vitest.config.ts`. Added `data?: string` field to `HandlePacketAcceptResponse` in `packages/core/src/compose.ts` (backward-compatible, needed for SPSP response data). Build and all 1371 tests pass with no regressions.

**File List:**

| Action | File (relative) |
|--------|-----------------|
| Created | `packages/town/src/handlers/spsp-handshake-handler.ts` |
| Modified | `packages/town/src/index.ts` |
| Modified | `packages/town/vitest.config.ts` |
| Modified | `packages/sdk/src/spsp-handshake-handler.ts` |
| Modified | `packages/core/src/compose.ts` |

## Code Review Record

### Review Pass #1

- **Date:** 2026-03-06
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Mode:** yolo (auto-fix all severity levels)
- **Issues Found:**
  - Critical: 0
  - High: 0
  - Medium: 0
  - Low: 3
- **Low Issues (all fixed):**
  1. Missing `limit: 1` in EventStore query filter for kind:10032 lookup (`spsp-handshake-handler.ts`). Only the first result is used (`peerInfoEvents[0]`), but all matching events were being fetched. Reference entrypoint uses `limit: 1`. Added `limit: 1` to the query filter.
  2. Missing BTP URL validation before calling `adminClient.addPeer()` (`spsp-handshake-handler.ts`). The reference entrypoint validates `btpUrl.startsWith('ws://') || btpUrl.startsWith('wss://')` before registration. Without this, invalid URLs (empty, HTTP, etc.) could be passed to the connector. Added BTP URL prefix validation with `ws://`/`wss://` check and warning log on invalid URL.
  3. Missing dedicated JSON.parse error handling for kind:10032 event content (`spsp-handshake-handler.ts`). If the content is malformed, the generic peer registration catch would handle it, but with a less descriptive message. The reference entrypoint has a dedicated parse error catch. Added inner try/catch for `JSON.parse(peerInfoEvent.content)` with specific warning log and early return on malformed content.
- **Outcome:** PASS -- all 3 low-severity issues resolved in-place. No follow-up tasks required.
- **Verification:** All 15 SPSP handshake handler tests pass, all 30 town package tests pass (15 skipped for future stories), all 536 core tests pass, all 154 SDK tests pass, zero TypeScript diagnostics on all modified files, build succeeds for all packages, Prettier formatting passes.
- **Positive Observations:**
  - Handler correctly follows the SDK handler pattern (`Handler` signature, `HandlerContext` parameter)
  - Proper separation of concerns: handler in Town, not SDK (architectural boundary respected)
  - Settlement negotiation correctly delegated to `negotiateAndOpenChannel()` from core
  - Graceful degradation (AC #2) properly implemented with try/catch and warning logs
  - Peer registration (AC #3) correctly happens before the return statement
  - Direct response return pattern (`{ accept, fulfillment, data }`) correctly bypasses `ctx.accept()` for top-level `data` field
  - Test file uses real NIP-44 encryption, real TOON codec, and real nostr-tools signing (no mocked crypto)
  - Test coverage is comprehensive: 15 tests covering all 3 ACs plus edge cases
  - Import patterns are correct: `.js` extensions, `@crosstown/core/toon` for TOON codec, `@crosstown/core` main export for SPSP functions
  - `type` keyword used consistently for type-only imports

### Review Pass #2

- **Date:** 2026-03-06
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Mode:** yolo (auto-fix all severity levels)
- **Issues Found:**
  - Critical: 0
  - High: 0
  - Medium: 0
  - Low: 0
- **Outcome:** PASS -- clean review, no issues found. All tests pass, build succeeds. Implementation passed clean.
- **Prior Action Items:** All 3 low-severity issues from Review Pass #1 were already resolved in-place during that pass. No outstanding action items carried into this review.

### Review Pass #3

- **Date:** 2026-03-06
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Mode:** yolo (auto-fix all severity levels + OWASP/security audit)
- **Security Audit:** OWASP Top 10, authentication/authorization flaws, injection risks
- **Issues Found:**
  - Critical: 0
  - High: 0
  - Medium: 1
  - Low: 2
- **Medium Issues (fixed):**
  1. **Missing runtime validation of IlpPeerInfo fields after JSON.parse** (`spsp-handshake-handler.ts`). The `JSON.parse(peerInfoEvent.content) as IlpPeerInfo` type assertion does not validate field presence at runtime. If the kind:10032 event contains valid JSON with a wrong shape (e.g., `{"someField": "value"}`), the code would proceed with `peerInfo.btpEndpoint` and `peerInfo.ilpAddress` as `undefined`, potentially passing `undefined` as the route prefix to `adminClient.addPeer()`. Added explicit `typeof` checks for `btpEndpoint` and `ilpAddress` fields with early return and warning log on missing fields.
- **Low Issues (fixed):**
  1. **Log injection risk in btpUrl warning message** (`spsp-handshake-handler.ts`). The `btpUrl` value from untrusted kind:10032 event content was logged directly in a template literal. A malicious peer could publish a kind:10032 event with crafted `btpEndpoint` containing newlines or control characters to inject log entries. Added `btpUrl.replace(/[\n\r\t]/g, '')` sanitization before logging.
  2. **Missing test for malformed kind:10032 content with wrong shape** (`spsp-handshake-handler.test.ts`). The handler had dedicated JSON.parse error handling for malformed content, but no test verified behavior when the content is valid JSON with missing required fields (`btpEndpoint`, `ilpAddress`). Added test `should skip peer registration when kind:10032 content has wrong shape` that stores a kind:10032 event with `{"someField": "value", "assetCode": "USD"}` and verifies the handler skips peer registration and logs a warning.
- **OWASP Top 10 Security Audit Results:**
  - A01 Broken Access Control: N/A -- handler invoked only through SDK pipeline which enforces signature verification
  - A02 Cryptographic Failures: PASS -- uses real NIP-44 encryption (nostr-tools), crypto.getRandomValues for shared secret, crypto.randomUUID for destination account
  - A03 Injection: PASS (after fix) -- JSON.parse wrapped in try/catch, log outputs now sanitized
  - A04 Insecure Design: PASS -- handler delegates pricing/verification to SDK pipeline, follows principle of least privilege
  - A05 Security Misconfiguration: PASS -- no hardcoded secrets, all sensitive data from config
  - A06 Vulnerable Components: PASS -- uses established libraries (nostr-tools, @noble/curves)
  - A07 Authentication Failures: PASS -- SDK pipeline verifies Schnorr signatures before handler
  - A08 Data Integrity Failures: PASS (after fix) -- runtime validation added for untrusted IlpPeerInfo data
  - A09 Logging Failures: PASS (after fix) -- log injection vector in btpUrl sanitized
  - A10 SSRF: PASS -- btpUrl validated with ws:///wss:// prefix check before use in addPeer()
- **Outcome:** PASS -- all 3 issues (1 medium, 2 low) resolved in-place. No follow-up tasks required.
- **Verification:** All 16 SPSP handshake handler tests pass, all 31 town package tests pass (15 skipped for future stories), all 1432 total tests pass across all packages, zero TypeScript diagnostics on all modified files, build succeeds, Prettier formatting passes, ESLint reports 0 errors.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-06 | 0.1 | Initial story draft via BMAD create-story (yolo mode) | SM |
| 2026-03-06 | 0.2 | Adversarial review: (1) Fixed incorrect `@crosstown/core/spsp` sub-path import -- no such export exists; corrected to `@crosstown/core` (main export) in Dependencies, Task 1, and Import Patterns. (2) Fixed peer registration timing -- was described as "post-accept" (after return) which is unreachable; corrected to happen BEFORE the return statement. (3) Clarified handler bypasses `ctx.accept()` and returns raw `HandlePacketAcceptResponse` directly (needed for top-level `data` field). Updated AC #1 wording and added explicit Task 1 notes. (4) Added "Known test file discrepancies" section documenting 4 stale patterns in the RED-phase test file (TOON codec import from relay, handler import from SDK, toonEncoder/toonDecoder config fields, raw request calls). (5) Added note about stale ATDD checklist guidance (handler in SDK -> handler in Town). (6) Added explicit Task 2 callout for `failingHandler` config update (second handler instantiation also needs toonEncoder/toonDecoder removed). (7) Added missing `createHandlerContext` import to Import Patterns. (8) Added `SqliteEventStore` import to Import Patterns (needed for tests). (9) Added explicit note that `@crosstown/core/spsp` does not exist as a sub-path export. (10) Added response return pattern row to Behavioral Differences table. (11) Updated SPSP Flow step ordering (peer registration before return). (12) Added core/package.json to References. (13) Added placeholder Dev Agent Record and Code Review Record sections (matching Story 2.1 structure). (14) Added new Critical Rules for handler response pattern and peer registration timing. | Review |
| 2026-03-06 | 1.0 | Implementation complete. Created SPSP handshake handler in Town package. Added `data?` field to `HandlePacketAcceptResponse` in core (backward-compatible). Updated SDK stub JSDoc. Wired exports. All 7 SPSP tests pass, 1371 total tests pass, no regressions. | Dev (Claude Opus 4.6) |
| 2026-03-06 | 1.1 | Code review pass #1 (yolo mode). 0 critical, 0 high, 0 medium, 3 low issues found and fixed: (1) added `limit: 1` to EventStore kind:10032 query, (2) added BTP URL format validation (`ws://`/`wss://`) before `addPeer()`, (3) added dedicated JSON.parse error handling for kind:10032 content. All 15 SPSP tests pass, build succeeds, no regressions. | Review (Claude Opus 4.6) |
| 2026-03-06 | 1.2 | Code review pass #2 (yolo mode). Clean pass: 0 critical, 0 high, 0 medium, 0 low issues. All tests pass, build succeeds. | Review (Claude Opus 4.6) |
| 2026-03-06 | 1.3 | Code review pass #3 (yolo mode + OWASP/security audit). 0 critical, 0 high, 1 medium, 2 low issues found and fixed: (1) MEDIUM: added runtime validation of IlpPeerInfo fields (btpEndpoint, ilpAddress) after JSON.parse to prevent undefined route prefix in addPeer(), (2) LOW: sanitized btpUrl in log output to prevent log injection from malicious kind:10032 content, (3) LOW: added test for kind:10032 with valid JSON but wrong shape. Full OWASP Top 10 audit passed. All 16 SPSP tests pass, 1432 total tests pass, build succeeds. | Review (Claude Opus 4.6) |
