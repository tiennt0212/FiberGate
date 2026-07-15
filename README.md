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

| I want to… | Read |
|---|---|
| Understand what FiberGate is and how it works | [What is FiberGate?](docs/introduction.md) |
| Deploy it as a merchant, fast | [Quickstart](docs/merchants/quickstart.md) |
| Follow the full journey — deploy → dashboard → first live payment | [Merchant walkthrough](docs/merchants/walkthrough.md) |
| Take full manual control, or deploy with no Node.js on the host | [Manual / advanced deployment](docs/merchants/deployment.md) |
| Put it behind a public HTTPS domain | [Public HTTPS deploy](docs/merchants/public-https-deploy.md) |
| See a real merchant integration example | [Demo storefront](docs/merchants/demo-storefront.md) |
| Set up local dev as a contributor | [Getting started](docs/maintainers/getting-started.md) |
| Test a payment locally without a real wallet | [Local payment testing](docs/maintainers/local-testing.md) |
| Publish a release | [Release process](docs/maintainers/release-process.md) |
| Fix an error I'm hitting | [Troubleshooting](docs/common/troubleshooting.md) |
| Look up what an environment variable does | [Environment variables](docs/common/environment-variables.md) |
| Understand the design decisions (judges & reviewers) | [Decisions & trade-offs](docs/decisions-and-tradeoffs.md) |
| See where FiberGate goes next | [Roadmap](docs/roadmap.md) |
| Dig into architecture, API spec, schema, and business rules | [Project context](.context/INDEX.md) |

See also [CONTRIBUTING.md](CONTRIBUTING.md), [MAINTAINER.md](MAINTAINER.md), and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Repository layout

A quick map of the monorepo for contributors.

**Apps**

| Path | What it is |
|---|---|
| `apps/web/` | **fibergate-core** — the gateway itself: the Next.js dashboard + REST API |
| `apps/demo-storefront/` | A reference merchant integration — a separate app that consumes `@fibergate/sdk`, sharing no code with `apps/web` |

**Packages** — published to npm

| Path | What it is |
|---|---|
| `packages/sdk/` | `@fibergate/sdk` — the TypeScript client |
| `packages/create-fibergate/` | `create-fibergate` — the scaffolding CLI behind the quickstart |

**Infrastructure & docs**

| Path | What it is |
|---|---|
| `docker/` | Dockerfiles, the fiber-node config, and the nginx TLS/WSS reverse proxy |
| `docs/` | The documentation site — what the table above links into |
| `.context/` | Single source of truth for contributors: architecture, schema, API spec, business rules, and settled decisions |

Inside `apps/web/` (the gateway core):

- `app/(dashboard)/` — the dashboard pages (overview, invoices, webhooks, channels, peers, activity, settings), behind a single-admin password gate
- `app/api/v1/` — the public REST API (`/invoices`, `/node`)
- `lib/fiber/` — the Fiber JSON-RPC client
- `lib/poller/` — the real-time WebSocket listener, with an interval poller as fallback
- `lib/db/` — the Drizzle schema and query helpers

## License

MIT — see [LICENSE](LICENSE).
