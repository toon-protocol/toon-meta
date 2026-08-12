# Audit — `docs/two-node-architecture.md`

**Scope:** primary-source audit of the two-node target architecture against `connector` (`main`, `6439562c`), `toon` (`origin/main`, `53196fc`), `toon-client` (`fix/republish-clients-live-genesis`, `7630aeb`, plus `origin/main`), `rig` (`main`, `7243bd4`), `relay`, `store`, and npm. Conducted 2026-08-12. The document under audit was written at connector `275ff37`; `main` is now **20 commits** past that.

---

## Summary verdict

**The reasoning survives; the citations and two premises do not.**

Everything the document argues *from* — that ILP's parent/child/peer taxonomy is absent, that a `[[routes]]` row is a prefix plus exactly one target, that prefixes are opaque and matched longest-first at segment boundaries, that a `[[peers]]` credential is two-sided, that channels are bidirectional with two per-participant legs, that a short forward is an `F03` and not a subsidy — is **true against today's code**. The load-bearing negative in §0.2 ("nothing on the connector side reads `ILP_ROOT_PREFIX`") is **confirmed**: every `g.toon` literal in `crates/` is inside a `#[cfg(test)]` module, a doc example or a test fixture (152 occurrences, zero in a production path).

Three things break:

1. **§1.3's config blocks would now refuse to boot.** ADR 0031 + ADR 0033 (connector #868/#882, PRs #913/#914/#916, merged 2026-08-10 → 08-12) **retired `ceiling` and `flush_interval_ms`**. Both keys are now parsed-and-rejected traps: `ConfigError::PeerCeilingRemoved` (`crates/connector-config/src/peer.rs:497-499`) and `PeerFlushIntervalRemoved` (`:500-502`). The relay-box block in §1.3 sets both; the store-box block sets `ceiling`. `ConfigError::AcceptOnlyPeerWithoutCeiling` — row 5 of §0.3's table — **no longer exists** (`docs/adr/0033-the-exposure-machinery-is-retired-not-restated.md:77`; struck through at `docs/protocol/peer-carriage-spec.md:799-802`). §1.3 note 3, §2b.2's inventory row, and §3.4's "Both boxes' existing rows carry `ceiling = 1000000`" all fall with it.

2. **§5's premise is false against `toon` `origin/main`.** The committed genesis seed **already did the two-node cutover** (`f706e3a`, "Reseed genesis peers with both surviving nodes"). It is now two entries — `g.toon.relay` / `wss://proxy.relay.devnet.toonprotocol.dev/ilp/btp` under the same `30fdd01d…` pubkey, and `g.toon.ario` / `wss://proxy.ario.devnet.toonprotocol.dev/ilp/btp` under `499cdd71…`. `g.toon` does not appear in the file. Core is `3.3.0` and **published**. But the published `@toon-protocol/client-mcp@0.36.9` **still bakes the old single-entry seed** — verified by unpacking the tarball: `package/dist/chunk-I5UKJEJM.js:2114-2121` contains `ilpAddress: "g.toon"` and `btpEndpoint: "wss://proxy.devnet.toonprotocol.dev/ilp/btp"`. §5.5's republish chain is therefore *still required*, exactly as described, and **§5.2's hazard is now live rather than prospective**: `config.ts:380` takes `loadGenesisPeers()[0]`, which against core 3.3.0 is `g.toon.relay`, and `deriveRouteDestinations('g.toon.relay')` returns `{publish: 'g.toon.relay', store: 'g.toon.relay'}`. Uploads will route into the relay's write handler the moment a client-mcp is rebuilt against core 3.3.0 without the announce-driven split.

3. **All three preamble "unreconciled" items are settled.** #891 merged 2026-08-08, #892 merged 2026-08-09, and **#906 merged 2026-08-09 built `infra/linode-faucet/` — its own box, no connector, USDC only**, which resolves the contested §4 in §4's favour. #867 remains open. See "PR / issue status" below.

**Citation health:** of ~130 distinct `file:line` citations extracted from the document, **roughly 60 no longer resolve as written** (enumerated in Q1 below), of which **six were already wrong at `275ff37`** and **three now point at deleted code**. Every citation not listed in Q1 was checked and still resolves. The document's own Appendix warning ("Line numbers drift; re-verify before acting on any single line") was correct and is now load-bearing.

---

## Q1 — Citation drift

Grouped by repo. "Spec line" is the line in `docs/two-node-architecture.md`.

### connector — code

