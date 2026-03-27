# Story 9.9: Moderated Communities Skill (`moderated-communities`)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **TOON agent**,
I want a skill teaching moderated community governance,
So that I can participate in and understand community structures on TOON.

**Dependencies:** Stories 9.0 (social intelligence -- done), 9.1 (protocol core -- done), 9.2 (pipeline -- done), 9.3 (eval framework -- done), 9.4 (social identity -- done), 9.5 (long-form content -- done), 9.6 (social interactions -- done), 9.7 (content references -- done), 9.8 (relay groups -- done)

**Decision sources:**
- Party Mode 2026-03-22: NIP Skills Epic (D9-001, D9-002, D9-003, D9-004, D9-007)
- `_bmad-output/project-context.md` section "NIP-to-TOON Skill Pipeline Architecture"
- `_bmad-output/planning-artifacts/epics.md` Epic 9, Story 9.9
- `_bmad-output/planning-artifacts/test-design-epic-9.md` Phase 3 Community and Groups notes

**Downstream dependencies:** This is the second Phase 3 (Community & Groups) skill. Story 9.10 (Public Chat) continues Phase 3 with no dependency on 9.9. Story 9.34 (publication gate) validates this skill alongside all others.

**Nature of deliverable:** This story produces a **Claude Agent Skill** (structured markdown + reference files + eval JSON), produced by running the `nip-to-toon-skill` pipeline (Story 9.2). The skill teaches an agent HOW to participate in moderated communities using NIP-72: understanding community definitions (kind:34550), the approval-based moderation model (kind:4550), posting to communities (kind:1111), cross-posting, and moderator governance. Output is a `.claude/skills/moderated-communities/` directory.

**Risk context:** E9-R001 (pipeline single point of failure) -- mitigated because 9.4-9.8 already validated the pipeline. E9-R008 (write model correctness varies by NIP) -- NIP-72 moderated communities use an approval-based model where moderators must approve posts before they appear in the community feed. This is a fundamentally different model from NIP-29 relay groups (relay-enforced) and standard Nostr (publish directly). The skill must clearly distinguish the approval workflow from direct publishing.

**Rationale:** D9-001 (pipeline over catalog) means this skill is produced by running the `nip-to-toon-skill` pipeline. D9-002 (TOON-first) means the skill teaches TOON protocol context with vanilla NIP as baseline. D9-003 (social intelligence is cross-cutting) means a `## Social Context` section explains community participation norms. D9-004 (economics shape social norms) means that on TOON, posting to a community costs per-byte AND requires moderator approval -- double friction that elevates content quality.

## Acceptance Criteria

### AC1: Pipeline Production [Test: STRUCT-A, STRUCT-B]
**Given** the `nip-to-toon-skill` pipeline (Story 9.2)
**When** the pipeline is run with NIP-72 as input
**Then** it produces a complete `moderated-communities` skill directory at `.claude/skills/moderated-communities/` with:
- `SKILL.md` with YAML frontmatter (ONLY `name` and `description` fields)
- `references/` directory with Level 3 reference files
- `evals/evals.json` in skill-creator format

### AC2: NIP Coverage [Test: EVAL-A, EVAL-B]
**Given** the `moderated-communities/SKILL.md` file
**When** an agent needs to participate in moderated communities on TOON
**Then** the skill covers:
- **NIP-72 (Moderated Communities):** Community definition events (kind:34550) with `d` tag as community identifier, community metadata (name, description, image), moderator list (`p` tags with "moderator" marker), preferred relay URLs. Approval events (kind:4550) issued by moderators containing community `a` tag, post reference (`e` or `a` tag), author `p` tag, and original post content as JSON-encoded content. Community posts via kind:1111 (NIP-22) with uppercase `A`/`P`/`K` tags (community scope) and lowercase tags (reply threading). Cross-posting via kind:6/kind:16 reposts with community `a` tags. Backward compatibility: clients may query kind:1 but should not use for new posts.
- **Approval-based moderation model:** Unlike NIP-29 (relay enforces membership), NIP-72 uses a post-then-approve workflow. Authors post to the community; moderators issue kind:4550 approval events to make posts visible in the curated feed. Multiple moderators should approve posts to prevent deletion during moderator rotation. Moderators can request deletion via NIP-09.

### AC3: TOON Write Model [Test: TOON-A, TOON-B]
**Given** the skill has write aspects (posting to communities, moderator approvals)
**When** the skill teaches community participation on TOON
**Then** it:
- Explains that community posts (kind:1111) are published via `publishEvent()` from `@toon-protocol/client` and cost per-byte like all TOON writes
- Notes that approval events (kind:4550) are also published via `publishEvent()` and cost per-byte -- moderators pay to approve content
- Explains that community definitions (kind:34550) cost per-byte to create or update
- Notes that cross-posting (kind:6/kind:16) to communities costs per-byte per repost
- References `nostr-protocol-core` for the detailed fee formula and `publishEvent()` API
- Explains the double-friction model on TOON: posting costs money AND requires moderator approval, creating a two-stage quality filter

### AC4: TOON Read Model [Test: TOON-C]
**Given** the skill handles reading community definitions and approved posts
**When** teaching community data consumption
**Then** it documents that TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. References `nostr-protocol-core` for TOON format parsing details. Explains how to subscribe to community definitions (kind:34550) using `a` tag filters. Notes that approved posts (kind:4550) reference the original post content as JSON-encoded content within the approval event. Explains how to discover communities by subscribing to kind:34550 events.

