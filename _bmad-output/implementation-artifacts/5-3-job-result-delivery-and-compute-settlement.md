# Story 5.3: Job Result Delivery + Compute Settlement

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **DVM provider agent**,
I want to publish job results and receive compute payment through the ILP network,
So that the complete job lifecycle (request -> feedback -> result -> settlement) works end-to-end on TOON.

**FRs covered:** FR-DVM-3 (Providers SHALL publish Kind 7000 feedback and Kind 6xxx result events via ILP PREPARE packets, and customers SHALL settle compute costs via ILP payments routed through the mesh)

**Dependencies:** Story 5.2 complete (ILP-native job submission -- validation tests prove pipeline handles Kind 5xxx events, commit `7aafad6` on `epic-5`). Story 5.1 complete (DVM event kind definitions -- builders, parsers, constants in `@toon-protocol/core`, commit `5556844` on `epic-5`). Epic 3 Story 3.1 (USDC denomination). Epic 3 Story 3.5 (kind:10035 service discovery with `ilpAddress` field). All infrastructure from Epics 1-4 is complete.

**Decision sources:**
- Decision 2 (party-mode-2020117-analysis): ILP-native as preferred path, x402 as fallback
- Decision 4 (party-mode-2020117-analysis): NIP-90 compatible event kinds for cross-network interoperability
- Decision 6 (party-mode-2020117-analysis): Epic 5 scope is stories 5.1-5.4 (core lifecycle + skill descriptors)

**Downstream dependencies:** Story 5.3 completes the core DVM lifecycle. Story 5.4 (Skill Descriptors) can proceed independently but benefits from the full lifecycle being validated. Epic 6 (Advanced DVM Coordination) depends on the complete lifecycle from Story 5.3.

**Note on Epic 5 renumbering:** Decision 8 (party-mode-2020117-analysis) renumbered the original Epic 5 (The Rig / NIP-34 Git Forge) to Epic 7. The current Epic 5 is the DVM Compute Marketplace. The `test-design-epic-5.md` contains DVM-specific test scenarios (T-5.3-01 through T-5.3-16, cross-story T-INT-01 through T-INT-06) and DVM risk profiles (E5-R005 through E5-R008). The `atdd-checklist-epic-5.md` contains ATDD stubs for the old Rig epic. Story-level test IDs in this story follow the test-design-epic-5.md numbering where applicable; additional story-defined tests (T-5.3-17+) extend the epic-level design.

## Acceptance Criteria

1. Given a provider processing a Kind 5xxx job request, when the provider begins processing, then it publishes a Kind 7000 feedback event with `status: 'processing'` via ILP PREPARE using `node.publishEvent(buildJobFeedbackEvent({ requestEventId, customerPubkey, status: 'processing' }, secretKey), { destination })`, and the relay stores the feedback and broadcasts to subscribers, and the relay write fee is `basePricePerByte * toonData.length` (standard pricing model -- no DVM-specific pricing).

2. Given a provider that has completed processing a job, when the provider publishes a Kind 6xxx result event via `node.publishEvent(buildJobResultEvent({ kind: 6100, requestEventId, customerPubkey, amount, content }, secretKey), { destination })`, then the result is sent via ILP PREPARE with NIP-90 tags: `['e', requestEventId]`, `['p', customerPubkey]`, `['amount', computeCost, 'usdc']`, and the content field contains the result data. The relay stores the result and broadcasts to subscribers.

3. Given a customer that has received a Kind 6xxx result, when the customer reads the result (free to read) and extracts the provider's ILP address from their kind:10035 service discovery event via `parseServiceDiscovery(providerDiscoveryEvent).ilpAddress`, then the customer sends an ILP payment for the compute cost via `node.settleCompute(resultEvent, providerIlpAddress, { originalBid })`, which internally calls `ilpClient.sendIlpPacket({ destination: providerIlpAddress, amount: parsedResult.amount, data: '' })`, and the payment routes through the ILP mesh: customer -> connector -> [intermediate hops] -> provider's connector -> provider. Settlement occurs through existing EVM payment channels (same infrastructure as relay write fees).

4. Given a Kind 6xxx result from a provider whose ILP address is reachable via multi-hop routing, when the customer sends the compute payment, then the payment routes through the ILP mesh (e.g., customer -> relay node -> provider node), and each intermediate connector earns routing fees (existing ILP economics).

5. Given a provider that encounters an error during processing, when the error occurs, then the provider publishes a Kind 7000 feedback event with `status: 'error'` and error details in the content field, and no compute payment is expected from the customer.

6. Given the SDK, when a DVM job lifecycle completes, then the SDK provides high-level helper functions on the `ServiceNode` interface: `publishFeedback(requestEventId, customerPubkey, status, content?)`, `publishResult(requestEventId, customerPubkey, amount, content, options?)`, and `settleCompute(resultEvent, providerIlpAddress, options?)`. These helpers handle event building, TOON encoding, ILP PREPARE construction, and payment routing internally. **Deviation from epics.md:** The epics.md defines `settleCompute(resultEvent)` as a single-parameter function. This story expands the signature to `settleCompute(resultEvent, providerIlpAddress, options?)` because: (a) ILP address resolution is a caller concern, not embedded in the helper (S5.3-R4/E5-R006), and (b) optional `options.originalBid` enables bid validation (E5-R005). The epics.md also lists `publishJobRequest()` as a Story 5.3 helper -- this is not included because customers already have `publishEvent(buildJobRequestEvent())` from Story 5.2.

7. Given a provider that publishes a Kind 7000 feedback event followed by a Kind 6xxx result event, when the customer's SDK subscribes to the relay for events referencing the original request ID (via `e` tag), then the customer receives both the feedback and result events in order, and the SDK can correlate them to the original Kind 5xxx request via the shared `requestEventId` in the `e` tag.

8. Given a Kind 6xxx result event with an `amount` tag that exceeds the original Kind 5xxx request's `bid` tag, when the customer calls `settleCompute(resultEvent, providerIlpAddress, { originalBid })`, then `settleCompute()` rejects the payment and throws `NodeError` with a message indicating the amount exceeds the bid. Given a Kind 6xxx result with `amount` <= `bid`, when the customer calls `settleCompute()` with the original bid, then the payment proceeds normally. **Note (E5-R005 security boundary):** Without bid validation, a malicious provider can drain customer funds by inflating the result `amount` tag. The `originalBid` parameter is optional -- when omitted, no bid validation is performed (caller assumes responsibility).

