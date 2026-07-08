import { afterEach, describe, expect, it, vi } from "vitest";

import { buildInvoiceRow } from "@/lib/db/test-fixtures";

// Mock at the service-layer boundary (CLAUDE.md's route.test.ts pattern —
// actions.ts plays the same "thin controller" role as route.ts, just for
// Server Actions instead of REST routes), not @/lib/db directly.
vi.mock("@/lib/services/invoices", () => ({
  listInvoices: vi.fn(),
  getInvoiceById: vi.fn(),
}));
vi.mock("@/lib/services/webhooks", () => ({
  listWebhookDeliveries: vi.fn(),
}));

const { listInvoices, getInvoiceById } = await import("@/lib/services/invoices");
const { listWebhookDeliveries } = await import("@/lib/services/webhooks");
const { exportInvoicesCsv, getInvoiceReceipt } = await import("./actions");

afterEach(() => {
  vi.clearAllMocks();
});

describe("exportInvoicesCsv", () => {
  it("returns just the header row when there are no matching invoices", async () => {
    vi.mocked(listInvoices).mockResolvedValue({ rows: [], nextCursor: null });

    const csv = await exportInvoicesCsv({});

    expect(csv).toBe('"Invoice ID","Description","Amount","Asset","Status","Created At"');
  });

  it("formats rows: shannon -> CKB, null description -> empty, ISO date", async () => {
    const row = buildInvoiceRow({
      id: "inv-1",
      description: null,
      amountShannon: 150_000_000n,
      asset: "CKB",
      status: "paid",
      createdAt: new Date("2026-07-01T11:00:00.000Z"),
    });
    vi.mocked(listInvoices).mockResolvedValue({ rows: [row], nextCursor: null });

    const csv = await exportInvoicesCsv({});
    const lines = csv.split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('"inv-1","","1.5","CKB","paid","2026-07-01T11:00:00.000Z"');
  });

  it("keeps a description and quotes embedded commas", async () => {
    const row = buildInvoiceRow({ description: "Order #123, expedited" });
    vi.mocked(listInvoices).mockResolvedValue({ rows: [row], nextCursor: null });

    const csv = await exportInvoicesCsv({});

    expect(csv.split("\n")[1]).toContain('"Order #123, expedited"');
  });

  it("passes only valid status/asset filter values through to listInvoices", async () => {
    vi.mocked(listInvoices).mockResolvedValue({ rows: [], nextCursor: null });

    await exportInvoicesCsv({ status: "paid", asset: "CKB" });

    expect(listInvoices).toHaveBeenCalledWith(expect.objectContaining({ status: "paid", asset: "CKB" }));
  });

  it("drops an invalid status/asset instead of passing it through", async () => {
    vi.mocked(listInvoices).mockResolvedValue({ rows: [], nextCursor: null });

    await exportInvoicesCsv({ status: "not-a-real-status", asset: "not-a-real-asset" });

    expect(listInvoices).toHaveBeenCalledWith(expect.objectContaining({ status: undefined, asset: undefined }));
  });

  it("parses the date-range and amount-range filters before querying", async () => {
    vi.mocked(listInvoices).mockResolvedValue({ rows: [], nextCursor: null });

    await exportInvoicesCsv({ from: "2026-07-01", to: "2026-07-02", min: "1", max: "5" });

    expect(listInvoices).toHaveBeenCalledWith(
      expect.objectContaining({
        createdFrom: new Date("2026-07-01T00:00:00.000Z"),
        createdTo: new Date("2026-07-02T23:59:59.999Z"),
        amountMinShannon: 100_000_000n,
        amountMaxShannon: 500_000_000n,
      }),
    );
  });

  it("treats an empty search string as no filter, not a literal empty-string search", async () => {
    vi.mocked(listInvoices).mockResolvedValue({ rows: [], nextCursor: null });

    await exportInvoicesCsv({ search: "" });

    expect(listInvoices).toHaveBeenCalledWith(expect.objectContaining({ search: undefined }));
  });
});