| Spec line | Citation as written | Doc claims | Actual now |
|---|---|---|---|
| 33 | `crates/connector-config/src/config.rs:279` | `resolve_routes` | **Wrong when written.** `resolve_routes` is *called* at `config.rs:278`; `:279` is `parse_peer_exposure`. The function itself is defined at `crates/connector-config/src/route.rs:437`. |
| 34, 564 | `crates/connector-runtime/src/connector.rs:1184-1198` | `max_by_key` over matched prefix length, then priority | Moved to **`connector.rs:1008-1011`**. `:1184-1198` is now #875's greeted-forward retry arm. The segment-boundary predicate itself is at **`crates/connector-domain/src/route.rs:9-25`** (`matches`/`select_route`), which the document never cites. |
| 34, 564 | `crates/connector-cli/src/announce.rs:1207-1213` | matching predicate restated for announce | Moved to **`announce.rs:1049-1058`** (`fn route_matches`, comment at `:1051-1052`, test at `:1765-1769`). `:1207-1213` is now the ledger-fork guard. |
| 60, 563 | `crates/connector-config/src/peer.rs:562` / `:557-563` | `AcceptOnlyPeerWithoutCeiling`; accept-only requires explicit ceiling | **The error no longer exists.** `:557-563` is now the `PeerConfig` struct literal's field assignments. The refusal that replaced the field is `PeerCeilingRemoved` at **`peer.rs:497-499`**. |
| 78 | `crates/connector-config/src/peer.rs:414-422` | `endpoint`; absent means accept-only | Moved to **`peer.rs:424-429`** (`fn endpoint`). `:414-422` is now `peer_answer_timeout_ms` + `fn id`. |
| 81 | `crates/connector-config/src/peer.rs:448-455` | `ceiling` — most unclaimed value carried before refusing | **Nothing at that location documents a ceiling.** `:442-452` is `can_originate`, `:454-458` is `claim_ack_timeout_ms`. Claim is dead, not merely moved. |
| 99, 562 | `crates/connector-config/src/peer.rs:565` | `let can_originate = endpoint.is_some() \|\| expose.exposes(PeerCarriage::Btp);` | Moved to **`peer.rs:552`** (verbatim). `:565` is now the loop's closing brace. |
| 76 | `crates/connector-config/src/peer.rs:390-407` | one value per peering relation, never per carriage/connection | Still *inside* the range but off-centre: the sentence is at **`peer.rs:402-405`**; `:390` is now `flush_interval_ms`. Marginal. |
| 172, 565 | `crates/connector-client-edge/src/lib.rs:1050-1057` | `over_carried_reject` | Moved to **`client-edge/src/lib.rs:873-880`**. `:1050-1057` is now `handle_probe`. |
| 174 | `crates/connector-runtime/src/connector.rs:976-978` | call site of `amount_after_fee` | Moved to **`connector.rs:1124`**. `:976-978` is now `reject_ineligible`. |
| 176, 567 | `crates/connector-runtime/src/connector.rs:691-706` | ADR 0029's terminating-price `F03` on a peer arrival | Moved to **`connector.rs:785-816`** (doc `:768-784`, check `:795-811`, `accumulated_cost: 0` at `:808`). `:691-706` is now `leased_routes`/`metrics`. |
| 249 | `crates/connector-cli/src/announce.rs:1487-1590` | `pay_the_through_url` | Moved to **`announce.rs:1328-1441`**. |
| 261, 572 | `crates/connector-cli/src/announce.rs:1548-1556` | `InsufficientHeadroom`, claim above deposit refused | **Relocated out of the file** by #893. Now `crates/connector-runtime/src/outbound_client.rs:443-452` (check) and `:156-169` (error + rationale, verbatim). `announce.rs:227-233` carries the CLI-side error, `:428-432` the mapping. |
| 296, 571 | `crates/connector-runtime/src/claim.rs:1055-1089` | `verify_signature`, `UnknownChannel`/`SignatureInvalid`, both arms | Moved to **`claim.rs:1009-1043`**. (`claim.rs:438-442` — counterparties map, recovered from signature — is **still exact**.) |
| 431, 580 | `crates/connector-cli/src/announce.rs:460` and `:562-566` | `RouteHints` field; `routes: RouteHints { publish, store }` emitted | Field now **`announce.rs:493`** (`pub routes: RouteHints`), struct at `:505`, emission at **`:596-598`**. |
| 215, 568 | `devnet_configs_load.rs:200,227,238,242,253,262` | the six pricing constants | All moved: `EXPECTED_STORE_PRICE` **:214**, `EXPECTED_RELAY_PRICE` **:240**, `EXPECTED_APEX_FORWARD_PRICE` **:250**, `EXPECTED_APEX_FORWARD_FEE` **:254**, `EXPECTED_RELAY_FORWARD_PRICE` **:264**, `EXPECTED_RELAY_FORWARD_FEE` **:273**. (`include_str!` at `:123-125` still exact.) |

### connector — docs

| Spec line | Citation | Doc claims | Actual now |
|---|---|---|---|
| 89, 561 | `docs/protocol/peer-carriage-spec.md:150-163` | wrong secret downgrades to client, oracle rationale | Moved to **`:336-342`**. `:150-163` is now #880/#881's send-side prose. |
| 89, 561 | `…peer-carriage-spec.md:218-232` | named regression list, "correct `peerId` with a wrong `secret`" | Moved to **`:396-399`** (list) and `:132` (the read-it-this-way caveat). `:218-232` is now a struck-through, explicitly *superseded* block ("Superseded 2026-08-07 by #868 — the credit-window rationale for P1"). |
| 155 | `…peer-carriage-spec.md:198-206` | `ChannelInBothNamespaces`, one channel in both namespaces | Moved to **`:121`, `:384`, `:1124`, `:1174-1175`**. `:198-206` is now the `apex-store` headroom anecdote. |
| 99, 562 | `…peer-carriage-spec.md:279-289` | a dialed BTP session is symmetric | Moved to **`:462`**. `:279-289` is now the per-carriage credential-presentation table. |
| 174, 566 | `docs/protocol/peer-wire-spec.md:200-204` | normative `amount − fee` / `R01` | Moved: §4 opens at **`:203`**, the fee statement is `:205-211`, the `R01` rule is **`:218`**. `:200-204` is now rolling-swap `δ·W` prose. |
| 68 | `docs/devnet-pricing.md:7-11` | base units of 6-decimal USDC | → **`:12-15`** |
| 214, 568 | `docs/devnet-pricing.md:16-21` | the price table | → **`:19-25`** (now 5 rows, incl. the retired `announcePrice`) |
| 204 | `docs/devnet-pricing.md:48-53` | relay price 1, owner decision 2026-08-04 | → **`:54-60`** |
| 178 | `docs/devnet-pricing.md:73-79` | short forward is an `F03`, not a subsidy | → **`:74-82`** (partially overlapping) |
| 463, 529 | `docs/operators/rust-cutover-runbook.md:311-315` | hardcoded `/rust/ilp` client URLs incl. buzz desktop | → **`:312-316`** (buzz at `:314-316`) |
| 508 | `docs/operators/prefix-retirement-checklist.md:12-33` | "no traffic … **and** every known client repointed" | File unchanged, but `:12-33` covers the preamble + **Condition 1 only**. Conditions 2 and 3 are at `:37` and `:55`. |
| 13, 576 | `docs/adr/0009-…:13-14` | boxes run bind-mounted config; merging rolls nothing | **Half-supports.** `:13-14` says "the devnet boxes are configured with hand-tuned bind-mounted **YAML**" — that is the retired TypeScript config, and the lines say nothing about *leading the repo copies* or about `docker compose up -d`. The two other sources for this claim (`peer-channel-migration.md:22-28, 47-49`; `refuses_to_start.rs:547-548`) are exact. |

### connector — infra

