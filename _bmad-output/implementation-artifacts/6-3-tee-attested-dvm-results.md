# Story 6.3: TEE-Attested DVM Results

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **customer agent**,
I want DVM job results to include proof that the computation ran in a TEE-attested enclave,
So that I can cryptographically verify the integrity of the computation without trusting the provider's reputation.

**FRs covered:** FR-DVM-7 (TEE-attested DVM results)

**Dependencies:** Epic 4 Story 4.2 complete (kind:10033 TEE attestation events: `buildAttestationEvent()`, `parseAttestation()`, `TEE_ATTESTATION_KIND`, `AttestationEventOptions`, `ParsedAttestation`). Epic 4 Story 4.3 complete (`AttestationVerifier` with `verify()`, `getAttestationState()`, `AttestationState` enum, `VerificationResult`). Epic 5 Story 5.3 complete (job result delivery: `buildJobResultEvent()`, `parseJobResult()`, `publishResult()`, `settleCompute()`). Story 5.4 complete (skill descriptors: `SkillDescriptor` with `attestation?: Record<string, unknown>` placeholder). Story 6.1 complete (status: done -- `WorkflowOrchestrator`, injectable `now` pattern). Story 6.2 complete (status: done -- `SwarmCoordinator`).

**Decision sources:**
- Epic 6 architectural decisions (epics.md): TEE-attested DVM results reference kind:10033 attestation events for cryptographic proof of enclave computation
- Epic 4 Story 4.2: kind:10033 event structure (PCR values, enclave type, attestation document, expiry tag)
- Epic 4 Story 4.3: `AttestationVerifier` with injectable `now` parameter, `getAttestationState()`, `verify()`, `AttestationState` enum

**Downstream dependencies:** Story 6.4 (Reputation Scoring) displays TEE attestation status alongside reputation score (T-INT-05, E6-R018). Cross-story integration T-INT-03 (attested results in workflow) and T-INT-07 (full trust chain) require Story 6.3.

## Acceptance Criteria

1. **Attestation tag injection in Kind 6xxx results:** Given a provider running inside a Marlin Oyster CVM with valid TEE attestation, when the provider publishes a Kind 6xxx result event, then the result includes an `attestation` tag (`['attestation', '<kind:10033-event-id>']`) referencing the provider's latest kind:10033 event ID. The kind:10033 event contains PCR values, enclave image hash, and attestation document.

2. **Customer-side attestation verification:** Given a customer receiving a Kind 6xxx result with an `attestation` tag, when the customer wants to verify the computation integrity, then the customer reads the referenced kind:10033 event from the relay and verifies: (a) the kind:10033 pubkey matches the Kind 6xxx author pubkey, (b) the PCR measurements are valid against known-good values via `AttestationVerifier.verify()`, and (c) the attestation was VALID at the time the Kind 6xxx result was created (passing `resultEvent.created_at` as the `now` parameter to `AttestationVerifier.getAttestationState(attestation, attestationEvent.created_at, resultEvent.created_at)`, not current wall-clock time).

3. **`require_attestation` parameter support:** Given a customer that requires TEE-attested results, when the customer publishes a Kind 5xxx job request with `['param', 'require_attestation', 'true']`, then non-TEE providers should detect this parameter and send Kind 7000 feedback with `status: 'error'` and a reason indicating they cannot attest. TEE-enabled providers proceed normally.

4. **Skill descriptor attestation field:** Given the kind:10035 skill descriptor, when a TEE-attested node publishes its service discovery event, then the `attestation` field (existing placeholder in `SkillDescriptor`) is populated with the latest kind:10033 event ID and enclave image hash. Customers can filter providers by attestation status before submitting jobs.

5. **Backward compatibility:** Given existing Kind 6xxx events without `attestation` tags, when the parser processes them, then `ParsedJobResult.attestationEventId` is `undefined` and no verification is attempted. The additive attestation tag does not break non-TEE DVM results.

## Tasks / Subtasks

