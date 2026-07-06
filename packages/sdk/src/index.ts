// Public entry point for @fibergate/sdk (US-002). Re-exports the FiberGate
// client, the standalone webhooks helper, and every public type — no
// internal-only helpers (e.g. buildListInvoicesQueryString) are exported.

export const SDK_VERSION = "0.1.0";

export { FiberGate, FiberGateApiError } from "./client";
export type { FiberGateOptions } from "./client";

export { webhooks, verifyWebhookSignature } from "./webhooks";

// InvoiceAsset/InvoiceStatus/FiberGateErrorCode are each both a value (the
// object-as-namespace, e.g. InvoiceAsset.CKB) and a derived type (e.g.
// `asset: InvoiceAsset`) declared under the same name in types.ts — a plain
// (non type-only) re-export here forwards both bindings at once.
export { InvoiceAsset, INVOICE_ASSETS, InvoiceStatus, INVOICE_STATUSES, FiberGateErrorCode } from "./types";

export type {
  ApiResponse,
  ApiSuccessBody,
  ApiErrorBody,
  Invoice,
  CreateInvoiceInput,
  ListInvoicesQuery,
  ListInvoicesResult,
  NodeInfo,
} from "./types";
