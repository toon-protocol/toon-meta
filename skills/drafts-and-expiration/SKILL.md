---
name: drafts-and-expiration
description: Draft events and expiration timestamps on Nostr and TOON Protocol. Covers NIP-37 draft events ("how do I save a draft on Nostr?", "how do I save a draft on TOON?", kind:31234, NIP-37, draft event, draft identifier, d tag draft, k tag target kind, save draft, resume editing), NIP-40 expiration timestamps ("how do I set an expiration on a Nostr event?", "how do I make temporary content?", expiration tag, auto-expire, time-sensitive content, ephemeral content, temporary status), draft lifecycle ("how do I publish from a draft?", "how do I edit a draft?", publish from draft, delete draft after publish, draft to final event), and draft encryption ("should I encrypt my drafts?", NIP-44 encrypted drafts, private drafts). Helps with draft and expiration decisions ("should I save this as a draft?", "how long should my expiration be?", "is drafting worth the cost on a paid relay?", "when should I use expiration tags?"). Implements NIP-37 and NIP-40 on TOON's ILP-gated relay network.
---

# Drafts and Expiration (TOON)

Draft event management and expiration timestamps for agents on the TOON network. Covers one event kind (kind:31234 draft events) and one cross-cutting tag (expiration) defined by NIP-37 and NIP-40 respectively. On TOON, drafts and expiring events are ILP-gated -- every draft save and every expiring event costs money.

## kind:31234 -- Draft Events

A kind:31234 event is a **parameterized replaceable event** that stores a work-in-progress version of any target event kind. The `d` tag uniquely identifies each draft per author. The `k` tag specifies the target kind number the draft will become when published.

**Required tags:** `d` (draft identifier, unique per author), `k` (target kind number as a string)
**Optional tags:** `e` (event ID being edited, if revising an existing event), `a` (replaceable event coordinate being edited), plus all tags the final event would carry (e.g., `title`, `summary`, `t`, `published_at` for articles)

**Content format:** The `content` field contains the draft content in the same format as the target kind. For a kind:30023 article draft, the content is markdown. For a kind:1 note draft, the content is plain text.

**Encryption:** Drafts are typically encrypted using NIP-44 so only the author can read them. The `content` field contains the NIP-44 encrypted payload, and tags that would reveal content are also encrypted within the payload.

**Publishing from a draft:** Create the final event from the draft content (using the target kind from the `k` tag), publish it, then delete the draft with a kind:5 deletion request.

## Expiration Tag (NIP-40)

The `expiration` tag can be added to **any event kind**. Format: `["expiration", "<unix-timestamp>"]`. The value is a string containing a Unix timestamp in seconds.

**Relay behavior:** Relays SHOULD refuse to accept events whose expiration timestamp is already in the past. Relays SHOULD delete expired events from storage.

**Client behavior:** Clients SHOULD hide events whose expiration timestamp has passed, even if the relay still serves them.

**Use cases:** Time-sensitive announcements, temporary statuses (NIP-38), ephemeral messages, limited-time offers, conference schedules, rotating content.

## TOON Write Model

Publishing drafts and expiring events on TOON requires ILP payment. Use `publishEvent()` from `@toon-protocol/client` -- never raw WebSocket writes.

**Fee calculation:** `basePricePerByte * serializedEventBytes`. Typical costs:
- Draft event (kind:31234): ~300-2000 bytes = ~$0.003-$0.020 depending on content length
- Expiration tag overhead: ~20-30 bytes = ~$0.0002-$0.0003 added to any event

Drafts are parameterized replaceable, so each save overwrites the previous version for the same `d` tag -- you pay per save, but the relay only retains the latest version.

For detailed fee calculation and the complete publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Reading drafts and expiring events is free. Subscribe using NIP-01 filters: `kinds: [31234]` and `authors: [<own-pubkey>]` to fetch your drafts. Filter by `#k` to fetch drafts targeting a specific kind.

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse responses. For TOON format details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Drafts on TOON are a deliberate economic investment in composition. Each draft save costs money, which means the drafting workflow on a paid network differs fundamentally from free platforms where you can auto-save every keystroke. Compose locally, save to the relay when you have a meaningful checkpoint, and publish when ready.

Encrypting drafts is strongly recommended. Unencrypted drafts expose your work-in-progress content to anyone reading the relay. On TOON, where every published event carries economic weight, revealing unfinished thoughts undermines the signal quality your final publication carries.

The draft-to-publish workflow on TOON has a natural rhythm: draft locally (free), save to relay when ready for cross-device access (paid), iterate, then publish the final event (paid) and delete the draft (paid). Three relay writes for a polished piece of content is a reasonable investment.

Expiration tags are economically efficient. An event with an expiration tag costs the same to publish as one without (the tag adds only ~20 bytes), but it eliminates the need for a separate deletion event later. For any content that is inherently time-bound -- conference announcements, temporary statuses, limited-time offers -- the expiration tag saves both money and effort.

On TOON, expired events free relay storage. This aligns the author's intent (temporary content) with the relay's economics (reduced storage burden). Using expiration tags for time-bound content is good network citizenship.

**Anti-patterns to avoid:**
- Auto-saving drafts to the relay on every keystroke (compose locally, save checkpoints)
- Leaving encrypted drafts on the relay after publishing the final event (delete them)
- Publishing time-bound content without an expiration tag (creates stale clutter)
- Setting expiration too aggressively (content disappears before readers engage)

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing kind:31234 draft events or expiration tags, understanding tag formats** -- Read [nip-spec.md](references/nip-spec.md) for NIP-37 and NIP-40 specifications.
- **Understanding TOON-specific draft costs, expiration economics, and optimization** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated draft and expiration considerations.
- **Step-by-step draft and expiration workflows** -- Read [scenarios.md](references/scenarios.md) for saving, publishing, and expiring content on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Long-form article drafting** -- See `long-form-content` for kind:30023 article structure and lifecycle.
- **Encrypting draft content** -- See `encrypted-messaging` for NIP-44 encryption mechanics.
- **Expiring statuses** -- See `user-statuses` for kind:30315 status events with NIP-40 expiration.
- **Linking drafts to existing events** -- See `nostr-protocol-core` for event IDs, `e` tags, and `a` tag coordinates.
