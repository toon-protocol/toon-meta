# Crosstown BLS Game Action Handler - Implementation Specification

**Version:** 2.0
**Date:** 2026-02-28
**Status:** Ready for Implementation
**Target:** Crosstown Node (BLS Handler Component)

---

## Executive Summary

This document provides detailed implementation specifications for the **BLS Game Action Handler** component in the Crosstown node. The BLS handler receives ILP packets from the Crosstown node's ILP connector via the `handle-packet` endpoint, validates Nostr event signatures embedded in the packets, and forwards authenticated game actions to SpacetimeDB for execution.

**Key Responsibilities:**
1. Receive ILP packets via `POST /handle-packet` endpoint from Crosstown node's connector
2. Extract and validate Nostr event (kind 30078) from ILP packet data
3. Validate Nostr event signatures (secp256k1)
4. Parse event content (reducer name and arguments)
5. Forward actions to SpacetimeDB HTTP API with identity propagation
6. Handle errors and return responses to connector

**Integration Points:**
- **Input:** Crosstown node's ILP connector → BLS `POST /handle-packet` endpoint
- **Output:** SpacetimeDB HTTP API (`/database/bitcraft/call/{reducer}`)
- **Identity:** Nostr public key (event.pubkey) → SpacetimeDB reducer first parameter

---

## Architecture Overview

### Correct ILP Routing Flow

```
┌─────────────┐                           ┌─────────────────┐
│   Sigil     │   ILP Packet              │   Client's ILP  │
│   Client    │ ────────────────────────> │   Connector     │
└─────────────┘                           └────────┬────────┘
                                                   │
                                                   │ ILP Routing (Interledger Protocol)
                                                   ▼
                                          ┌─────────────────┐
                                          │  Crosstown Node │
                                          │  ILP Connector  │
                                          └────────┬────────┘
                                                   │
                                                   │ POST /handle-packet
                                                   ▼
                                          ┌─────────────────┐
                                          │   BLS Handler   │
                                          │ (THIS COMPONENT)│
                                          └────────┬────────┘
                                                   │
                      ┌────────────────────────────┼────────────────────────────┐
                      │                            │                            │
                      ▼                            ▼                            ▼
             Extract Nostr Event          Signature Validation          Parse Content
             from ILP packet data         (secp256k1, NIP-01)          (JSON: reducer, args)
                      │                            │                            │
                      └────────────────────────────┼────────────────────────────┘
                                                   │
                                                   │ All validations pass
                                                   ▼
                                          ┌─────────────────┐
                                          │   SpacetimeDB   │
                                          │   HTTP API      │
                                          │  (BitCraft DB)  │
                                          └─────────────────┘
                                                   │
                                                   │ Reducer Response
                                                   ▼
                                          ┌─────────────────┐
                                          │  Return to      │
                                          │  Connector      │
                                          └─────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Sigil Client** | Creates ILP packet with Nostr event (kind 30078), sends to client's ILP connector |
| **Client's ILP Connector** | Routes ILP packet to Crosstown node's connector using Interledger Protocol |
| **Crosstown Node's Connector** | Receives ILP packet, forwards to BLS handler via `POST /handle-packet` |
| **BLS Handler** | Extracts Nostr event, validates signature, parses content, calls SpacetimeDB reducers |
| **SpacetimeDB HTTP API** | Executes reducers, updates game state, returns success/failure |

---

## Data Structures

### ILP Packet Format (Input to BLS)

The BLS handler receives ILP packets via `POST /handle-packet`. The ILP packet contains the Nostr event in its `data` field.

```typescript
interface ILPPacket {
  amount: string;           // ILP amount (string-encoded integer)
  account: string;          // ILP account address (e.g., "g.crosstown.bls")
  data: Buffer;             // Nostr event (kind 30078) encoded as Buffer
  expiresAt: Date;          // Packet expiration timestamp
  executionCondition: Buffer;  // ILP execution condition (32 bytes)
}
```

**Key Points:**
- The `data` field contains the **Nostr event** (kind 30078) serialized as JSON and encoded as a Buffer
- The BLS handler must decode `data` to extract the Nostr event
- Example: `Buffer.from(packet.data).toString('utf-8')` → JSON string → parse to NostrEvent

### Nostr Event Format (Extracted from ILP Packet Data)

```typescript
interface NostrEvent {
  id: string;          // Event ID (SHA256 hash of canonical serialization)
  pubkey: string;      // Nostr public key (hex, 64 chars)
  created_at: number;  // Unix timestamp (seconds)
  kind: 30078;         // Game action event kind
  tags: string[][];    // Tags (may be empty for game actions)
  content: string;     // JSON-serialized game action (see below)
  sig: string;         // secp256k1 signature (hex, 128 chars)
}
```

### Event Content Format (Extracted from Nostr Event)

```json
{
  "reducer": "player_move",
  "args": [
    { "x": 100, "z": 200 },
    { "x": 110, "z": 200 },
    false
  ]
}
```

**Field Specifications:**
- `reducer` (string, required): SpacetimeDB reducer name (e.g., "player_move", "craft_item")
- `args` (array, required): Arguments to pass to the reducer (may be empty array `[]`)

### SpacetimeDB Reducer Call Format (Output)

**Endpoint:** `POST /database/{database_name}/call/{reducer}`

**Headers:**
```
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Body:**
```json
[
  "npub1abc123...",
  { "x": 100, "z": 200 },
  { "x": 110, "z": 200 },
  false
]
```

