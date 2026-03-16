# Risk-Based Test Plan: Epic 5 - DVM Compute Marketplace

**Date:** 2026-03-16
**Author:** Jonathan (with Claude Opus 4.6)
**Status:** Implementation-Ready
**Epic Source:** `_bmad-output/planning-artifacts/epics.md` -- Epic 5
**Predecessors:**
- `_bmad-output/planning-artifacts/test-design-epic-1.md` (Epic 1 SDK test plan)
- `_bmad-output/planning-artifacts/test-design-epic-2.md` (Epic 2 Town test plan)
- `_bmad-output/planning-artifacts/test-design-epic-3.md` (Epic 3 Protocol Economics test plan)
- `_bmad-output/test-artifacts/test-design-architecture.md` (System-level architecture test design)
- `_bmad-output/test-artifacts/test-design-qa.md` (System-level QA test design)

**Note:** The `_bmad-output/test-artifacts/test-design-epic-5.md` file is a test design for The Rig (Epic 7, renumbered per Decision 8 in the 2020117 analysis). This document is the authoritative test design for the DVM Compute Marketplace (Epic 5, Stories 5.1-5.4).

---

## 1. Scope and Context

Epic 5 delivers 4 stories (5.1-5.4) implementing a NIP-90 compatible DVM (Data Vending Machine) compute marketplace on top of the Crosstown ILP payment infrastructure. This is the first epic where the protocol transitions from a relay (store events, route payments) to a compute marketplace (structured jobs, feedback loops, compute settlement, programmatic service discovery).

**Decision source:** [Party Mode 2020117 Analysis](research/party-mode-2020117-analysis-2026-03-10.md)

**Dependency chain:**
```
5.1 (DVM Event Kind Definitions) --> 5.2 (ILP-Native Job Submission) --> 5.3 (Job Result Delivery + Compute Settlement)
5.4 (Skill Descriptors in Service Discovery) -- depends on Epic 3 Story 3.5 (kind:10035)
5.1 --> 5.4 (kind definitions needed for skill descriptor schema)
```

**What exists today (post-Epic 4):**

- `@crosstown/sdk` is complete with `createNode()`, handler registry, full processing pipeline, `publishEvent()`
- `@crosstown/town` is published with `startTown()`, event storage, x402 `/publish`, service discovery (kind:10035), enriched `/health`, relay subscription API
- USDC denomination across all packages (AGENT eliminated in Story 3.1)
- ILP payment channels work end-to-end with EVM settlement
- x402 `/publish` endpoint provides HTTP on-ramp for non-initiated agents
- kind:10035 service discovery events advertise pricing, x402, capabilities
- kind:10036 seed relay discovery for decentralized bootstrap
- TEE attestation (kind:10033) for verifiable code integrity
- TOON codec in `@crosstown/core` with shallow parse, encode, decode
- Relay subscription API on TownInstance for subscribing to remote relays
- `node.publishEvent()` for publishing TOON-encoded events via ILP PREPARE

**What Epic 5 changes:**

- Kind 5xxx (Job Request), Kind 6xxx (Job Result), Kind 7000 (Job Feedback) event definitions with TOON encoding
- ILP-native DVM job submission for initiated agents; x402 fallback for non-initiated agents
- Full DVM job lifecycle: request -> feedback -> result -> compute settlement
- SDK helper functions: `publishJobRequest()`, `publishFeedback()`, `publishResult()`, `settleCompute()`
- Skill descriptor schema in kind:10035 events (JSON Schema for input parameters, per-kind pricing, supported models)
- Two-tier access model: ILP-native (preferred) and x402 (fallback)

**What this test plan does NOT cover:**

- Epic 1-4 internals (covered by prior test plans)
- Epic 6 features: workflow chains, agent swarms, TEE-attested results, reputation scoring
- Multi-relay redundancy or performance testing
- Real Arbitrum One deployment with production USDC
- The Rig (Epic 7) -- separate test design exists

---

## 2. Risk Assessment by Story

### Risk Scoring

- **Probability**: 1 (unlikely), 2 (possible), 3 (likely)
- **Impact**: 1 (minor), 2 (moderate), 3 (severe -- data loss, security breach, financial loss, or cascade failure)
- **Score**: Probability x Impact (1-9)
- **Threshold**: Score >= 6 = high priority, 3-5 = medium, 1-2 = low

### Story-Level Risk Matrix

