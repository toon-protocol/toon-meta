# TOON Protocol x AO/HyperBEAM Integration -- Brainstorming Document

**Date:** 2026-03-23 (revised 2026-03-23)
**Context:** Party Mode research sessions exploring the intersection of TOON Protocol and the AO/HyperBEAM ecosystem. This document captures architectural findings, integration strategies, and a concrete R&D path.

**Revision notes:** Original document proposed TOON as a HyperBEAM *peer* (full relay reimplemented as an Erlang device). Party Mode review identified that the correct framing is TOON as a HyperBEAM *client* -- a lightweight device that consumes AND provides TOON services without reimplementing ILP routing, event storage, or relay infrastructure. This revision corrects architectural misalignments with project decisions D8-PM-004, D8-PM-008, D7-001, and the Forge-UI static SPA decision.

---

## Source Material

### Repositories
- **TOON Protocol (town):** https://github.com/toon-protocol/town
- **HyperBEAM:** https://github.com/permaweb/HyperBEAM
- **HyperBEAM Docker:** https://github.com/memetic-block/hyperbeam-docker

### Documentation
- **Permaweb Docs Collection:** `permaweb-docs-2026-03-23.llms.txt` (local, 251 documents, 145k words)
- **HyperBEAM Docs:** https://hyperbeam.arweave.net/
- **WizardAO (WAO) Docs:** https://docs.wao.eco/getting-started
- **WAO Hub:** https://docs.wao.eco/hub
- **AO The Web:** https://docs.wao.eco/web -- live preview at `preview.wao.arweaveoasis.com`
- **AO Cookbook:** https://cookbook_ao.arweave.net/
- **AR.IO Docs:** https://docs.ar.io/

### Blog / Social
- **@aoTheComputer tweet (2026-03-12):** https://x.com/aoTheComputer/status/2032031532253159537
  > "AO processes can emit dynamically rendered websites and exchange data with the broader web. Smart contracts that ARE web applications. Not just backends, but full apps. HTTP oracle functionality built into the protocol layer. No third-party bridges needed."
- **Arweave Gateways with HyperBEAM blog:** https://ao.ar.io/#/blog/arweave-gateways-with-hyperbeam

---

## 1. What Is AO / HyperBEAM / WAO

### AO
A decentralized supercomputer network built on top of Arweave. AO processes communicate via asynchronous message passing and store state permanently on Arweave. Processes are written in Lua (via AOS) or as WASM modules.

### HyperBEAM
The distributed execution engine that powers AO, built on Erlang/OTP. Key properties:
- HTTP-native message passing (the protocol IS HTTP)
- Device composition model -- pluggable execution units that compose via URL paths
- 139 core modules across AR Utils, HB Core, and 77 Devices
- Monetization built in via `~p4@1.0` / `~simple-pay@1.0` payment devices
- TEE support via `~snp@1.0` (AMD SEV-SNP attestation)
- Cowboy 2.14.0 HTTP server + **gun 2.2.0 HTTP/WebSocket client** (both already dependencies)

### WAO (WizardAO)
Developer toolkit for AO/HyperBEAM:
- **Testing framework:** Emulate AO units in-memory (1000x faster than mainnet), launch HyperBEAM nodes from JS test code
- **SDK:** `wao` npm package (^0.40.0), extends aoconnect with syntactic sugar
- **Devnet:** Full AO stack on Cloudflare Workers with WAO Scan explorer
- **AO The Web:** `import { AO } from "wao/web"` -- AO units running in the browser, no server needed
- **WAO Hub:** `npx wao hub` -- ephemeral proxy connecting browsers to HyperBEAM nodes (WebSocket) and browsers to each other (WebRTC P2P mesh)

### AO Token Blueprint
Standard Lua-based token implementation with Balances table, Transfer handler (Debit-Notice/Credit-Notice pattern), Mint handler. Deployable via `.load-blueprint token` in AOS. The `~p4@1.0` device already uses `hyper-token.lua` -- a full AO token standard with sub-ledger networks.

---

## 2. The Tweet Explained -- "Smart Contracts That ARE Web Applications"

The @aoTheComputer tweet describes three converging HyperBEAM capabilities:

