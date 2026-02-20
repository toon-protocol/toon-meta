# Deep Research Prompt: Crosstown × Gas Town Integration

## Research Objective

Investigate the technical feasibility, architectural patterns, and implementation strategies for integrating **Gas Town** (Steve Yegge's multi-agent orchestration framework) and its **Beads** persistence layer with the **Crosstown Protocol** (Nostr + ILP bridge for decentralized peer discovery, payment routing, and social-graph trust). The research should determine whether Crosstown's decentralized networking, identity, and payment infrastructure can transform Gas Town from a single-machine orchestrator into a distributed, internet-scale multi-agent network — and what architectural compromises, new capabilities, and scaling characteristics would result.

## Background Context

### Crosstown Protocol

A TypeScript monorepo (`@crosstown/core`, `@crosstown/bls`, `@crosstown/relay`, `@crosstown/agent`) that bridges Nostr (decentralized social/messaging) with ILP (Interledger Protocol). Key capabilities:

- **NIP-02 Peer Discovery**: Nostr follow lists become ILP peering relationships; three-tier discovery (genesis peers, ArDrive registry, social graph)
- **SPSP over Nostr**: Encrypted kind:23194/23195 handshakes exchange payment setup parameters without HTTPS/DNS
- **Social Trust Engine**: Computes trust scores (0.0-1.0) from social distance, mutual followers, reputation (zaps), payment history; trust maps to ILP credit limits
- **ILP-Gated Relay**: Nostr events TOON-encoded into ILP PREPARE packets; BLS verifies payment and stores events
- **Agent Runtime (Epic 11, in progress)**: LLM-powered event processing with deterministic kind-based routing, structured output, per-kind action allowlists
- **Planned Epics 12-17**: Profiles, DVMs (paid computation), zaps, labels/badges, private messaging, payment-gated agent swarms (NIP-29 with hierarchical ILP addresses)
- **Custom Event Kinds**: 10032 (ILP Peer Info), 23194/23195 (SPSP Request/Response)

### Gas Town

A Go-based (~189K LOC) multi-agent workspace manager coordinating 20-30 concurrent AI coding agents (primarily Claude Code) on a single machine. Key characteristics:

- **7 Worker Roles**: Mayor (orchestrator), Polecats (ephemeral workers), Refinery (merge queue), Witness (lifecycle monitor), Deacon (watchdog daemon), Dogs/Boot (maintenance), Crew (persistent named agents)
- **Git Worktree Isolation**: Each agent operates in its own worktree
- **Communication**: Hook-based work assignment (`gt sling`), mail system (`gt mail`), real-time nudges (`gt nudge`), seance for historical context
- **MEOW Stack**: Formulas → Protomolecules → Molecules/Wisps for durable workflow orchestration
- **GUPP Principle**: "If there is work on your hook, YOU MUST RUN IT" — agents self-activate from persistent state
- **Single-machine only**: No distributed/networked capabilities yet, though internal packages (`connection`, `protocol`, `mq`) hint at future networking
- **Scaling challenge**: Token burn ($100+/hr at peak), merge conflicts, human review bottleneck

### Beads

A Go-based (~225K LOC) distributed, git-backed graph issue tracker designed for AI agents:

- **Dolt-powered**: Version-controlled SQL database with cell-level merge, JSONL export for git portability
- **Hash-based IDs**: `bd-a1b2` format prevents merge collisions across branches/agents
- **19 Dependency Types**: Blocking, non-blocking, and foundation types for complex workflow graphs
- **Agent Memory**: Semantic compaction (`bd compact`), ephemeral wisps, pinned issues, key-value store, state dimensions
- **Distribution**: Git-native (JSONL in repo) or Dolt federation (peer-to-peer sync via MySQL/remotesapi ports)
- **MCP Integration**: Python-based MCP server (`beads-mcp`) with tool interface for editors/agents
- **Limitations**: Last-writer-wins concurrency, no CRDT, single-machine coordination unless using Dolt server mode

## Research Questions

### Primary Questions (Must Answer)

1. **Distributed Swarm via Nostr Identity**: Can Crosstown's Nostr keypair identity system replace or extend Gas Town's local-only agent identities (`<rig>/crew/<name>`) to create a globally-addressable agent network? What would the identity mapping look like (e.g., Nostr npub ↔ Gas Town Role Bead), and how would the NIP-02 follow graph subsume or complement Gas Town's hierarchical rig/crew/polecat addressing?

2. **ILP Packet Routing as Inter-Agent Transport**: Could ILP packet routing (with TOON-encoded payloads) replace or integrate with Gas Town's mail system (`gt mail`), nudge system (`gt nudge`), and hook-based work dispatch (`gt sling`)? What would the message flow look like for a Mayor on Machine A dispatching a bead to a Polecat on Machine B via ILP PREPARE packets? What are the latency, reliability, and cost tradeoffs vs. the current local tmux/filesystem approach?

3. **Scaling Past 20-30 Agents with Decentralized Coordination**: How would a distributed Gas Town (backed by Crosstown networking) scale beyond 20-30 agents? Specifically: (a) How does removing the single-machine bottleneck change the merge conflict problem? (b) How does the Refinery role work when agents are on different machines with different git repos? (c) Could the social trust engine provide distributed consensus on merge priority? (d) What new failure modes emerge (network partitions, relay unavailability, payment channel exhaustion)?

4. **Beads Ledger over Nostr/ILP**: How would Beads' git-backed persistence interact with Crosstown's event-driven architecture? Could Beads issues be published as Nostr events (e.g., a new kind for work items), enabling cross-machine Beads synchronization via Nostr relays instead of or in addition to git push/pull? Could ILP payments gate access to shared Beads databases (mirroring the ILP-gated relay pattern)?

5. **Economic Model for Distributed Agent Work**: Gas Town currently has no economic model — agents are local processes with unlimited free communication. When work dispatch crosses machine/network boundaries via ILP, every message costs money. How should the pricing model work? Should intra-swarm messages be free (payment channels with high credit limits based on trust)? Should the Mayor pay Polecats for completed work? Could Crosstown's trust-weighted credit limits naturally solve the "who pays for agent computation" problem?

### Secondary Questions (Nice to Have)

6. **Beads Molecule Workflows + NIP-90 DVMs**: Could Gas Town's MEOW Stack (Formulas → Molecules) map to Crosstown's planned NIP-90 DVM (Data Vending Machine) job requests? A Formula could define a multi-step workflow where each step is a DVM job request, with ILP payments gating each step's execution. How would this compare to the current cook/pour/wisp/squash lifecycle?

7. **Witness/Deacon Roles as Nostr Monitoring Agents**: Could Gas Town's oversight roles (Witness monitoring Polecats, Deacon monitoring the system) be implemented as Crosstown NIP handler agents that subscribe to specific Nostr event kinds rather than polling tmux sessions? What event kinds would they need, and how would the `gt seance` historical context feature map to Nostr event queries?

8. **Cross-Town Federation**: Gas Town's internal `FederatedMessage` type and `connection`/`protocol` packages suggest planned federation. Could Crosstown provide the federation transport layer? What would a "Town-to-Town" peering relationship look like in Nostr/ILP terms (e.g., each Town's Mayor has a Nostr identity, Towns peer via NIP-02 follows, inter-Town work dispatch uses ILP-gated messages)?

