// Public types for @fibergate/sdk.
//
// This package is a standalone publishable unit and must not import from
// apps/web/* (that's a private app, not a workspace dependency of the SDK —
// see CLAUDE.md "packages/sdk must not import from apps/web/*"). Every shape
// below is hand-written to mirror the live wire format documented in
// .context/api/rest-api-spec.md and implemented by:
//   - apps/web/lib/api/response.ts       (ApiResponse envelope)
//   - apps/web/lib/api/serialize-invoice.ts (Invoice field names/casing)
//   - apps/web/lib/services/node.ts      (NodeInfo shape)
//   - apps/web/lib/api/validation.ts     (asset/status enums, list query, error codes)
// If the server-side shape changes, update both sides by hand — there is no
// shared import to keep them in sync automatically.

/** `{ data: T, error: null, meta?: {...} }` — every successful /api/v1/* response. */
export interface ApiSuccessBody<T> {
  data: T;
  error: null;
  meta?: Record<string, unknown>;
}

/** `{ data: null, error: { code, message } }` — every failed /api/v1/* response. */
export interface ApiErrorBody {
  data: null;
  error: {
    code: string;
    message: string;
  };
}

/** Discriminated union matching CLAUDE.md's "Response format" for every /api/v1/* route. */
export type ApiResponse<T> = ApiSuccessBody<T> | ApiErrorBody;

// Invoice asset ---------------------------------------------------------------

/** Object-as-namespace so call sites compare against named keys (InvoiceAsset.CKB). */
export const InvoiceAsset = {
  CKB: "CKB",
  RUSD: "RUSD",
} as const;
export type InvoiceAsset = (typeof InvoiceAsset)[keyof typeof InvoiceAsset];
export const INVOICE_ASSETS = Object.values(InvoiceAsset) as InvoiceAsset[];

// Invoice status ----------------------------------------------------------------

export const InvoiceStatus = {
  Pending: "pending",
  Paid: "paid",
  Expired: "expired",
  Failed: "failed",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];
export const INVOICE_STATUSES = Object.values(InvoiceStatus) as InvoiceStatus[];

// Error codes ---------------------------------------------------------------------
//
// Full set actually emitted server-side (apps/web/lib/api/validation.ts,
// apps/web/lib/api/response.ts, and every route.ts's err() calls) — a
// superset of .context/api/rest-api-spec.md's prose list, which omits
// VALIDATION_ERROR/INTERNAL_ERROR.

export const FiberGateErrorCode = {
  InvalidAmount: "INVALID_AMOUNT",
  UnsupportedAsset: "UNSUPPORTED_ASSET",
  Unauthorized: "UNAUTHORIZED",
  RateLimited: "RATE_LIMITED",
  NodeUnavailable: "NODE_UNAVAILABLE",
  NotFound: "NOT_FOUND",
  ValidationError: "VALIDATION_ERROR",
  InternalError: "INTERNAL_ERROR",
} as const;
export type FiberGateErrorCode = (typeof FiberGateErrorCode)[keyof typeof FiberGateErrorCode];

// Invoice -------------------------------------------------------------------------

/**
 * Matches apps/web/lib/api/serialize-invoice.ts's field list exactly.
 * `paid_at` is omitted from the POST /invoices (create) response and present
 * (nullable) on GET /invoices and GET /invoices/:id — modeled as optional
 * here since a `Invoice` value from `invoices.create()` won't have the key
 * at all, not just `undefined`.
 */
export interface Invoice {
  id: string;
  invoice_address: string;
  payment_hash: string;
  amount: number;
  asset: InvoiceAsset;
  status: InvoiceStatus;
  paid_at?: string | null;
  expires_at: string;
  created_at: string;
}

/** Body for `invoices.create()` — matches POST /invoices's JSON request body. */
export interface CreateInvoiceInput {
  amount: number;
  asset: InvoiceAsset;
  description?: string;
  expires_in?: number;
  metadata?: Record<string, unknown>;
}

/** Query filters for `invoices.list()` — matches ListInvoicesQuery in apps/web/lib/api/validation.ts. */
export interface ListInvoicesQuery {
  status?: InvoiceStatus;
  asset?: InvoiceAsset;
  limit?: number;
  cursor?: string;
}

/**
 * `invoices.list()`'s return shape. GET /invoices returns the page as `data`
 * (a bare array) plus `meta: { limit, next_cursor }` — this flattens both
 * into one object so callers don't have to reach into a separate `meta`
 * field for cursor pagination.
 */
export interface ListInvoicesResult {
  invoices: Invoice[];
  limit: number;
  next_cursor: string | null;
}

// Node info -----------------------------------------------------------------------

/**
 * Matches apps/web/lib/services/node.ts's NodeStatusResult. `status` is
 * typed as the literal "online" (not a speculative "online" | "offline"
 * union) because the current server implementation only ever returns
 * "online" — an unavailable node returns an HTTP error (503
 * NODE_UNAVAILABLE) instead of a `status: "offline"` value.
 */
export interface NodeInfo {
  pubkey: string;
  active_channels: number;
  inbound_capacity_ckb: number;
  outbound_capacity_ckb: number;
  status: "online";
}
