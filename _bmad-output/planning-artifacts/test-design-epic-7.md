# Risk-Based Test Plan: Epic 7 - ILP Address Hierarchy & Protocol Economics

**Date:** 2026-03-21
**Author:** Jonathan (with Claude Opus 4.6)
**Status:** Implementation-Ready
**Epic Source:** `_bmad-output/planning-artifacts/epics.md` -- Epic 7
**Predecessors:**
- `_bmad-output/planning-artifacts/test-design-epic-1.md` (Epic 1 SDK test plan)
- `_bmad-output/planning-artifacts/test-design-epic-2.md` (Epic 2 Town test plan)
- `_bmad-output/planning-artifacts/test-design-epic-3.md` (Epic 3 Protocol Economics test plan)
- `_bmad-output/planning-artifacts/test-design-epic-5.md` (Epic 5 DVM Compute Marketplace test plan)
- `_bmad-output/planning-artifacts/test-design-epic-6.md` (Epic 6 Advanced DVM Coordination test plan)

---

## 1. Scope and Context

Epic 7 delivers 7 stories (7.1-7.7) across 3 independent implementation chains, transforming TOON's flat publisher-assigned ILP addressing into a hierarchical, topology-derived model, adding route-aware fee calculation, and adopting a prepaid payment model that unifies all monetized protocol flows (relay write, DVM compute, prefix claim) under a single primitive: message + payment in one ILP packet.

**Decision source:** Party Mode 2026-03-20

**Implementation chains:**
```
Chain A (Address Hierarchy):  7.1 -> 7.2 -> 7.3
Chain B (Fee Infrastructure): 7.4 -> 7.5
Chain C (Prepaid Protocol):   7.6 -> 7.7
```

**Cross-chain dependencies (at integration time):**
```
Chain A (addresses) -----> 7.3 multi-address routing requires fee calculation from Chain B
Chain B (fees) ----------> 7.5 fee calculation uses route topology from Chain A
Chain C (prepaid) -------> 7.6 amount override works independently
                    -----> 7.7 prefix claim uses addresses from Chain A + payment from Chain C
```

**Key design decisions (D7-001 through D7-007):**

- D7-001: Prepaid DVM model -- job request packet IS the payment
- D7-002: Supply-driven marketplace -- providers advertise prices, customers discover and pay
- D7-003: Prefix claim single-packet payment -- claim event IS the payment
- D7-004: Unified protocol payment pattern -- one primitive for all monetized flows
- D7-005: Prefix claims use own event kinds (10032-10099 range), not DVM
- D7-006: Bid tag semantic shift -- "I won't pay more than this" safety cap
- D7-007: `publishEvent()` gains `amount` parameter for price override

**What exists today (post-Epic 6):**

- `@toon-protocol/sdk` with `createNode()`, handler registry, DVM helpers, `settleCompute()`
- `@toon-protocol/town` with `startTown()`, relay subscription API
- Flat ILP addressing (`g.toon.genesis`, `g.toon.peer1`) via hardcoded config
- `basePricePerByte` pricing in `publishEvent()` with no route awareness
- DVM compute settlement via separate `settleCompute()` call
- BTP peering with hardcoded ILP address assignment
- kind:10032 peer info events (without fee or prefix pricing fields)
- kind:10035 skill descriptors (without `pricing` field)
- 2,526 passing tests across monorepo

**What Epic 7 changes:**

- **Story 7.1:** `deriveChildAddress()` utility, 8-char pubkey truncation, root prefix constant
- **Story 7.2:** BTP handshake extension communicating upstream prefix, deterministic address computation
- **Story 7.3:** Multi-address support, multiple ILP addresses in kind:10032, route selection
- **Story 7.4:** `feePerByte` field in kind:10032, default 0
- **Story 7.5:** SDK route-aware fee calculation, automatic intermediary fee summation in `publishEvent()`
- **Story 7.6:** `publishEvent()` with `amount` override, prepaid DVM model, bid safety cap, `settleCompute()` deprecation
- **Story 7.7:** Prefix claim event kind, vanity prefix marketplace, claim/confirm/reject flow

**What this test plan does NOT cover:**

