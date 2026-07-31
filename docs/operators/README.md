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

## Conventions

- One file per notice, named `YYYY-MM-DD-<slug>.md`.
- State **what changed**, **whether anything is at risk**, and **what (if
  anything) the reader must do**. In that order.
- Prefer facts a reader can verify themselves — contract addresses, chain ids,
  channel ids, block numbers — over reassurance.
- Notices are **not edited after publication** except to append a dated
  addendum, or to correct a factual error (noted inline).
- Contract addresses and chain parameters must match
  [`deployment.md`](../deployment.md#deployed-settlement-contracts-public-networks-verified-2026-07-19).
  The authoritative *runtime* source is still the apex's kind:10032 announce.
