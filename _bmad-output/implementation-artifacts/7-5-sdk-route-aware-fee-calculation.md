# Story 7.5: SDK Route-Aware Fee Calculation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **SDK user calling `publishEvent()`**,
I want the SDK to automatically calculate and include intermediary routing fees,
So that the recipient receives the correct write fee without me knowing about multi-hop costs.

**FRs covered:** FR-ADDR-5 (SDK route-aware fee calculation, invisible to users)

**Dependencies:** Story 7.4 (Fee-Per-Byte Advertisement in kind:10032) -- provides `feePerByte` in `IlpPeerInfo` consumed by the route table. Complete and merged.

**Decision sources:**
- Party Mode 2026-03-20 Prepaid Protocol Decisions: D7-004 (unified payment pattern) -- fee calculation enables transparent multi-hop pricing
- Epic 7 test plan (test-design-epic-7.md): E7-R009 (score 6, fee calculation drift from stale route table), E7-R010 (score 3, fee calculation overflow), E7-R011 (score 4, route discovery failure)

**Downstream dependencies:** Story 7.6 (Prepaid DVM Model) adds `amount` override to `publishEvent()`. The fee calculation from this story composes with the `amount` override -- when `amount` is specified, route fees are added on top of the user-specified destination amount rather than on top of `basePricePerByte * bytes`.

## Acceptance Criteria

1. **Single-hop fee calculation (unchanged behavior):** Given a direct single-hop publish with no intermediaries, when the SDK computes the ILP PREPARE amount, then `amount = basePricePerByte * toonBytes.length` (identical to current behavior -- zero intermediary fees).

2. **Multi-hop fee calculation:** Given a publish from a sender to a destination traversing two intermediaries with `feePerByte: '2'` and `feePerByte: '3'`, when the SDK computes the ILP PREPARE amount, then `amount = (basePricePerByte * toonBytes.length) + (2n * BigInt(toonBytes.length)) + (3n * BigInt(toonBytes.length))`. The destination receives `basePricePerByte * toonBytes.length` after intermediary fee deduction.

3. **Zero-fee intermediary:** Given a route with a zero-fee intermediary (`feePerByte: '0'`) between fee-charging hops, when the SDK computes the amount, then the zero-fee hop contributes 0 to the total (correctly handled, not skipped or errored).

4. **Fee calculation is invisible to the user:** Given the fee calculation, when the user calls `publishEvent(event, { destination })`, then no fee parameters are exposed to the user -- the fee math is completely SDK-internal. The `publishEvent()` API signature does not change.

5. **Route table from discovered peers:** Given a `DiscoveryTracker` that has processed kind:10032 events from intermediary nodes (each with `feePerByte`), when the fee calculator resolves a route, then it uses the discovered peer info to determine intermediary fees along the route path.

6. **Unknown intermediary default:** Given a route through an intermediary node whose kind:10032 event has not been discovered (no peer info available), when the SDK computes the fee, then it defaults to `feePerByte: 0n` for that hop and logs a warning. The publish is not blocked.

## Tasks / Subtasks

