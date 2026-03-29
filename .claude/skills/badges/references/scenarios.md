# Badge Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common badge operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like fee calculation and the publishEvent API. These scenarios bridge the gap between knowing the event format (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Creating a Badge Definition

**When:** An agent or community leader wants to define a new badge that can be awarded to others.

**Why this matters:** The badge definition establishes the badge's identity and visual representation. On TOON, creating a badge costs money, so design it well the first time. The badge definition is parameterized replaceable, so it can be updated later, but each update incurs a fee.

### Steps

1. **Choose a badge identifier.** The `d` tag value is the unique badge ID within your pubkey namespace. Use a descriptive, URL-safe string (e.g., `early-adopter`, `top-contributor`, `verified-builder`). This cannot be changed after awards reference it without breaking the reference chain.

2. **Define badge metadata.** Set the `name` tag (human-readable name), `description` tag (criteria for earning the badge), and optionally `image` and `thumb` tags for visual representation.

3. **Construct the kind:30009 event.** Build the event with all desired tags. The `content` field should be an empty string (or optionally contain a description).

```
{
  "kind": 30009,
  "content": "",
  "tags": [
    ["d", "early-adopter"],
    ["name", "Early Adopter"],
    ["description", "Awarded to users who joined before the public launch"],
    ["image", "https://example.com/badges/early-adopter.png", "512x512"],
    ["thumb", "https://example.com/badges/early-adopter-thumb.png", "128x128"]
  ]
}
```

4. **Sign the event** using your Nostr private key via `nostr-tools` or equivalent.

5. **Calculate the fee.** Estimate event size (typically 300-500 bytes). At default `basePricePerByte` of 10n, cost is ~$0.003-$0.005.

6. **Publish via `publishEvent()`** from `@toon-protocol/client`. The client handles TOON encoding, ILP payment, and relay communication.

7. **Verify publication.** Subscribe with `kinds: [30009], authors: [<your-pubkey>], #d: ["early-adopter"]` to confirm the relay accepted the badge definition. Remember that relay responses use TOON-format strings.

### Considerations

- Choose the `d` tag value carefully -- once awards reference it via `a` tags, changing it breaks the link
- Host badge images on reliable storage; consider using NIP-96 or Arweave for permanence (see `media-and-files` skill)
- Include a clear `description` so recipients and verifiers understand what the badge represents
- A badge's value derives from the issuer's reputation, not the badge's label

## Scenario 2: Awarding a Badge

**When:** A badge creator wants to award a previously defined badge to one or more recipients.

**Why this matters:** Badge awards are non-replaceable (kind:8) -- each one is permanent and individually priced. Batch awards to multiple recipients in a single event to save on per-event overhead.

### Awarding to a Single Recipient

1. **Identify the badge definition.** You need the `a` tag reference: `30009:<your-pubkey>:<d-tag>`.

2. **Identify the recipient.** You need their hex pubkey.

3. **Construct the kind:8 event.**

```
{
  "kind": 8,
  "content": "",
  "tags": [
    ["a", "30009:<your-pubkey>:early-adopter"],
    ["p", "<recipient-pubkey-hex>"]
  ]
}
```

4. **Sign the event.** The signing pubkey must match the pubkey in the `a` tag (you must be the badge creator).

5. **Calculate the fee.** A single-recipient award is typically ~200-300 bytes = ~$0.002-$0.003.

6. **Publish via `publishEvent()`.**

### Awarding to Multiple Recipients (Batch)

1. **Construct a single kind:8 event with multiple `p` tags.**

```
{
  "kind": 8,
  "content": "",
  "tags": [
    ["a", "30009:<your-pubkey>:early-adopter"],
    ["p", "<recipient1-pubkey-hex>"],
    ["p", "<recipient2-pubkey-hex>"],
    ["p", "<recipient3-pubkey-hex>"],
    ["p", "<recipient4-pubkey-hex>"]
  ]
}
```

2. **Calculate the fee.** Each additional `p` tag adds ~70 bytes. A 4-recipient award is ~400-500 bytes = ~$0.004-$0.005. This is significantly cheaper than four separate award events (~$0.008-$0.012).

3. **Sign and publish via `publishEvent()`.**

### Considerations