| Story | Risk ID | Category | Description | P | I | Score | Mitigation |
|-------|---------|----------|-------------|---|---|-------|------------|
| **5.1 DVM Event Kinds** | E5-R001 | DATA | TOON encoding of DVM event tags (complex nested `i`, `param`, `bid` tags) corrupts tag structure during encode/decode roundtrip -- relay stores malformed events that providers cannot parse | 2 | 3 | **6** | Roundtrip encode/decode tests for all DVM event kinds with complex tag structures; verify tag preservation including order and nested values |
| **5.1 DVM Event Kinds** | E5-R002 | TECH | NIP-90 compatibility drift -- Crosstown DVM events use non-standard tag formats that prevent interoperability with other NIP-90 implementations (2020117, DVMDash) | 2 | 2 | 4 | Validate DVM event structures against NIP-90 spec; verify required tags (`i`, `bid`, `output`, `e`, `p`, `amount`, `status`) match NIP-90 format |
| **5.2 ILP Job Submission** | E5-R003 | TECH | SDK handler routing for DVM kinds -- handler registry routes Kind 5xxx to wrong handler or fails to dispatch because DVM kinds are in a range (5000-5999) rather than specific values | 1 | 3 | 3 | Unit test: `.on(5100, handler)` routes Kind 5100 only; Kind 5200 goes to different handler or default |
| **5.2 ILP Job Submission** | E5-R004 | BUS | Two-tier access divergence -- x402-submitted DVM jobs are stored differently than ILP-submitted jobs (different relay-side behavior), breaking the invariant that both rails are identical at the relay level | 2 | 3 | **6** | Packet equivalence test: ILP-submitted Kind 5100 event and x402-submitted Kind 5100 event produce identical relay-side storage; reuse `buildIlpPrepare()` shared function |
| **5.3 Compute Settlement** | E5-R005 | SEC | Compute settlement amount manipulation -- provider inflates `amount` tag in Kind 6xxx result; customer's SDK auto-pays the inflated amount without validation against the original `bid` | 2 | 3 | **6** | SDK `settleCompute()` MUST validate that Kind 6xxx `amount` <= original Kind 5xxx `bid`; unit test: inflated amount rejected |
| **5.3 Compute Settlement** | E5-R006 | DATA | ILP address resolution failure -- customer cannot resolve provider's ILP address from kind:10035 event, leaving compute payment unroutable | 2 | 2 | 4 | Integration test: customer reads provider's kind:10035 -> extracts ILP address -> routes ILP payment; error handling test: missing kind:10035 -> clear error |
| **5.3 Compute Settlement** | E5-R007 | TECH | Compute settlement routing -- ILP payment to provider fails or routes incorrectly through multi-hop mesh because compute settlement uses the same ILP path as relay write fees but with a different destination | 2 | 3 | **6** | Integration test: compute payment routes from customer -> ILP mesh -> provider; verify provider receives the correct amount via their connector |
| **5.3 Compute Settlement** | E5-R008 | BUS | Feedback event lifecycle gaps -- Kind 7000 feedback events with `status: 'processing'` never followed by result or error, leaving customer in limbo with no timeout mechanism | 2 | 2 | 4 | Test: provider sends `processing` feedback then `error` feedback; verify customer receives both via subscription. Document timeout as an application-level concern (not protocol-enforced) |
| **5.4 Skill Descriptors** | E5-R009 | DATA | Skill descriptor schema drift -- JSON Schema for `inputSchema` is malformed or incompatible with JSON Schema draft-07, preventing agents from constructing valid job requests programmatically | 2 | 2 | 4 | Validate `inputSchema` against JSON Schema meta-schema (draft-07 self-validation); roundtrip test: schema -> construct request -> validate against schema |
| **5.4 Skill Descriptors** | E5-R010 | TECH | Auto-population from handler registry -- skill descriptor `kinds` array does not accurately reflect registered DVM handlers (off-by-one, stale registration, or handler replacement not reflected) | 2 | 2 | 4 | Unit test: register handlers for Kind 5100 and 5200 -> skill descriptor `kinds` contains exactly `[5100, 5200]`; replace handler -> descriptor updated |
| **5.4 Skill Descriptors** | E5-R011 | BUS | Skill descriptor supersedes 2020117 format -- Crosstown-specific fields (`ilpAddress`, `x402Endpoint`, `supportedChains`) cause interop issues with standard NIP-90 discovery tools | 1 | 2 | 2 | Document that Crosstown skill descriptors are a superset of 2020117; verify standard fields are parseable by generic NIP-90 clients |

### Inherited System-Level Risks

These risks from prior test designs remain relevant to Epic 5:

| Risk ID (System) | Score | Epic 5 Relevance |
|-------------------|-------|-------------------|
| R-001 (TOON pipeline ordering) | 9 | DVM event kinds (5xxx/6xxx/7000) flow through the same TOON processing pipeline. The invariant (shallow parse -> verify -> price -> dispatch) must hold for all DVM kinds. |
| R-005 (Payment channel state integrity) | 6 | Compute settlement uses the same EVM payment channels as relay write fees. Channel state integrity is critical when both relay and compute payments flow through the same channel. |
| E3-R007 (Packet equivalence) | 6 | DVM jobs submitted via x402 must produce identical ILP PREPARE packets as ILP-native submissions. The `buildIlpPrepare()` shared function invariant from Epic 3 applies here. |

### High-Priority Risks (Score >= 6) -- Ordered by Score

| Rank | Risk ID | Score | Story | Summary |
|------|---------|-------|-------|---------|
| 1 | E5-R001 | **6** | 5.1 | TOON encoding corruption of DVM event tags |
| 2 | E5-R004 | **6** | 5.2 | Two-tier access divergence for DVM jobs |
| 3 | E5-R005 | **6** | 5.3 | Compute settlement amount manipulation |
| 4 | E5-R007 | **6** | 5.3 | Compute settlement ILP routing failure |

