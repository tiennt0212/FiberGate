import { and, eq, gt, lt } from "drizzle-orm";

import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { getInvoiceStatus } from "@/lib/fiber/client";
import { FiberRpcTimeoutError, type InvoiceStatus } from "@/lib/fiber/types";
import { triggerWebhook, WebhookEvent } from "@/lib/webhooks/trigger";

// Pure, single-shot poll-cycle logic (BR-POL-001..004, BR-STS-001..003),
// shared by the interval worker and the manual cron route. No timers here —
// keeps runPollCycle() unit-testable without fake timers.

const POLL_BATCH_SIZE = 50; // BR-POL-003
const POLL_WINDOW_MS = 60_000; // BR-POL-002 "expires_at > now() - 60s"

type InvoiceRow = typeof invoices.$inferSelect;

/**
 * BR-STS-002(b): expire pending invoices whose expires_at has passed, purely
 * from the DB clock. Must be a separate bulk UPDATE — BR-POL-002's batch
 * query below excludes anything expired more than 60s ago, so a per-row
 * check inside that loop could never reach those rows.
 */
async function expireOverdueInvoices(now: Date): Promise<InvoiceRow[]> {
  const expiredRows = await db
    .update(invoices)
    .set({ status: "expired" })
    .where(and(eq(invoices.status, "pending"), lt(invoices.expiresAt, now)))
    .returning();

  // Independent deliveries to (potentially) different merchant endpoints —
  // no shared-resource reason to serialize them like the Fiber RPC batch
  // below. allSettled so one failing delivery doesn't skip logging the rest.
  await Promise.allSettled(
    expiredRows.map((row) => triggerWebhook(row, WebhookEvent.InvoiceExpired)),
  );

  return expiredRows;
}

/**
 * Step 2: RPC-driven batch (BR-POL-002/003). Sequential await, not
 * Promise.all — avoids firing up to 50 concurrent RPC calls at the Fiber
 * node at once.
 */
async function pollPendingBatch(now: Date): Promise<void> {
  const windowStart = new Date(now.getTime() - POLL_WINDOW_MS);

  const batch = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.status, "pending"), gt(invoices.expiresAt, windowStart)))
    .limit(POLL_BATCH_SIZE);

  for (const invoice of batch) {
    await pollOneInvoice(invoice, now);
  }
}

async function pollOneInvoice(invoice: InvoiceRow, now: Date): Promise<void> {
  let nodeStatus: InvoiceStatus;
  try {
    const result = await getInvoiceStatus(invoice.paymentHash);
    nodeStatus = result.status;
  } catch (error) {
    // BR-POL-004: skip + log, never touch status — one bad row (timeout or
    // any other failure) must not abort the rest of the batch.
    const reason = error instanceof FiberRpcTimeoutError ? "timed out" : "failed unexpectedly";
    console.error(
      `[poller] Fiber node ${reason} checking invoice ${invoice.id} ` +
        `(payment_hash ${invoice.paymentHash}); skipping this cycle`,
      error,
    );
    return;
  }

  await applyNodeStatus(invoice, nodeStatus, now);
}

// Node status -> invoices.status, keyed by InvoiceStatus. "Received"/"Open"
// (or any other value) have no entry — not terminal yet, so applyNodeStatus()
// leaves invoices.status untouched. Only "Paid" is terminal for a payment;
// "Received" means settlement pending (Fiber's channel.rs), not paid.
const TERMINAL_TRANSITIONS: Partial<
  Record<InvoiceStatus, { status: InvoiceRow["status"]; event: WebhookEvent; setPaidAt?: boolean }>
> = {
  Expired: { status: "expired", event: WebhookEvent.InvoiceExpired }, // BR-STS-002(a)
  Cancelled: { status: "failed", event: WebhookEvent.InvoiceFailed }, // BR-STS-003
  Paid: { status: "paid", event: WebhookEvent.PaymentPaid, setPaidAt: true },
};

/**
 * Maps node status onto invoices.status. The UPDATE re-checks
 * status='pending' in its WHERE clause (BR-STS-001: forward-only, no
 * re-processing terminal rows).
 */
async function applyNodeStatus(
  invoice: InvoiceRow,
  nodeStatus: InvoiceStatus,
  now: Date,
): Promise<void> {
  const transition = TERMINAL_TRANSITIONS[nodeStatus];
  if (!transition) {
    return;
  }

  const [updated] = await db
    .update(invoices)
    .set({ status: transition.status, ...(transition.setPaidAt ? { paidAt: now } : {}) })
    .where(and(eq(invoices.id, invoice.id), eq(invoices.status, "pending")))
    .returning();

  if (updated) {
    await triggerWebhook(updated, transition.event);
  }
}

/**
 * Runs one poll cycle: expire clock-overdue invoices, then poll the
 * remaining pending batch. `now` is overridable for tests only.
 */
export async function runPollCycle(now: Date = new Date()): Promise<void> {
  await expireOverdueInvoices(now);
  await pollPendingBatch(now);
}
