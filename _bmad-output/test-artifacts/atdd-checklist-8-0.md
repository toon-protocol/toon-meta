---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-22'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/8-0-arweave-storage-dvm-provider.md'
  - 'packages/core/src/events/dvm.ts'
  - 'packages/core/src/events/dvm-test-helpers.ts'
  - 'packages/sdk/src/pricing-validator.ts'
  - 'packages/sdk/src/pricing-validator.test.ts'
  - 'packages/sdk/src/handler-context.ts'
  - 'packages/sdk/src/handler-registry.test.ts'
  - 'packages/core/src/constants.ts'
  - 'packages/core/src/compose.ts'
---

# ATDD Checklist - Epic 8, Story 0: Arweave Storage DVM Provider (kind:5094)

**Date:** 2026-03-22
**Author:** Jonathan
**Primary Test Level:** Unit (with Integration planned)

---

## Story Summary

As a TOON agent, I want to upload blobs to permanent storage by sending a single ILP packet to an Arweave DVM provider, so that I can store files permanently without knowing about Arweave, holding AR tokens, or making multiple round trips.

**As a** TOON agent
**I want** to upload blobs to permanent storage via ILP packets to an Arweave DVM provider
**So that** I can store files permanently without Arweave knowledge, AR tokens, or multiple round trips

---

## Acceptance Criteria

1. **AC #1** - kind:5094 event builder: `buildBlobStorageRequest()` produces valid kind:5094 event with base64 blob in `i` tag, `bid` tag, `output` tag
2. **AC #2** - kind:5094 event parser: `parseBlobStorageRequest()` returns parsed data or null for malformed events
3. **AC #3** - Chunked upload params: parser extracts `uploadId`, `chunkIndex`, `totalChunks` from param tags
4. **AC #4** - Provider service discovery: SkillDescriptor auto-derives kind:5094 from kindPricing config
5. **AC #5** - Single-packet upload (prepaid): handler extracts blob, uploads via Turbo, returns txId in FULFILL data
6. **AC #6** - Insufficient payment rejection: pricing validator rejects with F04 before handler invoked
7. **AC #7** - Arweave retrieval verification: fetching `arweave.net/<tx-id>` returns original bytes
8. **AC #8** - Chunk splitting: client helper splits large blobs into chunked ILP PREPAREs
9. **AC #9** - Chunk accumulation: provider assembles all chunks, uploads to Arweave on final chunk
10. **AC #10** - Chunk timeout: provider discards partial chunks after timeout
11. **AC #11** - Chunk edge cases: duplicate rejection, out-of-order acceptance, memory cap

---

## Failing Tests Created (RED Phase)

### Unit Tests - Core Package (12 tests)

**File:** `packages/core/src/events/arweave-storage.test.ts` (210 lines)

- **Test:** [P0] build -> parse roundtrip returns original { blobData, contentType }
  - **Status:** RED - skipped (source module not implemented)
  - **Verifies:** AC #1, #2 roundtrip
  - **Test ID:** 8.0-UNIT-001

- **Test:** [P0] built event has kind 5094
  - **Status:** RED - skipped
  - **Verifies:** AC #1 kind constant

- **Test:** [P0] built event has correct tags: i (base64 blob), bid (usdc), output
  - **Status:** RED - skipped
  - **Verifies:** AC #1 tag structure

- **Test:** [P1] roundtrip with custom contentType preserves the type
  - **Status:** RED - skipped
  - **Verifies:** AC #1 content type handling

- **Test:** [P1] default contentType is application/octet-stream when not provided
  - **Status:** RED - skipped
  - **Verifies:** AC #1 default behavior

- **Test:** [P0] returns null for missing i tag
  - **Status:** RED - skipped
  - **Verifies:** AC #2 malformed event rejection
  - **Test ID:** 8.0-UNIT-002

- **Test:** [P0] returns null for invalid base64 in i tag
  - **Status:** RED - skipped
  - **Verifies:** AC #2 malformed event rejection

- **Test:** [P0] returns null for wrong kind (not 5094)
  - **Status:** RED - skipped
  - **Verifies:** AC #2 kind validation

