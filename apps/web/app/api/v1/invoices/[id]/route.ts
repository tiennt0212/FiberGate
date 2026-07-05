import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { err, internalError, ok } from "@/lib/api/response";
import { serializeInvoice } from "@/lib/api/serialize-invoice";
import type { InvoiceRow } from "@/lib/db/schema";
import { getInvoiceById } from "@/lib/services/invoices";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const authError = requireAuth(request);
  if (authError) {
    return authError;
  }

  let row: InvoiceRow | null;
  try {
    row = await getInvoiceById(params.id);
  } catch (error) {
    console.error("Failed to fetch invoice:", error);
    return internalError();
  }

  if (!row) {
    return err(404, "NOT_FOUND", "Invoice not found");
  }

  return ok(serializeInvoice(row));
}
