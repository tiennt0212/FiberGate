"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Alert, Table } from "antd";
import type { ColumnsType } from "antd/es/table";

import { formatCkb } from "@/lib/api/format";
import type { ChannelDetail } from "@/lib/services/channels";

import { AssetTag, channelStatusDotColor, StatusTag } from "../badges";
import { shortId } from "../format-date";

import { sumCapacityCkb } from "./channel-capacity";
import { ChannelDrawer } from "./channel-drawer";
import { computeTopology } from "./channel-topology";

const LEGEND = [
  { color: channelStatusDotColor("active"), label: "Active — routing normally" },
  { color: channelStatusDotColor("closing"), label: "Closing — cooperative close in progress" },
  { color: channelStatusDotColor("disabled"), label: "Disabled" },
];

function NodeTopology({ channels }: { channels: ChannelDetail[] }) {
  const nodes = useMemo(() => computeTopology(channels), [channels]);
  const peerCount = nodes.length;

  return (
    <div className="self-start rounded-lg border border-border bg-white px-5 py-4.5">
      <div className="mb-0.5 text-[13px] font-semibold text-text-primary">Node Topology</div>
      <div className="mb-3.5 text-[11.5px] text-text-subtle">
        Single-node star · {peerCount} peer{peerCount === 1 ? "" : "s"}
      </div>
      <svg width="100%" height="180" viewBox="0 0 220 220" className="mx-auto block">
        {nodes.map((node) => (
          <line
            key={`line-${node.peerPubkey}`}
            x1={110}
            y1={110}
            x2={node.x}
            y2={node.y}
            stroke="var(--color-border)"
            strokeWidth={1.5}
          />
        ))}
        {nodes.map((node) => (
          <circle key={`dot-${node.peerPubkey}`} cx={node.x} cy={node.y} r={6} fill={channelStatusDotColor(node.status)} />
        ))}
        <circle cx={110} cy={110} r={14} fill="var(--color-accent)" />
      </svg>
      <div className="mt-3.5 flex flex-col gap-1.75 border-t border-border-subtle pt-3">
        {LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-1.75 text-[11.5px] text-text-muted">
            <div className="h-1.75 w-1.75 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChannelsView({
  channels,
  error,
  openChannelId,
}: {
  channels: ChannelDetail[];
  error: string | null;
  /** Deep-link from the Peer Drawer's channel list (?channel=<id>) — auto-opens that channel's drawer on load. */
  openChannelId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedChannel, setSelectedChannel] = useState<ChannelDetail | null>(null);

  useEffect(() => {
    if (!openChannelId) {
      return;
    }
    const match = channels.find((channel) => channel.channelId === openChannelId);
    if (match) {
      setSelectedChannel(match);
    }
    // Only run once per navigation to this deep link, not on every `channels` re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openChannelId]);

  // Strips a stale ?channel= from the address bar on close — otherwise a
  // refresh or browser back-navigation would silently reopen the drawer the
  // user just dismissed (issue #40 review).
  function closeDrawer(): void {
    setSelectedChannel(null);
    if (openChannelId) {
      router.replace(pathname);
    }
  }

  const activeCount = useMemo(() => channels.filter((channel) => channel.status === "active").length, [channels]);
  const combinedBalanceCkb = useMemo(() => sumCapacityCkb(channels), [channels]);

  const columns: ColumnsType<ChannelDetail> = [
    {
      title: "Peer",
      dataIndex: "peerPubkey",
      key: "peer",
      render: (peerPubkey: string) => <span className="font-mono text-[12px] text-text-muted">{shortId(peerPubkey)}</span>,
    },
    {
      title: "Asset",
      dataIndex: "asset",
      key: "asset",
      render: (asset: string) => <AssetTag asset={asset} />,
    },
    {
      title: "Local (out)",
      dataIndex: "localBalanceCkb",
      key: "local",
      align: "right",
      render: (value: number) => <span className="font-mono text-[13px] font-medium text-text-primary">{formatCkb(value)}</span>,
    },
    {
      title: "Remote (in)",
      dataIndex: "remoteBalanceCkb",
      key: "remote",
      align: "right",
      render: (value: number) => <span className="font-mono text-[13px] font-medium text-text-primary">{formatCkb(value)}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => <StatusTag status={status} />,
    },
  ];

  return (
    <div className="animate-[fade-in_0.2s_ease-out_forwards]">
      <div className="mb-4.5 text-[12.5px] text-text-subtle">All Fiber Network payment channels on this node</div>

      {error ? (
        <Alert type="warning" showIcon message={error} className="mb-5 rounded-md!" />
      ) : (
        <div className="grid grid-cols-[272px_1fr] gap-3.5">
          <NodeTopology channels={channels} />

          <div className="overflow-hidden rounded-lg border border-border bg-white">
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <span className="text-[13px] font-semibold text-text-primary">Channels</span>
              <span className="text-[12.5px] text-text-muted">
                {activeCount} active · {formatCkb(combinedBalanceCkb)} combined balance
              </span>
            </div>
            <Table
              dataSource={channels}
              columns={columns}
              pagination={false}
              rowKey="channelId"
              className="fibergate-table"
              onRow={(row) => ({ onClick: () => setSelectedChannel(row), className: "cursor-pointer" })}
            />
          </div>
        </div>
      )}

      <ChannelDrawer channel={selectedChannel} onClose={closeDrawer} />
    </div>
  );
}
