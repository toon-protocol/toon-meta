# Architectural Decisions

Curated, durable decisions. ADR-lite: each is *decision → why*.

## Payment & protocol

- **Messages and money are one packet.** Every monetized flow = a single ILP PREPARE carrying both the TOON-encoded event and its payment. *Why:* the core protocol thesis; no separate invoice/settle round-trip.
- **Prepaid, supply-driven pricing.** Providers advertise price in a replaceable Nostr event (`SkillDescriptor`, kind:10035); the request packet's amount IS the payment. `settleCompute()` deprecated. *Why:* removes request-for-quote latency; the network can't distinguish rails.
- **TOON uses signed payment-channel claims over BTP — not SPSP / STREAM / payment-pointers / HTLC / ILP-over-HTTP.** SPSP kinds (23194/23195) were removed. *Why:* a write is one packet + one balance-proof claim; there's no stream to chunk, no quoting, no HTLC escrow. See the `rfc-*` skills for per-RFC detail.
- **USDC is the sole user-facing token.** *Why:* simplicity; operator staking tokens stay invisible to relay users.
- **Claims are per-chain balance proofs:** EIP-712 (EVM), Ed25519 (Solana), Pallas/Schnorr zk (Mina). Settlement is **in-process multi-chain** (not RFC-0038's separate service), redeeming via `claimFromChannel` at a per-peer threshold.

## Boundaries

- **Claim validation lives ONLY in the connector.** `core` never imports the connector (structural `EmbeddableConnectorLike` interface); `sdk` dynamically imports it only to auto-create one; the `payment-handler-bridge` dispatches an *already-paid* packet to business logic. *Why:* the connector is the only component holding channel state — re-validating downstream is double work and incorrect.
- **Apex / free-forward.** Operators run an apex (connector `g.townhouse`) + child nodes; parent→child packets carry no per-packet claim (settled in aggregate). Children must be `relation:'child'` and tag `g.townhouse` as parent. *Why:* one paid hop at the edge; children earn via aggregate settlement.
- **Trust degrades; money doesn't.** (TEE) Attestation state changes never trigger payment-channel closure. *Why:* trust is a gradient, not a gate.

## Repo split (2026-06)

- **Polyrepo with npm + pinned-digest coupling** (not a monorepo, not submodules). *Why:* per-team ownership; teams build/test/release without rebuilding the world. Mirrors how the connector was already consumed.
- **`toon` (core+sdk) is libraries only; connector is an optional peer.** *Why:* the library layer must build/publish independent of the payment engine.
- **The connector owns & publishes `@toon-protocol/mina-zkapp`.** *Why:* one canonical Mina channel contract; the connector already depends on it, and it was unpublished/`private`, breaking installs.
- **Publish via `pnpm publish` / changesets, never `npm publish`.** *Why:* `npm publish` shipped unresolved `workspace:*`, making `sdk@0.5.0`/`town@0.4.0` uninstallable. (See `SKILLS_AUDIT.md` lineage / the split plan.)
- **`g.townhouse` wire nodeId is frozen** across cosmetic renames. *Why:* it's baked into the connector + child parent tags; changing it breaks paid forwarding (T00/F06).

## Knowledge architecture

- **toon-meta is the shared context + skills hub**, distributed as a Claude Code plugin; each repo's `CLAUDE.md` links here. BMAD framework skills and the raw planning dump were removed in favor of this curated `context/`. *Why:* repos need accurate, low-noise shared context, not a 3000-line planning archive.
