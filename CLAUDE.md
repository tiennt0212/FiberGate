# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this project?

**FiberGate** — a self-hosted merchant payment gateway framework prototype for the Fiber Network hackathon (1–15 July 2026). Full description: see `README.md`.

> **Constraint for the agent**: Don't call this an "LSP framework" — it doesn't provide liquidity/channel-opening services on behalf of a third party. Single-tenant: each deployment serves exactly 1 merchant, with no multi-tenant API key/account system — this directly affects the auth pattern (see "Auth flow for API routes" in `apps/web/CLAUDE.md`: 1 shared secret, no lookup by user/client).

Read `.context/INDEX.md` first, then read in this order:

1. `.context/glossary/fiber-terms.md` — Terminology (important to avoid hallucination)
2. `.context/business-context/project-vision.md` — Vision, scope, hackathon constraints
3. `.context/architecture/system-design.md` — Architecture, data flow, tech stack, env vars
4. `.context/data-dictionary/database-schema.md` — PostgreSQL tables, columns, relations
5. `.context/api/rest-api-spec.md` — Full API spec (request/response/errors)
6. `.context/business-rules/payment-rules.md` — Business logic, rate limits, security rules
7. `.context/processes/decisions-log.md` — Decisions already settled by a human
8. `.context/processes/gotchas.md` — Infra/protocol gotchas that took real effort to find
9. `.context/processes/definition-of-done.md` — DoD and end-of-session checklist

## Monorepo layout

> The single canonical version — `README.md`/`.context/INDEX.md` only summarize/link back here.

```
apps/web/          — Next.js 14 App Router (fibergate-core: dashboard + API routes)
  app/(dashboard)/ — Protected routes (single-admin password gate): /dashboard, /webhooks, /transactions
  app/api/v1/      — REST API endpoints: /invoices, /node
  app/api/cron/    — Optional manual-trigger endpoint: /poll-invoices (primary source is the in-process interval worker)
  lib/db/          — Drizzle client + schema + helpers
  lib/fiber/       — Fiber JSON-RPC client (wraps FNN node calls)
  lib/services/    — Business logic route.ts delegates to (see "Service layer pattern" in apps/web/CLAUDE.md)
apps/demo-storefront/ — Reference merchant app (issue #12) — an app fully separate
  from apps/web, does NOT import shared code, only calls @fibergate/sdk over HTTP
  (FIBERGATE_BASE_URL/FIBERGATE_INTERNAL_SECRET) exactly like a real third-party
  merchant — demo QR checkout + receives real webhooks (POST /api/webhook, verified
  with the SDK's verifyWebhookSignature) pushing updates over Server-Sent Events.
  Has its own Dockerfile + docker-compose.demo.yml right in this directory (not in
  the root docker/ — fully self-contained). See docs/merchants/demo-storefront.md.
packages/sdk/      — npm package @fibergate/sdk (TypeScript, tsup)
packages/create-fibergate/ — npm package `create-fibergate` (issue #48):
                     `npx create-fibergate@latest` — interactive wizard
                     (@clack/prompts) scaffolding a merchant deploy directory
                     from docker-compose.release.yml, generating `.env`
                     (secrets via Node's crypto, admin password bcrypt-hashed
                     via bcryptjs) and placing the CKB testnet key, so a
                     merchant never hand-edits `.env` or generates secrets by
                     hand. Also validates a passphrase against an
                     already-encrypted key reused from a prior deploy
                     (offline, mirroring fnn's own scrypt+AES-256-GCM key
                     file format — see lib/ckb-key-crypto.ts) before writing
                     anything. `templates/` (gitignored) is auto-copied at
                     build time from docker-compose.release.yml,
                     docker/fiber-node/config.yml,
                     docker/nginx/nginx.conf.template, and
                     .env.release.example — see scripts/copy-templates.mjs —
                     so it can never drift from those files.
docker-compose.yml — Fiber node + PostgreSQL + fibergate-core + nginx/certbot (TLS/WSS
                     reverse proxy, issue #17 — see CKB/Fiber References below),
                     builds fibergate-core from source — used for contributor/dev, not
                     the recommended merchant deploy path (see the line below)
docker-compose.release.yml — issue #21 + #41: same 6 services as docker-compose.yml,
                     but fibergate-core uses image: ghcr.io/<GHCR_NAMESPACE>/
                     fibergate-core (published via .github/workflows/docker-publish.yml,
                     tagged by git commit SHA + latest) instead of build: — a merchant only
                     needs this file + .env, no need to clone the repo, see docs/merchants/deployment.md
.github/workflows/docker-publish.yml — builds + pushes fibergate-core to GHCR on every
                     push to canary (+ workflow_dispatch for manual triggering)
docker/            — docker/fibergate-core/Dockerfile, fiber-node config,
                     docker/nginx/nginx.conf.template (nginx + certbot service, TLS
                     for the fibergate-core dashboard/API + WSS for fiber-node P2P — does NOT
                     front apps/demo-storefront, see docs/merchants/public-https-deploy.md)
docs/              — Documentation for humans (not AI), split by audience —
                     see README.md's "Documentation" table to know which file is for whom:
                     docs/merchants/* (deploy/quickstart/demo-storefront), docs/maintainers/*
                     (local dev/release process), docs/common/troubleshooting.md (common
                     errors, shared), docs/decisions-and-tradeoffs.md (a narrative
                     write-up for judges/reviewers — doesn't replace .context/processes/
                     decisions-log.md, just an easier-to-read version of it)
CONTRIBUTING.md, CODE_OF_CONDUCT.md, MAINTAINER.md — contribution/release conventions, at
                     root per GitHub's auto-recognized convention
.context/          — Project context files (Single Source of Truth)
.context/design/   — Full UI mockup, committed directly to the repo (not just tokens anymore):
                     - FiberGate.dc.html — the real dashboard mockup (open directly in a browser)
                     - COMPONENTS.dc.html — an artboard catalog: every component pattern in DESIGN.md
                       rendered visually with captions mapping to the Antd v5 component + how to override it
                       (Card/Tag/Table/Button/Segmented/Progress/Alert/Badge/Modal/Menu...) — open in a
                       browser to look up which Antd component to use when coding UI, instead of guessing
                     - support.js — helper script for the mockup
                     - DESIGN.md — design tokens/type scale/component patterns (reference when coding UI)
                     Origin: Claude Design (project ID above), but due to sharing limits with
                     teammates, the copy in the repo is the one the whole team can actually use. The human
                     manually syncs it when there are changes on the Claude Design side — the copy in the
                     repo may lag behind the original, it doesn't mirror in real-time automatically.
```

