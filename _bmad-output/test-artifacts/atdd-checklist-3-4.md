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
lastSaved: '2026-03-13'
workflowType: 'testarch-atdd'
inputDocuments:
  [
    '_bmad-output/implementation-artifacts/3-4-seed-relay-discovery.md',
    '_bmad-output/test-artifacts/test-design-epic-3.md',
    'packages/core/src/discovery/seed-relay-discovery.test.ts',
    'packages/core/src/events/builders.ts',
    'packages/core/src/events/parsers.ts',
    'packages/core/src/constants.ts',
    'packages/core/src/errors.ts',
    'packages/core/src/types.ts',
    'packages/core/vitest.config.ts',
  ]
---

# ATDD Checklist - Epic 3, Story 3.4: Seed Relay Discovery

**Date:** 2026-03-13
**Author:** Jonathan
**Primary Test Level:** Integration + Unit
**Story ID:** 3.4
**FR Coverage:** FR-PROD-4

---

## Story Summary

Seed relay discovery replaces the genesis hub-and-spoke topology with a decentralized seed list model for peer discovery. New relay operators can bootstrap their node by connecting to any relay in a seed list rather than depending on a specific genesis node, eliminating a single point of failure.

**As a** new relay operator
**I want** to bootstrap my node by connecting to any relay in a seed list
**So that** the network has no single point of failure for peer discovery

---

## Acceptance Criteria

1. **AC1**: Given a kind:10036 (Seed Relay List) event published to a public Nostr relay, when a new Crosstown node starts with `discovery: 'seed-list'` config, then the node reads kind:10036 events, connects to seed relays, and subscribes to kind:10032 events to discover the full network.

2. **AC2**: Given the seed list contains multiple relay URLs, when the first seed relay is unreachable, then the node tries the next relay in the list, and continues until a connection is established or the list is exhausted (with a clear error message on exhaustion).

3. **AC3**: Given a node that is already part of the network, when configured to publish its seed list, then it publishes a kind:10036 event to configured public Nostr relays containing the node's WebSocket URL and basic metadata.

4. **AC4**: Given backward compatibility requirements, when `discovery: 'genesis'` is configured (or default for dev mode), then the existing genesis-based bootstrap flow is used unchanged, and the seed list discovery is opt-in for production.

---

## Failing Tests Created (RED Phase)

### Integration Tests (5 tests)

**File:** `packages/core/src/discovery/seed-relay-discovery.test.ts`

- **Test:** `[P1] reads kind:10036 -> connects to seed -> subscribes kind:10032` (T-3.4-01)
  - **Status:** RED - Module `./seed-relay-discovery.js` does not exist
  - **Verifies:** AC1 - Full seed relay discovery happy path (3.4-INT-001)
  - **Risk:** E3-R006

- **Test:** `[P1] first seed unreachable -> tries next in list` (T-3.4-02)
  - **Status:** RED - Module `./seed-relay-discovery.js` does not exist
  - **Verifies:** AC2 - Fallback mechanism when first seed relay fails (3.4-INT-002)
  - **Risk:** E3-R006

- **Test:** `[P1] all seeds exhausted -> clear error message` (T-3.4-03)
  - **Status:** RED - Module `./seed-relay-discovery.js` does not exist
  - **Verifies:** AC2 - PeerDiscoveryError when all seed relays unreachable (3.4-INT-002)
  - **Risk:** E3-R006

- **Test:** `[P1] discovery: "genesis" uses existing bootstrap flow unchanged` (T-3.4-04)
  - **Status:** RED - Module `./seed-relay-discovery.js` does not exist
  - **Verifies:** AC4 - Genesis mode backward compatibility (3.4-INT-003)

- **Test:** `[P1] node publishes its own seed relay entry as kind:10036` (T-3.4-05)
  - **Status:** RED - Module `./seed-relay-discovery.js` does not exist
  - **Verifies:** AC3 - Publishing seed relay entry to public relays (3.4-INT-004)

### Unit Tests (6 tests)

**File:** `packages/core/src/discovery/seed-relay-discovery.test.ts`

- **Test:** `[P2] SEED_RELAY_LIST_KIND equals 10036` (T-3.4-11)
  - **Status:** RED - `SEED_RELAY_LIST_KIND` not yet exported from constants
  - **Verifies:** Constant definition correctness

