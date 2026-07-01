import { NextResponse } from "next/server";

/** Machine-readable error codes surfaced to API clients (see rest-api-spec.md). */
export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  UNSUPPORTED_ASSET: "UNSUPPORTED_ASSET",
  INVALID_REQUEST: "INVALID_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  NODE_UNAVAILABLE: "NODE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

interface Meta {
  next_cursor?: string | null;
  count?: number;
}

export function ok<T>(data: T, init?: { status?: number; meta?: Meta }): NextResponse {
  return NextResponse.json(
    { data, error: null, ...(init?.meta ? { meta: init.meta } : {}) },
    { status: init?.status ?? 200 },
  );
}

export function fail(code: ErrorCodeValue, message: string, status: number): NextResponse {
  return NextResponse.json({ data: null, error: { code, message } }, { status });
}