### AC5: Social Context [Test: STRUCT-D, TOON-D]
**Given** the `## Social Context` section
**When** an agent reads it
**Then** it provides community-specific social guidance:
- Moderated communities are curated spaces. Moderators invest time and money (on TOON) to maintain quality. Respect their curation decisions even when you disagree.
- On TOON, posting to a community costs per-byte AND requires moderator approval. This double friction means every approved post has both economic commitment (author paid to post) and social endorsement (moderator paid to approve). This elevates the expected quality bar.
- Cross-posting (kind:6/kind:16) to multiple communities should be done thoughtfully -- each cross-post costs per-byte, and moderators in each community must approve independently.
- Community definitions (kind:34550) reflect the community's identity and norms. Read the description, rules, and moderator list before participating.
- Distinguish moderated communities (NIP-72, approval-based) from relay groups (NIP-29, relay-enforced). They serve different social functions: communities are public curated feeds; groups are private membership spaces.
- Section would NOT make sense if NIP name were replaced (passes substitution test).

### AC6: Eval Suite [Test: EVAL-A, EVAL-B]
**Given** the `evals/evals.json` file
**When** eval validation runs
**Then** it contains:
- 8-10 should-trigger queries including both protocol and social-situation triggers (e.g., "how do moderated communities work?", "how do I post to a community?", "NIP-72 communities", "how does community moderation work?", "kind:34550 community definition", "how do I approve a post?", "kind:4550 approval", "how do I create a community?", "community cross-posting", "how do moderators work on Nostr?")
- 8-10 should-not-trigger queries (e.g., "how do I create a profile?", "how do relay groups work?", "how do I join a group?", "how does encrypted messaging work?", "how do I publish a long-form article?", "how do reactions work?", "how do I search for content?", "how do I upload a file?", "how do I follow someone?")
- 4-6 output evals with `id`, `prompt`, `expected_output`, `rubric`, `assertions`

### AC7: TOON Compliance Passing [Test: TOON-A through TOON-D]
**Given** the eval framework (Story 9.3)
**When** `run-eval.sh` is run on the `moderated-communities` skill
**Then** all 6 TOON compliance assertions pass:
- `toon-write-check`: references `publishEvent()` (write-supporting skill -- community posts, approvals)
- `toon-fee-check`: includes fee awareness (community posts cost per-byte, approvals cost per-byte)
- `toon-format-check`: documents TOON-format strings (read-capable skill)
- `social-context-check`: has community-specific `## Social Context` section
- `trigger-coverage`: description includes both protocol and social-situation triggers
- `eval-completeness`: at least 6 trigger evals + 4 output evals

### AC8: Description Optimization [Test: STRUCT-B]
**Given** the skill's description field
**When** optimization is complete
**Then** the description:
- Contains ~80-120 words
- Includes trigger phrases for: NIP-72, moderated communities, community definition, kind:34550, approval, kind:4550, moderator, community post, kind:1111, cross-posting, community governance, community moderation, create community, post to community, approve post, community rules
- Includes social-situation triggers ("how do I post to a community?", "how does community moderation work?", "how do I create a community?", "how do moderators approve posts?")
- Has been through at least one optimization pass

### AC9: Token Budget [Test: STRUCT-C]
**Given** the `moderated-communities/SKILL.md` file
**When** token budget validation runs
**Then** the SKILL.md body (excluding frontmatter) is under 500 lines and approximately 5k tokens or fewer.

### AC10: Dependency References [Test: DEP-A]
**Given** the `moderated-communities` skill
**When** the skill references upstream skills
**Then** it:
- References `nostr-protocol-core` (Story 9.1) for TOON write/read model details, fee calculation, and event structure
- References `nostr-social-intelligence` (Story 9.0) for base social intelligence and community participation norms
- References `social-interactions` (Story 9.6) for reactions within community context (kind:7)
- References `content-references` (Story 9.7) for `nostr:` URI embedding within community posts
- References `relay-groups` (Story 9.8) for distinguishing NIP-72 approval-based moderation from NIP-29 relay-enforced groups
- Does NOT duplicate content from upstream skills -- uses pointers instead

### AC11: With/Without Baseline [Test: BASE-A]
**Given** the `moderated-communities` skill
**When** with/without testing runs (pipeline Step 8)
**Then** an agent with the skill loaded produces measurably better community participation responses than an agent without it, demonstrating the skill adds value over baseline.

## Tasks / Subtasks

