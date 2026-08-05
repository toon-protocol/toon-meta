# DEPLOYMENT-PLAN — getting a working Rust fleet deployed, and TypeScript retired

Companion to `DEPLOYED-FINDINGS.md` (observed box state) and `REPO-FINDINGS.md`.
Everything here is **preparation**. No box was deployed to, restarted, or edited in
producing it; every live-box command run was a read. Commands that would mutate are
written into the runbook rather than executed.

> **Redacted for the public repo.** Host and client IP addresses are written as
> `<apex-ip>`, `<store-ip>` and `<client-a>`/`<client-b>`/`<client-c>`. The real
> values are in project memory, following this audit's existing `root@<ip>`
> convention. `<client-a>` and `<client-b>` are in the same residential /24.

Repo changes are on branch **`deploy/store-box-rust-connector`** in
`/home/jonathan/Documents/connector` (PR #715, commits `3cfd7b57`, `41aa938a`),
authored in an isolated worktree so as not to disturb sibling agents working in the
same checkout. Nothing is merged.

---

## 0. BOTTOM LINE

1. **The apex Rust connector is NOT broken. It is idle, and it was idle before the
   02:01 edit.** It answers every read-only endpoint correctly right now. The
   "65,513 claims then silence" shape is a dev session ending, not a regression.
   Details in §1 — including the evidence that rules the price edit in or out.

2. **The store-box Rust deployment is written and committed.** Config, compose
   overlay, nginx routing, and the config-load test that covers them: 7/7 green,
   including an anvil-backed boot of the new settlement section. It is deployable
   as written; it was not deployable before, for a concrete reason (§2).

3. **The first irreversible step is deleting the TypeScript image tags from GHCR**
   (Phase 6, step 6.3). Everything before it rolls back by re-pinning a tag and
   running `up -d`. That step is irreversible because the TS connector cannot be
   rebuilt on demand: its source survives only on an unmerged branch, and its
   publishing workflow has been **deleted** from the repo (§3, §4).

4. **A full TS retirement has a functional gap that no amount of deployment work
   closes: inter-node settlement.** Today the apex→store leg is a paid BTP forward
   where the store node earns and banks a claim. The Rust fleet's equivalent
   (`handler_url` to the store box's public URL) is an unauthenticated HTTPS POST
   that earns the store node nothing. Retiring TS without resolving this does not
   preserve behaviour — it silently moves the store leg from "paid, settled" to
   "the apex keeps the money". This is the sibling ADR's decision to make; the
   runbook gates on it explicitly (§3, Phase 3) rather than papering over it.

5. **The `/rust/` URL prefix has to be retired too, and the clients that ignore
   discovery set the pace.** Once Rust is the default edge it serves `/ilp` and
   `/ilp/btp`, making `/rust/ilp` a redundant alias — but it is currently **published
   into kind:10032 discovery** (verified live off the relay this session), and two
   clients pin it in *compiled code* where no announcement can reach them: rig's
   `OFFICIAL_PROXY_URL` and buzz's three `TOON_DEVNET_DEFAULTS` constants. Phase 7
   sequences it: re-announce first, ship client releases, soak on the access log, then
   drop the locations. Every step reverses with an nginx reload.

6. **The deployment diverged from ADR 0013 and nothing recorded it.** The ADR
   specifies a parallel *ILP prefix* where "traffic moves by changing a destination
   address." What shipped is a parallel *HTTP path* with identical ILP prefixes on both
   fleets. The `/rust/` path is the artifact of that divergence, and one downstream
   document — `prefix-retirement-checklist.md` — is now unexecutable as written,
   because it measures traffic to an "old prefix" that does not exist. §5.1.

7. **PR #718 (delete the raw-TCP peer wire) is verified safe to merge.** All four
   pre-merge conditions re-checked read-only on both boxes: no listener, no config, no
   socket, and `peer-claims.log` at exactly 0 bytes with an mtime equal to the volume's
   creation instant. One caveat on the AC's wording, which conflates the dead peer wire
   with the very-much-alive BTP peering — §6.

---

## 1. Diagnosis — the apex Rust connector's 20-hour silence

**Verdict: BENIGN. Idle, not broken. The 02:01 restart and price edit did not cause
it, and nothing needs fixing before the Rust fleet is depended upon.**

### 1.1 It is alive right now

Three read-only GETs through the full public path
(`nginx → connector-rust:4000`), run during this audit:

```
GET https://proxy.devnet.toonprotocol.dev/rust/ilp/routes/price?destination=g.toon.relay
  → 200  {"destination":"g.toon.relay","price":1}
GET https://proxy.devnet.toonprotocol.dev/rust/ilp/routes/price?destination=g.toon.store
  → 200  {"destination":"g.toon.store","price":1000}
GET https://proxy.devnet.toonprotocol.dev/rust/ilp/identity
  → 200  {"keyId":"connector-signer","publicKey":"0x040a2a82eaae34a8…"}
```

The process serves, the routing table is loaded, the signer is loaded, nginx
resolves the container, and the price the file was edited to is the price it
reports. A broken connector does not answer these.

Container state corroborates it: `running`, **`RestartCount: 0`**, exit code 0. It
is not crash-looping and never has been. Its log contains **zero** `WARN` and
**zero** `ERROR` lines over its whole life.

### 1.2 The silence predates the price edit — which exonerates the edit

This is the decisive fact, and it is not in `DEPLOYED-FINDINGS.md`:

```
Created:    2026-08-03T01:41:32Z     ← container created (image rust-sha-59e167f)
log line 1: 2026-08-03T01:41:46Z     "connector listening"
FinishedAt: 2026-08-03T02:01:55Z     ← stopped
StartedAt:  2026-08-03T02:01:58Z     ← started again (the price-edit restart)
log line 6: 2026-08-03T02:01:58Z     "connector listening"
```

`RestartCount` is 0 across both, so this was a clean stop/start (`docker compose up
-d` after the edit), and `docker logs` retains **both** epochs in one stream.

In the **twenty minutes before** the price edit — same container, same image,
`price = 1000` still in force — the connector served exactly the same thing it has
served since: nothing but healthcheck probes. The entire 249-line log is

| lines | content |
|---|---|
| 2 | `connector listening` (01:41:46 and 02:01:58) |
| 247 | `packet rejected / F01 / "prepare carries no execution condition"` — one every 5 min |

The F01s are a probe to `g.toon` carrying no execution condition; a connector
correctly refusing a malformed prepare is working, not failing. **There is no
"before the edit it worked, after it didn't" boundary in the data.** The price
change is a red herring for the silence. (It remains a real config-drift and
pricing problem — §5.)

### 1.3 What the traffic actually was, and why it stopped

nginx's access log tells the whole story. Requests to `/rust/ilp*` over the retained
window:

| client IP | hits |
|---|---|
| `<client-a>` | 7,133 |
| `<client-b>` | 1,116 |
| `<client-c>` | 2 |
| `<apex-ip>` (the box itself) | 2 |

**Two IPs in one residential /24 account for 99.9% of every request the Rust edge
has ever served.** User-agent `node` throughout. No server, no peer, no other
client, ever.

By path:

| path | count | status |
|---|---|---|
| `/rust/ilp` | 5,215 | 200 |
| `/rust/ilp` | 1,985 | **503** |
| `/rust/ilp` | 107 / 34 | 400 / 402 |
| `/rust/ilp/routes/price` | 309 | 200 |
| `/rust/ilp/identity` | 297 | 200 |
| `/rust/ilp/btp` | 294 | 101 (websocket upgrade) |

By hour, it is unmistakably a human at a keyboard, not a service:

```
02/Aug 21:00 → 253      03/Aug 00:00 → 297
02/Aug 22:00 →  57      03/Aug 01:00 → 196
                        03/Aug 02:00 →   3   ← then nothing, for 20h
```

The final three requests are the signature of the operator finishing up:

```
02:02:09  GET /rust/ilp/routes/price?destination=g.toon.relay  200
02:02:10  GET /rust/ilp/identity                               200
02:02:31  GET /rust/ilp/btp                                    101   (134 KB session)
```

That is: edit the price → restart → **verify the price took** → run one more BTP
session → stop for the night. The `client-edge-claims.log` mtime of `02:02` is that
last session, not a mystery write.

The 294 BTP sessions at ~760 KB each, against 65,513 cumulative claims at ~992 base
units apiece, match buzz's huddles workload exactly (persistent sealed-frame
sessions, per-frame claims). The Rust edge's entire production history is one
developer's huddle testing.

### 1.4 Why nothing routes there on its own

Two independent reasons, both by design:

* **TypeScript owns the default edge.** nginx's `$backend` map sends
  `proxy.devnet.toonprotocol.dev` → `http://connector:3000` (TS). Rust is reachable
  only at the explicit `/rust/ilp` prefix. Nothing that does not deliberately type
  `/rust/` can arrive.
* **The one automated packet source on the devnet does not use it.** The store box's
  5-minute kind:10032 self-announce is a TS→TS BTP forward end to end. It never
  touches Rust.

So the Rust connector has no traffic source other than a human pointing a client at
it. Zero packets in 20 hours is the *expected* reading, and it would have read zero
for those 20 hours whatever the price said.

### 1.5 The one thing that IS worth acting on

Not a bug, but visible in the same data and relevant to cutover: **1,985 HTTP 503s
on `/rust/ilp`** — nginx `limit_req zone=node` (30 r/s, burst 60) shedding a single
client during a burst on 2026-08-01, with `excess: 60.x` in the error log. Under
production load on the Rust edge that zone will shed real paid traffic. Covered in
the runbook (Phase 4, step 4.1) and already accounted for in the store box's nginx
(the BTP location carries no `limit_req`, matching the apex, because the zone counts
*requests* and a BTP session is one request carrying thousands of frames).

### 1.6 Observability gap, stated plainly

There is no way to ask the Rust connector how many packets it has served. It has no
`[operator]` section configured on either box, so no metrics endpoint exists; the TS
`/admin/metrics.json` has no Rust counterpart. **Every "verify packets flow" step in
this runbook therefore reads the claims journal off the state volume**, which is the
only durable evidence the Rust fleet produces. Per #690, per-packet logs were demoted
to `debug`, so the container log will *not* show successful traffic — do not read an
empty log as an idle connector.

---

## 2. Store-box Rust deployment — the artifacts

Committed on `deploy/store-box-rust-connector` (`3cfd7b57`). Four files, all in the
connector repo.

### 2.1 What was already there, and why it could not be deployed

`infra/linode-store/{connector-rust.toml,docker-compose.store.rust.yml}` existed on
`main` but were a stub under a "NOT DEPLOYED, and cannot be" banner. The banner
rested on #620 (a peer-forwarded route is priced by nobody, so it would serve the
store app for free) and #623 (ADR 0003's raw-TCP wire cannot carry a public link).

