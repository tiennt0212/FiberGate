import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

import { requireEnv } from "../env";

// Dashboard session cookie: a compact JWT signed with DASHBOARD_SESSION_SECRET
// (BR-SEC-004 — deliberately distinct from FIBERGATE_INTERNAL_SECRET, which
// guards /api/v1/* instead). Single-admin, no per-user id: the payload only
// asserts "this request holds a valid admin session," nothing more.
//
// Expiry is sliding/rolling (~7 days): apps/web/middleware.ts reissues a fresh
// token + cookie with a renewed `exp` once the current token has less than
// SESSION_REFRESH_THRESHOLD_SECONDS left, so an active admin never gets
// logged out mid-session, an abandoned browser tab's cookie still expires
// ~7 days after the last request, and — unlike reissuing on literally every
// request — a fresh Set-Cookie only goes out at most once a day of
// continuous activity.

export const SESSION_COOKIE_NAME = "fibergate_dashboard_session";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const SESSION_REFRESH_THRESHOLD_SECONDS = 60 * 60 * 24; // 1 day

// DASHBOARD_SESSION_SECRET is fixed for the process lifetime (same reasoning
// as SESSION_COOKIE_OPTIONS below), and this is on middleware's hot path — it
// runs on every guarded request — so the encoded key is computed once and
// cached rather than re-encoded on every sign/verify call.
let cachedSigningKey: Uint8Array | undefined;

function getSigningKey(): Uint8Array {
  if (!cachedSigningKey) {
    cachedSigningKey = new TextEncoder().encode(requireEnv("DASHBOARD_SESSION_SECRET"));
  }
  return cachedSigningKey;
}

/**
 * Whether the client's original connection was HTTPS, based on the
 * X-Forwarded-Proto header a TLS-terminating reverse proxy (nginx, Caddy,
 * Cloudflare Tunnel, ...) sets when forwarding a request — NOT based on
 * NODE_ENV. This repo's docker-compose bundle has no TLS termination built
 * in by default (fibergate-core's port is published directly, plain HTTP;
 * see decisions-log), so the session cookie only gets the `Secure`
 * attribute once a merchant actually puts TLS in front of it, and it starts
 * working correctly the moment they do, with no further code change here.
 * Absent the header entirely (no reverse proxy — today's default), this
 * returns `false`, matching the real connection.
 */
export function isHttpsRequest(forwardedProto: string | null): boolean {
  return forwardedProto === "https";
}

/**
 * Cookie attributes for the dashboard session cookie, parameterized by
 * whether the current request arrived over HTTPS (see isHttpsRequest
 * above). Used both by setSessionCookie()/clearSessionCookie() below
 * (Server Actions, via next/headers) and by middleware.ts (via
 * NextResponse's `cookies` API, which takes the same shape) so the two call
 * sites can never drift out of sync on httpOnly/sameSite/maxAge.
 */
export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  } as const;
}

/** Signs a new session JWT asserting a valid admin session, expiring in ~7 days. */
export async function createSessionToken(): Promise<string> {
  return new SignJWT({ sub: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSigningKey());
}

/**
 * Verifies a session JWT's signature and expiry. Returns the decoded payload
 * (so callers can inspect `exp` to decide whether to refresh the cookie) or
 * `null` for a token-level failure (missing, bad signature, expired,
 * malformed) — callers only need the pass/fail result in that case, not the
 * failure reason, since the only action taken either way is "let the
 * request through" or "redirect to /login." A missing DASHBOARD_SESSION_SECRET
 * is a different kind of failure — a deployment misconfiguration, not an
 * expected "invalid session" — so getSigningKey()'s throw is deliberately
 * NOT caught here (matches lib/api/auth.ts's requireAuth(), which lets a
 * missing FIBERGATE_INTERNAL_SECRET throw uncaught rather than surfacing as
 * an indistinguishable 401/redirect).
 */
export async function verifySessionToken(token: string): Promise<JWTPayload | null> {
  const key = getSigningKey();
  try {
    const { payload } = await jwtVerify(token, key);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Whether a still-valid session should get a freshly-signed cookie: true
 * once less than SESSION_REFRESH_THRESHOLD_SECONDS remain before `exp`. A
 * payload with no `exp` claim (shouldn't happen — every token this module
 * signs sets one) is treated as due for a refresh rather than trusted as-is.
 */
export function shouldRefreshSession(payload: JWTPayload): boolean {
  if (typeof payload.exp !== "number") {
    return true;
  }
  const remainingSeconds = payload.exp - Math.floor(Date.now() / 1000);
  return remainingSeconds < SESSION_REFRESH_THRESHOLD_SECONDS;
}

/**
 * Signs a fresh session token and sets it as the httpOnly cookie. Only
 * callable from a Server Action / Route Handler / Server Component context
 * (uses next/headers's `cookies()`) — middleware.ts sets the same cookie via
 * NextResponse instead, since `cookies()` here is not writable from middleware.
 */
export async function setSessionCookie(): Promise<void> {
  const token = await createSessionToken();
  const secure = isHttpsRequest(headers().get("x-forwarded-proto"));
  cookies().set(SESSION_COOKIE_NAME, token, sessionCookieOptions(secure));
}

/** Clears the dashboard session cookie (logout). */
export function clearSessionCookie(): void {
  const secure = isHttpsRequest(headers().get("x-forwarded-proto"));
  cookies().set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(secure), maxAge: 0 });
}
