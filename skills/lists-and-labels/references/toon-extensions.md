# TOON Extensions for List and Label Events

> **Why this reference exists:** Lists and labels on TOON differ from vanilla Nostr because every list update and label publish is a paid write. This file covers TOON-specific considerations for NIP-51 list events and NIP-32 label events -- publishing flow, what the relay actually charges, what replaceable semantics do and do not cost, and the economic dynamics that make curation deliberate.

## Publishing Lists and Labels on TOON

All list and label publishing on TOON goes through `send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires payment for every event.

### Publishing Flow

1. **Construct the event:** Build the list or label event with appropriate kind, tags, and content
2. **Encrypt private entries (lists only):** Use NIP-44 to encrypt private tag entries into the `.content` field using your own key pair
3. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
4. **Send it:** `await client.send({ body: signedEvent })`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step.

Agents never construct ILP packets and never sign a claim by hand.

TOON is the encoding of that sealed write payload -- what the client and the app agree the connector carries inside the ILP packet. It is not the format a relay serves on a read: TOON format on the way in, plain NIP-01 JSON on the way out.

### Asking for the Price in Advance

You rarely need to: `send()` prices the packet itself. Where a skill or an agent genuinely needs the terms up front:

```ts
const terms = await client.routePrice(destination); // { price, pricePerKib? }
const charge = chargeFor(terms, sealedBytes);       // from @toon-protocol/client
```

A route's price is a schedule over payload length: flat when it has no slope, otherwise `price + pricePerKib * ceil(sealedBytes / 1024)`. The metered quantity is the **sealed** payload -- the gift-wrapped bytes the PREPARE carries -- not the event JSON you serialized, which is smaller by the envelope and the wrap. An agent therefore cannot compute a charge from the event it wrote.

A node's own terms, including every route's price, come from `GET /ilp` on the node's URL: free, unauthenticated, and answered on request. A connector answers; it never announces. An unpaid request to a priced route is answered with a **greeting** carrying that route's terms.

### Error Handling

- **`F03` INVALID_AMOUNT:** the claim does not cover the charge -- underpayment. Read the route's terms with `routePrice()` and retry.
- **`T04`:** over the peering's cap. The message states the cap; that message is the only way a sender learns it.
- **`F02` / `T01`:** nothing routes that name / the peer was not there.
- **Relay rejection:** the event was malformed (invalid signature, wrong kind structure, missing required tags). Fix the event and republish.

A REJECT comes back as `{ fulfilled: false }` and is never thrown.

## What a List Update Actually Costs

### The relay route is flat

Nostr event publishing terminates at `g.toon.relay`, whose price is **1 base unit of 6-decimal USDC, flat** -- no slope, no per-kibibyte component. A one-entry pin list and a 14 KiB mute list with 200 muted pubkeys cost exactly the same.

This kills a whole genre of advice that used to appear here. Size does not change the price, so:

- Splitting a large list across several events saves nothing.
- Pruning stale entries is good hygiene, not a saving.
- No list kind is cheaper than another because its events are smaller.
- There is no arithmetic to do before publishing, and none an agent could do correctly anyway (the metered quantity is the sealed payload, not the event JSON).

Blob storage is the exception, and it is a different route: `g.toon.store` / `g.toon.relay.store` prices at `1000 + 10 per KiB` of sealed payload, so a small blob costs roughly 1010 base units. Lists and labels do not go there.

### What replaceable semantics do cost

Replaceable lists (kind:10000, kind:10001) and parameterized replaceable lists (kind:30000, kind:30003) republish the ENTIRE list on every update. That is a real property with real consequences -- but the consequence is not a bigger bill.

- The relay retains exactly **one version** per pubkey + kind + `d` tag. Older versions are discarded, so a long history of list edits does not accumulate on the relay the way a stream of regular events does.
- You pay **once per update**, not per retained version, and not per entry.
- The only quantity that scales your spend is therefore the **number of updates you publish**.

Each `d`-tagged set is an independent slot: updating the "developers" follow set neither touches nor re-charges the "artists" one.

### Batching

Batching several changes into one update still turns N publishes into one, so it still saves N-1 base units. At 1 base unit per publish that is a saving of microdollars, which is almost never worth a delay. Batch when the changes are already in hand; do not sit on a mute you want applied now in order to save a fraction of a cent.

### Labels accumulate

kind:1985 events are regular events, not replaceable ones. Each label is a separate permanent event and a separate flat-priced payment, and no label ever replaces another. Labels are individually cheap; the spend grows with how many you publish, not with how big any one of them is.

## Reading Lists and Labels (free, plain NIP-01)

Reading lists and labels is free on TOON and speaks plain NIP-01. The relay returns standard JSON `EVENT` messages, so any ordinary Nostr client can fetch a list or a label; a free read never touches a connector and the relay itself holds no payment code.

### Reading List Events

For list events with private entries:

1. Subscribe with the appropriate NIP-01 filter and take the `EVENT` payload as ordinary JSON
2. Parse the `.tags` array for public entries
3. Decrypt the `.content` field using NIP-44 with the list owner's key pair
4. Parse the decrypted content as a JSON array of tag arrays
5. Merge public and private entries for the complete list

### Reading Label Events

Labels have no encrypted content, so reading is simpler:

1. Subscribe with appropriate filters (by target event, namespace, or author)
2. Read the `EVENT` payload as ordinary JSON
3. Extract `L` tags for namespaces and `l` tags for label values

## ILP Considerations

### List Updates and Channel Balance

Frequent list updates consume channel balance faster than occasional publishes -- one base unit at a time. An agent maintaining active mute and bookmark lists should monitor its channel balance and top up before it runs low, but it does not need to budget by list size: a large list is no more expensive to publish than a small one.

### Label Publishing and Routing

Label events route through the network like any other publish, and the relay's flat route charges the same for them as for anything else. Multi-hop routing adds a per-packet fee that belongs to each peering, not to the route and not to the payload.

## Integration with Protocol Core

For the complete TOON write model and read model, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers list/label-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
