import { afterEach, describe, expect, it, vi } from "vitest";

import { buildInvoiceRow, createQueryChain } from "@/lib/db/test-fixtures";

import { buildWebhookEndpointRow } from "./test-fixtures";

// Mock at the module boundary — @/lib/db and the retry-scheduler's
// scheduleAttempt() — never touch the real DB or arm a real timer from this
// test. WebhookEvent must stay the real (unmocked) export so tests can
// reference it.
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));
vi.mock("./retry-scheduler", () => ({
  scheduleAttempt: vi.fn(),
}));

const { db } = await import("@/lib/db");
const { scheduleAttempt } = await import("./retry-scheduler");
const { triggerWebhook, WebhookEvent } = await import("./trigger");

afterEach(() => {
  vi.clearAllMocks();
});

describe("triggerWebhook", () => {
  it("does nothing when no active endpoint subscribes to the firing event", async () => {
    vi.mocked(db.select).mockReturnValue(
      createQueryChain([buildWebhookEndpointRow({ events: ["invoice.failed"] })]) as unknown as ReturnType<
        typeof db.select
      >,
    );

    await triggerWebhook(buildInvoiceRow(), WebhookEvent.PaymentPaid);

    expect(db.insert).not.toHaveBeenCalled();
    expect(scheduleAttempt).not.toHaveBeenCalled();
  });

  it("inserts one webhook_deliveries row per matching endpoint and arms an immediate attempt for each", async () => {
    const endpointA = buildWebhookEndpointRow({ id: "endpoint-a", events: ["payment.paid"] });
    const endpointB = buildWebhookEndpointRow({ id: "endpoint-b", events: ["payment.paid", "invoice.failed"] });
    const nonMatching = buildWebhookEndpointRow({ id: "endpoint-c", events: ["invoice.expired"] });
    vi.mocked(db.select).mockReturnValue(
      createQueryChain([endpointA, endpointB, nonMatching]) as unknown as ReturnType<typeof db.select>,
    );
    const insertChain = createQueryChain([
      { id: "delivery-a" },
      { id: "delivery-b" },
    ]);
    vi.mocked(db.insert).mockReturnValue(insertChain as unknown as ReturnType<typeof db.insert>);

    const invoice = buildInvoiceRow({ status: "paid", paidAt: new Date("2026-07-01T11:05:00Z") });
    await triggerWebhook(invoice, WebhookEvent.PaymentPaid);

    expect(insertChain.values).toHaveBeenCalledWith([
      expect.objectContaining({ endpointId: "endpoint-a", attemptCount: 0, status: "pending" }),
      expect.objectContaining({ endpointId: "endpoint-b", attemptCount: 0, status: "pending" }),
    ]);
    expect(scheduleAttempt).toHaveBeenCalledWith("delivery-a", 0);
    expect(scheduleAttempt).toHaveBeenCalledWith("delivery-b", 0);
    expect(scheduleAttempt).toHaveBeenCalledTimes(2);
  });

  it("builds a payment.paid payload matching rest-api-spec.md, converting amountShannon back to a float", async () => {
    vi.mocked(db.select).mockReturnValue(
      createQueryChain([buildWebhookEndpointRow()]) as unknown as ReturnType<typeof db.select>,
    );
    const insertChain = createQueryChain([{ id: "delivery-1" }]);
    vi.mocked(db.insert).mockReturnValue(insertChain as unknown as ReturnType<typeof db.insert>);

    const invoice = buildInvoiceRow({
      id: "inv-1",
      paymentHash: "0xabc",
      amountShannon: 150_000_000n,
      asset: "CKB",
      status: "paid",
      paidAt: new Date("2026-07-01T11:05:00Z"),
      metadata: { orderId: "123" },
    });
    await triggerWebhook(invoice, WebhookEvent.PaymentPaid);

    const insertedValues = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Array<{ payload: unknown }>;
    expect(insertedValues[0]?.payload).toMatchObject({
      event: "payment.paid",
      data: {
        invoice_id: "inv-1",
        payment_hash: "0xabc",
        amount: 1.5,
        asset: "CKB",
        paid_at: "2026-07-01T11:05:00.000Z",
        metadata: { orderId: "123" },
      },
    });
  });

  it("sets paid_at: null in the payload for invoice.expired and invoice.failed", async () => {
    vi.mocked(db.select).mockReturnValue(
      createQueryChain([buildWebhookEndpointRow({ events: ["invoice.expired"] })]) as unknown as ReturnType<
        typeof db.select
      >,
    );
    const insertChain = createQueryChain([{ id: "delivery-1" }]);
    vi.mocked(db.insert).mockReturnValue(insertChain as unknown as ReturnType<typeof db.insert>);

    const invoice = buildInvoiceRow({ status: "expired", paidAt: null });
    await triggerWebhook(invoice, WebhookEvent.InvoiceExpired);

    const insertedValues = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Array<{
      payload: { data: { paid_at: unknown } };
    }>;
    expect(insertedValues[0]?.payload.data.paid_at).toBeNull();
  });
});
