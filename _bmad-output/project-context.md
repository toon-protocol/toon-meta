---
project_name: 'toon'
user_name: 'Jonathan'
date: '2026-03-22'
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
rule_count: 456
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
- **TOON Format:** @toon-format/toon ^1.0 (in @toon-protocol/core)
- **Cryptography:** @noble/curves ^2.0 (secp256k1 Schnorr), @noble/hashes ^2.0 (keccak, sha3)
- **Identity:** @scure/bip39 ^2.0 (mnemonic), @scure/bip32 ^2.0 (HD derivation)
- **Database:** better-sqlite3 ^11.0
- **WebSockets:** ws ^8.0
- **Web Framework:** hono ^4.0 (BLS HTTP API, Town HTTP API, Attestation Server)
- **Ethereum:** viem ^2.47 (client package, x402 settlement, EIP-3009, EIP-712)
- **ILP Connector:** @toon-protocol/connector ^1.7.0 (optional peer dependency)

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

## Project Structure (Post-Epic 7)

```
toon/
├── packages/
│   ├── town/        # @toon-protocol/town -- SDK-based relay with x402, service discovery, health, TEE health, DVM skill config (Epics 2+3+4+5)
│   ├── sdk/         # @toon-protocol/sdk -- SDK for building ILP-gated Nostr services + DVM lifecycle + workflow/swarm coordination + prefix claims (Epics 1+5+6+7)
│   ├── core/        # @toon-protocol/core -- Protocol logic, TOON codec, chain config, x402, TEE attestation, KMS identity, Nix builds, DVM event kinds, workflow/swarm/reputation events, ILP address hierarchy, fee calculation (Epics 1+3+4+5+6+7)
│   ├── bls/         # @toon-protocol/bls -- Business Logic Server (payment validation, event storage)
│   ├── relay/       # @toon-protocol/relay -- Nostr relay + TOON encoding
│   ├── client/      # @toon-protocol/client -- Client SDK with payment channel support
│   ├── faucet/      # @toon-protocol/faucet -- Token distribution for dev testing (plain JS, dev-only)
│   ├── examples/    # @toon-protocol/examples -- Demo applications
│   └── rig/         # @toon-protocol/rig -- (ATDD stubs only, Epic 8, not yet implemented)
├── docker/          # Container entrypoint (pnpm workspace member)
│   ├── src/
│   │   ├── shared.ts              # Config parsing, admin client, health check utilities
│   │   ├── entrypoint-sdk.ts      # SDK-based Docker entrypoint (Approach A)
│   │   ├── entrypoint-town.ts     # Town-based Docker entrypoint (Approach B)
│   │   └── attestation-server.ts  # TEE attestation HTTP server + kind:10033 publisher (Story 4.1/4.2)
│   ├── Dockerfile.oyster          # Extended multi-stage build for Oyster CVM (Story 4.1)
│   ├── Dockerfile.nix             # Nix expression for deterministic Docker image (Story 4.5)
│   ├── docker-compose-oyster.yml  # Oyster CVM deployment manifest (Story 4.1)
│   └── supervisord.conf           # Multi-process orchestration (toon + attestation)
├── flake.nix                      # Nix flake for reproducible Docker builds (Story 4.5)
├── deploy-genesis-node.sh
└── deploy-peers.sh
```

**Package Dependency Graph:**

```
@toon-protocol/core          <-- foundation (TOON codec, types, bootstrap, discovery, chain config, x402, TEE attestation, KMS identity, Nix builds, DVM event kinds, workflow/swarm/reputation events, ILP address hierarchy, fee calculation, prefix claim events)
    ^          ^
@toon-protocol/bls    @toon-protocol/sdk    <-- siblings, both depend on core (SDK adds workflow orchestrator, swarm coordinator, prefix claim handler)
    ^                 ^
    |           +-----+-------+
    |     @toon-protocol/town     @toon-protocol/rig    <-- (Town: Epics 2+3+4+5 DONE, Rig: Epic 8)
    |       (+ relay + viem)
    |
@toon-protocol/relay   <-- Town depends on relay for EventStore + NostrRelayServer
```

**Boundary Rules:**

- SDK imports core only -- never relay or bls directly
- Town imports SDK, core, relay, and viem -- the relay reference implementation with x402 support
- Rig will import SDK -- never core/bls directly (except core types)
- No package imports from town or rig (they are leaf nodes)
- Connector accessed only through `EmbeddableConnectorLike` structural type
- Town handlers import from `@toon-protocol/sdk` (Handler, HandlerContext, HandlerResponse types) and `@toon-protocol/core` (event builders, bootstrap, chain config)
- Town x402 handler imports viem directly for EIP-3009 settlement and EIP-712 verification
- Docker entrypoints import from `@toon-protocol/core` (attestation events, KMS identity), `@toon-protocol/sdk`, `@toon-protocol/town`, and `@toon-protocol/relay`

## Epic Roadmap

```
Epic 1: SDK Package                              COMPLETE (12/12 stories, 75/75 ACs)
Epic 2: Relay Reference Implementation           COMPLETE (8/8 stories, 40/40 ACs)
Epic 3: Production Protocol Economics            COMPLETE (6/6 stories, 26/26 ACs)
Epic 4: Marlin TEE Deployment                    COMPLETE (6/6 stories, 32/33 ACs)
Epic 5: DVM Compute Marketplace                  COMPLETE (4/4 stories, 27/27 ACs)
Epic 6: Advanced DVM Coordination + TEE          COMPLETE (4/4 stories, 21/21 ACs)
Epic 7: ILP Address Hierarchy & Protocol Econ    COMPLETE (6/6 stories, 35/35 ACs)
Epic 8: The Rig -- Arweave DVM + Forge-UI        PLANNED (7 stories: 8.0 Arweave DVM + 8.1-8.5 Forge-UI + 8.6 Publish; NIP-34 skill stories moved to Epic 9)
Epic 9: NIP-to-TOON Skill Pipeline + Socialverse  PLANNED (34 stories: 9.0-9.3 Pipeline + 9.4-9.25 Socialverse NIP Skills + 9.26-9.30 NIP-34 Git [from E8] + 9.31-9.32 DVM + 9.33-9.34 Publish)
```

**Epic progression:** Build SDK -> Prove it with relay -> Make protocol production-grade -> Make it verifiable -> Build DVM compute marketplace -> Advanced coordination + verifiable compute -> Hierarchical addressing & protocol economics (DONE) -> Build applications on top -> Teach agents the protocol (skills pipeline + socialverse).

## Production Architecture Decisions (Party Mode 2026-03-05/06)

These decisions shape Epics 3-5 and future development. Full details in `_bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md`.

**Payment Architecture:**
- USDC is the sole user-facing payment token (AGENT token eliminated in Story 3.1)
- POND (Marlin) for operator staking only, invisible to relay users
- Dual payment rail: ILP primary (power users), x402 optional (HTTP clients, AI agents)
- Production chain: Arbitrum One. Dev: Anvil. Staging: Arbitrum Sepolia
- Chain presets: `resolveChainConfig('anvil' | 'arbitrum-sepolia' | 'arbitrum-one')` (Story 3.2)

**x402 Integration (Epic 3 -- Implemented):**
- TOON nodes act as x402 facilitators via `/publish` HTTP endpoint on the node (not a separate gateway)
- x402 constructs the same ILP PREPARE packets (with TOON data) that the network already routes
- Both rails produce identical packets via shared `buildIlpPrepare()` in `@toon-protocol/core` -- the BLS and destination relay cannot distinguish them
- EIP-3009 `transferWithAuthorization` for gasless USDC transfers (user signs off-chain, facilitator pays gas)
- 6-check pre-flight validation pipeline prevents gas griefing (no on-chain tx until all checks pass)
- Opt-in via `x402Enabled: true` / `TOON_X402_ENABLED=true` (disabled by default)

**TEE Architecture (Epic 4 -- Implemented):**
- **Decision 12: "Trust degrades; money doesn't."** Attestation state changes (VALID -> STALE -> UNATTESTED) never trigger payment channel closure. Trust is a gradient, not a gate.
- Marlin Oyster CVM (AWS Nitro Enclaves) provides the TEE runtime
- TEE attestation (kind:10033) is the bootstrap trust anchor in production
- Attestation-first seed relay bootstrap: verify kind:10033 BEFORE trusting kind:10032 peer list (R-E4-004)
- KMS-derived identity: enclave code integrity is cryptographically bound to relay identity (`deriveFromKmsSeed()`)
- Nix reproducible builds enable independent PCR verification (`NixBuilder`, `verifyPcrReproducibility()`)

**Component Boundaries (Critical):**
- The **TOON node** (`startTown()` / entrypoint) owns all public-facing endpoints: Nostr relay (WS), `/publish` (x402), `/health`
- The **BLS** handles only `/handle-packet` -- ILP packet processing and pricing validation. No public-facing surface
- The **Connector** routes ILP packets between peers
- The **Attestation Server** (Oyster CVM only) serves `/attestation/raw` and publishes kind:10033 events to the local relay

**Network Topology:**
- Genesis hub-and-spoke augmented by seed relay list model (kind:10036 on public Nostr relays, Story 3.4)
- Discovery mode selectable: `discovery: 'genesis'` (default) or `discovery: 'seed-list'` (production)
- TEE attestation (kind:10033) is the bootstrap trust anchor in production (Epic 4)
- Attestation-first bootstrap verifies seed relay attestation before trusting peer lists (Story 4.6)
- Event kinds 10032-10099 reserved for TOON service advertisement

**Nostr Event Kinds:**
| Kind | Name | Status |
|------|------|--------|
| 5000-5999 | DVM Job Request (NIP-90) | Implemented (Epic 5, Story 5.1; extended Epic 6 with swarm tags) |
| 5100 | Text Generation DVM | Reference kind (Story 5.1) |
| 5200 | Image Generation DVM | Defined (Story 5.1) |
| 5300 | Text-to-Speech DVM | Defined (Story 5.1) |
| 5302 | Translation DVM | Defined (Story 5.1) |
| 6000-6999 | DVM Job Result (NIP-90) | Implemented (Epic 5, Story 5.3; extended Epic 6 with attestation tag) |
| 7000 | DVM Job Feedback (NIP-90) | Implemented (Epic 5, Story 5.3; extended Epic 6 with swarm selection/winner tag) |
| 10032 | ILP Peer Info | Existing |
| 10033 | TEE Attestation | Implemented (Epic 4, Stories 4.2/4.3/4.6) |
| 10034 | Prefix Claim | Implemented (Epic 7, Story 7.6) -- prefix marketplace claim request |
| 10035 | Service Discovery | Implemented (Story 3.5, extended Story 5.4 with skill descriptors, extended Story 6.4 with reputation) |
| 10036 | Seed Relay List | Implemented (Story 3.4) |
| 10037 | Prefix Grant | Implemented (Epic 7, Story 7.6) -- prefix marketplace grant confirmation |
| 10040 | Workflow Chain Definition | Implemented (Epic 6, Story 6.1) -- NIP-33 parameterized replaceable |
| 30382 | Web of Trust Declaration | Implemented (Epic 6, Story 6.4) -- NIP-33 parameterized replaceable |
| 31117 | Job Review | Implemented (Epic 6, Story 6.4) -- NIP-33 parameterized replaceable |
| 5094 | Arweave Blob Storage DVM (NIP-90) | Planned (Epic 8, Story 8.0) -- storage job request |
| 6094 | Arweave Blob Storage Result (NIP-90) | Planned (Epic 8, Story 8.0) -- storage result (informational, prepaid model) |
| 30617 | Repository Announcement (NIP-34) | Planned (Epic 9, Story 9.26) -- NIP-33 parameterized replaceable |
| 1617 | Patch (NIP-34) | Planned (Epic 9, Story 9.26) |
| 1618 | Pull Request (NIP-34) | Planned (Epic 9, Story 9.26) |
| 1619 | PR Status Update (NIP-34) | Planned (Epic 9, Story 9.26) |
| 1621 | Issue (NIP-34) | Planned (Epic 9, Story 9.26) |
| 1622 | Comment (NIP-34) | Planned (Epic 9, Story 9.26) |
| 1630-1633 | Status Events (NIP-34) | Planned (Epic 9, Story 9.26) -- open/applied/closed/draft |
| ~~23194~~ | ~~SPSP Request~~ | Removed (Story 2.7) |
| ~~23195~~ | ~~SPSP Response~~ | Removed (Story 2.7) |

**Prepaid Protocol Model (Party Mode 2026-03-20 -- shapes Epic 7):**
- **"Sending a message and sending money are the same action"** -- protocol thesis, all monetized flows must respect it
- **Prepaid DVM (D7-001):** Kind 5xxx request's ILP PREPARE amount = provider's advertised price from `SkillDescriptor.pricing`. Request packet IS the payment. `settleCompute()` deprecated.
- **Supply-driven marketplace (D7-002):** Providers advertise capabilities + pricing in `SkillDescriptor` (kind:10035). Customers discover, compare, and pay on submission. Not a request-for-quote system.
- **Prefix claim single-packet (D7-003):** Prefix claim event's ILP PREPARE amount = prefix price. Handler validates `ctx.amount >= prefixPricing.basePrice`. Same pattern as prepaid DVM.
- **Unified payment pattern (D7-004):** All monetized flows: (1) advertise price in replaceable Nostr event, (2) customer discovers, (3) message + payment in ONE ILP packet.
- **Prefix claims use own kinds (D7-005):** Control-plane operation (routing topology mutation), not DVM. Event kinds in 10032-10099 range.
- **Bid semantic shift (D7-006):** `bid` tag = client-side safety cap ("won't pay more than X"), not an offer. Actual payment from `SkillDescriptor.pricing`.
- **publishEvent() amount override (D7-007):** Optional `amount` param overrides `basePricePerByte × bytes` calculation. Enables prepaid DVM and prefix claim flows.
- **settleCompute() deprecation path:** Still functional in Epic 7 (backward compat) but `@deprecated`. Kind 6xxx `amount` tag becomes informational, not an invoice.
- Full decision record: `_bmad-output/planning-artifacts/research/party-mode-prepaid-protocol-decisions-2026-03-20.md`

**Fully Decentralized Git Architecture (Party Mode 2026-03-22 -- shapes Epics 8 + 9):**

