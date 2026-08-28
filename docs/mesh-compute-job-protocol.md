# Mesh-Compute Job Protocol — NIP-90 kinds, `kind:31990` schema, liveness, hashlock binding

**Status:** Normative spec · **Scope:** the mesh-compute market's Nostr wire (relay plane) — job
advertisement, discovery, request, result, feedback — and its binding points into the ILP payment
wire (connector plane) · **Audience:** implementers of any child ticket under
[toon-meta#265](https://github.com/toon-protocol/toon-meta/issues/265) ("mesh-compute earning"),
across buzz, connector, and toon-client.

This is [toon-meta#266](https://github.com/toon-protocol/toon-meta/issues/266), Wave 0 of #265 —
every other child either agrees with this document or guesses, in three different repos, and a
guess in any of them is a silent interop bug that only shows up on devnet. #265 already decided
*why* the protocol is shaped this way — compute sells as a DVM, posted price with no RFQ round,
push discovery, hashlock delivery with the seller holding the preimage, reputation from ambient
job history. **This document does not re-derive any of that.** It specifies the wire: which kind
numbers, which tags, which fields on each side of the join must be byte-identical, and which
party performs each step.

The key words MUST, MUST NOT, SHOULD, and MAY are to be interpreted as in RFC 2119.

**Acceptance for this spec:** a fresh implementer can construct every event below — advertisement,
liveness, request, result, feedback — from the tag tables alone, and can point at the exact fields
that must match for the completion↔hashlock join to hold, without asking a question.

Sections 1–10 below correspond one-to-one to the ten items this document is required to specify
(toon-meta#266's "What the document must specify" list).

---

## 1. Kind allocation

### 1.1 What was checked, and when

Re-checked 2026-08-08, per epic decision 8 (NIP-90/NIP-89 kind space) and this ticket's own
instruction to re-run [`docs/factory-job-protocol.md`](factory-job-protocol.md) §1.1's checks
rather than assume the next integer is free. #263 ran the identical checks on 2026-08-03; only the
delta from that date is recorded here.

- **The NIP-90 spec itself** ([`nostr-protocol/nips/blob/master/90.md`](https://github.com/nostr-protocol/nips/blob/master/90.md),
  unchanged) reserves `5000-5999` / `6000-6999` / `7000` and defers specific kinds to a use-case
  registry.
- **The canonical registry**,
  [`nostr-protocol/data-vending-machines/tree/master/kinds`](https://github.com/nostr-protocol/data-vending-machines/tree/master/kinds).
  Re-fetched 2026-08-08: `5000, 5001, 5002, 5050, 5100, 5200, 5201, 5202, 5250, 5300, 5301, 5302,
  5303, 5400, 5500, 5900, 5901, 5905, 5970` — **byte-identical to #263's 2026-08-03 listing.**
  Nothing has been registered in `5090-5099` in the interim.
- **`data-vending-machine.org`** — still domain-parked as of #263's check; no change, not
  re-verified independently (same source, same finding, nothing to re-derive).
- **Our own allocations**, now five deep in `5090-5099`: `5094`/`5095` (store),
  `5096` (Solana gas station) and `5098` (EVM gas station) — both now in
  [toon-protocol/gas-station](https://github.com/toon-protocol/gas-station) — and `5097`/`6097`
  (factory job request/result, #263). This document takes the next slot.

  **`5098` was this document's original allocation and was wrong.** The EVM gas station shipped
  it on 2026-08-03 in store#73, five days before this document was written, and the check above
  read the public registry without re-reading our own. That is the failure mode §1.1's last line
  warns about — "don't assume the next integer is free by then" — applied to us rather than to
  someone else. Shipped code and shipped clients win a collision; the document moves. Nothing was
  deployed against the mesh-compute `5098`, so this costs a paragraph and nothing else.
- **NIP-89** ([`nostr-protocol/nips/blob/master/89.md`](https://github.com/nostr-protocol/nips/blob/master/89.md))
  reserves `kind:31990` (application handler information, parameterized-replaceable) and
  `kind:31989` (handler recommendations) generically — not DVM-specific, and not previously
  claimed by any TOON document. §3 is this document's schema for it, per #263 §1.3's own note that
  #266 owns `kind:31990`.
- **NIP-01** ([`nostr-protocol/nips/blob/master/01.md`](https://github.com/nostr-protocol/nips/blob/master/01.md))
  defines the ephemeral range generically: `20000 <= kind < 30000` are not expected to be stored by
  relays. This is a protocol-wide mechanic, not a per-vendor registry the way `5xxx`/`6xxx`/`31990`
  are — there is no external kind list to check, only this repo's own prior allocations in the
  range. Three are in use: `20032`–`20034` (rolling-swap fill/RFQ rumors, `docs/rolling-swap.md`).
  §4 allocates a kind clear of those.

### 1.2 The allocation

| Kind | Name | Formula |
|---|---|---|
| **`5099`** | Mesh-compute job request | next free slot after `5094`–`5099`, no public-registry collision in `5090-5099` |
| **`6099`** | Mesh-compute job result | `request_kind + 1000`, per the NIP-90 formula |
| `7000` | Mesh-compute job feedback (accepted / refused / completed-offer / narration) | shared feedback kind, disambiguated by the `status` tag (§6, §9) |
| **`31990`** | Mesh-compute seller advertisement | NIP-89 handler info, this document's schema (§3) |
| **`21090`** | Mesh-compute liveness | NIP-01 ephemeral range, clear of `20032`–`20034` (§4) |

If a future ticket needs a second mesh-compute job type, it takes `5099`/`6099` and re-runs §1.1's
checks — the next integer is never assumed free.

---

## 2. Push, not pull — and why the two specs differ

[`docs/factory-job-protocol.md` §1.3](factory-job-protocol.md#13-discovery-is-pull-not-push--and-stays-that-way)
already states the rule and its rationale in full, and explicitly hands this document the other
half:

> Mesh-compute (toon-meta#266) is the opposite shape, on purpose, not by drift. A mesh-compute
> buyer wants "an idle GPU somewhere" — a request with no address until a seller announces "I'm
> up, this is my price and capacity" first. That search is over a capability space, not a job
> topic, so it structurally requires a push advertisement: #266 owns the `kind:31990` schema (and
> the liveness event backing it) for exactly that reason.

This document does exactly that: reference the rationale rather than re-derive it. In one
sentence, the reason the two specs diverge is what's being discovered — a factory buyer already
has a concrete brief to broadcast (`kind:5097`, no advertisement needed); a mesh-compute buyer has
no brief a seller could pre-empt, only a capability it is searching for, so the seller must
advertise first (`kind:31990`, §3) or a buyer has nothing to address a request to at all.

**Do not harmonize the two shapes.** Factory's RFQ flow reads no `kind:31990` event, and nothing
here should make it start to.

---

## 3. `kind:31990` — Seller advertisement

Durable, replaceable (parameterized-replaceable range `30000-39999`, standard NIP-89 semantics —
latest event per pubkey+kind+`d` wins). This is the catalogue entry a buyer's capability search
finds, and the only place a stranger learns how to pay a seller it has never talked to before.

### 3.1 Tags

| Tag | Required | Format | Description |
|---|---|---|---|
| `d` | Yes | `["d", "mesh-compute"]` | Fixed identifier — one active advertisement per seller (epic decision 4: one node, one whole model at a time). Republishing with this `d` replaces the prior ad. |
| `k` | Yes | `["k", "5099"]` | The request kind this handler serves (§5.1's `kind:5099`), per generic NIP-89 semantics. |
| `model` | Yes, repeatable | `["model", "<model-id>"]` | Model(s) currently loaded and served, e.g. `"llama-3.1-70b-instruct"`. Repeat if more than one is hot. **Unverifiable — see §3.4 and the Gotchas.** |
| `context` | Yes | `["context", "<max-context-tokens>"]` | Maximum context window, in tokens, for the advertised model(s). |
| `max_tokens` | Yes | `["max_tokens", "<max-output-tokens>"]` | Ceiling on output tokens per job — the seller's own limit, not a per-job request parameter. |
| `price` | Yes | `["price", "<micro-USDC>", "usdc", "<unit>"]` | Posted rate. `<unit>` is `"job"` or `"1k-output-tokens"` — **§3.5 is an open question on which, and whether there is a floor.** |
| `seal_pubkey` | Yes | `["seal_pubkey", "<hex-secp256k1-pubkey>"]` | The seller's ADR 0018 sealing key — the key a buyer's connector seals a paying PREPARE's `data` field to. See §7. |
| `ilp_dest` | Yes | `["ilp_dest", "<ilp-address>", "<asset-code>", "<asset-scale>"]` | The seller's ILP destination address, e.g. `["ilp_dest", "g.toon.relay.<client-id>", "usdc", "6"]`. Asset is USDC at scale 6 (micro-USDC), matching every other unit in this document and in `docs/factory-job-protocol.md`. |

### 3.2 Why the sealing key and the ILP address ride this event, and nothing else

Epic decision 7, cited rather than re-derived, is the reason this event exists at all: ADR 0018
requires the buyer to seal the paying PREPARE's payload to the destination's key; ADR 0022
concludes that a NAT'd laptop cannot serve `GET /identity` to hand that key over on demand, and
that carrying a key back in-band does not survive the threat model — ADR 0022's own reasoning is
that *"hops rewrite rejects by design"* (`connector.rs:719` adds each hop's fee to a passing
reject, and any hop on the path is positioned to substitute its own key into one in flight).
**A signed Nostr event is the one thing a hop cannot rewrite.** That is what makes an unreachable
seller addressable at all, and it is why `seal_pubkey` and `ilp_dest` are tags on a signed
`kind:31990` rather than answers to a runtime query.

### 3.3 This is a client destination, not a connector

`ilp_dest` names the seller's own client session (connector#698's client session registry — a live
BTP socket, the seller's laptop), never a connector's terminating route. §7 states in full why
this distinction is load-bearing for the hashlock.

### 3.4 The advertised model is unverifiable

Epic decision 9: a seller advertising a 70B model can serve a 3B model, or a 4-bit quant of the
70B, and the completion is plausible either way. This document does not, and cannot, add a check
for it. **No downstream ticket may build UI implying the `model` tag was verified.** The only
check available to a buyer is reputation (§8) and, informally, canary prompts (§10 — non-normative,
buyer practice, not protocol).

### 3.5 Ratified — owner decision 2026-08-09 ([toon-meta#317](https://github.com/toon-protocol/toon-meta/issues/317))

> **Confirmed as written.** The owner ratified the recommendation below on 2026-08-09, explicitly over #317's own framing, which had called per-job-with-a-ceiling the likely answer and warned that a per-token unit "reintroduces metering, which decision 1 deliberately made moot". The argument that the unit must scale across the `max_tokens` range a single advertisement spans carried the decision. This section is now settled; it is no longer an open question.

Epic decision 10 settles *posted price, no RFQ*; it does not settle the unit. This is a genuine
judgment call, not a lookup — the recommendation below is written into the document and this
ticket does not block on it being confirmed.

**Recommendation: `price` unit is `"1k-output-tokens"`, with no protocol-enforced floor.**
Per-job pricing does not compose across the `max_tokens` range a single advertisement already
spans (a 50-token refusal-length answer and a 4096-token essay are not the same cost to the
seller), while a per-output-token rate scales with actual work done and lets the buyer compute an
expected cost from `max_tokens` before sending the job. A floor is left to the seller's own
`price` value rather than a protocol minimum — undercutting is a reputation and market-clearing
problem, not a wire-format one.

This does not need to be settled through the payment leg either way: a route's price is transport,
a different unit entirely from the inference `price` advertised here (per toon-meta#261:
**two currencies never sum**). Concretely, `g.toon.relay` terminates at `1` µUSDC and the store's
`g.toon.store` on a `base = 1000, per_kib = 10` schedule — but take those from the node, not from
here: the authority is each node repo's own `deploy/` bundle (ADR 0068) and its live `GET /ilp`.
`connector/docs/devnet-pricing.md` is history rather than a price list (connector#1250), and the
store answers `g.toon.store`, never `g.toon.ario`, which is only a box label. The point that survives
whatever the figures are is that this is the transport fee, not the inference `price`
advertised here (per toon-meta#261: **two currencies never sum**). A job's ILP packet(s) pay the
connector's per-packet routing fee regardless of `price`'s unit; `price` is the separate, job-level
amount carried in the `amount` tag of §6.2's completed-offer, exactly as
`docs/factory-job-protocol.md` keeps its `bid`/`amount` tags distinct from relay write pricing
(its §4.3, `docs/protocol.md` §Protocol Economics).

---

## 4. `kind:21090` — Liveness

Ephemeral (NIP-01, `20000 <= kind < 30000` — not persisted, not replaceable, nothing to
unpublish). NIP-90 has no liveness concept because it assumes a DVM is an always-on server; a
mesh-compute seller is a laptop that sleeps, and `kind:31990` is durable, so a seller who closes
the lid would otherwise sit in the catalogue looking available indefinitely. This event is the fix,
reusing buzz's proven timing pair (`desktop/src-tauri/src/mesh_llm/coordinator.rs`,
`.../discovery.rs`) rather than picking new numbers: **45 s publish interval, 120 s routing
freshness window** — routing ignores a seller whose most recent liveness event is older than 120 s,
so a crashed or offline laptop drops out of routing without any relay-side cleanup job.

**Do not reuse `KIND_BUZZ_MESH_MEMBER_STATUS` (kind `30003`).** That event is the *community*
mesh's roster-gated discovery — a different plane, out of scope per epic decision 3. This document
allocates a new kind (`21090`, §1.1) for the open-market plane: same shape and timing, different
event, different trust boundary.

### 4.1 Tags

| Tag | Required | Format | Description |
|---|---|---|---|
| `d` | No | — | None. Ephemeral events are not replaceable; there is nothing to key on. A subscriber tracks freshness by `created_at` of the newest event seen from a given pubkey, not by replacement. |
| `status` | Yes | `["status", "up"]` | Fixed value. The event's existence and recency are the signal; there is no other state to carry. |

Content: empty string. The seller's pubkey (the event's `pubkey` field) is the correlation key back
to its `kind:31990` advertisement — one seller, one identity, both events.

### 4.2 Freshness ≤ lease

**This number is TOON's own choice, not a number carried by any connector-plane ticket.**
[connector#698](https://github.com/toon-protocol/connector/issues/698) (client session registry,
closed) establishes the *invariant* — a short reconnect-grace TTL exists only as a backstop for
half-open sockets, and *"the relay's provider-freshness window must never exceed this lease"* — but
its own text leaves the number to whoever picks it, deferring to "whatever backstop TTL you pick."
120 s here is buzz's already-proven number for the identical problem (routing freshness on a
sleeping laptop), reused rather than re-derived. **Implementers MUST confirm connector#698's actual
client session TTL is ≥ 120 s before deploying**; if it is shorter, a seller can look live on the
relay after it has already dropped off the connector, and a buyer pays for a job that cannot land.

---

## 5. `kind:5099` — Job request

### 5.1 Tags

| Tag | Required | Format | Description |
|---|---|---|---|
| `i` | Yes | `["i", "<prompt>", "text"]` or `["i", "<nip44-ciphertext>", "text"]` with `encrypted` present | The prompt. Sealed per §8's recommended split — see there before assuming plaintext. |
| `p` | Yes | `["p", "<seller-pubkey>"]` | The targeted seller — always present. Unlike factory's open broadcast RFQ, a mesh-compute buyer has already picked one seller from its `kind:31990` capability search (§2); there is no broadcast form of this event. |
| `model` | Yes | `["model", "<model-id>"]` | MUST match one of the seller's advertised `model` tags (§3.1) at request time — the buyer names the model it is paying to run, from the seller's own published menu. |
| `max_tokens` | Yes | `["max_tokens", "<n>"]` | Requested output ceiling for this job. MUST NOT exceed the seller's advertised `max_tokens` (§3.1) — a request above it is malformed, not a negotiation. |
| `price_accept` | Yes | `["price_accept", "<micro-USDC>", "usdc", "<unit>"]` | The buyer's acceptance of the seller's currently posted `price` (§3.1), copied byte-for-byte from the `kind:31990` the buyer read. This is how the buyer names its price acceptance (posted price, no RFQ round, epic decision 10) — not an offer, not a counter, an echo that pins which advertised rate the buyer is paying against if the seller's price changes between the buyer's read and the seller's next refresh. |
| `encrypted` | No | `["encrypted"]` | Present only when the `i` tag carries NIP-44 ciphertext (§8). |

### 5.2 Which relay

Published to **`g.toon.relay`** — the open market relay of
[toon-meta#262](https://github.com/toon-protocol/toon-meta/issues/262) decision 2, the same relay
factory jobs use (`docs/factory-job-protocol.md` §1.3) and the same relay the seller's `kind:31990`
and `kind:21090` events are published to. There is one open market, not a second relay for compute;
every implementer targets this one address (`docs/two-node-architecture.md` confirms
`g.toon.relay` as the live terminating address for the relay box).

### 5.3 No accept message, and no RFQ

Per epic decision 10, `price_accept` in the request **is** the buyer's commitment to that job at
that rate — there is no separate offer/counter-offer cycle the way factory's `kind:7000
status:"quote"` (its §3) exists for milestone pricing. A seller that cannot honor the request
refuses promptly (§9.2) rather than negotiating.

---

## 6. Hashlock binding

### 6.1 The mechanism

Decision 5 of #262 (delivery by hashlock) applies here unchanged; the ticket asks specifically
that this document **share the helper contract** `toon-client#495` already shipped
(`packages/client/src/hashlock-delivery.ts`) rather than defining a second one:

- `encryptArtifact(artifact: Uint8Array): EncryptedArtifact` — the **seller** side. Takes only
  the plaintext completion bytes; mints a fresh 32-byte symmetric key, encrypts with
  ChaCha20-Poly1305, and returns `{ ciphertext, key, condition }` where
  `condition = sha256(key)`. A caller cannot mint a mismatched key/condition pair — there is no
  parameter that lets it try.
- `fulfillIncrement(key: Uint8Array): Uint8Array` — reveals `key` as the ILP fulfillment. The key
  *is* the fulfillment, by identity, not by derivation from anything else.
- `decryptArtifact(ciphertext, key, paidCondition): Uint8Array` — the **buyer** side. Verifies
  `sha256(key) === paidCondition` before decrypting, where `paidCondition` MUST come from the
  buyer's own PREPARE's `executionCondition` — never re-derived from the just-revealed key.
  Throws `HashlockConditionMismatchError` / `HashlockDecryptError` on failure.

**Where the key is revealed:** as the ILP `fulfillment` on the FULFILL packet that releases the
seller's claim (§7, step 6) — the same instant the buyer becomes able to decrypt. Revealing `key`
to satisfy the payment condition and handing the buyer the decryption key are the same act, in the
same packet. Neither party moves first, because there is no first: the buyer cannot decrypt
without paying (no `key` released until fulfilment), and the seller cannot get paid without
releasing `key` (a zero/placeholder condition is rejected outright, #417).

### 6.2 `kind:7000 status:"completed-offer"` — where `condition` binds to the completion

**This is the join between the relay plane and the connector plane, and the most important tag
table in this document.** Published once, when the seller has already produced the completion,
encrypted it via §6.1's `encryptArtifact()`, and is ready to be paid for it.

| Tag | Required | Format | Description |
|---|---|---|---|
| `e` | Yes | `["e", "<kind:5099 event id>", "<relay-hint>", "root"]` | The job request. |
| `e` | Yes | `["e", "<kind:7000 accepted-event id>", "<relay-hint>", "reply"]` | The acceptance (§9.1). |
| `p` | Yes | `["p", "<buyer-pubkey>"]` | |
| `status` | Yes | `["status", "completed-offer"]` | |
| `amount` | Yes | `["amount", "<micro-USDC>", "usdc"]` | The job's price, computed from the seller's `price` (§3.1) and, if the unit is `"1k-output-tokens"` (§3.5's recommendation), the actual output length. MUST be derivable by the buyer from public information — no surprise billing. |
| `condition` | Yes | `["condition", "<sha256-hex-of-key>"]` | `sha256(key)` from §6.1. **The join, both directions**: the buyer's PREPARE's `executionCondition` MUST equal this value byte for byte (RFC-0022, `connector-domain/src/condition.rs`; `connector.rs:523` already rejects a zero condition, #417 — no placeholder is possible on this path), and the PREPARE's `data` field MUST carry this event's id, so anyone inspecting the payment alone can identify which job it paid for. |
| content | Yes | base64 ciphertext | **The completion itself, encrypted, inline.** Unlike factory's milestone artifacts (which go to Arweave, decision 13 of #262), epic decision 6 is explicit that *"for compute the completion is the payload"* — there is no receipt-to-an-external-store step. An LLM completion within the seller's advertised `max_tokens` (§3.1) fits comfortably inside the relay's per-event write cap (256 KB content, 64 KB advertised in NIP-11 — `docs/factory-job-protocol.md` §4.1's citation of the same constraint applies verbatim here). A seller whose ciphertext would exceed the cap MUST refuse (§9.2) rather than truncate. |

---

## 7. Sealing at a client destination — who does what, in order

**Say this explicitly, because it is the natural wrong assumption.** ADR 0018 seals a PREPARE's
payload "to the terminating **connector**," and ADR 0019 has that connector derive the fulfilment
from the resulting shared secret. Under epic decision 6 the seller is a **BTP client that is
itself the destination and holds the preimage** — so both ADRs' subject changes. If a connector
along the path treats this destination as a normal route termination and derives a fulfilment per
ADR 0019, **the hashlock silently disappears**: the buyer would be trusting that connector operator
not to take payment and return junk, exactly the failure
[connector#902](https://github.com/toon-protocol/connector/issues/902) and
[toon-client#537](https://github.com/toon-protocol/toon-client/issues/537) exist to close on the
connector and client sides respectively. This document states the boundary those tickets implement
against.

**In order, for one job:**

1. **Seller** picks a symmetric key and encrypts the completion via `encryptArtifact()` (§6.1) →
   `{ ciphertext, key, condition }`.
2. **Seller** publishes `kind:7000 status:"completed-offer"` (§6.2): `condition` = the value from
   step 1, `amount` = the job's price, content = `ciphertext`.
3. **Buyer's connector** builds an ILP PREPARE addressed to the seller's `ilp_dest` (§3.1):
   `executionCondition` = the `condition` tag's value, byte for byte. Its `data` field is sealed
   (ADR 0018) to the seller's `seal_pubkey` (§3.1), naming the `kind:7000` event id being paid for.
4. **Buyer's connector** sends the PREPARE toward `ilp_dest`. Per connector#902's boundary, any
   connector on the path that resolves this destination to a live client session
   (connector#698's lease) MUST forward the PREPARE to that session and **MUST NOT** locally
   terminate it or synthesize/derive a fulfilment for it — that would be ADR 0019's rule, and
   ADR 0019 governs route terminations, not client destinations (connector#902's scope
   clarification).
5. **Seller** (the BTP client itself, not any connector) receives the forwarded PREPARE, unseals
   its `data` field with its own private key — the counterpart to the `seal_pubkey` it
   advertised — to authenticate and read the job reference inside.
6. **Seller** supplies the ILP fulfilment via `fulfillIncrement(key)` (§6.1), returning the *same*
   `key` it generated in step 1. This is **not** a value derived from the ADR 0018 shared
   secret — the seller already holds `key` from having encrypted the completion with it; sealing
   in steps 3–5 provides confidentiality and authenticity for the PREPARE's payload, and is a
   mechanism separate from the hashlock preimage.
7. **Buyer's connector** checks `sha256(fulfillment) == executionCondition`, accepts the claim.
8. **Buyer** decrypts via `decryptArtifact(ciphertext, key, paidCondition)` (§6.1), with
   `paidCondition` taken from its own PREPARE's `executionCondition`.

Nothing about the connector's internal representation of the client session or the claim ledger is
specified here — that is connector-plane implementation, owned by connector#697/#698/#699 and the
tickets above. This document pins only the two fields that must agree byte-for-byte across the two
planes: `condition`/`executionCondition`, and the `kind:7000` event id carried in the PREPARE's
sealed `data` (§6.2).

---

## 8. What is publicly observable

Epic decision 9 makes reputation the only judge of quality; #262 decision 8 defines reputation as
*ambient job history* — a byproduct of the protocol, never something anyone is asked for. That only
works if enough of the job's shape is readable on the relay to compute it from. At the same time,
the product pitch (buzz's `VISION_MESH.md`) is that *"an agent on your relay isn't reaching out to
a vendor with your prompts and your credit card"* — which argues for hiding the prompt. These pull
in opposite directions, and this is the one place in the document where they must both be answered.

### 8.1 Ratified — owner decision 2026-08-09 ([toon-meta#317](https://github.com/toon-protocol/toon-meta/issues/317))

> **Confirmed as written.** The owner ratified the split below on 2026-08-09, accepting the stated cost: the public envelope leaks who bought from whom, when, how often, and against which advertised model. That is the price of ambient reputation (#265 decision 9 — reputation is the only judge of quality), and it was paid knowingly. This section is now settled; it is no longer an open question.

**Recommendation: public envelope, sealed content — never a full NIP-59 gift wrap.** A full gift
wrap (as `docs/factory-job-protocol.md` §2.2 uses for a targeted private brief) hides the entire
event behind an ephemeral pubkey, including whether a mesh-compute job happened at all — that
would erase the ambient-reputation signal completely, not just the prompt. Instead:

| Event | Public envelope (tags, timestamps, pubkeys) | Sealed / opaque content |
|---|---|---|
| `kind:31990` advertisement (§3) | Everything — it is an ad. | None. |
| `kind:21090` liveness (§4) | Everything — routing needs it. | None. |
| `kind:5099` request (§5) | `p` (both pubkeys via event author + tag), `model`, `max_tokens`, `price_accept`, `created_at`. | The `i` tag's prompt — NIP-44 encrypted to the seller's pubkey when `encrypted` is present (§5.1), reusing the "Encrypted Job Requests" pattern generic NIP-90 already defines (`skills/dvm-protocol/references/nip-spec.md`), not a full gift wrap. |
| `kind:7000` feedback (§6, §9) | `status`, `reason` (refusals), `amount`, `condition`, timestamps. | The `completed-offer`'s content — hashlock ciphertext, already opaque for delivery reasons (§6.2), doing double duty as privacy. |
| `kind:6099` result (§9.3) | `outcome`, timestamps, both pubkeys. | Nothing new — points back at the same offer, carries no separate payload. |

**What leaks under this split:** which pubkey paid which pubkey, when, how much, against which
advertised model, and whether the job completed, refused, or stalled. **What does not leak:** the
prompt's content, and the completion's content (readable only by whoever holds `key`, i.e. the
buyer, post-payment). This is the reconciliation the ticket asks for: the fact of a completed job
is observable (feeds reputation); its substance is not (the sovereignty pitch).

Model provenance is unverifiable regardless of this split (§3.4) — encrypting the prompt does not
change that a buyer cannot confirm which model actually answered it.

---

## 9. The failure taxonomy

Three named `kind:7000` statuses cover a job's non-terminal life; none of them is a negotiation —
mesh-compute has no RFQ and no milestones (epic decision 10; contrast
`docs/factory-job-protocol.md` §3–§4, whose `quote`/`partial` cycle this document deliberately does
not reuse). §6.2 above already specifies `completed-offer`; the other two are below.

### 9.1 `status:"accepted"` — prompt acknowledgment

Published immediately on receiving a `kind:5099` the seller intends to serve. Carries no `amount`
or `condition` — it is a promise to do the work, not a payable offer.

| Tag | Required | Format |
|---|---|---|
| `e` | Yes | `["e", "<kind:5099 event id>", "<relay-hint>", "root"]` |
| `p` | Yes | `["p", "<buyer-pubkey>"]` |
| `status` | Yes | `["status", "accepted"]` |

### 9.2 `status:"refused"` — the taxonomy proper

**A refusal MUST be prompt.** Per the ticket: *"a buyer waiting on a timeout is worse for the
seller's reputation than a fast decline."* This is what buyer retry logic reads.

| Tag | Required | Format | Description |
|---|---|---|---|
| `e` | Yes | `["e", "<kind:5099 event id>", "<relay-hint>", "root"]` | |
| `p` | Yes | `["p", "<buyer-pubkey>"]` | |
| `status` | Yes | `["status", "refused"]` | |
| `reason` | Yes | `["reason", "vram-exhausted" \| "model-not-loaded" \| "context-exceeded"]` | The three cases the ticket names. `content` MAY carry free-text elaboration; `reason` is the machine-readable field retry logic keys on. |

Narration (`status:"processing"`) is available under the same rules as
`docs/factory-job-protocol.md` §6 — free, public, carries no `amount`/`condition`/completion
content, and a client encountering `processing` with any of those tags MUST treat it as malformed
and MUST NOT pay against it.

### 9.3 `kind:6099` — Job result, and the terminal outcomes

Published once a job reaches a terminal state, mirroring `docs/factory-job-protocol.md` §5's
three-outcome model, adapted to mesh-compute's single-shot shape (no milestones to partially
complete) and its prompt-refusal path (§9.2), which factory's shape has no equivalent for.

| Tag | Required | Format | Description |
|---|---|---|---|
| `e` | Yes | `["e", "<kind:5099 event id>", "<relay-hint>", "root"]` | |
| `e` | Yes | `["e", "<last kind:7000 event id>", "<relay-hint>", "reply"]` | The `completed-offer` (completed) or the last `accepted`/`refused` event before a stall (abandoned). |
| `p` | Yes | `["p", "<buyer-pubkey>"]` | |
| `request` | Yes | `["request", "<kind:5099 event JSON>"]` | The full original request, for verification (generic NIP-90 kind:6xxx convention). |
| `outcome` | Yes | `["outcome", "completed" \| "refused" \| "abandoned-provider" \| "abandoned-buyer"]` | The terminal state — exactly these four. |

Outcome semantics:

- **`completed`** — the seller's `completed-offer` was paid (§7 steps 3–7). Reputation-positive.
- **`refused`** — the seller declined promptly at request time (§9.2). Not a failure of the
  protocol; a fast, honest decline is the behavior §9.2 asks for.
- **`abandoned-provider`** — the seller accepted (§9.1) and then went silent before publishing a
  `completed-offer`. No completion exists.
- **`abandoned-buyer`** — the seller published a `completed-offer` and the buyer never paid it. No
  decryption occurred; the seller is recording the stall.

How long a buyer may take to pay a `completed-offer` before a seller may record `abandoned-buyer`
is a buyer/seller timeout convention, not a protocol field, and is deliberately left unspecified
here (see the explicit non-goals below).

---

## 10. Appendix (non-normative) — buyer practice: canary prompts

Epic decision 9 accepts that the advertised model (§3.4) is unverifiable by protocol means. Cheap
prompts whose answers differ sharply between model sizes or families — a **canary prompt** — are
documented buyer practice for narrowing that gap informally, **not** a protocol feature. `buzz#94`
explicitly defers them to documentation rather than a verification badge, and no other ticket owns
this text, so it lives here. A buyer MAY, before or alongside a real job, send a small, cheap
`kind:5099` whose expected answer it already knows for the model class it is paying for, and treat
a wildly wrong answer as a reputation signal to weigh going forward. This is advice, not a wire
format — nothing above changes to accommodate it, and no client is required to implement it.

---

## Gotchas

- **Freshness ≤ lease.** §4.2 states this in full: 120 s routing freshness (§4) MUST NOT exceed
  the connector's actual client-session lease
  ([connector#698](https://github.com/toon-protocol/connector/issues/698)), or buyers pay for jobs
  that cannot land. connector#698's own text leaves the number unspecified — do not attribute a
  specific TTL to that ticket; the 45 s/120 s pair is buzz's, reused here by choice.
- **Do not re-specify the payment leg.** Money is ILP over BTP and is already specified elsewhere;
  this document says which packet carries what (§7), never how a claim, a channel, or settlement
  works.
- **The advertised model is unverifiable** (§3.4, epic decision 9). No downstream ticket may imply
  otherwise in UI.
- **Do not reuse `KIND_BUZZ_MESH_MEMBER_STATUS` (kind `30003`).** §4 allocates `21090` instead —
  same shape, different event, different plane (the community mesh's roster-gated discovery stays
  out of scope, epic decision 3).
- **The buyer never joins the mesh** (epic decision 2). Nothing in this document describes an iroh
  endpoint, a mesh address, or an admission step. The `kind:5099`/`kind:31990` wire above is the
  entire buyer-visible surface; the DVM is the door.

---

## Explicit non-goals

- **Re-deriving why the wire is shaped this way.** #265 records eleven decisions with rationale;
  this document only specifies the resulting bytes.
- **Claim, watermark, or settlement behaviour.** Owned by the connector-plane tickets §7
  references (connector#697/#698/#699 and the prepaid-window work, connector#709) — none of it is
  specified here.
- **Sharded/multi-node sellers, mesh admission internals, iroh transport.** Epic decisions 2–4
  keep the seller as one node running one whole model with mesh admission locked to itself; nothing
  above assumes otherwise.
- **A numeric payment timeout for `abandoned-buyer`/`abandoned-provider`** (§9.3) — left to
  implementation convention, not a protocol field.
- **Attested inference, TEEs, proof-of-inference.** Explicitly out of scope per epic decision 9.

---

## Related

- [toon-meta#265](https://github.com/toon-protocol/toon-meta/issues/265) — epic: mesh-compute
  earning (all eleven decisions this spec implements)
- [toon-meta#266](https://github.com/toon-protocol/toon-meta/issues/266) — this document's own
  ticket
- [toon-meta#262](https://github.com/toon-protocol/toon-meta/issues/262) — the sibling epic (agents
  earning) whose decisions 2 (`g.toon.relay`), 4 (kind space) and 8 (reputation) this document
  reuses rather than re-deriving
- [`docs/factory-job-protocol.md`](factory-job-protocol.md) — the format precedent and the source
  of §1.1's checks, §1.3's/§2's pull/push rationale, and the hashlock pattern §6–§7 adapt
- [toon-meta#317](https://github.com/toon-protocol/toon-meta/issues/317) — owner decisions queue
  for §3.5 (price unit) and §8.1 (privacy split)
- [toon-client#495](https://github.com/toon-protocol/toon-client/issues/495) (closed) —
  `hashlock-delivery.ts`, the helper contract §6.1 reuses rather than redefining
- [toon-client#537](https://github.com/toon-protocol/toon-client/issues/537) — client-side
  implementation of §7's sealing/unsealing boundary
- [connector#902](https://github.com/toon-protocol/connector/issues/902) — connector-side
  implementation of the same boundary, from the other end
- [connector#698](https://github.com/toon-protocol/connector/issues/698) (closed) — client session
  registry; the source of the freshness-≤-lease invariant in §4.2
- `skills/dvm-protocol/references/nip-spec.md` — generic NIP-90 kind/tag reference this spec
  extends
- `skills/app-handlers/references/nip-spec.md` — generic NIP-89 `kind:31990` reference §3 extends
- `skills/rfc-0022-hashed-timelock-agreements` — the hashlock primitive §6 relies on
- `docs/two-node-architecture.md` — confirms `g.toon.relay` as the live open-market relay address
  used in §5.2
- `docs/protocol.md` — per-byte relay write pricing that bounds §6.2's inline completion size
