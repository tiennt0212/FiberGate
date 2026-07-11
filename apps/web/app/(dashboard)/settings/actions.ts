"use server";

import bcrypt from "bcryptjs";

import { getAdminPasswordHash, setAdminPassword } from "@/lib/services/settings";

// Server Action for the Settings page (issue #30). Follows webhooks/actions.ts's
// { ok, error? } convention: validate first, try/catch around the service call,
// never surface the raw thrown error to the client.

export interface SimpleResult {
  ok: boolean;
  error?: string;
}

// No existing business rule sets a minimum password length/complexity — 8
// chars is a reasonable baseline assumption, flagged as such in the plan for
// this feature. Redirect if you want a different rule.
const MIN_PASSWORD_LENGTH = 8;

export async function changePassword(currentPassword: string, newPassword: string): Promise<SimpleResult> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  try {
    const currentHash = await getAdminPasswordHash();
    const isCurrentValid = await bcrypt.compare(currentPassword, currentHash);
    if (!isCurrentValid) {
      return { ok: false, error: "Current password is incorrect." };
    }

    await setAdminPassword(newPassword);
    return { ok: true };
  } catch (error) {
    console.error("Settings: changePassword failed:", error);
    return { ok: false, error: "Could not change the password." };
  }
}
