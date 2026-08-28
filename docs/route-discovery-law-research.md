# Route discovery — what the connector's law left open and closed for an app-layer object

**Status:** Research note · **Date:** 2026-08-28 · **Audience:** whoever designs a relay-published, third-party-signed "which roads exist and are worth walking" object for TOON clients

The question: the connector team has ruled, in ADRs, on how a connector is found and what it will
and won't say about itself. A separate team wants an **app-layer object** — published through a
Nostr relay, signed by someone other than the connector — that lets a TOON *client* learn which
multi-hop ILP roads (e.g. `g.toon.relay.store`) exist and are worth walking. What did the
connector's law leave **open** for that object, and what did it **close**?

Everything below is quoted verbatim from local primary sources and cited inline as
`path §heading`. Where a source does not say something, this note says so. No design
recommendations are made; §6 is a list of questions, not answers.

Sources read: connector ADRs 0006, 0011, 0022, 0030, 0042, 0044, 0046, 0049, 0050;
`docs/protocol/self-description-spec.md`; `CONTEXT.md` (main, plus the **Path** entry that exists
only on the unmerged `docs/the-yellow-brick-road` branch); the essay
`docs/the-yellow-brick-road.md` (unmerged branch, read via `git show`, repo untouched);
toon-client's `ToonClient.ts` header and `docs/api.md`; toon-meta's `docs/protocol.md` and
`docs/bootstrap.md`.

---

## 1. Summary

The connector's law closes the *connector's* side of discovery completely and hands the rest away
by name. A conforming connector never announces, has no mechanism by which it could, must work in
a network with no relay anywhere in it, and describes only itself — never its peers, never their
caps or fees, never the software behind it, and never a list of anything (ADR 0022, 0046, 0050,
self-description-spec ND-05/ND-08/ND-09; ADR 0044 "no listing, no enumeration and no index"). It
answers what it is asked, free and unauthenticated, at `GET /ilp`, and that surface never accepts a
write (ADR 0050, ND-03). Anything a hop carries back unsealed — a reject, a greeting in flight —
may have been rewritten by that hop, so a path cannot be trusted to name the key at its end
(ADR 0022 §Context, ND-14/ND-16); and the route description a connector does give is "a menu, not
a warranty" (ADR 0044 §Consequences). What is explicitly left **open** is the whole of copying those
facts elsewhere: "Whether those facts are then copied into a discovery network, by whom, in what
format, and signed by which key, is the **controller's** business" (ADR 0046 §Why); a third party's
announce "is a different object" that "Anyone building … is defining a new thing and should say so"
(ADR 0046 §Consequences); what runs behind a connector "the operator advertises … elsewhere"
(ADR 0050 §What it carries); and route-cost discovery is by walking — "a probe" — never by a
published figure (ADR 0011, 0049). The yellow brick road essay goes further than the ADRs: it says
trust in a road is "not announced, not learned, not bought — walked", and that the only reputation
that means anything is "the record of your own packets coming back fulfilled". Downstream,
toon-meta's `protocol.md` and `bootstrap.md` still describe kind:10032 as the route-advertisement
mechanism, which ADR 0046 removed.

---

## 2. Closed — hard constraints the ADRs impose on any discovery object

Each entry: constraint in one sentence → verbatim quote → source.

### 2.1 A connector never announces, and nothing in it can

> "**A connector does not announce itself, and there is no mechanism by which it could.**
> `connector announce` is removed, the kind:10032 `IlpPeerInfo` event is no longer produced by this
> implementation, and nothing in a conforming connector depends on a Nostr relay existing."
> — `connector/docs/adr/0046-the-kind-10032-announce-is-removed-a-connector-needs-no-relay.md`, opening paragraph

> "**Announcing** is pushing facts about yourself into a network unprompted — `announcePrice`,
> kind:10032 self-announce. A connector never does this. Deciding to participate in a discovery
> network is the controller's business, and ADR 0006 stands unchanged."
> — `connector/docs/adr/0022-a-connector-answers-it-does-not-announce.md` §Decision

> "The connector forwards what it is told to forward and settles what it is told to settle. It
> does not decide who its peers are, does not learn routes, and does not announce itself.
> Discovery is removed entirely; the operator surface exposes CRUD over the routing table and
> over payment-channel lifecycle, and an external controller drives both."
> — `connector/docs/adr/0006-the-connector-is-mechanism-not-policy.md`, opening paragraph

Glossary form: "**Announcing**: Pushing facts about yourself into a network unprompted. A connector
never does this: deciding to participate in a discovery network is the controller's business.
_Distinct from_: answering, which a connector does do." — `connector/CONTEXT.md` **Announcing**.

