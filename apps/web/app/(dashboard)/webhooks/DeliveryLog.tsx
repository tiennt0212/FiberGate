"use client";

import { Button, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined } from "@ant-design/icons";
import type { WebhookDelivery } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export function DeliveryLog({ deliveries }: { deliveries: WebhookDelivery[] }) {
  const columns: ColumnsType<WebhookDelivery> = [
    {
      title: "Event",
      dataIndex: "event_type",
      render: (event: string) => (
        <span className="font-mono text-[12px] text-text-primary">{event}</span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: WebhookDelivery["status"], row) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {row.http_status != null && (
            <Tag className="m-0 border-0 bg-border-subtle font-mono text-[11px] text-text-muted">
              {row.http_status}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "Attempts",
      dataIndex: "attempt_count",
      align: "center",
      render: (n: number) => <span className="text-[12.5px]">{n}</span>,
    },
    {
      title: "Time",
      dataIndex: "created_at",
      render: (iso: string) => (
        <span className="text-[12.5px] text-text-muted">
          {formatDateTime(iso)}
        </span>
      ),
    },
    {
      title: "",
      key: "action",
      align: "right",
      render: (_, row) =>
        row.status === "failed" ? (
          <Button size="small" icon={<ReloadOutlined />}>
            Resend
          </Button>
        ) : null,
    },
  ];

  return (
    <Table<WebhookDelivery>
      rowKey="id"
      columns={columns}
      dataSource={deliveries}
      pagination={false}
      size="middle"
    />
  );
}
