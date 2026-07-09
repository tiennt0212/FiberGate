---
type: architecture
version: 1.5
last_updated: 2026-07-06
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
| Dev tooling | `vitest` (devDep của cả `apps/web` và `packages/sdk`) | `apps/web`: unit test 2 tầng — `lib/services/*.test.ts` mock ở boundary `@/lib/db` + `@/lib/fiber/client`; `app/api/v1/**/route.test.ts` mock ở boundary `@/lib/services/*` (`pnpm --filter web test:unit`). `packages/sdk`: `webhooks.test.ts` verify HMAC edge cases, `client.test.ts` mock global `fetch` (`pnpm --filter sdk test:unit`) — 2 package.json khai báo version riêng (cùng `^4.1.9`, tự dedupe qua pnpm content-addressable store), không hoist lên root |
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

**"Merchant's storefront app" cụ thể hoá (issue #12):** `apps/demo-storefront` là bản
implement thật của box này — 1 workspace app hoàn toàn tách biệt khỏi `apps/web`
(không import code chung, không chung process/container), gọi `POST /api/v1/invoices`
qua `@fibergate/sdk` đúng như 1 merchant thứ ba thật sẽ làm, dùng `FIBERGATE_BASE_URL` +
`FIBERGATE_INTERNAL_SECRET` để trỏ tới `fibergate-core`. Nhận webhook thật ở
`POST /api/webhook` (verify bằng `@fibergate/sdk`'s `verifyWebhookSignature()`), đẩy
update qua Server-Sent Events cho browser — không polling. Deploy tách biệt qua overlay
`apps/demo-storefront/docker-compose.demo.yml` (Dockerfile + compose overlay nằm ngay
trong thư mục app, tự chứa hoàn toàn — không thuộc bundle 3-container merchant-facing
gốc ở `docker-compose.yml`/`docker/`). Xem README.md "Demo storefront" để biết cách
chạy local.

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

3. Background Poller — Phase 1: in-process interval worker chạy trong container fibergate-core mỗi 10s,
   thực hiện đúng thứ tự 2 bước sau (thứ tự bắt buộc, xem `decisions-log.md`):
   a. RPC-driven batch (BR-POL-002/003) — CHẠY TRƯỚC: query invoices WHERE status = "pending" AND
      expires_at > now() - 60s, tối đa 50 invoice; với mỗi invoice gọi Fiber Node RPC get_invoice
      { payment_hash }; nếu status đổi (paid/expired/failed) → update PostgreSQL + fire webhook.
   b. Bulk clock-expire (BR-STS-002(b)) — CHẠY SAU: 1 câu UPDATE duy nhất, invoices WHERE
      status = "pending" AND expires_at < now() → set "expired" + fire webhook, không gọi RPC
      (bắt những invoice đã hết hạn quá lâu, ngoài cửa sổ 60s ở bước a nên chưa từng được RPC check).
      Phải chạy SAU bước a — chạy trước sẽ có thể đánh dấu "expired" nhầm 1 invoice vừa được trả tiền
      đúng lúc hết hạn (status chỉ chuyển 1 chiều — BR-STS-001 — nên không có đường quay lại "paid").

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

> **Cập nhật 2026-07-06 (issue #8, implement `lib/webhooks/*`)**: Bản mô tả dưới đây đã sửa 2 chỗ
> stale còn sót lại từ 1 bản nháp multi-tenant cũ hơn: (1) không có cột `user_id` nào trong
> `webhook_endpoints` (single-tenant) — filter đúng là `is_active = true AND eventType IN events`;
> (2) retry KHÔNG phải exponential backoff — là schedule cố định `immediate → 1 phút → 5 phút`
> (BR-WHK-003). Key ký HMAC luôn là `webhook_endpoints.secret` **riêng theo từng endpoint**
> (mã hoá tại rest bằng `WEBHOOK_SECRET_ENCRYPTION_KEY`, xem mục Environment Variables), không phải
> 1 global signing key.

```
1. Invoice status → paid/expired/failed (BR-WHK-001)
2. Query webhook_endpoints WHERE is_active = true AND eventType IN events
3. Với mỗi endpoint match (dispatch không block poller — trigger.ts chỉ await phần insert
   webhook_deliveries bên dưới, không await bước gửi HTTP thật; xem lib/webhooks/trigger.ts):
   a. Build payload: { event, created_at, data: {...} } (api/rest-api-spec.md "Webhook Payload")
   b. Insert 1 row webhook_deliveries (status='pending', attempt_count=0)
   c. Arm attempt qua lib/webhooks/retry-scheduler.ts's scheduleAttempt(deliveryId, 0)
4. Khi attempt thật thi hành (lib/webhooks/deliver.ts):
   a. Decrypt endpoint's secret (lib/webhooks/secret-crypto.ts), sign: HMAC-SHA256(rawBody, secret)
   b. POST đến merchant URL với header X-Fiber-Signature: sha256=xxx, timeout 5s (BR-WHK-002)
   c. Lưu delivery record (http_status, response_body truncated 1KB, attempt_count, status)
   d. Nếu retryable (timeout/network/5xx/429, BR-WHK-006) và chưa đạt 3 attempts (BR-WHK-003) →
      scheduleAttempt() lần tiếp theo (+60s rồi +300s); nếu non-retryable (4xx khác) hoặc đã đạt
      3 attempts → status='failed', dừng hẳn
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
cho cả `docker compose up -d` lẫn `pnpm dev`. 6 biến required để trống có chủ đích
(không có default an toàn nào) — cách generate từng biến xem `README.md`
"Generating secrets":

```bash
# .env.example (root) — rút gọn, xem file thật cho comment đầy đủ
POSTGRES_USER=fibergate
POSTGRES_DB=fibergate
POSTGRES_PASSWORD=
FIBER_SECRET_KEY_PASSWORD=       # không thuộc 8 biến app-level bên dưới — chỉ
                                  # fiber-node đọc, xem section "fiber-node
                                  # container" bên dưới — nhưng vẫn để trong
                                  # .env.example (section riêng) để merchant
                                  # thấy đủ giá trị required trong 1 lần cp
ADMIN_PASSWORD_HASH_B64=         # base64-encoded bcrypt hash — KHÔNG phải
                                  # raw "$2y$10$..." — xem "Dashboard auth"
                                  # bên dưới để biết lý do
DASHBOARD_SESSION_SECRET=        # ký session cookie (JWT, qua jose) cho
                                  # app/(dashboard)/** — cố ý tách biệt với
                                  # FIBERGATE_INTERNAL_SECRET (BR-SEC-004), xem
                                  # apps/web/lib/auth/session.ts + middleware.ts
FIBERGATE_INTERNAL_SECRET=
FIBER_NODE_URL=http://fiber-node:8227  # fixed value, docker internal network
FIBER_NODE_RPC_AUTH_TOKEN=       # optional
WEBHOOK_SECRET_ENCRYPTION_KEY=   # 64-char hex (32-byte AES-256 key) encrypting
                                  # webhook_endpoints.secret at rest — NOT a
                                  # signing key itself. Each endpoint's own
                                  # secret (webhook_endpoints.secret, random
                                  # >=32 bytes per BR-SEC-003) is what signs
                                  # that endpoint's payloads (BR-WHK-004); this
                                  # env var only protects that per-endpoint
                                  # secret at rest. See
                                  # apps/web/lib/webhooks/secret-crypto.ts.
                                  # Generate via: openssl rand -hex 32
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

> **Cập nhật 2026-07-09 (issue #17)**: thêm 2 biến **required** mới,
> `DOMAIN`/`CERTBOT_EMAIL` — dùng bởi `nginx`/`certbot` (mục "TLS/WSS reverse proxy"
> ở trên), không phải secret sinh ngẫu nhiên như các biến khác mà là giá trị
> real-world (domain thật + email thật). Không có default an toàn nào (nginx không
> start ra config dùng được nếu thiếu `DOMAIN`) — xem README.md "Public HTTPS deploy".
> ```bash
> DOMAIN=                          # public domain, cần DNS trỏ vào host này +
>                                   # port 80/443/8228 mở ra internet
> CERTBOT_EMAIL=                   # Let's Encrypt expiry notices
> ```

Không có preflight/service nào tự động kiểm tra các biến bcrypt/secret ở trên (postgres/
fibergate-core tự fail rõ ràng nếu thiếu) — riêng `DOMAIN` có `nginx-certs-preflight`
sinh cert self-signed tạm nếu thiếu cert thật, nên `nginx`/`docker compose up -d` vẫn
start được kể cả khi `DOMAIN` chưa trỏ đi đâu thật, chỉ là không dùng được qua HTTPS
đáng tin cậy cho tới khi hoàn tất README.md "Public HTTPS deploy".

> **Cập nhật 2026-07-08 (issue #12, demo storefront)**: `apps/demo-storefront` là 1
> app hoàn toàn riêng (xem "Merchant's storefront app cụ thể hoá" ở mục kiến trúc
> phía trên) nên có `.env.example` độc lập của chính nó (`FIBERGATE_BASE_URL`,
> `FIBERGATE_INTERNAL_SECRET`, `DEMO_WEBHOOK_SECRET`) — **root `.env`/`.env.example`
> không có biến demo-storefront nào cả**, kể cả khi deploy qua Docker Compose:
> `apps/demo-storefront/docker-compose.demo.yml`'s service `demo-storefront` dùng
> `env_file: [apps/demo-storefront/.env.local]` để đọc thẳng secrets từ file đó
> (cùng file `pnpm --filter demo-storefront dev` dùng), chỉ override đúng 1 biến
> `FIBERGATE_BASE_URL` (topology-dependent: docker DNS name khi chạy container,
> khác giá trị `localhost` trong `.env.local`) qua `environment:` block (luôn
> thắng `env_file:` cho cùng 1 key). Bản đầu tiên (đã sửa) có thêm
> `DEMO_WEBHOOK_SECRET` vào root `.env.example` để Docker Compose interpolate —
> human phát hiện đây là duplicate thật với `apps/demo-storefront/.env.example`,
> sửa lại bằng `env_file:` để chỉ còn đúng 1 nơi lưu secret này. Xem
> `decisions-log.md` 2026-07-08 để biết chi tiết + 1 gotcha đáng nhớ phát hiện lúc
> sửa: `env_file:` trong 1 override compose file resolve path tương đối theo
> **project directory** (thư mục file `-f` đầu tiên), không phải theo thư mục
> chứa chính file override đó — cùng hành vi đã ghi nhận cho `build.context`.
>
> Cũng đã cân nhắc và **bỏ** 1 script seed tự động (`apps/web/lib/services/webhooks.ts`'s
> `createWebhookEndpoint()` gọi trực tiếp từ 1 `.mjs` script) từng làm trong cùng
> phiên — human chốt không cần, sẽ tự đăng ký webhook endpoint qua Dashboard (khi
> trang đó được xây) thay vì có riêng 1 cơ chế seed cho demo.

> **Cập nhật 2026-07-05 (issue #9, phát hiện lúc code review trước khi tạo PR)**:
> `docker-compose.yml`'s `fibergate-core.environment` phải liệt kê tường minh **từng**
> biến app-level muốn container thấy được — Compose không tự forward toàn bộ root
> `.env` vào container, chỉ những biến có mặt trong `environment:` mới được inject.
> `DASHBOARD_SESSION_SECRET` (thêm ở issue #9) ban đầu bị bỏ sót khỏi block này —
> `pnpm dev` không lộ bug vì script `dev` load thẳng root `.env` qua `dotenv-cli`,
> bỏ qua hẳn cơ chế allowlist của Compose. Verify bằng `docker compose config | grep
> DASHBOARD_SESSION_SECRET` thấy resolve đúng sau khi thêm dòng
> `DASHBOARD_SESSION_SECRET: ${DASHBOARD_SESSION_SECRET}` vào block đó. Bài học chung:
> mọi biến app mới thêm vào `.env.example` đều phải đối chiếu lại
> `docker-compose.yml`'s `fibergate-core.environment` trong cùng session — 2 file này
> không tự đồng bộ.

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
  CKB của merchant tự cung cấp. `FIBER_SECRET_KEY_PASSWORD` **không** thuộc 8 biến
  app-level ở `.env.example` phía trên (chỉ `fiber-node` đọc, không phải code
  `fibergate-core`), nhưng vẫn có mặt trong `.env.example` — ở section riêng, tách
  biệt khỏi 8 biến app — để merchant không bỏ sót khi chỉ làm theo 1 bước
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

## Dashboard auth: session cookie + middleware guard (issue #9)

`apps/web/middleware.ts` guard mọi route dưới `app/(dashboard)/**` bằng session cookie
JWT (ký qua `jose`, secret `DASHBOARD_SESSION_SECRET`, xem `apps/web/lib/auth/session.ts`).
Login/logout là Next.js Server Action (`app/login/actions.ts`), không phải route
`/api/*` — không đi qua envelope `{data,error}` (envelope đó chỉ áp dụng cho `/api/v1/*`,
xem `api/rest-api-spec.md`).

- **Gotcha quan trọng — `middleware.ts`'s `config.matcher` phải là literal, không được
  import từ file khác**: Next.js static-extract `config` lúc build bằng AST parser giới
  hạn, chỉ resolve được giá trị literal khai ngay tại chỗ, không resolve được identifier
  import từ module khác. Ban đầu matcher được tách ra `lib/auth/routes.ts` (`PROTECTED_PATH_MATCHERS`)
  cho gọn — verify bằng `next build` thật thấy warning `"Next.js can't recognize the
  exported 'config' field... The default config will be used instead"` — nghĩa là guard
  bị tắt hoàn toàn, middleware chạy trên **mọi** route thay vì chỉ 3 route đã định.
  Hậu quả nếu không phát hiện: `/login` tự guard chính nó → infinite redirect loop; mọi
  request `/api/v1/*`/`/api/cron/*` (auth qua Bearer header, không phải session cookie)
  bị chặn nhầm redirect về `/login`. Fix: matcher array inline trực tiếp trong
  `middleware.ts`'s `config` export, `lib/auth/routes.ts` chỉ còn giữ `ROUTE.LOGIN`/
  `ROUTE.DASHBOARD` (dùng ở runtime bên trong function body, không phải static config,
  nên import bình thường không sao). Route group `(dashboard)` không xuất hiện trong URL
  nên matcher là allowlist thủ công liệt kê từng subroute hiện có
  (`/dashboard`, `/webhooks`, `/transactions`) — thêm page mới dưới `(dashboard)/` phải
  tự thêm path pattern vào matcher này, không tự động được guard.
- **Cookie `Secure` flag dựa vào `X-Forwarded-Proto` header, không dựa vào
  `NODE_ENV`**: `docker/fibergate-core/Dockerfile` hardcode `NODE_ENV=production`, nhưng
  `fibergate-core` tự nó không làm TLS termination — `apps/web/lib/auth/session.ts`'s
  `isHttpsRequest()` đọc header `X-Forwarded-Proto` thay vì `NODE_ENV==="production"`,
  không có header thì `secure: false`. **Cập nhật 2026-07-09 (issue #17)**: giờ đã có
  TLS termination thật — `nginx` (service mới trong `docker-compose.yml`, xem mục
  "TLS/WSS reverse proxy (nginx + certbot)" ngay dưới) set đúng
  `X-Forwarded-Proto: https` khi forward tới `fibergate-core:3000`, nên `secure: true`
  giờ là hành vi thật trên deploy mặc định, không còn là "nếu sau này thêm proxy" nữa.
  Đi kèm: `fibergate-core`'s port publish đã đổi từ `"3000:3000"` sang
  `"127.0.0.1:3000:3000"` (loopback-only, đúng như dự đoán trước đó) — không publish
  trực tiếp ra host nữa, `nginx` là entry point công khai duy nhất, tránh ai đó gọi
  thẳng `http://host:3000` bỏ qua nginx để tự set header giả đánh lừa cookie.

### TLS/WSS reverse proxy (nginx + certbot) — issue #17

`docker-compose.yml` có thêm 3 service: `nginx-certs-preflight` (one-shot, sinh cert
self-signed tạm nếu chưa có cert thật, để `nginx` start được lần đầu — cùng tinh thần
với `fiber-node-preflight`), `nginx` (`nginx:1.27-alpine` bản chính thức, **không cần
custom build** — đã verify `nginx -V` có sẵn `--with-stream`/`--with-stream_ssl_module`/
`--with-stream_ssl_preread_module` compiled tĩnh), và `certbot` (renew loop, issuance
lần đầu là lệnh thủ công 1 lần — xem README.md "Public HTTPS deploy"). `nginx` là
service DUY NHẤT publish host port công khai thật (`80`, `443`, `8228`) — `postgres`/
`fiber-node`/`fibergate-core` đều giữ nguyên loopback-only.

Kiến trúc `nginx.conf.template` (`docker/nginx/`, templated bằng `envsubst '$DOMAIN'`
lúc container start — chỉ đúng 1 biến, tránh envsubst ăn nhầm `$variables` runtime của
chính nginx, cùng class bug với gotcha `$`-escaping của Docker Compose đã ghi ở
`decisions-log.md` 2026-07-02):
- `:80` — ACME HTTP-01 challenge (webroot) + redirect sang https.
- `:443 ssl` — dashboard/API, `proxy_pass` sang `fibergate-core:3000`, set
  `X-Forwarded-Proto: https`.
- `127.0.0.1:8443 ssl` (internal-only, không publish ra host) — terminate TLS, proxy
  WebSocket-upgrade sang `fiber-node:8228` (plain P2P port bên trong container, không
  đổi gì ở đó).
- `stream{}` block trên `:8228` (public) — dùng `ssl_preread` để phân biệt: TLS
  ClientHello (WSS, từ browser wallet) → forward sang `127.0.0.1:8443` ở trên; không
  phải TLS (raw TCP, P2P node thường) → forward thẳng `fiber-node:8228`. Kỹ thuật này
  copy nguyên từ tài liệu chính thức `nervosnetwork/fiber`'s `docs/fiber-node-wss.md`
  (pin đúng tag `v0.9.0-rc6`, khớp image `nervos/fiber:0.9.0-rc6` đang dùng), chỉ đổi
  số port cho khớp Docker networking của project này (bản gốc dùng chung port `443`
  cho cả 2 mục đích; project này tách riêng `:443` cho dashboard và `:8228` cho P2P/WSS
  vì cần `:443` sạch cho dashboard).

`fiber-node`'s P2P listener (`fiber.listening_addr: "/ip4/0.0.0.0/tcp/8228"` trong
`docker/fiber-node/config.yml`) không đổi gì — đã bind `0.0.0.0` sẵn bên trong network
namespace riêng của chính container đó, `nginx` reach qua Docker network nội bộ
(`fiber-node:8228`), không có host port nào publish trực tiếp cho port này (khác hẳn
RPC's `172.28.0.10:8227` — port P2P không bị fnn's "public address refusal" check chi
phối, chỉ RPC mới bị). `announced_addrs` là chỗ duy nhất cần sửa thủ công (file này
`fiber-node` đọc trực tiếp, không qua Docker Compose interpolation) để thêm
`/dns4/<DOMAIN>/tcp/8228/wss` — xem comment trong chính file đó.

**Scope quyết định**: `nginx` chỉ front `fibergate-core` (dashboard/API + P2P/WSS của
`fiber-node`), KHÔNG front `apps/demo-storefront` (app tách biệt hoàn toàn, compose
overlay riêng) — giữ đúng scope gốc của issue #17. Nginx+certbot cũng được gộp thẳng
vào root `docker-compose.yml` (không phải overlay tùy chọn) — nghĩa là **mọi**
`docker compose up -d` từ giờ cần `DOMAIN`/`CERTBOT_EMAIL` trong `.env` và port
80/443/8228 mở ra internet mới thực sự dùng được qua HTTPS (dù container vẫn start
được với cert self-signed tạm nếu thiếu). Đây là thay đổi so với mô hình "mỗi merchant
chỉ cần `docker compose up -d`, không cần domain" đã ngầm định trước đó — xem
`decisions-log.md` 2026-07-09 để biết lý do human chọn hướng này.
- **`ADMIN_PASSWORD_HASH_B64` lưu base64, không phải raw bcrypt hash — 2 cơ chế load
  `.env` khác nhau corrupt ký tự `$` theo 2 kiểu khác nhau, không có cách escape nào
  thoả cả hai** (phát hiện lúc human tự test `pnpm dev` login sau khi PR #32 merge, xem
  `decisions-log.md` 2026-07-05 để biết toàn bộ quá trình điều tra): Root `.env` được
  dùng chung cho cả `docker compose up -d` (Docker Compose tự interpolate `$VAR`/`${VAR}`
  bên trong giá trị `.env`, coi `$$` là escape cho 1 dấu `$` literal) lẫn `pnpm dev`/`build`/
  `db:generate`/`db:migrate` (qua `dotenv-cli`, dùng `dotenv-expand` bên trong — cũng tự
  interpolate `$VAR` nhưng theo thuật toán khác, KHÔNG coi `$$` là escape cho 1 dấu `$`).
  Đã verify bằng container thật (`docker compose run --rm test printenv TESTVAR`, không chỉ
  tin `docker compose config`'s output — lệnh đó tự re-escape `$` lúc hiển thị nên trông có
  vẻ đúng dù giá trị runtime thật sai) và bằng `npx dotenv-cli -- node -e "console.log(...)"`:
  không có bất kỳ cách viết `$`/`$$`/`\$` nào trong `.env` cho ra đúng giá trị ở **cả 2** cơ
  chế cùng lúc — escape đúng cho bên này luôn sai ở bên kia. Đã thử thêm `--no-expand` flag
  của `dotenv-cli` và `env_file:` directive của Docker Compose (thay cho `environment: ${VAR}`
  hiện tại) — không giải quyết được, vì Docker Compose vẫn tự interpolate giá trị đọc từ
  `env_file:` giống hệt cách nó làm với root `.env`. Fix: `ADMIN_PASSWORD_HASH_B64` lưu
  base64 của hash gốc (bảng chữ base64 không có ký tự `$`), `app/login/actions.ts` decode lại
  bằng `Buffer.from(value, "base64").toString("utf-8")` trước khi `bcrypt.compare()` — cả 2
  cơ chế load `.env` đều pass-through base64 nguyên vẹn, không cần escape gì cả. Đánh đổi đã
  biết: đây là fix tạm thời cho model env-var-only hiện tại — nếu/khi issue #30 (chuyển
  `ADMIN_PASSWORD_HASH` sang DB-backed) triển khai, vấn đề này biến mất hoàn toàn cho việc
  verify hàng ngày (Postgres/Drizzle không quan tâm ký tự `$`), chỉ còn lại đúng 1 lần lúc
  seed dữ liệu ban đầu cần thiết kế riêng (không nên tái dùng nguyên si cơ chế env-var này
  cho bước seed).
