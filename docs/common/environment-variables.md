# Environment Variables

A plain-language reference for every `.env` var across the 4 deploy/dev paths in this
repo. If you just want to get running, `create-fibergate` generates all of these for
you — see [`../merchants/quickstart.md`](../merchants/quickstart.md). This page is for
when you want to know what a var does, whether it's required, or you're hand-editing
`.env` for full manual control (see
[`../merchants/deployment.md`](../merchants/deployment.md)).

> AI-facing canonical version (kept in sync with this page):
> [`.context/architecture/env-vars.md`](https://github.com/tiennt0212/FiberGate/blob/canary/.context/architecture/env-vars.md).

## Which file do I need?

| Your situation | File to copy |
|---|---|
| Recommended merchant deploy (`docker-compose.release.yml`, published image, no repo clone) | `.env.release.example` → `.env` |
| Full manual control / building the image yourself from a repo clone (`docker-compose.yml`) | `.env.example` (root) → `.env` |
| Contributing to `apps/web` and running `pnpm dev` outside Docker | `apps/web/.env.example` → `apps/web/.env.local` (on top of root `.env`) |
| Trying the reference storefront integration | `apps/demo-storefront/.env.example` → `.env.local` |

**Never commit any of the copied `.env`/`.env.local` files** — they're already
gitignored.

## Secrets used by every path (root `.env.example` / `.env.release.example`)

| Var | Required? | What it's for |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_DB` | Configurable (default `fibergate`) | Database name/user, shared by the `postgres` container and `fibergate-core`. |
| `POSTGRES_PASSWORD` | **Required** | Database password. No safe default — pick your own. |
| `FIBER_SECRET_KEY_PASSWORD` | **Required** | Unlocks your CKB testnet signing key file. Must match the passphrase you used when the key was encrypted, not a new password you invent. |
| `DOMAIN` | **Required** | Your public domain, DNS-pointed at this host, with ports 80/443/8228 reachable from the internet. Without it, nginx can't serve a usable HTTPS config. |
| `CERTBOT_EMAIL` | Optional | Only used for the one-time real-certificate step in [`public-https-deploy.md`](../merchants/public-https-deploy.md); safe to leave blank until then. |
| `ADMIN_PASSWORD_HASH_B64` | **Required** | Your dashboard login, base64-encoded. **Not** the raw bcrypt hash — see the login-troubleshooting note in [`troubleshooting.md`](troubleshooting.md) for why. `create-fibergate` generates this correctly for you. |
| `DASHBOARD_SESSION_SECRET` | **Required** | Signs your dashboard session cookie. Keep it different from `FIBERGATE_INTERNAL_SECRET` below — they serve different purposes. |
| `FIBERGATE_INTERNAL_SECRET` | **Required** | The API key your storefront/checkout app uses to call FiberGate's API. Whatever you set here, your storefront's own `.env` must match it exactly. |
| `WEBHOOK_SECRET_ENCRYPTION_KEY` | **Required** | Protects webhook secrets at rest. Generate with `openssl rand -hex 32`. |
| `CRON_SECRET` | Optional | Only needed if you plan to manually trigger the poll endpoint; safe to leave blank otherwise. |
| `FIBER_NODE_RPC_AUTH_TOKEN` | Optional | Not needed by default — your Fiber node has no public IP in this setup. |

**`.env.release.example` only** additionally needs:

| Var | Required? | What it's for |
|---|---|---|
| `GHCR_NAMESPACE` | **Required** | Whoever published the `fibergate-core` image (a GitHub username/org). |
| `FIBERGATE_CORE_TAG` | Optional | Pin to a specific build instead of the latest one. |

**Root `.env.example` only** (build-from-source path) additionally has:

| Var | Required? | What it's for |
|---|---|---|
| `FIBER_PAYER_SECRET_KEY_PASSWORD` | Only if you use the optional `fiber-node-payer` test helper | A second, throwaway test wallet for paying your own demo invoices locally. Not part of a normal deploy. |

## `apps/web/.env.local` — only if you're running `pnpm dev` outside Docker

Just 3 overrides on top of the root `.env` (everything else is shared):

| Var | Default | Why it's different here |
|---|---|---|
| `POSTGRES_HOST` | `localhost` | Docker Compose uses the internal name `postgres`; outside Docker you need `localhost`, which works because the `postgres` container publishes its port to `127.0.0.1`. |
| `POSTGRES_PORT` | `5432` | — |
| `FIBER_NODE_URL` | `http://localhost:8227` | The root `.env` value points at Docker's internal DNS name, which doesn't resolve outside the Docker network. |

## `apps/demo-storefront/.env.local` — the reference storefront app

This app is a standalone integration, same as any third-party merchant app would be —
it does not read `apps/web`'s vars or the root `.env` at all.

| Var | Required? | What it's for |
|---|---|---|
| `FIBERGATE_BASE_URL` | **Required** | Where your FiberGate deployment lives (no `/api/v1` suffix). |
| `FIBERGATE_INTERNAL_SECRET` | **Required** | Must be the exact same value you set for `fibergate-core` above. |
| `DEMO_WEBHOOK_SECRET` | **Required** | Must match the secret you used when registering this app's webhook endpoint. |

## Generating secrets

- **Merchant deploy**: `create-fibergate` generates every secret for you — see
  [`../merchants/quickstart.md`](../merchants/quickstart.md). You never run
  `openssl rand`/`htpasswd` by hand.
- **Contributor / from-source**: `pnpm generate:env` does the same thing for the root
  `.env` — see [`../maintainers/getting-started.md`](../maintainers/getting-started.md)'s
  "Generating a real `.env`".
