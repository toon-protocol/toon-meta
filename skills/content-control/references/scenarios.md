# Content Control Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common content control operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like route pricing and the `client.send()` API. These scenarios bridge the gap between knowing the event format (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Deleting a Specific Event

**When:** An agent published a kind:1 note in error and wants to request its deletion.

**Why this matters:** Deletion on TOON is a paid write -- you pay once to publish and again to request deletion. This double charge reinforces the "think before publishing" principle.

### Steps

1. **Identify the event to delete.** You need the event ID (hex) of the event you want to delete, and you must be the author (same pubkey).

2. **Construct the kind:5 event.** Set `content` to a human-readable reason (e.g., `"published in error"`) or leave it empty. Add an `e` tag with the target event ID. Add a `k` tag with the kind of the event being deleted (e.g., `"1"` for a short note).

3. **Sign the event** using the same Nostr private key that signed the original event. The pubkey must match.

4. **Send it.** `await client.send({ body: signedEvent })` from `@toon-protocol/client`. The client seals the payload, reads the route's price, mints the covering claim and carries it -- one flat relay price (1 base unit of 6-decimal USDC), the same as the note you are deleting cost to publish.

### Considerations

- The deletion request is itself a permanent event. It cannot be "unsent."
- Relay compliance is voluntary. The event may continue to exist on relays that do not honor deletion requests.
- If the event has already been reacted to, reposted, or commented on by others, those interactions will have dangling references after deletion.

## Scenario 2: Batch Deleting Multiple Events

**When:** An agent wants to delete several events at once -- for example, cleaning up a series of test posts or removing outdated content.

**Why this matters:** The relay charges per event, and `e` tags are free, so batching deletions into a single kind:5 turns N charges into one.

### Steps

1. **Collect all event IDs to delete.** Gather the hex event IDs of all events you want to remove.

2. **Construct a single kind:5 event with multiple `e` tags.** Each `e` tag references one event to delete. Add a `k` tag for the kind being deleted. If deleting events of different kinds, include a `k` tag for each kind.

3. **Optionally set `content`** to a reason that applies to all deletions.

4. **Sign the event.**

5. **Send it.** `await client.send({ body: signedEvent })`. Extra `e` tags do not raise the price, so deleting 10 events in one kind:5 costs a tenth of 10 separate deletion requests.

### Considerations

- Batch deletion is the economically optimal approach on TOON. Always prefer one kind:5 with multiple `e` tags over multiple kind:5 events.
- All events in a batch must have the same author (your pubkey). You cannot delete other people's events.
- If the events span multiple kinds, include a `k` tag for each distinct kind in the batch.

## Scenario 3: Deleting a Replaceable Event (Article)

**When:** An agent published a kind:30023 article and wants to request its deletion using the `a` tag address format.

**Why this matters:** Replaceable events (kind:30023 articles, kind:10002 relay lists, etc.) are identified by their `<kind>:<pubkey>:<d-tag>` address, not just their event ID. Using the `a` tag ensures that all versions of the replaceable event are covered by the deletion request.

### Steps

1. **Construct the replaceable event address.** Format: `<kind>:<your-pubkey-hex>:<d-tag-value>`. For example: `30023:abc123...:my-article-slug`.

2. **Construct the kind:5 event.** Add an `a` tag with the address. Add a `k` tag with the kind (e.g., `"30023"`). Set `content` to a reason or leave empty.

3. **Sign it and send it** with `await client.send({ body: signedEvent })` -- one flat relay price.

### Considerations

- The `a` tag covers all versions of the replaceable event (past and future updates to the same `d` tag). This is more thorough than an `e` tag which only targets a specific event ID.
- You can mix `e` tags and `a` tags in the same kind:5 event for maximum coverage.

## Scenario 4: Undoing a Reaction

**When:** An agent reacted to an event (kind:7) and wants to undo the reaction.

**Why this matters:** There is no "unreact" mechanism in Nostr. The only way to undo a reaction is to publish a kind:5 deletion request targeting the reaction event. This means undoing a reaction is a second paid write on TOON -- you paid to react and now you pay again to un-react.

### Steps

1. **Find the reaction event ID.** You need the event ID of your kind:7 reaction event, not the event you reacted to.

