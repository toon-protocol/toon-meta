# 5. Epic Details

## Epic 1: Foundation & Peer Discovery

**Goal:** Establish the project structure, build tooling, and core infrastructure, then deliver the ability to discover ILP peers from a Nostr follow list. This epic provides the foundational capability that all other features build upon.

### Story 1.1: Project Setup and Build Infrastructure

**As a** developer,
**I want** a properly configured TypeScript monorepo with build, test, and lint tooling,
**so that** I can develop, test, and publish the library packages.

**Acceptance Criteria:**
1. Monorepo structure created with `packages/core`, `packages/relay`, `packages/examples` directories
2. TypeScript configured with strict mode in root `tsconfig.json` with package-level extensions
3. Vitest configured for unit testing with coverage reporting
4. ESLint and Prettier configured for code quality
5. Package.json files configured for ESM output with proper exports
6. `npm run build` successfully compiles all packages
7. `npm run test` successfully runs (empty test suites pass)
8. `npm run lint` successfully validates code style

### Story 1.2: Event Kind Constants and Type Definitions

**As a** library consumer,
**I want** TypeScript types and constants for all ILP-related Nostr event kinds,
**so that** I can work with strongly-typed event data.

**Acceptance Criteria:**
1. Constants exported for event kinds: `ILP_PEER_INFO = 10032`, `SPSP_INFO = 10047`, `SPSP_REQUEST = 23194`, `SPSP_RESPONSE = 23195`
2. TypeScript interface `IlpPeerInfo` defined with fields: `ilpAddress`, `btpEndpoint`, `settlementEngine`, `assetCode`, `assetScale`
3. TypeScript interface `SpspInfo` defined with fields: `destinationAccount`, `sharedSecret`
4. TypeScript interface `SpspRequest` defined for dynamic SPSP requests
5. TypeScript interface `SpspResponse` defined for dynamic SPSP responses
6. All interfaces exported from `@agent-society/core`
7. Unit tests verify type exports are accessible

### Story 1.3: Event Parser and Builder Utilities

**As a** library consumer,
**I want** utilities to parse Nostr events into typed objects and build events from typed data,
**so that** I don't have to manually handle event serialization.

**Acceptance Criteria:**
1. `parseIlpPeerInfo(event: NostrEvent): IlpPeerInfo` parses kind:10032 events
2. `buildIlpPeerInfoEvent(info: IlpPeerInfo, secretKey): NostrEvent` creates signed kind:10032 events
3. `parseSpspInfo(event: NostrEvent): SpspInfo` parses kind:10047 events
4. `buildSpspInfoEvent(info: SpspInfo, secretKey): NostrEvent` creates signed kind:10047 events
5. Parsers throw descriptive errors for malformed events
6. Unit tests cover valid parsing, error cases, and round-trip (build → parse)

### Story 1.4: NIP-02 Follow List Discovery

**As an** agent developer,
**I want** to retrieve the list of pubkeys an agent follows,
**so that** I can identify potential ILP peers.

**Acceptance Criteria:**
1. `NostrPeerDiscovery` class created with constructor accepting relay URLs and optional SimplePool
2. `getFollows(pubkey: string): Promise<string[]>` method queries kind:3 events and returns followed pubkeys
3. Method queries multiple relays and deduplicates results
4. Method handles relay failures gracefully (continues with available relays)
5. Unit tests with mocked SimplePool verify correct filter construction and response parsing
6. Unit tests verify graceful handling of missing/empty follow lists

### Story 1.5: ILP Peer Info Discovery

**As an** agent developer,
**I want** to discover ILP connection info for peers in my follow list,
**so that** I can configure peering relationships.

**Acceptance Criteria:**
1. `discoverPeers(pubkey: string): Promise<Map<string, IlpPeerInfo>>` method added to `NostrPeerDiscovery`
2. Method retrieves follow list, then queries kind:10032 events for each followed pubkey
3. Returns Map of pubkey → IlpPeerInfo for peers with published ILP info
4. Peers without kind:10032 events are silently excluded from results
5. Method completes within 5 seconds for 100 follows (mocked test)
6. Unit tests verify correct aggregation of follow list and peer info queries

### Story 1.6: Peer Update Subscriptions

**As an** agent developer,
**I want** to subscribe to updates when peers change their ILP info,
**so that** my routing table stays current.

**Acceptance Criteria:**
1. `subscribeToPeerUpdates(pubkey: string, callback: (pubkey, info) => void): Subscription` method added
2. Subscription receives callbacks when kind:10032 events are published by followed pubkeys
3. `Subscription` object has `unsubscribe()` method to stop receiving updates
4. Callback receives parsed `IlpPeerInfo` (not raw events)
5. Unit tests verify subscription lifecycle and callback invocation

