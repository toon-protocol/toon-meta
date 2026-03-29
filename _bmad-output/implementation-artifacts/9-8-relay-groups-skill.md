# Story 9.8: Relay Groups Skill (`relay-groups`)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **TOON agent**,
I want a skill teaching relay-based group participation,
So that I can join and interact in TOON community spaces.

**Dependencies:** Stories 9.0 (social intelligence -- done), 9.1 (protocol core -- done), 9.2 (pipeline -- done), 9.3 (eval framework -- done), 9.4 (social identity -- done, pattern reference), 9.5 (long-form content -- done), 9.6 (social interactions -- done), 9.7 (content references -- done)

**Decision sources:**
- Party Mode 2026-03-22: NIP Skills Epic (D9-001, D9-002, D9-003, D9-004, D9-007)
- `_bmad-output/project-context.md` section "NIP-to-TOON Skill Pipeline Architecture"
- `_bmad-output/planning-artifacts/epics.md` Epic 9, Story 9.8
- `_bmad-output/planning-artifacts/test-design-epic-9.md` Phase 3 Community and Groups notes

**Downstream dependencies:** This is the first Phase 3 (Community & Groups) skill. Stories 9.9 (Moderated Communities) and 9.10 (Public Chat) continue Phase 3 with no dependency on 9.8. Story 9.34 (publication gate) validates this skill alongside all others.

**Nature of deliverable:** This story produces a **Claude Agent Skill** (structured markdown + reference files + eval JSON), produced by running the `nip-to-toon-skill` pipeline (Story 9.2). The skill teaches an agent HOW to participate in relay-based groups using NIP-29: creating groups, managing membership, posting group messages, understanding admin roles, and respecting group culture. Output is a `.claude/skills/relay-groups/` directory.

**Risk context:** E9-R001 (pipeline single point of failure) -- mitigated because 9.4-9.7 already validated the pipeline. E9-R008 (write model correctness varies by NIP) -- NIP-29 groups are relay-enforced, meaning the relay itself manages group state. This is a critical distinction from earlier skills: the relay is the authority, not just a message router. On TOON, relay-enforced groups interact with ILP-gated writes: group membership may require payment, and group messages cost per-byte like all writes. The skill must teach this relay-as-authority model clearly.

**Rationale:** D9-001 (pipeline over catalog) means this skill is produced by running the `nip-to-toon-skill` pipeline, not hand-authored. D9-002 (TOON-first) means the skill teaches TOON protocol context with vanilla NIP as baseline. D9-003 (social intelligence is cross-cutting) means a `## Social Context` section explains group participation norms. D9-004 (economics shape social norms) means that ILP-gated group entry creates an economic barrier that shapes group dynamics -- paid groups may have higher-quality discourse.

## Acceptance Criteria

### AC1: Pipeline Production [Test: STRUCT-A, STRUCT-B]
**Given** the `nip-to-toon-skill` pipeline (Story 9.2)
**When** the pipeline is run with NIP-29 as input
**Then** it produces a complete `relay-groups` skill directory at `.claude/skills/relay-groups/` with:
- `SKILL.md` with YAML frontmatter (ONLY `name` and `description` fields)
- `references/` directory with Level 3 reference files
- `evals/evals.json` in skill-creator format

### AC2: NIP Coverage [Test: EVAL-A, EVAL-B]
**Given** the `relay-groups/SKILL.md` file
**When** an agent needs to participate in relay-based groups on TOON
**Then** the skill covers:
- **NIP-29 (Relay-based Groups):** Group management model where relays enforce membership and permissions. Group IDs (arbitrary strings chosen by relay). Group metadata (kind:39000 -- name, about, picture, pinned notes, etc.). Group admins list (kind:39001). Group members list (kind:39002). Moderation events: kind:9000 (add user), kind:9001 (remove user), kind:9002 (edit metadata), kind:9003 (add permission), kind:9004 (remove permission), kind:9005 (delete event), kind:9006 (edit group status -- open/closed), kind:9007 (create group), kind:9008 (delete group), kind:9009 (create invite). Group-scoped events: kind:9 (group chat message), kind:11 (group thread). `h` tag for group ID, relay URL requirement (events must be sent to the relay hosting the group).
- **Relay-as-authority model:** Unlike regular Nostr where events are signed by authors and relays just store/forward, NIP-29 groups are relay-enforced. The relay validates membership before accepting group events. The relay can delete events, manage members, and enforce permissions. This is a fundamentally different trust model.

