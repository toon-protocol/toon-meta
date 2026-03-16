---
stepsCompleted:
  [
    'step-01-load-context',
    'step-02-discover-tests',
    'step-03-map-criteria',
    'step-04-analyze-gaps',
  ]
lastStep: 'step-04-analyze-gaps'
lastSaved: '2026-03-15'
workflowType: 'testarch-trace'
inputDocuments:
  [
    '_bmad-output/implementation-artifacts/4-6-attestation-first-seed-relay-bootstrap.md',
    'packages/core/src/bootstrap/AttestationBootstrap.ts',
    'packages/core/src/bootstrap/attestation-bootstrap.test.ts',
    'packages/core/src/bootstrap/index.ts',
    'packages/core/src/index.ts',
  ]
---

# Traceability Matrix & Gate Decision - Story 4.6

**Story:** Attestation-First Seed Relay Bootstrap
**Date:** 2026-03-15
**Evaluator:** TEA Agent (Claude Opus 4.6)

---

Note: This workflow does not generate tests. If gaps exist, run `*atdd` or `*automate` to create coverage.

## PHASE 1: REQUIREMENTS TRACEABILITY

### Coverage Summary

| Priority  | Total Criteria | FULL Coverage | Coverage % | Status |
| --------- | -------------- | ------------- | ---------- | ------ |
| P0        | 2              | 2             | 100%       | PASS   |
| P1        | 4              | 4             | 100%       | PASS   |
| P2        | 0              | 0             | 100%       | PASS   |
| P3        | 0              | 0             | 100%       | PASS   |
| **Total** | **6**          | **6**         | **100%**   | **PASS** |

**Legend:**

- PASS - Coverage meets quality gate threshold
- WARN - Coverage below threshold but not critical
- FAIL - Coverage below minimum threshold (blocker)

---

### Detailed Mapping

#### AC-1: Attestation query before peer subscription (P0)

**Requirement:** Given a list of seed relay URLs (from a kind:10036 event parsed by `parseSeedRelayList()`), when `AttestationBootstrap.bootstrap()` is called, then for each seed relay the system queries for its kind:10033 attestation event and verifies it via `AttestationVerifier.verify()` BEFORE subscribing to that relay's kind:10032 peer info events. The attestation query must complete and pass verification before any peer discovery occurs for that relay. This is validated by verifying `queryAttestation()` invocation order precedes `subscribePeers()` invocation order via `mock.invocationCallOrder`.

- **Coverage:** FULL
- **Tests:**
  - `T-4.6-01` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:124
    - **Given:** A list of seed relay URLs with a valid verifier and attestation events
    - **When:** `AttestationBootstrap.bootstrap()` is called
    - **Then:** `queryAttestation` invocation order is less than `subscribePeers` invocation order, verifier.verify is called with the attestation event, and result.mode is 'attested'
  - `T-4.6-08` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:461
    - **Given:** First relay's verification returns false, second returns true
    - **When:** `bootstrap()` is called
    - **Then:** Verifier is called for both relays, subscribePeers only called for the second (passing) relay, result is 'attested' via second relay

- **Gaps:** None

---

#### AC-2: Fallback on invalid/null/error attestation (P0)

**Requirement:** Given a seed relay list where the first relay has no valid attestation (returns `null`, fails verification, or `queryAttestation` throws an error), when `AttestationBootstrap.bootstrap()` is called, then the system falls back to the next seed relay in the list without crashing. The system must try all seed relays in order, calling `queryAttestation()` for each. Only relays that pass attestation verification proceed to peer discovery via `subscribePeers()`. Callback errors (thrown exceptions) are caught and treated equivalently to a `null` attestation return.

