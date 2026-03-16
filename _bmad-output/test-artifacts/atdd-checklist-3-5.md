---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-strategy',
    'step-04-generate-tests',
    'step-04c-aggregate',
    'step-05-checklist',
  ]
lastStep: 'step-05-checklist'
lastSaved: '2026-03-13'
workflowType: 'testarch-atdd'
inputDocuments:
  [
    '_bmad-output/implementation-artifacts/3-5-kind-10035-service-discovery-events.md',
    '_bmad-output/project-context.md',
    'packages/core/src/events/seed-relay.ts',
    'packages/core/src/events/builders.ts',
    'packages/core/src/events/parsers.ts',
    'packages/core/src/events/index.ts',
    'packages/core/src/constants.ts',
    'packages/core/src/index.ts',
    'packages/town/src/town.ts',
    'packages/town/src/town.test.ts',
    'packages/core/vitest.config.ts',
    'packages/town/vitest.config.ts',
  ]
---

# ATDD Checklist - Epic 3, Story 3.5: kind:10035 Service Discovery Events

**Date:** 2026-03-13
**Author:** Jonathan
**Primary Test Level:** Unit / Integration (backend, no UI)

---

## Story Summary

Crosstown nodes publish kind:10035 Service Discovery events to advertise their capabilities, pricing, and payment endpoints in a machine-readable format. This enables network participants and AI agents to programmatically discover and consume services.

**As a** network participant or AI agent
**I want** to discover what services a Crosstown node offers and at what price
**So that** I can programmatically find and consume services without documentation

---

## Acceptance Criteria

1. **AC #1:** Node publishes kind:10035 (Service Discovery) event after bootstrap completes.
2. **AC #2:** Event content contains: service type, x402 endpoint URL (if enabled), ILP address, pricing model, supported event kinds, node capabilities, chain, and version.
3. **AC #3:** When x402 is disabled, the x402 field is **entirely omitted** from the event content (not set to `{ enabled: false }`).
4. **AC #4:** Event uses NIP-16 replaceable semantics (kind 10000-19999) with `d` tag value `crosstown-service-discovery`.

---

## Failing Tests Created (RED Phase)

### Unit/Integration Tests (15 tests)

**File:** `packages/core/src/events/service-discovery.test.ts` (290 lines)

- **Test:** `[P2] SERVICE_DISCOVERY_KIND equals 10035` (T-3.5-05)
  - **Status:** RED - Module `./service-discovery.js` does not exist
  - **Verifies:** Constant value matches NIP-16 replaceable kind range

- **Test:** `[P1] node publishes kind:10035 event after bootstrap completes` (3.5-INT-001)
  - **Status:** RED - Module `./service-discovery.js` does not exist
  - **Verifies:** `buildServiceDiscoveryEvent()` produces signed event with correct kind, pubkey, id, sig

- **Test:** `[P1] event content contains service type, ILP address, pricing, x402 endpoint` (3.5-INT-002)
  - **Status:** RED - Module `./service-discovery.js` does not exist
  - **Verifies:** Full round-trip: build event -> parse event -> verify all fields

