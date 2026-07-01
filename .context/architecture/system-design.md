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
| Fiber client library | `@ckb-ccc/fiber` (official SDK) | Dùng trong `lib/fiber/client.ts` để gọi RPC tới fiber-node — "best starting point for app integrations" theo tài liệu hackathon; không dùng `@fiber-pay/sdk` (community) cho core flow |
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

3. Background Poller — Phase 1: in-process interval worker chạy trong container fibergate-core mỗi 10s:
   a. Query invoices WHERE status = "pending" AND expires_at > now()
   b. Với mỗi invoice: gọi Fiber Node RPC get_invoice { payment_hash }
   c. Nếu status thay đổi → update PostgreSQL
   d. Nếu status = "paid" → fire webhook đến merchant endpoint

3'. Background Listener — Phase 2 (thay Background Poller ở trên, đã verify khả thi — xem chi tiết ở
    "Phase 2 — Real-time Invoice Listener" bên dưới): fibergate-core mở 1 WebSocket client riêng
    (không dùng @ckb-ccc/fiber cho phần này) subscribe `subscribe_store_changes`, xử lý mỗi
    notification `store_changes` tương tự bước a-d ở trên nhưng theo event thay vì theo chu kỳ.
    Vẫn giữ interval poll tần suất thấp (30-60s) làm fallback an toàn.
```

## Phase 2 — Real-time Invoice Listener (đã verify với source code FNN, xem `decisions-log.md`)

**Cơ chế:** FNN có sẵn RPC module `pubsub`, method `subscribe_store_changes` (unsubscribe qua
`unsubscribe_store_changes`, notification topic `store_changes`), dùng `jsonrpsee` WebSocket
subscription — xác nhận tồn tại từ bản stable v0.8.1 trở đi, và có document chính thức tại
`fiber.world/docs/api-reference#websocket-subscriptions`. Node bắn `StoreChange::PutCkbInvoiceStatus
{ payment_hash, invoice_status }` mỗi khi invoice status đổi — đúng event Phase 2 cần.

**Ràng buộc cần biết trước khi implement:**
- Doc chính thức ghi rõ: *"primarily intended for Cross-Chain Hub integration rather than general
  client use"* — cơ chế này chính thức tồn tại và ổn định, nhưng Nervos framing mục đích là cho CCH,
  không phải cho use case invoice-webhook như FiberGate. Dùng được về mặt kỹ thuật, nhưng coi đây là
  "off-label usage" — vẫn giữ Phase 1 poller làm fallback (giảm tần suất xuống 30-60s) phòng khi cơ
  chế này đổi hành vi giữa các bản release.
- Stream trả về TẤT CẢ `StoreChange` (bao gồm `PutPreimage`, `PutPaymentSession`, `PutAttempt`),
  không lọc theo payment_hash — fibergate-core phải tự lọc: chỉ xử lý `PutCkbInvoiceStatus`, và chỉ
  những `payment_hash` có trong bảng `invoices` nội bộ.
- Nếu Biscuit auth được bật trên node (`FIBER_NODE_SECRET` set), token cần thêm permission
  `read("cch")` để gọi được `subscribe_store_changes`. Vì `fiber-node` trong docker-compose chỉ
  lắng nghe nội bộ (không bind public IP), Biscuit auth có thể để tắt hoàn toàn — auth theo doc chỉ
  bắt buộc khi RPC bind ra địa chỉ public — nên trong setup mặc định của FiberGate, ràng buộc
  `read("cch")` gần như không phát sinh.
- **`@ckb-ccc/fiber` (SDK chính thức đang dùng cho các RPC call khác) KHÔNG hỗ trợ subscription**
  (đã verify bằng cách tải source thật từ npm: `FiberClient` chỉ wrap `ccc.RequestorJsonRpc`, thuần
  request/response, không có dòng nào liên quan "subscribe"/"websocket"). → Cần viết 1 WebSocket
  JSON-RPC client nhỏ, riêng, chỉ để gọi `subscribe_store_changes`/nhận notification `store_changes`,
  song song với `@ckb-ccc/fiber` cho các RPC call thông thường khác trong `lib/fiber/client.ts`.

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
FIBER_NODE_SECRET=               # Biscuit token, optional — không bắt buộc vì fiber-node chỉ bind
                                  # nội bộ trong docker network, không public IP. Nếu bật, token
                                  # cần đủ permission cho các method đang dùng + read("cch") nếu
                                  # muốn gọi subscribe_store_changes (Phase 2)

WEBHOOK_SIGNING_KEY=             # per-endpoint, random secret để sign webhooks
CRON_SECRET=                     # optional, bảo vệ /api/cron endpoint (manual trigger)
```
