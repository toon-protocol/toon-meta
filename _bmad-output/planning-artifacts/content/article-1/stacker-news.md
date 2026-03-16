# 95% of Nostr Relays Can't Cover Costs — Let's Talk About Why

I've been digging into Nostr relay economics and the numbers are rough.

Of over 1,000 tracked relays, **343 have gone offline**. That's a 34% attrition rate. A third of the relays that somebody cared enough to set up and run are now dead.

The ones still running? For 95% of them, the operator is paying out of pocket. Running a relay is volunteer work.

Meanwhile, the demand side is fine:
- 315,000+ profiles with bios/contact lists
- 228,000+ daily events across 178+ relays
- 11M+ total events published
- Dorsey put $10M behind Nostr development

The protocol works. The economics don't.

## What People Have Tried

**nostr.wine** — ~$7/month subscription. NIP-42 auth, regional mirrors, full-text search. It's the most feature-rich paid relay out there, but subscriptions create a two-tier system and don't scale with usage.

**expensive-relay** — Fiatjaf's reference implementation. One-time Lightning payment whitelists your pubkey. Simple and elegant, but relay costs are ongoing. A one-time payment covers day one, not month six.

**nerostr** — Same idea, Monero instead of Lightning.

**Free relays** — The vast majority. Some take donations. Most just absorb costs until the operator burns out.

## The Core Problem

None of these models align payment with what actually costs money: **writes**.

Every event stored = disk space + indexing + bandwidth when someone reads it later. Reads are cheap (serving cached data is commodity infra). Writes are expensive (validation, storage, propagation).

Subscriptions charge flat fees regardless of write volume. One-time payments ignore ongoing costs. Free relays eat everything.

The result: **there's no built-in mechanism for the people who create costs to bear those costs.**

The protocol is brilliantly designed for censorship resistance. But it has zero concept of "this event costs something to store."

## Why This Should Worry You

Nostr's censorship resistance depends on relay diversity. If most relays can't sustain themselves, the network consolidates around a few well-funded operators. That's not decentralization — it's centralization with extra steps.

Here's what's weird: **82.5% growth in Lightning-addressed Nostr profiles.** This community pays for things. People zap posts. They send sats to creators.

Zaps reward content creators. Nobody zaps a relay.

The willingness to pay exists. The infrastructure funding mechanism doesn't.

## The Question

What if the act of writing to a relay — the thing that costs the relay money — was the thing that funded it?

Pay per write. Free to read.

The protocol already separates event creation from event storage. Clients sign, relays store. What if that boundary was also an economic boundary?

I don't have all the answers, but I think the conversation matters. **95% of relays at a loss and a third already dead is not a trajectory that ends well.**

---

**For relay operators:** What does your monthly cost look like? Have you tried charging? What happened?

**For everyone else:** Would you pay per event if it meant relays could actually survive? What's the right price point — or is there a better model I'm not seeing?