## Project IDs

| Service | ID | Note |
|---------|-----|---------|
| Claude Design | `15b01139-c51f-472e-81df-e7c0777dd47d` | UI mockups |

## Commands

```bash
pnpm install                    # install all packages
pnpm dev                        # run the apps/web dev server
pnpm build                      # build everything
pnpm lint                       # lint everything
pnpm --filter web typecheck     # TypeScript strict check for the web app
pnpm --filter sdk build         # build only the sdk package
pnpm --filter create-fibergate build  # build the CLI (runs scripts/copy-templates.mjs before tsup)
pnpm --filter web dev           # run only the web app
pnpm docker:dev                 # run dev mode: only postgres + fiber-node (no fibergate-core)
pnpm docker:dev:down            # stop postgres + fiber-node in dev mode

docker compose up -d            # build + run fiber-node + postgres + fibergate-core
docker compose build             # rebuild the fibergate-core image after code changes
```

## Key architecture and patterns (apps/web)

See `apps/web/CLAUDE.md` — Auth flow for API routes, Service layer pattern, Database pattern, Fiber RPC calls, Poller and cron endpoint, Response format.

## Important rules

- **DO NOT** add dependencies without asking first
- **DO NOT** hardcode any secret or URL — use env vars (see the list in `.context/architecture/system-design.md`)
- **DO NOT** modify the database schema without updating `.context/data-dictionary/database-schema.md`
- The Drizzle schema must match `.context/data-dictionary/database-schema.md` — editing one requires syncing the other
- Every `/api/v1/*` API route must validate authentication **before** doing any other logic
- Error handling must be explicit — no empty `try/catch` blocks
- TypeScript strict mode throughout — no `any`
- When creating a git commit for multiple independent changes (multiple files/multiple different purposes in the same session), split them into multiple small commits per unit of change — **do not** lump everything into one big commit, even if the user only asks once to "commit this for me"
- When editing a file that has a public mirror on the VitePress site (see the "Public docs mirror" table in `.context/INDEX.md`), also check/update the corresponding `docs/*.md` page in the same edit — the two don't auto-sync

## Gotchas that took real effort to find

Full details + how they were verified: `.context/processes/gotchas.md`. Don't repeat these:

- `0.0.0.0` is treated as "public" by `fnn` even inside a private Docker network
- `.env` corrupts the `$` character (2 different ways, depending on the reader)
- `ckb-cli` key export produces the wrong format for what `fnn` needs
- `pubsub` is not in FNN's default `enabled_modules`
- `subscribe_store_changes`'s subscription id is a JSON number, not a string
- The RUSD/UDT cache can go stale-forever / hit a request-storm race
- An `expired` invoice can't be reversed even if the real payment later settles (issue #51)
- Docker Compose doesn't automatically forward the entire `.env` into the container — must be explicitly listed in the `environment:` block
- `env_file:` in an override compose file resolves its path relative to the project directory, not the directory containing the override file

