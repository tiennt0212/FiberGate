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
 * Constant-time check of `request`'s `Authorization: Bearer` header against
 * `expectedSecret`. Returns a 401 err() NextResponse on mismatch, or `null`
 * if authorized. Extracted out of requireAuth() below so a second caller
 * (POST /api/cron/poll-invoices, checked against CRON_SECRET instead of
 * FIBERGATE_INTERNAL_SECRET) doesn't have to copy-paste the constant-time
 * comparison logic. This function doesn't fetch the secret itself — callers
 * decide how to obtain/validate its presence
 * (requireAuth() below always requires FIBERGATE_INTERNAL_SECRET via
 * requireEnv(); the cron route instead treats a missing CRON_SECRET as
 * "endpoint disabled" via getOptionalEnv(), not a 401).
 */
export function requireBearerToken(
  request: NextRequest,
  expectedSecret: string,
): ReturnType<typeof err> | null {
  const token = extractBearerToken(request.headers.get("authorization"));

  if (!constantTimeEquals(token, expectedSecret)) {
    return err(401, "UNAUTHORIZED", "Missing or invalid authorization token");
  }
  return null;
}

/**
 * Returns an error NextResponse if the request's Authorization header does
 * not match FIBERGATE_INTERNAL_SECRET, or `null` if authorized. Callers must
 * check for a non-null return and short-circuit before doing anything else.
 */
export function requireAuth(request: NextRequest): ReturnType<typeof err> | null {
  const secret = requireEnv("FIBERGATE_INTERNAL_SECRET");
  return requireBearerToken(request, secret);
}
