# Risk-Based Test Plan: Epic 2 - Nostr Relay Reference Implementation & SDK Validation

**Date:** 2026-03-06
**Author:** Jonathan (with Claude Opus 4.6)
**Status:** Implementation-Ready
**Epic Source:** `_bmad-output/planning-artifacts/epics.md` -- Epic 2
**Predecessor:** `_bmad-output/planning-artifacts/test-design-epic-1.md` (Epic 1 SDK test plan)

---

## 1. Scope and Context

Epic 2 delivers 5 stories (2.1-2.5) producing `@crosstown/town` -- a publishable Nostr relay rebuilt on the SDK's handler registry. This epic is both a **product deliverable** (anyone can `npm install @crosstown/town` and run a relay) and a **validation exercise** (proof that the SDK from Epic 1 is feature-complete).

**What exists today (post-Epic 1):**

- `@crosstown/sdk` package is complete with `createNode()`, handler registry, Schnorr verification, pricing validation, PaymentHandler bridge, and lifecycle management
- `docker/src/entrypoint.ts` (~1248 lines) manually wires relay, BLS, SPSP, bootstrap, settlement, and NIP-34 -- this is what Epic 2 replaces
- SDK stubs exist: `event-storage-handler.ts` and `spsp-handshake-handler.ts` both throw "not yet implemented"
- Town package has RED-phase test files (`describe.skip`): `event-storage-handler.test.ts`, `spsp-handshake-handler.test.ts`, `cleanup.test.ts`, `town-lifecycle.test.ts`
- E2E test `sdk-relay-validation.test.ts` exists in `packages/client/tests/e2e/` (RED phase, `describe.skip`)
- `packages/git-proxy/` has already been removed (Story 2.4 cleanup test passes)
- Existing E2E test `genesis-bootstrap-with-channels.test.ts` validates the current entrypoint -- this must also pass against the SDK-based relay

**What this test plan covers:**

- Stories 2.1-2.5 of Epic 2
- Risk assessment for each story with probability x impact scoring
- Cross-story integration boundaries, especially the SDK-to-Town boundary
- Regression risks for Epic 1 (the SDK must remain stable as Town is built on it)
- E2E equivalence validation strategy

**What this test plan does NOT cover:**

- Epic 1 SDK internals (covered by `test-design-epic-1.md`)
- Epic 5 (The Rig git forge)
- Marlin/TEE integration (separate epic per decision log)

---

## 2. Risk Assessment by Story

### Risk Scoring

- **Probability**: 1 (unlikely), 2 (possible), 3 (likely)
- **Impact**: 1 (minor), 2 (moderate), 3 (severe -- data loss, security breach, or cascade failure)
- **Score**: Probability x Impact (1-9)
- **Threshold**: Score >= 6 = high priority, 3-5 = medium, 1-2 = low

### Story-Level Risk Matrix

| Story | Risk ID | Category | Description | P | I | Score | Mitigation |
|-------|---------|----------|-------------|---|---|-------|------------|
| **2.1 Event Storage** | E2-R01 | DATA | SDK handler drops events that the old BLS would have stored (behavioral regression) | 2 | 3 | **6** | Side-by-side test: same TOON payload accepted by both old BLS and new SDK handler |
| **2.1 Event Storage** | E2-R02 | DATA | TOON-native storage fidelity lost -- re-encoded TOON differs from original bytes | 2 | 3 | **6** | Roundtrip test: encode -> store -> retrieve -> re-encode = identical bytes |
| **2.1 Event Storage** | E2-R03 | TECH | SDK handler context (`ctx.decode()`) produces different NostrEvent than `decodeEventFromToon()` directly | 1 | 3 | 3 | Unit test: `ctx.decode()` output matches `decodeEventFromToon(toonBytes)` for same payload |
| **2.2 SPSP Handler** | E2-R04 | SEC | NIP-44 encryption in SDK handler produces response that requester cannot decrypt | 2 | 3 | **6** | Real NIP-44 roundtrip test: build request with requester key -> handler generates response -> requester decrypts |
| **2.2 SPSP Handler** | E2-R05 | BUS | Settlement negotiation logic produces different channel params than old BLS, breaking channel establishment | 3 | 3 | **9** | E2E test: SDK-based relay performs SPSP handshake with live connector + Anvil, channels open successfully |
| **2.2 SPSP Handler** | E2-R06 | OPS | Peer registration after SPSP handshake fails silently -- peer appears connected but no route exists | 2 | 2 | 4 | Unit test: mock admin client verifies `addPeer()` called with correct BTP URL and ILP route prefix |
| **2.2 SPSP Handler** | E2-R07 | BUS | Graceful degradation on settlement failure does NOT degrade -- handler rejects instead of returning basic SPSP | 2 | 2 | 4 | Unit test: channel client throws -> handler still returns accept with basic SPSP fields (no settlement) |
| **2.3 E2E Validation** | E2-R08 | TECH | **SDK-based relay fails existing E2E tests** -- behavioral mismatch between SDK pipeline and manual BLS wiring | 3 | 3 | **9** | Run `genesis-bootstrap-with-channels.test.ts` against SDK-based relay as the primary gate |
| **2.3 E2E Validation** | E2-R09 | TECH | Docker image build fails because town package dependencies are not resolved in container | 2 | 2 | 4 | CI step: `docker build` for SDK-based relay image as part of Story 2.3 gate |
| **2.3 E2E Validation** | E2-R10 | PERF | SDK pipeline overhead (shallow parse + verify + price + dispatch) makes relay noticeably slower than old BLS | 1 | 2 | 2 | Monitor E2E test execution time; SDK adds ~2ms per event for Schnorr verification (acceptable) |
| **2.4 Cleanup** | E2-R11 | OPS | git-proxy removal breaks a package that was silently depending on it | 1 | 1 | 1 | Cleanup test verifies no package.json references `@crosstown/git-proxy` |
| **2.5 Publish Town** | E2-R12 | OPS | `startTown()` API does not match the entrypoint behavior -- config surface incomplete | 2 | 2 | 4 | E2E lifecycle test: `startTown()` -> relay accepts connections -> bootstrap runs -> `stop()` cleans up |
| **2.5 Publish Town** | E2-R13 | OPS | ESM export misconfigured -- `import { startTown } from '@crosstown/town'` fails | 1 | 2 | 2 | Import validation test in town package |
| **2.5 Publish Town** | E2-R14 | SEC | CLI entrypoint exposes mnemonic in process list or logs | 1 | 3 | 3 | Code review: mnemonic read from env var or file, not CLI arg; log sanitization for secret key |

