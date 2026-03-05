# Story 1.9: Network Discovery and Bootstrap Integration

Status: done

## Story

As a **service developer**,
I want my node to automatically discover peers, join the network, and monitor for new peers,
So that my service participates in the Crosstown mesh without manual peer configuration.

**FRs covered:** FR-SDK-9 (BootstrapService + RelayMonitor integration for peer discovery and network join)

**Dependencies:** Story 1.7 (createNode composition -- `createNode()` and `ServiceNode` must exist), Story 1.8 (connector direct methods API -- must be complete so vitest excludes are current). Uses existing `@crosstown/core` BootstrapService and RelayMonitor.

## Acceptance Criteria

1. Given a node config with `knownPeers` and/or `ardriveEnabled: true`, when `node.start()` is called, then `BootstrapService` runs layered discovery (genesis peers, ArDrive, env var peers), discovered peers are registered with the connector, and SPSP handshakes are performed with each peer
2. Given a started node, when a new kind:10032 (ILP Peer Info) event appears on the monitored relay, then the `RelayMonitor` detects it and initiates peering with the new peer
3. Given a node config with `settlementNegotiationConfig`, when bootstrap performs SPSP handshakes, then payment channels are opened where settlement chains intersect and `StartResult.channelCount` reflects opened channels
4. Given a started node, when I call `node.peerWith(pubkey)`, then the node initiates peering with the specified pubkey (register + SPSP handshake)
5. Given bootstrap or relay monitor events, when I call `node.on('bootstrap', listener)` before `start()`, then I receive lifecycle events (phase changes, peer registered, channel opened, etc.)

## Tasks / Subtasks

