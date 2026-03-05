# API Contracts - @crosstown/relay

**Package:** `@crosstown/relay`
**Type:** Backend Service
**Description:** ILP-gated Nostr relay with Business Logic Server for payment verification

---

## HTTP API Endpoints (Business Logic Server)

### POST /handle-packet

**Purpose:** ILP payment verification for Nostr event storage

**Request Body:**

```typescript
{
  amount: string;           // Payment amount (parsed to bigint)
  destination: string;      // ILP destination address
  data: string;             // Base64-encoded TOON Nostr event
  sourceAccount?: string;   // Optional source ILP address
}
```

**Success Response (200):**

```typescript
{
  accept: true;
  fulfillment?: string;     // SHA-256(eventId) base64 (deprecated)
  metadata?: {
    eventId: string;
    storedAt: number;       // Unix timestamp (ms)
  }
}
```

**Reject Response (400):**

```typescript
{
  accept: false;
  code: string;             // ILP error code: F00 (bad request), F06 (insufficient amount)
  message: string;          // Human-readable error
  metadata?: {
    required?: string;      // Required amount (if insufficient)
    received?: string;      // Received amount
  }
}
```

**Error Response (500):**

```typescript
{
  accept: false;
  code: 'T00'; // Internal error code
  message: string;
}
```

**ILP Error Codes:**

- `F00` - Bad Request (invalid data, malformed event, invalid signature)
- `F06` - Insufficient Amount (payment < required price)
- `T00` - Internal Error (storage failure, server error)

**Payment Bypass Rules:**

- Owner events (matching `ownerPubkey`) skip payment verification
- SPSP requests (kind: 23194) can use `spspMinPrice` override (including 0 for free)

**Pricing Logic:**

```
price = toonBytes.length * basePricePerByte
OR
price = pricingService.calculatePriceFromBytes(toonBytes, event.kind)

If event.kind === 23194 AND spspMinPrice < price:
  price = spspMinPrice
```

---

### GET /health

**Purpose:** Health check endpoint

**Response (200):**

```typescript
{
  status: 'healthy';
  timestamp: number; // Unix timestamp (ms)
}
```

---

## WebSocket API (Nostr Relay - NIP-01)

### Connection

**URL:** `ws://host:port/`
**Protocol:** NIP-01 compliant Nostr relay

**Connection Limits:**

- Max concurrent connections: Configurable (default: 100)
- Max subscriptions per connection: Configurable (default: 20)
- Max filters per subscription: Configurable (default: 10)

---

### Client → Server Messages

#### REQ - Subscribe to Events

```json
["REQ", <subscription_id>, <filter1>, <filter2>, ...]
```

**Filter Format:**

```typescript
{
  ids?: string[];           // Event ID prefixes
  authors?: string[];       // Pubkey prefixes
  kinds?: number[];         // Event kinds
  since?: number;           // Unix timestamp (inclusive)
  until?: number;           // Unix timestamp (inclusive)
  limit?: number;           // Max results
  "#<tag_name>"?: string[]; // Tag filters (e.g., "#e", "#p")
}
```

**Response Flow:**

1. Server sends matching events: `["EVENT", <subscription_id>, <toon_string>]`
2. Server sends end-of-stream: `["EOSE", <subscription_id>]`

**Note:** Events are returned in **TOON format strings**, not standard JSON Nostr events.

---

#### EVENT - Publish Event

```json
["EVENT", <event>]
```

**Event Format:** Standard Nostr event

```typescript
{
  id: string;               // Event ID (sha256 hash)
  pubkey: string;           // Author's public key (hex)
  created_at: number;       // Unix timestamp
  kind: number;             // Event kind
  tags: string[][];         // Tags array
  content: string;          // Event content
  sig: string;              // Schnorr signature (hex)
}
```

**Response:** `["OK", <event_id>, <accepted>, <message>]`

- `accepted: true` - Event stored successfully
- `accepted: false` - Storage failed (see message for reason)

**Event Types Supported:**

- **Regular events** (kind < 10000 or kind >= 20000 but < 30000)
- **Replaceable events** (kind 10000-19999) - Only latest per pubkey+kind
- **Parameterized replaceable events** (kind 30000-39999) - Only latest per pubkey+kind+d-tag

**Payment Requirement:** Free to publish (no ILP payment required at WebSocket layer)

---

#### CLOSE - Close Subscription

```json
["CLOSE", <subscription_id>]
```

Terminates an active subscription. No response sent per NIP-01.

---

### Server → Client Messages

#### EVENT - Event Data

```json
["EVENT", <subscription_id>, <toon_string>]
```

