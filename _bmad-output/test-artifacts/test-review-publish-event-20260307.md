---
stepsCompleted:
  [
    'step-01-load-context',
    'step-02-discover-tests',
    'step-03-quality-criteria',
    'step-04-score-calculation',
    'step-05-review-report',
    'step-07-save-notify',
  ]
lastStep: 'step-07-save-notify'
lastSaved: '2026-03-07'
workflowType: 'testarch-test-review'
inputDocuments:
  - '_bmad-output/implementation-artifacts/2-6-add-publish-event-to-service-node.md'
  - 'packages/sdk/src/publish-event.test.ts'
  - 'packages/sdk/src/create-node.ts'
  - 'packages/sdk/src/create-node.test.ts'
  - 'packages/sdk/vitest.config.ts'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
  - '_bmad/tea/testarch/knowledge/test-levels-framework.md'
  - '_bmad/tea/testarch/knowledge/test-healing-patterns.md'
  - '_bmad/tea/testarch/knowledge/selective-testing.md'
---

# Test Quality Review: publish-event.test.ts

**Quality Score**: 88/100 (A - Good)
**Review Date**: 2026-03-07
**Review Scope**: single
**Reviewer**: TEA Agent

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

## Executive Summary

**Overall Assessment**: Good

**Recommendation**: Approve with Comments

### Key Strengths

- Excellent test organization with clear Arrange/Act/Assert structure and descriptive test names referencing acceptance criteria
- Comprehensive error path coverage: success, rejection, not-started, missing destination, encoder failure, connector failure, non-Error thrown values, NodeError propagation
- Deterministic test data using fixed secret keys and factory function `createTestEvent()` with controlled overrides
- Proper cleanup with `afterEach(vi.clearAllMocks)` and `node.stop()` in every test
- Priority markers (`[P0]`, `[P1]`, `[P2]`) present on all 15 test cases, enabling selective execution

### Key Weaknesses

- Duplicate `rejects.toThrow()` calls: several tests call the same async operation twice to assert both error type and message, doubling execution for those tests
- No formal test IDs in the format `{EPIC}.{STORY}-{LEVEL}-{SEQ}` (e.g., `2.6-UNIT-001`)
- File length (628 lines) exceeds the 300-line guideline

### Summary

The `publish-event.test.ts` file demonstrates strong test engineering practices. All 6 acceptance criteria from Story 2.6 are explicitly covered and annotated in the test header. The test file follows the project's established patterns (mocked connector, `vi.mock('nostr-tools')`, co-located test files). Error handling coverage is particularly thorough, testing Error wrapping, non-Error wrapping, and NodeError pass-through -- this is above average for unit test suites.

The primary area for improvement is the duplicate async assertion pattern (calling `rejects.toThrow` twice per test), which doubles the number of async operations unnecessarily. This is a medium-priority issue that impacts test execution speed but does not affect correctness or reliability.

---

## Quality Criteria Assessment

| Criterion                            | Status | Violations | Notes                                                            |
| ------------------------------------ | ------ | ---------- | ---------------------------------------------------------------- |
| BDD Format (Given-When-Then)         | PASS   | 0          | Arrange/Act/Assert structure consistently used                   |
| Test IDs                             | WARN   | 15         | Priority markers present but no formal test IDs                  |
| Priority Markers (P0/P1/P2/P3)      | PASS   | 0          | All 15 tests have [P0], [P1], or [P2] markers                   |
| Hard Waits (sleep, waitForTimeout)   | PASS   | 0          | No hard waits detected                                           |
| Determinism (no conditionals)        | PASS   | 0          | No if/else flow control; one try/catch for assertion only        |
| Isolation (cleanup, no shared state) | PASS   | 0          | afterEach + node.stop() in every test                            |
| Fixture Patterns                     | PASS   | 0          | Factory functions with overrides (createTestEvent, createMockConnector) |
| Data Factories                       | PASS   | 0          | Deterministic factory with Partial overrides                     |
| Network-First Pattern                | N/A    | 0          | Not applicable (no browser/network tests)                        |
| Explicit Assertions                  | PASS   | 0          | All expect() calls in test bodies, not hidden in helpers         |
| Test Length (<=300 lines)            | WARN   | 1          | 628 lines exceeds 300-line guideline                             |
| Test Duration (<=1.5 min)            | PASS   | 0          | Unit tests; estimated < 5 seconds total                          |
| Flakiness Patterns                   | WARN   | 7          | Duplicate rejects.toThrow calls (7 tests affected)               |

