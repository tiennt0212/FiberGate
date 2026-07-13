# Getting started (contributor / local dev)

This is for people modifying FiberGate's code. If you're a merchant just running
it, see [`../merchants/quickstart.md`](../merchants/quickstart.md) instead.

Requires [pnpm](https://pnpm.io/) (this repo pins `pnpm@9.15.9` via `packageManager`)
and Node.js.

```bash
pnpm install                              # install all workspace packages
cp .env.example .env                      # shared secrets — see comments in the file
cp apps/web/.env.example apps/web/.env.local
# apps/web/.env.local only needs the values that differ from Docker (POSTGRES_HOST/
# PORT, FIBER_NODE_URL) — everything else comes from root .env
pnpm docker:dev                           # start only postgres + fiber-node (needs
                                           # FIBER_SECRET_KEY_PASSWORD/CKB key — see
                                           # "Generating a real .env" below)
pnpm dev                                  # run apps/web dev server against them
```

`pnpm dev` (via `apps/web`'s `dev` script) uses `dotenv-cli` to load root `.env` and
`apps/web/.env.local` together — no need to copy shared secrets into both files.

`pnpm docker:dev` starts just `postgres` and `fiber-node` (skips `fibergate-core`,
since that's the app you're running locally via `pnpm dev` instead). Stop them with
`pnpm docker:dev:down`.

## Generating a real `.env`

`postgres`/`fiber-node` refuse to start with blank required values in `.env`. There's
no dedicated generator for this path yet (see the roadmap in
[`../decisions-and-tradeoffs.md`](../decisions-and-tradeoffs.md)) — the quickest way
today is to scaffold a throwaway deploy just to get real generated values:

```bash
npx create-fibergate@latest tmp-fibergate   # answer its prompts, then discard the
                                             # directory — you only need the .env it wrote
```

Copy the values you need (`POSTGRES_PASSWORD`, `FIBERGATE_INTERNAL_SECRET`,
`WEBHOOK_SECRET_ENCRYPTION_KEY`, `DASHBOARD_SESSION_SECRET`,
`ADMIN_PASSWORD_HASH_B64`, `FIBER_SECRET_KEY_PASSWORD`) into this repo's root `.env`
— or reuse values from a deploy of your own you already have.

You also need a real CKB testnet signing key at `docker/fiber-node/ckb/key`,
encrypted with the passphrase you put in `FIBER_SECRET_KEY_PASSWORD` above:

```bash
mkdir -p docker/fiber-node/ckb
# must be RAW hex, no "0x" prefix, exactly 1 line (no chain code)
ckb-cli account export --lock-arg <lock_arg> --extended-privkey-path ./exported-key
head -n 1 ./exported-key > docker/fiber-node/ckb/key
rm ./exported-key
chmod 600 docker/fiber-node/ckb/key
```

`DOMAIN`/`CERTBOT_EMAIL` are only needed if you're also testing
[public HTTPS](../merchants/public-https-deploy.md) — not required for `pnpm
docker:dev` or `docker compose up -d` to work locally.

## Commands

```bash
pnpm install                    # install all packages
pnpm dev                        # run apps/web dev server
pnpm build                      # build all workspaces
pnpm lint                       # lint the whole workspace
pnpm --filter web typecheck     # TypeScript strict check for the web app
pnpm --filter web test:unit     # run apps/web's unit tests (Vitest)
pnpm --filter web test:integration  # run HTTP integration tests against a live
                                 # /api/v1/* (Bruno, requires the stack running)
pnpm --filter sdk build         # build only the sdk package
pnpm --filter sdk test:unit     # run the sdk package's unit tests
pnpm --filter web dev           # run only the web app
pnpm --filter web db:generate   # generate a Drizzle SQL migration from lib/db/schema.ts
pnpm --filter web db:migrate    # apply pending migrations to POSTGRES_* (run manually
                                 # if you're iterating on schema.ts outside Docker)
```

## Running the full stack from source

Brings up all 6 services — `postgres`, `fiber-node` (CKB testnet), `fibergate-core`
(dashboard + API), and `nginx`/`certbot`/`nginx-certs-preflight` — on one
internal-only Docker network, building `fibergate-core` from source
(`docker compose build`) rather than pulling a published image. Use this when
you're modifying FiberGate's code and need to test the real container build; use
`pnpm dev` above for faster iteration on `apps/web` alone.

```bash
docker compose build
docker compose up -d
docker compose ps   # wait for postgres, fiber-node, nginx-certs-preflight healthy
```

Same `.env`/CKB key/`DOMAIN` setup as above ("Generating a real `.env`") — just
against root `docker-compose.yml` instead of a scaffolded one.

`fibergate-core` runs pending DB migrations automatically before it starts serving —
no manual step needed here either, on first install or after pulling new migration
files.

Something failed? See [`../common/troubleshooting.md`](../common/troubleshooting.md).