**Important:** The Nostr public key (npub-encoded) is **prepended** as the first element of the args array. All subsequent elements are the original args from the event content.

**Example Transformation:**
- **Input event content:** `{ "reducer": "player_move", "args": [origin, dest, run] }`
- **Output HTTP body:** `["npub1xyz...", origin, dest, run]`

### SpacetimeDB Response Format

**Success (200 OK):**
```json
{
  "success": true
}
```

**Failure (4xx/5xx):**
```json
{
  "error": "Reducer execution failed: Invalid move coordinates"
}
```

### BLS Response Format (to Connector)

**Success:**
```json
{
  "success": true,
  "eventId": "abc123..."
}
```

**Error:**
```json
{
  "eventId": "abc123...",
  "errorCode": "INVALID_SIGNATURE",
  "message": "Event signature verification failed",
  "retryable": false
}
```

**Error Codes:**
- `INVALID_SIGNATURE`: Signature verification failed (secp256k1 validation)
- `UNKNOWN_REDUCER`: Reducer name not recognized
- `REDUCER_FAILED`: SpacetimeDB reducer returned an error
- `INVALID_CONTENT`: Event content is not valid JSON or missing required fields
- `INVALID_PACKET`: ILP packet data is not a valid Nostr event

---

## Implementation Requirements

### 1. HTTP Endpoint: `POST /handle-packet`

**Requirement:** The BLS handler MUST expose an HTTP endpoint that receives ILP packets from the Crosstown node's connector.

**Endpoint Specification:**
- **Method:** POST
- **Path:** `/handle-packet`
- **Content-Type:** `application/octet-stream` (ILP packet binary format)
- **Request Body:** ILP packet (binary)
- **Response:** JSON (success or error)

**Implementation Notes:**
- The endpoint receives ILP packets from the Crosstown node's ILP connector
- The ILP connector is responsible for ILP protocol handling (amount, account, execution condition)
- The BLS handler is responsible for extracting and processing the Nostr event from `packet.data`

**Pseudocode:**
```javascript
app.post('/handle-packet', async (req, res) => {
  try {
    // Parse ILP packet from request body
    const packet = parseILPPacket(req.body);

    // Extract Nostr event from packet.data
    const eventJson = Buffer.from(packet.data).toString('utf-8');
    const event = JSON.parse(eventJson);

    logger.debug('Received game action packet', {
      amount: packet.amount,
      account: packet.account,
      eventId: event.id,
      pubkey: event.pubkey,
      reducer: parseReducerName(event.content)
    });

    // Process the game action
    const result = await handleGameAction(event);

    res.json({ success: true, eventId: event.id });
  } catch (error) {
    res.status(400).json({
      eventId: event?.id || 'unknown',
      errorCode: error.code,
      message: error.message,
      retryable: false
    });
  }
});
```

