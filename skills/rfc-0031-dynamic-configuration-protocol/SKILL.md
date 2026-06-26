---
name: rfc-0031-dynamic-configuration-protocol
description: How TOON Protocol relates to Interledger RFC 0031 - Dynamic Configuration Protocol. Use when users ask whether TOON negotiates config at runtime, how a TOON connector is reconfigured at runtime, how peers/routes are added live, or how runtime config differs from vanilla Interledger. Also covers generic dynamic-config and runtime-negotiation questions. Triggers on 'dynamic configuration', 'runtime config', 'add a peer at runtime', or 'reconfigure the connector'.
---

# RFC 0031: Dynamic Configuration Protocol — and what TOON uses instead

RFC 0031 defines an in-band protocol for two nodes to negotiate configuration parameters at runtime.

## How TOON uses / diverges from this RFC

**TOON does NOT implement the RFC-0031 negotiation protocol.** There is no in-band config-negotiation exchange between peers. Instead, runtime reconfiguration of a TOON connector is done **out-of-band via the connector admin API** (`http/admin-api.ts`):

- **`POST /admin/peers`** — register a peer at runtime (with its `relation`, transport, authToken). This is how a child node (relay/store/swap) is added to a running apex.
- **`PUT /admin/peers/:peerId`** — update an existing peer.
- **`POST /admin/routes`** — add/update routes at runtime.
- Other admin endpoints expose earnings/metrics/health and HS hostname.

The admin API is the control plane, gated by `adminApi.apiKey`, and is **not** the ILP transport (see `rfc-0035`). Static config (compose `.env`, `connector.yaml`) sets the baseline; the admin API mutates it live.

## Practical note for operators

A common operational gotcha: a connector restart can drop runtime-added routes/peers, so re-adding the relay route after a restart is a known recovery step (two admin POSTs) — see the proxy `RUNBOOK.md`. Tools like `ConnectorAdminClient` and the proxy CLI/MCP wrap these admin calls.

## What to tell a user asking "how do I reconfigure TOON at runtime?"

Use the connector admin API (`/admin/peers`, `/admin/routes`) with the `adminApi.apiKey`, or the proxy tooling that wraps it — not an RFC-0031 negotiation handshake.

## Common Topics
- Why TOON doesn't implement RFC-0031 (admin API instead)
- `POST/PUT /admin/peers`, `POST /admin/routes` for live reconfiguration
- `adminApi.apiKey` gating; admin API is control-plane, not ILP transport
- Restart-drops-routes recovery (RUNBOOK)
