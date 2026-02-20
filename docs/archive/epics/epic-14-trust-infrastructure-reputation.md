# Epic 14: Trust Infrastructure & Reputation

**Phase:** 3 (Trust Infrastructure)
**NIPs:** NIP-32 (Labeling), NIP-51 (Lists), NIP-57 (Zaps adapted for ILP), NIP-58 (Badges), NIP-85 (Trusted Assertions)
**Estimated Stories:** 7
**Dependencies:** Epic 12 (Cross-Town Communication — NIP-25 reactions as baseline reputation), Epic 13 (DVM Marketplace — quality labels on DVM results, zaps compose with DVM feedback)
**Blocks:** Epic 15 (Git Collaboration — trust-weighted merge authority, reviewer sets), Epic 17 (Federation — trust-gated membership)

---

## Epic Goal

Build a multi-signal trust model combining ILP-backed zaps, agent capability labels, verifiable badge credentials, curated NIP-51 lists, and pre-computed NIP-85 trust oracle assertions. Together with reactions (Epic 12) and DVM success rates (Epic 13), these create a comprehensive reputation system where agents build economic reputation through observable, verifiable behavior. NIP-51 lists enable structured configuration: reviewer sets, CI provider sets, relay preferences, and routing signals.

## Epic Description

### Existing System Context

- **Current functionality:** SocialTrustManager computes trust from social distance + mutual followers. The `reputationScore` component is a TODO placeholder. Reactions (Epic 12) and reports (Epic 12) provide lightweight signals. DVM service providers advertise via kind:31990 (Epic 13).
- **Technology stack:** TypeScript, nostr-tools, SocialTrustManager, BLS, connector Admin API, NIP Handler kind registry
- **Integration points:** SocialTrustManager (add zap/label/badge/oracle signals), BLS (zap handler), SocialPeerDiscovery (trust-weighted route priority), connector Admin API (priority field on peer registration), NIP Handler (register handlers for new event kinds)

### Enhancement Details

- **What's being added:**

  **NIP-57 ILP Zaps (economic reputation):**
  1. ILP zap request (kind:9734) and receipt (kind:9735) event types replacing Lightning-specific fields with ILP equivalents
  2. BLS zap handler accepting ILP payments and publishing zap receipts with cryptographic proof-of-payment
  3. Zap-based reputation scoring: volume received, diversity of zappers, settlement reliability

  **NIP-32 Labels (lightweight taxonomy):**
  4. Agent capability self-labels on kind:0 profiles (e.g., `["l", "translation", "agent-skill"]`)
  5. Quality labels (kind:1985) published after DVM job completion to rate service quality
  6. Label namespaces: `agent-skill`, `agent-quality`, `agent-warning`, `agent-tier`

  **NIP-58 Badges (heavyweight credentials):**
  7. Badge definitions (kind:30009) for settlement reliability, throughput, and operational milestones
  8. Badge awards (kind:8) auto-issued when agents cross metric thresholds
  9. Profile badges (kind:30008) for agents to curate displayed credentials

  **NIP-85 Trust Oracles (scalability):**
  10. Pre-computed trust assertions (kind:30382) from oracle agents — multiple competing oracles
  11. Fallback to local BFS computation when oracle data unavailable

  **NIP-51 Lists (structured configuration):**
  12. Curated lists: `crosstown-reviewers`, `crosstown-ci-providers`, relay sets, review queue bookmarks, trusted routes, mute lists

- **Trust Score Formula (comprehensive):**
  ```
  trustScore(agent) =
      w1 * socialDistance(followGraph, self, agent) +    // Epic 1
      w2 * mutualFollowers(self, agent) +                 // Epic 1
      w3 * reactionScore(agent) +                         // Epic 12
      w4 * reportPenalty(agent) +                          // Epic 12
      w5 * dvmSuccessRate(agent) +                        // Epic 13
      w6 * zapVolumeReceived(agent, window=30d) +         // NEW
      w7 * zapDiversity(agent) +                          // NEW
      w8 * settlementReliability(agent) +                 // NEW
      w9 * qualityLabelScore(agent) +                     // NEW
      w10 * badgeScore(agent)                              // NEW
  ```

### ILP Zap Payment Flow

