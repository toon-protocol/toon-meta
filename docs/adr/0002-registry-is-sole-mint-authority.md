# The registry is the sole authority on whether an archetype exists

**Status:** accepted

## Context

An **archetype** is a pinned opinion (environment × doctrine × oracle-skeleton) that
`forge new <archetype>` stamps into a new factory. `FACTORY_SPEC.md` §2.1 makes existence
conditional on a **pilot**: an archetype exists only once at least one merged
`agent:implement` PR has proven its bundle end to end, and naming an unminted archetype in a
`factory.toml` MUST fail validation.

That fact — *is this archetype minted, and by which repo?* — had two homes.

`FACTORY.md`'s archetype catalog carries it as a table row (`Archetype | Environment | Status |
Minted by`), which `forge new` parses to resolve an archetype. But Forge's archetype bundles also
carried it: `templates/archetypes/game/archetype.toml` declared `status = "mint-after-pilot"`,
`minted = false`, and `proving_repo = ""`.

The duplication was already incoherent at rest. That same file's header comment states that
promoting an archetype is *"a status flip in toon-meta/FACTORY.md, not a reshape of this file"* —
so by its own account, minting `service` in the registry would leave the bundle still reading
`minted = false`. Two sources of truth, no mechanism keeping them honest, and a documented
workflow that guarantees they diverge on the very first mint.

The org has been bitten by this shape before: the connector's peer/route logic lives in two
parallel surfaces that must be kept byte-identical by hand, and drift there has cost real
debugging time.

## Decision

**`FACTORY.md` is the sole authority on archetype existence. Archetype bundles do not record
mint status at all.**

- `templates/archetypes/<name>/archetype.toml` keeps `name`, `environment`, `doctrine`,
  `manifest_example`, and `oracle_tiers` — the *opinion*.
- It drops `status`, `minted`, and `proving_repo` — the *existence*.
- A minted archetype must also have a stampable bundle. The registry must never claim an
  archetype exists that `stamp.ts` cannot stamp, so a bundle lands **before** its catalog row is
  flipped to `minted`.

The division of labour: the bundle says *what this archetype is*; the registry says *whether it
exists*. "Unregistered means does not exist" (§8.2) then has exactly one place to look.

## Considered options

**Keep both, enforce parity in `forge validate`.** The bundle stays self-describing and portable;
`forge validate` fetches the registry and errors when the two disagree. Rejected: it makes drift
*detectable* rather than *impossible*, still demands two edits per mint, and only catches the
problem when someone happens to run `validate`. Detection is a weaker guarantee than a shape that
cannot drift.

**Leave the duplication documented.** Cheapest today, and rejected outright: the first mint would
immediately produce a bundle asserting `minted = false` about an archetype the registry calls
minted, which is precisely the lie §8.2 exists to prevent.

## Consequences

- An archetype bundle is no longer self-describing about its own status — a reader of
  `archetype.toml` alone cannot tell whether that archetype is usable. This is deliberate, and
  the file should say so. Resolving an archetype always requires the registry.
- `forge validate`'s archetype-drift check narrows to its real subject: divergence between a
  repo's `factory.toml` and its declared archetype's **pinned definition**, not mint bookkeeping.
- Minting becomes a one-line registry edit, gated on the bundle already existing.
- `game` stays scaffolded-but-unminted with no contradiction: the bundle describes the game
  opinion, and the registry simply has no minted row for it.
