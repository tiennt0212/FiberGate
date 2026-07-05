"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

import { requireEnv } from "@/lib/env";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { ROUTE } from "@/lib/auth/routes";

export type LoginState = { error: string | null };

// Single-admin password check (BR-SEC-002): compare the submitted password
// against ADMIN_PASSWORD_HASH via bcrypt, never storing or logging plaintext.
// Server Action, not a /api/v1/* route, so the { data, error } envelope from
// lib/api/response.ts does not apply here (see harness-brief.md "Resolved
// decisions") — this return shape only feeds useFormState() on the login form.
export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    return { error: "Password is required" };
  }

  const passwordHash = requireEnv("ADMIN_PASSWORD_HASH");
  const isValid = await bcrypt.compare(password, passwordHash);
  if (!isValid) {
    return { error: "Incorrect password" };
  }

  await setSessionCookie();
  redirect(ROUTE.DASHBOARD);
}

export async function logout(): Promise<void> {
  clearSessionCookie();
  redirect(ROUTE.LOGIN);
}
