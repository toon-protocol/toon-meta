---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-06'
updatedAt: '2026-03-06'
inputDocuments:
  - docs/prd/index.md
  - docs/prd/1-goals-and-background-context.md
  - docs/prd/2-requirements.md
  - docs/prd/3-technical-assumptions.md
  - docs/prd/6-checklist-results-report.md
  - docs/prd/7-next-steps.md
  - docs/brief.md
  - docs/architecture/index.md
  - docs/architecture/1-introduction.md
  - docs/architecture/2-high-level-architecture.md
  - docs/architecture/3-tech-stack.md
  - docs/architecture/4-data-models.md
  - docs/architecture/5-components.md
  - docs/architecture/6-external-apis.md
  - docs/architecture/7-core-workflows.md
  - docs/architecture/8-database-schema.md
  - docs/architecture/9-source-tree.md
  - docs/architecture/10-infrastructure-and-deployment.md
  - docs/architecture/11-error-handling-strategy.md
  - docs/architecture/12-coding-standards.md
  - docs/architecture/13-test-strategy-and-standards.md
  - docs/architecture/14-security.md
  - docs/architecture/toon-service-protocol.md
  - _bmad-output/project-context.md
  - _bmad-output/planning-artifacts/epics.md
workflowType: 'architecture'
project_name: 'toon'
user_name: 'Jonathan'
date: '2026-03-03'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The project introduces 36 FRs organized across five domains:

- **TOON Codec Prerequisite (FR-SDK-0, 1 FR):** Extract TOON encoder, decoder, and shallow parser to @toon-protocol/core
- **SDK Core (FR-SDK-1 to FR-SDK-NEW-1, 14 FRs):** Node composition, handler registry, TOON-native context, signature verification, pricing validation, PaymentHandler bridge, connector lifecycle, network discovery, dev mode, unified identity
- **NIP-34 Git Forge (FR-NIP34-1 to FR-NIP34-6, 6 FRs):** Git HTTP backend, pubkey-native identity, read-only web UI, PR lifecycle, relay-sourced issues/PRs, package publishing
- **Relay Publishing (FR-RELAY-1, 1 FR):** Publish @toon-protocol/town package
- **Production Protocol Economics (FR-PROD-1 to FR-PROD-6, 6 FRs):** USDC token migration, multi-environment chain config, x402 /publish endpoint, seed relay discovery, service discovery events, enriched /health
- **Marlin TEE Deployment (FR-TEE-1 to FR-TEE-6, 6 FRs):** Oyster CVM packaging, TEE attestation events, attestation-aware peering, Nautilus KMS identity, Nix reproducible builds, attestation-first bootstrap

These build on the existing 66 FRs from the PRD (Epics 1-17), with the SDK replacing the manual composition patterns from Epics 5-10.

**Non-Functional Requirements:**
7 new NFRs (NFR-SDK-1 to NFR-SDK-7) supplement the existing 15:

- TypeScript strict mode, Node.js 24.x, ESM (consistent with existing)
- > 80% line coverage for public APIs (consistent)
- Developer integration time <30 minutes / ~10 lines of code (new — defines SDK ergonomics)
- Structural typing for ConnectorNode (consistent pattern)
- Minimal package dependencies (new — constrains SDK surface)
- Mocked tests with no live dependencies (consistent)

**Scale & Complexity:**

- Primary domain: Backend protocol SDK with web UI rendering
- Complexity level: High
- Estimated architectural components: 8 packages (sdk, town, rig, core, bls, relay, client, connector)
- Total stories: 36+ across 5 epics (Epic 1: 12, Epic 2: 5, Epic 3: 6, Epic 4: 6, Epic 5: 12)
- Validation benchmark: SDK-based relay entrypoint targets <100 lines of handler logic vs ~300 lines in current `docker/src/entrypoint.ts`

### Technical Constraints & Dependencies

- **Must remain E2E compatible:** SDK-based relay must pass all existing genesis-bootstrap-with-channels tests
- **Connector structural typing:** SDK must NOT import `@toon-protocol/connector` directly. It accepts a `ConnectorNodeLike` at construction time, continuing the existing `*Like` interface pattern. This keeps the connector as an optional peer dependency.
- **TOON codec dependency:** The epics doc lists `@toon-protocol/relay` as an SDK dependency "for TOON codec" — this is architecturally incorrect. The TOON codec lives in `@toon-protocol/bls`. SDK depending on relay would create circular dependencies when `@toon-protocol/town` (built on SDK) provides relay functionality. **Resolution: SDK depends on `@toon-protocol/bls` for TOON codec, or the codec is extracted to `@toon-protocol/core` or a standalone package.**
- **System dependency for Rig:** `git` binary must be in PATH (child_process spawning)
- **No Go dependency:** Rig is pure TypeScript — mechanical template port from Forgejo's Go HTML
- **Crypto libraries:** @scure/bip39, @scure/bip32 for seed phrase identity derivation
- **Template engine:** EJS or Eta for Rig web UI rendering
- **HTTP framework:** Express or Fastify for Rig HTTP endpoints
- **Existing patterns preserved:** TOON DI via config callbacks, structural `*Like` types, ESM with .js extensions

### Cross-Cutting Concerns Identified

1. **Unified Identity:** Single secp256k1 key → Nostr pubkey + EVM address, derived from BIP-39 mnemonic via NIP-06 path. Affects SDK, Town, Rig, and all settlement operations.
2. **TOON Pipeline (correctness-critical ordering):** Raw TOON → shallow extract `{kind, pubkey, id, sig}` → Schnorr verify → route to handler → optional lazy `decode()`. This ordering is a correctness requirement, not just a performance optimization. Signature verification must operate on shallow-parsed fields from the serialized event bytes — decoding first and then verifying would trust the decode.
3. **Verification Pipeline:** Schnorr signature verification before handler dispatch, with dev mode bypass. Must work with shallow TOON parse data only (`id`, `pubkey`, `sig` + serialized event bytes).
4. **Pricing Abstraction:** Per-byte base + per-kind overrides + self-write bypass. SDK internalizes what BLS currently does manually.
5. **Transit Semantics:** `isTransit` flag determines fire-and-forget (intermediate hop) vs await (final hop) behavior in the PaymentHandler bridge.
6. **Dev Mode:** Cross-cutting toggle that skips verification, bypasses pricing, and enables verbose logging for local development.
7. **Lifecycle Management:** `start()`/`stop()` must coordinate connector, bootstrap, relay monitor, and handler teardown.
8. **Package Layering:** sdk depends on core+bls; town depends on sdk; rig depends on sdk+core. Circular dependencies must be avoided. The relay package remains a peer of sdk, not a dependency.

### Architectural Trade-offs Identified

1. **Rig relay-sourced data (dependency inversion):** The Rig has no local issue/PR database — it queries the relay for NIP-34 events at render time. This simplifies the Rig dramatically (no database migrations, no sync logic) but couples Rig issue/PR availability to relay availability. This is an explicit trade-off that should be acknowledged in the Rig's architecture.

### SDK Pipeline Test Strategy

The SDK introduces pipeline stages between connector and business logic. Each stage needs targeted testing:

| Level       | Scope                                                                           | What It Catches             |
| ----------- | ------------------------------------------------------------------------------- | --------------------------- |
| Unit        | HandlerRegistry routing (kind match, default fallback, F00 on no match)         | Dispatch correctness        |
| Unit        | Signature verification pipeline (valid/invalid/devMode skip)                    | Auth bypass bugs            |
| Unit        | Pricing validation (per-byte, per-kind, self-write bypass, F04 rejection)       | Payment logic errors        |
| Unit        | PaymentHandler bridge (isTransit fire-and-forget vs await)                      | Flow control bugs           |
| Integration | Full pipeline: TOON → shallow parse → verify → price → dispatch → accept/reject | Stage interaction bugs      |
| E2E         | Existing genesis-bootstrap test against SDK-built relay                         | Regression from replacement |

Lower test levels first — the E2E test catches regressions but unit tests catch them faster and tell you _where_.

## Project Context Analysis — Epics 3 & 4 Update (2026-03-06)

### New Requirements Overview

**New Functional Requirements (12 FRs):**

Epic 3 (Production Protocol Economics) introduces 6 FRs:
- FR-PROD-1: USDC token migration — replace AGENT dev token with mock USDC on Anvil, production USDC on Arbitrum One
- FR-PROD-2: Multi-environment chain configuration — Anvil / Arbitrum Sepolia / Arbitrum One with env var overrides
- FR-PROD-3: x402 /publish endpoint — HTTP-native payment rail, node acts as x402 facilitator, constructs ILP PREPARE packets
- FR-PROD-4: Seed relay discovery — kind:10036 events on public Nostr relays, replaces genesis hub-and-spoke
- FR-PROD-5: kind:10035 service discovery — machine-readable pricing, capabilities, and endpoint advertisement
- FR-PROD-6: Enriched /health endpoint — comprehensive node status for monitoring and programmatic peering