---

### 2. ILP Packet Parsing

**Requirement:** The BLS handler MUST parse ILP packets to extract the Nostr event from the `data` field.

**Validation Steps:**
1. Verify ILP packet structure is valid (amount, account, data, expiresAt, executionCondition)
2. Extract `packet.data` (Buffer containing Nostr event)
3. Decode Buffer to UTF-8 string
4. Parse JSON to extract NostrEvent object
5. Validate event.kind === 30078 (game action event)

**Implementation Notes:**
- Use an ILP packet parsing library (e.g., `ilp-packet` npm package for Node.js)
- If `packet.data` is not valid JSON, return `INVALID_PACKET` error
- If `event.kind !== 30078`, return `INVALID_PACKET` error

**Pseudocode:**
```javascript
import { deserializeIlpPacket } from 'ilp-packet';

function parseILPPacket(requestBody) {
  // Deserialize ILP packet from binary
  const packet = deserializeIlpPacket(requestBody);

  // Extract and decode Nostr event from packet.data
  const eventJson = Buffer.from(packet.data).toString('utf-8');
  let event;

  try {
    event = JSON.parse(eventJson);
  } catch (err) {
    throw new Error('INVALID_PACKET: packet.data is not valid JSON');
  }

  // Validate event kind
  if (event.kind !== 30078) {
    throw new Error(`INVALID_PACKET: Expected kind 30078, got ${event.kind}`);
  }

  return { packet, event };
}
```

---

### 3. Signature Validation (NIP-01)

**Requirement:** The BLS handler MUST validate the Nostr event signature before processing any action.

**Validation Steps:**
1. Verify `event.id` is correctly computed:
   ```
   event_id = SHA256(canonical_serialization(event))
   ```
   Canonical serialization format (NIP-01):
   ```json
   [
     0,
     <pubkey>,
     <created_at>,
     <kind>,
     <tags>,
     <content>
   ]
   ```

2. Verify `event.sig` matches `event.id` using `event.pubkey`:
   ```
   secp256k1_verify(signature=event.sig, message=event.id, pubkey=event.pubkey)
   ```

**Implementation Notes:**
- Use a secp256k1 library (e.g., `@noble/secp256k1` for Node.js, `secp256k1` for Rust)
- Signature and pubkey are hex-encoded strings (128 chars and 64 chars respectively)
- If validation fails, return `INVALID_SIGNATURE` error immediately (do NOT proceed to reducer call)

**Pseudocode:**
```javascript
import { schnorr } from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

async function validateSignature(event) {
  // 1. Compute canonical event ID
  const canonical = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content
  ]);
  const computedId = Buffer.from(sha256(canonical)).toString('hex');

  if (computedId !== event.id) {
    throw new Error('INVALID_SIGNATURE: Event ID mismatch');
  }

  // 2. Verify signature
  const isValid = await schnorr.verify(event.sig, event.id, event.pubkey);

  if (!isValid) {
    throw new Error('INVALID_SIGNATURE: Signature verification failed');
  }
}
```

---

### 4. Content Parsing

**Requirement:** The BLS handler MUST parse the event content JSON to extract the reducer name and arguments.

**Validation Rules:**
- Content MUST be valid JSON
- Content MUST have a `reducer` field (string)
- Content MUST have an `args` field (array)
- If validation fails, return `INVALID_CONTENT` error

**Pseudocode:**
```javascript
function parseContent(event) {
  let content;
  try {
    content = JSON.parse(event.content);
  } catch (err) {
    throw new Error('INVALID_CONTENT: Content is not valid JSON');
  }

  if (typeof content.reducer !== 'string') {
    throw new Error('INVALID_CONTENT: Missing or invalid "reducer" field');
  }

  if (!Array.isArray(content.args)) {
    throw new Error('INVALID_CONTENT: Missing or invalid "args" field');
  }

  return {
    reducer: content.reducer,
    args: content.args
  };
}
```

