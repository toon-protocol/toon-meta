# Connector Control Plane — two planes, link-state route learning, apex aggregation, sparse funding

**Status:** Design doc (v0 decisions recorded) · **Scope:** connector routing + discovery architecture · **Audience:** connector implementers, node operators, epic decomposers

This document is the control-plane design for the connector epic
([toon-meta#153](https://github.com/toon-protocol/toon-meta/issues/153)): how a network of
connectors that today can only *forward, terminate, link, settle, and announce itself* learns
the shape of the network beyond one hop — transitive route learning, child-prefix aggregation
under the apex, capability discovery on the relay, discovery decoupled from channel funding,
and a cold-start bootstrap. It is the spec the epic's implementation stories bind against:

- connector: multi-hop route learning (link-state over the relay) — **anchor** (§2)
- connector: general child-prefix registration (§3)
- connector: apex aggregation + relation-route-validator enforcement (§3)
- connector: capability directory in kind:10032 (§4)
- connector: decouple discovery from channel funding (§5)
- connector: cold-start bootstrap sequence (§6)

Claims about current behavior are audited against connector `main`
(`packages/connector/src`); file references below are to that tree. The three open questions
the epic flags as spikes are resolved for v0 in §7, together with the evidence that would
reopen each.

**Naming note.** The repo glossary ([context/glossary.md](../context/glossary.md)) reserves
bare "control plane" for the Rig's event-space. This document always means the **connector
control plane** — the routing-and-discovery layer, in the classical control-plane/data-plane
sense of §1. When the two could collide, qualify.

---

## 1. Two planes, kept separate

The core thesis: TOON has two mapping problems, and they belong to two different systems.

| Plane | System | Maps | Properties |
|---|---|---|---|
| **Control plane** | The relay (Nostr events) | capability → address ("store lives at `g.peer1.store`"), content → address ("hash `H` is at …") | Queryable (free NIP-01 reads), pay-to-write Sybil-resisted, eventually consistent |
| **Data plane** | ILP routing | address → path | Longest-prefix forwarding ([RFC-0027](https://github.com/interledger/rfcs/blob/master/0027-interledger-protocol-4/0027-interledger-protocol-4.md)), content-blind, per-packet |

The separation is load-bearing:

- **Content hashes and capabilities are never routable.** There is no `g.<sha256>` and no
  `g.store` wildcard. A client that wants capability `os.store` or content `H` first asks the
  relay (control plane) *who provides it*, gets back a provider's flat ILP address, and only
  then sends a Prepare addressed to that provider (data plane).
- **Provider addresses are routable.** The data plane knows nothing except how to get a
  packet with destination `g.peer1.store.…` one hop closer to `g.peer1`. It never inspects
  content, never resolves names, never consults the relay per-packet.
- **The relay bridges.** Every lookup that crosses the planes — "who stores?", "who runs
  predicate `P`?", "where is hash `H`?" — happens *before* the packet exists, against the
  relay's queryable event set. The bridge is a client-side (or edge-connector-side) resolve
  step, not a router feature.

This mirrors DNS/IP: the relay is the directory you query once, ILP addresses are what
routers actually match on. Everything in the rest of this document keeps that line intact —
§2 puts *route* knowledge on the relay but the computed *forwarding* stays local and
prefix-based; §4 puts *capability* knowledge on the relay but capabilities resolve to plain
addresses before any packet is built.

### 1.1 What exists today, and the gap

Audited on connector `main`:

- The data plane is real: `routing/routing-table.ts` is an in-memory longest-prefix table
  (`getNextHop()` per RFC-0027, priority tie-break), populated from static YAML config plus
  runtime `addRoute()` (admin/peer registration) with write-through persistence for runtime
  routes.
- Half the control plane is real: `discovery/self-announce-builder.ts` +
  `discovery/ilp-peer-info-event.ts` publish a kind:10032 announcement derived from the
  connector's own config — but it advertises only *the apexes this node terminates*. No node
  ingests peers' announcements into its routing table, and no node re-advertises learned
  routes with itself as next-hop. There is no route-broadcaster, no CCP, no forwarding-table
  builder in `routing/`.
- The consequence: `discovery/peer-discovery-service.ts` compensates by opening a BTP link
  (`connectToPeer`) to **every** discovered peer. With no multi-hop, a direct (and, for value
  traffic, funded) link is the only way to reach anyone — the capital explosion §5 exists to
  kill.

The control plane below closes that gap without touching the data plane's contract: the
routing table stays a dumb longest-prefix map; only *what populates it* changes.

---

## 2. Route learning: link-state over kind:10032

### 2.1 Mechanism

Every connector already publishes a replaceable kind:10032 `IlpPeerInfo` event
(`discovery/ilp-peer-info-event.ts`). The event's content is `JSON.stringify(info)` and the
`IlpPeerInfo` type carries an index signature so extra content fields ride along **without a
wire-type change** — the same mechanism the `routes: { publish, store }` hints already use.
Link-state extends the announcement content with a routing block:

```jsonc
{
  "ilpAddress": "g.peer1",
  // … existing IlpPeerInfo fields (btpEndpoint, assetCode, supportedChains, …)
  "routing": {
    "adjacency": [
      { "peer": "<pubkey>", "cost": 1 }          // funded/linked neighbors, by Nostr pubkey
    ],
    "prefixes": [
      { "prefix": "g.peer1", "cost": 0 }         // reachable prefixes this node originates
    ]
  }
}
```

- **`adjacency`** — the node's directly-linked neighbors (its BTP peers), each with a cost.
  This is the link-state part: nodes announce *edges*, not paths.
- **`prefixes`** — the address prefixes this node originates (terminates or fronts). Under §3
  aggregation this is normally exactly the apex — one entry.
- **`cost`** — an additive, dimensionless metric, operator-set. v0 metric is cost-only (§7.2).

Every node subscribes to kind:10032 on its relays, takes the **union of all current
announcements**, treats it as a link-state database, and runs shortest-path (Dijkstra,
cost-sum) locally. The output — `prefix → next-hop peer` for every reachable prefix — is
written into the existing `RoutingTable` via `addRoute()`/`removeRoute()`. Path computation
is a pure function of the event set; two honest nodes reading the same relay compute
compatible tables.

The relay is doing here exactly what it already does for settlement negotiation
([docs/settlement.md](settlement.md)): acting as the shared bulletin board of signed,
self-describing node facts. No new event kind, no new transport, no new trust anchor.

### 2.2 Soft state and withdrawal

Route state is **soft state** — it exists only while its announcement is live:

- **Expiry.** Announcements carry the NIP-40 `["expiration", …]` tag the builder already
  supports (`BuildIlpPeerInfoOptions.ttlSeconds`). A node that stops re-announcing drops out
  of the link-state database when its event expires; every reader's next recompute withdraws
  the routes that depended on it. Withdrawal-on-expiry is the answer to "a stale announcement
  from an offline apex lingering forever" — the exact failure the TTL was added for.
- **Supersede.** kind:10032 is in the replaceable range (10000–19999): **newest event per
  pubkey wins**, older ones are discarded by the relay. A node that changes its adjacency or
  prefixes just re-announces; readers see one current record per node, never a history to
  reconcile. Removing a prefix from the new announcement *is* the withdrawal message.
- **Recompute triggers.** Readers recompute on: a new/replaced kind:10032 from a known node,
  a known node's expiration passing, and a periodic safety-net timer. Recompute is full (not
  incremental) in v0 — at current network scale the database is tens of nodes and Dijkstra
  cost is noise (§7.1).

Liveness of the *announcement* is not liveness of the *node* — a node can be announced and
down. That gap is handled the way ILP always handles it (T-family rejects, expiry of the
Prepare), not by the control plane pretending to know liveness it cannot prove (§7.2).

### 2.3 Rejected alternative: classic CCP over BTP

The Interledger lineage answer is CCP (`RouteControl`/`RouteUpdate` messages over the BTP
link, path-vector style: each peer tells you its routes, you pick, you re-advertise with
yourself prepended). Rejected for this network, for now:

- **It duplicates infrastructure we already have.** CCP needs a per-peer gossip protocol, a
  route-broadcaster, epoch/sequence bookkeeping, and per-relation advertisement filters —
  all new code. Link-state reuses the self-announce path, the relay subscription the
  discovery service already holds, and the NIP-40/replaceable semantics the relay already
  enforces.
- **The relay is already the shared bulletin board.** Path-vector exists to propagate
  reachability through a network where nodes can only talk to neighbors. Our nodes can all
  read the same relay for free — the propagation problem CCP solves does not exist here.
  Using the relay makes the full topology *inspectable* (any node or human can read the
  link-state database), which path-vector never gives you.
- **Sybil economics transfer.** kind:10032 writes are pay-to-write; announcing fake topology
  costs money per announcement and is signed by a pubkey you can then ignore. CCP trust is
  per-link and transitive — a lying peer poisons everything downstream of it with no
  signature trail on the individual claims.

The trade: link-state trusts nodes to describe their own edges honestly (a node can announce
adjacency to a peer that doesn't reciprocate — readers SHOULD only treat an edge as usable
when **both** endpoints announce it), and it puts topology in public. Path-vector CCP stays
the documented fallback if the relay-as-database assumption breaks (§7.1).

---

## 3. Parent/child hierarchy and apex aggregation

### 3.1 The hierarchy

The network is a hierarchy, not a flat mesh ([toon-meta#153](https://github.com/toon-protocol/toon-meta/issues/153),
decided context):

- **Leaves single-home.** A leaf node (an app behind a connector, a store, a relay) peers
  with exactly one parent, opens **one** funded channel to it, and installs a single default
  route (`g` → parent). It never appears in anyone's link-state database as a distinct node.
- **Connectors form the mesh.** Only connectors announce adjacency + prefixes (§2), maintain
  multiple funded channels (§5), and forward third-party traffic — earning the spread for it.
- **The parent aggregates.** A connector advertises **only its apex** upward
  (`prefixes: [{ "prefix": "g.peer1", … }]`) and resolves everything under the apex locally.

### 3.2 Aggregation and the topology-blind Prepare

`g.peer1.store` resolves *at peer1* to either an internal handler (local delivery /
http-proxy termination) or an external child link — and the two are **indistinguishable to
the packet**. The Prepare carries a flat ILP address only; internal-node vs external-child is
a private routing-table decision at the parent. Nothing upstream of peer1 ever knows or needs
to know whether `store` is a process in the same deployment or a separately-operated child
with its own channel to peer1.

This gives the scaling property that makes link-state affordable: **routing tables grow with
subtrees, not nodes**. The global link-state database has one prefix entry per connector
apex; a connector's local table has one entry per direct child plus the computed apex routes.
A subtree of ten thousand leaves is one row everywhere except at its own parent.

### 3.3 Child registration and enforcement

Two current-code gaps close here:

- **General child-prefix registration.** Today `resolveRouteHints`
  (`discovery/self-announce-builder.ts`) understands only the `.relay`/`.store` label
  suffixes. The child-registration story replaces this with a general binding: config or
  admin registration of `g.peer1.<name>` → an internal handler (`setLocalDeliveryHandler` /
  http-proxy) **or** an external child link, identical packet path either way.
- **Child-covered-by-apex enforcement.** `routing/relation-route-validator.ts` already
  validates at peer admission that a `child`'s routes are strict descendants of the
  connector's self-prefixes (and that a `parent` is not inside its own subtree) — but nothing
  aggregates, so the check is vestigial. Under this design it becomes load-bearing: a
  connector MUST NOT announce a prefix outside its apex subtree, MUST NOT advertise child
  prefixes upward (they are covered by the apex), and MUST reject child registration whose
  prefix escapes the apex. The advertisement rules per relation (children learn a default
  route only; peers/parents learn the apex only) are enforced at announce-build time and at
  admission.

---

## 4. Capability discovery: the `os.*` namespace

### 4.1 Open namespace, closed core

Capabilities live in an **open `os.<capability>` namespace with a closed standardized core**:

- The core — `os.put`, `os.get`, `os.send`, `os.transfer`, `os.swap`, `os.run` — is
  standardized: well-known semantics, well-known interface descriptors, implementable by
  anyone, relied on by every client.
- The namespace is open: any node can advertise a new `os.<capability>` without permission.
  Pay-to-write on the relay is the Sybil brake, the same one every other announcement uses.

### 4.2 Content-addressed interfaces

A capability is addressed by the **content hash of its interface descriptor**, not by its
bare name. `os.run` names a family; `sha256(descriptor)` pins the exact request/response
schema, pricing shape, and semantics a provider implements. Two providers advertising the
same descriptor hash are interchangeable; a provider "upgrading" its interface is, by
construction, advertising a *different* capability. Names are for humans; hashes are for
binding. (This is the same discipline the capability market's input manifest uses —
[docs/predicate-envelope.md](predicate-envelope.md) §2 — a name resolves through a
content-addressed artifact before anything binds to it.)

### 4.3 The capability directory block

The existing route-hints block in kind:10032 content (`routes: { publish, store }`) is the
degenerate two-entry case of a general directory. It generalizes to:

```jsonc
{
  "ilpAddress": "g.peer1",
  // …
  "capabilities": [
    {
      "capability": "os.store",                  // namespace name (human handle)
      "address": "g.peer1.store",                // flat ILP address — the plane bridge (§1)
      "price": "2",                               // optional — atomic units, non-negative decimal string
      "schema": "sha256:ab01…"                   // content-addressed interface descriptor
    }
  ]
}
```

`price` is a flat non-negative decimal string of atomic units, matching the repo-wide
`RouteConfig.price` convention — not a structured `{assetCode, assetScale, perByte}` object; a
structured entry is defensively dropped by the parser.

The legacy `routes: { publish, store }` hints map onto this directory as `os.publish` (the
relay-write/publish hint) and `os.store` (the blob-store hint).

As with the routing block (§2.1), this rides in the JSON content with no wire-type change.
Discovery is a NIP-01 filter over kind:10032 plus a client-side match on
`capabilities[].schema` — free to query, paid to publish. The resolved `address` is an
ordinary routable prefix; from the data plane's perspective a capability lookup never
happened (§1).

---

## 5. Sparse channels, dense reachability

Decouple two peer states the current code conflates:

| State | Meaning | Cost | How acquired |
|---|---|---|---|
| **Discovered** | In the link-state database; routable-*through* | Free (a relay read) | §2 route learning |
| **Peered** | Funded channel + BTP link; routable-*to* directly, settleable | Locked capital + monitoring | Operator policy |

Today `peer-discovery-service.ts` collapses these: every discovered peer gets
`connectToPeer()`, and a value link needs settlement, so discovering N nodes pushes toward N
funded channels. That is a symptom of the missing multi-hop (§1.1), and it is the wrong
default even once multi-hop exists — funding is **capital allocation**, not plumbing.

Under this design:

- **Discovery is promiscuous.** Ingest every valid kind:10032; know the whole network.
- **Funding is a policy choice.** A node opens channels to a *few* upstreams — chosen by the
  operator for traffic, fees, and trust — and reaches everything else through them. A leaf
  funds exactly one (§3.1).
- **Connectors bear the mesh and earn the spread.** Dense funded connectivity concentrates in
  the connector tier, where it is a business: each hop deducts its fee. Everyone else rides
  it.

This bounds locked-up settlement capital: per node it is O(chosen upstreams), not
O(discovered network), and the epic's "capital explosion" ceases to scale with discovery.
Reachability stays dense — the routed graph is as connected as the connector mesh — while the
channel graph stays sparse.

---

## 6. Cold-start bootstrap

Everything above is discovered *through* the relay — but a cold node needs an out-of-band
seed to reach its first relay. [connector#289](https://github.com/toon-protocol/connector/issues/289)
is this problem already surfaced: the committed genesis-peer seed pointed at a rotated/dead
identity (and the live announcements had drifted from core's schema), so a fresh client
could not bootstrap at all. A static seed baked into a repo is a stale pointer waiting to
happen.

### 6.1 Seed resolution order

A cold node resolves relay seeds through a fallback chain; each source is tried in order and
its results merged until enough candidates verify:

1. **Curated signed registry** (v0: curated-with-signed-entries) — a JSON manifest of relay
   seed records, each entry self-signed by the relay's own Nostr key, with a
   **whole-manifest signature** by the registry maintainer key. Fetch, verify the manifest
   signature, verify each entry signature. (Publication target: ArNS name → Arweave
   manifest; the registry artifact itself is out of scope for the connector epic.)
2. **Persisted peer cache** — every node persists the relays/peers it has successfully used;
   on restart, yesterday's network is the best predictor of today's. This alone makes #289's
   class a first-boot-only problem.
3. **Config seeds** — operator-provided relay URLs in the node's own config; always honored,
   never required.
4. **Hardcoded fallback** — a last-resort compiled-in seed list, expected to be stale, used
   only when 1–3 produce nothing.

### 6.2 Sample-and-verify before trust

No seed source is trusted on its own say-so. Before a candidate relay becomes the node's
bootstrap view of the network, the node **samples and verifies**: connect, fetch kind:10032
events, check signatures and schema (`parseIlpPeerInfo` — the check whose violation #289
caught), and cross-sample a second candidate to confirm the views overlap. A registry entry
that fails verification is skipped, not fatal — the chain continues. Once one honest relay is
reached, everything else is discovered through it (§2, §4); the registry is scoped to relay
seeds only and carries no routing or capability authority.

### 6.3 Future work: permissionless pay-to-add

The v0 registry is curated (§7.3). The permissionless path — pay-to-add entries with the same
Sybil economics as relay writes, e.g. an AO process gating inclusion — stays open as future
work; nothing in the seed-resolution chain assumes curation, only signatures.

---

## 7. Open questions and v0 decisions

The epic flagged three spikes. Decisions for v0, with the evidence that would reopen each:

### 7.1 Link-state vs path-vector CCP → **link-state** (§2)

**Decision.** Announce adjacency + prefixes on kind:10032; every node computes paths from
the relay union. Rationale in §2.3: reuses the self-announce infra, the relay is already the
shared bulletin board, pay-to-write Sybil economics transfer, topology stays inspectable.
Full recompute per change is acceptable at current scale (tens of connectors).

**Reopens if:** the link-state database outgrows what nodes can cheaply hold and recompute
(thousands of connector apexes — note §3 aggregation pushes this out by design); the network
partitions across relay sets so "the union off the relay" stops being one database; or
announced-edge dishonesty becomes a live attack that both-endpoints-announce filtering and
pay-to-write costs don't contain. Fallback is classic CCP (RouteControl/RouteUpdate over
BTP) — deliberately kept out of scope until then.

### 7.2 Routing metric: cost-only vs cost + reliability → **cost-only** (§2.1)

**Decision.** The v0 metric is a single additive operator-set cost. Reliability weighting is
**deferred**: it requires gossiping a claim (my uptime, my neighbor's uptime) that a
connector cannot cheaply prove, which reopens the "liveness is expensive to attest" problem —
a dishonest node inflates its reliability for free, and honest nodes can't refute it without
an attestation mechanism that costs more than it saves. Failures are handled where they're
observable: ILP rejects and Prepare expiry at forwarding time, local peer-health signals
feeding local (never gossiped) route preference.

**Reopens if:** a cheap, verifiable liveness signal appears (e.g. settlement-anchored uptime
proofs, or third-party watchtower attestations priced into the fee market), or if measured
v0 behavior shows cost-only routing concentrating traffic onto flaky paths badly enough that
paying for attestation beats eating the retries.

### 7.3 Bootstrap registry: curated vs permissionless → **curated-with-signed-entries** (§6)

**Decision.** v0 ships the curated manifest: relay-self-signed entries, whole-manifest
maintainer signature, ArNS/Arweave publication. It ships fast, it is fine for a doormat
(scoped to relay seeds only, verified before trust, bypassable via config seeds), and the
persisted peer cache makes it a first-boot dependency only.

**Reopens if:** the maintainer key becomes an actual gatekeeping or censorship chokepoint
(honest relays that cannot get listed), the curation process can't keep entries fresh
(re-creating #289 at the registry layer), or the network grows past what one curator can
vouch for. The successor is the pay-to-add process path (§6.3), which the entry format
already anticipates — entries are self-signed by relays, so only the inclusion mechanism
changes.

---

## Relationship to existing work

- **Epic:** [toon-meta#153](https://github.com/toon-protocol/toon-meta/issues/153) — this
  document is its design-doc story; the six connector stories listed at the top decompose
  from it.
- **[connector#289](https://github.com/toon-protocol/connector/issues/289)** — the stale
  committed genesis seed + schema-drifted announcements; the motivating failure for §6 and
  the reason §6.2 verifies schema before trust.
- **Builds on, not replaces:** the kind:10032 self-announce
  (`packages/connector/src/discovery/`), the longest-prefix `RoutingTable`
  (`packages/connector/src/routing/routing-table.ts`), the relation-route validator
  (`packages/connector/src/routing/relation-route-validator.ts`, promoted from vestigial to
  enforcing in §3.3), and the local-delivery / http-proxy termination paths (§3.2).
- **Siblings:** the swarm / capability-market coordination (NIP-34 events, pay-to-write
  Sybil resistance) — §4's capability directory reuses that discovery pattern, and §4.2's
  content-addressed interface descriptors follow the same binding discipline as
  [docs/predicate-envelope.md](predicate-envelope.md). Settlement-side node facts on
  kind:10032 are specified in [docs/settlement.md](settlement.md).
- **Out of scope here** (per the epic): the global registry artifact itself (ArNS name,
  Arweave manifest, inclusion policy), classic CCP over BTP (the §7.1 fallback), and
  connector fee-market / rebalancing economics beyond enabling sparse funding (§5).
