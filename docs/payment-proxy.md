# RFC: Payment Proxy — TOON in front of any HTTP service

**Status:** Draft · **Scope:** architecture / direction · **Audience:** connector + client + ecosystem

## The idea, in one line

Put a **payment** proxy at the edge, the way nginx sits in front of **TLS**. An agent speaks the
payment protocol to a reverse proxy; the proxy validates and settles, then forwards a clean,
byte-identical HTTP request to a backend the developer wrote with **zero payment awareness**.

```
nginx:  client ──HTTPS──► nginx ──plain HTTP──► app   (app never sees TLS)
TOON:   agent ──paid────► proxy ──plain HTTP──► app   (app never sees payment)
```

## Why now — the bet

Agents are becoming the universal client. So we don't chase browser adoption — we make TOON a
**drop-in payment layer in front of services agents already call over HTTP**. This is a second,
far lower-friction adoption tier than today's "build *on* TOON" path (pull in
`@toon-protocol/sdk`, write kind-handlers, speak Nostr). Here the developer changes nothing: they
keep their existing HTTP service and put a proxy in front of it. This decoupling is *why TLS is
everywhere*; the same play wins for payment.

This rides, rather than fights, the installed base. **x402** — HTTP 402 payments for agents,
donated to the x402 Foundation under the Linux Foundation (April 2026), with tens of thousands of
active agents — is the onboarding handshake we reuse. x402 settles **on-chain, per request**;
TOON's edge is **off-chain channel settlement, money+message in one packet, batched on-chain
later**, plus **n-hop routing**. So the framing is: *x402 gets you in the door; TOON is the upgrade
you take at agent-swarm volume.*

## The three-rung ladder

The agent client picks the rung transparently — like an HTTP client choosing keep-alive vs. a
WebSocket upgrade.

**Rung 1 — Onboard via x402 / HTTP 402.** The proxy answers an unpaid request with `402`
whose `accepts` array carries *two* entries in one envelope:
- a **vanilla on-chain entry** (`scheme:"exact"`, e.g. Base/Solana USDC) — a plain x402 agent pays
  on-chain and never knows TOON exists (graceful degradation; x402 parsers skip schemes they don't
  understand);
- a **TOON-channel entry** — the destination **ILP address**, `endpoint:"/ilp"`, accepted chains,
  the flat per-route price, and settlement addresses.

The TOON entry is the HTTP-native mirror of the existing Nostr `kind:10032` peer-info. Advertising
the **ILP address** (not just a local URL) is what lets a multi-hop routed payment find the
destination.

**Rung 2 — Pay one-shot via transparent HTTP-in-ILP.** A TOON-aware agent opens/reuses a channel
and resubmits to `POST /ilp`: the ILP PREPARE's `data` field carries the **literal HTTP request**;
the claim rides in the `ILP-Payment-Channel-Claim` header. The proxy validates the claim,
strips hop-by-hop headers, injects identity headers, **replays the request byte-for-byte** to the
backend, and returns the literal HTTP response in the FULFILL `data`. The client shim makes the
whole exchange look like one `fetch()`. The backend stays 100% oblivious.

```
Agent → GET https://api.foo/v1/x ───────────────► Proxy (= connector + proxy handler)
Proxy → 402  accepts:[ exact(base-usdc), toon-channel(ilpAddress, /ilp) ]
Agent → POST /ilp   body: OER ILP PREPARE
                      data = raw HTTP request (request-line + headers + body)
                    header: ILP-Payment-Channel-Claim: base64(claim)
Proxy → validate claim (ClaimReceiver) ─ strip hop-by-hop hdrs ─ inject X-TOON-* ─ replay ─►
                                                                          Backend (plain HTTP, oblivious)
Agent ◄── 200  body: OER ILP FULFILL (data = raw HTTP response) ◄── Proxy ◄── Backend response
```

**Rung 3 — Scale via HTTP→BTP upgrade.** ILP `data` is size-bounded, which becomes a
self-documenting rule: small synchronous calls go one-shot over `POST /ilp`;
large / streaming / high-frequency calls take the **HTTP→BTP upgrade on the shared listener** (a
duplex session with advancing claims for incremental settlement), or use the store/Arweave
out-of-band pointer for big static blobs. The agent picks the rung; the developer never thinks
about it.

