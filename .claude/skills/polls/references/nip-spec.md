# NIP Specification: Polls (NIP-88)

> **Why this reference exists:** Agents need precise event structures to construct valid poll and vote events. This file covers the wire format for kind:1068 (poll events) and kind:1018 (poll responses). Understanding these structures prevents malformed events that waste ILP payment on rejected publishes.

## kind:1068 -- Poll Events

kind:1068 is a **regular event** (non-replaceable). Each poll creates a new, permanent event that defines a question with a set of options for respondents to choose from.

### Event Structure (Basic Poll)

```
{
  "kind": 1068,
  "content": "Should we implement NIP-88 polls on TOON?",
  "tags": [
    ["option", "0", "Yes"],
    ["option", "1", "No"],
    ["option", "2", "Maybe later"]
  ]
}
```

### Event Structure (Timed Poll with Preferred Relay)

```
{
  "kind": 1068,
  "content": "What feature should we build next?",
  "tags": [
    ["option", "0", "Polls"],
    ["option", "1", "Badges"],
    ["option", "2", "Communities"],
    ["option", "3", "Encrypted DMs"],
    ["relay", "wss://relay.example.com"],
    ["endsAt", "1711929600"]
  ]
}
```

### Event Structure (Range/Rating Poll)

```
{
  "kind": 1068,
  "content": "How would you rate the new relay performance? (1-5)",
  "tags": [
    ["option", "0", "1 - Poor"],
    ["option", "1", "2 - Fair"],
    ["option", "2", "3 - Good"],
    ["option", "3", "4 - Very Good"],
    ["option", "4", "5 - Excellent"],
    ["valueMinimum", "0"],
    ["valueMaximum", "4"]
  ]
}
```

### Content Field

The content field contains the poll question text. This is the human-readable question that voters see. Keep it clear and concise -- longer questions increase the event byte size and cost on TOON.

### Tag Reference

| Tag | Required | Description |
|-----|----------|-------------|
| `option` | Yes (2+) | Poll option. Format: `["option", "<index>", "<label>"]`. Index is a string integer starting from `"0"`. Label is the human-readable option text. At least two options required. |
| `relay` | No | Preferred relay for poll responses. Format: `["relay", "<relay-url>"]`. Helps aggregate votes in one place. |
| `endsAt` | No | Unix timestamp (seconds) when the poll ends. Format: `["endsAt", "<unix-timestamp>"]`. Clients should stop accepting votes after this time. |
| `closedAt` | No | Unix timestamp when the poll creator manually closed the poll. Format: `["closedAt", "<unix-timestamp>"]`. Published as an update signal. |
| `valueMinimum` | No | Minimum option index for range polls. Format: `["valueMinimum", "<index>"]`. Presence indicates a range/rating poll type. |
| `valueMaximum` | No | Maximum option index for range polls. Format: `["valueMaximum", "<index>"]`. Used with `valueMinimum` to define the range. |
| `consensusThreshold` | No | Percentage threshold for consensus. Format: `["consensusThreshold", "<percentage>"]`. Indicates the minimum agreement level for a result to be considered decisive. |

### Option Tag Semantics

- Option indices are string integers starting from `"0"` and incrementing sequentially
- Option labels are human-readable text describing each choice
- The number of options is not limited, but more options increase event size and cost
- Option indices must be unique within a poll

### Poll Type Determination

Poll types are determined by the presence of specific tags:

| Poll Type | Determining Factor |
|-----------|-------------------|
| Single choice | Default -- no special tags needed. Voters submit one `response` tag. |
| Multiple choice | Convention-based -- voters may submit multiple `response` tags. The poll creator signals this in the question text. |
| Range/Rating | Presence of `valueMinimum` and `valueMaximum` tags. Options represent points on a scale. |

## kind:1018 -- Poll Responses (Votes)

kind:1018 is a **regular event** (non-replaceable). Each vote creates a new, permanent event. A user should only vote once per poll, but enforcement is client-side -- relays do not prevent duplicate votes.

### Event Structure (Single Choice Vote)

```
{
  "kind": 1018,
  "content": "",
  "tags": [
    ["e", "<poll-event-id-hex>"],
    ["response", "0"]
  ]
}
```

### Event Structure (Multiple Choice Vote)

```
{
  "kind": 1018,
  "content": "",
  "tags": [
    ["e", "<poll-event-id-hex>"],
    ["response", "0"],
    ["response", "2"]
  ]
}
```

### Content Field

The content field is always an empty string for poll responses. The vote is expressed entirely through tags.

### Tag Reference

| Tag | Required | Description |
|-----|----------|-------------|
| `e` | Yes | The event ID of the poll being responded to. Format: `["e", "<poll-event-id-hex>"]`. |
| `response` | Yes (1+) | The option index being voted for. Format: `["response", "<option-index>"]`. The index must match one of the `option` tag indices from the poll event. For single-choice polls, include one `response` tag. For multiple-choice polls, include multiple `response` tags. |

### Vote Semantics

- Each kind:1018 event is an independent vote -- publishing multiple votes to the same poll creates duplicate entries
- Clients should check for existing votes from the same pubkey and display only the most recent one
- The `response` value must match a valid option index from the referenced poll event
- Votes cast after the `endsAt` timestamp may be ignored by clients aggregating results
- There is no "unvote" mechanism -- to retract a vote, publish a kind:5 deletion event targeting the vote's event ID

## Filtering and Querying

To fetch polls and votes, use NIP-01 subscription filters:

- **All polls:** `{ kinds: [1068] }`
- **Polls by a specific author:** `{ kinds: [1068], authors: ["<pubkey>"] }`
- **All votes on a specific poll:** `{ kinds: [1018], "#e": ["<poll-event-id>"] }`
- **All votes by a specific user:** `{ kinds: [1018], authors: ["<pubkey>"] }`
- **Polls within a time range:** `{ kinds: [1068], since: <timestamp>, until: <timestamp> }`

### Aggregating Results

To tally poll results:

1. Subscribe to `{ kinds: [1018], "#e": ["<poll-event-id>"] }` to get all votes
2. Group votes by the `response` tag value (option index)
3. Deduplicate by voter pubkey -- if a pubkey has multiple votes, use the most recent (highest `created_at`)
4. Count unique voters per option
5. Check the poll's `endsAt` tag -- discard votes with `created_at` after the deadline if set