describe("getInvoiceReceipt", () => {
  it("returns null without fabricating a receipt when the invoice does not exist", async () => {
    vi.mocked(getInvoiceById).mockResolvedValue(null);
    vi.mocked(listWebhookDeliveries).mockResolvedValue({ rows: [], nextCursor: null });

    const receipt = await getInvoiceReceipt("missing-id");

    expect(receipt).toBeNull();
  });

  it("fetches the invoice and its deliveries in parallel (both called even though only one result matters on a miss)", async () => {
    vi.mocked(getInvoiceById).mockResolvedValue(null);
    vi.mocked(listWebhookDeliveries).mockResolvedValue({ rows: [], nextCursor: null });

    await getInvoiceReceipt("missing-id");

    expect(listWebhookDeliveries).toHaveBeenCalledWith({ invoiceId: "missing-id", limit: 20 });
  });

  it("shapes a found invoice: shannon -> CKB, dates -> ISO strings, deliveries mapped", async () => {
    const invoice = buildInvoiceRow({
      id: "inv-1",
      description: "Order #1",
      amountShannon: 250_000_000n,
      asset: "CKB",
      status: "paid",
      paymentHash: "0xhash",
      invoiceAddress: "fibt1qaddr",
      createdAt: new Date("2026-07-01T11:00:00.000Z"),
      paidAt: new Date("2026-07-01T11:05:00.000Z"),
      expiresAt: new Date("2026-07-01T12:00:00.000Z"),
    });
    // listWebhookDeliveries() returns the joined WebhookDeliveryListItem shape,
    // not a raw WebhookDeliveryRow — build one directly (no dedicated fixture
    // exists for it) rather than misusing buildWebhookDeliveryRow() here.
    const deliveryListItem = {
      id: "dl-1",
      invoiceId: "inv-1",
      eventType: "payment.paid",
      endpointId: "endpoint-1",
      endpointUrl: "https://merchant.example.com/webhooks",
      httpStatus: 200,
      status: "success",
      attemptCount: 1,
      deliveredAt: new Date("2026-07-01T11:06:00.000Z"),
      createdAt: new Date("2026-07-01T11:05:00.000Z"),
    };
    vi.mocked(getInvoiceById).mockResolvedValue(invoice);
    vi.mocked(listWebhookDeliveries).mockResolvedValue({ rows: [deliveryListItem], nextCursor: null });

    const receipt = await getInvoiceReceipt("inv-1");

    expect(receipt).toEqual({
      id: "inv-1",
      description: "Order #1",
      amountCkb: 2.5,
      asset: "CKB",
      status: "paid",
      paymentHash: "0xhash",
      invoiceAddress: "fibt1qaddr",
      createdAt: "2026-07-01T11:00:00.000Z",
      paidAt: "2026-07-01T11:05:00.000Z",
      expiresAt: "2026-07-01T12:00:00.000Z",
      deliveries: [
        {
          id: "dl-1",
          eventType: "payment.paid",
          endpointUrl: "https://merchant.example.com/webhooks",
          httpStatus: 200,
          status: "success",
          deliveredAt: "2026-07-01T11:06:00.000Z",
          createdAt: "2026-07-01T11:05:00.000Z",
        },
      ],
    });
  });

  it("returns null paidAt/createdAt as null, not a stringified null", async () => {
    const invoice = buildInvoiceRow({ paidAt: null, createdAt: null });
    vi.mocked(getInvoiceById).mockResolvedValue(invoice);
    vi.mocked(listWebhookDeliveries).mockResolvedValue({ rows: [], nextCursor: null });

    const receipt = await getInvoiceReceipt(invoice.id);

    expect(receipt?.paidAt).toBeNull();
    expect(receipt?.createdAt).toBeNull();
  });
});