## Packet shape & the non-pollution guarantee

The ILP PREPARE is:

```
ILP PREPARE
├─ amount             uint64        the prepaid payment (flat per-route price)
├─ destination        ILP address   the ONLY field routing matches on (longest-prefix)
├─ expiresAt          timestamp
├─ executionCondition 32 bytes      SHA-256 hashlock for atomic multi-hop (see below)
└─ data               Buffer        OPAQUE arbitrary bytes  ← the raw HTTP request lives here

carried alongside the packet, never inside `data`:
   header  ILP-Payment-Channel-Claim[-Wrapped]   the signed balance-proof claim
   header  ILP-Peer-Id + Authorization           peer auth (anonymous one-shot buyers get an
                                                  ephemeral peerId derived from the claim)
```

The connector's *only* operation on `data` is `sha256(data)` to mint a transfer ID — it **never
parses it** (not in claim validation, routing, fee deduction, condition check, or forwarding). That
yields three guarantees that keep the design clean:

1. **`data` is opaque arbitrary bytes**, so it carries a raw HTTP request as easily as a TOON
   event. The Nostr-event / `kind` assumption lives **only** in the SDK `createNode` pipeline
   (`shallowParseToon` → kind dispatch) used by the **relay/store** apps. The **proxy is a
   *sibling* local-delivery handler** wired to the connector's `setPacketHandler` seam (the same
   seam the swap node uses), bypassing `shallowParseToon` and treating `data` as HTTP.
2. **The claim is carried in a header / protocolData**, never in `data` — so an arbitrary HTTP
   payload can never collide with the payment.
3. **Gift-wrap means the CLAIM, not the data.** The connector-level NIP-59 claim wrap encrypts the
   `BTPClaimMessage` and carries the preimage that produces `executionCondition` (atomic multi-hop
   + intermediary privacy); it is optional/config-gated and orthogonal to `data`. The proxy
   does **not** use the SDK event-wrap (which stuffs a wrapped Nostr event *into* `data`) — that's
   swap-app behavior, and the proxy has no event to wrap.

**Core invariant:** *the connector is format-agnostic, like nginx is for HTTP.* It imports only the
ILP **OER** packet framing, never the TOON event codec (`encodeEventToToon` / `decodeToon` /
`shallowParseToon`). ILP-OER framing is the connector's native wire format (≈ HTTP/TCP framing in
nginx); the TOON event codec is the *payload* (≈ JSON behind nginx) and is a **handler** concern.
This invariant is what keeps the relay (a TOON-event app) and the proxy (an HTTP app) as peers
behind one agnostic edge — and it must be preserved.

## Pricing

