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
  [Public HTTPS deploy](public-https-deploy.md)) once a real `DOMAIN` is
  configured and `announced_addrs` is updated — the routing config exists but hasn't
  been exercised against a real domain or a real browser payment yet.
- `@fiber-pay/react`'s documented compatibility target is Fiber `v0.9.0-rc4`;
  `fiber-node` here is pinned to `v0.9.0-rc6` — likely fine, not confirmed.

## Try it locally

1. Bring up `fibergate-core` normally — `pnpm docker:dev`, `pnpm --filter web
   db:migrate`, fill in root `.env` (see [Getting started (contributor / local dev)](../maintainers/getting-started.md)).
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
   this node, or see
   [Paying a demo invoice locally (fiber-node-payer)](../maintainers/local-testing.md) if you don't
   have one handy (spins up a throwaway second node just to pay it). The page
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

Want to pay a demo invoice yourself without a separate wallet/node? See
[Paying a demo invoice locally (fiber-node-payer)](../maintainers/local-testing.md) — a
contributor/testing tool (a second throwaway Fiber node), not something you need to
understand as a merchant or integrator.

Something not working? See [Troubleshooting](../common/troubleshooting.md).
