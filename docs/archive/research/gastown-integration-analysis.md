# Crosstown x Gas Town Integration: Deep Research Analysis

> **Revision History:**
> - **v1**: Original analysis with centralized Integration Refinery for cross-Town merges.
> - **v2 (current)**: Section 3 revised to use NIP-34 decentralized git collaboration with trust-weighted multi-approval, replacing the Integration Refinery. Additional NIP enhancements (NIP-40, NIP-46, NIP-51, NIP-53, NIP-56, NIP-77) integrated into merge architecture.
> - **Naming**: "Crosstown" is referred to as "Crosstown" throughout this revision, reflecting its role as the cross-Town communication layer.

## Executive Summary

### Key Findings

This research evaluates the feasibility of integrating Gas Town (Steve Yegge's multi-agent orchestration framework, ~189K LOC Go) and its Beads persistence layer (~225K LOC Go) with the Crosstown Protocol (TypeScript, Nostr + ILP bridge). The central question: can Crosstown's decentralized networking, identity, and payment infrastructure transform Gas Town from a single-machine orchestrator into a distributed, internet-scale multi-agent network?

**Verdict: Conditionally feasible, with a recommended hybrid architecture.**

| Integration Point | Feasibility | Value | Priority |
|---|---|---|---|
| Identity mapping (Nostr keypair <-> Gas Town agent) | **High** | **High** | Phase 1 |
| Communication layer (Nostr events for mail/nudge) | **High** | **High** | Phase 1 |
| Economic model (ILP payments for inter-agent work) | **Medium** | **High** | Phase 2 |
| Decentralized merge via NIP-34 | **Medium-High** | **High** | Phase 3 |
| Beads sync over Nostr events | **Medium** | **Medium** | Phase 3 |
| Cross-Town federation (Town-to-Town peering) | **Medium** | **Very High** | Phase 2-3 |
| MEOW/DVM workflow mapping | **Low** | **Medium** | Phase 4 |

### Critical Architectural Decision

**Hybrid local+remote architecture is required.** Gas Town's sub-millisecond local IPC (filesystem hooks, tmux, git worktrees) cannot be replicated over a network. The recommended approach:

- **Co-located agents** (same machine): Keep existing Gas Town communication (hooks, nudges, local mail)
- **Remote agents** (cross-machine): Use Nostr events for discovery, coordination, and work dispatch; ILP for payment gating
- **Federation layer**: Nostr relays replace DoltHub as the sync transport for cross-Town coordination

This mirrors how Kubernetes uses local networking within a node and overlay networks between nodes.

### Recommended Proof of Concept

**Cross-Town work dispatch via DVM + ILP**: Two Gas Town instances on separate machines, each running a Mayor + Polecats. Towns peer via NIP-02 follow + SPSP handshake (establishing payment channel on agreed ledger). Mayor A publishes a NIP-90 DVM job request with a bid amount. Mayor B's NIP handler detects it, verifies peering, claims it via DVM feedback. Town A locks payment via ILP PREPARE. Town B dispatches to a local Polecat, publishes completion as a DVM result. Town A verifies and releases payment via ILP FULFILL.

This exercises identity mapping, peering, communication, DVM work dispatch, and atomic ILP payment in a minimal integration surface.

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Nostr relay latency degrades orchestration speed | Medium | High | Hybrid architecture; local for co-located, Nostr for remote only |
| ILP payment channel management complexity | Medium | Medium | Per-peering SPSP handshake defines channel terms; no unknown-peer interactions; trust-based credit limits within peered channels |
| Merge conflicts worsen with distributed agents | High | High | 5-layer conflict prevention: domain-scoped Towns (~60-70% reduction), file-level ownership claims, pre-merge conflict detection DVM, small patch policy, conflict-aware merge ordering. Combined estimated conflict rate < 10%. See Section 3.8 |
| Agent coordination > 75% management threshold | High | High | Hierarchical Town structure; Mayors coordinate, Polecats stay local |
| Beads last-writer-wins inadequate for distributed state | Medium | Medium | Restrict Beads writes to local; sync via Nostr events with conflict detection |

---

## Section 1: Identity and Discovery Integration

### 1.1 Current Identity Systems

**Gas Town** uses a hierarchical address format parsed by `internal/session/identity.go`:

```
AgentIdentity {
    Role:   Role    // mayor, deacon, witness, refinery, crew, polecat
    Rig:    string  // rig name (empty for town-level agents)
    Name:   string  // crew/polecat name
    Prefix: string  // beads prefix (e.g., "gt")
}
```

Address examples: `mayor/`, `deacon/`, `gastown/witness`, `gastown/crew/max`, `gastown/polecats/Toast`

The `Connection` package (`internal/connection/address.go`) already supports machine-qualified addresses: `[machine:]rig[/polecat]`, e.g., `vm:gastown/rictus`.

**Crosstown** uses Nostr keypairs (secp256k1) as identity:
- Public key (npub): 64-character hex, globally unique
- Private key (nsec): Signs events, proves identity
- NIP-02 follow lists define peering relationships
- kind:10032 events publish ILP Peer Info (address, BTP endpoint, settlement capabilities)

### 1.2 Identity Mapping Specification

#### Proposed Mapping: Nostr npub <-> Gas Town Role Bead

Each Gas Town agent that participates in the distributed network gets a Nostr keypair. The mapping is stored as a Beads issue (type: `identity`) in the Town's `.beads` database:

```
Nostr Identity Bead:
  id:         bd-<hash>
  type:       identity
  title:      "Nostr Identity: <role>/<rig>/<name>"
  labels:     [npub:<hex>, role:<role>, rig:<rig>]
  metadata:   {
    npub: "<64-char-hex>",
    nsec_encrypted: "<encrypted-private-key>",
    ilp_address: "g.<town-handle>.<rig>.<role>",
    btp_endpoint: "wss://<town-host>:3000",
    gas_town_address: "<rig>/<role>/<name>"
  }
```

#### Hierarchical Identity Design

```
Town Level (1 keypair per Town):
  npub_town = keypair for Mayor/Town coordination
  ILP address: g.<town-handle>

Rig Level (1 keypair per Rig):
  npub_rig = keypair for Rig-level services (Witness, Refinery)
  ILP address: g.<town-handle>.<rig>

Agent Level (1 keypair per named agent):
  npub_agent = keypair for Crew members
  ILP address: g.<town-handle>.<rig>.<agent-name>
```

Polecats, being ephemeral, would share their Rig's keypair rather than maintaining individual identities. This prevents key management overhead for workers that live minutes to hours.

#### NIP-02 Follow Graph as Distributed Registry

The NIP-02 follow list naturally subsumes Gas Town's hierarchical addressing:

| Gas Town Relationship | NIP-02 Mapping |
|---|---|
| Town A Mayor knows Town B Mayor | Town A npub follows Town B npub |
| Mayor trusts Crew member Max | Mayor npub follows Max's npub |
| Rig A peers with Rig B | Rig A npub follows Rig B npub |
| Town joins Wasteland federation | Town npub follows Wasteland coordinator npub |

This enables **transitive discovery**: if Town A follows Town B and Town B follows Town C, Crosstown's social trust engine can compute trust scores for the A-C relationship (social distance = 2).

### 1.3 Bootstrap Flow: New Gas Town Instance Joins the Network

```
1. Town operator generates Nostr keypair (or imports existing)
2. gt init --nostr --npub <hex>
   -> Creates identity bead in .beads
   -> Publishes kind:10032 (ILP Peer Info) to configured relays
3. Operator follows known Towns via NIP-02 (gt federation add-peer --nostr <npub>)
4. Crosstown BootstrapService activates:
   Phase 1 (Discovering): Query relays for kind:10032 from followed Towns
   Phase 2 (Registering): Register discovered peers with local ILP connector
   Phase 3 (Handshaking): SPSP over Nostr (kind:23194/23195) for settlement
   Phase 4 (Announcing): Publish own kind:10032 via ILP PREPARE
   Phase 5 (Ready): Town is networked
5. Ongoing: SocialPeerDiscovery watches for new NIP-02 follows -> auto-peers
```

### 1.4 Identity Lifecycle

| Event | Gas Town Action | Nostr/ILP Action |
|---|---|---|
| **Creation** | `gt init --nostr` | Generate keypair, publish kind:10032 |
| **Key rotation** | Update identity bead, re-sign | Publish new kind:10032 (replaceable), NIP-02 update |
| **Revocation** | Delete identity bead | Publish kind:5 (NIP-09 deletion) for kind:10032 |
| **Agent spawn** (Polecat) | Create tmux session | No Nostr action (uses Rig keypair) |
| **Agent death** (Polecat) | Nuke tmux session | No Nostr action |
| **Town shutdown** | `gt shutdown` | Publish empty kind:10032 (signals offline) |

### 1.5 Compatibility with Gas Town's Connection Interface

Gas Town's `Connection` interface (`internal/connection/connection.go`) already abstracts local vs. remote operations:

```go
type Connection interface {
    Name() string
    IsLocal() bool
    ReadFile(path string) ([]byte, error)
    WriteFile(path string, data []byte, perm fs.FileMode) error
    Exec(cmd string, args ...string) ([]byte, error)
    TmuxNewSession(name, dir string) error
    // ...
}
```

A `NostrConnection` implementation would:
- `IsLocal()` returns `false`
- `ReadFile/WriteFile` -> Nostr event publish/query (for configuration/state)
- `Exec` -> NIP-90 DVM job request (for remote command execution)
- `TmuxNewSession` -> Not applicable (remote agent manages its own sessions)
- Mail/nudge operations -> Nostr encrypted DMs (NIP-17/NIP-44)

The existing `Machine` registry (`internal/connection/registry.go`) already supports typed machines:

```go
type Machine struct {
    Name     string `json:"name"`
    Type     string `json:"type"`       // "local", "ssh", could add "nostr"
    Host     string `json:"host"`       // for nostr: relay URL
    KeyPath  string `json:"key_path"`   // for nostr: path to nsec
    TownPath string `json:"town_path"`  // not applicable for nostr
}
```

**Implementation complexity: Medium.** The interface is clean, but many operations (file I/O, tmux) don't map to a network transport. The integration should focus on the mail/protocol layer, not general-purpose remote execution.

---

## Section 2: Communication Layer Replacement/Integration

### 2.1 Protocol Mapping Table

| Gas Town Operation | Current Transport | Nostr Event Kind | ILP Packet | Latency (Local) | Latency (Nostr) | Notes |
|---|---|---|---|---|---|---|
| `gt sling <bead> <rig>` | Filesystem (hook) | New kind: 30078 (work dispatch) | Optional TOON wrapper | <1ms | 50-200ms | Work assignment; triggers GUPP |
| `gt mail send` | Beads issue (filesystem) | kind:14 (NIP-17 DM, encrypted) | None | <1ms | 50-200ms | Encrypted via NIP-44 |
| `gt mail check --inject` | Filesystem read | kind:14 subscription | None | <1ms | Real-time sub | UserPromptSubmit hook polls |
| `gt nudge` | JSON file in queue dir | kind:14 with `priority:urgent` tag | None | <1ms + turn boundary | 50-200ms + turn boundary | Non-destructive injection |
| Protocol: MERGE_READY | Mail (beads issue) | kind:14 with `protocol:merge-ready` tag | None | <1ms | 50-200ms | Witness -> Refinery |
| Protocol: MERGED | Mail (beads issue) | kind:14 with `protocol:merged` tag | None | <1ms | 50-200ms | Refinery -> Witness |
| Protocol: POLECAT_DONE | Mail (beads issue) | kind:14 with `protocol:polecat-done` tag | None | <1ms | 50-200ms | Worker -> Witness |
| `gt prime --hook` | Filesystem (beads DB) | kind:30078 query (replaceable) | None | <10ms | 100-500ms | Session bootstrap context |
| Wasteland `wanted` post | DoltHub push | NIP-90 DVM job request (kind:5xxx) | ILP PREPARE (payment gated) | N/A (manual) | 50-200ms | Cross-Town work request |
| Wasteland completion | DoltHub PR | NIP-90 DVM result (kind:6xxx) + kind:30080 | ILP FULFILL (payment) | N/A (manual) | 50-200ms | Cross-Town work delivery |
| `gt costs record` | Local JSONL | kind:30081 (cost report) | None | <1ms | 50-200ms | Optional; for network analytics |

### 2.2 Proposed New Nostr Event Kinds for Gas Town

| Kind | Name | Type | Purpose |
|---|---|---|---|
| 30078 | Gas Town Work Dispatch | Parameterized-replaceable | Work assignment (bead on hook); `d` tag = bead ID |
| ~~30079~~ | ~~Gas Town Wanted Work~~ | ~~Parameterized-replaceable~~ | **Replaced by NIP-90 DVM job requests (kind:5xxx)** |
| 30080 | Gas Town Completion | Regular | Work completion evidence with stamps |
| 30081 | Gas Town Cost Report | Regular | Token usage and cost tracking |

All cross-Town messages would be NIP-44 encrypted (kind:14 via NIP-17 gift wrap) for privacy. The kinds above are for public/discoverable events.

### 2.3 Latency Analysis

**Baseline measurements from comparable systems:**

| System | Operation | Latency |
|---|---|---|
| Gas Town (local) | Hook dispatch, mail, nudge | <1ms |
| Temporal.io | Schedule-to-start (task queue) | 50-150ms |
| Kubernetes | Pod scheduling | 60-200ms |
| Nostr relay | WebSocket round-trip (publish + subscription delivery) | 50-200ms |
| ILP/STREAM | Payment packet (per hop) | 50-150ms estimated |

**Impact assessment:**

Gas Town's orchestration messages are **infrequent** (work dispatch happens every few minutes, not milliseconds). The 50-200ms Nostr latency is acceptable for:
- Work dispatch (`gt sling`): Agent takes minutes to complete work; 200ms dispatch overhead is negligible
- Mail: Checked at turn boundaries (seconds between checks)
- Protocol messages: Merge pipeline operates on minute timescales
- Nudges: Already delayed until turn boundary

Gas Town's **high-frequency** local operations would be degraded:
- `gt prime --hook` at session start: 100-500ms vs <10ms (acceptable, happens once)
- Nudge queue drain: Real-time Nostr subscription vs filesystem poll (comparable)
- Git operations: Cannot be distributed without shared hosting (fundamental constraint)

### 2.4 Reliability Guarantees

| Guarantee | Gas Town (Local) | Nostr/ILP (Distributed) |
|---|---|---|
| Message delivery | Filesystem writes are atomic | At-least-once (publish to multiple relays) |
| Ordering | FIFO within nudge queue | No global ordering; timestamps + sequence tags |
| Durability | Git-committed beads | Relay storage (configurable retention) |
| Exactly-once execution | Beads issue state machine | Not guaranteed; idempotency via bead ID dedup |

**Key gap:** Nostr relays provide **at-most-once** delivery per relay (events may be missed if client disconnects) and **no ordering guarantees** across relays. Gas Town's GUPP principle ("if work is on your hook, run it") provides natural idempotency -- duplicate delivery results in re-checking an already-completed bead, which is a no-op.

### 2.5 Hybrid Architecture Recommendation

```
┌─────────────────────────────────────────────────────────────┐
│                     Town A (Machine 1)                       │
│                                                             │
│  Mayor ←──local──→ Witness ←──local──→ Refinery             │
│    │                  │                                     │
│    │ local             │ local                               │
│    ▼                  ▼                                     │
│  Polecats (3-10)    Polecats (3-10)                         │
│                                                             │
│  [Crosstown Node: Nostr identity + ILP connector]       │
│    ├── NIP handler: listens for kind:30078, DVM jobs (5xxx) │
│    ├── Nostr publisher: mail, protocol, wanted, completion  │
│    └── ILP payment: settle cross-Town work                  │
└─────────────────┬───────────────────────────────────────────┘
                  │ Nostr relays (kind:14, 30078-30081)
                  │ ILP packets (TOON-encoded events)
                  │
┌─────────────────┴───────────────────────────────────────────┐
│                     Town B (Machine 2)                       │
│                                                             │
│  Mayor ←──local──→ Witness ←──local──→ Refinery             │
│    │                  │                                     │
│    │ local             │ local                               │
│    ▼                  ▼                                     │
│  Polecats (3-10)    Polecats (3-10)                         │
│                                                             │
│  [Crosstown Node: Nostr identity + ILP connector]       │
│    ├── NIP handler: listens for kind:30078, DVM jobs (5xxx) │
│    ├── Nostr publisher: mail, protocol, wanted, completion  │
│    └── ILP payment: settle cross-Town work                  │
└─────────────────────────────────────────────────────────────┘
```

**Principle:** Each Town is self-contained with local communication. Cross-Town coordination uses Nostr/ILP exclusively. The Crosstown Node acts as a **gateway** between the local Gas Town and the decentralized network.

---

## Section 3: Decentralized Merge and Coordination

### 3.1 The Merge Problem at Scale

Gas Town's Refinery processes merge requests sequentially, one at a time. The Refinery's state machine:

```
open -> in_progress -> closed (merged | rejected | conflict | superseded)
```

On conflict: `REWORK_REQUEST` -> Witness -> Polecat rebases -> re-verify -> re-merge.

**Current scaling characteristics:**
- 20-30 agents on one machine, all sharing the same git repository
- Merge conflicts increase with agent count (reported by users on HN)
- Sequential processing means N agents create O(N) queue depth
- Average merge cycle: minutes (verify + test + merge + push)

**Why the original Integration Refinery proposal falls short:**

The v1 analysis proposed a "designated Town" running an Integration Refinery for cross-Town merges. This reintroduces the exact centralization that Crosstown is designed to eliminate:

- Single point of failure (designated Town goes down = all cross-Town merges stop)
- Trust bottleneck (one entity decides what merges)
- Contradicts the decentralized identity and social-graph-driven design of every other layer

---

### 3.2 NIP-34 Decentralized Git Collaboration

NIP-34 defines a complete protocol for git collaboration over Nostr. It is the native solution to cross-Town merges.

#### 3.2.1 NIP-34 Event Kinds

| Kind | Name | Type | Purpose in Crosstown |
|---|---|---|---|
| 30617 | Repository Announcement | Addressable-replaceable | Shared codebase metadata: clone URLs, maintainer list (Town npubs), relay endpoints |
| 30618 | Repository State | Addressable-replaceable | Branch/tag tracking across Towns; each Town publishes its branch state |
| 1617 | Patch | Regular | Cross-Town code contributions (git format-patch as Nostr events) |
| 1618 | Pull Request | Regular | Larger cross-Town contributions referencing a clone URL |
| 1619 | PR Update | Regular | Revisions to an existing cross-Town PR |
| 1621 | Issue | Regular | Cross-Town bug reports, feature requests |
| 1630 | Status: Open | Regular | Patch/PR submitted for review |
| 1631 | Status: Applied/Merged | Regular | Patch/PR accepted and integrated |
| 1632 | Status: Closed | Regular | Patch/PR rejected |
| 1633 | Status: Draft | Regular | Work-in-progress, not yet reviewable |

#### 3.2.2 Shared Codebase Announcement

Each shared codebase is announced via kind:30617:

```json
{
  "kind": 30617,
  "tags": [
    ["d", "<repo-identifier>"],
    ["name", "agent-marketplace"],
    ["description", "Shared agent marketplace codebase"],
    ["clone", "https://github.com/org/agent-marketplace.git"],
    ["clone", "git@github.com:org/agent-marketplace.git"],
    ["web", "https://github.com/org/agent-marketplace"],
    ["relays", "wss://relay1.example.com", "wss://relay2.example.com"],
    ["maintainer", "<town-a-mayor-npub>", "wss://relay1.example.com"],
    ["maintainer", "<town-b-mayor-npub>", "wss://relay2.example.com"],
    ["maintainer", "<town-c-mayor-npub>", "wss://relay1.example.com"]
  ],
  "content": "Crosstown shared codebase for the agent marketplace project."
}
```

**Maintainer list is derived from the social graph.** Towns listed as maintainers are those whose Mayor npubs have a trust score above the project's maintainer threshold (configurable per repo). As trust scores change, the maintainer list updates automatically.

#### 3.2.3 Cross-Town Contribution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  WITHIN TOWN A (unchanged Gas Town workflow)                     │
│                                                                 │
│  1. Mayor assigns bead to Polecat                                │
│  2. Polecat works on feature branch                              │
│  3. Polecat signals DONE                                         │
│  4. Witness routes to Refinery                                   │
│  5. Refinery merges to Town A's integration branch               │
│     (e.g., feature/town-a or towns/town-a/main)                 │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼  Town A Mayor publishes to Nostr
┌─────────────────────────────────────────────────────────────────┐
│  CROSSTOWN LAYER (NIP-34 over Nostr)                             │
│                                                                 │
│  6. Mayor publishes kind:1617 patch (or kind:1618 PR)            │
│     - Contains git format-patch of the merged work               │
│     - Tags: repo d-tag, bead ID, effort estimate                 │
│     - Encrypted payment offer (ILP) in content                   │
│                                                                 │
│  7. Peer Towns receive via relay subscription                    │
│     - NIP handler detects kind:1617 from followed Towns          │
│     - Filters by repo d-tag (only repos this Town participates)  │
│                                                                 │
│  8. Distributed review (NIP-32 labels + NIP-85 trust)            │
│     - Reviewing Town Mayors label the patch (kind:1985)          │
│     - Labels: "approved", "needs-work", "tests-passing"          │
│     - Each label carries the reviewer's trust weight             │
│                                                                 │
│  9. Distributed CI (NIP-90 DVMs)                                 │
│     - Any Town can run tests as a DVM job                        │
│     - DVM result published with test pass/fail evidence          │
│     - CI runner gets paid via ILP                                │
│                                                                 │
│ 10. Trust-weighted merge threshold reached                       │
│     - Σ trust(approving Towns) > project merge threshold         │
│     - DVM CI result = passing                                    │
│     - Highest-trust approver applies patch locally               │
│     - Publishes kind:1631 (merged status)                        │
│     - Pushes to shared git remote                                │
│                                                                 │
│ 11. Settlement                                                   │
│     - ILP FULFILL sent to contributing Town                      │
│     - Trust scores updated (successful merge = trust increase)   │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼  Other Towns pull from shared remote
┌─────────────────────────────────────────────────────────────────┐
│  WITHIN TOWN B, C, ... (each pulls independently)                │
│                                                                 │
│ 12. Mayor detects kind:1631 (merged status) for tracked repo     │
│ 13. Pulls latest from shared remote                              │
│ 14. Local Refinery rebases any in-progress Town branches         │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Trust-Weighted Multi-Approval

#### 3.3.1 Merge Threshold Model

Instead of a single Refinery deciding, merges require **consensus from the social graph**. Each project defines a merge threshold:

```
merge_threshold = configurable per repo (default: 1.5)

A patch is mergeable when:
  1. Σ trust(approving_towns) >= merge_threshold
  2. At least min_reviewers (default: 2) distinct Towns have approved
  3. DVM CI result = passing (at least 1 verified run)
  4. No Town with trust > 0.8 has labeled "blocked"
```

**Example scenarios:**

| Approvers | Trust Scores | Sum | Threshold 1.5 | Result |
|---|---|---|---|---|
| Town B (0.9) | - | 0.9 | Not met | Wait for more reviews |
| Town B (0.9), Town C (0.7) | - | 1.6 | Met, 2 reviewers | Mergeable |
| Town B (0.9), Town D (0.3) | - | 1.2 | Not met | Wait for more reviews |
| Town B (0.9), Town C (0.7), Town D (0.3) | - | 1.9 | Met, 3 reviewers | Mergeable |

Higher-value projects can raise the threshold and minimum reviewer count. Low-stakes repos can lower them.

#### 3.3.2 Merge Authority Selection

When the threshold is met, **who actually applies the patch?**

```
merge_authority = highest_trust(approving_towns)
                  WHERE town.has_push_access(repo) = true

Tiebreaker: earliest approval timestamp
```

The merge authority is not a fixed role — it emerges from the approval set each time. Any approving Town with push access and the highest trust score performs the merge. If that Town fails or is unavailable, the next-highest takes over.

#### 3.3.3 NIP-85 Trust Assertions for Merge Decisions

Computing trust scores via BFS over the full follow graph is expensive at scale. NIP-85 provides a solution: **trust oracle services** that publish pre-computed assertions.

```json
{
  "kind": 30382,
  "tags": [
    ["d", "<town-mayor-npub>"]
  ],
  "content": "{\"trust_score\": 0.85, \"successful_merges\": 47, \"failed_merges\": 2, \"merge_success_rate\": 0.959, \"social_distance\": 1, \"mutual_follows\": 12}"
}
```

Towns declare which trust oracles they use via kind:10040. Multiple competing oracles prevent centralization — if one oracle produces questionable scores, Towns switch to another.

**Trust score composition for merge decisions:**

```
merge_trust(town) = 0.30 * social_trust           (NIP-85 assertion or local computation)
                  + 0.25 * merge_success_rate      (from kind:30080 completion history)
                  + 0.20 * code_quality_history     (from NIP-32 label history on past patches)
                  + 0.15 * payment_reliability      (ILP settlement history)
                  + 0.10 * time_as_maintainer       (longevity in the repo's maintainer list)
```

This is richer than the v1 algorithm because it incorporates **merge-specific reputation**, not just general social trust.

---

### 3.4 Distributed Code Review via NIP-32 Labels

#### 3.4.1 Crosstown Review Label Namespace

```
Namespace: "crosstown.review"

Labels:
  "approved"          - Reviewer endorses merge
  "needs-work"        - Changes requested (content has details)
  "tests-passing"     - Reviewer verified tests pass (or DVM confirmed)
  "tests-failing"     - Tests fail (content has failure details)
  "security-concern"  - Security issue identified
  "conflict-risk"     - High probability of merge conflict with in-flight work
  "blocked"           - Hard block (from high-trust Town, prevents merge)
```

#### 3.4.2 Review Event Structure

```json
{
  "kind": 1985,
  "tags": [
    ["L", "crosstown.review"],
    ["l", "approved", "crosstown.review"],
    ["e", "<patch-event-id>", "<relay-url>"],
    ["p", "<patch-author-npub>"],
    ["a", "30617:<repo-owner-npub>:<repo-d-tag>"]
  ],
  "content": "LGTM. Clean implementation, tests cover edge cases. Verified against Town B's integration branch — no conflicts detected."
}
```

#### 3.4.3 Review Aggregation

Crosstown NIP handlers aggregate labels across reviewers:

```
For patch P:
  approvals     = [labels where l="approved"]
  blocks        = [labels where l="blocked"]
  trust_sum     = Σ trust(approval.author) for each approval
  has_block     = any(trust(block.author) > 0.8)
  ci_passing    = any(labels where l="tests-passing" AND author is DVM)

  mergeable = trust_sum >= threshold
              AND len(approvals) >= min_reviewers
              AND ci_passing
              AND NOT has_block
```

---

### 3.5 Distributed CI via NIP-90 DVMs

#### 3.5.1 CI as a Marketplace

Instead of one Refinery running tests, **any Town can offer CI services** via NIP-90:

```
Patch submitted (kind:1617)
    │
    ▼
DVM Job Request (kind:5xxx)
{
  "kind": 5950,  // custom kind for "run test suite"
  "tags": [
    ["i", "<patch-event-id>", "event"],
    ["i", "<repo-clone-url>", "url"],
    ["i", "<target-branch>", "text"],
    ["param", "test-command", "make test"],
    ["bid", "50000"],  // 50 sats max for CI run
    ["relays", "wss://relay1.example.com"]
  ],
  "content": "Run full test suite with this patch applied to target branch."
}
    │
    ▼
Any Town with compute + repo clone can fulfill
    │
    ▼
DVM Job Result (kind:6950)
{
  "kind": 6950,
  "tags": [
    ["e", "<job-request-event-id>"],
    ["p", "<requester-npub>"],
    ["request", "<stringified-job-request>"]
  ],
  "content": "{\"passed\": 142, \"failed\": 0, \"skipped\": 3, \"duration_seconds\": 87, \"commit_sha\": \"a1b2c3d4\", \"log_url\": \"<optional>\"}"
}
    │
    ▼
ILP payment settles CI cost
```

#### 3.5.2 CI Trust and Verification

A single DVM CI result could be faked. Mitigation:

1. **Multiple CI runs**: High-value repos require 2+ independent DVM results agreeing
2. **CI runner reputation**: Track which Towns produce reliable CI results (kind:7000 feedback events). Unreliable runners lose trust.
3. **Reproducibility check**: Any Town can re-run the tests to dispute a result. Disputed results trigger re-evaluation.

#### 3.5.3 CI Cost Projections

| Repo Size | Test Suite Duration | DVM Bid (sats) | At 10 merges/day |
|---|---|---|---|
| Small (< 1min tests) | 30-60s | 10-25 sats | 100-250 sats/day |
| Medium (5-15min tests) | 5-15min | 50-200 sats | 500-2,000 sats/day |
| Large (30min+ tests) | 30-60min | 200-1,000 sats | 2,000-10,000 sats/day |

At current rates (~$0.001/sat), even large repos cost < $10/day for distributed CI. This is competitive with centralized CI services and creates an open market where Towns with spare compute earn by running tests for others.

---

### 3.6 NIP-29 Project Groups for Coordination

#### 3.6.1 Group-per-Repository Model

Each shared codebase operates within a NIP-29 relay-based group:

```json
{
  "kind": 39000,
  "tags": [
    ["d", "agent-marketplace"],
    ["name", "Agent Marketplace Codebase"],
    ["about", "Cross-Town collaboration on the agent marketplace"],
    ["private"],
    ["closed"]
  ]
}
```

**Group roles map to Crosstown roles:**

| NIP-29 Role | Crosstown Meaning | Capabilities |
|---|---|---|
| Admin | High-trust Town Mayor (trust > 0.8) | Apply merges, manage membership, adjust thresholds |
| Moderator | Mid-trust Town Mayor (trust 0.5-0.8) | Review patches, label, run CI |
| Member | Contributing Town Mayor (trust > 0.3) | Submit patches, participate in discussion |

#### 3.6.2 Membership via Trust

Group membership is **dynamic and trust-driven**:

```
On NIP-02 follow change OR trust score update:
  For each project group this Town participates in:
    new_trust = compute_merge_trust(town)
    if new_trust > admin_threshold:     promote to admin (kind:9000)
    elif new_trust > moderator_threshold: set as moderator (kind:9000)
    elif new_trust > member_threshold:  keep as member
    else:                               remove from group (kind:9001)
```

Towns that consistently produce good merges get promoted. Towns that produce conflicts or bad code get demoted. No human intervention required.

#### 3.6.3 Group Benefits

- **Event filtering**: NIP-29 groups scope patch events to relevant Towns (not all followers see all patches)
- **Relay enforcement**: The group relay can reject patches from non-members
- **Coordination channel**: Group messages (kind:9, kind:11 within the group) serve as a project discussion channel between Mayors
- **Audit trail**: All group events (joins, leaves, promotions, demotions) are Nostr events with signatures and timestamps

---

### 3.7 Beads Dependency Graph Synchronization

> This section is preserved from v1 with minor updates for NIP-34 compatibility.

Beads' 19 dependency types create a directed acyclic graph (DAG) that determines work ordering. In a distributed setting:

**Synchronization strategy:**

1. **Local Beads** remain authoritative for each Town's work items
2. **Cross-Town dependencies** use Nostr event references:
   - `depends_on_id` already supports external references: `external:<rig>:<id>`
   - Extended format: `external:<npub>:<rig>:<id>` for cross-Town references
3. **Status updates** published as NIP-34 patch events (kind:1617) and status events (kind:1630-1633), replacing the custom kind:30078 for merge-related status
4. **Ready-work computation** (`bd ready`) includes check for remote dependency status via cached Nostr events

**Conflict resolution:**

- **Same bead, different Towns**: Should not happen; beads are scoped to a Town's Rig
- **Cross-Town dependency status**: Event timestamps resolve conflicts (most recent wins)
- **Wasteland wanted items**: Hash-based IDs (bd-XXXX) prevent collision; claiming uses first-claim-wins via Nostr event timestamps
- **Merge conflicts in code**: Handled by the contributing Town's local Refinery before the patch is published to Nostr. If a conflict arises during integration, kind:1632 (closed) + NIP-32 label "conflict-risk" is published, and the contributing Town rebases and resubmits.

---

### 3.8 Merge Conflict Prevention

The NIP-34 multi-approval architecture solves merge *governance* (who decides what merges, with no single point of failure) but does not solve merge *conflicts* (two Towns editing the same files). Conflicts are a git problem, not a governance problem. This section addresses conflict prevention directly with strategies ranging from organizational to Nostr-native.

#### 3.8.1 Impact Assessment

Cross-Town merges introduce higher conflict risk than local merges because:
- **Higher latency**: 50-200ms Nostr relay communication + minutes/hours for human-in-the-loop review means more time for conflicting changes to accumulate
- **Less visibility**: Towns don't see each other's in-flight work by default (unlike co-located Polecats sharing a git repo)
- **Larger surface area**: Cross-Town patches tend to be larger (bundled local merges) than individual Polecat commits

Without mitigation, cross-Town merge conflicts could negate the productivity gains of distributed work.

#### 3.8.2 Strategy 1: Domain-Scoped Towns (Organizational)

**Estimated conflict reduction: 60-70%**

The single most effective strategy. Towns specialize by codebase domain:

```
Town A (Auth Team):      owns src/auth/**, src/middleware/auth*
Town B (API Team):       owns src/api/**, src/routes/**
Town C (Infrastructure): owns infra/**, deploy/**, src/config/**
Town D (Frontend):       owns web/**, src/templates/**
```

If each Town works primarily within its owned directories, cross-Town patches rarely touch the same files.

**Implementation via NIP-34 repo announcement (kind:30617):**

```json
{
  "kind": 30617,
  "tags": [
    ["d", "agent-marketplace"],
    ["maintainer", "<town-a-npub>", "wss://relay1.example.com"],
    ["maintainer", "<town-b-npub>", "wss://relay2.example.com"],
    ["domain", "<town-a-npub>", "src/auth/**", "src/middleware/auth*"],
    ["domain", "<town-b-npub>", "src/api/**", "src/routes/**"],
    ["domain", "<town-c-npub>", "infra/**", "deploy/**", "src/config/**"],
    ["domain", "<town-d-npub>", "web/**", "src/templates/**"]
  ]
}
```

Domain tags are advisory — they don't prevent a Town from submitting patches outside its domain, but patches that cross domain boundaries receive extra scrutiny (higher merge threshold, more reviewers required).

**Domain boundary crossing policy:**

```
If patch P from Town T touches files outside T's domain:
  merge_threshold = base_threshold * 1.5    (e.g., 1.5 * 1.5 = 2.25)
  min_reviewers   = base_min + 1            (e.g., 2 + 1 = 3)
  MUST include approval from domain owner   (the Town whose domain is crossed)
```

#### 3.8.3 Strategy 2: File-Level Ownership Claims (Nostr-Native)

**Estimated conflict reduction: 20-30%**

Before a Town begins work that will result in a cross-Town patch, the Mayor publishes an advisory ownership claim:

```json
{
  "kind": 30078,
  "tags": [
    ["d", "<bead-id>"],
    ["a", "30617:<repo-owner>:<repo-d-tag>"],
    ["status", "working"],
    ["claim", "src/auth/oauth.go"],
    ["claim", "src/auth/token.go"],
    ["claim", "src/middleware/rate-limit.go"],
    ["estimate", "3600"]
  ],
  "content": "Town A working on OAuth refactor, estimated 1 hour."
}
```

**Claim protocol:**

```
1. Before dispatching cross-Town-relevant work:
   Mayor queries active claims: REQ kinds:[30078] #a:[repo-ref] #status:["working"]

2. If overlap detected:
   a. No conflict: proceed, publish own claim
   b. Partial overlap: coordinate with claiming Town via NIP-29 group message
   c. Full overlap: wait for claim to clear, or negotiate work split

3. On work completion:
   Update claim event: ["status", "done"] (parameterized-replaceable, replaces prior)

4. On claim timeout (estimate exceeded by 2x):
   Other Towns may proceed — stale claims don't block indefinitely
```

**Claims are advisory, not locks.** This is deliberate:
- Hard locks over Nostr are impractical (no atomic CAS, relay latency)
- Advisory claims work because Towns are incentivized to avoid conflicts (failed merges reduce trust score)
- If two Towns ignore claims and conflict, the merge process still works — one rebases

#### 3.8.4 Strategy 3: Pre-Merge Conflict Detection DVM (Nostr-Native)

**Estimated conflict reduction: 10-20%**

A specialized NIP-90 DVM service that detects conflicts before review begins, shifting resolution left:

```json
{
  "kind": 5951,
  "tags": [
    ["i", "<patch-event-id>", "event"],
    ["i", "<repo-clone-url>", "url"],
    ["i", "<target-branch>", "text"],
    ["param", "check-type", "conflict-detection"],
    ["bid", "5000"],
    ["relays", "wss://relay1.example.com"]
  ],
  "content": "Check this patch for conflicts against all open patches and the target branch."
}
```

**DVM conflict detection flow:**

```
1. New patch published (kind:1617)

2. Conflict Detection DVM activates:
   a. Fetch all open patches for this repo (kind:1617, status != merged/closed)
   b. For each pair (new patch, existing patch):
      - Attempt trial merge of both against target branch
      - Record file overlap and conflict hunks
   c. Publish result (kind:6951)

3. Result event:
   {
     "kind": 6951,
     "content": {
       "conflicts": [
         {
           "patch_event_id": "<other-patch-id>",
           "patch_author": "<other-town-npub>",
           "conflicting_files": ["src/auth/oauth.go"],
           "conflict_hunks": 2,
           "severity": "medium"
         }
       ],
       "clean_merge": false,
       "recommendation": "rebase_before_review"
     }
   }

4. NIP-32 label auto-published:
   If conflicts found: label "conflict-risk" on the patch (kind:1985)
   If clean: label "conflict-free" on the patch

5. Contributing Town receives conflict notification:
   - Can proactively rebase before review completes
   - Reduces wasted review effort on patches that would conflict at merge time
```

**Cost:** ~5 sats per conflict check. At 10 patches/day = 50 sats/day ($0.05). Negligible.

#### 3.8.5 Strategy 4: Small, Frequent Patches (Protocol Design)

**Estimated conflict reduction: 15-25%**

The longer a branch lives, the more likely it conflicts. Cross-Town patches should be small and frequent.

**NIP-34 enforces this naturally:**
- kind:1617 patches are designed for small diffs (< 60KB content limit)
- Larger changes use kind:1618 PRs, which should be decomposed into patch series
- Each patch in a series references its predecessor via NIP-10 reply tags

**Recommended patch size policy (configurable per NIP-29 project group):**

```json
{
  "kind": 39000,
  "tags": [
    ["d", "agent-marketplace"],
    ["name", "Agent Marketplace Codebase"],
    ["patch-policy", "max-files", "15"],
    ["patch-policy", "max-lines", "500"],
    ["patch-policy", "max-age-hours", "24"]
  ]
}
```

| Policy | Default | Purpose |
|---|---|---|
| `max-files` | 15 | Patches touching > 15 files require decomposition into a series |
| `max-lines` | 500 | Patches > 500 lines require decomposition |
| `max-age-hours` | 24 | Patches older than 24 hours without merge get flagged for rebase |

These are enforced by the NIP-29 group relay — oversized patches are rejected with a message to decompose. Towns can still submit kind:1618 PRs for genuinely large changes, but these receive higher scrutiny.

#### 3.8.6 Strategy 5: Conflict-Aware Merge Ordering

**Estimated conflict reduction: 5-15%**

When multiple patches are simultaneously mergeable (threshold met, CI passing), the merge authority should process them in an order that minimizes cascading conflicts:

```
Given mergeable patches P1, P2, P3:
  P1 touches: auth.go, config.go
  P2 touches: api.go, routes.go
  P3 touches: auth.go, middleware.go

File overlap graph:
  P1 <--auth.go--> P3
  P2 (isolated)

Optimal merge order:
  1. P2 (no overlap with anything — safe first)
  2. P1 (overlaps with P3 on auth.go)
  3. P3 (rebases against P1's auth.go changes — one rebase instead of two)

Worst order:
  1. P3 then P1 (both touch auth.go, guaranteed conflict for whichever goes second)
```

**Algorithm:**

```python
def compute_merge_order(mergeable_patches):
    # Build file overlap graph
    overlap = {}
    for p1, p2 in combinations(mergeable_patches, 2):
        shared_files = p1.files & p2.files
        if shared_files:
            overlap[(p1, p2)] = len(shared_files)

    # Greedy ordering: merge isolated patches first, then by trust score
    ordered = []
    remaining = set(mergeable_patches)

    while remaining:
        # Find patch with fewest overlaps to remaining patches
        candidates = sorted(remaining, key=lambda p: (
            sum(1 for other in remaining - {p} if (p, other) in overlap or (other, p) in overlap),
            -trust_score(p.author),  # tiebreak: higher trust first
        ))
        next_patch = candidates[0]
        ordered.append(next_patch)
        remaining.remove(next_patch)

    return ordered
```

This runs in the merge authority's NIP handler when processing the merge queue. The overhead is negligible (< 1ms for typical patch counts).

#### 3.8.7 Combined Strategy Summary

| # | Strategy | Conflict Reduction | Type | Complexity | Nostr NIPs Used |
|---|---|---|---|---|---|
| 1 | Domain-scoped Towns | **60-70%** | Organizational | Low | NIP-34 (domain tags in kind:30617) |
| 2 | File-level ownership claims | **20-30%** | Advisory protocol | Medium | kind:30078 claims + NIP-32 labels |
| 3 | Pre-merge conflict detection DVM | **10-20%** | Automated | Medium | NIP-90 (kind:5951/6951) + NIP-32 labels |
| 4 | Small, frequent patches | **15-25%** | Protocol policy | Low | NIP-34 (kind:1617 design) + NIP-29 (group policy) |
| 5 | Conflict-aware merge ordering | **5-15%** | Algorithmic | Medium | Merge authority logic |

**These strategies are complementary and compound.** With all five active:

- Domain scoping eliminates most conflicts at the organizational level
- Ownership claims catch the remaining cross-domain work
- Conflict detection DVM flags any that slip through
- Small patches reduce the blast radius of conflicts that do occur
- Merge ordering minimizes cascading rebases

**Estimated combined conflict rate** (compared to naive cross-Town merging): **< 10% of patches require conflict resolution**, down from an estimated 40-60% without mitigation.

#### 3.8.8 Conflict Resolution When Prevention Fails

When a conflict does occur despite prevention:

```
1. Merge authority attempts patch application
2. Git reports conflict
3. Merge authority publishes:
   - kind:1632 (closed) on the patch
   - NIP-32 label: "conflict" with content describing conflicting files
4. Contributing Town receives notification
5. Contributing Town's Refinery:
   a. Pulls latest from shared remote
   b. Rebases local branch against new target
   c. Local Polecat resolves conflict hunks
   d. Refinery re-merges locally
   e. Mayor publishes kind:1619 (PR update) with rebased patch
6. Review cycle restarts (but previous approvals may carry over if only conflict hunks changed)
```

**Trust impact of conflicts:**

```
conflict_penalty(town) = 0.02 per conflict (small)
repeated_conflict_penalty(town) = 0.02 * conflict_count_30d / 5  (escalating)
```

Occasional conflicts are normal and expected. Only chronic conflicts (> 5/month) meaningfully impact trust score, encouraging Towns to adopt prevention strategies.

---

### 3.9 Failure Modes and Mitigations (updated)

| Failure Mode | Probability | Impact | Mitigation |
|---|---|---|---|
| **Network partition** between Towns | Medium | High (cross-Town merges stall) | Timeout + fallback to local-only; resume on reconnection. Local Town work is never blocked. |
| **Relay unavailability** | Low-Medium | Medium (patch delivery fails) | Multi-relay redundancy (NIP-65 relay list); patches stored on 3+ relays |
| **Payment channel exhaustion** | Medium | Medium (CI/review payment stalls) | Pre-fund channels; trust-based credit for known peers |
| **Nostr event ordering** | Certain | Low (handled by design) | NIP-34 patches include `previous` tags referencing prior events; timestamps resolve ambiguity |
| **Eventual consistency of Beads** | Certain | Medium | Accept lag; cross-Town reads are advisory, not authoritative |
| **Key compromise** | Low | Very High (identity theft) | Key rotation via NIP-02 update; revocation via kind:5; group membership revoked via kind:9001 |
| **Split-brain merge** (two Towns merge same patch simultaneously) | Low | Medium (duplicate merge) | Merge authority selection algorithm (Section 3.3.2) ensures single authority per patch. If race condition occurs, git's content-addressable nature means identical merges produce identical commits — no divergence. |
| **Malicious CI result** (DVM lies about tests passing) | Low | High (broken code merged) | Require 2+ independent DVM results; CI runner reputation tracking; any Town can dispute and re-run |
| **Trust oracle manipulation** (NIP-85 provider games scores) | Low | High (wrong merge priority) | Multiple competing oracles; Towns can fall back to local BFS computation; oracle reputation tracked |
| **Review collusion** (low-trust Towns rubber-stamp each other) | Low | Medium (bad code merged) | Trust-weighted approval means low-trust approvals contribute little; min trust threshold per individual reviewer (e.g., each approver must have trust > 0.4) |

---

### 3.10 Updated Implementation Roadmap (Phase 3)

#### Phase 3: Decentralized Merge + State (6-8 weeks)

**Goal:** Cross-Town agents can contribute to shared codebases using NIP-34 with trust-weighted multi-approval.

| Task | Complexity | Dependencies |
|---|---|---|
| 3.1 NIP-34 repo announcement (kind:30617) for shared codebases | Low | Phase 1 (identity) |
| 3.2 NIP-34 patch publishing from Town Refinery (kind:1617) | Medium | 3.1, Phase 1 |
| 3.3 NIP-32 review label namespace and handlers | Medium | 3.2 |
| 3.4 Trust-weighted merge threshold computation | Medium | 3.3, Phase 2 (trust scores) |
| 3.5 Merge authority selection and patch application | High | 3.4 |
| 3.6 NIP-90 DVM CI runner (test execution as a service) | Medium | 3.2 |
| 3.7 NIP-29 project group setup and membership management | Medium | 3.1, Phase 1 |
| 3.8 Beads -> Nostr event sync (kind:1617 publishing, kind:1630-1633 status) | Medium | 3.2 |
| 3.9 Remote dependency tracking in Beads | Medium | 3.8 |
| 3.10 Distributed `bd prime` with remote context | Medium | 3.8, 3.9 |
| 3.11 Cross-machine seance (`gt seance --remote`) | Low | 3.8 |
| 3.12 File-level ownership claim protocol (kind:30078 claims) | Medium | 3.2, 3.7 |
| 3.13 NIP-90 DVM conflict detection service (kind:5951/6951) | Medium | 3.6, 3.12 |
| 3.14 Domain-scoped Town tags in repo announcement (kind:30617) | Low | 3.1 |
| 3.15 Conflict-aware merge ordering in merge authority logic | Medium | 3.5, 3.13 |
| 3.16 Patch size policy enforcement in NIP-29 group relay | Low | 3.7 |
| 3.17 NIP-46 remote signer for Polecat patch submission | Medium | 3.2, Phase 1 |
| 3.18 NIP-40 expiration tags on claims, CI results, drafts | Low | 3.6, 3.12, 3.13 |
| 3.19 NIP-51 reviewer/CI provider follow sets and review queue bookmarks | Medium | 3.3, 3.6 |
| 3.20 NIP-53 live activity for merge sessions | Medium | 3.5 |
| 3.21 NIP-56 reporting handlers for merge abuse | Low | 3.4 |
| 3.22 NIP-77 negentropy sync for merge state recovery | Medium | 3.8 |
| 3.23 Integration test: 3 Towns, shared repo, trust-weighted merge + conflict prevention + NIP enhancements | Very High | 3.1-3.22 |

**Deliverable:** Multiple Towns collaborating on a shared codebase with decentralized review, distributed CI, trust-based merge authority, proactive conflict prevention, secure Polecat signing, and lifecycle management — no centralized Integration Refinery.

---

### 3.11 Comparison: Integration Refinery vs. NIP-34 Multi-Approval

| Aspect | v1: Integration Refinery | v2: NIP-34 Multi-Approval |
|---|---|---|
| **Architecture** | Centralized (one designated Town) | Decentralized (social graph decides) |
| **Single point of failure** | Yes (designated Town) | No (any qualified Town can merge) |
| **Merge authority** | One Refinery process | Emergent from trust-weighted approval |
| **Code review** | Internal to one Town | Distributed labels from multiple Towns (NIP-32) |
| **CI/Testing** | One Refinery runs tests | DVM marketplace — any Town earns by running CI (NIP-90) |
| **Coordination** | Custom protocol | NIP-29 project groups |
| **Trust computation** | Each Town computes locally | NIP-85 trust oracles (cacheable, efficient) |
| **Nostr-native** | No (custom bolt-on) | Yes (NIP-34 + 32 + 85 + 90 + 29 + 40 + 46 + 51 + 53 + 56 + 77) |
| **Payment model** | N/A | Patch contributors + CI runners get paid via ILP |
| **Failure recovery** | Failover to backup Town (manual) | Automatic: next-highest-trust Town takes over |
| **Scalability** | Limited by single Refinery throughput | Scales with number of qualified Towns |
| **Incentive alignment** | None (designated role) | Trust increases with good merges; bad merges reduce trust and access |

---

### 3.12 Additional NIP Enhancements for Merge Architecture

The following NIPs were assessed against the merge architecture's specific needs. Each enhances an existing aspect of the decentralized merge flow. NIPs that duplicate ILP functionality or solve problems eliminated by the peering-gated model (see main analysis, Section 4.2) were excluded.

> For the full NIP assessment including rejected candidates with reasoning, see the main analysis Section 9.

#### 3.12.1 NIP-46: Remote Signing — Secure Patch Submission

**Problem:** Polecats submit patches (kind:1617) and work status updates (kind:30078) by signing with the Rig's shared keypair. A compromised Polecat has the Rig's full signing authority — it could publish fake patches, manipulate merge status, or forge review labels.

**Solution:** The Rig runs a NIP-46 remote signer daemon. Polecats request signing via kind:24133 with scoped permissions:

```
Polecat "Toast" — merge-relevant permissions:

  Allowed:
    sign_event:30078    (work status: "working", "done")
    sign_event:1617     (patch submission)
    sign_event:7000     (DVM feedback — CI results)
    nip44_encrypt       (encrypted patch content for private repos)

  Denied:
    sign_event:1985     (review labels — only Mayors review)
    sign_event:1631     (merge status — only merge authority publishes)
    sign_event:9000     (NIP-29 group admin)
    sign_event:30617    (repo announcements)
    sign_event:23194    (SPSP requests — payment channel manipulation)
```

**Impact on merge flow:**
- Patches are signed via the signer, so they're still attributed to the Rig's npub — NIP-34 authorship is preserved
- A compromised Polecat cannot forge merge status events (kind:1631) or review labels (kind:1985)
- Merge authority verification is strengthened: only events signed for permitted kinds are valid
- Rig revokes Polecat's signer connection on tmux session death — no lingering signing capability

#### 3.12.2 NIP-40: Expiration for Merge Lifecycle Events

Several merge-related events should auto-expire to prevent stale state:

| Event | Kind | Expiration | Rationale |
|---|---|---|---|
| File ownership claims | 30078 (status=working) | Estimated duration * 2 | Prevents stale claims from blocking other Towns (Section 3.8.3) |
| DVM CI results | 6950 / 6951 | 24 hours | Stale test results shouldn't inform merge decisions — code changes invalidate old results |
| DVM CI job requests | 5950 / 5951 | 48 hours | Unclaimed CI jobs should expire rather than accumulate |
| Patch draft status | 1633 | 7 days | Draft patches abandoned for a week should clear from review queues |
| Conflict detection results | 6951 | 12 hours | Conflict landscape changes as patches merge — stale detection is misleading |

**Implementation:** Add `["expiration", "<unix-timestamp>"]` tag to these events per NIP-40. Relays automatically stop serving expired events. NIP handlers should also check expiration client-side as a defense against non-compliant relays.

**Integration with conflict prevention (Section 3.8):**
- Ownership claims (Strategy 2) get automatic timeout — no manual cleanup, no indefinite locks
- Conflict detection DVM results (Strategy 3) auto-expire, forcing fresh checks before merge

#### 3.12.3 NIP-51: Lists for Merge Configuration

Mayors use NIP-51 lists to manage merge-related configuration:

| List Kind | `d` tag | Purpose |
|---|---|---|
| kind:30000 (follow set) | `crosstown-reviewers` | Towns this Mayor trusts for NIP-32 patch review labels — subset of full follow list |
| kind:30000 (follow set) | `crosstown-ci-providers` | Towns qualified to run DVM CI for this Town's repos |
| kind:30003 (bookmark set) | `crosstown-review-queue` | Patches (kind:1617) awaiting this Mayor's review — ordered by priority |
| kind:30002 (relay set) | `crosstown-project-<name>-relays` | Per-project relay configuration for patch events, CI results, review labels |

**Impact on merge flow:**
- **Reviewer scoping:** When computing merge threshold (Section 3.3.1), only approvals from Towns in the repo's `crosstown-reviewers` follow set count. This prevents random followers from rubber-stamping patches.
- **CI provider scoping:** DVM CI results are only trusted from Towns in the `crosstown-ci-providers` follow set. This mitigates the malicious CI result risk (Section 3.9).
- **Review queue management:** Mayors can track their pending reviews as a bookmarked list, auto-ordered by trust-weighted priority.

**Private items:** Sensitive merge config (internal trust thresholds, domain ownership overrides) can be stored in the list's encrypted `.content` field via NIP-44.

#### 3.12.4 NIP-53: Live Activities for Merge Session Monitoring

When a merge authority is processing a batch of patches, the session is published as a live activity:

```json
{
  "kind": 30311,
  "tags": [
    ["d", "merge-session-<timestamp>"],
    ["title", "Town B: Processing 4 patches for agent-marketplace"],
    ["status", "live"],
    ["p", "<merge-authority-mayor-npub>", "", "Host"],
    ["t", "merge"],
    ["starts", "<unix-timestamp>"],
    ["a", "30617:<repo-owner>:<repo-d-tag>"]
  ]
}
```

**Use cases in merge flow:**
- **Collision prevention:** Other merge authorities see an active merge session for the same repo and defer — prevents the split-brain merge scenario (Section 3.9) more gracefully than relying solely on the authority selection algorithm
- **Progress visibility:** Contributing Towns can watch their patch move through the merge pipeline in real-time via kind:1311 live chat updates
- **Deacon monitoring:** The Deacon watches for merge sessions that go `status: "live"` without updates for > 30 minutes — indicates a stuck merge that needs intervention
- **Staleness:** Per NIP-53, clients treat unchanged live events older than 1 hour as ended — automatic cleanup of dead merge sessions

#### 3.12.5 NIP-56: Reporting for Merge Abuse

Bad behavior in the merge process needs a negative signal mechanism:

```json
{
  "kind": 1984,
  "tags": [
    ["p", "<bad-town-npub>", "spam"],
    ["e", "<offending-patch-event-id>"]
  ],
  "content": "Town submitted 3 consecutive patches with intentionally failing tests to waste CI DVM resources."
}
```

**Merge-specific report scenarios:**

| Behavior | NIP-56 Category | Trust Impact |
|---|---|---|
| Submitting patches that consistently fail CI | `spam` | Reduced merge trust; higher review threshold required |
| Malicious code in patches (backdoors, credential theft) | `malware` | Immediate removal from NIP-29 project group; trust score zeroed for repo |
| Rubber-stamping reviews without reading code | `spam` | Review labels from this Town no longer count toward merge threshold |
| Forging CI results (DVM returns fake "passing") | `other` | Removed from `crosstown-ci-providers` follow set |
| Claiming merge authority but not completing merge | `other` | Temporary exclusion from merge authority selection |

**Integration with trust scores:**

```
merge_trust_penalty(town) = Σ (trust(reporter) * category_weight) for reports in last 90 days

category_weights:
  malware:        1.0  (maximum penalty)
  spam:           0.3
  impersonation:  0.8
  other:          0.5
```

Reports from high-trust Towns (trust > 0.7) carry proportionally more weight. Reports from low-trust Towns are near-negligible, preventing weaponized reporting.

#### 3.12.6 NIP-77: Negentropy for Merge State Recovery

After a network partition, a Town needs to catch up on missed patches, reviews, CI results, and merge status events. NIP-77 provides efficient delta sync:

```
Town B comes back online after 6-hour partition:

1. NEG-OPEN with filter:
   kinds: [1617, 1619, 1630, 1631, 1632, 1633, 1985, 6950, 6951]
   #a: [30617:<repo-owner>:<repo-d-tag>]
   since: <last_seen_timestamp>

2. Relay responds with fingerprints of event ranges

3. Town B identifies missing events via range reconciliation

4. Downloads only the delta (new patches, reviews, merges that happened during partition)
```

**Bandwidth savings at scale:**
- Without NIP-77: Re-download all events since `last_seen` — potentially thousands of events
- With NIP-77: Exchange fingerprints first, download only missing events — typically 80-95% bandwidth reduction

Most relevant for Phase 3+ when multiple repos across many Towns generate high event volumes. Essential for the failure mode "Network partition between Towns" (Section 3.9) — enables fast recovery without overwhelming relays on reconnection.

#### 3.12.7 DVM Payment Model: Peering-Gated ILP

> This section documents how NIP-90 DVM payments work within the merge architecture, aligning with the economic model decisions in the main analysis (Section 4).

**Design principle:** A Town can only accept DVM jobs (CI, conflict detection) from peered Towns. The SPSP handshake (kind:23194/23195) between peers establishes the payment channel — including ledger, denomination, and credit terms.

**DVM CI payment flow:**

```
Prerequisites:
  Town A and Town B are peered (NIP-02 + SPSP handshake)
  Payment channel open on agreed ledger (e.g., Lightning/msat)

1. Town A publishes DVM CI job request (kind:5950)
   bid: 50000                            ← price signal in peering denomination

2. Town B NIP handler receives request
   - Verifies Town A is a peer (NIP-02 check)
   - Rejects if not peered — no anonymous CI
   - Evaluates capacity, responds with kind:7000 feedback
     amount: 35000                        ← counter-offer in peering denomination
     ilp_address: g.town-b.rig.ci-runner

3. Town A sends ILP PREPARE
   - Amount: 35000 (in peering denomination)
   - Condition: SHA256(secret)
   - Expiry: per channel terms

4. Town B runs tests, publishes DVM result (kind:6950)

5. Town A verifies CI result
   - Sends ILP FULFILL (releases payment)
   - OR lets PREPARE expire if result invalid

6. Settlement on agreed schedule
```

**Rejected alternatives:**
- **NIP-47 (Wallet Connect):** Redundant with ILP. SPSP already handles payment setup; ILP PREPARE/FULFILL already provides atomic escrow. NIP-47 would lock to Lightning specifically, losing ILP's ledger-agnostic design.
- **NIP-13 (Proof of Work) for anti-spam:** Eliminated by peering gate. Non-peered Towns cannot submit DVM jobs. The social graph is the spam filter.

---

### 3.13 NIP Dependency Summary (Complete)

#### Core NIPs (Required)

| NIP | Role in Merge Architecture | Notes |
|---|---|---|
| **NIP-02** | Follow graph = peering relationships; peering gate for work dispatch | Foundation of trust model and access control |
| **NIP-34** | Core: patches (1617), PRs (1618), repo state (30618), status (1630-1633) | Foundation of cross-Town code collaboration |
| **NIP-32** | Code review labels and quality classification | Enables distributed review; `crosstown.review` namespace |
| **NIP-78** | Application-specific data (kind:30078 work dispatch) | Implicit — already the basis for Gas Town Work Dispatch events |
| **NIP-90** | Distributed CI + conflict detection DVM; peering-gated ILP payment | kind:5950/6950 for CI; kind:5951/6951 for conflict detection |

#### Recommended NIPs

| NIP | Role in Merge Architecture | Notes |
|---|---|---|
| **NIP-29** | Project group coordination and membership | Trust-driven roles; falls back to NIP-02 follow-graph scoping |
| **NIP-40** | Event expiration for merge lifecycle events | Auto-cleanup of stale claims, CI results, draft patches |
| **NIP-44** | Encrypted payloads for private repo patches | Required for private repos; optional for public |
| **NIP-46** | Remote signing for Polecat key isolation | Scoped signing prevents compromised Polecats from forging merge status |
| **NIP-51** | Structured lists for merge config | Reviewer sets, CI provider sets, review queues, relay sets |
| **NIP-53** | Live activities for merge session monitoring | Collision prevention; progress visibility; stuck merge detection |
| **NIP-65** | Multi-relay redundancy for patch delivery | Prevents relay-unavailability failures |
| **NIP-85** | Pre-computed trust assertions for merge decisions | Falls back to local BFS computation if unavailable |

#### Optional NIPs

| NIP | Role in Merge Architecture | Notes |
|---|---|---|
| **NIP-09** | Event deletion (retract a patch/review) | For correcting mistakes before merge |
| **NIP-56** | Reporting for merge abuse | Negative trust signal for bad patches, fake CI, review collusion |
| **NIP-77** | Negentropy syncing for merge state recovery | Efficient catch-up after partition; 80-95% bandwidth reduction |
| **NIP-89** | App handlers for event routing | Discover handlers for new event kinds as ecosystem evolves |

#### Rejected NIPs (Not Used)

| NIP | Why Rejected |
|---|---|
| **NIP-47** (Wallet Connect) | Redundant with ILP; SPSP handles payment setup; would lock to Lightning |
| **NIP-03** (OpenTimestamps) | Relay timestamps + ILP timing sufficient; adds 10+ min latency for non-problem |
| **NIP-99** (Classified Listings) | Redundant with NIP-90 DVMs for work dispatch |
| **NIP-13** (Proof of Work) | Eliminated by peering gate; social graph is the spam filter |

---

## Section 4: Economic Model Design

> **Revision Note (v2):** This section was revised to reflect two key architectural decisions:
> 1. **Peering is required for work dispatch.** A Town can only accept work from a Town it has an explicit NIP-02 peering relationship with. There are no anonymous or unknown-peer interactions.
> 2. **Payment terms are per-peering-relationship.** The SPSP handshake (kind:23194/23195) between two Towns establishes the payment channel — including which chain/ledger, denomination, and credit terms. There is no global denomination.

### 4.1 The Fundamental Question

Gas Town currently has no economic model. Agents are local processes with unlimited free communication. When work dispatch crosses machine/network boundaries via ILP, every message costs money. Who pays?

### 4.2 Peering-Gated Economic Model

#### Design Principle: No Peering, No Work

A Town can only dispatch work to — or accept work from — Towns it has an explicit peering relationship with (NIP-02 follow + SPSP handshake). This is enforced at the protocol level:

- NIP handlers reject DVM job requests from non-peered Towns
- ILP connectors only route to peers with established payment channels
- NIP-29 project groups enforce membership for patch submission

This eliminates an entire class of problems: spam, sybil attacks, unknown-peer pricing, and free-riding. The social graph is the access control layer.

#### Tier 0: Free (Local)

All communication within a single Gas Town instance remains free. No ILP packets, no payment channels. This is the current model and is preserved.

#### Tier 1: Peered (SPSP-Negotiated Terms)

For all cross-Town interactions, payment terms are established during the SPSP handshake:

```
Town A Mayor follows Town B Mayor (NIP-02)
  → kind:10032 exchange (ILP Peer Info: address, BTP endpoint, capabilities)
  → SPSP handshake (kind:23194 request / kind:23195 response)
    Negotiated parameters:
      settlement_ledger:    "lightning" | "ethereum-l2" | "xrp" | ...
      denomination:         "msat" | "wei" | "drops" | ...
      credit_limit:         <amount in denomination>
      settlement_frequency: "hourly" | "daily" | "per-transaction"
      max_packet_amount:    <amount in denomination>
  → Payment channel opened on agreed ledger
```

The SPSP handshake is the **single source of truth** for all payment parameters between two Towns. Every subsequent interaction — DVM jobs, messaging, patches, CI — uses the terms established here.

#### Credit Limits Within Peering

Crosstown's `SocialTrustManager` computes trust scores that inform credit limits:

```
trust = 0.5 * socialDistanceScore + 0.3 * mutualFollowersScore + 0.2 * reputationScore
```

For direct follows (distance=1), typical trust scores are 0.7-0.95. The credit limit is:

```
credit_limit = base_credit * trust_score
```

Where `base_credit` is denominated in whatever unit the peers agreed on during SPSP. Messages within this credit limit are **free at point of use** — they deplete a credit balance that is settled on the agreed schedule.

### 4.3 DVM Payment Flow (NIP-90 + ILP)

When cross-Town work dispatch uses NIP-90 DVMs, the DVM bid amount serves as a **price signal** and the payment executes via the peering channel's ILP PREPARE/FULFILL:

```
Prerequisites:
  - Town A and Town B are peered (NIP-02 + SPSP handshake complete)
  - Payment channel open on agreed ledger (e.g., Lightning, denomination: msat)

Flow:

1. Town A Mayor publishes DVM job request (kind:5xxx)
   Tags:
     ["i", "<patch-event-id>", "event"]
     ["bid", "50000"]                          ← price signal in peering denomination
     ["relays", "wss://relay1.example.com"]

2. Town B NIP handler receives job request
   - Verifies Town A is a peer (NIP-02 follow check)
   - Rejects if not peered
   - Evaluates capacity and cost

3. Town B responds with kind:7000 feedback
   Status: "payment-required"
   Amount: 35000                               ← counter-offer in peering denomination
   ILP address: g.town-b.rig.ci-runner

4. Town A sends ILP PREPARE
   - Amount: 35000 (in peering denomination)
   - Condition: SHA256(secret)
   - Expiry: per channel terms (e.g., 30 minutes)
   - Funds locked in payment channel

5. Town B Polecat executes work
   - Local to Town B (no network cost)
   - Results generated

6. Town B publishes DVM result (kind:6xxx)
   - Includes: result data, fulfillment hash

7. Town A verifies result
   - Validates output meets job requirements
   - Sends ILP FULFILL (releases locked funds)
   - OR lets PREPARE expire if result is unacceptable

8. Payment channel settles on agreed schedule
```

**Key properties:**
- **Atomic:** Funds lock before work starts (ILP PREPARE), release only on verified delivery (ILP FULFILL), or return to sender on expiry
- **Denomination-agnostic:** Bid amounts use whatever unit the peers agreed on during SPSP — no global denomination required
- **No trust required beyond peering:** The ILP PREPARE/FULFILL pattern provides escrow without trusting the counterparty to deliver after payment

### 4.4 Work-for-Pay Pattern (Wanted Work)

For larger work items dispatched as DVM jobs:

```
1. Town A Mayor publishes DVM job request (kind:5xxx)
   - Includes: bead description, effort estimate, bid amount
   - Bid denominated in peering channel terms

2. Town B Mayor claims work (kind:7000 feedback: "processing")

3. Town A sends ILP PREPARE
   - Locks bid amount in payment channel
   - Expiry: proportional to effort estimate

4. Town B Polecat executes work
   - Local to Town B (no network cost)
   - Results pushed to shared git remote

5. Town B publishes DVM result (kind:6xxx)
   - Includes: commit SHA, test results, stamps, fulfillment data

6. Town A Mayor verifies completion
   - Pulls from git remote, reviews changes
   - Sends ILP FULFILL with agreed payment amount

7. Payment channel settles on agreed schedule
```

#### Payment Amounts

The payment should cover:
- **LLM token cost** for the executing Polecat (~$5-$50 per task depending on complexity)
- **Infrastructure cost** for the hosting Town (compute, storage, bandwidth)
- **Profit margin** incentivizing participation

Suggested formula:
```
payment = token_cost * 1.2 + base_fee
```

Denominated in whatever unit the peering channel uses. This creates a **market for agent computation** where peered Towns compete on price and trust score.

### 4.5 Payment Channel Topology

```
                    ┌─────────────┐
           ┌──────►│  Town A      │◄──────┐
           │       │  (Mayor npub)│       │
           │       └──────────────┘       │
           │                              │
     ILP Channel                    ILP Channel
     (Lightning,                    (Ethereum L2,
      msat, trust=0.9)              wei, trust=0.8)
           │                              │
           ▼                              ▼
    ┌──────────────┐              ┌──────────────┐
    │  Town B      │◄─────────►  │  Town C      │
    │  (Mayor npub)│  ILP Channel │  (Mayor npub)│
    └──────────────┘  (Lightning, └──────────────┘
                       msat,
                       trust=0.7)
```

**Channel management:**
- Towns maintain channels only with directly-peered Towns (NIP-02 follow + SPSP handshake)
- Each channel has its own ledger, denomination, and credit terms — no global standard required
- Multi-hop routing via ILP connectors for indirect peers (Town A can pay Town C through Town B if A-B and B-C channels exist)
- Trust score determines credit limit within each channel
- Settlement frequency: as agreed during SPSP handshake

**No channel with unknown Towns.** If Town D wants to interact with Town A, it must first establish a peering relationship (NIP-02 follow + SPSP handshake). This is the entry gate to the network.

### 4.6 Cost Projections

| Scale | Agents | Messaging Cost/Hr | Token Cost/Hr | Total/Hr |
|---|---|---|---|---|
| Single Town (baseline) | 20-30 | $0 | $100-$300 | $100-$300 |
| 2 Towns, light federation | 40-60 | $0.50-$2 | $200-$600 | $200-$602 |
| 5 Towns, active federation | 100-150 | $2-$10 | $500-$1,500 | $502-$1,510 |
| 20 Towns, marketplace | 400-600 | $10-$50 | $2,000-$6,000 | $2,010-$6,050 |

**Messaging costs are negligible** (<1% of total cost) at all scale points. The economic model is viable because the dominant cost (LLM tokens) already exists; ILP adds only marginal overhead.

Note: Cost projections use USD equivalents for comparison. Actual amounts are denominated per-channel as agreed during SPSP handshake.

---

## Section 5: Memory and State Architecture

### 5.1 Beads <-> Nostr Event Synchronization

#### Mapping Beads Concepts to Nostr Events

| Beads Concept | Nostr Mapping | Sync Direction |
|---|---|---|
| Issue (open/in_progress) | kind:30078 (parameterized-replaceable, d=bead_id) | Beads -> Nostr (publish) |
| Issue (closed) | kind:30080 (completion, references bead_id) | Beads -> Nostr (publish) |
| Dependency edge | Tag: `["dep", "<type>", "<target_bead_id>"]` | Beads -> Nostr (in event tags) |
| Comment | Not synced (local only) | None |
| Wisp (ephemeral) | Not synced | None |
| Agent state | kind:10032 update (ILP Peer Info + agent state tag) | Beads -> Nostr |
| KV store | Not synced (local configuration) | None |
| Compacted issue | Not synced (historical) | None |

#### Sync Protocol

**Outbound (Beads -> Nostr):**

Beads' FlushManager already supports a hook-based export pipeline. A Nostr export hook would:

1. On bead status change (FlushManager fires after 5-second debounce)
2. Serialize changed beads as Nostr events (kind:30078)
3. Sign with Town's Nostr keypair
4. Publish to configured relays
5. Optionally wrap in ILP PREPARE for payment-gated relay storage

**Inbound (Nostr -> Beads):**

Crosstown's NIP handler (Epic 11 agent runtime) would:

1. Subscribe to kind:30078 events from followed Towns
2. On new event: parse bead data, validate signature
3. Create/update external reference in local Beads: `external:<npub>:<rig>:<id>`
4. Update blocked_issues_cache if dependencies changed

### 5.2 Distributed `bd prime` Equivalent

`bd prime` injects open issues into an agent's context at session start. The distributed equivalent:

```
1. Local bd prime (unchanged):
   - Load local open issues from Beads DB
   - Inject session close protocol, core rules, essential commands

2. Remote context augmentation (new):
   - Query Nostr relays for kind:30078 events from followed Towns
   - Filter for: assigned to this Town, status=open, has cross-Town dependencies
   - Inject as "Remote Work Items" section in prime output
   - Include: bead ID, title, assigning Town npub, dependencies, payment offer
```

This extends `bd prime`'s existing customization mechanism (`.beads/PRIME.md`) with a network-aware section.

### 5.3 Cross-Machine Seance via Event History

Gas Town's `gt seance` provides historical context about past agent sessions. The distributed equivalent uses Nostr event queries:

```
gt seance --remote <npub>
  -> Query kind:30080 (completions) by npub, last 30 days
  -> Query kind:30078 (work dispatches) to/from npub
  -> Query kind:14 (DMs) with npub (if authorized)
  -> Compile into narrative context for the requesting agent
```

Nostr's built-in event persistence and filtering (NIP-01 REQ with filters) makes this straightforward. The relay stores events; the client queries by pubkey + kind + time range.

### 5.4 State Consistency Model

**Accepted tradeoffs:**

| Property | Local (Beads) | Distributed (Nostr) |
|---|---|---|
| Consistency | Strong (single-writer DB) | Eventual (relay propagation delay) |
| Availability | High (local filesystem) | Medium (relay-dependent) |
| Partition tolerance | N/A (single machine) | Yes (multiple relays) |
| Read freshness | Immediate | Seconds to minutes lag |
| Write conflicts | Last-writer-wins (Dolt cell merge) | Timestamp ordering; cross-Town writes are to different namespaces |

**Design principle:** Each Town is authoritative for its own beads. Cross-Town references are **advisory** -- they inform scheduling and priority but don't block local execution. If a remote dependency's status is unknown (relay unavailable), the local agent can proceed optimistically and reconcile later.

---

## Section 6: Scaling Projections

### 6.1 Agent Count Scaling Curves

#### 30 Agents (Single Town, Baseline)

- **Network overhead**: 0 (all local)
- **Nostr events/second**: 0
- **ILP packets/second**: 0
- **Bottleneck**: Sequential Refinery merge queue; human review
- **Estimated cost**: $100-$300/hour (LLM tokens only)

#### 100 Agents (3-5 Towns, Light Federation)

- **Network overhead**: ~3,000 events/hour = 0.83 events/second
- **Nostr relay capacity used**: <0.01% of single strfry relay
- **ILP channels**: 3-10 inter-Town channels
- **Bottleneck**: Cross-Town git integration (merge conflicts at integration points)
- **Estimated cost**: $500-$1,500/hour + $2-$10/hour messaging
- **Key scaling benefit**: Merge conflicts reduced by ~60-70% (agents in different Towns touch different files)

#### 500 Agents (15-20 Towns, Active Marketplace)

- **Network overhead**: ~50,000 events/hour = 14 events/second
- **Nostr relay capacity used**: <1% of enterprise relay
- **ILP channels**: 50-100 inter-Town channels
- **Bottleneck**: Trust computation at scale (BFS over large follow graph); payment channel rebalancing
- **Estimated cost**: $2,500-$7,500/hour + $20-$100/hour messaging
- **Key scaling benefit**: Specialized Towns (security-focused, frontend-focused) reduce merge conflicts further; marketplace competition drives down per-task costs

#### 1,000+ Agents (50+ Towns, Internet-Scale Network)

- **Network overhead**: ~100,000 events/hour = 28 events/second
- **Nostr relay capacity used**: <5% of enterprise relay cluster
- **ILP channels**: 200-500 inter-Town channels
- **Bottleneck**: Coordination complexity (75% management threshold); requires hierarchical Town structure with "meta-Towns" coordinating Town clusters
- **Estimated cost**: $5,000-$15,000/hour + $50-$500/hour messaging
- **New capability**: Global agent marketplace; Towns bid for work across the network; reputation and trust scores drive market efficiency

### 6.2 Network Overhead Analysis

| Metric | 30 agents | 100 agents | 500 agents | 1,000 agents |
|---|---|---|---|---|
| Events/second (Nostr) | 0 | 0.83 | 14 | 28 |
| Bandwidth (KB/s) | 0 | 0.5 | 8.4 | 16.8 |
| ILP packets/second | 0 | 0.1 | 1.5 | 3 |
| Relay storage/day (MB) | 0 | 1.8 | 30 | 60 |
| Payment channels | 0 | 3-10 | 50-100 | 200-500 |
| Trust computations/hour | 0 | 50-100 | 500-1,000 | 2,000-5,000 |

**Relay capacity is never the bottleneck.** Even at 1,000 agents, the event volume (28/second) is trivial for any production Nostr relay. The bottleneck shifts to:

1. **Trust computation**: BFS over large follow graphs becomes expensive. Mitigation: cache trust scores with TTL; recompute only on NIP-02 changes.
2. **Payment channel management**: 200-500 channels require active rebalancing. Mitigation: trust-based credit limits reduce settlement frequency.
3. **Git integration**: Cross-Town merges require shared git hosting. Mitigation: GitHub/GitLab as the integration layer; each Town pushes to feature branches.
4. **Coordination overhead**: More Towns = more communication. Mitigation: hierarchical structure (meta-Towns coordinate clusters of 5-10 Towns).

### 6.3 Comparison with Existing Distributed Agent Frameworks

| Aspect | Gas Town + Crosstown | AutoGen v0.4 | LangGraph Platform | Temporal Workers |
|---|---|---|---|---|
| **Max tested agents** | 20-30 (local) | Unknown (distributed) | Unknown | Millions of workflows |
| **Identity** | Nostr keypair (decentralized) | API keys (centralized) | Config-based | Worker identity tokens |
| **Payment** | ILP channels (per-message) | None | None | None |
| **Trust** | Social graph + payment history | None | None | None |
| **Discovery** | NIP-02 + kind:10032 (decentralized) | Manual config | Manual config | Task queue registration |
| **Communication latency** | 50-200ms (Nostr) | gRPC (~10ms) | HTTP (~50ms) | Task queue (~50-150ms) |
| **State persistence** | Beads (git-backed) + Nostr events | Custom (no default) | Graph checkpoints | Event-sourced history |
| **Failure recovery** | GUPP (self-activation from state) | Manual retry | Graph replay | Automatic replay |
| **Unique advantage** | Decentralized + economic incentives | Cross-language | Production platform | Proven at massive scale |

**Key insight:** No existing framework provides the combination of decentralized identity, payment-gated messaging, and trust-based routing. Crosstown's unique contribution is precisely these missing layers. However, the proven scalability of Temporal (millions of workflows) suggests that some architectural patterns (task queues, event sourcing, automatic replay) should inform the design.

---

## Section 7: Secondary Research Questions

### 7.1 Beads Molecule Workflows + NIP-90 DVMs (Question 6)

Gas Town's MEOW Stack maps to Crosstown's planned NIP-90 DVM system:

| MEOW Concept | DVM Equivalent | Mapping Quality |
|---|---|---|
| Formula (TOML definition) | DVM Job Request (kind:5000-5999) | **Good** - Both define work specifications |
| Molecule (runtime instance) | DVM Job + Feedback chain | **Partial** - Molecules have richer state |
| Wisp (ephemeral step) | DVM Job Feedback (kind:7000) | **Good** - Both are ephemeral status updates |
| Convoy (parallel legs) | Multiple DVM Jobs with shared tag | **Partial** - No native convoy concept in NIP-90 |
| Synthesis (combine results) | DVM Result aggregation (kind:6000-6999) | **Partial** - Requires custom aggregation logic |

**Workflow example: Multi-step code review as DVM chain:**

```
Formula: code-review-pipeline
  Step 1: DVM Job Request (kind:5100) - "lint code"
    -> ILP payment gates execution
    -> DVM Result (kind:6100) - lint output
  Step 2: DVM Job Request (kind:5101) - "run tests"  [needs: step-1]
    -> ILP payment gates execution
    -> DVM Result (kind:6101) - test results
  Step 3: DVM Job Request (kind:5102) - "security scan" [needs: step-1]
    -> ILP payment gates execution
    -> DVM Result (kind:6102) - security findings
  Synthesis: DVM Job Request (kind:5103) - "compile review" [needs: step-2, step-3]
    -> ILP payment gates execution
    -> DVM Result (kind:6103) - final review
```

**Assessment:** The mapping works for simple sequential/parallel workflows but loses Gas Town's rich state management (molecule lifecycle, wisp TTL, swarm coordination). A full mapping would require extending NIP-90 with Gas Town-specific event kinds or tags.

### 7.2 Witness/Deacon as Nostr Monitoring Agents (Question 7)

| Gas Town Role | Nostr Implementation | Event Kinds |
|---|---|---|
| **Witness** (monitors Polecats) | NIP handler subscribing to kind:30078 (work dispatch status) | Filter: `kinds:[30078], authors:[rig_npubs]` |
| **Deacon** (system watchdog) | Periodic Nostr queries + heartbeat events | Publish kind:10032 updates; query kind:30078 for stale work |
| **Seance** (historical context) | Nostr event query with time range filter | `REQ: kinds:[30078,30080], authors:[npub], since:<timestamp>` |

The Witness currently monitors Polecats by inspecting tmux sessions. A Nostr-based Witness would instead subscribe to work status events:

```
1. Polecat publishes kind:30078 with status tags:
   ["status", "working"], ["bead", "gt-abc12"], ["polecat", "Toast"]

2. Witness subscribes:
   REQ: kinds:[30078], #p:[witness_npub], since:<session_start>

3. Stale detection:
   If no kind:30078 update from Polecat in >30 minutes -> alert

4. POLECAT_DONE:
   Polecat publishes kind:30078 with ["status", "done"], ["exit-type", "COMPLETED"]
   Witness routes to Refinery via kind:14 (MERGE_READY)
```

**Assessment:** This works well for **remote** Polecats. For local Polecats, the existing tmux-based monitoring is lower-latency and more reliable. The hybrid approach: local Witness monitors local Polecats via tmux; remote Witness role monitors cross-Town agents via Nostr subscriptions.

### 7.3 Cross-Town Federation (Question 8)

Gas Town's Wasteland protocol (`internal/wasteland/`) already implements federation via DoltHub. Crosstown can replace DoltHub as the federation transport:

| Wasteland Concept | DoltHub (Current) | Nostr/ILP (Proposed) |
|---|---|---|
| Town registry | DoltHub `towns` table | NIP-02 follow graph + kind:10032 |
| Wanted work posting | DoltHub `wanted` table | NIP-90 DVM job request (kind:5xxx) |
| Work claiming | DoltHub row update | DVM feedback (kind:7000) + ILP PREPARE |
| Completion evidence | DoltHub `completions` table | DVM result (kind:6xxx) + kind:30080 |
| Trust/stamps | DoltHub `stamps` table | Crosstown trust scores |
| Badges | DoltHub `badges` table | NIP-58 badges (planned Epic 15) |

**Town-to-Town peering in Nostr/ILP terms:**

```
1. Each Town's Mayor has a Nostr keypair (the Town's identity)
2. Towns peer via NIP-02 follows (Mayor A follows Mayor B)
3. kind:10032 events publish each Town's ILP address and capabilities
4. SPSP handshake (kind:23194/23195) establishes payment channel
   - Peers agree on settlement ledger, denomination, credit terms
5. Work dispatch uses NIP-90 DVM jobs + ILP PREPARE/FULFILL
   - DVM bid denominated in peering channel terms
   - ILP provides atomic escrow (funds lock before work, release on delivery)
6. Federation is emergent from the social graph, not configured
7. Peering is required — no work dispatch to/from non-peered Towns
```

**Advantages over DoltHub:**
- No dependency on a centralized service (DoltHub)
- Real-time event delivery (vs. git push/pull polling)
- Built-in payment for cross-Town work
- Trust scores automate the "sovereignty tiers" concept

### 7.4 Agent Memory Convergence (Question 9)

**Proposed unified architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                   Unified Memory Layer                       │
│                                                             │
│  Beads (Persistent State)         │  Nostr (Real-time Events) │
│  ├── Open issues (local work)     │  ├── kind:30078 (status)  │
│  ├── Pinned issues (standing      │  ├── kind:14 (messages)   │
│  │   instructions)                │  ├── DVM jobs (kind:5xxx) │
│  ├── Dependency graph             │  ├── kind:30080 (done)    │
│  ├── KV store (config)            │  └── kind:10032 (peer     │
│  ├── Compacted history            │      info)                │
│  └── Agent state machine          │                           │
│                                                             │
│  bd prime (Session Bootstrap)     │  NIP Handler (Runtime)    │
│  ├── Local open issues            │  ├── Subscribe to events  │
│  ├── Remote work items (Nostr)    │  ├── Process with LLM     │
│  ├── Session close protocol       │  ├── Decide actions       │
│  └── Core rules + commands        │  └── Publish responses    │
└─────────────────────────────────────────────────────────────┘
```

**Integration pattern:**
1. `bd prime` bootstraps session with local state (Beads) + remote context (Nostr queries)
2. During session: Beads records local work; NIP handler processes incoming Nostr events
3. On status change: Beads FlushManager triggers Nostr event publish
4. On session end: `bd compact` summarizes completed work; completion evidence published to Nostr
5. Cross-session: `gt seance` queries both Beads history and Nostr event history

### 7.5 Trust-Weighted Merge Priority (Question 10)

> **Note:** The v2 merge architecture replaces merge *priority ordering* (which implies a queue and a single processor) with merge *threshold consensus* (trust-weighted multi-approval). The algorithm below is retained for reference but has been superseded by the trust-weighted multi-approval model in Section 3.3. The v2 model uses a richer trust composition that includes merge-specific reputation (merge success rate, code quality history, payment reliability).

**Original algorithm specification (v1, superseded):**

```python
def compute_merge_priority(mr, trust_engine, dependency_graph):
    # Trust component (0-1)
    author_trust = trust_engine.compute_trust(mr.author_npub)
    trust_component = author_trust.score  # 0.5*social + 0.3*mutual + 0.2*reputation

    # Urgency component (0-1)
    bead = dependency_graph.get(mr.bead_id)
    urgency = 1.0 - (bead.priority / 4.0)  # priority 0=critical -> urgency 1.0

    # Impact component (0-1)
    blocked_count = len(dependency_graph.get_blocked_by(mr.bead_id))
    impact = min(blocked_count / 10.0, 1.0)  # saturates at 10 blocked items

    # Conflict risk component (0-1, lower is better)
    diff_size = git_diff_stat(mr.branch, mr.target)
    conflict_risk = min(diff_size.files_changed / 50.0, 1.0)

    # Staleness prevention (increases linearly with time)
    hours_waiting = (now() - mr.created_at).hours
    staleness_bonus = min(hours_waiting / 24.0, 0.5)  # max 0.5 after 24 hours

    # Weighted combination
    priority = (
        0.30 * trust_component +
        0.25 * urgency +
        0.20 * impact +
        0.10 * (1.0 - conflict_risk) +
        0.15 * staleness_bonus
    )

    return priority
```

**Interaction with Beads dependency graph:**
- The `blocked_count` directly uses Beads' `blocked_issues_cache` (25x faster than recursive CTE)
- Dependencies of type `blocks`, `parent-child`, `conditional-blocks`, and `waits-for` affect ready-work calculation
- Trust scores are cached with 1-hour TTL to avoid expensive BFS recomputation
- Merge priority recomputed when: new MR arrives, dependency status changes, or trust scores update

---

## Section 8: Implementation Roadmap

### Phase 1: Identity + Communication (4-6 weeks)

**Goal:** Two Gas Town instances can exchange work requests via Nostr.

| Task | Complexity | Dependencies |
|---|---|---|
| 1.1 Nostr keypair generation for Gas Town (`gt init --nostr`) | Low | None |
| 1.2 kind:10032 publishing (Town ILP Peer Info) | Low | Crosstown core (existing) |
| 1.3 NIP-02 follow management (`gt federation add-peer --nostr`) | Medium | 1.1 |
| 1.4 Nostr mail transport (kind:14 for cross-Town messages) | Medium | 1.1, 1.3 |
| 1.5 NIP handler for kind:30078 (work dispatch) | Medium | Crosstown Epic 11 |
| 1.6 NIP handler for NIP-90 DVM job requests (work dispatch) | Medium | 1.5 |
| 1.7 Integration test: Town A dispatches work, Town B executes | High | 1.1-1.6 |

**Deliverable:** Working proof-of-concept of cross-Town work dispatch.

### Phase 2: Economic Model + Scaling (4-6 weeks)

**Goal:** Cross-Town work dispatch includes ILP payments.

| Task | Complexity | Dependencies |
|---|---|---|
| 2.1 ILP payment channel setup between Towns | Medium | Phase 1 |
| 2.2 Trust-based credit limits for inter-Town channels | Medium | 2.1 |
| 2.3 Payment gating for wanted work (escrow pattern) | High | 2.1 |
| 2.4 Completion verification + ILP FULFILL | High | 2.3 |
| 2.5 Cost tracking integration (`gt costs` + ILP ledger) | Medium | 2.1 |
| 2.6 Scaling test: 3 Towns, 60 agents, real work | High | 2.1-2.5 |

**Deliverable:** Functional marketplace where Towns buy/sell agent computation.

### Phase 3: Decentralized Merge + State (6-8 weeks)

**Goal:** Cross-Town agents can contribute to shared codebases using NIP-34 with trust-weighted multi-approval.

> Full task breakdown in Section 3.10.

| Task | Complexity | Dependencies |
|---|---|---|
| 3.1 NIP-34 repo announcement (kind:30617) for shared codebases | Low | Phase 1 (identity) |
| 3.2 NIP-34 patch publishing from Town Refinery (kind:1617) | Medium | 3.1, Phase 1 |
| 3.3 NIP-32 review label namespace and handlers | Medium | 3.2 |
| 3.4 Trust-weighted merge threshold computation | Medium | 3.3, Phase 2 (trust scores) |
| 3.5 Merge authority selection and patch application | High | 3.4 |
| 3.6 NIP-90 DVM CI runner (test execution as a service) | Medium | 3.2 |
| 3.7 NIP-29 project group setup and membership management | Medium | 3.1, Phase 1 |
| 3.8 Beads -> Nostr event sync (kind:1617 publishing, kind:1630-1633 status) | Medium | 3.2 |
| 3.9 Remote dependency tracking in Beads | Medium | 3.8 |
| 3.10 Distributed `bd prime` with remote context | Medium | 3.8, 3.9 |
| 3.11 Cross-machine seance (`gt seance --remote`) | Low | 3.8 |
| 3.12 Integration test: 3 Towns, shared repo, trust-weighted merge | Very High | 3.1-3.11 |

**Deliverable:** Multiple Towns collaborating on a shared codebase with decentralized review, distributed CI, and trust-based merge authority — no centralized Integration Refinery.

### Phase 4: Advanced Integration (8-12 weeks)

**Goal:** Full Gas Town <-> Crosstown convergence.

| Task | Complexity | Dependencies |
|---|---|---|
| 4.1 MEOW/DVM workflow mapping | High | Phase 3, Epic 13 (DVMs) |
| 4.2 Nostr-based Witness/Deacon for remote agents | Medium | Phase 1 |
| 4.3 Wasteland protocol migration to Nostr/ILP | High | Phase 2 |
| 4.4 Unified memory architecture (Beads + Nostr) | High | Phase 3 |
| 4.5 NIP-29 agent swarms with Gas Town roles | Very High | Phase 3, Epic 17 (Swarms) |

**Deliverable:** Full convergence of Gas Town and Crosstown into a distributed agent marketplace.

---

## Section 9: Additional NIP Opportunities

> **Assessment criteria:** Each NIP below was evaluated against the peering-gated architecture (Section 4.2) and existing protocol choices. NIPs that duplicate ILP functionality, solve problems eliminated by the peering gate, or are already implicitly in use were removed.

### 9.1 Assessed NIPs — Final Recommendations

| # | NIP | Opportunity | Value | Phase |
|---|---|---|---|---|
| 1 | **NIP-46** (Remote Signing) | Polecat key isolation — scoped signing permissions without sharing Rig keypair | **High** | Phase 1 |
| 2 | **NIP-51** (Lists) | Structured Town configuration — relay sets, trusted provider lists, project bookmarks | **Medium-High** | Phase 1-2 |
| 3 | **NIP-53** (Live Activities) | Real-time agent session monitoring — replaces tmux-based Witness for remote agents | **Medium-High** | Phase 2 |
| 4 | **NIP-56** (Reporting) | Bad actor flagging — trust system needs a negative signal mechanism (kind:1984 reports) | **Medium** | Phase 2-3 |
| 5 | **NIP-40** (Expiration) | Auto-cleanup — ownership claims, stale CI results, session events expire automatically | **Medium** | Phase 1 |
| 6 | **NIP-77** (Negentropy) | Efficient relay catch-up after network partition — bandwidth-efficient delta sync | **Medium** | Phase 3 |
| 7 | **NIP-89** (App Handlers) | Event routing — Towns discover handlers for unfamiliar event kinds as ecosystem evolves | **Low-Medium** | Phase 4 |

### 9.2 Rejected NIPs — With Reasoning

| NIP | Original Rationale | Why Rejected |
|---|---|---|
| **NIP-47** (Wallet Connect) | Replace custom ILP payment wiring | **Redundant with ILP.** SPSP over Nostr (kind:23194/23195) already handles payment setup. ILP PREPARE/FULFILL already provides atomic escrow. NIP-47 would add a second payment system for the same function and lock the architecture to Lightning specifically, losing ILP's ledger-agnostic design. |
| **NIP-03** (OpenTimestamps) | Tamper-proof timestamps for dispute resolution | **Unnecessary.** Nostr relay receipt timestamps provide independent witnesses. ILP's built-in timeout/expiry handles payment disputes natively. Gas Town's GUPP principle makes most ordering disputes moot (idempotent work). Adding Bitcoin-anchored timestamps would introduce 10+ minute confirmation latency for a non-problem. |
| **NIP-99** (Classified Listings) | Wanted work marketplace | **Redundant with NIP-90 DVMs.** DVMs already handle the full discovery → bidding → execution → delivery lifecycle. NIP-99 would add a separate browsing layer before the DVM flow — unnecessary for agent-to-agent dispatch. Could be revisited in Phase 4 if human-facing marketplace browsing becomes a requirement. |
| **NIP-13** (Proof of Work) | Anti-spam for open marketplace | **Eliminated by peering gate.** The architecture requires NIP-02 peering + SPSP handshake before any work dispatch. Non-peered Towns cannot submit DVM jobs or patches. The social graph is the spam filter — PoW is solving a problem that doesn't exist. |
| **NIP-78** (App Data) | Town configuration key-value store | **Already in use.** Crosstown's kind:30078 (Gas Town Work Dispatch) IS NIP-78 application-specific data. The kind number is the same. Adding NIP-78 as a separate recommendation would be confusing since it's already the foundation for work dispatch events. Town configuration is better served by NIP-51 Lists which provides structured, typed list formats. |

### 9.3 NIP-46: Remote Signing for Polecat Key Isolation

**Problem:** The current design has Polecats (ephemeral workers) sharing their Rig's keypair because they're too short-lived for individual identities. A compromised Polecat has the Rig's full signing authority.

**Solution:** The Rig runs a NIP-46 remote signer daemon holding the private key. Polecats connect via kind:24133 and receive scoped permissions:

```
Polecat "Toast" connects to Rig signer:
  Allowed methods:
    sign_event:30078    (work status updates)
    sign_event:1617     (patches)
    sign_event:7000     (DVM feedback)
    nip44_encrypt       (encrypted messages)

  Denied methods:
    sign_event:9000     (NIP-29 group admin)
    sign_event:10032    (ILP Peer Info)
    sign_event:3        (NIP-02 follow list)
    sign_event:23194    (SPSP requests)
```

**Properties:**
- Polecats never touch the private key
- Compromised Polecat can only sign permitted event kinds — cannot modify peering, identity, or payment channels
- Rig revokes connection instantly on Polecat death (tmux session nuke)
- No additional key management overhead for ephemeral workers
- NIP-46 supports `switch_relays` method — Rig can redirect Polecat to different relays mid-session

**Integration with Gas Town lifecycle:**

| Event | Gas Town Action | NIP-46 Action |
|---|---|---|
| Polecat spawn | `gt spawn` creates tmux session | Rig signer issues scoped connection to new Polecat |
| Polecat working | Polecat publishes kind:30078 status | Polecat requests signing via kind:24133 → Rig signer signs |
| Polecat done | Polecat signals DONE | Polecat publishes signed kind:1617 patch via signer |
| Polecat death | `gt nuke` destroys tmux session | Rig signer revokes connection; rejects future kind:24133 from that client key |
| Key compromise detected | Manual intervention | Rig signer revokes all active connections; rotates client keys |

### 9.4 NIP-51: Lists for Town Configuration

**Crosstown-specific list usage:**

| List Kind | Crosstown Use | Example |
|---|---|---|
| kind:30000 (follow sets) | "Trusted CI providers" — subset of follows qualified to run DVM CI | `d: "crosstown-ci-providers"` |
| kind:30000 (follow sets) | "Preferred merge reviewers" — Towns this Mayor trusts for NIP-32 review labels | `d: "crosstown-reviewers"` |
| kind:30002 (relay sets) | "Project X relays" — per-project relay configuration | `d: "project-agent-marketplace-relays"` |
| kind:30002 (relay sets) | "Federation relays" — relays for cross-Town coordination events | `d: "crosstown-federation-relays"` |
| kind:10009 (simple groups) | NIP-29 project groups this Town participates in | References group IDs |
| kind:30003 (bookmark sets) | "Patches awaiting review" — Mayor's review queue | `d: "crosstown-review-queue"` |

Private items (NIP-44 encrypted in `.content`) store sensitive config: payment thresholds, internal credit limits, SPSP negotiation parameters.

### 9.5 NIP-53: Live Activities for Agent Monitoring

**Replaces tmux-based Witness monitoring for remote agents.**

Each active work session is published as a live activity:

```json
{
  "kind": 30311,
  "tags": [
    ["d", "<session-id>"],
    ["title", "Town A: OAuth Refactor Sprint"],
    ["status", "live"],
    ["p", "<polecat-toast-npub>", "", "Participant"],
    ["p", "<polecat-rictus-npub>", "", "Participant"],
    ["p", "<witness-npub>", "", "Host"],
    ["current_participants", "5"],
    ["starts", "<unix-timestamp>"]
  ]
}
```

**Monitoring flow:**
- Witness publishes kind:30311 with `status: "live"` when session starts
- Polecats emit progress updates as kind:1311 (live chat messages)
- Other Towns can observe work in progress before it becomes a patch
- Deacon monitors all live activities — `status: "live"` unchanged for 30+ minutes triggers stale alert
- Session end: Witness updates to `status: "ended"`
- Staleness detection: per NIP-53 spec, clients treat unchanged `status: "live"` events older than 1 hour as ended

**Hybrid approach:** Local Polecats monitored via tmux (existing, faster). Remote Polecats monitored via NIP-53 live activities (new, network-observable).

### 9.6 NIP-40: Expiration for Auto-Cleanup

**Events that should auto-expire:**

| Event Type | Expiration | Rationale |
|---|---|---|
| File ownership claims (kind:30078, status=working) | Estimated duration * 2 | Prevents stale locks from blocking other Towns |
| DVM CI results (kind:6xxx) | 24 hours | Stale test results shouldn't inform merge decisions |
| NIP-53 live activity sessions (kind:30311) | Max session duration (e.g., 8 hours) | Dead sessions should auto-clear |
| DVM job requests (kind:5xxx) | Deadline tag or 48 hours default | Unclaimed work shouldn't linger indefinitely |

Relays automatically stop serving expired events. No manual cleanup required.

### 9.7 NIP-56: Reporting for Bad Actor Flagging

If a Town consistently produces bad code, misses deadlines, or submits malicious patches:

```json
{
  "kind": 1984,
  "tags": [
    ["p", "<bad-town-npub>", "spam"],
    ["e", "<offending-patch-event-id>"]
  ],
  "content": "Town submitted patch with intentionally failing tests to collect ILP PREPARE escrow timeout refund repeatedly."
}
```

**Report categories for Crosstown:**

| NIP-56 Category | Crosstown Meaning |
|---|---|
| `spam` | Low-quality patches, frivolous DVM job claims |
| `malware` | Malicious code in patches |
| `impersonation` | Fake Town identity |
| `other` | Deadline manipulation, escrow abuse, review collusion |

Reports from high-trust Towns (trust > 0.7) carry more weight. Trust score formula could incorporate report count as a negative signal:

```
reputation_penalty = Σ (trust(reporter) * report_weight) for reports in last 90 days
```

### 9.8 NIP-77: Negentropy for Efficient Reconnection

When a Town comes back online after network partition, it needs to catch up on missed events. NIP-77 enables bandwidth-efficient sync:

- Client sends NEG-OPEN with filter (e.g., `kinds:[1617,1985,30078], since:<last_seen>`)
- Relay responds with cryptographic fingerprints of event ranges
- Client identifies only the missing events via range reconciliation
- Downloads only the delta

At scale (500+ agents, thousands of events/day), this reduces reconnection bandwidth by 80-95% compared to re-downloading everything. Most relevant for Phase 3+ when cross-Town event volume is high.

### 9.9 Updated NIP Dependency Summary (Complete)

| NIP | Role in Crosstown | Required | Phase |
|---|---|---|---|
| **NIP-01** | Basic protocol | Yes | All |
| **NIP-02** | Follow graph = peering relationships | Yes | Phase 1 |
| **NIP-09** | Event deletion (retract patch/review) | Optional | Phase 1 |
| **NIP-17** | Private DMs (cross-Town mail) | Yes | Phase 1 |
| **NIP-29** | Project group coordination | Recommended | Phase 2 |
| **NIP-32** | Distributed code review labels | Yes | Phase 3 |
| **NIP-34** | Decentralized git collaboration (patches, PRs, status) | Yes | Phase 3 |
| **NIP-40** | Event expiration (auto-cleanup) | Recommended | Phase 1 |
| **NIP-44** | Encrypted payloads (private repos, DMs) | Yes | Phase 1 |
| **NIP-46** | Remote signing (Polecat key isolation) | Recommended | Phase 1 |
| **NIP-51** | Structured lists (Town config, relay sets) | Recommended | Phase 1-2 |
| **NIP-53** | Live activities (agent session monitoring) | Recommended | Phase 2 |
| **NIP-56** | Reporting (bad actor flagging) | Optional | Phase 2-3 |
| **NIP-58** | Badges (reputation, planned Epic 15) | Optional | Phase 4 |
| **NIP-65** | Relay list metadata (multi-relay redundancy) | Recommended | Phase 1 |
| **NIP-77** | Negentropy syncing (efficient reconnection) | Optional | Phase 3 |
| **NIP-78** | Application-specific data (kind:30078 work dispatch) | Yes (implicit) | Phase 1 |
| **NIP-85** | Trusted assertions (pre-computed trust scores) | Recommended | Phase 3 |
| **NIP-89** | App handlers (event routing for evolving ecosystem) | Optional | Phase 4 |
| **NIP-90** | DVMs (work dispatch, CI marketplace) | Yes | Phase 1-2 |

---

## Appendix A: Protocol Specification Drafts

### Kind 30078: Gas Town Work Dispatch

```json
{
  "kind": 30078,
  "content": "<NIP-44 encrypted JSON>",
  "tags": [
    ["d", "<bead_id>"],
    ["p", "<recipient_npub>"],
    ["status", "dispatched|claimed|working|done|failed"],
    ["role", "polecat|crew|witness|refinery"],
    ["rig", "<rig_name>"],
    ["priority", "0|1|2|3|4"],
    ["effort", "trivial|small|medium|large|epic"]
  ]
}

// Decrypted content:
{
  "bead_id": "gt-abc12",
  "title": "Fix authentication bug in login flow",
  "description": "...",
  "dependencies": ["gt-xyz99"],
  "branch": "polecat/Toast/gt-abc12",
  "payment_offer_msat": 15000000
}
```

### ~~Kind 30079: Gas Town Wanted Work~~ (Superseded)

> **Superseded by NIP-90 DVM job requests (kind:5xxx).** Cross-Town work dispatch now uses standard NIP-90 DVMs with DVM bid as price signal and ILP PREPARE/FULFILL for atomic payment. The bid amount is denominated in whatever unit the peering channel uses (agreed during SPSP handshake). See Section 4.3 for the full DVM + ILP payment flow.
```

### Kind 30080: Gas Town Completion Evidence

```json
{
  "kind": 30080,
  "content": "<JSON>",
  "tags": [
    ["e", "<original_dispatch_event_id>"],
    ["p", "<dispatcher_npub>"],
    ["d", "<bead_id>"],
    ["result", "completed|partial|failed"]
  ]
}

// Content:
{
  "bead_id": "gt-abc12",
  "commit_sha": "a1b2c3d4...",
  "branch": "feature/rate-limiting",
  "test_results": { "passed": 142, "failed": 0, "skipped": 3 },
  "token_cost_msat": 12000000,
  "execution_time_seconds": 480,
  "stamps": [
    { "dimension": "code_quality", "confidence": 0.85 },
    { "dimension": "test_coverage", "confidence": 0.92 }
  ]
}
```

---

## Appendix B: Risk Register

| ID | Risk | Probability | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | Nostr relay latency degrades orchestration | Medium | High | Hybrid architecture: local for co-located, Nostr for remote | Architecture |
| R2 | ILP channel rebalancing complexity | Medium | Medium | Per-peering SPSP negotiation defines settlement terms; peering gate eliminates unknown-peer channels; trust-based credit limits reduce settlement frequency | Economic Model |
| R3 | Merge conflicts at integration points | High | High | NIP-34 decentralized merge with trust-weighted multi-approval; NIP-32 "conflict-risk" labels; NIP-90 DVM CI verification (see Section 3) | Merge/Coord |
| R4 | 75% management threshold for distributed agents | High | High | Hierarchical Town structure; Mayors coordinate, Polecats stay local | Scaling |
| R5 | Beads LWW inadequate for distributed writes | Medium | Medium | Restrict Beads writes to local; sync via Nostr with conflict detection | State |
| R6 | Key compromise of Town identity | Low | Very High | Key rotation protocol; revocation via NIP-09; multi-sig for high-value operations | Security |
| R7 | Economic incentive misalignment (free-riding) | Low | Medium | Peering gate prevents anonymous free-riding; ILP PREPARE/FULFILL ensures atomic payment-for-work; reputation tracking via trust score | Economic Model |
| R8 | Gas Town Go <-> Crosstown TypeScript impedance | High | Medium | Gateway pattern: Crosstown Node as TypeScript bridge; Go CLI for local ops | Architecture |
| R9 | Nostr event ordering issues cause state divergence | Medium | Low | Timestamp-based ordering; idempotent operations; GUPP self-correction | Communication |
| R10 | Token cost explosion at scale (>100 agents) | Medium | High | Market pricing; competitive bidding; trust-based discounts; model cost optimization | Economic Model |

---

## Appendix C: Glossary

| Term | Definition |
|---|---|
| **GUPP** | "If there is work on your hook, YOU MUST RUN IT" -- Gas Town's self-activation principle |
| **MEOW** | Molecular Expression of Work -- Gas Town's layered workflow orchestration stack |
| **TOON** | Compact encoding format for Nostr events in ILP packets |
| **Wasteland** | Gas Town's existing federation protocol using DoltHub |
| **NIP** | Nostr Implementation Possibility -- protocol extension proposals |
| **ILP** | Interledger Protocol -- cross-ledger payment routing |
| **SPSP** | Simple Payment Setup Protocol -- ILP's payment initiation mechanism |
| **BLS** | Business Logic Server -- Crosstown's payment verification layer |
| **DVM** | Data Vending Machine -- NIP-90's paid computation marketplace |
| **NDI** | Nondeterministic Idempotence -- Gas Town's crash recovery property |
| **BTP** | Bilateral Transfer Protocol -- ILP's peer-to-peer transport layer |
| **Convoy** | Gas Town's parallel work dispatch pattern (Formula type) |
| **Molecule** | Gas Town's runtime workflow instance (from Formula template) |
| **Wisp** | Gas Town's ephemeral work unit (TTL-based, never exported) |
| **Swarm** | Gas Town's coordinated multi-agent work unit |
| **Polecat** | Gas Town's ephemeral worker agent (spawned per task) |
| **Refinery** | Gas Town's merge queue processor |
| **Rig** | Gas Town's project container (maps to one git repository) |

---

## References

### Primary Sources
- [Gas Town Repository](https://github.com/steveyegge/gastown) (~189K LOC Go)
- [Beads Repository](https://github.com/steveyegge/beads) (~225K LOC Go)
- [Crosstown Repository](https://github.com/jonathangreen/crosstown) (TypeScript, formerly "Crosstown")
- [Gas Town User Manual](https://gist.github.com/Xexr/3a1439038e4ce34b5e9de020f6cbdc4b)
- [Beads Architecture](https://github.com/steveyegge/beads/blob/main/docs/ARCHITECTURE.md)

### Comparable Systems
- [Temporal.io](https://temporal.io/) -- Schedule-to-start latency: 50-150ms; Netflix runs millions of deployments
- [Kubernetes v1.35](https://kubernetes.io/) -- Workload-aware scheduling, gang scheduling
- [Lightning Network](https://lightning.network/) -- Payment channels, 95-99.7% success rate for <$100
- [strfry Nostr Relay](https://github.com/hoytech/strfry) -- Shared-nothing LMDB relay
- [AutoGen v0.4](https://microsoft.github.io/autogen/) -- Distributed agent runtime

### Academic Literature
- [Market Making for Multi-Agent LLM Systems](https://arxiv.org/html/2511.17621v1)
- [Game-Theoretic Lens on LLM Multi-Agent Systems](https://arxiv.org/html/2601.15047v1)
- [Blockchain-Enhanced Incentive Mechanisms](https://www.nature.com/articles/s41598-025-20247-8)
- [Multi-Agent Coordination Survey](https://arxiv.org/html/2502.14743v2)

### Protocol Specifications
- [NIP-02: Follow List](https://github.com/nostr-protocol/nips/blob/master/02.md)
- [NIP-17: Private Direct Messages](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [NIP-29: Relay-based Groups](https://github.com/nostr-protocol/nips/blob/master/29.md) — Project coordination groups (v2)
- [NIP-32: Labeling](https://github.com/nostr-protocol/nips/blob/master/32.md) — Distributed code review (v2)
- [NIP-34: Git Stuff](https://github.com/nostr-protocol/nips/blob/master/34.md) — Decentralized merge foundation (v2)
- [NIP-44: Versioned Encryption](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-58: Badges](https://github.com/nostr-protocol/nips/blob/master/58.md)
- [NIP-65: Relay List Metadata](https://github.com/nostr-protocol/nips/blob/master/65.md) — Multi-relay redundancy (v2)
- [NIP-85: Trusted Assertions](https://github.com/nostr-protocol/nips/blob/master/85.md) — Pre-computed trust scores (v2)
- [NIP-90: Data Vending Machines](https://github.com/nostr-protocol/nips/blob/master/90.md) — Distributed CI marketplace (v2)
- [ILP RFC 0009: SPSP](https://interledger.org/developers/rfcs/simple-payment-setup-protocol/)
- [ILP RFC 0032: Peering, Clearing, Settlement](https://interledger.org/developers/rfcs/peering-clearing-settling/)
- [STREAM Protocol](https://medium.com/interledger-blog/streaming-money-and-data-over-ilp-fabd76fc991e)
- [Rafiki (ILP Reference Implementation)](https://community.interledger.org/interledger/rafiki-updates-december-2025-1gh6)
