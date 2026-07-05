import { NextResponse } from "next/server";

import { FiberRpcTimeoutError } from "@/lib/fiber/types";

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

// Shared by every route that calls into lib/fiber/client.ts: turns a timed
// out Fiber RPC call into the spec's 503 NODE_UNAVAILABLE shape. Returns null
// for any other error so callers keep their own fallback behavior (e.g. some
// routes fall back to a 500 internalError(), others to a different 503
// message) instead of being forced into one shared non-timeout branch.
export function fiberTimeoutResponse(error: unknown): NextResponse<ApiErrorBody> | null {
  if (error instanceof FiberRpcTimeoutError) {
    return err(503, "NODE_UNAVAILABLE", "Fiber node did not respond in time");
  }
  return null;
}
