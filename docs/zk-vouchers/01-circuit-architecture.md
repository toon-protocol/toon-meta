# ZK Write-Vouchers: Semaphore/Groth16 Circuit Architecture

This document is a technical reference for how the Semaphore nullifier circuit (Groth16
over BN254) adapts to TOON's write-voucher model. The proof-system choice is fixed — see
the decision recorded in [#67](https://github.com/toon-protocol/toon-meta/issues/67):
**Groth16, BN254, Semaphore lineage, client-side proving, forked Semaphore circuits.**

This note covers circuit mechanics, constraint counts, and prover/verifier costs only. It
does not reopen the proof-system decision, does not define the voucher minting binding
scheme, and does not specify the nullifier accumulator design or relay/connector placement —
those are addressed in sibling issues (see [Scope Boundaries](#scope-boundaries)).

---

## Circuit Inputs and Outputs

Semaphore's circuit (`Semaphore(MAX_DEPTH)` in circom 2.1.5) parameterises the Merkle tree
depth at compile time. The standard production build uses `MAX_DEPTH = 20`, which supports
groups of up to 2²⁰ = 1 048 576 members.

### Public inputs (known to the verifier)

| Signal | Type | Semantics for TOON |
|---|---|---|
| `merkleRoot` | 254-bit scalar | Root of the write-voucher commitment tree |
| `nullifier` | 254-bit scalar | Hash that prevents double-spending of a voucher |
| `message` | 254-bit scalar | Event content hash (binds proof to this write) |
| `scope` | 254-bit scalar | Context salt; ties nullifier to a specific domain |

### Private inputs (known only to the prover)

| Signal | Type | Semantics for TOON |
|---|---|---|
| `secret` | 251-bit scalar | Voucher holder's secret; must be < Baby Jubjub subgroup order *l* |
| `merkleProofLength` | integer 0–32 | Actual depth of the Merkle path being proved |
| `merkleProofIndex` | leaf index | Position of the commitment in the tree |
| `merkleProofSiblings[MAX_DEPTH]` | 254-bit scalars | Sibling hashes along the path; padded with zeroes |

### Derived values (computed inside the circuit)

```
identityCommitment = Poseidon(Ax, Ay)
  where (Ax, Ay) = BabyJubjub scalar-multiply(secret)

nullifier = Poseidon(scope, secret)

merkleRoot = BinaryMerkleRoot(identityCommitment, merkleProofLength,
                              merkleProofIndex, merkleProofSiblings)
```

The circuit enforces that `secret < l` via a 251-bit `LessThan` component.

---

## Nullifier Derivation Scheme

The nullifier is a public output derived entirely from the prover's secret and a
domain-specific scope:

```
nullifier = Poseidon(scope, secret)
```

The Poseidon variant used is **Poseidon-2** (two-input sponge, PSE flavour, 251-bit
output). Because `scope` is a public input, different scopes produce independent nullifiers
from the same secret — allowing the same voucher holder to act in multiple independent
contexts without linkability. For TOON, the scope anchors the nullifier to a specific
write action (e.g., hash of the relay's pubkey or a per-round epoch identifier, depending
on the accumulator design chosen in the sibling issue).

**Anti-replay**: once a nullifier appears in the relay's spent-nullifier store, any second
write carrying the same nullifier is rejected. The store need only track the 254-bit scalar —
it does not record the event content or the prover's identity.

---

## Merkle Membership Proof Construction

The circuit verifies a Poseidon-based binary Merkle tree inclusion proof:

1. Hash the private secret pair to obtain the leaf: `leaf = Poseidon(Ax, Ay)`.
2. For each level `i` from leaf to root:
   - If `merkleProofIndex[i] == 0`: `parent = Poseidon(current, merkleProofSiblings[i])`
   - If `merkleProofIndex[i] == 1`: `parent = Poseidon(merkleProofSiblings[i], current)`
3. Assert `parent == merkleRoot` at the last level.

With `MAX_DEPTH = 20`, 20 Poseidon-2 hashes are computed inside the circuit. Each
level contributes approximately 300 constraints, so the Merkle path accounts for roughly
6 000 of the circuit's total ~15 000 constraints.

---

## BN254 Constraint Count

Semaphore v4 compiled with `MAX_DEPTH = 20` produces approximately **15 000 R1CS
constraints** over the BN254 scalar field. This figure is widely cited in Semaphore's own
documentation and confirmed by reviewing the circom source.

Approximate breakdown by component:

| Component | Constraints | Notes |
|---|---|---|
| Baby Jubjub scalar multiplication (`BabyPbk`) | ~4 000 | Windowed double-and-add; EdDSA key derivation |
| Binary Merkle root (20 levels × Poseidon-2) | ~6 000 | ~300 per hash level |
| `LessThan(251)` secret range check | ~1 500 | Bit decomposition + comparator |
| Poseidon-2 (identity commitment from Baby Jubjub point) | ~300 | Hash of `(Ax, Ay)` |
| Poseidon-2 (nullifier) | ~300 | Hash of `(scope, secret)` |
| Message dummy square (non-malleability) | 1 | Binds `message` to the proof |
| Selector gates and routing | ~2 900 | Merkle coordinate logic, misc constraints |
| **Total** | **~15 000** | |

**TOON-specific changes that affect this count:**

Swapping the `scope` input for a different domain tag does not add constraints — it is
already a public input signal. Adding circuit logic to range-check a payment amount or bind
to a voucher-pool epoch would add constraints; rough estimate is +500–1 000 per extra
Poseidon hash and +1 500 per LessThan comparator. A lightly modified fork should remain
under 18 000 constraints.

---

## Prover Time: Mobile and Browser Baseline

All proving is **client-side** (the secret never leaves the client; outsourcing it would
eliminate anonymity). The prover uses the compiled Circom WASM witness calculator and
snarkjs's `groth16.prove(zkey, witness)`.

| Environment | Proving time | Notes |
|---|---|---|
| Node.js (desktop) | 1–3 s | Multi-threaded FFI; fastest baseline |
| Browser (modern, single-threaded WASM) | 5–15 s | No shared-memory threads; main bottleneck |
| Mobile Safari (iOS) | 8–25 s | Single-threaded; JIT restrictions vary |
| Mobile Chrome (Android) | 4–12 s | WASM JIT; faster than iOS in practice |

These figures are sourced from Semaphore's own benchmarks and are consistent with
published snarkjs benchmarks for Groth16 circuits in the 10 000–20 000 constraint range.
Proof generation is the bottleneck; showing a progress indicator during the 5–15 s window
is the standard UX pattern in Semaphore-based apps.

First use also requires downloading the `.zkey` proving-key file (~40–50 MB for depth 20).
Subsequent runs use the cached artifact.

---

## Verifier Time and Proof Size

**Proof size:** A Groth16 BN254 proof is **256 bytes** (three curve points: π_A on G1,
π_B on G2, π_C on G1, each compressed). Together with the public inputs (four 254-bit
scalars = 128 bytes) the full proof blob sent to the relay is approximately **385 bytes**.

**Verifier time:** Groth16 verification requires three bilinear pairings over BN254:

```
e(π_A, π_B) = e([vk_α]₁, [vk_β]₂)
            · e([vk_γ]₁ · Σᵢ(publicᵢ · [vk_γᵢ]₁), [vk_δ]₂)
            · e([π_C]₁, [vk_δ]₂)
```

On modern server hardware, three BN254 pairings complete in **< 1 ms**. On an Ethereum
L1 contract the equivalent operation costs approximately **270 000 gas**. For relay-side
in-process verification (the expected TOON path), verification is effectively free relative
to I/O.

**Shared verify surface with #68:** BN254 Groth16 is the verify primitive for both
write-vouchers (this ticket) and the wrapped proof from #68. A light client needs exactly
one verifier implementation to cover both tickets.

---

## Semaphore Repository and Fork Point

**Repository:** [github.com/semaphore-protocol/semaphore](https://github.com/semaphore-protocol/semaphore)  
**License:** MIT  
**Package to fork:** `packages/circuits/src/semaphore.circom` (pragma circom 2.1.5)  
**Stable version:** 4.14.2 (current as of the time of writing)

The relevant circuit template is `Semaphore(MAX_DEPTH)` in `semaphore.circom`. It imports:

- `node_modules/circomlib/circuits/babyjub.circom` — Baby Jubjub arithmetic
- `@zk-kit/binary-merkle-root.circom` — binary Merkle path template
- `node_modules/circomlib/circuits/poseidon.circom` — Poseidon sponge

**TOON-specific wiring changes at the circuit level:**

The circuit template itself may require no changes if the Semaphore v4 signal semantics
(`scope`, `message`, `secret`) map cleanly to TOON's write-voucher model. The wiring
changes are primarily in the circuit *instantiation* and supporting infrastructure:

1. **Scope semantics**: define what `scope` represents (relay pubkey hash? epoch ID? voucher pool ID?). This is set at proof-generation time — no circuit modification needed.
2. **Message binding**: bind `message` to the Nostr event ID or content hash. Again a
   proof-generation convention, not a circuit change.
3. **Commitment derivation**: if TOON's voucher commitment scheme differs from Semaphore's
   `Poseidon(Ax, Ay)` — for example, if commitments are `Poseidon(secret, nonce)` rather
   than derived from a Baby Jubjub keypair — this requires modifying the `identityCommitment`
   computation inside the circom template. That is the only likely circuit-level change.
4. **Trusted setup**: if the circuit is modified (case 3 above), a new per-circuit ceremony
   is required. If the circuit is used unmodified, the Semaphore team's existing `.zkey`
   can be reused.
5. **Proof serialisation**: encode the 385-byte proof blob into the TOON/ILP PREPARE packet
   data field. No circuit change; handled at the SDK layer.

---

## Scope Boundaries

The following design questions are **explicitly not decided here**. They are addressed in
sibling issues under #67:

- **Voucher minting binding**: how to bind write-voucher commitments to a funded TOON
  payment channel without reintroducing the payer-to-author link. Range proof on channel
  balance? Issuer-signed voucher set? This is the core anonymity design question.
- **Nullifier accumulator design**: per-relay nullifier set structure, growth/pruning
  strategy, epoch rotation, and cross-relay double-spend prevention. Storage and scan cost.
- **Relay vs. connector placement**: whether proof verification happens at the relay
  (after event delivery) or at the connector (in the ILP Prepare handler). Relevant to #52's
  "payment terminates at the edge" model.
- **NIP shape**: the `kind`, tag structure, and proof-carrying event format for
  proof-carrying Nostr events so relays and interpreters know how to verify.
- **Graceful degradation**: how a non-zk client posts (plain paid write) alongside
  anonymous writes on the same relay without confusion.
- **Mina / o1js angle**: whether there is reuse with the o1js zkApp path from the WS3
  work (#22), or whether write-voucher proving is entirely separate.