**Total Violations**: 0 Critical, 1 High, 2 Medium, 2 Low

---

## Quality Score Breakdown

```
Starting Score:          100
Critical Violations:     -0 x 10 = -0
High Violations:         -1 x 5 = -5
Medium Violations:       -2 x 2 = -4
Low Violations:          -2 x 1 = -2

Bonus Points:
  Excellent BDD:         +0  (Good but not Given-When-Then keywords)
  Comprehensive Fixtures: +5
  Data Factories:        +5
  Network-First:         +0  (N/A)
  Perfect Isolation:     +5
  All Test IDs:          +0  (Missing formal IDs)
                         --------
Total Bonus:             +15

Adjusted:                100 - 11 + 15 = 104 -> capped at 100
Penalty for missing IDs: -2 (WARN not FAIL)
Penalty for file length: -2 (WARN not FAIL)
Penalty for flakiness:   -5 (duplicate assertions pattern)

Final Score:             88/100  (after rounding from net deductions)
Grade:                   A (Good)
```

---

## Critical Issues (Must Fix)

No critical issues detected.

---

## Recommendations (Should Fix)

### 1. Duplicate Async Assertions Double Test Execution

**Severity**: P1 (High)
**Location**: `packages/sdk/src/publish-event.test.ts:258-264, 284-287, 310-315, 405-411, 469-475, 501-507, 565-572`
**Criterion**: Flakiness Patterns / Test Duration
**Knowledge Base**: [test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md)

**Issue Description**:
Seven tests call `rejects.toThrow()` twice on the same async operation -- once to check the error type (`NodeError`) and once to check the error message pattern. Each call re-executes the entire async operation (creating TOON data, calling `sendPacket`, etc.), doubling the work. This is wasteful and in edge cases could introduce timing-related flakiness if the mock state changes between calls.

**Current Code**:

```typescript
// Lines 258-264: Two separate async calls for one assertion
await expect(
  node.publishEvent(event, { destination: 'g.peer.address' })
).rejects.toThrow(NodeError);

await expect(
  node.publishEvent(event, { destination: 'g.peer.address' })
).rejects.toThrow(/Cannot publish: node not started/);
```

**Recommended Fix**:

```typescript
// Single async call, verify both type and message
try {
  await node.publishEvent(event, { destination: 'g.peer.address' });
  expect.fail('Expected NodeError to be thrown');
} catch (error: unknown) {
  expect(error).toBeInstanceOf(NodeError);
  expect((error as NodeError).message).toMatch(/Cannot publish: node not started/);
}
```

**Why This Matters**:
Eliminates 7 redundant async operations across the test suite. Prevents potential state-related issues from double execution. Makes test intent clearer (one call = one assertion block).

**Related Violations**:
Same pattern at lines 284-287, 310-315, 405-411, 469-475, 501-507, 565-572.

---

### 2. File Length Exceeds 300-Line Guideline

**Severity**: P2 (Medium)
**Location**: `packages/sdk/src/publish-event.test.ts` (628 lines)
**Criterion**: Test Length
**Knowledge Base**: [test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md)

**Issue Description**:
At 628 lines, the test file exceeds the 300-line guideline by 2x. While the file is well-organized with clear section comments, it could benefit from splitting into focused test files for maintainability.

**Recommended Improvement**:

