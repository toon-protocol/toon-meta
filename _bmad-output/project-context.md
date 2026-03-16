---
project_name: 'crosstown'
user_name: 'Jonathan'
date: '2026-03-16'
sections_completed:
  [
    'technology_stack',
    'language_rules',
    'framework_rules',
    'testing_rules',
    'code_quality',
    'workflow_rules',
    'critical_rules',
  ]
status: 'complete'
rule_count: 369
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Core Technologies:**

- **Runtime:** Node.js >=20 (24.x for local development)
- **Language:** TypeScript ^5.3 (ES2022 target, ESNext modules, bundler resolution)
- **Package Manager:** pnpm 8.15.0
- **Module System:** ESM-only (`"type": "module"` in all packages)

**Build & Development:**

- **Build Tool:** tsup ^8.0 (ESM output, dts generation, sourcemaps)
- **Linting:** ESLint ^9.0 (flat config) with typescript-eslint (strict + stylistic)
- **Formatting:** Prettier ^3.2
- **Testing:** Vitest ^1.0
- **Reproducible Builds:** Nix flake (pinned nixpkgs, `dockerTools.buildLayeredImage`)

**Key Dependencies:**

- **Nostr:** nostr-tools ^2.20.0
- **TOON Format:** @toon-format/toon ^1.0 (in @crosstown/core)
- **Cryptography:** @noble/curves ^2.0 (secp256k1 Schnorr), @noble/hashes ^2.0 (keccak, sha3)
- **Identity:** @scure/bip39 ^2.0 (mnemonic), @scure/bip32 ^2.0 (HD derivation)
- **Database:** better-sqlite3 ^11.0
- **WebSockets:** ws ^8.0
- **Web Framework:** hono ^4.0 (BLS HTTP API, Town HTTP API, Attestation Server)
- **Ethereum:** viem ^2.47 (client package, x402 settlement, EIP-3009, EIP-712)
- **ILP Connector:** @crosstown/connector ^1.7.0 (optional peer dependency)

**TypeScript Compiler Options (Critical):**

- `strict: true` -- All strict checks enabled
- `noUncheckedIndexedAccess: true` -- Index access returns `T | undefined`
- `noImplicitOverride: true` -- Must use `override` keyword
- `noPropertyAccessFromIndexSignature: true` -- Use bracket notation for index signatures
- `moduleResolution: "bundler"` -- Modern resolution for tsup/esbuild

**Version Constraints:**

- nostr-tools must stay at 2.x (breaking changes in 3.x)
- TOON format is 1.x (critical for relay compatibility)
- @noble/curves and @scure libraries share the same secp256k1 implementation as nostr-tools' @noble/curves dependency
- viem 2.x required for EIP-3009 settlement and EIP-712 typed data verification

## Project Structure (Post-Epic 4)

```
crosstown/
├── packages/
│   ├── town/        # @crosstown/town -- SDK-based relay with x402, service discovery, health, TEE health (Epics 2+3+4)
│   ├── sdk/         # @crosstown/sdk -- SDK for building ILP-gated Nostr services (Epic 1)
│   ├── core/        # @crosstown/core -- Protocol logic, TOON codec, chain config, x402, TEE attestation, KMS identity, Nix builds
│   ├── bls/         # @crosstown/bls -- Business Logic Server (payment validation, event storage)
│   ├── relay/       # @crosstown/relay -- Nostr relay + TOON encoding
│   ├── client/      # @crosstown/client -- Client SDK with payment channel support
│   ├── faucet/      # @crosstown/faucet -- Token distribution for dev testing (plain JS, dev-only)
│   ├── examples/    # @crosstown/examples -- Demo applications
│   └── rig/         # @crosstown/rig -- (ATDD stubs only, Epic 5, not yet implemented)
├── docker/          # Container entrypoint (pnpm workspace member)
│   ├── src/
│   │   ├── shared.ts              # Config parsing, admin client, health check utilities
│   │   ├── entrypoint-sdk.ts      # SDK-based Docker entrypoint (Approach A)
│   │   ├── entrypoint-town.ts     # Town-based Docker entrypoint (Approach B)
│   │   └── attestation-server.ts  # TEE attestation HTTP server + kind:10033 publisher (Story 4.1/4.2)
│   ├── Dockerfile.oyster          # Extended multi-stage build for Oyster CVM (Story 4.1)
│   ├── Dockerfile.nix             # Nix expression for deterministic Docker image (Story 4.5)
│   ├── docker-compose-oyster.yml  # Oyster CVM deployment manifest (Story 4.1)
│   └── supervisord.conf           # Multi-process orchestration (crosstown + attestation)
├── flake.nix                      # Nix flake for reproducible Docker builds (Story 4.5)
├── deploy-genesis-node.sh
└── deploy-peers.sh
```

**Package Dependency Graph:**

```
@crosstown/core          <-- foundation (TOON codec, types, bootstrap, discovery, chain config, x402, TEE attestation, KMS identity, Nix builds)
    ^          ^
@crosstown/bls    @crosstown/sdk    <-- siblings, both depend on core
    ^                 ^
    |           +-----+-------+
    |     @crosstown/town     @crosstown/rig    <-- (Town: Epics 2+3+4 DONE, Rig: Epic 5)
    |       (+ relay + viem)
    |
@crosstown/relay   <-- Town depends on relay for EventStore + NostrRelayServer
```

**Boundary Rules:**

- SDK imports core only -- never relay or bls directly
- Town imports SDK, core, relay, and viem -- the relay reference implementation with x402 support
- Rig will import SDK -- never core/bls directly (except core types)
- No package imports from town or rig (they are leaf nodes)
- Connector accessed only through `EmbeddableConnectorLike` structural type
- Town handlers import from `@crosstown/sdk` (Handler, HandlerContext, HandlerResponse types) and `@crosstown/core` (event builders, bootstrap, chain config)
- Town x402 handler imports viem directly for EIP-3009 settlement and EIP-712 verification
- Docker entrypoints import from `@crosstown/core` (attestation events, KMS identity), `@crosstown/sdk`, `@crosstown/town`, and `@crosstown/relay`

## Epic Roadmap

```
Epic 1: SDK Package                              COMPLETE
Epic 2: Relay Reference Implementation           COMPLETE (8/8 stories, 40/40 ACs)
Epic 3: Production Protocol Economics            COMPLETE (6/6 stories, 26/26 ACs)
Epic 4: Marlin TEE Deployment                    COMPLETE (6/6 stories, 32/33 ACs)
Epic 5: The Rig -- Git Forge / DVM Marketplace    PLANNED
```

**Epic progression:** Build SDK -> Prove it with relay -> Make protocol production-grade -> Make it verifiable -> Build applications on top.

## Production Architecture Decisions (Party Mode 2026-03-05/06)

These decisions shape Epics 3-5 and future development. Full details in `_bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md`.

**Payment Architecture:**
- USDC is the sole user-facing payment token (AGENT token eliminated in Story 3.1)
- POND (Marlin) for operator staking only, invisible to relay users
- Dual payment rail: ILP primary (power users), x402 optional (HTTP clients, AI agents)
- Production chain: Arbitrum One. Dev: Anvil. Staging: Arbitrum Sepolia
- Chain presets: `resolveChainConfig('anvil' | 'arbitrum-sepolia' | 'arbitrum-one')` (Story 3.2)

**x402 Integration (Epic 3 -- Implemented):**
- Crosstown nodes act as x402 facilitators via `/publish` HTTP endpoint on the node (not a separate gateway)
- x402 constructs the same ILP PREPARE packets (with TOON data) that the network already routes
- Both rails produce identical packets via shared `buildIlpPrepare()` in `@crosstown/core` -- the BLS and destination relay cannot distinguish them
- EIP-3009 `transferWithAuthorization` for gasless USDC transfers (user signs off-chain, facilitator pays gas)
- 6-check pre-flight validation pipeline prevents gas griefing (no on-chain tx until all checks pass)
- Opt-in via `x402Enabled: true` / `CROSSTOWN_X402_ENABLED=true` (disabled by default)

**TEE Architecture (Epic 4 -- Implemented):**
- **Decision 12: "Trust degrades; money doesn't."** Attestation state changes (VALID -> STALE -> UNATTESTED) never trigger payment channel closure. Trust is a gradient, not a gate.
- Marlin Oyster CVM (AWS Nitro Enclaves) provides the TEE runtime
- TEE attestation (kind:10033) is the bootstrap trust anchor in production
- Attestation-first seed relay bootstrap: verify kind:10033 BEFORE trusting kind:10032 peer list (R-E4-004)
- KMS-derived identity: enclave code integrity is cryptographically bound to relay identity (`deriveFromKmsSeed()`)
- Nix reproducible builds enable independent PCR verification (`NixBuilder`, `verifyPcrReproducibility()`)

**Component Boundaries (Critical):**
- The **Crosstown node** (`startTown()` / entrypoint) owns all public-facing endpoints: Nostr relay (WS), `/publish` (x402), `/health`
- The **BLS** handles only `/handle-packet` -- ILP packet processing and pricing validation. No public-facing surface
- The **Connector** routes ILP packets between peers
- The **Attestation Server** (Oyster CVM only) serves `/attestation/raw` and publishes kind:10033 events to the local relay

**Network Topology:**
- Genesis hub-and-spoke augmented by seed relay list model (kind:10036 on public Nostr relays, Story 3.4)
- Discovery mode selectable: `discovery: 'genesis'` (default) or `discovery: 'seed-list'` (production)
- TEE attestation (kind:10033) is the bootstrap trust anchor in production (Epic 4)
- Attestation-first bootstrap verifies seed relay attestation before trusting peer lists (Story 4.6)
- Event kinds 10032-10099 reserved for Crosstown service advertisement

