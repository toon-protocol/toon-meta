# Description Optimization Guide

> **Why description optimization matters:** The description is the ONLY mechanism that determines whether a skill triggers. Claude reads only `name` + `description` to decide activation. A poorly optimized description means the skill either fails to trigger when needed (false negatives) or triggers inappropriately (false positives, wasting context). The optimization loop systematically improves trigger accuracy using real query testing.

## The Optimization Process

Description optimization uses `scripts.run_loop` to iteratively refine the description field until trigger accuracy converges.

### Step 1: Generate 20 Trigger Queries

Create a balanced set of test queries:

- **10 should-trigger queries:** Mix of protocol-technical (5) and social-situation (5) triggers specific to this NIP
- **10 should-not-trigger queries:** Queries that belong to other skills (nostr-protocol-core, nostr-social-intelligence, other NIP skills)

**Why 20 queries:** Fewer than 20 gives unreliable accuracy measurement. More than 20 increases iteration time without proportional accuracy gains. 20 is the empirical sweet spot for description optimization.

### Step 2: Run Initial Evaluation

Present each query to a model with only the skill's frontmatter (name + description) loaded. Record whether the model determines the skill should activate.

### Step 3: Analyze Mismatches

For each query that triggered incorrectly (false positive or false negative):

- **False positive:** The description contains phrases that match this unrelated query. Identify which phrases cause the over-broad matching and constrain them.
- **False negative:** The description lacks coverage for this valid use case. Identify what trigger phrase or context is missing and add it.

### Step 4: Refine Description

Rewrite the description addressing the mismatches. Constraints:

- Stay within 80-120 words
- Maintain both protocol-technical and social-situation triggers
- Do not remove working triggers to fix broken ones — add specificity instead

### Step 5: Re-evaluate and Iterate

Run the 20 queries against the revised description. If accuracy improves, continue. If accuracy plateaus or degrades, revert to the best previous version.

**Max iterations:** 5. If the description has not converged after 5 iterations, use the best-performing version and note the remaining mismatches for manual review.

### Step 6: Select Best Description

The `best_description` is the version with the highest combined accuracy:

```
accuracy = (true_positives + true_negatives) / total_queries
```

In case of ties, prefer the shorter description (fewer tokens in always-loaded metadata).

## Convergence Detection

The loop converges when:
- Accuracy reaches 100% (all 20 queries match expected behavior), OR
- Accuracy does not improve for 2 consecutive iterations, OR
- Max iterations (5) reached

## Common Optimization Patterns

### Problem: Social triggers too broad
**Symptom:** "Should I react?" triggers for any NIP, not just NIP-25.
**Fix:** Add NIP-specific qualifiers: "should I react to this post with a like or emoji?" instead of "should I react?"

### Problem: Protocol triggers overlap with nostr-protocol-core
**Symptom:** "How do I publish this event?" triggers both the NIP skill and protocol-core.
**Fix:** Include the specific event kind or NIP number: "How do I publish a kind:7 reaction event?" instead of "How do I publish an event?"

### Problem: Description too short for trigger coverage
**Symptom:** Many false negatives — valid queries do not activate the skill.
**Fix:** Expand to the full 120-word budget. Add parenthetical trigger phrase clusters.

### Problem: Description too long and unfocused
**Symptom:** Many false positives — unrelated queries activate the skill.
**Fix:** Remove generic phrases. Each phrase should be NIP-specific. Cut anything that could apply to multiple NIPs.

## Output

After optimization, the final description replaces the draft in the skill's YAML frontmatter. Document the optimization results:

- Initial accuracy (before optimization)
- Final accuracy (best_description)
- Number of iterations taken
- Any remaining mismatches (for manual review)
