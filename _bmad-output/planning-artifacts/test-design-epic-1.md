# Risk-Based Test Plan: Epic 1 - ILP-Gated Service Node SDK

**Date:** 2026-03-04
**Author:** Jonathan
**Status:** Implementation-Ready
**Source:** Adapted from `_bmad-output/test-artifacts/test-design-epic-1.md` with risk-based prioritization for practical implementation

---

## 1. Scope and Context

Epic 1 delivers 12 stories (1.0-1.11) producing `@toon-protocol/sdk` -- the developer-facing abstraction for building ILP-gated service nodes. The SDK wraps TOON codec, handler registry, Schnorr verification, pricing validation, PaymentHandler bridge, unified identity, and embedded connector lifecycle into a `createNode()` composition function.

**What exists today:**

- TOON codec lives in `packages/bls/src/toon/` (encoder.ts, decoder.ts, toon.test.ts)
- `createToonNode()` composition exists in `packages/core/src/compose.ts` with `HandlePacketRequest`/`HandlePacketResponse` types
- `EmbeddableConnectorLike` structural type already defined in compose.ts
- SDK package has ATDD Red Phase test files (`.test.ts` only, all tests `.skip`ped, no implementation)
- No shallow TOON parser exists yet
- No identity module exists yet

**What this test plan covers:**

- Stories 1.0-1.11 of Epic 1, focusing on the SDK processing pipeline
- Risk assessment for each story with probability x impact scoring
- Cross-story integration boundaries and the pipeline ordering invariant
- Regression risks when later stories modify earlier work

**What this test plan does NOT cover:**

- Epic 2 (Town relay reimplementation) -- covered by its own test design
- Epic 5 (The Rig git forge) -- covered by its own test design
- E2E tests against genesis node -- the SDK is tested via unit/integration; E2E validation happens in Epic 2 Story 2.3

---

## 2. Risk Assessment by Story

### Risk Scoring

- **Probability**: 1 (unlikely), 2 (possible), 3 (likely)
- **Impact**: 1 (minor), 2 (moderate), 3 (severe -- data loss, security breach, or cascade failure)
- **Score**: Probability x Impact (1-9)
- **Threshold**: Score >= 6 = high priority, 3-5 = medium, 1-2 = low

### Story-Level Risk Matrix

| Story                 | Risk ID | Category | Description                                                                                                                   | P   | I   | Score | Mitigation                                                                                                                              |
| --------------------- | ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- | --- | --- | ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **1.0 TOON Codec**    | E1-R01  | TECH     | Codec extraction breaks encode/decode roundtrip across BLS/relay packages                                                     | 2   | 3   | **6** | Roundtrip test in core; run `pnpm -r test` after move                                                                                   |
| **1.0 TOON Codec**    | E1-R02  | DATA     | Shallow parser extracts wrong byte offsets for id/pubkey/sig from TOON binary format                                          | 2   | 3   | **6** | Cross-validate shallow parse output against full decode for same payload                                                                |
| **1.1 Identity**      | E1-R03  | SEC      | Keys derived via @scure/bip39+bip32 incompatible with nostr-tools Schnorr or viem EVM address                                 | 2   | 3   | **6** | Cross-library roundtrip: derive key -> sign with nostr-tools -> verify; derive -> compute EVM address -> verify with known test vectors |
| **1.2 Registry**      | E1-R04  | BUS      | No handler and no default -> silent drop instead of F00 rejection                                                             | 1   | 2   | 2     | Unit test for F00 on unmatched kind with no default                                                                                     |
| **1.3 Context**       | E1-R05  | PERF     | `decode()` called multiple times causes redundant TOON parsing                                                                | 1   | 2   | 2     | Unit test: second `decode()` call returns same object reference                                                                         |
| **1.4 Verification**  | E1-R06  | SEC      | devMode defaults to true or has env var override, leaking bypass to production                                                | 2   | 3   | **6** | Unit test: default config + invalid sig = F06 rejection; grep codebase for `process.env` reads of devMode                               |
| **1.4 Verification**  | E1-R07  | SEC      | Verification runs AFTER full decode (trusts decode, defeats purpose)                                                          | 2   | 3   | **6** | Integration test: verify stage uses shallow parse fields only, not decoded event                                                        |
| **1.5 Pricing**       | E1-R08  | BUS      | Self-write pubkey comparison fails due to format mismatch (hex vs npub vs different case)                                     | 1   | 3   | 3     | Unit test with hex pubkey, normalized hex, and edge cases                                                                               |
| **1.6 Bridge**        | E1-R09  | TECH     | isTransit flag swapped: fire-and-forget when await needed (data loss) or await when fire-and-forget needed (forwarding block) | 2   | 3   | **6** | Unit test both paths: isTransit=true returns before handler resolves; isTransit=false waits                                             |
| **1.6 Bridge**        | E1-R10  | TECH     | Unhandled async exception in handler leaks as unhandled rejection instead of T00                                              | 2   | 2   | 4     | Unit test: throwing handler -> T00 response, no unhandled rejection                                                                     |
| **1.7 createNode**    | E1-R11  | TECH     | **Pipeline stage ordering violation** -- stages execute in wrong order (e.g., dispatch before verify, price before parse)     | 3   | 3   | **9** | Integration test with spy/trace proving exact execution order: shallow parse -> verify -> price -> dispatch                             |
| **1.7 createNode**    | E1-R12  | TECH     | Double `start()` does not throw, causing duplicate bootstrap and relay monitor subscriptions                                  | 1   | 2   | 2     | Unit test: second start() throws NodeError                                                                                              |
| **1.8 Connector API** | E1-R13  | TECH     | ConnectorNodeLike structural type drifts from real ConnectorNode, runtime failures with no compile error                      | 2   | 2   | 4     | Integration test against real connector validates structural compatibility                                                              |
| **1.9 Bootstrap**     | E1-R14  | OPS      | Channel opening during bootstrap fails silently, peerCount reports success but channels are 0                                 | 1   | 2   | 2     | Integration test validates channelCount in StartResult                                                                                  |
| **1.10 Dev Mode**     | E1-R15  | SEC      | Dev mode bypasses leak to production through incomplete config isolation                                                      | 1   | 3   | 3     | Unit test: devMode unset in config -> verification and pricing active                                                                   |
| **1.11 Package**      | E1-R16  | OPS      | ESM export map misconfigured, consumers get import errors                                                                     | 1   | 1   | 1     | Import validation test                                                                                                                  |