- [x] Task 1: Extend Kind 6xxx result builder with attestation tag support (AC: #1, #5)
  - [x] 1.1 Extend `JobResultParams` in `packages/core/src/events/dvm.ts` with an optional `attestationEventId?: string` field — the event ID of the provider's latest kind:10033 attestation event
  - [x] 1.2 Update `buildJobResultEvent()` to append `['attestation', attestationEventId]` tag when `attestationEventId` is provided. Validate `attestationEventId` as 64-char lowercase hex using existing `HEX_64_REGEX`
  - [x] 1.3 Extend `ParsedJobResult` with optional `attestationEventId?: string` field
  - [x] 1.4 Update `parseJobResult()` to extract `attestation` tag value if present, returning it in `ParsedJobResult.attestationEventId`
  - [x] 1.5 Write unit test: Kind 6xxx with `attestation` tag survives TOON encode -> decode roundtrip with event ID preserved (T-6.3-12)
  - [x] 1.6 Write unit test: TEE-enabled provider's Kind 6xxx builder includes `attestation` tag referencing kind:10033 event ID (T-6.3-01)
  - [x] 1.7 Write unit test: Kind 6xxx from non-TEE node has no `attestation` tag when `attestationEventId` not provided (T-6.3-02)
  - [x] 1.8 Write unit test: `buildJobResultEvent()` throws `ToonError` with code `DVM_INVALID_ATTESTATION_EVENT_ID` when `attestationEventId` is not valid 64-char lowercase hex (AC: #1, validation)
  - [x] 1.9 Write unit test: backward compatibility — existing Kind 6xxx events without `attestation` tag parse successfully with `attestationEventId: undefined` (AC: #5)

- [x] Task 2: Implement customer-side attestation result verifier (AC: #2)
  - [x] 2.1 Create `packages/core/src/events/attested-result-verifier.ts` with `AttestedResultVerifier` class
  - [x] 2.2 Define `AttestedResultVerificationOptions` interface: `{ attestationVerifier: AttestationVerifier }` — the verifier instance is injected at construction. Time injection is NOT needed at construction; `getAttestationState()` receives time as `resultEvent.created_at` at call site (see Task 2.4c)
  - [x] 2.3 Define `AttestedResultVerificationResult` interface: `{ valid: boolean, reason?: string, attestationState?: AttestationState }`
  - [x] 2.4 Implement `verifyAttestedResult(resultEvent: NostrEvent, parsedResult: ParsedJobResult, attestationEvent: NostrEvent, parsedAttestation: ParsedAttestation)` method that performs three checks:
    - (a) **Pubkey match:** `attestationEvent.pubkey === resultEvent.pubkey` — same provider authored both events
    - (b) **PCR validity:** `this.attestationVerifier.verify(parsedAttestation.attestation)` returns `{ valid: true }`
    - (c) **Time validity:** `this.attestationVerifier.getAttestationState(parsedAttestation.attestation, attestationEvent.created_at, resultEvent.created_at)` returns `AttestationState.VALID` — passes `resultEvent.created_at` as the `now` parameter so attestation state is evaluated at result creation time, not current wall-clock time (addressing E6-R012)
  - [x] 2.5 Return `{ valid: false, reason: 'pubkey mismatch' }` if check (a) fails
  - [x] 2.6 Return `{ valid: false, reason: 'PCR mismatch' }` if check (b) fails
  - [x] 2.7 Return `{ valid: false, reason: 'attestation expired at result creation time' }` if check (c) fails (state is STALE or UNATTESTED)
  - [x] 2.8 Return `{ valid: true, attestationState: AttestationState.VALID }` if all checks pass
  - [x] 2.9 Export from `packages/core/src/events/index.ts` and `packages/core/src/index.ts`
  - [x] 2.10 Write unit test: pubkey match — kind:10033 pubkey matches Kind 6xxx author pubkey -> verification succeeds (T-6.3-03)
  - [x] 2.11 Write unit test: PCR validity — referenced kind:10033 PCR values checked against known-good registry (T-6.3-04)
  - [x] 2.12 Write unit test: time validity — attestation was VALID at result `created_at` timestamp (T-6.3-05)
  - [x] 2.13 Write unit test: negative — attestation tag references kind:10033 from different pubkey -> verification fails with 'pubkey mismatch' (T-6.3-06)
  - [x] 2.14 Write unit test: negative — kind:10033 with unknown PCR -> verification fails with 'PCR mismatch' (T-6.3-07)
  - [x] 2.15 Write unit test: negative — referenced kind:10033 event attestation expired at result creation time -> verification fails (T-6.3-08 adapted: attestation not found handled separately by caller; this tests the expiry case)

- [x] Task 3: Implement `require_attestation` parameter handling (AC: #3)
  - [x] 3.1 Create utility function `hasRequireAttestation(params: { key: string; value: string }[])` in `packages/core/src/events/attested-result-verifier.ts` that checks for `{ key: 'require_attestation', value: 'true' }` in a parsed job request's params array
  - [x] 3.2 Write unit test: Kind 5xxx with `['param', 'require_attestation', 'true']` -> `hasRequireAttestation()` returns true (T-6.3-09 part 1)
  - [x] 3.3 Write unit test: Kind 5xxx without `require_attestation` param -> `hasRequireAttestation()` returns false
  - [x] 3.4 Write unit test: validates the expected provider-side pattern — when `hasRequireAttestation()` returns true for a job request, a non-TEE provider should build a Kind 7000 feedback event with `status: 'error'` and reason `'require_attestation: provider has no TEE attestation'` using existing `buildJobFeedbackEvent()` (T-6.3-09 part 2 — demonstrates the integration pattern; provider-side wiring is a deployment concern)

- [x] Task 4: Populate skill descriptor attestation field (AC: #4)
  - [x] 4.1 Extend `BuildSkillDescriptorConfig` in `packages/sdk/src/skill-descriptor.ts` with optional `attestation?: { eventId: string, enclaveImageHash: string }` field
  - [x] 4.2 Update `buildSkillDescriptor()` to populate `SkillDescriptor.attestation` with `{ eventId: config.attestation.eventId, enclaveImageHash: config.attestation.enclaveImageHash }` when `config.attestation` is provided. Validate `eventId` as 64-char lowercase hex using a local `HEX_64_REGEX` constant (cannot import from `dvm.ts` — it is not exported; define `/^[0-9a-f]{64}$/` locally in `skill-descriptor.ts`). Throw `ToonError` with code `DVM_SKILL_INVALID_ATTESTATION_EVENT_ID` on validation failure
  - [x] 4.3 Write unit test: TEE-attested node's kind:10035 includes `attestation` field with kind:10033 event ID and enclave image hash (T-6.3-10)
  - [x] 4.4 Write unit test: non-TEE node's kind:10035 has no `attestation` field (backward compatible)
  - [x] 4.5 Write unit test: customer filters kind:10035 skill descriptors by `attestation` field presence to find TEE-attested providers (T-6.3-11 — pure data filtering, no relay transport needed)

## Dev Notes

### Architecture and Constraints

**Key architectural decision: Attestation verification happens at result-creation time, not customer-read time.** When a customer receives a Kind 6xxx result with an `attestation` tag, the verification checks whether the referenced kind:10033 attestation was VALID at the time the result event was created (`resultEvent.created_at`). This prevents legitimate results from becoming "unverifiable" due to normal attestation refresh cycles (E6-R012). A result computed in a valid TEE remains verifiable forever, even if the attestation has since expired.

**The `attestation` tag is additive to Kind 6xxx events.** Existing Kind 6xxx events without attestation tags remain valid. The parser returns `attestationEventId: undefined` for non-attested results. This maintains backward compatibility with pre-TEE DVM results.

**Provider-side attestation tag injection is automatic.** The provider's Kind 6xxx builder receives the `attestationEventId` from the provider's latest kind:10033 event. The SDK's `publishResult()` on `ServiceNode` should pass this through when the node has TEE attestation enabled. The actual wiring of "read latest kind:10033 event ID from local state and inject into result" is a deployment concern (entrypoint-sdk.ts or createNode configuration), not a core library concern.

**`require_attestation` is a soft enforcement model.** Non-TEE providers are EXPECTED to self-reject if they receive a job request with `require_attestation=true`. There is no relay-side enforcement — the relay stores the result regardless. The customer should verify the attestation tag on received results. This follows the Nostr philosophy of client-side validation.

**Attestation verification chain (E6-R010, score 9, CRITICAL):**
```
Provider (in TEE) publishes Kind 6xxx result with ['attestation', '<kind:10033-event-id>']
  -> Customer reads Kind 6xxx from relay
    -> Customer reads referenced kind:10033 from relay
      -> Customer verifies:
        1. kind:10033.pubkey === Kind 6xxx.pubkey (same provider)
        2. AttestationVerifier.verify(parsedAttestation) -> { valid: true } (PCR match)
        3. AttestationVerifier.getAttestationState(attestation, kind:10033.created_at, Kind 6xxx.created_at) -> VALID
      -> All pass: computation integrity verified
      -> Any fail: attestation verification failed, customer should not trust result
```

**Forward-compatibility with Epic 7 prepaid protocol (D7-001):** `settleCompute()` will be deprecated in Epic 7 Story 7.6 in favor of prepaid single-packet payment semantics. Story 6.3 does not directly use `settleCompute()` — it adds attestation metadata to results, which is orthogonal to payment flow. No forward-compatibility concern.

**Error handling for missing attestation events:** The `AttestedResultVerifier.verifyAttestedResult()` method receives both the result event and the attestation event as parameters. The caller is responsible for fetching the attestation event from the relay. If the attestation event is not found on the relay, the caller should report "attestation not found" — this is a transport concern, not a verification concern. The verifier is a pure logic class (following `AttestationVerifier` pattern from Story 4.3).

**Error codes:** The following `ToonError` codes are introduced in this story:
- `DVM_INVALID_ATTESTATION_EVENT_ID` — `attestationEventId` provided to `buildJobResultEvent()` is not a valid 64-char lowercase hex string
- `DVM_ATTESTATION_PUBKEY_MISMATCH` — kind:10033 pubkey does not match Kind 6xxx author pubkey during verification
- `DVM_ATTESTATION_PCR_MISMATCH` — kind:10033 PCR values fail `AttestationVerifier.verify()` check
- `DVM_ATTESTATION_EXPIRED` — kind:10033 attestation was not VALID at result creation time
- `DVM_SKILL_INVALID_ATTESTATION_EVENT_ID` — `attestation.eventId` provided to `buildSkillDescriptor()` is not a valid 64-char lowercase hex string

### What Already Exists (DO NOT Recreate)

- **kind:10033 event builder/parser** in `packages/core/src/events/attestation.ts` — `buildAttestationEvent()`, `parseAttestation()`, `TEE_ATTESTATION_KIND`, `AttestationEventOptions`, `ParsedAttestation`
- **`AttestationVerifier`** in `packages/core/src/bootstrap/AttestationVerifier.ts` — `verify(attestation)` checks PCR values against known-good registry; `getAttestationState(attestation, attestedAt, now?)` computes lifecycle state with injectable `now` parameter; `AttestationState` enum (VALID, STALE, UNATTESTED); `AttestationVerifierConfig` with `knownGoodPcrs` Map
- **`TeeAttestation` type** in `packages/core/src/types.ts` — `{ enclave, pcr0, pcr1, pcr2, attestationDoc, version }`
- **DVM event builders/parsers** in `packages/core/src/events/dvm.ts` — `buildJobRequestEvent()`, `parseJobRequest()`, `buildJobResultEvent()`, `parseJobResult()`, `buildJobFeedbackEvent()`, `parseJobFeedback()`, `JobResultParams`, `ParsedJobResult`. The attestation tag extends these existing types.
- **DVM constants** in `packages/core/src/constants.ts` — `JOB_REQUEST_KIND_BASE = 5000`, `JOB_RESULT_KIND_BASE = 6000`, `JOB_FEEDBACK_KIND = 7000`, `TEE_ATTESTATION_KIND = 10033`
- **`SkillDescriptor`** in `packages/core/src/events/service-discovery.ts` — already has `attestation?: Record<string, unknown>` placeholder field
- **`buildSkillDescriptor()`** in `packages/sdk/src/skill-descriptor.ts` — builds `SkillDescriptor` from handler registry and config. Currently does not populate `attestation` field.
- **`ServiceNode` interface** in `packages/sdk/src/create-node.ts` — `publishResult()`, `settleCompute()`, `on(kind, handler)`
- **`ToonError`** in `packages/core/src/errors.ts` — base error class for domain errors
- **`HEX_64_REGEX`** in `packages/core/src/events/dvm.ts` — `/^[0-9a-f]{64}$/`, module-level constant (NOT exported). Reuse directly in Task 1 (same file). For Task 4 (`packages/sdk`), define a local constant with the same pattern
- **TOON codec** — `encodeToon()`, `decodeToon()`, `shallowParseToon()` in `@toon-protocol/core`

### What to Create (New Files)

1. **`packages/core/src/events/attested-result-verifier.ts`** — `AttestedResultVerifier` class with `verifyAttestedResult()` method, `AttestedResultVerificationOptions`, `AttestedResultVerificationResult` types, `hasRequireAttestation()` utility function
2. **`packages/core/src/events/attested-result-verifier.test.ts`** — Unit tests for verification logic (pubkey match, PCR validity, time validity, negative cases, `require_attestation` detection)

### What to Modify (Existing Files)

1. **`packages/core/src/events/dvm.ts`** — Add optional `attestationEventId` to `JobResultParams` and `ParsedJobResult`; update `buildJobResultEvent()` to append `attestation` tag; update `parseJobResult()` to extract `attestation` tag
2. **`packages/core/src/events/dvm.test.ts` (or split test files)** — Add tests for attestation tag roundtrip (T-6.3-12), TEE provider injection (T-6.3-01), non-TEE omission (T-6.3-02)
3. **`packages/core/src/events/index.ts`** — Export `AttestedResultVerifier`, `AttestedResultVerificationResult`, `hasRequireAttestation`
4. **`packages/core/src/index.ts`** — Export attestation result verifier types
5. **`packages/sdk/src/skill-descriptor.ts`** — Add optional `attestation` to `BuildSkillDescriptorConfig`; populate `SkillDescriptor.attestation` when provided
6. **`packages/sdk/src/skill-descriptor.test.ts`** — Add tests for attestation field population (T-6.3-10, T-6.3-11)

### Test Requirements (aligned with test-design-epic-6.md)

| ID | Test | Level | Risk | Priority | Task |
|----|------|-------|------|----------|------|
| T-6.3-01 | Attestation tag injection: TEE-enabled provider's Kind 6xxx builder includes `attestation` tag referencing latest kind:10033 event ID | U | E6-R011 | P0 | 1.6 |
| T-6.3-02 | No attestation tag for non-TEE provider: Kind 6xxx from non-TEE node has no `attestation` tag | U | E6-R011 | P0 | 1.7 |
| T-6.3-03 | Customer verification -- pubkey match: Kind 6xxx attestation tag -> read kind:10033 -> verify kind:10033 pubkey matches Kind 6xxx author pubkey | U | E6-R010 | P0 | 2.10 |
| T-6.3-04 | Customer verification -- PCR validity: referenced kind:10033 PCR values checked against known-good registry via existing `AttestationVerifier.verify()` | U | E6-R010 | P0 | 2.11 |
| T-6.3-05 | Customer verification -- time validity: kind:10033 attestation was VALID at the time the Kind 6xxx result was created (result event `created_at` timestamp used for time check, not current time) | U | E6-R010, E6-R012 | P0 | 2.12 |
| T-6.3-06 | Customer verification -- negative: attestation tag references kind:10033 from different pubkey -> verification fails with clear error | U | E6-R010 | P0 | 2.13 |
| T-6.3-07 | Customer verification -- negative: attestation tag references kind:10033 with unknown PCR -> verification fails | U | E6-R010 | P0 | 2.14 |
| T-6.3-08 | Customer verification -- negative: referenced kind:10033 event attestation expired at result creation time -> verification fails with "attestation expired" error | U | E6-R010 | P1 | 2.15 |
| T-6.3-09 | `require_attestation` parameter: Kind 5xxx with `['param', 'require_attestation', 'true']` -> detected by utility function; non-TEE provider expected to self-reject | U | E6-R011 | P1 | 3.2, 3.3, 3.4 |
| T-6.3-10 | Skill descriptor attestation field: TEE-attested node's kind:10035 includes `attestation` field with latest kind:10033 event ID and enclave image hash | U | -- | P1 | 4.3 |
| T-6.3-11 | Customer pre-filters providers: filter kind:10035 skill descriptors by `attestation` field presence -> only submit jobs to attested providers | U | -- | P1 | 4.5 |
| T-6.3-12 | Attestation tag TOON roundtrip: `attestation` tag in Kind 6xxx survives TOON encode -> decode with event ID preserved | U | E5-R001 | P0 | 1.5 |
| T-6.3-13 | Full attestation lifecycle E2E: TEE provider publishes kind:10033 -> receives Kind 5xxx with require_attestation -> publishes Kind 6xxx with attestation tag -> customer verifies attestation chain | E2E | E6-R010 | P3 | deferred (requires TEE Docker infra) |

### Risk Mitigation

**E6-R010 (Score 9, CRITICAL): Attestation-result binding integrity.** Provider references stale or fabricated kind:10033 attestation event ID in their Kind 6xxx result. Customer trusts the attestation tag without verifying it matches the actual provider pubkey and current PCR values. Mitigation: `AttestedResultVerifier` performs three-check verification (pubkey match, PCR validity, time validity). Tests: T-6.3-03 through T-6.3-08.

**E6-R011 (Score 4): Attestation tag injection correctness.** Provider running in TEE omits attestation tag (bug), or non-TEE provider includes fake attestation tag. Mitigation: attestation tag is additive and optional in the builder; verification catches fakes via pubkey + PCR checks. Tests: T-6.3-01, T-6.3-02, T-6.3-09.

**E6-R012 (Score 4): Stale attestation reference.** Provider references kind:10033 that was valid when result was computed but has since expired. Mitigation: verify attestation at result-creation time (use `resultEvent.created_at` as the `now` parameter to `getAttestationState()`), not at customer-read time. Tests: T-6.3-05, T-6.3-08.

**Inherited E5-R001 (Score 6): TOON encoding corruption of DVM tags.** The `attestation` tag on Kind 6xxx events is a new tag type that must survive TOON roundtrip. Tests: T-6.3-12.

### Coding Standards Reminders

- **TypeScript strict mode** — `noUncheckedIndexedAccess`, handle `T | undefined` from index access
- **Use bracket notation** for index signature access (`obj['key']` not `obj.key`)
- **`.js` extensions** in all imports (`import { foo } from './bar.js'`)
- **No `any` type** — use `unknown` with type guards (relaxed to `warn` in test files)
- **`import type`** for type-only imports
- **Vitest** with `describe/it` blocks, AAA pattern (Arrange, Act, Assert)
- **`ToonError`** for domain errors with descriptive error codes
- **Follow `AttestationVerifier` pattern** — pure logic class, injectable time source, no transport concerns
- **Follow `buildJobResultEvent()` pattern exactly** for extending the builder — validate inputs, append tags conditionally
- **Follow `parseJobResult()` pattern exactly** for extending the parser — extract optional tag, return undefined when absent
- **`HEX_64_REGEX`** for event ID validation — reuse from `dvm.ts` within `packages/core` (same file for Task 1). For `packages/sdk` (Task 4), define a local `HEX_64_REGEX` constant since it is not exported from `dvm.ts`

### Implementation Approach

1. **Extend Kind 6xxx builder/parser first (Task 1):** Add optional `attestationEventId` to `JobResultParams` and `ParsedJobResult`. Update builder to append `attestation` tag. Update parser to extract it. Write TOON roundtrip and injection/omission tests. This is the data model foundation — minimal surface area, high confidence.
2. **Customer-side verification (Task 2):** Create `AttestedResultVerifier` as a pure logic class following `AttestationVerifier` pattern. Three verification checks: pubkey match, PCR validity, time validity. Write comprehensive positive and negative tests.
3. **`require_attestation` parameter utility (Task 3):** Simple utility function to detect the parameter in parsed job requests. Lightweight — enables provider-side self-rejection pattern.
4. **Skill descriptor attestation field (Task 4):** Populate the existing `SkillDescriptor.attestation` placeholder. Extend `BuildSkillDescriptorConfig` with attestation metadata. Write tests.

**Expected test count:** ~20-22 tests (13 from epic test design + validation error tests + backward compatibility + edge cases).

**Expected production code changes:**
- ~15-20 lines in `dvm.ts` (extend `JobResultParams`, `ParsedJobResult`, builder, parser)
- ~80-120 lines in `attested-result-verifier.ts` (verifier class, types, utility function)
- ~15-20 lines in `skill-descriptor.ts` (attestation config and population)
- ~10-15 lines in index.ts files (exports)
- **Total: ~120-175 lines of production code**

### Previous Story Intelligence (Story 6.2)

From Story 6.2 (Agent Swarms — preceding story in implementation order):

- **Pattern: Additive tags on existing event kinds.** Story 6.2 added `swarm` and `judge` tags to Kind 5xxx events without changing existing tags. Story 6.3 follows the same pattern: add `attestation` tag to Kind 6xxx events without changing `e`, `p`, or `amount` tags.
- **Pattern: Builder delegates to existing builder.** `buildSwarmRequestEvent()` delegates to `buildJobRequestEvent()` then appends tags. Story 6.3 extends `buildJobResultEvent()` directly (same file) rather than delegating, since the attestation tag is a simple optional addition.
- **Pattern: Code review hardened authorization checks.** Story 6.2 code review found missing pubkey authorization in `selectWinner()`. Story 6.3's pubkey match verification (kind:10033 pubkey vs Kind 6xxx pubkey) is the analogous authorization check.
- **Pattern: Injectable time source.** Story 6.2's `SwarmCoordinator` uses injectable `now` for deterministic timeout testing. Story 6.3's `AttestedResultVerifier` uses injectable `now` from `AttestationVerifier.getAttestationState()` for deterministic time validity testing.

### Prepaid Protocol Note (Epic 7 Forward Compatibility)

Per Party Mode 2026-03-20 decisions (D7-001), `settleCompute()` will be deprecated in Epic 7 Story 7.6 in favor of prepaid DVM. Story 6.3 does not use `settleCompute()` — it adds attestation metadata to results, which is orthogonal to the payment mechanism. The attestation tag will work identically with both the current post-hoc settlement and the future prepaid model.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 6.3: TEE-Attested DVM Results`] — Story definition and acceptance criteria
- [Source: `_bmad-output/planning-artifacts/test-design-epic-6.md#Story 6.3: TEE-Attested DVM Results`] — Test matrix T-6.3-01 through T-6.3-13
- [Source: `_bmad-output/planning-artifacts/test-design-epic-6.md#Section 3.3`] — Attestation verification chain integration boundary analysis
- [Source: `_bmad-output/implementation-artifacts/6-2-agent-swarms.md`] — Story 6.2 patterns (additive tags, authorization checks, code review)
- [Source: `packages/core/src/events/dvm.ts`] — DVM event builders/parsers to extend
- [Source: `packages/core/src/events/attestation.ts`] — kind:10033 event builder/parser
- [Source: `packages/core/src/bootstrap/AttestationVerifier.ts`] — AttestationVerifier with `verify()`, `getAttestationState()`, injectable `now`
- [Source: `packages/core/src/events/service-discovery.ts#SkillDescriptor`] — SkillDescriptor with `attestation?` placeholder
- [Source: `packages/sdk/src/skill-descriptor.ts`] — buildSkillDescriptor() to extend
- [Source: `packages/sdk/src/create-node.ts#ServiceNode`] — ServiceNode interface (publishResult)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
N/A

### Completion Notes List
- All 4 tasks implemented with 26 new tests (attested-result-verifier.test.ts) + 8 new tests (skill-descriptor.test.ts) = 34 new tests total
- 145 existing DVM tests pass without regression
- ESLint clean, Prettier formatted
- `AttestationVerifier` imported as type-only per eslint consistent-type-imports rule
- `HEX_64_REGEX` defined locally in skill-descriptor.ts (not exported from dvm.ts per story notes)
- `ToonError` import added to skill-descriptor.ts for validation errors
- NFR test arch review added 5 tests: validity boundary (inclusive), one-past-boundary, fabricated attestation defense (NFR-6-SEC-01), empty attestation tag value, missing attestation tag value

### Change Log
| Date | Author | Change |
|------|--------|--------|
| 2026-03-20 | Claude Opus 4.6 (1M context, create-story yolo mode) | Initial story creation with 4 tasks, 13 test IDs, 4 ACs, full dev notes |
| 2026-03-20 | Claude Opus 4.6 (1M context, adversarial review) | 10 fixes: (1) Split Story 4.2/4.3 dependency — AttestationVerifier is 4.3 not 4.2; (2) Added AC #5 backward compatibility; (3) Added error codes catalog (5 codes); (4) Fixed getAttestationState now param documentation in AC #2 and Task 2.4c; (5) Removed spurious now? from AttestedResultVerificationOptions — time comes from resultEvent.created_at at call site; (6) Fixed HEX_64_REGEX cross-package issue — not exported from dvm.ts, Task 4.2 must define locally; (7) Added validation error test Task 1.8 and backward compat test Task 1.9; (8) Fixed T-6.3-11 level I->U — pure data filtering, no relay transport; (9) Clarified Task 3.4 test description — demonstrates integration pattern, not implementation; (10) Updated expected test count to 20-22 |
| 2026-03-20 | Claude Opus 4.6 (1M context, testarch-nfr review) | Added 5 tests: (1) validity boundary inclusive test — result at exactly attestedAt+validitySeconds returns VALID; (2) one-past-boundary test — result at attestedAt+validitySeconds+1 returns STALE; (3) NFR-6-SEC-01 fabricated attestation defense — matching pubkey but unknown PCRs rejected; (4-5) parser edge cases — empty string and missing attestation tag values handled gracefully |

### File List
**New files:**
- `packages/core/src/events/attested-result-verifier.ts` — AttestedResultVerifier class, hasRequireAttestation utility
- `packages/core/src/events/attested-result-verifier.test.ts` — 26 tests covering Tasks 1-3 + NFR edge cases

**Modified files:**
- `packages/core/src/events/dvm.ts` — Added attestationEventId to JobResultParams/ParsedJobResult, attestation tag in builder/parser
- `packages/core/src/events/index.ts` — Export AttestedResultVerifier, hasRequireAttestation, types
- `packages/core/src/index.ts` — Re-export from events/index.ts
- `packages/sdk/src/skill-descriptor.ts` — Added attestation config, HEX_64_REGEX, validation, population
- `packages/sdk/src/skill-descriptor.test.ts` — Added 8 tests for Task 4 (attestation field)

## Code Review Record

### Review Pass #1

**Date:** 2026-03-20
**Reviewer:** Claude Opus 4.6 (1M context)
**Review Type:** bmad-bmm-code-review (yolo mode -- auto-fix all severity levels)
**Severity Counts:** Critical: 0, High: 0, Medium: 0, Low: 1
**Outcome:** PASS (all issues fixed)

### Issues Found

| # | Severity | File | Description | Fix |
|---|----------|------|-------------|-----|
| 1 | Low | `packages/sdk/src/skill-descriptor.test.ts` | Duplicate empty comment block "Validation: invalid attestation eventId" (lines 1134-1136) appeared as orphaned section header with no content, immediately followed by "AC #4 integration" section. The actual validation tests exist later at line 1191. | Removed the empty duplicate comment block. |

### Issues NOT Found (Verification)

- **Critical: 0** -- No security vulnerabilities, no data corruption paths, no missing authorization checks
- **High: 0** -- No logic errors in verification chain, no incorrect time handling, no missing exports
- **Medium: 0** -- No type safety issues, no missing edge cases, no coding standard violations in production code
- **Low: 1** -- Duplicate comment block (fixed)

### Verification Summary

1. **All 5 Acceptance Criteria verified:** Attestation tag injection (AC1), customer-side verification (AC2), require_attestation parameter (AC3), skill descriptor attestation field (AC4), backward compatibility (AC5)
2. **All 13 test IDs covered:** T-6.3-01 through T-6.3-12 present with correct priority levels; T-6.3-13 (E2E) correctly deferred
3. **34 new tests pass** (26 in attested-result-verifier.test.ts + 8 in skill-descriptor.test.ts)
4. **212 total tests pass** across all related test files with 0 regressions
5. **ESLint clean** (production code) -- test files have only expected `no-non-null-assertion` warnings (project-wide `warn` level)
6. **TypeScript type-check clean** for all Story 6.3 files
7. **Coding standards compliance:** `.js` extensions in imports, `import type` for type-only imports, `ToonError` for domain errors, bracket notation for index signatures, `HEX_64_REGEX` defined locally in SDK (not imported cross-package), underscore prefix for intentionally unused params
8. **Exports verified:** `AttestedResultVerifier`, `hasRequireAttestation`, `AttestedResultVerificationOptions`, `AttestedResultVerificationResult` exported from `events/index.ts` and re-exported from `core/src/index.ts`
9. **Security model verified:** Three-check verification chain (pubkey match, PCR validity, time validity) correctly prevents attestation spoofing and stale attestation reference attacks

### Review Pass #2

**Date:** 2026-03-20
**Reviewer:** Claude Opus 4.6 (1M context)
**Review Type:** bmad-bmm-code-review (yolo mode -- auto-fix all severity levels)
**Severity Counts:** Critical: 0, High: 0, Medium: 0, Low: 0
**Outcome:** PASS (no issues found)

### Verification Summary (Pass #2)

1. **All 67 tests pass** (26 attested-result-verifier + 41 skill-descriptor) with 0 failures
2. **ESLint clean** on all production code (0 errors, 0 warnings)
3. **ESLint clean** on test files (0 errors, only expected `no-non-null-assertion` warnings at `warn` level)
4. **TypeScript type-check clean** for all Story 6.3 files (pre-existing errors in unrelated files only)
5. **Prettier formatting clean** across all 7 Story 6.3 files
6. **All 5 ACs verified** against implementation
7. **Review Pass #1 fix verified**: duplicate empty comment block successfully removed from skill-descriptor.test.ts

### Review Pass #3 (Final)

**Date:** 2026-03-20
**Reviewer:** Claude Opus 4.6 (1M context)
**Review Type:** bmad-bmm-code-review (final pass) + Semgrep OWASP scan
**Severity Counts:** Critical: 0, High: 0, Medium: 0, Low: 0
**Semgrep OWASP Scan:** 0 findings
**Outcome:** PASS (no issues found, no code changes needed)
