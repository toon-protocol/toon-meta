# Story 9.0: Social Intelligence Base Skill (`nostr-social-intelligence`)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **TOON agent**,
I want a cross-cutting social intelligence skill that teaches me when and why to use each interaction type,
So that I behave as a thoughtful social participant rather than a protocol-executing bot.

**Dependencies:** None (foundational -- first story in Epic 9)

**Decision sources:**
- Party Mode 2026-03-22: NIP Skills Epic, socialverse prioritization (D9-003, D9-004, D9-007, D9-008)
- `_bmad-output/project-context.md` section "NIP-to-TOON Skill Pipeline Architecture"
- `_bmad-output/planning-artifacts/epics.md` Epic 9 section, Story 9.0

**Downstream dependencies:** Every NIP skill (Stories 9.4-9.34) references `nostr-social-intelligence` via a `## Social Context` section pointer. Story 9.2 (pipeline) uses patterns established here as the reference implementation for social context injection. Story 9.3 (eval framework) calibrates social intelligence evals using this skill as the first test subject.

**Nature of deliverable:** This story produces a **Claude Agent Skill** (structured markdown + reference files + eval JSON), NOT TypeScript code. The output is a `.claude/skills/nostr-social-intelligence/` directory following Anthropic's skill-creator format.

**Rationale:** Social intelligence is the cross-cutting foundation for all 30+ NIP skills in Epic 9 (D9-003). Without this skill, every downstream NIP skill would need to independently teach social judgment -- leading to inconsistency, drift, and redundancy. This skill encodes the "why" behind social behavior (D9-008) and how ILP economics shape norms (D9-004), establishing patterns that Story 9.2's pipeline will auto-inject into every subsequent skill.

## Acceptance Criteria

### AC1: SKILL.md Core File [Test: 9.0-STRUCT-001]
**Given** the `nostr-social-intelligence/SKILL.md` file
**When** an agent faces a social decision (react vs comment vs repost vs ignore, group etiquette, conflict handling)
**Then** the skill triggers and provides the relevant decision framework.

### AC2: Description Triggers on Social Situations [Test: 9.0-TRIGGER-001]
**Given** the SKILL.md `description` field in YAML frontmatter
**Then** it triggers on social-situation questions ("should I react to this?", "what's appropriate here?", "how do I handle this disagreement?") not just protocol questions. The description must include explicit trigger phrases for social judgment, interaction choice, community norms, and conflict resolution.

### AC3: Interaction Decisions Reference [Test: 9.0-STRUCT-002]
**Given** the `references/interaction-decisions.md` file
**Then** it provides a conditional decision tree:
1. Does the content deserve amplification? -> repost/quote
2. Do you have substantive thoughts? -> comment
3. Want to acknowledge? -> react
4. Nothing to add? -> silence is fine

With context modifiers for: group size, feed vs DM, long-form vs short notes.

### AC4: Context Norms Reference [Test: 9.0-STRUCT-003]
**Given** the `references/context-norms.md` file
**Then** it provides a behavior matrix by context:
- **Public feed:** liberal reactions, substantive comments
- **Small NIP-29 groups:** thoughtful reactions, encouraged comments
- **Large groups:** free reactions, focused comments
- **DMs:** direct, personal
- **Long-form:** considered, detailed

### AC5: Trust Signals Reference [Test: 9.0-STRUCT-004]
**Given** the `references/trust-signals.md` file
**Then** it documents:
- Follow count is not authority
- Relay membership matters (ILP-gated = skin-in-the-game)
- NIP-05 = domain ownership, not identity
- New accounts deserve benefit of the doubt

### AC6: Conflict Resolution Reference [Test: 9.0-STRUCT-005]
**Given** the `references/conflict-resolution.md` file
**Then** it documents the escalation ladder: ignore -> mute (NIP-51) -> block -> report (NIP-56). In NIP-29 groups: defer to admins, don't relitigate publicly.

### AC7: Pseudonymous Culture Reference [Test: 9.0-STRUCT-006]
**Given** the `references/pseudonymous-culture.md` file
**Then** it documents:
- Don't assume identity from keys
- Relay diversity is normal
- ILP-gated relays create implicit quality floors
- Censorship resistance is a value
- Interoperability is expected

