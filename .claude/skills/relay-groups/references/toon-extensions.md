# TOON Extensions for Relay Groups

> **Why this reference exists:** NIP-29 relay-based groups interact with TOON's ILP-gated economics in ways that reshape group dynamics. Every group message and admin action costs per-byte, group entry can be ILP-gated, and the combination creates economic incentive structures that differ from free relay groups. This file covers the TOON-specific mechanics and their social implications.

## Publishing Group Events on TOON

All group event publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event, including group-scoped events.

### Publishing Flow for Group Messages

1. **Construct the event:** Build a kind:9 (chat) or kind:11 (thread) event with the `h` tag set to the group ID
2. **Include required tags:** The `["h", "<group-id>"]` tag is mandatory. For kind:11 threads, include `e` tags for reply threading
3. **Sign the event:** Use nostr-tools or equivalent to sign with the agent's private key
4. **Discover pricing:** Check the hosting relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
5. **Calculate fee:** `basePricePerByte * serializedEventBytes` -- the h tag and any other tags contribute to byte count
6. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
7. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`

The event must be sent to the specific relay hosting the group. Sending a group event to a different relay results in rejection even if the ILP payment is valid.

### Publishing Flow for Admin Actions

Admin events (kind:9000-9009) follow the same publishing flow. The relay validates both ILP payment AND admin permissions before accepting the event.

1. **Construct the admin event:** Set the appropriate kind (9000-9009) with the `h` tag and action-specific tags (e.g., `p` tag for add/remove user)
2. **Sign, price, and publish** via the same `publishEvent()` flow
3. **Relay validates permissions:** Even with valid payment, the relay rejects admin events from users without the required permission

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low. Recalculate with actual serialized size.
- **Relay rejection (membership):** The sender is not a group member. Join the group first (for open groups, post a message; for closed groups, use an invite or request admin addition).
- **Relay rejection (permissions):** The sender lacks the required admin permission for the action. Request the permission from a group admin with `add-permission` capability.

## Byte Costs for Group Events

### Group Message Costs

| Event Type | Approximate Size | Cost at 10n/byte |
|-----------|-----------------|------------------|
| kind:9 chat (short) | ~200-400 bytes | ~$0.002-$0.004 |
| kind:9 chat (medium) | ~400-800 bytes | ~$0.004-$0.008 |
| kind:11 thread starter | ~300-600 bytes | ~$0.003-$0.006 |
| kind:11 thread reply | ~350-700 bytes | ~$0.004-$0.007 |

The `h` tag adds approximately 20-40 bytes depending on group ID length. Thread replies include `e` tags adding ~70 bytes each.

### Admin Action Costs

| Event Type | Approximate Size | Cost at 10n/byte |
|-----------|-----------------|------------------|
| kind:9000 (add user) | ~200-300 bytes | ~$0.002-$0.003 |
| kind:9001 (remove user) | ~200-300 bytes | ~$0.002-$0.003 |
| kind:9002 (edit metadata) | ~300-800 bytes | ~$0.003-$0.008 |
| kind:9003 (add permission) | ~250-350 bytes | ~$0.003-$0.004 |
| kind:9005 (delete event) | ~200-300 bytes | ~$0.002-$0.003 |
| kind:9007 (create group) | ~200-400 bytes | ~$0.002-$0.004 |
| kind:9009 (create invite) | ~250-400 bytes | ~$0.003-$0.004 |

Admin actions are relatively cheap individually, but frequent moderation accumulates cost. An admin removing 10 users spends approximately $0.02-$0.03 -- enough to make mass moderation a deliberate decision.

## ILP-Gated Group Entry

On TOON, the relay hosting a group can impose economic barriers beyond social membership:

### Payment Channel Requirement

The hosting relay may require an open ILP payment channel before accepting any events, including group join attempts. This means a new user must:

1. Discover the relay's payment requirements (via `/health` or kind:10032)
2. Open a payment channel with sufficient balance
3. Then attempt to join the group

This economic barrier filters out casual or malicious participants before they even interact with the group.

### Dual-Barrier Model

Closed groups on TOON can enforce two barriers simultaneously:

- **Social barrier:** Admin must add the user (kind:9000) or user must have an invite code (kind:9009)
- **Economic barrier:** User must have an ILP payment channel with the hosting relay

This dual-barrier creates high-trust environments where members have both community approval and economic commitment.

### Economic Dynamics

The per-byte cost model affects group behavior in several ways:

- **Quality floor:** Low-effort messages cost the same per-byte as high-effort ones, but the economic cost discourages throwaway content. Groups naturally trend toward higher-quality discourse.
- **Lurker advantage:** Reading group messages is free. Contributing costs money. This creates an asymmetry where passive observation is economically rational, potentially reducing participation rates.
- **Admin cost weight:** Every moderation action costs money. This discourages impulsive moderation (rage-deleting messages, reactively removing members) and encourages deliberate governance.
- **Spam resistance:** A spam bot in a TOON group must pay per-byte for every spam message. At ~$0.003 per message, 1000 spam messages costs $3 -- a meaningful deterrent compared to free relays.

## TOON-Format Parsing for Group Events

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. To read group events:

1. **Decode the TOON-format response** using the TOON decoder to extract event fields
2. **Check the `h` tag** to identify which group the event belongs to
3. **Parse group state events** (kind:39000, 39001, 39002) to understand current group metadata, admin roles, and membership
4. **Track replaceable events:** Group state events are replaceable -- newer versions supersede older ones. Always use the most recent version.

Reading group events is free on TOON -- no ILP payment required for subscriptions.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers group-specific extensions; the protocol core covers foundational mechanics shared by all event kinds.
