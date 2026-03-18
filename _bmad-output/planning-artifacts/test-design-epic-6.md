# Risk-Based Test Plan: Epic 6 - Advanced DVM Coordination + TEE Integration

**Date:** 2026-03-17
**Author:** Jonathan (with Claude Opus 4.6)
**Status:** Implementation-Ready
**Epic Source:** `_bmad-output/planning-artifacts/epics.md` -- Epic 6
**Predecessors:**
- `_bmad-output/planning-artifacts/test-design-epic-1.md` (Epic 1 SDK test plan)
- `_bmad-output/planning-artifacts/test-design-epic-2.md` (Epic 2 Town test plan)
- `_bmad-output/planning-artifacts/test-design-epic-3.md` (Epic 3 Protocol Economics test plan)
- `_bmad-output/planning-artifacts/test-design-epic-5.md` (Epic 5 DVM Compute Marketplace test plan)

---

## 1. Scope and Context

Epic 6 delivers 4 stories (6.1-6.4) implementing advanced DVM coordination patterns and TEE trust integration on top of Epic 5's base DVM marketplace and Epic 4's TEE attestation infrastructure. This epic transforms the protocol from a flat marketplace (one request, one provider, one result) into a coordinated compute substrate with multi-step pipelines, competitive execution, verifiable computation, and programmatic trust.

**Decision source:** [Party Mode 2020117 Analysis](research/party-mode-2020117-analysis-2026-03-10.md)

**Dependency chain:**
```
Epic 4 (TEE attestation) -----> 6.3 (TEE-Attested DVM Results)
                                  |
Epic 5 (base DVM marketplace) -> 6.1 (Workflow Chains)
                              -> 6.2 (Agent Swarms)
                              -> 6.3 (TEE-Attested DVM Results)
                              -> 6.4 (Reputation Scoring System)
                                  |
6.3 + 6.4 cross-integrate -------+-- (attested results feed reputation, reputation filters influence swarms)
```

**What exists today (post-Epic 5):**

- `@toon-protocol/sdk` complete with `createNode()`, DVM helpers (`publishFeedback()`, `publishResult()`, `settleCompute()`), handler registry with `getDvmKinds()`
- `@toon-protocol/town` with `startTown()`, relay subscription API, kind:10035 with skill descriptor, enriched `/health` with TEE info
- DVM event kinds (5xxx, 6xxx, 7000) with TOON encoding, builders, parsers
- TEE attestation infrastructure (kind:10033, `AttestationVerifier`, `AttestationBootstrap`)
- ILP payment channels with EVM settlement (USDC denomination)
- Compute settlement via pure ILP value transfer (`settleCompute()`)
- 2,159 passing tests across monorepo

**What Epic 6 changes:**

- **Story 6.1:** Workflow chain event kind (e.g., kind:10040), relay-as-orchestrator pattern, step advancement, input chaining, per-step settlement, failure handling
- **Story 6.2:** Swarm job request tags (`swarm`, `judge`), timeout-based bid collection, winner selection event, selective settlement (winner only)
- **Story 6.3:** Attestation tag injection in Kind 6xxx results, `require_attestation` parameter, attestation field in skill descriptors, customer-side attestation verification
- **Story 6.4:** Reputation formula implementation, Kind 31117 (Job Review), Kind 30382 (Web of Trust), composite score in kind:10035, `min_reputation` filter, on-chain channel volume extraction

**What this test plan does NOT cover:**

- Epics 1-5 internals (covered by prior test plans)
- Epic 7 (The Rig) -- separate test design exists
- Real Arbitrum One deployment with production USDC
- Performance benchmarking under production load (deferred A10)

---

## 2. Risk Assessment Matrix

### Risk Scoring

- **Probability**: 1 (unlikely), 2 (possible), 3 (likely)
- **Impact**: 1 (minor), 2 (moderate), 3 (severe -- data loss, security breach, financial loss, or cascade failure)
- **Score**: Probability x Impact (1-9)
- **Threshold**: Score >= 6 = high priority, 3-5 = medium, 1-2 = low

### Full Risk Matrix