### High-Priority Risks (Score >= 6) -- Ordered by Score

| Rank | Risk ID | Score | Story | Summary                                          |
| ---- | ------- | ----- | ----- | ------------------------------------------------ |
| 1    | E1-R11  | **9** | 1.7   | Pipeline stage ordering violation (CRITICAL)     |
| 2    | E1-R01  | **6** | 1.0   | TOON codec extraction regression                 |
| 3    | E1-R02  | **6** | 1.0   | Shallow parser byte offset errors                |
| 4    | E1-R03  | **6** | 1.1   | Cross-library key derivation incompatibility     |
| 5    | E1-R06  | **6** | 1.4   | devMode bypass leaking to production             |
| 6    | E1-R07  | **6** | 1.4   | Verification after full decode (defeats purpose) |
| 7    | E1-R09  | **6** | 1.6   | Transit semantics swapped                        |

---

## 3. Critical Integration Boundaries Between Stories

### 3.1 The Pipeline Ordering Invariant (E1-R11, Score 9)

The SDK's core correctness property is the processing pipeline order:

```
ILP Packet
  -> PaymentHandlerBridge (isTransit check)           [Story 1.6]
    -> Shallow TOON Parse (extract kind, pubkey, id, sig)  [Story 1.0]
      -> Schnorr Signature Verification (or devMode skip)  [Story 1.4]
        -> Pricing Validation (or self-write bypass)       [Story 1.5]
          -> HandlerRegistry.dispatch(kind)                [Story 1.2]
            -> Handler(ctx) -> ctx.accept()/reject()       [Story 1.3]
```

**Why this order is non-negotiable:**

- **Shallow parse BEFORE verify**: Verification needs `id`, `pubkey`, `sig` from the shallow parse. Full decode first would trust the decode.
- **Verify BEFORE price**: Pricing a forged event wastes validation effort and leaks pricing information.
- **Price BEFORE dispatch**: Underpaid events must never reach developer handlers.
- **isTransit BEFORE everything**: Transit packets are forwarded immediately; only final-hop packets enter the pipeline.

**Integration test strategy:**

- Instrument each pipeline stage with a call-order tracker
- Assert exact invocation sequence for valid events, invalid signatures, and underpaid events
- Assert handler is NEVER invoked when verification or pricing fails

### 3.2 Story 1.0 -> Stories 1.3, 1.4, 1.5, 1.7

The TOON codec extraction is the foundational prerequisite. Every pipeline stage consumes TOON data:

| Consumer Story   | What it needs from 1.0                                          | Failure mode if broken                                                   |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1.3 (Context)    | `decodeToon()` for lazy decode, raw TOON string for passthrough | `ctx.decode()` throws; `ctx.toon` is garbled                             |
| 1.4 (Verify)     | `shallowParseToon()` for `id`, `pubkey`, `sig`, `rawBytes`      | Verification operates on wrong data; all events rejected or all accepted |
| 1.5 (Pricing)    | TOON byte length (`rawBytes.length`) for per-byte pricing       | Pricing uses wrong byte count; events over/underpriced                   |
| 1.7 (createNode) | All of the above wired together                                 | Full pipeline broken                                                     |