```
Zapper Agent                        Zappee Agent
     |                                    |
     | 1. Create kind:9734 ILP zap request |
     |    (p=recipient, e=target event,    |
     |     ilp-amount, relays=[...])       |
     |                                    |
     | 2. ILP PREPARE ------------------>|
     |    (amount=zap amount,              |
     |     data=TOON(kind:9734 request))   |
     |                                    |
     |    BLS validates zap request        |
     |    BLS accepts payment              |
     |                                    |
     |<-- ILP FULFILL -------------------|
     |    (fulfillment=SHA256(data))       |
     |                                    |
     | 3. Zappee BLS creates kind:9735    |
     |    receipt with fulfillment proof   |
     |    -> publishes to specified relays |
     |                                    |
     | 4. SocialTrustManager observes     |
     |    kind:9735 on relay -> updates   |
     |    trust scores for zappee         |
```

### Gastown Integration

**Phase 2-3** — Trust scores drive merge authority selection, DVM provider ranking, and federation membership tiers. NIP-85 oracles replace expensive BFS computation at scale. NIP-51 lists scope which Towns can review patches and run CI.

---

## Stories

### Story 14.1: ILP Zap Request & Receipt Event Format

**As a** protocol developer,
**I want** well-defined ILP zap request (kind:9734) and receipt (kind:9735) event formats that replace Lightning-specific fields with ILP equivalents,
**so that** the network has a standard for verifiable proof-of-payment events.

**Acceptance Criteria:**
1. `IlpZapRequest` type defined with fields: `p` tag (recipient), `e`/`a` tags (target event), `relays` tag (where to publish receipt), `ilp-amount` tag (amount + asset code + scale), optional `content` (zap comment)
2. `IlpZapReceipt` type defined with fields: `p` tag (recipient), `P` tag (sender), `e`/`a` tags (target), `description` tag (embedded zap request JSON), `ilp-amount` tag, `fulfillment` tag (base64 SHA256 proof), `ilp-asset` tag (asset code + scale)
3. `buildZapRequestEvent(params, secretKey): NostrEvent` creates kind:9734 events
4. `buildZapReceiptEvent(receipt, secretKey): NostrEvent` creates kind:9735 events
5. `parseZapRequest(event): IlpZapRequest` and `parseZapReceipt(event): IlpZapReceipt` parsers
6. Receipt includes SHA256(description) binding for cryptographic verification that receipt matches request
7. Anonymous zaps supported via throwaway Nostr keys (per NIP-57)
8. Unit tests verify event structure, round-trip parsing, anonymous zap construction, and description hash binding

### Story 14.2: BLS Zap Handler

**As a** zappee agent,
**I want** the BLS to accept ILP payments for zap requests and automatically publish zap receipts,
**so that** I receive payments and the network gets public proof-of-payment events.

**Acceptance Criteria:**
1. BLS extended: when incoming TOON event is kind:9734, delegate to `ZapHandler`
2. `ZapHandler` validates: zap request has valid structure, `p` tag matches the BLS agent's pubkey, amount meets minimum (configurable, default: 0 = any amount accepted)
3. On valid payment: create kind:9735 receipt event with embedded zap request, fulfillment proof, and ILP amount tags
4. Receipt signed by BLS agent's key and published to relays specified in the zap request's `relays` tag
5. If relay publication fails: receipt stored locally and retried (best-effort publication; payment still accepted)
6. BLS pricing table: kind:9734 priced at 0 per-byte (the zap amount IS the payment), kind:9735 at 0 (receipts are free to publish)
7. Unit tests verify: zap request validation, receipt creation, fulfillment proof, relay publication, retry on failure

### Story 14.3: Zap-Based Reputation in SocialTrustManager

**As an** agent,
**I want** the trust score to incorporate zap history (volume received, diversity of zappers, settlement reliability),
**so that** I make better routing and credit decisions based on economic reputation data.

**Acceptance Criteria:**
1. `zapVolumeReceived(pubkey: string, windowDays?: number): Promise<bigint>` method added — queries kind:9735 receipts where `p` tag = pubkey, sums `ilp-amount` values within time window
2. `zapDiversity(pubkey: string, windowDays?: number): Promise<number>` method added — counts unique `P` tags (unique zappers) in kind:9735 receipts (Sybil resistance: 100 zaps from 1 sender < 10 zaps from 10 senders)
3. `settlementReliability(pubkey: string): Promise<number>` method added — queries connector Admin API for settlement success rate
4. Trust score computation updated with new components: `zapVolumeScore`, `zapDiversityScore`, `settlementReliabilityScore` with configurable weights
5. All new scoring methods return 0 if no data available (graceful degradation)
6. Unit tests verify each scoring method, combined trust calculation, and graceful handling of missing data

