import { NextResponse } from "next/server";

import { err, ok } from "@/lib/api/response";
import { SHANNON_PER_CKB } from "@/lib/api/validation";
import { getNodeInfo } from "@/lib/fiber/client";
import { FiberRpcTimeoutError } from "@/lib/fiber/types";

// GET /node/info is intentionally public (no requireAuth() call) —
// .context/api/rest-api-spec.md marks it as the one endpoint that doesn't
// require the Bearer token, and CLAUDE.md's auth flow explicitly carves it
// out ("Every route except GET /node/info").

function shannonToCkb(shannon: bigint): number {
  return Number(shannon) / SHANNON_PER_CKB;
}

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
    if (error instanceof FiberRpcTimeoutError) {
      return err(503, "NODE_UNAVAILABLE", "Fiber node did not respond in time");
    }
    console.error("getNodeInfo failed:", error);
    return err(503, "NODE_UNAVAILABLE", "Fiber node is unavailable");
  }
}
