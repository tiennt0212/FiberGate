import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildInvoiceRow } from "@/lib/db/test-fixtures";
import { FiberRpcTimeoutError, UnsupportedAssetError } from "@/lib/fiber/types";

// Mock at the @/lib/services/invoices boundary — this route delegates all
// DB/Fiber work there now; lib/services/invoices.test.ts covers that layer's
// own @/lib/db + @/lib/fiber/client mocking. Also mock @/lib/api/rate-limit
// so the 429 case is deterministic instead of depending on 100 real calls
// against its module-level counter (that counter is exercised for real in
// rate-limit.test.ts).
vi.mock("@/lib/services/invoices", () => ({
  createInvoice: vi.fn(),
  listInvoices: vi.fn(),
}));
vi.mock("@/lib/api/rate-limit", () => ({
  tryConsumeInvoiceCreationSlot: vi.fn(() => true),
}));

const { createInvoice, listInvoices } = await import("@/lib/services/invoices");
const { tryConsumeInvoiceCreationSlot } = await import("@/lib/api/rate-limit");
const { GET, POST } = await import("./route");

const TEST_SECRET = "test-secret";

function postRequest(body: unknown, authHeader = `Bearer ${TEST_SECRET}`): NextRequest {
  return new NextRequest("http://localhost/api/v1/invoices", {
    method: "POST",
    headers: { authorization: authHeader, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getRequest(query = "", authHeader = `Bearer ${TEST_SECRET}`): NextRequest {
  return new NextRequest(`http://localhost/api/v1/invoices${query}`, {
    headers: { authorization: authHeader },
  });
}

beforeEach(() => {
  process.env.FIBERGATE_INTERNAL_SECRET = TEST_SECRET;
  vi.mocked(tryConsumeInvoiceCreationSlot).mockReturnValue(true);
  vi.mocked(listInvoices).mockResolvedValue({ rows: [], nextCursor: null });
});

afterEach(() => {
  delete process.env.FIBERGATE_INTERNAL_SECRET;
  vi.clearAllMocks();
});

describe("POST /invoices", () => {
  it("returns 401 UNAUTHORIZED without ever calling the service", async () => {
    const response = await POST(postRequest({ amount: 1, asset: "CKB" }, "Bearer wrong"));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it("returns 429 RATE_LIMITED when the deployment-wide budget is exhausted", async () => {
    vi.mocked(tryConsumeInvoiceCreationSlot).mockReturnValue(false);

    const response = await POST(postRequest({ amount: 1, asset: "CKB" }));

    expect(response.status).toBe(429);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("returns 400 INVALID_AMOUNT for an out-of-range amount", async () => {
    const response = await POST(postRequest({ amount: 0, asset: "CKB" }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_AMOUNT");
  });

  it("returns 400 VALIDATION_ERROR for a malformed expires_in", async () => {
    const response = await POST(
      postRequest({ amount: 1, asset: "CKB", expires_in: "not-a-number" }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR for a malformed JSON body", async () => {
    const request = new NextRequest("http://localhost/api/v1/invoices", {
      method: "POST",
      headers: { authorization: `Bearer ${TEST_SECRET}`, "content-type": "application/json" },
      body: "{not json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 UNSUPPORTED_ASSET when the service rejects the asset", async () => {
    vi.mocked(createInvoice).mockRejectedValue(new UnsupportedAssetError("RUSD"));

    const response = await POST(postRequest({ amount: 1, asset: "RUSD" }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNSUPPORTED_ASSET");
  });

  it("returns 503 NODE_UNAVAILABLE when the Fiber node times out", async () => {
    vi.mocked(createInvoice).mockRejectedValue(
      new FiberRpcTimeoutError("new_invoice", 5000, new Error("aborted")),
    );

    const response = await POST(postRequest({ amount: 1, asset: "CKB" }));

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NODE_UNAVAILABLE");
  });

  it("returns 500 INTERNAL_ERROR for any other service failure", async () => {
    vi.mocked(createInvoice).mockRejectedValue(new Error("connection refused"));

    const response = await POST(postRequest({ amount: 1, asset: "CKB" }));

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("returns 201 with the created invoice on the happy path", async () => {
    const insertedRow = buildInvoiceRow();
    vi.mocked(createInvoice).mockResolvedValue(insertedRow);

    const response = await POST(
      postRequest({ amount: 1.5, asset: "CKB", description: "Order #123" }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      data: Record<string, unknown>;
      error: null;
    };
    expect(body.error).toBeNull();
    expect(body.data).toMatchObject({
      id: insertedRow.id,
      invoice_address: insertedRow.invoiceAddress,
      payment_hash: insertedRow.paymentHash,
      amount: 1.5,
      asset: "CKB",
      status: "pending",
    });
    expect(body.data).not.toHaveProperty("paid_at");
  });
});

describe("GET /invoices", () => {
  it("returns 401 UNAUTHORIZED without ever calling the service", async () => {
    const response = await GET(getRequest("", "Bearer wrong"));

    expect(response.status).toBe(401);
    expect(listInvoices).not.toHaveBeenCalled();
  });

  it("returns 200 with an empty list when no filters are given", async () => {
    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: unknown[];
      error: null;
      meta: { limit: number; next_cursor: string | null };
    };
    expect(body.error).toBeNull();
    expect(body.data).toEqual([]);
    expect(body.meta).toEqual({ limit: 20, next_cursor: null });
  });

  it("returns 200 when the service resolves rows", async () => {
    const row = buildInvoiceRow({ status: "paid", paidAt: new Date("2026-07-01T11:05:00Z") });
    vi.mocked(listInvoices).mockResolvedValue({ rows: [row], nextCursor: null });

    const response = await GET(getRequest("?status=paid"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ status: string }> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.status).toBe("paid");
  });

  it("returns 400 VALIDATION_ERROR for an unsupported status filter", async () => {
    const response = await GET(getRequest("?status=not-a-status"));

    expect(response.status).toBe(400);
    expect(listInvoices).not.toHaveBeenCalled();
  });

  it("returns 200 and clamps/echoes limit in the response meta", async () => {
    const response = await GET(getRequest("?limit=5"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { meta: { limit: number } };
    expect(body.meta.limit).toBe(5);
  });

  it("returns 400 VALIDATION_ERROR when the service rejects a malformed cursor", async () => {
    const { ApiValidationError } = await import("@/lib/api/validation");
    vi.mocked(listInvoices).mockRejectedValue(
      new ApiValidationError("VALIDATION_ERROR", "Invalid cursor: bad payload"),
    );

    const response = await GET(getRequest("?cursor=not-base64-json"));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 500 INTERNAL_ERROR for any other service failure", async () => {
    vi.mocked(listInvoices).mockRejectedValue(new Error("connection reset"));

    const response = await GET(getRequest());

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