- Epics 1-6 internals (covered by prior test plans)
- Epic 8 (The Rig) -- separate test design
- Real Arbitrum deployment with production USDC
- Performance benchmarking under production load

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
| **E7-R001** | 7.1 | SEC | **Address collision in deterministic derivation:** Two nodes with pubkeys sharing the same first 8 hex chars peer under the same parent, producing identical ILP addresses. Packets routed to the wrong node. Financial loss possible if payments reach wrong recipient. | 2 | 3 | **6** | Unit test: collision probability analysis with 8-char hex space (16^8 = 4.29B combinations). Birthday paradox threshold test: how many peers under one parent before collision probability exceeds 1%? (~9,292 peers). Integration test: two nodes with 8-char-colliding pubkeys under same parent -> verify explicit error or disambiguation mechanism. |
| **E7-R002** | 7.1 | TECH | **ILP address segment validation failure:** Derived address contains invalid characters (uppercase, special chars, or exceeds segment length limit). Connector rejects the address or routing fails silently. | 2 | 2 | 4 | Unit test: `deriveChildAddress()` with all-lowercase pubkey, mixed-case pubkey (should lowercase), pubkey with non-hex chars (should reject). Validate against ILP address RFC constraints. |
| **E7-R003** | 7.2 | TECH | **BTP handshake prefix communication failure:** Upstream peer's prefix not communicated during handshake. Child node falls back to hardcoded address or fails to compute any address. Node unreachable on network. | 3 | 3 | **9** | Integration test: two nodes peer via BTP -> verify child receives upstream prefix in handshake response -> child computes correct address. Negative test: handshake without prefix field -> child rejects connection with clear error (not silent fallback to hardcoded). |
| **E7-R004** | 7.2 | SEC | **Prefix spoofing in BTP handshake:** Malicious upstream peer claims a prefix it does not own (e.g., claims `g.toon` when it is actually `g.toon.attacker`). Child derives address under spoofed prefix, causing routing confusion. | 2 | 3 | **6** | Unit test: validate that handshake-communicated prefix matches the upstream peer's known ILP address from kind:10032. Integration test: upstream advertises prefix `g.toon.legit` in kind:10032 but sends `g.toon` in handshake -> child detects mismatch and rejects. |
| **E7-R005** | 7.2 | TECH | **Backward compatibility with hardcoded addresses:** Existing nodes using hardcoded `g.toon.peer1`-style addresses break when peering with upgraded nodes expecting handshake-derived addresses. Mixed-version network instability. | 2 | 2 | 4 | Integration test: upgraded node connects to non-upgraded peer -> graceful fallback or clear error. Document migration path for existing deployments. |
| **E7-R006** | 7.3 | TECH | **Multi-address routing ambiguity:** Node has addresses `g.toon.useast.{pk8}` and `g.toon.euwest.{pk8}`. Sender picks one address but the route through the other is cheaper or the chosen route is down. No fallback mechanism. | 2 | 2 | 4 | Integration test: node with 2 upstream peers -> sender routes via address A -> path is down -> verify behavior (fail with error, or automatic fallback to address B). Unit test: route selection logic picks optimal path based on fee sum. |
| **E7-R007** | 7.3 | DATA | **kind:10032 multi-address event structure corruption:** Multiple ILP addresses in a single kind:10032 event corrupted through TOON encode/decode. One or more addresses lost or mangled. Node becomes partially unreachable. | 2 | 2 | 4 | Roundtrip test: kind:10032 with `ilpAddresses: ['g.toon.useast.abcd1234', 'g.toon.euwest.abcd1234']` -> TOON encode -> decode -> both addresses preserved. Edge: single address, 3+ addresses, empty array. |
| **E7-R008** | 7.4 | DATA | **Fee advertisement inconsistency:** Node advertises `feePerByte: 2` in kind:10032 but actually charges `feePerByte: 5`. Sender underpays intermediary -> ILP REJECT midway through route. Payment stuck or customer overcharged. | 2 | 3 | **6** | Integration test: intermediary advertises fee X in kind:10032 -> sender calculates total with fee X -> intermediary actually deducts fee X from PREPARE amount -> verify destination receives correct write fee. Negative: intermediary charges more than advertised -> PREPARE amount insufficient -> ILP REJECT at intermediary. |
| **E7-R009** | 7.5 | BUS | **Fee calculation drift across multi-hop routes:** Route table is stale -- intermediary changed fee since last kind:10032 update. Sender computes amount based on old fees, packet rejected at intermediary that raised its fee. | 3 | 2 | **6** | Integration test: intermediary advertises `feePerByte: 2` -> sender caches route -> intermediary updates to `feePerByte: 5` -> sender sends with old fee -> verify behavior (ILP REJECT with updated fee info, or sender re-fetches). Unit test: fee calculator with stale route entry -> expected amount calculation. |
| **E7-R010** | 7.5 | TECH | **Fee calculation overflow with large packets:** Fee summation across many hops with large packets could overflow BigInt boundaries or produce incorrect amounts. `amount = basePricePerByte * toonBytes.length + hop1Fee * bytes + hop2Fee * bytes + ...` with very large byte counts. | 1 | 3 | 3 | Unit test: fee calculation with max realistic packet size (64KB TOON), 10 hops, max fee per byte (1000n) -> verify no overflow. Edge: zero-length packet, single-byte packet, zero-fee hops. |
| **E7-R011** | 7.5 | TECH | **Route discovery failure for fee calculation:** SDK cannot determine the route path (no kind:10032 events from intermediaries). Fee calculation falls back to... what? Zero fees (underpay risk) or error (blocks publish)? | 2 | 2 | 4 | Unit test: fee calculator with unknown intermediaries -> behavior is defined (default to 0 fee for unknown hops? error? configurable?). Integration test: publish to destination through unknown intermediary -> verify SDK behavior. |
| **E7-R012** | 7.6 | SEC | **Prepaid amount validation bypass:** Provider handler does not check `ctx.amount >= advertisedPrice`. Customer sends 1 unit, gets full compute service. Provider suffers economic loss. | 2 | 3 | **6** | Unit test: handler receives `ctx.amount < advertisedPrice` -> rejects. Handler receives `ctx.amount >= advertisedPrice` -> accepts. Integration test: prepaid DVM job with insufficient amount -> ILP REJECT, no compute performed. |
| **E7-R013** | 7.6 | BUS | **Bid safety cap interaction with route fees:** Customer bids 50000, provider advertises 50000, but route has 5000 in intermediary fees. Total ILP PREPARE = 55000 > bid. SDK refuses to send even though provider price equals bid. Confusing UX. | 2 | 2 | 4 | Unit test: bid validation compares against provider's advertised price (not total amount including route fees). Verify: `bid >= advertisedPrice` is the check, not `bid >= totalAmount`. Document: bid is a cap on the destination amount, not the total packet amount. |
| **E7-R014** | 7.6 | TECH | **settleCompute() deprecation backward compatibility:** Existing DVM providers using `settleCompute()` break when upgraded customers stop calling it. Migration window unclear. | 1 | 2 | 2 | Unit test: `settleCompute()` still functions but logs deprecation warning. Integration test: mixed-mode -- old provider expects `settleCompute()`, new customer uses prepaid -> verify protocol-level compatibility or clear error. |
| **E7-R015** | 7.6 | DATA | **Amount tag semantic confusion:** Kind 6xxx result `amount` tag shifts from "invoice" to "informational metadata." Consumers parsing `amount` as a payment instruction send duplicate payments (once prepaid, once from amount tag). | 1 | 3 | 3 | Unit test: Kind 6xxx builder documents `amount` tag as informational. SDK `publishResult()` includes `amount` tag for audit trail but no code path triggers payment from it. |
| **E7-R016** | 7.7 | SEC | **Prefix claim race condition:** Two nodes simultaneously claim the same prefix. Both packets arrive at upstream handler concurrently. Both pass "prefix available" check, both granted the same prefix. Routing conflict. | 3 | 3 | **9** | Unit test: handler uses atomic check-and-claim (lock or CAS). Integration test: two simultaneous prefix claim events for `useast` -> exactly one succeeds, other gets `PREFIX_TAKEN` error. Verify no money moves for the rejected claim. |
| **E7-R017** | 7.7 | SEC | **Prefix claim payment without grant:** ILP PREPARE for prefix claim is fulfilled (payment transferred) but prefix grant event never published (handler crashes between payment acceptance and grant publication). Customer loses money, no prefix. | 2 | 3 | **6** | Integration test: simulate handler crash after `ctx.accept()` but before grant event publication -> verify recovery mechanism (prefix claim is idempotent on retry, or payment is refundable, or claim + grant are atomic). |
| **E7-R018** | 7.7 | TECH | **Prefix expiry and reclaim dynamics:** Claimed prefix expires (node disconnects, lease expires). Another node claims the same prefix. Original node reconnects expecting its old prefix. Routing ambiguity during transition. | 2 | 2 | 4 | Unit test: prefix claim has configurable TTL. Integration test: prefix expires -> claim available again -> new node claims -> original node detects loss. Design decision needed: are prefixes permanent or leased? |
| **E7-R019** | 7.7 | BUS | **Prefix pricing manipulation:** Upstream changes prefix pricing after customer has discovered the price but before the claim packet arrives. Customer's PREPARE amount based on old price is rejected. | 2 | 2 | 4 | Integration test: customer reads `prefixPricing.basePrice = 1000000` -> upstream updates to 2000000 -> customer sends claim with 1000000 -> rejected with updated price info. Verify no money moves. |
| **E7-R020** | Cross | TECH | **Chain A + B integration: fee calculation requires address hierarchy.** Fee calculation in Story 7.5 depends on route topology from Story 7.1-7.3. If addresses are not yet hierarchical, fee calculation has no route path to sum fees along. | 2 | 2 | 4 | Integration test: hierarchical addresses assigned (Chain A) -> fee-per-byte advertised (Chain B) -> `publishEvent()` sums fees correctly using derived route path. Verify both chains must be complete before fee calculation works. |
| **E7-R021** | Cross | TECH | **Chain A + C integration: prefix claim requires derived addressing.** Prefix claim (Story 7.7) replaces the pubkey-derived address from Story 7.1. The replacement must update kind:10032, re-announce to peers, and update routing tables atomically. | 2 | 3 | **6** | Integration test: node has derived address `g.toon.abcd1234` -> claims prefix `useast` -> address becomes `g.toon.useast` -> kind:10032 updated -> peers route to new address -> old address still works during transition (or explicit cut-over). |
| **E7-R022** | Cross | BUS | **Unified payment pattern consistency.** D7-004 mandates the same payment primitive for relay write, DVM compute, and prefix claim. If the `amount` override mechanism in `publishEvent()` has edge cases specific to one use case, the "one primitive" thesis breaks. | 2 | 2 | 4 | Integration test: `publishEvent()` with `amount` override used for (1) relay write (default, no override), (2) DVM compute (override to provider price), (3) prefix claim (override to prefix price). Verify same code path handles all three. |

### High-Priority Risks (Score >= 6) -- Ordered by Score

| Rank | Risk ID | Score | Story | Summary |
|------|---------|-------|-------|---------|
| 1 | E7-R003 | **9** | 7.2 | BTP handshake prefix communication failure -- node unreachable |
| 2 | E7-R016 | **9** | 7.7 | Prefix claim race condition -- duplicate prefix grants |
| 3 | E7-R001 | **6** | 7.1 | Address collision in 8-char truncated pubkey space |
| 4 | E7-R004 | **6** | 7.2 | Prefix spoofing via malicious BTP handshake |
| 5 | E7-R008 | **6** | 7.4 | Fee advertisement vs actual fee inconsistency |
| 6 | E7-R009 | **6** | 7.5 | Fee calculation drift from stale route table |
| 7 | E7-R012 | **6** | 7.6 | Prepaid amount validation bypass |
| 8 | E7-R017 | **6** | 7.7 | Prefix claim payment without grant (crash between accept and publish) |
| 9 | E7-R021 | **6** | Cross | Prefix claim to address replacement atomicity |

