"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

import { requireEnv } from "@/lib/env";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { ROUTE } from "@/lib/auth/routes";

export type LoginState = { error: string | null };

// Single-admin password check (BR-SEC-002): compare the submitted password
// against ADMIN_PASSWORD_HASH_B64 via bcrypt, never storing or logging
// plaintext. Server Action, not a /api/v1/* route, so the { data, error }
// envelope from lib/api/response.ts does not apply here (see
// harness-brief.md "Resolved decisions") — this return shape only feeds
// useFormState() on the login form.
//
// The hash is stored base64-encoded in the env var (decoded here before
// bcrypt.compare) rather than as the raw bcrypt string. A raw hash contains
// literal "$" characters ($2y$10$...), and Docker Compose's `.env`
// interpolation and dotenv-expand (used by `pnpm dev`/`build` via
// dotenv-cli) each mangle those differently — verified against real
// containers: Compose only round-trips a hash correctly if every "$" is
// doubled to "$$", while dotenv-expand corrupts both the raw and "$$"-doubled
// forms. Base64 has no "$" in its alphabet, so it passes through both
// unmangled with no escaping needed. See decisions-log.md and
// system-design.md's "Dashboard auth" section for the full investigation.
export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    return { error: "Password is required" };
  }

  const passwordHashBase64 = requireEnv("ADMIN_PASSWORD_HASH_B64");
  const passwordHash = Buffer.from(passwordHashBase64, "base64").toString("utf-8");
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
