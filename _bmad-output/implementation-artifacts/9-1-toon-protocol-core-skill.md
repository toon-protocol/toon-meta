# Story 9.1: TOON Protocol Core Skill (`nostr-protocol-core`)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **TOON agent**,
I want a foundational skill teaching TOON's NIP-01 implementation (ILP-gated writes, TOON format reads),
So that every interaction I make respects the pay-to-write, free-to-read model.

**Dependencies:** None (foundational, parallel with 9.0)

**NIPs covered:** NIP-01 (Basic Protocol) + NIP-10 (Threads) + NIP-19 (bech32 entities)

**Decision sources:**
- Party Mode 2026-03-22: NIP Skills Epic (D9-002, D9-005, D9-006, D9-008, D9-010)
- `_bmad-output/project-context.md` section "NIP-to-TOON Skill Pipeline Architecture"
- `_bmad-output/planning-artifacts/epics.md` Epic 9, Story 9.1

**Downstream dependencies:** Every NIP skill (Stories 9.4-9.34) references `nostr-protocol-core` for TOON write/read model. Story 9.2 (pipeline) uses `references/toon-protocol-context.md` from this skill as the single source of truth injected into every generated skill (D9-010). Story 9.3 (eval framework) calibrates TOON compliance assertions against this skill.

**Nature of deliverable:** This story produces a **Claude Agent Skill** (structured markdown + reference files + eval JSON), NOT TypeScript code. The output is a `.claude/skills/nostr-protocol-core/` directory following Anthropic's skill-creator format.

**Rationale:** This skill teaches the fundamental TOON protocol mechanics -- how to write events (ILP-gated via `publishEvent()`), how to read events (TOON format strings, not JSON), how to calculate fees, and how to construct threaded conversations and entity references. Without this skill, every downstream NIP skill would need to independently teach the TOON write/read model, leading to inconsistency and drift. The `toon-protocol-context.md` reference file becomes the protocol single-source-of-truth that Story 9.2's pipeline injects into every subsequently generated skill (D9-010).

## Acceptance Criteria

### AC1: SKILL.md Core File [Test: 9.1-STRUCT-001]
**Given** the `nostr-protocol-core/SKILL.md` file
**When** an agent needs to construct, send, or read Nostr events on TOON
**Then** the skill teaches TOON-first protocol with vanilla NIP-01 as baseline.

### AC2: Description Triggers on Protocol Situations [Test: 9.1-STRUCT-001]
**Given** the SKILL.md `description` field in YAML frontmatter
**Then** it triggers on protocol questions ("how do I publish an event on TOON?", "how does TOON's write model work?", "how do I calculate fees?", "how do I read events from a TOON relay?", "how do I construct a threaded reply?", "what is bech32 encoding for Nostr?", "how do I use publishEvent?", "what does NIP-01 look like on TOON?"). The description must include explicit trigger phrases for: (1) event construction and publishing, (2) fee calculation, (3) reading/subscribing, (4) threading/replies, (5) entity encoding. Target ~80-120 words.

### AC3: TOON Write Model [Test: 9.1-STRUCT-002, 9.1-EVAL-001, 9.1-TOON-001, 9.1-TOON-002]
**Given** the TOON write model section (body) and `references/toon-write-model.md` file
**Then** it documents: (1) discover pricing from kind:10032 or NIP-11 `/health`, (2) calculate fee: `basePricePerByte * serialized event bytes`, (3) send via `client.publishEvent(event, { amount })` -- NOT raw WebSocket `["EVENT", ...]`. No condition/fulfillment computation (D9-005). Includes complete ILP payment flow with code examples using `@toon-protocol/client`, including `publishEvent()` API, amount calculation, and error handling (F04 Insufficient Payment). No bare `["EVENT", ...]` patterns anywhere in skill files (9.1-TOON-001). Fee calculation referenced in write model (9.1-TOON-002).

### AC4: TOON Read Model [Test: 9.1-STRUCT-001, 9.1-EVAL-003, 9.1-TOON-003]
**Given** the TOON read model section (body) and `references/toon-read-model.md` file
**Then** it documents: standard NIP-01 subscriptions (`["REQ", <sub_id>, <filters>]`), but relay returns TOON-format strings not JSON objects. Includes subscription handling, TOON format parsing, and examples. TOON format handling documented in read model (9.1-TOON-003).

### AC5: Fee Calculation Reference [Test: 9.1-STRUCT-003, 9.1-EVAL-002, 9.1-TOON-002]
**Given** the `references/fee-calculation.md` file
**Then** it documents: kind:10032 pricing discovery, per-byte calculation (`basePricePerByte * serializedEventBytes`), amount override for DVM kinds (D7-007), kind-specific pricing via `SkillDescriptor.kindPricing`, default `basePricePerByte` = 10n (10 micro-USDC per byte = $0.00001/byte), and the bid safety cap semantic (D7-006).

