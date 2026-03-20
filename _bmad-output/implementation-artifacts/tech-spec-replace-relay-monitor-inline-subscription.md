---
title: 'Replace RelayMonitor with Inline Relay Subscription'
slug: 'replace-relay-monitor-inline-subscription'
created: '2026-03-08'
status: 'Implementation Complete + Adversarial Review Resolved'
stepsCompleted: [1, 2, 3, 4, 5, 6]
tech_stack: ['TypeScript 5.3+', 'Vitest 1.0+', 'Hono 4.0', 'ws 8.0', 'nostr-tools 2.x']
files_to_modify:
  - 'packages/core/src/bootstrap/RelayMonitor.ts (DELETE)'
  - 'packages/core/src/bootstrap/RelayMonitor.test.ts (DELETE)'
  - 'packages/core/src/bootstrap/discovery-tracker.ts (NEW)'
  - 'packages/core/src/bootstrap/discovery-tracker.test.ts (NEW)'
  - 'packages/core/src/bootstrap/types.ts'
  - 'packages/core/src/bootstrap/index.ts'
  - 'packages/core/src/compose.ts'
  - 'packages/core/src/compose.test.ts'
  - 'packages/core/src/index.ts'
  - 'packages/sdk/src/create-node.ts'
  - 'packages/sdk/src/__integration__/network-discovery.test.ts'
  - 'packages/town/src/town.ts'
  - 'packages/town/src/health.test.ts'
  - 'packages/client/src/ToonClient.ts'
  - 'packages/client/src/modes/types.ts'
  - 'packages/client/src/modes/http.ts'
  - 'packages/client/src/modes/http.test.ts'
  - 'packages/bls/src/entrypoint.ts'
  - 'docker/src/entrypoint-sdk.ts'
  - 'packages/core/src/bootstrap/relay-monitor-removal.test.ts (NEW)'
code_patterns:
  - 'Factory function: createDiscoveryTracker()'
  - 'Structural interface: DiscoveryTracker'
  - 'Dependency injection at composition root'
  - 'Tracker tracks own counts (no listPeers on connector)'
test_patterns:
  - 'Co-located unit tests: discovery-tracker.test.ts'
  - 'Compose integration tests: compose.test.ts updates'
  - 'Verification-by-absence: relay-monitor-removal.test.ts'
  - 'Health schema tests: health.test.ts updates'
---

# Tech-Spec: Replace RelayMonitor with Inline Relay Subscription

**Created:** 2026-03-08

## Overview

### Problem Statement

RelayMonitor is a standalone 370-line class (`packages/core/src/bootstrap/RelayMonitor.ts`) that spins up its own SimplePool WebSocket connection to subscribe to kind:10032 (ILP Peer Info) events for peer discovery. This has two critical problems:

1. **Broken in Docker:** SimplePool doesn't work in Node.js containers (no global WebSocket + TOON format incompatibility). The actual working path is the ILP handler auto-registration in `docker/src/entrypoint-sdk.ts:176-204`.
2. **Redundant:** If a node is already connected to a relay via WebSocket, it can simply include `kind: 10032` in its subscription filter — no need for a separate class, connection, or lifecycle.

Additionally, health endpoints currently use stale event-counter-based peer counts (incrementing counters from bootstrap events) instead of querying live connector state. These counters don't account for post-bootstrap peers, deregistrations, or failures.

### Solution

1. **Create a `discovery-tracker.ts` module** — factory function `createDiscoveryTracker()` returns a `DiscoveryTracker` object with `processEvent()`, `peerWith()`, `getDiscoveredPeers()`, `getPeerCount()`, `getDiscoveredCount()`.
2. **Replace RelayMonitor in all composition roots** — `createToonNode()`, `startTown()`, client HTTP mode, BLS entrypoint all switch to discovery tracker.
3. **Kind:10032 events arrive via existing relay subscriptions** — no separate SimplePool connection. The tracker receives parsed NostrEvent objects.
4. **Update health endpoints** to return live `peerCount` and `discoveredPeerCount` from the tracker.
5. **Delete RelayMonitor.ts** and all references across the monorepo.

### Scope

