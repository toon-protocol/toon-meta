# TOON Protocol — Claude Agent Skills Audit

**Date:** 2026-06-16
**Scope:** 124 skills in `/home/jonathan/Documents/toon-meta/.claude/skills/`
**Method:** Evidence-based. Skill claims cross-referenced against the actual implementation in the connector (`/home/jonathan/Documents/connector`), TOON core/SDK (`/home/jonathan/Documents/toon/packages/{core,sdk}`), the relay (`/home/jonathan/Documents/relay`), and the Arweave DVM store (`/home/jonathan/Documents/store`).
**Constraint:** Analysis only — no skill files were edited.

---

## 1. Inventory & Categorization

| Category | Count | Disposition |
| --- | --- | --- |
| **BMAD framework** (`bmad-*`) | 60 | KEEP — upstream BMAD method framework, generic, not TOON-specific. No deep audit needed (see note). |
| **Interledger/ILP RFC skills** (`rfc-00XX-*`) | 18 | **UPDATE (all)** — vanilla-Interledger boilerplate; describe none of TOON's real implementation. Highest priority. |
| **NIP protocol skills** | 28 | KEEP, mostly accurate; 1 stale kind (dvm-protocol). |
| **TOON product skills** | 3 | KEEP — `toon-client`, `proxy-operator`, `proxy-live-e2e` are accurate and current. |
| **Git skills** | 6 | KEEP — `git-arweave`, `git-collaboration`, `git-identity`, `git-objects`, `git-workflows`, plus NIP-34 content. Aligned with kind:5094 Arweave pipeline. |
| **Utility / meta skills** | 9 | KEEP — `akash-deploy`, `excalidraw-diagram`, `playwright-cli`, `shadcn`, `skill-creator`, `skill-eval-framework`, `nip-to-toon-skill`, `nostr-social-intelligence`, `search`. |
| **Total** | **124** | |

BMAD breakdown (no per-skill audit performed, by instruction): agents (`bmad-agent-*`, `bmad-cis-agent-*`) ~13, workflows/utilities ~47. These are an installed upstream framework (BMAD method) and are TOON-agnostic. Recommendation: KEEP as-is; they are orthogonal to the protocol. Note only that several are explicitly **DEPRECATED upstream** and self-describe as such: `bmad-create-prd`, `bmad-edit-prd`, `bmad-validate-prd` (consolidated into `bmad-prd`, "removed in v7"). Those 3 are safe to remove whenever the BMAD framework is upgraded, but that is a framework-maintenance decision, not a TOON correctness issue.

NIP skill set (28): `app-handlers, badges, content-control, content-references, drafts-and-expiration, dvm-protocol, encrypted-messaging, file-storage, highlights, lists-and-labels, long-form-content, marketplace, media-and-files, moderated-communities, nostr-protocol-core, polls, private-dms, public-chat, relay-discovery, relay-groups, sensitive-content, social-identity, social-interactions, user-statuses, visual-media` + the git/NIP-34 skills counted under Git.

---

## 2. Unused / Obsolete Audit (non-BMAD skills)

