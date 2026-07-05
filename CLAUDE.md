# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Đây là project gì?

**FiberGate** là self-hosted, open-source merchant payment gateway framework prototype cho Fiber Network hackathon (1–15 July 2026). (Không gọi là "LSP framework" — không cung cấp dịch vụ liquidity/mở channel hộ bên thứ ba; đây là merchant payment gateway, khớp category 3 "Merchant, Liquidity, LSP, and Multi-Asset Infrastructure" qua hướng "payment processor prototypes... payment status webhooks".)
Merchant tự deploy bằng `docker compose up -d` (Fiber node + PostgreSQL + FiberGate core) trên hạ tầng của chính mình, rồi gọi REST API nội bộ để tạo invoice và nhận thanh toán — không cần tự viết code kết nối Fiber RPC, quản lý invoice state machine, hay tự build webhook delivery từ đầu. Single-tenant: mỗi deployment phục vụ 1 merchant, không có multi-tenant API key/account system.

Đọc `.context/INDEX.md` trước tiên, sau đó đọc theo thứ tự:

1. `.context/glossary/fiber-terms.md` — Thuật ngữ (quan trọng để không hallucinate)
2. `.context/business-context/project-vision.md` — Vision, scope, hackathon constraints
3. `.context/architecture/system-design.md` — Kiến trúc, data flow, tech stack, env vars
4. `.context/data-dictionary/database-schema.md` — PostgreSQL tables, columns, relations
5. `.context/api/rest-api-spec.md` — API spec đầy đủ (request/response/errors)
6. `.context/business-rules/payment-rules.md` — Logic nghiệp vụ, rate limits, security rules
7. `.context/processes/decisions-log.md` — Quyết định đã được human chốt
8. `.context/processes/definition-of-done.md` — DoD và checklist cuối phiên

## Monorepo layout

```
apps/web/          — Next.js 14 App Router (fibergate-core: dashboard + API routes)
  app/(dashboard)/ — Protected routes (single-admin password gate): /dashboard, /webhooks, /transactions
  app/api/v1/      — REST API endpoints: /invoices, /node
  app/api/cron/    — Optional manual-trigger endpoint: /poll-invoices (nguồn chính là in-process interval worker)
  lib/db/          — Drizzle client + schema + helpers
  lib/fiber/       — Fiber JSON-RPC client (wraps FNN node calls)
  lib/services/    — Business logic route.ts delegates to (xem "Service layer pattern" bên dưới)
packages/sdk/      — npm package @fibergate/sdk (TypeScript, tsup)
docker-compose.yml — Fiber node + PostgreSQL + fibergate-core, merchant tự deploy
docker/            — docker/fibergate-core/Dockerfile, config fiber-node
.context/          — Project context files (Single Source of Truth)
.context/design/   — Mockup UI đầy đủ, commit thẳng vào repo (không chỉ token nữa):
                     - FiberGate.dc.html — mockup dashboard thật (mở trực tiếp bằng browser)
                     - COMPONENTS.dc.html — artboard catalog: từng component pattern trong DESIGN.md
                       render trực quan kèm caption map sang Antd v5 component + cách override
                       (Card/Tag/Table/Button/Segmented/Progress/Alert/Badge/Modal/Menu...) — mở bằng
                       browser để tra khi code UI, đỡ phải tự đoán nên dùng component Antd nào
                     - support.js — script phụ trợ cho mockup
                     - DESIGN.md — design tokens/type scale/component patterns (reference khi code UI)
                     Nguồn gốc: Claude Design (project ID ở trên), nhưng do giới hạn chia sẻ với
                     teammate nên bản trong repo mới là bản dùng được cho cả team. Human tự đồng bộ
                     thủ công khi có thay đổi bên Claude Design — bản trong repo có thể trễ hơn bản
                     gốc, không tự động mirror real-time.
```

## Project IDs

| Service | ID | Ghi chú |
|---------|-----|---------|
| Claude Design | `15b01139-c51f-472e-81df-e7c0777dd47d` | UI mockups |

## Commands

