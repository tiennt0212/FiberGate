import { listChannels } from "@/lib/services/channels";
import { listPeers } from "@/lib/services/peers";

import { firstParam } from "../search-params";

import { PeersView } from "./peers-view";

// Server Component. Fetches both peers and channels — the drawer's "total
// capacity + this peer's channels" only has something to show because
// channels.ts's list is cross-referenced by pubkey (see peer-channels.ts),
// not because peers themselves carry that data.
export default async function PeersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  let peers: Awaited<ReturnType<typeof listPeers>> = [];
  let channels: Awaited<ReturnType<typeof listChannels>> = [];
  let error: string | null = null;
  try {
    [peers, channels] = await Promise.all([listPeers(), listChannels()]);
  } catch (fetchError) {
    console.error("Peers: failed to load peers/channels:", fetchError);
    error = "Could not load peers.";
  }

  return <PeersView peers={peers} channels={channels} error={error} openPeerPubkey={firstParam(searchParams.peer) ?? null} />;
}
