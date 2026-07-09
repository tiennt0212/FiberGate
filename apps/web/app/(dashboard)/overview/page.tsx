import Link from "next/link";
import { Alert, Progress } from "antd";

import { formatCkb, shannonToCkb } from "@/lib/api/format";
import { ROUTE } from "@/lib/auth/routes";
import { FiberRpcTimeoutError } from "@/lib/fiber/types";
import { getInvoiceStats, listInvoices } from "@/lib/services/invoices";
import { getNodeStatusDetail, type NodeStatusDetail } from "@/lib/services/node";
import type { InvoiceRow } from "@/lib/db/schema";

import { shortId } from "../format-date";
import { toInvoiceView } from "../invoice-view";
import { StatCard } from "../stat-card";

import { RecentInvoicesTable } from "./recent-invoices-table";

// Server Component — every section fetches independently through the
// service layer (CLAUDE.md) and degrades on its own if that one call fails,
// rather than one failed RPC (e.g. a Fiber node timeout) blanking the whole
// Overview page.

async function loadNodeStatus(): Promise<{ status: NodeStatusDetail | null; error: string | null }> {
  try {
    return { status: await getNodeStatusDetail(), error: null };
  } catch (error) {
    console.error("Overview: getNodeStatusDetail failed:", error);
    const message =
      error instanceof FiberRpcTimeoutError
        ? "Fiber node did not respond in time."
        : "Fiber node is unavailable.";
    return { status: null, error: message };
  }
}

async function loadStats() {
  try {
    return { stats: await getInvoiceStats(), error: null as string | null };
  } catch (error) {
    console.error("Overview: getInvoiceStats failed:", error);
    return { stats: null, error: "Could not load invoice stats." };
  }
}

async function loadRecentInvoices() {
  try {
    const result = await listInvoices({ limit: 5 });
    return { rows: result.rows, error: null as string | null };
  } catch (error) {
    console.error("Overview: listInvoices failed:", error);
    return { rows: [] as InvoiceRow[], error: "Could not load recent invoices." };
  }
}