- **Test:** [P1] returns null for missing bid tag
  - **Status:** RED - skipped
  - **Verifies:** AC #2 required tag validation

- **Test:** [P0] uploadId, chunkIndex, totalChunks roundtrip correctly
  - **Status:** RED - skipped
  - **Verifies:** AC #3 chunked params
  - **Test ID:** 8.0-UNIT-003

- **Test:** [P1] parser returns undefined for optional chunk params when not present
  - **Status:** RED - skipped
  - **Verifies:** AC #3 optional params

- **Test:** [P1] param tags are correctly structured as [param, key, value]
  - **Status:** RED - skipped
  - **Verifies:** AC #3 tag structure

### Unit Tests - SDK Arweave DVM Handler (6 tests)

**File:** `packages/sdk/src/arweave/arweave-dvm-handler.test.ts` (185 lines)

- **Test:** [P0] valid single-packet request -> calls turboAdapter.upload -> returns txId in accept data
  - **Status:** RED - skipped (source module not implemented)
  - **Verifies:** AC #5
  - **Test ID:** 8.0-UNIT-004

- **Test:** [P0] returns { accept: true, data: txId } directly -- NOT via ctx.accept()
  - **Status:** RED - skipped
  - **Verifies:** AC #5 response format (HandlePacketAcceptResponse.data)

- **Test:** [P0] malformed event (bad parse) -> rejects with error
  - **Status:** RED - skipped
  - **Verifies:** AC #5 error handling
  - **Test ID:** 8.0-UNIT-005

- **Test:** [P0] intermediate chunk -> returns ack:<chunkIndex>
  - **Status:** RED - skipped
  - **Verifies:** AC #9
  - **Test ID:** 8.0-UNIT-006

- **Test:** [P0] final chunk (all received) -> uploads assembled blob -> returns txId
  - **Status:** RED - skipped
  - **Verifies:** AC #9

### Unit Tests - SDK Chunk Manager (7 tests)

**File:** `packages/sdk/src/arweave/chunk-manager.test.ts` (155 lines)

- **Test:** [P0] sequential chunks -> complete: true on last chunk, assembled contains concatenated data
  - **Status:** RED - skipped (source module not implemented)
  - **Verifies:** AC #9
  - **Test ID:** 8.0-UNIT-007

- **Test:** [P0] out-of-order chunks -> accepted, assembled in correct order
  - **Status:** RED - skipped
  - **Verifies:** AC #11
  - **Test ID:** 8.0-UNIT-008

- **Test:** [P0] duplicate chunkIndex -> rejected
  - **Status:** RED - skipped
  - **Verifies:** AC #11
  - **Test ID:** 8.0-UNIT-009

- **Test:** [P0] timeout -> cleanup discards partial data
  - **Status:** RED - skipped
  - **Verifies:** AC #10
  - **Test ID:** 8.0-UNIT-010

- **Test:** [P0] rejects new uploadIds when memory cap reached
  - **Status:** RED - skipped
  - **Verifies:** AC #11
  - **Test ID:** 8.0-UNIT-011

- **Test:** [P1] cleanup frees a slot for new uploads
  - **Status:** RED - skipped
  - **Verifies:** AC #11

### Unit Tests - SDK Client Helpers (4 tests)

**File:** `packages/sdk/src/arweave/chunked-upload.test.ts` (130 lines)

- **Test:** [P0] small blob -> calls publishEvent() once with correct amount override -> returns txId
  - **Status:** RED - skipped (source module not implemented)
  - **Verifies:** AC #8
  - **Test ID:** 8.0-UNIT-013

- **Test:** [P0] splits blob into correct number of chunks with uploadId, chunkIndex, totalChunks
  - **Status:** RED - skipped
  - **Verifies:** AC #8
  - **Test ID:** 8.0-UNIT-014

- **Test:** [P1] all chunks share the same uploadId (UUID)
  - **Status:** RED - skipped
  - **Verifies:** AC #8

- **Test:** [P0] returns txId from the final chunk FULFILL data
  - **Status:** RED - skipped
  - **Verifies:** AC #8
  - **Test ID:** 8.0-UNIT-015

