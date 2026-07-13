import { logActivity } from "@/lib/activity-log";
import { subscribeToStoreChanges, type StoreChange, type StoreChangeSubscription } from "@/lib/fiber/subscribe-client";

import { applyInvoiceStatusUpdate } from "./invoice-poller";

// Real-time invoice listener (issue #13, Phase 2) — subscribes to FNN's
// subscribe_store_changes over lib/fiber/subscribe-client.ts and owns the
// reconnect lifecycle that file deliberately leaves out. Official docs
// describe this RPC as "primarily intended for Cross-Chain Hub integration
// rather than general client use" (decisions-log.md 2026-07-01) — treated
// as off-label usage that could change behavior between node releases,
// hence unbounded reconnect-with-backoff here instead of giving up, and
// worker.ts's poller kept running as a fallback rather than disabled.

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

type Status = "stopped" | "connecting" | "connected";

let status: Status = "stopped";
let subscription: StoreChangeSubscription | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let backoffMs = INITIAL_BACKOFF_MS;

// BR-POL-005: only the PutCkbInvoiceStatus variant matters here — the
// stream also carries PutPreimage/PutPaymentSession/PutAttempt, all ignored.
// The other half of BR-POL-005 (only payment_hash values that exist in our
// invoices table) is enforced inside applyInvoiceStatusUpdate()'s lookup,
// not duplicated here.
function handleEvent(change: StoreChange): void {
  if (!("PutCkbInvoiceStatus" in change)) {
    return;
  }

  const { payment_hash: paymentHash, invoice_status: invoiceStatus } = change.PutCkbInvoiceStatus;
  applyInvoiceStatusUpdate(paymentHash, invoiceStatus).catch((error: unknown) => {
    // Same isolation guarantee as the poller's pollOneInvoice() — a failure
    // handling one event must never take down the listener.
    logActivity(
      "error",
      "listener",
      `Failed to apply status update for payment_hash ${paymentHash}: ${String(error)}`,
      error,
    );
  });
}

// Shared by handleClose() and connect()'s rejection handler below — both hit
// the same "give up if stopInvoiceListener() already ran, otherwise log and
// schedule the next reconnect attempt" sequence, differing only in the log
// message's verb and whether an error is always present.
function logAndReconnect(message: string, error?: unknown): void {
  if (status === "stopped") {
    return; // stopInvoiceListener() already handled shutdown
  }
  status = "connecting";
  logActivity(
    "error",
    "listener",
    `${message}${error !== undefined ? `: ${String(error)}` : ""}; reconnecting in ${backoffMs}ms`,
    error,
  );
  scheduleReconnect();
}

function handleClose(error?: Error): void {
  subscription = null;
  logAndReconnect("Real-time listener connection lost", error);
}

function scheduleReconnect(): void {
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (status === "stopped") {
      return;
    }
    connect();
  }, backoffMs);
  backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
}

function connect(): void {
  subscribeToStoreChanges(handleEvent, handleClose)
    .then((sub) => {
      if (status !== "connecting") {
        // stopInvoiceListener() ran while the handshake was in flight —
        // don't adopt a subscription nobody asked for anymore.
        sub.close();
        return;
      }
      subscription = sub;
      status = "connected";
      backoffMs = INITIAL_BACKOFF_MS; // reset now that we're healthy again
      logActivity("info", "listener", "Real-time invoice listener connected (subscribe_store_changes)");
    })
    .catch((error: unknown) => {
      logAndReconnect("Failed to connect real-time listener", error);
    });
}

/** Starts the listener. Safe to call more than once — a no-op if already running/connecting. */
export function startInvoiceListener(): void {
  if (status !== "stopped") {
    return;
  }
  status = "connecting";
  // Reset in case a prior run left this maxed out at MAX_BACKOFF_MS — a
  // restart should behave like a fresh start (first reconnect attempt at
  // INITIAL_BACKOFF_MS), not inherit whatever backoff a previous session's
  // repeated failures happened to leave behind.
  backoffMs = INITIAL_BACKOFF_MS;
  connect();
}

/** Test-only / shutdown escape hatch. Safe to call more than once. */
export function stopInvoiceListener(): void {
  status = "stopped";
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  subscription?.close();
  subscription = null;
}
