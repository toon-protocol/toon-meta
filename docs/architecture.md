# Architecture

Crosstown is a monorepo with packages organized into three layers. Each layer has a single responsibility.

## System Layers

```
┌─────────────────────────────────────────────────────┐
│  Discovery Layer                                    │
│  @crosstown/core                                    │
│  Find peers via Nostr events (kind:10032)           │
│  Bootstrap into the network                         │
├─────────────────────────────────────────────────────┤
│  Payment Layer                                      │
│  ILP Connector (@crosstown/connector)               │
│  Route micropayments between peers                  │
│  Manage payment channels                            │
├─────────────────────────────────────────────────────┤
│  Storage Layer                                      │
│  @crosstown/relay + @crosstown/bls                  │
│  Accept paid events, store them, serve for free     │
└─────────────────────────────────────────────────────┘
```

## Package Dependency Graph

```
@crosstown/town
├── @crosstown/sdk
│   └── @crosstown/core
├── @crosstown/relay
│   └── @crosstown/core
└── @crosstown/connector (peer dependency)

@crosstown/bls
└── @crosstown/core
```

- **`@crosstown/core`** — Foundation with no Crosstown dependencies. Provides bootstrap, discovery, settlement negotiation, TOON codec, and NIP-34 handling.
- **`@crosstown/sdk`** — Framework layer. Adds identity derivation, handler registry, verification pipeline, pricing validation, and node composition on top of core.
- **`@crosstown/relay`** — Nostr relay server with WebSocket (NIP-01), SQLite event store, and upstream relay propagation.
- **`@crosstown/town`** — Production relay. Composes SDK + relay + BLS + storage into a single `startTown()` call.
- **`@crosstown/bls`** — Standalone business logic server. HTTP endpoint that validates ILP packets and stores events.
- **`@crosstown/faucet`** — Development tool. Distributes test ETH and tokens for local development.

## Data Flow

### Writing (Paid)

```
Client              Connector               BLS                    EventStore
  │                      │                    │                         │
  │  ILP Prepare         │                    │                         │
  │  (TOON event)        │                    │                         │
  │ ──────────────────> │  Route packet      │                         │
  │                      │ ──────────────────>│                         │
  │                      │                    │  1. Decode TOON          │
  │                      │                    │  2. Verify signature     │
  │                      │                    │  3. Check payment        │
  │                      │                    │  4. Store event ────────>│
  │                      │                    │  5. Generate proof       │
  │  ILP Fulfill         │  Return fulfillment│                         │
  │ <────────────────── │ <──────────────────│                         │
```

Validation order matters — TOON format is checked **before** payment. Malformed events are rejected immediately, even if payment is correct. This prevents paying to store garbage data.

### Reading (Free)

```
Client              Relay
  │                   │
  │  REQ (filter)     │
  │ ───────────────> │
  │                   │  Query EventStore
  │  EVENT (TOON)     │
  │ <─────────────── │
  │  EOSE             │
  │ <─────────────── │
```

Reads use the standard Nostr WebSocket protocol (NIP-01). Events are served in TOON format.

## Deployment Modes

### Embedded (Library)

Import SDK packages directly. The connector runs in-process — zero network overhead.

```typescript
import { createNode, fromMnemonic } from '@crosstown/sdk';

const node = createNode({ secretKey, connector, ...config });
await node.start();
```

Best for: AI agents, custom services, applications that need ILP payment capabilities.

### Standalone (Docker)

Run as a microservice alongside an external ILP connector.

```bash
docker compose -f docker-compose-genesis.yml up -d
```

| Port | Service | Protocol |
|------|---------|----------|
| 3100 | BLS — ILP packet validation | HTTP |
| 7100 | Nostr relay — event reads | WebSocket |

Best for: Relay operators, infrastructure providers.

### One-Call API (Town)

Use `startTown()` or the CLI for a complete relay with minimal configuration.

```bash
npx @crosstown/town --mnemonic "..." --connector-url http://localhost:8080
```

Best for: Quick relay deployment, testing, development.
