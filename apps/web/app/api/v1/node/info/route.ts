import { NextResponse } from "next/server";

import { err, fiberTimeoutResponse, ok } from "@/lib/api/response";
import { getNodeStatus } from "@/lib/services/node";

// GET /node/info is intentionally public (no requireAuth() call) —
// .context/api/rest-api-spec.md marks it as the one endpoint that doesn't
// require the Bearer token, and CLAUDE.md's auth flow explicitly carves it
// out ("Every route except GET /node/info").

export async function GET(): Promise<NextResponse> {
  try {
    const status = await getNodeStatus();
    return ok(status);
  } catch (error) {
    const timeoutResponse = fiberTimeoutResponse(error);
    if (timeoutResponse) {
      return timeoutResponse;
    }
    console.error("getNodeInfo failed:", error);
    return err(503, "NODE_UNAVAILABLE", "Fiber node is unavailable");
  }
}
