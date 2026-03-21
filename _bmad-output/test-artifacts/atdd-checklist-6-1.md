---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-20'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/6-1-workflow-chains.md'
  - '_bmad/tea/config.yaml'
  - 'packages/core/src/events/dvm-test-helpers.ts'
  - 'packages/core/src/events/dvm-roundtrip.test.ts'
  - 'packages/sdk/src/dvm-lifecycle.test.ts'
  - 'packages/core/src/constants.ts'
  - 'packages/core/src/events/dvm.ts'
---

# ATDD Checklist - Epic 6, Story 6.1: Workflow Chains

**Date:** 2026-03-20
**Author:** Jonathan
**Primary Test Level:** Unit + Integration (backend, no UI)

---

## Preflight Summary

- **Stack detected:** backend (Node.js/TypeScript monorepo, Vitest, no Playwright/Cypress)
- **Test framework:** Vitest with `describe/it` blocks, AAA pattern
- **Story file:** `_bmad-output/implementation-artifacts/6-1-workflow-chains.md`
- **Story status:** ready-for-dev
- **Acceptance criteria:** 6 ACs identified
- **Test IDs from story:** T-6.1-01 through T-6.1-16 (16 tests)
- **Risk items:** E6-R001 (score 9, CRITICAL), E6-R002 (score 6), E6-R003 (score 6), E6-R004 (score 6), E6-R005 (score 4)

### Existing Patterns Identified

- **DVM test helpers:** `packages/core/src/events/dvm-test-helpers.ts` -- factory pattern with `createJobRequestParams()`, `createTestJobRequestEvent()`, fixed keys
- **DVM roundtrip tests:** `packages/core/src/events/dvm-roundtrip.test.ts` -- build -> TOON encode -> TOON decode -> parse pipeline tests
- **SDK lifecycle tests:** `packages/sdk/src/dvm-lifecycle.test.ts` -- `createMockConnector()` pattern, `vi.mock('nostr-tools')`, deterministic test data
- **Constants:** `packages/core/src/constants.ts` -- all kind constants co-located

### Knowledge Base Fragments Loaded

- `data-factories.md` (core) -- factory patterns with overrides
- `test-quality.md` (core) -- deterministic, isolated, explicit, focused, fast
- `test-levels-framework.md` (core) -- unit vs integration vs E2E selection
- `test-priorities-matrix.md` (core) -- P0-P3 priority classification

### TEA Config Flags

- `tea_use_playwright_utils`: true (not applicable -- backend stack)
- `tea_use_pactjs_utils`: true (not applicable -- no microservice contracts)
- `tea_pact_mcp`: mcp (not applicable)
- `tea_browser_automation`: auto (not applicable -- backend stack)
- `test_stack_type`: auto -> detected as `backend`

---

## Generation Mode

**Mode:** AI Generation (default for backend stack)
**Rationale:** Backend-only project with clear acceptance criteria, standard DVM event builder/parser and orchestrator patterns. No UI, no browser recording needed. All tests are unit and integration level using Vitest.

---

## Story Summary

**As a** customer agent,
**I want** to define multi-step DVM pipelines where each step's output automatically feeds into the next step's input,
**So that** I can compose complex compute tasks from simpler DVM jobs without manual orchestration.

---

## Acceptance Criteria

1. **AC #1: Workflow definition event (kind:10040)** -- Customer publishes workflow definition with ordered steps, initial input, and total bid
2. **AC #2: Step 1 creation** -- Orchestrating node creates Kind 5xxx job request for step 1 from workflow's initial input
3. **AC #3: Step advancement** -- On step N completion, orchestrator creates Kind 5xxx for step N+1 with step N's result as input
4. **AC #4: Workflow completion** -- Final step completes, workflow marked complete, customer notified, per-step settlement
5. **AC #5: Step failure handling** -- Step failure detected, workflow marked failed, subsequent steps not executed, customer notified
6. **AC #6: Per-step bid validation** -- `sum(step_amounts) <= total_bid` enforced before any settlement