**In Scope:**
- Create `discovery-tracker.ts` module in `packages/core/src/bootstrap/`
- Update `ToonNode` interface and `createToonNode()` in compose.ts
- Update `ServiceNode` and `createNode()` in SDK create-node.ts
- Update `startTown()` in town.ts
- Update client package (ToonClient, http mode)
- Update BLS entrypoint
- Update docker entrypoint-sdk.ts
- Update health endpoints with live peer counts
- Delete RelayMonitor.ts, RelayMonitor.test.ts
- Remove `RelayMonitorConfig` type
- Update all exports
- Verification-by-absence regression test

**Out of Scope:**
- Full Story 3.6 enriched health schema (x402, capabilities, chain, version)
- BootstrapService refactoring
- SocialPeerDiscovery changes
- SimplePool removal from project (RelaySubscriber still uses it)
- Adding `listPeers()` to `EmbeddableConnectorLike`

## Context for Development

### Codebase Patterns

- **Factory functions over classes** — `create*` prefix convention
- **Structural typing with `*Like` suffix** — cross-package interfaces avoid direct imports
- **Two composition roots:** `createToonNode()` (core/compose.ts) for SDK, `startTown()` (town/town.ts) for Town
- **Client and BLS create their own RelayMonitor instances** — independent of compose.ts
- **ESM with `.js` extensions** — all imports require `.js` suffix
- **Co-located tests** — `*.test.ts` next to source files
- **Verification by absence** — grep-based regression tests (precedent: `spsp-removal-verification.test.ts`)

### Full Blast Radius

| File | Reference Type | Action |
| ---- | -------------- | ------ |
| `core/bootstrap/RelayMonitor.ts` | Implementation | DELETE |
| `core/bootstrap/RelayMonitor.test.ts` | Tests | DELETE |
| `core/bootstrap/types.ts` | `RelayMonitorConfig` type | Remove type |
| `core/bootstrap/index.ts` | Exports | Remove RelayMonitor exports, add tracker |
| `core/index.ts` | Re-exports | Remove RelayMonitor, add tracker |
| `core/compose.ts` | Import, create, expose on interface | Replace with tracker |
| `core/compose.test.ts` | Tests spy on relayMonitor | Update tests |
| `sdk/create-node.ts` | `toonNode.relayMonitor.on()` | Use tracker event source |
| `sdk/__integration__/network-discovery.test.ts` | Test descriptions | Update text |
| `town/town.ts` | Creates RelayMonitor instance | Replace with tracker |
| `town/health.test.ts` | Health schema stubs | Add discoveredPeerCount |
| `client/ToonClient.ts` | Imports RelayMonitor | Replace with tracker type |
| `client/modes/types.ts` | Uses RelayMonitor type | Replace with tracker interface |
| `client/modes/http.ts` | Creates RelayMonitor | Replace with createDiscoveryTracker() |
| `client/modes/http.test.ts` | Tests RelayMonitor creation | Update tests |
| `bls/entrypoint.ts` | Creates RelayMonitor | Replace with tracker |
| `docker/entrypoint-sdk.ts` | Auto-reg logic (no import) | Use shared tracker |
| `relay/subscriber/RelaySubscriber.ts` | Comment only | Update comment |
| `relay/websocket/NostrRelayServer.ts` | Comment only | Update comment |

### Technical Decisions

1. **`createDiscoveryTracker()` factory function** — returns `DiscoveryTracker` interface. Preserves all discovery logic from RelayMonitor (processEvent, peerWith, stale filtering, deregistration).
2. **Tracker receives parsed events** — callers handle WebSocket subscriptions, tracker handles discovery logic only. Clean separation of concerns.
3. **Tracker owns event emission** — same `BootstrapEvent` types, same `on()/off()` listener pattern as RelayMonitor.
4. **`ToonNode.relayMonitor` → `ToonNode.discoveryTracker`** — interface-level rename. SDK adapts.
5. **Health reads from tracker** — `tracker.getPeerCount()` and `tracker.getDiscoveredCount()`. No new connector API needed.

## Implementation Plan

### Tasks

