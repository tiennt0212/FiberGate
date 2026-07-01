import type { NextRequest } from "next/server";
import { isAuthorizedInternal } from "@/lib/auth/internal-secret";
import { ErrorCode, fail, ok } from "@/lib/http/response";
import { getNodeInfoDTO } from "@/lib/node/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/node/info — current node identity + liquidity (US-004).
export async function GET(req: NextRequest) {
  if (!isAuthorizedInternal(req.headers.get("authorization"))) {
    return fail(ErrorCode.UNAUTHORIZED, "Invalid or missing bearer token", 401);
  }

  try {
    return ok(await getNodeInfoDTO());
  } catch (err) {
    console.error("[GET /node/info] unexpected error:", err);
    return fail(ErrorCode.NODE_UNAVAILABLE, "Failed to read node info", 503);
  }
}
