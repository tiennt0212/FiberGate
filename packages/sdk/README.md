# @fibergate/sdk

[![npm](https://img.shields.io/npm/v/@fibergate/sdk?color=cb3837&logo=npm)](https://www.npmjs.com/package/@fibergate/sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/tiennt0212/FiberGate/blob/canary/LICENSE)

TypeScript client for [FiberGate](https://github.com/tiennt0212/FiberGate) — a self-hosted merchant
payment gateway for the Fiber Network. It wraps your deployment's invoice and node REST endpoints and
includes a constant-time webhook signature verifier.

FiberGate is single-tenant and self-hosted, so this SDK only ever talks to *your own* deployment's
HTTP API — using the base URL and internal secret you provide. It never calls a FiberGate-operated
service.

📖 Full guide and API reference: **https://tiennt0212.github.io/FiberGate/**

## Install

```bash
npm install @fibergate/sdk
```

## Usage

```typescript
import { FiberGate } from "@fibergate/sdk";

// Points at your own self-hosted FiberGate deployment.
const gateway = new FiberGate({
  baseUrl: process.env.FIBERGATE_BASE_URL!, // e.g. http://<merchant-host>:<port>/api/v1
  internalSecret: process.env.FIBERGATE_INTERNAL_SECRET!,
});

// Create an invoice (server-side).
const invoice = await gateway.invoices.create({ amount: 1, asset: "CKB" });
// invoice.invoice_address -> share with the payer

// Look up a single invoice.
const current = await gateway.invoices.get(invoice.id);

// List invoices, cursor-paginated.
const page = await gateway.invoices.list({ status: "paid", limit: 20 });
// page.invoices, page.next_cursor

// Check node status (public endpoint, no auth required server-side).
const node = await gateway.node.getInfo();

// Verify a webhook in your route handler — `body` MUST be the raw request
// body string, not a re-serialized parsed object.
const isValid = gateway.webhooks.verify(body, signature, secret);
```

`webhooks.verify` is also available as a standalone import if you don't need
a `FiberGate` instance:

```typescript
import { verifyWebhookSignature } from "@fibergate/sdk";

const isValid = verifyWebhookSignature(body, signature, secret);
```

## API

At a glance:

| Call | What it does |
|---|---|
| `gateway.invoices.create(input)` | Create an invoice |
| `gateway.invoices.get(id)` | Fetch one invoice's current status |
| `gateway.invoices.list(query?)` | List invoices (cursor-paginated) |
| `gateway.node.getInfo()` | Get node status (public — no auth needed) |
| `gateway.webhooks.verify(body, signature, secret)` | Verify a webhook signature |

### Creating the client

```ts
new FiberGate({ baseUrl, internalSecret })
```

- **`baseUrl`** — your deployment's API base URL, including the `/api/v1` suffix
  (e.g. `http://localhost:3000/api/v1`). See the full
  [API reference](https://tiennt0212.github.io/FiberGate/api-reference).
- **`internalSecret`** — the shared secret from your deployment's
  `FIBERGATE_INTERNAL_SECRET`. Sent as `Authorization: Bearer <secret>` on every
  request.

The SDK reads neither value from the environment — pass them in from your own app.

### `invoices.create(input)`

```ts
const invoice = await gateway.invoices.create({
  amount: 2.5,                    // 0.1–1000 CKB
  asset: "CKB",                   // "CKB" | "RUSD"
  description: "Order #1234",     // optional
  expires_in: 3600,              // optional, seconds — default 1 hour, max 24 hours
  metadata: { orderId: "1234" },  // optional, echoed back on webhooks
});
```

Returns the created `Invoice`. Share `invoice.invoice_address` with the payer;
`paid_at` is absent until it's paid.

### `invoices.get(id)`

```ts
const invoice = await gateway.invoices.get(id);
```

Returns the invoice's current state, or throws `FiberGateApiError` with
`code: "NOT_FOUND"` if it doesn't exist.

### `invoices.list(query?)`

```ts
const page = await gateway.invoices.list({
  status: "paid",   // optional filter: pending | paid | expired | failed
  asset: "CKB",     // optional filter: CKB | RUSD
  limit: 20,        // optional
  cursor: "…",      // optional — a previous page's next_cursor
});
// → { invoices: Invoice[], limit: number, next_cursor: string | null }
```

Cursor-paginated: keep calling with the returned `next_cursor` until it's `null`.

### `node.getInfo()`

```ts
const node = await gateway.node.getInfo();
// → { pubkey, active_channels, inbound_capacity_ckb, outbound_capacity_ckb, status: "online" }
```

A public endpoint — it works even without a valid `internalSecret`.

### `webhooks.verify(body, signature, secret)`

Also available as a standalone `verifyWebhookSignature(body, signature, secret)`.

```ts
const isValid = gateway.webhooks.verify(rawBody, signatureHeader, secret);
```

Verifies a `payment.paid` / `invoice.expired` / `invoice.failed` webhook's
`X-Fiber-Signature` header (`sha256=<hmac-sha256-hex>`) with a constant-time
comparison (`crypto.timingSafeEqual`).

- **`body`** — the raw request body string, exactly as received. Not a
  `JSON.stringify()` of an already-parsed object.
- **`signature`** — the full header value, including the `sha256=` prefix.
- **Returns** `true` or `false` — never throws, even for a malformed signature.

### The `Invoice` shape

```ts
interface Invoice {
  id: string;
  invoice_address: string;   // the string the payer pays
  payment_hash: string;
  amount: number;
  asset: "CKB" | "RUSD";
  status: "pending" | "paid" | "expired" | "failed";
  paid_at?: string | null;   // absent on create; nullable on get/list
  expires_at: string;
  created_at: string;
}
```

## Errors

Failed requests reject with a `FiberGateApiError`, exposing `code`, `message`,
and the HTTP `status`:

```ts
import { FiberGateApiError } from "@fibergate/sdk";

try {
  await gateway.invoices.get("not-a-real-id");
} catch (error) {
  if (error instanceof FiberGateApiError && error.code === "NOT_FOUND") {
    // handle missing invoice
  }
}
```

Possible `code` values (also exported as the `FiberGateErrorCode` const):

| Code | Meaning |
|---|---|
| `INVALID_AMOUNT` | Amount is outside the 0.1–1000 CKB range |
| `UNSUPPORTED_ASSET` | `asset` isn't `CKB` or `RUSD` |
| `ASSET_NOT_CONFIGURED` | Asset is valid but not set up on this node (e.g. RUSD) |
| `UNAUTHORIZED` | Missing or wrong `internalSecret` |
| `RATE_LIMITED` | Too many requests |
| `NODE_UNAVAILABLE` | The Fiber node isn't reachable |
| `NOT_FOUND` | No such invoice |
| `VALIDATION_ERROR` | Malformed request body |
| `INTERNAL_ERROR` | Unexpected server error |

## Requirements

- Node.js 18+ (or any environment with a global `fetch` and `node:crypto`),
  or a browser bundler that polyfills both — the SDK adds no runtime
  dependencies beyond Node builtins.

## Development

```bash
pnpm --filter sdk build       # ESM+CJS via tsup -> dist/
pnpm --filter sdk typecheck   # tsc --noEmit, strict mode
pnpm --filter sdk test:unit   # vitest run
```

`webhooks.test.ts` covers `verify()`'s signature-matching edge cases (wrong
secret, tampered body, missing `sha256=` prefix, malformed/short signature —
all must return `false`, never throw). `client.test.ts` mocks the global
`fetch` to cover request shaping (headers, body, query string, URL encoding)
and `FiberGateApiError` mapping for `invoices.*`/`node.getInfo()`.
