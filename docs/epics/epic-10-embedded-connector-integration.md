# Epic 10: Embedded Connector Integration

**Phase:** Integration
**Estimated Stories:** 5
**Dependencies:** Epic 9 (npm packages published), agent-runtime `@agent-runtime/connector` published as npm library
**Blocks:** Epic 11 (NIP Handler Agent Runtime — consumes `createAgentSocietyNode()`)

---

## Epic Goal

Eliminate the HTTP boundary between agent-society and agent-runtime by embedding the `ConnectorNode` directly in-process. Align naming conventions with agent-runtime (`handlePayment` → `handlePacket`). The end state: agent-society can run the ILP connector in the same process with zero-latency function calls, while retaining HTTP as a fallback for isolated deployments.

## Epic Description

### Existing System Context

- **Current functionality:** agent-society communicates with agent-runtime via HTTP — `POST /ilp/send` for outbound ILP packets, `POST /admin/peers` for peer registration, `POST /handle-payment` for incoming packet handling. This works but adds latency, deployment complexity, and a process boundary.
- **Technology stack:** TypeScript, pnpm monorepo, nostr-tools, Hono (BLS HTTP), ws (WebSocket)
- **Integration points:** `AgentRuntimeClient` interface (core/bootstrap), `ConnectorAdminClient` interface (core/bootstrap), `BusinessLogicServer.handlePayment()` (bls), Docker entrypoint wiring (docker/src/entrypoint.ts)

### What's Being Done

**Part A — Rename `handlePayment` → `handlePacket` (alignment with agent-runtime)**

Full rename of methods, types, HTTP routes, and all source-code references to align with agent-runtime's naming (`setPacketHandler`, `PaymentHandler`, `POST /handle-packet`):

| Old | New |
|-----|-----|
| `handlePayment()` | `handlePacket()` |
| `HandlePaymentRequest` | `HandlePacketRequest` |
| `HandlePaymentAcceptResponse` | `HandlePacketAcceptResponse` |
| `HandlePaymentRejectResponse` | `HandlePacketRejectResponse` |
| `HandlePaymentResponse` | `HandlePacketResponse` |
| `/handle-payment` (HTTP route) | `/handle-packet` |

Affects: `packages/bls/`, `packages/relay/`, `docker/`, `packages/examples/`, integration docs.

**Part B — Embedded ConnectorNode integration**

1. **`createDirectRuntimeClient(connector, config)`** — In-process `AgentRuntimeClient` that wraps `ConnectorNode.sendPacket()` directly. Uses structural typing (`ConnectorNodeLike` interface) so `@agent-runtime/connector` remains an optional peer dependency. Handles amount/data conversion, execution condition computation (`SHA256(SHA256(event.id))`), and fulfill/reject response mapping.

2. **`createDirectConnectorAdmin(connector)`** — In-process `ConnectorAdminClient` that wraps `ConnectorNode.registerPeer()` / `removePeer()` directly.

3. **Make BLS `handlePacket()` public** — Change from `private` to `public` so the connector can call it directly via `setPacketHandler()` without HTTP.

4. **`createAgentSocietyNode(config)`** — Single composition function that wires ConnectorNode ↔ BLS ↔ BootstrapService ↔ RelayMonitor ↔ SPSP into one object with `start()` / `stop()` lifecycle. This is the primary API for embedded mode.

5. **HTTP client renamed** — Rename `createAgentRuntimeClient` → `createHttpRuntimeClient` with backward-compat alias. Both HTTP and direct clients implement the same `AgentRuntimeClient` interface.

### What's NOT Changing

- `AgentRuntimeClient` interface — consumers (BootstrapService, IlpSpspClient, RelayMonitor) are unchanged
- `ConnectorAdminClient` interface — consumers unchanged
- Docker entrypoint — continues to work with HTTP mode
- Nostr event kinds, SPSP protocol, trust scoring
- BLS storage, pricing, TOON encoding logic

### Key Technical Decision

The `handlePacket` callback in `createAgentSocietyNode()` is passed as a **function**, not a `BusinessLogicServer` instance. This is because SPSP handling logic (kind:23194 → settlement negotiation, encrypted response generation, channel opening) currently lives in `docker/src/entrypoint.ts`, not in `BusinessLogicServer`. The caller provides the full handler.

## Acceptance Criteria

- [ ] All `handlePayment` references renamed to `handlePacket` across bls, relay, docker, examples packages
- [ ] HTTP route `/handle-payment` renamed to `/handle-packet` everywhere
- [ ] All existing tests pass with renamed routes/methods
- [ ] `createDirectRuntimeClient(connector)` sends ILP packets through ConnectorNode without HTTP
- [ ] `createDirectConnectorAdmin(connector)` registers/removes peers through ConnectorNode without HTTP
- [ ] `BusinessLogicServer.handlePacket()` is public and callable directly
- [ ] `createAgentSocietyNode()` wires connector ↔ BLS ↔ bootstrap ↔ relay monitor in-process
- [ ] `createHttpRuntimeClient()` works as HTTP fallback (backward compat alias preserved)
- [ ] `@agent-runtime/connector` is an optional peer dependency (HTTP-only mode works without it)
- [ ] `pnpm build` and `pnpm test` pass across all packages