Repositories exist on the protocol, not on any server. Git objects (blobs, trees, commits) are stored permanently on Arweave via kind:5094 DVM. NIP-34 events on relays handle collaboration (repos, patches, issues, PRs, status, refs). There is no Rig server, no SDK library, no local git cache, no central authority. Epic 8 delivers infrastructure (Arweave DVM + Forge-UI). Epic 9 delivers agent knowledge (NIP-34 skill + socialverse skills + skill pipeline).

- **Agent Skill replaces SDK.** Instead of a library with functions, agents learn protocols through Claude Agent Skills with progressive disclosure (Level 3 resources per kind). Skills follow skill-creator best practices (evals, description optimization, with/without baseline testing).
- **Transport is `@toon-protocol/client`, not SDK.** Agents send events via the client's `publishEvent()`. The SDK (`createNode()`, handler registry) is only for providers (like the Arweave DVM).
- **Arweave is the source of truth for code.** Every git object uploaded to Arweave via kind:5094 with Irys tags (`Git-SHA`, `Git-Type`, `Repo`). Content-addressed: git SHA → Arweave tx ID. Resolvable via Arweave GraphQL or manifest transaction.
- **NIP-34 events are the source of truth for collaboration.** kind:30617 (repos), kind:1617 (patches), kind:1621/1622 (issues/comments), kind:1618/1619 (PRs), kind:1630-1633 (status), kind:30618 (refs/branches). All ILP-gated on TOON relays.
- **Agents interact directly.** No server in the loop. Read: kind:30618 → commit → tree → blob from Arweave. Submit: kind:1617 to relay via client. Merge: maintainer agent fetches from Arweave, applies patch, uploads new objects, publishes kind:1631 + updated kind:30618.
- **Repos are portable.** A repo = Arweave transactions + NIP-34 events. No single point of failure.
- **Forge-UI is a static web app on Arweave.** Read-only HTML/JS querying relays + Arweave gateways. Permanently hosted, censorship-resistant.
- **Kind 5094 (Arweave Blob Storage):** DVM job request carrying blob data + payment. Provider advertises `kindPricing[5094]` in kind:10035 `SkillDescriptor`. Single-packet: blob + payment in ONE ILP PREPARE, Arweave tx ID in FULFILL data field. Chunked upload for large blobs (each chunk is its own message+payment). No Blossom, no relay involvement in storage flow.
- **NIP-90 DVM for code review (future):** DVM marketplace extends to code review — providers run CI/TDD pipelines, publish results. Not in Epic 8 scope but architecturally enabled.
- **NIP alignment:** NIP-90 (DVM), NIP-34 (git), NIP-73 (external content IDs `arweave:tx:`), NIP-94 (file metadata, optional)
- Full decision record: `_bmad-output/planning-artifacts/research/party-mode-arweave-dvm-decisions-2026-03-22.md`

**NIP-to-TOON Skill Pipeline Architecture (Party Mode 2026-03-22 -- shapes Epic 9):**

A skill factory that converts any Nostr NIP into a TOON-aware Claude Agent Skill. Phase 0 builds the pipeline; Phases 1-10 run NIPs through it to produce the socialverse skill set. Skills encode social intelligence — when and why, not just how.

- **Pipeline over catalog (D9-001).** `nip-to-toon-skill` pipeline skill enables future NIP conversion. The 30 NIP skills are the first batch through the pipeline.
- **TOON-first, NIP-compatible (D9-002).** Every skill teaches TOON protocol (ILP-gated writes via `publishEvent()`, TOON-format reads) with vanilla NIP as baseline. No condition/fulfillment (D9-005) — simplified write model.
- **Social intelligence is cross-cutting (D9-003).** `nostr-social-intelligence` base skill provides interaction decision trees, context norms, trust signals, conflict resolution, anti-patterns. Each NIP skill adds a `## Social Context` section with interaction-specific etiquette.
- **Economics shape social norms (D9-004).** ILP paid-writes create quality floor. Cost-per-byte shapes interaction norms (reactions cheap but not free, long-form signals investment, chat incentivizes conciseness).
- **Skill-creator methodology adopted (D9-007).** `evals/evals.json` format, `grading.json`, `benchmark.json`, description optimization via `scripts.run_loop`, with/without baseline testing, blind comparison via comparator agents.
- **Why over rules (D9-008).** Skills explain reasoning, not rigid ALWAYS/NEVER. LLMs generalize better from explained reasoning.
- **Protocol changes propagate (D9-010).** `toon-protocol-context.md` is single source of truth. Update once, re-run affected skills through pipeline.
- **No ILP-peer NIPs (D9-006).** Excluded: NIP-13 (PoW), NIP-42 (relay auth), NIP-47 (wallet connect), NIP-57 (zaps), NIP-98 (HTTP auth) — ILP handles all these functions.
- **Socialverse prioritization.** Skills ordered by social fabric value: identity → content → community → curation → media → privacy → advanced social → git → DVM.
- Full decision record: Party Mode 2026-03-22 conversation (NIP Skills Epic)

**Terminology:**
- "ILP client" not "ILP/SPSP client" -- SPSP is not part of the protocol
- "TOON node" not "BLS" when referring to public-facing capabilities
- No STREAM protocol -- TOON sends raw ILP PREPARE/FULFILL with TOON data payloads
- "USDC" not "AGENT" -- AGENT token eliminated in Story 3.1
- "Attestation" not "verification" when referring to TEE state publication (kind:10033 is an attestation event)
- "PCR" (Platform Configuration Register) -- SHA-384 hashes measured by TEE hardware
- "DVM" (Data Vending Machine) -- NIP-90 compute marketplace protocol
- "Skill descriptor" -- Structured metadata in kind:10035 events advertising DVM capabilities

## @toon-protocol/core (Post-Epic 7)

Core now includes chain configuration, x402 support, seed relay discovery, service discovery, TEE attestation events, attestation verification, KMS identity derivation, Nix reproducible build infrastructure, NIP-90 DVM event builders/parsers, workflow chain events, agent swarm events, TEE-attested result verification, reputation scoring (reviews, WoT, composite scores), ILP address hierarchy (derivation, assignment, registry, BTP prefix exchange), route-aware fee calculation, and prefix claim/grant events.

**New Core Modules (Epic 7):**

```
packages/core/src/
├── address/
│   ├── derive-child-address.ts       # deriveChildAddress(parentPrefix, pubkey) (Story 7.1)
│   ├── ilp-address-validation.ts     # isValidIlpAddressStructure(), validateIlpAddress() (Story 7.1)
│   ├── btp-prefix-exchange.ts        # extractPrefixFromHandshake(), buildPrefixHandshakeData(),
│   │                                 # validatePrefixConsistency(), checkAddressCollision() (Story 7.2)
│   ├── address-assignment.ts         # assignAddressFromHandshake(), isGenesisNode() (Story 7.2)
│   ├── address-registry.ts           # AddressRegistry class (Story 7.3)
│   ├── prefix-validation.ts          # validatePrefix() (Story 7.6)
│   └── index.ts                      # Re-exports
├── fee/
│   ├── resolve-route-fees.ts         # resolveRouteFees() -- LCA-based route resolution (Story 7.5)
│   ├── calculate-route-amount.ts     # calculateRouteAmount() -- pure fee arithmetic (Story 7.5)
│   └── index.ts                      # Re-exports
├── events/
│   └── prefix-claim.ts              # buildPrefixClaimEvent(), parsePrefixClaimEvent(),
│                                     # buildPrefixGrantEvent(), parsePrefixGrantEvent() (Story 7.6)
└── constants.ts                      # +PREFIX_CLAIM_KIND (10034), PREFIX_GRANT_KIND (10037),
                                      #  ILP_ROOT_PREFIX ('g.toon') (Stories 7.1, 7.6)
```

**New Core Modules (Epic 6):**

```
packages/core/src/
├── events/
│   ├── workflow.ts               # buildWorkflowDefinitionEvent(), parseWorkflowDefinition() (Story 6.1)
│   ├── swarm.ts                  # buildSwarmRequestEvent(), buildSwarmSelectionEvent(),
│   │                             # parseSwarmRequest(), parseSwarmSelection() (Story 6.2)
│   ├── attested-result-verifier.ts # AttestedResultVerifier class, hasRequireAttestation() (Story 6.3)
│   ├── reputation.ts             # buildJobReviewEvent(), parseJobReview(), buildWotDeclarationEvent(),
│   │                             # parseWotDeclaration(), ReputationScoreCalculator, hasMinReputation() (Story 6.4)
│   ├── dvm.ts                    # +attestationEventId in JobResultParams/ParsedJobResult (Story 6.3)
│   └── service-discovery.ts      # +reputation field in SkillDescriptor (Story 6.4)
└── constants.ts                  # +WORKFLOW_CHAIN_KIND (10040), JOB_REVIEW_KIND (31117),
                                  #  WEB_OF_TRUST_KIND (30382) (Stories 6.1, 6.4)
```

**Core Modules (Epic 5):**

```
packages/core/src/
├── events/
│   └── dvm.ts                    # buildJobRequestEvent(), buildJobResultEvent(), buildJobFeedbackEvent(),
│                                 # parseJobRequest(), parseJobResult(), parseJobFeedback() (Story 5.1)
└── constants.ts                  # +JOB_REQUEST_KIND_BASE, JOB_RESULT_KIND_BASE, JOB_FEEDBACK_KIND,
                                  #  TEXT_GENERATION_KIND, IMAGE_GENERATION_KIND, TEXT_TO_SPEECH_KIND,
                                  #  TRANSLATION_KIND (Story 5.1)
```

**Core Modules (Epic 4):**

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

**Core Modules (Epics 1-3 + infrastructure):**

```
packages/core/src/
├── logger.ts                  # createLogger(), structured JSON logging (Epic 4 retro A2)
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
│   └── service-discovery.ts    # buildServiceDiscoveryEvent(), parseServiceDiscovery(), SkillDescriptor type (Stories 3.5 + 5.4)
├── discovery/
│   └── seed-relay-discovery.ts # SeedRelayDiscovery class, publishSeedRelayEntry() (Story 3.4)
└── constants.ts                # ILP_PEER_INFO_KIND, SERVICE_DISCOVERY_KIND, SEED_RELAY_LIST_KIND, TEE_ATTESTATION_KIND, DVM kind constants
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
class KmsIdentityError extends ToonError
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
class PcrReproducibilityError extends ToonError
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

**Core Public API Additions (Epic 5):**

```typescript
// DVM Event Kind Constants (Story 5.1)
JOB_REQUEST_KIND_BASE = 5000   // Base for job request range (5000-5999)
JOB_RESULT_KIND_BASE = 6000    // Base for job result range (6000-6999)
JOB_FEEDBACK_KIND = 7000       // Single kind for all job feedback
TEXT_GENERATION_KIND = 5100    // Reference DVM kind for text generation
IMAGE_GENERATION_KIND = 5200   // Image generation
TEXT_TO_SPEECH_KIND = 5300     // Text-to-speech
TRANSLATION_KIND = 5302        // Translation

// DVM Event Builders (Story 5.1)
buildJobRequestEvent(params: JobRequestParams, secretKey: Uint8Array): NostrEvent
buildJobResultEvent(params: JobResultParams, secretKey: Uint8Array): NostrEvent
buildJobFeedbackEvent(params: JobFeedbackParams, secretKey: Uint8Array): NostrEvent

// DVM Event Parsers (Story 5.1)
parseJobRequest(event: NostrEvent): ParsedJobRequest | null
parseJobResult(event: NostrEvent): ParsedJobResult | null
parseJobFeedback(event: NostrEvent): ParsedJobFeedback | null

// DVM Types (Story 5.1)
type DvmJobStatus = 'processing' | 'error' | 'success' | 'partial'
type JobRequestParams = { kind, input: { data, type, relay?, marker? }, bid, output, content?, targetProvider?, params?, relays? }
type JobResultParams = { kind, requestEventId, customerPubkey, amount, content }
type JobFeedbackParams = { requestEventId, customerPubkey, status, content? }
type ParsedJobRequest = { kind, input, bid, output, content, targetProvider?, params, relays }
type ParsedJobResult = { kind, requestEventId, customerPubkey, amount, content }
type ParsedJobFeedback = { requestEventId, customerPubkey, status, content }

// Skill Descriptor Type (Story 5.4 -- defined in service-discovery.ts)
type SkillDescriptor = { name, version, kinds: number[], features: string[], inputSchema, pricing: Record<string, string>, models?, attestation? }

// Service Discovery Extended (Story 5.4)
// ServiceDiscoveryContent now includes optional `skill?: SkillDescriptor` field
// parseServiceDiscovery() validates SkillDescriptor when present (lenient parse)
```

**Core Public API Additions (Epic 6):**

```typescript
// Workflow Chain Events (Story 6.1)
WORKFLOW_CHAIN_KIND = 10040
buildWorkflowDefinitionEvent(params: WorkflowDefinitionParams, secretKey: Uint8Array): NostrEvent
parseWorkflowDefinition(event: NostrEvent): ParsedWorkflowDefinition | null
type WorkflowStep = { kind, description, targetProvider?, bidAllocation? }
type WorkflowDefinitionParams = { steps: WorkflowStep[], initialInput: { data, type }, totalBid }
type ParsedWorkflowDefinition = { steps: WorkflowStep[], initialInput: { data, type }, totalBid, workflowId }

// Agent Swarm Events (Story 6.2)
buildSwarmRequestEvent(params: SwarmRequestParams, secretKey: Uint8Array): NostrEvent
buildSwarmSelectionEvent(params: SwarmSelectionParams, secretKey: Uint8Array): NostrEvent
parseSwarmRequest(event: NostrEvent): ParsedSwarmRequest | null
parseSwarmSelection(event: NostrEvent): ParsedSwarmSelection | null
type SwarmRequestParams = JobRequestParams & { maxProviders, judge? }
type SwarmSelectionParams = { requestEventId, customerPubkey, winnerResultEventId, content? }
type ParsedSwarmRequest = ParsedJobRequest & { maxProviders, judge }
type ParsedSwarmSelection = { requestEventId, customerPubkey, winnerResultEventId, status, content }

