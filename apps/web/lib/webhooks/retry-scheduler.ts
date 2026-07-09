import { and, eq, isNotNull } from "drizzle-orm";

import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { webhookDeliveries } from "@/lib/db/schema";

import { attemptDelivery } from "./deliver";

// Resolved Decision #2 (harness-brief.md issue #8): a setTimeout-based
// scheduler, NOT a periodic interval scanner like lib/poller/worker.ts —
// rejected an interval scanner because it wastes DB queries on mostly-empty
// scans and adds drift vs. the exact `next_retry_at` timestamp. File is
// named retry-scheduler.ts (not retry-worker.ts) precisely because there is
// no periodic worker loop here.

// In-memory registry so a delivery is never double-scheduled (needed for
// the Resend interaction — see lib/services/webhooks.ts's resendDelivery(),
// which cancels any pending timer for the *original* delivery id before
// inserting the resend row) and so a fired timeout is cleaned out of the map
// afterward. NOT durable across a process restart/crash — that's exactly
// what recoverPendingDeliveries() below exists to recover from.
const scheduledTimers = new Map<string, NodeJS.Timeout>();

/**
 * Arms a setTimeout for one delivery's next attempt. Two call sites:
 * (a) trigger.ts, immediately after inserting a fresh webhook_deliveries row
 *     (delayMs=0 — the "immediate" attempt, Resolved Decision #3), and
 * (b) deliver.ts's attemptDelivery(), immediately after persisting a
 *     failed-but-retryable attempt (delayMs=60_000 or 300_000, BR-WHK-003).
 * Also called once per row by recoverPendingDeliveries() at boot.
 */
export function scheduleAttempt(deliveryId: string, delayMs: number): void {
  cancelScheduledAttempt(deliveryId);

  const timer = setTimeout(() => {
    scheduledTimers.delete(deliveryId);
    // Error boundary, same style as lib/poller/worker.ts's runPollCycle()
    // .catch(): attemptDelivery() already persists its own outcome for every
    // expected failure mode, so a rejection here means something unexpected
    // (e.g. DB unreachable) — it must never crash the process or the timer.
    attemptDelivery(deliveryId).catch((error: unknown) => {
      logActivity("error", "webhook", `Delivery attempt for ${deliveryId} failed unexpectedly: ${String(error)}`, error);
    });
  }, delayMs);

  scheduledTimers.set(deliveryId, timer);
}

/**
 * Cancels an armed timer for `deliveryId` if one exists. Used by
 * resendDelivery() to guard against the race described in Resolved
 * Decision #7 (should not normally happen once a row reaches
 * status='failed', but guarded against anyway).
 */
export function cancelScheduledAttempt(deliveryId: string): void {
  const existing = scheduledTimers.get(deliveryId);
  if (existing) {
    clearTimeout(existing);
    scheduledTimers.delete(deliveryId);
  }
}

/**
 * Boot-time recovery — called once from instrumentation.ts, alongside
 * startInvoicePoller(). Since scheduledTimers is in-memory only, any timer
 * armed before a process restart/crash is lost; this scan is the sole
 * mechanism that re-arms them, using the durable `next_retry_at` column as
 * the source of truth.
 */
export async function recoverPendingDeliveries(now: Date = new Date()): Promise<void> {
  const rows = await db
    .select()
    .from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.status, "pending"), isNotNull(webhookDeliveries.nextRetryAt)));

  for (const row of rows) {
    if (!row.nextRetryAt) {
      continue; // narrows the type; isNotNull() already filtered this at the SQL level
    }
    const delayMs = Math.max(0, row.nextRetryAt.getTime() - now.getTime());
    scheduleAttempt(row.id, delayMs);
  }
}
