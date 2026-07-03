"use client";

import { useMemo, useState } from "react";
import { Card, Empty, Segmented, Tabs } from "antd";
import { invoices as allInvoices } from "@/lib/mock/data";
import { INVOICE_STATUSES, type Invoice, type InvoiceStatus } from "@/lib/types";
import { InvoiceTable } from "@/components/InvoiceTable";
import { ReceiptModal } from "./ReceiptModal";

type StatusFilter = InvoiceStatus | "all";
type AssetFilter = "all" | "CKB" | "RUSD";

export default function TransactionsPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [asset, setAsset] = useState<AssetFilter>("all");
  const [selected, setSelected] = useState<Invoice | null>(null);

  const filtered = useMemo(() => {
    const statusFilter = status.toLowerCase();
    const assetFilter = asset.toLowerCase();
    return allInvoices.filter(
      (i) =>
        (status === "all" || i.status.toLowerCase() === statusFilter) &&
        (asset === "all" || i.asset.toLowerCase() === assetFilter),
    );
  }, [status, asset]);

  const invoicesTab = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<StatusFilter>
          value={status}
          onChange={setStatus}
          options={[
            { label: "All", value: "all" },
            { label: "Paid", value: INVOICE_STATUSES.PAID },
            { label: "Pending", value: INVOICE_STATUSES.PENDING },
            { label: "Expired", value: INVOICE_STATUSES.EXPIRED },
            { label: "Failed", value: INVOICE_STATUSES.FAILED },
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
      </div>

      <Card styles={{ body: { padding: 0 } }}>
        {filtered.length > 0 ? (
          <InvoiceTable
            invoices={filtered}
            onReceipt={setSelected}
            pagination
          />
        ) : (
          <div className="py-12">
            <Empty description="No invoices match these filters" />
          </div>
        )}
      </Card>
    </div>
  );

  return (
    <>
      <Tabs
        defaultActiveKey="invoices"
        items={[
          { key: "invoices", label: "Invoices", children: invoicesTab },
          {
            key: "settlement",
            label: "Settlement log",
            children: (
              <Card styles={{ body: { padding: 48 } }}>
                <Empty description="Settlement log coming soon" />
              </Card>
            ),
          },
        ]}
      />
      <ReceiptModal invoice={selected} onClose={() => setSelected(null)} />
    </>
  );
}
