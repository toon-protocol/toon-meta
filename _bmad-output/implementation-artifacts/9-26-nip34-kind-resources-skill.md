# Story 9.26: NIP-34 Kind Resources Skill (`git-collaboration`)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **AI agent**,
I want detailed Level 3 resource files for each NIP-34 event kind,
so that I can construct valid git collaboration events by loading the relevant kind's resource on demand.

**NIPs covered:** NIP-34 (all event kinds)
**Dependencies:** Stories 9.0, 9.1, 9.2 (pipeline) -- all complete (skills infrastructure exists)
**Origin:** Was Epic 8 Story 8.1

**Decision sources:**
- Party Mode 2026-03-22: NIP Skills Epic restructuring (NIP-34 skill stories moved to Epic 9)
- `_bmad-output/project-context.md` section "Fully Decentralized Git Architecture"
- `_bmad-output/planning-artifacts/epics.md` Epic 9 Phase 8
- NIP-34 specification: https://github.com/nostr-protocol/nips/blob/master/34.md

**Downstream dependencies:** Stories 9.27 (git-objects), 9.28 (git-arweave), 9.29 (git-workflows), 9.30 (git-identity-evals) all depend on this story.

## Acceptance Criteria

### AC1: Skill Directory Structure

1. Skill directory created at `.claude/skills/git-collaboration/` with subdirectories `references/` and `evals/`.
2. `SKILL.md` in the root of the skill directory with frontmatter (`name`, `description`) and a body covering all NIP-34 event kinds.
3. The `description` field in SKILL.md frontmatter is optimized for triggering on git/NIP-34/code collaboration queries (e.g., "how do I create a repo on Nostr?", "how do I submit a patch?", "NIP-34", "git collaboration on TOON", "how do I open an issue?", "how do I create a pull request on Nostr?").

### AC2: Level 3 Resource -- kind:30617 (Repository Announcement)

4. File `references/kind-30617-repo-announcement.md` containing: kind number (30617), purpose (announce git repositories and assert maintainership), event type (parameterized replaceable), required tags (`d` -- repository identifier), optional tags (`name`, `description`, `web`, `clone`, `relays`, `r` with `euc` marker, `maintainers`, `t` including `personal-fork`), content format (empty string), validation rules (d tag required, personal-fork semantics), and 2-3 complete examples including TOON `publishEvent()` calls.

### AC3: Level 3 Resource -- kind:30618 (Repository State)

5. File `references/kind-30618-repo-state.md` containing: kind number (30618), purpose (authoritative source for branch/tag states), event type (parameterized replaceable), required tags (`d` -- matches repository announcement), optional tags (`refs/heads/*`, `refs/tags/*`, `HEAD`), content format (empty string), validation rules (d tag must match a kind:30617, omitting all refs tags means ceased tracking), and 2-3 complete examples.

### AC4: Level 3 Resource -- kind:1617 (Patches)

6. File `references/kind-1617-patches.md` containing: kind number (1617), purpose (submit code patches), event type (regular), required tags (`a` -- repository address `30617:<pubkey>:<repo-id>`, `r` -- earliest unique commit), optional tags (`p`, `t` with `root`/`root-revision`, `commit`, `parent-commit`, `commit-pgp-sig`, `committer`), content format (`git format-patch` output), validation rules (content must be valid patch format, first patch may be cover letter, patch series use NIP-10 `e` reply tags), and 2-3 complete examples.

### AC5: Level 3 Resource -- kind:1618 (Pull Requests)

7. File `references/kind-1618-pull-requests.md` containing: kind number (1618), purpose (submit pull requests with branch tips), event type (regular), required tags (`a`, `r`, `c` -- PR branch tip, `clone` -- at least one URL), optional tags (`p`, `subject`, `t`, `branch-name`, `e` -- root patch event for revisions, `merge-base`), content format (markdown description), validation rules (tip should be pushed to `refs/nostr/<event-id>` before signing), and 2-3 complete examples.

### AC6: Level 3 Resource -- kind:1619 (PR Updates)

