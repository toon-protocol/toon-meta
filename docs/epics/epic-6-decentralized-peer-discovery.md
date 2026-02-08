# Epic 6: Decentralized Peer Discovery & Social Graph Routing

**Goal:** Replace the ad-hoc bootstrap process with a layered peer discovery system that combines a static known-peer list (local genesis config + ArDrive permanent storage) with dynamic peer expansion driven by NIP-02 social graph signals, unifying the Nostr social graph with the ILP network routing graph via the connector admin API.

## Background

The current bootstrap flow (Epic 4 Docker entrypoint) performs an SPSP handshake during static peer bootstrap — but the returned `spspInfo` is never consumed. The `NostrSpspServer` runs as an always-on listener but serves no purpose during initial bootstrap. Meanwhile, there's no mechanism for peers to expand beyond their initial known-peer list.

The architecture needs three layers:

1. **Static layer** — Known peers loaded at startup from a local genesis config and from ArDrive (permanent, decentralized, free for records under 500 KB)
2. **Dynamic layer** — SPSP handshake (kind:23194/23195) for negotiating peering with newly discovered peers beyond the static list
3. **Social layer** — NIP-02 follow list subscriptions drive discovery; following someone on Nostr signals intent to peer for ILP routing

These layers feed into the **connector admin API** (`POST /admin/peers`, `POST /admin/routes`) from the agent-runtime project to register peers and routes in the ILP connector's routing table.

## Existing System Context

- **Technology stack:** TypeScript, Node 20, pnpm monorepo, Hono HTTP, ws WebSocket, nostr-tools, SQLite
- **Relevant packages:** `packages/core` (discovery, SPSP, trust), `packages/relay` (Nostr relay), `docker/` (entrypoint)
- **Connector admin API** (agent-runtime project): `POST /admin/peers { id, url, authToken, routes[] }`, `POST /admin/routes { prefix, nextHop, priority }`
- **Existing SPSP code:** `NostrSpspClient`, `NostrSpspServer`, event builders/parsers for kind:23194/23195 — all retained and reused
- **Existing discovery:** `NostrPeerDiscovery` (NIP-02 follow list queries, kind:10032 peer info)

## Integration Points

- `packages/core/src/discovery/NostrPeerDiscovery.ts` — existing follow list + kind:10032 discovery
- `packages/core/src/spsp/` — existing SPSP client/server (retained for dynamic peering)
- `packages/core/src/bootstrap.ts` — current bootstrap service (to be refactored)
- `docker/src/entrypoint.ts` — Docker entrypoint (to be rewired)
- Agent-runtime connector admin API at `POST /admin/peers` and `POST /admin/routes`

---

## Story 6.1: Genesis Peer Configuration

**As a** node operator,
**I want** a hardcoded list of well-known genesis peers shipped with the package,
**so that** new nodes can bootstrap into the network without external configuration.

