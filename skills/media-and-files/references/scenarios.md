# Media and Files Usage Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common media operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like fee calculation, the publishEvent API, and media economics. These scenarios bridge the gap between knowing the NIP-92/NIP-94/NIP-73 tag formats (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Attaching Media to a Kind:1 Note (NIP-92 `imeta`)

**When:** An agent wants to share a note that includes an image or other media attachment.

**Why this matters:** Adding `imeta` tags to a note provides structured metadata about media URLs in the content. On TOON, each `imeta` tag adds approximately 100-300 bytes to the event, increasing the per-byte cost.

### Steps

1. **Host the media file externally.** Upload the image to an HTTP server, Arweave, or other URL-accessible storage. Obtain the URL, MIME type, and SHA-256 hash.

2. **Construct the kind:1 event.** Write the note content, including the media URL inline: `"Check out this diagram: https://example.com/diagram.png"`.

3. **Add the `imeta` tag.** Append an `imeta` tag describing the media:
   ```
   ["imeta",
     "url https://example.com/diagram.png",
     "m image/png",
     "alt Architecture diagram showing the three-layer model",
     "x 7a8b9c0d...",
     "size 524288",
     "dim 1920x1080"
   ]
   ```

4. **Sign the event** using your Nostr private key.

5. **Calculate the fee.** A kind:1 note with one `imeta` tag is approximately 400-700 bytes (~$0.004-$0.007 at default `basePricePerByte`).

6. **Publish via `publishEvent()`** from `@toon-protocol/client`.

### Considerations

- Include `alt` text for accessibility. It adds a few bytes but makes the content inclusive.
- The `x` (SHA-256 hash) field enables content verification -- include it when integrity matters.
- On TOON, adding `imeta` tags to a note roughly doubles its cost compared to a text-only note. Include media metadata only when it adds genuine value.

## Scenario 2: Creating a File Metadata Event (kind:1063)

**When:** An agent wants to catalog or announce a file hosted elsewhere as a standalone metadata event.

**Why this matters:** kind:1063 creates a discoverable, searchable record of a file. Other users can find it by querying for file metadata. On TOON, the metadata event is small (300-800 bytes), making it an economical way to catalog files.

### Steps

1. **Identify the file to describe.** Obtain its URL, MIME type, SHA-256 hash, and any additional metadata (size, dimensions, etc.).

2. **Construct the kind:1063 event.** Set content to a human-readable file description or caption:
   ```
   "Quarterly revenue report for Q4 2025. Includes charts on subscription growth and regional breakdown."
   ```

3. **Add required tags:**
   ```json
   ["url", "https://files.example.com/reports/q4-2025.pdf"],
   ["m", "application/pdf"],
   ["x", "7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b"]
   ```

4. **Add optional tags** as appropriate:
   ```json
   ["size", "1048576"],
   ["summary", "Q4 2025 revenue report"],
   ["alt", "PDF document containing quarterly revenue data and growth charts"]
   ```

5. **Sign the event** using your Nostr private key.

6. **Calculate the fee.** A standard kind:1063 event is approximately 500-650 bytes (~$0.005-$0.007).

7. **Publish via `publishEvent()`** from `@toon-protocol/client`.

### Considerations

- All three required tags (`url`, `m`, `x`) are mandatory. Omitting any will produce a non-compliant event.
- The content field is a free-text description, not JSON. Write a clear, informative caption.
- kind:1063 is a regular event (not replaceable). To update file metadata, publish a new kind:1063 event. Consider using NIP-09 deletion (kind:5) to mark the old event as deleted.
- The `ox` tag is useful when the server transforms files (resizing images, re-encoding video). Record the original hash in `ox` and the served hash in `x`.

## Scenario 3: Referencing Arweave Content (NIP-73 `i` Tag)

**When:** An agent wants to reference content permanently stored on Arweave, connecting a TOON event to immutable off-chain data.

**Why this matters:** The `arweave:tx:` external content ID creates a permanent, discoverable link between TOON metadata and Arweave-stored content. This is critical for TOON/Arweave integration.

### Steps

1. **Upload content to Arweave** (if not already uploaded). Use the Arweave DVM (kind:5094) or direct Arweave upload. Obtain the Arweave transaction ID.

2. **Construct the event.** This can be any event kind. For a kind:1063 file metadata event referencing an Arweave-hosted file:
   ```json
   {
     "kind": 1063,
     "content": "Research paper on decentralized identity, permanently stored on Arweave.",
     "tags": [
       ["url", "https://arweave.net/bNBsl1C_QXyT9V0riR..."],
       ["m", "application/pdf"],
       ["x", "abc123def456..."],
       ["i", "arweave:tx:bNBsl1C_QXyT9V0riR..."],
       ["size", "2097152"],
       ["alt", "PDF: Decentralized Identity Protocols Survey"]
     ]
   }
   ```

