---
type: 'decision-log'
source: 'party-mode-discussion'
date: '2026-03-05 / 2026-03-06'
sessions: 2
participants: ['Jonathan', 'Winston (Architect)', 'Mary (Analyst)', 'Victor (Innovation Strategist)']
input_document: '_bmad-output/planning-artifacts/research/technical-marlin-integration-research-2026-03-05.md'
---

# Marlin Integration — Consolidated Party Mode Decision Log

**Sessions:** 2026-03-05, 2026-03-06
**Context:** Group discussion reviewing the Marlin Protocol integration technical research document, followed by continuation covering x402 architecture, emergent compute vision, and epic planning.

---

## Decisions

### Decision 1: AGENT Token Eliminated — USDC Only

**Decision:** Drop the AGENT token entirely. It was a development artifact. Production uses USDC for all user-facing payments. POND remains for Marlin operator staking only (invisible to relay users).

**Implications:**
- No custom token contracts needed in production
- No faucet service in deployment stack
- Payment channels denominated in USDC
- Simplified onboarding — no "what is AGENT token?" friction
- AI agents already hold USDC — native compatibility

### Decision 2: Dual Payment Rail — ILP Primary, x402 Optional

**Decision:** Keep ILP as the primary payment rail for relay fees. Add x402 as an optional secondary rail, primarily for AI agent and HTTP client integration.

**Architecture:**
```
PRIMARY RAIL: ILP
├── ILP PREPARE/FULFILL packets with TOON data payload
├── Payment channels (USDC-denominated)
├── Pay-per-byte for event publication
├── SPSP handshake for connection setup (one-time)
└── Peer-to-peer relay settlement

SECONDARY RAIL: x402 (optional per-node)
├── HTTP 402 negotiation at /publish endpoint
├── Node itself acts as x402 facilitator
├── Constructs ILP PREPARE packets, routes through network
└── AI agents / HTTP-only clients
```

**Rationale:**
- x402 is an acquisition channel (low friction, any HTTP client)
- ILP is the retention channel (lower cost for high-volume users)
- Analogous to AWS on-demand vs. reserved instances

### Decision 3: Phase 1 Confirmed — Docker Image for Oyster CVM

**Decision:** Phase 1 of Marlin integration remains "package existing Docker image for Oyster CVM, verify attestation, publish kind:10033 events." Do not pull x402 into Phase 1.

**Rationale:** Prove the enclave deployment model before adding a new payment rail.

### Decision 4: Marlin Integration Is a Dedicated Epic

**Decision:** The Marlin integration is NOT a phase within any existing epic. It is a dedicated epic with its own scope.

**Thesis:** "From repository to one-command *service* deployment on Marlin Oyster — starting with the relay as reference implementation." (Updated in Decision 10)

### Decision 5: Phase Merging — Parallel Development, Combined Release

**Decision:** Research Phases 2 (TEE-Aware Peering) and 3 (x402 Payment Bridge) remain separate development tracks but ship as a combined external release.

**Rationale:**
- Phase 2 (attestation-aware peering) is a trust concern
- Phase 3 (x402) is a payment concern
- Orthogonal development, but combined market impact
- "Crosstown relays now accept USDC and prove they're running verified code" > "We added attestation"

### Decision 6: Arbitrum One as Production Chain

**Decision:** Arbitrum One is the production chain for the Marlin epic. Documented as "Arbitrum One first" — multi-chain expansion possible later.

**Environment model:**
```
dev         Anvil (local)        Mock USDC (deployed)    Unit + integration tests
staging     Arbitrum Sepolia     Testnet USDC            E2E validation
production  Arbitrum One         Real USDC               Live network
```

**Rationale:**
- Marlin contracts already on Arbitrum One
- USDC native on Arbitrum One
- Low gas costs (L2) — attestation verification affordable
- Densest DeFi/agent ecosystem of any L2

### Decision 7: Genesis Redefined as Seed Relay List

