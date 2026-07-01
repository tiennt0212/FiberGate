import type { NextRequest } from "next/server";
import { isAuthorizedInternal } from "@/lib/auth/internal-secret";
import { ErrorCode, fail, ok } from "@/lib/http/response";
import { allowInvoiceCreation } from "@/lib/rate-limit";
import { FiberNodeError } from "@/lib/fiber/client";
import { createInvoice, listInvoices } from "@/lib/invoices/service";
import { toInvoiceDTO } from "@/lib/invoices/serialize";
import { validateCreateInvoice } from "@/lib/invoices/validation";
import {
  INVOICE_STATUSES,
  LIST_MAX_LIMIT,
  isSupportedAsset,
  type Asset,
  type InvoiceStatusValue,
} from "@/lib/invoices/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/invoices — create a new invoice.
export async function POST(req: NextRequest) {
  if (!isAuthorizedInternal(req.headers.get("authorization"))) {
    return fail(ErrorCode.UNAUTHORIZED, "Invalid or missing bearer token", 401);
  }
  if (!allowInvoiceCreation()) {
    return fail(ErrorCode.RATE_LIMITED, "Invoice creation rate limit exceeded (100/min)", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(ErrorCode.INVALID_REQUEST, "Request body must be valid JSON", 400);
  }

  const validation = validateCreateInvoice(body);
  if (!validation.ok) {
    return fail(validation.code, validation.message, 400);
  }

  try {
    const invoice = await createInvoice(validation.value);
    return ok(toInvoiceDTO(invoice), { status: 201 });
  } catch (err) {
    if (err instanceof FiberNodeError) {
      return fail(ErrorCode.NODE_UNAVAILABLE, "Fiber node did not respond", 503);
    }
    console.error("[POST /invoices] unexpected error:", err);
    return fail(ErrorCode.INTERNAL_ERROR, "Failed to create invoice", 500);
  }
}

// GET /api/v1/invoices — list invoices (status, asset, limit, cursor).
export async function GET(req: NextRequest) {
  if (!isAuthorizedInternal(req.headers.get("authorization"))) {
    return fail(ErrorCode.UNAUTHORIZED, "Invalid or missing bearer token", 401);
  }

  const params = req.nextUrl.searchParams;

  const statusParam = params.get("status");
  if (statusParam && !(INVOICE_STATUSES as readonly string[]).includes(statusParam)) {
    return fail(ErrorCode.INVALID_REQUEST, "Invalid status filter", 400);
  }

  const assetParam = params.get("asset");
  if (assetParam && !isSupportedAsset(assetParam)) {
    return fail(ErrorCode.INVALID_REQUEST, "Invalid asset filter", 400);
  }

  let limit: number | undefined;
  const limitParam = params.get("limit");
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > LIST_MAX_LIMIT) {
      return fail(ErrorCode.INVALID_REQUEST, `limit must be an integer 1..${LIST_MAX_LIMIT}`, 400);
    }
    limit = parsed;
  }

  try {
    const { rows, nextCursor } = await listInvoices({
      status: (statusParam as InvoiceStatusValue | null) ?? undefined,
      asset: (assetParam as Asset | null) ?? undefined,
      limit,
      cursor: params.get("cursor") ?? undefined,
    });
    return ok(rows.map(toInvoiceDTO), {
      meta: { next_cursor: nextCursor, count: rows.length },
    });
  } catch (err) {
    console.error("[GET /invoices] unexpected error:", err);
    return fail(ErrorCode.INTERNAL_ERROR, "Failed to list invoices", 500);
  }
}
