# Mina o1js Capability Validation for Overmind Protocol

**Date:** 2026-03-24
**o1js version:** 2.14.0 (released 2026-03-16)
**Mina network:** Devnet active; Mesa upgrade targeting 2026 mainnet

---

## Feasibility Summary

| Capability | Feasible? | Confidence | Notes |
|---|---|---|---|
| VRF via Poseidon.hash() | **Yes** | High | Native provable primitive |
| Weighted random selection | **Yes** | High | DynamicArray + forEach + Provable.if |
| Recursive lifecycle proofs | **Yes** | High | SelfProof/ZkProgram, arbitrary depth |
| Executor registry (Merkle) | **Yes** | High | IndexedMerkleMap (stable since v2.7) |
| Structured event emission | **Yes** | High | Custom Struct events, 4 Fields needed |
| Testnet deployment | **Yes** | High | Devnet active, 0.1 tMINA fee |

---

## 1. VRF via Poseidon.hash()

`Poseidon.hash()` is a first-class provable primitive. Also `Poseidon.hashAnyLength()` for variable-length inputs (v2.14.0). Using `Poseidon.hash([seed, cycleNumber, ...])` as deterministic VRF output is well-supported.

## 2. Weighted Random Selection

**Constraint:** All circuit control flow must be **static** — loops need fixed iteration count at compile time.

**Solution:** `DynamicArray` (added v2.6.0) — provable type with constant max capacity but dynamic actual length. Capacity 0-65,535. Provides `forEach()`, `map()`, `get()`, `push()`.

**Practical executor limit:** 32-64 executors recommended. 256+ produces very large circuits and slow proving. Each loop iteration adds constraints.

**Pattern:**
```typescript
const executors = new DynamicArray(ExecutorStruct, { maxLength: 64 });
let totalWeight = Field(0);
executors.forEach((exec, isDummy) => {
  const weight = Provable.if(isDummy, Field(0), exec.weight);
  totalWeight = totalWeight.add(weight);
});
// select based on vrfOutput % totalWeight
```

## 3. Recursive Proofs

**Production-ready.** Kimchi/Pickles supports "arbitrary infinite recursive proof construction." Both linear and tree recursion supported.

```typescript
step: {
  privateInputs: [SelfProof, Field],
  async method(earlierProof: SelfProof<Field, void>, data: Field) {
    earlierProof.verify();
    // compute new state
  }
}
```

- **Proving time:** 30-120 seconds per proof (community consensus, no official benchmarks)
- **Verification time:** Constant, milliseconds (on-chain)
- **Max depth:** No documented limit. Each step produces constant-size proof regardless of depth.

## 4. Executor Registry — IndexedMerkleMap

**Promoted from Experimental to stable in v2.7.0.** 4-8x fewer constraints than `MerkleMap`.

- Max height 52 (height 31 = ~1 billion entries)
- **Off-chain storage is developer responsibility** — store full map in application server, IPFS, or archive node
- On-chain: only root hash (1 Field)
- Height 10 (1024 leaves) more than sufficient for 32-256 executors

## 5. Event Emission

```typescript
events = {
  'winner-selected': Struct({ winner: PublicKey, cycle: Field, vrfOutput: Field }),
};
this.emitEvent('winner-selected', { winner, cycle, vrfOutput });
```

- `PublicKey` = 2 Fields, `Field` = 1 Field → total 4 Fields per event
- Current limit: 16 Fields per event, 100 Fields per transaction
- Post-Mesa: 1024 Fields per transaction, no per-event cap
- Events NOT stored on-chain — preserved by archive nodes, fetched via `Mina.fetchEvents()`

## 6. On-Chain State Limits

- Current: **8 Field elements** per zkApp account (~256 bytes)
- Post-Mesa: **32 Field elements**
- Our needs: Merkle root (1F) + cycle counter (1F) + VRF output (1F) + winner PubKey (2F) = **5 Fields** — fits within 8F limit

## 7. Key Constraints / Warnings

- **Avoid reducer/actions API** — carries "not safe to use in production" warning, 32-pending-action hard limit
- **Fixed-capacity iteration only** — set max executors at compile time (e.g., 64)
- **Off-chain Merkle storage** is our responsibility
- **Proving times non-trivial** (30-120s) — acceptable for cycle-based selection, not real-time
- **Mina block time ~3 min** — dominates wake latency for Mina-adjudicated cycles

## 8. Deployment

- zkApp CLI: `npm install -g zkapp-cli` (v0.20.1+)
- Deploy: `zk config` → fund via faucet → `zk deploy <alias>`
- Cost: 0.1 MINA per deployment (~$0.05-0.20 USD)
- Devnet faucet: `https://faucet.minaprotocol.com/`
- GraphQL endpoint: `https://api.minascan.io/node/devnet/v1/graphql`
- Recommended o1js version: **2.7.0+** (stable IndexedMerkleMap + DynamicArray)
