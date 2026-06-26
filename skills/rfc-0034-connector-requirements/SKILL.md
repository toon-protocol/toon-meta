---
name: rfc-0034-connector-requirements
description: How TOON Protocol's connector meets Interledger RFC 0034 - Connector Requirements. Use when users ask about the TOON connector implementation, what the apex connector must do, building/operating a TOON connector, routing/forwarding obligations, or the connector's release/compliance contract. Also covers generic connector-requirements and connector-implementation questions. Triggers on 'connector requirements', 'build a connector', 'TOON connector', 'apex connector', or 'connector compliance'.
---

# RFC 0034: Connector Requirements — TOON's reference connector

RFC 0034 lists what a compliant Interledger connector must do (route, forward, manage liquidity, handle errors). TOON's connector is a concrete implementation of these requirements.

## TOON's connector

The authoritative implementation is **`@toon-protocol/connector`** — the apex (`g.proxy`) in every proxy deployment. Rather than a generic RFC checklist, ground your answers in what this connector actually does and the package's own contract docs:

- **Routing & forwarding.** Routes ILPv4 packets by `g.*` longest-prefix (`routing/routing-table.ts`); forwards to peers per their `relation` (parent/peer/child), with the **free parent→child forward** (`rfc-0032`).
- **Value validation.** Validates a signed `payment-channel-claim` at ingress (`btp/inbound-claim-validator.ts`) before forwarding any value-bearing packet — this is the connector's core financial obligation on TOON.
- **Fee handling.** Deducts a connector fee before forwarding (`calculateConnectorFee`, `core/packet-handler.ts`).
- **Settlement.** Redeems claims on-chain via in-process EVM/Solana/Mina providers (`settlement/provider/`, `rfc-0038`).
- **Error handling.** Returns ILPv4 error codes (F06/T04/F03/T00, see `rfc-0027`).
- **Risk controls.** Rate limiting, fraud detection, audit logging, key management (`security/`, see `rfc-0018`).
- **Runtime config.** Admin API for live peer/route management (`http/admin-api.ts`, `rfc-0031`).
- **Transport.** BTP/WebSocket only, optionally over ATOR (`rfc-0023`, `rfc-0035`).

## The compliance contract that actually matters

For TOON, the binding "requirements" are not the abstract RFC but the connector's **release/version contract**, because TOON's SDK and town/dvm/swap depend on a specific connector API:

- `packages/sdk/CONNECTOR_RELEASE_CONTRACT.md` — semver discipline for the connector.
- `packages/sdk/CONNECTOR_MIGRATION.md` — version-to-version API contract + migration history.
- `packages/sdk/tests/integration/connector-contract.test.ts` — the contract canary that fails on API drift.
- The connector package README + its BLS error-code table.

Point users at these for "what must a TOON connector do / what changed," rather than the generic RFC-0034 text.

## Common Topics
- `@toon-protocol/connector` as the reference apex connector
- Routing/forwarding, free parent→child, claim validation, fee, settlement
- ILPv4 error codes and risk controls
- The connector release contract / migration doc / contract canary