---

## Epic 2: SPSP Over Nostr

**Goal:** Enable agents to exchange SPSP parameters over Nostr, supporting both static (published) parameters and dynamic (request/response) handshakes with encryption. This eliminates the need for HTTPS infrastructure.

### Story 2.1: Static SPSP Info Query

**As an** agent developer,
**I want** to query a peer's published SPSP parameters,
**so that** I can set up payments without a request/response handshake.

**Acceptance Criteria:**
1. `NostrSpspClient` class created with constructor accepting relay URLs and optional SimplePool
2. `getSpspInfo(pubkey: string): Promise<SpspInfo | null>` method queries kind:10047 events
3. Returns parsed SpspInfo or null if peer has no published SPSP info
4. Method queries multiple relays and returns most recent event (by created_at)
5. Unit tests verify query construction, parsing, and null handling

### Story 2.2: Static SPSP Info Publishing

**As an** agent developer,
**I want** to publish my SPSP parameters to Nostr,
**so that** peers can discover my payment endpoint.

**Acceptance Criteria:**
1. `NostrSpspServer` class created with constructor accepting relay URLs, keypair, and optional SimplePool
2. `publishSpspInfo(info: SpspInfo): Promise<void>` method publishes kind:10047 replaceable event
3. Event is signed with provided secret key
4. Event is published to all configured relays
5. Method waits for at least one relay confirmation before resolving
6. Unit tests verify event construction and publishing flow

### Story 2.3: Dynamic SPSP Request (Client)

**As an** agent developer,
**I want** to request fresh SPSP parameters from a peer,
**so that** I can get a unique payment destination for my specific payment.

**Acceptance Criteria:**
1. `requestSpspInfo(recipientPubkey: string): Promise<SpspInfo>` method added to `NostrSpspClient`
2. Method generates kind:23194 ephemeral event with NIP-44 encrypted payload
3. Method subscribes for kind:23195 response from recipient
4. Response payload is decrypted and parsed to SpspInfo
5. Method times out after configurable duration (default 10s) with descriptive error
6. Unit tests verify encryption, request/response flow, and timeout handling

### Story 2.4: Dynamic SPSP Request Handler (Server)

**As an** agent developer,
**I want** to handle incoming SPSP requests and respond with fresh parameters,
**so that** I can provide unique payment destinations to requesters.

**Acceptance Criteria:**
1. `handleSpspRequests(generator: () => SpspInfo): Subscription` method added to `NostrSpspServer`
2. Method subscribes to kind:23194 events addressed to the agent's pubkey
3. Incoming requests are decrypted using NIP-44
4. Generator function is called to produce fresh SpspInfo for each request
5. Response is encrypted and published as kind:23195 event
6. Unit tests verify decryption, generator invocation, and response encryption

---

## Epic 3: Social Trust Engine

**Goal:** Provide trust score computation from social graph data, enabling agents to derive credit limits from social relationships rather than manual configuration.

### Story 3.1: Social Distance Calculation

**As an** agent developer,
**I want** to calculate social distance between two pubkeys,
**so that** I can use proximity in the social graph as a trust signal.

**Acceptance Criteria:**
1. `SocialTrustManager` class created with constructor accepting relay URLs and optional SimplePool
2. `getSocialDistance(fromPubkey: string, toPubkey: string): Promise<number>` method implemented
3. Returns 1 for direct follows, 2 for follows-of-follows, etc.
4. Returns `Infinity` if no path found within configurable max depth (default 3)
5. Uses BFS algorithm for shortest path discovery
6. Unit tests verify distance calculation for various graph topologies

### Story 3.2: Mutual Followers Count

**As an** agent developer,
**I want** to count mutual followers between two pubkeys,
**so that** I can use shared connections as a trust signal.

**Acceptance Criteria:**
1. `getMutualFollowers(pubkeyA: string, pubkeyB: string): Promise<string[]>` method added
2. Returns array of pubkeys that follow both A and B
3. Method efficiently queries follower lists for both pubkeys
4. Unit tests verify correct intersection calculation

### Story 3.3: Configurable Trust Score Calculator

**As an** agent developer,
**I want** to configure how trust scores are computed from multiple signals,
**so that** I can tune trust derivation for my use case.

**Acceptance Criteria:**
1. `TrustConfig` interface defined with weights for: `socialDistance`, `mutualFollowers`, `reputation`
2. `computeTrustScore(fromPubkey, toPubkey, config?): Promise<TrustScore>` method added
3. `TrustScore` type includes: `score` (0-1), `socialDistance`, `mutualFollowerCount`, `breakdown`
4. Default config provides sensible weights (e.g., distance=0.5, mutuals=0.3, reputation=0.2)
5. Score of 1.0 = maximum trust, 0.0 = no trust
6. Unit tests verify score calculation with various configs and inputs

