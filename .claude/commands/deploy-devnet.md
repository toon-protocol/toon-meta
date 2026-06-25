# /deploy-devnet

Deploy or manage the TOON devnet — five Linode nodes (EVM / Solana / Mina lightnet chains + `toon` connector+relay + `store` connector+Arweave DVM) with stable `*.devnet.toonprotocol.dev` DNS and trusted Let's Encrypt TLS. After deployment, update toon-meta docs with the live URLs.

## What this skill does

1. Resolves the management script path (connector repo sibling or `CONNECTOR_REPO` env)
2. Runs the requested lifecycle command via `infra/devnet-manage.sh`
3. Waits for all agents to report healthy
4. Updates `docs/deployment.md`, `context/context.md`, and the endpoint tables in toon-meta

## Node layout

| Node | Linode label | Size | Public URLs |
|------|-------------|------|-------------|
| EVM (Anvil) | toon-devnet-evm | g6-standard-1 (2GB) | `https://evm-rpc.devnet.toonprotocol.dev` |
| Solana | toon-devnet-sol | g6-standard-2 (4GB) | `https://solana-rpc.devnet.toonprotocol.dev`, `wss://solana-ws.devnet.toonprotocol.dev` |
| Mina lightnet | toon-devnet-mina | g6-standard-4 (8GB) | `https://mina.devnet.toonprotocol.dev/graphql`, `https://mina-accounts.devnet.toonprotocol.dev` |
| TOON connector (toon = relay app) | toon | g6-standard-1 (2GB) | `wss://relay-ws.devnet.toonprotocol.dev`, `https://proxy.devnet.toonprotocol.dev`, `https://faucet.devnet.toonprotocol.dev` |
| Store (Arweave DVM app) | store | g6-standard-1 (2GB) | `https://store.devnet.toonprotocol.dev` (paid `/ilp` edge; route `g.proxy.store`) |

The `toon` and `store` boxes each run their own connector (payment proxy) in front of their app (relay / Arweave DVM). The store reuses the toon node's Mina zkApps. Use the `store` command to (re)deploy just the store box; `up` / `redeploy` cover all nodes.

## Prerequisites (check these first)

- `LINODE_CLI_TOKEN` in `~/.bashrc` — Linode API token
- `PORKBUN_API_KEY` + `PORKBUN_SECRET` in `~/.bashrc` — DNS management
- `~/.ssh/id_rsa` + `~/.ssh/id_rsa.pub` — SSH key registered on Linode account (label "TOON")
- connector repo at `../connector` (or set `CONNECTOR_REPO=<path>`)
- `TOON_MNEMONIC` in environment or `~/.bashrc` (derive once; don't rotate without updating toon-meta)

## Commands

Run with no args to get status. Pass a command as the first argument:

```
/deploy-devnet up        # Provision all boxes + deploy everything + update DNS
/deploy-devnet store     # (Re)deploy ONLY the store box (reuses the toon node's Mina zkApps)
/deploy-devnet down      # Stop containers (boxes stay running; restart is fast)
/deploy-devnet destroy   # Delete all Linode boxes (loses chain state!)
/deploy-devnet status    # Probe every public endpoint
/deploy-devnet redeploy  # Pull latest images + restart containers on all nodes
/deploy-devnet dns       # Sync Porkbun DNS to current box IPs (run after IP changes)
/deploy-devnet ips       # Print current box IPs
/deploy-devnet endpoints # Print current endpoints.json
```

## Execution instructions

When this skill is invoked:

1. **Find the management script.** Look for `../connector/infra/devnet-manage.sh` relative to toon-meta. If `CONNECTOR_REPO` env is set, use `$CONNECTOR_REPO/infra/devnet-manage.sh`. If neither exists, tell the user and stop.

2. **Load credentials.** Run:
   ```bash
   eval "$(grep -E '^[[:space:]]*export[[:space:]]+(LINODE_CLI_TOKEN|PORKBUN_API_KEY|PORKBUN_SECRET)=' ~/.bashrc)"
   ```

3. **Parse the argument.** If the user typed `/deploy-devnet up`, the command is `up`. Default to `status` if no argument.

4. **Execute the command:**
   ```bash
   CONNECTOR_REPO=<path> bash <path>/infra/devnet-manage.sh <command>
   ```
   For `up` or `redeploy`, this takes 10-30 minutes (Solana Rust build is slow). Stream output to the user.

5. **After `up` or `redeploy` succeeds:** Run the status check and update toon-meta:
   - Run `bash <script> endpoints` to get the current endpoint JSON
   - Update `docs/deployment.md` "Devnet Endpoints" section with the live URLs
   - Update `context/context.md` devnet section with the live endpoints
   - Commit the toon-meta changes: `git add docs/deployment.md context/context.md && git commit -m "docs: update devnet endpoints after redeploy"`

6. **After `up` with Mina lightnet:** The Mina zkApps (USDC FungibleToken + PaymentChannel) need to be deployed to the fresh lightnet. Remind the user to run the zkApp deployment tools from the connector repo, then update `infra/linode-node/connector.yaml` with the new Mina addresses and redeploy the TOON node.

## Mnemonic note

The demo TOON_MNEMONIC is:
`giant goat guide develop boy wolf target embody leave sunny paddle neutral`

This derives:
- EVM settlement: `0xC0E55cD2E967a4F625627DaE5d4946f54267C7ab`
- Solana settlement: `A3FG5y6rfBNJQrsGYTNNR7UHAXCREPJgV362LdTQGNwK`
- Mina settlement: `B62qkEx3MsKtaEJqJMg8ZC2eXtz8FNpZy4huVpBnnUHVRUEf5f1vqdq`

Keep this mnemonic stable — rotating it requires updating `connector.yaml` settlementAddresses and re-opening payment channels.
