# API Contracts - @crosstown/bls

**Package:** `@crosstown/bls`
**Type:** Backend Service (Standalone)
**Description:** Standalone Business Logic Server for ILP payment verification

---

## HTTP API Endpoints

**Note:** This package provides the same API endpoints as `@crosstown/relay` BLS component, but as a standalone HTTP server.

### POST /handle-packet

ILP payment verification for Nostr event storage.

**See:** [api-contracts-relay.md](./api-contracts-relay.md#post-handle-packet) for complete endpoint documentation.

**Summary:**

- Accepts ILP packet with base64-encoded TOON Nostr event
- Validates payment amount against event size
- Stores event if payment sufficient
- Returns fulfillment on success or error code on rejection

---

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": 1234567890
}
```

---

## Configuration

### CreateBlsServerConfig

```typescript
{
  port?: number;                        // Default: 3100
  basePricePerByte: bigint;             // Required base price
  ownerPubkey?: string;                 // Optional owner pubkey (bypass payment)
  dbPath?: string;                      // SQLite path (default: in-memory)
  kindOverrides?: Map<number, bigint>;  // Per-kind pricing
  spspMinPrice?: bigint;                // SPSP request min price (kind:23194)
}
```

### Environment Variables

**Required:**

- `NODE_ID` - Unique node identifier
- `NOSTR_SECRET_KEY` - 64-char hex Nostr secret key
- `ILP_ADDRESS` - ILP address (format: `g.domain.subdomain`)

**Optional:**

- `BLS_PORT` - HTTP port (default: 3100)
- `BLS_BASE_PRICE_PER_BYTE` - Base price per byte (default: 10)
- `OWNER_PUBKEY` - Owner pubkey for self-write bypass
- `DATA_DIR` - SQLite directory (default: `/data`)
- `BLS_KIND_OVERRIDES` - JSON kind→price map
- `SPSP_MIN_PRICE` - Min price for SPSP requests
- `FORGEJO_URL`, `FORGEJO_TOKEN`, `FORGEJO_OWNER` - NIP-34 Git integration

---

## Usage Example

```typescript
import { createBlsServer } from '@crosstown/bls';

const { app, start, stop } = createBlsServer({
  basePricePerByte: 100n,
  ownerPubkey: 'abc123...',
  dbPath: './events.db',
  spspMinPrice: 0n, // Free SPSP requests
});

start(3100); // Start on port 3100
```

---

## Differences from @crosstown/relay

- **Standalone:** Runs as independent HTTP server (no WebSocket relay)
- **Focused:** Only payment verification, no event subscriptions
- **Deployable:** Can be deployed separately from relay
- **Same API:** Uses identical `BusinessLogicServer` implementation

---

**Generated:** 2026-02-26
**Last Updated:** 2026-02-26