**Boundary test:** Encode a known NostrEvent -> shallow parse -> verify fields match -> full decode -> decoded event matches original. This single test validates the 1.0 -> 1.3/1.4/1.5 boundary.

### 3.3 Story 1.1 -> Story 1.4 (Identity -> Verification)

The identity module derives Nostr keys. The verification module uses nostr-tools to verify Schnorr signatures. These must be compatible:

- Key derived via `fromMnemonic()` using @scure/bip39+bip32 at NIP-06 path
- Event signed with that key using nostr-tools `finalizeEvent()`
- Signature verified by the SDK's verification pipeline using the same nostr-tools `verifyEvent()`

**Boundary test:** Generate identity -> sign event -> encode to TOON -> shallow parse -> verify signature -> should pass.

### 3.4 Story 1.2 -> Story 1.6 (Registry -> Bridge)

The handler registry dispatches by kind. The PaymentHandler bridge decides whether to fire-and-forget (transit) or await (final hop). The bridge must correctly invoke the registry's dispatch and handle its response.

**Boundary test:** Register handler for kind X -> send packet with kind X and isTransit=false -> handler invoked, response awaited and returned to connector.

### 3.5 Story 1.5 -> Story 1.1 (Pricing -> Identity)

Self-write bypass compares the event's pubkey against the node's own pubkey. The node's pubkey comes from the identity module. Format must match.

**Boundary test:** Create node with identity -> publish event from own pubkey -> pricing bypass activates -> handler invoked with amount=0 accepted.

---

## 4. Test Strategy Per Story

### Legend

- **U** = Unit test (isolated, mocked dependencies where structurally unavailable)
- **I** = Integration test (multiple real modules wired together)
- **Real crypto** = Uses real @scure/bip39, @scure/bip32, nostr-tools -- no mocked crypto

### Story 1.0: Extract TOON Codec to @toon-protocol/core

| ID       | Test                                                                   | Level | Risk   | Priority |
| -------- | ---------------------------------------------------------------------- | ----- | ------ | -------- |
| T-1.0-01 | Encode NostrEvent -> TOON bytes -> decode back = identical event       | U     | E1-R01 | P0       |
| T-1.0-02 | Shallow parse extracts kind from TOON bytes, matches full decode       | U     | E1-R02 | P0       |
| T-1.0-03 | Shallow parse extracts pubkey from TOON bytes, matches full decode     | U     | E1-R02 | P0       |
| T-1.0-04 | Shallow parse extracts id from TOON bytes, matches full decode         | U     | E1-R02 | P0       |
| T-1.0-05 | Shallow parse extracts sig from TOON bytes, matches full decode        | U     | E1-R02 | P0       |
| T-1.0-06 | Shallow parse preserves rawBytes (byte-exact match with encoded input) | U     | E1-R02 | P0       |
| T-1.0-07 | Re-export from `@toon-protocol/core` index.ts works (import validation)    | U     | E1-R01 | P1       |
| T-1.0-08 | BLS tests pass after import path change (`pnpm -r test`)               | I     | E1-R01 | P0       |

**Notes:**

- The TOON codec is ~100 LOC. Roundtrip test is the single highest-value test for this story.
- Shallow parse is entirely new code. Every field extraction needs its own test because byte offset bugs are subtle.
- T-1.0-08 is not a test file you write; it's `pnpm -r test` run after the code move. Include it in CI gate.

### Story 1.1: Unified Identity from Seed Phrase

| ID       | Test                                                                              | Level           | Risk   | Priority |
| -------- | --------------------------------------------------------------------------------- | --------------- | ------ | -------- |
| T-1.1-01 | `generateMnemonic()` returns valid 12-word BIP-39 mnemonic                        | U (real crypto) | E1-R03 | P0       |
| T-1.1-02 | `fromMnemonic(words)` derives secretKey at NIP-06 path m/44'/1237'/0'/0/0         | U (real crypto) | E1-R03 | P0       |
| T-1.1-03 | `fromMnemonic(words)` returns x-only Schnorr pubkey (32 bytes hex, 64 chars)      | U (real crypto) | E1-R03 | P0       |
| T-1.1-04 | `fromMnemonic(words)` returns correct EVM address (Keccak-256 derived, 0x prefix) | U (real crypto) | E1-R03 | P0       |
| T-1.1-05 | Derived key signs event, nostr-tools verifies signature (cross-library roundtrip) | U (real crypto) | E1-R03 | P0       |
| T-1.1-06 | `fromMnemonic(words, { accountIndex: 3 })` derives at m/44'/1237'/0'/0/3          | U (real crypto) | E1-R03 | P0       |
| T-1.1-07 | Different account indices produce distinct keypairs                               | U (real crypto) | E1-R03 | P0       |
| T-1.1-08 | `fromSecretKey(key)` derives matching pubkey and evmAddress                       | U (real crypto) | E1-R03 | P0       |
| T-1.1-09 | 24-word mnemonic accepted and produces valid key                                  | U (real crypto) | -      | P1       |
| T-1.1-10 | Invalid mnemonic throws descriptive error                                         | U (real crypto) | -      | P1       |
| T-1.1-11 | Known test vector: "abandon" x11 + "about" produces expected key                  | U (real crypto) | E1-R03 | P0       |

