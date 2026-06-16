---
name: file-storage
description: HTTP file storage integration on Nostr and TOON Protocol using NIP-96.
  Covers server discovery ("how do I find a file storage server?", "how do I upload
  a file on Nostr?", NIP-96, HTTP file storage, /.well-known/nostr/nip96.json, server
  capabilities, content_types, plans), file upload ("how do I upload a file?", multipart
  POST, NIP-98 HTTP auth, file upload, caption, alt text, no_transform, media hosting),
  file download ("how do I download a file from Nostr?", download URL, SHA-256 hash,
  file retrieval), file deletion ("how do I delete a hosted file?", DELETE request,
  NIP-98 auth, file removal), and upload economics ("how much does hosting media cost
  on TOON?", "how do I host media?", off-chain HTTP upload, kind:1063 metadata event,
  NIP-94 file metadata). Implements NIP-96 on TOON's ILP-gated network where upload
  is external HTTP but publishing the resulting kind:1063 metadata event costs per-byte.
---

# File Storage (TOON)

HTTP-based file upload, download, and deletion for agents on the TOON network. NIP-96 defines how Nostr clients discover file storage servers, upload files via multipart HTTP POST, download files by hash, and delete files via HTTP DELETE. Authentication uses NIP-98 HTTP Auth events. Servers return NIP-94 kind:1063 file metadata events describing uploaded files.

This skill covers the external HTTP file storage workflow. The upload itself is off-chain HTTP -- it does not go through the TOON relay or require ILP payment. However, publishing the resulting kind:1063 file metadata event on TOON costs per-byte (~$0.003-$0.008), connecting the uploaded file to the Nostr event graph.

## File Storage Model

NIP-96 file storage servers are independent HTTP services, not Nostr relays. A server advertises its capabilities via `/.well-known/nostr/nip96.json`. Clients discover the server, upload files via multipart POST to the server's `api_url`, and receive a NIP-94 kind:1063 event (or tags for one) in response. Files are downloaded via `<download_url>/<sha256-hash>.<ext>`. Servers may support deletion via HTTP DELETE with NIP-98 authentication.

The key distinction: file storage servers handle binary file hosting; Nostr relays handle event storage. NIP-96 bridges the two by producing kind:1063 metadata events that reference hosted files.

## Server Discovery

Servers publish their capabilities at `https://<server-domain>/.well-known/nostr/nip96.json`. The response includes:

- `api_url` -- the URL for file uploads (multipart POST endpoint)
- `download_url` -- base URL for file downloads (`<download_url>/<sha256>.<ext>`)
- `supported_nips` -- array of supported NIPs (e.g., [94, 96, 98])
- `tos_url` -- terms of service URL
- `content_types` -- array of accepted MIME types (e.g., `["image/jpeg", "image/png", "video/mp4"]`)
- `plans` -- pricing tiers (free/paid plans with storage limits, file size limits)

Always check the server's capabilities before uploading. Verify that your file's MIME type is in `content_types` and that your file size is within the plan's limits.

## File Upload

Upload files via multipart/form-data POST to the server's `api_url`. Authentication uses a NIP-98 HTTP Auth event (kind:27235) included as a Base64-encoded `Authorization: Nostr <base64-event>` header.

**Required fields:**
- `file` -- the binary file data (multipart form field)

**Optional fields:**
- `caption` -- description of the file
- `content_type` -- MIME type hint (server may override based on actual content)
- `no_transform` -- if `"true"`, server should not transform the file (no resizing, compression, format conversion)
- `alt` -- accessibility text for the file (recommended for images)

**Response:** JSON with `status` ("success" or "error"), `nip94_event` (object with tags for constructing a kind:1063 event), and optional `message`. For delayed processing, the server may return a URL to poll for completion.

## File Download

Download files using the URL pattern: `<download_url>/<sha256-hash>.<ext>`. The SHA-256 hash is the original file hash (before any server-side transforms). The extension indicates the file format. No authentication is required for downloads.

## File Deletion

Delete files via HTTP DELETE to `<api_url>/<sha256-hash>.<ext>`. Authentication uses a NIP-98 HTTP Auth event with the `method` set to `DELETE` and the `u` tag matching the deletion URL. Not all servers support deletion -- check server capabilities first.

## TOON Write Model

Uploading a file to a NIP-96 server is an external HTTP operation -- it does not go through `publishEvent()` or require ILP payment. The upload is between the client and the file storage server directly.

However, publishing the resulting kind:1063 file metadata event on a TOON relay requires ILP payment via `publishEvent()` from `@toon-protocol/client`. The kind:1063 event is typically ~300-800 bytes ($0.003-$0.008 at default `basePricePerByte`). This is the only TOON cost in the file storage workflow.

For the full fee formula and `publishEvent()` API, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Query kind:1063 file metadata events using `kinds: [1063]` filters. Filter by `#x` (hash), `#m` (MIME type), or `#url` tags to find specific files. TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse file metadata events. Reading is free on TOON.

For TOON format parsing details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

NIP-96 file storage is a convenience layer connecting binary files to the Nostr event graph. On TOON, the upload itself is free (external HTTP), but the metadata event costs per-byte. This means the economic cost of sharing files on TOON is minimal -- you pay only for the small metadata event, not the file itself.

Upload responsibly. Respect the file storage server's terms of service (`tos_url`). Do not upload illegal content, copyrighted material without rights, or excessively large files beyond the server's stated limits. Server operators bear the cost and legal risk of hosting.

Include `alt` text when uploading images. The `alt` field in the upload request costs nothing (it is part of the HTTP request, not the TOON event), but produces better accessibility metadata in the resulting kind:1063 event.

Use `no_transform: "true"` when file integrity matters -- cryptographic hashes, archival content, or files where lossy compression would degrade quality. Otherwise, let the server optimize for bandwidth.

File storage servers are centralized services. They can go offline, delete files, or change terms. For permanent storage, consider Arweave (via the Arweave DVM, kind:5094) instead of or in addition to NIP-96 servers. NIP-96 is convenient for ephemeral and social media; Arweave is better for archival content.

**Anti-patterns to avoid:**
- Uploading without checking `content_types` -- the server may reject unsupported MIME types
- Skipping NIP-98 authentication -- unauthenticated uploads will be rejected
- Publishing kind:1063 metadata via raw WebSocket -- use `publishEvent()` on TOON
- Relying on a single NIP-96 server for critical content -- servers are centralized and can disappear

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-96 server discovery, upload/download/delete protocol** -- Read [nip-spec.md](references/nip-spec.md) for the full NIP-96 specification.
- **Understanding TOON-specific upload economics and metadata publishing** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated file storage extensions.
- **Step-by-step server discovery, upload, download, and deletion workflows** -- Read [scenarios.md](references/scenarios.md) for complete operational workflows.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **NIP-94 kind:1063 file metadata event structure** -- See `media-and-files` for kind:1063 tag formats, `imeta` tags, and external content IDs.
- **NIP-98 HTTP Auth event construction** -- See [nip-spec.md](references/nip-spec.md) for the authentication event format used in upload and delete requests.
- **Permanent file storage via Arweave** -- See `git-collaboration` for kind:5094 Arweave DVM blob storage as an alternative to ephemeral NIP-96 servers.
- **Discovering relay pricing for metadata event fees** -- See `relay-discovery` for NIP-11 relay info and TOON `/health` endpoint.
- **Social judgment on file sharing norms** -- See `nostr-social-intelligence` for base social intelligence.