| Spec line | Citation | Actual now |
|---|---|---|
| 99 | `infra/linode-store/connector-rust.toml:211` (`peer_expose = "btp"`) | → **`:215`** (relay's `:73` is still exact) |
| 157 | `infra/linode-relay/connector-rust.toml:205` (`transport = "btp"`) | → **`:234`** |
| 162 | `infra/linode-relay/connector-rust.toml:78-102` (`apex-relay` rows) | → **`:78-101`** |
| 304 | `infra/linode-relay/connector-rust.toml:101-102` (chain/token pair) | → **`:100-101`** |
| 431, 580 | `infra/linode-relay/connector-rust.toml:176-177` (`route_publish`/`route_store`) | → **`:205-206`** |
| 162 | `infra/linode-store/connector-rust.toml:216-258` (`apex-store` rows) | → **`:220-260`** |
| 304 | `infra/linode-store/connector-rust.toml:257-258` | → **`:259-260`** |
| 191 | `infra/linode-store/connector-rust.toml:354-356` (store terminates at 1000) | → **`:341-344`** |
| 259, 573 | `infra/linode-store/connector-rust.toml:291-349` (announce block) | → **`:293-337`** |
| 500 | `infra/linode-store/connector-rust.toml:301` (`publish_to`) | → **`:303`** |
| 499 | `infra/linode-store/connector-rust.toml:332,349` | → **`:319`, `:337`** — and `publish_btp_url` at `:319` **is now `wss://proxy.relay.devnet.toonprotocol.dev/ilp/btp`** (#891). §6.1's producer row is stale at repo level; still true of the live box. |
| 329 | `infra/linode-store/bootstrap.sh:5` | → **`:10`** (header rewritten by #904) |
| 339 | `infra/devnet-manage.sh:63-65` (`NODE_LABELS`/`NODE_TYPES`) | **Wrong when written** (was `:60-62`). Now **`:62-64`**, and each map has gained a `[faucet]` key. |
| 333, 340, 541 | `infra/devnet-manage.sh:294` / `:293-294` (faucet + proxy DNS) | → **`:301`** (faucet) and **`:295`** (proxy) |
| 402 | `infra/devnet-manage.sh:316` (relay-ws DNS → `97.107.134.182`) | **Wrong twice when written.** The literal `97.107.134.182` appears nowhere in the repo at `275ff37` or HEAD — the script always used `"$RELAY_IP"`. The call was `:317`, now **`:324`**. |
| 341, 504, 575 | `infra/linode-relay/init-letsencrypt.sh:13-24` | Comment block still exact at **`:13-23`**; `CERT_NAMES` pushed to **`:28`** by #892's "faucet is deliberately NOT here" note. |
| 342 | `infra/linode-node/docker-compose.node.yml:127-142` | Over-wide: nginx reload loop `:127-128`, certbot `:130-137`; `:139-142` is the top-level `volumes:`. |
| 356 | `infra/linode-node/.env.example:33-35` | **Partly wrong when written.** The quoted sentence spans `:33-34`. `MINA_USDC_TREASURY_KEY` **does not appear in this file** — only the commented `MINA_USDC_ADMIN_KEY` at `:37`. The TREASURY/ADMIN alias pairing lives in `docker-compose.node.yml:80-81`. |

### connector — faucet (§4; almost total drift, PR #906)

`packages/faucet/src/index.js` went 769 → 526 lines and lost three routes outright.

| Spec line | Citation | Actual now |
|---|---|---|
| 373 | `index.js:491` `POST /api/base-sepolia/request` | → **`:333`** |
| 374 | `index.js:418` `POST /api/solana/usdc-request` | → **`:261`** |
| 375 | `index.js:684` `POST /api/mina/usdc-request` | → **`:396`** |
| 376 | `index.js:349` `POST /api/solana/request` | **DELETED.** Returns 404; asserted by `packages/faucet/test/routes.test.js:59`. |
| 377 | `index.js:552` `POST /api/mina/request` | **DELETED.** 404. |
| 378 | `index.js:315` `POST /api/request` (local anvil); `:223-226` flags | **DELETED**, and `chains.evm` removed from `/api/info` entirely. The flag cite was already off (`:224-225`). |
| 379 | `index.js:174` `/health`, `:183` `/api/info`, `:221-249` capability map | → **`:161`, `:192`, `:227-241`** (map now `solana`/`mina`/`baseSepolia` only) |
| 377 | `packages/faucet/src/mina.js:49` (`MINA_DRIP_AMOUNT`) | → **`:57`**; the module now carries a "NOT MOUNTED" banner at `:29-36` and `index.js` imports only `isValidMinaAddress`. |
| 376 | `packages/faucet/src/solana.js:52` (`SOLANA_SOL_AMOUNT`) | Line still exact, but **dead**: only `drip()` reads it and `index.js:294` now calls `dripUsdcOnly()`. |
| 379 | `packages/faucet/public/index.html` "must stop offering them" | **Already done.** Tiles at `:368`/`:371` read USDC-only; `CHAINS` routes repointed at `:473`/`:480`. |

### toon / toon-client / rig

| Spec line | Citation | Actual now |
|---|---|---|
| 389-400, 442-444 | `packages/core/src/discovery/genesis-peers.json` (whole file) | **Superseded on `origin/main`.** Two entries; `g.toon` absent; `ilpAddress` = `g.toon.relay` (`:5`) and `g.toon.ario` (`:11`); `btpEndpoint` = `…proxy.relay…` (`:6`) and `…proxy.ario…` (`:12`); second pubkey `499cdd71…` (`:9`). The document's quoted file is the state of the local `sandcastle/issue-165` branch, which is 11 commits behind. |
| 448 | `GenesisPeerLoader.test.ts:158-171` (`it('pins the live devnet apex identity')`) | **Deleted on `origin/main`.** Replaced by `:147` (`has exactly two entries`), `:164` (`pins the relay box identity`, `g.toon.relay` at `:175`), `:180` (`pins the store box identity`, `g.toon.ario` at `:191`). The "two committed tests will fail loudly" prediction is spent — one already did. |
| 477 | core "currently `3.2.0`" | **`3.3.0`**, and published to npm. |
| 478-479 | client `0.29.0`, client-mcp `0.36.5`, rig `3.1.6` | npm: **`0.29.3` / `0.36.9` / `3.5.2`**. `origin/main` of toon-client: `0.29.3` / `0.36.9`. |
| 478 | `packages/client/package.json:65` = `^3.2.0` | **`^3.2.1`** on `origin/main` |
| 479 | `packages/client-mcp/package.json:52-57` "depends on client via `workspace:*` and core via `^3.2.0`" | Lines are `:53`/`:54`, core is `^3.2.1` on main, and both live in **`devDependencies`** — the runtime `dependencies` block (`:37-44`) has **zero** `@toon-protocol/*` entries. Consistent with the `noExternal` inlining, but "depends on" is misleading. |
| 431, 580 | `packages/rig/src/standalone/network-bootstrap.ts:174-177, 309-316` | Line ranges exact, but the field names in the claim are wrong: **`routePublish`/`routeStore` do not exist anywhere in the repo.** Rig parses `content.routes.{publish,store}` (`:172-178`, consumed at `standalone-mode.ts:490,494`), and `routes` is a **content ride-along, not part of core's kind:10032 wire schema** (`toon/packages/core/src/types.ts` has no `routes` field; rig says so itself at `network-bootstrap.ts:108,121`). |
| 459 | `packages/rig/src/cli/standalone-mode.ts:159` | Declaration at `:159`, the literal on **`:160`**. Also: the **canonical publisher is the standalone `rig` repo** (`/home/jonathan/Documents/rig`, npm `3.5.2`), where the same constant sits at `packages/rig/src/cli/standalone-mode.ts:159-160`. toon-client's copy is at `3.1.6` and is not what ships. §5.3/§5.5 name only toon-client. |
| 473 | "`3.2.0`/`3.2.1` bake `g.toon`" | Still true — and **so does published `0.36.9`**, verified by unpacking the tarball (`package/dist/chunk-I5UKJEJM.js:2114-2121`). |

**Verified-exact, spot-check list (not exhaustive):** `config.rs:252-255,285,297,308,322`; `peer.rs:40-49,305-328`; `peer_channel.rs:9-77,100-110,112-118`; `error.rs:125`; `fee.rs:19-22`; `claim.rs:438-442`; `claim_gate.rs:211-224,1250-1258`; `operator/lib.rs:118`; `refuses_to_start.rs:547-548`; `TokenNetwork.sol:62-67,82-83,148,214-246`; `solana-program/src/state.rs:74-88`; `peer-auth/{lib.rs:16-18,credential.rs:115}`; `infra/linode-node/connector-rust.toml:157,173,184,187,227-229`; `infra/linode-relay/connector-rust.toml:73`; `infra/linode-node/{docker-compose.node.yml:2,45-111,64,101-104; init-letsencrypt.sh:12,19-20,83-89; bootstrap.sh:31-33; .env.example:29,41-46; nginx/conf.d/node.conf:29,56; docker-compose.node.announcer.yml:109}`; `packages/faucet/{package.json:12-21, Dockerfile:55, src/index.js:14-15,40, src/base-sepolia.js:34-35}`; `docs/operators/{relay-box-bringup.md:32-44, peer-channel-migration.md:22-28,47-49}`; `toon:{address-assignment.ts:48-50, constants.ts:149, GenesisPeerLoader.ts:67-101, derive-child-address.test.ts:74, prefix-claim-handler.ts:97, .changeset/config.json:5-6}`; `toon-client:{config.ts:344-354,380-396,403-411,466; client/src/config.ts:425,429,432,451; standalone-mode.ts:162; e2e/devnet.ts:33; tsup.config.ts:47-51; .changeset/config.json:5}`.

Two minor over-wide ranges worth tightening rather than reporting as drift: `TokenNetwork.sol:255-296` (the function is `:255-286`; `:288-296` is the next doc block) and `:337-352` (signature recovery and the counterparty check the sentence describes are at `:330-335`, just above the range).

---

## Q2 — Are the descriptive claims about today's code true?

### §0.2 — no parent/child/peer taxonomy; a `[[routes]]` row is a prefix plus exactly one target; opaque longest-prefix with a segment-boundary rule

**TRUE**, with one nuance the document does not mention.

- **No `relation` field, no CCP, no route propagation.** `grep -rniE "\bccp\b|route.?broadcast|route propagation|ilqp"` over `crates/` returns nothing. `relation` appears only as English prose in doc comments (`peer.rs:358,404`). Routes are static, from configuration or from an operator-created *lease* (`POST /routes/leased`, `crates/connector-operator/src/lib.rs:133`) — never learned from a peer.
- **Exactly one of `handler_url` or `peer_id`.** `crates/connector-config/src/route.rs:447-491`: `(Some, None)` → terminated, `(None, Some)` → forwarded, `(None, None)` → `RouteMissingTarget`, `(Some, Some)` → `RouteTargetAmbiguous`. Documented at `route.rs:33-35`.
- **Opaque, longest-first, segment-boundary.** `crates/connector-domain/src/route.rs:9-14` — `destination.strip_prefix(prefix)` then `rest.is_empty() || rest.starts_with('.')`; selection by `max_by_key(prefix.len())` at `:23`, tie-broken by target priority at `connector.rs:1008-1011`. The announce path restates it at `announce.rs:1049-1058`, with `assert!(!route_matches("g.toon.relay", "g.toon.relayed"))` at `:1768`.
- **Nuance:** `apex` and `[[children]]` **do** exist as config keys (`config.rs:31,35`; desugared at `route.rs:494-505`, `MissingApex` at `:498`). They are pure sugar — a child expands to an ordinary *terminated* route at `apex.name` with a `handler_url` — and carry no relation semantics, no propagation, and no peer role. **None of the three fleet configs uses either** (`grep -n "^apex\|^\[\[children\]\]" infra/linode-*/connector-rust.toml` is empty). The claim "no notion of one node being above another" is true of *behaviour*; a reader grepping for `apex` in `connector-config` will find a naming convenience and should be told it is inert.

### §0.2 — the only implied hierarchy is client-side, and **nothing on the connector side reads it**

**TRUE — high confidence.** This was checked adversarially, three ways:

- `isGenesisNode` is exactly as quoted (`toon/packages/core/src/address/address-assignment.ts:48-50`), and `ILP_ROOT_PREFIX = 'g.toon'` is its sole definition (`constants.ts:149`).
- `grep -rn "g\.toon" crates/ --include=*.rs` returns **152 hits, all inside `#[cfg(test)]` modules, test fixtures (`connector-vectors`), or doc-comment examples**. Nothing on a production path compares a destination against `"g.toon"`.
- There is no `ROOT_PREFIX`, `GENESIS`, or equivalent constant anywhere in `crates/` (the only `genesis` hits are Solana test-validator genesis).

The three live prefixes (`g.toon.relay`, `g.toon.ario`, `g.toon.store`) reach the connector only as opaque `[[routes]]` prefixes and `[announce] addresses` strings.

### §0.3 — five load-time refusals

**PARTIALLY TRUE — four of five confirmed exact; the fifth is deleted; the list is not complete.**

| Refusal | Verdict |
|---|---|
| `UnknownPeerId` (`config.rs:285`) | **TRUE**, exact line, exact condition (`:283-289`). |
| `PeerRouteUndeliverable` (`config.rs:297`) | **TRUE**, exact line (`:296-301`), with the rationale at `:290-295`. |
| `PeerChannelOrphaned` (`config.rs:308`) | **TRUE**, exact line (`:306-312`). |
| `PeerChannelUnbound` (`config.rs:322`) | **TRUE**, exact line (`:317-326`), rationale at `:313-316` naming P2. |
| `AcceptOnlyPeerWithoutCeiling` (`peer.rs:562`) | **FALSE — the variant no longer exists.** Removed by ADR 0033 / issue #882 / PR #916. Only historical references remain (`peer-carriage-spec.md:799-802,1131`; `adr/0027…:10`; `adr/0033…:20,77`; `money-model.md:275`; `relay-box-bringup.md:139`; three `//!` comments in `connector-peer-http`). |

`Config::load` also still refuses before the process runs (`config.rs:249-261`, ADR 0009 rationale verbatim at `:251-254`) — that framing is correct.

**Completeness: no.** `ConfigError` has **86 variants** (`crates/connector-config/src/error.rs`). Even scoped to "the routing table *is* the relationship set", the table omits at least: `RouteMissingTarget`, `RouteTargetAmbiguous`, `RoutePeerIdEmpty`, `DuplicatePrefix`, `PeerRouteMissingPrice`, `PeerRouteHasTransport`, `TerminatedRouteHasFee`, `ConflictingHandlerPrice`, `DuplicatePeerId`, `PeerIdEmpty`, `PeerCredentialMissing`, `PeerSecretFile{NotFound,Unreadable,Empty}`, `PeerUndialable`, `ChannelInBothNamespaces` (mentioned in §1.3 note 2 but not in the table), `PeerChannelDuplicate`, `PeerChannelsWithoutStateDir`, and now `PeerCeilingRemoved` / `PeerFlushIntervalRemoved` / `PeerAddrRemoved` / `PeerWireAddrRemoved`. Several of these fire on exactly the edits §1.3 and §6 prescribe — `PeerCeilingRemoved` most of all.

### §1 — the row is two-sided for the peer role; accept-only ⇒ mandatory ceiling; BTP is symmetric

- **Two-sided for the peer role: TRUE.** `PeerCredential::matches` (`peer.rs:318-323`, constant-time, empty-matches-nothing) is called from the receiving side at `connector-peer-auth/src/credential.rs:115` via `PresentedCredential::proves`. P1 is stated verbatim at `connector-peer-auth/src/lib.rs:16-19` and is still the live rule in code (PR #890 restated the *docs*, not `decide_role`). The silent-downgrade failure mode is real (`peer-carriage-spec.md:336-342`, regression case 3 at `:398`). **One omission worth adding:** the rule is P1 **∧ P2** (`lib.rs:20`) — the accepting side must also carry a `[[peer_channels]]` row for that peer, or the counterparty is admitted as a client and its claims judged in the wrong namespace. §1.3's config blocks satisfy P2 on both boxes, so the target is unaffected; the *statement* in §1.2 is incomplete.
- **Accept-only ⇒ mandatory explicit ceiling: FALSE as of ADR 0033.** The field is gone; writing it is a boot failure. What now bounds an accept-only peering is the covering-claim requirement itself (ADR 0031): every peer PREPARE to a priced terminated route must carry a claim that covers the price or is refused with the client edge's x402 greeting (`crates/connector-peer-btp/src/price_gate.rs:1-26`).
- **BTP symmetric once up: TRUE.** `peer.rs:552` (`can_originate = endpoint.is_some() || expose.exposes(PeerCarriage::Btp)`), documented at `:442-452`, normative at `peer-carriage-spec.md:462`. §1.3's dependent claim — that the store box's accept-only row still passes `PeerRouteUndeliverable` because both boxes set `peer_expose = "btp"` — is **TRUE**: `infra/linode-relay/connector-rust.toml:73` and `infra/linode-store/connector-rust.toml:215`.

### §3 — channels bidirectional by design on both chains; one row / one channel id per relation per box

- **EVM: TRUE.** `packages/contracts/src/TokenNetwork.sol:62-67` (`ParticipantState{deposit,nonce,transferredAmount}`), `:83` (`mapping(bytes32 => mapping(address => ParticipantState))`), `setTotalDeposit` credits one named participant (`:255-286`, `ChannelNewDeposit` per leg at `:285`/event at `:148`), `claimFromChannel` recovers the signer and requires it to equal `counterparty` (`:330-335`), `nonce > counterpartyState.nonce` (`:339`), `counterpartyState.deposit >= newTransferred` else `InsufficientChannelBalance` (`:349-351`). Each direction judged against the paying participant's own leg — exactly as claimed.
- **Solana: TRUE.** `packages/solana-program/src/state.rs:75-89` — `participant_a/b`, `deposit_a/b`, `transferred_amount_a/b`, `nonce_a/b`.
- **Mina: the property does NOT generalize, and the document should not be read as implying it does.** `packages/mina-zkapp/src/PaymentChannel.ts:62-70` holds a *single* `balanceCommitment`, `nonceField`, `depositTotal` — no per-participant legs on chain. And the connector cannot express a Mina peer channel at all: `RawPeerChannel` is `Evm | Solana` only (`crates/connector-config/src/peer_channel.rs:18-23`), and `ClaimBook::verify_signature` matches only `ClaimSignature::{Evm,Solana}` (`claim.rs:1010-1042`; "a Mina claim is refused before it can reach here, at the carriage's own `parse`"). §3's "on both chains" is literally correct; a reader should not extend it.
- **One row / one channel id per relation per box: PARTIALLY TRUE — this is the spec's design choice, not an enforced invariant.** `resolve_peer_channels` (`peer_channel.rs:274-310`) rejects a **duplicate channel id** (`PeerChannelDuplicate`, `:289-293`) but has **no check at all on duplicate `peer_id`**. Two rows for one relation with different channel ids load cleanly; `wire_peer_channels` (`crates/connector-cli/src/runtime.rs:621-649`) then arms the **first** EVM row as the outbound claim channel (`:630-633`) and registers *every* row's verification key and domain (`:634-646`). So the config side permits a second row; it just would not do what an operator expects. The rest of §3.2 is exact: `channel_id` canonicalized lowercase (`peer_channel.rs:100-110`), `counterparty_key` never self-declared (`:113-118`), `ClaimBook::counterparties` recovered from the signature (`claim.rs:438-442`), `#[serde(untagged)]` + `deny_unknown_fields` shapes that cannot blend (`peer_channel.rs:9-77`).
- **`openChannel` cannot collide: TRUE.** `TokenNetwork.sol:228-232` — `keccak256(p1,p2,channelCounter++)`, so `ChannelAlreadyExists` is unreachable in practice.

### §2 — the fee arithmetic

**TRUE**, all three rules, at their new locations. R1 (`over_carried_reject`, `client-edge/src/lib.rs:873-880` — note it fires only on `ClientRouteKind::Forwarded` with `price > 0`); R2 (`fee.rs:19-22`, called from `connector.rs:1124`); R3 (`connector.rs:795-811`, `accumulated_cost: 0` at `:808`, before the app is consulted). The current-fleet comparison (`1002`/`2`/`1000`) is exact at `infra/linode-node/connector-rust.toml:157,173,184,187`. §2.3's warning that the store box's `fee = 1` doubles per-frame cost is corroborated independently at `docs/devnet-pricing.md:84-90`, which made the *same* argument to justify `apex.fee = 0` on the relay leg.

---

## Q3 — Is the target reachable?

### A. Needs code that does not exist

1. **The announce-driven publish/store split in the client-mcp daemon (§5.2 mechanism 1, §6.2 step 11).** Confirmed absent: `grep -rnE "routePublish|routeStore" packages/client-mcp/src/` is empty; the only `routes` in `packages/client-mcp/src/daemon/` is `config.ts:403`, which is `deriveRouteDestinations(destination)` — a pure string transform of the already-configured anchor. The daemon's announce reader (`apex-discovery.ts`, `mapAnnouncement()` `:136-200`) goes through core's `parseIlpPeerInfo` and never touches raw `event.content`. Only `rig` parses it (`packages/rig/src/standalone/network-bootstrap.ts:172-178`). **This is now urgent, not prospective** — see B1.
2. **`routes` is not in core's kind:10032 wire schema.** `IlpPeerInfo` in `toon/packages/core/src/types.ts` has no `routes` field; rig reads it as a content ride-along. Making mechanism 1 a supported client contract means adding it to core's parser, not just to client-mcp. (Rig's own comments acknowledge this: `network-bootstrap.ts:108,121`.)
3. **No mutable, restart-surviving peer table.** §2b.3's statement stands: `/peers` is GET-only (`crates/connector-operator/src/lib.rs:118`), the peer set is fixed at load, and an unknown peer id is a boot failure. #867 is open and unstarted.
4. **`ceiling`/`flush_interval_ms` are gone from the language.** Not a gap so much as an inversion: the config surface §1.3 and §2b.2 prescribe **no longer parses**. The edit is a deletion, not an addition, but the document must be changed before anyone applies it.

### B. Needs a build-and-publish, not a config edit

1. **The republish chain is half-done and currently *unsafe to finish naively*.** `core@3.3.0` carries the two-node seed and is published; `client-mcp@0.36.9` is published but still bakes the **old** single-entry seed (`chunk-I5UKJEJM.js:2114-2121`). Rebuilding client-mcp against core 3.3.0 *without* item A1 lands §5.2's hazard in production: `config.ts:380` takes `loadGenesisPeers()[0]` = `g.toon.relay`, and `deriveRouteDestinations` (`:344-354`) returns `publish === store === 'g.toon.relay'`, routing every `/store` job into the relay's write handler. §5.2's fallback (mechanism 2, `TOON_CLIENT_PUBLISH_DESTINATION`/`TOON_CLIENT_STORE_DESTINATION`, `config.ts:403-411`) works but requires every user to set env vars — it is not a shipping default.
2. **`rig`'s `OFFICIAL_PROXY_URL` must be repointed in the *standalone* repo.** `/home/jonathan/Documents/rig` at `packages/rig/src/cli/standalone-mode.ts:159-160` is what publishes `@toon-protocol/rig@3.5.2`. toon-client's copy is at `3.1.6` and is not the artifact clients install. §5.3/§5.5 name only toon-client and would leave the live `rig` pointed at box 1.
3. **`buzz`'s desktop build.** Still hardcoded to `https://proxy.devnet.toonprotocol.dev/rust/ilp` per `docs/operators/rust-cutover-runbook.md:312-316`. Correctly flagged in §5.3 as a hard blocker.
4. **Edit-list omissions found by sweep** (live default values, not documentation): `toon-client/packages/client-mcp/src/e2e/devnet.ts:41` (`destination: 'g.proxy.relay.store'`), `packages/client/src/config.ts:418,420,422` (`g.toon.genesis`/`g.toon.peer1`/`g.toon.peer2`), `packages/rig/src/cli/standalone-mode.ts:487` (last-resort `'g.proxy'`) and `:1169` (`ilpAddress: 'g.toon.client'`, rig's twin of the cited `config.ts:466`).

### C. Needs a config edit on a box (or in a repo), nothing more

1. **The `relay-store` rows** (§1.3) — minus `ceiling`/`flush_interval_ms`, plus the real `channel_id`/`counterparty_key`. Bind-mounted, so `docker compose restart connector-rust` on both boxes, per `docs/operators/peer-channel-migration.md:47-49`.
2. **The pricing constants and `docs/devnet-pricing.md` rows** (§2.5). Note the constant line numbers all moved (Q1).
3. **`publish_btp_url`** (§6.2 step 10). **Repo half already landed** (#891, `infra/linode-store/connector-rust.toml:319`). The live box is still the human step, exactly as the preamble says.
4. **A third, divergent copy of each box's connector config exists and is not in §1.3's scope.** The `relay` and `store` repos each ship their own `deploy/connector.toml` — `store`'s says at `:57` "**No `[[peers]]`, deliberately**", and carries three terminated routes (`g.toon.ario`, `g.toon.relay.ario`, `g.toon.store`, all at 1000, `:140-153`) where the connector repo's `infra/linode-store/connector-rust.toml` has one. Whatever §1.3 adds to `infra/linode-store/` leaves these bundles stale. Also worth checking before the store box gains a `g.toon.relay` forwarding row: `g.toon.relay.ario` is a **longer** prefix than `g.toon.relay`, so on any box holding both, `…relay.ario` continues to terminate locally while `g.toon.relay` forwards — an interaction §1.3 does not discuss.
5. **No box has an `[operator]` section.** `grep -n "^\[operator\]"` across all three `infra/linode-*/connector-rust.toml` is empty (`infra/linode-node/connector-rust.toml:306` even says "Add an `[operator]` section per…"). The operator surface *does* implement `POST /channels` (open) and `POST /channels/:id/fund` (`crates/connector-operator/src/lib.rs:134-135`, RFC 9421-signed), so §6.2 step 3 is a **config gap, not a missing code path** — either enable `[operator]` on a box, or do it off-box. Off-box tooling now exists as `.github/workflows/funded-ops.yml` (#909), which supports `whoami`, `channel-status` and `deposit` — **but not `open-channel`**. Opening the new channel is still a bespoke manual step; funding and verifying both legs (§3.4, §6.2 step 5) are covered.

### D. §4 — the faucet: **already built, and the contested item resolved in §4's favour**

The faucet has **no dependency on a co-located connector**, and this is now structurally proven rather than argued. Exhaustive sweep of `packages/faucet/{src,package.json,Dockerfile,public}`: all 41 `process.env.*` reads are chain/RPC/key/amount/cooldown vars; zero `TOON_*`/`PROXY_*`/`CONNECTOR_*`/`ILP_*`/`BTP_*`; the only `localhost` is its own healthcheck (`Dockerfile:59`); no `@toon-protocol/*` or interledger dependency (`package.json:12-21`); no `depends_on` on `connector` in any of the three compose files; no shared volume beyond the read-only Solana keypair. The only `connector` tokens in the package are five prose comments.

**PR #906 (merged 2026-08-09) built `infra/linode-faucet/`** — eight files, three services (`faucet`/`nginx`/`certbot`), **no connector**, header at `docker-compose.faucet.yml:2-7` reciting §4.5's list nearly verbatim ("no `[[peers]]` row naming it anywhere, no signer key, no settlement key, no state directory, no payment channel"). Its own single-name cert lineage (`init-letsencrypt.sh:18`, `CERT_NAMES=("faucet.${DOMAIN}")`). USDC-only, with the three native-token routes deleted and asserted 404 by `packages/faucet/test/routes.test.js:59`; `BASE_SEPOLIA_ETH_AMOUNT: '0'` pinned as a literal (`.env.example:63-68`), `MINA_FAUCET_KEY`/`MINA_DRIP_AMOUNT`/`SOLANA_SOL_AMOUNT` deliberately unset. `infra/devnet-manage.sh` gained `[faucet]` rows at `:62-64`, a `faucet)` provisioning case at `:381-402`, and a separate `faucet-cutover)` case at `:404-413` that alone moves DNS. `docs/operators/faucet-box-bringup.md` (162 lines) is the runbook, with the "Who does what" table at `:43-53` and four gates at `:143-156` — including "**every configured USDC leg drips end-to-end — this is the stop gate**".

**Residual §4 work:** the faucet box is not provisioned; keys are not generated; mint authority is not transferred; DNS still points at box 1 by design (`devnet-manage.sh:296-301`). Two hazards the document should absorb: (a) `faucet-box-bringup.md:62-67` warns that box 1's faucet is **built from this repo**, so the next `./devnet-manage.sh redeploy` silently retires box 1's three native-token routes too — §6.2's ordering does not account for that; (b) `devnet-manage.sh:507` still lists a `relay` service in box 1's redeploy leg, which was moved off by #820 and no longer exists.

### E. §6 — ordering hazards the runbook already handles, and one it does not

§6.1's cert-lineage trap is real and correctly cited (`infra/linode-node/init-letsencrypt.sh:12,19-20,83-89` — box 1's lineage genuinely covers two names). §6.2 steps 7-8 remain necessary. The new faucet box's own lineage is independent, so the split is a box-1-side operation only.

The one hazard §6 does not carry: **step 11 (publish the client chain) must not run before A1 ships**, because core 3.3.0 is *already* published and a client-mcp rebuild alone is enough to trigger §5.2. Today's `0.36.9` is safe only because it is stale.

---

## PR / issue status

| | State | Resolution of the preamble's flagged item |
|---|---|---|
| connector **#891** — *Store announces through the relay box, not the apex* | **MERGED** 2026-08-08 (`c6845641`) | **Preamble item 3 resolves in the repo's favour.** `infra/linode-store/connector-rust.toml:319` now reads `publish_btp_url = "wss://proxy.relay.devnet.toonprotocol.dev/ilp/btp"`. §6.2 step 10's repo half is done; the live box remains a human step, as the document says. **Edit needed:** §6.1's producer table row and §6.2 step 10 should be reworded to describe the live box only, and the citation moved from `:332` to `:319`. |
| connector **#892** — *Relay box becomes the fleet front: adopted announce identity, relay-ws vhost, faucet* | **MERGED** 2026-08-09 (`abea86df`) | **Preamble item 2 resolves: the pubkey row drops out of §5.3.** `infra/linode-relay/connector-rust.toml:204` sets `identity_key_file = "/app/data/announce.key"`, with a 45-line rationale at `:117-150` naming `30fdd01d…` explicitly. `toon` `origin/main`'s reseeded `genesis-peers.json:3` keeps that same pubkey for the `g.toon.relay` entry — the two repos already agree. **Preamble item 1 is NOT resolved by #892:** the faucet-on-the-relay-box change was added and then reverted *inside #892 itself* ("fix(relay): drop the faucet — it gets its own box, not this one"). The merged tree never shipped it; `infra/linode-relay/` contains only negative-space comments (`bootstrap.sh:6-9`, `init-letsencrypt.sh:25-27`, `nginx/conf.d/node.conf:4-6`). |
| connector **#906** — *The faucet moves to its own box, with no connector on it, USDC only* | **MERGED** 2026-08-09 (`e8c9e17c`), closes #898 | **Preamble item 1 resolves in §4's favour.** Own box, no connector, USDC only, `MINA_FAUCET_KEY` dropped — every disposition in §4.6's table implemented. **No owner decision is outstanding.** §4 should be restated as *shipped at repo level, pending provisioning*, and its route-table citations replaced (all six moved or deleted). |
| connector **#867** — *Sell peering: a priced peer route that adds the payer to the routing table* | **OPEN**, last updated 2026-08-08 | §2b's SWAPPABLE boundary stands unchanged. Nothing in it has landed; the buy side (`pay_the_through_url`) exists at `announce.rs:1328-1441`, the sell side does not. |

**Not flagged in the preamble but materially larger than any of the three:** connector **#868** / **#882** (PRs #913, #914, #916, ADRs 0031 and 0033) retired the credit window and the exposure/ceiling machinery between 2026-08-10 and 2026-08-12. This is what invalidates §0.3 row 5, §1.1's `ceiling` bullet, §1.3's TOML blocks and note 3, §2b.2's inventory, and §3.4's ceiling sentence. It also changes the *shape* of the relay↔store link the document specifies: every peer PREPARE to a priced terminated route must now arrive with a covering claim or be answered with the client edge's x402 greeting (`crates/connector-peer-btp/src/price_gate.rs:1-26`), and the forwarding side covers proactively from the outbound client ledger when configured with `Connector::with_outbound_client_hop` (`connector.rs:507`). Both funded legs (§3.4) become *more* necessary, not less — but the document's account of why is now the retired one.

---

## Glossary appendix

**Column 3** is whether the codebase agrees with the document's usage. **Column 4** flags where `context/glossary.md` contradicts the document — that file is materially stale and should not be used to read this spec.

| Term | Document's definition (§) | Codebase agrees? | Conflicts with `context/glossary.md`? |
|---|---|---|---|
| **carry / carriage** | one connector forwarding another's packet for a `fee` (§0.1, §2) — and separately, the *transport* selected by an endpoint's URL scheme (`PeerCarriage::{Btp,Http}`, §1.1) | Yes, both senses. `peer.rs:30-49`; `docs/protocol/peer-carriage-spec.md`. The document uses one word for two things the code also uses one word for. | — |
| **peering / peering relation** | one `[[peers]]` row = one relation, as seen from the node whose file it is in; never per carriage, never per connection (§1.1) | Yes — `peer.rs:397-406` verbatim | **Yes.** `glossary.md:19` defines relations as *parent/child/peer* with "child packets claim-free… a child must tag the apex as parent". No such concept exists; and since ADR 0031 **every** peer packet carries a covering claim. |
| **peer role** | granted iff a presented credential names a configured peer id **and** the secret matches (P1) (§1.2) | Partially — the live rule is **P1 ∧ P2** (`connector-peer-auth/src/lib.rs:14-24`); P2 requires a `[[peer_channels]]` row | — |
| **accept-only** | a `[[peers]]` row with no `endpoint`: never dials, is dialed (§1.1, §1.3) | Yes — `peer.rs:424-429`; still originates if `peer_expose` includes BTP (`:552`) | — |
| **ceiling** | the most unclaimed value carried for a relation before refusing; mandatory on accept-only (§1.1, §1.3, §3.4) | **No — retired.** `ConfigError::PeerCeilingRemoved` (`peer.rs:497-499`); ADR 0033 | — |
| **`flush_interval_ms`** | used in §1.3's relay-box block | **No — retired.** `PeerFlushIntervalRemoved` (`peer.rs:500-502`) | — |
| **`handler_url`** | a `[[routes]]` target meaning "terminate here" (§0.2) | Yes — `route.rs:33-35,449-464` | **Yes.** `glossary.md:21` calls final-hop delivery `localDelivery` over `POST /handle-packet`. `grep -rn "handle-packet\|handle_packet"` across `crates/`, `infra/`, `deploy/` returns **nothing**; delivery is an HTTP POST to the configured `handler_url` (e.g. `http://relay:3100/write`). |
| **`peer_id`** | a `[[routes]]` target meaning "forward over that peering" (§0.2); also the string both boxes must write identically (§1.2) | Yes — `route.rs:466-483`; `UnknownPeerId` at `config.rs:285` | — |
| **route / prefix** | opaque string, longest-first, segment-boundary (§0.2) | Yes — `connector-domain/src/route.rs:9-25` | **Yes.** `glossary.md:7` calls `g.toon` "the canonical apex nodeId" and implies hierarchy; the matcher is purely lexical. |
| **terminate / termination** | a route whose packets are delivered to a local app (§0.1) | Yes — `ClientRouteKind::Terminated` | — |
| **forward** | a route whose packets go to a peer, carrying `price` and `fee` (§2.1) | Yes — `ClientRouteKind::Forwarded`; `fee.rs:19-22` | **Yes.** `glossary.md:17` says the apex "**free-forwards** to children". ADR 0028 forbids a silently free route (`PeerRouteMissingPrice`, `error.rs:112-118`) and ADR 0029 makes the terminating side charge again (`connector.rs:795-811`). |
| **price** | what this connector's client edge charges a client for a prefix — same meaning on both route kinds (§2.1) | Yes — `route.rs:37-43` | — |
| **fee** | what this hop *retains*; flat per packet, never a percentage (§2.1) | Yes — `fee.rs:1-22`, ADR 0010 | — |
| **announce** | a one-shot operator command publishing kind:10032 from the box holding the identity key, paid through that node's own routing (§6.3, ADR 0030) | Yes — `crates/connector-cli/src/announce.rs`; `[announce]` at `infra/linode-relay/connector-rust.toml:199-206` | Partially. `glossary.md:33` describes kind:10032 correctly but not the paid/one-shot/identity-key mechanics. |
| **`route_publish` / `route_store`** | the announce's `RouteHints { publish, store }`, which splits publish from upload (§5.2) | Yes on the emitter (`announce.rs:493,505,596-598`; config at relay toml `:205-206`); **no** on the wire contract — `routes` is a content ride-along, absent from core's `IlpPeerInfo` | — |
| **channel** | one on-chain `channelId` with two per-participant legs (§3.1) | Yes on EVM/Solana; **not** on Mina, and Mina cannot be a `[[peer_channels]]` row at all | — |
| **leg / deposit** | one participant's `deposit` inside a channel; both must be funded (§3.4) | Yes — `TokenNetwork.sol:63-67,285`; `state.rs:79-80` | — |
| **claim / balance proof** | signed cumulative assertion, judged against the *signer's* leg (§3.1) | Yes — `TokenNetwork.sol:330-351`; `claim.rs:1009-1043` | Mostly agrees (`glossary.md:13`), except Mina is listed as live and is refused at parse in the Rust connector. |
| **`counterparty_key`** | the address whose signature *this* node accepts — never the claim's self-declared signer (§1.3, §3.2) | Yes — `peer_channel.rs:113-118`; `claim.rs:438-442` | — |
| **`[[peer_channels]]` vs `[[client_channels]]`** | disjoint namespaces; one channel in both is `ChannelInBothNamespaces` (§1.3 note 2) | Yes — `config.rs:334-341`; `peer-carriage-spec.md:1174-1175` | — |
| **client edge** | the surface an ordinary payer pays; cannot tell a peer-role payer from any other (§2b.4) | Yes — ADR 0028; `crates/connector-client-edge/` | — |
| **covering claim / x402 greeting** | *not in the document* — the rule that replaced the credit window | Live: `connector-peer-btp/src/price_gate.rs:1-26`; ADR 0031 | — |
| **apex** | *deliberately not used as prose*; only as a verbatim identifier (`apex-store`, `apex-relay`) (§0.4) | Correct discipline; the ids are real (`infra/linode-store/connector-rust.toml:224`, `infra/linode-relay/connector-rust.toml:79`) | **Yes.** `glossary.md:17,39` treats "apex" as a live architectural role with an env prefix `PROXY_*`. ADR 0009 deleted the environment layer entirely — `grep -rn "PROXY_" crates/ --include=*.rs` is empty. |
| **`g.toon`** | a prefix that survives; a *node* that does not (§0.2, §5.4, §6.3) | Yes — no production connector code reads it | **Yes, flatly.** `glossary.md:7,39` — "`g.toon` is the canonical apex nodeId… **load-bearing** (baked into the connector + every child's parent tag, so it must match across the deployment)". False: 152 occurrences in `crates/`, all in tests/fixtures/doc examples. |
| **box 1** | the box answering to `g.toon` today, Linode label `toon`, `infra/linode-node/` (§0.4) | Yes | — |
| **genesis node / `isGenesisNode`** | client-side only; becomes a predicate no live node satisfies (§0.2, §5.4) | Yes — `toon/packages/core/src/address/address-assignment.ts:48-50`; already vacuous against `origin/main`'s reseeded file | **Yes, transitively** — `docs/protocol.md:119` in this repo still asserts "The genesis node IS `g.toon`", which §5.4 itself flags for correction. |
| **BTP** | one of two carriages, selected by a `wss://` endpoint (§1.1) | Yes — `peer.rs:43-48`; `https://` selects ILP-over-HTTP | **Yes.** `glossary.md:5` calls BTP "TOON's **only** transport". ADR 0027/0028 make ILP-over-HTTP a first-class carriage, and terminated routes carry a `transport` policy of `http`\|`btp`\|`both` (`route.rs:111-123`). |
| **`peer_expose`** | the carriages this connector opens listeners for; both boxes set `"btp"` (§1.3) | Yes — `peer.rs:467-471`; relay toml `:73`, store toml `:215` | — |
| **relay / store node products** | apps behind `g.toon.relay` and `g.toon.ario` (§0.1) | Yes; `g.toon.store` survives only as an alias in the `store` repo's own bundle (`deploy/connector.toml:150-153`) | Minor: `glossary.md:37` names the store product without noting its live prefix is `ario`. |

**Terms `context/glossary.md` asserts that have no referent in the Rust connector at all:** parent/child/peer relations, `localDelivery`, `POST /handle-packet`, `PROXY_*` env prefix, "free-forwards to children", `g.toon` as a baked-in constant. Six contradictions, not three. That file predates ADR 0009, ADR 0026-0033 and the whole Rust fleet; reading it alongside this spec will actively mislead.

---

*Audit performed against working trees and `origin/main` on 2026-08-12. `toon`'s local checkout is on `sandcastle/issue-165`, eleven commits behind `origin/main` — every `toon` finding above is stated against `origin/main`. Line numbers drift; this document will too.*
