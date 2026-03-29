# TOON Extensions for App Handlers

> **Why this reference exists:** Application handlers on TOON differ from vanilla Nostr because writes are ILP-gated and TOON has its own service discovery layer (kind:10035 SkillDescriptor). This file covers TOON-specific considerations for publishing handler information and recommendations, the connection to DVM service discovery, parameterized replaceable cost advantages, and building TOON-aware application handlers.

## Publishing App Handler Events on TOON

All event publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow for kind:31990 (Handler Information)

1. **Construct the event:** Build the kind:31990 event with `d` tag (app identifier), `k` tags (handled kinds), platform URL tags, relay hint tags, and markdown content description.
2. **Sign the event:** Use nostr-tools or equivalent to sign with the application publisher's private key.
3. **Discover pricing:** Check the destination relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint.
4. **Calculate fee:** `basePricePerByte * serializedEventBytes`. A typical handler info event runs ~300-500 bytes. At default `basePricePerByte` of 10n, cost is approximately $0.003-$0.005.
5. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`.

### Publishing Flow for kind:31989 (Recommendation)

1. **Construct the event:** Build the kind:31989 event with `d` tag (recommended-for kind), `a` tag(s) referencing kind:31990 handler events, and optional review text in content.
2. **Sign the event.**
3. **Calculate fee:** A recommendation event runs ~200-400 bytes. Cost is approximately $0.002-$0.004.
4. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low for the payload size. Recalculate with the actual serialized event bytes.
- **Relay rejection:** Malformed event (invalid signature, missing required tags). Fix and republish.

## Parameterized Replaceable Cost Advantages

Both kind:31990 and kind:31989 are parameterized replaceable events. This has significant cost implications on TOON:

### Update Economics

- **No accumulation cost:** Updating an app listing or changing a recommendation replaces the old event. You pay per update, but the relay stores only one version per pubkey + kind + d-tag combination.
- **Predictable storage:** Unlike regular events that accumulate indefinitely, parameterized replaceable events have bounded storage. An app that updates its listing 100 times still occupies one event slot.
- **Version cost:** Each update costs the full event byte price. An app that frequently updates its listing will spend more in aggregate, but the per-update cost remains low ($0.003-$0.005).

### Comparison with Non-Replaceable Events

| Aspect | Parameterized Replaceable (kind:31990/31989) | Regular Events |
|--------|----------------------------------------------|----------------|
| Storage | One event per pubkey + d-tag | Accumulates |
| Update cost | Full event price per update | New event price per post |
| Delete | Replace with empty or use NIP-09 | NIP-09 only |
| Addressing | `naddr1` (kind + pubkey + d-tag) | `nevent1` (event ID) |

## Connection to kind:10035 SkillDescriptor

TOON's DVM (Data Vending Machine) ecosystem uses kind:10035 events as SkillDescriptors -- events that describe available compute services. NIP-89 app handlers and TOON SkillDescriptors serve complementary purposes:

### How They Relate

| Aspect | kind:31990 (NIP-89) | kind:10035 (TOON SkillDescriptor) |
|--------|---------------------|-----------------------------------|
| Purpose | Advertise client apps for viewing/creating events | Advertise DVM compute services |
| Scope | UI/UX handlers for event kinds | Backend compute capabilities |
| Discovery | Filter by `k` tag (handled kinds) | Filter by service type |
| Platform | Web, iOS, Android URLs | ILP payment endpoints |

### Integration Pattern

An application that provides both a user-facing client and DVM backend services should publish both:

1. **kind:31990** for the client app -- advertising which event kinds the UI can handle, with platform URLs for users to access it.
2. **kind:10035** for DVM services -- advertising compute capabilities with ILP payment information for machine-to-machine interaction.

A TOON-aware client can cross-reference kind:31990 app handlers with kind:10035 SkillDescriptors to present a unified view of available services: "This app handles kind:5600 DVM requests and also offers its own kind:5600 compute service."

### Query Pattern for Cross-Referencing

1. Find apps that handle a DVM kind:
   ```json
   ["REQ", "dvm-apps", { "kinds": [31990], "#k": ["5600"] }]
   ```

2. Find DVM service providers by the same pubkey:
   ```json
   ["REQ", "dvm-services", { "kinds": [10035], "authors": ["<app-pubkey>"] }]
   ```

3. Present combined results: the app's UI handler info alongside its DVM service capabilities.

## Building TOON-Aware Application Handlers

Applications that advertise handling TOON-specific event kinds must support TOON's unique requirements:

### Write Support

If an app's kind:31990 event includes `["web", "...", "write"]` for event kinds on TOON, the app must integrate with `@toon-protocol/client` for publishing. Specifically:

- **ILP payment flow:** The app must handle fee calculation (`basePricePerByte * serializedEventBytes`), balance proof signing, and `publishEvent()` calls.
- **Error handling:** The app must handle F04 (Insufficient Payment) errors and relay rejections gracefully.
- **Payment channel management:** The app should manage payment channels or guide users through channel setup.

### Read Support

If an app handles reading TOON events:

- **TOON-format parsing:** TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. The app must use the TOON decoder.
- **Free reads:** Reading is free on TOON -- no ILP payment needed for subscriptions or queries.

### Advertising TOON Support

Apps that support TOON should indicate this in their kind:31990 content description. There is no standardized tag for TOON support, so include it in the markdown:

```markdown
# MyTOONApp

A TOON-native Nostr client with full ILP payment integration.

## TOON Support
- ILP-gated publishing with automatic fee calculation
- TOON-format event parsing
- Payment channel management
- Multi-relay routing with per-hop fee awareness
```

Additionally, include TOON relay URLs in `r` tags to signal where the app operates:

```json
["r", "wss://relay.toon-protocol.com"]
```

## Reading App Handler Events from TOON Relays

TOON relays return TOON-format strings in EVENT messages. To extract app handler information:

1. **Decode the TOON-format response** using the TOON decoder to extract event fields.
2. **Parse the `d` tag** to identify the application or the recommended-for kind.
3. **Extract `k` tags** (for kind:31990) to determine handled kinds.
4. **Parse platform URL tags** (`web`, `ios`, `android`) to extract access URLs.
5. **Parse `a` tags** (for kind:31989) to identify recommended apps.
6. **Read the content field** for the app description or review text.

All reads are free on TOON -- no ILP payment needed.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers app-handler-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
