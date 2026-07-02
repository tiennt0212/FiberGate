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
docker/             — Dockerfile for fibergate-core, fiber-node config
.context/           — Project context files (single source of truth — read this before contributing)
```

## Getting started (local dev)

Requires [pnpm](https://pnpm.io/) (this repo pins `pnpm@9.15.9` via `packageManager`) and Node.js.

```bash
pnpm install                              # install all workspace packages
cp apps/web/.env.example apps/web/.env.local
# fill in apps/web/.env.local with real values — see comments in the file
pnpm dev                                  # run apps/web dev server
```

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

Running the full stack with Docker Compose (Fiber node + PostgreSQL + fibergate-core) is
planned but not yet implemented — tracked as a separate issue, out of scope for the initial
monorepo bootstrap.

## Documentation

Start at [`.context/INDEX.md`](.context/INDEX.md) — single source of truth for
architecture, database schema, API spec, business rules, and decisions already confirmed
by the project owner.

## License

MIT.
