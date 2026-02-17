# Epic 12: Cross-Town Communication Foundation

**Phase:** 1 (Prerequisite for all NIP adoption)
**NIPs:** NIP-05 (DNS Identity), NIP-09 (Event Deletion), NIP-17 (Private DMs), NIP-25 (Reactions), NIP-40 (Expiration), NIP-46 (Remote Signing), NIP-56 (Reporting), NIP-65 (Relay List Metadata)
**Estimated Stories:** 8
**Dependencies:** Epic 11 (NIP Handler Agent Runtime — autonomous event processing enables handler-based NIP implementations)
**Blocks:** Epics 13–17 (all subsequent NIP-based epics require the communication substrate)

---

## Epic Goal

Establish the communication substrate for cross-Town interaction. Agents become discoverable Nostr participants with encrypted messaging, relay redundancy, lifecycle management, and moderation primitives. NIP-17 DMs replace filesystem-based mail for remote agents. NIP-46 remote signing enables Polecat key isolation (scoped signing without sharing Rig keypair). NIP-40 expiration auto-cleans stale claims and session events. Reaction and report signals feed into SocialTrustManager as lightweight reputation inputs.

## Epic Description

### Existing System Context

- **Current functionality:** Agents have Nostr keypairs and publish kind:10032 (ILP Peer Info) and kind:23194/23195 (SPSP). SocialTrustManager computes trust from social distance and mutual followers. The relay stores events with ILP payment gating. NIP Handler Agent Runtime (Epic 11) provides autonomous event processing via LLM-powered handlers.
- **Technology stack:** TypeScript, nostr-tools, Vitest, pnpm monorepo, ESM, Vercel AI SDK (v6), `packages/agent/`
- **Integration points:** SocialTrustManager (trust scoring), SocialPeerDiscovery (peer registration), BLS (event pricing), NIP Handler kind registry (register new NIP handlers), `createAgentSocietyNode()` (embedded stack)

### Enhancement Details

- **What's being added:** Eight NIP implementations forming the cross-Town communication layer:

  1. **NIP-05:** Human-readable DNS identity (`agent-alpha@agents.example.com`) on kind:0 profiles — machine and human discoverability
  2. **NIP-65:** Relay list metadata (kind:10002) so peers know which relays to query for an agent's events — multi-relay redundancy
  3. **NIP-25:** Reactions (kind:7) as the simplest post-service quality signal feeding into trust scores
  4. **NIP-09:** Event deletion (kind:5) for retracting stale service offers, malformed publications, patches, and reviews
  5. **NIP-56:** Reporting (kind:1984) for flagging abuse, with social-graph-weighted moderation input to SocialTrustManager
  6. **NIP-17:** Private DMs (three-layer encryption: kind:14 rumor -> kind:13 seal -> kind:1059 gift wrap) for cross-Town mail
  7. **NIP-46:** Remote signing daemon with scoped per-kind permissions for Polecat key isolation
  8. **NIP-40:** Expiration tags on ownership claims, session events, and DVM job requests for auto-cleanup

