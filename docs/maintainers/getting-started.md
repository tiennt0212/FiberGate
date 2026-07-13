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
                                           # "Prerequisites" in
                                           # ../merchants/deployment.md)
pnpm dev                                  # run apps/web dev server against them
```

`pnpm dev` (via `apps/web`'s `dev` script) uses `dotenv-cli` to load root `.env` and
`apps/web/.env.local` together — no need to copy shared secrets into both files.

`pnpm docker:dev` starts just `postgres` and `fiber-node` (skips `fibergate-core`,
since that's the app you're running locally via `pnpm dev` instead). Stop them with
`pnpm docker:dev:down`.

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

Secrets/prerequisites (`.env`, the CKB key, `DOMAIN`) are the same as a manual
merchant deploy — see [`../merchants/deployment.md`](../merchants/deployment.md)'s
"Generating secrets" and "Prerequisites" sections; they apply here too, just against
root `docker-compose.yml` instead of `docker-compose.release.yml`.

`fibergate-core` runs pending DB migrations automatically before it starts serving —
no manual step needed here either, on first install or after pulling new migration
files.

Something failed? See [`../common/troubleshooting.md`](../common/troubleshooting.md).
