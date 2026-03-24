# Party Mode Design Decisions — 2026-03-22

## Network Primitives Strategy & "Stripe for Decentralized Services" Positioning

**Context:** Discussion about whether Story 8.0 (blob storage) constitutes a network primitive, what other primitives TOON should build, competitive positioning vs HyperBEAM/AO, and the convenience fee economic model. This session produced TOON Protocol's strategic architecture — the north star for Epic 9 and beyond.

**Participants:** Jonathan (product owner), Winston (architect), John (PM), Mary (analyst), Victor (innovation strategist), Dr. Quinn (problem solver), Amelia (dev)

---

### Decision D8-PM-001: Blob Storage Is a Network Primitive

**Problem:** Story 8.0 (kind:5094 Arweave DVM) was scoped as a feature. The question: is it a network primitive or just an Arweave integration?

**Decision:** Blob storage via kind:5094 is a **network primitive**, not an Arweave feature. It satisfies all three primitive criteria:

1. **Payment-native** — uses the ILP rail, pay-per-byte
2. **Discovery-native** — providers advertise via kind:10035, agents discover via relay
3. **Composable** — downstream services (Forge-UI stories 8.1-8.6) build on it

The kind:5094 event format, chunked upload protocol, and pricing model are protocol-level constructs. Arweave is one implementation backend behind the `ArweaveUploadAdapter` interface.

**Implications:**
- The interface is the primitive; the implementation is specific
- Future storage backends (Filecoin, IPFS, S3) implement the same adapter interface
- Design decisions must consider backend-agnosticism

---

### Decision D8-PM-002: Self-Describing Result Receipts

**Problem:** The current FULFILL data field returns a bare Arweave txId string. Clients implicitly know it's an Arweave ID and construct `https://arweave.net/<txId>`. This couples clients to a specific backend and breaks backend-agnosticism.

**Decision:** All DVM primitive FULFILL responses must return **self-describing receipts** as structured tag data. The receipt tells the client everything it needs to retrieve/verify the result without knowing the backend.

**Blob Storage Receipt (kind:6094) tags:**
```
['storage-type', 'arweave']              // or 'filecoin', 'ipfs'
['tx-id', 'abc123xyz']                   // backend-specific identifier
['gateway', 'https://arweave.net/']      // retrieval base URL
['status', 'confirmed']                  // confirmation status
```

**Pattern:** Client constructs `gateway + tx-id` for retrieval. No backend knowledge required. Same pattern applies to compute results (kind:6250) and chain broadcast results (kind:6260).

**Timing:** Should be implemented before Stories 8.1-8.6 (Forge-UI) to prevent Arweave coupling from propagating through the codebase.

---

### Decision D8-PM-003: Four Network Primitives Architecture

**Problem:** What primitives should TOON build, and in what order?

**Decision:** TOON Protocol's strategic architecture consists of four network primitives:

| # | Primitive | Request Kind | Result Kind | What Agents Get |
|---|---|---|---|---|
| 1 | **Messaging** | 1 | — | Communicate, pay per byte |
| 2 | **Blob Storage** | 5094 | 6094 | Store anything permanently, backend-agnostic |
| 3 | **Compute** | 5250 | 6250 | Run code anywhere, backend-agnostic |
| 4 | **Chain Bridge** | 5260 | 6260 | Interact with any blockchain, chain-agnostic |

All four share:
- Payment via ILP (USDC settlement)
- Discovery via kind:10035 (SkillDescriptor)
- Self-describing receipts in FULFILL
- Competing providers with convenience fee pricing
- Backend-agnostic adapter pattern

**Composition table (emergent capabilities):**

| Primitive A | + Primitive B | = Emergent Capability |
|---|---|---|
| Blob Storage | + Compute | Decentralized CI/CD, serverless functions |
| Blob Storage | + Chain Bridge | Cross-chain asset deployment |
| Compute | + Chain Bridge | Smart contract compilation + multi-chain deploy |
| All four | composed | Full decentralized deployment pipeline |

**Build order:** Messaging (done) → Blob Storage (Epic 8, done) → Compute (future) → Chain Bridge (future)

---

### Decision D8-PM-004: Convenience Fee Economic Model

**Problem:** How should DVM providers price compute and chain services?

**Decision:** DVM providers are **resellers**, not platforms. The economic model:

```
Client pays:  backend_cost + provider_convenience_fee
              └─ pass-through ─┘  └─ provider margin ─┘
```

- Backend compute providers (Akash, Oyster, AO) set their own prices
- DVM providers query backend pricing, add their margin, and advertise the total in `SkillDescriptor.pricing`
- `PricingValidator` validates `ctx.amount >= kindPricing[kind]` — no metering, no refunds
- Providers who find cheaper backends or optimize execution keep more margin
- Market competition drives pricing down

