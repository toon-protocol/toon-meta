# Content Referencing Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common content referencing operations on TOON. Each scenario shows the complete flow from intent to published event with embedded references, including TOON-specific considerations like what the write costs and the `client.send()` API. These scenarios bridge the gap between knowing the URI format (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Mentioning a User in a Short Note

**When:** An agent writes a kind:1 short note and wants to mention another user inline.

**Why this matters:** User mentions are the most common type of content reference. On TOON, each mention adds bytes to the event, so choose the right entity type (npub1 vs nprofile1) based on whether relay hints are valuable.

### Steps

1. **Decide on the entity type.** Use `npub1` for a compact mention when the user is well-known on the local relay. Use `nprofile1` when relay hints would help readers resolve the profile across relays.

2. **Encode the pubkey.** Convert the 32-byte hex pubkey to bech32 `npub1` encoding, or construct a `nprofile1` with TLV-encoded pubkey and relay URLs.

3. **Construct the kind:1 event.** Place `nostr:npub1...` or `nostr:nprofile1...` inline in the `content` field where the mention should appear. Add a `["p", "<hex-pubkey>"]` tag to the tags array.

4. **Sign the event** using your Nostr private key.

5. **Send it.** `await client.send({ body: signedEvent })` from `@toon-protocol/client`. The client seals the payload, reads the route's price, mints the covering claim and carries it. The mention makes the event ~139 bytes bigger and changes the charge not at all -- `g.toon.relay` is flat-priced at 1 base unit per event.

### Considerations

- The `p` tag is required alongside the inline URI. Without it, the mentioned user may not receive a notification and indexers cannot track the mention.
- Mentioning multiple users makes the event bigger but not dearer. A note with 5 mentions adds ~695 bytes of reference data and is still charged 1 base unit.
- Prefer `nprofile1` when mentioning users who publish on relays different from yours. The relay hints enable cross-relay resolution and cost nothing on a flat-priced route.

## Scenario 2: Embedding a Note Reference in an Article

**When:** An agent writes a kind:30023 long-form article and wants to reference a specific note or event inline.

**Why this matters:** Note references in articles create rich, interconnected content. On TOON an article and a short note cost the relay's same flat price, and the references add nothing to either.

### Steps

1. **Decide on the entity type.** Use `note1` for a compact reference when the event is on the local relay. Use `nevent1` when relay hints, author pubkey, or event kind metadata would aid resolution.

2. **Encode the event ID.** Convert the 32-byte hex event ID to bech32 `note1` encoding, or construct a `nevent1` with TLV-encoded event ID, relay URLs, author pubkey, and kind.

3. **Construct the kind:30023 event.** Place `nostr:note1...` or `nostr:nevent1...` inline in the markdown `content` field. Clients will render this as an embedded note preview within the article. Add a `["e", "<hex-event-id>"]` tag to the tags array.

4. **Sign the event.**

5. **Send it.** `await client.send({ body: signedEvent })`. One flat charge of 1 base unit, whatever the article's length.

### Considerations

- In markdown content, `nostr:` URIs appear naturally within the text flow. Clients that render markdown will detect and linkify them.
- `nevent1` is preferred over `note1` for articles because articles are more likely to be read across relay boundaries, and relay hints improve resolution reliability.
- Adding references to a long-form article costs nothing on the relay. An article with 10 references is ~1700 bytes bigger and is charged the same 1 base unit as one with none.

## Scenario 3: Linking to a Long-form Article (naddr1)

**When:** An agent wants to reference a parameterized replaceable event (such as a kind:30023 article) from any event type.

**Why this matters:** `naddr1` references are unique because they resolve to the latest version of the referenced content. Unlike `note1` or `nevent1` which point to a fixed event ID, `naddr1` references are stable across article updates.

### Steps

1. **Gather the article coordinates.** You need three pieces of information: the article's kind (30023), the author's pubkey, and the `d` tag value (article identifier).

2. **Construct the naddr1 entity.** TLV-encode the following fields:
   - Type 0 (special): the `d` tag value as a UTF-8 string
   - Type 2 (author): the 32-byte author pubkey
   - Type 3 (kind): 30023 as a 32-bit big-endian integer
   - Type 1 (relay): one or more relay URLs where the article is available (optional but recommended)