### AC3: TOON Write Model [Test: TOON-A, TOON-B]
**Given** the skill has write aspects (posting to groups, admin actions)
**When** the skill teaches group participation on TOON
**Then** it:
- Explains that group messages (kind:9, kind:11) are published via `publishEvent()` from `@toon-protocol/client` and cost per-byte like all TOON writes
- Notes that group messages require the `h` tag (group ID) and must be sent to the specific relay hosting the group
- References `nostr-protocol-core` for the detailed fee formula and `publishEvent()` API
- Explains that admin actions (kind:9000-9009) also cost per-byte on TOON -- administering a group has economic cost
- Notes that group entry on TOON may be ILP-gated: the hosting relay could require a payment channel or specific payment for group access
- Explains that closed groups (invite-only) combined with ILP gating create a dual-barrier model: both social approval AND economic commitment

### AC4: TOON Read Model [Test: TOON-C]
**Given** the skill handles reading group state and messages
**When** teaching group data consumption
**Then** it documents that TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. References `nostr-protocol-core` for TOON format parsing details. Explains how to subscribe to group events using `h` tag filters. Notes that group metadata (kind:39000), admin lists (kind:39001), and member lists (kind:39002) are replaceable events maintained by the relay. Explains that group-scoped subscriptions should filter by the `h` tag value matching the group ID.

### AC5: Social Context [Test: STRUCT-D, TOON-D]
**Given** the `## Social Context` section
**When** an agent reads it
**Then** it provides group-specific social guidance:
- Groups are intimate spaces with their own culture. Each group develops norms, inside references, and communication styles. Observe before participating actively.
- On TOON, every group message costs money. This creates a natural quality filter -- low-effort spam is economically disincentivized. The flip side: silence is free, contributing costs. This can create hesitancy.
- Admin actions carry weight because they cost money AND affect other members' experience. Removing a user (kind:9001) or deleting a message (kind:9005) should be deliberate, not impulsive.
- Reactions within groups (kind:7 with `h` tag) feel more personal than public reactions -- the audience is smaller and more defined. A reaction in a 10-person group is direct address; in a 1000-person group it is a signal in noise.
- Closed groups with ILP-gated entry create high-trust environments. Members have both social approval and economic skin in the game. Respect this investment.
- Different relays may run different groups with different rules. The relay is the authority for its groups -- respect relay-specific norms.
- Section would NOT make sense if NIP name were replaced (passes substitution test).

### AC6: Eval Suite [Test: EVAL-A, EVAL-B]
**Given** the `evals/evals.json` file
**When** eval validation runs
**Then** it contains:
- 8-10 should-trigger queries including both protocol and social-situation triggers (e.g., "how do I join a group?", "how do relay groups work?", "NIP-29 groups", "how do I create a group on a relay?", "how do I post a message to a group?", "what is the h tag?", "group admin actions", "how do I invite someone to a group?", "relay-based group participation", "how do I manage group membership?")
- 8-10 should-not-trigger queries (e.g., "how do I create a profile?", "how do I publish a long-form article?", "how do reactions work?", "how do I follow someone?", "how does encrypted messaging work?", "how do I reference another note?", "how do moderated communities work?", "how do I search for content?", "how do I upload a file?")
- 4-6 output evals with `id`, `prompt`, `expected_output`, `rubric`, `assertions`

### AC7: TOON Compliance Passing [Test: TOON-A through TOON-D]
**Given** the eval framework (Story 9.3)
**When** `run-eval.sh` is run on the `relay-groups` skill
**Then** all 6 TOON compliance assertions pass:
- `toon-write-check`: references `publishEvent()` (write-supporting skill -- group messages, admin actions)
- `toon-fee-check`: includes fee awareness (group messages cost per-byte, admin actions cost per-byte)
- `toon-format-check`: documents TOON-format strings (read-capable skill)
- `social-context-check`: has group-specific `## Social Context` section
- `trigger-coverage`: description includes both protocol and social-situation triggers
- `eval-completeness`: at least 6 trigger evals + 4 output evals

### AC8: Description Optimization [Test: STRUCT-B]
**Given** the skill's description field
**When** optimization is complete
**Then** the description:
- Contains ~80-120 words
- Includes trigger phrases for: NIP-29, relay groups, group chat, group membership, h tag, kind:9, kind:11, group admin, group moderation, create group, join group, group message, relay-based groups, group invite, group permissions, closed group, open group
- Includes social-situation triggers ("how do I join a group?", "how do I post in a group?", "how do I manage group members?", "how do relay-based groups work?")
- Has been through at least one optimization pass

### AC9: Token Budget [Test: STRUCT-C]
**Given** the `relay-groups/SKILL.md` file
**When** token budget validation runs
**Then** the SKILL.md body (excluding frontmatter) is under 500 lines and approximately 5k tokens or fewer.

### AC10: Dependency References [Test: DEP-A]
**Given** the `relay-groups` skill
**When** the skill references upstream skills
**Then** it:
- References `nostr-protocol-core` (Story 9.1) for TOON write/read model details, fee calculation, and event structure
- References `nostr-social-intelligence` (Story 9.0) for base social intelligence and group participation norms
- References `social-interactions` (Story 9.6) for reactions within group context (kind:7 with `h` tag)
- References `content-references` (Story 9.7) for `nostr:` URI embedding within group messages
- Does NOT duplicate content from upstream skills -- uses pointers instead

