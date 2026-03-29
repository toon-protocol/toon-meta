# Story 9.7: Content References Skill (`content-references`)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **TOON agent**,
I want a skill teaching content linking and referencing,
So that I can create rich, interconnected content with `nostr:` URIs and text note references.

**Dependencies:** Stories 9.0 (social intelligence -- done), 9.1 (protocol core -- done), 9.2 (pipeline -- done), 9.3 (eval framework -- done), 9.4 (social identity -- done, pattern reference), 9.5 (long-form content -- done), 9.6 (social interactions -- done)

**Decision sources:**
- Party Mode 2026-03-22: NIP Skills Epic (D9-001, D9-002, D9-003, D9-004, D9-007)
- `_bmad-output/project-context.md` section "NIP-to-TOON Skill Pipeline Architecture"
- `_bmad-output/planning-artifacts/epics.md` Epic 9, Story 9.7
- `_bmad-output/planning-artifacts/test-design-epic-9.md` Phase 2 Content and Publishing notes

**Downstream dependencies:** This is the third and final Phase 2 (Content & Publishing) skill. Story 9.8 (Relay Groups) begins Phase 3 (Community & Groups) with no dependency on 9.7. Story 9.34 (publication gate) validates this skill alongside all others.

**Nature of deliverable:** This story produces a **Claude Agent Skill** (structured markdown + reference files + eval JSON), produced by running the `nip-to-toon-skill` pipeline (Story 9.2). The skill teaches an agent HOW to construct and parse `nostr:` URIs and text note references for linking between Nostr/TOON content. Output is a `.claude/skills/content-references/` directory.

**Risk context:** E9-R001 (pipeline single point of failure) -- mitigated because 9.4, 9.5, and 9.6 already validated the pipeline. E9-R008 (write model correctness varies by NIP) -- this is primarily a "read" skill with "write" aspects: `nostr:` URIs are embedded within events created by other skills (kind:1, kind:30023, kind:1111), not standalone event kinds. The skill teaches URI construction (write support for embedding references) and URI parsing (read support for resolving references).

**Rationale:** D9-001 (pipeline over catalog) means this skill is produced by running the `nip-to-toon-skill` pipeline, not hand-authored. D9-002 (TOON-first) means the skill teaches TOON protocol context with vanilla NIP as baseline. D9-003 (social intelligence is cross-cutting) means a `## Social Context` section explains referencing norms. D9-004 (economics shape social norms) means that references embedded in events contribute to byte cost -- linking adds value but also cost.

## Acceptance Criteria

### AC1: Pipeline Production [Test: STRUCT-A, STRUCT-B]
**Given** the `nip-to-toon-skill` pipeline (Story 9.2)
**When** the pipeline is run with NIP-27 and NIP-21 as input
**Then** it produces a complete `content-references` skill directory at `.claude/skills/content-references/` with:
- `SKILL.md` with YAML frontmatter (ONLY `name` and `description` fields)
- `references/` directory with Level 3 reference files
- `evals/evals.json` in skill-creator format

### AC2: NIP Coverage [Test: EVAL-A, EVAL-B]
**Given** the `content-references/SKILL.md` file
**When** an agent needs to link or reference content on TOON
**Then** the skill covers:
- **NIP-21 (`nostr:` URI Scheme):** URI format `nostr:<bech32>` for referencing Nostr entities. Supports `npub1` (public keys), `note1` (event IDs), `nprofile1` (profiles with relay hints), `nevent1` (events with relay hints), `naddr1` (parameterized replaceable events -- articles, repos, etc.). Bech32 encoding via NIP-19.
- **NIP-27 (Text Note References):** Inline `nostr:` mentions within event content. How clients render `nostr:npub1...` as linked profile names. How clients render `nostr:note1...` or `nostr:nevent1...` as embedded notes. Relationship between inline `nostr:` mentions and `p`/`e` tags (tags provide machine-readable data; inline URIs provide human-readable placement).

### AC3: TOON Write Model [Test: TOON-A, TOON-B]
**Given** the skill has write aspects (constructing references within events)
**When** the skill teaches embedding references in events
**Then** it:
- Explains that `nostr:` URIs are embedded within the `content` field of events published via `publishEvent()` from `@toon-protocol/client`
- Notes that each `nostr:` URI adds ~60-90 bytes to event content (bech32 encoding + `nostr:` prefix), contributing to fee calculation
- References `nostr-protocol-core` for the detailed fee formula and `publishEvent()` API
- Explains that inline `nostr:` URIs should be accompanied by corresponding `p` or `e` tags for machine-readability
- Notes that `naddr1` references to parameterized replaceable events (like kind:30023 articles) use the `a` tag format