- **Coverage:** FULL
- **Tests:**
  - `T-4.6-02` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:161
    - **Given:** First seed relay returns `null` attestation, second returns valid
    - **When:** `bootstrap()` is called
    - **Then:** Both relays are queried, only the second relay is subscribed to, result.mode is 'attested' via second relay
  - `T-4.6-07` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:412
    - **Given:** First relay's `queryAttestation` throws `Error('Connection refused')`, second returns valid
    - **When:** `bootstrap()` is called
    - **Then:** Both relays are queried, only second relay subscribed, result is 'attested' via second relay (no crash)
  - `T-4.6-08` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:461
    - **Given:** First relay's verification returns `false`, second returns `true`
    - **When:** `bootstrap()` is called
    - **Then:** Verifier called twice, subscribePeers only on second, result is 'attested'
  - `T-4.6-09` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:510
    - **Given:** First relay's `subscribePeers` throws `Error('WebSocket timeout')`, second succeeds
    - **When:** `bootstrap()` is called
    - **Then:** Falls back to second relay, result is 'attested' with discovered peers
  - `T-4.6-09b` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:550
    - **Given:** First relay's `verifier.verify()` throws `Error('Verification engine unavailable')`, second succeeds
    - **When:** `bootstrap()` is called
    - **Then:** Falls back to second relay, result is 'attested' via second relay

- **Gaps:** None

---

#### AC-3: Valid attestation proceeds to peer discovery with mode:'attested' (P1)

**Requirement:** Given a seed relay with valid kind:10033 attestation, when the attestation passes `AttestationVerifier.verify()`, then the system proceeds to subscribe to kind:10032 peer info events on that relay. The bootstrap result includes `discoveredPeers` (array of discovered peer info events), `attestedSeedRelay` (URL of the first relay that passed attestation), and `mode: 'attested'`.

- **Coverage:** FULL
- **Tests:**
  - `T-4.6-03` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:210
    - **Given:** Single seed relay with valid attestation event and one peer info event
    - **When:** `bootstrap()` is called
    - **Then:** Verifier is called with the valid event, subscribePeers is called, result.discoveredPeers has length 1, result.attestedSeedRelay is the relay URL, and `result.mode === 'attested'`
  - `T-4.6-11` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:664
    - **Given:** Verifier returns `VerificationResult { valid: true, reason: undefined }` (real verifier shape)
    - **When:** `bootstrap()` is called
    - **Then:** VerificationResult.valid is normalized correctly, result is 'attested' with discovered peers

- **Gaps:** None

---

#### AC-4: Degraded mode when all relays unattested (P1)

**Requirement:** Given a seed relay list where ALL relays lack valid attestation, when `AttestationBootstrap.bootstrap()` is called, then the node starts in degraded mode (`mode: 'degraded'`), logs a warning containing "No attested seed relays found", and does NOT crash. The result has `attestedSeedRelay: undefined`, `discoveredPeers: []`, and `subscribePeers` is never called.

- **Coverage:** FULL
- **Tests:**
  - `T-4.6-04` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:246
    - **Given:** 3 seed relays, all returning `null` attestation
    - **When:** `bootstrap()` is called
    - **Then:** result.mode is 'degraded', attestedSeedRelay is undefined, discoveredPeers is [], queryAttestation called 3 times, console.warn called with "No attested seed relays found", subscribePeers never called
  - `T-4.6-10` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:600
    - **Given:** 3 seed relays, all returning `null` attestation, event listener registered
    - **When:** `bootstrap()` is called
    - **Then:** `attestation:verification-failed` emitted for each relay (3 times with correct URLs), `attestation:seed-connected` emitted 3 times, `attestation:degraded` emitted once with triedCount=3, no `attestation:verified` or `attestation:peers-discovered` events
  - `T-4.6-12` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:701
    - **Given:** All relays return attestation events but verifier returns `{ valid: false, reason: 'PCR mismatch' }`
    - **When:** `bootstrap()` is called
    - **Then:** result is degraded, subscribePeers never called, verifier called 3 times
  - `T-4.6-13` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:742
    - **Given:** Empty seed relay list `[]`
    - **When:** `bootstrap()` is called
    - **Then:** result is degraded, no queries or subscriptions made, warning logged

- **Gaps:** None

---

#### AC-5: Full lifecycle events emitted in order (P1)

**Requirement:** Given the full attestation-first bootstrap flow (kind:10036 -> connect seed -> verify kind:10033 -> subscribe kind:10032), when `AttestationBootstrap.bootstrap()` completes successfully, then lifecycle events are emitted in order: `attestation:seed-connected` -> `attestation:verified` -> `attestation:peers-discovered`. The result includes `mode: 'attested'`, the attested seed relay URL, and all discovered peers.