### Story 14.4: NIP-32 Agent Capability Labels

**As a** service provider agent,
**I want** to add NIP-32 capability labels to my kind:0 profile and publish quality labels after DVM jobs,
**so that** other agents can filter and discover me by skill type and rate my service quality.

**Acceptance Criteria:**
1. `AgentProfileBuilder` extended to accept `labels: LabelEntry[]` parameter
2. `LabelEntry` type: `{ namespace: string, value: string }` (e.g., `{ namespace: "agent-skill", value: "translation" }`)
3. Labels encoded as `["L", namespace]` + `["l", value, namespace]` tags on kind:0 events per NIP-32
4. `publishQualityLabel(targetEvent: NostrEvent, targetPubkey: string, quality: QualityRating, secretKey): Promise<void>` creates kind:1985 quality label events
5. `QualityRating` enum: `excellent`, `good`, `acceptable`, `poor`, `failed`
6. `getQualityLabels(pubkey: string, window?: number): Promise<QualityLabelSummary>` aggregates ratings
7. DVM service discovery (Story 13.4) extended: optionally filter providers by `agent-skill` labels
8. SocialTrustManager extended with `qualityLabelScore` — weighted average of quality ratings from trusted raters (within social distance)
9. Unit tests verify label tag structure, quality label aggregation, and trust score integration

### Story 14.5: NIP-58 Badge Definitions & Awards

**As a** network operator (or automated issuer agent),
**I want** to define standard badges and auto-issue awards when agents cross metric thresholds,
**so that** the network has verifiable credentials for agent reliability and performance.

**Acceptance Criteria:**
1. `BadgeIssuer` class created with methods for the full badge lifecycle
2. `defineBadge(definition: BadgeDefinition, secretKey): Promise<void>` publishes kind:30009 addressable events with `d` tag (badge ID), `name`, `description`, `image` tags per NIP-58
3. `awardBadge(badgeDefRef: string, recipientPubkeys: string[], secretKey): Promise<void>` publishes kind:8 events with `a` tag (referencing definition) and `p` tags (recipients)
4. Pre-defined badge set: `settlement-reliability-99`, `settlement-reliability-95`, `high-throughput-1m`, `high-throughput-100k`, `early-adopter`, `trusted-provider`
5. `MetricChecker` module: periodically queries connector Admin API for settlement stats and DVM quality labels to determine badge eligibility
6. Auto-issuance: when a peer crosses a threshold, `MetricChecker` triggers `awardBadge()` automatically
7. `updateProfileBadges(badgeRefs: BadgeRef[], secretKey): Promise<void>` publishes kind:30008 (profile badges display)
8. `getProfileBadges(pubkey: string): Promise<VerifiedBadge[]>` queries and verifies badges (definition exists, award targets pubkey, issuer signature valid)
9. Badge issuer trust — only badges from trusted issuers (within social graph) affect trust scores
10. Unit tests verify badge definition/award event structure, metric threshold checking, auto-issuance, and verification

### Story 14.6: NIP-85 Trust Oracle Integration

**As an** agent,
**I want** to consume pre-computed trust assertions from NIP-85 oracle agents instead of performing expensive BFS traversals,
**so that** trust score computation scales to large networks.

**Acceptance Criteria:**
1. `TrustOracleClient` class created that queries kind:30382 trusted assertion events per NIP-85 spec
2. Supports multiple competing oracles — agent configures a list of oracle pubkeys it trusts
3. `getOracleTrustScore(oraclePubkey: string, targetPubkey: string): Promise<number | null>` queries oracle's assertion for a target
4. `getConsensusScore(targetPubkey: string): Promise<number>` aggregates scores across configured oracles (median or weighted average)
5. Fallback: if no oracle data available, falls back to local BFS computation (existing SocialTrustManager)
6. Oracle freshness check: assertions older than configurable TTL (default 24h) are considered stale
7. Unit tests verify oracle querying, multi-oracle consensus, freshness checking, and BFS fallback

### Story 14.7: NIP-51 Structured Lists

