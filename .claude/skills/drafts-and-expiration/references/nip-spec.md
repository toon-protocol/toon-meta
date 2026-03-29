# NIP-37 and NIP-40 Specifications: Draft Events and Expiration Timestamps

> **Why this reference exists:** Agents need precise event structures to construct valid draft events and apply expiration timestamps. This file covers the wire format for kind:31234 (draft events), the expiration tag format, and their interaction semantics. Understanding these structures prevents malformed events that waste ILP payment on rejected publishes.

## NIP-37: Draft Events

### kind:31234 -- Draft Event

kind:31234 is a **parameterized replaceable event** (per NIP-01). The `d` tag uniquely identifies each draft per author. For a given pubkey and `d` tag value, only the most recent kind:31234 is retained by relays. Publishing a new event with the same `d` tag replaces the previous draft version.

### Event Structure

```
{
  "kind": 31234,
  "content": "<draft content in the same format as the target kind>",
  "tags": [
    ["d", "<unique-draft-identifier>"],
    ["k", "<target-kind-number>"],
    ["e", "<event-id-being-edited>", "<relay-url>"],
    ["a", "<kind>:<pubkey>:<d-tag>", "<relay-url>"],
    ["title", "My Draft Article"],
    ["summary", "A work in progress"],
    ["t", "nostr"]
  ]
}
```

### Required Tags

| Tag | Format | Purpose |
|-----|--------|---------|
| `d` | `["d", "<identifier>"]` | Unique draft identifier per author. Determines the replaceable slot. |
| `k` | `["k", "<kind-number>"]` | Target kind number as a string. Indicates what kind of event the draft will become when published. |

### Optional Tags

| Tag | Format | Purpose |
|-----|--------|---------|
| `e` | `["e", "<event-id>", "<relay-url>"]` | References an existing non-replaceable event being edited. Used when the draft is a revision of an already-published event. |
| `a` | `["a", "<kind>:<pubkey>:<d-tag>", "<relay-url>"]` | References an existing replaceable event being edited. Used when editing a parameterized replaceable event like a kind:30023 article. |
| Any target tags | Various | All tags the final event would carry (e.g., `title`, `summary`, `image`, `t`, `published_at` for article drafts). These are included so the draft preserves the full intended structure. |

### Content Field

The `content` field contains the draft content in the **same format as the target kind**:

| Target Kind | Content Format |
|-------------|---------------|
| kind:1 (short note) | Plain text |
| kind:30023 (long-form article) | Markdown |
| kind:30315 (user status) | Status text |
| Any other kind | Same content format as that kind |

### Encryption

Drafts are typically encrypted using NIP-44 so only the author can read them. When encrypted:

1. The `content` field contains the NIP-44 encrypted payload
2. Tags that would reveal content (e.g., `title`, `summary`, content-bearing tags) are encrypted within the payload
3. The `d` tag, `k` tag, and structural tags remain unencrypted so the relay can manage replaceable semantics
4. The author encrypts to their own pubkey (self-encryption)

Unencrypted drafts are valid but expose work-in-progress content to anyone reading the relay.

### Draft Lifecycle

#### Creating a New Draft

```
{
  "kind": 31234,
  "content": "# My Article\n\nThis is a work in progress...",
  "tags": [
    ["d", "article-about-toon"],
    ["k", "30023"],
    ["title", "Understanding TOON Protocol"],
    ["t", "toon"],
    ["t", "nostr"]
  ]
}
```

#### Updating an Existing Draft

Publish a new kind:31234 with the same `d` tag. The relay replaces the previous version. Include all tags and the updated content -- there are no diff-based updates.

#### Draft of an Edit to an Existing Article

When drafting changes to an already-published parameterized replaceable event, use the `a` tag:

```
{
  "kind": 31234,
  "content": "# My Updated Article\n\nRevised content here...",
  "tags": [
    ["d", "edit-of-toon-article"],
    ["k", "30023"],
    ["a", "30023:<author-pubkey>:original-article-d-tag", "wss://relay.example.com"],
    ["title", "Understanding TOON Protocol (Revised)"],
    ["t", "toon"]
  ]
}
```