**Note:** The high-priority risks are split between data integrity (E5-R001), protocol invariants (E5-R004), and financial safety (E5-R005, E5-R007). Story 5.3 alone carries 2 of the 4 high-priority risks, confirming it as the highest-risk story in the epic. This mirrors the pattern from Epic 3 where the financial settlement story (3.3) was the riskiest.

---

## 3. Critical Integration Boundaries Between Stories

### 3.1 The DVM Event Lifecycle Chain (E5-R001 -> E5-R004 -> E5-R005/R007, Score 6+)

The most critical integration boundary in Epic 5 is the DVM job lifecycle:

```
Story 5.1 (DVM Event Kinds):
  Kind 5xxx, 6xxx, 7000 defined with TOON encoding support
    -> Tags preserved through TOON encode/decode roundtrip
    -> Shallow parser extracts kind for routing decisions

Story 5.2 (ILP-Native Job Submission):
  Customer -> ILP PREPARE (TOON-encoded Kind 5xxx) -> Relay stores
    -> Provider subscribes, receives Kind 5xxx (free to read)
    -> x402 fallback produces identical relay-side storage

Story 5.3 (Compute Settlement):
  Provider -> Kind 7000 feedback -> Relay
  Provider -> Kind 6xxx result -> Relay
  Customer reads result -> extracts provider ILP address -> sends ILP payment
    -> Payment routes through ILP mesh -> settles via EVM channels
```

**Why this chain is non-negotiable:**

- **5.1 underpins 5.2 and 5.3**: If TOON encoding corrupts DVM tags, providers cannot parse job requests, and customers cannot verify result amounts
- **5.2 underpins 5.3**: Compute settlement requires a valid job request (Kind 5xxx) and result (Kind 6xxx) pair -- the `e` tag in the result must reference a real, stored request
- **5.3 is the money path**: Incorrect compute settlement means providers are unpaid or customers are overcharged

**Integration boundary tests:**

1. **5.1 -> 5.2**: Kind 5100 event with complex `i`, `param`, `bid` tags survives TOON roundtrip and arrives at provider's handler with all tags intact
2. **5.2 -> 5.3**: Provider's Kind 6xxx result references customer's Kind 5xxx via `e` tag; customer can resolve the reference
3. **5.1 -> 5.3**: Kind 6xxx `amount` tag value is preserved through TOON encode/decode and matches the semantic meaning (USDC micro-units)
4. **x402 -> 5.2**: DVM job submitted via x402 is indistinguishable from ILP-submitted job at the relay level

### 3.2 The Compute Settlement Path (E5-R005, E5-R007, Score 6)

Compute settlement introduces a second financial flow alongside relay write fees:

```
Relay Write Fee (existing):
  Customer -> ILP PREPARE (amount = basePricePerByte * toonLength) -> Relay stores event

Compute Settlement (new):
  Customer reads Kind 6xxx result (free)
    -> Extracts provider ILP address from kind:10035
    -> Sends ILP payment (amount = Kind 6xxx `amount` tag)
      -> Routes: Customer Connector -> [intermediate hops] -> Provider Connector
      -> Settles through EVM payment channels
```

**The invariant:** Compute settlement uses the SAME ILP routing and EVM channel infrastructure as relay write fees. The only difference is:
1. **Destination**: Provider's ILP address (from kind:10035), not the relay's address
2. **Amount**: Compute cost from Kind 6xxx `amount` tag, not `basePricePerByte * toonLength`
3. **Validation**: Customer SDK must verify `amount <= bid` before paying

**Boundary tests:**
1. Compute payment routed to provider's ILP address succeeds (provider receives funds)
2. Compute payment amount validated against original bid (inflated amount rejected)
3. Compute payment uses same EVM channel infrastructure (no separate channel needed if customer and provider already have channels through the mesh)

### 3.3 The Skill Descriptor Discovery Chain (Story 5.4)

Skill descriptors build on the existing kind:10035 service discovery infrastructure:

```
Story 3.5 (existing -- kind:10035):
  Node publishes kind:10035 with: serviceType, pricing, x402, capabilities, chain

Story 5.4 (new -- skill field):
  kind:10035 gains `skill` field: name, version, kinds, features, inputSchema, pricing, models
    -> DVM handler registrations auto-populate `kinds` array
    -> inputSchema enables programmatic job request construction
```

**Integration boundary test:** Register DVM handlers for Kind 5100 and Kind 5200 -> start node -> kind:10035 published with skill descriptor -> agent queries relay -> parses skill -> constructs valid Kind 5100 job request using inputSchema.

### 3.4 Pipeline Ordering Invariant for DVM Events (Inherited R-001, Score 9)

DVM events (Kind 5xxx, 6xxx, 7000) enter the SDK processing pipeline identically to all other events:

