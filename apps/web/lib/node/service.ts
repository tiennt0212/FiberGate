import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { nodeSnapshots } from "@/lib/db/schema";
import { getNodeSummary } from "@/lib/fiber/client";
import { shannonToAmount } from "@/lib/invoices/constants";

export interface NodeInfoDTO {
  pubkey: string;
  active_channels: number;
  inbound_capacity_ckb: number;
  outbound_capacity_ckb: number;
  status: "online" | "offline";
}

/** GET /node/info payload (US-004). Falls back to the latest snapshot when the node is down. */
export async function getNodeInfoDTO(): Promise<NodeInfoDTO> {
  try {
    const s = await getNodeSummary();
    return {
      pubkey: s.pubkey,
      active_channels: s.activeChannels,
      inbound_capacity_ckb: shannonToAmount(s.inboundCapacityShannon),
      outbound_capacity_ckb: shannonToAmount(s.outboundCapacityShannon),
      status: "online",
    };
  } catch {
    const [snap] = await db
      .select()
      .from(nodeSnapshots)
      .orderBy(desc(nodeSnapshots.snapshotAt))
      .limit(1);
    return {
      pubkey: snap?.nodePubkey ?? "",
      active_channels: snap?.activeChannels ?? 0,
      inbound_capacity_ckb: shannonToAmount(snap?.inboundCapacityShannon ?? 0n),
      outbound_capacity_ckb: shannonToAmount(snap?.outboundCapacityShannon ?? 0n),
      status: "offline",
    };
  }
}

/** Persist a periodic node snapshot for dashboard metrics (node_snapshots, ~1/min). */
export async function takeNodeSnapshot(): Promise<void> {
  const s = await getNodeSummary();
  await db.insert(nodeSnapshots).values({
    nodePubkey: s.pubkey,
    totalChannels: s.totalChannels,
    activeChannels: s.activeChannels,
    inboundCapacityShannon: s.inboundCapacityShannon,
    outboundCapacityShannon: s.outboundCapacityShannon,
    peerCount: s.peerCount,
  });
}