### 2a. AO Processes Emit Dynamically Rendered Websites
The `~patch@1.0` device enables AO processes to expose internal state as HTTP endpoints. Combined with `~lua@5.3a` for on-the-fly computation, a process can serve rendered HTML/JSON directly over HTTP.

**This means:** The same AO process that holds the data also renders the frontend. No separate API server, no separate frontend deployment. One process at one Arweave address = state + compute + rendering.

```
Traditional:  Frontend (static) -> API Server -> Database  (3 deployments)
AO Model:     AO Process (state + compute + rendering)     (1 process)
```

### 2b. HTTP Oracle Functionality at the Protocol Layer
Because HyperBEAM processes communicate via HTTP messages natively (using HTTP Message Signatures, `httpsig@1.0` codec), processes can receive and send HTTP requests to the broader web as part of their normal execution. No external oracle middleware (Chainlink, etc.) needed.

### 2c. Relevance to Forge-UI

**Current decision (Epic 8, Stories 8.1-8.5):** Forge-UI is a static Vite SPA deployed to Arweave. Client-side JS queries TOON relays for NIP-34 events and Arweave gateways for git objects. This is built, shipped, and working.

**Trade-off analysis -- static SPA vs dynamic AO process:**

| Dimension | Static SPA (current) | Dynamic AO Process (future possibility) |
|---|---|---|
| **Status** | Built, Stories 8.1-8.5 implemented | Not started, would require new work |
| **Rendering** | Client-side (React/Preact) | Server-side (Lua via `~patch@1.0`) |
| **Server state** | None (client does all aggregation) | Process holds indexes, trending, feeds |
| **SEO/social** | None (blank to crawlers) | Full HTML per request, og: tags work |
| **Runtime cost** | Free (Arweave CDN serves static files) | Per-request compute (node operator pays) |
| **Availability** | Any Arweave gateway | Dependent on HyperBEAM node availability |
| **Tech stack** | Standard web (Vite, TS, any dev can contribute) | Lua + AO process model (small ecosystem) |
| **Updates** | New Arweave upload per version | Send message to process (live update) |
| **Autonomy** | Passive (shows things) | Active (can accept payments, dispatch jobs) |

**Conclusion:** The static SPA is the right choice for now -- it's boring tech, already built, and Forge-UI is a read-heavy application. The dynamic AO rendering becomes interesting only if Forge-UI needs autonomous behavior (accepting payments, dispatching jobs, maintaining server-side state). This would be enabled naturally by the `~toon-client@1.0` device (section 6) -- an AO process with the client device could query TOON relays server-side and render HTML, without storing events itself. The relays remain source of truth.

---

## 3. Where TOON Protocol Meets AO/HyperBEAM

### System Comparison

| Dimension | TOON Protocol | AO / HyperBEAM |
|---|---|---|
| **Identity** | Nostr keypair (secp256k1) | Arweave wallet (RSA/Ed25519) |
| **Discovery** | Nostr relays (kind:10032, kind:10035) | Arweave network + gateways |
| **Transport** | ILP packets over BTP/WebSocket | HTTP messages between nodes |
| **Payment** | ILP micropayments (per-byte, multi-hop, marketplace) | ~p4@1.0 / ~simple-pay@1.0 (flat fee, single-hop, no marketplace) |
| **Compute** | DVM providers (kind:5xxx) | HyperBEAM devices (WASM/Lua) |
| **Storage** | Arweave (via kind:5094 DVM) | Arweave (native) |
| **Settlement** | EVM payment channels (Arbitrum) | AO token / Arweave endowment |

### The Overlap Is Arweave
Both systems use Arweave as permanent storage. TOON already stores git objects on Arweave via kind:5094. AO processes live on Arweave.

### TOON's Payment Layer Is More Sophisticated Than AO's
AO's payment devices (`~p4@1.0`, `~simple-pay@1.0`, `~faff@1.0`) are rudimentary -- flat fees, simple ledger, friends-and-family whitelist. No multi-hop routing, no marketplace discovery, no micropayment optimization.

TOON Protocol already solves this: ILP multi-hop routing, per-byte pricing, fee accumulation, service discovery (kind:10035), provider reputation (kind:31117), prepaid single-packet pattern (D7-001), supply-driven marketplace (D7-002).

### The Strategic Relationship: TOON as Procurement Layer for AO

