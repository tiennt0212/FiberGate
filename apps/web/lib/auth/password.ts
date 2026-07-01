import bcrypt from "bcryptjs";
import { env } from "@/lib/config/env";

/** BR-SEC-002: compare the submitted admin password against the stored bcrypt hash. */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (!password) return false;
  return bcrypt.compare(password, env.adminPasswordHash);
}
