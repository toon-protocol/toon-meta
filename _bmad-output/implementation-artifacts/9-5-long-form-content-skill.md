# Story 9.5: Long-form Content Skill (`long-form-content`)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **TOON agent**,
I want a skill teaching long-form content publishing,
So that I can create and manage articles on TOON relays.

**Dependencies:** Stories 9.0 (social intelligence -- done), 9.1 (protocol core -- done), 9.2 (pipeline -- done), 9.3 (eval framework -- done), 9.4 (social identity -- done, pattern reference)

**Decision sources:**
- Party Mode 2026-03-22: NIP Skills Epic (D9-001, D9-002, D9-003, D9-004, D9-007)
- `_bmad-output/project-context.md` section "NIP-to-TOON Skill Pipeline Architecture"
- `_bmad-output/planning-artifacts/epics.md` Epic 9, Story 9.5
- `_bmad-output/planning-artifacts/test-design-epic-9.md` Phase 2 Content and Publishing notes

**Downstream dependencies:** This is the first Phase 2 (Content & Publishing) skill. Stories 9.6 (Social Interactions) and 9.7 (Content References) are sibling Phase 2 skills but have no dependency on 9.5. Story 9.34 (publication gate) validates this skill alongside all others.

**Nature of deliverable:** This story produces a **Claude Agent Skill** (structured markdown + reference files + eval JSON), produced by running the `nip-to-toon-skill` pipeline (Story 9.2). The skill teaches an agent HOW to publish long-form content on Nostr/TOON: articles (kind:30023), subject tags (NIP-14), summaries, and publication timestamps. Output is a `.claude/skills/long-form-content/` directory.

**Risk context:** E9-R001 (pipeline single point of failure) -- mitigated because 9.4 already validated the pipeline. E9-R008 (write model correctness varies by NIP) -- this is a "both" skill (read + write): kind:30023 is a parameterized replaceable event with higher byte cost, making fee awareness especially important. Per test-design-epic-9.md Phase 2 notes: "Cross-reference check: 9.6 should reference 9.0's interaction decisions." Per meta-test 9.2-META-003: "Run pipeline on NIP-23 (Long-form). Verify: both write and read models present, social context addresses cost of long-form content."

**Rationale:** D9-001 (pipeline over catalog) means this skill is produced by running the `nip-to-toon-skill` pipeline, not hand-authored. D9-002 (TOON-first) means the skill teaches TOON protocol (ILP-gated writes) with vanilla NIP as baseline. D9-003 (social intelligence is cross-cutting) means a `## Social Context` section explains content publishing norms. D9-004 (economics shape social norms) means long-form content costing more (more bytes) is a social feature that signals investment and seriousness.

## Acceptance Criteria

### AC1: Pipeline Production [Test: STRUCT-A, STRUCT-B]
**Given** the `nip-to-toon-skill` pipeline (Story 9.2)
**When** the pipeline is run with NIP-23 and NIP-14 as input
**Then** it produces a complete `long-form-content` skill directory at `.claude/skills/long-form-content/` with:
- `SKILL.md` with YAML frontmatter (ONLY `name` and `description` fields)
- `references/` directory with Level 3 reference files
- `evals/evals.json` in skill-creator format

### AC2: NIP Coverage [Test: EVAL-A, EVAL-B]
**Given** the `long-form-content/SKILL.md` file
**When** an agent needs to publish long-form content on TOON
**Then** the skill covers:
- **kind:30023 (Long-form content):** Parameterized replaceable event. `d` tag as article identifier. `content` field in markdown format. `title`, `summary`, `image`, `published_at` tags. Replaceable semantics (latest version by `d` tag wins).
- **NIP-14 Subject tags:** `subject` tag for threading/categorization. Used in both kind:1 (short notes) and kind:30023 (articles). How subject tags help organize content.
- **Article lifecycle:** Creating a new article, updating an existing article (same `d` tag), drafts vs published state (using `published_at` tag presence).
- **Markdown content:** Long-form content uses markdown in the `content` field. Headers, lists, links, code blocks, images.