---

### 5. Reducer Existence Check

**Requirement:** The BLS handler MUST verify the reducer exists before calling SpacetimeDB.

**Rationale:** Avoid unnecessary HTTP calls to SpacetimeDB for non-existent reducers.

**Implementation Approach:**

**Option A: Static Allowlist (Recommended for MVP)**
- Maintain a hardcoded list of known reducers
- Check reducer name against the list before calling SpacetimeDB
- Return `UNKNOWN_REDUCER` error if not in allowlist

```javascript
const KNOWN_REDUCERS = new Set([
  'player_move',
  'craft_item',
  'harvest_resource',
  'build_structure',
  // ... add all BitCraft reducers
]);

function validateReducer(reducerName) {
  if (!KNOWN_REDUCERS.has(reducerName)) {
    throw new Error(`UNKNOWN_REDUCER: ${reducerName}`);
  }
}
```

**Option B: SpacetimeDB Metadata Query (Future Enhancement)**
- Query SpacetimeDB `/database/bitcraft/schema` endpoint to fetch reducer list
- Cache the schema and refresh periodically
- More dynamic but requires additional HTTP call overhead

---

### 6. Identity Propagation

**Requirement:** The BLS handler MUST prepend the Nostr public key to the reducer args array.

**Format:**
- Input pubkey: hex string (64 chars)
- Output format: npub-encoded Bech32 string (starting with "npub1")

**Implementation:**
```javascript
import { nip19 } from 'nostr-tools';

function prepareReducerArgs(event, originalArgs) {
  // Convert hex pubkey to npub format
  const npubKey = nip19.npubEncode(event.pubkey);

  // Prepend to args array
  return [npubKey, ...originalArgs];
}

// Example:
// event.pubkey = "abc123..." (hex)
// originalArgs = [{ x: 100, z: 200 }, { x: 110, z: 200 }, false]
// returns: ["npub1abc...", { x: 100, z: 200 }, { x: 110, z: 200 }, false]
```

---

### 7. SpacetimeDB HTTP Call

**Requirement:** The BLS handler MUST call the SpacetimeDB HTTP API to execute the reducer.

**Configuration (Environment Variables):**
```bash
SPACETIMEDB_URL=http://localhost:3000
SPACETIMEDB_DATABASE=bitcraft
SPACETIMEDB_TOKEN=<admin_token>
```

**HTTP Request:**
```javascript
async function callReducer(reducerName, args) {
  const url = `${process.env.SPACETIMEDB_URL}/database/${process.env.SPACETIMEDB_DATABASE}/call/${reducerName}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SPACETIMEDB_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`REDUCER_FAILED: ${error}`);
  }

  return await response.json();
}
```

**Error Handling:**
- `200 OK`: Reducer succeeded
- `4xx`: Client error (invalid args, reducer rejected action) → `REDUCER_FAILED`
- `5xx`: Server error (SpacetimeDB crash) → `REDUCER_FAILED`
- Network timeout: Retry once, then `REDUCER_FAILED`

---

### 8. Error Handling and Logging

**Requirement:** The BLS handler MUST log all errors and return structured error responses.

**Logging Levels:**
- **DEBUG:** All received packets (packet amount, account, event ID, pubkey, reducer name)
- **INFO:** Successful reducer executions (event ID, reducer, execution time)
- **WARN:** Retryable errors (network timeout, SpacetimeDB 5xx)
- **ERROR:** Non-retryable errors (invalid signature, unknown reducer, reducer failure)

**Error Response:**
```javascript
function createErrorResponse(event, errorCode, message, retryable = false) {
  return {
    eventId: event?.id || 'unknown',
    errorCode: errorCode,
    message: message,
    retryable: retryable
  };
}

