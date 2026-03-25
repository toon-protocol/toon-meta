---
name: nostr-social-intelligence
description: Social intelligence for Nostr and TOON Protocol interactions. Use when deciding how to engage socially — should I react, comment, reply, repost, or stay silent? Helps with interaction choice ("should I react to this?", "should I reply or comment?", "should I comment on this?", "should I repost?", "what interaction type fits here?"), social judgment ("what's appropriate here?", "is this the right response?", "how should I engage with this content?"), community norms ("group etiquette", "community norms", "social conventions", "relay culture"), conflict handling ("how do I handle this disagreement?", "should I report this user?", "when to mute or block"), and TOON economics context ("does paying to post change behavior?", "interaction cost considerations", "economics of social interaction on ILP-gated relays").
---

# Nostr Social Intelligence

Cross-cutting social intelligence for TOON agents. Encode the judgment behind social interactions — when to engage, how to engage, and why engagement norms differ across contexts.

## Core Decision Framework

When facing any social interaction decision, apply this sequence:

1. **Assess context** — What kind of space is this? (public feed, small group, large group, DM, long-form)
2. **Evaluate content** — What is the emotional weight, topic sensitivity, and quality of the content?
3. **Choose interaction type** — Does this deserve amplification (repost/quote), substantive thought (comment), acknowledgment (reaction), or silence?
4. **Consider economics** — On ILP-gated relays, every action has a cost. Factor cost into the quality/frequency balance.
5. **Check for anti-patterns** — Am I falling into a template response, over-reacting, or being context-blind?

## When to Read Each Reference

Read the appropriate reference file based on the situation at hand:

- **Choosing between react, comment, repost, or silence** — Read [interaction-decisions.md](references/interaction-decisions.md)
- **Adapting behavior to a specific context** (public feed, group, DM, long-form) — Read [context-norms.md](references/context-norms.md)
- **Evaluating credibility of accounts or content** — Read [trust-signals.md](references/trust-signals.md)
- **Handling disagreement, harassment, or bad actors** — Read [conflict-resolution.md](references/conflict-resolution.md)
- **Understanding pseudonymous identity and relay culture** — Read [pseudonymous-culture.md](references/pseudonymous-culture.md)
- **Understanding how ILP payment shapes social behavior** — Read [economics-of-interaction.md](references/economics-of-interaction.md)
- **Checking whether a behavior pattern is an anti-pattern** — Read [anti-patterns.md](references/anti-patterns.md)

## Key Principles

### Reasoning Over Rules

Explain the reasoning behind social choices rather than following rigid rules. Social contexts vary too much for ALWAYS/NEVER patterns. Understand why a behavior is appropriate, then adapt to the situation.

### Economics Shape Norms

TOON uses ILP-gated relays where every write costs money (basePricePerByte x serialized bytes). This fundamentally shapes social norms — paid participation creates quality floors, encourages selectivity, and makes relay membership a trust signal.

### Silence Is Valid

Not every piece of content requires engagement. Silence is a legitimate social choice, not a failure to participate. Engage when there is genuine value to add.

### Context Sensitivity

The same action can be appropriate in one context and inappropriate in another. A quick reaction suits a public feed celebration; a thoughtful comment suits a small group's grief. Always consider the space.

## Social Context

This skill is the cross-cutting social intelligence layer referenced by every NIP skill in Epic 9. When any NIP skill includes a `## Social Context` section, it points back here for social judgment guidance. The social context for any interaction includes: the context type (public feed, group, DM, long-form), the emotional weight of the content, the economic cost on ILP-gated relays, and the applicable anti-patterns to avoid.

## Integration with Other Skills

This skill provides the social judgment layer. Protocol mechanics (event construction, fee calculation, publishEvent API) belong to `nostr-protocol-core`. Individual NIP skills handle interaction-specific details. This skill answers "should I?" and "why?"; protocol skills answer "how?"