// TEE-Attested DVM Result Verification (Story 6.3)
class AttestedResultVerifier {
  constructor(options: AttestedResultVerificationOptions)
  verifyAttestedResult(resultEvent, parsedResult, attestationEvent, parsedAttestation): AttestedResultVerificationResult
}
hasRequireAttestation(params: { key, value }[]): boolean
type AttestedResultVerificationOptions = { attestationVerifier: AttestationVerifier }
type AttestedResultVerificationResult = { valid, reason?, attestationState? }
// JobResultParams extended with optional attestationEventId: string
// ParsedJobResult extended with optional attestationEventId: string

// Reputation Scoring System (Story 6.4)
JOB_REVIEW_KIND = 31117
WEB_OF_TRUST_KIND = 30382
buildJobReviewEvent(params: JobReviewParams, secretKey: Uint8Array): NostrEvent
parseJobReview(event: NostrEvent): ParsedJobReview | null
buildWotDeclarationEvent(params: WotDeclarationParams, secretKey: Uint8Array): NostrEvent
parseWotDeclaration(event: NostrEvent): ParsedWotDeclaration | null
class ReputationScoreCalculator {
  constructor()
  calculate(signals: ReputationSignals): ReputationScore
}
hasMinReputation(params: { key, value }[]): { required: boolean, threshold: number }
type JobReviewParams = { jobRequestEventId, targetPubkey, rating, role, content? }
type ParsedJobReview = { jobRequestEventId, targetPubkey, rating, role, content }
type WotDeclarationParams = { targetPubkey, content? }
type ParsedWotDeclaration = { targetPubkey, declarerPubkey, content }
type ReputationSignals = { trustedBy, channelVolumeUsdc, jobsCompleted, avgRating }
type ReputationScore = { score, signals: ReputationSignals }

// SkillDescriptor extended (Stories 6.3 + 6.4)
// SkillDescriptor now includes optional `reputation?: ReputationScore` field (Story 6.4)
// SkillDescriptor.attestation field now populated by buildSkillDescriptor() (Story 6.3)
```

**Core Public API Additions (Epic 7):**

```typescript
// ILP Address Hierarchy Constants (Story 7.1)
ILP_ROOT_PREFIX = 'g.toon'               // Root prefix for TOON network
PREFIX_CLAIM_KIND = 10034                 // Prefix claim event kind (Story 7.6)
PREFIX_GRANT_KIND = 10037                 // Prefix grant event kind (Story 7.6)

// Deterministic Address Derivation (Story 7.1)
deriveChildAddress(parentPrefix: string, pubkey: string): string
// Derives child ILP address: `${parentPrefix}.${pubkey.slice(0, 8).toLowerCase()}`

// ILP Address Validation (Story 7.1)
isValidIlpAddressStructure(address: string): boolean
validateIlpAddress(address: string): { valid: boolean, reason?: string }

// BTP Prefix Exchange (Story 7.2)
extractPrefixFromHandshake(handshakeData: Record<string, unknown>): string  // fail-closed
buildPrefixHandshakeData(prefix: string): BtpHandshakeExtension
validatePrefixConsistency(prefix: string, expectedParent: string): boolean
checkAddressCollision(address: string, existingAddresses: string[]): boolean
type BtpHandshakeExtension = { prefix: string }

// Address Assignment (Story 7.2)
assignAddressFromHandshake(handshakeData: Record<string, unknown>, ownPubkey: string): string
isGenesisNode(config: { ilpAddress?: string }): boolean

// AddressRegistry (Story 7.3)
class AddressRegistry {
  addAddress(upstreamPrefix: string, derivedAddress: string): void
  removeAddress(upstreamPrefix: string): string | undefined
  getAddresses(): string[]        // insertion-order stable
  hasPrefix(upstreamPrefix: string): boolean
  getPrimaryAddress(): string | undefined
  size(): number
}

// IlpPeerInfo extended (Stories 7.3, 7.4, 7.6)
// ilpAddresses?: string[]          -- all ILP addresses (multi-peered); defaults to [ilpAddress]
// feePerByte?: string              -- routing fee per byte as non-negative integer string; defaults to '0'
// prefixPricing?: { basePrice: string }  -- prefix claim marketplace pricing

// Prefix Validation (Story 7.6)
validatePrefix(prefix: string): PrefixValidationResult
type PrefixValidationResult = { valid: boolean, reason?: string }
// Rules: lowercase alphanumeric, 2-16 chars, no reserved words (toon, ilp, local, peer, test)

// Prefix Claim/Grant Events (Story 7.6)
buildPrefixClaimEvent(content: PrefixClaimContent, secretKey: Uint8Array): NostrEvent
parsePrefixClaimEvent(event: NostrEvent): PrefixClaimContent | null
buildPrefixGrantEvent(content: PrefixGrantContent, secretKey: Uint8Array): NostrEvent
parsePrefixGrantEvent(event: NostrEvent): PrefixGrantContent | null
type PrefixClaimContent = { requestedPrefix: string }
type PrefixGrantContent = { grantedPrefix: string, claimerPubkey: string, ilpAddress: string }

// Route-Aware Fee Calculation (Story 7.5)
resolveRouteFees(params: ResolveRouteFeesParams): ResolveRouteFeesResult
calculateRouteAmount(params: CalculateRouteAmountParams): bigint
type ResolveRouteFeesParams = { destination: string, ownIlpAddress: string, discoveredPeers: DiscoveredPeer[] }
type ResolveRouteFeesResult = { hopFees: bigint[], warnings: string[] }
type CalculateRouteAmountParams = { basePricePerByte: bigint, packetByteLength: number, hopFees: bigint[] }
// Formula: totalAmount = basePricePerByte * bytes + SUM(hopFees[i] * bytes)
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

## @toon-protocol/sdk (Epics 1+5+6+7 -- Complete)

The SDK is the main deliverable of Epic 1, extended in Epic 5 with DVM compute marketplace capabilities, in Epic 6 with stateful orchestration components (workflow chains, agent swarms), and in Epic 7 with route-aware fee calculation, prepaid protocol model, and prefix claim handler. It provides a developer-facing abstraction for building ILP-gated Nostr services with the TOON protocol.

**SDK Source Files (Post-Epic 7):**

```
packages/sdk/src/
├── index.ts                    # Public API exports (+ workflow orchestrator, swarm coordinator, skill descriptor, prefix claim handler)
├── identity.ts                 # generateMnemonic(), fromMnemonic(), fromSecretKey()
├── errors.ts                   # IdentityError, NodeError, HandlerError, VerificationError, PricingError
├── handler-registry.ts         # HandlerRegistry: .on(kind), .onDefault(), dispatch(), getDvmKinds() (Story 5.4)
├── handler-context.ts          # HandlerContext: toon, kind, pubkey, amount, decode(), accept(), reject()
├── verification-pipeline.ts    # Schnorr verification (or devMode skip)
├── pricing-validator.ts        # Per-byte, per-kind pricing with self-write bypass
├── payment-handler-bridge.ts   # isTransit fire-and-forget vs await semantics
├── create-node.ts              # createNode() composition + ServiceNode lifecycle + DVM methods + route-aware fees + claimPrefix (Stories 5.3, 5.4, 7.5, 7.6)
├── skill-descriptor.ts         # buildSkillDescriptor() -- computes SkillDescriptor from registry (Stories 5.4, 6.3, 6.4)
├── workflow-orchestrator.ts    # WorkflowOrchestrator -- multi-step DVM pipeline state machine (Story 6.1)
├── swarm-coordinator.ts        # SwarmCoordinator -- competitive DVM bidding state machine (Story 6.2)
├── prefix-claim-handler.ts     # createPrefixClaimHandler() -- kind:10034 prefix claim handler factory (Story 7.6)
├── event-storage-handler.ts    # Stub -- throws, directs users to @toon-protocol/town
└── __integration__/
    ├── create-node.test.ts
    └── network-discovery.test.ts
```

**SDK Public API (Post-Epic 7):**

```typescript
// Identity
generateMnemonic(): string
fromMnemonic(mnemonic: string, options?: FromMnemonicOptions): NodeIdentity
fromSecretKey(secretKey: Uint8Array): NodeIdentity

// Node composition
createNode(config: NodeConfig): ServiceNode

// Skill descriptor builder (Stories 5.4, 6.3, 6.4)
buildSkillDescriptor(registry: HandlerRegistry, config?: BuildSkillDescriptorConfig): SkillDescriptor | undefined

// ServiceNode interface (extended in Epics 5+6)
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
  publishEvent(event: NostrEvent, options?: { destination: string; amount?: bigint; bid?: bigint }): Promise<PublishEventResult>;
  // amount: overrides basePricePerByte * bytes (prepaid model, Story 7.6)
  // bid: client-side safety cap -- throws if destination amount exceeds bid (Story 7.6)
  // Route fees from resolveRouteFees() are added automatically on top of the destination amount (Story 7.5)

  // DVM methods (Epic 5)
  publishFeedback(requestEventId, customerPubkey, status, content?, options?): Promise<PublishEventResult>;  // Story 5.3
  publishResult(requestEventId, customerPubkey, amount, content, options?): Promise<PublishEventResult>;      // Story 5.3
  /** @deprecated Use publishEvent() with { amount } option instead (prepaid model, Story 7.6) */
  settleCompute(resultEvent, providerIlpAddress, options?): Promise<IlpSendResult>;                          // Story 5.3
  getSkillDescriptor(): SkillDescriptor | undefined;                                                          // Story 5.4

  // Prefix claim (Epic 7)
  claimPrefix(prefix: string, upstreamDestination: string, options?: { prefixPrice?: bigint }): Promise<PublishEventResult>;  // Story 7.6
}

// Workflow Orchestrator (Story 6.1)
class WorkflowOrchestrator {
  constructor(node: ServiceNode, workflow: ParsedWorkflowDefinition, options?: WorkflowOrchestratorOptions)
  getState(): WorkflowState;
  getCurrentStepIndex(): number;
  start(): Promise<void>;              // Publishes step 0 job request
  handleStepResult(resultEvent: NostrEvent): Promise<void>;  // Advance to next step or complete
  handleStepFailure(feedbackEvent: NostrEvent): Promise<void>;  // Abort workflow
}
type WorkflowState = 'pending' | `step_${number}_running` | `step_${number}_failed` | 'completed'
interface WorkflowEventStore { store(event): Promise<void>; query(filter): Promise<NostrEvent[]> }
interface WorkflowOrchestratorOptions { secretKey?, stepTimeoutMs?, now?, eventStore?, destination?, workflowEventId?, customerPubkey? }

// Swarm Coordinator (Story 6.2)
class SwarmCoordinator {
  constructor(node: ServiceNode, options?: SwarmCoordinatorOptions)
  getState(): SwarmState;
  getSubmissions(): NostrEvent[];
  startSwarm(swarmRequestEvent: NostrEvent): void;         // Begin collecting submissions
  handleSubmission(resultEvent: NostrEvent): void;          // Collect provider submissions
  selectWinner(selectionEvent: NostrEvent): Promise<void>;  // Pay winner via settleCompute()
}
type SwarmState = 'collecting' | 'judging' | 'settled' | 'failed'
interface SwarmCoordinatorOptions { secretKey?, timeoutMs?, eventStore?, destination? }

// HandlerRegistry additions (Epic 5)
class HandlerRegistry {
  getDvmKinds(): number[];  // Returns registered kinds in 5000-5999 range (Story 5.4)
}

// BuildSkillDescriptorConfig additions (Epic 6)
interface BuildSkillDescriptorConfig {
  // ... existing fields from Epic 5 ...
  reputation?: ReputationScore;                    // Story 6.4: pre-computed reputation score
  attestation?: { eventId, enclaveImageHash };    // Story 6.3: TEE attestation metadata
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

**SDK Changes in Epic 5 (DVM Compute Marketplace):**
- `NodeConfig.skillConfig` field added: optional overrides for auto-derived skill descriptors (Story 5.4)
- `HandlerRegistry.getDvmKinds()` added: returns registered kinds in 5000-5999 range (Story 5.4)
- `ServiceNode.publishFeedback()` added: builds Kind 7000 feedback event, delegates to `publishEvent()` (Story 5.3)
- `ServiceNode.publishResult()` added: builds Kind 6xxx result event, delegates to `publishEvent()` (Story 5.3)
- `ServiceNode.settleCompute()` added: pure ILP value transfer for compute payment (Story 5.3)
- `ServiceNode.getSkillDescriptor()` added: computed from handler registry and config (Story 5.4)
- `buildSkillDescriptor()` exported: auto-populates `SkillDescriptor` from registry's DVM kinds and pricing config (Story 5.4)
- Zero production code changes required for DVM job submission (Story 5.2): pipeline is kind-agnostic
- `direct-ilp-client.ts` fix: empty-data guard enables pure value transfers for compute settlement (Story 5.3)

**SDK Changes in Epic 6 (Advanced DVM Coordination + TEE):**
- `WorkflowOrchestrator` class added: stateful multi-step DVM pipeline orchestration with state machine, step advancement, per-step settlement, timeout handling, and failure propagation (Story 6.1)
- `SwarmCoordinator` class added: competitive DVM execution with submission collection, winner selection, settlement to winner only, timeout-based judging (Story 6.2)
- `BuildSkillDescriptorConfig.attestation` field added: TEE attestation metadata (eventId, enclaveImageHash) for skill descriptor (Story 6.3)
- `BuildSkillDescriptorConfig.reputation` field added: pre-computed `ReputationScore` for skill descriptor (Story 6.4)
- `buildSkillDescriptor()` now validates attestation eventId format (64-char hex) when provided (Story 6.3)
- `SkillDescriptor.reputation` field populated from config when `ReputationScore` is provided (Story 6.4)
- Both orchestration components are the first **stateful** SDK components -- they maintain internal state machines across multiple ILP packet cycles

**SDK Changes in Epic 7 (ILP Address Hierarchy & Protocol Economics):**
- `publishEvent()` signature extended with optional `amount` and `bid` parameters (Story 7.6): `amount` overrides the default `basePricePerByte * bytes` calculation (prepaid model); `bid` is a client-side safety cap that throws before sending if the destination amount exceeds the bid
- Route-aware fee calculation wired transparently into `publishEvent()` (Story 7.5): `resolveRouteFees()` computes per-hop fees from discovered peers' kind:10032 `feePerByte` data, `calculateRouteAmount()` sums destination write fee plus intermediary hop fees -- zero API surface change for callers
- `settleCompute()` deprecated (Story 7.6): still functional for backward compatibility, but emits deprecation warning. Prepaid model replaces it -- use `publishEvent()` with `{ amount }` option instead
- `claimPrefix()` method added to `ServiceNode` (Story 7.6): sends kind:10034 prefix claim event with payment via `publishEvent()` amount override. Looks up upstream's `prefixPricing.basePrice` from discovery if no explicit `prefixPrice` option provided
- `createPrefixClaimHandler()` factory function added (Story 7.6): creates a handler for kind:10034 prefix claim events with payment validation, prefix format validation, atomicity via injectable `claimPrefix` callback, and grant event publication
- `PrefixClaimHandlerOptions` type exported: `{ prefixPricing, secretKey, getClaimedPrefixes, claimPrefix, publishGrant, ilpAddressPrefix? }`

## @toon-protocol/town (Epics 2+3+4+5 -- Complete)

The Town package is the main deliverable of Epics 2 and 3, extended in Epic 4 with TEE health integration and in Epic 5 with DVM skill descriptor propagation. It validates the SDK by reimplementing the Nostr relay as composable SDK handlers, with x402 HTTP payment on-ramp, service discovery, seed relay discovery, enriched health endpoints, TEE attestation state reporting, and DVM capability advertisement.

**Town Source Files (Post-Epic 5):**

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

**Town Public API (Post-Epic 5):**

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
  ilpAddress?: string;                    // default: g.toon.<pubkeyShort>
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

  // DVM (Epic 5)
  skill?: SkillDescriptor;                // optional DVM skill descriptor for service discovery (Story 5.4)

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

Epic 4 delivered the TEE (Trusted Execution Environment) integration layer for the TOON protocol, enabling verifiable code integrity guarantees.

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

**Oyster CVM Container Architecture (Story 4.1, updated 2026-03-18):**

```
+--------------- Oyster CVM ---------------+
|  toon (priority=10):                     |
|    Embedded ConnectorNode (BTP:3000)     |
|    + Relay (WS:7100) + BLS (HTTP:3100)   |
|    + Bootstrap Service                   |
|  attestation-server (priority=20):       |
|    HTTP (:1300) /attestation/raw         |
|    + kind:10033 publisher (to local WS)  |
+-------- vsock proxy --------------------+
         (inbound/outbound)
    Public Internet
