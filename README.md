# FiberGate

Self-hosted, open-source merchant payment gateway framework prototype for the
[Fiber Network](https://www.fiber.world/) (CKB blockchain), built for the
**"Gone in 60ms: Fiber Network Infrastructure Hackathon"** (1–15 July 2026),
category *Merchant, Liquidity, LSP, and Multi-Asset Infrastructure*.

A merchant deploys FiberGate on their own infrastructure (`docker compose up -d` —
Fiber node + PostgreSQL + FiberGate core), then calls a REST API to create invoices
and receive payments — without writing Fiber RPC integration, an invoice state
machine, or webhook delivery from scratch. Single-tenant: each deployment serves one
merchant.

> Not an LSP — FiberGate does not provide liquidity or open channels on behalf of a
> third party. See `.context/glossary/fiber-terms.md` for terminology and
> `.context/business-context/project-vision.md` for full scope.

## Quickstart

```bash
npx create-fibergate@latest fibergate-deploy
cd fibergate-deploy
docker compose up -d
```

→ **[docs/merchants/quickstart.md](docs/merchants/quickstart.md)** for what this
does and what to do next (creating your first invoice, registering a webhook).

## Documentation

Browse online: **https://tiennt0212.github.io/FiberGate/**

| For... | Start here |
|---|---|
| **Merchants** deploying FiberGate | [docs/merchants/quickstart.md](docs/merchants/quickstart.md) |
| ...wanting full manual control, or no Node.js on the deploy host | [docs/merchants/deployment.md](docs/merchants/deployment.md) |
| ...wanting a public HTTPS domain | [docs/merchants/public-https-deploy.md](docs/merchants/public-https-deploy.md) |
| ...trying the reference integration example | [docs/merchants/demo-storefront.md](docs/merchants/demo-storefront.md) |
| **Contributors** setting up local dev | [docs/maintainers/getting-started.md](docs/maintainers/getting-started.md) |
| ...testing a payment locally without a real wallet | [docs/maintainers/local-testing.md](docs/maintainers/local-testing.md) |
| **Maintainers** publishing a release | [docs/maintainers/release-process.md](docs/maintainers/release-process.md) |
| Anyone hitting an error | [docs/common/troubleshooting.md](docs/common/troubleshooting.md) |
| Anyone wondering what an env var does | [docs/common/environment-variables.md](docs/common/environment-variables.md) |
| Judges/reviewers — decisions, trade-offs, roadmap | [docs/decisions-and-tradeoffs.md](docs/decisions-and-tradeoffs.md) |
| Full architecture, API spec, schema, business rules | [.context/INDEX.md](.context/INDEX.md) |

See also [CONTRIBUTING.md](CONTRIBUTING.md), [MAINTAINER.md](MAINTAINER.md), and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Monorepo layout

```
apps/web/               — Next.js 14 App Router (fibergate-core: dashboard + API routes)
  app/(dashboard)/      — Protected routes (single-admin password gate): overview, invoices,
                          webhooks, channels, peers, activity, settings
  app/api/v1/           — REST API endpoints: /invoices, /node
  app/api/cron/         — Optional manual-trigger endpoint: /poll-invoices
  lib/db/               — Drizzle client + schema + helpers
  lib/fiber/            — Fiber JSON-RPC client (wraps FNN node calls)
  lib/poller/           — real-time WebSocket listener + interval-poll fallback
apps/demo-storefront/   — Reference merchant app (see docs/merchants/demo-storefront.md) — a
                          genuinely separate consumer of @fibergate/sdk, no shared
                          code with apps/web
packages/sdk/           — npm package @fibergate/sdk (TypeScript, tsup)
packages/create-fibergate/ — npm package `create-fibergate` — scaffolding CLI (see
                          docs/merchants/quickstart.md)
docker/                 — docker/fibergate-core/Dockerfile, fiber-node config,
                          docker/nginx/nginx.conf.template (TLS/WSS reverse proxy)
docs/                   — split developer/merchant/maintainer documentation (this table)
.context/               — Project context files (single source of truth for architecture,
                          schema, API spec, business rules, and confirmed decisions —
                          read this before contributing)
```

## License

MIT.
