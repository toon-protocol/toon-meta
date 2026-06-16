---
name: nip-to-toon-skill
description: Convert any Nostr NIP specification into a TOON-aware Claude Agent Skill following the 13-step pipeline. Use when asked to create a TOON skill from a NIP ("create a TOON skill for NIP-25", "convert NIP-23 to a TOON skill", "build a skill from this NIP spec"), run the NIP-to-TOON pipeline ("run the NIP-to-TOON pipeline", "execute the skill pipeline for this NIP"), produce a TOON-compatible Nostr skill ("I need a skill for reactions on TOON", "build a long-form content skill for TOON"), or ask how to make a TOON-compliant skill from any NIP specification ("how do I make a TOON-compatible skill from a NIP?", "what's the process for converting a NIP to a skill?"). Produces skill-creator-compatible output with TOON context injection, social context generation, eval creation, and compliance validation.
---

# NIP-to-TOON Skill Pipeline

Convert any Nostr NIP into a TOON-aware Claude Agent Skill. This pipeline produces a complete skill directory following skill-creator anatomy: SKILL.md with frontmatter, references, and evals. Every generated skill is TOON-first (ILP-gated writes, TOON-format reads) and socially aware.

## NIP Classification

Before starting the pipeline, classify the target NIP. Classification determines which TOON context sections and compliance assertions are injected.

| Classification | Criteria | Injected Context |
|---------------|----------|-----------------|
| **Read-only** | NIP defines filters/queries but no new publishable event kinds (e.g., NIP-50 Search) | TOON read model, `toon-format-check` |
| **Write-capable** | NIP defines event kinds the agent creates/publishes (e.g., NIP-25 Reactions) | TOON write model, fee calculation, `toon-write-check`, `toon-fee-check` |
| **Both** | NIP defines both queryable and publishable event kinds (e.g., NIP-23 Long-form) | All write + read checks |

Universal checks applied regardless: `social-context-check`, `trigger-coverage`.

## The 13-Step Pipeline

### Step 1: NIP Analysis

Read the NIP specification. Extract:
- Event kinds defined (which ones does the agent create vs query?)
- Tag structures (required and optional tags)
- Content format (plain text, JSON, markdown, binary references)
- Filter patterns (how to query these events)
- Classify as read-only / write-capable / both

Flag any TOON-specific considerations: does this NIP overlap with an excluded NIP (NIP-13, NIP-42, NIP-47, NIP-57, NIP-98)? If so, document what ILP replaces.

### Step 2: TOON Context Injection

Read [toon-protocol-context.md](references/toon-protocol-context.md) for the canonical protocol details.

For **write-capable** NIPs: inject TOON write model section explaining `publishEvent()` usage for the specific event kind, fee calculation for typical payload sizes of this NIP's events, and error handling (F04 insufficient payment).

For **read-capable** NIPs: inject TOON read model section documenting that responses come in TOON-format strings, not JSON objects.

For **all** NIPs: inject relay discovery context (enriched NIP-11 `/health` endpoint, kind:10032 pricing events).

### Step 3: Social Context Layer

Read [social-context-template.md](references/social-context-template.md).

Generate a `## Social Context` section specific to this NIP. The section must answer:
- When is this interaction appropriate?
- What does paying to perform this action mean socially?
- What are the context-specific norms?
- What are the anti-patterns for this interaction type?

Add a pointer to `nostr-social-intelligence` for deeper social judgment.

**Test:** Could this Social Context section apply to any NIP? If yes, it is too generic. Rewrite.

### Step 4: Skill Authoring

Read [skill-structure-template.md](references/skill-structure-template.md).

Generate the skill's SKILL.md:
- YAML frontmatter with ONLY `name` and `description` (no other fields)
- Description: 80-120 words with social-situation triggers, not just protocol-technical triggers
- Body: under 500 lines / ~5k tokens, imperative form
- "When to read each reference" section
- `## Social Context` section (from Step 3)
- Level 3 references: `references/nip-spec.md`, `references/toon-extensions.md`, `references/scenarios.md`

