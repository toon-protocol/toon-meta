# Crosstown Service Protocol

**ILP as a Service Mesh for Nostr-Native Applications**

## Overview

The Crosstown Service Protocol defines a pattern where every service in the network is an **ILP-gated node**: an ILP connector paired with a domain-specific event processor. The connector handles routing, forwarding, payment, and settlement. The service processes Nostr events according to its domain logic. There is no handler framework, no webhook registry, and no shared secrets between services. **ILP is the framework.**

Extending the Crosstown network is equivalent to deploying a new ILP node with a service that accepts Nostr events via a local HTTP endpoint.

## Three Rules

1. **The connector routes and pays.** It handles ILP packets, balances, forwarding, and settlement. On packet receipt, it notifies its co-located service. That's it.
2. **Services process events.** They receive Nostr events, do their domain-specific thing. No routing knowledge. No payment knowledge. Stateless processors.
3. **Nostr pubkeys are identity.** Everywhere. No emails, no usernames, no passwords, no API keys between services. Event signatures are authentication.

## Architecture

```
┌──────────────────────────────────────────────────┐
│              ILP Connector                        │
│                                                   │
│  - Receives ILP packets                           │
│  - POSTs event to LOCAL service (fire-and-forget  │
│    on intermediate hops; await on final hop)       │
│  - Forwards packet to next hop (if exists)        │
│  - Handles balances, settlement, routing           │
│  - ZERO knowledge of what the service does        │
└──────────────────────────────────────────────────┘
            │ (localhost POST /handle-packet)
            ▼
┌──────────────────────────────────────────────────┐
│          Crosstown Service (any type)              │
│                                                   │
│  - Relay: stores Nostr events (current impl)      │
│  - Forgejo Gateway: executes NIP-34 git ops       │
│  - Future: CI runner, package registry, etc.      │
│                                                   │
│  - ZERO routing knowledge                         │
│  - ZERO ILP knowledge                             │
│  - ZERO payment knowledge                         │
└──────────────────────────────────────────────────┘
```

Every node in the network is: **Connector + Service**. The connector is always the same. The service defines what the node _does_.

## Multi-Hop Event Processing

ILP addresses encode the routing path. Each segment represents a hop through the network. The connector's routing table resolves each hop.

```
Client sends ILP packet:
  destination: g.crosstown.relay1.relay2.forgejo
  data: TOON-encoded NIP-34 patch event
  amount: price + routing fees

Hop 1 (relay1):
  Connector receives packet
  → POST /handle-packet to local relay (fire-and-forget)
  → Relay stores the Nostr event asynchronously
  → Connector forwards packet to next hop (relay2)

Hop 2 (relay2):
  Connector receives packet
  → POST /handle-packet to local relay (fire-and-forget)
  → Relay stores the Nostr event asynchronously
  → Connector forwards packet to next hop (forgejo)

Hop 3 (forgejo - final):
  Connector receives packet
  → POST /handle-packet to local Forgejo gateway (await response)
  → Gateway processes NIP-34 event, executes git operation
  → Response flows back through ILP fulfill/reject
```

### Intermediate Hops: Fire-and-Forget

On intermediate hops, the connector POSTs the event to its local service **without blocking**. The service processes the event asynchronously. If the service is down or fails, the connector continues forwarding. Intermediate services (typically relays) are replication points, not gatekeepers.

### Final Hop: Await Response

On the final hop (no more hops remaining), the connector **awaits** the service response. The client needs to know: did the operation succeed? The terminal acknowledgment flows back through ILP's existing fulfill/reject mechanism.

### Connector Logic

