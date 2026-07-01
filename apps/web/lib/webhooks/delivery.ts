import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { webhookDeliveries, webhookEndpoints } from "@/lib/db/schema";
import type { Invoice as InvoiceRow, WebhookEndpoint } from "@/lib/db/schema";
import { shannonToAmount, type InvoiceStatusValue } from "@/lib/invoices/constants";
import { decryptSecret } from "@/lib/crypto/secretbox";
import { signPayload } from "./signing";

const WEBHOOK_TIMEOUT_MS = 5_000; // BR-WHK-002
const MAX_ATTEMPTS = 3; // BR-WHK-003
// Delay before attempt N+1, indexed by the attempt that just failed (1-based − 1).
const RETRY_DELAYS_MS = [60_000, 300_000]; // immediate → 1 min → 5 min

const STATUS_EVENT: Record<Exclude<InvoiceStatusValue, "pending">, string> = {
  paid: "payment.paid",
  expired: "invoice.expired",
  failed: "invoice.failed",
};

export function eventForStatus(status: InvoiceStatusValue): string | null {
  return status === "pending" ? null : STATUS_EVENT[status];
}

interface WebhookPayload {
  event: string;
  created_at: string;
  data: {
    invoice_id: string;
    payment_hash: string;
    amount: number;
    asset: string;
    paid_at: string | null;
    metadata: Record<string, unknown> | null;
  };
}

function buildPayload(invoice: InvoiceRow, event: string): WebhookPayload {
  return {
    event,
    created_at: new Date().toISOString(),
    data: {
      invoice_id: invoice.id,
      payment_hash: invoice.paymentHash,
      amount: shannonToAmount(invoice.amountShannon),
      asset: invoice.asset,
      paid_at: invoice.paidAt ? invoice.paidAt.toISOString() : null,
      metadata: (invoice.metadata as Record<string, unknown> | null) ?? null,
    },
  };
}

function subscribed(endpoint: WebhookEndpoint, event: string): boolean {
  return endpoint.events.includes(event) || endpoint.events.includes("*");
}

/**
 * Fan a terminal-state event out to every active, subscribed endpoint (BR-WHK-001).
 * Records one delivery row per endpoint (BR-WHK-005) and makes the first attempt.
 */
export async function dispatchForInvoice(invoice: InvoiceRow, event: string): Promise<void> {
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.isActive, true));

  const targets = endpoints.filter((e) => subscribed(e, event));
  if (targets.length === 0) return;

  const payload = buildPayload(invoice, event);

  await Promise.all(
    targets.map(async (endpoint) => {
      const [row] = await db
        .insert(webhookDeliveries)
        .values({
          endpointId: endpoint.id,
          invoiceId: invoice.id,
          eventType: event,
          payload,
          status: "pending",
          attemptCount: 1,
        })
        .returning({ id: webhookDeliveries.id });
      if (row) await runAttempt(row.id, endpoint, payload, 1);
    }),
  );
}

/** Re-attempt any failed delivery whose backoff has elapsed (BR-WHK-003). */
export async function processDueRetries(): Promise<number> {
  const due = await db
    .select()
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, "failed"),
        lte(webhookDeliveries.nextRetryAt, new Date()),
        sql`${webhookDeliveries.attemptCount} < ${MAX_ATTEMPTS}`,
      ),
    )
    .limit(50);

  for (const delivery of due) {
    const [endpoint] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, delivery.endpointId));
    if (!endpoint) continue;
    await runAttempt(
      delivery.id,
      endpoint,
      delivery.payload as WebhookPayload,
      delivery.attemptCount + 1,
    );
  }
  return due.length;
}

/** Force an immediate re-attempt of one delivery — used by the dashboard "Retry" button. */
export async function retryDelivery(deliveryId: string): Promise<boolean> {
  const [delivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId));
  if (!delivery) return false;
  const [endpoint] = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, delivery.endpointId));
  if (!endpoint) return false;
  await runAttempt(
    delivery.id,
    endpoint,
    delivery.payload as WebhookPayload,
    delivery.attemptCount + 1,
  );
  return true;
}

async function runAttempt(
  deliveryId: string,
  endpoint: WebhookEndpoint,
  payload: WebhookPayload,
  attemptNumber: number,
): Promise<void> {
  const rawBody = JSON.stringify(payload);
  const signature = signPayload(rawBody, decryptSecret(endpoint.secret));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  let httpStatus: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fiber-Signature": signature,
        "X-Fiber-Event": payload.event,
      },
      body: rawBody,
      signal: controller.signal,
    });
    httpStatus = res.status;
    responseBody = (await res.text().catch(() => "")).slice(0, 1024); // truncate 1KB
    success = res.ok;
  } catch (err) {
    responseBody = (err instanceof Error ? err.message : String(err)).slice(0, 1024);
  } finally {
    clearTimeout(timer);
  }

  if (success) {
    await db
      .update(webhookDeliveries)
      .set({
        status: "success",
        attemptCount: attemptNumber,
        httpStatus,
        responseBody,
        deliveredAt: new Date(),
        nextRetryAt: null,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  const delayMs = RETRY_DELAYS_MS[attemptNumber - 1];
  const nextRetryAt = delayMs != null ? new Date(Date.now() + delayMs) : null;
  await db
    .update(webhookDeliveries)
    .set({
      status: "failed",
      attemptCount: attemptNumber,
      httpStatus,
      responseBody,
      nextRetryAt,
    })
    .where(eq(webhookDeliveries.id, deliveryId));
}