Epic 4 (Marlin TEE Deployment) introduces 6 FRs:
- FR-TEE-1: Oyster CVM packaging — Docker image adapted for Marlin Oyster confidential computing
- FR-TEE-2: TEE attestation events — kind:10033 with PCR values, enclave image hash, attestation doc
- FR-TEE-3: Attestation-aware peering — BootstrapService verifies kind:10033, prefers attested peers
- FR-TEE-4: Nautilus KMS identity — persistent enclave-bound keypairs, identity tied to code integrity
- FR-TEE-5: Nix reproducible builds — deterministic PCR values, CI reproducibility verification
- FR-TEE-6: Attestation-first seed relay bootstrap — kind:10033 verification integrated into seed relay flow

**New Non-Functional Requirements:**
- All user-facing payments in USDC (no custom tokens)
- Autonomous agent readiness: deterministic bootstrap, programmatic deployment, self-describing economics
- TEE attestation verification adds latency budget to bootstrap flow
- Nix build determinism constrains Docker image construction

**Updated Scale & Complexity:**
- Total epics: 5 (was 3)
- Total stories: 36+ (24 existing + 6 Epic 3 + 6 Epic 4)
- Total FRs: 36 (24 existing + 12 new)
- New domains: payment protocol economics, TEE/confidential computing, multi-chain EVM

### New Technical Constraints & Dependencies

**Epic 3 Constraints:**
- EIP-3009 (transferWithAuthorization) support for gasless USDC transfers — requires USDC contract compatibility
- Arbitrum One RPC access for on-chain settlement
- SPSP destination query for multi-hop x402 pricing
- Backward compatibility: genesis-based discovery must remain functional for dev mode
- x402 disabled by default (opt-in per node via config)

**Epic 4 Constraints:**
- Marlin Oyster CVM runtime environment (AWS Nitro Enclaves)
- Nautilus KMS SDK for enclave-bound key management
- Nix package manager for reproducible Docker builds
- PCR measurement verification requires known-good hash registry
- Attestation document format defined by AWS Nitro Enclave specification

**New External Dependencies:**

| Dependency | Package/Context | Purpose |
|------------|----------------|---------|
| USDC contract (Arbitrum) | Epic 3 | Production payment token |
| EIP-3009 | Epic 3, Story 3.3 | Gasless USDC authorization for x402 |
| Marlin Oyster SDK | Epic 4, Story 4.1 | CVM deployment tooling |
| Nautilus KMS | Epic 4, Story 4.4 | Enclave-bound key management |
| Nix | Epic 4, Story 4.5 | Reproducible Docker builds |

### New Cross-Cutting Concerns

9. **Multi-Chain Configuration:** Chain-specific contract addresses, RPC URLs, and token configs must thread through SDK, connector, and node layers. Affects NodeConfig, settlement, and pricing.
10. **x402 Facilitation:** The TOON node becomes an HTTP-to-ILP bridge. The `/publish` endpoint must query destination SPSP, construct ILP PREPARE with TOON data, route through connector, and return FULFILL results. Touches entrypoint, connector integration, and pricing.
11. **Seed Relay Discovery:** kind:10036 events replace genesis-based bootstrap. Affects BootstrapService, node startup, and network topology assumptions.
12. **TEE Attestation Lifecycle:** kind:10033 events must be published on startup, refreshed periodically, and verified by peers during bootstrap. Affects identity, bootstrap, and peering logic.
13. **Autonomous Agent Readiness:** Three invariants (deterministic bootstrap, programmatic deployment, self-describing economics) affect every public interface — `/health`, kind:10035, kind:10036, and node startup behavior.

## Starter Template Evaluation

### Primary Technology Domain

Backend protocol SDK (TypeScript/Node.js monorepo) — existing project.

### Starter Options Considered

**Decision: No starter template.** This is an existing project with established infrastructure. The architecture document (v0.1, 2026-02-05) established "no starter template" as a deliberate decision due to the specialized Nostr + ILP requirements.

### Existing Project Foundation

**Rationale:** The monorepo already has 7+ packages with consistent tooling. New packages (sdk, town, rig) follow the same patterns. No external starter provides value for this use case.

**Architectural Decisions Already Established:**

**Language & Runtime:**

- TypeScript ^5.3 (strict: true, noUncheckedIndexedAccess, noImplicitOverride)
- Node.js 24.x, ESM-only ("type": "module")
- moduleResolution: "bundler" for tsup/esbuild compatibility

**Build Tooling:**

- tsup ^8.0 for ESM library bundling
- pnpm workspaces for monorepo management
- tsconfig.json extending root config per package

**Testing Framework:**

- Vitest ^1.0 with co-located \*.test.ts files
- Integration tests in **integration**/ directories
- E2E tests in packages/client/tests/e2e/
- Mocked SimplePool — no live relay dependencies

**Code Quality:**

- ESLint 9.x (flat config) with typescript-eslint strict + stylistic
- Prettier 3.x (semi, singleQuote, tabWidth 2, trailingComma es5)
- No explicit `any` — use `unknown` with type guards

**Code Organization:**

- packages/\*/src/index.ts exports all public APIs
- PascalCase files for classes, kebab-case for utilities
- Constants in UPPER_SNAKE_CASE
- Structural `*Like` types for cross-package interfaces

**New Package Setup Pattern:**
Each new package (sdk, town, rig) will be initialized with:

1. Directory in packages/
2. package.json with "type": "module", workspace dependencies
3. tsconfig.json extending root
4. tsup.config.ts for ESM build
5. src/index.ts with public API exports

**New Dependencies for SDK Epics:**

| Dependency           | Package | Purpose                               |
| -------------------- | ------- | ------------------------------------- |
| @scure/bip39         | sdk     | BIP-39 mnemonic generation/validation |
| @scure/bip32         | sdk     | BIP-32 HD key derivation              |
| eta (or ejs)         | rig     | Template engine for web UI            |
| express (or fastify) | rig     | HTTP server for web UI + git backend  |

**Note:** Dependency versions should be verified at implementation time. The @scure libraries are from the same author as @noble/curves (used by nostr-tools), ensuring cryptographic consistency.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

1. TOON codec extracted to @toon-protocol/core (unblocks SDK dependency graph)
2. SDK identity module location (unblocks Story 1.1)
3. PaymentHandler bridge pattern with isTransit semantics (unblocks Story 1.6)

**Important Decisions (Shape Architecture):** 4. Rig HTTP framework (Express) 5. Rig template engine (Eta) 6. Git backend approach (child_process + git binary) 7. Rig data strategy (pure relay query + SQLite for repo metadata)

**Deferred Decisions (Post-MVP):**

- Rig event caching layer (if relay latency becomes a UX problem)
- Rig offline mode (if needed)
- Multi-relay redundancy for Rig queries

### Decision 1: TOON Codec Location

| Attribute | Value                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------ |
| Decision  | Extract TOON encoder/decoder to `@toon-protocol/core`                                                |
| Rationale | Avoids circular dependency: SDK → relay → SDK. Core is the shared foundation. Codec is ~100 LOC. |
| Affects   | SDK, BLS, relay (import path change), core (new @toon-format/toon dependency)                    |
| Version   | @toon-format/toon ^1.0 (existing, no change)                                                     |

### Decision 2: Rig HTTP Framework

| Attribute | Value                                                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision  | Express ^5.2                                                                                                                                                                    |
| Rationale | Most mature ecosystem for template rendering, static files, and CGI-style git backend proxying. Eta integration is trivial. Express 5 is now the npm default with LTS timeline. |
| Affects   | Rig package only                                                                                                                                                                |
| Version   | express ^5.2, @types/express (latest)                                                                                                                                           |

### Decision 3: Rig Template Engine

| Attribute | Value                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| Decision  | Eta ^4.5                                                                                                               |
| Rationale | TypeScript-native, faster than EJS, actively maintained, small bundle. Modern replacement for EJS by the same concept. |
| Affects   | Rig web UI rendering                                                                                                   |
| Version   | eta ^4.5                                                                                                               |

### Decision 4: Git Backend Approach

| Attribute  | Value                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision   | `child_process` + system `git` binary                                                                                                             |
| Rationale  | Battle-tested by Forgejo/GitLab/Gitea. Reliable for all git operations (init, am, merge, blame, http-backend). Epics doc specifies this approach. |
| Affects    | Rig package. System requirement: git must be in PATH.                                                                                             |
| Constraint | Rig startup must verify git availability and log version. Exit with clear error if missing.                                                       |

### Decision 5a: Rig Issue/PR Data Source