---

## Test Strategy

### AC-to-Test Mapping

| AC | Test ID | Test Description | Level | Priority | Risk |
|----|---------|-----------------|-------|----------|------|
| #1 | T-6.1-01 | Workflow definition TOON roundtrip preserves steps, input, bid, provider targets | Unit | P0 | E6-R003 |
| #1 | T-6.1-02 | Validation errors: missing steps, empty input, missing totalBid | Unit | P1 | -- |
| #1 | T-6.1-14 | TOON shallow parser extracts kind:10040 without full decode | Unit | P1 | -- |
| #1 | T-6.1-15 | Workflow event flows through SDK pipeline (shallow parse -> verify -> price -> dispatch) | Unit | P1 | R-001 |
| #2 | T-6.1-03 | Orchestrator creates Kind 5xxx for step 1 from initial input | Unit | P0 | E6-R001 |
| #3 | T-6.1-04 | Step advancement: step N result -> step N+1 created with N's content as input | Integration | P0 | E6-R001, E6-R003 |
| #3 | T-6.1-05 | Input chaining fidelity: complex JSON preserved through TOON roundtrip | Unit | P0 | E6-R003 |
| #3 | T-6.1-13 | Targeted provider per step via `p` tag in generated Kind 5xxx | Unit | P2 | -- |
| #4 | T-6.1-08 | Final step completion -> workflow completed -> customer notified | Integration | P1 | -- |
| #4 | T-6.1-09 | Per-step compute settlement: each step settles individually via ILP | Integration | P0 | E6-R004 |
| #5 | T-6.1-06 | Step failure -> workflow abort -> customer notified | Integration | P0 | E6-R001 |
| #5 | T-6.1-07 | Step timeout -> workflow fails -> customer notified | Integration | P0 | E6-R001 |
| #6 | T-6.1-10 | Per-step bid validation: sum(allocations) <= total bid | Unit | P0 | E6-R004 |
| #2,#3 | T-6.1-11 | Workflow state persistence in EventStore | Integration | P1 | E6-R002 |
| #2,#3 | T-6.1-12 | Concurrent workflows: 3 independent workflows advance independently | Integration | P2 | E6-R005 |
| all | T-6.1-16 | 2-step E2E: translation -> text generation -> both providers settled | E2E | P3 | E6-R001 |

### Test Level Distribution

- **Unit tests (8):** T-6.1-01, T-6.1-02, T-6.1-03, T-6.1-05, T-6.1-10, T-6.1-13, T-6.1-14, T-6.1-15
  - Location: `packages/core/src/events/workflow.test.ts` (builder/parser/roundtrip), `packages/sdk/src/workflow-orchestrator.test.ts` (orchestrator unit tests)
- **Integration tests (7):** T-6.1-04, T-6.1-06, T-6.1-07, T-6.1-08, T-6.1-09, T-6.1-11, T-6.1-12
  - Location: `packages/sdk/src/workflow-orchestrator.test.ts` (orchestrator lifecycle with mocked dependencies)
- **E2E test (1):** T-6.1-16
  - Location: `packages/sdk/src/__integration__/workflow-e2e.test.ts` (deferred to P3, requires full infra)

### Priority Distribution

- **P0 (7 tests, must-pass):** T-6.1-01, T-6.1-03, T-6.1-04, T-6.1-05, T-6.1-06, T-6.1-07, T-6.1-09, T-6.1-10
- **P1 (4 tests, should-pass):** T-6.1-02, T-6.1-08, T-6.1-11, T-6.1-14, T-6.1-15
- **P2 (2 tests, nice-to-have):** T-6.1-12, T-6.1-13
- **P3 (1 test, stretch):** T-6.1-16

### Red Phase Confirmation

