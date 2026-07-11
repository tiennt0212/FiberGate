"use server";

import bcrypt from "bcryptjs";

import { getAdminPasswordHash, setAdminPassword } from "@/lib/services/settings";

import type { SimpleResult } from "../action-result";

// Server Action for the Settings page (issue #30). Follows webhooks/actions.ts's
// { ok, error? } convention (SimpleResult, shared via ../action-result.ts):
// validate first, try/catch around the service call, never surface the raw
// thrown error to the client.

// No existing business rule sets a minimum password length/complexity — 8
// chars is a reasonable baseline assumption, flagged as such in the plan for
// this feature. Redirect if you want a different rule.
const MIN_PASSWORD_LENGTH = 8;

// bcrypt (bcryptjs included) silently truncates its input at 72 *bytes* —
// anything past that is ignored when hashing, so a longer password would
// quietly collapse to just its first 72 bytes' worth of entropy with no
// error. Checked in bytes (Buffer.byteLength), not .length, since a
// multi-byte UTF-8 character (e.g. non-ASCII/emoji) counts as more than one
// byte but only one JS string "character".
const MAX_PASSWORD_BYTES = 72;

export async function changePassword(currentPassword: string, newPassword: string): Promise<SimpleResult> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (Buffer.byteLength(newPassword, "utf-8") > MAX_PASSWORD_BYTES) {
    return { ok: false, error: `New password must be at most ${MAX_PASSWORD_BYTES} bytes long.` };
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
