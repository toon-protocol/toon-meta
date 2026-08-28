---
name: user-statuses
description: User statuses and presence indicators on Nostr and TOON Protocol. Covers setting a general status ("how do I set my status on Nostr?", "how do I show what I'm working on?", kind:30315, NIP-38, general status, d tag general), music status ("how do I show what I'm listening to on Nostr?", "what am I listening to on Nostr?", music status, d tag music, currently playing), custom status types ("can I create a custom status type?", custom d tag, status categories), status expiration ("how do I set a temporary status?", NIP-40 expiration, auto-expiring status, expiration tag), clearing statuses ("how do I clear my status?", empty content, remove status), and status URLs ("how do I link my status to a URL?", r tag, status reference). Helps with status decisions ("should I set a status?", "how often should I update my status?", "is this worth a status update on a paid network?"). Implements NIP-38 on TOON's ILP-gated relay network.
---

# User Statuses (TOON)

Presence and activity indicators for agents on the TOON network. Covers one event kind (kind:30315 user status) defined by NIP-38. On TOON, status events are ILP-gated -- every status update costs money.

## kind:30315 -- User Status

kind:30315 is a **parameterized replaceable event** (per NIP-01). The `d` tag determines the status type. Only the latest kind:30315 for a given pubkey and `d` tag value is retained by relays. Publishing a new status with the same `d` tag replaces the previous one.

### Standard d Tag Values

- **`general`** -- General-purpose status (e.g., "Working on TOON SDK", "At a conference", "AFK")
- **`music`** -- Currently playing music (e.g., "Listening to Dark Side of the Moon by Pink Floyd")
- **Custom values** -- Any string can serve as a custom status type (e.g., "gaming", "reading")

### Content Field

The `content` field holds the status text. It can be any free-form string. To **clear** a status, publish a kind:30315 with the same `d` tag and **empty content**.

### Optional Tags

- **`r` tag** -- URL reference associated with the status (e.g., a link to the song, project, or activity)
- **`expiration` tag** -- NIP-40 expiration timestamp. When set, the status auto-expires after the given Unix timestamp. Relays should discard expired events.
- **Custom emoji tags** -- NIP-30 emoji shortcodes can be used in content with corresponding `emoji` tags

### Parameterized Replaceable Semantics

Each unique `d` tag value is a separate replaceable slot. A user can have a `general` status and a `music` status simultaneously -- they are independent. Updating one does not affect the other.

## TOON Write Model

Publishing status events on TOON is a paid write. Use `client.send()` from `@toon-protocol/client` -- never raw WebSocket writes.

**What it costs:** ask the node, do not multiply bytes. `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, and `chargeFor(terms, sealedBytes)` turns that into a charge; the metered quantity is the **sealed** payload, not the event JSON. The live relay route `g.toon.relay` is priced at 1 base unit, **flat** -- $0.000001 in 6-decimal USDC -- so a 200-byte status and a 400-byte one cost the same.

Because kind:30315 is parameterized replaceable, only the latest version per `d` tag matters on the network -- but each update is another paid write. For the complete publishing flow, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Reading (free, plain NIP-01)

Reading user statuses is free. Subscribe using NIP-01 filters: filter by `kinds: [30315]` and `authors: [<pubkey>]` to fetch all statuses for a user, or add `#d: ["general"]` to fetch a specific status type.

Reads are free and speak plain NIP-01: the relay returns standard JSON `EVENT` messages, and any ordinary Nostr client can read it. A free read never touches a connector. TOON encodes the **write** payload -- the bytes a client seals inside the ILP packet for the app at the other end -- and never the relay's responses. For the write payload's TOON encoding, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Statuses signal availability and activity. On a network where every write is attributable, a status update is a deliberate communication under a real settlement identity. Respect what statuses convey: a "busy" or "DND" status means the user does not want to be disturbed; a "music" status is casual sharing, not an invitation for commentary.

Status updates are transient by nature. Use the `expiration` tag for time-bound statuses (conference attendance, temporary availability) so they auto-clear rather than going stale. A stale "At the hackathon" status from last month looks careless.

The parameterized replaceable model means each update fully replaces the previous one per `d` tag -- there is no history. That keeps the payload small and the relay's storage bounded. It also means you should not use statuses as a journaling mechanism.

Do not mistake the payment for a spam deterrent: at 1 base unit, cycling a status every minute for a day costs $0.00144. What it is instead is a gate -- every update arrives with a signed claim on your funded channel and is attributable to you. Set a status when your state meaningfully changes, not as a fidget, because rapid cycling is noise to your followers.

**Anti-patterns to avoid:**
- Updating status every few minutes like a micro-blog (use kind:1 notes for that)
- Setting a status and forgetting to clear it when it becomes stale
- Using verbose status text when a short phrase suffices (brevity is for the reader; on the flat relay route it is not cheaper)
- Ignoring expiration tags for inherently temporary statuses (conference, meeting, streaming)

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing kind:30315 events, understanding tag formats** -- Read [nip-spec.md](references/nip-spec.md) for the full NIP-38 specification.
- **Understanding TOON-specific status economics** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated status updates and fee optimization.
- **Step-by-step status management workflows** -- Read [scenarios.md](references/scenarios.md) for setting, updating, expiring, and clearing statuses on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Profile context for status display** -- See `social-identity` for kind:0 profile metadata that provides context alongside statuses.
- **Linking status to external content** -- See `content-references` for nostr: URI scheme and `r` tag URL conventions.