Good news first: a targeted grep for the known-archived artifacts — **`pet-dvm`, `memvid`, "pet game", `pet-circuit` (as a feature)** — found **no skill referencing any of them as live functionality**. The only `pet-circuit` hit is in `proxy-live-e2e/SKILL.md:31` and is a *guard* ("NEVER pet-circuit" — don't run those memory-heavy tests), which is correct and should stay.

| Skill | Finding | Rationale (evidence) | Recommendation |
| --- | --- | --- | --- |
| `dvm-protocol` | **kind:5250 listed as a live "compute" job kind** | The Dungeon DVM was removed. `store/src/entrypoint-dvm.ts:34`: *"Registers ONLY kind:5094 Arweave DVM. kind:5250 Dungeon DVM was removed."* The skill's line "5000 (text generation), 5094 (blob storage), **5250 (compute)**, and others" presents 5250 as supported. | **UPDATE** — drop 5250 as a TOON-supported kind (keep it only as a generic NIP-90 example with an explicit "not deployed on TOON" note); make kind:5094 the canonical TOON DVM. kind:5000 text-gen is also not deployed in `store` (only 5094 is registered) — recommend reframing 5000 as "generic NIP-90, not a TOON node type." |
| `dvm-protocol` | "the job request IS the payment … no separate settlement step" | Accurate to the prepaid model, consistent with `sdk` Arweave DVM + FULFILL-data tx-id flow (`sdk/src/create-node.ts:252`). | KEEP (this part is correct) |
| `relay-discovery` | kind:10035 / kind:10036 / kind:10033 references | All real TOON kinds (10032 peer-info, 10035 SkillDescriptor, 10033 attestation are in the 10032–10099 TOON range, `relay/.../SqliteEventStore.ts:57-65`). | KEEP |
| `app-handlers`, `relay-discovery` | kind:10035 SkillDescriptor | Confirmed real: `sdk/src/skill-descriptor.ts:5` "embedded in kind:10035 events to advertise DVM capabilities." | KEEP |
| All other NIP skills | Generic Nostr event kinds (kind:1, 5, 8, 30009, 30023, 1063, 1617, etc.) | The TOON relay is a generic NIP-01 store accepting arbitrary kinds (`relay/.../NostrRelayServer.ts`, no kind whitelist). These kinds are structurally valid; cost-per-byte framing is correct. | KEEP |

No skill is a duplicate/superseded copy of another (each NIP skill covers a distinct NIP family). No skill describes a removed node type. **Net obsolescence load is low** — only `dvm-protocol`'s kind:5250 (and arguably kind:5000) is genuinely stale.

---

## 3. ILP / RFC Accuracy Audit  *(highest priority)*

### The systemic problem

**All 18 `rfc-00XX-*` skills are identical ~36-line templates of generic Interledger documentation.** Every one:
- Describes vanilla interledger.org behavior, not TOON.
- Tells the agent to call an external MCP tool `mcp__interledger_org-v4_Docs__search_rfcs_documentation` (an interledger.org doc-search server) as its sole "capability."
- Contains a generic "Core Capabilities → RFC Documentation Search / Answer Questions / Implementation Guidance" block and a "Common Topics" list copied from the RFC abstract.
- **Mentions nothing about TOON**: no payment-channel claims, no EIP-712/Ed25519/Pallas balance proofs, no `g.proxy` apex/child topology, no town/store/mill, no per-byte pricing, no "pay-to-write / free-read."

This is the inverse of the NIP skills, which are all explicitly TOON-contextualized ("Implements NIP-XX on TOON's ILP-gated relay network"). The RFC skills were never localized to the implementation.

### Ground truth — what TOON's connector actually does

Established from `/home/jonathan/Documents/connector/packages/connector/src`:

- **Payment = signed payment-channel balance-proof claim over BTP**, NOT an ILP HTLC. Claim envelope `btp/btp-claim-types.ts:32-199`: `BaseClaimMessage` + chain-specific bodies — `EVMClaimMessage` (EIP-712 signature, `channelId/nonce/transferredAmount/signature/signerAddress`, lines 80-92), `SolanaClaimMessage` (Ed25519, base58 pubkey, 109-125), `MinaClaimMessage` (zk-SNARK/Poseidon commitment, 142-179). BTP sub-protocol name `payment-channel-claim` (`btp-claim-types.ts:195`).
- **Claims validated at ingress** against a known channel / self-describing chain domain — `btp/inbound-claim-validator.ts:196-519`. Zero-amount packets and parent→child packets skip the claim (`:124-146`).
- **PREPARE/FULFILL/REJECT exists** (BTP framing, `btp/btp-types.ts:9-17`) but `executionCondition`/`fulfillment` are **placeholder/zero** except in the NIP-59-wrapped-claim path; payment is proven by the *claim*, not by an HTLC preimage.
- **BTP over WebSocket is the only transport** (RFC-0023-style framing + `authToken`), plus optional ATOR/SOCKS5h `.anon` overlay. No ILP-over-HTTP.
- **In-process multi-chain settlement engines** (`settlement/provider/{evm,solana,mina}-payment-channel-provider.ts`) redeeming claims on-chain via `claimFromChannel/closeChannel/settleChannel` — **not** the RFC-0038 separate-process HTTP settlement-engine interface.
- **SPSP, STREAM, payment-pointers, STREAM-receipts, ILP-over-HTTP: ABSENT from the pay path.** `facilitator/spsp-client.ts` exists but is **imported nowhere in production** (only tests) — vestigial. Greps for `STREAM`, `paymentPointer`, `ilp-over-http` in `src` (excluding tests/`facilitator`) return zero real hits.
- **Addressing:** hierarchical `g.*` longest-prefix (`routing/routing-table.ts:135-157`); TOON uses `g.proxy` apex / child nodeIds.
- **Peering:** static config with `relation: 'parent' | 'peer' | 'child'` (`config/types.ts:71-88`); parent forwards to child **without a per-packet claim** (free-forward, settled in aggregate). Connector fee deducted before forward (~0.1% default, `core/packet-handler.ts` `calculateConnectorFee`).
- **OER:** real but minimal local parser (`encoding/oer-parser.ts`); canonical ILP packet codec delegated to `@toon-protocol/shared`.

### Per-RFC-skill edit list

| Skill | What it claims (generic) | What TOON actually does | Concrete edits needed |
| --- | --- | --- | --- |
| **rfc-0009-simple-payment-setup-protocol** | SPSP is how payments are set up; payment-pointer resolution. | SPSP **not used in the pay path**; `facilitator/spsp-client.ts` is imported nowhere in production. TOON sets up payments via on-chain payment channels + signed claims; peer/service discovery is via Nostr **kind:10032** peer-info events, not SPSP. | State plainly: "TOON does NOT use SPSP for payment setup. Discovery = kind:10032; setup = payment-channel open + signed claims over BTP." Demote to historical/reference. |
| **rfc-0026-payment-pointers** | `$paymentpointer` HTTPS resolution as the user-facing address. | No payment-pointer resolution anywhere in production. TOON addresses are **ILP addresses** (`g.proxy.town`) + Nostr **npub/pubkey** identity. | Replace the "how to resolve a payment pointer" guidance with: "TOON has no payment pointers. Use ILP addresses + kind:10032 advertisements." |
| **rfc-0029-stream** | STREAM is the transport (chunking, flow control, e2e encryption, quoting). | **STREAM not implemented** (zero trace in connector). Each write is a single BTP packet carrying one claim; no chunking/flow-control/quoting. | State "TOON does not implement STREAM. One paid write = one BTP packet + one balance-proof claim. No multi-packet stream, no quoting." |
| **rfc-0039-stream-receipts** | STREAM receipts as proof of payment. | **Absent** (STREAM absent). Proof of payment in TOON is the **counterparty-signed balance-proof claim** + on-chain channel state, plus the relay FULFILL. | State "no STREAM receipts. Payment proof = signed payment-channel claim (nonce/cumulative amount) + on-chain settlement; delivery proof = ILP FULFILL." |
| **rfc-0022-hashed-timelock-agreements** | HTLC: hashlock + timelock conditional escrow secures multi-hop. | TOON uses ILP PREPARE/FULFILL framing but `executionCondition`/`fulfillment` are **placeholder/zero**; security comes from the **signed claim**, not a hash-preimage HTLC. Only the optional NIP-59-wrapped-claim path derives a preimage via ECDH. | State "TOON does not use classic HTLCs for payment. Payment is secured by the signed payment-channel claim; conditions are placeholders. (Optional NIP-59 wrapper derives a preimage via ECDH, `settlement/privacy/nip59-claim-wrapper.ts`.)" |
| **rfc-0023-bilateral-transfer-protocol** | BTP 2.0 bilateral transfer over WebSocket; generic. | This is the **closest-to-accurate** RFC. TOON DOES use BTP/WebSocket framing (`btp/btp-types.ts`) with `authToken`, and adds the **`payment-channel-claim` sub-protocol** (`btp-claim-types.ts:195`). | KEEP the most, but add TOON specifics: name the `payment-channel-claim` sub-protocol, the claim shapes, `authToken` peering, ATOR `.anon` option, and that BTP is TOON's **only** transport. |
| **rfc-0015-ilp-addresses** | Hierarchical ILP address grammar/validation; generic. | Accurate in spirit. TOON uses `g.*` longest-prefix (`routing-table.ts:135-157`); concrete scheme is `g.proxy` (apex) + child node addresses (`g.proxy.town`, etc.). | Add a TOON section: the `g.proxy` apex/child convention, how `g.proxy.town` resolves, and that mis-tagged parent/child addresses cause F06 rejects. |
| **rfc-0027-interledger-protocol-4** | ILPv4 packet format, conditions, error codes. | TOON uses ILPv4 PREPARE/FULFILL/REJECT framing and **error codes** (the connector maps app codes → `T00/F06/F03/...`, see connector README BLS table), but conditions are placeholders and the value layer is claims. | Add: TOON's real error-code surface (F06 = parent/child mis-tag / "no reason to pay us", T04 = insufficient funds, etc.), and that the condition/fulfillment fields are not the payment proof. |
| **rfc-0032-peering-clearing-settlement** | Generic peering/clearing/settlement between connectors. | TOON: static `relation: parent\|peer\|child` peers (`config/types.ts:71-88`); **parent→child is free-forward (no per-packet claim)**; clearing = off-chain balance accrual; settlement = on-chain channel redemption when threshold crossed. | Rewrite around TOON's parent/child apex model, the free-forward rule, threshold settlement, and the connector fee (`calculateConnectorFee`). This is a high-value rewrite. |
| **rfc-0038-settlement-engines** | RFC-0038 = a **separate settlement-engine process** with `/accounts` + `/settlements` HTTP endpoints. | TOON does **not** implement the RFC-0038 HTTP interface. It has **in-process** EVM/Solana/Mina providers (`settlement/provider/*.ts`) that redeem signed claims on-chain (`claimFromChannel/closeChannel/settleChannel`). | State "TOON does NOT implement the RFC-0038 HTTP settlement-engine interface. Settlement is in-process, multi-chain, claim-driven on-chain redemption." List the three providers and methods. |
| **rfc-0035-ilp-over-http** | ILP packets transported over HTTP request/response. | **Not implemented.** BTP/WebSocket is the only ILP transport. (HTTP exists only for the admin API and the local-delivery BLS `/handle-packet` callback — neither is ILP-over-HTTP.) | State "TOON does not use ILP-over-HTTP. Transport is BTP/WebSocket (+ ATOR). HTTP is used only for admin API and the local-delivery BLS callback." |
| **rfc-0030-notes-on-oer-encoding** | OER/ASN.1 binary encoding of ILP packets. | Partially real: local `encoding/oer-parser.ts` utilities; canonical ILP packet codec is in `@toon-protocol/shared`. Note: **TOON event payloads are TOON-encoded** (the codec), distinct from ILP-packet OER. | Add: distinguish ILP-packet OER (handled by `@toon-protocol/shared`) from the **TOON event codec** that encodes the Nostr event inside the packet data. |
| **rfc-0001-interledger-architecture** | Generic ILP layer model. | Accurate as background, but omits TOON's actual stack: connector (`g.proxy`) + town/store/mill children, claims-over-BTP, multi-chain settlement, ATOR. | Add a "How this maps to TOON" section (apex/child topology, claim-gated writes, free reads). |
| **rfc-0018-connector-risk-mitigations** | Generic connector risk controls. | Partially real: token-bucket rate limiting (`security/rate-limiter.ts`, `token-bucket.ts`), IP allowlists, audit logging. | Add: name TOON's real controls (`security/` rate-limiter, allowlists, `adminApi.apiKey`, ATOR privacy) instead of generic advice. |
| **rfc-0031-dynamic-configuration-protocol** | RFC-0031 runtime config negotiation. | TOON has **custom** dynamic peer/route management via the admin API (`http/admin-api.ts`, `POST /admin/peers`, `/admin/routes`), not the RFC-0031 protocol. | State "TOON does not implement the RFC-0031 protocol; runtime reconfiguration is via the connector admin API." |
| **rfc-0033-relationship-between-protocols** | How ILP protocol layers compose. | Generic; for TOON the live composition is BTP + claims + Nostr/TOON codec + multi-chain settlement (no SPSP/STREAM layer). | Add a TOON layer diagram: Nostr event → TOON codec → ILP packet data → BTP + `payment-channel-claim` → connector → child. |
| **rfc-0034-connector-requirements** | Generic connector compliance requirements. | TOON's connector (`@toon-protocol/connector`) is the reference implementation; requirements are met implicitly. | Point at the real connector package + its README/`CONNECTOR_RELEASE_CONTRACT.md` as the authoritative "requirements" rather than the generic RFC. |
| **rfc-0019-glossary** | Generic ILP glossary. | Mostly reusable, but missing TOON terms (apex, child, claim, balance proof, free-forward, town/store/mill, kind:10032). | Add TOON-specific glossary entries. |

> **Cross-link note:** `toon-client/SKILL.md` already tells agents the RFC skills cover "ILP/BTP internals" (`rfc-0001`, `rfc-0027`, `rfc-0023`). Until the RFC skills are localized, that cross-reference points agents at generic Interledger docs instead of TOON behavior — reinforcing the urgency of at least fixing rfc-0001/0023/0027.

> **MCP-tool dependency:** every RFC skill's only "capability" is calling `mcp__interledger_org-v4_Docs__search_rfcs_documentation`. If that MCP server is not installed in the operator environment, these skills are effectively inert. Recommend: replace the doc-search dependency with inline TOON-localized content (the edits above) so the skills work standalone.

---

## 4. NIP Notes

- **Event kinds verified against implementation:**
  - kind:10032 ILP Peer Info — real (`toon/packages/core/src/constants.ts:11` `ILP_PEER_INFO_KIND = 10032`). Used by `nostr-protocol-core`, `nip-to-toon-skill`, `proxy-live-e2e`. ✓
  - kind:10035 SkillDescriptor / DVM discovery — real (`toon/packages/sdk/src/skill-descriptor.ts:5`). Used by `app-handlers`, `dvm-protocol`, `relay-discovery`. ✓
  - kind:5094 Arweave blob-storage DVM — real and the **only** registered DVM (`store/src/entrypoint-dvm.ts:34`). ✓ Correctly used by the git skills, `file-storage`, `media-and-files`, `dvm-protocol`.
  - kind:5250 "Dungeon/compute" DVM — **REMOVED** (`store/src/entrypoint-dvm.ts:34`). Only `dvm-protocol` still lists it as a job kind → **UPDATE** (see §2).
  - kind:5000 text-gen — generic NIP-90, **not deployed** as a TOON node (store registers only 5094). `dvm-protocol` presents it as a supported example; recommend a "not a TOON node type" caveat.
- **Relay generality:** the relay is a generic NIP-01 store (no kind whitelist; replaceable 10000-19999, param-replaceable 30000-39999, plus TOON 10032-10099 per `relay/.../SqliteEventStore.ts:57-65`). So all the standard Nostr kinds the NIP skills publish (kind:1, 5, 8, 30009, 30023, 1063, 1617-1633, 1059/1060, 30078, etc.) are structurally accepted. The skills' per-byte cost framing matches the pay-to-write model.
- **No NIP skill references a removed/archived feature.** The 28 NIP skills are uniformly TOON-localized ("Implements NIP-XX on TOON's ILP-gated relay network") — a good template the RFC skills should follow.

---

## 5. Prioritized Action Plan

| Priority | Action | Effort |
| --- | --- | --- |
| **P0** | **Fix `dvm-protocol` kind:5250** (and caveat kind:5000): mark 5250 as removed/not-deployed, make kind:5094 the canonical TOON DVM. Only concrete factual error in the NIP set. | ~15 min, 1 skill |
| **P0** | **Localize the 3 RFC skills the product skill already cross-references** (`rfc-0023-bilateral-transfer-protocol`, `rfc-0027-interledger-protocol-4`, `rfc-0001-interledger-architecture`): add TOON sections (BTP `payment-channel-claim` sub-protocol, claim shapes, apex/child topology, real error codes). Highest leverage because `toon-client` points agents here. | ~1.5 hr, 3 skills |
| **P1** | **Correct the "TOON doesn't do this" RFC skills** — `rfc-0009` (SPSP), `rfc-0026` (payment-pointers), `rfc-0029` (STREAM), `rfc-0039` (stream-receipts), `rfc-0035` (ILP-over-HTTP), `rfc-0022` (HTLC), `rfc-0038` (settlement-engines). Each needs a clear "TOON does NOT use X; it uses Y" statement so agents stop hallucinating SPSP/STREAM flows. | ~2 hr, 7 skills |
| **P1** | **Rewrite `rfc-0032-peering-clearing-settlement`** around the parent/child free-forward apex model + threshold on-chain settlement + connector fee. High-value, frequently-relevant. | ~45 min, 1 skill |
| **P2** | **Localize the remaining RFC skills** (`rfc-0015`, `rfc-0030`, `rfc-0018`, `rfc-0031`, `rfc-0033`, `rfc-0034`, `rfc-0019`) with TOON sections; replace the `mcp__interledger_org-v4_Docs__*` sole-dependency with inline content so they work standalone. | ~2 hr, 7 skills |
| **P3** | **BMAD hygiene (optional):** remove the 3 self-deprecated skills (`bmad-create-prd`, `bmad-edit-prd`, `bmad-validate-prd`) when next upgrading BMAD; otherwise leave the framework untouched. | trivial |

**Bottom line:** The protocol skills (NIP + TOON product) are in good shape — only `dvm-protocol`'s kind:5250 is stale. The entire `rfc-00XX-*` set is the real liability: 18 generic Interledger templates that misrepresent TOON's payment model (claims-over-BTP, not SPSP/STREAM/HTLC) and depend on an external MCP doc-search tool. Fixing them is mechanical (well-bounded per-skill edits, no architectural ambiguity) and the per-skill edits above are concrete enough to execute directly.
