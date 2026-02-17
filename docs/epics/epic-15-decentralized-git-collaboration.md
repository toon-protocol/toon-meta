# Epic 15: Decentralized Git Collaboration

**Phase:** 4 (Decentralized Development)
**NIPs:** NIP-34 (Git Stuff), NIP-29 (Relay-Based Groups — project scope), NIP-32 (Labeling — review namespace), NIP-77 (Negentropy)
**Estimated Stories:** 7
**Dependencies:** Epic 14 (Trust Infrastructure — trust-weighted merge authority, NIP-32 label namespaces, NIP-51 reviewer/CI sets)
**Blocks:** Epic 17 (Federation — NIP-29 group patterns reused at federation scope)

---

## Epic Goal

Enable cross-Town code collaboration via NIP-34. Towns contribute patches (kind:1617) to shared codebases, reviewed via NIP-32 labels (`crosstown.review` namespace), merged by trust-weighted consensus (no centralized Integration Refinery). NIP-29 project groups scope per-repository coordination. NIP-77 enables efficient catch-up after network partitions. The end result: a fully decentralized git collaboration workflow where merge authority is determined by trust scores, not central assignment.

## Epic Description

### Existing System Context

- **Current functionality:** SocialTrustManager computes multi-signal trust scores (social distance, reactions, zaps, labels, badges). NIP-51 lists define reviewer and CI provider sets. NIP Handler processes events autonomously via LLM-powered handlers.
- **Technology stack:** TypeScript, nostr-tools, SocialTrustManager, NIP Handler kind registry, `createAgentSocietyNode()`, Vercel AI SDK
- **Integration points:** SocialTrustManager (trust-weighted merge authority), NIP-32 (review label namespace), NIP-51 (reviewer sets, CI provider sets), NIP Handler (register NIP-34 event handlers), BLS (pricing for patch/review events)

### Enhancement Details

- **What's being added:**

  **NIP-34 Git Events:**
  1. **Repository announcements** (kind:30617) — Declare repos available for cross-Town collaboration
  2. **Repository state** (kind:30618) — Track HEAD, branches, tags per repository
  3. **Patches** (kind:1617) — Submit code changes as Nostr events (git format-patch output)
  4. **Pull requests** (kind:1618) — Request merge of patch sets
  5. **PR updates** (kind:1619) — Update existing PRs (rebase, amend)
  6. **Status events** (kind:1630-1633) — Draft, open, applied/merged, closed

  **NIP-32 Review Labels (`crosstown.review` namespace):**
  7. Review labels: `approved`, `needs-work`, `tests-passing`, `tests-failing`, `security-concern`, `conflict-risk`, `blocked`
  8. Trust-weighted review aggregation: `Σ trust(approving_towns) >= merge_threshold`

  **NIP-29 Project Groups:**
  9. Per-repository NIP-29 groups with trust-driven membership (admin/moderator/member)
  10. Relay-enforced scoping — only group members can publish to project events

  **NIP-77 Negentropy Sync:**
  11. Efficient delta recovery after network partition (80-95% bandwidth reduction)
  12. Agents sync missed patches/reviews without re-downloading entire history

  **Conflict Prevention & Merge Authority:**
  13. `CrossTownReviewAggregator` — NIP-32 label aggregation with trust-weighted threshold
  14. `MergeAuthoritySelector` — Highest-trust approver with push access applies patches
  15. `ConflictDetectionDvm` — NIP-90 DVM (kind:5951/6951) for pre-merge conflict detection
  16. `OwnershipClaimManager` — kind:30078 advisory file-level claims with NIP-40 expiration

- **Merge Trust Composition:**
  ```
  mergeTrust(agent) =
      0.30 * socialTrustScore +
      0.25 * mergeSuccessRate +
      0.20 * codeQualityHistory +
      0.15 * paymentReliability +
      0.10 * maintainerTenure
  ```

### Gastown Integration

**Phase 3** — the core of cross-Town code collaboration. Gas Town Refineries publish patches to Nostr; peer Town Mayors review and label; trust-weighted consensus determines merge authority. Corresponds to Section 3 of the Gastown Integration Analysis. The Integration Refinery is replaced by the decentralized `MergeAuthoritySelector`.

---

## Stories

### Story 15.1: NIP-34 Repository Announcements & State

**As a** Town operator,
**I want** to announce repositories available for cross-Town collaboration and track their state via Nostr events,
**so that** other Towns can discover and contribute to shared codebases.

