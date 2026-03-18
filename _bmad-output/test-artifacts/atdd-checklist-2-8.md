---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-07'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/2-8-relay-subscription-api-on-town-instance.md'
  - 'packages/relay/src/subscriber/RelaySubscriber.ts'
  - 'packages/relay/src/subscriber/RelaySubscriber.test.ts'
  - 'packages/relay/src/storage/InMemoryEventStore.ts'
  - 'packages/town/src/town.ts'
  - 'packages/town/src/town.test.ts'
  - 'packages/town/src/index.ts'
  - 'packages/town/vitest.config.ts'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
  - '_bmad/tea/testarch/knowledge/test-levels-framework.md'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
---

# ATDD Checklist - Epic 2, Story 8: Relay Subscription API on TownInstance

**Date:** 2026-03-07
**Author:** Jonathan
**Primary Test Level:** Unit

---

## Story Summary

Story 2.8 adds a `subscribe()` method to `TownInstance` that allows programmatic subscription to remote Nostr relays. Received events are automatically stored in the Town's EventStore. This provides a general-purpose mechanism for future peer/seed discovery via subscriptions.

**As a** service developer
**I want** the Town node to expose methods for subscribing to other Nostr relays
**So that** I can discover peers, seed relays, and custom event kinds through a programmable API

---

## Acceptance Criteria

1. `town.subscribe(relayUrl, filter)` opens a WebSocket connection, subscribes with filter, stores received events, returns `TownSubscription` handle
2. `subscription.close()` cleanly closes the subscription, `isActive()` returns `false`, no further events received
3. On WebSocket disconnect, rely on SimplePool reconnection; track `lastSeenTimestamp` per subscription
4. `town.stop()` closes all active subscriptions before stopping relay and BLS
5. `town.subscribe(relayUrl, { kinds: [10032] })` stores kind:10032 events in EventStore
6. `town.subscribe(relayUrl, { kinds: [10036] })` stores kind:10036 events in EventStore
7. `town.subscribe()` throws `Error("Cannot subscribe: town is not running")` when town is stopped
8. `subscription.close()` is idempotent (double-close is no-op)

---

## Failing Tests Created (RED Phase)

### Unit Tests (13 tests)

**File:** `packages/town/src/subscribe.test.ts` (230 lines)

- **Test:** [P0] subscribe() creates a RelaySubscriber and returns a TownSubscription handle
  - **Status:** RED - it.skip() -- subscribe() does not exist on TownInstance
  - **Verifies:** AC #1 -- RelaySubscriber construction, start(), and TownSubscription return

- **Test:** [P0] subscription.isActive() returns true for active subscription
  - **Status:** RED - it.skip() -- subscribe() does not exist on TownInstance
  - **Verifies:** AC #1 -- active state tracking

- **Test:** [P1] subscription.relayUrl returns the URL passed to subscribe()
  - **Status:** RED - it.skip() -- subscribe() does not exist on TownInstance
  - **Verifies:** AC #1 -- relayUrl property

- **Test:** [P1] multiple subscriptions can be active simultaneously
  - **Status:** RED - it.skip() -- subscribe() does not exist on TownInstance
  - **Verifies:** AC #1 -- Set-based subscription tracking

- **Test:** [P0] received events are stored in EventStore via RelaySubscriber onevent
  - **Status:** RED - it.skip() -- subscribe() does not exist on TownInstance
  - **Verifies:** AC #1 -- EventStore wiring to RelaySubscriber

- **Test:** [P0] subscription.close() calls unsubscribe and isActive() returns false
  - **Status:** RED - it.skip() -- subscribe() does not exist on TownInstance
  - **Verifies:** AC #2 -- close lifecycle

- **Test:** [P2] lastSeenTimestamp is initialized (preparation for reconnection)
  - **Status:** RED - it.skip() -- subscribe() does not exist on TownInstance
  - **Verifies:** AC #3 -- timestamp tracking infrastructure

- **Test:** [P0] town.stop() closes all active subscriptions before stopping relay and BLS
  - **Status:** RED - it.skip() -- subscribe() does not exist on TownInstance
  - **Verifies:** AC #4 -- stop() iterates activeSubscriptions Set

- **Test:** [P1] subscribe with kind:10032 filter creates RelaySubscriber with correct filter
  - **Status:** RED - it.skip() -- subscribe() does not exist on TownInstance
  - **Verifies:** AC #5 -- peer discovery subscription

- **Test:** [P1] subscribe with kind:10036 filter creates RelaySubscriber with correct filter
  - **Status:** RED - it.skip() -- subscribe() does not exist on TownInstance
  - **Verifies:** AC #6 -- seed relay subscription