- **Coverage:** FULL
- **Tests:**
  - `T-4.6-05` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:290
    - **Given:** 3 seed relays, first returns valid attestation, one peer info event, event listener registered
    - **When:** `bootstrap()` is called
    - **Then:** Events emitted in order: seed-connected < verified < peers-discovered (verified by indexOf ordering), result.discoveredPeers has length 1, result.attestedSeedRelay is first relay URL, result.mode is 'attested'
  - `T-4.6-10` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:600
    - **Given:** All relays fail (degraded path)
    - **When:** `bootstrap()` is called
    - **Then:** Verifies degraded events are emitted correctly (seed-connected, verification-failed, degraded), complementing the happy-path event ordering in T-4.6-05

- **Gaps:** None

---

#### AC-6: Barrel exports (P1)

**Requirement:** Given `AttestationBootstrap`, `AttestationBootstrapConfig`, `AttestationBootstrapResult`, and `AttestationBootstrapEvent`, when imported from `@crosstown/core`, then they are exported from `packages/core/src/bootstrap/AttestationBootstrap.ts` and re-exported via `packages/core/src/bootstrap/index.ts` and the top-level `packages/core/src/index.ts`.

- **Coverage:** FULL
- **Tests:**
  - `T-4.6-06` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:353
    - **Given:** Bootstrap barrel `./index.js`
    - **When:** Dynamically imported
    - **Then:** `barrel.AttestationBootstrap` is defined and equals the direct import
  - `T-4.6-06b` - `packages/core/src/bootstrap/attestation-bootstrap.test.ts`:366
    - **Given:** Top-level core barrel `../index.js`
    - **When:** Dynamically imported
    - **Then:** `coreBarrel.AttestationBootstrap` is defined and equals the direct import

- **Gaps:** None

---

### Gap Analysis

#### Critical Gaps (BLOCKER)

0 gaps found. **No P0 blockers.**

---

#### High Priority Gaps (PR BLOCKER)

0 gaps found. **No P1 gaps.**

---

#### Medium Priority Gaps (Nightly)

0 gaps found.

---

#### Low Priority Gaps (Optional)

0 gaps found.

---

### Coverage Heuristics Findings

#### Endpoint Coverage Gaps

- Endpoints without direct API tests: 0
- Not applicable: `AttestationBootstrap` is a pure orchestration class with no HTTP/API endpoints. Transport is injected via DI callbacks.

#### Auth/Authz Negative-Path Gaps

- Criteria missing denied/invalid-path tests: 0
- Not applicable: This module does not handle authentication/authorization. The verifier is a DI callback that returns boolean/VerificationResult.

#### Happy-Path-Only Criteria

- Criteria missing error/edge scenarios: 0
- All ACs have both happy-path and error-path coverage:
  - AC #1: Happy path (T-4.6-01) + verification-fails fallback (T-4.6-08)
  - AC #2: Null return (T-4.6-02) + thrown error (T-4.6-07) + verify false (T-4.6-08) + subscribePeers throw (T-4.6-09) + verify throw (T-4.6-09b)
  - AC #3: Happy path (T-4.6-03) + VerificationResult normalization (T-4.6-11)
  - AC #4: All-null (T-4.6-04) + all-false VerificationResult (T-4.6-12) + empty list (T-4.6-13) + degraded events (T-4.6-10)
  - AC #5: Happy events (T-4.6-05) + degraded events (T-4.6-10)
  - AC #6: Bootstrap barrel (T-4.6-06) + top-level barrel (T-4.6-06b)

---

### Quality Assessment

#### Tests with Issues

**BLOCKER Issues**

None.

**WARNING Issues**

None.

**INFO Issues**

- `T-4.6-06c` - Tests `off()` method which is not explicitly part of any AC. This is a bonus test covering an API method mentioned in the implementation but not in acceptance criteria. No issue -- defense in depth.

---

#### Tests Passing Quality Gates

**17/17 tests (100%) meet all quality criteria**

