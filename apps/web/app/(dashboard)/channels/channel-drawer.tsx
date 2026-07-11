"use client";

import Link from "next/link";
import { Drawer } from "antd";

import { formatCkb } from "@/lib/api/format";
import { ROUTE } from "@/lib/auth/routes";
import type { ChannelDetail } from "@/lib/services/channels";

import { StatusTag } from "../badges";
import { Row } from "../drawer-row";
import { formatDateTime } from "../format-date";

// Colocated with channels-view.tsx (its only caller). Unlike
// invoices/receipt-drawer.tsx, this never fetches anything itself — every
// field it shows already came down with the row in channels.ts's single
// listChannelsDetailed() call, so opening the drawer is just rendering the
// already-selected ChannelDetail.

const EXPLORER_TX_BASE = "https://pudge.explorer.nervos.org/transaction/";

export function ChannelDrawer({ channel, onClose }: { channel: ChannelDetail | null; onClose: () => void }) {
  return (
    <Drawer
      open={channel !== null}
      onClose={onClose}
      width={480}
      title="Channel"
      styles={{ header: { padding: "20px 24px 16px", borderBottom: "1px solid var(--color-border-subtle)" }, body: { padding: 0 } }}
    >
      {channel ? (
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-3">
            <Row label="Channel ID" value={<span className="break-all font-mono text-[11px]">{channel.channelId}</span>} />
            <Row
              label="Peer"
              value={
                <Link
                  href={`${ROUTE.PEERS}?peer=${channel.peerPubkey}`}
                  className="break-all font-mono text-[11px] text-accent no-underline! hover:text-accent-hover"
                >
                  {channel.peerPubkey} →
                </Link>
              }
            />
            <Row label="Status" value={<StatusTag status={channel.status} />} />
            <Row label="Asset" value={channel.asset} />
            <Row label="Visibility" value={channel.isPublic ? "Public" : "Private"} />
            <Row label="Created" value={formatDateTime(new Date(channel.createdAt))} />
          </div>

          <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
            <div className="text-[13px] font-semibold text-text-primary">Balance</div>
            <Row label="Local (outbound)" value={`${formatCkb(channel.localBalanceCkb)} ${channel.asset}`} />
            <Row label="Remote (inbound)" value={`${formatCkb(channel.remoteBalanceCkb)} ${channel.asset}`} />
            {channel.offeredTlcBalanceCkb > 0 || channel.receivedTlcBalanceCkb > 0 ? (
              <>
                <Row label="Offered (in-flight)" value={`${formatCkb(channel.offeredTlcBalanceCkb)} ${channel.asset}`} />
                <Row label="Received (in-flight)" value={`${formatCkb(channel.receivedTlcBalanceCkb)} ${channel.asset}`} />
                <div className="text-[11.5px] leading-relaxed text-text-subtle">
                  In-flight amounts are locked in pending payments — available capacity can be lower than the balance above until they settle.
                </div>
              </>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
            <div className="text-[13px] font-semibold text-text-primary">Protocol</div>
            <Row label="Fee rate" value={`${(channel.tlcFeeProportionalMillionths / 10_000).toFixed(4)}% (${channel.tlcFeeProportionalMillionths} millionths)`} />
            <Row label="TLC expiry delta" value={channel.tlcExpiryDelta} />
            <Row label="Raw state" value={<span className="font-mono text-[11px]">{channel.stateName}</span>} />
            {channel.stateFlags !== "0x0" ? <Row label="State flags" value={<span className="font-mono text-[11px]">{channel.stateFlags}</span>} /> : null}
          </div>

          <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
            <div className="mb-1 text-[12px] text-text-muted">Channel outpoint</div>
            <div className="break-all rounded-[5px] bg-border-subtle px-2.5 py-2 font-mono text-[11px] leading-relaxed text-text-strong">
              {channel.channelOutpoint}
            </div>
            {channel.latestCommitmentTransactionHash ? (
              <a
                href={`${EXPLORER_TX_BASE}${channel.latestCommitmentTransactionHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-accent no-underline! hover:text-accent-hover"
              >
                View latest commitment tx →
              </a>
            ) : null}
            {channel.shutdownTransactionHash ? (
              <a
                href={`${EXPLORER_TX_BASE}${channel.shutdownTransactionHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-accent no-underline! hover:text-accent-hover"
              >
                View shutdown tx →
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
