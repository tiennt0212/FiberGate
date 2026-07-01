"use client";

import { useMemo, useState } from "react";
import { Button, Modal, Segmented } from "antd";
import type { InvoiceDTO } from "@/lib/invoices/serialize";
import { StatusBadge } from "@/components/StatusBadge";
import { AssetTag } from "@/components/AssetTag";
import { formatAmount, formatDateTime, shortId } from "@/lib/format";

export interface SettlementDTO {
  invoiceId: string;
  event: string;
  endpointUrl: string;
  httpStatus: number | null;
  deliveryStatus: string;
  deliveredAt: string | null;
  createdAt: string;
}

type StatusFilter = "all" | "paid" | "pending" | "expired" | "failed";
type AssetFilter = "all" | "CKB" | "RUSD";

export function TransactionsClient({
  invoices,
  settlement,
}: {
  invoices: InvoiceDTO[];
  settlement: SettlementDTO[];
}) {
  const [tab, setTab] = useState<"invoices" | "settlement">("invoices");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [asset, setAsset] = useState<AssetFilter>("all");
  const [receipt, setReceipt] = useState<InvoiceDTO | null>(null);

  const filtered = useMemo(
    () =>
      invoices.filter(
        (i) => (status === "all" || i.status === status) && (asset === "all" || i.asset === asset),
      ),
    [invoices, status, asset],
  );

  function exportCsv() {
    const header = ["id", "description", "amount", "asset", "status", "created_at", "paid_at"];
    const rows = filtered.map((i) => [
      i.id,
      (i.description ?? "").replace(/"/g, '""'),
      i.amount,
      i.asset,
      i.status,
      i.created_at,
      i.paid_at ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `fibergate-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadReceipt(inv: InvoiceDTO) {
    const body = [
      "FiberGate — Payment Receipt",
      `Invoice ID:   ${inv.id}`,
      `Description:  ${inv.description ?? "—"}`,
      `Amount:       ${formatAmount(inv.amount)} ${inv.asset}`,
      `Status:       ${inv.status}`,
      `Paid at:      ${formatDateTime(inv.paid_at)}`,
      `Payment hash: ${inv.payment_hash}`,
    ].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${shortId(inv.id)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-[18px]">
        <div className="text-[15px] font-semibold text-ink">Transactions</div>
        <div className="mt-[2px] text-[12.5px] text-muted">All invoices and payment events</div>
      </div>

      <div className="mb-4 flex gap-4 border-b border-border">
        <TabButton active={tab === "invoices"} onClick={() => setTab("invoices")}>
          Invoices
        </TabButton>
        <TabButton active={tab === "settlement"} onClick={() => setTab("settlement")}>
          Settlement log
        </TabButton>
      </div>

      {tab === "invoices" ? (
        <>
          <div className="mb-[14px] flex flex-wrap items-center gap-[10px]">
            <Segmented<StatusFilter>
              value={status}
              onChange={setStatus}
              options={[
                { label: "All", value: "all" },
                { label: "Paid", value: "paid" },
                { label: "Pending", value: "pending" },
                { label: "Expired", value: "expired" },
                { label: "Failed", value: "failed" },
              ]}
            />
            <Segmented<AssetFilter>
              value={asset}
              onChange={setAsset}
              options={[
                { label: "All assets", value: "all" },
                { label: "CKB", value: "CKB" },
                { label: "RUSD", value: "RUSD" },
              ]}
            />
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[12.5px] text-muted">{filtered.length} transactions</span>
              <Button size="small" onClick={exportCsv} disabled={filtered.length === 0}>
                Export CSV
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-[#f9f9fb]">
                  <Th className="pl-5">Invoice ID</Th>
                  <Th>Description</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Asset</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  <Th className="pr-5" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-[13px] text-subtle">
                      No matching invoices.
                    </td>
                  </tr>
                ) : (
                  filtered.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#f9f9fb]">
                      <Td className="pl-5 font-mono text-[12px] text-muted">{shortId(tx.id)}</Td>
                      <Td className="text-[13px] text-ink">{tx.description ?? "—"}</Td>
                      <Td className="text-right font-mono text-[13px] font-medium text-ink">
                        {formatAmount(tx.amount)}
                      </Td>
                      <Td>
                        <AssetTag asset={tx.asset} />
                      </Td>
                      <Td>
                        <StatusBadge status={tx.status} />
                      </Td>
                      <Td className="text-[12px] text-muted">{formatDateTime(tx.created_at)}</Td>
                      <Td className="pr-5 text-right">
                        {tx.status === "paid" && (
                          <Button size="small" onClick={() => setReceipt(tx)}>
                            Receipt
                          </Button>
                        )}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="border-b border-border-subtle px-5 py-[14px]">
            <span className="text-[13px] font-semibold text-ink">Webhook Delivery Log</span>
            <span className="ml-[10px] text-[12px] text-subtle">
              Payment events sent to your endpoints
            </span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-[#f9f9fb]">
                <Th className="pl-5">Invoice ID</Th>
                <Th>Event</Th>
                <Th>Endpoint</Th>
                <Th>HTTP</Th>
                <Th className="pr-5">Delivered</Th>
              </tr>
            </thead>
            <tbody>
              {settlement.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-[13px] text-subtle">
                    No settlement events yet.
                  </td>
                </tr>
              ) : (
                settlement.map((row, idx) => (
                  <tr key={`${row.invoiceId}-${idx}`} className="hover:bg-[#f9f9fb]">
                    <Td className="pl-5 font-mono text-[12px] text-muted">{shortId(row.invoiceId)}</Td>
                    <Td className="font-mono text-[12px] text-ink">{row.event}</Td>
                    <Td className="max-w-[220px] truncate text-[12px] text-muted">{row.endpointUrl}</Td>
                    <Td>
                      <span
                        className="font-mono text-[12px] font-semibold"
                        style={{ color: httpColor(row.httpStatus) }}
                      >
                        {row.httpStatus ?? "—"}
                      </span>
                    </Td>
                    <Td className="pr-5 text-[12px] text-muted">
                      {formatDateTime(row.deliveredAt ?? row.createdAt)}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={receipt !== null}
        onCancel={() => setReceipt(null)}
        title="Payment Receipt"
        footer={[
          <Button key="close" onClick={() => setReceipt(null)}>
            Close
          </Button>,
          <Button key="dl" type="primary" onClick={() => receipt && downloadReceipt(receipt)}>
            Download
          </Button>,
        ]}
      >
        {receipt && (
          <div className="flex flex-col gap-[13px] py-2">
            <ReceiptRow label="Description" value={receipt.description ?? "—"} />
            <ReceiptRow label="Amount" value={`${formatAmount(receipt.amount)} ${receipt.asset}`} />
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-muted">Status</span>
              <StatusBadge status={receipt.status} />
            </div>
            <ReceiptRow label="Paid at" value={formatDateTime(receipt.paid_at)} />
            <div className="border-t border-border-subtle pt-3">
              <div className="mb-[5px] text-[12px] text-muted">Payment hash</div>
              <div className="break-all rounded bg-border-subtle px-[10px] py-2 font-mono text-[11px] leading-relaxed text-[#374151]">
                {receipt.payment_hash}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function httpColor(code: number | null): string {
  if (code == null) return "#71717a";
  if (code >= 200 && code < 300) return "#15803d";
  return "#991b1b";
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mb-px cursor-pointer border-none bg-transparent px-[18px] py-2 text-[13px] font-medium"
      style={{
        borderBottom: `2px solid ${active ? "#4f46e5" : "transparent"}`,
        color: active ? "#141414" : "#71717a",
      }}
    >
      {children}
    </button>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-[10px] text-left text-[11.5px] font-semibold uppercase tracking-[0.04em] text-xsubtle ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`border-b border-border-subtle px-4 py-3 ${className}`}>{children}</td>;
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="text-[13.5px] font-medium text-ink">{value}</span>
    </div>
  );
}
