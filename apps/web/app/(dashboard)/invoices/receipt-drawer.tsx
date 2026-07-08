"use client";

import { useEffect, useState } from "react";
import { Drawer, Spin, message } from "antd";

import { deliveryHttpText, StatusTag } from "../badges";
import { formatDateTime } from "../format-date";

import { getInvoiceReceipt, type InvoiceReceipt } from "./actions";

// Colocated with invoices-table.tsx (its only caller) — split out per
// frontend-exp's component-split-large so invoices-table.tsx stays focused
// on the filter bar + table. Fetches lazily (only once opened) via the
// getInvoiceReceipt Server Action, which also returns the invoice's webhook
// delivery history (reusing lib/services/webhooks.ts's listWebhookDeliveries()
// filtered by invoiceId) — matches the mockup's "Delivery Events" section.
// No "Download PDF" action: that would need a PDF-generation dependency,
// which CLAUDE.md requires asking about first.

export function ReceiptDrawer({
  invoiceId,
  onClose,
}: {
  invoiceId: string | null;
  onClose: () => void;
}) {
  const [receipt, setReceipt] = useState<InvoiceReceipt | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!invoiceId) {
      setReceipt(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getInvoiceReceipt(invoiceId)
      .then((result) => {
        if (!cancelled) {
          setReceipt(result);
        }
      })
      .catch((error: unknown) => {
        console.error("ReceiptDrawer: getInvoiceReceipt failed:", error);
        if (!cancelled) {
          void message.error("Could not load the receipt.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  return (
    <Drawer
      open={invoiceId !== null}
      onClose={onClose}
      width={480}
      title="Payment Receipt"
      styles={{ header: { padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6" }, body: { padding: 0 } }}
    >
      {loading || !receipt ? (
        <div className="flex justify-center py-16">
          <Spin spinning={loading} />
        </div>
      ) : (
        <>
          <div className="border-b border-[#f3f4f6] p-6">
            <div className="flex flex-col gap-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px] text-[#71717a]">Description</span>
                <span className="text-[13.5px] font-medium text-[#141414]">{receipt.description ?? "—"}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px] text-[#71717a]">Amount</span>
                <span className="font-mono text-[13.5px] font-bold text-[#141414]">
                  {receipt.amountCkb} <span className="font-sans text-[11.5px] font-normal text-[#71717a]">{receipt.asset}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-[#71717a]">Status</span>
                <StatusTag status={receipt.status} />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px] text-[#71717a]">Paid at</span>
                <span className="text-[12.5px] text-[#141414]">{formatDateTime(receipt.paidAt)}</span>
              </div>
              <div className="border-t border-[#f3f4f6] pt-3.5">
                <div className="mb-1.5 text-[12px] text-[#71717a]">Payment hash</div>
                <div className="break-all rounded-[5px] bg-[#f3f4f6] px-2.5 py-2 font-mono text-[11px] leading-relaxed text-[#374151]">
                  {receipt.paymentHash}
                </div>
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="mb-3 text-[13px] font-semibold text-[#141414]">Delivery Events</div>
            {receipt.deliveries.length > 0 ? (
              <div className="overflow-hidden rounded-[8px] border border-[#e4e4e7]">
                {receipt.deliveries.map((delivery) => (
                  <div key={delivery.id} className="flex items-center gap-3 border-b border-[#f3f4f6] px-4 py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[12px] text-[#141414]">{delivery.eventType}</div>
                      <div className="mt-0.5 truncate text-[11.5px] text-[#a1a1aa]">{delivery.endpointUrl ?? "—"}</div>
                    </div>
                    <span className="font-mono text-[12px] font-semibold text-[#71717a]">
                      {deliveryHttpText(delivery)}
                    </span>
                    <span className="flex-shrink-0 whitespace-nowrap text-[11.5px] text-[#a1a1aa]">
                      {formatDateTime(delivery.deliveredAt ?? delivery.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[8px] border border-[#e4e4e7] px-5 py-5 text-center text-[13px] text-[#a1a1aa]">
                No webhook deliveries for this invoice.
              </div>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
