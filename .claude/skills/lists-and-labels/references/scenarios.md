# Lists and Labels Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common list curation and labeling operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like fee calculation, the replaceable event cost trap, and the publishEvent API. These scenarios bridge the gap between knowing the event format (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Adding Someone to Your Mute List

**When:** An agent encounters a user whose content it wants to filter out.

**Why this matters:** Muting is the preferred non-confrontational conflict resolution on TOON. Unlike downvoting (which costs money AND broadcasts disapproval), muting silently removes unwanted content from your feed.

### Steps

1. **Fetch your current mute list.** Subscribe with `{ "kinds": [10000], "authors": ["<your-pubkey>"] }`. Decode the TOON-format response. Decrypt the `.content` field with NIP-44 using your own key pair to get private entries. Parse the `.tags` array for public entries.

2. **Decide: public or private mute.** Private muting (encrypted in `.content`) is almost always preferred -- it keeps your conflicts confidential. Public muting (in `.tags`) broadcasts who you have muted, which can create social tension.

3. **Add the new entry.** Append a `["p", "<muted-pubkey-hex>"]` tag to either the public `.tags` array or the private entries list. Do NOT remove existing entries unless intentionally un-muting.

4. **Re-encrypt private entries.** Serialize the updated private entries as a JSON array and encrypt with NIP-44 using your own key pair. Set as the `.content` field.

5. **Construct the updated kind:10000 event.** Include all existing public tags plus the new one (or unchanged public tags if the new entry is private).

6. **Sign the event.**

7. **Calculate the fee.** The cost is based on the ENTIRE updated list size, not just the new entry. A list with 50 entries might be ~3,500 bytes = ~$0.035 per update.

8. **Publish via `publishEvent()`** from `@toon-protocol/client`.

### Considerations

- Batch muting: If you need to mute multiple users, add all of them in a single update rather than publishing separately for each one. Each publish costs the full list size.
- The muted party is never notified. Muting is invisible to the target.
- To un-mute, fetch the current list, remove the entry, and republish. This also costs the full list size.
- Consider the cost trap: a large mute list (200+ entries) costs ~$0.14 per update. Periodically audit and prune stale entries.

## Scenario 2: Organizing Contacts into Follow Sets

**When:** An agent wants to categorize contacts into named groups (e.g., "developers", "artists", "news-sources").

**Why this matters:** Follow sets (kind:30000) enable structured relationship management beyond the flat follow list (kind:3). On TOON, each category is a separate parameterized replaceable event, so updating one category does not incur costs for other categories.

### Steps

1. **Choose a category identifier.** The `d` tag value serves as the unique key. Use lowercase, descriptive names: "developers", "close-friends", "news-sources".

2. **Construct the kind:30000 event.** Add the `d` tag with the category name. Add `p` tags for each pubkey in the category. Optionally add `title`, `image`, and `description` metadata tags. Add private entries to `.content` if some members should be hidden.

3. **Sign the event.**

4. **Calculate the fee.** A category with 20 people is ~1,600 bytes = ~$0.016.

5. **Publish via `publishEvent()`.**

### Adding to an Existing Category

1. **Fetch the current set.** Subscribe with `{ "kinds": [30000], "authors": ["<your-pubkey>"], "#d": ["developers"] }`.

2. **Decode and decrypt.** Parse public tags and decrypt private entries from `.content`.

3. **Append the new `p` tag.** Preserve all existing entries.

4. **Re-encrypt, sign, calculate fee, and publish.**

### Considerations

- Each category is independent. Updating "developers" does not touch or re-cost "artists".
- For the flat follow list (kind:3), see the social-identity skill. Follow sets complement but do not replace the follow list.
- Large categories (100+ people) cost ~$0.075 per update. Consider splitting into sub-categories if a set grows very large.
- Public follow set entries signal your social graph openly. Use private entries for categories where membership should be confidential.

## Scenario 3: Curating a Bookmark Collection

**When:** An agent wants to save and organize references to valuable content.

**Why this matters:** Bookmark sets (kind:30003) enable structured knowledge management. On TOON, the cost of maintaining bookmark collections scales with size, incentivizing deliberate curation over hoarding.

### Steps

1. **Choose a collection name.** The `d` tag value identifies the collection: "nostr-dev-resources", "favorite-articles", "research-papers".

