# NIP-96 Specification: HTTP File Storage Integration

> **Why this reference exists:** NIP-96 defines how Nostr clients discover file storage servers, upload files via HTTP, download files by hash, and delete hosted files. Agents need to understand the server discovery protocol, the multipart upload format, the NIP-98 authentication mechanism, and the response format that produces NIP-94 kind:1063 file metadata. This reference covers the protocol mechanics; TOON-specific extensions are in toon-extensions.md.

## Protocol Overview

NIP-96 is an HTTP-based file storage protocol for Nostr. It operates outside the Nostr relay WebSocket layer -- files are uploaded to and downloaded from HTTP servers, not relays. The protocol bridges HTTP file hosting and Nostr event metadata:

1. **Client discovers** a file storage server via `/.well-known/nostr/nip96.json`
2. **Client uploads** a file via multipart POST to the server's `api_url`
3. **Server returns** NIP-94 kind:1063 metadata tags describing the uploaded file
4. **Client publishes** the kind:1063 event to Nostr relays (on TOON, via `publishEvent()`)
5. **Other clients download** the file via `<download_url>/<sha256-hash>.<ext>`
6. **Client may delete** the file via HTTP DELETE with NIP-98 auth

## Server Discovery: `/.well-known/nostr/nip96.json`

File storage servers advertise capabilities at a well-known URL. Clients fetch this JSON document to discover the server's API endpoint, download URL pattern, supported content types, and pricing plans.

**URL:** `https://<server-domain>/.well-known/nostr/nip96.json`

**Response format:**

```json
{
  "api_url": "https://files.example.com/upload",
  "download_url": "https://files.example.com",
  "supported_nips": [94, 96, 98],
  "tos_url": "https://files.example.com/tos",
  "content_types": ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "audio/mpeg", "audio/ogg"],
  "plans": {
    "free": {
      "name": "Free",
      "is_nip98_required": true,
      "url": "",
      "max_byte_size": 10485760,
      "file_expiration": [0, 0],
      "media_transformations": {
        "image": ["resizing", "format_conversion"]
      }
    },
    "professional": {
      "name": "Professional",
      "is_nip98_required": true,
      "url": "https://files.example.com/plans/pro",
      "max_byte_size": 104857600,
      "file_expiration": [0, 0],
      "media_transformations": {
        "image": ["resizing", "format_conversion", "compression"],
        "video": ["resizing", "format_conversion", "compression"]
      }
    }
  }
}
```

**Field definitions:**

- `api_url` (required): The URL endpoint for file uploads. Clients POST multipart/form-data to this URL.
- `download_url` (required): Base URL for file downloads. Files are accessed at `<download_url>/<sha256-hash>.<ext>`.
- `supported_nips` (optional): Array of NIP numbers this server supports (e.g., `[94, 96, 98]`).
- `tos_url` (optional): URL to the server's terms of service. Clients should present this to users.
- `content_types` (optional): Array of accepted MIME types. If absent, the server accepts any content type.
- `plans` (optional): Object mapping plan IDs to plan details. Each plan specifies limits and capabilities.

**Plan fields:**

- `name`: Human-readable plan name
- `is_nip98_required`: Whether NIP-98 auth is required (boolean)
- `url`: URL for plan signup/upgrade (empty string for default plan)
- `max_byte_size`: Maximum file size in bytes (0 = unlimited)
- `file_expiration`: Array `[min_seconds, max_seconds]` for file retention (0 = no expiration)
- `media_transformations`: Object mapping media types to supported transformations

## NIP-98 HTTP Auth Events (kind:27235)

NIP-96 uses NIP-98 for authentication. The client constructs a kind:27235 event, signs it, base64-encodes it, and includes it in the HTTP `Authorization` header.

**kind:27235 event structure:**

```json
{
  "kind": 27235,
  "created_at": <unix-timestamp>,
  "tags": [
    ["u", "<upload-or-delete-url>"],
    ["method", "<HTTP-method>"]
  ],
  "content": "",
  "pubkey": "<signer-pubkey>",
  "id": "<event-id>",
  "sig": "<signature>"
}
```

**Tag definitions:**

- `u` tag: The exact URL being accessed (upload URL or delete URL). Must match the request URL exactly.
- `method` tag: The HTTP method being used (`POST` for upload, `DELETE` for deletion).

**Optional tags for uploads:**

- `["payload", "<sha256-of-file>"]` -- SHA-256 hash of the file being uploaded. Proves the auth event is bound to this specific file.

**HTTP header format:**

```
Authorization: Nostr <base64-encoded-kind-27235-event>
```

**Validation rules:**

- The `created_at` timestamp must be within a reasonable window (e.g., 60 seconds)
- The `u` tag must exactly match the request URL
- The `method` tag must match the HTTP method
- The event signature must be valid
- The event kind must be 27235

## File Upload: Multipart POST

Upload files via HTTP POST with `multipart/form-data` encoding to the server's `api_url`.

**HTTP request:**

```
POST <api_url>
Content-Type: multipart/form-data; boundary=...
Authorization: Nostr <base64-encoded-kind-27235-event>

--boundary
Content-Disposition: form-data; name="file"; filename="photo.jpg"
Content-Type: image/jpeg

<binary file data>
--boundary
Content-Disposition: form-data; name="caption"

A beautiful sunset over the mountains
--boundary
Content-Disposition: form-data; name="alt"

Photograph of an orange and purple sunset behind a mountain range
--boundary
Content-Disposition: form-data; name="content_type"

image/jpeg
--boundary
Content-Disposition: form-data; name="no_transform"

true
--boundary--
```

