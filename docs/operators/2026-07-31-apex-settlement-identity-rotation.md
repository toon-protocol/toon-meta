# Notice: apex settlement identity rotated — open Base Sepolia channels

**Published 2026-07-31. Applies to: anyone holding an open payment channel with
the TOON devnet apex on Base Sepolia.**

## Summary

The devnet apex node has **rotated its settlement identity**. Its previous EVM
settlement address, `0xC0E55cD2E967a4F625627DaE5d4946f54267C7ab`, is retired and
will not be used again. The apex now settles from
`0xF29fD62C4848B9573C9b90adbF61b664F386d9CF`, which its kind:10032 announce
already advertises.

Eight payment channels opened against the **old** address are still open on the
Base Sepolia `TokenNetwork`. They are inactive: the apex is not routing over
them, is not submitting further claims against them, and **will not be closing
them from its side.**

**No funds are at risk, and nothing is stranded.** In every one of these eight
channels the apex's own deposit is **zero**. Settlement can therefore only ever
return the counterparty their own remaining deposit — the apex has nothing to
withdraw. Each counterparty is a channel participant and can `closeChannel` and
then `settleChannel` **unilaterally**, without any cooperation from the apex.

There is no deadline and no urgency. The only reason to act is that you are
better off holding your USDC than leaving it locked in a channel against a node
that has moved on.

## Affected channels

- **Chain:** Base Sepolia, chain id **84532**
- **Contract (`TokenNetwork`):** `0x1E95493fEF46707E034b4a1945f25a8C76A1823D`
- **Token:** mock USDC `0x49beE1Bca5d15Fb0963117923403F9498119a9Ce` (6 decimals)
- **Settlement timeout on all eight:** `86400` seconds (24 hours)
- **State verified on-chain at block `44877814` (2026-07-31 18:51:56 UTC)** —
  all eight read back `state == 1` (`Opened`), `closedAt == 0`

"Returned at settlement" is your deposit minus what the apex already claimed
from it during normal paid routing (`claimedAmounts[channelId][0xC0E55cD2…]`,
readable on-chain). Those claims were the packets you paid for; `claimFromChannel`
already transferred those tokens, and closing the channel does not reverse them.

| Channel id | Your address | Your deposit | Already claimed by apex | Returned at settlement |
|---|---|---|---|---|
| `0x7ab987ac4199a5e69ceb43e92143dde9cd872dd978d6e05817dd112d9ac6e1bc` | `0x869E14026D5AA1D8cb6C851108840fD6F5bC2698` | 0.100000 | 0.005630 | **0.094370** |
| `0x3c06f70af1b509a7d48798d82264e13ade2dee6f1304f9f64adacb7be57e6093` | `0xc2A0d10Ec9F1B4257e2b827D97fDE4B3FE650bc4` | 0.100000 | 0.024880 | **0.075120** |
| `0xea1a942b4eab1b19851bbe77c8eb7125dbe6371d167c2bf43e61828f768b3a6e` | `0x417Ec5FbF1c9a7FC60d2642dE1FE6104722a4c71` | 0.100000 | 0.076770 | **0.023230** |
| `0x327911c5056e7026332d02fc0b3e516b4a925182c51f78401c7662b96da1de19` | `0x8Ec1c69ec143D61F3E32D72E482689412E63268f` | 0.100000 | 0.024380 | **0.075620** |
| `0xb738aa73d4caf2c4e9cacdb0a1ab07006df23dece1c8742d9d5ddb10fd76b3e3` | `0xd7D0D2F8269452c95a70A597d596899D3f01eeb0` | 0.100000 | 0.000000 | **0.100000** |
| `0x5cd83c2a379ac3a45e65808eeb64358d53d27101fa82581227b20b54bae1b403` | `0xd7D0D2F8269452c95a70A597d596899D3f01eeb0` | 0.100000 | 0.049060 | **0.050940** |
| `0x8411ac775395b766a5ed5504d21e1060a00c986e87cc966e2d1810582eacf675` | `0x27523CC5e654393a81afFb4c8c0fEdA44AC3BcDc` | 0.100000 | 0.002000 | **0.098000** |
| `0x30eeaa2db7bc9ba5768c221519a91c4d16f920a16bdfa70f38463a0ba070a99a` | `0xB036782502bC6171dE7a6431e75Adbfe59Cf2e5F` | 0.100000 | 0.017000 | **0.083000** |

Amounts are USDC. Total returnable to counterparties: **0.600280 USDC**.

Four further channels with the old apex address are open but hold **no deposit
from either side** — there is nothing to settle and no reason to act on them.
They are listed only so this notice is complete:

| Channel id | Other participant |
|---|---|
| `0x7272a8a92f5d0edf54124dea22e0d88cd48c9394d22023fcc3564010be0dc8f9` | `0x869E14026D5AA1D8cb6C851108840fD6F5bC2698` |
| `0xfd7dff06b00a620cf67593c3b033311cd51796dc2c26593cbfb72be18cbda2ad` | `0x869E14026D5AA1D8cb6C851108840fD6F5bC2698` |
| `0x74b9936aacda93553c245a1438698037182189b5f2b6979438fe582c21a7b777` | `0x869E14026D5AA1D8cb6C851108840fD6F5bC2698` |
| `0x22915c98c475b84ea58a29e142f20905c9e7efd2ac24cc88dcc91839a0cd5283` | `0xfEE0a3DBC2C2fEd47400eB77bD1FB1bc347304f0` |

Nineteen other channels against the old address were closed and settled by the
apex on 2026-07-30 and need no action.

## How to settle your channel

Two transactions from the wallet that opened the channel, 24 hours apart.

1. **`closeChannel(bytes32 channelId)`** — any participant may call it. This
   moves the channel to `Closed` and starts the 24-hour challenge period.
2. Wait for the settlement timeout: **86400 seconds** from the block timestamp
   of your `closeChannel` transaction.
3. **`settleChannel(bytes32 channelId)`** — *anyone* may call it once the
   timeout has elapsed. It transfers each participant's remaining deposit back
   to them. Calling it early reverts with `SettlementTimeoutNotExpired()`.

Neither call takes a balance proof or a signature. You do not need anything from
the apex.

### Worked example

Using [Foundry](https://book.getfoundry.sh/)'s `cast`, for the channel
`0xb738aa73…` held by `0xd7D0D2F8…`:

```bash
export TN=0x1E95493fEF46707E034b4a1945f25a8C76A1823D          # TokenNetwork
export RPC=https://base-sepolia-rpc.publicnode.com            # Base Sepolia, chain id 84532
export CID=0xb738aa73d4caf2c4e9cacdb0a1ab07006df23dece1c8742d9d5ddb10fd76b3e3

# 0. Look before you leap. Fields: settlementTimeout, state, closedAt, openedAt, p1, p2
#    state: 0=NonExistent 1=Opened 2=Closed 3=Settled
cast call $TN 'channels(bytes32)(uint256,uint8,uint256,uint256,address,address)' $CID --rpc-url $RPC

# What you would get back: your deposit, minus what the apex already claimed from it.
cast call $TN 'participants(bytes32,address)(uint256,uint256,uint256)' $CID $YOUR_ADDRESS --rpc-url $RPC
cast call $TN 'claimedAmounts(bytes32,address)(uint256)' $CID 0xC0E55cD2E967a4F625627DaE5d4946f54267C7ab --rpc-url $RPC

# 1. Close. Must be sent by a participant.
cast send $TN 'closeChannel(bytes32)' $CID --rpc-url $RPC --private-key $YOUR_KEY

# 2. Wait 86400 seconds, then settle. Anyone may send this one.
cast send $TN 'settleChannel(bytes32)' $CID --rpc-url $RPC --private-key $YOUR_KEY
```

If you use the TOON client, the same two steps are `toon_channel_close` and
`toon_channel_settle` (MCP), or `closeChannel()` / `settleChannel()` on
`ToonClient`.

### Notes and caveats

- The channel id is **not** derivable from the participant pair alone — it is
  `keccak256(participant1, participant2, channelCounter)` with a global counter,
  so it comes from the `ChannelOpened` event. The ids above are the
  authoritative list; you can confirm yours by filtering `ChannelOpened` on the
  contract for your address.
- Base Sepolia's official load-balanced RPC (`https://sepolia.base.org`) serves
  stale reads that can break open/deposit sequencing. For channel operations,
  prefer a single-backend RPC such as
  `https://base-sepolia-rpc.publicnode.com`.
- `settleChannel` is `whenNotPaused`. The contract is not paused
  (verified 2026-07-31); if it ever is, settlement waits until it is unpaused.
- These are **testnet** funds on Base Sepolia, denominated in a mock USDC with
  an ungated mint. They have no market value. Settle them because leaving locked
  balances behind is untidy, not because they are worth recovering.
- Nothing about the rest of the devnet has changed. New channels opened against
  the current announce settle normally.

## Questions

Open an issue on [`toon-protocol/toon-meta`](https://github.com/toon-protocol/toon-meta/issues),
or email <dev.jonathan.green@gmail.com>.