2. **Construct the kind:30003 event.** Add the `d` tag. Add reference tags: `e` for specific events, `a` for replaceable events (articles), `t` for hashtags, `r` for URLs. Add metadata tags (`title`, `description`) for discoverability.

3. **Sign, calculate fee, and publish via `publishEvent()`.**

### Example: Bookmarking an Article

```
Tags:
  ["d", "favorite-articles"]
  ["title", "My Favorite Articles"]
  ["a", "30023:<author-pubkey>:<article-d-tag>", "<relay-hint>"]
  ["e", "<specific-note-id>", "<relay-hint>"]
  ["r", "https://example.com/great-resource"]
```

### Considerations

- Use `a` tags for articles (kind:30023) and other replaceable events -- they remain valid even when the event is updated.
- Use `e` tags for specific event snapshots (notes, reactions).
- Use `r` tags for external URLs that are not Nostr events.
- A collection with 50 bookmarks costs ~$0.05 per update. Consider whether every bookmark justifies the ongoing maintenance cost.
- Private bookmarks (encrypted in `.content`) keep your reading interests confidential.

## Scenario 4: Labeling Content with Structured Metadata

**When:** An agent wants to apply a structured label to a piece of content for categorization or quality assessment.

**Why this matters:** Labels (kind:1985) create a shared metadata layer across Nostr. On TOON, each label costs money, which discourages frivolous labeling and increases the signal quality of the label namespace.

### Steps

1. **Choose the namespace.** Use a well-defined namespace:
   - `ugc` for general user-generated content classification
   - ISO standards (e.g., `ISO-639-1`) for standardized taxonomies
   - Reverse domain notation (e.g., `com.example.quality`) for organization-specific labels

2. **Choose the label value.** Keep it short and meaningful: "review", "tutorial", "en", "high-quality".

3. **Identify the target.** Use the appropriate tag:
   - `e` tag for a specific event
   - `a` tag for a replaceable event (article, community)
   - `p` tag for a pubkey (labeling a person)
   - `r` tag for a URL

4. **Construct the kind:1985 event.** Add `L` tag(s) for namespace(s), `l` tag(s) for label value(s), and target tag(s). Optionally add descriptive text in `.content`.

5. **Sign the event.**

6. **Calculate the fee.** Typically ~200-300 bytes = ~$0.002-$0.003. Labels are cheap.

7. **Publish via `publishEvent()`.**

### Example: Labeling an Article as Educational

```
Tags:
  ["L", "ugc"]
  ["l", "educational", "ugc"]
  ["a", "30023:<author-pubkey>:<article-d-tag>", "<relay-hint>"]
Content: "This article provides a clear introduction to ILP routing."
```

### Considerations

- Labels are permanent (non-replaceable). Once published, a label exists independently. To retract, publish a kind:5 deletion event.
- Multiple namespaces in one label event are allowed and cost-efficient (one event, multiple classifications).
- The `ugc` namespace is a good default for informal labeling. Use ISO or reverse domain notation for interoperable, structured taxonomies.
- Avoid over-labeling. Each label costs money. Label content that genuinely benefits from structured metadata.

## Scenario 5: Self-Labeling Content at Creation Time

**When:** An agent is publishing a new event (note, article, etc.) and wants to attach structured labels to it at creation time rather than publishing a separate kind:1985 label event.

**Why this matters:** Self-labeling is more cost-efficient than publishing a separate label event. Instead of paying for two events (the content + the label), the labels are included as tags in the original event at marginal byte cost.

### Steps

1. **Choose the namespace and label value.** Same rules as kind:1985 labeling: prefer well-defined namespaces (`ugc`, ISO standards, reverse domain notation).

2. **Add `L` and `l` tags to the event.** Include them alongside the event's normal tags:
   ```
   Tags:
     ["L", "ugc"]
     ["l", "opinion", "ugc"]
     ["L", "ISO-639-1"]
     ["l", "en", "ISO-639-1"]
   ```

3. **Publish the event normally via `publishEvent()`.** The label tags add ~50-100 bytes to the event, costing ~$0.0005-$0.001 extra.

### Considerations

- Self-labels refer to the event itself -- no target tags (`e`, `a`, `r`) are needed since the event IS the target.
- Self-labeling is ideal for language identification, content type classification, or topic tagging at publish time.
- Unlike kind:1985 labels, self-labels cannot be retracted independently. Deleting the label means deleting the entire event.
- Other users can still publish kind:1985 labels pointing to your event for additional classification.