```

- **supervisord** manages two processes: toon (priority=10) and attestation (priority=20)
- The connector is **EMBEDDED** -- ConnectorNode runs in-process via `entrypoint-sdk.js`
- The enclave is fully self-contained; no external connector container needed
- Marlin's dual-proxy architecture handles networking (inbound/outbound vsock)
- Non-root `toon` user (uid 1001) for container execution

**Oyster CVM Testnet Deployment (2026-03-18):**

Dual-chain architecture:
- **CVM payment**: Arbitrum One (42161) -- pays Marlin for enclave runtime
- **TOON settlement**: Arbitrum Sepolia (421614) -- payment channels between nodes

Wallet inventory (keys in `.env.oyster`, gitignored):

| Role | Address | Arb Sepolia ETH | Arb Sepolia USDC |
|------|---------|-----------------|------------------|
| Deployer (CVM payment) | `0x1caac55...468F` | ~0.085 (reserve) | 17 (reserve) |
| Town Node 1 (Oyster) | `0xa5faA17...4320` | 0.005 | 1 |
| Town Node 2 (test peer) | `0xc2cB0db...2F8D` | 0.005 | 1 |
| Client (end user) | `0x81CD520...bBb0` | 0.005 | 1 |

- Deployer also holds 0.005 ETH + 5 USDC on Arbitrum One for CVM instance payment
- Settlement USDC (Arb Sepolia): `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
- Circle testnet faucet: https://faucet.circle.com/ (20 USDC per request)
- `TOON_CHAIN=arbitrum-sepolia` activates the chain preset via `resolveChainConfig()`
- **TokenNetwork contract not yet deployed on Arbitrum Sepolia** -- needed for payment channel settlement

**Attestation Server (Stories 4.1 + 4.2):**

```typescript
// Endpoints
GET /attestation/raw  // Returns attestation document (placeholder in Story 4.1)
GET /health           // Returns { status: 'ok', tee: boolean }

// Lifecycle
// 1. Starts after toon node (priority=20 vs priority=10)
// 2. Reads attestation data from TEE environment (placeholder: readAttestationData())
// 3. Publishes kind:10033 event to local relay via WebSocket
// 4. Refreshes on ATTESTATION_REFRESH_INTERVAL (default: 300s)

// Environment variables
ATTESTATION_PORT             // HTTP port (default: 1300)
ATTESTATION_REFRESH_INTERVAL // Seconds between refreshes (default: 300)
TEE_ENABLED                  // Set by Oyster CVM runtime when in enclave
NOSTR_SECRET_KEY             // 64-char hex secret key for event signing
WS_PORT                      // WebSocket relay port (default: 7100)
TOON_CHAIN              // Chain preset name (default: '31337')
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
- `KmsIdentityError` extends `ToonError` -- signals security-critical condition that must NEVER fall back to random keys
- Lives in `@toon-protocol/core` (not SDK) because Docker entrypoints import from core

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

## DVM Compute Marketplace (Epics 5+6 -- Complete)

Epics 5 and 6 together delivered the full DVM (Data Vending Machine) Compute Marketplace for the TOON protocol: ILP-native compute job submission, result delivery, settlement, programmatic agent-to-agent service discovery (Epic 5), plus multi-step workflow pipelines, competitive agent swarms, TEE-attested results with cryptographic verification, and composite reputation scoring with sybil defenses (Epic 6).

**Epic 5 Stories:**
| Story | Title | Package | Deliverables |
|-------|-------|---------|-------------|
| 5-1 | DVM Event Kind Definitions | core | NIP-90 builders/parsers, kind constants (5xxx, 6xxx, 7000) |
| 5-2 | ILP-Native Job Submission | sdk (tests only) | Validation that pipeline handles Kind 5xxx events with zero production code changes |
| 5-3 | Job Result Delivery and Compute Settlement | sdk + core | publishFeedback(), publishResult(), settleCompute(), direct-ilp-client empty-data fix |
| 5-4 | Skill Descriptors in Service Discovery | core + sdk + town | SkillDescriptor type, buildSkillDescriptor(), getDvmKinds(), kind:10035 skill field |

**Key Architectural Insights:**

- **Zero production code changes for job submission (Story 5.2):** The SDK pipeline is genuinely kind-agnostic. Kind 5xxx events flow through the same shallow parse -> verify -> price -> dispatch pipeline as all other events. This validates the Epic 1 architectural bet.
- **Pure value transfers expand ILP's role (Story 5.3):** `settleCompute()` sends ILP packets with empty data -- payment without event payload. The `direct-ilp-client.ts` fix (`data.length > 0` guard) separates payment from data carriage: event publishing carries both, compute settlement carries payment alone.
- **Skill descriptors enable automated agent marketplace (Story 5.4):** Agents discover providers via kind:10035, inspect `inputSchema` (JSON Schema draft-07), compare pricing, and construct valid job requests without human intermediation.

**DVM Event Architecture (NIP-90):**

```
Customer                    Provider                    Customer
   │                           │                           │
   │  Kind 5xxx (Job Request)  │                           │
   │  tags: i, bid, output     │                           │
   │ ─────────────────────────►│                           │
   │                           │                           │
   │  Kind 7000 (Feedback)     │                           │
   │  status: 'processing'     │                           │
   │◄───────────────────────── │                           │
   │                           │                           │
   │  Kind 6xxx (Job Result)   │                           │
   │  tags: e, p, amount       │                           │
   │◄───────────────────────── │                           │
   │                           │                           │
   │  settleCompute()          │                           │
   │  (pure ILP value transfer)│                           │
   │ ─────────────────────────►│                           │
```

- **Kind 5xxx tags (required):** `['i', data, type, relay?, marker?]`, `['bid', amount, 'usdc']`, `['output', mimeType]`
- **Kind 5xxx tags (optional):** `['p', targetProvider]`, `['param', key, value]`, `['relays', url1, ...]`
- **Kind 6xxx tags (required):** `['e', requestEventId]`, `['p', customerPubkey]`, `['amount', cost, 'usdc']`
- **Kind 7000 tags (required):** `['e', requestEventId]`, `['p', customerPubkey]`, `['status', statusValue]`
- **TOON extension:** `bid` and `amount` tags include a third element `'usdc'` for explicit currency declaration (NIP-90 uses satoshis; TOON uses USDC micro-units)

**Skill Descriptor (Story 5.4):**

```typescript
// Embedded in kind:10035 ServiceDiscoveryContent.skill field
interface SkillDescriptor {
  name: string;           // e.g., 'toon-dvm'
  version: string;        // e.g., '1.0'
  kinds: number[];        // supported DVM kinds, e.g., [5100, 5200]
  features: string[];     // capability list, e.g., ['text-generation', 'streaming']
  inputSchema: Record<string, unknown>;  // JSON Schema draft-07 for job request params
  pricing: Record<string, string>;       // kind (as string) -> USDC micro-units cost (as string)
  models?: string[];      // available AI models, e.g., ['gpt-4', 'claude-3']
  attestation?: Record<string, unknown>; // placeholder for Epic 6 TEE attestation
}
```

- **Auto-derived from registry:** `buildSkillDescriptor()` reads `registry.getDvmKinds()` and maps pricing from `kindPricing` overrides or `basePricePerByte` fallback
- **Returns `undefined` when no DVM handlers registered:** Backward compatible with pre-DVM kind:10035 events
- **`getSkillDescriptor()` reads live:** Computed on each call from current registry state. No auto-re-publication on handler change (deferred to Epic 6 A11).
- **Town integration:** `TownConfig.skill` passes the descriptor to `buildServiceDiscoveryEvent()` which includes it in the `skill` field of the JSON content

**Compute Settlement (Story 5.3):**

```typescript
// settleCompute() flow:
// 1. parseJobResult(resultEvent) -> extract amount from 'amount' tag
// 2. Validate amount is non-negative numeric string
// 3. Optional E5-R005 bid validation: amount <= originalBid
// 4. ilpClient.sendIlpPacket({ destination: providerIlpAddress, amount, data: '' })
//    Empty data = pure value transfer (no TOON event payload)
```

- **Bid validation (E5-R005):** Optional `originalBid` parameter. If provided, `settleCompute()` rejects if `amount > originalBid` (overcharge protection)
- **Direct ILP client fix:** `data.length > 0` guard in `createDirectIlpClient()` skips execution condition computation for empty-data packets
- **publishFeedback() and publishResult()** are thin wrappers: build the appropriate event with `buildJobFeedbackEvent()`/`buildJobResultEvent()`, then delegate to `publishEvent()` for TOON encoding and ILP delivery

**Docker E2E Test Infrastructure (Epic 5):**

```
packages/sdk/tests/e2e/
├── docker-publish-event-e2e.test.ts      # Event publishing (migrated from mocks to Docker)
├── docker-dvm-submission-e2e.test.ts     # DVM job submission (11 tests, Story 5.2)
├── docker-dvm-lifecycle-e2e.test.ts      # DVM lifecycle (16 tests, Story 5.3)
└── helpers/
    └── docker-e2e-setup.ts               # Shared constants, ABIs, node factories, health checks
```

- **No-mock integration policy:** All SDK integration/E2E tests use real Docker containers via `sdk-e2e-infra.sh`. `MockEmbeddedConnector` eliminated.
- **Shared helper module:** `docker-e2e-setup.ts` extracts contract ABIs, deterministic addresses, test key derivation, and node factory functions used across all Docker E2E test files.

**Epic 5 Metrics (Final -- 4/4 stories):**

| Metric | Value |
|--------|-------|
| Stories delivered | 4/4 (100%) |
| Acceptance criteria | 27 total, 27 covered (100%) |
| Story-specific tests | 279 |
| Monorepo test count (start) | 1,843 passed / 79 skipped (1,922 total) |
| Monorepo test count (end) | 2,159 passed / 79 skipped (2,238 total) |
| Code review issues | 33 found, 24 fixed, 9 acknowledged, 0 remaining |
| Security scan findings (production) | 0 |
| NFR assessments | 4/4 PASS (second 100% consecutive epic) |
| Test regressions | 0 |
| New runtime dependencies | 0 |

## Advanced DVM Coordination + TEE Integration (Epic 6 -- Complete)

Epic 6 delivered the Advanced DVM Coordination and TEE Integration layer: multi-step workflow pipelines, competitive agent swarms, TEE-attested DVM results with cryptographic verification, and composite reputation scoring with sybil defenses.

**Epic 6 Stories:**
| Story | Title | Package | Deliverables |
|-------|-------|---------|-------------|
| 6-1 | Workflow Chains | core + sdk | Kind:10040 workflow definition, WorkflowOrchestrator state machine, step advancement, per-step settlement |
| 6-2 | Agent Swarms | core + sdk | Swarm request/selection events, SwarmCoordinator state machine, competitive submission collection, winner-only settlement |
| 6-3 | TEE-Attested DVM Results | core + sdk | AttestedResultVerifier (3-check chain), attestationEventId in Kind 6xxx, hasRequireAttestation(), skill descriptor attestation field |
| 6-4 | Reputation Scoring System | core + sdk | Kind 31117 (Job Review), Kind 30382 (WoT), ReputationScoreCalculator, hasMinReputation(), reputation in SkillDescriptor |

**Workflow Chains (Story 6.1):**

```
Customer                    WorkflowOrchestrator              Provider A      Provider B
   │                              │                              │                │
   │  Kind 10040 (Workflow Def)   │                              │                │
   │  steps: [A(5100), B(5200)]   │                              │                │
   │  totalBid: 1000              │                              │                │
   │ ─────────────────────────────►                              │                │
   │                              │  Kind 5100 (Step 0 Request)  │                │
   │                              │ ─────────────────────────────►                │
   │                              │  Kind 6100 (Step 0 Result)   │                │
   │                              │◄──────────────────────────── │                │
   │                              │  settleCompute(step 0)       │                │
   │                              │ ─────────────────────────────►                │
   │                              │  Kind 5200 (Step 1 Request)  │                │
   │                              │  input = step 0 result       │                │
   │                              │ ──────────────────────────────────────────────►
   │                              │  Kind 6200 (Step 1 Result)   │                │
   │                              │◄──────────────────────────────────────────────│
   │                              │  settleCompute(step 1)       │                │
   │                              │ ──────────────────────────────────────────────►
   │  Kind 7000 (Complete)        │                              │                │
   │◄──────────────────────────── │                              │                │
