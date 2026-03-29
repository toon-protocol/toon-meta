---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
lastStep: 'step-04-generate-tests'
lastSaved: '2026-03-27'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/9-10-public-chat-skill.md'
  - '.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh'
  - '.claude/skills/skill-eval-framework/scripts/run-eval.sh'
  - 'tests/skills/test-moderated-communities-skill.sh'
---

# ATDD Checklist - Epic 9, Story 9.10: Public Chat Skill

**Date:** 2026-03-27
**Author:** Jonathan
**Primary Test Level:** Shell script structural + content validation (no TypeScript, no Playwright)

---

## Story Summary

Story 9.10 produces a Claude Agent Skill for real-time public chat participation on TOON Protocol. The skill covers NIP-28 public chat -- channel creation (kind:40), channel metadata updates (kind:41), channel messages (kind:42), hide message (kind:43), and mute user (kind:44) -- teaching agents the open, real-time chat model and its TOON economic dynamics (per-byte pricing creates conciseness incentive).

**As a** TOON agent
**I want** a skill teaching real-time public chat participation
**So that** I can participate in chat channels on TOON relays

---

## Acceptance Criteria

1. **AC1: Pipeline Production** -- Produces complete `public-chat` skill directory with SKILL.md, references/, evals/
2. **AC2: NIP Coverage** -- Covers NIP-28 channel creation (kind:40), channel metadata (kind:41), channel messages (kind:42), hide message (kind:43), mute user (kind:44), channel discovery, reply threading
3. **AC3: TOON Write Model** -- publishEvent() for channel creation/messages/metadata/moderation, per-byte cost, conciseness incentive, spam resistance
4. **AC4: TOON Read Model** -- TOON-format strings, channel discovery via kind:40 subscriptions, message subscriptions via #e tag filters, metadata validation against channel creator
5. **AC5: Social Context** -- Chat-specific social guidance: conciseness from per-byte pricing, real-time norms, channel purpose, personal moderation tools, distinction from NIP-29 groups and NIP-72 communities
6. **AC6: Eval Suite** -- 8-10 should-trigger, 8-10 should-not-trigger, 4-6 output evals with rubric and assertions
7. **AC7: TOON Compliance Passing** -- All 6 named TOON compliance assertions pass
8. **AC8: Description Optimization** -- 80-120 words, trigger phrases for NIP-28/public chat/channel/kind:40-44/message/hide/mute terms
9. **AC9: Token Budget** -- Body under 500 lines and ~5k tokens
10. **AC10: Dependency References** -- References nostr-protocol-core, nostr-social-intelligence, social-interactions, content-references, relay-groups, moderated-communities
11. **AC11: With/Without Baseline** -- Agent with skill produces better chat responses than without

---

## AC-to-Test Mapping