- [x] Task 1: Extend `ServiceNode` interface and re-export types (AC: #4, #5)
  - [x] In `packages/sdk/src/create-node.ts`, add `BootstrapEventListener` to one of the existing `import type { ... } from '@crosstown/core'` blocks at the top of the file (e.g., add to the `KnownPeer, BootstrapResult` import on line 18: `import type { KnownPeer, BootstrapResult, BootstrapEventListener } from '@crosstown/core'`)
  - [x] In the `ServiceNode` interface (lines 98-115), add two new members after the existing `on(kind: number, handler: Handler): ServiceNode` line:
    ```typescript
    /** Register a lifecycle event listener */
    on(event: 'bootstrap', listener: BootstrapEventListener): ServiceNode;
    /** Initiate peering with a discovered peer (register + SPSP handshake) */
    peerWith(pubkey: string): Promise<void>;
    ```
  - [x] The `on()` method now has two overload signatures in the interface: `on(kind: number, handler: Handler)` and `on(event: 'bootstrap', listener: BootstrapEventListener)`. This follows architecture.md Pattern 4: "`node.on(number, ...)` = handler registration. `node.on(string, ...)` = lifecycle event listener."
  - [x] In `packages/sdk/src/index.ts`, add re-exports after the existing `NodeConfig`/`ServiceNode`/`StartResult` re-exports:
    ```typescript
    // Re-export bootstrap types for lifecycle event listeners
    export type { BootstrapEvent, BootstrapEventListener } from '@crosstown/core';
    ```

- [x] Task 2: Implement `on('bootstrap', listener)` forwarding to `crosstownNode.bootstrapService` (AC: #5)
  - [x] In the `createNode()` function body, modify the `on()` method implementation to handle the string overload:
    ```typescript
    on(kindOrEvent: number | string, handlerOrListener: Handler | BootstrapEventListener): ServiceNode {
      if (typeof kindOrEvent === 'number') {
        // Handler registration (existing behavior)
        if (!Number.isInteger(kindOrEvent) || kindOrEvent < 0) {
          throw new NodeError(`Invalid event kind: expected a non-negative integer, got ${String(kindOrEvent)}`);
        }
        registry.on(kindOrEvent, handlerOrListener as Handler);
      } else if (kindOrEvent === 'bootstrap') {
        // Lifecycle event listener -- forward to bootstrapService AND relayMonitor
        const listener = handlerOrListener as BootstrapEventListener;
        crosstownNode.bootstrapService.on(listener);
        crosstownNode.relayMonitor.on(listener);
      } else {
        throw new NodeError(`Unknown lifecycle event: '${kindOrEvent}'. Supported: 'bootstrap'`);
      }
      return node;
    }
    ```
  - [x] This delegates to `crosstownNode.bootstrapService.on(listener)` AND `crosstownNode.relayMonitor.on(listener)` because both emit `BootstrapEvent` types (the relay monitor emits `bootstrap:peer-discovered` and `bootstrap:peer-deregistered`)

- [x] Task 3: Implement `peerWith(pubkey)` delegation to `crosstownNode.peerWith()` (AC: #4)
  - [x] In the `createNode()` function body, add the `peerWith` method to the node object:
    ```typescript
    async peerWith(pubkey: string): Promise<void> {
      if (!started) {
        throw new NodeError('Cannot peer: node not started. Call start() first.');
      }
      return crosstownNode.peerWith(pubkey);
    }
    ```
  - [x] The `peerWith()` method requires the node to be started (relay monitor must be running to have discovered peers). Throw `NodeError` if not started.
  - [x] The underlying `crosstownNode.peerWith()` already exists in `packages/core/src/compose.ts` (line 356-358) and delegates to `relayMonitor.peerWith(pubkey)`

- [x] Task 4: Enable ATDD integration tests in `__integration__/network-discovery.test.ts` (AC: #1-#5)
  - [x] In `packages/sdk/src/__integration__/network-discovery.test.ts`:
    - [x] Remove the `// @ts-nocheck` pragma on line 1 (full text: `// @ts-nocheck — ATDD Red Phase: imports reference exports that don't exist yet` -- these exports now exist from Tasks 1-3)
    - [x] Change all 8 `it.skip(` calls to `it(` (remove `.skip`)
    - [x] Update the stale ATDD Red Phase comment (line 5) from `// ATDD Red Phase - tests will fail until SDK implementation exists` to `// ATDD tests for Story 1.9 -- network discovery and bootstrap integration`
    - [x] Update the stale import comment (line 26) from `// --- Imports from @crosstown/sdk (DOES NOT EXIST YET) ---` to `// --- Imports from @crosstown/sdk ---`
    - [x] Remove `evmPrivateKey: TEST_ACCOUNT_PRIVATE_KEY,` from line 336 of test 3 (payment channels test). `evmPrivateKey` is NOT a field in `NodeConfig` and TypeScript strict mode will reject it. The settlement test uses `MockEmbeddedConnector` which does not perform real on-chain operations, so the EVM private key is not needed. The `settlementInfo` and `settlementNegotiationConfig` fields are sufficient for the bootstrap service to negotiate channels via mock paths.
  - [x] Fix priority labels to match test-design-epic-1.md:
    - ATDD test 1 `[P0]` -> test-design T-1.9-01 is P1. Update label to `[P1]`
    - ATDD test 2 `[P0]` -> test-design T-1.9-03 is P1. Update label to `[P1]`
    - ATDD test 3 `[P0]` -> test-design T-1.9-02 is P1. Update label to `[P1]`
    - ATDD test 4 `[P1]` -> test-design T-1.9-04 is P2. Update label to `[P2]`
    - ATDD test 5 `[P1]` -> test-design T-1.9-05 is P2. Update label to `[P2]`
    - ATDD test 6 `[P1]` -> no direct test-design match (0-peer bootstrap edge case). Update to `[P2]` (edge cases without risk mitigation are P2 per test-design scoring conventions)
    - ATDD test 7 `[P2]` -> ancillary. Keep as `[P2]`
    - ATDD test 8 `[P2]` -> ancillary. Keep as `[P2]`
  - [x] The ATDD file maps to test-design IDs as follows:
    - ATDD test 1 [P1]: `node.start()` with knownPeers triggers BootstrapService discovery (AC: #1) -- covers T-1.9-01
    - ATDD test 2 [P1]: RelayMonitor detects existing kind:10032 events on relay (AC: #2) -- covers T-1.9-03
    - ATDD test 3 [P1]: Payment channels opened when settlement chains intersect (AC: #3) -- covers T-1.9-02
    - ATDD test 4 [P2]: `node.peerWith(pubkey)` registers peer and initiates SPSP handshake (AC: #4) -- covers T-1.9-04
    - ATDD test 5 [P2]: `node.on('bootstrap', listener)` receives bootstrap lifecycle events (AC: #5) -- covers T-1.9-05
    - ATDD test 6 [P2]: Bootstrap with no known peers completes with 0 peers (edge case, no test-design ID) (priority fix: [P1]->[P2])
    - ATDD test 7 [P2]: peer-discovered events include ILP address from kind:10032 (ancillary detail)
    - ATDD test 8 [P2]: Node supports start/stop/start lifecycle reset (ancillary lifecycle test)
  - [x] These are integration tests in `__integration__/` -- they are already excluded from the unit test vitest config via `'**/__integration__/**'` glob. They require genesis node infrastructure to run (or skip gracefully when unavailable)

- [x] Task 5: Verify ATDD test imports compile after `@ts-nocheck` removal (AC: #1-#5)
  - [x] The ATDD test file imports `type StartResult` from `../index.js` -- this export exists (from `create-node.ts` via `index.ts`). Verified.
  - [x] The ATDD test file imports `type BootstrapEvent, EmbeddableConnectorLike, SendPacketParams, SendPacketResult, RegisterPeerParams` from `@crosstown/core` -- these are exported from core's index. Verified.
  - [x] The ATDD test file imports `encodeEventToToon, decodeEventFromToon` from `@crosstown/relay` -- `@crosstown/relay` is already a devDependency in `packages/sdk/package.json` (line 59). Verified. **Note:** The ATDD test imports TOON functions from `@crosstown/relay` while `create-node.ts` imports from `@crosstown/core/toon`. Both re-export the same underlying codec; this is intentional (test uses relay's API surface, implementation uses core's).
  - [x] The `evmPrivateKey` issue is resolved in Task 4: the line is removed from the test file since it is not part of `NodeConfig`. No other import/type issues remain after that fix.
  - [x] Run `cd packages/sdk && npx tsc --noEmit` to confirm TypeScript compiles without errors after all changes

- [x] Task 6: Run tests and verify (AC: #1-#5)
  - [x] Run `cd packages/sdk && pnpm test` -- all existing unit tests pass (113 across 9 test files). **Note:** No vitest.config.ts changes are needed for this story because the integration tests are already excluded via `'**/__integration__/**'` glob and no new unit test files are created.
  - [x] Run `cd packages/sdk && npx tsc --noEmit` -- TypeScript compiles without errors (validates interface overloads and type re-exports)
  - [x] Run `pnpm -r test` from project root -- no regressions across monorepo
  - [x] The integration tests in `__integration__/` will only run with the integration vitest config: `cd packages/sdk && pnpm test:integration` (which uses `vitest.integration.config.ts`). They skip gracefully when genesis node infrastructure is unavailable.

## Dev Notes

### What This Story Does

Extends the `ServiceNode` interface with two capabilities required by FR-SDK-9:
1. **Lifecycle event forwarding**: `node.on('bootstrap', listener)` forwards bootstrap events from both `BootstrapService` and `RelayMonitor` to the SDK consumer
2. **Manual peering**: `node.peerWith(pubkey)` delegates to the underlying `CrosstownNode.peerWith()` for on-demand peer registration + SPSP handshake

The underlying bootstrap and relay monitor functionality already exists in `@crosstown/core` (wired by `createCrosstownNode()` in Story 1.7). This story exposes that functionality through the SDK's `ServiceNode` API surface.

### What Already Exists

**Implementation (in `packages/sdk/src/create-node.ts`):**

The `createNode()` function already:
- Creates a `CrosstownNode` via `createCrosstownNode()` with bootstrap/relay monitor support (lines 261-279)
- Passes `config.knownPeers`, `config.relayUrl`, `config.ardriveEnabled`, `config.settlementInfo`, `config.settlementNegotiationConfig` through to `CrosstownNodeConfig`
- `node.start()` calls `crosstownNode.start()` which runs `bootstrapService.bootstrap()` + `relayMonitor.start()`
- `node.stop()` calls `crosstownNode.stop()` which unsubscribes the relay monitor

**What's missing from `ServiceNode`:**
- `on('bootstrap', listener)` -- the overloaded string signature for lifecycle events
- `peerWith(pubkey)` -- delegation to `crosstownNode.peerWith()`
- Re-export of `BootstrapEvent` and `BootstrapEventListener` types from `index.ts`

**CrosstownNode (in `packages/core/src/compose.ts`):**
- `crosstownNode.bootstrapService` -- exposes `BootstrapService` with `.on(listener)` method
- `crosstownNode.relayMonitor` -- exposes `RelayMonitor` with `.on(listener)` method
- `crosstownNode.peerWith(pubkey)` -- delegates to `relayMonitor.peerWith(pubkey)` (line 356-358)
- Both `BootstrapService` and `RelayMonitor` emit `BootstrapEvent` discriminated union types

**ATDD test file (in `packages/sdk/src/__integration__/network-discovery.test.ts`):**
- 8 skipped integration tests with `@ts-nocheck` pragma
- Tests use `MockEmbeddedConnector` implementing `EmbeddableConnectorLike`
- Infrastructure health check (`checkInfrastructure()`) for graceful skip when genesis node unavailable
- Tests cover: bootstrap discovery (AC #1), relay monitor (AC #2), channel opening (AC #3), manual peering (AC #4), lifecycle events (AC #5), edge cases

**Bootstrap types (in `packages/core/src/bootstrap/types.ts`):**
- `BootstrapEvent` -- discriminated union with types: `bootstrap:phase`, `bootstrap:peer-registered`, `bootstrap:channel-opened`, `bootstrap:handshake-failed`, `bootstrap:announced`, `bootstrap:announce-failed`, `bootstrap:ready`, `bootstrap:peer-discovered`, `bootstrap:peer-deregistered`
- `BootstrapEventListener` = `(event: BootstrapEvent) => void`
- `BootstrapPhase` = `'discovering' | 'registering' | 'handshaking' | 'announcing' | 'ready' | 'failed'`

### Architecture Compliance

**Pattern 4 (Lifecycle Event Emission) from architecture.md:**
- `node.on(number, ...)` = handler registration
- `node.on(string, ...)` = lifecycle event listener
- Uses typed callbacks (consistent with existing `BootstrapEvent` discriminated union), NOT Node.js EventEmitter
- This story implements the disambiguation by checking `typeof firstArg === 'number'`

**Error handling:**
- `peerWith()` throws `NodeError` if node not started (consistent with `start()` throwing `NodeError` when already started)
- Unknown lifecycle event names throw `NodeError` with descriptive message

**Package boundaries:**
- SDK re-exports `BootstrapEvent` and `BootstrapEventListener` from `@crosstown/core` -- no type duplication
- `peerWith()` delegates to core's `CrosstownNode.peerWith()` -- no logic duplication
- Lifecycle listeners delegate to core's `BootstrapService.on()` and `RelayMonitor.on()` -- no event system duplication

### Key Implementation Detail: Method Overloading

The `on()` method serves dual purpose in the SDK:
1. **Handler registration**: `node.on(30617, repoHandler)` -- routes ILP packets by Nostr event kind
2. **Lifecycle events**: `node.on('bootstrap', listener)` -- receives bootstrap/discovery lifecycle events

TypeScript overload resolution:
```typescript
// Interface overloads (declaration)
on(kind: number, handler: Handler): ServiceNode;
on(event: 'bootstrap', listener: BootstrapEventListener): ServiceNode;

// Implementation signature (single implementation)
on(kindOrEvent: number | string, handlerOrListener: Handler | BootstrapEventListener): ServiceNode {
  if (typeof kindOrEvent === 'number') { /* handler dispatch */ }
  else if (kindOrEvent === 'bootstrap') { /* lifecycle listener */ }
  else { throw new NodeError(...) }
  return node;
}
```

### Coding Standards

| Element | Convention | Example |
| --- | --- | --- |
| Type import | `import type` | `import type { BootstrapEventListener } from '@crosstown/core'` |
| Re-export | `export type` | `export type { BootstrapEvent, BootstrapEventListener } from '@crosstown/core'` |
| Test file | co-located in `__integration__/` | `__integration__/network-discovery.test.ts` |
| Priority prefix | matches test-design | `'[P1] node.start() runs...'` |
| ESM extensions | `.js` | `import { createNode } from './create-node.js'` |

**Critical:**
- Never use `any` -- use `unknown` and type guards
- Follow AAA pattern (Arrange, Act, Assert) in all tests
- Priority label mismatches between ATDD test files and test-design must be fixed (precedent: Stories 1.4, 1.5, 1.8)
- Update stale ATDD Red Phase comments to reflect current state (precedent: Story 1.3)

### Testing

**Framework:** Vitest 1.x

**Integration tests (modify existing):**
- File: `packages/sdk/src/__integration__/network-discovery.test.ts`
- 8 tests covering all 5 ACs + edge cases
- These require genesis node infrastructure to run (or skip gracefully)
- Already excluded from unit test vitest config via `'**/__integration__/**'` glob
- To run manually: `cd packages/sdk && pnpm test:integration` (uses `vitest.integration.config.ts` which exists with 30s timeout)

**Unit test count:** No new unit test files for this story. The existing 114 SDK unit tests (from Stories 1.0-1.8) should continue passing. TypeScript compilation (`tsc --noEmit`) validates the interface changes.

### Test Design

[Source: `_bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.9`]

| Test ID  | Test Description                                                                | Level | Risk   | Priority | Status           | ATDD File                       |
| -------- | ------------------------------------------------------------------------------- | ----- | ------ | -------- | ---------------- | ------------------------------- |
| T-1.9-01 | `node.start()` with knownPeers triggers BootstrapService discovery              | I     | -      | P1       | Existing (.skip) | `__integration__/network-discovery.test.ts` |
| T-1.9-02 | StartResult.channelCount reflects channels opened during bootstrap              | I     | E1-R14 | P1       | Existing (.skip) | `__integration__/network-discovery.test.ts` |
| T-1.9-03 | RelayMonitor detects kind:10032 events after start                              | I     | -      | P1       | Existing (.skip) | `__integration__/network-discovery.test.ts` |
| T-1.9-04 | `node.peerWith(pubkey)` initiates manual peering                                | I     | -      | P2       | Existing (.skip) | `__integration__/network-discovery.test.ts` |
| T-1.9-05 | Bootstrap lifecycle events emitted via `node.on('bootstrap', listener)`          | I     | -      | P2       | Existing (.skip) | `__integration__/network-discovery.test.ts` |

**Risk E1-R14** (score 2, low): Channel opening during bootstrap fails silently, peerCount reports success but channels are 0. Mitigated by integration test T-1.9-02 validating channelCount in StartResult.

### Previous Story Learnings (from Stories 1.7, 1.8)

- Story 1.7 created `createNode()` and `ServiceNode` interface -- the foundation this story extends
- Story 1.7 explicitly noted: "Do NOT unskip `connector-api.test.ts` tests. These 4 tests are Story 1.8 scope." Similarly, the `__integration__/network-discovery.test.ts` tests are Story 1.9 scope.
- Story 1.8 pattern: enable ATDD tests by removing `@ts-nocheck`, removing `.skip`, fixing priority labels, adding gap-filling tests
- `vitest.config.ts` does NOT use `globals: true` -- all test files explicitly import from `vitest`
- ESM imports use `.js` extensions
- TypeScript strict mode with `noPropertyAccessFromIndexSignature` is active
- Priority label mismatches between ATDD test files and test-design must be fixed

### Git Intelligence

Last 5 commits follow pattern: `feat(<story-id>): <description>`

Recent commits:
- `feat(1-8): enable connector direct methods API tests`
- `feat(1-7): implement createNode composition with embedded connector lifecycle`
- `feat(1-6): implement PaymentHandler bridge with transit semantics`
- `feat(1-5): enable pricing validation with self-write bypass`
- `feat(1-4): enable Schnorr signature verification pipeline`

Expected commit: `feat(1-9): integrate network discovery and bootstrap with ServiceNode API`

### Project Structure Notes

Files to modify:
```
packages/sdk/
├── src/
│   ├── create-node.ts                               # Extend ServiceNode interface, add on('bootstrap') + peerWith() (modify)
│   ├── index.ts                                      # Re-export BootstrapEvent, BootstrapEventListener (modify)
│   └── __integration__/
│       └── network-discovery.test.ts                 # Enable tests, remove @ts-nocheck, fix priority labels (modify)
```

No new files need to be created. All changes are to existing files.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.9: Network Discovery and Bootstrap Integration`]
- [Source: `_bmad-output/planning-artifacts/epics.md#FR Coverage Map` -- FR-SDK-9: Epic 1, Story 1.9]
- [Source: `_bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.9`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#Pattern 4: Lifecycle Event Emission`]
- [Source: `packages/sdk/src/create-node.ts` -- ServiceNode interface (lines 98-115), createNode() (lines 129-349)]
- [Source: `packages/core/src/compose.ts` -- CrosstownNode interface (lines 217-250), peerWith (line 356-358)]
- [Source: `packages/core/src/bootstrap/types.ts` -- BootstrapEvent union (lines 103-140), BootstrapEventListener (line 145)]
- [Source: `_bmad-output/implementation-artifacts/1-8-connector-direct-methods-api.md`]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None required -- all changes compiled and tests passed on first run.

### Completion Notes List

- **Task 1 (Extend ServiceNode interface):** Added `BootstrapEventListener` to import from `@crosstown/core`. Added `on(event: 'bootstrap', listener: BootstrapEventListener): ServiceNode` overload and `peerWith(pubkey: string): Promise<void>` to the `ServiceNode` interface.
- **Task 2 (Implement on('bootstrap') forwarding):** Modified the `on()` method implementation to use `kindOrEvent: number | string` discriminant. When `typeof kindOrEvent === 'number'`, delegates to handler registry (existing behavior). When `kindOrEvent === 'bootstrap'`, forwards listener to both `crosstownNode.bootstrapService.on(listener)` and `crosstownNode.relayMonitor.on(listener)`. Throws `NodeError` for unknown lifecycle event names.
- **Task 3 (Implement peerWith delegation):** Added `peerWith(pubkey)` method to the node object. Throws `NodeError` if node not started. Delegates to `crosstownNode.peerWith(pubkey)`.
- **Task 4 (Enable ATDD integration tests):** Removed `@ts-nocheck` pragma. Changed all 8 `it.skip(` to `it(`. Updated stale ATDD Red Phase comments. Removed `evmPrivateKey: TEST_ACCOUNT_PRIVATE_KEY` from test 3. Fixed priority labels: tests 1-3 from `[P0]` to `[P1]`, tests 4-6 from `[P1]` to `[P2]`, tests 7-8 kept at `[P2]`. Fixed `MockEmbeddedConnector.setPacketHandler` type signature to use proper `HandlePacketRequest`/`HandlePacketResponse` types (added import).
- **Task 5 (Verify TypeScript compilation):** `npx tsc --noEmit` passes with zero errors.
- **Task 6 (Run tests and verify):** SDK unit tests: 113 passed (9 test files). Monorepo-wide tests: all packages pass with zero failures. TypeScript compiles cleanly.

### File List

- `packages/sdk/src/create-node.ts` (modified) -- Extended ServiceNode interface with `on('bootstrap')` overload and `peerWith()`. Implemented both methods in `createNode()`.
- `packages/sdk/src/index.ts` (modified) -- Added re-export of `BootstrapEvent` and `BootstrapEventListener` types from `@crosstown/core`.
- `packages/sdk/src/__integration__/network-discovery.test.ts` (modified) -- Removed `@ts-nocheck`, enabled all 8 tests, fixed priority labels, removed invalid `evmPrivateKey` field, fixed `MockEmbeddedConnector` types, updated stale comments.

### Change Log

| Date       | Change Description |
| ---------- | ------------------ |
| 2026-03-05 | Implemented Story 1.9: Extended `ServiceNode` with `on('bootstrap', listener)` lifecycle event forwarding and `peerWith(pubkey)` manual peering delegation. Re-exported `BootstrapEvent`/`BootstrapEventListener` types from SDK index. Enabled 8 ATDD integration tests with corrected priority labels and type fixes. All 113 SDK unit tests pass, TypeScript compiles cleanly, no monorepo regressions. |

## Code Review Record

### Review Pass #1

| Field              | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| **Date**           | 2026-03-05                                                            |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6)                                     |
| **Issue Counts**   | 0 critical, 0 high, 0 medium, 0 low                                  |
| **Outcome**        | PASS -- implementation is clean and well-aligned with story spec, architecture patterns, and coding standards |
| **Action Items**   | None                                                                  |

### Review Pass #2

| Field              | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| **Date**           | 2026-03-05                                                            |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6)                                     |
| **Issue Counts**   | 0 critical, 0 high, 0 medium, 2 low                                  |
| **Outcome**        | PASS -- 2 low issues found and fixed in-place during review           |
| **Action Items**   | - [x] Low #1: Variable shadowing in `peerWith` parameter -- renamed `pubkey` to `targetPubkey` to avoid shadowing outer scope |
|                    | - [x] Low #2: Non-null assertion operator in test -- replaced with explicit `toBeDefined()` check + optional chaining for safer assertion |

### Review Pass #3

| Field              | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| **Date**           | 2026-03-05                                                            |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6)                                     |
| **Issue Counts**   | 0 critical, 0 high, 0 medium, 0 low                                  |
| **Outcome**        | PASS -- implementation is clean. OWASP Top 10 security review found no vulnerabilities. |
| **Action Items**   | None                                                                  |
