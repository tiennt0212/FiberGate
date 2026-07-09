import type { ChannelDetail } from "@/lib/services/channels";

// Cross-references the Channels page's already-fetched list by peerPubkey —
// PeerInfo itself (lib/services/peers.ts) has nothing beyond pubkey/address,
// so this derived view (which channels does this peer have, how much
// capacity in total) is the actual value of the Peer Drawer, not a second
// RPC/DB call. Reused by both peers-view.tsx (table + drawer) and
// peer-drawer.tsx.
export interface PeerChannelsSummary {
  channels: ChannelDetail[];
  totalCapacityCkb: number;
}

export function getChannelsForPeer(channels: ChannelDetail[], peerPubkey: string): PeerChannelsSummary {
  const peerChannels = channels.filter((channel) => channel.peerPubkey === peerPubkey);
  // Same known CKB/RUSD-decimals simplification noted in channels-view.tsx —
  // sums across assets without converting between them.
  const totalCapacityCkb = peerChannels.reduce((sum, channel) => sum + channel.localBalanceCkb + channel.remoteBalanceCkb, 0);
  return { channels: peerChannels, totalCapacityCkb };
}
