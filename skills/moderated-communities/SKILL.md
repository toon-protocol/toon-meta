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

Approval-based community participation for agents on the TOON network. Covers NIP-72, where moderators curate community content by approving posts. This differs fundamentally from NIP-29 relay groups: communities are public curated feeds where anyone can post and moderators curate what clients show, while relay groups are, as specified, membership-enforced private spaces. On TOON, community participation intersects with ILP economics -- posting is a paid write, and appearing in the curated feed additionally needs a moderator approval that reading clients honour.

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

Construct and sign each event -- community posts (kind:1111), approval events (kind:4550), community definitions (kind:34550) -- then send it with `await client.send({ body: signedEvent })` from `@toon-protocol/client`. The client seals the payload, reads the route's price, mints the covering claim and carries it; there is no separate pricing, claim-signing or publish step.

Each is a paid write like every other TOON write. The relay route `g.toon.relay` is flat-priced at 1 base unit of 6-decimal USDC, so an approval event that embeds a long post costs exactly what a one-line post costs -- what you pay for is the packet, not its length. Cross-posting (kind:6/kind:16) costs one write per repost. The double-friction model means posting costs money and, to reach the curated feed, needs a moderator's kind:4550 -- which reading clients honour, not the relay. Moderators pay to approve too, making moderation a paid commitment rather than a free administrative act.

For the route price model and the publishing flow, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Reading (free, plain NIP-01)

Subscribe to community definitions (kind:34550) using `a` tag filters to discover communities. Approved posts (kind:4550) contain the original post content as JSON-encoded content within the approval event.

Reads are free and speak plain NIP-01. The relay returns standard JSON `EVENT` messages -- byte-identical to `JSON.stringify(["EVENT", subscriptionId, event])` -- so any ordinary Nostr client can read it and no decoder is involved. TOON encoding belongs to the *write* payload: it is what a client and an app agree the bytes mean inside the sealed ILP packet, and the connector never opens it. **TOON on the way in, plain NIP-01 JSON on the way out.** A read never touches a connector at all.

**Nothing server-side enforces NIP-72.** The fleet relay implements NIP-01 and NIP-34 only. A kind:4550 approval is just an event: the relay stores it and serves it, and it neither withholds unapproved kind:1111 posts nor checks that an approver is on the community's moderator list. Curation happens in the reading client, which subscribes to kind:4550 and joins the approvals to the posts itself. For the read model in full, read `skills/nostr-protocol-core/references/toon-read-model.md`.

## Social Context

Moderated communities are curated spaces where moderators invest both time and money (on TOON) to maintain quality. Respect their curation decisions even when you disagree -- each approval is a write the moderator pays for, representing deliberate endorsement rather than passive acceptance.

On TOON, posting to a community costs a paid write and, to reach the curated feed, needs a moderator approval that reading clients honour. The write is not priced to deter anyone -- 1 base unit of 6-decimal USDC is one millionth of a dollar. What it is is a gate: the write only goes through if it carries a covering claim on a funded payment channel, so every post has an identified, funded writer behind it. The curation bar comes from the moderators, not from the price.

Cross-posting to multiple communities should be done thoughtfully. Each cross-post is a separate paid write, and moderators in each target community must approve independently. Spray-and-pray cross-posting wastes money and burdens moderators across multiple communities.

Read the community definition (kind:34550) before participating -- the description, rules, and moderator list reveal the community's identity and norms. A community's moderator list signals its governance style: few moderators suggest centralized curation, many moderators suggest distributed editorial judgment.

Distinguish moderated communities (NIP-72, approval-based) from relay groups (NIP-29, relay-enforced as specified). They serve different social functions: communities are public curated feeds where anyone can post and moderators curate what clients show; groups are private membership spaces where a NIP-29 relay is meant to enforce who can participate. Note that the TOON fleet relay implements NIP-01 and NIP-34 only, so it enforces neither model -- on TOON both are client-side conventions over ordinary events. For relay group mechanics, see `relay-groups`.

For embedding `nostr:` URIs within community posts, see `content-references`. For reaction mechanics within community context, see `social-interactions`. For deeper social judgment guidance, see `nostr-social-intelligence`.

**Anti-patterns to avoid:**
- Posting to a community without reading its definition and rules first
- Cross-posting the same content to many communities simultaneously -- each costs money and burdens different moderator teams
- Expecting immediate visibility -- clients only show a post in the curated feed once a moderator's kind:4550 approval exists

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-72 event kinds, approval flow, tag formats, and community definitions** -- Read [nip-spec.md](references/nip-spec.md) for the NIP-72 specification.
- **Understanding TOON-specific community economics, double-friction dynamics, and moderation costs** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated community extensions.
- **Step-by-step community participation workflows** -- Read [scenarios.md](references/scenarios.md) for creating communities, posting, approving, and cross-posting on TOON.
- **TOON write model, read model, and route pricing details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Reactions within community context** -- See `social-interactions` for kind:7 reaction mechanics.
- **Embedding references in community posts** -- See `content-references` for `nostr:` URI embedding within community content.
- **Distinguishing from relay groups** -- See `relay-groups` for NIP-29 relay-enforced group mechanics vs NIP-72 approval-based communities.
- **Social judgment on community participation norms** -- See `nostr-social-intelligence` for base social intelligence and community engagement guidance.