Both findings are still correct. **Neither is a reason the store box cannot run a
Rust connector** — they are reasons it cannot run a *peer-wire* one. The blocking
mechanism was more mundane: the compose overlay required

```yaml
- '${STORE_PEER_WIRE_BIND:?set STORE_PEER_WIRE_BIND to this box VPC address}:4001:4001'
```

a hard `:?` failure demanding a Linode VPC address on a fleet where **no VPC was ever
provisioned**. The overlay could not be brought up even for a smoke test.

### 2.2 The change

| File | What it now is |
|---|---|
| `infra/linode-store/connector-rust.toml` | Real config: all three prefixes the box's TS `connector.yaml` terminates (`g.toon.ario`, `g.toon.relay.ario`, `g.toon.store`) → `http://store:3300/store`, each priced `1000` to match TS exactly. Live EVM **and** Solana settlement naming the same contracts as the apex. No `peer_wire_addr`, no `[[peers]]`. |
| `infra/linode-store/docker-compose.store.rust.yml` | Deployable additive overlay. `STORE_PEER_WIRE_BIND` and the `:4001` publish are gone. `127.0.0.1:4000:4000` only. Three key mounts + a named `connector_rust_state` volume. |
| `infra/linode-store/nginx/conf.d/node.conf` | Adds `location /rust/ilp` and `location = /rust/ilp/btp`, mirroring the apex byte-for-byte in behaviour. Nothing existing is touched, so no current traffic moves. |
| `crates/connector-bin/tests/devnet_configs_load.rs` | Follows the config. See §2.5. |

### 2.3 Three deployment decisions worth challenging

**(a) Settlement is live on both legs, reversing the file's own prior argument.**
The old header argued for an EVM-only template because a store box is "the other end
of a payment", never a counterparty. That was true while #600's topology held — the
apex terminated the store leg and this box had no Rust node. The moment this node
accepts client-edge claims it *is* a counterparty, on whichever chain the buyer
chose, and the live fleet's peering settles on `solana:devnet` (both TS peers carry
`chain: solana:devnet`). An EVM-only node would refuse every Solana-paid write that
reached it. The cost the old argument named is real and accepted: a present
settlement table is fail-closed at startup (ADR 0009), so this node now needs two
reachable chains and two key files to boot.

**(b) Derive the settlement keys from the existing mnemonic.** Not new identities.
This lands the Rust node on `0x6B6c2DACf7Ac1F1273F72beF2E6084F9Ee6D3bff` (EVM) and
`W6yK72j365eK7t4Qj5An1AaYtUEJcJK7TBPvGeDk1LV` (Solana) — the addresses this box
already advertises in `connector.yaml`'s `settlementAddresses` and that clients have
already opened channels against. Fresh identities would each need funding and force
every client to open a new channel.

**Both (a) and (b) were confirmed by the owner on 2026-08-03** and are now recorded
in the config file itself, not only here — see §2.3.1.

### 2.3.1 The two decisions as recorded in the config

Both are written into `connector-rust.toml`'s header as owner-confirmed decisions
with their rationale, so a later reader does not re-litigate them — and, in the
dual-chain case, so the file does not go on arguing the opposite of the value beneath
it. That failure mode is not hypothetical: the live apex's `connector-rust.toml`
carries a comment asserting parity at `1000` directly above `price = 1`, and that
contradiction is precisely why a 1000× cut sat unnoticed for twenty hours (§5).

**Key provisioning is two different jobs, and conflating them is the live risk:**

| File | How | Must it match the TS node? |
|---|---|---|
| `signer-rust.key` | **Fresh random**, `openssl rand -hex 32` | **No — must NOT collide.** This is the connector's ILP signing identity (ADR 0012). The apex does the same: its Rust signer resolves to `0x8b0cb539f6b58d9fa1266faaec18555c4f8e598e`, which is not any TS settlement identity on that box (derived this session from the public `/rust/ilp/identity` endpoint). |
| `settlement-rust.key` | Derived, `m/44'/1237'/0'/0/0` | **Yes — matching is the goal.** |
| `settlement-solana-rust.key` | Derived, `m/44'/501'/0'/0'` | **Yes — matching is the goal.** |

Derive from `TOON_MNEMONIC` in `infra/linode-store/.env` (the store box's own seed;
`docker-compose.store.yml` refers to it in prose as `STORE_TOON_MNEMONIC`) at
**account index 0**.

**The EVM path is NIP-06 `1237'` — the Nostr coin type — not the standard
`m/44'/60'`.** This fleet settles with the same secp256k1 key it signs Nostr events
with (confirmed in `store/deploy/connector.yaml:94` and toon-client's devnet
quickstart). Deriving at `m/44'/60'/0'/0/0` yields a perfectly valid address that
nobody has funded and that cannot resolve a single existing channel. **The real guard
is asserting the derived addresses equal the two literals above before first start**,
not trusting the path string.

