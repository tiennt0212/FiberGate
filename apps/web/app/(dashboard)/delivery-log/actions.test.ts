import { afterEach, describe, expect, it, vi } from "vitest";

// Mock at the service-layer boundary (CLAUDE.md's route.test.ts pattern —
// actions.ts plays the same "thin controller" role as route.ts, just for
// Server Actions instead of REST routes), not @/lib/db directly.
vi.mock("@/lib/services/webhooks", () => ({
  listWebhookDeliveries: vi.fn(),
  resendDelivery: vi.fn(),
}));

const { listWebhookDeliveries, resendDelivery } = await import("@/lib/services/webhooks");
const { exportDeliveryLogCsv, retryDelivery } = await import("./actions");

afterEach(() => {
  vi.clearAllMocks();
});

function buildListItem(overrides: Partial<Awaited<ReturnType<typeof listWebhookDeliveries>>["rows"][number]> = {}) {
  return {
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
    ...overrides,
  };
}

describe("exportDeliveryLogCsv", () => {
  it("returns just the header row when there are no matching deliveries", async () => {
    vi.mocked(listWebhookDeliveries).mockResolvedValue({ rows: [], nextCursor: null });

    const csv = await exportDeliveryLogCsv({});

    expect(csv).toBe('"Invoice ID","Event","Endpoint","HTTP Status","Delivery Status","Delivered/Created At"');
  });

  it("formats a delivered row, preferring deliveredAt over createdAt", async () => {
    vi.mocked(listWebhookDeliveries).mockResolvedValue({ rows: [buildListItem()], nextCursor: null });

    const csv = await exportDeliveryLogCsv({});

    expect(csv.split("\n")[1]).toBe(
      '"inv-1","payment.paid","https://merchant.example.com/webhooks","200","success","2026-07-01T11:06:00.000Z"',
    );
  });

  it("falls back to createdAt and blank HTTP status for a still-pending delivery", async () => {
    const pending = buildListItem({ invoiceId: null, endpointUrl: null, httpStatus: null, status: "pending", deliveredAt: null });
    vi.mocked(listWebhookDeliveries).mockResolvedValue({ rows: [pending], nextCursor: null });

    const csv = await exportDeliveryLogCsv({});

    expect(csv.split("\n")[1]).toBe('"","payment.paid","","","pending","2026-07-01T11:05:00.000Z"');
  });

  it("passes endpointId, a valid status, and the parsed date range through to the query", async () => {
    vi.mocked(listWebhookDeliveries).mockResolvedValue({ rows: [], nextCursor: null });

    await exportDeliveryLogCsv({ endpointId: "endpoint-1", status: "failed", from: "2026-07-01", to: "2026-07-02" });

    expect(listWebhookDeliveries).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointId: "endpoint-1",
        status: "failed",
        createdFrom: new Date("2026-07-01T00:00:00.000Z"),
        createdTo: new Date("2026-07-02T23:59:59.999Z"),
      }),
    );
  });

  it("drops an invalid status instead of passing it through", async () => {
    vi.mocked(listWebhookDeliveries).mockResolvedValue({ rows: [], nextCursor: null });

    await exportDeliveryLogCsv({ status: "not-a-real-status" });

    expect(listWebhookDeliveries).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });

  it("treats an empty search string as no filter, not a literal empty-string search", async () => {
    vi.mocked(listWebhookDeliveries).mockResolvedValue({ rows: [], nextCursor: null });

    await exportDeliveryLogCsv({ search: "" });

    expect(listWebhookDeliveries).toHaveBeenCalledWith(expect.objectContaining({ search: undefined }));
  });
});

describe("retryDelivery", () => {
  it("returns ok:true on success", async () => {
    vi.mocked(resendDelivery).mockResolvedValue({} as Awaited<ReturnType<typeof resendDelivery>>);

    const result = await retryDelivery("dl-1");

    expect(result).toEqual({ ok: true });
    expect(resendDelivery).toHaveBeenCalledWith("dl-1");
  });

  it("returns a generic ok:false error instead of throwing when resendDelivery fails", async () => {
    vi.mocked(resendDelivery).mockRejectedValue(new Error("BR-WHK-006: delivery is not retryable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await retryDelivery("dl-1");

    expect(result).toEqual({ ok: false, error: "Could not retry this delivery." });
    consoleError.mockRestore();
  });
});