```bash
pnpm install                    # install tất cả packages
pnpm dev                        # chạy apps/web dev server
pnpm build                      # build tất cả
pnpm lint                       # lint toàn bộ
pnpm --filter web typecheck     # TypeScript strict check cho web app
pnpm --filter sdk build         # build chỉ sdk package
pnpm --filter web dev           # chạy chỉ web app
pnpm docker:dev                 # chạy dev mode: chỉ postgres + fiber-node (không có fibergate-core)
pnpm docker:dev:down            # dừng postgres + fiber-node ở dev mode

docker compose up -d            # build + chạy fiber-node + postgres + fibergate-core
docker compose build             # rebuild image fibergate-core sau khi đổi code
```

## Kiến trúc và patterns quan trọng

### Auth flow cho API routes

Mọi API route `/api/v1/*` phải validate theo thứ tự:
1. Extract Bearer token từ `Authorization` header
2. So sánh constant-time với `FIBERGATE_INTERNAL_SECRET` (env var) — **không** dùng `===` thường
3. Reject nếu không khớp — single-tenant, không lookup theo user/client

`FIBERGATE_INTERNAL_SECRET` là 1 shared secret duy nhất set lúc deploy, không phải per-client key. Không bao giờ log ra console hoặc trả về trong response (BR-SEC-001).

### Service layer pattern

`route.ts` handler chỉ làm auth, parse/validate request, map lỗi sang HTTP status, và shape response — **không** tự viết Drizzle query hay gọi Fiber RPC trực tiếp. Business logic (đọc/ghi DB, gọi `lib/fiber/client.ts`, domain rules) nằm trong `lib/services/*.ts` (ví dụ `lib/services/invoices.ts`, `lib/services/node.ts`), route chỉ gọi vào:
```typescript
// route.ts
const row = await invoicesService.createInvoice(input); // domain logic ở service
return ok(serializeCreatedInvoice(row), undefined, 201);  // shaping ở route
```
Rule request/route-level thuần túy (ví dụ rate limit `BR-RTE-*`) vẫn ở route, không đẩy xuống service. Test theo 2 tầng tương ứng: `lib/services/*.test.ts` mock `@/lib/db` + `@/lib/fiber/client`; `route.test.ts` mock `@/lib/services/*` (không mock lại db/fiber trực tiếp nữa).

Ngoại lệ: `lib/poller/invoice-poller.ts` (background job, không phải request/response controller) hiện vẫn tự query DB trực tiếp — chưa gộp vào service layer.

### Database pattern trong API routes

Dùng Drizzle client từ `lib/db/`, single-tenant nên **không cần scope theo user_id**:
```typescript
const rows = await db.select().from(invoices).where(eq(invoices.id, invoiceId))
```

### Fiber RPC calls

Mọi call đến Fiber node đi qua `lib/fiber/client.ts`. Không call Fiber RPC trực tiếp từ API routes. Response timeout: 5 giây (BR-POL-004).

`lib/fiber/client.ts` build trên nền **`@ckb-ccc/fiber`** (official SDK — "Best starting point for most app integrations" theo tài liệu hackathon) thay vì tự viết JSON-RPC thô. Không dùng `@fiber-pay/sdk`/`@fiber-pay/react` cho core flow (Phase 1/2) — 2 thư viện đó là community/experimental, chỉ cân nhắc làm reference cho Phase 3 (L402), xem `CKB/Fiber References` bên dưới.

### Poller và cron endpoint

Nguồn chính (Phase 1) là in-process interval worker chạy trong container `fibergate-core` mỗi 10s (BR-POL-001). `/api/cron/poll-invoices` chỉ là endpoint optional để trigger poll thủ công — vẫn phải check `Authorization: Bearer ${CRON_SECRET}` trước khi xử lý.

### Response format

Tất cả API responses theo format:
```typescript
// Success
{ data: T, error: null, meta?: { ... } }
// Error  
{ data: null, error: { code: string, message: string } }
```

## Rules quan trọng

- **KHÔNG** tự thêm dependencies mà không hỏi
- **KHÔNG** hardcode bất kỳ secret hay URL nào — dùng env vars (xem list trong `.context/architecture/system-design.md`)
- **KHÔNG** tự sửa database schema mà không update `.context/data-dictionary/database-schema.md`
- Schema Drizzle phải khớp với `.context/data-dictionary/database-schema.md` — sửa file nào cũng phải đồng bộ file kia
- Mọi API route `/api/v1/*` phải validate authentication **trước** khi thực hiện bất kỳ logic nào khác
- Error handling phải explicit — không dùng `try/catch` rỗng
- TypeScript strict mode toàn bộ — không dùng `any`

