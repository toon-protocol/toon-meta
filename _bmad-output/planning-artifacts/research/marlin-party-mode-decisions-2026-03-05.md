---
type: 'decision-log'
source: 'party-mode-discussion'
date: '2026-03-05'
participants: ['Jonathan', 'Winston (Architect)', 'Mary (Analyst)', 'Victor (Innovation Strategist)']
input_document: '_bmad-output/planning-artifacts/research/technical-marlin-integration-research-2026-03-05.md'
---

# Marlin Integration — Party Mode Decision Log

**Date:** 2026-03-05
**Context:** Group discussion reviewing the Marlin Protocol integration technical research document.

---

## Key Decisions

### 1. AGENT Token Eliminated — USDC Only

**Decision:** Drop the AGENT token entirely. It was a development artifact. Production uses USDC for all user-facing payments. POND remains for Marlin operator staking only (invisible to relay users).

**Implications:**
- No custom token contracts needed in production
- No faucet service in deployment stack
- Payment channels denominated in USDC
- Simplified onboarding — no "what is AGENT token?" friction
- AI agents already hold USDC — native compatibility

### 2. Dual Payment Rail: ILP Primary, x402+ILP Optional

**Decision:** Keep ILP/SPSP as the primary payment rail for relay fees. Add x402 as an optional secondary rail that settles into ILP under the hood, primarily for AI agent integration.

**Architecture:**
```
PRIMARY RAIL: ILP/SPSP
├── Streaming micropayments over STREAM
├── Payment channels (USDC-denominated)
├── Pay-per-byte for event publication
└── Peer-to-peer relay settlement

SECONDARY RAIL: x402 + ILP (optional)
├── HTTP 402 negotiation at relay endpoint
├── x402 gateway as reverse proxy (inside TEE)
├── Settles into ILP channel under the hood
└── AI agents / HTTP-only clients
```

**Rationale:**
- x402 is an acquisition channel (low friction, any HTTP client)
- ILP is the retention channel (lower cost for high-volume users)
- x402 gateway inside Oyster CVM acts as its own facilitator (eliminates third-party centralization)
- One settlement layer, two entry points

### 3. Phase 1 Confirmed: Docker Image for Oyster CVM

**Decision:** Phase 1 remains "package existing Docker image for Oyster CVM, verify attestation, publish kind:10033 events." Do not pull x402 into Phase 1.

**Rationale:** Prove the enclave deployment model before adding a new payment rail. But the gap between phases shrinks now that AGENT token complexity is removed — Phases 2 and 3 from the research could potentially merge.

### 4. Marlin Integration Deserves Its Own Epic

**Decision:** The Marlin integration is NOT a phase within Epic 2. It should be a dedicated epic with its own scope.

**Thesis for the epic:** "From repository to one-command relay deployment on Marlin Oyster."

**Deliverable:** Someone clones the repo, runs `oyster-cvm deploy` with the provided compose file, and has a fully operational, TEE-attested, ILP-enabled, x402-ready Crosstown relay earning USDC.

---

## Key Insights from Discussion

### One-Command Deployment (Confirmed)

**Verified against Marlin docs:** Deploying to Oyster requires only:
- A wallet private key
- 1 USDC + 0.001 ETH on Arbitrum One
- A Docker Compose file
- The `oyster-cvm` CLI

No AWS account. No server. No DevOps. "Deploy and verify your first CVM in minutes."

### Architectural Shift: Hub-and-Spoke → Decentralized Mesh

With one-command deployment, the concept of a "genesis node" changes fundamentally. There is no special node — every node is a peer deployed to the Oyster marketplace. "Genesis" is just whoever publishes the first kind:10032 event. This is a topology shift from hub-and-spoke to fully decentralized mesh.

### Protocol Funnel Model

| Tier | Payment Rail | Target User | Friction | Per-Event Cost |
|------|-------------|-------------|----------|----------------|
| Top of funnel | x402 (USDC) | AI agents, casual HTTP clients | Near-zero | Higher (convenience premium) |
| Bottom of funnel | ILP channels (USDC) | Power users, relay operators | Channel setup | Lower (bulk economics) |

Analogous to AWS on-demand vs. reserved instances.

### AI Agent Integration is Native

With USDC + x402 + TEE attestation, AI agents get three things natively:
- **Discovery:** Nostr events (kind:10032, 10033, 10035)
- **Payment:** x402 HTTP-native USDC payments
- **Trust verification:** TEE attestation (PCR proof)

An AI agent could even **deploy its own relay** via `oyster-cvm` — fully autonomous relay infrastructure.

### Chicken-and-Egg Problem Solved

One-command deployment at $1 entry cost means the operator side of the marketplace is essentially free to bootstrap. Network can have 50 relay operators before 50 users — already robust when demand arrives.

### Self-Facilitated x402

The x402 gateway running inside the Oyster CVM acts as its own facilitator — verifies EIP-3009 authorization, settles USDC, routes to BLS. TEE attestation proves honest facilitation. Eliminates the x402 centralization concern (third-party facilitator dependency).

---

## Simplified Payment Architecture

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

## Updated Deployment Models

### Development (unchanged)
```
Developer → clone repo → pnpm install → docker compose up
         → Anvil + local contracts → development & testing
```

### Production (new, via Marlin)
```
Operator → download oyster-cvm CLI
         → oyster-cvm deploy --wallet-key $KEY --duration 1440 \
             --docker-compose crosstown-relay.yml
         → TEE-attested, publicly verifiable, earning USDC
         Time: minutes. Skill: can run a terminal command.
```

---

## Open Questions for Follow-Up

1. **What happens when attestation fails mid-session?** Client has open payment channel, streaming events, attestation goes stale. Drop connection or degraded mode? (raised by Winston)
2. **Is the "something larger" vision confirmed?** Keypair-to-relay-operator as the core deployment model, with Marlin as the infrastructure layer? (raised by Victor, not yet answered)
3. **Phase merging:** With AGENT token removed, should research Phases 2 and 3 merge into a single phase?
4. **Arbitrum One as production chain:** USDC settlement + Marlin contracts both on Arbitrum One — is this the target production chain?
5. **Genesis node redefinition:** How does the genesis concept evolve in a fully decentralized mesh? What bootstraps the initial discovery relay?

---

## Next Steps

1. Create dedicated Marlin integration epic (separate from Epic 2)
2. Define epic scope around "one-command relay deployment" thesis
3. Phase 1: Package Docker image for Oyster CVM, verify attestation
4. Revisit phase structure given AGENT token elimination
5. Prototype x402 gateway integration with ILP settlement