### AC6: NIP-10 Threading Coverage [Test: 9.1-STRUCT-004, 9.1-EVAL-004]
**Given** NIP-10 threading coverage in a reference file
**Then** it documents `e` tags with reply markers (root, reply, mention), `p` tags for participant tracking, and thread construction patterns.

### AC7: NIP-19 Entity Encoding Coverage [Test: 9.1-STRUCT-004, 9.1-EVAL-005]
**Given** NIP-19 entity encoding coverage in a reference file
**Then** it documents bech32 npub/nsec/note/nevent/nprofile/naddr encoding/decoding.

### AC8: Social Context Section [Test: 9.1-STRUCT-005]
**Given** the `## Social Context` section in SKILL.md body
**Then** it states: "Publishing on TOON costs money. This creates a natural quality floor -- every post has skin-in-the-game. Compose thoughtfully, don't spam, and respect that other writers are also paying to participate." Includes pointer to `nostr-social-intelligence` for deeper social judgment guidance.

### AC9: Excluded NIPs Documentation [Test: 9.1-STRUCT-006]
**Given** the skill's reference files
**Then** it explicitly documents the excluded NIPs with ILP rationale (D9-006):
- NIP-13 (Proof of Work) -- ILP payment replaces PoW spam prevention
- NIP-42 (Relay Auth) -- ILP gating IS authentication
- NIP-47 (Wallet Connect) -- ILP replaces Lightning wallet integration
- NIP-57 (Zaps) -- ILP replaces Lightning zaps
- NIP-98 (HTTP Auth) -- x402 already handles this

### AC10: TOON Protocol Context Reference [Test: related to D9-010]
**Given** the `references/toon-protocol-context.md` file
**Then** it contains the single source of truth: TOON write model (no condition/fulfillment), TOON read model, transport (`@toon-protocol/client`), relay discovery (enriched NIP-11, kind:10032), social economics. This file is the canonical reference that Story 9.2's pipeline injects into every generated skill.

### AC11: Eval Definitions [Test: 9.1-EVAL-001 through 9.1-EVAL-005]
**Given** the `evals/evals.json` file
**Then** it contains: 8-10 should-trigger queries (protocol-situation scenarios), 8-10 should-not-trigger queries (social-judgment questions distinguishable from `nostr-social-intelligence`), and 4-6 output evals with rubric-based grading. JSON is valid and matches skill-creator eval format.

## Tasks / Subtasks