- **Test:** `[P2] x402 disabled -> event advertises ILP-only access (x402 field omitted)` (3.5-INT-003)
  - **Status:** RED - Module `./service-discovery.js` does not exist
  - **Verifies:** x402 field entirely absent when disabled (AC #3)

- **Test:** `[P2] event has d tag for NIP-16 replaceable event pattern` (3.5-UNIT-001)
  - **Status:** RED - Module `./service-discovery.js` does not exist
  - **Verifies:** d tag = 'crosstown-service-discovery' (NIP-16, not NIP-33)

- **Test:** `[P2] returns null for malformed JSON content` (T-3.5-06)
  - **Status:** RED - Module `./service-discovery.js` does not exist
  - **Verifies:** Graceful degradation for invalid JSON

- **Test:** `[P2] returns null for non-object JSON content` (T-3.5-06)
  - **Status:** RED - Module `./service-discovery.js` does not exist
  - **Verifies:** Graceful degradation for JSON array instead of object

- **Test:** `[P2] returns null when serviceType is missing` (T-3.5-07)
  - **Status:** RED - Module `./service-discovery.js` does not exist
  - **Verifies:** Required field validation

- **Test:** `[P2] returns null when pricing is missing` (T-3.5-07)
  - **Status:** RED - Module `./service-discovery.js` does not exist
  - **Verifies:** Required field validation

- **Test:** `[P2] returns null when ilpAddress is missing` (T-3.5-07)
  - **Status:** RED - Module `./service-discovery.js` does not exist
  - **Verifies:** Required field validation

- **Test:** `[P2] returns null when supportedKinds is not an array` (T-3.5-07)
  - **Status:** RED - Module `./service-discovery.js` does not exist
  - **Verifies:** Required field type validation

- **Test:** `[P2] returns null when chain is missing` (T-3.5-07)
  - **Status:** RED - Module `./service-discovery.js` does not exist
  - **Verifies:** Required field validation

- **Test:** `[P2] returns null when version is missing` (T-3.5-07)
  - **Status:** RED - Module `./service-discovery.js` does not exist
  - **Verifies:** Required field validation

- **Test:** `[P2] includes correct kind 10035 and valid created_at timestamp` (T-3.5-08)
  - **Status:** RED - Module `./service-discovery.js` does not exist
  - **Verifies:** Event kind and timestamp correctness

- **Test:** `[P2] returns event with valid id (64 hex chars) and sig (128 hex chars)` (T-3.5-09)
  - **Status:** RED - Module `./service-discovery.js` does not exist
  - **Verifies:** Signed event format (id, sig, content JSON, pubkey)

### Static Type Surface Tests (4 tests -- GREEN, by design)

**File:** `packages/town/src/town.test.ts` (appended, 4 tests)

- **Test:** `[P2] TownConfig accepts chain field` (T-3.5-10)
  - **Status:** GREEN (compile-time type check, passes immediately)
  - **Verifies:** `TownConfig.chain` is accepted by TypeScript

- **Test:** `[P2] TownConfig chain field defaults to undefined` (T-3.5-10)
  - **Status:** GREEN (compile-time type check, passes immediately)
  - **Verifies:** `chain` is optional on TownConfig

- **Test:** `[P2] ResolvedTownConfig accepts chain field with string value` (T-3.5-11)
  - **Status:** GREEN (compiles with excess property -- will become RED when `chain` is made required)
  - **Verifies:** `ResolvedTownConfig.chain` holds string values

- **Test:** `[P2] ResolvedTownConfig chain field accepts production preset names` (T-3.5-11)
  - **Status:** GREEN (compiles with excess property -- will become RED when `chain` is made required)
  - **Verifies:** Production chain names like 'arbitrum-one' work

**Note:** When the developer adds `chain: string` as a **required** field to `ResolvedTownConfig`, the existing test `ResolvedTownConfig should have all fields non-optional` (line 134) will fail because it doesn't include `chain`. This is the intended RED phase trigger for the type change.

---

## Data Factories Created

### ServiceDiscoveryContent Factory

**File:** `packages/core/src/events/service-discovery.test.ts` (inline)

**Exports (test-local):**

- `createServiceDiscoveryContent(overrides?)` - Create content with x402 enabled, all fields populated
- `createIlpOnlyContent()` - Create content with x402 omitted (ILP-only, per AC #3)

**Example Usage:**

```typescript
const content = createServiceDiscoveryContent();
const ilpOnly = createIlpOnlyContent();
const custom = createServiceDiscoveryContent({ chain: 'anvil', version: '2.0.0' });
```

---

## Fixtures Created

No separate fixture files needed. Tests use inline factory functions and `nostr-tools/pure` `generateSecretKey()` / `getPublicKey()` for deterministic cryptographic test data. This follows the same pattern as `seed-relay.ts` and `builders.test.ts`.

---

## Mock Requirements

No external service mocking required. All tests are pure unit/integration tests that operate on in-memory data structures:

- `nostr-tools/pure` provides real cryptographic operations (`generateSecretKey`, `getPublicKey`, `finalizeEvent`)
- `JSON.stringify` / `JSON.parse` for content serialization
- No network calls, no database, no file system

---

## Required data-testid Attributes

Not applicable. This is a backend-only story with no UI components.

---

## Implementation Checklist

### Test: SERVICE_DISCOVERY_KIND equals 10035 (T-3.5-05)

**File:** `packages/core/src/events/service-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] Add `SERVICE_DISCOVERY_KIND = 10035` to `packages/core/src/constants.ts`
- [ ] Create `packages/core/src/events/service-discovery.ts` with exported constant
- [ ] Export from `packages/core/src/events/index.ts`
- [ ] Export from `packages/core/src/index.ts`
- [ ] Run test: `npx vitest run packages/core/src/events/service-discovery.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours

---

### Test: node publishes kind:10035 event (3.5-INT-001)

**File:** `packages/core/src/events/service-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] Define `ServiceDiscoveryContent` interface in `service-discovery.ts`
- [ ] Implement `buildServiceDiscoveryEvent(content, secretKey)` using `finalizeEvent()` from `nostr-tools/pure`
- [ ] Set `kind: SERVICE_DISCOVERY_KIND`, `content: JSON.stringify(content)`, `tags: [['d', 'crosstown-service-discovery']]`, `created_at: Math.floor(Date.now() / 1000)`
- [ ] Export `buildServiceDiscoveryEvent` and `type ServiceDiscoveryContent`
- [ ] Run test: `npx vitest run packages/core/src/events/service-discovery.test.ts -t "node publishes"`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: event content contains all fields (3.5-INT-002)

**File:** `packages/core/src/events/service-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] Implement `parseServiceDiscovery(event)` -- parse JSON, validate required fields, return typed content
- [ ] Follow `parseSeedRelayList()` pattern: graceful degradation (return null for malformed content)
- [ ] Validate: `serviceType` (string), `ilpAddress` (string), `pricing` (object with `basePricePerByte` number, `currency` string), `supportedKinds` (number[]), `capabilities` (string[]), `chain` (string), `version` (string)
- [ ] Handle optional `x402` field: when present, validate `enabled` (boolean) and optional `endpoint` (string)
- [ ] Export `parseServiceDiscovery`
- [ ] Run test: `npx vitest run packages/core/src/events/service-discovery.test.ts -t "event content contains"`
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: x402 disabled -> ILP-only (3.5-INT-003)

**File:** `packages/core/src/events/service-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] Ensure `parseServiceDiscovery()` does NOT include `x402` in result when the field is absent from JSON
- [ ] Verify the factory function `createIlpOnlyContent()` omits `x402` entirely (not `{ enabled: false }`)
- [ ] Run test: `npx vitest run packages/core/src/events/service-discovery.test.ts -t "x402 disabled"`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours (covered by 3.5-INT-002 implementation)

---

### Test: NIP-16 d tag (3.5-UNIT-001)

**File:** `packages/core/src/events/service-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] Ensure `buildServiceDiscoveryEvent()` sets `tags: [['d', 'crosstown-service-discovery']]`
- [ ] Run test: `npx vitest run packages/core/src/events/service-discovery.test.ts -t "d tag"`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.1 hours (covered by 3.5-INT-001 implementation)

