---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - docs/prd/2-requirements.md
  - docs/architecture/crosstown-service-protocol.md
  - docs/architecture/5-components.md
  - docs/architecture/7-core-workflows.md
  - docs/architecture/12-coding-standards.md
  - docs/architecture/13-test-strategy-and-standards.md
  - docs/ILP-GATED-RELAY.md
  - packages/core/src/compose.ts
---

# Crosstown SDK - Epic Breakdown

## Overview

This document provides the epic and story breakdown for `@crosstown/sdk`, decomposing the requirements from the PRD, Architecture, and the Crosstown Service Protocol spec into implementable stories. The SDK is a TOON-native, ILP-gated service node framework with unified secp256k1 identity (Nostr + EVM). Developers build ILP-gated services by registering kind-based handlers that receive raw TOON for direct LLM consumption, with optional structured decode for code-based handlers.

> **Scope Note:** This document supersedes `docs/prd/` (v3.0, 2026-02-17) as the requirements baseline for the SDK phase. The old PRD's FR1-FR66 covered a broader scope (17 epics including agent runtime, Gas Town integration, NIP adoption roadmap) that no longer reflects the current project direction. The Requirements Inventory below defines the authoritative FR set for implementation.

## Requirements Inventory

### Functional Requirements

**TOON Codec Prerequisite (derived from Architecture Decision 1)**

- FR-SDK-0: The TOON encoder, decoder, and shallow parser SHALL be available in `@crosstown/core` to avoid circular dependencies and enable SDK, BLS, and relay packages to share a single codec location

**SDK Core (derived from Crosstown Service Protocol + existing FR27-FR30)**

- FR-SDK-1: The SDK SHALL provide a `createNode()` function that composes an embedded `ConnectorNode` with a handler registry, bootstrap service, and relay monitor into a single lifecycle-managed object
- FR-SDK-2: The SDK SHALL provide a handler registry with `.on(kind, handler)` and `.onDefault(handler)` methods for routing events by kind to developer-provided handler functions
- FR-SDK-3: The SDK SHALL provide TOON-native data handling: shallow TOON parse for routing metadata (kind, pubkey), raw TOON passthrough to handlers for direct LLM consumption, and optional lazy decode to structured objects for code-based handlers
- FR-SDK-4: The SDK SHALL verify Nostr event signatures (Schnorr) by default before invoking developer handlers, rejecting forged events with ILP error codes; verification is skippable in dev mode
- FR-SDK-5: The SDK SHALL provide configurable pricing validation (per-byte and per-kind) with self-write bypass for the node's own pubkey
- FR-SDK-6: The SDK SHALL bridge the handler registry to the connector's `PaymentHandler` interface, using `isTransit` to distinguish fire-and-forget (intermediate hop) from await (final hop) semantics
- FR-SDK-7: The SDK SHALL provide a `HandlerContext` object to handlers with `toon` (raw TOON string), `kind`, `pubkey`, `amount`, `destination`, `decode()` (lazy), `accept(data?)` and `reject(code, message)` methods
- FR-SDK-8: The SDK SHALL expose the embedded connector's direct method API for peer management (`registerPeer`, `removePeer`), packet sending (`sendPacket`), and channel operations (`openChannel`, `getChannelState`)
- FR-SDK-9: The SDK SHALL integrate with `BootstrapService` and `RelayMonitor` from `@crosstown/core` for peer discovery and network join
- FR-SDK-10: The SDK SHALL manage complete node lifecycle via `start()` and `stop()` methods (connector start, bootstrap, relay monitor start; graceful shutdown)
- FR-SDK-11: The SDK SHALL use `@crosstown/connector` in embedded mode (`deploymentMode: 'embedded'`) with `setPacketHandler()` for in-process packet delivery
- FR-SDK-12: The SDK SHALL support a dev mode that skips signature verification, bypasses pricing, and logs all incoming packets for local development
- FR-SDK-13: The SDK SHALL be published as `@crosstown/sdk` on npm with public access
- FR-SDK-NEW-1: The SDK SHALL provide unified identity from BIP-39 seed phrases: `generateMnemonic()`, `fromMnemonic(words, options?)`, and `fromSecretKey(key)` deriving both Nostr pubkey (x-only Schnorr) and EVM address (Keccak-256) from a single secp256k1 key via NIP-06 derivation path `m/44'/1237'/0'/0/{accountIndex}`

