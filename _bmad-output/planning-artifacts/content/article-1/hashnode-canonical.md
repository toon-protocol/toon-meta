## Running on Faith

You run a relay because you believe in something. Censorship resistance. Permissionless publishing. A social protocol that nobody controls. You set it up on a VPS, configured the software, opened the WebSocket port, and told people to add your URL.

And then the bills came.

You're not alone. Roughly 95% of Nostr relays cannot cover their operational costs. Of over 1,000 tracked relays, [343 have already gone dark](https://www.glukhov.org/post/2025/10/nostr-overview-and-statistics/). The rest are held together by goodwill, side projects, and the stubborn hope that something will change.

This article isn't about selling you a solution. It's about understanding why the problem is structural — and why fixing it matters for the future of the protocol.

---

## The Network Is Healthy. The Infrastructure Isn't.

As of early 2026, the Nostr network has grown to over [315,000 profiles](https://socialcapitalmarkets.net/crypto-trading/nostr-statistics/) with bios or contact lists. More than 228,000 daily events flow across 178+ relays that each host at least 5% of the network's content. Over 11 million events have been published in total. Jack Dorsey's [$10 million donation](https://socialcapitalmarkets.net/crypto-trading/nostr-statistics/) signaled that serious people take this protocol seriously.

The demand side is healthy. People are publishing. People are reading. Clients are improving. NIPs are evolving. The protocol is alive.

But the infrastructure layer — the relays that actually store and serve all this data — is in trouble. A third of all tracked relays have gone offline. Most of the ones still running are subsidized by their operators' other income. Running a relay is, for most people, a volunteer activity.

The question isn't whether Nostr works. It does. The question is whether its infrastructure can survive contact with economic reality.

---

## The Models That Exist Today

The Nostr community isn't ignoring this problem. Several paid relay models have emerged, each taking a different approach.

### Subscriptions: nostr.wine

The largest paid relay charges [roughly $7 per month](https://nostr.wine/). For that, you get NIP-42 authentication for DM privacy, regional mirrors across the US, Finland, and Japan, and full-text search via NIP-50. It's the most feature-rich paid relay on the network. filter.nostr.wine adds another layer — 10,000 sats per month to filter the global firehose down to your web of contacts. It requires a nostr.wine membership on top.

The subscription model works for power users willing to pay for premium features. But it creates a two-tier system: those who can afford better relay service, and everyone else.

### One-Time Payments: expensive-relay and nerostr

Fiatjaf — Nostr's creator — built [expensive-relay](https://github.com/fiatjaf/expensive-relay) as a reference implementation. A single Lightning payment whitelists your public key. It's elegant and simple: pay once, write forever. [nerostr](https://github.com/pluja/nerostr) takes the same approach with Monero.

The problem with one-time payments is that they don't scale with usage or time. A relay's costs are ongoing — bandwidth, storage, compute. A one-time payment covers day one. It doesn't cover month six.

### Free Relays: The Majority

Most relays are free. Some accept donations. A few run on Cloudflare Workers (like Nosflare) to minimize costs. But free relays face a fundamental challenge: as the network grows, costs grow, and there's no mechanism to fund them beyond the operator's wallet.

---

## Why None of Them Scale

Each of these models has merit. None of them are wrong. But they share a structural limitation: they don't align payment with the thing that actually costs money.

What costs money on a relay? **Writes.** Every event that gets stored consumes disk space, indexing overhead, and bandwidth when it's later retrieved. Reads are cheap — serving cached data is what commodity infrastructure does well. Writes are expensive — they require validation, storage, and propagation.

Subscriptions charge a flat fee regardless of how much you write. Heavy writers subsidize light users, and light users may not subscribe at all because the value proposition isn't clear enough.

One-time payments create the same misalignment: a user who writes 10,000 events pays the same as one who writes 10.

Free relays simply absorb the cost entirely, which works until it doesn't — as the 343 offline relays demonstrate.

The structural problem is this: **Nostr's economic model doesn't have a built-in mechanism for the people who create costs to bear those costs.** The protocol is beautifully designed for censorship resistance and client portability. But it has no native concept of "this event costs something to store."

Imagine if email servers had no business model. That's where Nostr relays are today.

---

## Why This Matters Beyond Relay Operators

This isn't just a relay operator problem. It's a protocol-level risk.

Nostr's censorship resistance depends on relay diversity. If you can add your events to dozens of independent relays, no single authority can silence you. But if most relays can't sustain themselves, the network consolidates around a few well-funded operators. That's not censorship resistance — that's a different kind of centralization.

The math is uncomfortable: an [82.5% growth](https://socialcapitalmarkets.net/crypto-trading/nostr-statistics/) in Lightning-addressed Nostr profiles shows the community is increasingly comfortable with payments. People are zapping posts. They're sending sats to content creators. The willingness to pay is there. But the payment layer and the relay infrastructure layer aren't connected.

Zaps reward content creators. Nobody zaps a relay.

There's a gap between "I'll pay for content I like" and "the infrastructure that delivers this content needs funding." And until that gap closes, relay operators will continue to subsidize the network out of their own pockets — until they can't anymore.

As the [Nasdaq](https://www.nasdaq.com/articles/nostr-will-only-scale-if-it-can-incentivize-users-to-run-relays) put it: "Nostr will only scale if it can incentivize users to run relays." The broader tech world is watching, and they see the same problem we do.

---

## The Question

This article doesn't have a product to pitch. But it does have a question:

**What if the protocol itself could make relays economically viable?**

Not through donations. Not through subscriptions. Not through one-time payments that don't align with ongoing costs. But through a model where the act of writing to a relay — the thing that actually costs the relay money — is the thing that funds it.

Pay per write. Free to read.

The protocol already separates event creation from event storage. Clients sign events. Relays store them. What if that boundary was also an economic boundary?

That's not a rhetorical question. People are working on it. But regardless of the approach, the Nostr community needs to have this conversation — because the current trajectory, where 95% of relays run at a loss and a third have already shut down, is not sustainable.

The protocol works. Now it needs to survive.

---

*If you operate a relay, I'd love to hear about your experience with costs, revenue experiments, and what you think a sustainable model looks like. The conversation matters more than any single solution.*