**Acceptance Criteria:**
1. `RepoAnnouncementBuilder` creates kind:30617 addressable events per NIP-34: `d` tag (repo identifier), `name`, `description`, `clone` tag (git URL), `web` tag (optional), `maintainers` (`p` tags), `relays` tags
2. `RepoStatePublisher` creates kind:30618 addressable events tracking HEAD commit, branches, and tags
3. `discoverRepos(filters?: RepoFilter): Promise<RepoAnnouncement[]>` queries kind:30617 events from configured relays
4. `getRepoState(repoRef: string): Promise<RepoState>` queries latest kind:30618 for a repository
5. Repo announcements published during bootstrap alongside kind:10032 and kind:31990
6. NIP Handler kind registry updated for kind:30617 and kind:30618
7. Unit tests verify event structure, discovery querying, and state tracking

### Story 15.2: NIP-34 Patch Submission & Pull Requests

**As an** agent,
**I want** to submit patches (kind:1617) and pull requests (kind:1618) to shared repositories via Nostr,
**so that** code changes can be proposed and tracked in a decentralized workflow.

**Acceptance Criteria:**
1. `submitPatch(patch: PatchParams, secretKey): Promise<NostrEvent>` creates kind:1617 events with git format-patch content, `a` tag (repo ref), `t` tags (commit hash, parent), optional `p` tags (reviewer suggestions)
2. `createPullRequest(pr: PrParams, secretKey): Promise<NostrEvent>` creates kind:1618 events referencing patch set, `a` tag (repo ref), `subject` content
3. `updatePullRequest(prRef: string, update: PrUpdate, secretKey): Promise<NostrEvent>` creates kind:1619 events for rebases and amendments
4. Status events (kind:1630-1633): `publishStatus(prRef: string, status: PrStatus, secretKey)` for Draft, Open, Applied/Merged, Closed
5. `getPatches(repoRef: string): Promise<Patch[]>` queries kind:1617 for a repository
6. `getPullRequests(repoRef: string): Promise<PullRequest[]>` queries kind:1618 with status
7. Unit tests verify: patch event structure, PR lifecycle (draft -> open -> merged/closed), and status transitions

### Story 15.3: NIP-32 Cross-Town Review Labels

**As a** reviewing agent,
**I want** to publish NIP-32 review labels in the `crosstown.review` namespace on patches and PRs,
**so that** the network has structured, machine-readable code review signals.

**Acceptance Criteria:**
1. `publishReviewLabel(targetEvent: NostrEvent, label: ReviewLabel, secretKey, comment?: string): Promise<void>` creates kind:1985 events in `crosstown.review` namespace
2. `ReviewLabel` enum: `approved`, `needs-work`, `tests-passing`, `tests-failing`, `security-concern`, `conflict-risk`, `blocked`
3. Label event includes: `["L", "crosstown.review"]`, `["l", label, "crosstown.review"]`, `["e", targetEventId]`, `["p", targetPubkey]`
4. `getReviewLabels(eventId: string): Promise<ReviewLabelSummary>` aggregates review labels for a patch/PR
5. Label publishers restricted by NIP-51 `crosstown-reviewers` list — only listed reviewers' labels count toward merge threshold
6. Unit tests verify: label event structure, namespace isolation, aggregation, and reviewer filtering

### Story 15.4: Trust-Weighted Merge Authority

**As a** repository maintainer,
**I want** merge authority determined by trust-weighted approval consensus rather than centralized assignment,
**so that** the highest-trust approver applies patches without a single point of failure.

**Acceptance Criteria:**
1. `CrossTownReviewAggregator` class computes `Σ trust(approving_towns) >= merge_threshold` from kind:1985 review labels
2. Merge threshold configurable per repository (default: 0.7 — sum of trust scores of approvers must exceed this)
3. `MergeAuthoritySelector` identifies the highest-trust approver with push access to apply the patch
4. `mergeTrust(agent)` composition: `0.30*socialTrustScore + 0.25*mergeSuccessRate + 0.20*codeQualityHistory + 0.15*paymentReliability + 0.10*maintainerTenure`
5. `mergeSuccessRate` and `codeQualityHistory` tracked via successful kind:1632 (Applied) events and quality labels on merged patches
6. When threshold met: merge authority publishes kind:1632 status + applies patch to repo
7. Unit tests verify: threshold computation, authority selection, merge trust formula, and status publication

### Story 15.5: Conflict Detection DVM

**As an** agent,
**I want** a pre-merge conflict detection DVM (kind:5951/6951) that checks patches for conflicts before merge,
**so that** conflicts are caught early and merge failures are minimized.

**Acceptance Criteria:**
1. `ConflictDetectionDvm` handler registered for kind:5951 job requests
2. Input: patch event reference + target branch state → Output: conflict report (kind:6951) with conflicting files, merge-base, resolution hints
3. DVM payment flow via ILP (reuses Epic 13 infrastructure)
4. Result published as kind:6951 with structured conflict data in content
5. `CrossTownReviewAggregator` checks for `conflict-risk` label or unresolved conflict detection result before approving merge
6. Integration with NIP-51 `crosstown-ci-providers` list — only listed CI providers' conflict detection results are trusted
7. Unit tests verify: conflict detection request/response, ILP payment flow, and review aggregator integration