## Stories

| # | Story | Description | Size |
|---|-------|-------------|------|
| 10.1 | Rename handlePayment → handlePacket across codebase | Rename method, types, HTTP route, exports, and test references in bls, relay, docker, examples packages. Update integration docs. | M |
| 10.2 | Create createDirectRuntimeClient() | In-process AgentRuntimeClient wrapping ConnectorNode.sendPacket(). Structural ConnectorNodeLike interface, TOON-aware execution condition computation, fulfill/reject mapping. Unit tests. | M |
| 10.3 | Create createDirectConnectorAdmin() and make BLS handlePacket() public | In-process ConnectorAdminClient wrapping registerPeer()/removePeer(). Change BLS method visibility to public. Unit tests. | S |
| 10.4 | Create createAgentSocietyNode() composition function | Wires connector ↔ BLS ↔ bootstrap ↔ relay monitor with start()/stop() lifecycle. handlePacket callback pattern. Integration tests with mocks. | L |
| 10.5 | HTTP client rename and export updates | Rename createAgentRuntimeClient → createHttpRuntimeClient with alias. Add all new exports to bootstrap/index.ts and core/index.ts. Add optional peerDependency for @agent-runtime/connector. | S |

## Files Changed Per Story

### Story 10.1 (Rename)
- `packages/bls/src/bls/types.ts` — type interfaces
- `packages/bls/src/bls/BusinessLogicServer.ts` — method, imports, route
- `packages/bls/src/bls/BusinessLogicServer.test.ts` — route strings
- `packages/bls/src/bls/index.ts` — exports
- `packages/bls/src/index.ts` — exports
- `packages/bls/src/entrypoint.test.ts` — route reference
- `packages/bls/README.md` — endpoint docs
- `packages/relay/src/bls/types.ts` — type interfaces
- `packages/relay/src/bls/BusinessLogicServer.ts` — method, imports, route
- `packages/relay/src/bls/BusinessLogicServer.test.ts` — route strings
- `packages/relay/src/bls/index.ts` — exports
- `packages/relay/src/index.ts` — exports
- `docker/src/entrypoint.ts` — imports, route, type usages
- `docker/src/entrypoint.test.ts` — route strings
- `packages/examples/src/ilp-gated-relay-demo/mock-connector.ts` — URL string
- `docs/AGENT-RUNTIME-INTEGRATION.md` — endpoint references
- `INTEGRATION-GAPS.md` — endpoint references

### Story 10.2 (Direct Runtime Client)
- `packages/core/src/bootstrap/direct-runtime-client.ts` — **new**
- `packages/core/src/bootstrap/direct-runtime-client.test.ts` — **new**

### Story 10.3 (Direct Admin + BLS Public)
- `packages/core/src/bootstrap/direct-connector-admin.ts` — **new**
- `packages/core/src/bootstrap/direct-connector-admin.test.ts` — **new**
- `packages/bls/src/bls/BusinessLogicServer.ts` — private → public
- `packages/relay/src/bls/BusinessLogicServer.ts` — private → public

### Story 10.4 (Composition Function)
- `packages/core/src/compose.ts` — **new**
- `packages/core/src/compose.test.ts` — **new**

### Story 10.5 (HTTP Rename + Exports)
- `packages/core/src/bootstrap/agent-runtime-client.ts` — rename function
- `packages/core/src/bootstrap/index.ts` — add new exports
- `packages/core/src/index.ts` — add new exports
- `packages/core/package.json` — add optional peerDependency

## Compatibility Requirements

- [x] `AgentRuntimeClient` interface unchanged — all existing consumers work
- [x] `ConnectorAdminClient` interface unchanged — all existing consumers work
- [x] HTTP fallback preserved via `createHttpRuntimeClient()`
- [x] Backward-compat alias: `createAgentRuntimeClient` still works
- [x] Docker entrypoint continues to function in HTTP mode

## Risk Mitigation

- **Primary Risk:** handlePayment → handlePacket rename is wide-reaching (17+ source files, 50+ test references)
- **Mitigation:** Mechanical find-and-replace with build + test validation after each package
- **Rollback Plan:** Single git revert since all changes are in one epic

## Definition of Done

- [ ] All stories completed with acceptance criteria met
- [ ] `pnpm build` succeeds across all packages
- [ ] `pnpm test` passes with no regressions
- [ ] Type checking passes: `npx tsc --noEmit` per package
- [ ] New direct-runtime-client, direct-connector-admin, and compose modules have unit/integration tests
- [ ] Documentation updated (integration docs, README)

---
