# Story 9.11: Lists and Labels Skill (`lists-and-labels`)

Status: ready-for-dev
ui_impact: false

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **TOON agent**,
I want a skill teaching content curation through lists and content labeling,
So that I can organize, categorize, and curate content and people on the TOON network.

**Dependencies:** Stories 9.0 (social intelligence -- done), 9.1 (protocol core -- done), 9.2 (pipeline -- done), 9.3 (eval framework -- done), 9.4 (social identity -- done), 9.5 (long-form content -- done), 9.6 (social interactions -- done), 9.7 (content references -- done), 9.8 (relay groups -- done), 9.9 (moderated communities -- done), 9.10 (public chat -- done)

**Decision sources:**
- Party Mode 2026-03-22: NIP Skills Epic (D9-001, D9-002, D9-003, D9-004, D9-007)
- `_bmad-output/project-context.md` section "NIP-to-TOON Skill Pipeline Architecture"
- `_bmad-output/planning-artifacts/epics.md` Epic 9, Story 9.11
- `_bmad-output/planning-artifacts/epics.md` Phase 4 Curation notes (no separate test-design-epic-9.md exists)

**Downstream dependencies:** This is the first Phase 4 (Curation) skill. Story 9.12 (search) and 9.13 (app-handlers) follow in Phase 4. Story 9.34 (publication gate) validates this skill alongside all others.

**Nature of deliverable:** This story produces a **Claude Agent Skill** (structured markdown + reference files + eval JSON), produced by running the `nip-to-toon-skill` pipeline (Story 9.2). The skill teaches an agent HOW to create and manage lists (NIP-51: kind:30000, kind:30001, kind:10000) and apply labels (NIP-32: kind:1985). Output is a `.claude/skills/lists-and-labels/` directory.

**Risk context:** E9-R001 (pipeline single point of failure) -- mitigated because 9.4-9.10 already validated the pipeline. E9-R008 (write model correctness varies by NIP) -- NIP-51 lists use parameterized replaceable events (kind:30000, kind:30001) identified by d tags, plus a special replaceable event (kind:10000) for mute lists. NIP-32 labels use regular events (kind:1985). On TOON, every list update and label costs per-byte, making curation a deliberate investment.

**Rationale:** D9-001 (pipeline over catalog) means this skill is produced by running the `nip-to-toon-skill` pipeline. D9-002 (TOON-first) means the skill teaches TOON protocol context with vanilla NIP as baseline. D9-003 (social intelligence is cross-cutting) means a `## Social Context` section explains list curation norms and labeling ethics. D9-004 (economics shape social norms) means that on TOON, every list update and label costs per-byte, making curation intentional and labels honest.

## Acceptance Criteria

### AC1: Pipeline Production [Test: STRUCT-A, STRUCT-B]
**Given** the `nip-to-toon-skill` pipeline (Story 9.2)
**When** the pipeline is run with NIP-51 and NIP-32 as input
**Then** it produces a complete `lists-and-labels` skill directory at `.claude/skills/lists-and-labels/` with:
- `SKILL.md` with YAML frontmatter (ONLY `name` and `description` fields)
- `references/` directory with Level 3 reference files
- `evals/evals.json` in skill-creator format

