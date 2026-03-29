# NIP-90 & NIP-78 Specification: Data Vending Machines and Application-specific Data

> **Why this reference exists:** Agents need precise tag formats, event structures, and protocol semantics to construct valid DVM events. This file covers the full NIP-90 specification for kind:5xxx (job requests), kind:6xxx (job results), and kind:7000 (job feedback), plus NIP-78 for kind:30078 (application-specific data). Understanding these structures prevents malformed DVM events that waste ILP payment on events that providers or clients cannot parse.

## Overview

NIP-90 defines Data Vending Machines (DVMs) -- a protocol for paid compute services on Nostr. Clients submit job requests, providers process them and return results, and feedback events handle status updates and payment negotiation. NIP-78 defines application-specific data storage that DVM providers and clients use for configuration and state.

## Kind Numbering Convention

DVM job kinds follow a structured numbering scheme:

| Range | Purpose | Examples |
|-------|---------|----------|
| 5000-5999 | Job requests | 5000 (text generation), 5001 (text-to-image), 5094 (blob storage), 5250 (compute), 5300 (discovery), 5600 (translation) |
| 6000-6999 | Job results | 6000 (text result), 6001 (image result), 6094 (blob result), 6250 (compute result), 6300 (discovery result), 6600 (translation result) |
| 7000 | Job feedback | Status updates, payment negotiation |

**Result kind formula:** `result_kind = request_kind + 1000`

For example, a kind:5094 blob storage request yields a kind:6094 result.

## kind:5xxx -- Job Request Events

A job request event where a client requests a compute service from a DVM provider.

### Event Structure

| Field | Value |
|-------|-------|
| `kind` | `5000-5999` (depends on job type) |
| `content` | Optional plaintext or encrypted job description |
| `created_at` | Unix timestamp |
| `pubkey` | Requesting client's public key |
| `tags` | See tag table below |

### Tag Table for kind:5xxx

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `i` | Yes (at least one) | `["i", "<data>", "<input-type>", "<relay>", "<marker>"]` | Input data. `<input-type>`: `"text"`, `"url"`, `"event"`, `"job"`. `<relay>` is optional relay hint. `<marker>` is optional role label. |
| `output` | No | `["output", "<mime-type>"]` | Expected output MIME type (e.g., `"text/plain"`, `"image/png"`, `"application/json"`). |
| `relays` | No | `["relays", "<relay1>", "<relay2>", ...]` | Relays where the client wants results delivered. |
| `bid` | No | `["bid", "<amount-millisats>"]` | Maximum price the client is willing to pay, in millisatoshis. |
| `p` | No | `["p", "<provider-pubkey>"]` | Target a specific provider. Omit to broadcast to all. |
| `param` | No | `["param", "<key>", "<value>"]` | Job-specific parameters. Repeatable for multiple parameters. |
| `t` | No | `["t", "<hashtag>"]` | Topic tags for job categorization. |
| `expiration` | No | `["expiration", "<unix-timestamp>"]` | NIP-40 expiration -- job request expires after this time. |
| `encrypted` | No | `["encrypted"]` | Indicates content is NIP-44 encrypted to the provider. |

### Input Type Values

| Input Type | Format | Description |
|-----------|--------|-------------|
| `"text"` | `["i", "<plaintext>", "text"]` | Raw text input |
| `"url"` | `["i", "<url>", "url"]` | URL to fetch input data from |
| `"event"` | `["i", "<event-id>", "event", "<relay-hint>"]` | Reference to a Nostr event by ID |
| `"job"` | `["i", "<job-request-id>", "job"]` | Chain to another DVM job's output (pipelining) |

### Job Pipelining

DVM jobs can be chained by using `"job"` input type. The output of one job becomes the input of the next:

```json
["i", "<previous-job-request-event-id>", "job"]
```

The provider waits for the referenced job to complete, then uses its result as input.

### Example kind:5000 Event (Text Generation)

```json
{
  "kind": 5000,
  "content": "",
  "tags": [
    ["i", "Explain the TOON protocol in 3 sentences", "text"],
    ["output", "text/plain"],
    ["relays", "wss://relay.toon-protocol.com"],
    ["bid", "50000"],
    ["param", "model", "gpt-4"],
    ["param", "max_tokens", "500"]
  ]
}
```

### Example kind:5094 Event (Blob Storage)

```json
{
  "kind": 5094,
  "content": "",
  "tags": [
    ["i", "<base64-encoded-data>", "text"],
    ["output", "application/json"],
    ["relays", "wss://relay.toon-protocol.com"],
    ["bid", "100000"],
    ["param", "storage", "arweave"],
    ["param", "content_type", "application/octet-stream"]
  ]
}
```

### Example kind:5250 Event (Compute)

```json
{
  "kind": 5250,
  "content": "",
  "tags": [
    ["i", "https://example.com/script.wasm", "url"],
    ["output", "application/json"],
    ["relays", "wss://relay.toon-protocol.com"],
    ["bid", "200000"],
    ["param", "runtime", "wasm"],
    ["param", "timeout", "30"]
  ]
}
```