**Form fields:**

- `file` (required): The binary file data. Must be a valid file matching one of the server's accepted `content_types`.
- `caption` (optional): Human-readable description or caption for the file. Becomes the `content` field in the kind:1063 event.
- `content_type` (optional): MIME type hint. The server may override based on actual file content analysis.
- `no_transform` (optional): Set to `"true"` to request the server not transform the file (no resizing, compression, format conversion). Useful for files where exact binary content matters.
- `alt` (optional): Accessibility text describing the file content. Included as an `alt` tag in the kind:1063 event.

## Upload Response

The server responds with JSON indicating success or failure.

**Success response:**

```json
{
  "status": "success",
  "nip94_event": {
    "tags": [
      ["url", "https://files.example.com/abcdef1234567890.jpg"],
      ["m", "image/jpeg"],
      ["x", "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"],
      ["ox", "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321"],
      ["size", "1234567"],
      ["dim", "1920x1080"],
      ["blurhash", "LGF5]+Yk^6#M@-5c"],
      ["thumb", "https://files.example.com/thumb/abcdef1234567890.jpg"],
      ["alt", "Photograph of an orange and purple sunset behind a mountain range"]
    ],
    "content": "A beautiful sunset over the mountains"
  },
  "message": "Upload successful"
}
```

**Error response:**

```json
{
  "status": "error",
  "message": "File type not supported"
}
```

**Delayed processing response:**

For large files or files requiring processing (video transcoding, etc.), the server may return a processing URL:

```json
{
  "status": "processing",
  "percentage": 0,
  "message": "Processing video...",
  "id": "<processing-id>"
}
```

The client can poll the processing URL for status updates until the final success response is returned.

**Response field definitions:**

- `status`: `"success"`, `"error"`, or `"processing"`
- `nip94_event`: Object containing `tags` and `content` for constructing a kind:1063 event. Present only on success.
- `message`: Human-readable status message
- `percentage`: Processing progress (0-100), present only during processing
- `id`: Processing job identifier for polling

**NIP-94 event tags returned by server:**

- `url` -- the URL where the file can be downloaded
- `m` -- MIME type of the stored file
- `x` -- SHA-256 hex hash of the stored file (after any transforms)
- `ox` -- SHA-256 hex hash of the original uploaded file (before transforms)
- `size` -- file size in bytes
- `dim` -- dimensions as `WxH` (for images/video)
- `blurhash` -- compact image placeholder hash
- `thumb` -- thumbnail URL
- `alt` -- accessibility text (echoed from upload request)

The client constructs a kind:1063 event using these tags, signs it, and publishes it to Nostr relays. The `content` field of the kind:1063 event is the `caption` from the upload request (or the `content` field from the response).

## File Download

Files are downloaded via simple HTTP GET requests. No authentication is required.

**URL pattern:** `<download_url>/<sha256-hash>.<ext>`

- `download_url` is from the server's `/.well-known/nostr/nip96.json`
- `sha256-hash` is the original file hash (`ox` tag value, or `x` if no transforms occurred)
- `ext` is the file extension matching the MIME type

**Example:** `https://files.example.com/abcdef1234567890.jpg`

The server returns the file with appropriate `Content-Type` and caching headers.

## File Deletion

Delete files via HTTP DELETE. Not all servers support deletion -- check server capabilities.

**HTTP request:**

```
DELETE <api_url>/<sha256-hash>.<ext>
Authorization: Nostr <base64-encoded-kind-27235-event>
```

The NIP-98 auth event for deletion must have:
- `method` tag set to `DELETE`
- `u` tag matching the exact deletion URL

**Success response:**

```json
{
  "status": "success",
  "message": "File deleted"
}
```

**Error response:**

```json
{
  "status": "error",
  "message": "File not found or not authorized"
}
```

**Authorization:** Only the original uploader (matching pubkey from the upload auth event) can delete a file. Deletion requests from other pubkeys are rejected.

## Relationship to Other NIPs

- **NIP-94 (kind:1063):** NIP-96 servers return tags for constructing kind:1063 file metadata events. NIP-94 defines the event structure; NIP-96 defines how to populate it via upload.
- **NIP-98 (kind:27235):** NIP-96 uses NIP-98 HTTP Auth events for upload and delete authentication.
- **NIP-92 (`imeta` tags):** After uploading via NIP-96 and obtaining the file URL, clients may reference the file in other events using `imeta` tags (NIP-92).

## Security Considerations

- **NIP-98 timestamp window:** Auth events must have a recent `created_at`. Servers reject stale auth events (typically >60 seconds old).
- **URL binding:** The `u` tag in the auth event must exactly match the request URL. This prevents auth event replay against different endpoints.
- **Method binding:** The `method` tag must match the HTTP method. An upload auth event cannot be reused for deletion.
- **File hash binding:** The optional `payload` tag binds the auth event to a specific file hash, preventing auth reuse for different files.
- **Content type validation:** Servers should validate actual file content, not just the `content_type` field, to prevent MIME type mismatches.
