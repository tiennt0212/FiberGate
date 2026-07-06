---
type: guide
module: webhooks
version: 1.0
last_updated: 2026-07-05
tags: [webhook, hmac, security, signature]
---

# Webhook Signature — HMAC-SHA256 là gì và tại sao dùng nó

Tài liệu này giải thích cơ chế đứng sau `webhook_endpoints.secret` và header
`X-Fiber-Signature` mô tả ở `.context/api/rest-api-spec.md` (mục "Webhook
Payload") và `BR-WHK-004` (`.context/business-rules/payment-rules.md`).
Mục tiêu: người đọc hiểu **tại sao** phải làm vậy, không chỉ copy code verify.

## 1. Vì sao hash thuần (SHA-256) không đủ để "ký"

SHA-256 là hash function một chiều, tất định: `hash(data) → digest`. Nó
**không nhận key** — bất kỳ ai cũng tính được `sha256(payload)` giống hệt
nhau, vì thuật toán là public, không có bí mật nào ở đây cả.

Nếu FiberGate chỉ gửi kèm `sha256(payload)` mà không có secret, một kẻ tấn
công chặn được request có thể:
1. Sửa payload tuỳ ý.
2. Tự tính lại `sha256(payload_đã_sửa)`.
3. Gửi cả hai đến merchant — merchant không có cách nào phát hiện giả mạo.

→ Hash thuần chỉ hữu ích khi bạn *đã tin tưởng sẵn* nguồn của giá trị hash đó
(ví dụ checksum file tải về). Nó không chứng minh được **ai** đã tạo ra
digest, vì không cần bí mật gì để tái tạo nó.

## 2. HMAC "tiêm" key vào đâu

HMAC-SHA256 không phải là "SHA-256 nhận thêm tham số key" — nó là một
construction riêng (RFC 2104) dùng SHA-256 làm building block bên trong,
hash hai lớp:

```
HMAC(K, m) = SHA256( (K' XOR opad) || SHA256( (K' XOR ipad) || m ) )
```

- `K'`: secret key đã pad/hash cho đủ block size (64 bytes với SHA-256).
- `ipad`, `opad`: hai hằng số cố định, khác nhau, dùng để XOR với key.
- `m`: payload cần ký.

Điểm mấu chốt: để tính ra đúng `HMAC(K, m)`, bắt buộc phải biết `K`. Không
biết secret → không thể tái tạo lại giá trị này, dù biết trước cả thuật
toán lẫn `m`. Đây là thứ biến một hash "công khai" thành một cơ chế xác
thực có bí mật.

## 3. Vì sao không đơn giản là `SHA256(secret + payload)`?

SHA-256 thuộc họ Merkle–Damgård, dính lỗ hổng **length-extension attack**:
nếu chỉ nối `secret || payload` rồi hash, kẻ tấn công biết
`H(secret || payload)` (mà **không cần biết** `secret`) vẫn có thể tính ra
`H(secret || payload || padding || extra)` cho một `extra` tuỳ ý — tức là
"nối thêm" dữ liệu vào payload đã ký mà không cần biết secret.

Cấu trúc hai lớp ipad/opad của HMAC được thiết kế riêng để chặn đúng lỗ
hổng này. Đây là lý do phải dùng đúng chuẩn HMAC (`crypto.createHmac` hoặc
tương đương), không tự chế bằng cách nối chuỗi rồi hash.

## 4. Áp dụng vào webhook của FiberGate

- Mỗi endpoint merchant đăng ký có một `webhook_endpoints.secret` riêng
  (random string, lưu encrypted — xem
  `.context/data-dictionary/database-schema.md`).
- FiberGate và merchant **đều biết** cùng secret này.
- Khi gửi webhook (`payment.paid` / `invoice.expired` / `invoice.failed`):
  ```
  signature = HMAC-SHA256(secret, raw_payload_bytes)
  ```
  đính kèm ở header `X-Fiber-Signature: sha256=<hex>` (BR-WHK-004).
- Merchant nhận request, tự tính lại HMAC trên **raw body** nhận được, so
  sánh với signature trong header (xem code mẫu ở
  `.context/api/rest-api-spec.md` mục "Webhook Payload").

Nếu khớp → chứng minh cùng lúc 2 điều:

1. **Integrity** — payload không bị sửa trên đường truyền.
2. **Authenticity** — request thực sự đến từ bên biết `secret` (giả định
   chỉ FiberGate và merchant biết secret đó), chứ không phải ai đó tự bịa
   request giả gửi đến webhook URL của merchant.

## 5. Lưu ý khi implement / verify

- So sánh chữ ký phải dùng **constant-time compare** (không dùng `===`
  thường trên chuỗi) để tránh timing attack — cùng nguyên tắc áp dụng cho
  `FIBERGATE_INTERNAL_SECRET` ở tầng API auth (xem `CLAUDE.md` mục "Auth
  flow cho API routes").
- Phải HMAC trên **raw body** (chuỗi bytes gốc trước khi parse JSON), không
  phải object đã `JSON.stringify` lại — vì thứ tự key/khoảng trắng có thể
  khác nhau giữa lần gửi và lần parse lại, làm signature không khớp dù
  payload logic giống nhau.
- Phần delivery thật sự (HMAC sign + gửi HTTP + retry + ghi
  `webhook_deliveries`) đã implement ở issue #8 (BR-WHK-002/003/004/005):
  `apps/web/lib/webhooks/sign.ts` (HMAC), `apps/web/lib/webhooks/deliver.ts`
  (gửi HTTP + phân loại retryable/non-retryable, BR-WHK-006), và
  `apps/web/lib/webhooks/retry-scheduler.ts` (lên lịch attempt kế tiếp).
  Secret giải mã (`apps/web/lib/webhooks/secret-crypto.ts`) chỉ tồn tại
  trong bộ nhớ ngay tại điểm gọi `signWebhookPayload()`, không log/return ra
  ngoài.

## Tham chiếu

- `.context/business-rules/payment-rules.md` — BR-WHK-001 → BR-WHK-005
- `.context/api/rest-api-spec.md` — mục "Webhook Payload" (payload shape,
  header, code verify mẫu)
- `.context/data-dictionary/database-schema.md` — bảng `webhook_endpoints`,
  `webhook_deliveries`
- `apps/web/lib/webhooks/trigger.ts` — điểm gọi webhook từ poller (dispatch
  không block, insert `webhook_deliveries` + arm attempt đầu tiên)
- `apps/web/lib/webhooks/sign.ts`, `deliver.ts`, `retry-scheduler.ts`,
  `secret-crypto.ts` — HMAC sign, gửi HTTP + retry, mã hoá secret tại rest
  (issue #8)