| Test ID | AC | Priority | What It Validates |
|---------|-----|----------|-------------------|
| STRUCT-A | AC1 | P0 | SKILL.md exists with valid YAML frontmatter (name + description only) |
| STRUCT-B | AC1 | P0 | references/ directory with nip-spec.md, toon-extensions.md, scenarios.md |
| STRUCT-B2 | AC1 | P0 | evals/evals.json exists and is valid JSON |
| STRUCT-C | AC9 | P0 | Body under 500 lines |
| STRUCT-D | AC5 | P0 | Social Context section exists with >= 30 words |
| AC1-NAME | AC1 | P0 | Skill name in frontmatter is "public-chat" |
| EVAL-A | AC2 | P0 | SKILL.md covers NIP-28, channel, chat, e tag |
| EVAL-B | AC2 | P0 | nip-spec.md covers NIP-28 and event kinds |
| AC2-NIP28 | AC2 | P0 | SKILL.md mentions NIP-28 |
| AC2-CHANNEL-CREATE | AC2 | P0 | Channel creation covered |
| AC2-KINDS-40 | AC2 | P0 | kind:40 channel creation covered |
| AC2-KINDS-41 | AC2 | P0 | kind:41 channel metadata covered |
| AC2-KINDS-42 | AC2 | P0 | kind:42 channel message covered |
| AC2-KINDS-43 | AC2 | P0 | kind:43 hide message covered |
| AC2-KINDS-44 | AC2 | P0 | kind:44 mute user covered |
| AC2-ETAG | AC2 | P0 | e tag for channel reference covered |
| AC2-JSON-CONTENT | AC2 | P0 | JSON content in channel creation (name/about/picture) covered |
| AC2-TOONEXT | AC2 | P0 | toon-extensions.md covers ILP/per-byte costs |
| AC2-SCENARIOS | AC2 | P0 | scenarios.md covers step-by-step workflows |
| AC2-CHANNEL-DISCOVER | AC2 | P0 | Channel discovery via kind:40 subscriptions covered |
| AC2-REPLY-THREADING | AC2 | P0 | Reply threading in channel messages covered |
| TOON-A | AC3, AC7 | P0 | publishEvent referenced across skill files |
| TOON-B | AC3, AC7 | P0 | Fee/cost terms referenced across skill files |
| AC3-CLIENT | AC3 | P0 | References publishEvent() from @toon-protocol/client |
| AC3-FEEREF | AC3 | P0 | References fee/cost in SKILL.md |
| AC3-MSG-COST | AC3 | P0 | Explains channel messages (kind:42) cost per-byte |
| AC3-CHANNEL-COST | AC3 | P0 | Explains channel creation (kind:40) costs per-byte |
| AC3-MODERATION-COST | AC3 | P0 | Explains hide/mute events cost per-byte |
| AC3-CONCISENESS | AC3 | P0 | Explains conciseness incentive from per-byte pricing |
| AC3-COREREF | AC3 | P0 | References nostr-protocol-core for fee formula |
| TOON-C | AC4, AC7 | P0 | TOON-format referenced across skill files |
| AC4-FORMAT | AC4 | P0 | SKILL.md references TOON-format |
| AC4-CHANNEL-SUBSCRIBE | AC4 | P0 | Explains subscribing to kind:40 for channel discovery |
| AC4-MSG-SUBSCRIBE | AC4 | P0 | Explains subscribing to messages via #e tag filter |
| AC4-METADATA-VALIDATE | AC4 | P0 | Explains validating kind:41 against channel creator |
| AC4-READREF | AC4 | P0 | References nostr-protocol-core for TOON format |
| TOON-D | AC5 | P1 | Social Context >= 100 words of chat-specific content |
| AC5-CONCISENESS | AC5 | P1 | Covers conciseness incentive from per-byte pricing |
| AC5-REALTIME | AC5 | P1 | Covers real-time conversational norms |
| AC5-CHANNEL-PURPOSE | AC5 | P1 | Covers channel purpose/description (read before participating) |
| AC5-MODERATION-TOOLS | AC5 | P1 | Covers hide/mute as personal moderation tools |
| AC5-DISTINGUISH-GROUPS | AC5 | P1 | Distinguishes NIP-28 from NIP-29 relay groups |
| AC5-DISTINGUISH-COMMUNITIES | AC5 | P1 | Distinguishes NIP-28 from NIP-72 moderated communities |
| AC5-SUBST | AC5 | P1 | Passes NIP-name substitution test (>= 5 chat-specific terms) |
| EVAL-A2 | AC6 | P0 | >= 8 should-trigger queries |
| EVAL-B2 | AC6 | P0 | >= 8 should-not-trigger queries |
| EVAL-C | AC6 | P0 | >= 4 output evals |
| AC6-RUBRIC | AC6 | P0 | All output evals have rubric (correct/acceptable/incorrect) |
| AC6-TOON-ASSERT | AC6 | P0 | TOON compliance assertions in output evals |
| AC6-TRIGGER-QUERIES | AC6 | P0 | Should-trigger queries cover >= 5/9 chat-relevant terms |
| AC6-NOTTRIGGER-QUERIES | AC6 | P0 | Should-not-trigger queries exclude >= 4/8 unrelated topics |
| AC6-EXPECTED-OPT | AC6 | P0 | All output evals have expected_output field |
| AC6-OUTPUT-ID | AC6 | P0 | All output evals have id and prompt fields |
| AC6-OUTPUT-ASSERT | AC6 | P0 | All output evals have assertions array |
| AC6-OUTPUT-RANGE | AC6 | P0 | Output eval count is 4-6 |
| TOON-ALL-1 | AC7 | P0 | validate-skill.sh passes (structural) |
| TOON-ALL-2 | AC7 | P0 | run-eval.sh passes (TOON compliance) |
| AC7-NAMED-ASSERTIONS | AC7 | P0 | run-eval.sh covers all 6 named TOON assertions |
| AC7-EVAL-ASSERTIONS | AC7 | P0 | Write evals have 5 assertions; read evals have 3 |
| AC8-STRICT-RANGE | AC8 | P1 | Description is 80-120 words |
| AC8-TRIGPHRASES | AC8 | P1 | Description includes >= 8/17 trigger phrases |
| AC8-SOCIAL-PHRASES | AC8 | P1 | Description includes social-situation triggers |
| AC8-CHAT-PHRASES | AC8 | P1 | Description includes >= 2/5 chat-specific phrases |
| TRIG-A | AC8 | P1 | Protocol-technical triggers in description |
| TRIG-B | AC8 | P1 | Social/user-facing triggers in description |
| AC9-TOKENS | AC9 | P1 | Body approximately 5k tokens or fewer (~3500 words max) |
| DEP-A | AC10 | P1 | References nostr-protocol-core |
| DEP-B | AC10 | P1 | References nostr-social-intelligence |
| DEP-C | AC10 | P1 | References social-interactions |
| DEP-D | AC10 | P1 | References content-references |
| DEP-E | AC10 | P1 | References relay-groups |
| DEP-F | AC10 | P1 | References moderated-communities |
| AC10-NODUP | AC10 | P1 | No duplicate toon-protocol-context.md in references/ |
| AC10-DEP-ALL | AC10 | P1 | References all six upstream skills |
| CLEAN-A | AC1 | P0 | No extraneous .md files in skill root |
| BASE-A | AC11 | P2 | With/without baseline (manual, skipped) |

