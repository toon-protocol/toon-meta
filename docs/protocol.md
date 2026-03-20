# Protocol

TOON extends Nostr with custom event kinds for ILP peering and uses TOON encoding for efficient data transport.

## Event Kinds

### ILP Peering

| Kind | Name | Type | Purpose |
|------|------|------|---------|
| **10032** | ILP Peer Info | Replaceable | Advertise node's ILP address, BTP endpoint, supported chains, settlement addresses, and TokenNetwork contracts |

Kind 10032 is a replaceable event — publishing a new one with the same `d` tag replaces the old one. It serves as a node's business card: what chains it supports, where to settle, and how to connect.

**Example kind:10032 content:**

```json
{
  "ilpAddress": "g.toon.peer1",
  "btpEndpoint": "ws://peer1.example.com:3000",
  "supportedChains": ["evm:base:84532"],
  "settlementAddresses": { "evm:base:84532": "0xABC..." },
  "tokenNetworks": { "evm:base:84532": "0x733..." }
}
```

### NIP-34: Git Operations (Payment-Gated)

| Kind | Name | Purpose |
|------|------|---------|
| **30617** | Repository Announcement | Advertise Git repositories |
| **1617** | Patch | Submit code changes (paid via ILP) |
| **1621** | Issue | Create issues (paid via ILP) |
| **1622** | Reply | Comment on patches/issues (paid via ILP) |

NIP-34 events are payment-gated — submitting a patch requires micropayments via ILP. Repository owners earn revenue from contributions.

**Learn more:** [NIP-34 Specification](https://github.com/nostr-protocol/nips/blob/master/34.md)

## TOON Format

[TOON](https://toonformat.dev) is a compact, human-readable encoding of the JSON data model. TOON uses it natively throughout the entire stack — from ingestion to storage to delivery.

**Why TOON over JSON?**

- 5-10% smaller for typical Nostr events
- Human-readable `key: value` syntax
- LLM-optimized for token efficiency
- Validated before payment — prevents storing garbage data
- Deterministic round-trips preserve all data

**Example comparison:**

```yaml
# TOON format (327 bytes)
id: aaaa...aaaa
pubkey: bbbb...bbbb
kind: 1
content: gm
tags[0]:
created_at: 1234567890
sig: cccc...cccc
```

```json
// JSON format (344 bytes)
{"id":"aaaa...aaaa","pubkey":"bbbb...bbbb","kind":1,"content":"gm","tags":[],"created_at":1234567890,"sig":"cccc...cccc"}
```

**Event lifecycle — TOON all the way:**

1. Client encodes event to TOON text → UTF-8 bytes → ILP packet data
2. BLS decodes UTF-8 → parses TOON → verifies signature → checks payment → stores as TOON in SQLite
3. Relay reads TOON from disk → sends TOON to WebSocket subscribers
4. No JSON round-trips at any stage

## ILP Integration

### Payment Flow

Writers embed TOON-encoded events in ILP PREPARE packets. The relay validates payment and returns an ILP FULFILL as proof of storage.

```
Writer                    ILP Network                 Relay
  │                           │                         │
  │  PREPARE                  │                         │
  │  { dest, amount, data }   │                         │
  │ ────────────────────────>│──────────────────────>  │
  │                           │                         │  validate + store
  │  FULFILL                  │                         │
  │  { fulfillment, data }    │                         │
  │ <────────────────────────│<──────────────────────  │
```

### Pricing Model

- **Base price**: `basePricePerByte` (default: 10 units per byte)
- **Required amount**: `toonData.length * basePricePerByte`
- **Self-write bypass**: Events from the relay owner's pubkey are free
- **Per-kind overrides**: Different event kinds can have custom pricing

### Validation Pipeline

Every incoming packet passes through five stages in order:

1. **Size check** — Reject if payload > 1MB (DoS protection)
2. **Shallow TOON parse** — Extract routing metadata without full decode
3. **Signature verification** — Schnorr signature check (skipped in dev mode)
4. **Pricing validation** — Verify payment meets per-byte requirement
5. **Handler dispatch** — Route to registered handler by event kind

Failure at any stage produces an ILP REJECT:

| Error Code | Meaning |
|------------|---------|
| F04 | Insufficient payment |
| F06 | Invalid signature or payload |
| F08 | Payload too large |
| T00 | Internal handler error |

## Related Specifications

### Nostr
- [NIP-01: Basic Protocol](https://github.com/nostr-protocol/nips/blob/master/01.md) — Base relay protocol
- [NIP-34: Git Stuff](https://github.com/nostr-protocol/nips/blob/master/34.md) — Git operations via Nostr
- [NIP-44: Encrypted Payloads](https://github.com/nostr-protocol/nips/blob/master/44.md) — Encrypted messaging

### Interledger
- [RFC 0027: ILPv4](https://interledger.org/developers/rfcs/interledger-protocol-v4/) — Core protocol
- [RFC 0032: Peering, Clearing and Settlement](https://interledger.org/developers/rfcs/peering-clearing-settling/) — Peering model
- [RFC 0035: ILP Over HTTP](https://interledger.org/developers/rfcs/ilp-over-http/) — HTTP transport
