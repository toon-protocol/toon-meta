# Relay Discovery Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common relay discovery operations on TOON. Each scenario shows the complete flow from intent to result, including TOON-specific considerations like the /health endpoint, publishEvent API for relay lists, and TOON-format parsing. These scenarios bridge the gap between knowing the NIP-11/65/66 specifications (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Querying a Relay's NIP-11 Information

**When:** An agent wants to check a relay's capabilities before connecting via WebSocket.

**Why this matters:** NIP-11 tells you what a relay supports -- which NIPs, what limitations, whether payment is required. On TOON, all relays require payment, but NIP-11 also reveals message size limits, supported event kinds, and relay identity.

### Steps

1. **Determine the HTTP URL.** Replace the WebSocket scheme with HTTPS: `wss://relay.example.com` becomes `https://relay.example.com`.

2. **Send an HTTP GET request** with the header `Accept: application/nostr+json`. This header is critical -- without it, the relay may return HTML instead of JSON.

3. **Parse the JSON response.** Extract key fields: `supported_nips` (what the relay supports), `limitation` (size and rate constraints), `payment_required` (always `true` on TOON), and `fees`.

4. **Check `supported_nips`** before attempting to use specific event kinds. For example, verify NIP-28 support before creating chat channels, or NIP-65 support before publishing relay lists.

5. **Check `limitation`** for `max_message_length` and `max_content_length` to ensure your events will fit.

### Considerations

- Always include the `Accept: application/nostr+json` header. This is the most common error when querying NIP-11.
- NIP-11 is an HTTP endpoint, not a Nostr event. No WebSocket connection or ILP payment is needed.
- For TOON-specific information (pricing, ILP address, chain config), use the `/health` endpoint instead of or in addition to NIP-11.

## Scenario 2: Querying a TOON Relay's /health Endpoint

**When:** An agent wants to discover a TOON relay's ILP pricing, payment capabilities, chain configuration, and TEE attestation status.

**Why this matters:** The `/health` endpoint is the primary discovery mechanism for TOON-specific relay information. It provides everything an agent needs to calculate fees, route ILP payments, and verify TEE attestation.

### Steps

1. **Send an HTTP GET request** to `http://<relay-host>:<bls-port>/health`. No special headers are required.

2. **Check the `status` field.** A value of `"healthy"` means the relay is operational.

3. **Extract pricing information.** The `pricing.basePricePerByte` field tells you the per-byte cost for write operations. The `pricing.currency` field confirms the denomination (always `"USDC"`).

4. **Extract ILP routing information.** The `ilpAddress` field is the relay's ILP address for payment routing.

5. **Extract chain configuration.** The `chain` field identifies the settlement chain preset (e.g., `"arbitrum-sepolia"`, `"anvil"`).

6. **Check network connectivity.** The `peerCount` and `channelCount` fields indicate how many ILP peers and payment channels the relay has. The `discoveredPeerCount` field shows peers discovered but not yet registered.

7. **Check x402 availability.** If the `x402` object is present in the response (with `x402.enabled: true`), the relay supports the `/publish` HTTP endpoint for x402-style payments. When x402 is disabled, the `x402` field is entirely absent.

8. **Verify TEE attestation.** If the `tee` object is present and `tee.attested` is `true`, the relay is running inside a trusted execution environment. Check `tee.state` for validity (`"valid"`, `"stale"`, or `"unattested"`). The `tee.pcr0` value can be verified against known-good measurements. When not in a TEE, the `tee` field is entirely absent.

### Considerations

- The `/health` endpoint uses the BLS port (default 3100 for genesis), not the relay WebSocket port.
- No payment is required to query `/health` -- it is a free HTTP endpoint.
- Use `/health` data to pre-calculate fees before publishing events. This avoids F04 (Insufficient Payment) errors.

## Scenario 3: Publishing Your Relay List (kind:10002)

**When:** An agent wants to publish its relay preferences so other users and clients can discover where it reads and writes.

**Why this matters:** Your relay list is a public declaration of which relays you use. On TOON, publishing it costs per-byte, so keep it accurate and batch updates.

### Steps

1. **Compile your relay list.** Decide which relays you use for reading, writing, or both. Include only relays you actively use.

2. **Construct the kind:10002 event.** Add `r` tags for each relay:
   - `["r", "wss://relay1.example.com"]` -- used for both read and write
   - `["r", "wss://relay2.example.com", "read"]` -- read only
   - `["r", "wss://relay3.example.com", "write"]` -- write only

   Set content to empty string (`""`).

3. **Sign the event** using your Nostr private key.

4. **Calculate the fee.** A relay list with 5 relays is approximately 350-500 bytes (~$0.004-$0.005 at default pricing). Check `pricing.basePricePerByte` from the `/health` endpoint.

5. **Publish via `publishEvent()`** from `@toon-protocol/client`.

### Considerations

- kind:10002 is a replaceable event. Each new publication replaces the previous relay list entirely.
- On TOON, each update costs per-byte. Batch all relay changes into a single update rather than publishing multiple times.
- Omit the read/write marker when a relay serves both purposes -- it saves ~6-8 bytes per tag and defaults to both.
- Only list relays you actively use. A bloated relay list wastes bytes and misleads clients.

