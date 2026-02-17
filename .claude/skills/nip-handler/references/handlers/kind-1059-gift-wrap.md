# Kind 1059: Gift Wrap (NIP-59)

## NIP Reference
[NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md) — Gift Wrap

## Event Structure

NIP-59 uses three nested layers:

```
Layer 3 — Gift Wrap (kind:1059)          ← this is what arrives
├── pubkey: <random, disposable key>
├── created_at: <randomized timestamp>
├── content: <NIP-44 encrypted Seal>
├── tags: [["p", "<recipient-pubkey>"]]
│
└── Layer 2 — Seal (kind:13)              ← after first decryption
    ├── pubkey: <real sender pubkey>
    ├── created_at: <randomized timestamp>
    ├── content: <NIP-44 encrypted Rumor>
    ├── tags: []
    │
    └── Layer 1 — Rumor (unsigned event)  ← after second decryption
        ├── pubkey: <real sender pubkey>
        ├── kind: <actual event kind>
        ├── content: <actual content>
        ├── tags: <actual tags>
        └── sig: "" (no signature)
```

## Processing Instructions

1. **Verify recipient** — Check the `p` tag matches our agent's pubkey. If not, return `ignore`.
2. **Return unwrap action** — The agent cannot decrypt NIP-44 content directly. Return an `unwrap` action so the runtime can:
   a. Decrypt the Gift Wrap content using the agent's private key → yields Seal (kind:13)
   b. Verify Seal pubkey is a known/trusted sender
   c. Decrypt the Seal content → yields Rumor (the actual event)
   d. Re-dispatch the Rumor through the NIP handler routing pipeline
3. **Do NOT attempt to parse encrypted content** — The content field is NIP-44 ciphertext.

## Decision Framework

```
If p-tag matches agent pubkey → unwrap
If p-tag does NOT match → ignore (not for us)
If event appears malformed (missing p-tag) → ignore
```

## Available Actions

- `unwrap` — Request the runtime to decrypt and re-dispatch the inner event
- `ignore` — Skip (not addressed to us, or malformed)
- `escalate` — Flag for review (suspicious sender, unusual pattern)

## Security Considerations

- **Sender identity is hidden** — The outer Gift Wrap pubkey is random/disposable. True sender is only revealed after decryption of the Seal layer.
- **Timestamp is randomized** — Do not rely on `created_at` for ordering or freshness.
- After unwrapping, the inner Rumor has **no signature** — it is verified by the chain of NIP-44 encryption, not by sig field.
- The inner Rumor could be ANY kind — after unwrapping, apply full security pipeline to the inner event as if it arrived fresh.
- Common inner kinds: kind:14 (NIP-17 private DM), kind:1 (private text note).

## Examples

### Input: Gift wrap addressed to our agent
```
kind: 1059
pubkey: <random-disposable-key>
created_at: 1234567890
content: <NIP-44 ciphertext>
tags: [["p", "<our-agent-pubkey>"]]
```

**Output:**
```json
{ "action": "unwrap", "event_id": "<gift-wrap-event-id>", "note": "Gift wrap addressed to us, requesting decryption and re-dispatch" }
```

### Input: Gift wrap NOT addressed to us
```
kind: 1059
pubkey: <random-disposable-key>
content: <NIP-44 ciphertext>
tags: [["p", "<some-other-pubkey>"]]
```

**Output:**
```json
{ "action": "ignore", "reason": "Gift wrap not addressed to this agent" }
```
