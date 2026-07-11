import { listPeersDetailed } from "@/lib/fiber/client";

// Peers page (issue #40). listPeersDetailed() (lib/fiber/client.ts) already
// only returns pubkey/address — see FiberPeer's doc comment — so there's
// nothing to derive/transform here, unlike channels.ts. Per-peer channel
// cross-referencing (total capacity, that peer's channel list) is computed
// client-side in app/(dashboard)/peers/peer-channels.ts from the Channels
// page's already-fetched list, not duplicated as a second query here.
export interface PeerListItem {
  pubkey: string;
  address: string;
}

export async function listPeers(): Promise<PeerListItem[]> {
  return listPeersDetailed();
}
