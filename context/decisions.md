# Architectural Decisions

Curated, durable decisions. ADR-lite: each is *decision → why*.

## Payment & protocol

- **Messages and money are one packet.** Every monetized flow = a single ILP PREPARE carrying both the TOON-encoded event and its payment. *Why:* the core protocol thesis; no separate invoice/settle round-trip.
- **Prepaid, supply-driven pricing.** Providers advertise price in a replaceable Nostr event (`SkillDescriptor`, kind:10035); the request packet's amount IS the payment. `settleCompute()` deprecated. *Why:* removes request-for-quote latency; the network can't distinguish rails.
- **TOON's value layer is the signed payment-channel claim — not SPSP / STREAM / payment-pointers.** SPSP kinds (23194/23195) were removed. *Why:* a write is one packet + one balance-proof claim; there's no stream to chunk, no quoting. *Transports:* claims ride over **BTP/WebSocket** (duplex sessions + inter-connector peering) **and ILP-over-HTTP** (`POST /ilp`, the one-shot edge/onboarding ingress, with an HTTP→BTP upgrade) — see `rfc-0023`, `rfc-0035`. *Atomicity:* multi-hop uses packet-level **execution-condition/fulfillment** (active when NIP-59 claim-wrapping supplies the preimage); there is **no on-chain HTLC escrow**. See the `rfc-*` skills for per-RFC detail.
- **USDC is the sole user-facing token.** *Why:* simplicity; operator staking tokens stay invisible to relay users.
- **Claims are per-chain balance proofs:** EIP-712 (EVM), Ed25519 (Solana), Pallas/Schnorr zk (Mina). Settlement is **in-process multi-chain** (not RFC-0038's separate service), redeeming via `claimFromChannel` at a per-peer threshold.
- **Payment proxy (TOON in front of any HTTP service).** A connector at the edge can act as a **payment proxy server** — proxying the payment the way nginx fronts TLS: onboard via **x402** (HTTP 402), pay one-shot via **transparent HTTP-in-ILP** (the raw HTTP request rides in the opaque ILP `data`), upgrade to **BTP** for sessions; the backend stays payment-oblivious and the connector never parses `data`. *Why:* agent-first adoption — ride x402's installed base, and channels + n-hop routing beat per-request on-chain settlement at volume. **Path A status: core shipped on connector `main`** — proxy handler, x402 greeting, `h402Fetch` shim, RFC 9421 binding, and `RouteTermination` config all exist on `main` and were verified by a real paid round-trip (proven live at `connector.pay.toonprotocol.dev`, reusable artifact `connector/deploy/pay-edge/`). Still in open PRs: the devnet multi-chain roundtrip harness + connector naming + Porkbun DNS (connector PR #245) and the `deploy/pay-edge/` deploy bundle (connector PR #246). Only future item: transparent cross-chain FX. See [`payment-proxy.md`](../docs/payment-proxy.md).

## Boundaries

- **Claim validation lives ONLY in the connector.** `core` never imports the connector (structural `EmbeddableConnectorLike` interface); `sdk` dynamically imports it only to auto-create one; the `payment-handler-bridge` dispatches an *already-paid* packet to business logic. *Why:* the connector is the only component holding channel state — re-validating downstream is double work and incorrect.
- **Apex / free-forward.** Operators run an apex (the connector as a proxy-server layer, `g.connector`) + child nodes; parent→child packets carry no per-packet claim (settled in aggregate). Children must be `relation:'child'` and tag `g.connector` as parent. *Why:* one paid hop at the edge; children earn via aggregate settlement.
- **Trust degrades; money doesn't.** (TEE) Attestation state changes never trigger payment-channel closure. *Why:* trust is a gradient, not a gate.

## Repo split (2026-06)

- **Polyrepo with npm + pinned-digest coupling** (not a monorepo, not submodules). *Why:* per-team ownership; teams build/test/release without rebuilding the world. Mirrors how the connector was already consumed.
- **`toon` (core+sdk) is libraries only; connector is an optional peer.** *Why:* the library layer must build/publish independent of the payment engine.
- **The connector owns & publishes `@toon-protocol/mina-zkapp`.** *Why:* one canonical Mina channel contract; the connector already depends on it, and it was unpublished/`private`, breaking installs.
- **Publish via `pnpm publish` / changesets, never `npm publish`.** *Why:* `npm publish` shipped unresolved `workspace:*`, making `sdk@0.5.0`/`town@0.4.0` uninstallable. (See `SKILLS_AUDIT.md` lineage / the split plan.)
- **`g.connector` is the canonical apex wire nodeId.** *Why:* it's baked into the connector + child parent tags and every party must agree on it, or paid forwarding breaks (T00/F06) — so it's a load-bearing on-wire term, not cosmetic. **Status:** the code, infra, and live edge all use **`g.connector`** (vhost `connector.<domain>/ilp`). A cleanup to purge the ~60 legacy `g.townhouse` references still on `origin/main` in favor of `g.connector` is a **pending follow-up**.

## Knowledge architecture

- **toon-meta is the shared context + skills hub**, distributed as a Claude Code plugin; each repo's `CLAUDE.md` links here. BMAD framework skills and the raw planning dump were removed in favor of this curated `context/`. *Why:* repos need accurate, low-noise shared context, not a 3000-line planning archive.
