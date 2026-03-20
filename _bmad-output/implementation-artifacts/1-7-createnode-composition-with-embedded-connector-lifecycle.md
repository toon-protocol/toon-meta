# Story 1.7: createNode() Composition with Embedded Connector Lifecycle

Status: done

## Story

As a **service developer**,
I want to call `createNode(config)` and get a fully wired node with `start()` and `stop()` lifecycle methods,
So that I don't manually wire connector, handlers, verification, pricing, and bootstrap together.

**FRs covered:** FR-SDK-1 (createNode composition), FR-SDK-10 (start/stop lifecycle), FR-SDK-11 (embedded connector mode with setPacketHandler)

## Acceptance Criteria

1. Given a valid `NodeConfig` with `secretKey`, `connector`, and at least one handler (via `handlers` map or post-creation `.on()` calls), when I call `createNode(config)`, then a `ServiceNode` is returned with the handler registry wired to the connector's PacketHandler via the PaymentHandler bridge, and the verification and pricing pipelines are inserted before handler dispatch, and `node.pubkey` returns the Nostr x-only public key, and `node.evmAddress` returns the derived EVM address
2. Given a created node, when I call `node.start()`, then the connector's `setPacketHandler()` is called with the SDK's bridge, and bootstrap runs (peer discovery, registration, handshakes), and the relay monitor starts watching for new peers, and a `StartResult` is returned with `{ peerCount, channelCount, bootstrapResults }`
3. Given a started node, when I call `node.stop()`, then the relay monitor subscription is unsubscribed, and lifecycle state is cleaned up, and calling `stop()` again is a no-op
4. Given `node.start()` is called twice without stopping, when the second `start()` executes, then it throws a `NodeError` with message indicating already started
5. Given the full pipeline is wired, when an ILP packet arrives, then the processing order is strictly: shallow TOON parse -> Schnorr signature verification -> pricing validation -> handler dispatch (this is the highest-priority correctness invariant in Epic 1)
6. Given a `NodeConfig` with no explicit `basePricePerByte` or `devMode`, when `createNode(config)` is called, then `basePricePerByte` defaults to `10n` and `devMode` defaults to `false`
7. Given a `NodeConfig` with `handlers: { 1: myHandler }` and/or `defaultHandler: myFallback`, when `createNode(config)` is called, then the handlers are pre-registered in the internal `HandlerRegistry` before the node is returned (config-based registration as an alternative to `.on()`)

## Tasks / Subtasks