## CKB/Fiber References

Khi cần thông tin về CKB protocol hoặc Fiber Network, tra cứu theo thứ tự:

1. `.context/glossary/fiber-terms.md` — thuật ngữ đã được curate cho project này
2. CKB AI MCP (đã cài) — query trực tiếp bằng ngôn ngữ tự nhiên
3. `https://docs.nervos.org/llms.txt` — CKB docs tổng quan
4. `https://www.fiber.world/docs` — Fiber docs chính thức

**Fiber Gateway chỉ dùng Fiber ở application layer (JSON-RPC calls). KHÔNG viết CKB Scripts. KHÔNG cần hiểu Cell Model trừ khi debug channel issues.**

### SDK/tooling — official vs community (theo `fiber-hackathon-docs/resources.md`)

- **Official, dùng cho core (Phase 1/2):** `@ckb-ccc/fiber` (SDK cho `lib/fiber/client.ts`), `fnn-cli` + `ckb-cli` (setup/bootstrap channel lúc dev, không phải runtime dependency của app).
- **Community, chỉ dùng làm reference cho Phase 3 (L402, optional stretch):** `@fiber-pay/sdk` — xem demo tham chiếu [`fiber-l402`](https://github.com/RetricSu/fiber-l402) (Express + Astro + React, dùng chính thư viện này để build L402 paywall middleware). `@fiber-pay/react` không liên quan (chỉ dành cho payer-facing browser wallet UI, FiberGate không có phần này).
- **Fiber WSS Config Manual** (`nervosnetwork/fiber/blob/develop/docs/fiber-node-wss.md`) — hướng dẫn expose P2P của node qua `wss://` (Nginx+TLS) cho browser/WASM client. **Không áp dụng** cho FiberGate: `fibergate-core` gọi JSON-RPC tới `fiber-node` qua docker internal network (plain HTTP), không cần TLS/WSS. Chỉ liên quan nếu sau này làm payer-facing browser wallet trực tiếp — ngoài scope hiện tại.

## Nguyên tắc làm việc với AI Agent

### Hỏi trước khi làm
Khi gặp yêu cầu chưa rõ hoặc có nhiều cách tiếp cận, Claude Code
**KHÔNG tự suy đoán rồi implement**. Thay vào đó:

1. Nêu rõ phần nào còn ambiguous
2. Đặt câu hỏi cụ thể để làm rõ
3. Nếu cần, đề xuất 2-3 options và hỏi chọn cái nào
4. Chỉ implement sau khi nhận được câu trả lời

**Ví dụ tình huống cần hỏi:**
- Yêu cầu mô tả feature nhưng không rõ edge case
- Có thể implement theo nhiều cách với trade-off khác nhau
- Không chắc scope: "tạo webhook" là chỉ backend hay cả UI?
- Không rõ behavior khi error: retry hay fail ngay?

### Không tự quyết định các vấn đề sau (dừng và hỏi):
- Thay đổi database schema
- Thay đổi API response format (breaking change)
- Cài thêm dependency mới
- Xóa code hoặc file hiện có
- Bất kỳ logic liên quan đến security, auth, signing, hashing
- Chọn kiến trúc khi có nhiều hướng khả thi

## Khi implement một feature mới

1. Đọc user story liên quan trong `.context/user-stories/`
2. Đọc business rules liên quan trong `.context/business-rules/`
3. Implement theo API spec trong `.context/api/rest-api-spec.md`
4. Nếu là UI/dashboard: đối chiếu `.context/design/FiberGate.dc.html` (mockup thật, mở bằng browser),
   `.context/design/DESIGN.md` (tokens/component patterns), và `.context/design/COMPONENTS.dc.html`
   (component nào trong mockup nên dựng bằng Antd component nào + cách override) — không tự bịa
   màu sắc/spacing, và không tự dựng lại component mà Antd đã có sẵn
5. Update context file nếu có thay đổi design