- [x] Task 1: Create skill directory structure (AC: #1)
  - [x] 1.1 Create `.claude/skills/nostr-protocol-core/` directory
  - [x] 1.2 Create `SKILL.md` with YAML frontmatter (`name`, `description`)
  - [x] 1.3 Create `references/` subdirectory
  - [x] 1.4 Create `evals/` subdirectory
  - [x] 1.5 Verify directory layout matches skill-creator anatomy: `SKILL.md` + `references/` + `evals/`

- [x] Task 2: Author SKILL.md frontmatter and body (AC: #1, #2, #3, #4, #8)
  - [x] 2.1 Write `name: nostr-protocol-core`
  - [x] 2.2 Write `description` with explicit protocol-situation triggers (see Dev Notes for required trigger phrases). Target ~80-120 words covering all 5 trigger categories.
  - [x] 2.3 Write SKILL.md body: TOON write model overview (publishEvent flow), TOON read model overview (TOON format), fee calculation summary, NIP-10/NIP-19 summary, when-to-read-each-reference guidance, Social Context section
  - [x] 2.4 Keep body under 500 lines / ~5k tokens (progressive disclosure: details go in references)
  - [x] 2.5 Use imperative/infinitive form per skill-creator writing guidelines (e.g., "Calculate the fee" not "You should calculate the fee")
  - [x] 2.6 Include explicit "When to read each reference" section in body

- [x] Task 3: Author reference files (AC: #3, #4, #5, #6, #7, #9, #10)
  - [x] 3.1 Write `references/toon-write-model.md` -- Complete ILP payment flow: pricing discovery (kind:10032 / NIP-11), fee calculation, `publishEvent()` API with code examples, error handling (F04), amount override (D7-007), bid safety cap (D7-006). MUST use `@toon-protocol/client` import and `publishEvent()` -- NEVER raw WebSocket `["EVENT", ...]`.
  - [x] 3.2 Write `references/toon-read-model.md` -- NIP-01 subscriptions, `["REQ", sub_id, filters]`, TOON format string responses (not JSON objects), parsing examples, filter construction.
  - [x] 3.3 Write `references/fee-calculation.md` -- kind:10032 pricing discovery, `basePricePerByte * serializedEventBytes` formula, default 10n = $0.00001/byte, amount override for DVM kinds, kind-specific pricing via SkillDescriptor.kindPricing, bid safety cap semantic, route-aware fee calculation (resolveRouteFees + calculateRouteAmount).
  - [x] 3.4 Write `references/nip10-threading.md` -- `e` tag markers (root, reply, mention), `p` tags, thread construction, reply chain patterns.
  - [x] 3.5 Write `references/nip19-entities.md` -- bech32 npub/nsec/note/nevent/nprofile/naddr encoding/decoding with examples.
  - [x] 3.6 Write `references/excluded-nips.md` -- NIP-13, NIP-42, NIP-47, NIP-57, NIP-98 with ILP rationale for each exclusion (D9-006).
  - [x] 3.7 Write `references/toon-protocol-context.md` -- THE canonical single-source-of-truth for the TOON protocol that the pipeline (Story 9.2) injects into every generated skill. Contains: TOON write model summary, TOON read model summary, transport (`@toon-protocol/client`), relay discovery (enriched NIP-11), social economics, no condition/fulfillment (D9-005).
  - [x] 3.8 Every reference file must explain WHY (reasoning), not just list rules (D9-008 compliance)

- [x] Task 4: Create evals (AC: #11)
  - [x] 4.1 Create `evals/evals.json` in skill-creator format: 8-10 should-trigger queries + 8-10 should-not-trigger queries + 4-6 output evals
  - [x] 4.2 Should-trigger queries must include protocol-situation scenarios (event construction, fee calculation, read model, threading, entity encoding)
  - [x] 4.3 Should-not-trigger queries must distinguish from social-judgment questions handled by `nostr-social-intelligence` (Story 9.0) -- e.g., "Should I react to this post?" should NOT trigger this skill
  - [x] 4.4 Output evals: agent presented with protocol scenarios, grading verifies correct use of `publishEvent()`, correct fee calculation, correct TOON format handling
  - [x] 4.5 Include TOON compliance assertions: `toon-write-check` (uses publishEvent()), `toon-fee-check` (fee calculation present), `toon-format-check` (TOON format handling)
  - [x] 4.6 Use rubric-based grading categories: `correct` / `acceptable` / `incorrect` (not binary pass/fail, per risk E9-R002)

- [x] Task 5: Quality validation (AC: all)
  - [x] 5.1 Verify SKILL.md body is under 500 lines (`wc -l` check)
  - [x] 5.2 Verify all 7 reference files exist and are non-empty
  - [x] 5.3 Verify `evals/evals.json` is valid JSON (`node -e "JSON.parse(require('fs').readFileSync('evals/evals.json','utf8'))"`)
  - [x] 5.4 Verify description field includes all 5 protocol trigger categories from Dev Notes
  - [x] 5.5 Verify no extraneous files (no README.md, CHANGELOG.md, INSTALLATION_GUIDE.md, etc. per skill-creator guidelines)
  - [x] 5.6 Verify YAML frontmatter has ONLY `name` and `description` fields (no `license`, `version`, `author`, etc.)
  - [x] 5.7 Verify every reference file explains reasoning (WHY), not just rules (WHAT) -- spot-check for D9-008 compliance
  - [x] 5.8 Verify NO bare `["EVENT", ...]` patterns in any skill file (9.1-TOON-001)
  - [x] 5.9 Verify `toon-protocol-context.md` is self-contained enough for pipeline injection (D9-010)

## Dev Notes

### This Is a Skill, Not Code

This story produces markdown files and JSON, not TypeScript. There is no `pnpm build`, no `pnpm test`, no compilation step. The "test" is the eval framework (Story 9.3), which does not exist yet. For this story, validation is structural: correct files exist, correct format, correct content coverage.

### Output Directory

```
.claude/skills/nostr-protocol-core/
├── SKILL.md                              # Required: frontmatter + body
├── references/
│   ├── toon-write-model.md              # AC3: complete ILP write flow
│   ├── toon-read-model.md               # AC4: subscription + TOON format
│   ├── fee-calculation.md               # AC5: pricing discovery + calculation
│   ├── nip10-threading.md               # AC6: e-tag markers, thread construction
│   ├── nip19-entities.md                # AC7: bech32 encoding/decoding
│   ├── excluded-nips.md                 # AC9: NIP-13/42/47/57/98 with ILP rationale
│   └── toon-protocol-context.md         # AC10: canonical protocol context for pipeline
└── evals/
    └── evals.json                        # Skill-creator compatible eval definitions
```

### File Change Table

| File | Change | Type |
|------|--------|------|
| `.claude/skills/nostr-protocol-core/SKILL.md` | Skill core file with frontmatter + body | create |
| `.claude/skills/nostr-protocol-core/references/toon-write-model.md` | ILP write flow reference | create |
| `.claude/skills/nostr-protocol-core/references/toon-read-model.md` | Read model reference | create |
| `.claude/skills/nostr-protocol-core/references/fee-calculation.md` | Fee calculation reference | create |
| `.claude/skills/nostr-protocol-core/references/nip10-threading.md` | NIP-10 threading reference | create |
| `.claude/skills/nostr-protocol-core/references/nip19-entities.md` | NIP-19 entities reference | create |
| `.claude/skills/nostr-protocol-core/references/excluded-nips.md` | Excluded NIPs reference | create |
| `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` | Canonical protocol context | create |
| `.claude/skills/nostr-protocol-core/evals/evals.json` | Eval definitions | create |

### SKILL.md Format Requirements (from skill-creator)

- **Frontmatter:** YAML with ONLY `name` and `description` fields. No other frontmatter fields (`license`, `version`, `author` etc. are forbidden).
- **Description is the trigger mechanism.** Claude reads ONLY `name` + `description` to decide if the skill activates. All "when to use" information must be in the description, not the body. Target ~80-120 words.
- **Body:** Loaded only after skill triggers. Keep under 500 lines / ~5k tokens. Use imperative/infinitive form.
- **No extraneous files:** No README.md, INSTALLATION_GUIDE.md, CHANGELOG.md, QUICK_REFERENCE.md, etc.
- **References are loaded on-demand:** Claude reads reference files only when it determines they are needed. SKILL.md body must describe when to read each reference file.
- **Progressive disclosure:** Level 1 = frontmatter (~100 tokens, always loaded). Level 2 = SKILL.md body (<5k tokens, loaded on trigger). Level 3 = references (unlimited, loaded as-needed).

### Description Trigger Phrases (Must Include)

The `description` field must trigger on protocol questions. Include these 5 trigger categories:
1. Event construction/publishing: "how do I publish an event", "how to send an event on TOON", "publishEvent", "how to write to a TOON relay"
2. Fee calculation: "how much does it cost", "calculate fees", "basePricePerByte", "pricing on TOON"
3. Reading/subscribing: "how to read events", "subscribe to events", "TOON format", "how to query a relay"
4. Threading/replies: "threaded replies", "NIP-10", "reply to an event", "e-tag markers"
5. Entity encoding: "bech32", "NIP-19", "npub", "nevent", "nprofile"

### TOON Write Model Technical Details (from project-context.md)

The dev agent MUST use these exact technical details:

**API:** `client.publishEvent(event, { destination, amount?, bid? })`
- `amount`: overrides `basePricePerByte * bytes` calculation (prepaid model, D7-007)
- `bid`: client-side safety cap -- throws if destination amount exceeds bid (D7-006)
- Route fees from `resolveRouteFees()` are added automatically on top (Story 7.5)

**Fee formula:** `totalAmount = basePricePerByte * packetByteLength + SUM(hopFees[i] * bytes)`
- Default `basePricePerByte` = 10n = 10 micro-USDC per byte = $0.00001/byte
- Amounts are in USDC micro-units (6 decimals)

**Pricing discovery:**
- kind:10032 events from peers include `basePricePerByte` and `feePerByte`
- NIP-11 `/health` endpoint returns enriched info including pricing, capabilities, chain config

**Error handling:**
- F04 = Insufficient Payment (amount too low for payload size)
- No condition/fulfillment computation on client side (D9-005)

**Transport:** `@toon-protocol/client` -- NOT the SDK. The SDK (`createNode()`, handler registry) is for providers only. Agents send events via the client's `publishEvent()`.

### TOON Read Model Technical Details (from project-context.md)

- Standard NIP-01 subscriptions: `["REQ", <sub_id>, <filter1>, ...]`
- Relay returns TOON-format strings in EVENT messages, NOT JSON objects
- TOON format is 1.x (critical for relay compatibility)
- Parse TOON strings accordingly -- do not assume standard JSON Nostr event format

### NIP-10 Threading Technical Details

- `e` tags with positional markers: root (first `e` tag), reply (last `e` tag), mention (intermediate `e` tags)
- `p` tags for tracking all participants in a thread
- Thread construction: include root event reference + direct parent reference + mentions

### NIP-19 Entity Technical Details

- bech32 encoding for human-readable entity references
- `npub` = public key, `nsec` = secret key (NEVER share), `note` = event ID
- `nevent` = event with relay hints, `nprofile` = pubkey with relay hints, `naddr` = parameterized replaceable event

### Design Decision Compliance

- **D9-002 (TOON-first, NIP-compatible):** Teach TOON protocol first (`publishEvent()`, TOON format reads). Reference vanilla NIP-01 as baseline but emphasize TOON differences.
- **D9-005 (No condition/fulfillment):** Simplified write model. No SHA-256 double-hash computation on client side. Just `publishEvent(event, { amount })`.
- **D9-006 (No ILP-peer NIPs):** Excluded NIPs documented with rationale. Agents encountering references to NIP-13/42/47/57/98 should understand these functions are handled by ILP.
- **D9-008 (Why over rules):** Explain reasoning, not rigid patterns. Write "TOON uses ILP for writes because payment prevents spam and creates quality floors" NOT "ALWAYS use publishEvent()".
- **D9-010 (Protocol changes propagate):** `toon-protocol-context.md` is THE single source of truth. When protocol changes, update this one file. The pipeline (Story 9.2) injects it into every skill.

### Eval Format (skill-creator compatible)

```json
{
  "trigger_evals": [
    { "query": "How do I publish a kind:1 event on a TOON relay?", "should_trigger": true },
    { "query": "Should I react to this post or comment on it?", "should_trigger": false }
  ],
  "output_evals": [
    {
      "id": "write-model-basic",
      "prompt": "I want to publish a short text note to a TOON relay. The relay's basePricePerByte is 10 micro-USDC. My note serializes to 250 bytes. How do I send it?",
      "expected_output": "Agent should use client.publishEvent(event, { destination, amount: 2500n }) with the correct fee calculation (10 * 250 = 2500 micro-USDC). Must NOT use raw WebSocket ['EVENT', ...]. Should reference @toon-protocol/client.",
      "assertions": [
        "Response uses publishEvent() API",
        "Response includes correct fee calculation",
        "Response does NOT use raw WebSocket EVENT pattern",
        "Response references @toon-protocol/client"
      ]
    }
  ]
}
```

### Anti-Patterns to Avoid (Dev Agent Guardrails)

- **DO NOT create README.md, CHANGELOG.md, or any file not in the Output Directory tree above.** The skill-creator explicitly forbids extraneous documentation files.
- **DO NOT add frontmatter fields beyond `name` and `description`.** No `license`, `version`, `author`, `tags`, etc.
- **DO NOT put "when to use" guidance in the body.** The body is loaded AFTER triggering. All trigger information goes in the `description` field.
- **DO NOT write bare `["EVENT", ...]` patterns anywhere.** Always use `publishEvent()` from `@toon-protocol/client`. This is the single most important TOON compliance check (9.1-TOON-001).
- **DO NOT duplicate content between SKILL.md body and reference files.** The body should point to references, not repeat their content.
- **DO NOT include social judgment guidance (interaction choice, community norms, conflict resolution).** That is Story 9.0's domain (`nostr-social-intelligence`). This skill handles protocol mechanics.
- **DO NOT use `scripts/init_skill.py` or `scripts/package_skill.py`.** These are skill-creator tools for generic skill creation. This story creates files directly since the structure is fully specified.
- **DO NOT confuse the SDK with the client.** The SDK (`createNode()`, `HandlerRegistry`) is for service node PROVIDERS. The client (`publishEvent()`) is for agents sending events. This skill teaches agents, so use the client.

### Cross-Story Context (Epic 9 Architecture)

- **This skill is consumed by every subsequent NIP skill** via protocol context references. It must be stable before Phase 1 (Story 9.4) begins.
- **Story 9.0 (`nostr-social-intelligence`)** is a parallel foundational skill teaching social judgment. These two skills are complementary: 9.0 = social intelligence, 9.1 = protocol mechanics.
- **Story 9.2 (`nip-to-toon-skill`)** depends on `toon-protocol-context.md` from this skill as the canonical reference injected into every pipeline-generated skill.
- **Story 9.3 (eval framework)** will calibrate TOON compliance assertions using this skill as a test subject. The eval format used here must be compatible.
- **Risk E9-R003 (TOON format drift):** If skills teach vanilla Nostr instead of TOON, agents break on real relays. This skill's write/read model documentation is the defense against this risk.
- **Risk E9-R008 (Fee calculation inconsistency):** If different skills teach different fee formulas, agents overpay or underpay. The `fee-calculation.md` reference is the canonical source.
- **Risk E9-R013 (Excluded NIP confusion):** Agents may encounter references to excluded NIPs. The `excluded-nips.md` reference explains what ILP handles instead.

### What This Skill Does NOT Cover

- **Social judgment** (when to engage, community norms, conflict resolution) -- that's Story 9.0 (`nostr-social-intelligence`)
- **NIP-specific interaction details** (how to create a NIP-29 group, how to format a long-form article) -- that's individual NIP skills (Stories 9.4+)
- **Pipeline automation** (how to convert a NIP to a skill) -- that's Story 9.2 (`nip-to-toon-skill`)
- **Eval infrastructure** (how to run evals, validate skills) -- that's Story 9.3 (eval framework)
- **Provider-side SDK** (createNode(), handler registry, packet processing pipeline) -- that's for service node operators, not agents

### Existing Skill Patterns (DO NOT REINVENT)

Reference these existing skills for format examples:
- `.claude/skills/nostr-social-intelligence/SKILL.md` -- sister skill (Story 9.0). Example of: YAML frontmatter with only `name` + `description`, comprehensive trigger phrases in description (~110 words), body under 60 lines, "When to read each reference" section, Social Context section, imperative form.
- `.claude/skills/skill-creator/SKILL.md` -- the meta-skill that defines how skills are built. Canonical reference for progressive disclosure, writing guidelines, eval format, and skill anatomy.
- `.claude/skills/rfc-0001-interledger-architecture/SKILL.md` -- example of a protocol-knowledge skill with technical depth.

Key pattern from existing skills: descriptions are comprehensive trigger lists, bodies are concise procedural guides, references hold the depth.

### Previous Story Intelligence (Story 9.0)

Story 9.0 (`nostr-social-intelligence`) was completed successfully. Key learnings:
- **Frontmatter strictness:** ONLY `name` and `description` fields. Review pass #1 caught a missing trigger phrase; review pass #2 caught another. Be thorough with all 5 trigger categories from the start.
- **File structure:** Exactly the files specified in the output directory tree. No extras (no README, no CHANGELOG).
- **Eval format:** `trigger_evals` array + `output_evals` array. Should-trigger and should-not-trigger must be clearly distinguishable between this skill and `nostr-social-intelligence`. E.g., "How do I construct a kind:1 event?" triggers this skill (protocol), "Should I react to this post?" triggers social intelligence.
- **Body size:** Story 9.0's SKILL.md body was 52 lines. Keep under 500 lines but aim for similar conciseness.
- **D9-008 compliance:** Every reference file must explain WHY, not just list rules.
- **Expected commit pattern:** `feat(9-1): TOON Protocol Core Skill -- SKILL.md, N references, evals, structural tests`

### Git Intelligence

Recent commits on `epic-9` branch:
- `0d7a748 feat(9-0): Social Intelligence Base Skill -- SKILL.md, 7 references, evals, structural tests`
- `e909032 chore(epic-9): epic start -- baseline green, retro actions resolved`

Expected commit for this story: `feat(9-1): TOON Protocol Core Skill (nostr-protocol-core)`

### Project Structure Notes

- Skill files go in `.claude/skills/nostr-protocol-core/` (alongside existing skills like `nostr-social-intelligence/`, `rfc-0001-interledger-architecture/`, `skill-creator/`, `playwright-cli/`)
- This is a NEW directory creation -- no existing files to modify
- No TypeScript packages are touched by this story
- No `pnpm build` or `pnpm test` impact

### Test Strategy

- **Structural validation:** Verify all files exist, frontmatter is valid YAML with only `name` + `description`, body is under 500 lines, no extraneous files, no bare `["EVENT", ...]` patterns. Includes 9.1-STRUCT-001 (directory layout), 9.1-STRUCT-002 (write model references publishEvent), 9.1-STRUCT-003 (fee calculation formula), 9.1-STRUCT-004 (NIP-10/NIP-19 coverage), 9.1-STRUCT-005 (Social Context section exists with required text and pointer to nostr-social-intelligence), 9.1-STRUCT-006 (excluded NIPs documented with ILP rationale for NIP-13/42/47/57/98).
- **Eval format validation:** `evals/evals.json` is valid JSON with correct structure (`trigger_evals` array + `output_evals` array).
- **Content coverage validation:** Spot-check that each reference file addresses its AC requirements and includes reasoning (WHY, per D9-008).
- **TOON compliance checks:** 9.1-TOON-001 `toon-write-check` (no bare `["EVENT", ...]` patterns in any skill file), 9.1-TOON-002 `toon-fee-check` (fee calculation referenced in write model), 9.1-TOON-003 `toon-format-check` (TOON format handling documented in read model).
- **No automated test suite:** This story produces no TypeScript. Validation is manual/structural. Story 9.3 (eval framework) will provide automated eval execution.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.1] -- acceptance criteria and test approach
- [Source: _bmad-output/project-context.md#NIP-to-TOON Skill Pipeline Architecture] -- pipeline design decisions
- [Source: _bmad-output/project-context.md#@toon-protocol/client API] -- publishEvent() signature and semantics
- [Source: _bmad-output/planning-artifacts/test-design-epic-9.md#Story 9.1] -- test IDs and risk links
- [Source: .claude/skills/skill-creator/SKILL.md] -- skill-creator anatomy, progressive disclosure, writing guidelines
- [Source: .claude/skills/nostr-social-intelligence/SKILL.md] -- sister skill format reference
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 9 Design Decisions] -- D9-001 through D9-010

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context) — claude-opus-4-6[1m]

### Debug Log References

None — no TypeScript compilation or test execution (skill-only deliverable).

### Completion Notes List

- **Task 1 (Directory structure):** Created `.claude/skills/nostr-protocol-core/` with `SKILL.md`, `references/` (7 files), and `evals/` (1 file). Verified layout matches skill-creator anatomy.
- **Task 2 (SKILL.md frontmatter + body):** Authored YAML frontmatter with only `name` and `description` fields. Description is 88 words covering all 5 trigger categories. Body is 51 lines with write model summary, read model summary, fee calculation summary, "When to read each reference" section, Social Context section (exact required text + pointer to nostr-social-intelligence), and integration notes. Imperative form used throughout.
- **Task 3 (Reference files):** Authored all 7 reference files. Each explains WHY (reasoning per D9-008), not just rules. toon-write-model.md uses publishEvent() from @toon-protocol/client exclusively (no raw WebSocket). fee-calculation.md covers kind:10032 discovery, per-byte formula, route-aware calculation (resolveRouteFees + calculateRouteAmount), DVM amount override (D7-007), kindPricing, and bid safety cap (D7-006). toon-protocol-context.md is self-contained for pipeline injection (D9-010). excluded-nips.md covers all 5 excluded NIPs with ILP rationale.
- **Task 4 (Evals):** Created evals.json with 10 should-trigger queries, 8 should-not-trigger queries, and 5 output evals with rubric-based grading (correct/acceptable/incorrect). TOON compliance assertions included: toon-write-check, toon-fee-check, toon-format-check.
- **Task 5 (Validation):** SKILL.md body = 51 lines (under 500). All 7 references exist and non-empty. evals.json valid JSON. Description has all 5 trigger categories. No extraneous files. YAML frontmatter has ONLY name + description. D9-008 WHY reasoning verified in reference files. No bare ["EVENT", ...] write patterns (two contextual references are anti-pattern warning and read-model format illustration). toon-protocol-context.md self-contained for D9-010.

### Change Log

- 2026-03-24: Created nostr-protocol-core skill — SKILL.md, 7 reference files, evals.json. All structural validations pass. Story marked complete.

### File List

- `.claude/skills/nostr-protocol-core/SKILL.md` — created
- `.claude/skills/nostr-protocol-core/references/toon-write-model.md` — created
- `.claude/skills/nostr-protocol-core/references/toon-read-model.md` — created
- `.claude/skills/nostr-protocol-core/references/fee-calculation.md` — created
- `.claude/skills/nostr-protocol-core/references/nip10-threading.md` — created
- `.claude/skills/nostr-protocol-core/references/nip19-entities.md` — created
- `.claude/skills/nostr-protocol-core/references/excluded-nips.md` — created
- `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` — created
- `.claude/skills/nostr-protocol-core/evals/evals.json` — created
- `_bmad-output/implementation-artifacts/9-1-toon-protocol-core-skill.md` — modified (status + dev agent record)

## Code Review Record

### Review Pass #1

- **Date:** 2026-03-24
- **Reviewer model:** Claude Opus 4.6 (1M context)
- **Severity counts:** Critical: 0, High: 0, Medium: 0, Low: 1
- **Outcome:** Pass with minor fix applied

#### Findings

| # | Severity | File | Issue | Resolution |
|---|----------|------|-------|------------|
| 1 | Low | `references/toon-write-model.md` | Code example used `encodeEvent`/`decodeEvent` which don't exist as named exports | Fixed to `encodeEventToToon`/`decodeEventFromToon` |

#### Review Follow-ups

None — all findings resolved during review pass.

### Review Pass #2

- **Date:** 2026-03-24
- **Reviewer model:** Claude Opus 4.6 (1M context) — bmad-bmm-code-review
- **Severity counts:** Critical: 0, High: 0, Medium: 0, Low: 0
- **Outcome:** Pass — no issues found

#### Review Methodology

Full structural and content review against acceptance criteria, source code verification, and TOON compliance checks:

1. **Structural validation:** Verified all 9 files exist in correct directory layout (SKILL.md + 7 references + evals.json). No extraneous files. YAML frontmatter has ONLY `name` and `description`. Body is 51 lines (under 500 limit). Description is 88 words (within 80-120 target).
2. **Source code verification:** Cross-referenced `publishEvent()` API signature, `ToonClient` constructor config, `encodeEventToToon`/`decodeEventFromToon` imports, `resolveRouteFees`/`calculateRouteAmount` exports, `@toon-format/toon` `decode` export, and error codes (`MISSING_CLAIM`, `NO_BTP_CLIENT`, F04) against actual TypeScript source in `packages/client/src/ToonClient.ts`, `packages/client/src/types.ts`, `packages/core/src/toon/`, and `packages/core/src/fee/`. All match.
3. **TOON compliance:** No bare `["EVENT", ...]` write patterns found in any skill file (9.1-TOON-001). Fee calculation formula present in write model and fee-calculation reference (9.1-TOON-002). TOON format handling documented in read model (9.1-TOON-003).
4. **Eval validation:** evals.json is valid JSON with 10 should-trigger, 8 should-not-trigger, 5 output evals with rubric-based grading (correct/acceptable/incorrect).
5. **Test suite:** All 91 structural tests pass (`packages/core/src/skills/nostr-protocol-core.test.ts`).
6. **Content accuracy:** All 5 description trigger categories present. Social Context section has exact required text plus pointer to `nostr-social-intelligence`. All 5 excluded NIPs documented with ILP rationale. D9-008 WHY reasoning present in reference files. `toon-protocol-context.md` is self-contained for pipeline injection (D9-010).

#### Findings

None.

#### Review Follow-ups

None — clean pass.

### Review Pass #3

- **Date:** 2026-03-24
- **Reviewer model:** Claude Opus 4.6 (1M context) — bmad-bmm-code-review (yolo mode + security)
- **Severity counts:** Critical: 0, High: 0, Medium: 0, Low: 0
- **Outcome:** Pass — no issues found

#### Review Methodology

Full independent review with security audit (OWASP top 10, auth/authz flaws, injection risks):

1. **Source code cross-reference:** Verified all API signatures, imports, and exports against actual TypeScript source:
   - `publishEvent(event, { destination?, claim? })` matches `ToonClient.ts:223-225`
   - `signBalanceProof(channelId, amount)` matches `ToonClient.ts:303-313`
   - `encodeEventToToon`/`decodeEventFromToon` confirmed as named exports from `@toon-protocol/relay` (`relay/src/index.ts:29-34`)
   - `decode` confirmed as export from `@toon-format/toon` (npm package verified)
   - `resolveRouteFees`/`calculateRouteAmount` confirmed in `packages/core/src/fee/`
   - `ToonClientConfig` fields (`connectorUrl`, `secretKey`, `ilpInfo`, `toonEncoder`, `toonDecoder`, `btpUrl`, `relayUrl`) all match `packages/client/src/types.ts`
   - Error codes `MISSING_CLAIM`, `NO_BTP_CLIENT`, F04 all verified in source
2. **Structural validation:** 9 files in correct layout, no extraneous files, YAML frontmatter has only `name` + `description`, body is 51 lines, 10 should-trigger + 8 should-not-trigger + 5 output evals with rubric grading.
3. **TOON compliance:** No bare `["EVENT"` write patterns. Fee calculation referenced in write model. TOON format handling documented in read model.
4. **Test suite:** All 91 structural tests pass.
5. **Security audit (OWASP):**
   - Injection risks: N/A — deliverable is markdown/JSON skill content, not executable code
   - Authentication/Authorization: Correctly teaches ILP-gated writes (auth by payment); correctly excludes NIP-42/NIP-98 with rationale
   - Sensitive data exposure: `nip19-entities.md` includes strong warning about nsec keys ("Never share, log, or transmit an nsec"); no hardcoded secrets or credentials in any file
   - Security misconfiguration: No risky defaults; code examples use placeholder values
   - Semgrep scan: Not applicable to markdown/JSON files; attempted scan confirmed no findings
6. **Content accuracy:** All acceptance criteria verified. D9-008 WHY reasoning present in all 7 reference files.

#### Findings

None.

#### Review Follow-ups

None — clean pass.
