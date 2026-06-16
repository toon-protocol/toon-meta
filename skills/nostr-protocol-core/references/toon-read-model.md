# TOON Read Model

## Why Reads Are Free

TOON's economic model is pay-to-write, free-to-read. Writers pay to publish because payment prevents spam and funds relay operators. Readers consume freely because open readability maximizes the network's value -- content that nobody can read has no economic worth. This asymmetry is the foundation of the protocol's economics.

## Subscription Basics (NIP-01)

Subscribe to events using standard NIP-01 filter syntax over WebSocket:

```json
["REQ", "my-subscription-id", {"kinds": [1], "limit": 50}]
```

Filter fields follow the NIP-01 specification:
- `ids`: list of event IDs (hex)
- `authors`: list of pubkeys (hex)
- `kinds`: list of event kind integers
- `since`: Unix timestamp, events must be newer
- `until`: Unix timestamp, events must be older
- `limit`: maximum number of events to return
- `#e`: filter by `e` tag values
- `#p`: filter by `p` tag values

Multiple filters in a single REQ are OR'd together:

```json
["REQ", "combined", {"kinds": [1], "authors": ["abc..."]}, {"kinds": [7], "#p": ["abc..."]}]
```

Close a subscription when done:

```json
["CLOSE", "my-subscription-id"]
```

## TOON Format Responses

This is the critical TOON-specific behavior: relay responses contain TOON-format strings, not standard JSON Nostr event objects.

When a TOON relay sends an EVENT message, it looks like:

```
EVENT, <subscription-id>, <toon-format-string>
```

The relay sends an array with "EVENT" as the first element, the subscription ID as the second, and the TOON-format string as the third.

Where `<toon-format-string>` is a TOON 1.x encoded representation of the event, not a JSON `{ "id": "...", "pubkey": "...", ... }` object.

### Why TOON Format?

TOON format is the protocol's wire encoding. It is more compact than JSON and includes integrity guarantees needed for the ILP payment pipeline. The relay stores and transmits events in TOON format because that is what the ILP layer produces when a write is accepted. Converting back to JSON on read would add unnecessary overhead and lose the encoding's properties.

### Parsing TOON Format

Use the TOON decoder to parse responses back into standard Nostr event objects:

```typescript
import { decode as decodeToon } from '@toon-format/toon';

// When receiving an EVENT message from a TOON relay WebSocket
ws.on('message', (data) => {
  const parsed = JSON.parse(data);
  if (parsed[0] === 'EVENT') {
    const subscriptionId = parsed[1];
    const toonString = parsed[2];
    // Decode TOON format back to a standard NostrEvent
    const event = decodeToon(toonString);
    // Now event has the standard structure: { id, pubkey, created_at, kind, tags, content, sig }
  }
});
```

### EOSE (End of Stored Events)

After sending all stored events matching a subscription, the relay sends:

```json
["EOSE", "my-subscription-id"]
```

New events matching the subscription filters arrive as additional EVENT messages after EOSE.

## Common Read Patterns

### Fetch Recent Notes

```json
["REQ", "feed", {"kinds": [1], "limit": 20}]
```

### Follow a Specific Author

```json
["REQ", "author-feed", {"kinds": [1], "authors": ["<hex-pubkey>"], "since": 1700000000}]
```

### Watch for Replies to an Event

```json
["REQ", "replies", {"kinds": [1], "#e": ["<event-id-hex>"]}]
```

### Discover Relay Peer Info

```json
["REQ", "peers", {"kinds": [10032]}]
```

### Discover DVM Providers

```json
["REQ", "providers", {"kinds": [10035]}]
```

## Important Considerations

- TOON format is version 1.x. Do not assume JSON event format in relay responses.
- The `ToonClient` from `@toon-protocol/client` handles TOON encoding/decoding via the `toonEncoder` and `toonDecoder` config options. If using the client library, decoding is handled for you when processing relay events.
- NIP-01 NOTICE messages (`["NOTICE", "<message>"]`) are standard string messages from the relay and are not TOON-encoded.
- OK messages (`["OK", "<event-id>", <accepted>, "<message>"]`) follow standard NIP-01 format -- these are relay control messages, not event data.
