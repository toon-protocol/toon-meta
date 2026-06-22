---
name: rfc-0035-ilp-over-http
description: How TOON Protocol relates to Interledger RFC 0035 - ILP Over HTTP. Use when users ask whether TOON transports ILP over HTTP, what TOON's transports are, the difference between the HTTP edge and BTP sessions, or what the connector's HTTP endpoints are for. Also covers generic ILP-over-HTTP, HTTP-binding, the POST /ilp ingress, and the HTTP→BTP upgrade. Triggers on 'ILP over HTTP', 'HTTP transport', 'ILP HTTP binding', 'POST /ilp', or 'does TOON use HTTP for payments'.
---

# RFC 0035: ILP Over HTTP — TOON's edge/onboarding ingress

RFC 0035 binds ILP packets to HTTP request/response (POST a PREPARE, get a FULFILL/REJECT body), as
an alternative to BTP.

## How TOON uses this RFC

**TOON uses ILP-over-HTTP as its edge/onboarding ingress transport** (it did not, historically —
this is a deliberate, shipped reversal; see `context/decisions.md` and `docs/payment-termination.md`).
TOON now runs **two** ILP transports, by role:

- **ILP-over-HTTP (RFC-0035) — one-shot edge ingress.** A client `POST`s an OER-encoded ILP PREPARE
  to `/ilp`; the connector returns an OER FULFILL/REJECT body. The payment-channel claim rides in
  the `ILP-Payment-Channel-Claim` header (or `ILP-Payment-Channel-Claim-Wrapped` for a NIP-59
  wrapped claim) — the same bytes BTP carries as a `payment-channel-claim` protocolData entry. ILP
  rejects ride in an HTTP `200` body; HTTP non-2xx is reserved for transport errors (400 malformed,
  401 auth, 500 internal), per RFC-0035. Inbound HTTP claims are recorded through the **same
  `ClaimReceiver` and settlement path as BTP**, so a one-shot `POST /ilp` write credits on-chain
  settlement identically. (`packages/connector/src/http/ilp-http-adapter.ts`, wired in
  `core/connector-node.ts`.)
- **BTP over WebSocket (RFC-0023) — duplex sessions + inter-connector peering.** The session and
  peer-to-peer transport, optionally wrapped in an ATOR `.anon` hidden service. See `rfc-0023`.

`POST /ilp` and the BTP WebSocket upgrade are served on the **same port** (`btp/btp-server.ts`).

## HTTP→BTP upgrade (like HTTP→WebSocket)

A client that already authenticated over HTTP (`ILP-Peer-Id` + `Authorization`) can **upgrade the
same connection to a duplex BTP session** with no second handshake — a `BtpPreAuth` carries the
authenticated identity across the upgrade (`btp/btp-server.ts`). One-shot HTTP calls stay on
`POST /ilp`; high-frequency / streaming / large-payload flows upgrade to BTP. This mirrors the
HTTP→WebSocket upgrade and is the basis of the payment-termination ladder
(`docs/payment-termination.md`).

## Egress

Outbound ILP-over-HTTP (the connector forwarding to an **HTTP-configured peer**) is **not yet
built** — inter-connector forwarding is BTP-only today. HTTP egress is planned in the connector's
`epic-38` (alongside RFC 9421 HTTP Message Signatures).

## Other HTTP in the stack (not ILP transport)

- **Connector admin API** (`http/admin-api.ts`) — `POST /admin/peers`, `/admin/routes`,
  `PUT /admin/desired-state`, `GET /admin/earnings.json`, `/health`. Operator control-plane, gated
  by `adminApi.apiKey`. Carries no ILP packets.
- **Local-delivery BLS callback** (`/handle-packet`) — internal apex→child hop for an
  already-validated packet; claim-free (parent→child is free-forward).
- **Health checks** (`/health`).

## Common Topics
- ILP-over-HTTP (`POST /ilp`) as the one-shot edge ingress; BTP/WebSocket (+ ATOR) as the session
  and peer transport
- HTTP→BTP upgrade with `BtpPreAuth` continuity
- HTTP claims recorded through the same `ClaimReceiver`/settlement path as BTP
- Egress (HTTP peer forwarding) still unbuilt — `epic-38`
- Connector admin API (`/admin/*`) is control-plane, not ILP-over-HTTP
- Relationship to `rfc-0023` (BTP), `rfc-0031` (admin-API runtime config),
  `docs/payment-termination.md` (the termination architecture)
