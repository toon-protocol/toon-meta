# Rolling-swap sdk-2.x wire rename — coordinated deploy runbook

**Scope:** the `mill*`→`swap*` wire-field rename (sdk/core **2.0.0**, published
2026-07-01; changeset `af4cd24`, toon#48) crossing the deployed wire. Two PRs
carry it:

| Side | PR | What it does |
|---|---|---|
| Swap node / maker | [swap#51](https://github.com/toon-protocol/swap/pull/51) (closes swap#45) | swap node emits `swapSignerAddress` (+ `swapEphemeralPubkey`) in FULFILL accept-metadata; sdk ^2.0.0, core ^2.0.0, connector ^3.20.1. Changeset: **major** → publishes `@toon-protocol/swap` **1.0.0** (currently 0.1.0). |
| Client | [toon-client#353](https://github.com/toon-protocol/toon-client/pull/353) (closes toon-client#349) | `ClientRunner.swap` calls `streamSwap` with `swapPubkey`/`swapIlpAddress` and reads `swapSignerAddress`; adds the skew-time `SwapResponse.warning`. Changeset: client-mcp **minor** (0.16.0 → 0.17.0 unless other changesets are queued), views/client patch. |

Renamed wire fields (no back-compat alias in sdk 2.x):
`millSignerAddress`→`swapSignerAddress`, `millEphemeralPubkey`→`swapEphemeralPubkey`,
`millPubkey`→`swapPubkey`, `millIlpAddress`→`swapIlpAddress`
(plus error codes `MILL_SIGNER_MISMATCH`→`SWAP_SIGNER_MISMATCH`).
Operator env names were untouched by swap#51; they are renamed by the parallel
component rename (the node formerly called "the mill" is now the **swap node**,
org-wide): `SWAP_MNEMONIC`, `SWAP_RELAYS`, `SWAP_STATE_PATH`,
`SWAP_MAX_RATE_AGE_MS`, … — `TOON_*` names (`TOON_CONNECTOR_URL`, …) are
unchanged. This runbook uses the new names throughout; older org docs may still
say `MILL_*`.

Part of the rolling-swap epic
[toon-meta#145](https://github.com/toon-protocol/toon-meta/issues/145)
(spec `docs/rolling-swap.md`, PR #150, §10.1). Companion doc on the maker side:
`swap/docs/sdk-2x-migration.md` (in swap#51).

---

## 1. Why coordination is required (and why no shim exists)

Both sides emit/expect **new names only**. A tolerant reader is not possible in
either app repo: the FULFILL settlement-metadata dict is assembled and decoded
**inside the sdk** (`stream-swap.ts` / the swap-handler), and sdk 2.x's
`decodeFulfillMetadata` **silently drops unknown fields** before app code ever
sees them. If a mixed-fleet window ever becomes unavoidable, an alias reader
belongs in the sdk itself (toon repo), not per-consumer hacks. toon-client#353
pins this behavior with `swap-wire-compat.test.ts` — if the sdk ever grows an
alias, that test fails and the warning path can be retired.

### Skew matrix

| Client sdk | Swap-node sdk | Result | How it looks |
|---|---|---|---|
| 0.5.x | 0.5.x | ✅ works | legacy names both sides |
| **2.x** (≥ client-mcp 0.17.0) | 0.5.x | ❌ fails **loudly at swap time** | Packets FULFILL but no accepted claim carries `swapSignerAddress`; `ClientRunner.swap` detects the signature and sets `SwapResponse.warning` naming cause + consequence, plus a daemon log line. Claims are unsettleable; the source leg has already been paid. |
| 0.5.x (≤ client-mcp 0.16.0) | **2.x** (swap ≥ 1.0.0) | ❌ fails **silently, late** | Old `decodeFulfillMetadata` drops the unknown `swapSignerAddress`; the swap "succeeds", claims accumulate, and only settlement throws `MISSING_SETTLEMENT_METADATA` (`build-settlement-tx.ts`) — after the source asset moved. |
| 2.x | 2.x | ✅ works | `swapSignerAddress` round-trips end to end |

Diagnostic rule: **`MISSING_SETTLEMENT_METADATA` after this deploy ⇒ check the
peer's sdk major first.**

### Asymmetry that decides the order

- new-client ↔ old-swap-node: **loud, immediate** (`SwapResponse.warning`).
- old-client ↔ new-swap-node: **silent, deferred** — the worst failure mode.
- The client is **distributed software**: Claude Code plugin users launch via
  `npx -y -p @toon-protocol/client-mcp toon-mcp` (unpinned → latest, subject to
  local npx cache); Claude Desktop users install a static `.mcpb` bundle and
  update only when they reinstall. **We cannot flag-day the client population.**

### The devnet reality that makes this tractable

As of 2026-07-12 **there is no live swap node on devnet**:

- kind:10032 announcements on the devnet relay list only `g.toon.relay` and
  `g.toon.ario` (plus a stale `g.connector.relay` on an old sslip host). No
  swap node announces.
- `connector/infra/linode/` (devnet.sh, docker-compose.linode.yml,
  endpoints.json) contains no swap-node service.
- The swap repo ships **no deploy artifact at all** — no Dockerfile, compose
  file, or deploy/ dir; its README notes the Docker image-publish workflow was
  left as a follow-up when it was extracted from the monorepo. The only
  runnable surface is the npm bin `toon-swap` (config JSON + `SWAP_*`/`TOON_*`
  env; embedded child connector peers to a parent over BTP).

So "coordinated window" collapses into something simpler: there is no old swap
node to roll and no swap traffic to break. The dangerous combination
(old-client ↔ new-swap-node) only comes into existence **the moment the first
2.x swap node goes live**. The job is therefore: get the 2.x client released
and propagating **first**, soak, then stand up the 2.x swap node as devnet's
first.

---

## 2. Recommended order (summary)

1. **Merge swap#51** → CI publishes `@toon-protocol/swap@1.0.0` to npm. Publishing
   deploys nothing (no consumer auto-deploys); safe any time. Unblocks the
   stacked PR swap#53 and the next epic wave.
2. **Merge toon-client#353** → changesets opens/updates the Version Packages PR.
3. **Merge the Version Packages PR** → publishes `@toon-protocol/client-mcp@0.17.0`
   (+ views/client), builds and attaches the Desktop `.mcpb`, re-points the
   `mcpb-latest` release.
4. **Soak N days** (decision D3): let the client population update; announce the
   change; Desktop users need a manual extension update.
5. **Deploy the 2.x swap node on devnet** (devnet's first) — initially dark
   (no kind:10032 announce) for verification, then announce.
6. **E2E verify**: a real devnet `toon_swap` from an upgraded client with no
   `SwapResponse.warning` and a successful settlement.

Steps 1–3 can happen in one sitting; step 5 is the only true go-live gate.

---

## 3. Preconditions

Check every box before Stage 1:

- [ ] `@toon-protocol/sdk@2.0.1` and `@toon-protocol/core@2.0.1` published
      (done 2026-07-01 — verify: `npm view @toon-protocol/sdk version`).
- [ ] swap#51 CI green, reviewed. Note it pins connector `^3.20.1` because the
      connector npm publish pipeline has been broken since 3.20.1
      (connector#291, `ERR_REQUIRE_ESM`; tags to v3.28.5 unpublished). This is
      accepted for this deploy; bumping to ^3.28 is a follow-up, no code change
      expected.
- [ ] toon-client#353 CI green, reviewed (lint failures are the identical
      pre-existing 15 errors on main).
- [ ] No stray changesets on either main that would piggyback something
      unintended onto these releases
      (`ls <repo>/.changeset/*.md`).
- [ ] Decisions D1–D6 (§7) answered — at minimum D1 (window), D2 (swap-node hosting)
      and D3 (soak gate).
- [ ] Swap-node operator inputs ready (Stage 4): `SWAP_MNEMONIC` (or
      `SWAP_SECRET_KEY_HEX`), funded per-chain inventory, settlement key,
      `chainProviders` config for the chains being offered, relay URL(s),
      parent BTP endpoint + auth.

`gh` note (org-wide): plain `gh pr view`/`gh pr edit` can fail on the
projectCards GraphQL deprecation — always use `gh pr view … --json <fields>`
for reads and `gh api` REST for edits.

---

## 4. Ordered steps with verification

### Stage 1 — merge + publish the maker side (swap#51)

```bash
gh pr merge 51 --repo toon-protocol/swap --squash
# release.yml runs on push to main: changesets either publishes directly or
# opens a "Version Packages" PR (the repo has a major changeset queued:
# .changeset/swift-moons-shake.md). If a Version Packages PR appears, merge it.
gh run list --repo toon-protocol/swap --workflow release.yml --limit 3
```

**Verify:**

```bash
npm view @toon-protocol/swap version          # expect 1.0.0
npm view @toon-protocol/swap dependencies     # sdk ^2.0.0, core ^2.0.0, connector ^3.20.1
```

Known gotcha: bot-authored Version Packages PRs can stick at
`action_required` — a human may need to re-run the workflow.

**Rollback:** nothing is deployed by this stage. If the published package is
bad: `npm deprecate @toon-protocol/swap@1.0.0 "<reason>"` and publish a fixed
1.0.1. Do **not** proceed to Stage 4 with a deprecated build.

### Stage 2 — merge + release the client side (toon-client#353)

```bash
gh pr merge 353 --repo toon-protocol/toon-client --squash
# release.yml → changesets opens/updates the Version Packages PR (opened by the
# org GitHub App). Review the version bumps it proposes, then merge it.
```

On the Version Packages merge, release.yml:

- publishes `@toon-protocol/client-mcp` (expect **0.17.0**), `views`, `client`;
- builds the Claude Desktop extension and attaches `toon-<ver>.mcpb` to the
  `@toon-protocol/client-mcp@<ver>` GitHub Release;
- recreates the **`mcpb-latest`** release so the stable URL
  `…/toon-client/releases/download/mcpb-latest/toon.mcpb` serves the new build.

**Verify (operator):**

```bash
npm view @toon-protocol/client-mcp version    # expect 0.17.0
gh release view "@toon-protocol/client-mcp@0.17.0" --repo toon-protocol/toon-client --json assets
gh release view mcpb-latest --repo toon-protocol/toon-client --json body   # mentions 0.17.0
```

**Verify (how a user confirms their client version):**

- Claude Code plugin: restart Claude Code — the plugin's `.mcp.json` runs
  `npx -y -p @toon-protocol/client-mcp toon-mcp` unpinned, so a fresh session
  resolves latest (a warm npx cache can lag; `npx clear-npx-cache` or
  `npm exec --yes @toon-protocol/client-mcp@latest` forces it). Confirm with
  `npm view @toon-protocol/client-mcp version` vs the daemon's startup log.
- Claude Desktop: Settings → Extensions shows the installed TOON extension
  version; update by installing the new `.mcpb` from `mcpb-latest`.
- Functional check (either host): after Stage 4, a small `toon_swap` that
  returns **no `warning`** proves the client is ≥ 0.17.0 talking to a 2.x swap
  node (a 2.x client vs an old swap node *warns*; an old client has no `warning` field at
  all but will fail at settlement — so the definitive check is
  warning-absent **and** settlement succeeds).

**Rollback:** npm unpublish is impractical — publish a revert:
`git revert` the #353 squash commit on a branch, add a patch changeset, merge,
merge the Version Packages PR (0.17.1). Re-point Desktop users by letting the
workflow rebuild `mcpb-latest` from the revert release. Old clients are
unaffected by a client-side rollback (nothing server-side changed yet).

### Stage 3 — soak

- Announce the release (README/plugin notes; decision D3 sets N).
- During the soak there is still **no live swap node**, so neither skew row can
  bite anyone on devnet. Users pointing `toon_swap` at a private 0.5.x swap node
  will now get the loud warning — that is working as intended.

**Rollback:** trivially reversible — nothing deployed.

### Stage 4 — stand up the 2.x swap node on devnet (the go-live gate)

This is the step that **creates** the old-client↔new-swap-node hazard. Do not start
it until D3's soak has elapsed.

No deploy artifact exists in the swap repo (decision D2 chooses the model).
Provisional ad-hoc shape, matching how the devnet edges are actually operated
(hand-tuned, bind-mounted configs on the Linode boxes `toon` /
`toon-devnet-store` — NOT the committed deploy/ dirs):

```bash
# On the chosen box (D2) — containerised to match the box's docker-based ops:
docker run -d --name devnet-swap --restart unless-stopped \
  -e SWAP_MNEMONIC='<operator mnemonic>' \
  -e SWAP_RELAYS='wss://relay-ws.devnet.toonprotocol.dev' \
  -e TOON_CONNECTOR_URL='wss://proxy.devnet.toonprotocol.dev:443' \
  -e TOON_PARENT_PEER_ID='apex' \
  -e TOON_PARENT_AUTH_TOKEN='<token>' \
  -e TOON_ILP_ADDRESS='g.toon.swap' \
  -e SWAP_BLS_PORT=8090 -p 8090:8090 \
  -v /opt/devnet-swap/swap.config.json:/config/swap.config.json:ro \
  node:22-slim \
  npx -y -p @toon-protocol/swap@1.0.0 toon-swap --config /config/swap.config.json
```

(`swap.config.json` carries `swapPairs`, `chains`/`chainProviders`,
`inventory`, `settlementPrivateKey`, `parentEvmAddress`, and — when announcing —
`ilpAddress`/`btpEndpoint`/`advertisedAsset` for the kind:10032 fields. The
ILP address/nodeId above is illustrative; pick per D2/D5 and the apex's actual
peer/route config, which on devnet lives in the **bind-mounted**
`connector.yaml` on the box — adding a `swap` child route there is part of this
step and must be mirrored per the connector's dual control plane rule:
admin HTTP handlers *and* ConnectorNode config.)

Go live **dark** first: omit the announce config so the node does not
self-publish kind:10032 (D5).

**Verify:**

```bash
# 1. Process/health
curl -fsS http://<box>:8090/health

# 2. Not yet announced (while dark): toon_query kinds:[10032] lists only
#    g.toon.relay / g.toon.ario — no swap node.

# 3. Wire proof — a real devnet swap from an UPGRADED client (>=0.17.0):
#    toon_swap against the swap node's ILP address/pubkey; assert:
#      - SwapResponse has NO `warning`
#      - accepted claims carry `swapSignerAddress`
#      - settlement path works (buildSettlementTx / channel settle succeeds)
#    This is the toon_swap e2e both PRs deferred until a live 2.x maker exists.

# 4. Negative probe (optional but recommended once): the same swap from a
#    pinned OLD client (npm exec @toon-protocol/client-mcp@0.16.0) should
#    fulfil but then fail settlement with MISSING_SETTLEMENT_METADATA —
#    confirming the documented skew signature, so support can recognise it.
```

Then, per D5, enable the kind:10032 announce and re-verify it appears
(`toon_query kinds:[10032]`; remember the devnet announcePrice/fee gotcha —
edges run announcePrice 2000).

**Rollback:** `docker stop devnet-swap` (and remove the apex route/announce).
Because this is devnet's first swap node, stopping it restores exactly the
pre-deploy world — no old build to restore. Caveat: swap-node state is **in-memory**
(swap#46/#52 not yet merged) — stopping the node strands any accumulated
unsettled claims; settle/drain before stopping if real value has flowed (D4).

### Stage 5 — post-deploy

- Record the swap node's pubkey/ILP address in `connector/infra/linode/endpoints.json`
  (or wherever D2 lands its config) and in toon-meta docs.
- File the follow-ups: connector publish fix (connector#291) then bump swap's
  pin to ^3.28; swap repo deploy artifact (Dockerfile/deploy/ + image publish)
  if D2 chose ad-hoc; sdk alias-reader decision (D6) if any mixed-fleet
  evidence shows up in support channels.
- Watch for `MISSING_SETTLEMENT_METADATA` reports — each one is a pre-0.17.0
  client; the remedy is always "update the client", never a swap-node change.

---

## 5. Failure diagnosis quick reference

| Symptom | Meaning | Fix |
|---|---|---|
| `SwapResponse.warning` naming skew, daemon log line | 2.x client hit a 0.5.x swap node | upgrade/replace that swap node (should not exist on devnet after Stage 4) |
| Swap "succeeds", later `MISSING_SETTLEMENT_METADATA` in `build-settlement-tx.ts` | pre-2.x client hit the 2.x swap node | user updates client-mcp to ≥ 0.17.0 |
| Both sides 2.x but swap fails at swap time with `SWAP_SIGNER_MISMATCH` | genuine signer mismatch (not skew) | debug swap-node signer config |

---

## 6. Version ledger (fill in as executed)

| Artifact | Before | After | Published |
|---|---|---|---|
| `@toon-protocol/sdk` | 0.5.1 (old pin) | 2.0.1 | 2026-07-01 ✅ |
| `@toon-protocol/core` | 1.4.1/1.6.x | 2.0.1 | 2026-07-01 ✅ |
| `@toon-protocol/swap` | 0.1.0 | 1.0.0 | ☐ Stage 1 |
| `@toon-protocol/client-mcp` | 0.16.0 | 0.17.0 (expected) | ☐ Stage 2 |
| Desktop `.mcpb` (`mcpb-latest`) | 0.16.0 build | 0.17.0 build | ☐ Stage 2 |
| Devnet swap node process | none | swap 1.0.0 | ☐ Stage 4 |
| `@toon-protocol/connector` (swap-node pin) | ^3.10.0 | ^3.20.1 (publish gap; ^3.28 follow-up) | — |

Connector publish gap: decided 2026-07-12 — **forward-only**. Merging
toon-protocol/connector#312 cuts and publishes the next patch (3.28.6+);
versions 3.21–3.28.5 stay npm-absent and are not backfilled.

---

## 7. Open decisions (blockers marked ⛔)

- **D1 ⛔ Window timing.** When do Stages 1–2 land, and when is the Stage 4
  go-live? Merges/publishes are safe any time; only Stage 4 needs a chosen
  window.
- **D2 ✅ DECIDED (2026-07-12): baked-config image + deploy/ dir.** Follow the
  relay/store convention: build a `swap-connector` baked-config image and a
  committed deploy/ dir in the swap repo before go-live (survives box resets,
  no new hand-tuned snowflake). Still open within D2: the swap node's ILP
  address/nodeId (`g.toon.swap`?) and the apex-side route/peer entry in the
  bind-mounted connector.yaml (dual-control-plane rule applies).
- **D3 ✅ DECIDED (2026-07-12): no soak (N=0).** No live swap node exists today, so
  no existing swap traffic can break. Stand the swap node up dark as soon as the
  client release is published, verify with a real swap, then announce.
- **D4 Swap-node persistence.** swap#52 (state persistence; today swap-node
  state is fully in-memory) is implemented but unmerged. Deploy the devnet
  swap node before or after it merges? Before ⇒ every restart strands unsettled claims
  (acceptable for devnet play-money, annoying for demos).
- **D5 Announce policy.** Should the swap node self-announce kind:10032 at go-live,
  or stay dark (destination passed explicitly) through verification/soak?
  Dark-first is recommended above; decide when to flip. Also whether to purge
  the stale `g.connector.relay` announcement while in there.
- **D6 sdk alias reader.** Accept the hard cut (recommended — devnet-only,
  no live swap traffic), or invest in a back-compat alias in the sdk so old
  clients keep working against the 2.x swap node? If mixed-fleet pain appears
  post-deploy, this is the sanctioned mitigation point (per both PRs), and
  toon-client's `swap-wire-compat.test.ts` will flag when it lands.
- **D7 Prod surfaces.** This runbook assumes devnet is the only deployed
  surface (nothing in the repos indicates otherwise). Confirm no third-party
  or demo swap nodes exist (e.g. remnants of the old `proxy-hs-mill` ator
  hidden-service stack) before treating Stage 4 as a green field.
- **D8 Swap-node funding & custody.** Which identity holds `SWAP_MNEMONIC`
  (renamed from `MILL_MNEMONIC`) / settlement key, and how much per-chain
  inventory is the devnet swap node funded with?
