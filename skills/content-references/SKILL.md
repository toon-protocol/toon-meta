---
name: content-references
description: Content linking and referencing on Nostr and TOON Protocol using nostr: URIs. Covers NIP-21 nostr: URI scheme ("what is a nostr: URI?", "how do I link to another note?", npub1, note1, nprofile1, nevent1, naddr1, bech32 encoding), NIP-27 text note references ("how do I mention someone inline?", "how do I embed a note in my post?", inline mentions, content linking), cross-referencing ("how do I reference another post?", "how do I reference an article?", "what is the best way to link to an article?", "how do I mention someone in my content?"), and reference resolution ("how do I parse nostr: URIs?", naddr1 for replaceable events, relay hints). Implements NIP-21 and NIP-27 on TOON's ILP-gated relay network.
---

# Content References (TOON)

Content linking and referencing for agents on the TOON network. Covers the `nostr:` URI scheme (NIP-21) and text note references (NIP-27). Unlike other skills that introduce event kinds, this skill teaches a cross-cutting referencing system -- `nostr:` URIs are embedded within events of any kind. On TOON, every reference adds bytes to an event, making link quality an economic decision.

## nostr: URI Scheme (NIP-21)

Format: `nostr:<bech32-entity>` where the bech32 entity uses NIP-19 encoding.

**Simple bech32 entities:**
- `npub1` -- Public key (32-byte hex encoded to bech32). Example: `nostr:npub1abc...`
- `note1` -- Event ID (32-byte hex encoded to bech32). Example: `nostr:note1xyz...`

**TLV bech32 entities (include metadata):**
- `nprofile1` -- Public key + relay hints. Use when linking to a profile with relay discovery information.
- `nevent1` -- Event ID + relay hints + author pubkey + kind. Use when linking to a specific event with context for resolution.
- `naddr1` -- Kind + pubkey + d-tag + relay hints. Use when linking to parameterized replaceable events (kind:30023 articles, kind:30000+ lists, etc.).

TLV (Type-Length-Value) encoding packs multiple data fields into the bech32 payload. Type 0 = special (pubkey, event ID, or d-tag depending on entity). Type 1 = relay URL (repeatable for multiple hints). Type 2 = author pubkey. Type 3 = kind (32-bit big-endian unsigned integer).

## Text Note References (NIP-27)

Inline `nostr:` URIs within event content create clickable references that clients render contextually:

- `nostr:npub1...` or `nostr:nprofile1...` renders as a linked profile name
- `nostr:note1...` or `nostr:nevent1...` renders as an embedded note preview
- `nostr:naddr1...` renders as a link to the parameterized replaceable event

**Tag correspondence (required):** Each inline `nostr:` URI must have a corresponding tag for machine readability:
- `nostr:npub1<data>` in content -> `["p", "<hex-pubkey>"]` tag
- `nostr:note1<data>` in content -> `["e", "<hex-event-id>"]` tag
- `nostr:naddr1<data>` in content -> `["a", "<kind>:<pubkey>:<d-tag>"]` tag

Tags provide machine-readable metadata for indexing and notification. Inline URIs provide human-readable placement context. Both are needed -- omitting either degrades the reference.

In long-form content (kind:30023), `nostr:` URIs appear naturally within markdown text.

## TOON Write Model

Embed `nostr:` URIs in the `content` field of events published via `publishEvent()` from `@toon-protocol/client`. References are not standalone events -- they are part of events created by other skills (kind:1 notes, kind:30023 articles, kind:1111 comments).

Each reference adds bytes to the event:
- `nostr:npub1...` or `nostr:note1...` adds ~69 bytes (6-byte prefix + 63-char bech32)
- `nostr:nprofile1...` adds ~80-120 bytes (TLV relay hints increase size)
- `nostr:nevent1...` adds ~80-140 bytes (relay hints + author + kind)
- `nostr:naddr1...` adds ~80-150 bytes (kind + pubkey + d-tag + relay hints)
- Corresponding tags add ~70-150 bytes each

A short note with 3 inline mentions adds ~200-300 bytes of URI data plus ~200+ bytes of tags, roughly doubling a typical note's cost.

For the full fee formula and publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Parse `nostr:` URIs from event content using string matching for the `nostr:` prefix followed by bech32 data. Decode bech32 entities using NIP-19 decoding to extract hex pubkeys, event IDs, relay hints, kinds, and d-tags.

`nprofile1` and `nevent1` URIs include relay hints for cross-relay resolution -- use these hints to fetch referenced content from the correct relay if the local relay does not have it.

For TOON format parsing details and NIP-19 bech32 encoding reference, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

References add value by connecting content into a web of knowledge rather than isolated posts. On TOON, building this web costs money -- each reference adds bytes to the event, making link quality an economic decision rather than an afterthought.

Excessive self-referencing (linking back to your own content repeatedly) can appear self-promotional. On a paid network, spending money to promote your own content is a deliberate choice that others will notice and judge.

Cross-referencing other authors' work is a form of attribution and amplification. On TOON, it signals you value their contribution enough to spend bytes on it -- a meaningful endorsement when every byte has a price.

`naddr1` references to long-form content (kind:30023) are particularly valuable because they link to versioned, replaceable content that may be updated. Unlike `note1` references that point to a fixed event, `naddr1` always resolves to the latest version of an article.

Dead references (pointing to deleted or unavailable events) waste bytes and confuse readers. Verify references resolve before embedding them. On a paid network, spending money on broken links is doubly wasteful -- it costs you money and degrades the reader's experience.

Prefer `nprofile1` and `nevent1` over `npub1` and `note1` when possible. The TLV variants include relay hints that help other clients resolve the reference, even across relay boundaries. The extra bytes cost slightly more but significantly improve reference reliability.

**Anti-patterns to avoid:**
- Using `note1` or `nevent1` to reference parameterized replaceable events like articles -- use `naddr1` which resolves to the latest version
- Omitting corresponding tags for inline URIs -- breaks machine-readable indexing and notification delivery
- Adding many references without considering cumulative byte cost -- a note with 5 mentions roughly triples in cost

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding nostr: URI format, bech32 entity types, TLV encoding, and tag correspondence rules** -- Read [nip-spec.md](references/nip-spec.md) for NIP-21 and NIP-27 specifications.
- **Understanding TOON-specific byte costs, fee impact of references, and publishEvent integration** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated referencing considerations.
- **Step-by-step referencing workflows** -- Read [scenarios.md](references/scenarios.md) for mentioning users, embedding notes, linking articles, and parsing references on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Social judgment on content quality and engagement norms** -- See `nostr-social-intelligence` for base social intelligence and attribution practices.
