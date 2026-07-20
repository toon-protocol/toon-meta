# RFC — Discovery, Peering & Naming on TOON

**Status:** Draft / design — no code. Circulate to the connector + relay owners before opening
implementation tickets.

**Question this answers.** *How does a node get into another node's routing table?* And two design
ideas the network keeps reaching for: **(A)** a Nostr NIP/Kind for advertising and **selling
routing-table spots / names**, and **(B)** using **ArNS** (Arweave Name System) as a decentralized
registry for ILP addresses so peers **own names globally**.

**TL;DR recommendation.** They are **complementary, not either/or**. Keep the shipped
`kind:10032` link-state mesh as the reachability layer; add **ArNS as the global, human-owned
identity handle** (idea B) bound to a node's permanent Nostr pubkey; and specify the already-reserved
**vanity-prefix kind** (idea A) as the *local* revenue mechanism for an apex selling addresses under
its own subtree. Three layers, three jobs — see §D.

---

## A. As-built: how a node enters another node's routing table

The data plane is an in-memory **longest-prefix-match** routing table (RFC-0027),
`connector/packages/connector/src/routing/routing-table.ts`. Each entry is
`{ prefix, nextHop, priority }` where `nextHop` is a connected peer id
(`packages/shared/src/types/routing.ts`). There are **three route populations, deliberately fenced
apart** so dynamic learning can never clobber operator intent:

| Source | How it's added | Priority | Persisted? |
|--------|----------------|----------|------------|
| **Config** | YAML `routes[]` at boot | 0 (default) | — (re-read from YAML) |
| **Runtime** | `POST /admin/routes`, peer registration | 0 | yes (write-through) |
| **Learned** | link-state computation | **−100** (`LEARNED_ROUTE_PRIORITY`) | no (re-derived each boot) |

A learned route **never overwrites** a config/runtime prefix (`addLearnedRoute` returns `false` on
collision). So there are exactly **three mechanisms** to become reachable:

1. **Static YAML** — `peers[]` (`PeerConfig`: `id`, `url`, `authToken`, `nip59PublicKey`,
   `relation`) + `routes[]` (`config/types.ts`). The baseline: hand-write the peer and a route whose
   `nextHop` is that peer.
2. **Admin API at runtime** — `POST /admin/peers` (optionally with routes + a settlement/funding
   block), `POST /admin/routes`, `PUT /admin/desired-state`
   (`connector/packages/connector/src/http/admin-api.ts`). The orchestrated path.
