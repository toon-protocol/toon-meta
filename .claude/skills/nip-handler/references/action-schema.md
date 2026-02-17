# Action Schema Reference

All NIP handlers output a structured action decision. The agent MUST respond with valid JSON matching one of these action types.

## Action Types

### Social Actions (kind:1, kind:6, kind:7, kind:30023)

```json
{ "action": "reply", "content": "<text>", "reply_to": "<event-id-hex>" }
```

```json
{ "action": "react", "emoji": "+", "event_id": "<event-id-hex>" }
```
Emoji values: `+` (like), `-` (dislike), or any single emoji.

```json
{ "action": "repost", "event_id": "<event-id-hex>" }
```

```json
{ "action": "zap", "amount_msats": 1000, "event_id": "<event-id-hex>", "comment": "<optional>" }
```

### Protocol Actions (NIP-59, NIP-90, Crosstown)

```json
{ "action": "unwrap", "event_id": "<gift-wrap-event-id>", "note": "<reason>" }
```
For NIP-59 gift-wrapped events. The runtime decrypts and re-dispatches the inner event.

```json
{ "action": "fulfill_job", "job_id": "<request-event-id>", "result_content": "<result>", "result_kind": 6000 }
```
For NIP-90 DVM job requests. `result_kind` = request kind + 1000.

```json
{ "action": "publish_job_feedback", "job_id": "<request-event-id>", "status": "processing|success|error|partial", "content": "<status message>" }
```

```json
{ "action": "store", "event_id": "<event-id-hex>", "note": "<reason>" }
```
Accept and store the event to the relay/event store.

```json
{ "action": "forward", "event_id": "<event-id-hex>", "destination": "<ilp-address-or-pubkey>" }
```

### Control Actions (all handlers)

```json
{ "action": "ignore", "reason": "<explanation>" }
```
Skip processing. Use when the event is irrelevant, spam, or outside agent capabilities.

```json
{ "action": "escalate", "reason": "<explanation>", "event_id": "<event-id-hex>" }
```
Flag for human review. Use when the event requires judgment beyond agent authority.

### Multi-Action Responses

Handlers may return an array of actions when multiple responses are appropriate:

```json
[
  { "action": "react", "emoji": "+", "event_id": "<id>" },
  { "action": "reply", "content": "Great point!", "reply_to": "<id>" }
]
```

## Validation Rules

1. Every action MUST have an `action` field with a recognized type
2. `event_id`, `reply_to`, and `job_id` MUST be 64-character hex strings
3. `amount_msats` MUST be a positive integer
4. `result_kind` for DVM MUST be in range 6000-6999
5. `content` and `result_content` MUST be non-empty strings
6. Arrays MUST contain 1-5 actions (no empty arrays, no unbounded lists)

## Action Allowlists by Kind Category

| Kind Category | Allowed Actions |
|--------------|----------------|
| Social (1, 30023) | reply, react, repost, zap, ignore, escalate |
| Repost (6) | react, ignore, escalate |
| Reaction (7) | ignore, escalate |
| Gift Wrap (1059) | unwrap, ignore, escalate |
| DVM Request (5000-5999) | fulfill_job, publish_job_feedback, ignore, escalate |
| DVM Result (6000-6999) | store, ignore, escalate |
| DVM Feedback (7000) | ignore, escalate |
| ILP Peer Info (10032) | store, forward, ignore, escalate |
| SPSP Request (23194) | store, forward, ignore, escalate |
| SPSP Response (23195) | store, ignore, escalate |
| Unknown | ignore, escalate |