### High-Priority Risks (Score >= 6) -- Ordered by Score

| Rank | Risk ID | Score | Story | Summary |
|------|---------|-------|-------|---------|
| 1 | E2-R05 | **9** | 2.2 | Settlement negotiation behavioral mismatch (CRITICAL) |
| 2 | E2-R08 | **9** | 2.3 | SDK-based relay fails existing E2E tests (CRITICAL) |
| 3 | E2-R01 | **6** | 2.1 | Event storage behavioral regression |
| 4 | E2-R02 | **6** | 2.1 | TOON storage fidelity lost |
| 5 | E2-R04 | **6** | 2.2 | NIP-44 encryption incompatibility |

---

## 3. Critical Integration Boundaries

### 3.1 The SDK-to-Town Boundary (E2-R08, Score 9)

This is the epic's core correctness property. The SDK provides the processing pipeline; Town provides the domain-specific handlers. The boundary is:

```
SDK Pipeline (Epic 1):
  ILP Packet -> PaymentHandlerBridge
    -> Shallow TOON Parse
      -> Schnorr Verification
        -> Pricing Validation
          -> HandlerRegistry.dispatch(kind)

Town Handlers (Epic 2):
  kind:* (default) -> EventStorageHandler: ctx.decode() -> store -> ctx.accept()
  kind:23194       -> SpspHandshakeHandler: ctx.decode() -> NIP-44 decrypt -> negotiate -> ctx.accept(data)
```

**Why this boundary is the highest-risk point:**

The old `docker/src/entrypoint.ts` does EVERYTHING inline: decode TOON, validate payment, handle SPSP, store events, register peers, open channels. The SDK-based relay splits this into pipeline stages (SDK) + handler logic (Town). If ANY behavior differs between the two implementations, E2E tests will fail.

**Specific behavioral contracts that must be preserved:**

| Behavior | Old BLS (`entrypoint.ts`) | SDK-based Town | Validation |
|----------|--------------------------|----------------|------------|
| TOON decode | `decodeEventFromToon(toonBytes)` inline | `ctx.decode()` via HandlerContext | T-2.1-02 |
| Payment validation | `pricingService.calculatePriceFromBytes()` | SDK pricing validator (per-byte + kind overrides) | T-2.1-03 |
| Self-write bypass | `event.pubkey !== config.pubkey` check | SDK `ctx.pubkey === node.pubkey` bypass | T-2.1-04 |
| SPSP detection | `event.kind === SPSP_REQUEST_KIND` | SDK `.on(23194, spspHandler)` kind routing | T-2.2-01 |
| SPSP response format | `buildSpspResponseEvent()` -> TOON -> base64 | Same function, returned via `ctx.accept(data)` | T-2.2-03 |
| Settlement negotiation | `negotiateAndOpenChannel()` inline | Same function, called from handler | T-2.2-04 |
| Peer registration | `adminClient.addPeer()` after handshake | Same, via `node.connector.registerPeer()` or admin client | T-2.2-07 |
| Error response | `ILP_ERROR_CODES.BAD_REQUEST` / `INSUFFICIENT_AMOUNT` | SDK error codes: F00, F04, F06, T00 | T-2.1-06 |

