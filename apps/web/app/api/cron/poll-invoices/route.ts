import { NextRequest, NextResponse } from "next/server";

import { logActivity } from "@/lib/activity-log";
import { requireBearerToken } from "@/lib/api/auth";
import { err, internalError, ok } from "@/lib/api/response";
import { getOptionalEnv } from "@/lib/env";
import { runPollCycle } from "@/lib/poller/invoice-poller";

// POST /api/cron/poll-invoices — optional manual-trigger endpoint (BR-POL-001:
// the primary poll source is the in-process interval worker in
// instrumentation.ts; this route just runs the same runPollCycle() once, on
// demand). Not under /api/v1, but follows the same auth-first rule and
// { data, error } envelope as every other route.
//
// CRON_SECRET is optional (system-design.md) — unset means this endpoint is
// disabled (503), not a 500 from requireEnv() throwing, hence
// getOptionalEnv() here instead of the requireAuth() pattern used for
// FIBERGATE_INTERNAL_SECRET on /api/v1/* routes.

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cronSecret = getOptionalEnv("CRON_SECRET");
  if (!cronSecret) {
    return err(
      503,
      "CRON_NOT_CONFIGURED",
      "Manual poll trigger is disabled: CRON_SECRET is not configured",
    );
  }

  const authError = requireBearerToken(request, cronSecret);
  if (authError) {
    return authError;
  }

  try {
    await runPollCycle();
  } catch (error) {
    logActivity("error", "poller", `Manual poll cycle failed: ${String(error)}`, error);
    return internalError();
  }

  return ok({ triggered: true });
}