```
DVM event origin:
  ILP PREPARE (TOON-encoded Kind 5xxx)
    -> PaymentHandlerBridge
      -> Shallow TOON Parse (extracts kind=5100, pubkey, id, sig)
        -> Schnorr Verification
          -> Pricing Validation (relay write fee, NOT compute fee)
            -> HandlerRegistry.dispatch(kind=5100)
              -> Provider's DVM handler
```

**Risk:** If DVM events are treated specially in the pipeline (e.g., pricing is skipped because "this is a DVM job and the customer will pay separately for compute"), the pipeline ordering invariant is violated.

**Mitigation:** DVM events pay relay write fees like all other events. Compute settlement is a separate, subsequent payment. The SDK pipeline does not need to know about DVM semantics -- it sees a Kind 5100 event and processes it through the standard pipeline.

---

## 4. Test Strategy Per Story

### Legend

- **U** = Unit test (isolated, mocked dependencies)
- **I** = Integration test (multiple real modules wired together)
- **E2E** = End-to-end test (requires genesis infrastructure or multi-node setup)
- **Real crypto** = Uses real nostr-tools/noble-curves signing, no mocked crypto

### Story 5.1: DVM Event Kind Definitions

**Risk profile:** 1 high (E5-R001), 1 medium (E5-R002). Foundation story -- all subsequent stories depend on correct DVM event definitions and TOON support.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-5.1-01 | Kind 5100 (Text Generation) job request: TOON encode -> decode roundtrip preserves all required tags (`i`, `bid`, `output`) and optional tags (`p`, `param`, `relays`) | U | E5-R001 | P0 |
| T-5.1-02 | Kind 6xxx job result: TOON encode -> decode roundtrip preserves required tags (`e`, `p`, `amount`) and content field | U | E5-R001 | P0 |
| T-5.1-03 | Kind 7000 feedback: TOON encode -> decode roundtrip preserves required tags (`e`, `p`, `status`) and optional content | U | E5-R001 | P0 |
| T-5.1-04 | TOON shallow parser extracts kind for DVM event kinds (5100, 6100, 7000) without full decode | U | E5-R001 | P0 |
| T-5.1-05 | Kind 5xxx required tag validation: missing `i` tag -> construction error; missing `bid` tag -> construction error | U | -- | P1 |
| T-5.1-06 | Kind 6xxx required tag validation: missing `e` tag -> construction error; missing `amount` tag -> construction error | U | -- | P1 |
| T-5.1-07 | Kind 7000 `status` tag values: `processing`, `error`, `success`, `partial` all accepted; invalid status rejected | U | -- | P1 |
| T-5.1-08 | Kind 5100 (Text Generation) defined as reference DVM kind; Kind 5200, 5300, 5302 defined but optional | U | E5-R002 | P2 |
| T-5.1-09 | NIP-90 compatibility: DVM event tag structure matches NIP-90 specification (`i` tag format: `['i', data, type, relay?, marker?]`) | U | E5-R002 | P1 |
| T-5.1-10 | Targeted request: Kind 5xxx with `p` tag indicates specific provider target; without `p` tag = open marketplace | U | -- | P2 |
| T-5.1-11 | `bid` tag value is in USDC micro-units (6 decimals); verify format as string representation of bigint | U | -- | P1 |

**Notes:**

- T-5.1-01 through T-5.1-03 are the TOON encoding gating tests. If DVM tags are corrupted through the TOON roundtrip, all downstream stories are blocked.
- T-5.1-04 verifies that the existing shallow parser works for DVM kinds without modification (DVM kinds are just numbers in the 5000-7000 range).
- T-5.1-09 validates NIP-90 interoperability -- Crosstown's DVM events must be parseable by any NIP-90 compliant client.
- T-5.1-11 ensures denomination consistency with Epic 3's USDC migration.

### Story 5.2: ILP-Native Job Submission

**Risk profile:** 1 high (E5-R004), 1 medium (E5-R003). Integrates DVM events with the existing write path.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-5.2-01 | Initiated agent publishes Kind 5100 via ILP PREPARE -> relay stores event -> event queryable by subscribers | I | E5-R004 | P0 |
| T-5.2-02 | Non-initiated agent publishes Kind 5100 via x402 `/publish` -> identical relay-side storage as ILP-native path | I | E5-R004 | P0 |
| T-5.2-03 | Packet equivalence: ILP-submitted and x402-submitted Kind 5100 events produce identical relay-side event storage (same tags, content, metadata) | I | E5-R004 | P0 |
| T-5.2-04 | SDK handler registration: `node.on(5100, handler)` routes Kind 5100 job requests to handler | U | E5-R003 | P1 |
| T-5.2-05 | SDK handler context: `ctx.decode()` returns structured job request with input, bid, and parameters from tags | U | -- | P1 |
| T-5.2-06 | SDK handler context: `ctx.toon` provides raw TOON for direct LLM consumption (no decode overhead) | U | -- | P1 |
| T-5.2-07 | Provider subscription: provider subscribes to relay for Kind 5xxx events matching supported kinds (from skill descriptor) | I | -- | P1 |
| T-5.2-08 | Relay write fee: DVM job request pays standard `basePricePerByte * toonData.length` (same as any event) | U | -- | P1 |
| T-5.2-09 | Multiple DVM handlers: `node.on(5100, textHandler)` and `node.on(5200, imageHandler)` route to correct handler per kind | U | E5-R003 | P2 |
| T-5.2-10 | Targeted request filtering: provider handler receives Kind 5xxx with `p` tag matching provider's pubkey; provider can detect untargeted requests (no `p` tag) | U | -- | P2 |

