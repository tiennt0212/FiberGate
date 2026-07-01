import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { env } from "@/lib/config/env";
import { ErrorCode, fail, ok } from "@/lib/http/response";
import { pollInvoicesOnce } from "@/lib/poller/worker";
import { processDueRetries } from "@/lib/webhooks/delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(header: string | null): boolean {
  if (!env.cronSecret) return false;
  const match = header ? /^Bearer\s+(.+)$/i.exec(header.trim()) : null;
  if (!match) return false;
  const a = Buffer.from(match[1] ?? "");
  const b = Buffer.from(env.cronSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST /api/cron/poll-invoices — optional manual trigger for one poll pass.
// The in-process worker (BR-POL-001) is the primary mechanism.
export async function POST(req: NextRequest) {
  if (!env.cronSecret) {
    return fail(ErrorCode.NOT_FOUND, "Cron endpoint is not enabled (CRON_SECRET unset)", 404);
  }
  if (!authorized(req.headers.get("authorization"))) {
    return fail(ErrorCode.UNAUTHORIZED, "Invalid or missing cron secret", 401);
  }

  try {
    await pollInvoicesOnce();
    const retried = await processDueRetries();
    return ok({ polled: true, retries_processed: retried });
  } catch (err) {
    console.error("[cron/poll-invoices] failed:", err);
    return fail(ErrorCode.INTERNAL_ERROR, "Poll pass failed", 500);
  }
}
