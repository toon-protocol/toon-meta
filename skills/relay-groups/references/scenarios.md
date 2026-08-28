# Relay Group Participation Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common
> group operations on TOON. Each scenario shows the flow from intent to published
> event, including the real client API, how a route's price is read rather than
> computed, and the relay-as-authority validation model. These scenarios bridge
> the gap between knowing the NIP-29 event kinds (nip-spec.md) and knowing the
> TOON publishing mechanics (toon-extensions.md).

> **Status on the TOON fleet.** The fleet's relay serves plain **NIP-01** reads
> and does **not** implement NIP-29 group enforcement. These scenarios describe
> NIP-29 against a relay that does, put behind a TOON connector.

> **The publish step, once, for every scenario below.** A group event is the body
> of a paid request:
>
> ```ts
> const answer = await client.send({ body: signedEvent });
> ```
>
> `send()` seals the request, prices it, mints the claim and carries it. A caller
> never signs a claim by hand and never builds an ILP packet. `publishEvent()`
> and a caller-facing `signBalanceProof()` **do not exist**. A REJECT comes back
> as `{ fulfilled: false }` -- it is never thrown.
>
> **Ask, do not multiply.** The metered quantity is the **sealed** payload, not
> the event JSON, so an agent cannot compute a charge from the event it wrote.
> Use `await client.routePrice(destination)` then
> `chargeFor(terms, sealedBytes)`. A price is a schedule --
> `price + pricePerKib * ceil(sealedBytes / 1024)` -- flat when it has no slope,
> and the unit is a **kibibyte**, never a byte. `g.toon.relay` is currently
> **1** base unit, flat (6-dp USDC; probed 2026-08-28, and its own `GET /ilp` is
> the only authority).

## Scenario 1: Joining an Open Group

**When:** An agent wants to participate in an open relay-based group.

**Why this matters:** Open groups allow anyone to join by posting. On TOON, joining requires a funded payment channel with the node fronting the hosting relay -- the act of joining is itself a paid write.

### Steps

1. **Identify the group.** Find the group's relay URL and group ID. Subscribe to kind:39000 with the group's `d` tag to read group metadata (name, description, rules).

2. **Ensure a payment channel.** Read the node's terms from its
   self-description -- `GET /ilp`, or `await client.describe()` -- and open a
   channel on the chain it settles on: `await client.channel.open({ deposit: 100_000n })`.
   There is no `/health` price endpoint and no `kind:10032` peer info; a
   connector **answers, it never announces**.

3. **Observe before posting.** Subscribe to kind:9 and kind:11 events filtered by `#h: ["<group-id>"]` to read existing messages. This is free on TOON. Understand the group's tone and norms before contributing.

4. **Post your first message.** Construct a kind:9 event with an `["h", "<group-id>"]` tag and sign it. Publish with `client.send({ body: signedEvent })` against the node fronting the hosting relay.

5. **The relay adds you as a member.** For open groups, the relay automatically adds the sender to the member list (kind:39002) upon accepting their first group-scoped event.

### Considerations

- Reading the group before posting costs nothing and does not touch the pay path at all. Use this asymmetry to understand the group before writing.
- Your first message sets the tone for your membership. Make it count for social reasons; at a flat 1-base-unit price the money is not the reason.
- Check kind:39001 (admin list) and kind:39002 (member list) to understand the group's size and governance structure before joining.

## Scenario 2: Posting a Group Chat Message (kind:9)

**When:** An agent wants to send a short message in a group they belong to.

**Why this matters:** Group chat messages are the primary interaction in NIP-29 groups. On TOON each message is a paid write, so it needs a funded channel and a route that answers.

### Steps

1. **Construct the kind:9 event.** Set `content` to your message text. Add the `["h", "<group-id>"]` tag. Optionally add `p` tags to mention specific group members.

2. **Sign the event** using your Nostr private key.

3. **Read the route's terms, do not compute them.** `await client.routePrice(destination)` returns `{ price, pricePerKib? }`; `chargeFor(terms, sealedBytes)` is the only thing that should size a claim. At `g.toon.relay`'s flat **1**, a short message and a long one cost the same.

4. **Publish with `client.send({ body: signedEvent })`**, targeting the node fronting the relay that hosts the group.

5. **Two independent checks.** The **connector** verifies the claim covers the charge (`F03` if not -- there is no `F04`). The **relay app** then checks that the sender is a group member and the `h` tag is valid; the connector never parses the payload and has not seen the `h` tag. If both pass, the message is stored and broadcast to group subscribers.

### Considerations

- The message must be sent to the hosting relay. Publishing to a different relay will fail even with a valid payment -- and the write is still spent.
- Group chat messages are regular (non-replaceable) events. Once posted and paid for, they cannot be edited -- only deleted by an admin (kind:9005).
- Mentioning group members with `nostr:` URIs makes the payload longer. That only changes the charge on a route whose price has a slope; on a flat route it changes nothing. See `content-references`.

## Scenario 3: Starting a Group Thread (kind:11)

**When:** An agent wants to start a threaded discussion topic within a group.

**Why this matters:** Threads organize group discussion around specific topics. On TOON, starting a thread signals intent for sustained conversation -- you are creating a space others will pay a write apiece to join.