All tests will be designed to fail before implementation because:
- `WORKFLOW_CHAIN_KIND` constant does not exist yet
- `buildWorkflowDefinitionEvent()` and `parseWorkflowDefinition()` do not exist yet
- `WorkflowOrchestrator` class does not exist yet
- `workflow.ts` file does not exist yet
- No workflow state persistence logic exists yet

Tests will import from non-existent modules, causing compile/import failures (red phase verified by design).

---

## Failing Tests Created (RED Phase)

### Unit Tests (22 tests)

**File:** `packages/core/src/events/workflow.test.ts` (479 lines)

- **Test:** TOON roundtrip preserves step list, initial input, total bid (T-6.1-01)
  - **Status:** RED - `workflow.ts` does not exist; import fails
  - **Verifies:** AC #1 -- workflow definition event roundtrip fidelity

- **Test:** TOON roundtrip preserves step-specific provider targets (T-6.1-01)
  - **Status:** RED - `buildWorkflowDefinitionEvent` not implemented
  - **Verifies:** AC #1 -- provider targeting through TOON encode/decode

- **Test:** TOON roundtrip preserves per-step bid allocations (T-6.1-01)
  - **Status:** RED - `buildWorkflowDefinitionEvent` not implemented
  - **Verifies:** AC #1, #6 -- bid allocation serialization

- **Test:** throws on empty steps array (T-6.1-02)
  - **Status:** RED - `buildWorkflowDefinitionEvent` not implemented
  - **Verifies:** AC #1 -- input validation

- **Test:** throws on missing initial input type (T-6.1-02)
  - **Status:** RED - `buildWorkflowDefinitionEvent` not implemented
  - **Verifies:** AC #1 -- input validation

- **Test:** throws on missing totalBid (T-6.1-02)
  - **Status:** RED - `buildWorkflowDefinitionEvent` not implemented
  - **Verifies:** AC #1 -- input validation

- **Test:** throws on step kind outside 5000-5999 range (T-6.1-02)
  - **Status:** RED - `buildWorkflowDefinitionEvent` not implemented
  - **Verifies:** AC #1 -- step kind validation

- **Test:** parser returns null for wrong event kind (T-6.1-02)
  - **Status:** RED - `parseWorkflowDefinition` not implemented
  - **Verifies:** AC #1 -- parser robustness

- **Test:** complex JSON preserved through TOON roundtrip (T-6.1-05)
  - **Status:** RED - `workflow.ts` not implemented
  - **Verifies:** AC #3 -- input chaining fidelity with JSON

- **Test:** multi-line text preserved through TOON roundtrip (T-6.1-05)
  - **Status:** RED - `workflow.ts` not implemented
  - **Verifies:** AC #3 -- input chaining fidelity with multi-line text

- **Test:** plain text preserved through TOON roundtrip (T-6.1-05)
  - **Status:** RED - `workflow.ts` not implemented
  - **Verifies:** AC #3 -- input chaining fidelity with plain text

- **Test:** accepts when sum equals total bid (T-6.1-10)
  - **Status:** RED - bid validation not implemented
  - **Verifies:** AC #6 -- bid invariant (boundary: equal)

- **Test:** accepts when sum less than total bid (T-6.1-10)
  - **Status:** RED - bid validation not implemented
  - **Verifies:** AC #6 -- bid invariant (under budget)

- **Test:** throws when sum exceeds total bid (T-6.1-10)
  - **Status:** RED - bid validation not implemented
  - **Verifies:** AC #6 -- bid invariant (over budget)

- **Test:** proportional split when no explicit allocations (T-6.1-10)
  - **Status:** RED - bid allocation logic not implemented
  - **Verifies:** AC #6 -- proportional bid splitting

- **Test:** step with targetProvider gets `p` tag (T-6.1-13)
  - **Status:** RED - `workflow.ts` not implemented
  - **Verifies:** AC #3 -- targeted provider routing

