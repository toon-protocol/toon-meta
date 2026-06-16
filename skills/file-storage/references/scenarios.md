# File Storage Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common file storage operations on TOON. Each scenario shows the complete flow from intent to result, including NIP-96 server interaction, NIP-98 authentication, and TOON-specific considerations like publishing the resulting kind:1063 metadata event via `publishEvent()`. These scenarios bridge the gap between knowing the NIP-96 protocol (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Discovering a File Storage Server

**When:** An agent needs to find a NIP-96-compatible file storage server and check its capabilities before uploading files.

**Why this matters:** Not all file storage servers accept the same file types or sizes. Checking server capabilities prevents upload failures and ensures the server meets the agent's needs. Server discovery is a free HTTP GET -- no Nostr relay or TOON payment involved.

### Steps

1. **Choose a server domain.** Identify a known NIP-96 file storage server (e.g., `nostr.build`, `void.cat`, or a self-hosted instance).

2. **Fetch the server info document.** Send an HTTP GET to `https://<server-domain>/.well-known/nostr/nip96.json`.

3. **Parse the response.** Extract key fields:
   - `api_url` -- the upload endpoint (POST destination)
   - `download_url` -- the base URL for file downloads
   - `content_types` -- accepted MIME types (e.g., `["image/jpeg", "image/png", "video/mp4"]`)
   - `plans` -- available plans with storage limits and file size limits
   - `tos_url` -- terms of service URL

4. **Validate compatibility.** Check that:
   - Your file's MIME type is in the `content_types` array
   - Your file's size is within the plan's `max_byte_size` limit
   - The plan's `is_nip98_required` field indicates whether NIP-98 auth is needed

5. **Review terms of service.** If `tos_url` is present, review the server's terms before uploading.

### Considerations

- Server discovery is entirely off-chain HTTP. No Nostr relay or TOON payment is involved.
- Cache the server info document locally to avoid repeated lookups. The capabilities rarely change.
- If `content_types` is absent from the response, the server accepts any content type.
- Some servers offer multiple plans (free/paid). Check the free plan limits before assuming unlimited storage.

## Scenario 2: Uploading a File

**When:** An agent wants to upload a file to a NIP-96 server and publish the resulting kind:1063 metadata event on TOON.

**Why this matters:** File upload is the core NIP-96 operation. The upload itself is off-chain HTTP (free on TOON), but publishing the metadata event on TOON requires ILP payment. This two-step process connects external file hosting to the Nostr event graph.

### Steps

1. **Discover the server.** Fetch `/.well-known/nostr/nip96.json` to obtain the `api_url` (see Scenario 1).

2. **Construct the NIP-98 auth event.** Create a kind:27235 event with:
   - `["u", "<api_url>"]` -- the exact upload URL
   - `["method", "POST"]` -- the HTTP method
   - Optionally: `["payload", "<sha256-of-file>"]` -- binds auth to this specific file
   - Set `created_at` to the current unix timestamp
   - Sign the event with your Nostr private key

3. **Base64-encode the auth event.** Serialize the signed kind:27235 event to JSON, then base64-encode it.

4. **Construct the multipart POST request.** Send to the `api_url` with:
   - Header: `Authorization: Nostr <base64-encoded-event>`
   - Form field `file`: the binary file data
   - Form field `caption` (optional): file description
   - Form field `alt` (optional): accessibility text for images
   - Form field `content_type` (optional): MIME type hint
   - Form field `no_transform` (optional): `"true"` to prevent server-side transforms

5. **Parse the upload response.** On success, the response contains:
   - `status`: `"success"`
   - `nip94_event`: object with `tags` and `content` for constructing a kind:1063 event
   - `message`: human-readable status

6. **Handle delayed processing.** If `status` is `"processing"`, the server is still processing the file (e.g., video transcoding). Poll the provided URL until the status changes to `"success"`.

7. **Construct the kind:1063 event.** Use the tags from `nip94_event.tags` and the content from `nip94_event.content`. Sign the event with your Nostr private key.

8. **Calculate the TOON fee.** The kind:1063 event is typically ~300-800 bytes (~$0.003-$0.008 at default `basePricePerByte`).

