import { invoiceStatusEnum } from "../db/schema";

// Manual validation for POST /invoices and GET /invoices query params
// (BR-INV-001/002/003/004). No validation library is installed in
// apps/web/package.json and CLAUDE.md forbids adding a dependency without
// asking — these bound/enum checks are simple enough not to need one.

// Object-as-namespace so call sites compare against named keys
// (InvoiceAsset.CKB) instead of scattering the string literal "CKB", per
// frontend-exp's TypeScript Constants conventions.
export const InvoiceAsset = {
  CKB: "CKB",
  RUSD: "RUSD",
} as const;
export type InvoiceAssetValue = (typeof InvoiceAsset)[keyof typeof InvoiceAsset];
export const INVOICE_ASSETS = Object.values(InvoiceAsset) as InvoiceAssetValue[];

// invoices.status is a real Postgres enum (lib/db/schema.ts); reuse its
// values here instead of re-declaring the pending/paid/expired/failed list a
// second time.
export const INVOICE_STATUSES = invoiceStatusEnum.enumValues;
export type InvoiceStatusValue = (typeof INVOICE_STATUSES)[number];

export const MIN_AMOUNT_CKB = 0.1; // BR-INV-001
export const MAX_AMOUNT_CKB = 1000; // BR-INV-001
export const SHANNON_PER_CKB = 100_000_000;

export const DEFAULT_EXPIRES_IN_SECONDS = 3600; // BR-INV-003
export const MAX_EXPIRES_IN_SECONDS = 86400; // BR-INV-003

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100; // BR-RTE-002

// Thrown by the validators below; routes catch this and map `code`/message
// straight into err(status, code, message) via the caller-supplied status.
export class ApiValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiValidationError";
  }
}

export interface CreateInvoiceInput {
  amountCkb: number;
  amountShannon: bigint;
  asset: InvoiceAssetValue;
  description?: string;
  expiresInSeconds: number;
  metadata?: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Shared by every "must be one of: ..." enum check below (asset/status),
// both for POST body fields (value may be any JSON type) and GET query
// params (already known to be a string) — callers just supply the allowed
// list, error code, and field label.
function validateEnumParam<T extends string>(
  value: unknown,
  allowed: readonly T[],
  code: string,
  label: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ApiValidationError(code, `${label} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

// invoices.id is a Postgres uuid column — passing a non-UUID string straight
// to Drizzle's `eq()` would throw a Postgres "invalid input syntax for type
// uuid" error instead of a clean 404.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Validates and normalizes a POST /invoices JSON body. Throws
 * ApiValidationError with a spec error code (INVALID_AMOUNT,
 * UNSUPPORTED_ASSET) or the generic VALIDATION_ERROR code for structural
 * issues the spec doesn't name a code for (bad expires_in, wrong types).
 */
export function validateCreateInvoiceInput(body: unknown): CreateInvoiceInput {
  if (!isPlainObject(body)) {
    throw new ApiValidationError("VALIDATION_ERROR", "Request body must be a JSON object");
  }

  const { amount, asset, description, expires_in: expiresIn, metadata } = body;

  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new ApiValidationError("INVALID_AMOUNT", "amount must be a finite number");
  }
  if (amount < MIN_AMOUNT_CKB || amount > MAX_AMOUNT_CKB) {
    throw new ApiValidationError(
      "INVALID_AMOUNT",
      `amount must be between ${MIN_AMOUNT_CKB} and ${MAX_AMOUNT_CKB} CKB`,
    );
  }

  const validatedAsset = validateEnumParam(asset, INVOICE_ASSETS, "UNSUPPORTED_ASSET", "asset");

  if (description !== undefined && typeof description !== "string") {
    throw new ApiValidationError("VALIDATION_ERROR", "description must be a string");
  }

  let expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS;
  if (expiresIn !== undefined) {
    if (
      typeof expiresIn !== "number" ||
      !Number.isInteger(expiresIn) ||
      expiresIn < 1 ||
      expiresIn > MAX_EXPIRES_IN_SECONDS
    ) {
      throw new ApiValidationError(
        "VALIDATION_ERROR",
        `expires_in must be an integer between 1 and ${MAX_EXPIRES_IN_SECONDS} seconds`,
      );
    }
    expiresInSeconds = expiresIn;
  }

  if (metadata !== undefined && !isPlainObject(metadata)) {
    throw new ApiValidationError("VALIDATION_ERROR", "metadata must be a JSON object");
  }

  // BR-INV-004: shannon = round(amount_ckb * 1e8), stored as bigint.
  const amountShannon = BigInt(Math.round(amount * SHANNON_PER_CKB));

  return {
    amountCkb: amount,
    amountShannon,
    asset: validatedAsset,
    description,
    expiresInSeconds,
    metadata,
  };
}

export interface ListInvoicesQuery {
  status?: InvoiceStatusValue;
  asset?: InvoiceAssetValue;
  limit: number;
  cursor?: string;
}

/**
 * Validates and normalizes GET /invoices query params. Rejects unknown
 * status/asset values (400 VALIDATION_ERROR) rather than silently returning
 * an empty list — the spec doesn't specify this behavior explicitly, but
 * failing loudly on a malformed filter is the safer default.
 */
export function validateListInvoicesQuery(searchParams: URLSearchParams): ListInvoicesQuery {
  const statusParam = searchParams.get("status");
  const status =
    statusParam !== null
      ? validateEnumParam(statusParam, INVOICE_STATUSES, "VALIDATION_ERROR", "status")
      : undefined;

  const assetParam = searchParams.get("asset");
  const asset =
    assetParam !== null
      ? validateEnumParam(assetParam, INVOICE_ASSETS, "VALIDATION_ERROR", "asset")
      : undefined;

  const limitParam = searchParams.get("limit");
  let limit = DEFAULT_LIST_LIMIT;
  if (limitParam !== null) {
    const parsedLimit = Number(limitParam);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      throw new ApiValidationError("VALIDATION_ERROR", "limit must be a positive integer");
    }
    // BR-RTE-002: hard cap at 100 items/request — clamp rather than reject
    // an over-large limit, matching common REST pagination conventions.
    limit = Math.min(parsedLimit, MAX_LIST_LIMIT);
  }

  // Treat an explicitly empty ?cursor= the same as an omitted one — an
  // explicit, intentional normalization here, not left to an implicit
  // falsy check further down the pipeline (which would silently swallow it
  // as "no cursor" without anyone deciding that's the right behavior).
  const cursorParam = searchParams.get("cursor");
  const cursor = cursorParam ? cursorParam : undefined;

  return { status, asset, limit, cursor };
}
