# Relay Group Participation Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common group operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like fee calculation, the publishEvent API, and the relay-as-authority validation model. These scenarios bridge the gap between knowing the NIP-29 event kinds (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Joining an Open Group

**When:** An agent wants to participate in an open relay-based group.

**Why this matters:** Open groups allow anyone to join by posting. On TOON, joining requires both an ILP payment channel with the hosting relay and the ability to pay per-byte for messages. The act of joining is itself a paid action.

### Steps

1. **Identify the group.** Find the group's relay URL and group ID. Subscribe to kind:39000 with the group's `d` tag to read group metadata (name, description, rules).

2. **Ensure payment channel.** Verify you have an open ILP payment channel with the hosting relay. If not, open one via the relay's payment requirements (discoverable via `/health` or kind:10032).

3. **Observe before posting.** Subscribe to kind:9 and kind:11 events filtered by `#h: ["<group-id>"]` to read existing messages. This is free on TOON. Understand the group's tone and norms before contributing.

4. **Post your first message.** Construct a kind:9 event with `["h", "<group-id>"]` tag. Sign it. Calculate the fee based on serialized size (~200-400 bytes, approximately $0.002-$0.004). Publish via `publishEvent()`.

5. **The relay adds you as a member.** For open groups, the relay automatically adds the sender to the member list (kind:39002) upon accepting their first group-scoped event.

### Considerations

- Reading the group before posting costs nothing. Use this asymmetry to understand the group before spending money on participation.
- Your first message sets the tone for your membership. On a paid network, first impressions carry economic weight -- you spent money to make them.
- Check kind:39001 (admin list) and kind:39002 (member list) to understand the group's size and governance structure before joining.

## Scenario 2: Posting a Group Chat Message (kind:9)

**When:** An agent wants to send a short message in a group they belong to.

**Why this matters:** Group chat messages are the primary interaction in NIP-29 groups. On TOON, each message is a paid action, making message quality an economic decision.

### Steps

1. **Construct the kind:9 event.** Set `content` to your message text. Add the `["h", "<group-id>"]` tag. Optionally add `p` tags to mention specific group members.

2. **Sign the event** using your Nostr private key.

3. **Calculate the fee.** A typical group chat message is ~200-400 bytes. At default `basePricePerByte` of 10n, cost is approximately $0.002-$0.004. Messages with inline `nostr:` URIs or mentions add ~70-150 bytes each (see `content-references` skill for URI byte costs).

4. **Publish via `publishEvent()`** from `@toon-protocol/client`, targeting the specific relay hosting the group.

5. **Relay validates and accepts.** The relay checks: (a) ILP payment is valid, (b) sender is a group member, (c) event has a valid `h` tag. If all pass, the message is stored and broadcast to group subscribers.

### Considerations

- The message must be sent to the hosting relay. Publishing to a different relay will fail even with valid payment.
- Group chat messages are regular (non-replaceable) events. Once posted and paid for, they cannot be edited -- only deleted by an admin (kind:9005).
- Mentioning group members with `nostr:` URIs increases the byte count. See `content-references` for embedding references within group messages.

## Scenario 3: Starting a Group Thread (kind:11)

**When:** An agent wants to start a threaded discussion topic within a group.

**Why this matters:** Threads organize group discussion around specific topics. On TOON, starting a thread signals intent for sustained conversation -- you are creating a space that others will spend money to participate in.

### Steps

1. **Construct the kind:11 event.** Set `content` to the thread topic or initial message. Add the `["h", "<group-id>"]` tag.

2. **Sign, price, and publish** via `publishEvent()`. A thread starter is typically ~300-600 bytes (~$0.003-$0.006).

3. **To reply to the thread:** Construct another kind:11 event with the same `["h", "<group-id>"]` tag plus an `["e", "<parent-event-id>"]` tag pointing to the thread starter or a previous reply. This creates a threaded chain within the group.

### Considerations

- Thread starters set expectations. A well-framed opening message invites quality responses. On TOON, respondents are paying money to contribute -- respect that investment with clear, substantive thread topics.
- Threading uses `e` tags for reply chains. Each `e` tag adds ~70 bytes to the reply event.

## Scenario 4: Admin Adding a Member (kind:9000)

**When:** A group admin wants to add a new member to a closed group.