- **Test:** [P0] subscribe() throws Error when town is not running
  - **Status:** RED - it.skip() -- subscribe() does not exist on TownInstance
  - **Verifies:** AC #7 -- running-state guard

- **Test:** [P1] calling close() multiple times is a no-op after first call
  - **Status:** RED - it.skip() -- subscribe() does not exist on TownInstance
  - **Verifies:** AC #8 -- idempotent close

- **Test:** [P1] TownSubscription should be exported from @toon-protocol/town
  - **Status:** RED - it.skip() -- TownSubscription type not yet defined
  - **Verifies:** AC #1 -- type export

### E2E Tests (0 tests)

Not applicable. This is a backend library story (no UI, no browser tests).

### API Tests (0 tests)

Not applicable. This story is a programmatic API on an in-process object, not an HTTP API.

### Component Tests (0 tests)

Not applicable. No UI components involved.

---

## Data Factories Created

No data factories needed. The test data is simple mock objects (NostrEvent, Filter) constructed inline using the `makeEvent()` helper pattern already established in `RelaySubscriber.test.ts`.

---

## Fixtures Created

No Playwright/Cypress fixtures needed. This is a pure unit test story using Vitest.

**Mock infrastructure (commented out for RED phase, activate for GREEN phase):**
- `MockRelaySubscriber` -- Mock constructor and `start()` return value
- `vi.mock('@toon-protocol/relay')` -- Isolate subscribe() wrapper from actual RelaySubscriber
- `vi.mock('nostr-tools/pool')` -- Prevent live WebSocket connections
- `vi.mock('nostr-tools/pure')` -- Control `verifyEvent` behavior

---

## Mock Requirements

### RelaySubscriber Mock

**Module:** `@toon-protocol/relay`

**Mock pattern:** Follow `RelaySubscriber.test.ts` (granular mocking):
```typescript
vi.mock('@toon-protocol/relay', async () => {
  const actual = await vi.importActual('@toon-protocol/relay');
  return { ...actual, RelaySubscriber: MockRelaySubscriber };
});
```

**Constructor capture:**
- `config.relayUrls` -- verify relay URL passed correctly
- `config.filter` -- verify filter passed correctly
- `eventStore` -- verify Town's EventStore is passed

**start() return:**
- `{ unsubscribe: vi.fn() }` -- verify close() calls unsubscribe()

### nostr-tools/pool Mock

**Purpose:** Prevent live WebSocket connections during tests.

```typescript
vi.mock('nostr-tools/pool', () => ({
  SimplePool: vi.fn(() => ({
    subscribeMany: vi.fn(() => ({ close: vi.fn() })),
  })),
}));
```

### nostr-tools/pure Mock

**Purpose:** Control verifyEvent behavior.

```typescript
vi.mock('nostr-tools/pure', async () => {
  const actual = await vi.importActual('nostr-tools/pure');
  return { ...actual, verifyEvent: vi.fn(() => true) };
});
```

---

## Required data-testid Attributes

Not applicable. This story has no UI components.

---

## Implementation Checklist

### Test: [P0] subscribe() creates a RelaySubscriber and returns a TownSubscription handle

**File:** `packages/town/src/subscribe.test.ts`

**Tasks to make this test pass:**

- [ ] Define `TownSubscription` interface in `packages/town/src/town.ts` with `close()`, `relayUrl`, `isActive()`
- [ ] Add `subscribe(relayUrl: string, filter: Filter): TownSubscription` to `TownInstance` interface
- [ ] Import `RelaySubscriber` from `@toon-protocol/relay` in `town.ts`
- [ ] Import `type { Filter }` from `nostr-tools/filter` in `town.ts`
- [ ] Implement `subscribe()` inside `startTown()`: create `RelaySubscriber`, call `start()`, return `TownSubscription`
- [ ] Remove `it.skip()` from test, uncomment mock setup and assertions
- [ ] Run test: `pnpm vitest run packages/town/src/subscribe.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: [P0] subscription.isActive() returns true for active subscription

**File:** `packages/town/src/subscribe.test.ts`

**Tasks to make this test pass:**

- [ ] Add internal `active` flag (initialized to `true`) in subscribe() wrapper
- [ ] Implement `isActive()` to return the `active` flag
- [ ] Remove `it.skip()`, uncomment assertions
- [ ] Run test: `pnpm vitest run packages/town/src/subscribe.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours

---

### Test: [P0] received events are stored in EventStore via RelaySubscriber onevent

