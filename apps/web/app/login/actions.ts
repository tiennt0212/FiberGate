"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { ROUTE } from "@/lib/auth/routes";
import { getAdminPasswordHash } from "@/lib/services/settings";

export type LoginState = { error: string | null };

// Single-admin password check (BR-SEC-002): compare the submitted password
// against the current hash via bcrypt, never storing or logging plaintext.
// Server Action, not a /api/v1/* route, so the { data, error } envelope from
// lib/api/response.ts does not apply here (see harness-brief.md "Resolved
// decisions") — this return shape only feeds useFormState() on the login form.
//
// getAdminPasswordHash() (issue #30) reads a DB-backed hash if the admin has
// ever changed their password via Dashboard -> Settings, else falls back to
// ADMIN_PASSWORD_HASH_B64 (env var, base64-encoded — see that function's doc
// comment for why base64: Docker Compose's `.env` interpolation and
// dotenv-expand each mangle a raw bcrypt hash's "$" characters differently,
// base64 has none). See decisions-log.md and system-design.md's "Dashboard
// auth" section for the full investigation.
export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    return { error: "Password is required" };
  }

  const passwordHash = await getAdminPasswordHash();
  const isValid = await bcrypt.compare(password, passwordHash);
  if (!isValid) {
    return { error: "Incorrect password" };
  }

  await setSessionCookie();
  redirect(ROUTE.OVERVIEW);
}

export async function logout(): Promise<void> {
  clearSessionCookie();
  redirect(ROUTE.LOGIN);
}
