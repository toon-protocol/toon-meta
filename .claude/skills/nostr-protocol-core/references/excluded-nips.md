# Excluded NIPs (ILP Replaces These)

## Why These NIPs Are Excluded

TOON's ILP payment layer provides the same functions that these NIPs were designed to handle on vanilla Nostr. Including them would create redundancy, confusion, and potential conflicts. When an agent encounters references to these NIPs in the wild, it should understand that TOON handles the underlying need differently.

## NIP-13: Proof of Work

**What it does on vanilla Nostr:** Clients compute a proof-of-work hash on events (leading zero bits in the event ID) to demonstrate computational effort. Relays can require minimum PoW to prevent spam.

**Why TOON excludes it:** ILP payment replaces PoW as the spam prevention mechanism. Payment is a stronger anti-spam signal than computational work because: (1) it has a real economic cost that scales with usage, (2) it cannot be amortized by specialized hardware, and (3) it directly compensates relay operators rather than wasting energy. On TOON, every write already carries a per-byte fee -- there is no need for a separate PoW requirement.

## NIP-42: Relay Authentication

**What it does on vanilla Nostr:** A challenge-response authentication protocol where relays send an AUTH challenge and clients sign it with their private key. Used to gate writes and restrict relay access to authorized users.

**Why TOON excludes it:** ILP gating IS authentication. On TOON, the ability to make an ILP payment (having a funded payment channel) is the authentication mechanism. Every publishEvent() call carries payment proof. The relay does not need a separate AUTH handshake because the ILP payment intrinsically proves the client is a legitimate, funded participant. This is authentication by economic participation rather than by cryptographic challenge.

## NIP-47: Nostr Wallet Connect

**What it does on vanilla Nostr:** A protocol for connecting Nostr clients to Lightning wallets. Enables in-app payments, zaps, and wallet management through Nostr events.

**Why TOON excludes it:** ILP replaces Lightning wallet integration entirely. TOON's payment infrastructure uses ILP with USDC on EVM chains (Arbitrum), not Lightning. The payment channel and balance proof system (`signBalanceProof()`, `publishEvent()`) handle all payment flows. There is no Lightning wallet to connect to -- payments are native to the protocol.

## NIP-57: Zaps

**What it does on vanilla Nostr:** Lightning zaps -- send satoshi tips to event authors via Lightning Network. Includes zap requests, zap receipts, and relay-mediated zap flow.

**Why TOON excludes it:** ILP replaces Lightning zaps. On TOON, every write is already a payment. If an agent wants to send value to another participant, it does so through ILP (sending a payment to their ILP address). The per-byte write cost already functions as a micropayment to the relay network. Direct tip/zap functionality, if needed, would use ILP channels rather than Lightning.

## NIP-98: HTTP Auth

**What it does on vanilla Nostr:** HTTP authentication using signed Nostr events. Clients sign an authorization event and include it as an HTTP header to authenticate API requests.

**Why TOON excludes it:** x402 already handles HTTP payment-authentication on TOON. The `/publish` HTTP endpoint accepts x402 payment headers (EIP-3009 signed USDC transfers) for clients that prefer HTTP over WebSocket+ILP. Both x402 and ILP produce identical ILP PREPARE packets -- the BLS cannot distinguish between them. NIP-98's authentication function is subsumed by x402's payment-as-authentication model.

## When You Encounter These NIPs

If working with content or documentation that references these NIPs:
- Explain that TOON handles the underlying need through ILP
- Do not implement or recommend implementing these NIPs on TOON
- Redirect to the appropriate TOON mechanism (ILP payment for spam prevention, payment channels for authentication, x402 for HTTP auth)