### AC3: TOON Write Model [Test: TOON-A, TOON-B]
**Given** the skill is write-capable (article publishing costs money)
**When** the skill teaches event publishing
**Then** it:
- Uses `publishEvent()` from `@toon-protocol/client`, NOT bare WebSocket EVENT patterns
- Includes fee awareness: long-form content has higher cost because articles are larger (thousands of bytes vs hundreds for short notes)
- References `nostr-protocol-core` for detailed fee calculation
- Notes that kind:30023 is parameterized replaceable -- updating an article with the same `d` tag replaces the previous version, but each update costs money proportional to the full article size

### AC4: TOON Read Model [Test: TOON-C]
**Given** the skill handles reading long-form content
**When** teaching event retrieval
**Then** it documents that TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. References `nostr-protocol-core` for TOON format parsing details. Notes filtering by `kinds: [30023]` and optionally by `#d` tag to fetch specific articles.

### AC5: Social Context [Test: STRUCT-D, TOON-D]
**Given** the `## Social Context` section
**When** an agent reads it
**Then** it provides content-publishing-specific social guidance:
- Long-form content signals investment and seriousness -- the higher byte cost means you are committing real economic weight to your words.
- Structure articles with meaningful headers, clear summaries, and descriptive titles -- readers evaluate quality before paying attention.
- On TOON, publishing an article costs more than a short note -- this naturally incentivizes quality over quantity.
- Updating articles costs the full article size again -- revise thoughtfully, batch edits rather than making many small updates.
- Subject tags are curation signals -- choose them intentionally to help readers discover your content.
- A well-crafted summary tag is your article's first impression -- it determines whether readers engage with the full content.
- Section would NOT make sense if NIP name were replaced (passes substitution test).

### AC6: Eval Suite [Test: EVAL-A, EVAL-B]
**Given** the `evals/evals.json` file
**When** eval validation runs
**Then** it contains:
- 8-10 should-trigger queries including both protocol and social-situation triggers (e.g., "how do I publish a long-form article on TOON?", "what is kind:30023?", "how do I update an existing article?", "should I publish this as a long-form article or a short note?", "how do subject tags work?", "what makes a good article summary?")
- 8-10 should-not-trigger queries (e.g., "how do I create a profile?", "how do I react to a post?", "how do I follow someone?", "how does encrypted messaging work?", "how do I join a group chat?")
- 4-6 output evals with `id`, `prompt`, `expected_output`, `rubric`, `assertions`

### AC7: TOON Compliance Passing [Test: TOON-A through TOON-D]
**Given** the eval framework (Story 9.3)
**When** `run-eval.sh` is run on the `long-form-content` skill
**Then** all 6 TOON compliance assertions pass:
- `toon-write-check`: uses `publishEvent()` (write-capable skill)
- `toon-fee-check`: includes fee awareness (write-capable skill)
- `toon-format-check`: documents TOON-format strings (read-capable skill)
- `social-context-check`: has content-publishing-specific `## Social Context` section
- `trigger-coverage`: description includes both protocol and social-situation triggers
- `eval-completeness`: at least 6 trigger evals + 4 output evals

### AC8: Description Optimization [Test: STRUCT-B]
**Given** the skill's description field
**When** optimization is complete
**Then** the description:
- Contains ~80-120 words
- Includes trigger phrases for long-form content, articles, kind:30023, publishing, subject tags, summaries, NIP-23, NIP-14
- Includes social-situation triggers ("should I publish this as an article?", "how long should my article be?", "is this worth a long-form post?")
- Has been through at least one optimization pass

### AC9: Token Budget [Test: STRUCT-C]
**Given** the `long-form-content/SKILL.md` file
**When** token budget validation runs
**Then** the SKILL.md body (excluding frontmatter) is under 500 lines and approximately 5k tokens or fewer.

### AC10: Dependency References [Test: DEP-A]
**Given** the `long-form-content` skill
**When** the skill references upstream skills
**Then** it:
- References `nostr-protocol-core` (Story 9.1) for TOON write/read model details and fee calculation
- References `nostr-social-intelligence` (Story 9.0) for base social intelligence and trust signals
- Does NOT duplicate content from upstream skills -- uses pointers instead

### AC11: With/Without Baseline [Test: BASE-A]
**Given** the `long-form-content` skill
**When** with/without testing runs (pipeline Step 8)
**Then** an agent with the skill loaded produces measurably better long-form content responses than an agent without it, demonstrating the skill adds value over baseline.