**Two accepted consequences of the reuse, both now stated in the config:**

* **Rotating the mnemonic now rotates both connectors' settlement identities at
  once.** There is no longer a way to re-key the Rust node alone; a rotation becomes a
  fleet event requiring every counterparty channel to be re-opened. The signer key is
  unaffected — it is not seed-derived and rotates independently.
* **While both connectors run side by side — the whole additive phase and the drain
  — two processes hold the same settlement private key.** Safe for *accepting* claims
  (a read against chain state); **not** safe for submitting settlement transactions
  concurrently, which would race the account nonce. Keep on-chain settlement driven by
  exactly one of the two connectors for the duration. This is a second, independent
  reason the Phase 5 drain must not trigger a settle.

**(c) Prices are pinned equal to the TypeScript route's, and a test now enforces
it.** While both connectors front `store:3300`, an unequal price is an arbitrage
between two doors into one handler and the cheaper door takes every packet. This is
exactly the hazard the live apex is sitting in today (relay: TS `1000` vs Rust `1`).

### 2.4 Image target — and the `#614` check the brief asked for

Pinned to **`ghcr.io/toon-protocol/connector:rust-sha-380ffd1`** (main's head,
published 2026-08-03T22:21Z).

The prior-history warning holds and was verified: **pre-#614 images cannot mount a
fresh state volume**. #614 is commit `63b8188a` ("ship /app/state owned by the
runtime user, so a named state volume is writable on first mount"), confirmed by
`git merge-base --is-ancestor 63b8188a HEAD` to be an ancestor of the pinned tag.
The store box's volume will be fresh by definition, so this is load-bearing here in
a way it was not on the apex. Recorded in the compose file as a floor on rolling
**back**: never roll this service below `rust-sha-63b8188`.

Note the pinned tag is *newer* than the `rust-sha-59e167f` the apex runs. Standing up
a new box is the cheap moment to be current; the runbook re-pins the apex to match in
Phase 2 so the fleet is homogeneous before any cutover.

### 2.5 Test coverage — green

`cargo test -p connector --test devnet_configs_load` → **7 passed, 0 failed**
(`anvil` present, so the chain-backed cases really ran). `cargo fmt --check` clean.

The store case now boots the committed file with its live settlement stripped (as
the apex case already did) and asserts all three prefixes answer with x402 terms
naming `price = 1000`. Two guards were added that did not exist:

* **absence of an uncommented `peer_wire_addr`** — line-anchored, so the header may
  discuss it at length. A peering added without the transport that replaces the raw
  wire fails here first.
* **`the_two_fleets_price_the_shared_store_prefixes_identically`** — both boxes must
  price `g.toon.ario` and `g.toon.store` the same. This is a direct regression guard
  against the class of edit that produced the live apex's undocumented `price = 1`.

The old `uncomment_settlement_template` helper and its `BEGIN`/`END` markers are
removed; the store's anvil case now boots the real `[settlement.evm]` and asserts it
names the same registry, program and mint as the apex.

### 2.6 What is deliberately NOT in the change

* **No peering.** `crates/connector-config/src/peer.rs` defines a peer as
  `{ id, addr }` with `addr: SocketAddr` — raw TCP and nothing else. There is no BTP
  or ILP-over-HTTP peer transport in the Rust connector today. The store config marks
  where a peer entry goes once the transport ADR lands.
* **No announcer sidecar for the store box.** The apex runs one
  (`docker-compose.node.announcer.yml`) that publishes kind:10032 pointing at the Rust
  edge. The store box will need the equivalent before its TS `selfAnnounce` can be
  switched off — but that file **does not exist in the repo at all** (§5), so it must
  be committed before it can be copied. Phase 3, step 3.4.
* **No change to the apex.** Its drift is diagnosed in §5 and reconciled in the
  runbook, not silently fixed here.

---

## 3. The cutover runbook

Ordered, individually reversible, each step with a verification and a rollback.

**Conventions.** `APEX` = `ssh -i ~/.ssh/id_rsa root@<apex-ip>`,
`STORE` = `ssh -i ~/.ssh/id_rsa root@<store-ip>`. Repo root on both boxes is
`/root/connector`. `CLAIMS()` means:

```bash
# the ONLY durable evidence the Rust fleet produces (see §1.6)
wc -l /var/lib/docker/volumes/<project>_connector_rust_state/_data/client-edge-claims.log
# project = linode-node (apex) | linode-store (store)
```

Take a baseline count before each verification and compare after.

### Phase 0 — make the repo the source of truth (fully reversible)

**0.1 Land the branch.** Merge `deploy/store-box-rust-connector`. Nothing deploys.
*Verify:* CI green. *Rollback:* revert the commit.

**0.2 Commit the two untracked/undocumented apex artifacts.** See §5: the announcer
overlay exists **only on the box**, and the apex nginx conf on the box has 56 lines
the repo has never seen. Copy both into the repo as-is, in their own commit, marked
"reconciled from the live box, behaviour unchanged".
*Verify:* `diff <(git show main:infra/linode-node/nginx/conf.d/node.conf) <box copy>`
is empty; same for the announcer overlay.
*Rollback:* revert. Nothing on any box changes either way.

**0.3 Re-pin the repo to what the boxes actually run.** `docker-compose.node.yml`
→ `connector:3.36.3-solchan.0` (repo says `3.36.1`); `docker-compose.node.rust.yml`
→ `rust-sha-59e167f` (repo says `rust-sha-18413d9`).
*Verify:* `docker inspect` image on the box equals the repo pin.
*Rollback:* revert.
**This step is safety-critical, not cosmetic.** Until it lands, anyone running
`infra/devnet-manage.sh` (which does `compose pull || up`) rolls the apex TS
connector **backwards** to 3.36.1 and the Rust one back to `rust-sha-18413d9`.

**0.4 Resolve the apex price contradiction** — do NOT quietly restore `1000`. Decide
`1` or `1000` for `g.toon.relay` on the Rust apex, write the decision and its owner
into the file's comment (which currently contradicts its own value), commit, and
apply on the box in Phase 2 with the config that carries it.
*Verify:* `GET /rust/ilp/routes/price?destination=g.toon.relay` matches the repo.
*Rollback:* re-pin and restart.

### Phase 1 — stand up the store box's Rust connector (additive, reversible)

Nothing in this phase moves a packet off TypeScript.

**1.1 Provision keys** (do this first; a missing key file is a refuse-to-start).
Two different jobs — see §2.3.1:

```bash
# on the STORE box, in infra/linode-store/

# (a) signer — FRESH RANDOM. Must NOT collide with the TS node's identity.
openssl rand -hex 32 > signer-rust.key

# (b) settlement pair — DERIVED from TOON_MNEMONIC at account index 0.
#     Matching the TS node's addresses is the GOAL: it inherits the funded
#     identities instead of needing new channels opened against it.
#       evm     m/44'/1237'/0'/0/0  → 0x6B6c2DACf7Ac1F1273F72beF2E6084F9Ee6D3bff
#       solana  m/44'/501'/0'/0'    → W6yK72j365eK7t4Qj5An1AaYtUEJcJK7TBPvGeDk1LV
#     NIP-06 1237', NOT m/44'/60'. Write each as 64 hex chars.
#   → settlement-rust.key , settlement-solana-rust.key

chmod 600 *.key && chown 10001:10001 *.key   # uid 10001 or the container loops
```

*Verify — do this before starting anything:* the two **derived** addresses equal the
literals above exactly. A mismatch (most likely `m/44'/60'` instead of `1237'`) gives
a valid, unfunded address and a node that cannot resolve a single existing channel.
Confirm separately that the **signer** address is *not* either of them.
*Rollback:* delete the files. Nothing has started.

**1.2 Pull the image, then start the overlay:**