**Nostr Event Kinds:**
| Kind | Name | Status |
|------|------|--------|
| 10032 | ILP Peer Info | Existing |
| 10033 | TEE Attestation | Implemented (Epic 4, Stories 4.2/4.3/4.6) |
| 10034 | TEE Verification | Reserved |
| 10035 | Service Discovery | Implemented (Story 3.5) |
| 10036 | Seed Relay List | Implemented (Story 3.4) |
| ~~23194~~ | ~~SPSP Request~~ | Removed (Story 2.7) |
| ~~23195~~ | ~~SPSP Response~~ | Removed (Story 2.7) |

**Terminology:**
- "ILP client" not "ILP/SPSP client" -- SPSP is not part of the protocol
- "Crosstown node" not "BLS" when referring to public-facing capabilities
- No STREAM protocol -- Crosstown sends raw ILP PREPARE/FULFILL with TOON data payloads
- "USDC" not "AGENT" -- AGENT token eliminated in Story 3.1
- "Attestation" not "verification" when referring to TEE state publication (kind:10033 is an attestation event)
- "PCR" (Platform Configuration Register) -- SHA-384 hashes measured by TEE hardware

## @crosstown/core (Post-Epic 4)

Core now includes chain configuration, x402 support, seed relay discovery, service discovery, TEE attestation events, attestation verification, KMS identity derivation, and Nix reproducible build infrastructure.

**New Core Modules (Epic 4):**

```
packages/core/src/
├── events/
│   └── attestation.ts            # buildAttestationEvent(), parseAttestation() (Story 4.2)
├── bootstrap/
│   ├── AttestationVerifier.ts    # AttestationVerifier class, AttestationState enum (Story 4.3)
│   └── AttestationBootstrap.ts   # AttestationBootstrap class, attestation-first seed relay bootstrap (Story 4.6)
├── identity/
│   └── kms-identity.ts           # deriveFromKmsSeed(), KmsIdentityError (Story 4.4)
└── build/
    ├── nix-builder.ts            # NixBuilder class, NixBuildResult (Story 4.5)
    └── pcr-validator.ts          # verifyPcrReproducibility(), analyzeDockerfileForNonDeterminism() (Story 4.5)
```

**Existing Core Modules (Epics 1-3):**

```
packages/core/src/
├── chain/
│   ├── chain-config.ts         # resolveChainConfig(), CHAIN_PRESETS, buildEip712Domain() (Story 3.2)
│   ├── chain-config.test.ts
│   ├── usdc.ts                 # MOCK_USDC_ADDRESS, USDC_DECIMALS, MOCK_USDC_CONFIG (Story 3.1)
│   └── usdc-migration.test.ts
├── x402/
│   ├── index.ts                # Re-exports
│   └── build-ilp-prepare.ts    # buildIlpPrepare() -- shared packet construction (Story 3.3)
├── events/
│   ├── seed-relay.ts           # buildSeedRelayListEvent(), parseSeedRelayList() (Story 3.4)
│   └── service-discovery.ts    # buildServiceDiscoveryEvent(), parseServiceDiscovery() (Story 3.5)
├── discovery/
│   └── seed-relay-discovery.ts # SeedRelayDiscovery class, publishSeedRelayEntry() (Story 3.4)
└── constants.ts                # ILP_PEER_INFO_KIND, SERVICE_DISCOVERY_KIND, SEED_RELAY_LIST_KIND, TEE_ATTESTATION_KIND
```

**Core Public API Additions (Epic 4):**

```typescript
// TEE Attestation Events (Story 4.2)
TEE_ATTESTATION_KIND = 10033
buildAttestationEvent(attestation: TeeAttestation, secretKey: Uint8Array, options: AttestationEventOptions): NostrEvent
parseAttestation(event: NostrEvent, options?: { verify?: boolean }): ParsedAttestation | null
type TeeAttestation = { enclave, pcr0, pcr1, pcr2, attestationDoc, version }
type ParsedAttestation = { attestation: TeeAttestation, relay, chain, expiry }
type AttestationEventOptions = { relay, chain, expiry }

// Attestation Verification (Story 4.3)
class AttestationVerifier {
  constructor(config: AttestationVerifierConfig)
  verify(attestation: TeeAttestation): VerificationResult
  getAttestationState(attestation: TeeAttestation, attestedAt: number, now?: number): AttestationState
  rankPeers(peers: PeerDescriptor[]): PeerDescriptor[]
}
enum AttestationState { VALID = 'valid', STALE = 'stale', UNATTESTED = 'unattested' }
type VerificationResult = { valid: boolean, reason?: string }
type PeerDescriptor = { pubkey, relayUrl, attested, attestationTimestamp? }
type AttestationVerifierConfig = { knownGoodPcrs: Map<string, boolean>, validitySeconds?, graceSeconds? }

// KMS Identity Derivation (Story 4.4)
deriveFromKmsSeed(seed: Uint8Array, options?: DeriveFromKmsSeedOptions): KmsKeypair
class KmsIdentityError extends CrosstownError
type KmsKeypair = { secretKey: Uint8Array, pubkey: string }
type DeriveFromKmsSeedOptions = { mnemonic?: string, accountIndex?: number }

// Nix Reproducible Builds (Story 4.5)
class NixBuilder {
  constructor(config: NixBuilderConfig)
  build(): Promise<NixBuildResult>
}
verifyPcrReproducibility(buildA: NixBuildResult, buildB: NixBuildResult, options?: VerifyOptions): Promise<PcrReproducibilityResult>
analyzeDockerfileForNonDeterminism(content: string, forbiddenPatterns: ForbiddenPattern[]): DeterminismReport
readDockerfileNix(filePath: string): Promise<string>
class PcrReproducibilityError extends CrosstownError
type NixBuildResult = { imageHash, pcr0, pcr1, pcr2, imagePath, buildTimestamp }
type NixBuilderConfig = { projectRoot, dockerfilePath, sourceOverride? }
type PcrReproducibilityResult = { reproducible, pcr0Match, pcr1Match, pcr2Match, imageHashMatch, details, summary }
type DeterminismReport = { deterministic, violations: Violation[], scannedLines }
type ForbiddenPattern = { pattern: RegExp, name, reason }

// Attestation-First Bootstrap (Story 4.6)
class AttestationBootstrap {
  constructor(config: AttestationBootstrapConfig)
  on(listener: AttestationBootstrapEventListener): void
  off(listener: AttestationBootstrapEventListener): void
  bootstrap(): Promise<AttestationBootstrapResult>
}
type AttestationBootstrapConfig = { seedRelays, secretKey, verifier, queryAttestation, subscribePeers }
type AttestationBootstrapResult = { mode: 'attested' | 'degraded', attestedSeedRelay?, discoveredPeers }
type AttestationBootstrapEvent = { type: 'attestation:seed-connected' | 'attestation:verified' | 'attestation:verification-failed' | 'attestation:peers-discovered' | 'attestation:degraded', ... }
```

**Core Public API (Epics 1-3 -- unchanged):**

```typescript
// Chain configuration (Story 3.2)
resolveChainConfig(chain?: ChainName | string): ChainPreset
buildEip712Domain(config: ChainPreset): { name, version, chainId, verifyingContract }
CHAIN_PRESETS: Record<ChainName, ChainPreset>  // anvil, arbitrum-sepolia, arbitrum-one
type ChainName = 'anvil' | 'arbitrum-sepolia' | 'arbitrum-one'

// USDC constants (Story 3.1)
MOCK_USDC_ADDRESS, USDC_DECIMALS, USDC_SYMBOL, USDC_NAME, MOCK_USDC_CONFIG

// x402 packet construction (Story 3.3)
buildIlpPrepare(params: BuildIlpPrepareParams): IlpPreparePacket

// Seed relay events (Story 3.4)
buildSeedRelayListEvent(secretKey, entries): NostrEvent
parseSeedRelayList(event): SeedRelayEntry[]
SeedRelayDiscovery  // class: discover() + close()
publishSeedRelayEntry(config): Promise<{ publishedTo, eventId }>

// Service discovery events (Story 3.5)
buildServiceDiscoveryEvent(content, secretKey): NostrEvent
parseServiceDiscovery(event): ServiceDiscoveryContent | null
SERVICE_DISCOVERY_KIND = 10035
SEED_RELAY_LIST_KIND = 10036
```

## @crosstown/sdk (Epic 1 -- Complete)

The SDK is the main deliverable of Epic 1. It provides a developer-facing abstraction for building ILP-gated Nostr services with the Crosstown protocol.

**SDK Source Files:**

```
packages/sdk/src/
├── index.ts                    # Public API exports
├── identity.ts                 # generateMnemonic(), fromMnemonic(), fromSecretKey()
├── errors.ts                   # IdentityError, NodeError, HandlerError, VerificationError, PricingError
├── handler-registry.ts         # HandlerRegistry: .on(kind), .onDefault(), dispatch()
├── handler-context.ts          # HandlerContext: toon, kind, pubkey, amount, decode(), accept(), reject()
├── verification-pipeline.ts    # Schnorr verification (or devMode skip)
├── pricing-validator.ts        # Per-byte, per-kind pricing with self-write bypass
├── payment-handler-bridge.ts   # isTransit fire-and-forget vs await semantics
├── create-node.ts              # createNode() composition + ServiceNode lifecycle
├── event-storage-handler.ts    # Stub -- throws, directs users to @crosstown/town
└── __integration__/
    ├── create-node.test.ts
    └── network-discovery.test.ts
```

**SDK Public API:**

```typescript
// Identity
generateMnemonic(): string
fromMnemonic(mnemonic: string, options?: FromMnemonicOptions): NodeIdentity
fromSecretKey(secretKey: Uint8Array): NodeIdentity

// Node composition
createNode(config: NodeConfig): ServiceNode

// ServiceNode interface
interface ServiceNode {
  pubkey: string;
  evmAddress: string;
  connector: EmbeddableConnectorLike;
  channelClient: ConnectorChannelClient | null;
  on(kind: number, handler: Handler): ServiceNode;        // handler registration
  on(event: 'bootstrap', listener: BootstrapEventListener): ServiceNode;  // lifecycle
  onDefault(handler: Handler): ServiceNode;
  start(): Promise<StartResult>;
  stop(): Promise<void>;
  peerWith(pubkey: string): Promise<void>;
  publishEvent(event: NostrEvent, options?: { destination: string }): Promise<PublishEventResult>;
}
```