### Unit Tests - SDK Service Discovery (2 tests)

**File:** `packages/sdk/src/arweave/service-discovery-5094.test.ts` (55 lines)

- **Test:** [P0] kindPricing[5094] -> SkillDescriptor includes kinds: [5094] and pricing
  - **Status:** RED - skipped (constants not yet added)
  - **Verifies:** AC #4
  - **Test ID:** 8.0-UNIT-012

- **Test:** [P1] no kind:5094 handler registered -> SkillDescriptor does not include 5094
  - **Status:** RED - skipped
  - **Verifies:** AC #4 negative case

### Unit Tests - SDK Pricing Validator (4 tests)

**File:** `packages/sdk/src/arweave/pricing-validator-5094.test.ts` (105 lines)

- **Test:** [P0] kindPricing[5094] underpayment -> F04 rejection BEFORE handler invoked
  - **Status:** RED - skipped
  - **Verifies:** AC #6
  - **Test ID:** 8.0-UNIT-016

- **Test:** [P0] kindPricing[5094] exact payment -> accepted
  - **Status:** RED - skipped
  - **Verifies:** AC #6

- **Test:** [P0] kindPricing[5094] overpayment -> accepted
  - **Status:** RED - skipped
  - **Verifies:** AC #6

- **Test:** [P1] kind:5094 uses kindPricing override, not basePricePerByte
  - **Status:** RED - skipped
  - **Verifies:** AC #6

---

## Data Factories Created

### Blob Factory (inline in test files)

**File:** `packages/core/src/events/arweave-storage.test.ts`

**Exports:**
- `createTestBlob(size?)` - Create deterministic Buffer of given size

### Mock Factories (inline in test files)

**File:** `packages/sdk/src/arweave/arweave-dvm-handler.test.ts`

**Exports:**
- `createMockTurboAdapter()` - Mock ArweaveUploadAdapter with vi.fn()
- `createMockChunkManager()` - Mock ChunkManager with vi.fn()
- `createMockHandlerContext(overrides?)` - Mock HandlerContext for kind:5094

**File:** `packages/sdk/src/arweave/chunked-upload.test.ts`

**Exports:**
- `createMockServiceNode()` - Mock ServiceNode with publishEvent vi.fn()

**File:** `packages/sdk/src/arweave/pricing-validator-5094.test.ts`

**Exports:**
- `createMockMeta(overrides?)` - Mock ToonRoutingMeta for kind:5094

---

## Fixtures Created

N/A - This is a backend project using vitest with co-located tests. Factories are defined inline in test files following the existing project pattern (see `dvm-test-helpers.ts`). No Playwright fixtures needed.

---

## Mock Requirements

### ArweaveUploadAdapter Mock

**Interface:** `ArweaveUploadAdapter`
**Method:** `upload(data: Buffer, tags?: Record<string, string>): Promise<{ txId: string }>`

**Success Response:**
```json
{ "txId": "mock-arweave-tx-id-abc123" }
```

**Failure Response:** Throws Error

**Notes:** Wraps `@ardrive/turbo-sdk`. Only file that imports the external dependency. Mock isolates all tests from real Arweave.

### ChunkManager Mock

**Interface:** `ChunkManager`
**Method:** `addChunk(uploadId, chunkIndex, totalChunks, data): { complete: boolean, assembled?: Buffer }`

**Intermediate Response:** `{ complete: false }`
**Final Response:** `{ complete: true, assembled: Buffer }`

### ServiceNode Mock (client tests)

**Method:** `publishEvent(event, options): Promise<{ type: 'fulfill', data: string }>`

**Success Response:** `{ type: 'fulfill', data: '<arweave-tx-id>' }`
**Intermediate Ack:** `{ type: 'fulfill', data: 'ack:<chunkIndex>' }`

---

## Required data-testid Attributes

N/A - This is a backend-only story with no UI components.

---

## Implementation Checklist

### Test: build -> parse roundtrip (8.0-UNIT-001)

**File:** `packages/core/src/events/arweave-storage.test.ts`