**Integration test strategy:**

- For each behavior above, write a unit test that exercises the Town handler with real TOON data and real crypto
- The E2E test (`genesis-bootstrap-with-channels.test.ts`) serves as the end-to-end equivalence proof
- A new `sdk-relay-validation.test.ts` tests SDK-specific behaviors (self-write bypass, handler count reduction)

### 3.2 Story 2.1 -> Story 2.2 (Event Storage -> SPSP Handler)

The SPSP handler (kind:23194) needs access to the EventStore to look up peer kind:10032 events for BTP endpoint resolution during peer registration. Both handlers share the same EventStore instance.

**Boundary test:** SPSP handler stores requester's kind:10032 event in EventStore -> SPSP handshake -> handler queries EventStore for peer's BTP endpoint -> peer registered with correct URL.

### 3.3 Stories 2.1 + 2.2 -> Story 2.3 (Handlers -> E2E Validation)

Stories 2.1 and 2.2 produce unit-tested handlers. Story 2.3 validates them end-to-end against live infrastructure (Anvil, connector, relay). The gap between unit-tested handlers and a working E2E system includes:

- Docker image build with SDK-based entrypoint
- Connector `setPacketHandler()` wiring
- Bootstrap peer discovery with real relay
- Payment channel creation with real Anvil contracts
- Event publication with real ILP payment

**Boundary test:** Deploy SDK-based relay as genesis node -> run `genesis-bootstrap-with-channels.test.ts` -> all tests pass.

### 3.4 Story 2.5 -> Stories 2.1 + 2.2 + 2.3 (Publish -> Everything)

The `startTown()` function wraps all handlers and SDK wiring into a single callable API. It must compose:

```typescript
startTown(config) {
  // 1. Identity from mnemonic or secretKey
  // 2. createNode() with embedded connector
  // 3. Register EventStorageHandler as default handler
  // 4. Register SpspHandshakeHandler for kind:23194
  // 5. Start NostrRelayServer (WebSocket)
  // 6. Start BLS HTTP server (health endpoint)
  // 7. node.start() -> bootstrap + relay monitor
  // 8. Return TownInstance with stop() method
}
```

**Boundary test:** `startTown({ mnemonic: '...' })` -> relay accepts WebSocket connections -> BLS health endpoint responds -> bootstrap discovers peers -> `instance.stop()` cleans up all resources.

---

## 4. Test Strategy Per Story

### Legend

- **U** = Unit test (isolated, mocked dependencies where structurally unavailable)
- **I** = Integration test (multiple real modules wired together)
- **E2E** = End-to-end test (live infrastructure: Anvil, connector, relay)
- **Real crypto** = Uses real NIP-44 encryption, real Schnorr signing, real TOON codec -- no mocked crypto
- **Existing** = Test already exists in RED phase (`describe.skip`), needs GREEN implementation

### Story 2.1: Relay Event Storage Handler

| ID | Test | Level | Risk | Priority | Status |
|----|------|-------|------|----------|--------|
| T-2.1-01 | Store event when payment meets price; event persisted in SQLite | U (real crypto) | E2-R01 | P0 | Existing (RED) |
| T-2.1-02 | `ctx.decode()` roundtrip: decoded NostrEvent matches original event (all fields) | U (real crypto) | E2-R03 | P0 | Existing (RED) |
| T-2.1-03 | Reject insufficient payment with F04 error code and required/received metadata | U (real crypto) | E2-R01 | P0 | Existing (RED) |
| T-2.1-04 | Bypass pricing for node own pubkey (self-write at amount=0) | U (real crypto) | E2-R01 | P0 | Existing (RED) |
| T-2.1-05 | TOON storage fidelity: encode -> store -> retrieve -> re-encode = identical bytes | U (real crypto) | E2-R02 | P1 | Existing (RED) |
| T-2.1-06 | Accept response includes eventId and storedAt timestamp metadata | U (real crypto) | - | P1 | Existing (RED) |
| T-2.1-07 | Reject invalid Schnorr signature with F06 error code (tampered event) | U (real crypto) | E2-R01 | P1 | Existing (RED) |
| T-2.1-08 | Handler receives ctx.toon as raw TOON string (no premature decode) | U | - | P2 | New |

**Notes:**

- Most tests already exist as RED-phase stubs in `packages/town/src/handlers/event-storage-handler.test.ts`. The primary work is implementing the handler and enabling the tests.
- T-2.1-01, T-2.1-03, T-2.1-04 are the core behavioral equivalence tests. They replicate what the old BLS does.
- T-2.1-07 is interesting because in the old BLS, the entrypoint does NOT verify Schnorr signatures -- the SDK adds this. This is a behavioral IMPROVEMENT, not a regression. The test should verify the SDK's F06 rejection works through the Town handler.

