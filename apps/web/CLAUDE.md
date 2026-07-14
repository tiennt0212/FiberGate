# CLAUDE.md — apps/web (fibergate-core)

Bổ sung cho root `CLAUDE.md` (Claude Code tự load cả 2 khi làm việc trong thư mục
này). Nội dung dưới đây chỉ áp dụng cho `apps/web/`.

## Auth flow cho API routes

Mọi API route `/api/v1/*` phải validate theo thứ tự:
1. Extract Bearer token từ `Authorization` header
2. So sánh constant-time với `FIBERGATE_INTERNAL_SECRET` (env var) — **không** dùng `===` thường
3. Reject nếu không khớp — single-tenant, không lookup theo user/client

`FIBERGATE_INTERNAL_SECRET` là 1 shared secret duy nhất set lúc deploy, không phải per-client key. Không bao giờ log ra console hoặc trả về trong response (BR-SEC-001).

## Service layer pattern

`route.ts` handler chỉ làm auth, parse/validate request, map lỗi sang HTTP status, và shape response — **không** tự viết Drizzle query hay gọi Fiber RPC trực tiếp. Business logic (đọc/ghi DB, gọi `lib/fiber/client.ts`, domain rules) nằm trong `lib/services/*.ts` (ví dụ `lib/services/invoices.ts`, `lib/services/node.ts`), route chỉ gọi vào:
```typescript
// route.ts
const row = await invoicesService.createInvoice(input); // domain logic ở service
return ok(serializeCreatedInvoice(row), undefined, 201);  // shaping ở route
```
Rule request/route-level thuần túy (ví dụ rate limit `BR-RTE-*`) vẫn ở route, không đẩy xuống service. Test theo 2 tầng tương ứng: `lib/services/*.test.ts` mock `@/lib/db` + `@/lib/fiber/client`; `route.test.ts` mock `@/lib/services/*` (không mock lại db/fiber trực tiếp nữa).

Ngoại lệ: `lib/poller/invoice-poller.ts` (background job, không phải request/response controller) hiện vẫn tự query DB trực tiếp — chưa gộp vào service layer.

## Database pattern trong API routes

Dùng Drizzle client từ `lib/db/`, single-tenant nên **không cần scope theo user_id**:
```typescript
const rows = await db.select().from(invoices).where(eq(invoices.id, invoiceId))
```

## Fiber RPC calls

Mọi call đến Fiber node đi qua `lib/fiber/client.ts`. Không call Fiber RPC trực tiếp từ API routes. Response timeout: 5 giây (BR-POL-004).

`lib/fiber/client.ts` build trên nền **`@ckb-ccc/fiber`** (official SDK — "Best starting point for most app integrations" theo tài liệu hackathon) thay vì tự viết JSON-RPC thô. Không dùng `@fiber-pay/sdk`/`@fiber-pay/react` cho core flow (Phase 1/2) — 2 thư viện đó là community/experimental, chỉ cân nhắc làm reference cho Phase 3 (L402), xem root `CLAUDE.md`'s `CKB/Fiber References`.

## Poller và cron endpoint

Phase 2 (issue #13): nguồn chính là real-time WebSocket listener (`subscribe_store_changes`, xem `lib/poller/invoice-listener.ts`); in-process interval worker (`lib/poller/worker.ts`) chạy trong container `fibergate-core` mỗi 30s (BR-POL-001) giờ chỉ là fallback, không tắt hẳn. `/api/cron/poll-invoices` chỉ là endpoint optional để trigger poll thủ công — vẫn phải check `Authorization: Bearer ${CRON_SECRET}` trước khi xử lý.

## Response format

Tất cả API responses theo format:
```typescript
// Success
{ data: T, error: null, meta?: { ... } }
// Error  
{ data: null, error: { code: string, message: string } }
```