**Notes:**

- ALL identity tests use real crypto libraries. No mocked Schnorr, no mocked key derivation.
- T-1.1-05 is the critical cross-library boundary test. If this passes, the identity -> verification pipeline works.
- T-1.1-11 uses a known BIP-39 test vector for deterministic validation.

### Story 1.2: Handler Registry with Kind-Based Routing

| ID       | Test                                                            | Level | Risk   | Priority |
| -------- | --------------------------------------------------------------- | ----- | ------ | -------- |
| T-1.2-01 | `.on(kind, handler)` dispatches to correct handler              | U     | -      | P0       |
| T-1.2-02 | Multiple kinds registered, each dispatches to its own handler   | U     | -      | P0       |
| T-1.2-03 | `.onDefault(handler)` invoked when no kind match                | U     | -      | P0       |
| T-1.2-04 | No handler, no default -> auto-reject F00                       | U     | E1-R04 | P0       |
| T-1.2-05 | `.on(kind, newHandler)` replaces previous handler for that kind | U     | -      | P1       |

**Notes:**

- HandlerRegistry is a pure routing component. Tests are fast and straightforward.
- T-1.2-04 is the safety net -- silent drops would be a data integrity issue.

### Story 1.3: HandlerContext with TOON Passthrough and Lazy Decode

| ID       | Test                                                                     | Level | Risk   | Priority |
| -------- | ------------------------------------------------------------------------ | ----- | ------ | -------- |
| T-1.3-01 | `ctx.toon` contains raw TOON string, no decode performed at construction | U     | -      | P0       |
| T-1.3-02 | `ctx.kind` matches shallow-parsed kind (not decoded)                     | U     | -      | P0       |
| T-1.3-03 | `ctx.pubkey` matches shallow-parsed pubkey                               | U     | -      | P0       |
| T-1.3-04 | `ctx.amount` contains ILP payment amount as bigint                       | U     | -      | P0       |
| T-1.3-05 | `ctx.destination` contains ILP destination address                       | U     | -      | P0       |
| T-1.3-06 | `ctx.decode()` performs full TOON decode and returns NostrEvent          | U     | -      | P0       |
| T-1.3-07 | `ctx.decode()` second call returns cached result (same object reference) | U     | E1-R05 | P0       |
| T-1.3-08 | `ctx.accept()` produces HandlePacketAcceptResponse                       | U     | -      | P0       |
| T-1.3-09 | `ctx.accept(data)` includes response data in fulfillment                 | U     | -      | P1       |
| T-1.3-10 | `ctx.reject(code, message)` produces HandlePacketRejectResponse          | U     | -      | P0       |

### Story 1.4: Schnorr Signature Verification Pipeline

| ID       | Test                                                                      | Level           | Risk   | Priority |
| -------- | ------------------------------------------------------------------------- | --------------- | ------ | -------- |
| T-1.4-01 | Valid Schnorr signature passes verification, event dispatched             | U (real crypto) | -      | P0       |
| T-1.4-02 | Invalid signature rejected with F06, handler NEVER invoked                | U (real crypto) | E1-R06 | P0       |
| T-1.4-03 | Tampered event content -> signature mismatch -> F06                       | U (real crypto) | -      | P0       |
| T-1.4-04 | devMode=true -> invalid signature accepted, handler invoked               | U (real crypto) | -      | P1       |
| T-1.4-05 | devMode unset (default) -> invalid signature -> F06 (no bypass leak)      | U (real crypto) | E1-R06 | P0       |
| T-1.4-06 | Verification uses shallow parse fields (id, pubkey, sig), NOT full decode | U               | E1-R07 | P0       |

**Notes:**

- T-1.4-06 is the architectural invariant test. The verification module should accept `ToonRoutingMeta` (from shallow parse), NOT a `NostrEvent` (from full decode). If the function signature requires a NostrEvent, the architecture is violated.
- Tests use real nostr-tools signing/verification. Create a helper `createSignedToonPayload()` that generates a real signed event.