**SDK Pipeline (Packet Processing Order):**

```
ILP Packet -> ConnectorNode.setPacketHandler()
  -> Size limit check (1MB base64)
    -> Shallow TOON parse (ToonRoutingMeta)
      -> Schnorr signature verification (or devMode skip)
        -> Pricing validation (or self-write bypass, or devMode skip)
          -> HandlerRegistry.dispatch(kind)
            -> Handler(ctx) -> ctx.accept()/ctx.reject()
              -> HandlePacketResponse back to connector
```

**SDK Changes in Epic 3:**
- `NodeConfig.chain` field added (default: `'anvil'`): uses `resolveChainConfig()` from core for chain-aware settlement defaults
- `NodeConfig.basePricePerByte` JSDoc updated: amounts are in USDC micro-units (6 decimals) for production
- Default `basePricePerByte` is 10n = 10 micro-USDC per byte = $0.00001/byte

## @crosstown/town (Epics 2+3+4 -- Complete)

The Town package is the main deliverable of Epics 2 and 3, extended in Epic 4 with TEE health integration. It validates the SDK by reimplementing the Nostr relay as composable SDK handlers, with x402 HTTP payment on-ramp, service discovery, seed relay discovery, enriched health endpoints, and TEE attestation state reporting.

**Town Source Files (Post-Epic 4):**

```
packages/town/src/
├── index.ts                    # Public API: startTown, handlers, health, x402 types, TeeHealthInfo
├── town.ts                     # startTown() -- programmatic API (~1100 lines)
├── cli.ts                      # CLI entrypoint (parseArgs + env vars + startTown delegation)
├── health.ts                   # createHealthResponse() -- enriched /health with TEE info (Stories 3.6 + 4.2)
├── health.test.ts              # Health response tests (including TEE attestation fields)
├── town.test.ts                # startTown() unit tests
├── cli.test.ts                 # CLI parsing tests
├── sdk-entrypoint-validation.test.ts  # Static analysis tests
└── handlers/
    ├── event-storage-handler.ts        # Decode -> store -> accept (~15 lines of logic)
    ├── event-storage-handler.test.ts   # Unit + pipeline tests
    ├── x402-publish-handler.ts         # x402 /publish endpoint handler (Story 3.3)
    ├── x402-publish-handler.test.ts    # x402 handler tests (57+ tests)
    ├── x402-preflight.ts               # 6-check pre-flight validation pipeline (Story 3.3)
    ├── x402-pricing.ts                 # calculateX402Price() with routing buffer (Story 3.3)
    ├── x402-settlement.ts              # EIP-3009 on-chain settlement (Story 3.3)
    └── x402-types.ts                   # EIP-3009 types, ABI, EIP-712 domain (Story 3.3)
```

**Town Public API (Post-Epic 4):**

```typescript
// Lifecycle API
startTown(config: TownConfig): Promise<TownInstance>

// TownConfig -- key fields (all have defaults except connector + identity)
interface TownConfig {
  // Identity (exactly one required)
  mnemonic?: string;
  secretKey?: Uint8Array;

  // Connector (exactly one required)
  connector?: EmbeddableConnectorLike;    // embedded mode (zero-latency)
  connectorUrl?: string;                  // standalone mode (HTTP)

  // Pricing
  basePricePerByte?: bigint;              // default: 10n
  routingBufferPercent?: number;          // default: 10 (for x402)

  // x402
  x402Enabled?: boolean;                  // default: false
  facilitatorAddress?: string;            // default: node's EVM address

  // Network
  relayPort?: number;                     // default: 7100
  blsPort?: number;                       // default: 3100
  ilpAddress?: string;                    // default: g.crosstown.<pubkeyShort>
  btpEndpoint?: string;                   // default: ws://localhost:3000

  // Chain / Settlement
  chain?: string;                         // default: 'anvil' (resolveChainConfig)
  chainRpcUrls?: Record<string, string>;
  tokenNetworks?: Record<string, string>;
  preferredTokens?: Record<string, string>;

  // Discovery
  discovery?: 'seed-list' | 'genesis';    // default: 'genesis'
  seedRelays?: string[];                  // public Nostr relay URLs
  publishSeedEntry?: boolean;             // default: false
  externalRelayUrl?: string;              // required if publishSeedEntry is true

  knownPeers?: KnownPeer[];
  dataDir?: string;                       // default: ./data
  devMode?: boolean;                      // default: false
}

// TownInstance -- lifecycle control
interface TownInstance {
  isRunning(): boolean;
  stop(): Promise<void>;
  subscribe(relayUrl: string, filter: Filter): TownSubscription;
  pubkey: string;
  evmAddress: string;
  config: ResolvedTownConfig;
  bootstrapResult: { peerCount: number; channelCount: number };
  discoveryMode: 'seed-list' | 'genesis';
}

// Health response (Stories 3.6 + 4.2)
createHealthResponse(config: HealthConfig): HealthResponse
type TeeHealthInfo = { attested, enclaveType, lastAttestation, pcr0, state: 'valid' | 'stale' | 'unattested' }
// HealthConfig now includes optional `tee?: TeeHealthInfo` field
// HealthResponse now includes optional `tee?: TeeHealthInfo` field

// x402 handler (Story 3.3)
createX402Handler(config: X402HandlerConfig): X402Handler
calculateX402Price(config: X402PricingConfig, toonLength: number): bigint
runPreflight(auth, toonData, destination, config): Promise<PreflightResult>
settleEip3009(auth, config): Promise<X402SettlementResult>
```

## TEE Integration (Epic 4 -- Complete)

Epic 4 delivered the TEE (Trusted Execution Environment) integration layer for the Crosstown protocol, enabling verifiable code integrity guarantees.

**Epic 4 Stories:**
| Story | Title | Package | Deliverables |
|-------|-------|---------|-------------|
| 4-1 | Oyster CVM Packaging | docker/ | Dockerfile.oyster, docker-compose-oyster.yml, supervisord.conf, attestation-server.ts |
| 4-2 | TEE Attestation Events | core + town | kind:10033 builder/parser, lifecycle, health integration |
| 4-3 | Attestation-Aware Peering | core | AttestationVerifier class, state machine, peer ranking |
| 4-4 | Nautilus KMS Identity | core | deriveFromKmsSeed(), KmsIdentityError |
| 4-5 | Nix Reproducible Builds | core + docker/ | NixBuilder, PCR verification, Dockerfile analysis, flake.nix |
| 4-6 | Attestation-First Bootstrap | core | AttestationBootstrap class, seed relay trust flow |

**TEE Trust Chain (architectural centerpiece):**

```
1. Nix build produces deterministic Docker image (Story 4.5)
   -> Identical content hash across builds
     -> Identical PCR values (SHA-384 of image content)
2. Oyster CVM loads image, Nitro hypervisor measures PCR values (Story 4.1)
3. KMS seed only accessible when PCR values are valid (Story 4.4)
   -> deriveFromKmsSeed() produces relay identity
   -> Identity proves code integrity (cryptographic binding)
4. Relay publishes kind:10033 attestation event with PCR values (Story 4.2)
   -> Lifecycle: publish, refresh on interval, expiry tag
5. AttestationVerifier checks PCR values against known-good registry (Story 4.3)
   -> State machine: VALID -> STALE -> UNATTESTED
   -> rankPeers() orders by attestation status
6. AttestationBootstrap verifies seed relay attestation before trusting peer list (Story 4.6)
   -> Prevents seed relay list poisoning (R-E4-004)
   -> Degraded mode fallback when no attested relays found
```

**Oyster CVM Container Architecture (Story 4.1):**

```
+--------------- Oyster CVM ---------------+
|  crosstown (priority=10):                |
|    Relay (WS:7100) + BLS (HTTP:3100)     |
|    + Bootstrap Service                   |
|  attestation-server (priority=20):       |
|    HTTP (:1300) /attestation/raw         |
|    + kind:10033 publisher (to local WS)  |
+-------- vsock proxy --------------------+
         (inbound/outbound)
    Public Internet
```

- **supervisord** manages two processes: crosstown (priority=10) and attestation (priority=20)
- The connector is EXTERNAL -- runs outside the Oyster CVM enclave
- Marlin's dual-proxy architecture handles networking (inbound/outbound vsock)
- Non-root `crosstown` user (uid 1001) for container execution

**Attestation Server (Stories 4.1 + 4.2):**

```typescript
// Endpoints
GET /attestation/raw  // Returns attestation document (placeholder in Story 4.1)
GET /health           // Returns { status: 'ok', tee: boolean }

// Lifecycle
// 1. Starts after crosstown node (priority=20 vs priority=10)
// 2. Reads attestation data from TEE environment (placeholder: readAttestationData())
// 3. Publishes kind:10033 event to local relay via WebSocket
// 4. Refreshes on ATTESTATION_REFRESH_INTERVAL (default: 300s)

// Environment variables
ATTESTATION_PORT             // HTTP port (default: 1300)
ATTESTATION_REFRESH_INTERVAL // Seconds between refreshes (default: 300)
TEE_ENABLED                  // Set by Oyster CVM runtime when in enclave
NOSTR_SECRET_KEY             // 64-char hex secret key for event signing
WS_PORT                      // WebSocket relay port (default: 7100)
CROSSTOWN_CHAIN              // Chain preset name (default: '31337')
EXTERNAL_RELAY_URL           // External relay URL for attestation tags
```

**Attestation State Machine (Story 4.3):**

```
VALID (within validitySeconds, default 300s)
  -> STALE (within graceSeconds after validity expires, default 30s)
    -> UNATTESTED (after grace period expires, or never attested)
```

