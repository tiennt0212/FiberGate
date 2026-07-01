import Link from "next/link";
import { getDashboardStats, getRecentInvoices } from "@/lib/dashboard/queries";
import { getNodeInfoDTO } from "@/lib/node/service";
import { toInvoiceDTO } from "@/lib/invoices/serialize";
import { StatusBadge } from "@/components/StatusBadge";
import { AssetTag } from "@/components/AssetTag";
import { formatAmount, formatDateTime, percent, shortId, truncateMiddle } from "@/lib/format";

export const dynamic = "force-dynamic";

const LOW_INBOUND_CKB = 10; // US-004 warning threshold

export default async function OverviewPage() {
  const [stats, recentRows, node] = await Promise.all([
    getDashboardStats(),
    getRecentInvoices(6),
    getNodeInfoDTO(),
  ]);
  const recent = recentRows.map(toInvoiceDTO);

  const capacityTotal = node.inbound_capacity_ckb + node.outbound_capacity_ckb || 1;
  const inboundPct = Math.round((node.inbound_capacity_ckb / capacityTotal) * 100);
  const outboundPct = Math.round((node.outbound_capacity_ckb / capacityTotal) * 100);
  const lowCapacity = node.status === "online" && node.inbound_capacity_ckb < LOW_INBOUND_CKB;

  const cards = [
    { label: "Paid Volume", value: `${formatAmount(stats.volumeCkb)} CKB`, sub: `+ ${formatAmount(stats.volumeRusd)} RUSD` },
    { label: "Paid Invoices", value: String(stats.paidCount), sub: `of ${stats.totalCount} total` },
    { label: "Pending", value: String(stats.pendingCount), sub: "awaiting payment" },
    { label: "Success Rate", value: percent(stats.successRate), sub: `${stats.paidCount} settled` },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div className="text-[13px] text-muted">
          {node.pubkey ? truncateMiddle(node.pubkey, 12, 8) : "node"} · updated just now
        </div>
      </div>

      {/* Metric cards */}
      <div className="mb-5 grid grid-cols-4 gap-[14px]">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-surface px-5 py-[18px]">
            <div className="mb-[10px] text-[11.5px] font-semibold uppercase tracking-[0.05em] text-xsubtle">
              {c.label}
            </div>
            <div className="mb-1 text-[27px] font-bold leading-none text-ink">{c.value}</div>
            <div className="text-[12px] text-subtle">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[272px_1fr] gap-[14px]">
        {/* Node status */}
        <div className="self-start rounded-lg border border-border bg-surface px-5 py-[18px]">
          <div className="mb-[14px] text-[13px] font-semibold text-ink">Node Status</div>

          <div
            className="mb-[14px] flex items-center gap-[9px] rounded-md border px-3 py-[10px]"
            style={{
              background: node.status === "online" ? "#f0fdf4" : "#fef2f2",
              borderColor: node.status === "online" ? "#bbf7d0" : "#fecaca",
            }}
          >
            <span
              className="pulse-dot h-2 w-2 flex-shrink-0 rounded-full"
              style={{ background: node.status === "online" ? "#16a34a" : "#dc2626" }}
            />
            <div>
              <div
                className="text-[13px] font-semibold"
                style={{ color: node.status === "online" ? "#15803d" : "#991b1b" }}
              >
                {node.status === "online" ? "Online" : "Offline"}
              </div>
              <div className="text-[11.5px] text-subtle">
                {node.status === "online" ? "All systems operational" : "Node not reachable"}
              </div>
            </div>
          </div>

          <div className="mb-[14px] flex flex-col gap-[9px]">
            <Row label="Node ID" value={node.pubkey ? truncateMiddle(node.pubkey, 6, 6) : "—"} mono />
            <Row label="Active channels" value={String(node.active_channels)} />
          </div>

          <div className="flex flex-col gap-[11px] border-t border-border-subtle pt-[14px]">
            <Bar label="Inbound" value={`${formatAmount(node.inbound_capacity_ckb)} CKB`} pct={inboundPct} color="#4f46e5" />
            <Bar label="Outbound" value={`${formatAmount(node.outbound_capacity_ckb)} CKB`} pct={outboundPct} color="#7c3aed" />
          </div>

          {lowCapacity && (
            <div className="mt-3 rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2">
              <div className="text-[12px] font-semibold text-[#92400e]">Low capacity</div>
              <div className="text-[11.5px] text-[#a16207]">
                Inbound below {LOW_INBOUND_CKB} CKB — may not receive larger payments.
              </div>
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-[15px]">
            <span className="text-[13px] font-semibold text-ink">Recent Transactions</span>
            <Link href="/transactions" className="text-[12.5px] font-medium text-accent no-underline">
              View all →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-subtle">No invoices yet.</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#f9f9fb]">
                  <Th className="pl-5">Invoice ID</Th>
                  <Th>Description</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Status</Th>
                  <Th className="pr-5">Date</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#f9f9fb]">
                    <td className="border-b border-border-subtle py-[11px] pl-5 pr-4 font-mono text-[12px] text-muted">
                      {shortId(tx.id)}
                    </td>
                    <td className="border-b border-border-subtle px-4 py-[11px] text-[13px] text-ink">
                      {tx.description ?? "—"}
                    </td>
                    <td className="border-b border-border-subtle px-4 py-[11px] text-right font-mono text-[13px] font-medium text-ink">
                      {formatAmount(tx.amount)}
                      <span className="ml-1 text-[11px] text-subtle">{tx.asset}</span>
                    </td>
                    <td className="border-b border-border-subtle px-4 py-[11px]">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="border-b border-border-subtle py-[11px] pl-4 pr-5 text-[12px] text-muted">
                      {formatDateTime(tx.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className={`text-[12px] font-medium text-ink ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function Bar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-[5px] flex justify-between">
        <span className="text-[12px] text-muted">{label}</span>
        <span className="text-[12px] font-medium text-ink">{value}</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-border-subtle">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: color }} />
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`border-b border-border-subtle px-4 py-[9px] text-left text-[11.5px] font-semibold uppercase tracking-[0.04em] text-xsubtle ${className}`}
    >
      {children}
    </th>
  );
}