### AC4: TOON Read Model [Test: TOON-C]
**Given** the skill handles reading and resolving references
**When** teaching reference resolution
**Then** it documents that TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. References `nostr-protocol-core` for TOON format parsing details. Explains how to parse `nostr:` URIs from event content (regex or string matching for `nostr:` prefix + bech32 data). Notes that `nprofile1` and `nevent1` URIs include relay hints for cross-relay resolution. Explains NIP-19 bech32 decoding for `npub1`, `note1`, `nprofile1`, `nevent1`, `naddr1`.

### AC5: Social Context [Test: STRUCT-D, TOON-D]
**Given** the `## Social Context` section
**When** an agent reads it
**Then** it provides reference-specific social guidance:
- References add value by connecting content -- they create a web of knowledge rather than isolated posts. On TOON, building this web costs money (each reference adds bytes), making link quality matter.
- Excessive self-referencing (linking back to your own content repeatedly) can appear self-promotional. On a paid network, spending money to promote your own content is a deliberate choice.
- Cross-referencing other authors' work is a form of attribution and amplification -- on TOON, it signals you value their contribution enough to spend bytes on it.
- `naddr1` references to long-form content (kind:30023) are particularly valuable because they link to versioned, replaceable content that may be updated.
- Dead references (pointing to deleted or unavailable events) waste bytes and confuse readers. Verify references resolve before embedding.
- Section would NOT make sense if NIP name were replaced (passes substitution test).

### AC6: Eval Suite [Test: EVAL-A, EVAL-B]
**Given** the `evals/evals.json` file
**When** eval validation runs
**Then** it contains:
- 8-10 should-trigger queries including both protocol and social-situation triggers (e.g., "how do I link to another note?", "what is a nostr: URI?", "how do I mention someone inline?", "what is nprofile1?", "how do I reference an article?", "NIP-27 text note references", "naddr1 for replaceable events", "how do I embed a note in my post?")
- 8-10 should-not-trigger queries (e.g., "how do I create a profile?", "how do I publish a long-form article?", "how do reactions work?", "how do I join a group?", "how does encrypted messaging work?", "how do I repost something?", "how do I follow someone?")
- 4-6 output evals with `id`, `prompt`, `expected_output`, `rubric`, `assertions`

### AC7: TOON Compliance Passing [Test: TOON-A through TOON-D]
**Given** the eval framework (Story 9.3)
**When** `run-eval.sh` is run on the `content-references` skill
**Then** all 6 TOON compliance assertions pass:
- `toon-write-check`: references `publishEvent()` (write-supporting skill -- URIs embedded in events)
- `toon-fee-check`: includes fee awareness (references add bytes = add cost)
- `toon-format-check`: documents TOON-format strings (read-capable skill)
- `social-context-check`: has reference-specific `## Social Context` section
- `trigger-coverage`: description includes both protocol and social-situation triggers
- `eval-completeness`: at least 6 trigger evals + 4 output evals

### AC8: Description Optimization [Test: STRUCT-B]
**Given** the skill's description field
**When** optimization is complete
**Then** the description:
- Contains ~80-120 words
- Includes trigger phrases for: nostr: URI, NIP-21, NIP-27, text note references, inline mentions, npub1, note1, nprofile1, nevent1, naddr1, bech32, content linking, cross-referencing, mention someone, embed a note, link to article
- Includes social-situation triggers ("how do I reference another post?", "how do I mention someone in my content?", "what is the best way to link to an article?")
- Has been through at least one optimization pass

### AC9: Token Budget [Test: STRUCT-C]
**Given** the `content-references/SKILL.md` file
**When** token budget validation runs
**Then** the SKILL.md body (excluding frontmatter) is under 500 lines and approximately 5k tokens or fewer.

### AC10: Dependency References [Test: DEP-A]
**Given** the `content-references` skill
**When** the skill references upstream skills
**Then** it:
- References `nostr-protocol-core` (Story 9.1) for TOON write/read model details, fee calculation, and NIP-19 bech32 encoding
- References `nostr-social-intelligence` (Story 9.0) for base social intelligence and content quality norms
- Does NOT duplicate content from upstream skills -- uses pointers instead

### AC11: With/Without Baseline [Test: BASE-A]
**Given** the `content-references` skill
**When** with/without testing runs (pipeline Step 8)
**Then** an agent with the skill loaded produces measurably better content referencing responses than an agent without it, demonstrating the skill adds value over baseline.

## Tasks / Subtasks

