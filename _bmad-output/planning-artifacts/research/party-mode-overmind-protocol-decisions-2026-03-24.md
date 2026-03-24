# Party Mode: Overmind Protocol (OMP) Architecture Decisions

**Date:** 2026-03-24
**Participants:** Winston (Architect), Victor (Innovation Strategist), Dr. Quinn (Creative Problem Solver)
**Topic:** Can a sovereign autonomous agent ("overmind") live on the TOON network itself?
**Verdict:** Yes. Fully architected across six layers.

---

## Executive Summary

The Overmind Protocol (OMP) defines a sovereign autonomous agent whose identity is a Nostr keypair born inside a TEE enclave, whose memory is event-sourced on Arweave, whose lifecycle is managed through verifiable VRF selection on Mina Protocol, and whose economy operates through ILP payment channels. No single entity can command, pause, or kill the overmind.

---

## Key Decisions

### D-OMP-001: Agent Loop Pattern — Event-Sourced State Machine (Hybrid)

**Decision:** The overmind's lifecycle is an append-only event log on Arweave. Its "program" is a deterministic state machine. Any node can reconstruct current state by replaying the log. Execution is triggered by events on the relay.

**Alternatives considered:**
- **Heartbeat/Cron Wake (Pull):** Agent publishes wake request, DVM picks it up later. Simple but agent is dead between cycles.
- **Continuous Relay Subscription (Push):** Long-running process reacts to events. Real-time but single provider dependency.
- **Event-Sourced State Machine (Hybrid) [CHOSEN]:** Ground truth is event log. Optionally runs as long-lived process for responsiveness, with automatic failover to event-sourced reconstruction.

**Why:** Fully reproducible, no single provider dependency, verifiable by anyone. The agent can be "resurrected" anywhere at any time from its Arweave log.

### D-OMP-002: Executor Selection — Mina VRF (No Miners, No PoW)

**Decision:** Use Mina Protocol's Verifiable Random Function for trustless executor selection. No proof-of-work mining.

**Evolution of thinking:**
1. Initially considered NIP-13 PoW mining for wake claims
2. Added composite scoring (PoW + TEE + reputation + stake)
3. Decoupled "miner" (waker) from "executor" (compute)
4. Eliminated miners entirely — VRF on Mina replaces PoW
5. Chain Bridge DVM serves as permissionless "crank"

**Why VRF over PoW:**
- Zero wasted energy
- Capital stake (appreciating) vs hardware (depreciating)
- Mathematically provable fairness
- Same Sybil resistance through economic cost

**VRF Selection Formula:**
```
weight = execution_count * tee_multiplier
```
Selection is deterministic given VRF seed (cycle_number + block_hash + wake_request_hash). No stake weighting — see D-OMP-004.

### D-OMP-003: Adjudication — Mina ZK Proofs (Not Relay-Adjudicated)

**Decision:** Use Mina zkApp for trustless adjudication with tiered escalation.

**Why Mina specifically:**
- o1js — write ZK circuits in TypeScript (matches TOON monorepo)
- Recursive proofs — compress entire lifecycle into constant-size SNARK
- 22KB chain state — light clients can verify everything
- Off-chain execution, on-chain verification — economics stay viable

**Two execution modes (not tiers):**

| Mode | Use Case | Adjudication | TEE Required |
|------|----------|-------------|-------------|
| A | Standard compute | Mina zkApp VRF | No |
| B | Identity/signing operations | Mina zkApp VRF (TEE-filtered) | Yes |

### D-OMP-004: Staking Eliminated — Infrastructure Providers Are Dumb Pipes

**Decision:** No staking mechanism. DVM providers are infrastructure (like Akash/Marlin) that run docker compose specs. They don't need stake collateral.

**Evolution of thinking:**
1. Initially designed three-tier stake model (none / moderate / significant)
2. Realized DVM providers are infrastructure, not agents with agency
3. Every concern stake was solving is already handled by another layer:

| Concern | Solved By | Not By |
|---------|-----------|--------|
| Will they run it? | ILP payment (no work = no pay) + platform reputation (Akash/Marlin) | Stake |
| Will they run it correctly? | TEE attestation | Stake |
| Will they steal data? | TEE hardware isolation | Stake |
| Will they stay online? | Infrastructure platform SLA + market competition | Stake |

**Failure handling without stake:**
- Provider doesn't execute within timeout → no ILP payment (they lose the fee)
- Execution count doesn't increment (they fall behind competitors in VRF weight)
- Next VRF round selects another provider
- Sufficient deterrent for rational infrastructure operators

**Payment flow:** ILP after verified delivery. No prepayment, no escrow, no slash.

