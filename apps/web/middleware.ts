import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  isHttpsRequest,
  sessionCookieOptions,
  shouldRefreshSession,
  verifySessionToken,
} from "@/lib/auth/session";
import { ROUTE } from "@/lib/auth/routes";

// Guards every route under apps/web/app/(dashboard)/** (see matcher below).
// Runs on the Edge runtime (Next.js 14 default for middleware) — jose's
// jwtVerify/SignJWT use Web Crypto, so this is Edge-safe. Password
// verification (bcryptjs, in app/login/actions.ts) never runs here.
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;

  if (!payload) {
    const redirectResponse = NextResponse.redirect(new URL(ROUTE.LOGIN, request.url));
    // Clear a stale/invalid/expired cookie so the browser doesn't keep
    // resending it on every subsequent request to a guarded route.
    redirectResponse.cookies.delete(SESSION_COOKIE_NAME);
    return redirectResponse;
  }

  const response = NextResponse.next();

  // Sliding/rolling expiry (~7 days): only reissue the cookie once it's
  // within a day of expiring, instead of on every single request — an
  // active admin still never gets logged out mid-session, but a fresh
  // Set-Cookie only goes out roughly once a day of continuous use.
  if (shouldRefreshSession(payload)) {
    const newSessionToken = await createSessionToken();
    const secure = isHttpsRequest(
      request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", ""),
    );
    response.cookies.set(SESSION_COOKIE_NAME, newSessionToken, sessionCookieOptions(secure));
  }

  return response;
}

// Next.js statically extracts this `config` export at build time and only
// resolves literal values at this exact call site — importing the matcher
// array from another module fails that static analysis (silently falling
// back to "run on every route", which would infinite-redirect-loop on
// /login itself and break /api/v1/*'s Bearer-token auth). So this array is
// deliberately inlined here rather than imported from lib/auth/routes.ts,
// even though it duplicates the "which paths are under (dashboard)" fact —
// see lib/auth/routes.ts's PROTECTED_PATH_MATCHERS-adjacent comment history.
//
// Issue #10: (dashboard)/transactions/ was renamed to (dashboard)/invoices/,
// and routes were added since (delivery-log, quick-start, activity) — all 6
// real dashboard routes must be listed here (BR-SEC-004). Forgetting one
// silently ships that page unprotected.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/invoices/:path*",
    "/delivery-log/:path*",
    "/webhooks/:path*",
    "/activity/:path*",
    "/quick-start/:path*",
  ],
};
