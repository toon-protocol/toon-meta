# Operator notices

Public, dated notices about the **live TOON devnet** — changes that a
counterparty, node operator, or client user may need to act on.

Everything else in [`docs/`](../) is reference material that describes how the
system works today. This directory is the opposite: an append-only log of
*events*, each written once and left alone so a link to it keeps meaning what it
meant when it was published.

| Date | Notice |
|------|--------|
| 2026-07-31 | [Apex settlement identity rotated — open Base Sepolia channels](./2026-07-31-apex-settlement-identity-rotation.md) |

## The announce

[toon-meta#252](https://github.com/toon-protocol/toon-meta/issues/252) adds an
optional `notice` object to the apex's kind:10032 announce — the one event
every client already fetches on startup, and currently the only reliable way
to reach a devnet counterparty at all.

**The rule: durable text stays in git, in this directory; the announce
carries only a pointer.** A notice must be readable and useful entirely on
its own at its `url` — it cannot assume the reader has seen anything the
announce said. The `summary` is the reason to open the notice, never a
substitute for reading it.

The announced object has four fields:

- **`id`** — the notice's filename stem, i.e. `YYYY-MM-DD-<slug>` without the
  `.md` extension (e.g. `2026-07-31-apex-settlement-identity-rotation`).
  Consumers de-duplicate on `id`: a client shows a given `id` once and never
  again, so an `id` must never be reused for different content. Because it is
  derived from the filename, and a published notice is never renamed or
  replaced by a second file — a correction is a dated addendum appended to the
  same file, or an inline fix to it, per the conventions below — the `id` is
  stable for the life of the notice.
- **`severity`** — `info` or `action-required`. The test: *if the reader can
  safely do nothing, it is `info`; if there is something the reader must do,
  it is `action-required`.* Apply the test to the reader's obligation, not to
  whether the notice happens to describe an action — a notice that walks
  through an optional action (see the worked example below) is still `info`
  if doing nothing is safe. `action-required` is reserved for the case that
  will eventually justify interrupting somebody.
- **`summary`** — one line, plain language, stating what changed or what to
  do. It is not a title, and it is not a substitute for the notice: write it
  so a reader can decide whether to open the `url`, not so they can skip
  opening it.
- **`url`** — the published file's permanent location on `main`, e.g.
  `https://github.com/toon-protocol/toon-meta/blob/main/docs/operators/2026-07-31-apex-settlement-identity-rotation.md`.
  The announce may be the only trace of a notice a client keeps, so this link
  must keep resolving indefinitely — notices are not moved or renamed once
  announced.

### Worked example

What [the 2026-07-31 notice](./2026-07-31-apex-settlement-identity-rotation.md)
would carry, once toon-meta#252's code children ship the field that announces
it. It is `info`, not `action-required`, despite walking the reader through
closing and settling a channel: the notice itself states there is no
deadline, no urgency, and no funds at risk — the reader can safely do
nothing.

```json
{
  "id": "2026-07-31-apex-settlement-identity-rotation",
  "severity": "info",
  "summary": "Apex settlement identity rotated; 8 old-address channels can optionally be closed and settled.",
  "url": "https://github.com/toon-protocol/toon-meta/blob/main/docs/operators/2026-07-31-apex-settlement-identity-rotation.md"
}
```

The field types and wire schema will live in `@toon-protocol/core`, shipped by
a separate child of toon-meta#252. If the two ever disagree, the shipped schema
wins and this section gets corrected.

## Conventions

- One file per notice, named `YYYY-MM-DD-<slug>.md`.
- State **what changed**, **whether anything is at risk**, and **what (if
  anything) the reader must do**. In that order.
- Prefer facts a reader can verify themselves — contract addresses, chain ids,
  channel ids, block numbers — over reassurance.
- Notices are **not edited after publication** except to append a dated
  addendum, or to correct a factual error (noted inline).
- A notice that is **announced** (as opposed to merely filed) records its
  `id` in the file itself, so the file and the wire can be reconciled by a
  reader who has only one of them.
- Contract addresses and chain parameters must match
  [`deployment.md`](../deployment.md#deployed-settlement-contracts-public-networks-verified-2026-07-19).
  The authoritative *runtime* source is still the apex's kind:10032 announce.