// Examples:
createErrorResponse(event, 'INVALID_SIGNATURE', 'Signature verification failed', false);
createErrorResponse(event, 'REDUCER_FAILED', 'Invalid move coordinates', false);
createErrorResponse(event, 'UNKNOWN_REDUCER', 'Reducer "invalid_action" not found', false);
```

**Response to Connector:**
The BLS handler returns the error response (JSON) to the Crosstown node's ILP connector, which can then propagate the error back through the ILP routing chain.

---

### 9. Performance Requirements

**Latency:**
- Target: < 500ms end-to-end (packet received → reducer response returned)
- Budget breakdown:
  - ILP packet parsing: < 10ms
  - Nostr event extraction: < 10ms
  - Signature validation: < 50ms
  - Content parsing: < 10ms
  - SpacetimeDB HTTP call: < 400ms
  - Error handling: < 20ms

**Throughput:**
- MVP: Handle 10 actions/second per BLS instance
- Phase 2: Handle 100 actions/second (horizontal scaling)

**Monitoring:**
- Log execution time for each reducer call
- Emit warning if any step exceeds latency budget
- Metrics: success rate, error rate by error code, p50/p95/p99 latency

---

## Implementation Tasks

### Task 1: HTTP Endpoint Setup
- [ ] Implement `POST /handle-packet` endpoint
- [ ] Parse ILP packet from request body (binary)
- [ ] Add debug logging for all received packets
- [ ] Add metrics: total packets received counter

### Task 2: ILP Packet Parsing
- [ ] Implement ILP packet deserialization (using `ilp-packet` library)
- [ ] Extract Nostr event from `packet.data` (Buffer → UTF-8 → JSON)
- [ ] Validate event.kind === 30078
- [ ] Add unit tests:
  - Valid ILP packet with kind 30078 → extracts event successfully
  - Invalid packet.data (not JSON) → rejects with `INVALID_PACKET`
  - Wrong event kind → rejects with `INVALID_PACKET`
- [ ] Add metrics: packet parsing success/failure counters

### Task 3: Signature Validation
- [ ] Implement NIP-01 canonical serialization
- [ ] Implement secp256k1 signature verification
- [ ] Add unit tests:
  - Valid signature → passes
  - Invalid signature → rejects with `INVALID_SIGNATURE`
  - Tampered event ID → rejects
- [ ] Add metrics: signature validation success/failure counters

### Task 4: Content Parsing
- [ ] Implement JSON content parsing
- [ ] Validate required fields (reducer, args)
- [ ] Add unit tests:
  - Valid content → parses successfully
  - Invalid JSON → rejects with `INVALID_CONTENT`
  - Missing fields → rejects with `INVALID_CONTENT`
- [ ] Add metrics: content parsing success/failure counters

### Task 5: Reducer Existence Check
- [ ] Create static allowlist of known reducers (Option A for MVP)
- [ ] Implement reducer validation logic
- [ ] Add unit tests:
  - Known reducer → passes
  - Unknown reducer → rejects with `UNKNOWN_REDUCER`
- [ ] Document how to update the allowlist when new reducers are added

### Task 6: Identity Propagation
- [ ] Implement hex → npub conversion (using nip19.npubEncode)
- [ ] Implement args array prepending logic
- [ ] Add unit tests:
  - Verify npub format is correct
  - Verify args array is prepended (not appended)
  - Verify original args are preserved

### Task 7: SpacetimeDB HTTP Integration
- [ ] Implement HTTP POST to SpacetimeDB reducer endpoint
- [ ] Add environment variable configuration (SPACETIMEDB_URL, DATABASE, TOKEN)
- [ ] Implement error handling for 4xx/5xx responses
- [ ] Add retry logic for network timeouts (1 retry max)
- [ ] Add unit tests:
  - Successful reducer call (200 OK) → returns success
  - Reducer failure (4xx) → rejects with `REDUCER_FAILED`
  - Network timeout → retries once, then fails
- [ ] Add metrics: reducer call success/failure/retry counters, latency histogram

### Task 8: Error Response Formatting
- [ ] Implement error response creation function
- [ ] Map internal errors to error codes (INVALID_SIGNATURE, UNKNOWN_REDUCER, etc.)
- [ ] Return JSON error responses from `/handle-packet` endpoint
- [ ] Add unit tests for each error code

### Task 9: Logging and Monitoring
- [ ] Add structured logging (JSON format recommended)
- [ ] Log all packets at DEBUG level (amount, account, event ID, pubkey, reducer)
- [ ] Log all errors at ERROR level (event ID, error code, message)
- [ ] Log all successful reducer calls at INFO level (event ID, reducer, execution time)
- [ ] Add metrics dashboard (if Crosstown has monitoring infrastructure)

### Task 10: Integration Testing
- [ ] Set up test environment (Client ILP Connector + Crosstown Node + BLS + SpacetimeDB)
- [ ] Test end-to-end flow:
  - Valid ILP packet → reducer executes, success returned
  - Invalid signature → rejected with `INVALID_SIGNATURE`
  - Unknown reducer → rejected with `UNKNOWN_REDUCER`
  - Reducer failure → rejected with `REDUCER_FAILED`
- [ ] Test performance under load (10 actions/second sustained)

### Task 11: Documentation
- [ ] Document BLS handler configuration (environment variables)
- [ ] Document `/handle-packet` endpoint specification
- [ ] Document error codes and troubleshooting steps
- [ ] Document how to add new reducers to allowlist
- [ ] Document monitoring and alerting setup

---

## Configuration

### Environment Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `SPACETIMEDB_URL` | SpacetimeDB HTTP endpoint | `http://localhost:3000` | Yes |
| `SPACETIMEDB_DATABASE` | Database name | `bitcraft` | Yes |
| `SPACETIMEDB_TOKEN` | Admin token for SpacetimeDB API | `admin_token_abc123` | Yes |
| `BLS_LOG_LEVEL` | Logging level | `debug`, `info`, `warn`, `error` | No (default: `info`) |
| `BLS_KNOWN_REDUCERS` | Comma-separated list of allowed reducers | `player_move,craft_item` | No (uses static allowlist if not set) |
| `BLS_HANDLE_PACKET_PORT` | Port for `/handle-packet` endpoint | `8080` | No (default: `3001`) |

