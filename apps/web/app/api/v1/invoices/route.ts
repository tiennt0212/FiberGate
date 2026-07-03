import { and, desc, eq, lt, or, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { tryConsumeInvoiceCreationSlot } from "@/lib/api/rate-limit";
import { err, internalError, ok } from "@/lib/api/response";
import {
  ApiValidationError,
  SHANNON_PER_CKB,
  validateCreateInvoiceInput,
  validateListInvoicesQuery,
  type CreateInvoiceInput,
  type ListInvoicesQuery,
} from "@/lib/api/validation";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { createInvoice } from "@/lib/fiber/client";
import {
  FiberRpcTimeoutError,
  UnsupportedAssetError,
  type NewInvoiceOutput,
} from "@/lib/fiber/types";

// invoices row shape, as inferred by Drizzle from lib/db/schema.ts.
type InvoiceRow = typeof invoices.$inferSelect;

function shannonToCkb(shannon: bigint): number {
  return Number(shannon) / SHANNON_PER_CKB;
}

// POST /invoices response omits paid_at (always null at creation time) to
// match the exact shape in .context/api/rest-api-spec.md's 201 example.
function serializeCreatedInvoice(row: InvoiceRow) {
  return {
    id: row.id,
    invoice_address: row.invoiceAddress,
    payment_hash: row.paymentHash,
    amount: shannonToCkb(row.amountShannon),
    asset: row.asset,
    status: row.status,
    expires_at: row.expiresAt.toISOString(),
    created_at: (row.createdAt ?? new Date()).toISOString(),
  };
}

// GET /invoices list items include paid_at, mirroring GET /invoices/:id.
function serializeListedInvoice(row: InvoiceRow) {
  return {
    id: row.id,
    invoice_address: row.invoiceAddress,
    payment_hash: row.paymentHash,
    amount: shannonToCkb(row.amountShannon),
    asset: row.asset,
    status: row.status,
    paid_at: row.paidAt ? row.paidAt.toISOString() : null,
    expires_at: row.expiresAt.toISOString(),
    created_at: (row.createdAt ?? new Date()).toISOString(),
  };
}

// Opaque cursor = base64 JSON of the last row's { created_at, id }, used as
// a compound (timestamp, id) key so pagination stays stable even when two
// rows share the same created_at. Documented here since nothing else in the
// repo defines a cursor format yet (see harness-brief.md "Cursor pagination
// shape is unspecified").
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = requireAuth(request);
  if (authError) {
    return authError;
  }

  if (!tryConsumeInvoiceCreationSlot()) {
    return err(429, "RATE_LIMITED", "Too many invoices created; try again shortly");
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return err(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  let input: CreateInvoiceInput;
  try {
    input = validateCreateInvoiceInput(rawBody);
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return err(400, error.code, error.message);
    }
    throw error;
  }

  let created: NewInvoiceOutput;
  try {
    created = await createInvoice({
      amountShannon: input.amountShannon,
      asset: input.asset,
      description: input.description,
    });
  } catch (error) {
    if (error instanceof UnsupportedAssetError) {
      return err(400, "UNSUPPORTED_ASSET", error.message);
    }
    if (error instanceof FiberRpcTimeoutError) {
      return err(503, "NODE_UNAVAILABLE", "Fiber node did not respond in time");
    }
    console.error("createInvoice failed:", error);
    return internalError();
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
    return internalError();
  }

  const row = insertedRows[0];
  if (!row) {
    console.error("Invoice insert returned no row");
    return internalError();
  }

  return ok(serializeCreatedInvoice(row), undefined, 201);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = requireAuth(request);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);

  let query: ListInvoicesQuery;
  try {
    query = validateListInvoicesQuery(searchParams);
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return err(400, error.code, error.message);
    }
    throw error;
  }

  const conditions: SQL[] = [];
  if (query.status) {
    conditions.push(eq(invoices.status, query.status));
  }
  if (query.asset) {
    conditions.push(eq(invoices.asset, query.asset));
  }

  if (query.cursor) {
    let cursor: InvoiceCursor;
    try {
      cursor = decodeCursor(query.cursor);
    } catch (error) {
      if (error instanceof ApiValidationError) {
        return err(400, error.code, error.message);
      }
      throw error;
    }
    const cursorDate = new Date(cursor.createdAt);
    const cursorCondition = or(
      lt(invoices.createdAt, cursorDate),
      and(eq(invoices.createdAt, cursorDate), lt(invoices.id, cursor.id)),
    );
    if (cursorCondition) {
      conditions.push(cursorCondition);
    }
  }

  let rows: InvoiceRow[];
  try {
    rows = await db
      .select()
      .from(invoices)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(invoices.createdAt), desc(invoices.id))
      // Fetch one extra row to detect whether another page exists without a
      // second COUNT query.
      .limit(query.limit + 1);
  } catch (error) {
    console.error("Failed to list invoices:", error);
    return internalError();
  }

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

  return ok(pageRows.map(serializeListedInvoice), {
    limit: query.limit,
    next_cursor: nextCursor,
  });
}