**Analysis:** Epic 7 has 9 high-priority risks and 2 score-9 risks. The BTP handshake failure (E7-R003) is the single most impactful risk because it blocks the entire address hierarchy -- if nodes cannot learn their upstream prefix, deterministic addressing fails completely. The prefix claim race condition (E7-R016) is the most likely score-9 risk because concurrent ILP packets to the same handler are a realistic production scenario. Story 7.7 carries the most concentrated risk (E7-R016/R017/R018/R019) making it the riskiest story in the epic.

### Inherited System-Level Risks

| Risk ID (System) | Score | Epic 7 Relevance |
|-------------------|-------|-------------------|
| R-001 (TOON pipeline ordering) | 9 | Prefix claim events (new kind in 10032-10099 range), updated kind:10032 with new fields (`feePerByte`, `ilpAddresses`, `prefixPricing`), and `amount`-overridden packets all flow through the SDK pipeline. The invariant (shallow parse -> verify -> price -> dispatch) must hold. |
| R-005 (Payment channel state integrity) | 6 | Prepaid DVM model changes when payment occurs (prepaid vs post-hoc settlement). Channel state must handle the `amount` override without double-charging. `settleCompute()` deprecation must not break existing channel flows. |
| E5-R001 (TOON encoding corruption of tags) | 6 | New fields in kind:10032 (`feePerByte`, `ilpAddresses` array, `prefixPricing`), `pricing` field in kind:10035, and prefix claim event tags all require TOON roundtrip validation. |
| E6-R008 (Double payment) | 6 | Prepaid model means payment occurs on the request packet. If the request is retransmitted (ILP retry), the provider could receive double payment. Idempotency guards must extend to prepaid flows. |

---

## 3. Critical Integration Boundaries Between Stories

### 3.1 The BTP Address Assignment Flow (E7-R003, E7-R004 -- Score 6-9)

The most critical integration boundary in Epic 7 is the BTP handshake address assignment:

```
Child node initiates BTP connection to upstream peer
  -> BTP handshake message includes upstream peer's prefix
    -> Child receives prefix in handshake response
      -> Child calls deriveChildAddress(upstreamPrefix, ownPubkey)
        -> Child's ILP address = ${upstreamPrefix}.${ownPubkey.slice(0, 8)}
          -> Child publishes kind:10032 with new address
            -> Network peers update routing tables
```

**Why this is the highest-risk integration boundary:**

- **Handshake failure (E7-R003, score 9):** If the prefix is not communicated, the entire address hierarchy collapses. This is a prerequisite for every other story in Chain A and for prefix claims in Chain C.
- **Prefix spoofing (E7-R004, score 6):** A malicious upstream peer could claim any prefix, causing the child to derive an address under the wrong subtree. Cross-validation against kind:10032 advertisements is essential.
- **Backward compatibility (E7-R005):** Mixed-version networks must handle the transition from hardcoded to handshake-derived addresses without network partitioning.

**Integration boundary tests:**

1. **Happy path:** Child connects to upstream -> receives prefix `g.toon.useast` -> derives address `g.toon.useast.{pk8}` -> publishes kind:10032 -> peers route to new address
2. **Prefix absent in handshake:** Upstream sends handshake without prefix field -> child rejects connection (not silent fallback)
3. **Prefix mismatch:** Upstream's kind:10032 shows `g.toon.useast` but handshake claims `g.toon` -> child rejects with mismatch error
4. **Root prefix (genesis):** Genesis node starts with `g.toon` as root prefix constant -> no handshake needed -> publishes kind:10032 with root address

### 3.2 The Fee Calculation Pipeline (E7-R008, E7-R009 -- Score 6)

```
Sender wants to publish to g.toon.euwest.relay42
  -> SDK resolves route: sender -> hop1 (feePerByte: 2) -> hop2 (feePerByte: 3) -> destination
    -> SDK computes: amount = (basePricePerByte * bytes) + (2 * bytes) + (3 * bytes)
      -> ILP PREPARE sent with computed amount
        -> hop1 deducts its fee (2 * bytes), forwards remaining
          -> hop2 deducts its fee (3 * bytes), forwards remaining
            -> destination receives basePricePerByte * bytes (the write fee)
```

**Why fee calculation is the trickiest integration boundary:**

- **Advertised vs actual fee (E7-R008, score 6):** If any intermediary charges more than advertised, the PREPARE amount is insufficient at that hop and the packet is rejected. The sender has no way to know which hop failed.
- **Stale route data (E7-R009, score 6):** kind:10032 events are replaceable, but there is no notification mechanism when fees change. The sender's cached route table may be arbitrarily stale.
- **Route topology dependency (E7-R020):** Fee calculation requires knowing the route path, which requires the address hierarchy from Chain A. These two chains must integrate.

**Integration boundary tests:**

1. **Happy path:** 2-hop route with known fees -> SDK computes correct total -> destination receives exact write fee
2. **Direct route (no intermediaries):** Single-hop publish -> amount = basePricePerByte * bytes (unchanged from current)
3. **Fee change mid-session:** Intermediary updates feePerByte after sender cached route -> sender's packet rejected -> sender re-fetches route -> retries successfully
4. **Zero-fee intermediary:** Hop with `feePerByte: 0` in the middle of a route -> correctly adds 0 to total

### 3.3 The Prepaid DVM Payment Flow (E7-R012 -- Score 6)

```
Customer discovers provider's pricing via kind:10035
  -> SkillDescriptor.pricing['5100'] = '50000'
    -> Customer creates Kind 5100 job request
      -> publishEvent(event, { destination: providerAddr, amount: 50000n })
        -> ILP PREPARE amount = 50000 (not basePricePerByte * bytes)
          -> Provider handler receives ctx.amount = 50000
            -> Handler validates: ctx.amount >= advertisedPrice
              -> Job processed, result returned via ctx.accept(resultData)
```

**Why this is a critical boundary:**

- **Amount validation (E7-R012, score 6):** If the provider does not validate `ctx.amount`, underpaying customers receive free compute. This is an SDK-level enforcement gap (providers must implement their own check).
- **Bid safety cap (D7-006):** The `bid` tag shifts from "I offer this" to "I won't pay more than this." SDK must refuse to send if `advertisedPrice > bid`, but this check is client-side only.
- **Route fees on top of prepaid amount (E7-R013):** The `amount` parameter specifies the destination amount. Route fees are added on top by the SDK. The bid safety cap must compare against the destination amount, not the total.

**Integration boundary tests:**

1. **Happy path:** Customer discovers price 50000 -> sends prepaid job -> provider validates amount -> processes job -> returns result
2. **Underpayment rejection:** Customer sends amount < advertisedPrice -> provider handler rejects -> ILP REJECT, no compute
3. **Overpayment acceptance:** Customer sends amount > advertisedPrice -> provider accepts (overpayment is a tip)
4. **Bid safety cap:** Provider price 50000, customer bid 40000 -> SDK refuses to send before any ILP packet
5. **Route fees additive:** Provider price 50000, route fees 5000 -> total ILP PREPARE = 55000 -> bid check compares 50000 (destination) against bid, not 55000

### 3.4 The Prefix Claim Flow (E7-R016, E7-R017 -- Score 6-9)

```
Node at g.toon.abcd1234 wants vanity prefix 'useast'
  -> Reads upstream's kind:10032: prefixPricing.basePrice = 1000000
    -> Creates prefix claim event (new kind in 10032-10099 range)
      -> publishEvent(claimEvent, { destination: upstream, amount: 1000000n })
        -> Upstream handler receives claim:
          1. Validates prefix 'useast' is available (not already claimed)
          2. Validates ctx.amount >= prefixPricing.basePrice
          3. Registers prefix claim atomically
          4. Publishes confirmation event granting the prefix
        -> Node's address becomes g.toon.useast
          -> Node republishes kind:10032 with new address
            -> Child nodes re-derive addresses under g.toon.useast.*
```

**Why this is the riskiest story (3 high-priority risks):**

- **Race condition (E7-R016, score 9):** Concurrent claims for the same prefix MUST be serialized. Without atomic check-and-claim, two nodes could both receive the same prefix.
- **Payment without grant (E7-R017, score 6):** The claim handler must ensure that payment acceptance (ILP FULFILL) and prefix grant publication are atomic. A crash between the two leaves the customer out of money with no prefix.
- **Address replacement cascade (E7-R021, score 6):** When a prefix replaces a pubkey-derived address, all downstream routing must update: kind:10032 republication, child re-derivation, peer routing table updates.

