# Social Context Template

> **Why every skill needs a Social Context section:** TOON is a paid relay network: every write must carry a covering claim on a funded payment channel. Agents must understand not just HOW to perform an interaction but WHEN it is socially appropriate and what paying for it signals — which is less than it sounds, because the price is one millionth of a dollar. Generic social context ("be respectful") is a defect — it provides no NIP-specific guidance and wastes tokens. This template produces context that is specific to the NIP's interaction type.

## Generation Process

When generating a `## Social Context` section for a pipeline-produced skill, answer these four questions using the NIP's specific interaction type. The answers form the section content.

### Question 1: When Is This Interaction Appropriate?

Consider the NIP's interaction type and generate guidance specific to it:

- **For reactions (NIP-25):** When does a reaction add value vs. feel like noise? Light acknowledgment for good content. Not appropriate for every post in a feed.
- **For long-form content (NIP-23):** When is a long-form article the right shape rather than a note? When the content has lasting value, not for ephemeral thoughts. The relay charges the same flat price either way, so the question is the reader's attention, not the price.
- **For reposts (NIP-18):** When does amplification serve the community vs. create echo chambers? Amplify underheard voices, not already-viral content.
- **For group messages (NIP-29):** When does a message serve the group vs. clutter it? Read the room, match the group's pace and norms.

The key test: could this guidance apply to ANY NIP? If yes, make it more specific.

### Question 2: What Does Paying Mean Socially?

On TOON, every write costs money. This transforms the social calculus — but not in proportion to size. Nostr events go to the relay route `g.toon.relay`, which is **flat-priced**: 1 base unit of 6-decimal USDC per event, whatever the event. A reaction costs exactly what a long-form article costs.

- **The price is per action, not per unit of payload.** It is the cost of doing the thing, not of the bytes it took. Volume is the expensive axis, not length: reacting to forty posts costs forty times a reaction; publishing one article costs one.
- **Paying signals deliberateness, not depth.** The agent chose to act and paid to do it — that is all the price says. Don't over-read a reaction as deep endorsement, and don't under-read a note because it was short.
- **Do not read spend as effort.** A long-form article signals investment because writing it took effort, not because it cost more. Any claim of the form "this cost more, so it means more" is false on the relay.
- **Payment is a gate, not a deterrent.** At one millionth of a dollar the price stops nobody. What stands between an agent and a million posts is the machinery: a funded channel opened on-chain against a counterparty, a strictly increasing nonce, a settlement trail. A spammer is identifiable and rate-limited by their own channel, not priced out. Do not write social context that claims cost deters abuse.
- **Not every route is flat.** Blob storage through the store route (`g.toon.relay.store`) prices `1000 + 10 per KiB` of *sealed* payload, so a NIP whose write lands there does scale with size. Check the destination route before making any size claim.

Generate the specific cost framing for this NIP's destination route. If the route is flat, say so plainly rather than implying size matters.

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
- **Publishing anti-patterns:** Publishing half-formed thoughts as long-form articles, publishing for frequency rather than quality, treating spend as a proxy for effort (the relay's flat price makes it a bad one).
- **Group anti-patterns:** Dominating conversation pace, off-topic posting, not reading backlog before contributing.
- **Repost anti-patterns:** Reposting without context, amplifying without verification, repost storms.

Generate anti-patterns specific to the NIP being converted.

## Output Format

The generated `## Social Context` section should follow this structure:

```markdown
## Social Context

{1-2 sentences framing this interaction type on a paid relay network.}

{When appropriate paragraph — specific to this NIP's interaction type.}

{Cost framing paragraph — specific to this NIP's destination route and its price schedule. Say flat when it is flat.}

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
