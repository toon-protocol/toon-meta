# Crosstown Protocol - Product Requirements Document (PRD)

## 1. Goals and Background Context

### 1.1 Goals

- Enable autonomous AI agents to discover ILP payment peers from their Nostr follow lists without manual configuration
- Provide SPSP parameter exchange over Nostr events with settlement negotiation, eliminating HTTPS/DNS/TLS dependencies
- Derive trust-based credit limits from social graph relationships (social distance, mutual followers, reputation)
- Deliver a reference implementation of ILP-gated Nostr relays with pay-to-write spam resistance
- Provide a standalone BLS Docker image for plug-and-play integration
- Implement layered peer discovery (genesis peers, ArDrive registry, NIP-02 social graph) for reliable network bootstrap
- Support embedded connector mode for zero-latency in-process ILP routing alongside HTTP mode
- Publish core packages to npm for downstream consumption
- Establish the protocol as the standard for Nostr+ILP integration with formal NIP submissions

### 1.2 Background Context

Traditional ILP infrastructure struggles with peer discovery (requires manual config or centralized registries), SPSP handshakes (heavyweight HTTPS dependencies), and trust bootstrapping (no data-driven basis for credit limits). For autonomous AI agents, these problems are acute—agents need to transact programmatically, discover counterparties dynamically, and make trust decisions without human intervention.

The convergence of Nostr's growth as decentralized identity infrastructure, rising interest in autonomous AI agents, ILP's maturity as a payment protocol, and the need for spam-resistant relay infrastructure creates the ideal moment for Crosstown Protocol. The core insight: **your Nostr follows become your ILP peers, and social distance informs financial trust.**

The project has evolved from initial peer discovery concepts to a comprehensive 4-package monorepo with Docker deployment, embedded connector integration, settlement negotiation, layered peer discovery, and production-ready npm packages (v1.1.1).

### 1.3 Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-05 | 0.1 | Initial PRD draft from Project Brief | PM |
| 2026-02-17 | 2.0 | Major update: Epics 5-11 added (BLS Docker, layered discovery, settlement negotiation, bootstrap, npm publishing, embedded connector, agent runtime). Epics 12-17 roadmap added. Updated FRs/NFRs, package structure (6 packages + Docker), three deployment modes, Node.js 24.x. Removed kind:10047 static SPSP. | PM |
| 2026-02-20 | 3.0 | Scope refocus: Removed unimplemented Epics 11-17 (agent runtime, computation marketplace, git collaboration). Updated to reflect actual implementation status (Epics 1-10 complete, 4 packages published at v1.1.1). Archived future vision documents. Crosstown is now production-ready as an ILP-gated Nostr relay protocol library. | PM |

---

## 2. Requirements

### 2.1 Functional Requirements

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

**Integration (Epic 9)**

- **FR31:** The library SHALL provide clear integration patterns for downstream consumers via documented APIs and examples

### 2.2 Non-Functional Requirements

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

---

## 3. Technical Assumptions

### 3.1 Repository Structure: Monorepo

The project uses a pnpm monorepo with four packages plus Docker deployment:
- `@crosstown/core` - Main protocol library (discovery, SPSP, trust, bootstrap, compose) - **Published v1.1.1**
- `@crosstown/bls` - Standalone Business Logic Server (payment verification, TOON, pricing, storage) - **Published v1.1.1**
- `@crosstown/relay` - ILP-gated Nostr relay reference implementation - **Published v1.1.1**
- `@crosstown/examples` - Integration examples (private, not published)
- `docker/` - Standalone Docker entrypoint for BLS deployment

**Rationale:** Monorepo simplifies dependency management between packages and enables atomic changes. The BLS was extracted (Epic 5) for independent Docker deployment.

### 3.2 Service Architecture

The project provides both a **library** and **deployable services**. Three integration modes are supported:

1. **Embedded Mode:** `createCrosstownNode()` wires ConnectorNode + BLS + Bootstrap + RelayMonitor in-process with zero-latency function calls
2. **HTTP Mode:** Library in agent process communicates with connector via Admin API (separate processes)
3. **Docker Mode:** Standalone container running BLS + relay + bootstrap as a service via `docker/src/entrypoint.ts`

**Rationale:** Embedded mode provides optimal performance for agents importing the library directly. HTTP mode supports isolated deployments. Docker mode enables plug-and-play integration with agent-runtime.

### 3.3 Testing Requirements

- **Unit Tests:** Required for all public APIs using Vitest with mocked SimplePool
- **Integration Tests:** Five-peer bootstrap test with mocked connectors (`vitest.integration.config.ts`)
- **E2E Tests:** Not in current scope

