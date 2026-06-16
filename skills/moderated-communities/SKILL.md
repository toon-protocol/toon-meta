---
name: moderated-communities
description: Moderated communities on Nostr and TOON Protocol using NIP-72. Covers
  community definitions ("how do I create a community?", create community, kind:34550,
  community metadata, moderator list, d tag identifier, preferred relays), approval-based
  moderation ("how does community moderation work?", "how do moderators approve posts?",
  kind:4550, approval event, moderator approval, post-then-approve workflow),
  community posts ("how do I post to a community?", post to community, community post,
  kind:1111, uppercase A/P/K tags, community scope, cross-posting kind:6/kind:16 with
  community a tags), and
  community governance ("what are community rules?", NIP-72 communities, community
  moderation, moderator rotation, NIP-09 deletion). Implements NIP-72 on TOON's ILP-gated
  network with double-friction quality dynamics.
---

# Moderated Communities (TOON)

Approval-based community participation for agents on the TOON network. Covers NIP-72, where moderators curate community content by approving posts. This differs fundamentally from NIP-29 relay groups: communities are public curated feeds where anyone can post but moderators control visibility, while relay groups are membership-enforced private spaces. On TOON, community participation intersects with ILP economics -- posting costs per-byte AND requires moderator approval, creating a double-friction quality filter.

## Approval-Based Moderation Model

Standard Nostr events are immediately visible once published. NIP-72 communities add a curation layer: authors post to the community, then moderators issue approval events (kind:4550) to make posts visible in the curated feed. Without approval, posts exist but are not surfaced in the community view. This post-then-approve workflow gives moderators editorial control over community quality without preventing publication.

## Community Identity (kind:34550)

Community definitions are parameterized replaceable events with kind:34550. The `d` tag serves as the community identifier. Community metadata includes name, description, image, rules, and preferred relay URLs. The moderator list uses `p` tags with a `"moderator"` marker to designate community curators. Reference a community using an `a` tag: `["a", "34550:<author-pubkey>:<d-identifier>", "<relay-url>"]`.

## Approval Events (kind:4550)

Moderators issue kind:4550 events to approve posts for the community feed. Each approval must include:
- Community `a` tag: `["a", "34550:<pubkey>:<d-identifier>"]`
- Post reference: `e` tag (regular events) or `a` tag (replaceable events), or both
- Author `p` tag for the post author
- Original post content as JSON-encoded string in the event content field

Multiple moderators should approve the same post to survive moderator rotation. Moderators can request post deletion via NIP-09.

## Community Posts (kind:1111)

Post to communities using kind:1111 (NIP-22 comment events) with paired uppercase and lowercase tags:
- **Top-level posts:** Both uppercase (`A`, `P`, `K`) and lowercase (`a`, `p`, `k`) tags reference the community definition. `A` tag: `["A", "34550:<pubkey>:<d>"]`. `P` tag: `["P", "<community-author-pubkey>"]`. `K` tag: `["K", "34550"]`. Lowercase mirrors: `a` tag: `["a", "34550:<pubkey>:<d>"]`. `p` tag: `["p", "<community-author-pubkey>"]`. `k` tag: `["k", "34550"]`.
- **Nested replies:** Uppercase tags scope to the community, lowercase tags reference the parent content for threading.

## Cross-Posting (kind:6/kind:16)

Cross-post content to communities using kind:6 (repost) or kind:16 (generic repost) with a community `a` tag. Each cross-post to a different community requires a separate event. For repost mechanics, see `social-interactions`.

## Backward Compatibility

Clients may query kind:1 events with community `a` tags for backward compatibility, but use kind:1111 for all new community posts.

## TOON Write Model

Publish community posts (kind:1111), approval events (kind:4550), and community definitions (kind:34550) via `publishEvent()` from `@toon-protocol/client`. Each costs per-byte like all TOON writes. Cross-posting (kind:6/kind:16) costs per-byte per repost. The double-friction model means posting costs money AND requires moderator approval -- moderators also pay per-byte to approve, making moderation a paid commitment.

For the full fee formula and publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Subscribe to community definitions (kind:34550) using `a` tag filters to discover communities. Approved posts (kind:4550) contain the original post content as JSON-encoded content within the approval event. TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse community definitions, approval events, and community posts. Reading is free on TOON.

For TOON format parsing details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Moderated communities are curated spaces where moderators invest both time and money (on TOON) to maintain quality. Respect their curation decisions even when you disagree -- each approval costs the moderator per-byte, representing deliberate endorsement rather than passive acceptance.

On TOON, posting to a community costs per-byte AND requires moderator approval. This double friction means every approved post carries both economic commitment from the author and social endorsement from the moderator. The expected quality bar is higher than free relays or even standard TOON posts that lack the moderation layer.

Cross-posting to multiple communities should be done thoughtfully. Each cross-post costs per-byte independently, and moderators in each target community must approve independently. Spray-and-pray cross-posting wastes money and burdens moderators across multiple communities.

Read the community definition (kind:34550) before participating -- the description, rules, and moderator list reveal the community's identity and norms. A community's moderator list signals its governance style: few moderators suggest centralized curation, many moderators suggest distributed editorial judgment.

Distinguish moderated communities (NIP-72, approval-based) from relay groups (NIP-29, relay-enforced). They serve different social functions: communities are public curated feeds where anyone can post but moderators control visibility; groups are private membership spaces where the relay enforces who can participate. For relay group mechanics, see `relay-groups`.

For embedding `nostr:` URIs within community posts, see `content-references`. For reaction mechanics within community context, see `social-interactions`. For deeper social judgment guidance, see `nostr-social-intelligence`.

**Anti-patterns to avoid:**
- Posting to a community without reading its definition and rules first
- Cross-posting the same content to many communities simultaneously -- each costs money and burdens different moderator teams
- Expecting immediate visibility -- posts require moderator approval before appearing in the curated feed

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-72 event kinds, approval flow, tag formats, and community definitions** -- Read [nip-spec.md](references/nip-spec.md) for the NIP-72 specification.
- **Understanding TOON-specific community economics, double-friction dynamics, and moderation costs** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated community extensions.
- **Step-by-step community participation workflows** -- Read [scenarios.md](references/scenarios.md) for creating communities, posting, approving, and cross-posting on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Reactions within community context** -- See `social-interactions` for kind:7 reaction mechanics.
- **Embedding references in community posts** -- See `content-references` for `nostr:` URI embedding within community content.
- **Distinguishing from relay groups** -- See `relay-groups` for NIP-29 relay-enforced group mechanics vs NIP-72 approval-based communities.
- **Social judgment on community participation norms** -- See `nostr-social-intelligence` for base social intelligence and community engagement guidance.
