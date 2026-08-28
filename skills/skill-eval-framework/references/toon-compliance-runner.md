# TOON Compliance Runner

> **Why automated compliance checking exists:** Manual review of TOON compliance is slow and inconsistent. A reviewer might catch that a skill uses raw WebSocket patterns but miss that the skill invents a price instead of asking the node for one. Automated checks enforce the same 6 assertions every time, at the same strictness level, in seconds. This is the quality gate that prevents defective skills from reaching agents on the TOON network.

## The 6 TOON Compliance Assertions

These assertions are the automated counterpart to the 5 assertions defined in `nip-to-toon-skill/references/toon-compliance-assertions.md`, plus one new assertion (`eval-completeness`) added by this framework. Assertion 3 was renamed from `toon-format-check` to `toon-read-check` and its meaning inverted; that file must be updated to match.

### Classification Detection

Before running assertions, classify the skill:

1. **Write-capable detection:** Search SKILL.md and all files in `references/` for `client.send(`, `routePrice`, `chargeFor`, or the retired `publishEvent` / `signBalanceProof` (case-sensitive). If found, the skill is write-capable. The retired names are in the list on purpose: a skill that still teaches them must be classified write-capable so it *fails* assertion 1, rather than being skipped as a non-write skill.
2. **Read-capable detection:** Search SKILL.md and all files in `references/` for `NIP-01`, `REQ`, `EOSE`, `subscribe`, `subscription`, `free to read` or `reads are free` (case-insensitive). If found, the skill is read-capable. Detection deliberately does **not** key on the phrase "TOON format": relay reads are plain NIP-01, so that phrase is a symptom of the defect this assertion exists to catch, not a marker of a read-capable skill.
3. **Both:** If both patterns are detected, classify as "both."
4. **Neither:** If neither pattern is detected, classify as "general" -- only universal assertions apply.

**Why classification matters:** Write-only skills do not need format checks. Read-only skills do not need price checks. Applying irrelevant assertions produces false failures.

### Assertion 1: `toon-write-check` (write-capable only)

**What to check:** The skill teaches agents to use `client.send()` from `@toon-protocol/client`, does NOT contain bare EVENT array patterns that would bypass payment, and does NOT name a client API that was removed.

**How to check:**
1. Search all `.md` files in the skill directory for `client.send(`. Must appear at least once.
2. Search all `.md` files for bare WebSocket EVENT array patterns (opening bracket + quote + EVENT keyword). Must NOT appear.
3. Search all `.md` files for `publishEvent` and `signBalanceProof`. Must NOT appear, except on a line that explicitly marks the name removed (a line also containing `removed`, `retired`, `no longer`, `not exist`, `deleted` or `never`).

**Pass criteria:** `client.send(` found AND no bare EVENT array pattern found AND no live reference to a removed API.

**Fail criteria:** `client.send(` missing OR bare EVENT array pattern found OR a removed API — `publishEvent`, `signBalanceProof` — referenced as though it were callable.

**Why this matters:** `publishEvent()` and a caller-facing `signBalanceProof()` do not exist. A skill naming them tells an agent to call nothing. The real write path is one call — `await client.send({ body: signedEvent })` — and `send()` is what seals the payload, prices it, mints the covering claim and carries it. A caller never signs a claim by hand and never builds an ILP packet. A skill that teaches raw WebSocket EVENT sending produces agents that cannot write on TOON at all. This is the single most critical compliance check.

### Assertion 2: `toon-fee-check` (write-capable only)

**What to check:** The skill teaches the agent to **ask the node what a route costs**, and does not invent a rate of its own.

**How to check:**
1. Search all `.md` files for any of: `routePrice`, `chargeFor`, `GET /ilp`, `self-description`, `greeting`. At least one must appear.
2. Search all `.md` files for `basePricePerByte`, `feePerByte`, `per-byte` or `per byte`. None may appear, except on a line that explicitly marks the term removed (a line also containing `removed`, `retired`, `no longer`, `not exist`, `deleted` or `never`).

**Pass criteria:** At least one price-discovery term found AND the skill never states a per-byte rate.

**Fail criteria:** No price-discovery term found, OR the skill states a per-byte rate, which never exists on TOON.

**Why this matters:** A per-byte price never existed on TOON, and the unit is a kibibyte, not a byte. A **fee** is flat per packet and belongs to the peering (ADR 0061). A **price** belongs to a terminated route and is a schedule over payload length (ADR 0065): flat when it has no slope, otherwise `price + pricePerKib * ceil(sealedBytes / 1024)`. The metered quantity is the **sealed** payload the PREPARE carries, not the event JSON — which is smaller by the envelope and the wrap — so an agent *cannot* correctly compute a charge from the event it wrote. The only correct move is `await client.routePrice(destination)` for `{ price, pricePerKib? }`, then `chargeFor(terms, sealedBytes)`. `chargeFor` is the only thing that should decide what goes on a claim. An agent that multiplies bytes by a rate it made up underpays and gets `F03` INVALID_AMOUNT back — as `{ fulfilled: false }`, never as a thrown error.

### Assertion 3: `toon-read-check` (read-capable only)

> **Renamed, and both keys are live.** This assertion was `toon-format-check`, and as written it asserted the opposite of the truth: that relay responses are TOON-encoded. Entries whose text made that claim were renamed to `toon-read-check` with the canonical text
>
> `toon-read-check: Response reads over plain NIP-01 and does not claim relay responses are TOON-encoded`
>
> Entries that were merely *named* for the old scheme but stated something accurate -- base64 overhead, SHA-1 hex conversion, event-kind distinctions -- deliberately keep the `toon-format-check` key. Both keys therefore appear across the skill set on purpose, and `grade-output.py` grades them identically: it strips the prefix before matching.

