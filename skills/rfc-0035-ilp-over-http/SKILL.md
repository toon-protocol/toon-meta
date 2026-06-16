---
name: rfc-0035-ilp-over-http
description: How TOON Protocol relates to Interledger RFC 0035 - ILP Over HTTP. Use when users ask whether TOON transports ILP over HTTP, what TOON's transport actually is, or what the connector's HTTP endpoints are for. Also covers generic ILP-over-HTTP, HTTP-binding, and REST-for-ILP questions. Triggers on 'ILP over HTTP', 'HTTP transport', 'ILP HTTP binding', or 'does TOON use HTTP for payments'.
---

# RFC 0035: ILP Over HTTP — and why TOON does not use it

RFC 0035 binds ILP packets to HTTP request/response (POST a PREPARE, get a FULFILL/REJECT body), as an alternative to BTP.

## How TOON uses / diverges from this RFC

**TOON does NOT use ILP-over-HTTP.** The only ILP transport is **BTP over WebSocket** (RFC-0023, see `rfc-0023`), optionally wrapped in an ATOR `.anon` hidden service. ILP packets never travel as HTTP request/response bodies.

HTTP *does* appear in the TOON stack, but **never as an ILP transport**:

- **Connector admin API** (`http/admin-api.ts`) — HTTP endpoints like `POST /admin/peers`, `/admin/routes`, `GET /admin/earnings.json`, `/admin/metrics.json`, `/health`. This is operator control-plane, gated by `adminApi.apiKey`. It does not carry ILP packets.
- **Local-delivery BLS callback** (`/handle-packet`) — an internal HTTP hop the apex uses to hand an already-validated packet to a co-located child node's BLS process. This is an intra-apex delivery detail, not an ILP-over-HTTP peering link, and it carries no claim (parent→child is free-forward).
- **Health checks** (`/health` on the BLS ports) — plain liveness probes.

## What to tell a user expecting an HTTP ILP endpoint

There is no HTTP endpoint to POST a payment to. To pay TOON you open a **BTP WebSocket** to the apex (`ws://host:3000/btp` direct, or a SOCKS5h `.anon` address in HS mode) and send packets with signed claims. The HTTP ports you see are admin/health/internal-delivery only.

## Common Topics
- BTP/WebSocket (+ ATOR) as TOON's only ILP transport
- Connector admin API (`/admin/*`) is control-plane, not ILP-over-HTTP
- The `/handle-packet` BLS local-delivery callback is internal, claim-free
- Relationship to `rfc-0023` (BTP), `rfc-0031` (admin-API runtime config)