---

## Gap-Fill Tests (NIP-28-specific detail coverage)

| Test ID | AC | Priority | What It Validates |
|---------|-----|----------|-------------------|
| AC2-ROOT-MARKER | AC2 | P0 | nip-spec.md covers root marker for channel reference in kind:42 |
| AC2-REPLY-MARKER | AC2 | P0 | nip-spec.md covers reply marker for message threading in kind:42 |
| AC2-PTAG-REPLY | AC2 | P0 | nip-spec.md covers p tag for replied-to user in kind:42 |
| AC2-HIDE-REASON | AC2 | P0 | nip-spec.md covers optional reason in hide message (kind:43) |
| AC2-MUTE-REASON | AC2 | P0 | nip-spec.md covers optional reason in mute user (kind:44) |
| AC2-METADATA-AUTHOR-CHECK | AC2 | P0 | kind:41 author must match kind:40 creator |
| AC3-SPAM-RESISTANCE | AC3 | P0 | Spam resistance from per-byte pricing covered |
| AC4-METADATA-OVERRIDE | AC4 | P0 | kind:41 metadata overriding kind:40 metadata covered |

---

## Failing Tests Created (RED Phase)

### Shell Script Tests (84 tests)

**File:** `tests/skills/test-public-chat-skill.sh` (~870 lines)

All 84 tests organized into 13 sections:

- **Structural Tests (P0):** STRUCT-A, STRUCT-B, STRUCT-B2, STRUCT-C, STRUCT-D, AC1-NAME
  - Status: RED -- skill directory does not exist yet
  - Verifies: directory structure, frontmatter, references, evals, body size, social context section

- **Content Tests -- NIP Coverage (P0):** EVAL-A, EVAL-B, AC2-NIP28, AC2-CHANNEL-CREATE, AC2-KINDS-40, AC2-KINDS-41, AC2-KINDS-42, AC2-KINDS-43, AC2-KINDS-44, AC2-ETAG, AC2-JSON-CONTENT, AC2-TOONEXT, AC2-SCENARIOS, AC2-CHANNEL-DISCOVER, AC2-REPLY-THREADING
  - Status: RED -- no skill files to search
  - Verifies: NIP-28 coverage, event kinds (40/41/42/43/44), e tag, JSON content, channel discovery, reply threading