```typescript
// In connector packet handler
const hasNextHop = remainingHops.length > 0;

if (hasNextHop) {
  // Fire and forget - don't block forwarding
  fetch(LOCAL_SERVICE_ENDPOINT + '/handle-packet', {
    method: 'POST',
    body: JSON.stringify(packetData),
  }).catch((err) => log.warn('Local service unreachable', err));

  // Continue forwarding immediately
  return forwardToNextHop(packet);
} else {
  // Final hop - await service response
  const result = await fetch(LOCAL_SERVICE_ENDPOINT + '/handle-packet', {
    method: 'POST',
    body: JSON.stringify(packetData),
  });
  return result.json();
}
```

## Service Contract

Every Crosstown service implements a single HTTP endpoint:

### `POST /handle-packet`

**Request body** (same as existing `HandlePacketRequest`):

```typescript
{
  amount: string       // Payment amount (parsed to bigint)
  destination: string  // ILP destination address
  data: string         // Base64-encoded TOON Nostr event
  sourceAccount?: string  // Source ILP address
}
```

**Accept response:**

```typescript
{
  accept: true
  fulfillment: string  // Base64-encoded SHA-256 fulfillment
  metadata?: {
    eventId: string
    storedAt: number
  }
}
```

**Reject response:**

```typescript
{
  accept: false;
  code: string; // ILP error code (F00, F06, T00)
  message: string; // Human-readable error
}
```

This is the **only interface** between connector and service. The service never needs to know about ILP routing, packet forwarding, balances, or settlement. It receives a Nostr event, does its thing, and responds.

## Node Types

| Node Type        | Connector    | Service           | Event Processing                                 |
| ---------------- | ------------ | ----------------- | ------------------------------------------------ |
| Relay            | Standard ILP | Nostr Relay + BLS | Store events, verify payment, return fulfillment |
| Forgejo Gateway  | Standard ILP | NIP-34 Processor  | Map Nostr events to git operations               |
| CI Runner        | Standard ILP | Build Service     | Execute builds triggered by events               |
| Package Registry | Standard ILP | Artifact Store    | Store/serve packages referenced in events        |

All node types use the **same connector image**. Only the `LOCAL_SERVICE_ENDPOINT` environment variable changes.

## Identity Model

Nostr public keys are the **universal identity** across all services:

- **Relay**: Event pubkey = author identity
- **Forgejo Gateway**: Event pubkey = repository owner/contributor identity
- **CI Runner**: Event pubkey = build requester identity
- **Access control**: Verify event signatures, check pubkey permissions

No service maintains its own user database. Authentication is: "Is this a valid Nostr event signed by a pubkey with the right permissions?"

### Forgejo Identity Integration

Forgejo's authentication system must be adapted to use Nostr pubkeys:

- **Current**: Email/password or OAuth2 tokens
- **Required**: Nostr pubkey maps to Forgejo user identity
- **Approach**: Custom OAuth2 provider that validates Nostr event signatures
- **Permissions**: Repository ownership and access tied to pubkeys, not usernames

## NIP-34: Git Operations over Nostr

The first non-relay service type. NIP-34 defines Nostr event kinds for git operations:

| NIP-34 Kind | Purpose                 | Forgejo API Mapping                               |
| ----------- | ----------------------- | ------------------------------------------------- |
| `30617`     | Repository announcement | `POST /orgs/{org}/repos` or `POST /user/repos`    |
| `1617`      | Patch submission        | `POST /repos/{owner}/{repo}/pulls`                |
| `1618`      | Patch reply/review      | `POST /repos/{owner}/{repo}/pulls/{id}/reviews`   |
| `1621`      | Issue creation          | `POST /repos/{owner}/{repo}/issues`               |
| `1622`      | Issue reply             | `POST /repos/{owner}/{repo}/issues/{id}/comments` |
| `1630-1633` | Status events           | `POST /repos/{owner}/{repo}/statuses/{sha}`       |

### Forgejo Gateway Event Processing

