# Glossary (ILP + TOON + Nostr)

**ILP / Interledger** — protocol suite for routing value across ledgers. TOON uses a small subset: ILPv4 packets (PREPARE/FULFILL/REJECT), ILP addresses, and BTP transport.

**BTP** — Bilateral Transfer Protocol (RFC-0023). WebSocket session between two peers carrying ILP packets. TOON's **only** transport; clients pay an apex over BTP.

**ILP address** — hierarchical routing label, e.g. `g.townhouse`, `g.townhouse.relay`. Longest-prefix matched by the connector's routing table.

**PREPARE / FULFILL / REJECT** — the three ILPv4 packet types. A TOON write is one PREPARE; the node answers FULFILL (accepted) or REJECT (with an error code, e.g. F06/T00/T04).

**Connector** — the ILP payment engine (separate repo). Validates the claim, takes a fee, routes by address, triggers settlement. The sole claim validator.

**Payment-channel claim / balance proof** — a signed off-chain message asserting the cumulative amount owed within an on-chain-funded channel. EIP-712 (EVM) / Ed25519 (Solana) / Pallas-Schnorr zk (Mina). The "money" half of a write.

**Settlement** — redeeming accumulated claims on-chain via `claimFromChannel` once a threshold is crossed. In-process, multi-chain.

**Apex / hub** — an operator's deployment: the connector (nodeId `g.townhouse`) + child relay/swap/store nodes. Clients pay the apex; it free-forwards to children.

**Parent / child / peer** — connector peer relations. Child packets are claim-free (settled in aggregate); a child must tag the apex as parent.

**localDelivery** — the connector forwarding a final-hop packet to a co-located node over HTTP (`POST /handle-packet`) instead of another BTP hop.

**TOON codec** — binary encoding of a Nostr event for the ILP `data` field (`encodeEventToToon`/`decodeEventFromToon`, in `core`).

**Nostr** — the underlying event/relay protocol. TOON gates *writes* behind payment; reads are free Nostr WS (NIP-01).

**NIP** — Nostr Improvement Proposal. TOON implements many on its ILP-gated relay (see the NIP skills).

**Rig** — a browser-only frontend (`@toon-protocol/rig`) that interprets TOON events and renders them: it subscribes to a relay (free reads), decodes the events, and fetches git objects from Arweave. It speaks the NIP-34 git vocabulary today — so it resembles a read-only git forge — but is **not** a GitHub clone. Because the state lives as paid, permanent events on TOON rather than on an origin server, the Rig is a **decentralized control plane**, with the git view as its first surface. See [docs/rig-guide.md](../docs/rig-guide.md).

**DVM** — Data Vending Machine (NIP-90). Pay a kind:5xxx request, get a kind:6xxx result. On TOON only **kind:5094** (Arweave blob storage) is live.

**kind:10032** — ILP peer-info event; how nodes advertise their address/services for discovery.

**SkillDescriptor (kind:10035)** — a provider's advertised capabilities + per-kind pricing; the basis for prepaid DVM.

**relay / swap / store** — the three TOON node products (Nostr relay / multi-chain swap / Arweave DVM). Formerly town / mill / dvm.

**connector node `g.townhouse`** — the apex's on-wire ILP nodeId. Frozen across cosmetic renames.
