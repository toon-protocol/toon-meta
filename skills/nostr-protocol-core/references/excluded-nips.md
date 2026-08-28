# Excluded NIPs (TOON's Payment Layer Replaces These)

## Why These NIPs Are Excluded

TOON's payment layer provides the same functions that these NIPs were designed to handle on vanilla Nostr. Including them would create redundancy, confusion, and potential conflicts. When an agent encounters references to these NIPs in the wild, it should understand that TOON handles the underlying need differently.

## NIP-13: Proof of Work

**What it does on vanilla Nostr:** Clients compute a proof-of-work hash on events (leading zero bits in the event ID) to demonstrate computational effort. Relays can require minimum PoW to prevent spam.

**Why TOON excludes it:** payment replaces PoW as the spam prevention mechanism. Payment is a stronger anti-spam signal than computational work because: (1) it has a real economic cost that scales with usage, (2) it cannot be amortized by specialized hardware, and (3) it directly compensates relay operators rather than wasting energy. On TOON, every write already carries a covering claim -- there is no need for a separate PoW requirement. Note the axis: the relay route is priced flat per packet, so what is priced out is *volume*, not verbosity.

## NIP-42: Relay Authentication

**What it does on vanilla Nostr:** A challenge-response authentication protocol where relays send an AUTH challenge and clients sign it with their private key. Used to gate writes and restrict relay access to authorized users.

**Why TOON excludes it:** payment IS the gate. A **claim** authorises, never an identity (connector ADR 0052) -- the ability to sign a claim on a funded channel is what gets a write accepted. Every `send()` carries one. The relay does not need a separate AUTH handshake, and in fact never sees the payment at all: the connector in front of it terminates that and hands the relay ordinary HTTP that was already paid for. This is authorisation by economic participation rather than by cryptographic challenge.

## NIP-47: Nostr Wallet Connect

**What it does on vanilla Nostr:** A protocol for connecting Nostr clients to Lightning wallets. Enables in-app payments, zaps, and wallet management through Nostr events.

**Why TOON excludes it:** TOON replaces Lightning wallet integration entirely. Settlement is USDC on **two chains** -- Base Sepolia (`evm:84532`) and Solana devnet -- not Lightning. Payment channels and signed claims handle every flow, and `client.send()` mints the claim for you. There is no Lightning wallet to connect to; payment is native to the protocol.

## NIP-57: Zaps

**What it does on vanilla Nostr:** Lightning zaps -- send satoshi tips to event authors via Lightning Network. Includes zap requests, zap receipts, and relay-mediated zap flow.

**Why TOON excludes it:** TOON replaces Lightning zaps. Every write is already a payment. If an agent wants to send value to another participant, it does so by paying a route that participant terminates. The write's own charge already functions as a micropayment to the relay operator. Direct tip/zap functionality, if needed, would ride payment channels rather than Lightning.

## NIP-98: HTTP Auth

**What it does on vanilla Nostr:** HTTP authentication using signed Nostr events. Clients sign an authorization event and include it as an HTTP header to authenticate API requests.

**Why TOON excludes it:** a paid packet is already authenticated by the claim it carries, and the app behind the connector never has to check anything. A request that arrives *unpaid* at a priced route is answered with a **greeting** carrying that route's terms -- not with the work, and not with an authentication challenge. NIP-98's function is subsumed by payment-as-authorisation.

The two carriages are BTP over `wss://` and ILP-over-HTTP over `https://` (ADR 0027); both produce the same packet, and the **app** cannot distinguish between them.

## When You Encounter These NIPs

If working with content or documentation that references these NIPs:
- Explain that TOON handles the underlying need through its payment layer
- Do not implement or recommend implementing these NIPs on TOON
- Redirect to the appropriate TOON mechanism: a covering claim for spam prevention, a claim on a funded channel for authorisation, and a greeting for the unpaid case
