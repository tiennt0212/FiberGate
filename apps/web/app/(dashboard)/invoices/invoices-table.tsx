"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Input, Segmented, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";

import { formatCkb } from "@/lib/api/format";

import { AssetTag, SEGMENTED_CLASS, StatusTag } from "../badges";
import { downloadCsv } from "../search-params";
import { formatDateTime, shortId } from "../format-date";
import { useHeaderActionContext } from "../header-action-context";
import type { InvoiceView } from "../invoice-view";
import { TablePagination } from "../table-pagination";
import { useTableFilters } from "../use-table-filters";

import { exportInvoicesCsv, type InvoiceCsvFilters } from "./actions";
import { ReceiptDrawer } from "./receipt-drawer";

export interface InvoicesFilters {
  status: string;
  asset: string;
  q: string;
  from: string;
  to: string;
  min: string;
  max: string;
}

const FILTER_DEFAULTS: InvoicesFilters = { status: "all", asset: "all", q: "", from: "", to: "", min: "", max: "" };

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Paid", value: "paid" },
  { label: "Pending", value: "pending" },
  { label: "Expired", value: "expired" },
  { label: "Failed", value: "failed" },
];

const ASSET_OPTIONS = [
  { label: "All assets", value: "all" },
  { label: "CKB", value: "CKB" },
  { label: "RUSD", value: "RUSD" },
];

export function InvoicesTable({
  rows,
  page,
  hasNextPage,
  filters,
  error,
}: {
  rows: InvoiceView[];
  page: number;
  hasNextPage: boolean;
  filters: InvoicesFilters;
  error: string | null;
}) {
  const { setAction } = useHeaderActionContext();
  const [exporting, setExporting] = useState(false);
  const [receiptInvoiceId, setReceiptInvoiceId] = useState<string | null>(null);

  const { searchInput, setSearchInput, updateFilters, goToPage, clearFilters, hasActiveFilters } = useTableFilters({
    filters,
    defaults: FILTER_DEFAULTS,
    searchKey: "q",
  });

  useEffect(() => {
    const csvFilters: InvoiceCsvFilters = { ...filters, search: filters.q };
    setAction({
      label: "Export CSV",
      loading: exporting,
      onClick: () => {
        setExporting(true);
        exportInvoicesCsv(csvFilters)
          .then((csv) => downloadCsv(csv, "invoices.csv"))
          .catch((exportError: unknown) => {
            console.error("Invoices: exportInvoicesCsv failed:", exportError);
            void message.error("Could not export invoices.");
          })
          .finally(() => setExporting(false));
      },
    });
    return () => setAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.asset, filters.q, filters.from, filters.to, filters.min, filters.max, exporting]);

  const columns: ColumnsType<InvoiceView> = [
    {
      title: "Invoice ID",
      dataIndex: "id",
      key: "id",
      render: (id: string) => <span className="font-mono text-[12px] text-[#71717a]">{shortId(id)}</span>,
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      render: (description: string | null) => description ?? "—",
    },
    {
      title: "Amount",
      key: "amount",
      align: "right",
      render: (_: unknown, row: InvoiceView) => (
        <span className="font-mono text-[13px] font-medium text-[#141414]">{formatCkb(row.amountCkb)}</span>
      ),
    },
    {
      title: "Asset",
      dataIndex: "asset",
      key: "asset",
      render: (asset: string) => <AssetTag asset={asset} />,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => <StatusTag status={status} />,
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (createdAt: string | null) => <span className="text-[12px] text-[#71717a]">{formatDateTime(createdAt)}</span>,
    },
    {
      title: "",
      key: "actions",
      align: "right",
      render: (_: unknown, row: InvoiceView) =>
        row.status === "paid" ? (
          <Button size="small" onClick={() => setReceiptInvoiceId(row.id)} className="h-auto! rounded-[5px]! px-2.5! py-1! text-[11.5px]!">
            Receipt
          </Button>
        ) : row.status === "pending" ? (
          <Button
            size="small"
            onClick={() => {
              navigator.clipboard
                .writeText(row.invoiceAddress)
                .then(() => message.success("Payment request copied"))
                .catch((copyError: unknown) => console.error("Failed to copy invoice address:", copyError));
            }}
            className="h-auto! rounded-[5px]! px-2.5! py-1! text-[11.5px]!"
          >
            Copy request
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="animate-[fade-in_0.2s_ease-out_forwards]">
      <div className="mb-4 text-[12.5px] text-[#71717a]">All payment invoices</div>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search ID or description…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-[216px]! rounded-[6px]!"
          allowClear
        />
        <Segmented options={STATUS_OPTIONS} value={filters.status} onChange={(value) => updateFilters({ status: String(value) })} className={SEGMENTED_CLASS} />
        <Segmented options={ASSET_OPTIONS} value={filters.asset} onChange={(value) => updateFilters({ asset: String(value) })} className={SEGMENTED_CLASS} />
        <input
          type="date"
          value={filters.from}
          onChange={(e) => updateFilters({ from: e.target.value })}
          className="rounded-[6px] border border-[#e4e4e7] px-2.5 py-1.5 text-[12.5px] text-[#374151]"
        />
        <span className="text-[12px] text-[#a1a1aa]">–</span>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => updateFilters({ to: e.target.value })}
          className="rounded-[6px] border border-[#e4e4e7] px-2.5 py-1.5 text-[12.5px] text-[#374151]"
        />
        <div className="flex items-center gap-1 rounded-[6px] border border-[#e4e4e7] bg-white px-2.5 py-1.5">
          <input
            type="number"
            placeholder="Min"
            value={filters.min}
            onChange={(e) => updateFilters({ min: e.target.value })}
            className="w-[52px] border-none text-[12.5px] text-[#374151] outline-none"
          />
          <span className="flex-shrink-0 text-[12px] text-[#d4d4d8]">–</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.max}
            onChange={(e) => updateFilters({ max: e.target.value })}
            className="w-[52px] border-none text-[12.5px] text-[#374151] outline-none"
          />
        </div>
        {hasActiveFilters ? (
          <Button
            onClick={clearFilters}
            className="h-auto! rounded-[6px]! px-2.5! py-1.5! text-[12.5px]!"
          >
            Clear filters
          </Button>
        ) : null}
        <div className="ml-auto text-[12.5px] text-[#71717a]">{rows.length} invoices</div>
      </div>

      {error ? (
        <Alert type="error" showIcon message={error} className="rounded-[6px]!" />
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-[#e4e4e7]">
          <Table
            dataSource={rows}
            columns={columns}
            pagination={false}
            rowKey="id"
            className="fibergate-table"
            locale={{ emptyText: "No invoices match these filters." }}
          />
          <TablePagination page={page} hasNextPage={hasNextPage} onPageChange={goToPage} />
        </div>
      )}

      <ReceiptDrawer invoiceId={receiptInvoiceId} onClose={() => setReceiptInvoiceId(null)} />
    </div>
  );
}