| Risk ID | Story | Category | Description | P | I | Score | Test Strategy |
|---------|-------|----------|-------------|---|---|-------|---------------|
| **E6-R001** | 6.1 | TECH | **Workflow deadlock:** Step N fails but orchestrator does not detect the failure (missed Kind 7000 `status: 'error'`), leaving subsequent steps pending indefinitely with no timeout or recovery mechanism | 3 | 3 | **9** | Integration test: step 1 provider sends error feedback -> verify step 2 never starts, workflow marked failed, customer notified. Timeout test: no feedback at all -> workflow times out. Explicit state machine assertions. |
| **E6-R002** | 6.1 | BUS | **Orchestrator single point of failure:** Relay-as-orchestrator crashes mid-workflow. Workflow state is in-memory only -- no resume on restart. Steps 1-3 completed but step 4 never triggers after restart. | 2 | 3 | **6** | Integration test: verify workflow state persisted to EventStore (not just memory). Recovery test: restart orchestrator -> workflows resume from last completed step. |
| **E6-R003** | 6.1 | DATA | **Input chaining corruption:** Step N's Kind 6xxx result content is not compatible as Step N+1's Kind 5xxx input. TOON encoding of the intermediate result corrupts the content during relay-mediated handoff. | 2 | 3 | **6** | Roundtrip test: Kind 6xxx result -> extract content -> construct Kind 5xxx input -> TOON encode -> decode -> verify content preserved. Test with complex output types (JSON, binary references, multi-line text). |
| **E6-R004** | 6.1 | SEC | **Step payment manipulation:** Per-step bid allocation allows malicious provider to claim disproportionate share of total bid by inflating step amount. No validation that sum(step amounts) <= total bid. | 2 | 3 | **6** | Unit test: validate per-step compute settlement against proportional bid allocation. Test: step 1 claims 90% of total bid for 30% of work -> validation rejects. |
| **E6-R005** | 6.1 | PERF | **Relay-as-orchestrator scalability:** Many concurrent workflows overwhelm orchestrator's event subscription, processing loop, or EventStore queries. O(N) scanning for step completion events across M active workflows. | 2 | 2 | 4 | Load test: 10 concurrent 3-step workflows -> verify all complete without timeout. Profile orchestrator memory and CPU under concurrent workflow load. |
| **E6-R006** | 6.2 | TECH | **Swarm coordination failure -- no bids:** Zero providers respond to swarm request within timeout. No fallback mechanism; customer waits indefinitely or gets no result at all. | 3 | 2 | **6** | Integration test: swarm with max_providers=3, zero responses -> timeout fires -> customer receives explicit "no submissions" feedback. Verify no ILP payment initiated. |
| **E6-R007** | 6.2 | TECH | **Timeout edge cases:** Provider submits result at exactly the timeout boundary. Race condition between timeout handler closing the swarm and the incoming result event. | 2 | 2 | 4 | Unit test: result arrives at timeout-1ms -> accepted. Result arrives at timeout+1ms -> rejected. Deterministic time injection for reproducible boundary testing. |
| **E6-R008** | 6.2 | SEC | **Double payment in swarm:** Winner selection event is published twice (network duplicate, relay re-broadcast), triggering duplicate compute settlement. Customer pays winner 2x. | 2 | 3 | **6** | Unit test: duplicate selection event -> second settlement rejected (idempotency guard on selection event ID). Integration test: verify EVM channel balance after duplicate selection shows single payment only. |
| **E6-R009** | 6.2 | BUS | **Loser griefing economics:** Losing providers paid relay write fees but receive no compute payment. If relay write fees are significant relative to compute value, rational providers avoid swarms entirely, making the feature unusable. | 1 | 2 | 2 | Economic analysis test (unit): verify relay write fee for typical Kind 6xxx result is <1% of minimum viable compute bid. Document economic assumptions. |
| **E6-R010** | 6.3 | SEC | **Attestation-result binding integrity:** Provider references stale or fabricated kind:10033 attestation event ID in their Kind 6xxx result. Customer trusts the attestation tag without verifying it matches the actual provider pubkey and current PCR values. | 3 | 3 | **9** | Integration test: Kind 6xxx with attestation tag -> customer reads referenced kind:10033 -> verify pubkey matches result author -> verify PCR values against known-good registry -> verify attestation is not expired. Negative test: attestation tag references wrong pubkey -> verification fails. |
| **E6-R011** | 6.3 | TECH | **Attestation tag injection correctness:** Provider running in TEE omits attestation tag (bug), or non-TEE provider includes fake attestation tag. No enforcement mechanism at protocol level. | 2 | 2 | 4 | Unit test: TEE-enabled provider's Kind 6xxx builder automatically injects attestation tag from latest kind:10033. Unit test: non-TEE provider's Kind 6xxx has no attestation tag. Integration test: `require_attestation=true` job -> non-TEE provider's attempt rejected. |
| **E6-R012** | 6.3 | TECH | **Stale attestation reference:** Provider references kind:10033 that was valid when result was computed but has since expired (STALE/UNATTESTED). Customer verification at read time fails even though computation was legitimate. | 2 | 2 | 4 | Unit test: customer verifies attestation at result-time vs read-time. Decision: verify attestation was VALID at the time the Kind 6xxx result was created (use result event timestamp, not current time). |
| **E6-R013** | 6.4 | SEC | **Reputation gaming -- fake reviews:** Sybil attack via self-generated Kind 31117 reviews. Attacker creates multiple keypairs, each posting 5-star reviews for the attacker's provider node. Score inflated without real compute history. | 3 | 3 | **9** | Unit test: score calculation weights. Integration test: verify `avg_rating` ONLY counts Kind 31117 reviews from pubkeys that have a corresponding Kind 5xxx job request referencing the provider. Reviews from non-customers are excluded. |
| **E6-R014** | 6.4 | SEC | **Reputation gaming -- sybil WoT:** Attacker generates many keypairs and publishes Kind 30382 WoT declarations targeting themselves. `trusted_by` count inflated cheaply (relay write fee per WoT event). | 3 | 3 | **9** | Unit test: `trusted_by` count. Mitigation strategy: weight WoT declarations by the declarer's own reputation (recursive trust), OR require WoT declarers to have non-zero channel volume (on-chain anchor). Test: WoT from zero-history pubkeys -> discounted or ignored. |
| **E6-R015** | 6.4 | DATA | **Channel volume extraction accuracy:** `channel_volume_usdc` requires reading on-chain payment channel data. Incorrect contract ABI, wrong token network address, or missed channel closings lead to inaccurate volume calculation. | 2 | 2 | 4 | Integration test (requires Anvil): open channel -> transact -> close channel -> verify extracted volume matches actual on-chain settlement. Edge case: multiple channels between same peers -> sum correctly. |
| **E6-R016** | 6.4 | DATA | **Kind 31117 review structure integrity:** TOON encoding of Kind 31117 review events (with `d`, `p`, `rating`, `role` tags) corrupts tag structure. Rating values parsed incorrectly (string "5" vs number 5). | 2 | 2 | 4 | Roundtrip test: Kind 31117 with all required tags -> TOON encode -> decode -> all tags preserved. Unit test: rating tag value validated as integer 1-5. |
| **E6-R017** | 6.4 | BUS | **Self-reported reputation trust:** Reputation score in kind:10035 is self-reported. Provider claims score of 10000 but actual verifiable signals total 50. No protocol enforcement of score accuracy. | 2 | 2 | 4 | Integration test: customer independently calculates provider reputation from relay (Kind 31117, Kind 30382, Kind 6xxx counts) + on-chain (channel volume) and compares to self-reported score. Mismatch -> customer warns. |
| **E6-R018** | Cross | TECH | **Cross-story: attested results feeding reputation.** Story 6.3 attestation tags should influence Story 6.4 trust decisions. If attestation verification is decoupled from reputation scoring, customers cannot use TEE as a trust signal for provider selection. | 2 | 2 | 4 | Integration test: attested provider with high reputation vs unattested provider with high reputation -> customer prefers attested when `require_attestation=true`. Verify TEE attestation is displayed alongside but separate from numeric score. |
| **E6-R019** | Cross | TECH | **Cross-story: swarm with workflow chains.** Customer creates a workflow where one step is a swarm request. Orchestrator must handle swarm timeout + winner selection as a sub-step within the larger workflow. Deadlock risk if swarm never resolves. | 2 | 3 | **6** | Integration test: 2-step workflow where step 1 is a swarm -> swarm completes with winner -> step 2 fires with winner's result as input. Timeout test: swarm as workflow step times out -> workflow fails at that step. |
| **E6-R020** | Cross | SEC | **Cross-story: reputation-filtered swarms.** Swarm job with `min_reputation` filter excludes all available providers. Customer gets zero submissions despite available compute capacity. | 2 | 2 | 4 | Integration test: swarm with `min_reputation=500` but all providers have score < 500 -> timeout with explanation "no qualifying providers". Verify fallback behavior documented. |

### High-Priority Risks (Score >= 6) -- Ordered by Score

| Rank | Risk ID | Score | Story | Summary |
|------|---------|-------|-------|---------|
| 1 | E6-R001 | **9** | 6.1 | Workflow deadlock -- step failure not detected |
| 2 | E6-R010 | **9** | 6.3 | Attestation-result binding integrity (fake/stale attestation reference) |
| 3 | E6-R013 | **9** | 6.4 | Reputation gaming via fake reviews (sybil Kind 31117) |
| 4 | E6-R014 | **9** | 6.4 | Reputation gaming via sybil WoT (cheap Kind 30382 flooding) |
| 5 | E6-R002 | **6** | 6.1 | Orchestrator single point of failure (workflow state loss) |
| 6 | E6-R003 | **6** | 6.1 | Input chaining corruption through TOON roundtrip |
| 7 | E6-R004 | **6** | 6.1 | Step payment manipulation (disproportionate bid claim) |
| 8 | E6-R006 | **6** | 6.2 | Swarm with zero bids (no fallback) |
| 9 | E6-R008 | **6** | 6.2 | Double payment via duplicate winner selection |
| 10 | E6-R019 | **6** | Cross | Swarm-in-workflow deadlock |

**Analysis:** Epic 6 has significantly more high-priority risks (10) than Epic 5 (4), reflecting the increased coordination complexity. Three risks score 9 -- the maximum -- indicating that workflow deadlock, attestation binding integrity, and reputation gaming are the most critical threats. Story 6.4 alone carries 2 of the 4 score-9 risks, making it the single riskiest story in this epic.

### Inherited System-Level Risks

| Risk ID (System) | Score | Epic 6 Relevance |
|-------------------|-------|-------------------|
| R-001 (TOON pipeline ordering) | 9 | Workflow chain events (kind:10040), swarm selection events, Kind 31117 reviews, and Kind 30382 WoT declarations all flow through the SDK pipeline. The invariant (shallow parse -> verify -> price -> dispatch) must hold for all new event kinds. |
| R-005 (Payment channel state integrity) | 6 | Per-step compute settlement (Story 6.1) and selective winner settlement (Story 6.2) add new payment patterns to existing EVM channels. Channel state must remain consistent across multiple sequential settlements from the same workflow. |
| E5-R001 (TOON encoding corruption of DVM tags) | 6 | New event kinds (Kind 10040 workflow, Kind 31117 review, Kind 30382 WoT) require TOON roundtrip validation. The `swarm` and `judge` tags on Kind 5xxx events are new tag types. |
| E5-R005 (Compute settlement amount manipulation) | 6 | Per-step settlement in workflows and selective settlement in swarms both need bid validation. The validation logic must extend to partial bid amounts (per-step) and competitive amounts (swarm winner). |

---

## 3. Critical Integration Boundaries Between Stories

### 3.1 The Workflow Orchestration Loop (E6-R001, E6-R002, E6-R003 -- Score 6-9)

The most critical integration boundary in Epic 6 is the workflow chain orchestration loop:

```
Customer -> kind:10040 (Workflow Definition)
  -> Orchestrator detects workflow
    -> Creates Kind 5xxx for step 1 (initial input)
      -> Provider 1 processes -> Kind 7000 feedback -> Kind 6xxx result
        -> Orchestrator detects step 1 result
          -> Extracts result content
            -> Creates Kind 5xxx for step 2 (step 1 output as input)
              -> Provider 2 processes -> Kind 6xxx result
                -> ... repeat until final step
                  -> Compute settlement per step
                    -> Workflow completion notification (Kind 7000 for workflow event)
```

**Why this loop is the highest-risk integration boundary:**

- **Deadlock potential (E6-R001, score 9):** If any step's failure event is missed, the workflow hangs forever. The orchestrator's relay subscription must be robust against missed events, dropped connections, and out-of-order delivery.
- **State persistence (E6-R002, score 6):** Workflow state must survive orchestrator restarts. In-memory-only state would mean any crash during a multi-step workflow loses all progress.
- **Content transformation (E6-R003, score 6):** The output-to-input chaining must preserve semantic content through TOON encode/decode. If a step produces JSON output and the next step expects plain text, the orchestrator must handle the mismatch.

**Integration boundary tests:**

1. **Happy path:** 2-step workflow completes end-to-end with correct input chaining and per-step settlement
2. **Step failure:** Step 1 fails -> workflow aborts -> step 2 never starts -> customer notified
3. **No response:** Step 1 provider never responds -> workflow timeout -> abort
4. **Input chaining fidelity:** Step 1 produces complex JSON result -> Step 2 receives exact same JSON as input
5. **State persistence:** Kill orchestrator mid-workflow -> restart -> workflow resumes

### 3.2 The Swarm Collection and Settlement Path (E6-R006, E6-R008 -- Score 6)

```
Customer -> Kind 5xxx + swarm/judge tags
  -> Providers see the request
    -> Provider A submits Kind 6xxx result (relay write fee paid)
    -> Provider B submits Kind 6xxx result (relay write fee paid)
    -> Provider C submits Kind 6xxx result (relay write fee paid)
  -> Timeout fires OR max submissions reached
    -> Customer reviews submissions
      -> Customer publishes selection event (winner = Provider B)
        -> settleCompute() pays Provider B only
          -> Providers A, C receive no compute payment (relay fees are sunk cost)
```

**Integration boundary tests:**

1. **Happy path:** 3 providers submit, customer selects winner, only winner receives payment
2. **Zero submissions:** Timeout fires with no submissions -> customer gets explicit failure feedback
3. **Single submission:** Only 1 provider responds before timeout -> proceeds to judging with 1 candidate
4. **Duplicate selection:** Customer accidentally publishes 2 selection events -> second is idempotent (no double pay)
5. **Late submission:** Provider submits after timeout -> result stored but not eligible for selection

### 3.3 The Attestation Verification Chain (E6-R010 -- Score 9)

```
Provider (in TEE) publishes Kind 6xxx result with attestation tag
  -> Tag contains kind:10033 event ID
    -> Customer reads Kind 6xxx from relay
      -> Customer reads referenced kind:10033 from relay
        -> Customer verifies:
          1. kind:10033 pubkey == Kind 6xxx author pubkey (same provider)
          2. PCR values match known-good registry (code integrity)
          3. Attestation not expired (time validity)
          4. Attestation document chain valid (Nitro/Marlin)
```

**Why this is score 9:**

A broken attestation-result binding means customers believe computation ran in a TEE when it did not. This is a trust violation that undermines the entire TEE value proposition. Unlike reputation (which is probabilistic), TEE attestation is supposed to be cryptographic proof.

**Integration boundary tests:**

1. **Valid attestation:** Kind 6xxx -> kind:10033 -> pubkeys match, PCR valid, not expired -> verification succeeds
2. **Pubkey mismatch:** Kind 6xxx from pubkey A references kind:10033 from pubkey B -> verification fails
3. **Stale attestation:** kind:10033 expired at current time but was valid when Kind 6xxx was created -> decision point (verify at result-creation time)
4. **Unknown PCR:** kind:10033 PCR values not in known-good registry -> verification fails
5. **Missing attestation:** Kind 6xxx has attestation tag but kind:10033 event not found on relay -> verification fails

### 3.4 The Reputation Signal Aggregation Chain (E6-R013, E6-R014 -- Score 9)

```
Reputation score = (trusted_by x 100) + (log10(channel_volume) x 10) + (jobs_completed x 5) + (avg_rating x 20)

Signal sources:
  trusted_by:      Kind 30382 events on relay (WoT declarations targeting provider)
  channel_volume:  On-chain EVM payment channel data (USDC settled)
  jobs_completed:  Kind 6xxx events on relay (published by provider)
  avg_rating:      Kind 31117 events on relay (reviews referencing provider)
```

**Why both sybil attacks score 9:**

Reputation gaming directly impacts financial decisions. If a customer uses `min_reputation` to filter providers and the reputation system is gamed, the customer sends money to an untrustworthy provider. Unlike DVM compute (where the customer can verify the result), the reputation system influences pre-selection -- a stage where verification is not yet possible.

**Integration boundary tests:**

1. **Signal aggregation:** Provider with known signals -> calculated score matches formula
2. **Sybil review defense:** Reviews from non-customer pubkeys (no corresponding Kind 5xxx) -> excluded from avg_rating
3. **Sybil WoT defense:** WoT declarations from zero-history pubkeys -> discounted in trusted_by count
4. **On-chain accuracy:** Channel volume matches actual on-chain settlement records
5. **Self-reported vs verified:** Customer recalculates score from raw signals and compares to kind:10035 self-report

### 3.5 Cross-Story Integration Boundaries

| Boundary | Stories | Risk | Test Scenario |
|----------|---------|------|---------------|
| Workflow step as swarm | 6.1 + 6.2 | E6-R019 (6) | Workflow step 2 is a swarm -> swarm completes -> step 3 uses winner's result |
| Attested result in workflow | 6.1 + 6.3 | Medium (4) | Workflow step requires `require_attestation=true` -> only TEE providers accepted for that step |
| Reputation-filtered swarm | 6.2 + 6.4 | E6-R020 (4) | Swarm with `min_reputation=500` -> only qualified providers submit |
| Attested results feed reputation | 6.3 + 6.4 | E6-R018 (4) | TEE attestation displayed alongside reputation score in kind:10035 |
| Reputation in skill descriptor | 6.4 + 5.4 | Low (2) | kind:10035 skill descriptor includes `reputation` field |
| Workflow completion feeds job count | 6.1 + 6.4 | Low (2) | Completed workflow steps increment provider's `jobs_completed` count |

---

## 4. Test Strategy Per Story

### Legend

- **U** = Unit test (isolated, mocked dependencies)
- **I** = Integration test (multiple real modules wired together, Docker containers for ILP/relay/EVM)
- **E2E** = End-to-end test (requires genesis infrastructure or multi-node setup)
- **Real crypto** = Uses real nostr-tools/noble-curves signing, no mocked crypto

### Story 6.1: Workflow Chains

