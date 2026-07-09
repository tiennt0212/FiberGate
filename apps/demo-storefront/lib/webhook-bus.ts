// In-memory pub/sub keyed by invoice id, so the webhook receiver
// (app/api/webhook/route.ts) can push a verified event straight to whichever
// browser tab has an SSE connection open for that invoice
// (app/api/webhook-events/[invoiceId]/route.ts). Same "single long-running
// process, no queue engine" precedent as apps/web's
// lib/webhooks/retry-scheduler.ts — this app is a single Next.js server
// process (docker/demo-storefront/Dockerfile), never horizontally scaled.

export interface WebhookBusEvent {
  status: "paid" | "expired" | "failed";
  invoiceId: string;
}

type Listener = (event: WebhookBusEvent) => void;

// Stored on globalThis, not a plain module-level `const` — Next.js dev mode
// compiles API routes on demand (first-request-triggers-compile), and two
// otherwise-unrelated routes that only import this file (never each other)
// can each get their OWN module instance the first time each is hit,
// silently breaking a plain module-level singleton: publish() would see 0
// listeners even with a browser tab actively subscribed via the other
// route's instance. Verified live (2026-07-09): subscribe() and publish()
// logged two different generated instance IDs in dev mode with a plain
// `const` here — this is the fix, not a hypothetical. globalThis is the one
// thing guaranteed to be the same object across module instances within a
// single Node.js process (dev or prod) — the same workaround commonly used
// for Prisma Client singletons under Next.js dev mode. Confirmed fine in
// production too: `next build` compiles everything as one bundle (no
// per-route on-demand compilation there), so this "fix" is a no-op change
// in prod, not a workaround masking a prod issue.
declare global {
  // eslint-disable-next-line no-var
  var __fibergateWebhookBus: Map<string, Set<Listener>> | undefined;
}

function getBus(): Map<string, Set<Listener>> {
  if (!globalThis.__fibergateWebhookBus) {
    globalThis.__fibergateWebhookBus = new Map();
  }
  return globalThis.__fibergateWebhookBus;
}

/** Registers `listener` for events on `invoiceId`. Returns an unsubscribe function. */
export function subscribe(invoiceId: string, listener: Listener): () => void {
  const bus = getBus();
  let listeners = bus.get(invoiceId);
  if (!listeners) {
    listeners = new Set();
    bus.set(invoiceId, listeners);
  }
  listeners.add(listener);
  console.log(
    `[webhook-bus] subscribe invoiceId=${invoiceId} (${listeners.size} listener(s) now, ${bus.size} invoice(s) tracked)`,
  );

  return () => {
    listeners.delete(listener);
    console.log(`[webhook-bus] unsubscribe invoiceId=${invoiceId}`);
    if (listeners.size === 0) {
      bus.delete(invoiceId);
    }
  };
}

/** Notifies every current subscriber for `event.invoiceId`. No-op if none are connected. */
export function publish(event: WebhookBusEvent): void {
  const bus = getBus();
  const listeners = bus.get(event.invoiceId);
  console.log(
    `[webhook-bus] publish invoiceId=${event.invoiceId} status=${event.status} -> ${listeners?.size ?? 0} listener(s) (${bus.size} invoice(s) tracked)`,
  );
  if (!listeners) {
    return;
  }
  for (const listener of listeners) {
    listener(event);
  }
}
