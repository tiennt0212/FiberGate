# FiberGate

**Accept Fiber Network payments from your own server** — a dashboard, REST API, SDK, and webhooks you
host yourself, on infrastructure you own.

[![@fibergate/sdk on npm](https://img.shields.io/npm/v/@fibergate/sdk?label=%40fibergate%2Fsdk&color=cb3837&logo=npm)](https://www.npmjs.com/package/@fibergate/sdk)
[![create-fibergate on npm](https://img.shields.io/npm/v/create-fibergate?label=create-fibergate&color=cb3837&logo=npm)](https://www.npmjs.com/package/create-fibergate)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-online-2ea44f)](https://tiennt0212.github.io/FiberGate/)

FiberGate is a self-hosted merchant payment gateway for the [Fiber Network](https://www.fiber.world/)
(CKB blockchain). It's an open-source prototype built for the
**"Gone in 60ms: Fiber Network Infrastructure Hackathon"** (1–15 July 2026), in the *Merchant,
Liquidity, LSP, and Multi-Asset Infrastructure* category.

> 🖼️ `<TODO>` — *The FiberGate dashboard (hero screenshot for the repo landing page).*

## Why FiberGate

Accepting Fiber payments the hard way means running a node, managing channel liquidity, hand-writing
JSON-RPC calls, building your own invoice state machine, and delivering signed webhooks — all
yourself. FiberGate collapses that into a few commands and one REST API. You bring a node key and a
domain; it handles the rest.

What you get:

- **Deploy in three commands** — one `docker compose up -d` brings up your Fiber node, PostgreSQL, and
  the gateway together.
- **A dashboard** — log in with one password to watch invoices, channels, peers, node health, and
  webhook deliveries.
- **A REST API + TypeScript SDK** — create and look up invoices from your storefront in a few lines.
- **Webhooks with real-time detection** — get a signed notification within seconds of a payment
  settling, over a live subscription to your node (not slow polling).

Single-tenant by design: each deployment serves exactly one merchant — you — with no hosted
middleman holding your funds.

> **Not an LSP.** FiberGate doesn't open channels or provide liquidity on anyone's behalf; it sits on
> top of a node you already run and fund. See [What is FiberGate?](docs/introduction.md) for the full
> picture and [Glossary](docs/glossary.md) for terminology.

## Quickstart

```bash
npx create-fibergate@latest fibergate-deploy
cd fibergate-deploy
docker compose up -d
```

Then open the dashboard and log in. The [Merchant walkthrough](docs/merchants/walkthrough.md) takes
you from here to your first live payment; the [Quickstart](docs/merchants/quickstart.md) explains what
each step does.

## Documentation

Browse the full docs online: **https://tiennt0212.github.io/FiberGate/**

| For... | Start here |
|---|---|
| **New to FiberGate** — what it is and how it works | [docs/introduction.md](docs/introduction.md) |
| **Merchants** deploying FiberGate | [docs/merchants/quickstart.md](docs/merchants/quickstart.md) |
| ...wanting the full journey — deploy, dashboard tour, first live payment | [docs/merchants/walkthrough.md](docs/merchants/walkthrough.md) |
| ...wanting full manual control, or no Node.js on the deploy host | [docs/merchants/deployment.md](docs/merchants/deployment.md) |
| ...wanting a public HTTPS domain | [docs/merchants/public-https-deploy.md](docs/merchants/public-https-deploy.md) |
| ...trying the reference integration example | [docs/merchants/demo-storefront.md](docs/merchants/demo-storefront.md) |
| **Contributors** setting up local dev | [docs/maintainers/getting-started.md](docs/maintainers/getting-started.md) |
| ...testing a payment locally without a real wallet | [docs/maintainers/local-testing.md](docs/maintainers/local-testing.md) |
| **Maintainers** publishing a release | [docs/maintainers/release-process.md](docs/maintainers/release-process.md) |
| Anyone hitting an error | [docs/common/troubleshooting.md](docs/common/troubleshooting.md) |
| Anyone wondering what an env var does | [docs/common/environment-variables.md](docs/common/environment-variables.md) |
| Judges/reviewers — decisions and trade-offs | [docs/decisions-and-tradeoffs.md](docs/decisions-and-tradeoffs.md) |
| Where FiberGate goes next — roadmap | [docs/roadmap.md](docs/roadmap.md) |
| Full architecture, API spec, schema, business rules | [.context/INDEX.md](.context/INDEX.md) |

See also [CONTRIBUTING.md](CONTRIBUTING.md), [MAINTAINER.md](MAINTAINER.md), and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Repository layout

For contributors — the pieces that make up the monorepo:

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

MIT — see [LICENSE](LICENSE).
