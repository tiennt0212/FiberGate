export type Asset = "CKB" | "RUSD";

export type InvoiceStatus = "pending" | "paid" | "expired" | "failed";

export type WebhookEvent = "payment.paid" | "invoice.expired" | "invoice.failed";

export interface Invoice {
  id: string;
  invoice_address: string;
  payment_hash: string;
  amount: number;
  asset: Asset;
  status: InvoiceStatus;
  description?: string | null;
  paid_at?: string | null;
  expires_at: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

export interface CreateInvoiceParams {
  /** Amount in whole CKB / RUSD units (e.g. 1.5). */
  amount: number;
  asset: Asset;
  description?: string;
  /** Seconds until the invoice expires. Default 3600, max 86400. */
  expires_in?: number;
  metadata?: Record<string, unknown>;
}

export interface ListInvoicesParams {
  status?: InvoiceStatus;
  asset?: Asset;
  limit?: number;
  cursor?: string;
}

export interface NodeInfo {
  pubkey: string;
  active_channels: number;
  inbound_capacity_ckb: number;
  outbound_capacity_ckb: number;
  status: "online" | "offline";
}

export interface ApiMeta {
  next_cursor?: string | null;
  count?: number;
}

/** Envelope returned by every FiberGate endpoint. */
export interface ApiSuccess<T> {
  data: T;
  error: null;
  meta?: ApiMeta;
}

export interface ApiError {
  data: null;
  error: { code: string; message: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Payload delivered to a merchant webhook endpoint. */
export interface WebhookPayload {
  event: WebhookEvent;
  created_at: string;
  data: {
    invoice_id: string;
    payment_hash: string;
    amount: number;
    asset: Asset;
    paid_at?: string | null;
    metadata?: Record<string, unknown> | null;
  };
}

export interface FiberGateConfig {
  /** Base URL of your self-hosted FiberGate core, e.g. http://localhost:3000 */
  baseUrl: string;
  /** Shared secret matching FIBERGATE_INTERNAL_SECRET on the gateway. */
  internalSecret: string;
  /** Optional override for the underlying fetch (tests, custom agents). */
  fetch?: typeof fetch;
  /** Request timeout in ms. Default 10000. */
  timeoutMs?: number;
}