9. **Agent Memory Convergence**: Beads uses semantic compaction (`bd compact`) to summarize completed work. Crosstown's agent runtime uses per-kind handler prompts with structured output. Could a unified memory architecture emerge where Beads provides the persistent state layer and Crosstown's NIP handlers provide the real-time event processing layer? How would the `bd prime` session bootstrap (injecting open issues into context) integrate with the agent runtime's event subscription model?

10. **Trust-Weighted Merge Priority**: Gas Town's Refinery processes merge requests sequentially. In a distributed setting, could Crosstown's social trust scores determine merge priority? Higher-trust agents (closer social distance, more mutual followers, better payment history) get their merges processed first. How would this interact with Beads' dependency graph and ready-work calculation?

## Research Methodology

### Information Sources

- **Primary codebases**: `github.com/steveyegge/gastown` (Go), `github.com/steveyegge/beads` (Go), `github.com/jonathangreen/crosstown` (TypeScript)
- **Architecture documents**: Gas Town glossary, Beads ARCHITECTURE.md/INTERNALS.md, Crosstown docs/architecture/
- **Community discussion**: Hacker News threads on Gas Town, Nostr NIP proposals, ILP RFC documents
- **Comparable systems**: Temporal (durable workflows), Kubernetes (container orchestration), libp2p (decentralized networking), ActivityPub (federated social), Lightning Network (payment channels)
- **Academic references**: Multi-agent systems literature (MAS), distributed consensus (Raft/PBFT), trust networks, reputation systems

### Analysis Frameworks

- **Integration Feasibility Matrix**: For each proposed integration point, assess: (1) technical compatibility, (2) implementation complexity, (3) performance impact, (4) breaking changes to either system, (5) value delivered
- **Protocol Mapping Analysis**: Map Gas Town's internal communication patterns (hooks, mail, nudge, sling) to equivalent Nostr event kinds and ILP packet types, identifying gaps and impedance mismatches
- **Scaling Analysis**: Model agent count vs. network overhead (messages/second, ILP packets/second, payment channel capacity, relay storage) for 30, 100, 500, and 1000+ agent scenarios
- **Failure Mode Analysis**: Enumerate new failure modes introduced by distributing Gas Town across machines (network partitions, relay downtime, payment channel exhaustion, Nostr event ordering, eventual consistency of Beads across nodes)

