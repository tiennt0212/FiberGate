// Domain types — shapes derived from .context/api/rest-api-spec.md and
// .context/data-dictionary/database-schema.md. UI-only: amounts are the
// display floats returned by the REST API (not raw shannon).

export const ASSETS = {
  CKB: "CKB",
  RUSD: "RUSD",
} as const;
export type Asset = (typeof ASSETS)[keyof typeof ASSETS];

export const INVOICE_STATUSES = {
  PENDING: "pending",
  PAID: "paid",
  EXPIRED: "expired",
  FAILED: "failed",
} as const;
export type InvoiceStatus =
  (typeof INVOICE_STATUSES)[keyof typeof INVOICE_STATUSES];

export interface Invoice {
  id: string;
  invoice_address: string;
  payment_hash: string;
  amount: number;
  asset: Asset;
  status: InvoiceStatus;
  description?: string;
  paid_at?: string | null;
  expires_at: string;
  created_at: string;
}

export interface NodeInfo {
  pubkey: string;
  status: "online" | "offline";
  active_channels: number;
  inbound_capacity_ckb: number;
  outbound_capacity_ckb: number;
}

export const WEBHOOK_EVENTS = {
  PAYMENT_PAID: "payment.paid",
  INVOICE_EXPIRED: "invoice.expired",
  INVOICE_FAILED: "invoice.failed",
} as const;
export type WebhookEvent =
  (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: WebhookEvent[];
  is_active: boolean;
  created_at: string;
}

export const DELIVERY_STATUSES = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
} as const;
export type DeliveryStatus =
  (typeof DELIVERY_STATUSES)[keyof typeof DELIVERY_STATUSES];

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  invoice_id: string;
  event_type: WebhookEvent;
  http_status?: number | null;
  attempt_count: number;
  status: DeliveryStatus;
  delivered_at?: string | null;
  created_at: string;
}