### Sample Configuration File

```yaml
# crosstown-bls.config.yaml
spacetimedb:
  url: http://localhost:3000
  database: bitcraft
  token: ${SPACETIMEDB_ADMIN_TOKEN}

bls:
  port: 3001
  logLevel: info
  knownReducers:
    - player_move
    - craft_item
    - harvest_resource
    - build_structure

  performance:
    maxLatencyMs: 500
    maxRetries: 1
```

---

## Testing Strategy

### Unit Tests (95%+ Coverage)

**ILP Packet Parsing Tests:**
- ✅ Valid ILP packet with kind 30078 event → parses
- ✅ Invalid packet.data (not JSON) → rejects with INVALID_PACKET
- ✅ Valid JSON but wrong event kind → rejects with INVALID_PACKET
- ✅ Missing packet.data field → rejects

**Signature Validation Tests:**
- ✅ Valid NIP-01 event → signature validates
- ✅ Invalid signature → rejects
- ✅ Tampered event ID → rejects
- ✅ Missing signature field → rejects

**Content Parsing Tests:**
- ✅ Valid JSON with reducer and args → parses
- ✅ Invalid JSON → rejects with INVALID_CONTENT
- ✅ Missing reducer field → rejects
- ✅ Missing args field → rejects
- ✅ Non-array args field → rejects

**Reducer Validation Tests:**
- ✅ Known reducer → passes
- ✅ Unknown reducer → rejects with UNKNOWN_REDUCER
- ✅ Case sensitivity (e.g., "Player_Move" vs "player_move")

**Identity Propagation Tests:**
- ✅ Hex pubkey → npub conversion is correct
- ✅ Args array prepending (not appending)
- ✅ Original args preserved and unmodified