- **TOON Write Model Tests (P0):** TOON-A, TOON-B, AC3-CLIENT, AC3-FEEREF, AC3-MSG-COST, AC3-CHANNEL-COST, AC3-MODERATION-COST, AC3-CONCISENESS, AC3-COREREF
  - Status: RED -- no publishEvent, fee, or conciseness references
  - Verifies: TOON write model completeness, publishEvent() from @toon-protocol/client, fee awareness, conciseness incentive

- **TOON Read Model Tests (P0):** TOON-C, AC4-FORMAT, AC4-CHANNEL-SUBSCRIBE, AC4-MSG-SUBSCRIBE, AC4-METADATA-VALIDATE, AC4-READREF
  - Status: RED -- no TOON-format or subscription references
  - Verifies: TOON-format parsing, channel discovery subscriptions, message subscriptions via #e tag, metadata validation

- **Social Context Tests (P1):** TOON-D, AC5-CONCISENESS, AC5-REALTIME, AC5-CHANNEL-PURPOSE, AC5-MODERATION-TOOLS, AC5-DISTINGUISH-GROUPS, AC5-DISTINGUISH-COMMUNITIES, AC5-SUBST
  - Status: RED -- no Social Context section
  - Verifies: chat-specific social guidance covering conciseness, real-time norms, channel purpose, personal moderation, NIP-29/NIP-72 distinction

- **Eval Suite Tests (P0):** EVAL-A2, EVAL-B2, EVAL-C, AC6-RUBRIC, AC6-TOON-ASSERT, AC6-TRIGGER-QUERIES, AC6-NOTTRIGGER-QUERIES, AC6-EXPECTED-OPT, AC6-OUTPUT-ID, AC6-OUTPUT-ASSERT, AC6-OUTPUT-RANGE
  - Status: RED -- evals/evals.json does not exist
  - Verifies: trigger eval counts, output eval structure, rubric, TOON assertions, trigger term coverage

- **TOON Compliance Integration Tests (P0):** TOON-ALL-1, TOON-ALL-2
  - Status: RED -- validate-skill.sh and run-eval.sh fail
  - Verifies: end-to-end structural validation + TOON compliance assertion pass

- **Description Optimization Tests (P1):** AC8-STRICT-RANGE, AC8-TRIGPHRASES, AC8-SOCIAL-PHRASES, AC8-CHAT-PHRASES, TRIG-A, TRIG-B
  - Status: RED -- no description to extract
  - Verifies: word count range (80-120), trigger phrase coverage, social-situation triggers, chat-specific phrases

- **Token Budget Tests (P1):** AC9-TOKENS
  - Status: RED -- no body to measure
  - Verifies: body under ~5k tokens (~3500 words)

- **Dependency Reference Tests (P1):** DEP-A, DEP-B, DEP-C, DEP-D, DEP-E, DEP-F, AC10-NODUP, AC10-DEP-ALL
  - Status: RED (except AC10-NODUP vacuously passes) -- no SKILL.md
  - Verifies: six upstream skill references, no duplicate toon-protocol-context.md

- **Cleanliness Test (P0):** CLEAN-A
  - Status: RED -- skill directory not found
  - Verifies: no extraneous .md files in skill root

- **TOON Compliance Named Assertions (P0):** AC7-NAMED-ASSERTIONS, AC7-EVAL-ASSERTIONS
  - Status: RED -- run-eval.sh finds 0/6 assertions
  - Verifies: all 6 named TOON compliance assertions checked

- **Gap-Fill Tests (NIP-28 detail):** AC2-ROOT-MARKER, AC2-REPLY-MARKER, AC2-PTAG-REPLY, AC2-HIDE-REASON, AC2-MUTE-REASON, AC2-METADATA-AUTHOR-CHECK, AC3-SPAM-RESISTANCE, AC4-METADATA-OVERRIDE
  - Status: RED -- no skill files to search
  - Verifies: NIP-28-specific tag formats (root/reply markers, p tags, reason fields), metadata author check, spam resistance

- **With/Without Baseline (P2):** BASE-A
  - Status: SKIPPED -- requires manual pipeline Step 8
  - Verifies: skill adds measurable value over baseline agent

---

## Data Factories Created

Not applicable -- this story produces a Claude Agent Skill (markdown + JSON), not TypeScript code. No data factories needed.

---

## Fixtures Created

Not applicable -- shell script tests operate on filesystem checks (file existence, grep, awk, node JSON parsing). No fixtures needed.

