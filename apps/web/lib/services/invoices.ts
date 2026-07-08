import { and, desc, eq, gte, ilike, lt, lte, or, sql, type SQL } from "drizzle-orm";

import { isValidUuid, type CreateInvoiceInput, type ListInvoicesQuery } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { decodeCursor, encodeCursor } from "@/lib/db/cursor";
import { invoices, type InvoiceRow } from "@/lib/db/schema";
import { createInvoice as createFiberInvoice } from "@/lib/fiber/client";

// Business logic for the invoices table: everything in app/api/v1/invoices/**
// that isn't auth, request parsing, or response shaping lives here, so
// there's one place to look for how an invoice is created/listed/fetched.

export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceRow> {
  // Two separate try/catch blocks (Fiber call vs. DB insert), not one merged
  // block — collapsing them would erase the "Fiber created the invoice but
  // our DB insert failed" vs. "the Fiber call itself failed" distinction in
  // logs, which matters here: the former leaves an orphaned payment_hash on
  // the Fiber node with no corresponding DB row.
  let created: Awaited<ReturnType<typeof createFiberInvoice>>;
  try {
    created = await createFiberInvoice({
      amountShannon: input.amountShannon,
      asset: input.asset,
      description: input.description,
    });
  } catch (error) {
    console.error("createInvoice (Fiber) failed:", error);
    throw error;
  }

  const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);

  let insertedRows: InvoiceRow[];
  try {
    insertedRows = await db
      .insert(invoices)
      .values({
        paymentHash: created.paymentHash,
        invoiceAddress: created.invoiceAddress,
        amountShannon: input.amountShannon,
        asset: input.asset,
        description: input.description,
        status: "pending",
        expiresAt,
        metadata: input.metadata,
      })
      .returning();
  } catch (error) {
    console.error("Failed to persist invoice after Fiber node created it:", error);
    throw error;
  }

  const row = insertedRows[0];
  if (!row) {
    console.error("Invoice insert returned no row");
    throw new Error("Invoice insert returned no row");
  }

  return row;
}

// Cursor-based pagination on (createdAt, id) — codec shared with
// webhooks.ts via lib/db/cursor.ts, both list queries below paginate on the
// same compound key so it stays stable even when two rows share createdAt.

export interface ListInvoicesResult {
  rows: InvoiceRow[];
  nextCursor: string | null;
}

// Dashboard-only filters (Invoices page's search/date-range/amount-range
// filter bar — harness-brief.md issue #10 acceptance criterion 4). These are
// NOT part of the GET /api/v1/invoices spec (lib/api/validation.ts's
// ListInvoicesQuery stays exactly as the REST spec defines it) — this wider
// type is additive and only consumed by dashboard pages calling this service
// function in-process, so extending it here can't change the public API's
// request/response contract.
export interface ListInvoicesFilters extends ListInvoicesQuery {
  /** Case-insensitive substring match against description, payment_hash, or id. */
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
  amountMinShannon?: bigint;
  amountMaxShannon?: bigint;
}

export async function listInvoices(query: ListInvoicesFilters): Promise<ListInvoicesResult> {
  const conditions: SQL[] = [];
  if (query.status) {
    conditions.push(eq(invoices.status, query.status));
  }
  if (query.asset) {
    conditions.push(eq(invoices.asset, query.asset));
  }
  if (query.search) {
    const pattern = `%${query.search}%`;
    const searchCondition = or(
      ilike(invoices.description, pattern),
      ilike(invoices.paymentHash, pattern),
      ilike(sql`${invoices.id}::text`, pattern),
    );
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }
  if (query.createdFrom) {
    conditions.push(gte(invoices.createdAt, query.createdFrom));
  }
  if (query.createdTo) {
    conditions.push(lte(invoices.createdAt, query.createdTo));
  }
  if (query.amountMinShannon !== undefined) {
    conditions.push(gte(invoices.amountShannon, query.amountMinShannon));
  }
  if (query.amountMaxShannon !== undefined) {
    conditions.push(lte(invoices.amountShannon, query.amountMaxShannon));
  }

  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    const cursorDate = new Date(cursor.createdAt);
    const cursorCondition = or(
      lt(invoices.createdAt, cursorDate),
      and(eq(invoices.createdAt, cursorDate), lt(invoices.id, cursor.id)),
    );
    if (cursorCondition) {
      conditions.push(cursorCondition);
    }
  }

  const rows = await db
    .select()
    .from(invoices)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(invoices.createdAt), desc(invoices.id))
    // Fetch one extra row to detect whether another page exists without a
    // second COUNT query.
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  const nextCursor =
    hasMore && lastRow
      ? encodeCursor({
          createdAt: (lastRow.createdAt ?? new Date()).toISOString(),
          id: lastRow.id,
        })
      : null;

  return { rows: pageRows, nextCursor };
}

// Returns null both for a malformed id (without querying the DB — invoices.id
// is a Postgres uuid column, and passing a non-UUID straight to eq() would
// throw a Postgres "invalid input syntax for type uuid" error) and for a
// well-formed id with no matching row. The route maps either case to 404.
export async function getInvoiceById(id: string): Promise<InvoiceRow | null> {
  if (!isValidUuid(id)) {
    return null;
  }

  const rows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return rows[0] ?? null;
}

// Quick Start step 4 ("Create your first invoice") derives from this —
// harness-brief.md issue #10 Resolved Decision #2: server-derived, real data,
// not hardcoded. `.limit(1)` turns the check into an existence probe instead
// of counting every paid invoice.
export async function hasPaidInvoice(): Promise<boolean> {
  const rows = await db.select().from(invoices).where(eq(invoices.status, "paid")).limit(1);
  return rows.length > 0;
}

const STATS_WINDOW_DAYS = 30;

export interface InvoiceStats {
  totalCount: number;
  paidCount: number;
  pendingCount: number;
  /** Sum of amount_shannon for paid invoices, keyed by asset (e.g. "CKB", "RUSD"). */
  paidVolumeByAsset: Record<string, bigint>;
}

/**
 * Overview page's stat cards (issue #10) — real aggregates over the last
 * STATS_WINDOW_DAYS, computed in JS over a narrow-column projection rather
 * than a SQL GROUP BY, since the row count at hackathon/single-merchant
 * scale is small and this avoids a second query shape to reason about.
 * Deliberately does NOT include a "vs last period" delta (the mockup shows
 * one) — that needs a second, previous-window query, and CLAUDE.md forbids
 * hardcoding a mockup placeholder value as if it were real.
 */
export async function getInvoiceStats(): Promise<InvoiceStats> {
  const since = new Date(Date.now() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ status: invoices.status, asset: invoices.asset, amountShannon: invoices.amountShannon })
    .from(invoices)
    .where(gte(invoices.createdAt, since));

  let paidCount = 0;
  let pendingCount = 0;
  const paidVolumeByAsset: Record<string, bigint> = {};

  for (const row of rows) {
    if (row.status === "paid") {
      paidCount += 1;
      paidVolumeByAsset[row.asset] = (paidVolumeByAsset[row.asset] ?? 0n) + row.amountShannon;
    } else if (row.status === "pending") {
      pendingCount += 1;
    }
  }

  return { totalCount: rows.length, paidCount, pendingCount, paidVolumeByAsset };
}
