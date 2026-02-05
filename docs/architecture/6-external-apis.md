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

**Integration Notes:** Library uses nostr-tools SimplePool for relay management. All tests mock SimplePool to avoid live relay dependency.

## 6.2 agent-runtime Admin API

- **Purpose:** Dynamic ILP connector configuration (peer/route management)
- **Documentation:** https://github.com/anthropics/agent-runtime
- **Base URL(s):** Consumer-configured (typically http://localhost:7770)
- **Authentication:** Local only (no auth for localhost)
- **Rate Limits:** None

**Key Endpoints Used:**
- `POST /peers` - Add ILP peer
- `DELETE /peers/:id` - Remove peer
- `PUT /peers/:id/credit` - Update credit limit
- `GET /peers` - List configured peers

**Integration Notes:** Optional integration; library can be used standalone without agent-runtime.

---
