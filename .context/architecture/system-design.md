---
type: architecture
version: 1.2
last_updated: 2026-07-04
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
| Dev tooling | `dotenv-cli` (dep của `apps/web`) | `pnpm dev`'s script dùng để merge root `.env` + `apps/web/.env.local`, tránh duplicate secret giữa 2 file — xem mục Environment Variables |
| Dev tooling | `vitest` (devDep của `apps/web`) | Unit test cho `lib/api/*` + route handler trong `app/api/v1/**`, mock ở boundary `@/lib/db` + `@/lib/fiber/client` (`pnpm --filter web test:unit`) |
| Dev tooling | `@usebruno/cli` (devDep của `apps/web`) | HTTP integration test chạy qua `bru run` nhắm vào `/api/v1/*` thật — collection tại root `bruno/` (`pnpm --filter web test:integration`) |

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
- Nếu Biscuit auth được bật trên node (`FIBER_NODE_RPC_AUTH_TOKEN` set), token cần thêm permission
  `read("cch")` để gọi được `subscribe_store_changes`. `fnn` chỉ bắt buộc Biscuit khi
  `rpc.listening_addr` là địa chỉ nó tự phân loại "public" (loopback/private/link-local mới được coi
  là an toàn — **`0.0.0.0` KHÔNG nằm trong nhóm an toàn này dù chỉ nghe nội bộ**, xem gotcha đã ghi ở
  `decisions-log.md` 2026-07-02). FiberGate né yêu cầu này bằng cách bind `fiber-node` vào 1 static
  private IP (`172.28.0.10`, xem mục "fiber-node container" bên dưới) thay vì `0.0.0.0` — IP thuộc
  dải RFC1918 nên `fnn` coi là "private", Biscuit auth vẫn tắt hoàn toàn, ràng buộc `read("cch")`
  không phát sinh trong setup mặc định.
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

Không có `DATABASE_URL` ở bất kỳ đâu — `lib/db/` (chưa viết, thuộc issue khác) luôn
tự build connection string từ 5 biến `POSTGRES_*` trước khi khởi tạo Drizzle client,
1 code path duy nhất dùng chung cho cả Docker lẫn local dev:

```ts
const databaseUrl = `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`
```

**Chỉ 1 file chứa secret thật** — root `.env` (copy từ `.env.example`), dùng chung
cho cả `docker compose up -d` lẫn `pnpm dev`. 5 biến required để trống có chủ đích
(không có default an toàn nào) — cách generate từng biến xem `README.md`
"Generating secrets":

```bash
# .env.example (root) — rút gọn, xem file thật cho comment đầy đủ
POSTGRES_USER=fibergate
POSTGRES_DB=fibergate
POSTGRES_PASSWORD=
FIBER_SECRET_KEY_PASSWORD=       # không thuộc 7 biến app-level bên dưới — chỉ
                                  # fiber-node đọc, xem section "fiber-node
                                  # container" bên dưới — nhưng vẫn để trong
                                  # .env.example (section riêng) để merchant
                                  # thấy đủ giá trị required trong 1 lần cp
ADMIN_PASSWORD_HASH=
FIBERGATE_INTERNAL_SECRET=
FIBER_NODE_URL=http://fiber-node:8227  # fixed value, docker internal network
FIBER_NODE_RPC_AUTH_TOKEN=       # optional
WEBHOOK_SIGNING_KEY=
```

