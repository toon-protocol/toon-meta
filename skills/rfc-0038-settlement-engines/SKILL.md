---
name: rfc-0038-settlement-engines
description: How TOON Protocol relates to Interledger RFC 0038 - Settlement Engines. Use when users ask how TOON settles on-chain, whether TOON runs a settlement-engine process, how EVM/Solana/Mina settlement works, or how claims get redeemed. Also covers generic settlement-engine, ledger-integration, and settlement-trigger questions. Triggers on 'settlement engine', 'on-chain settlement', 'claimFromChannel', 'multi-chain settlement', or 'how does TOON settle'.
---

# RFC 0038: Settlement Engines — and how TOON settles instead

RFC 0038 defines a settlement engine as a **separate process** the connector talks to over HTTP (`/accounts`, `/settlements`), which knows how to move value on one specific ledger.

## How TOON uses / diverges from this RFC

**TOON does NOT implement the RFC-0038 HTTP settlement-engine interface.** There is no separate settlement-engine process and no `/accounts` + `/settlements` HTTP API. Settlement is **in-process, multi-chain, and claim-driven**:

- **In-process providers.** The connector embeds payment-channel providers per chain (`settlement/provider/`): `evm-payment-channel-provider.ts`, `solana-payment-channel-provider.ts`, `mina-payment-channel-provider.ts`, selected via the chain-provider registry. They run inside the connector, not as out-of-process engines.
- **Claim-driven on-chain redemption.** Each provider implements the same interface (`payment-channel-provider.ts`): `claimFromChannel(...)` (redeem the latest signed balance proof on-chain), `closeChannel(channelId)`, and `settleChannel(channelId)`. Off-chain, paid writes accrue as signed claims; the connector calls these methods to settle on-chain when a threshold is crossed.
- **Multi-chain.** The same claim model maps to three chains with chain-specific signatures: EVM (EIP-712), Solana (Ed25519), Mina (Pallas/zk). A `payment-channel-claim` carries the chain-self-describing body so the right provider verifies and redeems it.

## What to tell a user asking about TOON settlement

Don't look for a settlement-engine container or an HTTP settlement API. Settlement happens inside the connector: signed claims accrue off-chain, then `claimFromChannel`/`settleChannel`/`closeChannel` redeem them on EVM/Solana/Mina. The operator runbook for recovering wedged on-chain settlement lives in the proxy `RUNBOOK.md`.

## Common Topics
- Why TOON has no RFC-0038 HTTP settlement engine (in-process instead)
- The three providers: EVM / Solana / Mina payment-channel providers
- `claimFromChannel` / `closeChannel` / `settleChannel` interface
- Threshold-triggered on-chain redemption of signed claims
- Relationship to `rfc-0032` (clearing/settlement flow), `rfc-0023` (claims)