**Rationale:** Mocked tests ensure CI reliability without external dependencies. Integration tests validate multi-component bootstrap flows.

### 3.4 Additional Technical Assumptions

- Agents own their Nostr keypairs; the library does not manage keys
- NIP-44 encryption is stable and supported by nostr-tools
- agent-runtime Admin API remains stable for peer/route/channel management
- Nostr relays reliably serve replaceable events (kind:10032)
- TOON encoding via `@toon-format/toon` for ILP packet data
- pnpm workspaces for monorepo management
- tsup for library bundling (ESM output)
- `@crosstown/connector` is an optional peer dependency for embedded mode
- Static SPSP publishing (kind:10047) was removed — SPSP uses only encrypted request/response (kind:23194/23195) to protect shared secrets

---

## 4. Epic List

> **Canonical location for epic details:** [`docs/epics/`](epics/)
> Each epic has its own file: `epic-{n}-{title}.md`

| Epic | Title | Status | Goal |
|------|-------|--------|------|
| 1 | Foundation & Peer Discovery | ✅ Complete | Establish project infrastructure and deliver core peer discovery from NIP-02 follow lists |
| 2 | SPSP Over Nostr | ✅ Complete | Enable SPSP parameter exchange via Nostr events with NIP-44 encryption |
| 3 | Social Trust Engine | ✅ Complete | Compute trust scores from social graph data for credit limit derivation |
| 4 | ILP-Gated Relay | ✅ Complete | Reference implementation of pay-to-write Nostr relay with ILP integration |
| 5 | Standalone BLS Docker Image | ✅ Complete | Publishable BLS container with standard contract for integration |
| 6 | Decentralized Peer Discovery | ✅ Complete | Layered peer discovery combining genesis peers, ArDrive registry, and NIP-02 social graph |
| 7 | SPSP Settlement Negotiation | ✅ Complete | Extend SPSP to negotiate settlement chains and open payment channels via connector Admin API |
| 8 | Nostr Network Bootstrap | ✅ Complete | Complete bootstrap flow: relay discovery → 0-amount ILP SPSP → paid announcements → cross-peer discovery |
| 9 | npm Package Publishing | ✅ Complete | Publish @crosstown/core, @crosstown/bls, and @crosstown/relay as public npm packages (v1.1.1) |
| 10 | Embedded Connector Integration | ✅ Complete | Eliminate HTTP boundary by embedding ConnectorNode in-process; `createCrosstownNode()` composition |

**Note:** Epics 11-17 (agent runtime, computation marketplace, git collaboration, etc.) were planned but not implemented. These documents have been archived to `docs/archive/` for future reference.

---

## 5. Epic Details

### Epic 1: Foundation & Peer Discovery (Complete)

**Goal:** Establish the project structure, build tooling, and core infrastructure, then deliver the ability to discover ILP peers from a Nostr follow list.

**Stories:** 1.1 Project Setup · 1.2 Event Kind Constants and Types · 1.3 Event Parser and Builder Utilities · 1.4 NIP-02 Follow List Discovery · 1.5 ILP Peer Info Discovery · 1.6 Peer Update Subscriptions

**Key Deliverables:** TypeScript monorepo with Vitest, ESLint, Prettier. Event kinds 10032, 23194, 23195. `NostrPeerDiscovery` class with follow list and peer info discovery.

---

### Epic 2: SPSP Over Nostr (Complete)

**Goal:** Enable agents to exchange SPSP parameters over Nostr using encrypted request/response handshakes with NIP-44, eliminating HTTPS infrastructure.

**Stories:** 2.1 Static SPSP Info Query · 2.2 Static SPSP Info Publishing · 2.3 Dynamic SPSP Request (Client) · 2.4 Dynamic SPSP Request Handler (Server)

**Key Deliverables:** `NostrSpspClient` and `NostrSpspServer`. NIP-44 encrypted kind:23194/23195 handshakes with timeout handling.

**Note:** Static SPSP publishing (kind:10047) was subsequently removed as it exposed shared secrets in plaintext. Only the dynamic encrypted handshake (kind:23194/23195) is used.

---

### Epic 3: Social Trust Engine (Complete)

**Goal:** Provide trust score computation from social graph data, enabling agents to derive credit limits from social relationships.

**Stories:** 3.1 Social Distance Calculation · 3.2 Mutual Followers Count · 3.3 Configurable Trust Score Calculator · 3.4 Trust Score to Credit Limit Mapping