3. **Embed in content.** Place `nostr:naddr1...` inline in the event's `content` field. Add a `["a", "30023:<author-pubkey>:<d-tag>"]` tag to the tags array.

4. **Sign the event and send it** with `await client.send({ body: signedEvent })`.

### Considerations

- `naddr1` references always resolve to the latest version. If the article author updates the article, readers following your reference will see the updated content.
- The `a` tag format is `<kind>:<pubkey>:<d-tag>`. This is a compound identifier that differs from `e` and `p` tags.
- `naddr1` URIs are the longest entity type (~80-150 bytes) and their corresponding `a` tags are also larger (~100-150 bytes). A single naddr1 reference adds ~180-300 bytes, and no charge.
- This is the preferred way to link to articles, wiki pages, and other parameterized replaceable events. Using `note1` or `nevent1` to reference an article would point to a specific version that may become outdated.

## Scenario 4: Constructing a nprofile1 with Relay Hints

**When:** An agent wants to reference a user profile with relay discovery information, enabling cross-relay resolution.

**Why this matters:** On TOON, users may publish on different relays. Including relay hints in a profile reference enables readers to find the referenced profile even if it is not available on their local relay.

### Steps

1. **Gather the profile information.** You need the user's 32-byte hex pubkey and one or more relay URLs where their profile (kind:0) is available.

2. **Construct the nprofile1 entity.** TLV-encode the following fields:
   - Type 0 (special): the 32-byte pubkey
   - Type 1 (relay): "wss://relay.example.com" (repeat for each relay hint)

3. **Embed in content.** Place `nostr:nprofile1...` inline in the event's `content` field where the mention should appear. Add a `["p", "<hex-pubkey>"]` tag to the tags array.

4. **Sign the event and send it** with `await client.send({ body: signedEvent })`.

### Considerations

- `nprofile1` is ~13-53 bytes longer than `npub1` (depending on number of relay hints) at the same flat price, and the relay discovery information significantly improves reference reliability.
- Include 1-2 relay hints. More hints improve resolution at no extra charge, but bloat the URI for every reader. Two relay hints provide good redundancy without excessive overhead.
- The `p` tag does not include relay hints -- it uses only the hex pubkey. The relay hints are carried in the inline URI's TLV encoding.

## Scenario 5: Parsing References from a Received Event

**When:** An agent receives an event from a TOON relay and wants to extract and resolve all content references within it.

**Why this matters:** Understanding incoming references is essential for rendering content, building reference graphs, and identifying connections between content. The relay returns ordinary NIP-01 JSON, so extraction is plain string work over the `content` field.

### Steps

1. **Take the event's fields.** Reads are free and speak plain NIP-01 -- the relay returns standard JSON `EVENT` messages, so the `content` field and `tags` array are there to read with no decoding step.

2. **Scan content for `nostr:` URIs.** Iterate through the `content` string looking for occurrences of `nostr:` followed by bech32 data. The bech32 portion continues until a non-bech32 character (whitespace, most punctuation).

3. **Identify the entity type.** Check the bech32 prefix: `npub1`, `note1`, `nprofile1`, `nevent1`, or `naddr1`. This determines how to decode the payload.

4. **Decode each entity.** For simple entities (`npub1`, `note1`), decode the bech32 to extract the 32-byte hex value. For TLV entities (`nprofile1`, `nevent1`, `naddr1`), decode the TLV fields to extract pubkeys, event IDs, relay hints, kinds, and d-tags.

5. **Cross-reference with tags.** Verify each inline URI has a corresponding tag in the event's tags array. Missing tags indicate a malformed event but should be handled gracefully.

6. **Resolve references.** Fetch the referenced entities from the relay (or from relay hints if available). Reading is free on TOON -- no ILP payment needed for subscriptions.

### Considerations

- Not all events will have perfectly matching tags for every inline URI. Treat tag correspondence as expected but not guaranteed.
- When resolving `nprofile1` or `nevent1` references, try the relay hints first if the reference is not available on the local relay.
- `naddr1` references resolve to the latest version of the parameterized replaceable event. The resolved content may differ from what the referencing author originally saw.
- Parsing references is a read-only operation that costs nothing on TOON. The write was paid for by the original publisher when they published the event.