```

- **State machine:** `pending` -> `step_N_running` -> `step_N_failed` (abort) or -> `completed` (all steps done)
- **Per-step settlement:** `sum(step_amounts) <= total_bid` validated before each settlement
- **Timeout handling:** Configurable per-step timeout (default 5 min); timeout -> `step_N_failed`
- **Forward-compatible with Epic 7 prepaid protocol:** Settlement logic isolated in `handleStepResult()`

**Agent Swarms (Story 6.2):**

```
Customer                    SwarmCoordinator        Provider 1    Provider 2    Provider 3
   │                              │                    │             │             │
   │  Kind 5xxx (Swarm Request)   │                    │             │             │
   │  tags: swarm=3, judge=cust   │                    │             │             │
   │ ─────────────────────────────►                    │             │             │
   │                              │ ──[broadcast]──────►─────────────►─────────────►
   │                              │  Kind 6xxx (sub1)  │             │             │
   │                              │◄───────────────────│             │             │
   │                              │  Kind 6xxx (sub2)  │             │             │
   │                              │◄──────────────────────────────── │             │
   │                              │  Kind 6xxx (sub3)  │             │             │
   │                              │◄─────────────────────────────────────────────── │
   │                              │  -> state: judging │             │             │
   │  Kind 7000 (Selection)       │                    │             │             │
   │  tags: winner=sub2_event_id  │                    │             │             │
   │ ─────────────────────────────►                    │             │             │
   │                              │  settleCompute()   │             │             │
   │                              │ ──────────────────────────────── ►             │
```

- **State machine:** `collecting` -> `judging` (timeout or max reached) -> `settled` (winner paid) or `failed`
- **Swarm tags are additive:** Standard Kind 5xxx with `['swarm', maxProviders]` and `['judge', judgeId]` tags. Non-swarm-aware providers can still participate.
- **Winner-only settlement:** Only the winning provider receives compute payment. Losers paid relay write fees only (sunk cost by design).
- **Deduplication:** Duplicate submissions from same provider are silently ignored.

**TEE-Attested DVM Results (Story 6.3):**

```
1. Provider runs in TEE, has kind:10033 attestation on relay
2. Provider receives Kind 5xxx request with require_attestation=true param
3. Provider attaches attestation reference: ['attestation', attestationEventId] tag on Kind 6xxx result
4. Customer fetches kind:10033 from relay
5. AttestedResultVerifier performs 3-check chain:
   (a) Pubkey match: attestationEvent.pubkey === resultEvent.pubkey
   (b) PCR validity: AttestationVerifier.verify(parsedAttestation.attestation)
   (c) Time validity: attestation was VALID at resultEvent.created_at
6. Result: { valid: true/false, reason?, attestationState? }
```

- **AttestedResultVerifier is pure logic** -- No transport concerns; caller provides attestation event
- **Time injection at call site** -- Uses `resultEvent.created_at` as the `now` parameter (not constructor-injected)
- **`hasRequireAttestation(params)`** -- Utility to check if job request includes `require_attestation=true`
- **Skill descriptor attestation field** -- `buildSkillDescriptor()` now accepts `attestation: { eventId, enclaveImageHash }` config

**Reputation Scoring System (Story 6.4):**

```
Composite Formula:
  score = (trustedBy * 100) + (log10(max(1, channelVolumeUsdc)) * 10) + (jobsCompleted * 5) + (avgRating * 20)

Signals:
  - trustedBy: Count of Kind 30382 WoT declarations from non-zero-volume declarers (sybil defense)
  - channelVolumeUsdc: Total USDC settled through payment channels (logarithmic dampening)
  - jobsCompleted: Count of Kind 6xxx results published (linear scaling)
  - avgRating: Mean of Kind 31117 reviews rated 1-5 (customer-gated: only job participants can review)
