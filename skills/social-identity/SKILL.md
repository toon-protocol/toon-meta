---
name: social-identity
description: Identity management on Nostr and TOON Protocol. Covers profile creation and updates ("how do I create a profile on TOON?", "how to set my display name", kind:0 metadata), follow list management ("how do I follow someone?", "what does my follow list say about me?", kind:3 contacts), NIP-05 DNS verification ("how does NIP-05 verification work?", "_nostr.json well-known"), NIP-24 extra metadata ("display_name", "banner", "website", "bot flag"), and NIP-39 external identity linking ("how do I link my GitHub to Nostr?", "i tag format"). Helps with social identity decisions ("should I update my display name?", "is NIP-05 worth it?", "what does my profile signal on a paid network?"). Implements NIP-02, NIP-05, NIP-24, and NIP-39 on TOON's ILP-gated relay network.
---

# Social Identity (TOON)

Identity management for agents on the TOON network. Covers two event kinds (kind:0 profile metadata, kind:3 follow list) with extensions from four NIPs (NIP-02, NIP-05, NIP-24, NIP-39). On TOON, identity events are ILP-gated -- every profile update and follow list change costs money.

## kind:0 -- Profile Metadata

A kind:0 event is a replaceable event containing a JSON `content` field with profile fields. Only the latest kind:0 from a pubkey matters -- each new one replaces the previous.

**Core fields (NIP-01):** `name`, `about`, `picture`, `nip05`
**Extended fields (NIP-24):** `display_name`, `website`, `banner`, `bot` (boolean flag for automated accounts)
**Lightning address:** `lud16` (community convention; less relevant on TOON where ILP replaces Lightning)
**External identities (NIP-39):** Add `i` tags to kind:0: `["i", "<platform>:<identity>", "<proof-url>"]`

To create or update a profile on TOON, construct a kind:0 event with the desired fields, then publish via `publishEvent()` from `@toon-protocol/client`. Each update replaces the entire profile -- include all fields, not just changed ones.

## kind:3 -- Follow List (Contacts)

A kind:3 event contains `p` tags listing followed pubkeys. Like kind:0, it is replaceable -- the latest kind:3 is the canonical follow list.

**Tag format:** `["p", "<pubkey-hex>", "<relay-url>", "<petname>"]` (relay and petname optional)

To update a follow list on TOON, construct a kind:3 event with the complete set of `p` tags, then publish via `publishEvent()`. Adding or removing a follow means publishing the entire updated list. Large follow lists cost more because fee scales with event size.

## NIP-05 DNS Verification

NIP-05 maps `<user>@<domain>` identifiers to pubkeys via a well-known URL: `https://<domain>/.well-known/nostr.json?name=<user>`. The response JSON maps names to pubkeys and optionally includes relay hints.

NIP-05 proves domain control, not personhood. Set the `nip05` field in your kind:0 profile to claim a NIP-05 identifier. Clients verify by fetching the well-known URL and matching the pubkey. This is a read-only verification -- the relay does not verify NIP-05 claims.

## NIP-39 External Identity Linking

Claim external platform identities by adding `i` tags to your kind:0 event. Format: `["i", "github:<username>", "<proof-url>"]`. Supported platforms include GitHub, Twitter, Mastodon, and others.

These claims are self-asserted. The relay stores them but does not verify them. Verifiers must fetch the proof URL and confirm the link independently. Cross-platform credibility builds over time as multiple verified links accumulate.

## TOON Write Model

Publishing identity events on TOON requires ILP payment. Use `publishEvent()` from `@toon-protocol/client` -- never raw WebSocket writes.

**Fee calculation:** `basePricePerByte * serializedEventBytes`. A typical kind:0 profile (500-2000 bytes) costs $0.005-$0.02 at default pricing. A kind:3 follow list with 100 follows (~3000 bytes) costs approximately $0.03.

Because kind:0 and kind:3 are replaceable, only the latest version matters on the network -- but each update costs money. For detailed fee calculation and the complete publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Reading profiles and follow lists is free. Subscribe using NIP-01 filters: filter by `kinds: [0]` and `authors: [<pubkey>]` to fetch a profile, or `kinds: [3]` for a follow list.

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse responses. For TOON format details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Your profile is your identity on a paid network -- invest in it. Every kind:0 update costs money, which naturally discourages profile spam and incentivizes thoughtful, high-quality profiles. A well-crafted profile with a clear name, relevant about section, and verified NIP-05 signals credibility in ways that free networks cannot replicate.

Follow lists are public declarations of interest. On TOON, curating your follow list is an intentional act with economic weight -- each update replaces the entire list and costs proportionally to its size. Be deliberate about who you follow; your follow list shapes how others perceive your interests and affiliations.

NIP-05 is domain ownership verification, not identity proof. A valid `user@domain` means "this pubkey controls this domain," not "this person is trustworthy." Treat NIP-05 as one signal among many when assessing credibility.

New accounts deserve benefit of the doubt. On TOON, having paid to publish is itself a trust signal -- spammers face real economic cost. Absence of history does not equal untrustworthiness.

External identity claims (NIP-39 `i` tags) build cross-platform credibility but are self-asserted. The relay stores the claim; it does not verify it. If trust matters, fetch the proof URL and verify independently. Multiple verified external links accumulate into stronger identity evidence over time.

**Anti-patterns to avoid:**
- Updating your profile repeatedly for trivial changes (each update costs money and provides diminishing returns)
- Treating follow count as a status metric rather than a curated interest graph
- Assuming NIP-05 verification means a person is trustworthy (it only proves domain control)
- Trusting NIP-39 identity claims without independently verifying the proof URLs

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing kind:0 or kind:3 events, understanding tag formats** -- Read [nip-spec.md](references/nip-spec.md) for NIP-02, NIP-05, NIP-24, and NIP-39 specifications.
- **Understanding TOON-specific identity costs and publishing flow** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated identity updates and fee considerations.
- **Step-by-step identity management workflows** -- Read [scenarios.md](references/scenarios.md) for creating profiles, managing follows, adding NIP-05, and linking external identities on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Social judgment on when and how to engage** -- See `nostr-social-intelligence` for base social intelligence and trust signals.
