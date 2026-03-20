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
lastSaved: '2026-03-03'
workflowType: 'testarch-atdd'
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
  - vitest.config.ts
  - packages/client/vitest.e2e.config.ts
---

# ATDD Checklist - Epic 1: ILP-Gated Service Node SDK

**Date:** 2026-03-03
**Author:** Jonathan
**Primary Test Level:** Unit + Integration (prefer real local infra over mocks)

---

## Preflight Summary

**Detected Stack:** backend (Node.js/TypeScript, Vitest, ESM)
**Test Framework:** Vitest ^1.0.0 (globals enabled, node environment)
**Test Pattern:** `packages/*/src/**/*.test.ts` (co-located with source)
**Testing Philosophy:** Avoid mocks when possible. Use local infrastructure (Anvil, relay, connector, faucet) for integration-level testing. Only mock where absolutely necessary.

### Stories in Scope

| Story | Title                                                | Test Level                | Priority |
| ----- | ---------------------------------------------------- | ------------------------- | -------- |
| 1.0   | Extract TOON Codec to @toon-protocol/core                | Unit                      | P1       |
| 1.1   | Unified Identity from Seed Phrase                    | Unit                      | P0       |
| 1.2   | Handler Registry with Kind-Based Routing             | Unit                      | P0       |
| 1.3   | HandlerContext with TOON Passthrough and Lazy Decode | Unit                      | P0       |
| 1.4   | Schnorr Signature Verification Pipeline              | Unit (real crypto)        | P0       |
| 1.5   | Pricing Validation with Self-Write Bypass            | Unit                      | P0       |
| 1.6   | PaymentHandler Bridge with Transit Semantics         | Unit                      | P1       |
| 1.7   | createNode() Composition with Lifecycle              | Integration               | P0       |
| 1.8   | Connector Direct Methods API                         | Unit                      | P2       |
| 1.9   | Network Discovery and Bootstrap Integration          | Integration (local infra) | P1       |
| 1.10  | Dev Mode                                             | Unit                      | P2       |
| 1.11  | Package Setup and npm Publish                        | Unit                      | P3       |

### Knowledge Base References

- data-factories.md — Factory patterns with overrides
- test-quality.md — Deterministic, isolated, explicit, focused, fast
- test-healing-patterns.md — Common failure patterns and fixes
- test-levels-framework.md — Unit vs integration vs E2E selection
- test-priorities-matrix.md — P0-P3 prioritization

## Generation Mode

**Mode:** AI Generation (backend stack — no browser recording)
**Rationale:** Backend project with clear acceptance criteria. Tests generated from story ACs, source code analysis, and project patterns. Real cryptographic libraries (nostr-tools, @scure/\*) used instead of mocks. Local infrastructure preferred for integration tests.

---

## Test Strategy

### Test Level Selection (Backend Stack)

- **Unit** for pure functions, business logic, crypto operations, edge cases
- **Integration** for service composition, connector interactions, network bootstrap
- **No E2E browser tests** (backend only)
- **Philosophy:** Use real crypto libraries (nostr-tools, @scure/bip39, @scure/bip32, viem) instead of mocking them

### Acceptance Criteria → Test Scenarios

#### Story 1.0: Extract TOON Codec (P1, 8 tests)

| AC                    | Scenario                                                  | Level |
| --------------------- | --------------------------------------------------------- | ----- |
| Encoder in core/toon  | Round-trip: encode event → TOON → decode → match (kind:1) | Unit  |
| Encoder in core/toon  | Round-trip: kind:10032 ILP Peer Info event                | Unit  |
| Encoder in core/toon  | Round-trip: special characters and unicode                | Unit  |
| Shallow parse         | shallowParseToon → {kind, pubkey, id, sig, rawBytes}      | Unit  |
| Shallow parse         | rawBytes equal original encoded bytes                     | Unit  |
| Re-exports from index | encodeEventToToon re-exported                             | Unit  |
| Re-exports from index | decodeEventFromToon re-exported                           | Unit  |
| Re-exports from index | shallowParseToon re-exported                              | Unit  |

#### Story 1.1: Unified Identity (P0, 11 tests)

