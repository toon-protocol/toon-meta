# Encrypted Messaging Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common encrypted messaging operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like fee calculation, encryption overhead, and the publishEvent API. These scenarios bridge the gap between knowing the cryptographic format (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Encrypting a Message with NIP-44

**When:** An agent needs to encrypt a payload for a specific recipient using NIP-44.

**Why this matters:** NIP-44 is the encryption primitive used by all modern Nostr encrypted communication. Understanding the encryption flow is essential before constructing gift wraps or private DMs.

### Steps

1. **Obtain the recipient's public key.** This is their secp256k1 public key (32-byte hex, the x-coordinate). You can find it from a kind:0 profile event, a `p` tag reference, or an npub1-encoded bech32 string (decode to get the raw pubkey).

2. **Derive the conversation key.** Compute secp256k1 ECDH between your private key and the recipient's public key. Take the x-coordinate of the shared point. Run HKDF-SHA256 with the shared secret as IKM and `"nip44-v2"` as salt to produce a 32-byte conversation key.

3. **Generate a random nonce.** Create 32 cryptographically random bytes. This nonce MUST be unique per message -- never reuse nonces.

4. **Derive the message key.** Run HKDF-SHA256 with the conversation key as IKM, the nonce as salt, and `"nip44-v2"` as info to produce 76 bytes. Split into: ChaCha20 key (bytes 0-31), ChaCha20 nonce (bytes 32-55), HMAC key (bytes 56-75).

5. **Pad the plaintext.** Calculate the padded length using the power-of-2 scheme (minimum 32 bytes). Prepend a 2-byte big-endian uint16 containing the unpadded message length. Append zero bytes to reach the target padded length + 2.

6. **Encrypt.** Run XChaCha20-Poly1305 with the derived ChaCha20 key and nonce over the padded plaintext. This produces the ciphertext + 16-byte MAC.

7. **Assemble the payload.** Concatenate: version byte `0x02` + 32-byte nonce + ciphertext. Base64-encode the result.

### Considerations

- The conversation key is the same in both directions (Alice-to-Bob and Bob-to-Alice). This means if you encrypt a message to someone, they can decrypt it using the same conversation key derived from their private key and your public key.
- Padding adds overhead. A 10-byte message pads to 32 bytes before encryption. On TOON, you pay for the padded size, not the original message size.
- Most Nostr libraries (nostr-tools) provide `nip44.encrypt()` and `nip44.decrypt()` functions that handle all these steps internally. Use them rather than implementing the cryptography manually.

## Scenario 2: Sending a Gift-Wrapped Direct Message

**When:** An agent wants to send a private message to another user on TOON with full metadata protection.

**Why this matters:** Gift wrapping (NIP-59) is the standard way to send private messages on Nostr. It hides the sender identity, content, and timing metadata. On TOON, the three-layer envelope adds byte overhead that increases the ILP fee.

### Steps

1. **Construct the inner event (rumor).** Build the actual message as a kind:14 event (NIP-17 private DM). Set `pubkey` to your real pubkey, `created_at` to the actual time, `content` to the message text, and add a `p` tag with the recipient's pubkey. Do NOT sign this event -- it must remain unsigned (no `id` or `sig` fields).

2. **Create the seal (kind:1060).** JSON-serialize the inner event. NIP-44 encrypt the serialized JSON using your private key and the recipient's public key. Create a kind:1060 event with: your real pubkey, a randomized `created_at` (subtract 0-172800 random seconds from current time), empty tags array, and the encrypted payload as content. Sign this event with your real private key.

3. **Generate an ephemeral keypair.** Create a fresh random secp256k1 private/public key pair. This keypair is used ONLY for this single gift wrap -- never reuse it.

4. **Create the gift wrap (kind:1059).** JSON-serialize the seal. NIP-44 encrypt the serialized seal using the ephemeral private key and the recipient's public key. Create a kind:1059 event with: the ephemeral pubkey, a randomized `created_at`, a `p` tag with the recipient's pubkey, and the encrypted payload as content. Sign this event with the ephemeral private key.

5. **Calculate the fee.** The gift wrap event is the full serialized kind:1059 event. Typical size for a short message: ~400-700 bytes. At default `basePricePerByte` of 10n, cost is approximately $0.004-$0.007.

6. **Publish via `publishEvent()`** from `@toon-protocol/client`. Only the kind:1059 gift wrap is published to the relay. The seal and inner event exist only as encrypted content inside it.

### Considerations