**Important:** The `<toon_string>` is **TOON-encoded event data**, not a JSON object. Clients must decode using TOON decoder.

---

#### EOSE - End of Stored Events

```json
["EOSE", <subscription_id>]
```

Indicates all historical events matching the subscription have been sent.

---

#### OK - Command Result

```json
["OK", <event_id>, <accepted>, <message>]
```

Sent in response to EVENT messages (NIP-20).

- `accepted: true` - Event accepted and stored
- `accepted: false` - Event rejected (see message)

---

#### NOTICE - Server Notice

```json
["NOTICE", <message>]
```

Human-readable server messages for errors or notifications.

**Common Notices:**

- `"error: invalid message format, expected JSON array"`
- `"error: invalid JSON"`
- `"error: unknown message type: <type>"`
- `"error: invalid subscription id"`
- `"error: too many subscriptions"`
- `"error: too many filters"`

---

## Data Models

### Events Table Schema (SQLite)

```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  pubkey TEXT NOT NULL,
  kind INTEGER NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL,          -- JSON array serialized as string
  created_at INTEGER NOT NULL,
  sig TEXT NOT NULL,
  received_at INTEGER NOT NULL
);

-- Indexes for query optimization
CREATE INDEX idx_events_pubkey ON events(pubkey);
CREATE INDEX idx_events_kind ON events(kind);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_events_pubkey_kind ON events(pubkey, kind);
```

---

## Configuration

### RelayConfig

```typescript
{
  port: number;                         // Default: 7000
  maxConnections?: number;              // Default: 100
  maxSubscriptionsPerConnection?: number; // Default: 20
  maxFiltersPerSubscription?: number;   // Default: 10
  databasePath?: string;                // Default: ':memory:' (in-memory DB)
}
```

### BlsConfig (Business Logic Server)

```typescript
{
  basePricePerByte: bigint;             // Base price per byte of TOON data
  pricingService?: PricingService;      // Optional kind-based pricing overrides
  ownerPubkey?: string;                 // Optional owner pubkey (bypass payment)
  spspMinPrice?: bigint;                // Optional min price for SPSP requests (kind:23194)
}
```

### PricingConfig

```typescript
{
  basePricePerByte: bigint;             // Default price per byte
  kindOverrides?: Map<number, bigint>;  // Per-kind price overrides
}
```

---

## Error Handling

### RelayError

```typescript
class RelayError extends Error {
  code: string; // Error code (e.g., 'STORAGE_ERROR')
}
```

### BlsError

```typescript
class BlsError extends RelayError {
  // BLS-specific errors
}
```

### PricingError

```typescript
class PricingError extends RelayError {
  // Pricing validation errors
}
```

---

## Integration Notes

### TOON Format

Events are encoded/decoded using TOON (agent-friendly format):

- `encodeEventToToon(event): Uint8Array` - Encode Nostr event to TOON bytes
- `decodeEventFromToon(bytes): NostrEvent` - Decode TOON bytes to Nostr event
- `encodeEventToToonString(event): string` - Encode to TOON string (for WebSocket)

### Event Replacement Logic

**Replaceable Events (10000-19999):**

- Keyed by `pubkey + kind`
- New event replaces old if: `created_at > old.created_at` OR `(created_at === old.created_at AND id < old.id)`

**Parameterized Replaceable Events (30000-39999):**

- Keyed by `pubkey + kind + d_tag_value`
- Same replacement logic as replaceable events
- Empty d-tag (`["d", ""]` or no d-tag) treated as distinct key

---

## Usage Example

### Start Relay with BLS

```typescript
import {
  NostrRelayServer,
  SqliteEventStore,
  BusinessLogicServer,
} from '@crosstown/relay';

// Create event store
const store = new SqliteEventStore('./events.db');

// Create relay
const relay = new NostrRelayServer({ port: 7000 }, store);
await relay.start();

// Create BLS
const bls = new BusinessLogicServer(
  {
    basePricePerByte: 100n,
    ownerPubkey: 'abc123...', // Optional
    spspMinPrice: 0n, // Free SPSP requests
  },
  store
);

// BLS runs on separate HTTP port (configured separately)
```

### WebSocket Client (JavaScript)

```javascript
const ws = new WebSocket('ws://localhost:7000');

// Subscribe to events
ws.send(JSON.stringify(['REQ', 'my-sub', { kinds: [1], limit: 10 }]));

// Publish event (requires valid Nostr event with signature)
ws.send(JSON.stringify(['EVENT', event]));

// Close subscription
ws.send(JSON.stringify(['CLOSE', 'my-sub']));
```

---

**Generated:** 2026-02-26
**Last Updated:** 2026-02-26
