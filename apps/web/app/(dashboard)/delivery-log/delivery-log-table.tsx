"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input, Select, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";

import type { WebhookDeliveryListItem } from "@/lib/services/webhooks";

import { deliveryHttpText, deliveryStatusColor } from "../badges";
import { downloadCsv } from "../search-params";
import { formatDateTime, shortId } from "../format-date";
import { TablePagination } from "../table-pagination";
import { useBusyKeys } from "../use-busy-keys";
import { useHeaderActionContext } from "../header-action-context";
import { useTableFilters } from "../use-table-filters";

import { exportDeliveryLogCsv, retryDelivery, type DeliveryLogCsvFilters } from "./actions";

export interface DeliveryLogFilters {
  endpoint: string;
  status: string;
  q: string;
  from: string;
  to: string;
}

const FILTER_DEFAULTS: DeliveryLogFilters = { endpoint: "", status: "all", q: "", from: "", to: "" };

// Labels match FiberGate.dc.html's <select> options exactly (COMPONENTS.dc.html's
// <Segmented> recommendation for this filter is stale — the mockup moved to native
// <select> dropdowns after that catalog was last synced). Values stay the same
// as webhook_deliveries.status (pending/success/failed, see deliver.ts) — only
// the label wording changes to match the mockup's HTTP-code framing.
const STATUS_OPTIONS = [
  { label: "All HTTP", value: "all" },
  { label: "2xx Success", value: "success" },
  { label: "Timeout / Retrying", value: "pending" },
  { label: "4xx / 5xx Error", value: "failed" },
];

export function DeliveryLogTable({
  rows,
  page,
  hasNextPage,
  endpointOptions,
  filters,
  error,
}: {
  rows: WebhookDeliveryListItem[];
  page: number;
  hasNextPage: boolean;
  endpointOptions: { label: string; value: string }[];
  filters: DeliveryLogFilters;
  error: string | null;
}) {
  const router = useRouter();
  const { setAction } = useHeaderActionContext();
  const [exporting, setExporting] = useState(false);
  // Keyed per delivery id so retrying multiple rows concurrently doesn't let
  // one row's finished request clear another still-in-flight row's loading
  // indicator. Shared with webhooks-panel.tsx's toggle/regenerate tracking
  // via useBusyKeys() (also gains its re-entrancy guard against a
  // double-click firing a second concurrent retry for the same row).
  const retryingIds = useBusyKeys();

  const { searchInput, setSearchInput, updateFilters, goToPage, clearFilters, hasActiveFilters } = useTableFilters({
    filters,
    defaults: FILTER_DEFAULTS,
    searchKey: "q",
  });

  useEffect(() => {
    const csvFilters: DeliveryLogCsvFilters = { endpointId: filters.endpoint, status: filters.status, search: filters.q, from: filters.from, to: filters.to };
    setAction({
      label: "Export CSV",
      loading: exporting,
      onClick: () => {
        setExporting(true);
        exportDeliveryLogCsv(csvFilters)
          .then((csv) => downloadCsv(csv, "delivery-log.csv"))
          .catch((exportError: unknown) => {
            console.error("Delivery Log: exportDeliveryLogCsv failed:", exportError);
            void message.error("Could not export the delivery log.");
          })
          .finally(() => setExporting(false));
      },
    });
    return () => setAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.endpoint, filters.status, filters.q, filters.from, filters.to, exporting]);

  function handleRetry(deliveryId: string): void {
    if (!retryingIds.start(deliveryId)) return;
    retryDelivery(deliveryId)
      .then((result) => {
        if (result.ok) {
          void message.success("Delivery re-queued for retry");
          router.refresh();
        } else {
          void message.error(result.error ?? "Could not retry this delivery.");
        }
      })
      .catch((retryError: unknown) => {
        console.error("Delivery Log: retryDelivery failed:", retryError);
        void message.error("Could not retry this delivery.");
      })
      .finally(() => retryingIds.settle(deliveryId));
  }

  const columns: ColumnsType<WebhookDeliveryListItem> = [
    {
      title: "Invoice ID",
      dataIndex: "invoiceId",
      key: "invoiceId",
      render: (invoiceId: string | null) => <span className="font-mono text-[12px] text-text-muted">{shortId(invoiceId)}</span>,
    },
    {
      title: "Event",
      dataIndex: "eventType",
      key: "eventType",
      render: (eventType: string) => <span className="font-mono text-[12px] text-text-primary">{eventType}</span>,
    },
    {
      title: "Endpoint",
      dataIndex: "endpointUrl",
      key: "endpointUrl",
      render: (endpointUrl: string | null) => (
        <span className="block max-w-50 truncate text-[12px] text-text-muted">{endpointUrl ?? "—"}</span>
      ),
    },
    {
      title: "HTTP",
      key: "http",
      render: (_: unknown, row: WebhookDeliveryListItem) => (
        <span className="font-mono text-[12px] font-semibold" style={{ color: deliveryStatusColor(row.status).text }}>
          {deliveryHttpText(row, "Timeout")}
        </span>
      ),
    },
    {
      title: "Delivered",
      key: "delivered",
      render: (_: unknown, row: WebhookDeliveryListItem) => (
        <span className="text-[12px] text-text-muted">{formatDateTime(row.deliveredAt ?? row.createdAt)}</span>
      ),
    },
    {
      title: "",
      key: "actions",
      align: "right",
      render: (_: unknown, row: WebhookDeliveryListItem) =>
        row.status === "failed" ? (
          <Button
            size="small"
            loading={retryingIds.has(row.id)}
            onClick={() => handleRetry(row.id)}
            className="h-auto! rounded-[5px]! px-2.5! py-1! text-[11px]!"
          >
            Retry
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="animate-[fade-in_0.2s_ease-out_forwards]">
      <div className="mb-4 text-[12.5px] text-text-muted">Webhook delivery log for all payment events</div>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search invoice ID…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-49! rounded-md!"
          allowClear
        />
        <Select
          value={filters.endpoint || "all"}
          onChange={(value) => updateFilters({ endpoint: value === "all" ? "" : value })}
          options={[{ label: "All Endpoints", value: "all" }, ...endpointOptions]}
          className="w-50! [&_.ant-select-selector]:rounded-md!"
        />
        <Select
          value={filters.status}
          onChange={(value) => updateFilters({ status: value })}
          options={STATUS_OPTIONS}
          className="w-41! [&_.ant-select-selector]:rounded-md!"
        />
        <input
          type="date"
          value={filters.from}
          onChange={(e) => updateFilters({ from: e.target.value })}
          className="rounded-md border border-border px-2.5 py-1.5 text-[12.5px] text-text-strong"
        />
        <span className="text-[12px] text-text-subtle">–</span>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => updateFilters({ to: e.target.value })}
          className="rounded-md border border-border px-2.5 py-1.5 text-[12.5px] text-text-strong"
        />
        {hasActiveFilters ? (
          <Button onClick={clearFilters} className="h-auto! rounded-md! px-2.5! py-1.5! text-[12.5px]!">
            Clear filters
          </Button>
        ) : null}
        <div className="ml-auto text-[12.5px] text-text-muted">{rows.length} events</div>
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
            locale={{ emptyText: "No delivery events match these filters." }}
          />
          <TablePagination page={page} hasNextPage={hasNextPage} onPageChange={goToPage} />
        </div>
      )}
    </div>
  );
}