export default async function OverviewPage() {
  const [{ status: nodeStatus, error: nodeError }, { stats, error: statsError }, { rows: recentInvoices, error: invoicesError }] =
    await Promise.all([loadNodeStatus(), loadStats(), loadRecentInvoices()]);

  const totalLiquidity = nodeStatus ? nodeStatus.inbound_capacity_ckb + nodeStatus.outbound_capacity_ckb : 0;
  const inboundShare = totalLiquidity > 0 ? Math.round((nodeStatus!.inbound_capacity_ckb / totalLiquidity) * 100) : 0;
  const outboundShare = totalLiquidity > 0 ? 100 - inboundShare : 0;

  const paidAssets = stats ? Object.entries(stats.paidVolumeByAsset) : [];
  const primaryVolume = paidAssets.find(([asset]) => asset === "CKB") ?? paidAssets[0];
  const secondaryVolumes = paidAssets.filter(([asset]) => !primaryVolume || asset !== primaryVolume[0]);

  return (
    <div className="animate-[fade-in_0.2s_ease-out_forwards]">
      <div className="mb-5 grid grid-cols-4 gap-3.5">
        <StatCard
          label="Paid Volume (30d)"
          value={primaryVolume ? `${formatCkb(shannonToCkb(primaryVolume[1]))} ${primaryVolume[0]}` : "0 CKB"}
          sub={
            secondaryVolumes.length > 0
              ? secondaryVolumes.map(([asset, amount]) => `+ ${formatCkb(shannonToCkb(amount))} ${asset}`).join(", ")
              : "Last 30 days"
          }
        />
        <StatCard label="Paid Invoices (30d)" value={stats?.paidCount ?? "—"} sub="Successfully settled" />
        <StatCard label="Pending Invoices (30d)" value={stats?.pendingCount ?? "—"} sub="Awaiting payment" />
        <StatCard
          label="Success Rate (30d)"
          value={stats && stats.totalCount > 0 ? `${Math.round((stats.paidCount / stats.totalCount) * 100)}%` : "—"}
          sub="Paid / total invoices"
        />
      </div>

      {statsError ? <Alert type="warning" showIcon message={statsError} className="mb-5 rounded-md!" /> : null}

      <div className="grid grid-cols-[272px_1fr] gap-3.5">
        <div className="self-start rounded-lg border border-border bg-white px-5 py-4.5">
          <div className="mb-3.5 text-[13px] font-semibold text-text-primary">Node Status</div>

          {nodeError ? (
            <Alert type="error" showIcon message={nodeError} className="mb-3.5 rounded-md!" />
          ) : (
            <>
              <div className="mb-3.5 flex items-center gap-2.5 rounded-md border border-status-online-border bg-status-online-bg px-3 py-2.5">
                <div className="h-2 w-2 shrink-0 rounded-full bg-success [animation:pulse-dot_2s_ease-in-out_infinite]" />
                <div>
                  <div className="text-[13px] font-semibold text-status-success-text">Online</div>
                  <div className="text-[11.5px] text-[#4ade80]">All systems operational</div>
                </div>
              </div>
              <div className="mb-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] text-text-muted">Node ID</span>
                  <span className="font-mono text-[12px] font-medium text-text-primary">{shortId(nodeStatus?.pubkey)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] text-text-muted">Total channels</span>
                  <span className="text-[12.5px] font-medium text-text-primary">{nodeStatus?.total_channels ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] text-text-muted">Active channels</span>
                  <span className="text-[12.5px] font-medium text-text-primary">{nodeStatus?.active_channels ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] text-text-muted">Peers</span>
                  <span className="text-[12.5px] font-medium text-text-primary">{nodeStatus?.peer_count ?? "—"}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2.5 border-t border-border-subtle pt-3.5">
                <div>
                  <div className="mb-1 flex justify-between">
                    <span className="text-[12px] text-text-muted">Inbound</span>
                    <span className="text-[12px] font-medium text-text-primary">{formatCkb(nodeStatus?.inbound_capacity_ckb ?? 0)} CKB</span>
                  </div>
                  <Progress
                    percent={inboundShare}
                    showInfo={false}
                    strokeColor="var(--color-accent)"
                    trailColor="var(--color-border-subtle)"
                    strokeLinecap="round"
                    className="[&_.ant-progress-bg]:h-1.25!"
                  />
                  <div className="mt-0.5 text-[11px] text-text-subtle">{inboundShare}% of channel liquidity</div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between">
                    <span className="text-[12px] text-text-muted">Outbound</span>
                    <span className="text-[12px] font-medium text-text-primary">{formatCkb(nodeStatus?.outbound_capacity_ckb ?? 0)} CKB</span>
                  </div>
                  <Progress
                    percent={outboundShare}
                    showInfo={false}
                    strokeColor="var(--color-purple)"
                    trailColor="var(--color-border-subtle)"
                    strokeLinecap="round"
                    className="[&_.ant-progress-bg]:h-1.25!"
                  />
                  <div className="mt-0.5 text-[11px] text-text-subtle">{outboundShare}% of channel liquidity</div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <span className="text-[13px] font-semibold text-text-primary">Recent Invoices</span>
            <Link href={ROUTE.INVOICES} className="text-[12.5px] font-medium text-accent no-underline! hover:text-accent-hover">
              View all →
            </Link>
          </div>
          {invoicesError ? (
            <Alert type="warning" showIcon message={invoicesError} className="m-5 rounded-md!" />
          ) : recentInvoices.length > 0 ? (
            <RecentInvoicesTable rows={recentInvoices.map(toInvoiceView)} />
          ) : (
            <div className="px-5 py-12 text-center">
              <div className="mb-1.5 text-[14px] font-semibold text-text-strong">No invoices yet</div>
              <div className="mb-4 text-[13px] text-text-subtle">Create your first invoice to start accepting payments.</div>
              <Link
                href={ROUTE.QUICK_START}
                className="inline-flex items-center rounded-md bg-accent px-4 py-1.5 text-[13px] font-medium text-white no-underline! hover:bg-accent-hover"
              >
                Quick Start →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