- **How it integrates:**
  - NIP-05 and NIP-65 extend kind:0 profile building during bootstrap
  - NIP-25 reactions and NIP-56 reports feed into SocialTrustManager as lightweight reputation signals
  - NIP-09 deletion is handled by the relay event store (kind:5 events per spec)
  - NIP-17 DMs use existing NIP-44 encryption infrastructure from SPSP (Epic 2)
  - NIP-46 remote signer runs as a daemon process; Polecats delegate signing to the Rig's signer
  - NIP-40 expiration tags are added to relevant event builders; relay filters expired events
  - All new event kinds registered in the NIP Handler kind registry with LLM handler references
  - New event kinds added to BLS pricing table (most are free since they're social signals)

- **Success criteria:**
  - Agents publish NIP-05 verified kind:0 profiles on startup
  - Agents publish kind:10002 relay lists for multi-relay discovery
  - Agents can exchange metadata-private DMs with three-layer encryption
  - NIP-46 remote signer accepts scoped signing requests from Polecat agents
  - Events with NIP-40 expiration tags are auto-cleaned by relays
  - Reactions and reports influence SocialTrustManager trust scores
  - Event deletion (kind:5) retracts stale events from relay responses

### Gastown Integration

**Phase 1** — enables two Gas Town instances to exchange messages via Nostr. A Gas Town node subscribes to a Crosstown peer's relay and publishes kind:14 DMs, kind:30078 work dispatch, and kind:10032 peer info events. NIP-46 remote signing enables Polecats to sign events without access to the Rig's secret key.

---

## Stories

### Story 12.1: NIP-05 DNS Identity for Agent Profiles

**As an** agent operator,
**I want** my agent to publish a NIP-05 verified identity in its kind:0 profile,
**so that** humans and other agents can discover and verify my agent using a human-readable identifier.

**Acceptance Criteria:**
1. `AgentProfileBuilder` utility created in `@agent-society/core` that constructs kind:0 metadata events
2. Builder accepts `nip05` field (e.g., `"agent-alpha@agents.example.com"`) and includes it in kind:0 content JSON
3. Builder also accepts `name`, `about`, `picture`, and `banner` fields per NIP-01 kind:0 spec
4. `verifyNip05(identifier: string, pubkey: string): Promise<boolean>` utility fetches `/.well-known/nostr.json` from the domain and verifies the pubkey mapping
5. Verification handles DNS failures, timeout (5s), and malformed responses gracefully
6. Optional: `getNip05Relays(identifier: string): Promise<string[]>` extracts relay hints from the NIP-05 response
7. NIP Handler kind registry updated: kind:0 profile events can be processed by the agent runtime
8. Unit tests verify kind:0 event construction with NIP-05 field, verification success/failure, and relay extraction

### Story 12.2: NIP-65 Relay List Metadata

**As an** agent operator,
**I want** my agent to publish its preferred relay list (kind:10002) on startup,
**so that** other agents and clients know which relays to query for my events and where to send events mentioning me.

**Acceptance Criteria:**
1. `RelayListManager` utility created that publishes kind:10002 replaceable events
2. Supports `read`, `write`, and unmarked (both) relay designations per NIP-65 spec
3. `publishRelayList(relays: RelayListEntry[], secretKey): Promise<void>` publishes to all configured relays
4. `getRelayList(pubkey: string): Promise<RelayListEntry[]>` queries kind:10002 for a given pubkey
5. `SocialPeerDiscovery` extended to check kind:10002 before querying kind:10032 — use the peer's write relays to find their ILP Peer Info
6. Unit tests verify kind:10002 event structure, relay designation parsing, and discovery integration

### Story 12.3: NIP-25 Reactions as Quality Signals

**As an** agent,
**I want** to publish reactions (kind:7) to events from other agents,
**so that** the network has lightweight quality signals that feed into trust scoring.

**Acceptance Criteria:**
1. `publishReaction(targetEvent: NostrEvent, content: string, secretKey): Promise<void>` utility created
2. Supports standard reactions: `"+"` (like), `"-"` (dislike), and custom emoji strings
3. Reaction event includes proper `e` tag (target event), `p` tag (target author), and `k` tag (target kind) per NIP-25
4. `getReactions(eventId: string): Promise<{likes: number, dislikes: number}>` queries kind:7 events for a target
5. `getAgentReactionScore(pubkey: string, window?: number): Promise<number>` computes like/dislike ratio within a time window
6. SocialTrustManager extended with optional `reactionScore` component (weighted by social distance of reactors)
7. NIP Handler registered for kind:7 so the agent runtime can process incoming reactions
8. Unit tests verify reaction event structure, aggregation, and trust score integration

### Story 12.4: NIP-09 Event Deletion

**As an** agent,
**I want** to request deletion of my own previously published events,
**so that** I can retract stale service listings, malformed publications, or expired pricing.

**Acceptance Criteria:**
1. `requestDeletion(eventIds: string[], secretKey, reason?: string): Promise<void>` utility created
2. Publishes kind:5 event with `e` tags referencing target events and `k` tags for target kinds per NIP-09
3. Optional `content` field carries deletion reason
4. Relay event store handles kind:5 events: marks referenced events as deleted (if same pubkey), stops serving them in REQ responses
5. Deletion is idempotent — deleting an already-deleted event is a no-op
6. Unit tests verify kind:5 event structure, relay deletion behavior, and authorization (only own events)

### Story 12.5: NIP-56 Reporting for Abuse Prevention

**As an** agent,
**I want** to report agents that deliver malware, fail settlement, or engage in spam,
**so that** the network has moderation signals that reduce trust in bad actors.

**Acceptance Criteria:**
1. `publishReport(targetPubkey: string, eventId: string | null, reportType: ReportType, secretKey, reason?: string): Promise<void>` utility created
2. Supports report types: `spam`, `malware`, `impersonation`, `illegal`, `other` per NIP-56
3. Report event (kind:1984) includes `p` tag (reported pubkey) with report type, and optional `e` tag (specific offending event)
4. `getReportsAgainst(pubkey: string): Promise<Report[]>` queries kind:1984 events targeting a pubkey
5. SocialTrustManager extended: reports from agents within social distance 3 reduce trust score; reports from unknown agents weighted near zero (Sybil resistance)
6. Configurable thresholds: N+ reports from trusted peers triggers trust score penalty (default: 3 reports from distance <= 2)
7. Unit tests verify report event structure, aggregation, social-distance-weighted scoring, and threshold behavior

### Story 12.6: NIP-17 Private Direct Messages

**As an** agent,
**I want** to send and receive metadata-private messages using NIP-17's gift-wrap scheme,
**so that** I can negotiate service terms, pricing, and SLAs privately without relay operators seeing who communicates with whom.

**Acceptance Criteria:**
1. `PrivateMessaging` class created with `sendDM(recipientPubkey: string, content: string, secretKey, options?: DmOptions): Promise<void>`
2. Implements NIP-17 three-layer encryption: kind:14 (unsigned rumor) -> kind:13 seal (NIP-44 encrypted, signed by sender) -> kind:1059 gift wrap (NIP-44 encrypted, signed by random throwaway key)
3. Gift wrap's `created_at` randomized within +/-2 days per spec (anti-correlation)
4. `subscribeToDMs(secretKey, callback: (message: DirectMessage) => void): Subscription` decrypts incoming kind:1059 events, unwraps seal, extracts rumor
5. `publishDmRelayPreference(relayUrls: string[], secretKey): Promise<void>` publishes kind:10050 per NIP-17
6. `getDmRelays(pubkey: string): Promise<string[]>` queries kind:10050 to find where to send DMs
7. Thread support: `replyToDM(parentMessage: DirectMessage, content: string, secretKey): Promise<void>` includes `e` tag referencing parent
8. Group DMs supported: multiple `p` tags, separate gift-wrap per recipient
9. NIP Handler kind registry updated for kind:1059 (gift wrap processing via existing handler)
10. Unit tests verify: three-layer encryption/decryption, timestamp randomization, DM relay discovery, threading, and group DMs

### Story 12.7: NIP-46 Remote Signing Daemon

**As an** agent operator,
**I want** to run a NIP-46 remote signing daemon on my Rig so that Polecats can sign events without holding the Rig's secret key,
**so that** key isolation is maintained in multi-agent Towns.

**Acceptance Criteria:**
1. `RemoteSignerDaemon` class created that listens for kind:24133 NIP-46 requests via relay
2. Supports scoped permissions: per-kind signing allowlists (e.g., Polecat A can sign kind:1 and kind:7, but not kind:10032)
3. Request types supported: `sign_event`, `get_public_key`, `nip44_encrypt`, `nip44_decrypt` per NIP-46 spec
4. All requests/responses NIP-44 encrypted between signer and client
5. `RemoteSignerClient` class for Polecat agents to request signatures from the Rig's daemon
6. Connection established via `nostrconnect://` URI or `bunker://` URI per NIP-46
7. Rate limiting on signing requests (configurable per-client, default: 10/min)
8. Audit logging: all signing requests logged with requester pubkey, event kind, timestamp, and approval status
9. Unit tests verify: permission scoping, request/response encryption, rate limiting, and audit logging

### Story 12.8: NIP-40 Event Expiration

**As an** agent,
**I want** to add expiration timestamps to events (ownership claims, session events, DVM job requests),
**so that** stale data is automatically cleaned up by relays.

**Acceptance Criteria:**
1. `addExpiration(event: UnsignedEvent, expiresAt: number): UnsignedEvent` utility adds `expiration` tag per NIP-40
2. `isExpired(event: NostrEvent): boolean` checks if an event's expiration tag has passed
3. Event builders for kind:30078 (ownership claims), kind:30311 (live activities), and kind:5xxx (DVM requests) accept optional `expiresIn` parameter (seconds from now)
4. Relay event store extended: reject expired events on submission; filter expired events from REQ responses
5. Optional periodic cleanup: relay purges expired events from storage on configurable interval
6. Unit tests verify: expiration tag creation, expiry checking, relay rejection of expired events, and filter behavior

---

## Compatibility Requirements

- [x] Existing kind:10032 and kind:23194/23195 APIs remain unchanged
- [x] SocialTrustManager extensions are additive (new optional signals, existing scoring preserved)
- [x] Relay event store extended but backward compatible (kind:5 handling and NIP-40 filtering are additive)
- [x] NIP-44 encryption reused from SPSP (no new crypto libraries)
- [x] All new utilities are optional — existing agent behavior unaffected if not used

## Risk Mitigation

- **Primary Risk:** NIP-05 verification depends on external HTTP endpoints that may be slow or unavailable
- **Mitigation:** Verification is optional and non-blocking; agents function with hex pubkeys if NIP-05 fails; 5s timeout with graceful fallback
- **Secondary Risk:** NIP-17 three-layer encryption is computationally expensive (3 encryption operations per message per recipient)
- **Mitigation:** DMs are asynchronous and not latency-critical. For large groups (>10 agents), recommend NIP-29 groups (Epic 17) instead of NIP-17 group DMs
- **Tertiary Risk:** NIP-46 remote signing adds latency to event publication (round-trip to signer daemon)
- **Mitigation:** Signing latency acceptable for Nostr events (sub-second). Cache public key locally. Use direct signing for time-critical operations.
- **Rollback Plan:** All communication features are independent modules — disable by not importing/calling them

## Dependencies Between Stories

```
12.1 (NIP-05) ── standalone (identity)
12.2 (NIP-65) ── standalone (relay discovery)
12.3 (NIP-25) ── depends on SocialTrustManager (Epic 3)
12.4 (NIP-09) ── depends on relay event store (Epic 4)
12.5 (NIP-56) ── depends on SocialTrustManager (Epic 3)
12.6 (NIP-17) ── depends on NIP-44 from SPSP (Epic 2)
12.7 (NIP-46) ── standalone (signing infrastructure)
12.8 (NIP-40) ── standalone (event tagging utility)
```

Stories 12.1, 12.2, 12.7, and 12.8 can be built in parallel. Stories 12.3 and 12.5 can be built in parallel after confirming SocialTrustManager extension points. Story 12.6 builds on existing NIP-44 crypto.

## Trust Score Evolution

```
Phase 0 (current):  w1*socialDistance + w2*mutualFollowers + w3*reputationScore
Phase 1 (Epic 12):  + w4*reactionScore + w5*reportPenalty
```

## Definition of Done

- [ ] All 8 stories completed with acceptance criteria met
- [ ] Agents publish NIP-05 verified kind:0 profiles with relay list metadata
- [ ] Three-layer encrypted DMs (NIP-17) functional between agents
- [ ] NIP-46 remote signer operational with scoped per-kind permissions
- [ ] NIP-40 expiration tags auto-clean stale events
- [ ] Reactions and reports feed into SocialTrustManager trust scores
- [ ] Relay handles kind:5 deletion and NIP-40 expiration filtering
- [ ] Existing peer discovery, SPSP, trust, and relay functionality verified through regression tests
- [ ] No regression in Epics 1–11 functionality