### AC2: NIP Coverage [Test: EVAL-A, EVAL-B]
**Given** the `lists-and-labels/SKILL.md` file
**When** an agent needs to create lists or apply labels on TOON
**Then** the skill covers:
- **NIP-51 (Lists):** Categorized people lists (kind:30000) with `d` tag identifier and `p` tags for listed pubkeys. Well-known d-tag values: "follow", "mute", "pin", "bookmark", "communities", "emojis". Categorized bookmark lists (kind:30001) with `d` tag identifier and `e`/`a` tags for bookmarked events. Mute list (kind:10000) with `p` tags for muted pubkeys, `e` tags for muted threads, `t` tags for muted hashtags, and `word` tags for muted words. Pin list (kind:10001) for pinned events. User emoji list (kind:10030) and emoji sets (kind:30030). Encrypted vs public tags (private list entries in content encrypted via NIP-44 vs public in tags).
- **NIP-32 (Labeling):** Label events (kind:1985) with `L` (namespace) and `l` (label value) tags. Self-labeling (labeling own events) vs third-party labeling (labeling others' events). Label namespaces: `ugc` (user-generated content), custom namespaces. Target tags (`e`, `p`, `a`, `t`, `r`) identifying what is being labeled.

### AC3: TOON Write Model [Test: TOON-A, TOON-B]
**Given** the skill has write aspects (list creation/update, label application)
**When** the skill teaches list and label management on TOON
**Then** it:
- Explains that list creation and updates (kind:30000, kind:30001, kind:10000) are published via `publishEvent()` from `@toon-protocol/client` and cost per-byte
- Explains that labels (kind:1985) are published via `publishEvent()` and cost per-byte
- Notes that list updates are replaceable events (entire list is re-published, not incremental) -- large lists cost more to update
- Notes that mute lists (kind:10000) can have encrypted entries in content via NIP-44 -- encrypted content increases byte size and thus cost
- Notes that pin lists (kind:10001) and emoji lists (kind:10030, kind:30030) also cost per-byte to update
- References `nostr-protocol-core` for the detailed fee formula and `publishEvent()` API
- Explains economic dynamics: list curation is a deliberate investment; labels (kind:1985) are regular events -- once published they persist (deletion via NIP-09 is a request, not guaranteed removal)

### AC4: TOON Read Model [Test: TOON-C]
**Given** the skill handles reading lists and labels
**When** teaching list and label consumption
**Then** it documents that TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. References `nostr-protocol-core` for TOON format parsing details. Explains how to subscribe to lists using kind + author filters. Explains how to query labels using `#L` (namespace) and `#l` (label value) tag filters. Notes that mute list private entries require decryption.

### AC5: Social Context [Test: STRUCT-D, TOON-D]
**Given** the `## Social Context` section
**When** an agent reads it
**Then** it provides curation-specific social guidance:
- Lists are personal organization tools. Follow sets (kind:30000) and bookmark sets (kind:30001) reflect your curation judgment. Curate intentionally -- on TOON, every list update costs per-byte.
- Mute lists (kind:10000) are private conflict resolution. Muting is preferable to public confrontation. On TOON, muting costs per-byte but saves money long-term by avoiding engagement with unwanted content.
- Labels (kind:1985) are public assertions with reputational stakes. Label honestly -- a dishonest label reflects poorly on the labeler. On TOON, labels cost per-byte, making frivolous labeling economically wasteful. Labels are regular events (non-replaceable) -- once published, they persist even if a NIP-09 deletion is requested. Deletion is a request, not guaranteed removal.
- The escalation ladder for conflict: ignore -> mute (NIP-51 kind:10000) -> block -> report. Muting is the first active step and the most private.
- Section would NOT make sense if NIP name were replaced (passes substitution test).

### AC6: Eval Suite [Test: EVAL-A, EVAL-B]
**Given** the `evals/evals.json` file
**When** eval validation runs
**Then** it contains:
- 8-10 should-trigger queries including both protocol and social-situation triggers (e.g., "how do I create a list on TOON?", "how do mute lists work?", "NIP-51 lists", "how do I label content?", "kind:30000 categorized people", "kind:1985 label event", "how do I mute someone?", "NIP-32 labeling", "how do I bookmark events?", "what are follow sets?")
- 8-10 should-not-trigger queries (e.g., "how do I create a profile?", "how do relay groups work?", "how do I send a chat message?", "how does encrypted messaging work?", "how do I publish a long-form article?", "how do reactions work?", "how do I search for content?", "how do I upload a file?", "how do moderated communities work?")
- 4-6 output evals with `id`, `prompt`, `expected_output`, `rubric`, `assertions`

### AC7: TOON Compliance Passing [Test: TOON-A through TOON-D]
**Given** the eval framework (Story 9.3)
**When** `run-eval.sh` is run on the `lists-and-labels` skill
**Then** all 6 TOON compliance assertions pass:
- `toon-write-check`: references `publishEvent()` (write-supporting skill -- list creation/update, label application)
- `toon-fee-check`: includes fee awareness (list updates cost per-byte, labels cost per-byte, large lists cost more)
- `toon-format-check`: documents TOON-format strings (read-capable skill)
- `social-context-check`: has curation-specific `## Social Context` section
- `trigger-coverage`: description includes both protocol and social-situation triggers
- `eval-completeness`: at least 6 trigger evals + 4 output evals

### AC8: Description Optimization [Test: STRUCT-B]
**Given** the skill's description field
**When** optimization is complete
**Then** the description:
- Contains ~80-120 words
- Includes trigger phrases for: NIP-51, NIP-32, lists, labels, kind:30000, kind:30001, kind:10000, kind:1985, mute list, follow set, bookmark, categorized people, categorized bookmarks, labeling, label namespace, content curation
- Includes social-situation triggers ("how do I create a list?", "how do I mute someone?", "how do I label content?", "how do I organize my bookmarks?")
- Has been through at least one optimization pass

### AC9: Token Budget [Test: STRUCT-C]
**Given** the `lists-and-labels/SKILL.md` file
**When** token budget validation runs
**Then** the SKILL.md body (excluding frontmatter) is under 500 lines and approximately 5k tokens or fewer.

### AC10: Dependency References [Test: DEP-A]
**Given** the `lists-and-labels` skill
**When** the skill references upstream skills
**Then** it:
- References `nostr-protocol-core` (Story 9.1) for TOON write/read model details, fee calculation, and event structure
- References `nostr-social-intelligence` (Story 9.0) for base social intelligence and conflict resolution escalation (mute lists)
- References `social-identity` (Story 9.4) for follow list management (kind:3 contacts vs kind:30000 follow sets)
- References `content-references` (Story 9.7) for `nostr:` URI references in bookmark lists
- References `content-control` (Story 9.19, if available) for NIP-09 deletion semantics relevant to label removal requests
- Does NOT duplicate content from upstream skills -- uses pointers instead

### AC11: With/Without Baseline [Test: BASE-A]
**Given** the `lists-and-labels` skill
**When** with/without testing runs (pipeline Step 8)
**Then** an agent with the skill loaded produces measurably better list/label responses than an agent without it, demonstrating the skill adds value over baseline.

## Tasks / Subtasks

- [ ] Task 1: Run the NIP-to-TOON pipeline (AC: #1, #11)
  - [ ] 1.1 Load the `nip-to-toon-skill` skill from `.claude/skills/nip-to-toon-skill/SKILL.md`
  - [ ] 1.2 Execute the 13-step pipeline with input NIPs: NIP-51 (Lists) + NIP-32 (Labeling)
  - [ ] 1.3 Pipeline Step 1 (NIP Analysis): Classify as "both" (read + write). NIP-51 defines list management with parameterized replaceable events (kind:30000, kind:30001) and special replaceable events (kind:10000). NIP-32 defines labeling with regular events (kind:1985). Key structures: d tags for list identifiers, p/e/a/t/word tags for list entries, L/l tags for label namespaces and values, encrypted content for private list entries.
  - [ ] 1.4 Pipeline Step 2 (TOON Context Injection): Inject write model (list creation/update and label application via publishEvent, per-byte cost, replaceable event semantics for lists, encrypted content cost for private entries), read model (TOON format, list subscriptions by kind+author, label queries by #L/#l tag filters), fee context (list updates cost proportional to list size, labels cost per-byte making frivolous labeling wasteful).
  - [ ] 1.5 Pipeline Step 3 (Social Context Layer): Generate curation-specific social context using `references/social-context-template.md`. Focus on: mute lists as private conflict resolution, labels as honest public assertions, list curation as intentional investment, escalation ladder.
  - [ ] 1.6 Pipeline Step 4 (Skill Authoring): Generate SKILL.md with frontmatter, body, and references.
  - [ ] 1.7 Pipeline Step 5 (Eval Generation): Generate `evals/evals.json` with trigger + output evals.
  - [ ] 1.8 Pipeline Step 6 (TOON Assertions): Auto-inject TOON compliance assertions.
  - [ ] 1.9 Pipeline Step 7 (Description Optimization): Run optimization loop with 20 trigger queries, max 5 iterations.
  - [ ] 1.10 Pipeline Step 8 (With/Without Testing): Spawn parallel subagent runs -- one with skill loaded, one without (baseline).
  - [ ] 1.11 Pipeline Steps 9-10 (Grading + Benchmarking): Produce `grading.json` and `benchmark.json`.
  - [ ] 1.12 Pipeline Step 11 (TOON Compliance Validation): Run TOON-specific assertion checks.
  - [ ] 1.13 Pipeline Steps 12-13 (Eval Viewer + Iterate): Generate HTML review, collect feedback, refine if needed.

- [ ] Task 2: Create skill directory structure (AC: #1)
  - [ ] 2.1 Create `.claude/skills/lists-and-labels/` directory
  - [ ] 2.2 Create `SKILL.md` with YAML frontmatter (`name: lists-and-labels`, `description` with trigger phrases)
  - [ ] 2.3 Create `references/` subdirectory with Level 3 reference files
  - [ ] 2.4 Create `evals/` subdirectory with `evals.json`
  - [ ] 2.5 Verify directory layout matches skill-creator anatomy (no extraneous files)

- [ ] Task 3: Author SKILL.md (AC: #2, #3, #4, #5, #8, #9, #10)
  - [ ] 3.1 Write frontmatter with ONLY `name` and `description` fields
  - [ ] 3.2 Write description (~80-120 words) with protocol + social-situation triggers
  - [ ] 3.3 Write body covering: NIP-51 list model (kind:30000 categorized people with d tag and p tags, kind:30001 categorized bookmarks with d tag and e/a tags, kind:10000 mute list with p/e/t/word tags), NIP-32 labeling model (kind:1985 with L namespace tag and l label value tag, target tags e/p/a/t/r), standard list types (follow sets, relay sets, bookmark sets, pin lists, emoji sets), encrypted vs public entries
  - [ ] 3.4 Include TOON Write Model section: list creation/update via `publishEvent()`, label application via `publishEvent()`, per-byte cost, replaceable event semantics (full list republish), encrypted content cost for private entries
  - [ ] 3.5 Include TOON Read Model section: TOON-format parsing, list subscriptions by kind+author, label queries by #L/#l tag filters, mute list private entry decryption
  - [ ] 3.6 Include `## Social Context` section with curation-specific guidance on mute lists as private conflict resolution, labels as honest public assertions, list curation as intentional investment, escalation ladder (ignore -> mute -> block -> report)
  - [ ] 3.7 Include "When to read each reference" section
  - [ ] 3.8 Include pointers to `nostr-protocol-core` for TOON write/read model and fee calculation (D9-010, DEP-A)
  - [ ] 3.9 Include pointer to `nostr-social-intelligence` for base social context and conflict resolution (DEP-A)
  - [ ] 3.10 Include pointer to `social-identity` for follow list management (kind:3 vs kind:30000) (DEP-A)
  - [ ] 3.11 Include pointer to `content-references` for `nostr:` URI embedding in bookmark lists (DEP-A)
  - [ ] 3.12 Keep body under 500 lines / ~5k tokens
  - [ ] 3.13 Use imperative/infinitive form per skill-creator writing guidelines

- [ ] Task 4: Author reference files (AC: #2, #10)
  - [ ] 4.1 Write `references/nip-spec.md` -- NIP-51 and NIP-32 spec details. NIP-51: kind:30000 (categorized people list) is a parameterized replaceable event with d tag identifier and p tags for listed pubkeys, optional encrypted p tags in content for private entries. kind:30001 (categorized bookmarks) is a parameterized replaceable event with d tag identifier and e/a tags for bookmarked events, optional encrypted entries in content. kind:10000 (mute list) is a replaceable event with p tags (muted pubkeys), e tags (muted threads), t tags (muted hashtags), word tags (muted words), optional encrypted entries in content. Standard list types: follow sets (d="follow"), relay sets (d="relay"), bookmark sets (d="bookmark"), pin lists (kind:10001), emoji sets (kind:10030 for user emoji, kind:30030 for shared emoji). NIP-32: kind:1985 (label) with L tag (label namespace, e.g., "ugc"), l tag (label value within namespace), target tags (e for events, p for pubkeys, a for parameterized replaceable events, t for hashtags, r for URLs). Self-labeling vs third-party labeling. Multiple labels per event allowed.
  - [ ] 4.2 Write `references/toon-extensions.md` -- TOON-specific curation dynamics: per-byte cost of list updates (replaceable events mean full list republish cost), cost of labeling (kind:1985), mute list encrypted entries increase byte size, large lists become expensive to update frequently, labels as economic commitment to an assertion, curation as investment.
  - [ ] 4.3 Write `references/scenarios.md` -- Curation scenarios: creating a follow set (kind:30000 with d="follow" and p tags), adding to bookmark set (kind:30001 with d="bookmark" and e/a tags), managing mute list (kind:10000 with p/e/t/word tags, encrypted entries for privacy), applying a label to content (kind:1985 with L/l/e tags), querying labels for a namespace (subscribe with #L filter), removing entries from a list (republish without the entry). Each with step-by-step TOON flow.
  - [ ] 4.4 Reference `nostr-protocol-core` skill's `toon-protocol-context.md` from SKILL.md body (per D9-010: single source of truth). Do NOT duplicate `toon-protocol-context.md` into this skill's references directory.
  - [ ] 4.5 Every reference file must explain WHY (reasoning per D9-008), not just list rules

- [ ] Task 5: Create evals (AC: #6)
  - [ ] 5.1 Create `evals/evals.json` in skill-creator format
  - [ ] 5.2 8-10 should-trigger queries covering: NIP-51, NIP-32, lists, labels, kind:30000, kind:30001, kind:10000, kind:1985, mute list, follow set, bookmark, categorized people, labeling, label namespace, content curation, mute someone
  - [ ] 5.3 8-10 should-not-trigger queries: profile creation, relay groups (NIP-29), moderated communities (NIP-72), encrypted messaging, long-form publishing, search, file storage, public chat, badges, polls
  - [ ] 5.4 4-6 output evals with assertions testing: (1) list creation includes correct d tag identifier, (2) mute list includes correct tag types (p/e/t/word), (3) label event includes L and l tags with namespace, (4) fee awareness for list updates (replaceable = full republish cost), (5) TOON-format reading mentioned for list/label queries, (6) mute list described as private conflict resolution
  - [ ] 5.5 Include TOON compliance assertions in output eval assertions
  - [ ] 5.6 Use rubric-based grading: `correct` / `acceptable` / `incorrect`

- [ ] Task 6: Run validation (AC: #7, #9, #10, #11)
  - [ ] 6.1 Run `validate-skill.sh` (from Story 9.2) on `.claude/skills/lists-and-labels/` -- must pass all 11 structural checks
  - [ ] 6.2 Run `run-eval.sh` (from Story 9.3) on `.claude/skills/lists-and-labels/` -- must pass all 6 TOON compliance assertions
  - [ ] 6.3 Verify `evals/evals.json` is valid JSON with required structure
  - [ ] 6.4 Verify SKILL.md body is under 500 lines and approximately 5k tokens or fewer (AC #9)
  - [ ] 6.5 Verify description is 80-120 words
  - [ ] 6.6 Verify no extraneous files (no README.md, CHANGELOG.md, etc.)
  - [ ] 6.7 Verify YAML frontmatter has ONLY `name` and `description` fields
  - [ ] 6.8 Verify SKILL.md references `nostr-protocol-core` for TOON write/read model (AC #10, DEP-A)
  - [ ] 6.9 Verify SKILL.md references `nostr-social-intelligence` for base social context (AC #10, DEP-A)
  - [ ] 6.10 Verify SKILL.md references `social-identity` for follow list context (AC #10, DEP-A)
  - [ ] 6.11 Verify SKILL.md references `content-references` for URI embedding in bookmark lists (AC #10, DEP-A)
  - [ ] 6.12 Verify SKILL.md mentions NIP-44 encryption for private list entries
  - [ ] 6.13 Verify SKILL.md mentions label deletion semantics (NIP-09 deletion request, not guaranteed removal)

## Dev Notes

### This Is a Skill, Not TypeScript

This story produces a Claude Agent Skill (markdown + reference files + eval JSON) via the pipeline (Story 9.2). There is no `pnpm build`, no `pnpm test`, no TypeScript compilation. Validation is structural (validate-skill.sh) + TOON compliance (run-eval.sh).

### Pipeline Steps Are Methodology, Not Automation

The "13-step pipeline" in Task 1 describes the conceptual pipeline from Story 9.2. In practice, the dev agent creates files directly following the methodology. Stories 9.4-9.10 all used this approach. The pipeline steps guide what content to produce, not literal scripts to execute.

### Classification: "Both" (Read + Write)

This skill is "both" read and write. Write: list creation/update (kind:30000, kind:30001, kind:10000), label application (kind:1985). Read: subscribing to lists, querying labels by namespace/value.

### Key NIP-51 Event Kinds (Reference)

| Kind | Name | Type | Purpose |
|------|------|------|---------|
| 30000 | Categorized People | Parameterized Replaceable | Named sets of pubkeys (follow sets, etc.) |
| 30001 | Categorized Bookmarks | Parameterized Replaceable | Named sets of events/articles (bookmark sets, etc.) |
| 10000 | Mute List | Replaceable | Personal mute list (pubkeys, threads, hashtags, words) |
| 10001 | Pin List | Replaceable | Pinned events for profile |
| 10030 | User Emoji List | Replaceable | Custom emoji shortcuts |
| 30030 | Emoji Sets | Parameterized Replaceable | Shared emoji collections |

### Key NIP-32 Event Kinds (Reference)

| Kind | Name | Type | Purpose |
|------|------|------|---------|
| 1985 | Label | Regular | Apply labels to events, pubkeys, URLs, hashtags |

### NIP-51 Tag Formats

**Categorized people (kind:30000):** `d` tag for list identifier, `p` tags for listed pubkeys. Optional encrypted `p` tags in content (NIP-44) for private entries. Well-known d-tag values: "follow", "mute", "pin", "bookmark", "communities", "emojis".

**Categorized bookmarks (kind:30001):** `d` tag for list identifier (e.g., "bookmark"), `e` tags for bookmarked events, `a` tags for bookmarked replaceable events. Optional encrypted entries in content.

**Mute list (kind:10000):** `p` tags for muted pubkeys, `e` tags for muted threads, `t` tags for muted hashtags, `word` tags for muted words. Optional encrypted entries in content for private muting.

### NIP-32 Tag Formats

**Label event (kind:1985):**
- Namespace: `["L", "<namespace>"]` -- e.g., `["L", "ugc"]` for user-generated content
- Label value: `["l", "<value>", "<namespace>"]` -- e.g., `["l", "nsfw", "ugc"]`
- Target event: `["e", "<event-id>", "<relay-url>"]`
- Target pubkey: `["p", "<pubkey>"]`
- Target replaceable: `["a", "<kind>:<pubkey>:<d-tag>"]`
- Target hashtag: `["t", "<hashtag>"]`
- Target URL: `["r", "<url>"]`

### Replaceable Event Semantics

NIP-51 lists are replaceable or parameterized replaceable events. This means updates REPLACE the entire event -- there is no incremental add/remove. To add an entry to a list: fetch current list, add the entry, republish the entire list. To remove: fetch, remove, republish. On TOON, this means large lists are expensive to update because the full list is re-sent each time.

### Encrypted vs Public List Entries

NIP-51 supports hybrid lists: some entries are public (in tags) and some are private (encrypted in content using NIP-44). Private entries are only visible to the list owner. This is particularly important for mute lists -- you may not want others to know who you have muted. Encrypted content increases byte size and thus TOON publishing cost.

### TOON-Specific Curation Dynamics

- **List updates cost proportional to list size:** Replaceable event semantics mean every update sends the full list. A 100-entry follow set costs more per update than a 10-entry set.
- **Labels are permanent public assertions:** kind:1985 events are regular (non-replaceable). Once published, a label exists permanently. On TOON, this economic permanence discourages frivolous labeling.
- **Mute lists are private conflict resolution:** Muting is the recommended first step when someone's content is unwanted. It costs per-byte on TOON but saves money long-term by preventing engagement with unwanted content.
- **Curation is investment:** Every list curated, every label applied, costs money. This creates quality curation -- people organize what matters and label honestly.

### Project Structure Notes

- Skill output directory: `.claude/skills/lists-and-labels/`
- SKILL.md: `.claude/skills/lists-and-labels/SKILL.md`
- References: `.claude/skills/lists-and-labels/references/`
- Evals: `.claude/skills/lists-and-labels/evals/`
- No TypeScript, no npm packages, no Docker -- pure skill files

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.11]
- [Source: NIP-51 specification -- https://github.com/nostr-protocol/nips/blob/master/51.md]
- [Source: NIP-32 specification -- https://github.com/nostr-protocol/nips/blob/master/32.md]
- [Source: .claude/skills/public-chat/ -- previous story pattern (9.10)]
- [Source: .claude/skills/nostr-protocol-core/references/toon-protocol-context.md -- D9-010 single source of truth]
- [Source: .claude/skills/nostr-social-intelligence/ -- conflict resolution escalation ladder]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Change Log
