# 3. Technical Assumptions

## 3.1 Repository Structure: Monorepo

The project uses a pnpm monorepo with six packages plus a Docker entrypoint:
- `@crosstown/core` - Main protocol library (discovery, SPSP, trust, bootstrap, compose)
- `@crosstown/bls` - Standalone Business Logic Server (payment verification, TOON, pricing, storage)
- `@crosstown/relay` - ILP-gated Nostr relay reference implementation
- `@crosstown/agent` - Autonomous LLM-powered agent runtime (Epic 11, in progress)
- `@crosstown/examples` - Integration examples (private, not published)
- `@crosstown/ui-prototypes` - React UI prototypes for network visualization (private)
- `docker/` - Standalone Docker entrypoint for BLS + relay + bootstrap deployment

**Rationale:** Monorepo simplifies dependency management between packages and enables atomic changes. The BLS was extracted (Epic 5) for independent Docker deployment. The agent runtime (Epic 11) adds LLM-powered autonomous event processing.

## 3.2 Service Architecture

The project provides both a **library** and **deployable services**. Three integration modes are supported:

1. **Embedded Mode:** `createCrosstownNode()` wires ConnectorNode + BLS + Bootstrap + RelayMonitor in-process with zero-latency function calls
2. **HTTP Mode:** Library in agent process communicates with connector via Admin API (separate processes)
3. **Docker Mode:** Standalone container running BLS + relay + bootstrap as a service via `docker/src/entrypoint.ts`

**Rationale:** Embedded mode provides optimal performance for agents importing the library directly. HTTP mode supports isolated deployments. Docker mode enables plug-and-play integration with agent-runtime.

## 3.3 Testing Requirements

- **Unit Tests:** Required for all public APIs using Vitest with mocked SimplePool
- **Integration Tests:** Five-peer bootstrap test with mocked connectors (`vitest.integration.config.ts`)
- **Agent Runtime Tests:** Using Vercel AI SDK `MockLanguageModelV3` for deterministic testing without LLM calls
- **E2E Tests:** Not in current scope — planned for post-Epic 11

**Rationale:** Mocked tests ensure CI reliability without external dependencies. Integration tests validate multi-component bootstrap flows.

## 3.4 Additional Technical Assumptions

- Agents own their Nostr keypairs; the library does not manage keys
- NIP-44 encryption is stable and supported by nostr-tools
- agent-runtime Admin API remains stable for peer/route/channel management
- Nostr relays reliably serve replaceable events (kind:10032)
- TOON encoding via `@toon-format/toon` for ILP packet data
- pnpm workspaces for monorepo management
- tsup for library bundling (ESM output)
- `@agent-runtime/connector` is an optional peer dependency for embedded mode
- Vercel AI SDK v6 for LLM integration in agent runtime
- Static SPSP publishing (kind:10047) was removed — SPSP uses only encrypted request/response (kind:23194/23195) to protect shared secrets
- Gas Town instances (Go) interact as standard protocol peers via NIP-01 WebSocket and ILP BTP/HTTP — no custom bridge protocol
- Cross-Town message latency of 50-200ms via Nostr relays is acceptable for all inter-Town operations (work dispatch, mail, protocol messages, DVM jobs)
- NIP-34, NIP-29, NIP-32, NIP-46, NIP-85, NIP-77 are available and stable in nostr-tools or implementable via raw event construction

---
