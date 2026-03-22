# Story 7.4: Fee-Per-Byte Advertisement in kind:10032

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **TOON node operator**,
I want to advertise my routing fee in kind:10032 peer info events,
So that senders can calculate the total cost of multi-hop routes.

**FRs covered:** FR-ADDR-4 (Fee-per-byte advertisement in kind:10032)

**Dependencies:** Story 7.3 (Multi-Address Support) -- extends the same kind:10032 event with a new field. Complete and merged.

**Decision sources:**
- Party Mode 2026-03-20 Prepaid Protocol Decisions: D7-004 (unified payment pattern) -- fee advertisement enables route-aware cost calculation
- Epic 7 test plan (test-design-epic-7.md): E7-R008 (score 6, fee advertisement vs actual fee inconsistency)

**Downstream dependencies:** Story 7.5 (SDK Route-Aware Fee Calculation) uses `feePerByte` from kind:10032 to compute total route cost. The route table service in 7.5 consumes the data exposed by this story.

## Acceptance Criteria

1. **Fee in kind:10032 event:** Given a node with `feePerByte: 2n` configured, when it publishes its kind:10032 peer info event, then the event includes `feePerByte: '2'` (serialized as a string for BigInt safety) alongside existing fields (`ilpAddresses`, `btpEndpoint`, `capabilities`).

2. **Default fee:** Given a node with no explicit fee configuration, when it publishes kind:10032, then `feePerByte` defaults to `'0'` (free routing).

3. **Backward compatibility with pre-Epic-7 consumers:** Given a kind:10032 event from a pre-Epic-7 node (no `feePerByte` field), when a consumer parses it via `parseIlpPeerInfo()`, then it defaults to `feePerByte: '0'` rather than erroring.

4. **Validation:** Given a `feePerByte` value that is negative, non-numeric, or contains decimals/scientific notation, when `buildIlpPeerInfoEvent()` is called, then it throws a `ToonError` with code `INVALID_FEE`. Only strings matching `/^\d+$/` (non-negative integer) are accepted. Similarly, `parseIlpPeerInfo()` throws `InvalidEventError` for malformed `feePerByte` values received from the network.

5. **Roundtrip integrity:** Given a kind:10032 event with `feePerByte: '2'`, when the event is built via `buildIlpPeerInfoEvent()` and parsed via `parseIlpPeerInfo()`, then `feePerByte` is preserved as `'2'` without loss or corruption.

6. **Peer discovery:** Given a peer subscribing to kind:10032 events on the relay, when it receives a kind:10032 event with `feePerByte: '5'`, then it can extract the fee value for use in route cost calculation (Story 7.5).

## Tasks / Subtasks