**Consequence for the object:** the connector will not produce, sign, publish, refresh, or pay for
it. ADR 0030's operator-run `connector announce` — the one exception ever granted — is "**Retired by
[0046]**" (`0030 …` Status line) and the subcommand "is refused by name too" (`0046` §Update (issue #1074)).

### 2.2 A connector must work with no relay in the world

> "**An announce assumes a relay.** … That is an entire second protocol stack, made mandatory, in
> service of one thing: being discovered. And it is not reachable at all for the case this protocol
> has to serve first — **a network of pure connectors**, peering with each other, with no relay
> anywhere in it. Such a network cannot announce, so a discovery design that only works when a
> relay exists is not a property of the protocol. It is a property of one application built on top
> of it, compiled into the connector."
> — `0046 …` §Why — the reason that must survive, or this gets rebuilt

**Consequence for the object:** by the connector's own framing, a relay-published discovery object
is "a property of one application built on top of it" — it cannot be something a connector, a
peering, or the packet path depends on.

### 2.3 A third-party announce is "a different object" and must be named as such

> "**A third party's announce is a different object, and this record does not define one.** If a
> controller publishes facts about a node it did not sign, the event is that controller's claim
> about the node rather than the node's claim about itself — a materially different security
> property from what kind:10032 has meant. Anyone building that is defining a new thing and should
> say so."
> — `0046 …` §Consequences

**Consequence for the object:** it may not reuse kind:10032's meaning ("the node's claim about
itself"). It is a claim *about* nodes and roads made by whoever signs it, and the law requires that
difference to be stated, not blurred.

### 2.4 The self-description carries connector facts only; no per-peer facts; topology is private

> "**Connector facts only** — things this node either proved at startup or was configured with,
> about itself"
> — `connector/docs/adr/0050-a-connectors-url-resolves-to-its-self-description.md` §What it carries

> "**It does not carry per-peer facts.** Caps and peerings are operator-private ([0049], [0006]):
> publishing them would disclose who this node peers with and how far it trusts each."
> — `0050 …` §What it carries

> "**ND-09** `[connector]` — It MUST NOT carry **per-peer** facts: peer identities, per-peering
> fees, or caps. Publishing them discloses who this node peers with and how far it trusts each — an
> operator-private relationship ([ADR 0006], [ADR 0049])."
> — `connector/docs/protocol/self-description-spec.md` §1.3 What it does not carry

> "**4. The cap is not published in advance.** Caps are per-peer, and a public self-description
> listing them would disclose who this node peers with and how far it trusts each — a relationship
> [0006] and [0043] make operator-private. Only the peer concerned ever learns its own cap, and only
> by being refused once."
> — `connector/docs/adr/0049-the-cap-bounds-one-packet-is-discovered-by-t04-and-is-set-from-outside.md` §Decision

> "**Returning a sum leaks nothing.** The total is what a caller must know in order to use the
> path. The per-hop breakdown is not, and is never returned, so topology and individual pricing
> stay private."
> — `connector/docs/adr/0011-rejects-accumulate-fees-and-probes-discover-cost.md` §Properties this inherits from earlier decisions

> "Had every hop annotated a reject, the reject would have become the topology dump that ADR 0011
> was careful not to produce."
> — `connector/docs/adr/0044-a-probe-answers-what-a-route-costs-and-what-it-does.md` §Only the termination describes; every hop still costs

**Consequence for the object:** nothing a connector publishes will tell a third party who a
node peers with, what it charges a peer, or how far it trusts one. A road object that names hops
is asserting facts the connector deliberately keeps private and will not confirm.

### 2.5 The self-description does not describe what runs behind the connector

> "**It does not describe what runs behind the connector.** `relay_url` — an operator's assertion
> that a Nostr relay for free reads sits behind this node — is **dropped**. [0046] established that
> a conforming connector must work with no relay in the world, and this was the last place that
> assumption survived. A connector is a paid reverse proxy; what is behind it is the app's business
> and the operator advertises it elsewhere. The document's meaning stays uniform: **everything in
> it is true of this connector**."
> — `0050 …` §What it carries

> "**ND-08** `[connector]` — It MUST NOT describe software **behind** the connector. A connector is
> a paid reverse proxy; what runs behind it is the app's business."
> — `self-description-spec.md` §1.3

**Consequence for the object:** "what is at the end of the road" (a relay, a store, a mill) is
exactly what the connector refuses to state. Only ADR 0044's operator-written `description` will
ever say what a route *does*, and it is not built (see 2.7).

### 2.6 No listing, enumeration or index

> "**Nothing becomes discoverable that was not already reachable.** A caller learns a description
> only for a route it addressed and a node that answered. There is no listing, no enumeration and
> no index — those would be announcing, and ADR 0022 still refuses them."
> — `0044 …` §Consequences

> "A stranger who has this node's URL at all therefore has its description, with nothing further
> to discover."
> — `0050 …` §Why one document, and why at that URL

