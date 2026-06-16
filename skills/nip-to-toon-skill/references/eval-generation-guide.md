# Eval Generation Guide

> **Why evals matter:** Evals are the objective measure of whether a skill works. Without evals, skill quality is subjective. The skill-creator format defines a specific eval structure that enables automated testing (Story 9.3) and quality gates (Story 9.34). Getting the eval format wrong means the skill cannot be validated.

## Eval File Format

Generate `evals/evals.json` with this structure:

```json
{
  "trigger_evals": [
    { "query": "...", "should_trigger": true },
    { "query": "...", "should_trigger": false }
  ],
  "output_evals": [
    {
      "id": "unique-eval-id",
      "prompt": "...",
      "expected_output": "...",
      "rubric": {
        "correct": "...",
        "acceptable": "...",
        "incorrect": "..."
      },
      "assertions": ["..."]
    }
  ]
}
```

## Trigger Evals

**Why trigger accuracy matters:** If a skill triggers when it should not, it wastes context window tokens. If it fails to trigger when needed, the agent lacks critical knowledge. Trigger evals test the description field's effectiveness.

### Should-Trigger Queries (8-10)

Generate queries that SHOULD activate this specific NIP skill. Include both:

- **Protocol-technical triggers** (4-5): Direct references to the NIP, event kinds, or protocol operations
  - "How do I create a kind:7 reaction event on TOON?"
  - "How do I publish a NIP-25 reaction?"

- **Social-situation triggers** (4-5): Scenarios where the agent needs this skill's knowledge
  - "Should I react to this post with a thumbs up or a heart?"
  - "I want to show appreciation for this content on TOON"

### Should-Not-Trigger Queries (8-10)

Generate queries that should NOT activate this skill. These must clearly belong to other skills:

- **nostr-protocol-core territory** (3-4): General protocol questions
  - "How do I publish an event on TOON?" (generic write, not NIP-specific)
  - "How do I calculate fees?" (fee mechanics, not this NIP)

- **nostr-social-intelligence territory** (3-4): Pure social judgment
  - "Should I engage with this controversial post?" (social judgment)
  - "What are the norms in this community?" (social norms)

- **Other NIP skill territory** (2-3): Different NIP's domain
  - "How do I create a group on Nostr?" (NIP-29, not this NIP)
  - "How do I format a long-form article?" (NIP-23, not this NIP)

## Output Evals (4-6)

**Why output evals need rubrics:** Rubric-based grading provides clear pass/fail criteria. The `correct` / `acceptable` / `incorrect` tiers allow nuanced assessment — a response can be useful without being perfect.

### Structure

Each output eval tests a specific capability:

- **`id`**: Unique identifier, format: `{nip-name}-{capability}` (e.g., `reactions-write-basic`, `reactions-social-judgment`)
- **`prompt`**: A realistic user query that requires the skill's knowledge. Include enough context to produce a meaningful response.
- **`rubric`**: Three grading tiers:
  - `correct`: Response demonstrates full skill knowledge, TOON awareness, and social context
  - `acceptable`: Response is useful but may miss some TOON-specific details or social nuance
  - `incorrect`: Response has fundamental errors, uses vanilla Nostr patterns, or ignores TOON context
- **`assertions`**: 3-5 specific checkpoints. Include TOON compliance assertions (see toon-compliance-assertions.md).

### Eval Coverage

Generate evals covering these dimensions:

1. **Write operation** (write-capable NIPs): Agent correctly uses `publishEvent()` with fee awareness
2. **Read operation** (read-capable NIPs): Agent correctly handles TOON-format responses
3. **Social judgment**: Agent applies NIP-specific social context appropriately
4. **Error handling**: Agent handles F04 or other protocol errors correctly
5. **Boundary case**: Agent correctly identifies when this NIP does NOT apply (excluded NIPs, wrong context)

## TOON Assertion Integration

After generating base evals, inject TOON compliance assertions (Step 6 of the pipeline). The assertions from `toon-compliance-assertions.md` are added to each output eval's `assertions` array based on NIP classification. This ensures every output eval checks for TOON compliance, not just correctness.

## Common Mistakes to Avoid

- **Generic queries:** "Tell me about NIP-25" is too vague. Use "I want to react to a post on TOON with a custom emoji — how?"
- **Overlapping triggers:** Do not write should-trigger queries that could equally activate `nostr-protocol-core`. Be NIP-specific.
- **Missing social triggers:** Every NIP skill must have social-situation triggers, not just protocol-technical ones.
- **Rubric without TOON awareness:** The `incorrect` tier must flag vanilla Nostr patterns (raw WebSocket writes, no fee consideration).