**Why not per-millisecond billing:** Adds metering infrastructure complexity. The provider takes the risk of pricing correctly — just like any reseller. Per-request flat pricing (provider-set) is sufficient for v1.

**Implications:**
- No pricing logic in DVM handlers — PricingValidator handles everything upstream
- No compute metering infrastructure needed
- `ComputeAdapter` interface has no cost estimation methods — just `execute()`
- Provider economy: operators earn margin for abstracting backend complexity

---

### Decision D8-PM-005: Compute Primitive Architecture (kind:5250)

**Problem:** How should the compute primitive work, given ILP timeout constraints and varying compute backends?

**Decision:** Two-phase model with backend-agnostic adapter:

**Phase 1 — Submit (synchronous, fits ILP timeout):**
```
Client → kind:5250 ILP PREPARE (wasmRef + input + payment)
       ← ILP FULFILL { data: receipt with jobId, status: 'submitted' }
```

**Phase 2 — Result (asynchronous):**
- Option A: Client polls via kind:5251 (jobId) → gets result or status
- Option B: Provider publishes kind:6250 result event to relay, client subscribes

**Adapter interface:**
```typescript
interface ComputeAdapter {
  execute(request: ComputeRequest): Promise<ComputeResult>;
}
```

**Planned backends:**
- Oyster CVM (TEE-attested)
- Akash (GPU/bulk compute)
- Local Docker (dev/cheap)

**NOTE:** AO/HyperBEAM is NOT a compute backend — it is a blockchain. Agents interact with AO via the Chain Bridge primitive (kind:5260), broadcasting signed AO messages the same way they broadcast Ethereum transactions.

**Event format (kind:5250):**
```
Tags:
  ['i', wasmRef, 'arweave']              // WASM module (blob storage receipt)
  ['param', 'entrypoint', 'main']        // Function to call
  ['param', 'input', base64(args)]       // Serialized input
  ['param', 'maxComputeMs', '30000']     // Timeout budget
  ['bid', amount, 'usdc']                // Payment
  ['output', 'application/octet-stream'] // Expected result MIME
```

**File layout (follows Arweave DVM pattern exactly):**
```
packages/core/src/events/compute.ts          # kind:5250 builder/parser
packages/sdk/src/compute/compute-adapter.ts  # ComputeAdapter interface
packages/sdk/src/compute/oyster-adapter.ts   # Oyster CVM backend
packages/sdk/src/compute/akash-adapter.ts    # Akash backend
packages/sdk/src/compute/local-adapter.ts    # Local Docker backend (dev)
packages/sdk/src/compute/compute-handler.ts  # createComputeDvmHandler()
packages/sdk/src/compute/job-tracker.ts      # Phase 2 state management
```

---

### Decision D8-PM-006: Chain Bridge Primitive Architecture (kind:5260)

**Problem:** Agents need to interact with blockchains but managing wallets, tokens, and gas across multiple chains is prohibitively complex.

**Decision:** Chain bridge as a DVM primitive. Tier 1 (broadcast only) ships first.

**Tier 1 — Broadcast (trustless, ships first):**
Agent signs transaction locally, provider submits to chain(s) and pays gas. Provider can only submit or not submit — zero custody risk.

```
Tags:
  ['i', signedTxBytes, 'tx']
  ['param', 'chains', 'ethereum,arbitrum,base,ao']  // multi-chain broadcast
  ['param', 'operation', 'broadcast']
  ['bid', amount, 'usdc']                        // gas cost + convenience fee
```

**Multi-chain receipt (kind:6260):**
```
Tags:
  ['chain', 'ethereum', '0xabc...', 'confirmed']
  ['chain', 'arbitrum', '0xdef...', 'confirmed']
  ['chain', 'base', '0x123...', 'pending']
```

**Future tiers (NOT for initial implementation):**
- Tier 2: Construct + Broadcast (provider builds tx from intent, agent signs via callback)
- Tier 3: Custodial Execute (TEE-backed provider holds keys — significant security implications)

**Key insight:** One ILP packet, multiple chains, one receipt. Agent needs only USDC and a signing key to interact with any blockchain.

---

### Decision D8-PM-007: TOON Strategic Positioning — "Stripe for Decentralized Services"

**Problem:** How does TOON position itself relative to infrastructure providers (Akash, Oyster, AO/HyperBEAM) and chain abstraction solutions (LayerZero, Particle Network)?

**Decision:** TOON is the **demand-side protocol layer** that sits above infrastructure providers and below agent applications.

