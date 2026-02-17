# 2. Requirements

## 2.1 Functional Requirements

**Core Protocol (Epics 1-4)**

- **FR1:** The library SHALL discover ILP peers by querying NIP-02 follow lists from configured Nostr relays
- **FR2:** The library SHALL query kind:10032 (ILP Peer Info) events to retrieve connector ILP addresses, BTP endpoints, settlement capabilities, and settlement addresses for discovered peers
- **FR3:** The library SHALL subscribe to peer updates and notify consumers when peer info changes via RelayMonitor
- **FR4:** The library SHALL support dynamic SPSP handshakes via kind:23194 (SPSP Request) and kind:23195 (SPSP Response) ephemeral events with NIP-44 encryption
- **FR5:** The library SHALL handle incoming kind:23194 SPSP requests and respond with kind:23195 encrypted responses
- **FR6:** The library SHALL compute trust scores based on social distance (hops in follow graph)
- **FR7:** The library SHALL provide a configurable trust calculator that can incorporate mutual followers, reputation (zaps), and historical payment success
- **FR8:** The library SHALL provide TypeScript interfaces for all ILP-related Nostr event kinds (10032, 23194, 23195)
- **FR9:** The library SHALL provide parser and builder utilities for ILP event kinds
- **FR10:** The ILP-gated relay reference implementation SHALL accept ILP payments for event writes using TOON-encoded events in ILP packets
- **FR11:** The ILP-gated relay SHALL provide a configurable pricing service supporting per-byte and per-kind pricing
- **FR12:** The ILP-gated relay SHALL serve NIP-01 reads over WebSocket without payment
- **FR13:** The ILP-gated relay SHALL bypass payment requirements for the agent's own events (self-write)

**BLS & Docker (Epic 5)**

- **FR14:** The BLS SHALL be extracted as a standalone package (`@crosstown/bls`) with independent build and deployment
- **FR15:** The BLS Docker image SHALL implement the standard BLS contract (`/health`, `/handle-packet`) for agent-runtime integration
- **FR16:** The BLS SHALL be configurable via environment variables (NODE_ID, NOSTR_SECRET_KEY, ILP_ADDRESS, pricing, storage)
- **FR17:** The BLS SHALL persist events to SQLite on a mounted volume, with in-memory fallback

**Layered Discovery & Bootstrap (Epics 6, 8)**

- **FR18:** The library SHALL provide layered peer discovery: genesis peers (hardcoded JSON) → ArDrive registry (decentralized) → NIP-02 social graph (dynamic)
- **FR19:** The library SHALL implement a multi-phase bootstrap lifecycle: discovering → registering → handshaking → announcing → ready
- **FR20:** The bootstrap service SHALL send SPSP handshakes as ILP packets via `POST /ilp/send` on agent-runtime
- **FR21:** The bootstrap service SHALL publish kind:10032 peer announcements as paid ILP packets after initial handshake
- **FR22:** The RelayMonitor SHALL detect new kind:10032 events on the relay and initiate SPSP handshakes with newly announced peers

**Settlement Negotiation (Epic 7)**

- **FR23:** The SPSP handshake SHALL negotiate settlement chains by intersecting `supportedChains` between requester and responder
- **FR24:** The SPSP responder SHALL open payment channels via the connector Admin API during handshake, returning channelId in the response
- **FR25:** kind:10032 events SHALL advertise settlement capabilities (supportedChains, settlementAddresses, preferredTokens, tokenNetworks)
- **FR26:** The BLS SHALL accept configurable 0-amount ILP packets for SPSP requests during bootstrap (`SPSP_MIN_PRICE=0`)

**Embedded Connector (Epic 10)**

- **FR27:** The library SHALL provide `createCrosstownNode()` composition function that wires ConnectorNode + BLS + BootstrapService + RelayMonitor in-process
- **FR28:** The library SHALL provide `DirectRuntimeClient` and `DirectConnectorAdmin` for zero-latency in-process ILP communication
- **FR29:** The library SHALL retain `createHttpRuntimeClient()` as HTTP fallback for isolated deployments
- **FR30:** `@agent-runtime/connector` SHALL be an optional peer dependency (HTTP-only mode works without it)

**Agent Runtime (Epic 11)**

- **FR31:** The agent runtime SHALL subscribe to Nostr relays and route events by kind to LLM-powered handlers
- **FR32:** The agent runtime SHALL use Vercel AI SDK (v6) with `generateText()` + `Output.object()` for structured output with Zod validation
- **FR33:** The agent runtime SHALL support multi-model provider registry (Anthropic, OpenAI, Ollama) with per-kind model selection
- **FR34:** The agent runtime SHALL enforce per-kind action allowlists, rejecting unauthorized actions
- **FR35:** The agent runtime SHALL implement content isolation with datamarkers for untrusted event content before LLM processing
- **FR36:** The agent runtime SHALL provide per-pubkey, per-kind rate limiting and SQLite audit logging for all actions

**Integration (Epic 9)**

- **FR37:** The library SHALL integrate with agent-runtime via documented Admin API, BLS contract, and embedded connector patterns

**Cross-Town Communication Foundation (Epic 12)**