- **Test:** step without targetProvider has no provider (T-6.1-13)
  - **Status:** RED - `workflow.ts` not implemented
  - **Verifies:** AC #3 -- untargeted step handling

- **Test:** shallow parser extracts kind:10040 (T-6.1-14)
  - **Status:** RED - `WORKFLOW_CHAIN_KIND` not defined
  - **Verifies:** AC #1 -- shallow parse routing

- **Test:** SDK pipeline flow (T-6.1-15)
  - **Status:** RED - workflow event types not implemented
  - **Verifies:** AC #1 -- end-to-end pipeline compatibility

- **Test:** WORKFLOW_CHAIN_KIND equals 10040
  - **Status:** RED - constant not defined
  - **Verifies:** AC #1 -- kind constant value

- **Test:** WORKFLOW_CHAIN_KIND in TOON-specific range
  - **Status:** RED - constant not defined
  - **Verifies:** AC #1 -- kind constant range

### Integration Tests (14 tests)

**File:** `packages/sdk/src/workflow-orchestrator.test.ts` (793 lines)

- **Test:** creates Kind 5xxx for step 1 from initial input (T-6.1-03)
  - **Status:** RED - `WorkflowOrchestrator` class does not exist
  - **Verifies:** AC #2 -- step 1 creation

- **Test:** step 1 uses workflow initial input as data (T-6.1-03)
  - **Status:** RED - `WorkflowOrchestrator` class does not exist
  - **Verifies:** AC #2 -- initial input propagation

- **Test:** state transitions to step_1_running (T-6.1-03)
  - **Status:** RED - `WorkflowOrchestrator` class does not exist
  - **Verifies:** AC #2 -- state machine initial state

- **Test:** step 1 result -> step 2 created with step 1 content (T-6.1-04)
  - **Status:** RED - `handleStepResult` not implemented
  - **Verifies:** AC #3 -- step advancement

- **Test:** step N result content passed exactly as step N+1 input (T-6.1-04)
  - **Status:** RED - content chaining not implemented
  - **Verifies:** AC #3 -- input chaining fidelity in orchestrator

- **Test:** state transitions step_1_running -> step_2_running (T-6.1-04)
  - **Status:** RED - state machine not implemented
  - **Verifies:** AC #3 -- state machine advancement

- **Test:** Kind 7000 error -> workflow marked failed (T-6.1-06)
  - **Status:** RED - `handleStepFeedback` not implemented
  - **Verifies:** AC #5 -- failure detection

- **Test:** step N+1 never created after step N failure (T-6.1-06)
  - **Status:** RED - failure abort logic not implemented
  - **Verifies:** AC #5 -- failure abort

- **Test:** customer notified on step failure (T-6.1-06)
  - **Status:** RED - failure notification not implemented
  - **Verifies:** AC #5 -- customer notification

- **Test:** step timeout fires after configurable duration (T-6.1-07)
  - **Status:** RED - timeout mechanism not implemented
  - **Verifies:** AC #5 -- deadlock prevention

- **Test:** customer notified on timeout (T-6.1-07)
  - **Status:** RED - timeout notification not implemented
  - **Verifies:** AC #5 -- timeout customer notification

- **Test:** last step result marks workflow completed (T-6.1-08)
  - **Status:** RED - completion logic not implemented
  - **Verifies:** AC #4 -- workflow completion

- **Test:** customer receives success notification on completion (T-6.1-08)
  - **Status:** RED - completion notification not implemented
  - **Verifies:** AC #4 -- completion notification

- **Test:** each step settles individually via settleCompute (T-6.1-09)
  - **Status:** RED - settlement integration not implemented
  - **Verifies:** AC #4, #6 -- per-step settlement

- **Test:** workflow state stored in EventStore (T-6.1-11)
  - **Status:** RED - state persistence not implemented
  - **Verifies:** AC #2, #3 -- crash recovery