> **Cập nhật 2026-07-03 (issue #5, verified khi implement `lib/fiber/client.ts`)**:
> `client.ts` đọc `FIBER_NODE_RPC_AUTH_TOKEN` trực tiếp từ `process.env` như mô
> tả ở trên, nhưng bản `@ckb-ccc/fiber@0.0.0-canary-20260505020844` đang pin
> **chưa có cơ chế nào để gắn token này vào request thật** — SDK's HTTP
> transport hard-code duy nhất header `content-type: application/json`, không
> có chỗ nào đọc `Authorization`/Biscuit. Xem chi tiết ở `decisions-log.md`
> 2026-07-03. Không ảnh hưởng chức năng hiện tại vì Biscuit auth đang tắt
> hoàn toàn theo thiết kế mặc định (mục "fiber-node container" bên dưới) —
> chỉ cần lưu ý nếu sau này có ai bật Biscuit auth thật, sẽ cần viết thêm 1
> custom RPC transport mới forward được token.

```bash
CRON_SECRET=                     # optional
```

Không có preflight/service nào tự động kiểm tra các biến này — để trống thì
`docker compose up -d` sẽ fail rõ ràng ở `postgres`/`fibergate-core` (lỗi credential
rỗng), đủ để merchant biết cần điền gì mà không cần thêm 1 service chỉ để validate.

`apps/web/.env.local` chỉ còn 3 biến override cho local dev ngoài Docker — không
duplicate lại các biến ở trên:

```bash
# apps/web/.env.example → copy thành apps/web/.env.local
POSTGRES_HOST=localhost          # root .env không có field này — trong docker-compose
                                  # nó là giá trị cố định "postgres", khai thẳng trong
                                  # docker-compose.yml, không phải merchant-configurable
POSTGRES_PORT=5432
FIBER_NODE_URL=                  # root .env mặc định trỏ DNS nội bộ docker
                                  # (http://fiber-node:8227) — không resolve được nếu
                                  # chạy pnpm dev thuần, cần override, vd http://localhost:8227
```

`apps/web/package.json`'s `dev` script dùng `dotenv-cli` để merge 2 file này trước
khi spawn `next dev`: `dotenv -e .env.local -e ../../.env -- next dev` — file liệt kê
trước thắng (theo docs của `dotenv-cli`), nên `.env.local` override đúng 3 biến trên,
còn lại lấy từ root `.env`.

> **Cập nhật 2026-07-03 (issue #4, phát hiện lúc chạy thử `db:migrate`)**:
> `POSTGRES_HOST=localhost` ở trên chỉ hoạt động thật vì `docker-compose.yml`'s
> `postgres` service publish port loopback-only (`127.0.0.1:5432:5432`) — giống
> hệt pattern đã dùng cho `fiber-node`'s RPC (xem section "fiber-node container"
> bên dưới). Trước đó `postgres` không có `ports:` nào, nên `pnpm dev`/
> `pnpm --filter web db:migrate` chạy trên host không kết nối được (connection
> refused). Xem `decisions-log.md` 2026-07-03 để biết chi tiết + cách verify.

## fiber-node container (docker-compose)

Deployment details chốt khi implement issue #3 (xem `decisions-log.md` để biết lý do):

- Image: official `nervos/fiber` (Docker Hub) / `ghcr.io/nervosnetwork/fiber` (GHCR
  mirror), hiện pin `nervos/fiber:0.9.0-rc6` — repo image chưa publish tag semver ổn
  định nào (chỉ có `0.9.0-rc1`..`rc6` prerelease + `sha-<hash>`), cần revisit khi có
  stable tag.
- Image tự động copy bundled **testnet** config vào `/fiber/config.yml` lúc first-run
  nếu file chưa tồn tại (đừng set `FIBER_CONFIG_TEMPLATE` — biến đó chuyển sang mainnet
  config). FiberGate pre-seed sẵn `docker/fiber-node/config.yml` thay vì để image tự
  generate, để repo state đúng ngay từ đầu.
- **Gotcha quan trọng**: RPC listener trong bundled config mặc định bind
  `127.0.0.1:8227` (chỉ loopback trong container) — `fibergate-core` (container khác) không gọi
  được qua đó. **KHÔNG sửa thành `0.0.0.0:8227`** — tưởng hợp lý nhưng `fnn` (bản đang pin
  `0.9.0-rc6`) tự phân loại `0.0.0.0` là địa chỉ "public" (chỉ loopback/private/link-local mới được
  coi "an toàn") và **từ chối start** nếu không có `rpc.biscuit_public_key`
  (lỗi: `Cannot listen on a public address without a biscuit public key set in the config`) — phát
  hiện lúc chạy live thật lần đầu, xem tường thuật đầy đủ ở `decisions-log.md` 2026-07-02. Cách đúng:
  gán `fiber-node` 1 **static private IP** trên network `fibergate-net` (`docker-compose.yml`'s
  `networks.fibergate-net.ipam.config.subnet: 172.28.0.0/24` +
  `fiber-node.networks.fibergate-net.ipv4_address: 172.28.0.10`), rồi set
  `rpc.listening_addr: 172.28.0.10:8227` — IP thuộc dải RFC1918 nên `fnn` coi là "private", pass
  check mà không cần Biscuit, vẫn chỉ reachable trong docker network nội bộ như cũ. Hệ quả kéo theo:
  healthcheck `fnn-cli info` (chạy trong chính container, mặc định trỏ `127.0.0.1`) phải đổi thành
  `fnn-cli -u http://172.28.0.10:8227 info` vì loopback không còn reach được RPC.
- Node cần `FIBER_SECRET_KEY_PASSWORD` (env) + CKB private key file mount tại
  `<data-dir>/ckb/key` (data dir mount ở container path `/fiber`) — đây là secret ký
  CKB của merchant tự cung cấp. `FIBER_SECRET_KEY_PASSWORD` **không** thuộc 7 biến
  app-level ở `.env.example` phía trên (chỉ `fiber-node` đọc, không phải code
  `fibergate-core`), nhưng vẫn có mặt trong `.env.example` — ở section riêng, tách
  biệt khỏi 7 biến app — để merchant không bỏ sót khi chỉ làm theo 1 bước
  `cp .env.example .env`. Quyết định UX này đổi từ thiết kế ban đầu (cố tình loại
  hẳn khỏi `.env.example`), xem `decisions-log.md`.
- Image có sẵn `fnn-cli`, dùng được cho healthcheck (`fnn-cli info`) mà không cần cài
  thêm curl/wget.
- RPC được publish ra host ở dạng **loopback-only**: `ports: "127.0.0.1:8227:8227"`
  trong `docker-compose.yml`. Lý do: `pnpm dev` (chạy `apps/web` trực tiếp trên host,
  không qua Docker) cần gọi được `fiber-node` mà không phải sửa `/etc/hosts` hay thêm
  `docker-compose.override.yml`. Khác hẳn `"8227:8227"` thường (mặc định bind
  `0.0.0.0`, sẽ lộ RPC chưa bật auth ra internet nếu host có IP public) —
  `127.0.0.1:8227:8227` không bao giờ lộ ra ngoài chính máy đang chạy, dù máy đó là
  laptop hay VPS có IP public, nên vẫn khớp đúng yêu cầu "fiber-node does NOT bind a
  public IP/port" của issue #3. Đã verify: `docker compose ps` hiện đúng
  `127.0.0.1:8227->8227/tcp`, `ss -tlnp` xác nhận socket chỉ LISTEN trên `127.0.0.1`.
