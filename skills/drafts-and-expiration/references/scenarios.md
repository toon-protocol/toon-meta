# Drafts and Expiration Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common draft and expiration operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like fee calculation and the publishEvent API. These scenarios bridge the gap between knowing the event format (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Saving a Draft Article

**When:** An agent is composing a long-form article and wants to save progress to the relay for cross-device access or backup.

**Why this matters:** On TOON, each draft save costs money. Compose locally first, then save to the relay when you have a meaningful checkpoint -- not on every keystroke.

### Steps

1. **Compose locally first.** Write your article content in markdown format. Do not save to the relay until you have a substantial draft worth preserving.

2. **Choose a draft identifier.** Pick a unique `d` tag value that describes this draft. Use something meaningful like `"article-toon-economics"` rather than a random string.

3. **Construct the kind:31234 event.** Include the `k` tag set to `"30023"` (the target kind for long-form articles), and carry forward any tags the final article will need.

```
{
  "kind": 31234,
  "content": "# Understanding TOON Economics\n\nThis article explores the per-byte pricing model...",
  "tags": [
    ["d", "article-toon-economics"],
    ["k", "30023"],
    ["title", "Understanding TOON Economics"],
    ["summary", "An exploration of per-byte pricing on ILP-gated relays"],
    ["t", "toon"],
    ["t", "economics"]
  ]
}
```

4. **Encrypt the draft (recommended).** Use NIP-44 to encrypt the content to your own pubkey. This prevents others from reading your work-in-progress. The `d` and `k` tags remain unencrypted for relay management.

5. **Sign the event** using your Nostr private key via `nostr-tools` or equivalent.

6. **Calculate the fee.** A draft article (500-2000 bytes depending on length) costs approximately $0.005-$0.020 at default `basePricePerByte` of 10n.

7. **Publish via `publishEvent()`** from `@toon-protocol/client`. The client handles TOON encoding, ILP payment, and relay communication.

### Considerations

- Each subsequent save with the same `d` tag replaces the previous draft (parameterized replaceable). You pay per save but the relay only stores the latest version.
- Include all intended tags (title, summary, t) in the draft so the full structure is preserved for when you publish the final article.
- If you are drafting an edit to an existing article, include the `a` tag referencing the original: `["a", "30023:<pubkey>:<original-d-tag>"]`.

## Scenario 2: Publishing from a Draft

**When:** An agent has finished composing a draft and wants to publish the final version as a proper article (or note, or any target kind).

**Why this matters:** Publishing from a draft involves three steps on TOON: reading the draft (free), publishing the final event (paid), and deleting the draft (paid). This is a deliberate workflow that signals content readiness.

### Steps

1. **Fetch your draft.** Subscribe with filter `{ "kinds": [31234], "authors": ["<own-pubkey>"], "#d": ["article-toon-economics"] }`. Remember that TOON relays return TOON-format strings -- use the TOON decoder to parse.

2. **Decrypt the content** if the draft was encrypted (NIP-44 decryption with your own key).

3. **Construct the final event.** Use the target kind from the `k` tag (e.g., kind:30023 for articles). Copy the content and relevant tags from the draft. Add `published_at` with the current Unix timestamp to signal the article is ready.

```
{
  "kind": 30023,
  "content": "# Understanding TOON Economics\n\nThis article explores the per-byte pricing model...",
  "tags": [
    ["d", "toon-economics"],
    ["title", "Understanding TOON Economics"],
    ["summary", "An exploration of per-byte pricing on ILP-gated relays"],
    ["published_at", "1700000000"],
    ["t", "toon"],
    ["t", "economics"]
  ]
}
```

4. **Sign and publish the final event** via `publishEvent()`. The article (kind:30023) costs approximately $0.02-$0.20 depending on length.

5. **Delete the draft.** Publish a kind:5 deletion request targeting the draft's replaceable coordinate.

```
{
  "kind": 5,
  "content": "Published as final article",
  "tags": [
    ["a", "31234:<own-pubkey>:article-toon-economics"],
    ["k", "31234"]
  ]
}
```

6. **Verify publication.** Subscribe to your own kind:30023 events with `#d: ["toon-economics"]` to confirm the relay accepted the article.

### Considerations

- The draft `d` tag and the final article `d` tag do not need to match. The draft identifier is for your workflow; the article identifier is for the published content.
- The deletion request (kind:5) costs approximately $0.001-$0.002 -- a small cleanup cost.
- Total cost: draft saves + final publish + deletion. For a typical article: ~$0.01 (draft) + ~$0.05 (article) + ~$0.002 (deletion) = ~$0.062.

## Scenario 3: Adding Expiration to a Short Note

**When:** An agent wants to publish a time-sensitive note that should auto-expire, such as a meetup announcement, temporary offer, or event reminder.

**Why this matters:** Expiring content on TOON eliminates the need for a separate deletion event later. The relay discards it automatically, saving money and keeping the network clean.

### Steps

1. **Determine the expiration time.** Calculate the Unix timestamp when the content becomes irrelevant. For a meetup tonight at 9pm: use the Unix timestamp for 9pm (or add a buffer, e.g., midnight).

2. **Construct the kind:1 event** with the expiration tag.

```
{
  "kind": 1,
  "content": "Nostr meetup tonight at The Coffee House, 7pm. Everyone welcome!",
  "tags": [
    ["expiration", "1700013600"],
    ["t", "meetup"],
    ["t", "nostr"]
  ]
}
```

3. **Sign the event** using your Nostr private key.

4. **Calculate the fee.** A short note with expiration (200-350 bytes) costs approximately $0.002-$0.0035 at default pricing.

5. **Publish via `publishEvent()`** from `@toon-protocol/client`.

6. **No cleanup needed.** After the expiration timestamp passes, relays discard the event and clients hide it.

### Considerations

- The expiration tag adds only ~20-30 bytes to the event -- negligible cost overhead (~$0.0002-$0.0003).
- Set expiration conservatively. If the meetup runs until 10pm, set expiration for midnight to give late readers a chance to see it.
- Relays MAY still serve expired events. Well-behaved clients check the expiration tag and hide expired content regardless.
- Compare with the alternative: publishing a note ($0.003) then deleting it later with kind:5 ($0.002) = $0.005 total. Expiration saves approximately $0.002 (the deletion cost).

## Scenario 4: Setting an Expiring Status

**When:** An agent wants to set a user status that auto-clears after a specific duration, such as conference attendance, a streaming session, or a meeting.

**Why this matters:** Statuses are transient by nature. Using expiration prevents stale statuses and saves the cost of a separate clearing event.

### Steps

1. **Calculate the expiration timestamp.** For a 3-hour conference session: `Math.floor(Date.now() / 1000) + 10800`.

2. **Construct the kind:30315 event** with the expiration tag.

```
{
  "kind": 30315,
  "content": "Speaking at NostCon 2026",
  "tags": [
    ["d", "general"],
    ["r", "https://nostcon.com/schedule"],
    ["expiration", "1700010800"]
  ]
}
```

3. **Sign the event** using your Nostr private key.

4. **Calculate the fee.** An expiring status (300-400 bytes) costs approximately $0.003-$0.004.

5. **Publish via `publishEvent()`** from `@toon-protocol/client`.

### Considerations

- This saves money versus the two-event pattern: set status ($0.003) + clear status later ($0.002) = $0.005. With expiration: one event ($0.004) = 20-40% savings.
- If you need to clear the status early (session cancelled), publish a kind:30315 with empty content and the same `d` tag.
- For detailed status management patterns, see the `user-statuses` skill.