**Integration boundary tests:**

1. **Happy path:** Claim `useast` -> payment accepted -> prefix granted -> address updated -> kind:10032 republished
2. **Race condition:** Two simultaneous claims for `useast` -> exactly one succeeds -> other gets PREFIX_TAKEN -> rejected claim's payment not transferred
3. **Insufficient payment:** Claim with amount < basePrice -> rejected -> no money moves
4. **Already claimed:** Claim a prefix that another node owns -> PREFIX_TAKEN error
5. **Address cascade:** Claim prefix -> child nodes re-derive addresses under new prefix -> peers route to both old and new addresses during transition

### 3.5 Cross-Chain Integration Boundaries

| Boundary | Chains | Risk | Test Scenario |
|----------|--------|------|---------------|
| Address hierarchy + fee calculation | A + B | E7-R020 (4) | Hierarchical addresses established -> fee-per-byte discovered via kind:10032 -> SDK sums fees along derived route path |
| Prefix claim + address hierarchy | A + C | E7-R021 (6) | Node claims vanity prefix -> address changes from pubkey-derived to vanity -> child addresses re-derive under new prefix |
| Fee calculation + prepaid DVM | B + C | E7-R013 (4) | Prepaid amount (provider price) + route fees (intermediary sum) composed correctly. Bid check uses destination amount only. |
| All three chains: prefix claim with fees and prepaid | A + B + C | E7-R022 (4) | Prefix claim event uses `amount` override (Chain C), routes through fee-charging intermediaries (Chain B), to upstream peer at hierarchical address (Chain A) |
| Unified payment pattern | All | E7-R022 (4) | `publishEvent()` with `amount` override handles relay write (no override), DVM compute (provider price), and prefix claim (prefix price) through the same code path |

---

## 4. Test Strategy Per Story

### Legend

- **U** = Unit test (isolated, mocked dependencies)
- **I** = Integration test (multiple real modules wired together, Docker containers for ILP/relay/EVM)
- **E2E** = End-to-end test (requires genesis infrastructure or multi-node setup)
- **Real crypto** = Uses real nostr-tools/noble-curves signing, no mocked crypto

### Story 7.1: Deterministic Address Derivation

**Risk profile:** 1 high (E7-R001, score 6), 1 medium (E7-R002). Foundation story -- correctness here gates all subsequent address hierarchy stories.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-7.1-01 | `deriveChildAddress('g.toon', 'abcd1234efgh5678...')` returns `g.toon.abcd1234` (first 8 hex chars of pubkey) | U | -- | P0 |
| T-7.1-02 | `deriveChildAddress('g.toon.ef567890', '11aabb22...')` returns `g.toon.ef567890.11aabb22` (nested derivation) | U | -- | P0 |
| T-7.1-03 | Root prefix `g.toon` is a protocol constant, returned by a utility function, not derived from any pubkey | U | -- | P0 |
| T-7.1-04 | ILP address segment validation: derived address contains only lowercase hex chars in the child segment, no uppercase, no special chars | U | E7-R002 | P0 |
| T-7.1-05 | Pubkey with uppercase hex chars: `deriveChildAddress('g.toon', 'ABCD1234...')` lowercases to `g.toon.abcd1234` | U | E7-R002 | P0 |
| T-7.1-06 | Address collision detection: two pubkeys `abcd1234aaaa...` and `abcd1234bbbb...` under same parent -> same derived address `g.toon.abcd1234` -> utility function or caller detects collision | U | E7-R001 | P0 |
| T-7.1-07 | Birthday paradox analysis: document collision probability at various peer counts (100, 1000, 10000 peers under one parent). At 8 hex chars (4.29B space), P(collision) < 0.001% for < 3000 peers. | U | E7-R001 | P1 |
| T-7.1-08 | `deriveChildAddress()` rejects empty parent prefix | U | -- | P1 |
| T-7.1-09 | `deriveChildAddress()` rejects pubkey shorter than 8 hex chars | U | -- | P1 |
| T-7.1-10 | `deriveChildAddress()` rejects pubkey with non-hex characters | U | E7-R002 | P1 |
| T-7.1-11 | Determinism: same inputs always produce same output (no randomness) | U | -- | P1 |
| T-7.1-12 | ILP address valid per connector rules: total address length within limits, segments separated by dots, each segment non-empty | U | E7-R002 | P2 |

**Notes:**

- T-7.1-06 is the key collision detection test. The design must decide whether collision detection happens in `deriveChildAddress()` (requires knowing existing peers) or in the caller (BTP handshake handler). Either way, the behavior must be defined and tested.
- T-7.1-07 is an analytical test documenting the collision probability. At 8 hex chars, the address space is 4.29 billion, and by the birthday paradox, collision probability exceeds 1% only at ~9,292 peers under the same parent. This is sufficient for any realistic deployment.

### Story 7.2: BTP Address Assignment Handshake

**Risk profile:** 1 critical (E7-R003, score 9), 1 high (E7-R004, score 6), 1 medium (E7-R005). This is the highest-risk story by severity because handshake failure blocks the entire address hierarchy.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-7.2-01 | BTP handshake response includes upstream peer's prefix in a new field (e.g., `prefix` or `ilpPrefix`) | U | E7-R003 | P0 |
| T-7.2-02 | Child node receives prefix in handshake -> computes address as `${prefix}.${ownPubkey.slice(0, 8)}` -> stores as own ILP address | I | E7-R003 | P0 |
| T-7.2-03 | Child node publishes kind:10032 with handshake-derived address (not hardcoded) | I | E7-R003 | P0 |
| T-7.2-04 | Genesis node uses root prefix `g.toon` without any handshake (protocol constant) | U | -- | P0 |
| T-7.2-05 | Handshake without prefix field -> child node rejects connection with explicit error, does NOT fall back to hardcoded address | I | E7-R003 | P0 |
| T-7.2-06 | Prefix from handshake cross-validated against upstream's kind:10032 advertisement -> mismatch detected | I | E7-R004 | P0 |
| T-7.2-07 | BTP handshake message parsing: prefix field extracted correctly from handshake protocol data | U | E7-R003 | P1 |
| T-7.2-08 | Previously hardcoded node (e.g., `g.toon.peer1`) now derives address from handshake -> old hardcoded config ignored | I | E7-R005 | P1 |
| T-7.2-09 | Multiple sequential BTP connections to same upstream -> same derived address each time (deterministic) | U | -- | P1 |
| T-7.2-10 | Upstream peer's prefix change (e.g., after claiming vanity prefix) -> child reconnects -> derives new address from new prefix | I | -- | P2 |
| T-7.2-11 | Two nodes peer via BTP E2E: child computes address from parent's prefix, publishes kind:10032, packets route to new address | E2E | E7-R003 | P3 |

**Notes:**

- T-7.2-02 and T-7.2-05 together define the "fail-closed" behavior: if the prefix is not received, the node does not silently use a hardcoded address. This prevents mixed-version confusion where some nodes have derived addresses and others have legacy addresses.
- T-7.2-06 addresses prefix spoofing (E7-R004). The cross-validation requires that the child has already discovered the upstream's kind:10032 event (via relay subscription or bootstrap). If the child has not yet discovered the upstream's kind:10032, the cross-validation should be deferred (not skipped).

### Story 7.3: Multi-Address Support for Multi-Peered Nodes

