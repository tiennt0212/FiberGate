import type { NextRequest } from "next/server";
import { ErrorCode, fail, ok } from "@/lib/http/response";
import { verifyAdminPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/login — exchange the admin password for a signed session cookie.
export async function POST(req: NextRequest) {
  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    if (typeof body.password === "string") password = body.password;
  } catch {
    return fail(ErrorCode.INVALID_REQUEST, "Request body must be valid JSON", 400);
  }

  if (!(await verifyAdminPassword(password))) {
    return fail(ErrorCode.UNAUTHORIZED, "Incorrect password", 401);
  }

  const token = await createSessionToken();
  const res = ok({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
