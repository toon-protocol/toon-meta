# Story 3.4: Seed Relay Discovery

Status: done

## Story

As a **new relay operator**,
I want to bootstrap my node by connecting to any relay in a seed list rather than depending on a specific genesis node,
So that the network has no single point of failure for peer discovery.

**FRs covered:** FR-PROD-4 (Seed relay list model replaces genesis hub-and-spoke topology for peer discovery)

**Dependencies:** Epic 2 (node must be functional — `startTown()`, `BootstrapService`, `SocialPeerDiscovery`). No dependency on Stories 3.1-3.3 — seed relay discovery is independent of USDC denomination and chain config.

**Decision source:** Party Mode Decision 7 — "Seed Relay List Replaces Genesis Hub-and-Spoke" (see `_bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md`). Decision 12 — Bootstrap simplification.

## Acceptance Criteria

1. Given a kind:10036 (Seed Relay List) event published to a public Nostr relay, when a new Crosstown node starts with `discovery: 'seed-list'` config, then the node reads kind:10036 events from configured public Nostr relays, connects to seed relays from the list, and subscribes to kind:10032 events to discover the full network.

2. Given the seed list contains multiple relay URLs, when the first seed relay is unreachable, then the node tries the next relay in the list, and continues until a connection is established or the list is exhausted (with a clear error message on exhaustion).

3. Given a node that is already part of the network, when configured to publish its seed list, then it publishes a kind:10036 event to configured public Nostr relays, and the event contains the node's WebSocket URL and basic metadata.

4. Given backward compatibility requirements, when `discovery: 'genesis'` is configured (or default for dev mode), then the existing genesis-based bootstrap flow is used unchanged, and the seed list discovery is opt-in for production deployments.

## Tasks / Subtasks

