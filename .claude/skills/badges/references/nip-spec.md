# NIP-58 Specification: Badges

> **Why this reference exists:** Agents need precise event structures to construct valid badge events. This file covers the wire format for kind:30009 (badge definition), kind:8 (badge award), and kind:30008 (profile badges). Understanding these structures prevents malformed events that waste ILP payment on rejected publishes.

## kind:30009 -- Badge Definition

kind:30009 is a **parameterized replaceable event** (per NIP-01). The `d` tag serves as the badge identifier. Only the most recent kind:30009 from a given pubkey with the same `d` tag value is retained by relays. Publishing a new kind:30009 with the same `d` tag replaces the previous definition.

### Event Structure

```
{
  "kind": 30009,
  "content": "",
  "tags": [
    ["d", "bravery"],
    ["name", "Medal of Bravery"],
    ["description", "Awarded for acts of bravery in the face of mass adoption challenges"],
    ["image", "https://example.com/badges/bravery.png", "1024x1024"],
    ["thumb", "https://example.com/badges/bravery-thumb.png", "256x256"]
  ]
}
```

### Tag Format

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | Badge identifier, unique per pubkey. Used in `a` tag references: `30009:<pubkey>:<d-tag>` |
| `name` | No | Human-readable badge name |
| `description` | No | What the badge represents and criteria for earning it |
| `image` | No | Badge image URL. Optional second element for dimensions (e.g., `1024x1024`) |
| `thumb` | No | Thumbnail image URL. Optional second element for dimensions (e.g., `256x256`) |

### Content Field

The `content` field is typically an empty string. It may optionally contain a description, but the `description` tag is the standard location for badge descriptions.

### Parameterized Replaceable Semantics

- The combination of `kind` + `pubkey` + `d` tag value uniquely identifies a badge definition
- Publishing a new kind:30009 with the same `d` tag replaces the previous version
- The badge creator can update the name, description, and images by republishing
- Different `d` tag values from the same pubkey define different badges
- The `d` tag value is used in `a` tag references throughout the badge system

### Badge Addressability

A badge definition is referenced using an `a` tag with the format:

```
["a", "30009:<creator-pubkey-hex>:<d-tag-value>"]
```

Example: `["a", "30009:a1b2c3d4...:<bravery>"]` references the "bravery" badge created by pubkey `a1b2c3d4...`.

## kind:8 -- Badge Award

kind:8 is a **regular (non-replaceable) event**. Each award event is a permanent, individual record. The same badge can be awarded multiple times to different recipients via separate events, or to multiple recipients in a single event.

### Event Structure

```
{
  "kind": 8,
  "content": "",
  "tags": [
    ["a", "30009:a1b2c3d4e5f6...:<bravery>"],
    ["p", "recipient1-pubkey-hex"],
    ["p", "recipient2-pubkey-hex"],
    ["p", "recipient3-pubkey-hex"]
  ]
}
```

### Tag Format

| Tag | Required | Description |
|-----|----------|-------------|
| `a` | Yes | Reference to the badge definition: `30009:<creator-pubkey>:<d-tag>` |
| `p` | Yes | Awardee pubkey (hex). One `p` tag per recipient. Multiple `p` tags for batch awards. |

### Content Field

The `content` field must be an empty string.

### Award Semantics

- **Only the badge creator can award:** The pubkey signing the kind:8 event must match the pubkey in the `a` tag reference. Awards signed by non-creators are invalid.
- **Multiple recipients:** Include multiple `p` tags to award the same badge to several recipients in one event. Each `p` tag adds ~70 bytes.
- **Non-replaceable:** Each kind:8 event is permanent. You cannot "update" an award -- only delete it via kind:5.
- **One badge per award:** Each kind:8 references exactly one badge definition via a single `a` tag.

### Verification

Clients should verify badge awards by checking:
1. The `a` tag references a valid kind:30009 event
2. The kind:8 event is signed by the same pubkey that created the kind:30009
3. The recipient's pubkey appears in the `p` tags

## kind:30008 -- Profile Badges

kind:30008 is a **parameterized replaceable event** with `d` tag value `profile_badges`. It curates which badges a user chooses to display on their profile. Only the latest kind:30008 from a pubkey with `d` = `profile_badges` is retained.

### Event Structure

```
{
  "kind": 30008,
  "content": "",
  "tags": [
    ["d", "profile_badges"],
    ["a", "30009:creator1-pubkey:<badge-id-1>"],
    ["e", "award-event-id-1"],
    ["a", "30009:creator2-pubkey:<badge-id-2>"],
    ["e", "award-event-id-2"],
    ["a", "30009:creator1-pubkey:<badge-id-3>"],
    ["e", "award-event-id-3"]
  ]
}
```

### Tag Format

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | Always `profile_badges` |
| `a` | Yes (per badge) | Reference to badge definition: `30009:<creator-pubkey>:<d-tag>` |
| `e` | Yes (per badge) | Event ID of the kind:8 award event for this badge |

### Content Field

The `content` field must be an empty string.

### Paired Tag Structure

The `a` and `e` tags must appear in **consecutive pairs**:
- Each `a` tag identifies which badge definition is being displayed
- The immediately following `e` tag references the specific kind:8 award event that granted the badge to this user
- The order of pairs determines display order
- Clients verify each pair: the `e` event must be a valid kind:8 awarding the referenced badge to the profile owner

### Profile Badge Semantics

- **Owner-controlled:** Only the profile owner publishes their kind:30008 event. No one else can add badges to your profile display.
- **Curated selection:** Users choose which earned badges to display. Not all awarded badges need to be shown.
- **Replaceable:** Each update replaces the entire badge display. Include all badges you want to show in every update.
- **Verification chain:** For each displayed badge, clients should verify: kind:30009 exists (badge is defined) -> kind:8 exists and is signed by the badge creator (badge was awarded) -> kind:8 contains the profile owner's pubkey in a `p` tag (badge was awarded to this user).

## Querying Badge Events

### Finding All Badges Created by a Pubkey

```
Filter: { kinds: [30009], authors: ["<creator-pubkey>"] }
```

### Finding a Specific Badge Definition

```
Filter: { kinds: [30009], authors: ["<creator-pubkey>"], "#d": ["<badge-id>"] }
```

### Finding All Awards of a Specific Badge

```
Filter: { kinds: [8], authors: ["<creator-pubkey>"], "#a": ["30009:<creator-pubkey>:<badge-id>"] }
```

### Finding All Badges Awarded to a User

```
Filter: { kinds: [8], "#p": ["<recipient-pubkey>"] }
```

### Finding a User's Profile Badge Display

```
Filter: { kinds: [30008], authors: ["<user-pubkey>"], "#d": ["profile_badges"] }
```
