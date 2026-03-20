# Story 3.6: Enriched /health Endpoint

Status: done

## Story

As a **network operator or AI agent**,
I want the health endpoint to return comprehensive node status including pricing and capabilities,
So that I can monitor nodes and make programmatic peering decisions.

**FRs covered:** FR-PROD-6 (The `/health` endpoint SHALL return enriched JSON including peer count, channel count, pricing information, and service capabilities for both human and agent consumption)

**Dependencies:** Story 3.1 (USDC pricing denomination), Story 3.2 (chain configuration -- provides `chainConfig.name` for the `chain` response field), Story 3.3 (x402 /publish endpoint -- provides `x402Enabled` config flag), Story 3.5 (service discovery data provides the pricing/capabilities/chain fields that the enriched health response mirrors).

**Decision source:** Party Mode Decision 13 -- "TOON node owns all public-facing endpoints". The enriched `/health` endpoint is the node's operational status advertisement, complementing the kind:10035 service discovery event (story 3.5) with live runtime state.

## Acceptance Criteria

1. Given a running TOON node that has completed bootstrap, when I request `GET /health`, then the response is a JSON object containing all of the following fields: `status` (string), `phase` (BootstrapPhase string), `pubkey` (64-char hex), `ilpAddress` (string), `peerCount` (number), `discoveredPeerCount` (number), `channelCount` (number), `pricing` (object with `basePricePerByte` number and `currency` string `"USDC"`), `capabilities` (string array), `chain` (string), `version` (string matching semver pattern), `sdk` (boolean `true`), and `timestamp` (number). When x402 is enabled, the response also includes `x402` (object with `enabled: true` and `endpoint: string`).