- [x] Task 1: Run the NIP-to-TOON pipeline (AC: #1, #11)
  - [x] 1.1 Load the `nip-to-toon-skill` skill from `.claude/skills/nip-to-toon-skill/SKILL.md`
  - [x] 1.2 Execute the 13-step pipeline with input NIP: NIP-72 (Moderated Communities)
  - [x] 1.3 Pipeline Step 1 (NIP Analysis): Classify as "both" (read + write). NIP-72 defines approval-based community moderation. Key event kinds: kind:34550 (community definition), kind:4550 (approval), kind:1111 (community post), kind:6/16 (cross-posting). Approval-based model is the key distinction from NIP-29 relay groups.
  - [x] 1.4 Pipeline Step 2 (TOON Context Injection): Inject write model (community posts, approvals, and definitions via publishEvent, a tag requirement for community reference, per-byte cost for all write actions), read model (TOON format, community definition subscriptions via a tag filters), fee context (double friction: per-byte cost + moderator approval).
  - [x] 1.5 Pipeline Step 3 (Social Context Layer): Generate community-specific social context using `references/social-context-template.md`. Focus on approval-based curation, moderator responsibility, double-friction quality dynamics on TOON.
  - [x] 1.6 Pipeline Step 4 (Skill Authoring): Generate SKILL.md with frontmatter, body, and references.
  - [x] 1.7 Pipeline Step 5 (Eval Generation): Generate `evals/evals.json` with trigger + output evals.
  - [x] 1.8 Pipeline Step 6 (TOON Assertions): Auto-inject TOON compliance assertions.
  - [x] 1.9 Pipeline Step 7 (Description Optimization): Run optimization loop with 20 trigger queries, max 5 iterations.
  - [x] 1.10 Pipeline Step 8 (With/Without Testing): Spawn parallel subagent runs -- one with skill loaded, one without (baseline).
  - [x] 1.11 Pipeline Steps 9-10 (Grading + Benchmarking): Produce `grading.json` and `benchmark.json`.
  - [x] 1.12 Pipeline Step 11 (TOON Compliance Validation): Run TOON-specific assertion checks.
  - [x] 1.13 Pipeline Steps 12-13 (Eval Viewer + Iterate): Generate HTML review, collect feedback, refine if needed.

- [x] Task 2: Create skill directory structure (AC: #1)
  - [x] 2.1 Create `.claude/skills/moderated-communities/` directory
  - [x] 2.2 Create `SKILL.md` with YAML frontmatter (`name: moderated-communities`, `description` with trigger phrases)
  - [x] 2.3 Create `references/` subdirectory with Level 3 reference files
  - [x] 2.4 Create `evals/` subdirectory with `evals.json`
  - [x] 2.5 Verify directory layout matches skill-creator anatomy (no extraneous files)

- [x] Task 3: Author SKILL.md (AC: #2, #3, #4, #5, #8, #9, #10)
  - [x] 3.1 Write frontmatter with ONLY `name` and `description` fields
  - [x] 3.2 Write description (~80-120 words) with protocol + social-situation triggers
  - [x] 3.3 Write body covering: NIP-72 moderated communities model, community definitions (kind:34550 with d tag, metadata, moderator p tags, preferred relays), approval events (kind:4550 with community a tag, post reference, author p tag, JSON-encoded content), community posts (kind:1111 with uppercase A/P/K tags for community scope and lowercase tags for threading), cross-posting (kind:6/kind:16 with community a tags), backward compatibility (kind:1 queries)
  - [x] 3.4 Include TOON Write Model section: community posts via `publishEvent()`, approval events via `publishEvent()`, community definitions via `publishEvent()`, cross-posting costs, double-friction model (per-byte cost + moderator approval)
  - [x] 3.5 Include TOON Read Model section: TOON-format parsing, community definition subscriptions via a tag filters, discovering approved posts via kind:4550, replaceable event model for community definitions
  - [x] 3.6 Include `## Social Context` section with community-specific guidance on approval-based curation, moderator investment, double-friction quality elevation, cross-posting etiquette, distinguishing from NIP-29 relay groups
  - [x] 3.7 Include "When to read each reference" section
  - [x] 3.8 Include pointers to `nostr-protocol-core` for TOON write/read model and fee calculation (D9-010, DEP-A)
  - [x] 3.9 Include pointer to `nostr-social-intelligence` for base social context and community norms (DEP-A)
  - [x] 3.10 Include pointer to `social-interactions` for reactions within community context (DEP-A)
  - [x] 3.11 Include pointer to `content-references` for `nostr:` URI embedding within community posts (DEP-A)
  - [x] 3.12 Include pointer to `relay-groups` for distinguishing NIP-72 approval-based from NIP-29 relay-enforced model (DEP-A)
  - [x] 3.13 Keep body under 500 lines / ~5k tokens
  - [x] 3.14 Use imperative/infinitive form per skill-creator writing guidelines

- [x] Task 4: Author reference files (AC: #2, #10)
  - [x] 4.1 Write `references/nip-spec.md` -- NIP-72 spec details. Community definition (kind:34550): replaceable event, `d` tag as community identifier, metadata (name, description, image), moderator list (`p` tags with "moderator" marker), preferred relay URLs. Approval events (kind:4550): moderator-issued, community `a` tag (`34550:<author-pubkey>:<d-identifier>`), post reference (`e` or `a` tag), author `p` tag, original post content as JSON-encoded content. Community posts: kind:1111 (NIP-22) with uppercase `A`/`P`/`K` tags for community scope and lowercase tags for reply threading. Top-level posts: both uppercase and lowercase tags point to community definition. Nested replies: uppercase tags reference community, lowercase tags reference parent content. Cross-posting: kind:6/kind:16 reposts with community `a` tags. Backward compatibility: clients may query kind:1 but should use kind:1111 for new posts. Multiple moderator approvals recommended to survive moderator rotation. Moderator deletion via NIP-09.
  - [x] 4.2 Write `references/toon-extensions.md` -- TOON-specific community participation: per-byte cost of community posts (kind:1111), approval events (kind:4550), and community definitions (kind:34550). Double-friction model: posting costs money AND requires moderator approval. Moderator economic investment: approving posts costs per-byte, making moderation a paid activity. Cross-posting cost: each repost to a community costs per-byte independently. Community creation cost: kind:34550 community definitions are replaceable events -- creating and updating community metadata costs per-byte. Economic dynamics: double friction elevates content quality, moderators are economically incentivized to curate carefully.
  - [x] 4.3 Write `references/scenarios.md` -- Community participation scenarios: creating a community definition (kind:34550 with metadata and moderator list), posting to a community (kind:1111 with uppercase tags), moderator approving a post (kind:4550 with embedded content), cross-posting content to a community (kind:6/kind:16 with a tags), discovering communities (subscribing to kind:34550), reading approved community posts (following kind:4550 events). Each with step-by-step TOON flow.
  - [x] 4.4 Reference `nostr-protocol-core` skill's `toon-protocol-context.md` from SKILL.md body (per D9-010: single source of truth). Do NOT duplicate `toon-protocol-context.md` into this skill's references directory.
  - [x] 4.5 Every reference file must explain WHY (reasoning per D9-008), not just list rules

- [x] Task 5: Create evals (AC: #6)
  - [x] 5.1 Create `evals/evals.json` in skill-creator format
  - [x] 5.2 8-10 should-trigger queries covering: NIP-72, moderated communities, community definition, kind:34550, approval, kind:4550, moderator, community post, kind:1111, cross-posting, community governance, create community, post to community, approve post
  - [x] 5.3 8-10 should-not-trigger queries: profile creation, relay groups (NIP-29), group chat, encrypted messaging, long-form publishing, search, file storage, lists and labels, public chat, polls
  - [x] 5.4 4-6 output evals with assertions testing: (1) community post includes correct uppercase A/P/K tags, (2) approval event includes community a tag and embedded post content, (3) approval-based moderation model explained, (4) fee awareness for community posts and approvals, (5) TOON-format reading mentioned for community subscriptions, (6) distinction from NIP-29 relay groups
  - [x] 5.5 Include TOON compliance assertions in output eval assertions
  - [x] 5.6 Use rubric-based grading: `correct` / `acceptable` / `incorrect`

- [x] Task 6: Run validation (AC: #7, #9, #10, #11)
  - [x] 6.1 Run `validate-skill.sh` (from Story 9.2) on `.claude/skills/moderated-communities/` -- must pass all 11 structural checks
  - [x] 6.2 Run `run-eval.sh` (from Story 9.3) on `.claude/skills/moderated-communities/` -- must pass all 6 TOON compliance assertions
  - [x] 6.3 Verify `evals/evals.json` is valid JSON with required structure
  - [x] 6.4 Verify SKILL.md body is under 500 lines and approximately 5k tokens or fewer (AC #9)
  - [x] 6.5 Verify description is 80-120 words
  - [x] 6.6 Verify no extraneous files (no README.md, CHANGELOG.md, etc.)
  - [x] 6.7 Verify YAML frontmatter has ONLY `name` and `description` fields
  - [x] 6.8 Verify SKILL.md references `nostr-protocol-core` for TOON write/read model (AC #10, DEP-A)
  - [x] 6.9 Verify SKILL.md references `nostr-social-intelligence` for base social context (AC #10, DEP-A)
  - [x] 6.10 Verify SKILL.md references `social-interactions` for community-scoped reactions (AC #10, DEP-A)
  - [x] 6.11 Verify SKILL.md references `content-references` for URI embedding in community posts (AC #10, DEP-A)
  - [x] 6.12 Verify SKILL.md references `relay-groups` for distinguishing NIP-72 from NIP-29 (AC #10, DEP-A)

## Dev Notes

### This Is a Skill, Not TypeScript

This story produces a Claude Agent Skill (markdown + reference files + eval JSON) via the pipeline (Story 9.2). There is no `pnpm build`, no `pnpm test`, no TypeScript compilation. Validation is structural (validate-skill.sh) + TOON compliance (run-eval.sh).

### Classification: "Both" (Read + Write)

This skill is "both" read and write. Write: posting to communities (kind:1111), moderator approvals (kind:4550), community definitions (kind:34550), cross-posting (kind:6/16). Read: subscribing to community definitions (kind:34550), discovering approved posts (kind:4550), reading community metadata.

### Key Distinction: Approval-Based Moderation vs Relay-Enforced Groups

NIP-72 moderated communities and NIP-29 relay groups are different models for community organization:

| Aspect | NIP-72 Moderated Communities | NIP-29 Relay Groups |
|--------|------------------------------|---------------------|
| Authority model | Moderator-approved (kind:4550) | Relay-enforced (relay validates membership) |
| Visibility | Public -- anyone can post, moderators curate | Private -- relay rejects non-members |
| Post flow | Post first, then moderator approves | Relay validates membership before accepting |
| Community identity | kind:34550 replaceable event with `d` tag | Group ID in `h` tag, relay-managed state |
| Moderation mechanism | Approval events (kind:4550) + NIP-09 deletion | Admin events (kind:9000-9009) |
| Scoping tag | `a` tag referencing `34550:<pubkey>:<d>` | `h` tag with group ID |

The skill MUST clearly distinguish these two models. An agent asked about "communities" should activate this skill; asked about "groups" should activate `relay-groups`.

### NIP-72 Event Kinds (Reference)

| Kind | Name | Type | Purpose |
|------|------|------|---------|
| 34550 | Community Definition | Replaceable | Community metadata, moderator list, rules |
| 4550 | Approval Event | Regular | Moderator approves a post for the community |
| 1111 | Community Post | Regular | Post to a community (NIP-22) |
| 6 | Repost | Regular | Cross-post to a community |
| 16 | Generic Repost | Regular | Cross-post non-kind:1 events to a community |

### NIP-72 Tag Formats

**Community reference (a tag):** `["a", "34550:<author-pubkey>:<d-identifier>", "<relay-url>"]`

**Community posts (kind:1111) use paired uppercase/lowercase tags:**
- Top-level posts: both uppercase (`A`, `P`, `K`) and lowercase tags reference the community definition
- Nested replies: uppercase tags reference the community, lowercase tags reference the parent content
- Uppercase `A` tag: `["A", "34550:<pubkey>:<d>"]` -- scopes to community
- Uppercase `P` tag: `["P", "<community-author-pubkey>"]` -- community author
- Uppercase `K` tag: `["K", "34550"]` -- community event kind

**Approval events (kind:4550) must include:**
- Community `a` tag referencing the kind:34550 definition
- Post reference: `e` tag (for regular events) or `a` tag (for replaceable events), or both
- Author `p` tag for the post author
- Original post content as JSON-encoded string in the event content field

### TOON-Specific Community Dynamics

On TOON, NIP-72 communities interact with ILP economics creating a unique double-friction model:

- **Author pays to post:** Community posts (kind:1111) cost per-byte like all TOON writes. The author has economic skin in the game before the moderator even sees the post.
- **Moderator pays to approve:** Approval events (kind:4550) cost per-byte. This means moderators invest money in curation, not just time. Economically incentivizes careful moderation.
- **Community creator pays to define:** Creating or updating a community definition (kind:34550) costs per-byte. Establishing a community has economic cost.
- **Cross-posting costs compound:** Each cross-post (kind:6/16) to a different community costs independently. Spray-and-pray cross-posting is economically discouraged.
- **Double friction = quality elevation:** The combination of per-byte posting cost + moderator approval creates a two-stage quality filter absent from free Nostr relays. Content that survives both filters carries strong quality signals.

### Output Directory

```
.claude/skills/moderated-communities/
+-- SKILL.md                          # Required: frontmatter + community participation procedure
+-- references/
|   +-- nip-spec.md                   # NIP-72 spec details, event kinds, tag formats, approval flow
|   +-- toon-extensions.md            # TOON-specific community dynamics: double friction, moderation cost
|   +-- scenarios.md                  # Community participation scenarios with TOON flows
+-- evals/
    +-- evals.json                    # Skill-creator compatible eval definitions
```

**Note:** No `toon-protocol-context.md` in this skill's references. Per D9-010, the SKILL.md body references `nostr-protocol-core`'s `toon-protocol-context.md` as the single source of truth for TOON write/read model details.

### File Change Table

| File | Change | Type |
|------|--------|------|
| `.claude/skills/moderated-communities/SKILL.md` | Moderated communities skill with TOON write/read model | create |
| `.claude/skills/moderated-communities/references/nip-spec.md` | NIP-72 specification, event kinds, approval flow | create |
| `.claude/skills/moderated-communities/references/toon-extensions.md` | TOON-specific community dynamics | create |
| `.claude/skills/moderated-communities/references/scenarios.md` | Community participation scenarios | create |
| `.claude/skills/moderated-communities/evals/evals.json` | Eval definitions in skill-creator format | create |

**External references (not created, already exist):**
| `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` | Referenced from SKILL.md body (D9-010) | existing |
| `.claude/skills/nostr-social-intelligence/SKILL.md` | Referenced for base social intelligence (DEP-A) | existing |
| `.claude/skills/social-interactions/SKILL.md` | Referenced for community-scoped reactions (DEP-A) | existing |
| `.claude/skills/content-references/SKILL.md` | Referenced for URI embedding in community posts (DEP-A) | existing |
| `.claude/skills/relay-groups/SKILL.md` | Referenced for distinguishing NIP-72 from NIP-29 model (DEP-A) | existing |

### SKILL.md Format Requirements (from skill-creator)

- **Frontmatter:** YAML with ONLY `name` and `description` fields. No `license`, `version`, `author`, `tags`.
- **Description is the trigger mechanism.** Claude reads ONLY `name` + `description` to decide if the skill activates. All "when to use" information must be in the description. Target ~80-120 words.
- **Body:** Loaded only after skill triggers. Keep under 500 lines / ~5k tokens. Use imperative/infinitive form.
- **No extraneous files:** No README.md, INSTALLATION_GUIDE.md, etc.
- **References are loaded on-demand:** Claude reads reference files only when it determines they are needed. SKILL.md body must describe when to read each reference file.
- **Progressive disclosure:** Level 1 = frontmatter (~100 tokens). Level 2 = SKILL.md body (<5k tokens). Level 3 = references (unlimited).

### Cross-Story Context (Epic 9 Architecture)

- **Story 9.0 (`nostr-social-intelligence`) -- DONE.** Provides the base social intelligence layer. This skill's `## Social Context` section references community participation norms.
- **Story 9.1 (`nostr-protocol-core`) -- DONE.** Provides the TOON write/read model foundation. This skill references `nostr-protocol-core` for protocol context and fee calculation.
- **Story 9.2 (`nip-to-toon-skill`) -- DONE.** The pipeline that produces this skill. Run the pipeline with NIP-72 as input.
- **Story 9.3 (`skill-eval-framework`) -- DONE.** Validates this skill. Run `run-eval.sh` for structural + TOON compliance validation.
- **Story 9.4 (`social-identity`) -- DONE.** First pipeline-produced skill. Use as format/pattern reference. Body 79 lines, description 115 words, 3 reference files, 18 trigger + 5 output evals.
- **Story 9.5 (`long-form-content`) -- DONE.** Content publishing skill. Body 73 lines, description 97 words.
- **Story 9.6 (`social-interactions`) -- DONE.** Reactions/reposts/comments skill. Body 83 lines, description 108 words. Reactions (kind:7) can appear in community context. Cross-posting (kind:6/16) originates from this skill's repost coverage -- this skill extends it to community-scoped cross-posting.
- **Story 9.7 (`content-references`) -- DONE.** Content linking skill. Body ~85 lines, description ~108 words. `nostr:` URIs can appear in community posts.
- **Story 9.8 (`relay-groups`) -- DONE.** Relay-enforced groups skill. Body 98 lines, description ~130 words. 99 tests. CRITICAL: This skill covers NIP-29 relay groups which are fundamentally different from NIP-72 moderated communities. The `moderated-communities` skill MUST clearly distinguish the two models and NOT overlap with `relay-groups` content.

### Previous Story Intelligence (Story 9.8 -- Relay Groups)

**Story 9.8 (`relay-groups`) -- DONE.** Key learnings:
- Body was 98 lines, description ~130 words. Classification "both" (read + write).
- 99 tests total. 11 structural checks + 6 TOON compliance assertions all passing.
- Relay-as-authority model was the key conceptual distinction from earlier skills. For 9.9, the key distinction is approval-based moderation (post-then-approve vs relay-enforces-membership).
- `h` tag was critical across all files -- for 9.9, the equivalent is the `a` tag referencing `34550:<pubkey>:<d>` community definition.
- should-not-trigger evals in 9.8 included "how do moderated communities work?" -- confirming the two skills must be distinct.

**Common patterns across 9.4-9.8 (all pipeline-produced):**
- **Frontmatter strictness:** ONLY `name` and `description` fields. validate-skill.sh checks this.
- **Body size:** 73-98 lines across the five skills. Target ~80-90 lines for this skill.
- **Description size:** 97-130 words. Target ~100-120 words.
- **Reference files:** Consistently 3 files: nip-spec.md, toon-extensions.md, scenarios.md.
- **Eval structure:** 18 trigger evals (10 should-trigger, 8 should-not-trigger) + 5 output evals with expected_output field.
- **Output eval expected_output:** Must include expected_output field from the start (lesson from 9.6 code review).
- **Output eval assertion matching:** Assertions must match the prompt's read vs write nature (lesson from 9.7 code review).
- **Tag cross-checking:** Cross-check all tag requirements across all files (lesson from 9.6 k/K tag miss).
- **Numeric cross-checking:** Verify numeric claims (byte counts, costs) in one file, then check all other files for consistency (lesson from 9.7 code review).
- **Bare EVENT pattern:** Use non-triggering wording. validate-skill.sh greps for these.

### Anti-Patterns to Avoid (Dev Agent Guardrails)

- **DO NOT hand-author the skill from scratch.** Run the `nip-to-toon-skill` pipeline. The pipeline is the production mechanism (D9-001).
- **DO NOT create README.md, CHANGELOG.md, or any file not in the Output Directory tree.** Skill-creator forbids extraneous documentation.
- **DO NOT add frontmatter fields beyond `name` and `description`.** No `license`, `version`, `author`, `tags`.
- **DO NOT put "when to use" guidance in the body.** All trigger information goes in `description`.
- **DO NOT write bare `["EVENT", ...]` patterns in reference docs.** Use non-triggering wording. `validate-skill.sh` greps for these.
- **DO NOT duplicate `toon-protocol-context.md` content.** Reference `nostr-protocol-core` for detailed write/read model.
- **DO NOT use `scripts/init_skill.py` or `scripts/package_skill.py`.** Create files directly since structure is fully specified.
- **DO NOT skip validation.** Run `validate-skill.sh` AND `run-eval.sh` before marking complete.
- **DO NOT conflate moderated communities (NIP-72) with relay groups (NIP-29).** This skill covers kind:34550 community definitions and kind:4550 approval events. Relay groups (kind:9, kind:11, kind:9000-9009, kind:39000-39002) are Story 9.8.
- **DO NOT forget `expected_output` in output evals.** Learned from Story 9.6 code review -- all output evals must include this field.
- **DO NOT confuse the approval model with the relay-enforced model.** NIP-72: authors post, moderators approve. NIP-29: relay validates membership before accepting events. These are different trust models.
- **DO NOT omit the `a` tag from community-scoped event examples.** Community posts reference the community definition via `a` tag format `34550:<pubkey>:<d>`. Cross-check this across all files.
- **DO NOT forget the uppercase/lowercase tag distinction for kind:1111.** Top-level posts use both uppercase (A/P/K for community scope) and lowercase (for NIP-22 threading). Nested replies use uppercase for community, lowercase for parent. This is a NIP-72-specific tagging requirement.

### Design Decision Compliance

- **D9-001 (Pipeline over catalog):** Skill produced by running the `nip-to-toon-skill` pipeline, not hand-authored.
- **D9-002 (TOON-first):** Teaches TOON protocol (ILP-gated writes, per-byte community posts and approvals) with vanilla NIP as baseline.
- **D9-003 (Social intelligence is cross-cutting):** `## Social Context` section with community-specific guidance. References 9.0 base skill for community participation norms.
- **D9-004 (Economics shape social norms):** Double-friction model (per-byte posting + moderator approval) creates unique economic dynamics that shape community culture. Documented as social feature.
- **D9-007 (Skill-creator methodology):** evals.json in skill-creator format. Description optimization. With/without baseline.
- **D9-008 (Why over rules):** Reference files explain reasoning, not rigid ALWAYS/NEVER patterns.
- **D9-010 (Protocol changes propagate):** References `toon-protocol-context.md` as single source of truth.

### Existing Skill Patterns (DO NOT REINVENT)

Reference these existing skills for format examples:
- `.claude/skills/relay-groups/SKILL.md` -- Story 9.8. "Both" classification. Body 98 lines. ~130-word description. 3 reference files. 99 tests.
- `.claude/skills/content-references/SKILL.md` -- Story 9.7. "Both" classification. Body ~85 lines. ~108-word description. 3 reference files.
- `.claude/skills/social-interactions/SKILL.md` -- Story 9.6. "Both" classification. Body 83 lines. 108-word description. 3 reference files.
- `.claude/skills/long-form-content/SKILL.md` -- Story 9.5. "Both" classification. Body 73 lines. 97-word description.
- `.claude/skills/social-identity/SKILL.md` -- Story 9.4. Write-capable skill. Body 79 lines. 115-word description.
- `.claude/skills/nostr-protocol-core/SKILL.md` -- Story 9.1. Write-capable skill. Body under 60 lines.
- `.claude/skills/nostr-social-intelligence/SKILL.md` -- Story 9.0. Comprehensive trigger phrases in description.
- `.claude/skills/nip-to-toon-skill/SKILL.md` -- Story 9.2. The pipeline to run.
- `.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh` -- Structural validation. 11 checks.
- `.claude/skills/skill-eval-framework/scripts/run-eval.sh` -- TOON compliance validation. 6 assertions.
- `.claude/skills/nip-to-toon-skill/references/toon-compliance-assertions.md` -- The 5 TOON assertion definitions.
- `.claude/skills/nip-to-toon-skill/references/social-context-template.md` -- Template for Social Context sections.

### Project Structure Notes

- Skill directory: `.claude/skills/moderated-communities/` (follows `.claude/skills/<skill-name>/` convention)
- Eval framework scripts: `.claude/skills/skill-eval-framework/scripts/`
- Validation script: `.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh`
- No TypeScript source changes. No package.json changes. No build changes.

### Git Intelligence

Recent commits on `epic-9` branch:
- `4e35b44 feat(9-8): Relay Groups Skill -- NIP-29, relay-as-authority model, 99 tests`
- `cbb85f0 feat(9-7): Content References Skill -- NIP-21/NIP-27, nostr: URI scheme, 72 tests`
- `4b16892 feat(9-6): Social Interactions Skill -- NIP-22/18/25, kind:7/6/16/1111, 73 tests`
- `9dd4275 feat(9-5): Long-form Content Skill -- NIP-23/NIP-14, kind:30023, 63 tests`
- `01634b2 feat(9-4): Social Identity Skill -- first pipeline-produced skill, NIP-02/05/24/39, 50 tests`

Expected commit for this story: `feat(9-9): Moderated Communities Skill -- NIP-72, kind:34550/4550/1111, approval-based moderation, N tests`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` Story 9.9 -- Moderated Communities Skill definition]
- [Source: `_bmad-output/planning-artifacts/test-design-epic-9.md` Standard Skill Validation Template + Phase 3 notes]
- [Source: `_bmad-output/implementation-artifacts/9-8-relay-groups-skill.md` -- Previous story, pattern reference]
- [Source: `_bmad-output/implementation-artifacts/9-7-content-references-skill.md` -- Phase 2 sibling, pattern reference]
- [Source: `_bmad-output/implementation-artifacts/9-6-social-interactions-skill.md` -- Phase 2 sibling, cross-posting origin]
- [Source: NIP-72 spec (https://github.com/nostr-protocol/nips/blob/master/72.md)]
- [Source: NIP-22 spec (kind:1111 comment events referenced by NIP-72 for community posts)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None -- clean implementation, no debug issues encountered.

### Completion Notes List

- **Task 1 (Pipeline execution):** Executed NIP-to-TOON pipeline with NIP-72 as input. Classified as "both" (read + write). Key distinction identified: approval-based moderation (NIP-72) vs relay-enforced membership (NIP-29). Double-friction model (per-byte cost + moderator approval) documented as the core TOON-specific dynamic.
- **Task 2 (Directory structure):** Created `.claude/skills/moderated-communities/` with SKILL.md, references/ (3 files), and evals/ (1 file). No extraneous files. 5 files total.
- **Task 3 (SKILL.md authoring):** 100-word description with protocol + social-situation triggers. 80-line body covering NIP-72 community definitions (kind:34550), approval events (kind:4550), community posts (kind:1111 with uppercase A/P/K tags and lowercase a/p/k mirrors), cross-posting (kind:6/16), backward compatibility. TOON Write Model, TOON Read Model, Social Context (279 words), and When to Read Each Reference sections. All 5 dependency references included (nostr-protocol-core x3, nostr-social-intelligence x2, social-interactions x3, content-references x2, relay-groups x2).
- **Task 4 (Reference files):** nip-spec.md covers full NIP-72 spec with approval model, community definitions, paired tag system, cross-posting, subscription filtering. toon-extensions.md covers double-friction model, byte costs for all event types, TOON-format parsing. scenarios.md covers 6 scenarios: creating community, posting, moderator approval, cross-posting, discovering communities, replying in threads. All files include "Why this reference exists" reasoning per D9-008.
- **Task 5 (Evals):** 20 trigger evals (10 should-trigger, 10 should-not-trigger) + 5 output evals with rubric-based grading and TOON compliance assertions. Output evals cover: community posting with A/P/K tags, moderator approval with embedded content, NIP-72 vs NIP-29 distinction, fee calculation across event types, community discovery with TOON-format parsing.
- **Task 6 (Validation):** validate-skill.sh: 11/11 structural checks PASS. run-eval.sh: 7/7 checks PASS (classification: both). Description 100 words, body 80 lines, all dependency references verified, no extraneous files, frontmatter has only name and description.

### File List

- `.claude/skills/moderated-communities/SKILL.md` (created)
- `.claude/skills/moderated-communities/references/nip-spec.md` (created)
- `.claude/skills/moderated-communities/references/toon-extensions.md` (created)
- `.claude/skills/moderated-communities/references/scenarios.md` (created)
- `.claude/skills/moderated-communities/evals/evals.json` (created)
- `tests/skills/test-moderated-communities-skill.sh` (modified)
- `_bmad-output/implementation-artifacts/9-9-moderated-communities-skill.md` (modified)

### Change Log

- **2026-03-26:** Story 9.9 Moderated Communities Skill implemented. Created complete skill directory with SKILL.md (80-line body, 100-word description), 3 reference files (nip-spec.md, toon-extensions.md, scenarios.md), and evals.json (20 trigger + 5 output evals). All 11 structural checks and 6 TOON compliance assertions pass. Classification: both (read + write). Key feature: approval-based moderation model with double-friction quality dynamics on TOON.
- **2026-03-27:** Code review (AI). 6 issues found (0 critical, 3 medium, 3 low), all fixed. (1) Removed toon-write-check/toon-fee-check assertions from read-only output evals (discover-communities, approval-model-explanation) to match relay-groups precedent. (2) Updated AC7-EVAL-ASSERTIONS test to distinguish write vs read evals. (3) Added test file to story File List. (4) Added "community post" trigger phrase to description (now 100 words, 16/16 phrases). (5) Added lowercase a/p/k tag examples for top-level posts in SKILL.md. (6) Corrected description word count in completion notes (93 -> 100).
- **2026-03-27:** Code review #2 (AI). 1 issue found (0 critical, 0 high, 1 medium, 0 low), fixed. (1) Corrected test file header: total count 83->82 (81 automated + 1 skipped), added missing AC7-EVAL-ASSERTIONS to test ID listing.
- **2026-03-27:** Code review #3 (AI). 2 issues found (0 critical, 0 high, 1 medium, 1 low), all fixed. Security review (OWASP top 10, injection, auth): no vulnerabilities found. (1) Change Log 2026-03-26 entry still reported "93-word description" despite Review Pass #1 correcting completion notes -- fixed to "100-word description". (2) Task 6 completion notes claimed "body 81 lines" but actual body is 80 lines -- corrected.

## Code Review Record

### Review Pass #1

- **Date:** 2026-03-27
- **Reviewer model:** Claude Opus 4.6 (1M context)
- **Severity counts:** 0 critical, 0 high, 3 medium, 3 low
- **Outcome:** All 6 issues fixed

**Medium issues (3):**
1. **discover-communities eval had write assertions on read-only prompt** -- Removed `toon-write-check` and `toon-fee-check` assertions from the `discover-communities` output eval, which tests a read-only prompt and should not assert write behavior.
2. **approval-model-explanation eval same mismatch** -- Removed `toon-write-check` and `toon-fee-check` assertions from the `approval-model-explanation` output eval for the same reason (read-only prompt with write assertions).
3. **Story File List missing test file** -- Added `tests/skills/test-moderated-communities-skill.sh` to the File List section in the story file.

**Low issues (3):**
4. **Description missing trigger phrase** -- Added "community post" trigger phrase to the SKILL.md description, bringing it to 100 words and 16/16 required trigger phrases per AC8.
5. **SKILL.md omitted lowercase tag examples** -- Added lowercase `a`/`p`/`k` tag examples for top-level community posts in the SKILL.md body, clarifying the paired uppercase/lowercase tag system.
6. **Completion notes word count mismatch** -- Corrected the description word count in completion notes from 93 to 100 to match the actual post-fix count.

### Review Pass #2

- **Date:** 2026-03-27
- **Reviewer model:** Claude Opus 4.6 (1M context)
- **Severity counts:** 0 critical, 0 high, 1 medium, 0 low
- **Outcome:** 1 issue fixed

**Medium issues (1):**
1. **Test file header stale after Review Pass #1** -- The test header claimed "83 tests (82 automated + 1 skipped)" but actual unique test count is 82 (81 automated + 1 skipped). The `AC7-EVAL-ASSERTIONS` test was added during Review Pass #1 but the header test ID listing and total count were not updated. Fixed header to list AC7-EVAL-ASSERTIONS and correct total to 82.

### Review Pass #3

- **Date:** 2026-03-27
- **Reviewer model:** Claude Opus 4.6 (1M context)
- **Severity counts:** 0 critical, 0 high, 1 medium, 1 low
- **Security review:** OWASP top 10, injection risks, authentication/authorization flaws -- no vulnerabilities found. Shell test script uses `set -euo pipefail`, properly quotes variables, no eval/exec injection vectors, no user-controlled input in shell commands.
- **Outcome:** All 2 issues fixed

**Medium issues (1):**
1. **Change Log 2026-03-26 entry had stale description word count** -- The Change Log entry from the initial implementation still reported "93-word description" despite Review Pass #1 fixing the completion notes. The description is 100 words post-fix. Corrected the Change Log entry to "100-word description".

**Low issues (1):**
2. **Task 6 completion notes body line count off-by-one** -- Task 6 completion notes claimed "body 81 lines" but actual body (after second `---` frontmatter delimiter) is 80 lines. Corrected to "body 80 lines".
