import { NextResponse } from "next/server";

import {
  FiberRpcTimeoutError,
  UdtNotConfiguredError,
  UnsupportedAssetError,
} from "@/lib/fiber/types";

// Shared `{ data, error, meta? }` / `{ data: null, error: { code, message } }`
// envelope for every /api/v1/* route (CLAUDE.md "Response format",
// .context/api/rest-api-spec.md). Routes must build responses through
// ok()/err() rather than hand-rolling the JSON shape themselves.

export interface ApiSuccessBody<T> {
  data: T;
  error: null;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  data: null;
  error: {
    code: string;
    message: string;
  };
}

export function ok<T>(
  data: T,
  meta?: Record<string, unknown>,
  status = 200,
): NextResponse<ApiSuccessBody<T>> {
  const body: ApiSuccessBody<T> = meta
    ? { data, error: null, meta }
    : { data, error: null };
  return NextResponse.json(body, { status });
}

export function err(
  status: number,
  code: string,
  message: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ data: null, error: { code, message } }, { status });
}

// Fallback for anything not mapped to one of the spec's named error codes
// (e.g. an unexpected DB error). Never includes the raw error message in the
// response body — that could leak internals; callers should console.error
// the original error themselves before calling this.
export function internalError(): NextResponse<ApiErrorBody> {
  return err(500, "INTERNAL_ERROR", "Internal server error");
}

// Shared shape behind every xResponse() below: "if this error is an
// instance of ErrorClass, map it to this status/code; otherwise null" so
// callers can chain several checks with `?? `/early-return without each one
// hand-rolling the same instanceof-then-err() pattern. `message` defaults to
// the error's own `.message` (most Fiber-layer errors already build an
// actionable message in their constructor); pass a literal to override it.
function mapErrorResponse<E extends Error>(
  error: unknown,
  ErrorClass: new (...args: never[]) => E,
  status: number,
  code: string,
  message?: string,
): NextResponse<ApiErrorBody> | null {
  if (error instanceof ErrorClass) {
    return err(status, code, message ?? error.message);
  }
  return null;
}

// Every xResponse() below returns null for any other error so callers keep
// their own fallback behavior (e.g. some routes fall back to a 500
// internalError(), others to a different 503 message) instead of being
// forced into one shared branch — see route.ts's chained `if (x) return x;`
// checks.

// Turns a timed out Fiber RPC call into the spec's 503 NODE_UNAVAILABLE shape.
export function fiberTimeoutResponse(error: unknown): NextResponse<ApiErrorBody> | null {
  return mapErrorResponse(
    error,
    FiberRpcTimeoutError,
    503,
    "NODE_UNAVAILABLE",
    "Fiber node did not respond in time",
  );
}

// BR-INV-002: asset isn't "CKB"/"RUSD" at all — FiberGate itself doesn't
// implement it, regardless of node config.
export function unsupportedAssetResponse(error: unknown): NextResponse<ApiErrorBody> | null {
  return mapErrorResponse(error, UnsupportedAssetError, 400, "UNSUPPORTED_ASSET");
}

// A valid asset (BR-INV-002) whose UDT isn't in this node's ckb.udt_whitelist
// (docker/fiber-node/config.yml) — distinct from NODE_UNAVAILABLE (which
// means "ask again later") since retrying won't help until an operator fixes
// the node's config. See .context/api/rest-api-spec.md's error code table
// for POST /invoices (issue #27).
export function udtNotConfiguredResponse(error: unknown): NextResponse<ApiErrorBody> | null {
  return mapErrorResponse(error, UdtNotConfiguredError, 503, "ASSET_NOT_CONFIGURED");
}
