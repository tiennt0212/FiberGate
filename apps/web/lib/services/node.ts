import { shannonToCkb } from "@/lib/api/format";
import { getNodeInfo } from "@/lib/fiber/client";
import type { FiberNodeInfo } from "@/lib/fiber/types";

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
  status: NodeStatus;
}

// issue #40: this used to be a `"online"` literal — always true once the RPC
// call didn't throw, regardless of actual channel health. "offline" is
// deliberately NOT a member here: an unreachable node is already represented
// by getNodeStatus()/getNodeStatusDetail() *throwing* (FiberRpcTimeoutError or
// otherwise) — GET /node/info's route.ts already maps that to a 503, and the
// dashboard's Overview page already has its own catch branch for it. Adding a
// synthetic "offline" success value here would mean inventing placeholder
// numeric fields (pubkey/capacity/etc.) for a node we couldn't reach at all.
export type NodeStatus = "online" | "degraded";

// "degraded" = the RPC call succeeded but some channels are disabled
// (active_channels < total_channels) — human-confirmed rule (2026-07 issue
// #40 review), computed entirely from data getNodeInfo() already returns, no
// extra RPC call.
function deriveNodeStatus(info: FiberNodeInfo): NodeStatus {
  return info.activeChannels < info.totalChannels ? "degraded" : "online";
}

export async function getNodeStatus(): Promise<NodeStatusResult> {
  const info = await getNodeInfo();
  return {
    pubkey: info.pubkey,
    active_channels: info.activeChannels,
    inbound_capacity_ckb: shannonToCkb(info.inboundCapacityShannon),
    outbound_capacity_ckb: shannonToCkb(info.outboundCapacityShannon),
    status: deriveNodeStatus(info),
  };
}

// Dashboard-only view (Overview page's Node Status panel, issue #10) — kept
// separate from getNodeStatus() rather than growing that function's return
// shape, because getNodeStatus() backs the documented public GET /node/info
// endpoint (.context/api/rest-api-spec.md's response schema lists exactly
// pubkey/active_channels/inbound_capacity_ckb/outbound_capacity_ckb/status;
// silently adding fields to it would drift the public contract out of sync
// with that spec without a human decision — `version` is added below
// because it's genuinely part of NodeStatusResult's existing "status" story,
// not a new unrelated field). total_channels/peer_count/version ARE real data
// from getNodeInfo() (version was wrongly assumed to have "no source" before
// — @ckb-ccc/fiber's NodeInfo.version is real). A capacity-bar "% of total
// capacity" denominator still has no source anywhere in FiberNodeInfo/the
// Fiber RPC wrapper, so that one stays unsurfaced rather than hardcoded.
export interface NodeStatusDetail extends NodeStatusResult {
  total_channels: number;
  peer_count: number;
  version: string;
  /**
   * Zero peers means this node is cut off from the Fiber network: it can't
   * learn routes and no payment can reach it. Surfaced as its own flag rather
   * than left as a "0" among five other numbers, because every *other* signal
   * on the Overview panel still looks healthy in that state — the RPC answers,
   * channels list fine, status reads "online". That gap is precisely how the
   * empty-`announced_addrs` bug survived a production deploy unnoticed (see
   * .context/processes/gotchas.md). Dashboard-only: deliberately NOT added to
   * NodeStatusResult, which backs the documented public GET /node/info.
   */
  is_isolated: boolean;
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
    version: info.version,
    status: deriveNodeStatus(info),
    is_isolated: info.peerCount === 0,
  };
}
