# FiberGate

Self-hosted, open-source merchant payment gateway framework prototype for the
[Fiber Network](https://www.fiber.world/) (CKB blockchain), built for the
**"Gone in 60ms: Fiber Network Infrastructure Hackathon"** (1–15 July 2026),
category *Merchant, Liquidity, LSP, and Multi-Asset Infrastructure*.

A merchant deploys FiberGate on their own infrastructure (`docker compose up -d` — Fiber
node + PostgreSQL + FiberGate core), then calls a REST API to create invoices and receive
payments — without writing Fiber RPC integration, an invoice state machine, or webhook
delivery from scratch. Single-tenant: each deployment serves one merchant.

> Not an LSP — FiberGate does not provide liquidity or open channels on behalf of a third
> party. See `.context/glossary/fiber-terms.md` for terminology and
> `.context/business-context/project-vision.md` for full scope.

## Monorepo layout

```
apps/web/               — Next.js 14 App Router (fibergate-core: dashboard + API routes)
  app/(dashboard)/      — Protected routes (single-admin password gate): /dashboard, /webhooks, /transactions
  app/api/v1/           — REST API endpoints: /invoices, /node
  app/api/cron/         — Optional manual-trigger endpoint: /poll-invoices
  lib/db/               — Drizzle client + schema + helpers
  lib/fiber/            — Fiber JSON-RPC client (wraps FNN node calls)
apps/demo-storefront/   — Reference merchant app (see "Demo storefront" below) — a
                          genuinely separate consumer of @fibergate/sdk, no shared
                          code with apps/web
packages/sdk/           — npm package @fibergate/sdk (TypeScript, tsup)
docker/                 — docker/fibergate-core/Dockerfile, fiber-node config,
                          docker/nginx/nginx.conf.template (TLS/WSS reverse proxy — see
                          "Public HTTPS deploy" below), fiber-node-payer config
                          (local-testing-only — see "Pay a demo invoice with a second
                          local node" below)
.context/               — Project context files (single source of truth — read this before contributing)
```

## Getting started (local dev)

Requires [pnpm](https://pnpm.io/) (this repo pins `pnpm@9.15.9` via `packageManager`) and Node.js.

```bash
pnpm install                              # install all workspace packages
cp .env.example .env                      # shared secrets — see comments in the file
cp apps/web/.env.example apps/web/.env.local
# apps/web/.env.local only needs the values that differ from Docker (POSTGRES_HOST/
# PORT, FIBER_NODE_URL) — everything else comes from root .env
pnpm docker:dev                           # start only postgres + fiber-node (see "Generating
                                           # secrets" below for FIBER_SECRET_KEY_PASSWORD/CKB key)
pnpm dev                                  # run apps/web dev server against them
```

`pnpm dev` (via `apps/web`'s `dev` script) uses `dotenv-cli` to load root `.env` and
`apps/web/.env.local` together — no need to copy shared secrets into both files.

`pnpm docker:dev` starts just `postgres` and `fiber-node` (skips `fibergate-core`, since
that's the app you're running locally via `pnpm dev` instead) — the dev-mode equivalent of
"Running the full stack" below. Stop them with `pnpm docker:dev:down`.

## Commands

```bash
pnpm install                    # install all packages
pnpm dev                        # run apps/web dev server
pnpm build                      # build all workspaces
pnpm lint                       # lint the whole workspace
pnpm --filter web typecheck     # TypeScript strict check for the web app
pnpm --filter sdk build         # build only the sdk package
pnpm --filter sdk test:unit     # run the sdk package's unit tests
pnpm --filter web dev           # run only the web app
pnpm --filter web db:generate   # generate a Drizzle SQL migration from lib/db/schema.ts
pnpm --filter web db:migrate    # apply pending migrations to POSTGRES_* (run manually — see below)
```

## Running the full stack (Docker Compose)

Brings up all 6 services — `postgres`, `fiber-node` (CKB testnet), `fibergate-core`
(dashboard + API), and `nginx`/`certbot`/`nginx-certs-preflight` (public HTTPS entry
point) — on one internal-only Docker network. `nginx` is the only service that
publishes genuinely public host ports; see "Public HTTPS deploy" below for what it
needs (a real domain) and how to get a trusted cert. Without that, the stack still
starts (nginx boots with a temporary self-signed cert), but it isn't reachable as a
trusted `https://` URL from anywhere but this host until you complete that section.

### Generating secrets

`.env.example` leaves 8 vars blank on purpose — they're required, no safe default
exists, and `docker compose up -d` will fail (postgres/fibergate-core/fiber-node/nginx
erroring on an empty credential) if you skip them. `DOMAIN` and `CERTBOT_EMAIL` are
real-world values (not generated secrets) — see "Public HTTPS deploy" below for those
two. The rest:

```bash
# POSTGRES_PASSWORD, FIBERGATE_INTERNAL_SECRET, WEBHOOK_SECRET_ENCRYPTION_KEY,
# DASHBOARD_SESSION_SECRET — any random secret works, openssl is on virtually
# every machine that has Docker:
openssl rand -hex 32

# FIBER_SECRET_KEY_PASSWORD — same command works to generate a candidate value,
# but unlike the 3 above, it's NOT "generate once and forget": it must match the
# passphrase used to encrypt the CKB testnet key at docker/fiber-node/ckb/key
# (step 2 below). Already have an encrypted key? Use its existing passphrase
# here instead of generating a new one. Creating a new key? Generate the value
# above first, then use that exact value when encrypting it.

# ADMIN_PASSWORD_HASH_B64 — bcrypt hash of your dashboard login password,
# base64-encoded. No local install needed, uses Docker you already have:
docker run --rm httpd:alpine htpasswd -nbBC 10 admin 'your-real-password' | cut -d: -f2 | base64 | tr -d '\n'
# Paste the entire output into .env as ADMIN_PASSWORD_HASH_B64 — it's
# base64, not the raw "$2y$10$..." hash. This is deliberate: a raw bcrypt
# hash contains literal "$" characters, and Docker Compose's .env
# interpolation and dotenv-expand (used by `pnpm dev`/`build` via
# dotenv-cli) each corrupt those differently — verified against real
# containers, neither the raw hash nor a "$"-doubled ("$$") version survives
# both paths intact. Base64 has no "$" in its alphabet, so it passes through
# both unmangled — no escaping needed. See decisions-log.md 2026-07-05 for
# the full investigation.
```

**Prerequisites — do these before your first `docker compose up -d`:**

1. Copy the root env file and fill in real values (see "Generating secrets"
   above for the 6 generated ones, and "Public HTTPS deploy" below for `DOMAIN` /
   `CERTBOT_EMAIL`):
   ```bash
   cp .env.example .env
   ```
2. Provide `fiber-node`'s own CKB testnet signing key — encrypted with the
   passphrase you put in `FIBER_SECRET_KEY_PASSWORD` in step 1 (this key is
   separate from the 8 app-level vars above — it belongs to the node, not to
   fibergate-core):
   ```bash
   mkdir -p docker/fiber-node/ckb
   # put your CKB testnet private key at docker/fiber-node/ckb/key — must be
   # RAW hex, no "0x" prefix, exactly 1 line (no chain code). If exporting
   # via ckb-cli, keep only the first line:
   ckb-cli account export --lock-arg <lock_arg> --extended-privkey-path ./exported-key
   head -n 1 ./exported-key > docker/fiber-node/ckb/key   # drop the chain-code line
   rm ./exported-key
   chmod 600 docker/fiber-node/ckb/key
   ```
3. Point `DOMAIN` at this host and forward ports 80/443/8228 — see "Public HTTPS
   deploy" below. `docker compose up -d` will still come up without this (nginx boots
   with a temporary self-signed cert), but nothing is reachable as a trusted
   `https://` URL until this step is done.
4. Start the stack:
   ```bash
   docker compose up -d
   docker compose ps   # wait for postgres, fiber-node, and nginx-certs-preflight
                        # ("Exited (0)") to report healthy/done
   ```
5. Run database migrations once — this is a manual step, not automatic on container
   boot (`fibergate-core` will start and serve requests even before this runs, but any
   DB-backed route will fail until the tables exist):
   ```bash
   pnpm --filter web db:migrate
   ```
   Re-run this any time you pull changes that touch `apps/web/lib/db/schema.ts` /
   `apps/web/lib/db/migrations/`.
6. Get a real TLS cert (one-time, after DNS/port-forwarding in step 3 are actually
   live) — see "Public HTTPS deploy" below.

**Troubleshooting**

- **`postgres` or `fibergate-core` fail to start / crash on boot** — almost always
  a blank required var in `.env`. Check `docker compose logs postgres` or
  `docker compose logs fibergate-core` for the specific error, then fill in the
  missing value using "Generating secrets" above.
- **`fiber-node-preflight` exits with a "missing CKB testnet key" message and
  `fiber-node` never starts** — expected if step 2 above was skipped. The message
  printed by that container tells you exactly what's missing; `docker compose up -d`
  won't proceed past it. Add the key file and re-run `docker compose up -d`.
- **`fiber-node` restarts in a loop with `Secret key file error: decryption failed:
  aead::Error`** — usually **not** a wrong password. The most common cause is the key
  file having the wrong format: it must be exactly 1 line of raw private-key hex, no
  `0x` prefix. If you exported it with `ckb-cli account export --extended-privkey-path`,
  that file has 2 lines (private key + chain code) — `head -n 1` it first (see step 2
  above). Only after ruling that out, check whether `FIBER_SECRET_KEY_PASSWORD`
  actually matches the passphrase used to encrypt the key.
- **`fiber-node` starts but then exits with "Cannot listen on a public address
  without a biscuit public key set in the config"** — don't change
  `docker/fiber-node/config.yml`'s `rpc.listening_addr` to `0.0.0.0`; `fnn` treats
  that as a public bind and refuses to start without Biscuit auth configured. It's
  already pre-seeded with a static private IP (`172.28.0.10`) matching the
  `fiber-node` service's `ipv4_address` in `docker-compose.yml` — if you edited either
  of those, keep them in sync.
- **Dashboard login fails even with the right password** — check that
  `ADMIN_PASSWORD_HASH_B64` in `.env` is the base64-encoded output from
  "Generating secrets" above, not the raw `$2y$10$...` hash pasted directly.
  Decode it locally to sanity-check: `echo "$ADMIN_PASSWORD_HASH_B64" | base64 -d`
  should print a string starting with `$2y$` or `$2b$`.
- **`fibergate-core` never starts** — it has `depends_on: condition: service_healthy`
  on both `postgres` and `fiber-node`, so it intentionally won't start until both are
  healthy. Check `docker compose ps` to see which one isn't healthy yet, then check
  that service's logs.
- **`https://$DOMAIN` shows a certificate warning / "not secure"** — expected until
  you've run the one-time certbot command in "Public HTTPS deploy" below. Until then
  `nginx` is serving the temporary self-signed cert `nginx-certs-preflight` generated
  so it could start at all — that's normal on first boot, not a bug.
- **The certbot command in "Public HTTPS deploy" fails with a challenge/timeout
  error** — almost always DNS or port-forwarding, not `.env`. Confirm `DOMAIN`
  actually resolves to this host's public IP (`dig +short $DOMAIN` from any machine,
  not this one) and that ports 80/443/8228 are forwarded to it — Let's Encrypt has to
  reach port 80 on this host from the public internet to validate the challenge.
- **"Pay with browser wallet" in the demo storefront still can't connect after
  setting up WSS** — double-check `docker/fiber-node/config.yml`'s `announced_addrs`
  was actually uncommented/edited with the real domain and `fiber-node` was restarted
  (`docker compose restart fiber-node`) — this file isn't templated from `.env`, it's
  a manual edit. See "Public HTTPS deploy" below for the verification commands.

## Public HTTPS deploy

Fronts `fibergate-core`'s dashboard/API and `fiber-node`'s P2P port with TLS via an
`nginx` + `certbot` (Let's Encrypt) service pair, folded directly into
`docker-compose.yml` — a plain `docker compose up -d` now requires `DOMAIN` and
`CERTBOT_EMAIL` set in `.env`. Two things become reachable once this is fully set up:
a trusted `https://$DOMAIN` for the dashboard/API (issue #17's original goal — HTTPS for
judges trying the hosted demo), and WSS for `fiber-node`'s P2P port (unlocks
`apps/demo-storefront`'s "Pay with browser wallet" button, currently blocked — see
`decisions-log.md` 2026-07-08). It does **not** front `apps/demo-storefront` itself
(a deliberately separate app/compose overlay) — that stays plain HTTP for now.

Nginx boots even without a real cert (a temporary self-signed one, generated by
`nginx-certs-preflight` if none exists yet), so `docker compose up -d` always comes up
— but a trusted `https://` URL needs the steps below completed against a real,
publicly-resolvable domain.

### 1. Get a domain and point it at this host

Any domain works; this project's own deploy uses a free subdomain from
[is-a.dev](https://www.is-a.dev/) (a GitHub-PR-based free-subdomain registry — expect
their review process to take some time before your subdomain resolves). Once you have
one:

- Point its DNS A/AAAA record at this host's public IP.
- Forward ports **80**, **443**, and **8228** on your router/firewall to this
  machine's LAN IP (in addition to anything else you already forward). All three are
  used by `nginx`: 80 for the ACME HTTP-01 challenge + HTTPS redirect, 443 for the
  dashboard/API, 8228 for `fiber-node`'s P2P/WSS traffic.
- **If your registrar/DNS is Cloudflare: keep this record DNS-only ("grey cloud"),
  not Proxied ("orange cloud").** Proxied mode terminates TLS at Cloudflare's edge
  and doesn't forward arbitrary TCP ports like 8228 on the free/pro plan (only 80/443
  and a handful of alt HTTP(S) ports are proxied) — the WSS path for the browser
  wallet wouldn't be reachable through it. DNS-only means Cloudflare is just
  answering DNS queries, no different from any other registrar; everything below
  works exactly as written.
