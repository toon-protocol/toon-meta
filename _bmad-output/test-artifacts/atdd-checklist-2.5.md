---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-strategy',
    'step-04-generate-tests',
    'step-04c-aggregate',
    'step-05-validate-and-complete',
  ]
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-06'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/2-5-publish-crosstown-town-package.md'
  - '_bmad-output/test-artifacts/test-design-epic-2.md'
  - '_bmad-output/project-context.md'
  - 'packages/town/tests/e2e/town-lifecycle.test.ts'
  - 'packages/town/package.json'
  - 'packages/town/src/index.ts'
  - 'packages/town/src/handlers/event-storage-handler.ts'
  - 'packages/town/src/handlers/spsp-handshake-handler.ts'
  - 'docker/src/entrypoint-town.ts'
---

# ATDD Checklist - Epic 2, Story 2.5: Publish @crosstown/town Package

**Date:** 2026-03-06
**Author:** Jonathan
**Primary Test Level:** E2E / Integration

---

## Story Summary

Story 2.5 is the capstone story for Epic 2, wrapping the validated handler implementations (Stories 2.1-2.4) into a publishable npm package with a programmatic `startTown(config)` API and CLI entrypoint. The package enables network operators to join the Crosstown network with minimal configuration.

**As a** network operator
**I want** to `npm install @crosstown/town` and deploy a relay with minimal configuration
**So that** I can join the Crosstown network by running a single command with my seed phrase

---

## Acceptance Criteria

1. **AC #1 -- Package structure:** `package.json` depends on `@crosstown/sdk`, `@crosstown/relay`, and `@crosstown/core`, has `"type": "module"` with TypeScript strict mode, and has a `bin` entry for CLI usage.
2. **AC #2 -- Public API:** Package exports `startTown(config)` function and `TownConfig` type; config accepts mnemonic/secretKey, relayPort, blsPort, knownPeers, settlement config, and optional overrides.
3. **AC #3 -- Minimal startup:** Given a minimal config with mnemonic and connectorUrl, `startTown()` starts a relay with sensible defaults (ports 7100/3100), runs bootstrap, discovers peers, and accepts events.
4. **AC #4 -- CLI entrypoint:** `npx @crosstown/town --mnemonic "..." --connector-url "..."` starts a relay node with environment variable and CLI flag configuration.
5. **AC #5 -- Graceful shutdown:** `instance.stop()` cleanly shuts down relay WebSocket, BLS HTTP, relay monitor, bootstrap service, and `instance.isRunning()` returns `false`.
6. **AC #6 -- Publishability:** Package builds and publishes to npm with correct ESM exports and TypeScript declarations.

---

## Failing Tests Created (RED Phase)

### E2E / Integration Tests (6 tests)

**File:** `packages/town/tests/e2e/town-lifecycle.test.ts` (657 lines)

- **Test:** T-2.5-01 `should start relay with minimal mnemonic config and accept events`
  - **Status:** RED - `describe.skip` prevents execution; `startTown()` not yet implemented
  - **Verifies:** AC #2, #3 -- Minimal startup with mnemonic, relay accepts WebSocket connections and NIP-01 subscriptions, BLS health endpoint responds
  - **Priority:** P0
  - **Risk Link:** E2-R010 (Lifecycle start/stop ordering)
  - **Infrastructure Required:** Genesis node (Anvil, Connector, Relay)
  - **Adjustment APPLIED:** Added `connectorUrl: CONNECTOR_URL` to startTown() config

- **Test:** T-2.5-02 `should export startTown() and TownConfig from @crosstown/town`
  - **Status:** RED - `describe.skip` prevents execution; exports not yet wired
  - **Verifies:** AC #2 -- Public API surface exports correct symbols
  - **Priority:** P1
  - **Risk Link:** --
  - **Infrastructure Required:** None (unit-level)
  - **Adjustment APPLIED:** Added `connectorUrl` to TownConfig instantiation, added connectorUrl assertion

- **Test:** T-2.5-03 `should use default ports (7100/3100) when not specified`
  - **Status:** RED - `describe.skip` prevents execution; `startTown()` not yet implemented
  - **Verifies:** AC #3 -- Default ports applied correctly, TownInstance.config exposes resolved config
  - **Priority:** P1
  - **Risk Link:** E2-R012 (Config defaults and CLI parsing)
  - **Infrastructure Required:** Genesis node (for the live instance portion)
  - **Adjustment APPLIED:** Added `connectorUrl: CONNECTOR_URL` to both startTown() calls

