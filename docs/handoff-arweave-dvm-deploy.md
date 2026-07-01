# Handoff — Arweave DVM (`g.proxy.store`) deploy on Linode

Status as of 2026-06-24. Deploys the Arweave DVM (kind:5094) to its own Linode box,
peered to the apex so the apex earns a routing fee, and advertised on the shared
relay for discovery.

## What's live + proven

- **DVM image** — `ghcr.io/toon-protocol/dvm:latest` (linux/amd64). `Dockerfile.dvm`
  was a stale monorepo copy; rebuilt for the carved `store` repo. Serves kind:5094,
  boots healthy. (store **PR #18**, branch `ci/publish-dvm-image`.)
- **Store box** — `toon-devnet-store` @ `45.79.173.113`, trusted Let's Encrypt TLS.
  Public: `https://dvm.devnet.toonprotocol.dev/health`, ILP edge
  `https://proxy.store.devnet.toonprotocol.dev/ilp`. (connector **PR #256**, branch
  `feat/devnet-store-node`: `infra/linode-store/` + `devnet-manage.sh store`.)
- **Distinct funded identity** — store connector runs `STORE_TOON_MNEMONIC`
  (env-required, NOT committed): evm `0x1f4E12A9357a3c46477F95F6f9813eeBF49f106e`,
  sol `4AhgNKLgXi9NygSL85xrA1hcm3beHtXTHiEWQMhUMBvt`,
  mina `B62qn3RVqmEqg8k27yND4692JVTdaTAKdebCspSKck23WoDudFEbWbt`. Faucet-funded.
- **Peer + fee** — store connector is a `relation: peer` of the apex (BTP,
  `wss://…:443`). Bilateral channels open (store→apex `0x1bdfd98a…`, apex→store
  `0x952ade04…`). Apex routes `g.proxy.store` → store peer with
  `connectorFeePercentage: 0.1` → **apex earns the hop fee**. (connector **PR #257**,
  branch `feat/devnet-store-peering`.)
- **Discovery** — the DVM publishes a complete, payable **kind:10032** to relay-ws
  (`ilpAddress g.proxy.store`, public btpEndpoint, settlementAddresses, chains,
  price). `toon_add_apex g.proxy.store` → **`ready:true`** (client discovers + opens
  a pay-channel). Publish goes as a paid `POST /write` HTTP envelope → relay stored
  it (`accepted:true`).

## The gap (NOT yet working): the actual paid kind:5094 job round-trip

A standard client can discover `g.proxy.store` and open a channel, but a paid
kind:5094 job never reaches the DVM handler. Root cause = **payload-format skew
between the deployed connector and the published SDK**:

- Connector **3.25.1** terminates every route via `HttpProxyHandler` — it treats the
  packet payload as a **literal HTTP request** and replays it to the backend's HTTP
  API (relay `POST /write`, DVM `:3300`). "Payment-proxy" model.
- The bundled SDK **0.5.0** client sends a **raw TOON-encoded Nostr event** as the
  payload, and its HTTP ILP client targets `/send-packet`.

So the client speaks "raw TOON event"; the connector expects "HTTP request envelope"
+ `/admin/ilp/send`. They're different generations of the wire contract. Symptoms
seen, all the same root: `404 /send-packet`, `F01 Invalid HTTP envelope`, and the
kind:5094 job never arriving at the DVM. The one-shot kind:10032 advert works only
because the DVM entrypoint hand-builds the HTTP envelope for that single publish.

### Fix = version alignment (next step)

Make both sides speak the same contract:
- build the DVM against an SDK whose client matches connector 3.25.x (HTTP-proxy
  envelope + `/admin/ilp/send`), **or**
- run a connector version matching SDK 0.5.0's raw-TOON delivery.

Then kind:5094 jobs (and event-writes) work through the standard client without
per-call envelope hacks. Confirm the compatible `@toon-protocol/sdk` ↔ connector
version pair first.

## Notes / debt

- **PR #257 is stacked on an older `feat/devnet-multi-node`** than the live toon box
  (`895357e`). The apex's `connector.yaml` was **hand-patched** on the box (backup at
  `/root/connector.yaml.bak`); rebase #257 onto current `feat/devnet-multi-node`
  before normal-path deploy.
- **Pricing reconcile**: DVM advertises per-byte (`feePerByte 10`) while the connector
  route pins flat `price '1000'` — align before relying on job pricing.
- Server↔server transport is **BTP** (`wss://…:443`), not standalone-HTTP — see the
  `toon-server-comms-btp` memory.