**SpacetimeDB Call Tests (Mocked):**
- ✅ 200 OK response → success
- ✅ 400 Bad Request → REDUCER_FAILED
- ✅ 500 Internal Server Error → REDUCER_FAILED
- ✅ Network timeout → retries once, then fails

### Integration Tests

**End-to-End Flow:**
- ✅ Client → Client ILP Connector → Crosstown Connector → BLS `/handle-packet` → SpacetimeDB → success response
- ✅ Invalid signature → BLS rejects with INVALID_SIGNATURE error
- ✅ Unknown reducer → BLS rejects with UNKNOWN_REDUCER error
- ✅ Reducer fails validation → BLS rejects with REDUCER_FAILED error

**Performance Tests:**
- ✅ Single packet latency < 500ms (p95)
- ✅ Sustained 10 actions/second for 60 seconds (no errors)
- ✅ Signature validation < 50ms (p95)
- ✅ SpacetimeDB HTTP call < 400ms (p95)

---

## Success Criteria

The BLS handler implementation is considered **DONE** when:

- [ ] All unit tests pass (95%+ coverage)
- [ ] All integration tests pass (end-to-end flow validated)
- [ ] `POST /handle-packet` endpoint accepts ILP packets
- [ ] Performance targets met:
  - [ ] p95 latency < 500ms
  - [ ] Sustained 10 actions/second throughput
- [ ] Error handling complete:
  - [ ] All error codes implemented (INVALID_SIGNATURE, UNKNOWN_REDUCER, REDUCER_FAILED, INVALID_CONTENT, INVALID_PACKET)
  - [ ] Errors logged with sufficient detail
  - [ ] Errors returned to connector as JSON
- [ ] Documentation complete:
  - [ ] Configuration guide (environment variables)
  - [ ] `/handle-packet` endpoint specification
  - [ ] Error code reference
  - [ ] Troubleshooting guide
- [ ] Sigil SDK integration tests pass:
  - [ ] Client → Connector → BLS → SpacetimeDB (round-trip)
  - [ ] Error propagation (client receives error messages)

---

## Open Questions

**Q1: ILP Packet Binary Format**
- **Issue:** Is `ilp-packet` npm package the correct library for parsing ILP packets?
- **MVP Approach:** Use `ilp-packet` (standard Interledger library)
- **Action:** Confirm with Crosstown team which ILP library/protocol version is used

**Q2: SpacetimeDB Admin Token Security**
- **Issue:** Using admin token gives BLS handler overly broad permissions
- **MVP Approach:** Use admin token for MVP (acceptable risk)
- **Future Enhancement:** Create service account with limited permissions (only reducer execution)
- **Action:** Document admin token as security risk in deployment guide

**Q3: Reducer Allowlist Maintenance**
- **Issue:** Static allowlist requires code changes when new reducers are added
- **MVP Approach:** Static allowlist in code (Task 5, Option A)
- **Future Enhancement:** Query SpacetimeDB schema endpoint dynamically (Option B)
- **Action:** Document how to update allowlist when adding new reducers

**Q4: Retry Logic for Network Failures**
- **Issue:** Should BLS handler retry on SpacetimeDB network timeout?
- **MVP Approach:** Retry once (max 1 retry)
- **Rationale:** Client can retry via ILP if needed; excessive retries risk duplicate actions
- **Action:** Log retries at WARN level for monitoring

---

## Contact & Coordination

**Sigil SDK Team:**
- Primary Contact: [Your Name/Email]
- Repository: `https://github.com/[org]/sigil-sdk`
- Integration Test Location: `packages/client/src/integration-tests/bls-handler.integration.test.ts`

**Crosstown Team:**
- Primary Contact: [Crosstown Team Contact]
- Repository: `https://github.com/[org]/crosstown`
- BLS Handler Location: `[TBD - to be determined by Crosstown team]`

