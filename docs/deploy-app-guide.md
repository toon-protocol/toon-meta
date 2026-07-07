# Deploy an App with TOON

Two ways to deploy and monetize an app on TOON Protocol, depending on whether you already have
an HTTP service or are building natively on TOON's protocol primitives.

## Path A — payment-proxy (front an HTTP app)

Put a connector in front of an existing, payment-oblivious HTTP service — the way nginx sits in
front of TLS. Agents onboard via x402 (HTTP 402), pay one-shot over ILP-over-HTTP, and can
upgrade to a duplex BTP session; your backend never changes and never sees payment.

**Status: core shipped on connector `main`.** The proxy handler, x402 greeting, `h402Fetch`
client shim, RFC 9421 claim↔request binding, and the `RouteTermination` config surface all exist
on `main` and were verified by a real paid round-trip — proven live at
`connector.pay.toonprotocol.dev`. Also shipped: the devnet multi-chain roundtrip harness
(connector PR #245, merged) and the `deploy/pay-edge/` deploy bundle (connector PR #252, merged;
supersedes closed connector PR #246). Two future items remain tracked in the epic: transparent
cross-chain FX (Story 44.12, `connector#223`) and full RFC 9421
hardening beyond the shipped MVP claim↔request binding — replay cache, JWKS/`.well-known`,
content-digest canonicalisation, key lifecycle (Story 44.13, `connector#224`).

Start here:
- [`payment-proxy.md`](./payment-proxy.md) — the RFC: architecture, the x402/BTP three-rung
  ladder, packet shape
- [`epic-44-payment-proxy.md`](./epic-44-payment-proxy.md) — the implementation epic: stories,
  what shipped vs. what's still open
- [`deployment.md`](./deployment.md#path-a-reference-deployment--deploypay-edge-separate-box) —
  the reference deployment (`deploy/pay-edge/` bundle)

## Path B — native node (build on the SDK / Town)

Build your app directly on TOON's protocol primitives instead of fronting an existing service:
your handlers speak Nostr events and ILP claims natively, with no HTTP-passthrough layer in
between.

**Status: shipped, production-ready.** `@toon-protocol/sdk` (identity, signature verification,
pricing, handler dispatch) and `@toon-protocol/town` (a production-ready relay with an embedded
ILP connector, one command to run) are both published packages.

Start here:
- [`sdk-guide.md`](./sdk-guide.md) — build a custom service on `@toon-protocol/sdk`; you write
  the business logic, the SDK handles identity, verification, pricing, and handler dispatch
- [`town-guide.md`](./town-guide.md) — run `@toon-protocol/town` for a complete relay + connector
  out of the box, no custom handlers required

## Choosing a path

- Already have an HTTP service and want to monetize it with zero code changes → **Path A**.
- Building something new that should speak TOON's event/claim model directly (custom handlers,
  kind-specific pricing) → **Path B**.
