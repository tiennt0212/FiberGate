import { vi } from "vitest";

import type { InvoiceRow } from "@/lib/db/schema";

export type { InvoiceRow };

export function buildInvoiceRow(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
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

// A thenable that also exposes every Drizzle query-builder method used across
// the invoices route and poller tests (from/where/orderBy/limit/values/set/
// returning), each returning itself. Since it's a real Promise, `await`
// works no matter how many/which methods are chained before it. Each method
// is a vi.fn() so a test can assert on call args (e.g. the batch-size cap)
// when that's the thing under test, not just use it as a passthrough stub.
export type QueryChain = Promise<InvoiceRow[]> & {
  from: (...args: unknown[]) => QueryChain;
  where: (...args: unknown[]) => QueryChain;
  orderBy: (...args: unknown[]) => QueryChain;
  limit: (...args: unknown[]) => QueryChain;
  values: (...args: unknown[]) => QueryChain;
  set: (...args: unknown[]) => QueryChain;
  returning: (...args: unknown[]) => QueryChain;
};

export function createQueryChain(rows: InvoiceRow[]): QueryChain {
  const chain = Promise.resolve(rows) as QueryChain;
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.returning = vi.fn(() => chain);
  return chain;
}
