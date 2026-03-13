# Content Publishing Workflow

## Installed Tools

### CLI Tools

| Tool | Command | Purpose | Status |
|------|---------|---------|--------|
| **nak** v0.18.7 | `nak` | Nostr NIP-23 long-form publishing | Installed (brew) |
| **twitter-cli** v1.1.0 | `npx @neonwatty/twitter-cli` | X thread posting (OAuth 2.0) | Installed (npm global) — needs `twitter auth` |

### MCP Servers (Claude Code)

| Server | Package | Purpose | Status |
|--------|---------|---------|--------|
| **nostr-mcp** | `nostr-mcp-server` | Nostr publishing from Claude | Configured |
| **x-mcp** | `@realaman90/x-mcp` | X/Twitter posting from Claude (OAuth 1.0a) | Configured |
| **blogcaster-mcp** | `blogcaster-mcp` | Dev.to publishing from Claude | Configured |

MCP servers load credentials from `.env.publish` via `scripts/run-mcp.sh` wrapper.
Restart Claude Code after credential changes (`/mcp` to verify servers).

---

## Credential Status

| Platform | Credential | Status |
|----------|-----------|--------|
| **Nostr** | Hex private key | Set (generated) |
| **X/Twitter** | OAuth 1.0a (API key/secret + tokens) | Set (for x-mcp) |
| **X/Twitter** | OAuth 2.0 (Client ID/Secret) | Needs setup (for twitter-cli) |
| **Dev.to** | API key | Set and verified (HTTP 200) |
| **Hashnode** | — | Skipped (using Dev.to as canonical) |

### Nostr Identity

- **npub:** `npub1u99lafqlq2eg2wj8tm5z8tx2y0ehl203dsex03gradg8ay9klm8q5070p2`
- **hex pubkey:** `e14bfea41f02b2853a475ee823acca23f37fa9f16c3267c503eb507e90b6fece`
- Key stored in `.env.publish` (gitignored)

### X/Twitter Auth Notes

Two auth paths available:
- **x-mcp MCP server** uses OAuth 1.0a (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET) — already configured
- **twitter-cli** uses OAuth 2.0 — requires one-time setup:
  1. Go to developer.x.com → your app → "User authentication settings"
  2. Enable OAuth 2.0, set callback URL to `http://localhost:3000/callback`
  3. Copy Client ID and Client Secret
  4. Add to `.env.publish` as `X_CLIENT_ID` and `X_CLIENT_SECRET`
  5. Run: `source .env.publish && npx @neonwatty/twitter-cli auth`

---

## Publish Order (Per Article)

Dev.to is the canonical platform (primary, SEO-indexed).

```
1. DEV.TO (canonical)        → Get URL
   Tool: blogcaster-mcp, publish.sh, or curl
   Set: published=true, tags, no canonical_url (this IS the canonical)

2. NOSTR via Habla.news      → Publish NIP-23
   Tool: nak -k 30023 or publish.sh nostr
   Include: Dev.to link in footer

3. X THREAD                  → Link to Dev.to in final tweet
   Tool: x-mcp (OAuth 1.0a) or twitter-cli (OAuth 2.0)

4. STACKER NEWS (manual)     → Original conversational version
   Post at: https://stacker.news in ~nostr or ~tech territory

5. HACKERNOON (manual)       → Polished submission with editorial review
   Submit at: https://hackernoon.com
```

**Note:** If Hashnode becomes available later, insert it as step 1 (canonical)
and set Dev.to's `canonical_url` to point to Hashnode.

---

## Quick Commands

### Source credentials
```bash
set -a && source .env.publish && set +a
```

### Publish to Dev.to (canonical)
```bash
./scripts/publish.sh devto path/to/article.md "Article Title"
```

### Publish to Nostr (NIP-23)
```bash
./scripts/publish.sh nostr path/to/article.md "slug" "Article Title" "Summary"
```

### Publish to Dev.to (curl — manual)
```bash
curl -X POST https://dev.to/api/articles \
  -H "api-key: $DEVTO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "article": {
      "title": "Title",
      "body_markdown": "...",
      "published": true,
      "tags": ["nostr","relay","web3","ai"]
    }
  }'
```

### Post to Nostr (nak — manual)
```bash
nak event --sec $NOSTR_PRIVKEY -k 30023 \
  -c "$(cat article-file.md)" \
  --tag d=article-slug \
  --tag title="Article Title" \
  --tag summary="Brief summary" \
  --tag published_at=$(date +%s) \
  --tag t=nostr --tag t=relay \
  $NOSTR_RELAYS
```

---

## File Locations

- Credentials: `/.env.publish` (gitignored)
- MCP wrapper: `/scripts/run-mcp.sh`
- Publish helper: `/scripts/publish.sh`
- Article drafts: `/_bmad-output/planning-artifacts/content/article-N/`