**Risk profile:** 2 medium (E7-R006, E7-R007). Lower risk story -- data structure extension, not new protocol mechanics.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-7.3-01 | kind:10032 event with `ilpAddresses` array: `['g.toon.useast.{pk8}', 'g.toon.euwest.{pk8}']` -> TOON encode -> decode roundtrip preserves both addresses | U | E7-R007 | P0 |
| T-7.3-02 | Node peered with two upstream peers -> publishes kind:10032 with two addresses (one per peering) | I | -- | P0 |
| T-7.3-03 | Client resolves destination by Nostr pubkey -> destination has multiple ILP addresses -> client can select from available addresses | U | E7-R006 | P0 |
| T-7.3-04 | kind:10032 with single address -> backward compatible with existing consumers (single address = array of 1) | U | -- | P1 |
| T-7.3-05 | Route selection: client picks address with lowest total fee (using fee info from kind:10032 of intermediaries) | U | E7-R006 | P1 |
| T-7.3-06 | kind:10032 with 3+ addresses -> all preserved through TOON roundtrip | U | E7-R007 | P1 |
| T-7.3-07 | Empty `ilpAddresses` array -> construction error (node must have at least one address) | U | -- | P2 |
| T-7.3-08 | Node disconnects from one upstream peer -> republishes kind:10032 with remaining addresses only | I | -- | P2 |
| T-7.3-09 | Multi-peered node E2E: node with 2 upstream peers, both addresses routable, sender uses each path successfully | E2E | E7-R006 | P3 |

**Notes:**

- T-7.3-01 is the gating data integrity test. If the `ilpAddresses` array is corrupted through TOON, multi-address routing is broken.
- T-7.3-05 is a design validation test: the route selection algorithm needs to be defined. Options include lowest-fee, lowest-latency, or random. The test validates whatever strategy is chosen.

### Story 7.4: Fee-Per-Byte Advertisement in kind:10032

**Risk profile:** 1 high (E7-R008, score 6). Straightforward data field addition, but the risk is in the semantic contract between advertised and actual fees.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-7.4-01 | kind:10032 event builder includes `feePerByte` field (BigInt-as-string in TOON) | U | -- | P0 |
| T-7.4-02 | kind:10032 with `feePerByte: '2'` -> TOON encode -> decode -> `feePerByte` preserved as `'2'` | U | E5-R001 | P0 |
| T-7.4-03 | Default `feePerByte` when not configured: `'0'` (free routing) | U | -- | P0 |
| T-7.4-04 | Peer discovers `feePerByte` via kind:10032 subscription -> extracts fee for route calculation | I | E7-R008 | P0 |
| T-7.4-05 | `feePerByte` validation: non-negative BigInt string. Negative fees rejected at construction. | U | -- | P1 |
| T-7.4-06 | `feePerByte` coexists with existing kind:10032 fields (`btpEndpoint`, `capabilities`, `ilpAddresses`) without breaking backward compatibility | U | -- | P1 |
| T-7.4-07 | kind:10032 from pre-Epic-7 node (no `feePerByte` field) -> consumer defaults to `feePerByte: '0'` | U | -- | P1 |
| T-7.4-08 | Large `feePerByte` value (e.g., `'999999999999'`) -> preserved through TOON roundtrip without truncation | U | -- | P2 |

**Notes:**

- T-7.4-07 is the backward compatibility test. Existing kind:10032 events from pre-Epic-7 nodes will not have `feePerByte`. Consumers must default to 0 rather than erroring.

### Story 7.5: SDK Route-Aware Fee Calculation

**Risk profile:** 1 high (E7-R009, score 6), 2 medium (E7-R010, E7-R011). The fee calculation logic is SDK-internal -- invisible to users but critical for correct payment amounts.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-7.5-01 | Fee calculator: single-hop (direct) -> `amount = basePricePerByte * toonBytes.length` (unchanged from current) | U | -- | P0 |
| T-7.5-02 | Fee calculator: 2-hop route with fees [2, 3] -> `amount = (basePricePerByte * bytes) + (2n * bytes) + (3n * bytes)` | U | -- | P0 |
| T-7.5-03 | Fee calculator: 3-hop route with fees [0, 5, 1] -> zero-fee hop contributes 0 to total | U | -- | P0 |
| T-7.5-04 | `publishEvent(event)` with no `amount` override -> SDK computes fee-inclusive amount internally -> user sees no fee parameters | I | -- | P0 |
| T-7.5-05 | Stale route table: intermediary changes fee after sender cached route -> sender's packet rejected at intermediary | I | E7-R009 | P0 |
| T-7.5-06 | Fee calculator with mock route table: route table maps ILP address to fee-per-byte -> calculator sums fees for each hop in the path | U | E7-R009 | P0 |
| T-7.5-07 | Unknown intermediary in route (no kind:10032 data) -> defined behavior (error, or default to 0 fee with logging) | U | E7-R011 | P1 |
| T-7.5-08 | Large packet fee calculation: 64KB packet, 10 hops, max fee 1000n per byte -> no overflow, correct total | U | E7-R010 | P1 |
| T-7.5-09 | Zero-byte packet (edge case): total amount = 0 regardless of fees | U | E7-R010 | P1 |
| T-7.5-10 | Route table update: intermediary publishes new kind:10032 with updated fee -> route table reflects new fee for subsequent calculations | I | E7-R009 | P1 |
| T-7.5-11 | Multi-hop publish with fee-charging intermediaries: destination receives correct write fee (total minus intermediary fees) | I | E7-R008 | P1 |
| T-7.5-12 | Fee calculation E2E: publish through Docker infra with 2 intermediary peers, each with feePerByte > 0, verify destination receives basePricePerByte * bytes | E2E | E7-R008, E7-R009 | P3 |

**Notes:**

- T-7.5-04 validates the key UX invariant: fee calculation is completely invisible to the SDK user. The user calls `publishEvent(event)` and the SDK handles everything.
- T-7.5-05 is the stale route test. The SDK should handle this gracefully -- either by re-fetching routes on ILP REJECT and retrying, or by returning a clear error to the user.

### Story 7.6: Prepaid DVM Model and settleCompute() Deprecation

**Risk profile:** 1 high (E7-R012, score 6), 3 medium (E7-R013, E7-R014, E7-R015). Core protocol economics change -- the payment model shifts from post-hoc settlement to prepaid.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-7.6-01 | `publishEvent(event, { amount: 50000n })` sends ILP PREPARE with amount 50000, not `basePricePerByte * bytes` | U | -- | P0 |
| T-7.6-02 | Provider handler validates `ctx.amount >= advertisedPrice` -> accepts when sufficient, rejects when insufficient | U | E7-R012 | P0 |
| T-7.6-03 | Provider handler rejects underpayment: `ctx.amount = 10000` when `advertisedPrice = 50000` -> ILP REJECT, no compute | I | E7-R012 | P0 |
| T-7.6-04 | Bid safety cap: `advertisedPrice = 50000`, `bid = 40000` -> SDK refuses to send (client-side check), no ILP packet created | U | -- | P0 |
| T-7.6-05 | Bid safety cap pass: `advertisedPrice = 50000`, `bid = 60000` -> SDK sends with amount = 50000 (provider price, not bid) | U | -- | P0 |
| T-7.6-06 | `publishEvent()` without `amount` option -> default behavior (basePricePerByte * bytes) unchanged for relay write | U | -- | P0 |
| T-7.6-07 | Kind 5xxx with `bid: '60000'` tag: bid tag is informational safety cap, not the amount sent | U | -- | P0 |
| T-7.6-08 | `settleCompute()` deprecated: method still works but logs deprecation warning via JSDoc `@deprecated` | U | E7-R014 | P1 |
| T-7.6-09 | Kind 6xxx result `amount` tag is informational: no payment triggered by parsing this tag | U | E7-R015 | P1 |
| T-7.6-10 | Prepaid DVM with route fees: provider price 50000, route fees 5000 -> total ILP PREPARE = 55000, bid check uses 50000 (destination amount) | U | E7-R013 | P1 |
| T-7.6-11 | Provider overpayment acceptance: `ctx.amount = 70000` when `advertisedPrice = 50000` -> provider accepts (overpayment = tip) | U | -- | P1 |
| T-7.6-12 | `SkillDescriptor.pricing` field in kind:10035: `pricing: { '5100': '50000' }` preserved through TOON roundtrip | U | E5-R001 | P0 |
| T-7.6-13 | Prepaid DVM with no bid tag: customer does not set bid -> no bid safety cap applied -> amount = advertisedPrice sent | U | -- | P2 |
| T-7.6-14 | Prepaid DVM idempotency: duplicate ILP PREPARE for same job request -> provider detects duplicate (same event ID) -> second packet rejected | U | E6-R008 | P1 |
| T-7.6-15 | Full prepaid DVM flow E2E: customer discovers provider pricing in kind:10035 -> sends job + payment in one packet -> provider processes -> returns result -> no settleCompute() call needed | E2E | E7-R012 | P3 |
| T-7.6-16 | Backward compat: `settleCompute()` still works for existing providers -> logs deprecation but completes settlement | I | E7-R014 | P2 |

