import { runPollCycle } from "./invoice-poller";

// Thin setInterval wrapper around runPollCycle() (BR-POL-001: every 10s).
// Kept separate from invoice-poller.ts so tests can call runPollCycle()
// directly without fake timers. Started once from instrumentation.ts's
// register() hook when the server process boots.

const POLL_INTERVAL_MS = 10_000; // BR-POL-001

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/** Starts the interval worker. Safe to call more than once — a no-op if already running. */
export function startInvoicePoller(): void {
  if (intervalHandle) {
    return;
  }

  intervalHandle = setInterval(() => {
    // Error boundary: a failed cycle must never kill the timer or crash the
    // process (e.g. DB unreachable during the bulk expire step).
    runPollCycle().catch((error: unknown) => {
      console.error("[poller] Poll cycle failed:", error);
    });
  }, POLL_INTERVAL_MS);
}

/** Test-only escape hatch — production code never needs to stop the worker. */
export function stopInvoicePoller(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
