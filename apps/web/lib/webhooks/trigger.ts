import type { invoices } from "@/lib/db/schema";

// Stub webhook trigger point for issue #7 (background poller). Issue #8
// ("Webhook delivery system: HMAC sign, retry, delivery log") owns the real
// HTTP delivery — looking up webhook_endpoints, HMAC-signing the payload
// (BR-WHK-004), retrying with backoff (BR-WHK-003), and persisting every
// attempt to webhook_deliveries (BR-WHK-005). This file intentionally does
// none of that yet. The poller (lib/poller/invoice-poller.ts) calls
// triggerWebhook() on every transition into a terminal state so the call
// site already exists when #8 lands; only this function's body needs to
// change then. Does not touch the webhook_endpoints/webhook_deliveries
// tables (schema unchanged for this issue).

// Event vocabulary matches .context/data-dictionary/database-schema.md's
// webhook_endpoints.events doc comment ("payment.paid", "invoice.expired",
// "invoice.failed") and .context/api/rest-api-spec.md's "Webhook Payload"
// section — not "payment.expired"/"payment.failed".
export const WebhookEvent = {
  PaymentPaid: "payment.paid",
  InvoiceExpired: "invoice.expired",
  InvoiceFailed: "invoice.failed",
} as const;
export type WebhookEvent = (typeof WebhookEvent)[keyof typeof WebhookEvent];

type InvoiceRow = typeof invoices.$inferSelect;

/**
 * Called by the poller whenever an invoice transitions into a terminal
 * status (paid/expired/failed — BR-WHK-001). No real HTTP call yet.
 *
 * TODO(#8): implement HMAC-signed delivery + retry + webhook_deliveries
 * persistence. Should query webhook_endpoints for endpoints subscribed to
 * `eventType`, POST the signed payload (.context/api/rest-api-spec.md
 * "Webhook Payload"), and record every attempt in webhook_deliveries
 * regardless of outcome (BR-WHK-005).
 */
export async function triggerWebhook(
  invoice: InvoiceRow,
  eventType: WebhookEvent,
): Promise<void> {
  // Logged (not silently swallowed) so the transition is at least observable
  // in this iteration, until #8 replaces this with a real delivery.
  console.log(
    `[webhooks] TODO(#8): would deliver "${eventType}" for invoice ${invoice.id}`,
  );
}
