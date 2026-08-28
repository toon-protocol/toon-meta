# The Read Model — free, plain NIP-01

## Why Reads Are Free

TOON's economic model is pay-to-write, free-to-read. Writers pay to publish because a paid write is a **gate** -- every write must draw a covering claim against a funded payment channel, which gives the network attribution and a settlement trail, and funds relay operators. (It is a gate rather than a deterrent: the relay route charges 1 base unit of 6-decimal USDC, so the price alone stops nobody.) Readers consume freely because open readability maximizes the network's value -- content that nobody can read has no economic worth. This asymmetry is the foundation of the protocol's economics.

Mechanically, a read **never touches a connector at all**. You open a plain Nostr WebSocket to the relay app and speak NIP-01. There is no channel, no claim, and nothing to pay. Finding a relay to read from is therefore still the ordinary Nostr problem, solved the ordinary Nostr way -- NIP-65 relay lists and the rest. What a connector answers for is the *write* side: its price and payment facts, on `GET /ilp`.

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

## The Relay Speaks Plain NIP-01

A TOON relay never returns TOON-format strings on a read, despite a persistent myth that it does. The relay returns **standard JSON** `EVENT` messages:

```json
["EVENT", "my-subscription-id", {"id": "…", "pubkey": "…", "created_at": 1756400000, "kind": 1, "tags": [], "content": "…", "sig": "…"}]
```

This is byte-identical to `JSON.stringify(['EVENT', subscriptionId, event])`. Any ordinary Nostr client can read a TOON relay with no decoder, no TOON dependency and no awareness that payment exists anywhere in the system. The relay contains no payment code at all.

Parse it the way you parse any Nostr relay:

```typescript
ws.on('message', (data) => {
  const parsed = JSON.parse(data);
  if (parsed[0] === 'EVENT') {
    const [, subscriptionId, event] = parsed;
    // event is already a standard NostrEvent: { id, pubkey, created_at, kind, tags, content, sig }
  }
});
```

**Do not import `@toon-format/toon` for this.** There is nothing to decode.

### Then Where Does TOON Encoding Live?

On the **write payload**. TOON is an agreement between a **client and an app** about the bytes the connector carries **sealed** inside the ILP packet (ADR 0018). It is more compact than JSON, and it is not connector law — the connector never opens those bytes, so no part of the payment path parses TOON.

**TOON on the way in, plain NIP-01 JSON on the way out.**

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

### Watch a NIP-90 Job Result

```json
["REQ", "job", {"kinds": [6094], "#e": ["<request-event-id-hex>"]}]
```

### Asking a Node What It Charges

Not a subscription. **A connector answers; it never announces** (connector ADR 0022, ADR 0046). Fetch the node's self-description over plain HTTP:

```
GET https://proxy.relay.devnet.toonprotocol.dev/ilp
```

It returns the node's ILP addresses, its settlement facts, and every route's price -- free and unauthenticated (ADR 0050). From the client, `client.describe()` and `client.routePrice(destination)` ask the same question.

**Retired:** `kind:10032` ILP peer info and `kind:10035` / `SkillDescriptor` provider discovery. ADR 0046 removed the announce; there is no replacement subscription, because copying self-descriptions into a discovery network is a controller's job, outside the connector by definition. Do not filter for these kinds -- nothing publishes them.

## Important Considerations

- Relay responses are **standard JSON**. Do not assume a TOON-encoded event, and do not import a decoder for reads.
- Reads do not go through `@toon-protocol/client` at all -- it is the *write* path. Use any ordinary Nostr WebSocket client for `REQ`/`EVENT`/`CLOSE`.
- The fleet relay implements **NIP-01 and NIP-34**. It does not enforce NIP-29 groups, NIP-72 moderation or any other NIP server-side; those are client-side conventions over ordinary events, and the relay stores a signed event like any other.
- NIP-01 NOTICE messages (`["NOTICE", "<message>"]`) are standard string messages from the relay and are not TOON-encoded.
- OK messages (`["OK", "<event-id>", <accepted>, "<message>"]`) follow standard NIP-01 format -- these are relay control messages, not event data.