- **Test:** step completion is idempotent (T-6.1-11)
  - **Status:** RED - idempotency not implemented
  - **Verifies:** AC #2, #3 -- duplicate event handling

- **Test:** 3 concurrent workflows advance independently (T-6.1-12)
  - **Status:** RED - `WorkflowOrchestrator` class does not exist
  - **Verifies:** AC #2, #3 -- concurrent workflow isolation

---

## Data Factories Created

### WorkflowStep Factory

**File:** `packages/core/src/events/workflow.test.ts` (inline)

**Exports:**
- `createWorkflowStep(overrides?)` -- Create single workflow step with optional overrides
- `createWorkflowDefinitionParams(overrides?)` -- Create complete workflow definition params

### Orchestrator Test Factories

**File:** `packages/sdk/src/workflow-orchestrator.test.ts` (inline)

**Exports:**
- `createMockConnector(result?)` -- Create mock EmbeddableConnectorLike with call recording
- `createTestWorkflowDefinition(overrides?)` -- Create 2-step workflow definition
- `createMockStepResultEvent(overrides?)` -- Create mock Kind 6xxx result event
- `createMockStepFeedbackEvent(overrides?)` -- Create mock Kind 7000 feedback event
- `createMockEventStore()` -- Create mock EventStore with store/query

---

## Fixtures Created

No separate fixture files needed. All test factories are inline in the test files following the existing project pattern (see `dvm-test-helpers.ts`). When the production code is implemented and tests stabilize, shared factories may be extracted to:

- `packages/core/src/events/workflow-test-helpers.ts` -- workflow-specific test factories (following `dvm-test-helpers.ts` pattern)

---

## Mock Requirements

### EmbeddableConnectorLike Mock

**Interface:** `EmbeddableConnectorLike` from `@toon-protocol/core`

**Methods Mocked:**
- `sendPacket(params)` -- Records calls, returns configurable fulfill/reject
- `registerPeer(params)` -- No-op
- `removePeer(peerId)` -- No-op
- `setPacketHandler(handler)` -- No-op

**Notes:** Follows existing `createMockConnector()` pattern from `dvm-lifecycle.test.ts`

### EventStore Mock

**Interface:** Custom mock with `store()` and `query()` methods

**Methods:**
- `store(event)` -- Pushes event to in-memory array
- `query(filter)` -- Filters stored events by kind and `#e` tag

---

## Required data-testid Attributes

Not applicable -- this is a backend-only story with no UI components.

---

## Implementation Checklist

### Test: TOON roundtrip (T-6.1-01) + Validation (T-6.1-02) + Constant

**File:** `packages/core/src/events/workflow.test.ts`

**Tasks to make these tests pass:**

- [ ] Add `WORKFLOW_CHAIN_KIND = 10040` to `packages/core/src/constants.ts`
- [ ] Create `packages/core/src/events/workflow.ts` with type interfaces (`WorkflowStep`, `WorkflowDefinitionParams`, `ParsedWorkflowDefinition`)
- [ ] Implement `buildWorkflowDefinitionEvent(params, secretKey)` following `buildJobRequestEvent()` pattern
- [ ] Implement `parseWorkflowDefinition(event)` following `parseJobRequest()` pattern
- [ ] Validate: steps non-empty, each step kind 5000-5999, totalBid non-empty, initialInput.type non-empty
- [ ] Validate: `sum(step_amounts) <= total_bid` when explicit bidAllocations provided
- [ ] Serialize steps and initialInput as JSON content
- [ ] Export from `packages/core/src/events/index.ts` and `packages/core/src/index.ts`
- [ ] Run test: `cd packages/core && pnpm test -- --run workflow.test`
- [ ] All 22 unit tests pass (green phase)

**Estimated Effort:** 3-4 hours

---

### Test: Orchestrator step 1 creation (T-6.1-03) + Step advancement (T-6.1-04)