- **FR38:** The protocol SHALL support NIP-17 private DMs (three-layer encryption: rumor → seal → gift wrap) for cross-Town mail transport
- **FR39:** The protocol SHALL support NIP-46 remote signing daemons with scoped per-kind permissions for Polecat key isolation
- **FR40:** The protocol SHALL support NIP-40 expiration tags on ownership claims, DVM job requests, and session events for auto-cleanup
- **FR41:** The protocol SHALL support NIP-65 relay list metadata (kind:10002) for multi-relay redundancy
- **FR42:** Agents SHALL publish NIP-05 DNS-verifiable identities (kind:0 profiles) for human and machine discoverability
- **FR43:** The protocol SHALL support NIP-25 reactions as lightweight reputation signals feeding into trust scores
- **FR44:** The protocol SHALL support NIP-09 event deletion for retracting patches, reviews, and stale events
- **FR45:** The protocol SHALL support NIP-56 reports (kind:1984) as negative trust signals for bad actor flagging

**Paid Computation Marketplace (Epic 13)**

- **FR46:** The BLS SHALL process NIP-90 DVM job requests (kind:5xxx) with ILP payment gating: PREPARE locks funds, FULFILL releases on verified delivery
- **FR47:** Agents SHALL publish NIP-89 service discovery events (kind:31990) advertising DVM capabilities
- **FR48:** DVM job requests SHALL be rejected from non-peered pubkeys (peering gate: NIP-02 follow + SPSP handshake required)

**Trust Infrastructure & Reputation (Epic 14)**

- **FR49:** The protocol SHALL support ILP-backed zaps (kind:9734 request / kind:9735 receipt) with cryptographic proof-of-payment
- **FR50:** The protocol SHALL support NIP-32 labeling with namespaces for agent taxonomy (`agent-skill`, `agent-quality`) and code review (`crosstown.review`)
- **FR51:** The protocol SHALL support NIP-58 badge issuance (kind:30009 definitions, kind:8 awards) with auto-issuance via metric thresholds
- **FR52:** The protocol SHALL support NIP-85 trust oracle assertions (kind:30382) as pre-computed trust scores, with fallback to local BFS computation
- **FR53:** The protocol SHALL support NIP-51 lists for structured configuration: reviewer sets, CI provider sets, relay preferences, review queue bookmarks

**Decentralized Git Collaboration (Epic 15)**

- **FR54:** The NIP handler SHALL process NIP-34 events: kind:30617 (repo announcement), kind:1617 (patch), kind:1618 (PR), kind:1619 (PR update), kind:1630-1633 (status)
- **FR55:** Merges SHALL require trust-weighted multi-approval: `Σ trust(approving_towns) >= merge_threshold` with configurable threshold per repository
- **FR56:** The protocol SHALL support NIP-29 project groups (kind:39000) for per-repository coordination with trust-driven membership roles
- **FR57:** The protocol SHALL support NIP-77 negentropy for efficient delta sync after network partition (targeting 80-95% bandwidth reduction)
- **FR58:** The NIP-32 `crosstown.review` label namespace SHALL include: `approved`, `needs-work`, `tests-passing`, `tests-failing`, `security-concern`, `conflict-risk`, `blocked`

**Content & Community Layer (Epic 16)**

- **FR59:** The protocol SHALL support NIP-10 threading for multi-turn public discourse between agents
- **FR60:** The protocol SHALL support NIP-53 live activities (kind:30311) for merge session monitoring and agent work session visibility
- **FR61:** The protocol SHALL support NIP-23 long-form content with ILP payment gating (pricing via existing BLS PricingService)
- **FR62:** The protocol SHALL support NIP-72 communities with programmatic moderation approval hooks

**Cross-Town Federation & Agent Swarms (Epic 17)**

- **FR63:** The protocol SHALL support NIP-29 federation groups for Town-to-Town coordination with payment-gated membership
- **FR64:** Town membership in federation groups SHALL be gated by peering (NIP-02 + SPSP handshake) plus trust threshold
- **FR65:** The protocol SHALL support hierarchical ILP address allocation (`g.<town>.<rig>.<agent>`) for federated Towns
- **FR66:** The Wasteland protocol (DoltHub-based federation) SHALL be replaceable by Nostr events + ILP payment channels: town registry → NIP-02 + kind:10032, wanted work → NIP-90 DVM, completions → kind:30080, stamps → trust scores

## 2.2 Non-Functional Requirements

- **NFR1:** Peer discovery SHALL complete in under 5 seconds for typical follow list sizes (<500 follows)
- **NFR2:** SPSP handshake latency SHALL be under 2 seconds (excluding on-chain channel opening)
- **NFR3:** The library SHALL have minimal memory footprint suitable for resource-constrained agent environments
- **NFR4:** All unit tests SHALL use mocked SimplePool with no live relay dependencies
- **NFR5:** The library SHALL support Node.js 24.x and modern browsers via ESM
- **NFR6:** All code SHALL be written in TypeScript with strict mode enabled
- **NFR7:** Developer integration time for basic peer discovery SHALL be under 1 hour
- **NFR8:** The library SHALL achieve >80% peer discovery success rate for peers with published ILP info
- **NFR9:** SPSP handshake success rate SHALL exceed 95% when both parties are online
- **NFR10:** The library SHALL use nostr-tools as the sole Nostr library dependency
- **NFR11:** The BLS Docker image SHALL be under 150MB and pass health checks within 10 seconds of startup
- **NFR12:** Core, BLS, and relay packages SHALL achieve >80% line coverage for public APIs
- **NFR13:** The agent runtime SHALL support deterministic testing via `MockLanguageModelV3` without live LLM calls
- **NFR14:** Cross-Town message delivery latency SHALL be under 200ms via Nostr relay WebSocket (acceptable for all cross-Town operations; local Gas Town operations remain sub-millisecond)
- **NFR15:** Gas Town instances SHALL interact with Crosstown peers via standard NIP-01 WebSocket (relay subscription/publishing) and ILP BTP/HTTP (payment packets) — no custom bridge protocol required

---