---

### Tests: parseServiceDiscovery graceful degradation (T-3.5-06, T-3.5-07)

**File:** `packages/core/src/events/service-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] Ensure `parseServiceDiscovery()` returns `null` for malformed JSON
- [ ] Ensure `parseServiceDiscovery()` returns `null` for non-object JSON (arrays, primitives)
- [ ] Ensure `parseServiceDiscovery()` returns `null` for missing required fields: `serviceType`, `ilpAddress`, `pricing`, `supportedKinds`, `capabilities`, `chain`, `version`
- [ ] Run test: `npx vitest run packages/core/src/events/service-discovery.test.ts -t "graceful|missing"`
- [ ] All 8 validation tests pass (green phase)

**Estimated Effort:** 0.5 hours (covered by parseServiceDiscovery implementation)

---

### Tests: buildServiceDiscoveryEvent format (T-3.5-08, T-3.5-09)

**File:** `packages/core/src/events/service-discovery.test.ts`

**Tasks to make this test pass:**

- [ ] Ensure `buildServiceDiscoveryEvent()` uses `finalizeEvent()` which produces valid id (SHA-256 hex) and sig (Schnorr hex)
- [ ] Ensure `created_at` is set to current Unix timestamp
- [ ] Run test: `npx vitest run packages/core/src/events/service-discovery.test.ts -t "kind and created_at|valid signed"`
- [ ] Both tests pass (green phase)

**Estimated Effort:** 0.1 hours (covered by buildServiceDiscoveryEvent implementation)

---

### Tests: TownConfig/ResolvedTownConfig chain field (T-3.5-10, T-3.5-11)

**File:** `packages/town/src/town.test.ts`

**Tasks to make this test pass:**

- [ ] Add `chain: string` to `ResolvedTownConfig` interface in `packages/town/src/town.ts`
- [ ] Update existing `ResolvedTownConfig should have all fields non-optional` test to include `chain` field
- [ ] Populate `resolvedConfig.chain` from `chainConfig.name` after `resolveChainConfig()` call
- [ ] Run test: `npx vitest run packages/town/src/town.test.ts -t "chain field"`
- [ ] All 4 chain tests pass (green phase)

**Estimated Effort:** 0.5 hours

---

### Integration: Publish kind:10035 in startTown()

**File:** `packages/town/src/town.ts`

**Tasks (not directly tested by ATDD unit tests, but required for AC #1):**

- [ ] Import `buildServiceDiscoveryEvent`, `SERVICE_DISCOVERY_KIND`, `VERSION` from `@crosstown/core`
- [ ] Import `type ServiceDiscoveryContent` from `@crosstown/core`
- [ ] After bootstrap completes (after kind:10032 self-write), build `ServiceDiscoveryContent` from resolved config
- [ ] Use `chainConfig.name` from existing `resolveChainConfig()` call (do NOT call again)
- [ ] Conditionally include `x402` field only when `x402Enabled` is true
- [ ] Sign with `identity.secretKey` using `buildServiceDiscoveryEvent()`
- [ ] Store locally via `eventStore.store(event)`
- [ ] Publish to peers via ILP (fire-and-forget, same pattern as kind:10032)
- [ ] Verify with E2E tests: `cd packages/town && pnpm test:e2e`

**Estimated Effort:** 1.5 hours

---

## Running Tests

```bash
# Run all failing tests for this story (core package)
npx vitest run packages/core/src/events/service-discovery.test.ts