---

## Mock Requirements

Not applicable -- tests validate static file content, not external service interactions.

---

## Required data-testid Attributes

Not applicable -- no UI components in this story.

---

## Implementation Checklist

### Test: STRUCT-A through AC1-NAME (Structural)

**File:** `tests/skills/test-public-chat-skill.sh`

**Tasks to make these tests pass:**

- [ ] Create `.claude/skills/public-chat/` directory
- [ ] Create `SKILL.md` with YAML frontmatter (`name: public-chat`, `description: ...`)
- [ ] Create `references/nip-spec.md`, `references/toon-extensions.md`, `references/scenarios.md`
- [ ] Create `evals/evals.json` as valid JSON
- [ ] Ensure SKILL.md body is under 500 lines
- [ ] Ensure `## Social Context` section exists with >= 30 words
- [ ] Run test: `bash tests/skills/test-public-chat-skill.sh`

---

### Test: EVAL-A through AC2-REPLY-THREADING (NIP Coverage)

**File:** `tests/skills/test-public-chat-skill.sh`

**Tasks to make these tests pass:**

- [ ] Write SKILL.md body covering NIP-28, channel creation (kind:40 with name/about/picture JSON), channel metadata (kind:41 with e tag), channel messages (kind:42 with e tag root marker and optional reply marker + p tag), hide message (kind:43 with e tag + optional reason), mute user (kind:44 with p tag + optional reason)
- [ ] Include e tag references for channel identification
- [ ] Write nip-spec.md covering NIP-28 spec details, event kinds 40-44, tag formats
- [ ] Write toon-extensions.md covering ILP/per-byte costs and conciseness incentive
- [ ] Write scenarios.md with step-by-step chat participation workflows
- [ ] Cover channel discovery (kind:40 subscriptions) and reply threading (root + reply markers)
- [ ] Run test: `bash tests/skills/test-public-chat-skill.sh`

---

### Test: TOON-A through AC3-COREREF (Write Model)

**File:** `tests/skills/test-public-chat-skill.sh`

**Tasks to make these tests pass:**

- [ ] Reference `publishEvent()` from `@toon-protocol/client` in SKILL.md
- [ ] Include fee/cost terms (per-byte, basePricePerByte)
- [ ] Explain channel messages (kind:42) cost per-byte -- every message costs money
- [ ] Explain channel creation (kind:40) costs per-byte
- [ ] Explain hide/mute moderation actions (kind:43/44) cost per-byte
- [ ] Explain conciseness incentive from per-byte pricing
- [ ] Reference `nostr-protocol-core` for fee formula details
- [ ] Run test: `bash tests/skills/test-public-chat-skill.sh`

---

### Test: TOON-C through AC4-READREF (Read Model)

**File:** `tests/skills/test-public-chat-skill.sh`

**Tasks to make these tests pass:**

- [ ] Reference TOON-format strings in SKILL.md
- [ ] Explain subscribing to kind:40 for channel discovery
- [ ] Explain subscribing to kind:42 messages via #e tag filters referencing channel event
- [ ] Explain validating kind:41 metadata updates against kind:40 channel creator
- [ ] Reference `nostr-protocol-core`/`toon-protocol-context` for TOON format details
- [ ] Run test: `bash tests/skills/test-public-chat-skill.sh`

---

### Test: TOON-D through AC5-SUBST (Social Context)

**File:** `tests/skills/test-public-chat-skill.sh`

**Tasks to make these tests pass:**

- [ ] Write `## Social Context` section with >= 100 words
- [ ] Cover conciseness incentive (per-byte cost encourages saying more with fewer words)
- [ ] Cover real-time conversational norms (concise, on-topic, no flooding)
- [ ] Cover channel purpose (read about field before participating)
- [ ] Cover hide/mute as personal moderation tools (not global censorship)
- [ ] Distinguish NIP-28 public chat from NIP-29 relay groups
- [ ] Distinguish NIP-28 public chat from NIP-72 moderated communities
- [ ] Include >= 5 chat-specific terms (passes substitution test)
- [ ] Run test: `bash tests/skills/test-public-chat-skill.sh`

---

### Test: EVAL-A2 through AC6-OUTPUT-RANGE (Eval Suite)