### Story 2.2: SPSP Handshake Handler

| ID | Test | Level | Risk | Priority | Status |
|----|------|-------|------|----------|--------|
| T-2.2-01 | Process kind:23194 SPSP request and return encrypted kind:23195 response | U (real crypto) | E2-R04 | P0 | Existing (RED) |
| T-2.2-02 | Generate unique SPSP parameters per request (destination + shared secret) | U (real crypto) | - | P0 | Existing (RED) |
| T-2.2-03 | NIP-44 encrypted response: content encrypted, p-tag = requester, e-tag = request event | U (real crypto) | E2-R04 | P1 | Existing (RED) |
| T-2.2-04 | Negotiate settlement chain when both parties have overlapping chains | U (real crypto) | E2-R05 | P0 | Existing (RED) |
| T-2.2-05 | Open payment channel when chains intersect (mock channelClient called) | U (real crypto) | E2-R05 | P0 | Existing (RED) |
| T-2.2-06 | Gracefully degrade to basic SPSP response when channel open fails | U (real crypto) | E2-R07 | P1 | Existing (RED) |
| T-2.2-07 | Register peer with connector after successful handshake (mock adminClient called) | U (real crypto) | E2-R06 | P1 | Existing (RED) |
| T-2.2-08 | SPSP response includes channelId when settlement succeeds | U (real crypto) | E2-R05 | P1 | New |
| T-2.2-09 | No settlement fields in response when requester has no supportedChains | U (real crypto) | - | P2 | New |
| T-2.2-10 | Handler receives event through SDK pipeline (Schnorr verified before handler) | I | E2-R05 | P1 | New |

**Notes:**

- T-2.2-01 through T-2.2-07 already exist as RED-phase stubs. These are the critical SPSP behavioral equivalence tests.
- T-2.2-04 and T-2.2-05 mitigate the highest-risk item (E2-R05, score 9). The settlement logic is being moved from inline BLS code to an SDK handler, and any difference in parameters passed to `negotiateAndOpenChannel()` or `channelClient.openChannel()` will break channel establishment.
- T-2.2-10 is a new integration test verifying that SPSP requests flow through the SDK's full pipeline (parse -> verify -> price -> dispatch) before reaching the handler.

### Story 2.3: E2E Test Validation

| ID | Test | Level | Risk | Priority | Status |
|----|------|-------|------|----------|--------|
| T-2.3-01 | **Existing E2E: bootstrap + channel creation + event publishing all pass** | E2E | E2-R08 | P0 | Existing (RED) |
| T-2.3-02 | Self-write bypass: node's own pubkey writes without payment (E2E) | E2E | E2-R08 | P0 | Existing (RED) |
| T-2.3-03 | SPSP handshake with settlement negotiation produces valid payment channel (E2E) | E2E | E2-R05 | P0 | Existing (RED) |
| T-2.3-04 | On-chain channel state validated after SDK-based relay bootstrap | E2E | E2-R08 | P0 | Existing (RED) |
| T-2.3-05 | SDK-based relay entrypoint is < 100 lines of handler logic | Code review | E2-R08 | P1 | Existing (RED) |
| T-2.3-06 | Docker image builds successfully with SDK-based entrypoint | CI | E2-R09 | P0 | New |

**Notes:**

- T-2.3-01 is the SINGLE MOST IMPORTANT test in Epic 2. It runs `genesis-bootstrap-with-channels.test.ts` against the SDK-based relay. If this passes, the SDK is proven equivalent.
- T-2.3-02 through T-2.3-04 exist in `packages/client/tests/e2e/sdk-relay-validation.test.ts` as RED-phase stubs.
- T-2.3-05 is a code review gate, not an automated test. The target is <100 lines of handler registration code in the Town entrypoint, demonstrating SDK abstraction value vs the ~300+ lines of handle-packet logic in the old entrypoint.
- T-2.3-06 is a new CI gate: the Docker image must build with the SDK-based entrypoint before deployment.

### Story 2.4: Remove packages/git-proxy and Document Reference Implementation

| ID | Test | Level | Risk | Priority | Status |
|----|------|-------|------|----------|--------|
| T-2.4-01 | `packages/git-proxy/` directory does not exist | U (filesystem) | E2-R11 | P2 | Existing (GREEN -- already passes) |
| T-2.4-02 | No package depends on `@crosstown/git-proxy` | U (filesystem) | E2-R11 | P2 | Existing (GREEN -- already passes) |
| T-2.4-03 | `pnpm-workspace.yaml` does not reference git-proxy | U (filesystem) | E2-R11 | P2 | Existing (GREEN -- already passes) |
| T-2.4-04 | `@crosstown/sdk` package exists and exports `createEventStorageHandler` | U (filesystem) | - | P2 | Existing (RED) |

