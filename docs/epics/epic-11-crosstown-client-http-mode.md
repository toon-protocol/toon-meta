# Epic 11: Crosstown Client HTTP Mode Support

**Phase:** Client Development
**Estimated Stories:** 3
**Dependencies:** Epic 10 (Embedded Connector Integration - for interface definitions), docker-compose infrastructure
**Blocks:** Future client-side features, browser-based agents

---

## Epic Goal

Enable `@crosstown/client` to connect to external ILP connectors via HTTP, allowing agents to use Crosstown without embedding a full connector in-process. This unlocks deployment flexibility, reduces resource overhead for agent applications, and enables browser-based agents in the future.

## Epic Description

### Existing System Context

- **Current functionality:** `createCrosstownNode()` in `@crosstown/core` (Epic 10) only supports **embedded mode** (requires `@agent-runtime/connector` in-process). Existing architecture provides building blocks (BootstrapService, RelayMonitor, NostrSpspClient) but requires agents to embed full ILP connector.
- **Technology stack:** TypeScript, Node.js, Nostr Protocol (nostr-tools), ILP, TOON encoding format (@crosstown/relay), Docker Compose infrastructure
- **Integration points:**
  - `@crosstown/core` - Core services (BootstrapService, RelayMonitor, NostrSpspClient, AgentRuntimeClient/ConnectorAdminClient interfaces)
  - `@crosstown/relay` - TOON encoding/decoding for Nostr events
  - External connector HTTP API (runtime: :8080, admin: :8081)
  - Docker infrastructure (docker-compose-simple.yml, docker-compose-full-stack.yml)

### What's Being Done

Create `@crosstown/client` package - a high-level, full-featured Nostr client that supports **both** embedded and HTTP connector modes.

**New Components:**

1. **HttpRuntimeClient** - Implements `AgentRuntimeClient` interface, sends ILP packets via HTTP POST to connector runtime API (:8080)
2. **HttpConnectorAdmin** - Implements `ConnectorAdminClient` interface, manages peers via connector admin API (:8081)
3. **HTTP mode initialization** - `initializeHttpMode()` function that sets up HTTP clients instead of embedded connector
4. **CrosstownClient class** - Unified client API that abstracts embedded vs HTTP mode differences
5. **Configuration option** - `connectorUrl` parameter (mutually exclusive with `connector`)

**Key Design Principles:**

- **Mode Detection:** Automatically detect embedded vs HTTP mode based on config (`connector` vs `connectorUrl`)
- **Unified API:** Same `CrosstownClient` public interface works for both modes
- **Config Validation:** Clear errors if both modes specified or neither specified
- **Adapter Pattern:** HttpRuntimeClient/HttpConnectorAdmin implement same interfaces as DirectRuntimeClient/DirectConnectorAdmin

**Integration Flow (HTTP Mode):**

```typescript
const client = new CrosstownClient({
  connectorUrl: 'http://localhost:8080',  // HTTP mode
  secretKey,
  ilpInfo: { ilpAddress: 'g.agent.alice', ... },
  toonEncoder: encodeEvent,
  toonDecoder: decodeEvent,
});

await client.start();  // Bootstrap peers, start relay monitoring
await client.publishEvent(myEvent);  // Send via HTTP → connector → BLS
```

**What's NOT Changing:**

- `AgentRuntimeClient` interface - HTTP clients implement same interface as direct clients
- `ConnectorAdminClient` interface - HTTP admin implements same interface
- Embedded mode functionality - `createCrosstownNode()` continues to work unchanged
- `@crosstown/core` services (BootstrapService, RelayMonitor, NostrSpspClient)
- Nostr event kinds, SPSP protocol, TOON encoding logic

### Key Technical Decisions

1. **HTTP clients use Node.js built-in `fetch`** - No additional dependencies, easy to mock in tests
2. **Admin URL derived from runtime URL** - Default: replace port 8080 → 8081 (configurable)
3. **Retry logic with exponential backoff** - Retry network errors (ECONNREFUSED, ETIMEDOUT), not 4xx errors
4. **No `handlePacket` callback in HTTP mode** - Connector handles incoming packets, not the client
5. **Channel client returns `null` in HTTP mode** - Direct channel operations not supported in initial HTTP mode (future enhancement)

## Acceptance Criteria

- [ ] HttpRuntimeClient implements `AgentRuntimeClient` interface and sends ILP packets via HTTP
- [ ] HttpConnectorAdmin implements `ConnectorAdminClient` interface and manages peers via HTTP
- [ ] `initializeHttpMode()` creates HTTP clients and core services (BootstrapService, RelayMonitor)
- [ ] CrosstownClient accepts `connectorUrl` config parameter (mutually exclusive with `connector`)
- [ ] Config validation throws clear errors for invalid configurations
- [ ] CrosstownClient.start() works correctly in HTTP mode
- [ ] CrosstownClient.publishEvent() sends events via HttpRuntimeClient in HTTP mode
- [ ] E2E test publishes event through docker-compose infrastructure (agent → HTTP connector → BLS → relay)
- [ ] Unit test coverage ≥90% for HTTP components
- [ ] README includes HTTP mode configuration examples
- [ ] No regression in existing embedded mode functionality

## Stories

