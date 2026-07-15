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

### `new FiberGate({ baseUrl, internalSecret })`

- `baseUrl` — your FiberGate deployment's API base URL, including the `/api/v1`
  suffix, e.g. `http://localhost:3000/api/v1` (see the
  [API reference](https://tiennt0212.github.io/FiberGate/api-reference)).
- `internalSecret` — the shared secret set via `FIBERGATE_INTERNAL_SECRET` on
  your deployment. Sent as `Authorization: Bearer <internalSecret>` on every
  request.

Neither value is read from an environment variable by the SDK itself — pass
them in from your own app's env, as shown above.

### `gateway.invoices.create(input)`

`input: { amount: number; asset: "CKB" | "RUSD"; description?: string; expires_in?: number; metadata?: Record<string, unknown> }`

Returns the created `Invoice` (`paid_at` omitted — always unpaid at creation).

### `gateway.invoices.get(id)`

Returns the current `Invoice` (`paid_at` present, nullable), or throws
`FiberGateApiError` with `code: "NOT_FOUND"` if no such invoice exists.

### `gateway.invoices.list(query?)`

`query: { status?: "pending" | "paid" | "expired" | "failed"; asset?: "CKB" | "RUSD"; limit?: number; cursor?: string }`

Returns `{ invoices: Invoice[]; limit: number; next_cursor: string | null }`.

### `gateway.node.getInfo()`

Returns `{ pubkey, active_channels, inbound_capacity_ckb, outbound_capacity_ckb, status: "online" }`.
Public endpoint — succeeds even with an invalid/omitted `internalSecret`.

### `gateway.webhooks.verify(body, signature, secret)` / `verifyWebhookSignature(body, signature, secret)`

Verifies a `payment.paid` / `invoice.expired` / `invoice.failed` webhook's
`X-Fiber-Signature` header (`sha256=<hmac-sha256-hex>`) using a constant-time
comparison (`crypto.timingSafeEqual`).

- `body` must be the **raw** JSON string exactly as received — not a
  `JSON.stringify()` of an already-parsed object.
- `signature` is the full header value, including the `sha256=` prefix.
- Returns `false` (never throws) for a malformed or mismatched signature.

## Errors

Failed requests reject with `FiberGateApiError`, exposing:

- `code` — one of `INVALID_AMOUNT`, `UNSUPPORTED_ASSET`, `UNAUTHORIZED`,
  `RATE_LIMITED`, `NODE_UNAVAILABLE`, `NOT_FOUND`, `VALIDATION_ERROR`,
  `INTERNAL_ERROR` (also exported as the `FiberGateErrorCode` const).
- `message` — human-readable error message from the API.
- `status` — the HTTP status code of the response.

```typescript
import { FiberGateApiError } from "@fibergate/sdk";

try {
  await gateway.invoices.get("not-a-real-id");
} catch (error) {
  if (error instanceof FiberGateApiError && error.code === "NOT_FOUND") {
    // handle missing invoice
  }
}
```

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
