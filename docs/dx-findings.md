# TOON Developer-Experience Findings

A running log of friction encountered while making the Payment Proxy (Path A) live,
benchmarked against the gold-standard "drop a reverse proxy in front of my app and it
just works" experience (nginx / Caddy / Traefik). Captured by the project lead while
observing implementation/verification agents.

**Benchmark properties we're aiming for:** one-line-per-backend · service discovery by
name · auto-TLS · hot reload · **zero app changes** · sensible defaults · a single
`docker compose up` that works on a cold machine.

---

## From WS1 — local paid round-trip verification (2026-06-23)

The paid round-trip **works** (PREPARE→FULFILL→stored→free-read, unpaid rejected, store
port private) — but the *path to running it* is not yet nginx-grade.

| # | Friction | Benchmark gap | Severity |
|---|----------|---------------|----------|
| 1 | Cold `make app-test` **fails on a timeout, not an error**: it builds a ~1.4 GB image inside a jest `beforeAll` with the default 300 s hook timeout (`packages/connector/test/integration/app-e2e.test.ts:146`). Message points at "add a timeout to this test" — misleading. | "cold `up` just works" | High |
| 2 | **Docs overstate what runs.** README says `APP_E2E=1` runs the paid round-trip (AC3), but the test gates on `RELAY_IMAGE !== 'ghcr.io/toon-protocol/relay:oblivious'` while the compose default is `:latest`. So plain `make app-test` **silently skips AC3** — a dev believes they ran the paid round-trip when they didn't. The `:oblivious` sentinel is also stale. | sensible defaults / honest output | High |
| 3 | **Double build** — `make app-test` builds the connector image, then the jest `beforeAll` builds it again. | fast feedback | Med |
| 4 | No documented way to run AC3 against the published default image without passing `RELAY_IMAGE=…:latest` purely to defeat the `:oblivious` gate (a value identical to the compose default). | no magic incantations | Med |
| 5 | The CI probe (`scripts/app/ci-acceptance-probe.ts`) defaults to remote-only — needs `DOMAIN` or 5 explicit URL env vars; no documented "probe localhost" recipe though it's the same client AC3 uses. | one command | Med |
| 6 | **Relay repo can't build its own image locally** — `relay/` has no Dockerfile/compose and its README never mentions oblivious mode, ports 3100/7100, or `/write`. The local round-trip silently depends on `ghcr.io/toon-protocol/relay:latest` already in the docker cache; on a fresh machine without registry access this is a hard stop with no source fallback. | zero app changes / works on a cold machine | High |
| 7 | **Alarming-but-benign log spam** on a *successful* run: continuous `ECONNREFUSED` / `btp_connection_error` / `Max retries exceeded` (dead BTP URL is by design — claims ride HTTP) plus nonce-retry warnings. A first-timer reads PASS-with-a-wall-of-errors as failure. | trustworthy output | Med |
| 8 | Undocumented env knobs (`RELAY_NOSTR_SECRET_KEY`, `RELAY_DEV_MODE`/`TOON_DEV_MODE`, `DEVNET_*`, `:oblivious` vs `:latest`) discoverable only by reading compose + test source. | discoverability | Low |

## From WS-A1 — building the "pay-edge" deploy artifact (2026-06-23)

A generic echo backend (zero TOON awareness) was successfully fronted by the connector
proxy against the live shared devnet — the "drop in your app" thesis holds. Friction toward
the "your app + seedphrase, `docker compose up`" ideal:

| # | Friction | Benchmark gap | Severity |
|---|----------|---------------|----------|
| A1 | **Devnet IP churns every redeploy** and public DNS for `devnet.toonprotocol.dev` lagged behind, forcing a `docker extra_hosts`/`dns-pin.js` workaround. The hostname should be the stable handle; the DNS should auto-track the box. | service discovery / sensible defaults | High |
| A2 | **No `${ENV}` interpolation in `connector.yaml`** (loader is `yaml.load` only) — only `TOON_MNEMONIC` flows from env; RPC URLs + addresses are literal, so `.env` is not a single source of truth. | one config surface | Med |
| A3 | **Mnemonic ↔ route-address coupling** — setting `TOON_MNEMONIC` changes the connector's settlement address, so the dev must also hand-edit `routes[].settlementAddresses.evm` to the boot-logged address. Not auto-derived; easy to forget. | sensible defaults / zero surprise | High |
| A4 | **Paying isn't plain HTTP** — the client must serialize an ILP PREPARE with the HTTP envelope in `data` + attach a channel-claim header; no `curl` one-liner. Needs the `h402Fetch` shim / prover. | one command | Med |
| A5 | **Untrusted devnet TLS** forces `NODE_TLS_REJECT_UNAUTHORIZED=0` on every process that talks to the chains. | auto-TLS | Med |
| A6 | **The prover isn't self-contained** — it lives in the connector repo (depends on `PaidRoundTripClient` + native libsql), so it runs from the repo root, not the artifact dir. | drop-in artifact | Low |

## Cross-cutting — naming (observed across WS1/WS1b)

The payment-proxy role now has a single canonical name. **Resolved:** the canonical
apex on-wire nodeId is **`g.proxy`** (children `g.proxy.<type>`, env prefix `PROXY_*`),
as used by the live devnet and the epic-44 docs; "connector" remains the repo/product
name. Live ILP edges include `connector.pay.toonprotocol.dev/ilp` and
`proxy.store.devnet.toonprotocol.dev/ilp` (no single canonical vhost scheme).
**Pending cleanup:** purge remaining legacy `g.connector` references in favor of
`g.proxy` — a follow-up, *not* a "proxy rename".

---

## Implications for the deferred Caddy-like DX layer

These findings are the concrete backlog for the turnkey "one compose + seedphrase fronts
any app" experience (out of scope this round, tracked for follow-up):
- A single `docker compose up` that builds/pulls everything and runs the paid round-trip
  on a cold machine (fixes #1, #3, #6).
- Honest, sentinel-free test gating + docs that match what runs (#2, #4).
- A first-class `probe --local` recipe (#5).
- Quiet, trustworthy logs with expected-condition annotations (#7).
- One documented env surface (#8).