**What to check:** The skill documents the read model, and does NOT claim that relay responses are TOON-encoded.

**How to check:**
1. **Presence** (unchanged in shape from the old `toon-format-check`): search all `.md` files for any of `plain NIP-01`, `reads are free`, `free to read`, `free read`, `TOON-format`, `TOON format` (case-insensitive). At least one must appear. A TOON-encoding reference still counts here, because it is legitimate when it is about the sealed write payload; step 2 is what separates the two uses.
2. **Negative guard** (new, and the mechanical half): search all `.md` files for `TOON decoder`, `TOON-format string`, `TOON format string`, `TOON-encoded response`, `decode … TOON-format`, or `TOON-format … EVENT message`. None may appear, except on a line that explicitly marks the claim false (a line also containing `not`, `never`, `false`, `removed`, `retired` or `no decoding`).

**Pass criteria:** The read model is documented AND nothing claims relay responses are TOON-encoded.

**Fail criteria:** No read-model statement at all, OR the skill tells an agent to decode relay responses with a TOON decoder, which is never correct.

**Why the negative guard exists:** a presence-only grep is satisfied by either the true statement or the false one, so it cannot stop the false read model drifting back in. This guard puts that claim on the same mechanical footing as a removed API: a skill asserting it fails the gate rather than passing it.

**Why this matters:** The relay's reads are free and speak plain NIP-01. It returns standard JSON `EVENT` messages, and any ordinary Nostr client can read it — `relay/README.md` opens with exactly that, and adds that the relay itself contains no payment code at all. A free read never touches a connector. A skill that tells an agent to run relay responses through a TOON decoder produces an agent that cannot read the network at all.

TOON encoding is real, but it is not there. TOON is the encoding of the **write payload** — an agreement between a client and an app about the bytes the connector carries **sealed** inside the ILP packet. TOON on the way in; plain NIP-01 JSON on the way out.

### Assertion 4: `social-context-check` (all skills)

**What to check:** The skill has a `## Social Context` section that is specific to the skill's domain.

**How to check:**
1. Search SKILL.md for a line starting with `## Social Context`.
2. Count the words in the Social Context section (from the heading to the next `##` heading or end of file).
3. The section must have at least 30 words to be considered non-trivial.

**Pass criteria:** `## Social Context` heading exists AND section has >= 30 words.

**Fail criteria:** Heading missing OR section has < 30 words (too generic/placeholder).

**Why this matters:** Social context bridges protocol mechanics and appropriate behavior. A generic "be respectful" section provides no actionable guidance. The 30-word minimum catches empty or placeholder sections.

### Assertion 5: `trigger-coverage` (all skills)

**What to check:** The skill's `description` field includes both protocol-technical triggers and social-situation triggers.

**How to check:**
1. Extract the `description` field from SKILL.md frontmatter.
2. Check for protocol-technical indicators: event kind numbers (e.g., `kind:1`, `kind:7`), NIP references (e.g., `NIP-25`), API names (e.g., `client.send`), or technical terms (e.g., `event`, `relay`, `subscribe`).
3. Check for social-situation indicators: question words or user-facing scenario phrases (e.g., `should I`, `when to`, `appropriate`, `how should`, `is it okay`, `how do I`, `how to`, `how much`, `what is`, `what are`).
4. Both categories must be present.

**Pass criteria:** At least one protocol-technical indicator AND at least one social-situation indicator found in the description.

**Fail criteria:** Only one category present, or neither.

**Why this matters:** Protocol-only triggers activate the skill for developers but not for agents in social scenarios. Social-only triggers miss developer use cases. Both are needed for a skill that serves the full agent population.

### Assertion 6: `eval-completeness` (all skills)

**What to check:** The skill has sufficient eval coverage.

**How to check:**
1. Load `evals/evals.json`.
2. Count `trigger_evals` array length. Must be >= 6.
3. Count entries with `should_trigger: true` and `should_trigger: false`. Both must be >= 1 (mix required).
4. Count `output_evals` array length. Must be >= 4.
5. For each output eval, verify `assertions` array exists and is non-empty.

**Pass criteria:** >= 6 trigger evals (with mix) AND >= 4 output evals (each with assertions).

**Fail criteria:** Insufficient trigger evals, no mix, insufficient output evals, or output evals missing assertions.

**Why this matters:** A skill without sufficient evals cannot be reliably benchmarked. The minimums (6 trigger, 4 output) ensure there is enough data to calculate meaningful pass rates and detect regressions.

## Hard-Wrapped Markdown

Every grep in this runner reads **reflowed** prose, not raw lines: `run-eval.sh` joins wrapped prose and wrapped list items into one line per block before matching, leaving headings, table rows and fences alone. A sentence therefore matches however the author happened to wrap it, and an exclusion marker on the second physical line of a sentence still applies to the first.

Two things follow for anyone editing this runner:

- **Reformatting a paragraph is safe.** A correct sentence does not start failing because someone reflowed it.
- **Use `grep -c … >/dev/null`, never `grep -q`, downstream of `skill_prose`.** `-q` exits on the first match and SIGPIPEs the reflow `awk`; under `set -o pipefail` that turns a successful match into a failed pipeline, which silently misclassifies every skill as `general`.

## Running All 6 Assertions

Execute in order. Report per-assertion pass/fail with evidence. The overall compliance result is:
- **PASS:** All applicable assertions pass.
- **FAIL:** Any applicable assertion fails.

Do not short-circuit -- run all applicable assertions even if one fails, so the developer sees the complete picture.
