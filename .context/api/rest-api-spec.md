---
type: api_specification
version: 1.2
last_updated: 2026-07-09
tags: [rest-api, endpoints, authentication]
---

# REST API Specification — FiberGate

## Base URL
`http://<merchant-host>:<port>/api/v1` — self-hosted, merchant tự đặt host/port lúc deploy docker-compose.

## Authentication

Single-tenant: tất cả endpoints dùng 1 shared secret duy nhất (`FIBERGATE_INTERNAL_SECRET`,
đặt qua env var lúc deploy), so sánh constant-time, không phân biệt theo client:

```
Authorization: Bearer <FIBERGATE_INTERNAL_SECRET>
```
## Response Format

Luôn trả về JSON với format:
```typescript
// Success
{ data: T, error: null, meta?: { ... } }

// Error
{ data: null, error: { code: string, message: string } }
```

## Endpoints

### POST /invoices
Tạo invoice mới.

**Request:**
```json
{
  "amount": 1.5,          // số CKB hoặc RUSD (float)
  "asset": "CKB",         // "CKB" | "RUSD"
  "description": "Order #123",  // optional
  "expires_in": 3600,     // seconds, default 3600, max 86400
  "metadata": {}          // optional, lưu lại bất kỳ data gì
}
```

**Response 201:**
```json
{
  "data": {
    "id": "inv_uuid",
    "invoice_address": "fibt1...",
    "payment_hash": "0xabc...",
    "amount": 1.5,
    "asset": "CKB",
    "status": "pending",
    "expires_at": "2026-07-01T12:00:00Z",
    "created_at": "2026-07-01T11:00:00Z"
  },
  "error": null
}
```

**Errors:**
- `400 INVALID_AMOUNT` — amount <= 0 hoặc quá lớn
- `400 UNSUPPORTED_ASSET` — asset không phải CKB hoặc RUSD
- `401 UNAUTHORIZED` — token không khớp `FIBERGATE_INTERNAL_SECRET`
- `429 RATE_LIMITED` — vượt quá 100 invoice/phút trên toàn bộ deployment (BR-RTE-001)
- `503 NODE_UNAVAILABLE` — Fiber node không phản hồi
- `503 ASSET_NOT_CONFIGURED` — asset hợp lệ (CKB/RUSD) nhưng node hiện tại chưa whitelist
  UDT này trong `docker/fiber-node/config.yml`'s `ckb.udt_whitelist` — khác
  `NODE_UNAVAILABLE`: retry không giúp được gì, cần merchant tự sửa config node
  (issue #27)

---

### GET /invoices/:id
Lấy trạng thái invoice.

**Response 200:**
```json
{
  "data": {
    "id": "inv_uuid",
    "invoice_address": "fibt1...",
    "payment_hash": "0xabc...",
    "amount": 1.5,
    "asset": "CKB",
    "status": "paid",      // pending | paid | expired | failed
    "paid_at": "2026-07-01T11:05:00Z",
    "expires_at": "2026-07-01T12:00:00Z",
    "created_at": "2026-07-01T11:00:00Z"
  },
  "error": null
}
```

**Errors:**
- `401 UNAUTHORIZED` — token không khớp `FIBERGATE_INTERNAL_SECRET`
- `404 NOT_FOUND` — không tìm thấy invoice với `id` tương ứng

---

### GET /invoices
List invoices có phân trang.

**Query params:** `status`, `asset`, `limit` (default 20, max 100), `cursor`

---

### GET /node/info
Thông tin node hiện tại (public).

**Response 200:**
```json
{
  "data": {
    "pubkey": "02...",
    "active_channels": 3,
    "inbound_capacity_ckb": 800,
    "outbound_capacity_ckb": 400,
    "status": "online"
  },
  "error": null
}
```

---

### POST /api/cron/poll-invoices
Không nằm dưới `/api/v1` (base URL ở trên không áp dụng — path đầy đủ là
`http://<merchant-host>:<port>/api/cron/poll-invoices`). Optional endpoint để trigger
thủ công 1 chu kỳ poll invoice (nguồn chính vẫn là in-process interval worker chạy mỗi
10s trong container `fibergate-core`, BR-POL-001) — dùng khi cần force-check ngay thay
vì đợi tối đa 10s. Cùng logic `runPollCycle()` với worker: bulk-expire các invoice đã
hết hạn theo đồng hồ (BR-STS-002b), sau đó poll batch `pending` còn lại qua Fiber node
(BR-POL-002/003/004), cập nhật status và trigger webhook khi chuyển sang terminal state.

**Auth:** `Authorization: Bearer <CRON_SECRET>` — secret riêng, **không** dùng
`FIBERGATE_INTERNAL_SECRET`. Nếu `CRON_SECRET` không được cấu hình (env var optional
theo `system-design.md`), endpoint coi như bị tắt hoàn toàn và trả `503` trước khi kiểm
tra token.

**Response 200:**
```json
{
  "data": { "triggered": true },
  "error": null
}
```

**Errors:**
- `401 UNAUTHORIZED` — token không khớp `CRON_SECRET`
- `503 CRON_NOT_CONFIGURED` — `CRON_SECRET` chưa được set, endpoint bị tắt
- `500 INTERNAL_ERROR` — poll cycle lỗi ngoài dự kiến (không phải Fiber node timeout —
  timeout từng invoice được skip riêng lẻ theo BR-POL-004, không làm fail cả request)

---

## Webhook Payload

Khi invoice paid, POST đến merchant endpoint:
```json
{
  "event": "payment.paid",
  "created_at": "2026-07-01T11:05:00Z",
  "data": {
    "invoice_id": "inv_uuid",
    "payment_hash": "0xabc...",
    "amount": 1.5,
    "asset": "CKB",
    "paid_at": "2026-07-01T11:05:00Z",
    "metadata": {}
  }
}
```

Khi invoice expired (cùng `data{}` field set như `payment.paid`, `paid_at` luôn là `null` vì
invoice chưa từng được trả — bổ sung 2026-07-06, issue #8):
```json
{
  "event": "invoice.expired",
  "created_at": "2026-07-01T13:00:00Z",
  "data": {
    "invoice_id": "inv_uuid",
    "payment_hash": "0xabc...",
    "amount": 1.5,
    "asset": "CKB",
    "paid_at": null,
    "metadata": {}
  }
}
```

Khi invoice failed (Fiber node báo cancelled — BR-STS-003; cùng `data{}` field set, `paid_at`
cũng luôn `null`):
```json
{
  "event": "invoice.failed",
  "created_at": "2026-07-01T12:30:00Z",
  "data": {
    "invoice_id": "inv_uuid",
    "payment_hash": "0xabc...",
    "amount": 1.5,
    "asset": "CKB",
    "paid_at": null,
    "metadata": {}
  }
}
```

Header: `X-Fiber-Signature: sha256=hmac_hex`

Merchant verify:
```typescript
import crypto from 'crypto'
const expected = crypto.createHmac('sha256', webhookSecret)
  .update(rawBody).digest('hex')
const isValid = `sha256=${expected}` === signature
```