# Paying a demo invoice locally (fiber-node-payer)

This is a contributor/testing tool, not something a merchant or integrator needs —
it exists so you can actually pay a [demo storefront](../merchants/demo-storefront.md)
invoice end-to-end without a separate real wallet/node handy.

Runs as a 4th service, `fiber-node-payer`, right in root `docker-compose.yml` —
**local-testing-only**, gated behind `profiles: [payer]` so a plain
`docker compose up -d` never starts it; only `docker compose up -d fiber-node-payer`
/ `pnpm docker:payer` does. It's a second `nervos/fiber` node on the same
`fibergate-net` network as `fiber-node` — lets you actually pay a demo invoice by
opening a direct channel between the two, entirely over plain TCP inside that
network. No TLS/WSS setup needed (that's only required for a *browser-based*
wallet).

This only needs `fiber-node` itself running — e.g. via `pnpm docker:dev` — it never
touches `postgres`/`fibergate-core`.

1. Generate a CKB testnet key for the payer — **separate** from `fiber-node`'s own
   key (this is a throwaway test wallet, not the merchant's identity):
   ```bash
   mkdir -p docker/fiber-node-payer/ckb
   ckb-cli account export --lock-arg <lock_arg> --extended-privkey-path ./exported-key
   head -n 1 ./exported-key > docker/fiber-node-payer/ckb/key
   rm ./exported-key
   chmod 600 docker/fiber-node-payer/ckb/key
   ```
   Set `FIBER_PAYER_SECRET_KEY_PASSWORD` in root `.env` to the passphrase you want
   to encrypt that key with.
2. Fund the payer's wallet via https://faucet.nervos.org — get its CKB address from
   `ckb-cli` (the same key/lock-arg from step 1), fund with enough to cover a
   channel (recommend ~250 CKB: the 99 CKB reserve + a modest funding amount + fees).
3. Start `fiber-node` if it isn't already running, then the payer:
   ```bash
   pnpm docker:dev    # postgres + fiber-node, if not already running
   pnpm docker:payer  # fiber-node-payer only — reads root .env, same as fiber-node
   docker compose ps  # wait for fiber-node-payer to report "healthy"
   ```
4. Get `fiber-node`'s pubkey, then convert it to the multiaddr `fiber-node-payer`
   needs for `connect_peer`:
   ```bash
   curl -s -X POST http://localhost:8227 -H 'Content-Type: application/json' \
     --data '{"id":1,"jsonrpc":"2.0","method":"node_info","params":[]}' | jq -r '.result.pubkey'

   cd apps/demo-storefront
   pnpm payer:multiaddr <pubkey from above>
   # → /ip4/172.28.0.10/tcp/8228/p2p/<peer id>
   ```
5. Connect the payer to `fiber-node` and open a channel (both against the payer's
   own RPC, port `8237`):
   ```bash
   curl -s -X POST http://localhost:8237 -H 'Content-Type: application/json' \
     --data '{"id":1,"jsonrpc":"2.0","method":"connect_peer","params":[{"address":"<multiaddr from step 4>"}]}'

   curl -s -X POST http://localhost:8237 -H 'Content-Type: application/json' \
     --data '{"id":1,"jsonrpc":"2.0","method":"open_channel","params":[{"pubkey":"<fiber-node pubkey>","funding_amount":"0x4a817c800"}]}'
   # 0x4a817c800 = 200 CKB in shannons — must be >= fiber-node's own
   # open_channel_auto_accept_min_ckb_funding_amount (check via node_info on
   # :8227; defaults to 100 CKB = 0x2540be400) or the channel needs a manual
   # accept_channel from fiber-node's side.
   ```
   Poll until ready (no gossip-sync wait needed — this is a direct channel, not a
   multi-hop route):
   ```bash
   curl -s -X POST http://localhost:8237 -H 'Content-Type: application/json' \
     --data '{"id":1,"jsonrpc":"2.0","method":"list_channels","params":[{}]}' | jq '.result.channels[].state.state_name'
   # wait for "ChannelReady"
   ```
6. Pay the invoice — grab `invoice_address` from the demo storefront's QR/text,
   then:
   ```bash
   curl -s -X POST http://localhost:8237 -H 'Content-Type: application/json' \
     --data '{"id":1,"jsonrpc":"2.0","method":"send_payment","params":[{"invoice":"<invoice_address>"}]}'
   ```
   `fibergate-core`'s real-time listener picks up the `Paid` status within
   seconds (30s poller as fallback), fires the webhook, and the demo storefront's
   page updates automatically via SSE.

Something not working? See [Troubleshooting](../common/troubleshooting.md).
