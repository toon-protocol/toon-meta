# Story 6.4: Reputation Scoring System

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **network participant**,
I want a composite reputation score for DVM providers based on verifiable on-chain and relay data,
So that I can make programmatic trust decisions about which providers to send jobs to.

**FRs covered:** FR-DVM-8 (Reputation scoring system)

**Dependencies:** Epic 5 complete (base DVM lifecycle: Kind 5xxx/6xxx/7000, builders, parsers, `publishEvent()`, `publishResult()`, `publishFeedback()`, `settleCompute()`). Story 6.1 complete (status: done -- `WorkflowOrchestrator`, `WorkflowEventStore` interface for relay query patterns). Story 6.2 complete (status: done -- `SwarmCoordinator`, `SwarmEventStore`). Story 6.3 complete (status: done -- `AttestedResultVerifier`, attestation field in `SkillDescriptor` for cross-story display alongside reputation).

**Decision sources:**
- Decision source: [Party Mode 2020117 Analysis](research/party-mode-2020117-analysis-2026-03-10.md) -- Reputation formula adapted from 2020117 model with composite scoring
- Epic 6 architectural decisions (epics.md): Composite score with on-chain anchor for sybil defense
- Test design: `_bmad-output/planning-artifacts/test-design-epic-6.md` Section 3.4 -- Reputation Signal Aggregation Chain

**Downstream dependencies:** Cross-story integration T-INT-04 (reputation-filtered swarms), T-INT-05 (attestation + reputation display), T-INT-06 (workflow completion feeds job count), T-INT-07 (full trust chain). This is the final story in Epic 6.

## Acceptance Criteria

1. **Reputation formula implementation:** Given the reputation scoring formula, when a provider's reputation is calculated, then the composite score is: `score = (trusted_by × 100) + (log10(channel_volume_usdc) × 10) + (jobs_completed × 5) + (avg_rating × 20)` where `trusted_by` is the threshold-filtered count of Kind 30382 (NIP-85 Web of Trust) declarations targeting the provider (threshold model: declarers with non-zero channel volume contribute 1, zero-volume declarers contribute 0 -- per E6-R014 mitigation), `channel_volume_usdc` is the total USDC settled through the provider's payment channels (with `log10(0)` guarded via `Math.max(1, channelVolumeUsdc)` so `log10(1) = 0`, not `-Infinity`), `jobs_completed` is the count of Kind 6xxx result events published by the provider, and `avg_rating` is the mean of verified Kind 31117 (Job Review) ratings (only reviews from pubkeys in the verified customer set are counted -- per E6-R013 customer-gate mitigation). The formula produces a finite number for all valid inputs (no NaN, no Infinity).

2. **Kind 31117 (Job Review) event kind:** Given a customer or provider that wants to submit a review after a DVM job, when they build a Kind 31117 event, then the event contains: `d` tag (job request event ID -- NIP-33 replaceable, one review per job per reviewer), `p` tag (target provider pubkey), `rating` tag (integer 1-5), `role` tag (`customer` or `provider`), and optional content (text review). Rating must be validated as integer 1-5; values outside this range (0, 6, 3.5, non-numeric) are rejected. The event survives TOON encode/decode roundtrip with all tags preserved.

3. **Kind 30382 (Web of Trust) declaration:** Given a network participant that wants to endorse a provider, when they build a Kind 30382 event, then the event contains a `p` tag referencing the target provider pubkey and optional content (endorsement reason). The event is NIP-33 parameterized replaceable (with `d` tag = target pubkey, enforcing one WoT declaration per declarer per target). The event survives TOON encode/decode roundtrip.

4. **Reputation in kind:10035 service discovery:** Given a provider's kind:10035 service discovery event, when the provider publishes or updates their event, then the `SkillDescriptor` (inside the `skill` field of `ServiceDiscoveryContent`) includes a `reputation` field with the self-reported composite score and individual signal values (`trusted_by`, `channel_volume_usdc`, `jobs_completed`, `avg_rating`). TEE attestation status (the existing `attestation` field from Story 6.3) is displayed alongside reputation as a separate binary trust signal, NOT factored into the numeric score (E6-R018). All signals are independently verifiable by customers.

5. **`min_reputation` filter support:** Given a customer posting a DVM job request, when the customer wants to filter providers by reputation, then the customer can include a `['param', 'min_reputation', '<score>']` parameter. Providers with a score below the threshold should self-reject by sending Kind 7000 feedback with `status: 'error'` and a reason indicating insufficient reputation. This follows the same soft enforcement model as `require_attestation` from Story 6.3.

## Tasks / Subtasks

