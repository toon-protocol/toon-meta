# Party Mode Design Decisions — 2026-03-20

## Prepaid Protocol Model & settleCompute() Deprecation

**Context:** Discussion about DVM compute settlement, prefix claiming (Story 7.6), and the protocol thesis ("sending a message and sending money are the same action").

**Participants:** Jonathan (product owner), Winston (architect), John (PM), Mary (analyst)

---

### Decision 1: Prepaid DVM Model (Epic 7 Refinement)

**Problem:** The current DVM flow uses `settleCompute()` to send a separate empty-data ILP packet for compute payment after the result is delivered. This breaks the protocol thesis — "sending a message and sending money are the same action" — by decoupling payment from the request.

**Decision:** Adopt a **prepaid bid model** where the Kind 5xxx job request's ILP PREPARE amount equals the provider's advertised price (from `SkillDescriptor.pricing`). The request packet IS the payment. `settleCompute()` is deprecated in Epic 7.

**New DVM Flow:**
```
1. Provider publishes kind:10035 with SkillDescriptor (pricing = price list)
2. Customer discovers provider, reads pricing
3. Customer sends Kind 5xxx request + payment in ONE ILP PREPARE
   (amount = advertised price from SkillDescriptor.pricing)
4. Provider handler validates ctx.amount >= advertised price
5. Provider processes job, sends Kind 6xxx result back (amount tag = informational)
```

**Implications:**
- `settleCompute()` on `ServiceNode` deprecated — may be removed or retained as alias
- `publishEvent()` gains optional `amount` override for customer to set ILP PREPARE amount to advertised price
- `bid` tag semantic shift: Epic 5 = "I offer to pay this much" → Epic 7 = "I won't pay more than this" (client-side safety cap)
- Provider profit incentive: if bid/advertised price exceeds actual compute cost, provider keeps the difference
- If bid < advertised price, SDK refuses to send (client-side guard)

### Decision 2: Prefix Claim Payment (Story 7.6)

**Problem:** Story 7.6 originally described prefix claims with a separate payment mechanism, which would also break the protocol thesis.

**Decision:** The prefix claim event's ILP PREPARE amount IS the prefix price. One packet carries the claim request data AND the payment. The upstream handler validates `ctx.amount >= prefixPricing.basePrice`.

**Pattern:** Identical to the prepaid DVM model — provider advertises price (in kind:10032 `prefixPricing`), customer sends message + payment in one packet.

### Decision 3: Supply-Driven Marketplace Topology

**Problem:** The original DVM model was demand-driven (customer posts job, waits for provider). This doesn't fit the prepaid model well.

**Decision:** The DVM marketplace is **supply-driven**: providers advertise capabilities and pricing in `SkillDescriptor` (kind:10035), customers discover providers, compare offerings, and send paid requests directly.

**SkillDescriptor.pricing becomes the price tag, not a negotiation starting point.**

### Decision 4: Unified Protocol Pattern

**Observation:** All three monetized flows in TOON now follow the same pattern:

| Flow | Advertisement | Payment Signal | Packet |
|------|-------------|---------------|--------|
| Relay write | kind:10035 `basePricePerByte` | amount = price × bytes | Kind 1 + payment |
| DVM compute | kind:10035 `SkillDescriptor.pricing` | amount = advertised price | Kind 5xxx + payment |
| Prefix claim | kind:10032 `prefixPricing` | amount = prefix price | Prefix claim + payment |

One protocol primitive. Message = money. Three use cases.

### Decision 5: Prefix Claim Uses Own Event Kinds (Not DVM)

**Problem:** Could DVM event kinds (5xxx/6xxx/7000) be reused for prefix claiming?

**Decision:** No. Prefix claiming is a **stateful control-plane operation** (mutates routing topology, persistent state) vs. DVM which is a **stateless data-plane operation** (process input, return output). Prefix claims get their own event kinds in the 10032-10099 TOON service advertisement range.

**However:** The ILP payment mechanism is identical — both use the same "message + money in one packet" pattern.

---

## Impact on Existing Stories

- **Story 5.3 (settleCompute):** `settleCompute()` deprecated in Epic 7; prepaid model replaces it
- **Story 7.6 (Prefix Claim):** Payment is the ILP PREPARE amount on the claim request packet
- **Epic 7 overall:** May need a new story for `publishEvent()` amount override and bid semantic shift
- **SkillDescriptor:** `pricing` field becomes the authoritative price list (not a suggestion)
