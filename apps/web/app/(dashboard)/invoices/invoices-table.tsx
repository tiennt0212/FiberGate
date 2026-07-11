"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Input, InputNumber, Select, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";

import { formatCkb } from "@/lib/api/format";

import { StatusTag } from "../badges";
import { DateRangeFilter } from "../date-range-filter";
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

// Labels match FiberGate.dc.html's <select> options exactly (COMPONENTS.dc.html's
// <Segmented> recommendation for this filter is stale — the mockup moved to native
// <select> dropdowns after that catalog was last synced).
const STATUS_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "Paid", value: "paid" },
  { label: "Pending", value: "pending" },
  { label: "Expired", value: "expired" },
  { label: "Failed", value: "failed" },
];

const ASSET_OPTIONS = [
  { label: "All Assets", value: "all" },
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
      render: (id: string) => <span className="font-mono text-[12px] text-text-muted">{shortId(id)}</span>,
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      render: (description: string | null) => description ?? "—",
    },
    {
      // Amount + asset unit combined into one column — matches Overview's
      // Recent Invoices pattern (recent-invoices-table.tsx). Deviates from
      // FiberGate.dc.html's Invoices page (which keeps Amount/Asset as 2
      // separate columns, Asset as a badge) — intentional, per human review.
      title: "Amount",
      key: "amount",
      align: "right",
      render: (_: unknown, row: InvoiceView) => (
        <span className="font-mono text-[13px] font-medium text-text-primary">
          {formatCkb(row.amountCkb)} <span className="font-sans text-[11px] font-normal text-text-subtle">{row.asset}</span>
        </span>
      ),
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
      render: (createdAt: string | null) => <span className="text-[12px] text-text-muted">{formatDateTime(createdAt)}</span>,
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
      <div className="mb-4 text-[12.5px] text-text-muted">All payment invoices</div>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search ID or description…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-54! rounded-md!"
          allowClear
        />
        <Select
          value={filters.status}
          onChange={(value) => updateFilters({ status: value })}
          options={STATUS_OPTIONS}
          className="w-33! [&_.ant-select-selector]:rounded-md!"
        />
        <Select
          value={filters.asset}
          onChange={(value) => updateFilters({ asset: value })}
          options={ASSET_OPTIONS}
          className="w-30! [&_.ant-select-selector]:rounded-md!"
        />
        <DateRangeFilter from={filters.from} to={filters.to} onChange={(range) => updateFilters(range)} />
        <div className="flex items-center gap-1 rounded-md border border-border bg-white px-1.5 py-0.5">
          <InputNumber
            placeholder="Min"
            value={filters.min === "" ? null : Number(filters.min)}
            onChange={(value) => updateFilters({ min: value === null ? "" : String(value) })}
            controls={false}
            className="w-15! border-none! text-[12.5px]! shadow-none!"
          />
          <span className="shrink-0 text-[12px] text-[#d4d4d8]">–</span>
          <InputNumber
            placeholder="Max"
            value={filters.max === "" ? null : Number(filters.max)}
            onChange={(value) => updateFilters({ max: value === null ? "" : String(value) })}
            controls={false}
            className="w-15! border-none! text-[12.5px]! shadow-none!"
          />
        </div>
        {hasActiveFilters ? (
          <Button
            onClick={clearFilters}
            className="h-auto! rounded-md! px-2.5! py-1.5! text-[12.5px]!"
          >
            Clear filters
          </Button>
        ) : null}
        <div className="ml-auto text-[12.5px] text-text-muted">{rows.length} invoices</div>
      </div>

      {error ? (
        <Alert type="error" showIcon message={error} className="rounded-md!" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
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