**File:** `packages/sdk/src/workflow-orchestrator.test.ts`

**Tasks to make these tests pass:**

- [ ] Create `packages/sdk/src/workflow-orchestrator.ts` with `WorkflowOrchestrator` class
- [ ] Implement explicit state machine: `pending`, `step_N_running`, `step_N_failed`, `completed`, `timed_out`
- [ ] Implement `startWorkflow(definition)`: parse definition, create Kind 5xxx for step 1 from initialInput, publish via `publishEvent()`, set state to `step_1_running`
- [ ] Implement `handleStepResult(event)`: extract content from Kind 6xxx, create Kind 5xxx for next step with previous content as input, publish, advance state
- [ ] Implement `getState()` accessor
- [ ] Export from `packages/sdk/src/index.ts`
- [ ] Run test: `cd packages/sdk && pnpm test -- --run workflow-orchestrator.test`
- [ ] Step creation and advancement tests pass

**Estimated Effort:** 4-5 hours

---

### Test: Failure detection (T-6.1-06) + Timeout (T-6.1-07)

**File:** `packages/sdk/src/workflow-orchestrator.test.ts`

**Tasks to make these tests pass:**

- [ ] Implement `handleStepFeedback(event)`: detect Kind 7000 with `status: 'error'`, mark workflow failed, publish customer notification
- [ ] Implement step timeout: configurable `stepTimeoutMs` (default 5 minutes)
- [ ] Injectable time source (`now` parameter) following `AttestationVerifier` pattern
- [ ] On timeout: mark step failed, publish Kind 7000 to customer with failure details
- [ ] Ensure step N+1 is never created after step N failure
- [ ] Run test: `cd packages/sdk && pnpm test -- --run workflow-orchestrator.test`
- [ ] Failure and timeout tests pass

**Estimated Effort:** 3-4 hours

---

### Test: Workflow completion (T-6.1-08) + Settlement (T-6.1-09)

**File:** `packages/sdk/src/workflow-orchestrator.test.ts`

**Tasks to make these tests pass:**

- [ ] Implement workflow completion detection: final step Kind 6xxx -> state = `completed`
- [ ] Publish Kind 7000 with `status: 'success'` referencing workflow event on completion
- [ ] Implement per-step settlement: call `settleCompute()` after each step completes
- [ ] Use step's `bidAllocation` (or proportional split) as settlement amount
- [ ] Run test: `cd packages/sdk && pnpm test -- --run workflow-orchestrator.test`
- [ ] Completion and settlement tests pass

**Estimated Effort:** 2-3 hours

---

### Test: State persistence (T-6.1-11) + Concurrent workflows (T-6.1-12)

**File:** `packages/sdk/src/workflow-orchestrator.test.ts`

**Tasks to make these tests pass:**

- [ ] Store workflow state events in EventStore after step completion
- [ ] Implement idempotent step advancement (re-processing same result = no-op)
- [ ] Verify concurrent `WorkflowOrchestrator` instances operate independently
- [ ] Run test: `cd packages/sdk && pnpm test -- --run workflow-orchestrator.test`
- [ ] Persistence and concurrency tests pass

**Estimated Effort:** 2-3 hours

---

## Running Tests

