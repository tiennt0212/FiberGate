import type { NextRequest } from "next/server";
import { isAuthorizedInternal } from "@/lib/auth/internal-secret";
import { ErrorCode, fail, ok } from "@/lib/http/response";
import { getInvoiceById } from "@/lib/invoices/service";
import { toInvoiceDTO } from "@/lib/invoices/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/invoices/:id — fetch one invoice's current status.
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  if (!isAuthorizedInternal(req.headers.get("authorization"))) {
    return fail(ErrorCode.UNAUTHORIZED, "Invalid or missing bearer token", 401);
  }

  try {
    const invoice = await getInvoiceById(ctx.params.id);
    if (!invoice) {
      return fail(ErrorCode.NOT_FOUND, "Invoice not found", 404);
    }
    return ok(toInvoiceDTO(invoice));
  } catch (err) {
    console.error(`[GET /invoices/${ctx.params.id}] unexpected error:`, err);
    return fail(ErrorCode.INTERNAL_ERROR, "Failed to fetch invoice", 500);
  }
}
