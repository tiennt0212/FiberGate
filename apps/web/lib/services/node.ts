import { shannonToCkb } from "@/lib/api/format";
import { getNodeInfo } from "@/lib/fiber/client";

// Deliberately returns the API-shaped (snake_case) object directly rather
// than a separate camelCase domain type + serializer: this endpoint has no
// DB-backed model distinct from its wire shape and only one consumer, so an
// extra layer would be over-engineering for 4 fields. Contrast with
// lib/services/invoices.ts, which returns raw InvoiceRow and leaves
// serialization to the route — that split exists there because InvoiceRow
// has other consumers (the poller) that need the DB shape, not the API one.
export interface NodeStatusResult {
  pubkey: string;
  active_channels: number;
  inbound_capacity_ckb: number;
  outbound_capacity_ckb: number;
  status: "online";
}

export async function getNodeStatus(): Promise<NodeStatusResult> {
  const info = await getNodeInfo();
  return {
    pubkey: info.pubkey,
    active_channels: info.activeChannels,
    inbound_capacity_ckb: shannonToCkb(info.inboundCapacityShannon),
    outbound_capacity_ckb: shannonToCkb(info.outboundCapacityShannon),
    status: "online",
  };
}

// Dashboard-only view (Overview page's Node Status panel, issue #10) — kept
// separate from getNodeStatus() rather than growing that function's return
// shape, because getNodeStatus() backs the documented public GET /node/info
// endpoint (.context/api/rest-api-spec.md's response schema lists exactly
// pubkey/active_channels/inbound_capacity_ckb/outbound_capacity_ckb/status;
// silently adding fields to it would drift the public contract out of sync
// with that spec without a human decision). total_channels/peer_count ARE
// real data already returned by getNodeInfo() — unlike node version or a
// capacity-bar "% of total capacity" denominator, neither of which has any
// source anywhere in FiberNodeInfo/the Fiber RPC wrapper, so those two stay
// unsurfaced rather than hardcoded as if real.
export interface NodeStatusDetail extends NodeStatusResult {
  total_channels: number;
  peer_count: number;
}

export async function getNodeStatusDetail(): Promise<NodeStatusDetail> {
  const info = await getNodeInfo();
  return {
    pubkey: info.pubkey,
    total_channels: info.totalChannels,
    active_channels: info.activeChannels,
    peer_count: info.peerCount,
    inbound_capacity_ckb: shannonToCkb(info.inboundCapacityShannon),
    outbound_capacity_ckb: shannonToCkb(info.outboundCapacityShannon),
    status: "online",
  };
}