- [x] Task 1: Define Kind 31117 (Job Review) event builder/parser (AC: #2)
  - [x] 1.1 Create `packages/core/src/events/reputation.ts` with Kind 31117 types: `JobReviewParams` (`jobRequestEventId: string`, `targetPubkey: string`, `rating: number`, `role: 'customer' | 'provider'`, `content?: string`), `ParsedJobReview` (same fields parsed from event)
  - [x] 1.2 Add `JOB_REVIEW_KIND = 31117` constant to `packages/core/src/constants.ts`. Kind 31117 is in the NIP-33 parameterized replaceable range (30000-39999): `d` tag = job request event ID enforces one review per job per reviewer
  - [x] 1.3 Implement `buildJobReviewEvent(params, secretKey)`: creates a Kind 31117 event with `d` tag (job request event ID), `p` tag (target pubkey), `rating` tag (`['rating', rating.toString()]`), `role` tag (`['role', role]`), and content (review text or empty string). Validate: `jobRequestEventId` must be 64-char lowercase hex (use local `HEX_64_REGEX`); `targetPubkey` must be 64-char lowercase hex; `rating` must be integer 1-5 (throw `ToonError` with code `REPUTATION_INVALID_RATING` for values outside range, non-integer, or non-numeric); `role` must be `'customer'` or `'provider'` (throw `ToonError` with code `REPUTATION_INVALID_ROLE`)
  - [x] 1.4 Implement `parseJobReview(event)`: parses Kind 31117 event, extracts `d`, `p`, `rating`, `role` tags, returns `ParsedJobReview` or null. Validate rating is integer 1-5 on parse (return null if invalid). Validate kind is 31117 (return null if wrong kind)
  - [x] 1.5 Write unit test: Kind 31117 TOON encode/decode roundtrip preserves `d`, `p`, `rating`, `role` tags and content (T-6.4-04)
  - [x] 1.6 Write unit test: rating validation -- rating=0 rejected, rating=6 rejected, rating="excellent" rejected (if somehow passed as string), rating=3.5 rejected; only integer 1-5 accepted (T-6.4-05)
  - [x] 1.7 Write unit test: NIP-33 replaceable semantics -- same reviewer, same `d` tag = replacement enforced by event kind semantics (T-6.4-06)
  - [x] 1.8 Write unit test: validation errors -- invalid `jobRequestEventId` hex, invalid `targetPubkey` hex, invalid `role` value all throw `ToonError` with correct codes

- [x] Task 2: Define Kind 30382 (Web of Trust) event builder/parser (AC: #3)
  - [x] 2.1 Add `WEB_OF_TRUST_KIND = 30382` constant to `packages/core/src/constants.ts`. Kind 30382 is NIP-33 parameterized replaceable: `d` tag = target pubkey enforces one WoT declaration per declarer per target
  - [x] 2.2 Define types in `packages/core/src/events/reputation.ts`: `WotDeclarationParams` (`targetPubkey: string`, `content?: string`), `ParsedWotDeclaration` (same fields parsed from event, plus `declarerPubkey: string` from event pubkey)
  - [x] 2.3 Implement `buildWotDeclarationEvent(params, secretKey)`: creates a Kind 30382 event with `d` tag (target pubkey -- enforces NIP-33 one-per-pair), `p` tag (target pubkey), and content (endorsement reason or empty string). Validate: `targetPubkey` must be 64-char lowercase hex
  - [x] 2.4 Implement `parseWotDeclaration(event)`: parses Kind 30382 event, extracts `d` and `p` tags, returns `ParsedWotDeclaration` or null. Validate kind is 30382 and `d` tag matches `p` tag (return null if inconsistent)
  - [x] 2.5 Write unit test: Kind 30382 TOON encode/decode roundtrip preserves `d`, `p` tags and content (T-6.4-07)
  - [x] 2.6 Write unit test: validation -- invalid `targetPubkey` throws `ToonError` with code `REPUTATION_INVALID_TARGET_PUBKEY`
  - [x] 2.7 Write unit test: `d` tag equals `p` tag (NIP-33 parameterized replaceable enforcement)

- [x] Task 3: Implement reputation score calculator (AC: #1)
  - [x] 3.1 Create `ReputationScoreCalculator` class in `packages/core/src/events/reputation.ts` with `ReputationSignals` interface: `{ trustedBy: number, channelVolumeUsdc: number, jobsCompleted: number, avgRating: number }`
  - [x] 3.2 Define `ReputationScore` interface: `{ score: number, signals: ReputationSignals }` -- the composite score plus the individual signal values
  - [x] 3.3 Implement `calculateScore(signals: ReputationSignals): ReputationScore` that computes `score = (trustedBy × 100) + (log10(max(1, channelVolumeUsdc)) × 10) + (jobsCompleted × 5) + (avgRating × 20)`. Guard `log10(0)` with `Math.max(1, channelVolumeUsdc)` so `log10(1) = 0` instead of `-Infinity`. Return `{ score, signals }`
  - [x] 3.4 Implement `computeTrustedBy(wotDeclarations: ParsedWotDeclaration[], getChannelVolume: (pubkey: string) => number): number` that computes the weighted trusted_by count. For each WoT declaration, the declarer's channel volume is looked up via the callback. Declarers with zero channel volume contribute 0 to the count. Declarers with non-zero channel volume contribute 1 (threshold model per test-design-epic-6.md Section 10 mitigation E6-R014: "recommend threshold for v1"). Returns the count of WoT declarations from non-zero-volume declarers
  - [x] 3.5 Implement `computeAvgRating(reviews: ParsedJobReview[], verifiedCustomerPubkeys: Set<string>): number` that computes the average rating from only verified customer reviews. Reviews from pubkeys NOT in `verifiedCustomerPubkeys` are excluded entirely (customer-gate per E6-R013 mitigation). Returns 0 when no verified reviews exist (not NaN)
  - [x] 3.6 Write unit test: score formula with known inputs produces expected output (T-6.4-01)
  - [x] 3.7 Write unit test: each signal component computed correctly from mock data (T-6.4-02)
  - [x] 3.8 Write unit test: edge cases -- channel_volume=0 (log10 guard), jobs_completed=0, avg_rating with 0 reviews (default to 0), trusted_by=0 all produce finite scores (T-6.4-03)
  - [x] 3.9 Write unit test: sybil review defense -- reviews from non-customer pubkeys excluded from avg_rating (T-6.4-08)
  - [x] 3.10 Write unit test: sybil WoT defense -- WoT declarations from zero-volume pubkeys not counted in trusted_by (T-6.4-10)
  - [x] 3.11 Write unit test: job completion count from Kind 6xxx events (T-6.4-17)

- [x] Task 4: Extend kind:10035 with reputation field (AC: #4)
  - [x] 4.1 Extend `SkillDescriptor` in `packages/core/src/events/service-discovery.ts` with optional `reputation?: ReputationScore` field. Add `import type { ReputationScore } from './reputation.js';` to the imports
  - [x] 4.2 Extend `BuildSkillDescriptorConfig` in `packages/sdk/src/skill-descriptor.ts` with optional `reputation?: ReputationScore` field. Add `import type { ReputationScore } from '@toon-protocol/core';` to the existing core imports. When provided, populate `SkillDescriptor.reputation` in the built descriptor (no validation needed -- `ReputationScore` is pre-computed by the caller)
  - [x] 4.3 Update `parseServiceDiscovery()` in `packages/core/src/events/service-discovery.ts` to validate the `reputation` field inside the existing `skill` (SkillDescriptor) parsing block (after the `attestation` validation at line ~310). When `skillRecord['reputation']` is present: validate it is a non-null object with numeric `score` (finite number) and `signals` object containing numeric `trustedBy`, `channelVolumeUsdc`, `jobsCompleted`, `avgRating` fields. Assign to `skillResult.reputation` when valid, omit when absent (backward compatible). Return `null` if `reputation` is present but malformed
  - [x] 4.4 Write unit test: provider kind:10035 includes `reputation` field with composite score and individual signals (T-6.4-12)
  - [x] 4.5 Write unit test: TEE attestation displayed alongside reputation as separate signal, NOT factored into numeric score (T-6.4-18)
  - [x] 4.6 Write unit test: kind:10035 backward compatibility -- existing events without `reputation` field parse successfully (existing test coverage, verify no regression)

- [x] Task 5: Implement `min_reputation` parameter handling (AC: #5)
  - [x] 5.1 Create utility function `hasMinReputation(params: { key: string; value: string }[]): number | null` in `packages/core/src/events/reputation.ts` that extracts the `min_reputation` param value as a number. Returns null if param not present. Returns the numeric value if present and valid. Throws `ToonError` with code `REPUTATION_INVALID_MIN_REPUTATION` if value is non-numeric
  - [x] 5.2 Write unit test: Kind 5xxx with `['param', 'min_reputation', '500']` -> `hasMinReputation()` returns 500 (T-6.4-14 part 1)
  - [x] 5.3 Write unit test: Kind 5xxx without `min_reputation` param -> `hasMinReputation()` returns null
  - [x] 5.4 Write unit test: provider with score < 500 should build Kind 7000 feedback with `status: 'error'` and reason `'min_reputation: provider score 400 below threshold 500'` using existing `buildJobFeedbackEvent()` (T-6.4-14 part 2 -- demonstrates integration pattern, not implementation; provider-side wiring is a deployment concern)

- [x] Task 6: Export and wire up (AC: all)
  - [x] 6.1 Export from `packages/core/src/events/index.ts`: `buildJobReviewEvent`, `parseJobReview`, `buildWotDeclarationEvent`, `parseWotDeclaration`, `ReputationScoreCalculator`, `JOB_REVIEW_KIND`, `WEB_OF_TRUST_KIND`, and all types (`JobReviewParams`, `ParsedJobReview`, `WotDeclarationParams`, `ParsedWotDeclaration`, `ReputationSignals`, `ReputationScore`)
  - [x] 6.2 Export from `packages/core/src/index.ts`: re-export reputation types from events/index.ts
  - [x] 6.3 Write unit test: new event kinds (Kind 31117, Kind 30382) traverse full SDK pipeline: shallow parse -> verify -> price -> dispatch (T-INT-08 partial -- verifies pipeline compatibility)

## Dev Notes

### Architecture and Constraints

**Key architectural decision: Threshold-based WoT defense (not weighted).** Per test-design-epic-6.md Section 10 mitigation E6-R014: "Recommend threshold for v1." WoT declarations from pubkeys with zero channel volume are excluded entirely (binary: has volume or doesn't). This is simpler to implement, test, and explain than a weighted model. Weighted WoT can be introduced in a future iteration if needed.

**Key architectural decision: Customer-gate for review sybil defense.** Per test-design-epic-6.md Section 10 mitigation E6-R013: `avg_rating` only counts Kind 31117 reviews from pubkeys that authored a Kind 5xxx job request referencing the reviewed provider. Reviews from non-customers are excluded entirely (not downweighted). This requires the caller to supply the set of verified customer pubkeys -- the calculator is a pure logic class that does not perform relay queries.

**Key architectural decision: Self-reported reputation in kind:10035.** The provider calculates their own score and includes it in their kind:10035 service discovery event. All signals are independently verifiable by customers (Kind 31117 from relay, Kind 30382 from relay, Kind 6xxx count from relay, channel volume from on-chain). Self-reporting is a pragmatic choice: computing reputation requires relay queries and on-chain reads that are expensive to perform on every kind:10035 read.

**Key architectural decision: TEE attestation is NOT part of reputation score.** Per E6-R018 and test-design-epic-6.md: TEE attestation is a separate binary trust signal displayed alongside the numeric reputation score. It is NOT factored into the composite score formula. This avoids conflating cryptographic proof (TEE) with statistical trust (reputation).

**Kind 31117 (NIP-33 parameterized replaceable):** Kind range 30000-39999 is NIP-33 parameterized replaceable. The `d` tag value = job request event ID. This means one review per `d` tag per pubkey. A reviewer can update their review by publishing a new Kind 31117 with the same `d` tag -- the relay replaces the old event.

**Kind 30382 (NIP-33 parameterized replaceable):** Also in the 30000-39999 range. The `d` tag value = target provider pubkey. One WoT declaration per declarer per target. A declarer can revoke trust by publishing a new Kind 30382 with empty content or by not publishing at all (absence = no trust).

**`log10(0)` guard:** `Math.log10(0)` returns `-Infinity` in JavaScript. This would produce `-Infinity × 10 = -Infinity`, corrupting the score. Guard with `Math.max(1, channelVolumeUsdc)` so `Math.log10(1) = 0`. Zero channel volume contributes 0 to the score, not a negative value.

**Forward-compatibility with Epic 7 prepaid protocol (D7-001):** `settleCompute()` will be deprecated in Epic 7. Story 6.4 does not directly use `settleCompute()` -- reputation scoring is orthogonal to the payment mechanism. Channel volume extraction reads on-chain settlement data, which is the same regardless of whether payment was prepaid or post-hoc.

**ReputationScoreCalculator is a pure logic class.** It receives pre-computed signals (WoT declarations, reviews, channel volume, job count) and calculates the composite score. It does NOT perform relay queries or on-chain reads. The caller is responsible for gathering the signals from relay and chain sources. This follows the same pattern as `AttestedResultVerifier` from Story 6.3.

### What Already Exists (DO NOT Recreate)

- **DVM event builders/parsers** in `packages/core/src/events/dvm.ts` -- `buildJobRequestEvent()`, `parseJobRequest()`, `buildJobResultEvent()`, `parseJobResult()`, `buildJobFeedbackEvent()`, `parseJobFeedback()`, `JobResultParams`, `ParsedJobResult`. The `HEX_64_REGEX` constant is defined here (NOT exported; define locally in `reputation.ts`)
- **`SkillDescriptor`** in `packages/core/src/events/service-discovery.ts` -- already has `attestation?: Record<string, unknown>` field (populated by Story 6.3). Will be extended with `reputation?: ReputationScore`
- **`buildSkillDescriptor()`** in `packages/sdk/src/skill-descriptor.ts` -- builds `SkillDescriptor` from handler registry and config. Currently populates `attestation` field from Story 6.3
- **`parseServiceDiscovery()`** in `packages/core/src/events/service-discovery.ts` -- validates kind:10035 content. Currently validates `skill` field when present
- **`hasRequireAttestation()`** in `packages/core/src/events/attested-result-verifier.ts` -- utility function for parameter detection. `hasMinReputation()` follows the same pattern
- **`ToonError`** in `packages/core/src/errors.ts` -- base error class for domain errors
- **TOON codec** -- `encodeEventToToon()`, `encodeEventToToonString()`, `decodeEventFromToon()`, `shallowParseToon()` in `@toon-protocol/core`
- **`AttestedResultVerifier`** in `packages/core/src/events/attested-result-verifier.ts` -- attestation verification (cross-story display in T-6.4-18)
- **Constants** in `packages/core/src/constants.ts` -- `JOB_REQUEST_KIND_BASE`, `JOB_RESULT_KIND_BASE`, `JOB_FEEDBACK_KIND`, `TEE_ATTESTATION_KIND`, `SERVICE_DISCOVERY_KIND`, `WORKFLOW_CHAIN_KIND`

### What to Create (New Files)

1. **`packages/core/src/events/reputation.ts`** -- Kind 31117 (Job Review) and Kind 30382 (Web of Trust) builders/parsers, `ReputationScoreCalculator` class, `hasMinReputation()` utility, types
2. **`packages/core/src/events/reputation.test.ts`** -- Unit tests for all reputation functionality

### What to Modify (Existing Files)

1. **`packages/core/src/constants.ts`** -- Add `JOB_REVIEW_KIND = 31117` and `WEB_OF_TRUST_KIND = 30382` constants
2. **`packages/core/src/events/service-discovery.ts`** -- Extend `SkillDescriptor` with optional `reputation?: ReputationScore` field; update `parseServiceDiscovery()` to validate `reputation` field
3. **`packages/core/src/events/index.ts`** -- Export reputation builders, parsers, calculator, types, and constants
4. **`packages/core/src/index.ts`** -- Re-export reputation types from events/index.ts
5. **`packages/sdk/src/skill-descriptor.ts`** -- Add optional `reputation?: ReputationScore` to `BuildSkillDescriptorConfig`; populate `SkillDescriptor.reputation` when provided
6. **`packages/sdk/src/skill-descriptor.test.ts`** -- Add tests for reputation field population

### Test Requirements (aligned with test-design-epic-6.md)

| ID | Test | Level | Risk | Priority | Task |
|----|------|-------|------|----------|------|
| T-6.4-01 | Score formula: verify with known inputs | U | -- | P0 | 3.6 |
| T-6.4-02 | Score components: each signal computed correctly from mock data | U | -- | P0 | 3.7 |
| T-6.4-03 | Score edge cases: channel_volume=0, jobs_completed=0, avg_rating with 0 reviews, trusted_by=0 | U | -- | P0 | 3.8 |
| T-6.4-04 | Kind 31117 TOON encode/decode roundtrip preserves all tags | U | E6-R016 | P0 | 1.5 |
| T-6.4-05 | Kind 31117 rating validation: integer 1-5 only | U | E6-R016 | P0 | 1.6 |
| T-6.4-06 | Kind 31117 NIP-33 replaceable: one review per job per reviewer | U | -- | P1 | 1.7 |
| T-6.4-07 | Kind 30382 TOON encode/decode roundtrip preserves tags | U | -- | P1 | 2.5 |
| T-6.4-08 | Sybil review defense: non-customer reviews excluded from avg_rating | U | E6-R013 | P0 | 3.9 |
| T-6.4-09 | Sybil review defense integration: reviewer with no Kind 5xxx -> excluded | I | E6-R013 | P0 | deferred (caller responsibility, not calculator concern) |
| T-6.4-10 | Sybil WoT defense: zero-volume declarers contribute 0 to trusted_by | U | E6-R014 | P0 | 3.10 |
| T-6.4-11 | Sybil WoT defense integration: new pubkeys with zero channel history -> not counted | I | E6-R014 | P0 | deferred (caller responsibility) |
| T-6.4-12 | Reputation in kind:10035: composite score + individual signals | U | -- | P1 | 4.4 |
| T-6.4-13 | Self-reported vs verified: customer recalculates score independently | I | E6-R017 | P1 | deferred (requires relay + chain reads) |
| T-6.4-14 | `min_reputation` filter: parameter detection and threshold comparison | U | -- | P1 | 5.2, 5.3, 5.4 |
| T-6.4-15 | Channel volume extraction: on-chain settlement data | I | E6-R015 | P1 | deferred (requires Anvil + TokenNetwork) |
| T-6.4-16 | Channel volume edge cases: multiple channels, closed channels | I | E6-R015 | P2 | deferred |
| T-6.4-17 | Job completion count from Kind 6xxx events | U | -- | P2 | 3.11 |
| T-6.4-18 | TEE attestation alongside reputation: separate signal | U | E6-R018 | P1 | 4.5 |
| T-6.4-19 | Reputation score update lifecycle E2E | E2E | E6-R013 | P3 | deferred |

### Risk Mitigation

**E6-R013 (Score 9, CRITICAL): Reputation gaming via fake reviews.** Sybil attack via self-generated Kind 31117 reviews. Attacker creates multiple keypairs, each posting 5-star reviews. Mitigation: `computeAvgRating()` accepts a `verifiedCustomerPubkeys` set -- only reviews from pubkeys in this set count toward `avg_rating`. The caller is responsible for building this set by checking Kind 5xxx job request history. Reviews from non-customers are excluded entirely, not downweighted. Tests: T-6.4-08, T-6.4-09.

**E6-R014 (Score 9, CRITICAL): Reputation gaming via sybil WoT.** Attacker generates many keypairs and publishes Kind 30382 WoT declarations targeting themselves. Mitigation: `computeTrustedBy()` uses a threshold model -- WoT declarations from pubkeys with zero channel volume (no on-chain settlement history) contribute 0 to the trusted_by count. This creates an on-chain anchor: creating meaningful WoT weight requires actual USDC settlement, making sybil attacks economically expensive. Tests: T-6.4-10, T-6.4-11.

**E6-R015 (Score 4): Channel volume extraction accuracy.** Incorrect contract ABI or missed channel closings lead to inaccurate volume calculation. Mitigation: channel volume extraction is deferred to integration testing with Anvil. The `ReputationScoreCalculator` receives pre-computed `channelVolumeUsdc` as a number -- the extraction logic is a separate concern. Tests: T-6.4-15, T-6.4-16 (both deferred to integration phase).

**E6-R016 (Score 4): Kind 31117 review structure integrity.** TOON encoding corrupts tag structure or rating values parsed incorrectly. Mitigation: TOON roundtrip test (T-6.4-04) and strict rating validation (T-6.4-05). Rating is validated as integer 1-5 at build time and parse time.

**E6-R017 (Score 4): Self-reported reputation trust.** Provider claims inflated score. Mitigation: all signals are independently verifiable. Customer can recalculate score from relay (Kind 31117, Kind 30382, Kind 6xxx) and on-chain data. Test T-6.4-13 (deferred to integration phase).

**E6-R018 (Score 4): Cross-story attestation + reputation.** TEE attestation is a separate binary trust signal alongside numeric reputation. Mitigation: `SkillDescriptor.attestation` (from Story 6.3) and `SkillDescriptor.reputation` (this story) are independent fields. Test: T-6.4-18.

**Inherited E5-R001 (Score 6): TOON encoding corruption of DVM tags.** New event kinds (Kind 31117, Kind 30382) must survive TOON roundtrip. Tests: T-6.4-04, T-6.4-07.

### Coding Standards Reminders

- **TypeScript strict mode** -- `noUncheckedIndexedAccess`, handle `T | undefined` from index access
- **Use bracket notation** for index signature access (`obj['key']` not `obj.key`)
- **`.js` extensions** in all imports (`import { foo } from './bar.js'`)
- **No `any` type** -- use `unknown` with type guards (relaxed to `warn` in test files)
- **`import type`** for type-only imports
- **Vitest** with `describe/it` blocks, AAA pattern (Arrange, Act, Assert)
- **`ToonError`** for domain errors with descriptive error codes
- **Follow `hasRequireAttestation()` pattern** for `hasMinReputation()` -- simple utility function extracting parameter from parsed params array
- **Follow `buildJobResultEvent()` pattern** for Kind 31117/30382 builders -- validate inputs, construct tags, finalize event
- **`HEX_64_REGEX`** for event ID/pubkey validation -- define locally in `reputation.ts` (NOT exported from `dvm.ts`)

### Error Codes

The following `ToonError` codes are introduced in this story:

- `REPUTATION_INVALID_RATING` -- `rating` provided to `buildJobReviewEvent()` is not an integer 1-5
- `REPUTATION_INVALID_ROLE` -- `role` provided to `buildJobReviewEvent()` is not `'customer'` or `'provider'`
- `REPUTATION_INVALID_TARGET_PUBKEY` -- `targetPubkey` provided to `buildJobReviewEvent()` or `buildWotDeclarationEvent()` is not a valid 64-char lowercase hex string
- `REPUTATION_INVALID_JOB_REQUEST_EVENT_ID` -- `jobRequestEventId` provided to `buildJobReviewEvent()` is not a valid 64-char lowercase hex string
- `REPUTATION_INVALID_MIN_REPUTATION` -- `min_reputation` param value is non-numeric

### Implementation Approach

1. **Kind 31117 and 30382 builders/parsers first (Tasks 1-2):** Define the new event kinds with full validation and TOON roundtrip testing. This is the data model foundation. Follows the same pattern as existing DVM event builders.
2. **Reputation score calculator (Task 3):** Pure logic class computing the composite score from pre-gathered signals. Customer-gate for reviews and threshold WoT defense are the most critical implementations (score-9 risks).
3. **Kind:10035 extension (Task 4):** Add `reputation` field to `SkillDescriptor` and `buildSkillDescriptor()`. Verify TEE attestation is displayed alongside (not mixed into) reputation.
4. **`min_reputation` parameter utility (Task 5):** Simple utility function following `hasRequireAttestation()` pattern.
5. **Export and pipeline verification (Task 6):** Wire up exports and verify new event kinds traverse the SDK pipeline correctly.

**Expected test count:** ~25-30 tests (19 from epic test design + validation error tests + backward compatibility + edge cases).

**Expected production code changes:**
- ~150-200 lines in `reputation.ts` (Kind 31117/30382 builders/parsers, `ReputationScoreCalculator`, `hasMinReputation()`, types)
- ~5-10 lines in `constants.ts` (2 new constants)
- ~15-20 lines in `service-discovery.ts` (extend `SkillDescriptor`, update parser)
- ~10-15 lines in `skill-descriptor.ts` (reputation config and population)
- ~10-15 lines in index.ts files (exports)
- **Total: ~190-260 lines of production code**

### Previous Story Intelligence (Story 6.3)

From Story 6.3 (TEE-Attested DVM Results -- preceding story in implementation order):

- **Pattern: Pure logic class with injected data.** `AttestedResultVerifier` receives both result and attestation events as parameters -- it does NOT fetch events from relay. `ReputationScoreCalculator` follows the same pattern: it receives pre-computed signals, it does NOT query relay or chain.
- **Pattern: Utility function for parameter detection.** `hasRequireAttestation()` extracts a boolean from parsed params array. `hasMinReputation()` extracts a numeric threshold from the same params structure.
- **Pattern: `HEX_64_REGEX` defined locally.** Story 6.3 defined `HEX_64_REGEX` locally in `skill-descriptor.ts` because it's not exported from `dvm.ts`. Story 6.4 follows the same pattern in `reputation.ts`.
- **Pattern: Additive fields on SkillDescriptor.** Story 6.3 populated the existing `attestation` placeholder. Story 6.4 adds a new `reputation` field alongside it. Both are optional for backward compatibility.
- **Pattern: Error codes with domain prefix.** Story 6.3 used `DVM_ATTESTATION_*` and `DVM_SKILL_*` prefixes. Story 6.4 uses `REPUTATION_*` prefix for its domain.

### Prepaid Protocol Note (Epic 7 Forward Compatibility)

Per Party Mode 2026-03-20 decisions (D7-001), `settleCompute()` will be deprecated in Epic 7 Story 7.6 in favor of prepaid DVM. Story 6.4 does not use `settleCompute()` -- reputation scoring reads historical settlement data (channel volume) and event counts, which are payment-mechanism agnostic. The reputation formula works identically with both prepaid and post-hoc settlement models.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 6.4: Reputation Scoring System`] -- Story definition and acceptance criteria
- [Source: `_bmad-output/planning-artifacts/test-design-epic-6.md#Story 6.4: Reputation Scoring System`] -- Test matrix T-6.4-01 through T-6.4-19
- [Source: `_bmad-output/planning-artifacts/test-design-epic-6.md#Section 3.4`] -- Reputation Signal Aggregation Chain integration boundary analysis
- [Source: `_bmad-output/planning-artifacts/test-design-epic-6.md#Section 10`] -- Mitigation plans for E6-R013 and E6-R014
- [Source: `_bmad-output/implementation-artifacts/6-3-tee-attested-dvm-results.md`] -- Story 6.3 patterns (pure logic class, parameter utility, HEX_64_REGEX, SkillDescriptor extension)
- [Source: `packages/core/src/events/dvm.ts`] -- DVM event builders/parsers pattern
- [Source: `packages/core/src/events/service-discovery.ts#SkillDescriptor`] -- SkillDescriptor to extend
- [Source: `packages/core/src/events/attested-result-verifier.ts#hasRequireAttestation`] -- Parameter detection utility pattern
- [Source: `packages/sdk/src/skill-descriptor.ts`] -- buildSkillDescriptor() to extend
- [Source: `packages/core/src/constants.ts`] -- Constants file for new kind constants

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
N/A

### Completion Notes List
- **Task 1 (Kind 31117 Job Review builder/parser):** Implemented `buildJobReviewEvent()` and `parseJobReview()` in `reputation.ts` with full validation (HEX_64_REGEX for event ID/pubkey, integer 1-5 rating, customer/provider role). ToonError codes: REPUTATION_INVALID_RATING, REPUTATION_INVALID_ROLE, REPUTATION_INVALID_TARGET_PUBKEY, REPUTATION_INVALID_JOB_REQUEST_EVENT_ID. TOON roundtrip verified (T-6.4-04). Rating validation tests pass for edge cases (T-6.4-05). NIP-33 replaceable semantics verified (T-6.4-06).
- **Task 2 (Kind 30382 Web of Trust builder/parser):** Implemented `buildWotDeclarationEvent()` and `parseWotDeclaration()` with d=p tag consistency enforcement. TOON roundtrip verified (T-6.4-07). Validation tests pass for invalid pubkeys.
- **Task 3 (ReputationScoreCalculator):** Implemented pure logic class with `calculateScore()`, `computeTrustedBy()` (threshold WoT defense -- zero-volume declarers excluded per E6-R014), and `computeAvgRating()` (customer-gate sybil defense per E6-R013). Formula: `score = (trustedBy*100) + (log10(max(1, channelVolumeUsdc))*10) + (jobsCompleted*5) + (avgRating*20)`. Edge cases verified: log10(0) guard, all-zeros produce 0 (T-6.4-03).
- **Task 4 (kind:10035 reputation field):** Extended `SkillDescriptor` with optional `reputation?: ReputationScore`. Updated `parseServiceDiscovery()` to validate reputation object structure (score + signals with 4 numeric fields). Extended `BuildSkillDescriptorConfig` in SDK. TEE attestation displayed alongside reputation as separate signal (T-6.4-18). Backward compatibility preserved.
- **Task 5 (min_reputation parameter):** Implemented `hasMinReputation()` utility following `hasRequireAttestation()` pattern. Returns numeric threshold or null. Throws REPUTATION_INVALID_MIN_REPUTATION for non-numeric values. Integration pattern demonstrated with Kind 7000 error feedback (T-6.4-14).
- **Task 6 (Export and pipeline):** All exports wired through `events/index.ts` and `core/index.ts`. Pipeline integration verified -- Kind 31117 and Kind 30382 traverse shallow parse pipeline (T-INT-08).

### Change Log
| Date | Author | Change |
|------|--------|--------|
| 2026-03-20 | Claude Opus 4.6 (1M context, create-story yolo mode) | Initial story creation with 6 tasks, 19 test IDs, 5 ACs, full dev notes |
| 2026-03-20 | Claude Opus 4.6 (1M context, adversarial review) | Review fixes: (1) AC #1 clarified threshold model for trusted_by (was ambiguously "weighted"), (2) AC #1 specified log10 guard mechanism, (3) AC #4 clarified reputation field location inside SkillDescriptor, (4) Task 4.1 added import type statement, (5) Task 4.2 added import type and validation note, (6) Task 4.3 made explicit about placement inside skill parsing block with line reference, (7) Fixed TOON codec function names (encodeToon->encodeEventToToon, decodeToon->decodeEventFromToon) |
| 2026-03-20 | Claude Opus 4.6 (1M context, dev-story yolo mode) | Implementation complete: all 6 tasks, 50 core tests + 40 SDK tests passing, 0 lint errors, full build clean. All ACs met. |

### File List
**New files (created):**
- `packages/core/src/events/reputation.ts` -- Kind 31117/30382 builders/parsers, ReputationScoreCalculator, hasMinReputation, types (417 lines)
- `packages/core/src/events/reputation.test.ts` -- Unit tests for all reputation functionality (1143 lines, 50 tests)

**Modified files (modified):**
- `packages/core/src/constants.ts` -- Added JOB_REVIEW_KIND = 31117 and WEB_OF_TRUST_KIND = 30382 constants
- `packages/core/src/events/service-discovery.ts` -- Extended SkillDescriptor with `reputation?: ReputationScore` field; updated `parseServiceDiscovery()` with reputation validation block
- `packages/core/src/events/index.ts` -- Added reputation exports (builders, parsers, calculator, types, constants)
- `packages/core/src/index.ts` -- Added reputation re-exports from events/index.ts
- `packages/sdk/src/skill-descriptor.ts` -- Added `reputation?: ReputationScore` to BuildSkillDescriptorConfig; populate in buildSkillDescriptor()
- `packages/sdk/src/skill-descriptor.test.ts` -- Added reputation field tests (Story 6.4 Task 4 section, ~130 lines, integrated with existing tests)

## Code Review Record

### Review Pass #1
- **Date:** 2026-03-20
- **Reviewer model:** Claude Opus 4.6 (1M context)
- **Issues found:** 0 critical, 0 high, 0 medium, 4 low
  - **Fixed (2):**
    1. Empty string `hasMinReputation` bug -- `hasMinReputation()` did not correctly handle empty string param values
    2. Missing tests -- added test coverage for the empty string edge case
  - **Acknowledged as design decisions (2):**
    3. Self-reported reputation in kind:10035 (acknowledged -- all signals independently verifiable per AC #4)
    4. Threshold-based WoT defense vs weighted model (acknowledged -- threshold is simpler for v1 per E6-R014)
- **Outcome:** Pass

### Review Pass #2
- **Date:** 2026-03-20
- **Reviewer model:** Claude Opus 4.6 (1M context)
- **Issues found:** 0 critical, 0 high, 1 medium, 3 low
  - **Fixed (1 medium, 1 low):**
    1. (MEDIUM) `hasMinReputation()` accepted `Infinity` and `-Infinity` as valid thresholds -- `isNaN()` returns false for Infinity values, allowing nonsensical thresholds. Fixed by adding `!isFinite()` guard alongside `isNaN()` check. Added 2 new tests for Infinity/-Infinity rejection.
    2. (LOW) Unnecessary intermediate variable `const value = Number(trimmed); return value;` -- simplified to `return Number(trimmed);`.
  - **Acknowledged as design decisions (2 low):**
    3. (LOW) `computeAvgRating` takes `{ review, reviewerPubkey }[]` instead of the story spec's `(reviews: ParsedJobReview[], ...)` -- correct design choice since `ParsedJobReview` doesn't contain the reviewer pubkey (only `targetPubkey`). The wrapper object provides the necessary pubkey binding.
    4. (LOW) `hasMinReputation` return type differs from `hasRequireAttestation` (number|null vs boolean) -- correct since they have different semantics (numeric extraction vs boolean check).
- **Outcome:** Pass

### Review Pass #3
- **Date:** 2026-03-20
- **Reviewer model:** Claude Opus 4.6 (1M context)
- **Issues found:** 0 critical, 0 high, 1 medium, 1 low
  - **Fixed (1 medium, 1 low):**
    1. (MEDIUM) `calculateScore` NaN/Infinity guard added -- ensured the score formula produces finite numbers for all valid inputs.
    2. (LOW) Consolidated double `Number()` conversion -- removed unnecessary intermediate `Number()` call.
  - **OWASP Top 10:** 0 vulnerabilities
- **All tests pass:** Yes
- **Outcome:** Pass (final)
