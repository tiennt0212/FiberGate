import { createHash, timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { requireEnv } from "../env";
import { err } from "./response";

// Constant-time Bearer-token check against FIBERGATE_INTERNAL_SECRET
// (BR-SEC-001, CLAUDE.md "Auth flow"). Every /api/v1/* route except
// GET /node/info must call requireAuth() before any other logic.

const BEARER_PREFIX = "Bearer ";

function extractBearerToken(header: string | null): string {
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    // Empty string, not null — see constantTimeEquals() below for why the
    // "missing header" and "wrong token" paths must not branch differently.
    return "";
  }
  return header.slice(BEARER_PREFIX.length);
}

// node:crypto's timingSafeEqual() throws if the two buffers differ in
// length, so a naive `if (a.length !== b.length) return false` guard before
// calling it would leak the secret's length through a timing side-channel
// (this is exactly what BR-SEC-001's "constant-time" requirement rules out).
// Hashing both sides to a fixed-length SHA-256 digest first means the
// buffers passed to timingSafeEqual() are always equal-length, so no
// variable-time short-circuit on the raw secret length is possible.
function constantTimeEquals(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

/**
 * Returns an error NextResponse if the request's Authorization header does
 * not match FIBERGATE_INTERNAL_SECRET, or `null` if authorized. Callers must
 * check for a non-null return and short-circuit before doing anything else.
 */
export function requireAuth(request: NextRequest): ReturnType<typeof err> | null {
  const secret = requireEnv("FIBERGATE_INTERNAL_SECRET");
  const token = extractBearerToken(request.headers.get("authorization"));

  if (!constantTimeEquals(token, secret)) {
    return err(401, "UNAUTHORIZED", "Missing or invalid authorization token");
  }
  return null;
}