- [x] **Task 1: Create `discovery-tracker.ts` module**
  - File: `packages/core/src/bootstrap/discovery-tracker.ts` (NEW)
  - Action: Create factory function `createDiscoveryTracker(config)` that returns `DiscoveryTracker`
  - Interface:
    ```typescript
    interface DiscoveryTrackerConfig {
      secretKey: Uint8Array;       // for deriving own pubkey (exclude from discovery)
      settlementInfo?: SettlementConfig;
      basePricePerByte?: bigint;
    }

    interface DiscoveryTracker {
      /** Process a kind:10032 event for discovery. Called by relay subscription or ILP handler. */
      processEvent(event: NostrEvent): void;
      /** Explicitly peer with a discovered peer (register + open channel). */
      peerWith(pubkey: string): Promise<void>;
      /** Get discovered peers not yet peered with. */
      getDiscoveredPeers(): DiscoveredPeer[];
      /** Check if a pubkey has been actively peered with. */
      isPeered(pubkey: string): boolean;
      /** Count of registered (peered) peers. */
      getPeerCount(): number;
      /** Count of all discovered peers (including peered). */
      getDiscoveredCount(): number;
      /** Register/unregister event listeners. */
      on(listener: BootstrapEventListener): void;
      off(listener: BootstrapEventListener): void;
      /** Set connector admin for peer registration (required before peerWith). */
      setConnectorAdmin(admin: ConnectorAdminClient): void;
      /** Set channel client for payment channel opening (optional). */
      setChannelClient(client: ConnectorChannelClient): void;
      /** Mark pubkeys as already-peered (e.g., from bootstrap phase). */
      addExcludedPubkeys(pubkeys: string[]): void;
    }
    ```
  - Notes: Port logic from `RelayMonitor.processDiscovery()`, `RelayMonitor.peerWith()`, `RelayMonitor.handleDeregistration()`. Remove all SimplePool/subscription lifecycle — callers feed events in. Keep stale-event filtering via timestamp map. Keep deregistration detection on empty content.

- [x] **Task 2: Create `discovery-tracker.test.ts`**
  - File: `packages/core/src/bootstrap/discovery-tracker.test.ts` (NEW)
  - Action: Port relevant tests from `RelayMonitor.test.ts`, adapted for the new API
  - Tests to cover:
    - `processEvent()` adds to discovered peers and emits `bootstrap:peer-discovered`
    - Own pubkey excluded from discovery
    - Stale events (older timestamp) ignored
    - Empty content triggers deregistration
    - Deregistration of peered peer calls `removePeer()` and emits `bootstrap:peer-deregistered`
    - Deregistration of unpeered peer removes from map silently
    - `peerWith()` registers via connector admin and emits `bootstrap:peer-registered`
    - `peerWith()` is idempotent
    - `peerWith()` throws if peer not discovered
    - `peerWith()` throws if connectorAdmin not set
    - `peerWith()` with channel client and settlement data opens channel
    - Settlement failure is non-fatal
    - `getPeerCount()` returns count of peered peers
    - `getDiscoveredCount()` returns count of all discovered peers
    - `addExcludedPubkeys()` prevents discovery of specified pubkeys
    - `on()/off()` event listener management

- [x] **Task 3: Update `types.ts` — remove `RelayMonitorConfig`**
  - File: `packages/core/src/bootstrap/types.ts`
  - Action: Delete the `RelayMonitorConfig` interface (lines 236-251). Keep `DiscoveredPeer` type (still used by tracker). Keep all `BootstrapEvent` types unchanged.

- [x] **Task 4: Update `bootstrap/index.ts` — swap exports**
  - File: `packages/core/src/bootstrap/index.ts`
  - Action:
    - Remove: `export { RelayMonitor } from './RelayMonitor.js'`
    - Remove: `type RelayMonitorConfig` from type exports
    - Add: `export { createDiscoveryTracker, type DiscoveryTracker, type DiscoveryTrackerConfig } from './discovery-tracker.js'`

- [x] **Task 5: Update `core/index.ts` — swap re-exports**
  - File: `packages/core/src/index.ts`
  - Action:
    - Remove: `RelayMonitor` from value exports (line 58)
    - Remove: `type RelayMonitorConfig` from type exports (line 73)
    - Add: `createDiscoveryTracker` to value exports
    - Add: `type DiscoveryTracker, type DiscoveryTrackerConfig` to type exports

