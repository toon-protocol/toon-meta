# Handoff: v2 EIP-712 balance-proof digest migration

**Status (2026-07-16):** Shipped end-to-end **except the connector**. The connector v2 cutover PR is written and green on CI but **HELD by an adversarial review that found HIGH fund-safety gaps** (see §5). Next action: a second fix pass on connector **#332**, re-review, then publish `connector@4.0.0` and finish `swap#63` + `store`.

Owner issues: connector **#328** (the gap tracker) and connector **#329** (design + the corrected, knowledge-grounded plan — read the latest comment first). This doc is the fast path.

---

## 1. Goal & why

Replace the v1 raw-packed balance-proof digest — `keccak256(abi.encodePacked(channelId, cumulativeAmount, nonce, recipient))`, which bound **no** chainId/contract and was cross-chain/cross-deployment **replayable** (connector#324 finding #1) — with an **EIP-712 domain-separated** digest:
- domain `EIP712Domain(name="RollingSwapChannel", version="2", chainId, verifyingContract)`
- struct `ClaimBalanceProof(bytes32 channelId, uint256 cumulativeAmount, uint256 nonce, address recipient)`
- `version="2"` makes the cutover **fail-closed** (a v1 signature can never validate as v2).

Canonical spec + golden vectors: `connector/docs/rolling-swap-v2-digest-spec.md`.

**Golden vector (hardcode in every conformance test):** chainId `8453`, verifyingContract `0x5FbDB2315678afecb367f032d93F642f64180aa3`, channelId `0x…005b`, cumulativeAmount `24000000`, nonce `24`, recipient `0x…DEADBEEF` → domainSeparator `0xb94d6e9c…594f`, **claim digest `0x8e0b1e0baf4cb5490d8d8ebcad0c51feec55adff992680c21cbf137a4434fede`**, coop-close digest `0x8b748bdf…25c0`, recovers signer `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (anvil key #0).

---

## 2. Architecture — grounded in this repo's docs (do NOT re-derive from ILP idioms)

These were established the hard way; the knowledge base is authoritative (`docs/settlement.md`, `docs/rolling-swap.md`, `context/{architecture,decisions}.md`):

- **Settlement is IN-PROCESS in the connector** — `decisions.md`: "in-process multi-chain (**not** RFC-0038's separate service)". There is **no** separate settlement-engine node. The connector is the **sole claim validator**, **and** it signs (its own peer-settlement claims, `per-packet-claim-service.ts`) **and** redeems (`SettlementExecutor` → on-chain).
- **Roles in the swap flow** (`rolling-swap.md` §2.2): the **leg-B claim is signed by the maker = `@toon-protocol/swap`'s `MultiChainClaimIssuer`** (the "mill"); leg-B is verified by the **sender/client**; the **leg-A payment claim is verified by the connector**. So the *swap* signer is `@toon-protocol/swap`, NOT the connector.
- **A connector still signs its own peer-settlement claims** (maintainer decision). Its existing `PaymentChannelProvider.signBalanceProof` just needs the **v2 digest** fed in — the leaf already exports it. **No new signer, no separate engine, no leaf `sign` primitive.**
- **Addresses come from kind:10032** (`settlement.md`): `settlementAddresses[chain]` = the peer's **recipient** address; `tokenNetworks[chain]` = the **settlement contract** (for v2 this must carry the **RollingSwapChannel** address). Self-describing BTP claims carry `chainId`/`verifyingContract`; verified **TOFU** on first use. → This is the correct source for both `recipient` and `verifyingContract` (the #332 review found the connector is NOT sourcing them this way — see §5 F1/F2/F5).
- **Package name:** the swap package is **`@toon-protocol/swap`** (the `mill→swap` rename is done; `@toon-protocol/mill` is 404).

The v2 digest primitive is DRY-extracted into a shared leaf so the five consumers stop hand-mirroring it: **`@toon-protocol/settlement-digest`** (lives in the `toon` repo, `@noble`-only). Exports: `balanceProofHashEvm(channelId, cumulativeAmount, nonce, recipient, chainId, verifyingContract)`, `coopCloseHashEvm`, `eip712DomainSeparatorEvm`, `recoverEvmSigner`/`recoverEvmClaimSigner`/`verifyEvmClaimSignature`, plus the Solana/Mina message digests. **No `sign`** (signing stays with the key-holder; consumers feed the leaf's digest to their own signer).

---

## 3. What's DONE (published to npm + merged)

| Component | Version / PR | Notes |
|---|---|---|
| `@toon-protocol/core` + `sdk` | **3.0.0** (toon#91), then **3.1.0** (toon#101) | 3.0.0 = v2 digest; 3.1.0 = adopt+re-export the leaf (behavior-identical) |
| `@toon-protocol/settlement-digest` | **1.0.0** (toon#101) | the shared leaf; `@noble`-only |
| `@toon-protocol/client` + `client-mcp` | **0.20.0** (toon-client#365) | full v2 (receive-verify + settlement-build) |
| connector `RollingSwapChannel.sol` | merged **connector#325** | on-chain v2 EIP-712 contract |
| connector 4a (leaf dep + `verifyEVMClaimV2` helper, **unwired**) | merged **connector#330** | merged with `[skip release]` → **no publish**; `@noble` kept at ^1 via leaf coexistence |

All golden vectors reproduce byte-for-byte across leaf/core/sdk/swap/client/contract.

---

## 4. IN PROGRESS — connector #332 (the v2 cutover, HELD)

**PR connector#332** (`feat/v2-verifier-4b`, `feat!:` → will cut **connector@4.0.0** via semantic-release). +2108/−1897 across 41 files. **CI is fully green** (incl. Standalone Mode E2E against anvil). **Do NOT merge/publish — it's held by the review in §5.**

It does the full cutover: wire (`EVMClaimMessage` → `cumulativeAmount`+`recipient`, `chainId`+`verifyingContract`, BTP `version='2.0'`), verify (`inbound-claim-validator.ts` → `verifyEVMClaimV2`), sign (`per-packet-claim-service` / `EVMPaymentChannelProvider.signBalanceProof` → leaf's v2 digest), redeem (`claim-receiver`/`settlement-executor` → `RollingSwapChannel.updateBalance`).

---

## 5. The review findings — the fix list (blocking the 4.0.0 publish)

Three-lens adversarial review (verify / sign / redeem). The **crypto, fail-closed cutover, wire migration, digest-vs-contract match, monotonicity, idempotency, and non-EVM paths are all SOUND.** The gaps are all **connector-side lifecycle mapping**. Full detail on the connector#332 PR comment.

- **F1 — HIGH (verify + redeem lenses agree): inbound verify never checks `recipient == our own address`.** A peer with a legitimate funded channel signs a valid claim with `recipient = an address they control`; the gate accepts, the paid write is delivered, the peer's debt is cleared at settlement, and on-chain `updateBalance` pays *them* → **theft-of-service / connector collects nothing**. Fix: in `verifyEVMClaim` (`inbound-claim-validator.ts:257-329`) and defensively in `claim-receiver.ts`, require `recipient.toLowerCase() === ownEvmAddress(chainId)`, F06-reject otherwise. Cheap, RPC-free.
- **F2 — HIGH: `verifyingContract` is resolved from the v1 `TokenNetworkRegistry`** (`evm-payment-channel-provider.ts:453-458` → `payment-channel-sdk.ts:248-251`), so `updateBalance` targets a TokenNetwork (no such selector) → **revert → the connector can never collect any EVM claim** against a real deployment. CI misses it (tests hardcode `verifyingContract`). Fix: source it from the peer's **kind:10032 `tokenNetworks[chain]`** (= RollingSwapChannel addr for v2), not `getTokenNetworkAddress`; assert at startup the resolved contract exposes `updateBalance`/`domainSeparator()`.
- **F3 — MEDIUM: EVM verify rejects `Closing` channels** (uses the v1 state path; the v2-aware `getChannelStateByContract` at `payment-channel-sdk.ts:941-983` was added but not wired; `Closing`→'closed', EVM accepts only 'opened' at `claim-receiver.ts:487`) → **stranded funds during the unilateral-close challenge window** (`RollingSwapChannel` allows `updateBalance` in Open **and** Closing). Solana/Mina accept `opened||closed`; EVM should too. Fix: wire `getChannelStateByContract` + accept Open||Closing.
- **F4 — MEDIUM: the send side still opens v1 `TokenNetwork` channels** (`payment-channel-sdk.ts:298-314`) — no path opens/funds a `RollingSwapChannel`, so the connector can only redeem externally-opened v2 channels, not fund one. Decide: if "peer funds / connector redeems" is the model, assert it + gate off v1 open for v2 tokens; else build a v2 `openChannel(channelId, signer, deposit)` path. (Biggest piece; only needed if the connector funds channels.)
- **F5 — MEDIUM (sign lens): outbound `recipient` is unvalidated and mis-sourced** (`per-packet-claim-service.ts:479` `getPeerAddress`, seeded from config / an inbound claim's `signerAddress`, not the peer's kind:10032 `settlementAddresses[chain]`; no `0x…40hex` format/chain check). Symmetric to F1/F2 on the sign side. Benign in today's single-EVM wiring. Fix: validate format + source from kind:10032.
- **Also:** add tests that exercise the **real** `verifyingContract` sourcing + `recipient-is-self` (not hardcoded addresses), so CI can't hide F1/F2 again.

---

## 6. Next steps (ordered)

1. **Fix pass on connector#332:** F1, F2, F3, F5 (+ F4 if the connector funds channels) + the real-sourcing tests. Keep the crypto foundation (it's correct).
2. **Re-run the 3-lens adversarial review** on the updated #332.
3. **Merge #332** → semantic-release cuts and publishes **`connector@4.0.0`**. Verify live on npm (`npm view @toon-protocol/connector version`).
4. **swap#63** (`feat/v2-verifier-4b`, DRAFT): bump `@toon-protocol/connector` devDep → `^4.0.0` (core/sdk `^3`, client `^0.20` already done); point `tests/integration/rolling-settlement.integration.test.ts` at the redeployed `RollingSwapChannel` addresses; green → merge. (This is the PR the whole migration exists to unblock.)
5. **store:** rebump `@toon-protocol/connector` → `^4.0.0` and republish **iff** it runs the inbound verifier.
6. **relay:** no action (no connector dependency).
7. **Operational (deploy):** redeploy `RollingSwapChannel` at fresh addresses per EVM chain; update nodes' **kind:10032 `tokenNetworks`** to publish the RollingSwapChannel address; drain/close v1 channels first.

---

## 7. Gotchas (these cost real time this round)

- **The connector uses `npm`** (`npm ci`, `package-lock.json`), NOT pnpm. `toon`/`swap`/`toon-client` use **pnpm 8.15.9** via `corepack pnpm@8.15.9` — a newer pnpm rewrites `pnpm-lock.yaml` v6→v9 and **breaks their CI**. Verify the lockfile diff is minimal + stays `lockfileVersion: '6.0'`.
- **GitHub PR checks compile the PR *merged into* main.** A rename that's clean on the branch head can still fail type-check if `main` gained a caller of the old name. Test the merge, not just the head. (This is what red-CI'd #332 initially.)
- **Do NOT trust an agent's "local validation passed."** Verify against the actual GitHub checks — a 4b agent claimed local-pass while CI was red across the board.
- **New npm package names lag on the registry packument** (~minutes) even after `changeset publish` reports success. Check the **version-specific endpoint** (`https://registry.npmjs.org/<pkg>/<ver>` → 200), not just the packument versions list.
- **semantic-release (connector):** every merge to main auto-publishes by commit type. Put **`[skip release]`** in the squash-commit subject to land code without publishing (that's how 4a merged). A `feat!:`/`BREAKING CHANGE` commit cuts the major.
- **Two `@noble` majors coexist fine** in the connector (its own `^1` top-level + the leaf's `^2` nested) because the leaf's API is noble-type-free and the connector bundles nothing (plain `tsc`). Do NOT migrate the connector's own `@noble` to v2 — it touches Nostr gift-wrap + RFC9421 crypto (risky, out of scope).
</content>
