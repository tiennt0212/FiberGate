import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildInvoiceRow, createQueryChain, type InvoiceRow, type QueryChain } from "@/lib/db/test-fixtures";
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
vi.mock("@/lib/webhooks/trigger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/webhooks/trigger")>()),
  triggerWebhook: vi.fn(),
}));

const { db } = await import("@/lib/db");
const { getInvoiceStatus } = await import("@/lib/fiber/client");
const { triggerWebhook } = await import("@/lib/webhooks/trigger");
const { runPollCycle } = await import("./invoice-poller");

const NOW = new Date("2026-07-01T12:00:00Z");

function mockSelectResult(rows: InvoiceRow[]): QueryChain {
  const chain = createQueryChain(rows);
  vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);
  return chain;
}

// The poller can issue more than one db.update() call per cycle (up to one
// per polled invoice, then the bulk expire-overdue step — pollPendingBatch()
// runs before expireOverdueInvoices() in runPollCycle(), see its doc
// comment) — each queued result corresponds to one call, in call order.
// mockReset() first so this
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

  it("polls the Fiber node before bulk-expiring, so a payment settling right at expiry is observed as paid instead of expired", async () => {
    // expiresAt is in the past (overdue) but well within BR-POL-002's 60s
    // window, so it's eligible for BOTH steps — this is exactly the race
    // the fix guards against: if expireOverdueInvoices() ran first, this
    // row would be swept to 'expired' before ever getting an RPC check.
    const row = buildInvoiceRow({ expiresAt: new Date("2026-07-01T11:59:59Z") });
    const updatedRow = { ...row, status: "paid" as const, paidAt: NOW };
    mockSelectResult([row]);
    mockUpdateResults([[updatedRow], []]);
    vi.mocked(getInvoiceStatus).mockResolvedValue({
      invoiceAddress: row.invoiceAddress,
      status: "Paid",
    });

    await runPollCycle(NOW);

    expect(triggerWebhook).toHaveBeenCalledWith(updatedRow, "payment.paid");
    expect(triggerWebhook).not.toHaveBeenCalledWith(expect.anything(), "invoice.expired");

    // Order matters: the RPC-driven per-invoice update (call #1) must
    // happen before the clock-based bulk-expire update (call #2) —
    // reversing this order is exactly the regression this test guards
    // against.
    const [selectOrder] = vi.mocked(db.select).mock.invocationCallOrder;
    const [firstUpdateOrder, secondUpdateOrder] = vi.mocked(db.update).mock.invocationCallOrder;
    expect(selectOrder).toBeLessThan(secondUpdateOrder);
    expect(firstUpdateOrder).toBeLessThan(secondUpdateOrder);
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
      [{ ...okRow, status: "paid", paidAt: NOW }], // per-invoice update for okRow
      [], // bulk expire-overdue step
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

  it("isolates a failure applying a status update, without aborting the rest of the batch", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failingRow = buildInvoiceRow({ id: "row-1", paymentHash: "0x1" });
    const okRow = buildInvoiceRow({ id: "row-2", paymentHash: "0x2" });
    const updatedOkRow = { ...okRow, status: "paid" as const, paidAt: NOW };
    mockSelectResult([failingRow, okRow]);
    vi.mocked(getInvoiceStatus).mockResolvedValue({ invoiceAddress: "n/a", status: "Paid" });

    // Both invoices resolve a node status successfully — the failure is in
    // applyNodeStatus()'s DB update for failingRow, not in getInvoiceStatus().
    const mockedUpdate = vi.mocked(db.update);
    mockedUpdate.mockReset();
    mockedUpdate.mockImplementationOnce(() => {
      throw new Error("connection reset");
    });
    mockedUpdate.mockReturnValueOnce(
      createQueryChain([updatedOkRow]) as unknown as ReturnType<typeof db.update>,
    );
    mockedUpdate.mockReturnValueOnce(
      createQueryChain([]) as unknown as ReturnType<typeof db.update>, // bulk expire-overdue step
    );

    await runPollCycle(NOW);

    expect(triggerWebhook).toHaveBeenCalledWith(updatedOkRow, "payment.paid");
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("maps node status Paid to invoices.status=paid and fires payment.paid", async () => {
    const row = buildInvoiceRow();
    const updatedRow = { ...row, status: "paid" as const, paidAt: NOW };
    mockSelectResult([row]);
    mockUpdateResults([[updatedRow], []]);
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
    mockUpdateResults([[updatedRow], []]);
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
    mockUpdateResults([[updatedRow], []]);
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

describe("runPollCycle — per-cycle summary logging", () => {
  it("logs a summary line even when nothing happened (checked=0, none expired) — human decision 2026-07-11, Activity page must show the poller is alive", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockSelectResult([]);
    mockUpdateResults([[]]);

    await runPollCycle(NOW);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("poll cycle: checked 0 pending invoice(s), 0 clock-expired"),
    );

    consoleLogSpy.mockRestore();
  });
});