- [x] Task 1: Extend `IlpPeerInfo` type with `feePerByte` field (AC: #1, #2, #3)
  - [x] 1.1 Add `feePerByte?: string` optional field to `IlpPeerInfo` in `packages/core/src/types.ts`. Type is `string` (not `bigint`) because JSON serialization does not support BigInt natively. The string represents a non-negative integer. Optional for backward compatibility -- pre-Epic-7 events will not have this field.
  - [x] 1.2 Add JSDoc comment: `/** Routing fee per byte charged by this node as an intermediary, serialized as a non-negative integer string (e.g., '2'). Defaults to '0' (free routing) when absent. */`

- [x] Task 2: Update kind:10032 event builder to validate `feePerByte` (AC: #1, #4, #5)
  - [x] 2.1 In `buildIlpPeerInfoEvent()` in `packages/core/src/events/builders.ts`, add validation before serialization: if `feePerByte` is provided, validate it is a string representing a non-negative integer. Use a regex check (`/^\d+$/`) to ensure it contains only digits (no negative sign, no decimals, no scientific notation). Throw `ToonError` with code `INVALID_FEE` and a descriptive message if validation fails.
  - [x] 2.2 Verify that `JSON.stringify(effectiveInfo)` already serializes all `IlpPeerInfo` fields including `feePerByte` -- no structural changes needed to serialization. The `feePerByte` field is included automatically when present on the input object.

- [x] Task 3: Update kind:10032 event parser to extract `feePerByte` (AC: #2, #3, #4, #5, #6)
  - [x] 3.1 In `parseIlpPeerInfo()` in `packages/core/src/events/parsers.ts`, extract `feePerByte` from the destructured `parsed` object (add it to the existing destructuring alongside `ilpAddress`, `btpEndpoint`, `rawIlpAddresses`, etc.).
  - [x] 3.2 If `feePerByte` is absent (pre-Epic-7 event), default to `'0'` (free routing).
  - [x] 3.3 If `feePerByte` is present, validate it is a string matching `/^\d+$/`. Throw `InvalidEventError` if validation fails (e.g., negative value, non-numeric string, wrong type).
  - [x] 3.4 Include `feePerByte` in the returned `IlpPeerInfo` object.

- [x] Task 4: Extend `NodeConfig` to accept `feePerByte` (AC: #1, #2)
  - [x] 4.1 Add `feePerByte?: bigint` field to `NodeConfig` in `packages/sdk/src/create-node.ts`. The config accepts `bigint` for ergonomic use in TypeScript; it is serialized to string when building the `ilpInfo` object.
  - [x] 4.2 In `createNode()`, when constructing the `ilpInfo` object (around line 647), add `feePerByte: String(config.feePerByte ?? 0n)` to include the fee in kind:10032 events.

- [x] Task 5: Unit tests for kind:10032 `feePerByte` builder (AC: #1, #4, #5)
  - [x] 5.1 Test: `buildIlpPeerInfoEvent()` with `feePerByte: '2'` includes `feePerByte` in event content (T-7.4-01). File: `packages/core/src/events/builders.test.ts`.
  - [x] 5.2 Test: `buildIlpPeerInfoEvent()` with `feePerByte: '2'` -> parse -> `feePerByte` preserved as `'2'` (T-7.4-02 roundtrip). File: `packages/core/src/events/builders.test.ts`.
  - [x] 5.3 Test: `buildIlpPeerInfoEvent()` with negative fee string (e.g., `'-1'`) throws `ToonError` with code `INVALID_FEE` (T-7.4-05). File: `packages/core/src/events/builders.test.ts`.
  - [x] 5.4 Test: `buildIlpPeerInfoEvent()` with non-numeric fee string (e.g., `'abc'`) throws `ToonError` (T-7.4-05). File: `packages/core/src/events/builders.test.ts`.
  - [x] 5.5 Test: `buildIlpPeerInfoEvent()` with `feePerByte: '0'` succeeds (zero fee is valid). File: `packages/core/src/events/builders.test.ts`.
  - [x] 5.6 Test: `buildIlpPeerInfoEvent()` with `feePerByte` and existing fields (`ilpAddresses`, `btpEndpoint`, etc.) -- all fields coexist without interference (T-7.4-06). File: `packages/core/src/events/builders.test.ts`.
  - [x] 5.7 Test: large `feePerByte` value (e.g., `'999999999999'`) preserved through build/parse roundtrip (T-7.4-08). File: `packages/core/src/events/builders.test.ts`.

- [x] Task 6: Unit tests for kind:10032 `feePerByte` parser (AC: #2, #3, #4, #5)
  - [x] 6.1 Test: `parseIlpPeerInfo()` extracts `feePerByte: '2'` from event content (T-7.4-01 parser side). File: `packages/core/src/events/parsers.test.ts`.
  - [x] 6.2 Test: `parseIlpPeerInfo()` on pre-Epic-7 event (no `feePerByte` field) defaults to `'0'` (T-7.4-07). File: `packages/core/src/events/parsers.test.ts`.
  - [x] 6.3 Test: `parseIlpPeerInfo()` with `feePerByte: 'abc'` throws `InvalidEventError` (T-7.4-05). File: `packages/core/src/events/parsers.test.ts`.
  - [x] 6.4 Test: `parseIlpPeerInfo()` with `feePerByte: -1` (number, not string) throws `InvalidEventError`. File: `packages/core/src/events/parsers.test.ts`.
  - [x] 6.5 Test: default `feePerByte` when not configured: `'0'` (free routing) (T-7.4-03). File: `packages/core/src/events/parsers.test.ts`.

- [x] Task 7: Unit tests for SDK `NodeConfig.feePerByte` (AC: #1, #2)
  - [x] 7.1 Test: `createNode({ feePerByte: 2n, ... })` includes `feePerByte: '2'` in published kind:10032 event. File: `packages/sdk/src/create-node.test.ts`.
  - [x] 7.2 Test: `createNode({})` with no `feePerByte` config includes `feePerByte: '0'` in `ilpInfo` (default free routing). File: `packages/sdk/src/create-node.test.ts`.

- [x] Task 8: Integration test for peer fee discovery (AC: #6)
  - [x] 8.1 Test: peer discovers `feePerByte` via kind:10032 subscription, extracts fee for route calculation (T-7.4-04). This validates the full flow: node publishes kind:10032 with `feePerByte` -> peer receives event -> parses `feePerByte` correctly. File: `packages/core/src/events/builders.test.ts` (can be unit-level using build + parse).

- [x] Task 9: Export verification and build (AC: all)
  - [x] 9.1 Verify `feePerByte` is part of the `IlpPeerInfo` type exported from `@toon-protocol/core`
  - [x] 9.2 Run `pnpm build && pnpm test` -- all existing tests must pass plus new tests

## Dev Notes

### Architecture and Constraints

**This story adds a single field (`feePerByte`) to the existing kind:10032 event structure.** It is the simplest story in Chain B (Fee Infrastructure), providing the data foundation that Story 7.5 builds upon for route-aware fee calculation.

**BigInt-as-string serialization:** JSON does not support BigInt natively. The `feePerByte` field is stored as a string representation of a non-negative integer (e.g., `'2'`, `'0'`, `'999999999999'`). The `NodeConfig` accepts `bigint` for TypeScript ergonomics and converts to string via `String()` when building the `ilpInfo` object. Consumers parse the string back to `bigint` when needed (Story 7.5 responsibility).

**Backward compatibility strategy:**
- `IlpPeerInfo.feePerByte` is optional -- when absent (pre-Epic-7 events), the parser defaults to `'0'`
- `buildIlpPeerInfoEvent()` includes `feePerByte` in the serialized JSON when present on the input object (no special handling needed -- `JSON.stringify` handles it)
- All existing code that does not reference `feePerByte` continues to work unchanged
- The field coexists with `ilpAddress`, `ilpAddresses`, `btpEndpoint`, `capabilities`, and all settlement fields

**kind:10032 serialization note:** Same as Story 7.3 -- `buildIlpPeerInfoEvent()` serializes `IlpPeerInfo` via `JSON.stringify(info)` into the Nostr event's `content` field. `parseIlpPeerInfo()` parses it back via `JSON.parse()`. This is standard JSON serialization, not TOON binary encoding.

**File changes (all modifications to existing files, no new files):**
- `packages/core/src/types.ts` -- add `feePerByte?: string` to `IlpPeerInfo`
- `packages/core/src/events/builders.ts` -- add validation for `feePerByte` (non-negative integer string)
- `packages/core/src/events/parsers.ts` -- extract `feePerByte` from parsed content with `'0'` default
- `packages/sdk/src/create-node.ts` -- add `feePerByte?: bigint` to `NodeConfig`, serialize into `ilpInfo`
- Tests in existing test files: `builders.test.ts`, `parsers.test.ts`, `create-node.test.ts`

**Error codes introduced:**
- `INVALID_FEE` -- `feePerByte` string is not a valid non-negative integer

**What this story does NOT include:**
- Route table service or fee aggregation across hops (Story 7.5)
- Fee enforcement at intermediary nodes (Story 7.5 -- the intermediary deducting its fee from the PREPARE amount)
- Fee display in health endpoint or UI
- The `amount` override mechanism in `publishEvent()` (Story 7.6)

### What Already Exists (DO NOT Recreate)

- **`IlpPeerInfo`** in `packages/core/src/types.ts` -- current type with `ilpAddress`, `ilpAddresses`, `btpEndpoint`, settlement fields. Extend with `feePerByte?: string`.
- **`buildIlpPeerInfoEvent()`** in `packages/core/src/events/builders.ts` -- constructs kind:10032 events via `JSON.stringify(info)`. Add `feePerByte` validation before serialization.
- **`parseIlpPeerInfo()`** in `packages/core/src/events/parsers.ts` -- parses kind:10032 events via `JSON.parse()`. Add `feePerByte` extraction with backward-compatible default.
- **`createNode()`** in `packages/sdk/src/create-node.ts` -- builds `ilpInfo` object at ~line 647. Add `feePerByte` serialization.
- **`NodeConfig`** in `packages/sdk/src/create-node.ts` -- already has `basePricePerByte?: bigint`. Add `feePerByte?: bigint` with same pattern.
- **`ToonError`** in `packages/core/src/errors.ts` -- base error class. Use for validation errors.
- **`InvalidEventError`** in `packages/core/src/errors.ts` -- parsing error class. Use for malformed events.
- **`BootstrapService`** in `packages/core/src/bootstrap/BootstrapService.ts` -- publishes kind:10032 events using `ilpInfo`. The `feePerByte` field propagates automatically via `JSON.stringify(info)` in the builder.

### Testing Approach

Follow the standard unit test pattern. Tests go in existing test files:
- `packages/core/src/events/builders.test.ts` -- new describe block for `feePerByte` kind:10032 (Tasks 5.1-5.7)
- `packages/core/src/events/parsers.test.ts` -- new describe block for `feePerByte` parsing (Tasks 6.1-6.5)
- `packages/sdk/src/create-node.test.ts` -- new describe block for `feePerByte` config (Tasks 7.1-7.2)
- Task 8.1 (peer discovery) is a build+parse roundtrip in `builders.test.ts` (unit-level, no live infra needed)

Expected test count: ~15 tests (7 builder + 5 parser + 2 SDK + 1 discovery roundtrip).

**Test plan coverage mapping (T-7.4-xx to tasks):**
- T-7.4-01 (U, P0): Tasks 5.1, 6.1
- T-7.4-02 (U, P0): Task 5.2
- T-7.4-03 (U, P0): Tasks 6.2, 6.5
- T-7.4-04 (I, P0): Task 8.1 (downgraded to unit-level build+parse roundtrip)
- T-7.4-05 (U, P1): Tasks 5.3, 5.4, 6.3, 6.4
- T-7.4-06 (U, P1): Task 5.6
- T-7.4-07 (U, P1): Task 6.2
- T-7.4-08 (U, P2): Task 5.7

**Deferred tests:** None -- all T-7.4-xx tests are covered at unit level. No live infrastructure required.

### Risk Mitigation

**E7-R008 (Fee advertisement vs actual fee inconsistency, score 6):** This story only covers the advertisement side. The enforcement side (intermediary actually deducting the advertised fee) is Story 7.5's responsibility. T-7.4-04 validates that a peer can discover the advertised fee; the integration test in 7.5 will validate that the advertised fee matches the actual deduction.

## Dev Agent Record

- **Agent Model Used:** Claude Opus 4.6 (1M context)
- **Completion Notes List:**
  - Task 1: `feePerByte?: string` field added to `IlpPeerInfo` interface with JSDoc comment in `packages/core/src/types.ts`
  - Task 2: `feePerByte` validation added to `buildIlpPeerInfoEvent()` in `packages/core/src/events/builders.ts` -- validates non-negative integer string via `/^\d+$/` regex, throws `ToonError` with code `INVALID_FEE` on failure
  - Task 3: `feePerByte` extraction added to `parseIlpPeerInfo()` in `packages/core/src/events/parsers.ts` -- defaults to `'0'` when absent (backward compatibility), throws `InvalidEventError` for malformed values
  - Task 4: `feePerByte?: bigint` added to `NodeConfig` in `packages/sdk/src/create-node.ts`, serialized to string via `String(config.feePerByte ?? 0n)` in `ilpInfo` construction
  - Task 5: 9 builder unit tests added (including 2 extra edge cases: decimal and scientific notation rejection)
  - Task 6: 5 parser unit tests added covering extraction, backward compatibility, and validation
  - Task 7: 2 SDK unit tests added verifying `createNode` with and without `feePerByte` config
  - Task 8: Peer discovery roundtrip test added as unit-level build+parse in builders.test.ts
  - Task 9: Verified `IlpPeerInfo` exported from `@toon-protocol/core`; `pnpm build` succeeds; all 113 tests pass across the 3 test files
- **File List:**
  - `packages/core/src/types.ts` (modified)
  - `packages/core/src/events/builders.ts` (modified)
  - `packages/core/src/events/parsers.ts` (modified)
  - `packages/sdk/src/create-node.ts` (modified)
  - `packages/core/src/events/builders.test.ts` (modified)
  - `packages/core/src/events/parsers.test.ts` (modified)
  - `packages/sdk/src/create-node.test.ts` (modified)
- **Change Log:**
  - 2026-03-21: Story 7.4 verified complete. All implementation (Tasks 1-4) and tests (Tasks 5-9) were already in place from prior development. Verified build passes, all 113 tests pass across builders.test.ts, parsers.test.ts, and create-node.test.ts. Marked all tasks complete and added Dev Agent Record.

## Code Review Record

### Review Pass #1
- **Date:** 2026-03-21
- **Reviewer Model:** Claude Opus 4.6 (1M context)
- **Issues Found:**
  - Critical: 0
  - High: 0
  - Medium: 0
  - Low: 1 — Missing `@throws` JSDoc for `INVALID_FEE` on `buildIlpPeerInfoEvent()`
- **Fix Applied:** Added `@throws {ToonError} With code \`INVALID_FEE\` if \`feePerByte\` is not a non-negative integer string` JSDoc tag to `buildIlpPeerInfoEvent()` in `packages/core/src/events/builders.ts`
- **Outcome:** Pass — all issues resolved, no follow-up actions required

### Review Pass #2
- **Date:** 2026-03-21
- **Reviewer Model:** Claude Opus 4.6 (1M context)
- **Issues Found:**
  - Critical: 0
  - High: 0
  - Medium: 0
  - Low: 0
- **Fix Applied:** None — no issues found
- **Outcome:** Pass — no issues found, code is clean

### Review Pass #3
- **Date:** 2026-03-21
- **Reviewer Model:** Claude Opus 4.6 (1M context)
- **Issues Found:**
  - Critical: 0
  - High: 0
  - Medium: 0
  - Low: 0
- **Fix Applied:** None — no issues found
- **Security Review:** OWASP review passed clean
- **Outcome:** Pass (final) — no issues found, story complete
