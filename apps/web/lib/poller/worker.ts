import { and, eq, gt, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { invoices } from "@/lib/db/schema";
import { env } from "@/lib/config/env";
import { getInvoiceStatus } from "@/lib/fiber/client";
import { transitionToTerminal } from "@/lib/invoices/service";
import { processDueRetries } from "@/lib/webhooks/delivery";
import { takeNodeSnapshot } from "@/lib/node/service";

// BR-POL-002/003: grace window and batch size for the interval poller.
const GRACE_MS = 60_000;
const BATCH_SIZE = 50;
const SNAPSHOT_INTERVAL_MS = 60_000; // node_snapshots ~ once a minute

const globalForPoller = globalThis as unknown as {
  __fibergatePoller?: { timer: NodeJS.Timeout; running: boolean; lastSnapshotAt: number };
};

/** Start the in-process poller once per process (BR-POL-001). Idempotent. */
export function startPoller(): void {
  if (globalForPoller.__fibergatePoller) return;
  if (!env.pollerEnabled) {
    console.info("[poller] disabled via POLLER_ENABLED=false");
    return;
  }

  const state = { timer: null as unknown as NodeJS.Timeout, running: false, lastSnapshotAt: 0 };
  state.timer = setInterval(() => {
    void tick(state);
  }, env.pollIntervalMs);
  globalForPoller.__fibergatePoller = state;
  console.info(`[poller] started, interval=${env.pollIntervalMs}ms`);
}

async function tick(state: { running: boolean; lastSnapshotAt: number }): Promise<void> {
  if (state.running) return; // never overlap ticks
  state.running = true;
  try {
    await pollInvoicesOnce();
    await processDueRetries();
    if (Date.now() - state.lastSnapshotAt >= SNAPSHOT_INTERVAL_MS) {
      state.lastSnapshotAt = Date.now();
      await takeNodeSnapshot().catch((err) => console.error("[poller] snapshot failed:", err));
    }
  } catch (err) {
    console.error("[poller] tick failed:", err);
  } finally {
    state.running = false;
  }
}

/** One poll pass: reconcile in-window invoices against the node, expire the rest. */
export async function pollInvoicesOnce(): Promise<void> {
  const now = Date.now();
  const graceCutoff = new Date(now - GRACE_MS);

  // In-window pending invoices → ask the node for the authoritative status.
  const active = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.status, "pending"), gt(invoices.expiresAt, graceCutoff)))
    .limit(BATCH_SIZE);

  for (const inv of active) {
    try {
      const status = await getInvoiceStatus(inv.paymentHash); // 5s timeout (BR-POL-004)
      if (status === "paid" || status === "failed") {
        await transitionToTerminal(inv.id, status);
      } else if (status === "expired" || inv.expiresAt.getTime() < now) {
        // Node reports expired, or the client-side deadline passed within the grace window.
        if (status === "expired") await transitionToTerminal(inv.id, "expired");
      }
    } catch (err) {
      // BR-POL-004: node unreachable → skip this invoice, do not change status.
      console.error(`[poller] node poll failed for ${inv.id}:`, err);
    }
  }

  // Past the grace window and still pending → definitively expired (BR-STS-002b).
  const stale = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.status, "pending"), lte(invoices.expiresAt, graceCutoff)))
    .limit(BATCH_SIZE);

  for (const inv of stale) {
    await transitionToTerminal(inv.id, "expired");
  }
}