- **Test:** T-2.5-04 `should run bootstrap and discover peers on start`
  - **Status:** RED - `describe.skip` prevents execution; bootstrap integration not yet wired
  - **Verifies:** AC #3 -- Bootstrap runs, peerCount >= 1, own kind:10032 published to local relay
  - **Priority:** P1
  - **Risk Link:** --
  - **Infrastructure Required:** Genesis node (Anvil, Connector, Relay)
  - **Adjustment APPLIED:** Added `connectorUrl: CONNECTOR_URL` to startTown() config

- **Test:** T-2.5-05 `should stop cleanly via lifecycle stop`
  - **Status:** RED - `describe.skip` prevents execution; `TownInstance.stop()` not yet implemented
  - **Verifies:** AC #5 -- Graceful shutdown: relay no longer accepts connections, BLS no longer responds, `isRunning()` returns false
  - **Priority:** P1
  - **Risk Link:** E2-R010 (Lifecycle start/stop ordering)
  - **Infrastructure Required:** Genesis node
  - **Adjustment APPLIED:** Changed `blsPort: 3500` to `blsPort: 3550` (avoids Faucet port conflict); added `connectorUrl: CONNECTOR_URL`; updated all health check URLs from 3500 to 3550

- **Test:** T-2.5-06 `package.json should depend on @crosstown/sdk, @crosstown/relay, @crosstown/core`
  - **Status:** RED - `describe.skip` prevents execution; `bin` entry not yet added to package.json
  - **Verifies:** AC #1 -- Package structure, dependencies, bin entry, ESM type
  - **Priority:** P2
  - **Risk Link:** --
  - **Infrastructure Required:** None (static analysis)
  - **Adjustment Needed:** None (no changes required)

---

## Data Factories Created

### No Data Factories Required

