import { NextResponse } from "next/server";

import { shannonToCkb } from "@/lib/api/format";
import { err, fiberTimeoutResponse, ok } from "@/lib/api/response";
import { getNodeInfo } from "@/lib/fiber/client";

// GET /node/info is intentionally public (no requireAuth() call) —
// .context/api/rest-api-spec.md marks it as the one endpoint that doesn't
// require the Bearer token, and CLAUDE.md's auth flow explicitly carves it
// out ("Every route except GET /node/info").

export async function GET(): Promise<NextResponse> {
  try {
    const info = await getNodeInfo();
    return ok({
      pubkey: info.pubkey,
      active_channels: info.activeChannels,
      inbound_capacity_ckb: shannonToCkb(info.inboundCapacityShannon),
      outbound_capacity_ckb: shannonToCkb(info.outboundCapacityShannon),
      status: "online",
    });
  } catch (error) {
    const timeoutResponse = fiberTimeoutResponse(error);
    if (timeoutResponse) {
      return timeoutResponse;
    }
    console.error("getNodeInfo failed:", error);
    return err(503, "NODE_UNAVAILABLE", "Fiber node is unavailable");
  }
}