### Encrypted Job Requests

For sensitive inputs, clients can NIP-44 encrypt the content and input data to the provider's public key. The `encrypted` tag signals that the content requires decryption:

```json
{
  "kind": 5000,
  "content": "<nip44-encrypted-content>",
  "tags": [
    ["i", "<nip44-encrypted-input>", "text"],
    ["encrypted"],
    ["p", "<provider-pubkey>"],
    ["output", "text/plain"]
  ]
}
```

Only the targeted provider can decrypt and process the request.

## kind:6xxx -- Job Result Events

A job result event where a provider delivers completed work. The kind is always the request kind + 1000.

### Event Structure

| Field | Value |
|-------|-------|
| `kind` | `6000-6999` (request kind + 1000) |
| `content` | Result data (plaintext or encrypted) |
| `created_at` | Unix timestamp |
| `pubkey` | Provider's public key |
| `tags` | See tag table below |

### Tag Table for kind:6xxx

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `e` | Yes | `["e", "<job-request-event-id>"]` | Reference to the kind:5xxx job request event. |
| `p` | Yes | `["p", "<requester-pubkey>"]` | Public key of the client who submitted the job request. |
| `request` | Yes | `["request", "<original-request-event-json>"]` | The full original request event as a JSON string, enabling verification. |
| `i` | No | `["i", "<output-data>", "<output-type>"]` | Output data if not in content field. Used for structured outputs. |
| `amount` | No | `["amount", "<millisats>", "<bolt11-invoice>"]` | Payment amount charged and optional invoice. |
| `encrypted` | No | `["encrypted"]` | Indicates content is NIP-44 encrypted to the requester. |

### Content Field

The `content` field contains the result data. For text outputs, this is the plaintext result. For binary outputs, results may be delivered via URL reference in an `i` tag rather than inline in the content.

### Example kind:6000 Event (Text Generation Result)

```json
{
  "kind": 6000,
  "content": "TOON Protocol is an ILP-gated Nostr relay network where writing costs money via Interledger payments. It enables paid compute services through Data Vending Machines (DVMs). The pay-to-write model creates economic incentives for quality content and services.",
  "tags": [
    ["e", "<job-request-event-id>"],
    ["p", "<requester-pubkey>"],
    ["request", "{\"kind\":5000,\"content\":\"\",\"tags\":[[\"i\",\"Explain the TOON protocol in 3 sentences\",\"text\"],[\"output\",\"text/plain\"]]}"]
  ]
}
```

### Example kind:6094 Event (Blob Storage Result)

```json
{
  "kind": 6094,
  "content": "",
  "tags": [
    ["e", "<job-request-event-id>"],
    ["p", "<requester-pubkey>"],
    ["request", "{\"kind\":5094,...}"],
    ["i", "https://arweave.net/<tx-id>", "url"],
    ["i", "<sha256-hash>", "text", "", "hash"]
  ]
}
```

## kind:7000 -- Job Feedback Events

A feedback event used for status updates during job processing and payment negotiation.

### Event Structure

| Field | Value |
|-------|-------|
| `kind` | `7000` |
| `content` | Optional status description or error message |
| `created_at` | Unix timestamp |
| `pubkey` | Provider's public key |
| `tags` | See tag table below |

### Tag Table for kind:7000

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `e` | Yes | `["e", "<job-request-event-id>"]` | Reference to the kind:5xxx job request event. |
| `p` | Yes | `["p", "<requester-pubkey>"]` | Public key of the client who submitted the job request. |
| `status` | Yes | `["status", "<status-value>", "<extra-info>"]` | Job status. See status values below. Optional third element for additional info. |
| `amount` | No | `["amount", "<millisats>", "<bolt11-invoice>"]` | Required payment amount (for payment negotiation). |

### Status Values

| Status | Meaning | When Used |
|--------|---------|-----------|
| `"payment-required"` | Provider requires payment before processing | Initial response to a job request without sufficient bid |
| `"processing"` | Provider is actively working on the job | After accepting and beginning work |
| `"error"` | Job failed | When processing encounters an unrecoverable error |
| `"success"` | Job completed successfully | When result has been published (kind:6xxx) |
| `"partial"` | Partial results available | For streaming or incremental results |

### Payment Negotiation Flow

1. Client submits kind:5xxx with a `bid` tag.
2. If the bid is insufficient, provider publishes kind:7000 with `status: "payment-required"` and an `amount` tag specifying the required price.
3. Client can accept by submitting a new job request with the required amount, or decline by not responding.

### Example kind:7000 Events

**Processing status:**
```json
{
  "kind": 7000,
  "content": "Job accepted, processing text generation request.",
  "tags": [
    ["e", "<job-request-event-id>"],
    ["p", "<requester-pubkey>"],
    ["status", "processing"]
  ]
}
```

**Payment required:**
```json
{
  "kind": 7000,
  "content": "Bid too low for requested model. Minimum price for gpt-4 with 500 tokens.",
  "tags": [
    ["e", "<job-request-event-id>"],
    ["p", "<requester-pubkey>"],
    ["status", "payment-required"],
    ["amount", "100000", ""]
  ]
}
```