8. File `references/kind-1619-pr-updates.md` containing: kind number (1619), purpose (update PR branch tip without creating new PR), event type (regular), required tags (`a`, `r`, `E` -- PR event ID NIP-22, `P` -- PR author NIP-22, `c` -- updated tip, `clone`), optional tags (`p`, `merge-base`), content format (empty string), validation rules (E and P are uppercase NIP-22 root scope tags), and 2-3 complete examples.

### AC7: Level 3 Resource -- kind:1621 (Issues)

9. File `references/kind-1621-issues.md` containing: kind number (1621), purpose (report bugs, request features, discuss topics), event type (regular), required tags (`a` -- repository address, `p` -- repository owner), optional tags (`subject`, `t` -- labels), content format (markdown text), validation rules (replies follow NIP-22 comment standard using kind:1111), and 2-3 complete examples.

### AC8: Level 3 Resource -- kind:1622 (Comments)

10. File `references/kind-1622-comments.md` containing: kind number (1622), purpose (comment on issues, PRs, patches), event type (regular), required tags (`e` -- parent event being replied to, `p` -- parent author), optional tags (`a` -- repository for context), content format (markdown text), validation rules (threading uses NIP-10 markers, comments on comments create threads), and 2-3 complete examples.

### AC9: Level 3 Resource -- kind:1630-1633 (Status Events)

11. File `references/kind-1630-1633-status.md` containing: all four status kinds (1630=open, 1631=applied/merged/resolved, 1632=closed, 1633=draft), purpose (set lifecycle status for patches, PRs, issues), event type (regular), required tags (`e` with `root` marker), optional tags (`e` with `reply` marker for accepted revision, `p`, `a`, `r`, `q` -- applied patch event, `merge-commit`, `applied-as-commits`), content format (optional markdown), validation rules (most recent status from author/maintainer is authoritative, revision status inherits root or becomes closed if root merged), and 2-3 complete examples covering open, merge, and close scenarios.

### AC10: Level 3 Resource -- kind:5094 (Arweave Blob Storage)

12. File `references/kind-5094-arweave-blob.md` containing: kind number (5094), purpose (upload git objects to Arweave via DVM), context (DVM job request for blob storage), required tags for git usage (`Git-SHA`, `Git-Type`, `Repo`), content format (binary data or base64-encoded), resolution (Arweave GraphQL, manifest transaction, gateway URLs), and 2-3 complete examples showing blob, tree, and commit upload flows.

### AC11: TOON Write Model

