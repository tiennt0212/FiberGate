"use client";

import { Button, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FileTextOutlined } from "@ant-design/icons";
import type { Invoice } from "@/lib/types";
import { formatAmount, formatDateTime, shortHash } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";
import { AssetTag } from "./AssetTag";

export function InvoiceTable({
  invoices,
  onReceipt,
  pagination = false,
}: {
  invoices: Invoice[];
  onReceipt?: (invoice: Invoice) => void;
  pagination?: boolean;
}) {
  const columns: ColumnsType<Invoice> = [
    {
      title: "Invoice",
      dataIndex: "id",
      render: (id: string, row) => (
        <div className="flex flex-col">
          <span className="font-mono text-[12px] text-text-primary">{id}</span>
          <span className="text-[11.5px] text-text-subtle">
            {shortHash(row.payment_hash)}
          </span>
        </div>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      render: (_: number, row) => (
        <span className="font-mono text-[13px] font-medium text-text-primary">
          {formatAmount(row.amount, row.asset)}
        </span>
      ),
    },
    {
      title: "Asset",
      dataIndex: "asset",
      render: (asset: Invoice["asset"]) => <AssetTag asset={asset} />,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: Invoice["status"]) => <StatusBadge status={status} />,
    },
    {
      title: "Created",
      dataIndex: "created_at",
      render: (iso: string) => (
        <span className="text-[12.5px] text-text-muted">
          {formatDateTime(iso)}
        </span>
      ),
    },
  ];

  if (onReceipt) {
    columns.push({
      title: "",
      key: "action",
      align: "right",
      render: (_, row) => (
        <Button
          size="small"
          icon={<FileTextOutlined />}
          onClick={() => onReceipt(row)}
        >
          Receipt
        </Button>
      ),
    });
  }

  return (
    <Table<Invoice>
      rowKey="id"
      columns={columns}
      dataSource={invoices}
      pagination={pagination ? { pageSize: 10, size: "small" } : false}
      size="middle"
    />
  );
}