**Notes:**

- T-5.2-01 and T-5.2-02 validate the two-tier access model. Together with T-5.2-03, they prove the invariant that both write paths produce identical relay outcomes.
- T-5.2-04 through T-5.2-06 validate the SDK developer experience -- handlers for DVM kinds work identically to handlers for any other Nostr event kind.
- T-5.2-07 uses the Town relay subscription API (Story 2.8) for provider-side event discovery.
- T-5.2-08 confirms that DVM events pay relay write fees like all other events (pipeline ordering invariant).

### Story 5.3: Job Result Delivery + Compute Settlement

**Risk profile:** 2 high (E5-R005, E5-R007), 2 medium (E5-R006, E5-R008). Highest complexity, highest risk. This story introduces compute payment semantics -- a second financial flow on top of relay write fees.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-5.3-01 | Provider publishes Kind 7000 feedback (`status: 'processing'`) via ILP PREPARE -> relay stores -> customer receives via subscription | I | E5-R008 | P1 |
| T-5.3-02 | Provider publishes Kind 6xxx result with `e` (request ID), `p` (customer pubkey), `amount` (compute cost) via ILP PREPARE -> relay stores -> customer receives | I | E5-R007 | P0 |
| T-5.3-03 | Compute settlement: customer reads Kind 6xxx -> extracts provider ILP address from kind:10035 -> `settleCompute()` sends ILP payment to provider | I | E5-R007 | P0 |
| T-5.3-04 | Compute settlement amount validation: `settleCompute()` rejects when Kind 6xxx `amount` > original Kind 5xxx `bid` | U | E5-R005 | P0 |
| T-5.3-05 | Compute settlement amount validation: `settleCompute()` accepts when Kind 6xxx `amount` <= original Kind 5xxx `bid` | U | E5-R005 | P0 |
| T-5.3-06 | Provider ILP address resolution: customer reads provider's kind:10035 event -> extracts `ilpAddress` field -> uses for compute payment routing | I | E5-R006 | P1 |
| T-5.3-07 | Provider ILP address not found: provider has no kind:10035 event -> `settleCompute()` returns clear error | U | E5-R006 | P1 |
| T-5.3-08 | Error handling: provider publishes Kind 7000 with `status: 'error'` and error details -> no compute payment expected | I | E5-R008 | P1 |
| T-5.3-09 | Full lifecycle: customer posts Kind 5100 -> provider sends Kind 7000 (`processing`) -> provider sends Kind 6100 result -> customer calls `settleCompute()` -> provider receives ILP payment | I | E5-R005, E5-R007 | P0 |
| T-5.3-10 | SDK helper: `publishJobRequest(input, params, bid)` constructs valid Kind 5xxx event with correct tags and publishes via ILP PREPARE | U | -- | P1 |
| T-5.3-11 | SDK helper: `publishFeedback(requestId, status)` constructs valid Kind 7000 event with `e` and `status` tags | U | -- | P1 |
| T-5.3-12 | SDK helper: `publishResult(requestId, result, amount)` constructs valid Kind 6xxx event with `e`, `p`, `amount` tags | U | -- | P1 |
| T-5.3-13 | SDK helper: `settleCompute(resultEvent)` extracts provider ILP address and sends payment for the specified amount | U | -- | P1 |
| T-5.3-14 | Compute payment uses existing EVM payment channels (same infrastructure as relay write fees; no separate channel creation needed) | I | E5-R007 | P2 |
| T-5.3-15 | Multi-hop routing: compute payment routes through ILP mesh (customer -> relay node -> provider node) when customer and provider are not directly peered | I | E5-R007 | P2 |
| T-5.3-16 | Full lifecycle E2E: customer + provider on genesis infrastructure -> complete job cycle with ILP compute settlement | E2E | E5-R005, E5-R007 | P3 |

**Notes:**

- T-5.3-04 and T-5.3-05 are the critical security tests. Without bid validation, a malicious provider can drain customer funds. This is the most important security boundary in Epic 5.
- T-5.3-09 is the canonical DVM lifecycle test. It exercises the complete flow from job request to compute payment.
- T-5.3-10 through T-5.3-13 test the SDK helper functions in isolation. Each helper encapsulates TOON encoding, tag construction, and ILP routing.
- T-5.3-15 requires multi-hop infrastructure (customer and provider on different nodes). May use SDK E2E infra (`scripts/sdk-e2e-infra.sh`).
- T-5.3-16 requires full genesis infrastructure. Deferred to nightly.

### Story 5.4: Skill Descriptors in Service Discovery

