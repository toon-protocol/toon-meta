# 6. External APIs

## 6.1 Nostr Relays

- **Purpose:** Event storage and retrieval; pub/sub for real-time updates
- **Documentation:** https://github.com/nostr-protocol/nips
- **Base URL(s):** Consumer-configured (e.g., wss://relay.damus.io)
- **Authentication:** Signed events (NIP-01)
- **Rate Limits:** Relay-dependent

**Key Operations Used:**
- `REQ` - Subscribe to events matching filters
- `EVENT` - Publish signed events
- `CLOSE` - Close subscriptions

**Event Kinds Used:**

| Kind | Name | Usage |
|------|------|-------|
| 3 | Follow List (NIP-02) | Peer discovery via social graph |
| 10032 | ILP Peer Info | Connector address, BTP endpoint, settlement chains |
| 23194 | SPSP Request | Encrypted request for SPSP parameters + settlement negotiation |
| 23195 | SPSP Response | Encrypted response with SPSP params + negotiated settlement |

**Integration Notes:** Library uses nostr-tools SimplePool for relay management. All tests mock SimplePool to avoid live relay dependency. RelayMonitor provides real-time subscription to kind:10032 events for dynamic peer discovery.

## 6.2 agent-runtime Connector

- **Purpose:** ILP connector for packet routing, peer management, and payment channels
- **Documentation:** https://github.com/anthropics/agent-runtime

**Integration Modes:**

| Mode | Transport | Latency | Configuration |
|------|-----------|---------|---------------|
| **Embedded** | In-process function calls | Zero | `createCrosstownNode()` with ConnectorNode |
| **HTTP** | REST API | Network | `createHttpRuntimeClient(baseUrl)` |

**Key API Surfaces (both modes):**

| Operation | HTTP Endpoint | Direct Method |
|-----------|---------------|---------------|
| Send ILP packet | `POST /ilp/send` | `connector.sendPacket()` |
| Add peer | `POST /admin/peers` | `connector.registerPeer()` |
| Remove peer | `DELETE /admin/peers/:id` | `connector.removePeer()` |
| Handle incoming packet | `POST /handle-packet` | `bls.handlePacket()` (public) |
| Open payment channel | `POST /admin/channels` | `connector.openChannel()` |
| Get channel state | `GET /admin/channels/:id` | `connector.getChannelState()` |

**Integration Notes:** `@agent-runtime/connector` is an optional peer dependency. HTTP-only mode works without it. Both HTTP and direct clients implement the same `AgentRuntimeClient` / `ConnectorAdminClient` interfaces.

## 6.3 ArDrive Peer Registry

- **Purpose:** Decentralized peer registry for bootstrap when NIP-02 social graph is empty
- **Base URL(s):** ArDrive transaction queries
- **Authentication:** None (public read)

**Integration Notes:** ArDrivePeerRegistry provides fallback peer discovery. Genesis peers -> ArDrive -> NIP-02 forms the layered discovery stack.

---