**Notes:**

- T-7.6-01 and T-7.6-06 together validate the `amount` override behavior: when provided, it replaces the default calculation; when absent, existing behavior is preserved.
- T-7.6-04 and T-7.6-05 validate the bid semantic shift (D7-006). The bid is now a safety cap, not an offer. The critical distinction is that `amount = advertisedPrice` always, but the SDK refuses to send if `advertisedPrice > bid`.
- T-7.6-14 addresses the inherited double-payment risk (E6-R008). With prepaid, the request packet IS the payment, so duplicate requests mean duplicate payments. Event ID-based idempotency is essential.

### Story 7.7: Prefix Claim Kind and Marketplace

**Risk profile:** 1 critical (E7-R016, score 9), 1 high (E7-R017, score 6), 2 medium (E7-R018, E7-R019). The riskiest story in the epic due to concurrency and atomicity challenges.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-7.7-01 | Prefix claim event (new kind in 10032-10099 range): `{ requestedPrefix: 'useast' }` -> TOON encode -> decode roundtrip preserves prefix | U | E5-R001 | P0 |
| T-7.7-02 | Prefix claim handler validates: prefix available AND `ctx.amount >= prefixPricing.basePrice` -> grants prefix | U | E7-R016, E7-R012 | P0 |
| T-7.7-03 | Prefix already claimed: handler returns ILP REJECT with `PREFIX_TAKEN` error code -> payment not transferred | U | E7-R016 | P0 |
| T-7.7-04 | Insufficient payment: `ctx.amount < prefixPricing.basePrice` -> ILP REJECT -> no prefix granted, no money moves | U | E7-R012 | P0 |
| T-7.7-05 | **Race condition defense:** Two simultaneous claims for `useast` -> handler serializes via atomic check-and-claim -> exactly one succeeds | I | E7-R016 | P0 |
| T-7.7-06 | Prefix claim confirmation event: upstream publishes confirmation granting the prefix to the requesting pubkey | U | -- | P0 |
| T-7.7-07 | Claimed prefix replaces pubkey-derived address: node was `g.toon.abcd1234`, claims `useast`, becomes `g.toon.useast` | I | E7-R021 | P0 |
| T-7.7-08 | Child addresses re-derive under vanity prefix: child was `g.toon.abcd1234.11aabb22`, now `g.toon.useast.11aabb22` | I | E7-R021 | P1 |
| T-7.7-09 | kind:10032 includes `prefixPricing: { basePrice: '1000000' }` field -> TOON roundtrip preserves pricing | U | E5-R001 | P1 |
| T-7.7-10 | Prefix validation: only lowercase alphanumeric, min 2 chars, max 16 chars, no reserved words (`toon`, `ilp`) | U | -- | P1 |
| T-7.7-11 | Prefix claim uses `publishEvent()` with `amount` override (reuses Story 7.6 mechanism) | U | E7-R022 | P1 |
| T-7.7-12 | Payment-grant atomicity: claim accepted (ILP FULFILL) and grant event published atomically. Verify no state where payment succeeded but prefix not granted. | I | E7-R017 | P0 |
| T-7.7-13 | Prefix pricing update: upstream changes price -> customer reads new price -> pays new price -> claim succeeds | I | E7-R019 | P1 |
| T-7.7-14 | Prefix pricing stale read: customer reads old price, upstream updates price before claim arrives -> claim rejected with current price info | I | E7-R019 | P1 |
| T-7.7-15 | Prefix claim event flows through standard SDK pipeline: shallow parse -> verify -> price -> dispatch | U | Inherited R-001 | P1 |
| T-7.7-16 | Prefix claim handler registered via `.on(PREFIX_CLAIM_KIND, handler)` -> receives claims via standard handler pipeline | U | -- | P2 |
| T-7.7-17 | Full prefix claim E2E: node discovers pricing -> sends claim + payment -> upstream validates -> prefix granted -> address updated -> peers route to new address | E2E | E7-R016, E7-R017 | P3 |

**Notes:**

- T-7.7-05 is the most critical test in the entire epic. The race condition defense must be robust: if the handler uses EventStore to check prefix availability, two concurrent checks could both return "available." The handler needs an atomic operation -- either a database-level unique constraint, a mutex, or a compare-and-swap pattern.
- T-7.7-12 addresses the crash-between-accept-and-grant risk (E7-R017). Possible mitigations: (1) the prefix grant is stored BEFORE `ctx.accept()` is called (so ILP FULFILL is only sent after grant is persisted), (2) claim processing is idempotent so retries are safe. The test must verify whichever mitigation is chosen.

---

## 5. Cross-Chain Integration Test Scenarios