| Attribute | Value                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Decision  | Pure relay query at render time                                                                                                |
| Rationale | Simplest approach. No local state, no sync logic. Accepts trade-off that Rig issue/PR rendering depends on relay availability. |
| Affects   | Rig web UI pages (issues, PRs, comments)                                                                                       |
| Trade-off | Page load latency coupled to relay. Acknowledged. Can add caching layer later if needed.                                       |

### Decision 5b: Rig Repository Metadata Storage

| Attribute | Value                                                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Decision  | SQLite via better-sqlite3                                                                                                                 |
| Rationale | Consistent with existing BLS pattern. Supports queries (list repos, filter by owner pubkey). Synchronous API fits request/response cycle. |
| Affects   | Rig package                                                                                                                               |
| Version   | better-sqlite3 ^11.0 (existing, no change)                                                                                                |

### Decision 6: Identity Module Location

| Attribute | Value                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| Decision  | Identity functions in `@toon-protocol/sdk`                                                                               |
| Rationale | Identity is an SDK concern per Story 1.1. Town and Rig both depend on SDK, so no access issue. Keeps core unchanged. |
| Affects   | SDK package                                                                                                          |
| Version   | @scure/bip39 ^2.0, @scure/bip32 ^2.0                                                                                 |

### Decision 7: EVM Library (Epic 3+)