**Tasks to make this test pass:**

- [ ] Add `BLOB_STORAGE_REQUEST_KIND = 5094` and `BLOB_STORAGE_RESULT_KIND = 6094` to `packages/core/src/constants.ts`
- [ ] Create `packages/core/src/events/arweave-storage.ts` with `BlobStorageRequestParams` interface
- [ ] Implement `buildBlobStorageRequest()` following `buildJobRequestEvent()` pattern
- [ ] Implement `parseBlobStorageRequest()` following `parseJobRequest()` pattern
- [ ] Export from `packages/core/src/events/index.ts` and `packages/core/src/index.ts`
- [ ] Remove `it.skip` and uncomment assertions in test
- [ ] Run test: `cd packages/core && npx vitest run src/events/arweave-storage.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: parser rejects malformed events (8.0-UNIT-002)

**File:** `packages/core/src/events/arweave-storage.test.ts`

**Tasks to make this test pass:**

- [ ] Ensure parser returns null for missing `i` tag
- [ ] Ensure parser returns null for invalid base64
- [ ] Ensure parser returns null for wrong kind
- [ ] Ensure parser returns null for missing `bid` tag
- [ ] Remove `it.skip` and uncomment assertions in tests
- [ ] Run test: `cd packages/core && npx vitest run src/events/arweave-storage.test.ts`
- [ ] Tests pass (green phase)

**Estimated Effort:** 0.5 hours (covered by UNIT-001 implementation)

---

### Test: chunked params roundtrip (8.0-UNIT-003)

**File:** `packages/core/src/events/arweave-storage.test.ts`

**Tasks to make this test pass:**

- [ ] Builder supports `params` array with `uploadId`, `chunkIndex`, `totalChunks`
- [ ] Parser extracts chunk params from `['param', key, value]` tags
- [ ] Returns `uploadId?: string`, `chunkIndex?: number`, `totalChunks?: number` in parsed result
- [ ] Remove `it.skip` and uncomment assertions
- [ ] Run test: `cd packages/core && npx vitest run src/events/arweave-storage.test.ts`
- [ ] Tests pass (green phase)

**Estimated Effort:** 0.5 hours (covered by UNIT-001 implementation)

---

### Test: single-packet upload (8.0-UNIT-004)

**File:** `packages/sdk/src/arweave/arweave-dvm-handler.test.ts`

**Tasks to make this test pass:**

- [ ] Create `packages/sdk/src/arweave/turbo-adapter.ts` with `ArweaveUploadAdapter` interface and `TurboUploadAdapter` class
- [ ] Create `packages/sdk/src/arweave/arweave-dvm-handler.ts` with `createArweaveDvmHandler()`
- [ ] Handler: parse event via `parseBlobStorageRequest()`, call `turboAdapter.upload()`, return `{ accept: true, data: txId }`
- [ ] Return `HandlePacketAcceptResponse` directly (NOT via `ctx.accept()`)
- [ ] Remove exclusion from `packages/sdk/vitest.config.ts`
- [ ] Remove `it.skip` and uncomment assertions
- [ ] Run test: `cd packages/sdk && npx vitest run src/arweave/arweave-dvm-handler.test.ts`
- [ ] Tests pass (green phase)

**Estimated Effort:** 3 hours

---

### Test: malformed event rejection (8.0-UNIT-005)

**File:** `packages/sdk/src/arweave/arweave-dvm-handler.test.ts`

**Tasks to make this test pass:**

- [ ] Handler rejects when `parseBlobStorageRequest()` returns null
- [ ] No Arweave upload occurs on rejection
- [ ] Remove `it.skip` and uncomment assertions
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours (covered by UNIT-004 implementation)

---

### Test: chunked upload handling (8.0-UNIT-006)

**File:** `packages/sdk/src/arweave/arweave-dvm-handler.test.ts`

**Tasks to make this test pass:**

- [ ] Handler detects `uploadId` in parsed event -> delegates to ChunkManager
- [ ] Intermediate chunks return `{ accept: true, data: 'ack:<chunkIndex>' }`
- [ ] Final chunk uploads assembled blob and returns txId
- [ ] Remove `it.skip` and uncomment assertions
- [ ] Run test
- [ ] Tests pass (green phase)

**Estimated Effort:** 1 hour (covered by UNIT-004 implementation)

---

### Test: chunk manager (8.0-UNIT-007 through 8.0-UNIT-011)

**File:** `packages/sdk/src/arweave/chunk-manager.test.ts`

**Tasks to make these tests pass:**

- [ ] Create `packages/sdk/src/arweave/chunk-manager.ts` with `ChunkManager` class
- [ ] Implement `addChunk()` with Map-based chunk storage
- [ ] Implement `isComplete()` check
- [ ] Implement `cleanup()` for manual removal
- [ ] Implement timeout sweeper using `setTimeout`
- [ ] Implement memory cap (`maxActiveUploads`)
- [ ] Implement duplicate chunk rejection
- [ ] Support out-of-order chunk assembly (sort by index)
- [ ] Remove exclusion from `packages/sdk/vitest.config.ts`
- [ ] Remove `it.skip` and uncomment assertions in all chunk manager tests
- [ ] Run test: `cd packages/sdk && npx vitest run src/arweave/chunk-manager.test.ts`
- [ ] All tests pass (green phase)

**Estimated Effort:** 3 hours

---

### Test: service discovery (8.0-UNIT-012)

**File:** `packages/sdk/src/arweave/service-discovery-5094.test.ts`

**Tasks to make this test pass:**

- [ ] Add constants to `packages/core/src/constants.ts` (covered by Task 1)
- [ ] Register Arweave handler for kind 5094 in handler registry
- [ ] Configure `kindPricing: { 5094: <price> }` in node config
- [ ] Verify `buildSkillDescriptor()` auto-derives `kinds: [5094]` and pricing
- [ ] Remove exclusion from `packages/sdk/vitest.config.ts`
- [ ] Remove `it.skip` and uncomment assertions
- [ ] Run test
- [ ] Tests pass (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: pricing validator (8.0-UNIT-016)

**File:** `packages/sdk/src/arweave/pricing-validator-5094.test.ts`

**Tasks to make this test pass:**

- [ ] Configure `kindPricing: { 5094: <price> }` in pricing validator config
- [ ] Existing `createPricingValidator()` already supports kindPricing -- no code change needed
- [ ] Remove exclusion from `packages/sdk/vitest.config.ts`
- [ ] Remove `it.skip` from tests
- [ ] Run test: `cd packages/sdk && npx vitest run src/arweave/pricing-validator-5094.test.ts`
- [ ] Tests pass (green phase)

**Estimated Effort:** 0.5 hours (pricing validator already exists, just verify)

---

### Test: client helpers (8.0-UNIT-013 through 8.0-UNIT-015)

**File:** `packages/sdk/src/arweave/chunked-upload.test.ts`

**Tasks to make these tests pass:**

- [ ] Create `packages/sdk/src/arweave/chunked-upload.ts`
- [ ] Implement `uploadBlob()` using `publishEvent()` with amount override
- [ ] Implement `uploadBlobChunked()` with blob splitting and UUID generation
- [ ] Return txId from final FULFILL data
- [ ] Remove exclusion from `packages/sdk/vitest.config.ts`
- [ ] Remove `it.skip` and uncomment assertions
- [ ] Run test: `cd packages/sdk && npx vitest run src/arweave/chunked-upload.test.ts`
- [ ] All tests pass (green phase)

**Estimated Effort:** 2 hours

---

## Running Tests

```bash
# Run all failing tests for this story (core)
cd packages/core && npx vitest run src/events/arweave-storage.test.ts

