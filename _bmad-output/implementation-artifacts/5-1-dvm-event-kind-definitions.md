# Story 5.1: DVM Event Kind Definitions

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **protocol developer**,
I want NIP-90 compatible DVM event kinds defined for the Crosstown protocol with full TOON encoding support,
So that agents can post structured job requests, receive feedback, and collect results using the standard DVM protocol.

**FRs covered:** FR-DVM-1 (The protocol SHALL define DVM event kinds using NIP-90 compatible Nostr event kinds: Kind 5xxx for job requests, Kind 6xxx for job results, and Kind 7000 for job feedback, with full TOON encoding/decoding support)

**Dependencies:** Epic 4 complete (all 6 stories, commit `9e057c3` on `main`). Specifically requires: TOON codec in `@crosstown/core/toon` (Story 1.0), `finalizeEvent()` from `nostr-tools/pure` (used since Story 1.0), event builder/parser pattern from `attestation.ts` (Story 4.2), `service-discovery.ts` (Story 3.5), `seed-relay.ts` (Story 3.4), constants pattern in `packages/core/src/constants.ts`. No new package dependencies required -- all infrastructure exists in `@crosstown/core`.

**Decision sources:**
- Decision 4 (party-mode-2020117-analysis): NIP-90 compatible event kinds for cross-network interoperability
- Decision 2 (party-mode-2020117-analysis): ILP-native as preferred path, x402 as fallback (Story 5.2 concern, but informs event structure here)
- Decision 5 (party-mode-2020117-analysis): Skill descriptors in kind:10035, not separate event kind (Story 5.4 concern, defines kind range here)
- Decision 6 (party-mode-2020117-analysis): Epic 5 scope is stories 5.1-5.4 (core lifecycle + skill descriptors)

**Downstream dependencies:** Story 5.1 is the foundation for ALL Epic 5 stories. Story 5.2 (ILP-Native Job Submission), Story 5.3 (Job Result Delivery + Compute Settlement), and Story 5.4 (Skill Descriptors) all depend on the event kind definitions, builders, and parsers from this story. See `_bmad-output/planning-artifacts/test-design-epic-5.md` Section 1 dependency chain.

## Acceptance Criteria

1. Given a Crosstown developer importing from `@crosstown/core`, when they call `buildJobRequestEvent(params, secretKey)` with a valid `JobRequestParams` containing a DVM kind (e.g., 5100), input data, bid amount, and output MIME type, then a signed Kind 5xxx Nostr event is produced with required NIP-90 tags: `['i', data, type, relay?, marker?]`, `['bid', amount, 'usdc']`, `['output', mimeType]`, and optional tags `['p', providerPubkey]`, `['param', key, value]`, `['relays', url1, ...]` when provided. The event has a valid Schnorr signature verifiable by `nostr-tools`.

2. Given a Crosstown developer importing from `@crosstown/core`, when they call `buildJobResultEvent(params, secretKey)` with a valid `JobResultParams` containing a result kind (e.g., 6100 = request kind + 1000), request event ID, customer pubkey, compute cost, and result content, then a signed Kind 6xxx Nostr event is produced with required NIP-90 tags: `['e', requestEventId]`, `['p', customerPubkey]`, `['amount', computeCost, 'usdc']`, and the content field containing the result data.

3. Given a Crosstown developer importing from `@crosstown/core`, when they call `buildJobFeedbackEvent(params, secretKey)` with a valid `JobFeedbackParams` containing a request event ID, customer pubkey, and status value (`'processing'` | `'error'` | `'success'` | `'partial'`), then a signed Kind 7000 Nostr event is produced with required NIP-90 tags: `['e', requestEventId]`, `['p', customerPubkey]`, `['status', statusValue]`, and optional content with status details.

4. Given a DVM event (Kind 5xxx, 6xxx, or 7000) built with the builder functions, when it is TOON-encoded via `encodeEventToToon()` and then decoded via `decodeEventFromToon()`, then ALL tags (including multi-value tags like `i` with type+relay+marker, `param` with key-value, and `bid` with amount+currency), content, and metadata survive the roundtrip with identical values and tag order preserved.

5. Given a TOON-encoded DVM event (Kind 5100, 6100, or 7000), when `shallowParseToon()` is called, then it correctly extracts `kind`, `pubkey`, `id`, and `sig` without full decode -- enabling routing decisions. (**Note:** This is a validation AC. The existing shallow parser already handles arbitrary integer kinds. No code changes expected -- only roundtrip tests proving DVM kinds work correctly.)

6. Given the DVM kind constants exported from `@crosstown/core`, when a developer inspects the exports, then `TEXT_GENERATION_KIND = 5100` is defined as the reference DVM kind, and `IMAGE_GENERATION_KIND = 5200`, `TEXT_TO_SPEECH_KIND = 5300`, `TRANSLATION_KIND = 5302` are defined as additional kinds with optional provider support. Base constants `JOB_REQUEST_KIND_BASE = 5000`, `JOB_RESULT_KIND_BASE = 6000`, `JOB_FEEDBACK_KIND = 7000` are also exported.

7. Given a Kind 5xxx job request event, when a provider parses it via `parseJobRequest()`, then a `p` tag presence indicates a targeted request to a specific provider, and absence of a `p` tag indicates an open marketplace request available to any provider.

