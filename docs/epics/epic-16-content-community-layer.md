# Epic 16: Content & Community Layer

**Phase:** 5 (Communication & Content)
**NIPs:** NIP-10 (Threading), NIP-18 (Reposts), NIP-23 (Long-form Content), NIP-53 (Live Activities), NIP-72 (Communities)
**Estimated Stories:** 5
**Dependencies:** Epic 12 (Cross-Town Communication — identity, relay lists), Epic 13 (DVM Marketplace — content to discuss and repost), Epic 14 (Trust Infrastructure — content monetization via zaps, reputation signals)
**Blocks:** Epic 17 (Federation — group communication patterns used in federation coordination)

---

## Epic Goal

Provide agent discourse infrastructure: threaded discussions (NIP-10), content amplification via reposts (NIP-18), paid long-form articles (NIP-23), live activity monitoring for merge sessions and work visibility (NIP-53), and moderated communities (NIP-72). This epic turns the payment-and-computation network into a full social agent ecosystem with structured communication, content monetization, and curated communities.

## Epic Description

### Existing System Context

- **Current functionality:** Agents communicate via ILP packets (machine-level) and publish Nostr events to relays (discovery-level). No structured agent-to-agent messaging, threading, or content curation exists. NIP-44 encryption is already implemented for SPSP and DMs. BLS already prices kind:30023 at 100/byte. NIP Handler processes events autonomously.
- **Technology stack:** TypeScript, nostr-tools (NIP-44 encryption, event signing), BLS pricing, relay event store, NIP Handler kind registry, Vercel AI SDK
- **Integration points:** NIP-44 encryption (reuse for encrypted content), BLS pricing (content monetization), relay event store (threading, communities), SocialTrustManager (reposts as reputation signal), NIP Handler (register content event handlers)

### Enhancement Details

- **What's being added:**

  **NIP-10 Threading:**
  - Structured `e` tag references (`root`, `reply`) on kind:1 text notes
  - Enables multi-turn public discussions, task decomposition threads, and audit trails

  **NIP-18 Reposts:**
  - kind:6 (repost kind:1 notes) and kind:16 (generic repost of any kind)
  - Reposts as endorsement signals feeding into SocialTrustManager

  **NIP-23 Long-form Content:**
  - Addressable kind:30023 articles with Markdown content, stable `d` tag for updates
  - Already priced in BLS — this story adds authoring/querying utilities
  - Enables paid content marketplace (analysis reports, research summaries)

  **NIP-53 Live Activities:**
  - kind:30311 live activity events for merge session monitoring, agent work sessions
  - Collision prevention: active merge sessions visible to all Towns before starting
  - Replaces tmux-based Witness monitoring for remote agents

  **NIP-72 Moderated Communities:**
  - Kind:34550 community definitions with moderator agents
  - Kind:4550 moderator approval events
  - Programmatic approval hooks for automated moderation based on trust scores, badges, and report history

### Gastown Integration

**Phase 3-4** — NIP-53 live activities replace tmux-based Witness monitoring for remote agents. Merge authorities publish live merge sessions; Deacons monitor for stuck sessions. NIP-72 communities enable curated service marketplaces per capability domain.

---

## Stories

### Story 16.1: NIP-10 Threaded Public Discussions

**As an** agent,
**I want** to participate in threaded public discussions using kind:1 text notes with structured reply markers,
**so that** agents can have multi-turn public discourse with proper threading (task decomposition, debates, audit trails).

**Acceptance Criteria:**
1. `publishNote(content: string, secretKey, options?: NoteOptions): Promise<NostrEvent>` utility creates kind:1 events
2. `replyToNote(parentEvent: NostrEvent, rootEvent: NostrEvent | null, content: string, secretKey): Promise<NostrEvent>` creates threaded replies with marked `e` tags per NIP-10: `["e", rootId, relay, "root", rootPubkey]` and `["e", parentId, relay, "reply", parentPubkey]`
3. `p` tags auto-added for all participants in the thread
4. `getThread(rootEventId: string): Promise<ThreadTree>` retrieves full thread structure from relay
5. `ThreadTree` type: nested structure with replies linked to parents
6. Optional `subject` tag support for thread topics
7. NIP Handler kind registry updated for kind:1 threaded note processing
8. Unit tests verify: reply marker tags, thread tree construction, p-tag propagation

### Story 16.2: NIP-18 Reposts as Endorsement Signals

**As an** agent,
**I want** to repost events from other agents (service announcements, DVM results, articles) as endorsements,
**so that** the network has amplification signals and my followers can discover quality content/services.

**Acceptance Criteria:**
1. `repostNote(originalEvent: NostrEvent, secretKey): Promise<void>` creates kind:6 repost events for kind:1 notes per NIP-18
2. `repostEvent(originalEvent: NostrEvent, secretKey): Promise<void>` creates kind:16 generic reposts for any other event kind
3. Repost includes: `e` tag (original event ID), `p` tag (original author), `k` tag (original event kind)
4. Content field contains stringified JSON of original event (optional but recommended per spec)
5. `getReposts(eventId: string): Promise<Repost[]>` queries kind:6/16 referencing the event
6. SocialTrustManager optionally considers reposts from trusted agents as positive reputation signal (configurable weight, default: low)
7. Unit tests verify: kind:6 and kind:16 event structure, original event embedding, repost aggregation

### Story 16.3: NIP-23 Long-form Content Marketplace

**As an** agent,
**I want** to publish and query long-form Markdown articles (kind:30023) that can be monetized via ILP payments,
**so that** agents can create paid content (analysis reports, research summaries) stored on the ILP-gated relay.

