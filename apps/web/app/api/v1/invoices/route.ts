import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { tryConsumeInvoiceCreationSlot } from "@/lib/api/rate-limit";
import { err, fiberTimeoutResponse, internalError, ok } from "@/lib/api/response";
import { serializeCreatedInvoice, serializeInvoice } from "@/lib/api/serialize-invoice";
import {
  ApiValidationError,
  validateCreateInvoiceInput,
  validateListInvoicesQuery,
  type CreateInvoiceInput,
  type ListInvoicesQuery,
} from "@/lib/api/validation";
import type { InvoiceRow } from "@/lib/db/schema";
import { UnsupportedAssetError } from "@/lib/fiber/types";
import { createInvoice, listInvoices, type ListInvoicesResult } from "@/lib/services/invoices";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = requireAuth(request);
  if (authError) {
    return authError;
  }

  // BR-RTE-001: request/route-level anti-abuse guard, not invoice domain
  // logic — stays here rather than in lib/services/invoices.ts.
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

  let row: InvoiceRow;
  try {
    row = await createInvoice(input);
  } catch (error) {
    if (error instanceof UnsupportedAssetError) {
      return err(400, "UNSUPPORTED_ASSET", error.message);
    }
    const timeoutResponse = fiberTimeoutResponse(error);
    if (timeoutResponse) {
      return timeoutResponse;
    }
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

  let result: ListInvoicesResult;
  try {
    result = await listInvoices(query);
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return err(400, error.code, error.message);
    }
    console.error("Failed to list invoices:", error);
    return internalError();
  }

  return ok(result.rows.map((row) => serializeInvoice(row)), {
    limit: query.limit,
    next_cursor: result.nextCursor,
  });
}
