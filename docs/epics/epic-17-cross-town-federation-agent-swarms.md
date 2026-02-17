# Epic 17: Cross-Town Federation & Agent Swarms

**Phase:** 6 (Advanced Patterns)
**NIPs:** NIP-29 (Relay-Based Groups — federation scope)
**Estimated Stories:** 6
**Dependencies:** Epic 14 (Trust Infrastructure — trust-gated membership, badges), Epic 15 (Git Collaboration — NIP-29 project group patterns), Epic 16 (Content Layer — group communication patterns)
**Blocks:** None (terminal epic in current roadmap)

---

## Epic Goal

Town-to-Town federation grounded in the Gas Town model. A Gas Town Town is an agent swarm (Mayor + Polecats). The Wasteland federation protocol (DoltHub-based) is replaced by Nostr/ILP: Towns peer via NIP-02 + SPSP, form NIP-29 federation groups with payment-gated membership, and coordinate via hierarchical ILP addressing. Every cross-Town message is an ILP packet. This epic achieves full convergence of Gas Town and Crosstown into a distributed agent marketplace.

## Epic Description

### Existing System Context

- **Current functionality:** Connector routes ILP packets between peers. Payment channels support deposits on configurable ledgers. Admin API manages peers and routes dynamically. TOON encodes arbitrary Nostr events for ILP transmission. NIP-29 project groups operational (Epic 15). Trust scores drive routing, merge authority, and DVM provider ranking.
- **Technology stack:** TypeScript, nostr-tools, connector Admin API, payment channels, TOON codec, ILP address hierarchy, NIP Handler kind registry, Vercel AI SDK
- **Integration points:** Connector Admin API (dynamic group peer management), payment channels (membership deposit verification), ILP address allocation (group prefix), TOON encoding (group events in packets), SocialTrustManager + badges (membership gating), NIP-29 (reuse group lifecycle from Epic 15)

### Enhancement Details

- **What's being added:**
  1. **Federation Group Lifecycle** — NIP-29 federation groups for Town-to-Town coordination (join/leave/promote/demote)
  2. **Payment Channel Membership Gating** — Join requests validated against peering (NIP-02 + SPSP handshake) plus payment channel deposit plus trust threshold
  3. **Hierarchical ILP Address Allocation** — Each Town gets a prefix (`g.<town>.<rig>.<agent>`) for efficient intra-federation routing
  4. **Federation Messaging** — TOON-encoded group events as ILP PREPARE packets — every cross-Town message is a micropayment
  5. **Wasteland Protocol Migration** — Maps DoltHub-based federation tables to Nostr event equivalents
  6. **MEOW/DVM Workflow Mapping** — Gas Town workflow primitives mapped to Nostr/ILP patterns

- **Federation Lifecycle:**
  ```
  1. FORM:   Mayor creates federation group (kind:9007 create-group)
             Sets requirements: peering + min channel deposit + min trust score
             Publishes kind:39000 metadata (restricted, closed)
             Allocates ILP prefix: g.<town-handle>

  2. JOIN:   Peer Town Mayor sends kind:9021 join request
             Orchestrator validates:
               - Mutual NIP-02 follow? (peering prerequisite)
               - SPSP handshake completed? (payment channel open)
               - Channel deposit >= minimum?
               - Trust score above threshold?
               - Required badges held? (optional)
             If valid: kind:9000 put-user
             Register Town under federation ILP prefix:
               g.<federation>.<town-handle>

  3. WORK:   Cross-Town events use h tag for federation scoping
             Each event sent as ILP PREPARE to target Town(s)
             Payment amount per event = compensation for work
             Connector routes within federation prefix

  4. SETTLE: Payment channels settle on agreed ledger
             Federation groups persist (long-lived unlike task swarms)
  ```