**Handoff Process:**
1. Crosstown team reviews this specification document
2. Crosstown team implements BLS handler per specification
3. Crosstown team deploys BLS handler with `/handle-packet` endpoint
4. Crosstown team notifies Sigil SDK team when BLS handler is deployed
5. Sigil SDK team runs integration tests against live BLS handler
6. Both teams validate end-to-end flow (Client → Connector → BLS → SpacetimeDB)
7. Story 2.4 marked complete when all integration tests pass

---

## Appendix A: Example ILP Packet & Event Payloads

### Example 1: Player Move Action

**ILP Packet (Binary):**
```
(Binary ILP packet structure - deserialized using ilp-packet library)
- amount: "100"
- account: "g.crosstown.bls"
- data: Buffer containing Nostr event JSON (below)
- expiresAt: Date(2024-03-01T12:00:00Z)
- executionCondition: Buffer(32 bytes)
```

**Nostr Event (Extracted from packet.data):**
```json
{
  "id": "a1b2c3d4e5f6...",
  "pubkey": "abc123def456...",
  "created_at": 1709136000,
  "kind": 30078,
  "tags": [],
  "content": "{\"reducer\":\"player_move\",\"args\":[{\"x\":100,\"z\":200},{\"x\":110,\"z\":200},false]}",
  "sig": "signature_hex_string..."
}
```

**SpacetimeDB HTTP Call:**
```
POST /database/bitcraft/call/player_move
Authorization: Bearer admin_token_abc123
Content-Type: application/json

["npub1abc123...", {"x":100,"z":200}, {"x":110,"z":200}, false]
```

### Example 2: Craft Item Action

**Nostr Event (Extracted from ILP packet.data):**
```json
{
  "id": "f1e2d3c4b5a6...",
  "pubkey": "xyz789uvw012...",
  "created_at": 1709136100,
  "kind": 30078,
  "tags": [],
  "content": "{\"reducer\":\"craft_item\",\"args\":[{\"itemId\":42,\"quantity\":5}]}",
  "sig": "signature_hex_string..."
}
```

**SpacetimeDB HTTP Call:**
```
POST /database/bitcraft/call/craft_item
Authorization: Bearer admin_token_abc123
Content-Type: application/json

["npub1xyz789...", {"itemId":42,"quantity":5}]
```

---

## Appendix B: Error Code Reference

| Error Code | Description | Retryable | Client Action |
|------------|-------------|-----------|---------------|
| `INVALID_PACKET` | ILP packet.data is not a valid Nostr event (kind 30078) | No | Check ILP packet construction, verify event kind |
| `INVALID_SIGNATURE` | Event signature verification failed (secp256k1) | No | Re-sign the event, check Nostr keypair |
| `UNKNOWN_REDUCER` | Reducer name not recognized by BLS handler | No | Check reducer name spelling, verify reducer exists in SpacetimeDB schema |
| `REDUCER_FAILED` | SpacetimeDB reducer returned an error (4xx/5xx) | No | Check reducer arguments, verify game state allows this action |
| `INVALID_CONTENT` | Event content is not valid JSON or missing required fields | No | Fix JSON formatting, ensure `reducer` and `args` fields present |

---

## Appendix C: Performance Benchmarks

**Target Hardware:**
- CPU: 4 cores @ 2.5GHz
- RAM: 8GB
- Network: < 50ms latency to SpacetimeDB

**Expected Performance:**
- Single packet latency: 200-400ms (p50), < 500ms (p95)
- Throughput: 10-20 actions/second per BLS instance
- Signature validation: 20-40ms (p50), < 50ms (p95)
- SpacetimeDB HTTP call: 100-300ms (p50), < 400ms (p95)

**Scaling Strategy:**
- Horizontal: Deploy multiple BLS handler instances behind load balancer
- Vertical: Increase CPU cores if signature validation is bottleneck

---

**END OF SPECIFICATION**

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-02-28 | 1.0 | Sigil SDK Team | Initial specification created (incorrect ILP routing) |
| 2026-02-28 | 2.0 | Sigil SDK Team | **CORRECTED:** ILP routing architecture - BLS receives ILP packets via `/handle-packet` endpoint from Crosstown node's connector (not Nostr events from relay) |
