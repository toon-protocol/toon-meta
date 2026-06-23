# Epic 44: Payment Termination — run any HTTP service behind the connector like nginx

**Date:** 2026-06-23
**Author:** claude[bot] (issue-executor — agent/53)
**Status:** MVP delivered (all MVP stories closed); two future stories open
**Dependencies:** Epic 38 (RFC 9421 signer/verifier modules used by Story 44.5)
**Type:** Feature — new local-delivery handler + x402 greeting + client shim + relay decoupling
**North-star tier served:** T1 (mechanical; makes "deploy any app behind the connector" real for any HTTP service)
**Roadmap reference:** toon-protocol/toon-meta#52
**RFC:** `docs/payment-proxy.md` (formerly `docs/payment-termination.md`; renamed in PR #55 — historical snapshot readable via `git show 131a22b:docs/payment-termination.md`)

---

## Executive Summary

Terminate **payment** at the edge the way nginx terminates **TLS**: a standalone connector acts as
a payment-terminating reverse proxy, and apps run *behind* it, payment-oblivious. The north star:
**deploying an app behind a connector is as easy as deploying an app behind nginx.**

### Why this comes first

Agents are the universal client. The bet: make TOON a drop-in payment layer **in front of**
existing HTTP services (zero app changes), riding x402's installed base.

- **x402** (donated to the Linux Foundation, April 2026; tens of thousands of active agents) is the
  onboarding handshake. x402 settles on-chain per request.
- **TOON's edge** is off-chain channel settlement + n-hop routing. *x402 gets you in the door; TOON
  is the upgrade at agent-swarm volume.*

### What was built (MVP complete)

1. A connector-side **HTTP reverse-proxy handler** that decodes the literal HTTP request from the
   opaque ILP `data` buffer, validates a prepaid claim, replays byte-for-byte to an oblivious
   backend, and returns the HTTP response in the FULFILL.
2. An **x402 `402` greeting** with dual `accepts` entries (vanilla on-chain + TOON-channel) so
   plain x402 agents degrade gracefully while TOON-aware agents upgrade.
3. A **nginx-style route→upstream config surface** (`route {} upstream {}`) with runtime mutation
   via `PUT /admin/desired-state`.
4. A **connector CLI** (`connector up`, `connector app add`) so operators configure the terminator
   without curling the admin API.
5. **RFC 9421 claim↔request binding** (MVP subset, from Epic 38) on the critical path so a cheap
   claim cannot be replayed against an expensive route.
6. A **local Docker Compose** (connector + relay + chain devnet) for zero-friction local dev.
7. A **Linode public-internet test** proving the terminator + decoupled relay against real TLS on
   the live `devnet.toonprotocol.dev` chains.
8. `ToonClient.h402Fetch` + `toon_http_fetch_paid` MCP tool on the client side.
9. The relay **decoupled** from its embedded ConnectorNode — it now runs as a plain HTTP app behind
   the connector, proving the topology.

---

## Architecture

### The three-rung ladder

The agent client picks the rung transparently, like an HTTP client choosing keep-alive vs.
a WebSocket upgrade.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Rung 1 — Onboard via x402 / HTTP 402                                            │
│  Agent sends unpaid request → Terminator replies 402 with dual accepts:          │
│    accepts[0]: { scheme:"exact",        ...on-chain USDC }   ← plain x402 agent │
│    accepts[1]: { scheme:"toon-channel", ilpAddress, /ilp }   ← TOON-aware agent │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│ Rung 2 — Pay one-shot via transparent HTTP-in-ILP                               │
│                                                                                  │
│  Agent → POST /ilp                                                               │
│            body:   OER ILP PREPARE                                               │
│                    data = raw HTTP request (request-line + headers + body)       │
│            header: ILP-Payment-Channel-Claim: base64(claim)                     │
│                                                                                  │
│  Terminator:                                                                     │
│    1. validate claim (ClaimReceiver) + RFC 9421 claim↔request binding           │
│    2. strip hop-by-hop headers; inject X-TOON-Payer / X-TOON-Amount /           │
│       X-TOON-Chain                                                               │
│    3. replay byte-for-byte to configured upstream (plain HTTP)                   │
│    4. return upstream response in FULFILL data                                   │
│                                                                                  │
│  Agent ← OER ILP FULFILL  (data = raw HTTP response)                            │
│  Client shim surfaces this as a normal fetch() Response                         │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│ Rung 3 — Scale via HTTP→BTP upgrade                                             │
│  Existing BTP session / streaming / high-frequency path.                         │
│  Agent opens/reuses a duplex BTP session with advancing claims.                  │
│  Already shipped; no new work in this epic.                                      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Packet shape & non-pollution guarantee

```
ILP PREPARE
├─ amount             uint64        prepaid payment (flat per-route price)
├─ destination        ILP address   only field routing matches on (longest-prefix)
├─ expiresAt          timestamp
├─ executionCondition 32 bytes      SHA-256 hashlock (atomic multi-hop)
└─ data               Buffer        OPAQUE — raw HTTP request lives here

alongside (never inside data):
   header  ILP-Payment-Channel-Claim[-Wrapped]   signed balance-proof claim
   header  ILP-Peer-Id + Authorization           peer auth
```

The connector's only operation on `data` is `sha256(data)` to mint a transfer ID — it **never
parses it**. This keeps the connector format-agnostic (the relay's Nostr events and the terminator's
HTTP requests ride as identical opaque blobs). The TOON event codec (`encodeEventToToon` /
`shallowParseToon`) lives exclusively in handler-layer apps; the connector core imports only ILP-OER
framing.

### Layering

```
┌──────────────────────────────────────────────────────────────┐
│  HANDLER LAYER   HttpProxyHandler (new)                      │
│                  wired via ConnectorNode.setPacketHandler    │
│                  sibling to: swap/mill node, relay NIP-01    │
├──────────────────────────────────────────────────────────────┤
│  EDGE            ILP-over-HTTP ingress (POST /ilp)           │  ← already shipped
│                  RFC 9421 claim↔request binding (MVP)        │  ← Story 44.5
│                  x402 402 greeting                           │  ← Story 44.2
├──────────────────────────────────────────────────────────────┤
│  ROUTING         Longest-prefix ILP address table            │  ← already shipped
│                  Static config + admin-API runtime mutation  │
├──────────────────────────────────────────────────────────────┤
│  TRANSPORT       BTP-over-WebSocket (session/peer)           │  ← already shipped
│                  HTTP→BTP upgrade on shared listener         │  ← already shipped
└──────────────────────────────────────────────────────────────┘
```

### Component topology — what runs where

The connector does **not** embed a relay. The relay is a sibling backend behind the connector:

```
  Internet ──TLS──► nginx (dumb TLS terminator, existing)
                      │
                      ├─ /ilp ──► Connector (terminator) ──► Relay (oblivious app, plain HTTP)
                      │                                   ──► Any other HTTP app
                      └─ /ws ───► Relay WS (free reads; no payment path)
```

### nginx parallel

| nginx concept | TOON terminator equivalent |
|---|---|
| `server {} / location {}` | `route {} upstream {}` config grammar |
| `proxy_pass` | `HttpProxyHandler` replay |
| `auth_request` | **not applicable** — opaque packet blocks header-based auth; RFC 9421 binding is the equivalent |
| `conf.d/*.conf` | config file + `PUT /admin/desired-state` |
| SIGHUP reload | `PUT /admin/desired-state` (no-restart mutation; file-reload gap noted as future work) |

---

## Stories

### Story 44.1: HTTP reverse-proxy local-delivery handler (terminator core)

**Goal.** A connector-side handler that decodes the literal HTTP request from the opaque ILP
PREPARE `data`, validates a prepaid claim, replays byte-for-byte to a configured upstream, and
returns the HTTP response in the FULFILL.

**Status:** ✅ Closed — toon-protocol/connector#216

**Acceptance criteria.**
- AC1: Handler decodes request-line + headers + body from `data` (opaque `Buffer`; connector never assumes TOON/Nostr).
- AC2: Replays byte-for-byte to configured upstream over plain HTTP, stripping hop-by-hop headers.
- AC3: Injects `X-TOON-Payer`, `X-TOON-Amount`, `X-TOON-Chain` for optional backend per-payer logic.
- AC4: Upstream HTTP response returned as FULFILL `data`; upstream/transport errors map to ILP REJECT codes.
- AC5: Wired via `ConnectorNode.setPacketHandler` / `LocalDeliveryHandler` seam; connector never parses `data` beyond the HTTP envelope in this handler.
- AC6: Unit + integration tests; a paid `POST /ilp` reaches a stub upstream and the response round-trips.

**Files.** `packages/connector/src/core/handlers/http-proxy-handler.ts`; hooks `core/connector-node.ts` (`setPacketHandler`) and `config/types.ts` (`LocalDeliveryRequest/Response`).

**Dependencies.** None (core; blocks the rest of the epic).

---

### Story 44.2: x402 `402` greeting on the HTTP edge

**Goal.** Greet unpaid requests with a dual-entry `402` so plain x402 agents degrade gracefully
while TOON-aware agents upgrade.

**Status:** ✅ Closed — toon-protocol/connector#217

**Acceptance criteria.**
- AC1: Unpaid request to a terminated route returns HTTP `402` with x402 `accepts` array.
- AC2: `accepts` contains a vanilla on-chain entry (`scheme:"exact"`, e.g. Base/Solana USDC) AND a `toon-channel` entry (`{ ilpAddress, endpoint:"/ilp", price, chains, settlementAddresses }`).
- AC3: Plain x402 agent that ignores `toon-channel` scheme still gets a valid on-chain challenge.
- AC4: Advertised price/chains/ILP address sourced from the route config.

**Files.** `packages/connector/src/http/` (402-greeting middleware); wired into `ilp-http-adapter.ts` pre-auth path.

**Dependencies.** Story 44.1 (core handler must exist for route config to be meaningful), Story 44.3 (route config is the source of price/chains).

---

### Story 44.3: nginx-style route→upstream config surface

**Goal.** "Configure a connector as easily as nginx" — a route→upstream grammar that maps terminated
routes to upstreams, prices, and accepted chains.

**Status:** ✅ Closed — toon-protocol/connector#218

**Acceptance criteria.**
- AC1: Config supports per-route blocks, e.g. `route /v1/ { price <nanoUSDC>; upstream http://app:8080; chains evm,sol }`.
- AC2: Config loads at boot (`config-loader.ts`) and is settable at runtime via `PUT /admin/desired-state` (no restart).
- AC3: Route config feeds the 402 greeting (price/chains/ILP address) and the proxy handler (upstream).
- AC4: Either config-file reload (SIGHUP-style) OR desired-state documented as the canonical runtime surface.
- AC5: Tests cover boot-load + runtime mutation + reconciliation.

**Files.** `packages/connector/src/config/config-loader.ts`; `packages/connector/src/config/types.ts`; `packages/connector/src/http/admin-server.ts` (`PUT /admin/desired-state`).

**Dependencies.** Story 44.1.

---

### Story 44.4: Connector CLI + "add an app" UX

**Goal.** `connector up` + `connector app add` so operators configure the terminator without curling
the admin API.

**Status:** ✅ Closed — toon-protocol/connector#219

**Acceptance criteria.**
- AC1: `connector up` boots a standalone connector from a config file.
- AC2: `connector app add <name> --upstream <url> --route <path> --price <n> --chains <list>` registers a terminated app.
- AC3: `connector route add` / `connector route ls` / `connector app ls` manage routes/upstreams at runtime.
- AC4: No hub dependency; works against a bare connector container.
- AC5: `--json` output on all read commands; help text.

**Files.** `packages/connector/src/cli/` (new); thin wrapper over admin API.

**Dependencies.** Story 44.3 (route config API must exist).

---

### Story 44.5: RFC 9421 claim↔request binding (MVP subset)

**Goal.** Bind a prepaid claim to *this* request so a cheap claim cannot be replayed against an
expensive terminated route. Pull the minimal slice of Epic 38 onto the critical path.

**Status:** ✅ Closed — toon-protocol/connector#220

**Acceptance criteria.**
- AC1: Terminator verifies RFC 9421 signature covering `@method`, `@path`, `content-digest`, and advertised price for terminated requests.
- AC2: Claim presented for a different method/path/body/price is rejected.
- AC3: Reuses Epic 38 signer/verifier modules where they exist; does not block on the full 13-story Epic 38.
- AC4: Tests: replay against a different route is rejected; matching request is accepted.

**Files.** Terminator path in `packages/connector/src/http/ilp-http-adapter.ts` + proxy handler; Epic 38 signer/verifier imported.

**Dependencies.** Story 44.1; Epic 38 Stories 38.2–38.3 (signer/verifier modules).

---

### Story 44.6: Local Docker Compose — standalone terminator + one app behind it

**Goal.** One `docker compose up` brings up connector-as-terminator + oblivious relay + chain devnet
for zero-friction local development.

**Status:** ✅ Closed — toon-protocol/connector#221

**Network:** local anvil (no real funds)

**Acceptance criteria.**
- AC1: Compose file runs: connector (terminator) + relay (oblivious app, decoupled) + anvil + faucet.
- AC2: Relay reachable *only* through the terminator for paid writes; free reads stay on the relay's Nostr WS.
- AC3: End-to-end smoke test: `h402Fetch`/curl a paid route → terminator validates claim → relay stores → FULFILL.
- AC4: Documented in connector README; one command up/down.

**Files.** `connector/docker-compose.yml` (extended); `connector/infra/` devnet compose profile.

**Dependencies.** Stories 44.1–44.5; Story 44.9 (relay decoupled so it can run as a plain HTTP app behind the terminator).

---

### Story 44.7: Linode public-internet test — terminator + relay-behind-connector

**Goal.** Test the terminator + decoupled relay against the public internet on Linode, reusing the
live chain devnet at `devnet.toonprotocol.dev`.

**Status:** ✅ Closed — toon-protocol/connector#222

**Network:** devnet · **Funds:** treasury wallet, ≤ $50 (bounded)

**Acceptance criteria.**
- AC1: `connector/infra/linode` extended to run the terminator + oblivious relay.
- AC2: Public route reachable over TLS; external client completes a paid `h402Fetch` end-to-end with on-chain settlement on devnet chains.
- AC3: Cloud-init / treasury-funding patterns lifted from hub deploy without hub-repo dependency.
- AC4: GitHub Actions deploy job (re)deploys idempotently; status/endpoints published.

**Files.** `connector/infra/linode/` (extended); `.github/workflows/deploy-terminator.yml`.

**Dependencies.** Stories 44.1–44.6, 44.8 (client shim for the e2e test), 44.9 (relay decoupled).

---

### Story 44.8: `ToonClient.h402Fetch` — payment-aware HTTP fetch

**Goal.** A `fetch()`-like client that makes paying for an HTTP resource transparent: detect `402`,
pay over TOON, return a normal `Response`.

**Status:** ✅ Closed — toon-protocol/toon-client#50

**Acceptance criteria.**
- AC1: `client.h402Fetch(url, opts)` issues the request; on `402` parses x402 `accepts` and selects the `toon-channel` entry.
- AC2: Opens/reuses a payment channel via `ChannelManager` and sends a transparent HTTP-in-ILP packet to `POST /ilp` via `HttpIlpClient` (raw HTTP request in `data`, claim in `ILP-Payment-Channel-Claim` header).
- AC3: Returns a normal `Response` from the FULFILL payload; surface errors cleanly.

**Files.** `packages/client/src/h402-fetch.ts` (new); hooks `ChannelManager`, `HttpIlpClient`.

**Dependencies.** Story 44.1 (the `POST /ilp` endpoint behavior it drives), Story 44.2 (the 402 format it parses).

---

### Story 44.9: `toon_http_fetch_paid` MCP tool

**Goal.** Expose `h402Fetch` as an MCP tool so an agent can fetch a paid HTTP resource with one
tool call.

**Status:** ✅ Closed — toon-protocol/toon-client#51

**Acceptance criteria.**
- AC1: New tool `toon_http_fetch_paid` with inputs `{ url, method?, headers?, body?, timeout? }`.
- AC2: Dispatches to control daemon, which invokes `client.h402Fetch(...)`.
- AC3: Returns `{ status, headers, body }`; errors surface cleanly.
- AC4: Tool registered in MCP tool list with clear description; smoke test through daemon.

**Files.** `packages/client-mcp/src/mcp-tools.ts` (+ daemon route handler).

**Dependencies.** Story 44.8.

---

### Story 44.10: Decouple relay — run as an oblivious app behind the connector

**Goal.** Flip the topology: relay stops embedding a `ConnectorNode` and runs as a standalone,
payment-oblivious HTTP app behind the standalone connector (the first real "app behind the
connector").

**Status:** ✅ Closed — toon-protocol/relay#23

**Acceptance criteria.**
- AC1: Relay can run without auto-creating an embedded connector; `setPacketHandler` self-wiring is optional/removed for this mode.
- AC2: Relay exposes a plain-HTTP write surface (event-as-JSON); trusts injected `X-TOON-Payer/Amount/Chain` (payment already validated by the terminator).
- AC3: Relay free-read WebSocket path unaffected.
- AC4: End-to-end: connector terminator → relay stores event → FULFILL — smoke-tested in Story 44.6 Docker Compose.

**Files.** `relay/src/` (remove/gate embedded connector wiring); new plain-HTTP ingest handler.

**Dependencies.** Story 44.1 (terminator delivers to the relay's plain-HTTP surface).

---

### Story 44.11: Author epic planning artifact (BMAD format)

**Goal.** Formalize the payment-termination RFC and child-issue landscape into this org BMAD epic
format so the backlog tooling can track delivery.

**Status:** ✅ Closed — toon-protocol/toon-meta#53 (this document)

**Acceptance criteria.**
- AC1: Planning artifact in `docs/epic-44-payment-termination.md` with executive summary, architecture, stories mirroring the child issues, risks table, and Definition of Done.
- AC2: Cross-links to RFC (PR #51, commit 131a22b) and all child issues.
- AC3: Consistent with corrected transport docs: ILP-over-HTTP = edge ingress (RFC-0035); BTP = session/peer transport (RFC-0023).

**Files.** `docs/epic-44-payment-termination.md` (this document).

**Dependencies.** None.

---

### Story 44.12: Swap-as-routing-FX-hop (token-agnostic) [future]

**Goal.** Make payment token-agnostic across hops: agent pays in token A, destination receives token
B, a swap-capable connector on the route converts transparently. This is the n-hop moat; it is
wiring, not new primitives.

**Status:** 🔵 Open — toon-protocol/connector#223

**Scope.**
- Lift `applyRate` + multi-chain claim issuance from the swap/mill destination handler (`swap-handler.ts`) into the connector forwarding path (fire when inbound ledger ≠ outbound ledger).
- Let routing select a swap-capable hop when the destination accepts a token the sender doesn't hold.
- Add sender-side intent ("deliver ≥ X of destination asset for ≤ Y of my asset") + a quote.
- Atomicity survives conversion: execution-condition binds the path end-to-end even as the amount changes at the FX hop.

**Dependencies.** All MVP stories closed.

---

### Story 44.13: RFC 9421 hardening on the terminator path [future]

**Goal.** Complete RFC 9421 hardening beyond the MVP claim↔request binding: replay cache, JWKS /
`.well-known`, content-digest canonicalisation, key lifecycle, migration telemetry.

**Status:** 🔵 Open — toon-protocol/connector#224

**Scope.** Pull remaining Epic 38 stories (38.4–38.10, 38.12–38.13) as they apply to the
terminator surface. Deferred; decompose into executor-sized children when prioritised.

**Dependencies.** Story 44.5; Epic 38 full delivery.

---

## Risks

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Opaque packet prevents nginx `auth_request` model | High (architectural) | Low (expected) | RFC 9421 claim↔request binding is the correct substitute; documented in RFC §"nginx: keep the packet, steal the config" |
| RFC 9421 on critical path (Story 44.5) blocks MVP before Epic 38 ships | Medium | High | Story 44.5 scoped to a minimal slice (signer/verifier modules only); does not require the full 13-story Epic 38 |
| Config hot-reload gap vs nginx | Medium | Low | `PUT /admin/desired-state` is the documented canonical runtime surface; SIGHUP file-reload is noted as future work |
| Token-agnostic routing (Story 44.12) missing from MVP | High (intentional) | Medium | The n-hop moat is documented; FX primitives exist (`applyRate`, multi-chain issuance); Story 44.12 is the wiring |
| RFC 9421 hardening deferred (Story 44.13) | Medium | Medium | MVP subset (claim↔request binding) is on the critical path; full hardening (replay cache, JWKS) deferred and tracked in Story 44.13 / connector#224 |
| Relay decoupling breaks existing hub Compose bundles | Low | Medium | Decoupling designed as opt-in/gate; embedded-connector mode preserved during transition (Story 44.10) |

---

## Definition of Done

- [x] Terminator core (Story 44.1) — `HttpProxyHandler` wired via `setPacketHandler`; unit + integration tests green.
- [x] x402 dual-entry `402` greeting (Story 44.2) — vanilla x402 agents degrade gracefully; TOON-aware agents upgrade.
- [x] nginx-style config surface (Story 44.3) — boot-load + runtime mutation via `PUT /admin/desired-state`.
- [x] Connector CLI (Story 44.4) — `connector up` + `connector app add`; no hub dependency.
- [x] RFC 9421 claim↔request binding (Story 44.5) — cheap claim cannot be replayed against an expensive route.
- [x] Local Docker Compose (Story 44.6) — `docker compose up`; end-to-end smoke test passes.
- [x] Linode public-internet test (Story 44.7) — paid `h402Fetch` e2e with on-chain devnet settlement.
- [x] `ToonClient.h402Fetch` (Story 44.8) — `fetch()`-like client; 402 detection and payment transparent to caller.
- [x] `toon_http_fetch_paid` MCP tool (Story 44.9) — agent tool registered; smoke-tested through daemon.
- [x] Relay decoupled (Story 44.10) — relay runs as a plain HTTP app behind the connector; zero embedded ConnectorNode in the new topology.
- [x] This planning artifact (Story 44.11).
- [ ] Swap-as-routing-FX-hop (Story 44.12) — token-agnostic routing; tracked in connector#223.
- [ ] RFC 9421 hardening (Story 44.13) — full replay cache + JWKS + key lifecycle; tracked in connector#224.

## Estimated Total Effort

11 MVP stories (all closed). 2 future stories open (connector#223, connector#224).

MVP estimate (retrospective): ~2–3 sprints across connector, toon-client, relay, and toon-meta.
Future stories: each requires its own decomposition before estimation.

## Test design

- Unit tests: `http-proxy-handler.ts`, claim↔request binding (Story 44.5), config loader (Story 44.3).
- Integration tests: Docker Compose e2e smoke (Story 44.6), `h402Fetch` round-trip (Story 44.8).
- Public-internet test: Linode terminator + relay + devnet chains (Story 44.7).
- Negative-path matrix for RFC 9421 hardening: tracked in Story 44.13 / Epic 38 `test-design-epic-38.md`.
