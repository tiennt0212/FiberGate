---
type: api_specification
version: 1.2
last_updated: 2026-07-09
tags: [rest-api, endpoints, authentication]
---

# REST API Specification — FiberGate

> Public version (VitePress): `docs/api-reference.md`. If you edit one of the two files,
> check the other one in the same edit (see `.context/INDEX.md`'s "Public docs mirror").

## Base URL
`http://<merchant-host>:<port>/api/v1` — self-hosted; the merchant sets their own host/port when deploying docker-compose.

## Authentication

Single-tenant: all endpoints use a single shared secret (`FIBERGATE_INTERNAL_SECRET`,
set via an env var at deploy time), compared in constant time, with no per-client distinction:

```
Authorization: Bearer <FIBERGATE_INTERNAL_SECRET>
```
## Response Format

Always returns JSON in this format:
```typescript
// Success
{ data: T, error: null, meta?: { ... } }

// Error
{ data: null, error: { code: string, message: string } }
```

## Endpoints

### POST /invoices
Create a new invoice.

**Request:**
```json
{
  "amount": 1.5,          // amount in CKB or RUSD (float)
  "asset": "CKB",         // "CKB" | "RUSD"
  "description": "Order #123",  // optional
  "expires_in": 3600,     // seconds, default 3600, max 86400
  "metadata": {}          // optional, stores arbitrary data
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
- `400 INVALID_AMOUNT` — amount <= 0 or too large
- `400 UNSUPPORTED_ASSET` — asset is not CKB or RUSD
- `401 UNAUTHORIZED` — token doesn't match `FIBERGATE_INTERNAL_SECRET`
- `429 RATE_LIMITED` — exceeds 100 invoices/minute across the whole deployment (BR-RTE-001)
- `503 NODE_UNAVAILABLE` — the Fiber node isn't responding
- `503 ASSET_NOT_CONFIGURED` — a valid asset (CKB/RUSD) but the node hasn't whitelisted
  this UDT in `docker/fiber-node/config.yml`'s `ckb.udt_whitelist` — unlike
  `NODE_UNAVAILABLE`: retrying won't help, the merchant needs to fix the node config
  themselves (issue #27)

---

### GET /invoices/:id
Get an invoice's status.

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
- `401 UNAUTHORIZED` — token doesn't match `FIBERGATE_INTERNAL_SECRET`
- `404 NOT_FOUND` — no invoice found with the given `id`

---

### GET /invoices
Paginated invoice listing.

**Query params:** `status`, `asset`, `limit` (default 20, max 100), `cursor`

---

### GET /node/info
Current node information (public).

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

`status` is either `"online"` (every channel active) or `"degraded"` (RPC succeeded but
`active_channels < total_channels` — some channel is disabled, issue #40). There's no
`"offline"` value here — if the node can't be reached, the endpoint returns a
`503 NODE_UNAVAILABLE` error (see Errors below) instead of `200` with `status: "offline"`.

---

### POST /api/cron/poll-invoices
Not under `/api/v1` (the base URL above doesn't apply — the full path is
`http://<merchant-host>:<port>/api/cron/poll-invoices`). An optional endpoint to
manually trigger one invoice poll cycle (the primary source is still the in-process
interval worker running every 10s inside the `fibergate-core` container, BR-POL-001) —
used when you need to force-check immediately instead of waiting up to 10s. Uses the
same `runPollCycle()` logic as the worker: bulk-expires invoices past their clock-based
deadline (BR-STS-002b), then polls the remaining `pending` batch via the Fiber node
(BR-POL-002/003/004), updating status and triggering webhooks on transition to a
terminal state.

**Auth:** `Authorization: Bearer <CRON_SECRET>` — a separate secret, **not**
`FIBERGATE_INTERNAL_SECRET`. If `CRON_SECRET` isn't configured (an optional env var per
`system-design.md`), the endpoint is treated as fully disabled and returns `503` before
even checking the token.

**Response 200:**
```json
{
  "data": { "triggered": true },
  "error": null
}
```

**Errors:**
- `401 UNAUTHORIZED` — token doesn't match `CRON_SECRET`
- `503 CRON_NOT_CONFIGURED` — `CRON_SECRET` hasn't been set, the endpoint is disabled
- `500 INTERNAL_ERROR` — an unexpected poll cycle error (not a Fiber node timeout —
  per-invoice timeouts are skipped individually per BR-POL-004 and don't fail the whole request)

---

## Webhook Payload

When an invoice is paid, POST to the merchant's endpoint:
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

When an invoice expires (same `data{}` field set as `payment.paid`, `paid_at` is always
`null` since the invoice was never paid — added 2026-07-06, issue #8):
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

When an invoice fails (Fiber node reports cancelled — BR-STS-003; same `data{}` field set,
`paid_at` is also always `null`):
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

Merchant verification:
```typescript
import crypto from 'crypto'
const expected = crypto.createHmac('sha256', webhookSecret)
  .update(rawBody).digest('hex')
const isValid = `sha256=${expected}` === signature
```