- [x] Task 1: Define kind:10036 constant and event builder/parser in `@crosstown/core` (AC: #1, #3)
  - [x] Add `SEED_RELAY_LIST_KIND = 10036` to `packages/core/src/constants.ts` (alongside existing `ILP_PEER_INFO_KIND = 10032`).
  - [x] Create `packages/core/src/events/seed-relay.ts` with:
    ```typescript
    /** Content payload for a kind:10036 Seed Relay List event. */
    interface SeedRelayEntry {
      /** WebSocket URL of the relay (wss:// for production, ws:// for dev). */
      url: string;
      /** Nostr pubkey of the relay operator (64-char lowercase hex). */
      pubkey: string;
      /** Optional metadata. */
      metadata?: {
        region?: string;
        version?: string;
        services?: string[]; // e.g., ['relay', 'x402']
      };
    }

    /**
     * Builds a kind:10036 Seed Relay List event (NIP-16 replaceable).
     * Uses 'd' tag with value 'crosstown-seed-list' for replaceable event pattern (NIP-16, kind 10000-19999).
     */
    function buildSeedRelayListEvent(
      secretKey: Uint8Array,
      entries: SeedRelayEntry[]
    ): NostrEvent

    /**
     * Parses a kind:10036 event content into SeedRelayEntry[].
     * Validates URLs (ws:// or wss:// prefix) and pubkeys (64-char hex).
     */
    function parseSeedRelayList(event: NostrEvent): SeedRelayEntry[]
    ```
  - [x] The event content is JSON-serialized `SeedRelayEntry[]`.
  - [x] The event uses replaceable event pattern (NIP-16, kind 10000-19999): tags include `['d', 'crosstown-seed-list']`.
  - [x] URL validation: reject entries without `ws://` or `wss://` prefix.
  - [x] Pubkey validation: reject entries without valid 64-char lowercase hex pubkeys.
  - [x] Export from `packages/core/src/events/index.ts` and `packages/core/src/index.ts`.

- [x] Task 2: Create `SeedRelayDiscovery` class in `@crosstown/core` (AC: #1, #2)
  - [x] Create `packages/core/src/discovery/seed-relay-discovery.ts`:
    ```typescript
    interface SeedRelayDiscoveryConfig {
      /** Public Nostr relay URLs to query for kind:10036 events. */
      publicRelays: string[];
      /** Timeout for relay connections in ms (default: 10000). */
      connectionTimeout?: number;
      /** Timeout for kind:10036 queries in ms (default: 5000). */
      queryTimeout?: number;
    }

    interface SeedRelayDiscoveryResult {
      /** Number of seed relays successfully connected to. */
      seedRelaysConnected: number;
      /** Total seed relays attempted. */
      attemptedSeeds: number;
      /** WebSocket URLs of connected seed relays. */
      connectedUrls: string[];
      /** Peers discovered via kind:10032 from seed relays. */
      discoveredPeers: IlpPeerInfo[];
    }

    class SeedRelayDiscovery {
      constructor(config: SeedRelayDiscoveryConfig)

      /**
       * Discover peers via seed relay list.
       * 1. Query publicRelays for kind:10036 events
       * 2. Parse seed relay entries
       * 3. Connect to seed relays sequentially (fallback on failure)
       * 4. Subscribe to kind:10032 on connected seed relay
       * 5. Return discovered peers
       */
      async discover(): Promise<SeedRelayDiscoveryResult>

      /** Stop discovery and close connections. */
      async close(): Promise<void>
    }
    ```
  - [x] **Discovery flow:**
    1. Connect to each `publicRelays` URL via WebSocket.
    2. Subscribe to `{ kinds: [10036] }` filter.
    3. Collect kind:10036 events, parse using `parseSeedRelayList()`.
    4. Deduplicate seed relay entries by URL.
    5. Try connecting to seed relays sequentially — on first success, subscribe to `{ kinds: [10032] }`.
    6. If a seed relay connection fails, log warning and try next.
    7. If all seed relays fail, throw `PeerDiscoveryError` with message `All seed relays exhausted — unable to bootstrap. Tried N seed relays from M kind:10036 events.`
    8. Collect kind:10032 events from the connected seed relay, parse content into `IlpPeerInfo` via `parseIlpPeerInfo()`, and set `info.pubkey = event.pubkey` (the parser does NOT populate pubkey from event content -- it comes from the Nostr event's outer pubkey field).
  - [x] **WebSocket handling:** Use raw `ws` WebSocket (not `SimplePool` — per project memory: SimplePool crashes in Node.js containers with `ReferenceError: window is not defined`). Note: `RelaySubscriber` from `@crosstown/relay` uses `SimplePool` internally and is NOT a suitable pattern here. Instead, use raw `ws` directly with Nostr protocol messages (`["REQ", subId, filter]`, `["EVENT", ...]`, `["EOSE", ...]`).
  - [x] **IMPORTANT:** Use `PeerDiscoveryError` from `packages/core/src/errors.ts` for all discovery failures.
  - [x] Export from `packages/core/src/discovery/index.ts` and `packages/core/src/index.ts`.

- [x] Task 3: Create `publishSeedRelayEntry()` function (AC: #3)
  - [x] Add to `packages/core/src/discovery/seed-relay-discovery.ts`:
    ```typescript
    interface PublishSeedRelayConfig {
      /** Secret key for signing the event. */
      secretKey: Uint8Array;
      /** This node's WebSocket relay URL (e.g., wss://my-relay.example.com). */
      relayUrl: string;
      /** Public Nostr relay URLs to publish to. */
      publicRelays: string[];
      /** Optional metadata. */
      metadata?: SeedRelayEntry['metadata'];
    }

    /**
     * Publish a kind:10036 event advertising this node as a seed relay.
     * Connects to each publicRelay and publishes the event.
     * Returns the number of relays the event was published to.
     */
    async function publishSeedRelayEntry(
      config: PublishSeedRelayConfig
    ): Promise<{ publishedTo: number; eventId: string }>
    ```
  - [x] Build the event using `buildSeedRelayListEvent()`.
  - [x] Derive the node's Nostr pubkey from `secretKey` via `getPublicKey()` from `nostr-tools/pure`.
  - [x] The event content is a single-entry `SeedRelayEntry[]` containing this node's URL, derived pubkey, and metadata.
  - [x] Publish to each configured `publicRelays` URL via WebSocket.
  - [x] Return the count of successful publishes and the event ID.

- [x] Task 4: Integrate seed relay discovery into `TownConfig` and `startTown()` (AC: #1, #4)
  - [x] Add discovery configuration to `TownConfig`:
    ```typescript
    // In TownConfig interface:

    /** Discovery mode: 'seed-list' for production, 'genesis' for dev (default: 'genesis'). */
    discovery?: 'seed-list' | 'genesis';

    /** Public Nostr relay URLs for seed relay discovery (used when discovery: 'seed-list'). */
    seedRelays?: string[];

    /** Whether to publish this node as a seed relay entry (default: false). */
    publishSeedEntry?: boolean;

    /** External WebSocket URL of this relay (required if publishSeedEntry is true). */
    externalRelayUrl?: string;
    ```
  - [x] Add corresponding env vars in `docker/src/shared.ts`:
    - `CROSSTOWN_DISCOVERY` — `'seed-list'` or `'genesis'` (default: `'genesis'`)
    - `CROSSTOWN_SEED_RELAYS` — comma-separated list of public Nostr relay URLs
    - `CROSSTOWN_PUBLISH_SEED_ENTRY` — `'true'` or `'false'`
    - `CROSSTOWN_EXTERNAL_RELAY_URL` — external WebSocket URL
  - [x] Add corresponding CLI flags in `packages/town/src/cli.ts`:
    - `--discovery` — discovery mode
    - `--seed-relays` — comma-separated relay URLs
    - `--publish-seed-entry` — boolean flag
    - `--external-relay-url` — external URL
  - [x] In `startTown()`, integrate the discovery mode:
    - **`discovery: 'genesis'` (default):** Existing bootstrap flow is used unchanged. `knownPeers` config is passed to `BootstrapService` as before.
    - **`discovery: 'seed-list'`:** Before running `BootstrapService`, run `SeedRelayDiscovery.discover()` to get seed relay peers. Convert `SeedRelayDiscoveryResult.discoveredPeers` into `KnownPeer[]` format and merge with any explicit `knownPeers` from config. Then pass the merged list to `BootstrapService`.
    - **Publish seed entry:** After bootstrap completes (phase: 'ready'), if `publishSeedEntry` is true and `externalRelayUrl` is set, call `publishSeedRelayEntry()`.
  - [x] **IMPORTANT:** Dev mode defaults to `discovery: 'genesis'` to maintain backward compatibility. Production deployments opt into `discovery: 'seed-list'`.

- [x] Task 5: Add to `ResolvedTownConfig` and `TownInstance` (AC: #1, #3, #4)
  - [x] Add resolved fields to `ResolvedTownConfig`:
    ```typescript
    discovery: 'seed-list' | 'genesis';
    seedRelays: string[];
    publishSeedEntry: boolean;
    externalRelayUrl?: string;
    ```
  - [x] Add `discoveryMode` to `TownInstance` for introspection:
    ```typescript
    interface TownInstance {
      // ... existing fields ...
      discoveryMode: 'seed-list' | 'genesis';
    }
    ```

- [x] Task 6: Enable ATDD tests in `seed-relay-discovery.test.ts` (AC: all)
  - [x] Enable the 5 existing skipped tests in `packages/core/src/discovery/seed-relay-discovery.test.ts`:
    - `[P1] reads kind:10036 -> connects to seed -> subscribes kind:10032` (3.4-INT-001)
    - `[P1] first seed unreachable -> tries next in list` (3.4-INT-002)
    - `[P1] all seeds exhausted -> clear error message` (3.4-INT-002)
    - `[P1] discovery: "genesis" uses existing bootstrap flow unchanged` (3.4-INT-003)
    - `[P1] node publishes its own seed relay entry as kind:10036` (3.4-INT-004)
  - [x] Remove `.skip`, update imports to real modules, implement proper assertions.
  - [x] Add new unit tests for:
    - `seed relay discovery uses raw ws, not SimplePool` (T-3.4-06, static analysis: grep `seed-relay-discovery.ts` for `SimplePool` imports -- must be zero)
    - `buildSeedRelayListEvent()` returns NIP-16 replaceable event with correct kind and d-tag (T-3.4-07)
    - `parseSeedRelayList()` validates URLs (rejects non-ws:// URLs) (T-3.4-08)
    - `parseSeedRelayList()` validates pubkeys (rejects invalid hex) (T-3.4-09)
    - `parseSeedRelayList()` ignores malformed entries (graceful degradation) (T-3.4-10)
    - `SEED_RELAY_LIST_KIND` equals 10036 (T-3.4-11)
  - [x] Add deferred E2E test stub (skipped, P3):
    - `seed relay discovery E2E with live genesis node` (T-3.4-12, requires genesis infrastructure)

- [x] Task 7: Update sprint status and exports (AC: all)
  - [x] Update `_bmad-output/implementation-artifacts/sprint-status.yaml`: set `3-4-seed-relay-discovery` to `done`.
  - [x] Verify full test suite passes: `pnpm build && pnpm lint && pnpm test`.
  - [x] Verify no regressions in existing tests.

## Technical Notes

### Seed Relay List Event (kind:10036)

The kind:10036 event is a NIP-16 replaceable event (kind 10000-19999) published to public Nostr relays. Relays store only the latest event per `pubkey + kind`. The `d` tag with value `crosstown-seed-list` is included as a content marker for filtering but is not used for replacement semantics (that is NIP-33 for kinds 30000-39999). It advertises relay nodes that can serve as bootstrap entry points for new network participants.

**Event structure:**
```json
{
  "kind": 10036,
  "content": "[{\"url\":\"wss://relay1.crosstown.example\",\"pubkey\":\"aa...\",\"metadata\":{\"region\":\"us-east\"}}]",
  "tags": [["d", "crosstown-seed-list"]],
  "created_at": 1709000000,
  "pubkey": "<signer's pubkey>",
  "id": "<event id>",
  "sig": "<schnorr signature>"
}
```

### Discovery Flow Sequence

```
New Node Startup (discovery: 'seed-list')
  |
  1. Connect to public Nostr relays (e.g., wss://relay.damus.io)
  2. Subscribe to kind:10036 filter
  3. Receive seed relay list events
  4. Parse SeedRelayEntry[] from event content
  5. Try connecting to seed relays (sequential, with fallback)
     |
     5a. Seed 1 unreachable -> try Seed 2
     5b. Seed 2 connected -> subscribe kind:10032
     |
  6. Collect kind:10032 (ILP Peer Info) events from seed relay
  7. Convert to KnownPeer[] format
  8. Pass to BootstrapService for standard registration flow
  9. After bootstrap complete, optionally publish own kind:10036
```

### Backward Compatibility

The existing genesis-based bootstrap flow (`knownPeers` -> `BootstrapService`) remains unchanged and is the default. Seed relay discovery is additive -- it provides an alternative way to populate the `knownPeers` list before passing it to the existing `BootstrapService`.

This design ensures:
- All existing E2E tests continue to pass (they use genesis mode).
- Docker deployments using `knownPeers` config work unchanged.
- The `deploy-genesis-node.sh` and `deploy-peers.sh` scripts are unaffected.
- Only production deployments that explicitly set `discovery: 'seed-list'` use the new flow.

### WebSocket Strategy

Use raw `ws` WebSocket connections instead of nostr-tools `SimplePool` for seed relay discovery. SimplePool has known issues in Node.js containers (`ReferenceError: window is not defined` -- see project memory).

**Important:** `RelaySubscriber` from `@crosstown/relay` uses `SimplePool` internally and is NOT a suitable pattern for this story. Instead, use the `ws` package directly with raw Nostr protocol messages:
- `["REQ", subscriptionId, filter]` -- subscribe to events
- `["EVENT", subscriptionId, event]` -- receive events
- `["EOSE", subscriptionId]` -- end of stored events signal
- `["EVENT", event]` -- publish events (outbound)
- `["OK", eventId, success, message]` -- publish acknowledgment

This pattern avoids the `SimplePool` dependency while still implementing standard Nostr relay protocol (NIP-01).

### Converting SeedRelayDiscoveryResult to KnownPeer[]

The `SeedRelayDiscovery` result contains `IlpPeerInfo[]` parsed from kind:10032 events. Each `IlpPeerInfo` has `btpEndpoint`, `ilpAddress`, and optional `pubkey`. To convert to `KnownPeer[]`:

```typescript
const knownPeers: KnownPeer[] = discoveryResult.discoveredPeers
  .filter(info => info.pubkey) // skip entries without pubkey
  .map(info => ({
    pubkey: info.pubkey!,       // from IlpPeerInfo.pubkey (set during parse from event.pubkey)
    relayUrl: connectedSeedUrl, // the seed relay we're connected to
    btpEndpoint: info.btpEndpoint,
  }));
```

**Note:** `IlpPeerInfo.pubkey` is optional in the type definition. The `discover()` implementation must manually set `info.pubkey = event.pubkey` after calling `parseIlpPeerInfo(event)`, because the parser extracts fields from `event.content` only and does NOT set pubkey from the outer event envelope.

### Files Changed (Anticipated)

**New files:**
- `packages/core/src/events/seed-relay.ts` -- kind:10036 event builder and parser
- `packages/core/src/discovery/seed-relay-discovery.ts` -- `SeedRelayDiscovery` class and `publishSeedRelayEntry()` function

**Modified files (source):**
- `packages/core/src/constants.ts` -- Add `SEED_RELAY_LIST_KIND = 10036`
- `packages/core/src/events/index.ts` -- Export seed relay builder/parser
- `packages/core/src/discovery/index.ts` -- Export `SeedRelayDiscovery`
- `packages/core/src/index.ts` -- Export new public API
- `packages/town/src/town.ts` -- Add `discovery`, `seedRelays`, `publishSeedEntry`, `externalRelayUrl` to `TownConfig`; integrate into `startTown()`
- `packages/town/src/cli.ts` -- Add `--discovery`, `--seed-relays`, `--publish-seed-entry`, `--external-relay-url` CLI flags
- `docker/src/shared.ts` -- Add `CROSSTOWN_DISCOVERY`, `CROSSTOWN_SEED_RELAYS`, `CROSSTOWN_PUBLISH_SEED_ENTRY`, `CROSSTOWN_EXTERNAL_RELAY_URL` env vars

**Modified files (tests):**
- `packages/core/src/discovery/seed-relay-discovery.test.ts` -- Enable ATDD tests, add unit tests

**Modified files (config):**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Update story status

### Risk Mitigations

- **E3-R006 (Seed relay liveness, score 4):** Fallback mechanism tries multiple seed relays sequentially. If all exhausted, throws clear `PeerDiscoveryError`. Backward compatibility test ensures genesis mode is unaffected. Test IDs: 3.4-INT-001, 3.4-INT-002, 3.4-INT-003.

### Test Design Traceability

| ATDD Test ID | Test Name | AC | Test-Design ID | Risk Link | Priority | Level |
|---|---|---|---|---|---|---|
| T-3.4-01 | `reads kind:10036 -> connects to seed -> subscribes kind:10032` | #1 | 3.4-INT-001 | E3-R006 | P1 | I |
| T-3.4-02 | `first seed unreachable -> tries next in list` | #2 | 3.4-INT-002 | E3-R006 | P1 | I |
| T-3.4-03 | `all seeds exhausted -> clear error message` | #2 | 3.4-INT-002 | E3-R006 | P1 | I |
| T-3.4-04 | `discovery: "genesis" uses existing bootstrap flow unchanged` | #4 | 3.4-INT-003 | -- | P1 | I |
| T-3.4-05 | `node publishes its own seed relay entry as kind:10036` | #3 | 3.4-INT-004 | -- | P1 | I |
| T-3.4-06 | `seed relay discovery uses raw ws, not SimplePool` | #1 | -- | -- | P2 | U (static) |
| T-3.4-07 | `buildSeedRelayListEvent() returns NIP-16 replaceable event` | #3 | -- | -- | P2 | U |
| T-3.4-08 | `parseSeedRelayList() validates URLs` | #1 | -- | -- | P2 | U |
| T-3.4-09 | `parseSeedRelayList() validates pubkeys` | #1 | -- | -- | P2 | U |
| T-3.4-10 | `parseSeedRelayList() ignores malformed entries` | #1 | -- | -- | P2 | U |
| T-3.4-11 | `SEED_RELAY_LIST_KIND equals 10036` | -- | -- | -- | P2 | U (static) |
| T-3.4-12 | `seed relay discovery E2E with live genesis node` | #1, #2 | 3.4-E2E-001 | E3-R006 | P3 | E2E |

### Import Patterns

```typescript
// New seed relay discovery module
import {
  SeedRelayDiscovery,
  publishSeedRelayEntry,
  type SeedRelayDiscoveryConfig,
  type SeedRelayDiscoveryResult,
  type SeedRelayEntry,
} from '@crosstown/core';

// New seed relay event builder/parser
import {
  buildSeedRelayListEvent,
  parseSeedRelayList,
  SEED_RELAY_LIST_KIND,
} from '@crosstown/core';

// Existing bootstrap infrastructure (unchanged)
import { BootstrapService, PeerDiscoveryError } from '@crosstown/core';
```

### Critical Rules

- **Never use `SimplePool` for seed relay discovery** -- use raw `ws` WebSocket (SimplePool crashes in Node.js containers).
- **Discovery defaults to 'genesis'** -- seed-list mode is opt-in. Dev mode and existing deployments are unaffected.
- **Seed relay discovery populates `knownPeers`, then `BootstrapService` handles registration** -- discovery and registration remain separate concerns.
- **kind:10036 uses NIP-16 replaceable event semantics** -- As a kind in the 10000-19999 range, relays store only the latest event per `pubkey + kind`. The `d` tag with value `crosstown-seed-list` is included as a content marker but does not affect replacement logic (NIP-33 parameterized replacement applies only to kinds 30000-39999).
- **URL validation required** -- reject seed relay entries without `ws://` or `wss://` prefix (CWE-20: Improper Input Validation).
- **Pubkey validation required** -- reject entries without valid 64-char lowercase hex pubkeys.
- **Never use `any` type** -- use `unknown` with type guards.
- **Always use `.js` extensions in imports** -- ESM requires explicit extensions.
- **Use consistent type imports** -- `import type { X } from '...'` for type-only imports.
- **CWE-209 prevention** -- Error messages must not leak internal details (use generic messages in HTTP responses).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4 -- FR-PROD-4 definition]
- [Source: _bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md#Decision 7 -- Seed Relay List]
- [Source: _bmad-output/planning-artifacts/test-design-epic-3.md -- Epic 3 test design (planning version)]
- [Source: _bmad-output/test-artifacts/test-design-epic-3.md -- Epic 3 test design (authoritative, risk IDs E3-R006)]
- [Source: _bmad-output/test-artifacts/atdd-checklist-epic-3.md -- ATDD checklist with Story 3.4 implementation steps]
- [Source: packages/core/src/discovery/seed-relay-discovery.test.ts -- ATDD Red Phase tests (5 skipped)]
- [Source: packages/core/src/bootstrap/BootstrapService.ts -- Existing bootstrap infrastructure]
- [Source: packages/core/src/discovery/index.ts -- Existing discovery module exports]
- [Source: packages/town/src/town.ts -- TownConfig and startTown() integration point]
- [Source: packages/core/src/events/builders.ts -- Event builder pattern to follow]
- [Source: packages/core/src/bootstrap/attestation-bootstrap.test.ts -- Story 4.6 ATDD stubs referencing kind:10036]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Static analysis test T-3.4-06 initially failed because JSDoc comment in `seed-relay-discovery.ts` contained the word "SimplePool" (in a "NOT using" context). Fixed by rewording the comment.
- Lint error in test file: `consistent-generic-constructors` for `Map<number, NostrEvent[]>` initialization. Fixed by moving type args to `new Map<>()` form.
- Lint error for unused `createSeedRelayEntry` factory function in test file. Removed since `createSeedRelayList` and inline construction covered all test needs.

### Completion Notes List

- **Task 1**: Added `SEED_RELAY_LIST_KIND = 10036` constant to `packages/core/src/constants.ts`. Created `packages/core/src/events/seed-relay.ts` with `SeedRelayEntry` interface, `buildSeedRelayListEvent()` builder, and `parseSeedRelayList()` parser with URL validation (ws:// or wss://), pubkey validation (64-char lowercase hex), and graceful degradation for malformed entries. Exported from `events/index.ts` and `core/index.ts`.
- **Task 2**: Created `packages/core/src/discovery/seed-relay-discovery.ts` with `SeedRelayDiscovery` class using raw `ws` WebSocket (not SimplePool). Implements full discovery flow: query public relays for kind:10036, parse seed entries, connect to seeds sequentially with fallback, subscribe to kind:10032, parse IlpPeerInfo with pubkey from event envelope.
- **Task 3**: Added `publishSeedRelayEntry()` function in the same module. Builds kind:10036 event from node identity, publishes to configured public relays via raw WebSocket, returns publish count and event ID.
- **Task 4**: Added `discovery`, `seedRelays`, `publishSeedEntry`, `externalRelayUrl` to `TownConfig`. Added corresponding env vars (`CROSSTOWN_DISCOVERY`, `CROSSTOWN_SEED_RELAYS`, `CROSSTOWN_PUBLISH_SEED_ENTRY`, `CROSSTOWN_EXTERNAL_RELAY_URL`) to `docker/src/shared.ts`. Added CLI flags (`--discovery`, `--seed-relays`, `--publish-seed-entry`, `--external-relay-url`) to `packages/town/src/cli.ts`. Integrated seed-list discovery into `startTown()`: when `discovery: 'seed-list'`, runs `SeedRelayDiscovery.discover()` before bootstrap to populate knownPeers. After bootstrap, optionally publishes own seed entry.
- **Task 5**: Added `discovery`, `seedRelays`, `publishSeedEntry`, `externalRelayUrl` to `ResolvedTownConfig`. Added `discoveryMode` to `TownInstance` for introspection.
- **Task 6**: Updated all 5 ATDD tests (T-3.4-01 through T-3.4-05) with proper WebSocket mocking. Mock infrastructure simulates Nostr relay protocol (REQ/EVENT/EOSE/OK messages). All 12 test cases pass (23 enabled + 1 skipped E2E stub). Tests cover: happy path discovery, fallback on seed failure, all-seeds-exhausted error, genesis backward compatibility, seed entry publishing, static analysis (no SimplePool), event builder/parser validation, URL/pubkey validation, malformed entry handling, constant value verification.
- **Task 7**: Updated sprint-status.yaml. Build passes (`pnpm build`). Lint has no new errors (1 pre-existing error in x402-publish-handler.test.ts). Full test suite: 74 test files passed, 1445 tests passing, 156 skipped, 0 failures.

### File List

**New files:**
- `packages/core/src/events/seed-relay.ts` -- kind:10036 event builder and parser
- `packages/core/src/discovery/seed-relay-discovery.ts` -- SeedRelayDiscovery class and publishSeedRelayEntry() function

**Modified files (source):**
- `packages/core/src/constants.ts` -- Added `SEED_RELAY_LIST_KIND = 10036`
- `packages/core/src/events/index.ts` -- Export seed relay builder/parser/types
- `packages/core/src/discovery/index.ts` -- Export SeedRelayDiscovery and related types
- `packages/core/src/index.ts` -- Export new public API (constant, events, discovery)
- `packages/town/src/town.ts` -- Added discovery config to TownConfig, ResolvedTownConfig, TownInstance; integrated seed-list discovery into startTown()
- `packages/town/src/cli.ts` -- Added --discovery, --seed-relays, --publish-seed-entry, --external-relay-url CLI flags
- `docker/src/shared.ts` -- Added CROSSTOWN_DISCOVERY, CROSSTOWN_SEED_RELAYS, CROSSTOWN_PUBLISH_SEED_ENTRY, CROSSTOWN_EXTERNAL_RELAY_URL env vars

**Modified files (tests):**
- `packages/core/src/discovery/seed-relay-discovery.test.ts` -- Enabled ATDD tests with WebSocket mocking, added unit tests
- `packages/town/src/cli.test.ts` -- Added seed relay discovery CLI flag and env var tests
- `packages/town/src/town.test.ts` -- Added TownConfig/ResolvedTownConfig/TownInstance seed relay discovery type tests
- `packages/town/src/handlers/x402-publish-handler.test.ts` -- Formatting fixes and import cleanup (pre-existing)

**Modified files (config/docs):**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Updated story status to done
- `_bmad-output/test-artifacts/atdd-checklist-3-4.md` -- ATDD checklist for Story 3.4
- `_bmad-output/test-artifacts/nfr-assessment-3-4.md` -- NFR assessment for Story 3.4

### Change Log

| Date | Summary |
|------|---------|
| 2026-03-13 | Story 3.4 file created (yolo mode). |
| 2026-03-13 | Adversarial review (Claude Opus 4.6, yolo mode): 13 issues found and fixed. Removed incorrect Story 3.1/3.2 dependencies (story is independent per test design). Fixed contradictory RelaySubscriber WebSocket reference (uses SimplePool, not raw ws). Removed incorrect E3-R007 risk mitigation (belongs to Story 3.3). Added missing tests T-3.4-06 (static analysis), T-3.4-12 (E2E stub) from test design. Corrected NIP-33 to NIP-16 replaceable event semantics (kind 10036 is in 10000-19999 range). Fixed IlpPeerInfo.pubkey population note (parseIlpPeerInfo does not set pubkey from content). Added authoritative test-artifacts references. Renumbered test traceability table. Added pubkey derivation note to publishSeedRelayEntry. |
| 2026-03-13 | Implementation complete (Claude Opus 4.6, yolo mode). All 7 tasks implemented. 23 tests passing (1 E2E skipped). Full monorepo: 1445 tests passing, 0 failures, 0 regressions. 2 new files created, 9 files modified. |
| 2026-03-13 | Code review (Claude Opus 4.6, yolo mode): 8 issues found (0 critical, 1 high, 4 medium, 3 low). 7 issues fixed: consolidated duplicate imports (M1), closed WebSocket on error in connectWebSocket (M2), updated story File List (M3), validated CROSSTOWN_DISCOVERY env var in shared.ts (M4), replaced hardcoded timeouts with named constants (H1), cleaned up message handler on timeout (L1), validated seed relay URLs in shared.ts (L3). 1 issue downgraded to informational (L2: dual SeedRelayEntry export is intentional pattern). All tests still passing. |
| 2026-03-13 | Code review #2 (Claude Opus 4.6, yolo mode): 7 issues found (0 critical, 0 high, 3 medium, 4 low). 6 issues fixed. CLI seed relay URL validation added (M1), knownPeers array copy to prevent caller mutation (M2), warning for missing externalRelayUrl (M3), publishSeedRelayEntry timeout cleanup (L1), test import consolidation (L2), removed redundant hardcoded timeouts (L4). 1 issue noted as informational (L3: Docker entrypoint-town.ts not wired, outside story scope). All 1481 tests passing. |
| 2026-03-13 | Code review #3 (Claude Opus 4.6, yolo mode, OWASP + security focus): 7 issues found (0 critical, 1 high, 2 medium, 4 low). 4 issues fixed. Added event signature verification for kind:10036 and kind:10032 events (H1/CWE-345), added CLOSE on EOSE in subscribeAndCollect (M2), reordered timer/WebSocket creation in connectWebSocket (L3), removed closed public relay sockets from openSockets tracking (L4). 2 new tests added for CWE-345 verification. 3 issues noted as informational (M3: error message URL exposure acceptable for server-side logging, L1: publish failure WebSocket cleanup already correct, L2: timeout silent resolution acceptable). All 1483 tests passing. |

## Code Review Record

### Review #3 Date: 2026-03-13

**Reviewer:** Claude Opus 4.6 (adversarial code review, yolo mode, OWASP + security focus)

**Outcome:** Changes Requested -> Fixed -> Approved

**Issues Found:** 0 critical, 1 high, 2 medium, 4 low (7 total)
**Issues Fixed:** 4 (3 noted as informational)

| Severity | ID | Description | File | Fix |
|---|---|---|---|---|
| HIGH | H1 | No signature verification on kind:10036 and kind:10032 events received from public/seed relays (CWE-345: Insufficient Verification of Data Authenticity). Violates project-context.md rule: "Validate all Nostr event signatures -- Never trust unsigned/unverified events" | `seed-relay-discovery.ts` | Added `verifyEvent()` from `nostr-tools/pure` for both kind:10036 events in `querySeedRelayLists()` and kind:10032 events in `discover()`. Invalid events logged and skipped. Added 2 tests for CWE-345 verification |
| MEDIUM | M2 | `subscribeAndCollect` does not send CLOSE message to relay on EOSE -- leaves dangling subscription on the relay. Timeout path sends CLOSE but EOSE path does not | `seed-relay-discovery.ts` | Added `ws.send(JSON.stringify(['CLOSE', subId]))` in EOSE handler, matching timeout cleanup pattern |
| MEDIUM | M3 | `connectWebSocket` error handler includes full URL in error message -- could leak internal topology in error chains | `seed-relay-discovery.ts` | Informational -- acceptable for server-side logging via `console.warn`. Error does not reach HTTP responses (CWE-209 mitigated) |
| LOW | L1 | `publishSeedRelayEntry` WebSocket not closed on publish failure (OK=false) | `seed-relay-discovery.ts` | Informational -- WebSocket IS closed after the promise block on line 413 regardless of publish result |
| LOW | L2 | `subscribeAndCollect` resolves with partial events on timeout without logging a warning | `seed-relay-discovery.ts` | Informational -- silent resolution is acceptable; the caller (discovery flow) handles empty results |
| LOW | L3 | `connectWebSocket` sets timeout timer before WebSocket constructor -- `ws` reference used in timer callback before initialization | `seed-relay-discovery.ts` | Reordered: WebSocket created first, then timer set. Safe in practice (setTimeout is async) but now idiomatic |
| LOW | L4 | `querySeedRelayLists` closes public relay WebSocket but leaves it in `openSockets` array -- `close()` method re-processes already-closed sockets | `seed-relay-discovery.ts` | Added `splice` to remove closed socket from `openSockets` after closing |

### Review #2 Date: 2026-03-13

**Reviewer:** Claude Opus 4.6 (adversarial code review, yolo mode)

**Outcome:** Changes Requested -> Fixed -> Approved

**Issues Found:** 0 critical, 0 high, 3 medium, 4 low (7 total)
**Issues Fixed:** 6 (1 noted as informational)

| Severity | ID | Description | File | Fix |
|---|---|---|---|---|
| MEDIUM | M1 | CLI `--seed-relays` does not validate URL scheme (ws:// or wss://) -- Docker `shared.ts` does, inconsistency (CWE-20) | `cli.ts` | Added ws:// / wss:// validation loop with error exit |
| MEDIUM | M2 | `startTown()` mutates caller's `config.knownPeers` array when merging seed relay peers (side-effect) | `town.ts` | Defensive copy with spread: `[...(config.knownPeers ?? [])]` |
| MEDIUM | M3 | Silent failure when `publishSeedEntry: true` but `externalRelayUrl` not set -- no warning logged | `town.ts` | Added `console.warn` when publishSeedEntry is true but externalRelayUrl missing |
| LOW | L1 | `publishSeedRelayEntry()` timeout does not remove `messageHandler` -- inconsistent with `subscribeAndCollect` cleanup pattern | `seed-relay-discovery.ts` | Added `cleanup()` pattern matching `subscribeAndCollect` |
| LOW | L2 | Test file has duplicate imports from `../constants.js` on separate lines | `seed-relay-discovery.test.ts` | Consolidated into single import statement |
| LOW | L3 | Docker `entrypoint-town.ts` does not consume seed relay discovery config fields | `entrypoint-town.ts` | Informational -- outside story scope, docker entrypoint uses Approach A manual wiring |
| LOW | L4 | Hardcoded timeouts in `startTown()` seed relay discovery duplicate `SeedRelayDiscoveryConfig` defaults | `town.ts` | Removed redundant timeout values, relying on config defaults |

### Review #1 Date: 2026-03-13

**Reviewer:** Claude Opus 4.6 (adversarial code review, yolo mode)

**Outcome:** Changes Requested -> Fixed -> Approved

**Issues Found:** 0 critical, 1 high, 4 medium, 3 low (8 total)
**Issues Fixed:** 7 (1 downgraded to informational)

| Severity | ID | Description | File | Fix |
|---|---|---|---|---|
| HIGH | H1 | `publishSeedRelayEntry()` uses hardcoded timeouts (10000, 5000) instead of named constants | `seed-relay-discovery.ts` | Extracted to `DEFAULT_PUBLISH_CONNECTION_TIMEOUT` and `DEFAULT_PUBLISH_OK_TIMEOUT` constants |
| MEDIUM | M1 | Duplicate imports from same modules on separate lines | `seed-relay-discovery.ts` | Consolidated into single import statements |
| MEDIUM | M2 | `connectWebSocket()` error handler does not close WebSocket (resource leak) | `seed-relay-discovery.ts` | Added `ws.close()` in error handler |
| MEDIUM | M3 | Story File List missing 6 changed files documented by git | `3-4-seed-relay-discovery.md` | Updated File List with all changed files |
| MEDIUM | M4 | `CROSSTOWN_DISCOVERY` env var not validated in Docker entrypoint (unsafe `as` cast) | `docker/src/shared.ts` | Added validation with descriptive error message |
| LOW | L1 | `subscribeAndCollect` message handler not removed on timeout | `seed-relay-discovery.ts` | Added `ws.removeListener()` before resolving |
| LOW | L2 | Dual `SeedRelayEntry` type export from events and discovery modules | `discovery/index.ts` | Informational -- intentional convenience re-export, no change needed |
| LOW | L3 | No URL scheme validation for `CROSSTOWN_SEED_RELAYS` env var | `docker/src/shared.ts` | Added ws:// / wss:// validation loop |
