"use client";

import Link from "next/link";
import { Drawer } from "antd";

import { formatCkb } from "@/lib/api/format";
import { ROUTE } from "@/lib/auth/routes";
import type { ChannelDetail } from "@/lib/services/channels";
import type { PeerListItem } from "@/lib/services/peers";

import { StatusTag } from "../badges";
import { shortId } from "../format-date";

import { getChannelsForPeer } from "./peer-channels";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[12.5px] text-text-muted">{label}</span>
      <span className="text-right text-[12.5px] font-medium text-text-primary">{value}</span>
    </div>
  );
}

export function PeerDrawer({
  peer,
  channels,
  onClose,
}: {
  peer: PeerListItem | null;
  channels: ChannelDetail[];
  onClose: () => void;
}) {
  const summary = peer ? getChannelsForPeer(channels, peer.pubkey) : null;

  return (
    <Drawer
      open={peer !== null}
      onClose={onClose}
      width={480}
      title="Peer"
      styles={{ header: { padding: "20px 24px 16px", borderBottom: "1px solid var(--color-border-subtle)" }, body: { padding: 0 } }}
    >
      {peer && summary ? (
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-3">
            <Row label="Pubkey" value={<span className="break-all font-mono text-[11px]">{peer.pubkey}</span>} />
            <Row label="Address" value={<span className="break-all font-mono text-[11px]">{peer.address}</span>} />
            <Row label="Total capacity" value={`${formatCkb(summary.totalCapacityCkb)} CKB`} />
          </div>

          <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
            <div className="mb-1 text-[13px] font-semibold text-text-primary">
              Channels with this peer <span className="font-normal text-text-subtle">({summary.channels.length})</span>
            </div>
            {summary.channels.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-border">
                {summary.channels.map((channel) => (
                  <Link
                    key={channel.channelId}
                    href={`${ROUTE.CHANNELS}?channel=${channel.channelId}`}
                    className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-2.5 no-underline! last:border-b-0 hover:bg-surface-hover"
                  >
                    <span className="font-mono text-[11.5px] text-text-muted">{shortId(channel.channelId)}</span>
                    <span className="font-mono text-[12px] text-text-primary">
                      {formatCkb(channel.localBalanceCkb)} / {formatCkb(channel.remoteBalanceCkb)} {channel.asset}
                    </span>
                    <StatusTag status={channel.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border px-4 py-5 text-center text-[13px] text-text-subtle">
                No channels open with this peer.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