| AC                            | Scenario                                               | Level              |
| ----------------------------- | ------------------------------------------------------ | ------------------ |
| generateMnemonic() valid      | Generated mnemonic passes BIP-39 validation (12 words) | Unit (real crypto) |
| generateMnemonic() valid      | Different mnemonics on successive calls                | Unit (real crypto) |
| fromMnemonic() at NIP-06 path | Known test vector → known secretKey                    | Unit (real crypto) |
| fromMnemonic() at NIP-06 path | Pubkey is 64 lowercase hex characters                  | Unit (real crypto) |
| fromMnemonic() at NIP-06 path | evmAddress is 0x + 40 hex                              | Unit (real crypto) |
| fromMnemonic() at NIP-06 path | Correct x-only pubkey from test vector                 | Unit (real crypto) |
| accountIndex parameter        | Index 0 ≠ index 3                                      | Unit (real crypto) |
| accountIndex parameter        | Default accountIndex is 0                              | Unit (real crypto) |
| fromSecretKey() derives both  | Known key → pubkey + evmAddress                        | Unit (real crypto) |
| fromSecretKey() derives both  | Consistent results across calls                        | Unit (real crypto) |
| fromSecretKey() derives both  | Matches fromMnemonic for same derived key              | Unit (real crypto) |

#### Story 1.2: Handler Registry (P0, 5 tests)

| AC                       | Scenario                                      | Level |
| ------------------------ | --------------------------------------------- | ----- |
| .on(kind) dispatches     | Register → dispatch → handler called          | Unit  |
| Multiple kinds           | 2 kinds registered, each dispatched correctly | Unit  |
| .onDefault() fallback    | Unknown kind → default handler                | Unit  |
| No handler → F00         | Unknown kind, no default → F00 reject         | Unit  |
| Duplicate .on() replaces | Second registration replaces first            | Unit  |

#### Story 1.3: HandlerContext (P0, 7 tests)

| AC                            | Scenario                           | Level |
| ----------------------------- | ---------------------------------- | ----- |
| ctx.toon = raw TOON           | Access toon → no decode triggered  | Unit  |
| ctx.kind from shallow parse   | Matches event kind                 | Unit  |
| ctx.pubkey from shallow parse | Matches event pubkey               | Unit  |
| ctx.amount as bigint          | Reflects ILP amount                | Unit  |
| ctx.decode() lazy + cached    | Second call === first call         | Unit  |
| ctx.accept(data?)             | Formats HandlePacketAcceptResponse | Unit  |
| ctx.reject(code, msg)         | Formats HandlePacketRejectResponse | Unit  |

#### Story 1.4: Signature Verification (P0, 4 tests)

| AC                          | Scenario                                      | Level              |
| --------------------------- | --------------------------------------------- | ------------------ |
| Valid sig → dispatched      | Real signed event with nostr-tools            | Unit (real crypto) |
| Invalid sig → F06           | Tampered event → F06 rejection                | Unit (real crypto) |
| devMode → skip verification | Invalid sig + devMode → verified              | Unit               |
| Uses shallow parse only     | id, pubkey, sig extracted without full decode | Unit               |

#### Story 1.5: Pricing Validation (P0, 6 tests)

| AC                      | Scenario                                 | Level |
| ----------------------- | ---------------------------------------- | ----- |
| Underpaid → F04         | amount < required → reject with metadata | Unit  |
| kindPricing override    | kind 23194 → 0n (free)                   | Unit  |
| Self-write bypass       | Own pubkey → pricing skipped             | Unit  |
| Default 10n             | No config → basePricePerByte: 10n        | Unit  |
| Overpaid accepted       | amount > required → pass                 | Unit  |
| Exactly-priced accepted | amount = required → pass                 | Unit  |

#### Story 1.6: PaymentHandler Bridge (P1, 3 tests)

| AC                               | Scenario                               | Level |
| -------------------------------- | -------------------------------------- | ----- |
| isTransit=true → fire-and-forget | Bridge returns before handler resolves | Unit  |
| isTransit=false → await          | Handler result flows back              | Unit  |
| Exception → T00                  | Handler throws → T00 internal error    | Unit  |

#### Story 1.7: createNode() Composition (P0, 13 tests)