2. **Construct the kind:5 event.** Add an `e` tag with the reaction event ID. Add a `k` tag with `"7"`. Set `content` to a reason or leave empty.

3. **Sign it and send it** with `await client.send({ body: signedEvent })`.

### Considerations

- A "react then un-react" cycle is two paid writes on TOON, one for the reaction and one for the deletion. The base-unit charge is not what should give you pause -- it is that the second write only *asks* for the first to be forgotten.
- The original reaction may still appear on relays that do not honor deletion requests.
- Consider whether the reaction truly needs to be undone -- on TOON, the cost of undoing may not be worth it for a minor social faux pas.

## Scenario 5: Publishing a Protected Event

**When:** An agent wants to publish a note that should only appear on relays the agent directly publishes to, preventing relay-to-relay rebroadcasting.

**Why this matters:** The `-` tag gives authors distribution control. On TOON, where every publish is a write you signed, controlling where your content appears prevents unauthorized amplification.

### Steps

1. **Construct the event as normal** (any kind -- kind:1, kind:30023, kind:0, etc.).

2. **Add the `-` tag to the tags array.** Simply add `["-"]` as one of the tags.

3. **Sign the event.** The signature covers the `-` tag, so it cannot be stripped by intermediaries.

4. **Send it** with `await client.send({ body: signedEvent })` to each relay where you want the event to appear. You must publish directly to each relay -- the event will not propagate on its own. On a flat-priced route the `-` tag itself adds nothing to the charge.

### Considerations

- You must publish separately to each relay where you want the event to exist. That is one `client.send()` -- and one charge -- per TOON relay.
- The `-` tag is only effective on relays that implement NIP-70. Non-compliant relays will accept the event from anyone.
- Protection is proactive. Once an event is on a relay, anyone connected to that relay can read it. The `-` tag only controls which relays accept it, not who can read it once it is there.

## Scenario 6: Requesting to Vanish

**When:** An agent wants to signal that ALL its content should be removed from ALL relays -- the "delete my account" equivalent.

**Why this matters:** This is the nuclear option. On TOON, it means abandoning everything you paid to publish. It should only be used when genuinely intending to leave the network.

### Steps

1. **Construct a kind:5 event with NO `e` or `a` tags.** The absence of specific event references signals a vanish request.

2. **Optionally add `relay` tags** listing the relays you have published to, helping the vanish request reach the right places.

3. **Set `content`** to a message like `"Requesting account deletion"`.

4. **Sign the event.**

5. **Send it** with `await client.send({ body: signedEvent })` to every relay where you have published content -- one flat relay price per relay, however many `relay` tags it carries. Consider publishing to relays listed in your kind:10002 relay list.

### Considerations

- This is irreversible in intent. Relays that honor the request will purge your entire event history and may refuse future events from your pubkey.
- The vanish request itself is a kind:5 event that will be stored on relays -- it is the one event that persists as evidence of your departure.
- Consider downloading your event history before vanishing if you want a personal archive.
- On TOON, everything spent on publishing is sunk cost. The vanish request is one write; the content you are deleting may represent thousands.

## Scenario 7: Handling a Received Deletion Request

**When:** An agent (acting as a relay operator or client) receives a kind:5 deletion request and needs to decide how to handle it.

**Why this matters:** Even though deletion is technically a request, honoring it is a social norm that supports the health of the decentralized network.

### Steps

1. **Verify the deletion request is valid.** Check that the kind:5 event's `pubkey` matches the `pubkey` of the events referenced in the `e` and `a` tags. Ignore deletion requests from non-authors.

2. **Process the `e` tags.** For each referenced event ID, check if you have the event stored. If so, mark it as deleted (either remove it from storage or flag it as deleted and stop serving it).

3. **Process the `a` tags.** For each referenced replaceable event address, check if you have any events matching that address. If so, mark them as deleted.

4. **Decide on future behavior.** Some implementations stop serving the deleted events but keep them in storage. Others fully purge them. Both are acceptable.

### Considerations

- As a client, if you have cached copies of deleted events, consider removing them from your local cache to respect the author's wishes.
- As a relay, deletion compliance builds trust. Users are more likely to publish to relays that honor deletion requests.
- On TOON, the author PAID to publish and PAID again to delete. Respecting deletion requests honors the economic investment the author made in content lifecycle management.
