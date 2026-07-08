import { verifyWebhookSignature } from "@fibergate/sdk";
import { NextResponse, type NextRequest } from "next/server";

import { requireEnv } from "@/lib/env";
import { publish, type WebhookBusEvent } from "@/lib/webhook-bus";

// The actual webhook receiver — this route plays the role of "the merchant's
// server" in the demo. Verifies with the exact function an external
// FiberGate integrator uses (@fibergate/sdk's verifyWebhookSignature), then
// pushes a live update to whichever browser tab is watching this invoice via
// app/api/webhook-events/[invoiceId]/route.ts's SSE stream (lib/webhook-bus.ts).

const SIGNATURE_HEADER = "x-fiber-signature";

// Matches apps/web/lib/webhooks/trigger.ts's WebhookEvent — duplicated here
// (not imported, this app has no dependency on apps/web) as the wire-format
// contract this route expects to receive.
const EVENT_TO_STATUS: Record<string, WebhookBusEvent["status"]> = {
  "payment.paid": "paid",
  "invoice.expired": "expired",
  "invoice.failed": "failed",
};

interface WebhookPayload {
  event: string;
  data?: {
    invoice_id?: string;
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  // Raw body text is required for HMAC verification — a re-JSON.stringify()'d
  // object can silently produce different bytes than what was actually
  // signed (.context/guides/webhook-signature.md §5).
  const rawBody = await request.text();
  const signature = request.headers.get(SIGNATURE_HEADER);

  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 401 });
  }

  const secret = requireEnv("DEMO_WEBHOOK_SECRET");
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const status = EVENT_TO_STATUS[payload.event];
  const invoiceId = payload.data?.invoice_id;
  if (status && invoiceId) {
    publish({ invoiceId, status });
  }

  // 200 regardless of whether any browser tab was listening — a non-200
  // response here would show up as a real "failed" delivery in fibergate-
  // core's webhook_deliveries audit table.
  return NextResponse.json({ ok: true }, { status: 200 });
}
