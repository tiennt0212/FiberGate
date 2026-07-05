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
const { createInvoice, getInvoiceById, listInvoices } = await import("./invoices");

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
    vi.mocked(createFiberInvoice).mockRejectedValue(new UnsupportedAssetError("RUSD"));

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