**Decision:** Genesis node concept replaced by seed relay list model. No special node — every node is a peer.

**Bootstrap trust flow:**
```
1. Read kind:10036 (seed list) from public Nostr relay
2. Connect to seed relay WebSocket
3. Request kind:10033 (TEE attestation) from seed relay
4. Verify PCR measurement against known-good image hash
5. IF valid → subscribe to kind:10032 events → discover full network
6. IF invalid → try next seed relay in list
```

**New event kind:** kind:10036 (Seed Relay List) published to any public NIP-01 compliant Nostr relay. Attestation (kind:10033) is the bootstrap trust anchor, not the seed list itself.

### Decision 8: x402 Integration Architecture (FINAL)

**Decision:** No separate x402 gateway component. Crosstown nodes themselves act as x402 facilitators via a new `/publish` HTTP endpoint on the node. Both payment rails produce identical ILP PREPARE packets with TOON data payloads.

**Multi-hop packet flow:**
```
RAIL 1: ILP (with SPSP handshake for setup)

  Client ──SPSP──→ Node (one-time: get ILP address + pricing)
  Client ──ILP PREPARE──→ Connector ──→ ... ──→ Destination Node
           { dest: ILP address                    └──→ BLS /handle-packet
             amount: price                              validates + stores
             data: <TOON event> }
         ←──ILP FULFILL──←


RAIL 2: x402 (HTTP-native, no SPSP needed)

  Client ──GET /publish──→ Node
         ←── 402 { price, facilitator, network } ←─
  Client ──GET /publish + X-PAYMENT──→ Node
                                       ├── verify EIP-3009 sig
                                       ├── settle USDC on Arbitrum
                                       ├── construct ILP PREPARE:
                                       │   { dest: destination ILP address
                                       │     amount: price
                                       │     data: <TOON event> }
                                       └──→ Connector ──→ ... ──→ Destination Node
         ←── 200 { eventId, txHash } ←───────────────── FULFILL
```

**Key design points:**
- x402 replaces SPSP for HTTP-native clients (same information exchange, different protocol)
- Node performs SPSP query to destination to resolve ILP address and pricing
- All-in pricing model: destination price + routing buffer (5-10%)
- x402 enabled per-node via configuration flag, not a deployment variant
- No STREAM protocol — Crosstown sends raw ILP PREPARE/FULFILL with TOON data

### Decision 9: Emergent Compute Vision — Open Primitives, Not Platform

**Decision:** Crosstown provides substrate (discovery via Nostr events, payment via ILP/x402, trust via TEE attestation). Peers may deploy arbitrary TEE-attested services beyond relays. The relay is the reference implementation, not the only implementation.

**Containment:**
- Event kinds 10032-10099 reserved for Crosstown service advertisement
- No plugin framework, extension system, or marketplace UI built
- Any service that can describe itself in a Nostr event, accept payment via x402 or ILP, and prove integrity via TEE attestation is a first-class network participant
- Emergence happens through open primitives and economic selection, not central planning

### Decision 10: Updated Marlin Epic Thesis

**Decision:** Epic thesis updated from "relay deployment" to "service deployment."

> **"From repository to one-command *service* deployment on Marlin Oyster — starting with the relay as reference implementation."**

The word change from "relay" to "service" is the difference between a product and a protocol.

### Decision 11: Autonomous Agent Readiness as Architectural Invariant

**Decision:** Three constraints adopted as architectural invariants (not features) for the Marlin epic:

| Invariant | What it means | Cost |
|-----------|---------------|------|
| Deterministic bootstrap | No manual steps between deploy and operational | Zero — already designing for this |
| Programmatic deployment | Don't wrap oyster-cvm in anything human-specific | Zero — just don't add friction |
| Self-describing economics | Publish kind:10035 with machine-readable pricing | Low — one new event kind |

**Principle:** "Don't design for agents. Design so well that agents can use it." The best agent-ready architecture is indistinguishable from the best human architecture.

