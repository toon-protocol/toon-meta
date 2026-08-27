# Factory Job Protocol — NIP-90 kinds, tags, increment↔hashlock binding

**Status:** Normative spec · **Scope:** the factory job market's Nostr wire (relay plane) and its
binding points into the ILP payment wire (connector plane) · **Audience:** implementers of any of
the sixteen tickets under
[toon-meta#262](https://github.com/toon-protocol/toon-meta/issues/262) ("agents earning"), across
buzz, connector, store, and toon-client.

This is the first ticket of #262 and every other child builds against the wire it fixes
([toon-meta#263](https://github.com/toon-protocol/toon-meta/issues/263)). #262 already decided
*why* the protocol is shaped this way — two planes joined by reference, RFQ pricing, milestone
increments, hashlock delivery, reputation from ambient history. **This document does not
re-derive any of that.** It specifies the wire: which kind numbers, which tags, which fields on
each side of the join must be byte-identical.

The key words MUST, MUST NOT, SHOULD, and MAY are to be interpreted as in RFC 2119.

**Acceptance for this spec:** a fresh implementer can construct every event in this document,
and can point at the exact two fields (one Nostr tag, one ILP packet field) that must match for
the increment↔hashlock join to hold, without asking a question. If you find yourself asking one,
that is a bug in this document — file it.

---

## 1. Kind allocation

### 1.1 What was checked, and when

Checked 2026-08-03, per #262 decision 4 (NIP-90 kind space, not buzz's `43001–43006`):

- **The NIP-90 spec itself** ([`nostr-protocol/nips/blob/master/90.md`](https://github.com/nostr-protocol/nips/blob/master/90.md))
  reserves `5000-5999` (job requests) / `6000-6999` (job results) / `7000` (job feedback) and
  enumerates no specific kinds — it defers to a use-case registry.
- **The canonical registry it points to**,
  [`nostr-protocol/data-vending-machines/tree/master/kinds`](https://github.com/nostr-protocol/data-vending-machines/tree/master/kinds).
  Full listing at time of check: `5000, 5001, 5002, 5050, 5100, 5200, 5201, 5202, 5250, 5300,
  5301, 5302, 5303, 5400, 5500, 5900, 5901, 5905, 5970`. **Nothing is registered in `5090-5099`.**
- **`data-vending-machine.org`** — domain-parked (Namecheap auction page) as of this check; it no
  longer hosts a kind list and is not a usable source of truth.
- **Our own allocations.** The store already ships `5094` (Arweave blob storage), `5095` (ArNS
  buy), `5096` (Solana gas station) — see `docs/deployment.md`, `docs/handoff-arweave-dvm-deploy.md`,
  `docs/rfc-peering-naming.md`, `context/glossary.md`. `5250` ("Dungeon" compute DVM) was removed
  from TOON entirely and is not a collision to worry about (see
  `skills/dvm-protocol/references/nip-spec.md`).

### 1.2 The allocation

| Kind | Name | Formula |
|---|---|---|
| **`5097`** | Factory job request | next free slot after `5094`/`5095`/`5096`, no public-registry collision in `5090-5099` |
| **`6097`** | Factory job result | `request_kind + 1000`, per the NIP-90 formula — not a second arbitrary allocation |
| `7000` | Factory job feedback (quote / increment offer / narration) | shared feedback kind, disambiguated by the `status` tag (§3, §4, §6) |

If a future ticket needs a second factory job type, it re-runs §1.1's checks and takes the next
slot the registry — ours included — actually shows free. **Not `5098`**: the EVM gas station took
that on 2026-08-03 (store#73, now toon-protocol/gas-station). This sentence used to name `5098`
as the obvious next one, which is exactly the assumption its own second clause warns against.

### 1.3 Discovery is pull, not push — and stays that way

Factory job discovery is deliberately pull-based: a provider learns about a job by subscribing to
`kind:5097` on the open market relay (decision 2) and reading the broadcast brief. There is **no
`kind:31990` announcement** — no event through which a provider advertises its existence,
capabilities, or price. This is not an oversight; #262's "Deliberately parked" section names
`kind:31990` advertising explicitly, and it stays parked for factory jobs specifically. This
section records why, so the divergence from mesh-compute (below) is a documented decision rather
than an inconsistency someone "fixes" later.

The reason is what's being discovered. A factory buyer already has a concrete brief — a repo, a
ticket, a scope — and posting `kind:5097` to the shared relay reaches every candidate provider in
one write (decision 2's open market). There is nothing a provider could pre-advertise that would
let a buyer find them faster, because the buyer isn't searching a capability space; it is posting
a job, the same way an order book doesn't need resting sellers to announce themselves before an
order can be placed.

**Mesh-compute ([toon-meta#266](https://github.com/toon-protocol/toon-meta/issues/266)) is the
opposite shape, on purpose, not by drift.** A mesh-compute buyer wants "an idle GPU somewhere" —
a request with no address until a seller announces "I'm up, this is my price and capacity" first.
That search is over a capability space, not a job topic, so it structurally requires a push
advertisement: #266 owns the `kind:31990` schema (and the liveness event backing it) for exactly
that reason.

**Do not harmonize these.** Nothing in the factory RFQ flow (§3) reads a `kind:31990` event —
quotes exist only in response to a posted `kind:5097` — so adding one for factory providers would
create a second, untied path to the same market. #266 should reference this section rather than
re-derive the pull-vs-push rationale.

---

## 2. kind:5097 — Job request (the brief)

### 2.1 Tags

| Tag | Required | Format | Description |
|---|---|---|---|
| `i` | Yes | `["i", "<brief>", "text"]` | The brief. Free text (or a reference — see §2.3 for milestone chaining). |
| `bid` | Yes | `["bid", "<micro-USDC>", "usdc"]` | **Maximum** the buyer will pay across the whole job, not per increment. TOON has no lightning/millisats leg (see `skills/rfc-0022-hashed-timelock-agreements`), so this reuses kind:5094's `usdc`-unit convention, not generic NIP-90's millisats. |
| `param` | No, repeatable | `["param", "repo", "<owner/repo>"]` | Target repo, e.g. `toon-protocol/buzz`. |
| `param` | No, repeatable | `["param", "target", "<ticket-ref>"]` | The ticket/issue this job resolves, e.g. `buzz#56`. |
| `param` | No, repeatable | `["param", "constraints", "<free text or JSON>"]` | Gate requirements, scope limits, anything a provider needs to quote accurately. |
| `output` | No | `["output", "<mime-type>"]` | Expected deliverable shape, e.g. `application/json` for a structured PR manifest. |
| `p` | No | `["p", "<provider-pubkey>"]` | Target a specific provider. Omit to broadcast for open RFQ (the common case — decision 2's open market needs multiple providers to see the brief to quote). |
| `encrypted` | No | `["encrypted"]` | Present only on a NIP-59 rumor (§2.2) — never on a directly published, plaintext kind:5097. |

**The `bid` tag is a maximum, not an offer.** A provider quoting above it is out of the running —
there is no negotiation up from `bid`, only quotes at or under it (§3).

### 2.2 Private briefs — NIP-59 gift wrap

Per decision 1, the relay MUST see neither content nor sender for a private brief. This only
composes with a **targeted** brief (a `p` tag naming one provider) — encrypting content to a
single recipient is meaningless for an open broadcast RFQ, which requires every candidate
provider to read the brief to quote on it. A private brief is therefore a buyer skipping the open
RFQ for a specific, already-known provider (e.g. one with established reputation, §5).

Construction (reuse, don't reinvent — `connector-signer/src/nip59.rs` already implements this
exact rumor → seal → gift wrap chain with ChaCha20-Poly1305 and an ephemeral outer key):

1. **Rumor** — the kind:5097 event above, fully formed but **unsigned** (no `id`/`sig`), exactly
   as NIP-17's kind:14 rumor is never signed (`skills/private-dms/references/nip-spec.md`).
2. **Seal** (kind:13) — the rumor NIP-44-encrypted from buyer to the targeted provider, signed
   by the buyer's real key, randomized `created_at`.
3. **Gift wrap** (kind:1059) — the seal encrypted again under a fresh ephemeral key, signed by
   that ephemeral key, `["p", "<provider-pubkey>"]` tag, randomized `created_at`. **This is the
   only event that reaches the relay.**

The relay sees a kind:1059 event with an ephemeral pubkey and no readable content — it cannot
determine the brief, the bid, or the real buyer. Only the targeted provider can unwrap it.

### 2.3 Chaining milestones

Decision 6 puts milestone boundaries at factory phases (plan → implement ×N tickets → review).
NIP-90 already defines job pipelining for exactly this: a kind:5097 request for milestone *k+1*
MAY carry `["i", "<milestone-k's kind:6097 result event id>", "job"]` instead of a fresh text
brief, chaining onto the prior milestone's delivered result. Each milestone is still a fully
independent request/quote/increment-offer/result cycle (§3–§5) — pipelining only says where the
next brief's content comes from, not that milestones share payment state.

---

## 3. kind:7000, `status:"quote"` — the RFQ reply (provider → buyer)

Published before any work happens — proposes terms, commits nothing.

### 3.1 Tags

| Tag | Required | Format |
|---|---|---|
| `e` | Yes | `["e", "<kind:5097 event id>", "<relay-hint>", "root"]` |
| `p` | Yes | `["p", "<buyer-pubkey>"]` |
| `status` | Yes | `["status", "quote"]` |

### 3.2 Content — the increment schedule

```json
{
  "increments": [
    { "n": 1, "of": 3, "milestone": "plan",      "priceUsdc": "500000" },
    { "n": 2, "of": 3, "milestone": "implement", "priceUsdc": "4000000" },
    { "n": 3, "of": 3, "milestone": "review",    "priceUsdc": "500000" }
  ]
}
```

Sum of `priceUsdc` SHOULD be ≤ the brief's `bid` — a schedule that sums above it is a quote the
buyer has no protocol-level reason to accept, since `bid` is a hard ceiling (§2.1).

### 3.3 There is no accept message

Per decision 7: **acceptance is payment of increment 1.** A buyer signals interest in a quote by
letting the quoted provider proceed to §4 for increment 1 and then paying that increment-1
offer — there is no separate "I accept this quote" event, and no signing ceremony beyond the
payment claim itself. Implementers MUST NOT add one. (A buyer MAY narrate which quote it intends
to pay via a free-narration reply, §6 — but that is a courtesy, not a protocol requirement, and
carries no binding weight; only payment of an increment-1 offer does.)

---

## 4. kind:7000, `status:"partial"` — the increment offer

**This is the join between the relay plane and the connector plane, and the most important
paragraph in this document.** One of these events exists per increment, published once the
provider has done that increment's work and uploaded the encrypted artifact.

### 4.1 Tags

| Tag | Required | Format | Description |
|---|---|---|---|
| `e` | Yes | `["e", "<kind:5097 event id>", "<relay-hint>", "root"]` | The job request. |
| `e` | Yes | `["e", "<direct-parent event id>", "<relay-hint>", "reply"]` | The quote (§3) for increment 1; the *previous* increment's offer for increment ≥ 2 (NIP-10 marker convention, `skills/nostr-protocol-core`). |
| `p` | Yes | `["p", "<buyer-pubkey>"]` | |
| `status` | Yes | `["status", "partial"]` | |
| `increment` | Yes | `["increment", "<n>", "<of>"]` | Which increment this is, out of the quoted total. |
| `i` | Yes | `["i", "<arweave-tx-id>", "url"]` | Where the **encrypted** artifact lives. Per decision 13, the artifact never rides in the event — buzz's relay caps event content at 256 KB and advertises 64 KB in NIP-11 (`skills/git-collaboration/references/kind-5094-blob-storage.md` documents the identical constraint for kind:5094). |
| `i` | SHOULD | `["i", "<sha256-of-ciphertext>", "text", "", "hash"]` | Integrity hash of the ciphertext at that txid, so the buyer can detect a corrupted/wrong fetch before attempting decryption — same idiom as kind:6094 (`skills/dvm-protocol/references/nip-spec.md`). |
| `amount` | Yes | `["amount", "<micro-USDC>", "usdc"]` | This increment's price — MUST match the quoted `priceUsdc` for increment `n` (§3.2). |
| `condition` | Yes | `["condition", "<sha256-hex-of-key>"]` | `sha256(key)` where `key` decrypts the artifact. **The join, both directions — see §4.2.** |

### 4.2 The binding, stated both directions

Decision 5: delivery is by hashlock. The provider picks a symmetric key, encrypts the increment's
artifact with it, uploads the ciphertext to Arweave, and publishes the offer above with
`condition = sha256(key)`. The buyer then pays with an ILP PREPARE addressed to the provider:

- **`executionCondition` on the PREPARE packet MUST equal the `condition` tag's value, byte for
  byte.** This is RFC-0022's `sha256(fulfillment) == condition` (`connector-domain/src/condition.rs`),
  reused here with `fulfillment := key` — not the placeholder/zero condition the normal TOON pay
  path uses (`skills/rfc-0022-hashed-timelock-agreements`); `connector.rs:523` already rejects a
  zero condition (#417), which is exactly the check that makes a placeholder impossible on this
  path. **The job event names the payment**: anyone who has read the kind:7000 partial event
  knows, before any packet is sent, exactly which `executionCondition` the paying PREPARE must
  carry.
- **The PREPARE packet's `data` field MUST carry a reference back to this kind:7000 event's id**
  (and transitively, via its `root` tag, the kind:5097 job). **The payment names the job**:
  anyone inspecting the payment/claim alone — for reputation computation (decision 8) or
  forensics — can identify which job and which increment it paid for, without needing the Nostr
  side of the join at all.
- The provider — the only party who knows `key` — returns it as the ILP `fulfillment` on the
  FULFILL packet that releases the claim. Revealing `key` to satisfy the condition and handing
  the buyer the decryption key are **the same act, in the same packet.** The buyer cannot decrypt
  without paying (no `key` released), and the provider cannot get paid without releasing `key`
  (rejected zero-condition; #417). **Neither party moves first, because there is no first.**

Nothing about *how* the connector represents that job reference on the wire (BTP frame shape, the
claim ledger, the client-edge mirroring of `ClientClaimGate`) is specified here — that is
connector-plane implementation, owned by its own ticket under #262's "blocking gap." This
document only pins the two fields — `condition`/`executionCondition` and the kind:7000 event id
carried in `data` — that MUST agree across the two planes for the join to be checkable by a third
party at all.

### 4.3 Granularity floor

Per decision 6, increments are **milestones, never tokens**. The floor is ~20.6 ms/packet plus one
paid relay write per increment (the kind:7000 partial event itself costs the standard per-byte
relay write fee, `docs/protocol.md` §Protocol Economics). A schedule with more increments than
milestones warrants is not a finer-grained service — it is overhead that eats the payment.

---

## 5. kind:6097 — Job result, and the three terminal states

Published once, when the job reaches a terminal state. Decision 8 computes reputation from
exactly these three outcomes and nothing else.

### 5.1 Tags

| Tag | Required | Format | Description |
|---|---|---|---|
| `e` | Yes | `["e", "<kind:5097 event id>", "<relay-hint>", "root"]` | |
| `e` | Yes | `["e", "<last kind:7000 event id>", "<relay-hint>", "reply"]` | The last partial offer (completed) or last narration/offer before the stall (abandoned). |
| `p` | Yes | `["p", "<buyer-pubkey>"]` | |
| `request` | Yes | `["request", "<kind:5097 event JSON>"]` | The full original request, for verification (matches generic kind:6xxx, `skills/dvm-protocol`). |
| `outcome` | Yes | `["outcome", "completed" \| "abandoned-provider" \| "abandoned-buyer"]` | The terminal state. **Exactly these three values** — decision 8 has no fourth. |
| `increment` | Yes | `["increment", "<n-reached>", "<of>"]` | How far the job got. `n-reached == of` when `outcome:"completed"`. |
| `i` | Only if `outcome:"completed"` | `["i", "<final-arweave-tx-id>", "url"]` | The final increment's artifact reference — same shape as §4.1, no separate delivery mechanism for the "last" increment. |

### 5.2 Outcome semantics

- **`completed`** — every quoted increment was offered and paid; `n-reached == of`. The `i` tag
  points at the final artifact.
- **`abandoned-provider`** — the provider stopped offering increments before the schedule
  completed (walked away, went silent, or the buyer stopped paying and the provider is recording
  the stall). No `i` tag — there is no final artifact.
- **`abandoned-buyer`** — the buyer stopped paying increments the provider kept offering. No `i`
  tag.

Either party quitting at an increment boundary risks at most one increment (decision 6) — the
`increment` tag's `n-reached` is exactly the point at which that happened, which is the only fact
reputation (decision 8) needs: it is a byproduct of the protocol working, not a review anyone
authored.

---

## 6. Free narration

A provider MAY publish progress updates that carry no artifact and settle nothing, using the
existing generic `"processing"` status:

```json
{
  "kind": 7000,
  "content": "Increment 2 (implement): 3 of 4 tickets landed, running the gate now.",
  "tags": [
    ["e", "<kind:5097 event id>", "", "root"],
    ["e", "<prior event id>", "", "reply"],
    ["p", "<buyer-pubkey>"],
    ["status", "processing"]
  ]
}
```

Narration events **MUST NOT** carry `i`, `amount`, or `condition` tags — those three tags
together are what make a kind:7000 event an increment offer (§4.1). An event with `status:
"processing"` and any of them is malformed; a client encountering one MUST treat it as narration
and MUST NOT attempt to pay against it.

Narration is free and public specifically because it is unpaid and unlocked — it is the
`processing` status doing exactly what generic NIP-90 already defines it to do
(`skills/dvm-protocol/references/nip-spec.md`), with nothing factory-specific added.

---

## 7. Worked example — one milestone, end to end

1. Buyer publishes `kind:5097`: `i` = "implement thread-focus-mode anchor deflake", `bid` =
   `5000000` (5 USDC), `param repo` = `toon-protocol/buzz`, `param target` = `buzz#56`.
2. Provider replies `kind:7000 status:"quote"`, `e:root` → the request, content: one increment,
   `priceUsdc: "5000000"`.
3. Provider does the work, uploads the encrypted diff to Arweave (`arTx1`), picks `key1`,
   publishes `kind:7000 status:"partial"`: `increment: ["1","1"]`, `i: ["arTx1","url"]`,
   `amount: ["5000000","usdc"]`, `condition: [sha256(key1)]`.
4. Buyer's connector sends an ILP PREPARE to the provider: `executionCondition = sha256(key1)`
   (byte-identical to the `condition` tag), `data` carries the increment-offer event id, amount
   `5000000` micro-USDC.
5. Provider's connector returns FULFILL with `fulfillment = key1`. The buyer's connector checks
   `sha256(key1) == executionCondition`, accepts the claim, and hands `key1` to the buyer's
   client, which fetches `arTx1` and decrypts.
6. Provider publishes `kind:6097`: `outcome: "completed"`, `increment: ["1","1"]`,
   `i: ["arTx1","url"]`, `request` = the original kind:5097 JSON.

No accept message anywhere in this sequence — step 4 (payment) is the acceptance (§3.3), and
step 5 is simultaneously the payment settling and the key handoff (§4.2).

---

## 8. Explicit non-goals

Carried over from #262 so nobody looks for them here:

- **Re-deriving why the wire is shaped this way.** #262 records fifteen decisions with rationale;
  this document only specifies the resulting bytes.
- **SPSP, STREAM, or payment pointers.** Neither exists in the connector; #262's "deliberately
  parked" section says why. Nothing in this spec references a payment pointer.
- **Buzz's `43001–43006`.** Superseded by decision 4; unimplemented beyond kind constants and
  desktop rendering, per #262's "known costs" section.
- **Delegation limits for agent-to-agent subcontracting.** Nothing enforces depth/breadth today
  (#262's rationale note on NIP-OA); a future ticket, not this one.
- **The connector-side client claim ledger, BTP `TRANSFER` framing, or bidirectional netting.**
  Owned by #262's "blocking gap" ticket. This document pins only the two fields that must agree
  across planes (§4.2).
- **NIP-89 `kind:31990` advertising, ArNS payment-pointer documents, auto-sweep, posted rate
  cards.** All parked in #262 and out of scope here.

---

## 9. Related

- [toon-meta#262](https://github.com/toon-protocol/toon-meta/issues/262) — epic: agents earning (all fifteen decisions this spec implements)
- [toon-meta#263](https://github.com/toon-protocol/toon-meta/issues/263) — this document's own ticket
- [toon-meta#266](https://github.com/toon-protocol/toon-meta/issues/266) — mesh-compute's `kind:31990` schema; owns the push-discovery model §1.3 deliberately diverges from
- `skills/dvm-protocol/references/nip-spec.md` — generic NIP-90 kind/tag reference this spec extends
- `skills/rfc-0022-hashed-timelock-agreements` — why TOON's normal pay path uses placeholder conditions, and why this path deliberately does not
- `skills/private-dms/references/nip-spec.md` — NIP-59 rumor → seal → gift wrap construction reused in §2.2
- `skills/git-collaboration/references/kind-5094-blob-storage.md` — the sibling DVM kind whose `bid`/`i` tag conventions this spec reuses rather than reinventing
- `docs/protocol.md` — per-byte relay write pricing that applies to every event in this document
- `docs/deployment.md`, `docs/handoff-arweave-dvm-deploy.md` — the store's existing `5094`/`5095`/`5096` allocations checked in §1.1