**Risk profile:** 1 critical (E6-R001, score 9), 3 high (E6-R002/R003/R004, score 6), 1 medium (E6-R005). Highest complexity story in the epic -- introduces the orchestration pattern.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-6.1-01 | Workflow definition event (kind:10040): TOON encode -> decode roundtrip preserves step list, initial input, total bid, and step-specific provider targets | U | E6-R003 | P0 |
| T-6.1-02 | Workflow definition validation: missing steps -> construction error; empty initial input -> construction error; total bid must be non-empty string | U | -- | P1 |
| T-6.1-03 | Orchestrator creates Kind 5xxx for step 1 from workflow definition's initial input and step 1's DVM kind | U | E6-R001 | P0 |
| T-6.1-04 | Step advancement: step N Kind 6xxx result detected -> orchestrator extracts content -> creates Kind 5xxx for step N+1 with extracted content as input | I | E6-R001, E6-R003 | P0 |
| T-6.1-05 | Input chaining fidelity: complex JSON output from step N preserved exactly as input to step N+1 through TOON encode/decode roundtrip | U | E6-R003 | P0 |
| T-6.1-06 | Step failure detection: step N returns Kind 7000 with `status: 'error'` -> workflow marked failed -> step N+1 never created -> customer notified via Kind 7000 referencing workflow event | I | E6-R001 | P0 |
| T-6.1-07 | Step timeout: step N provider never responds -> configurable step timeout fires -> workflow marked failed at step N -> customer notified | I | E6-R001 | P0 |
| T-6.1-08 | Final step completion: last step Kind 6xxx result detected -> workflow status marked completed -> customer receives Kind 7000 feedback referencing workflow event with `status: 'success'` | I | -- | P1 |
| T-6.1-09 | Per-step compute settlement: each step's `settleCompute()` settles individually through ILP -> provider for each step receives payment | I | E6-R004 | P0 |
| T-6.1-10 | Per-step bid validation: sum of all step settlements <= total workflow bid | U | E6-R004 | P0 |
| T-6.1-11 | Workflow state persistence: workflow state stored in EventStore, not just in-memory -> queryable after orchestrator process events | I | E6-R002 | P1 |
| T-6.1-12 | Concurrent workflows: 3 independent workflows running simultaneously -> each advances independently without interference | I | E6-R005 | P2 |
| T-6.1-13 | Workflow with targeted provider per step: step 1 targets provider A, step 2 targets provider B (via `p` tag in generated Kind 5xxx) | U | -- | P2 |
| T-6.1-14 | TOON shallow parser extracts kind for workflow definition events (kind:10040) without full decode | U | -- | P1 |
| T-6.1-15 | Workflow event flows through standard SDK pipeline: shallow parse -> verify -> price -> dispatch | U | Inherited R-001 | P1 |
| T-6.1-16 | 2-step workflow E2E: text input -> Kind 5302 translation -> Kind 5100 summarization -> both providers settled individually | E2E | E6-R001 | P3 |

**Notes:**

- T-6.1-01 and T-6.1-05 are the data integrity gating tests. If workflow definitions or intermediate results are corrupted through TOON, all orchestration fails.
- T-6.1-06 and T-6.1-07 directly address E6-R001 (score 9, workflow deadlock). These are the single most important tests in the epic.
- T-6.1-09 and T-6.1-10 address E6-R004 (score 6, step payment manipulation). Per-step settlement must be validated against proportional bid allocation.
- T-6.1-11 addresses E6-R002 (score 6, orchestrator state persistence). This test determines whether workflows can survive process restarts.

### Story 6.2: Agent Swarms

**Risk profile:** 2 high (E6-R006/R008, score 6), 1 medium (E6-R007), 1 low (E6-R009). Primary challenge is timeout handling and settlement idempotency.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-6.2-01 | Swarm request tags: Kind 5xxx with `swarm` tag (max providers), `judge` tag (default: `customer`) preserved through TOON encode/decode roundtrip | U | E5-R001 | P0 |
| T-6.2-02 | Provider submission collection: 3 providers submit Kind 6xxx results for swarm request -> all 3 stored on relay, associated via `e` tag | I | -- | P0 |
| T-6.2-03 | Timeout-based collection: max_providers=5 but only 2 respond -> configurable timeout (default 10 min) fires -> judging proceeds with 2 submissions | I | E6-R006 | P0 |
| T-6.2-04 | Zero submissions: no providers respond within timeout -> customer receives explicit "no submissions" Kind 7000 feedback -> no ILP payment initiated | I | E6-R006 | P0 |
| T-6.2-05 | Winner selection event: customer publishes selection event referencing winning Kind 6xxx -> `settleCompute()` pays winning provider only | I | -- | P0 |
| T-6.2-06 | Loser outcome: 3 providers submit, 1 selected as winner -> 2 losers paid relay write fees but no compute payment -> losing Kind 6xxx results remain on relay | I | -- | P1 |
| T-6.2-07 | Duplicate selection idempotency: customer publishes 2 selection events for same swarm -> second settlement rejected -> provider receives single payment only | I | E6-R008 | P0 |
| T-6.2-08 | Late submission: provider submits Kind 6xxx after timeout -> result stored on relay but not eligible for winner selection | I | E6-R007 | P1 |
| T-6.2-09 | Timeout boundary: result at timeout-1ms accepted, result at timeout+1ms rejected (deterministic time injection) | U | E6-R007 | P1 |
| T-6.2-10 | Max submissions reached: max_providers=2, exactly 2 providers submit -> judging starts immediately without waiting for timeout | I | -- | P1 |
| T-6.2-11 | Single submission: only 1 provider responds -> timeout fires -> customer can select (or auto-select) the single submission | I | E6-R006 | P2 |
| T-6.2-12 | Non-swarm-aware provider participation: standard Kind 5xxx is also published alongside swarm request -> non-swarm providers can submit via standard path | U | -- | P2 |
| T-6.2-13 | Swarm event flows through standard SDK pipeline: shallow parse -> verify -> price -> dispatch (swarm tags do not bypass any stage) | U | Inherited R-001 | P1 |
| T-6.2-14 | Swarm with 3 providers E2E: full lifecycle with real ILP compute settlement to winner only | E2E | E6-R008 | P3 |

**Notes:**

- T-6.2-04 directly addresses E6-R006 (score 6, zero submissions). Explicit failure feedback is critical -- the customer must not wait indefinitely.
- T-6.2-07 directly addresses E6-R008 (score 6, double payment). Idempotency on the selection event is the key defense.
- T-6.2-09 uses deterministic time injection (inject `now` parameter, following AttestationVerifier pattern from Epic 4) to test timeout boundary conditions reproducibly.

### Story 6.3: TEE-Attested DVM Results

**Risk profile:** 1 critical (E6-R010, score 9), 2 medium (E6-R011/R012). The attestation-result binding is the single most security-critical feature in this story.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-6.3-01 | Attestation tag injection: TEE-enabled provider's Kind 6xxx builder includes `attestation` tag referencing latest kind:10033 event ID | U | E6-R011 | P0 |
| T-6.3-02 | No attestation tag for non-TEE provider: Kind 6xxx from non-TEE node has no `attestation` tag | U | E6-R011 | P0 |
| T-6.3-03 | Customer verification -- pubkey match: Kind 6xxx attestation tag -> read kind:10033 -> verify kind:10033 pubkey matches Kind 6xxx author pubkey | U | E6-R010 | P0 |
| T-6.3-04 | Customer verification -- PCR validity: referenced kind:10033 PCR values checked against known-good registry via existing `AttestationVerifier.verify()` | U | E6-R010 | P0 |
| T-6.3-05 | Customer verification -- time validity: kind:10033 attestation was VALID at the time the Kind 6xxx result was created (result event `created_at` timestamp used for time check, not current time) | U | E6-R010, E6-R012 | P0 |
| T-6.3-06 | Customer verification -- negative: attestation tag references kind:10033 from different pubkey -> verification fails with clear error | U | E6-R010 | P0 |
| T-6.3-07 | Customer verification -- negative: attestation tag references kind:10033 with unknown PCR -> verification fails | U | E6-R010 | P0 |
| T-6.3-08 | Customer verification -- negative: referenced kind:10033 event not found on relay -> verification fails with "attestation not found" error | U | E6-R010 | P1 |
| T-6.3-09 | `require_attestation` parameter: Kind 5xxx with `['param', 'require_attestation', 'true']` -> non-TEE provider detects param and sends Kind 7000 `status: 'error'` with reason | U | E6-R011 | P1 |
| T-6.3-10 | Skill descriptor attestation field: TEE-attested node's kind:10035 includes `attestation` field with latest kind:10033 event ID and enclave image hash | U | -- | P1 |
| T-6.3-11 | Customer pre-filters providers: query kind:10035 events -> filter by `attestation` field presence -> only submit jobs to attested providers | I | -- | P1 |
| T-6.3-12 | Attestation tag TOON roundtrip: `attestation` tag in Kind 6xxx survives TOON encode -> decode with event ID preserved | U | E5-R001 | P0 |
| T-6.3-13 | Full attestation lifecycle E2E: TEE provider publishes kind:10033 -> receives Kind 5xxx with require_attestation -> publishes Kind 6xxx with attestation tag -> customer verifies attestation chain | E2E | E6-R010 | P3 |