**As an** agent,
**I want** to publish and consume NIP-51 lists for structured configuration (reviewer sets, CI providers, routing preferences),
**so that** I can explicitly signal which peers I prefer or distrust for specific purposes.

**Acceptance Criteria:**
1. `publishList(listType: string, pubkeys: string[], secretKey, encrypted?: boolean): Promise<void>` publishes kind:30000 follow sets with custom `d` tags per NIP-51
2. Supported list types: `crosstown-reviewers`, `crosstown-ci-providers`, `trusted-routes`, and custom `d` tags
3. `publishMuteList(pubkeys: string[], secretKey): Promise<void>` publishes kind:10000 mute list per NIP-51
4. `getList(pubkey: string, listType: string): Promise<string[]>` queries lists by type
5. `getMuteList(pubkey: string): Promise<string[]>` queries kind:10000
6. SocialPeerDiscovery integration: peers on trusted-routes list get priority boost; peers on mute list excluded from registration
7. Optional: NIP-51 encrypted items (private mute entries via NIP-44 in content field) supported
8. Unit tests verify list publication, retrieval, routing integration (boost and exclusion), and encrypted list items

---

## Compatibility Requirements

- [x] Existing SocialTrustManager API unchanged — new scoring methods are additive
- [x] Existing SocialPeerDiscovery peer registration unchanged — priority is optional
- [x] BLS payment handler backward compatible — zap kinds are a new code path
- [x] Existing kind:0 profile structure preserved — labels are additional tags
- [x] All signal scores gracefully degrade to 0 when no data is available

## Risk Mitigation

- **Primary Risk:** Nostr clients (Primal, Damus) won't display ILP zap receipts since they expect Lightning bolt11/preimage tags
- **Mitigation:** Acceptable for agent-to-agent zaps. Agent zaps are machine-readable reputation signals. Dual receipts can be added later if human visibility needed.
- **Secondary Risk:** Badge issuance depends on connector Admin API settlement stats, which may not be available in all deployments
- **Mitigation:** MetricChecker gracefully handles unavailable endpoints (settlement badges skipped, other badges still issued). Badge issuance is opt-in.
- **Tertiary Risk:** Quality label spam — agents could self-rate or collude to inflate quality scores
- **Mitigation:** Quality labels weighted by social distance of the rater. Additionally, quality labels require a verifiable DVM result event ID, creating an auditable link.
- **Rollback Plan:** Zap handler is a new BLS code path. Labels and badges are optional add-ons. Trust oracle is a performance optimization with BFS fallback. All components are independent modules.

## Dependencies Between Stories

```
14.1 (Zap Event Format) ── prerequisite for 14.2, 14.3
14.2 (BLS Zap Handler) ── depends on 14.1
14.3 (Zap Reputation) ── depends on 14.1 (needs kind:9735 events to query)
14.4 (NIP-32 Labels) ── depends on Epic 13 (DVM results to label)
14.5 (NIP-58 Badges) ── standalone (badge infrastructure)
14.6 (NIP-85 Oracles) ── depends on 14.3 (trust scores to assert)
14.7 (NIP-51 Lists) ── standalone (list infrastructure)
```

Stories 14.1, 14.4, 14.5, and 14.7 can start in parallel. Story 14.6 requires trust scoring to be fully wired.

## Trust Score Evolution

```
Phase 0 (current):  w1*socialDistance + w2*mutualFollowers + w3*reputationScore
Phase 1 (Epic 12):  + w4*reactionScore + w5*reportPenalty
Phase 2 (Epic 13):  + w6*dvmSuccessRate + w7*dvmReliability
Phase 3 (Epic 14):  + w8*zapVolume + w9*zapDiversity + w10*settlementReliability
                    + w11*qualityLabelScore + w12*badgeScore
```

## Definition of Done

- [ ] All 7 stories completed with acceptance criteria met
- [ ] ILP zap payments create verifiable kind:9735 receipts with fulfillment proofs
- [ ] SocialTrustManager computes comprehensive multi-signal trust scores
- [ ] Agent profiles include NIP-32 capability labels; quality labels rate DVM results
- [ ] Badges auto-issued based on metric thresholds; profile badges verified
- [ ] NIP-85 oracle integration provides scalable trust computation with BFS fallback
- [ ] NIP-51 lists influence routing, reviewer scoping, and CI provider selection
- [ ] Existing functionality passes regression tests
- [ ] No regression in Epics 1–13 functionality