**Notes:**

- T-2.4-01 through T-2.4-03 already pass because `packages/git-proxy/` was removed previously.
- T-2.4-04 verifies that the SDK exports the handler factories that the Town package needs.
- The "documentation" part of this story is a code review gate, not an automated test.

### Story 2.5: Publish @crosstown/town Package

| ID | Test | Level | Risk | Priority | Status |
|----|------|-------|------|----------|--------|
| T-2.5-01 | `startTown({ mnemonic })` starts relay and accepts WebSocket connections | E2E | E2-R12 | P0 | Existing (RED) |
| T-2.5-02 | `startTown()` with default ports uses 7100 (relay) and 3100 (BLS) | E2E | E2-R12 | P1 | Existing (RED) |
| T-2.5-03 | Bootstrap discovers peers on start; `bootstrapResult.peerCount >= 1` | E2E | E2-R12 | P1 | Existing (RED) |
| T-2.5-04 | `instance.stop()` cleans up: relay down, BLS down, isRunning() returns false | E2E | E2-R12 | P1 | Existing (RED) |
| T-2.5-05 | `package.json` depends on `@crosstown/sdk`, `@crosstown/relay`, `@crosstown/core` | U (filesystem) | E2-R13 | P2 | Existing (RED) |
| T-2.5-06 | `import { startTown, TownConfig } from '@crosstown/town'` resolves correctly | U | E2-R13 | P2 | Existing (RED) |
| T-2.5-07 | CLI entrypoint starts relay from env vars (mnemonic not in process list) | U | E2-R14 | P2 | New |
| T-2.5-08 | TownInstance exposes `pubkey` (64-char hex) and `evmAddress` (0x-prefixed) | E2E | - | P2 | New |

**Notes:**

- T-2.5-01 through T-2.5-06 already exist as RED-phase stubs in `packages/town/tests/e2e/town-lifecycle.test.ts`.
- T-2.5-01 is the critical lifecycle test: start -> verify -> stop. It requires live genesis infrastructure.
- T-2.5-07 is a security-focused test ensuring the CLI does not leak mnemonics. The mnemonic should be passed via environment variable (`CROSSTOWN_MNEMONIC`) or a file path, not as a CLI argument visible in `ps aux`.

---

## 5. Cross-Story Test Scenarios

These tests span multiple stories and validate the integration boundaries identified in Section 3.

### 5.1 Full E2E Equivalence (Stories 2.1 + 2.2 + 2.3)

The primary cross-story scenario runs the existing E2E test suite against the SDK-based relay:

**Scenario A: Bootstrap with payment channels (equivalence proof)**

```
1. Deploy SDK-based relay as genesis node (Docker image using Town handlers)
2. Start a peer node (existing deploy-peers.sh)
3. Peer discovers genesis via kind:10032 event
4. Peer sends SPSP request (kind:23194) via ILP
5. SDK pipeline: shallow parse -> verify Schnorr -> validate pricing -> dispatch to SpspHandshakeHandler
6. SpspHandshakeHandler: decrypt NIP-44 -> negotiate settlement -> open payment channel -> encrypt response
7. Peer receives SPSP response with channel info
8. Payment channel state validated on Anvil
9. Peer publishes event via ILP with payment
10. SDK pipeline: shallow parse -> verify Schnorr -> validate pricing -> dispatch to EventStorageHandler
11. EventStorageHandler: ctx.decode() -> store in SQLite -> ctx.accept()
12. Event retrievable via Nostr REQ subscription
```

**Scenario B: Self-write bypass (SDK-specific improvement)**

```
1. SDK-based relay starts with node identity from mnemonic
2. Node publishes its own kind:10032 event
3. SDK pricing validator detects pubkey match -> bypass
4. Event stored without payment
5. Event retrievable via REQ subscription
```

**Scenario C: Invalid signature rejection (SDK-specific improvement)**

```
1. Tampered event sent as ILP packet
2. SDK shallow parse extracts pubkey, sig, id
3. SDK Schnorr verification fails -> F06 rejection
4. Handler NEVER invoked
5. Event NOT stored
```

The old BLS entrypoint did NOT verify Schnorr signatures. The SDK adds this as a security improvement. Scenario C is new behavior, not a regression.

### 5.2 SPSP Handshake End-to-End (Stories 2.2 + 2.3)

```
1. Create SPSP request with requester keys (real NIP-44 encryption)
2. Send as ILP packet to SDK-based relay
3. SDK pipeline processes -> dispatches to SpspHandshakeHandler (kind:23194)
4. Handler decrypts request, generates SPSP parameters
5. If settlement chains overlap: negotiate chain -> open payment channel via connector
6. Build NIP-44 encrypted response (kind:23195)
7. Return TOON-encoded response via ctx.accept(data)
8. Requester decrypts response and extracts SPSP parameters
9. Peer registered with connector (addPeer called with correct BTP URL)
```