## Scenario 4: Discovering Another User's Relays (kind:10002)

**When:** An agent wants to find which relays a specific user reads from and writes to, in order to deliver messages or fetch their events.

**Why this matters:** Knowing a user's relay list enables efficient event delivery and discovery. Rather than broadcasting to every known relay, you can target only the relays where the user is active.

### Steps

1. **Subscribe to kind:10002 events** from the target user. Filter: `{ "kinds": [10002], "authors": ["<target-user-hex-pubkey>"] }`.

2. **Decode the TOON-format response.** TOON relays return TOON-format strings, not standard JSON. Use the TOON decoder to parse the event.

3. **Extract `r` tags.** Each `r` tag specifies a relay URL and optional read/write marker.

4. **Build a relay map:**
   - Tags with no marker or both capabilities: use for both reading the user's events and sending events to them
   - Tags with `"read"` marker: the user reads from this relay -- publish events here if you want them to see your content
   - Tags with `"write"` marker: the user writes to this relay -- subscribe here to read their events

5. **Connect to relevant relays.** For fetching the user's events, connect to their `write` and unmarked relays. For sending them content, publish to their `read` and unmarked relays.

### Considerations

- Reading kind:10002 events is free on TOON -- no ILP payment required.
- Since kind:10002 is a replaceable event, you will receive at most one event (the latest).
- If a user has not published a kind:10002 event, you cannot determine their relay preferences programmatically. Fall back to known relays.
- `nostr-tools` SimplePool does NOT work in Node.js containers. Use direct WebSocket connections or the TOON client.

## Scenario 5: Monitoring Relay Liveness via NIP-66

**When:** An agent wants to discover which relays are online, their response times, and their capabilities, using data from relay monitor services.

**Why this matters:** NIP-66 provides systematic relay health data published by dedicated monitor services. This enables agents to make informed relay selection decisions based on liveness, latency, and capabilities.

### Steps

1. **Find active relay monitors.** Subscribe with filter: `{ "kinds": [10166] }`. This returns monitor registration events with their timeout and frequency parameters.

2. **Discover monitored relays.** For a specific monitor, subscribe with filter: `{ "kinds": [10066], "authors": ["<monitor-hex-pubkey>"] }`. This returns the list of relays the monitor tracks.

3. **Get relay status data.** Subscribe with filter: `{ "kinds": [30166] }` to receive relay discovery events. Each kind:30166 event contains a snapshot of a relay's status.

4. **Decode TOON-format responses.** Use the TOON decoder to parse kind:30166 events.

5. **Extract status information from tags:**
   - `d` tag: relay URL
   - `s` tag: status (`"online"` or `"offline"`)
   - `rtt` tags: round-trip times for open, read, and write operations
   - `N` tags: supported NIP numbers
   - `T` tags: relay type (e.g., `"pay-to-relay"` for TOON relays)
   - `n` tag: network type (`"clearnet"` or `"tor"`)

6. **Filter for TOON-compatible relays.** Look for relays with `["T", "pay-to-relay"]` tags to find ILP-gated relays.

7. **Sort by latency.** Use `rtt` tag values to rank relays by response time for your use case.

### Considerations

- All NIP-66 reading is free on TOON.
- kind:30166 is a parameterized replaceable event keyed by the relay URL (`d` tag). You receive the latest snapshot per relay per monitor.
- NIP-66 data is published by third-party monitor services, not by the relays themselves. Trust the monitor's reputation.
- For TOON-specific pricing and ILP information, query the relay's `/health` endpoint directly -- NIP-66 does not include ILP-specific fields.

## Scenario 6: Finding Pay-to-Relay Relays

**When:** An agent wants to discover all ILP-gated relays in the network, such as when building a relay selection UI or choosing where to publish.

**Why this matters:** TOON relays are pay-to-relay by nature. Finding them via NIP-66 monitoring data enables agents to build a map of the paid relay network.

### Steps

1. **Subscribe to kind:30166 events with a tag filter.** Filter: `{ "kinds": [30166], "#T": ["pay-to-relay"] }`. This returns only relay discovery events tagged as pay-to-relay.

2. **Decode TOON-format responses.** Use the TOON decoder to parse events.

3. **For each discovered relay, extract the URL** from the `d` tag.

4. **Query each relay's `/health` endpoint** to get TOON-specific pricing and ILP information.

5. **Compare relays** based on:
   - `pricing.basePricePerByte` -- lower is cheaper for write operations
   - `peerCount` / `channelCount` -- more peers indicate better network connectivity
   - `chain` -- verify compatible settlement chain preset (e.g., both use `"arbitrum-sepolia"`)
   - `tee.attested` and `tee.state` -- prefer attested relays with `"valid"` state for sensitive operations
   - `rtt` values from kind:30166 -- lower latency is better

6. **Select relays** based on your criteria and update your kind:10002 relay list if appropriate.

### Considerations

- Combining NIP-66 monitoring data with `/health` endpoint queries gives the most complete picture of a TOON relay.
- Not all pay-to-relay relays use ILP -- the `T` tag is a general classifier. Always verify ILP capability via `/health`.
- Relay selection is a public signal. The relays you list in kind:10002 reflect your network preferences.