**Key Deliverables:** `SocialTrustManager` with BFS social distance, mutual followers, configurable weighted trust scores (0-1), credit limit mapping (linear/exponential curves).

---

### Epic 4: ILP-Gated Relay (Complete)

**Goal:** Reference implementation of a Nostr relay where writes require ILP payment via TOON-encoded events.

**Stories:** 4.1 Basic Nostr Relay (Read Path) · 4.2 Event Storage with SQLite · 4.3 TOON Encoding · 4.4 ILP Payment Verification (BLS) · 4.5 Configurable Pricing Service · 4.6 Self-Write Bypass · 4.7 Integration Example

**Key Deliverables:** NIP-01 WebSocket relay, SQLite event store, TOON encoder/decoder, `BusinessLogicServer`, `PricingService`, owner bypass.

---

### Epic 5: Standalone BLS Docker Image (Complete)

**Goal:** Extract BLS into a standalone package (`@crosstown/bls`) and publish a Docker image implementing the standard BLS contract for plug-and-play agent-runtime integration.

**Stories:** 5.1 Extract BLS Package · 5.2 Docker Image Build · 5.3 Environment Variable Configuration · 5.4 Volume-Based Storage · 5.5 Docker Hub Publishing · 5.6 Docker Compose Example · 5.7 Kubernetes Manifest Example · 5.8 BLS Contract Documentation

**Key Deliverables:** `@crosstown/bls` package. Docker image `di3twater/crosstown-bls`. BLS contract (`/health`, `/handle-packet`). Docker Compose and K8s examples.

---

### Epic 6: Decentralized Peer Discovery (Complete)

**Goal:** Replace ad-hoc bootstrap with layered peer discovery combining static known-peer list (genesis config + ArDrive) with dynamic NIP-02 social graph expansion.

**Stories:** 6.1 Genesis Peer Configuration · 6.2 ArDrive Peer Registry · 6.3 Bootstrap Service Redesign · 6.4 Social Graph Peer Discovery · 6.5 Docker Entrypoint Integration

**Key Deliverables:** `GenesisPeerLoader`, `ArDrivePeerRegistry`, `SocialPeerDiscovery`. Three-layer discovery: genesis → ArDrive → NIP-02. Connector admin API integration.

---

### Epic 7: SPSP Settlement Negotiation (Complete)

**Goal:** Extend SPSP handshake to negotiate settlement chains between peers and synchronously open payment channels via connector Admin API.

**Stories:** 7.1 Extend kind:10032 with Settlement · 7.2 Extend SPSP Request/Response · 7.3 Settlement Negotiation in Server · 7.4 0-Amount SPSP for Bootstrap · 7.5 Wire ConnectorChannelClient in Entrypoint · 7.6 Settlement in BLS /handle-packet · 7.7 Parse TOKEN_NETWORK Env Vars

**Key Deliverables:** Extended `IlpPeerInfo` with `supportedChains`, `settlementAddresses`, `preferredTokens`, `tokenNetworks`. Chain intersection negotiation. `ConnectorChannelClient` for payment channel operations. Configurable 0-amount SPSP acceptance.

---

### Epic 8: Nostr Network Bootstrap (Complete)

**Goal:** Complete bootstrap flow: free relay reads → 0-amount ILP SPSP → paid announcements → cross-peer discovery with payment channels.

**Stories:** 8.1 Rewrite Bootstrap Service · 8.2 Send SPSP as ILP Packets · 8.3 Paid Peer Announcements · 8.4 Reverse Registration (RelayMonitor) · 8.5 Docker Entrypoint/Compose Update · 8.6 Fix IlpSendResult Mismatch · 8.7 TOON + NIP-44 Round-Trip Test · 8.8 Fix Peer Registration Circular Dependency · 8.9 Bootstrap Cleanup

**Key Deliverables:** `BootstrapService` with 5-phase state machine. `IlpSpspClient` for ILP-routed SPSP. `RelayMonitor` for reverse peering. Five-peer bootstrap integration test.

---

### Epic 9: npm Package Publishing (Complete)

**Goal:** Publish `@crosstown/core`, `@crosstown/bls`, and `@crosstown/relay` as public npm packages.

**Stories:** 9.1 Publish Metadata · 9.2 Package READMEs · 9.3 Version Bump · 9.4 Resolve Workspace References · 9.5 Validate Package Contents · 9.6 Publish to npm

**Key Deliverables:** Three packages published to npm with proper metadata, version 1.x, TypeScript declarations, ESM output.

---