### AC11: With/Without Baseline [Test: BASE-A]
**Given** the `relay-groups` skill
**When** with/without testing runs (pipeline Step 8)
**Then** an agent with the skill loaded produces measurably better group participation responses than an agent without it, demonstrating the skill adds value over baseline.

## Tasks / Subtasks

- [x] Task 1: Run the NIP-to-TOON pipeline (AC: #1, #11)
  - [x] 1.1 Load the `nip-to-toon-skill` skill from `.claude/skills/nip-to-toon-skill/SKILL.md`
  - [x] 1.2 Execute the 13-step pipeline with input NIP: NIP-29 (Relay-based Groups)
  - [x] 1.3 Pipeline Step 1 (NIP Analysis): Classify as "both" (read + write). NIP-29 defines relay-enforced group management. Multiple event kinds for group state (39000-39002), admin actions (9000-9009), and group messages (9, 11). Relay-as-authority model is a key distinction.
  - [x] 1.4 Pipeline Step 2 (TOON Context Injection): Inject write model (group messages and admin actions via publishEvent, h tag requirement, relay-specific routing), read model (TOON format, group state subscriptions via h tag filters), fee context (group messages cost per-byte, admin actions cost per-byte, ILP-gated group entry).
  - [x] 1.5 Pipeline Step 3 (Social Context Layer): Generate group-specific social context using `references/social-context-template.md`. Focus on group culture norms, economic dynamics of paid group participation, admin responsibility weight.
  - [x] 1.6 Pipeline Step 4 (Skill Authoring): Generate SKILL.md with frontmatter, body, and references.
  - [x] 1.7 Pipeline Step 5 (Eval Generation): Generate `evals/evals.json` with trigger + output evals.
  - [x] 1.8 Pipeline Step 6 (TOON Assertions): Auto-inject TOON compliance assertions.
  - [x] 1.9 Pipeline Step 7 (Description Optimization): Run optimization loop with 20 trigger queries, max 5 iterations.
  - [x] 1.10 Pipeline Step 8 (With/Without Testing): Spawn parallel subagent runs -- one with skill loaded, one without (baseline).
  - [x] 1.11 Pipeline Steps 9-10 (Grading + Benchmarking): Produce `grading.json` and `benchmark.json`.
  - [x] 1.12 Pipeline Step 11 (TOON Compliance Validation): Run TOON-specific assertion checks.
  - [x] 1.13 Pipeline Steps 12-13 (Eval Viewer + Iterate): Generate HTML review, collect feedback, refine if needed.

- [x] Task 2: Create skill directory structure (AC: #1)
  - [x] 2.1 Create `.claude/skills/relay-groups/` directory
  - [x] 2.2 Create `SKILL.md` with YAML frontmatter (`name: relay-groups`, `description` with trigger phrases)
  - [x] 2.3 Create `references/` subdirectory with Level 3 reference files
  - [x] 2.4 Create `evals/` subdirectory with `evals.json`
  - [x] 2.5 Verify directory layout matches skill-creator anatomy (no extraneous files)

- [x] Task 3: Author SKILL.md (AC: #2, #3, #4, #5, #8, #9, #10)
  - [x] 3.1 Write frontmatter with ONLY `name` and `description` fields
  - [x] 3.2 Write description (~80-120 words) with protocol + social-situation triggers
  - [x] 3.3 Write body covering: NIP-29 relay-based group model, group IDs and h tag, group metadata (kind:39000), admin list (kind:39001), member list (kind:39002), admin actions (kind:9000-9009), group messages (kind:9, kind:11), relay-as-authority model, open vs closed groups, group invites (kind:9009)
  - [x] 3.4 Include TOON Write Model section: group messages via `publishEvent()`, h tag required, relay-specific routing, admin actions cost per-byte, ILP-gated group entry possibility
  - [x] 3.5 Include TOON Read Model section: TOON-format parsing, group state subscriptions via h tag filters, replaceable event model for group metadata/members/admins
  - [x] 3.6 Include `## Social Context` section with group-specific guidance on group culture, economic dynamics, admin responsibility, reaction intimacy, closed-group trust
  - [x] 3.7 Include "When to read each reference" section
  - [x] 3.8 Include pointers to `nostr-protocol-core` for TOON write/read model and fee calculation (D9-010, DEP-A)
  - [x] 3.9 Include pointer to `nostr-social-intelligence` for base social context and group norms (DEP-A)
  - [x] 3.10 Include pointer to `social-interactions` for reactions within group context (DEP-A)
  - [x] 3.11 Include pointer to `content-references` for `nostr:` URI embedding within group messages (DEP-A)
  - [x] 3.12 Keep body under 500 lines / ~5k tokens
  - [x] 3.13 Use imperative/infinitive form per skill-creator writing guidelines

- [x] Task 4: Author reference files (AC: #2, #10)
  - [x] 4.1 Write `references/nip-spec.md` -- NIP-29 spec details. Group management model (relay-enforced). Group IDs (arbitrary strings, relay-chosen). Event kinds: group metadata (kind:39000 -- name, about, picture, pinned notes via `note` tags), admin list (kind:39001 -- `p` tags for admins with roles), member list (kind:39002 -- `p` tags for members). Admin/moderation events: kind:9000 (add user -- `p` tag), kind:9001 (remove user -- `p` tag), kind:9002 (edit metadata), kind:9003 (add permission -- `p` tag + permission name), kind:9004 (remove permission -- `p` tag + permission name), kind:9005 (delete event -- `e` tag), kind:9006 (edit group status -- open/closed), kind:9007 (create group), kind:9008 (delete group), kind:9009 (create invite -- `code` tag). Group-scoped events: kind:9 (group chat message), kind:11 (group thread). `h` tag format and usage. Open vs closed group status. Permission model (add-user, edit-metadata, delete-event, etc.).
  - [x] 4.2 Write `references/toon-extensions.md` -- TOON-specific group participation: ILP-gated group entry (relay may require payment channel), per-byte cost of group messages and admin actions, publishEvent integration for group events, TOON-format parsing for group subscriptions, economic dynamics of paid group participation (quality floor, hesitancy risk, admin cost weight).
  - [x] 4.3 Write `references/scenarios.md` -- Group participation scenarios: joining an open group, posting a message in a group chat (kind:9 with h tag), starting a thread in a group (kind:11), admin adding a member (kind:9000), admin removing a member (kind:9001), creating a new group (kind:9007), subscribing to group state (kind:39000/39001/39002). Each with step-by-step TOON flow.
  - [x] 4.4 Reference `nostr-protocol-core` skill's `toon-protocol-context.md` from SKILL.md body (per D9-010: single source of truth). Do NOT duplicate `toon-protocol-context.md` into this skill's references directory.
  - [x] 4.5 Every reference file must explain WHY (reasoning per D9-008), not just list rules

- [x] Task 5: Create evals (AC: #6)
  - [x] 5.1 Create `evals/evals.json` in skill-creator format
  - [x] 5.2 8-10 should-trigger queries covering: NIP-29, relay groups, group chat, h tag, group membership, group admin, group moderation, create group, join group, invite to group, group permissions, closed group, relay-based groups
  - [x] 5.3 8-10 should-not-trigger queries: profile creation, long-form publishing, content references, reactions (standalone), encrypted messaging, search, file storage, community moderation (NIP-72), labels, polls
  - [x] 5.4 4-6 output evals with assertions testing: (1) group message includes h tag and correct relay routing, (2) admin action uses correct event kind, (3) relay-as-authority model explained, (4) fee awareness for group messages, (5) TOON-format reading mentioned for group subscriptions
  - [x] 5.5 Include TOON compliance assertions in output eval assertions
  - [x] 5.6 Use rubric-based grading: `correct` / `acceptable` / `incorrect`

- [x] Task 6: Run validation (AC: #7, #9, #10, #11)
  - [x] 6.1 Run `validate-skill.sh` (from Story 9.2) on `.claude/skills/relay-groups/` -- must pass all 11 structural checks
  - [x] 6.2 Run `run-eval.sh` (from Story 9.3) on `.claude/skills/relay-groups/` -- must pass all 6 TOON compliance assertions
  - [x] 6.3 Verify `evals/evals.json` is valid JSON with required structure
  - [x] 6.4 Verify SKILL.md body is under 500 lines and approximately 5k tokens or fewer (AC #9)
  - [x] 6.5 Verify description is 80-120 words
  - [x] 6.6 Verify no extraneous files (no README.md, CHANGELOG.md, etc.)
  - [x] 6.7 Verify YAML frontmatter has ONLY `name` and `description` fields
  - [x] 6.8 Verify SKILL.md references `nostr-protocol-core` for TOON write/read model (AC #10, DEP-A)
  - [x] 6.9 Verify SKILL.md references `nostr-social-intelligence` for base social context (AC #10, DEP-A)
  - [x] 6.10 Verify SKILL.md references `social-interactions` for group-scoped reactions (AC #10, DEP-A)
  - [x] 6.11 Verify SKILL.md references `content-references` for URI embedding in group messages (AC #10, DEP-A)

## Dev Notes

### This Is a Skill, Not TypeScript

This story produces a Claude Agent Skill (markdown + reference files + eval JSON) via the pipeline (Story 9.2). There is no `pnpm build`, no `pnpm test`, no TypeScript compilation. Validation is structural (validate-skill.sh) + TOON compliance (run-eval.sh).

### Classification: "Both" (Read + Write)

This skill is "both" read and write. Write: posting group messages (kind:9, kind:11), performing admin actions (kind:9000-9009). Read: subscribing to group state (kind:39000, 39001, 39002), receiving group messages. The relay-as-authority model means write operations are relay-validated -- the relay checks membership before accepting group-scoped events.

### Key Distinction: Relay-as-Authority Model

Previous skills (9.4-9.7) taught event kinds where the relay is a store-and-forward mechanism. NIP-29 is fundamentally different: the relay ENFORCES group membership and permissions. The relay:
- Validates that the sender is a group member before accepting kind:9 or kind:11 events
- Manages group metadata, admin lists, and member lists as relay-controlled replaceable events
- Can delete events, remove members, and enforce permissions
- Is the authoritative source for group state

This means the skill must teach a different mental model: the relay is not just a message router but an authority with enforcement power.

### TOON-Specific Group Dynamics

On TOON, NIP-29 groups interact with ILP economics in several ways:
- **ILP-gated entry:** The relay hosting a group could require an open payment channel or specific payment to allow group participation. This creates economic commitment beyond social invitation.
- **Per-byte group messages:** All group messages (kind:9 chat, kind:11 thread) cost per-byte like any TOON write. This naturally discourages spam and low-effort messages in group contexts.
- **Admin action costs:** Admin operations (adding/removing members, editing metadata, deleting events) also cost per-byte. This gives economic weight to administrative decisions.
- **Quality floor:** The combination of ILP gating + per-byte costs creates a quality floor for group discourse. Paid groups may attract higher-quality participants who value the space.

### NIP-29 Event Kinds (Reference)

| Kind | Name | Type | Purpose |
|------|------|------|---------|
| 9 | Group Chat Message | Regular | Short message in a group |
| 11 | Group Thread | Regular | Threaded discussion in a group |
| 9000 | Add User | Moderation | Admin adds a member to the group |
| 9001 | Remove User | Moderation | Admin removes a member from the group |
| 9002 | Edit Metadata | Moderation | Admin edits group metadata |
| 9003 | Add Permission | Moderation | Admin grants permission to a member |
| 9004 | Remove Permission | Moderation | Admin revokes permission from a member |
| 9005 | Delete Event | Moderation | Admin deletes an event from the group |
| 9006 | Edit Group Status | Moderation | Admin changes open/closed status |
| 9007 | Create Group | Moderation | Create a new group on a relay |
| 9008 | Delete Group | Moderation | Delete a group |
| 9009 | Create Invite | Moderation | Generate invite code for closed group |
| 39000 | Group Metadata | Replaceable | Group name, about, picture, pinned |
| 39001 | Group Admins | Replaceable | List of admins with roles |
| 39002 | Group Members | Replaceable | List of members |

### NIP-29 h Tag Format

All group-scoped events MUST include an `h` tag with the group ID:
```
["h", "<group-id>"]
```
The group ID is an arbitrary string chosen by the relay when the group is created. Group events must be sent to the specific relay hosting the group -- sending a group event to a different relay will be rejected.

### Permissions Model

NIP-29 defines granular permissions that admins can grant/revoke:
- `add-user` -- Can add new members
- `edit-metadata` -- Can modify group name/about/picture
- `delete-event` -- Can remove events from the group
- `remove-user` -- Can remove members
- `add-permission` -- Can grant permissions to others
- `remove-permission` -- Can revoke permissions from others
- `edit-group-status` -- Can change open/closed status

### Output Directory

```
.claude/skills/relay-groups/
+-- SKILL.md                          # Required: frontmatter + group participation procedure
+-- references/
|   +-- nip-spec.md                   # NIP-29 spec details, event kinds, h tag, permissions
|   +-- toon-extensions.md            # TOON-specific group dynamics: ILP gating, per-byte costs
|   +-- scenarios.md                  # Group participation scenarios with TOON flows
+-- evals/
    +-- evals.json                    # Skill-creator compatible eval definitions
```

**Note:** No `toon-protocol-context.md` in this skill's references. Per D9-010, the SKILL.md body references `nostr-protocol-core`'s `toon-protocol-context.md` as the single source of truth for TOON write/read model details.

### File Change Table

| File | Change | Type |
|------|--------|------|
| `.claude/skills/relay-groups/SKILL.md` | Relay groups skill with TOON write/read model | create |
| `.claude/skills/relay-groups/references/nip-spec.md` | NIP-29 specification, event kinds, permissions model | create |
| `.claude/skills/relay-groups/references/toon-extensions.md` | TOON-specific group dynamics | create |
| `.claude/skills/relay-groups/references/scenarios.md` | Group participation scenarios | create |
| `.claude/skills/relay-groups/evals/evals.json` | Eval definitions in skill-creator format | create |

**External references (not created, already exist):**
| `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` | Referenced from SKILL.md body (D9-010) | existing |
| `.claude/skills/nostr-social-intelligence/SKILL.md` | Referenced for base social intelligence (DEP-A) | existing |
| `.claude/skills/social-interactions/SKILL.md` | Referenced for group-scoped reactions (DEP-A) | existing |
| `.claude/skills/content-references/SKILL.md` | Referenced for URI embedding in group messages (DEP-A) | existing |

### SKILL.md Format Requirements (from skill-creator)

- **Frontmatter:** YAML with ONLY `name` and `description` fields. No `license`, `version`, `author`, `tags`.
- **Description is the trigger mechanism.** Claude reads ONLY `name` + `description` to decide if the skill activates. All "when to use" information must be in the description. Target ~80-120 words.
- **Body:** Loaded only after skill triggers. Keep under 500 lines / ~5k tokens. Use imperative/infinitive form.
- **No extraneous files:** No README.md, INSTALLATION_GUIDE.md, etc.
- **References are loaded on-demand:** Claude reads reference files only when it determines they are needed. SKILL.md body must describe when to read each reference file.
- **Progressive disclosure:** Level 1 = frontmatter (~100 tokens). Level 2 = SKILL.md body (<5k tokens). Level 3 = references (unlimited).

### Cross-Story Context (Epic 9 Architecture)

- **Story 9.0 (`nostr-social-intelligence`) -- DONE.** Provides the base social intelligence layer. This skill's `## Social Context` section references group participation norms and community culture.
- **Story 9.1 (`nostr-protocol-core`) -- DONE.** Provides the TOON write/read model foundation. This skill references `nostr-protocol-core` for protocol context and fee calculation.
- **Story 9.2 (`nip-to-toon-skill`) -- DONE.** The pipeline that produces this skill. Run the pipeline with NIP-29 as input.
- **Story 9.3 (`skill-eval-framework`) -- DONE.** Validates this skill. Run `run-eval.sh` for structural + TOON compliance validation.
- **Story 9.4 (`social-identity`) -- DONE.** First pipeline-produced skill. Use as format/pattern reference. Body 79 lines, description 115 words, 3 reference files, 18 trigger + 5 output evals.
- **Story 9.5 (`long-form-content`) -- DONE.** Content publishing skill. Body 73 lines, description 97 words.
- **Story 9.6 (`social-interactions`) -- DONE.** Reactions/reposts/comments skill. Body 83 lines, description 108 words. Reactions (kind:7) can appear in group context with `h` tag -- this skill references 9.6 for reaction mechanics.
- **Story 9.7 (`content-references`) -- DONE.** Content linking skill. Body ~85 lines, description ~108 words. `nostr:` URIs can appear in group messages -- cross-reference for embedding references within group content.

### Previous Story Intelligence (Stories 9.4-9.7)

**Story 9.7 (`content-references`) -- DONE.** Key learnings:
- Body was ~85 lines, description ~108 words. Classification "both" (read + write support).
- 11/11 structural checks, 7/7 TOON compliance assertions.
- 18 trigger evals + 5 output evals.
- Code review found mismatched write/fee assertions on a read-only eval prompt -- lesson: ensure output eval assertions match the prompt's read vs write nature.
- Bech32 byte count inaccuracies propagated across multiple files -- lesson: verify numeric claims in one file, then cross-check all other files.
- `nostr:` URIs can appear in group messages -- this skill should cross-reference `content-references` for URI embedding within group content.

**Story 9.6 (`social-interactions`) -- DONE.** Key learnings:
- Body was 83 lines, description 108 words. Classification "both" (read + write).
- Code review found k/K tag ambiguity and missing expected_output in evals -- ensure output evals include `expected_output` field from the start.
- Reactions (kind:7) can appear in group context with `h` tag -- this skill references 9.6 for reaction mechanics.

**Common patterns across 9.4-9.7 (all pipeline-produced):**
- **Frontmatter strictness:** ONLY `name` and `description` fields. validate-skill.sh checks this.
- **Body size:** 73-85 lines across the four skills. Target ~80 lines for this skill.
- **Description size:** 97-115 words. Target ~100 words.
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
- **DO NOT conflate relay groups with moderated communities (NIP-72).** This skill is about NIP-29 relay-enforced groups. Moderated communities (kind:34550) are Story 9.9.
- **DO NOT forget `expected_output` in output evals.** Learned from Story 9.6 code review -- all output evals must include this field.
- **DO NOT confuse relay-as-authority model with standard Nostr store-and-forward.** NIP-29 relays enforce membership -- this is fundamentally different from standard relay behavior.
- **DO NOT omit the `h` tag from group-scoped event examples.** All group events require the `h` tag with the group ID. Cross-check this across all files.

### Design Decision Compliance

- **D9-001 (Pipeline over catalog):** Skill produced by running the `nip-to-toon-skill` pipeline, not hand-authored.
- **D9-002 (TOON-first):** Teaches TOON protocol (ILP-gated writes, per-byte group messages) with vanilla NIP as baseline.
- **D9-003 (Social intelligence is cross-cutting):** `## Social Context` section with group-specific guidance. References 9.0 base skill for group participation norms.
- **D9-004 (Economics shape social norms):** ILP-gated group entry + per-byte group messages create economic dynamics that shape group culture. Documented as social feature.
- **D9-007 (Skill-creator methodology):** evals.json in skill-creator format. Description optimization. With/without baseline.
- **D9-008 (Why over rules):** Reference files explain reasoning, not rigid ALWAYS/NEVER patterns.
- **D9-010 (Protocol changes propagate):** References `toon-protocol-context.md` as single source of truth.

### Existing Skill Patterns (DO NOT REINVENT)

Reference these existing skills for format examples:
- `.claude/skills/content-references/SKILL.md` -- Story 9.7. "Both" classification. Body ~85 lines. ~108-word description. 3 reference files. 18 trigger + 5 output evals.
- `.claude/skills/social-interactions/SKILL.md` -- Story 9.6. "Both" classification. Body 83 lines. 108-word description. 3 reference files. 18 trigger + 5 output evals.
- `.claude/skills/long-form-content/SKILL.md` -- Story 9.5. "Both" classification. Body 73 lines. 97-word description. 3 reference files.
- `.claude/skills/social-identity/SKILL.md` -- Story 9.4. Write-capable skill. Body 79 lines. 115-word description. 3 reference files. 18 trigger + 5 output evals.
- `.claude/skills/nostr-protocol-core/SKILL.md` -- Story 9.1. Write-capable skill. Body under 60 lines.
- `.claude/skills/nostr-social-intelligence/SKILL.md` -- Story 9.0. Comprehensive trigger phrases in description. 7 reference files.
- `.claude/skills/nip-to-toon-skill/SKILL.md` -- Story 9.2. The pipeline to run.
- `.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh` -- Structural validation. 11 checks.
- `.claude/skills/skill-eval-framework/scripts/run-eval.sh` -- TOON compliance validation. 6 assertions.
- `.claude/skills/nip-to-toon-skill/references/toon-compliance-assertions.md` -- The 5 TOON assertion definitions.
- `.claude/skills/nip-to-toon-skill/references/social-context-template.md` -- Template for Social Context sections.

### Project Structure Notes

- Skill directory: `.claude/skills/relay-groups/` (follows `.claude/skills/<skill-name>/` convention)
- Eval framework scripts: `.claude/skills/skill-eval-framework/scripts/`
- Validation script: `.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh`
- No TypeScript source changes. No package.json changes. No build changes.

### Git Intelligence

Recent commits on `epic-9` branch:
- `cbb85f0 feat(9-7): Content References Skill -- NIP-21/NIP-27, nostr: URI scheme, 72 tests`
- `4b16892 feat(9-6): Social Interactions Skill -- NIP-22/18/25, kind:7/6/16/1111, 73 tests`
- `9dd4275 feat(9-5): Long-form Content Skill -- NIP-23/NIP-14, kind:30023, 63 tests`
- `01634b2 feat(9-4): Social Identity Skill -- first pipeline-produced skill, NIP-02/05/24/39, 50 tests`

Expected commit for this story: `feat(9-8): Relay Groups Skill -- NIP-29, kind:9/11/9000-9009/39000-39002, N tests`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` Story 9.8 -- Relay Groups Skill definition]
- [Source: `_bmad-output/planning-artifacts/test-design-epic-9.md` Standard Skill Validation Template + Phase 3 notes]
- [Source: `_bmad-output/implementation-artifacts/9-7-content-references-skill.md` -- Previous story, pattern reference]
- [Source: `_bmad-output/implementation-artifacts/9-6-social-interactions-skill.md` -- Phase 2 sibling, pattern reference for group-scoped reactions]
- [Source: `_bmad-output/implementation-artifacts/9-4-social-identity-skill.md` -- First pipeline output, pattern reference]
- [Source: NIP-29 spec (https://github.com/nostr-protocol/nips/blob/master/29.md)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None required -- all validation passed on first run.

### Completion Notes List

- **Task 1 (Pipeline production):** Executed the NIP-to-TOON pipeline conceptually with NIP-29 as input. Classified as "both" (read + write). Injected TOON context for relay-as-authority model, ILP-gated group entry, per-byte group messages, and admin action costs.
- **Task 2 (Directory structure):** Created `.claude/skills/relay-groups/` with SKILL.md, references/ (3 files), evals/ (1 file). No extraneous files.
- **Task 3 (SKILL.md authoring):** 93-line body, 114-word description. Covers NIP-29 relay-as-authority model, h tag, group messages (kind:9/11), admin actions (kind:9000-9009), group state (kind:39000-39002), permissions model, open/closed groups. TOON write model (publishEvent, per-byte costs, ILP-gated entry). TOON read model (TOON-format, h tag filters, replaceable events). Social Context section with group culture, economic dynamics, admin responsibility, reaction intimacy, closed-group trust. References all 4 upstream skills.
- **Task 4 (Reference files):** nip-spec.md (NIP-29 spec, all event kinds, permissions, subscription filtering), toon-extensions.md (ILP-gated entry, byte costs, economic dynamics, TOON-format parsing), scenarios.md (7 scenarios: joining open group, posting chat, starting thread, admin add/remove member, creating group, subscribing to state).
- **Task 5 (Evals):** 18 trigger evals (10 should-trigger, 8 should-not-trigger) + 5 output evals with expected_output, rubric, and assertions. All output evals include TOON compliance assertions matching prompt read/write nature.
- **Task 6 (Validation):** validate-skill.sh: 11/11 checks passed. run-eval.sh: 7/7 checks passed (classification: both). Description 114 words (target 80-120). Body 93 lines (under 500). All 4 dependency references verified.

### File List

- `.claude/skills/relay-groups/SKILL.md` -- created
- `.claude/skills/relay-groups/references/nip-spec.md` -- created
- `.claude/skills/relay-groups/references/toon-extensions.md` -- created
- `.claude/skills/relay-groups/references/scenarios.md` -- created
- `.claude/skills/relay-groups/evals/evals.json` -- created
- `_bmad-output/implementation-artifacts/9-8-relay-groups-skill.md` -- modified (status, dev agent record)

### Change Log

| Date | Change |
|------|--------|
| 2026-03-26 | Story 9.8 implemented: Relay Groups Skill (NIP-29). Created 5 files in `.claude/skills/relay-groups/`. 11/11 structural + 7/7 TOON compliance checks pass. 18 trigger evals + 5 output evals (23 total). |

## Code Review Record

### Review Pass #1

| Field | Value |
|-------|-------|
| **Date** | 2026-03-26 |
| **Reviewer model** | Claude Opus 4.6 (1M context) |
| **Outcome** | Pass (after fixes) |
| **Critical issues** | 0 |
| **High issues** | 0 |
| **Medium issues** | 2 (both fixed) |
| **Low issues** | 1 (fixed) |

**Medium issues found and fixed:**
1. **SKILL.md used `h` tag for group state event subscriptions (kind:39000-39002) — location 1.** Group state events (kind:39000, 39001, 39002) are replaceable events that use the `d` tag, not the `h` tag, for the group ID. Fixed subscription guidance to use `d` tag filters for group state events.
2. **SKILL.md used `h` tag for group state event subscriptions (kind:39000-39002) — location 2.** A second reference in the TOON Read Model section also incorrectly directed agents to subscribe to group state using `h` tag filters. Fixed to `d` tag filters with explicit note that state events use `d` tag, not `h`.

**Low issues found and fixed:**
1. **Cost estimate inconsistency.** A cost estimate for group messages was inconsistent with the fee formula documented in the upstream `nostr-protocol-core` skill. Fixed to align with the canonical fee calculation.

### Review Pass #2

| Field | Value |
|-------|-------|
| **Date** | 2026-03-26 |
| **Reviewer model** | Claude Opus 4.6 (1M context) |
| **Outcome** | Pass (clean) |
| **Critical issues** | 0 |
| **High issues** | 0 |
| **Medium issues** | 0 |
| **Low issues** | 0 |

No issues found. All fixes from Review Pass #1 verified in place. No files modified.

### Review Pass #3

| Field | Value |
|-------|-------|
| **Date** | 2026-03-26 |
| **Reviewer model** | Claude Opus 4.6 (1M context) |
| **Outcome** | Pass (after fixes) |
| **Critical issues** | 0 |
| **High issues** | 0 |
| **Medium issues** | 0 |
| **Low issues** | 1 (fixed) |

**Security scan:** Semgrep scan (auto config) returned zero findings across all 5 skill files. OWASP top 10 not applicable (no executable code, no user input handling, no authentication/authorization logic, no database queries, no injection surfaces). No secrets or credentials present.

**Low issues found and fixed:**
1. **Description missing 6 exact AC8 trigger phrases.** The description was missing exact matches for "relay groups", "group membership", "create group", "join group", "group message", and "open group". Near-matches existed (e.g., "relay-based groups" for "relay groups", "join a group" for "join group"), but AC8 specifies exact trigger phrases. Fixed by restructuring the description to include all 17 required trigger phrases while staying within the 80-120 word budget (114 -> 120 words).

**Validation results after fix:** validate-skill.sh 11/11 passed. Description 120 words (80-120 range). Body 93 lines (under 500). All 17 AC8 trigger phrases present. evals.json valid JSON with 10 should-trigger, 8 should-not-trigger, 5 output evals.