### Story 1.5: Pricing Validation with Self-Write Bypass

| ID       | Test                                                                                  | Level | Risk   | Priority |
| -------- | ------------------------------------------------------------------------------------- | ----- | ------ | -------- |
| T-1.5-01 | Per-byte pricing: amount >= toonBytes.length \* basePricePerByte -> accepted          | U     | -      | P0       |
| T-1.5-02 | Per-byte pricing: amount < required -> F04 with `required` and `received` in metadata | U     | -      | P0       |
| T-1.5-03 | Per-kind override: kindPricing[23194] = 0n -> free for that kind                      | U     | -      | P0       |
| T-1.5-04 | Per-kind override takes precedence over per-byte calculation                          | U     | -      | P0       |
| T-1.5-05 | Self-write bypass: event pubkey = node pubkey -> pricing skipped                      | U     | E1-R08 | P0       |
| T-1.5-06 | Default basePricePerByte is 10n when unconfigured                                     | U     | -      | P1       |
| T-1.5-07 | Exact payment amount (amount == required) accepted                                    | U     | -      | P1       |

### Story 1.6: PaymentHandler Bridge with Transit Semantics

| ID       | Test                                                                             | Level | Risk   | Priority |
| -------- | -------------------------------------------------------------------------------- | ----- | ------ | -------- |
| T-1.6-01 | isTransit=true: bridge returns BEFORE handler promise resolves (fire-and-forget) | U     | E1-R09 | P0       |
| T-1.6-02 | isTransit=false: bridge returns AFTER handler promise resolves (await)           | U     | E1-R09 | P0       |
| T-1.6-03 | Handler throws -> T00 reject response returned, no unhandled rejection           | U     | E1-R10 | P0       |
| T-1.6-04 | Handler async rejection -> T00 reject response returned                          | U     | E1-R10 | P1       |

### Story 1.7: createNode() Composition with Embedded Connector Lifecycle

| ID       | Test                                                                                        | Level | Risk   | Priority |
| -------- | ------------------------------------------------------------------------------------------- | ----- | ------ | -------- |
| T-1.7-01 | **Pipeline ordering: shallow parse -> verify -> price -> dispatch** (spy-instrumented)      | I     | E1-R11 | P0       |
| T-1.7-02 | Pipeline: invalid signature -> verify rejects -> handler never invoked                      | I     | E1-R11 | P0       |
| T-1.7-03 | Pipeline: valid sig, underpaid -> price rejects with F04 -> handler never invoked           | I     | E1-R11 | P0       |
| T-1.7-04 | Pipeline: valid sig, sufficient payment -> handler invoked, accept returned                 | I     | E1-R11 | P0       |
| T-1.7-05 | Pipeline: self-write event -> pricing bypassed -> handler invoked                           | I     | E1-R11 | P0       |
| T-1.7-06 | `node.start()` calls `connector.setPacketHandler()`                                         | I     | -      | P0       |
| T-1.7-07 | `node.start()` runs bootstrap and returns StartResult with peerCount, channelCount          | I     | -      | P1       |
| T-1.7-08 | `node.stop()` unsubscribes relay monitor                                                    | I     | -      | P1       |
| T-1.7-09 | `node.stop()` is idempotent (double stop = no-op)                                           | U     | E1-R12 | P2       |
| T-1.7-10 | Double `node.start()` throws NodeError                                                      | U     | E1-R12 | P0       |
| T-1.7-11 | `node.pubkey` returns correct x-only public key                                             | U     | -      | P1       |
| T-1.7-12 | `node.evmAddress` returns correct EVM address                                               | U     | -      | P1       |
| T-1.7-13 | createNode with minimal config uses sensible defaults (basePricePerByte=10n, devMode=false) | U     | -      | P1       |

**Notes:**

- T-1.7-01 through T-1.7-05 are the MOST IMPORTANT tests in Epic 1. They validate the pipeline ordering invariant (E1-R11, score 9).
- These integration tests wire real TOON codec, real Schnorr verification, real pricing, and real handler dispatch.
- Use a spy/wrapper pattern to record the order of stage invocations.

### Story 1.8: Connector Direct Methods API

| ID       | Test                                                                            | Level | Risk   | Priority |
| -------- | ------------------------------------------------------------------------------- | ----- | ------ | -------- |
| T-1.8-01 | `node.connector` exposes registerPeer, removePeer, sendPacket                   | U     | E1-R13 | P2       |
| T-1.8-02 | `node.channelClient` is null when connector lacks channel support               | U     | -      | P2       |
| T-1.8-03 | `node.channelClient` is non-null when connector has openChannel/getChannelState | U     | -      | P2       |