TOON is not a competitor to HyperBEAM -- it's a **complementary payment and discovery layer**. AO handles compute and state. TOON handles multi-chain payment routing, provider marketplace, and service discovery. The analogy:

- **Stripe** doesn't run your web server -- it handles payments for it.
- **TOON** doesn't run AO processes -- it handles payments and discovery for decentralized services that AO processes (and others) consume.

HyperBEAM's native payment devices (`~p4@1.0`, `~simple-pay@1.0`) are limited to flat fees and single-hop. An AO developer who wants competing providers, cross-chain payment, and verifiable receipts needs something more. TOON provides that through a single client device.

---

## 4. HyperBEAM Device Architecture -- Key Findings

### What Is a Device
A device is an Erlang module with exported functions, accessible via URL paths on the HyperBEAM HTTP server:

```
GET  http://node:8734/~meta@1.0/info     -> calls meta device's info() function
POST http://node:8734/~message@1.0/set   -> calls message device's set() function
```

Devices compose by chaining URL paths: `/~dev1/func1/~dev2/func2` feeds output of func1 to func2.

The `stack@1.0` device sequences multiple devices over the same message: payment validation -> process execution -> state exposure.

### Device Capabilities (from HyperBEAM source analysis)

| Capability | Supported? | Evidence |
|---|---|---|
| Outbound HTTP | Yes | `hb_http_client` wraps gun for HTTP |
| Outbound WebSocket | **Yes** | gun 2.2.0 is a direct dependency, supports `gun:ws_upgrade/3` |
| Persistent connections | Yes | `hb_persistent`, `dev_process_worker`, `dev_cron` maintain long-lived processes |
| Arbitrary network calls | Yes | No restrictions on what devices call |
| Inbound WebSocket | Not today | Cowboy supports it, but `hb_http_server` doesn't implement upgrade handlers |

**Critical finding:** `gun` 2.2.0 (HTTP/WebSocket client) is already a HyperBEAM dependency in `rebar.config`. Nobody uses it for WebSocket today, but it's available. A custom device can call `gun:ws_upgrade/3` directly.

### Remote Device Loading from Arweave
HyperBEAM supports loading devices from Arweave -- **you don't need to run your own node.**

The `hb_ao_device:load/2` function supports four loading methods:

| Method | How | Requirements |
|---|---|---|
| Preloaded (by name) | Listed in `hb_opts.erl` `preloaded_devices` | Built into the node |
| Erlang module (by atom) | Already loaded in VM | Compiled into the node |
| Inline map | Passed directly on message | None |
| **Remote BEAM module** | **Loaded by Arweave tx ID** | `load_remote_devices=true` + signer in `trusted_device_signers` |

**Remote device loading flow:**
1. Compile `dev_toon_client.erl` to BEAM bytecode
2. Upload to Arweave with `content-type: application/beam`
3. Sign with your Arweave key
4. Any HyperBEAM node operator adds your key to `trusted_device_signers` and sets `load_remote_devices=true`
5. The device is fetched from Arweave, signature-verified, and dynamically loaded into the Erlang VM

**Distribution model:** Publish to Arweave once -> permanent -> any node can opt in with two config lines. No fork, no custom build, no Docker image.

---

## 5. The `~toon-client@1.0` Device -- Architecture

### Why Client, Not Peer

The original brainstorming proposed a full TOON relay reimplemented as a HyperBEAM device (`dev_toon.erl`). This was rejected because it would require:
- Full ILP routing engine (ConnectorNode reimplementation in Erlang)
- Event storage (SQLite + Nostr relay protocol)
- BLS pricing validation pipeline
- DVM handler registry
- Fee calculation (`resolveRouteFees()` port)

Estimated scope: 5,000-10,000 lines of Erlang, months of work.

**The client model is radically simpler.** The device connects to existing TOON relays as a client -- the same role as `@toon-protocol/client` in JavaScript. The relay network handles routing, settlement, storage, and provider discovery. The device handles:

| Component | Scope | Lines (est.) |
|---|---|---|
| BTP WebSocket connection | `gun:ws_upgrade/3` + BTP frame codec | ~150 |
| ILP PREPARE construction | destination, amount, expiresAt, TOON data | ~100 |
| TOON format encoding | Simple text codec | ~100 |
| FULFILL/REJECT handling | Parse result, extract receipt | ~50 |
| Connection management | `hb_persistent` patterns for long-lived BTP | ~100 |
| **Total** | | **~500** |