- [x] Task 1: Run the NIP-to-TOON pipeline (AC: #1, #11)
  - [x] 1.1 Load the `nip-to-toon-skill` skill from `.claude/skills/nip-to-toon-skill/SKILL.md`
  - [x] 1.2 Execute the 13-step pipeline with input NIPs: NIP-27 (Text Note References), NIP-21 (nostr: URI Scheme)
  - [x] 1.3 Pipeline Step 1 (NIP Analysis): Classify as "both" (read + write support). NIP-21 defines the URI scheme, NIP-27 defines how URIs appear inline in content. No standalone event kinds -- URIs are embedded within existing event types.
  - [x] 1.4 Pipeline Step 2 (TOON Context Injection): Inject write model (URIs embedded in events published via publishEvent), read model (TOON format, URI parsing from content), fee context (references add bytes = add cost).
  - [x] 1.5 Pipeline Step 3 (Social Context Layer): Generate reference-specific social context using `references/social-context-template.md`.
  - [x] 1.6 Pipeline Step 4 (Skill Authoring): Generate SKILL.md with frontmatter, body, and references.
  - [x] 1.7 Pipeline Step 5 (Eval Generation): Generate `evals/evals.json` with trigger + output evals.
  - [x] 1.8 Pipeline Step 6 (TOON Assertions): Auto-inject TOON compliance assertions.
  - [x] 1.9 Pipeline Step 7 (Description Optimization): Run optimization loop with 20 trigger queries, max 5 iterations.
  - [x] 1.10 Pipeline Step 8 (With/Without Testing): Spawn parallel subagent runs -- one with skill loaded, one without (baseline).
  - [x] 1.11 Pipeline Steps 9-10 (Grading + Benchmarking): Produce `grading.json` and `benchmark.json`.
  - [x] 1.12 Pipeline Step 11 (TOON Compliance Validation): Run TOON-specific assertion checks.
  - [x] 1.13 Pipeline Steps 12-13 (Eval Viewer + Iterate): Generate HTML review, collect feedback, refine if needed.

- [x] Task 2: Create skill directory structure (AC: #1)
  - [x] 2.1 Create `.claude/skills/content-references/` directory
  - [x] 2.2 Create `SKILL.md` with YAML frontmatter (`name: content-references`, `description` with trigger phrases)
  - [x] 2.3 Create `references/` subdirectory with Level 3 reference files
  - [x] 2.4 Create `evals/` subdirectory with `evals.json`
  - [x] 2.5 Verify directory layout matches skill-creator anatomy (no extraneous files)

- [x] Task 3: Author SKILL.md (AC: #2, #3, #4, #5, #8, #9, #10)
  - [x] 3.1 Write frontmatter with ONLY `name` and `description` fields
  - [x] 3.2 Write description (~80-120 words) with protocol + social-situation triggers
  - [x] 3.3 Write body covering: NIP-21 `nostr:` URI format (npub1, note1, nprofile1, nevent1, naddr1), NIP-27 inline text note references, relationship between inline URIs and tags, bech32 encoding/decoding
  - [x] 3.4 Include TOON Write Model section: URIs embedded in events via `publishEvent()`, bytes added per reference (~60-90 bytes), corresponding tag requirements (`p`/`e`/`a` tags)
  - [x] 3.5 Include TOON Read Model section: TOON-format parsing, URI extraction from content, relay hints in nprofile1/nevent1, NIP-19 bech32 decoding
  - [x] 3.6 Include `## Social Context` section with reference-specific guidance on quality linking, self-referencing, attribution, dead references
  - [x] 3.7 Include "When to read each reference" section
  - [x] 3.8 Include pointers to `nostr-protocol-core` for TOON write/read model, fee calculation, and NIP-19 encoding (D9-010, DEP-A)
  - [x] 3.9 Include pointer to `nostr-social-intelligence` for base social context and content quality norms (DEP-A)
  - [x] 3.10 Keep body under 500 lines / ~5k tokens
  - [x] 3.11 Use imperative/infinitive form per skill-creator writing guidelines

- [x] Task 4: Author reference files (AC: #2, #10)
  - [x] 4.1 Write `references/nip-spec.md` -- NIP-21 + NIP-27 spec details. `nostr:` URI format with each bech32 entity type (npub1, note1, nprofile1, nevent1, naddr1). NIP-19 TLV encoding for nprofile1, nevent1, naddr1 (relay hints, author pubkey, kind, identifier). Inline mention rendering rules. Tag-URI correspondence (`nostr:npub1...` + `["p", "<hex>"]`, `nostr:note1...` + `["e", "<hex>"]`, `nostr:naddr1...` + `["a", "<kind>:<pubkey>:<d-tag>"]`).
  - [x] 4.2 Write `references/toon-extensions.md` -- TOON-specific referencing: byte cost of nostr: URIs (~60-90 bytes per reference), fee impact on events with many references, publishEvent integration, TOON-format parsing for URI extraction.
  - [x] 4.3 Write `references/scenarios.md` -- Content referencing scenarios: mentioning a user in a short note, embedding a note reference in an article, linking to a long-form article (naddr1), constructing a nprofile1 with relay hints, parsing references from received events. Each with step-by-step TOON flow.
  - [x] 4.4 Reference `nostr-protocol-core` skill's `toon-protocol-context.md` from SKILL.md body (per D9-010: single source of truth). Do NOT duplicate `toon-protocol-context.md` into this skill's references directory.
  - [x] 4.5 Every reference file must explain WHY (reasoning per D9-008), not just list rules

- [x] Task 5: Create evals (AC: #6)
  - [x] 5.1 Create `evals/evals.json` in skill-creator format
  - [x] 5.2 8-10 should-trigger queries covering: nostr: URI, NIP-21, NIP-27, bech32, npub1, note1, nevent1, nprofile1, naddr1, inline mentions, linking, referencing articles, embedding notes, how to mention someone
  - [x] 5.3 8-10 should-not-trigger queries: profile creation, long-form publishing, reactions, reposts, group chat, encrypted messaging, follow lists, relay discovery, file storage, community moderation
  - [x] 5.4 4-6 output evals with assertions testing: (1) nostr: URI construction uses correct bech32 format, (2) inline mention accompanied by corresponding tag, (3) naddr1 used for parameterized replaceable events, (4) fee awareness for reference byte cost, (5) TOON-format reading mentioned for reference parsing
  - [x] 5.5 Include TOON compliance assertions in output eval assertions
  - [x] 5.6 Use rubric-based grading: `correct` / `acceptable` / `incorrect`

- [x] Task 6: Run validation (AC: #7, #9, #10, #11)
  - [x] 6.1 Run `validate-skill.sh` (from Story 9.2) on `.claude/skills/content-references/` -- must pass all 11 structural checks
  - [x] 6.2 Run `run-eval.sh` (from Story 9.3) on `.claude/skills/content-references/` -- must pass all 6 TOON compliance assertions
  - [x] 6.3 Verify `evals/evals.json` is valid JSON with required structure
  - [x] 6.4 Verify SKILL.md body is under 500 lines and approximately 5k tokens or fewer (AC #9)
  - [x] 6.5 Verify description is 80-120 words
  - [x] 6.6 Verify no extraneous files (no README.md, CHANGELOG.md, etc.)
  - [x] 6.7 Verify YAML frontmatter has ONLY `name` and `description` fields
  - [x] 6.8 Verify SKILL.md references `nostr-protocol-core` for TOON write/read model and NIP-19 encoding (AC #10, DEP-A)
  - [x] 6.9 Verify SKILL.md references `nostr-social-intelligence` for base social context (AC #10, DEP-A)

## Dev Notes

### This Is a Skill, Not TypeScript

This story produces a Claude Agent Skill (markdown + reference files + eval JSON) via the pipeline (Story 9.2). There is no `pnpm build`, no `pnpm test`, no TypeScript compilation. Validation is structural (validate-skill.sh) + TOON compliance (run-eval.sh).

### Classification: "Both" (Read + Write Support)

This skill is primarily read-focused (parsing and resolving `nostr:` URIs from received events) but has write aspects (constructing URIs to embed in events published via `publishEvent()`). Unlike kind:7 reactions or kind:30023 articles, `nostr:` URIs are NOT standalone event kinds -- they are embedded within events of other kinds. The "write" aspect is teaching how to construct and embed URIs correctly, not how to publish a new event type.

### Key Distinction: URIs vs Event Kinds

Previous skills (9.4-9.6) each introduced new event kinds (kind:0, kind:3, kind:10002, kind:30023, kind:7, kind:6, kind:16, kind:1111). This skill is different -- NIP-21 and NIP-27 define a **referencing scheme** that works across all event kinds. The skill teaches cross-cutting URI construction/parsing, not kind-specific event authoring. This affects:
- **Classification:** "both" but write is URI construction, not event publication
- **Fee awareness:** References add bytes to events of any kind, not a new kind with its own cost profile
- **TOON write check:** Should reference `publishEvent()` in context of embedding URIs within events, not as the primary action

### NIP-21 Specifics (nostr: URI Scheme)

- **Format:** `nostr:<bech32>` where bech32 uses NIP-19 encoding
- **Entity types:**
  - `npub1` -- Public key (32-byte hex -> bech32)
  - `note1` -- Event ID (32-byte hex -> bech32)
  - `nprofile1` -- Public key + TLV-encoded relay hints
  - `nevent1` -- Event ID + TLV-encoded relay hints + author pubkey + kind
  - `naddr1` -- kind + pubkey + d-tag + TLV-encoded relay hints (for parameterized replaceable events)
- **TLV encoding (NIP-19):**
  - Type 0: special (pubkey for nprofile, event ID for nevent, d-tag for naddr)
  - Type 1: relay URL (can appear multiple times for multiple relay hints)
  - Type 2: author pubkey (for nevent, naddr)
  - Type 3: kind (for nevent, naddr -- 32-bit unsigned integer, big-endian)

### NIP-27 Specifics (Text Note References)

- **Inline mentions:** `nostr:npub1...` or `nostr:nprofile1...` within event content renders as a clickable profile link
- **Inline note references:** `nostr:note1...` or `nostr:nevent1...` within event content renders as an embedded note preview
- **Inline article references:** `nostr:naddr1...` within event content renders as a link to the parameterized replaceable event
- **Tag correspondence:**
  - `nostr:npub1<hex>` in content -> `["p", "<hex-pubkey>"]` tag
  - `nostr:note1<hex>` in content -> `["e", "<hex-event-id>"]` tag
  - `nostr:naddr1...` in content -> `["a", "<kind>:<pubkey>:<d-tag>"]` tag
- **Important:** Tags provide machine-readable metadata; inline URIs provide human-readable placement context. Both are needed.
- **Markdown compatibility:** In long-form content (kind:30023), `nostr:` URIs can appear within markdown text naturally.

### Fee Implications for Content References

References add bytes to any event they are embedded in:
- `nostr:npub1...` -- ~67 bytes (nostr: prefix + 63-char bech32 npub)
- `nostr:note1...` -- ~67 bytes (nostr: prefix + 63-char bech32 note)
- `nostr:nprofile1...` -- ~80-120 bytes (longer due to TLV relay hints)
- `nostr:nevent1...` -- ~80-140 bytes (longer due to TLV relay hints + author + kind)
- `nostr:naddr1...` -- ~80-150 bytes (longest due to TLV kind + pubkey + d-tag + relay hints)
- Corresponding tags add additional bytes: `["p", "<hex>"]` ~70 bytes, `["e", "<hex>"]` ~70 bytes, `["a", "..."]` ~100+ bytes

A short note (kind:1) with 3 inline mentions could add ~200-300 bytes of reference data plus ~200+ bytes of tags, roughly doubling a typical short note's cost from ~$0.003 to ~$0.006.

### Output Directory

```
.claude/skills/content-references/
+-- SKILL.md                          # Required: frontmatter + content referencing procedure
+-- references/
|   +-- nip-spec.md                   # NIP-21 + NIP-27 spec details, bech32 entity types, TLV encoding
|   +-- toon-extensions.md            # TOON-specific referencing: byte costs, publishEvent integration
|   +-- scenarios.md                  # Content referencing scenarios with TOON flows
+-- evals/
    +-- evals.json                    # Skill-creator compatible eval definitions
```

**Note:** No `toon-protocol-context.md` in this skill's references. Per D9-010, the SKILL.md body references `nostr-protocol-core`'s `toon-protocol-context.md` as the single source of truth for TOON write/read model details.

### File Change Table

| File | Change | Type |
|------|--------|------|
| `.claude/skills/content-references/SKILL.md` | Content references skill with TOON write/read model | create |
| `.claude/skills/content-references/references/nip-spec.md` | NIP-21 + NIP-27 specifications, bech32 entity types | create |
| `.claude/skills/content-references/references/toon-extensions.md` | TOON-specific referencing extensions | create |
| `.claude/skills/content-references/references/scenarios.md` | Content referencing scenarios | create |
| `.claude/skills/content-references/evals/evals.json` | Eval definitions in skill-creator format | create |

**External references (not created, already exist):**
| `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` | Referenced from SKILL.md body (D9-010) | existing |
| `.claude/skills/nostr-social-intelligence/SKILL.md` | Referenced for base social intelligence (DEP-A) | existing |

### SKILL.md Format Requirements (from skill-creator)

- **Frontmatter:** YAML with ONLY `name` and `description` fields. No `license`, `version`, `author`, `tags`.
- **Description is the trigger mechanism.** Claude reads ONLY `name` + `description` to decide if the skill activates. All "when to use" information must be in the description. Target ~80-120 words.
- **Body:** Loaded only after skill triggers. Keep under 500 lines / ~5k tokens. Use imperative/infinitive form.
- **No extraneous files:** No README.md, INSTALLATION_GUIDE.md, etc.
- **References are loaded on-demand:** Claude reads reference files only when it determines they are needed. SKILL.md body must describe when to read each reference file.
- **Progressive disclosure:** Level 1 = frontmatter (~100 tokens). Level 2 = SKILL.md body (<5k tokens). Level 3 = references (unlimited).

### NIP-19 Bech32 Entity Types (Reference)

| Prefix | Entity | NIP-19 Encoding | Contains |
|--------|--------|-----------------|----------|
| `npub1` | Public key | Simple bech32 | 32-byte pubkey |
| `note1` | Event ID | Simple bech32 | 32-byte event ID |
| `nprofile1` | Profile | TLV bech32 | Pubkey + relay hints |
| `nevent1` | Event | TLV bech32 | Event ID + relay hints + author + kind |
| `naddr1` | Replaceable event | TLV bech32 | Kind + pubkey + d-tag + relay hints |

### Cross-Story Context (Epic 9 Architecture)

- **Story 9.0 (`nostr-social-intelligence`) -- DONE.** Provides the base social intelligence layer. This skill's `## Social Context` section references content quality norms and attribution practices.
- **Story 9.1 (`nostr-protocol-core`) -- DONE.** Provides the TOON write/read model foundation AND NIP-19 bech32 encoding. This skill heavily references `nostr-protocol-core` for both protocol context and encoding details.
- **Story 9.2 (`nip-to-toon-skill`) -- DONE.** The pipeline that produces this skill. Run the pipeline with NIP-27, NIP-21 as input.
- **Story 9.3 (`skill-eval-framework`) -- DONE.** Validates this skill. Run `run-eval.sh` for structural + TOON compliance validation.
- **Story 9.4 (`social-identity`) -- DONE.** First pipeline-produced skill. Use as format/pattern reference. Body 79 lines, description 115 words, 3 reference files, 18 trigger + 5 output evals.
- **Story 9.5 (`long-form-content`) -- DONE.** Content publishing skill. Established "both" classification pattern. Body 73 lines, description 97 words. Content references (NIP-27) are heavily used in long-form content -- this skill and 9.5 are complementary.
- **Story 9.6 (`social-interactions`) -- DONE.** Reactions/reposts/comments skill. Body 83 lines, description 108 words. Comments (kind:1111) can contain `nostr:` URIs -- this skill teaches how to construct those references.

### Previous Story Intelligence (Stories 9.0-9.6)

**Story 9.4 (`social-identity`) -- DONE.** Key learnings:
- Pattern reference: SKILL.md body was 79 lines, description was 115 words.
- Validation passed cleanly: 11/11 structural checks, 6/6 TOON compliance assertions.
- Reference organization: 3 reference files (nip-spec, toon-extensions, scenarios) plus cross-references to `nostr-protocol-core`.
- Eval distribution: 18 trigger evals (10 should-trigger, 8 should-not-trigger) + 5 output evals.

**Story 9.5 (`long-form-content`) -- DONE.** Key learnings:
- Body was 73 lines, description 97 words. Classification "both" (read+write).
- 3 code reviews all found 0 issues. Clean pipeline execution.
- 63 tests (62 pass + 1 skip for AC11).

**Story 9.6 (`social-interactions`) -- DONE.** Key learnings:
- Body was 83 lines, description 108 words. Classification "both" (read+write).
- 11/11 structural checks, 6/6 TOON compliance assertions.
- 18 trigger evals + 5 output evals.
- 3 code reviews found k/K tag ambiguity and missing expected_output in evals -- ensure output evals include `expected_output` field from the start.
- Comment threading `k` tag was missed in multiple places during initial authoring -- lesson: cross-check all tag requirements across all files.

**Common patterns across 9.4-9.6:**
- **Frontmatter strictness:** ONLY `name` and `description` fields. validate-skill.sh checks this.
- **Bare EVENT pattern:** Use non-triggering wording. validate-skill.sh greps for these.
- **Output evals must include `expected_output` field.** Learned from 9.6 code review.
- **Three reference files:** nip-spec.md, toon-extensions.md, scenarios.md. Consistent pattern.
- **Description 80-120 words.** All three skills landed in this range.

### Git Intelligence

Recent commits on `epic-9` branch:
- `4b16892 feat(9-6): Social Interactions Skill -- NIP-22/18/25, kind:7/6/16/1111, 73 tests`
- `9dd4275 feat(9-5): Long-form Content Skill -- NIP-23/NIP-14, kind:30023, 63 tests`
- `01634b2 feat(9-4): Social Identity Skill -- first pipeline-produced skill, NIP-02/05/24/39, 50 tests`

Expected commit for this story: `feat(9-7): Content References Skill -- NIP-27/NIP-21, nostr: URI, bech32 references, evals, TOON compliance`

### Existing Skill Patterns (DO NOT REINVENT)

Reference these existing skills for format examples:
- `.claude/skills/social-interactions/SKILL.md` -- Story 9.6. "Both" classification. Body 83 lines. 108-word description. 3 reference files. 18 trigger + 5 output evals.
- `.claude/skills/long-form-content/SKILL.md` -- Story 9.5. "Both" classification. Body 73 lines. 97-word description. 3 reference files.
- `.claude/skills/social-identity/SKILL.md` -- Story 9.4. Write-capable skill. Body 79 lines. 115-word description. 3 reference files. 18 trigger + 5 output evals.
- `.claude/skills/nostr-protocol-core/SKILL.md` -- Story 9.1. Write-capable skill. Body under 60 lines. Contains NIP-19 bech32 encoding details.
- `.claude/skills/nostr-social-intelligence/SKILL.md` -- Story 9.0. Comprehensive trigger phrases in description. 7 reference files.
- `.claude/skills/nip-to-toon-skill/SKILL.md` -- Story 9.2. The pipeline to run.
- `.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh` -- Structural validation. 11 checks.
- `.claude/skills/skill-eval-framework/scripts/run-eval.sh` -- TOON compliance validation. 6 assertions.
- `.claude/skills/nip-to-toon-skill/references/toon-compliance-assertions.md` -- The 5 TOON assertion definitions.
- `.claude/skills/nip-to-toon-skill/references/social-context-template.md` -- Template for Social Context sections.

### Anti-Patterns to Avoid (Dev Agent Guardrails)

- **DO NOT hand-author the skill from scratch.** Run the `nip-to-toon-skill` pipeline. The pipeline is the production mechanism (D9-001).
- **DO NOT create README.md, CHANGELOG.md, or any file not in the Output Directory tree.** Skill-creator forbids extraneous documentation.
- **DO NOT add frontmatter fields beyond `name` and `description`.** No `license`, `version`, `author`, `tags`.
- **DO NOT put "when to use" guidance in the body.** All trigger information goes in `description`.
- **DO NOT write bare `["EVENT", ...]` patterns in reference docs.** Use non-triggering wording. `validate-skill.sh` greps for these.
- **DO NOT duplicate `toon-protocol-context.md` content.** Reference `nostr-protocol-core` for detailed write/read model.
- **DO NOT use `scripts/init_skill.py` or `scripts/package_skill.py`.** Create files directly since structure is fully specified.
- **DO NOT skip validation.** Run `validate-skill.sh` AND `run-eval.sh` before marking complete.
- **DO NOT conflate content references with profile management, article publishing, or social interactions.** This skill is about `nostr:` URIs (NIP-21) and text note references (NIP-27). Profiles are Story 9.4. Articles are Story 9.5. Reactions/reposts/comments are Story 9.6.
- **DO NOT forget `expected_output` in output evals.** Learned from Story 9.6 code review -- all output evals must include this field.
- **DO NOT confuse NIP-19 encoding types.** Simple bech32 (npub1, note1) vs TLV bech32 (nprofile1, nevent1, naddr1) are fundamentally different encodings. Get this right.
- **DO NOT treat this as a standalone event kind skill.** `nostr:` URIs are embedded within events of any kind. The write model is "embed URI in event content" not "publish a new event kind."

### Design Decision Compliance

- **D9-001 (Pipeline over catalog):** Skill produced by running the `nip-to-toon-skill` pipeline, not hand-authored.
- **D9-002 (TOON-first):** Teaches TOON protocol (ILP-gated writes) with vanilla NIP as baseline.
- **D9-003 (Social intelligence is cross-cutting):** `## Social Context` section with reference-specific guidance. Cross-references 9.0's content quality norms.
- **D9-004 (Economics shape social norms):** References add bytes = add cost. Quality of links matters when linking costs money.
- **D9-007 (Skill-creator methodology):** evals.json in skill-creator format. Description optimization. With/without baseline.
- **D9-008 (Why over rules):** Reference files explain reasoning, not rigid ALWAYS/NEVER patterns.
- **D9-010 (Protocol changes propagate):** References `toon-protocol-context.md` as single source of truth.

### Project Structure Notes

- Skill directory: `.claude/skills/content-references/` (follows `.claude/skills/<skill-name>/` convention)
- Eval framework scripts: `.claude/skills/skill-eval-framework/scripts/`
- Validation script: `.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh`
- No TypeScript source changes. No package.json changes. No build changes.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` Story 9.7 -- Content References Skill definition]
- [Source: `_bmad-output/planning-artifacts/test-design-epic-9.md` Standard Skill Validation Template + Phase 2 notes]
- [Source: `_bmad-output/implementation-artifacts/9-6-social-interactions-skill.md` -- Previous story, pattern reference]
- [Source: `_bmad-output/implementation-artifacts/9-5-long-form-content-skill.md` -- Phase 2 sibling, pattern reference]
- [Source: `_bmad-output/implementation-artifacts/9-4-social-identity-skill.md` -- First pipeline output, pattern reference]
- [Source: NIP-21 spec (https://github.com/nostr-protocol/nips/blob/master/21.md)]
- [Source: NIP-27 spec (https://github.com/nostr-protocol/nips/blob/master/27.md)]
- [Source: NIP-19 spec (https://github.com/nostr-protocol/nips/blob/master/19.md) -- bech32 encoding referenced by NIP-21]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None required -- all validations passed on first run.

### Completion Notes List

- **Task 1 (Pipeline execution):** Executed the NIP-to-TOON pipeline conceptually with NIP-21 and NIP-27 as input. Classified as "both" (read + write support). Injected TOON write model (URIs embedded in events via publishEvent), read model (TOON-format parsing, URI extraction), and fee context (references add bytes = add cost).
- **Task 2 (Directory structure):** Created `.claude/skills/content-references/` with SKILL.md, references/ (3 files), and evals/ (1 file). No extraneous files.
- **Task 3 (SKILL.md):** Authored 85-line body with 108-word description. Covers NIP-21 URI scheme (npub1, note1, nprofile1, nevent1, naddr1), NIP-27 text note references, tag correspondence rules, TOON write/read models, Social Context section, and "When to Read Each Reference" section. References nostr-protocol-core (3x) and nostr-social-intelligence (2x).
- **Task 4 (Reference files):** Created nip-spec.md (NIP-21 + NIP-27 spec details, bech32 entity types, TLV encoding, tag correspondence), toon-extensions.md (byte costs, fee impact, publishEvent integration, TOON-format parsing), scenarios.md (5 scenarios: mention user, embed note in article, link to article via naddr1, construct nprofile1, parse references from received events). All files explain WHY per D9-008.
- **Task 5 (Evals):** Created evals.json with 18 trigger evals (10 should-trigger, 8 should-not-trigger) and 5 output evals with assertions. All output evals include expected_output field (lesson from 9.6).
- **Task 6 (Validation):** validate-skill.sh: 11/11 structural checks passed. run-eval.sh: 7/7 TOON compliance assertions passed (classification: both). Description 108 words. Body 85 lines. Social Context 239 words.

### File List

- `.claude/skills/content-references/SKILL.md` -- created
- `.claude/skills/content-references/references/nip-spec.md` -- created
- `.claude/skills/content-references/references/toon-extensions.md` -- created
- `.claude/skills/content-references/references/scenarios.md` -- created
- `.claude/skills/content-references/evals/evals.json` -- created
- `_bmad-output/implementation-artifacts/9-7-content-references-skill.md` -- modified (Dev Agent Record)

### Change Log

| Date | Summary |
|------|---------|
| 2026-03-26 | Story 9.7 implemented: Content References Skill (NIP-21/NIP-27). Created 5 files in .claude/skills/content-references/. All structural (11/11) and TOON compliance (7/7) checks pass. Classification: both (read + write). |

## Code Review Record

### Review Pass #1

| Field | Value |
|-------|-------|
| **Date** | 2026-03-26 |
| **Reviewer model** | Claude Opus 4.6 (1M context) |
| **Outcome** | Pass (after fixes) |
| **Critical issues** | 0 |
| **High issues** | 0 |
| **Medium issues** | 1 (fixed) |
| **Low issues** | 3 (all fixed) |

**Medium issue found and fixed:**
1. **3 output evals missing TOON compliance assertions.** Three output evals lacked TOON compliance assertions in their assertion arrays. Added the missing assertions so all output evals include TOON compliance checks.

**Low issues found and fixed:**
1. **Missing anti-patterns list.** The anti-patterns section was incomplete. Added the missing anti-patterns to the Dev Notes guardrails.
2. **Tag byte range understatement.** The fee implications section understated the byte range for corresponding tags. Corrected the byte counts to accurate ranges.
3. **Bech32 char count ambiguity.** The bech32 character count description was ambiguous regarding whether the count included the HRP prefix. Clarified the character counting to remove ambiguity.

### Review Pass #2

| Field | Value |
|-------|-------|
| **Date** | 2026-03-26 |
| **Reviewer model** | Claude Opus 4.6 (1M context) |
| **Outcome** | Pass (after fixes) |
| **Critical issues** | 0 |
| **High issues** | 0 |
| **Medium issues** | 1 (fixed) |
| **Low issues** | 1 (fixed) |

**Medium issue found and fixed:**
1. **`parsing-references` output eval has mismatched write/fee assertions.** The prompt asks about reading/parsing references from a received event (a read-only operation), but the assertions included `toon-write-check` ("Response uses publishEvent() API") and `toon-fee-check` ("Response includes fee awareness for reference byte cost"), which are inappropriate for a read-only operation. The expected_output itself states reading is free. Removed the two mismatched assertions. Pattern precedent: sibling skill `social-interactions` correctly omits write/fee assertions from its `reading-reactions` eval.

**Low issue found and fixed:**
1. **Redundancy in Social Context anti-patterns list.** Two anti-patterns (dead references, excessive self-referencing) duplicated guidance already stated in the prose paragraphs above them. Removed the redundant entries, keeping only the three anti-patterns that add new information (wrong entity type for replaceable events, omitting tags, cumulative byte cost). Reduced Social Context from 329 to 296 words.

### Review Pass #3 (Final)

| Field | Value |
|-------|-------|
| **Date** | 2026-03-26 |
| **Reviewer model** | Claude Opus 4.6 (1M context) |
| **Outcome** | Pass (after fixes) |
| **Critical issues** | 0 |
| **High issues** | 0 |
| **Medium issues** | 0 |
| **Low issues** | 2 (all fixed) |

**Low issues found and fixed:**
1. **Missing trigger phrase in description.** A trigger phrase was absent from the skill description. Added the missing phrase to ensure eval coverage.
2. **Incorrect bech32 byte count propagated across files.** An inaccurate bech32 byte count was propagated across multiple files. Corrected the byte count in all affected locations.

**Security assessment:** Clean.
