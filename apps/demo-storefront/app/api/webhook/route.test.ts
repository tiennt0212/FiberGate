import { createHmac } from "node:crypto";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/webhook-bus", () => ({
  publish: vi.fn(),
}));

const { publish } = await import("@/lib/webhook-bus");
const { POST } = await import("./route");

const TEST_SECRET = "test-webhook-secret";

// Mirrors apps/web/lib/webhooks/sign.ts's signWebhookPayload() exactly —
// same scheme @fibergate/sdk's verifyWebhookSignature expects.
function sign(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

function postWebhook(rawBody: string, signature?: string): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature !== undefined) {
    headers["x-fiber-signature"] = signature;
  }
  return new NextRequest("http://localhost/api/webhook", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

beforeEach(() => {
  process.env.DEMO_WEBHOOK_SECRET = TEST_SECRET;
});

afterEach(() => {
  delete process.env.DEMO_WEBHOOK_SECRET;
  vi.clearAllMocks();
});

describe("POST /api/webhook", () => {
  it("publishes a paid event and returns 200 for a validly-signed payment.paid payload", async () => {
    const rawBody = JSON.stringify({
      event: "payment.paid",
      data: { invoice_id: "inv-123" },
    });

    const response = await POST(postWebhook(rawBody, sign(rawBody, TEST_SECRET)));

    expect(response.status).toBe(200);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({ invoiceId: "inv-123", status: "paid" });
  });

  it("maps invoice.expired / invoice.failed to their bus status without touching payment.paid handling", async () => {
    const expiredBody = JSON.stringify({ event: "invoice.expired", data: { invoice_id: "inv-1" } });
    await POST(postWebhook(expiredBody, sign(expiredBody, TEST_SECRET)));
    expect(publish).toHaveBeenCalledWith({ invoiceId: "inv-1", status: "expired" });

    const failedBody = JSON.stringify({ event: "invoice.failed", data: { invoice_id: "inv-2" } });
    await POST(postWebhook(failedBody, sign(failedBody, TEST_SECRET)));
    expect(publish).toHaveBeenCalledWith({ invoiceId: "inv-2", status: "failed" });
  });

  it("rejects a tampered body (signature computed over different bytes) without publishing", async () => {
    const originalBody = JSON.stringify({ event: "payment.paid", data: { invoice_id: "inv-123" } });
    const signature = sign(originalBody, TEST_SECRET);
    const tamperedBody = JSON.stringify({ event: "payment.paid", data: { invoice_id: "inv-999" } });

    const response = await POST(postWebhook(tamperedBody, signature));

    expect(response.status).toBe(401);
    expect(publish).not.toHaveBeenCalled();
  });

  it("rejects a signature produced with the wrong secret without publishing", async () => {
    const rawBody = JSON.stringify({ event: "payment.paid", data: { invoice_id: "inv-123" } });

    const response = await POST(postWebhook(rawBody, sign(rawBody, "wrong-secret")));

    expect(response.status).toBe(401);
    expect(publish).not.toHaveBeenCalled();
  });

  it("rejects a signature missing the sha256= prefix without publishing", async () => {
    const rawBody = JSON.stringify({ event: "payment.paid", data: { invoice_id: "inv-123" } });
    const rawHexOnly = sign(rawBody, TEST_SECRET).replace("sha256=", "");

    const response = await POST(postWebhook(rawBody, rawHexOnly));

    expect(response.status).toBe(401);
    expect(publish).not.toHaveBeenCalled();
  });

  it("returns 401 and does not publish when the signature header is missing entirely", async () => {
    const rawBody = JSON.stringify({ event: "payment.paid", data: { invoice_id: "inv-123" } });

    const response = await POST(postWebhook(rawBody));

    expect(response.status).toBe(401);
    expect(publish).not.toHaveBeenCalled();
  });

  it("acknowledges with 200 but does not publish for an unrecognized event type", async () => {
    const rawBody = JSON.stringify({ event: "invoice.created", data: { invoice_id: "inv-123" } });

    const response = await POST(postWebhook(rawBody, sign(rawBody, TEST_SECRET)));

    expect(response.status).toBe(200);
    expect(publish).not.toHaveBeenCalled();
  });
});