### Device API

```
POST ~toon-client@1.0/publish    -> Publish a Nostr event to a TOON relay (paid write)
POST ~toon-client@1.0/store      -> Upload blob via kind:5094 (Arweave storage DVM)
POST ~toon-client@1.0/compute    -> Dispatch kind:5250 compute job
POST ~toon-client@1.0/bridge     -> Broadcast tx via kind:5260 Chain Bridge
GET  ~toon-client@1.0/query      -> Query relay for events (free read)
GET  ~toon-client@1.0/discover   -> Query kind:10035 service discovery
GET  ~toon-client@1.0/status     -> Connection status and health
```

Each endpoint constructs the appropriate ILP PREPARE packet with TOON-encoded data, sends it over the BTP connection to the relay, and returns the FULFILL/REJECT response. The relay handles everything else.

### Architecture Diagram

```
+------------------------------------------------------+
|              HyperBEAM Node (Operator)                |
|                                                       |
|  ~toon-client@1.0 (loaded from Arweave)              |
|  |-- BTP WebSocket -> TOON relay (via gun)           |
|  |-- Publish events (kind:1, kind:5xxx)              |
|  |-- Subscribe to events (free reads)                |
|  |-- Construct ILP PREPARE packets                   |
|  +-- Parse FULFILL/REJECT responses                  |
|                                                       |
|  ~process@1.0 / ~wasm64@1.0 / ~lua@5.3a             |
|  |-- Local compute execution (Lua, WASM)             |
|  +-- Arweave state (native)                          |
+------------------------------------------------------+
         | BTP/WebSocket
         v
+-------------------------+     +-----------------------+
|   TOON Relay Node        |<--->|   Other TOON Relays   |
|   (ILP routing,          |     |   (network mesh)      |
|    event storage,        |     |                       |
|    payment channels,     |     |                       |
|    pricing validation)   |     |                       |
+-------------------------+     +-----------------------+
```

---

## 6. HyperBEAM Nodes as TOON DVM Providers

### The Key Insight

A HyperBEAM node with `~toon-client@1.0` is not just a *consumer* of TOON services -- it's a **provider**. It has compute (WASM/Lua), storage (Arweave-native), and chain access (AO wallet). The client device gives it a payment/discovery interface to the TOON marketplace.

### Provider Registration

The HyperBEAM node uses `~toon-client@1.0/publish` to announce its capabilities:

1. Publish kind:10035 (ServiceDiscovery) with SkillDescriptor advertising supported kinds
2. Set `kindPricing` for each supported primitive
3. TOON relay stores the advertisement; agents discover it via standard kind:10035 queries

### Multi-Primitive Provider

A single HyperBEAM node can provide **all three service primitives** through one device and one BTP connection:

| Primitive | How HyperBEAM Provides It | Backend Cost | Margin |
|---|---|---|---|
| **Compute** (kind:5250) | Execute Lua/WASM locally via `~process@1.0` or `~wasm64@1.0` | ~zero (already running) | Pure convenience fee |
| **Blob Storage** (kind:5094) | Upload to Arweave natively (HyperBEAM writes to Arweave by design) | Arweave endowment (near-zero for small blobs) | Convenience fee |
| **Chain Bridge** (kind:5260) | Broadcast signed AO messages via AO wallet | AO message fee (near-zero) | Convenience fee |

This maps directly to the convenience fee model (D8-PM-004): `client_pays = backend_cost + provider_convenience_fee`. For HyperBEAM nodes, backend cost is near-zero across all three primitives. The entire price is margin.

### What HyperBEAM Can Actually Compute

HyperBEAM has two execution engines, both sandboxed:

1. **`~lua@5.3a`** -- Lua 5.3 interpreter. Sandboxed, deterministic, no filesystem/network access. State is a Lua table persisted to Arweave after each message. Good for: business logic, data transformation, token ledgers, state machines.

2. **`~wasm64@1.0`** -- WAMR (WebAssembly Micro Runtime). Runs WASM modules compiled from Rust, C, Go, etc. Also sandboxed -- no filesystem, no network, no syscalls. Input via message, output returned. Good for: CPU-intensive pure computation.

