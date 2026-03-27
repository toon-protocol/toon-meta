---
name: relay-discovery
description: Relay discovery and network navigation on Nostr and TOON Protocol using
  NIP-11, NIP-65, and NIP-66. Covers relay information ("what relays are available?",
  "how do I check relay capabilities?", NIP-11, relay information document, supported_nips,
  payment_required), relay list metadata ("how do I publish my relay list?", "how do
  I find someone's relays?", kind:10002, relay list, r tag, read relay, write relay),
  relay monitoring ("how do I monitor relay health?", "how does relay liveness work?",
  kind:30166, kind:10166, kind:10066, NIP-66 relay discovery), and TOON-enriched
  relay info ("what does a TOON relay's /health endpoint return?", pricing, ILP
  capabilities, chain config, x402, TEE attestation). Implements NIP-11, NIP-65,
  and NIP-66 on TOON's ILP-gated relay network.
---

# Relay Discovery (TOON)

Relay discovery and network navigation for agents on the TOON network. Covers NIP-11 (Relay Information Document) for querying relay capabilities via HTTP, NIP-65 (Relay List Metadata) for publishing and reading user relay preferences (kind:10002), and NIP-66 (Relay Discovery and Liveness Monitoring) for systematic relay health tracking. This is primarily a read-focused skill -- only kind:10002 relay list events are agent-writable. On TOON, relay discovery is enriched with ILP payment capabilities, chain configuration, pricing, and TEE attestation data.

## Relay Information (NIP-11)

NIP-11 defines the Relay Information Document, an HTTP GET endpoint that returns JSON metadata about a relay's capabilities. Send a GET request with `Accept: application/nostr+json` header to the relay's WebSocket URL (replacing `wss://` with `https://`).

### Standard NIP-11 Fields

- `name` -- Relay name
- `description` -- Relay description
- `pubkey` -- Relay operator's pubkey
- `contact` -- Operator contact
- `supported_nips` -- Array of supported NIP numbers
- `software` -- Relay software identifier
- `version` -- Software version
- `limitation` -- Object with `max_message_length`, `max_subscriptions`, `max_filters`, `auth_required`, `payment_required`, `restricted_writes`, etc.
- `limitation.payment_required` -- Boolean indicating if the relay requires payment (critical for TOON -- always `true`). This field is inside the `limitation` object, not top-level.
- `retention` -- Array of retention policy objects
- `fees` -- Payment fee structure

### TOON-Enriched /health Endpoint

TOON relays expose a `/health` HTTP endpoint that extends standard NIP-11 with ILP and settlement information:

- `status` -- Relay health status (`"healthy"` or `"unhealthy"`)
- `phase` -- Current bootstrap phase
- `pubkey` -- Node's Nostr pubkey (64-char hex)
- `ilpAddress` -- The relay's ILP address for payment routing
- `pricing.basePricePerByte` -- ILP price per byte for write operations (number, in nanounits)
- `pricing.currency` -- Payment denomination (always `"USDC"`)
- `peerCount` -- Number of connected ILP peers
- `discoveredPeerCount` -- Number of discovered (not yet registered) peers
- `channelCount` -- Number of open payment channels
- `x402` -- Object with `{ enabled: true, endpoint: "/publish" }` when x402 is active; entirely absent when disabled
- `tee` -- TEE attestation object (only present when running in Oyster CVM): `{ attested, enclaveType, lastAttestation, pcr0, state }`
- `chain` -- Settlement chain preset name (e.g., `"anvil"`, `"arbitrum-sepolia"`)
- `capabilities` -- Array of capability strings (e.g., `["relay"]` or `["relay", "x402"]`)
- `version` -- Software version string
- `sdk` -- Always `true` for SDK-based nodes
- `timestamp` -- Response timestamp (milliseconds)

## Relay List Metadata (NIP-65)

NIP-65 defines kind:10002 events for publishing a user's relay preferences. Each relay is listed with an optional read/write marker.

### kind:10002 Structure

```json
{
  "kind": 10002,
  "tags": [
    ["r", "wss://relay1.example.com", "read"],
    ["r", "wss://relay2.example.com", "write"],
    ["r", "wss://relay3.example.com"]
  ],
  "content": ""
}
```

- `r` tag with no marker: relay used for both read and write
- `r` tag with `read`: relay used only for reading
- `r` tag with `write`: relay used only for writing

kind:10002 is a replaceable event -- publishing a new one replaces the previous relay list.

## Relay Discovery and Liveness (NIP-66)

NIP-66 defines events for systematic relay monitoring:

- **kind:30166 (Relay Discovery)** -- Published by relay monitors, contains relay metadata snapshots with `d` tag set to the relay URL
- **kind:10166 (Relay Monitor Registration)** -- Published by monitors to register themselves
- **kind:10066 (Relay List for Monitoring)** -- List of relays being monitored

### NIP-66 Tag Structures

kind:30166 tags: `["d", "wss://relay.example.com"]`, `["n", "clearnet"]` or `["n", "tor"]`, `["N", "11"]` (supported NIPs), `["R", "read"]`/`["R", "write"]` (relay type), `["T", "pay-to-relay"]` (relay tags).

kind:10166 tags: `["timeout", "open", "5000"]`, `["timeout", "read", "15000"]`, `["timeout", "write", "15000"]`, `["frequency", "3600"]` (check interval in seconds).

## TOON Write Model

Only kind:10002 relay list events are agent-writable in this skill. Publish via `publishEvent()` from `@toon-protocol/client`. Relay list events are typically small (a few hundred bytes for 5-10 relays). On TOON, publishing your relay list costs per-byte, making it a deliberate declaration of your relay preferences.

For the full fee formula and publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Query NIP-11 relay information via HTTP GET. Subscribe to kind:10002 events to discover user relay preferences. Subscribe to kind:30166 events for relay monitoring data. TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse relay list and monitoring data. Reading is free on TOON.

**Important:** `nostr-tools` SimplePool does NOT work in Node.js containers (no global WebSocket + TOON format incompatible). Use direct WebSocket connections or the TOON client for relay communication.

For TOON format parsing details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Relay choice matters on TOON. ILP-gated relays signal commitment to quality -- every writer has paid to publish, creating a natural quality floor absent from free relays. When recommending relays, consider the economic model as a feature, not a limitation.

Publishing your relay list (kind:10002) is a public statement about which relays you trust and use. Keep it accurate and up to date. On TOON, relay list updates cost per-byte -- batch relay changes rather than updating one relay at a time.

**Anti-patterns to avoid:**
- Querying NIP-11 without the `Accept: application/nostr+json` header -- may return HTML instead of JSON
- Assuming all relays support the same NIPs -- always check `supported_nips` first
- Ignoring `payment_required: true` on TOON relays -- all writes require ILP payment

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-11, NIP-65, and NIP-66 specifications** -- Read [nip-spec.md](references/nip-spec.md) for the relay discovery specifications.
- **Understanding TOON-enriched relay info, /health endpoint, and ILP capabilities** -- Read [toon-extensions.md](references/toon-extensions.md) for TOON-specific relay extensions.
- **Step-by-step relay discovery workflows** -- Read [scenarios.md](references/scenarios.md) for querying relays, publishing relay lists, and monitoring on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Service discovery for DVM providers** -- See `dvm-protocol` (Story 9.31) for kind:10035 service discovery events.
- **TEE attestation for relay trust** -- See kind:10033 attestation events in project-context.md section "TEE Integration".
- **Social judgment on relay selection** -- See `nostr-social-intelligence` for base social intelligence guidance.