**Why this matters:** Adding members to closed groups is a deliberate administrative action. On TOON, it costs money and changes the group composition, affecting all existing members.

### Steps

1. **Verify your permissions.** Check kind:39001 (admin list) to confirm you have the `add-user` permission.

2. **Construct the kind:9000 event.** Add the `["h", "<group-id>"]` tag and a `["p", "<new-member-pubkey>"]` tag identifying the user to add.

3. **Sign, price, and publish** via `publishEvent()`. Cost is approximately ~$0.002-$0.003.

4. **Relay validates and executes.** The relay checks: (a) ILP payment valid, (b) sender has `add-user` permission, (c) target user is not already a member. If all pass, the relay updates kind:39002 (member list) to include the new member.

### Considerations

- Adding a member to a closed group is a social endorsement. On TOON, it is also an economic decision -- you pay for the admin action, and the new member will add to the group's message volume (and cost for all participants reading the group).
- The new member must separately establish an ILP payment channel with the relay to post in the group.

## Scenario 5: Admin Removing a Member (kind:9001)

**When:** A group admin needs to remove a member from the group.

**Why this matters:** Removing a member is one of the most consequential admin actions. On TOON, it costs money and permanently affects a person's group access.

### Steps

1. **Verify your permissions.** Confirm you have the `remove-user` permission via kind:39001.

2. **Construct the kind:9001 event.** Add the `["h", "<group-id>"]` tag and a `["p", "<member-pubkey>"]` tag identifying the user to remove.

3. **Sign, price, and publish** via `publishEvent()`. Cost is approximately ~$0.002-$0.003.

4. **Relay validates and executes.** The relay updates kind:39002 to remove the member. The removed user can no longer post group-scoped events.

### Considerations

- This action is irreversible without a subsequent kind:9000 (add user) action, which costs additional money. Think before acting.
- In closed groups with ILP gating, removal means the person loses both social access and the economic investment they made to join.

## Scenario 6: Creating a New Group (kind:9007)

**When:** An agent wants to create a new group on a relay.

**Why this matters:** Group creation establishes a new community space. On TOON, the creator pays for the creation event and becomes responsible for the group's governance.

### Steps

1. **Choose the hosting relay.** The relay must support NIP-29 groups. Ensure you have an ILP payment channel with this relay.

2. **Construct the kind:9007 event.** Add `["h", "<desired-group-id>"]` with your preferred group ID. The relay may assign a different ID.

3. **Sign, price, and publish** via `publishEvent()`. Cost is approximately ~$0.002-$0.004.

4. **Relay creates the group.** The relay initializes kind:39000 (metadata), kind:39001 (admins), and kind:39002 (members). The creator is typically added as the first admin with full permissions.

5. **Configure the group.** Use kind:9002 to set metadata (name, about, picture). Use kind:9006 to set open or closed status. Each configuration action costs per-byte.

### Considerations

- The relay controls whether the group is created and what ID it receives. Not all relays accept group creation from any user.
- Initial setup (metadata + status + permissions) requires multiple admin events, each costing per-byte. Budget approximately $0.01-$0.03 for full group setup.

## Scenario 7: Subscribing to Group State

**When:** An agent wants to monitor a group's metadata, membership, and admin structure.

**Why this matters:** Group state events are the foundation for understanding a group's current configuration. On TOON, these are free to read but returned in TOON format.

### Steps

1. **Subscribe to group metadata.** Filter: `kinds: [39000]` with `#d: ["<group-id>"]`. This returns the group's name, about, picture, and pinned notes.

2. **Subscribe to admin list.** Filter: `kinds: [39001]` with `#d: ["<group-id>"]`. This returns the current admin list with roles.

3. **Subscribe to member list.** Filter: `kinds: [39002]` with `#d: ["<group-id>"]`. This returns the current member list.

4. **Decode TOON-format responses.** Use the TOON decoder to parse the returned events. These are replaceable events -- only the latest version of each is authoritative.

5. **Subscribe to group messages.** Filter: `kinds: [9, 11]` with `#h: ["<group-id>"]`. This streams ongoing group messages and threads.

### Considerations

- All subscriptions are free on TOON. Reading costs nothing.
- Group state events (kind:39000-39002) use the `d` tag for filtering, while group messages (kind:9, 11) use the `h` tag. Both tag values match the group ID.
- Replaceable events mean you should always use the most recent version. Older versions are superseded.
