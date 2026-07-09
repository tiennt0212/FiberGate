"use client";

import { useEffect, useState } from "react";
import { Alert, Table } from "antd";
import type { ColumnsType } from "antd/es/table";

import type { ChannelDetail } from "@/lib/services/channels";
import type { PeerListItem } from "@/lib/services/peers";

import { shortId } from "../format-date";

import { PeerDrawer } from "./peer-drawer";

const COLUMNS: ColumnsType<PeerListItem> = [
  {
    title: "Pubkey",
    dataIndex: "pubkey",
    key: "pubkey",
    render: (pubkey: string) => <span className="font-mono text-[12px] text-text-muted">{shortId(pubkey)}</span>,
  },
  {
    title: "Address",
    dataIndex: "address",
    key: "address",
    render: (address: string) => <span className="font-mono text-[12px] text-text-muted">{address}</span>,
  },
];

export function PeersView({
  peers,
  channels,
  error,
  openPeerPubkey,
}: {
  peers: PeerListItem[];
  channels: ChannelDetail[];
  error: string | null;
  /** Deep-link from the Channel Drawer's "View peer →" link (?peer=<pubkey>) — auto-opens that peer's drawer on load. */
  openPeerPubkey: string | null;
}) {
  const [selectedPeer, setSelectedPeer] = useState<PeerListItem | null>(null);

  useEffect(() => {
    if (!openPeerPubkey) {
      return;
    }
    const match = peers.find((peer) => peer.pubkey === openPeerPubkey);
    if (match) {
      setSelectedPeer(match);
    }
    // Only run once per navigation to this deep link, not on every `peers` re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPeerPubkey]);

  return (
    <div className="animate-[fade-in_0.2s_ease-out_forwards]">
      <div className="mb-4.5 text-[12.5px] text-text-subtle">Connected Fiber Network peers</div>

      {error ? (
        <Alert type="warning" showIcon message={error} className="mb-5 rounded-md!" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <Table
            dataSource={peers}
            columns={COLUMNS}
            pagination={false}
            rowKey="pubkey"
            className="fibergate-table"
            onRow={(row) => ({ onClick: () => setSelectedPeer(row), className: "cursor-pointer" })}
          />
        </div>
      )}

      <PeerDrawer peer={selectedPeer} channels={channels} onClose={() => setSelectedPeer(null)} />
    </div>
  );
}
