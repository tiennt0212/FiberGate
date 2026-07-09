import { afterEach, describe, expect, it, vi } from "vitest";

import { buildInvoiceRow, createQueryChain, type InvoiceRow } from "@/lib/db/test-fixtures";
import { ApiValidationError, type CreateInvoiceInput, type ListInvoicesQuery } from "@/lib/api/validation";
import { FiberRpcTimeoutError, UnsupportedAssetError } from "@/lib/fiber/types";

// Mock at the module boundary CLAUDE.md/decisions-log designate — @/lib/db
// and @/lib/fiber/client — never @ckb-ccc/fiber directly. This is the
// boundary the route tests used to mock at before the service layer existed;
// route.test.ts now mocks @/lib/services/invoices instead.
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));
vi.mock("@/lib/fiber/client", () => ({
  createInvoice: vi.fn(),
}));

const { db } = await import("@/lib/db");
const { createInvoice: createFiberInvoice } = await import("@/lib/fiber/client");
const { createInvoice, getInvoiceById, listInvoices, hasPaidInvoice, getInvoiceStats, getInvoiceFunnelStats } =
  await import("./invoices");

function mockSelectResult(rows: InvoiceRow[]) {
  const chain = createQueryChain(rows);
  vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);
  return chain;
}

function mockInsertResult(rows: InvoiceRow[]): void {
  vi.mocked(db.insert).mockReturnValue(createQueryChain(rows) as unknown as ReturnType<typeof db.insert>);
}