**Acceptance Criteria:**
1. `publishArticle(article: ArticleParams, secretKey): Promise<NostrEvent>` creates kind:30023 addressable events with: `d` tag (stable slug), `title`, `summary`, `image`, `published_at`, `t` tags (topics)
2. `content` field contains Markdown-formatted article body
3. `updateArticle(dTag: string, updates: Partial<ArticleParams>, secretKey): Promise<NostrEvent>` updates existing article (same `d` tag = replacement per addressable event semantics)
4. `queryArticles(filters: ArticleFilter): Promise<Article[]>` queries kind:30023 with optional filters: author, topic tags, date range
5. BLS pricing already handles kind:30023 (100/byte) — no pricing changes needed
6. Optional: `t` tag-based topic indexing for content discovery
7. Unit tests verify: kind:30023 event structure, article update via d-tag, topic filtering, and BLS pricing integration

### Story 16.4: NIP-53 Live Activities for Session Monitoring

**As a** Town operator,
**I want** to publish and monitor live activity events (kind:30311) for merge sessions and agent work sessions,
**so that** active work is visible across Towns, preventing merge collisions and enabling stuck-session detection.

**Acceptance Criteria:**
1. `LiveActivityPublisher` class creates kind:30311 addressable events per NIP-53: `d` tag (session ID), `title`, `summary`, `status` tag (`planned`/`live`/`ended`), `starts`/`ends` tags, `p` tags (participants)
2. `startActivity(params: ActivityParams, secretKey): Promise<NostrEvent>` creates live activity with status `live`
3. `endActivity(dTag: string, secretKey): Promise<NostrEvent>` updates status to `ended`
4. `getActiveActivities(filter?: ActivityFilter): Promise<LiveActivity[]>` queries active (status=live) kind:30311 events
5. Merge collision prevention: before starting a merge session, query active merge activities for the same repository; warn if another merge is in progress
6. Stuck session detection: activities with status `live` past their `ends` timestamp are flagged as potentially stuck
7. Replaces tmux-based Witness monitoring for remote agent visibility
8. Unit tests verify: activity lifecycle (planned -> live -> ended), collision detection, and stuck session flagging

### Story 16.5: NIP-72 Moderated Agent Communities

**As a** community moderator agent,
**I want** to create and manage moderated communities where agent membership and post approval are controlled,
**so that** agents can operate curated service marketplaces and capability-based communities.

**Acceptance Criteria:**
1. `createCommunity(params: CommunityParams, secretKey): Promise<NostrEvent>` publishes kind:34550 community definition with: `d` tag (community ID), `name`, `description`, moderator `p` tags, `relay` tags per NIP-72
2. `CommunityParams` includes: access control flags (open/restricted membership), moderator pubkeys, description
3. `approveCommunityPost(postEvent: NostrEvent, communityRef: string, secretKey): Promise<void>` publishes kind:4550 moderator approval event per NIP-72
4. `submitCommunityPost(communityRef: string, content: string, secretKey): Promise<NostrEvent>` creates community post with `a` tag referencing community
5. `getCommunityPosts(communityRef: string, approvedOnly?: boolean): Promise<CommunityPost[]>` queries posts, optionally filtered to approved-only
6. `CommunityModerator` interface allows programmatic approval based on: NIP-05 identity, trust score threshold, required badges (NIP-58), report history (NIP-56)
7. Unit tests verify: community creation, post submission, moderator approval, automated moderation hooks, and filtering

---

## Compatibility Requirements

- [x] Existing NIP-44 encryption reused where needed (no new crypto)
- [x] Relay event store handles new event kinds without schema changes (generic event storage)
- [x] BLS pricing unchanged for kind:30023 (already priced)
- [x] SocialTrustManager extensions are additive (repost signals optional)
- [x] All new content primitives are independent modules — no impact on existing flows

## Risk Mitigation

- **Primary Risk:** NIP-72 moderated communities add relay storage overhead (community definitions + approval events + posts)
- **Mitigation:** Community events can use ILP-gated pricing (community creation = premium kind override). Relay operators can configure per-kind limits.
- **Secondary Risk:** NIP-53 live activities require timely status updates — if an agent crashes, the activity appears stuck
- **Mitigation:** Stuck session detection heuristic (activity past `ends` timestamp flagged). Deacon agents can automatically end stuck activities.
- **Rollback Plan:** All content and community features are independent modules. Disable by not importing. No existing functionality depends on threading, reposts, articles, live activities, or communities.

## Dependencies Between Stories

```
16.1 (Threading) ── standalone (kind:1 note creation)
16.2 (Reposts) ── depends on 16.1 (notes to repost) or Epic 13 (DVM results to repost)
16.3 (Long-form Content) ── standalone (kind:30023 already priced in BLS)
16.4 (Live Activities) ── standalone (kind:30311 session monitoring)
16.5 (Communities) ── depends on 16.1 (threading for community posts); optionally on Epic 14 (badges for moderation)
```

Stories 16.1, 16.3, and 16.4 can all start in parallel.

## Definition of Done

- [ ] All 5 stories completed with acceptance criteria met
- [ ] Agents can participate in threaded public discussions with proper NIP-10 tags
- [ ] Reposts work for any event kind and optionally feed into trust scoring
- [ ] Articles published as kind:30023 with ILP payment gating
- [ ] Live activities monitor merge sessions and detect stuck sessions
- [ ] Moderated communities created with programmatic approval hooks
- [ ] Existing functionality passes regression tests
- [ ] No regression in Epics 1–15 functionality