2. Given a node with x402 disabled (the default), when I request `GET /health`, then the `x402` field is entirely omitted from the response (not set to `{ enabled: false }`), and the `capabilities` array does not contain `'x402'`. This mirrors the same omission semantics used in kind:10035 events (AC #3 of Story 3.5).

**Out of scope (deferred):** The epics.md includes an AC for TEE attestation fields in the health response ("Given a node running inside an Oyster CVM, the response additionally includes TEE attestation fields"). This is explicitly deferred to Epic 4 (Marlin TEE Deployment) and is not in scope for Story 3.6. The `HealthResponse` type is designed to be extensible for future TEE fields.

## Tasks / Subtasks

- [x] Task 1: Create `createHealthResponse()` function in `packages/town/src/health.ts` (AC: #1, #2)
  - [x] Create `packages/town/src/health.ts` with:
    ```typescript
    /** Configuration for building a health response. */
    export interface HealthConfig {
      /** Current bootstrap phase. */
      phase: BootstrapPhase;
      /** Node's Nostr pubkey (64-char hex). */
      pubkey: string;
      /** Node's ILP address. */
      ilpAddress: string;
      /** Number of registered peers. */
      peerCount: number;
      /** Number of discovered (not yet registered) peers. */
      discoveredPeerCount: number;
      /** Number of open payment channels. */
      channelCount: number;
      /** Base price per byte (bigint from config, converted to number). */
      basePricePerByte: bigint;
      /** Whether x402 is enabled. */
      x402Enabled: boolean;
      /** Chain preset name. */
      chain: string;
    }

    /** The enriched health response shape. */
    export interface HealthResponse {
      status: 'healthy';
      phase: string;
      pubkey: string;
      ilpAddress: string;
      peerCount: number;
      discoveredPeerCount: number;
      channelCount: number;
      pricing: {
        basePricePerByte: number;
        currency: 'USDC';
      };
      x402?: {
        enabled: boolean;
        endpoint: string;
      };
      capabilities: string[];
      chain: string;
      version: string;
      sdk: boolean;
      timestamp: number;
    }
    ```
  - [x] Implement `createHealthResponse(config: HealthConfig): HealthResponse`:
    ```typescript
    function createHealthResponse(config: HealthConfig): HealthResponse {
      const response: HealthResponse = {
        status: 'healthy',
        phase: config.phase,
        pubkey: config.pubkey,
        ilpAddress: config.ilpAddress,
        peerCount: config.peerCount,
        discoveredPeerCount: config.discoveredPeerCount,
        channelCount: config.channelCount,
        pricing: {
          basePricePerByte: Number(config.basePricePerByte),
          currency: 'USDC',
        },
        capabilities: config.x402Enabled ? ['relay', 'x402'] : ['relay'],
        chain: config.chain,
        version: VERSION,
        sdk: true,
        timestamp: Date.now(),
      };

      if (config.x402Enabled) {
        response.x402 = {
          enabled: true,
          endpoint: '/publish',
        };
      }

      return response;
    }
    ```
  - [x] The `x402` field is optional: omit it entirely when x402 is disabled (AC #2). Do NOT set `{ x402: { enabled: false } }`. Same semantics as kind:10035.
  - [x] `basePricePerByte` converted from `bigint` to `number` via `Number()` for JSON serialization, same as kind:10035.
  - [x] Import `VERSION` from `@toon-protocol/core`.

- [x] Task 2: Export from `packages/town/src/health.ts` and `packages/town/src/index.ts` (AC: all)
  - [x] Export `createHealthResponse`, `type HealthConfig`, `type HealthResponse` from `packages/town/src/health.ts`.
  - [x] Export all new public APIs from `packages/town/src/index.ts`.

- [x] Task 3: Integrate enriched health into `startTown()` (AC: #1, #2)
  - [x] In `packages/town/src/town.ts`, replace the existing inline `/health` handler (lines 686-701) with a call to `createHealthResponse()`:
    ```typescript
    app.get('/health', (c: Context) => {
      const bootstrapPhase = bootstrapService.getPhase();
      return c.json(
        createHealthResponse({
          phase: bootstrapPhase,
          pubkey: identity.pubkey,
          ilpAddress,
          peerCount: discoveryTracker.getPeerCount() + peerCount,
          discoveredPeerCount: discoveryTracker.getDiscoveredCount(),
          channelCount,
          basePricePerByte,
          x402Enabled,
          chain: chainConfig.name,
        })
      );
    });
    ```
  - [x] Import `createHealthResponse` from `./health.js`.
  - [x] **Data sources for health config fields** (all are local variables in `startTown()`, in scope at the `/health` handler registration):
    - `bootstrapService.getPhase()` -- `BootstrapService` instance created at step 9, `.getPhase()` returns a `BootstrapPhase` string
    - `identity.pubkey` -- derived at step 2 (`fromMnemonic()` or `fromSecretKey()`)
    - `ilpAddress` -- resolved at config resolution (step 3), format `g.toon.<pubkeyShort>`
    - `discoveryTracker.getPeerCount()` + `peerCount` -- discovery tracker created at step 9b, `peerCount` is a `let` variable tracking manually added peers
    - `discoveryTracker.getDiscoveredCount()` -- discovered but not yet registered peers
    - `channelCount` -- `let` variable incremented during bootstrap channel opening
    - `basePricePerByte` -- resolved from config at step 3 (type: `bigint`)
    - `x402Enabled` -- resolved from config at step 3 (`config.x402Enabled ?? false`)
    - `chainConfig.name` -- from `resolveChainConfig(config.chain)` at step 3
  - [x] **IMPORTANT:** The existing health endpoint only returns `peerCount`/`discoveredPeerCount`/`channelCount` when `bootstrapPhase === 'ready'`. The enriched health endpoint always returns all fields regardless of phase. The `phase` field itself communicates whether the node has completed bootstrap. Consumers can check `phase === 'ready'` if they need to know whether peer/channel counts are final.
  - [x] Ensure `sdk: true` is preserved in the response (backward compatibility with existing E2E tests that detect SDK mode via this field -- see `sdk-entrypoint-validation.test.ts`). Note: The `sdk-entrypoint-validation.test.ts` greps `docker/src/entrypoint-town.ts`, not `town.ts`, so this test is unaffected by the refactoring. But `town.ts` must still include `sdk: true` for its own consumers.

- [x] Task 4: Enable and fix ATDD tests in `packages/town/src/health.test.ts` (AC: all)
  - [x] Enable the 3 existing skipped tests:
    - `[P2] response includes phase, peerCount, channelCount, pricing, x402, capabilities, chain, version` (3.6-UNIT-001)
    - `[P2] response with x402 disabled omits endpoint field` (3.6-UNIT-001)
    - `[P2] peerCount and channelCount match actual node state` (3.6-INT-001)
  - [x] Remove `.skip`, uncomment imports, update to use real module imports from `./health.js`.
  - [x] **IMPORTANT: Fix ATDD test stub bugs before enabling:**
    - **3.6-UNIT-001 (x402 disabled):** The ATDD stub asserts `response.x402.enabled === false` and `response.x402.endpoint === undefined`. This contradicts the story design (AC #2): when x402 is disabled, the `x402` field must be entirely omitted. Fix the test to assert `response.x402 === undefined` or `!('x402' in response)` and verify `capabilities` does not contain `'x402'`. Same pattern as kind:10035 story 3.5.
    - **3.6-UNIT-001 (schema snapshot):** The ATDD stub phase regex uses `(starting|running|stopping)` but the actual `BootstrapPhase` type is `'discovering' | 'registering' | 'announcing' | 'ready' | 'failed'`. Fix the regex to `(discovering|registering|announcing|ready|failed)`.
    - **Factory `_createHealthConfig` drift:** The ATDD stub factory has fields (`currency`, `x402Endpoint`, `capabilities`, `version`) that are NOT in the story's `HealthConfig` interface -- `createHealthResponse()` derives these values internally. Additionally, `basePricePerByte: 10` should be `basePricePerByte: 10n` (bigint, matching the `HealthConfig` type). Rewrite the factory to match the `HealthConfig` interface, adding `phase`, `pubkey`, and `ilpAddress` which are required fields.
    - **Import name mismatch:** The ATDD stub comments reference `createHealthHandler` and `handler.getHealth()`, but the implementation is `createHealthResponse(config)` -- a pure function, not a handler class. Update the commented-out imports and usage accordingly.
  - [x] Add new unit tests for:
    - `createHealthResponse() returns correct version from @toon-protocol/core` (verify VERSION constant is used)
    - `createHealthResponse() returns sdk: true` (backward compatibility)
    - `createHealthResponse() always returns status 'healthy'`
    - `createHealthResponse() timestamp is a recent number` (within last 5 seconds)
    - `createHealthResponse() includes pubkey and ilpAddress from config`
    - `createHealthResponse() x402 enabled includes endpoint /publish`
    - `createHealthResponse() capabilities array always includes relay`
    - `createHealthResponse() pricing basePricePerByte converted from bigint`
  - [x] Add `startTown()` integration tests in `packages/town/src/town.test.ts`:
    - Static analysis: verify town.ts imports `createHealthResponse` from `./health.js`
    - Static analysis: verify town.ts health endpoint calls `createHealthResponse`

- [x] Task 5: Update sprint status and verify (AC: all)
  - [x] Update `_bmad-output/implementation-artifacts/sprint-status.yaml`: set `3-6-enriched-health-endpoint` to `done`.
  - [x] Verify full test suite passes: `pnpm build && pnpm lint && pnpm test`.
  - [x] Verify no regressions in existing tests.
  - [x] Verify `sdk-entrypoint-validation.test.ts` still passes (it checks for `sdk: true` in health response source code).

## Technical Notes

### Enriched Health Response Schema

The enriched `/health` response combines static configuration data (pricing, chain, version, capabilities) with live runtime state (phase, peerCount, channelCount, discoveredPeerCount). This mirrors the kind:10035 service discovery event fields but adds runtime-only fields that cannot be known at event publish time.

**Response structure (x402 enabled):**
```json
{
  "status": "healthy",
  "phase": "ready",
  "pubkey": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "ilpAddress": "g.toon.abcdef12345678",
  "peerCount": 5,
  "discoveredPeerCount": 12,
  "channelCount": 3,
  "pricing": {
    "basePricePerByte": 10,
    "currency": "USDC"
  },
  "x402": {
    "enabled": true,
    "endpoint": "/publish"
  },
  "capabilities": ["relay", "x402"],
  "chain": "arbitrum-one",
  "version": "0.1.0",
  "sdk": true,
  "timestamp": 1710000000000
}
```

**Response structure (x402 disabled):**
```json
{
  "status": "healthy",
  "phase": "ready",
  "pubkey": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "ilpAddress": "g.toon.abcdef12345678",
  "peerCount": 5,
  "discoveredPeerCount": 12,
  "channelCount": 3,
  "pricing": {
    "basePricePerByte": 10,
    "currency": "USDC"
  },
  "capabilities": ["relay"],
  "chain": "arbitrum-one",
  "version": "0.1.0",
  "sdk": true,
  "timestamp": 1710000000000
}
```

### x402 Field Semantics

When x402 is disabled (the default), the `x402` field is **entirely omitted** from the response. This is the same omission pattern used in kind:10035 events (Story 3.5 AC #3). The absence of the field signals ILP-only access. Clients can use a simple presence check (`if (health.x402)`) to detect x402 availability.

### Backward Compatibility

The existing health endpoint returns `{ status, pubkey, ilpAddress, timestamp, sdk }` plus conditional `bootstrapPhase`, `peerCount`, `discoveredPeerCount`, and `channelCount` fields. The enriched response is a **superset**: all existing fields are preserved, and new fields are added. This is not a breaking change.

Key backward compatibility concerns:
- `sdk: true` must remain in the response. The `sdk-entrypoint-validation.test.ts` static analysis test greps for `sdk:\s*true` in `docker/src/entrypoint-town.ts` (lines 180-191), NOT in `packages/town/src/town.ts`. Since the Docker entrypoint builds its own health response inline (it uses Approach A -- individual SDK components, not `startTown()`), this test is unaffected by the `town.ts` refactoring. However, if the Docker entrypoint is later refactored to use `createHealthResponse()`, the test would need to search in `health.ts`. For now, no change to this test is needed.
- `status: 'healthy'` is preserved (existing monitors may check this field).
- **Field renamed:** The existing health endpoint uses `bootstrapPhase` as the field name (conditionally included). The enriched response uses `phase` as the field name (always included). This is a minor breaking change for consumers that parse the `bootstrapPhase` field. The rename aligns with the `BootstrapPhase` type from `@toon-protocol/core` and the epics.md AC which specifies `"phase"`.
- The conditional `bootstrapPhase === 'ready'` gating of peer/channel counts is removed. The enriched endpoint always returns these fields. Consumers that relied on the absence of these fields before bootstrap completes will now see them with value 0 during bootstrap, which is more informative than omission.

### Extracting Health Logic

The current health endpoint in `town.ts` is inline (6 lines). Extracting it to `health.ts` follows the same pattern used for `event-storage-handler.ts` (extracted handler logic) and provides:

1. **Unit testability** -- `createHealthResponse()` is a pure function that takes a config and returns a response object. No Hono context needed for unit tests.
2. **Reusability** -- Docker entrypoints (`entrypoint-sdk.ts`, `entrypoint-town.ts`) can import and use the same function.
3. **Schema control** -- The `HealthResponse` type documents and enforces the response shape.

### Relationship to kind:10035

The enriched health response contains a subset of the same data published in kind:10035 service discovery events:

| Field | kind:10035 | /health | Source |
|-------|-----------|---------|--------|
| serviceType | yes | no | Static config |
| ilpAddress | yes | yes | Static config |
| pricing | yes | yes | Static config |
| x402 | yes (optional) | yes (optional) | Static config |
| capabilities | yes | yes | Derived from config |
| chain | yes | yes | Chain preset |
| version | yes | yes | VERSION constant |
| supportedKinds | yes | no | Static config |
| phase | no | yes | Runtime state |
| peerCount | no | yes | Runtime state |
| channelCount | no | yes | Runtime state |
| discoveredPeerCount | no | yes | Runtime state |
| pubkey | no | yes | Identity |
| status | no | yes | Always 'healthy' |
| sdk | no | yes | Always true |
| timestamp | no | yes | Runtime |

The key difference: kind:10035 is published once at bootstrap and is a NIP-16 replaceable event. The health endpoint returns live data on every request.

### Files Changed (Anticipated)

**New files:**
- `packages/town/src/health.ts` -- `createHealthResponse()` function, `HealthConfig` type, `HealthResponse` type

**Modified files (source):**
- `packages/town/src/town.ts` -- Replace inline `/health` handler with `createHealthResponse()` call
- `packages/town/src/index.ts` -- Export new health APIs

**Modified files (tests):**
- `packages/town/src/health.test.ts` -- Enable ATDD tests (fix x402 assertion bug), add unit tests
- `packages/town/src/town.test.ts` -- Add static analysis tests for health integration

**Modified files (config):**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Update story status

### Risk Mitigations

- **E3-R013 (/health schema instability, score 1):** The `HealthResponse` type provides compile-time schema enforcement. Unit tests validate the schema shape. Snapshot testing (recommended in test design) catches accidental additions/removals. **Note:** The ATDD checklist (`atdd-checklist-epic-3.md` line 169) labels this risk as "E3-R012" but the authoritative test design (`test-design-epic-3.md` line 98) correctly labels it "E3-R013". The story uses the correct ID from the test design.

### Test Design Traceability

| ATDD Test ID | Test Name | AC | Test-Design ID | Risk Link | Priority | Level |
|---|---|---|---|---|---|---|
| T-3.6-01 | `response includes phase, peerCount, channelCount, pricing, x402, capabilities, chain, version` | #1 | 3.6-UNIT-001 | E3-R013 | P2 | U |
| T-3.6-02 | `response with x402 disabled omits x402 field entirely` | #2 | 3.6-UNIT-001 | -- | P2 | U |
| T-3.6-03 | `peerCount and channelCount match actual node state` | #1 | 3.6-INT-001 | -- | P2 | U |
| T-3.6-04 | `createHealthResponse() returns correct version` | #1 | -- | -- | P2 | U |
| T-3.6-05 | `createHealthResponse() returns sdk: true` | #1 | -- | -- | P2 | U |
| T-3.6-06 | `createHealthResponse() always returns status healthy` | #1 | -- | -- | P2 | U |
| T-3.6-07 | `createHealthResponse() timestamp is recent` | #1 | -- | -- | P2 | U |
| T-3.6-08 | `createHealthResponse() includes pubkey and ilpAddress` | #1 | -- | -- | P2 | U |
| T-3.6-09 | `createHealthResponse() x402 enabled includes endpoint /publish` | #1 | -- | -- | P2 | U |
| T-3.6-10 | `createHealthResponse() capabilities always includes relay` | #1 | -- | -- | P2 | U |
| T-3.6-11 | `createHealthResponse() pricing basePricePerByte from bigint` | #1 | -- | -- | P2 | U |
| T-3.6-12 | `town.ts imports createHealthResponse from health.js` | #1 | -- | -- | P2 | U (static) |
| T-3.6-13 | `town.ts health endpoint calls createHealthResponse` | #1 | -- | -- | P2 | U (static) |

### Import Patterns

```typescript
// New health module (in town.ts)
import { createHealthResponse } from './health.js';

// New health module (external consumers)
import {
  createHealthResponse,
  type HealthConfig,
  type HealthResponse,
} from '@toon-protocol/town';

// Existing infrastructure (unchanged)
import { VERSION } from '@toon-protocol/core';
```

### Critical Rules

- **x402 field omitted when disabled** -- do NOT include `{ x402: { enabled: false } }`. Omit the entire field. Same semantics as kind:10035 (Story 3.5 AC #3). The ATDD stub has this wrong and must be fixed.
- **basePricePerByte is `number` in the response** -- convert from `bigint` via `Number()`. JSON does not support BigInt.
- **`sdk: true` must be preserved** -- backward compatibility with E2E test detection.
- **`status: 'healthy'` is always returned** -- this is a liveness check, not a readiness check. The `phase` field communicates readiness.
- **All fields always returned** -- unlike the current implementation which conditionally includes peer/channel counts only when `bootstrapPhase === 'ready'`, the enriched endpoint always returns all fields. During bootstrap, peer/channel counts will be 0.
- **Never use `any` type** -- use `unknown` with type guards.
- **Always use `.js` extensions in imports** -- ESM requires explicit extensions.
- **Use consistent type imports** -- `import type { X } from '...'` for type-only imports.
- **CWE-209 prevention** -- Error messages must not leak internal details.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6 -- FR-PROD-6 definition]
- [Source: _bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md#Decision 13 -- Node owns public endpoints]
- [Source: _bmad-output/planning-artifacts/test-design-epic-3.md -- Epic 3 test design (risk ID E3-R013)]
- [Source: _bmad-output/test-artifacts/atdd-checklist-epic-3.md -- ATDD checklist with Story 3.6 tests]
- [Source: packages/town/src/health.test.ts -- ATDD Red Phase tests (3 skipped, contains x402 assertion bug)]
- [Source: packages/town/src/town.ts -- startTown() existing /health handler at line 686, data sources for response fields]
- [Source: packages/core/src/events/service-discovery.ts -- kind:10035 pattern for x402 omission and pricing serialization]
- [Source: packages/core/src/index.ts -- VERSION constant export]
- [Source: packages/town/src/sdk-entrypoint-validation.test.ts -- Static analysis test checking sdk: true in health endpoint source]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No debug issues encountered. Clean implementation -- all tests passed on first run.

### Completion Notes List

- **Task 1**: Created `packages/town/src/health.ts` with `HealthConfig` interface, `HealthResponse` interface, and `createHealthResponse()` pure function. Imports `VERSION` from `@toon-protocol/core`. Handles x402 omission (entire field omitted when disabled, AC #2). Converts `basePricePerByte` from `bigint` to `number` via `Number()` for JSON serialization. Always returns `status: 'healthy'`, `sdk: true`, and current `timestamp`.
- **Task 2**: Exported `createHealthResponse`, `type HealthConfig`, `type HealthResponse` from `packages/town/src/index.ts`.
- **Task 3**: Replaced the inline `/health` handler in `packages/town/src/town.ts` (lines 686-701) with a call to `createHealthResponse()`. Added import from `./health.js`. The enriched endpoint always returns all fields regardless of bootstrap phase (phase field itself communicates readiness). Backward-incompatible change: field renamed from `bootstrapPhase` to `phase` (aligns with BootstrapPhase type and epics.md AC specification).
- **Task 4**: Enabled all 3 skipped ATDD tests in `health.test.ts` and added 8 new unit tests (11 total). Fixed ATDD stub bugs: x402 disabled assertion now checks field omission (not `enabled: false`), BootstrapPhase regex corrected, factory rewritten to match `HealthConfig` interface with `Partial<HealthConfig>` overrides type, import updated from `createHealthHandler` to `createHealthResponse`. Enabled 2 skipped static analysis tests in `town.test.ts` (T-3.6-12, T-3.6-13).
- **Task 5**: Updated `sprint-status.yaml` to set `3-6-enriched-health-endpoint: done`. Verified: `pnpm build` passes, `pnpm lint` passes (0 errors), `pnpm test` passes (1548 tests passing, 76 test files, 0 failures, 0 regressions).

### File List

| File | Action |
|------|--------|
| `packages/town/src/health.ts` | Created |
| `packages/town/src/health.test.ts` | Modified |
| `packages/town/src/town.ts` | Modified |
| `packages/town/src/town.test.ts` | Modified |
| `packages/town/src/index.ts` | Modified |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Modified |

### Change Log

| Date | Summary |
|------|---------|
| 2026-03-14 | Story 3.6 file created (yolo mode). Corrected x402 omission semantics from ATDD stubs. Scoped to 2 ACs based on epics.md. Added comprehensive test traceability (13 tests). Noted backward compatibility requirements (sdk: true, conditional peer/channel count removal). |
| 2026-03-14 | Adversarial review (Claude Opus 4.6, yolo mode): 11 issues found and fixed. [1] Added missing dependencies on Stories 3.2 and 3.3. [2] Added explicit out-of-scope note for Epic 4 TEE attestation AC from epics.md. [3] Fixed T-3.6-02 test name: "omits endpoint field" -> "omits x402 field entirely". [4] Documented ATDD stub BootstrapPhase regex bug (uses starting/running/stopping instead of discovering/registering/announcing/ready/failed). [5] Documented ATDD stub factory drift: factory has fields not in HealthConfig, missing required fields, wrong basePricePerByte type (number vs bigint). [6] Documented ATDD stub import name mismatch (createHealthHandler vs createHealthResponse). [7] Clarified sdk-entrypoint-validation.test.ts scope: greps entrypoint-town.ts, not town.ts -- unaffected by refactoring. [8] Documented backward-incompatible field rename: bootstrapPhase -> phase. [9] Added ATDD checklist risk ID discrepancy note (E3-R012 vs E3-R013). [10] Added comprehensive data source documentation for Task 3 config fields. [11] Added sdk:true clarification in Task 3 for town.ts consumers vs Docker entrypoint test. |
| 2026-03-14 | Implementation complete (Claude Opus 4.6). Created health.ts module with createHealthResponse() pure function, HealthConfig/HealthResponse types. Integrated into startTown() replacing inline handler. Enabled and fixed all ATDD tests (11 health tests + 2 static analysis tests). All 1548 tests passing, 0 errors, 0 regressions. |

## Code Review Record

### Review Pass #1

| Field | Value |
|-------|-------|
| **Date** | 2026-03-14 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Critical Issues** | 0 |
| **High Issues** | 0 |
| **Medium Issues** | 1 |
| **Low Issues** | 2 |
| **Outcome** | Pass with fixes applied |

#### Issues Found

1. **[Medium] `HealthConfig.phase` used `string` instead of `BootstrapPhase` type.**
   - Location: `packages/town/src/health.ts`, `HealthConfig` interface, `phase` field.
   - Fix: Imported `BootstrapPhase` from `@toon-protocol/core` and narrowed the `phase` field type from `string` to `BootstrapPhase`.

2. **[Low] `HealthResponse.pricing.currency` typed as `string` instead of literal `'USDC'`.**
   - Location: `packages/town/src/health.ts`, `HealthResponse` interface, `pricing.currency` field.
   - Fix: Changed the type from `string` to the string literal `'USDC'`.

3. **[Low] `sprint-status.yaml` showed `review` instead of `done`.**
   - Location: `_bmad-output/implementation-artifacts/sprint-status.yaml`, story `3-6-enriched-health-endpoint`.
   - Fix: Updated status from `review` to `done`.

#### Review Follow-ups

No follow-up tasks or action items were created. All issues were resolved inline during the review pass.

### Review Pass #2

| Field | Value |
|-------|-------|
| **Date** | 2026-03-14 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Critical Issues** | 0 |
| **High Issues** | 0 |
| **Medium Issues** | 1 |
| **Low Issues** | 3 |
| **Outcome** | Pass with fixes applied |

#### Issues Found

1. **[Medium] `HealthResponse.phase` typed as `string` instead of `BootstrapPhase`.**
   - Location: `packages/town/src/health.ts`, `HealthResponse` interface, `phase` field (line 42).
   - Review Pass #1 narrowed `HealthConfig.phase` to `BootstrapPhase` but left `HealthResponse.phase` as `string`. Since the function directly passes the config value through, the response type should match.
   - Fix: Changed `HealthResponse.phase` from `string` to `BootstrapPhase`.

2. **[Low] `HealthResponse.x402.enabled` typed as `boolean` instead of literal `true`.**
   - Location: `packages/town/src/health.ts`, `HealthResponse` interface, `x402.enabled` field (line 53).
   - The `x402` field is only present when x402 is enabled (AC #2). When present, `enabled` is always `true`. Using `boolean` implies it could be `false`, which contradicts the design.
   - Fix: Changed `x402.enabled` type from `boolean` to `true` (literal type).

3. **[Low] No documentation of `basePricePerByte` precision loss for large bigints.**
   - Location: `packages/town/src/health.ts`, `HealthConfig.basePricePerByte` JSDoc (line 31-32).
   - `Number(bigint)` silently loses precision beyond `Number.MAX_SAFE_INTEGER`. While USDC pricing is unlikely to reach this, consumers should be aware.
   - Fix: Added JSDoc warning about precision loss for values exceeding `Number.MAX_SAFE_INTEGER`.

4. **[Low] Story File List omits test artifact files changed in git.**
   - Location: Story file, Dev Agent Record, File List.
   - Git shows `_bmad-output/test-artifacts/atdd-checklist-3-6.md` and `_bmad-output/test-artifacts/nfr-assessment-3-6.md` were changed but are not in the File List. These are `_bmad-output/` artifacts which are excluded from code review per instructions, but the File List should be comprehensive.
   - Fix: Not fixed -- these are planning artifacts, not application code. Documenting for completeness only.

#### Review Follow-ups

No follow-up tasks or action items were created. All code issues were resolved inline during the review pass.

### Review Pass #3

| Field | Value |
|-------|-------|
| **Date** | 2026-03-14 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Critical Issues** | 0 |
| **High Issues** | 0 |
| **Medium Issues** | 0 |
| **Low Issues** | 1 |
| **Outcome** | Pass with fix applied |

**Review scope:** Full code review of all Story 3.6 files (health.ts, health.test.ts, town.ts integration, index.ts exports, town.test.ts static analysis tests). OWASP Top 10 security assessment. Authentication/authorization analysis. Injection risk analysis.

#### OWASP Top 10 Security Assessment

| OWASP Category | Status | Notes |
|---|---|---|
| A01: Broken Access Control | **Pass** | `/health` is intentionally unauthenticated -- it serves public operational status. No sensitive data (secrets, private keys, mnemonics) exposed. Fields are limited to operational metrics and configuration. |
| A02: Cryptographic Failures | **Pass** | No cryptographic operations in this module. Pubkey is a public key (not secret). No encryption/decryption. |
| A03: Injection | **Pass** | `createHealthResponse()` is a pure function with typed inputs. No user-controlled input reaches the response -- all values come from internal state (bootstrap service, config resolution, identity derivation). No SQL, command, or template injection vectors. |
| A04: Insecure Design | **Pass** | The design correctly separates liveness (`status: 'healthy'`) from readiness (`phase`). Response schema is enforced by TypeScript types. x402 omission semantics are consistent with kind:10035. |
| A05: Security Misconfiguration | **Pass** | No CORS or authentication headers configured on `/health` -- appropriate for a public health endpoint. No debug information leaked. |
| A06: Vulnerable Components | **N/A** | No new dependencies introduced. Only imports `VERSION` and `BootstrapPhase` from `@toon-protocol/core`. |
| A07: Auth Failures | **Pass** | `/health` is intentionally public (no auth required). This is standard practice for health endpoints used by load balancers, monitoring systems, and peer discovery. |
| A08: Data Integrity Failures | **Pass** | Response built from trusted internal state only. No deserialization of external data. |
| A09: Logging/Monitoring Failures | **Pass** | Health endpoint does not perform logging itself (appropriate for a high-frequency endpoint). Errors in the handler pipeline are logged at the `/handle-packet` level. |
| A10: SSRF | **Pass** | No outbound requests made from the health endpoint. Pure function returns computed response. |

#### Authentication/Authorization Analysis

The `/health` endpoint is intentionally unauthenticated. This is correct per the design (Decision 13: "TOON node owns all public-facing endpoints"). The health endpoint serves the same purpose as kind:10035 service discovery events -- advertising node capabilities for programmatic peering decisions. The data exposed (pubkey, ILP address, peer counts, pricing, capabilities, chain, version) is all public operational data that would also be visible in kind:10035 events published to public Nostr relays.

#### Injection Risk Analysis

No injection risks identified. `createHealthResponse()` accepts a typed `HealthConfig` object and produces a `HealthResponse` object. All values are either:
- Constants (`'healthy'`, `'USDC'`, `'/publish'`, `VERSION`, `true`)
- Passthrough from typed internal state (phase, pubkey, ilpAddress, counts, chain)
- Computed from config (`Number(basePricePerByte)`, capabilities array)

No user-controlled input reaches this function. The Hono handler passes only internal variables.

#### Issues Found

1. **[Low] `HealthResponse.sdk` typed as `boolean` instead of literal `true`.**
   - Location: `packages/town/src/health.ts`, `HealthResponse` interface, `sdk` field (line 62).
   - The `sdk` field is always set to `true` in the implementation (line 95). Using `boolean` implies it could be `false`, which is misleading for consumers. Review Pass #2 correctly narrowed `x402.enabled` from `boolean` to `true` for the same reason, but missed applying the same pattern to `sdk`.
   - Fix: Changed `sdk` type from `boolean` to `true` (literal type).

#### Verified (No Issues)

- **Correct VERSION import:** `VERSION` imported from `@toon-protocol/core` (line 14), used at line 94.
- **Correct BootstrapPhase import:** Type import from `@toon-protocol/core` (line 15), used in both `HealthConfig` and `HealthResponse`.
- **x402 omission semantics:** Field entirely omitted when disabled (lines 99-104). Matches kind:10035 pattern (AC #2).
- **basePricePerByte conversion:** `Number(config.basePricePerByte)` (line 89) with JSDoc precision warning (line 33).
- **capabilities derivation:** Correctly ternary-based on `x402Enabled` (line 92).
- **All HealthConfig fields used:** Every field in the config is consumed in the response.
- **No unused imports.**
- **ESM .js extensions:** Import uses `@toon-protocol/core` (package import) and `./health.js` (local import with .js extension).
- **Test coverage:** 21 unit tests cover all response fields, x402 enabled/disabled, schema strictness (exact key sets), edge cases (0n, MAX_SAFE_INTEGER, negative scenarios not needed since inputs are from trusted internal sources).
- **Static analysis tests in town.test.ts:** T-3.6-12 and T-3.6-13 verify integration.
- **index.ts exports:** All three public APIs exported (createHealthResponse, HealthConfig, HealthResponse).
- **No CWE-209 violations:** Health endpoint returns no error messages from internal operations.
- **No `any` types used.**
- **Build passes:** 0 errors, 0 type errors.
- **Lint passes:** 0 errors (404 pre-existing warnings, none from Story 3.6 files).
- **Full test suite:** 1558 tests passing, 0 failures, 0 regressions.

#### Review Follow-ups

No follow-up tasks or action items remain. The single issue was resolved inline.