**Neither engine can:** access a filesystem, make network calls, spawn child processes, run Docker containers, execute shell commands, or install packages at runtime.

**Compute capability tiers:**

| Tier | Jobs | HyperBEAM? | Alternative Backend |
|---|---|---|---|
| **Tier 1: Pure function** | Text/data transforms, code analysis (AST/lint via WASM), crypto ops, small ML inference (ONNX->WASM), image processing (resize/format) | **Yes** | Any |
| **Tier 2: Container** | Full test suites, package builds (npm/cargo), Docker builds, large ML inference (GPU) | **No** | Oyster CVM, Akash, Docker |
| **Tier 3: Orchestrated** | Multi-step CI/CD pipelines, long-running processes | **No** (but can be steps in a workflow) | Workflow chains (kind:10040) composing Tier 1 + Tier 2 |

**Key constraint:** Jobs must be pure functions -- input in, output out, no side effects. This IS the HyperBEAM execution model (deterministic, replayable, auditable).

**HyperBEAM advantages that apply to Tier 1:**

- **Holographic state:** Every computation's input AND output recorded on Arweave as AO messages. Permanent, auditable log of every compute job. Anyone can replay to verify (deterministic WASM/Lua).
- **Decentralization:** No single provider controls compute. Scheduler assigns execution to available nodes. For pure functions, any node with the WASM module produces identical output.
- **TEE (`~snp@1.0`):** AMD SEV-SNP attestation proves WASM module ran on attested hardware. Complements Marlin Oyster CVM attestation (kind:10033).
- **Permanent execution receipts:** AO message = proof that computation X on input Y produced output Z. Combined with TOON self-describing receipts = payment proof + computation proof + result, all permanent on Arweave. Stronger audit trail than any traditional CI/CD system.

**SkillDescriptor advertising (kind:10035):**

A HyperBEAM provider advertises Tier 1 capabilities:
```
features: ["wasm", "lua", "pure-compute", "deterministic", "tee-snp"]
kindPricing[5250]: "500"
```

An Oyster CVM provider advertises Tier 2:
```
features: ["docker", "network", "filesystem", "tee-nitro", "gpu"]
kindPricing[5250]: "5000"
```

Agents pick the right provider via `features` filter in kind:10035 discovery. Lint check -> HyperBEAM (cheap, fast). Full test suite -> Oyster CVM (expensive, capable). The marketplace sorts it out.

### DVM Result Delivery Patterns

Three patterns exist, all supported through the `~toon-client@1.0` device:

**Pattern 1: Synchronous FULFILL (fast jobs)**

Result returned in ILP FULFILL data field -- same round-trip as payment. This is the primary pattern per D7-001 ("message IS the payment"). Used today for kind:5094 (blob storage: Arweave tx ID in FULFILL data).

```
Client -> ILP PREPARE (kind:5xxx + data + payment) -> Provider
Client <- ILP FULFILL (data: result)               <- Provider
```

Handler returns `{ accept: true, data: 'result-string' }`. Works for any job completing within ILP timeout.

**Pattern 2: Two-Phase Async (long-running jobs, D8-PM-005)**

Phase 1 -- synchronous submit: Provider accepts job, returns jobId in FULFILL data. Payment captured.
Phase 2 -- async result: Provider publishes **kind:6xxx** result event to relay when done (6xxx = request kind + 1000). Client discovers via Nostr subscription or polling.

```
Phase 1: Client -> ILP PREPARE (kind:5250) -> Provider -> FULFILL (data: jobId)
Phase 2: Provider -> publishes kind:6250 event to relay -> Client subscription match
```

Progress updates via **kind:7000** (Job Feedback) during execution: `{ status: 'processing' | 'partial' | 'error' | 'success' }`.

**Pattern 3: Workflow Chains (multi-step pipelines, kind:10040)**

WorkflowOrchestrator (Epic 6) chains DVM jobs. Each step is an independent DVM job. Step N output feeds Step N+1 input. Orchestrator detects completion via relay subscriptions (kind:6xxx results).

```
Step 1: kind:5094 (store code) -> Arweave tx ID
Step 2: kind:5250 (lint/analysis) -> HyperBEAM (Tier 1, fast)
Step 3: kind:5250 (full tests) -> Oyster CVM (Tier 2, capable)
Step 4: kind:5260 (deploy) -> Chain Bridge provider
```