# Run town.test.ts (includes chain field tests)
npx vitest run packages/town/src/town.test.ts

# Run specific test by name
npx vitest run packages/core/src/events/service-discovery.test.ts -t "SERVICE_DISCOVERY_KIND"

# Run with verbose output
npx vitest run packages/core/src/events/service-discovery.test.ts --reporter=verbose

# Run full test suite (verify no regressions)
pnpm test

# Run tests with coverage
pnpm test:coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 15 unit/integration tests written and failing (module-not-found)
- 4 static type surface tests written and passing (by design)
- Factory functions created for test data generation
- Implementation checklist created with clear tasks
- ATDD test bugs from original stubs fixed:
  - NIP-33 -> NIP-16 (correct NIP designation for kind 10035)
  - x402 disabled assertion rewritten (omit field, not `{ enabled: false }`)

**Verification:**

- All 15 core tests fail with `Failed to load url ./service-discovery.js`
- Failure is due to missing implementation module, not test bugs
- Full test suite: 1487 passing, 1 suite failed (expected), 0 regressions

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Create `packages/core/src/events/service-discovery.ts`** with:
   - `ServiceDiscoveryContent` interface
   - `SERVICE_DISCOVERY_KIND = 10035` constant (also add to `constants.ts`)
   - `buildServiceDiscoveryEvent()` builder function
   - `parseServiceDiscovery()` parser function