- Boundary behavior: at exactly `attestedAt + validitySeconds` -> VALID (inclusive <=)
- `getAttestationState()` accepts optional `now` parameter for deterministic testing
- `verify()` checks all three PCR values (pcr0, pcr1, pcr2) against known-good registry
- `rankPeers()` stable-sorts attested peers first; non-attested peers remain connectable
- Single source of truth for attestation state (R-E4-008)

**KMS Identity (Story 4.4):**

- Uses NIP-06 derivation path: `m/44'/1237'/0'/0/{accountIndex}`
- KMS seed must be exactly 32 bytes (Uint8Array)
- When `options.mnemonic` is provided, it takes precedence over raw seed for derivation
- Raw seed is always validated (proves KMS reachability) even when mnemonic is used
- Best-effort key material zeroing in `finally` block (masterKey.wipePrivateData(), childKey.wipePrivateData())
- Defensive copy of private key returned to prevent external mutation
- `KmsIdentityError` extends `CrosstownError` -- signals security-critical condition that must NEVER fall back to random keys
- Lives in `@crosstown/core` (not SDK) because Docker entrypoints import from core

**Nix Reproducible Builds (Story 4.5):**

- `flake.nix` at project root: pins nixpkgs to specific commit, defines `docker-image` output
- `Dockerfile.nix` is a Nix expression (NOT a traditional Dockerfile) using `dockerTools.buildLayeredImage`
- `NixBuilder.build()` shells out to `nix build .#docker-image --print-out-paths`
- PCR values computed from image content: PCR0 = SHA-384(entire image), PCR1 = SHA-384(first 1MB), PCR2 = SHA-384(bytes after 1MB)
- `verifyPcrReproducibility()` compares two `NixBuildResult`s for identical PCR and image hash
- `analyzeDockerfileForNonDeterminism()` is a pure function scanning for forbidden patterns (apt-get update, :latest tags, curl|bash, etc.)
- `sourceOverride` config allows testing that source changes produce different PCR values
- Path traversal prevention in sourceOverride (uses tempDir + path.sep prefix check)
- 10-minute timeout for Nix builds (first build may download entire nixpkgs)

**Attestation-First Bootstrap (Story 4.6):**

```
1. Read seed relay list from kind:10036 (Story 3.4 infrastructure)
2. Connect to seed relay
3. Query kind:10033 attestation (via DI callback)
4. Verify PCR measurement (via DI verifier.verify())
5. If valid -> subscribe to kind:10032 -> discover peers
6. If invalid -> fall back to next seed relay
7. If ALL fail -> degraded mode (console.warn, no peers)
```

