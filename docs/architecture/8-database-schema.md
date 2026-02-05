# 8. Database Schema

The relay uses SQLite for event persistence. Schema follows NIP-01 event structure.

```sql
-- Events table
CREATE TABLE events (
    id TEXT PRIMARY KEY,           -- Event ID (hash)
    pubkey TEXT NOT NULL,          -- Author public key
    kind INTEGER NOT NULL,         -- Event kind
    content TEXT NOT NULL,         -- Event content
    tags TEXT NOT NULL,            -- JSON-encoded tags array
    created_at INTEGER NOT NULL,   -- Unix timestamp
    sig TEXT NOT NULL,             -- Schnorr signature
    received_at INTEGER NOT NULL   -- When relay received event
);

-- Indexes for common queries
CREATE INDEX idx_events_pubkey ON events(pubkey);
CREATE INDEX idx_events_kind ON events(kind);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_events_pubkey_kind ON events(pubkey, kind);

-- For replaceable events (kinds 10000-19999)
-- Application logic handles replacement on insert
```

**Design Notes:**
- Tags stored as JSON for flexibility
- `received_at` tracks when relay received event (for debugging/auditing)
- Replaceable events handled in application layer (delete old, insert new)
- No foreign keys; events are self-contained

---