# Run all failing tests for this story (SDK)
cd packages/sdk && npx vitest run src/arweave/

# Run specific test file
cd packages/sdk && npx vitest run src/arweave/chunk-manager.test.ts

# Run tests in watch mode
cd packages/core && npx vitest src/events/arweave-storage.test.ts

# Debug specific test
cd packages/sdk && npx vitest run src/arweave/arweave-dvm-handler.test.ts --reporter=verbose

# Run all project tests (verify no regressions)
pnpm test
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 35 tests written and skipped (red phase)
- Test factories created with deterministic data (no faker needed for backend)
- Mock requirements documented
- Implementation checklist created

**Verification:**

- Core tests: 12 skipped, 0 failures, load time 241ms
- SDK tests: 388 existing tests pass, new test files excluded from run

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with 8.0-UNIT-001)
2. **Read the test** to understand expected behavior
3. **Implement minimal code** to make that specific test pass
4. **Run the test** to verify it now passes (green)
5. **Check off the task** in implementation checklist
6. **Move to next test** and repeat

**Recommended implementation order:**

1. Constants (Task 1) -- unblocks everything
2. Builder/Parser (Task 2, tests 8.0-UNIT-001/002/003) -- core foundation
3. Chunk Manager (Task 5, tests 8.0-UNIT-007 through 011) -- independent module
4. Turbo Adapter (Task 4) -- external dependency wrapper
5. DVM Handler (Task 7, tests 8.0-UNIT-004/005/006) -- depends on 2, 4, 5
6. Client Helpers (Task 9, tests 8.0-UNIT-013/014/015) -- depends on 2
7. Service Discovery verification (Task 12, test 8.0-UNIT-012) -- depends on 7
8. Pricing Validator verification (Task 8b, test 8.0-UNIT-016) -- independent

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability)
3. **Extract duplications** (DRY principle)
4. **Create barrel export** `packages/sdk/src/arweave/index.ts`
5. **Ensure tests still pass** after each refactor