**Notes:**

- T-6.3-03 through T-6.3-07 form the attestation verification test suite. Together they ensure that the binding between computation result and TEE attestation is cryptographically sound. These are the most security-critical tests in Epic 6.
- T-6.3-05 resolves the ambiguity in E6-R012: attestation validity should be checked at result-creation time, not at customer-read time. This prevents legitimate results from becoming "unverifiable" due to normal attestation refresh cycles.
- T-6.3-09 tests the "soft" enforcement model -- providers are expected to self-reject if they cannot attest. Protocol-level enforcement would require relay-side attestation checking, which is out of scope.

### Story 6.4: Reputation Scoring System

**Risk profile:** 2 critical (E6-R013/R014, score 9), 3 medium (E6-R015/R016/R017). The highest-risk story in the epic due to sybil attack surface.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-6.4-01 | Score formula: `score = (trusted_by x 100) + (log10(channel_volume) x 10) + (jobs_completed x 5) + (avg_rating x 20)` -> verify with known inputs | U | -- | P0 |
| T-6.4-02 | Score components: each signal (trusted_by, channel_volume, jobs_completed, avg_rating) computed correctly from mock data | U | -- | P0 |
| T-6.4-03 | Score edge cases: channel_volume=0 (log10 guard), jobs_completed=0, avg_rating with 0 reviews (default to 0, not NaN), trusted_by=0 | U | -- | P0 |
| T-6.4-04 | Kind 31117 (Job Review) event: TOON encode -> decode roundtrip preserves `d` (job request ID), `p` (target pubkey), `rating` (1-5), `role` (customer/provider) tags | U | E6-R016 | P0 |
| T-6.4-05 | Kind 31117 rating validation: rating must be integer 1-5; rating=0 rejected; rating=6 rejected; rating="excellent" rejected; rating=3.5 rejected | U | E6-R016 | P0 |
| T-6.4-06 | Kind 31117 NIP-33 replaceable: one review per job per reviewer enforced by `d` tag (second review replaces first, not counted twice) | U | -- | P1 |
| T-6.4-07 | Kind 30382 (WoT) declaration: TOON encode -> decode roundtrip preserves target pubkey reference | U | -- | P1 |
| T-6.4-08 | **Sybil review defense:** `avg_rating` only counts Kind 31117 reviews from pubkeys that authored a Kind 5xxx job request referencing the reviewed provider (customer-gate) | U | E6-R013 | P0 |
| T-6.4-09 | **Sybil review defense integration:** reviewer pubkey with no corresponding Kind 5xxx job -> review excluded from avg_rating calculation | I | E6-R013 | P0 |
| T-6.4-10 | **Sybil WoT defense:** `trusted_by` weights WoT declarations by the declarer's own channel_volume (on-chain anchor). Zero-volume declarers contribute 0 to trusted_by count. | U | E6-R014 | P0 |
| T-6.4-11 | **Sybil WoT defense integration:** WoT declarations from newly created pubkeys with zero channel history -> not counted in trusted_by | I | E6-R014 | P0 |
| T-6.4-12 | Reputation in kind:10035: provider's service discovery event includes `reputation` field with composite score + individual signal values | U | -- | P1 |
| T-6.4-13 | Self-reported vs verified: customer independently calculates reputation from relay (Kind 31117, Kind 30382, Kind 6xxx) + on-chain (channel volume) -> matches self-reported score within tolerance | I | E6-R017 | P1 |
| T-6.4-14 | `min_reputation` filter: Kind 5xxx with `['param', 'min_reputation', '500']` -> provider with score < 500 self-rejects | U | -- | P1 |
| T-6.4-15 | Channel volume extraction: read on-chain payment channel settlement data -> extract USDC volume for provider address | I | E6-R015 | P1 |
| T-6.4-16 | Channel volume edge cases: multiple channels between same peers summed correctly; closed channels included; zero-value channels excluded | I | E6-R015 | P2 |
| T-6.4-17 | Job completion count: count of Kind 6xxx events authored by provider on relay | U | -- | P2 |
| T-6.4-18 | TEE attestation alongside reputation: kind:10035 shows attestation status as separate binary trust signal, NOT factored into numeric score | U | E6-R018 | P1 |
| T-6.4-19 | Reputation score update lifecycle E2E: customer posts job -> provider completes -> customer submits Kind 31117 review -> provider's score recalculated -> kind:10035 updated | E2E | E6-R013 | P3 |

**Notes:**

- T-6.4-08 through T-6.4-11 are the sybil defense tests. These directly address the two score-9 risks (E6-R013, E6-R014) and are the most critical tests in Story 6.4.
- The sybil review defense (T-6.4-08) requires that reviewers prove they were actually customers of the provider. This is verified by checking for a Kind 5xxx job request from the reviewer's pubkey that references the provider. This is an architectural decision that should be validated early.
- The sybil WoT defense (T-6.4-10) uses on-chain channel volume as an anchor. Creating fake WoT declarations is cheap (relay write fee), but creating fake channel volume requires actual USDC on-chain. This makes the attack economically expensive.
- T-6.4-03 handles mathematical edge cases in the formula: `log10(0)` is `-Infinity`, which would produce NaN in the score. Guard with `Math.max(1, channel_volume)` or equivalent.

---

## 5. Cross-Story Integration Test Scenarios

| ID | Boundary | Test | Level | Risk | Priority |
|----|----------|------|-------|------|----------|
| T-INT-01 | 6.1 + 6.2 | Workflow step 2 is a swarm request: orchestrator creates Kind 5xxx with swarm/judge tags -> 2 providers submit -> customer selects winner -> step 3 uses winner's result as input | I | E6-R019 | P1 |
| T-INT-02 | 6.1 + 6.2 | Swarm-in-workflow timeout: swarm step receives no submissions -> timeout fires -> workflow fails at swarm step -> subsequent steps skipped | I | E6-R019 | P1 |
| T-INT-03 | 6.1 + 6.3 | Workflow step with `require_attestation=true`: only TEE providers accepted for that step, non-TEE providers self-reject | I | E6-R010 | P1 |
| T-INT-04 | 6.2 + 6.4 | Swarm with `min_reputation=500`: only providers with reputation >= 500 submit results. Provider with score 400 self-rejects. | I | E6-R020 | P1 |
| T-INT-05 | 6.3 + 6.4 | Attested provider displays TEE status alongside reputation in kind:10035. Customer filters by both attestation AND reputation. | I | E6-R018 | P2 |
| T-INT-06 | 6.1 + 6.4 | Workflow step completion increments provider's `jobs_completed` signal -> provider reputation score updated after workflow finishes | I | -- | P2 |
| T-INT-07 | 6.1 + 6.3 + 6.4 | Full trust chain: customer posts workflow requiring attestation -> attested provider completes step -> customer submits review -> provider reputation includes both attestation and job review | I | E6-R010, E6-R013 | P2 |
| T-INT-08 | All stories + SDK pipeline | New event kinds (kind:10040, Kind 31117, Kind 30382, swarm selection) all traverse full SDK pipeline with no stage skipped (shallow parse -> verify -> price -> dispatch) | U | Inherited R-001 | P0 |

---

## 6. Non-Functional Requirements (NFR) Tests

### 6.1 Performance

