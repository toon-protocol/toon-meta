# Story 2.6: Add publishEvent() to ServiceNode

Status: done

## Story

As a **developer building on the Crosstown SDK**,
I want `ServiceNode` to expose a `publishEvent(event, options)` method that sends Nostr events through the embedded connector,
So that I can send outbound ILP packets without manually encoding TOON, computing conditions, or calling low-level connector APIs.

**Dependencies:** Stories 2.1-2.5 (done). Requires: `@crosstown/sdk` with `createNode()` and `ServiceNode` (Story 1.7), `AgentRuntimeClient` interface from `@crosstown/core` (already exported), TOON encoder from `@crosstown/core/toon`.

## Acceptance Criteria

1. Given a started `ServiceNode`, when I call `node.publishEvent(event, { destination })`, then the event is TOON-encoded via the configured encoder, priced at `basePricePerByte * BigInt(toonData.length)`, converted to base64, and sent via `AgentRuntimeClient.sendIlpPacket()` (which internally computes execution condition `SHA256(SHA256(event.id))` and handles base64/Uint8Array conversion).
2. Given a started `ServiceNode`, when I call `node.publishEvent(event)` without options or with an empty destination, then a `NodeError` is thrown with a clear message indicating that `destination` is required.
3. Given a `ServiceNode` that has not been started, when I call `node.publishEvent(event, { destination })`, then a `NodeError` is thrown with message "Cannot publish: node not started. Call start() first."
4. Given a successful publish, when `publishEvent()` resolves, then it returns `{ success: true, eventId: string, fulfillment: string }`. Given a rejected publish, it returns `{ success: false, eventId: string, code: string, message: string }`.
5. Given the `@crosstown/sdk` package, when I import from `@crosstown/sdk`, then `PublishEventResult` type is exported alongside existing exports, and `ServiceNode` includes the `publishEvent` method in its type definition.
6. Given the existing SDK test suite, when I run `pnpm test`, then all existing tests pass and new unit tests cover `publishEvent()` success, rejection, not-started error, and missing-destination error scenarios.

## Tasks / Subtasks