### Story 3.4: Trust Score to Credit Limit Mapping

**As an** agent developer,
**I want** to map trust scores to ILP credit limits,
**so that** I can automatically configure peer credit based on social trust.

**Acceptance Criteria:**
1. `CreditLimitConfig` interface defined with: `maxCredit`, `minCredit`, `curve` (linear/exponential)
2. `calculateCreditLimit(trustScore: TrustScore, config?): number` function implemented
3. Linear curve: `minCredit + (maxCredit - minCredit) * score`
4. Exponential curve: `minCredit + (maxCredit - minCredit) * score^2`
5. Unit tests verify credit calculations for various scores and configs

---

## Epic 4: ILP-Gated Relay

**Goal:** Deliver a reference implementation of a Nostr relay where writes require ILP payment, demonstrating the pay-to-write pattern and providing agents with spam-resistant infrastructure.

### Story 4.1: Basic Nostr Relay (Read Path)

**As a** relay operator,
**I want** a WebSocket server that handles NIP-01 read operations,
**so that** clients can query events without payment.

**Acceptance Criteria:**
1. WebSocket server accepts connections on configurable port
2. Server handles NIP-01 `REQ` messages with subscription filters
3. Server responds with matching events from in-memory store
4. Server sends `EOSE` (end of stored events) after initial results
5. Server handles `CLOSE` messages to terminate subscriptions
6. Unit tests verify REQ/EOSE/CLOSE message handling

### Story 4.2: Event Storage with SQLite

**As a** relay operator,
**I want** events persisted to SQLite,
**so that** events survive relay restarts.

**Acceptance Criteria:**
1. SQLite database created with events table (id, pubkey, kind, content, tags, created_at, sig)
2. Events are stored on successful write
3. REQ queries read from SQLite with proper filtering
4. Replaceable events (kinds 10000-19999) replace previous events from same pubkey
5. Database file location is configurable
6. Unit tests verify persistence and replacement logic

### Story 4.3: TOON Encoding for Events

**As a** library developer,
**I want** utilities to encode/decode Nostr events in TOON format,
**so that** events can be embedded in ILP packets.

**Acceptance Criteria:**
1. `encodeEventToToon(event: NostrEvent): Uint8Array` function implemented
2. `decodeEventFromToon(data: Uint8Array): NostrEvent` function implemented
3. Encoding preserves all event fields including signature
4. Round-trip (encode → decode) produces identical event
5. Unit tests verify encoding/decoding for various event types

### Story 4.4: ILP Payment Verification (BLS Pattern)

**As a** relay operator,
**I want** a Business Logic Server that verifies ILP payments before accepting writes,
**so that** only paid events are stored.

**Acceptance Criteria:**
1. BLS HTTP endpoint accepts ILP STREAM packets
2. BLS extracts TOON-encoded event from packet data
3. BLS verifies payment amount meets pricing requirements
4. BLS returns accept/reject response per ILP STREAM protocol
5. On accept, event is passed to relay for storage
6. Unit tests verify payment verification and accept/reject flows

### Story 4.5: Configurable Pricing Service

**As a** relay operator,
**I want** to configure pricing for event storage,
**so that** I can set sustainable rates for my relay.

**Acceptance Criteria:**
1. `PricingConfig` interface with: `basePricePerByte`, `kindOverrides: Map<number, number>`
2. `PricingService` class calculates price for given event
3. Price = `eventSizeBytes * basePricePerByte` (or kind override if present)
4. Default prices configurable via environment variables or config file
5. Unit tests verify price calculation with various configs

### Story 4.6: Self-Write Bypass

**As an** agent operator,
**I want** my own events stored without payment,
**so that** I don't pay myself to write to my own relay.

**Acceptance Criteria:**
1. Relay configured with owner pubkey
2. Events signed by owner pubkey bypass payment verification
3. Owner events still go through normal validation (valid signature, etc.)
4. Unit tests verify bypass for owner and payment requirement for others

### Story 4.7: Integration Example

**As a** developer,
**I want** a complete example of an agent using the ILP-gated relay,
**so that** I can understand the end-to-end flow.

**Acceptance Criteria:**
1. Example in `packages/examples/ilp-gated-relay-demo`
2. Example includes: agent setup, relay startup, payment flow, event verification
3. README with step-by-step instructions
4. Example uses mocked ILP connector for local testing without real payments
5. Code is well-commented explaining each step

---