**Positioning statement:** "TOON is for agents that consume services. CLIs are for operators that provide them. TOON connects both through a unified protocol, and DVM providers earn convenience fees for bridging the gap."

**Strategic model:**
- TOON does NOT compete with compute/storage/chain providers — it makes them **interchangeable backends**
- Infrastructure operators become TOON DVM providers, earning convenience fees for their expertise
- Agents consume services through a uniform interface: Nostr events + ILP payment + kind:10035 discovery
- No protocol tokens — USDC via ILP settlement only
- No vendor lock-in — every primitive is backend-agnostic by design

**Competitive comparison:**
- vs HyperBEAM/AO: AO is a blockchain (persistent processes on Arweave). TOON is a service network. AO is one chain target behind the Chain Bridge primitive (kind:5260), not a compute backend.
- vs Akash/Oyster: They serve operators managing infrastructure. TOON serves agents consuming services. Their operators become TOON providers.
- vs LayerZero/Particle: They make agents chain-aware in friendlier ways. TOON makes agents chain-unaware entirely.

**Why agents use TOON instead of direct CLIs:**
1. No token fragmentation (one currency: USDC)
2. Unified discovery (one query: kind:10035)
3. Composable interfaces (output of one primitive feeds the next)
4. Automatic failover (provider down → pick another, same event format)
5. Multi-hop payment routing (ILP handles FX, routing, settlement)
6. Convenience fee is the price of not building infrastructure integrations

**Where direct CLIs win (and that's OK):**
- Long-running persistent infrastructure (24/7 VMs)
- Heavy customization (specific GPU types, network config)
- Cost-sensitive bulk workloads (millions of requests)
- Sophisticated operators (who become TOON providers)

---

### Decision D8-PM-008: HyperBEAM/AO as a Chain Bridge Target (NOT Compute Backend)

**Problem:** How should TOON relate to AO/HyperBEAM specifically?

**Decision (REVISED):** AO is a **blockchain**, not a compute-for-hire service. It belongs under the **Chain Bridge primitive (kind:5260)**, not Compute (kind:5250). Agents interact with AO the same way they interact with Ethereum — by broadcasting signed messages/transactions through a Chain Bridge provider.

**Correct classification:**
- **Compute backends (kind:5250):** Oyster CVM, Akash, Docker — stateless compute-for-hire
- **Chain targets (kind:5260):** Ethereum, Solana, Arbitrum, Base, **AO** — blockchains that accept signed messages

**How AO works via Chain Bridge:**
- Agent signs an AO message locally
- Chain Bridge provider has an AO wallet/HyperBEAM node
- Provider broadcasts the signed message to AO, pays the AO p4 fee from convenience fee margin
- Provider returns receipt with AO slot/tx ID

**AO's strengths as a chain target:**
- HyperBEAM is HTTP-native (RFC 9110) — provider just makes HTTP calls
- Permanent verifiability (all messages logged on Arweave)
- Device extensibility (WASM, Lua, EVM, RISC-V processes)

**AO's limitations TOON avoids:**
- Arweave dependency (TOON uses Arweave optionally, not foundationally)
- Token requirement (TOON settles in USDC, not AO/AR)
- Erlang barrier (TOON is TypeScript end-to-end)
- Docker-hostile deployment (TOON is Docker-first)

---

## Summary: The TOON Protocol North Star

```
┌─────────────────────────────────────────────────────┐
│                    AGENT LAYER                       │
│  "I need to store / compute / broadcast / message"   │
└──────────────────────┬──────────────────────────────┘
                       │ kind:5xxx ILP PREPARE + USDC
                       ▼
┌─────────────────────────────────────────────────────┐
│              TOON PROTOCOL LAYER                     │
│  Discovery (10035) + Payment (ILP) + Receipts        │
│                                                     │
│  ┌──────┐ ┌───────┐ ┌────────┐ ┌──────────────┐    │
│  │ Msg  │ │ Blob  │ │Compute │ │ Chain Bridge │    │
│  │ k:1  │ │k:5094 │ │k:5250  │ │   k:5260     │    │
│  └──────┘ └───────┘ └────────┘ └──────────────┘    │
└──────────────────────┬──────────────────────────────┘
                       │ adapter interface
                       ▼
┌─────────────────────────────────────────────────────┐
│             INFRASTRUCTURE BACKENDS                  │
│  Storage: Arweave, Filecoin, IPFS                   │
│  Compute: Oyster CVM, Akash, Docker                 │
│  Chains:  Ethereum, Solana, Arbitrum, Base, AO, ... │
└─────────────────────────────────────────────────────┘
```

Four primitives. One protocol. Backend-agnostic. Token-free. The service layer for autonomous agents.