**Acceptance Criteria:**
1. Create `packages/core/src/discovery/genesis-peers.json` with initial genesis peer entries
2. Schema: `[{ "pubkey": "hex64", "relayUrl": "wss://...", "ilpAddress": "g.xxx", "btpEndpoint": "ws://..." }]`
3. Create `GenesisPeerLoader` that imports and validates the JSON at build time
4. Validation: pubkey format (64-char hex), relay URL format (wss:// or ws://), ILP address format (g.xxx)
5. Invalid entries are logged and skipped, not fatal
6. Genesis peers are mergeable with runtime-provided peers (env var `ADDITIONAL_PEERS` as JSON)
7. Unit tests verify loading, validation, and merge behavior

---

## Story 6.2: ArDrive Peer Registry

**As a** node operator,
**I want** peer info records stored permanently on ArDrive,
**so that** peers can be discovered from a decentralized registry that survives relay downtime.

**Acceptance Criteria:**
1. Create `packages/core/src/discovery/ArDrivePeerRegistry.ts`
2. **Read path** (free, no wallet): Query Arweave GraphQL gateway (`https://arweave.net/graphql`) by tags: `App-Name: "agent-society"`, `type: "ilp-peer-info"`
3. Fetch transaction data, parse as `IlpPeerInfo` JSON
4. Return `Map<string, IlpPeerInfo>` keyed by pubkey
5. **Write path**: Use `@ardrive/turbo-sdk` to upload peer info JSON (~500 bytes, within free 500 KB limit)
6. Tags on upload: `App-Name: "agent-society"`, `type: "ilp-peer-info"`, `pubkey: "{hex}"`, `version: "1"`, `Content-Type: "application/json"`
7. Handle gateway unavailability gracefully (log warning, continue without ArDrive peers)
8. Add `@ardrive/turbo-sdk` and `arweave` to `packages/core/package.json` dependencies
9. Unit tests with mocked GraphQL responses verify read/write/error paths

---

## Story 6.3: Bootstrap Service Redesign

**As a** node operator,
**I want** the bootstrap process to load peers from genesis config and ArDrive, then register them via the connector admin API,
**so that** initial peering is simple, reliable, and requires no SPSP handshake.

**Acceptance Criteria:**
1. Refactor `packages/core/src/bootstrap.ts`:
   - Remove `directSpspHandshake()` from bootstrap flow
   - Add method to load and merge peers from genesis config + ArDrive + env var
   - For each known peer: query kind:10032 from their relay for ILP info
   - Register peer via connector admin API: `POST /admin/peers { id, url, authToken, routes }`
   - Publish own kind:10032 to their relay
2. `ConnectorAdminClient` interface updated to match actual agent-runtime API shape:
   - `addPeer(config: { id: string, url: string, authToken: string, routes?: { prefix: string, priority?: number }[] }): Promise<void>`
3. Bootstrap returns list of successfully registered peers
4. Failed peer registrations are logged and skipped (non-fatal)
5. `BootstrapResult` no longer includes `spspInfo` field
6. Unit tests verify the simplified flow with mocked admin API

---

## Story 6.4: Social Graph Peer Discovery

**As a** node operator,
**I want** my node to discover new peers from NIP-02 follow list changes and automatically negotiate peering via SPSP,
**so that** my routing table grows organically through social trust signals.

**Acceptance Criteria:**
1. Create `packages/core/src/discovery/SocialPeerDiscovery.ts`
2. Subscribe to NIP-02 follow list events (kind:3) for the node's pubkey
3. When a new follow is detected (pubkey not already peered):
   a. Query their relay for kind:10032 (ILP Peer Info)
   b. Perform SPSP handshake via `NostrSpspClient` (kind:23194 → 23195) to negotiate peering
   c. Register peer via connector admin API (`POST /admin/peers`)
   d. Log successful peering
4. When an unfollow is detected (pubkey removed from follow list):
   a. Optionally remove peer via `DELETE /admin/peers/:peerId`
   b. Log peer removal
5. Expose `start(): Subscription` that returns unsubscribe handle
6. Handle errors gracefully per-peer (one failed peer doesn't block others)
7. Respect a configurable cooldown between discovery attempts (prevent flooding)
8. Unit tests verify follow detection, SPSP handshake trigger, and admin API calls

---

## Story 6.5: Docker Entrypoint Integration

**As a** node operator running the full agent-society container,
**I want** the Docker entrypoint to use the new layered discovery system,
**so that** the container bootstraps from genesis/ArDrive and expands via social graph.

**Acceptance Criteria:**
1. Update `docker/src/entrypoint.ts`:
   - Load genesis peers + query ArDrive registry on startup
   - Run bootstrap with combined static peer list (no SPSP during bootstrap)
   - Start `NostrSpspServer` for handling incoming peering requests from other nodes
   - Start `SocialPeerDiscovery` subscription for dynamic peer expansion
   - Wire connector admin URL from `CONNECTOR_ADMIN_URL` env var
2. New environment variables:
   - `ARDRIVE_ENABLED` (optional, default: `true`): Enable/disable ArDrive peer lookup
   - `ADDITIONAL_PEERS` (optional): JSON array of extra peers beyond genesis list
3. Startup logs show: genesis peers loaded, ArDrive peers found, bootstrap results, social discovery started
4. Graceful shutdown stops social discovery subscription
5. Integration test: container boots, loads peers, health check passes

---

## Compatibility Requirements

- [x] Existing `/health` and `/handle-payment` BLS endpoints unchanged
- [x] kind:10032 (ILP Peer Info) event format unchanged
- [x] kind:23194/23195 (SPSP Request/Response) event format unchanged — still used for dynamic peering
- [x] WebSocket relay protocol unchanged (NIP-01)
- [x] Connector admin API calls match agent-runtime's actual API shape

## Risk Mitigation

- **Primary Risk:** ArDrive gateway unavailability blocks bootstrap
- **Mitigation:** ArDrive is optional fallback; genesis peers provide guaranteed bootstrap path. ArDrive failures are caught and logged, never fatal.
- **Rollback Plan:** Revert to previous Docker entrypoint; static peers still work via env var override

## Definition of Done

- [ ] All 5 stories completed with acceptance criteria met
- [ ] Genesis peers JSON file committed with at least 1 real bootstrap node
- [ ] ArDrive read/write tested against live Arweave gateway
- [ ] Docker image builds and boots with new discovery flow
- [ ] SPSP handshake verified working for dynamic peering
- [ ] Social graph subscription tested with follow/unfollow simulation
- [ ] Connector admin API integration verified against agent-runtime
- [ ] Existing relay and BLS functionality unaffected (no regression)
- [ ] Unit tests pass: `pnpm -r test`

## Dependencies

- Epic 1 (Foundation & Peer Discovery) — provides `NostrPeerDiscovery`, kind:10032 events
- Epic 2 (SPSP Over Nostr) — provides `NostrSpspClient`/`NostrSpspServer`, kind:23194/23195 events
- Epic 4 (ILP-Gated Relay) — provides relay, BLS, Docker entrypoint
- Epic 5 (Standalone BLS Docker) — provides `packages/bls/`
- Agent-runtime project — provides connector admin API (`POST /admin/peers`, `POST /admin/routes`)

## Out of Scope (Future)

- Reputation-based peer scoring (NIP-57 zaps)
- Automatic credit limit adjustment from social trust scores (Epic 3)
- Multi-hop routing discovery
- Peer health monitoring and automatic removal