- [x] **Task 6: Update `compose.ts` — replace RelayMonitor with tracker**
  - File: `packages/core/src/compose.ts`
  - Action:
    - Remove: `import { RelayMonitor } from './bootstrap/RelayMonitor.js'`
    - Add: `import { createDiscoveryTracker } from './bootstrap/discovery-tracker.js'`
    - Add: `import type { DiscoveryTracker } from './bootstrap/discovery-tracker.js'`
    - Update `ToonNode` interface: `readonly relayMonitor: RelayMonitor` → `readonly discoveryTracker: DiscoveryTracker`
    - Update JSDoc for `peerWith()`: "discovered by the RelayMonitor" → "discovered by the discovery tracker"
    - In `createToonNode()`:
      - Replace `new RelayMonitor({...})` block (lines 329-337) with `createDiscoveryTracker({secretKey, settlementInfo, basePricePerByte})`
      - Replace `relayMonitor.setConnectorAdmin(...)` etc. with tracker equivalents
      - Update `relayMonitor.start(bootstrapPeerPubkeys)` → `tracker.addExcludedPubkeys(bootstrapPeerPubkeys)` (no subscription to start)
      - Remove `relayMonitorSubscription` tracking and unsubscribe in stop() (tracker has no subscription)
      - Update return object: `relayMonitor` → `discoveryTracker`
      - Update `peerWith()` to delegate to `discoveryTracker.peerWith()`
    - Update JSDoc at file top: remove "RelayMonitor" from composition description

- [x] **Task 7: Update `compose.test.ts` — adapt tests**
  - File: `packages/core/src/compose.test.ts`
  - Action:
    - Update test "returns an object with start, stop, bootstrapService, relayMonitor" → check for `discoveryTracker` instead
    - Update test "stop() unsubscribes the relay monitor subscription" → tracker has no subscription, test that stop() is safe
    - Update test "passes bootstrapped peer pubkeys as excludePubkeys to relayMonitor.start()" → test that `addExcludedPubkeys()` is called
    - Update test "allows attaching event listeners before start()" → use `discoveryTracker.on()` instead of `relayMonitor.on()`
    - Update test "passes through config parameters to RelayMonitor" → test tracker creation
    - Remove any `vi.spyOn(node.relayMonitor, ...)` calls

- [x] **Task 8: Update `sdk/create-node.ts` — adapt to new interface**
  - File: `packages/sdk/src/create-node.ts`
  - Action:
    - Line 376-379: Change `toonNode.relayMonitor.on(listener)` → `toonNode.discoveryTracker.on(listener)`
    - Update JSDoc "Start the node: wire packet handler, run bootstrap, start relay monitor" → "...start discovery"

- [x] **Task 9: Update `sdk/__integration__/network-discovery.test.ts`**
  - File: `packages/sdk/src/__integration__/network-discovery.test.ts`
  - Action: Update test descriptions that mention "RelayMonitor" to reference "discovery tracker" instead. No logic changes needed.

- [x] **Task 10: Update `town.ts` — replace RelayMonitor with tracker**
  - File: `packages/town/src/town.ts`
  - Action:
    - Remove: `import { RelayMonitor } from '@toon-protocol/core'` (or from bootstrap path)
    - The block at lines 707-732 creates a RelayMonitor, wires admin/runtime/channel clients, attaches listener, and starts subscription. Replace with:
      1. `createDiscoveryTracker({secretKey, settlementInfo, basePricePerByte})`
      2. Wire admin client and channel client to tracker
      3. Attach peer-registered event listener for health counter
      4. Call `tracker.addExcludedPubkeys(bootstrapPeerPubkeys)`
      5. Set up a relay subscription (using existing `subscribe()` or `createSubscription()`) that feeds kind:10032 events to `tracker.processEvent()`
    - Remove `relayMonitorSubscription` variable and cleanup in `stop()`
    - Update health endpoint: replace stale `peerCount` counter with `tracker.getPeerCount()`, add `discoveredPeerCount: tracker.getDiscoveredCount()`
    - Import `BootstrapEvent` type if not already imported

- [x] **Task 11: Update `health.test.ts` — add discoveredPeerCount**
  - File: `packages/town/src/health.test.ts`
  - Action: Update the proposed health schema in the ATDD stubs to include `discoveredPeerCount: expect.any(Number)` alongside `peerCount`. Update `_createHealthConfig` to include `discoveredPeerCount`.