- **Wasteland -> Nostr/ILP Mapping:**
  | Wasteland (DoltHub) | Nostr/ILP Equivalent |
  |---------------------|----------------------|
  | Town registry table | NIP-02 follow lists + kind:10032 peer info |
  | Wanted work table | NIP-90 DVM job requests (kind:5xxx) |
  | Completions table | kind:30080 completion records or DVM results (kind:6xxx) |
  | Stamps table | Trust scores (SocialTrustManager) + NIP-58 badges |
  | Badges table | NIP-58 badge definitions (kind:30009) + awards (kind:8) |
  | Town communication | NIP-17 DMs (private) or NIP-29 group events (public) via ILP |

- **MEOW/DVM Workflow Mapping:**
  | Gas Town Primitive | Nostr/ILP Pattern |
  |--------------------|-------------------|
  | Formula | NIP-90 DVM Job Request (kind:5xxx) |
  | Molecule | DVM Job + Feedback chain |
  | Wisp | kind:7000 DVM feedback event |
  | Convoy | Parallel DVM jobs (DvmJobChain with fan-out) |

### Gastown Integration

**Phase 3-4** — full convergence of Gas Town and Crosstown into a distributed agent marketplace. Towns federate via Nostr relays, dispatch work via NIP-90 DVMs with ILP payment, and coordinate shared codebases via NIP-34. The Wasteland DoltHub-based federation protocol is completely replaced by Nostr events + ILP payment channels.

---

## Stories

### Story 17.1: NIP-29 Federation Group Lifecycle

**As a** Town Mayor,
**I want** to create and manage NIP-29 federation groups for Town-to-Town coordination,
**so that** Towns can form, join, and leave federations with structured membership management.

**Acceptance Criteria:**
1. `FederationManager` class created with NIP-29 federation group lifecycle support
2. `createFederation(params: FederationParams, secretKey): Promise<FederationGroup>` publishes kind:9007 (create-group) to relay with federation metadata
3. `FederationParams` includes: `name`, `about`, access control (`restricted`/`closed`), membership requirements (`requirePeering`, `minDeposit`, `requiredBadges`, `minTrustScore`)
4. Kind:39000 group metadata published by relay with federation info, admin list, and access rules
5. `addTown(federationId: string, townPubkey: string, secretKey): Promise<void>` publishes kind:9000 (put-user)
6. `removeTown(federationId: string, townPubkey: string, secretKey): Promise<void>` publishes kind:9001 (remove-user)
7. `promoteTown(federationId: string, townPubkey: string, role: FederationRole, secretKey): Promise<void>` for admin/moderator/member role changes
8. `getFederationMembers(federationId: string): Promise<FederationMember[]>` queries kind:39002 (members list)
9. Timeline integrity: group events include `previous` tags referencing recent group events per NIP-29
10. Unit tests verify: federation creation, Town add/remove/promote, metadata updates, and timeline integrity

### Story 17.2: Payment-Gated Federation Membership

**As a** federation administrator,
**I want** to validate Town join requests against peering status, payment channel deposits, trust scores, and badges,
**so that** only economically committed and trusted Towns can join the federation.

**Acceptance Criteria:**
1. `MembershipValidator` class created with configurable gating requirements
2. On kind:9021 join request, validator checks:
   - Mutual NIP-02 follow exists between applicant and federation admin (peering prerequisite)
   - SPSP handshake completed (payment channel open, query connector Admin API: `GET /admin/channels/:peerId`)
   - Channel deposit >= federation's `minDeposit` requirement
   - Trust score above federation's `minTrustScore` threshold (query SocialTrustManager)
   - Optional: required badges held (query kind:30008 from Epic 14)
3. If all requirements met: auto-approve (publish kind:9000 put-user)
4. If requirements not met: reject with kind:9001 and reason content
5. `MembershipRequirements` type: `{ requirePeering: boolean, minDeposit?: bigint, requiredBadges?: string[], minTrustScore?: number, maxMembers?: number }`
6. Unit tests verify: peering validation, channel deposit checking, trust score threshold, badge checking, approval/rejection flows