const CREATE_INPUT: CreateInvoiceInput = {
  amountCkb: 1.5,
  amountShannon: 150_000_000n,
  asset: "CKB",
  description: "Order #123",
  expiresInSeconds: 3600,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("createInvoice", () => {
  it("calls the Fiber client, inserts the returned invoice, and returns the row", async () => {
    vi.mocked(createFiberInvoice).mockResolvedValue({
      invoiceAddress: "fibt1qpayme",
      paymentHash: "0xabc123",
      paymentPreimage: "0xdeadbeef",
    });
    const insertedRow = buildInvoiceRow();
    mockInsertResult([insertedRow]);

    const row = await createInvoice(CREATE_INPUT);

    expect(row).toEqual(insertedRow);
    expect(createFiberInvoice).toHaveBeenCalledWith({
      amountShannon: CREATE_INPUT.amountShannon,
      asset: CREATE_INPUT.asset,
      description: CREATE_INPUT.description,
    });
  });

  it("propagates UnsupportedAssetError from the Fiber client without touching the DB", async () => {
    vi.mocked(createFiberInvoice).mockRejectedValue(new UnsupportedAssetError("CKB"));

    await expect(createInvoice(CREATE_INPUT)).rejects.toBeInstanceOf(UnsupportedAssetError);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("propagates a Fiber RPC timeout without touching the DB", async () => {
    vi.mocked(createFiberInvoice).mockRejectedValue(
      new FiberRpcTimeoutError("new_invoice", 5000, new Error("aborted")),
    );

    await expect(createInvoice(CREATE_INPUT)).rejects.toBeInstanceOf(FiberRpcTimeoutError);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("propagates a DB insert failure after the Fiber node already created the invoice", async () => {
    vi.mocked(createFiberInvoice).mockResolvedValue({
      invoiceAddress: "fibt1qpayme",
      paymentHash: "0xabc123",
      paymentPreimage: "0xdeadbeef",
    });
    vi.mocked(db.insert).mockImplementation(() => {
      throw new Error("connection refused");
    });

    await expect(createInvoice(CREATE_INPUT)).rejects.toThrow("connection refused");
  });

  it("logs and throws if the insert succeeds but returns no row", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createFiberInvoice).mockResolvedValue({
      invoiceAddress: "fibt1qpayme",
      paymentHash: "0xabc123",
      paymentPreimage: "0xdeadbeef",
    });
    mockInsertResult([]);

    await expect(createInvoice(CREATE_INPUT)).rejects.toThrow("Invoice insert returned no row");
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});

describe("listInvoices", () => {
  const BASE_QUERY: ListInvoicesQuery = { limit: 20 };

  it("returns an empty page with no next cursor", async () => {
    mockSelectResult([]);

    const result = await listInvoices(BASE_QUERY);

    expect(result.rows).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it("caps the query at limit + 1 and reports hasMore via a non-null cursor", async () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      buildInvoiceRow({ id: `row-${i}`, createdAt: new Date(2026, 6, 1, 12, i) }),
    );
    const chain = mockSelectResult(rows);

    const result = await listInvoices({ limit: 2 });

    expect(chain.limit).toHaveBeenCalledWith(3);
    expect(result.rows).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it("round-trips a cursor produced by a previous page into a decodable filter", async () => {
    mockSelectResult([]);
    const cursor = Buffer.from(
      JSON.stringify({ createdAt: "2026-07-01T11:00:00.000Z", id: buildInvoiceRow().id }),
    ).toString("base64url");

    await expect(listInvoices({ ...BASE_QUERY, cursor })).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
  });

  it("throws ApiValidationError for a malformed cursor, without querying the DB", async () => {
    mockSelectResult([]);

    await expect(listInvoices({ ...BASE_QUERY, cursor: "not-base64-json" })).rejects.toBeInstanceOf(
      ApiValidationError,
    );
  });

  it("applies the dashboard-only search/date-range/amount-range filters as extra WHERE conditions", async () => {
    const chain = mockSelectResult([]);

    await listInvoices({
      ...BASE_QUERY,
      search: "order",
      createdFrom: new Date("2026-06-01T00:00:00Z"),
      createdTo: new Date("2026-07-01T00:00:00Z"),
      amountMinShannon: 100_000_000n,
      amountMaxShannon: 500_000_000n,
    });

    expect(chain.where).toHaveBeenCalled();
  });
});

describe("hasPaidInvoice", () => {
  it("returns true when at least one paid invoice exists", async () => {
    mockSelectResult([buildInvoiceRow({ status: "paid" })]);

    await expect(hasPaidInvoice()).resolves.toBe(true);
  });

  it("returns false when no paid invoice exists", async () => {
    mockSelectResult([]);

    await expect(hasPaidInvoice()).resolves.toBe(false);
  });
});

describe("getInvoiceStats", () => {
  it("aggregates counts and per-asset paid volume, ignoring expired/failed rows", async () => {
    mockSelectResult([
      { status: "paid", asset: "CKB", amountShannon: 100_000_000n },
      { status: "paid", asset: "CKB", amountShannon: 200_000_000n },
      { status: "paid", asset: "RUSD", amountShannon: 50_000_000n },
      { status: "pending", asset: "CKB", amountShannon: 10_000_000n },
      { status: "expired", asset: "CKB", amountShannon: 5_000_000n },
      { status: "failed", asset: "CKB", amountShannon: 5_000_000n },
    ] as unknown as InvoiceRow[]);

    const stats = await getInvoiceStats();

    expect(stats).toEqual({
      totalCount: 6,
      paidCount: 3,
      pendingCount: 1,
      paidVolumeByAsset: { CKB: 300_000_000n, RUSD: 50_000_000n },
    });
  });

  it("returns zeroed stats when there are no invoices in the window", async () => {
    mockSelectResult([]);

    await expect(getInvoiceStats()).resolves.toEqual({
      totalCount: 0,
      paidCount: 0,
      pendingCount: 0,
      paidVolumeByAsset: {},
    });
  });
});

describe("getInvoiceFunnelStats", () => {
  it("computes paid%/expired% and avg time-to-payment, ignoring pending/failed rows", async () => {
    mockSelectResult([
      { status: "paid", createdAt: new Date("2026-07-01T00:00:00Z"), paidAt: new Date("2026-07-01T00:01:00Z") },
      { status: "paid", createdAt: new Date("2026-07-01T00:00:00Z"), paidAt: new Date("2026-07-01T00:03:00Z") },
      { status: "expired", createdAt: new Date("2026-07-01T00:00:00Z"), paidAt: null },
      { status: "pending", createdAt: new Date("2026-07-01T00:00:00Z"), paidAt: null },
    ] as unknown as InvoiceRow[]);

    const funnel = await getInvoiceFunnelStats();

    expect(funnel).toEqual({
      paidPct: 50,
      expiredPct: 25,
      avgTimeToPaymentSeconds: 120,
    });
  });

  it("returns 0%/0%/null when there are no invoices in the window", async () => {
    mockSelectResult([]);

    await expect(getInvoiceFunnelStats()).resolves.toEqual({
      paidPct: 0,
      expiredPct: 0,
      avgTimeToPaymentSeconds: null,
    });
  });

  it("returns null avgTimeToPaymentSeconds when nothing has been paid yet", async () => {
    mockSelectResult([
      { status: "pending", createdAt: new Date("2026-07-01T00:00:00Z"), paidAt: null },
    ] as unknown as InvoiceRow[]);

    const funnel = await getInvoiceFunnelStats();

    expect(funnel.avgTimeToPaymentSeconds).toBeNull();
  });
});

describe("getInvoiceById", () => {
  it("returns null for a malformed UUID without querying the DB", async () => {
    const row = await getInvoiceById("not-a-uuid");

    expect(row).toBeNull();
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns null for a well-formed UUID with no matching row", async () => {
    mockSelectResult([]);

    const row = await getInvoiceById("9c858f5c-1b1a-4e1a-9c2e-8f6b2c9b6a11");

    expect(row).toBeNull();
  });

  it("returns the matching row", async () => {
    const invoiceRow = buildInvoiceRow();
    mockSelectResult([invoiceRow]);

    const row = await getInvoiceById(invoiceRow.id);

    expect(row).toEqual(invoiceRow);
  });
});
