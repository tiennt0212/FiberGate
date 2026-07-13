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
    // Must run BEFORE the invoice-listener import below (which pulls in
    // `ws` transitively) — issue #13 follow-up, live-verified 2026-07-13.
    // `ws`'s buffer-util.js/validation.js each do a plain
    // `try { require('bufferutil'/'utf-8-validate') } catch {}` at module
    // load time to opt into faster native addons, falling back to their own
    // pure-JS implementation if the require throws. Neither package is an
    // actual dependency of this project (verified: absent from
    // node_modules). Under plain Node that require() throws
    // MODULE_NOT_FOUND and the catch block does its job — but Next's
    // webpack-bundled server runtime (both `next dev` and the standalone
    // build both go through webpack for the server bundle) resolves that
    // require() to a broken empty stub instead of throwing, so `ws`'s own
    // catch never triggers and it wires up a "native" mask()/isValidUTF8()
    // that isn't actually there. Surfaced as an uncaught
    // "TypeError: bufferUtil.mask is not a function" the instant the WS
    // client sent its first frame — the real-time listener was silently
    // never sending its subscribe_store_changes request at all, leaving
    // only the 30s poller working, no matter how healthy the
    // reconnect/heartbeat logic in subscribe-client.ts was. These are ws's
    // own documented escape hatches (see node_modules/ws/lib/buffer-util.js
    // and validation.js) to skip the native require entirely; negligible
    // perf cost here since this client handles occasional invoice events,
    // not high-frequency WS traffic.
    process.env.WS_NO_BUFFER_UTIL = "1";
    process.env.WS_NO_UTF_8_VALIDATE = "1";

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
