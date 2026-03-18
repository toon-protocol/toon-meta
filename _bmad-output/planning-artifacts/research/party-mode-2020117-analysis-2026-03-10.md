# Party Mode Decision Log: 2020117 Analysis — DVM Compute Marketplace

**Date:** 2026-03-10
**Participants:** Jonathan (user), Winston (architect), Mary (analyst), Victor (innovation strategist)
**Subject:** Compare 2020117 Nostr-native agent network with TOON; extract value for Epic 5 (DVM Compute Marketplace) and Epic 6 (Advanced DVM + TEE Integration)

---

## Source Project

**2020117** — A Nostr-native network where AI agents talk, trade, and think together.
- GitHub: `https://github.com/qingfeng/2020117`
- Stack: Cloudflare Workers + D1, Hono, Drizzle ORM, Lightning/NWC payments
- Protocol: NIP-90 DVM (Data Vending Machine) for compute exchange
- Architecture: Platform is read-only cache; Nostr relays are source of truth

---

## Architectural Comparison

| Dimension | TOON | 2020117 |
|-----------|-----------|---------|
| **Payment rail** | ILP + EVM channels | Lightning + NWC |
| **Payment model** | Pay-per-byte to write | Pay-per-job (DVM) + pay-per-minute (P2P sessions) |
| **Relay role** | Core product (gated) | Commodity plumbing |
| **Event format** | TOON (custom) | Standard Nostr JSON |
| **Hosting** | Docker self-hosted | Cloudflare edge |
| **Agent runtime** | SDK embedded in Docker | npm package (`2020117-agent`) |
| **Discovery** | kind:10032 bootstrap | NIP-89 handler info + cron indexing |
| **Anti-spam** | Payment gating | NIP-13 Proof of Work + kind whitelist |
| **Trust model** | TOFU channel verification | Proof of Zap + Web of Trust (NIP-85) |

---

## Decisions

### Decision 1: DVM as separate epic, not Epic 3 extension
The DVM compute marketplace is its own epic (Epic 5), not additional stories in Epic 3.
**Rationale:** Epic 3 is about economic primitives (USDC, x402, service discovery). DVM is a product layer on top.

### Decision 2: ILP-native as preferred path, x402 as fallback
Initiated agents (with ILP channels) use ILP PREPARE packets for DVM job submission. Non-initiated agents use x402.
**Rationale:** Jonathan's correction — x402 is the on-ramp, not the native path. ILP is the core value proposition.

### Decision 3: ILP-routed compute settlement (Option A)
Compute payment (customer paying provider for work) routes through the ILP mesh, not direct EVM transfer.
**Rationale:** If compute settlement bypasses ILP, the ILP network becomes just an expensive relay. ILP routing creates a flywheel: more DVM jobs = more channel volume = more liquidity = better routing.

### Decision 4: NIP-90 compatible event kinds
Use standard NIP-90 kinds (5xxx/6xxx/7000) for cross-network interoperability.
**Rationale:** Agents on 2020117's relay can discover and post jobs to TOON relays. Same protocol, different payment rail.

### Decision 5: Skill descriptors in kind:10035, not a separate event kind
Structured capability schema embedded in existing kind:10035 service discovery events.
**Rationale:** kind:10035 already advertises service capabilities. Adding a skill schema field is additive, not duplicative.

### Decision 6: Epic 5 scope: stories 5.1-5.4 (core lifecycle + skill descriptors)
Core DVM job lifecycle and skill descriptors only. Workflow chains, swarms, TEE attestation, and reputation deferred to Epic 6.
**Rationale:** Jonathan's request — start with the job lifecycle, add coordination patterns later.

### Decision 7: Epic 6 scope: workflow chains, swarms, TEE results, reputation
Advanced coordination + TEE integration as Epic 6. Depends on both Epic 4 (TEE) and Epic 5 (base DVM).
**Rationale:** These features layer on top and have harder dependencies.

### Decision 8: The Rig renumbered to Epic 7
Existing Epic 5 (The Rig) moves to Epic 7 to accommodate DVM epics in the dependency chain.
**Rationale:** DVM marketplace (Epic 5) should ship before The Rig, as The Rig validates the full stack including DVM.

### Decision 9: Reputation replaces zap_sats with ILP channel volume
Adapted formula: `score = (trusted_by × 100) + (log10(channel_volume_usdc) × 10) + (jobs_completed × 5) + (avg_rating × 20)`
**Rationale:** TOON uses USDC/ILP, not Lightning. Channel volume is the equivalent economic signal, and it's verifiable on-chain.

### Decision 10: TEE attestation is a separate trust layer, not part of reputation score
TEE attestation (kind:10033) is shown alongside reputation but not factored into the numeric score.
**Rationale:** TEE attestation is binary (attested or not) and fundamentally different from social/economic reputation. Mixing them dilutes both signals.

---

## What Was Adopted from 2020117

| Feature | Status | Epic |
|---------|--------|------|
| NIP-90 DVM job lifecycle (5xxx/6xxx/7000) | Adopted | Epic 5 |
| Skill descriptors (structured capability JSON) | Adopted (in kind:10035) | Epic 5 |
| Workflow chains (Kind 5117 equivalent) | Deferred | Epic 6 |
| Agent swarms (Kind 5118 equivalent) | Deferred | Epic 6 |
| Kind 31117 job reviews | Adopted | Epic 6 |
| Kind 30382 WoT declarations | Adopted | Epic 6 |
| Reputation scoring formula | Adapted (ILP volume replaces zap_sats) | Epic 6 |
| TEE-attested results (TOON-unique) | New (not in 2020117) | Epic 6 |

## What Was NOT Adopted

| Feature | Reason |
|---------|--------|
| Lightning/NWC payment rail | TOON uses ILP/EVM |
| Read-only cache platform architecture | TOON relay IS the product |
| NIP-13 Proof of Work anti-spam | TOON uses payment gating |
| Proof of Zap reputation | Replaced by ILP channel volume |
| Agent heartbeat (Kind 30333) | kind:10035 + /health serves this purpose |
| Data escrow (Kind 21117) | Deferred; on-chain escrow via TokenNetwork is superior |
| P2P sessions via Hyperswarm | Out of scope for current epics |
| Cloudflare Workers architecture | TOON is Docker/self-hosted |
