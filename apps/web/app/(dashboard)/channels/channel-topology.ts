import type { ChannelDetail, ChannelStatus } from "@/lib/services/channels";

// Node Topology mini-diagram (issue #40 mockup) — FiberGate.dc.html hardcodes
// 7 placeholder node coordinates; this computes real positions for however
// many distinct peers are actually in `channels`, evenly spaced on a circle
// around the local node, colored by that peer's best channel status. No
// separate RPC call: purely derived from the channel list the page already
// fetched. "No open channel" (a 4th legend color in the mockup) is
// deliberately not modeled here — every entry in `channels` has a peer by
// definition, so that bucket can never actually occur from this data source.

export interface TopologyNode {
  peerPubkey: string;
  x: number;
  y: number;
  color: string;
}

const STATUS_PRIORITY: Record<ChannelStatus, number> = { active: 0, closing: 1, disabled: 2 };

// Matches DESIGN.md's Node Status Indicator dot colors (active=success,
// closing=degraded/warning) plus badges.tsx's "disabled" muted tone.
const STATUS_COLOR: Record<ChannelStatus, string> = {
  active: "#16a34a",
  closing: "#f59e0b",
  disabled: "#a1a1aa",
};

function bestStatus(statuses: ChannelStatus[]): ChannelStatus {
  return statuses.reduce((best, status) => (STATUS_PRIORITY[status] < STATUS_PRIORITY[best] ? status : best));
}

const CENTER = 110;
const RADIUS = 82;

export function computeTopology(channels: ChannelDetail[]): TopologyNode[] {
  const statusesByPeer = new Map<string, ChannelStatus[]>();
  for (const channel of channels) {
    const statuses = statusesByPeer.get(channel.peerPubkey) ?? [];
    statuses.push(channel.status);
    statusesByPeer.set(channel.peerPubkey, statuses);
  }

  const peers = [...statusesByPeer.entries()];
  const count = peers.length;
  return peers.map(([peerPubkey, statuses], index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    return {
      peerPubkey,
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
      color: STATUS_COLOR[bestStatus(statuses)],
    };
  });
}
