"use client";

import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";

import { formatCkb } from "@/lib/api/format";

import { StatusTag } from "../badges";
import { formatDateTime, shortId } from "../format-date";
import type { InvoiceView } from "../invoice-view";

// Client Component: antd's <Table> columns carry `render` functions, which
// cannot cross the Server->Client Component serialization boundary (unlike
// the plain-data `rows` prop, see invoice-view.ts's bigint fix) — so the
// columns + <Table> itself must live here, not in the Server Component
// dashboard/page.tsx that fetches `rows`. Mirrors invoices-table.tsx's
// established pattern for the same reason.

const RECENT_COLUMNS: ColumnsType<InvoiceView> = [
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
      <span className="font-mono text-[13px] font-medium text-[#141414]">
        {formatCkb(row.amountCkb)} <span className="font-sans text-[11px] font-normal text-[#a1a1aa]">{row.asset}</span>
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
    render: (createdAt: string | null) => <span className="text-[12px] text-[#71717a]">{formatDateTime(createdAt)}</span>,
  },
];

export function RecentInvoicesTable({ rows }: { rows: InvoiceView[] }) {
  return <Table dataSource={rows} columns={RECENT_COLUMNS} pagination={false} rowKey="id" className="fibergate-table" />;
}