### Step 5: Eval Generation

Read [eval-generation-guide.md](references/eval-generation-guide.md).

Generate `evals/evals.json`:
- 8-10 `should_trigger: true` queries (include social-situation triggers)
- 8-10 `should_trigger: false` queries (must not overlap with `nostr-protocol-core` or `nostr-social-intelligence`)
- 4-6 output evals with `id`, `prompt`, `rubric` (correct/acceptable/incorrect), and `assertions`

### Step 6: TOON Assertions

Read [toon-compliance-assertions.md](references/toon-compliance-assertions.md).

Auto-inject TOON compliance assertions into the output evals based on NIP classification:
- **Write-capable:** `toon-write-check`, `toon-fee-check`
- **Read-capable:** `toon-format-check`
- **All:** `social-context-check`, `trigger-coverage`

### Step 7: Description Optimization

Read [description-optimization-guide.md](references/description-optimization-guide.md).

Run `scripts.run_loop` with 20 trigger queries spanning protocol-technical and social-situation triggers. Max 5 iterations. Select `best_description` based on trigger accuracy.

### Step 8: With/Without Testing

Spawn parallel subagents:
- **With skill:** Agent with the generated skill loaded, runs against output eval prompts
- **Without skill:** Baseline Claude without the skill, same prompts

Save results to `with_skill/outputs/` and `without_skill/outputs/`.

### Step 9: Grading

Produce `grading.json` from with/without comparison:
- Each assertion: `{ "text": "...", "passed": true/false, "evidence": "..." }`
- Summary: total assertions, passed count, failed count

### Step 10: Benchmarking

Produce `benchmark.json`:
- Pass rate (percentage of assertions passed)
- Timing: mean +/- standard deviation per eval
- Token usage: mean tokens per eval response

### Step 11: TOON Compliance Validation

Run TOON-specific assertion checks from Step 6. Any failure = red = skill is not TOON-ready. Fix and re-run from the failing step.

### Step 12: Eval Viewer

Generate HTML review via `eval-viewer/generate_review.py`. The review displays: trigger eval results, output eval results with assertion details, TOON compliance status, benchmark summary.

### Step 13: Iterate

Collect `feedback.json` from the review. Read feedback, identify which steps need refinement, and re-run the pipeline from the appropriate step. Save iteration outputs to `iteration-2+/` directories.

## When to Read Each Reference

- **Need canonical TOON protocol details for injection** -- Read [toon-protocol-context.md](references/toon-protocol-context.md)
- **Generating a skill's SKILL.md structure** -- Read [skill-structure-template.md](references/skill-structure-template.md)
- **Writing the Social Context section** -- Read [social-context-template.md](references/social-context-template.md)
- **Creating evals for the generated skill** -- Read [eval-generation-guide.md](references/eval-generation-guide.md)
- **Injecting TOON compliance assertions** -- Read [toon-compliance-assertions.md](references/toon-compliance-assertions.md)
- **Optimizing the skill description** -- Read [description-optimization-guide.md](references/description-optimization-guide.md)

## Social Context

This pipeline creates skills that other agents use for social interactions on TOON. The pipeline itself is a meta-tool -- it shapes how agents understand social norms across dozens of interaction types. A defect in the pipeline's social context template propagates to every downstream skill. Treat social context generation with the same rigor as protocol correctness: generic social context is a defect, not a placeholder. Every generated `## Social Context` section must be specific to the NIP's interaction type, reflecting the real social dynamics of that interaction on a paid relay network.

## Integration with Other Skills

- **`nostr-protocol-core`** (Story 9.1): Provides the write/read model details. Generated skills reference it for protocol mechanics.
- **`nostr-social-intelligence`** (Story 9.0): Provides universal social judgment. Generated skills point to it for deeper social guidance.
- **`skill-creator`**: Defines the skill anatomy this pipeline follows. Generated skills conform to skill-creator format.
