# 2. High Level Architecture

## 2.1 Technical Summary

Crosstown Protocol is a **TypeScript monorepo** with a **modular package architecture**. The system consists of four packages plus a Docker entrypoint that enable autonomous agents to discover ILP payment peers via Nostr social graphs, exchange SPSP parameters with settlement negotiation over Nostr events, and run as autonomous LLM-powered agents that process Nostr events in real-time.

The architecture separates concerns across three layers:
1. **Discovery & Configuration** — Nostr handles peer discovery, SPSP exchange, and social graph traversal
2. **Payment Routing** — ILP connectors handle actual packet routing, settlement, and payment channels
3. **Autonomous Decision-Making** — LLM-powered handlers process Nostr events and execute structured actions (planned, Epic 11)

The library acts as a bridge — populating ILP connector routing tables from Nostr social graph data. In embedded mode (`createCrosstownNode()`), the connector runs in-process with zero-latency function calls.

## 2.2 High Level Overview

1. **Architectural Style:** Library/SDK with modular package structure + autonomous agent runtime
2. **Repository Structure:** Monorepo with `@crosstown/core`, `@crosstown/bls`, `@crosstown/relay`, `@crosstown/examples`, plus `docker/` entrypoint
3. **Service Architecture:** Library consumed by agents, with optional embedded connector mode and standalone Docker deployment
4. **Integration Patterns:**
   - **Embedded Mode:** `createCrosstownNode()` wires ConnectorNode + BLS + Bootstrap + RelayMonitor in-process (zero-latency)
   - **HTTP Mode:** Library in agent process communicates with connector via Admin API (separate processes)
   - **Docker Mode:** Standalone container running BLS + relay + bootstrap as a service

## 2.3 High Level Project Diagram

```mermaid
graph TB
    subgraph "Agent Process"
        A[Agent Application]
        subgraph "@crosstown/core"
            BS[BootstrapService]
            RM[RelayMonitor]
            SPD[SocialPeerDiscovery]
            NSC[NostrSpspClient]
            NSS[NostrSpspServer]
            COMP[compose: createCrosstownNode]
            EVT[Event Utilities]
        end
    end

    subgraph "@crosstown/bls"
        BLS[BusinessLogicServer]
        PS[PricingService]
        TOON[TOON Codec]
        ES[EventStore]
    end

    subgraph "@crosstown/relay"
        WS[NostrRelayServer]
        CH[ConnectionHandler]
    end

    subgraph "External Infrastructure"
        NR[Nostr Relays]
        ILC[ILP Connector]
        AR[ArDrive Registry]
    end

    subgraph "docker/"
        EP[Entrypoint]
    end

    A --> COMP
    COMP --> BS
    COMP --> RM
    BS --> SPD
    BS --> NSC
    SPD --> NR
    NSC --> NR
    NSS --> NR
    SPD --> AR

    BS -.->|Direct or HTTP| ILC
    BLS --> PS
    BLS --> TOON
    BLS --> ES
    WS --> CH

    EP --> BLS
    EP --> WS
    EP --> BS
```

## 2.4 Architectural and Design Patterns

| Pattern | Application | Rationale |
|---------|-------------|-----------|
| **Modular Monorepo** | Package organization (core, bls, relay, examples) | Simplifies dependency management; enables atomic changes across packages |
| **Event-Driven Architecture** | Nostr pub/sub for discovery, SPSP, and real-time monitoring | Natural fit for Nostr; enables real-time updates via RelayMonitor |
| **Composition Pattern** | `createCrosstownNode()` wires all components with start/stop lifecycle | Single entry point for embedded mode; avoids manual component wiring |
| **Interface Abstraction** | `AgentRuntimeClient` / `ConnectorAdminClient` with HTTP and direct implementations | Swap between embedded and HTTP mode without changing consumer code |
| **Layered Peer Discovery** | Genesis peers → ArDrive registry → NIP-02 social graph | Progressive fallback ensures bootstrap works even with minimal network |
| **Strategy Pattern** | Configurable trust calculation weights | Agents can tune trust weights without code changes |
| **Builder Pattern** | Event builder utilities for all Nostr event kinds | Ensures correct event structure, tagging, and signing |
| **Deterministic Event Routing** | Kind number → handler dispatch (not LLM classification) | Predictable, testable routing; LLM decides actions within handlers |
| **Business Logic Server (BLS)** | Payment verification and TOON-encoded event processing | Standard ILP integration pattern; extracted as reusable package |
| **State Machine** | Bootstrap phases: discovering → registering → handshaking → announcing → ready | Clear lifecycle with event-driven phase transitions |

---
