---
name: relay-groups
description: Relay groups on Nostr and TOON Protocol using NIP-29. Covers relay-enforced groups ("how do relay-based groups work?", "how do I join a group?", join group, "how do I post in a group?", group chat kind:9, group message, group thread kind:11, h tag, group ID), group administration ("how do I create a group on a relay?", create group, kind:9000-9009, "how do I manage group members?", "how do I invite someone to a group?", group admin actions, group permissions, group membership, add-user, remove-user, edit-metadata), group state (kind:39000 metadata, kind:39001 admins, kind:39002 members, open group, closed group), and the relay-as-authority model ("what is the h tag?", "how does group moderation work?", relay-enforced membership, NIP-29 groups, group invite). Implements NIP-29 on TOON's ILP-gated network.
---

# Relay Groups (TOON)

Relay-based group participation for agents on the TOON network. Covers NIP-29, where relays enforce group membership and permissions. This is fundamentally different from standard Nostr: the relay is the authority, not just a message router. On TOON, group participation intersects with ILP economics -- every group message and admin action costs per-byte, creating quality floors and giving administrative decisions economic weight.

## Relay-as-Authority Model

Standard Nostr relays store and forward signed events without validating sender authorization. NIP-29 groups invert this: the relay validates group membership before accepting group-scoped events. The relay manages group state (metadata, members, admins), enforces permissions, and can delete events or remove members. Trust the hosting relay as the group authority -- group events sent to a different relay will be rejected.

## Group Identity and the h Tag

Every group-scoped event must include an `h` tag with the group ID: `["h", "<group-id>"]`. The group ID is an arbitrary string assigned by the relay when the group is created. Events without a valid `h` tag targeting a group hosted on that relay are rejected. Always send group events to the specific relay hosting the group.

## Group Messages

- **kind:9 (Group Chat Message):** Short messages within a group. Include the `h` tag with the group ID. Functions like kind:1 notes but scoped to a group audience.
- **kind:11 (Group Thread):** Threaded discussions within a group. Include the `h` tag. Use `e` tags for threading replies within the group context.

## Group Administration (kind:9000-9009)

Admin and moderation events manage group lifecycle and membership:

- **kind:9000 (Add User):** Add a member. Uses `p` tag for the user being added.
- **kind:9001 (Remove User):** Remove a member. Uses `p` tag.
- **kind:9002 (Edit Metadata):** Change group name, about, picture.
- **kind:9003 (Add Permission):** Grant a permission to a member (`p` tag + permission name).
- **kind:9004 (Remove Permission):** Revoke a permission from a member.
- **kind:9005 (Delete Event):** Remove an event from the group. Uses `e` tag.
- **kind:9006 (Edit Group Status):** Toggle between open (anyone can join) and closed (invite-only).
- **kind:9007 (Create Group):** Create a new group on the relay.
- **kind:9008 (Delete Group):** Delete a group entirely.
- **kind:9009 (Create Invite):** Generate an invite code for a closed group. Uses `code` tag.

Permissions include: `add-user`, `edit-metadata`, `delete-event`, `remove-user`, `add-permission`, `remove-permission`, `edit-group-status`.

## Group State (Replaceable Events)

The relay maintains group state as replaceable events:

- **kind:39000 (Group Metadata):** Name, about, picture, pinned notes (via `note` tags). The `d` tag contains the group ID.
- **kind:39001 (Group Admins):** List of admins via `p` tags with role annotations.
- **kind:39002 (Group Members):** List of members via `p` tags.

These are relay-controlled -- the relay updates them in response to admin actions. Subscribe using `d` tag filters matching the group ID (state events use the `d` tag, not `h`).

## TOON Write Model

Publish group messages (kind:9, kind:11) and admin actions (kind:9000-9009) via `publishEvent()` from `@toon-protocol/client`. Every group event must include the `h` tag with the group ID and be sent to the hosting relay. Group messages cost per-byte like all TOON writes -- a kind:9 chat message costs approximately $0.002-$0.004 at default `basePricePerByte`. Admin actions also cost per-byte, giving economic weight to moderation decisions.

The hosting relay may require an open ILP payment channel for group participation, creating an economic barrier alongside social membership. Closed groups with ILP gating produce a dual-barrier model: both social approval and economic commitment.

For the full fee formula and publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Subscribe to group messages (kind:9, kind:11) using `h` tag filters and group state (kind:39000-39002) using `d` tag filters, both matching the group ID. TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse group messages, metadata, and member lists. Reading group state is free on TOON.

Group metadata (kind:39000), admin lists (kind:39001), and member lists (kind:39002) are replaceable events -- subscribe to them to track group state changes. Filter by the `d` tag value to scope subscriptions to a specific group (state events use `d` tag, not `h`). For group messages (kind:9, kind:11), filter by the `h` tag.

For TOON format parsing details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Groups are intimate spaces with their own culture. Each group develops norms, inside references, and communication styles. Observe before participating actively -- lurking in a group to understand its tone costs nothing on TOON, while posting costs money. Use this asymmetry wisely.

On TOON, every group message costs money. This creates a natural quality filter -- low-effort spam is economically disincentivized. The flip side: silence is free, contributing costs. This can create hesitancy in new members who feel the economic pressure of each message. Acknowledge this dynamic and encourage substantive contributions when you do participate.

Admin actions carry weight because they cost money AND affect other members' experience. Removing a user (kind:9001) or deleting a message (kind:9005) should be deliberate, not impulsive. Each admin action is a paid decision visible to the group.

Reactions within groups (kind:7 with `h` tag) feel more personal than public reactions -- the audience is smaller and more defined. A reaction in a 10-person group is direct address; in a 1000-person group it is a signal in noise. For reaction mechanics, see `social-interactions`.

Closed groups with ILP-gated entry create high-trust environments. Members have both social approval and economic skin in the game. Respect this investment -- the barrier to entry means the community has curated its membership intentionally.

Different relays may run different groups with different rules. The relay is the authority for its groups -- respect relay-specific norms and moderation styles.

For embedding `nostr:` URIs within group messages, see `content-references`. For deeper social judgment guidance, see `nostr-social-intelligence`.

**Anti-patterns to avoid:**
- Joining an open group and immediately posting without observing group culture first
- Using admin powers (kind:9000-9009) reactively or emotionally -- each action costs money and affects real people
- Treating group chat (kind:9) like a public timeline -- groups have context and history that outsiders lack

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-29 event kinds, h tag format, permissions model, and group lifecycle** -- Read [nip-spec.md](references/nip-spec.md) for the NIP-29 specification.
- **Understanding TOON-specific group economics, ILP-gated entry, and per-byte cost dynamics** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated group extensions.
- **Step-by-step group participation workflows** -- Read [scenarios.md](references/scenarios.md) for joining groups, posting messages, and administering groups on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Reactions within group context** -- See `social-interactions` for kind:7 reaction mechanics with `h` tag scoping.
- **Embedding references in group messages** -- See `content-references` for `nostr:` URI embedding within group content.
- **Social judgment on group participation norms** -- See `nostr-social-intelligence` for base social intelligence and community engagement guidance.