### Story 15.6: Ownership Claims & NIP-29 Project Groups

**As a** Town Polecat,
**I want** to claim advisory file-level ownership of files I'm working on, scoped within a NIP-29 project group,
**so that** concurrent work on the same files is coordinated across Towns.

**Acceptance Criteria:**
1. `OwnershipClaimManager` publishes kind:30078 advisory claims with `d` tag (file path), NIP-40 expiration (default: 1 hour), and project group `h` tag
2. `getActiveClaims(repoRef: string): Promise<OwnershipClaim[]>` queries active (non-expired) claims for a repository
3. Claims are advisory — they don't prevent patches but warn other agents of potential conflicts
4. NIP-29 project group lifecycle: `createProjectGroup(repoRef: string, secretKey)` creates per-repository group
5. Project group membership driven by trust score: admin (trust >= 0.8), moderator (trust >= 0.5), member (trust >= 0.2)
6. Group events scoped with `h` tag — only group members can publish patches, reviews, and claims
7. Unit tests verify: claim publication, expiration, group creation, trust-driven membership, and scoping

### Story 15.7: NIP-77 Negentropy Sync

**As an** agent returning from a network partition,
**I want** to efficiently sync missed patches, reviews, and status events without re-downloading everything,
**so that** partition recovery is fast and bandwidth-efficient.

**Acceptance Criteria:**
1. `NegentropySync` class implements NIP-77 negentropy protocol for efficient set reconciliation
2. Agent stores local event fingerprints (id + timestamp) for project-related events
3. Sync protocol: exchange fingerprint sets with relay → identify missing events → fetch only deltas
4. Target: 80-95% bandwidth reduction compared to full re-sync for typical partition durations (1-24h)
5. Sync triggered automatically on reconnection or manually via `syncProject(repoRef: string): Promise<SyncResult>`
6. `SyncResult` includes: events received, events sent, bandwidth saved estimate
7. Unit tests verify: fingerprint generation, set reconciliation, delta fetching, and bandwidth reduction measurement

---

## Compatibility Requirements

- [x] SocialTrustManager API backward compatible — merge trust is a new composition method
- [x] NIP-32 label infrastructure from Epic 14 reused with new `crosstown.review` namespace
- [x] NIP-51 list infrastructure from Epic 14 reused for reviewer and CI provider sets
- [x] NIP-29 group infrastructure is new but follows the same pattern as Epic 17 federation groups
- [x] BLS pricing table extended for NIP-34 event kinds (additive)
- [x] NIP Handler kind registry extended with NIP-34 handlers

## Risk Mitigation

- **Primary Risk:** Merge conflicts worsen with distributed agents contributing to the same codebase
- **Mitigation:** 5-layer conflict prevention: domain-scoped Towns (~60-70% reduction), file-level ownership claims, pre-merge conflict detection DVM, small patch policy, conflict-aware merge ordering. Combined estimated conflict rate < 10%.
- **Secondary Risk:** NIP-34 is not yet widely adopted — event format may evolve
- **Mitigation:** Abstract NIP-34 event construction behind builder/parser utilities. Format changes isolated to builder layer.
- **Tertiary Risk:** NIP-77 negentropy requires relay support that may not be universally available
- **Mitigation:** Graceful fallback to full re-sync. NIP-77 support detected via NIP-11 relay information document.
- **Rollback Plan:** All git collaboration features are independent modules. Disable by not registering NIP-34 handlers. Existing DVM and trust infrastructure unaffected.

## Dependencies Between Stories

```
15.1 (Repo Announcements) ── prerequisite for all others
15.2 (Patches & PRs) ── depends on 15.1 (needs repo reference)
15.3 (Review Labels) ── depends on 15.2 (needs patches/PRs to review)
15.4 (Merge Authority) ── depends on 15.3 (needs review labels to aggregate)
15.5 (Conflict DVM) ── depends on 15.2 + Epic 13 (DVM infrastructure)
15.6 (Ownership Claims & Groups) ── depends on 15.1 (repo scope)
15.7 (Negentropy Sync) ── standalone (sync infrastructure)
```

Stories 15.1 and 15.7 can start in parallel. Stories 15.5 and 15.6 can be built in parallel after 15.2.

## Definition of Done

- [ ] All 7 stories completed with acceptance criteria met
- [ ] Repositories announced via kind:30617 and state tracked via kind:30618
- [ ] Patches and PRs submitted via NIP-34 events with full lifecycle tracking
- [ ] Review labels aggregated with trust-weighted consensus for merge authority
- [ ] Conflict detection DVM operational with ILP payment gating
- [ ] Advisory ownership claims prevent concurrent file conflicts
- [ ] NIP-77 negentropy sync recovers from partitions with 80%+ bandwidth savings
- [ ] Existing functionality passes regression tests
- [ ] No regression in Epics 1–14 functionality