### AC8: Economics of Interaction Reference [Test: 9.0-STRUCT-007]
**Given** the `references/economics-of-interaction.md` file
**Then** it documents how ILP payment shapes social norms:
- Reactions are cheap but not free (be selective)
- Long-form content has real cost (signals investment)
- Chat messages cost per-byte (natural conciseness incentive)
- Even deletion costs (think before publishing)

### AC9: Anti-Patterns Reference [Test: 9.0-STRUCT-008]
**Given** the `references/anti-patterns.md` file
**Then** it documents these anti-patterns with descriptions and remedies:
- The Over-Reactor (reacting to everything)
- The Template Responder ("Great post!")
- The Context-Blind Engager (thumbs-up on bad news)
- The Engagement Maximizer (quantity over quality)
- The Sycophant (never disagrees)
- The Over-Explainer ("As an AI agent...")
- The Instant Responder (zero-latency engagement)

### AC10: Eval Definitions [Test: 9.0-EVAL-001]
**Given** the `evals/evals.json` file
**Then** it contains: 8-10 should-trigger queries (social-situation scenarios), 8-10 should-not-trigger queries (protocol-only questions distinguishable from `nostr-protocol-core`), and 4-6 output evals with rubric-based grading (appropriate / acceptable / inappropriate). JSON is valid and matches skill-creator eval format.

## Tasks / Subtasks

