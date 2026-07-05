---
type: business_rules
module: payment-processing
version: 1.3
last_updated: 2026-07-05
tags: [invoice, webhook, polling, limits]
---

# Business Rules — Payment Processing

## Invoice Rules

**BR-INV-001:** Amount tối thiểu: 0.1 CKB (= 10,000,000 shannon). Amount tối đa: 1,000 CKB cho prototype.

**BR-INV-002:** Asset chỉ chấp nhận "CKB" hoặc "RUSD" trong prototype.

> **Cập nhật 2026-07-03 (issue #5)**: `lib/fiber/client.ts`'s `createInvoice()` hiện tại
> **chỉ implement "CKB"** — `@ckb-ccc/fiber`'s `Currency` enum chỉ có các denomination
> native (`Fibb`/`Fibt`/`Fibd`), không có giá trị nào cho RUSD (1 UDT). Truyền
> `asset: "RUSD"` sẽ throw `UnsupportedAssetError` rõ ràng, không silent fail. RUSD/UDT
> support được tách ra issue riêng — xem **issue #27** (milestone Phase 1 — Core, phụ
> thuộc #5). Rule này ("CKB hoặc RUSD") vẫn đúng về mặt business intent lâu dài, chỉ chưa
> đủ ở tầng implementation hiện tại.

**BR-INV-003:** Thời gian expire mặc định: 3600 giây (1 giờ). Tối đa 86400 giây (24 giờ).

**BR-INV-004:** Chuyển đổi amount: `shannon = Math.round(amount_ckb * 100_000_000)`. Lưu dạng bigint trong DB.

**BR-INV-005:** invoice_address và payment_hash lấy từ Fiber node RPC `new_invoice`. Không tự generate.

## Status Transition Rules

**BR-STS-001:** Status chỉ đi theo một chiều: `pending → paid | expired | failed`. Không thể reverse.

> **Cập nhật 2026-07-04 (issue #7, background poller)**: Node-status → `paid` mapping
> được chốt rõ. `@ckb-ccc/fiber`'s `CkbInvoiceStatus` có 5 giá trị (`"Open" |
> "Cancelled" | "Expired" | "Received" | "Paid"`) nhưng trước đây rule này chưa từng
> nói rõ giá trị nào map sang `invoices.status = 'paid'`. Đã chốt: **chỉ `"Paid"` map
> sang `paid`** — xác nhận qua Fiber's Rust source (`crates/fiber-types/src/invoice.rs`'s
> doc comment "the invoice is received, but not settled yet" cho `Received`;
> `crates/fiber-lib/src/fiber/channel.rs:1898` chỉ set `CkbInvoiceStatus::Paid` khi TLC
> được remove với `RemoveTlcFulfill`, tức hoàn tất settlement ở tầng channel). `"Received"`
> **không phải** trạng thái terminal — invoice giữ nguyên `pending`, không đổi status ở
> cycle đó; `lib/fiber/client.ts`'s `createInvoice()` đã cấp preimage cho node ngay lúc
> tạo invoice (không phải hold-invoice flow) nên `Received → Paid` diễn ra tự động gần
> như tức thời phía node, poller sẽ quan sát được `"Paid"` ở cycle 10s kế tiếp mà không
> cần hành động thêm. Implement tại `apps/web/lib/poller/invoice-poller.ts`'s
> `applyNodeStatus()`. Xem `.context/processes/decisions-log.md` [2026-07-04] mục tương
> ứng.

**BR-STS-002:** Status "expired" được set khi: (a) Fiber node báo expired, hoặc (b) `expires_at < now()` dù chưa poll.

> **Cập nhật 2026-07-05 (bug fix phát hiện qua code review, issue #7)**: (b) — bulk
> clock-expire — **bắt buộc chạy SAU** bước RPC poll (a) trong cùng 1 cycle, không phải
> trước. Bug ban đầu: `runPollCycle()` chạy expire-theo-đồng-hồ trước, nên 1 invoice
> được trả tiền đúng lúc/ngay sau khi hết hạn (`expires_at < now()` tại thời điểm
> cycle chạy, nhưng Fiber node đã ghi nhận `"Paid"`) sẽ bị đánh dấu `expired` trước khi
> bước RPC kịp thấy nó — và vì BR-STS-001 chỉ đi 1 chiều, invoice này kẹt ở `expired`
> vĩnh viễn dù khách đã trả tiền thật, merchant không bao giờ nhận `payment.paid`. Đã
> fix bằng cách đổi thứ tự trong `apps/web/lib/poller/invoice-poller.ts`'s
> `runPollCycle()`: poll RPC-batch (a) chạy trước, bulk clock-expire (b) chạy sau — xem
> chi tiết luồng ở `architecture/system-design.md`'s "Data Flow — Tạo Invoice" mục 3.

**BR-STS-003:** Status "failed" được set khi: Fiber node báo invoice bị cancelled.

## Polling Rules

**BR-POL-001:** Phase 1: in-process interval worker chạy trong container `fibergate-core` mỗi 10 giây (không còn Vercel Cron — self-hosted chạy container dài hạn chứ không phải serverless). `/api/cron/poll-invoices` giữ lại như endpoint optional để trigger poll thủ công. Phase 2 thay bằng WebSocket subscription `subscribe_store_changes` (RPC module `pubsub` của FNN, đã verify tồn tại từ bản stable v0.8.1, document tại `fiber.world/docs/api-reference#websocket-subscriptions`) — xem chi tiết thiết kế tại `architecture/system-design.md`. Ở Phase 2, vẫn giữ interval poll giảm tần suất còn 30-60s làm fallback, vì doc chính thức ghi rõ cơ chế này "primarily intended for Cross-Chain Hub integration rather than general client use".

**BR-POL-005:** Client subscribe `store_changes` phải lọc: chỉ xử lý variant `PutCkbInvoiceStatus`, và chỉ những `payment_hash` có tồn tại trong bảng `invoices` nội bộ — bỏ qua mọi variant/payment_hash khác trong stream.

**BR-POL-002:** Chỉ poll invoices có `status = "pending"` và `expires_at > now() - 60s`.

**BR-POL-003:** Mỗi batch poll tối đa 50 invoices để tránh block event loop quá lâu trong container dài hạn.

**BR-POL-004:** Nếu Fiber node không phản hồi sau 5s, skip và log error, không change status.

## Webhook Rules

**BR-WHK-001:** Fire webhook ngay khi invoice status thay đổi sang terminal state (paid/expired/failed).

**BR-WHK-002:** Webhook request timeout: 5 giây.

**BR-WHK-003:** Retry strategy: immediate → 1 phút → 5 phút. Tổng tối đa 3 attempts.

**BR-WHK-004:** Webhook payload phải được sign bằng HMAC-SHA256 với key là webhook endpoint's secret.

**BR-WHK-005:** Lưu toàn bộ delivery history trong `webhook_deliveries` dù thành công hay fail.

## Rate Limiting Rules

**BR-RTE-001:** Toàn bộ deployment tối đa 100 invoices/phút (prototype, single-tenant — vẫn giữ làm anti-abuse guard).

**BR-RTE-002:** GET /invoices list tối đa 100 items/request.

## Security Rules

**BR-SEC-001:** `FIBERGATE_INTERNAL_SECRET` chỉ set qua env var lúc deploy, so sánh constant-time (không dùng `===` thường), không bao giờ log ra console hoặc trả về trong response.

**BR-SEC-002:** `ADMIN_PASSWORD` (dashboard single-admin login) phải hash bằng bcrypt trước khi lưu/so sánh, không bao giờ lưu plaintext.

**BR-SEC-003:** Webhook secret phải random, tối thiểu 32 bytes.

**BR-SEC-004:** Dashboard session dùng httpOnly cookie ký bằng secret riêng (không phải `FIBERGATE_INTERNAL_SECRET`).

> **Cập nhật 2026-07-05 (issue #9, implement `apps/web/lib/auth/session.ts`)**: Cookie
> `Secure` attribute dựa vào header `X-Forwarded-Proto` của request thực tế (do reverse
> proxy TLS termination set), không dựa vào `NODE_ENV` — bundle docker-compose mặc định
> chưa có TLS termination nào, nên gắn `Secure` theo `NODE_ENV==="production"` sẽ khiến
> browser âm thầm từ chối lưu cookie trên chính flow deploy mặc định (plain HTTP), login
> trông như thành công nhưng session không lưu. Xem chi tiết + ràng buộc khi thêm TLS
> reverse proxy sau này ở `architecture/system-design.md`'s "Dashboard auth: session
> cookie + middleware guard".