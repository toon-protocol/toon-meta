# NIP-72 Specification: Moderated Communities

> **Why this reference exists:** NIP-72 introduces an approval-based moderation model that differs fundamentally from both standard Nostr (publish-and-visible) and NIP-29 relay groups (relay-enforced membership). Agents need to understand community definitions, the approval workflow, the paired uppercase/lowercase tagging system for community posts, and cross-posting mechanics to participate correctly in moderated communities.

## Approval-Based Moderation Model

In standard Nostr, published events are immediately visible to subscribers. NIP-72 adds a curation layer between publication and visibility:

1. **Author publishes a post** to the community (kind:1111 with community scope tags)
2. **Moderators review the post** and decide whether it belongs in the community
3. **Moderators issue approval events** (kind:4550) to make the post visible in the curated community feed
4. **Unapproved posts exist** on the relay but are not surfaced in the community view by compliant clients

This is fundamentally different from NIP-29 relay groups, where the relay rejects events from non-members before storage. In NIP-72, anyone can post -- moderators control visibility, not access.

## Community Definition (kind:34550)

Community definitions are **parameterized replaceable events** (kind 34550). The `d` tag serves as the unique community identifier within the author's event set.

**Required structure:**
- **Kind:** 34550
- **`d` tag:** `["d", "<community-identifier>"]` -- unique identifier chosen by the community creator
- **Content:** Community description, rules, or guidelines (plain text or markdown)

**Common metadata tags:**
- `["name", "<community-name>"]` -- Display name
- `["description", "<community-description>"]` -- Extended description
- `["image", "<image-url>"]` -- Community avatar or banner
- `["p", "<moderator-pubkey>", "<relay-url>", "moderator"]` -- Moderator designation (repeatable for multiple moderators)
- `["relay", "<relay-url>", "read"|"write"]` -- Preferred relay URLs with read/write designation

**Community reference format (a tag):**
```
["a", "34550:<community-author-pubkey>:<d-identifier>", "<optional-relay-url>"]
```

This `a` tag format is used by approval events, community posts, and cross-posts to reference the community definition. The three-part value (`kind:pubkey:d-tag`) uniquely identifies the community across the Nostr network.

**Replaceable event behavior:** As a parameterized replaceable event, newer kind:34550 events from the same author with the same `d` tag replace older ones. Community metadata updates (name, description, moderator list) are published as new kind:34550 events that supersede the previous version.

## Approval Events (kind:4550)

Moderators issue kind:4550 events to approve posts for the community feed. Each approval event contains enough information for clients to reconstruct the approved post without fetching it separately.

**Required tags:**
- **Community `a` tag:** `["a", "34550:<community-author-pubkey>:<d-identifier>"]` -- identifies which community the approval applies to
- **Post reference `e` tag:** `["e", "<approved-event-id>", "<relay-url>"]` -- for regular (non-replaceable) approved events
- **Post reference `a` tag:** `["a", "<kind>:<pubkey>:<d-tag>"]` -- for replaceable approved events (can include both `e` and `a` tags)
- **Author `p` tag:** `["p", "<post-author-pubkey>"]` -- identifies the post's author

**Content field:** The original approved post's full event JSON, encoded as a string. This allows clients to display the approved content directly from the approval event without a separate fetch.

**Multiple moderator approvals:** The spec recommends that multiple moderators approve the same post. If only one moderator approves a post and that moderator is later removed from the moderator list, the approval may be invalidated. Multiple approvals from different moderators provide resilience against moderator rotation.

**Moderator deletion:** Moderators can request deletion of community content using NIP-09 deletion events. A deletion request from a moderator listed in the community definition should be honored by compliant clients.

## Community Posts (kind:1111)

Community posts use kind:1111 (NIP-22 comment events) with a paired uppercase/lowercase tag system that distinguishes community scope from reply threading.

### Top-Level Community Posts

A top-level post (not a reply to another post) uses both uppercase and lowercase tags pointing to the community definition:

**Uppercase tags (community scope):**
- `["A", "34550:<community-author-pubkey>:<d-identifier>"]` -- scopes this post to the community
- `["P", "<community-author-pubkey>"]` -- community definition author
- `["K", "34550"]` -- community definition event kind

**Lowercase tags (threading root -- same as uppercase for top-level):**
- `["a", "34550:<community-author-pubkey>:<d-identifier>"]` -- root reference (same community for top-level)
- `["p", "<community-author-pubkey>"]` -- root author
- `["k", "34550"]` -- root event kind

For top-level posts, both uppercase and lowercase tags reference the community definition because the post's root scope IS the community.

### Nested Replies Within a Community

Replies to community posts use uppercase tags for community scope and lowercase tags for reply threading:

**Uppercase tags (community scope -- unchanged):**
- `["A", "34550:<community-author-pubkey>:<d-identifier>"]` -- still scoped to the community
- `["P", "<community-author-pubkey>"]` -- community definition author
- `["K", "34550"]` -- community definition event kind

**Lowercase tags (parent reference -- points to the post being replied to):**
- `["e", "<parent-event-id>", "<relay-url>", "reply"]` -- parent event reference
- `["p", "<parent-author-pubkey>"]` -- parent author
- `["k", "<parent-event-kind>"]` -- parent event kind (e.g., "1111" for replies to community posts)

This separation allows clients to:
1. Filter all posts in a community using uppercase `A` tag
2. Build reply threads using lowercase tags
3. Display community scope context using uppercase tags regardless of thread depth

## Cross-Posting (kind:6/kind:16)

Content from outside a community can be cross-posted into it using repost events:

- **kind:6 (Repost):** For cross-posting kind:1 notes into a community. Include the community `a` tag.
- **kind:16 (Generic Repost):** For cross-posting non-kind:1 events (e.g., kind:30023 articles) into a community. Include the community `a` tag and a `k` tag indicating the original event kind.

Cross-posts carry the community `a` tag to scope them to the target community. Each cross-post to a different community requires a separate repost event.

## Backward Compatibility

Older clients may have posted kind:1 notes with community `a` tags before NIP-22 (kind:1111) was adopted for community posts. Clients should:
- **Query kind:1** with community `a` tag filters for backward-compatible community content discovery
- **Use kind:1111** for all new community posts
- **Not create new kind:1 events** with community `a` tags

## Subscription Filtering

To discover and monitor communities:

- **Community definitions:** `kinds: [34550]` -- discover all communities, or filter by specific `a` tag for a known community
- **Approved posts:** `kinds: [4550]` with `#a: ["34550:<pubkey>:<d>"]` -- all approvals for a specific community
- **Community posts:** `kinds: [1111]` with `#A: ["34550:<pubkey>:<d>"]` -- all posts scoped to a community (uppercase A tag filter)
- **Cross-posts:** `kinds: [6, 16]` with `#a: ["34550:<pubkey>:<d>"]` -- reposts into a community