## CKB/Fiber References

When you need information about the CKB protocol or Fiber Network, look it up in this order:

1. `.context/glossary/fiber-terms.md` — terminology already curated for this project
2. CKB AI MCP (already installed) — query directly in natural language
3. `https://docs.nervos.org/llms.txt` — general CKB docs
4. `https://www.fiber.world/docs` — official Fiber docs

**FiberGate only uses Fiber at the application layer (JSON-RPC calls). Do NOT write CKB Scripts. No need to understand the Cell Model unless debugging channel issues.**

### SDK/tooling — official vs community (per `fiber-hackathon-docs/resources.md`)

- **Official, used for the core (Phase 1/2):** `@ckb-ccc/fiber` (SDK for `lib/fiber/client.ts`), `fnn-cli` + `ckb-cli` (setup/bootstrap channels during dev, not a runtime dependency of the app).
- **Community, used only as a reference for Phase 3 (L402, optional stretch) — specific to `apps/web`:** `@fiber-pay/sdk` — see the reference demo [`fiber-l402`](https://github.com/RetricSu/fiber-l402) (Express + Astro + React, using this exact library to build L402 paywall middleware). **Do not use `@fiber-pay/react` in `apps/web`/`fibergate-core`.**
- **`apps/demo-storefront` (a fully separate app) does use the real `@fiber-pay/react` + `@nervosnetwork/fiber-js`** — the "Pay with browser wallet" button, running a Fiber node WASM right in the browser. See `apps/demo-storefront/app/BrowserWalletPay.tsx`, `docs/merchants/demo-storefront.md`. Reasoning/history: `decisions-log.md` 2026-07-08 (issue #12).
- **The Fiber WSS Config Manual** (`nervosnetwork/fiber/blob/v0.9.0-rc6/docs/fiber-node-wss.md`, pinned to the exact tag matching the image in use) — guide for exposing the node's P2P over `wss://` (Nginx+TLS) to a browser/WASM client. **Does not apply to `fibergate-core` itself**: it calls JSON-RPC on `fiber-node` over the docker internal network (plain HTTP), no TLS/WSS needed. `docker-compose.yml`'s `nginx` service implements this recipe (`stream{}` + `ssl_preread` on port `8228`, distinguishing regular raw TCP P2P from TLS/WSS browser traffic) — requires `DOMAIN` to be configured + a manual addition of `/dns4/<DOMAIN>/tcp/8228/wss` to `docker/fiber-node/config.yml`'s `announced_addrs`. **Not yet live-verified against a real domain/Let's Encrypt/real browser wallet** — only smoke-tested locally with a self-signed cert (`DOMAIN=localhost`). Architecture details: `system-design.md`'s "TLS/WSS reverse proxy (nginx + certbot)"; runbook: `docs/merchants/public-https-deploy.md`; history: `decisions-log.md` 2026-07-09 (issue #17).

## Principles for working with the AI Agent

### Ask before doing
When facing an unclear request or one with multiple possible approaches, Claude Code
**must NOT guess and implement on its own**. Instead:

1. State clearly which part is ambiguous
2. Ask specific clarifying questions
3. If needed, propose 2-3 options and ask which to choose
4. Only implement after receiving an answer

**Example situations that call for asking:**
- A feature request that doesn't specify edge cases
- Multiple possible implementations with different trade-offs
- Unclear scope: does "create a webhook" mean backend only, or UI too?
- Unclear error behavior: retry or fail immediately?

### Don't decide these on your own (stop and ask):
- Changing the database schema
- Changing the API response format (breaking change)
- Adding a new dependency
- Deleting existing code or files
- Any logic related to security, auth, signing, hashing
- Choosing an architecture when multiple approaches are viable

## When implementing a new feature

1. Read the relevant user story in `.context/user-stories/`
2. Read the relevant business rules in `.context/business-rules/`
3. Implement per the API spec in `.context/api/rest-api-spec.md`
4. If it's UI/dashboard work: cross-reference `.context/design/FiberGate.dc.html` (the real mockup, open in a browser),
   `.context/design/DESIGN.md` (tokens/component patterns), and `.context/design/COMPONENTS.dc.html`
   (which component in the mockup should be built with which Antd component + how to override it) — don't invent
   colors/spacing on your own, and don't rebuild a component Antd already provides
5. Update the context file if there's a design change
6. Before considering it done: cross-check `.context/processes/definition-of-done.md` — don't stop just because the code "looks done"
