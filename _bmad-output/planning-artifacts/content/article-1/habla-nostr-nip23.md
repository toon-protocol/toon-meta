# 95% of Nostr Relays Can't Cover Costs. Here's Why That Matters.

You run a relay because you believe in something. Censorship resistance. Permissionless publishing. A social protocol nobody controls. You set it up on a VPS, opened the WebSocket port, told people to add your URL.

And then the bills came.

You're not alone. Roughly 95% of Nostr relays cannot cover their operational costs. Of over 1,000 tracked relays, 343 have already gone dark. The rest are held together by goodwill, side projects, and stubbornness.

This isn't a pitch. It's an attempt to understand why the problem is structural — and why fixing it matters for all of us.

---

## The Network Works. The Economics Don't.

Nostr has grown to over 315,000 profiles. More than 228,000 daily events flow across 178+ relays. Over 11 million events published. Jack Dorsey put $10M behind it. Clients are getting better every month. NIPs keep evolving.

The demand side is healthy. The infrastructure isn't.

A third of all tracked relays have gone offline. Most of the surviving ones are subsidized by their operators out of pocket. Running a relay is volunteer work.

The question isn't whether Nostr works. It does. The question is whether its infrastructure can survive economic reality.

## Today's Models

**Subscriptions (nostr.wine):** ~$7/month. NIP-42 auth, regional mirrors, NIP-50 search. Works for power users. Creates a two-tier system — premium service for those who pay, everyone else on free relays.

**One-time payments (expensive-relay, nerostr):** Single Lightning or Monero payment whitelists your pubkey. Elegant, simple. But relay costs are ongoing. A one-time payment covers day one, not month six.

**Free relays (the majority):** Some accept donations, some run on Cloudflare Workers. As the network grows, costs grow. No funding mechanism beyond the operator's wallet.

**Donations:** Sporadic, unpredictable, and nowhere near enough for most operators.

## The Structural Misalignment

All these models share a limitation: they don't align payment with the thing that actually costs money.

What costs money on a relay? **Writes.** Every event stored consumes disk space, indexing overhead, and bandwidth when it's later retrieved. Reads are cheap — serving cached data is commodity infrastructure. Writes are expensive — validation, storage, propagation.

Subscriptions charge flat fees regardless of write volume. One-time payments ignore ongoing costs entirely. Free relays absorb everything until the operator gives up.

**Nostr's economic model doesn't have a built-in mechanism for the people who create costs to bear those costs.**

The protocol is beautifully designed for censorship resistance and client portability. But it has no native concept of "this event costs something to store."

## Why This Matters for Everyone

This isn't just a relay operator problem. It's a protocol-level risk.

Nostr's censorship resistance depends on relay diversity. If most relays can't sustain themselves, the network consolidates around a few well-funded operators. That's not censorship resistance. That's a different kind of centralization.

Here's the uncomfortable part: 82.5% growth in Lightning-addressed profiles shows this community is comfortable with payments. People zap posts. They send sats to creators. The willingness to pay is there.

Zaps reward content creators. Nobody zaps a relay.

There's a gap between "I'll pay for content I like" and "the infrastructure that delivers this content needs funding." Until that gap closes, relay operators subsidize the network out of pocket — until they can't.

## The Question

What if the protocol itself could make relays economically viable?

Not donations. Not subscriptions. Not one-time payments that don't match ongoing costs.

What if the act of writing to a relay — the thing that costs the relay money — is the thing that funds it?

Pay per write. Free to read.

The protocol already separates event creation from event storage. Clients sign events. Relays store them. What if that boundary was also an economic boundary?

People are working on this. But the conversation matters more than any single approach. The current trajectory — 95% of relays at a loss, a third already gone — is not sustainable.

The protocol works. Now it needs to survive.

---

*Running a relay? I want to hear about your experience — costs, revenue experiments, what you think sustainable looks like. Reply or zap if this resonated.*

---

*Originally published on [Dev.to](https://dev.to/jonathan_greenallidoizc/95-of-nostr-relays-cant-cover-costs-heres-why-that-matters-189l)*