## Tasks / Subtasks

- [x] Task 1: Run the NIP-to-TOON pipeline (AC: #1, #11)
  - [x] 1.1 Load the `nip-to-toon-skill` skill from `.claude/skills/nip-to-toon-skill/SKILL.md`
  - [x] 1.2 Execute the 13-step pipeline with input NIPs: NIP-23 (Long-form Content), NIP-14 (Subject Tags)
  - [x] 1.3 Pipeline Step 1 (NIP Analysis): Classify as "both" (read + write). Identify kind:30023 (long-form articles), `d` tag (article identifier), `subject` tag (NIP-14), `summary` tag, `published_at` tag.
  - [x] 1.4 Pipeline Step 2 (TOON Context Injection): Inject write model (publishEvent for kind:30023), read model (TOON format), fee context (long-form = higher cost).
  - [x] 1.5 Pipeline Step 3 (Social Context Layer): Generate content-publishing-specific social context using `references/social-context-template.md`.
  - [x] 1.6 Pipeline Step 4 (Skill Authoring): Generate SKILL.md with frontmatter, body, and references.
  - [x] 1.7 Pipeline Step 5 (Eval Generation): Generate `evals/evals.json` with trigger + output evals.
  - [x] 1.8 Pipeline Step 6 (TOON Assertions): Auto-inject TOON compliance assertions.
  - [x] 1.9 Pipeline Step 7 (Description Optimization): Run optimization loop with 20 trigger queries, max 5 iterations.
  - [x] 1.10 Pipeline Step 8 (With/Without Testing): Spawn parallel subagent runs -- one with skill loaded, one without (baseline).
  - [x] 1.11 Pipeline Steps 9-10 (Grading + Benchmarking): Produce `grading.json` and `benchmark.json`.
  - [x] 1.12 Pipeline Step 11 (TOON Compliance Validation): Run TOON-specific assertion checks.
  - [x] 1.13 Pipeline Steps 12-13 (Eval Viewer + Iterate): Generate HTML review, collect feedback, refine if needed.

- [x] Task 2: Create skill directory structure (AC: #1)
  - [x] 2.1 Create `.claude/skills/long-form-content/` directory
  - [x] 2.2 Create `SKILL.md` with YAML frontmatter (`name: long-form-content`, `description` with trigger phrases)
  - [x] 2.3 Create `references/` subdirectory with Level 3 reference files
  - [x] 2.4 Create `evals/` subdirectory with `evals.json`
  - [x] 2.5 Verify directory layout matches skill-creator anatomy (no extraneous files)

- [x] Task 3: Author SKILL.md (AC: #2, #3, #4, #5, #8, #9, #10)
  - [x] 3.1 Write frontmatter with ONLY `name` and `description` fields
  - [x] 3.2 Write description (~80-120 words) with protocol + social-situation triggers
  - [x] 3.3 Write body covering: kind:30023 long-form articles, `d` tag identifier, markdown content format, `title`/`summary`/`image`/`published_at` tags, NIP-14 subject tags, article lifecycle (create, update, drafts)
  - [x] 3.4 Include TOON Write Model section referencing `publishEvent()` and fee awareness (long-form = higher cost)
  - [x] 3.5 Include TOON Read Model section referencing TOON-format strings
  - [x] 3.6 Include `## Social Context` section with content-publishing-specific guidance
  - [x] 3.7 Include "When to read each reference" section
  - [x] 3.8 Include pointers to `nostr-protocol-core` for TOON write/read model and `nostr-social-intelligence` for base social context (D9-010, DEP-A)
  - [x] 3.9 Keep body under 500 lines / ~5k tokens
  - [x] 3.10 Use imperative/infinitive form per skill-creator writing guidelines

- [x] Task 4: Author reference files (AC: #2, #10)
  - [x] 4.1 Write `references/nip-spec.md` -- NIP-23 + NIP-14 spec details. kind:30023 event structure, `d` tag semantics, parameterized replaceable event behavior, content format (markdown), required and optional tags (`title`, `summary`, `image`, `published_at`, `t` hashtags), NIP-14 `subject` tag format and usage.
  - [x] 4.2 Write `references/toon-extensions.md` -- TOON-specific long-form extensions: ILP-gated article publishing, fee considerations for large content (articles are typically 2000-20000 bytes = $0.02-$0.20 at default pricing), economics of article updates (full re-publish cost), comparison with short note costs.
  - [x] 4.3 Write `references/scenarios.md` -- Long-form content scenarios: publishing a first article, updating an existing article, drafting before publishing, adding subject tags for discoverability, choosing between long-form and short notes. Each with step-by-step TOON flow.
  - [x] 4.4 Reference `nostr-protocol-core` skill's `toon-protocol-context.md` from SKILL.md body (per D9-010: single source of truth). Do NOT duplicate `toon-protocol-context.md` into this skill's references directory.
  - [x] 4.5 Every reference file must explain WHY (reasoning per D9-008), not just list rules

- [x] Task 5: Create evals (AC: #6)
  - [x] 5.1 Create `evals/evals.json` in skill-creator format
  - [x] 5.2 8-10 should-trigger queries covering: article publishing, article updates, kind:30023 structure, subject tags, summaries, published_at, drafts, long-form vs short notes decision, social-situation questions about content quality
  - [x] 5.3 8-10 should-not-trigger queries: profile management, reactions, group chat, encryption, DMs, community moderation, follow lists, file storage
  - [x] 5.4 4-6 output evals with assertions testing: (1) article creation uses publishEvent, (2) fee awareness for large content, (3) parameterized replaceable event semantics correct, (4) social context guidance is content-specific, (5) TOON-format reading is mentioned for article retrieval
  - [x] 5.5 Include TOON compliance assertions in output eval assertions
  - [x] 5.6 Use rubric-based grading: `correct` / `acceptable` / `incorrect`

- [x] Task 6: Run validation (AC: #7, #9, #10, #11)
  - [x] 6.1 Run `validate-skill.sh` (from Story 9.2) on `.claude/skills/long-form-content/` -- must pass all 11 structural checks
  - [x] 6.2 Run `run-eval.sh` (from Story 9.3) on `.claude/skills/long-form-content/` -- must pass all 6 TOON compliance assertions
  - [x] 6.3 Verify `evals/evals.json` is valid JSON with required structure
  - [x] 6.4 Verify SKILL.md body is under 500 lines and approximately 5k tokens or fewer (AC #9)
  - [x] 6.5 Verify description is 80-120 words
  - [x] 6.6 Verify no extraneous files (no README.md, CHANGELOG.md, etc.)
  - [x] 6.7 Verify YAML frontmatter has ONLY `name` and `description` fields
  - [x] 6.8 Verify SKILL.md references `nostr-protocol-core` for TOON write/read model (AC #10, DEP-A)
  - [x] 6.9 Verify SKILL.md references `nostr-social-intelligence` for base social context (AC #10, DEP-A)

## Dev Notes

### This Is a Skill, Not TypeScript

This story produces a Claude Agent Skill (markdown + reference files + eval JSON) via the pipeline (Story 9.2). There is no `pnpm build`, no `pnpm test`, no TypeScript compilation. Validation is structural (validate-skill.sh) + TOON compliance (run-eval.sh).

### kind:30023 Is a Parameterized Replaceable Event

Unlike kind:0 (simple replaceable), kind:30023 uses a `d` tag to identify distinct articles. A pubkey can have many kind:30023 events, each identified by a different `d` tag value. Updating an article means publishing a new kind:30023 with the same `d` tag -- the relay replaces the older version. This is critical for the fee model: each update costs the full article size, not just the diff.

### NIP-23 Specifics

- **Event kind:** 30023 (parameterized replaceable, address range 30000-39999)
- **Content format:** Markdown in the `content` field
- **Required tags:** `d` (article identifier, unique per author), `title` (article title)
- **Optional tags:** `summary` (article summary/excerpt), `image` (cover image URL), `published_at` (unix timestamp), `t` (hashtags), `subject` (NIP-14)
- **Draft semantics:** Articles without a `published_at` tag are considered drafts. Clients may hide unpublished drafts from public feeds.

### NIP-14 Specifics

- **Tag format:** `["subject", "<subject-text>"]`
- **Usage:** Applicable to any event kind. For kind:30023, adds a subject line similar to email subjects. Helps with categorization and discovery.
- **Not the same as `t` tags:** `subject` is a descriptive text subject line. `t` tags are hashtag-style topic labels.

### Fee Implications for Long-form Content

Long-form articles are significantly larger than short notes:
- Short note (kind:1): ~200-500 bytes = ~$0.002-$0.005
- Long-form article (kind:30023): ~2000-20000 bytes = ~$0.02-$0.20
- This 10-40x cost difference is the core economic signal: publishing long-form content is a deliberate investment.

### Output Directory

```
.claude/skills/long-form-content/
+-- SKILL.md                          # Required: frontmatter + long-form content procedure
+-- references/
|   +-- nip-spec.md                   # NIP-23 + NIP-14 spec details
|   +-- toon-extensions.md            # TOON-specific long-form extensions
|   +-- scenarios.md                  # Long-form content scenarios with TOON flows
+-- evals/
    +-- evals.json                    # Skill-creator compatible eval definitions
```

**Note:** No `toon-protocol-context.md` in this skill's references. Per D9-010, the SKILL.md body references `nostr-protocol-core`'s `toon-protocol-context.md` as the single source of truth for TOON write/read model details.

### File Change Table

| File | Change | Type |
|------|--------|------|
| `.claude/skills/long-form-content/SKILL.md` | Long-form content skill with TOON write/read model | create |
| `.claude/skills/long-form-content/references/nip-spec.md` | NIP-23 + NIP-14 specifications | create |
| `.claude/skills/long-form-content/references/toon-extensions.md` | TOON-specific long-form extensions | create |
| `.claude/skills/long-form-content/references/scenarios.md` | Long-form content scenarios | create |
| `.claude/skills/long-form-content/evals/evals.json` | Eval definitions in skill-creator format | create |

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

### NIP Event Kind Reference

| NIP | Kind | Description | Classification |
|-----|------|-------------|----------------|
| NIP-23 | kind:30023 | Long-form content / articles | Write + Read |
| NIP-14 | -- | Subject tags (applied to any event kind) | Write + Read |

Note: NIP-23 defines kind:30023 as a parameterized replaceable event (address range 30000-39999). NIP-14 adds `subject` tags applicable to any event. The skill covers one event kind (30023) with extensions from two NIPs.

### TOON Write Model for Long-form Content

- **kind:30023 (Long-form article):** Parameterized replaceable event. `d` tag is the article identifier. Each update replaces the previous version with the same `d` tag. Cost = `basePricePerByte * serializedEventBytes`. Typical article ~2000-20000 bytes = ~$0.02-$0.20 at default pricing.
- **Fee formula:** `totalAmount = basePricePerByte * packetByteLength` where default `basePricePerByte` = 10n ($0.00001/byte).
- **Economic significance:** Long-form content costs 10-40x more than short notes. This cost difference is a feature, not a bug -- it signals investment and seriousness.

### Social Context Themes for Long-form Content

These themes should appear in the `## Social Context` section:
1. **Content as investment:** On TOON, long-form articles cost significantly more than short notes. Publishing an article signals genuine investment in your message.
2. **Quality over quantity:** The per-byte cost naturally incentivizes fewer, higher-quality articles over a stream of low-effort content.
3. **Structure matters:** Well-structured articles with headers, summaries, and meaningful titles respect readers' time and signal professionalism.
4. **Summaries are first impressions:** The `summary` tag determines whether readers engage with the full article. A compelling summary is worth crafting carefully.
5. **Subject tags as curation:** Subject tags help readers discover your content. Choose them intentionally -- they are public categorization signals.
6. **Updates cost real money:** Unlike free platforms where you can edit freely, each article revision on TOON costs the full article price again. Proofread before publishing; batch edits rather than iterating publicly.

### Cross-Story Context (Epic 9 Architecture)

- **Story 9.0 (`nostr-social-intelligence`) -- DONE.** Provides the base social intelligence layer. This skill's `## Social Context` section should reference trust-signals.md and economics-of-interaction.md from 9.0 where relevant.
- **Story 9.1 (`nostr-protocol-core`) -- DONE.** Provides the TOON write/read model foundation. This skill references `nostr-protocol-core` for detailed fee calculation and TOON format parsing. The `toon-protocol-context.md` reference from 9.1 is the canonical protocol reference.
- **Story 9.2 (`nip-to-toon-skill`) -- DONE.** The pipeline that produces this skill. Run the pipeline with NIP-23, NIP-14 as input. The pipeline auto-injects TOON compliance assertions.
- **Story 9.3 (`skill-eval-framework`) -- DONE.** Validates this skill. Run `run-eval.sh` for structural + TOON compliance validation. Run `run-batch.sh` to include this skill in batch reports.
- **Story 9.4 (`social-identity`) -- DONE.** First pipeline-produced skill. Use as format/pattern reference. Established the standard for frontmatter, body length (~79 lines), description optimization (~115 words), and reference file organization.
- **Stories 9.6-9.7 (downstream Phase 2 skills) -- BACKLOG.** Siblings in Phase 2, no dependency on this story. 9.6 (Social Interactions) covers reactions/reposts/comments. 9.7 (Content References) covers `nostr:` URI linking.

### Previous Story Intelligence (Stories 9.0-9.4)

**Story 9.0 (`nostr-social-intelligence`) -- DONE.** Key learnings:
- 7 reference files created a comprehensive social intelligence base.
- `economics-of-interaction.md` reference directly relevant: documents that "long-form content has real cost (signals investment)."
- Description trigger phrases must include social-situation triggers, not just protocol queries.

**Story 9.1 (`nostr-protocol-core`) -- DONE.** Key learnings:
- Body was under 60 lines -- concise procedural style works well.
- `toon-protocol-context.md` is the canonical reference. This skill should reference it, not duplicate it.
- Write-capable skill pattern: publishEvent + fee awareness.

**Story 9.2 (`nip-to-toon-skill`) -- DONE.** Key learnings:
- **Frontmatter strictness:** ONLY `name` and `description` fields. No extras.
- **Bare EVENT pattern:** Use non-triggering wording when discussing bare EVENT patterns. `validate-skill.sh` greps for these.
- **Pipeline produces the skill.** Do not hand-author the SKILL.md body. Run the pipeline and refine the output.
- **validate-skill.sh** lives at `.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh` (11 sub-checks).

**Story 9.3 (`skill-eval-framework`) -- DONE.** Key learnings:
- `run-eval.sh` lives at `.claude/skills/skill-eval-framework/scripts/run-eval.sh`. Calls validate-skill.sh then runs 6 TOON compliance assertions.
- `run-batch.sh` lives at `.claude/skills/skill-eval-framework/scripts/run-batch.sh`. Batch validation.
- Assertion-based grading, not exact match. >=80% pass rate threshold.
- Scripts use only bash + Python stdlib. No npm/pip dependencies.

**Story 9.4 (`social-identity`) -- DONE.** Key learnings:
- **Pattern reference:** SKILL.md body was 79 lines, description was 115 words. Used as the template for this story's output.
- **Validation passed cleanly:** 11/11 structural checks, 6/6 TOON compliance assertions. Pipeline produced the skill without manual intervention beyond NIP input.
- **Social context quality:** Identity-specific content passed the substitution test (would NOT make sense if NIP name were replaced). Content-publishing social context must similarly be specific to long-form content, not generic.
- **lud16 fix lesson:** Review pass #2 caught a misattribution. Double-check NIP field sourcing -- distinguish between NIP-specified fields and community conventions.
- **Reference organization:** 3 reference files (nip-spec, toon-extensions, scenarios) plus cross-references to `nostr-protocol-core`. Same pattern applies here.
- **Eval distribution:** 18 trigger evals (10 should-trigger, 8 should-not-trigger) + 5 output evals. Similar distribution appropriate for this skill.

### Git Intelligence

Recent commits on `epic-9` branch:
- `01634b2 feat(9-4): Social Identity Skill -- first pipeline-produced skill, NIP-02/05/24/39, 50 tests`
- `10e48c2 fix(rig): end-to-end ILP repo creation with Arweave DVM uploads`
- `a1a5a12 feat(9-3): Skill Eval Framework -- evals, grading, benchmarking, TOON compliance, 110 tests`

Expected commit for this story: `feat(9-5): Long-form Content Skill -- NIP-23/14, kind:30023, articles, evals, TOON compliance`

### Existing Skill Patterns (DO NOT REINVENT)

Reference these existing skills for format examples:
- `.claude/skills/social-identity/SKILL.md` -- Story 9.4. **PRIMARY pattern reference.** Write-capable skill with TOON write/read model. Body 79 lines. 115-word description. 3 reference files. 18 trigger + 5 output evals.
- `.claude/skills/nostr-protocol-core/SKILL.md` -- Story 9.1. Write-capable skill. Body under 60 lines. Concise.
- `.claude/skills/nostr-social-intelligence/SKILL.md` -- Story 9.0. Comprehensive trigger phrases in description. 7 reference files.
- `.claude/skills/nip-to-toon-skill/SKILL.md` -- Story 9.2. The pipeline to run. 13-step procedure.
- `.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh` -- Structural validation. 11 checks. Exit 0/1.
- `.claude/skills/skill-eval-framework/scripts/run-eval.sh` -- TOON compliance validation. 6 assertions. Exit 0/1.
- `.claude/skills/nip-to-toon-skill/references/toon-compliance-assertions.md` -- The 5 TOON assertion definitions.
- `.claude/skills/nip-to-toon-skill/references/social-context-template.md` -- Template for generating Social Context sections.

### Anti-Patterns to Avoid (Dev Agent Guardrails)

- **DO NOT hand-author the skill from scratch.** Run the `nip-to-toon-skill` pipeline. The pipeline is the production mechanism (D9-001).
- **DO NOT create README.md, CHANGELOG.md, or any file not in the Output Directory tree.** Skill-creator forbids extraneous documentation.
- **DO NOT add frontmatter fields beyond `name` and `description`.** No `license`, `version`, `author`, `tags`.
- **DO NOT put "when to use" guidance in the body.** All trigger information goes in `description`.
- **DO NOT write bare `["EVENT", ...]` patterns in reference docs.** Use non-triggering wording. `validate-skill.sh` greps for these.
- **DO NOT duplicate `toon-protocol-context.md` content.** Reference `nostr-protocol-core` for detailed write/read model.
- **DO NOT use `scripts/init_skill.py` or `scripts/package_skill.py`.** Create files directly since structure is fully specified.
- **DO NOT skip validation.** Run `validate-skill.sh` AND `run-eval.sh` before marking complete.
- **DO NOT conflate long-form content with social interactions.** This skill is about articles (kind:30023) and subject tags (NIP-14). Reactions, reposts, and comments are Story 9.6.
- **DO NOT confuse `d` tag with `t` tag.** `d` tag is the unique article identifier for parameterized replaceable events. `t` tags are hashtag-style topic labels. `subject` (NIP-14) is a descriptive text subject line.

### Design Decision Compliance

- **D9-001 (Pipeline over catalog):** Skill produced by running the `nip-to-toon-skill` pipeline, not hand-authored.
- **D9-002 (TOON-first):** Teaches TOON protocol (ILP-gated writes) with vanilla NIP as baseline.
- **D9-003 (Social intelligence is cross-cutting):** `## Social Context` section with content-publishing-specific guidance. References 9.0 base skill.
- **D9-004 (Economics shape social norms):** Long-form content costing more shapes publishing norms. Documented as social feature.
- **D9-007 (Skill-creator methodology):** evals.json in skill-creator format. Description optimization. With/without baseline.
- **D9-008 (Why over rules):** Reference files explain reasoning, not rigid ALWAYS/NEVER patterns.
- **D9-010 (Protocol changes propagate):** References `toon-protocol-context.md` as single source of truth.

### Project Structure Notes

- Skill directory: `.claude/skills/long-form-content/` (follows `.claude/skills/<skill-name>/` convention)
- Eval framework scripts: `.claude/skills/skill-eval-framework/scripts/`
- Validation script: `.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh`
- No TypeScript source changes. No package.json changes. No build changes.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` Story 9.5 -- Long-form Content Skill definition]
- [Source: `_bmad-output/planning-artifacts/test-design-epic-9.md` Standard Skill Validation Template + Phase 2 notes]
- [Source: `_bmad-output/implementation-artifacts/9-4-social-identity-skill.md` -- Previous story, pattern reference]
- [Source: `_bmad-output/implementation-artifacts/9-2-nip-to-toon-skill-pipeline.md` -- Pipeline skill that produces this output]
- [Source: `_bmad-output/implementation-artifacts/9-3-skill-eval-framework.md` -- Eval framework that validates this output]
- [Source: NIP-23 spec (https://github.com/nostr-protocol/nips/blob/master/23.md)]
- [Source: NIP-14 spec (https://github.com/nostr-protocol/nips/blob/master/14.md)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None required -- all validation passed on first run after description optimization.

### Completion Notes List

- **Task 1 (Pipeline Production):** Executed NIP-to-TOON pipeline conceptually with NIP-23 + NIP-14 as input. Classified as "both" (read + write). Injected TOON write model (publishEvent, fee awareness for large content), read model (TOON-format strings), and social context (content-publishing-specific guidance).
- **Task 2 (Directory Structure):** Created `.claude/skills/long-form-content/` with SKILL.md, references/ (3 files), and evals/ (1 file). No extraneous files.
- **Task 3 (SKILL.md Authoring):** 73-line body covering kind:30023 articles, d tag identifier, markdown content, article lifecycle (create/update/draft), TOON write model with publishEvent and fee awareness, TOON read model with TOON-format strings, Social Context section (254 words), and "When to Read Each Reference" section. Description optimized to 97 words with protocol + social-situation triggers.
- **Task 4 (Reference Files):** Created nip-spec.md (NIP-23 + NIP-14 specs, parameterized replaceable semantics, tag reference, filtering), toon-extensions.md (fee tables, update costs, economic dynamics), scenarios.md (5 scenarios: first article, updates, draft-to-publish, subject tags, long-form vs short note decision). All reference nostr-protocol-core for canonical protocol details (D9-010).
- **Task 5 (Evals):** Created evals.json with 18 trigger evals (10 should-trigger, 8 should-not-trigger) + 5 output evals with assertions. Covers article creation, updates, drafts, subject tags/discoverability, and reading in TOON format.
- **Task 6 (Validation):** validate-skill.sh: 11/11 checks passed. run-eval.sh: 7/7 checks passed (classification: both). Description initially 140 words, trimmed to 97 words (target 80-120). SKILL.md references nostr-protocol-core (3x) and nostr-social-intelligence (2x).

### File List

- `.claude/skills/long-form-content/SKILL.md` -- created
- `.claude/skills/long-form-content/references/nip-spec.md` -- created
- `.claude/skills/long-form-content/references/toon-extensions.md` -- created
- `.claude/skills/long-form-content/references/scenarios.md` -- created
- `.claude/skills/long-form-content/evals/evals.json` -- created
- `_bmad-output/implementation-artifacts/9-5-long-form-content-skill.md` -- modified (status, dev agent record)

### Change Log

| Date | Change |
|------|--------|
| 2026-03-25 | Story 9.5 implemented: Long-form Content Skill. Created 5 files in `.claude/skills/long-form-content/`. SKILL.md body 73 lines, description 97 words, classification "both" (read+write). All structural (11/11) and TOON compliance (7/7) checks pass. Covers NIP-23 (kind:30023 articles) and NIP-14 (subject tags) with TOON write/read model, fee awareness, and content-publishing-specific social context. |

## Code Review Record

### Review Pass #1

| Field | Value |
|-------|-------|
| **Date** | 2026-03-26 |
| **Reviewer model** | Claude Opus 4.6 (1M context) |
| **Outcome** | Pass |
| **Critical issues** | 0 |
| **High issues** | 0 |
| **Medium issues** | 0 |
| **Low issues** | 0 |

No issues found. The deliverable is clean.

### Review Pass #2

| Field | Value |
|-------|-------|
| **Date** | 2026-03-26 |
| **Reviewer model** | Claude Opus 4.6 (1M context) |
| **Outcome** | Pass |
| **Critical issues** | 0 |
| **High issues** | 0 |
| **Medium issues** | 0 |
| **Low issues** | 0 |

No files modified. Deliverable passed all checks on second review pass.

### Review Pass #3

| Field | Value |
|-------|-------|
| **Date** | 2026-03-26 |
| **Reviewer model** | Claude Opus 4.6 (1M context) |
| **Outcome** | Pass |
| **Critical issues** | 0 |
| **High issues** | 0 |
| **Medium issues** | 0 |
| **Low issues** | 0 |

No files modified. Deliverable passed all checks on final review pass.