9. **Publish the kind:1063 event on TOON.** Use `publishEvent()` from `@toon-protocol/client`. This is the only step that involves TOON/ILP payment.

### Considerations

- The upload (steps 2-6) is off-chain HTTP. No TOON relay or ILP payment is involved until step 9.
- The NIP-98 auth event must have a recent `created_at` (within ~60 seconds). Do not pre-generate auth events.
- Include `alt` text for images -- it costs nothing in the upload and produces better accessibility metadata.
- Use `no_transform: "true"` when exact file content matters (cryptographic hashes, archival content).
- The `ox` tag in the response contains the original file hash; `x` contains the hash after server transforms.
- On TOON, you pay only for the kind:1063 metadata event (~300-800 bytes), not for the file upload itself.

## Scenario 3: Downloading a File

**When:** An agent wants to download a file referenced by a kind:1063 event or known by its SHA-256 hash.

**Why this matters:** File download is a simple HTTP GET. No authentication or TOON payment is required. The download URL pattern is deterministic from the server's `download_url` and the file's hash.

### Steps

1. **Obtain the file reference.** Either:
   - Parse a kind:1063 event and extract the `url` tag value, or
   - Construct the URL from the server's `download_url` and the file's SHA-256 hash: `<download_url>/<sha256-hash>.<ext>`

2. **Send an HTTP GET request** to the file URL.

3. **Receive the file.** The server returns the file with appropriate `Content-Type` headers.

4. **Verify integrity (optional).** If you have the `x` tag (SHA-256 hash of the stored file), compute the SHA-256 of the downloaded content and compare. If they differ, the file may have been tampered with or corrupted.

### Considerations

- Downloads require no authentication. Files are publicly accessible via their URL.
- The `url` tag in a kind:1063 event is the most reliable download reference. Use it directly when available.
- If constructing the URL manually, use the `ox` (original hash) value for the path, not `x` (post-transform hash), unless the server documentation says otherwise.
- Download is entirely off-chain HTTP. No TOON relay interaction or ILP payment is involved.
- File availability depends on the server remaining online. NIP-96 servers are centralized services that can go offline.

## Scenario 4: Deleting a File

**When:** An agent wants to delete a file they previously uploaded to a NIP-96 server.

**Why this matters:** File deletion removes the file from the server's storage. Not all servers support deletion. The deletion uses NIP-98 auth to verify the requester is the original uploader.

### Steps

1. **Check server support.** Not all NIP-96 servers support deletion. Verify by checking the server's capabilities or attempting the request.

2. **Construct the deletion URL.** The URL pattern is `<api_url>/<sha256-hash>.<ext>`, using the file's original hash.

3. **Construct the NIP-98 auth event.** Create a kind:27235 event with:
   - `["u", "<deletion-url>"]` -- the exact deletion URL
   - `["method", "DELETE"]` -- the HTTP method
   - Set `created_at` to the current unix timestamp
   - Sign the event with your Nostr private key (must match the key used for upload)

4. **Base64-encode the auth event.** Serialize the signed kind:27235 event to JSON, then base64-encode it.

5. **Send the HTTP DELETE request** to the deletion URL with header: `Authorization: Nostr <base64-encoded-event>`.

6. **Parse the response.** On success: `{"status": "success", "message": "File deleted"}`. On error: `{"status": "error", "message": "..."}`.

7. **Optionally delete the kind:1063 event on TOON.** If you published a kind:1063 metadata event referencing this file, consider publishing a kind:5 deletion request event (NIP-09) to remove the now-orphaned metadata. This costs per-byte on TOON via `publishEvent()`.

### Considerations

- Deletion only works for the original uploader. The NIP-98 auth pubkey must match the upload auth pubkey.
- Deleting the file from the server does not delete the kind:1063 metadata event from Nostr relays. The metadata event will still exist, pointing to a now-missing file. Publish a kind:5 deletion request to clean up the metadata.
- The NIP-98 auth event must have a recent `created_at` (within ~60 seconds).
- Server deletion is permanent. There is no undo.
- Not all servers support deletion. Some servers retain files permanently by design.
- If publishing a kind:5 deletion request on TOON, that event costs per-byte (~200-300 bytes, ~$0.002-$0.003). See `content-control` for kind:5 event construction.
