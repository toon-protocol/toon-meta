# TOON Byte-Manipulation Testing Pattern

> **Context**: Discovered during Epic 1 (Stories 1-7 and 1-10). Documents the correct approach for testing signature verification on TOON-encoded Nostr events.

## The Problem

TOON is a binary encoding of Nostr events with structured header fields (kind, pubkey, id, sig) followed by content data. Flipping arbitrary bytes in encoded TOON data (`toonBytes[i] ^= 0xff`) typically corrupts the header structure, causing `shallowParseToon()` to throw a `ToonError` before signature verification ever runs. This means the test hits a parse error (F06 "Invalid TOON payload: failed to parse routing metadata") instead of the intended signature verification failure (F06 "Invalid Schnorr signature").

## The Solution: Hex-Level Corruption

To test signature verification, corrupt the signature at the **event object level** (hex strings), then re-encode through `encodeEventToToon()`. This produces a TOON payload that is structurally valid (shallow parse succeeds) but has an invalid Schnorr signature.

### Correct Pattern

```typescript
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import { encodeEventToToon } from '@toon-protocol/core/toon';
import type { NostrEvent } from 'nostr-tools/pure';

// 1. Create a properly signed event
const sk = generateSecretKey();
const event = finalizeEvent(
  { kind: 1, content: 'test', tags: [], created_at: Math.floor(Date.now() / 1000) },
  sk
);

// 2. Replace the sig with a valid-format but incorrect hex string
const badSigEvent = {
  ...event,
  sig: 'ff'.repeat(32) + '00'.repeat(32), // 64 bytes hex, structurally valid
} as NostrEvent;

// 3. Re-encode through TOON encoder -- structure is preserved
const badSigToonBytes = encodeEventToToon(badSigEvent);
const badSigBase64 = Buffer.from(badSigToonBytes).toString('base64');

// 4. This payload will:
//    - Pass shallowParseToon() (structure is valid)
//    - Fail Schnorr verification (signature doesn't match id/pubkey)
```

### Wrong Pattern (Do NOT Use)

```typescript
// BAD: Binary byte-flipping corrupts TOON structure
const toonBytes = encodeEventToToon(event);
const tampered = new Uint8Array(toonBytes);
tampered[10] ^= 0xff; // Likely corrupts a header field
// shallowParseToon() will throw ToonError before verification runs
```

### Edge Case: Byte-Flipping Near the End

Flipping bytes near the **end** of the TOON payload (e.g., `tampered[tampered.length - 5] ^= 0xff`) sometimes works because it hits the content area rather than header fields. However, this is fragile and position-dependent. The hex-level corruption approach is always reliable.

## When to Use Each Approach

| Goal | Approach |
|------|----------|
| Test signature verification (F06 sig error) | Hex-level sig corruption, re-encode |
| Test TOON parse rejection (F06 parse error) | Garbage bytes or truncated data |
| Test content tampering detection | Replace `content` field, re-encode (sig becomes invalid) |
| Test specific field corruption | Replace the field at object level, re-encode |

## Reference Implementations

- **Hex corruption**: `packages/sdk/src/dev-mode.test.ts` (lines 130-143)
- **Hex corruption (verification pipeline)**: `packages/sdk/src/verification-pipeline.test.ts` (`createTamperedToonPayload()`)
- **Parse error testing**: `packages/sdk/src/__integration__/create-node.test.ts` (line 171, `'not-valid-toon-data'`)
- **Content tampering**: `packages/bls/src/bls/BusinessLogicServer.test.ts` (line 239, `tamperedEvent`)
