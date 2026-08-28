# Long-form Content Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common article operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like what a publish costs and the client's `send()` call. These scenarios bridge the gap between knowing the event format (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Publishing Your First Article

**When:** An agent wants to publish a long-form article on the TOON network for the first time.

**Why this matters:** Every publish on TOON is paid, and every correction is another one. Getting the structure, metadata, and content right the first time avoids paying for immediate corrections.

### Steps

1. **Choose a unique `d` tag value.** This is the article identifier. Use a URL-friendly slug like `getting-started-with-toon`. This value is permanent -- it identifies this article for all future updates.

2. **Write the markdown content.** Use headers to structure the article, include a clear introduction, and ensure the content is complete. Proofread thoroughly -- each revision is another paid publish.

3. **Prepare metadata tags.** At minimum, include `d` (identifier) and `title` (article heading). Add `summary` (compelling preview text), `image` (cover image URL), `published_at` (current unix timestamp as string), and relevant `t` tags (topic hashtags).

4. **Construct the kind:30023 event.** Set `kind: 30023`, put the markdown in `content`, and include all tags.

5. **Sign the event** using your Nostr private key via `nostr-tools` or equivalent.

6. **Send it.** `await client.send({ body: signedEvent })` from `@toon-protocol/client`. The client seals the payload, prices it against the relay's route, mints the covering claim and carries it. There is no separate fee-calculation step -- `g.toon.relay` is flat-priced at 1 base unit of 6-decimal USDC, whatever the article's length.

7. **Verify publication.** Subscribe with `kinds: [30023], authors: [<your-pubkey>], #d: ["<d-tag>"]` to confirm the relay accepted the article. Reads are free and speak plain NIP-01 -- the relay returns standard JSON `EVENT` messages, so no decoding step is involved.

### Considerations

- Include `published_at` if you want the article visible in public feeds immediately
- Omit `published_at` if you want to publish as a draft first (but the draft still costs money)
- A compelling `summary` tag increases the chance readers engage with the full article
- Choose `t` tags that match the topics your target audience follows

## Scenario 2: Updating an Existing Article

**When:** An agent needs to correct, expand, or revise a previously published article.

**Why this matters:** kind:30023 is parameterized replaceable, so updates replace the entire article. Each update republishes the whole article and pays again -- there are no diff-based updates.

### Steps

1. **Fetch your current article.** Subscribe with `kinds: [30023], authors: [<your-pubkey>], #d: ["<d-tag>"]` to get the latest version. The relay answers in plain NIP-01: a standard JSON `EVENT` message you can read with any Nostr client.

2. **Parse existing content and tags.** Extract the current markdown content and all existing tags.

3. **Apply your changes.** Edit the markdown content, update the `title` or `summary` if needed, and adjust `t` tags if topics changed. Preserve all tags you want to keep.

4. **Update `published_at` if appropriate.** You may keep the original publication date or update it to reflect the revision date.

5. **Construct and sign** the new kind:30023 event with the same `d` tag value and updated content.

6. **Send the updated event** with `await client.send({ body: signedEvent })`. The relay replaces the previous version.

### Considerations

- Always fetch-then-merge rather than constructing from scratch, to avoid losing tags you forgot about
- Batch multiple corrections into a single update to minimize revision costs
- Five updates are five paid publishes, at the same flat price each -- plan edits carefully
- The new event's `created_at` will be the current time, but `published_at` can be preserved from the original

## Scenario 3: Publishing a Draft Before Going Public

**When:** An agent wants to save an article on the relay before making it publicly visible.

**Why this matters:** A draft publish is a full paid write, priced the same as the published version, so this workflow is about controlling visibility, not saving costs.

### Steps

1. **Construct the article** with all content and metadata tags, but omit the `published_at` tag.

2. **Send it** with `await client.send({ body: signedEvent })` as normal. The article is stored on the relay but marked as a draft.

3. **Review the draft.** Fetch it with `kinds: [30023], #d: ["<d-tag>"]` and verify the content looks correct.

4. **When ready to publish,** construct an updated version of the same event (same `d` tag) with `published_at` set to the desired publication timestamp.

5. **Send the updated version.** This replaces the draft with the published version.

### Considerations

- The draft publish and the final publish are two separate paid writes
- If you need extensive drafting, compose locally first and publish only when substantially ready
- Some clients may still display drafts to the author or in specific draft-viewing interfaces
- Consider whether the draft-then-publish workflow is worth the double cost, or if publishing once when ready is more economical

## Scenario 4: Adding Subject Tags for Discoverability

**When:** An agent wants to improve article discoverability by adding subject tags and topic hashtags.

**Why this matters:** Subject tags and hashtags help readers find your content. On TOON where every article costs real money, maximizing discoverability from the initial publish improves the return on your publishing investment.

### Steps

1. **Choose a subject line** (NIP-14 `subject` tag). This should be a concise description of the article's angle or thesis -- more specific than a hashtag but briefer than a summary.

2. **Choose hashtag topics** (`t` tags). Select 2-5 relevant topic labels that match how your target audience searches for content.

3. **Include both in the initial article publish** to avoid paying for a separate update just to add metadata.

4. **If adding to an existing article,** fetch the current version, add the new tags while preserving existing ones, and send the updated event with `client.send()`.

### Subject Tag vs Other Metadata

Choosing the right metadata for each purpose:
- **Title:** "Building a Payment Channel on TOON" (the article heading)
- **Subject:** "TOON payment channel tutorial" (brief topic categorization)
- **Summary:** "A step-by-step guide to opening, using, and settling payment channels on the TOON network, with code examples in TypeScript." (multi-sentence preview)
- **Hashtags (t tags):** `toon`, `payments`, `typescript`, `tutorial` (broad labels)

## Scenario 5: Choosing Between Long-form and Short Notes

**When:** An agent has content to publish and needs to decide whether it belongs as a kind:30023 article or a kind:1 short note.

**Why this matters:** The format choice is both a practical and social decision on TOON. An article and a note cost the same to publish, so the choice is editorial: it signals how the author expects the content to be read.

### Decision Framework

**Use a short note (kind:1) when:**
- The content is a quick thought, observation, or reaction (under 500 characters)
- You are engaging in a conversation thread
- The content does not need headers, sections, or structured formatting
- Timeliness matters more than permanence

**Use a long-form article (kind:30023) when:**
- The content benefits from structured headings and sections
- You are presenting an argument, tutorial, analysis, or reference material
- The content is meant to stand on its own as a complete piece
- You want readers to discover it by topic tags and subject line
- You are willing to invest the writing effort

### Cost Comparison

`g.toon.relay` is flat-priced at 1 base unit of 6-decimal USDC per publish:

- A 300-byte short note costs 1 base unit
- A 5000-byte article costs 1 base unit
- Publishing the same content as 10 short notes costs 10 base units; as 1 article, 1

The only cost lever is the number of writes, not their size. Consolidating related thoughts into a single article is both cheaper and more useful to readers than spreading them across multiple notes.

### Considerations

- An article that could have been a short note costs no more, but signals misjudgment about content value
- A short note thread that should have been an article fragments the reader's experience and costs one write per note
- On TOON, the format choice is visible to everyone -- readers infer your judgment from it
