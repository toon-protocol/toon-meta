# /deploy-devnet

Provision, DNS and probe the TOON devnet boxes via the connector repo's
`infra/devnet-manage.sh`.

**This command does not deploy anything.** Under
[connector ADR 0068](https://github.com/toon-protocol/connector/blob/main/docs/adr/0068-a-node-repository-pins-the-connector-nothing-here-moves-a-tag-onto-a-box.md)
a **node repository** pins the connector it runs and brings its own stack up;
the connector repo builds and cuts a release and stops there. `devnet-manage.sh`
kept only what is still its to do — create a box, sync its DNS record, probe —
and its `deploy_store_node` / `deploy_relay_node` legs and the `down` /
`redeploy` verbs were **removed**. They used to scp a config to
`/root/connector/...`, a path neither box reads any more, and then re-read that
dead path to "confirm" the write, reporting green every time.

## Node layout

Four boxes, **no apex** — the `toon` box was destroyed 2026-08-14.
Settlement is on two public chains: Base Sepolia and Solana devnet. The three
self-hosted chain boxes were deleted 2026-07-19; Mina left the connector
repository entirely with
[ADR 0065](https://github.com/toon-protocol/connector/blob/main/docs/adr/0065-mina-leaves-the-repository.md).
Do **not** re-provision any of them.

| Node | Linode label | Deployed from | Public URLs |
|------|-------------|---------------|-------------|
| Relay | `relay` | [`relay`'s own `deploy/`](https://github.com/toon-protocol/relay/tree/main/deploy) (`/root/relay`, Caddy) | `wss://relay-ws.devnet.toonprotocol.dev`, `https://proxy.relay.devnet.toonprotocol.dev/ilp` |
| Store | `ario` | [`store`'s own `deploy/`](https://github.com/toon-protocol/store/tree/main/deploy) (`/root/store`) | `https://proxy.ario.devnet.toonprotocol.dev/ilp` (routes `g.toon.store`, `g.toon.relay.store`) |
| Gas station | `gas` | [`gas-station`'s own `deploy/`](https://github.com/toon-protocol/gas-station/tree/main/deploy) | `https://proxy.gas.devnet.toonprotocol.dev/ilp` |
| Faucet | `faucet` | connector `infra/linode-faucet/`, built on-box | `https://faucet.devnet.toonprotocol.dev` (USDC only, two chains) |

`connector/infra/linode-relay/` and `infra/linode-store/` are **test fixtures,
not what those boxes run** — each says so in its own `README.md`. Editing one
changes nothing on a box.

## Prerequisites

- `LINODE_CLI_TOKEN` in `~/.bashrc` — Linode API token
- `PORKBUN_API_KEY` + `PORKBUN_SECRET` in `~/.bashrc` — DNS management
- `~/.ssh/id_rsa` + `~/.ssh/id_rsa.pub` — SSH key registered on Linode (label "TOON")
- connector repo at `../connector` (or set `CONNECTOR_REPO=<path>`)

## Commands

```
/deploy-devnet status         # Probe every public endpoint (default)
/deploy-devnet ips            # Print current box IPs
/deploy-devnet dns            # Sync Porkbun DNS to current box IPs
/deploy-devnet up             # Provision store + relay boxes and their DNS (no deploy)
/deploy-devnet store          # Provision + DNS the store box only
/deploy-devnet relay          # Provision + DNS the relay box only
/deploy-devnet faucet         # Provision the faucet box only (human finishes on-box)
/deploy-devnet faucet-cutover # Repoint faucet.devnet at the faucet box — run LAST
/deploy-devnet faucet-resize  # Resize the live faucet box (10-20 min offline)
/deploy-devnet destroy        # Delete the store + relay boxes (irreversible; NOT the faucet)
```

There is no `down`, no `redeploy` and no `endpoints` verb. Read
`connector/infra/linode/endpoints.json` for the canonical endpoint and address
list, or `GET <node>/ilp` for a node's live self-description
([ADR 0050](https://github.com/toon-protocol/connector/blob/main/docs/adr/0050-a-connectors-url-resolves-to-its-self-description.md)).

## Execution instructions

1. **Find the management script.** Look for `../connector/infra/devnet-manage.sh`
   relative to toon-meta, or `$CONNECTOR_REPO/infra/devnet-manage.sh`. If neither
   exists, tell the user and stop.

2. **Load credentials:**
   ```bash
   eval "$(grep -E '^[[:space:]]*export[[:space:]]+(LINODE_CLI_TOKEN|PORKBUN_API_KEY|PORKBUN_SECRET)=' ~/.bashrc)"
   ```

3. **Parse the argument.** Default to `status`. Refuse a verb not in the list
   above rather than passing it through.

4. **Execute:**
   ```bash
   CONNECTOR_REPO=<path> bash <path>/infra/devnet-manage.sh <command>
   ```
   Stream output. `up` prints where the actual deploy now lives and does not
   perform one.

5. **To actually deploy a node,** open a change in that node's own repository —
   bump its connector pin (relay: `deploy/Dockerfile`'s `ARG CONNECTOR_TAG`;
   store and gas-station: `deploy/docker-compose.yml`) and let its Watchtower
   pick the new image up, or run that repo's `deploy/bootstrap.sh` on the box.
   Never pin `:rust-release` — it is frozen at `rust-sha-8708caf`, a build on
   which every forward over a runtime peering is refused `T00`.

6. **After a box IP changes,** run `dns`, then `status`, and update
   `docs/deployment.md`'s node-layout and endpoint tables.