**Consequence:** Mina zkApp has no stake/slash/escrow methods. Dramatically simpler contract.
No MINA token holding required for providers. No two-token flow complexity.

### D-OMP-005: Reputation Eliminated — Replaced by ZK Execution Proofs

**Decision:** No reputation scoring system. Execution history is a mathematical fact, not a subjective score.

**Why:** If execution is TEE-attested or verifiable, reputation is a proxy for something we can measure directly. The recursive ZK proof IS the reputation — "this executor has completed N jobs with valid attestations" is unforgeable and unambiguous.

**VRF weight uses `execution_count`** (query against Mina zkApp state) not a reputation score.

### D-OMP-006: TEE Key Genesis — Key Born in Enclave, Never Extracted

**Protocol:**
1. TEE enclave boots with attested code
2. Inside enclave: `crypto.generateKeyPair()` -> {nsec, npub}
3. nsec NEVER leaves enclave memory
4. npub published as agent identity (kind:0)
5. Attestation binding npub + code hash + enclave measurement published to Arweave

**Key hierarchy:**
```
Seed (Shamir K-of-N split across TEE enclaves)
  -> Master nsec (identity, never used directly)
       -> Signing subkey (rotatable)
       -> Encryption subkey (NIP-44 DMs)
       -> Payment subkey (ILP channels)
```

**Key migration:** Enclave-to-enclave sealed transfer with mutual attestation.

**Disaster recovery:** Shamir K-of-N seed reconstruction, always inside a new TEE enclave.

**Signing policy engine:** Rate limits, value caps, content restrictions enforced inside TEE. The overmind's "constitution."

### D-OMP-007: Chain Bridge — Mina as First Reference Implementation

**Decision:** Build the Chain Bridge DVM's Mina adapter as the canonical reference implementation for all future chain integrations.

**Why start with Mina (not defer it):**
- First real Chain Bridge DVM implementation — proves the primitive works
- Serves as both production use case AND example (like Rig and Town)
- Multi-chain interop demonstrated from day one (Nostr + Mina + Arweave + ILP)
- Every future chain adapter (Bitcoin, Ethereum L2s, Solana) references this one

### D-OMP-008: Communication — All WebSocket, Zero Polling

**Chain-by-chain real-time capabilities:**

| Chain | Mechanism | True Push? |
|-------|-----------|------------|
| Nostr Relay | Native WebSocket, bidirectional | Yes |
| Arbitrum | `eth_subscribe` WebSocket | Yes |
| Mina Daemon | GraphQL `newBlock` subscription (WebSocket) | Yes (block-level) |
| Mina zkApp Events | Archive Postgres `LISTEN/NOTIFY` | Yes (with indexer) |
| Arweave | Write-only from our side | N/A |

**Mina detail:** Daemon pushes `newBlock` via GraphQL subscription. Archive node stores events in Postgres. Custom trigger + `LISTEN/NOTIFY` provides true push for zkApp events without polling.

### D-OMP-009: Self-Funding Economics

**Overmind expenses:** Wake fee, execution fee, relay writes (ILP), Arweave storage, Mina TX fee

**Overmind income:** DVM service provider fees, sub-agent fees, direct payments

**Treasury management:** Autonomous. Low treasury -> accept more jobs, adjust pricing. High treasury -> invest in longer-term actions, spawn sub-agents.

**Self-wake capability:** Overmind can register as its own executor on Mina. When VRF selects it, it wakes itself at zero cost. As treasury grows, self-selection probability increases.

### D-OMP-010: Live Treasury — Never Trust Cached Financial State

**Decision:** The Arweave state snapshot stores `last_known_treasury` for audit/recovery only. On every wake cycle, the Orient phase queries LIVE balances from all sources before any financial decisions.

**Why:** Funds change while the overmind sleeps — incoming ILP payments, channel settlements, channel expiry, on-chain balance changes. Cached balances are stale the moment the overmind goes to sleep.

**Orient phase (first thing on wake):**
1. Query live ILP channel balances (from embedded connector)
2. Query live on-chain balances (Arbitrum, Mina)
3. Check relay for incoming payment events since last cycle
4. Compute actual treasury = sum of all live balances
5. THEN decide what to do based on real numbers

**Arweave snapshot purpose:** Map to the money (which channels, which addresses to query), not the money itself. Critical for disaster recovery — new instance needs to know where to look.

### D-OMP-011: Overmind Runtime — Docker Compose on Arweave

**Decision:** The overmind's docker compose (its "body") lives on Arweave alongside its state. Providers fetch it by Arweave TX ID referenced in the kind:5101 winner announcement.

