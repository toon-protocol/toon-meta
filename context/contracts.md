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
| **localDelivery `/handle-packet`** | connector ↔ relay/store/node | **`@toon-protocol/shared`** (`types/local-delivery` → `PaymentRequest`/`PaymentResponse`, **zod-validated**) | ✅ unified + runtime-validated (PR #140) |
| payment-channel claim (BTP `payment-channel-claim`) | client/swap sign ↔ connector validates | connector `btp/` (message shapes) + `@toon-protocol/core` (`balanceProofHash*` helpers) | 🟡 split; claim hashing is shared |
| connector Admin HTTP API | hub → connector | **`@toon-protocol/shared`** (`types/admin` → `PeerRegistrationRequest`, zod) for peer-registration; rest still connector/hub local | 🟡 peer-registration unified (PR #140; connector derives from it); other DTOs = backlog |
| TOON event codec (event ↔ bytes) | everywhere | `@toon-protocol/core` (`toon/`) | ✅ one home |
| Nostr event kinds + tags (10032 peer-info, 10035 SkillDescriptor, 5094/6094 Arweave DVM) | cross-node discovery / DVM | `@toon-protocol/core` (`events/`, builders) | ✅ mostly central |
| Fastify telemetry API | hub-web → hub | `@toon-protocol/hub` API server | product-local |
| MCP tool schemas | agent ↔ client-mcp / hub-mcp | each product's MCP package | product-local |

### The rule

**`@toon-protocol/shared` (connector-owned) is the home for transport/payment wire DTOs** (ILP packet, the `payment-channel-claim` message, localDelivery `PaymentRequest`/`PaymentResponse`, and — as they're unified — the admin-API DTOs). **`@toon-protocol/core` is the home for the TOON event/codec contract** (the binary codec, Nostr event/kind schemas, ILP address derivation). Every repo imports the one definition rather than re-declaring it.

### Why this matters (a real example)

The connector's localDelivery `PaymentRequest`/`PaymentResponse` is the canonical wire shape; **connector PR #140 lifts it into `@toon-protocol/shared@1.3.0`** so any process implementing `/handle-packet` imports one definition.

**Nuance discovered (don't naively "dedup"):** `@toon-protocol/sdk`'s payment-handler *bridge* has a **separate, intentionally-different internal type** — flat `{accept, code?, message?, metadata?}` for handler ergonomics (`ctx.accept(metadata)` / `ctx.reject(ilpCode)`) — and `create-node.ts` (~654–694) has a **deliberate adapter** that translates it to the connector's wire shape (`data` base64 + `rejectReason`, via the canonical reject-code map in `@toon-protocol/core`). So sdk's bridge type is **not** a duplicate of the wire contract and must not be merged with it; the correct hardening is to type that *adapter boundary* against `shared`'s wire types.

## Status & follow-ups

**Shipped on PR #140 (connector/shared side, verified — connector's full Jest suite + the new canary pass):**
- ✅ **zod runtime validation** — `shared` now exports zod schemas (`PaymentRequestSchema`, `PaymentResponseSchema`, `PeerRegistrationRequestSchema`) with inferred types; the wire contract is enforceable at the boundary, not just typed. (zod is `shared`'s first dependency — a deliberate call.)
- ✅ **Admin peer-registration slice** — `PeerRegistrationRequest`/`PeerRelation` live in `shared`; the connector now **derives** its `config/types` `PeerRegistrationRequest` from the shared wire shape (refining `settlement`) and re-exports `PeerRelation` from shared.
- ✅ **Canary** — `shared/types/contract.test.ts` (6 cases) validates accept/reject of sample payloads; runs in the connector's Jest suite.

**Gated consumer adoptions (wait on `shared@1.3.0` publishing — PR #140 merge + npm token):**
1. **sdk adapter boundary** — type `create-node.ts`'s connector-facing adapter against `shared`'s `PaymentResponse`. The bridge's internal DX type **stays** (it is not the wire contract).
2. **hub** — import `PeerRegistrationRequest` from `shared` for its `registerPeer` calls (drops hub's local copy).

**Remaining backlog:**
3. **Other admin DTOs** — routes / channels / earnings / settlement / inventory (incremental, same pattern as peer-registration).
4. **More canaries** — extend per consuming repo as they adopt the shared schemas.