| AC                               | Scenario                                         | Level       |
| -------------------------------- | ------------------------------------------------ | ----------- |
| createNode() returns ServiceNode | Config → wired node with start/stop              | Integration |
| node.pubkey                      | x-only public key derived from secretKey         | Integration |
| node.evmAddress                  | EVM address derived from secp256k1 key           | Integration |
| start() wires handler            | setPacketHandler called, returns StartResult     | Integration |
| Double start() throws            | Second call → NodeError                          | Integration |
| stop() cleans up                 | Idempotent, no-op on second call                 | Integration |
| Full pipeline accept             | Signed TOON → verify → price → dispatch → accept | Integration |
| Pipeline rejects invalid sig     | Tampered TOON → F06                              | Integration |
| Pipeline rejects underpaid       | Underpaid amount → F04 with metadata             | Integration |
| Self-write bypass                | Node's own pubkey → skip pricing                 | Integration |
| No handler → F00                 | Unregistered kind → F00                          | Integration |
| Default handler catches          | onDefault receives unmatched kinds               | Integration |
| Handler exception → T00          | Throwing handler → T00                           | Integration |

#### Story 1.8: Connector Direct Methods (P2, 4 tests)

| AC                                   | Scenario                   | Level |
| ------------------------------------ | -------------------------- | ----- |
| node.connector exposes registerPeer  | Method callable            | Unit  |
| node.connector exposes removePeer    | Method callable            | Unit  |
| channelClient null without support   | Old connector → null       | Unit  |
| channelClient available with support | Channel methods → non-null | Unit  |

#### Story 1.9: Network Discovery (P1, 8 tests)

| AC                                   | Scenario                                         | Level       |
| ------------------------------------ | ------------------------------------------------ | ----------- |
| Bootstrap runs layered discovery     | start() → peers discovered (requires infra)      | Integration |
| RelayMonitor detects kind:10032      | Historical events → peer discovery               | Integration |
| Channels opened on overlap           | Settlement negotiation succeeds (requires Anvil) | Integration |
| node.peerWith(pubkey)                | Manual peer → register + handshake               | Integration |
| Bootstrap lifecycle events           | on('bootstrap', listener) receives events        | Integration |
| Bootstrap with no peers              | Completes with 0 peers                           | Integration |
| peer-discovered includes ILP address | kind:10032 ILP address parsed                    | Integration |
| Start/stop/start lifecycle           | Multiple cycles work                             | Integration |

#### Story 1.10: Dev Mode (P2, 5 tests)

| AC                           | Scenario                         | Level |
| ---------------------------- | -------------------------------- | ----- |
| Skips verification           | Invalid sig accepted in devMode  | Unit  |
| Logs packets                 | Debug output emitted to console  | Unit  |
| Bypasses pricing             | Zero payment accepted in devMode | Unit  |
| Production rejects sig       | No devMode → F06 rejection       | Unit  |
| Production rejects underpaid | No devMode → F04 rejection       | Unit  |

#### Story 1.11: Package Setup (P3, 9 tests)

| AC                                          | Scenario            | Level |
| ------------------------------------------- | ------------------- | ----- |
| index.ts exports createNode                 | Import verification | Unit  |
| index.ts exports generateMnemonic           | Import verification | Unit  |
| index.ts exports fromMnemonic               | Import verification | Unit  |
| index.ts exports fromSecretKey              | Import verification | Unit  |
| index.ts exports createHandlerContext       | Import verification | Unit  |
| index.ts exports HandlerRegistry            | Import verification | Unit  |
| index.ts exports createVerificationPipeline | Import verification | Unit  |
| index.ts exports createPricingValidator     | Import verification | Unit  |
| index.ts exports createPaymentHandlerBridge | Import verification | Unit  |

---

## Generated Test Files

### Unit Tests (62 tests across 10 files)