### Story 17.3: Hierarchical ILP Address Allocation

**As a** federation member Town,
**I want** my Town and its agents to receive ILP addresses under the federation's prefix,
**so that** intra-federation traffic is routed efficiently via hierarchical addressing.

**Acceptance Criteria:**
1. On federation creation, allocate ILP address prefix: `g.<federation-handle>` (configurable base prefix)
2. On Town addition, register Town with connector under federation prefix: `g.<federation>.<town-handle>`
3. Within a Town, Rigs and agents get sub-addresses: `g.<federation>.<town>.<rig>.<agent-role>`
4. `FederationAddressManager` handles the full lifecycle: federation prefix allocation, Town addressing, Rig/agent sub-addressing, and cleanup
5. Route registration via connector Admin API: `POST /admin/routes` with federation prefix
6. Intra-federation routing: packets addressed to `g.<federation>.*` are routed within the federation's peer set
7. On Town removal: deregister Town's routes via `DELETE /admin/routes/<prefix>`
8. Collision detection: address manager checks for prefix conflicts before allocation
9. Unit tests verify: prefix allocation, hierarchical addressing, intra-federation routing, cleanup on removal

### Story 17.4: Federation TOON-Encoded Communication

**As a** federation member Town,
**I want** to send federation-scoped events to other Towns as ILP PREPARE packets,
**so that** every cross-Town message is a paid transaction and federation communication uses the ILP network.

**Acceptance Criteria:**
1. `FederationMessenger` class created for sending federation-scoped events
2. `sendToTown(federationId: string, targetTownPubkey: string, event: NostrEvent, amount: bigint, secretKey): Promise<FederationMessageResult>` sends TOON-encoded event as ILP PREPARE to target's federation address
3. Events include `h` tag (federation ID) for group scoping per NIP-29
4. `broadcastToFederation(federationId: string, event: NostrEvent, amountPerTown: bigint, secretKey): Promise<FederationBroadcastResult>` sends to all member Towns
5. `FederationMessageResult` includes: accepted (FULFILL) or rejected (REJECT with reason), cost, latency
6. `FederationBroadcastResult` includes: per-Town results, total cost, success/failure counts
7. BLS on receiving side: validates `h` tag matches an active federation the sender Town belongs to; rejects if sender not in federation
8. Unit tests verify: federation-scoped event construction, ILP PREPARE/FULFILL flow, broadcast, membership validation, and rejection handling

### Story 17.5: Wasteland Protocol Migration

**As a** Gas Town operator,
**I want** a migration path from Wasteland's DoltHub-based federation to Nostr/ILP federation,
**so that** existing Town data and relationships are preserved during the transition.

**Acceptance Criteria:**
1. `WastelandMigrator` class reads Wasteland DoltHub tables and produces Nostr event equivalents
2. Town registry -> NIP-02 follow list entries + kind:10032 ILP Peer Info events
3. Wanted work -> NIP-90 DVM job request events (kind:5xxx)
4. Completions -> kind:6xxx DVM result events or kind:30080 completion records
5. Stamps -> SocialTrustManager trust score inputs + NIP-58 badge awards
6. Badges -> NIP-58 badge definitions (kind:30009) + awards (kind:8)
7. Migration is one-way: once migrated, federation operates on Nostr/ILP exclusively
8. Dry-run mode: `migrate(dryRun: true)` shows what would be created without publishing
9. Unit tests verify: table-to-event mapping for each Wasteland data type, dry-run mode, and idempotent re-migration

### Story 17.6: MEOW/DVM Workflow Mapping

**As a** Gas Town Mayor,
**I want** Gas Town workflow primitives (Formula, Molecule, Wisp, Convoy) mapped to Nostr/ILP patterns,
**so that** existing Gas Town workflows can execute across federated Towns.