- [x] Task 1: Create `calculateRouteAmount()` pure function (AC: #1, #2, #3)
  - [x] 1.1 Create `packages/core/src/fee/calculate-route-amount.ts` with `calculateRouteAmount(params: { basePricePerByte: bigint; packetByteLength: number; hopFees: bigint[] }): bigint`. This is a pure function with no external dependencies.
  - [x] 1.2 Implement: `amount = basePricePerByte * BigInt(packetByteLength) + hopFees.reduce((sum, fee) => sum + fee * BigInt(packetByteLength), 0n)`. Each hop's fee is proportional to the packet byte length.
  - [x] 1.3 Handle edge cases: empty `hopFees` array (direct route, no intermediaries), zero-byte packet (amount = 0n), zero `basePricePerByte` (only intermediary fees).
  - [x] 1.4 Create `packages/core/src/fee/index.ts` barrel file exporting `calculateRouteAmount`.
  - [x] 1.5 Export `calculateRouteAmount` from `packages/core/src/index.ts`.

- [x] Task 2: Create `resolveRouteFees()` function to extract fees from discovered peers (AC: #5, #6)
  - [x] 2.1 Create `packages/core/src/fee/resolve-route-fees.ts` with `resolveRouteFees(params: { destination: string; ownIlpAddress: string; discoveredPeers: DiscoveredPeer[] }): { hopFees: bigint[]; warnings: string[] }`. Takes an array of `DiscoveredPeer` (matching the `DiscoveryTracker.getDiscoveredPeers()` return type). Internally builds a lookup structure keyed by ILP address for O(1) prefix matching.
  - [x] 2.2 Implement route resolution algorithm:
    1. Split `ownIlpAddress` and `destination` into segments (e.g., `g.toon.useast.client1` -> `['g', 'toon', 'useast', 'client1']`).
    2. Find the longest common prefix (LCA) between the two addresses.
    3. Intermediary hops are the segments between the LCA and the destination (exclusive of both sender and destination themselves). For each intermediary segment, reconstruct its ILP address prefix (e.g., `g.toon.euwest`).
    4. For each intermediary prefix, search `discoveredPeers` for a peer whose `peerInfo.ilpAddress` matches (or whose `peerInfo.ilpAddresses` array contains the prefix).
    5. Extract `BigInt(peer.peerInfo.feePerByte ?? '0')` for matched peers.
  - [x] 2.3 For unknown intermediaries (no matching `DiscoveredPeer`), default to `feePerByte: 0n` and add a warning string (e.g., `'Unknown intermediary at g.toon.abcd1234: defaulting feePerByte to 0'`).
  - [x] 2.4 Export `resolveRouteFees` from the barrel file.

- [x] Task 3: Integrate fee calculation into `publishEvent()` (AC: #1, #2, #4)
  - [x] 3.1 In `packages/sdk/src/create-node.ts`, in the `publishEvent()` method (around line 1134), replace the simple `amount = (config.basePricePerByte ?? 10n) * BigInt(toonData.length)` with a call to `calculateRouteAmount()` that includes intermediary fees.
  - [x] 3.2 Wire `resolveRouteFees()` into `publishEvent()`: pass the destination address, own ILP address (from `ilpInfo.ilpAddress`), and the discovery tracker's peer list via `discoveryTrackerInstance.getDiscoveredPeers()` to resolve intermediary fees. **Important:** `getDiscoveredPeers()` returns only un-peered discovered peers. For fee calculation, we also need fee data from peered peers. Either: (a) add a new `getAllDiscoveredPeers()` method to `DiscoveryTracker` that returns all peers regardless of peering status, or (b) maintain a separate fee cache in `publishEvent()` scope. Option (a) is preferred -- add the method in this story.
  - [x] 3.3 Log any warnings from `resolveRouteFees()` (unknown intermediaries) using `console.warn` with `[publishEvent]` prefix.
  - [x] 3.4 Ensure the `publishEvent()` API signature does not change -- no new parameters for fee control.

- [x] Task 4: Unit tests for `calculateRouteAmount()` (AC: #1, #2, #3)
  - [x] 4.1 Test: direct route (empty `hopFees`) -> `amount = basePricePerByte * packetByteLength` (T-7.5-01). File: `packages/core/src/fee/calculate-route-amount.test.ts`.
  - [x] 4.2 Test: 2-hop route with fees `[2n, 3n]`, `basePricePerByte = 10n`, 100 bytes -> `amount = (10 * 100) + (2 * 100) + (3 * 100) = 1500` (T-7.5-02). File: same.
  - [x] 4.3 Test: 3-hop route with fees `[0n, 5n, 1n]` -> zero-fee hop contributes 0 (T-7.5-03). File: same.
  - [x] 4.4 Test: large packet (65536 bytes), 10 hops, max fee 1000n per byte -> no overflow, correct total (T-7.5-08). File: same.
  - [x] 4.5 Test: zero-byte packet -> amount = 0n regardless of fees (T-7.5-09). File: same.
  - [x] 4.6 Test: zero `basePricePerByte` with non-zero hop fees -> only intermediary fees charged. File: same.

- [x] Task 5: Unit tests for `resolveRouteFees()` (AC: #5, #6)
  - [x] 5.1 Test: sender and destination share a direct parent (single hop, no intermediaries) -> empty `hopFees` (T-7.5-06). File: `packages/core/src/fee/resolve-route-fees.test.ts`.
  - [x] 5.2 Test: 2-hop route with known intermediary -> `hopFees` includes the intermediary's `feePerByte` (T-7.5-06). File: same.
  - [x] 5.3 Test: unknown intermediary in route -> `hopFees` includes `0n` for that hop, warnings array contains the warning message (T-7.5-07). File: same.
  - [x] 5.4 Test: route with multiple known intermediaries -> fees extracted in correct order. File: same.
  - [x] 5.5 Test: destination is own address (self-publish) -> empty `hopFees`. File: same.
  - [x] 5.6 Test: intermediary with `ilpAddresses` array (multi-address from Story 7.3) -> matched by any address in the array. File: same.

- [x] Task 6: Unit tests for `publishEvent()` fee integration (AC: #1, #2, #4)
  - [x] 6.1 Test: `publishEvent()` with direct destination -> ILP PREPARE amount = `basePricePerByte * toonBytes.length` (unchanged behavior, T-7.5-01). File: `packages/sdk/src/publish-event.test.ts` (existing file).
  - [x] 6.2 Test: `publishEvent()` with multi-hop destination and known intermediary fees -> ILP PREPARE amount includes intermediary fees (T-7.5-04). File: same.
  - [x] 6.3 Test: `publishEvent()` API signature has no fee parameters -> TypeScript compilation enforces this (T-7.5-04). File: same.

- [x] Task 7: Route table update test (AC: #5)
  - [x] 7.1 Test: intermediary publishes new kind:10032 with updated `feePerByte` -> discovery tracker processes update -> subsequent `resolveRouteFees()` call reflects new fee (T-7.5-10). File: `packages/core/src/fee/resolve-route-fees.test.ts`.

- [x] Task 8: Add `getAllDiscoveredPeers()` to `DiscoveryTracker` (AC: #5)
  - [x] 8.1 Add `getAllDiscoveredPeers(): DiscoveredPeer[]` method to the `DiscoveryTracker` interface in `packages/core/src/bootstrap/discovery-tracker.ts`. This returns all discovered peers regardless of peering status (unlike `getDiscoveredPeers()` which filters out peered peers). Fee calculation needs fee data from ALL discovered peers, including those already peered with.
  - [x] 8.2 Implement: `return [...discoveredPeers.values()]` (no filter).
  - [x] 8.3 Update Task 3.2 to use `getAllDiscoveredPeers()` instead of `getDiscoveredPeers()`.

- [x] Task 9: Export verification and build (AC: all)
  - [x] 9.1 Verify `calculateRouteAmount` and `resolveRouteFees` are exported from `@toon-protocol/core`.
  - [x] 9.2 Run `pnpm build && pnpm test` -- all existing tests must pass plus new tests.

## Dev Notes

### Architecture and Constraints

**This story introduces two new pure functions and wires them into `publishEvent()`.** The fee calculation is completely SDK-internal -- no new parameters or options are exposed to the user. The `publishEvent()` API signature remains unchanged.

**Formula:** `totalAmount = basePricePerByte * packetBytes + SUM(hopFees[i] * packetBytes)` where `hopFees[i]` is the `feePerByte` from each intermediary's kind:10032 event. The result is a `bigint` passed to `buildIlpPrepare()` which converts to string via `String(amount)`.

**Route resolution algorithm (LCA-based):** ILP addresses form a tree. To determine intermediary hops between sender and destination:
1. Split both addresses into segments on `.` delimiter.
2. Find the longest common ancestor (LCA) -- the longest shared prefix of segments.
3. The intermediaries are the nodes on the path from LCA down to the destination's parent. For each segment beyond the LCA up to (but not including) the destination's final segment, reconstruct the ILP address prefix and look up its fee.
4. Example: sender `g.toon.useast.client1`, destination `g.toon.euwest.relay42`. LCA = `g.toon`. Path down: `g.toon.euwest` is the only intermediary. Look up `g.toon.euwest` in discovered peers.
5. Example: sender `g.toon.useast.client1`, destination `g.toon.useast.relay42`. LCA = `g.toon.useast`. No intermediaries (direct route under same parent).

**Peer matching for intermediaries:** For each intermediary ILP address prefix, search `discoveredPeers` for a peer whose `peerInfo.ilpAddress` matches OR whose `peerInfo.ilpAddresses` array (Story 7.3, multi-address) contains the prefix. This handles multi-peered nodes that have multiple addresses.

**Direct route detection:** If the sender's ILP address shares the same parent prefix as the destination (e.g., both under `g.toon.useast`), and no segments diverge before the final segment, then it is a direct route with no intermediary fees.

**DiscoveryTracker peer access (CRITICAL):** The `DiscoveryTracker.getDiscoveredPeers()` method returns `DiscoveredPeer[]` (an array, NOT a Map) and **filters out already-peered peers**. For fee calculation, we need fee data from ALL known peers (including peered ones). This story adds `getAllDiscoveredPeers()` which returns all peers without filtering. The internal `discoveredPeers` map is keyed by pubkey (not ILP address), so `resolveRouteFees()` must build its own ILP-address-keyed lookup from the array.

**Unknown intermediary handling (Design Decision Q2):** Per test plan design question Q2, the decision is to default unknown intermediaries to `feePerByte: 0n` with a logged warning. This avoids blocking publishes when peer discovery is incomplete but does carry the risk of underpayment (the packet may be rejected at the intermediary if it actually charges a fee). This trade-off is documented and acceptable for v1.

**BigInt safety:** All fee arithmetic uses `bigint` natively. The `feePerByte` string from `IlpPeerInfo` is parsed to `bigint` via `BigInt(feePerByte ?? '0')`. The `calculateRouteAmount()` function operates entirely in `bigint` space -- no floating point, no overflow risk.

**File changes:**
- `packages/core/src/fee/calculate-route-amount.ts` (new) -- pure fee calculation function
- `packages/core/src/fee/resolve-route-fees.ts` (new) -- route resolution from discovered peers
- `packages/core/src/fee/index.ts` (new) -- barrel file
- `packages/core/src/index.ts` (modified) -- export new fee functions
- `packages/core/src/bootstrap/discovery-tracker.ts` (modified) -- add `getAllDiscoveredPeers()` method to interface and implementation
- `packages/sdk/src/create-node.ts` (modified) -- integrate fee calculation into `publishEvent()`
- Tests in new and existing test files

**What this story does NOT include:**
- `amount` override on `publishEvent()` (Story 7.6)
- Fee enforcement at intermediary nodes (intermediaries deducting their fee from the PREPARE amount before forwarding)
- Re-fetch/retry on stale fee rejection (future enhancement)
- Fee display in health endpoint

### What Already Exists (DO NOT Recreate)

- **`publishEvent()`** in `packages/sdk/src/create-node.ts` (line ~1111) -- current implementation at line 1134 computes `amount = (config.basePricePerByte ?? 10n) * BigInt(toonData.length)`. The result is passed to `buildIlpPrepare()` which converts to string. Modify to use `calculateRouteAmount()`.
- **`buildIlpPrepare()`** in `packages/core/src/x402/build-ilp-prepare.ts` -- constructs ILP PREPARE packets. Takes `amount: bigint | number` and converts to string via `String(params.amount)`. No changes needed.
- **`DiscoveryTracker`** in `packages/core/src/bootstrap/discovery-tracker.ts` -- interface + factory function `createDiscoveryTracker()`. Internal `discoveredPeers` is a `Map<string, DiscoveredPeer>` keyed by **pubkey** (not ILP address). Public API: `getDiscoveredPeers(): DiscoveredPeer[]` (returns array, filters out peered peers). This story adds `getAllDiscoveredPeers()`.
- **`DiscoveredPeer`** in `packages/core/src/bootstrap/types.ts` -- has `peerInfo: IlpPeerInfo`, `pubkey: string`, `peerId: string`, `discoveredAt: number`.
- **`IlpPeerInfo`** in `packages/core/src/types.ts` -- includes `ilpAddress: string`, `ilpAddresses?: string[]` (Story 7.3), `feePerByte?: string` (Story 7.4, defaults to `'0'`), `btpEndpoint`, settlement fields.
- **`ToonError`** in `packages/core/src/errors.ts` -- base error class.
- **`NodeError`** in `packages/sdk/src/errors.ts` -- SDK error class extending `ToonError`.
- **`deriveChildAddress()`** in `packages/core/src/address/derive-child-address.ts` -- address derivation utility from Story 7.1. Useful for understanding address hierarchy.
- **`ILP_ROOT_PREFIX`** in `packages/core/src/constants.ts` -- `'g.toon'` protocol constant.
- **`discoveryTrackerInstance`** in `packages/sdk/src/create-node.ts` (line ~666) -- the tracker instance used inside `createNode()`. Access via `discoveryTrackerInstance.getAllDiscoveredPeers()` (after Task 8).

### Project Structure Notes

- New `fee/` directory under `packages/core/src/` follows existing module organization pattern (cf. `address/`, `bootstrap/`, `events/`, `settlement/`, `x402/`).
- Barrel file `packages/core/src/fee/index.ts` follows the same pattern as `packages/core/src/address/index.ts`.
- Test files co-located with source (`.test.ts` suffix) follows project convention.
- Exports from `packages/core/src/index.ts` follow existing alphabetical grouping pattern.

### Testing Approach

Follow the standard unit test pattern. Tests go in:
- `packages/core/src/fee/calculate-route-amount.test.ts` (new) -- pure function tests for fee calculation (Tasks 4.1-4.6)
- `packages/core/src/fee/resolve-route-fees.test.ts` (new) -- route resolution tests with mock peer data (Tasks 5.1-5.6, 7.1)
- `packages/sdk/src/publish-event.test.ts` (existing) -- integration tests for `publishEvent()` with fee calculation (Tasks 6.1-6.3)

Expected test count: ~17 tests (6 calculator + 6+1 resolver + 3 publishEvent integration).

**Test plan coverage mapping (T-7.5-xx to tasks):**
- T-7.5-01 (U, P0): Tasks 4.1, 6.1
- T-7.5-02 (U, P0): Task 4.2
- T-7.5-03 (U, P0): Task 4.3
- T-7.5-04 (I, P0): Tasks 6.2, 6.3
- T-7.5-05 (I, P0): Deferred -- stale route rejection requires live ILP infrastructure. Covered conceptually by T-7.5-10 (route table update).
- T-7.5-06 (U, P0): Tasks 5.1, 5.2
- T-7.5-07 (U, P1): Task 5.3
- T-7.5-08 (U, P1): Task 4.4
- T-7.5-09 (U, P1): Task 4.5
- T-7.5-10 (I, P1): Task 7.1
- T-7.5-11 (I, P1): Deferred -- requires Docker infrastructure with fee-charging intermediaries. Will be covered in E2E testing.
- T-7.5-12 (E2E, P3): Deferred -- requires 3-node Docker setup. Out of scope for this story.

**Deferred tests:** T-7.5-05 (stale route ILP REJECT), T-7.5-11 (multi-hop live integration), T-7.5-12 (E2E Docker). These require live ILP infrastructure or multi-node Docker setup.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#FR-ADDR-5] FR-ADDR-5 definition and Story 7.5 acceptance criteria
- [Source: _bmad-output/planning-artifacts/test-design-epic-7.md#Story-7.5] Test plan T-7.5-01 through T-7.5-12, design question Q2
- [Source: _bmad-output/planning-artifacts/research/party-mode-prepaid-protocol-decisions-2026-03-20.md] D7-004 unified payment pattern
- [Source: _bmad-output/implementation-artifacts/7-4-fee-per-byte-advertisement-in-kind-10032.md] Story 7.4 implementation (feePerByte field in IlpPeerInfo)
- [Source: _bmad-output/implementation-artifacts/7-3-multi-address-support-for-multi-peered-nodes.md] Story 7.3 implementation (ilpAddresses array in IlpPeerInfo)

### Risk Mitigation

**E7-R009 (Fee calculation drift from stale route table, score 6):** The `DiscoveryTracker` processes kind:10032 updates in real-time via relay subscriptions. `resolveRouteFees()` reads the current state of `discoveredPeers` on each call, so fee data is as fresh as the most recent kind:10032 event. If a fee changes between route resolution and packet delivery, the intermediary may reject the packet. For v1, this is an accepted trade-off -- the error is surfaced to the caller. Future enhancement: automatic retry with re-fetched fees.

**E7-R010 (Fee calculation overflow, score 3):** All arithmetic is `bigint` -- no overflow possible. T-7.5-08 validates with large values.

**E7-R011 (Route discovery failure, score 4):** Unknown intermediaries default to `feePerByte: 0n` with a warning (Design Decision Q2). This ensures publishes are never blocked by incomplete discovery. The risk is underpayment, which is acceptable for v1.

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
N/A -- all tasks implemented and verified in a single pass; no debug issues encountered.

### Completion Notes List
- **Task 1**: Created `calculateRouteAmount()` pure function in `packages/core/src/fee/calculate-route-amount.ts`. Implements `totalAmount = basePricePerByte * packetBytes + SUM(hopFees[i] * packetBytes)` using bigint arithmetic. Handles all edge cases (empty hopFees, zero bytes, zero basePricePerByte).
- **Task 2**: Created `resolveRouteFees()` in `packages/core/src/fee/resolve-route-fees.ts`. LCA-based route resolution splits sender/destination ILP addresses, finds longest common ancestor, identifies intermediary hops, and looks up feePerByte from discovered peers. Supports multi-address matching via `ilpAddresses` array. Unknown intermediaries default to 0n with warning.
- **Task 3**: Integrated fee calculation into `publishEvent()` in `packages/sdk/src/create-node.ts`. Replaced simple `basePricePerByte * toonData.length` with `resolveRouteFees()` + `calculateRouteAmount()` pipeline. Uses `discoveryTrackerInstance.getAllDiscoveredPeers()` for full peer visibility. Warnings logged with `[publishEvent]` prefix. API signature unchanged.
- **Task 4**: 6 unit tests for `calculateRouteAmount()` covering direct route, 2-hop, 3-hop with zero-fee, large values (overflow safety), zero-byte packet, and zero basePricePerByte. All pass.
- **Task 5**: 7 unit tests for `resolveRouteFees()` covering direct route, self-publish, known intermediary, multiple intermediaries, unknown intermediary with warning, multi-address matching, and route table update. All pass.
- **Task 6**: 3 integration tests for `publishEvent()` fee calculation in existing `publish-event.test.ts` covering direct route amount, API signature enforcement, and multi-hop amount via `calculateRouteAmount`. All pass.
- **Task 7**: Route table update test included in Task 5 test file (T-7.5-10). Verifies updated feePerByte is reflected in subsequent calls.
- **Task 8**: `getAllDiscoveredPeers()` method already present on `DiscoveryTracker` interface and implementation. Returns all peers without filtering by peered status.
- **Task 9**: Build passes (`pnpm build`), all tests pass: 1257 core tests (47 files), 363 SDK tests (16 files). Exports verified in `packages/core/src/index.ts`.

### File List
- `packages/core/src/fee/calculate-route-amount.ts` (created) -- pure fee calculation function
- `packages/core/src/fee/resolve-route-fees.ts` (created) -- LCA-based route fee resolution
- `packages/core/src/fee/index.ts` (created) -- barrel file
- `packages/core/src/fee/calculate-route-amount.test.ts` (created) -- 6 unit tests
- `packages/core/src/fee/resolve-route-fees.test.ts` (created) -- 7 unit tests
- `packages/core/src/index.ts` (modified) -- added fee module exports
- `packages/core/src/bootstrap/discovery-tracker.ts` (modified) -- added `getAllDiscoveredPeers()` to interface and implementation
- `packages/sdk/src/create-node.ts` (modified) -- integrated `resolveRouteFees()` + `calculateRouteAmount()` into `publishEvent()`
- `packages/sdk/src/publish-event.test.ts` (modified) -- added 3 fee integration tests

### Change Log
- **2026-03-22**: Story 7.5 verified complete. All 9 tasks implemented: `calculateRouteAmount()` pure function, `resolveRouteFees()` LCA-based route resolution, `publishEvent()` integration with route-aware fee calculation, `getAllDiscoveredPeers()` on DiscoveryTracker, barrel exports, and 16 total tests (6 calculator + 7 resolver + 3 publishEvent integration). Build and all tests pass (1620+ tests across core and SDK packages).

## Code Review Record

### Review Pass #1
- **Date:** 2026-03-22
- **Reviewer Model:** Claude Opus 4.6 (1M context)
- **Issues Found:** 0 critical, 0 high, 2 medium, 1 low
- **Medium Issues:**
  1. Negative `packetByteLength` guard — added validation to `calculateRouteAmount()` to reject negative byte lengths
  2. Negative `feePerByte` clamping — added validation to clamp or reject negative fee values
- **Low Issues:**
  1. Empty ILP address guard — added defensive check for empty/missing ILP address strings
- **Tests Added:** 4 new tests covering the identified edge cases
- **Total Tests Passing:** 2599
- **Outcome:** All issues fixed. No follow-up tasks required.

### Review Pass #2
- **Date:** 2026-03-22
- **Reviewer Model:** Claude Opus 4.6 (1M context)
- **Issues Found:** 0 critical, 0 high, 0 medium, 0 low
- **Outcome:** Code is clean. No changes needed. All action items from Review Pass #1 confirmed resolved.

### Review Pass #3
- **Date:** 2026-03-22
- **Reviewer Model:** Claude Opus 4.6 (1M context)
- **Scope:** Full code review + OWASP Top 10 / security audit (injection, authentication/authorization, input validation, DoS, prototype pollution, ReDoS)
- **Issues Found:** 0 critical, 0 high, 1 medium, 0 low
- **Medium Issues:**
  1. **Uncaught `BigInt()` SyntaxError on malformed `feePerByte`** — `resolveRouteFees()` is a public API; callers can pass `DiscoveredPeer` objects with invalid `feePerByte` strings (e.g., `"abc"`, `"1.5"`) that bypass the upstream kind:10032 parser validation. `BigInt("abc")` throws `SyntaxError`, crashing `publishEvent()`. Fix: wrapped `BigInt()` call in try/catch, defaulting to `0n` with a warning.
- **Security Assessment (OWASP Top 10):**
  - **A03:2021 Injection:** No SQL/NoSQL/OS command injection vectors. Template literals used only for log messages (not HTML/SQL context). ILP address segments from `string.split('.')` are used only as Map keys.
  - **A01:2021 Broken Access Control:** N/A — fee calculation is a pure computation layer with no access control surfaces.
  - **A02:2021 Cryptographic Failures:** N/A — no cryptographic operations in fee module.
  - **A04:2021 Insecure Design:** LCA-based route resolution is sound. Unknown intermediaries default to 0n (accepted design trade-off, documented in Dev Notes).
  - **A05:2021 Security Misconfiguration:** No configuration surfaces in fee module.
  - **A06:2021 Vulnerable Components:** No new dependencies introduced.
  - **A07:2021 Auth Failures:** N/A — fee calculation has no authentication surface.
  - **A08:2021 Data Integrity:** `feePerByte` validation at parser level (Story 7.4) + defensive BigInt try/catch at fee resolution level provides defense-in-depth.
  - **A09:2021 Logging/Monitoring:** Warnings logged for unknown intermediaries and malformed fees. No sensitive data in log messages.
  - **A10:2021 SSRF:** N/A — no network requests in fee module.
  - **Prototype Pollution:** Uses `Map` (not plain objects) for peer lookup — immune.
  - **ReDoS:** No regular expressions in fee module — immune.
  - **DoS:** O(n) peer lookup construction, O(k) intermediary resolution where k = address depth (typically 3-5). No quadratic behavior.
- **Tests Added:** 2 new tests (malformed non-numeric feePerByte, decimal feePerByte)
- **Total Tests Passing:** 25 (fee module) + 27 (publish-event)
- **Outcome:** 1 medium issue fixed. Security audit clean. No remaining concerns.