### Story 1.9: Network Discovery and Bootstrap Integration

| ID       | Test                                                                    | Level | Risk   | Priority |
| -------- | ----------------------------------------------------------------------- | ----- | ------ | -------- |
| T-1.9-01 | `node.start()` with knownPeers triggers BootstrapService discovery      | I     | -      | P1       |
| T-1.9-02 | StartResult.channelCount reflects channels opened during bootstrap      | I     | E1-R14 | P1       |
| T-1.9-03 | RelayMonitor detects kind:10032 events after start                      | I     | -      | P1       |
| T-1.9-04 | `node.peerWith(pubkey)` initiates manual peering                        | I     | -      | P2       |
| T-1.9-05 | Bootstrap lifecycle events emitted via `node.on('bootstrap', listener)` | I     | -      | P2       |

**Notes:**

- These tests require either a mocked connector or a running Anvil+Faucet for channel tests.
- P1 priority because bootstrap integration is validated end-to-end in Epic 2 Story 2.3.

### Story 1.10: Dev Mode

| ID        | Test                                                       | Level | Risk   | Priority |
| --------- | ---------------------------------------------------------- | ----- | ------ | -------- |
| T-1.10-01 | devMode=true: invalid signature accepted                   | U     | -      | P1       |
| T-1.10-02 | devMode=true: underpaid event accepted (pricing bypass)    | U     | -      | P1       |
| T-1.10-03 | devMode=true: packet details logged                        | U     | -      | P2       |
| T-1.10-04 | devMode not set: verification and pricing active (no leak) | U     | E1-R15 | P0       |

### Story 1.11: Package Setup and npm Publish

| ID        | Test                                             | Level | Risk   | Priority |
| --------- | ------------------------------------------------ | ----- | ------ | -------- |
| T-1.11-01 | All public APIs importable from `@toon-protocol/sdk` | U     | E1-R16 | P2       |
| T-1.11-02 | TypeScript types exported correctly              | U     | -      | P3       |

---

## 5. Cross-Story Test Scenarios

These tests span multiple stories and validate the integration boundaries identified in Section 3.

### 5.1 Full Pipeline (Stories 1.0, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7)

The pipeline ordering tests (T-1.7-01 through T-1.7-05) are the primary cross-story scenarios. They exercise every stage in sequence:

**Scenario A: Happy path (valid event, sufficient payment)**

```
1. Encode real NostrEvent to TOON [1.0]
2. Create ILP packet with base64 TOON data
3. PaymentHandlerBridge receives packet, isTransit=false [1.6]
4. Shallow parse extracts kind, pubkey, id, sig [1.0]
5. Schnorr verify passes [1.4]
6. Pricing validates amount >= required [1.5]
7. HandlerRegistry dispatches to kind handler [1.2]
8. Handler receives ctx with raw TOON, calls ctx.decode() [1.3]
9. Handler calls ctx.accept() [1.3]
10. Accept response flows back through bridge to connector [1.6]
```

**Scenario B: Forged event (invalid signature)**

```
1-4. Same as Scenario A
5. Schnorr verify FAILS -> F06 rejection
6-10. NEVER executed (handler never invoked)
```

**Scenario C: Underpaid event (valid sig, insufficient amount)**

```
1-5. Same as Scenario A (verify passes)
6. Pricing FAILS -> F04 rejection with required/received amounts
7-10. NEVER executed (handler never invoked)
```

**Scenario D: Self-write (own pubkey, any amount)**

```
1-5. Same as Scenario A (verify passes for own key)
6. Pricing BYPASSED (pubkey matches node pubkey) [1.5 + 1.1]
7-10. Same as Scenario A (handler invoked normally)
```

**Scenario E: Transit packet**

```
1. ILP packet arrives with isTransit=true
2. PaymentHandlerBridge fires-and-forgets [1.6]
3. Bridge returns immediately (does not await handler)
4-10. Handler pipeline runs asynchronously
```

### 5.2 Identity -> Verification Roundtrip (Stories 1.1 + 1.4)

```
1. generateMnemonic() -> fromMnemonic(words) [1.1]
2. Create NostrEvent, sign with derived secretKey using nostr-tools
3. Encode signed event to TOON [1.0]
4. Shallow parse extracts sig, pubkey, id [1.0]
5. Verification pipeline verifies signature [1.4]
6. Event passes verification -> dispatched to handler
```

This validates that the @scure-derived keys produce signatures that the nostr-tools-based verification accepts.

### 5.3 Identity -> Pricing Self-Write (Stories 1.1 + 1.5)

