# NIP-19 Entity Encoding

## Why Bech32 Encoding

Raw Nostr identifiers are 64-character hex strings (32 bytes). These are error-prone to copy, ambiguous (is this hex string a pubkey or an event ID?), and unfriendly for human consumption. NIP-19 uses bech32 encoding with human-readable prefixes to solve all three problems: checksums catch typos, prefixes disambiguate types, and the encoding is more compact visually.

## Basic Types

### npub — Public Key

Encodes a 32-byte public key with the `npub` prefix:

```
npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3e5a4u
```

Use for sharing your identity. This is what others use to find and follow you.

```typescript
import { nip19 } from 'nostr-tools';

// Encode a hex pubkey to npub
const npub = nip19.npubEncode('3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d');

// Decode npub back to hex
const { type, data } = nip19.decode(npub);
// type === 'npub', data === '3bf0c63f...'
```

### nsec — Secret Key

Encodes a 32-byte secret key with the `nsec` prefix:

```
nsec1...
```

**Never share, log, or transmit an nsec.** It is the private key that controls the identity. If leaked, the identity is permanently compromised with no recovery mechanism. Prefer storing the raw bytes in secure storage rather than the bech32 form.

```typescript
// Encode (use ONLY for secure backup/export)
const nsec = nip19.nsecEncode(secretKeyBytes);

// Decode (use ONLY during import from user input)
const { type, data } = nip19.decode(nsec);
// type === 'nsec', data === Uint8Array (32 bytes)
```

### note — Event ID

Encodes a 32-byte event ID with the `note` prefix:

```
note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqdae3p7
```

Use for referencing a specific event in human-readable form.

```typescript
const noteId = nip19.noteEncode('event-id-hex...');
const { type, data } = nip19.decode(noteId);
// type === 'note', data === 'event-id-hex...'
```

## TLV (Type-Length-Value) Types

These advanced types encode additional metadata alongside the core identifier:

### nevent — Event with Relay Hints

Encodes an event ID plus optional relay URLs, author pubkey, and kind:

```typescript
const nevent = nip19.neventEncode({
  id: 'event-id-hex...',
  relays: ['wss://relay.example.com'],
  author: 'pubkey-hex...',
  kind: 1,
});

const { type, data } = nip19.decode(nevent);
// type === 'nevent'
// data === { id, relays, author, kind }
```

Relay hints help clients find the event without querying every known relay.

### nprofile — Profile with Relay Hints

Encodes a pubkey plus relay URLs where that user publishes:

```typescript
const nprofile = nip19.nprofileEncode({
  pubkey: 'pubkey-hex...',
  relays: ['wss://relay.example.com', 'wss://relay2.example.com'],
});

const { type, data } = nip19.decode(nprofile);
// type === 'nprofile'
// data === { pubkey, relays }
```

More useful than a bare `npub` because it tells the recipient where to find the user's content.

### naddr — Parameterized Replaceable Event

Encodes a reference to a parameterized replaceable event (NIP-33) by its coordinates (kind + pubkey + d-tag):

```typescript
const naddr = nip19.naddrEncode({
  identifier: 'my-article-slug',  // d-tag value
  pubkey: 'author-pubkey-hex...',
  kind: 30023,  // Long-form content
  relays: ['wss://relay.example.com'],
});

const { type, data } = nip19.decode(naddr);
// type === 'naddr'
// data === { identifier, pubkey, kind, relays }
```

Used for referencing replaceable events like long-form articles (kind:30023), repository announcements (kind:30617), and other NIP-33 events where the content can be updated.

## Decoding Any NIP-19 String

```typescript
import { nip19 } from 'nostr-tools';

const decoded = nip19.decode(anyNip19String);

switch (decoded.type) {
  case 'npub':    // decoded.data = hex pubkey string
  case 'nsec':    // decoded.data = Uint8Array secret key
  case 'note':    // decoded.data = hex event ID string
  case 'nevent':  // decoded.data = { id, relays?, author?, kind? }
  case 'nprofile': // decoded.data = { pubkey, relays? }
  case 'naddr':   // decoded.data = { identifier, pubkey, kind, relays? }
}
```

## TOON Context

NIP-19 encoding is the same on TOON as on vanilla Nostr -- it is a client-side encoding standard that does not interact with ILP or TOON format. The relay URLs in `nevent`, `nprofile`, and `naddr` should point to TOON relays (which speak TOON format) when referencing TOON-network content.