**Risk profile:** 3 medium (E5-R009, E5-R010, E5-R011). Extends existing kind:10035 events. Lower risk than Stories 5.1-5.3 because no financial path.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-5.4-01 | Skill descriptor structure: kind:10035 event with `skill` field containing `name`, `version`, `kinds`, `features`, `inputSchema`, `pricing`, `models` | U | E5-R009 | P1 |
| T-5.4-02 | `inputSchema` follows JSON Schema draft-07: validate against JSON Schema meta-schema | U | E5-R009 | P1 |
| T-5.4-03 | Agent constructs valid Kind 5100 job request using `inputSchema` from skill descriptor | I | E5-R009 | P1 |
| T-5.4-04 | Auto-population: register `node.on(5100, handler)` and `node.on(5200, handler)` -> skill descriptor `kinds` = `[5100, 5200]` | U | E5-R010 | P1 |
| T-5.4-05 | Auto-population: pricing derived from `basePricePerByte` default or per-kind overrides | U | E5-R010 | P2 |
| T-5.4-06 | Node publishes kind:10035 with skill descriptor on bootstrap completion | I | E5-R010 | P1 |
| T-5.4-07 | Skill descriptor update: add new DVM handler -> updated kind:10035 published (NIP-33 replaceable event) | I | E5-R010 | P2 |
| T-5.4-08 | Agent discovery: query relay for kind:10035 events -> filter by `skill.kinds` containing 5100 -> compare pricing across providers | I | -- | P1 |
| T-5.4-09 | Crosstown-specific fields: `ilpAddress`, `x402Endpoint`, `supportedChains` present in skill descriptor alongside standard fields | U | E5-R011 | P2 |
| T-5.4-10 | `parseServiceDiscovery()` roundtrip with skill descriptor: build -> parse -> all skill fields recovered including nested inputSchema | U | -- | P1 |
| T-5.4-11 | Skill descriptor with `attestation` field placeholder for Epic 6 TEE integration (field present but optional) | U | -- | P3 |

**Notes:**

- T-5.4-02 validates JSON Schema compliance. If `inputSchema` is not valid JSON Schema, agents cannot programmatically construct job requests.
- T-5.4-03 is the agent-side validation: given a skill descriptor, can an agent actually construct a valid job request? This is the critical user-facing test.
- T-5.4-04 tests the developer experience: registering DVM handlers should automatically populate the skill descriptor without manual configuration.
- T-5.4-06 validates that skill descriptors are published alongside existing service discovery data (pricing, x402, capabilities from Epic 3).

---

## 5. Test Count Summary

| Story | P0 | P1 | P2 | P3 | Total |
|-------|----|----|----|----|-------|
| 5.1 DVM Event Kinds | 4 | 4 | 2 | 0 | **11** |
| 5.2 ILP Job Submission | 3 | 4 | 2 | 0 | **10** (1 overlap with 5.1 via pipeline) |
| 5.3 Compute Settlement | 4 | 6 | 2 | 1 | **16** (includes 3 integration lifecycle tests) |
| 5.4 Skill Descriptors | 0 | 6 | 3 | 1 | **11** (including 1 Epic 6 placeholder) |
| **Total** | **11** | **20** | **9** | **2** | **48** (including cross-story) |

### Cross-Story Integration Tests (in addition to per-story tests)

| ID | Boundary | Test | Level | Priority |
|----|----------|------|-------|----------|
| T-INT-01 | 5.1 -> 5.2 | Kind 5100 with complex DVM tags survives TOON roundtrip AND arrives at provider handler with all tags intact | I | P0 |
| T-INT-02 | 5.2 -> 5.3 | Provider's Kind 6xxx result references customer's Kind 5xxx via `e` tag; customer resolves reference from relay | I | P0 |
| T-INT-03 | 5.1 -> 5.3 | Kind 6xxx `amount` tag preserved through TOON encode/decode and parseable as USDC micro-units | I | P0 |
| T-INT-04 | x402 -> 5.2 | x402-submitted Kind 5100 event is indistinguishable from ILP-submitted event at relay level | I | P0 |
| T-INT-05 | 5.4 -> 5.2 | Agent reads skill descriptor -> constructs Kind 5xxx request using inputSchema -> submits -> provider handler receives valid event | I | P1 |
| T-INT-06 | DVM -> SDK pipeline | DVM events (Kind 5xxx/6xxx/7000) traverse full SDK pipeline (parse -> verify -> price -> dispatch) with no stage skipped | I | P0 |

**Grand total with integration tests: 54 tests**

---

## 6. Execution Strategy

| Trigger | What Runs | Time Budget | Infrastructure |
|---------|-----------|-------------|----------------|
| **Every PR** | All unit + integration tests (P0-P2) | < 10 min | Anvil container (for compute settlement channel tests) |
| **Nightly** | Full suite including E2E (P0-P3) | < 15 min | Genesis node + optional SDK E2E infra (2-peer mesh) |

**Philosophy:** Run everything in PRs unless it requires multi-node infrastructure. Most DVM tests are unit tests (event construction, tag validation, helper functions) or integration tests using mocked connectors. Only 2 tests (T-5.3-15 multi-hop routing, T-5.3-16 full lifecycle E2E) require infrastructure beyond a single Anvil container.

