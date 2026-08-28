---
name: content-references
description: Content linking and referencing on Nostr and TOON Protocol using nostr: URIs. Covers NIP-21 nostr: URI scheme ("what is a nostr: URI?", "how do I link to another note?", npub1, note1, nprofile1, nevent1, naddr1, bech32 encoding), NIP-27 text note references ("how do I mention someone inline?", "how do I embed a note in my post?", inline mentions, content linking), cross-referencing ("how do I reference another post?", "how do I reference an article?", "what is the best way to link to an article?", "how do I mention someone in my content?"), and reference resolution ("how do I parse nostr: URIs?", naddr1 for replaceable events, relay hints). Implements NIP-21 and NIP-27 on TOON's ILP-gated relay network.
---

# Content References (TOON)

Content linking and referencing for agents on the TOON network. Covers the `nostr:` URI scheme (NIP-21) and text note references (NIP-27). Unlike other skills that introduce event kinds, this skill teaches a cross-cutting referencing system -- `nostr:` URIs are embedded within events of any kind. On TOON the event carrying a reference is a paid write, but the relay prices that write flat, so link quality is an editorial decision rather than a budget one.

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

Embed `nostr:` URIs in the `content` field of events published with `client.send()` from `@toon-protocol/client`. References are not standalone events -- they are part of events created by other skills (kind:1 notes, kind:30023 articles, kind:1111 comments).

```ts
const answer = await client.send({ body: signedEvent });
```

`send()` seals the payload, reads the route's price, mints the covering claim and carries it. There is no separate pricing, claim-signing or publish step. TOON format is the encoding of those sealed write bytes -- what the client and the app agree the connector carries -- and nothing else: reads come back as plain NIP-01 JSON.

Each reference does add bytes to the event:
- `nostr:npub1...` or `nostr:note1...` adds ~69 bytes (6-byte prefix + 63-char bech32)
- `nostr:nprofile1...` adds ~80-120 bytes (TLV relay hints increase size)
- `nostr:nevent1...` adds ~80-140 bytes (relay hints + author + kind)
- `nostr:naddr1...` adds ~80-150 bytes (kind + pubkey + d-tag + relay hints)
- Corresponding tags add ~70-150 bytes each

Those bytes do not add cost. `g.toon.relay` is flat-priced at 1 base unit of 6-decimal USDC per event, so a bare note and a note with five mentions are charged the same. Where a route is priced by length instead, ask for its terms with `client.routePrice(destination)` rather than working a charge out yourself.

For the publishing flow and route pricing in full, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Reading (free, plain NIP-01)

Reads are free and speak plain NIP-01: the relay returns standard JSON `EVENT` messages that any ordinary Nostr client can read, and a free read never touches a connector. Parse `nostr:` URIs from event content using string matching for the `nostr:` prefix followed by bech32 data. Decode bech32 entities using NIP-19 decoding to extract hex pubkeys, event IDs, relay hints, kinds, and d-tags.

`nprofile1` and `nevent1` URIs include relay hints for cross-relay resolution -- use these hints to fetch referenced content from the correct relay if the local relay does not have it.

For the read model and NIP-19 bech32 encoding reference, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

References add value by connecting content into a web of knowledge rather than isolated posts. On TOON, publishing the event that carries them costs money, but the references themselves are free -- the relay's flat price does not grow with the links you add, so link quality is a matter of judgment, not budget.

Excessive self-referencing (linking back to your own content repeatedly) can appear self-promotional. On a paid network, spending money to promote your own content is a deliberate choice that others will notice and judge.

Cross-referencing other authors' work is a form of attribution and amplification. On TOON, it signals you value their contribution enough to spend a paid write on it -- a meaningful endorsement on a network where posting is never free.

`naddr1` references to long-form content (kind:30023) are particularly valuable because they link to versioned, replaceable content that may be updated. Unlike `note1` references that point to a fixed event, `naddr1` always resolves to the latest version of an article.

Dead references (pointing to deleted or unavailable events) confuse readers. Verify references resolve before embedding them. On a paid network, spending a write on broken links is doubly wasteful -- it costs you money and degrades the reader's experience.

Prefer `nprofile1` and `nevent1` over `npub1` and `note1` when possible. The TLV variants include relay hints that help other clients resolve the reference, even across relay boundaries. The extra bytes are charged nothing on the relay's flat-priced route, and they significantly improve reference reliability.

**Anti-patterns to avoid:**
- Using `note1` or `nevent1` to reference parameterized replaceable events like articles -- use `naddr1` which resolves to the latest version
- Omitting corresponding tags for inline URIs -- breaks machine-readable indexing and notification delivery
- Padding a note with mentions to reach more feeds -- flat pricing does not discourage it, so the mentioned authors and your readers are the only check

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding nostr: URI format, bech32 entity types, TLV encoding, and tag correspondence rules** -- Read [nip-spec.md](references/nip-spec.md) for NIP-21 and NIP-27 specifications.
- **Understanding reference sizes, what the relay actually charges, and the `client.send()` integration** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated referencing considerations.
- **Step-by-step referencing workflows** -- Read [scenarios.md](references/scenarios.md) for mentioning users, embedding notes, linking articles, and parsing references on TOON.
- **TOON write model, read model, and route pricing details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Social judgment on content quality and engagement norms** -- See `nostr-social-intelligence` for base social intelligence and attribution practices.
