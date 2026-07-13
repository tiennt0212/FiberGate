import { and, eq, gt, lt } from "drizzle-orm";

import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { invoices, type InvoiceRow } from "@/lib/db/schema";
import { getInvoiceStatus } from "@/lib/fiber/client";
import { FiberRpcTimeoutError, type InvoiceStatus } from "@/lib/fiber/types";
import { triggerWebhook, WebhookEvent } from "@/lib/webhooks/trigger";

// Pure, single-shot poll-cycle logic (BR-POL-001..004, BR-STS-001..003),
// shared by the interval worker and the manual cron route. No timers here —
// keeps runPollCycle() unit-testable without fake timers.

const POLL_BATCH_SIZE = 50; // BR-POL-003
const POLL_WINDOW_MS = 60_000; // BR-POL-002 "expires_at > now() - 60s"

/**
 * BR-STS-002(b): expire pending invoices whose expires_at has passed, purely
 * from the DB clock. Must be a separate bulk UPDATE — BR-POL-002's batch
 * query below excludes anything expired more than 60s ago, so a per-row
 * check inside that loop could never reach those rows. Must also run AFTER
 * pollPendingBatch() (see runPollCycle()) — running it first would race a
 * payment that settles right at/after expires_at: this clock-only check
 * can't tell "genuinely abandoned" apart from "just paid a moment ago", and
 * once a row flips to 'expired' it can never become 'paid' (BR-STS-001,
 * forward-only).
 */
async function expireOverdueInvoices(now: Date): Promise<InvoiceRow[]> {
  const expiredRows = await db
    .update(invoices)
    .set({ status: "expired" })
    .where(and(eq(invoices.status, "pending"), lt(invoices.expiresAt, now)))
    .returning();

  for (const row of expiredRows) {
    logActivity("info", "poller", `invoice ${row.id} expired (clock-based, past expires_at)`);
  }

  // Independent deliveries to (potentially) different merchant endpoints —
  // no shared-resource reason to serialize them like the Fiber RPC batch
  // below. allSettled so one failing delivery doesn't skip logging the rest.
  await Promise.allSettled(
    expiredRows.map((row) => triggerWebhook(row, WebhookEvent.InvoiceExpired)),
  );

  return expiredRows;
}

/**
 * RPC-driven batch (BR-POL-002/003). Sequential await, not Promise.all —
 * avoids firing up to 50 concurrent RPC calls at the Fiber node at once.
 * Runs BEFORE expireOverdueInvoices() in runPollCycle() so a payment that
 * settles right at/after expires_at still gets a chance to be observed as
 * paid via the real Fiber node status before the clock-only bulk expire
 * could otherwise sweep it into 'expired' first.
 */
async function pollPendingBatch(now: Date): Promise<number> {
  const windowStart = new Date(now.getTime() - POLL_WINDOW_MS);

  const batch = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.status, "pending"), gt(invoices.expiresAt, windowStart)))
    .limit(POLL_BATCH_SIZE);

  for (const invoice of batch) {
    await pollOneInvoice(invoice, now);
  }

  return batch.length;
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
    logActivity(
      "error",
      "poller",
      `Fiber node ${reason} checking invoice ${invoice.id} (payment_hash ${invoice.paymentHash}); skipping this cycle: ${String(error)}`,
      error,
    );
    return;
  }

  try {
    await applyNodeStatus(invoice, nodeStatus, now);
  } catch (error) {
    // Same isolation guarantee as the getInvoiceStatus() catch above — a
    // failure applying the status update (DB error, or a future webhook
    // delivery failure once issue #8 makes triggerWebhook() a real HTTP
    // call) must not abort the rest of pollPendingBatch()'s for-loop.
    logActivity(
      "error",
      "poller",
      `Failed to apply status update for invoice ${invoice.id} (payment_hash ${invoice.paymentHash}); skipping this cycle: ${String(error)}`,
      error,
    );
  }
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
    logActivity("info", "poller", `invoice ${updated.id} pending → ${transition.status} (node status: ${nodeStatus})`);
    await triggerWebhook(updated, transition.event);
  }
}

/**
 * Entry point for lib/poller/invoice-listener.ts's WebSocket event handler
 * (issue #13, Phase 2) — looks up the invoice by payment_hash and, if found,
 * applies the same terminal-state transition applyNodeStatus() uses for the
 * RPC-polled batch above, so both paths share one place that decides what a
 * node status maps onto and whether a webhook fires. A payment_hash with no
 * matching row is silently ignored (BR-POL-005: the store_changes stream is
 * unfiltered by FNN — only payment_hash values that exist in our own
 * invoices table are ours to act on).
 */
export async function applyInvoiceStatusUpdate(
  paymentHash: string,
  nodeStatus: InvoiceStatus,
  now: Date = new Date(),
): Promise<void> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.paymentHash, paymentHash))
    .limit(1);

  if (!invoice) {
    return;
  }

  await applyNodeStatus(invoice, nodeStatus, now);
}

/**
 * Runs one poll cycle: poll the RPC-eligible pending batch first, then bulk
 * expire whatever is still clock-overdue afterward. Order matters here — see
 * pollPendingBatch()/expireOverdueInvoices()'s doc comments for why
 * expiring first would race a payment that settles right at expires_at.
 * `now` is overridable for tests only.
 */
export async function runPollCycle(now: Date = new Date()): Promise<void> {
  const checked = await pollPendingBatch(now);
  const expired = await expireOverdueInvoices(now);
  // Always log the per-cycle summary, including "checked 0" — human decision
  // (2026-07-11): the Activity page's live "next poll in Ns" countdown next
  // to a permanently empty table read as broken during an idle period
  // (nothing pending, buffer reset by the last restart), even though the
  // poller was alive and polling the whole time. A visible "checked 0" line
  // every 10s is the confirmation an admin actually wants here; MAX_ENTRIES
  // (200, ~33min at this cadence) already bounds how much buffer this can
  // consume.
  logActivity("info", "poller", `poll cycle: checked ${checked} pending invoice(s), ${expired.length} clock-expired`);
}