**Error status:**
```json
{
  "kind": 7000,
  "content": "Failed to process: input URL returned 404.",
  "tags": [
    ["e", "<job-request-event-id>"],
    ["p", "<requester-pubkey>"],
    ["status", "error", "input-unavailable"]
  ]
}
```

**Success status:**
```json
{
  "kind": 7000,
  "content": "",
  "tags": [
    ["e", "<job-request-event-id>"],
    ["p", "<requester-pubkey>"],
    ["status", "success"]
  ]
}
```

## kind:30078 -- Application-specific Data (NIP-78)

A parameterized replaceable event for storing arbitrary application data.

### Event Structure

| Field | Value |
|-------|-------|
| `kind` | `30078` |
| `content` | Application-specific data (typically JSON) |
| `created_at` | Unix timestamp |
| `pubkey` | Publisher's public key |
| `tags` | See tag table below |

### Tag Table for kind:30078

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `d` | Yes | `["d", "<identifier>"]` | Unique identifier for this data entry. This is the parameterized replaceable key. |

### Parameterized Replaceable Semantics

kind:30078 is in the parameterized replaceable range (30000-39999). Key implications:
- **Unique by pubkey + kind + d-tag:** Only one event per combination exists on a relay.
- **Latest wins:** Publishing a new event with the same `d` tag replaces the previous one.
- **Addressable via naddr1:** Can be referenced using NIP-19 bech32 encoding.

### DVM Use Cases for kind:30078

| Use Case | `d` Tag Pattern | Content |
|----------|----------------|---------|
| Provider configuration | `"dvm-config-<provider-id>"` | JSON with supported job types, pricing, capabilities |
| Job template | `"job-template-<template-id>"` | JSON with pre-configured job parameters |
| Client preferences | `"dvm-prefs-<client-id>"` | JSON with preferred providers, default parameters |
| Provider reputation data | `"dvm-reputation-<provider-id>"` | JSON with aggregated job completion stats |

### Example kind:30078 Event (DVM Provider Config)

```json
{
  "kind": 30078,
  "content": "{\"supportedKinds\":[5000,5094,5250],\"maxInputSize\":1048576,\"defaultTimeout\":60,\"pricing\":{\"5000\":\"50000\",\"5094\":\"100000\",\"5250\":\"200000\"}}",
  "tags": [
    ["d", "dvm-config-my-provider"]
  ]
}
```

### Example kind:30078 Event (Job Template)

```json
{
  "kind": 30078,
  "content": "{\"kind\":5000,\"params\":{\"model\":\"gpt-4\",\"max_tokens\":1000,\"temperature\":0.7},\"output\":\"text/plain\"}",
  "tags": [
    ["d", "job-template-text-gen-default"]
  ]
}
```

## Querying DVM Events

### Finding Job Results for a Request

Subscribe with a filter on the result kind and the `e` tag referencing the request:

```json
["REQ", "job-result", { "kinds": [6000], "#e": ["<job-request-event-id>"] }]
```

### Finding Feedback for a Request

```json
["REQ", "job-feedback", { "kinds": [7000], "#e": ["<job-request-event-id>"] }]
```

### Monitoring for Incoming Job Requests (Provider)

```json
["REQ", "incoming-jobs", { "kinds": [5000, 5094, 5250], "since": <now> }]
```

### Finding Application-specific Data

```json
["REQ", "app-data", { "kinds": [30078], "authors": ["<pubkey>"], "#d": ["dvm-config-my-provider"] }]
```

### Discovering DVM Service Providers

Query for kind:10035 SkillDescriptor events (TOON-specific):

```json
["REQ", "dvm-providers", { "kinds": [10035] }]
```

## Client Behavior

Clients implementing NIP-90 should:

1. **Submit job requests** with clear `i` tags, `output` type, and a reasonable `bid`.
2. **Monitor feedback** by subscribing to kind:7000 with `#e` filter on the request ID.
3. **Handle payment negotiation** by watching for `"payment-required"` status and deciding whether to accept the provider's price.
4. **Collect results** by subscribing to the appropriate kind:6xxx with `#e` filter.
5. **Verify results** by checking the `request` tag in the result matches the original request.
6. **Set expiration** using NIP-40 `expiration` tags on job requests to prevent stale jobs from being picked up.

## Provider Behavior

Providers implementing NIP-90 should:

1. **Monitor incoming requests** by subscribing to relevant kind:5xxx events.
2. **Publish feedback** (kind:7000) with `"processing"` status when beginning work.
3. **Negotiate payment** by publishing kind:7000 with `"payment-required"` and `amount` tag if the bid is insufficient.
4. **Deliver results** as kind:6xxx events with `e`, `p`, and `request` tags.
5. **Handle errors gracefully** by publishing kind:7000 with `"error"` status and a descriptive content message.
6. **Advertise capabilities** via kind:10035 SkillDescriptor events (on TOON) or kind:31990 app handler events (NIP-89).