---

## Next Steps

1. **Review this checklist** with team
2. **Run core tests** to confirm RED phase: `cd packages/core && npx vitest run src/events/arweave-storage.test.ts`
3. **Begin implementation** using implementation checklist as guide
4. **Work one test at a time** (red -> green for each)
5. **Integration tests** (8.0-INT-001, 8.0-INT-002) to be added after unit tests pass
6. **E2E tests** (8.0-E2E-001, 8.0-E2E-002) to be added after integration tests pass

---

## Knowledge Base References Applied

- **data-factories.md** - Factory patterns for deterministic test data (adapted for vitest/backend)
- **test-quality.md** - Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **test-levels-framework.md** - Test level selection (Unit for pure functions, Integration for external services)
- **component-tdd.md** - TDD cycle patterns adapted for backend unit tests

Existing codebase patterns consulted:
- `packages/core/src/events/dvm.ts` - Builder/parser pattern reference
- `packages/core/src/events/dvm-test-helpers.ts` - Test factory patterns
- `packages/sdk/src/pricing-validator.test.ts` - Pricing validator test patterns
- `packages/sdk/src/handler-registry.test.ts` - Handler mock patterns

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `cd packages/core && npx vitest run src/events/arweave-storage.test.ts`

**Results:**

```
 RUN  v1.6.1 /Users/jonathangreen/Documents/crosstown/packages/core

 ↓ src/events/arweave-storage.test.ts  (12 tests | 12 skipped)

 Test Files  1 skipped (1)
      Tests  12 skipped (12)
   Duration  241ms
```

**SDK existing tests:** 388 passed (no regressions)

**Summary:**

- Total unit tests created: 35
- Skipped (red phase): 35
- Passing: 0 (expected)
- Status: RED phase verified

---

## Notes

- All test files use `it.skip()` with commented-out imports/assertions. To activate, uncomment imports and remove `.skip`.
- The SDK vitest.config.ts excludes 5 new test files in `src/arweave/` to prevent import failures before source modules exist. Remove exclusions as modules are implemented.
- The pricing-validator-5094.test.ts tests use the existing `createPricingValidator()` from `../pricing-validator.js` -- the pricing validator already supports kindPricing, so these tests will pass once `.skip` is removed (no new code needed for AC #6).
- Integration tests (8.0-INT-001, 8.0-INT-002) and E2E tests (8.0-E2E-001, 8.0-E2E-002) are deferred to post-unit-test phase as they require real Arweave / Docker infra.

---

**Generated by BMad TEA Agent** - 2026-03-22