**Validation & Proof (derived from existing codebase)**

- FR-SDK-14: The current relay BLS logic in `docker/src/entrypoint.ts` SHALL be reimplementable using the SDK's handler registry, proving SDK completeness
- FR-SDK-15: All existing E2E tests SHALL pass when running against a relay built with the SDK

**Cleanup (derived from Crosstown Service Protocol)**

- FR-SDK-16: The `packages/git-proxy/` package SHALL be removed as it is superseded by the Crosstown Service Protocol pattern

**NIP-34 Git Forge — The Rig (derived from Crosstown Service Protocol + NIP-34)**

- FR-NIP34-1: The Rig SHALL be an SDK-based service node that receives NIP-34 git events (kinds 30617, 1617, 1618, 1619, 1621, 1622, 1630-1633) via ILP packets and executes git operations via TypeScript-native git HTTP backend
- FR-NIP34-2: The Rig SHALL use Nostr pubkeys as native identity for all git operations — no separate user database, no identity mapping layer; pubkeys ARE the usernames
- FR-NIP34-3: The Rig SHALL serve a read-only web UI (TypeScript port of Forgejo's code browsing/diff templates converted from Go HTML to EJS/Eta) with issues/PRs/comments sourced from Nostr events on the relay
- FR-NIP34-4: The Rig SHALL process NIP-34 status events (kinds 1630-1633) for PR lifecycle management with pubkey-based permission checks
- FR-NIP34-5: The Rig SHALL be a single-process TypeScript service deployable via `npx @crosstown/rig` with no Go, no Docker, and no external database dependencies
- FR-NIP34-6: The Rig SHALL be published as `@crosstown/rig` on npm with a `startRig(config)` function, CLI entrypoint, and Docker image

**Relay Node Publishing (derived from Epic 2)**

- FR-RELAY-1: The SDK-based relay SHALL be published as `@crosstown/town` on npm with a `startTown(config)` function, CLI entrypoint, and Docker image

### NonFunctional Requirements

- NFR-SDK-1: The SDK SHALL be written in TypeScript with strict mode enabled, following existing coding standards (ESLint 9.x flat config, Prettier 3.x)
- NFR-SDK-2: The SDK SHALL support Node.js 24.x via ESM
- NFR-SDK-3: The SDK SHALL achieve >80% line coverage for public APIs
- NFR-SDK-4: Developer integration time for creating a basic custom service SHALL be under 30 minutes (10 lines of code for a minimal node)
- NFR-SDK-5: The SDK SHALL use structural typing for the `ConnectorNode` interface to keep `@crosstown/connector` as an optional peer dependency
- NFR-SDK-6: Unit tests SHALL use mocked connectors with no live relay or blockchain dependencies
- NFR-SDK-7: The SDK package size SHALL be minimal, depending only on `@crosstown/core` (includes TOON codec per FR-SDK-0), `nostr-tools`, `@scure/bip39`, `@scure/bip32`

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

**From Architecture - Crosstown Service Protocol:**

- Service contract is `POST /handle-packet` with `HandlePacketRequest`/`HandlePacketResponse`
- These types already exist in `packages/core/src/compose.ts`
- The connector's `PaymentHandler` auto-computes fulfillment (SDK doesn't need to SHA-256)
- `isTransit` flag on `PaymentRequest` signals fire-and-forget vs await semantics
- Nostr pubkeys are universal identity (no service-specific auth)
- TOON is the AI-native wire format — handlers receive raw TOON for direct LLM consumption

**From Connector Package (@crosstown/connector@1.4.0):**

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