- Batch awards save money -- award multiple recipients in a single event when possible
- Awards are non-replaceable. Once published, they cannot be updated, only deleted via kind:5
- Only the badge creator can issue valid awards. Awards signed by other pubkeys are invalid per NIP-58
- Notify recipients out-of-band if needed -- Nostr has no built-in award notification mechanism

## Scenario 3: Displaying Badges on Your Profile

**When:** A user has received badge awards and wants to showcase them on their profile.

**Why this matters:** Profile badges (kind:30008) are a curated display -- you choose which earned badges to show. On TOON, each update costs money, so curate thoughtfully.

### Steps

1. **Find your badge awards.** Subscribe with `kinds: [8], #p: [<your-pubkey>]` to discover all badges awarded to you. Parse the TOON-format responses.

2. **For each award, note:** The `a` tag value (badge definition reference) and the award event's ID.

3. **Optionally verify each badge.** Fetch the kind:30009 badge definition to confirm the badge exists and the award is from the badge creator.

4. **Choose which badges to display.** Select the most meaningful or relevant badges.

5. **Construct the kind:30008 event with paired `a`+`e` tags.**

```
{
  "kind": 30008,
  "content": "",
  "tags": [
    ["d", "profile_badges"],
    ["a", "30009:creator1-pubkey:early-adopter"],
    ["e", "<award-event-id-1>"],
    ["a", "30009:creator2-pubkey:top-contributor"],
    ["e", "<award-event-id-2>"]
  ]
}
```

6. **Sign and publish via `publishEvent()`.** Cost scales with badge count: ~200-600 bytes for 1-5 badges = ~$0.002-$0.006.

7. **Verify publication.** Subscribe with `kinds: [30008], authors: [<your-pubkey>], #d: ["profile_badges"]` to confirm.

### Updating Your Badge Display

1. **Fetch your current kind:30008.** Subscribe with `kinds: [30008], authors: [<your-pubkey>], #d: ["profile_badges"]`. Parse the TOON-format response.

2. **Modify the tag pairs.** Add new `a`+`e` pairs for newly earned badges, remove pairs for badges you no longer want to display, or reorder pairs to change display priority.

3. **Publish the complete updated kind:30008** with all desired badge pairs. This replaces the previous version.

### Considerations

- The `a` and `e` tags must appear in consecutive pairs -- `a` first, then `e` for each badge
- The order of pairs determines display order -- put your most important badges first
- Including too many badges dilutes the signal. Curate for quality over quantity.
- Each update replaces the entire display -- include all badges you want to keep

## Scenario 4: Revoking a Badge

**When:** A badge creator wants to revoke a previously awarded badge.

**Why this matters:** Badge revocation on Nostr is imperfect because it relies on kind:5 deletion requests, which are advisory. However, it is the only mechanism available and is worth understanding.

### Steps

1. **Find the award event.** Subscribe with `kinds: [8], authors: [<your-pubkey>], #a: ["30009:<your-pubkey>:<badge-id>"]` to find the specific kind:8 award event you want to revoke. Note its event ID.

2. **Construct a kind:5 deletion request.**

```
{
  "kind": 5,
  "content": "Badge revoked: no longer meets criteria",
  "tags": [
    ["e", "<award-event-id>"],
    ["k", "8"]
  ]
}
```

3. **Sign and publish via `publishEvent()`.** The deletion request costs ~200-300 bytes = ~$0.002-$0.003.

### Limitations

- **Advisory only.** Relays SHOULD honor kind:5 deletion requests, but compliance is not guaranteed. Some relays may retain the original event.
- **Cached awards persist.** Recipients and clients that have already cached the kind:8 event will still have it. Revocation does not retroactively remove copies.
- **Recipient's profile badges unaffected.** The recipient's kind:30008 profile badges event may still reference the revoked award. The recipient must voluntarily update their profile badges.
- **Verification helps.** Clients that verify badge awards by checking for the original kind:8 event will detect the deletion if the relay honored it.

### Considerations

- Issue badges thoughtfully -- revocation is imperfect and cannot guarantee removal
- Include a clear `content` reason in the kind:5 event to explain the revocation
- For badge systems where revocation is critical, consider off-chain verification mechanisms in addition to kind:5
- The economic cost of revocation (~$0.002-$0.003) is minimal, but the social cost of revoking may be significant -- communicate with the affected party
