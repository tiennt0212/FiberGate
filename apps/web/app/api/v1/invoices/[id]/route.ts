import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { err, internalError, ok } from "@/lib/api/response";
import { SHANNON_PER_CKB } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";

type InvoiceRow = typeof invoices.$inferSelect;

// UUIDs only — invoices.id is a Postgres uuid column, and passing a
// non-UUID string straight to Drizzle's `eq()` would throw a Postgres
// "invalid input syntax for type uuid" error instead of a clean 404.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function shannonToCkb(shannon: bigint): number {
  return Number(shannon) / SHANNON_PER_CKB;
}

function serializeInvoiceDetail(row: InvoiceRow) {
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const authError = requireAuth(request);
  if (authError) {
    return authError;
  }

  if (!UUID_PATTERN.test(params.id)) {
    return err(404, "NOT_FOUND", "Invoice not found");
  }

  let rows: InvoiceRow[];
  try {
    rows = await db.select().from(invoices).where(eq(invoices.id, params.id)).limit(1);
  } catch (error) {
    console.error("Failed to fetch invoice:", error);
    return internalError();
  }

  const row = rows[0];
  if (!row) {
    return err(404, "NOT_FOUND", "Invoice not found");
  }

  return ok(serializeInvoiceDetail(row));
}
