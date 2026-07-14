# API Reference

## Base URL

`http://<merchant-host>:<port>/api/v1` — self-hosted, so the host/port is whatever
you set when deploying (see [Quickstart](/merchants/quickstart)).

## Authentication

Single-tenant: every endpoint uses one shared secret
(`FIBERGATE_INTERNAL_SECRET`, set as an environment variable at deploy time),
compared in constant time. There's no per-client API key system — whatever app you
give this secret to can call the full API on your behalf.

```
Authorization: Bearer <FIBERGATE_INTERNAL_SECRET>
```

## Response Format

Every response is JSON, in one of these two shapes:

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
  "amount": 1.5,
  "asset": "CKB",
  "description": "Order #123",
  "expires_in": 3600,
  "metadata": {}
}
```

- `amount` — number of CKB or RUSD (float)
- `asset` — `"CKB"` or `"RUSD"`
- `description` — optional
- `expires_in` — seconds, default `3600`, max `86400`
- `metadata` — optional, stores any object you want alongside the invoice

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

- `400 INVALID_AMOUNT` — amount is `<= 0` or unreasonably large
- `400 UNSUPPORTED_ASSET` — asset isn't `CKB` or `RUSD`
- `401 UNAUTHORIZED` — token doesn't match `FIBERGATE_INTERNAL_SECRET`
- `429 RATE_LIMITED` — exceeded 100 invoices/minute across the whole deployment
- `503 NODE_UNAVAILABLE` — the Fiber node isn't responding
- `503 ASSET_NOT_CONFIGURED` — the asset is valid (CKB/RUSD) but the node hasn't
  whitelisted this UDT yet — unlike `NODE_UNAVAILABLE`, retrying won't help; the
  merchant needs to fix the node's config

---

### GET /invoices/:id

Get an invoice's current status.

**Response 200:**

```json
{
  "data": {
    "id": "inv_uuid",
    "invoice_address": "fibt1...",
    "payment_hash": "0xabc...",
    "amount": 1.5,
    "asset": "CKB",
    "status": "paid",
    "paid_at": "2026-07-01T11:05:00Z",
    "expires_at": "2026-07-01T12:00:00Z",
    "created_at": "2026-07-01T11:00:00Z"
  },
  "error": null
}
```

`status` is one of `pending`, `paid`, `expired`, `failed` — see
[Architecture](/architecture)'s "Invoice status lifecycle" for how these transitions
work.

**Errors:**

- `401 UNAUTHORIZED` — token doesn't match `FIBERGATE_INTERNAL_SECRET`
- `404 NOT_FOUND` — no invoice with that `id`

---

### GET /invoices

List invoices, paginated.

**Query params:** `status`, `asset`, `limit` (default `20`, max `100`), `cursor`

---

### GET /node/info

Current Fiber node status (this endpoint is public — no auth required).

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

`status` is `"online"` (every channel active) or `"degraded"` (the RPC call
succeeded, but some channels are disabled). There's no `"offline"` value here — if
the node truly isn't responding, this endpoint returns `503 NODE_UNAVAILABLE`
instead of a `200` with a status field saying so.

---

### POST /api/cron/poll-invoices

Not under `/api/v1` — the full path is
`http://<merchant-host>:<port>/api/cron/poll-invoices`. An optional endpoint to
manually trigger one invoice-poll cycle (the primary mechanism is an in-process
background job that already runs continuously — this endpoint is only useful when
you want to force a check right now instead of waiting).

**Auth:** `Authorization: Bearer <CRON_SECRET>` — a separate secret, **not**
`FIBERGATE_INTERNAL_SECRET`. If `CRON_SECRET` isn't configured, this endpoint is
disabled entirely and returns `503` before even checking the token.

**Response 200:**

```json
{
  "data": { "triggered": true },
  "error": null
}
```

**Errors:**

- `401 UNAUTHORIZED` — token doesn't match `CRON_SECRET`
- `503 CRON_NOT_CONFIGURED` — `CRON_SECRET` isn't set, endpoint is disabled
- `500 INTERNAL_ERROR` — the poll cycle hit an unexpected error (a single slow/failed
  Fiber node call for one invoice doesn't fail the whole request — only unexpected
  errors do)

## Webhook Payload

When an invoice is paid, FiberGate `POST`s this to your registered endpoint:

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

When an invoice expires (same `data` shape, `paid_at` is always `null` since it was
never paid):

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

Every request includes an `X-Fiber-Signature: sha256=<hex>` header — an
HMAC-SHA256 of the raw request body, signed with the secret you were given when you
registered the webhook endpoint. Verify it before trusting the payload (the
`@fibergate/sdk` package provides a `verifyWebhookSignature()` helper for this).