- [x] Task 1: Create skill directory structure (AC: #1)
  - [x] 1.1 Create `.claude/skills/nostr-social-intelligence/` directory
  - [x] 1.2 Create `SKILL.md` with YAML frontmatter (`name`, `description`)
  - [x] 1.3 Create `references/` subdirectory
  - [x] 1.4 Create `evals/` subdirectory
  - [x] 1.5 Verify directory layout matches skill-creator anatomy: `SKILL.md` + `references/` + `evals/`

- [x] Task 2: Author SKILL.md frontmatter and body (AC: #1, #2)
  - [x] 2.1 Write `name: nostr-social-intelligence`
  - [x] 2.2 Write `description` with explicit social-situation triggers (see Dev Notes for required trigger phrases). Target ~80-120 words for the description -- comprehensive enough to trigger on all social-situation categories but concise enough to not waste context tokens.
  - [x] 2.3 Write SKILL.md body: overview, core decision framework, when-to-read-each-reference guidance, pointers to reference files
  - [x] 2.4 Keep body under 500 lines / ~5k tokens (progressive disclosure: details go in references)
  - [x] 2.5 Use imperative/infinitive form per skill-creator writing guidelines (e.g., "Consider group size" not "You should consider group size")
  - [x] 2.6 Include explicit "When to read each reference" section in body -- Claude loads references on-demand based on SKILL.md guidance

- [x] Task 3: Author reference files (AC: #3-#9)
  - [x] 3.1 Write `references/interaction-decisions.md` -- conditional decision tree with context modifiers
  - [x] 3.2 Write `references/context-norms.md` -- behavior matrix by context type
  - [x] 3.3 Write `references/trust-signals.md` -- trust signal interpretation guide
  - [x] 3.4 Write `references/conflict-resolution.md` -- escalation ladder
  - [x] 3.5 Write `references/pseudonymous-culture.md` -- pseudonymous social norms
  - [x] 3.6 Write `references/economics-of-interaction.md` -- ILP payment social economics
  - [x] 3.7 Write `references/anti-patterns.md` -- anti-pattern catalog with remedies
  - [x] 3.8 Every reference file must explain WHY (reasoning), not just list rules (D9-008 compliance)

- [x] Task 4: Create evals (AC: #10)
  - [x] 4.1 Create `evals/evals.json` in skill-creator format: 8-10 should-trigger queries + 8-10 should-not-trigger queries + 4-6 output evals
  - [x] 4.2 Should-trigger queries must include social-situation scenarios (not just protocol questions)
  - [x] 4.3 Should-not-trigger queries must distinguish from protocol-only questions handled by `nostr-protocol-core` (Story 9.1) -- e.g., "How do I construct a kind:1 event?" should NOT trigger this skill
  - [x] 4.4 Output evals: agent presented with social scenarios, grading verifies appropriate interaction type with reasoning
  - [x] 4.5 Include `social-context-check` assertion (verifies Social Context section exists in agent output when applicable)
  - [x] 4.6 Use rubric-based grading categories: `appropriate` / `acceptable` / `inappropriate` (not binary pass/fail, per risk E9-R004)

- [x] Task 5: Quality validation (AC: all)
  - [x] 5.1 Verify SKILL.md body is under 500 lines (`wc -l` check)
  - [x] 5.2 Verify all 7 reference files exist and are non-empty
  - [x] 5.3 Verify `evals/evals.json` is valid JSON (`node -e "JSON.parse(require('fs').readFileSync('evals/evals.json','utf8'))"`)
  - [x] 5.4 Verify description field includes all 5 social-situation trigger categories from Dev Notes
  - [x] 5.5 Verify no extraneous files (no README.md, CHANGELOG.md, INSTALLATION_GUIDE.md, etc. per skill-creator guidelines)
  - [x] 5.6 Verify YAML frontmatter has ONLY `name` and `description` fields (no `license`, `version`, `author`, etc.)
  - [x] 5.7 Verify every reference file explains reasoning (WHY), not just rules (WHAT) -- spot-check for D9-008 compliance

## Dev Notes

### This Is a Skill, Not Code

This story produces markdown files and JSON, not TypeScript. There is no `pnpm build`, no `pnpm test`, no compilation step. The "test" is the eval framework (Story 9.3), which does not exist yet. For this story, validation is structural: correct files exist, correct format, correct content coverage.

### Output Directory

```
.claude/skills/nostr-social-intelligence/
├── SKILL.md                              # Required: frontmatter + body
├── references/
│   ├── interaction-decisions.md          # AC3: decision tree
│   ├── context-norms.md                  # AC4: behavior matrix
│   ├── trust-signals.md                  # AC5: trust interpretation
│   ├── conflict-resolution.md            # AC6: escalation ladder
│   ├── pseudonymous-culture.md           # AC7: pseudonymous norms
│   ├── economics-of-interaction.md       # AC8: ILP payment economics
│   └── anti-patterns.md                  # AC9: anti-pattern catalog
└── evals/
    └── evals.json                        # Skill-creator compatible eval definitions
```

### File Change Table

| File | Change | Type |
|------|--------|------|
| `.claude/skills/nostr-social-intelligence/SKILL.md` | Skill core file with frontmatter + body | create |
| `.claude/skills/nostr-social-intelligence/references/interaction-decisions.md` | Decision tree reference | create |
| `.claude/skills/nostr-social-intelligence/references/context-norms.md` | Behavior matrix reference | create |
| `.claude/skills/nostr-social-intelligence/references/trust-signals.md` | Trust signals reference | create |
| `.claude/skills/nostr-social-intelligence/references/conflict-resolution.md` | Escalation ladder reference | create |
| `.claude/skills/nostr-social-intelligence/references/pseudonymous-culture.md` | Pseudonymous norms reference | create |
| `.claude/skills/nostr-social-intelligence/references/economics-of-interaction.md` | ILP economics reference | create |
| `.claude/skills/nostr-social-intelligence/references/anti-patterns.md` | Anti-pattern catalog reference | create |
| `.claude/skills/nostr-social-intelligence/evals/evals.json` | Eval definitions | create |

### SKILL.md Format Requirements (from skill-creator)

- **Frontmatter:** YAML with ONLY `name` and `description` fields. No other frontmatter fields (`license`, `version`, `author` etc. are forbidden).
- **Description is the trigger mechanism.** Claude reads ONLY `name` + `description` to decide if the skill activates. All "when to use" information must be in the description, not the body. Target ~80-120 words.
- **Body:** Loaded only after skill triggers. Keep under 500 lines / ~5k tokens. Use imperative/infinitive form.
- **No extraneous files:** No README.md, INSTALLATION_GUIDE.md, CHANGELOG.md, QUICK_REFERENCE.md, etc.
- **References are loaded on-demand:** Claude reads reference files only when it determines they are needed. SKILL.md body must describe when to read each reference file.
- **Progressive disclosure:** Level 1 = frontmatter (~100 tokens, always loaded). Level 2 = SKILL.md body (<5k tokens, loaded on trigger). Level 3 = references (unlimited, loaded as-needed).

### Description Trigger Phrases (Must Include)

The `description` field must trigger on social-situation questions. Include these 5 trigger categories:
1. Interaction choice: "should I react", "should I comment", "should I repost", "should I reply", "what interaction type"
2. Social judgment: "what's appropriate here", "is this the right response", "how should I engage"
3. Community norms: "group etiquette", "community norms", "social conventions", "relay culture"
4. Conflict handling: "how do I handle this disagreement", "should I report", "when to mute or block"
5. TOON economics context: "does paying to post change behavior", "interaction cost", "economics of social interaction"

### Design Decision Compliance (D9-003, D9-004, D9-008)

- **D9-003 (Social intelligence is cross-cutting):** This skill handles universal social judgment. NIP-specific skills (Stories 9.4+) handle interaction-specific etiquette and add a `## Social Context` pointer back to this skill.
- **D9-004 (Economics shape social norms):** ILP paid-writes documented as a social feature, not just a technical requirement. The `references/economics-of-interaction.md` file is the canonical source for how cost shapes behavior.
- **D9-008 (Why over rules):** Explain reasoning ("TOON uses ILP for writes because..."), not rigid ALWAYS/NEVER patterns. LLMs generalize better from explained reasoning. Every reference file should explain WHY, not just list rules.

### Eval Format (skill-creator compatible)

```json
{
  "trigger_evals": [
    { "query": "Someone shared bad news in a small group, should I react?", "should_trigger": true },
    { "query": "How do I construct a kind:1 event?", "should_trigger": false }
  ],
  "output_evals": [
    {
      "id": "social-scenario-grief",
      "prompt": "A friend posted about losing a family member in a small NIP-29 group with 12 members. Several people have already reacted with heart emojis. Should I react, comment, or do something else?",
      "expected_output": "Agent should recommend a thoughtful comment expressing genuine sympathy rather than another generic reaction, reasoning about group size, emotional weight, and the diminishing value of stacked reactions.",
      "assertions": [
        "Response recommends comment over reaction",
        "Response considers group size context",
        "Response explains reasoning (why), not just action (what)"
      ]
    }
  ]
}
```

Use rubric-based grading (appropriate / acceptable / inappropriate), not binary pass/fail. Social judgment is inherently nuanced (risk E9-R004 from test design).

### Test Strategy

- **Structural validation:** Verify all files exist, frontmatter is valid YAML with only `name` + `description`, body is under 500 lines, no extraneous files.
- **Eval format validation:** `evals/evals.json` is valid JSON with correct structure (`trigger_evals` array + `output_evals` array).
- **Content coverage validation:** Spot-check that each reference file addresses its AC requirements and includes reasoning (WHY, per D9-008).
- **No automated test suite:** This story produces no TypeScript. Validation is manual/structural. Story 9.3 (eval framework) will provide automated eval execution.
- **Risk mitigation (E9-R004):** Rubric-based grading with 3 categories (appropriate / acceptable / inappropriate) prevents over-rigid or under-rigid social judgment assertions.

### Existing Skill Patterns (DO NOT REINVENT)

Reference these existing skills for format examples:
- `.claude/skills/rfc-0001-interledger-architecture/SKILL.md` -- example frontmatter structure: `name` + `description` fields only, description includes trigger phrases ("how Interledger works", "ILP architecture"), body uses numbered capability sections with concise guidance
- `.claude/skills/skill-creator/SKILL.md` -- the meta-skill that defines how skills are built. Canonical reference for progressive disclosure, writing guidelines, eval format, and skill anatomy
- `.claude/skills/playwright-cli/SKILL.md` -- example of a tool-integration skill with workflow steps

Key pattern from existing skills: descriptions are comprehensive trigger lists, bodies are concise procedural guides, references hold the depth.

### Anti-Patterns to Avoid (Dev Agent Guardrails)

- **DO NOT create README.md, CHANGELOG.md, or any file not in the Output Directory tree above.** The skill-creator explicitly forbids extraneous documentation files.
- **DO NOT add frontmatter fields beyond `name` and `description`.** No `license`, `version`, `author`, `tags`, etc.
- **DO NOT put "when to use" guidance in the body.** The body is loaded AFTER triggering. All trigger information goes in the `description` field.
- **DO NOT write rigid rules.** Per D9-008, explain reasoning. Write "Reactions on ILP-gated relays cost money, which naturally encourages selectivity" NOT "ALWAYS be selective with reactions."
- **DO NOT duplicate content between SKILL.md body and reference files.** The body should point to references, not repeat their content.
- **DO NOT include protocol mechanics (event construction, fee calculation, publishEvent API).** That is Story 9.1's domain (`nostr-protocol-core`).
- **DO NOT use `scripts/init_skill.py` or `scripts/package_skill.py`.** These are skill-creator tools for generic skill creation. This story creates files directly since the structure is fully specified.

### Cross-Story Context (Epic 9 Architecture)

- **This skill is consumed by every subsequent NIP skill** via `## Social Context` pointers. It must be stable before Phase 1 (Story 9.4) begins.
- **Story 9.1 (`nostr-protocol-core`)** is a parallel foundational skill teaching the TOON write/read model. These two skills are complementary: 9.0 = social intelligence, 9.1 = protocol mechanics.
- **Story 9.2 (`nip-to-toon-skill`)** depends on patterns established here to auto-inject social context into pipeline-generated skills.
- **Story 9.3 (eval framework)** will calibrate TOON compliance assertions using this skill as a test subject. The eval format used here must be compatible.
- **toon-protocol-context.md** (created in Story 9.1) is the protocol single-source-of-truth that all skills reference. This skill does NOT need to teach the TOON write model -- that's 9.1's job.

### What This Skill Does NOT Cover

- **Protocol mechanics** (how to construct events, fee calculation, publishEvent API) -- that's Story 9.1 (`nostr-protocol-core`)
- **NIP-specific interaction details** (how to create a NIP-29 group, how to format a long-form article) -- that's individual NIP skills (Stories 9.4+)
- **Pipeline automation** (how to convert a NIP to a skill) -- that's Story 9.2 (`nip-to-toon-skill`)
- **Eval infrastructure** (how to run evals, validate skills) -- that's Story 9.3 (eval framework)

### TOON-Specific Social Context

The economics-of-interaction reference must cover TOON-specific aspects that don't exist in vanilla Nostr:
- **Paid writes create quality floors.** Every post on a TOON relay costs money (basePricePerByte x serialized bytes). This naturally filters low-effort content.
- **Reactions are cheap but not free.** A reaction (~200 bytes) costs ~0.00002 USDC at typical rates. Still meaningful at scale.
- **Deletion costs money too.** kind:5 deletion events go through the same ILP payment path. Think before publishing.
- **Relay membership is economic proof.** Being on an ILP-gated relay means you paid to participate -- a trust signal absent from free relays.
- **Fee calculation:** `basePricePerByte * serializedEventBytes`. Discovered via kind:10032 or NIP-11 `/health` endpoint.

### Project Structure Notes

- Skill files go in `.claude/skills/nostr-social-intelligence/` (alongside existing skills like `rfc-0001-interledger-architecture/`, `skill-creator/`, `playwright-cli/`)
- This is a NEW directory creation -- no existing files to modify
- No TypeScript packages are touched by this story
- No `pnpm build` or `pnpm test` impact

### Git Intelligence

Recent commits on `epic-9` branch:
- `e909032 chore(epic-9): epic start -- baseline green, retro actions resolved`

Expected commit for this story: `feat(9-0): Social Intelligence Base Skill (nostr-social-intelligence)`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.0] -- acceptance criteria and test approach
- [Source: _bmad-output/project-context.md#NIP-to-TOON Skill Pipeline Architecture] -- pipeline design decisions
- [Source: _bmad-output/planning-artifacts/test-design-epic-9.md] -- risk E9-R004 (social intelligence eval subjectivity)
- [Source: .claude/skills/skill-creator/SKILL.md] -- skill-creator anatomy, progressive disclosure, writing guidelines
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 9 Design Decisions] -- D9-001 through D9-010

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context) — claude-opus-4-6[1m]

### Debug Log References

N/A — no TypeScript compilation or test execution required for this skill-only story.

### Completion Notes List

- **Task 1 (Directory structure):** Created `.claude/skills/nostr-social-intelligence/` with `SKILL.md`, `references/` (7 files), and `evals/` (1 file). Layout matches skill-creator anatomy exactly.
- **Task 2 (SKILL.md authoring):** Wrote YAML frontmatter with `name` and `description` only. Description is ~110 words covering all 5 required trigger categories (interaction choice, social judgment, community norms, conflict handling, TOON economics). Body is 52 lines with core decision framework, "when to read each reference" section, key principles, and integration guidance. Uses imperative form throughout.
- **Task 3 (Reference files):** Authored all 7 reference files covering interaction decisions (AC3), context norms (AC4), trust signals (AC5), conflict resolution (AC6), pseudonymous culture (AC7), economics of interaction (AC8), and anti-patterns (AC9). Every file explains WHY (reasoning) per D9-008, not just rules.
- **Task 4 (Evals):** Created `evals/evals.json` with 10 should-trigger queries, 8 should-not-trigger queries, and 5 output evals. Should-not-trigger queries are protocol-only questions distinguishable from social intelligence. Output evals use rubric-based grading (appropriate/acceptable/inappropriate) per E9-R004. All output evals include assertions array.
- **Task 5 (Quality validation):** SKILL.md is 52 lines (under 500 limit). All 7 reference files exist and are non-empty (59-82 lines each). evals.json is valid JSON. Description includes all 5 trigger categories. No extraneous files. Frontmatter has only `name` and `description`.

### Change Log

| Date | Summary |
|------|---------|
| 2026-03-24 | Initial implementation of nostr-social-intelligence skill. Created SKILL.md with progressive disclosure design, 7 reference files covering all ACs, and eval definitions with rubric-based grading. All structural validations pass. |

### File List

| File | Action |
|------|--------|
| `.claude/skills/nostr-social-intelligence/SKILL.md` | created |
| `.claude/skills/nostr-social-intelligence/references/interaction-decisions.md` | created |
| `.claude/skills/nostr-social-intelligence/references/context-norms.md` | created |
| `.claude/skills/nostr-social-intelligence/references/trust-signals.md` | created |
| `.claude/skills/nostr-social-intelligence/references/conflict-resolution.md` | created |
| `.claude/skills/nostr-social-intelligence/references/pseudonymous-culture.md` | created |
| `.claude/skills/nostr-social-intelligence/references/economics-of-interaction.md` | created |
| `.claude/skills/nostr-social-intelligence/references/anti-patterns.md` | created |
| `.claude/skills/nostr-social-intelligence/evals/evals.json` | created |
| `_bmad-output/implementation-artifacts/9-0-social-intelligence-base-skill.md` | modified |

## Code Review Record

### Review Pass #1

- **Date:** 2026-03-24
- **Reviewer model:** Claude Opus 4.6 (1M context) — claude-opus-4-6[1m]
- **Issue counts:** 0 critical, 0 high, 0 medium, 1 low
- **Low issues:**
  - Missing "should I reply" trigger phrase in SKILL.md description — fixed during review
- **Outcome:** Success — all issues resolved, skill approved for merge

### Review Pass #2

- **Date:** 2026-03-24
- **Reviewer model:** Claude Opus 4.6 (1M context) — claude-opus-4-6[1m]
- **Issue counts:** 0 critical, 0 high, 0 medium, 1 low
- **Low issues:**
  - Missing "should I comment" as standalone trigger phrase in SKILL.md description — the phrase "should I reply or comment?" did not contain the substring "should I comment" as required by the story's 5 interaction choice trigger phrases. Added "should I comment on this?" as a separate phrase. Fixed during review.
- **Outcome:** Success — all issues resolved, skill approved for merge

### Review Pass #3

- **Date:** 2026-03-24
- **Reviewer model:** Claude Opus 4.6 (1M context) — claude-opus-4-6[1m]
- **Review scope:** Full code review (structural, content, AC compliance, D9-003/D9-004/D9-008 compliance, skill-creator format, OWASP Top 10, auth/authz, injection risks, prompt injection patterns)
- **Issue counts:** 0 critical, 0 high, 0 medium, 0 low
- **Security assessment:** Not applicable — deliverable is markdown and JSON documentation only (no executable code, no auth logic, no database queries, no user input handling, no API endpoints). Semgrep scan not applicable (no code to scan). Prompt injection pattern scan: clean (no injection patterns found).
- **Structural validation:** Directory layout matches spec. SKILL.md 56 lines (under 500). Frontmatter has only `name` and `description`. evals.json valid JSON with 10 should-trigger, 8 should-not-trigger, 6 output evals. All 7 reference files present and non-empty. No extraneous files. No content duplication between SKILL.md body and references.
- **Content validation:** All 10 ACs verified. All 5 trigger categories present in description. All 7 anti-patterns documented. Escalation ladder complete. Behavior matrix covers all 5 context types. Trust signals cover all 4 required areas. Economics covers all 4 required topics. Pseudonymous culture covers all 5 required topics. D9-008 compliant (every reference explains WHY). Imperative form used consistently for instructions.
- **Outcome:** Success — no issues found, skill approved for merge
