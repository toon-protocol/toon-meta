# 4. Data Models

## 4.1 IlpPeerInfo

**Purpose:** Represents ILP connection information published by a peer via kind:10032 events.

**Key Attributes:**
- `ilpAddress`: string - ILP address of the peer's connector
- `btpEndpoint`: string - BTP WebSocket endpoint URL
- `settlementEngine`: string | undefined - Settlement engine identifier
- `assetCode`: string - Asset code (e.g., "USD", "XRP")
- `assetScale`: number - Asset scale (decimal places)

**Relationships:**
- Associated with a Nostr pubkey (event author)
- Used by NostrPeerDiscovery to populate connector peer list

## 4.2 SpspInfo

**Purpose:** SPSP parameters for payment setup, exchanged via kind:10047 (static) or kind:23195 (dynamic response).

**Key Attributes:**
- `destinationAccount`: string - ILP address to send payment to
- `sharedSecret`: string - Base64-encoded shared secret for STREAM

**Relationships:**
- Associated with a Nostr pubkey
- Used by NostrSpspClient/Server for payment setup

## 4.3 SpspRequest

**Purpose:** Request for fresh SPSP parameters, sent as kind:23194 ephemeral event.

**Key Attributes:**
- `requestId`: string - Unique request identifier
- `timestamp`: number - Request timestamp

**Relationships:**
- Sent to a specific recipient pubkey
- Triggers SpspResponse from recipient

## 4.4 SpspResponse

**Purpose:** Response containing SPSP parameters, sent as kind:23195 ephemeral event.

**Key Attributes:**
- `requestId`: string - Matching request identifier
- `destinationAccount`: string - ILP address
- `sharedSecret`: string - Base64-encoded shared secret

**Relationships:**
- Response to SpspRequest
- Encrypted with NIP-44 for recipient

## 4.5 TrustScore

**Purpose:** Computed trust assessment between two pubkeys.

**Key Attributes:**
- `score`: number - Overall trust score (0-1)
- `socialDistance`: number - Hops in follow graph
- `mutualFollowerCount`: number - Shared followers
- `breakdown`: object - Component score details

**Relationships:**
- Computed from social graph data
- Used to derive credit limits

## 4.6 NostrEvent (External)

**Purpose:** Standard Nostr event structure from nostr-tools.

**Key Attributes:**
- `id`: string - Event hash
- `pubkey`: string - Author public key
- `kind`: number - Event kind
- `content`: string - Event content
- `tags`: string[][] - Event tags
- `created_at`: number - Unix timestamp
- `sig`: string - Schnorr signature

---
