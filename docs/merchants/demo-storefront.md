# Demo storefront

`apps/demo-storefront` is a reference merchant app — a mock storefront selling one
digital product, deliberately built as a **genuinely separate app** from
`fibergate-core` (no shared code, no shared process). It integrates the same way any
third-party merchant would: it creates an invoice via `@fibergate/sdk` making a real
HTTP call to `POST /api/v1/invoices`, renders the `invoice_address` as a QR code, and
receives a real HMAC-signed webhook on `POST /api/webhook` when the invoice is paid —
verified with the SDK's own `verifyWebhookSignature()` — which pushes a live update
to the browser via Server-Sent Events (no polling loop).

Once an invoice is showing, there's also a **"Pay with browser wallet
(experimental)"** button — runs an actual Fiber node client-side via WASM
(`@fiber-pay/react` / `@nervosnetwork/fiber-js`) so you can test paying without a
separate wallet/node. Added specifically to speed up manual testing; it's not part
of the "storefront integrates like a real merchant" story the QR code demonstrates.
Known gaps, not yet live-verified:
- The browser wallet can only reach P2P peers over `wss://` (browsers can't open raw
  TCP). `fiber-node` has a WSS path available via `nginx` (see
  [`public-https-deploy.md`](public-https-deploy.md)) once a real `DOMAIN` is
  configured and `announced_addrs` is updated — the routing config exists but hasn't
  been exercised against a real domain or a real browser payment yet.
- `@fiber-pay/react`'s documented compatibility target is Fiber `v0.9.0-rc4`;
  `fiber-node` here is pinned to `v0.9.0-rc6` — likely fine, not confirmed.

## Try it locally

1. Bring up `fibergate-core` normally — `pnpm docker:dev`, `pnpm --filter web
   db:migrate`, fill in root `.env` (see [`../maintainers/getting-started.md`](../maintainers/getting-started.md)).
2. Register a webhook endpoint pointing at the demo storefront — `url:
   http://localhost:3001/api/webhook`, `events: ["payment.paid"]` — and note the
   secret you set for it. There's no dashboard UI for managing `webhook_endpoints`
   yet, so do this however you're currently registering endpoints (e.g. the
   Dashboard, once that page exists, or a direct DB write).
3. Copy `apps/demo-storefront/.env.example` to `apps/demo-storefront/.env.local` and
   fill in `FIBERGATE_INTERNAL_SECRET` (same value as root `.env`) and
   `DEMO_WEBHOOK_SECRET` (the secret from step 2 — this app deliberately doesn't
   read the root `.env` file, see the comment in its `.env.example`).
4. Start both apps, each in its own terminal:
   ```bash
   pnpm dev                                 # fibergate-core, :3000
   pnpm --filter demo-storefront dev        # demo storefront, :3001
   ```
5. Open `http://localhost:3001`, click **Buy now**. A QR code appears for
   `invoice_address` — pay it from a Fiber testnet wallet with an open channel to
   this node, or use `fiber-node-payer` below if you don't have one handy. The page
   updates automatically the moment the webhook is verified — no refresh needed.

## Running it via Docker Compose

`apps/demo-storefront/docker-compose.demo.yml` is an **overlay**, not part of the
merchant-facing bundle — a plain `docker compose up -d` (root `docker-compose.yml`
alone) never starts `demo-storefront`. It reads its secrets from
`apps/demo-storefront/.env.local` (step 3 above), not from the root `.env`, so
create that file first even if you're skipping local dev and going straight to
Docker. To bring up all 4 containers together, from the repo root:

```bash
docker compose -f docker-compose.yml -f apps/demo-storefront/docker-compose.demo.yml up -d
```

## Pay a demo invoice with a second local node (fiber-node-payer)

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

Something not working? See [`../common/troubleshooting.md`](../common/troubleshooting.md).