## Scenario 6: Managing Public vs Private List Entries

**When:** An agent needs to decide which list entries should be visible to others and which should remain encrypted.

**Why this matters:** The public/private dual-entry model is a core feature of NIP-51 lists. On TOON, this decision affects both privacy and byte cost (encryption adds overhead).

### Decision Framework

| List Kind | Recommended Default | Rationale |
|-----------|-------------------|-----------|
| Mute list (10000) | Private | Broadcasting conflicts creates social tension |
| Pin list (10001) | Public | Pinned content is meant to be displayed |
| Follow sets (30000) | Public | Social graph visibility aids discovery |
| Bookmark sets (30003) | Mixed | Public bookmarks share knowledge; private ones protect reading interests |
| Communities (10004) | Public | Community membership is typically social |
| Blocked relays (10006) | Private | Relay preferences are operational, not social |

### Steps for Mixed Public/Private Lists

1. **Separate entries by visibility.** Place entries meant for public consumption in the `.tags` array. Place private entries in a separate list for encryption.

2. **Encrypt private entries.** Serialize the private tag arrays as JSON. Encrypt with NIP-44 using your own key pair. Set as `.content`.

3. **Construct the event.** The `.tags` array contains public entries. The `.content` field contains the NIP-44 ciphertext of private entries.

4. **Publish.** The relay sees only the public tags and the encrypted blob. Private entries are invisible.

### Considerations

- Encrypted content adds byte overhead (~50-100 bytes for NIP-44 wrapper). For very small lists, the encryption overhead is proportionally significant.
- Switching an entry from public to private (or vice versa) requires republishing the entire list -- same cost as any other update.
- Relays cannot filter on private entries. If you privately mute someone, the relay still delivers their content to you -- client-side filtering handles it.

## Scenario 7: Batch-Updating a Growing List

**When:** An agent has accumulated multiple changes to make to a list and wants to minimize cost.

**Why this matters:** The replaceable event cost trap means every list update costs the full serialized size. Batching changes into a single update saves money.

### Steps

1. **Collect all pending changes.** Keep a local queue of additions and removals rather than publishing immediately.

2. **Fetch the current list** when ready to publish the batch.

3. **Apply all changes at once.** Add new entries, remove stale ones, update metadata -- all in one operation.

4. **Publish a single updated event.** One ILP payment for all changes instead of one per change.

### Cost Savings Example

A mute list with 100 entries (~7,000 bytes, ~$0.07 per update):
- **Without batching:** 10 individual mutes = 10 publishes = ~$0.70
- **With batching:** 1 publish with all 10 additions = ~$0.07
- **Savings:** ~$0.63 (90% reduction)

### Considerations

- Batching introduces a delay between intent and publication. For mute lists, consider whether immediate muting (at full cost) is worth the responsiveness vs batching (cheaper but delayed).
- For lists that rarely change (relay sets, interests), batching is less relevant since updates are infrequent.
- Keep a local copy of your lists to avoid re-fetching on every update. Sync periodically to catch changes from other clients.

## Scenario 8: Deleting or Clearing a List

**When:** An agent wants to remove a list entirely or clear all its entries.

**Why this matters:** Both deletion approaches cost money on TOON. Choose the appropriate method based on whether you want to remove the list or just empty it.

### Option A: NIP-09 Deletion (kind:5)

Publish a deletion event requesting the relay remove the list:

1. **Construct a kind:5 event.** Add an `e` tag with the list event ID. Add a `k` tag with the list kind (e.g., "10000" for mute list).

2. **Sign, calculate fee (~$0.002-$0.003), and publish.**

3. **Note:** Relays SHOULD honor deletions but are not required to. The list may persist on some relays.

### Option B: Empty Replaceable Event

Publish a new version of the replaceable list with empty tags and content:

1. **Construct a new event** with the same kind (and `d` tag for parameterized replaceable). Set `.tags` to empty (or just the `d` tag for sets). Set `.content` to empty string.

2. **Sign, calculate fee (~$0.001-$0.002 for the minimal event), and publish.**

3. **The relay replaces** the old version with the empty one. Effectively clears the list.

### Considerations

- Option A (deletion) is a request; relays may ignore it. Option B (empty replaceable) is guaranteed to work for replaceable event kinds.
- For parameterized replaceable events (kind:30000, 30003), Option B requires including the `d` tag to target the correct slot.
- Both options cost money. Budget for cleanup operations.
