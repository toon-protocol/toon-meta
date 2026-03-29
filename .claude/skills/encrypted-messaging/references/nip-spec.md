# NIP Specifications: Encrypted Messaging Events

> **Why this reference exists:** Agents need precise cryptographic details and event structures to construct valid encrypted messages. This file covers NIP-44 (versioned encrypted payloads) and NIP-59 (gift wrap with metadata hiding). Understanding these structures prevents malformed encryption that wastes ILP payment on rejected publishes or produces unreadable ciphertext.

## NIP-44 -- Versioned Encrypted Payloads

NIP-44 defines the current standard for encrypting content between two Nostr keypairs. It replaces the deprecated NIP-04 which had known vulnerabilities (no padding, no authentication, IV reuse risks, metadata leakage).

### Cryptographic Primitives

| Component | Algorithm | Purpose |
|-----------|-----------|---------|
| Key agreement | secp256k1 ECDH | Derive shared secret from sender privkey + recipient pubkey |
| Key derivation | HKDF-SHA256 | Derive conversation key from shared secret; derive message key from conversation key + nonce |
| Encryption | XChaCha20-Poly1305 | Authenticated encryption with 24-byte nonce |
| Padding | Power-of-2 scheme | Hide message length |

### Key Derivation

**Step 1 -- Shared secret:**
Compute `sharedPoint = secp256k1_ecdh(senderPrivateKey, recipientPublicKey)`. Take the x-coordinate of the resulting point (32 bytes).

**Step 2 -- Conversation key:**
Derive using HKDF-SHA256 with:
- IKM: shared secret x-coordinate (32 bytes)
- Salt: `"nip44-v2"` (UTF-8 encoded)
- Info: empty
- Output length: 32 bytes

The conversation key is deterministic and symmetric -- `conversationKey(A_priv, B_pub) == conversationKey(B_priv, A_pub)`. Both parties derive the same key.

**Step 3 -- Message key (per-message):**
Generate a random 32-byte nonce. Derive message key using HKDF-SHA256 with:
- IKM: conversation key (32 bytes)
- Salt: nonce (32 bytes)
- Info: `"nip44-v2"` (UTF-8 encoded)
- Output length: 76 bytes

Split the 76-byte output:
- Bytes 0-31: ChaCha20 key (32 bytes)
- Bytes 32-55: ChaCha20 nonce (24 bytes)
- Bytes 56-75: HMAC key (20 bytes) -- reserved for future use

### Padding Scheme

Plaintext is padded before encryption to hide message length. The padding algorithm:

1. Calculate the padded length as the next power of 2, with a minimum of 32 bytes
2. For messages longer than 32 bytes, use a more granular scheme: `max(32, 2^ceil(log2(len)))`
3. Prepend 2 bytes (big-endian uint16) containing the unpadded message length
4. Append zero bytes to reach the padded length + 2

| Message Length | Padded Length (including 2-byte length prefix) |
|---------------|-----------------------------------------------|
| 1-30 bytes | 34 bytes (32 + 2) |
| 31-62 bytes | 66 bytes (64 + 2) |
| 63-126 bytes | 130 bytes (128 + 2) |
| 127-254 bytes | 258 bytes (256 + 2) |
| 255-510 bytes | 514 bytes (512 + 2) |

### Ciphertext Format

The final encrypted payload is a base64-encoded concatenation:

```
[version byte (1)] [nonce (32)] [ciphertext (padded_len + 16)]
```

| Field | Size | Description |
|-------|------|-------------|
| Version | 1 byte | `0x02` for NIP-44 v2 |
| Nonce | 32 bytes | Random nonce used for HKDF key derivation |
| Ciphertext | variable | XChaCha20-Poly1305 output (padded plaintext + 16-byte MAC) |

Total overhead per encryption: 1 (version) + 32 (nonce) + 16 (MAC) + padding = 49 bytes minimum + padding overhead.

### Decryption

1. Base64-decode the payload
2. Verify version byte is `0x02`
3. Extract nonce (bytes 1-32) and ciphertext (bytes 33+)
4. Derive conversation key from recipient private key + sender public key
5. Derive message key from conversation key + nonce
6. Decrypt ciphertext using XChaCha20-Poly1305 with derived key and nonce
7. Verify and strip padding: read 2-byte length prefix, extract message, verify remaining bytes are zero

### Security Properties

- **Authenticated encryption:** Poly1305 MAC prevents tampering
- **Forward secrecy per-message:** Each message uses a unique random nonce for key derivation
- **Length hiding:** Padding conceals approximate message size (within a power-of-2 bucket)
- **No IV reuse risk:** Random 32-byte nonce per message (negligible collision probability)
- **Symmetric conversation key:** Both parties can decrypt messages in either direction
- **Version upgradeable:** Version byte allows future algorithm changes

### NIP-04 Comparison (Why NIP-44 Replaced It)

| Property | NIP-04 (Deprecated) | NIP-44 |
|----------|---------------------|--------|
| Encryption | AES-256-CBC | XChaCha20-Poly1305 |
| Authentication | None | Poly1305 MAC |
| Padding | None (length leaked) | Power-of-2 padding |
| IV/Nonce | 16-byte IV (reuse risk) | 32-byte random nonce |
| Key derivation | Raw ECDH point | HKDF-SHA256 |
| Version field | No | Yes (upgradeable) |

## NIP-59 -- Gift Wrap

NIP-59 defines a three-layer encryption protocol that hides sender identity, recipient identity (partially), content, and timing metadata. It builds on NIP-44 for the encryption layer.

### Event Kinds

