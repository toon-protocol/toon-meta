---
name: rfc-0023-bilateral-transfer-protocol
description: How TOON Protocol uses Interledger RFC 0023 - Bilateral Transfer Protocol (BTP). Use when users ask about TOON's transport layer, the BTP WebSocket session between a client and the apex/connector, the payment-channel-claim sub-protocol, authToken peering, or the ATOR/.anon overlay. Also covers generic bilateral transfer, peer-to-peer payment, and direct settlement questions. Triggers on 'BTP', 'bilateral transfer', 'WebSocket transport', 'payment-channel-claim', 'authToken', or how a TOON client connects to the connector.
---

# RFC 0023: Bilateral Transfer Protocol (BTP) on TOON

Implements RFC 0023 (BTP 2.0) as TOON's **only ILP transport**. Every paid write on TOON travels over a single bilateral BTP WebSocket session between the client and the apex/connector — there is no ILP-over-HTTP (RFC-0035) and no other binding in the pay path.

## How TOON uses / diverges from this RFC

TOON follows the BTP 2.0 framing closely and extends it with one custom sub-protocol:

- **Transport.** A client opens a WebSocket to the apex connector (`ws://host:3000/btp` in direct mode, or a SOCKS5h-proxied `.anon` hidden-service address in HS mode). All PREPARE/FULFILL/REJECT framing rides this one bilateral link (`btp/btp-types.ts`).
- **Auth.** The session authenticates with a BTP `authToken` (the standard RFC-0023 `auth` sub-protocol), establishing the bilateral peering relationship before any value-bearing packet is sent.
- **`payment-channel-claim` sub-protocol (TOON extension).** This is what makes TOON's BTP "pay-to-write." A write packet carries, alongside the ILP payload, a BTP protocolData entry named **`payment-channel-claim`** (content type 1 / JSON, `btp/btp-claim-types.ts:196`). The content is a signed off-chain **payment-channel balance proof**:
  - `EVMClaimMessage` — EIP-712 signature over `channelId / nonce / transferredAmount`, with `signerAddress` (`btp-claim-types.ts:80`).
  - `SolanaClaimMessage` — Ed25519 signature, base58 `signerPublicKey` (`:109`).
  - `MinaClaimMessage` — Pallas/zk commitment (Poseidon), zkApp channel (`:142`).
  - All share `BaseClaimMessage` (`:32`); the union is `BTPClaimMessage` (`:185`).
- **The claim IS the payment.** Unlike vanilla bilateral transfer where settlement is tracked out-of-band, on TOON the claim itself is the bilateral balance proof: it asserts a new monotonically-increasing `nonce` and cumulative `transferredAmount` against an on-chain channel deposit. The connector validates it at ingress (`btp/inbound-claim-validator.ts`) before forwarding.
- **Zero-amount and parent→child packets carry no claim.** Free reads, and the apex's free-forward of a packet to its own child node, skip the claim entirely (`inbound-claim-validator.ts:124-146`).
- **Privacy overlay.** TOON optionally wraps the BTP WebSocket in an ATOR/SOCKS5h `.anon` hidden service so neither side learns the other's network location. This is layered under BTP, not a change to the framing.

## What a TOON client does over BTP

1. Open WebSocket → send BTP `auth` with the `authToken` → session authenticated.
2. To publish: build the ILP packet (TOON-encoded Nostr event in `data`), attach the `payment-channel-claim` protocolData with a freshly-signed balance proof (nonce = previous + 1), send as a BTP MESSAGE/PREPARE.
3. Connector validates the claim, deducts its fee, routes by ILP address, and the destination returns FULFILL (accepted) or REJECT.
4. To read: send NIP-01 subscription packets with **no claim** — reads are free.

The daemon owns this single session and the nonce watermark (it must never go backwards). See `toon-client` for the agent-facing tools, and `rfc-0027` for the ILPv4 packet/error-code layer carried inside these BTP frames.

## Common Topics
- BTP 2.0 WebSocket framing as TOON's sole transport (`btp/btp-types.ts`)
- The `payment-channel-claim` sub-protocol and the EVM/Solana/Mina claim shapes
- `authToken`-based bilateral peering
- ATOR `.anon` / SOCKS5h privacy overlay
- Why reads and parent→child forwards carry no claim