Flat / quoted **per route**, advertised in the 402 and prepaid in the claim. This matches x402's
fixed-price-per-resource model and preserves TOON's "the request amount *is* the payment"
principle. Per-byte pricing (TOON's default for writes) is wrong for proxied APIs, because the
value lives in the variable-size *response*, not the request.

## Binding & trust

A prepaid claim authorizes an *amount on a channel*; without binding it to *this* request, a cheap
claim could be replayed against an expensive route. **RFC 9421 HTTP Message Signatures** solve this
— sign method + path + body-digest + price so the proxy verifies the claim is for this exact
call. This pulls 9421 onto the **critical path** (it is currently filed under egress, see *What's
built*).

Trust ends at the proxy, exactly as with TLS: the backend trusts injected headers
(`X-TOON-Payer` pubkey, `X-TOON-Amount`, `X-TOON-Chain`) over a private hop. This realizes the
narrative's **"payment is authentication, no API keys"** — the proxy hands the backend a
verified payer identity.

## Deployment topologies

The proxy is an **edge concern — not one connector per app**, just as one nginx fronts many
vhosts.

- **Shared ingress proxy (default).** One connector fronts many backends by host/path; backend
  devs run **zero** TOON infra and just register an upstream (the Kubernetes-ingress analogue). The
  operator owns channels/settlement and accounts per backend.
- **Sidecar proxy (sovereignty).** An app co-runs its own connector (the Envoy-sidecar
  analogue); the developer holds their own channels/keys and earns directly.
- **Managed edge ("Cloudflare for agent payments").** A third party runs the proxy network;
  apps register and are monetized with zero infra. The long-term play.

### Component topology — what runs where

The connector does **not** embed a relay. The relay is a *sibling backend behind* the connector
(like the proxy's HTTP app), co-located in the deployment's Compose bundle but a separate service.
There are two unrelated uses of Nostr, **neither in the connector core**:

- the *relay app's* event data model (NIP-01) — one optional backend's business;
- *peer discovery* (kind:10032) — optional, via a sidecar daemon that feeds the admin API.

So a **pure payment proxy = connector + proxy handler + your HTTP app**: zero Nostr, zero relay
in the path; peers set statically or via the admin API. **For the proxy, discovery is the
`402` itself** — a cold agent finds the paid service by hitting the URL. kind:10032/Nostr only ever
concerns *connectors finding each other to route*, and even that can be static. **A developer
monetizing an HTTP API with TOON touches Nostr zero times.**

## Peering, routing & runtime config

Routes and peers enter the connector three ways:

1. **Static config at boot** — `peers[]` (id, url, authToken, chain,
   `relation: parent|peer|child`, settlementAddress, nip59PublicKey, transport) + `routes[]`
   (prefix, nextHop, priority). This is the `nginx.conf` analogue, and the surface our config
   grammar exposes (`peer {} / route {} / upstream {}`, where `upstream` is the proxy's
   backend).
2. **Admin API at runtime** — `POST/DELETE/PUT /admin/{peers,routes}` plus declarative
   `PUT /admin/desired-state`. No restart; mutations write through to SQLite (`source:'runtime'`)
   and replay on boot.
3. **Programmatic** — `registerPeer` / `addRoute`.

Routing is longest-prefix match on the **ILP address** only — never on `data` (consistent with the
format-agnostic invariant).

**Gap vs. nginx:** there is no config-file hot-reload (no SIGHUP re-read). Recommendation: either
add file-reload for nginx parity, or make `PUT /admin/desired-state` the primary runtime surface
(a `kubectl apply`-style declarative model).

**Discovery:** the connector does **not** read Nostr kind:10032 to auto-populate routing
(kind:10032 `IlpPeerInfo` lives at the core/client layer; the connector's `PeerDiscoveryService` is
unused and not wired in). Static config is the deterministic default. An **optional discovery
daemon** (Nostr kind:10032 → `PUT /admin/desired-state`) is the agent-economy superpower — kept as
a **sidecar** precisely so the connector stays TOON/Nostr-agnostic.

## nginx: keep the packet, steal the config

We adopt nginx's **config UX**, not its engine. Because the transparent HTTP-in-ILP envelope makes
the real request an opaque OER body, nginx can't route on it — so nginx's `auth_request` model
(elegant, and a near-perfect fit when payment rides as request *headers*) does **not** apply here.
The connector is the HTTP front; real nginx, if present, is only a dumb TLS proxy routing
`/ilp` to the connector.

What we take: the `server {} / location {} / proxy_pass / upstream` grammar, drop-in
`conf.d/*.conf`, and reload-without-downtime ergonomics — e.g.

```
route /v1/ {
    price    1000;            # nano-USDC, flat per route
    upstream http://app:8080; # the oblivious backend
    chains   evm, sol;        # accepted settlement chains (advertised in the 402)
}
```

The `auth_request` alternative is documented here only to record *why it was rejected*: the opaque
packet.

## The moat — n-hop + token-agnostic routing

An agent opens **one** channel with its local proxy and reaches any destination over N hops; it needs
**no direct channel with each API** — a property x402 structurally lacks (x402 requires holding the
asset on the resource server's network). The routing pieces for this are **built**: a longest-prefix
routing table, real peer-to-peer forwarding over BTP, per-hop fee + bilateral signed claim, and
atomic multi-hop via the **execution-condition/fulfillment** mechanism (active when NIP-59
claim-wrapping is enabled; see *What's built*).

The missing half is **transparent cross-chain FX**, and it is *wiring, not new primitives*: the
swap node already embeds a connector, holds multi-chain channels, and runs `applyRate(...)` +
multi-chain claim issuance — but today it does so as an *explicitly-addressed destination*, and the
connector's forwarding path does **no** rate conversion (single token per runtime,
`forwardedAmount = amount − fee`). To make "the request doesn't care what token the destination
wants" real, three changes are needed:

1. lift `applyRate` + multi-chain claim issuance from the swap *destination handler* into the
   connector's **forwarding path**, firing when the inbound ledger ≠ the outbound ledger;
2. let routing **select** a swap-capable hop when the destination accepts a token the agent doesn't
   hold;
3. add sender-side intent ("deliver ≥ X of the destination asset for ≤ Y of my asset") + a quote.

Atomicity survives the conversion because the execution-condition binds the path end-to-end even as
the *amount* changes at the FX hop. This is the headline roadmap item and deserves its own
follow-on spec; it is **not** proxy MVP.

## What's built vs. what's new

**Already shipped on the connector `main`:**
- ILP-over-HTTP **ingress** (RFC-0035): `POST /ilp`, OER PREPARE body, claim in the
  `ILP-Payment-Channel-Claim` header, recorded through the **same `ClaimReceiver`/settlement path
  as BTP** (`http/ilp-http-adapter.ts`, wired in `core/connector-node.ts`).
- **HTTP→BTP upgrade on a shared listener** with pre-auth continuity (`btp/btp-server.ts`,
  `BtpPreAuth`): a client that paid over ILP-over-HTTP transitions to a duplex BTP peer with no
  second handshake.
- **Multi-hop routing**: longest-prefix table (`routing/routing-table.ts`), peer-to-peer forwarding
  (`core/packet-handler.ts`), per-hop fee + bilateral claim, proven by a 5-peer e2e test.
- **Atomic multi-hop**: packet-level execution-condition/fulfillment
  (`core/packet-handler.ts` — `sha256(fulfillment) === executionCondition`), active when NIP-59
  claim-wrapping supplies the preimage. (On-chain HTLC escrow remains absent — atomicity here is
  packet-level, not an on-chain hashlock.)
- **FX primitives**: the swap node's `applyRate` + multi-chain claim issuance (at a
  destination, today).

**Also shipped on connector `main` (the Path A core):**
- the **x402 greeting** (the dual-entry 402) at the proxy edge (x402 v2, #217);
- the **proxy-handler local-delivery** (decode → replay → reserialize to an oblivious backend, #216);
- the **agent-side client shim** that turns the exchange into a `fetch()` (`h402Fetch`);
- **RFC 9421** claim↔request binding on the critical path (#220, gated by `requireRequestBinding`);
- the **`RouteTermination` config surface** + route-upstream registry + admin API (#218).

> **Proven live** at **`connector.pay.toonprotocol.dev/ilp`**: a generic, payment-oblivious
> backend was fronted by the connector payment-proxy and verified by a real paid round-trip
> (paid `POST /ilp` → FULFILL with injected `x-toon-*` headers; unpaid → 402; real on-chain
> USDC settlement). Reusable artifact: connector `deploy/pay-edge/`.

**In-flight PRs (not yet merged):**
- the **devnet multi-chain roundtrip harness + connector naming + Porkbun DNS provider**
  (connector PR #245, mergeable);
- the **`deploy/pay-edge/` deploy bundle** (connector PR #246).

**Remaining future work this RFC motivates:**
- as a follow-on, **swap-as-routing-FX-hop** for true token-agnosticism (cross-chain FX on the
  forwarding path);
- a **nginx-style text-config surface** (ergonomics; `RouteTermination` is the working surface today).

Outbound ILP-over-HTTP **egress** (`transport/http-peer-transport.ts`, planned in `epic-38`) is not
required for the proxy.

## Relationship to existing transports

- **BTP (RFC-0023)** remains the duplex/session and inter-connector peer transport.
- **ILP-over-HTTP (RFC-0035)** is the one-shot **edge/onboarding ingress** (`POST /ilp`) and the
  origin of the HTTP→BTP upgrade. See `skills/rfc-0035-ilp-over-http`.
- This RFC supersedes the prior position that "TOON does not use ILP-over-HTTP" — see the updated
  `context/decisions.md`.
