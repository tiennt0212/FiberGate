import { runPollCycle } from "./invoice-poller";

// Thin setInterval wrapper around runPollCycle() (BR-POL-001: every 10s).
// Kept separate from invoice-poller.ts so tests can call runPollCycle()
// directly without fake timers. Started once from instrumentation.ts's
// register() hook when the server process boots.

const POLL_INTERVAL_MS = 10_000; // BR-POL-001

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
        console.error("[poller] Poll cycle failed:", error);
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