**Acceptance Criteria:**
1. `FormulaAdapter` converts Gas Town Formula definitions to NIP-90 DVM job requests (kind:5xxx)
2. `MoleculeAdapter` converts Molecule (multi-step Formula sequences) to DvmJobChain (Epic 13, Story 13.5)
3. `WispAdapter` maps Wisp (feedback/signal) to kind:7000 DVM feedback events
4. `ConvoyAdapter` converts Convoy (parallel Formula execution) to parallel DVM job fan-out
5. Each adapter includes: `toNostrEvent(gasTownPrimitive): NostrEvent` and `fromNostrEvent(event: NostrEvent): GasTownPrimitive` (bidirectional)
6. Integration test: end-to-end Formula -> DVM job request -> execution -> DVM result -> Formula completion across two federated Towns
7. Unit tests verify: each adapter's bidirectional mapping and round-trip fidelity

---

## Compatibility Requirements

- [x] Connector Admin API used via existing `ConnectorAdminClient` — no new API endpoints required
- [x] TOON encoding unchanged — federation events are standard Nostr events with `h` tag
- [x] BLS payment handler extended with federation membership validation (new code path, existing paths unchanged)
- [x] ILP address allocation follows existing hierarchical addressing conventions
- [x] Payment channels unchanged — federation uses existing deposit/settlement infrastructure
- [x] NIP-29 group infrastructure reused from Epic 15 at federation scope

## Risk Mitigation

- **Primary Risk:** Broadcast fan-out creates O(N) ILP packets per message where N = federation size. For large federations (50+ Towns), this may cause packet storms.
- **Mitigation:** Implement configurable fan-out limits. For large federations, use relay-based message distribution (publish to relay, Towns subscribe) instead of ILP broadcast. Hybrid approach: critical messages (work dispatch, results) via ILP; informational messages via relay.
- **Secondary Risk:** Wasteland migration is one-way — no rollback to DoltHub after migration
- **Mitigation:** Dry-run mode validates migration before committing. Backup DoltHub data before migration. Migration can be done incrementally (one table at a time).
- **Tertiary Risk:** MEOW/DVM workflow mapping may lose Gas Town-specific semantics in translation
- **Mitigation:** Bidirectional adapters preserve all data fields. Integration tests verify round-trip fidelity. Gas Town-specific metadata carried in custom Nostr tags.
- **Rollback Plan:** Federation functionality is an independent module. Disabling it does not affect individual agent peering, DVMs, trust scoring, or git collaboration. Wasteland migration is the only irreversible operation.

## Dependencies Between Stories

```
17.1 (Federation Lifecycle) ── prerequisite for all others
17.2 (Membership Gating) ── depends on 17.1 (federation exists to validate against)
17.3 (Address Allocation) ── depends on 17.1 (Towns to allocate addresses for)
17.4 (TOON Communication) ── depends on 17.1 + 17.3 (federation exists + addresses allocated)
17.5 (Wasteland Migration) ── depends on 17.1 + 17.2 (federation infrastructure ready)
17.6 (MEOW/DVM Mapping) ── depends on 17.4 + Epic 13 (DVM infrastructure + federation communication)
```

Stories 17.2 and 17.3 can be built in parallel after 17.1. Story 17.4 requires 17.3. Stories 17.5 and 17.6 can be built in parallel after 17.4.

## Definition of Done

- [ ] All 6 stories completed with acceptance criteria met
- [ ] Federation groups created with NIP-29 lifecycle management
- [ ] Membership gated by peering, payment channel deposits, trust scores, and badges
- [ ] Hierarchical ILP addressing operational for federated Towns (`g.<federation>.<town>.<rig>.<agent>`)
- [ ] Cross-Town communication via TOON-encoded ILP PREPARE packets (paid messaging)
- [ ] Wasteland DoltHub tables migrated to Nostr event equivalents
- [ ] MEOW/DVM workflow adapters enable Gas Town workflows across federated Towns
- [ ] Existing functionality passes regression tests
- [ ] No regression in Epics 1–16 functionality
