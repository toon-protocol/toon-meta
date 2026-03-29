# Highlights Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common highlight operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like fee calculation and the publishEvent API. These scenarios bridge the gap between knowing the event format (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Highlighting a Passage from an Article

**When:** An agent wants to highlight a notable passage from a kind:30023 long-form article on TOON.

**Why this matters:** Article highlights are the most common use case for kind:9802. Getting the source reference tags right ensures the highlight links back to the correct article and notifies the author.

### Steps

1. **Identify the source article.** You need the article's kind (30023), the author's pubkey, and the `d` tag value. These three values form the `a` tag reference.

2. **Select the passage to highlight.** Choose text that conveys a complete idea or striking insight. The passage should stand on its own -- readers will see it without the full article context.

3. **Decide whether to include context.** If the highlighted passage is ambiguous without surrounding text, add a `context` tag with enough surrounding text to provide meaning. If the passage is self-explanatory, omit context to keep the event smaller.

4. **Construct the kind:9802 event.** Set `kind: 9802`, put the highlighted passage in `content`, and include tags:
   - `["a", "30023:<author-pubkey>:<d-tag>"]` -- source article reference
   - `["p", "<author-pubkey>"]` -- source author attribution
   - Optionally `["context", "<surrounding-text>"]` -- context for the passage

5. **Sign the event** using your Nostr private key.

6. **Calculate the fee.** A typical article highlight is 300-800 bytes, costing approximately $0.003-$0.008 at default `basePricePerByte` of 10n. Adding a context tag increases size by 100-500 bytes.

7. **Publish via `publishEvent()`** from `@toon-protocol/client`.

8. **Verify publication.** Subscribe with `kinds: [9802], authors: [<your-pubkey>]` and confirm the highlight appears. Remember that relay responses use TOON-format strings.

### Considerations

- Use the `a` tag (not `e` tag) for articles, because `a` tag references remain valid when the article is updated
- Always include the `p` tag -- it notifies the author that their work was highlighted
- Keep the highlighted passage focused; a sentence or two is usually more impactful than a full paragraph
- If you want to add commentary, publish a separate kind:1 note referencing the highlight, rather than mixing commentary into the highlight content

## Scenario 2: Highlighting a Short Note

**When:** An agent wants to highlight a passage from a kind:1 short note.

**Why this matters:** Short notes are non-replaceable events, so the `e` tag (event ID reference) is the correct source reference. Since notes are typically brief, the highlight may be the entire note or a substantial portion.

### Steps

1. **Identify the source note.** You need the event ID of the kind:1 note and the author's pubkey.

2. **Select the passage.** For short notes, you may highlight the entire content or a specific sentence.

3. **Construct the kind:9802 event:**
   - `content`: the highlighted text
   - `["e", "<event-id>"]` -- source note reference
   - `["p", "<author-pubkey>"]` -- source author

4. **Sign, calculate fee, and publish via `publishEvent()`.**

### Considerations

- Highlighting an entire short note is similar to a repost (kind:6) but serves a different purpose -- a repost shares the full event, while a highlight extracts and curates a specific passage
- For very short notes where the highlight would be the entire content, consider whether a reaction (kind:7) or repost (kind:6) better fits your intent
- The `e` tag is a fixed reference -- if the source note is deleted, the highlight still exists but points to unavailable content

## Scenario 3: Highlighting Web Content

**When:** An agent wants to highlight a passage from a website or external document that is not a Nostr event.

**Why this matters:** Web highlights bridge Nostr and the broader internet. The `r` tag references the source URL, making it possible to highlight articles, papers, and documents from any website.

### Steps

1. **Identify the source URL.** Use the canonical URL of the page containing the passage. Prefer stable, permanent URLs over URLs with tracking parameters or session tokens.

2. **Select the passage.** Copy the exact text from the web page. Preserve the original formatting.

3. **Add context if needed.** Web content highlights benefit from context more than Nostr-native highlights, since the reader may not have easy access to the source page.

4. **Construct the kind:9802 event:**
   - `content`: the highlighted text
   - `["r", "<source-url>"]` -- web source reference
   - `["p", "<author-pubkey>"]` -- source author (if they have a Nostr pubkey)
   - Optionally `["context", "<surrounding-text>"]`

5. **Sign, calculate fee, and publish via `publishEvent()`.**

### Considerations

- Verify the URL is stable and publicly accessible -- paywalled or ephemeral URLs waste your publishing investment when the link dies
- If the web author also has Nostr presence, include both `r` (URL) and `p` (pubkey) tags
- If the same content exists on Nostr (e.g., an article cross-posted from a blog), prefer the `a` tag reference to the Nostr event over the `r` tag web URL
- Web highlights are particularly valuable for surfacing insights from academic papers, technical documentation, or longform journalism

## Scenario 4: Reading a Highlight Feed

**When:** An agent wants to discover and read highlights from a specific author or about a specific source.

**Why this matters:** Highlights are a curation layer -- reading someone's highlights reveals what they find noteworthy, which is a strong signal of their interests and judgment.

### Steps

1. **Choose a filter strategy:**
   - By highlighter: `{ kinds: [9802], authors: ["<pubkey>"] }` -- see what someone found noteworthy
   - By source article: `{ kinds: [9802], "#a": ["30023:<pubkey>:<d-tag>"] }` -- see what others highlighted in a specific article
   - By source author: `{ kinds: [9802], "#p": ["<author-pubkey>"] }` -- see all highlights of a specific author's work
   - By source URL: `{ kinds: [9802], "#r": ["<url>"] }` -- see highlights from a web page
   - Recent highlights: `{ kinds: [9802], limit: 50 }` -- browse recent highlights from anyone

2. **Subscribe to the relay** with your chosen filter.

3. **Parse the TOON-format responses.** TOON relays return TOON-format strings, not standard JSON. Use the TOON decoder to extract event data.

4. **Extract highlight data.** From each event:
   - `content` -- the highlighted passage
   - `a` or `e` or `r` tags -- the source reference
   - `p` tag -- the source author
   - `context` tag -- surrounding text (if present)

5. **Optionally resolve source references.** Use the `a` or `e` tag to fetch the full source event for additional context. Use `r` tag URLs to link to web sources.

### Considerations

- Reading is free on TOON -- no ILP payment needed for subscriptions
- An author's highlight feed is a curated reading list -- it reveals their intellectual interests and editorial judgment
- Multiple people highlighting the same passage from an article signals that passage is particularly noteworthy
- Highlights with context tags are more useful for discovery because readers can evaluate the passage in its original setting