```
1. fromMnemonic(words) -> { pubkey } [1.1]
2. createNode({ secretKey, ... }) -> node with known pubkey
3. Incoming event with event.pubkey == node.pubkey
4. Pricing validation recognizes self-write -> bypass [1.5]
```

This validates pubkey format consistency between identity derivation and pricing comparison.

---

## 6. Regression Risks When Later Stories Modify Earlier Work

### 6.1 Story 1.4 (Verification) modifying Story 1.0 (Shallow Parse)

**Risk:** Verification pipeline may require additional fields from shallow parse (e.g., `created_at` for replay protection). If Story 1.4 adds requirements to the `ToonRoutingMeta` interface, Story 1.0's shallow parser must be updated.

**Mitigation:** Define `ToonRoutingMeta` interface as part of Story 1.0 with all fields needed by Stories 1.4 and 1.5. Lock the interface before starting Story 1.4.

**Regression test:** T-1.0-02 through T-1.0-06 (shallow parse field extraction tests) catch any parser regression.

### 6.2 Story 1.7 (createNode) wiring changes affecting Stories 1.4/1.5

**Risk:** When wiring the full pipeline in createNode(), the developer may reorder stages (e.g., price before verify for "performance"). This violates the correctness invariant.

**Mitigation:** T-1.7-01 (pipeline ordering test with spy instrumentation) catches this immediately. This test should be in the P0 suite and run on every commit.

### 6.3 Story 1.10 (Dev Mode) weakening Story 1.4/1.5 implementations