```

- **Kind 31117 (Job Review):** NIP-33 parameterized replaceable. `d` tag = job request event ID enforces one review per job per reviewer. Tags: `d`, `p` (target), `rating` (1-5), `role` (customer/provider).
- **Kind 30382 (Web of Trust):** NIP-33 parameterized replaceable. `d` tag = target pubkey enforces one WoT declaration per declarer per target.
- **ReputationScoreCalculator:** Pure logic class. `calculate(signals)` returns `{ score, signals }`. Handles NaN/Infinity/negative inputs defensively (returns finite score or 0).
- **`hasMinReputation(params)`:** Extracts `min_reputation` threshold from parsed job request params. Enables provider self-filtering.
- **Self-reported reputation:** Providers embed scores in Kind 10035 skill descriptors. Independently verifiable but not protocol-enforced (acknowledged design tradeoff).
- **Sybil defenses:** Customer-gated reviews (only job participants can review), threshold WoT (endorsements from established nodes only).

**Epic 6 Metrics (Final -- 4/4 stories):**

| Metric | Value |
|--------|-------|
| Stories delivered | 4/4 (100%) |
| Acceptance criteria | 21 total, 21 covered (100%) |
| Story-specific tests | 286 |
| Monorepo test count (start) | 2,144 passed (baseline after epic start cleanup) |
| Monorepo test count (end) | 2,526 passed |
| Code review issues | 44 found, 38 fixed, 6 acknowledged (low), 0 remaining |
| Security scan findings (production) | 0 (3rd consecutive epic) |
| NFR assessments | 4/4 PASS (3rd consecutive 100%) |
| Test regressions | 0 (6th consecutive epic) |
| New runtime dependencies | 0 (2nd consecutive epic) |

## ILP Address Hierarchy & Protocol Economics (Epic 7 -- Complete)

Epic 7 delivered hierarchical ILP addressing, multi-hop fee calculation, and a prefix claim marketplace for the TOON protocol. The flat addressing model (`g.toon.genesis`, `g.toon.peer1`) was replaced with topology-derived hierarchy where addresses are deterministically computed as `${parentPrefix}.${childPubkey.slice(0, 8)}`. Fee calculation became invisible to SDK users -- `publishEvent()` sums intermediary fees along the route path internally. The prepaid protocol model was introduced, deprecating `settleCompute()` in favor of single-packet payment-with-message semantics.

**Epic 7 Stories:**
| Story | Title | Package | Deliverables |
|-------|-------|---------|-------------|
| 7-1 | Deterministic Address Derivation | core | deriveChildAddress(), ILP_ROOT_PREFIX, address validation |
| 7-2 | BTP Address Assignment Handshake | core | BTP prefix exchange, assignAddressFromHandshake(), isGenesisNode() |
| 7-3 | Multi-Address Support for Multi-Peered Nodes | core | AddressRegistry class, ilpAddresses field in IlpPeerInfo |
| 7-4 | Fee-Per-Byte Advertisement in kind:10032 | core | feePerByte field in IlpPeerInfo, builder/parser extensions |
| 7-5 | SDK Route-Aware Fee Calculation | core + sdk | resolveRouteFees() LCA algorithm, calculateRouteAmount(), transparent publishEvent() integration |
| 7-6 | Prepaid Protocol and Prefix Claims | core + sdk | publishEvent() amount/bid options, settleCompute() deprecation, kind:10034/10037 events, createPrefixClaimHandler(), claimPrefix() |

**Address Hierarchy:**

```
g.toon                          (genesis node -- ILP_ROOT_PREFIX)
├── g.toon.ef567890             (peer A, derived from pubkey[:8])
│   ├── g.toon.ef567890.ab12cd34  (peer A's downstream)
│   └── g.toon.ef567890.useast    (vanity prefix via prefix claim)
└── g.toon.12345678             (peer B)
```

- **Genesis nodes** use `ILP_ROOT_PREFIX` (`g.toon`) directly -- `isGenesisNode()` checks this
- **All other nodes** derive addresses via `deriveChildAddress(upstreamPrefix, ownPubkey)` -- appends first 8 hex chars of pubkey as lowercase segment
- **Multi-peered nodes** have multiple addresses (one per upstream peer), tracked by `AddressRegistry`
- **BTP handshake** communicates the upstream prefix via `BtpHandshakeExtension` -- fail-closed: throws if prefix is absent or invalid (no fallback to hardcoded addresses)
- **Vanity prefixes** (e.g., `useast`) obtained via kind:10034 prefix claim marketplace -- payment + claim in one ILP packet

**Route-Aware Fee Calculation (Story 7.5 -- architectural centerpiece):**

```
Sender (g.toon.aaaa)  -->  Intermediary (g.toon)  -->  Destination (g.toon.bbbb)
                           feePerByte: 2n                basePricePerByte: 10n

Total = basePricePerByte * bytes + SUM(hopFees[i] * bytes)
      = 10n * 100 + 2n * 100 = 1200n
```

- **LCA-based route resolution:** `resolveRouteFees()` splits sender and destination ILP addresses into segments, finds Lowest Common Ancestor, identifies intermediary hops on the path
- **Fee map built from kind:10032 peer discovery data:** each discovered peer's `feePerByte` field is mapped to its ILP address
- **Unknown intermediaries default to `feePerByte: 0n` with warning** -- graceful degradation for partially-discovered networks
- **Transparently wired into `publishEvent()`** -- zero API surface change; callers do not see fees, fee parameters, or route information

**Prepaid Protocol Model (Story 7.6):**

All monetized protocol flows follow the same single-packet payment-with-message pattern (D7-004):
1. Provider advertises capability + price in replaceable Nostr event
2. Customer discovers price via kind:10032/10035
3. Customer sends message + payment in ONE ILP PREPARE packet via `publishEvent({ amount })`

Three use cases now follow this pattern:
- **Relay write:** `publishEvent(event, { destination })` -- amount defaults to `basePricePerByte * bytes`
- **DVM compute:** `publishEvent(jobRequestEvent, { destination, amount: providerPrice })` -- amount from `SkillDescriptor.pricing`
- **Prefix claim:** `claimPrefix(prefix, upstream)` or `publishEvent(claimEvent, { destination, amount })` -- amount from `prefixPricing.basePrice`

**Prefix Claim Marketplace (Story 7.6):**

```
Customer                    Upstream Node
   │                           │
   │  Kind 10034 (Claim)       │  ILP PREPARE: amount >= prefixPricing.basePrice
   │  content: { requestedPrefix: 'useast' }
   │ ─────────────────────────►│
   │                           │  validates: payment, format, availability
   │                           │  atomically claims via claimPrefix callback
   │  Kind 10037 (Grant)       │
   │  content: { grantedPrefix, claimerPubkey, ilpAddress }
   │◄───────────────────────── │
```

- **`createPrefixClaimHandler()`** validates payment >= `prefixPricing.basePrice`, prefix format via `validatePrefix()`, and availability via injectable `claimPrefix` callback
- **Prefix format rules:** lowercase alphanumeric, 2-16 chars, no reserved words (`toon`, `ilp`, `local`, `peer`, `test`)
- **Atomicity:** in-memory `Set` via injectable `claimPrefix` callback; single-process Node.js event loop guarantees no concurrent races
- **`claimPrefix()` on ServiceNode:** looks up upstream's `prefixPricing.basePrice` from discovery if no explicit `prefixPrice` option provided

**Epic 7 Metrics (Final -- 6/6 stories):**

| Metric | Value |
|--------|-------|
| Stories delivered | 6/6 (100%; 7.6 and 7.7 consolidated) |
| Acceptance criteria | 35 total, 35 covered (100%) |
| Story-specific tests | ~223 |
| Monorepo test count (start) | 2,526 passed |
| Monorepo test count (end) | 2,659 passed / 79 skipped (2,738 total) |
| Code review issues | 28 found, 25 fixed, 3 noted, 0 remaining |
| Security scan findings (production) | 4 (all fixed, Story 7-5) |
| NFR assessments | 6/6 PASS (4th consecutive 100%) |
| Test regressions | 0 (7th consecutive epic) |
| New runtime dependencies | 0 (3rd consecutive epic) |

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
- **Core sub-path exports** -- `@toon-protocol/core/toon` and `@toon-protocol/core/nip34` are valid import paths (configured in core's package.json `exports`)

**Error Handling:**

- **Core errors:** `ToonError` (base), `InvalidEventError`, `PeerDiscoveryError`, `KmsIdentityError` (Epic 4), `PcrReproducibilityError` (Epic 4)
- **SDK errors (extend ToonError):** `IdentityError`, `NodeError`, `HandlerError`, `VerificationError`, `PricingError`
- **Error code mapping to ILP:** VerificationError -> F06, PricingError -> F04, HandlerError -> T00, No handler -> F00
- **All async operations must handle errors** -- No unhandled promise rejections
- **Validate external data at boundaries** -- Always validate Nostr event signatures before processing
- **KmsIdentityError signals a security-critical condition** -- NEVER fall back to random keys when KMS seed derivation fails

**TOON Format Handling (Critical):**

- **TOON codec lives in `@toon-protocol/core/toon`** -- Extracted from BLS as part of Epic 1 Story 1.0
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

- **Delegates to `createToonNode()` from core** -- For bootstrap, relay monitor, and lifecycle wiring
- **Wires the full pipeline as `handlePacket` callback** -- Size check -> shallow parse -> verify -> price -> dispatch
- **Config-based handler registration** -- `config.handlers` and `config.defaultHandler` are alternatives to post-creation `.on()`
- **Max payload: 1MB base64** -- `MAX_PAYLOAD_BASE64_LENGTH = 1_048_576`, rejected before allocation (DoS mitigation)
- **Dev mode log sanitization** -- User-controlled fields (amount, destination) are sanitized to prevent log injection
- **Chain-aware settlement** -- `config.chain` resolves via `resolveChainConfig()` to populate default settlement fields (Epic 3)

**publishEvent() (Stories 2.6, 7.5, 7.6):**

- **TOON-encodes the event** -- Uses the configured encoder (defaults to core's `encodeEventToToon`)
- **Computes payment amount** -- Default: `basePricePerByte * toonData.length`; overridden by `options.amount` (prepaid model)
- **Route-aware fee calculation (Story 7.5)** -- Automatically resolves intermediary hop fees via `resolveRouteFees()` and adds them on top of the destination amount. When `amount` override is provided, only hop fees are added (not `basePricePerByte`)
- **Bid safety cap (Story 7.6)** -- If `options.bid` is set and destination amount exceeds bid, throws `NodeError` before sending any ILP packet
- **Sends via runtimeClient** -- `toonNode.runtimeClient.sendIlpPacket({ destination, amount, data })`
- **Requires node to be started** -- Throws `NodeError` if called before `start()`
- **Requires destination** -- Throws `NodeError` if `options.destination` is missing

**DVM Lifecycle Methods (Epic 5):**

- **`publishFeedback()` is a thin wrapper** -- Builds Kind 7000 event via `buildJobFeedbackEvent()`, delegates to `publishEvent()`. Standard relay write fee applies.
- **`publishResult()` is a thin wrapper** -- Builds Kind 6xxx event via `buildJobResultEvent()`, delegates to `publishEvent()`. Default result kind is 6100 (text generation = 5100 + 1000).
- **`settleCompute()` sends pure ILP value transfer** -- Extracts amount from result event via `parseJobResult()`, sends empty-data ILP packet. No TOON encoding, no relay write.
- **`settleCompute()` validates amount format** -- Catches non-numeric amounts before they reach the ILP layer (throws `NodeError` instead of confusing `BootstrapError`)
- **`settleCompute()` bid validation is optional** -- `options.originalBid` enables E5-R005 overcharge protection: rejects if `amount > originalBid`
- **`getSkillDescriptor()` is computed on demand** -- Calls `buildSkillDescriptor(registry, config)` on each invocation. Not cached.
- **`NodeConfig.skillConfig`** -- Optional overrides for auto-derived skill descriptor fields (name, version, features, inputSchema, models). Pricing fields are always derived from `basePricePerByte`/`kindPricing`.
- **`HandlerRegistry.getDvmKinds()`** -- Filters `getRegisteredKinds()` to 5000-5999 range. Used by `buildSkillDescriptor()` to auto-populate the `kinds` field.

### Town-Specific Rules (Epics 2+3+4+5)

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
- **Packet equivalence:** Uses `buildIlpPrepare()` from `@toon-protocol/core` -- identical to ILP-native rail

**Docker Reference Implementation (Post-Epic 4):**

- **entrypoint-town.ts** -- Uses individual SDK components (Approach A) instead of `startTown()` (Approach B)
- **entrypoint-sdk.ts** -- SDK-based entrypoint with direct component wiring
- **attestation-server.ts** -- TEE attestation HTTP server + kind:10033 publisher (Stories 4.1 + 4.2)
- **shared.ts** -- Configuration parsing, admin client creation, health check utilities shared by both entrypoints
- **shared.ts supports Epic 3 features:** `x402Enabled`, `discoveryMode`, `seedRelays`, `publishSeedEntry`, `externalRelayUrl`, `TOON_CHAIN` convenience shorthand
- **entrypoint-town.ts TEE integration:** TEE_ENABLED detection, placeholder tee field in /health response (to be migrated to `createHealthResponse()`)
- **Supervisord multi-process management:** toon (priority=10), attestation (priority=20)

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

### DVM-Specific Rules (Epic 5)

**DVM Event Builders (Story 5.1):**

- **Kind 5xxx request validation:** kind must be 5000-5999, input.data allows empty string (not undefined/null), input.type required, bid must be non-empty string, output MIME type required
- **Kind 6xxx result validation:** kind must be 6000-6999, requestEventId must be 64-char hex, customerPubkey must be 64-char hex, amount must be non-empty string
- **Kind 7000 feedback validation:** requestEventId/customerPubkey must be 64-char hex, status must be one of: processing, error, success, partial
- **targetProvider validation in builders:** throws `ToonError` with `DVM_INVALID_PUBKEY` code for non-hex pubkeys
- **Currency declaration:** TOON extends NIP-90 with `'usdc'` as third element in `bid` and `amount` tags (NIP-90 uses satoshis)
- **All amounts are strings** -- USDC micro-units (6 decimals), bigint-compatible. Not numbers (precision loss), not BigInt (JSON incompatible).

**DVM Event Parsers (Story 5.1):**

- **Lenient parse pattern** -- Returns `null` for malformed events (consistent with `parseServiceDiscovery()`, `parseAttestation()`)
- **`parseJobRequest()` validates targetProvider hex** -- Returns null (not throws) for non-64-char-hex provider pubkeys
- **`parseJobRequest()` extracts all optional tags** -- params (array of key-value), relays (array of URLs), targetProvider
- **`parseJobResult()` does NOT validate amount format** -- Non-numeric amounts pass parsing but are caught by `settleCompute()`'s BigInt guard (known gap, Epic 5 retro A7)
- **`parseJobFeedback()` validates status enum** -- Returns null for unknown status values

**DVM Pipeline Behavior (Story 5.2):**

- **Kind 5xxx events use the standard pipeline** -- Shallow parse -> verify -> price -> dispatch. No DVM-specific pipeline stages.
- **Per-kind pricing applies to DVM kinds** -- `kindPricing[5100]` overrides `basePricePerByte` for text generation requests
- **Self-write bypass applies** -- Provider nodes don't pay to write their own kind:6xxx results

**Compute Settlement (Story 5.3):**

- **Empty-data ILP packets** -- `data: ''` in `sendIlpPacket()` signals pure value transfer. `createDirectIlpClient()` skips execution condition computation when `data.length === 0`.
- **settleCompute() requires started node** -- Throws `NodeError` if called before `start()`
- **settleCompute() validates providerIlpAddress** -- Non-empty, non-whitespace string required
- **Bid validation is customer-side** -- Provider cannot override the check; customer's `originalBid` parameter controls whether overcharge is allowed

**Skill Descriptors (Stories 5.4, 6.3, 6.4):**

- **`buildSkillDescriptor()` returns `undefined` when no DVM handlers** -- Backward compatible with pre-DVM nodes
- **`SkillDescriptor.pricing` uses string keys and string values** -- Kind numbers as strings (JSON keys must be strings), amounts as strings (bigint-compatible)
- **`Object.hasOwn()` for kindPricing lookup** -- Prototype-safe access pattern (consistent with pricing validator)
- **`parseServiceDiscovery()` validates skill field** -- All SkillDescriptor fields validated with type guards; invalid skill field -> returns null
- **Town propagation:** `TownConfig.skill` -> `serviceDiscoveryContent.skill` -> `buildServiceDiscoveryEvent()` -> kind:10035 event
- **attestation field populated from config** -- `buildSkillDescriptor()` validates eventId as 64-char hex (Story 6.3)
- **reputation field populated from config** -- `buildSkillDescriptor()` passes `ReputationScore` through to `SkillDescriptor.reputation` (Story 6.4)

### Coordination-Specific Rules (Epic 6)

**Workflow Orchestrator (Story 6.1):**

- **WorkflowOrchestrator is a stateful component** -- First stateful SDK component. Maintains state machine across multiple ILP packet cycles.
- **State machine pattern:** Explicit states (`pending`, `step_N_running`, `step_N_failed`, `completed`), guarded transitions, timeout-driven progression
- **Per-step settlement validates `sum(step_amounts) <= total_bid`** -- Prevents total settlement from exceeding the workflow's total bid
- **Injectable `now()` for deterministic testing** -- `options.now` provides injectable time source
- **WorkflowEventStore interface is minimal** -- Only `store()` and `query()` methods required. Keeps the dependency surface small.
- **Timeout is a failure mode, not a separate state** -- Timeout produces `step_N_failed` with timeout cause in notification content
- **Forward-compatible with Epic 7 prepaid protocol** -- Settlement logic isolated in `handleStepResult()` for easy swap to prepaid per-step payment

**Swarm Coordinator (Story 6.2):**

- **SwarmCoordinator manages a single swarm per instance** -- For concurrent swarms, create multiple instances sharing the same ServiceNode
- **4-state machine:** `collecting` -> `judging` -> `settled` or `failed`
- **Swarm tags are additive to standard Kind 5xxx** -- Non-swarm-aware providers can still participate via standard Kind 5xxx path
- **Winner-only settlement** -- Only winning provider receives compute payment. Losers pay relay write fees only (sunk cost by design).
- **`setTimeout` divergence (known tech debt)** -- Uses `setTimeout` directly instead of injectable `now()` pattern. Works with Vitest fake timers but inconsistent with WorkflowOrchestrator pattern. (Epic 6 retro A2)
- **Deduplication by provider pubkey** -- Duplicate submissions from same provider silently ignored
- **Winner selection requires valid swarm selection event** -- `parseSwarmSelection()` must return valid result with matching requestEventId

**TEE-Attested DVM Results (Story 6.3):**

- **AttestedResultVerifier is pure logic** -- No transport layer, no WebSocket connections (follows AttestationVerifier pattern from Story 4.3)
- **3-check verification chain:** (a) pubkey match, (b) PCR validity, (c) time validity
- **Time injection at call site, not constructor** -- Uses `resultEvent.created_at` as `now` parameter in `getAttestationState()`
- **`hasRequireAttestation()` is a simple param scanner** -- Returns boolean based on `require_attestation=true` in params array
- **attestationEventId in Kind 6xxx is optional** -- Backward compatible. Non-TEE providers omit the tag. Parsers return `undefined` for missing tag.
- **Skill descriptor attestation eventId validated** -- `buildSkillDescriptor()` throws `ToonError` for non-64-char-hex attestation eventId

**Reputation Scoring (Story 6.4):**

- **ReputationScoreCalculator is pure logic** -- No state, no transport. `calculate(signals)` is a pure function.
- **Composite formula uses logarithmic dampening for volume** -- `log10(max(1, channelVolumeUsdc))` prevents volume dominance
- **All amounts are numbers (not strings) in ReputationSignals** -- Unlike DVM bid/amount which are strings, reputation signals use native numbers for formula computation
- **Handles non-finite inputs defensively** -- NaN, Infinity, negative values produce finite score (0 or reasonable default)
- **Kind 31117 uses NIP-33 parameterized replaceable semantics** -- `d` tag = job request event ID, allowing one review per job per reviewer
- **Kind 30382 uses NIP-33 parameterized replaceable semantics** -- `d` tag = target pubkey, enforcing one WoT declaration per declarer per target
- **Rating validated as integer 1-5** -- Builder throws `ToonError` for out-of-range or non-integer ratings
- **Self-reported reputation is a design tradeoff** -- Providers embed own scores in kind:10035. Independently verifiable from raw review/WoT events but not protocol-enforced.

### Chain Configuration Rules (Epic 3)

**resolveChainConfig() (Story 3.2):**

- **Resolution order:** `TOON_CHAIN` env var -> `chain` parameter -> `'anvil'` default
- **Three presets:** `anvil` (31337, localhost), `arbitrum-sepolia` (421614), `arbitrum-one` (42161)
- **Env var overrides:** `TOON_RPC_URL` overrides rpcUrl, `TOON_TOKEN_NETWORK` overrides tokenNetworkAddress
- **Returns defensive copy** -- Callers can mutate the result without affecting shared preset objects
- **Throws ToonError** for unrecognized chain names
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
- **Use proper event kinds** -- Kind 10032 (ILP Peer Info), Kind 10033 (TEE Attestation), Kind 10034 (Prefix Claim), Kind 10035 (Service Discovery), Kind 10036 (Seed Relay List), Kind 10037 (Prefix Grant), Kind 10040 (Workflow Chain), Kinds 5000-5999 (DVM Job Request), Kinds 6000-6999 (DVM Job Result), Kind 7000 (DVM Job Feedback), Kind 31117 (Job Review), Kind 30382 (Web of Trust). Kinds 23194/23195 (SPSP) have been removed (Story 2.7)
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
- **Wired in startTown() when x402Enabled is true** -- `walletClient` and `publicClient` are created conditionally from `identity.secretKey` and `chainConfig.rpcUrl` (Quick-Spec wire-viem-x402-town)

**SQLite (better-sqlite3):**

- **In-memory for unit tests** -- Use `:memory:` database for fast, isolated tests
- **File-based for integration tests** -- Use temporary file paths for integration testing
- **Synchronous API** -- better-sqlite3 uses sync methods, no need for async/await
- **Proper cleanup** -- Always call `db.close()` in test teardown or finally blocks

**ILP Connector Integration:**

- **@toon-protocol/connector is an optional peer dependency** -- Both core and SDK declare it as optional
- **Use `EmbeddableConnectorLike` structural type** -- Defined in core, combines sendPacket + registerPeer + removePeer + setPacketHandler + optional channel methods
- **Bootstrap requires connector** -- BootstrapService needs a connector instance to function
- **Channel support is optional** -- `openChannel()` and `getChannelState()` are optional methods on `EmbeddableConnectorLike`

### Testing Rules

**Test Organization (Three-Tier, No-Mock Integration Policy):**

- **Co-locate unit tests** -- `*.test.ts` files next to source files in same directory. Mocks allowed here only.
- **Integration tests in `__integration__/`** -- Multi-component tests go in `packages/*/src/__integration__/`. **MUST use real Docker container infrastructure — no mocks for ILP, BTP, relay, or EVM boundaries.** Uses `sdk-e2e-infra.sh` or genesis node.
- **E2E tests use separate config** -- `vitest.e2e.config.ts` for full-lifecycle end-to-end tests (e.g., `packages/client/tests/e2e/`, `packages/town/tests/e2e/`, `packages/sdk/tests/e2e/`)
- **Integration vs E2E distinction** -- Integration tests verify a *single boundary crossing* (e.g., SDK submits event via ILP, relay stores it). E2E tests verify *complete user journeys* (e.g., submit job → receive → result → settle → verify on-chain). Both use real Docker containers; the difference is scope, not infrastructure.
- **SDK integration tests use separate vitest config** -- `vitest.integration.config.ts` with 30s timeout
- **Test file naming** -- Match source file name with `.test.ts` suffix (e.g., `handler-registry.test.ts`)
- **Graceful skip when infra unavailable** -- Integration and E2E tests check Docker service health at startup, skip gracefully via `servicesReady`/`genesisReady`/`skipIfNotReady()` flags when containers aren't running. Tests must document which infra they require (`sdk-e2e-infra.sh up` or `deploy-genesis-node.sh`).
- **Static analysis tests for infrastructure files (Epic 4)** -- Tests read Docker compose, supervisord.conf, Dockerfile, and Nix flake files as strings, parse, and assert structural properties

**Test Framework (Vitest):**

- **Use Vitest built-in mocking in unit tests only** -- `vi.fn()`, `vi.mock()`, `vi.spyOn()` (not jest). Mocking is restricted to co-located unit tests (`*.test.ts`). Integration and E2E tests must not mock infrastructure boundaries.
- **Follow AAA pattern** -- Arrange, Act, Assert structure in all tests
- **Use describe/it blocks** -- Group related tests with `describe()`, individual tests with `it()`
- **Async test handling** -- Use `async` functions, properly await all promises

**Mock Usage (Unit Tests ONLY):**

- **NEVER mock infrastructure in integration or E2E tests** -- No `MockEmbeddedConnector`, no `vi.mock()` for BTP, ILP, relay, or EVM in `__integration__/` or `tests/e2e/` directories. If a test needs ILP/BTP/relay/EVM, it uses real Docker containers.
- **Mocks are restricted to co-located unit tests (`*.test.ts`)** -- Unit tests may mock external dependencies for speed and isolation
- **Always mock SimplePool in unit tests** -- Use `vi.mock('nostr-tools')` to prevent live relay connections in unit tests only
- **Mock external dependencies in unit tests** -- HTTP clients, file system, network calls must be mocked in unit tests
- **Factory functions for test data** -- Create helper functions for generating valid test events with proper signatures (allowed in all test tiers)
- **In-memory databases for unit tests** -- Use SQLite `:memory:` for isolated, fast unit tests
- **x402 unit tests use injectable settlement** -- `config.settle` and `config.runPreflightFn` allow test-specific mocks without touching viem
- **TEE unit tests use DI callbacks** -- `AttestationBootstrap` uses injected `queryAttestation` and `subscribePeers` for testability
- **Nix build unit tests mock child_process** -- `vi.mock('node:child_process')` to test NixBuilder without requiring Nix installation

**Docker Container Test Infrastructure:**

- **`sdk-e2e-infra.sh`** -- Provides Anvil (18545) + Peer1 (BTP:19000, BLS:19100, Relay:19700) + Peer2 (BTP:19010, BLS:19110, Relay:19710). Required for integration and E2E tests.
- **`deploy-genesis-node.sh`** -- Alternative infra for Town E2E tests. Provides genesis stack (BLS:3100, Relay:7100, Anvil:8545, Faucet:3500).
- **Integration tests follow the `docker-publish-event-e2e.test.ts` pattern** -- Real ConnectorNode, real BTP peering, real relay WebSocket, real Anvil settlement. See `packages/sdk/tests/e2e/docker-publish-event-e2e.test.ts` as the canonical example. DVM tests in `docker-dvm-submission-e2e.test.ts` and `docker-dvm-lifecycle-e2e.test.ts` extend this pattern.
- **Shared Docker E2E helpers** -- `packages/sdk/tests/e2e/helpers/docker-e2e-setup.ts` extracts constants, ABIs, node factories, and health checks shared across all Docker E2E test files (Epic 5 migration).
- **Health check before test execution** -- All integration/E2E test suites must verify Docker service health in `beforeAll` and skip gracefully if unavailable.
- **CI pipeline must start Docker infra** -- `sdk-e2e-infra.sh up` runs before integration test suite in CI.

**Two-Approach Handler Testing (Epic 2 Pattern, Updated):**

- **Approach A: Unit tests with `createTestContext`** -- Isolated handler logic testing, mocked EventStore and dependencies. Co-located `*.test.ts` files.
- **Approach B: Integration tests against Docker infra** -- Handler behavior validated through real ILP packet delivery, real relay storage, real BTP connectors. Lives in `__integration__/` directory. No mocks for infrastructure boundaries.
- **Approach A catches handler-level logic issues, Approach B proves the handler works in the real system**

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

- **NEVER use mocks in integration tests** -- If a test is in `__integration__/` or `tests/e2e/`, it must use real Docker containers. `MockEmbeddedConnector` and similar mock infrastructure classes are forbidden in integration/E2E tests. This is the single most important testing rule.
- **No live external relays in CI** -- Tests use local Docker relay containers, not external network relays
- **Docker infra required for integration + E2E** -- `sdk-e2e-infra.sh up` or `deploy-genesis-node.sh` must run before integration/E2E suites
- **Cleanup resources in teardown** -- Close database connections, stop nodes, clear mocks with `vi.clearAllMocks()`
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

- **Files (source):** PascalCase for classes, kebab-case for utilities and SDK modules (`BusinessLogicServer.ts`, `handler-registry.ts`, `create-node.ts`, `town.ts`, `x402-publish-handler.ts`, `AttestationVerifier.ts`, `AttestationBootstrap.ts`, `nix-builder.ts`, `pcr-validator.ts`, `kms-identity.ts`, `dvm.ts`, `skill-descriptor.ts`, `workflow.ts`, `swarm.ts`, `attested-result-verifier.ts`, `reputation.ts`, `workflow-orchestrator.ts`, `swarm-coordinator.ts`)
- **Files (test):** Match source with `.test.ts` suffix (`handler-registry.test.ts`, `town.test.ts`, `attestation.test.ts`, `kms-identity.test.ts`, `nix-reproducibility.test.ts`, `attestation-bootstrap.test.ts`, `dvm-builders.test.ts`, `dvm-parsers.test.ts`, `dvm-roundtrip.test.ts`, `dvm-constants.test.ts`, `skill-descriptor.test.ts`, `dvm-handler-dispatch.test.ts`, `dvm-lifecycle.test.ts`, `workflow.test.ts`, `swarm.test.ts`, `attested-result-verifier.test.ts`, `reputation.test.ts`, `workflow-orchestrator.test.ts`, `swarm-coordinator.test.ts`)
- **Classes:** PascalCase (`SocialPeerDiscovery`, `HandlerRegistry`, `SeedRelayDiscovery`, `AttestationVerifier`, `AttestationBootstrap`, `NixBuilder`, `WorkflowOrchestrator`, `SwarmCoordinator`, `AttestedResultVerifier`, `ReputationScoreCalculator`, `AddressRegistry`)
- **Interfaces:** PascalCase, no `I-` prefix (`IlpPeerInfo`, `HandlePacketRequest`, `HandlerContext`, `TownConfig`, `TownInstance`, `ChainPreset`, `ServiceDiscoveryContent`, `TeeAttestation`, `ParsedAttestation`, `AttestationVerifierConfig`, `KmsKeypair`, `NixBuildResult`, `PcrReproducibilityResult`, `TeeHealthInfo`, `JobRequestParams`, `JobResultParams`, `JobFeedbackParams`, `ParsedJobRequest`, `ParsedJobResult`, `ParsedJobFeedback`, `SkillDescriptor`, `BuildSkillDescriptorConfig`, `WorkflowStep`, `WorkflowDefinitionParams`, `ParsedWorkflowDefinition`, `SwarmRequestParams`, `SwarmSelectionParams`, `ParsedSwarmRequest`, `ParsedSwarmSelection`, `AttestedResultVerificationOptions`, `AttestedResultVerificationResult`, `JobReviewParams`, `ParsedJobReview`, `WotDeclarationParams`, `ParsedWotDeclaration`, `ReputationSignals`, `ReputationScore`, `WorkflowEventStore`, `WorkflowOrchestratorOptions`, `SwarmCoordinatorOptions`, `PrefixClaimContent`, `PrefixGrantContent`, `PrefixClaimHandlerOptions`, `PrefixValidationResult`)
- **Functions:** camelCase (`discoverPeers`, `createNode`, `createPricingValidator`, `startTown`, `resolveChainConfig`, `buildIlpPrepare`, `deriveFromKmsSeed`, `verifyPcrReproducibility`, `analyzeDockerfileForNonDeterminism`, `hasRequireAttestation`, `hasMinReputation`, `validatePrefix`, `claimPrefix`)
- **Factory functions:** `create*` prefix (`createNode`, `createHandlerContext`, `createVerificationPipeline`, `createPricingValidator`, `createEventStorageHandler`, `createX402Handler`, `createHealthResponse`, `createPrefixClaimHandler`)
- **Lifecycle functions:** `start*` prefix (`startTown`)
- **Builder functions:** `build*` prefix (`buildIlpPrepare`, `buildSeedRelayListEvent`, `buildServiceDiscoveryEvent`, `buildEip712Domain`, `buildIlpPeerInfoEvent`, `buildAttestationEvent`, `buildJobRequestEvent`, `buildJobResultEvent`, `buildJobFeedbackEvent`, `buildSkillDescriptor`, `buildWorkflowDefinitionEvent`, `buildSwarmRequestEvent`, `buildSwarmSelectionEvent`, `buildJobReviewEvent`, `buildWotDeclarationEvent`, `buildPrefixClaimEvent`, `buildPrefixGrantEvent`)
- **Parser functions:** `parse*` prefix (`parseSeedRelayList`, `parseServiceDiscovery`, `parseIlpPeerInfo`, `parseAttestation`, `parseJobRequest`, `parseJobResult`, `parseJobFeedback`, `parseWorkflowDefinition`, `parseSwarmRequest`, `parseSwarmSelection`, `parseJobReview`, `parseWotDeclaration`, `parsePrefixClaimEvent`, `parsePrefixGrantEvent`)
- **Derivation functions:** `derive*` prefix (`deriveFromKmsSeed`)
- **Verification functions:** `verify*` prefix (`verifyPcrReproducibility`, `verifyAttestedResult`)
- **Predicate functions:** `has*` prefix (`hasRequireAttestation`, `hasMinReputation`)
- **Constants:** UPPER_SNAKE_CASE (`ILP_PEER_INFO_KIND`, `MAX_PAYLOAD_BASE64_LENGTH`, `SERVICE_DISCOVERY_KIND`, `SEED_RELAY_LIST_KIND`, `MOCK_USDC_ADDRESS`, `USDC_DECIMALS`, `TEE_ATTESTATION_KIND`, `JOB_REQUEST_KIND_BASE`, `JOB_RESULT_KIND_BASE`, `JOB_FEEDBACK_KIND`, `TEXT_GENERATION_KIND`, `IMAGE_GENERATION_KIND`, `TEXT_TO_SPEECH_KIND`, `TRANSLATION_KIND`, `WORKFLOW_CHAIN_KIND`, `JOB_REVIEW_KIND`, `WEB_OF_TRUST_KIND`, `PREFIX_CLAIM_KIND`, `PREFIX_GRANT_KIND`)
- **Enums:** PascalCase names, string values (`AttestationState.VALID = 'valid'`)
- **Type aliases:** PascalCase (`TrustScore`, `BootstrapPhase`, `ToonRoutingMeta`, `ResolvedTownConfig`, `ChainName`, `AttestationBootstrapEvent`, `DvmJobStatus`, `WorkflowState`, `SwarmState`)
- **Event types:** Discriminated unions with `type` field (`BootstrapEvent`, `AttestationBootstrapEvent`)

**Code Organization:**

- **Monorepo structure** -- Packages in `packages/*/` directory, docker in `docker/`
- **pnpm workspace** -- `packages/*` and `docker` in `pnpm-workspace.yaml`
- **Index exports** -- All public APIs exported from `packages/*/src/index.ts`
- **Type definitions** -- Define types in `types.ts` or alongside implementation (e.g., `x402-types.ts`)
- **Constants file** -- Event kinds and constants in `constants.ts`
- **Error classes** -- Custom errors in `errors.ts` per package (core: `ToonError`, `KmsIdentityError`, `PcrReproducibilityError`)
- **Handler subdirectory** -- Town handlers organized in `src/handlers/` with co-located tests
- **x402 module organization** -- Types (`x402-types.ts`), pricing (`x402-pricing.ts`), preflight (`x402-preflight.ts`), settlement (`x402-settlement.ts`), handler (`x402-publish-handler.ts`)
- **Chain config subdirectory** -- Core chain configuration in `src/chain/` (usdc.ts, chain-config.ts)
- **Identity subdirectory** -- Core identity derivation in `src/identity/` (kms-identity.ts)
- **Build subdirectory** -- Core Nix build infrastructure in `src/build/` (nix-builder.ts, pcr-validator.ts)
- **Bootstrap subdirectory** -- Core attestation classes in `src/bootstrap/` (AttestationVerifier.ts, AttestationBootstrap.ts alongside BootstrapService.ts)
- **Events subdirectory** -- Core event builders/parsers in `src/events/` (attestation.ts, dvm.ts, seed-relay.ts, service-discovery.ts, workflow.ts, swarm.ts, attested-result-verifier.ts, reputation.ts, prefix-claim.ts)
- **Address subdirectory** -- Core ILP address hierarchy in `src/address/` (derive-child-address.ts, ilp-address-validation.ts, btp-prefix-exchange.ts, address-assignment.ts, address-registry.ts, prefix-validation.ts)
- **Fee subdirectory** -- Core route-aware fee calculation in `src/fee/` (resolve-route-fees.ts, calculate-route-amount.ts)
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
- **Epic branches:** `epic-N` for feature work (e.g., `epic-1` for SDK, `epic-2` for Town, `epic-3` for Economics, `epic-4` for TEE, `epic-5` for DVM, `epic-6` for Advanced DVM Coordination, `epic-7` for ILP Address Hierarchy)
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
- **Genesis node:** `docker compose -p toon-genesis -f docker-compose-genesis.yml up -d`
- **Peer nodes:** `./deploy-peers.sh <count>` script for automated peer deployment
- **Oyster CVM:** `docker build -f docker/Dockerfile.oyster -t toon:oyster .` then `oyster-cvm build --docker-compose docker/docker-compose-oyster.yml`
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

- **@toon-protocol/sdk:** Published, public access, `dist/` only
- **@toon-protocol/town:** Build-ready, tested, not yet published (retro A14: manual `npm publish --access public` required)
- **Package names:** `@toon-protocol/sdk`, `@toon-protocol/town`, `@toon-protocol/rig` (future)
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
- **NEVER use `exec()` for git operations** -- Use `execFile()` to prevent command injection (Rig, Epic 8)
- **NEVER reference AGENT token** -- AGENT eliminated in Story 3.1; production uses USDC on Arbitrum One
- **NEVER call the BLS a public-facing component** -- BLS handles only `/handle-packet`; the TOON node owns all public endpoints
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
- **Payment amounts default to TOON length** -- `publishEvent` amount defaults to `basePricePerByte * toonData.length`, overridable via `options.amount` (prepaid model, Epic 7)
- **Relay WebSocket returns TOON strings** -- EVENT messages contain TOON strings, not JSON objects
- **Channel nonce conflicts require retry** -- Payment channel operations may need retry logic for blockchain transaction conflicts
- **SDK stubs direct to Town** -- `createEventStorageHandler()` in SDK throws with message directing users to `@toon-protocol/town`
- **Handler fulfillment is placeholder** -- `ctx.accept()` returns `fulfillment: 'default-fulfillment'`; in production BLS computes SHA-256(eventId)
- **Data-returning handlers bypass ctx.accept()** -- Return response directly because `data` must be top-level for ILP FULFILL relay (pattern valid for future handlers)
- **Bootstrap phases simplified** -- discovering -> registering -> announcing (handshaking phase eliminated in Story 2.7)
- **Anvil mock USDC has 18 decimals, not 6** -- On-chain mock differs from production USDC. Pricing pipeline is denomination-agnostic.
- **x402 viem clients wired in startTown() conditionally when x402Enabled** -- `walletClient` and `publicClient` created from node identity key and chain RPC (Quick-Spec wire-viem-x402-town)
- **x402 routing buffer defaults to 10%** -- `calculateX402Price()` adds 10% buffer on top of `basePricePerByte * toonLength`
- **x402 settlement is one-way** -- If settlement succeeds but ILP PREPARE is rejected, no refund per protocol design
- **AttestationVerifier boundary: exactly at validity end is VALID** -- Inclusive <= comparison, not <
- **AttestationBootstrap: verification-failed event is overloaded** -- Same event type emitted for both attestation verification failures and subscribePeers errors (known simplification, Story 4.6 CR#3)
- **NixBuilder PCR values for small images** -- When image <= 1MB, PCR1 === PCR0 and PCR2 uses domain separator prefix ('pcr2:')
- **attestation-server reads TEE_ENABLED once at startup** -- Env var changes after process start are not reflected
- **DVM amounts are strings, not numbers or BigInt** -- USDC micro-units as strings for bigint compatibility and JSON serialization safety
- **parseJobResult() accepts non-numeric amounts** -- Known gap; settleCompute()'s BigInt guard catches them with NodeError (Epic 5 retro A7)
- **settleCompute() sends empty-data ILP packets** -- `data: ''` signals pure value transfer; direct-ilp-client skips execution condition computation
- **publishFeedback() and publishResult() delegate to publishEvent()** -- Standard relay write fee applies (basePricePerByte * toonData.length), NOT the DVM compute amount
- **Default result kind is 6100** -- publishResult() defaults to 6100 (text generation result = 5100 + 1000) when `options.kind` is not specified
- **getSkillDescriptor() is computed on each call** -- Not cached; reads live registry state. Callers should cache if needed.
- **kind:10035 skill field is omitted for non-DVM nodes** -- Same omission semantics as x402 and TEE fields
- **ILP addresses are topology-derived, not manually assigned** -- `deriveChildAddress(parentPrefix, pubkey)` appends `pubkey.slice(0, 8).toLowerCase()`. Genesis node uses `ILP_ROOT_PREFIX` directly. No hardcoded addresses.
- **BTP prefix exchange is fail-closed** -- `extractPrefixFromHandshake()` throws `ToonError` if prefix is absent or invalid. Nodes MUST NOT fall back to hardcoded addresses.
- **Multi-peered nodes have multiple ILP addresses** -- One per upstream peer, tracked by `AddressRegistry`. Primary address is the first inserted (insertion-order stable via Map).
- **IlpPeerInfo backward compatibility** -- Pre-Epic-7 kind:10032 events lack `ilpAddresses` and `feePerByte`. Parsers default to `ilpAddresses: [ilpAddress]` and `feePerByte: '0'`. No migration required.
- **resolveRouteFees() rebuilds fee map per call** -- Acceptable for v1 (tens to low hundreds of peers). Needs caching for 1000+ peers (Epic 7 retro A7).
- **Unknown intermediaries default to feePerByte 0n** -- `resolveRouteFees()` emits a warning but does not fail. Graceful degradation for partially-discovered networks.
- **publishEvent() amount override changes fee semantics** -- Without amount: total = `basePricePerByte * bytes + hopFees`. With amount: total = `amount + hopFees` (basePricePerByte is NOT added on top).
- **settleCompute() is deprecated but functional** -- Emits console warning. Prepaid model replaces it: use `publishEvent()` with `{ amount }` option.
- **Prefix claim atomicity is single-process only** -- `createPrefixClaimHandler` uses in-memory Set via injectable callback. Cluster mode would require distributed locking.
- **claimPrefix() looks up pricing from discovery** -- If no explicit `prefixPrice` option, looks up `prefixPricing.basePrice` from discovered peers. Throws if not found.
- **Prefix validation rejects reserved words** -- `toon`, `ilp`, `local`, `peer`, `test` cannot be claimed as vanity prefixes

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
- **TOON codec now in core, not BLS** -- Extracted as Story 1.0; import from `@toon-protocol/core/toon` or main `@toon-protocol/core` export
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
- **Attestation server is a separate process** -- Runs alongside the TOON node, managed by supervisord (priority=20 vs priority=10)
- **KMS identity lives in core, not SDK** -- Docker entrypoints import from core. No EVM address derivation (SDK concern).
- **Nix flake requires x86_64-linux** -- Docker image output is system-specific (`packages.x86_64-linux.docker-image`)
- **flake.lock pins all inputs** -- Must be committed to version control for reproducibility
- **Connector is embedded in Oyster CVM** -- ConnectorNode runs in-process via `entrypoint-sdk.js`
- **DVM job events use standard SDK pipeline** -- Kind 5xxx events flow through the same pipeline as all other kinds (shallow parse -> verify -> price -> dispatch). No DVM-specific pipeline stages.
- **ILP layer supports both data-bearing and data-free payments** -- Event publishing: payment + data together. Compute settlement: payment alone (empty data). The `direct-ilp-client.ts` `data.length > 0` guard enables this.
- **Skill descriptors extend kind:10035, not a new event kind** -- DVM capabilities are embedded in the existing service discovery event type via the `skill` field
- **NIP-90 currency extension** -- TOON adds `'usdc'` as third element in `bid` and `amount` tags. Standard NIP-90 uses satoshis. The currency tag enables cross-ecosystem interoperability.
- **Docker E2E tests share helpers** -- `docker-e2e-setup.ts` contains shared constants, ABIs, node factories, and health checks used by all SDK E2E test files
- **WorkflowOrchestrator is the first stateful SDK component** -- Maintains state machine across multiple ILP packet cycles. Correctness depends on state transitions, not just input/output transformations.
- **SwarmCoordinator uses setTimeout directly** -- Known divergence from WorkflowOrchestrator's injectable `now()` pattern. Works with Vitest fake timers but inconsistent (Epic 6 retro A2).
- **Workflow step advancement feeds step N output as step N+1 input** -- The `data` field from the step N result event becomes the `data` field in the step N+1 job request
- **Swarm tags are additive to standard Kind 5xxx** -- `['swarm', maxProviders]` and `['judge', judgeId]` tags. Non-swarm-aware providers can participate without modification.
- **Kind 6xxx attestationEventId tag is optional** -- Backward compatible. Non-TEE providers omit it. `parseJobResult()` returns `undefined` for missing tag.
- **AttestedResultVerifier uses resultEvent.created_at as `now`** -- Not constructor-injected time. The result event's timestamp determines whether attestation was valid.
- **Self-reported reputation is a design tradeoff** -- Providers embed own scores in kind:10035. Independently verifiable but not protocol-enforced. Full enforcement would require consensus or a trusted aggregator.
- **Kind 31117 and Kind 30382 use NIP-33 parameterized replaceable semantics** -- Unlike kind:10033 (NIP-16 replaceable), these require `d` tags for parameterized replacement.
- **ReputationScoreCalculator handles non-finite inputs** -- NaN, Infinity, negative values produce finite scores (defensive programming)
- **Zero E2E tests executed in Epics 6 and 7** -- All deferred E2E test IDs require live infrastructure. Two consecutive epics with zero E2E execution.
- **Address hierarchy enables protocol economics** -- The hierarchical structure `g.toon.parent.child` creates a natural fee accumulation model: each segment corresponds to a node that can charge `feePerByte`. Fee model derives from address hierarchy.
- **Prefix claim marketplace creates domain-registrar business model** -- Upstream nodes sell human-readable namespace to downstream nodes. Vanity prefixes like `g.toon.useast` are emergent economic properties of the address hierarchy.
- **kind:10032 republication not yet implemented for lifecycle changes** -- `addUpstreamPeer`/`removeUpstreamPeer` and prefix claims update in-memory state but `BootstrapService.republish()` does not exist. Kind:10032 re-advertisement after topology changes is blocked (Epic 7 retro A2).
- **Unified payment pattern (D7-004)** -- All monetized flows (relay write, DVM compute, prefix claim) use the same `publishEvent()` with optional `{ amount }` override. New monetized flows must conform to this pattern.

---

## Known Action Items (From Epic 7 Final Retro)

**Must-Do for Epic 8:**
- A1: **Address accumulated E2E test debt (~31 deferred items across Epics 3-7)** -- Zero E2E tests executed for 2nd consecutive epic. Cumulative deferred count is now ~31 items. This is the project's highest-priority quality risk.
- A2: **Implement BootstrapService.republish() for kind:10032 re-advertisement** -- `addUpstreamPeer`/`removeUpstreamPeer` and prefix claims update in-memory state but cannot trigger kind:10032 republication. Blocks correct multi-address advertisement after topology changes.

**Should-Do:**
- A3: Standardize injectable time pattern across coordination components -- SwarmCoordinator uses `setTimeout` while WorkflowOrchestrator uses injectable `now()`. Not exacerbated in Epic 7 but still inconsistent. (Carried from Epic 6 A2, 2 epics deferred)
- A4: Establish load testing infrastructure -- Deferred 7 epics (from Epic 1 NFR). Route-aware fee calculation and multi-address resolution need performance baselines.
- A5: Set up facilitator ETH monitoring -- Deferred 5 epics (from Epic 3 A8). x402 facilitator account needs ETH monitoring.
- A6: Commit flake.lock -- Deferred 4 epics (from Epic 4 A5). Requires Nix installation.
- A7: Add caching to resolveRouteFees() -- Per-call Map rebuild from discovered peers is acceptable for v1 but will not scale to 1000+ peers. Cache with invalidation on peer discovery updates. (New from Story 7-5 NFR)
- A8: Formal SLOs for DVM job lifecycle -- With prepaid model and route-aware fees, end-to-end latency SLOs are increasingly relevant. (Carried from Epic 6 A7, 2 epics deferred)

**Nice-to-Have:**
- A9: Runtime re-publication of kind:10035 on handler/reputation change -- Carried from Epic 5 A11. Now also relevant for kind:10032 (see A2).
- A10: Weighted WoT model for reputation scoring -- Carried from Epic 6 A9.
- A11: Publish @toon-protocol/town to npm -- Carried from Epic 2 A3 (6 epics deferred).
- A12: Fix NIP-33/NIP-16 doc discrepancy -- Carried from Epic 3 A13 (5 epics deferred).
- A13: Add protocol-level reputation score verification -- Carried from Epic 6 A6.
- A14: Docker E2E for workflow chain + swarm coordination -- Carried from Epic 6 A12/A13.

**Resolved Action Items (from Epic 5 retro, resolved at Epic 6 start):**
- ~~A1: Standardize test counting between pipeline steps~~ RESOLVED (root vitest.config.ts now includes `docker/src/**/*.test.ts`)
- ~~A4: Split large test files~~ RESOLVED (`dvm.test.ts` split into `dvm-builders.test.ts`, `dvm-parsers.test.ts`, `dvm-roundtrip.test.ts`, `dvm-constants.test.ts`)
- ~~A7: Harden parseJobResult() numeric amount validation~~ RESOLVED (added `/^\d+$/` regex validation, 6 new tests)

**Resolved Action Items (from Epic 4 retro, resolved at Epic 5 start):**
- ~~A1: Set up genesis node in CI~~ RESOLVED (CI pipeline enhanced with security audit, format check, SDK E2E infra)
- ~~A2: Replace `console.error` with structured logger~~ RESOLVED (`createLogger()` in `@toon-protocol/core/logger.ts`, 17 tests)
- ~~A3: Deploy FiatTokenV2_2 on Anvil~~ RESOLVED (`scripts/deploy-mock-usdc.sh`)
- ~~A4: Create project-level semgrep configuration~~ RESOLVED (`.semgrep.yml` + `.semgrepignore`)
- ~~A5: Address transitive dependency vulnerabilities~~ RESOLVED (pnpm.overrides patched 8 vulns)

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
- Use string amounts for DVM bid/cost values (bigint-compatible, JSON-safe)
- Use lenient parse pattern (return null) for DVM event parsers (consistent with service-discovery and attestation parsers)
- Use thin wrapper pattern for DVM lifecycle methods (publishFeedback/publishResult delegate to publishEvent)
- Budget 1.5-2x test amplification for novel stories, 1-1.5x for extension stories (Epic 6 amplification averaged 1.55x)
- Use state machine pattern for coordination components: explicit states, guarded transitions, timeout-driven progression (Epic 6)
- Use injectable `now()` functions for testable time-dependent components (Epic 6, team agreement #10)
- Use DI callbacks for orchestration classes (WorkflowOrchestrator EventStore/settle, SwarmCoordinator EventStore/settle)
- Use NIP-33 parameterized replaceable semantics (with `d` tag) for per-entity-per-author deduplication (Kind 31117, Kind 30382)
- Use backward-compatible field additions with sensible defaults when extending shared types like `IlpPeerInfo` (Epic 7, team agreement #11)
- Use unified payment pattern (D7-004) for all new monetized flows: advertise price in replaceable event, discover, message + payment in one `publishEvent()` call (Epic 7, team agreement #10)
- Use injectable callbacks for handler factories (e.g., `createPrefixClaimHandler`'s `claimPrefix` callback for atomicity) (Epic 7, team agreement #12)
- Story consolidation is valid when two stories share the same modified files and infrastructure (Epic 7, team agreement #9)

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-03-22
