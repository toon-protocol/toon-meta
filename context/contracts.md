# Inter-repo Contracts

How the TOON repos talk to each other, and where each contract's **source of truth** lives. There are two layers.

## Layer 1 — library/type contract (compile-time)

When repo B `npm install`s repo A's package, the published **`.d.ts` + semver** *is* the contract and the TS compiler enforces it. Discipline:

- Publish with **`pnpm publish`** (rewrites `workspace:*`); never `npm publish`. (See the broken `sdk@0.5.0`/`town@0.4.0`/`bls@1.2.0` for what happens otherwise.)
- The toon↔connector boundary is guarded by the **canary test** `packages/sdk/tests/integration/connector-contract.test.ts` + `CONNECTOR_RELEASE_CONTRACT.md`. Replicate this pattern on any boundary that matters.

This layer is in good shape; no shared schema package is needed for it.

## Layer 2 — wire contract (runtime, cross-process)

No compiler spans a *process* boundary (a client sends a packet to a connector; the connector POSTs to a relay; one node reads another's Nostr event). These need an explicit, shared source of truth. Homes:

| Seam (A → B) | Message shape | Source of truth | Status |
|---|---|---|---|
| ILP packet (OER) | client → connector → node | `@toon-protocol/shared` (`types/ilp`, `encoding/oer`) | ✅ one home |
| **localDelivery `/handle-packet`** | connector ↔ relay/store/node | **`@toon-protocol/shared`** (`types/local-delivery` → `PaymentRequest`/`PaymentResponse`) | ✅ unified (connector PR #140; sdk follow-up below) |
| payment-channel claim (BTP `payment-channel-claim`) | client/swap sign ↔ connector validates | connector `btp/` (message shapes) + `@toon-protocol/core` (`balanceProofHash*` helpers) | 🟡 split; claim hashing is shared |
| connector Admin HTTP API | hub → connector | connector `AdminServer`; hub `ConnectorAdminClient` | 🟡 two copies of the DTOs |
| TOON event codec (event ↔ bytes) | everywhere | `@toon-protocol/core` (`toon/`) | ✅ one home |
| Nostr event kinds + tags (10032 peer-info, 10035 SkillDescriptor, 5094/6094 Arweave DVM) | cross-node discovery / DVM | `@toon-protocol/core` (`events/`, builders) | ✅ mostly central |
| Fastify telemetry API | hub-web → hub | `@toon-protocol/hub` API server | product-local |
| MCP tool schemas | agent ↔ client-mcp / hub-mcp | each product's MCP package | product-local |

### The rule

**`@toon-protocol/shared` (connector-owned) is the home for transport/payment wire DTOs** (ILP packet, the `payment-channel-claim` message, localDelivery `PaymentRequest`/`PaymentResponse`, and — as they're unified — the admin-API DTOs). **`@toon-protocol/core` is the home for the TOON event/codec contract** (the binary codec, Nostr event/kind schemas, ILP address derivation). Every repo imports the one definition rather than re-declaring it.

### Why this matters (a real example)

`PaymentRequest`/`PaymentResponse` were defined **independently** in the connector *and* in `@toon-protocol/sdk`'s payment-handler bridge — two copies of one wire shape that could silently diverge. Connector PR #140 lifts the canonical definition into `@toon-protocol/shared@1.3.0`.

## Open follow-ups

1. **sdk** drops its duplicate `PaymentRequest`/`PaymentResponse` and imports from `@toon-protocol/shared@^1.3.0` (gated on shared 1.3.0 publishing — after connector PR #140 merges).
2. **Admin API DTOs** — unify the connector's `AdminServer` types and hub's `ConnectorAdminClient` into shared.
3. **Runtime validation** — the shapes above are TS types (erased at runtime). Adding `zod`/JSON-Schema validators in `shared` would make the wire contract *enforced* at the boundary, not just typed. Deferred (adds a dep to `shared`).
4. **Per-seam canary tests** — extend the `connector-contract.test.ts` pattern so each consuming repo asserts it still matches the shared contract.
