---
name: git-workflows
description: Step-by-step end-to-end git workflow examples on TOON Protocol. Covers
  complete workflows for creating a repository ("how do I create a repo on TOON end-to-end?",
  "complete git workflow", kind:30617 + kind:30618 + kind:5094), submitting a patch
  ("step-by-step git on TOON", "git workflow example", kind:1617, git format-patch,
  patch submission workflow), merging a patch ("how do I merge a patch end-to-end?",
  kind:1631 status + kind:30618 state update), and fetching a file from Arweave
  ("how do I fetch a git file from Arweave?", "resolve SHA via GraphQL", Arweave
  gateway download). Each workflow includes all publishEvent() calls with TOON fee
  calculations. Combines NIP-34 events, git object binary format, and Arweave
  upload/resolution into complete recipes.
---

# Git Workflow Examples (TOON)

End-to-end workflow recipes for git operations on the TOON network. Each workflow is a complete sequence of steps combining NIP-34 collaboration events (kind:30617, kind:30618, kind:1617, kind:1631), git object binary construction (blob, tree, commit), and Arweave permanent storage (kind:5094 DVM uploads). On TOON, every step that publishes an event costs per-byte via ILP payment, so each workflow includes fee calculations and cost optimization strategies.

This is a WORKFLOW skill -- it composes operations from three underlying skills into complete recipes. For individual operation details, see the cross-referenced skills below.

## What This Skill Covers

Four complete end-to-end workflows:

1. **Create a repository** -- Announce the repo (kind:30617), publish initial state (kind:30618), construct git objects (blob, tree, commit), upload objects to Arweave (kind:5094), and verify the complete repository is accessible.
2. **Submit a patch** -- Generate `git format-patch` output, construct the kind:1617 event, calculate cost, and publish to the TOON relay.
3. **Merge a patch** -- Publish a kind:1631 status event with `applied-as-commits` tags, update kind:30618 repository state with new branch heads.
4. **Fetch a file from Arweave** -- Resolve a git SHA via Arweave GraphQL, download the object from the gateway, and decode the binary content.

## TOON Write Model

All event publishing uses `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event. Fee formula: `basePricePerByte * serializedEventBytes` (default 10n = $0.00001/byte).

For the full fee formula and publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Reading is free on TOON. Use NIP-01 filters to subscribe to git events. TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse responses.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

### Workflow References

- **Complete NIP-34 + git objects + Arweave integration overview** -- Read [nip-spec.md](references/nip-spec.md) for how the three systems compose into a decentralized git hosting stack.
- **Step-by-step workflows with all publishEvent() calls** -- Read [scenarios.md](references/scenarios.md) for the 4 complete end-to-end workflows: create-repo, submit-patch, merge-patch, fetch-file.
- **Total workflow costs and optimization strategies** -- Read [toon-extensions.md](references/toon-extensions.md) for fee breakdowns across multi-step workflows and cost reduction techniques.

### Cross-Skill References

- **NIP-34 event kinds (kind:30617, kind:1617, etc.)** -- See `git-collaboration` for individual event kind tag formats, validation rules, and per-kind references.
- **Git object binary format (blob, tree, commit)** -- See `git-objects` for binary construction, SHA-1 computation, and Nostr pubkey to git author mapping.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Arweave content references and file metadata** -- See `media-and-files` for NIP-73 `arweave:tx:` external content IDs.
- **Discovering relay pricing for fee calculation** -- See `relay-discovery` for NIP-11 relay info and TOON `/health` endpoint to determine `basePricePerByte`.
- **Social judgment on code review and contribution norms** -- See `nostr-social-intelligence` for collaboration engagement guidance.

## Social Context

Git workflows on TOON involve real per-byte costs for every operation -- announcing a repo, submitting a patch, creating a PR, opening an issue. These costs create natural incentives for focused, high-quality contributions. Prefer small, reviewable patches over massive changesets. Keep issue descriptions clear and detailed to justify the cost. When deciding between a patch and a PR, consider that patches carry diff content in the event body (expensive for large changes), while PRs reference external clone URLs (cheaper event, but require accessible git hosting).