| Attribute | Value |
|-----------|-------|
| Decision | [viem](https://viem.sh/) ^2.46 for all new TOON EVM code |
| Rationale | TypeScript-native, tree-shakeable, built-in Arbitrum chain definitions, EIP-712 typed data signing (needed for EIP-3009/x402), and ABI encoding. The standard for new TypeScript EVM projects. |
| Affects | Epic 3 (chain config, x402 settlement, USDC interaction), Epic 4 (attestation contract verification) |
| Version | viem ^2.46 |

**Architectural Debt Note:** The existing `@toon-protocol/connector` uses ethers.js internally. viem is for NEW TOON code only — no migration of connector code. Two EVM libraries coexist in the monorepo. Consolidation deferred until connector is under TOON control. Document and accept this as explicit debt.

### Decision 8: Multi-Chain Configuration Architecture (Epic 3)

| Attribute | Value |
|-----------|-------|
| Decision | Chain presets in `@toon-protocol/core` with per-chain contract registries |
| Rationale | `NodeConfig.chain` selects a preset (`'anvil'`, `'arbitrum-sepolia'`, `'arbitrum-one'`). Each preset bundles RPC URL, chain ID, USDC address, and TokenNetwork address. Env vars (`TOON_CHAIN`, `TOON_RPC_URL`) override for operators. |
| Affects | core (chain presets), SDK (NodeConfig extension), connector (settlement config), town/rig (pass-through) |
| Pattern | Config resolution: env vars > explicit config > chain preset defaults |

**ChainPreset type must include:**
- `chainId`: number (31337, 421614, 42161)
- `rpcUrl`: string
- `usdcAddress`: string (contract address)
- `tokenNetworkAddress`: string (settlement contract)
- `name`: string (display name)

### Decision 9: Node HTTP Server — Dual Protocol on Relay Port (Epic 3)

| Attribute | Value |
|-----------|-------|
| Decision | Express ^5.2 mounted on the same HTTP server as the WebSocket relay — dual-protocol on port 7100 |
| Rationale | The relay's WebSocket server already attaches to an `http.createServer()` instance. Mounting Express on that same server provides `/publish`, `/health`, and SPSP as HTTP routes alongside the WebSocket upgrade. One port per node. Operationally simple, especially critical for Oyster CVM where port mapping is constrained. |
| Affects | Node entrypoint, Epic 3 stories 3.3, 3.6 |
| Port | 7100 (same as relay WebSocket) |

**Endpoint map (single port):**
```
Port 7100:
├── ws:// → Nostr relay (WebSocket upgrade)
├── GET /publish → x402 facilitation (Story 3.3)
├── GET /health → enriched node status (Story 3.6)
└── GET /.well-known/pay → SPSP endpoint (existing)
```

### Decision 10: Mock USDC on Anvil (Epic 3)

| Attribute | Value |
|-----------|-------|
| Decision | Deploy Circle's real FiatTokenV2_2 (USDC implementation) contract on Anvil |
| Rationale | Circle's USDC contract is open source and includes native EIP-3009 (`transferWithAuthorization`) support. Deploying the real implementation on Anvil gives full fidelity for x402 testing with zero custom contract code. The same code that runs on Arbitrum One runs locally. |
| Affects | Contract deployment scripts, faucet (distributes mock USDC), E2E tests |
| Source | [centre-tokens](https://github.com/centrehq/centre-tokens) — Circle's official USDC contracts |
| Note | Production USDC on Arbitrum One already supports EIP-3009 natively — no deployment needed there. |

### Decision 11: Oyster CVM Packaging Approach (Epic 4)

| Attribute | Value |
|-----------|-------|
| Decision | Docker Compose manifest adapted for Oyster CVM runtime, using existing TOON Docker image with embedded ConnectorNode |
| Rationale | Oyster CVM uses `docker-compose.yml` — downloads images at runtime into the enclave. The existing TOON Docker image is the base. `supervisord.conf` orchestrates two processes: **toon** (embedded ConnectorNode + BLS + Relay + Bootstrap via `entrypoint-sdk.js`) and **attestation** server. The connector is EMBEDDED — ConnectorNode runs in-process; no external connector container is needed. |
| Affects | Epic 4, Story 4.1 |
| Dependency | `oyster-cvm` CLI tool for deployment |
| Deferred | Nix reproducible builds (Story 4.5) — specific Nix configuration deferred to Epic 4 start when Marlin SDK version is known |
| Updated | 2026-03-18 — switched from external connector (3-process model) to embedded ConnectorNode (2-process model) |

**Forward Constraint — Dockerfile Determinism:** Nix reproducible builds (Epic 4, Story 4.5) require no non-deterministic build steps. This means: no `apt-get update`, no `npm install` without a lockfile, no `git clone` of moving targets. Apply this constraint from Epic 2 onwards in all Dockerfiles to avoid rewrites.

### Decision 12: Attestation Lifecycle Architecture (Epic 4)

| Attribute | Value |
|-----------|-------|
| Decision | Attestation as a node lifecycle phase — publish kind:10033 on startup, refresh on configurable interval, dual-channel exposure |
| Rationale | Attestation is a trust primitive. It publishes to the TOON relay network AND exposes via the `/health` endpoint. Peers parse kind:10033 during `BootstrapService.discoverPeers()` and prefer attested relays. HTTP clients and autonomous agents read attestation status from `/health` without requiring Nostr subscription. |
| Affects | Node startup sequence, BootstrapService, kind:10033 event format, `/health` endpoint |
| Pattern | Attestation state: `valid` → `stale` (30s grace) → `unattested`. Trust degrades; money doesn't. Payment channels remain open regardless of attestation status. |

**Dual-channel attestation exposure:**
- **Nostr-native:** kind:10033 events on the relay network (for peer discovery)
- **HTTP-native:** `/health` endpoint includes `tee` field (for monitoring, AI agents, HTTP clients)

### Decision Priority Analysis — Epics 3 & 4

**Critical Decisions (Block Epic 3 Implementation):**
1. USDC token migration via Decision 10 (Mock USDC) — unblocks all Epic 3 stories
2. Multi-chain configuration via Decision 8 — unblocks Story 3.2+
3. Node HTTP server via Decision 9 — unblocks Stories 3.3, 3.6

**Important Decisions (Shape Epic 3/4 Architecture):**
4. EVM library via Decision 7 — shapes all new EVM interaction code
5. Attestation lifecycle via Decision 12 — shapes Epic 4 design

**Deferred Decisions (to Epic 4 start):**
- Nautilus KMS integration specifics — depends on Marlin SDK version
- Nix build configuration — depends on final Docker image structure
- PCR measurement registry — depends on attestation verification contract

### Decision Impact Analysis

**Implementation Sequence:**

1. Extract TOON codec to core (done — Epic 1)
2. SDK identity module (done — Epic 1)
3. SDK handler registry + context + pipeline (done — Epic 1)
4. Town relay reimplementation (in progress — Epic 2)
5. USDC token migration — Decision 10 (Epic 3, Story 3.1)
6. Multi-chain configuration — Decision 8 (Epic 3, Story 3.2)
7. x402 /publish endpoint — Decision 9 (Epic 3, Story 3.3)
8. Seed relay discovery (Epic 3, Story 3.4)
9. Service discovery + /health — Decision 9 (Epic 3, Stories 3.5-3.6)
10. Oyster CVM packaging — Decision 11 (Epic 4, Story 4.1)
11. TEE attestation events — Decision 12 (Epic 4, Story 4.2)
12. Attestation-aware peering (Epic 4, Story 4.3)
13. Nautilus KMS + Nix builds (Epic 4, Stories 4.4-4.5)
14. Attestation-first bootstrap (Epic 4, Story 4.6)
15. Rig HTTP + git backend + web UI (Epic 5)

**Cross-Component Dependencies:**

- TOON codec extraction (Decision 1) → must complete before SDK development begins
- SDK identity (Decision 6) → used by Town and Rig for node identity
- Express + Eta (Decisions 2-3) → isolated to Rig, no cross-package impact
- SQLite for Rig metadata (Decision 5b) → same pattern as BLS, no new learning curve
- viem (Decision 7) → used by Epic 3 chain config and x402, Epic 4 attestation contracts
- Chain presets (Decision 8) → must complete before x402 (needs chain-specific USDC addresses)
- Dual-protocol HTTP (Decision 9) → enables /publish and /health on same port as relay
- Mock USDC (Decision 10) → unblocks all Epic 3 development and x402 E2E testing
- Dockerfile determinism (Decision 11 constraint) → forward constraint, apply from Epic 2 onwards
- Attestation lifecycle (Decision 12) → shapes Epic 4 integration with BootstrapService

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

9 areas where AI agents could make different choices for the new SDK/Town/Rig packages. All resolved below. Existing project-context rules (148 rules) remain in effect — these patterns supplement, not replace.

### SDK API Patterns

**Pattern 1: Handler Function Signature**

Handlers use void return with `ctx` methods. The handler calls `ctx.accept()` or `ctx.reject()` — it does not return a response object.

```typescript
// CORRECT
node.on(30617, async (ctx: HandlerContext) => {
  const event = ctx.decode();
  await processRepo(event);
  ctx.accept({ eventId: event.id });
});

// WRONG — do not return response objects
node.on(30617, async (ctx) => {
  return { accept: true, fulfillment: '...' };
});
```

**Pattern 2: Handler Registration Chaining**

Handler registration is chainable (builder pattern) for ergonomic node setup:

```typescript
// CORRECT — chainable
const node = createNode(config)
  .on(30617, repoHandler)
  .on(1617, patchHandler)
  .on(1621, issueHandler)
  .onDefault(rejectUnknown);

// ALSO CORRECT — sequential
const node = createNode(config);
node.on(30617, repoHandler);
node.on(1617, patchHandler);
node.onDefault(rejectUnknown);
```

**Pattern 3: Shallow TOON Parse Type**

The shallow parser extracts routing metadata without full decode. Standard return type in `@toon-protocol/core`:

```typescript
interface ToonRoutingMeta {
  kind: number;
  pubkey: string;
  id: string;
  sig: string;
  rawBytes: Uint8Array; // Original bytes for Schnorr verification
}
```

Location: `packages/core/src/toon/shallow-parse.ts` alongside the TOON codec.

**Pattern 4: Lifecycle Event Emission**

SDK uses typed callbacks (consistent with existing `BootstrapEvent` discriminated union pattern), NOT Node.js EventEmitter:

```typescript
// CORRECT — typed callback, string event name
node.on('bootstrap', (event: BootstrapEvent) => {
  if (event.type === 'phase-change') { ... }
});

// Handler registration uses number (kind), not string
node.on(30617, handler);  // This is handler registration, not event listener

// WRONG — do not use EventEmitter
node.emit('bootstrap', event);  // No EventEmitter
```

Disambiguation: `node.on(number, ...)` = handler registration. `node.on(string, ...)` = lifecycle event listener.

### SDK Error Types

**Pattern 5: Error Hierarchy**

All SDK errors extend `ToonError` from `@toon-protocol/core`:

```typescript
// New SDK error classes
class NodeError extends ToonError {} // Lifecycle: already started, already stopped
class HandlerError extends ToonError {} // Handler dispatch failures
class VerificationError extends ToonError {} // Schnorr verification failures
class PricingError extends ToonError {} // Payment validation failures
```

Error code mapping to ILP:

- `VerificationError` → ILP `F06` (unexpected payment)
- `PricingError` → ILP `F04` (insufficient amount)
- `HandlerError` → ILP `T00` (internal error)
- No matching handler → ILP `F00` (bad request)

### Rig Patterns

**Pattern 6: Express Route Organization**

Feature-based route files, one per domain:

```
packages/rig/src/routes/
├── repos.ts          # Repository list, tree, blob, blame
├── commits.ts        # Commit log, commit diff
├── issues.ts         # Issue list, issue detail, comments
├── pulls.ts          # PR list, PR detail, status
└── git-backend.ts    # git-http-backend CGI proxy (clone/fetch)
```

Each file exports an Express Router. Mounted in `app.ts`:

```typescript
app.use('/', repoRoutes);
app.use('/', commitRoutes);
app.use('/', issueRoutes);
app.use('/', pullRoutes);
app.use('/', gitBackendRoutes);
```

**Pattern 7: Eta Template Location & Naming**

```
packages/rig/views/
├── layout.eta                 # Shared HTML shell
├── repos/
│   ├── list.eta               # Repository list page
│   ├── tree.eta               # File tree view
│   ├── blob.eta               # File content view
│   └── blame.eta              # Blame view
├── commits/
│   ├── log.eta                # Commit history
│   └── diff.eta               # Commit diff view
├── issues/
│   ├── list.eta               # Issue list
│   └── detail.eta             # Issue with comments
├── pulls/
│   ├── list.eta               # PR list
│   └── detail.eta             # PR with status + comments
└── partials/
    ├── header.eta             # Navigation header
    ├── pubkey.eta             # Pubkey display (with kind:0 enrichment)
    └── pagination.eta         # Pagination component
```

Naming: kebab-case directories, kebab-case files, `.eta` extension.

**Pattern 8: Git Operations Module**

Stateless functions taking `repoPath` as a parameter. Located at `packages/rig/src/git/`:

```typescript
// packages/rig/src/git/operations.ts
export async function initRepo(repoPath: string, bare: boolean): Promise<void>;
export async function applyPatch(
  repoPath: string,
  patchContent: string
): Promise<void>;
export async function merge(
  repoPath: string,
  branch: string,
  authorPubkey: string
): Promise<void>;
export async function lsTree(
  repoPath: string,
  ref: string,
  path?: string
): Promise<TreeEntry[]>;
export async function showBlob(
  repoPath: string,
  ref: string,
  path: string
): Promise<string>;
export async function log(
  repoPath: string,
  ref: string,
  limit?: number
): Promise<CommitEntry[]>;
export async function diff(repoPath: string, sha: string): Promise<string>;
export async function blame(
  repoPath: string,
  ref: string,
  path: string
): Promise<BlameLine[]>;

// packages/rig/src/git/http-backend.ts
export function createGitHttpBackend(repoDir: string): express.RequestHandler;
```

All functions use `child_process.execFile` (not `exec`) for safety. Errors throw `RigError extends ToonError`.

**Pattern 9: Relay Query Functions**

Dedicated query module for Rig relay interactions:

```typescript
// packages/rig/src/relay/queries.ts
export async function queryIssues(
  pool: SimplePool,
  relayUrl: string,
  repoEventId: string
): Promise<NostrEvent[]>;
export async function queryPullRequests(
  pool: SimplePool,
  relayUrl: string,
  repoEventId: string
): Promise<NostrEvent[]>;
export async function queryComments(
  pool: SimplePool,
  relayUrl: string,
  parentEventId: string
): Promise<NostrEvent[]>;
export async function queryProfile(
  pool: SimplePool,
  relayUrl: string,
  pubkey: string
): Promise<NostrEvent | null>;
```

Returns decoded `NostrEvent` arrays (not TOON — the UI needs structured data). Uses `nostr-tools` SimplePool internally.

### Production Economics Patterns (Epic 3)

**Pattern 10: Chain Preset & Config Resolution**

Chain presets live in `@toon-protocol/core`. One canonical type, one resolution function. Config resolution order: env vars > explicit config > preset defaults.

```typescript
// packages/core/src/chain/presets.ts

interface ChainPreset {
  chainId: number;
  name: string;
  rpcUrl: string;
  usdcAddress: `0x${string}`;
  tokenNetworkAddress: `0x${string}`;
}

const PRESETS: Record<string, ChainPreset> = {
  anvil: {
    chainId: 31337,
    name: 'Anvil (Local)',
    rpcUrl: 'http://127.0.0.1:8545',
    usdcAddress: '0x...', // Deterministic from DeployLocal.s.sol
    tokenNetworkAddress: '0xCafac3dD18aC6c6e92c921884f9E4176737C052c',
  },
  'arbitrum-sepolia': { /* ... */ },
  'arbitrum-one': { /* ... */ },
};

// Resolution order: env vars > explicit config > preset defaults
export function resolveChainConfig(
  chain: string,
  overrides?: Partial<ChainPreset>
): ChainPreset;
```

Location: `packages/core/src/chain/presets.ts`. Exported from `@toon-protocol/core`.

**Pattern 11: viem Client Factory**

One factory function, chain-aware. Never create viem clients directly with hardcoded chains.

```typescript
// packages/core/src/chain/client.ts
import { createPublicClient, createWalletClient, http } from 'viem';
import { anvil, arbitrumSepolia, arbitrum } from 'viem/chains';

const CHAIN_MAP: Record<number, Chain> = {
  31337: anvil,
  421614: arbitrumSepolia,
  42161: arbitrum,
};

// CORRECT — use factory, derive from ChainPreset
export function createViemPublicClient(preset: ChainPreset) {
  const chain = CHAIN_MAP[preset.chainId];
  return createPublicClient({ chain, transport: http(preset.rpcUrl) });
}

// WRONG — hardcoded chain, scattered client creation
const client = createPublicClient({
  chain: arbitrum,
  transport: http('https://arb1.arbitrum.io/rpc'),
});
```

**Pattern 12: Dual-Protocol Server Setup**

Express mounted on the same `http.Server` as the WebSocket relay. One port per node.

```typescript
// packages/town/src/server.ts (or docker/src/entrypoint.ts)
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// CORRECT — single http.Server, dual protocol
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// Mount HTTP routes
app.get('/publish', publishHandler);       // x402 (Story 3.3)
app.get('/health', healthHandler);         // Enriched status (Story 3.6)
app.get('/.well-known/pay', spspHandler);  // SPSP (existing)

// WebSocket upgrade handled by WSS
httpServer.listen(7100);

// WRONG — separate servers on different ports
const wsServer = createServer().listen(7100);
const httpApp = express().listen(7101); // Don't do this
```

**Pattern 13: x402 /publish Request/Response**

Canonical request/response format. The `/publish` handler constructs an ILP PREPARE from the x402 envelope and routes it through the SAME pipeline as SPSP-originated packets — no special path.

```typescript
// POST /publish
interface PublishRequest {
  event: string; // TOON-encoded Nostr event (base64)
  payment: {
    authorization: string; // EIP-3009 transferWithAuthorization signed payload
    chainId: number;
  };
}

// Response: mirrors ILP FULFILL/REJECT semantics
interface PublishResponse {
  accepted: boolean;
  eventId?: string;  // On success
  error?: {
    code: string;    // ILP error code (F04, F06, T00)
    message: string;
  };
}
```

### TEE Deployment Patterns (Epic 4)

**Pattern 14: kind:10033 Attestation Event Format**

Canonical attestation event structure. Content is always `JSON.stringify()` with the defined schema.

```typescript
// Attestation event (kind:10033)
{
  kind: 10033,
  pubkey: '<node-pubkey>',
  created_at: /* unix-timestamp */,
  content: JSON.stringify({
    enclave: 'marlin-oyster',
    pcr0: '<measurement-hash>',     // Platform Configuration Register
    pcr1: '<measurement-hash>',
    pcr2: '<measurement-hash>',
    attestationDoc: '<base64-encoded-aws-nitro-doc>',
    version: 1,
  }),
  tags: [
    ['relay', 'wss://node-address:7100'],  // Where to find this node
    ['chain', '42161'],                     // Operating chain
    ['expiry', '<unix-timestamp>'],         // When attestation goes stale
  ],
}
```

Location of builder: `packages/core/src/events/attestation.ts` (alongside existing event builders).

**Pattern 15: /health Response Enrichment**

Canonical `/health` response shape. The `tee` field is only present when the node is running inside a TEE — never fake attestation data.

```typescript
// GET /health response
interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;           // Package version
  uptime: number;            // Seconds
  relay: {
    connections: number;     // Active WebSocket connections
    eventsStored: number;    // Total events in SQLite
  };
  connector: {
    peers: number;           // Connected ILP peers
    ilpAddress: string;      // Node's ILP address
  };
  chain: {
    id: number;              // Active chain ID
    name: string;            // Chain display name
    blockNumber: number;     // Latest known block
  };
  tee?: {                    // Only present when running in TEE
    attested: boolean;
    enclaveType: string;     // 'marlin-oyster'
    lastAttestation: number; // Unix timestamp
    pcr0: string;
    state: 'valid' | 'stale' | 'unattested';
  };
}
```

**Pattern 16: Oyster CVM supervisord Process Map**

Canonical two-process layout for the TEE enclave. The connector is **embedded** — ConnectorNode runs in-process with the TOON node via `entrypoint-sdk.js`. Process startup order: toon first (embedded connector + BLS + relay + bootstrap), then attestation server.

```
# docker/supervisord.conf
[program:toon]
command=node /app/dist/entrypoint-sdk.js
priority=10
user=toon
autorestart=true

[program:attestation]
command=node /app/dist/attestation-server.js
priority=20
user=toon
autorestart=true
startsecs=5
```

Located at `docker/supervisord.conf`. Updated 2026-03-18 from 3-process model (relay + connector + attestation) to 2-process model (toon with embedded connector + attestation).

### Enforcement Guidelines

**All AI Agents MUST:**

1. Use `ctx.accept()`/`ctx.reject()` in handlers — never return response objects
2. Use `child_process.execFile` (not `exec`) for all git operations in the Rig
3. Place TOON shallow parse types in `@toon-protocol/core`, not SDK
4. Extend `ToonError` for all new error classes
5. Use feature-based route files for Rig Express routes
6. Follow existing project-context rules for all naming, imports, types, and testing
7. Use `resolveChainConfig()` from `@toon-protocol/core` for all chain configuration — never hardcode chain IDs or RPC URLs
8. Create viem clients via the core factory function — never instantiate directly with hardcoded chains
9. Mount Express on the same `http.Server` as the WebSocket relay — never create separate HTTP servers
10. Use viem for all new EVM code — never ethers.js in new TOON packages (ethers.js is connector-only legacy)
11. Follow the canonical kind:10033 event structure — content is always `JSON.stringify()` with the defined schema
12. Include the `tee?` field in `/health` response only when the node is running inside a TEE — never fake attestation data

### Anti-Patterns

```typescript
// WRONG: any type
function handleEvent(ctx: any) { ... }

// WRONG: exec instead of execFile (command injection risk)
exec(`git log ${repoPath}`);

// WRONG: Full TOON decode before verification
const event = decodeToon(data);  // Decodes everything
verifyEvent(event);               // Trusts the decode
// CORRECT: Shallow parse → verify → then optional full decode

// WRONG: New error hierarchy disconnected from core
class SdkError extends Error { ... }  // Don't do this

// WRONG: Returning response from handler
node.on(1, async (ctx) => { return { accept: true }; });  // Use ctx.accept()

// WRONG: Hardcoded chain config
const usdcAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // Mainnet!
// CORRECT: const { usdcAddress } = resolveChainConfig('arbitrum-one');

// WRONG: ethers.js in new code
import { ethers } from 'ethers';
const provider = new ethers.JsonRpcProvider(url);
// CORRECT: import { createViemPublicClient } from '@toon-protocol/core';

// WRONG: Separate HTTP server for /publish
app.listen(3200); // New port for x402
// CORRECT: Mount on existing relay HTTP server (port 7100)

// WRONG: Attestation content as plain string
content: 'pcr0=abc123,pcr1=def456'
// CORRECT: JSON.stringify({ enclave, pcr0, pcr1, attestationDoc, version })
```

## Project Structure & Boundaries

### Modified Package: @toon-protocol/core (TOON codec extraction + chain config)

```
packages/core/src/
├── ... (existing modules unchanged)
├── toon/                          # Extracted from @toon-protocol/bls (Epic 1)
│   ├── index.ts                   # Re-exports encoder, decoder, shallow-parse
│   ├── encoder.ts                 # Nostr event → TOON bytes (moved from bls)
│   ├── decoder.ts                 # TOON bytes → Nostr event (moved from bls)
│   └── shallow-parse.ts           # ToonRoutingMeta extraction without full decode
├── chain/                         # NEW — Epic 3 multi-chain config
│   ├── index.ts                   # Re-exports presets, client factory, types
│   ├── presets.ts                 # Story 3.2: ChainPreset type, PRESETS map, resolveChainConfig()
│   ├── presets.test.ts
│   ├── client.ts                  # Story 3.2: createViemPublicClient(), createViemWalletClient()
│   └── client.test.ts
├── events/
│   ├── ... (existing builders unchanged)
│   ├── attestation.ts             # NEW Story 4.2: kind:10033 attestation event builder
│   ├── attestation.test.ts
│   ├── service-discovery.ts       # NEW Story 3.5: kind:10035 service discovery event builder
│   ├── service-discovery.test.ts
│   ├── seed-relay.ts              # NEW Story 3.4: kind:10036 seed relay list event builder
│   └── seed-relay.test.ts
```

### New Package: @toon-protocol/sdk (Epic 1)

```
packages/sdk/
├── package.json                   # ESM, peer dep on @toon-protocol/connector
├── tsconfig.json                  # Extends root
├── tsup.config.ts                 # ESM build
├── src/
│   ├── index.ts                   # Public API: createNode, identity fns, types
│   ├── types.ts                   # NodeConfig, ServiceNode, HandlerContext, StartResult
│   ├── errors.ts                  # NodeError, HandlerError, VerificationError, PricingError
│   ├── identity.ts                # Story 1.1: generateMnemonic, fromMnemonic, fromSecretKey
│   ├── identity.test.ts
│   ├── HandlerRegistry.ts         # Story 1.2: .on(kind), .onDefault(), kind routing
│   ├── HandlerRegistry.test.ts
│   ├── HandlerContext.ts          # Story 1.3: toon, kind, pubkey, amount, decode(), accept(), reject()
│   ├── HandlerContext.test.ts
│   ├── verification.ts            # Story 1.4: Schnorr pipeline using ToonRoutingMeta
│   ├── verification.test.ts
│   ├── pricing.ts                 # Story 1.5: per-byte, per-kind, self-write bypass
│   ├── pricing.test.ts
│   ├── PaymentHandlerBridge.ts    # Story 1.6: isTransit fire-and-forget vs await
│   ├── PaymentHandlerBridge.test.ts
│   ├── ServiceNode.ts             # Story 1.7: createNode(), start(), stop(), lifecycle
│   ├── ServiceNode.test.ts
│   └── __integration__/
│       └── full-pipeline.test.ts  # Integration: TOON → parse → verify → price → dispatch
```

### New Package: @toon-protocol/town (Epics 2 + 3)

```
packages/town/
├── package.json                   # Depends on @toon-protocol/sdk, @toon-protocol/core, viem
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts                   # Public API: startTown, TownConfig
│   ├── types.ts                   # TownConfig, HealthResponse, PublishRequest/Response
│   ├── town.ts                    # startTown() — creates SDK node with relay handlers
│   ├── server.ts                  # Story 3.3: Dual-protocol server (Express + WSS on port 7100)
│   ├── server.test.ts
│   ├── cli.ts                     # CLI entrypoint: npx @toon-protocol/town
│   ├── handlers/
│   │   ├── index.ts
│   │   ├── event-storage.ts       # Story 2.1: decode → store → accept
│   │   ├── event-storage.test.ts
│   │   ├── spsp-handshake.ts      # Story 2.2: decode → negotiate → channel → accept
│   │   └── spsp-handshake.test.ts
│   ├── http/                      # NEW — Epic 3 HTTP endpoints
│   │   ├── index.ts
│   │   ├── publish.ts             # Story 3.3: x402 /publish endpoint (EIP-3009 verification → ILP PREPARE)
│   │   ├── publish.test.ts
│   │   ├── health.ts              # Story 3.6: Enriched /health endpoint
│   │   └── health.test.ts
│   ├── discovery/                 # NEW — Epic 3 network discovery
│   │   ├── index.ts
│   │   ├── seed-relay.ts          # Story 3.4: kind:10036 seed relay discovery
│   │   ├── seed-relay.test.ts
│   │   ├── service-discovery.ts   # Story 3.5: kind:10035 service advertisement
│   │   └── service-discovery.test.ts
│   └── __integration__/
│       └── relay-sdk.test.ts      # Story 2.3: SDK-based relay E2E validation
├── Dockerfile                     # Docker image (deterministic — no apt-get update, lockfile pinned)
```

### New Package: @toon-protocol/rig (Epic 5)

```
packages/rig/
├── package.json                   # Depends on @toon-protocol/sdk, @toon-protocol/core, express, eta
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts                   # Public API: startRig, RigConfig
│   ├── types.ts                   # RigConfig, TreeEntry, CommitEntry, BlameLine
│   ├── errors.ts                  # RigError extends ToonError
│   ├── rig.ts                     # startRig() — creates SDK node + Express app
│   ├── cli.ts                     # CLI entrypoint: npx @toon-protocol/rig
│   ├── app.ts                     # Express app setup, middleware, route mounting
│   ├── handlers/                  # NIP-34 ILP packet handlers (Story 5.1, 5.4)
│   │   ├── index.ts
│   │   ├── repo-announcement.ts   # kind:30617 → git init --bare
│   │   ├── repo-announcement.test.ts
│   │   ├── patch.ts               # kind:1617 → git am/apply
│   │   ├── patch.test.ts
│   │   ├── issue.ts               # kind:1621 → acknowledge (stored on relay)
│   │   ├── issue.test.ts
│   │   ├── comment.ts             # kind:1622 → acknowledge (stored on relay)
│   │   ├── comment.test.ts
│   │   ├── status.ts              # kinds 1630-1633 → PR lifecycle (Story 5.4)
│   │   └── status.test.ts
│   ├── git/                       # Git operations (Story 5.1)
│   │   ├── index.ts
│   │   ├── operations.ts          # initRepo, applyPatch, merge, lsTree, showBlob, log, diff, blame
│   │   ├── operations.test.ts
│   │   ├── http-backend.ts        # Express middleware: git-http-backend CGI proxy
│   │   └── http-backend.test.ts
│   ├── routes/                    # Express routes (Story 5.3, 5.5)
│   │   ├── repos.ts               # /{owner}/{repo}, tree, blob, blame
│   │   ├── commits.ts             # /{owner}/{repo}/commits, /commit/{sha}
│   │   ├── issues.ts              # /{owner}/{repo}/issues, /issues/{id}
│   │   ├── pulls.ts               # /{owner}/{repo}/pulls, /pulls/{id}
│   │   └── git-backend.ts         # /{owner}/{repo}.git/* (clone/fetch)
│   ├── relay/                     # Relay queries for UI data (Story 5.5)
│   │   ├── queries.ts             # queryIssues, queryPullRequests, queryComments, queryProfile
│   │   └── queries.test.ts
│   ├── identity/                  # Pubkey display (Story 5.2)
│   │   ├── pubkey-display.ts      # npub formatting, kind:0 profile enrichment
│   │   └── pubkey-display.test.ts
│   └── db/                        # Repository metadata SQLite (Decision 5b)
│       ├── schema.ts              # CREATE TABLE repos, indexes
│       ├── RepoMetadataStore.ts   # CRUD for repository metadata
│       └── RepoMetadataStore.test.ts
├── views/                         # Eta templates (Story 5.3, 5.5)
│   ├── layout.eta
│   ├── repos/
│   │   ├── list.eta
│   │   ├── tree.eta
│   │   ├── blob.eta
│   │   └── blame.eta
│   ├── commits/
│   │   ├── log.eta
│   │   └── diff.eta
│   ├── issues/
│   │   ├── list.eta
│   │   └── detail.eta
│   ├── pulls/
│   │   ├── list.eta
│   │   └── detail.eta
│   └── partials/
│       ├── header.eta
│       ├── pubkey.eta
│       └── pagination.eta
├── public/                        # Static assets (CSS, icons)
│   └── css/
│       └── style.css
├── Dockerfile                     # Docker image
```

### Deployment: docker/ (Epic 4)

```
docker/
├── docker-compose-genesis.yml     # Existing genesis node compose
├── docker-compose-oyster.yml      # NEW Story 4.1: Oyster CVM deployment manifest
├── supervisord.conf               # NEW Story 4.1: Multi-process orchestrator (relay + connector + attestation)
├── Dockerfile                     # Existing node image (deterministic builds from Epic 2 onwards)
├── Dockerfile.nix                 # NEW Story 4.5: Nix-based reproducible build (deterministic PCR values)
├── src/
│   ├── entrypoint.ts              # Existing node entrypoint (updated for dual-protocol server in Epic 3)
│   ├── attestation-server.ts      # NEW Story 4.2: TEE attestation publisher (kind:10033 on startup + refresh)
│   └── attestation-server.test.ts
└── scripts/
    ├── deploy-usdc.ts             # NEW Story 3.1: Deploy FiatTokenV2_2 to Anvil
    └── deploy-usdc.test.ts
```

### Architectural Boundaries

**Package Dependency Graph:**

```
@toon-protocol/core          ← foundation (TOON codec, types, bootstrap, discovery, SPSP, chain config)
    ↑          ↑
@toon-protocol/bls    @toon-protocol/sdk    ← siblings, both depend on core
                      ↑
              ┌───────┴────────┐
@toon-protocol/town (+ bls)    @toon-protocol/rig
```

Town depends on SDK + BLS (for EventStore) + viem (for x402/EIP-3009). Rig depends on SDK + core. SDK depends on core only.

**Boundary Rules:**

- SDK imports core only — never bls or relay directly
- Town and Rig import SDK — never bls directly (except Town for EventStore)
- No package imports from town or rig (they are leaf nodes)
- Connector accessed only through `ConnectorNodeLike` structural type
- viem used in core (chain config) and town (x402) — never ethers.js in new code
- Chain config accessed via `resolveChainConfig()` from core — never hardcoded

**Data Flow — ILP Pipeline (existing):**

```
ILP Packet → ConnectorNode.setPacketHandler()
  → PaymentHandlerBridge (isTransit check)
    → Shallow TOON parse (ToonRoutingMeta)
      → Schnorr verification (or devMode skip)
        → Pricing validation (or self-write bypass)
          → HandlerRegistry.dispatch(kind)
            → Handler(ctx) → ctx.accept()/reject()
              → HandlePacketResponse back to connector
```

**Data Flow — x402 Pipeline (Epic 3, new):**

```
HTTP POST /publish → Express route (port 7100)
  → Parse PublishRequest (TOON event + EIP-3009 authorization)
    → Verify EIP-3009 signature (viem)
      → Settle USDC on-chain (transferWithAuthorization)
        → Construct ILP PREPARE packet (same as SPSP path)
          → Route through connector to destination relay
            → FULFILL → HTTP 200 { eventId, txHash }
            → REJECT → HTTP 400 { error: { code, message } }
```

Both pipelines produce identical ILP PREPARE packets — the BLS cannot distinguish them.

### Requirements to Structure Mapping

| Epic/Story                          | Package | Primary Files                                                                              |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| **Epic 1: SDK**                     |         |                                                                                            |
| Story 1.0: TOON codec extraction    | core    | `toon/encoder.ts`, `toon/decoder.ts`, `toon/shallow-parse.ts`                              |
| Story 1.1: Identity                 | sdk     | `identity.ts`                                                                              |
| Story 1.2: Handler Registry         | sdk     | `HandlerRegistry.ts`                                                                       |
| Story 1.3: HandlerContext           | sdk     | `HandlerContext.ts`                                                                        |
| Story 1.4: Verification             | sdk     | `verification.ts`                                                                          |
| Story 1.5: Pricing                  | sdk     | `pricing.ts`                                                                               |
| Story 1.6: PaymentHandler Bridge    | sdk     | `PaymentHandlerBridge.ts`                                                                  |
| Story 1.7: createNode + lifecycle   | sdk     | `ServiceNode.ts`                                                                           |
| Story 1.8: Connector methods        | sdk     | `ServiceNode.ts` (exposes connector)                                                       |
| Story 1.9: Bootstrap integration    | sdk     | `ServiceNode.ts` (wires BootstrapService)                                                  |
| Story 1.10: Dev mode                | sdk     | `verification.ts`, `pricing.ts`, `ServiceNode.ts`                                          |
| Story 1.11: Package setup           | sdk     | `package.json`, `index.ts`                                                                 |
| **Epic 2: Town**                    |         |                                                                                            |
| Story 2.1: Event storage handler    | town    | `handlers/event-storage.ts`                                                                |
| Story 2.2: SPSP handler             | town    | `handlers/spsp-handshake.ts`                                                               |
| Story 2.3: E2E validation           | client  | `tests/e2e/` (existing)                                                                    |
| Story 2.4: Remove git-proxy         | root    | Delete `packages/git-proxy/`                                                               |
| Story 2.5: Publish town             | town    | `town.ts`, `cli.ts`, `Dockerfile`                                                          |
| **Epic 5: The Rig**                 |         |                                                                                            |
| Story 5.1: SDK node + repo creation | rig     | `handlers/repo-announcement.ts`, `git/operations.ts` (initRepo)                            |
| Story 5.2: Patch handler            | rig     | `handlers/patch.ts`, `git/operations.ts` (applyPatch)                                      |
| Story 5.3: Issue + comment handlers | rig     | `handlers/issue.ts`, `handlers/comment.ts`                                                 |
| Story 5.4: Git HTTP backend         | rig     | `git/http-backend.ts`, `routes/git-backend.ts`                                             |
| Story 5.5: Pubkey identity          | rig     | `identity/pubkey-display.ts`                                                               |
| Story 5.6: PR lifecycle             | rig     | `handlers/status.ts`                                                                       |
| Story 5.7: Layout + repo list       | rig     | `routes/repos.ts` (list), `views/layout.eta`, `views/repos/list.eta`                       |
| Story 5.8: File tree + blob view    | rig     | `routes/repos.ts` (tree/blob), `views/repos/tree.eta`, `views/repos/blob.eta`              |
| Story 5.9: Commit log + diff        | rig     | `routes/commits.ts`, `views/commits/log.eta`, `views/commits/diff.eta`                     |
| Story 5.10: Blame view              | rig     | `routes/repos.ts` (blame), `views/repos/blame.eta`                                         |
| Story 5.11: Issues/PRs from relay   | rig     | `relay/queries.ts`, `routes/issues.ts`, `routes/pulls.ts`, `views/issues/`, `views/pulls/` |
| Story 5.12: Publish rig             | rig     | `rig.ts`, `cli.ts`, `Dockerfile`                                                           |
| **Epic 3: Production Economics**    |         |                                                                                            |
| Story 3.1: USDC token migration     | docker  | `scripts/deploy-usdc.ts`, faucet updates                                                   |
| Story 3.2: Multi-chain config       | core    | `chain/presets.ts`, `chain/client.ts`                                                      |
| Story 3.3: x402 /publish endpoint   | town    | `http/publish.ts`, `server.ts`                                                             |
| Story 3.4: Seed relay discovery     | town    | `discovery/seed-relay.ts`, core `events/seed-relay.ts`                                     |
| Story 3.5: Service discovery events  | town    | `discovery/service-discovery.ts`, core `events/service-discovery.ts`                       |
| Story 3.6: Enriched /health          | town    | `http/health.ts`                                                                           |
| **Epic 4: Marlin TEE Deployment**   |         |                                                                                            |
| Story 4.1: Oyster CVM packaging     | docker  | `docker-compose-oyster.yml`, `supervisord.conf`                                            |
| Story 4.2: TEE attestation events   | docker  | `attestation-server.ts`, core `events/attestation.ts`                                      |
| Story 4.3: Attestation-aware peering | core   | `bootstrap/` (BootstrapService extension)                                                  |
| Story 4.4: Nautilus KMS identity    | docker  | `entrypoint.ts` (KMS integration)                                                         |
| Story 4.5: Nix reproducible builds  | docker  | `Dockerfile.nix`                                                                           |
| Story 4.6: Attestation-first bootstrap | core | `bootstrap/` (seed relay + attestation verification)                                       |

### Cross-Cutting Concerns Location

| Concern                    | Where                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| TOON codec + shallow parse | `packages/core/src/toon/`                                                                                    |
| Unified identity           | `packages/sdk/src/identity.ts`                                                                               |
| Error hierarchy            | `packages/core/src/errors.ts` (base), `packages/sdk/src/errors.ts` (SDK), `packages/rig/src/errors.ts` (Rig) |
| Bootstrap + discovery      | `packages/core/src/bootstrap/` (unchanged)                                                                   |
| Event types + builders     | `packages/core/src/events/` (attestation, service-discovery, seed-relay added)                                |
| NIP-34 types               | `packages/core/src/nip34/` (existing, used by Rig)                                                           |
| Chain configuration        | `packages/core/src/chain/` (presets, viem client factory)                                                    |
| x402 facilitation          | `packages/town/src/http/publish.ts` (EIP-3009 → ILP PREPARE)                                                |
| TEE attestation lifecycle  | `docker/src/attestation-server.ts` + `packages/core/src/events/attestation.ts`                               |
| Dual-protocol server       | `packages/town/src/server.ts` (Express + WSS on port 7100)                                                   |

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All 12 decisions are mutually compatible. Decisions 1–6 (Epics 1/2/5) remain unchanged. Decisions 7–12 (Epics 3/4) extend cleanly: viem ^2.46 (Decision 7) coexists with ethers.js in the connector as acknowledged architectural debt. Chain presets (Decision 8) provide the configuration foundation for x402 (Decision 9) and USDC deployment (Decision 10). Dual-protocol server (Decision 9) reuses the existing `http.Server` from the relay — no new port conflicts. Attestation lifecycle (Decision 12) integrates with BootstrapService's existing peer discovery.

**Pattern Consistency:**
All 16 implementation patterns align with their corresponding decisions. Patterns 1–9 (original) support Decisions 1–6. Patterns 10–11 (chain config, viem factory) support Decisions 7–8. Pattern 12 (dual-protocol server) supports Decision 9. Pattern 13 (x402 request/response) supports Decisions 9–10. Patterns 14–16 (attestation, /health, supervisord) support Decisions 11–12. The enforcement guidelines (12 rules) cover all patterns.

**Structure Alignment:**
Package boundaries are well-defined. The dependency graph is acyclic. ConnectorNodeLike structural typing prevents direct connector imports. All 41 stories map to specific files within their designated packages. No file belongs to multiple stories (clean ownership). The docker/ directory provides clear separation for deployment concerns (Epics 3/4).

### Requirements Coverage Validation ✅

**Epic/Feature Coverage (36 FRs):**

| FR Range                                            | Stories          | Architecture Support                                              |
| --------------------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| FR-SDK-0 (1 FR)                                     | Story 1.0        | TOON codec extraction to `packages/core/src/toon/`                |
| FR-SDK-1 through FR-SDK-NEW-1 (14 FRs)              | Stories 1.1–1.11 | All mapped to specific files in `packages/sdk/src/`               |
| FR-SDK-14, FR-SDK-15, FR-SDK-16, FR-RELAY-1 (4 FRs) | Stories 2.1–2.5  | Covered by `packages/town/` + existing E2E suite                  |
| FR-PROD-1 through FR-PROD-6 (6 FRs)                 | Stories 3.1–3.6  | Covered by `packages/core/src/chain/`, `packages/town/src/http/`  |
| FR-TEE-1 through FR-TEE-6 (6 FRs)                   | Stories 4.1–4.6  | Covered by `docker/`, `packages/core/src/events/`, `bootstrap/`   |
| FR-NIP34-1 through FR-NIP34-6 (6 FRs)               | Stories 5.1–5.12 | Covered by `packages/rig/` (handlers, git, routes, views)         |

All 36 FRs have direct architectural support. No gaps in functional coverage.

**Cross-Epic Dependencies Handled:**

- TOON codec extraction (Epic 0 prerequisite) → enables all five epics
- SDK identity (Epic 1) → used by Town (Epic 2), Rig (Epic 5), and Nautilus KMS (Epic 4)
- SDK handler registry (Epic 1) → consumed by Town and Rig handler implementations
- Chain config in core (Epic 3) → consumed by Town (x402), Docker entrypoint, and Rig
- Dual-protocol server (Epic 3) → prerequisite for /health enrichment (Epic 3) and TEE attestation exposure (Epic 4)
- Seed relay discovery (Epic 3) → prerequisite for attestation-first bootstrap (Epic 4)
- Implementation sequence (Decision Impact Analysis) explicitly orders all 15 steps

**Non-Functional Requirements (7 NFRs):**

| NFR                           | Architectural Support                                                 |
| ----------------------------- | --------------------------------------------------------------------- |
| NFR-SDK-1: TypeScript strict  | Starter template: strict: true, noUncheckedIndexedAccess              |
| NFR-SDK-2: Node.js 24.x ESM   | Starter template: "type": "module"                                    |
| NFR-SDK-3: >80% coverage      | Co-located \*.test.ts files for every source file + integration tests |
| NFR-SDK-4: <30min integration | Pattern 2 (builder chaining) + createNode() ergonomics                |
| NFR-SDK-5: Structural typing  | ConnectorNodeLike pattern in types.ts                                 |
| NFR-SDK-6: Mocked tests       | Test strategy: mocked connectors, no live dependencies                |
| NFR-SDK-7: Minimal deps       | Decision 1 removes relay from SDK deps (TOON moves to core)           |

All 7 NFRs are architecturally addressed.

### Implementation Readiness Validation ✅

**Decision Completeness:**

- All 12 decisions include version numbers, rationale, and affected packages
- Decision Impact Analysis provides explicit 15-step implementation sequence across all 5 epics
- Cross-component dependencies are mapped (12 dependency chains)

**Structure Completeness:**

- 4 package structures + docker/ deployment structure fully defined
- Every story (41 total) maps to specific files (Requirements to Structure Mapping table)
- Integration points specified (PaymentHandler bridge, ConnectorNodeLike, relay queries, x402 pipeline, attestation lifecycle)

**Pattern Completeness:**

- 16 patterns with code examples (correct and incorrect)
- Anti-pattern section documents 9 common mistakes
- Enforcement guidelines provide 12 mandatory rules for AI agents
- Disambiguation rule for `node.on(number)` vs `node.on(string)` prevents the most likely confusion

### Gap Analysis Results

**No Critical Gaps.**

**Important Gaps Resolved:**

1. **SDK → BLS dependency clarified.** The cross-cutting concern #8 originally stated "sdk depends on core+bls" and the dependency graph showed a linear chain (core ← bls ← sdk). With TOON codec moved to core (Decision 1) and pricing created fresh in SDK (Story 1.5), the SDK does not require BLS. The corrected dependency graph:

```
@toon-protocol/core          ← foundation (TOON codec, types, bootstrap, discovery, SPSP)
    ↑          ↑
@toon-protocol/bls    @toon-protocol/sdk    ← siblings, both depend on core
                      ↑
              ┌───────┴────────┐
@toon-protocol/town (+ bls)    @toon-protocol/rig
```

Town depends on SDK + BLS (for EventStore). Rig depends on SDK + core. SDK depends on core only.

2. **NFR-SDK-7 relay dependency superseded.** The epics doc lists `@toon-protocol/relay` as an SDK dependency "for TOON codec." Decision 1 moves TOON to core, making this stale. SDK's actual dependencies: `@toon-protocol/core`, `nostr-tools`, `@scure/bip39`, `@scure/bip32`. No relay or BLS dependency.

**Nice-to-Have Gaps Noted:**

3. **ConnectorNodeLike type definition** belongs in `packages/sdk/src/types.ts` alongside NodeConfig and ServiceNode.

4. **Rig git-http-backend is read-only** (clone/fetch only). Write operations go through ILP-gated NIP-34 events, not git HTTP push. This is architecturally correct but an explicit note prevents implementation confusion.

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed (36 FRs, 7 NFRs, 148 existing AI rules)
- [x] Scale and complexity assessed (5 epics, 41 stories, 8 packages + docker/)
- [x] Technical constraints identified (TOON dependency, connector structural typing, system git, Dockerfile determinism, dual-library EVM debt)
- [x] Cross-cutting concerns mapped (13 concerns)

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions (12 decisions)
- [x] Technology stack fully specified (Express 5.2, Eta 4.5, better-sqlite3 11, @scure/\* 2.0, viem ^2.46)
- [x] Integration patterns defined (PaymentHandler bridge, ConnectorNodeLike, relay queries, x402 pipeline, attestation lifecycle)
- [x] Performance considerations addressed (shallow TOON parse, lazy decode, relay query trade-off, dual-protocol server)

**✅ Implementation Patterns**

- [x] Naming conventions established (follows existing project-context 148 rules)
- [x] Structure patterns defined (16 patterns with code examples)
- [x] Communication patterns specified (handler context, lifecycle events, error hierarchy, attestation events, service discovery)
- [x] Process patterns documented (anti-patterns, enforcement guidelines — 12 rules)

**✅ Project Structure**

- [x] Complete directory structure defined (4 packages + docker/, all files listed)
- [x] Component boundaries established (dependency graph, boundary rules, dual data flow paths)
- [x] Integration points mapped (requirements to structure mapping)
- [x] Requirements to structure mapping complete (41 stories → specific files)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — all 36 FRs covered, all NFRs addressed, no critical gaps, 12 coherent decisions

**Key Strengths:**

- Clean dependency graph with no circular dependencies
- Every story (41 total) maps to specific files (implementation agents won't guess)
- 16 patterns with code examples prevent style divergence across 5 epics
- TOON pipeline ordering explicitly documented as a correctness requirement
- Dual data flow paths (ILP + x402) produce identical packets — clean architectural symmetry
- Party Mode feedback integrated across both decision rounds (Epics 1/2/5 + Epics 3/4)
- Acknowledged architectural debt (ethers.js in connector) with clear boundary

**Areas for Future Enhancement:**

- Rig event caching layer (deferred until relay latency becomes a UX problem)
- Multi-relay redundancy for Rig queries
- Rig offline mode
- ethers.js → viem migration in connector (deferred until connector is under TOON control)

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all 12 architectural decisions exactly as documented with specified versions
- Use implementation patterns consistently across all components (16 patterns, 12 enforcement rules)
- Respect project structure and package boundaries (no circular imports)
- Refer to this document for all architectural questions
- Existing project-context rules (148 rules) remain in full effect
- Use viem for new EVM code; ethers.js is connector-only legacy

**Implementation Sequence:**

Follow the 15-step Decision Impact Analysis sequence:
1. TOON codec extraction (done — Epic 1)
2. SDK identity + handlers + pipeline (done — Epic 1)
3. Town relay reimplementation (in progress — Epic 2)
4. USDC migration → chain config → x402 → discovery → /health (Epic 3)
5. Oyster CVM → attestation → peering → KMS → Nix → bootstrap (Epic 4)
6. Rig HTTP + git + web UI (Epic 5)