**File:** `packages/town/src/subscribe.test.ts`

**Tasks to make this test pass:**

- [ ] Pass the Town's `eventStore` to `new RelaySubscriber(config, eventStore)`
- [ ] Verify `eventStore` variable (SqliteEventStore) is in scope and passed correctly
- [ ] Remove `it.skip()`, uncomment assertions
- [ ] Run test: `pnpm vitest run packages/town/src/subscribe.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours

---

### Test: [P0] subscription.close() calls unsubscribe and isActive() returns false

**File:** `packages/town/src/subscribe.test.ts`

**Tasks to make this test pass:**

- [ ] Implement `close()` on TownSubscription: call `handle.unsubscribe()`, set `active = false`, remove from `activeSubscriptions`
- [ ] Remove `it.skip()`, uncomment assertions
- [ ] Run test: `pnpm vitest run packages/town/src/subscribe.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours

---

### Test: [P0] town.stop() closes all active subscriptions

**File:** `packages/town/src/subscribe.test.ts`

**Tasks to make this test pass:**

- [ ] Create `activeSubscriptions` Set inside `startTown()` (before the TownInstance return block)
- [ ] Add subscription to `activeSubscriptions` in `subscribe()`
- [ ] Update `stop()` to iterate `activeSubscriptions` and call `close()` on each BEFORE existing cleanup
- [ ] Call `activeSubscriptions.clear()` after iteration
- [ ] Remove `it.skip()`, uncomment assertions
- [ ] Run test: `pnpm vitest run packages/town/src/subscribe.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: [P0] subscribe() throws Error when town is not running

**File:** `packages/town/src/subscribe.test.ts`

**Tasks to make this test pass:**

- [ ] Add guard at top of `subscribe()`: `if (!running) throw new Error("Cannot subscribe: town is not running")`
- [ ] Remove `it.skip()`, uncomment assertions
- [ ] Run test: `pnpm vitest run packages/town/src/subscribe.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours

---

### Test: [P1] subscription.relayUrl returns the URL passed to subscribe()

**File:** `packages/town/src/subscribe.test.ts`

**Tasks to make this test pass:**

- [ ] Set `relayUrl` property on TownSubscription wrapper to the provided URL string
- [ ] Remove `it.skip()`, uncomment assertions
- [ ] Run test: `pnpm vitest run packages/town/src/subscribe.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.1 hours

---

### Test: [P1] multiple subscriptions can be active simultaneously

**File:** `packages/town/src/subscribe.test.ts`

**Tasks to make this test pass:**

- [ ] Verify `activeSubscriptions` Set supports multiple entries
- [ ] Each `subscribe()` call creates independent `RelaySubscriber` and `TownSubscription`
- [ ] Remove `it.skip()`, uncomment assertions
- [ ] Run test: `pnpm vitest run packages/town/src/subscribe.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours

---

### Test: [P1] subscribe with kind:10032 filter

**File:** `packages/town/src/subscribe.test.ts`

**Tasks to make this test pass:**

- [ ] Verify `subscribe()` passes filter object through to RelaySubscriber correctly
- [ ] No special handling needed for kind:10032 (generic filter passthrough)
- [ ] Remove `it.skip()`, uncomment assertions
- [ ] Run test: `pnpm vitest run packages/town/src/subscribe.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.1 hours

---

### Test: [P1] subscribe with kind:10036 filter

**File:** `packages/town/src/subscribe.test.ts`

**Tasks to make this test pass:**

- [ ] Same as kind:10032 -- verify filter passthrough
- [ ] Remove `it.skip()`, uncomment assertions
- [ ] Run test: `pnpm vitest run packages/town/src/subscribe.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.1 hours

---

### Test: [P1] idempotent close()

**File:** `packages/town/src/subscribe.test.ts`

**Tasks to make this test pass:**

- [ ] Add `if (!active) return` guard at top of `close()`
- [ ] Remove `it.skip()`, uncomment assertions
- [ ] Run test: `pnpm vitest run packages/town/src/subscribe.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.1 hours

---

### Test: [P1] TownSubscription type export

**File:** `packages/town/src/subscribe.test.ts`

**Tasks to make this test pass:**

- [ ] Export `TownSubscription` type from `packages/town/src/index.ts`
- [ ] Remove `it.skip()`, uncomment assertions
- [ ] Run test: `pnpm vitest run packages/town/src/subscribe.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.1 hours

---

### Test: [P2] lastSeenTimestamp tracking

**File:** `packages/town/src/subscribe.test.ts`

