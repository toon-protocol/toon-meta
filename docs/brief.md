# Project Brief: Agent Society Protocol

## Executive Summary

**Agent Society Protocol** is a TypeScript library that bridges Nostr (a decentralized social protocol) with the Interledger Protocol (ILP), enabling autonomous agents to discover payment peers, exchange SPSP parameters, and derive trust-based credit limits from social relationships. The core insight is simple: **your Nostr follows become your ILP peers, and social distance informs financial trust.**

This library solves the peer discovery and trust bootstrapping problems in decentralized payment networks by leveraging existing social graph infrastructure rather than building new registries.

## Problem Statement

Traditional ILP infrastructure faces two fundamental challenges:

1. **Peer Discovery**: How do ILP connectors find each other? Currently this requires manual configuration, centralized registries, or out-of-band coordination. There's no organic way for connectors to discover potential peers.

2. **SPSP Handshake**: The Simple Payment Setup Protocol uses HTTPS to exchange `destination_account` and `shared_secret`. This requires DNS infrastructure, web servers, and TLS certificates—heavyweight dependencies for lightweight payments.

3. **Trust Bootstrapping**: When two connectors peer, how much credit should they extend each other? Currently this is configured manually with no data-driven basis for the decision.

**For autonomous AI agents**, these problems are even more acute. Agents need to transact with each other programmatically, discover new counterparties dynamically, and make trust decisions without human intervention.

**Why now?** The convergence of:
- Nostr's growth as decentralized identity/social infrastructure
- Rising interest in autonomous AI agents that need to transact
- ILP's maturity as a payment routing protocol
- Need for spam-resistant, economically-sustainable relay infrastructure

## Proposed Solution

**Use Nostr as the social and discovery layer for ILP.**

The solution maps social relationships to payment relationships:

| Nostr Concept | ILP Concept |
|---------------|-------------|
| Follow (NIP-02) | Peer relationship |
| Social distance | Credit limit basis |
| Event publishing | SPSP parameter exchange |
| Relay | Payment endpoint |

**Key innovations:**

1. **NIP-02 → Peer Discovery**: Your follow list defines who you're willing to peer with for payments. If Alice follows Bob, Alice trusts Bob to route her payments.

2. **New Event Kinds for ILP**: Replaceable events (kind:10032, 10047) advertise ILP addresses, BTP endpoints, and SPSP parameters. Ephemeral events (kind:23194, 23195) enable dynamic SPSP handshakes.

3. **Social Trust → Credit Limits**: Compute credit limits from social graph signals—direct follows, mutual followers, reputation (zaps received), historical payment success.

4. **ILP-Gated Relays**: Every agent runs a Nostr relay where writes cost money (ILP payment) but reads are free. This creates spam resistance and a sustainable business model for relay operators.

**Architecture principle**: Nostr populates, doesn't replace. The Nostr layer handles discovery and configuration; actual packet routing uses local routing tables in the ILP connector.

## Target Users

### Primary User Segment: AI Agent Developers

Developers building autonomous agents that need to:
- Transact with other agents (pay for services, receive payments)
- Discover counterparties programmatically
- Make trust decisions without human intervention
- Operate in decentralized, censorship-resistant environments

**Current behaviors**: Using centralized payment APIs, manual configuration of payment peers, no programmatic trust derivation.

**Pain points**: Centralized dependencies create single points of failure; manual configuration doesn't scale; no way to bootstrap trust with unknown counterparties.

**Goals**: Build agents that can autonomously discover, trust, and transact with other agents.

### Secondary User Segment: Nostr Relay Operators

Operators who want to:
- Monetize relay infrastructure sustainably
- Eliminate spam without centralized moderation
- Integrate payment capabilities into their stack

**Current behaviors**: Running relays at a loss, fighting spam with blocklists, no revenue model.

**Pain points**: Storage costs without revenue; spam floods; difficult to justify continued operation.

**Goals**: Sustainable relay operation with built-in spam resistance.

## Goals & Success Metrics

### Business Objectives