- [x] **Task 12: Update client package**
  - Files:
    - `packages/client/src/modes/types.ts`: Change `relayMonitor: RelayMonitor` → `discoveryTracker: DiscoveryTracker` in mode config types. Update import from `@toon-protocol/core`.
    - `packages/client/src/modes/http.ts`: Replace `new RelayMonitor(monitorConfig, pool)` with `createDiscoveryTracker(config)`. Remove `RelayMonitorConfig` import. Wire admin/channel clients to tracker instead. Remove SimplePool usage if only RelayMonitor used it here.
    - `packages/client/src/modes/http.test.ts`: Update tests to verify `createDiscoveryTracker()` is called instead of `new RelayMonitor()`.
    - `packages/client/src/ToonClient.ts`: Replace `relayMonitor: RelayMonitor` reference with `discoveryTracker: DiscoveryTracker`.

- [x] **Task 13: Update BLS entrypoint**
  - File: `packages/bls/src/entrypoint.ts`
  - Action: Replace `new RelayMonitor(...)` at line 350 with `createDiscoveryTracker(config)`. Wire admin/channel clients. Remove `RelayMonitor` import. Feed kind:10032 events from the relay subscription to `tracker.processEvent()`.

- [x] **Task 14: Update docker entrypoint-sdk.ts**
  - File: `docker/src/entrypoint-sdk.ts`
  - Action:
    - Create a shared discovery tracker at startup
    - The auto-registration block (lines 176-204) should feed events to `tracker.processEvent()` instead of maintaining its own `autoRegistered` Set
    - Update health endpoint to return `peerCount: tracker.getPeerCount()` and `discoveredPeerCount: tracker.getDiscoveredCount()` instead of stale counters

- [x] **Task 15: Delete RelayMonitor files**
  - Files:
    - DELETE `packages/core/src/bootstrap/RelayMonitor.ts`
    - DELETE `packages/core/src/bootstrap/RelayMonitor.test.ts`
  - Notes: Do this AFTER all references are updated to avoid broken imports during development.

- [x] **Task 16: Create verification-by-absence test**
  - File: `packages/core/src/bootstrap/relay-monitor-removal.test.ts` (NEW)
  - Action: Create grep-based static analysis test (following `spsp-removal-verification.test.ts` pattern) that:
    - Asserts zero imports of `RelayMonitor` in `packages/` (excluding test file itself and archive/)
    - Asserts zero imports of `RelayMonitorConfig` in `packages/`
    - Asserts `RelayMonitor.ts` file does not exist
    - Asserts `RelayMonitor.test.ts` file does not exist

- [x] **Task 17: Update comment references**
  - Files:
    - `packages/relay/src/subscriber/RelaySubscriber.ts` line 4: Update comment "Follows the same lifecycle pattern as core's RelayMonitor" → "Follows the same lifecycle pattern as core's discovery tracker"
    - `packages/relay/src/websocket/NostrRelayServer.ts` line 101: Update comment "so that RelayMonitor subscribers are notified" → "so that discovery subscribers are notified"

- [x] **Task 18: Build and test**
  - Action: `pnpm build && pnpm test && pnpm lint`
  - Verify: All tests pass, no lint errors, no broken imports

### Acceptance Criteria

- [x] **AC 1:** Given a kind:10032 NostrEvent, when `tracker.processEvent(event)` is called, then the peer is added to `discoveredPeers` and `bootstrap:peer-discovered` event is emitted.

- [x] **AC 2:** Given a discovered peer, when `tracker.peerWith(pubkey)` is called with connectorAdmin set, then the peer is registered via `addPeer()` and `bootstrap:peer-registered` event is emitted.

- [x] **AC 3:** Given a peered peer, when a kind:10032 event with empty content arrives, then the peer is deregistered via `removePeer()` and `bootstrap:peer-deregistered` event is emitted.

- [x] **AC 4:** Given stale kind:10032 events (older timestamp than previously seen), when `tracker.processEvent()` is called, then the event is ignored (no duplicate discovery).

- [x] **AC 5:** Given a running TOON node, when the health endpoint is called, then the response includes `peerCount` (active registered peers) and `discoveredPeerCount` (all discovered peers).