- Pure orchestration class with no transport logic -- `queryAttestation` and `subscribePeers` are DI callbacks
- Verifier DI interface accepts `boolean | VerificationResult | Promise<boolean | VerificationResult>` for mock flexibility
- Event listeners: `attestation:seed-connected`, `attestation:verified`, `attestation:verification-failed`, `attestation:peers-discovered`, `attestation:degraded`
- Listener errors caught silently (don't break bootstrap)
- Defensive copy of listeners before emission (safe if listener calls on()/off())

**Epic 4 Metrics (Final -- 6/6 stories):**

| Metric | Value |
|--------|-------|
| Stories delivered | 6/6 (100%) |
| Acceptance criteria | 33 total, 32 FULL + 1 PARTIAL (97%) |
| Story-specific tests | 275 |
| Monorepo test count (start) | 1,558 passing |
| Monorepo test count (end) | 1,818 passing / 79 skipped |
| Total monorepo tests | 1,897 |
| Code review issues | 78 found, 66 fixed, 12 acknowledged (design choices), 0 remaining |
| Security scan findings (production) | 0 |
| NFR assessments | 6/6 PASS (first 100% across any epic) |
| Test regressions | 0 |
| New runtime dependencies | @scure/bip32, @scure/bip39 |

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

**Type Safety:**

- **Never use `any` type** -- Use `unknown` with type guards instead (enforced by ESLint)
- **Always use consistent type imports** -- `import type { Foo } from './types.js'` (ESLint rule: `@typescript-eslint/consistent-type-imports`)
- **Index access returns `T | undefined`** -- Due to `noUncheckedIndexedAccess`, always handle undefined when accessing arrays/objects by index
- **Use bracket notation for index signatures** -- Due to `noPropertyAccessFromIndexSignature`, use `obj['key']` not `obj.key` for index signature types

**Import/Export Patterns:**

- **Always use `.js` extensions in imports** -- ESM requires explicit extensions: `import { foo } from './bar.js'` (not `.ts`)
- **Export all public APIs from package `index.ts`** -- Every package must export its public interface through `src/index.ts`
- **Use structural typing for cross-package interfaces** -- Suffix with `Like` (e.g., `EmbeddableConnectorLike`, `ConnectorNodeLike`, `ConnectorAdminLike`, `EventStoreLike`) to keep peer dependencies optional
- **No re-exporting types from `nostr-tools`** -- Use nostr-tools types directly, don't redefine
- **Core sub-path exports** -- `@crosstown/core/toon` and `@crosstown/core/nip34` are valid import paths (configured in core's package.json `exports`)

**Error Handling:**

- **Core errors:** `CrosstownError` (base), `InvalidEventError`, `PeerDiscoveryError`, `KmsIdentityError` (Epic 4), `PcrReproducibilityError` (Epic 4)
- **SDK errors (extend CrosstownError):** `IdentityError`, `NodeError`, `HandlerError`, `VerificationError`, `PricingError`
- **Error code mapping to ILP:** VerificationError -> F06, PricingError -> F04, HandlerError -> T00, No handler -> F00
- **All async operations must handle errors** -- No unhandled promise rejections
- **Validate external data at boundaries** -- Always validate Nostr event signatures before processing
- **KmsIdentityError signals a security-critical condition** -- NEVER fall back to random keys when KMS seed derivation fails

**TOON Format Handling (Critical):**

- **TOON codec lives in `@crosstown/core/toon`** -- Extracted from BLS as part of Epic 1 Story 1.0
- **Functions:** `encodeEventToToon()`, `decodeEventFromToon()`, `shallowParseToon()`
- **ToonRoutingMeta** -- Shallow parse returns `{ kind, pubkey, id, sig, rawBytes }` without full decode
- **Events are TOON strings, not JSON objects** -- The relay returns TOON format strings in EVENT messages
- **SDK defaults TOON codec from core** -- `createNode()` defaults to core's encoder/decoder, config can override
- **Never assume JSON.parse will work on event data** -- Must use TOON decoder

### SDK-Specific Rules

**Handler Pattern:**

- **Handlers use void return with `ctx` methods** -- Call `ctx.accept()` or `ctx.reject()`, do NOT return response objects
- **Exception: handlers returning data in ILP FULFILL** -- Return `{ accept: true, fulfillment, data }` directly to put response in top-level `data` field (pattern valid for handlers that need to relay data back via ILP FULFILL)
- **Handler signature:** `(ctx: HandlerContext) => Promise<HandlerResponse>`
- **Handler registration is chainable** -- `createNode(config).on(kind1, h1).on(kind2, h2).onDefault(hd)`
- **`node.on(number, ...)` = handler registration, `node.on(string, ...)` = lifecycle event listener** -- Disambiguated by first argument type

**Identity Module:**

- **NIP-06 derivation path:** `m/44'/1237'/0'/0/{accountIndex}`
- **Unified identity:** Single secp256k1 key produces both Nostr pubkey (x-only Schnorr BIP-340) and EVM address (Keccak-256)
- **Seed zeroing:** `fromMnemonic()` zeros intermediate seed bytes in a `finally` block (best-effort, JS has no secure-erase)
- **Defensive copy:** `fromSecretKey()` and `fromMnemonic()` return a copy of the secret key to prevent external mutation
- **KMS identity (`deriveFromKmsSeed()`):** Lives in core, not SDK. Same NIP-06 path. Does NOT include EVM address derivation (SDK concern). Zeros intermediate key material via `HDKey.wipePrivateData()`.

**Verification Pipeline:**

- **Shallow parse FIRST, verify SECOND** -- Signature verification must operate on shallow-parsed fields from the serialized event bytes. Decoding first and then verifying would trust the decode.
- **Schnorr verify:** Uses `schnorr.verify(sigBytes, msgBytes, pubkeyBytes)` from `@noble/curves/secp256k1`
- **Dev mode skips verification entirely** -- Returns `{ verified: true }` immediately

**Pricing Validator:**

- **Per-byte base price** -- `requiredAmount = rawBytes.length * basePricePerByte` (default 10n per byte)
- **Per-kind overrides** -- `kindPricing` config allows custom pricing for specific event kinds
- **Self-write bypass** -- Events from the node's own pubkey are free (no pricing check)
- **Uses `Object.hasOwn()` for prototype-safe lookup** on kindPricing overrides
- **USDC denomination** -- Default 10n = 10 micro-USDC per byte = $0.00001/byte; 1KB event costs ~$0.01

**createNode() Composition:**

- **Delegates to `createCrosstownNode()` from core** -- For bootstrap, relay monitor, and lifecycle wiring
- **Wires the full pipeline as `handlePacket` callback** -- Size check -> shallow parse -> verify -> price -> dispatch
- **Config-based handler registration** -- `config.handlers` and `config.defaultHandler` are alternatives to post-creation `.on()`
- **Max payload: 1MB base64** -- `MAX_PAYLOAD_BASE64_LENGTH = 1_048_576`, rejected before allocation (DoS mitigation)
- **Dev mode log sanitization** -- User-controlled fields (amount, destination) are sanitized to prevent log injection
- **Chain-aware settlement** -- `config.chain` resolves via `resolveChainConfig()` to populate default settlement fields (Epic 3)

**publishEvent() (Story 2.6):**

- **TOON-encodes the event** -- Uses the configured encoder (defaults to core's `encodeEventToToon`)
- **Computes payment amount** -- `basePricePerByte * toonData.length` (not hardcoded)
- **Sends via runtimeClient** -- `crosstownNode.runtimeClient.sendIlpPacket({ destination, amount, data })`
- **Requires node to be started** -- Throws `NodeError` if called before `start()`
- **Requires destination** -- Throws `NodeError` if `options.destination` is missing

### Town-Specific Rules (Epics 2+3+4)

**Handler Implementation Pattern:**

- **Event storage handler is ~15 lines of logic** -- Decode -> store -> accept. All cross-cutting concerns (verification, pricing, self-write bypass) handled by SDK pipeline
- **Settlement during registration** -- Settlement negotiation runs locally during peer registration using kind:10032 data (no separate handshake phase)
- **Error propagation** -- Handler errors propagate to SDK dispatch error boundary, which converts to `{ accept: false, code: 'T00', message: 'Internal error' }`
- **Non-fatal peer registration** -- Peer registration errors are logged and do not prevent handler response

**Health Endpoint with TEE (Stories 3.6 + 4.2):**

- **`createHealthResponse(config)`** -- Pure function, no Hono dependency, easy to unit test
- **`HealthConfig.tee`** -- Optional `TeeHealthInfo` field added in Epic 4
- **TEE info omitted when not in TEE** -- Same omission semantics as x402: entirely absent, never `{ attested: false }`
- **TeeHealthInfo shape:** `{ attested, enclaveType, lastAttestation, pcr0, state: 'valid' | 'stale' | 'unattested' }`
- **Response includes:** status, phase, pubkey, ilpAddress, peerCount, discoveredPeerCount, channelCount, pricing, capabilities, x402 (if enabled), tee (if in TEE), chain, version, sdk, timestamp

**x402 /publish Endpoint (Story 3.3):**

- **Dual flow:** No `X-PAYMENT` header -> 402 pricing response; with `X-PAYMENT` header -> paid publish
- **EIP-3009 authorization in X-PAYMENT header** -- JSON-encoded, validated with hex format checks
- **6-check pre-flight pipeline (cheapest to most expensive):**
  1. EIP-3009 signature verification (off-chain, ~1ms)
  2. USDC balance check (eth_call, ~50ms)
  3. Nonce freshness check (eth_call, ~50ms)
  4. TOON shallow parse (pure computation, ~0.1ms)
  5. Schnorr signature verification (pure crypto, ~2ms)
  6. Destination reachability check (local lookup, ~0.1ms)
- **Settlement atomicity:** If settlement fails, no ILP PREPARE. If settlement succeeds but ILP PREPARE is rejected, no refund.
- **Routing buffer:** `calculateX402Price()` adds configurable buffer (default 10%) for multi-hop overhead
- **Packet equivalence:** Uses `buildIlpPrepare()` from `@crosstown/core` -- identical to ILP-native rail

**Docker Reference Implementation (Post-Epic 4):**

- **entrypoint-town.ts** -- Uses individual SDK components (Approach A) instead of `startTown()` (Approach B)
- **entrypoint-sdk.ts** -- SDK-based entrypoint with direct component wiring
- **attestation-server.ts** -- TEE attestation HTTP server + kind:10033 publisher (Stories 4.1 + 4.2)
- **shared.ts** -- Configuration parsing, admin client creation, health check utilities shared by both entrypoints
- **shared.ts supports Epic 3 features:** `x402Enabled`, `discoveryMode`, `seedRelays`, `publishSeedEntry`, `externalRelayUrl`, `CROSSTOWN_CHAIN` convenience shorthand
- **entrypoint-town.ts TEE integration:** TEE_ENABLED detection, placeholder tee field in /health response (to be migrated to `createHealthResponse()`)
- **Supervisord multi-process management:** crosstown (priority=10), attestation (priority=20)

### TEE-Specific Rules (Epic 4)

**Attestation Events (Story 4.2):**

- **kind:10033 is NIP-16 replaceable** -- Relays store only latest per pubkey + kind. No `d` tag needed.
- **Content format:** JSON with `enclave`, `pcr0`, `pcr1`, `pcr2`, `attestationDoc`, `version` fields
- **Tags:** `['relay', url]`, `['chain', chainId]`, `['expiry', unixTimestamp]`
- **PCR format:** 96-char lowercase hex (SHA-384)
- **attestationDoc:** Non-empty valid base64
- **`parseAttestation(event, { verify: true })`** throws on invalid PCR format or attestation doc (adversarial input gate)
- **`parseAttestation(event)`** (without verify) returns null for malformed content (lenient parse)

**Attestation Verification (Story 4.3):**

- **AttestationVerifier is pure logic** -- No transport layer, no WebSocket connections
- **Known-good PCR registry** -- `Map<string, boolean>` where key is PCR hash value
- **All three PCR values must match** -- pcr0, pcr1, pcr2 all must be present and truthy in registry
- **Defensive copy of knownGoodPcrs** -- Constructor copies the Map to prevent external mutation
- **validitySeconds and graceSeconds must be non-negative finite numbers** -- Throws on invalid values
- **Boundary: exactly at validity end is VALID (inclusive <=)**
- **Non-finite attestedAt returns UNATTESTED** -- Handles NaN, Infinity gracefully

**KMS Identity (Story 4.4):**

- **NEVER fall back to random keys** -- KmsIdentityError means the enclave cannot derive its identity; this is a security-critical abort condition
- **Seed validation:** Must be Uint8Array of exactly 32 bytes
- **accountIndex validation:** Non-negative integer, max 0x7FFFFFFF (BIP-32 non-hardened limit)
- **Key material zeroing:** masterKey.wipePrivateData(), childKey.wipePrivateData() in finally block
- **Mnemonic-derived seed zeroed** -- Only zeros the 64-byte mnemonic-derived seed, NOT the raw KMS seed (caller owns it)

**Nix Build Infrastructure (Story 4.5):**

- **NixBuilder shells out to CLI** -- Requires `nix` package manager installed on build machine
- **Tests conditionally skip when Nix unavailable** -- Unit tests use mocked child_process
- **Path traversal protection** -- `sourceOverride` paths validated against tempDir + path.sep prefix
- **PCR simulation:** PCR0 = SHA-384(entire image), PCR1 = SHA-384(first 1MB), PCR2 = SHA-384(after 1MB) or SHA-384('pcr2:' + image) for <= 1MB images
- **`analyzeDockerfileForNonDeterminism()` is pure** -- Takes string content + patterns, returns report. I/O handled by separate `readDockerfileNix()`
- **Comment lines skipped** -- Lines starting with `#` are not checked for forbidden patterns
- **flake.lock must be committed** -- Pins all transitive inputs for reproducibility
- **Image timestamps fixed to epoch 0** -- `created = "1970-01-01T00:00:00Z"` for reproducibility

**Attestation-First Bootstrap (Story 4.6):**

- **DI callbacks, not interface inheritance** -- `queryAttestation` and `subscribePeers` are injected functions
- **Verifier normalization** -- `await Promise.resolve(verifier.verify(event))` handles boolean, VerificationResult, and Promise variants
- **Sequential relay iteration** -- Tries seed relays in order, stops at first successful attestation
- **Callback errors treated as attestation failure** -- WebSocket failures, DNS errors, timeouts all fall through to next relay
- **Degraded mode is explicitly signaled** -- `console.warn()` + `attestation:degraded` event + `{ mode: 'degraded' }` result
- **secretKey stored in config but not accessed by bootstrap()** -- Reserved for future subscription signing; maintained for API consistency

### Chain Configuration Rules (Epic 3)

**resolveChainConfig() (Story 3.2):**

- **Resolution order:** `CROSSTOWN_CHAIN` env var -> `chain` parameter -> `'anvil'` default
- **Three presets:** `anvil` (31337, localhost), `arbitrum-sepolia` (421614), `arbitrum-one` (42161)
- **Env var overrides:** `CROSSTOWN_RPC_URL` overrides rpcUrl, `CROSSTOWN_TOKEN_NETWORK` overrides tokenNetworkAddress
- **Returns defensive copy** -- Callers can mutate the result without affecting shared preset objects
- **Throws CrosstownError** for unrecognized chain names
- **Auto-populates settlement** -- `startTown()` derives `chainRpcUrls`, `preferredTokens`, `tokenNetworks` from chain preset when not explicitly configured

**Chain Presets:**

| Name | Chain ID | USDC Address | TokenNetwork | RPC |
|------|----------|-------------|-------------|-----|
| anvil | 31337 | 0x5FbDB...aa3 (mock) | 0xCafac...52c | localhost:8545 |
| arbitrum-sepolia | 421614 | 0x75faf...4d | (unset) | sepolia-rollup.arbitrum.io |
| arbitrum-one | 42161 | 0xaf88d...831 | (unset) | arb1.arbitrum.io |

### Framework-Specific Rules

**Nostr (nostr-tools):**

- **Always mock SimplePool in tests** -- Never connect to live relays in unit or integration tests (use `vi.mock('nostr-tools')`)
- **Validate event signatures before processing** -- Never trust unsigned/unverified Nostr events
- **Use proper event kinds** -- Kind 10032 (ILP Peer Info), Kind 10033 (TEE Attestation), Kind 10035 (Service Discovery), Kind 10036 (Seed Relay List). Kinds 23194/23195 (SPSP) have been removed (Story 2.7)
- **NIP-44 encryption** -- Available for private event exchange when needed
- **SimplePool `ReferenceError: window is not defined` is non-fatal** -- This error appears in Node.js but doesn't break functionality
- **Use raw `ws` WebSocket for server-side relay communication** -- SeedRelayDiscovery and attestation server avoid SimplePool for Node.js compatibility

**Hono (Web Framework):**

- **BLS, Town, and Attestation Server use Hono for HTTP endpoints** -- Business Logic Server, Town, and the attestation server expose HTTP APIs using `@hono/node-server`
- **CORS enabled by default** -- BLS accepts cross-origin requests
- **JSON and TOON responses** -- API endpoints return both JSON metadata and TOON-encoded events
- **CWE-209 mitigation** -- `/handle-packet` and x402 500 handlers must return generic error messages, not internal error details
- **CWE-208 mitigation** -- Attestation server responses omit server timestamps to avoid timing side-channel leakage
- **x402 endpoint routes:** `/publish` registered for both GET and POST methods
- **Attestation endpoint routes:** `/attestation/raw` (GET), `/health` (GET) on port 1300

**viem (Ethereum):**

- **Used in Town x402 handler** -- `verifyTypedData()` for EIP-3009 signature verification, `readContract()` for balance/nonce checks, `writeContract()` for settlement
- **EIP-712 domains differ:** USDC's `transferWithAuthorization` uses `{ name: 'USD Coin', version: '2' }`, NOT the TokenNetwork domain
- **WalletClient required for settlement** -- Facilitator pays gas via `walletClient.writeContract()`
- **PublicClient optional** -- Used for pre-flight balance/nonce checks and transaction receipt waiting
- **Not wired in startTown()** -- `walletClient` and `publicClient` are injected via `X402HandlerConfig` but not created by `startTown()` (production wiring deferred)

**SQLite (better-sqlite3):**

- **In-memory for unit tests** -- Use `:memory:` database for fast, isolated tests
- **File-based for integration tests** -- Use temporary file paths for integration testing
- **Synchronous API** -- better-sqlite3 uses sync methods, no need for async/await
- **Proper cleanup** -- Always call `db.close()` in test teardown or finally blocks

**ILP Connector Integration:**

- **@crosstown/connector is an optional peer dependency** -- Both core and SDK declare it as optional
- **Use `EmbeddableConnectorLike` structural type** -- Defined in core, combines sendPacket + registerPeer + removePeer + setPacketHandler + optional channel methods
- **Bootstrap requires connector** -- BootstrapService needs a connector instance to function
- **Channel support is optional** -- `openChannel()` and `getChannelState()` are optional methods on `EmbeddableConnectorLike`

### Testing Rules

**Test Organization:**

- **Co-locate unit tests** -- `*.test.ts` files next to source files in same directory
- **Integration tests in `__integration__/`** -- Multi-component tests go in `packages/*/src/__integration__/`
- **SDK integration tests use separate vitest config** -- `vitest.integration.config.ts` with 30s timeout
- **E2E tests use separate config** -- `vitest.e2e.config.ts` for end-to-end tests (e.g., `packages/client/tests/e2e/`, `packages/town/tests/e2e/`)
- **Test file naming** -- Match source file name with `.test.ts` suffix (e.g., `handler-registry.test.ts`)
- **Town E2E tests require genesis node infrastructure** -- Gracefully skip via `servicesReady`/`genesisReady` flags when infra is unavailable
- **Static analysis tests for infrastructure files (Epic 4)** -- Tests read Docker compose, supervisord.conf, Dockerfile, and Nix flake files as strings, parse, and assert structural properties

**Test Framework (Vitest):**

- **Use Vitest built-in mocking** -- `vi.fn()`, `vi.mock()`, `vi.spyOn()` (not jest)
- **Follow AAA pattern** -- Arrange, Act, Assert structure in all tests
- **Use describe/it blocks** -- Group related tests with `describe()`, individual tests with `it()`
- **Async test handling** -- Use `async` functions, properly await all promises

**Mock Usage:**

- **Always mock SimplePool** -- Use `vi.mock('nostr-tools')` to prevent live relay connections
- **Mock external dependencies** -- HTTP clients, file system, network calls must be mocked in unit tests
- **Factory functions for test data** -- Create helper functions for generating valid test events with proper signatures
- **In-memory databases for unit tests** -- Use SQLite `:memory:` for isolated, fast tests
- **SDK tests mock connectors** -- Use structural `EmbeddableConnectorLike` mock with `vi.fn()` for sendPacket, registerPeer, etc.
- **x402 tests use injectable settlement** -- `config.settle` and `config.runPreflightFn` allow test-specific mocks without touching viem
- **TEE tests use DI callbacks** -- `AttestationBootstrap` uses injected `queryAttestation` and `subscribePeers` for testability
- **Nix build tests mock child_process** -- `vi.mock('node:child_process')` to test NixBuilder without requiring Nix installation

**Two-Approach Handler Testing (Epic 2 Pattern):**

- **Approach A: Unit tests with `createTestContext`** -- Isolated handler logic testing, mocked EventStore and dependencies
- **Approach B: Pipeline integration with `createNode().start()`** -- End-to-end handler behavior within the SDK pipeline
- **Approach A catches handler-level issues, Approach B catches composition and lifecycle issues**

**Static Analysis Tests (Epics 2+3+4 Pattern):**

- **Tests that read source files and assert structural properties** -- E.g., "handler logic is under 100 lines", "Dockerfile CMD points to correct entrypoint", "package.json has correct exports"
- **Extended to infrastructure in Epic 4** -- docker-compose-oyster.yml service names/ports, supervisord.conf priority ordering, Dockerfile.oyster EXPOSE ports, Nix flake output names
- **Fast, stable, and catch drift** -- These tests prevent invisible architectural regressions
- **Verification by absence** -- Story 2-7 introduced `spsp-removal-verification.test.ts` (25 tests) that grep source files for forbidden patterns (e.g., removed SPSP references). Reuse for all removal stories.
- **Verification by presence** -- Epic 3 extended the pattern to assert integration points exist in composition functions like `startTown()` (e.g., `createHealthResponse`, `publishSeedRelayEntry`, `buildServiceDiscoveryEvent`)

**Test Coverage:**

- **Target >80% line coverage** -- Especially for core, BLS, SDK, and Town packages
- **All public methods must have tests** -- Every exported function/class needs unit tests
- **Edge cases and error conditions** -- Test failure paths, boundary conditions, invalid inputs
- **Integration tests for bootstrap flows** -- Multi-peer bootstrap scenarios require integration tests
- **Test amplification is expected** -- ATDD stubs average 2-5x amplification; cross-cutting stories reach 10-15x

**Critical Testing Rules:**

- **No live relays in CI** -- Tests must pass without external network dependencies
- **Cleanup resources in teardown** -- Close database connections, clear mocks with `vi.clearAllMocks()`
- **Test isolation** -- Each test should be independent, no shared state between tests
- **Deterministic test data** -- Use fixed timestamps, keys, and IDs (not random values)
- **Lint-check ATDD stubs immediately after creation** -- Prevents deferred lint debt (learned from Epic 2 Story 2-2's 53 ESLint errors)

### Code Quality & Style Rules

**ESLint Configuration:**

- **Flat config format** -- Using ESLint 9.x flat config (`eslint.config.js`)
- **TypeScript strict rules** -- `@typescript-eslint/strict` and `@typescript-eslint/stylistic` configs
- **No explicit `any`** -- `@typescript-eslint/no-explicit-any: 'error'` (relaxed to `warn` in test/example/docker files)
- **Unused vars pattern** -- Prefix with underscore: `{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }`
- **Consistent type imports** -- `@typescript-eslint/consistent-type-imports` with `prefer: 'type-imports'`
- **No explicit return types** -- `@typescript-eslint/explicit-function-return-type: 'off'` (rely on inference)
- **ESLint ignores** -- `dist/`, `node_modules/`, `coverage/`, `archive/`, `*.js`, `*.mjs`, `packages/rig/`
- **Relaxed rules for test/example/docker files** -- `no-explicit-any: warn`, `no-non-null-assertion: warn`, `no-empty-function: off`, `no-unsafe-finally: warn`, `ban-ts-comment: warn`

**Prettier Configuration:**

- **Semi-colons:** Required (`semi: true`)
- **Quotes:** Single quotes (`singleQuote: true`)
- **Tab Width:** 2 spaces (`tabWidth: 2`)
- **Trailing Commas:** ES5 style (`trailingComma: 'es5'`)
- **Line Width:** 80 characters (`printWidth: 80`)
- **Bracket Spacing:** Enabled (`bracketSpacing: true`)
- **Arrow Parens:** Always (`arrowParens: 'always'`)
- **Line Endings:** LF (`endOfLine: 'lf'`)

**Naming Conventions:**

- **Files (source):** PascalCase for classes, kebab-case for utilities and SDK modules (`BusinessLogicServer.ts`, `handler-registry.ts`, `create-node.ts`, `town.ts`, `x402-publish-handler.ts`, `AttestationVerifier.ts`, `AttestationBootstrap.ts`, `nix-builder.ts`, `pcr-validator.ts`, `kms-identity.ts`)
- **Files (test):** Match source with `.test.ts` suffix (`handler-registry.test.ts`, `town.test.ts`, `attestation.test.ts`, `kms-identity.test.ts`, `nix-reproducibility.test.ts`, `attestation-bootstrap.test.ts`)
- **Classes:** PascalCase (`SocialPeerDiscovery`, `HandlerRegistry`, `SeedRelayDiscovery`, `AttestationVerifier`, `AttestationBootstrap`, `NixBuilder`)
- **Interfaces:** PascalCase, no `I-` prefix (`IlpPeerInfo`, `HandlePacketRequest`, `HandlerContext`, `TownConfig`, `TownInstance`, `ChainPreset`, `ServiceDiscoveryContent`, `TeeAttestation`, `ParsedAttestation`, `AttestationVerifierConfig`, `KmsKeypair`, `NixBuildResult`, `PcrReproducibilityResult`, `TeeHealthInfo`)
- **Functions:** camelCase (`discoverPeers`, `createNode`, `createPricingValidator`, `startTown`, `resolveChainConfig`, `buildIlpPrepare`, `deriveFromKmsSeed`, `verifyPcrReproducibility`, `analyzeDockerfileForNonDeterminism`)
- **Factory functions:** `create*` prefix (`createNode`, `createHandlerContext`, `createVerificationPipeline`, `createPricingValidator`, `createEventStorageHandler`, `createX402Handler`, `createHealthResponse`)
- **Lifecycle functions:** `start*` prefix (`startTown`)
- **Builder functions:** `build*` prefix (`buildIlpPrepare`, `buildSeedRelayListEvent`, `buildServiceDiscoveryEvent`, `buildEip712Domain`, `buildIlpPeerInfoEvent`, `buildAttestationEvent`)
- **Parser functions:** `parse*` prefix (`parseSeedRelayList`, `parseServiceDiscovery`, `parseIlpPeerInfo`, `parseAttestation`)
- **Derivation functions:** `derive*` prefix (`deriveFromKmsSeed`)
- **Verification functions:** `verify*` prefix (`verifyPcrReproducibility`)
- **Constants:** UPPER_SNAKE_CASE (`ILP_PEER_INFO_KIND`, `MAX_PAYLOAD_BASE64_LENGTH`, `SERVICE_DISCOVERY_KIND`, `SEED_RELAY_LIST_KIND`, `MOCK_USDC_ADDRESS`, `USDC_DECIMALS`, `TEE_ATTESTATION_KIND`)
- **Enums:** PascalCase names, string values (`AttestationState.VALID = 'valid'`)
- **Type aliases:** PascalCase (`TrustScore`, `BootstrapPhase`, `ToonRoutingMeta`, `ResolvedTownConfig`, `ChainName`, `AttestationBootstrapEvent`)
- **Event types:** Discriminated unions with `type` field (`BootstrapEvent`, `AttestationBootstrapEvent`)

**Code Organization:**

- **Monorepo structure** -- Packages in `packages/*/` directory, docker in `docker/`
- **pnpm workspace** -- `packages/*` and `docker` in `pnpm-workspace.yaml`
- **Index exports** -- All public APIs exported from `packages/*/src/index.ts`
- **Type definitions** -- Define types in `types.ts` or alongside implementation (e.g., `x402-types.ts`)
- **Constants file** -- Event kinds and constants in `constants.ts`
- **Error classes** -- Custom errors in `errors.ts` per package (core: `CrosstownError`, `KmsIdentityError`, `PcrReproducibilityError`)
- **Handler subdirectory** -- Town handlers organized in `src/handlers/` with co-located tests
- **x402 module organization** -- Types (`x402-types.ts`), pricing (`x402-pricing.ts`), preflight (`x402-preflight.ts`), settlement (`x402-settlement.ts`), handler (`x402-publish-handler.ts`)
- **Chain config subdirectory** -- Core chain configuration in `src/chain/` (usdc.ts, chain-config.ts)
- **Identity subdirectory** -- Core identity derivation in `src/identity/` (kms-identity.ts)
- **Build subdirectory** -- Core Nix build infrastructure in `src/build/` (nix-builder.ts, pcr-validator.ts)
- **Bootstrap subdirectory** -- Core attestation classes in `src/bootstrap/` (AttestationVerifier.ts, AttestationBootstrap.ts alongside BootstrapService.ts)
- **Events subdirectory** -- Core event builders/parsers in `src/events/` (attestation.ts alongside seed-relay.ts, service-discovery.ts)
- **tsconfig.json excludes** -- Root tsconfig excludes `packages/rig` and `archive`

**Documentation:**

- **JSDoc for public APIs** -- Document exported functions, classes, and interfaces
- **Inline comments for complex logic** -- Explain non-obvious implementation details (e.g., pipeline ordering rationale, EIP-3009 flow, PCR computation method, key material zeroing)
- **No redundant comments** -- Don't comment obvious code
- **Reference implementation comments** -- `entrypoint-town.ts` has comprehensive inline comments explaining each SDK pattern
- **`nosemgrep` comments for false positives** -- Suppress CWE-319 false positives for ws:// in validation/Docker contexts with explanation
- **CWE-208 comments** -- Explain timestamp omission in attestation server responses

### Development Workflow Rules

**Git/Repository:**

- **Main branch:** `main` (default for PRs)
- **Epic branches:** `epic-N` for feature work (e.g., `epic-1` for SDK, `epic-2` for Town, `epic-3` for Economics, `epic-4` for TEE)
- **Monorepo with pnpm workspaces** -- All packages managed together
- **Conventional commits** -- Use prefixes: `feat(story):`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`
- **Story-scoped commits** -- `feat(4-2): TEE attestation events`
- **One commit per story** -- Clean history maps 1:1 to epic lifecycle events
- **Co-authored commits for AI assistance** -- Add `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` when AI helps
- **Descriptive commit messages** -- Focus on "why" not just "what"

**Build & Scripts:**

- **Build all packages:** `pnpm build` (runs `pnpm -r run build` recursively)
- **Test all packages:** `pnpm test` (Vitest)
- **Test with coverage:** `pnpm test:coverage`
- **Lint codebase:** `pnpm lint`
- **Format code:** `pnpm format` (write), `pnpm format:check` (check only)
- **Package-level scripts:** Each package has its own `build`, `test`, `dev` scripts
- **SDK integration tests:** `cd packages/sdk && pnpm test:integration`
- **Town E2E tests:** `cd packages/town && pnpm test:e2e` (requires genesis node)
- **Nix Docker build:** `nix build .#docker-image` (requires Nix package manager)

**Deployment:**

- **Docker Compose for local deployment** -- Multiple compose files for different setups
- **Genesis node:** `docker compose -p crosstown-genesis -f docker-compose-genesis.yml up -d`
- **Peer nodes:** `./deploy-peers.sh <count>` script for automated peer deployment
- **Oyster CVM:** `docker build -f docker/Dockerfile.oyster -t crosstown:oyster .` then `oyster-cvm build --docker-compose docker/docker-compose-oyster.yml`
- **Nix reproducible build:** `nix build .#docker-image && docker load < result`
- **Port allocation:** Genesis (BLS: 3100, Relay: 7100), Peers (BLS: 3100+N*10, Relay: 7100+N*10), Attestation: 1300

**Contract Deployment (Anvil -- current dev environment):**

- **Deterministic addresses** -- Anvil deployment produces consistent contract addresses
- **Mock USDC (dev only):** `0x5FbDB2315678afecb367f032d93F642f64180aa3` (same Anvil nonce-0 address, on-chain contract still uses 18 decimals until connector repo deploys FiatTokenV2_2)
- **TokenNetworkRegistry:** `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512`
- **TokenNetwork (USDC):** `0xCafac3dD18aC6c6e92c921884f9E4176737C052c`
- **Deployer Account:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (Anvil Account #0)

**Production Contracts (Arbitrum One -- Epic 4+):**

- **USDC:** `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` (native Arbitrum USDC)
- **USDC (Sepolia):** `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` (Circle testnet USDC)
- **Marlin Serverless Relay:** `0xD28179711eeCe385bc2096c5D199E15e6415A4f5` (Epic 4)
- **TokenNetwork contracts:** To be deployed on Arbitrum One

**npm Publishing:**

- **@crosstown/sdk:** Published, public access, `dist/` only
- **@crosstown/town:** Build-ready, tested, not yet published (retro A14: manual `npm publish --access public` required)
- **Package names:** `@crosstown/sdk`, `@crosstown/town`, `@crosstown/rig` (future)
- **Files:** Only `dist/` directory is published
- **Repository field:** Points to monorepo with `directory: "packages/<name>"`

### Critical Don't-Miss Rules

**Anti-Patterns to Avoid:**

- **NEVER use `any` type** -- Use `unknown` with type guards (enforced by ESLint)
- **NEVER assume events are JSON** -- Relay returns TOON format strings, not JSON objects
- **NEVER connect to live relays in tests** -- Always mock SimplePool (use `vi.mock('nostr-tools')`)
- **NEVER skip event signature validation** -- Always verify Nostr event signatures before processing
- **NEVER import from peer dependencies directly** -- Use structural `*Like` types for cross-package interfaces
- **NEVER use relative imports without `.js` extension** -- ESM requires explicit extensions
- **NEVER assume index access is safe** -- Due to `noUncheckedIndexedAccess`, always handle `undefined`
- **NEVER use property access on index signatures** -- Use bracket notation `obj['key']` not `obj.key`
- **NEVER return response objects from handlers** -- Use `ctx.accept()` / `ctx.reject()` methods (exception: handlers returning data in ILP FULFILL return directly)
- **NEVER decode TOON before verification** -- Shallow parse first, verify, then optionally decode (correctness requirement)
- **NEVER use `exec()` for git operations** -- Use `execFile()` to prevent command injection (Rig, Epic 5)
- **NEVER reference AGENT token** -- AGENT eliminated in Story 3.1; production uses USDC on Arbitrum One
- **NEVER call the BLS a public-facing component** -- BLS handles only `/handle-packet`; the Crosstown node owns all public endpoints
- **NEVER use `!body.amount` for validation** -- Fails for amount=0 (truthiness bug). Use `=== undefined || === null`
- **NEVER expose internal error details in HTTP responses** -- CWE-209: return generic messages, log full errors server-side
- **NEVER submit on-chain transactions without pre-flight validation** -- x402 pre-flight pipeline prevents gas griefing (Story 3.3)
- **NEVER trust kind:10036 or kind:10032 events without signature verification** -- CWE-345: always call `verifyEvent()` on events from untrusted relays
- **NEVER fall back to random keys when KMS seed derivation fails** -- KmsIdentityError is a security-critical abort condition (Story 4.4)
- **NEVER trust a seed relay's kind:10032 peer list without verifying kind:10033 attestation first** -- Prevents seed relay list poisoning (R-E4-004, Story 4.6)
- **NEVER trigger payment channel closure on attestation state changes** -- Decision 12: "Trust degrades; money doesn't" (Story 4.3)

**Critical Edge Cases:**

- **SimplePool `window is not defined` error is non-fatal** -- This ReferenceError appears in Node.js but doesn't break functionality
- **SPSP removed from protocol** -- Kinds 23194/23195 removed in Story 2.7; settlement negotiation uses kind:10032 public data + on-chain verification
- **Payment amounts must match TOON length** -- `publishEvent` amount = `basePricePerByte * toonData.length` (not hardcoded)
- **Relay WebSocket returns TOON strings** -- EVENT messages contain TOON strings, not JSON objects
- **Channel nonce conflicts require retry** -- Payment channel operations may need retry logic for blockchain transaction conflicts
- **SDK stubs direct to Town** -- `createEventStorageHandler()` in SDK throws with message directing users to `@crosstown/town`
- **Handler fulfillment is placeholder** -- `ctx.accept()` returns `fulfillment: 'default-fulfillment'`; in production BLS computes SHA-256(eventId)
- **Data-returning handlers bypass ctx.accept()** -- Return response directly because `data` must be top-level for ILP FULFILL relay (pattern valid for future handlers)
- **Bootstrap phases simplified** -- discovering -> registering -> announcing (handshaking phase eliminated in Story 2.7)
- **Anvil mock USDC has 18 decimals, not 6** -- On-chain mock differs from production USDC. Pricing pipeline is denomination-agnostic.
- **x402 viem clients not wired in startTown()** -- `walletClient` and `publicClient` are injected in tests but not created by `startTown()` (production wiring deferred)
- **x402 routing buffer defaults to 10%** -- `calculateX402Price()` adds 10% buffer on top of `basePricePerByte * toonLength`
- **x402 settlement is one-way** -- If settlement succeeds but ILP PREPARE is rejected, no refund per protocol design
- **AttestationVerifier boundary: exactly at validity end is VALID** -- Inclusive <= comparison, not <
- **AttestationBootstrap: verification-failed event is overloaded** -- Same event type emitted for both attestation verification failures and subscribePeers errors (known simplification, Story 4.6 CR#3)
- **NixBuilder PCR values for small images** -- When image <= 1MB, PCR1 === PCR0 and PCR2 uses domain separator prefix ('pcr2:')
- **attestation-server reads TEE_ENABLED once at startup** -- Env var changes after process start are not reflected

**Security Rules:**

- **Validate all Nostr event signatures** -- Never trust unsigned/unverified events (especially from untrusted relays in seed discovery)
- **No secrets in static events** -- Don't publish shared secrets as plaintext in Nostr events
- **Sanitize user inputs** -- Validate and sanitize all external data at boundaries
- **Log sanitization** -- User-controlled fields are sanitized via regex to prevent log injection
- **Proper key management** -- Private keys for testing only (Anvil deterministic accounts)
- **Payload size limits** -- 1MB base64 limit on incoming ILP packets (DoS mitigation)
- **Pubkey validation** -- `peerWith()` validates 64-char lowercase hex before delegating to core
- **CLI secret exposure** -- `--mnemonic`/`--secret-key` CLI flags expose secrets in `ps` output; prefer env vars (CWE-214). CLI now warns when secrets are passed via flags.
- **Hex validation** -- `--secret-key` must validate hex format with regex before length check
- **BTP URL validation** -- Validate `ws://` or `wss://` prefix before peer registration, sanitize in log output
- **CWE-209 prevention** -- HTTP error handlers must not leak internal error messages (use generic "Internal server error")
- **CWE-208 prevention** -- Attestation server responses omit server timestamps to avoid timing side-channel leakage
- **CWE-22 prevention** -- NixBuilder sourceOverride paths validated against tempDir prefix to prevent path traversal
- **IlpPeerInfo runtime validation** -- Validate `btpEndpoint` and `ilpAddress` fields exist before peer registration (type assertion does not enforce this)
- **EVM address validation** -- x402 handler validates facilitator address format (`/^0x[0-9a-fA-F]{40}$/`) at construction time
- **EIP-3009 authorization validation** -- Parse and validate all fields (addresses, nonce, r, s, v) with hex format and length checks
- **Pre-flight before settlement** -- Never call `transferWithAuthorization` without passing all 6 pre-flight checks
- **Shell script input validation** -- `fund-peer-wallet.sh` validates hex address format and numeric amount (command injection fix, Story 3.1)
- **KMS seed security** -- KmsIdentityError is a hard abort; never fall back to random keys. Key material zeroed in finally blocks.
- **PCR validation** -- 96-char lowercase hex (SHA-384) enforced by regex in `parseAttestation()` when `verify: true`
- **Attestation-first bootstrap** -- Always verify kind:10033 before trusting kind:10032 from seed relays

**Performance Gotchas:**

- **SQLite synchronous API** -- better-sqlite3 blocks the event loop, don't use for high-frequency operations
- **TOON encoding overhead** -- TOON format has encoding/decoding cost, cache parsed results when possible
- **Lazy decode in HandlerContext** -- `ctx.decode()` caches the decoded event; only decodes on first call
- **Shallow TOON parse is cheaper** -- Use `shallowParseToon()` for routing; full decode only when handler needs it
- **WebSocket connection limits** -- SimplePool manages connections, don't create multiple pools
- **In-memory stores for unit tests** -- Use `:memory:` SQLite for fast tests, file-based only for integration
- **x402 pre-flight ordering** -- Cheapest checks first (off-chain crypto, then RPC calls, then local lookups) to fail fast
- **Nix build timeout** -- 10 minutes (600,000ms) for first builds that download nixpkgs
- **AttestationBootstrap sequential iteration** -- Tries relays in order, not parallel; first success short-circuits

**Architecture-Specific Gotchas:**

- **TOON is the native format** -- Events are stored and served as TOON throughout the stack
- **TOON codec now in core, not BLS** -- Extracted as Story 1.0; import from `@crosstown/core/toon` or main `@crosstown/core` export
- **Pay to write, free to read** -- Relay gates EVENT writes with ILP micropayments, REQ/EOSE are free
- **Discovery != Peering** -- RelayMonitor discovers peers but doesn't auto-peer; use `peerWith()` explicitly
- **Bootstrap creates payment channels** -- When settlement is enabled, bootstrap opens channels unilaterally using kind:10032 settlement data (no SPSP handshake)
- **Genesis node ports differ from peers** -- Genesis uses base ports (3100, 7100), peers use offset (3100+N*10)
- **SDK depends on core only** -- SDK does NOT depend on BLS or relay; Town depends on SDK + relay + core + viem
- **EmbeddableConnectorLike is in core, not SDK** -- The structural connector interface is defined in `packages/core/src/compose.ts`
- **Town E2E tests use non-default ports** -- To avoid conflicts with running genesis node (e.g., 7200/3200 instead of 7100/3100)
- **Seed relay discovery is additive** -- `SeedRelayDiscovery` populates `knownPeers` and delegates to `BootstrapService`. It does not replace genesis mode.
- **x402 and ILP produce identical packets** -- `buildIlpPrepare()` in core is the single source of truth. The BLS cannot distinguish between x402 and ILP-originated packets.
- **kind:10035 x402 field omission** -- When x402 is disabled, the `x402` field is omitted entirely from kind:10035 events and `/health` responses (not set to `{ enabled: false }`)
- **TEE health info omission** -- Same semantics: when not in TEE, `tee` field is entirely absent from health response
- **EIP-712 domain collision risk** -- USDC's `transferWithAuthorization` domain (`USD Coin`, version `2`) differs from TokenNetwork balance proof domain (`TokenNetwork`, version `1`). x402 handler must use the USDC domain.
- **kind:10033 is NIP-16 replaceable** -- No `d` tag. Replaces by pubkey + kind only.
- **Attestation server is a separate process** -- Runs alongside the Crosstown node, managed by supervisord (priority=20 vs priority=10)
- **KMS identity lives in core, not SDK** -- Docker entrypoints import from core. No EVM address derivation (SDK concern).
- **Nix flake requires x86_64-linux** -- Docker image output is system-specific (`packages.x86_64-linux.docker-image`)
- **flake.lock pins all inputs** -- Must be committed to version control for reproducibility
- **Connector is external in Oyster CVM** -- Accessed via CONNECTOR_URL and CONNECTOR_ADMIN_URL env vars

---

## Known Action Items (From Epic 4 Final Retro)

**Must-Do for Epic 5:**
- A1: Set up genesis node in CI (carried 4 epics -- escalated to HIGH severity)
- A2: Replace `console.error` with structured logger (carried 4 epics)
- A3: Deploy FiatTokenV2_2 on Anvil with 6 decimals and EIP-3009 (mock USDC still uses 18-decimal AGENT ERC-20)
- A5: Commit flake.lock to version control (Nix reproducibility requires it)

**Should-Do:**
- A4: Create project-level semgrep configuration (suppress CWE-319 false positives for ws://)
- A6: Address transitive dependency vulnerabilities (carried from Epic 2)
- A7: Wire viem clients in startTown() for production x402
- A8: Set up facilitator ETH monitoring for x402 gas payments
- A9: Refactor SDK publishEvent() to use shared buildIlpPrepare()
- A10: Update Docker entrypoint-town.ts for new Epic 3 config fields + migrate to createHealthResponse()

**Nice-to-Have:**
- A11: Split large test files (5+ files > 900 lines)
- A12: Implement deferred P3 E2E tests (T-3.4-12, 3.6-E2E-001)
- A13: Integrate real Nix builds in CI (currently mocked)
- A14: Publish @crosstown/town to npm (carried from Epic 2 A3)
- A15: Ensure code review agents run Prettier before committing

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge
- Check CLAUDE.md and MEMORY.md for additional project-specific context
- Use the two-approach handler testing pattern (Approach A + B) for all handler stories
- Use static analysis tests for structural property assertions (verification by absence AND presence)
- Use "verification by absence" tests when removing protocol concepts
- Budget 2-5x test amplification for focused stories, 10-15x for cross-cutting stories
- Use injectable dependencies for x402-related tests (settlement, preflight, viem clients)
- Use DI callbacks for orchestration classes (AttestationBootstrap pattern)
- Use configurable validity/grace periods for time-sensitive state machines (AttestationVerifier pattern)

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-03-16
