---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - docs/prd/2-requirements.md
  - docs/architecture/toon-service-protocol.md
  - docs/architecture/5-components.md
  - docs/architecture/7-core-workflows.md
  - docs/architecture/12-coding-standards.md
  - docs/architecture/13-test-strategy-and-standards.md
  - docs/ILP-GATED-RELAY.md
  - packages/core/src/compose.ts
---

# TOON SDK - Epic Breakdown

## Overview

This document provides the epic and story breakdown for `@toon-protocol/sdk`, decomposing the requirements from the PRD, Architecture, and the TOON Service Protocol spec into implementable stories. The SDK is a TOON-native, ILP-gated service node framework with unified secp256k1 identity (Nostr + EVM). Developers build ILP-gated services by registering kind-based handlers that receive raw TOON for direct LLM consumption, with optional structured decode for code-based handlers.

> **Scope Note:** This document supersedes `docs/prd/` (v3.0, 2026-02-17) as the requirements baseline for the SDK phase. The old PRD's FR1-FR66 covered a broader scope (17 epics including agent runtime, Gas Town integration, NIP adoption roadmap) that no longer reflects the current project direction. The Requirements Inventory below defines the authoritative FR set for implementation.

## Requirements Inventory

### Functional Requirements

**TOON Codec Prerequisite (derived from Architecture Decision 1)**

- FR-SDK-0: The TOON encoder, decoder, and shallow parser SHALL be available in `@toon-protocol/core` to avoid circular dependencies and enable SDK, BLS, and relay packages to share a single codec location

**SDK Core (derived from TOON Service Protocol + existing FR27-FR30)**

- FR-SDK-1: The SDK SHALL provide a `createNode()` function that composes an embedded `ConnectorNode` with a handler registry, bootstrap service, and relay monitor into a single lifecycle-managed object
- FR-SDK-2: The SDK SHALL provide a handler registry with `.on(kind, handler)` and `.onDefault(handler)` methods for routing events by kind to developer-provided handler functions
- FR-SDK-3: The SDK SHALL provide TOON-native data handling: shallow TOON parse for routing metadata (kind, pubkey), raw TOON passthrough to handlers for direct LLM consumption, and optional lazy decode to structured objects for code-based handlers
- FR-SDK-4: The SDK SHALL verify Nostr event signatures (Schnorr) by default before invoking developer handlers, rejecting forged events with ILP error codes; verification is skippable in dev mode
- FR-SDK-5: The SDK SHALL provide configurable pricing validation (per-byte and per-kind) with self-write bypass for the node's own pubkey
- FR-SDK-6: The SDK SHALL bridge the handler registry to the connector's `PaymentHandler` interface, using `isTransit` to distinguish fire-and-forget (intermediate hop) from await (final hop) semantics
- FR-SDK-7: The SDK SHALL provide a `HandlerContext` object to handlers with `toon` (raw TOON string), `kind`, `pubkey`, `amount`, `destination`, `decode()` (lazy), `accept(data?)` and `reject(code, message)` methods
- FR-SDK-8: The SDK SHALL expose the embedded connector's direct method API for peer management (`registerPeer`, `removePeer`), packet sending (`sendPacket`), and channel operations (`openChannel`, `getChannelState`)
- FR-SDK-9: The SDK SHALL integrate with `BootstrapService` and `RelayMonitor` from `@toon-protocol/core` for peer discovery and network join
- FR-SDK-10: The SDK SHALL manage complete node lifecycle via `start()` and `stop()` methods (connector start, bootstrap, relay monitor start; graceful shutdown)
- FR-SDK-11: The SDK SHALL use `@toon-protocol/connector` in embedded mode (`deploymentMode: 'embedded'`) with `setPacketHandler()` for in-process packet delivery
- FR-SDK-12: The SDK SHALL support a dev mode that skips signature verification, bypasses pricing, and logs all incoming packets for local development
- FR-SDK-13: The SDK SHALL be published as `@toon-protocol/sdk` on npm with public access
- FR-SDK-NEW-1: The SDK SHALL provide unified identity from BIP-39 seed phrases: `generateMnemonic()`, `fromMnemonic(words, options?)`, and `fromSecretKey(key)` deriving both Nostr pubkey (x-only Schnorr) and EVM address (Keccak-256) from a single secp256k1 key via NIP-06 derivation path `m/44'/1237'/0'/0/{accountIndex}`

**Validation & Proof (derived from existing codebase)**

- FR-SDK-14: The current relay BLS logic in `docker/src/entrypoint.ts` SHALL be reimplementable using the SDK's handler registry, proving SDK completeness
- FR-SDK-15: All existing E2E tests SHALL pass when running against a relay built with the SDK

**Cleanup (derived from TOON Service Protocol)**

- FR-SDK-16: The `packages/git-proxy/` package SHALL be removed as it is superseded by the TOON Service Protocol pattern

**Relay Node Publishing (derived from Epic 2)**

- FR-RELAY-1: The SDK-based relay SHALL be published as `@toon-protocol/town` on npm with a `startTown(config)` function, CLI entrypoint, and Docker image

**Production Protocol Economics (derived from Party Mode Decisions 2026-03-05/06)**

- FR-PROD-1: The protocol SHALL use USDC as the sole user-facing payment token, replacing the AGENT development token. Payment channels, pricing, and all user flows SHALL be USDC-denominated
- FR-PROD-2: The protocol SHALL support multi-environment chain configuration: Anvil (local dev with mock USDC), Arbitrum Sepolia (staging with testnet USDC), and Arbitrum One (production with real USDC)
- FR-PROD-3: TOON nodes SHALL expose a `/publish` HTTP endpoint that accepts x402 payments (HTTP 402 negotiation with EIP-3009 gasless USDC authorization), constructs ILP PREPARE packets with TOON data payloads, and routes them through the ILP network to destination relays
- FR-PROD-4: Peer discovery SHALL use a seed relay list model (kind:10036 events on public Nostr relays) instead of requiring a genesis node. Any relay in the seed list can bootstrap a new peer into the network
- FR-PROD-5: TOON nodes SHALL publish kind:10035 (x402 Service Discovery) events advertising payment endpoint, pricing, and supported chains in a machine-readable format
- FR-PROD-6: The `/health` endpoint SHALL return enriched JSON including peer count, channel count, pricing information, and service capabilities for both human and agent consumption
- FR-PROD-7: The SPSP handshake (kind:23194/23195) SHALL be removed from the protocol. The peer discovery handshake phase SHALL be eliminated, with chain selection running locally against kind:10032 data and channels opened unilaterally
- FR-PROD-8: The Town node SHALL expose a relay subscription API allowing developers to subscribe to other Nostr relays for any event kind, enabling extensible peer discovery, seed relay lists, and custom event subscriptions

**Marlin TEE Deployment (derived from Party Mode Decisions 2026-03-05/06)**

- FR-TEE-1: The TOON Docker image SHALL be packaged for deployment on Marlin Oyster CVM with attestation server configuration and proxy endpoint mapping
- FR-TEE-2: TOON nodes running in Oyster CVM SHALL publish kind:10033 (TEE Attestation) events containing PCR values, enclave image hash, and attestation documents
- FR-TEE-3: The BootstrapService SHALL verify kind:10033 attestation events when discovering peers, preferring TEE-attested relays and validating PCR measurements against known-good image hashes
- FR-TEE-4: Enclave-resident nodes SHALL derive persistent Nostr identity keys from Nautilus KMS seeds, binding relay identity to TEE code integrity
- FR-TEE-5: Docker builds SHALL use Nix for reproducible builds producing deterministic PCR values across build environments
- FR-TEE-6: kind:10036 (Seed Relay List) bootstrap SHALL verify TEE attestation (kind:10033) as the trust anchor before trusting a seed relay's peer list

**DVM Compute Marketplace (derived from Party Mode 2020117 Analysis 2026-03-10)**

- FR-DVM-1: The protocol SHALL define DVM (Data Vending Machine) event kinds using NIP-90 compatible Nostr event kinds: Kind 5xxx for job requests, Kind 6xxx for job results, and Kind 7000 for job feedback, with full TOON encoding/decoding support
- FR-DVM-2: Initiated agents (those with open ILP payment channels) SHALL publish DVM job requests and results via ILP PREPARE packets as the preferred path, with x402 /publish (FR-PROD-3) available as a fallback for non-initiated agents
- FR-DVM-3: DVM compute settlement (customer paying provider for work performed) SHALL be routed through the ILP network using the provider's ILP address from their kind:10035 event, settling through existing EVM payment channels
- FR-DVM-4: kind:10035 Service Discovery events SHALL include a structured skill descriptor schema declaring supported DVM kinds, capabilities, input parameters, pricing, and feature lists to enable programmatic agent-to-agent service discovery

**Advanced DVM Coordination + TEE Integration (derived from Party Mode 2020117 Analysis 2026-03-10)**

- FR-DVM-5: The protocol SHALL support workflow chains — multi-step DVM pipelines where each step's Kind 6xxx result output automatically becomes the next step's Kind 5xxx request input
- FR-DVM-6: The protocol SHALL support agent swarms — competitive DVM job execution where multiple providers submit results and the customer selects the best submission for payment
- FR-DVM-7: DVM job results (Kind 6xxx) from TEE-attested nodes SHALL include a reference to the node's kind:10033 attestation event, providing cryptographic proof that the computation ran in a verified enclave
- FR-DVM-8: The protocol SHALL define a reputation scoring system combining ILP channel volume, Web of Trust declarations (Kind 30382), job completion statistics, and job reviews (Kind 31117) into a composite score visible in kind:10035 service discovery events

**ILP Address Hierarchy & Protocol Economics (derived from Party Mode 2026-03-20)**

- FR-ADDR-1: ILP addresses SHALL be deterministically derived from the peering topology using `${parentPrefix}.${childPubkey.slice(0, 8)}`, with the root prefix (`g.toon`) as a deployment constant
- FR-ADDR-2: The BTP handshake SHALL communicate the upstream peer's prefix so the connecting node can compute its own address deterministically
- FR-ADDR-3: Multi-peered nodes SHALL hold multiple ILP addresses (one per upstream peering) and advertise all addresses in kind:10032 events
- FR-ADDR-4: Each node SHALL advertise a `feePerByte` field in kind:10032 peer info events to enable route-aware fee calculation
- FR-ADDR-5: The SDK SHALL compute total cost internally as `destinationWriteFee + Σ(hop[i].feePerByte × packetBytes)`, making fee calculation invisible to `publishEvent()` callers
- FR-ADDR-6: A new Nostr event kind SHALL enable peers to claim human-readable vanity prefixes (e.g., `useast`, `btc`) from their upstream peer by paying for the prefix, creating an ILP address marketplace

**NIP-34 Git Forge — The Rig (derived from TOON Service Protocol + NIP-34)**