- Confirm it actually resolves from outside your network before continuing —
  `dig +short $DOMAIN` from a machine that isn't this one, or any public
  "DNS checker" website.

### 2. Configure and start

```bash
# In .env:
DOMAIN=your-subdomain.example.com
CERTBOT_EMAIL=you@example.com   # Let's Encrypt expiry notices

docker compose up -d
docker compose ps   # nginx-certs-preflight should show "Exited (0)", nginx "running"
```

### 3. Get a real certificate (one-time)

Only run this once DNS + port-forwarding from step 1 are actually live — Let's
Encrypt needs to reach port 80 on this host from the public internet:

```bash
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email

docker compose exec nginx nginx -s reload
```

The `certbot` service keeps running afterward and renews automatically (checks twice
daily; Let's Encrypt certs are valid 90 days, renewed around day 60) — nginx reloads
itself every 6h to pick up renewed certs, so no manual reload is needed again after
this first one.

Verify:
```bash
curl -I https://$DOMAIN   # should return a real response (e.g. a redirect to /login),
                           # no -k/--insecure needed once the cert is trusted
```
Log into the dashboard through this URL and check the response's `Set-Cookie` header
for the `Secure` attribute (browser dev tools' Application/Storage tab, or `curl -v`
on the login request) — confirms `X-Forwarded-Proto` is being forwarded and read
correctly end to end (see `system-design.md`'s cookie note for why this matters).

### 4. Enable WSS for fiber-node (unlocks the browser wallet button)

Optional — only needed for `apps/demo-storefront`'s "Pay with browser wallet" button.
Skip this if you only care about the dashboard/API being on HTTPS.

1. Edit `docker/fiber-node/config.yml`'s `announced_addrs` — uncomment the `/dns4/...`
   line already there and replace `YOUR-DOMAIN` with your real `DOMAIN`.
2. `docker compose restart fiber-node`.
3. Verify the node's pubkey and that a peer can connect through the WSS path (from
   this host, since `fiber-node`'s RPC stays loopback-only):
   ```bash
   curl -s -X POST http://127.0.0.1:8227 \
     -H "Content-Type: application/json" \
     -d '{"id": 1, "jsonrpc": "2.0", "method": "node_info", "params": []}' | jq -r '.result.pubkey'
   ```
   Full connect/verify flow (from a separate node or the browser wallet itself) is in
   the official guide this setup is adapted from:
   `nervosnetwork/fiber`'s `docs/fiber-node-wss.md` (pinned to tag `v0.9.0-rc6`,
   matching this project's pinned `nervos/fiber` image).

**Not yet verified against a real domain as of this writing** — the config above was
built and smoke-tested locally (self-signed cert, `DOMAIN=localhost`) but not against
real Let's Encrypt issuance or a live browser-wallet payment. Both are next steps once
a real domain is live.

## Demo storefront

`apps/demo-storefront` is a reference merchant app — a mock storefront selling one
digital product, deliberately built as a **genuinely separate app** from
`fibergate-core` (no shared code, no shared process). It integrates the same way any
third-party merchant would: it creates an invoice via `@fibergate/sdk` making a real
HTTP call to `POST /api/v1/invoices`, renders the `invoice_address` as a QR code, and
receives a real HMAC-signed webhook on `POST /api/webhook` when the invoice is paid —
verified with the SDK's own `verifyWebhookSignature()` — which pushes a live update to
the browser via Server-Sent Events (no polling loop).

Once an invoice is showing, there's also a **"Pay with browser wallet (experimental)"**
button — runs an actual Fiber node client-side via WASM (`@fiber-pay/react` /
`@nervosnetwork/fiber-js`) so you can test paying without a separate wallet/node. Added
specifically to speed up manual testing; it's not part of the "storefront integrates
like a real merchant" story the QR code demonstrates. Known gaps, not yet live-verified:
- The browser wallet can only reach P2P peers over `wss://` (browsers can't open raw
  TCP). `fiber-node` now has a WSS path available via `nginx` (see "Public HTTPS
  deploy" above) once a real `DOMAIN` is configured and `announced_addrs` is updated —
  the routing config exists but hasn't been exercised against a real domain or a real
  browser payment yet. See `decisions-log.md` 2026-07-08/2026-07-09 for the full
  reasoning.
- `@fiber-pay/react`'s documented compatibility target is Fiber `v0.9.0-rc4`;
  `fiber-node` here is pinned to `v0.9.0-rc6` — likely fine, not confirmed.

<!-- TODO: hosted demo URL, once a public instance is deployed -->

### Try it locally

1. Bring up `fibergate-core` normally — `pnpm docker:dev`, `pnpm --filter web
   db:migrate`, fill in root `.env` per "Generating secrets" above.
2. Register a webhook endpoint pointing at the demo storefront — `url:
   http://localhost:3001/api/webhook`, `events: ["payment.paid"]` — and note the secret
   you set for it. There's no dashboard UI for managing `webhook_endpoints` yet (the
   service layer exists, `apps/web/lib/services/webhooks.ts`, just no route/UI calling
   it), so do this however you're currently registering endpoints (e.g. the Dashboard,
   once that page exists, or a direct DB write).
3. Copy `apps/demo-storefront/.env.example` to `apps/demo-storefront/.env.local` and
   fill in `FIBERGATE_INTERNAL_SECRET` (same value as root `.env`) and
   `DEMO_WEBHOOK_SECRET` (the secret from step 2 — this app deliberately doesn't read
   the root `.env` file, see the comment in its `.env.example`).
4. Start both apps, each in its own terminal:
   ```bash
   pnpm dev                                 # fibergate-core, :3000
   pnpm --filter demo-storefront dev        # demo storefront, :3001
   ```
5. Open `http://localhost:3001`, click **Buy now**. A QR code appears for
   `invoice_address` — pay it from a Fiber testnet wallet with an open channel to this
   node (the same prerequisite as paying any FiberGate invoice; see
   `.context/glossary/fiber-terms.md` if you're setting one up for the first time). The
   page updates automatically the moment the webhook is verified — no refresh needed.

### Running it via Docker Compose

`apps/demo-storefront/docker-compose.demo.yml` is an **overlay**, not part of the
merchant-facing bundle — a plain `docker compose up -d` (root `docker-compose.yml`
alone) never starts `demo-storefront`. It reads its secrets from
`apps/demo-storefront/.env.local` (step 3 above — the same file `pnpm --filter
demo-storefront dev` uses), not from the root `.env`, so create that file first even if
you're skipping local dev and going straight to Docker. To bring up all 4 containers
together (your own public demo deploy, for example), from the repo root:

```bash
docker compose -f docker-compose.yml -f apps/demo-storefront/docker-compose.demo.yml up -d
```

## Pay a demo invoice with a second local node (fiber-node-payer)

Runs as a 4th service, `fiber-node-payer`, right in root `docker-compose.yml` —
**local-testing-only**, gated behind `profiles: [payer]` so a plain
`docker compose up -d` (the merchant-facing flow) never starts it; only
`docker compose up -d fiber-node-payer` / `pnpm docker:payer` does. It's a second
`nervos/fiber` node on the same `fibergate-net` network as `fiber-node` — lets you
actually pay a demo invoice by opening a direct channel between the two, entirely over
plain TCP inside that network. No TLS/WSS setup needed (that's only required for a
*browser-based* wallet — see `apps/demo-storefront/app/BrowserWalletPay.tsx`'s header
comment and `decisions-log.md` 2026-07-08 for why that path is parked for now).

This only needs `fiber-node` itself running — e.g. via `pnpm docker:dev` — it never
touches `postgres`/`fibergate-core`.

1. Generate a CKB testnet key for the payer — **separate** from `fiber-node`'s own key
   (this is a throwaway test wallet, not the merchant's identity):
   ```bash
   mkdir -p docker/fiber-node-payer/ckb
   ckb-cli account export --lock-arg <lock_arg> --extended-privkey-path ./exported-key
   head -n 1 ./exported-key > docker/fiber-node-payer/ckb/key
   rm ./exported-key
   chmod 600 docker/fiber-node-payer/ckb/key
   ```
   Set `FIBER_PAYER_SECRET_KEY_PASSWORD` in root `.env` to the passphrase you want to
   encrypt that key with (same convention as `FIBER_SECRET_KEY_PASSWORD` — a fresh
   password of your choice, not derived from anything).
2. Fund the payer's wallet via https://faucet.nervos.org — get its CKB address from
   `ckb-cli` (the same key/lock-arg from step 1 — already funded if you reused an
   existing dev account's key), fund with enough to cover a channel (recommend ~250
   CKB: the 99 CKB reserve + a modest funding amount + fees).
3. Start `fiber-node` if it isn't already running, then the payer:
   ```bash
   pnpm docker:dev    # postgres + fiber-node, if not already running
   pnpm docker:payer  # fiber-node-payer only — reads root .env, same as fiber-node
   docker compose ps  # wait for fiber-node-payer to report "healthy"
   ```
4. Get `fiber-node`'s pubkey, then convert it to the multiaddr `fiber-node-payer` needs
   for `connect_peer` (first contact with an unknown peer needs a full multiaddr, not
   just a pubkey — see `.context/glossary/fiber-terms.md`):
   ```bash
   curl -s -X POST http://localhost:8227 -H 'Content-Type: application/json' \
     --data '{"id":1,"jsonrpc":"2.0","method":"node_info","params":[]}' | jq -r '.result.pubkey'

   cd apps/demo-storefront
   pnpm payer:multiaddr <pubkey from above>
   # → /ip4/172.28.0.10/tcp/8228/p2p/<peer id>
   ```
5. Connect the payer to `fiber-node` and open a channel (both against the payer's own
   RPC, port `8237`):
   ```bash
   curl -s -X POST http://localhost:8237 -H 'Content-Type: application/json' \
     --data '{"id":1,"jsonrpc":"2.0","method":"connect_peer","params":[{"address":"<multiaddr from step 4>"}]}'

   curl -s -X POST http://localhost:8237 -H 'Content-Type: application/json' \
     --data '{"id":1,"jsonrpc":"2.0","method":"open_channel","params":[{"pubkey":"<fiber-node pubkey>","funding_amount":"0x4a817c800"}]}'
   # 0x4a817c800 = 200 CKB in shannons — must be >= fiber-node's own
   # open_channel_auto_accept_min_ckb_funding_amount (check via node_info on
   # :8227; defaults to 100 CKB = 0x2540be400) or the channel needs a manual
   # accept_channel from fiber-node's side. Adjust to taste, must also leave
   # room for the 99 CKB reserve.
   ```
   Poll until ready (no gossip-sync wait needed — this is a direct channel, not a
   multi-hop route):
   ```bash
   curl -s -X POST http://localhost:8237 -H 'Content-Type: application/json' \
     --data '{"id":1,"jsonrpc":"2.0","method":"list_channels","params":[{}]}' | jq '.result.channels[].state.state_name'
   # wait for "ChannelReady"
   ```
6. Pay the invoice — grab `invoice_address` from the demo storefront's QR/text, then:
   ```bash
   curl -s -X POST http://localhost:8237 -H 'Content-Type: application/json' \
     --data '{"id":1,"jsonrpc":"2.0","method":"send_payment","params":[{"invoice":"<invoice_address>"}]}'
   ```
   `fibergate-core`'s poller (10s cycle) picks up the `Paid` status, fires the webhook, and
   the demo storefront's page updates automatically via SSE.

**Troubleshooting** (see `decisions-log.md` 2026-07-09 for the full investigation of each):
- **`connect_peer` succeeds but the peer disappears from `list_peers` within ~1s, and
  `open_channel` fails with `"...waiting for peer to send Init message"`** — gossip
  backlog overflow, not a transient issue. Happens when `fiber-node` has accumulated a
  lot of real gossip data (e.g. from `bootnode_addrs` on a long-running node) and dumps
  it all on the freshly-connected payer at once. Already worked around in
  `docker/fiber-node-payer/config.yml` (`gossip_network_num_targeted_active_syncing_peers:
  0`, no `bootnode_addrs`) — if you still hit this, check `fiber-node`'s own
  `graph_channels` count via `node_info`/pagination.
- **`open_channel` returns a `temporary_channel_id`, but `fiber-node`'s logs show
  `"Failed to fund channel: ... need more capacity"`** — `fiber-node` itself needs its
  own 99 CKB channel reserve to *accept* a channel, not just the opener's funding
  amount. Fund `fiber-node`'s own address (derive it from `node_info`'s
  `default_funding_lock_script` the same way as `fiber-node-payer`'s, or see
  `decisions-log.md` for the exact `scriptToAddress` call) via the faucet.
- **Channel stuck at `AwaitingTxSignatures` with all 3 signature flags set** — normal;
  wait ~20-30s for the funding transaction to confirm on-chain, then re-poll
  `list_channels`. A tx hash showing `status: "unknown"` right after signing is expected,
  not a failure.

## Documentation

Start at [`.context/INDEX.md`](.context/INDEX.md) — single source of truth for
architecture, database schema, API spec, business rules, and decisions already confirmed
by the project owner.

## License

MIT.
