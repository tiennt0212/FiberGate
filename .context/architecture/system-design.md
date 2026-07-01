---
type: architecture
version: 1.0
last_updated: 2026-06-30
tags: [nextjs, postgresql, docker-compose, fiber-node, monorepo, self-hosted]
---

# System Design — FiberGate

## Tech Stack

| Layer | Technology | Lý do |
|-------|-----------|-------|
| Frontend + API | Next.js 14 App Router | Full-stack, chạy như 1 container dài hạn (không serverless) |
| Database | PostgreSQL (container riêng) + Drizzle ORM | Nhẹ, không cần Auth/Realtime/Storage/Kong như Supabase self-hosted — khớp mục tiêu docker-compose gọn |
| Styling | Tailwind CSS + Antd | Nhanh, đẹp, component ready |
| SDK package | TypeScript + tsup | Zero-config bundler, ESM+CJS |
| Fiber Node | FNN binary | Container riêng trong cùng docker-compose |
| Hosting | Docker Compose | Merchant tự deploy trên VPS của họ (`docker compose up -d`) |
| Package manager | pnpm workspaces | Monorepo standard |

## Kiến trúc tổng thể

```
┌────────────────────────────────────────────────────────────────┐
│                Docker Compose (VPS của merchant)                │
│                                                                  │
│  ┌───────────────────┐  Bearer FIBERGATE_INTERNAL_SECRET        │
│  │ Merchant's         │─────────────────┐                       │
│  │ storefront app     │                 │                       │
│  │ (ngoài compose hoặc│                 ▼                       │
│  │ cùng docker network)│  ┌──────────────────────────────────┐  │
│  └───────────────────┘  │  fibergate-core (Next.js)         │  │
│                          │  ┌────────────┐ ┌────────────────┐│  │
│                          │  │ Dashboard  │ │ API /api/v1/*  ││  │
│                          │  │(admin gate)│ │ - POST /invoices││  │
│                          │  │            │ │ - GET /invoices/:id││
│                          │  │            │ │ - GET /node/info││  │
│                          │  └────────────┘ └───────┬────────┘│  │
│                          └──────────┬───────────────┼─────────┘  │
│                                     │               │            │
│                          ┌──────────▼──┐  ┌─────────▼─────────┐ │
│                          │ PostgreSQL  │  │  Fiber Node        │ │
│                          │ - invoices  │◄─┤  FNN binary        │ │
│                          │ - webhook_* │  │  JSON-RPC :8227    │ │
│                          │ - node_snapshots│ P2P :8228         │ │
│                          └─────────────┘  │  Connected testnet │ │
│                                            └────────────────────┘│
│                    (mọi giao tiếp qua docker internal network)   │
└────────────────────────────────────────────────────────────────┘
```

## Data Flow — Tạo Invoice

```
1. Storefront app POST /api/v1/invoices { amount, asset, description }
   với header Authorization: Bearer <FIBERGATE_INTERNAL_SECRET>

2. API Route:
   a. Validate Bearer token → so sánh constant-time với FIBERGATE_INTERNAL_SECRET (env var) — không lookup user, single-tenant
   b. Gọi Fiber Node RPC: new_invoice { amount_in_shannon, asset, description }
   c. Node trả về: { invoice_address, payment_hash }
   d. Lưu invoice vào PostgreSQL: status = "pending"
   e. Trả về response cho storefront app

3. Background Poller — Phase 1: in-process interval worker chạy trong container fibergate-core mỗi 10s
   (Phase 2 sẽ thay bằng Fiber node event subscription real-time qua JSON-RPC/WebSocket —
   cần verify khả năng subscribe của FNN trước khi implement):
   a. Query invoices WHERE status = "pending" AND expires_at > now()
   b. Với mỗi invoice: gọi Fiber Node RPC get_invoice { payment_hash }
   c. Nếu status thay đổi → update PostgreSQL
   d. Nếu status = "paid" → fire webhook đến merchant endpoint
```

## Data Flow — Webhook Delivery

```
1. Invoice status → "paid"
2. Query webhook_endpoints WHERE user_id = ? AND "payment.paid" IN events
3. Với mỗi endpoint:
   a. Build payload: { event: "payment.paid", invoice: {...} }
   b. Sign payload: HMAC-SHA256(payload, webhook_secret)
   c. POST đến merchant URL với header X-Fiber-Signature: sha256=xxx
   d. Lưu delivery record (attempt, status, response)
   e. Nếu fail → retry với exponential backoff (tối đa 3 lần)
```

## Monorepo Structure

```
fibergate/
├── apps/
│   └── web/                    ← Next.js app (fibergate-core)
│       ├── app/
│       │   ├── (dashboard)/    ← Protected routes (single-admin password gate)
│       │   │   ├── dashboard/
│       │   │   ├── webhooks/
│       │   │   └── transactions/
│       │   ├── api/
│       │   │   ├── v1/
│       │   │   │   ├── invoices/
│       │   │   │   └── node/
│       │   │   └── cron/       ← Optional: manual-trigger poll endpoint (không phải nguồn chính)
│       │   └── login/          ← Single-admin password gate
│       ├── lib/
│       │   ├── db/             ← Drizzle client + schema + helpers
│       │   └── fiber/          ← Fiber RPC client
│       └── components/
├── packages/
│   └── sdk/                    ← @fibergate/sdk
│       ├── src/
│       │   ├── index.ts
│       │   ├── client.ts
│       │   ├── types.ts
│       │   └── webhooks.ts
│       └── package.json
├── docker/                     ← Dockerfile cho fibergate-core, config fiber-node
├── docker-compose.yml          ← Fiber node + PostgreSQL + fibergate-core
├── .context/                   ← Context files (file này)
├── .claude/
│   └── CLAUDE.md
├── pnpm-workspace.yaml
└── package.json
```

## Environment Variables

```bash
# apps/web/.env.local
DATABASE_URL=                    # postgres://user:pass@postgres:5432/fibergate
ADMIN_PASSWORD_HASH=             # bcrypt hash, dùng cho dashboard single-admin login
FIBERGATE_INTERNAL_SECRET=       # shared secret, storefront app dùng để gọi /api/v1/*

FIBER_NODE_URL=                  # http://fiber-node:8227 (docker internal network)
FIBER_NODE_SECRET=               # nếu node có biscuit auth

WEBHOOK_SIGNING_KEY=             # per-endpoint, random secret để sign webhooks
CRON_SECRET=                     # optional, bảo vệ /api/cron endpoint (manual trigger)
```
