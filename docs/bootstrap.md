# Bootstrap

When a new node starts, it goes through three phases to join the network.

## The Three Phases

```
New Node                               Existing Node
   │                                              │
   │  Phase 1: DISCOVER                          │
   │  ─────────────────────────────────────────> │
   │  Query relay for kind:10032 events          │
   │  Read settlement info from discovered peers │
   │                                              │
   │  Phase 2: REGISTER                          │
   │  Run chain negotiation locally              │
   │  Open payment channel on-chain              │
   │  Register peer with connector               │
   │                                              │
   │  Phase 3: ANNOUNCE                          │
   │  Pay to publish own kind:10032 event        │
   │  ─────────────────────────────────────────> │
   │                                              │  Store event
   │  Now visible to other nodes                 │
```

### Phase 1: Discover

Free read from any relay to find existing peers. The node subscribes to kind:10032 events, which contain each peer's ILP address, BTP endpoint, supported chains, and settlement addresses.

### Phase 2: Register

Using the peer's kind:10032 data, the joining node:

1. Negotiates a settlement chain locally (finds the intersection of supported chains)
2. Opens a payment channel unilaterally on-chain
3. Registers the peer with the local ILP connector

No handshake protocol is needed — all required information is publicly available in the kind:10032 event.

### Phase 3: Announce

The node pays to publish its own kind:10032 event to the network. BTP claims in the payment are self-describing (include chainId, tokenNetworkAddress, channelId). The receiving node verifies the channel on-chain, then stores the event.

After announcement, other nodes can discover and peer with the new node.

## Discovery Sources

Four complementary mechanisms ensure a node can always find peers:

| Source | When | Purpose |
|--------|------|---------|
| `knownPeers` config | Bootstrap | Hardcoded seed nodes for initial connection |
| Environment (`ADDITIONAL_PEERS`) | Runtime | JSON-formatted peer injection for Docker |
| ArDrive Registry | Bootstrap | Decentralized peer list on Arweave |
| DiscoveryTracker | Ongoing | Real-time subscription to kind:10032 events |

**Bootstrap flow:**

1. Merge peers from config + ArDrive + environment
2. Connect to at least one seed node
3. DiscoveryTracker continuously watches for new kind:10032 events

## Passive Discovery, Explicit Peering

Crosstown separates *seeing* peers from *connecting* to them:

- **Discovery is automatic** — The DiscoveryTracker maintains a live list of all available peers
- **Peering is explicit** — You call `node.peerWith(pubkey)` when you're ready to establish a payment channel

**Why this separation matters:**

- **Security** — You control who you peer with
- **Cost** — Opening channels costs gas; only pay for peers you trust
- **Awareness** — Always know who's available, even before connecting

```typescript
// Discovery happens automatically in the background
const discovered = node.getDiscoveredPeers();
console.log(`Found ${discovered.length} peers`);

// Peering only happens when you decide
for (const peer of discovered) {
  if (trustworthy(peer)) {
    await node.peerWith(peer.pubkey);
  }
}
```

## Bootstrap Events

Monitor bootstrap progress with lifecycle events:

```typescript
node.on('bootstrap', (event) => {
  console.log(`Phase: ${event.phase}`);
  // Phases: discovering → registering → announcing
});
```
