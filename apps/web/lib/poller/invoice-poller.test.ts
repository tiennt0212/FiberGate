import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { invoices } from "@/lib/db/schema";
import { FiberRpcTimeoutError } from "@/lib/fiber/types";

// Mock at the module boundary CLAUDE.md/decisions-log designate — @/lib/db,
// @/lib/fiber/client, and (new for this poller) @/lib/webhooks/trigger —
// never @ckb-ccc/fiber directly.
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("@/lib/fiber/client", () => ({
  getInvoiceStatus: vi.fn(),
}));
vi.mock("@/lib/webhooks/trigger", () => ({
  triggerWebhook: vi.fn(),
  WebhookEvent: {
    PaymentPaid: "payment.paid",
    InvoiceExpired: "invoice.expired",
    InvoiceFailed: "invoice.failed",
  },
}));

const { db } = await import("@/lib/db");
const { getInvoiceStatus } = await import("@/lib/fiber/client");
const { triggerWebhook } = await import("@/lib/webhooks/trigger");
const { runPollCycle } = await import("./invoice-poller");

type InvoiceRow = typeof invoices.$inferSelect;

const NOW = new Date("2026-07-01T12:00:00Z");

function buildInvoiceRow(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: "9c858f5c-1b1a-4e1a-9c2e-8f6b2c9b6a11",
    paymentHash: "0xabc123",
    invoiceAddress: "fibt1qpayme",
    amountShannon: 150_000_000n,
    asset: "CKB",
    description: null,
    status: "pending",
    expiresAt: new Date("2026-07-01T13:00:00Z"),
    paidAt: null,
    metadata: null,
    createdAt: new Date("2026-07-01T11:00:00Z"),
    ...overrides,
  };
}

// Query-chain double mirroring app/api/v1/invoices/route.test.ts's
// createQueryChain, extended with update()/set() for the poller's UPDATE
// statements. Each chain method is a vi.fn() (not a plain arrow function) so
// individual tests can assert on call args (e.g. the batch cap in the
// "caps the batch" test below) when that's the thing under test.
type QueryChain = Promise<InvoiceRow[]> & {
  from: (...args: unknown[]) => QueryChain;
  where: (...args: unknown[]) => QueryChain;
  limit: (...args: unknown[]) => QueryChain;
  set: (...args: unknown[]) => QueryChain;
  returning: (...args: unknown[]) => QueryChain;
};

function createQueryChain(rows: InvoiceRow[]): QueryChain {
  const chain = Promise.resolve(rows) as QueryChain;
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.returning = vi.fn(() => chain);
  return chain;
}

function mockSelectResult(rows: InvoiceRow[]): QueryChain {
  const chain = createQueryChain(rows);
  vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);
  return chain;
}

// The poller can issue more than one db.update() call per cycle (the bulk
// expire-overdue step, then up to one per polled invoice) — each queued
// result corresponds to one call, in call order. mockReset() first so this
// call fully replaces the queue instead of appending to whatever beforeEach
// (or an earlier call within the same test) already queued —
// vi.clearAllMocks() clears call history but NOT queued
// mockReturnValueOnce() implementations, so without this reset, queues from
// different setup calls silently stack and desync from actual call order.
function mockUpdateResults(rowsList: InvoiceRow[][]): void {
  const mockedUpdate = vi.mocked(db.update);
  mockedUpdate.mockReset();
  for (const rows of rowsList) {
    mockedUpdate.mockReturnValueOnce(createQueryChain(rows) as unknown as ReturnType<typeof db.update>);
  }
}

beforeEach(() => {
  mockSelectResult([]);
  mockUpdateResults([[]]); // default: the bulk expire-overdue step touches nothing
});

afterEach(() => {
  // resetAllMocks() (not clearAllMocks()) — also drops queued
  // mockReturnValueOnce/mockResolvedValueOnce implementations between
  // tests, not just call history, so no test can inherit leftover queue
  // state from whichever test ran directly before it.
  vi.resetAllMocks();
});

describe("runPollCycle — BR-STS-002(b) bulk expiry", () => {
  it("bulk-expires clock-overdue pending invoices without an RPC call, and fires invoice.expired", async () => {
    const overdueRow = buildInvoiceRow({
      status: "expired",
      expiresAt: new Date("2026-07-01T10:00:00Z"),
    });
    mockUpdateResults([[overdueRow]]);
    mockSelectResult([]);

    await runPollCycle(NOW);

    expect(getInvoiceStatus).not.toHaveBeenCalled();
    expect(triggerWebhook).toHaveBeenCalledWith(overdueRow, "invoice.expired");
  });
});

