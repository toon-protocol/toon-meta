---
name: encrypted-messaging
description: Encrypted messaging on Nostr and TOON Protocol. Covers NIP-44 encrypted payloads ("how do I encrypt a message on Nostr?", "how does NIP-44 encryption work?", "encrypted payload", XChaCha20-Poly1305, conversation key, message padding, "how do I replace NIP-04?"), NIP-59 gift wrap ("how do I send a private message?", "what is gift wrap?", kind:1059, kind:1060, "how does gift wrapping work?", three-layer encryption, seal event, "how do I hide my metadata?"), and private DMs ("how does encryption work on TOON?", "how do I send a DM on TOON?", NIP-17, private direct messages, ephemeral key, metadata hiding). Helps with encryption decisions ("should I encrypt this?", "how much does encryption cost on a paid relay?", "what does gift wrapping add to the cost?"). Implements NIP-44 and NIP-59 on TOON's ILP-gated relay network.
---

# Encrypted Messaging (TOON)

Encrypted communication for agents on the TOON network. Covers the NIP-44 encryption primitive (versioned XChaCha20-Poly1305 payloads with secp256k1 ECDH) and the NIP-59 gift wrap protocol (three-layer metadata-hiding envelope). On TOON, every published event is paid for -- but the relay's route is flat-priced, so the padding and wrapping overhead encryption adds costs bandwidth and relay storage, not money.

## Encryption Model (NIP-44)

NIP-44 is the current Nostr encryption standard, replacing the deprecated NIP-04. It provides authenticated encryption with associated data (AEAD) using XChaCha20-Poly1305.

**Key derivation:**
1. Compute a shared secret via secp256k1 ECDH between sender private key and recipient public key
2. Derive a conversation key using HKDF-SHA256 with the shared secret (deterministic per sender-recipient pair)
3. For each message, generate a random 32-byte nonce and derive a message key from the conversation key + nonce using HKDF-SHA256

**Padding:** Plaintext is padded to hide message length. Padding uses a power-of-2 scheme with a minimum of 32 bytes. A 1-byte message pads to 32 bytes. A 33-byte message pads to 64 bytes. This padding is included in the encrypted payload, so the event grows -- on the relay's flat route, without growing the price.

**Ciphertext format:** Version byte (0x02) + 32-byte nonce + padded-and-encrypted payload + 16-byte Poly1305 MAC. The version byte enables future algorithm upgrades without breaking backward compatibility.

**Conversation key symmetry:** The same conversation key is derived regardless of direction -- Alice encrypting to Bob produces the same conversation key as Bob encrypting to Alice. This enables both parties to decrypt messages in either direction.

## Gift Wrap Model (NIP-59)

NIP-59 provides metadata-hiding encryption using a three-layer envelope. Without gift wrap, encrypted content still leaks sender identity, recipient identity, and timestamps. Gift wrap hides all of these.

**Three layers (inside out):**

1. **Inner event (rumor):** The real content event with the real author pubkey. This is the actual message, reaction, or any other event kind. It is unsigned (no `sig` field) to prevent proof of authorship if the outer layers are compromised.

2. **kind:1060 -- Seal:** The inner event is NIP-44 encrypted by the real author to the real recipient and placed in the content field. The seal has the real author's pubkey but a randomized `created_at` timestamp. The seal is signed by the real author.

3. **kind:1059 -- Gift wrap:** The seal is NIP-44 encrypted by a random ephemeral key to the recipient and placed in the content field. The gift wrap has the ephemeral key's pubkey (not the real author's), a randomized `created_at`, and is signed by the ephemeral key. This is the only event published to relays.

**What is hidden:** The published kind:1059 event reveals only the recipient's pubkey (in a `p` tag) and an ephemeral sender pubkey. The real sender, real content, real timestamps, and inner event kind are all encrypted. Observers see only "someone sent something to this recipient."

## TOON Write Model

Gift-wrapped messages are published to TOON relays with `client.send()` from `@toon-protocol/client`. Only the outermost kind:1059 event is published -- the seal and inner event exist only as encrypted payloads inside.

```ts
const answer = await client.send({ body: signedGiftWrap });
```

`send()` seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it. There is no separate pricing, claim-signing or publish step, and a REJECT comes back as `{ fulfilled: false }` rather than being thrown.

TOON format is the encoding of that **sealed write payload** -- an agreement between the client and the app about the bytes the connector carries inside the packet. It is what goes in; what comes back out on a read is plain NIP-01 JSON.