- FR-NIP34-1: The Rig SHALL be an SDK-based service node that receives NIP-34 git events (kinds 30617, 1617, 1618, 1619, 1621, 1622, 1630-1633) via ILP packets and executes git operations via TypeScript-native git HTTP backend
- FR-NIP34-2: The Rig SHALL use Nostr pubkeys as native identity for all git operations — no separate user database, no identity mapping layer; pubkeys ARE the usernames
- FR-NIP34-3: The Rig SHALL serve a read-only web UI (TypeScript port of Forgejo's code browsing/diff templates converted from Go HTML to EJS/Eta) with issues/PRs/comments sourced from Nostr events on the relay
- FR-NIP34-4: The Rig SHALL process NIP-34 status events (kinds 1630-1633) for PR lifecycle management with pubkey-based permission checks
- FR-NIP34-5: The Rig SHALL be a single-process TypeScript service deployable via `npx @toon-protocol/rig` with no Go, no Docker, and no external database dependencies
- FR-NIP34-6: The Rig SHALL be published as `@toon-protocol/rig` on npm with a `startRig(config)` function, CLI entrypoint, and Docker image

### NonFunctional Requirements

- NFR-SDK-1: The SDK SHALL be written in TypeScript with strict mode enabled, following existing coding standards (ESLint 9.x flat config, Prettier 3.x)
- NFR-SDK-2: The SDK SHALL support Node.js 24.x via ESM
- NFR-SDK-3: The SDK SHALL achieve >80% line coverage for public APIs
- NFR-SDK-4: Developer integration time for creating a basic custom service SHALL be under 30 minutes (10 lines of code for a minimal node)
- NFR-SDK-5: The SDK SHALL use structural typing for the `ConnectorNode` interface to keep `@toon-protocol/connector` as an optional peer dependency
- NFR-SDK-6: Unit tests SHALL use mocked connectors with no live relay or blockchain dependencies
- NFR-SDK-7: The SDK package size SHALL be minimal, depending only on `@toon-protocol/core` (includes TOON codec per FR-SDK-0), `nostr-tools`, `@scure/bip39`, `@scure/bip32`

### Additional Requirements

**From Architecture - Coding Standards:**

- Use PascalCase for classes, camelCase for functions, UPPER_SNAKE_CASE for constants
- Export all public APIs from package `index.ts`
- Use `nostr-tools` types (don't redefine Nostr event types)
- Pass TOON encoder/decoder as config callbacks (DI pattern)
- Never use `any` - use `unknown` and type guards

**From Architecture - Test Strategy:**

- Vitest as test framework
- Co-located `*.test.ts` files next to source
- Factory functions for test fixtures
- AAA pattern (Arrange, Act, Assert)

**From Architecture - TOON Service Protocol:**

- Service contract is `POST /handle-packet` with `HandlePacketRequest`/`HandlePacketResponse`
- These types already exist in `packages/core/src/compose.ts`
- The connector's `PaymentHandler` auto-computes fulfillment (SDK doesn't need to SHA-256)
- `isTransit` flag on `PaymentRequest` signals fire-and-forget vs await semantics
- Nostr pubkeys are universal identity (no service-specific auth)
- TOON is the AI-native wire format — handlers receive raw TOON for direct LLM consumption

**From Connector Package (@toon-protocol/connector@1.4.0):**

- `ConnectorNode` class with `setPacketHandler(handler: PaymentHandler)` for simplified handling
- `PaymentRequest` includes `isTransit`, `paymentId`, `destination`, `amount`, `data`
- `PaymentResponse` returns `{ accept: boolean, data?, rejectReason? }`
- Direct methods: `registerPeer()`, `removePeer()`, `openChannel()`, `getChannelState()`, `sendPacket()`
- `deploymentMode: 'embedded'` config option
- `ConnectorConfig` with `peers`, `routes`, `btpServerPort`, `settlementInfra` options

**From Identity Design (session-derived):**

- Both Nostr (BIP-340 Schnorr) and EVM (ECDSA) use secp256k1 — same private key works for both
- BIP-39 mnemonic → BIP-32 HD derivation → NIP-06 path `m/44'/1237'/0'/0/{index}`
- One keypair = Nostr pubkey + EVM address (deterministically linked)
- Agent portability: 12-word seed phrase recovers entire identity across both layers
- Multi-agent fleet: different account indices derive distinct agents from one seed

### FR Coverage Map

FR-SDK-0: Epic 1, Story 1.0 - TOON codec extraction to @toon-protocol/core
FR-SDK-1: Epic 1, Story 1.7 - createNode() composition function
FR-SDK-2: Epic 1, Story 1.2 - Handler registry (.on/.onDefault)
FR-SDK-3: Epic 1, Story 1.3 - TOON-native HandlerContext with passthrough + lazy decode
FR-SDK-4: Epic 1, Story 1.4 - Schnorr signature verification pipeline
FR-SDK-5: Epic 1, Story 1.5 - Pricing validation with self-write bypass
FR-SDK-6: Epic 1, Story 1.6 - PaymentHandler bridge with isTransit semantics
FR-SDK-7: Epic 1, Story 1.3 - HandlerContext accept()/reject() helpers
FR-SDK-8: Epic 1, Story 1.8 - Connector direct methods API
FR-SDK-9: Epic 1, Story 1.9 - BootstrapService + RelayMonitor integration
FR-SDK-10: Epic 1, Story 1.7 - Node lifecycle (start/stop)
FR-SDK-11: Epic 1, Story 1.7 - Embedded connector mode
FR-SDK-12: Epic 1, Story 1.10 - Dev mode
FR-SDK-13: Epic 1, Story 1.11 - npm publish as @toon-protocol/sdk
FR-SDK-NEW-1: Epic 1, Story 1.1 - Unified identity from seed phrase
FR-SDK-14: Epic 2, Story 2.1 - Relay reimplementation using SDK
FR-SDK-15: Epic 2, Story 2.3 - E2E test validation
FR-SDK-16: Epic 2, Story 2.4 - Remove packages/git-proxy
FR-RELAY-1: Epic 2, Story 2.5 - Publish @toon-protocol/town package
FR-PROD-1: Epic 3, Story 3.1 - USDC token migration
FR-PROD-2: Epic 3, Story 3.2 - Multi-environment chain configuration
FR-PROD-3: Epic 3, Story 3.3 - x402 /publish endpoint
FR-PROD-4: Epic 3, Story 3.4 - Seed relay discovery
FR-PROD-5: Epic 3, Story 3.5 - kind:10035 service discovery events
FR-PROD-6: Epic 3, Story 3.6 - Enriched /health endpoint
FR-PROD-7: Epic 2, Story 2.7 - SPSP removal and peer discovery cleanup
FR-PROD-8: Epic 2, Story 2.8 - Relay subscription API on TownInstance
FR-TEE-1: Epic 4, Story 4.1 - Oyster CVM packaging
FR-TEE-2: Epic 4, Story 4.2 - Attestation server and kind:10033 events
FR-TEE-3: Epic 4, Story 4.3 - Attestation-aware peering
FR-TEE-4: Epic 4, Story 4.4 - Nautilus KMS identity
FR-TEE-5: Epic 4, Story 4.5 - Nix reproducible builds
FR-TEE-6: Epic 4, Story 4.6 - Attestation-first seed relay bootstrap
FR-DVM-1: Epic 5, Story 5.1 - DVM event kind definitions (NIP-90 compatible, TOON-encoded)
FR-DVM-2: Epic 5, Story 5.2 - ILP-native job submission for initiated agents
FR-DVM-3: Epic 5, Story 5.3 - Job result delivery + ILP-routed compute settlement
FR-DVM-4: Epic 5, Story 5.4 - Skill descriptors in kind:10035 service discovery events
FR-DVM-5: Epic 6, Story 6.1 - Workflow chains (multi-step pipelines)
FR-DVM-6: Epic 6, Story 6.2 - Agent swarms (competitive bidding)
FR-DVM-7: Epic 6, Story 6.3 - TEE-attested DVM results
FR-DVM-8: Epic 6, Story 6.4 - Reputation scoring system
FR-ADDR-1: Epic 7, Story 7.1 - Deterministic address derivation from pubkey + parent prefix
FR-ADDR-2: Epic 7, Story 7.2 - BTP address assignment handshake
FR-ADDR-3: Epic 7, Story 7.3 - Multi-address support for multi-peered nodes
FR-ADDR-4: Epic 7, Story 7.4 - Fee-per-byte advertisement in kind:10032
FR-ADDR-5: Epic 7, Story 7.5 - SDK route-aware fee calculation (invisible to users)
FR-ADDR-6: Epic 7, Story 7.6 - Prefix claim kind and vanity prefix marketplace
FR-NIP34-1: Epic 8, Stories 8.1-8.4 - Git HTTP backend and NIP-34 handlers (split across repo, patch, issue/comment, HTTP backend)
FR-NIP34-2: Epic 8, Story 8.5 - Nostr pubkey-native git identity
FR-NIP34-3: Epic 8, Stories 8.7-8.10 - Read-only code browsing web UI (split across layout+repo list, tree+blob, commits+diff, blame)
FR-NIP34-4: Epic 8, Story 8.6 - PR lifecycle via NIP-34 status events
FR-NIP34-5: Epic 8, Story 8.11 - Issues/PRs from Nostr events on relay
FR-NIP34-6: Epic 8, Story 8.12 - Publish @toon-protocol/rig package

## Epic List

### Epic 1: ILP-Gated Service Node SDK

A developer can create a working ILP-gated service node from a 12-word seed phrase in ~10 lines of code. The SDK provides unified secp256k1 identity (Nostr + EVM), TOON-native kind-based event handling with raw TOON passthrough for LLM consumption and lazy decode for code handlers, configurable pricing validation, embedded connector lifecycle management, network discovery, and dev mode. Includes the TOON codec extraction prerequisite. Published as `@toon-protocol/sdk`.
**FRs covered:** FR-SDK-0, FR-SDK-1, FR-SDK-2, FR-SDK-3, FR-SDK-4, FR-SDK-5, FR-SDK-6, FR-SDK-7, FR-SDK-8, FR-SDK-9, FR-SDK-10, FR-SDK-11, FR-SDK-12, FR-SDK-13, FR-SDK-NEW-1

### Epic 2: Nostr Relay Reference Implementation, Protocol Stabilization & SDK Validation

The existing relay BLS is rebuilt using the SDK's handler registry, proving SDK completeness. Adds Nostr-specific handlers (event storage) as documented examples of code-based handlers that decode TOON to structured NostrEvent objects. Published as `@toon-protocol/town` so anyone can `npm install` and run their own relay to join the network. All existing E2E tests pass. Old experimental `packages/git-proxy/` removed. Additionally, the SPSP handshake is removed from the protocol and the peer discovery flow is simplified (discover → register → announce), ensuring the SDK ships with a clean, stable protocol surface. A relay subscription API on TownInstance replaces bespoke internal components like `RelayMonitor`.
**FRs covered:** FR-SDK-14, FR-SDK-15, FR-SDK-16, FR-RELAY-1, FR-PROD-7, FR-PROD-8
**Stories:** 8 (2.1-2.8)
**Scope change (2026-03-07):** Stories 3.7 (SPSP Removal) and 3.8 (Relay Subscription API) moved from Epic 3 into Epic 2. These stories modify the SDK's public surface (removing SPSP handler, simplifying bootstrap, replacing RelayMonitor) and should land before the SDK is considered stable. The dependency of Story 3.7 on Story 3.1 (USDC) was a sequencing artifact, not a technical dependency — SPSP removal is token-agnostic.

### Epic 3: Production Protocol Economics

Production-ready protocol economics — USDC payments, x402 HTTP payment on-ramp, multi-environment chain configuration, and decentralized peer discovery. Replaces the AGENT development token with USDC, adds Arbitrum One as production chain, enables x402 as an HTTP-native payment rail alongside ILP, and replaces the genesis hub-and-spoke topology with a seed relay list model. After this epic, TOON nodes can be deployed on any infrastructure with real USDC on Arbitrum, and the protocol works end-to-end without TEE.
**FRs covered:** FR-PROD-1, FR-PROD-2, FR-PROD-3, FR-PROD-4, FR-PROD-5, FR-PROD-6
**Stories:** 6
**Decision source:** [Party Mode Decision Log](research/marlin-party-mode-decisions-2026-03-05.md) — Decisions 1, 2, 6, 7, 8, 12, 13
**Scope change (2026-03-07):** Stories 3.7 and 3.8 moved to Epic 2 (see Epic 2 scope change note)

### Epic 4: Marlin TEE Deployment

From repository to one-command *service* deployment on Marlin Oyster — starting with the relay as reference implementation. Packages the TOON Docker image for Oyster CVM, adds TEE attestation (kind:10033), implements attestation-aware peering, integrates Nautilus KMS for persistent enclave-bound identity, and establishes Nix reproducible builds for deterministic PCR values. Phases 2 (attestation-aware peering) and 3 (x402 bridge was moved to Epic 3) are developed in parallel but ship as a combined external release.
**FRs covered:** FR-TEE-1, FR-TEE-2, FR-TEE-3, FR-TEE-4, FR-TEE-5, FR-TEE-6
**Stories:** TBD (to be decomposed when epic starts)
**Decision source:** [Party Mode Decision Log](research/marlin-party-mode-decisions-2026-03-05.md) — Decisions 3, 4, 5, 9, 10, 11
**Research source:** [Marlin Integration Technical Research](research/technical-marlin-integration-research-2026-03-05.md)

### Epic 5: DVM Compute Marketplace

NIP-90 compatible DVM (Data Vending Machine) compute marketplace on the TOON network. Agents post job requests (Kind 5xxx) and receive results (Kind 6xxx) through the existing ILP payment infrastructure. Initiated agents use ILP PREPARE packets as the preferred write path; non-initiated agents use x402 as an HTTP on-ramp. Compute settlement (paying the provider for work performed) routes through the ILP network, settling through EVM payment channels. Skill descriptors in kind:10035 events enable programmatic agent-to-agent service discovery. The DVM layer creates a two-tier access model: ILP-native for committed network participants, x402 for newcomers — with the marketplace providing the economic incentive to graduate from tier 2 to tier 1.
**FRs covered:** FR-DVM-1, FR-DVM-2, FR-DVM-3, FR-DVM-4
**Stories:** 4
**Decision source:** [Party Mode 2020117 Analysis](research/party-mode-2020117-analysis-2026-03-10.md)
**Inspiration:** [2020117](https://github.com/qingfeng/2020117) — Nostr-native agent network with NIP-90 DVM marketplace (Lightning payments, Cloudflare Workers)

### Epic 6: Advanced DVM Coordination + TEE Integration

Advanced DVM coordination patterns and TEE trust integration. Workflow chains enable multi-step compute pipelines where each step's output feeds into the next step's input automatically. Agent swarms enable competitive job execution where multiple providers bid and the best result wins. TEE-attested DVM results provide cryptographic proof that computation ran in a verified enclave. A reputation scoring system combines ILP channel volume, Web of Trust declarations, job completion stats, and reviews into a composite score for programmatic trust decisions.
**FRs covered:** FR-DVM-5, FR-DVM-6, FR-DVM-7, FR-DVM-8
**Stories:** 4
**Dependencies:** Epic 4 (TEE attestation for Story 6.3), Epic 5 (base DVM for all stories)
**Decision source:** [Party Mode 2020117 Analysis](research/party-mode-2020117-analysis-2026-03-10.md)

### Epic 7: ILP Address Hierarchy & Protocol Economics

Hierarchical ILP addressing with deterministic address derivation, multi-hop fee calculation, and a prefix marketplace. Replaces the current flat, publisher-assigned ILP addressing (`g.toon.genesis`, `g.toon.peer1`) with a hierarchical model where addresses are derived from the peering topology: each upstream peer assigns child addresses as `${parentPrefix}.${childPubkey.slice(0, 8)}`. The root prefix (`g.toon`) is a deployment constant owned by the genesis node. Multi-peered nodes receive multiple addresses (one per upstream peering). Fee calculation becomes invisible to SDK users — each node advertises `feePerByte` in kind:10032 events, and the SDK sums intermediary fees along the route path internally. A new Nostr kind enables peers to claim human-readable vanity prefixes (e.g., `g.toon.useast`, `g.toon.btc`) from their upstream by paying for the prefix, creating an ILP address marketplace.

**Key Design Decisions (Party Mode 2026-03-20):**
- Identity ≠ Address ≠ Route — Nostr pubkey is identity, ILP address is reachability (ephemeral, per-peering), routes are dynamic advertisements
- Addresses are deterministic: `${parentPrefix}.${peerPubkey.slice(0, 8)}` — zero configuration, cryptographically collision-resistant
- Root prefix (`g.toon`) is a protocol constant, not assigned — the genesis node IS `g.toon`
- Fee calculation is SDK-internal: `totalAmount = destinationWriteFee + Σ(hop[i].feePerByte × packetBytes)`
- Vanity prefix claims via new Nostr kind — peers pay upstream for human-readable prefixes, creating a domain-registrar business model

**Stories:** 6
**Decision source:** Party Mode 2026-03-20 — ILP Address Generation & Fee Calculation

### Epic 8: The Rig — ILP-Gated TypeScript Git Forge

A TypeScript-native git forge built on the SDK, proving the full production stack — SDK, USDC, x402, TEE, DVM — works end-to-end for a non-relay service. The Rig is a mechanical port of Forgejo's read-only code browsing UI (Go HTML templates → Eta templates) with a git HTTP backend (via `child_process` git binary). Issues, PRs, and comments are Nostr events stored on the relay — not a database. All write operations (repo creation, patches, issues) require ILP-gated NIP-34 events. Nostr pubkeys are the native identity — no user database, no identity mapping. Published as `@toon-protocol/rig` so operators can `npx @toon-protocol/rig` and add git collaboration to their node. No Go dependency, no Docker required. The Rig serves as the third SDK example and the first non-relay, non-DVM service on the emergent compute substrate, validating the platform generality thesis.
**FRs covered:** FR-NIP34-1, FR-NIP34-2, FR-NIP34-3, FR-NIP34-4, FR-NIP34-5, FR-NIP34-6
**Stories:** 12 (decomposed for proper sizing)
**Reference:** [forgejo](https://codeberg.org/forgejo/forgejo) (Go, GPL-3.0) — source for mechanical template port
**Validates:** Epics 1 (SDK), 2 (relay), 3 (USDC/x402), 4 (TEE), 5 (DVM), 6 (Advanced DVM), 7 (ILP Addressing) — the Rig exercises the complete stack

---

## Epic 1: ILP-Gated Service Node SDK

A developer can create a working ILP-gated service node from a 12-word seed phrase in ~10 lines of code. The SDK provides unified secp256k1 identity (Nostr + EVM), TOON-native kind-based event handling with raw TOON passthrough for LLM consumption and lazy decode for code handlers, configurable pricing validation, embedded connector lifecycle management, network discovery, and dev mode.

### Story 1.0: Extract TOON Codec to @toon-protocol/core

As a **SDK developer**,
I want the TOON encoder, decoder, and shallow parser to live in `@toon-protocol/core`,
So that the SDK can access TOON functionality without depending on `@toon-protocol/bls` or `@toon-protocol/relay`, avoiding circular dependencies.

**Dependencies:** None (prerequisite for all other Epic 1 stories)

**Acceptance Criteria:**

**Given** the TOON encoder and decoder currently in `@toon-protocol/bls`
**When** I move them to `packages/core/src/toon/`
**Then** `packages/core/src/toon/encoder.ts` contains the Nostr event → TOON bytes encoder
**And** `packages/core/src/toon/decoder.ts` contains the TOON bytes → Nostr event decoder
**And** `packages/core/src/toon/index.ts` re-exports encoder, decoder, and shallow-parse

**Given** the need for routing metadata extraction without full decode
**When** I create `packages/core/src/toon/shallow-parse.ts`
**Then** it exports a `shallowParseToon(data: Uint8Array): ToonRoutingMeta` function
**And** `ToonRoutingMeta` contains `{ kind: number, pubkey: string, id: string, sig: string, rawBytes: Uint8Array }`
**And** the shallow parser extracts only these fields without performing a full TOON decode

**Given** `@toon-protocol/bls` currently imports TOON codec locally
**When** I update its imports to use `@toon-protocol/core`
**Then** all existing BLS tests pass with the updated import paths
**And** the BLS package no longer contains its own copy of the codec

**Given** `@toon-protocol/relay` may reference the TOON codec
**When** I update any relay imports to use `@toon-protocol/core`
**Then** all existing relay tests pass with the updated import paths

**Given** all import paths are updated
**When** I run the full test suite (`pnpm -r test`)
**Then** all existing tests pass with zero regressions

---

### Story 1.1: Unified Identity from Seed Phrase

As a **service developer**,
I want to generate or restore my node's complete identity from a 12-word seed phrase,
So that I have one keypair for Nostr event signing and EVM settlement with deterministic recovery.

**Dependencies:** None

**Acceptance Criteria:**

**Given** no existing identity
**When** I call `generateMnemonic()`
**Then** a valid 12-word BIP-39 mnemonic is returned
**And** calling `fromMnemonic(words)` returns `{ secretKey, pubkey, evmAddress }`

**Given** an existing 12 or 24-word mnemonic
**When** I call `fromMnemonic(words)`
**Then** the returned `secretKey` is the BIP-32 derived key at NIP-06 path `m/44'/1237'/0'/0/0`
**And** the returned `pubkey` is the x-only Schnorr public key (32 bytes hex)
**And** the returned `evmAddress` is the Keccak-256 derived `0x` address from the same key

**Given** an existing 32-byte secret key
**When** I call `fromSecretKey(key)`
**Then** the returned `pubkey` and `evmAddress` are correctly derived from that key

**Given** an `accountIndex` parameter
**When** I call `fromMnemonic(words, { accountIndex: 3 })`
**Then** the derivation path is `m/44'/1237'/0'/0/3`
**And** a distinct keypair is returned for each index

### Story 1.2: Handler Registry with Kind-Based Routing

As a **service developer**,
I want to register event handlers by Nostr event kind using `.on(kind, handler)` and `.onDefault(handler)`,
So that incoming ILP packets are routed to my domain logic based on event type.

**Dependencies:** None

**Acceptance Criteria:**

**Given** a handler registry
**When** I call `.on(30617, myRepoHandler)`
**Then** incoming events with `kind: 30617` are dispatched to `myRepoHandler`

**Given** multiple kind registrations
**When** events of different kinds arrive
**Then** each event is dispatched to its registered handler only

**Given** a registered default handler via `.onDefault(handler)`
**When** an event arrives with a kind that has no specific handler
**Then** the default handler is invoked

**Given** no default handler and no matching kind handler
**When** an event arrives
**Then** the SDK automatically rejects with ILP error code `F00` (bad request)

**Given** a kind with an already registered handler
**When** I call `.on(kind, newHandler)` again
**Then** the previous handler is replaced

**Test Approach:** Unit tests covering kind match dispatch, default fallback invocation, F00 rejection when no handler matches, and handler replacement on duplicate `.on()` calls. Use mocked handlers to verify dispatch correctness.

### Story 1.3: HandlerContext with TOON Passthrough and Lazy Decode

As a **service developer**,
I want my handler to receive a `HandlerContext` with raw TOON data for direct LLM consumption and optional structured decode,
So that LLM-based handlers avoid decode overhead and code-based handlers can access typed objects.

**Dependencies:** Story 1.0 (uses ToonRoutingMeta for shallow parse metadata)

**Acceptance Criteria:**

**Given** an incoming ILP packet with base64-encoded TOON data
**When** my handler is invoked
**Then** `ctx.toon` contains the raw TOON string (no decode performed)
**And** `ctx.kind` contains the event kind (extracted via shallow TOON parse)
**And** `ctx.pubkey` contains the sender's public key (extracted via shallow TOON parse)
**And** `ctx.amount` contains the ILP payment amount as bigint
**And** `ctx.destination` contains the ILP destination address

**Given** a handler that needs structured data
**When** I call `ctx.decode()`
**Then** the full TOON to NostrEvent decode is performed and the typed object is returned
**And** subsequent calls to `ctx.decode()` return the cached result (no re-decode)

**Given** a handler that accepts the event
**When** I call `ctx.accept(data?)`
**Then** a correctly formatted `HandlePacketAcceptResponse` is produced with optional response data

**Given** a handler that rejects the event
**When** I call `ctx.reject(code, message)`
**Then** a correctly formatted `HandlePacketRejectResponse` is produced with the ILP error code

**Test Approach:** Unit tests covering raw TOON passthrough (no decode on access), lazy decode with caching (second call returns same object), accept/reject response format correctness. Verify shallow parse extracts kind/pubkey without full decode.

### Story 1.4: Schnorr Signature Verification Pipeline

As a **service developer**,
I want all incoming events to have their Schnorr signatures verified before my handler is invoked,
So that I can trust event authorship without implementing verification myself.

**Dependencies:** Story 1.0 (uses ToonRoutingMeta for id, pubkey, sig, rawBytes)

**Acceptance Criteria:**

**Given** an incoming ILP packet with a valid TOON-encoded Nostr event
**When** the Schnorr signature on the event is valid
**Then** the event is dispatched to the appropriate handler

**Given** an incoming ILP packet with an invalid signature
**When** signature verification fails
**Then** the SDK rejects with ILP error code `F06` (unexpected payment)
**And** the handler is never invoked

**Given** the SDK is configured with `devMode: true`
**When** an event with an invalid or missing signature arrives
**Then** signature verification is skipped
**And** the event is dispatched to the handler normally
**And** a debug log is emitted noting the skipped verification

**Given** the shallow TOON parse extracts `id`, `pubkey`, and `sig`
**When** verification runs
**Then** only these fields plus the serialized event bytes are needed (no full content decode required)

**Test Approach:** Unit tests covering valid signature passthrough, invalid signature → F06 rejection (handler never invoked), and devMode skip (invalid sig accepted with debug log). Use real Schnorr test vectors from nostr-tools.

### Story 1.5: Pricing Validation with Self-Write Bypass

As a **service developer**,
I want the SDK to validate ILP payment amounts against configurable pricing before my handler is invoked,
So that underpaid events are automatically rejected and my own node's events are free.

**Dependencies:** Story 1.0 (uses TOON byte length for per-byte pricing)

**Acceptance Criteria:**

**Given** a configured `basePricePerByte` (default: `10n`)
**When** an event arrives with `amount < toonBytes.length * basePricePerByte`
**Then** the SDK rejects with ILP error code `F04` (insufficient amount)
**And** the rejection metadata includes `required` and `received` amounts

**Given** a `kindPricing` map with overrides (e.g., `{ 23194: 0n }`)
**When** an event of that kind arrives
**Then** the kind-specific price is used instead of per-byte calculation

**Given** an event where `ctx.pubkey` matches the node's own pubkey
**When** pricing validation runs
**Then** the event bypasses pricing (self-write is free)
**And** the handler is invoked normally

**Given** no pricing configuration
**When** `createNode()` is called
**Then** the default `basePricePerByte: 10n` is applied

**Test Approach:** Unit — per-byte calc, per-kind override, self-write bypass, F04 rejection.

### Story 1.6: PaymentHandler Bridge with Transit Semantics

As a **service developer**,
I want the SDK to bridge my handler registry to the connector's `PaymentHandler` interface,
So that the embedded connector delivers ILP packets to my handlers with correct fire-and-forget vs await behavior.

**Dependencies:** Story 1.2 (handler registry for dispatch)

**Acceptance Criteria:**

**Given** the connector receives an ILP packet where `isTransit` is `true` (intermediate hop)
**When** the packet is delivered to the SDK's PaymentHandler bridge
**Then** the handler is invoked fire-and-forget (non-blocking)
**And** the connector continues forwarding immediately without waiting for handler response

**Given** the connector receives an ILP packet where `isTransit` is `false` (final hop)
**When** the packet is delivered to the SDK's PaymentHandler bridge
**Then** the handler is invoked and the response is awaited
**And** the handler's `accept()`/`reject()` result flows back as the ILP fulfill/reject

**Given** a handler throws an unhandled exception
**When** the PaymentHandler bridge catches it
**Then** an ILP `T00` (internal error) reject response is returned
**And** the error is logged

**Test Approach:** Unit — isTransit fire-and-forget, !isTransit await, exception → T00.

### Story 1.7: createNode() Composition with Embedded Connector Lifecycle

As a **service developer**,
I want to call `createNode(config)` and get a fully wired node with `start()` and `stop()` lifecycle methods,
So that I don't manually wire connector, handlers, verification, pricing, and bootstrap together.

**Dependencies:** Stories 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 1.9 (composition of all pipeline stages)

**Acceptance Criteria:**

**Given** a valid `NodeConfig` with `secretKey`, `connector`, and at least one handler
**When** I call `createNode(config)`
**Then** a `ServiceNode` is returned with the handler registry wired to the connector's PacketHandler via the PaymentHandler bridge
**And** the verification and pricing pipelines are inserted before handler dispatch
**And** `node.pubkey` returns the Nostr x-only public key
**And** `node.evmAddress` returns the derived EVM address

**Given** a created node
**When** I call `node.start()`
**Then** the connector's `setPacketHandler()` is called with the SDK's bridge
**And** bootstrap runs (peer discovery, registration, handshakes)
**And** the relay monitor starts watching for new peers
**And** a `StartResult` is returned with `{ peerCount, channelCount, bootstrapResults }`

**Given** a started node
**When** I call `node.stop()`
**Then** the relay monitor subscription is unsubscribed
**And** lifecycle state is cleaned up
**And** calling `stop()` again is a no-op

**Given** `node.start()` is called twice without stopping
**When** the second `start()` executes
**Then** it throws a `NodeError` with message indicating already started

**Test Approach:** Integration — full pipeline: TOON → parse → verify → price → dispatch → accept/reject.

### Story 1.8: Connector Direct Methods API

As a **service developer**,
I want to access the embedded connector's peer management and channel operations through the node,
So that I can programmatically manage peers and payment channels for advanced use cases.

**Dependencies:** None

**Acceptance Criteria:**

**Given** a created node with a connector that supports channel operations
**When** I access `node.connector`
**Then** I can call `registerPeer()`, `removePeer()`, `sendPacket()`
**And** I can call `openChannel()`, `getChannelState()` for payment channel management

**Given** a connector without channel support (older version)
**When** I access `node.channelClient`
**Then** it returns `null`

**Given** a registered peer
**When** I call `node.connector.sendPacket({ destination, amount, data })`
**Then** the ILP packet is sent through the connector to the specified destination

### Story 1.9: Network Discovery and Bootstrap Integration

As a **service developer**,
I want my node to automatically discover peers, join the network, and monitor for new peers,
So that my service participates in the TOON mesh without manual peer configuration.

**Dependencies:** None (uses existing @toon-protocol/core BootstrapService and RelayMonitor)

**Acceptance Criteria:**

**Given** a node config with `knownPeers` and/or `ardriveEnabled: true`
**When** `node.start()` is called
**Then** `BootstrapService` runs layered discovery (genesis peers, ArDrive, env var peers)
**And** discovered peers are registered with the connector

**Given** a started node
**When** a new kind:10032 (ILP Peer Info) event appears on the monitored relay
**Then** the `RelayMonitor` detects it and initiates peering with the new peer

**Given** a node config with settlement configuration
**When** bootstrap registers peers
**Then** payment channels are opened unilaterally using settlement info from the peer's kind:10032 event
**And** `StartResult.channelCount` reflects opened channels

**Given** a started node
**When** I call `node.peerWith(pubkey)`
**Then** the node initiates peering with the specified pubkey (register + channel opening using kind:10032 info)

**Given** bootstrap or relay monitor events
**When** I call `node.on('bootstrap', listener)` before `start()`
**Then** I receive lifecycle events (phase changes, peer registered, channel opened, etc.)

> _Note: SPSP handshake (kind:23194/23195) was originally part of this flow but is removed in Story 2.7. Settlement negotiation runs locally using kind:10032 data; BTP claims are self-describing with on-chain verification._

### Story 1.10: Dev Mode

As a **service developer**,
I want a dev mode that skips signature verification, relaxes pricing, and logs all packets,
So that I can iterate locally without running a full network or blockchain.

**Dependencies:** Stories 1.4, 1.5 (verification and pricing pipelines to bypass)

**Acceptance Criteria:**

**Given** `createNode({ devMode: true, ... })`
**When** an event arrives with an invalid or missing signature
**Then** verification is skipped and the handler is invoked

**Given** dev mode is enabled
**When** any event arrives
**Then** the full packet details are logged (kind, pubkey, amount, destination, TOON preview)

**Given** dev mode is enabled
**When** pricing validation runs
**Then** all amounts are accepted (pricing bypass)

**Given** dev mode is NOT enabled (production)
**When** an event fails verification or pricing
**Then** it is rejected normally with no bypass

### Story 1.11: Package Setup and npm Publish

As a **service developer**,
I want to `npm install @toon-protocol/sdk` and import a clean public API,
So that I can start building immediately with TypeScript types and documentation.

**Dependencies:** Stories 1.0-1.10 (all SDK code must be complete before publish)

**Acceptance Criteria:**

**Given** the `@toon-protocol/sdk` package
**When** I inspect `package.json`
**Then** it has `"type": "module"`, TypeScript strict mode, ESLint 9.x flat config, Prettier 3.x
**And** peer dependency on `@toon-protocol/connector` (optional)
**And** dependencies on `@toon-protocol/core`, `@toon-protocol/relay` (for TOON codec), `nostr-tools`, `@scure/bip39`, `@scure/bip32`

**Given** the package entry point `index.ts`
**When** I import from `@toon-protocol/sdk`
**Then** all public APIs are exported: `createNode`, `fromMnemonic`, `fromSecretKey`, `generateMnemonic`, `HandlerContext`, `NodeConfig`, `ServiceNode`, type definitions

**Given** the package is built
**When** published to npm with `--access public`
**Then** it is available as `@toon-protocol/sdk` with correct ESM exports and TypeScript declarations

---

## Epic 2: Nostr Relay Reference Implementation, Protocol Stabilization & SDK Validation

The existing relay BLS is rebuilt using the SDK's handler registry, proving SDK completeness. Adds Nostr-specific handlers (event storage) as documented examples of code-based handlers that decode TOON to structured NostrEvent objects. Serves as the reference implementation for other developers building their own services. All existing E2E tests pass. Published as `@toon-protocol/town` so anyone can `npm install` and run their own relay to join the network. Old experimental `packages/git-proxy/` removed. The SPSP handshake is removed from the protocol and peer discovery is simplified, ensuring the SDK ships clean. A relay subscription API on TownInstance provides a general-purpose mechanism for subscribing to remote relays.

### Story 2.1: Relay Event Storage Handler

As a **relay operator**,
I want the relay BLS reimplemented as an SDK handler that stores Nostr events,
So that the existing relay functionality works on the SDK and serves as a reference for code-based handlers.

**Dependencies:** Epic 1 (SDK must be complete)

**Acceptance Criteria:**

**Given** a `createNode()` instance with a handler registered for general event kinds
**When** a paid ILP packet arrives with a TOON-encoded Nostr event
**Then** the handler calls `ctx.decode()` to get the structured NostrEvent
**And** stores the event in the EventStore (SQLite)
**And** calls `ctx.accept()` with event metadata

**Given** the handler receives an event
**When** `ctx.decode()` returns a valid NostrEvent
**Then** the event is stored with its original TOON encoding (TOON-native storage)

**Given** the relay node is configured with the node's own pubkey
**When** an event from the node's own pubkey arrives
**Then** pricing is bypassed by the SDK (self-write) and the event is stored

### Story 2.2: SPSP Handshake Handler _(DEPRECATED — removed in Story 2.7)_

> **Deprecation Notice:** This story was implemented as part of Epic 2 but the SPSP handshake (kind:23194/23195) is removed from the protocol in Story 2.7. The handshake is unnecessary because: (1) kind:10032 already publishes all settlement info publicly, (2) no STREAM protocol is used (TOON-over-ILP directly), (3) BTP claims can be made self-describing with chainId/tokenNetworkAddress/tokenAddress, and (4) connectors can verify payment channels on-chain dynamically. The `createSpspHandshakeHandler()` in `@toon-protocol/town` and all SPSP code in `@toon-protocol/core` are removed in Story 2.7.

As a **relay operator**,
I want SPSP request handling (kind:23194) reimplemented as an SDK handler,
So that settlement negotiation and peer registration work through the SDK's kind-based routing.

**Dependencies:** Epic 1 (SDK must be complete)

**Acceptance Criteria:**

**Given** a handler registered for kind `23194` (SPSP Request)
**When** an SPSP request arrives as a paid ILP packet
**Then** the handler calls `ctx.decode()` to get the Nostr event
**And** parses the NIP-44 encrypted SPSP request
**And** generates fresh SPSP parameters (destination account, shared secret)
**And** negotiates settlement chains if both parties have settlement config
**And** opens payment channels via the connector's channel client when chains intersect
**And** builds an NIP-44 encrypted SPSP response event
**And** calls `ctx.accept()` with the TOON-encoded response as fulfillment data

**Given** settlement negotiation fails
**When** the SPSP handler catches the error
**Then** it gracefully degrades to a basic SPSP response (no settlement fields)
**And** logs a warning

**Given** a successful SPSP handshake
**When** the handler has the peer's ILP address and BTP endpoint
**Then** the peer is registered with the connector via `node.connector.registerPeer()`

### Story 2.3: E2E Test Validation

As a **SDK developer**,
I want all existing E2E tests to pass when running against the SDK-based relay,
So that the SDK is proven to be a complete replacement for the manual wiring.

**Dependencies:** Stories 2.1, 2.2 (relay handlers must be implemented)

**Acceptance Criteria:**

**Given** the SDK-based relay is deployed as the genesis node
**When** the existing E2E test suite runs (`pnpm test:e2e`)
**Then** all tests pass including bootstrap, payment channel creation, and event publishing

**Given** the SDK-based relay entrypoint
**When** compared to the original `docker/src/entrypoint.ts`
**Then** the handler registrations are significantly shorter than the original ~300 lines in `entrypoint.ts`

> _Note: Target is <100 lines of handler logic, reflecting the SDK's abstraction value._

**Given** the test `genesis-bootstrap-with-channels.test.ts`
**When** it runs against the SDK-based relay
**Then** bootstrap with payment channel creation succeeds
**And** signed balance proofs are generated
**And** event publishing with ILP payment works
**And** on-chain channel state is validated

### Story 2.4: Remove packages/git-proxy and Document Reference Implementation

As a **SDK developer**,
I want the obsolete `packages/git-proxy/` removed and the SDK-based relay documented as the reference implementation,
So that the codebase is clean and developers have a clear example to follow.

**Dependencies:** None (independent cleanup, can be done in parallel)

**Acceptance Criteria:**

**Given** `packages/git-proxy/` exists in the monorepo
**When** this story is completed
**Then** the package is removed from the filesystem and `pnpm-workspace.yaml`
**And** no other package depends on it

**Given** the SDK-based relay entrypoint
**When** a developer reads the example
**Then** it demonstrates: seed phrase identity, kind-based handler registration, `ctx.decode()` for code handlers, settlement configuration, and lifecycle management
**And** inline comments explain each SDK pattern

**Given** the example code
**When** reviewed against the SDK's public API
**Then** every major SDK feature is exercised (identity, handlers, pricing, bootstrap, channels, dev mode)

### Story 2.5: Publish @toon-protocol/town Package

As a **network operator**,
I want to `npm install @toon-protocol/town` and deploy a relay with minimal configuration,
So that I can join the TOON network by running a single command with my seed phrase.

**Dependencies:** Stories 2.1, 2.3 (relay handler and E2E validation must pass)

**Acceptance Criteria:**

**Given** the `@toon-protocol/town` package
**When** I inspect `package.json`
**Then** it depends on `@toon-protocol/sdk`, `@toon-protocol/relay` (for EventStore + TOON codec), and `@toon-protocol/core`
**And** it has `"type": "module"` with TypeScript strict mode

**Given** the package entry point
**When** I import from `@toon-protocol/town`
**Then** it exports a `startTown(config)` function and a `TownConfig` type
**And** config accepts: `mnemonic` (or `secretKey`), `relayPort`, `blsPort`, `knownPeers`, `settlementConfig`, and optional overrides

**Given** a minimal configuration with just a mnemonic
**When** I call `startTown({ mnemonic: '...' })`
**Then** a relay node starts with sensible defaults (ports 7100/3100, default pricing, ArDrive discovery enabled)
**And** bootstrap runs, peers are discovered, and the relay is accepting events

**Given** the package includes a CLI entrypoint
**When** I run `npx @toon-protocol/town --mnemonic "..."` (or `--secret-key`)
**Then** a relay node starts with environment variable and CLI flag configuration
**And** Docker image is also published for container deployments

**Given** the package is built
**When** published to npm with `--access public`
**Then** it is available as `@toon-protocol/town` with correct ESM exports and TypeScript declarations

### Story 2.7: SPSP Removal and Peer Discovery Cleanup

> **Moved from Epic 3 (was Story 3.7) on 2026-03-07.** The SPSP removal modifies the SDK's public surface and bootstrap flow — it belongs in Epic 2 to ensure the SDK ships with a clean, stable protocol. The original dependency on Story 3.1 (USDC) was a sequencing artifact; SPSP removal is token-agnostic.

As a **protocol developer**,
I want the SPSP handshake removed from the protocol and the peer discovery flow simplified,
So that peers can transact immediately after discovery without a negotiation round-trip.

**Dependencies:** Stories 2.1, 2.3 (relay handlers and E2E validation must pass first). Connector must support self-describing BTP claims (see below).

**Background:**

The SPSP handshake (kind:23194/23195) exists to negotiate settlement details between peers before they can exchange ILP packets. However, every piece of information SPSP negotiates is already published in kind:10032 (ILP Peer Info):

- `destinationAccount` (ILP address) → kind:10032 `ilpAddress`
- `sharedSecret` → Not needed (no STREAM protocol; TOON-over-ILP directly)
- `negotiatedChain` → Deterministic from kind:10032 `supportedChains` intersection
- `settlementAddress` → kind:10032 `settlementAddresses`
- `tokenAddress` → kind:10032 `preferredTokens`
- `tokenNetworkAddress` → kind:10032 `tokenNetworks`
- `channelId` → Opened unilaterally by sender

Since TOON uses TOON-over-ILP (not STREAM), there is no shared secret to negotiate. The sender reads the peer's kind:10032 from the relay, selects the best matching chain locally, and opens a channel unilaterally. The connector handles BTP claim signing and verification independently (see connector handoff doc).

**Acceptance Criteria:**

**Given** the peer discovery flow currently with phases: discovering → registering → handshaking → announcing
**When** this story is completed
**Then** the handshaking phase is removed
**And** phases are: discovering → registering → announcing
**And** channel opening happens during the registration phase using kind:10032 settlement data
**And** chain selection runs locally against the peer's kind:10032 `supportedChains` (set intersection + token preference)

**Given** `addPeerToConnector()` in `BootstrapService` currently passes only `id`, `url`, and `routes` to the connector
**When** this story is completed
**Then** `addPeerToConnector()` populates the `settlement` field in `ConnectorAdminClient.addPeer()` with the chain-selected data from the peer's kind:10032: `chainId`, `tokenNetworkAddress`, `tokenAddress`, `evmAddress` (peer's settlement address), and `channelId` (from unilateral channel opening)
**And** this settlement info enables the connector to build self-describing BTP claims with `chainId`, `tokenNetworkAddress`, and `tokenAddress` fields

**Given** `node.peerWith(pubkey)` currently performs connector registration + SPSP handshake
**When** this story is completed
**Then** `peerWith()` performs: read peer's kind:10032 from relay → select chain locally → register with connector (including settlement info) → open channel unilaterally → done
**And** no kind:23194/23195 events are created or processed

**Given** the SPSP code in `@toon-protocol/core` and `@toon-protocol/town`
**When** this story is completed
**Then** `NostrSpspServer`, `NostrSpspClient`, SPSP event builders/parsers are removed from `@toon-protocol/core`
**And** `createSpspHandshakeHandler()` is removed from `@toon-protocol/town`
**And** Event kinds 23194 and 23195 are no longer used by the protocol
**And** The SDK stub `spsp-handshake-handler.ts` is removed from `@toon-protocol/sdk`
**And** `SPSP_REQUEST_KIND` and `SPSP_RESPONSE_KIND` constants are removed

**Given** the `RelayMonitor` component in `@toon-protocol/core`
**When** this story is completed
**Then** `RelayMonitor` is evaluated for removal or simplification, since the Town node's own relay subscriptions can serve the same purpose (see Story 2.8)

**Given** all existing E2E tests
**When** run against the updated peer discovery flow
**Then** all tests pass with the simplified flow (no SPSP handshake)
**And** payment channel creation works via unilateral opening

**Connector dependency:** The `@toon-protocol/connector` must support self-describing BTP claims (extended `EVMClaimMessage` with `chainId`, `tokenNetworkAddress`, `tokenAddress`) and dynamic on-chain channel verification. See handoff doc: `docs/handoffs/connector-self-describing-claims.md`

**Test Approach:** Integration tests for simplified peer discovery flow without SPSP, unilateral channel opening using kind:10032 data, and E2E validation of the complete discover → register → announce → transact flow.

### Story 2.8: Relay Subscription API on TownInstance

> **Moved from Epic 3 (was Story 3.8) on 2026-03-07.** This provides the general-purpose relay subscription API that replaces bespoke `RelayMonitor`, fitting naturally with Epic 2's protocol stabilization scope.

As a **service developer**,
I want the Town node to expose methods for subscribing to other Nostr relays,
So that I can discover peers, seed relays, and custom event kinds through a programmable API rather than relying on hardcoded internal components.

**Dependencies:** None (can be developed in parallel with other Epic 2 stories)

**Background:**

The Town node is a Nostr relay that can serve events and accept subscriptions. However, `TownInstance` currently exposes no methods for subscribing to *other* relays. Peer discovery (kind:10032), seed relay lists (kind:10036, Story 3.4), and future use cases (kind:10033 TEE attestation, custom service kinds) all require subscribing to remote relays. Rather than building separate internal components for each subscription type (e.g., `RelayMonitor`, `SeedRelayDiscovery`), the Town should expose a general-purpose relay subscription API that any of these features can use.

**Acceptance Criteria:**

**Given** a running `TownInstance`
**When** I call `town.subscribe(relayUrl, filters)`
**Then** the Town opens a WebSocket connection to the specified relay
**And** subscribes with the provided Nostr filters (kinds, authors, etc.)
**And** received events are stored in the Town's own EventStore
**And** a `Subscription` handle is returned for lifecycle management

**Given** an active subscription
**When** I call `subscription.close()`
**Then** the WebSocket subscription is cleanly closed
**And** no further events are received from that relay

**Given** a subscription to a relay that disconnects
**When** the WebSocket connection drops
**Then** the Town automatically reconnects with exponential backoff
**And** resumes the subscription from the last seen event timestamp

**Given** the Town is stopped via `town.stop()`
**When** there are active outbound subscriptions
**Then** all subscriptions are cleanly closed during shutdown

**Given** Story 3.4 (Seed Relay Discovery)
**When** implemented using this subscription API
**Then** seed relay discovery is simply `town.subscribe(publicRelayUrl, [{ kinds: [10036] }])`
**And** no separate `SeedRelayDiscovery` component is needed

**Given** peer discovery for kind:10032
**When** implemented using this subscription API
**Then** peer discovery is simply `town.subscribe(peerRelayUrl, [{ kinds: [10032] }])`
**And** the existing `RelayMonitor` can be replaced or simplified

**Test Approach:** Unit tests for subscription lifecycle (open, receive events, close, reconnect). Integration test subscribing to a local relay and verifying events arrive in the EventStore.

---

## Epic 3: Production Protocol Economics

Production-ready protocol economics — USDC payments, x402 HTTP payment on-ramp, multi-environment chain configuration, and decentralized peer discovery. After this epic, TOON nodes can be deployed on any infrastructure with real USDC on Arbitrum One, and the protocol works end-to-end without TEE.

**Decision source:** [Party Mode Decision Log](research/marlin-party-mode-decisions-2026-03-05.md)

**Key architectural decisions:**
- USDC replaces AGENT token for all user-facing payments (Decision 1)
- x402 `/publish` endpoint on the TOON node (not a separate gateway) constructs the same ILP PREPARE packets the network already routes (Decision 8)
- The BLS handles only `/handle-packet` — all public-facing endpoints belong to the node (Decision 13)
- Seed relay list replaces genesis hub-and-spoke topology (Decision 7)
- Arbitrum One is the production chain; Anvil for dev, Sepolia for staging (Decision 6)
- SPSP removal and bootstrap simplification moved to Epic 2 (Decision 12, revised — see Epic 2 scope change note)

### Story 3.1: USDC Token Migration

As a **relay operator**,
I want payment channels and pricing denominated in USDC instead of the AGENT development token,
So that the protocol uses a real, widely-held stablecoin for all user-facing payments.

**Dependencies:** Epic 2 (relay reference implementation must be complete)

**Acceptance Criteria:**

**Given** the existing TokenNetwork contracts deployed on Anvil with AGENT token
**When** this story is completed
**Then** a mock USDC ERC-20 contract is deployed on Anvil at a deterministic address for local development
**And** the TokenNetwork is configured to use the mock USDC token
**And** all payment channel operations use USDC denomination

**Given** the SDK's pricing validator with `basePricePerByte`
**When** pricing is calculated for an event
**Then** the amount is denominated in USDC (micro-units)
**And** the pricing model remains `basePricePerByte * toonData.length`

**Given** the existing faucet service
**When** this story is completed
**Then** the faucet distributes mock USDC (on Anvil) instead of AGENT tokens
**And** the faucet service is understood to be dev-only (not needed in production)

**Given** the SDK and client packages
**When** they reference token contracts
**Then** all references to "AGENT" token are replaced with "USDC" in config, types, and documentation
**And** all existing tests pass with USDC denomination

### Story 3.2: Multi-Environment Chain Configuration

As a **relay operator**,
I want to configure my node for different deployment environments (dev, staging, production),
So that I can develop locally on Anvil, test on Arbitrum Sepolia, and deploy to Arbitrum One.

**Dependencies:** Story 3.1 (USDC migration must be complete)

**Acceptance Criteria:**

**Given** the node configuration
**When** I specify `chain: 'anvil'` (or no chain config)
**Then** the node connects to the local Anvil instance at `http://localhost:8545`
**And** uses the deterministic mock USDC contract address

**Given** the node configuration
**When** I specify `chain: 'arbitrum-sepolia'`
**Then** the node connects to Arbitrum Sepolia RPC
**And** uses the testnet USDC contract address

**Given** the node configuration
**When** I specify `chain: 'arbitrum-one'`
**Then** the node connects to Arbitrum One RPC
**And** uses the production USDC contract address (`0xaf88d065e77c8cC2239327C5EDb3A432268e5831`)

**Given** environment variables
**When** `TOON_CHAIN` is set
**Then** it overrides the config file chain selection
**And** `TOON_RPC_URL` allows custom RPC endpoint override

### Story 3.3: x402 /publish Endpoint

As an **HTTP client or AI agent**,
I want to publish Nostr events to any relay in the network via a simple HTTP endpoint with USDC payment,
So that I can interact with TOON without understanding ILP or running an ILP client.

**Dependencies:** Story 3.1 (USDC denomination), Story 3.2 (Arbitrum chain config for on-chain settlement)

**Acceptance Criteria:**

**Given** a TOON node with x402 enabled (`TOON_X402_ENABLED=true`)
**When** an HTTP client sends `GET /publish` with a Nostr event payload
**Then** the node returns HTTP 402 with pricing information (amount in USDC, facilitator address, payment network)

**Given** the 402 response
**When** the client signs an EIP-3009 gasless USDC authorization and retries with `X-PAYMENT` header
**Then** the node verifies the EIP-3009 signature
**And** settles the USDC transfer on Arbitrum
**And** constructs an ILP PREPARE packet with the TOON-encoded event as data
**And** routes the PREPARE through the connector to the destination relay

**Given** the destination relay's BLS receives the ILP PREPARE
**When** `/handle-packet` processes it
**Then** the packet is indistinguishable from one sent via the ILP rail
**And** the event is stored and a FULFILL is returned

**Given** the FULFILL propagates back
**When** the node receives it
**Then** the node returns HTTP 200 with the event ID and settlement transaction hash

**Given** the destination relay is multiple hops away
**When** the node needs to price the request
**Then** the node reads the destination's kind:10032 event from the relay for ILP address and pricing info
**And** adds a routing buffer (configurable, default 5-10%) for multi-hop overhead
**And** returns the all-in USDC price in the 402 response

**Given** x402 is disabled (default)
**When** an HTTP client sends `GET /publish`
**Then** the endpoint returns 404

### Story 3.4: Seed Relay Discovery

As a **new relay operator**,
I want to bootstrap my node by connecting to any relay in a seed list rather than depending on a specific genesis node,
So that the network has no single point of failure for peer discovery.

**Dependencies:** Epic 2 (node must be functional)

**Acceptance Criteria:**

**Given** a kind:10036 (Seed Relay List) event published to a public Nostr relay
**When** a new TOON node starts with `discovery: 'seed-list'` config
**Then** the node reads kind:10036 events from configured public Nostr relays
**And** connects to seed relays from the list
**And** subscribes to kind:10032 events to discover the full network

**Given** the seed list contains multiple relay URLs
**When** the first seed relay is unreachable
**Then** the node tries the next relay in the list
**And** continues until a connection is established or the list is exhausted

**Given** a node that is already part of the network
**When** configured to publish its seed list
**Then** it publishes a kind:10036 event to configured public Nostr relays
**And** the event contains the node's WebSocket URL and basic metadata

**Given** backward compatibility requirements
**When** `discovery: 'genesis'` is configured (or default for dev mode)
**Then** the existing genesis-based bootstrap flow is used unchanged
**And** the seed list discovery is opt-in for production deployments

### Story 3.5: kind:10035 Service Discovery Events

As a **network participant or AI agent**,
I want to discover what services a TOON node offers and at what price,
So that I can programmatically find and consume services without documentation.

**Dependencies:** Story 3.1 (USDC pricing)

**Acceptance Criteria:**

**Given** a TOON node that starts successfully
**When** bootstrap completes
**Then** the node publishes a kind:10035 (Service Discovery) event to the relay network

**Given** the kind:10035 event
**When** parsed by any client
**Then** it contains: service type (e.g., "relay", "rig"), x402 endpoint URL (if enabled), ILP address, pricing model (`basePricePerByte`, currency), supported event kinds, and node capabilities

**Given** a node with x402 disabled
**When** it publishes kind:10035
**Then** the x402 endpoint field is omitted
**And** the event advertises ILP-only access

**Given** a node's pricing or capabilities change
**When** the change is detected
**Then** a new kind:10035 event is published (replaceable event, NIP-33 pattern)

### Story 3.6: Enriched /health Endpoint

As a **network operator or AI agent**,
I want the health endpoint to return comprehensive node status including pricing and capabilities,
So that I can monitor nodes and make programmatic peering decisions.

**Dependencies:** Story 3.1 (USDC pricing), Story 3.5 (service discovery data)

**Acceptance Criteria:**

**Given** a running TOON node
**When** I request `GET /health`
**Then** the response includes:
```json
{
  "phase": "running",
  "peerCount": 5,
  "channelCount": 3,
  "pricing": { "basePricePerByte": 10, "currency": "USDC" },
  "x402": { "enabled": true, "endpoint": "/publish" },
  "capabilities": ["relay", "x402"],
  "chain": "arbitrum-one",
  "version": "1.0.0"
}
```

**Given** a node running inside an Oyster CVM (future, Epic 4)
**When** I request `GET /health`
**Then** the response additionally includes TEE attestation fields (designed to be extensible)

---

## Epic 4: Marlin TEE Deployment

From repository to one-command *service* deployment on Marlin Oyster — starting with the relay as reference implementation. Stories will be decomposed in detail when this epic starts using the BMAD epic-start workflow.

**Decision source:** [Party Mode Decision Log](research/marlin-party-mode-decisions-2026-03-05.md)
**Research source:** [Marlin Integration Technical Research](research/technical-marlin-integration-research-2026-03-05.md)

**Key architectural decisions:**
- Dedicated epic, not a phase within another epic (Decision 4)
- Epic thesis: "From repository to one-command *service* deployment on Marlin Oyster — starting with the relay as reference implementation" (Decision 10)
- Phases 2 (attestation-aware peering) and 3 (combined release) develop in parallel, ship together (Decision 5)
- Autonomous agent readiness as architectural invariant — deterministic bootstrap, programmatic deployment, self-describing economics (Decision 11)
- Emergent compute vision — TOON provides substrate, peers deploy arbitrary TEE-attested services (Decision 9)
- Event kinds 10032-10099 reserved for service advertisement (Decision 9)

**High-level scope (to be decomposed into stories at epic start):**

### Story 4.1: Oyster CVM Packaging (FR-TEE-1)
Package existing TOON Docker image for Oyster CVM deployment. Add attestation server configuration, proxy endpoint mapping. Verify deployment on Oyster testnet.

### Story 4.2: TEE Attestation Events (FR-TEE-2)
Publish kind:10033 events containing PCR values, enclave image hash, and attestation documents. Define event format and publish on node startup and periodic refresh.

### Story 4.3: Attestation-Aware Peering (FR-TEE-3)
Extend BootstrapService to parse and verify kind:10033 attestation events. Peers prefer TEE-attested relays. PCR measurement verification against known-good values.

### Story 4.4: Nautilus KMS Identity (FR-TEE-4)
Integrate Nautilus KMS for persistent enclave-bound Nostr keypairs. Relay identity derived from KMS seeds inside TEE — identity bound to code integrity.

### Story 4.5: Nix Reproducible Builds (FR-TEE-5)
Establish Nix-based Docker builds producing deterministic PCR values. CI pipeline verifies PCR reproducibility across build environments.

### Story 4.6: Attestation-First Seed Relay Bootstrap (FR-TEE-6)
Integrate kind:10033 verification into the seed relay discovery flow (from Epic 3 Story 3.4). Attestation is the bootstrap trust anchor.

---

## Epic 5: DVM Compute Marketplace

NIP-90 compatible DVM (Data Vending Machine) compute marketplace on the TOON network. Agents post job requests (Kind 5xxx) and receive results (Kind 6xxx) through the existing ILP payment infrastructure. The DVM layer provides a structured job lifecycle protocol — request, feedback, result, settlement — on top of TOON's pay-to-write relay and ILP routing mesh.

**Decision source:** [Party Mode 2020117 Analysis](research/party-mode-2020117-analysis-2026-03-10.md)
**Inspiration:** [2020117](https://github.com/qingfeng/2020117) — Nostr-native agent network with NIP-90 DVM marketplace

**Key architectural decisions:**
- NIP-90 event kinds (5xxx/6xxx/7000) for interoperability with the broader Nostr DVM ecosystem (2020117, DVMDash, etc.)
- Two-tier access: ILP PREPARE packets for initiated agents (preferred), x402 /publish for non-initiated agents (fallback)
- Compute settlement routes through ILP, not direct EVM transfer — every DVM job strengthens the payment channel network (flywheel)
- Skill descriptors embedded in kind:10035 service discovery events (not a separate event kind)
- Relay write fees (per-byte) are separate from compute fees (per-job) — both settle through ILP channels
- Standard Nostr JSON in DVM events (TOON encoding is the relay's internal format; DVM protocol uses JSON for cross-network compatibility)

**Two-tier access model:**
```
Tier 1: Initiated Agents (ILP-native) — preferred path
  Agent → ILP PREPARE packet (TOON-encoded Kind 5xxx) → Relay stores → Provider reads free
  Lower cost, no HTTP overhead, native ILP routing

Tier 2: Non-Initiated Agents (x402 on-ramp) — fallback path
  Agent → POST /publish → HTTP 402 → EIP-3009 USDC auth → Relay stores
  Higher friction, but no payment channel required
```

**DVM job lifecycle on TOON:**
```
1. Customer → ILP PREPARE [Kind 5xxx job request]  → Relay (paid to write)
2. Provider ← reads Kind 5xxx (free to read)
3. Provider → ILP PREPARE [Kind 7000 feedback]     → Relay (paid to write)
4. Provider → ILP PREPARE [Kind 6xxx result]        → Relay (paid to write)
5. Customer ← reads Kind 6xxx (free to read)
6. Customer → ILP payment to Provider               → Compute settlement (routed through ILP mesh)
```

### Story 5.1: DVM Event Kind Definitions

As a **protocol developer**,
I want NIP-90 compatible DVM event kinds defined for the TOON protocol with full TOON encoding support,
So that agents can post structured job requests, receive feedback, and collect results using the standard DVM protocol.

**Dependencies:** Epic 2 (relay must support event storage and subscriptions)

**Acceptance Criteria:**

**Given** the NIP-90 DVM protocol specification
**When** this story is completed
**Then** Kind 5xxx (Job Request) events are defined with required tags: `i` (input + type), `bid` (amount in USDC micro-units), `output` (expected output type), and optional tags: `p` (target specific provider), `param` (key-value parameters), `relays` (preferred relay URLs)
**And** Kind 6xxx (Job Result) events are defined with required tags: `e` (request event ID), `p` (customer pubkey), `amount` (compute cost in USDC micro-units), and content containing the result data
**And** Kind 7000 (Job Feedback) events are defined with required tags: `e` (request event ID), `p` (customer pubkey), `status` (processing/error/success/partial), and optional content with status details

**Given** the TOON TOON format
**When** DVM events are published via ILP PREPARE packets
**Then** TOON encoder/decoder handles Kind 5xxx, 6xxx, and 7000 events correctly
**And** the TOON shallow parser extracts kind, pubkey, and event ID without full decode for routing decisions

**Given** a set of initially supported DVM job kinds
**When** the protocol launches
**Then** Kind 5100 (Text Generation) is supported as the reference DVM kind
**And** additional kinds (5200 image generation, 5300 text-to-speech, 5302 translation) are defined but provider support is optional
**And** the kind:10035 skill descriptor advertises which specific 5xxx kinds a node supports

**Given** a Kind 5xxx event with a `p` tag targeting a specific provider
**When** the event is published to the relay
**Then** only the targeted provider should process it (direct request vs. open marketplace)
**And** untargeted requests (no `p` tag) are available for any provider with matching capabilities

**Test Approach:** Unit tests for TOON encoding/decoding of all three DVM event kinds. Validation tests for required tag presence and format. Roundtrip test: JSON → TOON → JSON preserves all DVM fields.

### Story 5.2: ILP-Native Job Submission

As an **initiated agent** (with an open ILP payment channel),
I want to publish DVM job requests via ILP PREPARE packets as the preferred path,
So that I can post jobs using the native payment rail with lower cost and no HTTP overhead.

**Dependencies:** Story 5.1 (DVM event kinds must be defined), Epic 3 Story 3.3 (x402 exists as fallback)

**Acceptance Criteria:**

**Given** an initiated agent with an open ILP payment channel to a TOON relay
**When** the agent publishes a Kind 5xxx job request
**Then** the job request is TOON-encoded and sent as an ILP PREPARE packet (existing write path)
**And** the relay stores the event and broadcasts to subscribers
**And** the relay write fee is `basePricePerByte * toonData.length` (existing pricing model)

**Given** a non-initiated agent without an ILP payment channel
**When** the agent wants to publish a Kind 5xxx job request
**Then** the agent uses the x402 /publish endpoint (FR-PROD-3, Story 3.3) as fallback
**And** the resulting ILP PREPARE packet is indistinguishable from one sent via the ILP rail

**Given** a provider agent subscribed to the relay
**When** a Kind 5xxx job request is published
**Then** the provider receives the event via WebSocket subscription (free to read)
**And** the provider's SDK can filter incoming events by supported DVM kinds from its skill descriptor

**Given** the SDK's handler registry
**When** a provider registers DVM handlers
**Then** `node.on(5100, myTextGenHandler)` routes Kind 5100 job requests to the handler
**And** `ctx.decode()` returns the structured job request with input, bid, and parameters
**And** `ctx.toon` provides raw TOON for direct LLM consumption (existing TOON-native pattern)

**Given** a provider node
**When** it starts and connects to the relay
**Then** it subscribes to the relay for Kind 5xxx events matching its supported kinds (from skill descriptor)
**And** subscription uses the Town relay subscription API (Story 2.8)

**Test Approach:** Integration test: initiated agent publishes Kind 5100 job request via ILP → relay stores → provider receives via subscription. Unit test: SDK handler registration for DVM kinds. Verify x402 fallback produces identical relay-side behavior.

### Story 5.3: Job Result Delivery + Compute Settlement

As a **DVM provider agent**,
I want to publish job results and receive compute payment through the ILP network,
So that the complete job lifecycle (request → feedback → result → settlement) works end-to-end on TOON.

**Dependencies:** Story 5.2 (job submission must work), Epic 3 Story 3.1 (USDC denomination)

**Acceptance Criteria:**

**Given** a provider processing a Kind 5xxx job request
**When** the provider begins processing
**Then** it publishes a Kind 7000 feedback event with `status: 'processing'` via ILP PREPARE
**And** the relay stores the feedback and notifies the customer via subscription

**Given** a provider that has completed processing a job
**When** the provider publishes a Kind 6xxx result event
**Then** the result is sent via ILP PREPARE with tags: `e` (request event ID), `p` (customer pubkey), `amount` (compute cost in USDC micro-units)
**And** the relay stores the result and notifies the customer

**Given** a customer that has received a Kind 6xxx result
**When** the customer reads the result (free to read)
**Then** the customer's SDK extracts the provider's ILP address from their kind:10035 event
**And** the customer sends an ILP payment for the compute cost routed through the ILP mesh
**And** the payment routes: customer → connector → [intermediate hops] → provider's connector → provider
**And** settlement occurs through existing EVM payment channels (same infrastructure as relay write fees)

**Given** a Kind 6xxx result from a provider whose ILP address is reachable via multi-hop routing
**When** the customer sends the compute payment
**Then** the payment routes through the ILP mesh (e.g., customer → relay node → provider node)
**And** each intermediate connector earns routing fees (existing ILP economics)

**Given** a provider that encounters an error during processing
**When** the error occurs
**Then** the provider publishes a Kind 7000 feedback event with `status: 'error'` and error details
**And** no compute payment is expected

**Given** the SDK
**When** a DVM job lifecycle completes
**Then** the SDK provides helper functions: `publishJobRequest(input, params, bid)`, `publishFeedback(requestId, status)`, `publishResult(requestId, result, amount)`, and `settleCompute(resultEvent)`
**And** these helpers handle TOON encoding, ILP PREPARE construction, and payment routing

**Test Approach:** Integration test: full lifecycle — customer posts job → provider sends feedback → provider sends result → customer settles compute payment via ILP. Unit test: helper functions for each DVM event type. Verify compute payment routes through ILP mesh (multi-hop test if SDK E2E infra available).

### Story 5.4: Skill Descriptors in Service Discovery

As an **agent or AI system**,
I want to discover what DVM services a TOON node offers by reading structured skill descriptors in kind:10035 events,
So that I can programmatically find compatible providers and construct valid job requests without documentation.

**Dependencies:** Epic 3 Story 3.5 (kind:10035 service discovery events must exist)

**Acceptance Criteria:**

**Given** the kind:10035 (Service Discovery) event format from Story 3.5
**When** a node supports DVM services
**Then** the kind:10035 event includes a `skill` field with the structured skill descriptor
**And** the skill descriptor contains: `name` (service identifier), `version` (schema version), `kinds` (array of supported DVM Kind 5xxx numbers), `features` (capability list), `inputSchema` (JSON Schema for job request parameters), `pricing` (per-kind cost in USDC micro-units), and `models` (available AI models, if applicable)

**Given** a skill descriptor with `inputSchema`
**When** an agent reads the schema
**Then** the agent can construct a valid Kind 5xxx job request with correct `param` tags without prior knowledge of the provider's capabilities
**And** the schema follows JSON Schema draft-07 for interoperability

**Given** a node that starts with DVM handlers registered
**When** bootstrap completes
**Then** the node publishes its kind:10035 event with the skill descriptor populated from the registered DVM handlers
**And** supported kinds are derived from `.on(kind, handler)` registrations
**And** pricing is derived from the node's configured per-kind pricing (or `basePricePerByte` default)

**Given** a node's DVM capabilities change (new handler registered, pricing update)
**When** the change is detected
**Then** a new kind:10035 event is published with the updated skill descriptor (NIP-33 replaceable event)

**Given** an agent searching for a text generation provider
**When** the agent queries the relay for kind:10035 events
**Then** it can filter results by `skill.kinds` containing `5100`
**And** compare pricing across providers
**And** select the provider whose `skill.features` and `skill.models` best match the job requirements

**Given** the skill descriptor format
**When** compared to 2020117's skill JSON schema
**Then** the TOON skill descriptor is a superset — it includes all fields from 2020117's format plus TOON-specific fields: `ilpAddress`, `x402Endpoint`, `supportedChains`, and `attestation` (for Epic 6 TEE integration)

**Test Approach:** Unit test: skill descriptor generation from handler registrations. Integration test: node publishes kind:10035 with skill on startup → agent queries relay → parses skill descriptor → constructs valid job request. Validate JSON Schema compliance of inputSchema field.

---

## Epic 6: Advanced DVM Coordination + TEE Integration

Advanced DVM coordination patterns — workflow chains and agent swarms — plus TEE trust integration and reputation scoring. These features layer on top of Epic 5's base DVM marketplace and Epic 4's TEE attestation infrastructure to create a differentiated compute marketplace with verifiable execution and programmatic trust.

**Decision source:** [Party Mode 2020117 Analysis](research/party-mode-2020117-analysis-2026-03-10.md)
**Dependencies:** Epic 4 (TEE attestation for Story 6.3), Epic 5 (base DVM marketplace for all stories)

**Key architectural decisions:**
- Workflow chains use TOON relay as the orchestration layer (no separate workflow engine)
- Agent swarms settle only the winning submission — losers pay relay write fees but receive no compute payment
- TEE-attested results reference kind:10033 attestation events (not inline attestation data)
- Reputation formula adapted from 2020117: replaces zap_sats with ILP channel volume, keeps WoT and job stats
- Reputation scores are published in kind:10035 events (self-reported, verifiable from on-chain + relay data)

**Inspiration from 2020117:**
- Kind 5117 (Workflow Chain) → adapted for ILP-routed multi-step pipelines
- Kind 5118 (Agent Swarm) → adapted for competitive bidding with ILP settlement
- Reputation scoring formula: `score = (trusted_by × 100) + (log10(channel_volume) × 10) + (jobs_completed × 5) + (avg_rating × 20)`
- Kind 31117 (Job Review) → adopted directly for structured job reviews

### Story 6.1: Workflow Chains

As a **customer agent**,
I want to define multi-step DVM pipelines where each step's output automatically feeds into the next step's input,
So that I can compose complex compute tasks from simpler DVM jobs without manual orchestration.

**Dependencies:** Epic 5 (base DVM lifecycle must work end-to-end)

**Acceptance Criteria:**

**Given** a customer that wants to chain multiple DVM jobs
**When** the customer publishes a workflow definition event
**Then** the event contains: an ordered list of steps (each with a DVM kind, description, and optional provider target), the initial input, and a total bid (split across steps)
**And** the event uses a TOON-specific kind in the reserved 10032-10099 range (e.g., kind:10040 Workflow Chain)

**Given** a published workflow definition
**When** the relay receives it
**Then** the relay (or an orchestrating node) creates a Kind 5xxx job request for step 1 with the workflow's initial input
**And** publishes it via ILP PREPARE (standard DVM job submission)

**Given** a step N in the workflow completes with a Kind 6xxx result
**When** the orchestrating node detects the result
**Then** it extracts the result content from step N
**And** creates a Kind 5xxx job request for step N+1 with step N's result as the input
**And** publishes the new request via ILP PREPARE
**And** this continues until all steps are complete

**Given** the final step in a workflow completes
**When** the orchestrating node detects the final result
**Then** the workflow status is marked as completed
**And** the customer is notified (Kind 7000 feedback referencing the workflow event)
**And** compute payments for each step settle individually through ILP

**Given** any step in the workflow fails (Kind 7000 with `status: 'error'`)
**When** the orchestrating node detects the failure
**Then** the workflow is marked as failed at that step
**And** subsequent steps are not executed
**And** the customer is notified with the failure details

**Test Approach:** Integration test: 2-step workflow (text input → translation Kind 5302 → summarization Kind 5303). Verify step advancement, input chaining, and individual compute settlement. Error handling test: step 1 fails → step 2 never executes.

### Story 6.2: Agent Swarms

As a **customer agent**,
I want to post a competitive DVM job where multiple providers submit results and I select the best one for payment,
So that I can get the highest quality result by leveraging competition between providers.

**Dependencies:** Epic 5 (base DVM lifecycle must work end-to-end)

**Acceptance Criteria:**

**Given** a customer that wants competitive submissions
**When** the customer publishes a swarm job request
**Then** the event contains: the standard DVM Kind 5xxx fields, plus a `swarm` tag specifying the maximum number of providers, and a `judge` tag (default: `customer`)
**And** a standard Kind 5xxx job request is also published (so non-swarm-aware providers can still participate)

**Given** a published swarm request
**When** providers submit Kind 6xxx results
**Then** submissions are collected until the maximum provider count is reached
**And** each submission is associated with the swarm via the `e` tag referencing the original request

**Given** all submissions have been received (or a timeout is reached)
**When** the customer reviews the submissions
**Then** the customer selects the winning submission by publishing a selection event
**And** only the winning provider receives the compute payment via ILP

**Given** a swarm where fewer providers respond than the maximum
**When** a configurable timeout expires (default: 10 minutes)
**Then** the swarm proceeds to judging with whatever submissions have been received

**Given** a provider whose submission was not selected
**When** the swarm concludes
**Then** the losing provider paid relay write fees for their Kind 6xxx result but receives no compute payment
**And** the losing provider's submission is still stored on the relay for transparency

**Test Approach:** Integration test: swarm with 2 providers, customer selects winner, verify only winner receives ILP payment. Timeout test: swarm with max_providers=3 but only 1 responds within timeout.

### Story 6.3: TEE-Attested DVM Results

As a **customer agent**,
I want DVM job results to include proof that the computation ran in a TEE-attested enclave,
So that I can cryptographically verify the integrity of the computation without trusting the provider's reputation.

**Dependencies:** Epic 4 Story 4.2 (kind:10033 TEE attestation events must exist), Epic 5 Story 5.3 (job result delivery must work)

**Acceptance Criteria:**

**Given** a provider running inside a Marlin Oyster CVM with valid TEE attestation
**When** the provider publishes a Kind 6xxx result event
**Then** the result includes an `attestation` tag referencing the provider's latest kind:10033 event ID
**And** the kind:10033 event contains PCR values, enclave image hash, and attestation document

**Given** a customer receiving a Kind 6xxx result with an `attestation` tag
**When** the customer wants to verify the computation integrity
**Then** the customer reads the referenced kind:10033 event from the relay
**And** verifies the PCR measurements against known-good values (from the provider's published Nix build hashes)
**And** verifies the attestation document chain (AWS Nitro / Marlin attestation)

**Given** a customer that requires TEE-attested results
**When** the customer publishes a Kind 5xxx job request
**Then** the request includes a `param` tag: `['param', 'require_attestation', 'true']`
**And** non-TEE providers should not accept the job (their Kind 7000 feedback should indicate `status: 'error'` with reason)

**Given** the kind:10035 skill descriptor
**When** a TEE-attested node publishes its service discovery event
**Then** the skill descriptor includes an `attestation` field with the latest kind:10033 event ID and enclave image hash
**And** customers can filter providers by attestation status before submitting jobs

**Test Approach:** Unit test: attestation tag injection in Kind 6xxx events. Integration test (requires Epic 4 infrastructure): full lifecycle with TEE verification. Mock test: customer verifies attestation reference against kind:10033 event data.

### Story 6.4: Reputation Scoring System

As a **network participant**,
I want a composite reputation score for DVM providers based on verifiable on-chain and relay data,
So that I can make programmatic trust decisions about which providers to send jobs to.

**Dependencies:** Epic 5 (DVM job lifecycle for job completion stats), Epic 4 (optional — TEE attestation adds a trust signal)

**Acceptance Criteria:**

**Given** the reputation scoring formula adapted from 2020117
**When** a provider's reputation is calculated
**Then** the composite score is: `score = (trusted_by × 100) + (log10(channel_volume_usdc) × 10) + (jobs_completed × 5) + (avg_rating × 20)`
**And** `trusted_by` is the count of Kind 30382 (NIP-85 Web of Trust) declarations targeting the provider
**And** `channel_volume_usdc` is the total USDC settled through the provider's ILP payment channels (verifiable on-chain)
**And** `jobs_completed` is the count of Kind 6xxx result events published by the provider
**And** `avg_rating` is the mean of Kind 31117 (Job Review) ratings received by the provider

**Given** the Kind 31117 (Job Review) event kind
**When** a customer or provider submits a review after a DVM job
**Then** the review contains: `d` tag (job request event ID), `p` tag (target pubkey), `rating` tag (1-5 integer), `role` tag (customer/provider), and optional content (text review)
**And** one review per job per reviewer is enforced by the `d` tag (NIP-33 replaceable event)

**Given** a provider's kind:10035 service discovery event
**When** the provider publishes or updates their event
**Then** it includes a `reputation` field with the self-reported composite score and individual signal values
**And** all signals are independently verifiable: WoT from relay (Kind 30382), channel volume from on-chain data, job count from relay (Kind 6xxx), ratings from relay (Kind 31117)

**Given** a customer posting a DVM job request
**When** the customer wants to filter providers by reputation
**Then** the customer can include a `param` tag: `['param', 'min_reputation', '<score>']`
**And** providers with scores below the threshold should not accept the job

**Given** a TEE-attested provider (Epic 4)
**When** their reputation is displayed
**Then** the attestation status is shown alongside the reputation score as an additional trust signal
**And** TEE attestation is NOT factored into the numeric score (it's a separate, binary trust layer)

**Test Approach:** Unit test: score calculation from mock signal data. Integration test: full flow — customer posts job → provider completes → customer submits Kind 31117 review → provider's reputation score updates. Verify on-chain channel volume extraction. Verify Kind 30382 WoT counting.

---

## Epic 7: ILP Address Hierarchy & Protocol Economics

Hierarchical ILP addressing with deterministic address derivation, multi-hop fee calculation, and a prefix marketplace. Replaces flat publisher-assigned addressing with a topology-derived hierarchy. Fee calculation becomes invisible to SDK users. A new Nostr kind enables vanity prefix purchases from upstream peers.

**Decision source:** Party Mode 2026-03-20

### Story 7.1: Deterministic Address Derivation

**As a** TOON node operator,
**I want** my ILP address to be deterministically derived from my Nostr pubkey and my upstream peer's prefix,
**So that** address assignment is automatic, collision-resistant, and requires zero configuration.

**Acceptance Criteria:**

**Given** a node with Nostr pubkey `abcd1234...` peering with a node at prefix `g.toon`
**When** the peering handshake completes
**Then** the node's ILP address is `g.toon.abcd1234` (first 8 hex chars of pubkey)

**Given** the genesis node with network prefix `g.toon`
**When** it starts
**Then** its ILP address is `g.toon` (the root prefix, a protocol constant)

**Given** a `deriveChildAddress(parentPrefix, childPubkey)` utility function
**When** called with `('g.toon.ef567890', '11aabb22...')`
**Then** it returns `g.toon.ef567890.11aabb22`

**Test Approach:** Unit test: `deriveChildAddress()` with various inputs. Verify ILP address segment validation (lowercase, valid chars). Verify 8-char truncation. Verify root prefix is a constant.

### Story 7.2: BTP Address Assignment Handshake

**As a** TOON node,
**I want** my upstream peer to communicate its prefix during the BTP handshake,
**So that** I can deterministically compute my own ILP address from the peering relationship.

**Acceptance Criteria:**

**Given** a node initiating a BTP connection to an upstream peer
**When** the BTP handshake completes
**Then** the upstream peer's prefix is communicated to the connecting node
**And** the connecting node computes its address as `${upstreamPrefix}.${ownPubkey.slice(0, 8)}`

**Given** a node that was previously addressed as `g.toon.peer1` (hardcoded)
**When** it connects via the new handshake protocol
**Then** its address is derived from the upstream prefix + its pubkey (not hardcoded)

**Test Approach:** Integration test: two nodes peer via BTP, verify child receives correct address derived from parent's prefix. Unit test: handshake message parsing.

### Story 7.3: Multi-Address Support for Multi-Peered Nodes

**As a** TOON node peered with multiple upstream connectors,
**I want** to hold multiple ILP addresses (one per peering),
**So that** I am reachable via any of my upstream paths.

**Acceptance Criteria:**

**Given** a node peered with both `g.toon.useast` and `g.toon.euwest`
**When** it publishes its kind:10032 peer info event
**Then** the event contains `ilpAddresses: ['g.toon.useast.{pubkey8}', 'g.toon.euwest.{pubkey8}']`

**Given** a client resolving a destination by Nostr pubkey
**When** the destination node has multiple ILP addresses
**Then** the client can select the optimal route based on available paths

**Test Approach:** Unit test: kind:10032 event with multiple addresses. Integration test: node with two peers, verify both addresses are advertised and routable.

### Story 7.4: Fee-Per-Byte Advertisement in kind:10032

**As a** TOON node operator,
**I want** to advertise my routing fee in kind:10032 peer info events,
**So that** senders can calculate the total cost of multi-hop routes.

**Acceptance Criteria:**

**Given** a node with `feePerByte: 2n` configured
**When** it publishes its kind:10032 peer info event
**Then** the event includes `feePerByte: 2` alongside existing fields (`ilpAddresses`, `btpEndpoint`, `capabilities`)

**Given** a node with no explicit fee configuration
**When** it publishes kind:10032
**Then** `feePerByte` defaults to `0` (free routing)

**Test Approach:** Unit test: kind:10032 event builder includes `feePerByte`. Integration test: peer discovers fee via kind:10032 subscription.

### Story 7.5: SDK Route-Aware Fee Calculation

**As an** SDK user calling `publishEvent()`,
**I want** the SDK to automatically calculate and include intermediary routing fees,
**So that** the recipient receives the correct write fee without me knowing about multi-hop costs.

**Acceptance Criteria:**

**Given** a publish from `g.toon.useast.client-abc` to `g.toon.euwest.relay-42`
**And** the route traverses two intermediaries with `feePerByte: 2n` and `feePerByte: 3n`
**When** the SDK computes the ILP PREPARE amount
**Then** `amount = (basePricePerByte × toonBytes.length) + (2n × toonBytes.length) + (3n × toonBytes.length)`

**Given** a direct single-hop publish (no intermediaries)
**When** the SDK computes the amount
**Then** `amount = basePricePerByte × toonBytes.length` (unchanged from current behavior)

**Given** the fee calculation
**When** the user calls `publishEvent(event)`
**Then** the fee math is completely internal — no fee parameters exposed to the user

**Test Approach:** Unit test: fee calculator with mock route table. Integration test: multi-hop publish with fee-charging intermediaries, verify destination receives correct write fee. E2E test: full publish through Docker infra with intermediary fees.

### Story 7.6: Prefix Claim Kind and Marketplace

**As a** TOON node operator,
**I want** to claim a human-readable vanity prefix (e.g., `useast`, `btc`) from my upstream peer by paying for it,
**So that** my node has a memorable, branded ILP address instead of a pubkey-derived one.

**Acceptance Criteria:**

**Given** a new Nostr event kind for prefix claim requests
**When** a node sends a prefix claim event with `{ requestedPrefix: 'useast', payment: <ILP claim> }` to its upstream peer
**Then** the upstream validates: (1) the prefix is available (not already claimed), (2) the payment is sufficient
**And** responds with a confirmation event granting the prefix

**Given** a node that has claimed `useast` from `g.toon`
**When** it peers with child nodes
**Then** its prefix is `g.toon.useast` (the vanity prefix replaces the pubkey-derived default)
**And** child nodes are addressed as `g.toon.useast.{childPubkey8}`

**Given** a prefix that is already claimed by another peer
**When** a new node requests the same prefix
**Then** the request is rejected with a `PREFIX_TAKEN` error

**Given** the upstream peer's pricing for vanity prefixes
**When** it advertises in kind:10032
**Then** it includes prefix pricing information (e.g., `prefixPricing: { basePrice: 1000000n }`)

**Test Approach:** Unit test: prefix claim event creation, validation, conflict detection. Integration test: full claim flow — request, payment, confirmation, address activation. Verify claimed prefix overrides pubkey-derived address.

---

## Epic 8: The Rig — ILP-Gated TypeScript Git Forge

A TypeScript-native git forge built on the SDK, proving the full production stack — SDK, USDC, x402, TEE, DVM — works end-to-end for a non-relay service. The Rig is a mechanical port of Forgejo's read-only code browsing UI (Go HTML templates → Eta templates) with a git HTTP backend (via `child_process` git binary). Issues, PRs, and comments are Nostr events stored on the relay — not a database. All write operations (repo creation, patches, issues) require ILP-gated NIP-34 events. Nostr pubkeys are the native identity — no user database, no identity mapping. The Rig serves as the third SDK example and the first non-relay, non-DVM service on the emergent compute substrate, validating the platform generality thesis.

**Reference:** [forgejo](https://codeberg.org/forgejo/forgejo) (Go, GPL-3.0) — source for mechanical template port

**Architecture notes:**

- **Pure TypeScript** — no Go dependency, no Docker required, no external database
- **Git HTTP backend** via `child_process` spawning the `git` binary (git-http-backend for clone/fetch, direct git commands for repo init/management)
- **Read-only web UI** mechanically ported from Forgejo's Go HTML templates to Eta templates, served by Express
- **Issues/PRs/comments from relay** — the Rig subscribes to the relay for NIP-34 events (kind:1621 issues, kind:1617 patches, kind:1622 comments) and renders them in the web UI; there is NO issues/PR database
- **Nostr pubkeys ARE usernames** — no identity mapping layer, no user database; pubkeys display directly in the UI (with optional NIP-05/kind:0 profile enrichment)
- **Write path**: ILP packet → SDK handler → `ctx.decode()` → execute git operation (init repo, apply patch) → `ctx.accept()`
- **Read path**: HTTP request → Express route → git binary (for code/tree/blob) + relay subscription (for issues/PRs) → Eta template → HTML response
- **Template port scope**: repository list, file tree, blob viewer, commit log, commit diff, blame — NOT: admin panels, user settings, OAuth, notification system, dashboard
- Existing `packages/core/src/nip34/` provides NIP34Handler, GitOperations as foundation (ForgejoClient to be replaced)
- **Validates Epics 1-7**: The Rig exercises SDK handlers (Epic 1), relay event storage (Epic 2), USDC/x402 payments (Epic 3), TEE attestation (Epic 4), DVM marketplace (Epic 5), advanced DVM coordination (Epic 6), and ILP address hierarchy (Epic 7) in a single service

### Story 8.1: SDK Node Setup and Repository Creation Handler

As a **network operator**,
I want a Rig service node built on the SDK that accepts kind:30617 (Repository Announcement) events via ILP and initializes git repositories,
So that repositories can be created through paid Nostr events.

**Dependencies:** Epic 1 (SDK must be complete)

**Acceptance Criteria:**

**Given** an SDK `createNode()` with handlers registered for NIP-34 kinds
**When** the Rig node starts
**Then** it connects to the embedded connector and begins accepting ILP packets
**And** each NIP-34 kind is routed to its specific handler via `.on(kind, handler)`
**And** an Express HTTP server starts serving on the configured port

**Given** an incoming ILP packet with a kind:30617 (Repository Announcement) event
**When** the handler calls `ctx.decode()` and processes the event
**Then** a bare git repository is initialized on disk via `git init --bare` (child_process)
**And** repository metadata (name, description, pubkey-owner) is stored in SQLite via RepoMetadataStore
**And** `ctx.accept()` is called with the repository metadata

**Given** the system has `git` installed (required dependency)
**When** the Rig starts
**Then** it verifies that `git` is available in PATH and logs the version
**And** if `git` is not found, it exits with a clear error message

**Given** an unsupported or malformed NIP-34 event
**When** the handler cannot process it
**Then** `ctx.reject('F00', 'Unsupported NIP-34 kind')` is called

### Story 8.2: Patch Handler

As a **contributor**,
I want to submit code patches as kind:1617 events via ILP,
So that my patches are applied to the repository through the standard NIP-34 workflow.

**Dependencies:** Story 8.1 (repositories must exist)

**Acceptance Criteria:**

**Given** an incoming kind:1617 (Patch) event referencing an existing repository
**When** the handler calls `ctx.decode()` and processes the event
**Then** the patch content is applied to the repository via `git am` or `git apply` (child_process)
**And** the patch event ID is recorded for relay-sourced PR rendering
**And** `ctx.accept()` is called

**Given** a kind:1617 event referencing a non-existent repository
**When** the handler processes it
**Then** `ctx.reject('F00', 'Repository not found')` is called

**Given** a malformed patch that cannot be applied
**When** `git am` or `git apply` fails
**Then** `ctx.reject('F00', 'Patch application failed')` is called with the git error message

### Story 8.3: Issue and Comment Handlers

As a **contributor**,
I want to submit issues (kind:1621) and comments (kind:1622) via ILP,
So that my discussions are acknowledged by the Rig and stored on the relay for web UI rendering.

**Dependencies:** Story 8.1 (repositories must exist)

**Acceptance Criteria:**

**Given** an incoming kind:1621 (Issue) event referencing an existing repository
**When** the handler processes it
**Then** `ctx.accept()` is called (the issue is a Nostr event stored on the relay — the Rig acknowledges receipt)

**Given** an incoming kind:1622 (Comment) event referencing an existing issue or PR
**When** the handler processes it
**Then** `ctx.accept()` is called (the comment is stored on the relay)

**Given** a kind:1621 or kind:1622 event referencing a non-existent repository
**When** the handler processes it
**Then** `ctx.reject('F00', 'Repository not found')` is called

### Story 8.4: Git HTTP Backend for Clone and Fetch

As a **developer**,
I want to clone and fetch repositories hosted on the Rig via standard git HTTP protocol,
So that I can work with Rig repositories using any standard git client.

**Dependencies:** Story 8.1 (repositories must exist)

**Acceptance Criteria:**

**Given** a git clone request over HTTP (`GET /{owner}/{repo}.git/info/refs?service=git-upload-pack`)
**When** the HTTP server receives it
**Then** the request is proxied to `git-http-backend` via child_process (CGI protocol)
**And** the repository is served for read (clone/fetch is free, no ILP payment required)

**Given** a git fetch request for an existing repository
**When** the HTTP server receives it
**Then** the fetch completes successfully via the git HTTP backend

**Given** a clone/fetch request for a non-existent repository
**When** the HTTP server receives it
**Then** a 404 response is returned

**Given** a git push request over HTTP
**When** the HTTP server receives it
**Then** the request is rejected (write operations go through ILP-gated NIP-34 events, not HTTP push)

### Story 8.5: Nostr Pubkey-Native Git Identity

As a **contributor**,
I want my Nostr pubkey to be my git identity on the Rig,
So that my commits, issues, and PRs are attributed to my cryptographic identity without any registration or mapping.

**Dependencies:** None (identity module is independent)

**Acceptance Criteria:**

**Given** a NIP-34 event (any kind) from a pubkey
**When** the Rig processes the event
**Then** the pubkey is used directly as the author identity — no user database lookup, no Forgejo user creation
**And** git commits attribute authorship via `GIT_AUTHOR_NAME=<pubkey_short>` and `GIT_AUTHOR_EMAIL=<pubkey>@nostr`

**Given** a pubkey that has published a kind:0 (Profile Metadata) event on the relay
**When** the web UI renders that pubkey's activity (commits, issues, PRs)
**Then** the display name and avatar from the kind:0 event are shown alongside the pubkey
**And** if no kind:0 profile exists, the truncated pubkey is displayed (e.g., `npub1abc...xyz`)

**Given** a kind:30617 (Repository Announcement) event
**When** a repository is created
**Then** the event's pubkey is recorded as the repository owner
**And** repository permissions (who can merge, who can push) are determined by pubkey lists in the repository's NIP-34 maintainer tags

**Given** a NIP-34 event that modifies a repository (patch, merge, close)
**When** the handler checks authorization
**Then** the event's pubkey is checked against the repository's maintainer list (from the latest kind:30617 event's `maintainers` tags)
**And** unauthorized pubkeys receive `ctx.reject('F06', 'Unauthorized')`

### Story 8.6: NIP-34 Status Events and PR Lifecycle

As a **contributor**,
I want my pull request status tracked through NIP-34 status events (kinds 1630-1633),
So that the PR lifecycle (open, applied/merged, closed, draft) is managed through Nostr events with ILP payment.

**Dependencies:** Stories 8.1, 8.2 (repositories and patches must exist)

**Acceptance Criteria:**

**Given** a kind:1630 (Status Open) event referencing a patch event (kind:1617)
**When** the Rig processes it
**Then** the patch is marked as an open PR in the repository metadata
**And** the event pubkey is verified as the patch author or a repo maintainer

**Given** a kind:1631 (Status Applied/Merged) event
**When** the Rig processes it
**Then** the patch branch is merged into the target branch via `git merge` (child_process)
**And** the merge commit attributes the merger's pubkey
**And** only pubkeys listed as maintainers in the repository's kind:30617 event can merge

**Given** a kind:1632 (Status Closed) event
**When** the Rig processes it
**Then** the PR is marked as closed in repository metadata (no git merge occurs)

**Given** a kind:1633 (Status Draft) event
**When** the Rig processes it
**Then** the PR is marked as draft in repository metadata

**Given** a status event from a pubkey without appropriate permissions
**When** the handler checks authorization
**Then** `ctx.reject('F06', 'Unauthorized: pubkey lacks maintainer permissions')` is called

### Story 8.7: Layout and Repository List Page

As a **developer**,
I want to see a list of all repositories hosted on the Rig through a web UI,
So that I can discover and navigate to projects without needing a specialized client.

**Dependencies:** Story 8.1 (repositories must exist), Story 8.5 (pubkey display)

**Acceptance Criteria:**

**Given** the Rig is running with at least one repository
**When** I visit the web UI root (`/`)
**Then** a repository list is displayed showing all hosted repos with name, description, owner pubkey, and last commit date
**And** the HTML is rendered from Eta templates (mechanically ported from Forgejo's Go HTML templates)
**And** a shared layout template (`layout.eta`) provides the HTML shell, navigation header, and CSS

**Given** the repository list
**When** I click on a repository name
**Then** I am navigated to the repository's file tree view

**Given** no repositories exist
**When** I visit the root
**Then** an empty state message is displayed

### Story 8.8: File Tree and Blob View

As a **developer**,
I want to browse a repository's file tree and view individual file contents,
So that I can explore the codebase through the web UI.

**Dependencies:** Story 8.7 (layout must exist)

**Acceptance Criteria:**

**Given** a repository page (`/{owner}/{repo}`)
**When** I browse the file tree
**Then** the tree view shows directories and files at the current ref (default branch)
**And** clicking a file shows syntax-highlighted content (blob view)
**And** clicking a directory navigates into it
**And** data is fetched via `git ls-tree`, `git show`, etc. (child_process)

**Given** a file blob view (`/{owner}/{repo}/blob/{ref}/{path}`)
**When** I view a file
**Then** the file content is displayed with syntax highlighting
**And** the file size and last commit info are shown

**Given** a path that does not exist in the repository
**When** I navigate to it
**Then** a 404 page is displayed

### Story 8.9: Commit Log and Diff View

As a **developer**,
I want to view commit history and individual commit diffs,
So that I can understand the change history of a repository.

**Dependencies:** Story 8.7 (layout must exist)

**Acceptance Criteria:**

**Given** a repository with commits
**When** I view the commit log (`/{owner}/{repo}/commits`)
**Then** commits are listed with hash, message, author (pubkey with optional profile enrichment), and date
**And** clicking a commit shows the diff view

**Given** a commit diff view (`/{owner}/{repo}/commit/{sha}`)
**When** I view it
**Then** the diff is rendered with syntax-highlighted additions/deletions
**And** the diff is generated via `git diff` (child_process)
**And** the commit metadata (author, date, message) is displayed

**Given** an invalid commit SHA
**When** I navigate to it
**Then** a 404 page is displayed

### Story 8.10: Blame View

As a **developer**,
I want to view per-line blame information for any file,
So that I can see who last modified each line and when.

**Dependencies:** Story 8.7 (layout must exist)

**Acceptance Criteria:**

**Given** a blame view (`/{owner}/{repo}/blame/{ref}/{path}`)
**When** I view a file's blame
**Then** each line shows the commit hash, author pubkey, and date of last modification
**And** the blame data is generated via `git blame` (child_process)

**Given** a file that does not exist at the specified ref
**When** I navigate to its blame view
**Then** a 404 page is displayed

### Story 8.11: Issues and PRs from Nostr Events on Relay

As a **developer**,
I want to view issues, pull requests, and comments in the web UI,
So that I can follow project discussions sourced from Nostr events without needing a Nostr client.

**Dependencies:** Story 8.7 (layout must exist), Story 8.1 (repositories must exist)

**Acceptance Criteria:**

**Given** a repository page with the issues tab (`/{owner}/{repo}/issues`)
**When** I view the issues list
**Then** the Rig queries the connected relay for kind:1621 events tagged with this repository's event ID
**And** issues are rendered with title, content, author pubkey (with profile enrichment), and creation date
**And** issue replies (kind:1622 events referencing the issue) are shown as comments

**Given** a repository page with the pull requests tab (`/{owner}/{repo}/pulls`)
**When** I view the PR list
**Then** the Rig queries the relay for kind:1617 (Patch) events tagged with this repository
**And** PRs are rendered with title, patch summary, author pubkey, status (from latest kind:1630-1633 event), and creation date

**Given** a specific issue or PR detail page
**When** I view the discussion thread
**Then** kind:1622 (Comment) events referencing the issue/PR are rendered chronologically
**And** each comment shows author pubkey (with profile enrichment), content, and timestamp

**Given** the relay subscription
**When** new NIP-34 events appear on the relay for a repository
**Then** the Rig caches recent events locally for fast page rendering
**And** the cache is refreshed on page load (or via WebSocket subscription for real-time updates)

**Given** any issue/PR/comment page
**When** a visitor wants to contribute
**Then** a banner explains that participation requires an ILP/Nostr client
**And** includes a link to documentation on submitting NIP-34 events via `@toon-protocol/client`

### Story 8.12: Publish @toon-protocol/rig Package

As a **network operator**,
I want to `npm install @toon-protocol/rig` and deploy a TypeScript git forge alongside my relay,
So that I can add git collaboration to my TOON node with a single command.

**Dependencies:** Stories 8.1-8.11 (all Rig functionality must be complete)

**Acceptance Criteria:**

**Given** the `@toon-protocol/rig` package
**When** I inspect `package.json`
**Then** it depends on `@toon-protocol/sdk`, `@toon-protocol/core` (for NIP-34 types, GitOperations), `eta` (template engine), `express` (HTTP server)
**And** it has `"type": "module"` with TypeScript strict mode
**And** it does NOT depend on Go, Forgejo, or any external database

**Given** the package entry point
**When** I import from `@toon-protocol/rig`
**Then** it exports a `startRig(config)` function and a `RigConfig` type
**And** config accepts: `mnemonic` (or `secretKey`), `repoDir` (git repo storage path), `httpPort` (web UI port), `relayUrl` (for event queries), `knownPeers`, `settlementConfig`, and optional overrides

**Given** a minimal configuration
**When** I call `startRig({ mnemonic: '...', relayUrl: 'ws://localhost:7100' })`
**Then** a Rig node starts with sensible defaults (httpPort 3000, repoDir ./repos)
**And** NIP-34 handlers are registered for all supported kinds
**And** the web UI starts serving on the configured port
**And** bootstrap runs and the Rig begins accepting ILP packets

**Given** the package includes a CLI entrypoint
**When** I run `npx @toon-protocol/rig --mnemonic "..." --relay-url "ws://localhost:7100"`
**Then** a Rig node starts with environment variable and CLI flag configuration
**And** a Docker image is also published for container deployments

**Given** the package is built
**When** published to npm with `--access public`
**Then** it is available as `@toon-protocol/rig` with correct ESM exports and TypeScript declarations
