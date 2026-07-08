// Plain event-name vocabulary, split out of trigger.ts. trigger.ts pulls in
// @/lib/db (a live postgres connection) and, transitively via
// retry-scheduler.ts -> deliver.ts, node:crypto — both server-only. Any
// client component that only needs the WebhookEvent string values (e.g. the
// Webhooks page's Add Endpoint drawer) must import from this file instead,
// or webpack tries to bundle node:crypto/postgres for the browser and fails
// the build ("Module not found: Can't resolve 'net'/'tls'/'fs'", etc.).
//
// Event vocabulary matches .context/data-dictionary/database-schema.md's
// webhook_endpoints.events doc comment and .context/api/rest-api-spec.md's
// "Webhook Payload" section.
export const WebhookEvent = {
  PaymentPaid: "payment.paid",
  InvoiceExpired: "invoice.expired",
  InvoiceFailed: "invoice.failed",
} as const;
export type WebhookEvent = (typeof WebhookEvent)[keyof typeof WebhookEvent];
