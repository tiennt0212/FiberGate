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
apps/web/          — Next.js 14 App Router (fibergate-core: dashboard + API routes)
  app/(dashboard)/  — Protected routes (single-admin password gate): /dashboard, /webhooks, /transactions
  app/api/v1/       — REST API endpoints: /invoices, /node
  app/api/cron/     — Optional manual-trigger endpoint: /poll-invoices
  lib/db/           — Drizzle client + schema + helpers
  lib/fiber/        — Fiber JSON-RPC client (wraps FNN node calls)
packages/sdk/       — npm package @fibergate/sdk (TypeScript, tsup)
docker/             — docker/fibergate-core/Dockerfile, fiber-node config
.context/           — Project context files (single source of truth — read this before contributing)
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
pnpm --filter web dev           # run only the web app
```

## Running the full stack (Docker Compose)

Brings up all 3 services — `postgres`, `fiber-node` (CKB testnet), `fibergate-core`
(dashboard + API) — on one internal-only Docker network.

### Generating secrets

`.env.example` leaves 5 vars blank on purpose — they're required, no safe default
exists, and `docker compose up -d` will fail (postgres/fibergate-core/fiber-node
erroring on an empty credential) if you skip them:

```bash
# POSTGRES_PASSWORD, FIBERGATE_INTERNAL_SECRET, WEBHOOK_SIGNING_KEY — any random
# secret works, openssl is on virtually every machine that has Docker:
openssl rand -hex 32

# FIBER_SECRET_KEY_PASSWORD — same command works to generate a candidate value,
# but unlike the 3 above, it's NOT "generate once and forget": it must match the
# passphrase used to encrypt the CKB testnet key at docker/fiber-node/ckb/key
# (step 2 below). Already have an encrypted key? Use its existing passphrase
# here instead of generating a new one. Creating a new key? Generate the value
# above first, then use that exact value when encrypting it.

# ADMIN_PASSWORD_HASH — bcrypt hash of your dashboard login password. No local
# install needed, uses Docker you already have:
docker run --rm httpd:alpine htpasswd -nbBC 10 admin 'your-real-password'
# Copy only the hash part after the first ":" (starts with $2y$) into .env —
# but first double every "$" to "$$" (e.g. $2y$10$abc... -> $$2y$$10$$abc...).
# Docker Compose interpolates "$VAR" inside .env values too, so an unescaped
# bcrypt hash gets silently corrupted (you'll see a
# "The \"...\" variable is not set" warning and dashboard login will fail).
# Verify with: docker compose config | grep ADMIN_PASSWORD_HASH
```

**Prerequisites — do these before your first `docker compose up -d`:**

1. Copy the root env file and fill in real values (see "Generating secrets"
   above for all 5 required values):
   ```bash
   cp .env.example .env
   ```
2. Provide `fiber-node`'s own CKB testnet signing key — encrypted with the
   passphrase you put in `FIBER_SECRET_KEY_PASSWORD` in step 1 (this key is
   separate from the 7 app-level vars above — it belongs to the node, not to
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
3. Start the stack:
   ```bash
   docker compose up -d
   docker compose ps   # wait for postgres and fiber-node to report "healthy"
   ```

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
- **Dashboard login fails even with the right password** — check
  `docker compose config | grep ADMIN_PASSWORD_HASH`; if it looks truncated or
  different from what you generated, you likely pasted an unescaped bcrypt hash into
  `.env` (see "Generating secrets" above — every `$` must be doubled to `$$`).
- **`fibergate-core` never starts** — it has `depends_on: condition: service_healthy`
  on both `postgres` and `fiber-node`, so it intentionally won't start until both are
  healthy. Check `docker compose ps` to see which one isn't healthy yet, then check
  that service's logs.

## Documentation

Start at [`.context/INDEX.md`](.context/INDEX.md) — single source of truth for
architecture, database schema, API spec, business rules, and decisions already confirmed
by the project owner.

## License

MIT.