3. **Link-state route-learning over Nostr `kind:10032`** — the shipped dynamic path
   (toon-meta#153), and the substrate both ideas below build on:
   - Each connector publishes a **replaceable `kind:10032` `IlpPeerInfo`** event
     (`discovery/ilp-peer-info-event.ts`, `discovery/self-announce-builder.ts`) carrying an optional
     `routing` block: **`prefixes[]`** (the ILP prefixes this node originates/terminates, each with
     a `cost`) and **`adjacency[]`** (Nostr pubkeys of its direct BTP neighbours). Nodes announce
     **edges, not paths** — link-state, not path-vector.
   - `discovery/route-learning-service.ts` subscribes to `kind:10032` on configured relays, verifies
     signatures, feeds a `LinkStateDatabase` (`routing/link-state-db.ts`), and runs **Dijkstra**
     (`routing/path-computation.ts`) rooted at directly-connected peers → installs
     `prefix → next-hop` as **learned** routes, but only where the first hop is a *direct* peer.
   - **Soft state:** NIP-40 `expiration` tag + replaceable-event semantics (newest per pubkey wins).
     Expiry/supersede → recompute → route withdrawn.

**The load-bearing distinction: discovered ≠ peered.** Reading a neighbour's `kind:10032` is *free
discovery* (`discovery/discovered-node-registry.ts`, `GET /admin/discovered-nodes`). Opening a
**funded channel** is *peering* — a deliberate capital decision. `PeeringPolicyConfig.autoRegister`
is hard-forced `false` ("not yet supported"); `maxFundedChannels` caps funded channels. So the
network can be **densely discovered but sparsely funded** — which is the economic reality both ideas
must respect.

**Address allocation.** Children are bound via `apex` + `children[]` config, expanded by
`config/child-expander.ts` to `<apex>.<name>` (e.g. `g.toon.relay`). `relation-route-validator.ts`
enforces that a child's routes are **strict descendants of the apex** — you can only originate
prefixes *under your own apex*. There is no automatic pubkey-derived address assignment in code today
(the `prefix + first-8-hex-of-pubkey` scheme in `docs/protocol.md` is designed, not implemented).

**Design context.** `docs/connector-control-plane.md` is the authority: two planes kept separate —
the **relay** (Nostr events; capability→address, content→address; free NIP-01 reads, pay-to-write
Sybil-resisted) as the *control plane*, and **ILP routing** (address→path, content-blind) as the
*data plane*. §2.3 explicitly **rejects classic CCP over BTP** in favour of the shared Nostr
bulletin board. §6 already designs an **ArNS→Arweave signed-manifest registry** for cold-start seeds.

---

## B. Idea (A): a Nostr NIP/Kind for selling routing-table spots / names

**Is a NIP/Kind "good enough"?** Largely — because most of it already exists or is reserved:

- `kind:10032` is *already* a signed, replaceable, **pay-to-write** node-announce carrying a **priced
  `capabilities[]` directory** (`IlpCapabilityEntry`: `capability`, `address`, `price?`, `schema?`)
  and a `routing.prefixes[]` block. It is the natural carrier for "this prefix is for sale at price
  X."
- `docs/protocol.md` **already reserves a dedicated (unnumbered, unimplemented) "vanity prefix claim"
  kind** with an explicit **domain-registrar business model**: "upstream nodes earn revenue from
  prefix sales," priced via `kind:10032 prefixPricing`. `grep` finds **zero** `prefixPricing`/`vanity`
  code in the connector — it is a designed-but-open slot.

So idea (A) is mostly **specifying the reserved slot**, not inventing a mechanism:

1. **Assign a kind number** for the vanity-prefix claim (a *stateful* control-plane op that mutates
   routing topology and persists — distinct from the replaceable `kind:10032` advertisement). Model
   its listing surface on the existing priced-listing kinds: **NIP-99 classifieds (kind:30402)** and
   **NIP-15 stall/product (kind:30017/30018)**.
2. **Event shape:** `{ prefix, seller-apex, price, term/expiry, buyer-pubkey, payment-proof }` for
   claim; a transfer/renewal variant for the secondary market. Advertise availability + price via a
   `prefixPricing` field on the seller's `kind:10032`.
3. **Respect the hierarchy.** `relation-route-validator.ts` already enforces apex-descendant routes:
   **you can only sell spots under your own apex.** A claim for `g.toon.alice` is only valid if
   signed by (or delegated from) the operator of `g.toon`.
4. **Lifecycle & trust for free:** NIP-40 expiry for lease terms; pay-to-write Sybil economics
   (already the relay's trust model) gate spam; replaceable-event semantics for renewal.

**Strengths.** Inherits Sybil resistance and public inspectability; **no new infrastructure**
(rides Nostr + the existing validator); a clean revenue model for apex operators; composes with the
capability directory so a "spot" can be sold *with* a priced service.

**Limits (why it isn't the whole answer).** Names are **local to an apex subtree** — `g.toon.alice`
is meaningful only under `g.toon`, not globally owned; and a spot is **only as durable as its
upstream** — if the apex disappears, so does the name. This is a *routing/monetization* primitive,
not a *global identity* primitive.

---

## C. Idea (B): ArNS as a decentralized registry for ILP addresses

The novel angle: **globally owned names**, independent of any single upstream. This is where ArNS is
genuinely additive rather than a reinvention.

**What to bind a name to.** In TOON, **identity is a permanent Nostr pubkey**; **ILP addresses are
ephemeral, one per upstream peering** (`docs/protocol.md` "Identity, Address, Route"). So an ArNS
name should resolve to the **pubkey (or a `kind:10032` coordinate)** — *not* directly to a volatile
ILP address. The existing `pubkey → kind:10032 → ILP address` resolution stays unchanged; ArNS adds a
human-ownable, censorship-resistant global handle **on top**:

```
alice.arns  ──resolve──▶  { nostrPubkey, endpoints, apex }  (Arweave signed manifest)
nostrPubkey ──kind:10032──▶ current ILP address(es) + routing + capabilities   (unchanged)
```

**It generalizes a pattern TOON already designed and half-built.** `docs/connector-control-plane.md
§6` already specifies an **ArNS-name → Arweave signed-manifest** registry (with sample-and-verify
before trust, and a future permissionless pay-to-add path via an AO process) — today scoped to
*relay seeds*. Idea (B) is the same manifest pattern, re-pointed from "seed relays" to
"`name → {pubkey, endpoints, apex}`."

**The plumbing already exists end-to-end.** ArNS buy/set/resolve is integrated: `rig name buy`
(store-DVM kind:5095) and `rig name set` (kind:5096 gas-station), `@ar.io/sdk`, and the
`@toon-protocol/arweave` gateway-ordering package (`scripts/demo-e2e.sh`). Today it names *permaweb
site manifests*; nothing yet ties a name to a node identity — that is the greenfield.

**Strengths.** **Global ownership** (one name, owned by the holder, not leased from an upstream);
censorship-resistant and permanent; **one handle across all chains** (the pubkey is chain-agnostic;
settlement chain is negotiated off `kind:10032`); survives apex churn (rebind the manifest to a new
apex without changing the name).

**Costs / risks.** A resolve indirection (name → manifest → pubkey → `kind:10032`); dependence on the
AR.IO gateway set and ArNS economics; manifest freshness/rotation needs the sample-and-verify
discipline §6 already prescribes; key rotation (a lost Nostr key orphans the name's binding) needs a
delegation story.

---

## D. Recommendation: three layers, three jobs

Frame the answer as a **stack**, not a contest. Each idea does a job the others can't:

| Layer | Job | Mechanism | Status |
|-------|-----|-----------|--------|
| **Reachability** | "be routable" | `kind:10032` link-state + Dijkstra | **shipped** |
| **Global identity** | "own your name, globally" | **ArNS → signed manifest → pubkey** (idea B) | plumbing exists; binding greenfield |
| **Local monetization** | "sell addresses under me" | **vanity-prefix kind** (idea A) | reserved, unimplemented |

**Why this ordering.** Routing must stay pubkey/prefix-based and content-blind (the two-plane
invariant in `connector-control-plane.md`) — you do not want a global name resolution on the packet
hot path. ArNS answers the *human* question ("who is alice, durably?") off the hot path; `kind:10032`
answers the *machine* question ("what's the next hop?") on it; the vanity-prefix market answers the
*economic* question ("what does it cost to get an address under this apex?"). They compose cleanly
because each already respects the pubkey-as-identity / address-as-ephemeral split.

**Is selling routing spots via a NIP/Kind "good enough"?** Yes, for *monetizing address handout
within a subtree* — and it's nearly free to ship because the slot is reserved and the validator
already enforces the hierarchy. But it is **not** a substitute for global names; that's ArNS's job.

### Phased backlog (open as tickets after review — no code in this RFC)

1. **Assign the vanity-prefix kind number** and write the NIP: claim/transfer/renewal event shape,
   `prefixPricing` on `kind:10032`, apex-descendant validation rules, NIP-40 lease terms. Reference
   implementations: `relation-route-validator.ts`, `discovery/ilp-peer-info-event.ts`.
2. **ArNS identity manifest + resolver:** define the `name → {pubkey, endpoints, apex}` signed
   manifest (generalize `connector-control-plane.md §6`), a resolver in `@toon-protocol/arweave`, and
   the `rig name` UX to bind a name to a node pubkey. Sample-and-verify per §6.
3. **Wire the resolver into bootstrap/discovery** as an *optional* seed source (alongside config
   seeds and the persisted peer cache), never on the packet hot path. Key-rotation / delegation
   story for the name↔pubkey binding.
4. **(Optional) Permissionless registry** — the pay-to-add AO-process path §6.3 leaves open, if the
   curated manifest proves too centralizing.

## References
- As-built routing: `connector/packages/connector/src/routing/{routing-table.ts,path-computation.ts,link-state-db.ts}`,
  `discovery/{route-learning-service.ts,ilp-peer-info-event.ts,self-announce-builder.ts,discovered-node-registry.ts}`,
  `config/{types.ts,child-expander.ts,relation-route-validator.ts}`, `http/admin-api.ts`.
- Design: [`connector-control-plane.md`](./connector-control-plane.md) (two-plane model, §2 link-state,
  §6 ArNS seed registry), [`protocol.md`](./protocol.md) (Identity/Address/Route; reserved
  vanity-prefix kind + `prefixPricing`), [`bootstrap.md`](./bootstrap.md), [`settlement.md`](./settlement.md).
- ArNS plumbing: `toon-meta/scripts/demo-e2e.sh` (`rig name buy/set`, kind:5095/5096), `@ar.io/sdk`,
  `@toon-protocol/arweave`.
- Event kinds in play: `kind:10032` (ILP peer-info), `kind:10035` (SkillDescriptor pricing),
  NIP-99 `kind:30402`, NIP-15 `kind:30017/30018` (priced-listing analogues for the marketplace).
- Operator-facing entry point: [`node-operator-guide.md`](./node-operator-guide.md) §4.