## Tasks / Subtasks

- [x] Task 1: Implement SDK helper methods for DVM lifecycle events (AC: #1, #2, #5, #6, #8)
  - [x] 1.1 Add `publishFeedback(requestEventId, customerPubkey, status, content?)` method to `ServiceNode` interface in `packages/sdk/src/create-node.ts`. Internally calls `buildJobFeedbackEvent()` from `@toon-protocol/core` with the provider's `secretKey`, then `this.publishEvent(event, { destination })`. Returns `PublishEventResult`.
  - [x] 1.2 Add `publishResult(requestEventId, customerPubkey, amount, content, options?)` method to `ServiceNode` interface. Internally calls `buildJobResultEvent()` with kind derived from the request (kind + 1000), then `this.publishEvent(event, { destination })`. The `options` parameter includes `{ destination: string, kind?: number }` where `kind` defaults to 6100 (text generation result). Returns `PublishEventResult`.
  - [x] 1.3 Add `settleCompute(resultEvent, providerIlpAddress, options?)` method to `ServiceNode` interface. Extracts `amount` from the result event's `amount` tag via `parseJobResult()`. When `options.originalBid` is provided, validates that `BigInt(amount) <= BigInt(originalBid)` and throws `NodeError` if exceeded (E5-R005 bid validation). Then sends an ILP payment via `ilpClient.sendIlpPacket({ destination: providerIlpAddress, amount, data: '' })`. Returns `IlpSendResult`. This is a **payment-only** operation -- no TOON encoding, no relay write. The empty `data` field signals a pure value transfer (no event payload). **Deviation from epics.md:** The epics.md shows `settleCompute(resultEvent)` (single param). This story uses `settleCompute(resultEvent, providerIlpAddress, options?)` because ILP address resolution is a caller concern (S5.3-R4), and bid validation requires the original bid amount (E5-R005).
  - [x] 1.4 Update `ServiceNode` interface type in `packages/sdk/src/create-node.ts` to include the three new method signatures.
  - [x] 1.5 Write unit tests for `publishFeedback()`: verify it calls `buildJobFeedbackEvent()` with correct params and delegates to `publishEvent()`.
  - [x] 1.6 Write unit tests for `publishResult()`: verify it calls `buildJobResultEvent()` with correct params and delegates to `publishEvent()`.
  - [x] 1.7 Write unit tests for `settleCompute()`: verify it extracts amount from result event and calls `ilpClient.sendIlpPacket()` with empty data and correct destination/amount.
  - [x] 1.8 Write unit test for `settleCompute()` with invalid result event (malformed amount tag): verify it throws `NodeError` with descriptive message.
  - [x] 1.9 Write unit test for `settleCompute()` bid validation: result `amount` exceeds `originalBid` -> throws `NodeError` with message indicating amount exceeds bid (E5-R005, covers T-5.3-04).
  - [x] 1.10 Write unit test for `settleCompute()` bid validation: result `amount` <= `originalBid` -> payment proceeds (E5-R005, covers T-5.3-05).
  - [x] 1.11 Write unit test for `settleCompute()` bid validation: `originalBid` omitted -> no validation, payment proceeds regardless of amount.

- [x] Task 2: Validate feedback and result event publishing via existing pipeline (AC: #1, #2, #5)
  - [x] 2.1 Write integration test: provider publishes Kind 7000 feedback with `status: 'processing'` via `publishFeedback()` -> event is TOON-encoded -> sent via ILP PREPARE -> relay stores it. Verify feedback event has correct `e` tag (requestEventId), `p` tag (customerPubkey), and `status` tag.
  - [x] 2.2 Write integration test: provider publishes Kind 6100 result via `publishResult()` -> event is TOON-encoded -> sent via ILP PREPARE -> relay stores it. Verify result event has correct `e` tag, `p` tag, `amount` tag with USDC denomination, and content field.
  - [x] 2.3 Write integration test: provider publishes Kind 7000 feedback with `status: 'error'` and error details in content field. Verify the error feedback event is stored and has correct tags.
  - [x] 2.4 Write unit test: feedback and result events pay `basePricePerByte * toonData.length` (standard pricing -- no DVM-specific overrides).

- [x] Task 3: Validate compute settlement via ILP payment (AC: #3, #4)
  - [x] 3.1 Write integration test: customer calls `settleCompute(resultEvent, providerIlpAddress)` -> ILP payment is sent via `ilpClient.sendIlpPacket()` with `data: ''` (pure value transfer) and amount matching the result event's `amount` tag. Verify `IlpSendResult.accepted === true`.
  - [x] 3.2 Write unit test: `settleCompute()` extracts provider ILP address from kind:10035 service discovery event via `parseServiceDiscovery()`. Verify the address extraction chain: query relay for kind:10035 -> `parseServiceDiscovery(event).ilpAddress` -> use as destination.
  - [x] 3.3 Write unit test: compute payment with invalid/unreachable ILP address returns `IlpSendResult.accepted === false` with appropriate error code.
  - [x] 3.4 Write integration test (if SDK E2E infra available): multi-hop compute payment routes through ILP mesh. Customer -> relay node -> provider node. Verify intermediate connector earns routing fees. **Note:** This test depends on `sdk-e2e-infra.sh` being up with 2+ Docker peers. May need to be marked as E2E-only.

- [x] Task 4: Validate full DVM lifecycle end-to-end (AC: #1, #2, #3, #5, #7, #8)
  - [x] 4.1 Write integration test: full lifecycle using SDK helpers -- customer publishes Kind 5100 request via `publishEvent()` -> provider receives via subscription -> provider calls `publishFeedback(requestId, customerPubkey, 'processing')` -> provider calls `publishResult(requestId, customerPubkey, amount, resultContent, { destination })` -> customer calls `settleCompute(resultEvent, providerIlpAddress)`. Verify each stage produces correct events with correct tags.
  - [x] 4.2 Write integration test: customer subscribes to relay events with `e` tag matching the original request ID -> receives Kind 7000 feedback and Kind 6100 result events correlated by shared `requestEventId`.
  - [x] 4.3 Write integration test: error lifecycle -- customer publishes Kind 5100 request -> provider calls `publishFeedback(requestId, customerPubkey, 'error', 'GPU out of memory')` -> no result event -> no compute settlement. Verify only feedback event is published with error status.

- [x] Task 5: Cross-story integration boundary tests (AC: #1, #2, #3)
  - [x] 5.1 Write integration test: Kind 6100 result with complex content (multi-line text, JSON, URLs) survives TOON roundtrip AND arrives at customer's handler with all tags and content intact. Uses `buildJobResultEvent()` from Story 5.1 and pipeline from Story 5.2.
  - [x] 5.2 Write integration test: Kind 7000 feedback events with all four status values (`'processing'`, `'error'`, `'success'`, `'partial'`) survive TOON roundtrip. Uses `buildJobFeedbackEvent()` from Story 5.1.
  - [x] 5.3 Write integration test: compute settlement amount matches the `amount` tag from `buildJobResultEvent()` after TOON roundtrip. Proves amount survives encode/decode and is correctly extracted by `parseJobResult()`.

## Dev Notes

### Architecture and Constraints

**Key insight: Story 5.3 introduces the first NEW production code in Epic 5.** Unlike Stories 5.1 (builders/parsers) and 5.2 (validation-only), Story 5.3 adds three new methods to the `ServiceNode` interface that compose existing primitives into DVM-specific SDK helpers. The implementation follows the established pattern: thin helper methods that delegate to existing infrastructure (`buildJobFeedbackEvent()`, `buildJobResultEvent()`, `publishEvent()`, `ilpClient.sendIlpPacket()`).

**DVM lifecycle on TOON (recap from epics.md):**
```
1. Customer -> ILP PREPARE [Kind 5xxx job request]  -> Relay (paid to write)
2. Provider <- reads Kind 5xxx (free to read)
3. Provider -> ILP PREPARE [Kind 7000 feedback]     -> Relay (paid to write)
4. Provider -> ILP PREPARE [Kind 6xxx result]        -> Relay (paid to write)
5. Customer <- reads Kind 6xxx (free to read)
6. Customer -> ILP payment to Provider               -> Compute settlement (routed through ILP mesh)
```

**Two distinct payment types in the DVM lifecycle:**
1. **Relay write fees** (steps 1, 3, 4): `basePricePerByte * toonData.length` -- paid to the relay for event storage. Uses `publishEvent()` which TOON-encodes and sends via `buildIlpPrepare()`.
2. **Compute settlement** (step 6): A **pure ILP value transfer** -- paid directly to the provider for compute work. Uses `ilpClient.sendIlpPacket()` with `data: ''` (no event payload). The amount comes from the result event's `amount` tag.

**Compute settlement is NOT a relay write.** It is a direct ILP payment from customer to provider. The relay is not involved in step 6. The payment routes through the ILP mesh (same connectors and payment channels used for relay write fees), but no event is stored. This is the ILP flywheel design: every DVM job strengthens the payment channel network.

**Provider ILP address discovery:** The customer needs the provider's ILP address to send the compute payment. This comes from the provider's kind:10035 service discovery event, which contains `ilpAddress` in the JSON content. The customer queries the relay for kind:10035 events from the provider's pubkey, then calls `parseServiceDiscovery(event).ilpAddress`.

**secretKey access for helper methods:** The `publishFeedback()` and `publishResult()` helpers need the provider's `secretKey` to call `buildJobFeedbackEvent()` and `buildJobResultEvent()`. The `secretKey` is available as `config.secretKey` in the `createNode()` closure (used by bootstrap, discovery, and the returned node). The helpers will access it from the same closure scope.

### What Already Exists (DO NOT Recreate)

- **`publishEvent(event, { destination })`** in `packages/sdk/src/create-node.ts` (line ~735) -- TOON-encodes any event, computes `basePricePerByte * toonData.length`, sends via `buildIlpPrepare()` through ILP client. Used by `publishFeedback()` and `publishResult()` internally.
- **`buildJobFeedbackEvent(params, secretKey)`** in `packages/core/src/events/dvm.ts` (line ~413) -- Builds signed Kind 7000 feedback events with `e`, `p`, `status` tags.
- **`buildJobResultEvent(params, secretKey)`** in `packages/core/src/events/dvm.ts` (line ~340) -- Builds signed Kind 6xxx result events with `e`, `p`, `amount` tags and content.
- **`parseJobResult(event)`** in `packages/core/src/events/dvm.ts` (line ~572) -- Parses Kind 6xxx events, extracts `amount`, `requestEventId`, `customerPubkey`, `content`. Returns `ParsedJobResult | null`.
- **`parseJobFeedback(event)`** in `packages/core/src/events/dvm.ts` (line ~621) -- Parses Kind 7000 events, extracts `requestEventId`, `customerPubkey`, `status`, `content`. Returns `ParsedJobFeedback | null`.
- **`parseServiceDiscovery(event)`** in `packages/core/src/events/service-discovery.ts` (line ~92) -- Parses kind:10035 events, extracts `ilpAddress` and other service discovery fields.
- **`buildIlpPrepare({ destination, amount, data })`** in `packages/core/src/x402/build-ilp-prepare.ts` -- Shared packet construction. Returns `{ destination, amount: string, data: base64 }`.
- **`ilpClient.sendIlpPacket({ destination, amount, data })`** in `packages/core/src/bootstrap/types.ts` (line ~162) -- ILP client interface. Returns `IlpSendResult { accepted, fulfillment?, data?, code?, message? }`.
- **`HandlerRegistry.on(kind, handler)`** in `packages/sdk/src/handler-registry.ts` -- Routes by numeric kind. Already supports DVM kinds (validated by Story 5.2).
- **`createHandlerContext()`** in `packages/sdk/src/handler-context.ts` -- Provides `ctx.toon`, `ctx.kind`, `ctx.pubkey`, `ctx.decode()`.
- **DVM builders, parsers, constants** in `packages/core/src/events/dvm.ts` -- All from Story 5.1 (buildJobRequestEvent, parseJobRequest, DvmJobStatus, etc.).
- **ServiceNode interface** in `packages/sdk/src/create-node.ts` (line ~168) -- Current interface includes `on()`, `onDefault()`, `start()`, `stop()`, `peerWith()`, `publishEvent()`.

### What to Create (New Files)

1. **`packages/sdk/src/__integration__/dvm-lifecycle.test.ts`** -- Integration tests for the full DVM lifecycle: feedback publishing, result publishing, compute settlement, event correlation, error lifecycle, cross-story boundary tests (Tasks 2, 3, 4, 5). Uses `vitest.integration.config.ts` with 30s timeout.
2. **`packages/sdk/src/dvm-lifecycle.test.ts`** -- Unit tests for the three new `ServiceNode` helper methods: `publishFeedback()`, `publishResult()`, `settleCompute()` (Task 1). Co-located with `create-node.ts`.

### What to Modify (Existing Files)

1. **`packages/sdk/src/create-node.ts`** -- Add three new methods to the `ServiceNode` interface and their implementations in the `createNode()` closure:
   - `publishFeedback(requestEventId, customerPubkey, status, content?)` -- Builds feedback event and delegates to `publishEvent()`.
   - `publishResult(requestEventId, customerPubkey, amount, content, options?)` -- Builds result event and delegates to `publishEvent()`.
   - `settleCompute(resultEvent, providerIlpAddress, options?)` -- Extracts amount from result event, optionally validates against original bid (E5-R005), and sends ILP payment.
   - **Import additions:** `buildJobFeedbackEvent`, `buildJobResultEvent`, `parseJobResult` from `@toon-protocol/core`.
   - **Interface additions:** Add the three method signatures to the `ServiceNode` interface (line ~168). `settleCompute` includes `options?: { originalBid?: string }` for bid validation (E5-R005).
   - **Implementation location:** Inside the returned `node` object literal (after `publishEvent()` at line ~798).

2. **`packages/sdk/src/index.ts`** (if needed) -- Ensure the updated `ServiceNode` type with new methods is properly exported.

### Test Requirements (aligned with test-design-epic-5.md + story extensions)

> **Note:** Test IDs T-5.3-01 through T-5.3-16 are from `test-design-epic-5.md` Section 3 (Story 5.3). Test IDs T-5.3-17+ are story-defined extensions for additional coverage identified during story creation. Cross-story IDs T-INT-02 and T-INT-03 are from `test-design-epic-5.md` Section 4. Cross-story IDs T-INT-07+ are story-defined extensions.

**Epic-level tests (from test-design-epic-5.md):**

| ID | Test | Level | Priority | Risk | Task |
|----|------|-------|----------|------|------|
| T-5.3-01 | Provider publishes Kind 7000 feedback (`status: 'processing'`) via ILP PREPARE -> relay stores -> customer receives via subscription | I | P1 | E5-R008 | 2.1 |
| T-5.3-02 | Provider publishes Kind 6xxx result with `e` (request ID), `p` (customer pubkey), `amount` (compute cost) via ILP PREPARE -> relay stores -> customer receives | I | P0 | E5-R007 | 2.2 |
| T-5.3-03 | Compute settlement: customer reads Kind 6xxx -> extracts provider ILP address from kind:10035 -> `settleCompute()` sends ILP payment to provider | I | P0 | E5-R007 | 3.1 |
| T-5.3-04 | Compute settlement amount validation: `settleCompute()` rejects when Kind 6xxx `amount` > original Kind 5xxx `bid` | U | P0 | E5-R005 | 1.9 |
| T-5.3-05 | Compute settlement amount validation: `settleCompute()` accepts when Kind 6xxx `amount` <= original Kind 5xxx `bid` | U | P0 | E5-R005 | 1.10 |
| T-5.3-06 | Provider ILP address resolution: customer reads provider's kind:10035 event -> extracts `ilpAddress` field -> uses for compute payment routing | I | P1 | E5-R006 | 3.2 |
| T-5.3-07 | Provider ILP address not found: provider has no kind:10035 event -> `settleCompute()` returns clear error | U | P1 | E5-R006 | 3.3 |
| T-5.3-08 | Error handling: provider publishes Kind 7000 with `status: 'error'` and error details -> no compute payment expected | I | P1 | E5-R008 | 2.3 |
| T-5.3-09 | Full lifecycle: customer posts Kind 5100 -> provider sends Kind 7000 (`processing`) -> provider sends Kind 6100 result -> customer calls `settleCompute()` -> provider receives ILP payment | I | P0 | E5-R005, E5-R007 | 4.1 |
| T-5.3-10 | SDK helper: `publishFeedback(requestId, customerPubkey, status)` constructs valid Kind 7000 event with `e` and `status` tags | U | P1 | -- | 1.5 |
| T-5.3-11 | SDK helper: `publishResult(requestId, customerPubkey, amount, content)` constructs valid Kind 6xxx event with `e`, `p`, `amount` tags | U | P1 | -- | 1.6 |
| T-5.3-12 | SDK helper: `settleCompute(resultEvent, providerIlpAddress)` extracts amount and sends payment with empty data | U | P1 | -- | 1.7 |
| T-5.3-13 | Compute payment uses existing EVM payment channels (same infrastructure as relay write fees; no separate channel creation needed) | I | P2 | E5-R007 | 3.1 |
| T-5.3-14 | Multi-hop routing: compute payment routes through ILP mesh (customer -> relay node -> provider node) when customer and provider are not directly peered | I | P2 | E5-R007 | 3.4 |
| T-5.3-15 | Full lifecycle E2E: customer + provider on genesis infrastructure -> complete job cycle with ILP compute settlement | E2E | P3 | E5-R005, E5-R007 | (deferred) |
| T-5.3-16 | Feedback and result events pay `basePricePerByte * toonData.length` (standard pricing, no DVM-specific overrides) | U | P1 | -- | 2.4 |

**Story-defined extension tests:**

| ID | Test | Level | Priority | Task |
|----|------|-------|----------|------|
| T-5.3-17 | `settleCompute()` throws `NodeError` for malformed result event (no amount tag) | U | P1 | 1.8 |
| T-5.3-18 | `settleCompute()` with `originalBid` omitted -> no bid validation, payment proceeds | U | P1 | 1.11 |
| T-5.3-19 | Customer receives feedback + result correlated by `requestEventId` in `e` tag | I | P1 | 4.2 |
| T-5.3-20 | Error lifecycle: request -> error feedback -> no result -> no settlement | I | P1 | 4.3 |

**Cross-story integration tests (from test-design-epic-5.md):**

| ID | Boundary | Test | Level | Priority | Task |
|----|----------|------|-------|----------|------|
| T-INT-02 | 5.2 -> 5.3 | Provider's Kind 6xxx result references customer's Kind 5xxx via `e` tag; customer resolves reference from relay | I | P0 | 4.1 |
| T-INT-03 | 5.1 -> 5.3 | Kind 6xxx `amount` tag preserved through TOON encode/decode and parseable as USDC micro-units | I | P0 | 5.3 |

**Story-defined cross-story extension tests:**

| ID | Boundary | Test | Level | Priority | Task |
|----|----------|------|-------|----------|------|
| T-INT-07 | 5.1 -> 5.3 | Kind 6100 result with complex content survives TOON roundtrip with all tags intact | I | P0 | 5.1 |
| T-INT-08 | 5.1 -> 5.3 | Kind 7000 feedback with all four status values survives TOON roundtrip | I | P0 | 5.2 |

### Risk Mitigation

> **Note:** Epic-level risks (E5-Rxx) are from `test-design-epic-5.md` Section 2. Story-level risks (S5.3-Rx) are additional assessments specific to implementation details not covered at epic level.

**E5-R005 (Score 6, HIGH): Compute Settlement Amount Manipulation** -- Without bid validation, a malicious provider can drain customer funds by inflating the result `amount` tag. This is the most critical security boundary in Epic 5. Mitigation: `settleCompute()` accepts an optional `originalBid` parameter; when provided, validates `BigInt(amount) <= BigInt(originalBid)` before sending payment. Tests T-5.3-04, T-5.3-05, T-5.3-09 validate this. **Code-level verification:** Assert that `settleCompute()` rejects when amount exceeds bid. If the original event cannot be resolved, the caller must pass the bid explicitly.

**E5-R006 (Score 4): Provider ILP Address Resolution** -- Customer must look up the provider's ILP address from kind:10035 service discovery events. If the provider has not published a kind:10035 event, or if the event is stale, the payment will fail. Tests T-5.3-06, T-5.3-07 validate the extraction path. Mitigation: `settleCompute()` takes the ILP address as an explicit parameter -- the caller is responsible for address resolution (S5.3-R4).

**E5-R007 (Score 6, HIGH): Compute Settlement ILP Routing** -- Compute settlement uses the SAME `ilpClient.sendIlpPacket()` API as relay write fees -- no special routing logic. Provider ILP address extracted from kind:10035. Tests T-5.3-03, T-5.3-09, T-5.3-13, T-5.3-14 validate this. Dependency: relies on ILP routing from Epics 1-2 and payment channel infrastructure from Epic 3.

**E5-R008 (Score 4): Feedback Event Lifecycle** -- Kind 7000 feedback events must be published and stored correctly across the processing/error/success/partial status values. Tests T-5.3-01, T-5.3-08, T-5.3-20 validate this.

**S5.3-R1 (Score 4): ServiceNode interface expansion** -- Adding three new methods to the `ServiceNode` interface and `createNode()` closure. Low-medium risk because the implementation delegates to existing, well-tested primitives. Tests T-5.3-10, T-5.3-11, T-5.3-12 validate each helper.

**S5.3-R2 (Score 6): Compute settlement as pure ILP value transfer** -- The `settleCompute()` method sends an ILP payment with `data: ''` (no event payload). This is a new payment pattern -- all previous ILP sends carried TOON-encoded event data. Risk is that connectors or intermediaries may reject empty-data packets. Tests T-5.3-03, T-5.3-07 validate this. Mitigation: ILP PREPARE with empty data is valid per IL-RFC-15 (the data field is optional).

**S5.3-R3 (Score 3): Amount extraction from result event** -- `settleCompute()` uses `parseJobResult()` to extract the `amount` field. If TOON roundtrip corrupts the amount tag, the customer pays the wrong amount. Cross-story test T-INT-03 validates amount preservation through the full pipeline.

### Coding Standards Reminders

- **TypeScript strict mode** -- `noUncheckedIndexedAccess`, handle `T | undefined` from index access
- **Use bracket notation** for index signature access (`obj['key']` not `obj.key`)
- **`.js` extensions** in all imports (`import { foo } from './bar.js'`)
- **No `any` type** -- use `unknown` with type guards (relaxed to `warn` in test files)
- **`import type`** for type-only imports
- **Vitest** with `describe/it` blocks, AAA pattern (Arrange, Act, Assert)
- **Factory functions** for test fixtures (deterministic data, fixed timestamps/keys)
- **Mock connectors** -- SDK tests use structural `EmbeddableConnectorLike` mock with `vi.fn()` for sendPacket, registerPeer, etc.
- **Always mock SimplePool** -- `vi.mock('nostr-tools')` to prevent live relay connections
- **In-memory databases for unit tests** -- Use SQLite `:memory:` for fast, isolated tests
- **Deterministic test data** -- Use fixed timestamps (e.g., `1700000000`), fixed keys, fixed event IDs (not `Date.now()` or `generateSecretKey()` in test assertions)
- **Import from `@toon-protocol/core/toon`** for TOON encode/decode in SDK tests (not `@toon-protocol/relay`)
- **Lint-check immediately after writing code** -- `pnpm lint` before marking any task complete

### Implementation Approach

1. **Interface expansion first (Task 1.4):** Add the three new method signatures to `ServiceNode` interface. This is the API design step.
2. **Unit tests for helpers (Task 1.5-1.8):** Write unit tests using mocked connector and `vi.fn()` for `publishEvent()` and `ilpClient.sendIlpPacket()`. These tests validate the delegation pattern.
3. **Implement helper methods (Task 1.1-1.3):** Implement `publishFeedback()`, `publishResult()`, `settleCompute()` inside the `createNode()` closure. Each is ~10-20 lines: validate inputs, build event (for feedback/result), optional bid validation for `settleCompute()` (E5-R005), delegate to existing infrastructure.
4. **Integration tests (Tasks 2-5):** Validate the helpers work within the full SDK pipeline. These tests use the same mocked connector pattern from Story 5.2's integration tests.

**secretKey access pattern:** The `createNode()` closure already has access to `config.secretKey` (line ~269, used by `fromSecretKey()` and passed to bootstrap/discovery) and `ilpClient` (line ~455). The new methods will use `config.secretKey` for event building and `ilpClient` for settlement. No new wiring needed.

**publishResult kind derivation:** The `options.kind` parameter defaults to 6100 (text generation result = 5100 + 1000). Callers can override for other DVM kinds (e.g., `{ kind: 6200 }` for image generation results). The kind must be in the 6000-6999 range, validated by `buildJobResultEvent()`.

**settleCompute data field:** The `data: ''` empty string signals a pure value transfer. The ILP protocol allows empty data in PREPARE packets (IL-RFC-15). After `buildIlpPrepare()` converts to base64, the data field will be an empty base64 string (`''`). The `settleCompute()` method bypasses `buildIlpPrepare()` and calls `ilpClient.sendIlpPacket()` directly because there is no TOON data to encode -- this is a payment, not an event publish.

**Expected test count:** ~25-35 tests (20 from story/epic test design + amplification for edge cases and boundary conditions).

**Expected production code changes:** ~60-90 lines in `create-node.ts` (3 method implementations + bid validation logic + interface additions + imports).

### Project Structure Notes

- New helper methods are added to the existing `ServiceNode` interface and `createNode()` function -- no new source files.
- Test files follow the co-location convention: unit test `dvm-lifecycle.test.ts` next to `create-node.ts`, integration test in `__integration__/dvm-lifecycle.test.ts`.
- Naming follows the project convention: `publishFeedback`, `publishResult`, `settleCompute` (camelCase verbs).
- The `settleCompute` name matches the epics.md description. The signature is expanded from `settleCompute(resultEvent)` to `settleCompute(resultEvent, providerIlpAddress, options?)` -- see AC #6 deviation note.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` -- Epic 5 description, Story 5.3 definition, DVM lifecycle diagram, FR-DVM-3]
- [Source: `_bmad-output/planning-artifacts/research/party-mode-2020117-analysis-2026-03-10.md` -- Decisions 2, 4, 6]
- [Source: `_bmad-output/planning-artifacts/test-design-epic-5.md` -- DVM Compute Marketplace test design. Section 3 Story 5.3 tests (T-5.3-01 through T-5.3-16), Section 4 cross-story integration tests (T-INT-01 through T-INT-06), Section 7 risk mitigation for E5-R005 and E5-R007]
- [Source: `_bmad-output/implementation-artifacts/5-1-dvm-event-kind-definitions.md` -- Story 5.1 completed (builders, parsers, constants in `@toon-protocol/core`)]
- [Source: `_bmad-output/implementation-artifacts/5-2-ilp-native-job-submission.md` -- Story 5.2 completed (validation tests, pipeline handles Kind 5xxx, handler dispatch for DVM kinds)]
- [Source: `_bmad-output/project-context.md` -- SDK Pipeline, publishEvent(), Handler Pattern, Testing Rules, Naming Conventions, Chain Configuration]
- [Source: `packages/sdk/src/create-node.ts` -- ServiceNode interface (line ~168), publishEvent() implementation (line ~735), createNode() closure variables (config.secretKey at ~269, ilpClient at ~455)]
- [Source: `packages/core/src/events/dvm.ts` -- buildJobFeedbackEvent() (line ~413), buildJobResultEvent() (line ~340), parseJobResult() (line ~572), parseJobFeedback() (line ~621), JobResultParams, JobFeedbackParams interfaces]
- [Source: `packages/core/src/events/service-discovery.ts` -- parseServiceDiscovery() (line ~92), ServiceDiscoveryContent.ilpAddress field (line ~28)]
- [Source: `packages/core/src/bootstrap/types.ts` -- IlpClient interface (line ~162), IlpSendResult interface (line ~151), sendIlpPacket signature]
- [Source: `packages/core/src/x402/build-ilp-prepare.ts` -- buildIlpPrepare() function, BuildIlpPrepareParams interface, IlpPreparePacket interface]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Direct ILP client empty data fix: `createDirectIlpClient()` in `packages/core/src/bootstrap/direct-ilp-client.ts` was attempting to TOON-decode empty data payloads from `settleCompute()`, causing "Invalid event id" errors. Fixed by adding `data.length > 0` guard before toon decoding (line 115).

### Completion Notes List

- **Task 1 (SDK helper methods):** Implemented three new methods on the `ServiceNode` interface and `createNode()` closure:
  - `publishFeedback(requestEventId, customerPubkey, status, content?, options?)` -- builds Kind 7000 feedback event via `buildJobFeedbackEvent()` and delegates to `publishEvent()`.
  - `publishResult(requestEventId, customerPubkey, amount, content, options?)` -- builds Kind 6xxx result event via `buildJobResultEvent()` with configurable kind (default 6100) and delegates to `publishEvent()`.
  - `settleCompute(resultEvent, providerIlpAddress, options?)` -- extracts amount from result event via `parseJobResult()`, validates against original bid (E5-R005) when `options.originalBid` is provided, and sends pure ILP value transfer with `data: ''`.
  - Added imports for `buildJobFeedbackEvent`, `buildJobResultEvent`, `parseJobResult` from `@toon-protocol/core` and type imports for `DvmJobStatus`, `IlpSendResult`.
  - ~80 lines of production code added to `create-node.ts` (interface + implementation).

- **Task 2 (Unit tests updated to GREEN):** Updated `dvm-lifecycle.test.ts` from RED to GREEN phase: removed all `(node as any)` casts (now using typed `ServiceNode` method calls), updated implementation phase comment. All 20 unit tests pass.

- **Task 3 (Integration tests updated to GREEN):** Updated `__integration__/dvm-lifecycle.test.ts` from RED to GREEN phase: removed all `(node as any)`, `(providerNode as any)`, `(customerNode as any)` casts. Updated implementation phase comment. All 16 integration tests pass.

- **Task 4 (Validation):** Build, lint (0 errors), and full monorepo test suite pass. Total: 2083 unit tests + 52 SDK integration tests. No test regressions.

- **Infrastructure fix (direct-ilp-client.ts):** The `createDirectIlpClient()` in `@toon-protocol/core` was unconditionally attempting to TOON-decode the `data` field of ILP packets. When `settleCompute()` sends an empty data field (pure value transfer), this caused a TOON decode error. Added a `data.length > 0` guard to skip TOON decoding for empty payloads. This is valid per IL-RFC-15 (the data field is optional in ILP PREPARE packets).

### Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-03-16 | Claude Opus 4.6 (story creation, yolo mode) | Created story file with 7 ACs, 5 tasks (~20 subtasks), dev notes with architecture analysis, test design (14 story tests + 3 cross-story tests), risk mitigation (4 risks), implementation approach, and full source references. First Epic 5 story with new production code (3 SDK helper methods). |
| 2026-03-16 | Claude Opus 4.6 (adversarial review, yolo mode) | **11 issues found, all fixed.** (1) HIGH: Added missing AC #8 for bid validation (E5-R005 critical security boundary) -- `settleCompute()` now validates `amount <= bid` when `originalBid` is provided. Added tasks 1.9, 1.10, 1.11 and test IDs T-5.3-04/T-5.3-05 from test-design. (2) MEDIUM: Corrected false claim that test-design-epic-5.md covers the "old Rig" -- it actually contains DVM test scenarios (T-5.3-01 through T-5.3-16, E5-R005 through E5-R008). Updated note and all references. (3) MEDIUM: Realigned all test IDs to match test-design-epic-5.md numbering. Story-defined extensions now start at T-5.3-17+. (4) MEDIUM: Added epic-level risks E5-R005, E5-R006, E5-R007, E5-R008 from test-design to risk mitigation section. (5) MEDIUM: Added cross-story test IDs T-INT-02 and T-INT-03 from test-design (were missing). Removed T-INT-09 (now covered by T-INT-03). (6) LOW: Added `settleCompute` signature deviation note from epics.md (expanded from single-param to three-param). (7) LOW: Added `publishJobRequest` omission note to AC #6. (8) LOW: Filled empty File List section with expected files. (9) LOW: Replaced `{{agent_model_name_version}}` template variable with placeholder text. (10) LOW: Updated expected test/code counts for bid validation additions. (11) LOW: Updated Project Structure Notes for settleCompute signature change. |
| 2026-03-16 | Claude Opus 4.6 (dev implementation, yolo mode) | **Story 5.3 implemented.** Added 3 new methods to ServiceNode interface (`publishFeedback`, `publishResult`, `settleCompute`). ~80 lines production code in `create-node.ts`. Fixed `createDirectIlpClient()` in core to handle empty data payloads (pure ILP value transfers). Updated 34 tests from RED to GREEN phase (removed `as any` casts). All 2083+ tests pass, 0 lint errors, 0 regressions. |
| 2026-03-16 | Claude Opus 4.6 (test review, yolo mode) | **6 issues found, all fixed.** (1) MEDIUM: T-5.3-16 pricing assertions were too weak (asserted `> 0` instead of verifying `basePricePerByte * toonData.length`). Strengthened both publishFeedback and publishResult pricing tests to compute expected value from actual TOON data length. (2) LOW: Empty data assertions used redundant `||` check pattern (`data.length === 0 || (data instanceof Uint8Array && data.length === 0)`) -- simplified to `toBeInstanceOf(Uint8Array) + length === 0` across 5 occurrences in unit and integration tests. (3) LOW: T-5.3-10/T-5.3-11 unit test names claimed tag verification but only tested delegation -- updated names to accurately describe what they assert. (4) LOW: T-5.3-07 test description didn't match test-design intent -- added clarifying comment about the divergence. (5) LOW: Inline `generateSecretKey()` in Cross-Story Boundary test replaced with describe-scoped `customerSecretKey` for consistency. (6) LOW: Story file metadata said "14 integration tests" but actual count is 16 -- corrected. All 2025 tests pass, 0 errors, 0 regressions. |
| 2026-03-16 | Claude Opus 4.6 (code review, yolo mode) | **3 issues found, all fixed.** (1) MEDIUM: `settleCompute()` BigInt conversion for bid validation not wrapped in try-catch -- non-numeric `computeAmount` or `originalBid` strings cause unguarded `SyntaxError` instead of `NodeError`. Added try-catch around both `BigInt()` calls with descriptive `NodeError` messages. (2) MEDIUM: `settleCompute()` missing defensive validation for empty `providerIlpAddress` -- an empty string would be passed silently to `ilpClient.sendIlpPacket()`. Added guard at method entry. (3) LOW: Three guard tests (publishFeedback/publishResult/settleCompute before start) used `.rejects.toThrow()` without specifying `NodeError` error type -- weakened assertion. Strengthened to `.rejects.toThrow(NodeError)`. Added 3 new unit tests for the two new guards. All 213 SDK unit tests + 54 SDK integration tests pass. 0 lint errors, 0 regressions. |
| 2026-03-16 | Claude Opus 4.6 (code review #2, yolo mode) | **3 issues found, all fixed.** (1) MEDIUM: `settleCompute()` whitespace-only `providerIlpAddress` not caught by guard (truthy but useless). Added `.trim()` check. (2) MEDIUM: `settleCompute()` non-numeric `computeAmount` without bid validation leaks `BootstrapError`. Moved amount validation before bid check to run unconditionally. (3) LOW: Review Pass #1 documentation inconsistent with code for whitespace handling. Fixed code to match documentation. Added 2 unit tests. All 215 SDK unit + 54 integration tests pass. 0 lint errors, 0 regressions. |
| 2026-03-16 | Claude Opus 4.6 (code review #3, yolo mode + security audit) | **1 issue found, fixed.** (1) MEDIUM: `settleCompute()` accepts negative amounts -- a result event with `amount: '-1000000'` would pass bid validation and send a negative ILP payment, causing undefined behavior in the ILP layer. Added `amountBigInt < 0n` guard. Added 1 unit test. OWASP top 10 + custom security audit completed with 0 additional findings. All 216 SDK unit + 54 integration tests pass. Full monorepo: 2031 passing + 79 skipped. 0 lint errors, 0 regressions. |

### File List

| File | Action | Purpose |
|------|--------|---------|
| `packages/sdk/src/create-node.ts` | **MODIFY** | Added `publishFeedback()`, `publishResult()`, `settleCompute()` to ServiceNode interface and createNode() closure. Added imports for DVM builders/parsers from `@toon-protocol/core`. |
| `packages/core/src/bootstrap/direct-ilp-client.ts` | **MODIFY** | Added `data.length > 0` guard to skip TOON decoding for empty data payloads (pure ILP value transfers from `settleCompute()`). |
| `packages/sdk/src/dvm-lifecycle.test.ts` | **MODIFY** | Updated from RED to GREEN phase: removed `(node as any)` casts, updated comments. 20 unit tests pass. |
| `packages/sdk/src/__integration__/dvm-lifecycle.test.ts` | **MODIFY** | Updated from RED to GREEN phase: removed `as any` casts, updated comments. 14 integration tests pass. |
| `_bmad-output/implementation-artifacts/5-3-job-result-delivery-and-compute-settlement.md` | **MODIFY** | Populated Dev Agent Record: Agent Model, Completion Notes, Change Log, File List. |

## Code Review Record

### Review Pass #1

- **Date:** 2026-03-16
- **Reviewer model:** Claude Opus 4.6 (claude-opus-4-6)
- **Issue counts:** Critical: 0, High: 0, Medium: 2, Low: 1
- **Outcome:** All issues resolved in-pass. No outstanding follow-up tasks.

**Issues found and fixed:**

| # | Severity | Description | Resolution |
|---|----------|-------------|------------|
| 1 | Medium | `settleCompute()` BigInt conversion for bid validation not wrapped in try-catch -- non-numeric `computeAmount` or `originalBid` strings cause unguarded `SyntaxError` instead of `NodeError`. | Added try-catch around both `BigInt()` calls with descriptive `NodeError` messages. Added unit tests for non-numeric input validation. |
| 2 | Medium | `settleCompute()` missing defensive validation for empty `providerIlpAddress` -- an empty string would be passed silently to `ilpClient.sendIlpPacket()`. | Added guard at method entry that throws `NodeError` when `providerIlpAddress` is empty or whitespace. Added unit test for the guard. |
| 3 | Low | Three guard tests (`publishFeedback`/`publishResult`/`settleCompute` before start) used `.rejects.toThrow()` without specifying `NodeError` error type -- weakened assertion that doesn't verify the correct error class. | Strengthened all three to `.rejects.toThrow(NodeError)`. |

**Tests added during review:** 3 new unit tests for the BigInt conversion guard (issue #1) and empty ILP address guard (issue #2). SDK unit test count increased from 210 to 213.

**Post-review verification:** All 213 SDK unit tests + 54 SDK integration tests pass. 0 lint errors, 0 regressions.

### Review Pass #2

- **Date:** 2026-03-16
- **Reviewer model:** Claude Opus 4.6 (claude-opus-4-6)
- **Issue counts:** Critical: 0, High: 0, Medium: 2, Low: 1
- **Outcome:** All issues resolved in-pass. No outstanding follow-up tasks.

**Issues found and fixed:**

| # | Severity | Description | Resolution |
|---|----------|-------------|------------|
| 1 | Medium | `settleCompute()` whitespace-only `providerIlpAddress` (e.g., `'   '`) not caught by the guard. The check `!providerIlpAddress` is a falsy check, but whitespace-only strings are truthy and would be passed silently to `ilpClient.sendIlpPacket()`. | Added `.trim() === ''` check to the existing guard. Added unit test for whitespace-only ILP address. |
| 2 | Medium | `settleCompute()` does not validate that `computeAmount` is a valid numeric string when `originalBid` is NOT provided. If `parseJobResult()` returns a non-numeric amount (e.g., from a malformed event), it propagates to `ilpClient.sendIlpPacket()` which throws `BootstrapError` instead of `NodeError`, leaking internal implementation details. | Moved `BigInt(computeAmount)` validation before the bid check so it runs unconditionally. Added unit test for non-numeric amount without bid validation. |
| 3 | Low | Review Pass #1 record claims the guard catches "empty or whitespace" `providerIlpAddress`, but the actual code only caught falsy values (empty string, null, undefined), not whitespace-only. Documentation inconsistent with implementation. | Fixed the code to match the documented behavior (issue #1 above). |

**Tests added during review:** 2 new unit tests for the whitespace-only ILP address guard (issue #1) and non-numeric amount without bid validation (issue #2). SDK unit test count increased from 213 to 215.

**Post-review verification:** All 215 SDK unit tests + 54 SDK integration tests pass. Full monorepo: 2087+ tests passing. 0 lint errors, 0 regressions.

### Review Pass #3

- **Date:** 2026-03-16
- **Reviewer model:** Claude Opus 4.6 (claude-opus-4-6)
- **Issue counts:** Critical: 0, High: 0, Medium: 1, Low: 0
- **Outcome:** All issues resolved in-pass. No outstanding follow-up tasks.
- **Security focus:** OWASP top 10 audit, authentication/authorization review, injection risk analysis, financial integrity checks.

**Issues found and fixed:**

| # | Severity | Description | Resolution |
|---|----------|-------------|------------|
| 1 | Medium | `settleCompute()` accepts negative amounts: a result event with `amount: '-1000000'` converts to `BigInt(-1000000n)`, passes bid validation (since -1000000 <= any positive bid), and sends a negative ILP payment. This could cause undefined behavior in the ILP layer (financial integrity violation). | Added `amountBigInt < 0n` guard after BigInt conversion that throws `NodeError`. Added unit test for negative amount rejection. |

**Security audit findings (OWASP top 10 + custom checks):**

| Check | Result | Notes |
|-------|--------|-------|
| A01 Broken Access Control | PASS | `settleCompute()` requires `start()` gate; `publishFeedback`/`publishResult` delegate to `publishEvent()` which has its own `start()` gate |
| A02 Cryptographic Failures | PASS | Event signing uses `config.secretKey` from closure scope; no key leakage in error messages or logs |
| A03 Injection | PASS | `providerIlpAddress` is validated (non-empty, non-whitespace); amount values go through `BigInt()` conversion which rejects injection payloads; error messages interpolate values but are thrown as exceptions (not HTTP responses) |
| A04 Insecure Design | PASS | Bid validation (E5-R005) prevents provider overcharge; negative amount guard prevents ILP underflow |
| A05 Security Misconfiguration | N/A | No configuration changes in this story |
| A06 Vulnerable Components | N/A | No new dependencies |
| A07 Auth Failures | PASS | All events signed with provider's secret key via `finalizeEvent()`; customer must explicitly provide `originalBid` for bid validation (defense-in-depth) |
| A08 Data Integrity | PASS | Amount preserved through TOON roundtrip (validated by T-INT-03); bid validation uses BigInt comparison (no floating-point) |
| A09 Logging/Monitoring | PASS | Error messages are descriptive for SDK callers; no sensitive data logged |
| A10 SSRF | N/A | No outbound HTTP requests in new code |
| Custom: Amount manipulation | PASS (after fix) | Negative amounts now rejected; non-numeric amounts rejected; bid validation enforced when `originalBid` provided |
| Custom: Provider ILP address validation | PASS | Empty, whitespace-only, null, undefined all rejected with descriptive errors |

**Tests added during review:** 1 new unit test for negative amount rejection. SDK unit test count increased from 215 to 216.

**Post-review verification:** All 216 SDK unit tests + 54 SDK integration tests pass. Full monorepo: 2031 tests passing + 79 skipped. 0 lint errors, 0 regressions.
