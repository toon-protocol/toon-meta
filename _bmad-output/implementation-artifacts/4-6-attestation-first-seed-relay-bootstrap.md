# Story 4.6: Attestation-First Seed Relay Bootstrap

Status: done

## Story

As a **Crosstown node operator bootstrapping into the ILP network**,
I want the seed relay discovery flow (from Story 3.4's kind:10036 events) to verify each seed relay's kind:10033 TEE attestation BEFORE trusting its kind:10032 peer list,
So that seed relay list poisoning (R-E4-004) is mitigated by using attestation as the bootstrap trust anchor, and only peers from verified TEE-attested seed relays are added to my routing table.

**FRs covered:** FR-TEE-6 (Attestation-first seed relay bootstrap -- kind:10033 verification integrated into seed relay flow)

**Dependencies:** Story 4.1 complete (commit `4fbef06`). Story 4.2 complete (commit `864bb49`) -- `buildAttestationEvent()`, `parseAttestation()`, `TEE_ATTESTATION_KIND` available from `@crosstown/core`. Story 4.3 complete (commit `aeb2b8b`) -- `AttestationVerifier` class with `verify()`, `getAttestationState()`, `rankPeers()` available. Story 4.4 complete (commit `81d3f4d`) -- `deriveFromKmsSeed()` available. Story 4.5 complete (commit `e1bf435`) -- `NixBuilder`, `verifyPcrReproducibility` available. Story 3.4 complete (commit `ab01976`) -- `buildSeedRelayListEvent()`, `parseSeedRelayList()`, `SeedRelayEntry` available from `@crosstown/core`.

**Decision sources:**
- Decision 7 (research/marlin-party-mode-decisions): Genesis replaced by seed relay list model. Bootstrap trust flow: kind:10036 -> connect seed -> verify kind:10033 -> subscribe kind:10032
- Decision 12 (architecture.md): Attestation Lifecycle Architecture -- kind:10033 on startup, dual-channel exposure, trust degrades; money doesn't
- R-E4-004 (test-design-epic-4.md): Seed relay list poisoning -- malicious kind:10036 events point to non-attested nodes, enabling MitM during bootstrap (Score: 6, HIGH)
- Test Design: T-4.6-01 through T-4.6-05 (ATDD RED stubs exist in `attestation-bootstrap.test.ts`)

## Acceptance Criteria

1. Given a list of seed relay URLs (from a kind:10036 event parsed by `parseSeedRelayList()`), when `AttestationBootstrap.bootstrap()` is called, then for each seed relay the system queries for its kind:10033 attestation event and verifies it via `AttestationVerifier.verify()` BEFORE subscribing to that relay's kind:10032 peer info events. The attestation query must complete and pass verification before any peer discovery occurs for that relay. This is validated by verifying `queryAttestation()` invocation order precedes `subscribePeers()` invocation order via `mock.invocationCallOrder`.

2. Given a seed relay list where the first relay has no valid attestation (returns `null`, fails verification, or `queryAttestation` throws an error), when `AttestationBootstrap.bootstrap()` is called, then the system falls back to the next seed relay in the list without crashing. The system must try all seed relays in order, calling `queryAttestation()` for each. Only relays that pass attestation verification proceed to peer discovery via `subscribePeers()`. Callback errors (thrown exceptions) are caught and treated equivalently to a `null` attestation return.

3. Given a seed relay with valid kind:10033 attestation, when the attestation passes `AttestationVerifier.verify()`, then the system proceeds to subscribe to kind:10032 peer info events on that relay. The bootstrap result includes `discoveredPeers` (array of discovered peer info events), `attestedSeedRelay` (URL of the first relay that passed attestation), and `mode: 'attested'`.

4. Given a seed relay list where ALL relays lack valid attestation, when `AttestationBootstrap.bootstrap()` is called, then the node starts in degraded mode (`mode: 'degraded'`), logs a warning containing "No attested seed relays found", and does NOT crash. The result has `attestedSeedRelay: undefined`, `discoveredPeers: []`, and `subscribePeers` is never called.

5. Given the full attestation-first bootstrap flow (kind:10036 -> connect seed -> verify kind:10033 -> subscribe kind:10032), when `AttestationBootstrap.bootstrap()` completes successfully, then lifecycle events are emitted in order: `attestation:seed-connected` -> `attestation:verified` -> `attestation:peers-discovered`. The result includes `mode: 'attested'`, the attested seed relay URL, and all discovered peers.

6. Given `AttestationBootstrap`, `AttestationBootstrapConfig`, `AttestationBootstrapResult`, and `AttestationBootstrapEvent`, when imported from `@crosstown/core`, then they are exported from `packages/core/src/bootstrap/AttestationBootstrap.ts` and re-exported via `packages/core/src/bootstrap/index.ts` and the top-level `packages/core/src/index.ts`.

## Tasks / Subtasks

- [x] Task 1: Create `AttestationBootstrap` class (AC: #1, #2, #3, #4, #5, #6)
  - [x] Create `packages/core/src/bootstrap/AttestationBootstrap.ts`
  - [x] Define `AttestationBootstrapConfig` interface:
    ```typescript
    export interface AttestationBootstrapConfig {
      /** Seed relay WebSocket URLs from kind:10036 */
      seedRelays: string[];
      /** Nostr secret key for signing (reserved for future use -- e.g., signing REQ filters) */
      secretKey: Uint8Array;
      /**
       * Verifier instance (or mock) with verify method.
       * NOTE: The real AttestationVerifier.verify() takes TeeAttestation and returns
       * sync VerificationResult. The DI interface accepts NostrEvent (the raw attestation
       * event) and returns boolean | Promise<boolean> | VerificationResult to support
       * both the real verifier (after caller extracts TeeAttestation) and test mocks
       * (which return Promise<boolean> via mockResolvedValue).
       * The implementation normalizes via: await Promise.resolve(verifier.verify(event))
       */
      verifier: {
        verify: (attestation: NostrEvent) => boolean | VerificationResult | Promise<boolean | VerificationResult>;
        getState?: (...args: unknown[]) => unknown;
      };
      /** DI callback: query a relay for its kind:10033 attestation event */
      queryAttestation: (relayUrl: string) => Promise<NostrEvent | null>;
      /** DI callback: subscribe to a relay's kind:10032 peer info events */
      subscribePeers: (relayUrl: string) => Promise<NostrEvent[]>;
    }
    ```
  - [x] Define `AttestationBootstrapResult` interface:
    ```typescript
    export interface AttestationBootstrapResult {
      /** 'attested' if at least one seed relay passed verification, 'degraded' otherwise */
      mode: 'attested' | 'degraded';
      /** URL of the first seed relay that passed attestation (undefined in degraded mode) */
      attestedSeedRelay?: string;
      /** Peer info events discovered from attested seed relays */
      discoveredPeers: NostrEvent[];
    }
    ```
  - [x] Define `AttestationBootstrapEvent` type:
    ```typescript
    export type AttestationBootstrapEvent =
      | { type: 'attestation:seed-connected'; relayUrl: string }
      | { type: 'attestation:verified'; relayUrl: string; pubkey: string }
      | { type: 'attestation:verification-failed'; relayUrl: string; reason: string }
      | { type: 'attestation:peers-discovered'; relayUrl: string; peerCount: number }
      | { type: 'attestation:degraded'; triedCount: number };
    ```
  - [x] Implement `AttestationBootstrap` class with:
    - Constructor accepts `AttestationBootstrapConfig`
    - `on(listener)` / `off(listener)` for event registration (same pattern as `BootstrapService`)
    - `bootstrap()` method implementing the attestation-first flow:
      1. Iterate seed relays in order
      2. For each relay: emit `attestation:seed-connected`, call `queryAttestation(relayUrl)`
      3. If attestation is `null`, verification fails, or `queryAttestation` throws: emit `attestation:verification-failed`, continue to next relay
      4. If attestation passes: emit `attestation:verified`, call `subscribePeers(relayUrl)`, emit `attestation:peers-discovered`
      5. Return result with `mode: 'attested'`, the relay URL, and discovered peers
      6. If ALL relays fail: `console.warn('No attested seed relays found ...')`, emit `attestation:degraded`, return `mode: 'degraded'`
  - [x] The `verify()` call must handle both the existing `AttestationVerifier.verify()` return type (`VerificationResult` with `valid: boolean`) and the mock return type (`boolean`). Normalize to boolean check.
  - [x] The class must NOT own transport logic -- `queryAttestation` and `subscribePeers` are injected via DI callbacks. This keeps `AttestationBootstrap` a pure orchestration class, testable without WebSocket mocks.

- [x] Task 2: Add barrel exports (AC: #6)
  - [x] Export `AttestationBootstrap`, `AttestationBootstrapConfig`, `AttestationBootstrapResult`, `AttestationBootstrapEvent` from `packages/core/src/bootstrap/index.ts`
  - [x] Re-export from `packages/core/src/index.ts`

- [x] Task 3: Convert ATDD RED stubs to GREEN (AC: #1, #2, #3, #4, #5)
  - [x] In `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:
    - Uncomment `import { AttestationBootstrap }` (add this import pointing to `./AttestationBootstrap.js`)
    - Remove `it.skip()` from T-4.6-01 through T-4.6-05, replace with `it()`
    - Instantiate `AttestationBootstrap` with the config matching the test factories
    - The mock verifier shape (`{ verify, getState }`) is already defined in `createMockVerifier()` -- ensure `AttestationBootstrap` accepts this shape
    - T-4.6-01: Verify invocation call order (attestation query before peer subscription)
    - T-4.6-02: First relay returns `null`, second returns valid -- verify fallback
    - T-4.6-03: Happy path -- valid attestation, proceed to peer discovery, check result. **Add missing assertion: `expect(result.mode).toBe('attested')`** (required by AC #3 but absent from stub)
    - T-4.6-04: All relays return `null` -- degraded mode, warning logged, no subscribePeers calls
    - T-4.6-05: Full flow with lifecycle events emitted in correct order
  - [x] Story 4.1 tests (T-4.1-01 through T-4.1-04) and T-RISK-02 remain `it.skip()` -- they are already GREEN in `packages/core/src/build/oyster-config.test.ts` (Story 4.1 was completed separately)
  - [x] Add T-4.6-06 (barrel export verification): import all exports from `./index.js` and assert `AttestationBootstrap` is defined (following Story 4.4/4.5 pattern)

- [x] Task 4: Validate build and tests (AC: all)
  - [x] Run `pnpm build` -- must succeed with no errors
  - [x] Run `pnpm test` -- all existing tests must pass (0 regressions)
  - [x] Run `cd packages/core && pnpm test -- src/bootstrap/attestation-bootstrap.test.ts` -- T-4.6-01 through T-4.6-05 must be GREEN
  - [x] Run `pnpm lint` -- 0 errors (pre-existing warnings acceptable)

## Dev Notes

### Architecture Context

**Attestation-First Bootstrap Trust Flow (Decision 7):**
The bootstrap trust flow is the core security mechanism for the Crosstown network's decentralized peer discovery. Without attestation-first verification, a malicious actor could publish a kind:10036 seed relay list event on a public Nostr relay pointing to non-attested nodes, enabling man-in-the-middle attacks during bootstrap (R-E4-004, Score: 6 HIGH).

The flow is:
```
1. Read kind:10036 (seed list) from public Nostr relay     [Story 3.4 -- DONE]
2. Connect to seed relay WebSocket                          [This story]
3. Request kind:10033 (TEE attestation) from seed relay     [This story]
4. Verify PCR measurement against known-good image hash     [Story 4.3 -- DONE]
5. IF valid -> subscribe to kind:10032 events -> discover full network
6. IF invalid -> try next seed relay in list
```

**Decision 12 Invariant:** "Trust degrades; money doesn't." Payment channels remain open when attestation state transitions from `valid` to `stale` to `unattested`. The `AttestationBootstrap` class orchestrates the trust verification but never touches payment channel state.

**Graceful Degradation:** If ALL seed relays are unattested, the node starts in `degraded` mode -- it does NOT crash. This preserves network availability in scenarios where TEE infrastructure is temporarily unavailable. The node logs a warning and can be monitored via `/health`.

### Dependency Injection Pattern

`AttestationBootstrap` uses DI callbacks for `queryAttestation` and `subscribePeers` rather than owning transport logic. This is consistent with the project's approach:
- `BootstrapService` uses `SimplePool` and raw WebSocket internally (tightly coupled)
- `AttestationBootstrap` decouples orchestration from transport (loosely coupled)

This makes `AttestationBootstrap` fully testable with the mock functions already defined in the ATDD test file. The actual WebSocket transport for querying kind:10033 and subscribing to kind:10032 is a caller concern -- the Docker entrypoint or a future `BootstrapService` integration can provide these callbacks.

### Existing Files to Touch

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/bootstrap/AttestationBootstrap.ts` | **CREATE** | `AttestationBootstrap` class, config/result/event types |
| `packages/core/src/bootstrap/index.ts` | **MODIFY** | Add re-exports for `AttestationBootstrap` and types |
| `packages/core/src/index.ts` | **MODIFY** | Re-export `AttestationBootstrap` and types |
| `packages/core/src/bootstrap/attestation-bootstrap.test.ts` | **MODIFY** | Convert T-4.6-01 through T-4.6-05 from RED to GREEN, add T-4.6-06 barrel export test |

### Key Technical Constraints

1. **Pure orchestration class:** `AttestationBootstrap` does NOT create WebSocket connections, parse TOON events, or interact with the Nostr protocol. It receives callbacks (`queryAttestation`, `subscribePeers`) that handle transport. This is a deliberate design -- the existing `BootstrapService` already handles the WebSocket/TOON complexity; this class adds the attestation verification gate.

2. **Mock verifier compatibility:** The ATDD test file creates mock verifiers via `createMockVerifier()` which returns `{ verify: vi.fn().mockResolvedValue(boolean), getState: vi.fn() }`. The `AttestationBootstrap` must accept this shape -- the `verify` call may return `boolean | Promise<boolean> | VerificationResult | Promise<VerificationResult>`. Normalize: `const raw = await Promise.resolve(verifier.verify(event))`. Then: if result is `boolean`, use directly. If result is `{ valid: boolean }` (i.e., `VerificationResult`), use `.valid`. Note: the real `AttestationVerifier.verify()` takes `TeeAttestation` (not `NostrEvent`) and returns sync `VerificationResult`. The DI interface wraps this to accept the raw event, making callers responsible for extracting attestation data. The mock bypasses this by returning `Promise<boolean>` directly.

3. **Event ordering guarantee:** The tests assert that `queryAttestation` is called BEFORE `subscribePeers` using `mock.invocationCallOrder`. The implementation must be strictly sequential per relay -- no parallel attestation queries.

4. **Console.warn for degraded mode:** T-4.6-04 asserts `console.warn` is called with a string containing "No attested seed relays found". The implementation must use exactly `console.warn(...)` with a message matching this substring.

5. **TypeScript strict mode:** All code must satisfy `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, and all other strict checks from `tsconfig.json`.

6. **ESM only:** All imports use `.js` extensions (`import { AttestationBootstrap } from './AttestationBootstrap.js'`). No CommonJS.

7. **Extend CrosstownError for errors (if any):** Per enforcement guideline 4, any new error classes must extend `CrosstownError` from `../errors.js`. However, `AttestationBootstrap` is designed to not throw -- it degrades gracefully. Errors from callbacks are caught and trigger fallback to the next relay.

8. **Callback error handling:** The `queryAttestation` and `subscribePeers` callbacks may throw. The `bootstrap()` method must wrap each call in `try/catch` and treat thrown errors as equivalent to a failed attestation (emit `attestation:verification-failed` with the error message as reason, then continue to next relay). This is critical for robustness -- WebSocket connection failures, DNS resolution failures, and relay timeouts should not crash the bootstrap flow.

9. **`off()` method:** The `off(listener)` method follows the `BootstrapService` pattern (filter by reference equality). It is not covered by existing ATDD stubs but is part of the public API for lifecycle management. No new test required -- the pattern is established and the method is trivial.

### Anti-Patterns to Avoid

- **DO NOT create WebSocket connections** inside `AttestationBootstrap`. Transport is injected via DI.
- **DO NOT close payment channels** based on attestation state. "Trust degrades; money doesn't."
- **DO NOT crash when all seed relays are unattested.** Return `mode: 'degraded'` and log a warning.
- **DO NOT query relays in parallel.** The sequential order is important for fallback logic and test assertions.
- **DO NOT modify `BootstrapService`** in this story. `AttestationBootstrap` is a separate class that can be composed with `BootstrapService` by callers.
- **DO NOT create documentation files** -- use inline comments and JSDoc.
- **DO NOT modify the Story 4.1 tests** (T-4.1-01 through T-4.1-04) or T-RISK-02 -- they remain `it.skip` in this file (already GREEN elsewhere or deferred to integration).

### ATDD Test Stubs (Pre-existing RED Phase)

**File:** `packages/core/src/bootstrap/attestation-bootstrap.test.ts`

| Test ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| T-4.6-01 | Verifies kind:10033 attestation before trusting seed relay peer list | RED (it.skip) | P0 |
| T-4.6-02 | Falls back to next seed relay when first has invalid attestation | RED (it.skip) | P0 |
| T-4.6-03 | Proceeds to kind:10032 peer discovery when attestation is valid | RED (it.skip) | P1 |
| T-4.6-04 | Starts in degraded mode when all seed relays are unattested | RED (it.skip) | P1 |
| T-4.6-05 | Completes full attestation-first bootstrap flow | RED (it.skip) | P1 |
| T-4.6-06* | Barrel exports -- AttestationBootstrap importable from index | NEW (to be added in GREEN) | P1 |

\* T-4.6-06 is a new test ID to cover AC #6 (barrel exports) which had no ATDD stub. Follows the pattern from Stories 4.4 and 4.5.

**ATDD Stub Issues (must address during GREEN phase):**

- **Mock verifier shape:** The `createMockVerifier()` factory returns `{ verify: vi.fn().mockResolvedValue(boolean), getState: vi.fn() }`. Note that `verify` returns a **Promise<boolean>** (via `mockResolvedValue`), not a synchronous `VerificationResult`. The `AttestationBootstrap.bootstrap()` must `await` the verify result. Check: does the existing `AttestationVerifier.verify()` return sync or async? It returns **sync** `VerificationResult`. The mock returns **async** `boolean`. The implementation must handle both -- use `await Promise.resolve(verifier.verify(event))` to normalize.

- **Constructor signature:** The tests construct `new AttestationBootstrap({ seedRelays, secretKey, verifier, queryAttestation, subscribePeers })`. The config interface must match this exact shape.

- **Result shape:** T-4.6-03 asserts `result.discoveredPeers`, `result.attestedSeedRelay`, `result.mode`. T-4.6-04 asserts `result.mode === 'degraded'`, `result.attestedSeedRelay` is `undefined`, `result.discoveredPeers` equals `[]`. The `AttestationBootstrapResult` interface must define these fields.

- **T-4.6-03 gap:** The existing test stub for T-4.6-03 asserts `result.discoveredPeers` length and `result.attestedSeedRelay` but does NOT assert `result.mode === 'attested'`. Per AC #3, the result must include `mode: 'attested'`. Add `expect(result.mode).toBe('attested')` to T-4.6-03 during GREEN phase.

- **Event listener API:** T-4.6-05 calls `bootstrap.on((event) => events.push(event))`. The `on()` method must accept a callback of type `(event: AttestationBootstrapEvent) => void`.

- **Callback error handling:** The existing test stubs test only `null` returns from `queryAttestation` (T-4.6-02, T-4.6-04). The implementation must also catch thrown errors from `queryAttestation` and `subscribePeers` callbacks, treating them as failures and falling back to the next relay. This behavior is not currently covered by an ATDD stub but is implicitly required by AC #2 ("without crashing") and the anti-pattern "Errors from callbacks are caught and trigger fallback to the next relay". Consider adding a test case during GREEN phase that verifies `queryAttestation` throwing an Error triggers fallback.

- **`secretKey` field usage:** The `secretKey` field in `AttestationBootstrapConfig` is passed through by all test stubs but never used by the orchestration logic. It is reserved for future use (e.g., signing subscription requests) and maintains API consistency with the `BootstrapService` constructor pattern. The implementation should store it but does not need to use it.

- **Story 4.1 tests remain `it.skip`:** T-4.1-01 through T-4.1-04 and T-RISK-02 are in the same test file but are not part of Story 4.6. They are already GREEN in a separate test file (`oyster-config.test.ts`) or deferred to integration. Leave them as `it.skip`.

### Test Traceability

| Test ID | Test Name | AC | Location | Priority | Level | Phase |
|---------|-----------|----|---------|---------:|-------|-------|
| T-4.6-01 | Verifies kind:10033 before trusting peer list | #1 | `packages/core/src/bootstrap/attestation-bootstrap.test.ts` | P0 | Unit | GREEN |
| T-4.6-02 | Falls back to next seed relay on invalid attestation | #2 | `packages/core/src/bootstrap/attestation-bootstrap.test.ts` | P0 | Unit | GREEN |
| T-4.6-03 | Proceeds to kind:10032 discovery when valid | #3 | `packages/core/src/bootstrap/attestation-bootstrap.test.ts` | P1 | Unit | GREEN |
| T-4.6-04 | Degraded mode when all unattested | #4 | `packages/core/src/bootstrap/attestation-bootstrap.test.ts` | P1 | Unit | GREEN |
| T-4.6-05 | Full attestation-first bootstrap flow | #5 | `packages/core/src/bootstrap/attestation-bootstrap.test.ts` | P1 | Integration | GREEN |
| T-4.6-06* | Barrel exports -- AttestationBootstrap importable | #6 | `packages/core/src/bootstrap/attestation-bootstrap.test.ts` | P1 | Unit | GREEN |

### Project Structure Notes

- `AttestationBootstrap` goes in `packages/core/src/bootstrap/AttestationBootstrap.ts` (alongside `AttestationVerifier.ts` and `BootstrapService.ts`)
- The `bootstrap/` directory in core already contains the pre-existing ATDD test stubs and the AttestationVerifier from Story 4.3
- This story does NOT modify `BootstrapService.ts` -- `AttestationBootstrap` is a separate class that can be composed by callers
- The `events/attestation.ts` (Story 4.2) and `events/seed-relay.ts` (Story 3.4) modules provide the event parsing -- `AttestationBootstrap` receives parsed data via callbacks, not raw events

### Previous Story Intelligence (Story 4.5)

**Learnings from Story 4.5 (Nix Reproducible Builds):**
- Barrel export verification tests were added as a new test ID (T-4.5-05) during GREEN phase -- follow the same pattern for T-4.6-06
- The `CrosstownError` base class is in `packages/core/src/errors.ts` -- extend if any error classes needed
- Code review identified path traversal via `startsWith` prefix collision -- always use `path.sep` suffix check for path validation
- `RegExp.exec()` with global flag needs `lastIndex` reset -- avoid stateful regex patterns
- Mock approach: `vi.mock()` for external modules, direct mock objects for DI-injected dependencies
- The ATDD test file factory functions are at module scope and must compile even when tests are skipped

### Git Intelligence

**Recent commit pattern:** One commit per story with `feat(story-id): description` format.
- `feat(4-5): Nix reproducible builds -- NixBuilder, PCR verification, Dockerfile analysis`
- `feat(4-4): Nautilus KMS identity -- deriveFromKmsSeed in @crosstown/core`
- `feat(4-3): attestation-aware peering -- AttestationVerifier class`

**Expected commit:** `feat(4-6): attestation-first seed relay bootstrap -- AttestationBootstrap class`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- FR-TEE-6, Decision 12, Pattern 14]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 4.6: Attestation-First Seed Relay Bootstrap]
- [Source: _bmad-output/test-artifacts/test-design-epic-4.md -- R-E4-004 (Seed relay list poisoning, Score 6), T-4.6-01 through T-4.6-05]
- [Source: _bmad-output/test-artifacts/atdd-checklist-epic-4.md -- Story 4.6 test IDs, AttestationBootstrap module]
- [Source: _bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md -- Decision 7 (bootstrap trust flow)]
- [Source: packages/core/src/bootstrap/AttestationVerifier.ts -- AttestationVerifier class (Story 4.3)]
- [Source: packages/core/src/bootstrap/BootstrapService.ts -- Existing bootstrap service (event listener pattern reference)]
- [Source: packages/core/src/bootstrap/attestation-bootstrap.test.ts -- Pre-existing RED phase test stubs]
- [Source: packages/core/src/events/attestation.ts -- kind:10033 event builder/parser (Story 4.2)]
- [Source: packages/core/src/events/seed-relay.ts -- kind:10036 event builder/parser (Story 3.4)]
- [Source: packages/core/src/bootstrap/types.ts -- Bootstrap types and event patterns]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None required -- all tests passed on first run.

### Completion Notes List

- **Task 1 (AttestationBootstrap class):** Created `packages/core/src/bootstrap/AttestationBootstrap.ts` with `AttestationBootstrapConfig`, `AttestationBootstrapResult`, `AttestationBootstrapEvent`, `AttestationBootstrapEventListener` types and the `AttestationBootstrap` class. The class implements the attestation-first bootstrap flow: iterates seed relays sequentially, queries kind:10033 attestation via DI callback, normalizes verify result (handles boolean, Promise<boolean>, VerificationResult, Promise<VerificationResult>), falls back on null/failure/exception, and degrades gracefully when all relays fail. Event listener pattern (on/off) follows BootstrapService convention.
- **Task 2 (Barrel exports):** Added re-exports for `AttestationBootstrap`, `AttestationBootstrapConfig`, `AttestationBootstrapResult`, `AttestationBootstrapEvent`, `AttestationBootstrapEventListener` from `packages/core/src/bootstrap/index.ts` and `packages/core/src/index.ts`.
- **Task 3 (ATDD GREEN):** Converted T-4.6-01 through T-4.6-05 from RED (it.skip) to GREEN (it). Added T-4.6-06 barrel export verification test. All 6 tests pass. Added `expect(result.mode).toBe('attested')` to T-4.6-03 per AC #3 gap. Story 4.1 tests and T-RISK-02 remain it.skip as specified.
- **Task 4 (Validation):** `pnpm build` succeeds, `pnpm test` passes (1808 tests, 0 failures), `pnpm lint` passes (0 errors, 477 pre-existing warnings).

### File List

- `packages/core/src/bootstrap/AttestationBootstrap.ts` -- **CREATED** -- AttestationBootstrap class with config/result/event types
- `packages/core/src/bootstrap/attestation-bootstrap.test.ts` -- **MODIFIED** -- Converted T-4.6-01 through T-4.6-05 from RED to GREEN, added T-4.6-06
- `packages/core/src/bootstrap/index.ts` -- **MODIFIED** -- Added AttestationBootstrap barrel exports
- `packages/core/src/index.ts` -- **MODIFIED** -- Added AttestationBootstrap re-exports
- `_bmad-output/implementation-artifacts/4-6-attestation-first-seed-relay-bootstrap.md` -- **MODIFIED** -- Dev Agent Record populated

### Change Log

| Date | Summary |
|------|---------|
| 2026-03-15 | Story 4.6 implementation complete. Created AttestationBootstrap class implementing attestation-first seed relay bootstrap (FR-TEE-6). All 6 tests GREEN (T-4.6-01 through T-4.6-06). Build, full test suite (1808 tests), and lint all pass with 0 errors and 0 regressions. |

---

## Code Review Record

### Review Pass #1

| Field | Value |
|-------|-------|
| **Date** | 2026-03-15 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Status** | Success |
| **Critical Issues** | 0 |
| **High Issues** | 0 |
| **Medium Issues** | 0 |
| **Low Issues** | 1 |
| **Outcome** | Pass -- no blocking issues remain |

**Low Issues Found:**

1. **Prettier formatting inconsistency in test file** -- Fixed during review. No code logic impact.

### Review Pass #2

| Field | Value |
|-------|-------|
| **Date** | 2026-03-15 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Status** | Success |
| **Critical Issues** | 0 |
| **High Issues** | 0 |
| **Medium Issues** | 0 |
| **Low Issues** | 2 |
| **Outcome** | Pass -- no blocking issues remain |

**Low Issues Found:**

1. **Redundant `continue` statement** -- Removed unnecessary `continue` at end of loop body. No logic impact.
2. **Unused factory function and variable** -- Removed dead code (unused factory function and associated variable). No logic impact.

### Review Pass #3

| Field | Value |
|-------|-------|
| **Date** | 2026-03-15 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Status** | Success |
| **Critical Issues** | 0 |
| **High Issues** | 0 |
| **Medium Issues** | 3 |
| **Low Issues** | 5 |
| **Outcome** | Pass -- all issues fixed or documented |

**OWASP Top 10 + Security Assessment:** No injection risks, no authentication/authorization flaws, no SSRF vectors. Pure orchestration class with DI -- minimal attack surface.

**Medium Issues Found & Fixed:**

1. **M1: Unsafe type assertion in verifier result normalization (CWE-704)** -- `(raw as VerificationResult).valid` lacked type guard. Fixed: added explicit `typeof raw === 'object' && raw !== null && 'valid' in raw` check before accessing `.valid`. Defaults to `false` for unexpected types.
2. **M2: subscribePeers error emits misleading verification-failed event** -- When `subscribePeers` throws after attestation passes, the catch block emits `attestation:verification-failed`, which is semantically incorrect. Fixed: added JSDoc comment in catch block documenting this known simplification. Separate event type deferred.
3. **M3: Uncommitted changes from prior review passes** -- Story reported "done" but 3 files had uncommitted diffs. Flagged for process awareness.

**Low Issues Found & Fixed:**

1. **L1: secretKey stored but never used** -- Added `@remarks` JSDoc annotation explaining reserved-for-future-use rationale and API consistency.
2. **L2: No input validation on seedRelays URLs** -- Out of scope per DI pattern (transport is caller concern). Not fixed -- documented as accepted risk.
3. **L3: Listener array mutation during iteration safety** -- `emit()` iterated directly over `this.listeners`. Fixed: added defensive copy (`[...this.listeners]`) before iteration, consistent with robust event emitter patterns.
4. **L4: Test factory generates unrelated pubkey** -- `createValidAttestationEvent()` uses its own secretKey. Accepted -- `AttestationBootstrap` doesn't check pubkey provenance.
5. **L5: Prior review passes recorded but fixes uncommitted** -- Flagged for awareness.