This IS a decentralized CI/CD pipeline -- composed from TOON primitives, not running on any single compute engine. HyperBEAM handles the cheap, fast, deterministic steps. Other backends handle the heavy lifting.

### Relay-Mediated Provider Model

The HyperBEAM provider operates through the existing relay infrastructure:

1. Subscribes to job requests targeting its pubkey (standard Nostr subscription via `~toon-client@1.0/query`)
2. Receives kind:5250/5094/5260 job requests
3. Executes the job locally on HyperBEAM
4. Returns result via sync FULFILL (fast jobs) or publishes kind:6250/6094/6260 to relay (long-running jobs)
5. Payment flows through normal ILP multi-hop routing -- the relay handles settlement

No new protocol needed. The existing relay infrastructure handles routing, payment forwarding, and event delivery.

### Provider Onboarding: Two Config Lines

Current TOON provider onboarding: install Node.js, clone repo, build, configure Docker, deploy, fund wallets, register. High barrier.

HyperBEAM provider onboarding:
1. Add TOON's Arweave key to `trusted_device_signers`
2. Set `load_remote_devices = true`
3. Device loads from Arweave automatically, registers on the TOON network

**Every existing HyperBEAM node in the AO network is a potential TOON provider.** This transforms provider bootstrapping from "recruit one node at a time" to "tap into the existing AO node network."

### The Flywheel

```
AO processes pay for TOON services
    -> TOON relay operators earn more revenue
    -> More relay operators join the network
    -> Better service availability for AO processes
    -> More AO processes use TOON
    -> TOON becomes the payment/discovery layer for AO
```

---

## 7. The "Stripe for Decentralized Services" Realization

### How the Pieces Fit

| Stripe Concept | TOON + HyperBEAM Equivalent |
|---|---|
| Customer pays in any currency | Agent pays in any chain's token |
| Stripe converts currencies | ILP routing nodes do FX (spread = profit) |
| Merchant receives preferred currency | Provider settles in their chain's token |
| Payment receipt | Self-describing receipt (chain-agnostic) |
| Stripe Connect marketplace | DVM marketplace (kind:10035) + competing providers |
| Frictionless merchant onboarding | Two config lines for HyperBEAM node operators |
| No server needed | Device on Arweave, loaded on demand |

### What TOON Provides That AO's Native Payment Doesn't

| Capability | AO Native (~p4, ~simple-pay) | Via TOON (~toon-client) |
|---|---|---|
| **Multi-hop routing** | No | Yes (ILP) |
| **Competing providers** | No (pick one) | Yes (kind:10035 marketplace) |
| **Cross-chain payment** | No (AO tokens only) | Yes (ILP FX routing) |
| **Self-describing receipts** | No | Yes (storage-type, backend, gateway, status) |
| **Provider reputation** | No | Yes (kind:31117 reviews, kind:30382 WoT) |
| **Prepaid single-packet** | No | Yes (D7-001: message IS the payment) |
| **Dynamic pricing** | No (flat fee) | Yes (per-byte, per-kind, provider-set) |

### TOON's Four Network Primitives via HyperBEAM

| TOON Primitive | HyperBEAM Provider Model |
|---|---|
| **Messaging** (kind:1) | AO process publishes events via `~toon-client@1.0/publish` |
| **Blob Storage** (kind:5094) | HyperBEAM node uploads to Arweave natively, earns convenience fee |
| **Compute** (kind:5250) | HyperBEAM node executes Lua/WASM locally, earns convenience fee |
| **Chain Bridge** (kind:5260) | HyperBEAM node broadcasts AO messages via wallet, earns convenience fee |

---

## 8. Multi-Chain Settlement via AO -- Future Exploration

> **Status:** Speculative. Not on the current roadmap (Epics 8-11). Included here as a future possibility to explore only if demand warrants. AO is currently classified as a Chain Bridge target (D8-PM-008), not a settlement chain.

### The Idea
Use AO's token blueprint to create payment channel processes on AO, enabling AO-native tokens alongside EVM tokens for TOON settlement.

### Cross-Chain Payment Abstraction (ILP FX Routing)
An agent holding AO tokens can pay for a service priced in USDC -- routing nodes perform FX conversion and profit from the spread. This is the original Interledger vision applied across blockchains.