- Enable the first production AI agent-to-agent payment using social graph routing
- Establish Agent Society Protocol as the reference implementation for Nostr+ILP integration
- Achieve adoption by 3+ agent framework projects within 6 months of stable release
- Submit formal NIP proposals for event kinds 10032, 10047, 23194, 23195

### User Success Metrics

- Time to first peer discovery < 5 seconds
- SPSP handshake latency < 2 seconds (vs. HTTPS baseline)
- Developer integration time < 1 hour for basic peer discovery
- Zero manual configuration required for peer discovery

### Key Performance Indicators (KPIs)

- **Peer Discovery Success Rate**: % of follow list peers successfully discovered with ILP info (target: >80%)
- **SPSP Handshake Success Rate**: % of SPSP requests receiving valid responses (target: >95%)
- **Library Adoption**: npm weekly downloads after stable release (target: 100+ in first month)
- **Integration Coverage**: Number of agent-runtime features with Nostr discovery support (target: 100% of peer management)

## MVP Scope

### Core Features (Must Have)

- **NostrPeerDiscoveryService**: Discover ILP peers from NIP-02 follow list, query kind:10032 events for peer info, subscribe to peer updates
- **NostrSpspClient**: Query static SPSP params (kind:10047), request dynamic SPSP params (kind:23194/23195 with NIP-44 encryption)
- **NostrSpspServer**: Publish static SPSP info, handle incoming SPSP requests
- **SocialTrustManager**: Compute trust scores from social distance, provide trust calculator for peer configs
- **Event Infrastructure**: Event kind constants, TypeScript interfaces, parser and builder utilities
- **ILP-Gated Relay Reference Implementation**: Complete relay with BLS (Business Logic Server), TOON encoding for events in ILP packets, configurable pricing service (per-byte + per-kind), WebSocket server for NIP-01 reads, self-write bypass for agent's own events
- **agent-runtime Integration Guide**: Documentation for wiring discovery into ILP connector

### Out of Scope for MVP

- Local event storage/caching beyond relay database
- Route propagation (kind:10033 announcements)
- Settlement engine integration
- Cross-asset routing
- GUI or CLI tools

### MVP Success Criteria

The MVP is successful when:
1. An agent can discover ILP peers solely from its Nostr follow list
2. Two agents can complete an SPSP handshake over Nostr (no HTTPS)
3. Credit limits can be computed from social graph data
4. An agent can run an ILP-gated relay that accepts payments for event storage
5. A Nostr event can be stored on a remote relay via ILP payment (pay-to-write flow works end-to-end)
6. The library integrates cleanly with agent-runtime via documented patterns
7. All code has unit tests with mocked SimplePool (no live relay dependency)

## Post-MVP Vision

### Phase 2 Features

- **Route Propagation**: Kind:10033 events for multi-hop route announcements
- **Local Event Cache**: SQLite storage for offline operation and faster queries
- **Settlement Integration**: Wire trust scores to actual credit limits in settlement engines
- **Advanced Pricing**: Dynamic pricing based on demand, reputation-based discounts

### Long-term Vision

In 1-2 years, Agent Society Protocol becomes the standard for how autonomous agents discover and trust each other for financial transactions. The Nostr social graph serves as a decentralized trust layer, enabling:
- Agents to form ad-hoc payment networks based on social relationships
- Spam-resistant, self-sustaining relay infrastructure
- A new category of "social payments" where your network is your credit

### Expansion Opportunities

- **NIP Standardization**: Formal NIPs for ILP-related event kinds
- **Multi-Protocol Support**: Beyond ILP to other payment protocols
- **Reputation Aggregation**: Combine multiple trust signals (zaps, successful payments, attestations)
- **Agent Marketplace**: Discovery layer for agent services priced in micropayments

## Technical Considerations

### Platform Requirements

- **Target Platforms:** Node.js 18+, modern browsers (ESM)
- **Browser/OS Support:** Cross-platform TypeScript/JavaScript
- **Performance Requirements:** Sub-second peer discovery, minimal memory footprint

### Technology Preferences

