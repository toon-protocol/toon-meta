# Settlement

Crosstown uses EVM payment channels for off-chain micropayments, settled on-chain when needed.

## Chain Negotiation

When two nodes want to peer, they need to agree on which blockchain to use for settlement. This happens automatically using publicly advertised kind:10032 data.

**Algorithm:**

1. Both nodes publish kind:10032 events listing their supported chains
2. The joining node reads the peer's kind:10032 event
3. `negotiateSettlementChain()` finds the intersection of supported chains
4. Picks the optimal chain (prefer mainnet over testnet, lower fees over higher)

**Chain format:** `{blockchain}:{network}:{chainId}`

| Example | Chain |
|---------|-------|
| `evm:base:8453` | Base mainnet |
| `evm:base:84532` | Base Sepolia testnet |
| `evm:base:31337` | Local Anvil |

## Payment Channels

Channels are opened unilaterally — the joining node opens a channel on the negotiated chain's TokenNetwork contract without requiring the peer's cooperation.

**How channels work:**

1. Joiner calls `openChannel(peerAddress, timeout)` on the TokenNetwork contract
2. TokenNetwork enforces one open channel per participant pair
3. Off-chain balance updates happen via signed BTP claims
4. On-chain settlement only occurs at channel close or dispute

### Self-Describing BTP Claims

Each BTP claim includes all the information needed for verification:

- `chainId` — Which chain the channel is on
- `tokenNetworkAddress` — Which TokenNetwork contract
- `tokenAddress` — Which token
- `channelId` — Which channel

The receiving connector verifies the channel on-chain the first time it sees a new channel (TOFU model — trust on first use), then caches the verification for subsequent claims.

### EIP-712 Signatures

Claims use EIP-712 typed data signatures with `chainId` and `verifyingContract` in the domain separator. This makes claims tamper-proof and chain-specific — a claim from one chain cannot be replayed on another.

## Settlement Info in kind:10032

Nodes advertise their settlement capabilities in kind:10032 events:

```json
{
  "supportedChains": ["evm:base:84532", "evm:base:31337"],
  "settlementAddresses": {
    "evm:base:84532": "0xABC...",
    "evm:base:31337": "0xDEF..."
  },
  "tokenNetworks": {
    "evm:base:31337": "0xCafac3dD18aC6c6e92c921884f9E4176737C052c"
  },
  "preferredTokens": {
    "evm:base:31337": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  }
}
```

The TokenNetwork address (not the registry address) must be published — peers use this to open channels directly.

## Contracts (Local Anvil)

These addresses are deterministic from the Anvil deployment:

| Contract | Address |
|----------|---------|
| Mock USDC (ERC20) | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| TokenNetworkRegistry | `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512` |
| TokenNetwork (USDC) | `0xCafac3dD18aC6c6e92c921884f9E4176737C052c` |