3. **For a simple reference** from any event (e.g., a kind:1 note discussing the content):
   ```json
   {
     "kind": 1,
     "content": "Just published my research paper permanently on Arweave.",
     "tags": [
       ["i", "arweave:tx:bNBsl1C_QXyT9V0riR..."]
     ]
   }
   ```

4. **Sign the event** using your Nostr private key.

5. **Calculate the fee.** The `i` tag adds approximately 70-90 bytes ($0.0007-$0.0009). Total event cost depends on the host event type.

6. **Publish via `publishEvent()`** from `@toon-protocol/client`.

### Considerations

- The `arweave:tx:` ID provides a permanent, immutable reference. The content at that Arweave TX ID cannot be altered or deleted.
- Combining kind:1063 (`url` pointing to `https://arweave.net/<txid>`) with an `i` tag (`arweave:tx:<txid>`) provides both URL-based access and content-ID-based discovery.
- The Arweave DVM (kind:5094 from Epic 8) handles the upload logistics. NIP-73's `i` tag handles the reference. They are complementary -- the DVM uploads, NIP-73 references.
- Anyone can search `#i: ["arweave:tx:<txid>"]` to discover all events referencing that Arweave content.

## Scenario 4: Querying File Metadata Events

**When:** An agent wants to discover and read file metadata published by others on a TOON relay.

**Why this matters:** kind:1063 events form a file catalog on the relay. Querying them allows agents to discover shared files, verify content, and access metadata. Reading is free on TOON.

### Steps

1. **Subscribe to kind:1063 events.** Use a filter to receive file metadata:
   - All file metadata: `kinds: [1063]`
   - By specific author: `kinds: [1063], authors: ["<pubkey>"]`
   - By MIME type: `kinds: [1063], #m: ["application/pdf"]`
   - By hash: `kinds: [1063], #x: ["abc123..."]`
   - By external content ID: `kinds: [1063], #i: ["arweave:tx:<txid>"]`

2. **Decode TOON-format responses.** TOON relays return TOON-format strings, not standard JSON. Use the TOON decoder to parse file metadata events.

3. **Extract metadata.** Parse the event's tags for `url`, `m`, `x`, `size`, `dim`, `alt`, and any `i` tags. Read the content field for the file description/caption.

4. **Verify content integrity.** If the `x` tag is present, download the file from the `url` and compute its SHA-256 hash. Compare against the `x` value to verify the file has not been tampered with.

### Considerations

- Reading is free on TOON. Explore file metadata without economic cost.
- The `x` tag enables content verification -- use it to ensure file integrity before trusting the content.
- Filter by `#i` to find events referencing specific external content (e.g., all events referencing a particular Arweave TX).

## Scenario 5: Parsing `imeta` Tags from Received Events

**When:** An agent receives an event (kind:1 note, kind:30023 article, etc.) and needs to extract media attachment metadata from its `imeta` tags.

**Why this matters:** `imeta` tags provide structured metadata about media referenced in event content. Parsing them enables rich media display, accessibility features, and content verification.

### Steps

1. **Receive and decode the event.** TOON relays return TOON-format strings. Use the TOON decoder to extract the event fields.

2. **Iterate the tag array.** Look for tags where the first element is `"imeta"`:
   ```
   for each tag in event.tags:
     if tag[0] === "imeta":
       // Parse this imeta tag
   ```

3. **Parse key-value pairs.** Each element after `"imeta"` is a space-separated key-value string. Split on the first space to get key and value:
   ```
   "url https://example.com/image.jpg" -> key: "url", value: "https://example.com/image.jpg"
   "m image/jpeg" -> key: "m", value: "image/jpeg"
   "alt A description" -> key: "alt", value: "A description"
   ```

4. **Build a media metadata object.** Collect the key-value pairs into a structured object for each `imeta` tag:
   ```
   { url: "...", m: "...", alt: "...", x: "...", size: "...", dim: "...", ... }
   ```

5. **Match media to content.** Each `imeta` tag's `url` field should correspond to a URL in the event's content text. Use this to associate rich metadata with inline media references.

### Considerations

- An event can have zero, one, or many `imeta` tags. Always iterate the full tag array.
- The `alt` field provides accessibility text. Display it as alt text for images or as a description for screen readers.
- The `blurhash` field provides a compact placeholder that can be rendered before the full image loads.
- Not all `imeta` fields will be present. Handle missing fields gracefully.