This validates the complete SPSP flow through the SDK pipeline, including NIP-44 encryption/decryption, settlement negotiation, channel opening, and peer registration.

### 5.3 Town Lifecycle (Stories 2.1 + 2.2 + 2.5)

```
1. startTown({ mnemonic, knownPeers, settlementConfig })
2. Identity derived from mnemonic (fromMnemonic)
3. createNode() wires SDK pipeline + handler registry
4. EventStorageHandler registered as default handler
5. SpspHandshakeHandler registered for kind:23194
6. NostrRelayServer starts (WebSocket)
7. BLS HTTP server starts (health endpoint)
8. node.start() -> bootstrap -> peer discovery -> SPSP handshakes -> channels
9. RelayMonitor starts watching for new peers
10. TownInstance returned with stop() method
11. instance.stop() -> relay down, BLS down, monitor unsubscribed, cleanup complete
```

---

## 6. Regression Risks for Epic 1 (SDK)

Epic 2 builds ON TOP of Epic 1. The SDK must remain stable as Town handlers are developed.

### 6.1 SDK Stub Implementation Replaces Throwing Stubs

**Risk:** `createEventStorageHandler()` and `createSpspHandshakeHandler()` currently throw. Implementing them changes the SDK's public API surface.

**Mitigation:**
- The stubs are explicitly documented as "not yet implemented" -- replacing them is expected behavior
- All Epic 1 SDK tests must continue passing after stub implementation
- Run `pnpm -r test` after every handler implementation change

### 6.2 Handler Context Interface Changes

**Risk:** Town handlers may discover that `HandlerContext` is missing fields needed for relay functionality (e.g., access to EventStore, admin client, channel client).

**Mitigation:**
- Town handlers receive dependencies via closure (config object passed to `createEventStorageHandler(config)`) -- they do NOT extend HandlerContext
- HandlerContext provides: `toon`, `kind`, `pubkey`, `amount`, `destination`, `decode()`, `accept()`, `reject()`
- Everything else (EventStore, admin client, channel client) is passed via handler factory config
- If HandlerContext needs changes, those changes must not break existing SDK tests

### 6.3 PaymentHandler Bridge Behavioral Changes

**Risk:** The bridge's `isTransit` handling may need adjustment for SPSP responses (which include fulfillment data).

**Mitigation:**
- `ctx.accept(data)` already supports response data in the SDK
- The bridge returns `{ accept: true, data: responseData }` to the connector
- T-2.2-01 validates that SPSP response data flows through the bridge correctly
- Epic 1 bridge tests (T-1.6-01, T-1.6-02) continue validating transit semantics

### 6.4 Pricing Validator Kind Override Changes

**Risk:** Town may need different pricing for SPSP (kind:23194) than the SDK defaults.

**Mitigation:**
- SDK's `createNode()` accepts `kindPricing` map in config
- Town configures `kindPricing: { 23194: spspPrice }` in its `startTown()` setup
- SDK pricing validator tests (T-1.5-03, T-1.5-04) continue validating kind override behavior

---

## 7. Behavioral Differences: Old BLS vs SDK-Based Town

The SDK-based relay introduces several behavioral changes compared to the old entrypoint. These are intentional improvements, not regressions. Tests must account for them.

### 7.1 Schnorr Signature Verification (New in SDK)

**Old BLS:** No signature verification. Any TOON payload with valid structure is accepted.
**SDK-based Town:** Schnorr verification on every incoming event. Invalid signatures -> F06 rejection.

**Impact on tests:**
- E2E tests must use properly signed events (they already do -- `finalizeEvent()` produces valid signatures)
- Any test that sends malformed or tampered events must expect F06 instead of acceptance
- This is a security improvement

### 7.2 Pipeline Stage Ordering (New in SDK)

**Old BLS:** Decode TOON first, then check pricing, then store. No separate parse/verify/price stages.
**SDK-based Town:** Shallow parse -> verify -> price -> dispatch -> handler decode. Each stage can reject independently.

**Impact on tests:**
- Invalid TOON data that the old BLS would reject with "Invalid TOON data" will now be rejected at the parse stage
- Underpaid events will be rejected at the pricing stage before the handler is invoked
- Error codes may differ: old BLS used generic "BAD_REQUEST" for many errors; SDK uses specific F00/F04/F06/T00 codes

### 7.3 Error Code Normalization

| Error Case | Old BLS Code | SDK Code | Notes |
|------------|-------------|----------|-------|
| Bad TOON data | `F00` (BAD_REQUEST) | `F00` | Same |
| Insufficient payment | `F06` (INSUFFICIENT_AMOUNT) | `F04` | SDK uses standard ILP F04 |
| Invalid signature | N/A (not checked) | `F06` | New check |
| Internal error | `T00` (INTERNAL_ERROR) | `T00` | Same |
| No handler matched | N/A | `F00` | New (SDK routes by kind) |