- [x] Task 1: Expose `runtimeClient` from `CrosstownNode` in core (AC: #1)
  - [x] Add `readonly runtimeClient: AgentRuntimeClient` to the `CrosstownNode` interface in `packages/core/src/compose.ts` (line ~213)
  - [x] Return `directRuntimeClient` as `runtimeClient` in the `createCrosstownNode()` return object (line ~347, add to the returned object literal)
  - [x] Verify `AgentRuntimeClient` type is already exported from `@crosstown/core` (it is -- `packages/core/src/index.ts` line 95). No changes needed to core's index.ts.
  - [x] **Import needed:** Add `import type { AgentRuntimeClient } from './bootstrap/types.js'` at top of compose.ts (if not already present -- check existing imports)

- [x] Task 2: Add `publishEvent()` to `ServiceNode` interface and implementation (AC: #1, #2, #3, #4, #5)
  - [x] Add `PublishEventResult` type to `packages/sdk/src/create-node.ts`:
    ```typescript
    export interface PublishEventResult {
      success: boolean;
      eventId: string;
      fulfillment?: string;
      code?: string;
      message?: string;
    }
    ```
  - [x] Add `publishEvent(event: NostrEvent, options?: { destination: string }): Promise<PublishEventResult>` to the `ServiceNode` interface (line ~102). Note: `options` parameter is optional at the type level but destination is validated at runtime.
  - [x] Implement `publishEvent()` in the `createNode()` closure on the returned `node` object (line ~328):
    1. Guard: throw `NodeError` if `!started` (AC #3) -- message: `"Cannot publish: node not started. Call start() first."`
    2. Guard: throw `NodeError` if `!options?.destination` (AC #2) -- message: `"Cannot publish: destination is required. Pass { destination: 'g.peer.address' }."`
    3. TOON-encode the event: `const toonData = encoder(event)` -- the `encoder` variable is already in scope (line 184, captured from `config.toonEncoder ?? encodeEventToToon`)
    4. Compute amount: `const amount = (config.basePricePerByte ?? 10n) * BigInt(toonData.length)`
    5. Convert to base64: `const base64Data = Buffer.from(toonData).toString('base64')`
    6. Call `crosstownNode.runtimeClient.sendIlpPacket({ destination: options.destination, amount: String(amount), data: base64Data })` -- **CRITICAL:** `amount` must be converted to `String()` because `AgentRuntimeClient.sendIlpPacket()` accepts `amount: string`, not bigint. The runtime client handles: base64 -> Uint8Array conversion, execution condition computation (`SHA256(SHA256(event.id))` via toonDecoder), and result mapping.
    7. Map `IlpSendResult` to `PublishEventResult`:
       - If `result.accepted`: return `{ success: true, eventId: event.id, fulfillment: result.fulfillment ?? '' }`
       - If `!result.accepted`: return `{ success: false, eventId: event.id, code: result.code ?? 'T00', message: result.message ?? 'Unknown error' }`
  - [x] Wrap the sendIlpPacket call in try/catch -- propagate `NodeError` directly, wrap other errors in `NodeError` (same pattern as `start()` at line 388)

- [x] Task 3: Update SDK exports (AC: #5)
  - [x] Add `PublishEventResult` to the type exports in `packages/sdk/src/index.ts`:
    ```typescript
    export type { NodeConfig, ServiceNode, StartResult, PublishEventResult } from './create-node.js';
    ```
    (Update the existing export line at line 64 to include `PublishEventResult`)
  - [x] Verify `ServiceNode` type export already includes the new method (it does, since it's on the interface)

- [x] Task 4: Write unit tests for `publishEvent()` (AC: #6)
  - [x] Create `packages/sdk/src/publish-event.test.ts` (co-located test file following project convention):
    - Test: `publishEvent()` TOON-encodes the event and sends via runtimeClient.sendIlpPacket() with correct parameters
    - Test: `publishEvent()` computes correct amount as `String(basePricePerByte * BigInt(toonData.length))`
    - Test: `publishEvent()` returns `{ success: true, eventId, fulfillment }` when runtimeClient returns `{ accepted: true, fulfillment }`
    - Test: `publishEvent()` returns `{ success: false, eventId, code, message }` when runtimeClient returns `{ accepted: false, code, message }`
    - Test: `publishEvent()` throws `NodeError` with "not started" message when node not started
    - Test: `publishEvent()` throws `NodeError` with "destination is required" message when destination is missing
    - Test: `publishEvent()` throws `NodeError` with "destination is required" message when options is undefined
    - Test: `publishEvent()` uses custom `basePricePerByte` from config when provided
    - Test: `publishEvent()` uses default `basePricePerByte` (10n) when not configured
  - [x] **Mock strategy:** Create a mock `EmbeddableConnectorLike` with `vi.fn()` for `sendPacket`, `registerPeer`, `removePeer`, and `setPacketHandler`. For the `runtimeClient`, the test must exercise the full `createNode()` -> `start()` -> `publishEvent()` flow, so the mock connector's `sendPacket` should return a fulfill/reject result. The `createCrosstownNode()` internally creates the `directRuntimeClient` which wraps `connector.sendPacket()`. This means the mock connector's `sendPacket` IS what gets called.
  - [x] **Test setup pattern** (from existing `create-node.test.ts`):
    ```typescript
    const mockConnector: EmbeddableConnectorLike = {
      sendPacket: vi.fn(),
      registerPeer: vi.fn(),
      removePeer: vi.fn(),
      setPacketHandler: vi.fn(),
    };
    ```
  - [x] **Mock SimplePool** -- add `vi.mock('nostr-tools')` to prevent live relay connections (required per project rules)
  - [x] Use deterministic test data: fixed secret key, fixed event ID, fixed TOON bytes

- [x] Task 5: Build, test, and verify (AC: all)
  - [x] Run `pnpm build` -- all packages build
  - [x] Run `pnpm test` -- all unit/integration tests pass (existing + new)
  - [x] Run `pnpm lint` -- 0 errors
  - [x] Run `pnpm format:check` -- all files pass

## Dev Notes

### What This Story Does

Adds a single method -- `publishEvent()` -- to the SDK's `ServiceNode` interface, completing the symmetric API: inbound events arrive via handlers (`node.on(kind, handler)`), outbound events depart via `node.publishEvent(event, { destination })`.

### Architecture

The `DirectRuntimeClient` is created inside `createCrosstownNode()` at `packages/core/src/compose.ts` line 292. It wraps `connector.sendPacket()` with:
- Base64 to Uint8Array conversion for data
- String to BigInt conversion for amount
- Execution condition computation: `fulfillment = SHA256(event.id)`, then `condition = SHA256(fulfillment)` (lines 101-106 of direct-runtime-client.ts)
- Result mapping: `{ type: 'fulfill', fulfillment, data }` -> `{ accepted: true, fulfillment }` or `{ type: 'reject', code, message }` -> `{ accepted: false, code, message }`

The `publishEvent()` method adds one thin layer on top of `AgentRuntimeClient.sendIlpPacket()`:
- TOON encoding (using the `encoder` already in `createNode()` scope -- line 184)
- Amount computation: `String(basePricePerByte * BigInt(toonData.length))` -- must be `String()` because `sendIlpPacket` accepts `amount: string`
- Base64 conversion of TOON bytes
- Friendly result type (`PublishEventResult`)

### Data Flow

```
publishEvent(event, { destination })
  -> encoder(event)                           // NostrEvent -> Uint8Array (TOON bytes)
  -> Buffer.from(toonData).toString('base64') // Uint8Array -> base64 string
  -> crosstownNode.runtimeClient.sendIlpPacket({
       destination,
       amount: String(basePricePerByte * BigInt(toonData.length)),
       data: base64Data
     })
     // Inside DirectRuntimeClient.sendIlpPacket():
     //   -> BigInt(params.amount)              // string -> bigint
     //   -> Buffer.from(params.data, 'base64') // base64 -> Uint8Array
     //   -> toonDecoder(data) -> decoded.id    // extract event ID for condition
     //   -> SHA256(decoded.id) = fulfillment
     //   -> SHA256(fulfillment) = executionCondition
     //   -> connector.sendPacket({ destination, amount, data, executionCondition })
  -> map IlpSendResult to PublishEventResult
```

### Key API Contracts

**`AgentRuntimeClient.sendIlpPacket()` signature** (from `packages/core/src/bootstrap/types.ts` line 164):
```typescript
sendIlpPacket(params: {
  destination: string;
  amount: string;      // STRING, not bigint -- must use String() conversion
  data: string;        // base64-encoded TOON
  timeout?: number;
}): Promise<IlpSendResult>;
```

**`IlpSendResult`** (from `packages/core/src/bootstrap/types.ts` line 152):
```typescript
interface IlpSendResult {
  accepted: boolean;
  fulfillment?: string;  // base64-encoded fulfillment (SHA256(event.id))
  data?: string;         // base64-encoded response TOON
  code?: string;         // ILP error code on rejection
  message?: string;      // error message on rejection
}
```

### Key Files

| File | Change | Lines |
|------|--------|-------|
| `packages/core/src/compose.ts` | Add `runtimeClient` to `CrosstownNode` interface + return object | Interface ~213, return ~347 |
| `packages/sdk/src/create-node.ts` | Add `PublishEventResult` type, add `publishEvent()` to `ServiceNode` interface + implementation | Interface ~102, implementation ~328 |
| `packages/sdk/src/index.ts` | Add `PublishEventResult` to type exports | Line 64 |
| `packages/sdk/src/publish-event.test.ts` | New test file for publishEvent() | New file |
| `packages/core/src/bootstrap/direct-runtime-client.ts` | No changes | Read-only reference |

### What NOT to Change

- Do not modify `DirectRuntimeClient` -- it already handles condition computation and format conversion
- Do not modify handler implementations (event-storage, SPSP)
- Do not modify existing tests -- only add new test file
- Do not add HTTP/BTP transport -- this uses the embedded connector path only
- Do not add retry logic -- the connector handles transport-level retries
- Do not break existing SDK exports -- `PublishEventResult` is additive
- Do not modify `@crosstown/core/src/index.ts` -- `AgentRuntimeClient` is already exported (line 95)

### Differences from Client's publishEvent()

The `@crosstown/client` package has a `publishEvent()` on `CrosstownClient` (line 225 of `packages/client/src/CrosstownClient.ts`) that served as the design reference. Key differences:

| Aspect | Client (`CrosstownClient`) | SDK (`ServiceNode`) |
|--------|---------------------------|---------------------|
| Amount source | Hardcoded `basePricePerByte = 10n` | Config-based `config.basePricePerByte ?? 10n` |
| Result type | `{ success, eventId?, fulfillment?, error? }` | `{ success, eventId, fulfillment?, code?, message? }` -- structured error info |
| Error handling | Throws `CrosstownClientError` | Throws `NodeError` |
| Transport | `runtimeClient` or `btpClient` (with optional claim) | `runtimeClient` only (embedded connector) |
| Destination | Falls back to `config.destinationAddress` | Always required in options (no fallback) |

### Critical Rules

- **Never use `any` type** -- use `unknown` with type guards (enforced by ESLint)
- **Always use `.js` extensions in imports** -- ESM requires `import { foo } from './bar.js'`
- **Use consistent type imports** -- `import type { X } from '...'` for type-only imports
- **Amount must be String()** -- `AgentRuntimeClient.sendIlpPacket()` accepts `amount: string`, not bigint
- **Do not break existing exports** -- all current SDK exports must remain unchanged
- **Use existing test patterns** -- mocked connector, no live infrastructure for unit tests
- **Mock SimplePool** -- add `vi.mock('nostr-tools')` to prevent live relay connections
- **Use `NostrEvent` from `nostr-tools/pure`** -- consistent with existing create-node.ts imports (line 11)
- **Follow catch block convention** -- always use `catch (error: unknown)` with explicit `: unknown` annotation
- **`options` parameter is optional at type level** -- validate `destination` at runtime with clear error message

### Project Structure Notes

- Test file `publish-event.test.ts` is co-located in `packages/sdk/src/` following existing convention (e.g., `handler-registry.test.ts`, `create-node.test.ts`)
- `PublishEventResult` type is defined in `create-node.ts` alongside `ServiceNode` and `StartResult` (related types co-located)
- The `runtimeClient` property on `CrosstownNode` follows the same pattern as existing `channelClient` property (lines 239-240 of compose.ts)

### References

- [Source: packages/sdk/src/create-node.ts -- ServiceNode interface (lines 102-123), createNode() implementation (lines 137-429)]
- [Source: packages/core/src/compose.ts -- CrosstownNode interface (lines 213-246), createCrosstownNode() (lines 288-410)]
- [Source: packages/core/src/bootstrap/direct-runtime-client.ts -- createDirectRuntimeClient (lines 80-147), sendIlpPacket with SHA256 condition (lines 85-145)]
- [Source: packages/core/src/bootstrap/types.ts -- AgentRuntimeClient interface (lines 163-184), IlpSendResult (lines 152-158)]
- [Source: packages/sdk/src/index.ts -- SDK public API exports (lines 1-68)]
- [Source: packages/client/src/CrosstownClient.ts -- publishEvent() reference implementation (lines 225-292)]
- [Source: packages/client/src/types.ts -- client PublishEventResult (lines 178-190)]
- [Source: packages/core/src/index.ts -- AgentRuntimeClient already exported (line 95)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed 2 lint errors in ATDD stub test file (unused `vi` import and unused `result` variable)
- Removed publish-event.test.ts from vitest exclude list (was ATDD red phase exclusion)

### Completion Notes List

- Task 1: Added `import type { AgentRuntimeClient }` to compose.ts, added `readonly runtimeClient: AgentRuntimeClient` to `CrosstownNode` interface, exposed `directRuntimeClient` as `runtimeClient` on the return object. Verified `AgentRuntimeClient` is already exported from `@crosstown/core`.
- Task 2: Added `PublishEventResult` interface to `create-node.ts`. Added `publishEvent()` to `ServiceNode` interface with proper JSDoc. Implemented `publishEvent()` on the returned node object with: not-started guard, destination-required guard, TOON encoding, amount computation (`basePricePerByte * BigInt(toonData.length)`), base64 conversion, `sendIlpPacket()` call via `crosstownNode.runtimeClient`, result mapping from `IlpSendResult` to `PublishEventResult`, and error wrapping following the same pattern as `start()`.
- Task 3: Updated `packages/sdk/src/index.ts` to export `PublishEventResult` type alongside existing `NodeConfig`, `ServiceNode`, `StartResult`.
- Task 4: ATDD red-phase test file already existed with 9 comprehensive tests. All 9 tests now pass: TOON-encode + sendPacket parameters, amount computation, success result shape, rejection result shape, not-started guard, undefined options guard, empty destination guard, custom basePricePerByte, default basePricePerByte. Fixed 2 lint errors (unused import, unused variable).
- Task 5: All checks pass -- `pnpm build` (all packages), `pnpm test` (1,443 passed, 185 skipped, 0 failures), `pnpm lint` (0 errors, 381 pre-existing warnings), `pnpm format:check` (all files clean).

### File List

- `packages/core/src/compose.ts` -- Added `AgentRuntimeClient` import, `runtimeClient` to `CrosstownNode` interface and return object
- `packages/sdk/src/create-node.ts` -- Added `PublishEventResult` interface, `publishEvent()` to `ServiceNode` interface and implementation
- `packages/sdk/src/index.ts` -- Added `PublishEventResult` to type exports
- `packages/sdk/src/publish-event.test.ts` -- Unit tests for publishEvent(); added vi.mock('nostr-tools'), post-stop test, exact amount test
- `packages/sdk/vitest.config.ts` -- Removed publish-event.test.ts from ATDD exclusion list
- `vitest.config.ts` -- Removed publish-event.test.ts from root ATDD exclusion list
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Updated story status
- `_bmad-output/project-context.md` -- Updated SDK API with publishEvent() method
- `_bmad-output/planning-artifacts/epics.md` -- Added FR-PROD-7, updated Epic 3 story count
- `_bmad-output/test-artifacts/atdd-checklist-2-6.md` -- ATDD checklist (new file)
- `README.md` -- Removed SPSP references, updated event kind table
- `docs/component-library-documentation.md` -- Fixed connector package name reference

## Change Log

- 2026-03-07: Implemented publishEvent() on ServiceNode -- TOON-encode, price, base64, send via runtimeClient. Exposed runtimeClient from CrosstownNode in core. Added PublishEventResult type export. All 9 ATDD tests pass. 0 regressions across 1,443 tests.
- 2026-03-07: Code review (AI) -- 5 issues found (0 critical, 1 high, 2 medium, 2 low), all fixed. H1: Removed stale ATDD exclusion from root vitest.config.ts. M1: Replaced non-deterministic generateSecretKey() with fixed test key. M2: Added root vitest.config.ts to File List. L1: Updated project-context.md with publishEvent() in SDK API. L2: Cleaned stale "RED PHASE" comment from test header. 1,452 tests pass, 0 lint errors, format clean.
- 2026-03-07: Code review 2 (AI) -- 6 issues found (0 critical, 1 high, 2 medium, 3 low), all fixed. H1: Added vi.mock('nostr-tools') to publish-event.test.ts per project convention. M1: Added 5 missing files to story File List (README.md, epics.md, project-context.md, component-library-documentation.md, atdd-checklist-2-6.md). M2: Checked off all completed ATDD implementation tasks. L1: Replaced non-null assertion with optional chain in test assertion. L2: Added post-stop() publishEvent test. L3: Added exact amount verification test. 1,454 tests pass (2 new), 0 lint errors (1 warning removed), format clean.
- 2026-03-07: Code review 3 (AI) -- 5 issues found (0 critical, 1 high, 2 medium, 2 low), all fixed. H1: Added type import of PublishEventResult from SDK index to verify AC#5 export path. M1: Added TOON encoder failure test covering error wrapping path. M2: Updated epic-2 status to done in sprint-status.yaml (all stories + retro complete). L1: Fixed misleading AC#5 comment in test header. L2: Added afterEach with vi.clearAllMocks() per project convention. 1,455 tests pass (1 new), 0 lint errors, format clean.
