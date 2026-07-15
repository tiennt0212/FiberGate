---
type: index
version: 1.0
last_updated: 2026-07-14
---

# FiberGate — Context Index

This is the Single Source of Truth for the whole project. Claude Code should read this file first.

## What is this project?

**FiberGate** is a self-hosted, open-source merchant payment gateway framework for Fiber Network (CKB blockchain). Merchants deploy it themselves with `docker compose up -d` (Fiber node + PostgreSQL + FiberGate core) on their own infrastructure, then call the internal REST API to create invoices and receive payments — without having to write their own Fiber RPC integration code, manage an invoice state machine, or build webhook delivery from scratch.

> Naming note: don't call this an "LSP framework" — FiberGate doesn't provide liquidity/channel-opening services on behalf of a third party (the proper meaning of Lightning Service Provider). This is a merchant payment gateway, matching the "Merchant checkout SDKs, payment processor prototypes... payment status webhooks" example in the hackathon's category 3.

The project is built for the **Gone in 60ms: Fiber Network Infrastructure Hackathon** (1–15 July 2026), category: Merchant, Liquidity, LSP, and Multi-Asset Infrastructure.

## Context tree

| File | Content |
|------|------|
| `glossary/fiber-terms.md` | Fiber Network, CKB, payment channel terminology |
| `business-context/project-vision.md` | Vision, scope, trade-offs, hackathon constraints |
| `architecture/system-design.md` | System architecture, data flow, tech stack |
| `data-dictionary/database-schema.md` | All PostgreSQL tables, columns, relations |
| `api/rest-api-spec.md` | Full REST API spec (request/response/errors) |
| `business-rules/payment-rules.md` | Invoice, webhook, rate-limiting logic |
| `guides/webhook-signature.md` | Explains HMAC-SHA256 and how to verify webhook signatures |
| `user-stories/developer-flows.md` | User stories from an integrating developer's perspective |
| `processes/decisions-log.md` | Architecture and business decisions already settled by a human |
| `processes/gotchas.md` | Infra/protocol gotchas that took real effort to track down (read before touching Fiber RPC/Docker networking/`.env`) |
| `processes/definition-of-done.md` | DoD and self-verify checklist for the end of each AI coding session |
| `design/DESIGN.md`, `design/FiberGate.dc.html`, `design/COMPONENTS.dc.html`, `design/CLAUDE.md` | Design tokens/type scale/component patterns + full UI mockup (open in a browser) |

## Monorepo layout

See `CLAUDE.md`'s "Monorepo layout" — the canonical, most complete version; avoid keeping a duplicate tree in multiple places.

## Public docs mirror

The following files have a translated/adapted English version on the VitePress site
(https://tiennt0212.github.io/FiberGate/) — if you edit one side, check the other side
in the same edit; the two don't auto-sync:

| `.context/` source | Mirrored to (VitePress) |
|---|---|
| `api/rest-api-spec.md` | `docs/api-reference.md` |
| `architecture/system-design.md` (diagram section) | `docs/architecture.md` |
| `business-rules/payment-rules.md` (state diagram) | `docs/architecture.md` |
| `glossary/fiber-terms.md` | `docs/glossary.md` |

## Code conventions

- TypeScript strict mode throughout
- Function names: camelCase. Type/interface names: PascalCase
- API responses always follow the format: `{ data, error, meta }`
- Every database query (Drizzle) must have explicit error handling
- Never hardcode secrets — use environment variables