- [x] Task 1: Create `packages/sdk/src/create-node.ts` with `createNode()` function and `NodeConfig`/`ServiceNode` types (AC: #1, #5, #6, #7)
  - [x] Define `NodeConfig` interface with fields: `secretKey: Uint8Array`, `connector` (structural type matching `EmbeddableConnectorLike` from `@toon-protocol/core`), `basePricePerByte?: bigint`, `devMode?: boolean`, `toonEncoder?`, `toonDecoder?`, `knownPeers?`, `relayUrl?`, `settlementInfo?`, `ardriveEnabled?`, `settlementNegotiationConfig?`, `kindPricing?: Record<number, bigint>`, `handlers?: Record<number, Handler>` (config-based handler registration), `defaultHandler?: Handler` (config-based default handler)
  - [x] **NOTE on `ilpAddress`, `assetCode`, `assetScale`:** The existing ATDD integration test (`__integration__/create-node.test.ts`) does NOT pass these fields in NodeConfig. Review whether these should be optional with defaults (e.g., `ilpAddress` defaults to empty string, `assetCode` defaults to `'USD'`, `assetScale` defaults to `6`) or required. The `connector-api.test.ts` helper `createTestConfig()` DOES include them. Choose one approach and align both test files.
  - [x] Define `ServiceNode` interface with: `pubkey: string`, `evmAddress: string`, `connector` (pass-through), `channelClient` (null or channel methods), `on(kind, handler): this`, `onDefault(handler): this`, `on(event, listener)` for lifecycle events, `start(): Promise<StartResult>`, `stop(): Promise<void>`
  - [x] Define `StartResult` interface: `{ peerCount: number, channelCount: number, bootstrapResults: BootstrapResult[] }`
  - [x] Implement `createNode(config)`:
    1. Derive identity from `secretKey` using `fromSecretKey()` -> get `pubkey` and `evmAddress`
    2. Create `HandlerRegistry` instance
    3. If `config.handlers` is provided, iterate entries and call `registry.on(kind, handler)` for each
    4. If `config.defaultHandler` is provided, call `registry.onDefault(config.defaultHandler)`
    5. Create verification pipeline via `createVerificationPipeline({ devMode: config.devMode ?? false })`
    6. Create pricing validator via `createPricingValidator({ basePricePerByte: config.basePricePerByte ?? 10n, ownPubkey: pubkey, kindPricing: config.kindPricing })`
    7. Wire the full pipeline: the bridge's registry dispatch is wrapped so that BEFORE dispatch, the pipeline runs shallow TOON parse -> verify -> price. Only if all pass does dispatch proceed.
    8. Create `PaymentHandlerBridge` that composes the full pipeline
    9. Create `ToonNode` from `@toon-protocol/core/compose` for bootstrap/relay monitor lifecycle (pass the bridge's `handlePayment` as the `handlePacket` callback)
    10. Return `ServiceNode` object

- [x] Task 2: Wire the processing pipeline in correct order (AC: #5) -- CRITICAL
  - [x] The pipeline MUST execute in this exact order for every incoming packet:
    1. `shallowParseToon(toonBytes)` -> extract `ToonRoutingMeta` (kind, pubkey, id, sig, rawBytes)
    2. `verificationPipeline.verify(meta, toonData)` -> reject with F06 if invalid (unless devMode)
    3. `pricingValidator.validate(meta, amount)` -> reject with F04 if underpaid (unless self-write)
    4. `registry.dispatch(ctx)` -> route to handler by kind
  - [x] The bridge from Story 1.6 currently constructs a placeholder `HandlerContext` with empty metadata. In this story, the bridge must be enhanced (or a wrapper must be composed around it) so that the REAL `ToonRoutingMeta` from shallow parse is used for context construction
  - [x] The `toonDecoder` callback passed to `createHandlerContext` must use the real TOON decoder (from `@toon-protocol/core/toon` or config)

- [x] Task 3: Implement `start()` and `stop()` lifecycle (AC: #2, #3, #4)
  - [x] `start()` must: call `connector.setPacketHandler(bridge.handlePayment)` if connector has that method, run bootstrap via `ToonNode.start()`, start relay monitor, return `StartResult`
  - [x] `stop()` must: unsubscribe relay monitor, clean up lifecycle state, be idempotent (second call is no-op)
  - [x] Double `start()` must throw `NodeError` (not `BootstrapError` -- use SDK-specific error)

- [x] Task 4: Update vitest.config.ts and enable ATDD tests (AC: #1-#7)
  - [x] In `packages/sdk/src/index.test.ts`, remove `.skip` from the `[P0] exports createNode function` test. Also remove `.skip` from any other export tests whose implementations already exist (generateMnemonic, fromMnemonic, fromSecretKey, HandlerRegistry, createHandlerContext, createVerificationPipeline, createPricingValidator, createPaymentHandlerBridge). Remove or update the `@ts-nocheck` pragma if all imports now resolve. Update the stale ATDD Red Phase comment.
  - [x] **Do NOT unskip `connector-api.test.ts` tests.** These 4 tests are Story 1.8 scope (connector direct methods API). While they import `createNode`, they test node.connector pass-through behavior which is 1.8's responsibility. Leave `.skip` and `@ts-nocheck` intact. Note: Story 1.8 should enable these tests.
  - [x] **Do NOT unskip `dev-mode.test.ts`** -- that belongs to Story 1.10.
  - [x] Update vitest.config.ts ATDD comments to reflect Story 1.7 status: add comment `//   connector-api.test.ts    -> Story 1.8 (uses createNode, available after 1.7)` for clarity.

- [x] Task 5: Enable existing ATDD integration tests and add spy-instrumented pipeline ordering test (AC: #5) -- CRITICAL
  - [x] The `__integration__/` directory and `__integration__/create-node.test.ts` ALREADY EXIST with 12 skipped tests covering: composition, pubkey, evmAddress, start/stop lifecycle, full pipeline happy path, invalid sig F06, underpaid F04, self-write bypass, F00 no handler, default handler, and T00 exception.
  - [x] Remove `.skip` from all tests in `__integration__/create-node.test.ts`. Remove `@ts-nocheck` pragma. Update the stale ATDD Red Phase comment.
  - [x] **NOTE:** The existing integration tests use `handlers: {}` and `defaultHandler` in NodeConfig for config-based registration. The `createNode()` implementation MUST support these fields (see Task 1).
  - [x] **NOTE:** The existing integration tests do NOT pass `ilpAddress`, `assetCode`, or `assetScale` in NodeConfig. Either make these optional with sensible defaults or update the tests to include them.
  - [x] **NOTE:** The `__integration__/**` glob is already in vitest.config.ts excludes. Integration tests must be run with a separate vitest invocation: `cd packages/sdk && pnpm vitest run src/__integration__/` or via a separate vitest config. Add a `test:integration` script to `packages/sdk/package.json` if one does not exist.
  - [x] **NEW:** Add a dedicated spy-instrumented pipeline ordering test (T-1.7-01) to `__integration__/create-node.test.ts` that wraps each pipeline stage with a call-order tracker and asserts the exact sequence: shallow parse -> verify -> price -> dispatch. This is the highest-value test in Epic 1.
  - [x] Do NOT create a separate `full-pipeline.test.ts` -- the existing `create-node.test.ts` already covers pipeline scenarios. Consolidate into one file.
  - [x] **Mapping of existing ATDD tests to test design IDs:**
    - Existing test `[P0] createNode(config) returns ServiceNode with handler registry wired to connector` -- covers T-1.7-06 partially (composition verification)
    - Existing test `[P0] node.pubkey returns the x-only public key derived from secretKey` -- covers T-1.7-11
    - Existing test `[P0] node.evmAddress returns EVM address derived from same secp256k1 key` -- covers T-1.7-12
    - Existing test `[P0] node.start() wires packet handler and returns StartResult` -- covers T-1.7-06, T-1.7-07
    - Existing test `[P0] calling start() twice throws NodeError` -- covers T-1.7-10
    - Existing test `[P1] node.stop() cleans up and is idempotent` -- covers T-1.7-08, T-1.7-09
    - Existing test `[P1] full pipeline: signed TOON event dispatches to kind handler and accepts` -- covers T-1.7-04
    - Existing test `[P1] pipeline rejects event with invalid signature (F06)` -- covers T-1.7-02
    - Existing test `[P1] pipeline rejects underpaid event with F04 (insufficient amount)` -- covers T-1.7-03
    - Existing test `[P1] self-write bypass: events from node own pubkey skip pricing validation` -- covers T-1.7-05
    - Existing test `[P2] event with unregistered kind and no default handler returns F00` -- NEW (not in test design, bonus coverage)
    - Existing test `[P2] onDefault handler receives events with no kind-specific handler` -- NEW (bonus coverage)
    - Existing test `[P2] handler throwing unhandled exception returns T00 (internal error)` -- NEW (bonus coverage)
  - [x] **NEW test to add** (T-1.7-01, the spy-instrumented ordering test, does NOT exist yet in any ATDD file):
    ```typescript
    it('[P0] pipeline executes in exact order: shallow parse -> verify -> price -> dispatch', async () => {
      // Use spy wrappers to record invocation order of each stage
      // Assert order is: [1] shallow parse, [2] verify, [3] price, [4] dispatch
      // This is the most critical test in Epic 1 (Risk E1-R11, score 9)
    });
    ```

- [x] Task 6: Add unit tests for defaults and config-based registration (AC: #6, #7)
  - [x] Create `packages/sdk/src/create-node.test.ts` with co-located unit tests that use mocked `ToonNode` (no real bootstrap/relay)
  - [x] Test: createNode with minimal config uses defaults (basePricePerByte=10n, devMode=false) (T-1.7-13)
  - [x] Test: createNode with `handlers: { 1: handler }` pre-registers the handler (AC: #7)
  - [x] Test: createNode with `defaultHandler: handler` pre-registers the default handler (AC: #7)
  - [x] Test: `.on(kind, handler)` returns `this` for builder pattern chaining
  - [x] Test: `.onDefault(handler)` returns `this` for builder pattern chaining
  - [x] Test: `node.pubkey` returns correct x-only public key (T-1.7-11 -- lightweight unit test)
  - [x] Test: `node.evmAddress` returns correct EVM address (T-1.7-12 -- lightweight unit test)
  - [x] Test: `node.connector` is pass-through of config.connector
  - [x] **NOTE:** T-1.7-06 through T-1.7-10 are already covered by the existing ATDD integration tests in `__integration__/create-node.test.ts`. No need to duplicate as unit tests unless a mock-based version adds value (developer discretion).

- [x] Task 7: Export `createNode`, `NodeConfig`, `ServiceNode`, `StartResult` from index.ts (AC: #1, #7)
  - [x] Add exports to `packages/sdk/src/index.ts`: `export { createNode } from './create-node.js'` and `export type { NodeConfig, ServiceNode, StartResult } from './create-node.js'`
  - [x] Verify `index.test.ts` `createNode` export test passes

- [x] Task 8: Run tests and verify no regressions (AC: #1-#7)
  - [x] Run `cd packages/sdk && pnpm test` -- all unit tests pass (create-node.test.ts, index.test.ts, and all existing tests)
  - [x] Run `cd packages/sdk && pnpm vitest run src/__integration__/create-node.test.ts` -- all integration tests pass (16 total: 13 existing + 3 new: T-1.7-01 spy-instrumented, default basePricePerByte, default devMode)
  - [x] Run `pnpm -r test` from project root -- no regressions in any package
  - [x] Expected SDK unit test count: 72 (from Story 1.6) + ~9 (unskipped index.test.ts exports) + ~8 (new create-node.test.ts unit tests) = ~89 unit tests (actual: 96)
  - [x] Expected integration test count: 16 (13 existing + 3 new: T-1.7-01 spy-instrumented, default basePricePerByte, default devMode)

## Dev Notes

### What Already Exists

**Source files (all in `packages/sdk/src/`):**

- **`identity.ts`** -- `fromSecretKey(key: Uint8Array): NodeIdentity` returning `{ secretKey, pubkey, evmAddress }`. Use this to derive identity from config.secretKey.
- **`handler-registry.ts`** -- `HandlerRegistry` class with `.on(kind, handler): this`, `.onDefault(handler): this`, `.dispatch(ctx): Promise<{accept: boolean, ...}>`.
- **`handler-context.ts`** -- `createHandlerContext(options: CreateHandlerContextOptions): HandlerContext`. Options: `{ toon, meta: ToonRoutingMeta, amount, destination, toonDecoder }`.
- **`verification-pipeline.ts`** -- `createVerificationPipeline({ devMode }): { verify(meta, toonData): Promise<VerificationResult> }`. Returns `{ verified: boolean, rejection?: {accept: false, code: 'F06', message} }`.
- **`pricing-validator.ts`** -- `createPricingValidator({ basePricePerByte?, ownPubkey, kindPricing? }): { validate(meta, amount): PricingValidationResult }`. Returns `{ accepted: boolean, rejection?: {accept: false, code: 'F04', message, metadata} }`.
- **`payment-handler-bridge.ts`** -- `createPaymentHandlerBridge({ registry, devMode, ownPubkey, basePricePerByte }): { handlePayment(request: PaymentRequest): Promise<PaymentResponse> }`. Currently constructs a placeholder `HandlerContext` with empty ToonRoutingMeta. The bridge handles isTransit semantics and T00 error boundary.
- **`errors.ts`** -- `NodeError extends ToonError`. Use for lifecycle errors (double start).

**Test files (all `.skip`ped, ATDD Red Phase):**

- **`connector-api.test.ts`** -- 4 tests importing `createNode` and `NodeConfig` from `./index.js`. Tests: `node.connector.registerPeer` exists, `node.connector.removePeer` exists, `node.channelClient` null without channel support, `node.channelClient` non-null with channel methods. Uses `createTestConfig()` helper returning `{ secretKey, connector, ilpAddress, assetCode, assetScale }`. **Scope: Story 1.8. Do NOT enable in Story 1.7.**
- **`index.test.ts`** -- 9 `.skip`ped export tests. The `createNode` test is Story 1.7 scope. The other 8 tests (generateMnemonic, fromMnemonic, fromSecretKey, HandlerContext, HandlerRegistry, createVerificationPipeline, createPricingValidator, createPaymentHandlerBridge) test exports that already exist and should also be unskipped in this story.
- **`__integration__/create-node.test.ts`** -- 12 `.skip`ped integration tests covering composition, lifecycle, and full pipeline scenarios. Uses `MockEmbeddedConnector` class, `createSignedToonEvent()` helper, and real TOON codec from `@toon-protocol/relay`. Imports from `@toon-protocol/core` for `EmbeddableConnectorLike`, `HandlePacketRequest`, `HandlePacketResponse`. **NOTE:** Uses `handlers: {}` and `defaultHandler` config fields in NodeConfig -- these MUST be supported by the implementation.
- **`__integration__/network-discovery.test.ts`** -- Integration tests for Story 1.9 scope. Do NOT enable in Story 1.7.

**Existing composition pattern in `@toon-protocol/core`:**

- **`packages/core/src/compose.ts`** -- `createToonNode(config: ToonNodeConfig): ToonNode`. This is the existing lower-level composition. The SDK's `createNode()` should use this internally for bootstrap/relay monitor lifecycle, wrapping it with the handler registry + verification + pricing pipeline layer.
- `ToonNodeConfig` requires: `connector` (EmbeddableConnectorLike), `handlePacket` (PacketHandler), `secretKey`, `ilpInfo`, `toonEncoder`, `toonDecoder`, plus optional bootstrap config.
- `ToonNode` provides: `start()`, `stop()`, `bootstrapService`, `relayMonitor`, `channelClient`, `peerWith()`.

**TOON modules in `@toon-protocol/core/toon`:**

- `shallowParseToon(data: Uint8Array): ToonRoutingMeta` -- extracts `{ kind, pubkey, id, sig, rawBytes }` without full decode
- `decodeEventFromToon(bytes: Uint8Array): NostrEvent` -- full TOON to NostrEvent decode
- `encodeEventToToon(event: NostrEvent): Uint8Array` -- NostrEvent to TOON bytes
- `encodeEventToToonString(event: NostrEvent): string` -- NostrEvent to TOON string

### Architecture: Pipeline Composition Strategy

The current `payment-handler-bridge.ts` constructs a placeholder `HandlerContext` with empty `ToonRoutingMeta`. For Story 1.7, the bridge must receive a REAL `ToonRoutingMeta` from shallow parse.

**IMPORTANT TYPE MISMATCH:** The connector's `setPacketHandler()` accepts `(request: HandlePacketRequest) => HandlePacketResponse | Promise<HandlePacketResponse>` (from `@toon-protocol/core/compose`). The bridge's `handlePayment()` accepts `PaymentRequest` (from `payment-handler-bridge.ts`). These are different types:
- `HandlePacketRequest` has: `amount`, `destination`, `data`, `sourceAccount?` -- **no `isTransit`, no `paymentId`**
- `PaymentRequest` has: `paymentId`, `destination`, `amount`, `data`, `isTransit`

The pipeline handler passed to `connector.setPacketHandler()` receives `HandlePacketRequest`. The pipeline must either:
- (a) Bypass the PaymentHandlerBridge entirely and build the pipeline directly on `HandlePacketRequest` (which lacks `isTransit` -- transit semantics would come from elsewhere or be hardcoded to `false` for embedded mode)
- (b) Adapt `HandlePacketRequest` to `PaymentRequest` by providing defaults for missing fields (`isTransit: false` for final-hop embedded mode, `paymentId: ''`)

The existing ATDD integration tests in `__integration__/create-node.test.ts` use `MockEmbeddedConnector.deliverPacket()` which passes `HandlePacketRequest` (no `isTransit` field). This confirms approach (a) or (b) must handle the missing field.

**Option A (Recommended): Build pipeline handler directly on `HandlePacketRequest`.**

```typescript
// In create-node.ts
function createPipelinedPacketHandler(
  registry: HandlerRegistry,
  verifier: ReturnType<typeof createVerificationPipeline>,
  pricer: ReturnType<typeof createPricingValidator>,
  config: { devMode: boolean; ownPubkey: string; toonDecoder: (toon: string) => NostrEvent }
): PacketHandler {
  return async (request: HandlePacketRequest): Promise<HandlePacketResponse> => {
    // 1. Shallow TOON parse
    const toonBytes = Buffer.from(request.data, 'base64');
    const meta = shallowParseToon(toonBytes);

    // 2. Verify signature
    const verifyResult = await verifier.verify(meta, request.data);
    if (!verifyResult.verified) {
      return verifyResult.rejection!;
    }

    // 3. Validate pricing (wrap BigInt in try/catch per Story 1.6 learning)
    let amount: bigint;
    try {
      amount = BigInt(request.amount);
    } catch {
      return { accept: false, code: 'T00', message: 'Invalid payment amount' };
    }
    const priceResult = pricer.validate(meta, amount);
    if (!priceResult.accepted) {
      return priceResult.rejection!;
    }

    // 4. Build proper HandlerContext with real metadata
    const ctx = createHandlerContext({
      toon: request.data,
      meta,
      amount,
      destination: request.destination,
      toonDecoder: config.toonDecoder,
    });

    // 5. Dispatch to handler (T00 error boundary)
    try {
      return await registry.dispatch(ctx);
    } catch (err: unknown) {
      console.error('Handler error:', err);
      return { accept: false, code: 'T00', message: 'Internal error' };
    }
  };
}
```

This approach does NOT use `PaymentHandlerBridge` from Story 1.6. Instead, `createNode()` composes a full pipeline handler that operates directly on `HandlePacketRequest`. The T00 error boundary and dispatch logic are included inline. The `PaymentHandlerBridge` remains available for other consumers that need `isTransit` semantics (e.g., HTTP mode), but `createNode()` in embedded mode builds its own handler.

**NOTE on isTransit:** In embedded mode (`setPacketHandler`), the connector calls the handler for final-hop packets only. Transit packets are forwarded by the connector itself without calling the handler. Therefore, `isTransit` semantics from Story 1.6 are handled at the connector level, not in the SDK's pipeline handler.

**Option B: Wrap the bridge's handlePayment with type adaptation.**

Adapt `HandlePacketRequest` to `PaymentRequest` and delegate to the bridge:

```typescript
const bridge = createPaymentHandlerBridge({ registry: pipelinedRegistry, ... });
const packetHandler: PacketHandler = async (request: HandlePacketRequest) => {
  const paymentRequest: PaymentRequest = {
    paymentId: '',
    destination: request.destination,
    amount: request.amount,
    data: request.data,
    isTransit: false, // Embedded mode = always final hop
  };
  return bridge.handlePayment(paymentRequest) as unknown as HandlePacketResponse;
};
```

**Decision:** The developer should choose whichever approach maintains the cleanest separation. The key constraint is that T00 error boundary from Story 1.6 MUST be preserved. Note that `isTransit` is not relevant in embedded mode since the connector handles transit routing internally.

### Pipeline Position (Detailed)

```
ILP Packet arrives at connector
  -> connector.setPacketHandler() delivers to SDK
    -> PaymentHandlerBridge.handlePayment(request)     [Story 1.6]
      -> isTransit check (fire-and-forget vs await)    [Story 1.6]
        -> Shallow TOON Parse                          [Story 1.0, composed HERE]
          -> Schnorr Signature Verification             [Story 1.4, composed HERE]
            -> Pricing Validation                       [Story 1.5, composed HERE]
              -> HandlerRegistry.dispatch(kind)          [Story 1.2]
                -> Handler(ctx) -> ctx.accept()/reject() [Story 1.3]
      -> T00 error boundary (catch unhandled)          [Story 1.6]
```

### ConnectorNodeLike Structural Type

The `connector` field in `NodeConfig` should accept anything matching `EmbeddableConnectorLike` from `@toon-protocol/core/compose`. Do NOT import `ConnectorNode` directly from `@toon-protocol/connector`. Use structural typing:

```typescript
// In create-node.ts or types.ts
// Re-use EmbeddableConnectorLike from @toon-protocol/core/compose
import type { EmbeddableConnectorLike } from '@toon-protocol/core/compose';

export interface NodeConfig {
  secretKey: Uint8Array;
  connector: EmbeddableConnectorLike;
  ilpAddress?: string;   // Optional, defaults to '' (see note below)
  assetCode?: string;    // Optional, defaults to 'USD'
  assetScale?: number;   // Optional, defaults to 6
  handlers?: Record<number, Handler>;     // Config-based handler registration
  defaultHandler?: Handler;               // Config-based default handler
  // ... other optional fields
}
```

**NOTE on `ilpAddress`/`assetCode`/`assetScale`:** The existing ATDD integration tests (`__integration__/create-node.test.ts`) do NOT pass these fields. The `connector-api.test.ts` helper DOES pass them. Making them optional with sensible defaults resolves this inconsistency. The `ToonNodeConfig` in `@toon-protocol/core/compose` requires `ilpInfo` -- provide defaults when not specified:
```typescript
ilpInfo: {
  ilpAddress: config.ilpAddress ?? 'g.toon.local',
  assetCode: config.assetCode ?? 'USD',
  assetScale: config.assetScale ?? 6,
},
```

### TOON Codec DI Pattern

The `toonEncoder` and `toonDecoder` are optional in `NodeConfig`. If not provided, use the defaults from `@toon-protocol/core/toon`:

```typescript
import { encodeEventToToon, decodeEventFromToon } from '@toon-protocol/core/toon';

const encoder = config.toonEncoder ?? encodeEventToToon;
const decoder = config.toonDecoder ?? ((bytes: Uint8Array) => decodeEventFromToon(bytes));
```

**NOTE:** The existing ATDD integration tests import from `@toon-protocol/relay` not `@toon-protocol/core/toon`:
```typescript
import { encodeEventToToon, decodeEventFromToon } from '@toon-protocol/relay';
```
Both packages re-export the same codec (relay re-exports from core after Story 1.0 extraction). Either import source works.

For the `toonDecoder` passed to `createHandlerContext`, it expects `(toon: string) => NostrEvent`. Convert:

```typescript
const contextDecoder = (toon: string) => {
  const bytes = Buffer.from(toon, 'base64');
  return decoder(bytes);
};
```

### How start() and stop() Work

`createNode()` internally creates a `ToonNode` from `@toon-protocol/core/compose` and delegates lifecycle:

```typescript
const toonNode = createToonNode({
  connector: config.connector,
  handlePacket: pipelinedHandler, // The full pipeline handler
  secretKey: config.secretKey,
  ilpInfo: { ilpAddress: config.ilpAddress, assetCode: config.assetCode, assetScale: config.assetScale },
  toonEncoder: encoder,
  toonDecoder: decoder,
  relayUrl: config.relayUrl,
  knownPeers: config.knownPeers,
  settlementInfo: config.settlementInfo,
  basePricePerByte: config.basePricePerByte,
  ardriveEnabled: config.ardriveEnabled,
  settlementNegotiationConfig: config.settlementNegotiationConfig,
});

// ServiceNode.start() delegates to toonNode.start()
// ServiceNode.stop() delegates to toonNode.stop()
```

The `started` guard and `NodeError` on double-start replace the `BootstrapError` used in core's compose.ts. Wrap the core's error:

```typescript
async start(): Promise<StartResult> {
  if (started) {
    throw new NodeError('Node already started');
  }
  try {
    const result = await toonNode.start();
    started = true;
    return result;
  } catch (error) {
    throw new NodeError(
      `Failed to start node: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}
```

### Handler Registration on ServiceNode

Two handler registration patterns MUST be supported:

**Pattern 1: Config-based (used by ATDD integration tests)**
```typescript
const node = createNode({
  secretKey,
  connector,
  handlers: { 1: myHandler, 30617: repoHandler },
  defaultHandler: fallbackHandler,
});
```

**Pattern 2: Builder-pattern (post-creation chaining)**
```typescript
const node = createNode({ secretKey, connector })
  .on(1, myHandler)
  .on(30617, repoHandler)
  .onDefault(fallbackHandler);
```

Both patterns delegate to the same internal `HandlerRegistry`. Config-based handlers are registered during `createNode()` before the node is returned. Post-creation `.on()` calls add/replace handlers before `start()`.

```typescript
const registry = new HandlerRegistry();

// Register config-based handlers during createNode()
if (config.handlers) {
  for (const [kind, handler] of Object.entries(config.handlers)) {
    registry.on(Number(kind), handler);
  }
}
if (config.defaultHandler) {
  registry.onDefault(config.defaultHandler);
}

return {
  // ... other fields
  on(kind: number, handler: Handler): ServiceNode {
    registry.on(kind, handler);
    return this;
  },
  onDefault(handler: Handler): ServiceNode {
    registry.onDefault(handler);
    return this;
  },
};
```

Both patterns are callable BEFORE `start()`. The builder pattern returns `this` for chaining.

### channelClient Pass-through

The `channelClient` on `ServiceNode` is a pass-through from `ToonNode.channelClient`. For the `connector-api.test.ts` tests, `node.channelClient` is null when the connector lacks `openChannel`/`getChannelState` methods, and non-null when they exist.

### connector Pass-through

`node.connector` should expose the raw connector for direct method access (Story 1.8 scope). This is a simple pass-through of `config.connector`.

### Dependencies

- **Upstream (all implemented):** Story 1.0 (TOON codec + shallow parse), Story 1.1 (identity), Story 1.2 (HandlerRegistry), Story 1.3 (HandlerContext), Story 1.4 (verification), Story 1.5 (pricing), Story 1.6 (PaymentHandler bridge)
- **Downstream:** Story 1.8 (connector direct methods -- tests in `connector-api.test.ts`), Story 1.9 (bootstrap integration), Story 1.10 (dev mode)
- **Cross-package:** `@toon-protocol/core/compose` for `createToonNode` and `EmbeddableConnectorLike`

**NOTE: Discrepancy with epics.md.** The epics.md dependency declaration for Story 1.7 lists "Stories 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, **1.8, 1.9**" as dependencies. This is INCORRECT in epics.md -- Stories 1.8 (connector direct methods) and 1.9 (bootstrap integration) are DOWNSTREAM consumers of createNode, not prerequisites. This story correctly lists 1.8 and 1.9 as downstream. The epics.md should be updated to fix this stale dependency declaration.

### Previous Story Learnings (from Story 1.6)

- `vitest.config.ts` does NOT use `globals: true` -- all test files explicitly import `describe`, `it`, `expect`, `vi`, `beforeEach` from `vitest`
- ESM imports use `.js` extensions: `import { createNode } from './create-node.js'`
- When enabling tests, do NOT modify the existing test logic -- just remove `.skip`
- TypeScript strict mode with `noPropertyAccessFromIndexSignature` is active -- use bracket notation for index signatures
- The ATDD test priorities in `connector-api.test.ts` are already correctly labeled
- Use `void` keyword for fire-and-forget promise to satisfy no-floating-promises lint rule
- Update stale ATDD Red Phase comments to reflect current state
- No `any` type -- use `unknown` with type guards (enforced by ESLint)
- File naming: `create-node.ts` (kebab-case) per project convention
- The architecture doc shows `ServiceNode.ts` (PascalCase) but ATDD Red Phase convention in this codebase uses kebab-case for utility modules. Use `create-node.ts`.
- BigInt conversion (`BigInt(request.amount)`) should be wrapped in try/catch (learned from Story 1.6 review pass #3)

### Test Design

[Source: _bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.7]

| Test ID  | Test Description                                                                     | Level | Risk   | Priority | Status              | ATDD File                   |
| -------- | ------------------------------------------------------------------------------------ | ----- | ------ | -------- | ------------------- | --------------------------- |
| T-1.7-01 | Pipeline ordering: shallow parse -> verify -> price -> dispatch (spy-instrumented)   | I     | E1-R11 | P0       | **NEW** (must add)  | `__integration__/create-node.test.ts` |
| T-1.7-02 | Pipeline: invalid signature -> verify rejects -> handler never invoked               | I     | E1-R11 | P0       | Existing (.skip)    | `__integration__/create-node.test.ts` |
| T-1.7-03 | Pipeline: valid sig, underpaid -> price rejects F04 -> handler never invoked         | I     | E1-R11 | P0       | Existing (.skip)    | `__integration__/create-node.test.ts` |
| T-1.7-04 | Pipeline: valid sig, sufficient payment -> handler invoked, accept returned          | I     | E1-R11 | P0       | Existing (.skip)    | `__integration__/create-node.test.ts` |
| T-1.7-05 | Pipeline: self-write event -> pricing bypassed -> handler invoked                    | I     | E1-R11 | P0       | Existing (.skip)    | `__integration__/create-node.test.ts` |
| T-1.7-06 | node.start() calls connector.setPacketHandler()                                      | I     | -      | P0       | Existing (.skip)    | `__integration__/create-node.test.ts` |
| T-1.7-07 | node.start() returns StartResult with peerCount, channelCount                        | I     | -      | P1       | Existing (.skip)    | `__integration__/create-node.test.ts` |
| T-1.7-08 | node.stop() unsubscribes relay monitor                                               | I     | -      | P1       | Existing (.skip)    | `__integration__/create-node.test.ts` |
| T-1.7-09 | node.stop() is idempotent (double stop = no-op)                                      | U     | E1-R12 | P2       | Existing (.skip)    | `__integration__/create-node.test.ts` |
| T-1.7-10 | Double node.start() throws NodeError                                                 | U     | E1-R12 | P0       | Existing (.skip)    | `__integration__/create-node.test.ts` |
| T-1.7-11 | node.pubkey returns correct x-only public key                                        | U     | -      | P1       | Existing (.skip)    | `__integration__/create-node.test.ts` |
| T-1.7-12 | node.evmAddress returns correct EVM address                                          | U     | -      | P1       | Existing (.skip)    | `__integration__/create-node.test.ts` |
| T-1.7-13 | createNode with minimal config uses sensible defaults (basePricePerByte=10n)         | U     | -      | P1       | **NEW** (add to unit tests) | `create-node.test.ts` |
| --       | event with unregistered kind and no default handler returns F00                      | I     | -      | P2       | Existing (.skip)    | `__integration__/create-node.test.ts` (bonus) |
| --       | onDefault handler receives events with no kind-specific handler                      | I     | -      | P2       | Existing (.skip)    | `__integration__/create-node.test.ts` (bonus) |
| --       | handler throwing unhandled exception returns T00 (internal error)                    | I     | -      | P2       | Existing (.skip)    | `__integration__/create-node.test.ts` (bonus) |
| T-1.8-01 | node.connector exposes registerPeer, removePeer, sendPacket                          | U     | E1-R13 | P2       | Existing (.skip, Story 1.8) | `connector-api.test.ts` |
| T-1.8-02 | node.channelClient is null when connector lacks channel support                      | U     | -      | P2       | Existing (.skip, Story 1.8) | `connector-api.test.ts` |
| T-1.8-03 | node.channelClient is non-null with openChannel/getChannelState                      | U     | -      | P2       | Existing (.skip, Story 1.8) | `connector-api.test.ts` |

**Risk E1-R11** (score 9, critical): Pipeline stage ordering violation. Tests T-1.7-01 through T-1.7-05 are the MOST IMPORTANT tests in Epic 1. T-1.7-01 (spy-instrumented ordering) must be added as NEW. T-1.7-02 through T-1.7-05 already exist in the ATDD file and must be unskipped.

**Risk E1-R12** (score 2, low): Double start() not throwing. T-1.7-10 catches this (existing ATDD test).

### ILP Error Codes

| Code  | Name               | When Used                                |
| ----- | ------------------ | ---------------------------------------- |
| `F06` | Unexpected Payment | Invalid Schnorr signature (verify stage) |
| `F04` | Insufficient Amount | Underpaid event (pricing stage)         |
| `F00` | Bad Request        | No handler for event kind (dispatch)     |
| `T00` | Internal Error     | Unhandled handler exception (bridge)     |

### Critical Rules

- The pipeline MUST execute in exact order: shallow parse -> verify -> price -> dispatch. This is a score-9 correctness risk.
- Do NOT modify `payment-handler-bridge.ts` -- compose around it or replace its internal dispatch
- Do NOT modify `verification-pipeline.ts` or `pricing-validator.ts` -- compose them in the pipeline
- Use `NodeError` (not `BootstrapError`) for double-start -- SDK has its own error hierarchy
- Use structural typing for connector -- do NOT import from `@toon-protocol/connector`
- `node.on(kind, handler)` MUST return `this` for builder pattern chaining
- Handlers MUST be registerable BEFORE `start()` is called (both via config `handlers` map and post-creation `.on()`)
- `stop()` MUST be idempotent -- second call is a no-op, no throw
- Do NOT unskip `dev-mode.test.ts` -- it belongs to Story 1.10
- Do NOT unskip `connector-api.test.ts` tests -- they belong to Story 1.8
- Do NOT unskip `__integration__/network-discovery.test.ts` -- it belongs to Story 1.9
- TOON codec callbacks should default to `@toon-protocol/core/toon` implementations if not provided in config
- Do NOT add `process.env` reads -- the node is config-driven only
- The `@ts-nocheck` pragma in `index.test.ts` should be removed once `createNode` is exported AND all other imports resolve. Keep `@ts-nocheck` in `connector-api.test.ts` (Story 1.8 scope).
- `HandlePacketRequest` (from `@toon-protocol/core/compose`) does NOT have `isTransit` -- do not assume it exists in the pipeline handler. Transit semantics are handled by the connector in embedded mode.
- `NodeConfig` MUST support `handlers?: Record<number, Handler>` and `defaultHandler?: Handler` to match existing ATDD integration tests
- `ilpAddress`, `assetCode`, `assetScale` should be OPTIONAL in NodeConfig with sensible defaults to match ATDD integration test expectations
- Integration tests in `__integration__/` are excluded from the default vitest run. Add a `test:integration` script or document how to run them.

### Coding Standards

- PascalCase for interfaces (`NodeConfig`, `ServiceNode`, `StartResult`), camelCase for functions (`createNode`)
- File naming: `create-node.ts` (kebab-case)
- No `any` -- use `unknown` with type guards
- Co-located tests: `create-node.test.ts` next to `create-node.ts` for unit tests
- Integration tests: `__integration__/create-node.test.ts` (ALREADY EXISTS -- add spy-instrumented test to this file)
- ESM `.js` extensions in imports
- Use `void` keyword for fire-and-forget promises to satisfy no-floating-promises lint rule
- Explicit imports from `vitest`: `import { describe, it, expect, vi, beforeEach } from 'vitest'`

### Project Structure Notes

- New file: `packages/sdk/src/create-node.ts` (implementation)
- New file: `packages/sdk/src/create-node.test.ts` (unit tests for lifecycle and defaults -- T-1.7-13)
- Already exists: `packages/sdk/src/__integration__/create-node.test.ts` (12 ATDD integration tests, remove `.skip` and add T-1.7-01 spy test)
- Modified: `packages/sdk/src/index.ts` (add createNode, NodeConfig, ServiceNode, StartResult exports)
- Modified: `packages/sdk/src/index.test.ts` (remove `.skip` from createNode export test AND other export tests whose implementations exist; remove `@ts-nocheck` if all imports resolve)
- NOT modified: `packages/sdk/src/connector-api.test.ts` (Story 1.8 scope -- leave `.skip` and `@ts-nocheck` intact)
- Modified: `packages/sdk/vitest.config.ts` (update ATDD comments for clarity)
- Modified: `packages/sdk/package.json` (add `test:integration` script if not exists)
- Architecture doc shows `ServiceNode.ts` (PascalCase) -- actual file should be `create-node.ts` (kebab-case) per project convention

### Git Intelligence

Last 5 commits follow pattern: `feat(<story-id>): <description>`

Recent commits:
- `feat(1-6): implement PaymentHandler bridge with transit semantics`
- `feat(1-5): enable pricing validation with self-write bypass`
- `feat(1-4): enable Schnorr signature verification pipeline`
- `feat(1-3): enable HandlerContext with TOON passthrough and lazy decode`
- `feat(1-2): implement handler registry with kind-based routing`

Expected commit: `feat(1-7): implement createNode composition with embedded connector lifecycle`

Stories 1.2-1.5 primarily enabled skipped ATDD tests (implementations already existed as stubs). Story 1.6 was the first to modify an implementation file. Story 1.7 requires creating a NEW file (`create-node.ts`) plus integration tests -- the most substantial implementation so far.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.7]
- [Source: _bmad-output/planning-artifacts/epics.md#FR Coverage Map -- FR-SDK-1, FR-SDK-10, FR-SDK-11]
- [Source: _bmad-output/planning-artifacts/architecture.md#SDK Pipeline Test Strategy]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Flow (SDK Pipeline)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 2: Handler Registration Chaining]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 1: TOON Codec Location]
- [Source: _bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.7]
- [Source: _bmad-output/planning-artifacts/test-design-epic-1.md#3.1 The Pipeline Ordering Invariant (E1-R11, Score 9)]
- [Source: _bmad-output/planning-artifacts/test-design-epic-1.md#6.2 Story 1.7 (createNode) wiring changes]
- [Source: packages/core/src/compose.ts -- ToonNode, ToonNodeConfig, EmbeddableConnectorLike, HandlePacketRequest, HandlePacketResponse]
- [Source: packages/core/src/toon/shallow-parse.ts -- shallowParseToon, ToonRoutingMeta]
- [Source: packages/core/src/toon/index.ts -- encodeEventToToon, decodeEventFromToon]
- [Source: packages/sdk/src/payment-handler-bridge.ts -- createPaymentHandlerBridge, PaymentRequest (note: different type from HandlePacketRequest)]
- [Source: packages/sdk/src/handler-registry.ts -- HandlerRegistry class]
- [Source: packages/sdk/src/handler-context.ts -- createHandlerContext, HandlerContext, CreateHandlerContextOptions]
- [Source: packages/sdk/src/verification-pipeline.ts -- createVerificationPipeline, VerificationResult]
- [Source: packages/sdk/src/pricing-validator.ts -- createPricingValidator, PricingValidationResult]
- [Source: packages/sdk/src/identity.ts -- fromSecretKey, NodeIdentity]
- [Source: packages/sdk/src/errors.ts -- NodeError extends ToonError]
- [Source: packages/sdk/src/__integration__/create-node.test.ts -- 12 ATDD integration tests for Story 1.7 (composition + pipeline)]
- [Source: packages/sdk/src/__integration__/network-discovery.test.ts -- ATDD integration tests for Story 1.9 (DO NOT ENABLE)]
- [Source: packages/sdk/src/connector-api.test.ts -- ATDD tests for Story 1.8 (depends on createNode, DO NOT ENABLE)]
- [Source: packages/sdk/src/index.test.ts -- ATDD test for createNode export + other export tests]
- [Source: packages/sdk/vitest.config.ts -- vitest configuration with __integration__ exclusion and ATDD story comments]
- [Source: _bmad-output/implementation-artifacts/1-6-paymenthandler-bridge-with-transit-semantics.md -- previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None required -- all tests passed on first run.

### Completion Notes List

- **Task 1 (create-node.ts):** Verified existing `create-node.ts` implementation covers all requirements: `NodeConfig` interface with all required and optional fields (including `handlers`, `defaultHandler`, `ilpAddress`, `assetCode`, `assetScale` with sensible defaults), `ServiceNode` interface with `pubkey`, `evmAddress`, `connector`, `channelClient`, `on()`, `onDefault()`, `start()`, `stop()`, and `StartResult` interface. Implementation follows Option A (pipelined handler directly on `HandlePacketRequest`).
- **Task 2 (Pipeline wiring):** Pipeline executes in correct order: (1) shallow TOON parse via `shallowParseToon()`, (2) Schnorr verification via `verifier.verify()`, (3) pricing validation via `pricer.validate()`, (4) handler dispatch via `registry.dispatch()`. Real `ToonRoutingMeta` from shallow parse is used for `createHandlerContext()`. T00 error boundary wraps dispatch.
- **Task 3 (Lifecycle):** `start()` delegates to `toonNode.start()` with `NodeError` guard on double-start. `stop()` delegates to `toonNode.stop()` and is idempotent. `started` flag tracks SDK-level lifecycle.
- **Task 4 (vitest.config.ts and index.test.ts):** All `.skip` removed from `index.test.ts` (9 export tests). `@ts-nocheck` removed. vitest.config.ts ATDD comments updated for Story 1.7 done status. `connector-api.test.ts` and `dev-mode.test.ts` remain excluded.
- **Task 5 (Integration tests):** All 13 original tests in `__integration__/create-node.test.ts` unskipped. 3 new tests added: T-1.7-01 spy-instrumented pipeline ordering, default basePricePerByte verification, default devMode verification (total 16 integration tests). All pass.
- **Task 6 (Unit tests):** `create-node.test.ts` has 9 unit tests covering defaults (T-1.7-13), config-based handler registration, builder pattern chaining, identity derivation (T-1.7-11, T-1.7-12), and connector pass-through.
- **Task 7 (Exports):** `createNode`, `NodeConfig`, `ServiceNode`, `StartResult` exported from `index.ts`.
- **Task 8 (Regression testing):** All tests pass -- SDK: 96 unit tests, 16 integration tests. Monorepo: relay 216, bls 233, core 536, docker 52, client 210 -- zero regressions.

### File List

- `packages/sdk/src/create-node.ts` -- created (main implementation: `createNode()`, `NodeConfig`, `ServiceNode`, `StartResult`)
- `packages/sdk/src/create-node.test.ts` -- created (9 unit tests for defaults, config-based registration, chaining, identity, connector pass-through)
- `packages/sdk/src/__integration__/create-node.test.ts` -- modified (removed `.skip` from all 13 tests, removed `@ts-nocheck`, added 3 new tests: T-1.7-01 spy-instrumented pipeline ordering, default basePricePerByte verification, default devMode verification; updated header comment)
- `packages/sdk/src/index.ts` -- modified (added `createNode`, `NodeConfig`, `ServiceNode`, `StartResult` exports)
- `packages/sdk/src/index.test.ts` -- modified (removed `.skip` from all 9 export tests, removed `@ts-nocheck`, updated header comment)
- `packages/sdk/src/handler-registry.ts` -- modified (changed `Handler` type from inline `{ accept: boolean; [key: string]: unknown }` to `HandlerResponse` union, changed `dispatch()` return type to `HandlerResponse`)
- `packages/sdk/src/handler-registry.test.ts` -- modified (updated test assertions to match new `HandlerResponse` type, replaced bracket notation with `in` operator checks)
- `packages/sdk/vitest.config.ts` -- modified (updated ATDD story comments to reflect 1.7 done status, added connector-api.test.ts Story 1.8 comment)
- `packages/sdk/vitest.integration.config.ts` -- created (integration test vitest config with 30s timeout)
- `packages/sdk/package.json` -- modified (added `test:integration` script, added `@toon-protocol/relay` devDependency)

### Change Log

| Date       | Summary                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| 2026-03-04 | Story 1.7 verified complete: `createNode()` composition with embedded connector lifecycle, full pipeline (shallow parse -> verify -> price -> dispatch), start/stop lifecycle, 96 unit tests + 16 integration tests passing, zero monorepo regressions. |

## Code Review Record

### Review Pass #1

| Field             | Value                                                                 |
|-------------------|-----------------------------------------------------------------------|
| **Date**          | 2026-03-04                                                            |
| **Reviewer Model**| Claude Opus 4.6 (claude-opus-4-6)                                     |
| **Outcome**       | Success                                                               |
| **Critical**      | 0                                                                     |
| **High**          | 0                                                                     |
| **Medium**        | 3 (all fixed -- non-null assertions replaced with safe patterns, undocumented type casts documented) |
| **Low**           | 3 (2 fixed -- unused import and redundant annotation removed; 1 accepted -- console.error matches project convention) |
| **Total Found**   | 6                                                                     |
| **Total Fixed**   | 5                                                                     |
| **Total Accepted**| 1                                                                     |

**Files Changed**: `packages/sdk/src/create-node.ts` (non-null assertions replaced with safe patterns, undocumented type casts documented, unused import removed, redundant annotation removed), `packages/sdk/src/__integration__/create-node.test.ts` (corresponding fixes).

**Accepted Issues**: 1 Low -- `console.error` usage in error handler matches project convention (no change needed).

**Follow-up Tasks**: None.

### Review Pass #2

| Field             | Value                                                                 |
|-------------------|-----------------------------------------------------------------------|
| **Date**          | 2026-03-04                                                            |
| **Reviewer Model**| Claude Opus 4.6 (claude-opus-4-6)                                     |
| **Outcome**       | Success                                                               |
| **Critical**      | 0                                                                     |
| **High**          | 0                                                                     |
| **Medium**        | 3 (all fixed)                                                         |
| **Low**           | 3 (all fixed)                                                         |
| **Total Found**   | 6                                                                     |
| **Total Fixed**   | 6                                                                     |
| **Total Accepted**| 0                                                                     |

**Medium Issues Fixed:**
1. Story File List was incomplete -- `handler-registry.ts` and `handler-registry.test.ts` modified in 1.7 but not listed. Updated File List to include them.
2. Story File List had false "no changes" claims -- `vitest.integration.config.ts` was listed as "no changes" but was created; `package.json` was listed as "no changes" but was modified. Corrected both entries.
3. Integration test count was wrong -- story claimed 14 in multiple places (Task 5, Task 8, completion notes) but actual count is 16 (13 existing + 3 new). Corrected all references.

**Low Issues Fixed:**
4. Unit tests for config-based handler registration were weak -- only checked node creation, not handler registration. Improved test descriptions and added method existence assertions.
5. Type casts for `verifyResult.rejection` and `priceResult.rejection` were unsafe -- could cast `undefined` to `HandlePacketResponse`. Added runtime guards with fallback error responses.
6. Shared connector in integration tests -- 3 tests used shared `connector` from `beforeAll`, creating fragile coupling. Replaced with per-test `freshConnector` instances and removed unused shared `connector` variable.

**Files Changed**: `packages/sdk/src/create-node.ts` (added defensive guards for rejection casts), `packages/sdk/src/create-node.test.ts` (improved test descriptions and assertions), `packages/sdk/src/__integration__/create-node.test.ts` (replaced shared connector with per-test fresh connectors), `_bmad-output/implementation-artifacts/1-7-createnode-composition-with-embedded-connector-lifecycle.md` (corrected File List, test counts, and added review record).

**Follow-up Tasks**: None.

### Review Pass #3

| Field             | Value                                                                 |
|-------------------|-----------------------------------------------------------------------|
| **Date**          | 2026-03-04                                                            |
| **Reviewer Model**| Claude Opus 4.6 (claude-opus-4-6)                                     |
| **Outcome**       | Success                                                               |
| **Critical**      | 0                                                                     |
| **High**          | 0                                                                     |
| **Medium**        | 2 (both fixed -- fromSecretKey error wrapping in NodeError, kind validation on ServiceNode.on()) |
| **Low**           | 2 (1 fixed -- 4 new validation unit tests added; 1 accepted -- console.error matches project convention) |
| **Total Found**   | 4                                                                     |
| **Total Fixed**   | 3                                                                     |
| **Total Accepted**| 1                                                                     |

**Medium Issues Fixed:**
1. `fromSecretKey` error not wrapped in `NodeError` -- errors thrown by `fromSecretKey()` during `createNode()` were propagating as raw errors instead of being wrapped in the SDK's `NodeError` type. Fixed to catch and wrap.
2. Kind validation missing on `ServiceNode.on()` -- the `.on(kind, handler)` method did not validate that `kind` is a valid Nostr event kind (non-negative integer). Added validation.

**Low Issues Fixed:**
3. Added 4 new validation unit tests to `create-node.test.ts` covering the medium fixes and edge cases (SDK unit tests now 100, up from 96).

**Accepted Issues**: 1 Low -- `console.error` usage in error handler matches project convention (no change needed, same as Review Pass #1).

**Files Changed**: `packages/sdk/src/create-node.ts` (fromSecretKey error wrapping in NodeError, kind validation on ServiceNode.on()), `packages/sdk/src/create-node.test.ts` (4 new validation unit tests).

**OWASP Security Review**: Clean across all 10 categories.

**Follow-up Tasks**: None.