**File:** `tests/skills/test-public-chat-skill.sh`

**Tasks to make these tests pass:**

- [ ] Create `evals/evals.json` with >= 8 should-trigger queries covering chat terms
- [ ] Include >= 8 should-not-trigger queries excluding unrelated topics (profile, group, community, article, encrypt, follow, file, search)
- [ ] Include 4-6 output evals with id, prompt, expected_output, rubric, assertions
- [ ] Rubric must have correct/acceptable/incorrect for each output eval
- [ ] Include TOON compliance assertions in output eval assertions
- [ ] Run test: `bash tests/skills/test-public-chat-skill.sh`

---

### Test: TOON-ALL-1, TOON-ALL-2, AC7-NAMED-ASSERTIONS, AC7-EVAL-ASSERTIONS (Compliance)

**File:** `tests/skills/test-public-chat-skill.sh`

**Tasks to make these tests pass:**

- [ ] Ensure validate-skill.sh passes all 11 structural checks
- [ ] Ensure run-eval.sh passes all 6 TOON compliance assertions
- [ ] Run test: `bash tests/skills/test-public-chat-skill.sh`

---

### Test: AC8-* and TRIG-* (Description Optimization)

**File:** `tests/skills/test-public-chat-skill.sh`

**Tasks to make these tests pass:**

- [ ] Write description with 80-120 words
- [ ] Include >= 8/17 trigger phrases (NIP-28, public chat, channel creation, kind:40, channel metadata, kind:41, channel message, kind:42, hide message, kind:43, mute user, kind:44, chat channel, real-time chat, send message, create channel, channel moderation)
- [ ] Include social-situation triggers ("how do I...", "how to...")
- [ ] Include >= 2/5 chat-specific phrases (chat channel, send message, create channel, channel moderation, real-time)
- [ ] Run test: `bash tests/skills/test-public-chat-skill.sh`

---

### Test: DEP-A through AC10-DEP-ALL (Dependency References)

**File:** `tests/skills/test-public-chat-skill.sh`

**Tasks to make these tests pass:**

- [ ] Reference `nostr-protocol-core` in SKILL.md
- [ ] Reference `nostr-social-intelligence` in SKILL.md
- [ ] Reference `social-interactions` in SKILL.md
- [ ] Reference `content-references` in SKILL.md
- [ ] Reference `relay-groups` in SKILL.md
- [ ] Reference `moderated-communities` in SKILL.md
- [ ] Do NOT create `references/toon-protocol-context.md` (no duplication)
- [ ] Run test: `bash tests/skills/test-public-chat-skill.sh`

---

### Test: CLEAN-A (Cleanliness)

**File:** `tests/skills/test-public-chat-skill.sh`

**Tasks to make this test pass:**

- [ ] Ensure no extraneous .md files in `.claude/skills/public-chat/` root (only SKILL.md)
- [ ] Run test: `bash tests/skills/test-public-chat-skill.sh`

---

### Test: Gap-Fill (NIP-28 Detail Coverage)

**File:** `tests/skills/test-public-chat-skill.sh`

**Tasks to make these tests pass:**

- [ ] Cover root marker in nip-spec.md for kind:42 e tag channel reference
- [ ] Cover reply marker in nip-spec.md for kind:42 e tag message threading
- [ ] Cover p tag for replied-to user in nip-spec.md
- [ ] Cover optional reason field in hide message (kind:43) in nip-spec.md
- [ ] Cover optional reason field in mute user (kind:44) in nip-spec.md
- [ ] Cover kind:41 author must match kind:40 creator validation
- [ ] Cover spam resistance from per-byte pricing in toon-extensions.md
- [ ] Cover kind:41 metadata overriding kind:40 metadata
- [ ] Run test: `bash tests/skills/test-public-chat-skill.sh`

---

## Running Tests

