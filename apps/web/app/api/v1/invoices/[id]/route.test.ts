import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildInvoiceRow } from "@/lib/db/test-fixtures";

// Mock at the @/lib/services/invoices boundary — the UUID-guard-without-DB-
// query behavior this route used to assert on directly now lives in
// lib/services/invoices.test.ts ("returns null for a malformed UUID without
// querying the DB"); this route only needs to know the service resolved
// null vs. a row.
vi.mock("@/lib/services/invoices", () => ({
  getInvoiceById: vi.fn(),
}));

const { getInvoiceById } = await import("@/lib/services/invoices");
const { GET } = await import("./route");

const TEST_SECRET = "test-secret";
const VALID_UUID = "9c858f5c-1b1a-4e1a-9c2e-8f6b2c9b6a11";
const NONEXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

function getRequest(authHeader = `Bearer ${TEST_SECRET}`): NextRequest {
  return new NextRequest(`http://localhost/api/v1/invoices/${VALID_UUID}`, {
    headers: { authorization: authHeader },
  });
}

beforeEach(() => {
  process.env.FIBERGATE_INTERNAL_SECRET = TEST_SECRET;
  vi.mocked(getInvoiceById).mockResolvedValue(null);
});

afterEach(() => {
  delete process.env.FIBERGATE_INTERNAL_SECRET;
  vi.clearAllMocks();
});

describe("GET /invoices/:id", () => {
  it("returns 401 UNAUTHORIZED without ever calling the service", async () => {
    const response = await GET(getRequest("Bearer wrong"), { params: { id: VALID_UUID } });

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(getInvoiceById).not.toHaveBeenCalled();
  });

  it("returns 404 NOT_FOUND when the service resolves null", async () => {
    const response = await GET(getRequest(), { params: { id: NONEXISTENT_UUID } });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { data: null; error: { code: string } };
    expect(body.data).toBeNull();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 INTERNAL_ERROR when the service throws", async () => {
    vi.mocked(getInvoiceById).mockRejectedValue(new Error("connection reset"));

    const response = await GET(getRequest(), { params: { id: VALID_UUID } });

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("returns 200 with the invoice detail on the happy path", async () => {
    const row = buildInvoiceRow({
      id: VALID_UUID,
      status: "paid",
      paidAt: new Date("2026-07-01T11:05:00Z"),
    });
    vi.mocked(getInvoiceById).mockResolvedValue(row);

    const response = await GET(getRequest(), { params: { id: VALID_UUID } });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Record<string, unknown>; error: null };
    expect(body.error).toBeNull();
    expect(body.data).toMatchObject({
      id: row.id,
      invoice_address: row.invoiceAddress,
      payment_hash: row.paymentHash,
      amount: 1.5,
      asset: "CKB",
      status: "paid",
      paid_at: "2026-07-01T11:05:00.000Z",
    });
  });
});