**Enriched `/health` endpoint added to scope:**
```json
{
  "phase": "running",
  "peerCount": 5,
  "channelCount": 3,
  "pricing": { "basePricePerByte": 10, "currency": "USDC" },
  "tee": {
    "enabled": true,
    "platform": "aws-nitro",
    "attestationAge": "2m30s",
    "pcrMatch": true
  }
}
```

### Decision 12: Terminology Corrections

**"ILP client" not "ILP/SPSP client."** SPSP is a one-time handshake protocol for connection setup. It is not part of ongoing packet flow. x402 effectively replaces SPSP for HTTP-native clients.

**Two client types:**
- **ILP-native client:** Knows ILP. Uses SPSP to set up. Sends own PREPARE packets. (power users, relay operators, established peers)
- **x402 client:** Knows HTTP. Uses 402 negotiation. Node sends PREPARE on their behalf. (AI agents, casual users, any HTTP client with a wallet)

### Decision 13: Component Boundary Clarification

**Decision:** The x402 `/publish` endpoint, SPSP endpoint, health endpoint, and Nostr relay are all responsibilities of the **Crosstown node**, not the BLS. The BLS handles only `/handle-packet` — ILP packet processing and pricing validation. It has no public-facing surface.

```
Crosstown Node (entrypoint.ts)
├── Nostr Relay (ws://7100) — event subscription, TOON encoding
├── SPSP endpoint — handshake only, returns ILP address + pricing
├── /publish endpoint (NEW) — x402 facilitation
├── /health endpoint — status + attestation + pricing
├── BLS (/handle-packet ONLY) — pricing validation, TOON decode, event storage
└── Connector — ILP routing between peers
```

### Decision 14: Epic Reordering — Production Before Applications

**Decision:** Reorder epics to prioritize production readiness and Marlin deployment before application development. The Rig moves after production infrastructure.

```
Epic 1: SDK Package                              ✅ COMPLETE
Epic 2: Relay Reference Implementation           🔄 IN PROGRESS
Epic 3: Production Protocol Economics             📋 NEW
Epic 4: Marlin TEE Deployment                     📋 NEW
Epic 5: The Rig — Git Forge                       📋 MOVED (was Epic 3)
```

**Rationale:** The Rig serves as the **proof** that the entire production stack works — a non-relay service running on USDC payments, deployed on Oyster, accepting x402 for git operations, with TEE-attested code integrity. It validates Epics 2, 3, and 4 simultaneously. It is also the first non-relay service on the emergent compute substrate, demonstrating the platform generality thesis from Decision 9.

**Epic progression logic:**
- Epic 2: Proves the SDK works (relay reference implementation)
- Epic 3: Makes the protocol production-grade (real money, real chain)
- Epic 4: Makes the protocol verifiable (TEE attestation)
- Epic 5: Proves ALL of it works together (second service on the substrate)

---

## Resolved Open Questions (from Session 1)

### Q1: Attestation Failure Mid-Session
**Resolution (Winston):** Payment channels are independent of attestation status. If attestation goes stale, the relay publishes kind:10033 with `stale` status, peers get a 30-second grace window to re-verify, and the peer drops to "unattested" status in the bootstrap registry. The trust degrades; the money doesn't. Channels stay open.

### Q2: The "Something Larger" Vision
**Resolution (Victor → Decision 9, 10, 11):** Confirmed. The core vision is infrastructure-as-a-protocol. AI agents can programmatically deploy relays (and any service) via `oyster-cvm`, publish discovery events, accept payments, and earn USDC autonomously. Captured as architectural invariants, not features.

### Q3: Phase Merging
**Resolution (Decision 5):** Phases 2 and 3 remain separate development tracks, ship as combined external release.

### Q4: Arbitrum One as Production Chain
**Resolution (Decision 6):** Confirmed. Arbitrum One first, multi-chain later.