This story's tests do not require data factories. Test data consists of:
- Static infrastructure constants (ports, URLs, contract addresses)
- A deterministic test mnemonic (Anvil Account #3)
- Real Nostr keypairs derived at runtime via `fromMnemonic()`

All test data is defined as constants at the top of `town-lifecycle.test.ts`.

---

## Fixtures Created

### No Fixture Files Required

The E2E tests use a shared `beforeAll`/`afterAll` pattern for genesis infrastructure health checks and town instance lifecycle cleanup. This is defined inline in the test file (not extracted to a separate fixture) because:
1. Only one test file tests this feature
2. The setup/teardown is specific to the town lifecycle test
3. The existing pattern matches other E2E tests in the project (e.g., `genesis-bootstrap-with-channels.test.ts`)

**Inline fixtures provided:**
- `waitForWebSocket(url, timeout)` -- Polls a WebSocket endpoint until available
- `waitForHttp(url, timeout)` -- Polls an HTTP endpoint until healthy
- `_waitForEventOnRelay(relayUrl, eventId, timeout)` -- Subscribes and waits for a specific Nostr event

---

## Mock Requirements

### No Mocks Required

Per user preference and project convention, Story 2.5 E2E tests use **real infrastructure only**:
- Real genesis node (Anvil, Connector, Relay) via `deploy-genesis-node.sh`
- Real SQLite event store (file-based, not :memory:)
- Real TOON codec from `@crosstown/core`
- Real Nostr key derivation from `@crosstown/sdk`
- Real WebSocket connections to relay
- Real HTTP requests to BLS health endpoint

Tests gracefully skip if genesis infrastructure is not available (existing `beforeAll` health check pattern).

---

## Required data-testid Attributes

### Not Applicable

Story 2.5 is a backend/Node.js package with no UI components. No data-testid attributes are needed.

---

## Implementation Checklist

### Test: T-2.5-01 `should start relay with minimal mnemonic config and accept events`

**File:** `packages/town/tests/e2e/town-lifecycle.test.ts`

**Tasks to make this test pass:**

- [ ] Create `packages/town/src/town.ts` with `TownConfig`, `ResolvedTownConfig`, `TownInstance` types
- [ ] Implement `startTown(config)` function that composes the full relay lifecycle:
  - Identity derivation (fromMnemonic/fromSecretKey)
  - SqliteEventStore creation with dataDir
  - SDK 5-stage pipeline (size -> parse -> verify -> price -> dispatch)
  - Handler registration (event storage default, SPSP for kind:23194)
  - BLS HTTP server on blsPort with /health and /handle-packet
  - WebSocket relay on relayPort
  - Bootstrap with knownPeers
  - RelayMonitor start
  - Self-write kind:10032 event
- [ ] Wire settlement config mapping (chainRpcUrls, tokenNetworks, preferredTokens -> SettlementNegotiationConfig)
- [ ] Return TownInstance with isRunning(), stop(), pubkey, evmAddress, config, bootstrapResult
- [x] **Test adjustment:** Add `connectorUrl: CONNECTOR_URL` to the startTown() call (DONE)
- [ ] Run test: `cd packages/town && pnpm vitest run tests/e2e/town-lifecycle.test.ts -t "should start relay with minimal mnemonic config"`
- [ ] Test passes (green phase)

**Estimated Effort:** 4-6 hours (primary implementation task)

---

### Test: T-2.5-02 `should export startTown() and TownConfig from @crosstown/town`

**File:** `packages/town/tests/e2e/town-lifecycle.test.ts`

**Tasks to make this test pass:**

- [ ] Add exports to `packages/town/src/index.ts`:
  ```typescript
  export { startTown } from './town.js';
  export type { TownConfig, TownInstance, ResolvedTownConfig } from './town.js';
  ```
- [ ] Verify existing exports (createEventStorageHandler, createSpspHandshakeHandler) preserved
- [x] **Test adjustment:** Add `connectorUrl` to the TownConfig object instantiation in the test (DONE)
- [ ] Run test: `cd packages/town && pnpm vitest run tests/e2e/town-lifecycle.test.ts -t "should export startTown"`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: T-2.5-03 `should use default ports (7100/3100) when not specified`

**File:** `packages/town/tests/e2e/town-lifecycle.test.ts`

**Tasks to make this test pass:**

- [ ] Implement default resolution in startTown(): relayPort defaults to 7100, blsPort defaults to 3100
- [ ] Expose resolved config on TownInstance.config as ResolvedTownConfig
- [x] **Test adjustment:** Add `connectorUrl: CONNECTOR_URL` to the startTown() call (DONE)
- [ ] Run test: `cd packages/town && pnpm vitest run tests/e2e/town-lifecycle.test.ts -t "should use default ports"`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours (part of T-2.5-01 implementation)

---

### Test: T-2.5-04 `should run bootstrap and discover peers on start`

**File:** `packages/town/tests/e2e/town-lifecycle.test.ts`

**Tasks to make this test pass:**

- [ ] Wire BootstrapService in startTown() with knownPeers config
- [ ] Wire RelayMonitor for post-bootstrap peer discovery
- [ ] Publish own kind:10032 ILP Peer Info event to local relay (self-write)
- [ ] Expose bootstrapResult: { peerCount, channelCount } on TownInstance
- [ ] Expose pubkey (64-char hex) on TownInstance
- [x] **Test adjustment:** Add `connectorUrl: CONNECTOR_URL` to the startTown() call (DONE)
- [ ] Run test: `cd packages/town && pnpm vitest run tests/e2e/town-lifecycle.test.ts -t "should run bootstrap"`
- [ ] Test passes (green phase)

**Estimated Effort:** 2 hours (part of T-2.5-01 implementation)

---

### Test: T-2.5-05 `should stop cleanly via lifecycle stop`

**File:** `packages/town/tests/e2e/town-lifecycle.test.ts`

**Tasks to make this test pass:**

- [ ] Implement TownInstance.stop() that gracefully shuts down in reverse order:
  - Unsubscribe relay monitor
  - Unsubscribe social discovery
  - Stop WebSocket relay (wsRelay.stop())
  - Close BLS HTTP server (blsServer.close())
  - Close EventStore
- [ ] Set isRunning flag to false after stop
- [x] **Test adjustment:** Change `blsPort: 3500` to `blsPort: 3550` (avoids Faucet port conflict) (DONE)
- [x] **Test adjustment:** Update health check URLs from `http://localhost:3500/health` to `http://localhost:3550/health` (DONE)
- [x] **Test adjustment:** Add `connectorUrl: CONNECTOR_URL` to the startTown() call (DONE)
- [ ] Run test: `cd packages/town && pnpm vitest run tests/e2e/town-lifecycle.test.ts -t "should stop cleanly"`
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour (part of T-2.5-01 implementation)

---

### Test: T-2.5-06 `package.json should depend on @crosstown/sdk, @crosstown/relay, @crosstown/core`

**File:** `packages/town/tests/e2e/town-lifecycle.test.ts`

**Tasks to make this test pass:**

- [ ] Add `bin` field to `packages/town/package.json`: `{ "crosstown-town": "./dist/cli.js" }`
- [ ] Move `better-sqlite3` from devDependencies to dependencies
- [ ] Move `nostr-tools` from devDependencies to dependencies
- [ ] Add `hono` and `@hono/node-server` as runtime dependencies
- [ ] Verify `@crosstown/sdk`, `@crosstown/relay`, `@crosstown/core` in dependencies (already present)
- [ ] Run test: `cd packages/town && pnpm vitest run tests/e2e/town-lifecycle.test.ts -t "package.json should depend"`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Additional Tasks (Not Directly Tested but Required)

#### Task: Create CLI entrypoint (AC #4)

- [ ] Create `packages/town/src/cli.ts` with:
  - `#!/usr/bin/env node` shebang
  - `node:util` `parseArgs()` for CLI flag parsing
  - Support: `--mnemonic`, `--secret-key`, `--relay-port`, `--bls-port`, `--data-dir`, `--connector-url`, `--known-peers`, `--dev-mode`, `--help`
  - Environment variable fallbacks: `CROSSTOWN_MNEMONIC`, `CROSSTOWN_SECRET_KEY`, etc.
  - CLI flags override environment variables
  - Call `startTown(config)` with parsed config
  - Wire SIGINT/SIGTERM to `instance.stop()`
  - Print startup banner with pubkey, ports, ILP address
- [ ] Update tsup config to include `cli.ts` as entry point
- [ ] Verify CLI runs: `node packages/town/dist/cli.js --help`

**Estimated Effort:** 1.5 hours

#### Task: Update tsup config

- [ ] Add `cli.ts` to tsup entry points: `entry: ['src/index.ts', 'src/cli.ts']`
- [ ] Verify build produces both `dist/index.js` and `dist/cli.js`

**Estimated Effort:** 0.25 hours

#### Task: Build, lint, format verification (AC all)

- [ ] `pnpm build` -- all packages build
- [ ] `pnpm test` -- all unit/integration tests pass
- [ ] `pnpm lint` -- 0 errors
- [ ] `pnpm format:check` -- all files pass
- [ ] `cd packages/town && pnpm pack --dry-run` -- verify clean package

**Estimated Effort:** 0.5 hours

---

## Running Tests

```bash
# Run all failing tests for this story
cd packages/town && pnpm vitest run tests/e2e/town-lifecycle.test.ts

# Run specific test
cd packages/town && pnpm vitest run tests/e2e/town-lifecycle.test.ts -t "should start relay"

# Run with verbose output
cd packages/town && pnpm vitest run tests/e2e/town-lifecycle.test.ts --reporter=verbose

# Debug specific test
cd packages/town && pnpm vitest run tests/e2e/town-lifecycle.test.ts -t "should start relay" --inspect-brk

# Run tests with coverage
cd packages/town && pnpm vitest run tests/e2e/town-lifecycle.test.ts --coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 6 tests written and failing (describe.skip)
- No data factories required (infrastructure-level tests)
- No fixture files required (inline setup/teardown pattern)
- No mocks required (real infrastructure only)
- No data-testid attributes required (backend package)
- Implementation checklist created with test adjustments documented
- Test adjustments **APPLIED** to `town-lifecycle.test.ts`:
  - Added `connectorUrl: CONNECTOR_URL` to all 5 startTown() calls (T-2.5-01 through T-2.5-05)
  - Changed `blsPort: 3500` to `blsPort: 3550` in T-2.5-05 (avoids Faucet port conflict)
  - Updated all health check URLs from port 3500 to 3550 in T-2.5-05
  - Added `connectorUrl` field and assertion to TownConfig instantiation in T-2.5-02
  - Updated RED phase comments to reflect current package state (packages/town exists from Stories 2.1-2.4)

**Verification:**

- All tests are in `describe.skip` -- they will not execute until un-skipped
- When un-skipped, they will fail due to missing `startTown()` implementation
- `pnpm build` passes (all packages build successfully after test adjustments)
- `pnpm test` passes (68 test files, 1394 tests, 0 failures, test adjustments cause no regressions)
- `pnpm lint` passes (0 errors)
- `pnpm format:check` passes

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Start with T-2.5-06** (package.json structure) -- smallest, validates package basics
2. **Then T-2.5-02** (exports) -- wires the public API surface
3. **Then T-2.5-01** (core lifecycle) -- main implementation task
4. **Then T-2.5-03** (defaults) -- validates config resolution
5. **Then T-2.5-04** (bootstrap) -- validates integration with BootstrapService
6. **Then T-2.5-05** (shutdown) -- validates graceful cleanup
7. **Create CLI** (AC #4) -- thin wrapper around startTown()
8. **Build/lint/format** -- final verification

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap
- Mirror docker/src/entrypoint-town.ts patterns but wrapped in reusable startTown()

**Progress Tracking:**

- Check off tasks as you complete them
- Share progress in daily standup

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability)
3. **Ensure startTown() and entrypoint-town.ts share patterns** (same SDK components)
4. **Verify no duplicate logic** between town.ts and entrypoint-town.ts
5. **Ensure tests still pass** after each refactor
6. **Update documentation** (if API contracts change)

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **test-quality.md** - Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **test-levels-framework.md** - Test level selection framework (E2E for lifecycle, Unit for config/exports)
- **test-priorities-matrix.md** - P0-P3 prioritization based on risk assessment from test-design-epic-2.md
- **data-factories.md** - Evaluated and determined not needed (no domain entity generation required)
- **component-tdd.md** - Not applicable (backend package, no UI components)

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `cd packages/town && pnpm vitest run tests/e2e/town-lifecycle.test.ts`

**Results:**

```
Test Files  68 passed | 19 skipped (87)
     Tests  1394 passed | 185 skipped (1579)
  Start at  20:49:49
  Duration  5.26s

town-lifecycle.test.ts is in the E2E exclude list (vitest.config.ts) and
uses describe.skip -- all 6 tests are skipped during normal test runs.
Build, lint, and format all pass after test adjustments.
```

**Summary:**

- Total tests in file: 6
- Passing: 0 (expected -- all skipped via describe.skip)
- Failing: 0 (skipped, not failing)
- Skipped: 6
- Status: RED phase verified (describe.skip pattern)
- Build/lint/format: All passing after test adjustments

**Expected Failure Messages (when un-skipped):**

- T-2.5-01: `TypeError: startTown is not a function` (or import resolution error -- startTown not exported from @crosstown/town)
- T-2.5-02: `TypeError: startTown is not a function` (typeof check fails)
- T-2.5-03: `TypeError: startTown is not a function`
- T-2.5-04: `TypeError: startTown is not a function`
- T-2.5-05: `TypeError: startTown is not a function`
- T-2.5-06: `AssertionError: expected undefined to be defined` (bin field missing from package.json)

---

## Notes

- **connectorUrl is required for initial implementation** -- Embedded connector mode is deferred. All test configs now include `connectorUrl: CONNECTOR_URL` (adjustment applied).
- **BLS port 3500 conflict FIXED** -- T-2.5-05 now uses `blsPort: 3550` to avoid conflict with the Faucet service at port 3500.
- **Tests require genesis infrastructure** -- Tests T-2.5-01, T-2.5-03, T-2.5-04, T-2.5-05 require genesis node. They gracefully skip if not available.
- **Reference implementation is docker/src/entrypoint-town.ts** -- startTown() mirrors this pattern but wraps it in a reusable function.
- **Do not modify entrypoint-town.ts** -- It is the reference implementation from Story 2.4.
- **Do not modify existing handler implementations** -- event-storage-handler.ts and spsp-handshake-handler.ts are done (Stories 2.1/2.2).
- **better-sqlite3 must be a runtime dependency** -- startTown() creates SqliteEventStore at runtime.
- **AC #4 (CLI) has no dedicated test** -- The CLI is a thin wrapper around startTown(); verified manually via `node packages/town/dist/cli.js --help`. Consider adding a CLI test in a future iteration.

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Refer to `_bmad-output/implementation-artifacts/2-5-publish-crosstown-town-package.md` for story details
- Refer to `docker/src/entrypoint-town.ts` for reference implementation patterns
- Refer to `_bmad-output/test-artifacts/test-design-epic-2.md` for risk assessment

---

**Generated by BMad TEA Agent** - 2026-03-06
