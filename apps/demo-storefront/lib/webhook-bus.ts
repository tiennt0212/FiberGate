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

const listenersByInvoiceId = new Map<string, Set<Listener>>();

/** Registers `listener` for events on `invoiceId`. Returns an unsubscribe function. */
export function subscribe(invoiceId: string, listener: Listener): () => void {
  let listeners = listenersByInvoiceId.get(invoiceId);
  if (!listeners) {
    listeners = new Set();
    listenersByInvoiceId.set(invoiceId, listeners);
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      listenersByInvoiceId.delete(invoiceId);
    }
  };
}

/** Notifies every current subscriber for `event.invoiceId`. No-op if none are connected. */
export function publish(event: WebhookBusEvent): void {
  const listeners = listenersByInvoiceId.get(event.invoiceId);
  if (!listeners) {
    return;
  }
  for (const listener of listeners) {
    listener(event);
  }
}
