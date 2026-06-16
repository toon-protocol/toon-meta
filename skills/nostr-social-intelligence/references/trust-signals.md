# Trust Signals

Interpreting credibility and reputation in Nostr and TOON. Trust assessment in a pseudonymous, decentralized network requires different signals than traditional social platforms.

## Follow Count Is Not Authority

A high follower count does not equal expertise, trustworthiness, or authority. In Nostr's open ecosystem:

- Follow counts can be inflated by bots, sockpuppets, or social gaming.
- Follows reflect popularity or visibility, not necessarily quality or credibility.
- A low-follower account with deep domain knowledge may be far more valuable than a high-follower account posting generalities.

Why this matters: Traditional social platforms train users to equate followers with authority. Nostr's architecture — where anyone can create unlimited keys — makes follow count an unreliable proxy. Evaluate content on its merits, not the author's follower count.

## Relay Membership as a Trust Signal

On ILP-gated TOON relays, membership is an economic signal:

- **Paid relays create skin-in-the-game.** Every event written to a TOON relay costs money (basePricePerByte x serialized bytes). Spammers and low-effort participants are economically filtered.
- **Relay presence implies investment.** If someone is actively posting on an ILP-gated relay, they've committed real value to participate. This creates an implicit quality floor.
- **Multi-relay presence is meaningful.** An account active across multiple paid relays signals sustained commitment to the ecosystem.
- **Free relay presence is neutral.** Being on free relays says nothing about commitment — it's the default. Don't penalize it, but don't weight it either.

Why this matters: In a world where identity is cheap (anyone can generate a keypair), economic signals provide a useful trust layer. Paid relay membership is one of the few signals that can't be faked without real cost.

## NIP-05 Verification

NIP-05 identifiers (user@domain.com format) prove domain ownership, not identity verification:

- **NIP-05 proves control of a domain** — specifically, the ability to place a JSON file at `domain.com/.well-known/nostr.json`. This proves DNS/hosting access, nothing more.
- **It is NOT identity verification.** A NIP-05 of `alice@example.com` proves that whoever controls `example.com` associated that name with a pubkey. It doesn't prove the person IS Alice.
- **Domain reputation transfers.** NIP-05 at a well-known domain (a company, a recognized organization) carries more weight than at an unknown domain. But it still only proves association, not identity.
- **NIP-05 can be revoked.** The domain owner can update or remove the association at any time. It's a live signal, not a permanent credential.

Why this matters: NIP-05 is often misunderstood as "verified account" (like Twitter's legacy checkmark). In reality, it's a much weaker claim — domain association. Useful context, but not proof of identity.

## New Accounts Deserve Benefit of the Doubt

In a pseudonymous ecosystem where creating new identities is normal and expected:

- **New keys are not suspicious by default.** People create new keypairs for privacy, compartmentalization, fresh starts, or experimentation. This is a feature of Nostr, not an abuse vector.
- **Judge content, not account age.** A day-old account posting insightful technical analysis deserves the same consideration as a year-old account posting the same content.
- **Provide on-ramps, not gatekeeping.** New participants in a community should feel welcomed. Suspicion-by-default drives people away.
- **Watch for patterns, not indicators.** A single new account is meaningless. A flood of new accounts posting similar content is a pattern worth noting.

Why this matters: Pseudonymous networks only work if new participants can earn social standing through their contributions. If communities treat new accounts with automatic suspicion, the network loses its core value proposition.

## Composite Trust Assessment

When evaluating an account's credibility, consider multiple signals together rather than any single indicator:

1. **Content quality** — Is the content thoughtful, accurate, well-reasoned? (Strongest signal)
2. **Behavioral consistency** — Does the account engage authentically across conversations? (Strong signal)
3. **Relay presence** — Active on ILP-gated relays? Multiple relays? (Moderate signal)
4. **NIP-05** — Verified against a reputable domain? (Contextual signal)
5. **Social graph** — Followed by people you trust? Engages with credible accounts? (Weak but useful signal)
6. **Follow count** — Large following? (Weakest signal — ignore as primary indicator)

The strongest trust signal remains content quality. In Nostr, what you say matters more than who you appear to be.
