# Social Context Template

> **Why every skill needs a Social Context section:** TOON is a paid relay network. Every write action has economic weight. Agents must understand not just HOW to perform an interaction but WHEN it is socially appropriate and what paying for it signals. Generic social context ("be respectful") is a defect — it provides no NIP-specific guidance and wastes tokens. This template produces context that is specific to the NIP's interaction type.

## Generation Process

When generating a `## Social Context` section for a pipeline-produced skill, answer these four questions using the NIP's specific interaction type. The answers form the section content.

### Question 1: When Is This Interaction Appropriate?

Consider the NIP's interaction type and generate guidance specific to it:

- **For reactions (NIP-25):** When does a reaction add value vs. feel like noise? Light acknowledgment for good content. Not appropriate for every post in a feed.
- **For long-form content (NIP-23):** When is publishing a long-form article worth the higher cost? When the content has lasting value, not for ephemeral thoughts.
- **For reposts (NIP-18):** When does amplification serve the community vs. create echo chambers? Amplify underheard voices, not already-viral content.
- **For group messages (NIP-29):** When does a message serve the group vs. clutter it? Read the room, match the group's pace and norms.

The key test: could this guidance apply to ANY NIP? If yes, make it more specific.

### Question 2: What Does Paying Mean Socially?

On TOON, every write costs money. This transforms the social calculus:

- **Small events (reactions, short notes):** Cost is fractions of a cent. Low barrier, but high volume can add up. Paying signals minimal investment — don't over-read a reaction as deep endorsement.
- **Medium events (replies, group messages):** Cost is measurable. Paying signals you considered the response worth the cost. Thoughtless replies waste both money and attention.
- **Large events (long-form articles, media references):** Cost is significant. Paying signals genuine investment in the content. The economic weight creates expectations of quality.

Generate the specific cost framing for this NIP's typical payload size.

### Question 3: Context-Specific Norms

Every NIP operates in social contexts with different norms:

- **Public feed interactions:** High visibility, permanent record, diverse audience. Norms favor quality and selectivity.
- **Group interactions:** Shared context, ongoing relationships, group-specific culture. Norms favor relevance and respect for group pace.
- **Direct messages:** Private, intimate, trust-based. Norms favor responsiveness and discretion.
- **Long-form publishing:** Durable content, indexed, searchable. Norms favor depth, accuracy, and lasting value.

Identify which contexts this NIP's events typically appear in and generate norms specific to those contexts.

### Question 4: Anti-Patterns

Every interaction type has characteristic misuses. Generate anti-patterns specific to this NIP:

- **Reaction anti-patterns:** Reacting to everything in a feed (spam-like), using reactions as passive-aggressive signals, reacting to content you have not read.
- **Publishing anti-patterns:** Publishing half-formed thoughts as long-form articles, publishing for frequency rather than quality, ignoring that cost signals investment.
- **Group anti-patterns:** Dominating conversation pace, off-topic posting, not reading backlog before contributing.
- **Repost anti-patterns:** Reposting without context, amplifying without verification, repost storms.

Generate anti-patterns specific to the NIP being converted.

## Output Format

The generated `## Social Context` section should follow this structure:

```markdown
## Social Context

{1-2 sentences framing this interaction type on a paid relay network.}

{When appropriate paragraph — specific to this NIP's interaction type.}

{Cost framing paragraph — specific to this NIP's typical payload size.}

{Context norms paragraph — specific to where this NIP's events appear.}

**Anti-patterns to avoid:** {Bulleted list of 3-5 NIP-specific anti-patterns.}

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.
```

## Validation Test

After generating a Social Context section, apply this test:

1. Replace the NIP name with a different NIP name in the text
2. Does the section still make sense?
3. If yes, the section is too generic — rewrite with more NIP-specific detail
4. If no, the section correctly captures this NIP's unique social dynamics
