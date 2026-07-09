import { FiberGateApiError } from "@fibergate/sdk";
import type { NextRequest } from "next/server";

import { getGateway } from "@/lib/gateway";
import { subscribe, type WebhookBusEvent } from "@/lib/webhook-bus";

// Server-Sent Events stream the browser opens right after creating an
// invoice (app/PurchaseFlow.tsx). Pushes exactly one terminal event (paid /
// expired / failed) — invoices only ever transition one-way into a terminal
// status (BR-STS-001), so there's nothing further to stream after that.
export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL_MS = 15_000;

const TERMINAL_STATUSES = new Set<string>(["paid", "expired", "failed"]);

function sseMessage(event: WebhookBusEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { invoiceId: string } },
): Promise<Response> {
  const { invoiceId } = params;
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const closeStream = () => {
        unsubscribe?.();
        if (heartbeat) {
          clearInterval(heartbeat);
        }
        try {
          controller.close();
        } catch {
          // Already closed (e.g. the client disconnected first) — nothing to do.
        }
      };

      request.signal.addEventListener("abort", closeStream);

      // Closes the race where payment settles between invoice creation and
      // the browser opening this stream, or on SSE reconnect after a
      // network blip: check current status immediately via the SDK, same
      // as an external integrator polling once on (re)connect would.
      try {
        const invoice = await getGateway().invoices.get(invoiceId);
        if (TERMINAL_STATUSES.has(invoice.status)) {
          controller.enqueue(
            encoder.encode(
              sseMessage({ invoiceId, status: invoice.status as WebhookBusEvent["status"] }),
            ),
          );
          closeStream();
          return;
        }
      } catch (error) {
        if (!(error instanceof FiberGateApiError && error.code === "NOT_FOUND")) {
          console.error(`[demo-storefront] Failed to fetch invoice ${invoiceId} on SSE connect:`, error);
        }
        // Fall through to subscribing anyway — a transient lookup failure
        // shouldn't prevent the client from still hearing a later webhook.
      }

      unsubscribe = subscribe(invoiceId, (event) => {
        controller.enqueue(encoder.encode(sseMessage(event)));
        closeStream();
      });

      // Keeps intermediary proxies/browsers from timing out an idle
      // connection while waiting for payment.
      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, HEARTBEAT_INTERVAL_MS);
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) {
        clearInterval(heartbeat);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
