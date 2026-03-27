# TOON Extensions for Relay Discovery

> **Why this reference exists:** Relay discovery on TOON goes beyond standard NIP-11/65/66 by exposing ILP payment capabilities, chain configuration, pricing, and TEE attestation data. The `/health` endpoint returns enriched relay information that agents need for payment routing and relay selection. Publishing relay lists (kind:10002) requires ILP payment via publishEvent(). This file covers the TOON-specific mechanics and their implications for relay discovery and network navigation.

## TOON-Enriched /health Endpoint

TOON relays expose a `/health` HTTP endpoint that extends standard NIP-11 with ILP and settlement information. This is the primary mechanism for agents to discover relay capabilities before connecting.

### Request

```
GET http://<relay-host>:<bls-port>/health
```

No special headers required (unlike NIP-11 which requires `Accept: application/nostr+json`). The `/health` endpoint always returns JSON.

### Response Fields

```json
{
  "status": "healthy",
  "phase": "running",
  "pubkey": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "ilpAddress": "g.toon.relay1",
  "peerCount": 3,
  "discoveredPeerCount": 1,
  "channelCount": 2,
  "pricing": {
    "basePricePerByte": 10,
    "currency": "USDC"
  },
  "x402": {
    "enabled": true,
    "endpoint": "/publish"
  },
  "tee": {
    "attested": true,
    "enclaveType": "marlin-oyster",
    "lastAttestation": 1711500000,
    "pcr0": "abc123...",
    "state": "valid"
  },
  "capabilities": ["relay", "x402"],
  "chain": "arbitrum-sepolia",
  "version": "0.9.0",
  "sdk": true,
  "timestamp": 1711500000000
}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Relay health status (`"healthy"`) |
| `phase` | string | Current bootstrap phase (e.g., `"running"`, `"discovering"`) |
| `pubkey` | string | Node's Nostr pubkey (64-char hex) |
| `ilpAddress` | string | The relay's ILP address for payment routing (e.g., `g.toon.relay1`) |
| `peerCount` | number | Number of registered ILP peers |
| `discoveredPeerCount` | number | Number of discovered (not yet registered) peers |
| `channelCount` | number | Number of open payment channels |
| `pricing.basePricePerByte` | number | ILP price per byte for write operations (in nanounits) |
| `pricing.currency` | string | Payment denomination (always `"USDC"`) |
| `x402` | object or absent | When x402 is enabled: `{ enabled: true, endpoint: "/publish" }`. Entirely absent when disabled. |
| `tee` | object or absent | TEE attestation info (only present when running in Oyster CVM enclave). Entirely absent when not in TEE. |
| `capabilities` | array | Array of capability strings (e.g., `["relay"]` or `["relay", "x402"]`) |
| `chain` | string | Settlement chain preset name (e.g., `"anvil"`, `"arbitrum-sepolia"`, `"arbitrum-one"`) |
| `version` | string | Software version string |
| `sdk` | boolean | Always `true` for SDK-based nodes |
| `timestamp` | number | Response timestamp in milliseconds |

### TEE Attestation Object

When running inside an Oyster CVM enclave, the `tee` field is present in the response. When NOT running in a TEE, the `tee` field is entirely absent (not `{ attested: false }` -- omitted completely per enforcement guideline 12).

```json
{
  "attested": true,
  "enclaveType": "marlin-oyster",
  "lastAttestation": 1711500000,
  "pcr0": "<hex-pcr0-value-sha384-96-chars>",
  "state": "valid"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `attested` | boolean | Whether a valid attestation has been published |
| `enclaveType` | string | Enclave type identifier (e.g., `"aws-nitro"`, `"marlin-oyster"`) |
| `lastAttestation` | number | Unix timestamp of the last attestation event |
| `pcr0` | string | Platform Configuration Register 0 (SHA-384 hex, 96 chars) |
| `state` | string | Attestation validity: `"valid"`, `"stale"`, or `"unattested"` |

PCR values provide cryptographic proof that the relay is running attested code inside a trusted execution environment. Agents can verify `pcr0` against known-good measurements. Check the `state` field -- `"valid"` means the attestation is current, `"stale"` means it has expired.

### payment_required: Always True on TOON

On TOON relays, `limitation.payment_required` is always `true` in NIP-11. Every write operation requires ILP payment. This is a fundamental property of the TOON network -- there are no free writes. Reading is always free.

## Publishing kind:10002 Relay Lists on TOON

Publishing a relay list on TOON follows the standard `publishEvent()` flow from `@toon-protocol/client`.

### Publishing Flow

1. **Construct the kind:10002 event.** Add `r` tags for each relay with optional `read`/`write` markers. Set content to empty string (`""`).
2. **Sign the event** using your Nostr private key.
3. **Discover pricing.** Check the relay's `pricing.basePricePerByte` from the `/health` endpoint or kind:10032 peer info.
4. **Calculate fee.** `pricing.basePricePerByte * serializedEventBytes` -- relay list events are typically small.
5. **Sign a balance proof.** `client.signBalanceProof(channelId, amount)`
6. **Publish.** `client.publishEvent(signedEvent, { destination, claim })`

### Replaceable Event Semantics

kind:10002 is a replaceable event. Each new kind:10002 event replaces the previous one. On TOON, this means you pay per-byte each time you update your relay list. Batch relay changes into a single update rather than publishing multiple times for individual relay additions or removals.

### Error Handling

- **F04 (Insufficient Payment):** Recalculate with actual serialized event size.
- **Relay rejection:** Check for malformed `r` tags or invalid relay URLs.

## Byte Costs for Relay Discovery Events

### kind:10002 Relay List Costs

| List Size | Approximate Size | Cost at 10n/byte |
|-----------|-----------------|------------------|
| 3 relays (minimal) | ~250-350 bytes | ~$0.003-$0.004 |
| 5 relays (typical) | ~350-500 bytes | ~$0.004-$0.005 |
| 10 relays (extensive) | ~550-800 bytes | ~$0.006-$0.008 |

Each `r` tag adds approximately 50-70 bytes (relay URL length varies). The read/write marker adds ~6-8 bytes per tag.

### Cost Optimization

- **Batch updates.** Combine all relay changes into a single kind:10002 event rather than updating incrementally.
- **Minimize relay count.** Only list relays you actively use. Each additional relay adds ~50-70 bytes.
- **Use markers intentionally.** Omit the read/write marker (defaulting to both) when a relay serves both purposes, saving ~6-8 bytes per tag.

## NIP-11 vs /health Endpoint

| Feature | NIP-11 (Standard) | /health (TOON) |
|---------|-------------------|----------------|
| Protocol | HTTP GET with `Accept: application/nostr+json` | HTTP GET (no special headers) |
| URL | Same as WebSocket URL (scheme replaced) | `http://<host>:<bls-port>/health` |
| Payment info | `limitation.payment_required`, `fees` | `pricing.basePricePerByte`, `pricing.currency`, `ilpAddress` |
| Chain info | None | `chain` (preset name, e.g., `"arbitrum-sepolia"`) |
| Network info | None | `peerCount`, `discoveredPeerCount`, `channelCount` |
| x402 info | None | `x402` object (when enabled) |
| TEE info | None | `tee` object (when in enclave) |
| Node identity | `pubkey` (operator) | `pubkey` (node Nostr pubkey) |
| Capabilities | `supported_nips` | `capabilities` array, `version`, `sdk` |
| Runtime state | None | `phase`, `timestamp` |

Agents should query the `/health` endpoint for TOON-specific information (pricing, ILP address, chain preset, TEE status) and optionally query NIP-11 for standard relay metadata (name, description, posting policy, limitation constraints).

## x402 Payment Endpoint

When the `x402` object is present in the `/health` response (i.e., `x402.enabled` is `true`), the relay exposes a `/publish` HTTP endpoint that accepts x402-style payments:

```
POST http://<relay-host>:<bls-port>/publish
```

Without an `X-PAYMENT` header, the endpoint returns HTTP 402 with pricing information. This provides an alternative payment flow to the standard WebSocket + ILP path.

## TOON-Format Parsing for Relay Discovery Events

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. When reading kind:10002, kind:30166, kind:10166, or kind:10066 events:

1. **Decode the TOON-format response** using the TOON decoder to extract event fields.
2. **For kind:10002,** extract `r` tags to build the relay list with read/write markers.
3. **For kind:30166,** extract `d`, `n`, `N`, `R`, `T`, `s`, and `rtt` tags for relay monitoring data.
4. **For kind:10166,** extract `timeout` and `frequency` tags for monitor parameters.

Reading relay discovery events is free on TOON -- no ILP payment required for subscriptions.

**Important:** `nostr-tools` SimplePool does NOT work in Node.js containers (no global WebSocket + TOON format incompatible). Use direct WebSocket connections or the TOON client for relay communication.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers relay-discovery-specific extensions; the protocol core covers foundational mechanics shared by all event kinds.