- **Test:** `[P2] buildSeedRelayListEvent() returns NIP-16 replaceable event with correct kind and d-tag` (T-3.4-07)
  - **Status:** RED - Module `../events/seed-relay.js` does not exist
  - **Verifies:** AC3 - Event builder produces correct NIP-16 structure

- **Test:** `[P2] parseSeedRelayList() validates URLs (rejects non-ws:// URLs)` (T-3.4-08)
  - **Status:** RED - Module `../events/seed-relay.js` does not exist
  - **Verifies:** AC1 - URL validation (CWE-20)

- **Test:** `[P2] parseSeedRelayList() validates pubkeys (rejects invalid hex)` (T-3.4-09)
  - **Status:** RED - Module `../events/seed-relay.js` does not exist
  - **Verifies:** AC1 - Pubkey validation

- **Test:** `[P2] parseSeedRelayList() ignores malformed entries (graceful degradation)` (T-3.4-10)
  - **Status:** RED - Module `../events/seed-relay.js` does not exist
  - **Verifies:** AC1 - Graceful handling of malformed data

- **Test:** `[P2] seed relay discovery uses raw ws, not SimplePool` (T-3.4-06)
  - **Status:** RED - Source file `seed-relay-discovery.ts` does not exist
  - **Verifies:** AC1 - Static analysis constraint (SimplePool crashes in Node.js containers)

### Deferred E2E Test (1 test, skipped)

**File:** `packages/core/src/discovery/seed-relay-discovery.test.ts`

- **Test:** `[P3] seed relay discovery E2E with live genesis node` (T-3.4-12)
  - **Status:** SKIPPED - Requires genesis infrastructure
  - **Verifies:** AC1, AC2 - Full end-to-end flow with live nodes (3.4-E2E-001)
  - **Risk:** E3-R006

---

## Data Factories Created

### SeedRelayEntry Factory

**File:** `packages/core/src/discovery/seed-relay-discovery.test.ts` (inline)

**Exports:**

- `createSeedRelayEntry(overrides?)` - Create single seed relay entry with optional overrides
- `createSeedRelayList(count)` - Create array of seed relay entries
- `createSeedRelayEvent(entries?, overrides?)` - Create mock kind:10036 Nostr event
- `createIlpPeerInfoEvent(pubkey, overrides?)` - Create mock kind:10032 Nostr event
- `createDiscoveryConfig(overrides?)` - Create SeedRelayDiscoveryConfig

**Example Usage:**

```typescript
const entries = createSeedRelayList(3);
const event = createSeedRelayEvent(entries);
const config = createDiscoveryConfig({ connectionTimeout: 5000 });
```

---

## Fixtures Created

Test fixtures are inline in the test file using vitest patterns (co-located with source as per project convention). No separate fixture files needed for this backend-only story.

---

## Mock Requirements

### WebSocket (ws) Mock

**Module:** `ws`

The `SeedRelayDiscovery` class uses raw `ws` WebSocket connections. Tests will need to mock the `ws` module to simulate:

**Success Response:**
```json
["EVENT", "sub-id", { "kind": 10036, "content": "[...]", "tags": [["d", "crosstown-seed-list"]] }]
["EOSE", "sub-id"]
```

**Failure Response:**
```
WebSocket connection to 'wss://unreachable' failed: Connection refused
```

**Notes:**
- Must NOT use `SimplePool` from `nostr-tools/pool` (crashes in Node.js containers)
- Use raw Nostr protocol messages: `["REQ", subId, filter]`, `["EVENT", ...]`, `["EOSE", ...]`
- The dev agent should use `vi.mock('ws', ...)` to mock WebSocket connections in unit/integration tests

### nostr-tools/pure Mock

**Module:** `nostr-tools/pure`

Used for `generateSecretKey()`, `getPublicKey()`, and `finalizeEvent()` in `buildSeedRelayListEvent()`.

**Notes:**
- Real `nostr-tools/pure` functions are used in unit tests (no mock needed for event building tests)
- Only mock WebSocket layer, not cryptographic functions

---

## Required data-testid Attributes

Not applicable -- this is a backend-only story with no UI components.

---

## Implementation Checklist

### Test: T-3.4-11 - SEED_RELAY_LIST_KIND equals 10036

