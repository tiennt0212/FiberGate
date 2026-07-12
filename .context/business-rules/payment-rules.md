---
type: business_rules
module: payment-processing
version: 1.4
last_updated: 2026-07-09
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
>
> **Cập nhật 2026-07-09 (issue #27)**: "RUSD" nay đã implement đầy đủ. Đọc kỹ hơn
> `@ckb-ccc/fiber`'s source (`src/types/invoice.ts`) mới thấy: UDT invoice **không phải
> code path riêng** — cùng RPC `new_invoice`/method `sdk.newInvoice()` như CKB, chỉ thêm 1
> field tùy chọn `udtTypeScript` (`currency` vẫn luôn là `Fibt`, field này chỉ encode
> network, không encode asset). `lib/fiber/client.ts`'s `resolveUdtTypeScript()` lấy type
> script của RUSD từ chính node (RPC `node_info`'s `udtCfgInfos`, phản chiếu
> `docker/fiber-node/config.yml`'s `ckb.udt_whitelist` — đã pre-config sẵn RUSD thật trên
> testnet), cache in-memory theo process lifetime (whitelist là static config, chỉ đổi khi
> node restart với config.yml mới — restart đó cũng restart `fibergate-core` theo
> docker-compose dependency, nên cache không bao giờ stale trong thực tế). Node không có
> RUSD trong whitelist → throw `UdtNotConfiguredError` (phân biệt với
> `UnsupportedAssetError` — lỗi cấu hình node, không phải asset FiberGate không hỗ trợ).
> Không đổi database schema hay `lib/api/validation.ts` trong issue này — `amount_shannon`/
> `SHANNON_PER_CKB`/BR-INV-001's "0.1–1000 CKB" vẫn áp dụng nguyên cho RUSD dù tên/giới hạn
> mang ngôn ngữ CKB thuần túy (biết trước, chấp nhận cho hackathon prototype). Việc tổng
> quát hoá amount/schema cho đúng nghĩa multi-asset được tách sang issue theo dõi riêng.

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

**BR-WHK-006:** Phân loại retryable / non-retryable cho 1 lần delivery attempt (bổ sung 2026-07-06,
issue #8, implement tại `apps/web/lib/webhooks/deliver.ts`):
- **Retryable** (lên lịch attempt tiếp theo theo schedule của BR-WHK-003, tối đa 3 attempts): request
  timeout (BR-WHK-002, không phản hồi trong 5s), lỗi tầng network (DNS/connection refused/reset),
  HTTP 5xx (500-599), HTTP 429.
- **Non-retryable** (lưu attempt với `status='failed'`, KHÔNG lên lịch attempt tiếp theo,
  `attempt_count` dừng lại ở giá trị hiện tại): bất kỳ mã 4xx nào khác (400, 401, 403, 404, 405,
  410, 422, ...) — báo hiệu lỗi cấu hình/logic phía merchant mà retry trong vài phút không thể tự
  sửa được.
- BR-WHK-005 (lưu mọi attempt bất kể kết quả) vẫn áp dụng vô điều kiện — rule này chỉ ảnh hưởng đến
  việc có lên lịch thêm 1 attempt tiếp theo hay không, không ảnh hưởng đến việc lưu attempt hiện tại.

## Rate Limiting Rules

**BR-RTE-001:** Toàn bộ deployment tối đa 100 invoices/phút (prototype, single-tenant — vẫn giữ làm anti-abuse guard).

**BR-RTE-002:** GET /invoices list tối đa 100 items/request.

## Security Rules

**BR-SEC-001:** `FIBERGATE_INTERNAL_SECRET` chỉ set qua env var lúc deploy, so sánh constant-time (không dùng `===` thường), không bao giờ log ra console hoặc trả về trong response.

**BR-SEC-002:** `ADMIN_PASSWORD` (dashboard single-admin login) phải hash bằng bcrypt trước khi lưu/so sánh, không bao giờ lưu plaintext.

> **Cập nhật 2026-07-05 (issue #9, phát hiện lúc human tự test `pnpm dev` login)**: Env var
> đổi tên thành `ADMIN_PASSWORD_HASH_B64`, lưu **base64 của hash bcrypt**, không phải raw
> `$2y$10$...`. Lý do: raw hash chứa dấu `$`, và 2 cơ chế load `.env` (Docker Compose vs
> `dotenv-expand` dùng bởi `pnpm dev`) corrupt ký tự này theo 2 kiểu khác nhau — không có
> cách escape nào đúng cho cả hai cùng lúc (đã verify bằng container thật). Base64 không có
> ký tự `$` nên tránh được toàn bộ vấn đề. `app/login/actions.ts` decode lại trước khi
> `bcrypt.compare()`. Chi tiết đầy đủ xem `decisions-log.md` 2026-07-05 và
> `system-design.md`'s "Dashboard auth: session cookie + middleware guard".

> **Cập nhật 2026-07-11 (issue #30)**: Hash giờ **DB-backed** — bảng `settings`
> (`lib/services/settings.ts`), key `admin_password_hash`. Read-order: có row trong
> `settings` → dùng row đó; chưa có (chưa từng đổi password qua Dashboard → Settings) →
> fallback đọc `ADMIN_PASSWORD_HASH_B64` y hệt logic cũ. Đổi password qua Dashboard bắt
> buộc nhập lại current password trước (xác nhận qua `bcrypt.compare`), password mới
> tối thiểu 8 ký tự (assumption, không có BR nào set rule phức tạp hơn — có thể đổi nếu
> cần). Từ lúc có row trong DB, env var không bao giờ được đọc lại nữa cho instance đó.
> Vẫn không bao giờ lưu plaintext — chỉ đổi *nơi lưu* bcrypt hash, không đổi cách hash.

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