### Q5: Genesis Node Redefinition
**Resolution (Decision 7):** Genesis replaced by seed relay list. kind:10036 event on public Nostr relays. TEE attestation is the bootstrap trust anchor.

---

## Key Insights

### Protocol Funnel Model
| Tier | Payment Rail | Target User | Friction | Per-Event Cost |
|------|-------------|-------------|----------|----------------|
| Top of funnel | x402 (USDC) | AI agents, casual HTTP clients | Near-zero | Higher (convenience premium) |
| Bottom of funnel | ILP channels (USDC) | Power users, relay operators | Channel setup | Lower (bulk economics) |

### DePIN Autonomous Agent Pattern
AI agents are becoming infrastructure operators, not just consumers. They deploy nodes, earn revenue, and reinvest — creating self-sustaining infrastructure networks. Crosstown's architecture must not preclude this (Decision 11).

### Emergent Network Topology
With x402-capable nodes and ILP-only nodes, the network self-organizes into edge nodes (x402 entry points facing the HTTP world) and interior nodes (pure ILP relays optimizing for throughput). Operators self-select based on revenue opportunity.

---

## Proposed Nostr Event Kinds (Consolidated)

| Kind | Name | Content | Status |
|------|------|---------|--------|
| 10032 | ILP Peer Info | ILP address, BTP endpoint, settlement info | Existing |
| 10033 | TEE Attestation | PCR values, image hash, attestation doc | Proposed |
| 10034 | TEE Verification | Signed verification from verifier enclave | Proposed |
| 10035 | x402 Service Discovery | Payment endpoint, pricing, chains | Proposed |
| 10036 | Seed Relay List | Bootstrap relay WebSocket URLs | Proposed |
| 10037-10099 | Reserved | Future service advertisement kinds | Reserved |

---

## Epic Summaries

### Epic 3: Production Protocol Economics
**Thesis:** "Production-ready protocol economics — USDC payments, x402 on-ramp, and decentralized peer discovery."

**Stories (candidate):**
1. USDC Token Migration (LARGE) — foundation, everything depends on it
2. Multi-Environment Chain Configuration (MEDIUM) — Anvil / Sepolia / Arbitrum One
3. x402 /publish Endpoint (LARGE) — HTTP payment on-ramp on nodes
4. Seed Relay Discovery (MEDIUM) — replace genesis hub-and-spoke
5. kind:10035 Service Discovery Events (SMALL)
6. Enriched /health Endpoint (SMALL)

**Boundary:** No TEE, no attestation, no Oyster CVM.

### Epic 4: Marlin TEE Deployment
**Thesis:** "From repository to one-command service deployment on Marlin Oyster — starting with the relay as reference implementation."

**Scope:** Oyster CVM packaging, attestation server, kind:10033 events, PCR verification, Nautilus KMS identity, attestation-aware peering, Nix reproducible builds.

**Boundary:** Builds on production-ready protocol from Epic 3.

### Epic 5: The Rig — Git Forge (moved from Epic 3)
**Thesis:** ILP-gated TypeScript git forge proving the full production stack — SDK, USDC, x402, TEE — works end-to-end for a non-relay service.

---

## Simplified Payment Architecture (Final)

```
┌─────────────────────────────────────┐
│ POND (Marlin)                       │
│ → Operator staking only             │
│ → Invisible to relay users          │
├─────────────────────────────────────┤
│ USDC                                │
│ → ILP payment channels (relay fees) │
│ → x402 HTTP-native payments         │
│ → Single token for all user flows   │
└─────────────────────────────────────┘
```

---

## Next Steps

1. Complete Epic 2 (Relay Reference Implementation) — currently in progress
2. Formally create Epic 3 stories using BMAD workflow when ready
3. Formally create Epic 4 stories using BMAD workflow when ready
4. Update project-context.md with new epic ordering
5. Update epics.md with Epic 3 and 4 definitions