describe("runPollCycle — RPC-driven batch", () => {
  it("caps the batch query at 50 (BR-POL-003)", async () => {
    const chain = mockSelectResult([]);

    await runPollCycle(NOW);

    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it("skips a timed-out invoice, logs it, and leaves its status untouched (BR-POL-004)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const row = buildInvoiceRow();
    mockSelectResult([row]);
    vi.mocked(getInvoiceStatus).mockRejectedValue(
      new FiberRpcTimeoutError("get_invoice", 5000, new Error("aborted")),
    );

    await runPollCycle(NOW);

    // Only the bulk-expire update ran; no per-invoice update for the
    // timed-out row.
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(triggerWebhook).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("skips an invoice on a non-timeout error too, without aborting the rest of the batch", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failingRow = buildInvoiceRow({ id: "row-1", paymentHash: "0x1" });
    const okRow = buildInvoiceRow({ id: "row-2", paymentHash: "0x2" });
    mockSelectResult([failingRow, okRow]);
    mockUpdateResults([
      [], // bulk expire-overdue step
      [{ ...okRow, status: "paid", paidAt: NOW }], // per-invoice update for okRow
    ]);
    vi.mocked(getInvoiceStatus)
      .mockRejectedValueOnce(new Error("node connection reset"))
      .mockResolvedValueOnce({ invoiceAddress: okRow.invoiceAddress, status: "Paid" });

    await runPollCycle(NOW);

    expect(getInvoiceStatus).toHaveBeenCalledTimes(2);
    expect(triggerWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ id: "row-2", status: "paid" }),
      "payment.paid",
    );
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("maps node status Paid to invoices.status=paid and fires payment.paid", async () => {
    const row = buildInvoiceRow();
    const updatedRow = { ...row, status: "paid" as const, paidAt: NOW };
    mockSelectResult([row]);
    mockUpdateResults([[], [updatedRow]]);
    vi.mocked(getInvoiceStatus).mockResolvedValue({
      invoiceAddress: row.invoiceAddress,
      status: "Paid",
    });

    await runPollCycle(NOW);

    expect(triggerWebhook).toHaveBeenCalledWith(updatedRow, "payment.paid");
  });

  it("maps node status Cancelled to invoices.status=failed and fires invoice.failed (BR-STS-003)", async () => {
    const row = buildInvoiceRow();
    const updatedRow = { ...row, status: "failed" as const };
    mockSelectResult([row]);
    mockUpdateResults([[], [updatedRow]]);
    vi.mocked(getInvoiceStatus).mockResolvedValue({
      invoiceAddress: row.invoiceAddress,
      status: "Cancelled",
    });

    await runPollCycle(NOW);

    expect(triggerWebhook).toHaveBeenCalledWith(updatedRow, "invoice.failed");
  });

  it("maps node status Expired to invoices.status=expired and fires invoice.expired (BR-STS-002(a))", async () => {
    const row = buildInvoiceRow();
    const updatedRow = { ...row, status: "expired" as const };
    mockSelectResult([row]);
    mockUpdateResults([[], [updatedRow]]);
    vi.mocked(getInvoiceStatus).mockResolvedValue({
      invoiceAddress: row.invoiceAddress,
      status: "Expired",
    });

    await runPollCycle(NOW);

    expect(triggerWebhook).toHaveBeenCalledWith(updatedRow, "invoice.expired");
  });

  it("leaves status pending and fires no webhook for node status Received (settlement pending)", async () => {
    const row = buildInvoiceRow();
    mockSelectResult([row]);
    vi.mocked(getInvoiceStatus).mockResolvedValue({
      invoiceAddress: row.invoiceAddress,
      status: "Received",
    });

    await runPollCycle(NOW);

    // Only the bulk-expire update ran; no per-invoice update for this row.
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(triggerWebhook).not.toHaveBeenCalled();
  });

  it("leaves status pending and fires no webhook for node status Open", async () => {
    const row = buildInvoiceRow();
    mockSelectResult([row]);
    vi.mocked(getInvoiceStatus).mockResolvedValue({
      invoiceAddress: row.invoiceAddress,
      status: "Open",
    });

    await runPollCycle(NOW);

    expect(db.update).toHaveBeenCalledTimes(1);
    expect(triggerWebhook).not.toHaveBeenCalled();
  });
});