| ID | Chains | Test | Level | Risk | Priority |
|----|--------|------|-------|------|----------|
| T-INT-01 | A + B | Hierarchical addresses established -> fee-per-byte discovered via kind:10032 -> SDK fee calculator sums fees along derived route path -> correct total amount | I | E7-R020 | P0 |
| T-INT-02 | A + C | Node claims vanity prefix -> pubkey-derived address replaced -> kind:10032 updated with new address -> child nodes re-derive under new prefix | I | E7-R021 | P0 |
| T-INT-03 | B + C | Prepaid DVM job: provider price = 50000, 2-hop route with fees [2, 3] -> total amount = 50000 + (2+3)*bytes -> bid check uses 50000 (destination amount) | I | E7-R013 | P1 |
| T-INT-04 | A + B + C | Prefix claim routes through fee-charging intermediary -> total PREPARE includes prefix price + intermediary fees -> upstream receives full prefix price | I | E7-R022 | P1 |
| T-INT-05 | All | Unified payment pattern: `publishEvent()` with `amount` override exercises same code path for relay write (no override), DVM compute (provider price), and prefix claim (prefix price) | I | E7-R022 | P1 |
| T-INT-06 | A + B | Multi-address node: sender selects address with lowest total fee (using feePerByte from each path's intermediaries) | I | E7-R006 | P2 |
| T-INT-07 | All + Pipeline | New event kinds (prefix claim, updated kind:10032 with feePerByte/ilpAddresses/prefixPricing) traverse full SDK pipeline: shallow parse -> verify -> price -> dispatch | U | Inherited R-001 | P0 |
| T-INT-08 | A + C | Prefix claim confirmation -> node address changes -> existing open ILP channels continue working (or graceful re-establishment) | I | -- | P2 |

---

## 6. Non-Functional Requirements (NFR) Tests

### 6.1 Performance

| ID | Requirement | Test | Priority |
|----|-------------|------|----------|
| NFR-7-PERF-01 | `deriveChildAddress()` executes in < 1ms (simple string concatenation) | Benchmark: 10,000 derivations -> average < 1ms | P2 |
| NFR-7-PERF-02 | Fee calculation for 10-hop route completes in < 5ms | Benchmark: fee calculator with 10-hop mock route table -> measure computation time | P2 |
| NFR-7-PERF-03 | Route table with 1000 entries does not degrade fee calculation | Benchmark: route table lookup + fee sum with 1000 intermediaries cached -> < 10ms | P2 |
| NFR-7-PERF-04 | BTP handshake extension adds < 10ms to connection establishment | Benchmark: handshake with prefix field vs without -> measure delta | P3 |

### 6.2 Security

| ID | Requirement | Test | Priority |
|----|-------------|------|----------|
| NFR-7-SEC-01 | Prefix claim atomicity: no double-grant under concurrent load | T-7.7-05 (covered in story tests). Stress test: 10 concurrent claims for same prefix -> exactly 1 granted. | P0 |
| NFR-7-SEC-02 | Prepaid amount validation: provider MUST reject underpayment | T-7.6-02, T-7.6-03 (covered in story tests). SDK provides helper: `validatePrepaidAmount(ctx, advertisedPrice)` | P0 |
| NFR-7-SEC-03 | Prefix spoofing prevention: handshake prefix cross-validated against kind:10032 | T-7.2-06 (covered in story tests). | P0 |
| NFR-7-SEC-04 | Event signature verification on all new event kinds (prefix claim, updated kind:10032) | T-INT-07 (covered in cross-chain tests). Unsigned events rejected. | P0 |
| NFR-7-SEC-05 | Prepaid DVM idempotency: duplicate request packets do not cause double payment | T-7.6-14 (covered in story tests). | P0 |

### 6.3 Reliability

| ID | Requirement | Test | Priority |
|----|-------------|------|----------|
| NFR-7-REL-01 | Address derivation is deterministic: same inputs always produce same output across restarts | T-7.1-11 (covered in story tests). | P0 |
| NFR-7-REL-02 | Fee calculation produces finite numeric amounts for all valid inputs (no NaN, no overflow) | T-7.5-08, T-7.5-09 (covered in story tests). | P0 |
| NFR-7-REL-03 | Prefix claim rejection does not transfer money: ILP REJECT path must prevent fulfillment | T-7.7-03, T-7.7-04 (covered in story tests). Verify channel balance unchanged after rejection. | P0 |
| NFR-7-REL-04 | BTP handshake failure is recoverable: child can retry connection, receives prefix on retry | Integration test: first handshake fails (network timeout) -> retry succeeds -> address derived correctly | P1 |

---

## 7. Test Infrastructure Requirements

### 7.1 Current Infrastructure (Sufficient for Unit + Most Integration Tests)

| Component | Purpose | Available Today |
|-----------|---------|-----------------|
| Anvil (localhost:8545 or 18545) | EVM settlement for payment channels | Yes (`deploy-genesis-node.sh` or `sdk-e2e-infra.sh`) |
| SDK E2E infra (Peer1/Peer2) | Multi-hop ILP routing, BTP peering | Yes (`scripts/sdk-e2e-infra.sh up`) |
| Vitest | Test framework with mocking | Yes |
| Mock USDC (Anvil) | Token for payment channel operations | Yes (`scripts/deploy-mock-usdc.sh`) |
| Docker containers | Real ILP connectors, relays, BTP | Yes (docker-compose) |

### 7.2 New Infrastructure Required for Epic 7

| Component | Purpose | Stories | Effort |
|-----------|---------|---------|--------|
| **BTP handshake extension** | Modified BTP protocol messages carrying prefix field. Requires changes to `@toon-protocol/connector` BTP implementation. | 7.2 | Medium -- BTP protocol modification in connector package |
| **Route table service** | Maintains a map of ILP addresses to fee-per-byte values, populated from kind:10032 relay subscriptions. Used by fee calculator. | 7.4, 7.5 | Medium -- new service, but follows existing RelayMonitor pattern |
| **Prefix claim store** | Persistent storage for claimed prefixes (who owns what). Could use EventStore (Nostr events) or SQLite table. Must support atomic check-and-claim. | 7.7 | Low -- small data model, but atomicity requirement adds complexity |
| **Fee calculator module** | Pure function: `calculateTotalAmount(destinationFee, routeHops[]) -> BigInt`. No external dependencies. | 7.5 | Low -- pure computation, no infrastructure needed |
| **kind:10032 event builder extension** | Updated builder adding `feePerByte`, `ilpAddresses` array, `prefixPricing` fields. | 7.3, 7.4, 7.7 | Low -- extends existing event builder |
| **kind:10035 `pricing` field** | Updated `SkillDescriptor` builder adding `pricing` map (kind -> price string). | 7.6 | Low -- single field addition |

### 7.3 Docker Infrastructure Notes

The current SDK E2E infrastructure with 2 peers is sufficient for most Epic 7 tests:

```
Current SDK E2E Infrastructure (sufficient):
  Anvil (18545)
  Peer1 (BTP:19000, BLS:19100, Relay:19700) -- upstream/genesis-like
  Peer2 (BTP:19010, BLS:19110, Relay:19710) -- child/downstream
```

Multi-hop fee tests (T-7.5-11, T-7.5-12) ideally need 3 nodes (sender -> intermediary -> destination). Options:

- **Option A:** Add Peer3 to `docker-compose-sdk-e2e.yml` (BTP:19020, BLS:19120, Relay:19720)
- **Option B:** Use existing 2-peer setup with sender as a client on Peer1, routing through Peer1 (intermediary) to Peer2 (destination)

**Recommendation:** Option B for PR-level tests (2 peers sufficient to validate fee deduction at one intermediary). Add Peer3 only for nightly E2E runs requiring 3+ hop routes.

---

## 8. Test Count Summary

| Story | P0 | P1 | P2 | P3 | Total |
|-------|----|----|----|----|-------|
| 7.1 Deterministic Address Derivation | 5 | 4 | 1 | 0 | **12** (incl. collision analysis) |
| 7.2 BTP Address Assignment Handshake | 5 | 3 | 1 | 1 | **11** |
| 7.3 Multi-Address Support | 3 | 3 | 2 | 1 | **9** |
| 7.4 Fee-Per-Byte Advertisement | 4 | 3 | 1 | 0 | **8** |
| 7.5 SDK Route-Aware Fee Calculation | 6 | 4 | 0 | 1 | **12** (incl. stale route handling) |
| 7.6 Prepaid DVM Model | 7 | 4 | 2 | 1 | **16** (incl. deprecation + idempotency) |
| 7.7 Prefix Claim Marketplace | 7 | 5 | 1 | 1 | **17** (highest test count, highest risk) |
| Cross-Chain Integration | 2 | 3 | 2 | 0 | **8** (incl. unified payment pattern) |
| **Total** | **39** | **29** | **10** | **5** | **93** |

### Test Level Distribution

| Level | Count | Notes |
|-------|-------|-------|
| Unit (U) | ~55 | Address derivation, fee calculation, event construction, TOON roundtrips, validation |
| Integration (I) | ~30 | BTP handshake, multi-hop routing, prepaid DVM flow, prefix claim concurrency |
| E2E | ~5 | Full handshake + routing, fee-inclusive publish, prefix claim lifecycle |
| NFR | ~13 | Performance, security, reliability |
| **Grand Total** | **~93 story + 8 cross-chain + 13 NFR = ~114 tests** | |

---

## 9. Execution Strategy

| Trigger | What Runs | Time Budget | Infrastructure |
|---------|-----------|-------------|----------------|
| **Every PR** | All unit tests + integration tests with 2-peer Docker infra (P0-P2) | < 15 min | SDK E2E infra (`sdk-e2e-infra.sh up`), Anvil container |
| **Nightly** | Full suite including E2E + NFR performance tests (P0-P3) | < 30 min | Genesis node + SDK E2E infra (2-3 peers) |

**Philosophy:** Unit tests validate address derivation correctness, fee calculation arithmetic, event construction, and TOON roundtrips. Integration tests validate BTP handshake flows, multi-hop fee deduction, prepaid amount validation, and prefix claim atomicity using real Docker containers. E2E tests validate complete flows from address derivation through fee-inclusive publish to prefix claim lifecycle.

**Implementation order recommendation:**

Chain A (7.1 -> 7.2 -> 7.3) and Chain B (7.4 -> 7.5) can proceed in parallel. Chain C (7.6 -> 7.7) can also proceed in parallel with both, but cross-chain integration tests (Section 5) should run only after all three chains complete.

Suggested implementation sequence:

1. **Sprint 1:** Stories 7.1 + 7.4 + 7.6 (foundations from each chain, no inter-chain dependencies)
2. **Sprint 2:** Stories 7.2 + 7.5 + 7.7 (builds on Sprint 1 foundations)
3. **Sprint 3:** Story 7.3 + cross-chain integration tests (requires all chains)

---

## 10. Mitigation Plans for High-Priority Risks

### E7-R003: BTP Handshake Prefix Communication Failure (Score: 9)

**Mitigation Strategy:**

1. BTP handshake response MUST include a `prefix` field containing the upstream peer's ILP address prefix
2. If the `prefix` field is absent from the handshake response, the child node MUST reject the connection with a clear error (not fall back to any default or hardcoded address)
3. The connector's BTP implementation must be extended to include prefix in the handshake protocol messages
4. Genesis node skips handshake prefix (uses root constant `g.toon`)

**Owner:** Dev
**Timeline:** Story 7.2
**Verification:** T-7.2-01, T-7.2-02, T-7.2-05
**Conditional escalation:** If BTP protocol extension is too invasive, consider a post-handshake prefix exchange message (separate from BTP auth handshake). This would add latency but reduce BTP protocol modification scope.

### E7-R016: Prefix Claim Race Condition (Score: 9)

**Mitigation Strategy:**

1. Prefix claim handler MUST use an atomic check-and-claim operation. Options:
   - SQLite `INSERT OR IGNORE` with unique constraint on `(parentPrefix, claimedPrefix)` -> check affected rows
   - EventStore-backed with a mutex on the prefix claim kind
   - In-memory lock per upstream node (acceptable since each node handles its own prefix claims)
2. The claim validation sequence is: (1) acquire lock, (2) check availability, (3) register claim, (4) release lock, (5) send ILP FULFILL, (6) publish grant event
3. Step 5 (ILP FULFILL) MUST NOT be sent before step 3 (register claim) completes
4. Concurrent claims for the same prefix: first to acquire lock wins, second gets `PREFIX_TAKEN`

**Owner:** Dev
**Timeline:** Story 7.7
**Verification:** T-7.7-05
**Design decision:** Recommend SQLite unique constraint approach -- it is the simplest, most robust, and already used for EventStore. The `INSERT OR IGNORE` pattern gives atomic check-and-claim without explicit locking.

### E7-R001: Address Collision in 8-Char Pubkey Space (Score: 6)

**Mitigation Strategy:**

1. Document the collision probability: 8 hex chars = 4.29 billion address space. Birthday paradox threshold for 1% collision probability is ~9,292 peers under one parent.
2. For any realistic deployment (< 1000 peers per parent), collision probability is negligible (< 0.01%)
3. If collision IS detected (two peers with same 8-char prefix under same parent), the upstream handler MUST reject the second peer's address registration with a collision error
4. Fallback: extend truncation to 12 or 16 chars if 8 proves insufficient in practice

**Owner:** Dev
**Timeline:** Story 7.1
**Verification:** T-7.1-06, T-7.1-07
**Decision:** 8 chars is sufficient for v1. Add collision detection in the BTP handshake handler (Story 7.2) as a safety net.

### E7-R004: Prefix Spoofing via BTP Handshake (Score: 6)

**Mitigation Strategy:**

1. Child node cross-validates the handshake-communicated prefix against the upstream peer's kind:10032 event (discovered via relay subscription or bootstrap)
2. If kind:10032 is not yet available (first connection, no relay access), the prefix is accepted provisionally and verified when kind:10032 becomes available
3. Mismatch between handshake prefix and kind:10032 prefix -> node disconnects and logs security warning

**Owner:** Dev
**Timeline:** Story 7.2
**Verification:** T-7.2-06

### E7-R008: Fee Advertisement vs Actual Fee Inconsistency (Score: 6)

**Mitigation Strategy:**

1. The SDK fee calculator uses kind:10032 data as the source of truth for intermediary fees
2. If an intermediary charges more than advertised (deducts more from PREPARE amount), the packet will be rejected at the next hop (insufficient amount). The sender receives an ILP REJECT.
3. The protocol does NOT enforce that intermediaries charge their advertised fee -- this is an economic incentive problem (overcharging intermediaries lose traffic as senders prefer cheaper routes)
4. SDK should surface fee-related ILP REJECT errors clearly so users understand the failure

**Owner:** Dev
**Timeline:** Story 7.5
**Verification:** T-7.5-05, T-7.5-11

### E7-R009: Fee Calculation Drift from Stale Route Table (Score: 6)

**Mitigation Strategy:**

1. Route table entries have a TTL based on kind:10032 event freshness. Stale entries are flagged but still used (best-effort).
2. On fee-related ILP REJECT, the SDK re-fetches kind:10032 for the failing intermediary and retries once
3. SDK logs a warning when using stale route data (kind:10032 older than configurable threshold, default 1 hour)
4. The relay subscription for kind:10032 events provides real-time updates when intermediaries change fees

**Owner:** Dev
**Timeline:** Story 7.5
**Verification:** T-7.5-05, T-7.5-10

### E7-R012: Prepaid Amount Validation Bypass (Score: 6)

**Mitigation Strategy:**

1. SDK provides a helper function: `validatePrepaidAmount(ctx: HandlerContext, advertisedPrice: bigint): void` that throws if `ctx.amount < advertisedPrice`
2. DVM example code and documentation show this validation as the first line of every prepaid handler
3. The SDK does NOT enforce this validation automatically (providers opt in) -- this matches the design principle that handlers control their own validation
4. Consider: SDK `ServiceNode` builder option `enforcePricing: true` that auto-rejects underpaid packets for registered skills

**Owner:** Dev
**Timeline:** Story 7.6
**Verification:** T-7.6-02, T-7.6-03

### E7-R017: Prefix Claim Payment Without Grant (Score: 6)

**Mitigation Strategy:**

1. The prefix claim handler MUST persist the prefix grant BEFORE calling `ctx.accept()` (which triggers ILP FULFILL)
2. Sequence: (1) validate prefix + amount, (2) persist grant in prefix store, (3) call `ctx.accept()`, (4) publish grant event to relay
3. If step 4 fails (relay publish error), the prefix is still granted (persisted in step 2) -- the grant event can be republished on retry
4. If step 2 fails (store error), `ctx.reject()` is called -- no money moves
5. Prefix claim is idempotent: if a customer retries the same claim (same pubkey + same prefix), and the prefix is already granted to them, the handler returns success without charging again

**Owner:** Dev
**Timeline:** Story 7.7
**Verification:** T-7.7-12

### E7-R021: Prefix Claim to Address Replacement Atomicity (Score: 6)

**Mitigation Strategy:**

1. When a vanity prefix replaces a pubkey-derived address, the node:
   - Updates its primary ILP address to the vanity prefix
   - Republishes kind:10032 with the new address
   - Notifies downstream peers (children) of the prefix change via BTP message
2. During the transition, BOTH old and new addresses are valid for a configurable grace period (default: 5 minutes)
3. The connector's routing table is updated to accept packets for both old and new addresses during the grace period
4. After the grace period, the old pubkey-derived address is deregistered

**Owner:** Dev
**Timeline:** Story 7.7 (depends on Story 7.2 handshake mechanism)
**Verification:** T-INT-02, T-7.7-07

---

## 11. Open Design Questions

These questions should be resolved before or during implementation. Tests are written assuming the "recommended" answer but will adapt to the actual decision.

| # | Question | Stories | Recommended Answer | Impact on Tests |
|---|----------|---------|-------------------|-----------------|
| Q1 | Are vanity prefixes permanent or leased (with TTL/renewal)? | 7.7 | Permanent for v1 (simplifies implementation). Leasing can be added later. | If leased: add T-7.7-18 for expiry and renewal tests. If permanent: E7-R018 is moot. |
| Q2 | What happens when an intermediary's fee is unknown (no kind:10032)? | 7.5 | Default to `feePerByte: 0` with a logged warning. Do not block publish. | T-7.5-07 tests this. If decision is "error instead of default," test changes to expect error. |
| Q3 | Should collision detection live in `deriveChildAddress()` or in the BTP handshake handler? | 7.1, 7.2 | BTP handshake handler (it knows existing peers). `deriveChildAddress()` is a pure function. | T-7.1-06 tests detection exists. Location does not change the test. |
| Q4 | Should the SDK enforce `validatePrepaidAmount()` automatically for registered skills? | 7.6 | No for v1 (provider controls validation). Provide helper only. | T-7.6-02 tests helper. If auto-enforcement: add T-7.6-17 for SDK-level rejection. |
| Q5 | What is the prefix claim event kind number (within 10032-10099 range)? | 7.7 | 10050 (arbitrary, in the middle of the range). | All T-7.7-* tests use whatever kind is chosen. |
| Q6 | Does the bid safety cap apply to the destination amount or the total amount (including route fees)? | 7.6 | Destination amount only. Route fees are infrastructure cost, not provider cost. | T-7.6-10 tests this. If total: change expected behavior. |