- [x] **AC 6:** Given `peerWith()` is called twice for the same pubkey, when the second call executes, then it is a no-op (idempotent).

- [x] **AC 7:** Given the codebase after implementation, when searching for `RelayMonitor` imports in `packages/`, then zero matches are found (verified by static analysis test).

- [x] **AC 8:** Given `createToonNode()` is called, when the node is created, then it exposes `discoveryTracker` (not `relayMonitor`) on the `ToonNode` interface.

- [x] **AC 9:** Given `ServiceNode.on('bootstrap', listener)` is called, when bootstrap events occur, then the listener receives events from both `bootstrapService` and `discoveryTracker`.

- [x] **AC 10:** Given the discovery tracker with channel client and settlement info, when `peerWith()` is called for a peer with compatible chains, then a payment channel is opened and `bootstrap:channel-opened` is emitted.

## Additional Context

### Dependencies

- No new dependencies required
- SimplePool remains in project (RelaySubscriber uses it)
- `@toon-protocol/connector` optional peer dep unchanged

### Testing Strategy

- **Unit tests** (`discovery-tracker.test.ts`): ~15 tests covering processEvent, peerWith, stale filtering, deregistration, idempotency, event emission, counts, excluded pubkeys
- **Compose tests** (`compose.test.ts`): ~5 tests updated to reference discoveryTracker
- **Health tests** (`health.test.ts`): Update ATDD stubs with discoveredPeerCount
- **Verification by absence** (`relay-monitor-removal.test.ts`): ~4 grep-based assertions
- **SDK integration** (`network-discovery.test.ts`): Update descriptions only
- **Build validation**: `pnpm build && pnpm test && pnpm lint` must pass clean

### Notes

- **Risk: Client package complexity** — The client package has its own RelayMonitor wiring in `http.ts`. The tracker replacement is straightforward but needs to account for the SimplePool instance the client was sharing with RelayMonitor. If SimplePool was only used by RelayMonitor in the client, its creation can be removed.
- **Risk: BLS entrypoint** — The BLS entrypoint at `packages/bls/src/entrypoint.ts` creates its own RelayMonitor. This is the legacy entrypoint (pre-Town). Verify it's still actively used before investing effort.
- **Future consideration:** Once `EmbeddableConnectorLike` gets a `listPeers()` method, the health endpoint could use that as the authoritative peer count instead of the tracker's internal count.
- **Migration path:** The `DiscoveryTracker` interface is designed to be a drop-in behavioral replacement for RelayMonitor. The key difference is that it doesn't own its own subscription — callers feed it events.

### Adversarial Review Resolution (Step 6)

15 findings reviewed, 9 fixed:

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| F1/F2 | Critical | processEvent never wired in entrypoints | Fixed: wired in all 6 entrypoints (HTTP endpoints + embedded connector packet handler) |
| F4 | High | Race condition in peerWith() | Fixed: early `peeredPubkeys.add()` with rollback on failure |
| F5 | High | Unconditional tracker creation in entrypoint-town.ts | Fixed: wrapped in `connectorUrl` guard |
| F7 | Medium | Stale RelayMonitor comments in integration tests | Fixed: updated 6 comments across 4 files |
| F9 | Medium | handleDeregistration emits before async removePeer | Fixed: emit after `.then()` resolution |
| F10 | Medium | Double-counting in town.ts health endpoint | Fixed: removed duplicate counter |
| F13 | Low | Grammar "an TOON" → "a TOON" | Fixed |
| F14 | Low | Unused `basePricePerByte` in DiscoveryTrackerConfig | Fixed: removed from config + all callers |
| F15 | Low | Verification test doesn't grep docker/src/ | Fixed: extended grepPackages scope |

Findings classified as noise/out-of-scope: F3 (broadcastEvent pre-existing), F6 (test coverage for pre-existing methods), F8 (SimplePool lifecycle pre-existing), F11 (processEvent silent drop by design), F12 (missing test for concurrent peerWith — covered by F4 fix).

**Final validation**: `pnpm build` ✅ | `pnpm test` ✅ (1301 passed, 185 skipped) | `pnpm lint` ✅ (0 errors, 341 warnings)