FR-SDK-0: Epic 1, Story 1.0 - TOON codec extraction to @crosstown/core
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
FR-SDK-13: Epic 1, Story 1.11 - npm publish as @crosstown/sdk
FR-SDK-NEW-1: Epic 1, Story 1.1 - Unified identity from seed phrase
FR-SDK-14: Epic 2, Story 2.1 - Relay reimplementation using SDK
FR-SDK-15: Epic 2, Story 2.3 - E2E test validation
FR-SDK-16: Epic 2, Story 2.4 - Remove packages/git-proxy
FR-RELAY-1: Epic 2, Story 2.5 - Publish @crosstown/town package
FR-NIP34-1: Epic 3, Stories 3.1-3.4 - Git HTTP backend and NIP-34 handlers (split across repo, patch, issue/comment, HTTP backend)
FR-NIP34-2: Epic 3, Story 3.5 - Nostr pubkey-native git identity
FR-NIP34-3: Epic 3, Stories 3.7-3.10 - Read-only code browsing web UI (split across layout+repo list, tree+blob, commits+diff, blame)
FR-NIP34-4: Epic 3, Story 3.6 - PR lifecycle via NIP-34 status events
FR-NIP34-5: Epic 3, Story 3.11 - Issues/PRs from Nostr events on relay
FR-NIP34-6: Epic 3, Story 3.12 - Publish @crosstown/rig package

## Epic List

### Epic 1: ILP-Gated Service Node SDK

A developer can create a working ILP-gated service node from a 12-word seed phrase in ~10 lines of code. The SDK provides unified secp256k1 identity (Nostr + EVM), TOON-native kind-based event handling with raw TOON passthrough for LLM consumption and lazy decode for code handlers, configurable pricing validation, embedded connector lifecycle management, network discovery, and dev mode. Includes the TOON codec extraction prerequisite. Published as `@crosstown/sdk`.
**FRs covered:** FR-SDK-0, FR-SDK-1, FR-SDK-2, FR-SDK-3, FR-SDK-4, FR-SDK-5, FR-SDK-6, FR-SDK-7, FR-SDK-8, FR-SDK-9, FR-SDK-10, FR-SDK-11, FR-SDK-12, FR-SDK-13, FR-SDK-NEW-1

### Epic 2: Nostr Relay Reference Implementation & SDK Validation

The existing relay BLS is rebuilt using the SDK's handler registry, proving SDK completeness. Adds Nostr-specific handlers (event storage, SPSP handshake) as documented examples of code-based handlers that decode TOON to structured NostrEvent objects. Published as `@crosstown/town` so anyone can `npm install` and run their own relay to join the network. All existing E2E tests pass. Old experimental `packages/git-proxy/` removed.
**FRs covered:** FR-SDK-14, FR-SDK-15, FR-SDK-16, FR-RELAY-1

### Epic 3: The Rig — ILP-Gated TypeScript Git Forge