```bash
docker compose -f infra/linode-store/docker-compose.store.yml \
               -f infra/linode-store/docker-compose.store.rust.yml up -d connector-rust
```

Naming the service means compose does not touch `connector`, `store`, `nginx` or
`certbot`.
*Verify:* `docker ps` shows `linode-store-connector-rust-1` up; `docker logs` shows
`connector listening` and **no** startup error (settlement is fail-closed, so an
unreachable chain or bad key shows here immediately);
`curl -s localhost:4000/routes/price?destination=g.toon.ario` → `{"price":1000}`.
*Rollback:* `docker compose … stop connector-rust && … rm -f connector-rust`. The TS
node never knew it existed.

**1.3 Reload nginx with the two new locations:**

```bash
docker exec linode-store-nginx-1 nginx -t && \
docker exec linode-store-nginx-1 nginx -s reload
```

*Verify:* `nginx -t` passes **before** the reload;
`curl https://proxy.store.devnet.toonprotocol.dev/rust/ilp/identity` → 200; and
critically `curl -sI https://proxy.store.devnet.toonprotocol.dev/store` still behaves
as before — the apex's live forward goes through that location.
*Rollback:* restore the previous `node.conf`, `nginx -t`, reload. A reload is
graceful; in-flight connections are not dropped.

**1.4 Prove the new edge is really paid.** From a client, send one *claimless*
prepare to `g.toon.ario` at the Rust edge.
*Verify:* HTTP **402** with x402 terms naming amount `1000`. A 200 here means a free
gateway is open — stop and roll back 1.3 immediately.
Then send one paid write and confirm `CLAIMS()` on the store box increments by 1.
*Rollback:* as 1.3/1.2.

### Phase 2 — homogenize the apex (reversible)