13. Every resource file includes a "TOON Write Model" section documenting: use `publishEvent()` from `@toon-protocol/client`, fee formula (`basePricePerByte * serializedEventBytes`), typical byte costs for that kind, and a reference to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` for full protocol details.

### AC12: TOON Read Model

14. Every resource file includes a "TOON Read Model" section documenting: reading is free, NIP-01 filter format for that kind, TOON-format response parsing note, and a reference to the nostr-protocol-core skill.

### AC13: Social Context

15. SKILL.md includes a "Social Context" section covering code collaboration etiquette: review patches constructively, attribute contributions via maintainers tags, use status events responsibly (only maintainers should merge/close), issue reports should be detailed and reproducible, comments should add value. Anti-patterns: mass-closing issues, spam patches, status wars between non-maintainers.

### AC14: Evals

16. File `evals/evals.json` containing at least 8 eval test cases covering: construct a kind:30617 repo announcement, construct a kind:1617 patch, construct a kind:1618 PR, construct a kind:1621 issue, construct a kind:1622 comment, apply status via kind:1631, query for a repo's issues, and a multi-step workflow (create repo then submit patch). Each eval has input prompt, expected output patterns, and grading criteria.

### AC15: TOON Compliance

17. All resources use `publishEvent()` from `@toon-protocol/client` for writes (never raw WebSocket). All resources mention TOON-format responses for reads. No references to condition/fulfillment (removed in connector v2.0.0). Fee calculations use `basePricePerByte` model.

## Tasks / Subtasks

- [ ] Task 1: Create skill directory structure (AC: #1)
  - [ ] 1.1: Create `.claude/skills/git-collaboration/` directory
  - [ ] 1.2: Create `references/` subdirectory
  - [ ] 1.3: Create `evals/` subdirectory

- [ ] Task 2: Create SKILL.md (AC: #1, #13, #15)
  - [ ] 2.1: Write frontmatter with `name: git-collaboration` and trigger-optimized `description`
  - [ ] 2.2: Write body with summary of all NIP-34 kinds, organized by category (repository, collaboration, lifecycle)
  - [ ] 2.3: Write TOON Write Model section
  - [ ] 2.4: Write TOON Read Model section
  - [ ] 2.5: Write Social Context section (code collaboration etiquette)
  - [ ] 2.6: Write "When to Read Each Reference" section with progressive disclosure pointers

- [ ] Task 3: Create kind:30617 resource (AC: #2, #11, #12, #15)
  - [ ] 3.1: Write `references/kind-30617-repo-announcement.md` with complete spec, tags, validation, examples, TOON write/read models

- [ ] Task 4: Create kind:30618 resource (AC: #3, #11, #12, #15)
  - [ ] 4.1: Write `references/kind-30618-repo-state.md`

- [ ] Task 5: Create kind:1617 resource (AC: #4, #11, #12, #15)
  - [ ] 5.1: Write `references/kind-1617-patches.md`

- [ ] Task 6: Create kind:1618 resource (AC: #5, #11, #12, #15)
  - [ ] 6.1: Write `references/kind-1618-pull-requests.md`

- [ ] Task 7: Create kind:1619 resource (AC: #6, #11, #12, #15)
  - [ ] 7.1: Write `references/kind-1619-pr-updates.md`

- [ ] Task 8: Create kind:1621 resource (AC: #7, #11, #12, #15)
  - [ ] 8.1: Write `references/kind-1621-issues.md`

- [ ] Task 9: Create kind:1622 resource (AC: #8, #11, #12, #15)
  - [ ] 9.1: Write `references/kind-1622-comments.md`

- [ ] Task 10: Create kind:1630-1633 resource (AC: #9, #11, #12, #15)
  - [ ] 10.1: Write `references/kind-1630-1633-status.md`

- [ ] Task 11: Create kind:5094 resource (AC: #10, #11, #12, #15)
  - [ ] 11.1: Write `references/kind-5094-arweave-blob.md`

- [ ] Task 12: Create evals (AC: #14)
  - [ ] 12.1: Write `evals/evals.json` with 8+ eval test cases
  - [ ] 12.2: Include grading criteria for each eval

- [ ] Task 13: Validate TOON compliance across all files (AC: #15)
  - [ ] 13.1: Verify all write examples use `publishEvent()`
  - [ ] 13.2: Verify all read examples mention TOON-format parsing
  - [ ] 13.3: Verify no condition/fulfillment references
  - [ ] 13.4: Verify fee calculations use basePricePerByte model

## Dev Notes

### Existing Skill Pattern (MUST FOLLOW)

All NIP-based TOON skills follow this exact structure (verified from 10+ existing skills):

```
.claude/skills/<skill-name>/
  SKILL.md           # Frontmatter (name, description) + body (summary of all kinds)
  references/
    nip-spec.md      # OR per-kind files like kind-XXXXX-name.md
    toon-extensions.md  # TOON-specific extensions (optional, can be inline)
    scenarios.md     # Step-by-step workflows (optional for this story)
  evals/
    evals.json       # Eval test cases