A TypeScript-native git forge built on the SDK. The Rig is a mechanical port of Forgejo's read-only code browsing UI (Go HTML templates → Eta templates) with a git HTTP backend (via `child_process` git binary). Issues, PRs, and comments are Nostr events stored on the relay — not a database. All write operations (repo creation, patches, issues) require ILP-gated NIP-34 events. Nostr pubkeys are the native identity — no user database, no identity mapping. Published as `@crosstown/rig` so operators can `npx @crosstown/rig` and add git collaboration to their node. No Go dependency, no Docker required. The Rig serves as the second SDK example, demonstrating multi-handler services with git integration and relay-sourced data rendering.
**FRs covered:** FR-NIP34-1, FR-NIP34-2, FR-NIP34-3, FR-NIP34-4, FR-NIP34-5, FR-NIP34-6
**Stories:** 12 (decomposed for proper sizing)
**Reference:** [forgejo](https://codeberg.org/forgejo/forgejo) (Go, GPL-3.0) — source for mechanical template port

---

## Epic 1: ILP-Gated Service Node SDK

A developer can create a working ILP-gated service node from a 12-word seed phrase in ~10 lines of code. The SDK provides unified secp256k1 identity (Nostr + EVM), TOON-native kind-based event handling with raw TOON passthrough for LLM consumption and lazy decode for code handlers, configurable pricing validation, embedded connector lifecycle management, network discovery, and dev mode.

### Story 1.0: Extract TOON Codec to @crosstown/core

As a **SDK developer**,
I want the TOON encoder, decoder, and shallow parser to live in `@crosstown/core`,
So that the SDK can access TOON functionality without depending on `@crosstown/bls` or `@crosstown/relay`, avoiding circular dependencies.

**Dependencies:** None (prerequisite for all other Epic 1 stories)

**Acceptance Criteria:**

**Given** the TOON encoder and decoder currently in `@crosstown/bls`
**When** I move them to `packages/core/src/toon/`
**Then** `packages/core/src/toon/encoder.ts` contains the Nostr event → TOON bytes encoder
**And** `packages/core/src/toon/decoder.ts` contains the TOON bytes → Nostr event decoder
**And** `packages/core/src/toon/index.ts` re-exports encoder, decoder, and shallow-parse

**Given** the need for routing metadata extraction without full decode
**When** I create `packages/core/src/toon/shallow-parse.ts`
**Then** it exports a `shallowParseToon(data: Uint8Array): ToonRoutingMeta` function
**And** `ToonRoutingMeta` contains `{ kind: number, pubkey: string, id: string, sig: string, rawBytes: Uint8Array }`
**And** the shallow parser extracts only these fields without performing a full TOON decode

**Given** `@crosstown/bls` currently imports TOON codec locally
**When** I update its imports to use `@crosstown/core`
**Then** all existing BLS tests pass with the updated import paths
**And** the BLS package no longer contains its own copy of the codec

**Given** `@crosstown/relay` may reference the TOON codec
**When** I update any relay imports to use `@crosstown/core`
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
So that my service participates in the Crosstown mesh without manual peer configuration.

**Dependencies:** None (uses existing @crosstown/core BootstrapService and RelayMonitor)

**Acceptance Criteria:**

**Given** a node config with `knownPeers` and/or `ardriveEnabled: true`
**When** `node.start()` is called
**Then** `BootstrapService` runs layered discovery (genesis peers, ArDrive, env var peers)
**And** discovered peers are registered with the connector
**And** SPSP handshakes are performed with each peer

**Given** a started node
**When** a new kind:10032 (ILP Peer Info) event appears on the monitored relay
**Then** the `RelayMonitor` detects it and initiates peering with the new peer

**Given** a node config with `settlementNegotiationConfig`
**When** bootstrap performs SPSP handshakes
**Then** payment channels are opened where settlement chains intersect
**And** `StartResult.channelCount` reflects opened channels

**Given** a started node
**When** I call `node.peerWith(pubkey)`
**Then** the node initiates peering with the specified pubkey (register + SPSP handshake)

**Given** bootstrap or relay monitor events
**When** I call `node.on('bootstrap', listener)` before `start()`
**Then** I receive lifecycle events (phase changes, peer registered, channel opened, etc.)

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
I want to `npm install @crosstown/sdk` and import a clean public API,
So that I can start building immediately with TypeScript types and documentation.

**Dependencies:** Stories 1.0-1.10 (all SDK code must be complete before publish)

**Acceptance Criteria:**

**Given** the `@crosstown/sdk` package
**When** I inspect `package.json`
**Then** it has `"type": "module"`, TypeScript strict mode, ESLint 9.x flat config, Prettier 3.x
**And** peer dependency on `@crosstown/connector` (optional)
**And** dependencies on `@crosstown/core`, `@crosstown/relay` (for TOON codec), `nostr-tools`, `@scure/bip39`, `@scure/bip32`

**Given** the package entry point `index.ts`
**When** I import from `@crosstown/sdk`
**Then** all public APIs are exported: `createNode`, `fromMnemonic`, `fromSecretKey`, `generateMnemonic`, `HandlerContext`, `NodeConfig`, `ServiceNode`, type definitions

**Given** the package is built
**When** published to npm with `--access public`
**Then** it is available as `@crosstown/sdk` with correct ESM exports and TypeScript declarations

---

## Epic 2: Nostr Relay Reference Implementation & SDK Validation

The existing relay BLS is rebuilt using the SDK's handler registry, proving SDK completeness. Adds Nostr-specific handlers (event storage, SPSP handshake) as documented examples of code-based handlers that decode TOON to structured NostrEvent objects. Serves as the reference implementation for other developers building their own services. All existing E2E tests pass. Published as `@crosstown/town` so anyone can `npm install` and run their own relay to join the network. Old experimental `packages/git-proxy/` removed.

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

### Story 2.2: SPSP Handshake Handler

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
**Then** it demonstrates: seed phrase identity, kind-based handler registration, `ctx.decode()` for code handlers, SPSP handling, settlement negotiation, and lifecycle management
**And** inline comments explain each SDK pattern

**Given** the example code
**When** reviewed against the SDK's public API
**Then** every major SDK feature is exercised (identity, handlers, pricing, bootstrap, channels, dev mode)

### Story 2.5: Publish @crosstown/town Package

As a **network operator**,
I want to `npm install @crosstown/town` and deploy a relay with minimal configuration,
So that I can join the Crosstown network by running a single command with my seed phrase.

**Dependencies:** Stories 2.1, 2.2, 2.3 (relay handlers and E2E validation must pass)

**Acceptance Criteria:**

**Given** the `@crosstown/town` package
**When** I inspect `package.json`
**Then** it depends on `@crosstown/sdk`, `@crosstown/relay` (for EventStore + TOON codec), and `@crosstown/core`
**And** it has `"type": "module"` with TypeScript strict mode

**Given** the package entry point
**When** I import from `@crosstown/town`
**Then** it exports a `startTown(config)` function and a `TownConfig` type
**And** config accepts: `mnemonic` (or `secretKey`), `relayPort`, `blsPort`, `knownPeers`, `settlementConfig`, and optional overrides

**Given** a minimal configuration with just a mnemonic
**When** I call `startTown({ mnemonic: '...' })`
**Then** a relay node starts with sensible defaults (ports 7100/3100, default pricing, ArDrive discovery enabled)
**And** bootstrap runs, peers are discovered, and the relay is accepting events

**Given** the package includes a CLI entrypoint
**When** I run `npx @crosstown/town --mnemonic "..."` (or `--secret-key`)
**Then** a relay node starts with environment variable and CLI flag configuration
**And** Docker image is also published for container deployments

**Given** the package is built
**When** published to npm with `--access public`
**Then** it is available as `@crosstown/town` with correct ESM exports and TypeScript declarations

---

## Epic 3: The Rig — ILP-Gated TypeScript Git Forge

A TypeScript-native git forge built on the SDK. The Rig is a mechanical port of Forgejo's read-only code browsing UI (Go HTML templates → Eta templates) with a git HTTP backend (via `child_process` git binary). Issues, PRs, and comments are Nostr events stored on the relay — not a database. All write operations (repo creation, patches, issues) require ILP-gated NIP-34 events. Nostr pubkeys are the native identity — no user database, no identity mapping. The Rig serves as the second SDK example, demonstrating multi-handler services with git integration and relay-sourced data rendering.

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

### Story 3.1: SDK Node Setup and Repository Creation Handler

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

### Story 3.2: Patch Handler

As a **contributor**,
I want to submit code patches as kind:1617 events via ILP,
So that my patches are applied to the repository through the standard NIP-34 workflow.

**Dependencies:** Story 3.1 (repositories must exist)

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

### Story 3.3: Issue and Comment Handlers

As a **contributor**,
I want to submit issues (kind:1621) and comments (kind:1622) via ILP,
So that my discussions are acknowledged by the Rig and stored on the relay for web UI rendering.

**Dependencies:** Story 3.1 (repositories must exist)

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

### Story 3.4: Git HTTP Backend for Clone and Fetch

As a **developer**,
I want to clone and fetch repositories hosted on the Rig via standard git HTTP protocol,
So that I can work with Rig repositories using any standard git client.

**Dependencies:** Story 3.1 (repositories must exist)

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

### Story 3.5: Nostr Pubkey-Native Git Identity

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

### Story 3.6: NIP-34 Status Events and PR Lifecycle

As a **contributor**,
I want my pull request status tracked through NIP-34 status events (kinds 1630-1633),
So that the PR lifecycle (open, applied/merged, closed, draft) is managed through Nostr events with ILP payment.

**Dependencies:** Stories 3.1, 3.2 (repositories and patches must exist)

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

### Story 3.7: Layout and Repository List Page

As a **developer**,
I want to see a list of all repositories hosted on the Rig through a web UI,
So that I can discover and navigate to projects without needing a specialized client.

**Dependencies:** Story 3.1 (repositories must exist), Story 3.5 (pubkey display)

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

### Story 3.8: File Tree and Blob View

As a **developer**,
I want to browse a repository's file tree and view individual file contents,
So that I can explore the codebase through the web UI.

**Dependencies:** Story 3.7 (layout must exist)

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

### Story 3.9: Commit Log and Diff View

As a **developer**,
I want to view commit history and individual commit diffs,
So that I can understand the change history of a repository.

**Dependencies:** Story 3.7 (layout must exist)

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

### Story 3.10: Blame View

As a **developer**,
I want to view per-line blame information for any file,
So that I can see who last modified each line and when.

**Dependencies:** Story 3.7 (layout must exist)

**Acceptance Criteria:**

**Given** a blame view (`/{owner}/{repo}/blame/{ref}/{path}`)
**When** I view a file's blame
**Then** each line shows the commit hash, author pubkey, and date of last modification
**And** the blame data is generated via `git blame` (child_process)

**Given** a file that does not exist at the specified ref
**When** I navigate to its blame view
**Then** a 404 page is displayed

### Story 3.11: Issues and PRs from Nostr Events on Relay

As a **developer**,
I want to view issues, pull requests, and comments in the web UI,
So that I can follow project discussions sourced from Nostr events without needing a Nostr client.

**Dependencies:** Story 3.7 (layout must exist), Story 3.1 (repositories must exist)

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
**And** includes a link to documentation on submitting NIP-34 events via `@crosstown/client`

### Story 3.12: Publish @crosstown/rig Package

As a **network operator**,
I want to `npm install @crosstown/rig` and deploy a TypeScript git forge alongside my relay,
So that I can add git collaboration to my Crosstown node with a single command.

**Dependencies:** Stories 3.1-3.11 (all Rig functionality must be complete)

**Acceptance Criteria:**

**Given** the `@crosstown/rig` package
**When** I inspect `package.json`
**Then** it depends on `@crosstown/sdk`, `@crosstown/core` (for NIP-34 types, GitOperations), `eta` (template engine), `express` (HTTP server)
**And** it has `"type": "module"` with TypeScript strict mode
**And** it does NOT depend on Go, Forgejo, or any external database

**Given** the package entry point
**When** I import from `@crosstown/rig`
**Then** it exports a `startRig(config)` function and a `RigConfig` type
**And** config accepts: `mnemonic` (or `secretKey`), `repoDir` (git repo storage path), `httpPort` (web UI port), `relayUrl` (for event queries), `knownPeers`, `settlementConfig`, and optional overrides

**Given** a minimal configuration
**When** I call `startRig({ mnemonic: '...', relayUrl: 'ws://localhost:7100' })`
**Then** a Rig node starts with sensible defaults (httpPort 3000, repoDir ./repos)
**And** NIP-34 handlers are registered for all supported kinds
**And** the web UI starts serving on the configured port
**And** bootstrap runs and the Rig begins accepting ILP packets

**Given** the package includes a CLI entrypoint
**When** I run `npx @crosstown/rig --mnemonic "..." --relay-url "ws://localhost:7100"`
**Then** a Rig node starts with environment variable and CLI flag configuration
**And** a Docker image is also published for container deployments

**Given** the package is built
**When** published to npm with `--access public`
**Then** it is available as `@crosstown/rig` with correct ESM exports and TypeScript declarations