| #   | File                                              | Tests | Priority Coverage   |
| --- | ------------------------------------------------- | ----- | ------------------- |
| 1   | `packages/core/src/toon/toon-codec.test.ts`       | 8     | P0: 6, P1: 2        |
| 2   | `packages/sdk/src/identity.test.ts`               | 11    | P0: 7, P1: 4        |
| 3   | `packages/sdk/src/handler-registry.test.ts`       | 5     | P0: 4, P1: 1        |
| 4   | `packages/sdk/src/handler-context.test.ts`        | 7     | P0: 6, P1: 1        |
| 5   | `packages/sdk/src/verification-pipeline.test.ts`  | 4     | P0: 3, P1: 1        |
| 6   | `packages/sdk/src/pricing-validator.test.ts`      | 6     | P0: 4, P1: 2        |
| 7   | `packages/sdk/src/payment-handler-bridge.test.ts` | 3     | P0: 3               |
| 8   | `packages/sdk/src/connector-api.test.ts`          | 4     | P0: 2, P1: 2        |
| 9   | `packages/sdk/src/dev-mode.test.ts`               | 5     | P0: 4, P1: 1        |
| 10  | `packages/sdk/src/index.test.ts`                  | 9     | P0: 4, P1: 4, P2: 1 |

### Integration Tests (21 tests across 2 files)

| #   | File                                                         | Tests | Priority Coverage   |
| --- | ------------------------------------------------------------ | ----- | ------------------- |
| 11  | `packages/sdk/src/__integration__/create-node.test.ts`       | 13    | P0: 5, P1: 5, P2: 3 |
| 12  | `packages/sdk/src/__integration__/network-discovery.test.ts` | 8     | P0: 3, P1: 3, P2: 2 |

### Aggregated Metrics

| Metric            | Count  |
| ----------------- | ------ |
| Unit tests        | 62     |
| Integration tests | 21     |
| **Total**         | **83** |
| Test files        | 12     |
| P0 tests          | 51     |
| P1 tests          | 27     |
| P2 tests          | 5      |

### Data Factories (Inline)

Tests use inline factory functions (no external factory files) following the project's existing pattern:

- `createTestEvent()` — NostrEvent fixture with overrides
- `createMockContext()` — HandlerContext mock with overrides
- `createMockMeta()` — ToonRoutingMeta fixture with overrides
- `createDecodedEvent()` — Decoded NostrEvent fixture
- `createSignedToonPayload()` — Real signed TOON using nostr-tools (no mocks)
- `createTamperedToonPayload()` — Tampered signature TOON
- `createMockRegistry()` — HandlerRegistry mock
- `createPaymentRequest()` — PaymentRequest fixture
- `createMockConnector()` — Connector mock for unit tests
- `MockEmbeddedConnector` — Full connector implementation for integration tests
- `createSignedToonEvent()` — Real signed event encoded to TOON for integration tests

### Mock Requirements

Minimal mocking used (per testing philosophy):

- `HandlerRegistry.dispatch` — mocked only in bridge/dev-mode unit tests
- `console.log` — spied in dev-mode logging test
- `MockEmbeddedConnector` — lightweight in-process connector for integration tests (not a real connector mock — implements the actual interface)

Real crypto libraries used throughout:

- `nostr-tools/pure` — generateSecretKey, getPublicKey, finalizeEvent
- `@scure/bip39` — validateMnemonic
- `@toon-protocol/core/toon` (once implemented) — encodeEventToToon, decodeEventFromToon, shallowParseToon

---

## TDD Red Phase Compliance

All 83 tests use `it.skip()` — they are designed to fail before SDK implementation:

- Primary failure mode: `packages/sdk/src/*.js` modules do not exist
- Secondary failure mode: `packages/core/src/toon/index.js` does not exist
- No placeholder assertions (no `expect(true).toBe(false)`)
- All tests follow Arrange/Act/Assert pattern with meaningful assertions

---

## Implementation Checklist

### RED Phase (Complete)

All acceptance tests written and verified to be in RED (skipped) state.

### GREEN Phase (For DEV team)

Implementation order follows dependency graph:

1. **Story 1.0** — Extract TOON Codec to `packages/core/src/toon/`
   - Create `encodeEventToToon()`, `decodeEventFromToon()`, `shallowParseToon()`
   - Export `ToonRoutingMeta` type
   - Update BLS imports
   - Run: `npx vitest packages/core/src/toon/toon-codec.test.ts`