**Consequence for the object:** a connector will never serve a list of nodes, routes, or peers. An
index of roads has to be assembled from outside, one URL at a time, by whoever already knows the
URLs.

### 2.7 A description is a menu, not a warranty — and it is not built

> "**A description is untrusted input to whoever reads it.** It is operator-written free text about
> a service a caller has not used yet, and nothing verifies that the route does what it says. It is
> a menu, not a warranty, and a client that renders one must treat it as text from a stranger."
> — `0044 …` §Consequences

> "**Status:** Accepted, **not yet built**. No `description` field exists in `connector-config`'s
> route schema, and nothing carries one on a greeting or a reject."
> — `0044 …` Status line

> "The description comes from **this connector's own configuration** and from nowhere else — never
> by asking the app, never by inspecting a payload."
> — `0044 …`, opening paragraph

**Consequence for the object:** even the connector's own statement of what a route does is
"text from a stranger". A third party's copy of it can be no stronger.

### 2.8 Hops rewrite rejects; nothing unsealed from a path can be trusted to name a key

> "The obvious route — carry the key back in a reject, as ADR 0011 carries accumulated cost — does
> not survive contact with the threat model. Hops rewrite rejects by design (`connector.rs:719`
> adds each hop's fee to a reject passing back), so any hop on the path can substitute its own key
> into a greeting in flight. Intermediaries are exactly the parties positioned to do this, and
> exactly the parties the wrap exists to defend against. Signing the greeting does not help,
> because verifying the signature requires the key being learned."
> — `0022 …` §Context

> "**ND-14** `[connector]` — A connector MUST NOT relay another node's identity key as if it were
> an answer. A client learns an identity **from the node that owns it**."
> — `self-description-spec.md` §2 Forwarded routes: whose identity?

> "If a hop supplies the key it will forward to, it can supply **its own**: the client seals to it,
> that hop opens the payload and derives the fulfilment itself ([ADR 0019]), terminates the packet
> and pockets the payment. The client receives a **valid-looking fulfilment and never learns it was
> robbed**."
> — `self-description-spec.md` §2, note under ND-14

> "**ND-16** `[client]` — A client MUST NOT trust an identity learned from an unsealed reject. It
> fetches the identity from the URL, over TLS, from the node itself. **Ask direct, pay through.**"
> — `self-description-spec.md` §2

> "A URL is safe where a key is not: a substituted URL yields an identity that produces packets the
> real terminating connector cannot open, so a sender finds out on the **next packet** rather than
> losing money silently."
> — `self-description-spec.md` §2

> "The key property is the asymmetry between the two paths: **a sender asks the terminating
> connector directly, over its own connection, and pays through whatever path routing chooses.**
> Nothing carries the answer but the connection that requested it, so there is nothing in between
> to substitute."
> — `0022 …` §Decision

Glossary form: "A sender asks directly and pays through the network, so what it learns by asking
is not something an intermediary can substitute." — `connector/CONTEXT.md` **Answering**.

**Consequence for the object:** ND-16 binds the *client*, not just the connector. A road object
that carries a terminating node's sealing key is an intermediary's copy of exactly the fact the law
says must be fetched "from the node itself". A URL in such an object is in the "safe where a key is
not" class; a key is not.

### 2.9 `GET /ilp` never accepts a POST

> "**This endpoint never accepts a write, and never becomes a surface on which a stranger requests
> peering.** It publishes what an operator needs to configure a peering out of band; a peering
> itself is created by an operator in the config file or through the operator surface, and by
> nothing else ([0043], [0006])."
> — `0050 …` §Facts only. There is no `POST`.

> "**ND-03** `[connector]` — It MUST NOT accept a `POST`, or any other write, **ever**."
> — `self-description-spec.md` §1.1

**Consequence for the object:** the object cannot be pushed to a connector, registered with one,
or used to request a peering from one. There is no write door for it to use.

### 2.10 Cost and cap are discovered by walking, and are not published in advance

> "Every reject carries a running total of the fees of the hops it has passed through: each hop
> adds its own fee before passing the reject upstream. Cost discovery is then a packet you expect
> to be rejected — a probe — and the reject that comes back states what the path costs."
> — `0011 …`, opening paragraph

> "Interledger removed ILQP because a quote is computed over a path chosen at quote time, which
> need not be the path a real packet later takes; the answer is precise about a route you did not
> use. A probe has no such gap."
> — `0011 …` §Why not a quoting protocol

> "**A published cap would have been a hint, not a contract.** Because the cap is settable at
> runtime, any value published in advance can be stale by the time it is used, so the `T04` path
> must stay authoritative regardless. That is what decided clause 4: once the rejection is
> authoritative, a second advisory source is a surface to maintain and keep honest, for the saving
> of one packet."
> — `0049 …` §Consequences

> "**The reject's message carries the current cap**, and that is the only way a sender learns it."
> — `0049 …`, opening paragraph

> "A probe traverses the network and pays nothing, so it is accepted only from a sender that
> already holds an open payment channel with this connector, and is rate-limited per that
> identity."
> — `0011 …` §Consequences

**Consequence for the object:** a published path cost or cap is, in the connector's own words, "a
hint, not a contract" and "precise about a route you did not use". The law also notes fee honesty
"stopped being free" (`0011 …` §Update (ADR 0042)): "such a hop banks the covering claim and
refuses to carry", so a road's advertised price is bounded only by "the sender's own packet sizing,
and the per-peer cap".

### 2.11 Trust is policy, and policy lives outside the connector

> "**5. A connector never raises its own cap.** A cap that grows with demonstrated good behaviour is
> a **trust** mechanism, and trust is policy. Under [0006] policy lives outside the connector.
> Earning is a **controller's** job: it watches whatever history it chooses and writes a new cap
> through the operator surface. The connector enforces the number it was given and decides
> nothing."
> — `0049 …` §Decision

> "Value in flight is therefore at risk, and bounding that risk is the **sender's** business rather
> than the protocol's: small packets, and larger ones only on a path that has earned them."
> — `connector/docs/adr/0042-a-packet-carries-its-claim.md`, opening paragraph

> "**Trust buys packet size, never deferred payment.** A well-trodden path earns a larger cap. It
> never earns the right to owe"
> — `0042 …` §Consequences

**Consequence for the object:** "worth walking" is a trust judgement, and the law places it with
the sender/controller. A connector will neither compute nor publish it.

---

## 3. Open — what the ADRs explicitly hand outward

### 3.1 ADR 0046: copying facts into a discovery network is the controller's business

> "**What replaces it: nothing, inside the connector.** A connector answers what it is asked
> (ADR 0022), and a `GET` on its URL resolves to its self-description (issue #1060). Whether those
> facts are then copied into a discovery network, by whom, in what format, and signed by which
> key, is the **controller's** business — outside the connector by definition (ADR 0006), and now
> outside it in fact as well as in principle."
> — `0046 …` §Why — the reason that must survive, or this gets rebuilt

> "`g.toon.ario`'s discoverability depended on an announce; whatever replaces it is a controller
> concern, outside the connector by definition (ADR 0006)."
> — `0046 …` §Update (issue #1074)

Four things named open: *whether*, *by whom*, *in what format*, *signed by which key*.

### 3.2 ADR 0046: a third party may define "a new thing" — provided it says so

> "Anyone building that is defining a new thing and should say so."
> — `0046 …` §Consequences (full quote in §2.3 above)

The permission and the constraint are the same sentence.

### 3.3 ADR 0050: what is behind a connector, the operator advertises elsewhere

> "A connector is a paid reverse proxy; what is behind it is the app's business and the operator
> advertises it elsewhere."
> — `0050 …` §What it carries

The self-description spec's gloss on the same rule: "what runs behind it is the app's business"
(`self-description-spec.md` ND-08). The connector says nothing about *where* "elsewhere" is.

### 3.4 ADR 0044: the greeting-vs-reject split — node facts vs path facts

> "Two surfaces already answer this question, and they answer different halves:
>
> - **The x402 greeting** is free, comes from the node you addressed directly, and already carries
>   `extra` facts about that node (`price`, `ilpAddress`, `requiredTransport`, and since issue #807
>   `addresses`/`btpEndpoint`). It is the natural carrier for a **description**, which is a fact
>   about one node.
> - **A probe's reject** accumulates across hops and is the only thing that can report **path
>   cost**, which is a fact about a route rather than a node.
>
> **Both carry the description; only the reject carries the sum.**"
> — `0044 …` §Where it rides

> "`accumulated_cost` stays outside the ADR 0018 seal as it always has. **A description does not** —
> on a reject raised at the termination it rides inside the sealed response, because it is the
> destination's own answer and sealing is what makes it provably the destination's."
> — `0044 …` §Where it rides

What this leaves open: the connector distinguishes *node facts* (free, unauthenticated, from the
node itself) from *path facts* (only learnable by a paid, channel-holding walker). No connector
surface combines them, and no connector surface reports a path fact to anyone but the walker who
probed.

### 3.5 ADR 0030: who may honestly announce — the three things only the node has

> "Three things are needed to make an announce honestly, and only the announced node has all three:
> the **identity key** the event is signed with, the **settlement facts** the announce advertises,
> and a **channel** with somebody who can carry the packet. A sidecar can be given at most one of
> them, and the one it is easiest to give it is the key."
> — `connector/docs/adr/0030-an-operator-announces-a-node-the-node-still-does-not.md` §Context

ADR 0046 keeps this reasoning while retiring the mechanism:

> "[ADR 0030] reasoned carefully about **who** may announce, and reached the right answer to the
> question it asked: the operator, from the box holding the key, because only the announced node
> holds all three of the identity key, the settlement facts and a channel to pay with. That
> argument is not wrong. It is answering a question this record removes."
> — `0046 …` §Why

And 0030 itself, on what a sidecar announcer would have to become:

> "**Teaching the sidecar to pay.** It would need a channel, a claim signer and a durable
> watermark — i.e. it would need to become a connector. Rejected: that is the thing it is standing
> next to."
> — `0030 …` §Considered options

What this leaves open: an object signed by someone other than the node has, by 0030's own
accounting, *none* of the three. The law does not forbid such an object (0046 §Consequences
permits "a new thing"); it records that it is a different kind of claim.

### 3.6 ADR 0022: a signed announce remains the fallback for an unreachable terminator

> "**A signed announce binding address to key**, verified against an identity the client already
> trusts. Genuinely solves substitution, and the org has the machinery. Rejected as the primary
> mechanism because it needs a trust root, a distribution path and a revocation story to answer a
> question a direct connection answers for free — and because the endpoint has to exist anyway for
> peering. It remains the fallback if a terminating connector ever cannot be reached directly."
> — `0022 …` §Considered options

What this leaves open: the three things a signed announce would need — "a trust root, a
distribution path and a revocation story" — are named and unassigned.

### 3.7 ADR 0006: self-announcement and route learning are "moved, not dropped"

> "**Nothing announces any more, and that gap is now external.** An empty bootstrap seed previously
> produced hardcoded address literals and 404s for new users. Self-announcement and route learning
> are moved, not dropped, and the component that owns them has to exist somewhere else before the
> network can grow past its static configuration."
> — `0006 …` §Consequences

### 3.8 The discovery half of a forwarded route is unbuilt and out-of-band today

> "It does not supply the **discovery**: a client still has to learn the terminating connector's
> URL, and ND-14 forbids the first hop from handing over another node's identity. That step is
> [0054]'s unsealed reject (#1083), which is not built. Until it is, a forwarded route is reachable
> only when the client already knows the terminating node's URL out of band."
> — `0050 …` §Update (issue #1080)

> "**ND-15** `[connector]` — A termination that cannot open a packet's wrap MUST answer with an
> unsealed reject carrying **where to ask** — the terminating connector's URL."
> — `self-description-spec.md` §2 (marked "**Not built**" in §3 Consistency)

What this leaves open: today, "out of band" is the only way a client learns a terminating URL.
Once ND-15 lands, the connector's own answer is a **URL**, never a key; and ND-16 says the client
then fetches the identity "from the node itself".

### 3.9 The client SDK's stated bootstrap: one URL, no discovery

> "It resolves the configuration, derives the keys, opens the channel store, and makes exactly
> **one** free network call: `GET /ilp`, the node's self-description. That call is the whole of
> bootstrapping — there is no discovery, no relay and no peer list (connector ADR 0050) — and it is
> what settles the chain to settle on, since the node's own `settlements[]` is the authority
> (`self-description-spec.md` ND-07) and a preset is not."
> — `toon-client/packages/client/src/client/ToonClient.ts`, header comment §What `create` does, and what it refuses to do

> "`GET /ilp`. Cached per instance; `{ fresh: true }` re-reads. This is the whole of bootstrapping —
> addresses, endpoints, the sealing key, per-chain settlement terms and route prices."
> — `toon-client/docs/api.md`, `describe()` entry

> "| `connector` | required | Base URL or `…/ilp`; a trailing `/ilp` is normalized away. There is
> no discovery and no peer list — one URL is the whole of bootstrapping. |"
> — `toon-client/docs/api.md`, config table

What this leaves open: the client today takes its one URL from configuration. Where that URL comes
from is not the SDK's concern, and the SDK has no slot for a road.

---

## 4. The yellow brick road's claims

Source: `connector/docs/the-yellow-brick-road.md` on the unmerged branch
`docs/the-yellow-brick-road` (read with `git show`; not on `main`). Its glossary companion, the
**Path** entry, is likewise only on that branch's `CONTEXT.md`.

### 4.1 The three numbered ideas, verbatim

> "That is the first idea: **you never pay a destination. You pay a path.**"
> — §A destination is a name. A path is a commitment.

> "That is the second idea: **your exposure on a road is the step you are in the middle of.**"
> — §The road is walked in steps, and a step cannot be taken back

> "That is the third idea: **amount follows record. A well-trodden road is worth more than a short
> one.**"
> — §The road earns the traffic it carries

### 4.2 Name vs commitment

> "An ILP address — `g.toon.store`, `g.toon.relay.gas` — is a **name**. It is self-asserted,
> nobody allocates it, and it tells you nothing about how to reach it or what it will cost to try.
> You cannot send a packet "to" a name any more than Dorothy can walk "to" Oz. What you can do is
> hand your packet to the first hop on a road that claims to go there."
> — §A destination is a name. A path is a commitment.

> "Every hop on that road is a **peering** that some operator chose, on purpose, with a fee and a
> cap. … Two roads to the same name are two different things entirely — different hops, different
> fees, different records. The name is the same. The commitment is not."
> — same section

### 4.3 The "map vs road" passage, verbatim

> "She could have drawn a map. A map is a claim about where things are, made by someone who is
> not walking. The road is different: it is made of the walking. Every brick is where it is
> because a traveller needed it to be there, and every traveller who reached the City proved the
> road one step further."
> — §What Glinda knew

### 4.4 "Not announced, not learned, not bought — walked", verbatim

> "When you peer with a node, you are laying a brick. When you forward a packet across it, you
> are testing one. When it fulfils, the road is one packet longer than it was. That is the whole
> of how a route becomes trusted on this network: not announced, not learned, not bought — walked."
> — §What Glinda knew

> "So when someone asks how to reach `g.toon.store`, the honest answer is not an address. It is
> Glinda's answer.
>
> _Follow the road. Start small. Let the bricks earn the next step._"
> — §What Glinda knew

### 4.5 The reputation passage, verbatim

> "A road you opened this morning has carried nothing. Send it a small packet. If it fulfils, send
> another. A road that has fulfilled a thousand packets has earned a bigger one — not because
> anyone certified it, but because the bricks have been walked and they held. Reputation on a
> road is not a score somebody publishes; it is the record of your own packets coming back
> fulfilled, and it is the only reputation that means anything, because it is the only one you
> paid for yourself."
> — §The road earns the traffic it carries

> "Nothing in the config file can know how far you trust a road; only you can, and only from
> having walked it."
> — same section

### 4.6 What the essay says a client should base trust on — stated plainly from the text

From the passages above, the essay's position is that a client bases trust on **its own record of
fulfilled packets on that specific road**, and on nothing published by anyone else: reputation is
"the record of your own packets coming back fulfilled" and "the only one you paid for yourself";
a route becomes trusted "not announced, not learned, not bought — walked"; a map is "a claim about
where things are, made by someone who is not walking", contrasted unfavourably with the road,
which "is made of the walking". Trust is expressed as packet size ("amount follows record"), grown
by starting small. The essay opens by stating the same about the destination: "She does not trust
the Wizard. She trusts the road." (§introductory passage).

The essay's own "Where this is written down as law" footnote ties these to ADR 0042 ("small packets,
and larger ones only on a path that has earned them"), ADR 0049, ADR 0043 and ADR 0022, and RFC
0018 / RFC 0027.

The branch-only **Path** glossary entry states the same in glossary form:

> "**Path**: The sequence of hops a packet actually takes from the sender to the route that
> terminates it — each hop a **peering** somebody chose, taking its fee and carrying the packet on.
> A destination is a prefix; a path is what a sender commits value to, because every hop holds the
> claim it was handed and any hop may decline to carry. The exposure on a path is therefore the one
> packet in flight, and it is bounded by sizing packets to the path's record — small on a new path,
> larger on one that has fulfilled — never by escrow. Two paths to the same prefix are two different
> things to trust. _Avoid_: destination (when the path is meant), route (a route is one hop's
> mapping, not the whole path)"
> — `connector/CONTEXT.md` **Path** (branch `docs/the-yellow-brick-road` only; absent on `main`)

Note the vocabulary rule embedded there: "route" is one hop's mapping, "path" is the whole walk.
`main`'s glossary agrees on the first half: "**Route**: A mapping from a destination prefix to the
next hop that should carry it." — `connector/CONTEXT.md` **Route**.

---

## 5. Downstream still reading kind:10032

### 5.1 What ADR 0046 lists as consumers

> "**Downstream consumers read kind:10032 today** — `toon-client`'s `discovery-subscription.ts`,
> `@toon-protocol/core`'s `parseIlpPeerInfo`, `rig`, and genesis peer seeds. Removing the producer
> does not remove them, and the corpus stops being refreshed. Sequencing that is an operational
> task, not a protocol one, and is tracked separately."
> — `0046 …` §Consequences

> "**Downstream consumers were not touched, and this is the sequencing ADR 0046 already recorded
> as a separate operational task.** `toon-client`'s `discovery-subscription.ts`,
> `@toon-protocol/core`'s `parseIlpPeerInfo`, `rig` and the genesis peer seeds all still read
> kind:10032. Removing the producer does not remove them: the corpus simply stops being refreshed,
> and what those readers hold goes stale rather than wrong."
> — `0046 …` §Update (issue #1074)

Local check (2026-08-28): no file named `discovery-subscription*` exists under
`/home/jonathan/Documents/toon-client` outside `node_modules`, and no `parseIlpPeerInfo` symbol is
found there. The only remaining `10032` mentions in toon-client source are comments describing the
old shape, e.g. `packages/client/src/connector/ConnectorEdgeClient.ts:86` — "kind:10032 announce the
Rust fleet never makes." — and `packages/client/src/btp/transport-select.ts:17`. So 0046's
consumer list appears to be stale for toon-client; `rig`, `@toon-protocol/core` and the genesis
seeds were not checked.

### 5.2 toon-meta `docs/protocol.md` — stale lines

The §"Identity, Address, and Route" table still defines a route as a kind:10032 advertisement:

> "| **Route** | Dynamic advertisement — which paths exist in the network | Changes as peers
> join/leave | Advertised in kind:10032 events |"
> — `toon-meta/docs/protocol.md` §ILP Address Hierarchy › Identity, Address, and Route (line 109)

And its kinds table and surrounding text:

> "| **10032** | ILP Peer Info | Replaceable | Advertise node's ILP address, BTP endpoint, supported
> chains, settlement addresses, and TokenNetwork contracts |"
> — `toon-meta/docs/protocol.md`, event kinds table (line 11)

> "Kind 10032 is a [replaceable event] — publishing a new one with the same `d` tag replaces the
> old one. It serves as a node's business card: what chains it supports, where to settle, how to
> connect, and what it charges to forward traffic."
> — `toon-meta/docs/protocol.md` (line 13)

> "Each node advertises a `feePerByte` in its kind:10032 peer info event. This tells the network
> how much the node charges to forward a byte of data through it."
> — `toon-meta/docs/protocol.md` §Fee Advertisement (line 146)

> "This applies to both DVM compute (providers list skills and prices in kind:10035) and prefix
> claims (upstream nodes list prefix pricing in kind:10032)."
> — `toon-meta/docs/protocol.md` (line 203)

The mill section (lines 30–47) also instructs clients to "Always discover the recipient from the
mill's kind:10032 `pubkey`".

Each of these describes a producer that ADR 0046 removed ("the kind:10032 `IlpPeerInfo` event is
no longer produced by this implementation") and a fee model ADR 0011/0010 replaced ("Fees are per
peering relation — bilateral, local and private").

### 5.3 toon-meta `docs/bootstrap.md` — stale lines

> "│  Phase 1: DISCOVER … │  Query relay for kind:10032 events"
> "│  Phase 3: ANNOUNCE … │  Pay to publish own kind:10032 event"
> — `toon-meta/docs/bootstrap.md` §The Four Phases (diagram, lines 12–23)

> "Free read from any relay to find existing peers. The node subscribes to kind:10032 events,
> which contain each peer's ILP address, BTP endpoint, supported chains, and settlement addresses."
> — `toon-meta/docs/bootstrap.md` §Phase 1: Discover (line 34)

> "No handshake protocol is needed — all required information is publicly available in the
> kind:10032 event."
> — `toon-meta/docs/bootstrap.md` §Phase 2: Register (line 44)

> "The node pays to publish its own kind:10032 event to the network. … After announcement, other
> nodes can discover and peer with the new node."
> — `toon-meta/docs/bootstrap.md` §Phase 3: Announce (lines 48–50)

> "| **DiscoveryTracker** | After bootstrap, ongoing | Maintain a live list of available peers from
> incoming kind:10032 events |"
> — `toon-meta/docs/bootstrap.md` (line 63)

The connector-side replacement for "Phase 1" is `GET /ilp` (ADR 0050 / ND-01) and for "Phase 2" a
peering "established from a URL" (ADR 0058, referenced in 0050's Status line; not read for this
note). "Phase 3" has no replacement inside the connector by 0046's design.

---

## 6. Questions these sources leave unanswered for an app-layer road object

These are the gaps, phrased as questions. The sources above do not answer them.

**Identity and signing**

1. Who signs the object? ADR 0046 names the choice ("signed by which key") as the controller's and
   says nothing further. ADR 0030 says only the node holds "the identity key … the settlement facts
   … and a channel"; a third-party signer holds none of the three — what, then, does its signature
   attest?
2. What is the "trust root, a distribution path and a revocation story" (ADR 0022 §Considered
   options) for that signer, given the ADRs name all three as required for any signed announce and
   assign none of them?
3. How is the object named so that it is visibly "a different object" from kind:10032, as ADR 0046
   requires ("should say so")? Is a new kind number sufficient, or does the security-property
   difference need to be in the object's own text?

**What a road is, and what may be said about it**

4. What is the unit of the object — a destination prefix (a "name"), one hop's route mapping
   (`CONTEXT.md` **Route**), or a whole path (branch-only **Path** entry: "the sequence of hops a
   packet actually takes")? The essay says "Two roads to the same name are two different things
   entirely"; can a road be identified without naming its hops?
5. If a road is identified by its hops, whose per-peer facts are being disclosed? ND-09 and ADR 0049
   §Decision 4 make "who this node peers with" operator-private on the connector side. Does a third
   party publishing that relationship breach anything the operator can enforce, or only something
   the connector refuses to confirm?
6. What can the object say about what is at the end of a road, given ND-08 ("MUST NOT describe
   software behind the connector"), ADR 0044's `description` being unbuilt, and 0044's rule that
   even when built it is "text from a stranger"?
7. May the object carry a terminating node's sealing key? ND-16 says a client "MUST NOT trust an
   identity learned from an unsealed reject" and fetches it "from the node itself"; the spec says
   "A URL is safe where a key is not". Is a relay-published key any different from a hop-relayed
   one for this rule?

**Cost, cap, and "worth walking"**

8. In what unit and currency is a road's cost stated, if at all, given ADR 0011 (cost is a probe's
   accumulated sum, "cacheable" only because fees are flat) and ADR 0065 (a termination's price is a
   schedule over payload length)?
9. What does a published cost mean when ADR 0049 §Consequences says any published figure is "a
   hint, not a contract" and ADR 0011 says a quote is "precise about a route you did not use"?
10. Can the object say anything about cap, when ADR 0049 says "Only the peer concerned ever learns
    its own cap, and only by being refused once", and the essay says "Nothing in the config file can
    know how far you trust a road; only you can"?
11. What does "worth walking" mean as a field, if the essay holds that "Reputation on a road is not
    a score somebody publishes" and the only reputation "that means anything" is one's own record?
    Whose record would a published score be, and why would a client substitute it for its own?

**Verification by the client**

12. How does a client verify any claim in the object? The connector offers two checks — `GET /ilp`
    for node facts (free, unauthenticated) and a probe for path facts (requires "an open payment
    channel with this connector", rate-limited per identity, ADR 0011 §Consequences). Which claims
    are checkable by the first, which only by the second, and which by neither?
13. What does the client do when the object and the node's own self-description disagree? ND-11
    settles greeting-vs-document ("the **document** is authoritative"); nothing settles
    third-party-object-vs-document.
14. Does the object have a shelf life? ADR 0050 dropped `ttl_secs` because "a _pushed_ copy needed a
    shelf life; a pulled one does not". A relay-published object is a pushed copy.

**What leaks about the walker**

15. What does a client reveal by reading the object from a relay (which relay, which filter, which
    prefixes it is interested in)? The connector's answering model reaches "nobody who did not ask"
    and the asking is a direct TLS connection to the node; the sources say nothing about what a
    relay read discloses.
16. What does a client reveal by acting on it — probing a road requires a funded channel with the
    first hop and is "rate-limited per that identity" (ADR 0011), so a probe is attributable. Does
    an object that steers many clients to probe the same roads create an observable pattern?
17. If the object is refreshed from walkers' own records (the only reputation the essay admits),
    what of a walker's packet history is being published, by whom, and with what consent?

**Relationship to the relay and to the rest of the stack**

18. Which relay, and who pays to write the object there? ADR 0046 removed the connector's ability
    to pay for a relay write; ADR 0030's sidecar analysis says paying requires "a channel, a claim
    signer and a durable watermark — i.e. it would need to become a connector".
19. What replaces `g.toon.ario`'s discoverability, which 0046 §Update says "depended on an announce"
    and whose replacement "is a controller concern"? Is this object that replacement, or a different
    one?
20. What happens to the stale toon-meta descriptions (§5.2, §5.3) and the `rig` / `@toon-protocol/core`
    / genesis-seed readers 0046 names — are they retired, or is this object meant to be what they
    read next?

---

## 7. What I could not verify

- **ADR 0054** (the unsealed reject naming a URL) and **ADR 0058** (peering from a URL) were not in
  the source list and were not read; they are cited above only where 0050 / the self-description
  spec quote or point to them.
- `rig`, `@toon-protocol/core`'s `parseIlpPeerInfo`, and the genesis peer seeds (0046's other
  named kind:10032 consumers) were not inspected. Only toon-client was checked, where the named file
  no longer exists.
- The `docs/the-yellow-brick-road` branch was read with `git show` only; whether it is current with
  `main` beyond the essay and the **Path** entry was not examined. The essay's footnote points to
  "`CONTEXT.md`'s **Path** entry", which does not exist on `main`.
- The connector repo's working tree carried pre-existing staged changes unrelated to this note;
  none were touched.