**File:** `packages/core/src/discovery/seed-relay-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] Add `export const SEED_RELAY_LIST_KIND = 10036;` to `packages/core/src/constants.ts`
- [ ] Export `SEED_RELAY_LIST_KIND` from `packages/core/src/index.ts`
- [ ] Run test: `npx vitest run packages/core/src/discovery/seed-relay-discovery.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours

---

### Test: T-3.4-07 - buildSeedRelayListEvent() returns NIP-16 replaceable event

**File:** `packages/core/src/discovery/seed-relay-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] Create `packages/core/src/events/seed-relay.ts` with `buildSeedRelayListEvent()` function
- [ ] Function must use `finalizeEvent()` from `nostr-tools/pure`
- [ ] Event must have `kind: 10036`
- [ ] Event must have `tags: [['d', 'crosstown-seed-list']]`
- [ ] Event content must be JSON-serialized `SeedRelayEntry[]`
- [ ] Export from `packages/core/src/events/index.ts`
- [ ] Run test: `npx vitest run packages/core/src/discovery/seed-relay-discovery.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: T-3.4-08, T-3.4-09, T-3.4-10 - parseSeedRelayList() validation

**File:** `packages/core/src/discovery/seed-relay-discovery.test.ts`

**Tasks to make these tests pass:**

- [ ] Add `parseSeedRelayList()` function to `packages/core/src/events/seed-relay.ts`
- [ ] Validate URLs: reject entries without `ws://` or `wss://` prefix
- [ ] Validate pubkeys: reject entries without valid 64-char lowercase hex
- [ ] Graceful degradation: ignore malformed entries, return only valid ones
- [ ] Handle invalid JSON content: return empty array
- [ ] Handle non-array JSON content: return empty array
- [ ] Preserve metadata when present
- [ ] Export from `packages/core/src/events/index.ts`
- [ ] Run test: `npx vitest run packages/core/src/discovery/seed-relay-discovery.test.ts`
- [ ] Tests pass (green phase)

**Estimated Effort:** 1.5 hours

---

### Test: T-3.4-01 - Seed relay discovery happy path

**File:** `packages/core/src/discovery/seed-relay-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] Create `packages/core/src/discovery/seed-relay-discovery.ts` with `SeedRelayDiscovery` class
- [ ] Implement `SeedRelayDiscoveryConfig` interface
- [ ] Implement `SeedRelayDiscoveryResult` interface
- [ ] Implement `discover()` method:
  - Connect to public relays via raw `ws` WebSocket
  - Subscribe to `{ kinds: [10036] }` filter
  - Parse seed relay entries from kind:10036 events
  - Connect to seed relays sequentially
  - Subscribe to `{ kinds: [10032] }` on connected seed relay
  - Parse IlpPeerInfo from kind:10032 events
  - Set `info.pubkey = event.pubkey` (parser does not populate pubkey)
- [ ] Implement `close()` method
- [ ] Export from `packages/core/src/discovery/index.ts` and `packages/core/src/index.ts`
- [ ] Run test: `npx vitest run packages/core/src/discovery/seed-relay-discovery.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 4 hours

---

### Test: T-3.4-02 - First seed unreachable, tries next

**File:** `packages/core/src/discovery/seed-relay-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] In `discover()`, implement sequential fallback: try seed relays one at a time
- [ ] On WebSocket connection failure, log warning and try next seed relay
- [ ] Track `attemptedSeeds` count in result
- [ ] Run test: `npx vitest run packages/core/src/discovery/seed-relay-discovery.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: T-3.4-03 - All seeds exhausted, clear error

**File:** `packages/core/src/discovery/seed-relay-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] When all seed relays fail, throw `PeerDiscoveryError`
- [ ] Error message must match: `All seed relays exhausted -- unable to bootstrap. Tried N seed relays from M kind:10036 events.`
- [ ] Import `PeerDiscoveryError` from `packages/core/src/errors.ts`
- [ ] Run test: `npx vitest run packages/core/src/discovery/seed-relay-discovery.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: T-3.4-04 - Genesis mode backward compatibility