### Epic 10: Embedded Connector Integration (Complete)

**Goal:** Eliminate HTTP boundary between crosstown and agent-runtime by embedding ConnectorNode in-process with `createCrosstownNode()`.

**Stories:** 10.1 Rename handlePayment → handlePacket · 10.2 DirectRuntimeClient · 10.3 DirectConnectorAdmin + Public BLS · 10.4 createCrosstownNode() Composition · 10.5 HTTP Client Rename and Exports

**Key Deliverables:** `createCrosstownNode()` composition function. `DirectRuntimeClient`, `DirectConnectorAdmin`, `DirectChannelClient`. `createHttpRuntimeClient()` with backward-compat alias. `@agent-runtime/connector` as optional peer dependency.

---

### Epic 11: NIP Handler Agent Runtime (In Progress)

**Goal:** Create `packages/agent/` — autonomous TypeScript runtime using Vercel AI SDK (v6) that subscribes to Nostr relays, routes events by kind to LLM-powered handlers, and executes structured actions back to relays.

**Stories:** 11.1 Package Scaffolding + Provider Registry · 11.2 Kind Registry, Handler Loader, Zod Schemas · 11.3 Core Handler with Structured Output · 11.4 Security Defense Stack · 11.5 Action Executor · 11.6 Event Processing Loop + Integration

**Key Deliverables:** `createNipHandlerAgent()` public API. Kind registry with deterministic event routing. Zod-validated structured output via `generateText()` + `Output.object()`. Multi-model provider registry (Anthropic, OpenAI, Ollama). Security: content isolation, allowlists, rate limiting, audit logging. `ActionExecutor` publishing events via existing builders.

---

### Epics 12-17: NIP Adoption Roadmap (Planned)

See individual epic files in `docs/epics/` for full details.

| Epic | NIPs | Key Additions |
|------|------|---------------|
| 12 | NIP-05, NIP-25, NIP-65, NIP-09, NIP-56 | Agent profiles, reactions, relay lists, deletion, reporting |
| 13 | NIP-90, NIP-89 | DVM job handler, service discovery, job chaining |
| 14 | NIP-57, NIP-51 | ILP zaps with proof-of-payment, trust-weighted routing |
| 15 | NIP-32, NIP-58 | Agent capability labels, badge credentials |
| 16 | NIP-17, NIP-10, NIP-18, NIP-23, NIP-72 | Private DMs, threading, reposts, articles, communities |
| 17 | NIP-29 | Payment-gated agent swarms with hierarchical ILP addresses |

**Trust Score Evolution:**
```
Epics 1-4:   w1*socialDistance + w2*mutualFollowers + w3*reputationScore
Epic 12:     + w4*reactionScore + w5*reportPenalty
Epic 14:     + w6*zapVolume + w7*zapDiversity + w8*settlementReliability
Epic 15:     + w9*qualityLabelScore + w10*badgeScore
```

---

## 6. Checklist Results Report

_(To be completed after PRD review)_

---

## 7. Next Steps

### 7.1 Current State

- **Completed:** Epics 1-10 (Foundation, SPSP, Trust, Relay, BLS Docker, Peer Discovery, Settlement, Bootstrap, npm Publishing, Embedded Connector)
- **In Progress:** Epic 11 (NIP Handler Agent Runtime — `packages/agent/`)
- **Planned:** Epics 12-17 (NIP Adoption Roadmap)

### 7.2 Immediate Actions

1. Complete Epic 11: NIP Handler Agent Runtime (`packages/agent/`)
2. Begin Epic 12: Social Fabric Foundation (NIP-05, NIP-25, NIP-65, NIP-09, NIP-56)
3. Expand SocialTrustManager with reaction and report signals

### 7.3 Architect Prompt

> You are the Architect for the Crosstown Protocol project. Review the PRD at `docs/prd.md` and the architecture document at `docs/architecture.md`. Key considerations:
> - 6-package monorepo: `@crosstown/core`, `@crosstown/bls`, `@crosstown/relay`, `@crosstown/agent`, `@crosstown/examples`, `@crosstown/ui-prototypes`
> - Three integration modes: embedded (createCrosstownNode), HTTP (Admin API), Docker
> - Settlement negotiation during SPSP handshake (chain intersection, payment channels)
> - Layered discovery: genesis → ArDrive → NIP-02
> - Agent runtime with Vercel AI SDK v6 for LLM-powered event processing
> - NIP adoption roadmap (Epics 12-17)
>
> Review and update the architecture document to maintain alignment with the PRD.

---

_Generated with BMAD Method_