**PR test infrastructure:**

- Anvil container at `http://localhost:8545` (chain ID 31337, pre-funded accounts)
- FiatTokenV2_2 deployed at deterministic address (from Epic 3)
- Mocked connectors for most handler and settlement tests
- No genesis node, no multi-node setup required

**Nightly E2E infrastructure:**

- Genesis node via `deploy-genesis-node.sh`
- SDK E2E infra via `scripts/sdk-e2e-infra.sh` (2 Docker peers for multi-hop tests)
- Ports: Anvil 18545, Peer1 (BTP 19000, BLS 19100, Relay 19700), Peer2 (BTP 19010, BLS 19110, Relay 19710)

---

## 7. Mitigation Plans for High-Priority Risks

### E5-R001: TOON Encoding Corruption of DVM Event Tags (Score: 6)

**Mitigation Strategy:**

1. TOON roundtrip tests for each DVM event kind (Kind 5xxx, 6xxx, 7000) with complex tag structures
2. Focus on multi-value tags: `i` tag with type+relay+marker, `param` tag with key-value, `bid` tag with USDC amount
3. Verify tag ORDER preservation (some NIP-90 consumers rely on tag ordering)
4. Test edge cases: empty content field, many tags, large content payload

**Owner:** Dev
**Timeline:** Story 5.1
**Verification:** T-5.1-01, T-5.1-02, T-5.1-03, T-INT-01
**Conditional escalation:** If TOON encoder does not preserve tag ordering, escalate to Score 9 and investigate TOON format extension for ordered tag support.

### E5-R004: Two-Tier Access Divergence (Score: 6)

**Mitigation Strategy:**

1. Architectural constraint: both ILP-native and x402 paths use the same TOON encoding and `buildIlpPrepare()` function (inherited from Epic 3)
2. Integration test: submit identical Kind 5100 events via both paths and compare relay-side storage
3. Verify that the relay cannot distinguish between ILP-native and x402-originated DVM events

**Owner:** Dev
**Timeline:** Story 5.2
**Verification:** T-5.2-01, T-5.2-02, T-5.2-03, T-INT-04
**Dependency:** Relies on Epic 3's `buildIlpPrepare()` invariant (E3-R007). If that invariant is violated, this risk escalates automatically.

### E5-R005: Compute Settlement Amount Manipulation (Score: 6)

**Mitigation Strategy:**

1. SDK `settleCompute()` function MUST validate that the Kind 6xxx `amount` tag value does NOT exceed the original Kind 5xxx `bid` tag value
2. Unit test: provider inflates `amount` to 10x the `bid` -> `settleCompute()` rejects with clear error
3. Unit test: provider sets `amount` equal to `bid` -> `settleCompute()` proceeds
4. Unit test: provider sets `amount` less than `bid` -> `settleCompute()` proceeds (legitimate discount)

**Owner:** Dev
**Timeline:** Story 5.3
**Verification:** T-5.3-04, T-5.3-05, T-5.3-09
**Code-level verification:** Assert that `settleCompute()` reads the original Kind 5xxx `bid` tag from the relay before paying. If the original event cannot be resolved, the settlement must fail.

### E5-R007: Compute Settlement ILP Routing (Score: 6)

**Mitigation Strategy:**

1. Compute settlement uses the SAME `node.connector.sendPacket()` API as relay write fees -- no special routing logic
2. Provider ILP address extracted from kind:10035 `ilpAddress` field (same address used for relay peering)
3. Integration test: customer sends compute payment to provider's ILP address -> provider's connector receives the payment
4. Multi-hop test (nightly): customer -> relay node -> provider node (different from direct peering)

**Owner:** Dev
**Timeline:** Story 5.3
**Verification:** T-5.3-03, T-5.3-09, T-5.3-14, T-5.3-15
**Dependency:** Relies on ILP routing infrastructure from Epics 1-2 and payment channel infrastructure from Epic 3.

---

## 8. Entry and Exit Criteria

### Entry Criteria

QA testing for Epic 5 cannot begin until ALL of the following are met:

- [ ] Epics 1-4 complete (SDK, Town, Protocol Economics, TEE Deployment all functional)
- [ ] `@crosstown/sdk` and `@crosstown/town` packages importable
- [ ] `node.publishEvent()` functional for ILP PREPARE event publishing
- [ ] x402 `/publish` endpoint functional for fallback path testing
- [ ] kind:10035 service discovery events publishable and queryable
- [ ] Relay subscription API (`town.subscribe()`) functional for provider-side event subscription
- [ ] Anvil running with FiatTokenV2_2 (mock USDC) and TokenNetwork deployed
- [ ] EVM payment channels functional for compute settlement testing
- [ ] TOON codec in `@crosstown/core` handling all existing event kinds correctly

### Exit Criteria

Epic 5 testing is complete when ALL of the following are met:

