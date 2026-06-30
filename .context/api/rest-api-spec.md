---
type: api_specification
version: 1.0
last_updated: 2026-06-30
tags: [rest-api, endpoints, authentication]
---

# REST API Specification — FiberGate

## Base URL
`https://fibergate.vercel.app/api/v1`

## Authentication

Tất cả endpoints dùng Bearer token:

```
Authorization: Bearer sk_test_xxxxxxxxxxxxxxxx
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
- `401 UNAUTHORIZED` — api_secret không hợp lệ
- `503 NODE_UNAVAILABLE` — Fiber node không phản hồi

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

Header: `X-Fiber-Signature: sha256=hmac_hex`

Merchant verify:
```typescript
import crypto from 'crypto'
const expected = crypto.createHmac('sha256', webhookSecret)
  .update(rawBody).digest('hex')
const isValid = `sha256=${expected}` === signature
```