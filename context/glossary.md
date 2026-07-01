# Glossary (ILP + TOON + Nostr)

**ILP / Interledger** — protocol suite for routing value across ledgers. TOON uses a small subset: ILPv4 packets (PREPARE/FULFILL/REJECT), ILP addresses, and BTP transport.

**BTP** — Bilateral Transfer Protocol (RFC-0023). WebSocket session between two peers carrying ILP packets. TOON's **only** transport; clients pay an apex over BTP.

**ILP address** — hierarchical routing label, e.g. `g.proxy`, `g.proxy.relay`. Longest-prefix matched by the connector's routing table. `g.proxy` is the canonical apex nodeId (see *Apex / proxy*).

**PREPARE / FULFILL / REJECT** — the three ILPv4 packet types. A TOON write is one PREPARE; the node answers FULFILL (accepted) or REJECT (with an error code, e.g. F06/T00/T04).

**Connector** — the ILP payment engine (separate repo). Validates the claim, takes a fee, routes by address, triggers settlement. The sole claim validator.

**Payment-channel claim / balance proof** — a signed off-chain message asserting the cumulative amount owed within an on-chain-funded channel. EIP-712 (EVM) / Ed25519 (Solana) / Pallas-Schnorr zk (Mina). The "money" half of a write.

**Settlement** — redeeming accumulated claims on-chain via `claimFromChannel` once a threshold is crossed. In-process, multi-chain.

**Apex / proxy** — an operator's deployment: the connector acting as a payment **proxy-server layer** in front of child relay/swap/store nodes. Clients pay the apex; it free-forwards to children. **Naming:** the canonical apex on-wire nodeId is **`g.proxy`** (children `g.proxy.<type>`, e.g. `g.proxy.relay`; env prefix `PROXY_*`). "Connector" remains the correct name for the repo and the payment-engine product — the `g.proxy` axis is only the on-wire nodeId + env prefix. There is no single canonical vhost scheme; live ILP edges include `connector.pay.toonprotocol.dev/ilp`, `proxy.devnet.toonprotocol.dev`, and `proxy.store.devnet.toonprotocol.dev/ilp`. Pending cleanup: purge remaining legacy `g.connector` references in favor of `g.proxy`. The Path A payment-proxy **core is shipped on connector `main`** (proven live at `connector.pay.toonprotocol.dev`); only the devnet roundtrip harness (PR #245) and the `deploy/pay-edge/` bundle (PR #246) remain open PRs.

**Parent / child / peer** — connector peer relations. Child packets are claim-free (settled in aggregate); a child must tag the apex as parent.

**localDelivery** — the connector forwarding a final-hop packet to a co-located node over HTTP (`POST /handle-packet`) instead of another BTP hop.

**TOON codec** — binary encoding of a Nostr event for the ILP `data` field (`encodeEventToToon`/`decodeEventFromToon`, in `core`).

**Nostr** — the underlying event/relay protocol. TOON gates *writes* behind payment; reads are free Nostr WS (NIP-01).

**NIP** — Nostr Improvement Proposal. TOON implements many on its ILP-gated relay (see the NIP skills).

**Rig** — a browser-only frontend (`@toon-protocol/rig`) that interprets TOON events and renders them: it subscribes to a relay (free reads), decodes the events, and fetches git objects from Arweave. It speaks the NIP-34 git vocabulary today — so it resembles a read-only git forge — but is **not** a GitHub clone. Because the state lives as paid, permanent events on TOON rather than on an origin server, the Rig is a **decentralized control plane**, with the git view as its first surface. See [docs/rig-guide.md](../docs/rig-guide.md). **Disambiguation:** "control plane" canonically refers to this — the Rig's event-space (the shared, signed TOON event log and the views over it). The `toon-clientd` daemon's loopback HTTP surface is the **control API**, not a control plane; avoid the collision.

**DVM** — Data Vending Machine (NIP-90). Pay a kind:5xxx request, get a kind:6xxx result. On TOON only **kind:5094** (Arweave blob storage) is live.

**kind:10032** — ILP peer-info event; how nodes advertise their address/services for discovery.

**SkillDescriptor (kind:10035)** — a provider's advertised capabilities + per-kind pricing; the basis for prepaid DVM.

**relay / swap / store** — the three TOON node products (Nostr relay / multi-chain swap / Arweave DVM). Formerly town / mill / dvm.

**apex nodeId (`g.proxy`)** — the apex's on-wire ILP nodeId and the canonical apex term; load-bearing (baked into the connector + every child's parent tag, so it must match across the deployment). A cleanup to purge remaining legacy `g.connector` references in favor of `g.proxy` is pending.
