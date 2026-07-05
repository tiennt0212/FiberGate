import { and, desc, eq, lt, or, type SQL } from "drizzle-orm";

import { ApiValidationError, isValidUuid, type CreateInvoiceInput, type ListInvoicesQuery } from "@/lib/api/validation";
import { db } from "@/lib/db";
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
    throw new Error("Invoice insert returned no row");
  }

  return row;
}

// Opaque cursor = base64 JSON of the last row's { created_at, id }, used as
// a compound (timestamp, id) key so pagination stays stable even when two
// rows share the same created_at. Paired with the query below (both halves
// of one pagination mechanism, tied to the same sort order) rather than
// split into a separate module.
interface InvoiceCursor {
  createdAt: string;
  id: string;
}

function encodeCursor(cursor: InvoiceCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(raw: string): InvoiceCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "createdAt" in parsed &&
      "id" in parsed &&
      typeof (parsed as InvoiceCursor).createdAt === "string" &&
      typeof (parsed as InvoiceCursor).id === "string"
    ) {
      return parsed as InvoiceCursor;
    }
    throw new Error("malformed cursor payload");
  } catch (error) {
    throw new ApiValidationError(
      "VALIDATION_ERROR",
      `Invalid cursor: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export interface ListInvoicesResult {
  rows: InvoiceRow[];
  nextCursor: string | null;
}

export async function listInvoices(query: ListInvoicesQuery): Promise<ListInvoicesResult> {
  const conditions: SQL[] = [];
  if (query.status) {
    conditions.push(eq(invoices.status, query.status));
  }
  if (query.asset) {
    conditions.push(eq(invoices.asset, query.asset));
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
