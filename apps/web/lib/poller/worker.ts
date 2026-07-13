import { logActivity } from "@/lib/activity-log";

import { runPollCycle } from "./invoice-poller";

// Thin setInterval wrapper around runPollCycle() (BR-POL-001). Kept separate
// from invoice-poller.ts so tests can call runPollCycle() directly without
// fake timers. Started once from instrumentation.ts's register() hook when
// the server process boots, alongside lib/poller/invoice-listener.ts's
// real-time WebSocket listener (issue #13, Phase 2) — this interval was
// reduced from the original 10s to a 30s fallback now that the listener is
// the primary path for payment detection; still never disabled outright,
// since the official docs describe subscribe_store_changes as off-label
// usage for a non-CCH client.

const POLL_INTERVAL_MS = 30_000; // BR-POL-001, Phase 2 fallback rate

let intervalHandle: ReturnType<typeof setInterval> | null = null;
// Re-entrancy guard: a single poll cycle can take longer than 10s (up to 50
// invoices, each with a 5s Fiber RPC timeout — BR-POL-004), and setInterval
// fires on a wall-clock schedule regardless of whether the previous tick's
// callback finished. Without this flag, a slow/unresponsive Fiber node would
// cause overlapping cycles to pile up, each hammering the node further —
// the opposite of pollPendingBatch()'s sequential-await design intent.
let isRunning = false;

/** Starts the interval worker. Safe to call more than once — a no-op if already running. */
export function startInvoicePoller(): void {
  if (intervalHandle) {
    return;
  }

  intervalHandle = setInterval(() => {
    if (isRunning) {
      return; // previous cycle still in flight — skip this tick rather than overlap
    }
    isRunning = true;
    // Error boundary: a failed cycle must never kill the timer or crash the
    // process (e.g. DB unreachable during the bulk expire step).
    runPollCycle()
      .catch((error: unknown) => {
        logActivity("error", "poller", `Poll cycle failed: ${String(error)}`, error);
      })
      .finally(() => {
        isRunning = false;
      });
  }, POLL_INTERVAL_MS);
}

/** Test-only escape hatch — production code never needs to stop the worker. */
export function stopInvoicePoller(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  isRunning = false;
}