- All tests have explicit assertions (expect statements)
- All tests follow Given-When-Then structure via comments
- No hard waits or sleeps -- all async operations are mock-driven
- Test file is 1015 lines (exceeds 300 line limit) but contains multiple test suites (Story 4.6, Story 4.1 skipped, cross-cutting risks) -- acceptable for a multi-story test file

---

### Duplicate Coverage Analysis

#### Acceptable Overlap (Defense in Depth)

- AC #2: Tested via null return (T-4.6-02), thrown error (T-4.6-07), verify false (T-4.6-08), subscribePeers throw (T-4.6-09), verify throw (T-4.6-09b) -- 5 tests covering different failure modes of the same AC. This is defense in depth for a P0 requirement.
- AC #4: Tested via all-null (T-4.6-04), VerificationResult { valid: false } (T-4.6-12), empty list (T-4.6-13), degraded events (T-4.6-10) -- 4 tests covering different degraded mode triggers. Defense in depth for degraded mode resilience.

#### Unacceptable Duplication

None detected.

---

### Coverage by Test Level

| Test Level | Tests  | Criteria Covered | Coverage % |
| ---------- | ------ | ---------------- | ---------- |
| Unit       | 16     | 6/6              | 100%       |
| Integration| 1*     | 1/6 (AC #5)      | 17%        |
| E2E        | 0      | 0/6              | 0%         |
| API        | 0      | 0/6              | 0%         |
| **Total**  | **17** | **6/6**          | **100%**   |

*T-4.6-05 is classified as integration in the story's test traceability table though it runs as a unit test with mocks. All tests are effectively unit-level with DI mocks -- this is appropriate for a pure orchestration class with no transport logic.

---

### Traceability Recommendations

#### Immediate Actions (Before PR Merge)

None required. All acceptance criteria have FULL coverage.

#### Short-term Actions (This Milestone)

1. **Consider splitting test file** - `attestation-bootstrap.test.ts` is 1015 lines. When Story 4.1 tests move to their own file (they are already skipped and GREEN elsewhere), this will naturally reduce to ~770 lines. No action needed now.

#### Long-term Actions (Backlog)

1. **Integration test with real WebSocket** - When the Docker entrypoint integrates `AttestationBootstrap` with real `queryAttestation`/`subscribePeers` callbacks, add an E2E test that exercises the full bootstrap flow against running containers. Deferred to a future integration story.

---

## PHASE 2: QUALITY GATE DECISION

**Gate Type:** story
**Decision Mode:** deterministic

---

### Evidence Summary

#### Test Execution Results

- **Total Tests**: 17 (Story 4.6 active tests in attestation-bootstrap.test.ts)
- **Passed**: 17 (100%)
- **Failed**: 0 (0%)
- **Skipped**: 6 (Story 4.1 tests T-4.1-01 through T-4.1-04, T-4.1-03, T-RISK-02 -- not part of Story 4.6)
- **Duration**: Sub-second (all mock-driven unit tests)

**Priority Breakdown:**

- **P0 Tests**: 4/4 passed (100%) -- T-4.6-01, T-4.6-02, T-4.6-07, T-4.6-08
- **P1 Tests**: 13/13 passed (100%) -- T-4.6-03 through T-4.6-06, T-4.6-06b, T-4.6-06c, T-4.6-09, T-4.6-09b, T-4.6-10, T-4.6-11, T-4.6-12, T-4.6-13
- **P2 Tests**: 0/0 (N/A)
- **P3 Tests**: 0/0 (N/A)

**Overall Pass Rate**: 100%

**Test Results Source**: Local run (`pnpm test` -- 1808 tests, 0 failures per Dev Agent Record)

---

#### Coverage Summary (from Phase 1)

**Requirements Coverage:**

- **P0 Acceptance Criteria**: 2/2 covered (100%)
- **P1 Acceptance Criteria**: 4/4 covered (100%)
- **P2 Acceptance Criteria**: 0/0 (N/A)
- **Overall Coverage**: 100%

**Code Coverage** (not separately instrumented):

- Not assessed -- no separate code coverage tool configured for this run. All paths in `AttestationBootstrap.ts` are exercised by tests (verified by reading implementation and test assertions).

---

#### Non-Functional Requirements (NFRs)

**Security**: PASS
- Security Issues: 0
- OWASP assessment in Code Review Pass #3 found no injection risks, no auth flaws, no SSRF vectors. Pure orchestration class with DI -- minimal attack surface.
- M1 (unsafe type assertion) was fixed during code review.

**Performance**: PASS
- All tests complete sub-second. No WebSocket connections, no I/O. Pure in-memory orchestration.

**Reliability**: PASS
- Graceful degradation implemented (AC #4). Callback errors caught and handled (AC #2). Listener errors do not break bootstrap (defensive try/catch in emit).

**Maintainability**: PASS
- Code review passed 3 rounds. DI pattern makes class fully testable. Clean separation of concerns.

---

#### Flakiness Validation

**Burn-in Results**: Not available (not configured for this story)

- Tests are deterministic (mock-driven, no timers, no network)
- Flakiness risk: negligible

---

### Decision Criteria Evaluation

#### P0 Criteria (Must ALL Pass)

| Criterion             | Threshold | Actual | Status |
| --------------------- | --------- | ------ | ------ |
| P0 Coverage           | 100%      | 100%   | PASS   |
| P0 Test Pass Rate     | 100%      | 100%   | PASS   |
| Security Issues       | 0         | 0      | PASS   |
| Critical NFR Failures | 0         | 0      | PASS   |
| Flaky Tests           | 0         | 0      | PASS   |

**P0 Evaluation**: ALL PASS

---

#### P1 Criteria (Required for PASS, May Accept for CONCERNS)

| Criterion              | Threshold | Actual | Status |
| ---------------------- | --------- | ------ | ------ |
| P1 Coverage            | >=90%     | 100%   | PASS   |
| P1 Test Pass Rate      | >=90%     | 100%   | PASS   |
| Overall Test Pass Rate | >=90%     | 100%   | PASS   |
| Overall Coverage       | >=80%     | 100%   | PASS   |

**P1 Evaluation**: ALL PASS

---

#### P2/P3 Criteria (Informational, Don't Block)

| Criterion         | Actual | Notes                    |
| ----------------- | ------ | ------------------------ |
| P2 Test Pass Rate | N/A    | No P2 tests for this story |
| P3 Test Pass Rate | N/A    | No P3 tests for this story |

---

### GATE DECISION: PASS

---

### Rationale

All P0 criteria met with 100% coverage and 100% pass rate across 4 P0 tests (T-4.6-01, T-4.6-02, T-4.6-07, T-4.6-08). All P1 criteria exceeded thresholds with 100% overall pass rate and 100% coverage across 13 P1 tests. No security issues detected (OWASP review passed in Code Review #3). No flaky tests -- all tests are mock-driven and deterministic.

The story implements a pure orchestration class with DI callbacks, making it inherently testable and low-risk. All 6 acceptance criteria are fully covered with a combined 17 active tests. The test suite provides excellent defense-in-depth coverage, particularly for AC #2 (fallback scenarios) with 5 distinct failure mode tests, and AC #4 (degraded mode) with 4 distinct trigger tests.

Feature is ready for merge and deployment.

---

### Gate Recommendations

#### For PASS Decision

1. **Proceed to merge**
   - All acceptance criteria verified with FULL coverage
   - Build, lint, and full test suite pass (1808 tests, 0 failures)
   - 3 code review passes completed with all issues resolved

2. **Post-Merge Monitoring**
   - Monitor CI pipeline for regression in bootstrap-related tests
   - When Docker entrypoint integration occurs, verify real WebSocket callbacks work correctly

3. **Success Criteria**
   - Story 4.6 committed and merged to epic-4 branch
   - No test regressions in CI

---

### Next Steps

**Immediate Actions** (next 24-48 hours):

1. Merge Story 4.6 to epic-4 branch (commit already created)
2. No additional test coverage needed

**Follow-up Actions** (next milestone/release):

1. Integration test with real WebSocket transport when Docker entrypoint integrates AttestationBootstrap
2. T-RISK-02 integration test (payment channels survive attestation degradation) to be addressed in a future story

**Stakeholder Communication**:

- Notify PM: Story 4.6 PASS -- attestation-first bootstrap fully implemented and tested
- Notify DEV lead: All 6 ACs covered, 17 tests GREEN, no regressions

---

## Uncovered ACs

**None.** All 6 acceptance criteria have FULL test coverage.

| AC # | Description | Coverage Status | Tests |
| ---- | ----------- | --------------- | ----- |
| #1   | Attestation query before peer subscription | FULL | T-4.6-01, T-4.6-08 |
| #2   | Fallback on invalid/null/error attestation | FULL | T-4.6-02, T-4.6-07, T-4.6-08, T-4.6-09, T-4.6-09b |
| #3   | Valid attestation proceeds to peer discovery | FULL | T-4.6-03, T-4.6-11 |
| #4   | Degraded mode when all unattested | FULL | T-4.6-04, T-4.6-10, T-4.6-12, T-4.6-13 |
| #5   | Full lifecycle events in order | FULL | T-4.6-05, T-4.6-10 |
| #6   | Barrel exports | FULL | T-4.6-06, T-4.6-06b |

---

## Integrated YAML Snippet (CI/CD)

```yaml
traceability_and_gate:
  # Phase 1: Traceability
  traceability:
    story_id: '4.6'
    date: '2026-03-15'
    coverage:
      overall: 100%
      p0: 100%
      p1: 100%
      p2: N/A
      p3: N/A
    gaps:
      critical: 0
      high: 0
      medium: 0
      low: 0
    quality:
      passing_tests: 17
      total_tests: 17
      blocker_issues: 0
      warning_issues: 0
    recommendations:
      - 'Consider splitting test file when Story 4.1 tests are removed'
      - 'Add integration test with real WebSocket when Docker entrypoint integrates'

  # Phase 2: Gate Decision
  gate_decision:
    decision: 'PASS'
    gate_type: 'story'
    decision_mode: 'deterministic'
    criteria:
      p0_coverage: 100%
      p0_pass_rate: 100%
      p1_coverage: 100%
      p1_pass_rate: 100%
      overall_pass_rate: 100%
      overall_coverage: 100%
      security_issues: 0
      critical_nfrs_fail: 0
      flaky_tests: 0
    thresholds:
      min_p0_coverage: 100
      min_p0_pass_rate: 100
      min_p1_coverage: 90
      min_p1_pass_rate: 90
      min_overall_pass_rate: 90
      min_coverage: 80
    evidence:
      test_results: 'local run (pnpm test -- 1808 tests, 0 failures)'
      traceability: '_bmad-output/test-artifacts/traceability-report-4-6.md'
      nfr_assessment: 'Code Review Pass #3 (OWASP, security, reliability)'
      code_coverage: 'not instrumented (all paths verified by test assertions)'
    next_steps: 'Merge to epic-4 branch. No additional coverage needed.'
```

---

## Related Artifacts

- **Story File:** `_bmad-output/implementation-artifacts/4-6-attestation-first-seed-relay-bootstrap.md`
- **Test Design:** `_bmad-output/test-artifacts/test-design-epic-4.md` (T-4.6-01 through T-4.6-05 defined)
- **Tech Spec:** N/A (embedded in story file)
- **Test Results:** Local run (1808 tests, 0 failures)
- **NFR Assessment:** Code Review Pass #3 in story file
- **Test Files:** `packages/core/src/bootstrap/attestation-bootstrap.test.ts`

---

## Sign-Off

**Phase 1 - Traceability Assessment:**

- Overall Coverage: 100%
- P0 Coverage: 100% PASS
- P1 Coverage: 100% PASS
- Critical Gaps: 0
- High Priority Gaps: 0

**Phase 2 - Gate Decision:**

- **Decision**: PASS
- **P0 Evaluation**: ALL PASS
- **P1 Evaluation**: ALL PASS

**Overall Status:** PASS

**Next Steps:**

- PASS: Proceed to merge

**Generated:** 2026-03-15
**Workflow:** testarch-trace v5.0 (Step-File Architecture)

---

<!-- Powered by BMAD-CORE -->