2. **Story 1.1** — Unified Identity in `packages/sdk/src/identity.ts`
   - Create `generateMnemonic()`, `fromMnemonic()`, `fromSecretKey()`
   - NIP-06 path derivation, EVM address from secp256k1
   - Run: `npx vitest packages/sdk/src/identity.test.ts`

3. **Story 1.2** — Handler Registry in `packages/sdk/src/handler-registry.ts`
   - Create `HandlerRegistry` class with `.on()`, `.onDefault()`, `.dispatch()`
   - Run: `npx vitest packages/sdk/src/handler-registry.test.ts`

4. **Story 1.3** — HandlerContext in `packages/sdk/src/handler-context.ts`
   - Create `createHandlerContext()` with lazy decode, accept/reject helpers
   - Run: `npx vitest packages/sdk/src/handler-context.test.ts`

5. **Story 1.4** — Verification Pipeline in `packages/sdk/src/verification-pipeline.ts`
   - Create `createVerificationPipeline()` with Schnorr verification
   - Run: `npx vitest packages/sdk/src/verification-pipeline.test.ts`

6. **Story 1.5** — Pricing Validator in `packages/sdk/src/pricing-validator.ts`
   - Create `createPricingValidator()` with self-write bypass
   - Run: `npx vitest packages/sdk/src/pricing-validator.test.ts`

7. **Story 1.6** — PaymentHandler Bridge in `packages/sdk/src/payment-handler-bridge.ts`
   - Create `createPaymentHandlerBridge()` with transit semantics
   - Run: `npx vitest packages/sdk/src/payment-handler-bridge.test.ts`

8. **Story 1.7** — createNode() in `packages/sdk/src/node.ts`
   - Create `createNode()`, `ServiceNode`, `NodeError`, `StartResult`
   - Wire all pipelines together
   - Run: `npx vitest packages/sdk/src/__integration__/create-node.test.ts`

9. **Story 1.8** — Connector API (exposed through node)
   - Run: `npx vitest packages/sdk/src/connector-api.test.ts`

10. **Story 1.10** — Dev Mode
    - Run: `npx vitest packages/sdk/src/dev-mode.test.ts`

11. **Story 1.11** — Package exports in `packages/sdk/src/index.ts`
    - Run: `npx vitest packages/sdk/src/index.test.ts`

12. **Story 1.9** — Network Discovery (requires local infrastructure)
    - Run: `npx vitest packages/sdk/src/__integration__/network-discovery.test.ts`

### REFACTOR Phase

After GREEN, refactor:

- Extract shared types to `packages/sdk/src/types.ts`
- Consolidate error codes into `packages/sdk/src/errors.ts`
- Review integration test timeouts for CI stability

---

## Execution Commands

```bash
# Run all SDK unit tests
npx vitest packages/sdk/src/*.test.ts packages/core/src/toon/*.test.ts

# Run all SDK integration tests
npx vitest packages/sdk/src/__integration__/*.test.ts

# Run specific test file
npx vitest packages/sdk/src/identity.test.ts

# Run with verbose output
npx vitest --reporter=verbose packages/sdk/src/

# Run only P0 tests (grep pattern)
npx vitest -t "\[P0\]" packages/sdk/src/
```

---

## Key Risks and Assumptions

1. **TOON Codec dependency**: Stories 1.4+ depend on Story 1.0 (TOON codec in @toon-protocol/core). Must be implemented first.
2. **Integration test infrastructure**: Network Discovery tests (Story 1.9) require running genesis node. Tests skip gracefully when infra is unavailable.
3. **Type definitions**: Tests import types that don't exist yet (`EmbeddableConnectorLike`, `HandlePacketRequest`, etc.). These must be defined in `@toon-protocol/core` or `@toon-protocol/sdk`.
4. **NIP-06 test vector**: The `abandon` mnemonic test vector is from the Nostr ecosystem. The expected private key `7f7ff03d...` should be verified against NIP-06 reference implementations.

---

## Next Recommended Workflow

- **Immediate**: `bmad-bmm-dev-story` to implement stories 1.0 → 1.11 in dependency order
- **After GREEN**: `bmad-tea-testarch-automate` to expand coverage and assess CI readiness
- **After all stories**: `bmad-tea-testarch-trace` for traceability matrix and quality gate