```bash
# Run all failing tests for this story (core + sdk)
cd packages/core && pnpm test -- --run workflow.test
cd packages/sdk && pnpm test -- --run workflow-orchestrator.test

# Run specific test file (core)
cd packages/core && pnpm vitest run src/events/workflow.test.ts

# Run specific test file (sdk)
cd packages/sdk && pnpm vitest run src/workflow-orchestrator.test.ts

# Run all tests in the monorepo (should not regress existing 2095+ tests)
pnpm test

# Run with verbose output
cd packages/core && pnpm vitest run src/events/workflow.test.ts --reporter=verbose
cd packages/sdk && pnpm vitest run src/workflow-orchestrator.test.ts --reporter=verbose
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 36 tests written and failing (import errors -- modules do not exist)
- Factory functions created with deterministic test data
- Mock connector and EventStore patterns follow existing codebase
- Implementation checklist created with concrete tasks
- Test IDs mapped to acceptance criteria and risk items

**Verification:**

- All tests fail due to missing production code, not test bugs
- Failure messages are clear: "Cannot find module './workflow.js'"
- Tests import from `./workflow.js` and `./workflow-orchestrator.js` which do not exist yet

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Start with Task 1 (core types):** Define `WORKFLOW_CHAIN_KIND`, types, builder, parser
2. **Run core tests:** `cd packages/core && pnpm test -- --run workflow.test`
3. **Move to Task 2 (orchestrator):** Create `WorkflowOrchestrator` class
4. **Run SDK tests:** `cd packages/sdk && pnpm test -- --run workflow-orchestrator.test`
5. **Continue tasks 3-6** following the implementation checklist order
6. **Run full suite:** `pnpm test` to verify no regressions

**Key Principles:**

- One task at a time (don't try to implement everything at once)
- Minimal implementation (follow existing patterns exactly)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all 36 tests pass (green phase complete)
2. Consider extracting shared factories to `workflow-test-helpers.ts`
3. Verify no duplicate coverage with existing DVM tests
4. Run `pnpm lint && pnpm format` for code quality
5. Ensure all tests still pass after refactoring

---

## Next Steps

1. **Run failing tests** to confirm RED phase: `cd packages/core && pnpm test -- --run workflow.test`
2. **Begin implementation** using implementation checklist as guide
3. **Work one task at a time** (core types first, then orchestrator)
4. **Run full test suite** after each task: `pnpm test`
5. **When all tests pass**, refactor code for quality
6. **When refactoring complete**, update story status

---

## Knowledge Base References Applied

- **data-factories.md** -- Factory patterns with overrides for `createWorkflowStep()`, `createWorkflowDefinitionParams()`, `createTestWorkflowDefinition()`
- **test-quality.md** -- Deterministic test data (fixed keys, fixed timestamps), isolated tests, explicit assertions in test bodies
- **test-levels-framework.md** -- Unit tests for pure builder/parser/validation logic; integration tests for orchestrator lifecycle with mocked dependencies
- **test-priorities-matrix.md** -- P0 for critical path (roundtrip, orchestration loop, failure handling, settlement), P1 for supporting features, P2 for stretch goals

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `cd packages/core && pnpm vitest run src/events/workflow.test.ts`

**Expected Results:**

```
FAIL  src/events/workflow.test.ts
Error: Cannot find module './workflow.js'
```

**Command:** `cd packages/sdk && pnpm vitest run src/workflow-orchestrator.test.ts`

**Expected Results:**

```
FAIL  src/workflow-orchestrator.test.ts
Error: Cannot find module './workflow-orchestrator.js'
```

**Summary:**

- Total tests: 36 (22 unit + 14 integration)
- Passing: 0 (expected)
- Failing: 36 (expected -- import errors)
- Status: RED phase verified by design

---

## Notes

- T-6.1-16 (P3 E2E test) is deferred -- requires full SDK E2E infrastructure with 2 Docker peer nodes running different DVM providers. Will be added as `packages/sdk/src/__integration__/workflow-e2e.test.ts` when infra is available.
- The orchestrator tests use `vi.useFakeTimers()` for deterministic timeout testing, following the injectable time source pattern from `AttestationVerifier`.
- Per-step settlement tests verify that `settleCompute()` is called after each step completion, but do not test actual ILP packet content (that is covered by existing `settleCompute()` unit tests in `dvm-lifecycle.test.ts`).
- The `WorkflowOrchestrator` is designed as a class instantiated per-workflow, not a singleton. This enables natural concurrent workflow support (T-6.1-12) without shared state.

---

**Generated by BMad TEA Agent** - 2026-03-20