1. Agent A holds AO tokens, wants a service priced in USDC
2. Sends ILP PREPARE with AO token payment
3. Routing node accepts AO tokens, settles with provider in USDC on Arbitrum
4. Routing node profit = spread between AO/USDC settlement

### Self-Describing Receipts (Extended)
The existing receipt format extends naturally:

```
settlement-type: ao                          (or evm, solana, etc.)
settlement-chain: ao:mainnet                 (or evm:42161:arbitrum-one)
token: <ao-token-process-id>                 (or 0xUSDC-address)
channel: <payment-channel-process-id>        (or TokenNetwork contract)
amount: 50000
message-id: <ao-msg-id>                      (or tx-hash)
gateway: https://arweave.net/               (or https://arbiscan.io/)
```

### What Changes vs. What Doesn't

**Doesn't change:** ILP transport, Nostr discovery, TOON format, DVM marketplace, "message IS the payment" thesis.

**Changes:**

| Dimension | Current (EVM only) | Proposed (Multi-chain) |
|---|---|---|
| Settlement cost | Gas on Arbitrum (~$0.01-0.10) | AO messages (free to send) |
| Settlement speed | ~1-2s (Arbitrum finality) | ~instant (AO message processing) |
| Verifiability | EVM tx hash | AO process state on Arweave |
| Permanence | Chain-dependent | Arweave (permanent) |
| Token flexibility | ERC-20 only | AO tokens + ERC-20 + any chain |
| Programmability | Solidity | Full AO process (Lua, composable) |

### Prerequisites
- `~toon-client@1.0` device proven and deployed (Phase 2)
- Demonstrated demand for AO-native settlement from HyperBEAM providers
- AO token selection decision ($AO, TOON-specific AO token, or arbitrary)
- Payment channel Lua process design (port EVM TokenNetwork semantics or AO-native)

---

## 9. R&D Path

### Phase 1: Side-by-Side Docker (Days)
- Fork `hyperbeam-docker`, `docker compose up hyperbeam-edge` alongside TOON genesis node
- Write a DVM handler in `packages/town/src/handlers/` that POSTs to local HyperBEAM for compute
- **Proves:** TOON payment -> HyperBEAM compute -> TOON receipt
- **Scope:** Node.js handler code only, no Erlang

### Phase 2: `~toon-client@1.0` Device (Weeks)
- Write `dev_toon_client.erl` -- BTP client using gun's WebSocket, ~500 lines
- Implement: BTP frame codec, ILP PREPARE construction, TOON format encoding, FULFILL/REJECT parsing
- Use `hb_persistent` patterns for long-lived BTP connection management
- Test locally with WAO JS SDK (`wao/test` -> `HyperBEAM` class)
- Upload compiled BEAM to Arweave
- Verify remote loading on a second HyperBEAM node
- **Proves:** "Any HyperBEAM node can consume TOON services with two config lines"

### Phase 3: HyperBEAM as DVM Provider (Weeks-Months)
- Extend `~toon-client@1.0` with provider capabilities (subscribe to job requests, publish results)
- Register HyperBEAM node as kind:5094 provider (Arweave storage -- native backend)
- Register as kind:5250 provider (compute via WASM/Lua execution)
- Register as kind:5260 provider (Chain Bridge via AO wallet)
- Publish kind:10035 SkillDescriptor advertising multi-primitive capabilities
- **Proves:** "HyperBEAM nodes are multi-primitive TOON providers with near-zero backend cost"

### Phase 4: AO Settlement (Future, Demand-Driven)
- Only if Phase 3 demonstrates demand for AO-native settlement
- AO token payment channels (Lua process using token blueprint)
- Multi-chain settlement adapter in `@toon-protocol/core`
- `ao:mainnet` added to `resolveChainConfig()` chain presets
- Extended self-describing receipts with `settlement-type: ao`

### Key Technical Decisions Still Needed
1. **BTP subset scope** -- full BTP spec in Erlang or minimal subset for client-mode ILP?
2. **Connection lifecycle** -- how does `hb_persistent` manage BTP connections across AO message boundaries?
3. **Provider subscription model** -- Nostr REQ filter for targeted job requests over existing BTP connection?
4. **AO token selection** (Phase 4 only) -- $AO, TOON-specific AO token, or arbitrary AO tokens?
5. **Payment channel design** (Phase 4 only) -- port EVM TokenNetwork semantics to Lua, or design AO-native channels?

