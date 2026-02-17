# Kind Registry

Maps Nostr event kinds to their handler reference files. Routing priority: exact match first, then range match, then fallback.

## Registry Table

| Kind | Handler File | NIP | Category | Description |
|------|-------------|-----|----------|-------------|
| 0 | _unhandled_ | 01 | replaceable | User metadata (profile) |
| 1 | [kind-1-text-note.md](handlers/kind-1-text-note.md) | 01 | regular | Short text note |
| 3 | _unhandled_ | 02 | replaceable | Follow list / contacts |
| 6 | _unhandled_ | 18 | regular | Repost |
| 7 | _unhandled_ | 25 | regular | Reaction |
| 1059 | [kind-1059-gift-wrap.md](handlers/kind-1059-gift-wrap.md) | 59 | regular | Gift wrap (encrypted envelope) |
| 5000-5999 | [kind-5xxx-dvm-request.md](handlers/kind-5xxx-dvm-request.md) | 90 | regular | DVM job request |
| 6000-6999 | _unhandled_ | 90 | regular | DVM job result |
| 7000 | _unhandled_ | 90 | regular | DVM job feedback |
| 10032 | _unhandled_ | custom | replaceable | ILP peer info |
| 23194 | _unhandled_ | custom | ephemeral | SPSP request |
| 23195 | _unhandled_ | custom | ephemeral | SPSP response |

## Kind Classification (NIP-01 Ranges)

```
Regular:           kind < 10000 (except 0, 3)
Replaceable:       kind == 0 || kind == 3 || (10000 <= kind < 20000)
Ephemeral:         20000 <= kind < 30000
Param-Replaceable: 30000 <= kind < 40000
```

## Routing Algorithm

```
1. Extract `kind` from decoded event
2. EXACT match against registry table → load handler
3. If no exact match, RANGE match:
   - kind 5000-5999 → kind-5xxx-dvm-request.md
   - kind 6000-6999 → DVM result (unhandled)
4. If no handler found → use FALLBACK behavior:
   - Classify kind (regular/replaceable/ephemeral/param-replaceable)
   - Return { "action": "ignore", "reason": "No handler for kind {N}" }
   - OR { "action": "escalate", "reason": "Unknown kind {N}" } if kind appears important
```

## Adding New Handlers

1. Create `references/handlers/kind-{N}-{name}.md` using the handler template
2. Add row to the registry table above
3. Update action allowlist in `action-schema.md` if new action types are needed

## TOON Format Notes

Events arrive TOON-encoded. Key structural points:
- TOON declares field structure once, then streams values compactly
- For Nostr events, TOON savings are minimal (~0-6%) due to hex string dominance
- Fixed overhead per event: ~130-135 tokens (id, pubkey, sig are 47% of token cost)
- Typical kind:1 note: ~200-280 tokens in TOON
- Large events (kind:30023 long-form, 50KB+) may need truncation before processing