- [ ] All P0 tests passing (11/11 + 6 cross-story = 17 required)
- [ ] All P1 tests >= 95% passing or failures triaged
- [ ] No open high-priority bugs (E5-R001, E5-R004, E5-R005, E5-R007)
- [ ] TOON roundtrip for all DVM event kinds verified (Kind 5xxx, 6xxx, 7000)
- [ ] Packet equivalence for DVM events: ILP and x402 paths produce identical relay storage
- [ ] Compute settlement amount validation: `settleCompute()` rejects `amount > bid`
- [ ] Compute settlement routing: ILP payment reaches provider via mesh
- [ ] Skill descriptor auto-population from handler registry verified
- [ ] Existing E2E tests pass (`genesis-bootstrap-with-channels.test.ts`) with DVM handlers registered -- no regression
- [ ] SDK pipeline ordering invariant holds for DVM event kinds (shallow parse -> verify -> price -> dispatch)

---

## 9. Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
|----------|-------|-----------|-------------|-------|
| P0 | 11 + 6 integration | 2.0-3.0 | ~34-51 | TOON roundtrip, settlement validation, lifecycle |
| P1 | 20 | 1.0-2.0 | ~20-40 | Handler routing, helper functions, subscription, discovery |
| P2 | 9 | 0.5-1.0 | ~5-9 | Edge cases, optional kinds, config |
| P3 | 2 | 1.0-2.0 | ~2-4 | Full E2E with genesis node |
| **Total** | **54** (with cross-story) | -- | **~61-104 hours** | **~2-3 weeks (1 engineer)** |

### Recommended Story Implementation Order

Based on dependency chain and risk concentration:

1. **Story 5.1** (DVM Event Kind Definitions) -- foundation for all DVM functionality; 11 tests
2. **Story 5.4** (Skill Descriptors) -- can run in parallel with 5.2 once event kinds are defined; 11 tests
3. **Story 5.2** (ILP-Native Job Submission) -- depends on 5.1; 10 tests
4. **Story 5.3** (Job Result Delivery + Compute Settlement) -- depends on 5.2; highest risk; 16 tests

Story 5.4 can be developed in parallel with Story 5.2 because skill descriptors only need the event kind definitions (from 5.1), not the full submission flow. Starting 5.4 early defers the highest-risk story (5.3) while building confidence in the foundation.

---

## 10. Interworking and Regression

### Packages Impacted by Epic 5

| Package | Impact | Regression Scope |
|---------|--------|------------------|
| **@crosstown/core** | DVM event builders/parsers added, TOON codec tested with DVM kinds, skill descriptor schema types | Core unit tests must pass; TOON roundtrip for existing kinds unaffected |
| **@crosstown/sdk** | DVM helper functions (`publishJobRequest`, `publishFeedback`, `publishResult`, `settleCompute`), handler registry tested with DVM kinds | SDK unit tests must pass; handler dispatch for existing kinds unaffected |
| **@crosstown/town** | kind:10035 extended with skill descriptor field, relay stores DVM events | Existing Town lifecycle/health/x402 tests must pass; kind:10035 backward-compatible |
| **@crosstown/relay** | No code changes; DVM events stored like any other Nostr event | Relay tests unaffected |
| **@crosstown/connector** | No code changes; compute settlement routes through existing ILP mesh | Connector tests unaffected |
| **@crosstown/client** | No code changes; E2E tests may gain DVM scenarios | E2E regression gate |

### Regression Test Strategy

1. `pnpm -r test` on every PR (catches cross-package regressions from DVM additions to core/sdk/town)
2. `genesis-bootstrap-with-channels.test.ts` must pass with DVM handlers registered (nightly)
3. TOON roundtrip regression: existing event kinds (1, 10032, 10033, 10035, 10036) must still encode/decode correctly after DVM kind support is added
4. kind:10035 backward compatibility: existing service discovery parsing must still work when skill descriptor field is absent

---

## 11. Relationship to Earlier Test Artifacts

This test plan is specific to Epic 5 (DVM Compute Marketplace, Stories 5.1-5.4) as renumbered per Decision 8 in the 2020117 analysis. It should NOT be confused with:

- `_bmad-output/test-artifacts/test-design-epic-5.md` -- This is a test design for **The Rig** (NIP-34 Git Forge), which was renumbered to **Epic 7** in the 2020117 analysis. The Rig test design remains valid for Epic 7 implementation.

This test plan follows the format established by:
- `_bmad-output/planning-artifacts/test-design-epic-3.md` (Epic 3 format template)
- `_bmad-output/test-artifacts/test-design-architecture.md` (system-level risk framework)
- `_bmad-output/test-artifacts/test-design-qa.md` (QA test coverage methodology)

Key adaptations for Epic 5:
1. **No new security surface** (unlike Epic 3's EIP-3009 and x402) -- DVM events flow through existing infrastructure
2. **Second financial flow** -- compute settlement introduces amount validation as the primary security concern (E5-R005)
3. **Protocol interoperability** -- NIP-90 compatibility is an explicit requirement (E5-R002) due to the 2020117 inspiration
4. **Discovery integration** -- skill descriptors extend existing kind:10035 rather than introducing new event kinds (Decision 5)

---

**Generated by:** Jonathan + Claude Opus 4.6
**Date:** 2026-03-16
