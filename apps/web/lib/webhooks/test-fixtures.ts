import type { WebhookDeliveryRow, WebhookEndpointRow } from "@/lib/db/schema";

export function buildWebhookEndpointRow(overrides: Partial<WebhookEndpointRow> = {}): WebhookEndpointRow {
  return {
    id: "endpoint-1",
    url: "https://merchant.example.com/webhooks",
    secret: "encrypted-secret-value",
    events: ["payment.paid", "invoice.expired", "invoice.failed"],
    isActive: true,
    createdAt: new Date("2026-07-01T10:00:00Z"),
    ...overrides,
  };
}

export function buildWebhookDeliveryRow(overrides: Partial<WebhookDeliveryRow> = {}): WebhookDeliveryRow {
  return {
    id: "delivery-1",
    endpointId: "endpoint-1",
    invoiceId: "inv-1",
    eventType: "payment.paid",
    payload: { event: "payment.paid", created_at: "2026-07-01T11:05:00.000Z", data: { invoice_id: "inv-1" } },
    httpStatus: null,
    responseBody: null,
    attemptCount: 0,
    status: "pending",
    nextRetryAt: null,
    deliveredAt: null,
    createdAt: new Date("2026-07-01T11:05:00Z"),
    ...overrides,
  };
}