| ID | Requirement | Test | Priority |
|----|-------------|------|----------|
| NFR-6-PERF-01 | Orchestrator should handle >= 10 concurrent workflows without degradation | Load test: start 10 concurrent 3-step workflows -> measure time-to-completion vs single workflow baseline | P2 |
| NFR-6-PERF-02 | Swarm submission collection should handle >= 20 concurrent submissions | Stress test: swarm with max_providers=20 -> 20 providers submit simultaneously -> all collected correctly | P2 |
| NFR-6-PERF-03 | Reputation score calculation should complete in < 100ms for typical providers (< 100 reviews, < 50 WoT declarations) | Benchmark: generate 100 Kind 31117 + 50 Kind 30382 events -> measure score computation time | P2 |
| NFR-6-PERF-04 | Workflow state queries should not degrade with historical workflow volume | Test: 100 completed workflows in EventStore -> new workflow state queries execute in < 10ms | P3 |

### 6.2 Security

| ID | Requirement | Test | Priority |
|----|-------------|------|----------|
| NFR-6-SEC-01 | Attestation binding must be cryptographically verifiable -- no trust-on-first-use | T-6.3-03 through T-6.3-07 (covered in story tests) | P0 |
| NFR-6-SEC-02 | Reputation system must resist sybil attacks at < 10x cost of honest participation | T-6.4-08 through T-6.4-11 (covered in story tests). Economic analysis: cost to add 1 fake review (relay write fee + Kind 5xxx submission) must be >= 10% of cost of genuine job completion. | P0 |
| NFR-6-SEC-03 | Duplicate settlement prevention across all payment paths (per-step, swarm winner, standard DVM) | T-6.1-09, T-6.2-07, inherited E5-R005 tests. Verify settlement idempotency guards. | P0 |
| NFR-6-SEC-04 | Event signature verification on all new event kinds (kind:10040 workflow, Kind 31117 review, Kind 30382 WoT, swarm selection) | T-INT-08 (covered in cross-story tests). Unsigned events must be rejected. | P0 |
| NFR-6-SEC-05 | Workflow step bid allocation must not exceed total workflow bid | T-6.1-10. Verify invariant: `sum(step_i.amount) <= workflow.totalBid` | P0 |

### 6.3 Reliability

| ID | Requirement | Test | Priority |
|----|-------------|------|----------|
| NFR-6-REL-01 | Workflow must gracefully degrade on step failure -- no hanging, no undefined state | T-6.1-06, T-6.1-07. Explicit failure notification to customer within timeout period. | P0 |
| NFR-6-REL-02 | Swarm must handle all edge cases: 0 submissions, 1 submission, max submissions, late submissions | T-6.2-03, T-6.2-04, T-6.2-08, T-6.2-10, T-6.2-11 (covered in story tests) | P0 |
| NFR-6-REL-03 | Reputation system must produce finite numeric scores for all valid input combinations (no NaN, no Infinity) | T-6.4-03. Validate against edge case inputs: zero channels, zero jobs, zero reviews, zero WoT. | P0 |

---

## 7. Test Infrastructure Requirements

### 7.1 Current Infrastructure (Sufficient for Unit + Most Integration Tests)

| Component | Purpose | Available Today |
|-----------|---------|-----------------|
| Anvil (localhost:8545) | EVM settlement for compute payments | Yes (`deploy-genesis-node.sh`) |
| SDK E2E infra (Peer1/Peer2) | Multi-hop ILP routing for settlement tests | Yes (`scripts/sdk-e2e-infra.sh up`) |
| Vitest | Test framework with mocking | Yes |
| Mock USDC (Anvil) | Token for payment channel operations | Yes (`scripts/deploy-mock-usdc.sh`) |
| Docker containers | Real ILP connectors, relays, BTP | Yes (docker-compose) |

### 7.2 New Infrastructure Required for Epic 6

| Component | Purpose | Stories | Effort |
|-----------|---------|---------|--------|
| **Orchestrator node** (relay-as-orchestrator) | Manages workflow step advancement, subscribes to relay for step completion events, creates subsequent step requests. Requires new orchestration logic in Town or SDK. | 6.1 | Medium -- new component, but builds on existing relay subscription API |
| **Timer/timeout service** | Deterministic timeout handling for swarm bid collection and workflow step timeouts. Must support injectable time source for deterministic testing. | 6.1, 6.2 | Low -- follow `AttestationVerifier.getAttestationState()` pattern with injectable `now` parameter |
| **TEE mock provider** | Docker container running as TEE-enabled node that publishes kind:10033 and produces attested Kind 6xxx results. Required for attestation integration tests. | 6.3 | Medium -- extend existing Dockerfile.oyster config to simulate TEE in Docker (mock `TEE_ENABLED=true`) |
| **On-chain data reader** | Utility to read payment channel settlement volume from Anvil contracts for reputation calculation. Uses `viem` `readContract()` against TokenNetwork. | 6.4 | Low -- wraps existing viem client pattern from x402 handler |
| **Multi-provider Docker setup** | At least 3 provider nodes for swarm tests (2 existing SDK E2E peers + 1 additional). Or refactor existing 2-peer setup to support multiple DVM handlers. | 6.2 | Medium -- extend `docker-compose-sdk-e2e.yml` with Peer3 or simulate multiple providers on existing peers |
| **Kind 31117 / Kind 30382 event builders** | Builder/parser functions for Job Review (Kind 31117) and WoT (Kind 30382) events, following existing `buildJobRequestEvent()` pattern. | 6.4 | Low -- same pattern as existing DVM event builders in `packages/core/src/events/dvm.ts` |

### 7.3 Docker Infrastructure Extension

The current SDK E2E infrastructure provides 2 peers. Epic 6 requires:

```
Extended SDK E2E Infrastructure:
  Anvil (18545)
  Peer1 (BTP:19000, BLS:19100, Relay:19700) -- can act as orchestrator
  Peer2 (BTP:19010, BLS:19110, Relay:19710) -- provider A
  Peer3 (BTP:19020, BLS:19120, Relay:19720) -- provider B (NEW)
  Peer4 (BTP:19030, BLS:19130, Relay:19730) -- provider C (NEW, for swarm tests)
```

**Alternative:** Simulate multiple providers on a single peer by registering multiple DVM handlers with different skill descriptors. This avoids adding containers but reduces test fidelity for multi-hop routing.

**Recommendation:** Add Peer3 for swarm tests (3 providers minimum). Peer4 is nice-to-have for competitive swarm tests with > 3 submissions. Most tests can run with 2-3 peers.

---

## 8. Test Count Summary

| Story | P0 | P1 | P2 | P3 | Total |
|-------|----|----|----|----|-------|
| 6.1 Workflow Chains | 6 | 4 | 2 | 1 | **16** |
| 6.2 Agent Swarms | 4 | 4 | 2 | 1 | **14** |
| 6.3 TEE-Attested DVM Results | 5 | 3 | 0 | 1 | **13** (including 4 negative verification tests) |
| 6.4 Reputation Scoring | 6 | 5 | 2 | 1 | **19** (highest test count, highest risk) |
| Cross-Story Integration | 1 | 4 | 3 | 0 | **8** |
| **Total** | **22** | **20** | **9** | **4** | **70** |

### Test Level Distribution

| Level | Count | Notes |
|-------|-------|-------|
| Unit (U) | ~38 | Event construction, formula validation, TOON roundtrips, parameter validation |
| Integration (I) | ~26 | Multi-component flows with Docker containers (orchestration loops, settlement, attestation verification) |
| E2E | ~4 | Full lifecycle tests requiring genesis + multi-peer infrastructure |
| NFR | ~12 | Performance, security, and reliability tests |
| **Grand Total** | **~70 story + 8 cross-story + 12 NFR = ~90 tests** | |

---

## 9. Execution Strategy

| Trigger | What Runs | Time Budget | Infrastructure |
|---------|-----------|-------------|----------------|
| **Every PR** | All unit tests + integration tests with 2-peer Docker infra (P0-P2) | < 15 min | SDK E2E infra (`sdk-e2e-infra.sh up`), Anvil container |
| **Nightly** | Full suite including E2E + NFR performance tests (P0-P3) | < 30 min | Genesis node + extended SDK E2E infra (3-4 peers) |