| Kind | Name | Purpose |
|------|------|---------|
| 1059 | Gift wrap | Outer envelope, published to relays. Signed by ephemeral key. |
| 1060 | Seal | Middle layer, encrypted inside gift wrap. Signed by real author. |

### Three-Layer Model

**Layer 1 -- Inner Event (Rumor):**

The actual content event. It has the real author's pubkey, real content, and real created_at. It is **unsigned** (no `sig` field) -- this is intentional to provide plausible deniability. Any valid event kind can be used as the inner event.

```
{
  "pubkey": "<real-author-pubkey>",
  "created_at": <real-timestamp>,
  "kind": <actual-event-kind>,
  "tags": [...],
  "content": "<actual-message-content>"
}
```

Note: The inner event has no `id` or `sig` fields. It is a "rumor" -- an unsigned event.

**Layer 2 -- Seal (kind:1060):**

The inner event is JSON-serialized and NIP-44 encrypted using the real author's private key and the recipient's public key. The result is placed in the seal's content field.

```
{
  "id": "<hash>",
  "pubkey": "<real-author-pubkey>",
  "created_at": <randomized-timestamp>,
  "kind": 1060,
  "tags": [],
  "content": "<nip44-encrypted-inner-event>",
  "sig": "<signature-by-real-author>"
}
```

Key properties of the seal:
- `pubkey` is the real author (needed for decryption)
- `created_at` is randomized (within 2 days of actual time) to prevent timing analysis
- `tags` is empty (no metadata leakage)
- Signed by the real author's key

**Layer 3 -- Gift Wrap (kind:1059):**

The seal is JSON-serialized and NIP-44 encrypted using a random ephemeral private key and the recipient's public key. The result is placed in the gift wrap's content field.

```
{
  "id": "<hash>",
  "pubkey": "<ephemeral-pubkey>",
  "created_at": <randomized-timestamp>,
  "kind": 1059,
  "tags": [
    ["p", "<recipient-pubkey>"]
  ],
  "content": "<nip44-encrypted-seal>",
  "sig": "<signature-by-ephemeral-key>"
}
```

Key properties of the gift wrap:
- `pubkey` is a random ephemeral key (hides real sender)
- `created_at` is randomized (within 2 days of actual time)
- `p` tag contains the recipient's pubkey (needed for relay delivery)
- Signed by the ephemeral key (not the real author)
- A **new ephemeral key MUST be generated for each gift wrap** -- reusing ephemeral keys links messages

### Tag Reference

**kind:1059 (Gift Wrap):**

| Tag | Required | Description |
|-----|----------|-------------|
| `p` | Yes | Recipient pubkey. Needed for relay routing and recipient filtering. |

**kind:1060 (Seal):**

| Tag | Required | Description |
|-----|----------|-------------|
| (none) | -- | Seals have no tags to prevent metadata leakage. |

### What Gift Wrap Hides

| Property | Visible to Observer? | Details |
|----------|---------------------|---------|
| Sender identity | No | Gift wrap pubkey is ephemeral; real author is inside the encrypted seal |
| Recipient identity | Partially | The `p` tag reveals the recipient pubkey |
| Content | No | Encrypted inside two NIP-44 layers |
| Inner event kind | No | Hidden inside the encrypted inner event |
| Actual timestamp | No | Both seal and gift wrap use randomized timestamps |
| Message linking | No | Each gift wrap uses a fresh ephemeral key |

### Timestamp Randomization

Both the seal and gift wrap `created_at` values should be randomized to prevent timing correlation. The recommended approach:
- Subtract a random number of seconds (0 to 172800, i.e., 0-2 days) from the actual time
- This prevents observers from correlating gift wrap events with specific real-world events

### Decryption Flow

1. Receive kind:1059 event
2. NIP-44 decrypt the content using recipient's private key + ephemeral pubkey from gift wrap -- yields the kind:1060 seal JSON
3. Parse the seal JSON, extract the real author's pubkey
4. NIP-44 decrypt the seal's content using recipient's private key + real author's pubkey -- yields the inner event (rumor) JSON
5. Parse the inner event to get the actual content, kind, tags, and real author

### Usage with NIP-17 (Private Direct Messages)

NIP-17 defines private direct messages using NIP-59 gift wrap. The inner event uses kind:14 (private direct message):

```
Inner event (rumor):
{
  "pubkey": "<sender-pubkey>",
  "created_at": <real-timestamp>,
  "kind": 14,
  "tags": [
    ["p", "<recipient-pubkey>", "<relay-url-hint>"],
    ["e", "<replied-to-event-id>", "<relay-url-hint>", "reply"]
  ],
  "content": "The actual message text"
}
```

The inner kind:14 event is wrapped in a seal (kind:1060) and then a gift wrap (kind:1059), following the standard three-layer model. For group DMs, the sender creates a separate gift wrap for each recipient.

### Security Considerations

- **Ephemeral key reuse:** NEVER reuse ephemeral keys across gift wraps. Each message must generate a fresh random keypair for the outer gift wrap layer.
- **Unsigned inner events:** The inner event (rumor) is intentionally unsigned. This provides plausible deniability -- the recipient cannot prove to a third party that the sender authored the message.
- **Relay visibility:** Relays can see the recipient's pubkey (from the `p` tag) but cannot see the sender or content. This is a deliberate tradeoff -- relays need the `p` tag to route events to the correct recipient.
- **Seal timestamp:** The randomized timestamp on the seal prevents timing analysis even if the inner encryption is compromised independently.
- **No proof of authorship:** Since the inner event is unsigned, the recipient trusts the seal's signature as proof of authorship. The seal is signed by the real author and encrypts the inner event, providing authentication without non-repudiation.