### Data Requirements

- Concrete latency measurements: Gas Town local operations (hook dispatch, mail send, nudge) vs. projected Nostr/ILP equivalents
- Payment channel economics: minimum viable credit limits for intra-swarm messaging, expected message volume per agent per hour
- Git merge conflict rates at various agent counts (empirical data from Gas Town users if available)
- Nostr relay capacity: events/second, storage per event, subscription limits

## Expected Deliverables

### Executive Summary

- Key findings on integration viability (go/no-go for each major integration point)
- Critical architectural decisions required before implementation
- Recommended phased approach (which integrations to build first)
- Risk assessment with mitigation strategies

### Detailed Analysis

#### Section 1: Identity and Discovery Integration

- Nostr keypair ↔ Gas Town identity mapping specification
- NIP-02 follow graph as distributed rig/crew registry
- Bootstrap flow: how a new Gas Town instance joins the network
- Identity lifecycle: creation, rotation, revocation across both systems

#### Section 2: Communication Layer Replacement/Integration

- Protocol mapping table: Gas Town command → Nostr event kind + ILP packet type
- Latency analysis: local vs. networked communication for each pattern
- Reliability guarantees: at-least-once vs. exactly-once delivery semantics
- Hybrid architecture: keep local communication for co-located agents, use Nostr/ILP for remote

#### Section 3: Distributed Merge and Coordination

- Distributed Refinery architecture options
- Trust-weighted merge priority algorithm specification
- Conflict resolution across network boundaries
- Beads dependency graph synchronization strategy

#### Section 4: Economic Model Design

- Pricing tiers: free (local), trusted (high credit limit), paid (per-message)
- Payment channel topology for a distributed Gas Town network
- Agent compensation model: how completed work generates ILP payments
- Cost projections at various scale points

#### Section 5: Memory and State Architecture

- Beads ↔ Nostr event synchronization specification
- Distributed `bd prime` equivalent via Nostr event queries
- Cross-machine seance implementation via event history
- State consistency model (eventual consistency tradeoffs)

#### Section 6: Scaling Projections

- Agent count scaling curves (30 → 100 → 500 → 1000+)
- Network overhead analysis per scale tier
- Bottleneck identification and mitigation
- Comparison with existing distributed agent frameworks

### Supporting Materials

- Architecture diagrams showing integrated system topology
- Sequence diagrams for key cross-machine workflows (work dispatch, merge, handshake)
- Protocol specification drafts for new Nostr event kinds needed
- Risk register with probability, impact, and mitigation for each identified risk
- Implementation roadmap with dependencies and estimated complexity per phase

## Success Criteria

1. Each primary research question has a concrete, evidence-based answer (not speculative)
2. At least one integration point is identified as "high feasibility, high value" suitable for a proof-of-concept
3. The scaling analysis provides specific numbers (not just "it could scale better")
4. Failure modes are enumerated with concrete mitigation strategies
5. The economic model addresses the fundamental question: "who pays when agents on different machines collaborate?"
6. The research identifies which parts of Gas Town's architecture are fundamentally local (and would need redesign) vs. which can be networked with minimal changes

## Timeline and Priority

**Phase 1 (Immediate)**: Identity mapping and communication layer analysis — these are prerequisites for everything else

**Phase 2 (Short-term)**: Economic model and scaling projections — determines if the integration is worth pursuing at all

**Phase 3 (Medium-term)**: Distributed merge/coordination and memory architecture — the hardest problems that determine long-term viability

**Phase 4 (Long-term)**: Cross-Town federation and MEOW/DVM integration — advanced features that build on earlier phases

## Reference Links

- Gas Town: https://github.com/steveyegge/gastown
- Beads: https://github.com/steveyegge/beads
- Crosstown: https://github.com/jonathangreen/crosstown (this repo)
- Gas Town User Manual: https://gist.github.com/Xexr/3a1439038e4ce34b5e9de020f6cbdc4b
- Beads Architecture: https://github.com/steveyegge/beads/blob/main/docs/ARCHITECTURE.md
- Beads Internals: https://github.com/steveyegge/beads/blob/main/docs/INTERNALS.md
- NIP-02 (Follow List): https://github.com/nostr-protocol/nips/blob/master/02.md
- NIP-90 (Data Vending Machines): https://github.com/nostr-protocol/nips/blob/master/90.md
- NIP-29 (Relay-based Groups): https://github.com/nostr-protocol/nips/blob/master/29.md
- ILP RFC 0009 (SPSP): https://interledger.org/developers/rfcs/simple-payment-setup-protocol/
- ILP RFC 0032 (Peering): https://interledger.org/developers/rfcs/peering-clearing-settling/