| # | Story | Description | Size |
|---|-------|-------------|------|
| 11.1 | Implement HttpRuntimeClient | Create HTTP client implementing `AgentRuntimeClient` interface. Sends ILP packets via `POST /ilp`. Includes retry logic with exponential backoff, error handling for network/connector errors. Unit tests with mocked HTTP. | M |
| 11.2 | Implement HttpConnectorAdmin | Create HTTP client implementing `ConnectorAdminClient` interface. Methods: `addPeer()`, `removePeer()`, `getPeers()` via admin API. Error handling for unauthorized, not found, duplicate peer. Unit tests with mocked HTTP. | M |
| 11.3 | HTTP Mode Integration & E2E Testing | Create `@crosstown/client` package. Implement `initializeHttpMode()`, `CrosstownClient` class, config validation. Wire HTTP clients into lifecycle. E2E test using docker-compose infrastructure. Update README with examples. | L |

## Files Changed Per Story

### Story 11.1 (HttpRuntimeClient)
- `packages/client/src/adapters/HttpRuntimeClient.ts` — **new**
- `packages/client/src/adapters/HttpRuntimeClient.test.ts` — **new**
- `packages/client/src/adapters/index.ts` — **new** (exports)

### Story 11.2 (HttpConnectorAdmin)
- `packages/client/src/adapters/HttpConnectorAdmin.ts` — **new**
- `packages/client/src/adapters/HttpConnectorAdmin.test.ts` — **new**
- `packages/client/src/adapters/index.ts` — update exports

### Story 11.3 (Integration & E2E)
- `packages/client/package.json` — **new** (package definition)
- `packages/client/tsconfig.json` — **new**
- `packages/client/tsup.config.ts` — **new**
- `packages/client/src/CrosstownClient.ts` — **new** (main client class)
- `packages/client/src/index.ts` — **new** (public exports)
- `packages/client/src/types.ts` — **new** (TypeScript interfaces)
- `packages/client/src/errors.ts` — **new** (error classes)
- `packages/client/src/config.ts` — **new** (config validation)
- `packages/client/src/modes/http.ts` — **new** (HTTP mode init)
- `packages/client/src/modes/embedded.ts` — **new** (embedded mode init)
- `packages/client/src/modes/types.ts` — **new**
- `packages/client/src/utils/retry.ts` — **new** (retry logic)
- `packages/client/src/utils/validation.ts` — **new**
- `packages/client/tests/e2e/http-mode.test.ts` — **new** (E2E test)
- `packages/client/tests/e2e/README.md` — **new** (setup guide)
- `packages/client/README.md` — **new** (usage examples)
- `pnpm-workspace.yaml` — add `@crosstown/client` to workspace

## Compatibility Requirements

- [x] `AgentRuntimeClient` interface unchanged - HTTP clients implement same interface
- [x] `ConnectorAdminClient` interface unchanged - HTTP admin implements same interface
- [x] Embedded mode preserved - `createCrosstownNode()` continues to work
- [x] Same `CrosstownClient` public API for both modes
- [x] Works with existing docker-compose setups without modification
- [x] `@agent-runtime/connector` remains optional peer dependency

## Risk Mitigation

- **Primary Risk:** Network latency/failures in HTTP mode (vs. zero-latency embedded mode)
- **Mitigation:**
  - Implement retry logic with exponential backoff (3 retries, configurable)
  - Configurable timeouts for HTTP requests (default: 30s)
  - Clear error messages distinguishing network vs connector errors
  - Connection pooling for HTTP clients (reuse connections)
- **Rollback Plan:** HTTP mode is purely additive - no changes to existing embedded mode. Users can continue using embedded mode if HTTP mode has issues.

## Definition of Done

- [ ] All 3 stories completed with acceptance criteria met
- [ ] `pnpm build` succeeds across all packages
- [ ] `pnpm test` passes with no regressions
- [ ] HttpRuntimeClient and HttpConnectorAdmin have ≥90% unit test coverage
- [ ] E2E test passes against docker-compose infrastructure
- [ ] README updated with HTTP mode configuration example
- [ ] Type checking passes: `npx tsc --noEmit` in client package
- [ ] No regression in existing @crosstown/core, bls, relay tests

---

## Test Infrastructure

**Available Docker Compose Setups:**

1. **docker-compose-simple.yml** (Recommended for E2E testing)
   - Services: Connector + Crosstown Node
   - Ports: 8080 (runtime), 8081 (admin), 7100 (Nostr relay)
   - Quick startup, minimal dependencies

2. **docker-compose-full-stack.yml**
   - Services: TigerBeetle + Connector + Crosstown + Forgejo
   - Full production-like stack

3. **docker-compose-testnet.yml**
   - Base Sepolia testnet integration
   - Real blockchain settlement

**E2E Test Setup:**

```bash
# Start test infrastructure
docker compose -f docker-compose-simple.yml up -d

# Verify services healthy
curl http://localhost:8080/health  # Connector runtime
curl http://localhost:8081/health  # Connector admin
curl http://localhost:3100/health  # Crosstown BLS

# Run E2E tests
cd packages/client
pnpm test:e2e

# Stop infrastructure
docker compose -f docker-compose-simple.yml down
```

---