**Impact on tests:**
- Any test asserting `F06` for insufficient payment must update to `F04`
- New test for invalid signature -> `F06`
- The existing E2E tests do not assert on specific error codes for payment failures (they test the happy path), so this should not cause E2E regressions

### 7.4 Handler Count Reduction Target

**Old BLS:** `createBlsServer()` is ~340 lines with inline SPSP handling, settlement, peer registration, NIP-34 forwarding.
**SDK-based Town:** Target <100 lines of handler registration code. The SDK abstracts verification, pricing, and dispatch.

**Test:** T-2.3-05 (code review gate, not automated).

---

## 8. Test Execution Summary

### Priority Distribution

| Priority | Test Count | Effort Estimate | When to Run |
|----------|-----------|-----------------|-------------|
| P0 | 14 | ~8-12 hours | Every commit (CI) |
| P1 | 14 | ~8-12 hours | Every PR to main |
| P2 | 10 | ~3-5 hours | Nightly / on demand |
| **Total** | **38** | **~19-29 hours** | |

### Implementation Order

Tests should be written in story dependency order:

1. **Story 2.4** (Cleanup): T-2.4-01 through T-2.4-04 -- already GREEN for file deletion, just need SDK export check
2. **Story 2.1** (Event Storage Handler): T-2.1-01 through T-2.1-08 -- implement handler, enable RED tests
3. **Story 2.2** (SPSP Handler): T-2.2-01 through T-2.2-10 -- implement handler, enable RED tests
4. **Story 2.3** (E2E Validation): T-2.3-01 through T-2.3-06 -- deploy SDK relay, run E2E suite
5. **Story 2.5** (Publish Town): T-2.5-01 through T-2.5-08 -- implement startTown(), enable lifecycle tests

### Entry Criteria

- [ ] Epic 1 complete: all SDK tests passing (`packages/sdk/pnpm test`)
- [ ] SDK stubs exist: `createEventStorageHandler()`, `createSpspHandshakeHandler()` (currently throw)
- [ ] RED-phase tests present in `packages/town/` (already exist)
- [ ] Docker build pipeline functional (`deploy-genesis-node.sh` works with current entrypoint)
- [ ] Genesis node deployed and healthy (Anvil + Connector + Relay)

### Exit Criteria

- [ ] All P0 tests passing (14 tests, 100% required)
- [ ] All P1 tests passing (14 tests, >=95% with triaged waivers)
- [ ] `genesis-bootstrap-with-channels.test.ts` passes against SDK-based relay
- [ ] `sdk-relay-validation.test.ts` passes against SDK-based relay
- [ ] `startTown()` lifecycle test passes with live infrastructure
- [ ] `packages/git-proxy/` removed (already done)
- [ ] Docker image builds with SDK-based entrypoint
- [ ] Handler logic is <100 lines in Town entrypoint
- [ ] No Epic 1 SDK test regressions (`packages/sdk/pnpm test` passes)
- [ ] `@crosstown/town` published to npm with correct ESM exports

### Quality Gates

| Gate | Threshold | Enforcement |
|------|-----------|-------------|
| P0 pass rate | 100% | CI blocks merge |
| P1 pass rate | >= 95% | CI warns, manual review |
| High-risk mitigations | 100% tested (E2-R01/R02/R04/R05/R08) | Code review gate |
| E2E equivalence | genesis-bootstrap-with-channels passes | Deployment gate |
| Handler LOC | < 100 lines | Code review |
| SDK regression | 0 failures in packages/sdk/ | CI blocks merge |
| SPSP encryption | NIP-44 roundtrip verified | P0 test suite |

---

## 9. Test Data Factories

Town tests should reuse SDK test factories where possible and add relay-specific factories:

```typescript
// Reuse from SDK test helpers:
// - createSignedToonPayload() -- real signed TOON for event storage tests
// - createTamperedToonPayload() -- invalid signature for F06 rejection tests
// - createPaymentRequest() -- ILP packet request with configurable amount
// - createTestIdentity() -- node identity for self-write tests

// New for Town:

// SPSP request factory (real NIP-44 encryption)
function createSpspRequest(
  senderSk: Uint8Array,
  recipientPubkey: string,
  settlementInfo?: {
    ilpAddress?: string;
    supportedChains?: string[];
    settlementAddresses?: Record<string, string>;
  }
): { event: NostrEvent; requestId: string };

// Mock connector admin client
function createMockAdminClient(): {
  addPeer: MockFunction;
  removePeer: MockFunction;
};

// Mock channel client
function createMockChannelClient(): {
  openChannel: MockFunction;
  getChannelState: MockFunction;
};

// In-memory event store (real SQLite :memory:)
function createTestEventStore(): SqliteEventStore;
```