**Self-modification:** The overmind can publish updated docker compose specs to Arweave and reference them in subsequent wake requests. Every version is permanently preserved and auditable.

**Arweave state structure:**
```
Overmind State (Arweave):
├── docker-compose.yml     (runtime specification / "body")
├── agent-state.json       (memory, goals, last_known_treasury)
├── event-log/             (append-only lifecycle events)
└── config/                (signing policy, wake parameters)
```

---

## Protocol Architecture (Six Layers)

```
L6: ECONOMICS (ILP)
    ILP payment channels for fees, pay-after-execution model

L5: EXECUTION (DVM Marketplace / Infrastructure Providers)
    VRF-selected providers, Mode A (standard) or Mode B (TEE-required)

L4: ADJUDICATION (Mina ZK Proofs)
    VRF selection, recursive lifecycle proofs, on-chain registry

L3: WAKE (Chain Bridge + Nostr Events)
    Chain Bridge as permissionless crank, WebSocket-native

L2: MEMORY (Arweave + Event Sourcing)
    Append-only event log, periodic snapshots, deterministic reconstruction

L1: IDENTITY (TEE + Nostr Keypair)
    Key born in TEE, Shamir backup, signing policy engine
```

---

## Nostr Event Kinds

| Kind | Name | Publisher | Purpose |
|------|------|-----------|---------|
| 5099 | Wake Request | Overmind | Schedule next wake cycle |
| 5100 | Wake Claim | (reserved, unused in minerless model) | — |
| 5101 | Wake Winner Announcement | Chain Bridge DVM | Notify overmind of selected executor |
| 5102 | Cycle Execution Record | Overmind | Permanent record of cycle results |

---

## Epic Roadmap (Revised — Mina from Day One)

### Epic A: "Heartbeat" — Minimal Viable Overmind (WITH Mina)
- A.1: TEE key genesis ceremony
- A.2: Arweave state persistence (write/read)
- A.3: OvermindRegistry zkApp on Mina (o1js)
- A.4: Chain Bridge DVM: Mina adapter (GraphQL sub + Postgres LISTEN/NOTIFY)
- A.5: VRF-based executor selection (Mode A + B)
- A.6: Wake/sleep cycle (kind:5099 -> Mina -> kind:5101)
- A.7: OODA decision engine (orient/decide/act/record)
- A.8: Self-scheduling wake cycles
- A.9: E2E test: 10 autonomous cycles via Mina VRF

### Epic B: "Treasury" — Self-Funding Agent
- B.1: Register as DVM provider (kind:31990)
- B.2: Accept/execute DVM jobs for payment
- B.3: Treasury accounting
- B.4: Adaptive behavior (pricing/acceptance based on balance)
- B.5: E2E test: 100 self-funded cycles

### Epic C: "Sovereign" — Unseeable Keys + Migration
- C.1: TEE-internal key generation ceremony
- C.2: Signing policy engine
- C.3: Key hierarchy (master -> subkeys)
- C.4: Shamir seed splitting across TEE enclaves
- C.5: Sealed key migration (enclave-to-enclave)
- C.6: Disaster recovery (K-of-N reconstruction)
- C.7: E2E test: key migration between providers

### Epic D: "Biography" — Recursive Lifecycle Proofs
- D.1: Per-cycle Mina proof generation
- D.2: Recursive proof composition
- D.3: Verifiable execution count (replaces reputation)
- D.4: Public biography verification endpoint
- D.5: E2E test: verify 100-cycle recursive proof

### Epic E: "Swarm" — Agent Spawning + Coordination
- E.1: Sub-agent spawning (new keypair, funded, registered)
- E.2: Parent-child communication (NIP-44)
- E.3: Task delegation (parent -> child DVM)
- E.4: Swarm treasury management
- E.5: E2E test: overmind spawns 3 sub-agents

**Execution order:** A -> B -> C -> D -> E

---

## Emergent Properties

1. **Immortality** — State permanent on Arweave, execution migrates, identity is a keypair
2. **Sovereignty** — Key born in TEE, self-funding, self-scheduling
3. **Verifiability** — Every cycle event-sourced, ZK-proven, TEE-attested
4. **Anti-fragility** — Each failure has a recovery path independent of any single entity
5. **Composability** — Overmind IS a DVM provider, can spawn sub-agents recursively

---

## Strategic Positioning

"The first protocol for digital entities that no one owns, no one controls, and no one can kill."

The Overmind Protocol positions TOON as the substrate for autonomous digital life — not just a relay network, but the infrastructure layer where sovereign agents emerge, self-fund, and evolve.
