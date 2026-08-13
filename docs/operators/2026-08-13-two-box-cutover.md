# Notice: devnet apex retirement — two-box cutover

**Published 2026-08-13. Applies to: anyone running a TOON client against the
devnet.**

## Summary

The devnet apex box is being retired. Once it is destroyed, reading and
publishing through the relay keep working with no client update — clients
repair themselves automatically. **Store uploads do not self-heal**: if you
upload to the store, you will need an updated client to reach it again after
the cutover.

**This has not happened yet.** The cutover
([toon-meta#313](https://github.com/toon-protocol/toon-meta/issues/313)) is
an irreversible, human-gated operation still blocked on prerequisite work
([toon-meta#309](https://github.com/toon-protocol/toon-meta/issues/309)), and
no date is fixed. This notice describes what changes when it runs, published
ahead of time per the design in
[toon-meta#252](https://github.com/toon-protocol/toon-meta/issues/252).

## What dies and what survives

The devnet today runs four boxes: an apex, a relay box, a store box, and a
faucet box. The apex is the one being destroyed.

| Hostname | Fate | Why |
|---|---|---|
| `proxy.devnet.toonprotocol.dev` | **Dies with the apex.** | It is the apex's own ILP/BTP door — nothing else answers at it. |
| `relay-ws.devnet.toonprotocol.dev` | **Survives, unchanged.** | Already resolves to the relay box, not to the apex — it moved before this cutover, so nothing moves here. |
| `faucet.devnet.toonprotocol.dev` | **Survives, unchanged.** | Already moved to its own dedicated box, off the apex. |

If anything you run has `proxy.devnet.toonprotocol.dev` hardcoded — a script,
an env var, a config file — it will stop resolving once the apex is
destroyed. Don't hardcode a devnet endpoint going forward; let your client
discover it the normal way, from its bootstrap seed and the live announce.

## If you already have a client installed

Your client bootstrapped by querying a known relay endpoint for a known
announce identity, then trusting what that identity's most recent
kind:10032 announce says. The relay box has adopted the **same** announce
identity the apex used, and keeps the **same** `relay-ws` hostname. So the
query your client already knows how to make — same endpoint, same author —
still resolves, and the announce it gets back describes the new topology.

- **Reads and relay publishing:** self-heal automatically. Nothing to do.
- **Store uploads:** do not self-heal. No shipped client today has a seed
  entry for the store box, and the announce has no field yet to carry a
  second node's endpoint — so an already-deployed client has no way to learn
  where the store moved to. You will need to update to a client released
  after this cutover to regain uploads. This is a known, accepted gap, not a
  bug — see
  [toon-meta#310](https://github.com/toon-protocol/toon-meta/issues/310) for
  why.

A fresh install after the cutover needs no special handling: it bootstraps
against both surviving boxes from the start.

## Announce record

This notice is announced, so it records its `id` here per
[the conventions](./README.md#the-announce) — the announce carries only the
pointer below, and this file is the durable text it points at.

```json
{
  "id": "2026-08-13-two-box-cutover",
  "severity": "action-required",
  "summary": "The devnet apex is being retired; reads and relay publishing repair themselves, but store uploads need a client released after the cutover.",
  "url": "https://github.com/toon-protocol/toon-meta/blob/main/docs/operators/2026-08-13-two-box-cutover.md"
}
```

## Questions

Open an issue on
[`toon-protocol/toon-meta`](https://github.com/toon-protocol/toon-meta/issues),
or email <dev.jonathan.green@gmail.com>.