---

## 10. Boring Tech / Innovation Map

| Layer | Boring Tech (Proven) | Innovation (Composition) |
|---|---|---|
| **Transport** | ILP (Interledger, 10+ years) | Multi-chain FX routing via ILP connectors |
| **Discovery** | Nostr (NIP-90, NIP-34) | Service marketplace with self-describing receipts |
| **Settlement** | ERC-20 on Arbitrum (EVM) | AO settlement as future additive layer |
| **Execution** | HyperBEAM (Erlang/OTP) | HyperBEAM nodes as TOON DVM providers |
| **Storage** | Arweave (immutable, proven) | Content-addressed git objects via DVM primitive |
| **Wire format** | TOON format (compact, human-readable) | LLM-optimized for agent consumption |
| **Device distribution** | Arweave uploads (permanent) | Remote BEAM loading -- publish once, any node can use |
| **Inter-node protocol** | BTP/WebSocket (bilateral) | gun 2.2.0 already in HyperBEAM deps |
| **Provider onboarding** | Docker + Node.js + config | Two config lines on existing HyperBEAM node |
| **Fee model** | Convenience fees (D8-PM-004) | Near-zero backend cost = pure margin for HyperBEAM providers |

---

## Appendix A: Key HyperBEAM Modules Reference

### Devices Referenced in This Document

| Device | Purpose | Relevance to TOON |
|---|---|---|
| `~p4@1.0` | Payment orchestration | AO-native payment, uses hyper-token.lua |
| `~simple-pay@1.0` | Flat-rate pricing on p4 | Current HyperBEAM payment -- limited vs TOON |
| `~patch@1.0` | Expose process state as HTTP | Future: dynamic Forge-UI rendering |
| `~lua@5.3a` | Lua script execution | On-the-fly state computation |
| `~process@1.0` | Core process execution engine | Runs Lua handlers, compute DVM backend |
| `~scheduler@1.0` | Deterministic message ordering | Ensures consistent state |
| `~stack@1.0` | Device execution chaining | Compose client + process + rendering |
| `~relay@1.0` | Message relay between nodes | HTTP-based message forwarding |
| `~snp@1.0` | TEE attestation (AMD SEV-SNP) | Complements Marlin TEE attestation |
| `~meta@1.0` | Node configuration | Health, capabilities, device listing |
| `~wasm64@1.0` | WASM execution (WAMR) | Custom compute modules for DVM |

### HB Core Modules

| Module | Purpose | Relevance |
|---|---|---|
| `hb_http_client` | gun wrapper, connection pooling | Outbound HTTP + WebSocket for BTP |
| `hb_http_server` | Cowboy server integration | Inbound HTTP (no WS upgrade today) |
| `hb_persistent` | Long-lived process management | Pattern for persistent BTP connections |
| `hb_ao_device` | Device loading + routing | Remote device loading from Arweave |
| `hb_name` | Named process registry | Register BTP connection managers |

### WAO SDK

```js
import { HyperBEAM } from "wao/test"  // Launch HB node from tests
import { AO } from "wao/web"           // Browser SDK, single-line embed
import { HB } from "wao"               // HyperBEAM client
```

NPM: `wao` (^0.40.0), `hbsig` (^0.3.0)

---

## Appendix B: TOON Decision Alignment Reference

| Decision | Summary | How This Document Aligns |
|---|---|---|
| **D7-001** | Prepaid DVM: message IS the payment, single-packet | Client device sends prepaid ILP PREPARE -- same pattern |
| **D7-002** | Supply-driven marketplace: providers advertise, customers discover | HyperBEAM providers publish kind:10035 SkillDescriptor |
| **D8-PM-004** | Convenience fee model: `client_pays = backend_cost + fee` | HyperBEAM backend cost ~zero = pure margin |
| **D8-PM-008** | AO is a blockchain (Chain Bridge), NOT compute backend | AO settlement in section 8 is speculative/future only |
| **Forge-UI** | Static Vite SPA on Arweave | Section 2c acknowledges current decision, AO rendering as future option |
| **Embedded connector** | TOON uses in-process ConnectorNode | Not relevant -- client device doesn't route, relay handles routing |
