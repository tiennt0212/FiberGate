import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { invoices } from "@/lib/db/schema";

// Mock at the @/lib/db module boundary, per CLAUDE.md / harness-brief.md
// "Risks" — this route has no Fiber client dependency at all.
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

const { db } = await import("@/lib/db");
const { GET } = await import("./route");

type InvoiceRow = typeof invoices.$inferSelect;

const TEST_SECRET = "test-secret";
const VALID_UUID = "9c858f5c-1b1a-4e1a-9c2e-8f6b2c9b6a11";
const NONEXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

function buildInvoiceRow(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: VALID_UUID,
    paymentHash: "0xabc123",
    invoiceAddress: "fibt1qpayme",
    amountShannon: 150_000_000n,
    asset: "CKB",
    description: null,
    status: "paid",
    expiresAt: new Date("2026-07-01T12:00:00Z"),
    paidAt: new Date("2026-07-01T11:05:00Z"),
    metadata: null,
    createdAt: new Date("2026-07-01T11:00:00Z"),
    ...overrides,
  };
}

// See app/api/v1/invoices/route.test.ts for why this thenable-plus-methods
// shape is used to double for Drizzle's chainable query builder.
type SelectChain = Promise<InvoiceRow[]> & {
  from: (...args: unknown[]) => SelectChain;
  where: (...args: unknown[]) => SelectChain;
  limit: (...args: unknown[]) => SelectChain;
};

function createSelectChain(rows: InvoiceRow[]): SelectChain {
  const chain = Promise.resolve(rows) as SelectChain;
  chain.from = () => chain;
  chain.where = () => chain;
  chain.limit = () => chain;
  return chain;
}

// See app/api/v1/invoices/route.test.ts for why this `as unknown as` cast is
// needed: static `import { db }` resolves to @/lib/db's real Drizzle type
// regardless of the vi.mock() runtime replacement, and SelectChain only
// models the chained methods this route actually calls.
function mockSelectResult(rows: InvoiceRow[]): void {
  vi.mocked(db.select).mockReturnValue(createSelectChain(rows) as unknown as ReturnType<typeof db.select>);
}

function getRequest(authHeader = `Bearer ${TEST_SECRET}`): NextRequest {
  return new NextRequest(`http://localhost/api/v1/invoices/${VALID_UUID}`, {
    headers: { authorization: authHeader },
  });
}

beforeEach(() => {
  process.env.FIBERGATE_INTERNAL_SECRET = TEST_SECRET;
  mockSelectResult([]);
});

afterEach(() => {
  delete process.env.FIBERGATE_INTERNAL_SECRET;
  vi.clearAllMocks();
});

describe("GET /invoices/:id", () => {
  it("returns 401 UNAUTHORIZED without touching the DB", async () => {
    const response = await GET(getRequest("Bearer wrong"), { params: { id: VALID_UUID } });

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns 404 NOT_FOUND for a well-formed UUID with no matching row", async () => {
    mockSelectResult([]);

    const response = await GET(getRequest(), { params: { id: NONEXISTENT_UUID } });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { data: null; error: { code: string } };
    expect(body.data).toBeNull();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 NOT_FOUND for a param that isn't even a UUID, without querying the DB", async () => {
    const response = await GET(getRequest(), { params: { id: "not-a-uuid" } });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns 200 with the invoice detail on the happy path", async () => {
    const row = buildInvoiceRow();
    mockSelectResult([row]);

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
