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
// the invoices/webhooks route and poller tests (from/where/orderBy/limit/
// values/set/returning), each returning itself. Since it's a real Promise,
// `await` works no matter how many/which methods are chained before it. Each
// method is a vi.fn() so a test can assert on call args (e.g. the batch-size
// cap) when that's the thing under test, not just use it as a passthrough
// stub. Generic over row type so non-invoice tables (webhook_endpoints,
// webhook_deliveries) can reuse this instead of redefining it locally.
export type QueryChain<T = InvoiceRow> = Promise<T[]> & {
  from: (...args: unknown[]) => QueryChain<T>;
  where: (...args: unknown[]) => QueryChain<T>;
  orderBy: (...args: unknown[]) => QueryChain<T>;
  limit: (...args: unknown[]) => QueryChain<T>;
  values: (...args: unknown[]) => QueryChain<T>;
  set: (...args: unknown[]) => QueryChain<T>;
  returning: (...args: unknown[]) => QueryChain<T>;
  // Joined queries (e.g. listWebhookDeliveries()'s webhook_endpoints/invoices
  // join) chain .leftJoin() one or more times before .where()/.orderBy().
  leftJoin: (...args: unknown[]) => QueryChain<T>;
  // listWebhookDeliveries() calls .$dynamic() to allow a conditional
  // .leftJoin() afterward (Drizzle's real $dynamic() only flips a type-level
  // flag; the runtime object is unchanged) — a no-op passthrough here too.
  $dynamic: (...args: unknown[]) => QueryChain<T>;
};

export function createQueryChain<T = InvoiceRow>(rows: T[]): QueryChain<T> {
  const chain = Promise.resolve(rows) as QueryChain<T>;
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.returning = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.$dynamic = vi.fn(() => chain);
  return chain;
}
