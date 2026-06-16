# Grading Format

> **Why assertion-based grading exists:** LLM responses are non-deterministic. The same prompt produces different wording each time. Exact-match grading would fail constantly, producing false negatives that erode trust in the eval framework. Assertion-based grading checks for the presence of key concepts, not exact phrasing, which tolerates natural variation while still catching substantive defects.

## grading.json Schema

The grading output is a JSON array of assertion results:

```json
[
  {
    "text": "toon-write-check: Response uses publishEvent() API, not raw WebSocket",
    "passed": true,
    "evidence": "Response mentions 'client.publishEvent()' on line 3 and does not contain raw WebSocket EVENT patterns."
  },
  {
    "text": "Response references @toon-protocol/client",
    "passed": false,
    "evidence": "Response does not mention '@toon-protocol/client' or any TOON client package."
  }
]
```

Each entry has exactly three fields:
- **`text`** (string): The assertion being checked. Copied verbatim from the output eval's `assertions` array.
- **`passed`** (boolean): Whether the assertion is satisfied.
- **`evidence`** (string): Human-readable explanation of WHY the assertion passed or failed. Must reference specific content from the response.

## Assertion Checking Methods

For each assertion, apply these checks in order until one produces a definitive result:

### 1. Keyword Presence

Extract key terms from the assertion text and check for their presence in the response. Case-insensitive matching.

Example: Assertion `"Response references @toon-protocol/client"` extracts key terms `["@toon-protocol/client"]`. Check if the response contains this string (case-insensitive).

### 2. Substring Match

Check if critical substrings appear in the response. Useful for API names, function calls, and technical terms.

Example: Assertion `"toon-write-check: Response uses publishEvent() API"` checks for substrings `["publishEvent"]`.

### 3. Negation Detection

Some assertions check for absence. Look for "NOT", "does not", "never" in the assertion text.

Example: Assertion `"Response does NOT use raw WebSocket EVENT pattern"` checks that the response does NOT contain raw WebSocket EVENT array patterns.

### 4. Concept Matching

For assertions about reasoning or explanation, check for concept indicators rather than exact phrases.

Example: Assertion `"Response explains reasoning (WHY)"` checks for presence of explanatory language: "because", "the reason", "this is why", "this matters because", or causal connectors.

## Rubric-Based Grading

Output evals include a `rubric` with three tiers:

- **`correct`**: The ideal response. Maps to all assertions passing.
- **`acceptable`**: Adequate response with minor gaps. Maps to >= 80% of assertions passing.
- **`incorrect`**: Fundamentally wrong response. Maps to < 80% of assertions passing.

The rubric provides qualitative guidance for manual review. Assertions provide the quantitative measure. When automated grading runs, assertions determine pass/fail. The rubric is used for:
1. Calibrating assertion thresholds during framework setup.
2. Manual review of borderline cases.
3. Generating human-readable evidence for why an overall grade was assigned.

## Pass/Fail Determination

- **Per-assertion:** Binary pass/fail based on checking methods above.
- **Per-eval:** Pass if >= 80% of assertions pass. This threshold accounts for LLM non-determinism.
- **Per-skill:** Pass if >= 80% of output evals pass.

**Why 80% and not 100%:** LLM responses vary. A skill that passes 4/5 assertions on every run is functioning correctly -- the missing assertion is likely a phrasing variation, not a knowledge gap. Requiring 100% produces false failures that waste developer time investigating non-issues.

## Evidence Quality

Good evidence is specific and references the response:
- GOOD: "Response contains 'client.publishEvent(event, { destination })' on line 5, satisfying the publishEvent API requirement."
- BAD: "Assertion passed."

Good evidence for failures explains what was expected vs what was found:
- GOOD: "Expected mention of '@toon-protocol/client' but response only references 'nostr-tools' for event construction."
- BAD: "Assertion failed."

**Why evidence matters:** Evidence turns grading from a black box into a debuggable system. When a skill fails an assertion, the developer reads the evidence to determine if it is a real defect or a false positive. Without evidence, every failure requires re-reading the full response.
