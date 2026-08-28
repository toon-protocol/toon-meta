---
name: rfc-0027-interledger-protocol-4
description: How TOON Protocol relates to Interledger Protocol V4 (ILPv4, RFC 0027). Use when users ask about TOON's ILP packet format, PREPARE/FULFILL/REJECT framing, whether TOON "speaks ILPv4", routing by ILP address, or the reject codes (F03, T04, F02, T01, R01) a TOON client may see. Also covers generic ILPv4 packet, routing, and rejection-code questions. Triggers on 'ILPv4', 'ILP packet', 'FULFILL', 'REJECT', 'F03', 'T04', 'error code', 'routing', or core protocol questions on TOON.
---

# RFC 0027: ILPv4 — TOON has its semantics, not its bytes

RFC 0027 is **vendored verbatim** in the connector at a pinned upstream commit,
beneath a TOON profile naming every departure:
[`connector/docs/rfcs/0027-interledger-protocol-4/`](https://github.com/toon-protocol/connector/tree/main/docs/rfcs/0027-interledger-protocol-4).
Read the profile before the body — the profile is the part that binds
(connector ADR 0062).

## The headline: ILPv4 semantics, TOON encoding

**Never write "TOON speaks ILPv4" unqualified.** That phrase is *retired* as a
description of this connector
([ADR 0063](https://github.com/toon-protocol/connector/blob/main/docs/adr/0063-the-ilp-packet-is-toons-dialect-not-rfc-0027s.md)
D3). The accurate form is **ILPv4 semantics, TOON encoding** — and the two are
deliberately **not byte-compatible**. This is ratified, not tolerated: ADR 0063
records the encoding the connector has always emitted and decides *against*
becoming compatible.

| RFC 0027 §Packet Format | This connector |
| --- | --- |
| Outer type-length wrapper: `type` then a VarOctetString | Type byte, then fields inline — no wrapper |
| `amount` is a fixed `UInt64` (8 bytes) | a VarUInt |
| `expiresAt` is a 17-byte Interledger Timestamp | 19-byte GeneralizedTime, `YYYYMMDDHHMMSS.fffZ` |

A packet from this connector will not decode in a conforming ILPv4
implementation, and vice versa. The encoding is pinned by
`vectors/wire-vectors.json`, which is normative where prose is not (ADR 0021).

Interoperation with a non-TOON ILPv4 node does not work, and the encoding is the
*last* of five reasons: `data` is sealed to the terminating connector, the
fulfilment is derived rather than supplied, there is no route discovery, there
is no quoting, and there is no transport layer. Fixing three bytes would change
none of that.

## What is faithful

The three packet types and their field sets; type bytes 12, 13 and 14;
**`condition = sha256(fulfilment)`** — the hash of the *fulfilment*, never of the
data; the `F`/`T`/`R` class semantics as instructions to a sender; the
three-character ASCII code shape; an empty `triggeredBy` on a REJECT; and the
rule that an ILP outcome is never an HTTP one — a FULFILL and a REJECT both ride
HTTP 200.

## What diverges, beyond the bytes

- **`data` is not end-to-end application data.** It is a gift wrap sealed to the
  **terminating connector's** identity key — `0x01 ‖ 65-byte ephemeral secp256k1
  public key ‖ AEAD(32-byte shared secret ‖ OER request envelope)` — sealed by
  ECDH against the key at `GET /ilp/identity`
  ([ADR 0018](https://github.com/toon-protocol/connector/blob/main/docs/adr/0018-a-payload-is-sealed-to-the-terminating-connector.md)).
  A forwarding hop sees bytes it cannot open. **The connector never parses the
  payload**: no TOON parse, no signature check, no event-kind dispatch anywhere
  on the packet path.
- **The condition is not a shared secret — the termination derives the
  fulfilment.** No preimage is supplied from outside and no fulfilment header
  exists
  ([ADR 0019](https://github.com/toon-protocol/connector/blob/main/docs/adr/0019-a-terminating-connector-derives-the-fulfilment.md)).
- **A PREPARE carries its covering claim.** RFC 0027 has no notion of one. The
  claim rides the carriage — BTP `payment-channel-claim` protocol data, or the
  `ILP-Payment-Channel-Claim` header — and an uncovered arrival is `F06`
  ([ADR 0042](https://github.com/toon-protocol/connector/blob/main/docs/adr/0042-a-packet-carries-its-claim.md)).
- **No exchange rate is applied to `amount`.** The connector subtracts a flat
  per-packet **fee attached to the peering** and nothing else
  ([ADR 0061](https://github.com/toon-protocol/connector/blob/main/docs/adr/0061-a-fee-attaches-to-a-peering-not-to-a-route.md)).
  A **price** is a different thing: it belongs to a *terminated route* and is a
  schedule over payload length, `price + pricePerKib × ceil(sealedBytes / 1024)`
  (ADR 0065, *a price is a schedule*). Flat exactly when the slope is zero.
  Never "per-byte" — the unit is a **kibibyte**.
- **A REJECT carries the accumulated cost of the path it travelled**, beside the
  packet and never inside it — `TOON-Accumulated-Cost`, or the
  `toon-accumulated-cost` protocol-data entry. That is how a probe discovers cost
  (ADR 0011).

## Reject codes a TOON client actually sees

A code binds only where a sender must act differently on it than on its class
([ADR 0051](https://github.com/toon-protocol/connector/blob/main/docs/adr/0051-a-reject-code-binds-where-a-sender-must-act-differently.md)).

| Code | Means |
| --- | --- |
| `F03` | Invalid Amount — the claim does not cover the charge. **This is underpayment.** |
| `F06` | the arrival carried no covering claim (ADR 0042). |
| `T04` | over the peering's **cap**. The message *states the cap*, which is the only way a sender learns it (ADR 0049). Never carried, never split. |
| `R01` | RFC 0027's own case only: this hop's fee alone exceeds the arriving amount, so nothing would be forwarded (ADR 0057). |
| `F02` | nothing routes that name. |
| `T01` | the peer was not there. |

**There is no `F04`.** Underpayment is `F03`. There is no five-stage validation
pipeline (size → TOON parse → Schnorr → pricing → kind dispatch) and no
`F04`/`F06`/`F08` table — that model was never true of the connector.

A REJECT is a return value, not an exception: from `@toon-protocol/client` it
comes back as `{ fulfilled: false }` and is **never thrown**. Surface the code
and message verbatim rather than guessing. Never blind-retry a rejected packet.

## Common Topics

- ILPv4 semantics, TOON encoding — the three encoding divergences, and why they stay
- `condition = sha256(fulfilment)`; the sealed `data`; the derived fulfilment
- A PREPARE carries its covering claim; `F06` when it does not
- Fee (flat, per packet, on the peering) vs price (a schedule on a terminated route)
- The binding reject codes, and that `F04` does not exist
