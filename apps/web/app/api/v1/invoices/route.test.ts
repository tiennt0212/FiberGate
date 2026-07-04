import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { invoices } from "@/lib/db/schema";
import { FiberRpcTimeoutError, UnsupportedAssetError } from "@/lib/fiber/types";

// Mock at the module boundary CLAUDE.md designates — @/lib/db and
// @/lib/fiber/client — never @ckb-ccc/fiber directly (harness-brief.md
// "Risks"). Also mock @/lib/api/rate-limit so the 429 case is deterministic
// instead of depending on 100 real calls against its module-level counter
// (that counter is exercised for real in rate-limit.test.ts).
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));
vi.mock("@/lib/fiber/client", () => ({
  createInvoice: vi.fn(),
}));
vi.mock("@/lib/api/rate-limit", () => ({
  tryConsumeInvoiceCreationSlot: vi.fn(() => true),
}));

const { db } = await import("@/lib/db");
const { createInvoice } = await import("@/lib/fiber/client");
const { tryConsumeInvoiceCreationSlot } = await import("@/lib/api/rate-limit");
const { GET, POST } = await import("./route");

type InvoiceRow = typeof invoices.$inferSelect;

const TEST_SECRET = "test-secret";

function buildInvoiceRow(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: "9c858f5c-1b1a-4e1a-9c2e-8f6b2c9b6a11",
    paymentHash: "0xabc123",
    invoiceAddress: "fibt1qpayme",
    amountShannon: 150_000_000n,
    asset: "CKB",
    description: null,
    status: "pending",
    expiresAt: new Date("2026-07-01T12:00:00Z"),
    paidAt: null,
    metadata: null,
    createdAt: new Date("2026-07-01T11:00:00Z"),
    ...overrides,
  };
}

// A thenable that also exposes every Drizzle query-builder method used by
// this route (`from`/`where`/`orderBy`/`limit`/`values`/`returning`), each
// returning itself. Since it's a real Promise, `await` works no matter how
// many/which methods are chained before it — POST's insert chain
// (insert -> values -> returning) and GET's select chain (select -> from ->
// where -> orderBy -> limit) both terminate correctly against the same shape.
type QueryChain = Promise<InvoiceRow[]> & {
  from: (...args: unknown[]) => QueryChain;
  where: (...args: unknown[]) => QueryChain;
  orderBy: (...args: unknown[]) => QueryChain;
  limit: (...args: unknown[]) => QueryChain;
  values: (...args: unknown[]) => QueryChain;
  returning: (...args: unknown[]) => QueryChain;
};

function createQueryChain(rows: InvoiceRow[]): QueryChain {
  const chain = Promise.resolve(rows) as QueryChain;
  chain.from = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = () => chain;
  chain.values = () => chain;
  chain.returning = () => chain;
  return chain;
}

// db.select()/db.insert() are typed against the real Drizzle
// PgSelectBuilder/PgInsertBuilder at compile time (static `import { db }`
// resolves to @/lib/db's real exported type, regardless of the vi.mock()
// runtime replacement) — QueryChain intentionally only models the handful of
// chained methods the routes actually call, so it's narrower than those
// builder types. The `as unknown as` cast bridges that gap at the mock
// call site only; it never leaks into production code.
function mockSelectResult(rows: InvoiceRow[]): void {
  vi.mocked(db.select).mockReturnValue(createQueryChain(rows) as unknown as ReturnType<typeof db.select>);
}

function mockInsertResult(rows: InvoiceRow[]): void {
  vi.mocked(db.insert).mockReturnValue(createQueryChain(rows) as unknown as ReturnType<typeof db.insert>);
}

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
  mockSelectResult([]);
  mockInsertResult([]);
});

afterEach(() => {
  delete process.env.FIBERGATE_INTERNAL_SECRET;
  vi.clearAllMocks();
});

describe("POST /invoices", () => {
  it("returns 401 UNAUTHORIZED without ever touching the DB or Fiber client", async () => {
    const response = await POST(postRequest({ amount: 1, asset: "CKB" }, "Bearer wrong"));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(createInvoice).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
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

  it("returns 400 UNSUPPORTED_ASSET when the Fiber client rejects the asset", async () => {
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

  it("returns 201 with the created invoice on the happy path", async () => {
    vi.mocked(createInvoice).mockResolvedValue({
      invoiceAddress: "fibt1qpayme",
      paymentHash: "0xabc123",
      paymentPreimage: "0xdeadbeef",
    });
    const insertedRow = buildInvoiceRow();
    mockInsertResult([insertedRow]);

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
  it("returns 401 UNAUTHORIZED without touching the DB", async () => {
    const response = await GET(getRequest("", "Bearer wrong"));

    expect(response.status).toBe(401);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns 200 with an empty list when no filters are given", async () => {
    mockSelectResult([]);

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

  it("returns 200 when filtering by status", async () => {
    const row = buildInvoiceRow({ status: "paid", paidAt: new Date("2026-07-01T11:05:00Z") });
    mockSelectResult([row]);

    const response = await GET(getRequest("?status=paid"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ status: string }> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.status).toBe("paid");
  });

  it("returns 200 when filtering by asset", async () => {
    mockSelectResult([buildInvoiceRow()]);

    const response = await GET(getRequest("?asset=CKB"));

    expect(response.status).toBe(200);
  });

  it("returns 200 and clamps/echoes limit in the response meta", async () => {
    mockSelectResult([]);

    const response = await GET(getRequest("?limit=5"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { meta: { limit: number } };
    expect(body.meta.limit).toBe(5);
  });

  it("returns 200 and accepts a cursor param", async () => {
    mockSelectResult([]);
    const cursor = Buffer.from(
      JSON.stringify({ createdAt: "2026-07-01T11:00:00.000Z", id: buildInvoiceRow().id }),
    ).toString("base64url");

    const response = await GET(getRequest(`?cursor=${cursor}`));

    expect(response.status).toBe(200);
  });
});
