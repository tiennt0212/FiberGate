// Next.js `register()` hook — the officially supported way to run
// once-per-process startup code in a long-running server (fibergate-core is
// a long-lived Node process, not serverless — CLAUDE.md/system-design.md).
// Requires `experimental.instrumentationHook: true` in next.config.js on
// this pinned `next@14.2.35` — verified directly against the installed
// package's own source: node_modules/next/dist/server/config-shared.js
// defaults that flag to `false`, and node_modules/next/dist/build/index.js
// only registers this file for detection when it's truthy.
//
// BR-POL-001: starts the 30s in-process interval poller exactly once when
// fibergate-core boots, independent of any inbound request — Phase 2 (issue
// #13) demoted this to a fallback behind the real-time WebSocket listener
// started right below, so the interval was reduced from the original 10s.
//
// Also starts the Phase 2 real-time invoice listener (issue #13):
// subscribe_store_changes over WebSocket, now the primary path for payment
// detection, with the poller above kept running as a fallback (see
// lib/poller/invoice-listener.ts's module doc for why — official FNN docs
// call this mechanism off-label for a non-CCH client). Like the poller,
// this must never block or crash server startup — lib/poller/invoice-listener.ts
// handles its own connection failures with reconnect-with-backoff.
//
// Also runs webhook retry recovery exactly once at boot (Resolved Decision
// #2, issue #8): the retry scheduler is setTimeout-based, in-memory only, so
// any retry timer armed before a restart/crash is lost — this is the sole
// recovery mechanism, re-arming a timer for every still-pending delivery
// from its durable `next_retry_at` column.

export async function register(): Promise<void> {
  // Next.js also loads instrumentation.ts under the edge runtime
  // (middleware). The poller depends on node:crypto/postgres-js (via
  // lib/db, lib/fiber/client), which don't exist there, so it must only
  // start under the real Node.js server runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startInvoicePoller } = await import("./lib/poller/worker");
    startInvoicePoller();

    const { startInvoiceListener } = await import("./lib/poller/invoice-listener");
    startInvoiceListener();

    const { logActivity } = await import("./lib/activity-log");
    const { recoverPendingDeliveries } = await import("./lib/webhooks/retry-scheduler");
    // Fire-and-forget, same as startInvoicePoller() above: a DB hiccup at the
    // exact instant register() runs (transient connection issue, cold
    // Postgres, or any non-Docker dev run without docker-compose's
    // `condition: service_healthy` gate) must never block or crash Next.js
    // server startup.
    recoverPendingDeliveries().catch((error: unknown) => {
      logActivity("error", "webhook", `Retry recovery failed: ${String(error)}`, error);
    });
  }
}
