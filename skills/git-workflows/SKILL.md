---
name: git-workflows
description: Step-by-step end-to-end git workflow examples on TOON Protocol. Covers
  complete workflows for creating a repository ("how do I create a repo on TOON end-to-end?",
  "complete git workflow", kind:30617 + kind:30618 + kind:5094), submitting a patch
  ("step-by-step git on TOON", "git workflow example", kind:1617, git format-patch,
  patch submission workflow), merging a patch ("how do I merge a patch end-to-end?",
  kind:1631 status + kind:30618 state update), and fetching a file from Arweave
  ("how do I fetch a git file from Arweave?", "resolve SHA via GraphQL", Arweave
  gateway download). Each workflow includes every client.send() call and what the
  route charges for it. Combines NIP-34 events, git object binary format, and Arweave
  upload/resolution into complete recipes.
---

# Git Workflow Examples (TOON)

End-to-end workflow recipes for git operations on the TOON network. Each workflow is a complete sequence of steps combining NIP-34 collaboration events (kind:30617, kind:30618, kind:1617, kind:1631), git object binary construction (blob, tree, commit), and Arweave permanent storage (kind:5094 DVM uploads). On TOON, every step that publishes something is a paid write over ILP, so each workflow says what its route charges and where the money actually goes.

This is a WORKFLOW skill -- it composes operations from three underlying skills into complete recipes. For individual operation details, see the cross-referenced skills below.

## What This Skill Covers

Four complete end-to-end workflows:

1. **Create a repository** -- Announce the repo (kind:30617), publish initial state (kind:30618), construct git objects (blob, tree, commit), upload objects to Arweave (kind:5094), and verify the complete repository is accessible.
2. **Submit a patch** -- Generate `git format-patch` output, construct the kind:1617 event, and send it to the TOON relay.
3. **Merge a patch** -- Publish a kind:1631 status event with `applied-as-commits` tags, update kind:30618 repository state with new branch heads.
4. **Fetch a file from Arweave** -- Resolve a git SHA via Arweave GraphQL, download the object from the gateway, and decode the binary content.

## TOON Write Model

All publishing uses `await client.send({ body: signedEvent })` from `@toon-protocol/client`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step. TOON format is the encoding of that sealed write payload, the bytes the connector carries inside the ILP packet -- never what the relay returns on a read, which is plain NIP-01 JSON. Raw WebSocket writes are rejected: the route requires ILP payment.

Two routes matter to these workflows, probed 2026-08-28:

| Route | Price | Carries |
|-------|-------|---------|
| `g.toon.relay` | 1 base unit, flat | Nostr events -- announcements, state, patches, PRs, issues, comments, status |
| `g.toon.store` / `g.toon.relay.store` | 1000 + 10 per KiB of sealed payload | git objects pushed as blobs (kind:5094) |

Prices are in the settlement token's smallest unit; USDC is 6-decimal, so `1_000_000` = $1. The relay is flat, so a 3 KiB patch costs exactly what a one-line comment costs. Only the store route has a slope.

If you need a price in advance, `await client.routePrice(destination)` returns `{ price, pricePerKib? }` and `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` turns it into a charge. The metered quantity is the **sealed** payload the PREPARE carries, so you cannot compute a charge from the event JSON you wrote. A node's full self-description, every route's price included, is free at `GET /ilp`.

For the publishing flow in full, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Reading (free, plain NIP-01)

Reading is free on TOON and speaks plain NIP-01. Use NIP-01 filters to subscribe to git events; the relay returns standard JSON `EVENT` messages that any ordinary Nostr client can parse. No decoder, and a free read never touches a connector. TOON on the way in, plain NIP-01 JSON on the way out.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

### Workflow References

- **Complete NIP-34 + git objects + Arweave integration overview** -- Read [nip-spec.md](references/nip-spec.md) for how the three systems compose into a decentralized git hosting stack.
- **Step-by-step workflows with every `client.send()` call** -- Read [scenarios.md](references/scenarios.md) for the 4 complete end-to-end workflows: create-repo, submit-patch, merge-patch, fetch-file.
- **Total workflow costs and optimization strategies** -- Read [toon-extensions.md](references/toon-extensions.md) for price breakdowns across multi-step workflows and where cost reduction is still possible.

### Cross-Skill References

- **NIP-34 event kinds (kind:30617, kind:1617, etc.)** -- See `git-collaboration` for individual event kind tag formats, validation rules, and per-kind references.
- **Git object binary format (blob, tree, commit)** -- See `git-objects` for binary construction, SHA-1 computation, and Nostr pubkey to git author mapping.
- **TOON write model, read model, and route pricing details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Arweave content references and file metadata** -- See `media-and-files` for NIP-73 `arweave:tx:` external content IDs.
- **Discovering what a route costs** -- See `relay-discovery` for NIP-11 relay info, and ask the node itself: `GET /ilp` returns its free self-description, including every route's price.
- **Social judgment on code review and contribution norms** -- See `nostr-social-intelligence` for collaboration engagement guidance.

## Social Context

Git workflows on TOON cost real money at every step -- announcing a repo, submitting a patch, creating a PR, opening an issue. What that money buys has changed the incentives, though. Relay writes are flat, so a sprawling patch costs no more than a one-line one: prefer small, reviewable patches because reviewers are the scarce resource, not because a big diff is expensive. Where size still bites is the store route, which charges by the kibibyte for git objects pushed as blobs -- so a binary-heavy commit is genuinely costly. Choosing between a patch and a PR is now a workflow question, not a price question: a patch carries the diff in the event body, a PR points at an external clone URL and needs that hosting to stay reachable.
