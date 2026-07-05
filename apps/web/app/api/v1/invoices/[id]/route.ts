import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { err, internalError, ok } from "@/lib/api/response";
import { serializeInvoice } from "@/lib/api/serialize-invoice";
import { isValidUuid } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { invoices, type InvoiceRow } from "@/lib/db/schema";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const authError = requireAuth(request);
  if (authError) {
    return authError;
  }

  if (!isValidUuid(params.id)) {
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

  return ok(serializeInvoice(row));
}