**Philosophy:** Unit tests validate event construction, formula correctness, and TOON roundtrips. Integration tests validate orchestration loops, settlement flows, and attestation verification chains using real Docker containers. E2E tests validate complete multi-step workflows with real ILP routing.

**PR test infrastructure:**

- Anvil container at `http://localhost:18545` (SDK E2E Anvil)
- Peer1 and Peer2 Docker containers (SDK E2E infra)
- Mocked time sources for deterministic timeout testing
- Real TOON encode/decode, real Schnorr signatures, real ILP routing

**Nightly E2E infrastructure:**

- Extended SDK E2E infra with Peer3 (and optionally Peer4)
- Full workflow lifecycle tests (multi-step, multi-provider)
- Swarm tests with 3+ providers
- Performance benchmarks under concurrent workflow load

---

## 10. Mitigation Plans for High-Priority Risks

### E6-R001: Workflow Deadlock (Score: 9)

**Mitigation Strategy:**

1. Workflow orchestrator MUST implement an explicit state machine with states: `pending`, `step_N_running`, `step_N_failed`, `completed`, `timed_out`
2. Each step has a configurable timeout (default: 5 minutes). If no Kind 7000 feedback or Kind 6xxx result is received within the timeout, the step is marked failed.
3. The orchestrator subscribes to Kind 7000 AND Kind 6xxx events via the relay subscription API -- not polling. Missed events during disconnection are recovered via relay query on reconnect.
4. Customer receives Kind 7000 feedback with `status: 'error'` and details for ANY workflow failure mode (step error, step timeout, orchestrator error).

**Owner:** Dev
**Timeline:** Story 6.1
**Verification:** T-6.1-06, T-6.1-07, T-6.1-08
**Conditional escalation:** If relay subscription proves unreliable for step completion detection (missed events), add a polling fallback with exponential backoff. This would increase T-6.1-07 priority to P0+.

### E6-R010: Attestation-Result Binding Integrity (Score: 9)

**Mitigation Strategy:**

1. Kind 6xxx builder for TEE-enabled providers MUST automatically inject `['attestation', kind10033EventId]` tag referencing the latest valid kind:10033 event
2. Customer verification MUST check ALL of: (a) kind:10033 pubkey == Kind 6xxx author, (b) PCR values in known-good registry, (c) attestation was VALID at Kind 6xxx `created_at` time
3. SDK provides `verifyDvmAttestation(result, attestationEvent, verifier)` helper function encapsulating all checks
4. Verification failure returns a structured error indicating which check failed (not just "attestation invalid")

**Owner:** Dev
**Timeline:** Story 6.3
**Verification:** T-6.3-03, T-6.3-04, T-6.3-05, T-6.3-06, T-6.3-07
**Design decision:** Verify attestation at result-creation time (`created_at`), not at customer-read time. This prevents legitimate results from becoming "unverifiable" due to normal attestation refresh. Document this in the SDK API.

### E6-R013: Reputation Gaming via Fake Reviews (Score: 9)

**Mitigation Strategy:**

1. `avg_rating` calculation MUST verify that each Kind 31117 reviewer pubkey has authored at least one Kind 5xxx job request referencing the reviewed provider's pubkey (via `p` tag or via `e` tag -> job result `p` tag chain)
2. Reviews from non-customer pubkeys are excluded entirely (not just downweighted)
3. NIP-33 replaceable semantics enforce one review per job per reviewer (the `d` tag = job request event ID prevents duplicate reviews)
4. Negative test: generate 100 fake reviews from random pubkeys -> verify avg_rating remains unchanged

**Owner:** Dev
**Timeline:** Story 6.4
**Verification:** T-6.4-08, T-6.4-09
**Conditional escalation:** If customer-gate verification is too expensive (requires relay queries for each reviewer), consider caching verified customer relationships or computing ratings lazily. This would add a performance risk (NFR-6-PERF-03).

### E6-R014: Reputation Gaming via Sybil WoT (Score: 9)

**Mitigation Strategy:**

1. `trusted_by` calculation MUST weight WoT declarations by the declarer's own channel_volume. A WoT declaration from a pubkey with zero channel history contributes 0 to the count.
2. This creates an on-chain anchor: creating meaningful WoT weight requires actual USDC settlement on-chain, making sybil attacks economically expensive.
3. Alternative (simpler): require minimum channel_volume threshold (e.g., > 1000 USDC micro-units) to count as a WoT endorser. Binary rather than weighted.
4. Negative test: generate 50 WoT declarations from zero-volume pubkeys -> verify trusted_by = 0

**Owner:** Dev
**Timeline:** Story 6.4
**Verification:** T-6.4-10, T-6.4-11
**Design decision:** Choose between weighted WoT (proportional to channel volume) or threshold WoT (binary, requires minimum volume). Weighted is more nuanced but harder to explain. Threshold is simpler and easier to test. Recommend threshold for v1.

### E6-R002: Orchestrator State Persistence (Score: 6)

**Mitigation Strategy:**

1. Workflow state (current step, completed steps, per-step results) stored as Nostr events in the EventStore, not just in-memory
2. On orchestrator restart, active workflows are recovered by querying workflow definition events (kind:10040) and their associated Kind 6xxx results
3. Step completion is idempotent: if step N's result is already stored, re-processing the same result does not create a duplicate Kind 5xxx for step N+1

**Owner:** Dev
**Timeline:** Story 6.1
**Verification:** T-6.1-11

### E6-R003: Input Chaining Corruption (Score: 6)

**Mitigation Strategy:**

1. Roundtrip test: Kind 6xxx content -> extract -> construct Kind 5xxx input -> TOON encode -> decode -> verify content is byte-for-byte identical
2. Document supported content types for step chaining: plain text, JSON, and opaque binary (base64-encoded)
3. The orchestrator does NOT transform content between steps -- it passes the exact result content as the next step's input data

**Owner:** Dev
**Timeline:** Story 6.1
**Verification:** T-6.1-05

### E6-R004: Step Payment Manipulation (Score: 6)

**Mitigation Strategy:**

1. Workflow definition includes per-step bid allocation (explicit or proportional)
2. The orchestrator validates that each step's `settleCompute()` amount <= that step's allocated bid
3. The invariant `sum(step_amounts) <= total_bid` is checked before any settlement

**Owner:** Dev
**Timeline:** Story 6.1
**Verification:** T-6.1-09, T-6.1-10

### E6-R006: Swarm with Zero Bids (Score: 6)

**Mitigation Strategy:**

1. Swarm timeout fires -> if submissions.length === 0, publish explicit failure feedback (Kind 7000 with `status: 'error'` and reason "no submissions received")
2. No ILP payment initiated when zero submissions
3. Customer SDK returns a clear error type (e.g., `SwarmNoSubmissionsError`) rather than a silent timeout

**Owner:** Dev
**Timeline:** Story 6.2
**Verification:** T-6.2-04

### E6-R008: Double Payment in Swarm (Score: 6)

**Mitigation Strategy:**

1. Settlement is keyed on the selection event ID. Duplicate selection events with the same `e` tag (referencing the same swarm request) are rejected.
2. The idempotency check happens at the SDK level before the ILP packet is sent.
3. Alternative: the selection event is a NIP-33 replaceable event (with `d` tag = swarm request ID), so the relay stores only the latest selection.

**Owner:** Dev
**Timeline:** Story 6.2
**Verification:** T-6.2-07

### E6-R019: Swarm-in-Workflow Deadlock (Score: 6)

**Mitigation Strategy:**

1. Swarm timeout is respected as a sub-step timeout within the workflow. If the swarm times out with zero submissions, the workflow step fails normally (same as E6-R001 step failure handling).
2. If the swarm times out with >= 1 submission, auto-selection may apply (customer-configured) or the workflow waits for manual selection.
3. The workflow's per-step timeout must be >= the swarm's collection timeout to avoid conflicting timeouts.

**Owner:** Dev
**Timeline:** Story 6.1 + 6.2 integration
**Verification:** T-INT-01, T-INT-02

---

## 11. Entry and Exit Criteria

### Entry Criteria