**2.1** Re-pin `docker-compose.node.rust.yml` to `rust-sha-380ffd1` and apply the
Phase-0.4 price decision, then `up -d connector-rust` on the apex.
*Verify:* `GET /rust/ilp/routes/price` for all three prefixes matches the repo;
`CLAIMS()` on the apex is **unchanged by the restart** (the journal must survive —
that is what `state_dir` is for) and the file is still ~134 MB.
*Rollback:* re-pin to `rust-sha-59e167f`, `up -d`. Never below `rust-sha-63b8188`.
*Watch for:* the box config is currently missing `transport = "btp"` on
`g.toon.relay`, which repo `main` has (#704). Applying repo config **will** start
refusing HTTP requests to that route with terms naming `"btp"`. That is the intended
behaviour, but it is a client-visible change — confirm buzz/huddles clients use BTP
before applying.

### Phase 3 — the inter-node link (GATED — do not start without the ADR)

**This phase cannot be written as mechanical steps yet, and pretending otherwise
would be the most dangerous part of this document.**

The gap, precisely: today the store leg is `client → apex TS → [BTP forward] → store
TS → store app`, and the store TS node *terminates, charges `1000`, and banks a
settlement claim* (visible live: `2000 → 1998, fee 2`, `Claim verified and stored`,
`blockchain: solana`). The Rust equivalent available today is `handler_url =
"https://proxy.store.devnet.toonprotocol.dev/store"` — an unauthenticated HTTPS POST
that lands on nginx's `location /store` and goes **straight to `store:3300`, bypassing
the store's connector entirely**. The apex charges; the store node earns nothing;
no claim is written; no settlement occurs.

So retiring TS on today's Rust topology is **not behaviour-preserving**. It moves the
store leg from "paid and settled between two nodes" to "one node keeps the money".

**Gate:** the transport ADR must land first, and it must specify how a packet
arriving from another connector is charged and how a claim is written for it (#620),
over a transport that can cross the public internet (#623).

Once it does, the shape of the steps is:

**3.1** Add the peer entry + `peer_id` route to both `connector-rust.toml`s, in the
repo, behind the config-load test.
**3.2** Deploy to the store box first (it serves no default traffic), then the apex.
**3.3** *Verify — this is the acceptance test for the whole project:* send one paid
write to `g.toon.ario` through the apex Rust edge and confirm **`CLAIMS()` increments
on BOTH boxes**. One-sided is the #620 free-forward bug reappearing. Nothing proceeds
past this point until it is two-sided.
**3.4** Commit and deploy a store-box announcer sidecar (modelled on the apex's, which
must first be committed in step 0.2) advertising the store box's `/rust/ilp` and
`/rust/ilp/btp` endpoints. Leave the TS `selfAnnounce` running in parallel — two
kind:10032 announces coexisting is already the status quo on this devnet.
*Rollback for all of 3.x:* remove the peer entries and redeploy. TS is still serving
everything; nothing has moved.

### Phase 4 — move the default public edge to Rust (reversible, per box)

**4.1 First, raise the rate limit.** `limit_req zone=node`/`zone=store` at 30 r/s,
burst 60, already shed 1,985 requests from one client (§1.5). It has never been sized
for the default edge's load. Raise it, or exempt `/rust/ilp`, in the same commit that
moves the edge.
*Verify:* replay a burst and see 0 × 503.

**4.2 Store box first** — it has the smaller blast radius and no BTP peer depending
on its `location /`. Change `$backend` for `proxy.store.devnet.toonprotocol.dev` from
`http://connector:3000` to `http://connector-rust:4000`.
*Verify:* `POST /ilp` claimless → 402 with terms; one paid write → `CLAIMS()`
increments; `GET /store` unchanged; the store app still receives jobs.
*Rollback:* restore `$backend`, `nginx -t`, `nginx -s reload`. **Seconds, graceful,
and total.** This is the cheapest reversal in the plan.

**4.3 Apex box** — same change for `proxy.devnet.toonprotocol.dev`. Higher risk:
`location /` is also where the store box's TS connector terminates its BTP peering
(`wss://proxy.devnet.toonprotocol.dev:443`). Do **not** do 4.3 while the store box's
TS connector still peers to it, or the peering breaks. Sequence: 4.3 comes after
Phase 5.1.
*Rollback:* restore `$backend` and reload.

### Phase 5 — drain and stop TypeScript (reversible while the images exist)

**5.1 Stop the store box's TS connector** (this is what frees 4.3):

```bash
docker compose -f infra/linode-store/docker-compose.store.yml stop connector
```

`stop`, **not** `down` and **not** `rm`. `down` would remove the `connector_data`
volume's container association and the network; `stop` leaves everything recoverable
by `start`.
*Verify:* the store app still serves via Rust; `CLAIMS()` still increments; the apex
logs no failing BTP dials (it will log the peer going away — expected).
*Rollback:* `docker compose … start connector` — the container, its volume and its
config are all still there. Seconds.

**5.2 Do 4.3** (apex default edge → Rust).

**5.3 Stop the apex TS connector**, same `stop`-not-`down` rule.
*Verify:* the relay still receives writes; `CLAIMS()` increments on the apex; the
faucet, relay-ws and dashboard hosts still resolve (they are separate `$backend`
entries and must be unaffected).
*Rollback:* `start`. But note 5.3 is the last step where rollback is instant — after
it, restoring TS means re-establishing a BTP peering that has been down.

**5.4 Soak.** Leave both TS containers stopped-but-present for a stated period (a
week is a reasonable devnet figure). This window is the entire safety margin for the
irreversible step that follows. Do not shorten it to tidy up.
*Verify:* daily `CLAIMS()` growth on both boxes; no client regressions reported.

### Phase 6 — remove TypeScript (6.1–6.2 reversible; **6.3 is not**)

**6.1** `docker compose … rm -f connector` on both boxes; delete the `connector`
service from `docker-compose.node.yml` / `docker-compose.store.yml`.
*Rollback:* revert the commit, `up -d connector`, re-pull the image. Still reversible
— **only because the GHCR tags still exist**.

**6.2** Retire the downstream references in §4's inventory: relay's and store's
`deploy/Dockerfile` `FROM ghcr.io/toon-protocol/connector:3.28.0` and their two
publish workflows; the `deploy/pay-edge` and `deploy/node-quickstart` recipes.
*Rollback:* revert.

**6.3 — ⛔ THE FIRST IRREVERSIBLE STEP — delete the TypeScript image tags from
GHCR.**

Everything above this line rolls back by re-pinning a tag and running `up -d`.
Deleting the tags removes that possibility permanently, because **the TypeScript
connector cannot be rebuilt on demand**:

* the running image `3.36.3-solchan.0` was built from commit `c449a66e` on the
  **unmerged** branch `fix/channelmanager-open-3.36` (GH Actions run `29778204969`,
  2026-07-20), not from `main`;
* `main` deleted the TS source in `c4a4ad10` (#465) and `2d981565` (#543);
* the workflow that built it, `build-and-publish.yml` (id `264776065`), is in state
  **`deleted`** — it cannot be `workflow_dispatch`-ed. Restoring it means re-adding
  the file to `main` first;
* even then the build is `npm ci` against the public registry with a Node
  22.20-alpine base and an `o1js`/`libsql`/`sharp` dependency surface that has not
  been exercised since July. Treat "rebuildable" as *hours of work with a real chance
  of failure*, not a button.

**Before 6.3, do all three of:** (a) `docker save` the four load-bearing digests to
durable storage off GHCR — `3.36.3-solchan.0` (`sha256:4a77e0f9…`), `3.36.1`,
`3.28.0`, and the **untagged** `sha256:48d2160e…` that `hub` and `town` pin by digest
and that any GHCR cleanup policy would collect first; (b) confirm the Phase-5 soak
elapsed clean; (c) get an explicit human decision recorded — this is not an agent's
call to make.

**Two things that are irreversible earlier, and must not be triggered:**

* **On-chain settlement.** Nothing in Phases 4–5 should close or settle a payment
  channel. A `stop` does not settle; a `down` or an operator-initiated close does. If
  a channel settles on chain during drain, that transaction is permanent regardless of
  how cleanly the containers roll back.
* **`docker compose down` instead of `stop`.** Named volumes survive `down`, but the
  TS connector's `connector_data` and its ledger snapshot are far easier to lose to a
  stray `-v`. The runbook says `stop` everywhere for this reason.

### Phase 7 — retire the `/rust/` prefix (reversible throughout)

After Phase 4 the Rust connector **is** the default edge: it answers `/ilp` and
`/ilp/btp`, exactly what TypeScript served. `/rust/ilp` is then a redundant alias to
the same upstream, and ADR 0013 is explicit that the temporary artifact "exists to be
deleted." §5.1 records why it exists at all.

**The ordering constraint that makes this more than an nginx edit: the announcement
must lead the path change, and the clients that ignore announcements set the pace.**

Prerequisite: Phase 0.2 must have codified the `/rust/ilp/btp` block into git (§5) —
it is currently box-only, and you cannot sequence the removal of a location the repo
does not contain.

**7.1 Re-announce the canonical URLs** (do this as soon as Phase 4 lands; both paths
serve, so it is safe the moment `/ilp` works). Change on the apex only:

```yaml
ANNOUNCER_HTTP_ENDPOINT: https://proxy.devnet.toonprotocol.dev/ilp        # was /rust/ilp
ANNOUNCER_BTP_ENDPOINT:  wss://proxy.devnet.toonprotocol.dev/ilp/btp     # was /rust/ilp/btp
```

then `up -d announcer` — the sidecar only; no connector restarts.

This is cheap and fast by construction. The endpoints are **pure env passthrough**
(`packages/announcer/src/config.ts:176-177` → `announce-builder.ts:88-90`, no
normalisation, no host inference), and kind:10032 is a replaceable event with no `d`
tag, so a fresh announce from the same pubkey supersedes the old one immediately.
Re-announce interval is 300s and the NIP-40 expiration is 2× that, so **worst case a
stale announce lingers ~10 minutes**, and only if the sidecar is down.
*Verify:* re-read the announce off the relay and confirm `httpEndpoint`/`btpEndpoint`
no longer contain `/rust/`. *Rollback:* revert the two env vars, `up -d announcer`.

**7.2 Ship client releases that drop the compiled-in `/rust/` defaults.** This is the
long pole and it is a release-and-adoption cycle, not an ops step. Discovery **cannot**
rescue these — both pin the path in compiled code:

| Consumer | File | Constant |
|---|---|---|
| **rig** (highest impact — its default uplink) | `toon-client/packages/rig/src/cli/standalone-mode.ts:159-160` (duplicated in the standalone `rig` checkout) | `OFFICIAL_PROXY_URL = https://proxy.devnet.toonprotocol.dev/rust/ilp` |
| **buzz** | `buzz/desktop/src/shared/api/toonTransportConfig.ts:124,125,130` | `TOON_DEVNET_DEFAULTS.proxyUrl` / `.connectorUrl` / `.btpUrl` |

rig is the sharp one: `standalone-mode.ts:475,491` puts explicit config above
`OFFICIAL_PROXY_URL` and **the announce no longer places the uplink at all** — it only
informs destination, routes and prices. So re-pointing discovery in 7.1 does not move
rig by one packet. buzz is pinned by deliberate design; its own file comment
(`toonTransportConfig.ts:114-121`) states it does not use kind:10032 discovery, and its
BTP constant has no fallback path whatsoever.

Also in this step, and easy to miss: the announcer's own **code defaults**
(`packages/announcer/src/config.ts:71-72`) still carry `/rust/…`, so an announcer that
ever starts without its env override re-publishes the dead path. Its test suite pins
them too (`config.test.ts:23-24`, `event.test.ts:12-13`, `announce-builder.test.ts`,
`service.test.ts`), so this is one coordinated change, not a one-liner.
*Verify:* released rig and buzz binaries reach the edge with no `/rust/` in any request.
*Rollback:* n/a — shipping a release is not reversible, but it is also not destructive.

**7.3 Reseed `genesis-peers.json`.** `toon/packages/core/src/discovery/genesis-peers.json`
is the committed bootstrap seed for brand-new users, and it currently seeds the **TypeScript**
identity: `btpEndpoint: wss://proxy.devnet.toonprotocol.dev:443`, `ilpAddress: g.proxy`,
no `httpEndpoint` at all. Both the port and the `g.proxy` prefix die with TypeScript, so
this breaks at Phase 5 regardless of `/rust/` — it is listed here because it is the same
re-pointing exercise. `GenesisPeerLoader.test.ts:169` pins the value.
*Verify:* a cold client with no cache bootstraps successfully. *Rollback:* revert.

**7.4 Retire the competing announce.** The apex TS `selfAnnounce` is already disabled
on the box; the **store box's is still enabled** (`selfAnnounce.enabled: true`,
advertising `wss://proxy.store…:443` and `https://proxy.store…/ilp`). The two announces
come from different pubkeys, so they do **not** replace each other — both sit in
discovery simultaneously. Disable the store box's in the same window its TS connector
stops (Phase 5.1), and stand up its announcer sidecar (Phase 3.4) first so the store
box does not vanish from discovery in between.
*Verify:* exactly one kind:10032 announce per node, naming the Rust endpoints.
*Rollback:* re-enable `selfAnnounce`, restart.

**7.5 Soak, measured against the access log — not a calendar.** This is the substitute
for the prefix-retirement checklist's Condition 1, which cannot be executed as written
(§5.1). The signal is real and already proven useful — it is what characterised the
Rust edge in §1.3:

```bash
docker logs linode-node-nginx-1 2>&1 | grep -c 'rust/ilp'          # total
docker logs linode-node-nginx-1 2>&1 | grep 'rust/ilp' \
  | sed -E 's#.*\[([0-9]{2}/[A-Za-z]{3}/[0-9]{4}:[0-9]{2}).*#\1#' | uniq -c | tail -30
docker logs linode-node-nginx-1 2>&1 | grep 'rust/ilp' | awk '{print $1}' | sort | uniq -c
```

Hold until the hourly count is **zero across a window that spans the longest realistic
gap between two legitimate uses**, and record which window was chosen and why. The
per-IP breakdown matters as much as the total: §1.3 showed two IPs in one /24 account
for 99.9% of all `/rust/ilp` traffic ever, so a single residual client is identifiable
rather than anonymous — and can be chased directly instead of waited out.

Do **not** substitute a fixed number of days. The `/rust/` path must outlive the last
shipped rig and buzz build that pins it, and that is an adoption question the log
answers and the calendar does not.

**7.6 Remove the `/rust/` locations.** Delete `location /rust/ilp` and
`location = /rust/ilp/btp` from `infra/linode-node/nginx/conf.d/node.conf` (and from
the store box's, added in Phase 1.3), then:

```bash
docker exec linode-node-nginx-1 nginx -t && docker exec linode-node-nginx-1 nginx -s reload
```

*Verify:* `curl -s -o /dev/null -w '%{http_code}' https://proxy.devnet.toonprotocol.dev/rust/ilp/identity`
→ 404, while `…/ilp/identity` → 200; paid writes still land and `CLAIMS()` still
increments.
*Rollback:* **re-add the two blocks and reload — seconds, graceful, total.** This is
worth stating plainly because it is the one asymmetry with the TypeScript retirement:
cutting off an un-migrated client here is *recoverable*, because the upstream still
exists and only the alias was removed. That is not true of Phase 6.3.

**Why a redirect is not proposed.** `/rust/ilp` takes `POST` bodies and a websocket
upgrade. A 301/302 loses the method and body on many HTTP clients; 308 preserves them
but only for clients that follow redirects at all (several here do not), and a
websocket upgrade cannot be usefully redirected in any case. A dumb alias that proxies
to the same upstream is strictly safer than a redirect that works for some clients and
silently truncates others — so `/rust/ilp` stays a full alias right up until it is
deleted.

---

## 4. TypeScript-connector retirement inventory

Full evidence in the companion research; the headline and the blockers:

**Headline: the running TypeScript image is an orphan.** `3.36.3-solchan.0`
(`sha256:4a77e0f90c12…`) was built by a manual `workflow_dispatch` on 2026-07-20 from
commit `c449a66e` on the **unmerged branch `fix/channelmanager-open-3.36`**, which is
still on `origin` — the only place its source survives. `main` deleted the TS
connector a week later (#465, #543) *along with the workflow that builds it*. So the
thing serving the devnet's default public edge on both boxes has no reproducible build
path. Every rollback in this plan depends on a GHCR tag nobody is protecting, in a
package with 2,674 versions and no retention policy.

Second finding worth acting on independently: **`ghcr.io/toon-protocol/connector:latest`
is still a TypeScript image** (`sha256:3b8e24ec…`, pushed 2026-07-27). Two shipped
operator recipes — `deploy/pay-edge/.env.example` and
`deploy/node-quickstart/.env.example` — default to `:latest`. The day #431 repoints
`:latest` at Rust, every operator following node-quickstart silently switches runtime
and their YAML `connector.yaml` stops being valid config (Rust reads TOML). That is a
live foot-gun today, independent of anything in this plan.

### The genuine blockers

| # | What | Why it blocks |
|---|---|---|
| 1 | **The two live boxes** — `infra/linode-store/docker-compose.store.yml:21`, `infra/linode-node/docker-compose.node.yml:9` | The rollback path for this entire cutover. `infra/devnet-manage.sh:389,391` and both `bootstrap.sh`s re-pull on any redeploy. Not mirrored anywhere; no `docker save` artifact exists in any repo. |
| 2 | **relay + store `deploy/Dockerfile:17`** `FROM ghcr.io/toon-protocol/connector:3.28.0`, built by `publish-{relay,store}-connector-image.yml` on **every push to main** | The only references that break *automatically*. Both repos are active. Purge the tag and the next unrelated commit turns CI red in two repos. |
| 3 | **`3.28.0` specifically** | Its only remaining consumer is #2, four minors behind everything else. A "delete tags up to 3.36" cleanup takes it out. |
| 4 | **`deploy/pay-edge` + `deploy/node-quickstart`** | Public onboarding bundles defaulting to `:latest` (still TS) with a `3.44.0` fallback. See the `:latest` foot-gun above. |
| 5 | **Untagged digest `sha256:48d2160e…`** pinned by `hub/packages/hub/src/constants.ts:123`, `town/packages/townhouse/src/constants.ts:123`, `town/docker-compose-townhouse.yml:23` | Untagged versions are what GHCR cleanup deletes first. Mitigated: both repos are GitHub-archived, so their CI cannot fire. Latent, not active. |
| 6 | **`swap` instantiates `ConnectorNode` as a library** — `packages/swap/src/swap-node.ts:31`, plus integration/e2e harnesses, at npm `^3.30.0` | The one place the TS connector *runtime* still ships in an active repo. Independent of GHCR (npm, not images), and it has no Rust equivalent. `swap` must stop needing `ConnectorNode` before it can move to `@toon-protocol/connector@4.x`. |

### Confirmed noise — the "TypeScript nearby" half

* **`buzz`, `toon-client`, `rig`: all three clean.** Verified, not assumed. `buzz`
  does not even resolve the package (unsatisfied optional peer +
  `transitivePeerDependencies`). `toon-client` and `rig` resolve it transitively via
  `@toon-protocol/core`'s optional peer but have **zero import statements**;
  toon-client's ~10 hits are doc comments, and `IsomorphicBtpClient.ts:7` states
  outright that it *replaces* the connector's BTP client.
* `store/package.json` declares `@toon-protocol/connector` and never imports it —
  vestigial, one-line deletion.
* `npm @toon-protocol/connector@4.0.0` is the **client shim**, not the server; the
  server line ends at `3.44.2`. Everything downstream pins `^3.x`, so nothing resolves
  to 4.0.0 by accident.
* ~30 `hub`/`town` test-fixture literals, ~45 `town/_bmad-output/**` planning docs,
  8 stale `town/.claude/worktrees/` copies, and all the `CONNECTOR_RELEASE_CONTRACT.md`
  / `docs/operators/*` prose: text only.
* `connector/.github/workflows/agent-{review,implement}.yml` →
  `connector:sandcastle-agent` is an agent-sandbox image squatting on the same GHCR
  path. Different lineage. Unrelated.

---

## 5. Config drift — box vs repo, and how to make the repo true again

Diffs taken this session between each live file and repo `main`. Comment-only
differences are excluded; these are semantic.

### Apex box — `<apex-ip>`

| File | Repo `main` | Live box | Severity |
|---|---|---|---|
| `connector-rust.toml` | `price = 1000`, `transport = "btp"` on `g.toon.relay` | `price = 1`, **`transport` line absent** | **High** — the box is both *ahead* (undocumented price cut) and *behind* (missing #704's transport policy) |
| `connector.yaml` | `rpcUrl: https://base-sepolia-rpc.publicnode.com` | `rpcUrl: https://sepolia.base.org` | Medium — undocumented RPC swap |
| `connector.yaml` | `selfAnnounce.enabled: true` | `enabled: false` (with an inline reason citing connector#681) | Low — deliberate and documented *on the box*, just never committed |
| `docker-compose.node.yml` | `connector:3.36.1`, `relay:sha-a8693a9` | `connector:3.36.3-solchan.0`, `relay:sha-d80f279` | **High** — a `compose pull` rolls production *backwards* |
| `docker-compose.node.yml` | faucet: `SOLANA_SOL_AMOUNT`, `SOLANA_DRIP_COOLDOWN_MS` set; `BASE_SEPOLIA_ETH_AMOUNT: 0.001` | those two keys absent; `BASE_SEPOLIA_ETH_AMOUNT: 0` | Medium — the faucet's ETH drip is silently off |
| `docker-compose.node.rust.yml` | `rust-sha-18413d9` | `rust-sha-59e167f` | High — same backwards-roll hazard |
| `nginx/conf.d/node.conf` | — | **56 lines the repo has never seen**: `/admin/metrics.json`, `^~ /admin → 404`, `/dash/`, and the entire `/rust/ilp/btp` websocket block | **High** — the Rust BTP client edge, which served all 294 sessions in §1.3, exists *only on the box* |
| `docker-compose.node.announcer.yml` | **does not exist in the repo** | deployed, running 2 days | **Highest** — see the correction below |

The box's checkout is at `05fa3ee7` with `connector.yaml`, `docker-compose.node.yml`
and `nginx/conf.d/node.conf` locally modified and `connector-rust.toml` **untracked**
— so on the apex, the Rust config is not version-controlled in any sense.

**Correction to the announcer row.** An earlier draft of this section said the
announcer "has no committed source at all." That is wrong and worth correcting
precisely, because the distinction changes the remedy. The announcer's **source does
exist in the repo** — `connector/packages/announcer/` (TypeScript: `config.ts`,
`edge-client.ts`, `announce-builder.ts`, `event.ts`, `publisher.ts`, `service.ts`,
plus its own `Dockerfile`, which is what builds the local `linode-node-announcer`
image). What does not exist in the repo is the **deployment overlay**,
`docker-compose.node.announcer.yml` — the file carrying which endpoints this box
announces. So the code is versioned and the *configuration* is not, which is exactly
the same failure shape as the untracked `connector-rust.toml` sitting beside it.

### 5.1 The deployment diverged from ADR 0013, and nothing recorded it

This belongs in the drift section because it is the same class of finding as the
untracked config and the sourceless compose overlay: reality moved and no document
followed.

**ADR 0013 (`docs/adr/0013-cut-over-through-a-parallel-address-space.md`) specifies a
parallel ILP *prefix*.** Quoting it directly:

> The Rust connectors are deployed alongside the TypeScript ones, **under a different
> ILP prefix**, fronting the same running relay and store apps. Both networks are live
> at once. **Traffic moves by changing a destination address**, one client at a time,
> and the TypeScript prefix is deleted once nothing addresses it.

**What actually shipped is a parallel HTTP *path* with the *same* ILP prefixes on both
fleets.** Both connectors serve `g.toon.relay`, `g.toon.ario` and `g.toon.store`; what
distinguishes them is `/rust/ilp` versus `/ilp`. There is no second address space.
Nobody wrote this down — ADR 0013 still reads as though the prefix split exists.

Four concrete consequences, each of which has already bitten or is about to:

1. **"Traffic moves by changing a destination address" is not available.** A client
   moves between fleets by changing a *URL*, not a destination. That is why Phase 4 of
   the runbook is an nginx `$backend` edit rather than the per-client, one-at-a-time
   migration the ADR describes.
2. **"Rollback is changing a destination string" is not available either.** Rollback is
   also an nginx edit — which is fine, and in fact faster, but it is not what the ADR
   promises and not what anyone reading the ADR would plan against.
3. **`docs/operators/prefix-retirement-checklist.md` cannot be executed literally.**
   Its Condition 1 is "no traffic is reaching the old prefix," measured on the TS
   fleet's `/metrics`. There is no old prefix to go quiet — both fleets answer the same
   prefixes. The checklist's *intent* survives (observe sustained zero traffic before
   deleting), but the observable it names does not exist. The workable substitute is
   the nginx access log per path, which is what §1.3 used to characterise the Rust
   edge and what Phase 7 uses to retire it.
4. **ADR 0013's disposability clause has already been violated.** It says the temporary
   prefix "is disposable by design — it exists to be deleted, and **nothing durable
   should be published against it**." The `/rust/` path is that disposable artifact,
   and the announcer sidecar publishes it into kind:10032 discovery. Verified live this
   session by reading the relay: the current apex announce carries
   `"httpEndpoint":"https://proxy.devnet.toonprotocol.dev/rust/ilp"` and
   `"btpEndpoint":"wss://proxy.devnet.toonprotocol.dev/rust/ilp/btp"`. Something durable
   *is* published against the throwaway path, which is precisely what Phase 7 has to
   unwind.

**Recommendation:** amend ADR 0013 with a status note recording that the parallel-prefix
mechanism was not what shipped, and that the parallel *path* is the real mechanism —
then update `prefix-retirement-checklist.md`'s Condition 1 to name the nginx access log
rather than a prefix that never existed. Neither document is wrong about intent; both
are wrong about the observable, and an operator following them today would go looking
for something that is not there.

### Store box — `<store-ip>`

**Clean.** `connector.yaml`, `docker-compose.store.yml` and `nginx/conf.d/node.conf`
are byte-identical to repo `main` except for comments (#657/#658 reconciled this box
and it has held). This is the proof that the reconciliation below is achievable — one
box already lives that way.

### The price contradiction, specifically

The live apex `connector-rust.toml` reads:

```toml
# Priced at parity with the TypeScript fleet's own g.toon.relay route on
# this same box (…`price: '1000'`): … so `1000` here is the identical
# real-world charge -- 0.001 USDC …
price = 1
```

The comment asserts parity with the TS route on the same box while the value is
1/1000th of it. The TS route still charges `1000`. Both connectors front
`relay:3100`. **This is a live 1000× arbitrage between two doors into one handler**,
and the only reason it has not been exploited is that nothing routes to the Rust door
(§1.4). It is not attributable — no bash history, no commit, no patch file — so treat
authorship as unknown.

Do not "fix" it by restoring `1000`. Somebody cut it for a reason (circumstantially
the buzz-huddles 1 µUSDC/frame quote, which is a coherent price for a per-frame audio
route and an incoherent one for a general relay write). Phase 0.4 forces the decision
to be made, recorded, and applied from the repo.

### Recommendation — three moves, in order

**1. Adopt the box, don't overwrite it.** Every apex difference above is the box
being *right* and the repo being stale. Commit the box's current state verbatim
(Phase 0.2, 0.3) — image pins, nginx blocks, announcer overlay, RPC URL,
`selfAnnounce: false` — in one clearly-labelled "reconciled from live" commit, with
the sole exception of the price, which gets a decision rather than a transcription.
Overwriting the box from stale repo config would take down the Rust BTP edge and the
announcer.

**2. Close the two structural holes that let this happen.**
* `connector-rust.toml` is **untracked** in the apex's checkout. Any edit to it is
  invisible to `git status`, which is precisely how a 1000× price change left no
  trace. Committing it (move 1) fixes this by itself.
* The announcer's *deployment overlay* has no repo source (its code does — see the
  correction above). Until the overlay is committed, redeploying the apex from a
  clean checkout **silently drops a running service**, and with it every endpoint
  the network discovers.
* The `/rust/ilp/btp` nginx block — which served all 294 BTP sessions in §1.3 — is
  **not in git either**. The committed `node.conf` has only `location /rust/ilp`.
  An nginx redeploy from a clean checkout today drops the Rust BTP edge outright.
  This must be codified *before* Phase 7 sequences anything, because you cannot
  cleanly retire a path that the repo does not know exists.

**3. Add a drift check to the existing devnet tooling.** `infra/devnet-manage.sh`
already SSHes to both boxes. A read-only `drift` subcommand that diffs each live
config against `git show main:<path>` and prints the delta turns this audit — which
took a session — into a command. Pair it with the `the_two_fleets_price_the_shared_store_prefixes_identically`
test now on the branch: the test catches divergence *in the repo*, the subcommand
catches divergence *on the boxes*, and between them there is no longer a place where a
hand-edited price can hide for twenty hours.

A stricter option — mount configs read-only from a git-checkout-verified path, or bake
them into the image — is worth considering later, but it removes the ability to hotfix
a live box, which on a devnet is a real cost. The drift check gets most of the benefit
at none of that cost.

---

## 6. Pre-merge verification for PR #718 (delete the raw-TCP peer wire)

**Date: 2026-08-03. Verdict: all four conditions PASS. Nothing on either box is
carrying peer-wire traffic. #718 is safe to merge on this evidence.**

Requested as the final acceptance criterion of PR #718, which deletes ADR 0003's
raw-TCP peer wire. Every command below is a read; nothing was deployed, restarted or
edited. Run from this session against both boxes.

**One wording caveat, flagged rather than buried — see §6.5.** Condition 2 as
literally worded ("no `[[peers]]` entry in any live config, Rust or TS") is **not**
true, and cannot be made true without breaking production. It conflates two unrelated
mechanisms. The peer wire is dead; the BTP peering is very much alive.

### 6.1 Condition 1 — no peer-wire listener is bound — **PASS**

The store overlay's old wire would have bound `:4001`. Checked at both layers,
because a host-side check alone would miss a bind that was never published:

```
$ ss -ltnp 'sport = :4001'
apex  → NONE listening on 4001
store → NONE listening on 4001
```

Host listeners in full — apex: `80, 443, 3000, 8080, 3500, 22`, plus
`127.0.0.1:4000` (Rust client edge, loopback-only). Store: `80, 443, 3000, 8080,
22`. No `4001` on either, and no other unexplained port.

The stronger check, **inside the container's own network namespace**, where an
unpublished bind would still show:

```
$ PID=$(docker inspect -f '{{.State.Pid}}' linode-node-connector-rust-1)
$ nsenter -t $PID -n ss -ltnp
LISTEN 0 4096 127.0.0.11:40505 0.0.0.0:* users:(("dockerd",pid=874,fd=94))
LISTEN 0 128     0.0.0.0:4000  0.0.0.0:* users:(("connector",pid=2249201,fd=13))
```

**The Rust connector process holds exactly one socket: the client edge on `:4000`.**
There is no peer-wire listener even inside its own namespace. This is the strongest
available form of the condition.

### 6.2 Condition 2 — no peer-wire config — **PASS** (see §6.5 on wording)

Apex Rust config, the only Rust config on the fleet:

```
$ grep -nE '^\[\[peers\]\]|^peer_wire_addr|^\s*peer_id' \
    /root/connector/infra/linode-node/connector-rust.toml
NO [[peers]] / peer_wire_addr / peer_id in apex connector-rust.toml
```

Store box: there is no Rust config to check, and no Rust anything:

```
$ ls /root/connector/infra/linode-store/connector-rust.toml
NO connector-rust.toml on store box
$ docker ps -a --format '{{.Names}}' | grep -i rust
NO rust container (running or exited) on store box
```

**No `[[peers]]` table, no `peer_wire_addr`, and no route with a `peer_id` next hop
exists anywhere on the fleet.** These are the three constructs #718 removes.

### 6.3 Condition 3 — `peer-claims.log` is 0 bytes — **PASS**

The apex holds the fleet's only Rust state volume
(`docker volume ls | grep rust` → `linode-node_connector_rust_state`, one result;
the store box has none). Exact figures, not "empty":

```
$ stat -c 'file=%n size=%s bytes mtime=%y' \
    /var/lib/docker/volumes/linode-node_connector_rust_state/_data/peer-claims.log
file=…/peer-claims.log size=0 bytes mtime=2026-07-29 21:52:35.754430751 +0000
```

**Size: exactly 0 bytes. mtime: 2026-07-29 21:52:35.754430751 +0000.**

That mtime is the decisive detail. It is byte-identical to the mtime of the
containing directory (`drwxr-xr-x 2 10001 10001 4096 2026-07-29
21:52:35.754430751 +0000 .`), i.e. **the instant the volume was initialised**. The
file was created when the state directory was laid down and has not been touched in
the five days since. Not "empty now" — never written, once, ever.

For contrast, the sibling journal on the same volume is alive and 134 MB:

```
-rw-r--r-- 1 10001 10001 134767150 2026-08-03 02:02:27 client-edge-claims.log
-rw-r--r-- 1 10001 10001         0 2026-07-29 21:52:35 peer-claims.log
```

So the node has demonstrably been writing claims — to the *client edge* journal. The
peer journal's zero is the absence of peer traffic, not the absence of a working
connector.

### 6.4 Condition 4 — no socket in any state on the peer-wire port — **PASS**

```
$ ss -tanp | awk '$4 ~ /:4001$/ || $5 ~ /:4001$/'
apex  → NO socket in any state on 4001
store → NO socket in any state on 4001
```

No `LISTEN`, no `ESTAB`, no `TIME_WAIT`, no half-open connection, inbound or
outbound, on either box.

### 6.5 The caveat: condition 2's wording conflates two different things

**This does not block #718.** It is flagged so nobody reads "no peers anywhere" off
this verification and concludes that the BTP peering is also disposable.

Both TypeScript configs **do** contain live `peers:` entries, and they are carrying
production traffic right now:

```
# /root/connector/infra/linode-store/connector.yaml:121
peers:
  - id: relay-connector
    url: wss://proxy.devnet.toonprotocol.dev:443
    relation: peer

# /root/connector/infra/linode-node/connector.yaml:66
peers:
  - id: store-box
    url: wss://proxy.store.devnet.toonprotocol.dev:443
    relation: peer
```

These are **BTP peers over TLS on 443**, terminated by each box's nginx and proxied
to `connector:3000` — an entirely different mechanism from ADR 0003's raw-TCP wire.
Confirmed live in both containers' namespaces (`node` listening on `*:3000`) and, per
§1 and `DEPLOYED-FINDINGS.md`, carrying the store box's 5-minute self-announce with
verified Solana claims.

The distinction that matters for #718:

| | Rust `[[peers]]` / `peer_wire_addr` | TypeScript `peers:` |
|---|---|---|
| Transport | raw TCP, custom framing, `SocketAddr` only | BTP over `wss://…:443` |
| Defined in | `crates/connector-config/src/peer.rs` | TS connector YAML |
| Deleted by #718 | **yes** | **no — untouched** |
| Live on the fleet | **nowhere** | **both boxes, right now** |

#718 deletes the Rust construct. It cannot affect the TypeScript one. So the
condition that actually needed verifying — *no live peer-wire config or traffic* — is
met, while the literal wording ("no `[[peers]]` in Rust **or TS**") would have failed
against a healthy production fleet.

Suggested re-wording for the AC: *"no `[[peers]]` table, `peer_wire_addr`, or
`peer_id` route exists in any Rust connector config, and no socket exists on the
peer-wire port."* That is what was checked, and it passes.

### 6.6 Summary

| # | Condition | Apex | Store | Evidence |
|---|---|---|---|---|
| 1 | No peer-wire listener | **PASS** | **PASS** | `ss -ltnp` host + `nsenter` container netns; connector holds only `:4000` |
| 2 | No peer-wire config | **PASS** | **PASS** (no Rust config exists) | `grep` on live `connector-rust.toml`; store box has no Rust at all |
| 3 | `peer-claims.log` 0 bytes | **PASS** | **N/A** (no volume) | `size=0`, mtime = volume-creation instant |
| 4 | No socket on the port | **PASS** | **PASS** | `ss -tanp`, any state |

**Nothing found that contradicts the two prior audits. The peer wire has never
carried a byte on this fleet.** Re-run §6.1 and §6.4 immediately before merging if
more than a day passes — these are point-in-time reads, and the same caveat the
prefix-retirement checklist makes about its own conditions applies here.