---

## 10. Relationship to Existing Test Artifacts

### Existing RED-Phase Tests (to be enabled)

| File | Story | Test Count | Status |
|------|-------|-----------|--------|
| `packages/town/src/handlers/event-storage-handler.test.ts` | 2.1 | 6 | RED (describe.skip) |
| `packages/town/src/handlers/spsp-handshake-handler.test.ts` | 2.2 | 7 | RED (describe.skip) |
| `packages/town/src/cleanup.test.ts` | 2.4 | 4 | GREEN (3 pass, 1 RED) |
| `packages/town/tests/e2e/town-lifecycle.test.ts` | 2.5 | 5 | RED (describe.skip) |
| `packages/client/tests/e2e/sdk-relay-validation.test.ts` | 2.3 | ~5 | RED (describe.skip) |

### New Tests Added by This Plan

| Test ID | Story | Description |
|---------|-------|-------------|
| T-2.1-08 | 2.1 | Handler receives ctx.toon as raw TOON string |
| T-2.2-08 | 2.2 | SPSP response includes channelId when settlement succeeds |
| T-2.2-09 | 2.2 | No settlement fields when requester has no supportedChains |
| T-2.2-10 | 2.2 | Handler receives event through SDK pipeline (integration) |
| T-2.3-06 | 2.3 | Docker image builds successfully with SDK-based entrypoint |
| T-2.5-07 | 2.5 | CLI entrypoint does not leak mnemonic in process list |
| T-2.5-08 | 2.5 | TownInstance exposes pubkey and evmAddress |

### Test Count Comparison

| Aspect | Epic 1 Test Plan | Epic 2 Test Plan |
|--------|-----------------|-----------------|
| Total tests | 71 | 38 |
| P0 tests | 38 | 14 |
| High-risk items | 7 (max score 9) | 5 (max score 9) |
| Unit tests | ~60 | ~22 |
| Integration tests | ~10 | ~4 |
| E2E tests | 0 (deferred to Epic 2) | ~12 |
| Existing RED tests | N/A | 27 (to be enabled) |
| New tests | 71 | 11 |

Epic 2 has fewer tests because:
1. The SDK pipeline is already tested by Epic 1 -- Town only tests the handler layer and integration
2. The E2E tests serve as high-value integration proofs (one E2E test validates many unit behaviors)
3. The cleanup story (2.4) tests are trivial filesystem checks

---

## 11. Performance Considerations

### 11.1 SDK Pipeline Overhead

**Concern:** The SDK adds shallow parse, Schnorr verification, and pricing validation stages that the old BLS did not have. This adds latency to every incoming ILP packet.

**Analysis:**
- Shallow TOON parse: <1ms (string scanning for 4 fields)
- Schnorr verification: ~1-3ms (nostr-tools/@noble/curves pure JS)
- Pricing validation: <0.1ms (bigint comparison)
- Total overhead: ~2-4ms per event

**Acceptable because:**
- The old BLS fully decoded TOON for every event anyway (~1ms decode)
- Schnorr verification is a security improvement worth the cost
- Network I/O (WebSocket, ILP routing) dominates at 10-50ms per event
- No SLA defined for relay throughput in NFRs

**Test approach:**
- Monitor E2E test execution time as a canary
- If `genesis-bootstrap-with-channels.test.ts` takes >2x longer, investigate
- No explicit performance test in Epic 2

### 11.2 SQLite Concurrent Access

**Concern:** The old BLS uses synchronous SQLite writes in the HTTP handler. The SDK handler does the same, but now behind the PaymentHandler bridge with potential concurrent packets.

**Mitigation:**
- better-sqlite3 uses WAL mode by default, allowing concurrent reads with sequential writes
- The connector delivers packets one at a time per channel (ILP STREAM protocol serializes)
- No change needed from old behavior

---

## 12. Deployment Validation Checklist

Before declaring Epic 2 complete, the following deployment steps must succeed:

- [ ] `pnpm -r test` passes (all packages, including new Town tests)
- [ ] `pnpm build` succeeds (all packages build)
- [ ] `docker build` produces a working image with SDK-based entrypoint
- [ ] `./deploy-genesis-node.sh` deploys SDK-based relay
- [ ] `curl http://localhost:3100/health` returns healthy with `sdk: true` indicator
- [ ] `packages/client/tests/e2e/genesis-bootstrap-with-channels.test.ts` passes
- [ ] `packages/client/tests/e2e/sdk-relay-validation.test.ts` passes
- [ ] `./deploy-peers.sh 1` deploys a peer that bootstraps against SDK-based genesis
- [ ] Peer SPSP handshake succeeds with payment channel creation
- [ ] Event published by peer is retrievable via REQ on genesis relay

---

## Approval

- [ ] Product Manager: **_ Date: _**
- [ ] Tech Lead: **_ Date: _**