#### Draft of an Edit to a Non-Replaceable Event

When drafting changes to an already-published non-replaceable event, use the `e` tag:

```
{
  "kind": 31234,
  "content": "Corrected version of my note...",
  "tags": [
    ["d", "edit-of-note-abc123"],
    ["k", "1"],
    ["e", "<original-event-id>", "wss://relay.example.com"]
  ]
}
```

#### Publishing from a Draft

1. Read the draft event (kind:31234) from the relay
2. Decrypt the content if encrypted
3. Construct the final event using the target kind from the `k` tag and the draft content/tags
4. Sign and publish the final event
5. Delete the draft by publishing a kind:5 deletion request targeting the draft's `a` coordinate: `["a", "31234:<author-pubkey>:<d-tag>"]`

### Reading Drafts

To fetch your own drafts, use NIP-01 filters:

**All drafts:**
```
{ "kinds": [31234], "authors": ["<own-pubkey>"] }
```

**Drafts for a specific target kind:**
```
{ "kinds": [31234], "authors": ["<own-pubkey>"], "#k": ["30023"] }
```

**A specific draft by identifier:**
```
{ "kinds": [31234], "authors": ["<own-pubkey>"], "#d": ["article-about-toon"] }
```

---

## NIP-40: Expiration Timestamp

### Tag Format

```
["expiration", "<unix-timestamp>"]
```

The value is a string containing a Unix timestamp in seconds. This tag can be added to **any event kind**.

### Behavior Rules

**Relays:**
- SHOULD NOT accept events whose expiration timestamp is already in the past at the time of receipt
- SHOULD delete expired events from storage after the expiration timestamp passes
- MAY continue to serve expired events (not all relays implement expiration)

**Clients:**
- SHOULD check the expiration tag on every event before displaying
- SHOULD hide events whose expiration timestamp has passed, regardless of whether the relay still serves them
- SHOULD NOT rely solely on relay-side expiration enforcement

### Use Cases

| Use Case | Typical Duration | Example |
|----------|-----------------|---------|
| Temporary status | 1-8 hours | Conference attendance, streaming |
| Time-sensitive announcement | 1-7 days | Event promotion, limited offer |
| Ephemeral note | 1-24 hours | Quick thought, temporary poll |
| Seasonal content | Weeks to months | Holiday greetings, seasonal promotions |
| Rotating content | Variable | Rotating pinned note, weekly digest |

### Expiration with Different Event Kinds

The expiration tag works with any event kind:

**Short note with expiration:**
```
{
  "kind": 1,
  "content": "Join us at the meetup tonight at 7pm!",
  "tags": [
    ["expiration", "1700010800"]
  ]
}
```

**User status with expiration (NIP-38):**
```
{
  "kind": 30315,
  "content": "At the conference",
  "tags": [
    ["d", "general"],
    ["expiration", "1700010800"]
  ]
}
```

**Draft with expiration:**
```
{
  "kind": 31234,
  "content": "Work in progress...",
  "tags": [
    ["d", "temp-draft"],
    ["k", "1"],
    ["expiration", "1700100000"]
  ]
}
```

### Calculating Expiration Timestamps

The expiration value is always a Unix timestamp in seconds (not milliseconds):

- **Current time + N hours:** `Math.floor(Date.now() / 1000) + (N * 3600)`
- **Current time + N days:** `Math.floor(Date.now() / 1000) + (N * 86400)`
- **Specific date:** `Math.floor(new Date('2026-04-01T00:00:00Z').getTime() / 1000)`

### Complete Examples

**Expiring announcement (24 hours):**
```
{
  "kind": 1,
  "content": "Flash sale on TOON relay subscriptions! 50% off for the next 24 hours.",
  "tags": [
    ["expiration", "1700096400"],
    ["t", "toon"],
    ["t", "sale"]
  ]
}
```

**Draft with expiration (auto-cleanup stale drafts):**
```
{
  "kind": 31234,
  "content": "# Conference Notes\n\nSpeaker 1: ...",
  "tags": [
    ["d", "conf-notes-2026"],
    ["k", "30023"],
    ["expiration", "1700200000"]
  ]
}
```