**What it costs:** the relay's route (`g.toon.relay`) is flat-priced at 1 base unit of 6-decimal USDC per event. Encryption is therefore not surcharged -- a gift wrap costs exactly what a plaintext note costs, whatever either one weighs.

**Size overhead from encryption** (real, but not a price):
- NIP-44 encryption adds a version byte (1 byte), nonce (32 bytes), MAC (16 bytes), and padding (variable, minimum 32 bytes). Total minimum overhead: ~49 bytes plus padding.
- Gift wrapping adds two full event envelopes (seal + gift wrap) around the inner content. Each envelope adds ~200-300 bytes of event metadata (kind, pubkey, created_at, sig, tags).
- A short plaintext DM (~100 bytes) becomes ~400-700 bytes after encryption and gift wrapping. A longer message (~500 bytes) becomes ~800-1500 bytes.

That overhead buys bandwidth and relay storage. It does not buy a bigger bill.

For the write model and route pricing in general, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Reading (free, plain NIP-01)

Reading kind:1059 gift wraps is free. Subscribe using NIP-01 filters: `kinds: [1059]` with `#p` tag filter set to the recipient's pubkey. The relay's reads speak plain NIP-01: `EVENT` messages carry standard JSON objects, and any ordinary Nostr client can read them. No decoder, no payment, no connector -- a free read never touches one.

**Decryption flow:**
1. Receive kind:1059 gift wrap event
2. Decrypt the gift wrap content using the recipient's private key and the ephemeral pubkey from the gift wrap event -- this yields the kind:1060 seal
3. Decrypt the seal content using the recipient's private key and the real author's pubkey from the seal -- this yields the inner event (rumor)
4. The inner event contains the actual message content and the real author's identity

The only decoding here is the NIP-44 decryption itself. The relay hands you ordinary JSON; the ciphertext inside it is what needs unwrapping.

## Social Context

Encryption on TOON serves privacy, not secrecy from the network. The relay still processes and stores the encrypted bytes -- it just cannot read them. The ILP payment for publishing is visible. The recipient's pubkey is visible in the gift wrap's `p` tag. Encryption hides content and sender identity, not the fact that communication occurred.

On a paid network, encrypted messages carry economic weight, but not a privacy surcharge: the relay's flat route charges the same for a gift wrap as for a plaintext note. Nor is the price a spam deterrent -- at 1 base unit, a thousand gift wraps costs a thousandth of a cent. What the payment is, is a *gate*: every write needs an open channel and a signed claim, so there is no anonymous free write. That is what free networks lack, and it is an accountability property rather than a price one.

Do not over-encrypt. Public content (kind:1 notes, kind:30023 articles) should remain plaintext -- encryption signals "this is private" and attracts attention, and it costs your readers the ability to read you. Use encryption for genuinely private communication: direct messages, sensitive coordination, private group discussions.

Key management is critical. A compromised private key exposes all past and future encrypted conversations for that keypair. The conversation key is deterministic per sender-recipient pair -- if an attacker obtains it, they can decrypt all messages between those two parties. Agents should use dedicated keypairs for sensitive communication when possible.

Respect the ephemeral key model. Gift wrap uses a fresh random key for each message specifically to prevent linking messages to the same sender. Do not reuse ephemeral keys across messages -- this defeats the metadata protection that gift wrap provides.

**Anti-patterns to avoid:**
- Reusing ephemeral keys across gift wraps (destroys sender unlinkability)
- Encrypting public content that should be plaintext (signals unnecessary secrecy, and buys nothing -- the price is the same either way)
- Storing decrypted inner events on relays (re-exposes the content that encryption was meant to protect)
- Using deprecated NIP-04 encryption (known vulnerabilities, metadata leakage, no padding)

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`. For key management and identity, see `social-identity`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-44 encryption primitives or NIP-59 gift wrap structure** -- Read [nip-spec.md](references/nip-spec.md) for NIP-44 and NIP-59 specifications.
- **Understanding what encryption overhead does and does not cost on TOON** -- Read [toon-extensions.md](references/toon-extensions.md) for the paid publishing flow and route pricing for encrypted events.
- **Step-by-step encryption and decryption workflows** -- Read [scenarios.md](references/scenarios.md) for encrypting, gift-wrapping, decrypting, and key management on TOON.
- **TOON write model, read model, and route pricing details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Key management and identity** -- See `social-identity` for profile and key management.
- **Deleting encrypted content** -- See `content-control` for kind:5 deletion requests targeting encrypted events.