2. **Export** from `events/index.ts` and `core/index.ts`
3. **Add `chain: string`** to `ResolvedTownConfig` in `town.ts`
4. **Integrate kind:10035 publishing** into `startTown()` after bootstrap
5. **Run tests** after each task to track progress
6. **Update sprint status** when complete

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Follow existing patterns (`seed-relay.ts` for builder/parser, `builders.ts` for event construction)
- Use `chainConfig.name` from existing resolution (don't call `resolveChainConfig()` again)
- x402 field omitted when disabled (not set to `{ enabled: false }`)

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all 19 tests pass (15 unit/integration + 4 type surface)
2. Review code for quality (readability, maintainability)
3. Ensure no duplicate logic between `parseSeedRelayList` and `parseServiceDiscovery`
4. Verify lint passes: `npx eslint packages/core/src/events/service-discovery.ts`
5. Run full suite: `pnpm build && pnpm lint && pnpm test`

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow
2. **Run failing tests** to confirm RED phase: `npx vitest run packages/core/src/events/service-discovery.test.ts`
3. **Begin implementation** using implementation checklist as guide
4. **Work one test at a time** (red -> green for each)
5. **When all tests pass**, refactor code for quality
6. **When refactoring complete**, update sprint-status.yaml: set 3-5 to done
7. **Verify no regressions**: `pnpm build && pnpm lint && pnpm test`

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments and codebase patterns:

- **seed-relay.ts** - NIP-16 replaceable event builder/parser pattern (d tag, finalizeEvent, graceful degradation)
- **builders.ts** - ILP peer info event builder pattern (finalizeEvent, kind constant, JSON.stringify content)
- **parsers.ts** - Event parser pattern (JSON.parse, field validation, error handling)
- **project-context.md** - Testing rules, TypeScript rules, naming conventions, import patterns
- **town.test.ts** - Static type surface test pattern (compile-time checks for TownConfig/ResolvedTownConfig)

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run --reporter=verbose`

**Results:**

```
FAIL  packages/core/src/events/service-discovery.test.ts
Error: Failed to load url ./service-discovery.js (resolved id: ./service-discovery.js)
Does the file exist?

Test Files  1 failed | 74 passed | 14 skipped (89)
Tests       1487 passed | 152 skipped (1639)
```

**Summary:**

- Total story tests: 19 (15 unit/integration + 4 type surface)
- Failing: 15 (expected -- module not found)
- Passing: 4 (type surface tests, by design)
- Regressions: 0
- Status: RED phase verified

**Expected Failure Message:**

```
Error: Failed to load url ./service-discovery.js (resolved id: ./service-discovery.js)
in packages/core/src/events/service-discovery.test.ts. Does the file exist?
```

---

## Test Design Traceability

| Test ID | Test Name | AC | Priority | Level |
|---|---|---|---|---|
| T-3.5-05 | SERVICE_DISCOVERY_KIND equals 10035 | -- | P2 | Unit |
| 3.5-INT-001 | node publishes kind:10035 event after bootstrap completes | #1 | P1 | Integration |
| 3.5-INT-002 | event content contains service type, ILP address, pricing, x402 endpoint | #2 | P1 | Integration |
| 3.5-INT-003 | x402 disabled -> event advertises ILP-only access (x402 field omitted) | #3 | P2 | Integration |
| 3.5-UNIT-001 | event has d tag for NIP-16 replaceable event pattern | #4 | P2 | Unit |
| T-3.5-06a | parseServiceDiscovery returns null for malformed JSON | #2 | P2 | Unit |
| T-3.5-06b | parseServiceDiscovery returns null for non-object JSON | #2 | P2 | Unit |
| T-3.5-07a | parseServiceDiscovery returns null when serviceType missing | #2 | P2 | Unit |
| T-3.5-07b | parseServiceDiscovery returns null when pricing missing | #2 | P2 | Unit |
| T-3.5-07c | parseServiceDiscovery returns null when ilpAddress missing | #2 | P2 | Unit |
| T-3.5-07d | parseServiceDiscovery returns null when supportedKinds not array | #2 | P2 | Unit |
| T-3.5-07e | parseServiceDiscovery returns null when chain missing | #2 | P2 | Unit |
| T-3.5-07f | parseServiceDiscovery returns null when version missing | #2 | P2 | Unit |
| T-3.5-08 | buildServiceDiscoveryEvent kind and created_at | #1 | P2 | Unit |
| T-3.5-09 | buildServiceDiscoveryEvent valid signed event | #1 | P2 | Unit |
| T-3.5-10a | TownConfig accepts chain field | #1 | P2 | Static |
| T-3.5-10b | TownConfig chain field defaults to undefined | #1 | P2 | Static |
| T-3.5-11a | ResolvedTownConfig accepts chain field | #1 | P2 | Static |
| T-3.5-11b | ResolvedTownConfig chain accepts production presets | #1 | P2 | Static |

---

## ATDD Bug Fixes Applied

Two bugs in the original ATDD stubs (from the epic-level ATDD checklist) were fixed:

### Bug 1: NIP-33 -> NIP-16 (corrected)

**Original:** Test describe block said "NIP-33 replaceable pattern" and test name said "NIP-33 replaceable event pattern"
**Fixed:** Changed to "NIP-16 replaceable pattern" and "NIP-16 replaceable event pattern"
**Reason:** Kind 10035 is in the 10000-19999 NIP-16 replaceable range, not the 30000-39999 NIP-33 parameterized replaceable range

### Bug 2: x402 disabled assertion (corrected)

**Original:** Test created content with `x402: { enabled: false }` and asserted `parsed.x402.enabled === false`
**Fixed:** Test creates content WITHOUT x402 field and asserts `parsed.x402 === undefined`
**Reason:** AC #3 requires the x402 field to be entirely omitted when disabled, not set to `{ enabled: false }`

---

## Notes

- The `service-discovery.ts` module follows the same pattern as `seed-relay.ts`: builder + parser + types in one file
- `SERVICE_DISCOVERY_KIND` should be added to both `constants.ts` (for consistency) and re-exported from `service-discovery.ts`
- The `parseServiceDiscovery()` function returns `null` (graceful degradation), unlike `parseIlpPeerInfo()` which throws `InvalidEventError`. The null-return pattern was chosen to match `parseSeedRelayList()` since discovery events may come from untrusted sources
- The town.test.ts chain field tests (T-3.5-10, T-3.5-11) follow the same compile-time type surface pattern used for Story 3.4 seed relay discovery tests

---

**Generated by BMad TEA Agent** - 2026-03-13
