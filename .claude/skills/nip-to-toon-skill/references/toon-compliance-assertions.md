# TOON Compliance Assertions

> **Why compliance assertions exist:** A NIP skill that teaches vanilla Nostr patterns on TOON is actively harmful — events sent without ILP payment are rejected, and agents parsing TOON-format strings as JSON will break. These 5 assertions catch the most common pipeline defects before they propagate to downstream skills. Every assertion exists because a real failure mode was identified.

## The 5 Assertion Templates

### 1. `toon-write-check` (write-capable NIPs only)

**What it checks:** The generated skill instructs agents to use `publishEvent()` from `@toon-protocol/client` for writing events, NOT bare WebSocket EVENT array patterns.

**Why this matters:** TOON relays reject events without ILP payment. Any skill that teaches raw WebSocket writes produces agents that cannot publish. This is the single most common failure in vanilla NIP-to-skill conversion.

**When it applies:** Write-capable and both classifications only. Read-only NIPs do not publish events.

**Pass criteria:** The skill's SKILL.md body or references mention `publishEvent()` for writing this NIP's event kinds. No bare EVENT array patterns appear in any markdown file.

**Fail criteria:** The skill shows raw WebSocket EVENT patterns, references `relay.send()`, or omits the publishing mechanism entirely.

**Assertion text for evals:** `"toon-write-check: Response uses publishEvent() API, not raw WebSocket"`

### 2. `toon-fee-check` (write-capable NIPs only)

**What it checks:** The generated skill includes fee awareness — either explicit fee calculation or a reference to `nostr-protocol-core`'s fee calculation details.

**Why this matters:** Agents that publish without understanding fees will either overpay (wasting funds) or underpay (getting F04 rejections). Fee awareness is not optional on a paid network.

**When it applies:** Write-capable and both classifications only.

**Pass criteria:** The skill mentions `basePricePerByte`, references fee calculation, or includes approximate cost for this NIP's typical payload size.

**Fail criteria:** The skill describes publishing without any mention of cost, pricing, or fee calculation.

**Assertion text for evals:** `"toon-fee-check: Response includes fee calculation or cost awareness"`

### 3. `toon-format-check` (read-capable NIPs only)

**What it checks:** The generated skill documents that TOON relays return TOON-format strings in EVENT messages, not standard JSON objects.

**Why this matters:** Agents that expect JSON event objects from TOON relays will fail to parse responses. The TOON format is a fundamental protocol difference that every read-capable skill must surface.

**When it applies:** Read-capable and both classifications only. Write-only NIPs (if any exist) do not read responses.

**Pass criteria:** The skill mentions TOON-format strings, references `@toon-format/toon` decoder, or notes that relay responses differ from standard Nostr.

**Fail criteria:** The skill describes reading events without mentioning TOON format, or assumes standard JSON responses.

**Assertion text for evals:** `"toon-format-check: Response mentions TOON-format strings in relay responses"`

### 4. `social-context-check` (all NIPs)

**What it checks:** The generated skill has a `## Social Context` section that is specific to the NIP's interaction type, not a generic placeholder.

**Why this matters:** Social context is the bridge between protocol mechanics and appropriate behavior. A generic "be respectful" section provides no actionable guidance and signals the pipeline skipped the social context generation step.

**When it applies:** All classifications.

**Pass criteria:** The skill has a `## Social Context` section. The section mentions the specific NIP's interaction type (e.g., "reactions", "long-form articles", "group messages"). The section would NOT make sense if the NIP name were replaced with a different NIP.

**Fail criteria:** No `## Social Context` section exists. Or the section is generic enough to apply to any NIP (fails the substitution test from social-context-template.md).

**Assertion text for evals:** `"social-context-check: Skill has NIP-specific Social Context section"`

### 5. `trigger-coverage` (all NIPs)

**What it checks:** The skill's `description` field includes social-situation triggers, not just protocol-technical triggers.

**Why this matters:** Protocol-technical triggers ("create a kind:7 event") activate the skill for developers. Social-situation triggers ("should I react to this post?") activate it for agents operating in social contexts. Missing social triggers means the skill fails to activate in the most common agent scenarios.

**When it applies:** All classifications.

**Pass criteria:** The description includes both protocol-technical trigger phrases (event kinds, NIP numbers) AND social-situation trigger phrases (when/should/appropriate questions).

**Fail criteria:** The description contains only protocol-technical triggers, or only social-situation triggers.

**Assertion text for evals:** `"trigger-coverage: Description includes both protocol-technical and social-situation triggers"`

## Assertion Injection Rules

Based on NIP classification, inject these assertions into every output eval:

| Classification | Assertions Injected |
|---------------|-------------------|
| Read-only | `toon-format-check`, `social-context-check`, `trigger-coverage` |
| Write-capable | `toon-write-check`, `toon-fee-check`, `social-context-check`, `trigger-coverage` |
| Both | All 5 assertions |

## Using Assertions in Evals

Add assertion text to each output eval's `assertions` array. Example for a write-capable NIP:

```json
{
  "assertions": [
    "toon-write-check: Response uses publishEvent() API, not raw WebSocket",
    "toon-fee-check: Response includes fee calculation or cost awareness",
    "social-context-check: Skill has NIP-specific Social Context section",
    "trigger-coverage: Description includes both protocol-technical and social-situation triggers",
    "Response correctly classifies the NIP as write-capable"
  ]
}
```

The first four are TOON compliance assertions (auto-injected). The fifth is a skill-specific assertion (manually authored in Step 5).
