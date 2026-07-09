// In-memory ring buffer + logging helper for background operations that were
// previously silent on success (poller cycles, webhook delivery attempts) —
// only errors were ever logged before. Each call writes to console (so
// `docker compose logs fibergate-core` output is unchanged/unaffected) AND
// appends to a capped in-memory buffer the Dashboard's Activity page reads
// via Server Action polling (see app/(dashboard)/activity/).
//
// Ephemeral by design — resets on container restart/redeploy, no
// persistence, no new DB table. Same "single long-running process, no queue
// engine" precedent as lib/webhooks/retry-scheduler.ts's in-memory Map.
//
// Stored on globalThis, not a plain module-level `const` — Next.js dev mode
// compiles routes/instrumentation on demand and can hand different call
// sites separate module instances of the same file, silently breaking a
// plain singleton (confirmed live for apps/demo-storefront/lib/webhook-bus.ts,
// see decisions-log.md 2026-07-09 — same defensive fix applied here
// preemptively rather than waiting to hit the same bug again).

export type ActivityLevel = "info" | "error";

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  level: ActivityLevel;
  source: string;
  message: string;
}

const MAX_ENTRIES = 200;
// buffer.shift() is O(n) — letting the buffer grow this far past MAX_ENTRIES
// before trimming amortizes that cost across TRIM_HEADROOM pushes instead of
// paying it on every single push once at capacity. getRecentActivity() still
// only ever returns MAX_ENTRIES entries.
const TRIM_HEADROOM = 50;

declare global {
  // eslint-disable-next-line no-var
  var __fibergateActivityLog: ActivityLogEntry[] | undefined;
  // eslint-disable-next-line no-var
  var __fibergateActivityLogNextId: number | undefined;
}

function getBuffer(): ActivityLogEntry[] {
  if (!globalThis.__fibergateActivityLog) {
    globalThis.__fibergateActivityLog = [];
  }
  return globalThis.__fibergateActivityLog;
}

// Also on globalThis, not a plain module-level `let` — a counter reset to 0
// on a separate module instance (see file header) would collide with ids
// already produced by another instance sharing the same globalThis buffer.
function nextEntryId(): number {
  globalThis.__fibergateActivityLogNextId = (globalThis.__fibergateActivityLogNextId ?? 0) + 1;
  return globalThis.__fibergateActivityLogNextId;
}

/**
 * Logs one activity entry — always to console (`[source] message`, same as
 * existing console.error call sites elsewhere in this app) and to the
 * in-memory buffer the Dashboard's Activity page polls.
 */
export function logActivity(level: ActivityLevel, source: string, message: string): void {
  const entry: ActivityLogEntry = {
    id: `${Date.now()}-${nextEntryId()}`,
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
  };

  const line = `[${source}] ${message}`;
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }

  const buffer = getBuffer();
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES + TRIM_HEADROOM) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
}

/** Returns the most recent entries, oldest first — for the Activity page's initial render and poll refresh. */
export function getRecentActivity(): ActivityLogEntry[] {
  return getBuffer().slice(-MAX_ENTRIES);
}
