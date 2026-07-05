// Next.js `register()` hook — the officially supported way to run
// once-per-process startup code in a long-running server (fibergate-core is
// a long-lived Node process, not serverless — CLAUDE.md/system-design.md).
// Requires `experimental.instrumentationHook: true` in next.config.js on
// this pinned `next@14.2.35` — verified directly against the installed
// package's own source: node_modules/next/dist/server/config-shared.js
// defaults that flag to `false`, and node_modules/next/dist/build/index.js
// only registers this file for detection when it's truthy.
//
// BR-POL-001: starts the 10s in-process interval poller exactly once when
// fibergate-core boots, independent of any inbound request.

export async function register(): Promise<void> {
  // Next.js also loads instrumentation.ts under the edge runtime
  // (middleware). The poller depends on node:crypto/postgres-js (via
  // lib/db, lib/fiber/client), which don't exist there, so it must only
  // start under the real Node.js server runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startInvoicePoller } = await import("./lib/poller/worker");
    startInvoicePoller();
  }
}
