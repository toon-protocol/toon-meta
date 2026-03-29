# Story 9.14: Media and Files Skill (`media-and-files`)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **TOON agent**,
I want a skill teaching media attachment and file metadata handling,
So that I can work with rich media content including Arweave references on TOON.

**Dependencies:** Stories 9.0 (social intelligence -- done), 9.1 (protocol core -- done), 9.2 (pipeline -- done), 9.3 (eval framework -- done)

**Decision sources:**
- Party Mode 2026-03-22: NIP Skills Epic (D9-001, D9-002, D9-003, D9-004, D9-007)
- `_bmad-output/project-context.md` section "NIP-to-TOON Skill Pipeline Architecture"
- `_bmad-output/planning-artifacts/epics.md` Epic 9, Story 9.14
- `_bmad-output/planning-artifacts/test-design-epic-9.md` Phase 5 Rich Media notes

**Downstream dependencies:** This is the first Phase 5 (Rich Media) skill. Story 9.15 (visual media) and 9.16 (file storage) are peer skills in Phase 5 but do NOT depend on 9.14. Story 9.34 (publication gate) validates this skill alongside all others. The `arweave:tx:` external content ID coverage in this skill is critical for TOON/Arweave integration (cross-reference with Epic 8's Arweave DVM kind:5094).

**Nature of deliverable:** This story produces a **Claude Agent Skill** (structured markdown + reference files + eval JSON), produced by running the `nip-to-toon-skill` pipeline (Story 9.2). The skill teaches an agent HOW to work with media attachments (NIP-92 `imeta` tags), file metadata events (NIP-94 kind:1063), and external content identifiers (NIP-73) including `arweave:tx:` references. Output is a `.claude/skills/media-and-files/` directory.

**Risk context:** E9-R001 (pipeline single point of failure) -- mitigated because 9.4-9.10 already validated the pipeline. E9-R008 (write model correctness varies by NIP) -- NIP-94 kind:1063 is a regular event for file metadata. NIP-92 `imeta` tags are embedded within other events (not standalone kinds). NIP-73 external content IDs are tag-based references. On TOON, media-rich events with `imeta` tags are larger than text-only events, increasing per-byte cost. The `arweave:tx:` external content ID is critical for TOON/Arweave integration per test-design-epic-9.md Phase 5 notes.

**Rationale:** D9-001 (pipeline over catalog) means this skill is produced by running the `nip-to-toon-skill` pipeline. D9-002 (TOON-first) means the skill teaches TOON protocol context with vanilla NIP as baseline. D9-003 (social intelligence is cross-cutting) means a `## Social Context` section explains media sharing norms on a paid network. D9-004 (economics shape social norms) means that on TOON, media-rich posts cost more per-byte, creating natural incentives to share media thoughtfully rather than flooding with attachments.

## Acceptance Criteria

### AC1: Pipeline Production [Test: STRUCT-A, STRUCT-B]
**Given** the `nip-to-toon-skill` pipeline (Story 9.2)
**When** the pipeline is run with NIP-92, NIP-94, and NIP-73 as input
**Then** it produces a complete `media-and-files` skill directory at `.claude/skills/media-and-files/` with:
- `SKILL.md` with YAML frontmatter (ONLY `name` and `description` fields)
- `references/` directory with Level 3 reference files
- `evals/evals.json` in skill-creator format

### AC2: NIP Coverage [Test: EVAL-A, EVAL-B]
**Given** the `media-and-files/SKILL.md` file
**When** an agent needs to work with media content on TOON
**Then** the skill covers:
- **NIP-92 (Media Attachments / `imeta` tags):** The `imeta` tag structure for inline media metadata within any event. Tag format: `["imeta", "url <url>", "m <mimetype>", "alt <alt-text>", "x <sha256-hex>", "size <bytes>", "dim <WxH>", "blurhash <blurhash>", "thumb <thumb-url>", "fallback <fallback-url>"]`. Multiple `imeta` tags per event (one per media URL referenced in content). `imeta` augments existing events (kind:1 notes, kind:30023 articles, etc.) with structured media metadata.
- **NIP-94 (File Metadata / kind:1063):** Standalone file metadata events. kind:1063 is a regular event. Content field contains the file description/caption. Required tags: `url` (file URL), `m` (MIME type), `x` (SHA-256 hash). Optional tags: `ox` (original SHA-256 hash before server transforms), `size` (bytes), `dim` (dimensions WxH), `blurhash`, `thumb` (thumbnail URL), `image` (preview image), `summary`, `alt` (accessibility text). kind:1063 events describe files hosted elsewhere (HTTP servers, Arweave, etc.).
- **NIP-73 (External Content IDs):** The `i` tag for referencing external content by type-prefixed identifier. Format: `["i", "<type>:<identifier>", "<relay-url>"]`. Key types: `arweave:tx:<txid>` (Arweave transaction -- critical for TOON), `isbn:<isbn>`, `doi:<doi>`, `magnet:<hash>`, `url:<url>`. External content IDs enable cross-platform content discovery and linking.

### AC3: TOON Write Model [Test: TOON-A, TOON-B]
**Given** the skill has write aspects (kind:1063 file metadata, events with `imeta` tags)
**When** the skill teaches media event publishing on TOON
**Then** it:
- Explains that kind:1063 file metadata events are published via `publishEvent()` from `@toon-protocol/client` and cost per-byte
- Explains that adding `imeta` tags to events (kind:1 notes, kind:30023 articles, etc.) increases the event byte size and therefore the per-byte cost
- Notes that `arweave:tx:` external content IDs in `i` tags add minimal byte overhead but reference large off-chain data (Arweave as storage layer)
- References `nostr-protocol-core` for the detailed fee formula and `publishEvent()` API
- Provides concrete fee estimates for typical media events

### AC4: TOON Read Model [Test: TOON-C]
**Given** the skill handles reading file metadata and media attachments
**When** teaching media data consumption
**Then** it documents that TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. References `nostr-protocol-core` for TOON format parsing details. Explains how to query for kind:1063 file metadata events. Explains how to parse `imeta` tags from events. Notes that `i` tag external content IDs can be used as filter criteria.

### AC5: Social Context [Test: STRUCT-D, TOON-D]
**Given** the `## Social Context` section
**When** an agent reads it
**Then** it provides media-specific social guidance:
- Media-rich events cost more per-byte on TOON. Adding `imeta` tags increases event size. Share media thoughtfully -- quality over quantity.
- kind:1063 file metadata events describe files hosted elsewhere. The metadata event itself is small, but it references potentially large external content. On TOON, you pay for the metadata event, not the file storage.
- `arweave:tx:` references connect TOON events to permanent Arweave storage. This is critical for TOON/Arweave integration -- use it when content permanence matters.
- Include `alt` text in `imeta` tags for accessibility. It costs a few extra bytes but makes content inclusive.
- Never embed large binary data directly in event content. Use URLs in `imeta` tags and kind:1063 metadata to reference externally hosted files. On TOON, bloated events waste money and degrade relay performance.
- External content IDs (NIP-73) enable cross-platform content discovery. Use `isbn:`, `doi:`, and `arweave:tx:` types to connect Nostr content to the broader information ecosystem.
- Section would NOT make sense if NIP name were replaced (passes substitution test).

### AC6: Eval Suite [Test: EVAL-A, EVAL-B]
**Given** the `evals/evals.json` file
**When** eval validation runs
**Then** it contains:
- 8-10 should-trigger queries including both protocol and social-situation triggers (e.g., "how do I attach media to a note on TOON?", "what is an imeta tag?", "NIP-92 media attachments", "how do I create a file metadata event?", "kind:1063 file metadata", "NIP-94 file metadata", "how do I reference Arweave content in Nostr?", "arweave:tx: external content ID", "NIP-73 external content IDs", "how do I add alt text to media?")
- 8-10 should-not-trigger queries (e.g., "how do I create a profile?", "how do I publish a long-form article?", "how do I react to a post?", "how do relay groups work?", "how do I upload a file via NIP-96?", "how do I create a picture-first post?", "how does encrypted messaging work?", "how do I search for content?", "how do I follow someone?")
- 4-6 output evals with `id`, `prompt`, `expected_output`, `rubric`, `assertions`

### AC7: TOON Compliance Passing [Test: TOON-A through TOON-D]
**Given** the eval framework (Story 9.3)
**When** `run-eval.sh` is run on the `media-and-files` skill
**Then** all 6 TOON compliance assertions pass:
- `toon-write-check`: references `publishEvent()` (write-supporting skill -- kind:1063 file metadata, events with `imeta` tags)
- `toon-fee-check`: includes fee awareness (media-rich events cost more per-byte due to `imeta` tags)
- `toon-format-check`: documents TOON-format strings (read-capable skill)
- `social-context-check`: has media-specific `## Social Context` section
- `trigger-coverage`: description includes both protocol and social-situation triggers
- `eval-completeness`: at least 6 trigger evals + 4 output evals

### AC8: Description Optimization [Test: STRUCT-B]
**Given** the skill's description field
**When** optimization is complete
**Then** the description:
- Contains ~80-120 words
- Includes trigger phrases for: NIP-92, NIP-94, NIP-73, media attachments, imeta tag, file metadata, kind:1063, external content IDs, arweave:tx:, media, file, attachment, alt text, MIME type, SHA-256 hash
- Includes social-situation triggers ("how do I attach media to a note?", "how do I describe a file?", "how do I reference Arweave content?", "what is an imeta tag?")
- Has been through at least one optimization pass

### AC9: Token Budget [Test: STRUCT-C]
**Given** the `media-and-files/SKILL.md` file
**When** token budget validation runs
**Then** the SKILL.md body (excluding frontmatter) is under 500 lines and approximately 5k tokens or fewer.

### AC10: Dependency References [Test: DEP-A]
**Given** the `media-and-files` skill
**When** the skill references upstream skills
**Then** it:
- References `nostr-protocol-core` (Story 9.1) for TOON write/read model details, fee calculation, and event structure
- References `nostr-social-intelligence` (Story 9.0) for base social intelligence and media sharing norms
- References `long-form-content` (Story 9.5) for `imeta` tag usage within kind:30023 articles
- References `content-references` (Story 9.7) for `nostr:` URI embedding alongside media references
- References `social-interactions` (Story 9.6) for reactions to media events (kind:7 on kind:1063)
- Does NOT duplicate content from upstream skills -- uses pointers instead

### AC11: With/Without Baseline [Test: BASE-A]
**Given** the `media-and-files` skill
**When** with/without testing runs (pipeline Step 8)
**Then** the skill demonstrates measurable value-add over baseline (no-skill) responses for media-related queries.

### AC12: Arweave Integration Coverage [Test: ARWEAVE-A]
**Given** the `media-and-files` skill covers NIP-73 external content IDs
**When** an agent queries about Arweave content referencing
**Then** the skill specifically covers:
- `arweave:tx:<txid>` format in `i` tags
- How kind:1063 file metadata can reference Arweave-hosted files via URL
- The relationship between TOON's Arweave DVM (kind:5094 from Epic 8) and NIP-73/NIP-94 metadata
- That `arweave:tx:` IDs provide permanent, immutable content references

## Tasks / Subtasks

- [ ] Task 1: Run the NIP-to-TOON pipeline (AC: #1, #11)
  - [ ] 1.1 Load the `nip-to-toon-skill` skill from `.claude/skills/nip-to-toon-skill/SKILL.md`
  - [ ] 1.2 Execute the 13-step pipeline with input NIPs: NIP-92 (Media Attachments), NIP-94 (File Metadata), NIP-73 (External Content IDs)
  - [ ] 1.3 Pipeline Step 1 (NIP Analysis): Classify as "both" (read + write). NIP-92 defines `imeta` tags for media metadata within events. NIP-94 defines kind:1063 for standalone file metadata. NIP-73 defines `i` tags for external content IDs. Key elements: `imeta` tag (embedded metadata), kind:1063 (file metadata event), `i` tag with type-prefixed identifiers including `arweave:tx:`.
  - [ ] 1.4 Pipeline Step 2 (TOON Context Injection): Inject write model (kind:1063 file metadata via publishEvent, imeta tags increase event byte size and therefore fee, i tags with arweave:tx: add minimal overhead), read model (TOON format, querying kind:1063 events, parsing imeta tags from events), fee context (media-rich events cost more per-byte, kind:1063 metadata events are relatively small but describe large external files).
  - [ ] 1.5 Pipeline Step 3 (Social Context Layer): Generate media-specific social context using `references/social-context-template.md`. Focus on media quality over quantity on a paid network, accessibility (alt text), Arweave permanence, cross-platform content discovery.
  - [ ] 1.6 Pipeline Step 4 (Skill Authoring): Generate SKILL.md with frontmatter, body, and references.
  - [ ] 1.7 Pipeline Step 5 (Eval Generation): Generate `evals/evals.json` with trigger + output evals.
  - [ ] 1.8 Pipeline Step 6 (TOON Assertions): Auto-inject TOON compliance assertions.
  - [ ] 1.9 Pipeline Step 7 (Description Optimization): Run optimization loop with 20 trigger queries, max 5 iterations.
  - [ ] 1.10 Pipeline Step 8 (With/Without Testing): Spawn parallel subagent runs -- one with skill loaded, one without (baseline).
  - [ ] 1.11 Pipeline Steps 9-10 (Grading + Benchmarking): Produce `grading.json` and `benchmark.json`.
  - [ ] 1.12 Pipeline Step 11 (TOON Compliance Validation): Run TOON-specific assertion checks.
  - [ ] 1.13 Pipeline Steps 12-13 (Eval Viewer + Iterate): Generate HTML review, collect feedback, refine if needed.

- [ ] Task 2: Create skill directory structure (AC: #1)
  - [ ] 2.1 Create `.claude/skills/media-and-files/` directory
  - [ ] 2.2 Create `SKILL.md` with YAML frontmatter (`name: media-and-files`, `description` with trigger phrases)
  - [ ] 2.3 Create `references/` subdirectory with Level 3 reference files
  - [ ] 2.4 Create `evals/` subdirectory with `evals.json`
  - [ ] 2.5 Verify directory layout matches skill-creator anatomy (no extraneous files)

- [ ] Task 3: Author SKILL.md (AC: #2, #3, #4, #5, #8, #9, #10, #12)
  - [ ] 3.1 Write frontmatter with ONLY `name` and `description` fields
  - [ ] 3.2 Write description (~80-120 words) with protocol + social-situation triggers covering NIP-92, NIP-94, NIP-73, imeta, kind:1063, arweave:tx:, media attachments, file metadata, external content IDs
  - [ ] 3.3 Write body covering: NIP-92 `imeta` tag structure (url, m, alt, x, size, dim, blurhash, thumb, fallback), NIP-94 kind:1063 file metadata events (url, m, x required tags, optional tags, description in content field), NIP-73 external content ID `i` tags (type:identifier format, arweave:tx:, isbn:, doi:, url:)
  - [ ] 3.4 Include TOON Write Model section: kind:1063 via `publishEvent()`, imeta tags increase event byte size (and fee), i tags with arweave:tx: add minimal byte overhead, fee estimates for typical media events
  - [ ] 3.5 Include TOON Read Model section: TOON-format parsing, querying kind:1063 events, parsing imeta tags from events, using i tag external content IDs as filter criteria
  - [ ] 3.6 Include `## Social Context` section with media-specific guidance: quality over quantity on paid network, accessibility (alt text), Arweave permanence for content that matters, cross-platform content discovery via external IDs
  - [ ] 3.7 Include "When to read each reference" section
  - [ ] 3.8 Include pointers to `nostr-protocol-core` for TOON write/read model and fee calculation (D9-010, DEP-A)
  - [ ] 3.9 Include pointer to `nostr-social-intelligence` for base social context and media sharing norms (DEP-A)
  - [ ] 3.10 Include pointer to `long-form-content` for imeta tag usage within articles (DEP-A)
  - [ ] 3.11 Include pointer to `content-references` for nostr: URI embedding alongside media references (DEP-A)
  - [ ] 3.12 Include pointer to `social-interactions` for reactions to media events (DEP-A)
  - [ ] 3.13 Keep body under 500 lines / ~5k tokens
  - [ ] 3.14 Use imperative/infinitive form per skill-creator writing guidelines
  - [ ] 3.15 Document arweave:tx: external content ID integration with TOON's Arweave DVM (kind:5094) from Epic 8

- [ ] Task 4: Author reference files (AC: #2, #5, #10, #12)
  - [ ] 4.1 Write `references/nip-spec.md` -- Consolidated NIP-92/NIP-94/NIP-73 spec details. NIP-92: `imeta` tag format, multiple imeta tags per event, augments existing event kinds. NIP-94: kind:1063 structure, required tags (url, m, x), optional tags (ox, size, dim, blurhash, thumb, image, summary, alt), content as description/caption. NIP-73: `i` tag format with type-prefixed identifiers, key types (arweave:tx:, isbn:, doi:, magnet:, url:), relay hint as third element.
  - [ ] 4.2 Write `references/toon-extensions.md` -- TOON-specific media dynamics: per-byte cost of media-rich events (imeta tags increase size), kind:1063 metadata events are small (describe external files), arweave:tx: IDs connect TOON events to permanent Arweave storage, fee estimates for typical media events (kind:1063 ~300-800 bytes, imeta tag overhead ~100-300 bytes per attachment).
  - [ ] 4.3 Write `references/scenarios.md` -- Media usage scenarios: attaching media to a kind:1 note (adding imeta tags), creating a file metadata event (kind:1063 for an Arweave-hosted file), referencing external content (arweave:tx: in i tag), querying file metadata events, parsing imeta tags from received events. Each with step-by-step TOON flow.
  - [ ] 4.4 Reference `nostr-protocol-core` skill's `toon-protocol-context.md` from SKILL.md body (per D9-010: single source of truth). Do NOT duplicate `toon-protocol-context.md` into this skill's references directory.
  - [ ] 4.5 Every reference file must explain WHY (reasoning per D9-008), not just list rules

- [ ] Task 5: Create evals (AC: #6)
  - [ ] 5.1 Create `evals/evals.json` in skill-creator format
  - [ ] 5.2 8-10 should-trigger queries covering: NIP-92, NIP-94, NIP-73, imeta tag, media attachment, file metadata, kind:1063, external content ID, arweave:tx:, alt text, MIME type, media on TOON
  - [ ] 5.3 8-10 should-not-trigger queries: profile creation, relay groups, public chat, encrypted messaging, visual media (NIP-68/71 -- that's 9.15), file storage/upload (NIP-96 -- that's 9.16), search, lists, badges, polls
  - [ ] 5.4 4-6 output evals with assertions testing: (1) imeta tag includes correct structure with url/m/alt/x fields, (2) kind:1063 includes required tags (url, m, x), (3) arweave:tx: external content ID format correct, (4) fee awareness for media-rich events, (5) TOON-format reading mentioned, (6) alt text accessibility mentioned
  - [ ] 5.5 Include TOON compliance assertions in output eval assertions
  - [ ] 5.6 Use rubric-based grading: `correct` / `acceptable` / `incorrect`

- [ ] Task 6: Run validation (AC: #7, #9, #10, #11)
  - [ ] 6.1 Run `validate-skill.sh` (from Story 9.2) on `.claude/skills/media-and-files/` -- must pass all 11 structural checks
  - [ ] 6.2 Run `run-eval.sh` (from Story 9.3) on `.claude/skills/media-and-files/` -- must pass all 6 TOON compliance assertions
  - [ ] 6.3 Verify `evals/evals.json` is valid JSON with required structure

## Dev Notes

### Architecture & Existing Code

- **No existing NIP-92/NIP-94/NIP-73 types in core:** Unlike NIP-34 which has types/constants in `packages/core/src/nip34/`, these NIPs have no existing TypeScript support. The skill documents the protocols without requiring code changes.
- **Existing Arweave storage:** `packages/core/src/events/arweave-storage.ts` has kind:5094 builder/parser. The `arweave:tx:` external content ID (NIP-73) links metadata events to Arweave-stored content.
- **NIP-94 and NIP-73 referenced in project-context.md:** `_bmad-output/project-context.md` line 261 references "NIP-73 (external content IDs `arweave:tx:`), NIP-94 (file metadata, optional)" in the Arweave DVM architecture context.
- **Skill target directory:** `.claude/skills/media-and-files/` (does NOT exist yet, must be created)
- **Phase 5 test design note:** "9.14 must include `arweave:tx:` external content IDs (critical TOON/Arweave integration). Cross-reference with Epic 8's Arweave DVM (kind:5094)."

### Skill Pattern to Follow

All existing TOON skills follow the same anatomy established by the NIP-to-TOON pipeline (story 9-2):
1. `SKILL.md` -- frontmatter (name + description only), body under 500 lines, imperative voice
2. `references/nip-spec.md` -- NIP wire format details
3. `references/toon-extensions.md` -- TOON write/read model specifics
4. `references/scenarios.md` -- social context and usage scenarios
5. `evals/evals.json` -- trigger + output evals

This story covers THREE NIPs (NIP-92, NIP-94, NIP-73) in a single skill. The `nip-spec.md` reference file must cover all three NIPs clearly, with distinct sections for each.

### Key Event Kinds and Tags

| Kind/Tag | Name | Type | Description |
|----------|------|------|-------------|
| kind:1063 | File Metadata | Regular event | Standalone file description/caption |
| `imeta` tag | Media Attachment | Tag (NIP-92) | Inline media metadata within any event |
| `i` tag | External Content ID | Tag (NIP-73) | Type-prefixed external content reference |

### NIP-92 `imeta` Tag Structure

```
["imeta",
  "url https://example.com/image.jpg",
  "m image/jpeg",
  "alt A description of the image",
  "x abc123def456...",
  "size 123456",
  "dim 800x600",
  "blurhash LGF5]+Yk^6#M@-5c",
  "thumb https://example.com/thumb.jpg",
  "fallback https://fallback.com/image.jpg"
]
```

Each key-value pair is a space-separated string within the tag array. Multiple `imeta` tags per event (one per media URL in content).

### NIP-94 kind:1063 Structure

- **Content:** File description/caption text
- **Required tags:** `url` (file URL), `m` (MIME type), `x` (SHA-256 hex hash)
- **Optional tags:** `ox` (original SHA-256 before server transforms), `size` (bytes), `dim` (WxH), `blurhash`, `thumb` (thumbnail URL), `image` (preview), `summary`, `alt` (accessibility)

### NIP-73 External Content ID Format

- **Tag:** `["i", "<type>:<identifier>"]` or `["i", "<type>:<identifier>", "<relay-url>"]`
- **Key types:**
  - `arweave:tx:<txid>` -- Arweave transaction (critical for TOON)
  - `isbn:<isbn>` -- Book identifier
  - `doi:<doi>` -- Digital Object Identifier
  - `magnet:<hash>` -- Magnet link
  - `url:<url>` -- Generic URL

### TOON Fee Estimates (basePricePerByte = 10n = $0.00001/byte)

- kind:1063 file metadata event: ~300-800 bytes = $0.003-$0.008
- `imeta` tag overhead per attachment: ~100-300 bytes = $0.001-$0.003
- `i` tag external content ID: ~50-100 bytes = $0.0005-$0.001
- Kind:1 note with one imeta tag: ~400-700 bytes = $0.004-$0.007
- Kind:30023 article with three imeta tags: ~2000-8000 bytes = $0.02-$0.08

### Boundary with Adjacent Skills

- **9.15 (Visual Media):** Covers NIP-68 (picture-first feeds, kind:20) and NIP-71 (video events, kind:34235). These are specific visual content event kinds. 9.14 covers the metadata/attachment layer that AUGMENTS any event kind.
- **9.16 (File Storage):** Covers NIP-96 (HTTP File Storage Integration) -- the upload/download protocol. 9.14 covers the metadata/reference layer for files already hosted somewhere.
- **Epic 8 Arweave DVM:** kind:5094 DVM requests for uploading to Arweave. 9.14's NIP-73 `arweave:tx:` IDs REFERENCE content that was uploaded via the DVM. They are complementary: DVM uploads, NIP-73 references.

### Previous Story Intelligence

Stories 9-4 through 9-10 established the skill pattern. Key learnings:
- SKILL.md description must be 80-120 words with social-situation triggers, not just protocol terms
- evals need both trigger and output categories
- Reference files should be self-contained -- an agent reading just one reference file should get complete knowledge for that topic
- Social context sections must be specific to the NIP, not generic
- TOON fee estimates with concrete dollar amounts help agents make economic decisions
- Multi-NIP skills need clear section boundaries in nip-spec.md (this skill covers 3 NIPs)

### Project Structure Notes

- Skill goes in `.claude/skills/media-and-files/` (project root, NOT in packages/)
- Reference files go in `.claude/skills/media-and-files/references/`
- Eval files go in `.claude/skills/media-and-files/evals/`
- Follow exact file structure of existing skills like `.claude/skills/social-interactions/`

### References

- [Source: _bmad-output/project-context.md line 261] -- NIP-73/NIP-94 in Arweave DVM context
- [Source: packages/core/src/events/arweave-storage.ts] -- kind:5094 builder/parser (Arweave DVM)
- [Source: .claude/skills/social-interactions/] -- Reference skill anatomy pattern + reactions to media events
- [Source: .claude/skills/nip-to-toon-skill/SKILL.md] -- NIP-to-TOON pipeline steps
- [Source: _bmad-output/project-context.md] -- Project conventions and testing standards
- [Source: _bmad-output/planning-artifacts/test-design-epic-9.md] -- Phase 5 Rich Media notes

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Change Log