**File:** `packages/core/src/discovery/seed-relay-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] `SeedRelayDiscovery` class is constructible with config
- [ ] Class has `discover()` and `close()` methods
- [ ] TownConfig integration: add `discovery?: 'seed-list' | 'genesis'` field
- [ ] Default `discovery` to `'genesis'` in startTown() resolved config
- [ ] When `discovery: 'genesis'`, skip SeedRelayDiscovery entirely (use existing BootstrapService flow)
- [ ] Run test: `npx vitest run packages/core/src/discovery/seed-relay-discovery.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: T-3.4-05 - Publish seed relay entry

**File:** `packages/core/src/discovery/seed-relay-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] Create `publishSeedRelayEntry()` function in `packages/core/src/discovery/seed-relay-discovery.ts`
- [ ] Build kind:10036 event using `buildSeedRelayListEvent()`
- [ ] Derive pubkey from secretKey via `getPublicKey()`
- [ ] Connect to each public relay via raw `ws` WebSocket
- [ ] Publish event to each relay
- [ ] Return `{ publishedTo: number, eventId: string }`
- [ ] Export from `packages/core/src/discovery/index.ts` and `packages/core/src/index.ts`
- [ ] Run test: `npx vitest run packages/core/src/discovery/seed-relay-discovery.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 1.5 hours

---

### Test: T-3.4-06 - Static analysis: no SimplePool

**File:** `packages/core/src/discovery/seed-relay-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] Ensure `seed-relay-discovery.ts` uses `import WebSocket from 'ws'` (not `SimplePool`)
- [ ] No import of `nostr-tools/pool` in the source file
- [ ] Implement raw Nostr protocol messages (`["REQ", ...]`, `["EVENT", ...]`, `["EOSE", ...]`)
- [ ] Run test: `npx vitest run packages/core/src/discovery/seed-relay-discovery.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0 hours (covered by T-3.4-01 implementation)

---

## Running Tests

```bash
# Run all failing tests for this story
npx vitest run packages/core/src/discovery/seed-relay-discovery.test.ts

# Run specific test by name
npx vitest run packages/core/src/discovery/seed-relay-discovery.test.ts -t "reads kind:10036"

# Run with verbose output
npx vitest run packages/core/src/discovery/seed-relay-discovery.test.ts --reporter=verbose

# Run all core package tests (includes this story)
cd packages/core && pnpm test

# Run full monorepo test suite
pnpm test
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 12 tests written (11 active, 1 skipped E2E stub)
- Test factories created inline (createSeedRelayEntry, createSeedRelayList, etc.)
- Mock requirements documented (ws, nostr-tools/pure)
- Implementation checklist created with granular tasks
- RED phase verified: all tests fail with `Failed to load url ./seed-relay-discovery.js`

**Verification:**

```
Test Files  1 failed (1)
     Tests  no tests
Error: Failed to load url ./seed-relay-discovery.js
```

- All tests fail due to missing implementation modules (not test bugs)
- Failure is at import time (module not found), which is expected

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Start with T-3.4-11** (constant definition) -- simplest, unblocks imports
2. **Then T-3.4-07, T-3.4-08, T-3.4-09, T-3.4-10** (event builder/parser) -- pure functions
3. **Then T-3.4-01** (discovery class) -- core implementation
4. **Then T-3.4-02, T-3.4-03** (fallback/error handling) -- edge cases
5. **Then T-3.4-04** (genesis backward compat) -- integration
6. **Then T-3.4-05** (publish function) -- secondary feature
7. **Then T-3.4-06** (static analysis) -- verification
8. **Run tests** to verify each passes (green)

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Use raw `ws` WebSocket, never `SimplePool`
- Always use `.js` extensions in ESM imports
- Use `import type { X }` for type-only imports
- Use `PeerDiscoveryError` for all discovery failures

**Progress Tracking:**

- Check off tasks in Implementation Checklist above

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all 11 active tests pass (green phase complete)
2. Review code quality (readability, maintainability)
3. Extract shared WebSocket utilities if duplicated
4. Ensure proper cleanup in `close()` method
5. Run full test suite: `pnpm build && pnpm test`
6. Verify no regressions in existing tests

---

## Next Steps

1. **Share this checklist** with the dev workflow (manual handoff)
2. **Run failing tests** to confirm RED phase: `npx vitest run packages/core/src/discovery/seed-relay-discovery.test.ts`
3. **Begin implementation** using implementation checklist as guide
4. **Work one test at a time** (red -> green for each)
5. **When all tests pass**, refactor code for quality
6. **When refactoring complete**, update `sprint-status.yaml` story 3-4 to `done`

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **data-factories.md** - Factory patterns with overrides for test data generation (adapted for inline factories)
- **test-quality.md** - Deterministic test design, isolation, explicit assertions
- **test-levels-framework.md** - Test level selection (unit for pure functions, integration for component interaction)
- **test-priorities-matrix.md** - P0-P3 priority assignment based on risk and business impact

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/core/src/discovery/seed-relay-discovery.test.ts`

