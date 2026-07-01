import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config/env";

/**
 * BR-SEC-001: authenticate an /api/v1/* request by comparing the Bearer token to
 * FIBERGATE_INTERNAL_SECRET in constant time. Never `===`, never logged.
 */
export function isAuthorizedInternal(authHeader: string | null): boolean {
  if (!authHeader) return false;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return false;
  const token = match[1] ?? "";

  const a = Buffer.from(token);
  const b = Buffer.from(env.internalSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