**Risk:** Adding devMode bypass logic to verification.ts and pricing.ts could introduce conditional branches that accidentally affect production behavior (e.g., an early return that doesn't check the devMode flag properly).

**Mitigation:**

- T-1.10-04 (devMode not set -> verification and pricing active) catches production leakage
- T-1.4-05 (devMode unset -> invalid sig -> F06) is the explicit production enforcement test
- Both must pass together to confirm isolation

### 6.4 Story 1.11 (Package) re-exporting changed APIs

**Risk:** If Stories 1.0-1.10 change public API signatures during implementation, the index.ts re-exports may break or expose stale types.

**Mitigation:** T-1.11-01 (import validation) catches missing exports. More importantly, TypeScript compilation catches type mismatches.

### 6.5 Codec changes in Story 1.0 breaking downstream consumers

**Risk:** After extracting the codec, BLS and relay packages import from `@toon-protocol/core` instead of local paths. If the codec behavior subtly changes during extraction (e.g., different error types, different handling of edge cases), downstream tests may fail.

**Mitigation:**

- T-1.0-01 (roundtrip test) validates codec behavior is preserved
- T-1.0-08 (`pnpm -r test`) catches downstream regressions
- The codec should be a pure copy-paste with only import path changes; no behavior modifications during extraction

---

## 7. Performance Considerations

### 7.1 TOON Parsing Latency

**Concern:** Shallow parse is called on every incoming ILP packet. If it's slow, it becomes a bottleneck.

**Current state:** The TOON format is string-based (TextEncoder/TextDecoder for Uint8Array conversion, then `@toon-format/toon` decode). Shallow parse should be significantly faster than full decode because it extracts only 4 fields (kind, pubkey, id, sig) without parsing content, tags, or created_at.

**Test approach:**

- No explicit performance test in Epic 1 (no SLA defined in NFRs)
- Monitor: if full pipeline integration tests (T-1.7-01) take >100ms per event, investigate shallow parse implementation
- The shallow parser should ideally use string scanning (indexOf/substring) rather than full JSON-like decode

**Recommendation:** The shallow parser should operate on the TOON string (after TextDecoder) and use pattern matching to extract the 4 routing fields. It should NOT use `@toon-format/toon` decode internally -- that would defeat the purpose.

### 7.2 Schnorr Verification Throughput

**Concern:** Schnorr signature verification (BIP-340) is CPU-intensive. Every non-devMode packet requires one verification.

**Current state:** nostr-tools uses @noble/curves for Schnorr, which is pure JavaScript (no native addon). Performance is ~1000-3000 verifications/second on modern hardware.

**Test approach:**

- No throughput test in Epic 1 (SDK is a library; throughput depends on the consumer's deployment)
- If performance becomes a concern in Epic 2 E2E tests, consider: (a) verification batching, (b) WebAssembly Schnorr implementation, (c) caching verified event IDs

### 7.3 Lazy Decode Caching

**Concern:** Multiple calls to `ctx.decode()` should not re-parse TOON data.

**Test:** T-1.3-07 validates caching by checking object reference equality on second call.

---

## 8. Test Execution Summary

### Priority Distribution

| Priority  | Test Count | Effort Estimate  | When to Run       |
| --------- | ---------- | ---------------- | ----------------- |
| P0        | 38         | ~19-25 hours     | Every commit (CI) |
| P1        | 22         | ~11-17 hours     | Every PR to main  |
| P2        | 10         | ~3-5 hours       | Nightly           |
| P3        | 1          | ~0.5 hours       | On-demand         |
| **Total** | **71**     | **~33-48 hours** |                   |

### Implementation Order

Tests should be written in story dependency order:

1. **Story 1.0** (TOON codec): T-1.0-01 through T-1.0-08 -- unblocks everything
2. **Story 1.1** (Identity): T-1.1-01 through T-1.1-11 -- independent, can parallelize
3. **Story 1.2** (Registry): T-1.2-01 through T-1.2-05 -- pure logic, fast to write
4. **Story 1.3** (Context): T-1.3-01 through T-1.3-10 -- depends on 1.0 for TOON data
5. **Story 1.4** (Verify): T-1.4-01 through T-1.4-06 -- depends on 1.0 (shallow parse)
6. **Story 1.5** (Pricing): T-1.5-01 through T-1.5-07 -- depends on 1.0 (byte length)
7. **Story 1.6** (Bridge): T-1.6-01 through T-1.6-04 -- depends on 1.2
8. **Story 1.7** (createNode): T-1.7-01 through T-1.7-13 -- depends on all above
9. **Stories 1.8-1.11**: Remaining tests

### Entry Criteria

- [ ] Architecture invariant documented: pipeline stage ordering (shallow parse -> verify -> price -> dispatch)
- [ ] @scure/bip39 and @scure/bip32 installed and verified compatible with nostr-tools
- [ ] Vitest configured in `packages/sdk/`
- [ ] `createSignedToonPayload()` test factory available (real signed events for verification tests)

### Exit Criteria

- [ ] All P0 tests passing (38 tests, 100% required)
- [ ] All P1 tests passing (22 tests, >=95% with triaged waivers)
- [ ] No high-priority risks (E1-R01 through E1-R11) unmitigated
- [ ] > 80% line coverage for SDK public APIs (NFR-SDK-3)
- [ ] Full pipeline integration test passes: TOON -> parse -> verify -> price -> dispatch -> accept/reject
- [ ] All existing BLS + relay tests pass after TOON codec extraction

### Quality Gates

| Gate                     | Threshold   | Enforcement             |
| ------------------------ | ----------- | ----------------------- |
| P0 pass rate             | 100%        | CI blocks merge         |
| P1 pass rate             | >= 95%      | CI warns, manual review |
| High-risk mitigations    | 100% tested | Code review gate        |
| Public API coverage      | > 80% line  | Vitest coverage report  |
| Pipeline ordering        | 100% branch | P0 integration test     |
| Security scenarios (SEC) | 100%        | P0 test suite           |

---

## 9. Test Data Factories

All tests should use shared factory functions for consistency and maintenance:

```typescript
// Test factory: real signed TOON payload
function createSignedToonPayload(opts?: {
  kind?: number;
  content?: string;
  secretKey?: Uint8Array;
}): { toonBytes: Uint8Array; toonString: string; event: NostrEvent };

// Test factory: tampered TOON payload (valid structure, invalid signature)
function createTamperedToonPayload(): {
  toonBytes: Uint8Array;
  toonString: string;
};

// Test factory: ILP payment request
function createPaymentRequest(
  overrides?: Partial<{
    amount: string;
    destination: string;
    data: string;
    isTransit: boolean;
  }>
): PaymentRequest;

// Test factory: node identity
function createTestIdentity(): {
  secretKey: Uint8Array;
  pubkey: string;
  evmAddress: string;
};
```

---

## 10. Relationship to Existing Test Artifacts

This plan adapts and extends `_bmad-output/test-artifacts/test-design-epic-1.md`:

| Aspect                | test-artifacts version | This version                                                                                            |
| --------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Risk count            | 12                     | 16 (added E1-R07 verify-after-decode, E1-R02 shallow parse offsets, refined others)                     |
| Test count            | 87                     | 71 (consolidated redundant tests, removed P3 import-per-API tests in favor of single import validation) |
| Pipeline tests        | 13 (P0)                | 5 focused integration + 33 supporting unit (cleaner separation)                                         |
| Performance section   | Brief note             | Detailed analysis with TOON parsing and Schnorr throughput                                              |
| Regression analysis   | Not covered            | Section 6 with 5 specific regression scenarios                                                          |
| Cross-story scenarios | Not covered            | Section 5 with 5 named end-to-end scenarios                                                             |
| Factory definitions   | Listed                 | Typed signatures provided                                                                               |

---

## Approval

- [ ] Product Manager: **_ Date: _**
- [ ] Tech Lead: **_ Date: _**
