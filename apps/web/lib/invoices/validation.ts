import { ErrorCode, type ErrorCodeValue } from "@/lib/http/response";
import {
  DEFAULT_EXPIRY_SECONDS,
  MAX_AMOUNT_SHANNON,
  MAX_EXPIRY_SECONDS,
  MIN_AMOUNT_SHANNON,
  amountToShannon,
  isSupportedAsset,
  type Asset,
} from "./constants";

export interface ValidatedCreateInvoice {
  amountShannon: bigint;
  asset: Asset;
  description?: string;
  expirySeconds: number;
  metadata?: Record<string, unknown>;
}

export type ValidationResult =
  | { ok: true; value: ValidatedCreateInvoice }
  | { ok: false; code: ErrorCodeValue; message: string };

function invalid(code: ErrorCodeValue, message: string): ValidationResult {
  return { ok: false, code, message };
}

/** Validate the POST /invoices body against BR-INV-001..004. */
export function validateCreateInvoice(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return invalid(ErrorCode.INVALID_REQUEST, "Request body must be a JSON object");
  }
  const b = body as Record<string, unknown>;

  if (typeof b.amount !== "number" || !Number.isFinite(b.amount) || b.amount <= 0) {
    return invalid(ErrorCode.INVALID_AMOUNT, "amount must be a positive number");
  }
  const amountShannon = amountToShannon(b.amount);
  if (amountShannon < MIN_AMOUNT_SHANNON) {
    return invalid(ErrorCode.INVALID_AMOUNT, "amount is below the minimum of 0.1 CKB");
  }
  if (amountShannon > MAX_AMOUNT_SHANNON) {
    return invalid(ErrorCode.INVALID_AMOUNT, "amount exceeds the maximum of 1,000 CKB");
  }

  if (!isSupportedAsset(b.asset)) {
    return invalid(ErrorCode.UNSUPPORTED_ASSET, "asset must be one of: CKB, RUSD");
  }

  if (b.description !== undefined && typeof b.description !== "string") {
    return invalid(ErrorCode.INVALID_REQUEST, "description must be a string");
  }

  let expirySeconds = DEFAULT_EXPIRY_SECONDS;
  if (b.expires_in !== undefined) {
    if (typeof b.expires_in !== "number" || !Number.isInteger(b.expires_in) || b.expires_in <= 0) {
      return invalid(ErrorCode.INVALID_REQUEST, "expires_in must be a positive integer (seconds)");
    }
    if (b.expires_in > MAX_EXPIRY_SECONDS) {
      return invalid(ErrorCode.INVALID_REQUEST, "expires_in exceeds the maximum of 86400 seconds");
    }
    expirySeconds = b.expires_in;
  }

  if (b.metadata !== undefined && (typeof b.metadata !== "object" || b.metadata === null || Array.isArray(b.metadata))) {
    return invalid(ErrorCode.INVALID_REQUEST, "metadata must be a JSON object");
  }

  return {
    ok: true,
    value: {
      amountShannon,
      asset: b.asset,
      description: b.description as string | undefined,
      expirySeconds,
      metadata: b.metadata as Record<string, unknown> | undefined,
    },
  };
}
