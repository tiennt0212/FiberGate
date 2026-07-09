import { eq } from "drizzle-orm";

import { SHANNON_PER_CKB } from "@/lib/api/validation";
import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import type { InvoiceRow } from "@/lib/db/schema";
import { webhookDeliveries, webhookEndpoints } from "@/lib/db/schema";

import { WebhookEvent } from "./events";
import { scheduleAttempt } from "./retry-scheduler";

// Real dispatch entrypoint for issue #8 ("Webhook delivery system: HMAC
// sign, retry, delivery log"). Called by lib/poller/invoice-poller.ts on
// every transition into a terminal state (paid/expired/failed, BR-WHK-001) —
// this file's exported signature and the WebhookEvent enum are unchanged
// from the #7 stub so that call site needed no edits.
//
// Per Resolved Decision #3, this function is non-blocking dispatch: it only
// awaits (a) looking up matching active webhook_endpoints and (b) inserting
// one webhook_deliveries row per matching endpoint — the actual HTTP send
// (lib/webhooks/deliver.ts, via scheduleAttempt()) is armed but never
// awaited here, so a slow/unresponsive merchant endpoint cannot extend
// invoice-poller.ts's per-invoice cost.

// Re-exported from ./events (issue #10) so every existing import site
// (lib/poller/invoice-poller.ts, lib/services/webhooks.ts, this file's own
// test) keeps working unchanged — only the definition moved, to a module
// client components can import without pulling in @/lib/db/node:crypto.
// A single `import { WebhookEvent }` above already merges both the const
// value and its same-named type, so re-exporting it here carries both.
export { WebhookEvent };

interface WebhookPayload {
  event: WebhookEvent;
  created_at: string;
  data: {
    invoice_id: string;
    payment_hash: string;
    amount: number;
    asset: string;
    paid_at: string | null;
    metadata: unknown;
  };
}

/**
 * Payload shape matches .context/api/rest-api-spec.md's "Webhook Payload"
 * section for all three terminal events (Resolved Decision #5: same
 * `data{}` field set for invoice.expired/invoice.failed as payment.paid,
 * with `paid_at: null`). `amount` is the inverse of BR-INV-004
 * (amountShannon / SHANNON_PER_CKB) converting back to a float.
 */
function buildWebhookPayload(invoice: InvoiceRow, eventType: WebhookEvent): WebhookPayload {
  return {
    event: eventType,
    created_at: new Date().toISOString(),
    data: {
      invoice_id: invoice.id,
      payment_hash: invoice.paymentHash,
      amount: Number(invoice.amountShannon) / SHANNON_PER_CKB,
      asset: invoice.asset,
      paid_at: eventType === WebhookEvent.PaymentPaid ? invoice.paidAt?.toISOString() ?? null : null,
      metadata: invoice.metadata,
    },
  };
}

/**
 * Called by the poller whenever an invoice transitions into a terminal
 * status (paid/expired/failed — BR-WHK-001).
 */
export async function triggerWebhook(invoice: InvoiceRow, eventType: WebhookEvent): Promise<void> {
  const activeEndpoints = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.isActive, true));

  const matchingEndpoints = activeEndpoints.filter((endpoint) => endpoint.events.includes(eventType));
  if (matchingEndpoints.length === 0) {
    return;
  }

  const payload = buildWebhookPayload(invoice, eventType);

  const insertedRows = await db
    .insert(webhookDeliveries)
    .values(
      matchingEndpoints.map((endpoint) => ({
        endpointId: endpoint.id,
        invoiceId: invoice.id,
        eventType,
        payload,
        attemptCount: 0,
        status: "pending" as const,
      })),
    )
    .returning();

  logActivity(
    "info",
    "webhook",
    `queued ${insertedRows.length} delivery/deliveries for invoice ${invoice.id} (event: ${eventType})`,
  );

  for (const row of insertedRows) {
    scheduleAttempt(row.id, 0);
  }
}