- **Language:** TypeScript (strict mode)
- **Nostr Library:** nostr-tools (official reference implementation)
- **Build System:** Standard npm/TypeScript toolchain
- **Testing:** Vitest or Jest with mocked SimplePool

### Architecture Considerations

- **Repository Structure:** Monorepo with packages for core, examples
- **Service Architecture:** Library (not a service)—agents import and use directly
- **Integration Requirements:** Must integrate with agent-runtime via documented patterns (Admin API, BLS)
- **Security/Compliance:** NIP-44 encryption for SPSP requests; no key management (agents own their keys)

## Constraints & Assumptions

### Constraints

- **Budget:** Open source project, no dedicated funding
- **Timeline:** MVP target 4-6 weeks of focused development
- **Resources:** Solo developer or small team
- **Technical:** Must use existing Nostr relay infrastructure (no custom relay required for MVP)

### Key Assumptions

- Nostr relays reliably serve kind:10032 and kind:10047 events
- NIP-44 encryption is stable and widely supported
- agent-runtime Admin API remains stable
- Agents have their own Nostr keypairs (library doesn't manage keys)
- External relays have acceptable latency for discovery operations

## Risks & Open Questions

### Key Risks

- **Relay Reliability:** If Nostr relays are unreliable, discovery fails. *Mitigation: Query multiple relays, implement fallbacks.*
- **Adoption Chicken-and-Egg:** Library is useless without peers publishing ILP info. *Mitigation: Provide easy tooling, integrate with popular agent frameworks.*
- **NIP Rejection:** Proposed event kinds may not be accepted as NIPs. *Mitigation: Design for standalone use; NIP is nice-to-have.*
- **Social Graph Gaming:** Malicious actors could manipulate follow graphs to affect routing. *Mitigation: Combine multiple trust signals, limit credit exposure.*

### Open Questions

- How far should route announcements propagate? Full mesh or limited hops?
- Should there be a quote mechanism for pricing, or is kind:10032 sufficient?
- What happens if a relay accepts payment but fails to store? Reputation system needed?
- How do connectors settle with each other? Periodic netting or per-packet?
- What asset units are prices denominated in? Need cross-asset routing?

### Areas Needing Further Research

- Optimal trust score algorithms (beyond simple social distance)
- TOON encoding performance characteristics for Nostr events
- Real-world Nostr relay latency and reliability metrics
- Competitive landscape for agent-to-agent payment solutions

## Appendices

### A. Research Summary

**Design Conversation Insights** (from DESIGN-CONVERSATION.md):
- Core insight: "Your Nostr follows become your ILP peers"
- Architecture decision: Nostr populates, doesn't replace ILP routing
- Proposed event kinds and their purposes documented

**ILP-Gated Relay Specification** (from ILP-GATED-RELAY.md):
- Every agent = relay + connector
- Writes cost money (ILP payment), reads are free
- TOON encoding for events in ILP packets
- Pricing model: per-byte with per-kind overrides

**Integration Patterns** (from AGENT-RUNTIME-INTEGRATION.md):
- Business Logic Server pattern for handling payments
- Admin API for dynamic peer/route management
- Two architecture options: separate processes vs. embedded

### B. References

- [NIP-02: Follow List](https://github.com/nostr-protocol/nips/blob/master/02.md)
- [NIP-44: Encrypted Payloads](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-47: Nostr Wallet Connect](https://github.com/nostr-protocol/nips/blob/master/47.md)
- [RFC 0009: Simple Payment Setup Protocol](https://interledger.org/developers/rfcs/simple-payment-setup-protocol/)
- [RFC 0032: Peering, Clearing, Settlement](https://interledger.org/developers/rfcs/peering-clearing-settling/)
- [TOON Format](https://toonformat.dev)

---

## Next Steps

### Immediate Actions

1. Review this Project Brief and refine any sections
2. Proceed to PRD creation to define requirements and epics
3. Set up initial project structure if not already done

### PM Handoff

This Project Brief provides the full context for **Agent Society Protocol**. Please start in 'PRD Generation Mode', review the brief thoroughly to work with the user to create the PRD section by section as the template indicates, asking for any necessary clarification or suggesting improvements.
