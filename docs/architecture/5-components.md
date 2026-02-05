# 5. Components

## 5.1 @agent-society/core

**Responsibility:** Main protocol library providing peer discovery, SPSP exchange, and trust calculation.

**Key Interfaces:**
- `NostrPeerDiscovery` - Discover ILP peers from follow lists
- `NostrSpspClient` - Query and request SPSP parameters
- `NostrSpspServer` - Publish SPSP info and handle requests
- `SocialTrustManager` - Compute trust scores
- Event utilities (parsers, builders, constants)

**Dependencies:** nostr-tools

**Technology Stack:** TypeScript, nostr-tools

## 5.2 @agent-society/relay

**Responsibility:** Reference implementation of ILP-gated Nostr relay with pay-to-write.

**Key Interfaces:**
- WebSocket server (NIP-01 reads)
- BLS HTTP endpoint (ILP payment verification)
- PricingService (configurable pricing)
- Event storage API

**Dependencies:** @agent-society/core, better-sqlite3, ws, Hono

**Technology Stack:** TypeScript, SQLite, WebSocket

## 5.3 @agent-society/examples

**Responsibility:** Integration examples demonstrating library usage.

**Key Interfaces:**
- Demo scripts
- Integration patterns documentation

**Dependencies:** @agent-society/core, @agent-society/relay

## 5.4 Component Diagram

```mermaid
graph LR
    subgraph "@agent-society/core"
        direction TB
        NPD[NostrPeerDiscovery]
        NSC[NostrSpspClient]
        NSS[NostrSpspServer]
        STM[SocialTrustManager]

        subgraph "Event Infrastructure"
            CONST[Event Constants]
            TYPES[Type Definitions]
            PARSE[Parsers]
            BUILD[Builders]
        end

        NPD --> PARSE
        NSC --> PARSE
        NSC --> BUILD
        NSS --> BUILD
        STM --> NPD
    end

    subgraph "@agent-society/relay"
        direction TB
        WSS[WebSocket Server]
        BLS[Business Logic Server]
        PRICE[PricingService]
        STORE[EventStore]
        TOON[TOON Encoder]

        BLS --> PRICE
        BLS --> TOON
        WSS --> STORE
        BLS --> STORE
    end

    CORE_PKG[@agent-society/core] --> RELAY_PKG[@agent-society/relay]
```

---