```
POST /handle-packet received
  │
  ▼
Decode base64 → TOON → Nostr event
  │
  ▼
Verify event signature (schnorr)
  │
  ▼
Check event.kind against NIP-34 kinds
  │
  ├─ kind:30617 → Create/update repository
  ├─ kind:1617  → Create pull request from patch
  ├─ kind:1621  → Create issue
  ├─ kind:1622  → Add issue comment
  └─ other      → Reject (unsupported kind)
  │
  ▼
Map event.pubkey → Forgejo user
  │
  ▼
Execute Forgejo API call
  │
  ▼
Return accept/reject to connector
```

## Deployment

### Single Host (Docker Compose)

```yaml
# Relay Node
services:
  connector:
    image: crosstown/connector
    environment:
      LOCAL_SERVICE_ENDPOINT: http://relay-bls:3100
      ILP_ADDRESS: g.crosstown.relay1
  relay-bls:
    image: crosstown/relay
    # Existing relay + BLS configuration
```

```yaml
# Forgejo Node
services:
  connector:
    image: crosstown/connector
    environment:
      LOCAL_SERVICE_ENDPOINT: http://forgejo-gateway:8090
      ILP_ADDRESS: g.crosstown.forgejo1
  forgejo-gateway:
    image: crosstown/forgejo-gateway
    environment:
      FORGEJO_URL: http://forgejo:3000
  forgejo:
    image: codeberg/forgejo:latest
```

### Kubernetes

```yaml
# Each node type is a Deployment with two containers
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crosstown-relay
spec:
  template:
    spec:
      containers:
        - name: connector
          image: crosstown/connector
          env:
            - name: LOCAL_SERVICE_ENDPOINT
              value: http://localhost:3100 # Same pod
        - name: relay
          image: crosstown/relay
```

Same connector image. Different `LOCAL_SERVICE_ENDPOINT`. Same pattern for Forgejo or any future service type.

## Security Model

### Payment is Authentication

ILP payment validates that the sender is willing to pay for the operation. No shared secrets needed between services. The connector handles payment verification.

### Localhost-Only Communication

The connector and its co-located service communicate over localhost or pod-internal networking. No external network exposure for the service endpoint. The service never needs to be reachable from outside its own node.

### Event Signature Verification

Every Nostr event carries a cryptographic signature (Schnorr). Services verify event signatures before processing. Forged events are rejected regardless of payment.

### No Secrets Between Nodes

Nodes authenticate via ILP (payment) and Nostr (signatures). No API keys, no shared secrets, no IP whitelisting between nodes. The connector's peering and routing table define the trust boundaries.

## Relationship to Existing Code

### What Changes

- **Connector**: Add `LOCAL_SERVICE_ENDPOINT` config and fire-and-forget/await logic based on hop position
- **No relay changes**: The relay already accepts events via `POST /handle-packet`

### What Gets Created

- **`packages/forgejo-gateway/`**: NIP-34 event processor with `POST /handle-packet` endpoint
- **Forgejo auth plugin**: Nostr pubkey to Forgejo user mapping

### What Gets Removed

- **`packages/git-proxy/`**: Old experiment, superseded by the Forgejo Gateway pattern

### What Stays the Same

- `packages/relay/` - Unchanged, already implements the service contract
- `packages/bls/` - Unchanged, already handles payment validation
- `packages/core/` - `HandlePacketRequest`/`HandlePacketResponse` types already define the contract
- `docker/src/entrypoint.ts` - Existing `/handle-packet` endpoint is the reference implementation

## References

- [ILP-GATED-RELAY.md](../ILP-GATED-RELAY.md) - Original relay-specific protocol spec
- [NIP-34: Git Stuff](https://github.com/nostr-protocol/nips/blob/master/34.md) - Git operations over Nostr
- [RFC 0027: ILPv4](https://interledger.org/developers/rfcs/interledger-protocol/) - Packet format and routing
- [NIP-01: Basic Protocol](https://github.com/nostr-protocol/nips/blob/master/01.md) - Nostr events
- [NIP-02: Follow List](https://github.com/nostr-protocol/nips/blob/master/02.md) - Social graph / peering
