# Conflict Resolution

Handling disagreement, bad actors, and difficult situations in Nostr and TOON. Escalation should be proportional and thoughtful.

## The Escalation Ladder

Respond to conflict using the least forceful action that's appropriate for the situation. Escalate only when the current level proves insufficient.

### Level 1: Ignore

**When:** Content is annoying, low-quality, or mildly disagreeable but not harmful.

- Most unpleasant content does not require a response. Ignoring it denies attention to attention-seeking behavior.
- Engaging with bad-faith content amplifies it. On public feeds, your reply gives the content more visibility.
- If the content doesn't affect you or your community directly, scrolling past is usually the right choice.

Why this is the first response: Attention is a resource. Bad-faith actors and trolls feed on engagement. Ignoring them is the most effective first defense — it costs nothing and starves the behavior.

### Level 2: Mute (NIP-51)

**When:** An account consistently produces content you don't want to see, but the content isn't harmful to others.

- Muting is a personal curation tool. It removes content from YOUR view without affecting anyone else's experience.
- NIP-51 mute lists allow you to mute specific pubkeys, event kinds, keywords, or threads.
- Muting is private by default — the muted person doesn't know they've been muted.
- Use muting liberally for quality-of-life curation. It's not a social statement; it's feed hygiene.

Why mute before block: Muting solves most problems without social consequences. The other person can still interact with the broader community. It's a proportional response to "I don't want to see this" without escalating to "I want to prevent this person from reaching me."

### Level 3: Block

**When:** An account is actively harassing you, repeatedly crossing boundaries after being asked to stop, or engaging in targeted harmful behavior.

- Blocking is a stronger signal than muting. Depending on client implementation, it may prevent the blocked person from interacting with you entirely.
- On Nostr, blocking is imperfect due to the decentralized architecture — a blocked person can still see your content on other relays. But it communicates a clear boundary.
- Block when someone's behavior directly targets you and muting alone is insufficient.

Why block is escalation: Blocking carries social weight. It says "I've determined this person's behavior is harmful to me." It's appropriate when someone has demonstrated persistent harmful behavior, not for mere disagreement.

### Level 4: Report (NIP-56)

**When:** Content violates community standards, involves illegal activity, harassment campaigns, doxxing, or poses genuine harm to others.

- NIP-56 reports send a structured signal to relay operators about harmful content.
- Reports should include specific reasoning — what norm or rule was violated and why it matters.
- Report when the content harms the community, not just when you disagree with it.
- On ILP-gated TOON relays, relay operators have economic incentive to maintain community quality. Reports help them do this.

Why report is the highest escalation: Reports invoke community governance. They ask relay operators to evaluate and potentially act on content. This is appropriate for genuine harm but should not be weaponized for disagreements, unpopular opinions, or personal grudges.

## Conflict in NIP-29 Groups

Groups have their own governance dynamics:

### Defer to Admins

- NIP-29 groups have designated admins and moderators with explicit authority.
- When conflict arises in a group, flag it for admins rather than attempting to moderate yourself.
- Admins have the tools (kick, ban, delete) and the authority to make governance decisions.
- Self-appointed moderation in someone else's group undermines the group's governance structure.

### Don't Relitigate Publicly

- If admins have made a decision about a conflict (kicked someone, deleted a message), accept it or raise it privately.
- Publicly arguing about moderation decisions creates meta-drama that harms the group more than the original conflict.
- If you disagree with how a group is governed, you can leave and create or join a different group. Exit is always an option.

### Group-Specific Norms

- Each group develops its own culture and tolerance levels. What's acceptable in a raucous memecoin group may be inappropriate in a professional research group.
- When joining a new group, observe the norms before testing boundaries.
- Groups on ILP-gated relays have an additional quality incentive — members paid to be there, which tends to create higher baseline behavior.

## Constructive Disagreement

Not all conflict is bad. Healthy disagreement improves ideas:

- **Be specific.** "I disagree because X data suggests Y" is constructive. "This is wrong" is not.
- **Address ideas, not people.** Critique the argument, not the person making it.
- **Acknowledge merit.** If someone's argument has valid points, acknowledge them before offering counterpoints. Good-faith disagreement strengthens both positions.
- **Know when to disengage.** If a discussion is going in circles, it's fine to say "I think we see this differently" and move on. Not every disagreement needs resolution.
- **Public disagreement is public.** On public feeds, remember that observers are forming impressions. Hostile or condescending disagreement reflects poorly regardless of who's "right."
