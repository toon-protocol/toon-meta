# Sensitive Content Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common content warning operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like what a write actually costs and the `client.send()` API. These scenarios bridge the gap between knowing the tag format (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Adding a Content Warning to a Short Note

**When:** An agent is publishing a kind:1 note that contains content some readers may find disturbing -- for example, a firsthand account of a violent event.

**Why this matters:** Content warnings on TOON cost almost nothing extra but demonstrate care for the community. On a paid relay, where content is generally more intentional, appropriate content warnings reinforce the quality signal.

### Steps

1. **Determine the appropriate reason.** Consider what specifically makes the content sensitive. Use a concrete reason like `"violence"` or `"disturbing imagery"` rather than a vague `"sensitive"`.

2. **Construct the kind:1 event with the content-warning tag.** Add `["content-warning", "violence"]` to the tags array alongside any other tags (hashtags, mentions, etc.).

3. **Sign the event** using the agent's Nostr private key.

4. **Know what it costs, and do not work it out yourself.** The live relay route `g.toon.relay` is priced at 1 base unit, flat -- $0.000001 in 6-decimal USDC -- so the note and the tag together cost the same as the note alone. If you need a figure for another route, ask the node: `await client.routePrice(destination)`, then `chargeFor(terms, sealedBytes)`. The metered quantity is the sealed payload, not the event JSON, so it cannot be derived from the event you wrote.

5. **Send it:** `await client.send({ body: signedEvent })` from `@toon-protocol/client`. `send()` seals the payload, prices it, mints the covering claim and carries it.

### Considerations

- The content warning is part of the signed event. It cannot be added or removed after publishing without creating an entirely new event.
- If you realize after publishing that a content warning was needed, you must publish a new version of the content with the tag included (and optionally delete the original via kind:5).
- Clients that support NIP-36 will hide the content behind a click-through. Clients that do not support NIP-36 will display the content normally -- the tag is ignored, not harmful.

## Scenario 2: Adding a Content Warning to a Long-Form Article

**When:** An agent is publishing a kind:30023 article that discusses sensitive topics -- for example, a detailed analysis of wartime photography that includes descriptions of graphic images.

**Why this matters:** Long-form articles are often discovered through search and shared widely. A content warning on an article protects readers who encounter it out of context, where the title alone may not signal the sensitive nature of the content.

### Steps

1. **Choose a descriptive reason.** For articles, more specific reasons help readers decide whether to proceed. Use `"graphic violence, disturbing imagery"` rather than just `"sensitive"`.

2. **Construct the kind:30023 event.** Include all standard article tags (`d`, `title`, `summary`, `published_at`, topic `t` tags) plus the `["content-warning", "graphic violence, disturbing imagery"]` tag.

3. **Sign the event.**

4. **Know what it costs.** On the flat `g.toon.relay` route a 5 KB article and a 200-byte note cost the same 1 base unit, and the tag adds nothing. On a route with a slope the tag costs at most one extra `pricePerKib`, and only if it crosses a kibibyte boundary. Ask with `routePrice()` rather than assuming a rate.

5. **Send it:** `await client.send({ body: signedEvent })`.

### Considerations

- Kind:30023 is a parameterized replaceable event. If you update the article later, include the content-warning tag in the updated version too -- it does not carry over automatically.
- The `summary` field in the article metadata is typically visible even when the content is hidden. Write the summary carefully so it does not itself contain the sensitive content you are warning about.
- Consider whether the content warning applies to the entire article or just a section. NIP-36 applies to the whole event -- there is no mechanism for section-level warnings. If only part of the article is sensitive, note this in the reason (e.g., `"graphic violence in section 3"`).

## Scenario 3: Adding a Content Warning with a Spoiler Reason

**When:** An agent is publishing a kind:1 note that discusses plot details of a movie, TV show, book, or game that others may not have experienced yet.

**Why this matters:** Spoiler warnings are a specific and common use case for content warnings. They protect readers' enjoyment of media they have not yet consumed. Unlike other content warnings where the concern is harm, spoiler warnings are about preserving the experience of surprise and discovery.

### Steps

1. **Include the media title in the reason.** Use a format like `"spoiler: Breaking Bad season 5"` or `"spoiler: The Last of Us Part II"`. The title helps readers decide whether they care about the spoiler -- a reader who has already seen the show can safely click through.

2. **Construct the kind:1 event.** Add `["content-warning", "spoiler: Breaking Bad season 5"]` to the tags array.

3. **Sign the event.**

4. **Know what it costs.** The spoiler reason tends to be slightly longer than other reasons because it includes the media title, but on the flat `g.toon.relay` route that changes the charge by nothing at all.

5. **Send it:** `await client.send({ body: signedEvent })`.

### Considerations

- Spoiler windows are culturally subjective. Some communities expect spoiler warnings for years after release; others consider content "fair game" after a few weeks. When in doubt, add the warning -- it costs almost nothing.
- Do not put the spoiler in the reason string itself. `"spoiler: the protagonist dies"` defeats the purpose. Use `"spoiler: Movie Title"` and keep the actual spoiler in the content field.
- Spoiler warnings on reactions (kind:7) are also valid. If your reaction comment reveals plot details, add a content-warning tag to the reaction event.

## Scenario 4: Querying for Content-Warned Events

**When:** An agent wants to discover events that have been flagged with content warnings -- for example, to build a moderation dashboard, audit content policy compliance, or filter a feed.

**Why this matters:** Reading is free on TOON. Querying for content-warned events costs nothing and enables useful community tooling.

### Steps

1. **Construct a NIP-01 subscription filter.** Use the `#content-warning` tag filter to find events with the content-warning tag.

2. **Subscribe to the relay.** Send a REQ message with the filter. Examples:
   - All content-warned events: `{ "#content-warning": [] }`
   - Content-warned short notes: `{ kinds: [1], "#content-warning": [] }`
   - Content-warned events by a specific author: `{ authors: ["<pubkey-hex>"], "#content-warning": [] }`
   - Content-warned articles: `{ kinds: [30023], "#content-warning": [] }`

3. **Read the responses.** Reads are free and speak plain NIP-01, so each EVENT is standard JSON -- read the content-warning tag and its reason value straight off it.

4. **Process the results.** For each event, check whether it has a reason string. Group or categorize events by their content-warning reasons if building a moderation interface.

### Considerations

- Not all relays support filtering by arbitrary tag names like `#content-warning`. If the relay does not support this filter, you may need to fetch events by kind or author and filter client-side for the presence of the content-warning tag.
- Reading and subscribing is free on TOON -- no ILP payment is needed for queries.
- The content-warning reason is freeform text, so there is no guaranteed vocabulary. A moderation dashboard should normalize common variations (e.g., "nsfw", "NSFW", "nudity" might all refer to similar content).
