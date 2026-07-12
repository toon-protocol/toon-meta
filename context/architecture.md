# TOON System Architecture

System- and repo-level architecture. For protocol/implementation depth see [`../docs/architecture.md`](../docs/architecture.md), [`../docs/protocol.md`](../docs/protocol.md), and [`../docs/settlement.md`](../docs/settlement.md).

## Layers

```
connector (separate repo)  ── the ILP payment engine: validates claims, fees, routes, settles
        ▲ optional peer dep (sdk lazy-imports; core duck-types via EmbeddableConnectorLike)
        │
  toon = core + sdk  ── npm libraries (no image, no CLI)
        │ consumed via npm semver
        ▼
  relay · swap · store · client  ── nodes + consumer, each its own repo + image
        │
        ▼
  deployment  ── the operator runs the connector as a proxy-server layer in front of co-located child nodes; the connector pins their image digests
```

- **core** — TOON binary codec, Nostr peer discovery (kind:10032), bootstrap, ILP address derivation/validation, settlement config, the structural `EmbeddableConnectorLike` interface. Never imports the connector.
- **sdk** — `createNode()` pipeline (verify → price → dispatch), handler registry, the Arweave DVM handler, swap modules, multi-chain settlement engines. Dynamically imports the connector only when auto-creating one.
- **connector** — `ConnectorNode`, BTP server/client (RFC-0023), routing table (longest-prefix), `ClaimReceiver` (validates inbound claims), `SettlementMonitor` + executors, admin HTTP API. **The sole claim validator.** Also hosts the **payment-proxy** path (front any oblivious HTTP backend): proxy handler, x402 greeting, RFC 9421 binding, `RouteTermination` config — **core shipped on `main`** (proven live at `connector.pay.toonprotocol.dev`); the devnet roundtrip harness (PR #245, merged) and `deploy/pay-edge/` bundle (PR #252, merged; supersedes closed PR #246) have also shipped. See [`../docs/payment-proxy.md`](../docs/payment-proxy.md).

## Runtime topology (one paid write)

```
client ─(1) BTP PREPARE + signed claim─► connector (apex, g.proxy)
                                          (2) ClaimReceiver verifies claim, takes fee,
                                              routing table → g.proxy.relay
                                          (3) localDelivery HTTP POST /handle-packet ─► relay BLS
client ◄─(5) BTP FULFILL─ connector ◄─(4) accept (event stored) ◄──────────────────┘
                                          (6) at threshold → SettlementMonitor →
                                              claimFromChannel on-chain (EVM/Solana/Mina)

reads:     client ─Nostr WS (NIP-01, free)─► relay        (never touches the connector)
discovery: nodes publish kind:10032 peer-info on Nostr; clients read it to find routes
```

## Load-bearing invariants

1. **Claim validation happens once, in the connector.** Nodes receive an already-paid `PaymentRequest` and only run business logic — they never re-verify signatures/balances (and couldn't; they don't hold channel state). See [decisions.md](./decisions.md).
2. **Parent→child forwarding is free** (settled in aggregate). The child must be registered `relation:'child'` AND tag the apex nodeId `g.proxy` as its parent (`TOON_PARENT_PEER_ID`); get either wrong and paid traffic to the child is rejected (T00/F06).
3. **The apex nodeId is an on-wire ILP nodeId** baked into the connector + every child's parent tag — load-bearing: the connector and every child must agree on it, or paid forwarding breaks (T00/F06). The canonical apex nodeId is **`g.proxy`** (children `g.proxy.<type>`, env prefix `PROXY_*`; used by the live devnet and epic-44); a cleanup to purge remaining legacy `g.connector` references in favor of `g.proxy` is pending. "Connector" stays the repo/product name.
4. **Reads are free** Nostr WS and bypass the payment path entirely.

## Payment model

- **USDC** is the user-facing token. Pricing is **per-byte** at the connector's configured rate; a kind:5xxx DVM request's amount = the provider's advertised `SkillDescriptor` price (**prepaid** — the request IS the payment).
- Writes are **single-packet**: message + payment in one ILP PREPARE.
- Claims are signed balance proofs: **EIP-712** (EVM), **Ed25519** (Solana), **Pallas/Schnorr zk** (Mina). Settlement redeems them on-chain via `claimFromChannel` once a per-peer/threshold is crossed.

## Key event kinds

| Kind | Meaning |
|------|---------|
| 1 | Nostr note (pay-per-byte publish) |
| 10032 | ILP peer-info (service advertisement / discovery) |
| 10035 | Service discovery / SkillDescriptor (pricing) |
| 5094 / 6094 | Arweave blob-storage DVM request / result |

> Many other kinds appear in older planning docs (text-gen 5000, compute 5250, pets 5300, chain-bridge 5260, etc.). As of the split, **only kind:5094 is a live, deployed DVM** on TOON; the rest are valid NIP-90 examples with no provider on the network today.
