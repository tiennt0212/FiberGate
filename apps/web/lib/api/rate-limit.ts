// Deployment-wide invoice-creation rate limiter (BR-RTE-001: max 100
// invoices/minute across the whole deployment, an anti-abuse prototype
// guard, not a hard financial control).
//
// Storage: in-memory sliding-window counter (module-level state), per the
// resolved decision in harness-brief.md ("Resolved decisions" #1). This
// matches the committed single long-running `fibergate-core` container
// architecture (.context/architecture/system-design.md has no Redis/cache
// layer) — zero added DB cost per POST /invoices call. It resets on
// container restart/redeploy and would not coordinate across multiple
// replicas, both accepted as fine for a single-container deployment.

const WINDOW_MS = 60_000;
const MAX_INVOICES_PER_WINDOW = 100; // BR-RTE-001

// Timestamps (ms since epoch) of invoice-creation attempts within the
// current sliding window. Pruned lazily on each check rather than via a
// timer, so there's no background interval to leak/clean up.
let invoiceCreationTimestamps: number[] = [];

/**
 * Attempts to consume one slot of the deployment-wide invoice-creation
 * budget. Returns `true` if the request is allowed to proceed (and records
 * it), `false` if the 100/minute cap (BR-RTE-001) has been reached.
 *
 * `now` is only overridable for tests — production callers should omit it.
 */
export function tryConsumeInvoiceCreationSlot(now: number = Date.now()): boolean {
  const windowStart = now - WINDOW_MS;
  invoiceCreationTimestamps = invoiceCreationTimestamps.filter(
    (timestamp) => timestamp > windowStart,
  );

  if (invoiceCreationTimestamps.length >= MAX_INVOICES_PER_WINDOW) {
    return false;
  }

  invoiceCreationTimestamps.push(now);
  return true;
}
