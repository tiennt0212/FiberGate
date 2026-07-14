---
type: business_context
version: 1.0
last_updated: 2026-06-30
tags: [vision, scope, hackathon, lsp]
---

# Project Vision — FiberGate

## Problem being solved

Today, to accept payments over Fiber Network, a developer has to:
1. Install and run a Fiber Node (FNN binary) themselves
2. Open channels with public nodes themselves (lock CKB on-chain)
3. Manage liquidity themselves
4. Call JSON-RPC themselves to create invoices and poll status

→ Barrier to entry is too high. No developer can integrate payments quickly.

## Solution

FiberGate is a **self-hosted, open-source Fiber payment gateway framework**:
- Merchants deploy it themselves with `docker compose up -d` (Fiber node + PostgreSQL + FiberGate core), and run their own node and data
- Call `POST /api/v1/invoices` (internal, same docker network or via a shared secret) → get an invoice immediately
- Receive a webhook notification when a payment succeeds
- No need to write your own Fiber RPC integration code, manage an invoice state machine, or build webhook delivery from scratch — FiberGate packages that infrastructure for you

**Why self-hosted framing instead of managed SaaS:** The "Gone in 60ms" hackathon rules require "infrastructure only, not products built on top" (product/commercial projects have their own separate hackathon later). A custodial, multi-customer SaaS platform would likely be classified as a "product built on top." Packaging this as an open-source framework anyone can self-deploy fits squarely into the **"Merchant, Liquidity, LSP, and Multi-Asset Infrastructure"** category.

## Hackathon Scope (prototype)

**IN SCOPE — Phase 1 (core, highest priority):**
- Docker-compose bundle: Fiber node (FNN binary) + PostgreSQL + FiberGate core (Next.js: dashboard + API)
- Personal dashboard (single-admin, not multi-tenant): view invoices/transactions, configure webhooks, view node status
- REST API: create invoice, query status, list invoices
- Webhook system: fire events when invoice paid/expired (HMAC-signed)
- npm SDK: `@fibergate/sdk` with TypeScript support
- A single Fiber node on testnet
- **Demo merchant checkout flow**: a simulated storefront page (e.g. selling a course/API key) that uses the SDK/API to create an invoice, show a QR code, and receive a webhook once payment completes (no mockup in Claude Design yet — needs to be designed/coded directly during implementation)
- **1 publicly deployed demo instance** (team VPS/cloud) for judges to try directly — required by the hackathon deliverables ("demo link... plus a hosted demo"), in addition to docker-compose instructions for people who want to self-deploy. While building this, consider also adding TLS/WSS for `fiber-node` — see `decisions-log.md` 2026-07-08 ("Insight noted for the future") for the reasoning (serves both judges making real payments and the "Pay with browser wallet" button already built into `apps/demo-storefront`). Also at this point: the current root `docker-compose.yml` (using `build:` from source) is expected to become a dev/contributor-only file — real merchants will use a prebuilt `fibergate-core` image + a separate, minimal `docker-compose.yml` (no need to clone the repo) — see `decisions-log.md` 2026-07-08 ("Merge `fiber-node-payer` back in..."). Not yet implemented, just an agreed direction.
- **Receipts**: view/download a summary of a `paid` invoice (amount, asset, payment_hash, timestamp) — uses data already in the `invoices` table, no new table needed
- **Accounting export**: a CSV export button for the invoice list on the transactions page, filterable by date range/status — uses existing data
- **Settlement view**: a dashboard tab combining `paid` invoices with their related `webhook_deliveries` history (effectively the settlement record) — no new table needed, just another view over existing data

**IN SCOPE — Phase 2 (after Phase 1 stabilizes):**
- Replace in-process polling with real-time Fiber node event subscriptions (JSON-RPC/WebSocket)

**IN SCOPE — Phase 3 (optional stretch, if time allows):**
- L402 subscription middleware (pay-as-you-go API / gated content)

**OUT OF SCOPE (documented as future work):**
- Managed/hosted offering by the FiberGate team (already pivoted away from this direction)
- Multi-tenant accounts / multiple merchants on the same deployment
- Mainnet deployment
- Multi-node / high availability
- On/off ramp
- Automatic channel rebalancing (manual only)
- **Refunds**: Fiber (like Lightning) is push-payment — there's no automatic "pull money back" mechanism like a credit card. To refund, a merchant would have to send a brand-new payment back to the payer, which requires the payer to proactively supply a refund address/invoice up front, consumes real liquidity, and needs its own table + `send_payment` flow. The complexity isn't proportional to the hackathon timeframe, so it's deferred to future work.
- Reconciliation report (cross-checking `invoices` against `node_snapshots`) — valuable but not critical to the core flow; consider adding later if Phase 1-3 finish early.

## Accepted trade-offs (must be clearly documented in the submission)

**The node still holds funds in the channel:** This is inherent to any LSP/node operator (not a risk unique to FiberGate) — but because it's self-hosted, the node key and funds belong to the merchant operating it, not held custodially by a third party (the FiberGate team) as in the earlier SaaS model.

**Single node:** Only one node on testnet. Single point of failure.

**Settlement delay:** Money in a channel isn't on-chain money yet. A merchant sees "paid" but it's really a credit within the channel.

## Target users

- Merchants/developers who want to self-host a Fiber payment gateway for their app (Next.js, React, Node.js)
- Hackathon participants who want to demo Fiber payments without writing their own RPC/webhook code from scratch
- Operators who want to receive CKB/RUSD testnet payments on infrastructure they control themselves

## Comparison with fiber-checkout

| | fiber-checkout | FiberGate |
|---|---|---|
| Does the developer need to run a node? | Yes | Yes (bundled in docker-compose) |
| Does the developer need to manage liquidity? | Yes | Yes, but with dashboard support for monitoring |
| Bundled dashboard + webhook + invoice API? | No | Yes |
| Custodial? | No (self-custody) | No (self-hosted, self-custody) |