## Tasks / Subtasks

- [x] Task 1: Define DVM event kind constants and type definitions in `@crosstown/core` (AC: #1, #2, #3, #6)
  - [x] 1.1 Add DVM kind constants to `packages/core/src/constants.ts`:
    - `JOB_REQUEST_KIND_BASE = 5000` -- NIP-90 job request range (5000-5999)
    - `JOB_RESULT_KIND_BASE = 6000` -- NIP-90 job result range (6000-6999), result kind = request kind + 1000
    - `JOB_FEEDBACK_KIND = 7000` -- NIP-90 job feedback (single kind)
    - JSDoc on each explaining NIP-90 semantics
  - [x] 1.2 Define DVM TypeScript interfaces in new `packages/core/src/events/dvm.ts`: `JobRequestParams`, `JobResultParams`, `JobFeedbackParams` (builder inputs) and `ParsedJobRequest`, `ParsedJobResult`, `ParsedJobFeedback` (parser outputs):
    - Follow the interface pattern from `attestation.ts` (`TeeAttestation`, `ParsedAttestation`)
    - All interfaces use JSDoc on every field
  - [x] 1.3 Define `DvmJobStatus` type: `'processing' | 'error' | 'success' | 'partial'` -- export from `dvm.ts`
  - [x] 1.4 Define specific kind constants in `packages/core/src/constants.ts`:
    - `TEXT_GENERATION_KIND = 5100` (reference DVM kind)
    - `IMAGE_GENERATION_KIND = 5200`
    - `TEXT_TO_SPEECH_KIND = 5300`
    - `TRANSLATION_KIND = 5302`
  - [x] 1.5 Export all new types (`DvmJobStatus`, `JobRequestParams`, `JobResultParams`, `JobFeedbackParams`, `ParsedJobRequest`, `ParsedJobResult`, `ParsedJobFeedback`), constants (`JOB_REQUEST_KIND_BASE`, `JOB_RESULT_KIND_BASE`, `JOB_FEEDBACK_KIND`, `TEXT_GENERATION_KIND`, `IMAGE_GENERATION_KIND`, `TEXT_TO_SPEECH_KIND`, `TRANSLATION_KIND`), and functions (`buildJobRequestEvent`, `buildJobResultEvent`, `buildJobFeedbackEvent`, `parseJobRequest`, `parseJobResult`, `parseJobFeedback`) from `packages/core/src/events/index.ts` and `packages/core/src/index.ts`

- [x] Task 2: Implement DVM event builders (AC: #1, #2, #3, #7)
  - [x] 2.1 Implement `buildJobRequestEvent(params: JobRequestParams, secretKey: Uint8Array): NostrEvent`:
    - Validate required params: `params.input` (data + type), `params.bid` (non-empty string), `params.output` (non-empty string)
    - Validate kind range: 5000-5999 (throw if outside range)
    - Construct tags: `['i', data, type, relay?, marker?]`, `['bid', bid, 'usdc']`, `['output', output]`
    - Add optional `['p', targetProvider]` when `params.targetProvider` is provided
    - Add optional `['param', key, value]` for each entry in `params.params`
    - Add optional `['relays', ...urls]` when `params.relays` is provided
    - Content: `params.content ?? ''`
    - Sign with `finalizeEvent()` from `nostr-tools/pure`
  - [x] 2.2 Implement `buildJobResultEvent(params: JobResultParams, secretKey: Uint8Array): NostrEvent`:
    - Validate required params: `params.requestEventId` (64-char hex), `params.customerPubkey` (64-char hex), `params.amount` (non-empty string), `params.content` (string)
    - Validate kind range: 6000-6999 (throw if outside range)
    - Construct tags: `['e', requestEventId]`, `['p', customerPubkey]`, `['amount', amount, 'usdc']`
    - Content: `params.content`
    - Sign with `finalizeEvent()`
  - [x] 2.3 Implement `buildJobFeedbackEvent(params: JobFeedbackParams, secretKey: Uint8Array): NostrEvent`:
    - Validate required params: `params.requestEventId` (64-char hex), `params.customerPubkey` (64-char hex), `params.status` (one of DvmJobStatus values)
    - Kind: fixed at 7000 (`JOB_FEEDBACK_KIND`)
    - Construct tags: `['e', requestEventId]`, `['p', customerPubkey]`, `['status', status]`
    - Content: `params.content ?? ''`
    - Sign with `finalizeEvent()`
  - [x] 2.4 Validate `bid` and `amount` values as non-empty string representations of USDC micro-units (bigint-compatible). Throw `CrosstownError` on empty string or non-string values.

- [x] Task 3: Implement DVM event parsers (AC: #1, #2, #3, #7)
  - [x] 3.1 Implement `parseJobRequest(event: NostrEvent): ParsedJobRequest | null`:
    - Validate `event.kind` is in 5000-5999 range; return null if not
    - Extract required tags: `i` (with data, type, optional relay, marker), `bid` (with amount, currency), `output` (with mimeType)
    - Extract optional tags: `p` (targetProvider), `param` (collect all into array), `relays`
    - Content is the event content field directly (not parsed as JSON)
    - Return null if any required tag is missing
  - [x] 3.2 Implement `parseJobResult(event: NostrEvent): ParsedJobResult | null`:
    - Validate `event.kind` is in 6000-6999 range; return null if not
    - Extract required tags: `e` (requestEventId), `p` (customerPubkey), `amount` (with cost, currency)
    - Content is the event content field directly
    - Return null if any required tag is missing
  - [x] 3.3 Implement `parseJobFeedback(event: NostrEvent): ParsedJobFeedback | null`:
    - Validate `event.kind` is exactly 7000; return null if not
    - Extract required tags: `e` (requestEventId), `p` (customerPubkey), `status` (validate against DvmJobStatus values)
    - Content is the event content field directly
    - Return null if status is not one of: `'processing'`, `'error'`, `'success'`, `'partial'`
    - Return null if any required tag is missing
  - [x] 3.4 All parsers follow the lenient parse pattern: return null for malformed events (same pattern as `parseServiceDiscovery()` and `parseAttestation()` without `verify: true`)

- [x] Task 4: TOON roundtrip validation for DVM events (AC: #4, #5)
  - [x] 4.1 Write TOON encode -> decode roundtrip tests for Kind 5100 job request with complex tags (multi-value `i` tag with relay+marker, multiple `param` tags, `relays` tag with multiple URLs) -- covers T-5.1-01
  - [x] 4.2 Write TOON encode -> decode roundtrip tests for Kind 6100 job result (kind = 5100 + 1000) with `e`, `p`, `amount` tags and content -- covers T-5.1-02
  - [x] 4.3 Write TOON encode -> decode roundtrip tests for Kind 7000 feedback with `e`, `p`, `status` tags and content -- covers T-5.1-03
  - [x] 4.4 Verify TOON shallow parser `shallowParseToon()` extracts kind correctly for DVM kinds (5100, 6100, 7000) without full decode -- covers T-5.1-04. **Note:** No shallow parser code changes expected; this validates existing behavior.
  - [x] 4.5 Verify tag order preservation through TOON roundtrip (tags in decoded event appear in same order as original)

- [x] Task 5: NIP-90 compatibility validation (AC: #1, #2, #3, #7)
  - [x] 5.1 Validate `i` tag format matches NIP-90: `['i', data, type, relay?, marker?]` -- covers T-5.1-09
  - [x] 5.2 Validate `bid` tag format includes currency element: `['bid', amountString, 'usdc']` -- Crosstown extension to NIP-90 (NIP-90 uses satoshis; Crosstown uses USDC micro-units)
  - [x] 5.3 Validate `output` tag format: `['output', mimeType]`
  - [x] 5.4 Validate `amount` tag format includes currency element: `['amount', costString, 'usdc']`
  - [x] 5.5 Validate targeted request detection: Kind 5xxx with `p` tag = targeted; without = open marketplace -- covers T-5.1-10

- [x] Task 6: Unit tests for all builders, parsers, and validation (AC: all)
  - [x] 6.1 Required tag validation for builders: missing `i` tag -> error; missing `bid` -> error -- covers T-5.1-05
  - [x] 6.2 Required tag validation for builders: missing `e` tag -> error; missing `amount` -> error -- covers T-5.1-06
  - [x] 6.3 Kind 7000 `status` tag values: all four accepted (`processing`, `error`, `success`, `partial`); invalid status rejected by both builder and parser -- covers T-5.1-07
  - [x] 6.4 `bid`/`amount` values in USDC micro-units format validation: string representation of bigint, e.g., `'1000000'` for 1 USDC -- covers T-5.1-11
  - [x] 6.5 Kind constant definitions: `TEXT_GENERATION_KIND = 5100` is reference; `IMAGE_GENERATION_KIND = 5200`, `TEXT_TO_SPEECH_KIND = 5300`, `TRANSLATION_KIND = 5302` are defined -- covers T-5.1-08
  - [x] 6.6 Edge cases: empty content, many tags (>20), large content payload (>10KB)
  - [x] 6.7 Parser returns null for: wrong kind range, missing required tags, non-object event
  - [x] 6.8 Builder throws for: kind outside valid range (e.g., 4999, 6000 for request builder)

- [ ] Task 7: Review follow-up -- Update project-context.md event kinds table (from Code Review #1, L2)
  - [ ] 7.1 Add DVM event kinds (Kind 5xxx job requests, Kind 6xxx job results, Kind 7000 job feedback) to the event kinds table in `_bmad-output/project-context.md` -- deferred to epic-level review

## Dev Notes

### Architecture and Constraints

**Package:** `@crosstown/core` -- DVM event definitions belong in core because they are protocol-level constructs used by SDK, Town, and future packages. Follow the exact pattern established by `attestation.ts`, `service-discovery.ts`, and `seed-relay.ts` in `packages/core/src/events/`.

**NIP-90 DVM Protocol:** Standard Nostr DVM protocol. Event kinds 5000-5999 are job requests, 6000-6999 are results (kind = request kind + 1000), and 7000 is feedback. Crosstown adopts these kinds for interoperability with the broader Nostr DVM ecosystem (2020117, DVMDash, etc.).

**Key Architectural Decisions (from Party Mode 2020117 Analysis):**
- Decision 4: NIP-90 compatible event kinds for cross-network interoperability
- Decision 2: ILP-native as preferred path, x402 as fallback (Story 5.2 concern, but defines event structure here)
- Decision 5: Skill descriptors go in kind:10035, not separate event kind (Story 5.4 concern, defines kind range here)
- DVM events use **standard Nostr JSON** in content field -- TOON encoding is the relay's internal format; DVM protocol uses JSON for cross-network compatibility

**TOON Encoding:** DVM events are just Nostr events with specific kinds. The existing TOON codec already handles arbitrary Nostr events. No TOON codec changes should be needed -- this story validates that DVM events survive the roundtrip, not modifies the codec. If tags are corrupted, escalate to Score 9 and investigate TOON format extension for ordered tag support (conditional escalation from E5-R001).

**USDC Denomination:** `bid` and `amount` tag values are in USDC micro-units (6 decimals). This matches the Epic 3 convention. Use string representation for bigint compatibility in Nostr event tags (tags are always string arrays). The `bid` and `amount` tags include a third element `'usdc'` to explicitly declare the currency (Crosstown extension to NIP-90 which uses satoshis).

**Two-Tier Access:** DVM events enter the relay through the same write paths as all other events (ILP PREPARE or x402 /publish). This story does NOT implement submission -- it defines the event structure. Stories 5.2 and 5.3 handle submission and settlement.

**Pipeline Invariant:** DVM events (Kind 5xxx/6xxx/7000) flow through the exact same SDK processing pipeline as all other events: shallow parse -> verify -> price -> dispatch. No special-casing. DVM events pay relay write fees like all other events. Compute settlement is a separate, subsequent payment (Story 5.3).

### What Already Exists (DO NOT Recreate)

- **TOON codec** in `@crosstown/core/toon`: `encodeEventToToon()`, `decodeEventFromToon()`, `shallowParseToon()` -- already handles arbitrary event kinds including DVM ranges (5000-7000). The shallow parser validates `kind` as any integer, `pubkey`/`id` as 64-char hex, `sig` as 128-char hex. Source: `packages/core/src/toon/shallow-parse.ts`.
- **Event builders** in `packages/core/src/events/`: `attestation.ts`, `service-discovery.ts`, `seed-relay.ts` -- follow their pattern exactly (import `finalizeEvent`, define types, builder function, parser function, re-export constants)
- **Constants** in `packages/core/src/constants.ts`: `ILP_PEER_INFO_KIND = 10032`, `SERVICE_DISCOVERY_KIND = 10035`, `SEED_RELAY_LIST_KIND = 10036`, `TEE_ATTESTATION_KIND = 10033`
- **Export chain**: `packages/core/src/events/index.ts` re-exports from event modules, `packages/core/src/index.ts` re-exports from `events/index.ts`
- **nostr-tools types**: `NostrEvent` from `nostr-tools/pure` -- use directly, do not redefine
- **`finalizeEvent()`** from `nostr-tools/pure` -- use for event signing (same as attestation.ts and service-discovery.ts)
- **Handler registry** in `@crosstown/sdk`: `HandlerRegistry.on(kind, handler)` -- already routes by numeric kind, no changes needed for DVM kinds (Story 5.2 concern, not this story)

### What to Create (New Files)

1. **`packages/core/src/events/dvm.ts`** -- Builder functions (`buildJobRequestEvent`, `buildJobResultEvent`, `buildJobFeedbackEvent`), parser functions (`parseJobRequest`, `parseJobResult`, `parseJobFeedback`), DVM-specific types (`JobRequestParams`, `JobResultParams`, `JobFeedbackParams`, `ParsedJobRequest`, `ParsedJobResult`, `ParsedJobFeedback`, `DvmJobStatus`)
2. **`packages/core/src/events/dvm.test.ts`** -- Co-located unit tests (builders, parsers, validation, NIP-90 compliance, TOON roundtrip)

### What to Modify (Existing Files)

1. **`packages/core/src/constants.ts`** -- Add 7 DVM kind constants: `JOB_REQUEST_KIND_BASE`, `JOB_RESULT_KIND_BASE`, `JOB_FEEDBACK_KIND`, `TEXT_GENERATION_KIND`, `IMAGE_GENERATION_KIND`, `TEXT_TO_SPEECH_KIND`, `TRANSLATION_KIND`
2. **`packages/core/src/events/index.ts`** -- Re-export all DVM builders, parsers, types, and constants from `./dvm.js`
3. **`packages/core/src/index.ts`** -- Export DVM public API (types and constants may be exported directly; functions flow through `events/index.ts`)

### Project Structure Notes

- New DVM module follows the established `packages/core/src/events/` directory pattern
- Co-located test file `dvm.test.ts` next to `dvm.ts` (same pattern as `attestation.test.ts`, `service-discovery.test.ts`)
- Constants added to existing `constants.ts` (not a new constants file)
- All exports flow through `events/index.ts` -> `index.ts` (established export chain)
- No ATDD stubs exist yet for Story 5.1 -- the `_bmad-output/test-artifacts/atdd-checklist-epic-5.md` contains the checklist but stubs are created during implementation

### NIP-90 Tag Reference

**Kind 5xxx (Job Request) tags:**
```
Required:
  ['i', inputData, inputType, relay?, marker?]  -- input data + type
  ['bid', amountMicroUsdc, 'usdc']              -- bid amount in USDC micro-units
  ['output', mimeType]                           -- expected output MIME type

Optional:
  ['p', providerPubkey]                          -- target specific provider (omit for open marketplace)
  ['param', key, value]                          -- key-value parameters (repeatable)
  ['relays', url1, url2, ...]                    -- preferred relay URLs
```

**Kind 6xxx (Job Result) tags:**
```
Required:
  ['e', requestEventId]                          -- references the Kind 5xxx request
  ['p', customerPubkey]                          -- customer who posted the request
  ['amount', computeCostMicroUsdc, 'usdc']       -- compute cost in USDC micro-units

Content: result data (text, URL, etc.)

Note: Result kind = request kind + 1000 (e.g., Kind 5100 request -> Kind 6100 result)
```

**Kind 7000 (Job Feedback) tags:**
```
Required:
  ['e', requestEventId]                          -- references the Kind 5xxx request
  ['p', customerPubkey]                          -- customer who posted the request
  ['status', statusValue]                        -- 'processing' | 'error' | 'success' | 'partial'

Content: optional status details / error message
```

### Builder Function Signatures

Follow the established pattern from `buildAttestationEvent()` and `buildServiceDiscoveryEvent()`:

```typescript
// Job Request Builder
interface JobRequestParams {
  kind: number;                              // e.g., 5100 for text generation (must be 5000-5999)
  input: { data: string; type: string; relay?: string; marker?: string };
  bid: string;                               // USDC micro-units as string (bigint-safe)
  output: string;                            // MIME type
  content?: string;                          // optional body text
  targetProvider?: string;                   // 64-char hex pubkey
  params?: Array<{ key: string; value: string }>;
  relays?: string[];
}
buildJobRequestEvent(params: JobRequestParams, secretKey: Uint8Array): NostrEvent

// Job Result Builder
interface JobResultParams {
  kind: number;                              // e.g., 6100 (= request kind + 1000, must be 6000-6999)
  requestEventId: string;                    // 64-char hex event ID
  customerPubkey: string;                    // 64-char hex pubkey
  amount: string;                            // USDC micro-units as string
  content: string;                           // result data
}
buildJobResultEvent(params: JobResultParams, secretKey: Uint8Array): NostrEvent

// Job Feedback Builder
interface JobFeedbackParams {
  requestEventId: string;                    // 64-char hex event ID
  customerPubkey: string;                    // 64-char hex pubkey
  status: DvmJobStatus;                      // 'processing' | 'error' | 'success' | 'partial'
  content?: string;                          // optional status details
}
buildJobFeedbackEvent(params: JobFeedbackParams, secretKey: Uint8Array): NostrEvent
```

### Parser Function Signatures

Follow the lenient parse pattern from `parseServiceDiscovery()` and `parseAttestation()`:

```typescript
// Parsed structures
interface ParsedJobRequest {
  kind: number;
  input: { data: string; type: string; relay?: string; marker?: string };
  bid: string;
  output: string;
  content: string;
  targetProvider?: string;
  params: Array<{ key: string; value: string }>;
  relays: string[];
}

interface ParsedJobResult {
  kind: number;
  requestEventId: string;
  customerPubkey: string;
  amount: string;
  content: string;
}

interface ParsedJobFeedback {
  requestEventId: string;
  customerPubkey: string;
  status: DvmJobStatus;
  content: string;
}

parseJobRequest(event: NostrEvent): ParsedJobRequest | null
parseJobResult(event: NostrEvent): ParsedJobResult | null
parseJobFeedback(event: NostrEvent): ParsedJobFeedback | null
```

**Parser implementation notes:**
- Parse from Nostr event tags (NOT from content JSON) for `i`, `bid`, `output`, `e`, `p`, `amount`, `status`, `param`, `relays` -- NIP-90 puts DVM metadata in tags, not content
- Content field contains the actual data (job description, result payload, feedback text)
- Return null for malformed events (missing required tags, invalid kind range)
- Validate kind ranges: 5000-5999 for requests, 6000-6999 for results, exactly 7000 for feedback
- Handle `noUncheckedIndexedAccess`: tag element access returns `string | undefined`; check before use
- Use bracket notation for record access (`record['field']` not `record.field`)

### Test Requirements (from test-design-epic-5.md)

| ID | Test | Level | Priority | Task |
|----|------|-------|----------|------|
| T-5.1-01 | Kind 5100 TOON roundtrip preserves all required + optional tags | U | P0 | 4.1 |
| T-5.1-02 | Kind 6xxx TOON roundtrip preserves required tags + content | U | P0 | 4.2 |
| T-5.1-03 | Kind 7000 TOON roundtrip preserves required tags + content | U | P0 | 4.3 |
| T-5.1-04 | TOON shallow parser extracts kind for DVM events without full decode | U | P0 | 4.4 |
| T-5.1-05 | Kind 5xxx missing `i` tag -> construction error; missing `bid` -> error | U | P1 | 6.1 |
| T-5.1-06 | Kind 6xxx missing `e` tag -> construction error; missing `amount` -> error | U | P1 | 6.2 |
| T-5.1-07 | Kind 7000 status values: processing/error/success/partial accepted; invalid rejected | U | P1 | 6.3 |
| T-5.1-08 | Kind 5100 is reference DVM kind; 5200, 5300, 5302 defined but optional | U | P2 | 6.5 |
| T-5.1-09 | NIP-90 `i` tag format: `['i', data, type, relay?, marker?]` matches spec | U | P1 | 5.1 |
| T-5.1-10 | Targeted request: `p` tag = specific provider; no `p` tag = open marketplace | U | P2 | 5.5 |
| T-5.1-11 | `bid` value in USDC micro-units (6 decimals) as string representation | U | P1 | 6.4 |

**Additional cross-story integration tests (defined for later stories but relevant for validation):**
- T-INT-01: Kind 5100 with complex DVM tags survives TOON roundtrip AND arrives at handler with all tags intact (validates Story 5.1 -> 5.2 boundary)
- T-INT-03: Kind 6xxx `amount` tag preserved through TOON encode/decode as USDC micro-units (validates Story 5.1 -> 5.3 boundary)
- T-INT-06: DVM events traverse full SDK pipeline with no stage skipped (validates pipeline ordering invariant)

### Risk Mitigation

**E5-R001 (Score 6): TOON encoding corruption of DVM event tags** -- This is the highest risk. DVM events have complex multi-value tags (`i` with type+relay+marker, `param` with key-value). Roundtrip tests (T-5.1-01 through T-5.1-03) are P0 gating tests. If tag structure is corrupted, ALL downstream stories (5.2, 5.3, 5.4) are blocked. **Conditional escalation:** If TOON encoder does not preserve tag ordering or corrupts multi-value tags, escalate to Score 9 and investigate TOON format extension for ordered tag support.

**E5-R002 (Score 4): NIP-90 compatibility drift** -- Validate DVM event tag structures against NIP-90 spec. Required tags must match NIP-90 format exactly. T-5.1-09 is the gating NIP-90 compliance test. **Note:** Crosstown's `bid` and `amount` tags extend NIP-90 with a third element (`'usdc'`) for currency declaration. This is documented but does not break NIP-90 parsers (extra tag elements are ignored per Nostr convention).

### Coding Standards Reminders

- **TypeScript strict mode** -- `noUncheckedIndexedAccess`, handle `T | undefined` from index access (critical for tag element parsing)
- **Use bracket notation** for index signature access (`obj['key']` not `obj.key`) -- enforced by `noPropertyAccessFromIndexSignature`
- **`.js` extensions** in all imports (`import { foo } from './bar.js'`)
- **No `any` type** -- use `unknown` with type guards (relaxed to `warn` in test files)
- **`import type`** for type-only imports (`import type { NostrEvent } from 'nostr-tools/pure'`)
- **`finalizeEvent()`** from `nostr-tools/pure` for signing events (not `getEventHash` + manual signing)
- **Vitest** with `describe/it` blocks, AAA pattern (Arrange, Act, Assert)
- **Factory functions** for test fixtures (deterministic data, fixed timestamps/keys -- do NOT use random values)
- **JSDoc** for all exported functions and types
- **`CrosstownError`** for validation errors in builders (not generic `Error`)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` -- Epic 5 description, FR-DVM-1]
- [Source: `_bmad-output/planning-artifacts/research/party-mode-2020117-analysis-2026-03-10.md` -- Decisions 2, 4, 5, 6]
- [Source: `_bmad-output/planning-artifacts/test-design-epic-5.md` -- Section 4, Story 5.1 tests (T-5.1-01 through T-5.1-11) and Section 5 cross-story integration tests (T-INT-01, T-INT-03, T-INT-06)]
- [Source: `_bmad-output/test-artifacts/atdd-checklist-epic-5.md` -- ATDD checklist for Epic 5]
- [Source: `_bmad-output/project-context.md` -- TOON Format Handling, SDK Pipeline, Naming Conventions, Testing Rules]
- [Source: `packages/core/src/events/attestation.ts` -- Event builder/parser pattern (buildAttestationEvent, parseAttestation)]
- [Source: `packages/core/src/events/service-discovery.ts` -- Event builder/parser pattern (buildServiceDiscoveryEvent, parseServiceDiscovery)]
- [Source: `packages/core/src/constants.ts` -- Event kind constant pattern (ILP_PEER_INFO_KIND, TEE_ATTESTATION_KIND, etc.)]
- [Source: `packages/core/src/toon/shallow-parse.ts` -- Shallow parser handles arbitrary integer kinds (validates DVM kinds work as-is)]
- [Source: `packages/core/src/events/index.ts` -- Export chain pattern for event module re-exports]
- [Source: NIP-90 specification -- DVM event kinds 5xxx/6xxx/7000 tag formats]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None -- implementation was clean, no debugging sessions required.

### Completion Notes List

- **Task 1 (Constants):** Added 7 DVM kind constants to `packages/core/src/constants.ts`: `JOB_REQUEST_KIND_BASE=5000`, `JOB_RESULT_KIND_BASE=6000`, `JOB_FEEDBACK_KIND=7000`, `TEXT_GENERATION_KIND=5100`, `IMAGE_GENERATION_KIND=5200`, `TEXT_TO_SPEECH_KIND=5300`, `TRANSLATION_KIND=5302`. Each constant has JSDoc explaining NIP-90 semantics.
- **Task 2 (Builders):** Implemented `buildJobRequestEvent()`, `buildJobResultEvent()`, `buildJobFeedbackEvent()` in `packages/core/src/events/dvm.ts`. All builders validate required params, kind ranges, and hex format for event IDs and pubkeys. Builders throw `CrosstownError` with descriptive codes (`DVM_INVALID_KIND`, `DVM_INVALID_BID`, etc.). Events are signed with `finalizeEvent()` from `nostr-tools/pure`.
- **Task 3 (Parsers):** Implemented `parseJobRequest()`, `parseJobResult()`, `parseJobFeedback()` in `packages/core/src/events/dvm.ts`. All parsers follow the lenient parse pattern (return `null` for malformed events). Handles `noUncheckedIndexedAccess` by checking tag elements for `undefined`. Uses bracket notation for all index signature access.
- **Task 4 (TOON roundtrip):** ATDD test stubs (created during epic-5 baseline) validated that DVM events survive TOON encode/decode roundtrip with all tags preserved. No TOON codec changes were needed -- existing codec handles DVM kinds correctly. Tag order preservation confirmed. Shallow parser extracts DVM kinds (5100, 6100, 7000) without full decode.
- **Task 5 (NIP-90 compatibility):** Validated `i` tag format `['i', data, type, relay?, marker?]` with empty relay placeholder when marker is set without relay. Validated `bid` and `amount` tags include `'usdc'` third element (Crosstown NIP-90 extension). Validated targeted request detection via `p` tag presence/absence.
- **Task 6 (Unit tests):** 86 tests in existing ATDD stub file now pass green. All tests cover: builder validation, parser validation, TOON roundtrip (T-5.1-01 through T-5.1-04), kind constants, NIP-90 tag format, targeted vs open marketplace, USDC micro-units format, edge cases (empty content, >20 tags, >10KB payload), export verification from `@crosstown/core`.
- **Lint fix:** Fixed 3 ESLint errors (`Array<T>` -> `T[]` per `@typescript-eslint/array-type` rule) in `dvm.ts`.
- **Build/Test results:** Full monorepo build succeeds. 1929 tests pass, 79 skipped, 0 failures. Lint: 0 errors, 526 warnings (all pre-existing).

### Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-03-16 | Claude Opus 4.6 (adversarial review) | Added FR coverage declaration (FR-DVM-1). Added explicit dependency declaration with commit reference. Added decision sources section. Expanded ACs to Given/When/Then testability format with explicit tag formats including `'usdc'` currency element. Added validation note to AC #5 (shallow parser is existing behavior). Added explicit export list to Task 1.5. Added CrosstownError reference in Task 2.4. Added kind range validation to builder tasks. Added test ID to task mapping in test table. Added conditional escalation to E5-R001 risk. Added NIP-90 currency extension note to E5-R002. Added `noUncheckedIndexedAccess` reminder to parser implementation notes. Added downstream dependencies section. Added pipeline invariant note. Added ATDD stub status note. Added `amount` tag currency element to Task 5.4. Added 3 additional test subtasks (6.6, 6.7, 6.8) for edge cases and error paths. |
| 2026-03-16 | Claude Opus 4.6 (implementation) | Implemented all 6 tasks: DVM kind constants, type definitions, builder functions (buildJobRequestEvent, buildJobResultEvent, buildJobFeedbackEvent), parser functions (parseJobRequest, parseJobResult, parseJobFeedback), TOON roundtrip validation, NIP-90 compatibility validation. 86 tests passing. 0 lint errors. Full monorepo build and test pass. |
| 2026-03-16 | Claude Opus 4.6 (code review) | Code review: 0 critical, 0 high, 2 medium, 4 low issues found. Fixed M1: added missing `dvm.test.ts` to File List. Fixed M2: clarified misleading input data validation condition in `buildJobRequestEvent` (replaced double-negative truthiness pattern with explicit `=== undefined \|\| === null` check). Fixed L3: updated Task 1.2 to reflect actual interface names (JobRequestParams/ParsedJobRequest etc. instead of DvmJobRequest etc.). L1/L4 (non-deterministic test keys) acknowledged as style concern. L2 (project-context.md event kinds table) deferred to epic-level review. |
| 2026-03-16 | Claude Opus 4.6 (code review #2) | Code review #2: 0 critical, 0 high, 1 medium, 3 low issues found. Fixed M1: `buildJobRequestEvent` now validates `targetProvider` hex format with `HEX_64_REGEX` (matching `customerPubkey` validation in result/feedback builders). Added test. L1 (non-deterministic test keys), L2 (project-context.md update), L3 (currency metadata not exposed by parsers) acknowledged. 143 tests passing. |
| 2026-03-16 | Claude Opus 4.6 (code review #3) | Code review #3 (adversarial + OWASP security): 0 critical, 0 high, 2 medium, 3 low issues found. Fixed M1: `parseJobResult` and `parseJobFeedback` now validate `requestEventId` and `customerPubkey` via `HEX_64_REGEX` (builder/parser validation symmetry). Fixed M2: `parseJobRequest` now validates `targetProvider` hex format. Fixed L1: replaced all `generateSecretKey()` with deterministic `FIXED_BUILDER_SECRET_KEY` per project testing rules. Added 6 new tests for hex validation. L2 (project-context.md update) and L3 (try/catch test style) acknowledged. 149 tests passing. OWASP security scan: no injection, auth, or access control vulnerabilities found. |

### File List

| File | Action |
|------|--------|
| `packages/core/src/constants.ts` | Modified -- added 7 DVM kind constants |
| `packages/core/src/events/dvm.ts` | Created -- DVM types, builders, parsers |
| `packages/core/src/events/dvm.test.ts` | Created -- DVM unit tests (149 tests) |
| `packages/core/src/events/index.ts` | Modified -- added DVM re-exports |
| `packages/core/src/index.ts` | Modified -- added DVM exports to core public API |

## Code Review Record

### Review Pass #1

- **Date:** 2026-03-16
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Outcome:** Pass with fixes applied

**Issues by Severity:**

| Severity | Count | Details |
|----------|-------|---------|
| Critical | 0 | -- |
| High | 0 | -- |
| Medium | 2 (both fixed) | M1: Missing `dvm.test.ts` in File List section -- added. M2: Misleading input data validation logic in `buildJobRequestEvent` used double-negative truthiness pattern -- replaced with explicit `=== undefined \|\| === null` check. |
| Low | 4 (2 fixed, 2 acknowledged) | L1: Non-deterministic test keys (acknowledged, style concern). L2: `project-context.md` event kinds table not updated with DVM kinds (deferred to epic-level review). L3: Interface names in Task 1.2 text did not match actual implementation names -- corrected from `DvmJobRequest` etc. to `JobRequestParams`/`ParsedJobRequest` etc. L4: Non-deterministic test keys duplicate of L1 (acknowledged). |

**Review Follow-ups (AI):**

- [ ] L2: Update `_bmad-output/project-context.md` event kinds table to include DVM event kinds (5xxx, 6xxx, 7000) -- deferred to epic-level review

### Review Pass #2

- **Date:** 2026-03-16
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Outcome:** Pass with fixes applied

**Issues by Severity:**

| Severity | Count | Details |
|----------|-------|---------|
| Critical | 0 | -- |
| High | 0 | -- |
| Medium | 1 (fixed) | M1: `buildJobRequestEvent` did not validate `targetProvider` hex format -- inconsistent with `buildJobResultEvent` and `buildJobFeedbackEvent` which validate `customerPubkey` via `HEX_64_REGEX`. Added validation + test. |
| Low | 3 (all acknowledged) | L1: Non-deterministic test keys (carried from review #1, acknowledged style concern). L2: `project-context.md` event kinds table not updated (carried from review #1, deferred to epic-level). L3: `ParsedJobRequest.bid` and `ParsedJobResult.amount` do not expose currency metadata from the `'usdc'` third tag element (defensible: Crosstown is USDC-only by protocol design). |

### Review Pass #3

- **Date:** 2026-03-16
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Outcome:** Pass with fixes applied
- **Security Scan:** OWASP Top 10, authentication/authorization, injection risks -- all clear

**Issues by Severity:**

| Severity | Count | Details |
|----------|-------|---------|
| Critical | 0 | -- |
| High | 0 | -- |
| Medium | 2 (both fixed) | M1: `parseJobResult` and `parseJobFeedback` did not validate hex format of `requestEventId` and `customerPubkey` -- builders validate via `HEX_64_REGEX` but parsers only checked for empty string. Added `HEX_64_REGEX.test()` validation in both parsers + 4 new tests. M2: `parseJobRequest` did not validate `targetProvider` hex format when `p` tag present -- added `HEX_64_REGEX` validation + 2 new tests. |
| Low | 3 (1 fixed, 2 acknowledged) | L1: Non-deterministic test keys (`generateSecretKey()` in builder tests) -- **fixed**: replaced all 53 occurrences with deterministic `FIXED_BUILDER_SECRET_KEY`, removed unused `generateSecretKey` import. L2: `project-context.md` event kinds table not updated (carried from reviews #1/#2, deferred to epic-level). L3: CrosstownError code verification tests use verbose try/catch pattern instead of `expect().toThrowError()` (stylistic, tests function correctly, acknowledged). |

**Security Assessment (OWASP Top 10):**

| Category | Status | Notes |
|----------|--------|-------|
| A01: Broken Access Control | N/A | Pure data builders/parsers, no authorization logic |
| A02: Cryptographic Failures | PASS | Schnorr signatures via `finalizeEvent()`, no key material logging |
| A03: Injection | PASS | No eval/exec/SQL/command injection vectors, tag data stored as string arrays |
| A04: Insecure Design | PASS | Lenient parse pattern returns null for malformed input |
| A05: Security Misconfiguration | N/A | No configuration in this module |
| A06: Vulnerable Components | PASS | Uses `nostr-tools` for cryptography (well-maintained) |
| A07: Auth Failures | PASS | Hex pubkey/event ID validation in both builders and parsers (after M1/M2 fix) |
| A08: Data Integrity Failures | PASS | Events signed with Schnorr, TOON roundtrip preserves all data |
| A09: Logging Failures | N/A | No logging in builders/parsers |
| A10: SSRF | N/A | No network requests in this module |