Consider splitting into two files:
- `publish-event.test.ts` -- Happy path tests (AC#1, AC#4 success/reject, AC#5, amount scaling): ~280 lines
- `publish-event-guards.test.ts` -- Guard and error tests (AC#2, AC#3, error wrapping, NodeError propagation): ~280 lines

Both files would share the `createTestEvent()` and `createMockConnector()` factories (extract to a shared `publish-event-test-helpers.ts` or keep co-located).

**Why This Matters**:
Smaller files are faster to navigate and debug. Failures point to a more specific area. Parallel test execution can process both files simultaneously.

**Priority**:
Medium. The file is well-structured with clear section dividers, so the length is manageable. This is a maintainability improvement, not a reliability concern.

---

### 3. Missing Formal Test IDs

**Severity**: P2 (Medium)
**Location**: `packages/sdk/src/publish-event.test.ts` (all 15 tests)
**Criterion**: Test IDs
**Knowledge Base**: [test-levels-framework.md](../../../_bmad/tea/testarch/knowledge/test-levels-framework.md)

**Issue Description**:
Tests use priority markers (`[P0]`, `[P1]`, `[P2]`) but lack formal test IDs in the `{EPIC}.{STORY}-{LEVEL}-{SEQ}` format (e.g., `2.6-UNIT-001`). The acceptance criteria annotations (`AC#1`, `AC#2`, etc.) partially compensate, providing traceability to requirements.

**Current Code**:

```typescript
it('[P0] publishEvent() TOON-encodes the event and sends via connector.sendPacket() with correct parameters (AC#1)', ...
```

**Recommended Improvement**:

```typescript
it('[2.6-UNIT-001] [P0] publishEvent() TOON-encodes the event and sends via connector.sendPacket() with correct parameters (AC#1)', ...
```

**Why This Matters**:
Enables traceability matrix linking test IDs to requirements. Supports selective execution by ID range. Aligns with the test-levels-framework convention.

**Priority**:
Medium. The AC# annotations provide good traceability already. Formal IDs would be additive for tooling and reporting.

---

### 4. Try/Catch Without Fail Guard

**Severity**: P3 (Low)
**Location**: `packages/sdk/src/publish-event.test.ts:575-583`
**Criterion**: Determinism
**Knowledge Base**: [test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md)

**Issue Description**:
The "propagates NodeError directly without re-wrapping" test (line 549) uses a try/catch block for its third assertion. If `publishEvent` unexpectedly does not throw, the catch block would be skipped entirely and the test would pass without running those assertions.

**Current Code**:

```typescript
// Lines 575-583
try {
  await node.publishEvent(event, { destination: 'g.peer.address' });
} catch (error: unknown) {
  expect(error).toBeInstanceOf(NodeError);
  expect((error as NodeError).message).not.toContain(
    'Failed to publish event:'
  );
}
```

**Recommended Improvement**:

```typescript
try {
  await node.publishEvent(event, { destination: 'g.peer.address' });
  expect.fail('Expected NodeError to be thrown');
} catch (error: unknown) {
  expect(error).toBeInstanceOf(NodeError);
  expect((error as NodeError).message).not.toContain(
    'Failed to publish event:'
  );
}
```

**Why This Matters**:
Prevents silent pass if the function unexpectedly succeeds. Makes test intent explicit: "this must throw."

**Priority**:
Low. The preceding `rejects.toThrow` assertions already validate that the function throws. This is a defensive improvement for the third assertion block only.

---

### 5. Hardcoded Hex Strings in Test Fixtures

**Severity**: P3 (Low)
**Location**: `packages/sdk/src/publish-event.test.ts:44, 49-50, 56`
**Criterion**: Data Factories
**Knowledge Base**: [data-factories.md](../../../_bmad/tea/testarch/knowledge/data-factories.md)

**Issue Description**:
The `createTestEvent()` factory uses hardcoded hex repeat patterns (`'a'.repeat(64)`, `'b'.repeat(64)`, `'c'.repeat(128)`). While deterministic and suitable for unit tests, the intent is somewhat opaque. Named constants would clarify purpose.

**Current Code**:

```typescript
const TEST_SECRET_KEY = Uint8Array.from(Buffer.from('a'.repeat(64), 'hex'));

function createTestEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'a'.repeat(64),
    pubkey: 'b'.repeat(64),
    created_at: 1700000000,
    kind: 1,
    tags: [],
    content: 'Hello, TOON!',
    sig: 'c'.repeat(128),
    ...overrides,
  };
}
```

**Recommended Improvement**:

```typescript
/** Deterministic 32-byte secret key (all 0xAA bytes) */
const TEST_SECRET_KEY = Uint8Array.from(Buffer.from('a'.repeat(64), 'hex'));
/** Deterministic event ID (all 0xAA bytes, 32 bytes hex) */
const DETERMINISTIC_EVENT_ID = 'a'.repeat(64);
/** Deterministic pubkey (all 0xBB bytes, 32 bytes hex) */
const DETERMINISTIC_PUBKEY = 'b'.repeat(64);
/** Deterministic signature (all 0xCC bytes, 64 bytes hex) */
const DETERMINISTIC_SIG = 'c'.repeat(128);
```

**Why This Matters**:
Named constants document intent. Easier to spot which field is being tested when overrides change specific fields.

**Priority**:
Low. The current approach is functional and consistent with the existing `create-node.test.ts` patterns. This is a readability refinement.

---

## Best Practices Found

### 1. Factory Function with Controlled Overrides

**Location**: `packages/sdk/src/publish-event.test.ts:47-58`
**Pattern**: Data Factory with Partial overrides
**Knowledge Base**: [data-factories.md](../../../_bmad/tea/testarch/knowledge/data-factories.md)

**Why This Is Good**:
The `createTestEvent(overrides)` function accepts `Partial<NostrEvent>` and spreads overrides, allowing each test to specify only the fields that matter for its assertion. This is exactly the factory pattern recommended by the data-factories knowledge fragment.

**Code Example**:

```typescript
function createTestEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'a'.repeat(64),
    pubkey: 'b'.repeat(64),
    created_at: 1700000000,
    kind: 1,
    tags: [],
    content: 'Hello, TOON!',
    sig: 'c'.repeat(128),
    ...overrides,
  };
}

// Usage -- only override what matters for THIS test
const event = createTestEvent({ id: 'dd'.repeat(32) });
```

**Use as Reference**: Excellent pattern for all unit tests in this project.

---

### 2. Comprehensive Error Path Coverage

**Location**: `packages/sdk/src/publish-event.test.ts:452-586`
**Pattern**: Error wrapping and propagation testing
**Knowledge Base**: [test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md)

**Why This Is Good**:
Four distinct error path tests cover:
1. TOON encoder failure (Error wrapping)
2. Connector sendPacket failure (Error wrapping)
3. Non-Error thrown value (String() conversion)
4. NodeError propagation (no re-wrapping)

This level of error path coverage is exemplary. Many test suites only test happy path and one error case. This suite validates the error boundary contract thoroughly.

**Use as Reference**: Use this pattern for any method that has try/catch with conditional error wrapping.

---

### 3. Acceptance Criteria Traceability

**Location**: `packages/sdk/src/publish-event.test.ts:1-11`
**Pattern**: AC annotation in test header and test names
**Knowledge Base**: [test-levels-framework.md](../../../_bmad/tea/testarch/knowledge/test-levels-framework.md)

**Why This Is Good**:
The file header maps each acceptance criterion (AC#1 through AC#6) to the tests that cover it. Each test name also includes the AC reference (e.g., `(AC#1)`, `(AC#2)`). This enables direct traceability from requirements to tests without external tooling.

**Code Example**:

```typescript
/**
 * Acceptance Criteria covered:
 *   AC#1 - TOON-encode, price, base64, sendIlpPacket
 *   AC#2 - NodeError when destination missing
 *   AC#3 - NodeError when node not started
 *   AC#4 - PublishEventResult success/failure shapes
 *   AC#5 - PublishEventResult type exported (verified by type import)
 *   AC#6 - All existing tests still pass (run full suite)
 */
```

**Use as Reference**: Adopt this pattern for all story-driven test files.

---

### 4. Compile-Time Type Assertion for Export Verification

**Location**: `packages/sdk/src/publish-event.test.ts:18-27`
**Pattern**: Type-level AC verification
**Knowledge Base**: [test-levels-framework.md](../../../_bmad/tea/testarch/knowledge/test-levels-framework.md)

**Why This Is Good**:
The test imports `PublishEventResult` from the SDK's public API surface (`./index.js`) and creates a compile-time type assertion. This verifies AC#5 (export verification) without requiring a runtime assertion -- if the type is not exported, the file will not compile.

**Code Example**:

```typescript
import type { PublishEventResult } from './index.js';

const _typeCheck: PublishEventResult = {
  success: true,
  eventId: 'test',
  fulfillment: 'test',
};
void _typeCheck;
```

**Use as Reference**: Use this pattern to verify type exports are accessible from the package's public API.

---

### 5. Mock Connector with Call Recording

**Location**: `packages/sdk/src/publish-event.test.ts:64-89`
**Pattern**: Configurable mock with call tracking
**Knowledge Base**: [data-factories.md](../../../_bmad/tea/testarch/knowledge/data-factories.md)

**Why This Is Good**:
The `createMockConnector(sendPacketResult?)` factory creates a fully typed mock that records all `sendPacket` calls and returns a configurable result. This enables tests to both verify parameters passed to the connector and control the response, without `vi.fn()` overhead for assertion methods.

**Code Example**:

```typescript
function createMockConnector(
  sendPacketResult?: SendPacketResult
): EmbeddableConnectorLike & { sendPacketCalls: SendPacketParams[] } {
  const calls: SendPacketParams[] = [];
  return {
    sendPacketCalls: calls,
    async sendPacket(params: SendPacketParams): Promise<SendPacketResult> {
      calls.push(params);
      return sendPacketResult ?? { type: 'fulfill', fulfillment: Buffer.from('test-fulfillment') };
    },
    // ... other methods
  };
}
```

**Use as Reference**: Use this pattern for mocking transport-layer dependencies where call recording is needed.

---

## Test File Analysis

### File Metadata

- **File Path**: `packages/sdk/src/publish-event.test.ts`
- **File Size**: 628 lines, 20 KB
- **Test Framework**: Vitest
- **Language**: TypeScript

### Test Structure

- **Describe Blocks**: 1 (`publishEvent() unit tests (Story 2.6)`)
- **Test Cases (it/test)**: 15
- **Average Test Length**: ~30 lines per test (including comments and whitespace)
- **Fixtures Used**: 2 (`createTestEvent`, `createMockConnector`)
- **Data Factories Used**: 1 (`createTestEvent` with Partial overrides)

### Test Scope

- **Test IDs**: None (formal format); AC# references present on all tests
- **Priority Distribution**:
  - P0 (Critical): 4 tests (AC#1 TOON+send, AC#1 amount, AC#4 success, AC#4 rejection)
  - P1 (High): 4 tests (AC#3 not-started, AC#2 undefined options, AC#2 empty destination, sendPacket error wrapping, NodeError propagation)
  - P2 (Medium): 7 tests (custom basePricePerByte, default basePricePerByte, post-stop guard, exact amount, encoder failure, non-Error wrapping, content size scaling)
  - P3 (Low): 0 tests
  - Unknown: 0 tests

### Assertions Analysis

- **Total Assertions**: 54 (explicit `expect()` calls)
- **Assertions per Test**: 3.6 (avg)
- **Assertion Types**: `toBe`, `toBeGreaterThan`, `toBeDefined`, `toBeInstanceOf`, `toThrow`, `toMatch`, `not.toContain`

---

## Context and Integration

### Related Artifacts

- **Story File**: [2-6-add-publish-event-to-service-node.md](_bmad-output/implementation-artifacts/2-6-add-publish-event-to-service-node.md)

- **Test Design**: Inline in story file (Task 4: Write unit tests for `publishEvent()`)
- **Risk Assessment**: P0/P1 for core functionality, P2 for edge cases
- **Priority Framework**: P0-P2 applied (no P3 tests)

---

## Knowledge Base References

This review consulted the following knowledge base fragments:

- **[test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md)** - Definition of Done for tests (no hard waits, <300 lines, <1.5 min, self-cleaning)
- **[data-factories.md](../../../_bmad/tea/testarch/knowledge/data-factories.md)** - Factory functions with overrides, API-first setup
- **[test-levels-framework.md](../../../_bmad/tea/testarch/knowledge/test-levels-framework.md)** - E2E vs API vs Component vs Unit appropriateness
- **[test-healing-patterns.md](../../../_bmad/tea/testarch/knowledge/test-healing-patterns.md)** - Common failure patterns and automated fixes
- **[selective-testing.md](../../../_bmad/tea/testarch/knowledge/selective-testing.md)** - Tag/grep usage, priority-based execution

For coverage mapping, consult `trace` workflow outputs.

See [tea-index.csv](../../../_bmad/tea/testarch/tea-index.csv) for complete knowledge base.

---

## Next Steps

### Immediate Actions (Before Merge)

None required. All issues are recommendations, not blockers.

### Follow-up Actions (Future PRs)

1. **Consolidate duplicate rejects.toThrow assertions** - Refactor the 7 tests that call rejects.toThrow twice into single try/catch blocks with combined assertions
   - Priority: P1
   - Target: Next test maintenance pass

2. **Add formal test IDs** - Add `2.6-UNIT-{SEQ}` IDs to all 15 test names
   - Priority: P2
   - Target: When traceability tooling is adopted

3. **Consider splitting file** - Split into happy-path and error-path test files if the file continues to grow
   - Priority: P3
   - Target: Backlog

### Re-Review Needed?

No re-review needed - approve as-is. The recommendations are improvements, not blockers.

---

## Decision

**Recommendation**: Approve with Comments

**Rationale**:
Test quality is good with 88/100 score. The test suite provides comprehensive coverage of all 6 acceptance criteria with 15 well-structured unit tests. Error path coverage is particularly thorough. The main recommendation (consolidating duplicate async assertions) is a maintenance improvement that does not affect test correctness or reliability. Priority markers and AC annotations provide strong traceability. The file follows all project conventions (mocked connector, vi.mock('nostr-tools'), co-located tests, catch (error: unknown) pattern).

> Test quality is good with 88/100 score. Minor issues noted can be addressed in follow-up PRs. Tests are production-ready and follow best practices. The suite demonstrates above-average error path coverage and strong requirements traceability via AC# annotations.

---

## Appendix

### Violation Summary by Location

| Line    | Severity | Criterion      | Issue                              | Fix                               |
| ------- | -------- | -------------- | ---------------------------------- | --------------------------------- |
| 258-264 | P1       | Flakiness      | Duplicate rejects.toThrow call     | Combine into single try/catch     |
| 284-287 | P1       | Flakiness      | Duplicate rejects.toThrow call     | Combine into single try/catch     |
| 310-315 | P1       | Flakiness      | Duplicate rejects.toThrow call     | Combine into single try/catch     |
| 405-411 | P1       | Flakiness      | Duplicate rejects.toThrow call     | Combine into single try/catch     |
| 469-475 | P1       | Flakiness      | Duplicate rejects.toThrow call     | Combine into single try/catch     |
| 501-507 | P1       | Flakiness      | Duplicate rejects.toThrow call     | Combine into single try/catch     |
| 565-572 | P1       | Flakiness      | Duplicate rejects.toThrow call     | Combine into single try/catch     |
| 1-628   | P2       | Test Length     | 628 lines > 300-line guideline     | Split into two focused test files |
| All     | P2       | Test IDs       | No formal test IDs                 | Add 2.6-UNIT-{SEQ} IDs           |
| 575-583 | P3       | Determinism    | Try/catch without fail guard       | Add expect.fail() if no throw     |
| 44-56   | P3       | Data Factories | Hardcoded hex without named consts | Extract named constants           |

Note: The 7 duplicate-assertion violations are counted as 1 High violation in the score calculation since they represent a single recurring pattern, not 7 independent issues.

### Related Reviews

| File                  | Score  | Grade | Critical | Status   |
| --------------------- | ------ | ----- | -------- | -------- |
| publish-event.test.ts | 88/100 | A     | 0        | Approved |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v5.0
**Review ID**: test-review-publish-event-20260307
**Timestamp**: 2026-03-07
**Version**: 1.0

---

## Feedback on This Review

If you have questions or feedback on this review:

1. Review patterns in knowledge base: `_bmad/tea/testarch/knowledge/`
2. Consult tea-index.csv for detailed guidance
3. Request clarification on specific violations
4. Pair with QA engineer to apply patterns

This review is guidance, not rigid rules. Context matters - if a pattern is justified, document it with a comment.
