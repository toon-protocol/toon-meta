# TOON Compliance Assertions

> **Why compliance assertions exist:** A NIP skill that teaches vanilla Nostr patterns on TOON is actively harmful — a write sent without a covering claim is rejected, and an agent told to run a relay's `EVENT` messages through a TOON decoder cannot read the network at all. These 5 assertions catch the most common pipeline defects before they propagate to downstream skills. Every assertion exists because a real failure mode was identified.
>
> The automated counterpart lives in `skill-eval-framework/references/toon-compliance-runner.md`, which adds a sixth (`eval-completeness`). The two files must agree; that one is the executable spec.

## The 5 Assertion Templates

### 1. `toon-write-check` (write-capable NIPs only)

**What it checks:** The generated skill instructs agents to construct and sign the event and then hand it to `client.send()` from `@toon-protocol/client`, NOT bare WebSocket EVENT array patterns.

**Why this matters:** The relay app contains no payment code; the connector in front of it terminates payment and refuses a write that arrives without a covering claim. Any skill that teaches raw WebSocket writes points the agent past that connector, producing agents that cannot publish. Just as damaging: a skill that names a method the client does not have. `publishEvent()` and a caller-facing `signBalanceProof()` **do not exist** — a skill teaching them teaches an agent to call nothing. `send()` seals the payload, reads the route's price, mints the covering claim and carries it; a caller never signs a claim by hand and never builds an ILP packet.

**When it applies:** Write-capable and both classifications only. Read-only NIPs do not publish events.

**Pass criteria:** The skill's SKILL.md body or references show `client.send({ body: signedEvent })` (optionally with a leading destination string) for writing this NIP's event kinds. No bare EVENT array patterns appear in any markdown file.

**Fail criteria:** The skill shows raw WebSocket EVENT patterns, references `relay.send()`, names the retired `publishEvent()` or `signBalanceProof()`, hand-rolls an ILP packet, or omits the publishing mechanism entirely.

**Assertion text for evals:** `"toon-write-check: Response uses client.send() from @toon-protocol/client, not raw WebSocket or the retired publishEvent()"`

### 2. `toon-fee-check` (write-capable NIPs only)

**What it checks:** The generated skill is cost-aware in the way the protocol actually allows — it lets the client price the packet, or asks the route for its price. It must NOT teach an agent to compute a charge itself.

**Why this matters:** A price belongs to a terminated route and is a schedule over payload length: flat when it has no slope, otherwise `price + pricePerKib * ceil(sealedBytes / 1024)`. The metered quantity is the **sealed** payload — the gift-wrapped bytes the PREPARE carries — not the event JSON, which is smaller by the envelope and the wrap. An agent therefore cannot correctly compute a charge from the event it wrote, and any skill teaching byte arithmetic teaches underpayment (`F03 INVALID_AMOUNT`). The stable assertion id keeps the word "fee" for compatibility with every skill already emitted; what it grades is the route **price**.

**When it applies:** Write-capable and both classifications only.

**Pass criteria:** The skill either states that `send()` prices the packet itself, or shows `await client.routePrice(destination)` → `{ price, pricePerKib? }` followed by `chargeFor(terms, sealedBytes)` where a price is genuinely needed up front. Naming the live cost of this NIP's destination route also passes — a Nostr event to `g.toon.relay` costs 1 base unit of 6-decimal USDC, flat.

**Fail criteria:** The skill multiplies bytes by a rate, mentions the retired `basePricePerByte` or `feePerByte`, describes a "per-byte price", counts the event JSON's own length as the metered quantity, or describes publishing with no mention of cost at all.

**Assertion text for evals:** `"toon-fee-check: Response lets the client price the packet or reads routePrice()/chargeFor(); does not compute a charge from the event's own byte count"`

### 3. `toon-read-check` (read-capable NIPs only)

> **Renamed.** This assertion was `toon-format-check`, and it asserted the opposite of the truth: that relay responses are TOON-encoded. Both the name and the meaning are inverted. A generated skill still carrying `toon-format-check` predates this correction and must be regenerated.

**What it checks:** The generated skill documents that reads are free and speak plain NIP-01, and does NOT claim relay responses are TOON-encoded.

**Why this matters:** The relay's reads are free and speak plain NIP-01. It returns standard JSON `EVENT` messages — any ordinary Nostr client can read it with no decoder and no TOON awareness, and the relay contains no payment code at all. A free read never touches a connector. A skill that tells an agent to decode relay responses produces an agent that cannot read the network.

TOON encoding is real, but it is not there. TOON is the encoding of the **write payload** — an agreement between a client and an app about the bytes the connector carries **sealed** inside the ILP packet. **TOON on the way in, plain NIP-01 JSON on the way out.**

**When it applies:** Read-capable and both classifications only. Write-only NIPs (if any exist) do not read responses.

**Pass criteria:** The skill states that reads are free and speak plain NIP-01. No file calls relay responses TOON-format strings, and none tells the agent to parse an `EVENT` message with `@toon-format/toon` — a read never needs decoding.

**Fail criteria:** The skill claims relay responses are TOON-encoded, reaches for a TOON decoder on a subscription (a read never needs one), or describes reading without noting that reads are free.

**Assertion text for evals:** `"toon-read-check: Response reads over plain NIP-01 and does not claim relay responses are TOON-encoded"`

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
| Read-only | `toon-read-check`, `social-context-check`, `trigger-coverage` |
| Write-capable | `toon-write-check`, `toon-fee-check`, `social-context-check`, `trigger-coverage` |
| Both | All 5 assertions |

## Using Assertions in Evals

Add assertion text to each output eval's `assertions` array. Example for a write-capable NIP:

```json
{
  "assertions": [
    "toon-write-check: Response uses client.send() from @toon-protocol/client, not raw WebSocket or the retired publishEvent()",
    "toon-fee-check: Response lets the client price the packet or reads routePrice()/chargeFor(); does not compute a charge from the event's own byte count",
    "social-context-check: Skill has NIP-specific Social Context section",
    "trigger-coverage: Description includes both protocol-technical and social-situation triggers",
    "Response correctly classifies the NIP as write-capable"
  ]
}
```

The first four are TOON compliance assertions (auto-injected). The fifth is a skill-specific assertion (manually authored in Step 5).