- Generate a NEW ephemeral key for every gift wrap. Reusing ephemeral keys links messages to the same sender, defeating the privacy model.
- The `p` tag on the gift wrap reveals the recipient. This is necessary for relay routing but means the relay knows who is receiving messages (though not from whom or what).
- For group DMs, create separate gift wraps for each recipient, each with its own ephemeral key.
- The randomized timestamps on both the seal and gift wrap should differ from each other and from the real time. This prevents timing correlation.
- On TOON, the privacy premium (2-5x plaintext cost) is the price for metadata protection. A plaintext kind:1 note of similar length would cost ~$0.002-$0.003 vs ~$0.004-$0.007 for a gift-wrapped DM.

## Scenario 3: Decrypting a Received Gift Wrap

**When:** An agent receives a kind:1059 gift wrap event on a TOON relay and needs to decrypt it to read the message.

**Why this matters:** Decryption is the reverse of the gift wrap flow. On TOON, reading is free -- no ILP payment is needed to receive and decrypt gift wraps.

### Steps

1. **Receive the kind:1059 event.** Subscribe using NIP-01 filter `{ kinds: [1059], "#p": ["<your-pubkey>"] }`. TOON relays return TOON-format strings -- use the TOON decoder to parse the event.

2. **Decrypt the gift wrap layer.** Extract the ephemeral pubkey from the gift wrap's `pubkey` field and the encrypted content from the `content` field. NIP-44 decrypt using your private key and the ephemeral pubkey. This yields the JSON-serialized kind:1060 seal.

3. **Parse the seal.** JSON-parse the decrypted content to get the kind:1060 seal event. Extract the real author's pubkey from the seal's `pubkey` field. Optionally verify the seal's signature against the real author's pubkey.

4. **Decrypt the seal layer.** NIP-44 decrypt the seal's `content` field using your private key and the real author's pubkey. This yields the JSON-serialized inner event (rumor).

5. **Parse the inner event.** JSON-parse the decrypted content to get the actual message. The inner event contains: the real author's pubkey, real timestamp, actual event kind, tags, and message content.

6. **Process the message.** Handle the inner event according to its kind. For kind:14, it is a private DM. Check the `p` tags for conversation participants. Check `e` tags for reply threading.

### Considerations

- Reading and decrypting gift wraps on TOON is free. No ILP payment is required for subscription or decryption.
- The inner event is unsigned (no `sig` field). Trust the seal's signature as proof of authorship -- the seal is signed by the real author and contains the encrypted inner event.
- Store decrypted messages locally, never re-publish them to relays. Re-publishing decrypted content defeats the purpose of encryption.
- If decryption fails at any layer, the gift wrap was not intended for you or is corrupted. Discard silently.
- TOON relays return TOON-format strings, not standard JSON. Always use the TOON decoder before attempting to parse event fields.

## Scenario 4: Key Management for Encrypted Communication

**When:** An agent needs to manage keys for encrypted messaging, including conversation key caching, ephemeral key generation, and key rotation considerations.

**Why this matters:** Proper key management is critical for encrypted communication security. A compromised key exposes all past conversations with every counterparty. On TOON, key management also affects cost -- re-establishing encrypted conversations after key rotation requires publishing new gift wraps.

### Steps

1. **Protect the primary private key.** The Nostr private key (nsec) is the root of all encryption. If compromised, an attacker can decrypt all past and future NIP-44 messages and forge seals that impersonate you. Store it securely -- use NIP-49 encrypted key export for backups.

2. **Cache conversation keys.** The conversation key between two parties is deterministic -- it does not change unless one party changes their key. Cache it locally after first derivation to avoid repeated ECDH computation. Index by the counterparty's pubkey.

3. **Generate ephemeral keys properly.** For each gift wrap, generate a fresh secp256k1 keypair using a cryptographically secure random number generator. After signing the gift wrap, the ephemeral private key can be discarded -- it is never needed again.

4. **Consider key rotation.** If a key is suspected compromised, generate a new keypair and publish a new kind:0 profile. All existing conversation keys are invalidated. Counterparties must discover your new pubkey and derive new conversation keys. Previous messages encrypted to the old key remain decryptable by anyone who obtained it.

5. **Handle multiple recipients.** For group DMs, derive a separate conversation key for each recipient. Create separate seals and gift wraps for each. This means N recipients require N gift wraps, each with its own ephemeral key -- the cost scales linearly.

### Considerations

- Never log, transmit, or store conversation keys in plaintext outside the agent's secure memory. They are equivalent to session keys.
- The conversation key is symmetric -- both parties derive the same key. This means either party can forge messages that appear to come from the other (to themselves). The seal signature provides authentication.
- On TOON, key rotation has cost implications: re-publishing profile events (kind:0) and potentially re-establishing encrypted channels all cost ILP fees.
- For high-security scenarios, consider using dedicated sub-keys (derived via NIP-44 conversation key from a master key) for different communication contexts. This limits the blast radius of a compromise.
- The `social-identity` skill covers key management in the context of profile and identity. Consult it for pubkey publishing, NIP-05 verification, and identity linking.
