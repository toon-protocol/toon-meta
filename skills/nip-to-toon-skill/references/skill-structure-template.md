# Skill Structure Template

> **Why this template exists:** Every pipeline-generated skill must follow skill-creator anatomy exactly. Deviations cause skills to fail triggering, bloat the context window, or miss TOON compliance. This template ensures structural consistency across all 30+ downstream skills while allowing NIP-specific content to vary.

## Generated Skill Directory Layout

```
nostr-{nip-name}/
├── SKILL.md
├── references/
│   ├── nip-spec.md          # NIP specification summary (extracted, not copied verbatim)
│   ├── toon-extensions.md   # TOON-specific behavior for this NIP
│   └── scenarios.md         # Common usage scenarios with TOON context
└── evals/
    └── evals.json           # Skill-creator compatible eval definitions
```

## SKILL.md Skeleton

```markdown
---
name: nostr-{nip-name}
description: {80-120 words. Include BOTH protocol-technical triggers AND social-situation triggers. Example: "NIP-25 reactions on TOON — liking, disliking, and emoji reactions to events. Use when reacting to content ('react to this post', 'like this note', 'add a thumbs up'), choosing reaction types ('should I use a + or custom emoji?'), understanding reaction costs ('how much does a reaction cost on TOON?'), or navigating reaction etiquette ('is it appropriate to react here?', 'when should I react vs comment?'). Implements kind:7 events with ILP-gated publishing on TOON's paid relay network."}
---

# {NIP Title} on TOON

{1-2 sentence overview: what this NIP does and how TOON changes it.}

## Protocol Mechanics

{Core NIP mechanics relevant to an agent: event kinds, tag structures, content format. Keep concise — details go in references/nip-spec.md.}

## TOON Write Model

{ONLY for write-capable or both classifications. How to publish this NIP's events via publishEvent(). Include typical payload size and approximate cost. Reference nostr-protocol-core for full write model details.}

## TOON Read Model

{ONLY for read-capable or both classifications. How to subscribe to and parse this NIP's events. Note TOON format string responses. Reference nostr-protocol-core for full read model details.}

## When to Read Each Reference

- **Need the full NIP specification details** — Read [nip-spec.md](references/nip-spec.md)
- **Need TOON-specific behavior and differences** — Read [toon-extensions.md](references/toon-extensions.md)
- **Need usage examples and scenarios** — Read [scenarios.md](references/scenarios.md)

## Social Context

{NIP-specific social context. MUST answer: (1) When is this interaction appropriate? (2) What does paying for this action mean socially? (3) Context-specific norms. (4) Anti-patterns. Reference nostr-social-intelligence for deeper social judgment.}

## Integration with Other Skills

- **nostr-protocol-core**: Provides the underlying write/read model. Reference for publishEvent() API, fee calculation, TOON format parsing.
- **nostr-social-intelligence**: Provides social judgment guidance. Reference for when/how to engage decisions.
```

## Frontmatter Rules

**Why only `name` and `description`:** Claude reads ONLY frontmatter to decide if a skill triggers. Adding fields like `version`, `author`, or `tags` wastes tokens in the always-loaded metadata and provides no triggering value. The skill-creator explicitly forbids extra frontmatter fields.

- `name`: Use `nostr-{nip-name}` format (e.g., `nostr-reactions`, `nostr-long-form-content`, `nostr-search`)
- `description`: 80-120 words. This is the ONLY trigger mechanism. Include:
  - What the skill does (protocol-technical: "NIP-25 reactions", "kind:7 events")
  - When to use it (social-situation: "should I react here?", "is a like enough?")
  - Specific trigger phrases in parentheses
  - Mention of TOON/ILP context

## Body Guidelines

**Why under 500 lines:** The body loads into context after triggering. Larger bodies consume context that should be reserved for the actual task. Move details to references.

- Use imperative/infinitive form ("Publish the event", not "You should publish the event")
- Keep under 500 lines / ~5k tokens
- Include "When to read each reference" section (progressive disclosure)
- Include `## Social Context` section (TOON-specific, not generic)
- Do NOT put "when to use" guidance in the body — that belongs in `description`
- Do NOT duplicate reference content — point to it

## Reference File Guidelines

**Why references exist:** Progressive disclosure. References load only when Claude determines they are needed, keeping the context window lean for common queries while providing depth for complex ones.

- `nip-spec.md`: Summarize the NIP specification. Extract event kinds, tag structures, content format, and filter patterns. Do not copy the NIP verbatim — summarize for agent consumption.
- `toon-extensions.md`: Document how TOON changes this NIP's behavior. Fee calculation for typical payload sizes. Any excluded NIP overlaps. Transport differences.
- `scenarios.md`: 3-5 concrete usage scenarios showing the skill in action on TOON. Include fee estimates, social context considerations, and error handling.
- Every reference MUST explain WHY (reasoning), not just list rules (D9-008 compliance).
