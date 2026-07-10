import type { ChannelDetail, ChannelStatus } from "@/lib/services/channels";

// Node Topology mini-diagram (issue #40 mockup) — FiberGate.dc.html hardcodes
// 7 placeholder node coordinates; this computes real positions for however
// many distinct peers are actually in `channels`, evenly spaced on a circle
// around the local node, colored by that peer's best channel status. No
// separate RPC call: purely derived from the channel list the page already
// fetched. "No open channel" (a 4th legend color in the mockup) is
// deliberately not modeled here — every entry in `channels` has a peer by
// definition, so that bucket can never actually occur from this data source.
//
// Returns `status`, not a resolved color: this file stays plain topology
// math with zero UI-layer dependency (color resolution — badges.tsx's
// channelStatusDotColor() — happens where it's rendered, channels-view.tsx).
// Also sidesteps a real Vitest/esbuild limitation: tsconfig.json's
// `jsx: "preserve"` (required for Next.js's own SWC JSX transform) makes
// Vitest's esbuild transform fail to parse any .tsx file reached from a
// .test.ts file's import graph, so a plain .ts logic file must never import
// from a .tsx component file.

export interface TopologyNode {
  peerPubkey: string;
  x: number;
  y: number;
  status: ChannelStatus;
}

// "active" beats "closing" beats "disabled" when a peer has multiple
// channels in different states — a plain priority chain reads directly
// without needing a reader to map priority numbers back to meaning.
function bestStatus(statuses: ChannelStatus[]): ChannelStatus {
  if (statuses.includes("active")) return "active";
  if (statuses.includes("closing")) return "closing";
  return "disabled";
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
      status: bestStatus(statuses),
    };
  });
}