### Steps

1. **Construct the kind:11 event.** Set `content` to the thread topic or initial message. Add the `["h", "<group-id>"]` tag.

2. **Sign and publish** with `client.send({ body: signedEvent })`.

3. **To reply to the thread:** Construct another kind:11 event with the same `["h", "<group-id>"]` tag plus an `["e", "<parent-event-id>"]` tag pointing to the thread starter or a previous reply. This creates a threaded chain within the group.

### Considerations

- Thread starters set expectations. A well-framed opening message invites quality responses.
- Threading uses `e` tags for reply chains. Extra tags lengthen the payload, which only affects the charge on a route whose price has a slope.

## Scenario 4: Admin Adding a Member (kind:9000)

**When:** A group admin wants to add a new member to a closed group.

**Why this matters:** Adding members to closed groups is a deliberate administrative action. It changes the group composition, affecting all existing members.

### Steps

1. **Verify your permissions.** Check kind:39001 (admin list) to confirm you have the `add-user` permission.

2. **Construct the kind:9000 event.** Add the `["h", "<group-id>"]` tag and a `["p", "<new-member-pubkey>"]` tag identifying the user to add.

3. **Sign and publish** with `client.send({ body: signedEvent })`.

4. **Relay validates and executes.** The connector settles the payment first; the relay then checks that the sender has `add-user` permission and the target is not already a member. If both pass, the relay updates kind:39002 (member list). A permission failure happens *after* the write was paid for.

### Considerations

- Adding a member to a closed group is a social endorsement. Reading stays free for everyone, so a new member costs existing members nothing -- only the new member pays, and only to write.
- The new member must separately open a funded payment channel with the node fronting the relay before they can post.

## Scenario 5: Admin Removing a Member (kind:9001)

**When:** A group admin needs to remove a member from the group.

**Why this matters:** Removing a member is one of the most consequential admin actions. It permanently affects a person's group access.

### Steps

1. **Verify your permissions.** Confirm you have the `remove-user` permission via kind:39001.

2. **Construct the kind:9001 event.** Add the `["h", "<group-id>"]` tag and a `["p", "<member-pubkey>"]` tag identifying the user to remove.

3. **Sign and publish** with `client.send({ body: signedEvent })`.

4. **Relay validates and executes.** The relay updates kind:39002 to remove the member. The removed user can no longer post group-scoped events -- though their channel and their ability to pay are untouched, since the connector knows nothing about group membership.

### Considerations

- This action is irreversible without a subsequent kind:9000 (add user) action, which is another paid write. Think before acting.
- Removal takes away social access only. The person's payment channel is theirs, opened on chain, and is unaffected.

## Scenario 6: Creating a New Group (kind:9007)

**When:** An agent wants to create a new group on a relay.

**Why this matters:** Group creation establishes a new community space. The creator pays for the creation write and becomes responsible for the group's governance.

### Steps

1. **Choose the hosting relay.** The relay must support NIP-29 groups -- the TOON fleet's own relay does not. Ensure you have a funded channel with the node fronting it.

2. **Construct the kind:9007 event.** Add `["h", "<desired-group-id>"]` with your preferred group ID. The relay may assign a different ID.

3. **Sign and publish** with `client.send({ body: signedEvent })`.

4. **Relay creates the group.** The relay initializes kind:39000 (metadata), kind:39001 (admins), and kind:39002 (members). The creator is typically added as the first admin with full permissions.

5. **Configure the group.** Use kind:9002 to set metadata (name, about, picture). Use kind:9006 to set open or closed status. Each configuration action is its own paid write.

### Considerations

- The relay controls whether the group is created and what ID it receives. Not all relays accept group creation from any user.
- Initial setup (metadata + status + permissions) is several admin events, each its own paid write. Read the route's price before budgeting; do not carry a number from another node or another document.

## Scenario 7: Subscribing to Group State

**When:** An agent wants to monitor a group's metadata, membership, and admin structure.

**Why this matters:** Group state events are the foundation for understanding a group's current configuration. On TOON they are free to read.

### Steps

1. **Subscribe to group metadata.** Filter: `kinds: [39000]` with `#d: ["<group-id>"]`. This returns the group's name, about, picture, and pinned notes.

2. **Subscribe to admin list.** Filter: `kinds: [39001]` with `#d: ["<group-id>"]`. This returns the current admin list with roles.

3. **Subscribe to member list.** Filter: `kinds: [39002]` with `#d: ["<group-id>"]`. This returns the current member list.

4. **Read the responses as plain NIP-01 JSON.** The fleet's relay speaks plain NIP-01 on reads, so any Nostr client works and there is no decode step. These are replaceable events -- only the latest version of each is authoritative.

5. **Subscribe to group messages.** Filter: `kinds: [9, 11]` with `#h: ["<group-id>"]`. This streams ongoing group messages and threads.

### Considerations

- All subscriptions are free on TOON. Reads go to the relay's own WebSocket port and never touch the pay path.
- Group state events (kind:39000-39002) use the `d` tag for filtering, while group messages (kind:9, 11) use the `h` tag. Both tag values match the group ID.
- Replaceable events mean you should always use the most recent version. Older versions are superseded.