```

**This story uses per-kind resource files** instead of a single `nip-spec.md` because NIP-34 covers 11+ distinct event kinds. This is the "Level 3 progressive disclosure" pattern -- agents load only the kind they need.

### Reference Skills to Study

- `.claude/skills/social-interactions/` -- Multi-kind skill (kind:7, kind:6, kind:16, kind:1111). Pattern: single SKILL.md summarizing all kinds, references with nip-spec.md + toon-extensions.md + scenarios.md.
- `.claude/skills/content-references/` -- Cross-cutting skill with NIP-21/NIP-27. Same reference structure.
- `.claude/skills/relay-groups/` -- NIP-29 with admin actions (kind:9000-9009). Pattern for admin/lifecycle events.
- `.claude/skills/moderated-communities/` -- NIP-72 with approval workflow. Pattern for permission-based actions.

### NIP-34 Event Kind Summary

| Kind | Name | Type | Key Tags |
|------|------|------|----------|
| 30617 | Repo Announcement | Param. Replaceable | `d`, `name`, `clone`, `maintainers` |
| 30618 | Repo State | Param. Replaceable | `d`, `refs/heads/*`, `HEAD` |
| 1617 | Patch | Regular | `a`, `r`, `commit`, content=`git format-patch` |
| 1618 | Pull Request | Regular | `a`, `r`, `c`, `clone`, `subject` |
| 1619 | PR Update | Regular | `a`, `r`, `E`, `P`, `c`, `clone` |
| 1621 | Issue | Regular | `a`, `p`, `subject`, content=markdown |
| 1622 | Comment | Regular | `e`, `p`, content=markdown |
| 1630 | Status: Open | Regular | `e` with `root` marker |
| 1631 | Status: Applied/Merged | Regular | `e`, `merge-commit`, `applied-as-commits` |
| 1632 | Status: Closed | Regular | `e` with `root` marker |
| 1633 | Status: Draft | Regular | `e` with `root` marker |
| 5094 | Arweave Blob (DVM) | Regular | `Git-SHA`, `Git-Type`, `Repo` |

### TOON Protocol Constraints (CRITICAL)

- **Writes:** Always use `publishEvent()` from `@toon-protocol/client`. Never raw WebSocket.
- **Reads:** Free. Use NIP-01 filters. TOON relays return TOON-format strings, not JSON objects.
- **Fees:** `basePricePerByte * serializedEventBytes`. Default basePricePerByte = 10n ($0.00001/byte).
- **No condition/fulfillment:** Connector v2.0.0 removed these from the application API.
- **Transport:** `@toon-protocol/client` for agents. SDK (`createNode()`) is only for providers.

### Byte Cost Estimates

- kind:30617 (repo announcement): ~300-500 bytes = ~$0.003-$0.005
- kind:30618 (repo state): ~200-800 bytes (depends on branch count) = ~$0.002-$0.008
- kind:1617 (patch): ~500-50000 bytes (depends on patch size) = ~$0.005-$0.50
- kind:1618 (PR): ~400-1000 bytes = ~$0.004-$0.01
- kind:1619 (PR update): ~300-500 bytes = ~$0.003-$0.005
- kind:1621 (issue): ~300-2000 bytes = ~$0.003-$0.02
- kind:1622 (comment): ~200-1000 bytes = ~$0.002-$0.01
- kind:1630-1633 (status): ~200-400 bytes = ~$0.002-$0.004

### Arweave Integration Context

- Git objects (blob, tree, commit) are uploaded to Arweave via kind:5094 DVM using `@ardrive/turbo-sdk`
- Arweave data item tags: `Git-SHA` (content-addressed), `Git-Type` (blob/tree/commit), `Repo` (repository identifier)
- Resolution: Arweave GraphQL queries by tag, manifest transactions, or gateway URLs
- Free uploads <= 100KB (dev via `TurboFactory.unauthenticated()`); authenticated/paid for production

### Project Structure Notes

- Skill location: `.claude/skills/git-collaboration/` (in the main repo `.claude/skills/` directory)
- This is NOT in `packages/` -- skills are Claude Agent Skill files, not npm packages
- The worktree is at `/Users/jonathangreen/Documents/crosstown/.claude/worktrees/agent-abb3c570/` but skills live in the main repo at `/Users/jonathangreen/Documents/crosstown/.claude/skills/`
- **IMPORTANT:** Write files to `.claude/skills/git-collaboration/` relative to the project root

### References

- [NIP-34 Specification](https://github.com/nostr-protocol/nips/blob/master/34.md)
- [Source: _bmad-output/project-context.md#Fully Decentralized Git Architecture]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 9 Phase 8]
- [Source: packages/core/src/nip34/README.md] -- existing NIP-34 handler implementation
- [Source: .claude/skills/social-interactions/SKILL.md] -- reference skill pattern
- [Source: .claude/skills/content-references/SKILL.md] -- reference skill pattern

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
