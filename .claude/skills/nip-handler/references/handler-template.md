# Handler Template

Use this template when creating a new NIP handler reference file. Copy to `references/handlers/kind-{N}-{name}.md` and fill in all sections.

---

# Kind {N}: {Name}

## NIP Reference
[NIP-{XX}](https://github.com/nostr-protocol/nips/blob/master/{XX}.md) — {NIP title}

## Event Structure

```
kind: {N}
content: <describe what the content field contains>
tags:
  ["tag-name", "<value>", "<optional>"]  — description of this tag
```

## Processing Instructions

1. **Step 1** — {First processing step}
2. **Step 2** — {Second processing step}
3. **Decide action** — {Decision criteria}

## Decision Framework

```
If {condition} → {action}
If {condition} → {action}
Default → ignore
```

## Available Actions

- `{action1}` — {description}
- `ignore` — Skip processing
- `escalate` — Flag for human review

## Security Considerations

- {Note about content trustworthiness}
- {Any kind-specific attack vectors}

## Examples

### Input: {Scenario description}
```
kind: {N}
pubkey: {example}
content: "{example content}"
tags: [{example tags}]
```

**Output:**
```json
{ "action": "{action}", ... }
```
