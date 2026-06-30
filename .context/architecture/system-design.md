---
type: architecture
version: 1.0
last_updated: 2026-06-30
tags: [nextjs, supabase, fiber-node, monorepo]
---

# System Design — FiberGate

## Tech Stack

| Layer | Technology | Lý do |
|-------|-----------|-------|
| Frontend + API | Next.js 14 App Router | Full-stack, deploy Vercel dễ |
| Database | Supabase (PostgreSQL) | Auth built-in, realtime, free tier |
| Styling | Tailwind CSS + Antd | Nhanh, đẹp, component ready |
| SDK package | TypeScript + tsup | Zero-config bundler, ESM+CJS |
| Fiber Node | FNN binary trên VPS | Railway hoặc Fly.io |
| Package manager | pnpm workspaces | Monorepo standard |

## Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────┐
│  Developer's App                                     │
│  import { FiberGate } from '@fibergate/sdk'          │
└──────────────────┬──────────────────────────────────┘
                   │ HTTPS (Bearer token)
┌──────────────────▼──────────────────────────────────┐
│  Next.js on Vercel                                   │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │  Dashboard UI   │  │  API Routes /api/v1/*    │  │
│  │  /dashboard     │  │  - POST /invoices        │  │
│  │  /keys          │  │  - GET  /invoices/:id    │  │
│  │  /webhooks      │  │  - GET  /node/info       │  │
│  │  /transactions  │  └──────────┬───────────────┘  │
│  └─────────────────┘             │                  │
└─────────────────────────────────┬┼──────────────────┘
                                  ││
              ┌───────────────────┘│
              │                   │
┌─────────────▼──┐    ┌───────────▼──────────────────┐
│  Supabase      │    │  Fiber Node (VPS)             │
│  PostgreSQL    │    │  FNN binary                   │
│  - users       │◄──►│  JSON-RPC :8227               │
│  - api_keys    │    │  P2P :8228                    │
│  - invoices    │    │  Connected to testnet         │
│  - webhooks    │    └──────────────────────────────┘
│  - ...         │
└────────────────┘
```

## Data Flow — Tạo Invoice

```
1. Developer POST /api/v1/invoices { amount, asset, description }
   với header Authorization: Bearer sk_xxx

2. API Route:
   a. Validate Bearer token → lookup api_keys table → lấy user_id
   b. Gọi Fiber Node RPC: new_invoice { amount_in_shannon, asset, description }
   c. Node trả về: { invoice_address, payment_hash }
   d. Lưu invoice vào Supabase: status = "pending"
   e. Trả về response cho developer

3. Background Poller (Vercel Cron mỗi 10s):
   a. Query invoices WHERE status = "pending" AND expires_at > now()
   b. Với mỗi invoice: gọi Fiber Node RPC get_invoice { payment_hash }
   c. Nếu status thay đổi → update Supabase
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
│   └── web/                    ← Next.js app
│       ├── app/
│       │   ├── (dashboard)/    ← Protected routes
│       │   │   ├── dashboard/
│       │   │   ├── keys/
│       │   │   ├── webhooks/
│       │   │   └── transactions/
│       │   ├── api/
│       │   │   └── v1/
│       │   │       ├── invoices/
│       │   │       └── node/
│       │   └── auth/           ← Supabase auth pages
│       ├── lib/
│       │   ├── supabase/       ← Supabase client + helpers
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
├── .context/                   ← Context files (file này)
├── .claude/
│   └── CLAUDE.md
├── pnpm-workspace.yaml
└── package.json
```

## Environment Variables

```bash
# apps/web/.env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # chỉ dùng server-side

FIBER_NODE_URL=                 # http://your-vps:8227
FIBER_NODE_SECRET=              # nếu node có biscuit auth

WEBHOOK_SIGNING_KEY=            # random secret để sign webhooks
CRON_SECRET=                    # để bảo vệ /api/cron endpoint
```