QA testing for Epic 6 cannot begin until ALL of the following are met:

- [ ] Epics 1-5 complete (SDK, Town, Protocol Economics, TEE, DVM all functional)
- [ ] `@toon-protocol/sdk` and `@toon-protocol/town` packages importable with DVM functionality
- [ ] `node.publishEvent()`, `node.publishFeedback()`, `node.publishResult()`, `node.settleCompute()` all functional
- [ ] kind:10033 TEE attestation events publishable and queryable (Epic 4 infrastructure)
- [ ] `AttestationVerifier.verify()` functional with known-good PCR registry
- [ ] Kind 5xxx/6xxx/7000 TOON encode/decode roundtrip verified (Epic 5 gate)
- [ ] Relay subscription API (`town.subscribe()`) functional for step/result detection
- [ ] Anvil running with Mock USDC and TokenNetwork deployed
- [ ] EVM payment channels functional for compute settlement
- [ ] SDK E2E infra with 2 peers operational (`scripts/sdk-e2e-infra.sh up`)
- [ ] All existing monorepo tests passing (2,159+)

### Exit Criteria

Epic 6 testing is complete when ALL of the following are met:

- [ ] All P0 tests passing (22 story + 1 cross-story = 23 required)
- [ ] All P1 tests >= 95% passing or failures triaged
- [ ] No open high-priority bugs for score-9 risks (E6-R001, E6-R010, E6-R013, E6-R014)
- [ ] Workflow chains: 2-step workflow completes end-to-end with step advancement and per-step settlement
- [ ] Workflow deadlock: step failure detected -> workflow aborted -> customer notified within timeout
- [ ] Agent swarms: winner-only settlement verified with zero-submission and duplicate-selection edge cases
- [ ] Attestation binding: Kind 6xxx attestation tag -> kind:10033 verification chain fully tested (positive + 4 negative cases)
- [ ] Reputation sybil defense: fake reviews from non-customers excluded; zero-volume WoT declarations excluded
- [ ] Reputation formula: edge cases (zero values) produce finite scores, no NaN/Infinity
- [ ] New event kinds (kind:10040, Kind 31117, Kind 30382) TOON roundtrip verified
- [ ] All new event kinds traverse full SDK pipeline (shallow parse -> verify -> price -> dispatch)
- [ ] Existing E2E tests pass with no regression (2,159+ tests)
- [ ] Cross-story integration: swarm-in-workflow, attestation-filtered workflow, reputation-filtered swarm all verified

---

## 12. Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
|----------|-------|-----------|-------------|-------|
| P0 | 22 + 1 cross-story | 2.0-3.0 | ~46-69 | Core correctness: deadlock, attestation binding, sybil defense, settlement |
| P1 | 20 + 4 cross-story | 1.5-2.5 | ~36-60 | Integration flows, state persistence, timeout handling |
| P2 | 9 + 3 cross-story | 0.5-1.5 | ~6-18 | Concurrent workflows, edge cases, TEE+reputation cross-story |
| P3 | 4 | 2.0-3.0 | ~8-12 | Full E2E lifecycle tests requiring extended infrastructure |
| NFR | 12 | 1.0-2.0 | ~12-24 | Performance benchmarks, security analysis, reliability checks |
| **Total** | **~90** | -- | **~108-183 hours** | **~3-5 weeks (1 engineer)** |

### Recommended Story Implementation Order

Based on dependency chain, risk concentration, and foundation requirements:

1. **Story 6.4** (Reputation Scoring) -- Despite being listed last, the event kinds (Kind 31117, Kind 30382) and scoring infrastructure are independent of other stories. Contains 2 of the 4 score-9 risks. Starting early gives the most time for sybil defense design decisions.
2. **Story 6.3** (TEE-Attested DVM Results) -- Depends on Epic 4 infrastructure already in place. Contains 1 score-9 risk. Can run in parallel with 6.4.
3. **Story 6.1** (Workflow Chains) -- Highest complexity, introduces the orchestration pattern. Contains the remaining score-9 risk (workflow deadlock). Depends on base DVM lifecycle (Epic 5) only.
4. **Story 6.2** (Agent Swarms) -- Can leverage workflow orchestration infrastructure from 6.1 (timeout handling, state management). Integration tests with 6.1 (swarm-in-workflow) require 6.1 to be stable.

Stories 6.3 and 6.4 can be developed in parallel. Story 6.1 can start in parallel with 6.3/6.4 but will take longer. Story 6.2 should start after 6.1 has basic orchestration working.

---

## 13. Interworking and Regression

### Packages Impacted by Epic 6

| Package | Impact | Regression Scope |
|---------|--------|------------------|
| **@toon-protocol/core** | New event builders/parsers: workflow (kind:10040), Kind 31117 (Job Review), Kind 30382 (WoT). Reputation scoring module. DVM attestation verification helper. | Core unit tests must pass; TOON roundtrip for existing kinds unaffected |
| **@toon-protocol/sdk** | Workflow orchestration logic, swarm coordination, attestation tag injection in Kind 6xxx builder, `verifyDvmAttestation()` helper, `min_reputation` and `require_attestation` parameter handling | SDK unit tests must pass; existing DVM helpers unchanged |
| **@toon-protocol/town** | kind:10035 extended with `reputation` field, workflow event handling, swarm collection logic | Existing Town lifecycle/health/x402 tests must pass; kind:10035 backward-compatible |
| **@toon-protocol/relay** | No code changes; new event kinds stored like any other | Relay tests unaffected |
| **@toon-protocol/connector** | No code changes; per-step and swarm settlement route through existing ILP mesh | Connector tests unaffected |
| **@toon-protocol/client** | No code changes; E2E tests may gain workflow/swarm scenarios | E2E regression gate |
| **docker/** | Extended SDK E2E compose with Peer3. TEE mock provider configuration. | Docker static analysis tests extended |

### Regression Test Strategy

1. `pnpm -r test` on every PR (catches cross-package regressions from Epic 6 additions)
2. `genesis-bootstrap-with-channels.test.ts` must pass with new event kind handlers registered (nightly)
3. TOON roundtrip regression: existing event kinds (1, 10032, 10033, 10035, 10036, 5xxx, 6xxx, 7000) must still encode/decode correctly after new kinds are added
4. kind:10035 backward compatibility: existing service discovery parsing must still work when `reputation` field is absent
5. Existing DVM lifecycle tests (`docker-dvm-lifecycle-e2e.test.ts`) must pass with no regression
6. Existing TEE attestation tests must pass with no regression (kind:10033 unchanged)

---

## 14. Relationship to Earlier Test Artifacts

This test plan follows the format established by:
- `_bmad-output/planning-artifacts/test-design-epic-5.md` (Epic 5 format template -- direct predecessor)
- `_bmad-output/planning-artifacts/test-design-epic-3.md` (Epic 3 format template)

Key adaptations for Epic 6:

1. **Coordination complexity is the primary risk** (unlike Epic 5's financial settlement focus). The orchestration loop (Story 6.1) and swarm collection (Story 6.2) introduce temporal coordination patterns not present in earlier epics.
2. **Four score-9 risks** (vs Epic 5's zero score-9 risks). This reflects the expanded attack surface: workflow deadlock, attestation spoofing, and sybil attacks all carry severe consequences.
3. **Cross-story integration is structural** (not just additive). Stories 6.1-6.4 are designed to interlock: workflow steps can be swarms (6.1+6.2), results can be attested (6.1/6.2+6.3), and reputation filters influence both (6.2+6.4). This necessitates 8 cross-story integration tests.
4. **Sybil defense is an architectural decision** (not just a test category). The choice of customer-gate for reviews (E6-R013) and on-chain-anchor for WoT (E6-R014) are design decisions that must be made before test implementation.
5. **Timer/timeout infrastructure is new** (required for 6.1 step timeouts and 6.2 swarm collection). The `AttestationVerifier` pattern (injectable `now` parameter) should be reused for deterministic timeout testing.

---

**Generated by:** Jonathan + Claude Opus 4.6
**Date:** 2026-03-17
