# Settlement

**Settlement law is the connector's**, in [`connector/docs/adr/`](https://github.com/toon-protocol/connector/tree/main/docs/adr) — each record's own `**Status:**` line is the authority for whether it is live. This page is the pointer map plus the cross-repo facts (live addresses, one deliberate wire refusal, one open hazard).

| Question | Record |
|----------|--------|
| How does a peering find a chain? | `0058` a peering is established from a URL |
| Which channel is it? | `0059` a channel is derived from its participants |
| What proves the peering? | `0060` a claim proves a peering; the shared secret is deleted |
| Who may pay? | `0052` permissionless payment is guaranteed; a claim, never an identity, authorises |
| Where does the claim ride? | `0042` a packet carries its claim |
| What is signed? | `0024` EIP-712 digest (EVM) · `0053` a Solana claim binds its domain |

Mechanics, not decisions: [`connector/docs/protocol/payment-spec.md`](https://github.com/toon-protocol/connector/blob/main/docs/protocol/payment-spec.md) and [`README.md` §3 "Get paid"](https://github.com/toon-protocol/connector/blob/main/README.md).

## A peering finds its chain from a URL

One authenticated operator write — `POST /peers { id, url, fee, max_packet_amount }` — where `url` is the counterparty's **self-description** URL (ADR 0050). The node fetches it, picks the carriage from the endpoint scheme (`wss://` → BTP, `https://` → ILP-over-HTTP), finds the **shared settlement chain** in it, and derives the channel. There is no Nostr in this path, no announce and no negotiation function (ADR 0058).

**Identity is trust-on-first-use over TLS, and it attaches to the peer's URL** — never to a channel. Whoever answers that URL today is who the peering is with, vouched for by nothing beyond the operator's own vetting.

## A channel is derived from its participants

| Chain | Derivation |
|-------|-----------|
| **EVM** | `keccak256(abi.encodePacked(p1, p2, channelEpoch[p1][p2]))`, participants sorted. The token is implicit — one `TokenNetwork` per token. |
| **Solana** | the PDA over `["channel", min(p1,p2), max(p1,p2), mint]` — uniqueness enforced structurally. |

`channelCounter` is **deleted**, `channelEpoch` is public so the identifier is derivable from public data, and `ChannelAlreadyExists` is now a **live refusal** rather than dead code. At most one live channel exists per pair per token; the epoch advances in `settleChannel`, so a settled pair starts fresh instead of being locked out of its only identifier (ADR 0059, built #1158). Both sides compute the same answer, so **no channel identifier is ever exchanged and there is no shared secret** (ADR 0060).

Broadcast on **Base Sepolia at block 46055303, 2026-08-28** — see [`connector/docs/evm-deployment.md`](https://github.com/toon-protocol/connector/blob/main/docs/evm-deployment.md) "Second cutover".

## Settlement is an operator act

Never on the packet path, and there is **no threshold and no auto-drive**. Every one is an authenticated write on the operator surface (RFC 9421 signature, not the bearer token — ADR 0008), and each answers `503` when no `[settlement]` backend is configured.

| Write | Does |
|-------|------|
| `POST /channels` | Open a payment channel. |
| `POST /channels/:id/fund` | **Self-deposit** — your own collateral behind your own claims. Both chains. |
| `POST /channels/:id/redeem-latest` | **This is how you get paid.** |
| `POST /channels/:id/redeem` | Redeem one specific claim. |
| `POST /channels/:id/settle` · `/close` · `/cooperative-close` | End it. |

Claims are the truth; a balance is a projection of them.

## Configuration: the registry, not the TokenNetwork

`[settlement.evm].contract_address` is the **`TokenNetworkRegistry`**. The connector resolves the TokenNetwork at boot by calling `getTokenNetwork(token)`, and refuses to start if the chain disagrees with the config. Solana has no registry, so `[settlement.solana].program_id` names the payment-channel program itself.

## Live devnet addresses

Read from [`connector/infra/linode/endpoints.json`](https://github.com/toon-protocol/connector/blob/main/infra/linode/endpoints.json) — never retyped from memory.

| Chain | Item | Address |
|-------|------|---------|
| Base Sepolia (`84532`) | `TokenNetworkRegistry` | `0x0c41D9D424d6B075A3cEa1068a694f7847a8CCa5` |
| Base Sepolia | `TokenNetwork` (USDC) | `0xe9E05dfecfe165266C88d73e61D483612651952a` — **derived**, see below |
| Base Sepolia | mock USDC, 6 dp | `0x49beE1Bca5d15Fb0963117923403F9498119a9Ce` |
| Solana devnet | payment-channel program | `2aEVJ8koKD8LTZrLRSGtAtU7LBt4e7QjjCgf1kzQ7Rip` |
| Solana devnet | mock USDC mint, 6 dp | `34eSxY7qxQ4GzyhDJ8GpUcTz1WWzruGbJbR8q6TtxfQU` |

**The TokenNetwork is derived, not independent**: it is whatever `registryAddress.getTokenNetwork(tokenAddress)` answers on chain, so the two move together or the file is lying. `endpoints.json`'s own note records the three weeks the pair sat un-reconciled. Re-derive rather than trust a copy.

**Purged — these are dead and must not appear anywhere:** `0x1E95493fEF46707E034b4a1945f25a8C76A1823D`, `0xa79C3b1dbcEA00a6d84735a134395D8eF6D6a478`, `0xcC9079adE929b168B54145f6d25262b64FAB9D5b`, `xyc5J8MgKFiEN13PnfftdXxUzYH34FEvw1LCrFwN7in`.

## Mina: refused by name, deliberately

Mina left the connector repository (ADR 0065, *Mina leaves the repository*, built #1205; extends ADR 0002). The connector nonetheless still **refuses a claim whose `blockchain` is `"mina"` by name** — `ClientClaimError::Mina` in `connector-domain/src/client_claim.rs`, surfacing as `UnsupportedChain("mina")`. That is wire behaviour owed to `toon-client`, not a leftover to be cleaned up.

## Open hazard: the Solana program cannot be upgraded

Its upgrade authority is the deployer key from the 2026-07-18 deploy, and that key is lost. Any change to `packages/solana-program/src` is a **fresh deploy at a new program id**, not an upgrade — and because ADR 0053 binds the settlement program into a claim's signed message, a new program id is a new claim domain: every open channel on the old one must be drained or abandoned first. Plan it as a migration, not a release. Record: [`packages/solana-program/deployments/devnet-public.md`](https://github.com/toon-protocol/connector/blob/main/packages/solana-program/deployments/devnet-public.md).
