# Predicate Envelope — journal format, input manifest, mint eligibility

**Status:** Normative spec · **Scope:** capability market protocol layer · **Audience:** predicate authors, contract implementers, miner clients

This document is the envelope specification for the capability market
([toon-meta#84](https://github.com/toon-protocol/toon-meta/issues/84)): the exact byte-level
contract between a sealed RISC Zero predicate (guest side, implemented per
[#119](https://github.com/toon-protocol/toon-meta/issues/119)) and `CapabilityMarket.sol`
(settlement side, implemented per [#120](https://github.com/toon-protocol/toon-meta/issues/120)),
plus the eligibility filter that decides whether a proposition is mintable at all. Enforcement
happens at **market creation, not at resolution** — a leaky predicate cannot even open a market
against staking capital.

The launch predicates that bind against this spec are authored and adversarially reviewed under
[#122](https://github.com/toon-protocol/toon-meta/issues/122). Reference implementations — the
Solidity contracts and the Rust predicate toolchain — live in
[toon-protocol/capability-market](https://github.com/toon-protocol/capability-market)
(`contracts/` + `predicates/`).

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as in RFC 2119.

**Acceptance for this spec** (from #121): a fresh reader can author a compliant predicate and
mint a market end-to-end without asking questions. If you find yourself asking one, that is a
bug in this document — file it.

---

## 1. Journal format

The journal is the public output every predicate commits from inside the zkVM via
`env::commit_slice()`, and the only predicate data `CapabilityMarket.sol` ever sees. It binds four
facts: *which program ran* (`image_id`), *against which market* (`market_params_hash`), *over
which submission* (`submission_hash`), and *what it concluded* (`verdict`).

### 1.1 Struct — both sides

Rust guest side:

```rust
struct Journal {
    image_id: [u8; 32],
    market_params_hash: [u8; 32],
    submission_hash: [u8; 32],
    verdict: bool,
}
```

(Reference implementation: the `journal` crate at `predicates/crates/journal` in
[toon-protocol/capability-market](https://github.com/toon-protocol/capability-market). It
deliberately does **not** derive a generic serializer — encoding is the explicit §1.2 layout.)

Solidity settlement side:

```solidity
struct Journal {
    bytes32 imageId;
    bytes32 marketParamsHash;
    bytes32 submissionHash;
    bool verdict;
}
```

Field semantics:

| Field | Meaning |
|---|---|
| `image_id` / `imageId` | The RISC Zero image ID of the guest program itself. A guest cannot hash itself, so the image ID is supplied to the guest **as an input** and committed verbatim; its integrity is established on-chain, not by the guest — the verifier checks the seal against the market's pinned image ID, and the contract MUST additionally check `journal.imageId` equals the market's committed `imageId`, so a prover lying about the input produces a journal the contract rejects. |
| `market_params_hash` / `marketParamsHash` | SHA-256 of the input manifest (§2). Binds the proof to one specific market's frozen parameters. |
| `submission_hash` / `submissionHash` | SHA-256 of the exact submission bytes the predicate evaluated. Bound at reveal time (§4). |
| `verdict` | `true` iff the sealed predicate returned PASS on the submission. |

### 1.2 Canonical byte encoding (envelope v1)

The journal's canonical encoding is a **fixed layout of exactly 97 bytes**:

```
offset  size  field
0       32    image_id
32      32    market_params_hash
64      32    submission_hash
96      1     verdict            0x01 = true, 0x00 = false
```

Normative rules:

- The three 32-byte fields MUST appear in the declared struct order above, each copied
  **verbatim as an opaque 32-byte string** — they are hash digests, so no integer endianness
  applies and no byte-order transformation of any kind is permitted. A digest whose
  hex rendering is `0xab01…` MUST have `0xab` at the field's first byte offset.
- The `verdict` byte MUST be exactly `0x01` (true) or `0x00` (false). Decoders MUST reject any
  other value — a "truthy" nonzero byte is not a valid encoding.
- The encoded journal MUST be exactly 97 bytes. Decoders MUST reject any other length. There is
  no length prefix, no padding, and no trailing data.
- The Rust guest MUST commit exactly these 97 bytes via `env::commit_slice()` over the
  canonical encoder's output. It MUST NOT use `env::commit()` — that path goes through RISC
  Zero's word-oriented serde and produces different bytes, so `sha256(journal)` on-chain would
  never match. Verify against the golden test vectors of §1.5; do not assume a generic serde
  serializer gets this layout right for free.

### 1.3 Verification binding

The RISC Zero verifier does not receive the journal struct — it receives a **journal digest**.
On reveal (§4), the contract MUST:

1. Take the raw `journal` calldata bytes,
2. compute `sha256(journal)`,
3. pass that digest to the RISC Zero verifier along with the proof (`seal`) and the market's
   committed `imageId`,
4. and, only after the verifier accepts, decode the same 97 bytes per §1.2 and check the fields
   (full sequence in §4.2).

This is the load-bearing link: the proof attests "the program with this image ID committed a
journal whose SHA-256 is this digest", and the contract independently recomputes that digest
from the bytes it decodes. Any implementation that decodes one buffer and digests another is
broken.

### 1.4 Version tag strategy

Envelope v1 carries **no in-band version byte** — the 97-byte layout above *is* version 1, and
its version is bound out-of-band by two pins that already exist:

- **Guest side:** predicates are compiled against a pinned envelope crate; the layout is baked
  into the image, so the market's `imageId` transitively commits to the envelope version.
- **Contract side:** each deployed `CapabilityMarket.sol` decoder hard-codes the v1 layout
  (including the exact-97-byte length check, which structurally rejects any future longer
  encoding).

A change to the journal layout is therefore a **protocol migration, not a runtime branch**: it
requires a new envelope version in this document, new guest images (new image IDs), and a new
or upgraded contract decoder. Contracts MUST NOT attempt to sniff or auto-negotiate versions
from journal bytes. If a future version needs in-band tagging, it MUST use a length different
from 97 so v1 decoders reject it unambiguously.

### 1.5 Cross-implementation acceptance rule

From #119: **independent Rust and Solidity implementations MUST decode identical journal bytes
to identical field values.** The canonical shared vector file is

> [`predicates/crates/journal/tests/golden_journal_vectors.json`](https://github.com/toon-protocol/capability-market/blob/main/predicates/crates/journal/tests/golden_journal_vectors.json)

in the capability-market repo. Both implementations consume it: the Rust `journal` crate's
tests load the JSON directly, and the Solidity conformance suite
(`contracts/test/JournalConformance.t.sol`) embeds the same vectors verbatim. It covers, at
minimum, `verdict: true` journals, `verdict: false` journals, and each vector's expected
`sha256` journal digest; both suites additionally assert the rejection cases (96 bytes, 98
bytes, verdict byte `0x02`). CI on both sides MUST assert byte-for-byte agreement on encode
(Rust) and field-for-field agreement on decode (Solidity) against that file — do not fork or
re-derive the vectors elsewhere; if the layout ever changes (a protocol migration, §1.4), the
file changes first and both suites follow it.

---

## 2. Input manifest format

Every mintable proposition declares its inputs as a content-addressed manifest. The manifest is
the market's frozen parameter set: hashed once at creation, immutable forever after.

### 2.1 Schema

```yaml
input_manifest:
  - name: "market_params"
    hash: sha256:9f2c…            # content-addressed problem parameters
    encoding: rlp                  # rlp | ssz | raw_bytes
  - name: "submission"
    hash: <bound at reveal time>   # the one late-bound slot
    encoding: raw_bytes
  - name: "frozen_clock"           # deadline as pinned data
    value: 1719792000              # literal Unix timestamp
```

Each entry has a `name` (the handle the guest program uses to request the input) and exactly
one of:

- `hash` — a content-address (`sha256:<hex>`) of externally stored bytes, plus an `encoding`
  declaring how the guest interprets them (`rlp`, `ssz`, or `raw_bytes`); or
- `value` — a literal pinned value embedded directly in the manifest (e.g. `frozen_clock`, the
  deadline pinned as data so the predicate itself is timeless).

### 2.2 Rules

1. **Every input is either a hash of content-addressed data or a literal pinned value.** There
   MUST NOT be any input whose content is resolved by name, URL, or any other mutable
   reference. A predicate whose inputs cannot all be reduced to hashes and literals is not
   eligible (§3).
2. **The manifest itself is hashed, and that hash is `marketParamsHash`** — committed at
   `createMarket` and immutable thereafter. `marketParamsHash = sha256(manifest_bytes)` over
   the exact stored manifest bytes. Authors SHOULD canonicalize before hashing (UTF-8, LF line
   endings, no trailing whitespace) and SHOULD store the manifest bytes on Arweave next to the
   predicate; but the hash always binds the literal stored bytes, not a re-serialization.
3. **The guest program consumes inputs by manifest name; the runtime binds them from the reveal
   transaction.** The prover host resolves each `hash` entry to its bytes (fetching from
   content-addressed storage), supplies each `value` entry literally, and binds the one
   late-bound slot — `submission` — from the revealing miner's solution. The guest MUST verify
   that every hash-declared input it reads actually hashes to the manifest's declared digest,
   and MUST set the journal's `submission_hash` to the SHA-256 of the submission bytes it
   actually evaluated.

The `submission` entry is the only slot whose hash is not fixed at mint time — everything else
is frozen. This is what makes the market question well-posed: the predicate, its parameters,
and its deadline are all sealed; only the world's answer is open.

---

## 3. Eligibility checks at market creation

Eligibility is enforced at mint. `CapabilityMarket.sol.createMarket()` MUST perform the
on-chain checks (1–5), either inline or via a helper contract; authoring tooling MUST perform
the off-chain checks (6–8) before the `createMarket` transaction is broadcast. Predicates
failing any check are non-eligible; no market can be opened against them.

### 3.1 On-chain checks (contract-enforced)

1. **Image ID present.** `imageId` MUST be a 32-byte hash committed on-chain, not a name.
2. **Predicate bytes retrievable from Arweave.** `predicateArweaveTx` MUST be resolvable, and
   the guest ELF fetched from it MUST recompute to the market's image ID:
   `risc0_binfmt::compute_image_id(elf) == imageId`. Note this is **not** a flat hash — a RISC
   Zero image ID is a structured commitment over the ELF's loaded memory image (its initial
   zkVM state), so `sha256(elf)` would never match; clients MUST use `compute_image_id`.
   Verified **off-chain before the mint transaction is broadcast**, since the contract cannot
   read Arweave directly. This is a documented client-side pre-broadcast workflow (§3.3),
   enforced by the front-end / authoring tooling; the contract's role is to commit
   `predicateArweaveTx` immutably so anyone can re-run the check. For the check to be
   independently recomputable at all, the uploaded ELF MUST come from RISC Zero's reproducible
   dockerized build (`cargo risczero build`) — see §3.3.

   *Compressed-at-rest storage.* The bytes at `predicateArweaveTx` MAY be a gzip-compressed
   ELF (single-member DEFLATE, RFC 1952) rather than the raw ELF, stored with
   `Content-Type: application/gzip`; clients performing this check MUST decompress before
   calling `compute_image_id` when that content type (or gzip magic `1f 8b`) is present. The
   image ID always commits to the **decompressed** ELF, so compression is a pure transport
   encoding with no consensus surface — decompression of fixed stored bytes is deterministic.
   Rationale: size-optimized guest ELFs (~164 KB) gzip to well under the ~100 KiB Turbo
   free-upload tier, making predicate publication free on devnet.
3. **Input manifest hash committed.** `marketParamsHash` MUST be set at creation and is
   immutable thereafter.
4. **Deadline sanity.** `deadline > block.timestamp`, `lockWindowEnd < deadline`, and
   `commitRevealWindow > 0` MUST all hold.
5. **Bounty sanity.** `resolutionBountyBps ≤ MAX_BOUNTY_BPS` MUST hold (e.g. `MAX_BOUNTY_BPS =
   100`, i.e. 1%).

### 3.2 Off-chain / mint-time-only checks (tooling- and review-enforced)

6. **Class 3 — open frontier.** Only open-frontier propositions are mintable (decided fork in
   #84: no trapdoor-witness class, no pure-grind class). The author MUST assert, and a reviewer
   MUST confirm, that **no witness exists at mint time**. At launch this is a manual review
   over a curated cohort (the #122 adversarial-review process); the rule hardens into
   algorithmic eligibility criteria as failure modes reveal what those need to be.
7. **Predicate is deterministic.** RISC Zero's constraint system structurally enforces this —
   a guest image cannot read a clock, network, or entropy source that isn't a declared input.
   No additional hermeticity check is needed on top (the prior JS static-analysis plan is
   obsolete for exactly this reason).
8. **Predicate is within the size ceiling for economical proving.** Guidance, not a hard
   limit — smaller predicates prove faster and cheaper (locally, and on Kalypso for miners
   without GPUs). Authors SHOULD budget cycles: verification is supposed to be the cheap side
   of the generator–verifier gap, and a predicate that is expensive to *check* undermines the
   market's economics.

### 3.3 Pre-broadcast workflow (check 2, spelled out)

Before broadcasting `createMarket`, the authoring client MUST:

1. Fetch the predicate guest ELF from `predicateArweaveTx` via an Arweave gateway
   (retrievability probe — a tx that cannot be fetched fails eligibility);
2. recompute the image ID from the fetched ELF with `risc0_binfmt::compute_image_id(elf)` and
   verify it equals the market's `imageId` (NOT `sha256` of the bytes — the image ID is a
   structured commitment over the ELF's memory image, see §3.1 check 2);
3. fetch the manifest bytes and verify `sha256(manifest_bytes) == marketParamsHash`;
4. only then sign and broadcast the transaction.

For step 2 to be reproducible by anyone, the ELF pinned on Arweave MUST be the output of RISC
Zero's deterministic dockerized build (`cargo risczero build`), not a local host build — local
builds are not guaranteed bit-reproducible across machines/toolchains, and a non-reproducible
image ID cannot be independently recomputed. Authors SHOULD run the docker build twice (ideally
on two machines / in CI) and require identical image IDs before pinning one in `createMarket`.

Any observer can repeat steps 1–3 at any time against the market's committed on-chain values;
a market whose Arweave content has drifted or vanished is publicly detectable, even though the
contract itself cannot detect it.

---

## 4. Reveal interface

The reveal is how a miner resolves a market YES: they present the proof, the journal, and the
preimage of their earlier commitment. Front-running defense is commit–reveal with address
binding (decided fork in #84).

### 4.1 Signature

```solidity
function reveal(
    uint256 marketId,
    bytes32 solutionHash,   // sha256 of the submission bytes
    bytes32 arweaveTx,      // where the submission bytes live
    bytes32 salt,           // commit blinding factor
    bytes calldata proof,   // RISC Zero seal
    bytes calldata journal  // the 97-byte envelope of §1.2
) external;
```

### 4.2 Contract check sequence

On `reveal`, the contract MUST, in order:

1. **Recompute the commitment and check `msg.sender`.** Verify
   `keccak256(abi.encodePacked(solutionHash, arweaveTx, msg.sender, salt))` equals the stored
   commitment for `msg.sender` on this market. Because the revealer's address is inside the
   hash, a mempool bot that copies the reveal calldata under its own address recomputes a
   different commitment and is rejected.
2. **Verify commit timestamp ≤ `deadline`.** The commitment must have landed inside the commit
   window; the reveal itself may land after the deadline, within the grace window (§4.3).
3. **Call the RISC Zero verifier** with `(proof, marketImageId, sha256(journal))` — the
   digest binding of §1.3. The verifier is risc0-ethereum's
   `IRiscZeroVerifier.verify(seal, imageId, journalDigest)`, which **reverts** on an invalid
   seal rather than returning a bool.
4. **Decode the journal (per §1.2) and check field-by-field match** against the market's
   committed values: `journal.imageId == market.imageId`,
   `journal.marketParamsHash == market.marketParamsHash`, and
   `journal.submissionHash == solutionHash`.
5. **Check `journal.verdict == true`.**
6. **Mark the market resolved YES with `msg.sender` as winner.**

Any check failing MUST revert the whole reveal; there is no partial resolution.

### 4.3 Commit hash and window rules

The commitment is:

```
commitmentHash = keccak256(solutionHash ‖ arweaveTx ‖ msg.sender ‖ salt)
```

(`‖` is tight concatenation of the ABI-packed fields: `bytes32 ‖ bytes32 ‖ address ‖ bytes32`.)
The `salt` MUST be a fresh random 32-byte value per commitment — it is what keeps
`solutionHash` blinded until reveal.

The market's phases are strictly ordered:

```
stake-lock window  <  commit window  <  deadline  <  reveal grace window
─ stakes accepted ─┤├─ commits ──────┤├─ reveals accepted ──────────────┤
     t ≤ lockWindowEnd   lockWindowEnd < t ≤ deadline    deadline < t ≤ deadline + commitRevealWindow
```

- **Stakes** are accepted only while `block.timestamp ≤ lockWindowEnd`.
- **Commits** are accepted only while `lockWindowEnd < block.timestamp ≤ deadline`. The gap is
  deliberate: stakes close *before* commits open, so an MEV bot cannot see a commit event and
  pile stake onto YES.
- **Reveals** are accepted after the commit lands and until `deadline + commitRevealWindow`.
  The grace window solves proof lag: a solver who finishes at 11:58pm commits before the
  deadline and reveals once proving completes.
- If the grace window closes with no valid reveal, anyone MAY call `settleTimeout()`; the
  market resolves NO and the keeper receives `resolutionBountyBps` of the pool (see #120).

---

## 5. Worked example — the matmul flagship, end to end

The flagship launch proposition (#84, #122): *"someone publishes a bilinear scheme computing
4×4 matrix multiplication over GF(2) using ≤ 46 scalar multiplications, by deadline D."*
AlphaTensor's 47-multiplication scheme is public, so 47 is the known frontier; ≤ 46 is open —
class 3, genuinely two-sided. (The #119 toolchain spike proves the pipeline with the known
47-mult scheme against a ≤ 47 threshold; the *market* threshold is 46.)

**Step 1 — Rust check.** The predicate parses the submission as a rank-46-or-lower bilinear
scheme (three coefficient tensors over GF(2)) and verifies it exhaustively — checking is cheap,
discovery is hard:

```rust
fn main() {
    // Inputs bound by manifest name (§2.3): host supplies bytes, guest re-verifies hashes.
    let params: MarketParams = read_input("market_params");   // abi.encode(uint256(46)): the rank bound
    let submission: Vec<u8>  = read_input("submission");      // late-bound at reveal
    let _deadline: u64       = read_input("frozen_clock");    // pinned literal; unused by the check

    let verdict = match Scheme::parse(&submission) {
        Ok(s) => s.num_muls() <= params.max_muls
              && s.computes_matmul_exhaustive_gf2(params.n),  // all 2^16 × 2^16 pairs, or symbolic
        Err(_) => false,                                      // malformed submission = FAIL, not panic
    };

    env::commit_slice(&Journal {
        image_id,                                             // supplied as input (§1.1); enforced on-chain
        market_params_hash: sha256(manifest_bytes),
        submission_hash: sha256(&submission),
        verdict,
    }.encode_v1());                                           // the 97 bytes of §1.2
}
```

**Step 2 — Build.** The #119 toolchain compiles the guest and emits the image ID reproducibly
via RISC Zero's dockerized build (`cargo risczero build`): `(image_id = 0xIMG…, guest_elf)`.
Rebuilding from the same source MUST yield the same image ID (§3.3).

**Step 3 — Upload.** Push the docker-built `guest_elf` to Arweave via the Turbo pipeline
(#112) → `predicateArweaveTx = 0xART…`. Re-fetch and confirm
`risc0_binfmt::compute_image_id(elf) == 0xIMG…` (§3.3 step 2).

**Step 4 — Manifest.** Author and upload the manifest; hash it:

```yaml
input_manifest:
  - name: "market_params"
    hash: sha256:3d1a…        # abi.encode(uint256(46)) — the rank bound, 32 bytes, on Arweave
    encoding: raw_bytes        # matmul-market-params-v1: n=4 / GF(2) are baked into the predicate
  - name: "submission"
    hash: <bound at reveal time>
    encoding: raw_bytes
  - name: "frozen_clock"
    value: 1735689600          # D = 2025-01-01T00:00:00Z (example)
```

`marketParamsHash = sha256(manifest_bytes) = 0xMPH…`

**Step 5 — Mint.** Run the pre-broadcast checks of §3.3, then:

```solidity
createMarket({
    imageId:             0xIMG…,
    predicateArweaveTx:  0xART…,
    marketParamsHash:    0xMPH…,
    deadline:            1735689600,
    commitRevealWindow:  172800,      // 48h reveal grace
    lockWindowEnd:       1735603200,  // 24h before deadline; MUST be < deadline
    resolutionBountyBps: 50,          // 0.5% keeper bounty; ≤ MAX_BOUNTY_BPS
    seedNoStake:         1000e6       // author's cold-start USDC into the NO pool
}) → marketId
```

The market trades: YES price = the world's live estimate that a ≤ 46-multiplication scheme
appears by D.

**Step 6 — Commit.** A miner finds a candidate 46-mult scheme, serializes it
(`submission_bytes`), uploads it to Arweave (`arweaveTx`), picks a random `salt`, and before
the deadline calls:

```
commit(marketId, keccak256(sha256(submission_bytes) ‖ arweaveTx ‖ minerAddress ‖ salt))
```

**Step 7 — Prove.** The miner proves the guest execution — locally on their own GPU, or via a
Kalypso order pairing `(image_id, USDC)` — obtaining `(proof, journal)` where the journal is
the 97-byte envelope with `verdict = 0x01`.

**Step 8 — Reveal.** Within the grace window:
`reveal(marketId, sha256(submission_bytes), arweaveTx, salt, proof, journal)`. The contract
runs the six checks of §4.2 and marks the market **ResolvedYes**, winner = miner.

**Step 9 — Settle.** YES stakers (miner included, plus the miner's discovery bonus per #120)
call `withdraw()` and pull their parimutuel payouts in USDC. Had no valid reveal landed, a
keeper would have called `settleTimeout()` after the grace window and the market would have
resolved NO.

---

## 6. Explicit non-goals

Carried over from #121, so nobody looks for them here:

- **Predicate authoring toolchain** — #119 story 1 (template, build pipeline, upload step).
- **Individual launch predicates** — #122 (authorship + adversarial review + bounty).
- **Static hermeticity analysis for JS** — obsolete; the zkVM pivot moved determinism into the
  constraint system (§3.2 check 7).
- **Runtime hermeticity enforcement** — obsolete, same reason.
- **The `CapabilityMarket.sol` economics** (parimutuel math, miner discovery bonus, state
  machine) — #120 owns those; this spec only defines what the contract decodes and checks.

## 7. Related

- [toon-meta#84](https://github.com/toon-protocol/toon-meta/issues/84) — capability market umbrella (decided forks; proposition classes)
- [toon-meta#119](https://github.com/toon-protocol/toon-meta/issues/119) — RISC Zero zkVM integration + on-chain verifier on Base (guest side; reveal-interface origin)
- [toon-meta#120](https://github.com/toon-protocol/toon-meta/issues/120) — `CapabilityMarket.sol` escrow contract (settlement side)
- [toon-meta#121](https://github.com/toon-protocol/toon-meta/issues/121) — predicate eligibility filter + envelope spec (this document's epic)
- [toon-meta#122](https://github.com/toon-protocol/toon-meta/issues/122) — launch predicate authorship + adversarial review
- [toon-protocol/capability-market](https://github.com/toon-protocol/capability-market) — reference implementation: `contracts/` (settlement) + `predicates/` (guest programs)
