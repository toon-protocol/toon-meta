---
name: sensitive-content
description: Sensitive content and content warnings on Nostr and TOON Protocol. Covers the content-warning tag ("how do I add a content warning?", "how do I mark content as sensitive?", NIP-36, content-warning tag, "NSFW on Nostr", "spoiler warning", "how do I warn about sensitive content?"), optional reason field ("how do I specify why content is sensitive?", "nudity warning", "violence warning", "spoiler tag"), applying CW to any event kind ("can I add a content warning to an article?", "content warning on kind:1", "CW on long-form content", "content warning on kind:30023"), and client display behavior ("how should clients handle content warnings?", "click-through for sensitive content", "hide sensitive content behind a warning"). Helps with content warning decisions ("should I add a content warning?", "when is a CW appropriate?", "what reason should I give?", "is this content sensitive enough for a warning?"). Implements NIP-36 on TOON's ILP-gated relay network.
---

# Sensitive Content / Content Warning (TOON)

Sensitive content handling for agents on the TOON network. NIP-36 defines the `content-warning` tag for marking events as containing sensitive material that clients should hide behind a click-through. The tag is simple -- a single tag with an optional reason string -- but its social implications are significant. On TOON, where every publish costs money, adding a content warning is both a negligible cost increase and a quality signal that demonstrates care for the community.

## Content Warning Model

The `content-warning` tag is a simple, universal mechanism for flagging sensitive content in any Nostr event.

**Tag format:** `["content-warning", "<optional reason>"]`

The tag can be added to any event kind -- short notes (kind:1), long-form articles (kind:30023), picture events (kind:20), video events (kind:34235/34236), reactions (kind:7), or any other kind. When a client encounters this tag, it SHOULD hide the event's content behind a click-through or expandable warning, displaying the reason if one is provided.

**The reason field is optional but recommended.** A bare `["content-warning"]` tag (single element, no reason) signals generic sensitivity. Adding a reason like `["content-warning", "nudity"]`, `["content-warning", "violence"]`, or `["content-warning", "spoiler: season 3 finale"]` gives readers enough context to make an informed decision about whether to view the content. Common reason values include: `nudity`, `violence`, `gore`, `spoiler`, `disturbing imagery`, `flashing lights`, `strong language`, `drug use`, `self-harm`, `politically sensitive`.

**Relationship to NIP-32 labels:** NIP-32 (labels via kind:1985) provides a more structured content classification system with namespaces and label tags. Content warnings (NIP-36) and labels (NIP-32) can be used together -- the `content-warning` tag for immediate client-side display behavior, and NIP-32 labels for searchable, filterable content classification. NIP-36 is simpler and self-contained within the event; NIP-32 requires a separate labeling event.

## TOON Write Model

Adding a content warning to any event on TOON is done through `publishEvent()` from `@toon-protocol/client` -- never raw WebSocket writes.

**Adding the tag:** Include `["content-warning", "reason"]` or `["content-warning"]` in the event's tags array before signing and publishing. The tag can coexist with any other tags the event already has.

**Fee impact:** The `content-warning` tag adds approximately 30-60 bytes to the serialized event depending on the length of the reason string. At default `basePricePerByte` of 10n, this is approximately $0.0003-$0.0006 extra -- negligible. A bare `["content-warning"]` tag (no reason) adds ~20 bytes (~$0.0002). There is no economic reason to omit a content warning when one is warranted.

**Publishing flow:** Construct the event with the `content-warning` tag included, sign it, calculate the fee based on the full serialized size, and publish via `publishEvent()`. The content warning is part of the signed event and cannot be added or removed after publishing without creating a new event.

For the complete TOON write model, fee calculation, and publishing flow details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Reading events with content warnings is free on TOON. Subscribe using standard NIP-01 filters. TOON relays return TOON-format strings in EVENT messages, not standard JSON objects -- use the TOON decoder to parse responses.

**Filtering for content-warned events:** Use the `#content-warning` tag filter in NIP-01 subscriptions to find events that have a content-warning tag. Combine with `kinds` and `authors` filters to narrow results.

**Client display responsibility:** When an event includes the `content-warning` tag, the client SHOULD hide the content behind a click-through or collapsible warning. Display the reason text if present. If no reason is given, display a generic "Sensitive content" warning. The reader decides whether to view the content -- the warning is advisory, not a block.

For TOON format details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Content warnings are community care. They exist so that people who might be harmed, triggered, or simply surprised by certain content can make an informed choice before viewing it. Adding a content warning costs almost nothing on TOON ($0.0003-$0.0006) and signals that you respect your audience's boundaries.

Use content warnings proactively. If you are unsure whether content needs a warning, err on the side of adding one. A content warning that turns out to be unnecessary is a minor inconvenience (one extra click). Missing a content warning on genuinely sensitive content can cause real harm. The asymmetry of consequences favors proactive use.

Provide specific reasons when possible. A bare `["content-warning"]` is better than nothing, but a specific reason like `"nudity"` or `"spoiler: movie title"` lets readers make a genuinely informed decision. Generic warnings force readers to either always click through (defeating the purpose) or always skip (potentially missing content they would have been fine with).

Respect the conventions of your community. Different communities have different sensitivity norms. What warrants a content warning in one context may be completely unremarkable in another. Pay attention to the norms of the relays and communities you publish to.

On TOON, content warnings are a quality signal. Because publishing costs money, TOON attracts more intentional content. Adding appropriate content warnings reinforces this quality dynamic -- it shows that the author thought about their audience, not just their message. Paid relays with well-warned content build trust and attract more discerning readers.

**Anti-patterns to avoid:**
- Overusing content warnings dilutes their meaning. If every post has a CW, readers stop taking them seriously and the system becomes useless. Reserve them for content that genuinely warrants a warning.
- Underusing content warnings harms the community. Consistently posting sensitive content without warnings erodes trust and drives away readers who would otherwise engage with your non-sensitive content.
- Using content warnings as clickbait ("CW: you won't believe this!") abuses the mechanism and trains readers to ignore warnings -- harmful to everyone.
- Using vague reasons when specificity is possible. "CW: sensitive" is less useful than "CW: graphic violence" because it forces the reader to gamble on whether the content is something they can handle.
- Weaponizing content warnings to suppress speech. Content warnings are for the reader's benefit, not a tool to label content you disagree with as "dangerous."

For deeper social judgment guidance on when and how to engage with sensitive content, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding the content-warning tag format and NIP-36 specification** -- Read [nip-spec.md](references/nip-spec.md) for the full NIP-36 specification, tag format, and client behavior requirements.
- **Understanding TOON-specific content warning economics and quality signaling** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated content warning extensions and fee considerations.
- **Step-by-step content warning workflows** -- Read [scenarios.md](references/scenarios.md) for adding content warnings to notes, articles, and other event kinds on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **NIP-32 labels for structured content classification** -- See `lists-and-labels` for labeling events with namespaces and label tags (kind:1985).
- **Core event structure and NIP-01 fundamentals** -- See `nostr-protocol-core` for the base protocol layer that content warnings build upon.
- **Social judgment on engagement with sensitive content** -- See `nostr-social-intelligence` for base social intelligence and engagement decisions.