```bash
# Run all failing tests for this story
bash tests/skills/test-public-chat-skill.sh

# Run with verbose output (default -- all output shown)
bash tests/skills/test-public-chat-skill.sh 2>&1 | tee /tmp/test-9-10-output.txt

# Run structural validation only (upstream script)
bash .claude/skills/nip-to-toon-skill/scripts/validate-skill.sh .claude/skills/public-chat

# Run TOON compliance validation only (upstream script)
bash .claude/skills/skill-eval-framework/scripts/run-eval.sh .claude/skills/public-chat
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 84 tests written (83 automated + 1 skipped)
- Test file created at `tests/skills/test-public-chat-skill.sh`
- All automated tests verified failing (1 passes vacuously: AC10-NODUP)
- Implementation checklist created mapping tests to tasks

**Verification:**

- All tests run and fail as expected
- Failure messages are clear and actionable
- Tests fail due to missing skill implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. Run the `nip-to-toon-skill` pipeline with NIP-28 as input
2. Create the skill directory structure
3. Author SKILL.md with frontmatter, body, and Social Context section
4. Author reference files (nip-spec.md, toon-extensions.md, scenarios.md)
5. Create evals/evals.json
6. Run `bash tests/skills/test-public-chat-skill.sh` after each major change
7. Iterate until all tests pass

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

1. Verify all tests pass
2. Run description optimization pass (ensure trigger coverage)
3. Verify token budget compliance
4. Run validate-skill.sh and run-eval.sh independently
5. Verify no content duplication with upstream skills

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow
2. **Run failing tests** to confirm RED phase: `bash tests/skills/test-public-chat-skill.sh`
3. **Begin implementation** using the `nip-to-toon-skill` pipeline
4. **Work section by section** (structural first, then content, then evals)
5. **When all tests pass**, verify with upstream validation scripts
6. **When complete**, commit with: `feat(9-10): Public Chat Skill -- NIP-28, kind:40-44, conciseness incentive, 84 tests`

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **test-moderated-communities-skill.sh** -- Pattern reference for shell-based skill validation (Story 9.9, 82 tests)
- **validate-skill.sh** -- Upstream structural validation (11 checks)
- **run-eval.sh** -- Upstream TOON compliance validation (6 assertions)
- **9-10-public-chat-skill.md** -- Story spec with 11 acceptance criteria, 6 tasks, detailed dev notes
- **test-design-epic-9.md** -- Epic-level test design with standard validation template

---

## Key Differences from Story 9.9 (Moderated Communities)

- **Six upstream dependencies** instead of five: adds `moderated-communities` reference (AC10, DEP-F) since 9.10 must distinguish public chat from BOTH relay groups (NIP-29) AND moderated communities (NIP-72)
- **Conciseness incentive** is the key economic dynamic (vs double-friction model for NIP-72): per-byte chat costs naturally encourage saying more with fewer words
- **Five event kinds** (40-44) instead of three community kinds: channel creation, metadata, messages, hide, mute
- **Root/reply marker tags** in kind:42 messages: NIP-28-specific e tag markers for channel reference and message threading
- **Personal moderation** (kind:43/44) vs admin moderation (NIP-29) vs approval-based moderation (NIP-72): three distinct moderation models
- **Spam resistance** test (AC3-SPAM-RESISTANCE): per-byte pricing makes automated chat spam economically unfeasible
- **Real-time norms** test (AC5-REALTIME): chat-specific social guidance absent from community/group skills

---

## Notes

- This story produces a Claude Agent Skill (markdown + JSON), not TypeScript. All tests are shell-based file/content validation.
- Test count is 84 (83 automated + 1 skipped), slightly above the 9.9 test count (82). Additional NIP-28-specific tests (root/reply markers, p tags, reason fields, spam resistance, metadata override) offset the removal of NIP-72-specific tests (uppercase tags, cross-posting, backward compat, double-friction, d tag, moderator p tags, JSON-encoded approval, NIP-09 deletion).
- AC10-NODUP passes vacuously in RED phase because the skill directory doesn't exist yet. It will remain passing after implementation if no toon-protocol-context.md is duplicated.
- BASE-A (with/without baseline) is skipped because it requires manual execution of pipeline Step 8 (parallel subagent comparison).
- The key conceptual distinction is: NIP-28 public chat (open, real-time, conversational) vs NIP-29 relay groups (membership-enforced, structured) vs NIP-72 moderated communities (approval-based, curated). Tests AC5-DISTINGUISH-GROUPS and AC5-DISTINGUISH-COMMUNITIES specifically validate these distinctions.

---

**Generated by BMad TEA Agent** - 2026-03-27