**Tasks to make this test pass:**

- [ ] Track `lastSeenTimestamp` as a `number` on the subscription wrapper (initialized to 0)
- [ ] Remove `it.skip()`, uncomment assertions
- [ ] Run test: `pnpm vitest run packages/town/src/subscribe.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.1 hours

---

## Running Tests

```bash
# Run all failing tests for this story
pnpm vitest run packages/town/src/subscribe.test.ts

# Run with verbose output
pnpm vitest run packages/town/src/subscribe.test.ts --reporter=verbose

# Run in watch mode during development
pnpm vitest packages/town/src/subscribe.test.ts

# Run all town package tests
pnpm vitest run packages/town/

# Run full test suite
pnpm test
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 13 tests written and skipped (it.skip())
- Mock infrastructure documented (commented out for activation)
- No fixtures needed (pure unit tests with Vitest mocks)
- No data-testid requirements (backend story)
- Implementation checklist created with 13 test-to-task mappings

**Verification:**

- All 13 tests skip when run (RED phase confirmed)
- Tests are structured for easy GREEN phase activation
- Failure messages documented (expect(true).toBe(false) as RED markers)
- Tests will fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with P0 tests)
2. **Read the test** to understand expected behavior
3. **Implement minimal code** to make that specific test pass
4. **Activate the test**: Remove `it.skip()`, uncomment mock setup and assertions
5. **Run the test** to verify it now passes (green)
6. **Check off the task** in implementation checklist
7. **Move to next test** and repeat

**Recommended implementation order (by dependency):**

1. Define `TownSubscription` interface and `subscribe()` signature (enables all other tests)
2. Implement `subscribe()` core logic (RelaySubscriber creation, start, return handle)
3. Implement `isActive()` and `relayUrl` properties
4. Implement `close()` with idempotent guard
5. Add `activeSubscriptions` Set and `stop()` cleanup
6. Add running-state guard
7. Add `lastSeenTimestamp` tracking
8. Export `TownSubscription` from index.ts

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability, performance)
3. **Ensure tests still pass** after each refactor
4. **Run full suite:** `pnpm build && pnpm test && pnpm lint`

---

## Next Steps

1. **Review this checklist** with team
2. **Run failing tests** to confirm RED phase: `pnpm vitest run packages/town/src/subscribe.test.ts`
3. **Begin implementation** using implementation checklist as guide
4. **Work one test at a time** (red -> green for each)
5. **When all tests pass**, refactor code for quality
6. **Run full build/test/lint** to confirm nothing broken
7. **When complete**, manually update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **test-quality.md** -- Test quality principles (determinism, isolation, explicit assertions)
- **test-levels-framework.md** -- Test level selection (unit for pure wrapper logic)
- **data-factories.md** -- Factory patterns (not needed for this story; mock objects suffice)

Existing project test patterns referenced:

- **RelaySubscriber.test.ts** -- Mock pattern for `vi.mock('nostr-tools/pool')` and `vi.mock('nostr-tools/pure')`
- **town.test.ts** -- Test conventions for TownInstance (Given-When-Then comments, type surface tests)

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm vitest run packages/town/src/subscribe.test.ts --reporter=verbose`

**Results:**

```
 Test Files  1 skipped (1)
      Tests  13 skipped (13)
   Start at  13:34:36
   Duration  252ms
```

**Summary:**

- Total tests: 13
- Passing: 0 (expected)
- Failing: 0 (all skipped per TDD convention)
- Skipped: 13 (it.skip() for RED phase)
- Status: RED phase verified

---

## Notes

- **Pre-existing issue:** `@toon-protocol/core` has a broken export from `./spsp/index.js` (directory removed in Story 3.7 SPSP removal). This prevents importing actual modules from `@toon-protocol/relay` or `@toon-protocol/core` in tests. The test file avoids this by commenting out `vi.importActual('@toon-protocol/relay')`. When the SPSP export is cleaned up, the mocks can use `vi.importActual` safely.
- **No data factories needed:** Test data is simple (relay URLs as strings, Filter objects). The `makeEvent()` helper from `RelaySubscriber.test.ts` can be reused if needed in GREEN phase.
- **Testing approach decision:** The story recommends either (a) mocking `RelaySubscriber` at module level, or (b) extracting a testable helper function. The tests are structured to support either approach -- the dev agent can choose during GREEN phase.

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Refer to `_bmad-output/implementation-artifacts/2-8-relay-subscription-api-on-town-instance.md` for full story spec

---

**Generated by BMad TEA Agent** - 2026-03-07