**Results:**

```
FAIL  packages/core/src/discovery/seed-relay-discovery.test.ts
Error: Failed to load url ./seed-relay-discovery.js (resolved id: ./seed-relay-discovery.js)
in seed-relay-discovery.test.ts. Does the file exist?

Test Files  1 failed (1)
     Tests  no tests
Duration  266ms
```

**Summary:**

- Total tests: 12 (11 active + 1 skipped E2E stub)
- Passing: 0 (expected)
- Failing: 1 suite (module not found at import time)
- Status: RED phase verified

**Expected Failure Messages:**
- Primary: `Failed to load url ./seed-relay-discovery.js` -- implementation module does not exist
- Secondary (after creating discovery module): `Failed to load url ../events/seed-relay.js` -- event module does not exist
- Tertiary (after both modules exist): Individual assertion failures until implementation is complete

---

## Test Design Traceability

| ATDD Test ID | Test Name | AC | Test-Design ID | Risk Link | Priority | Level |
|---|---|---|---|---|---|---|
| T-3.4-01 | `reads kind:10036 -> connects to seed -> subscribes kind:10032` | #1 | 3.4-INT-001 | E3-R006 | P1 | I |
| T-3.4-02 | `first seed unreachable -> tries next in list` | #2 | 3.4-INT-002 | E3-R006 | P1 | I |
| T-3.4-03 | `all seeds exhausted -> clear error message` | #2 | 3.4-INT-002 | E3-R006 | P1 | I |
| T-3.4-04 | `discovery: "genesis" uses existing bootstrap flow unchanged` | #4 | 3.4-INT-003 | -- | P1 | I |
| T-3.4-05 | `node publishes its own seed relay entry as kind:10036` | #3 | 3.4-INT-004 | -- | P1 | I |
| T-3.4-06 | `seed relay discovery uses raw ws, not SimplePool` | #1 | -- | -- | P2 | U (static) |
| T-3.4-07 | `buildSeedRelayListEvent() returns NIP-16 replaceable event` | #3 | -- | -- | P2 | U |
| T-3.4-08 | `parseSeedRelayList() validates URLs` | #1 | -- | -- | P2 | U |
| T-3.4-09 | `parseSeedRelayList() validates pubkeys` | #1 | -- | -- | P2 | U |
| T-3.4-10 | `parseSeedRelayList() ignores malformed entries` | #1 | -- | -- | P2 | U |
| T-3.4-11 | `SEED_RELAY_LIST_KIND equals 10036` | -- | -- | -- | P2 | U (static) |
| T-3.4-12 | `seed relay discovery E2E with live genesis node` | #1, #2 | 3.4-E2E-001 | E3-R006 | P3 | E2E |

---

## Regression Verification

Existing test suite verified to be unaffected:

```
Test Files  5 passed (5)
     Tests  88 passed (88)
```

Tested files: `builders.test.ts`, `parsers.test.ts`, `NostrPeerDiscovery.test.ts`, `constants.test.ts`, `errors.test.ts`

---

## Notes

- The test file uses inline factories rather than separate fixture files, following the co-located test pattern used throughout the `@crosstown/core` package.
- T-3.4-06 (static analysis) reads the source file directly using `readFileSync` to verify no `SimplePool` imports -- this is a guard against the known Node.js container crash issue documented in project memory.
- The E2E test (T-3.4-12) is deliberately skipped with `it.skip()` because it requires running genesis infrastructure. It will be enabled when E2E test infrastructure is available.
- All integration tests (T-3.4-01 through T-3.4-05) will need `ws` module mocking during the GREEN phase to avoid actual network connections in unit tests.

---

**Generated by BMad TEA Agent** - 2026-03-13
