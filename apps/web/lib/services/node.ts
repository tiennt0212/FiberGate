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
